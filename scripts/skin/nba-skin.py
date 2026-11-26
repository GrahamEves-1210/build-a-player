#!/usr/bin/env python3
"""Basketball skin tones from the ESPN headshots (owner 11-26: "some players look white, like Ja Morant").

The old `skin` values were single samples off the studio photos: highlights, shadows and the bright studio light
made them unreliable (Ja Morant read lighter than Stephen Curry). This re-derives every basketball player's tone:

  1. Find the face. The photos are ESPN cut-outs (alpha). Use the row's `faceCenter` [x%, y%] (between the eyes)
     when it has one, else the head found from the alpha mask (calibrated on the players who do have one).
  2. Sample skin patches scaled to the head width: forehead, both cheeks, the nose bridge.
  3. Keep only skin: opaque, hue 10-80 deg in CIELAB, some chroma (drops black/brown hair, beard, eye whites,
     grey background bleed), then trim the brightest 20% (specular) and darkest 25% (shadow, beard edge).
     Robust median in Lab.
  4. Undo the studio exposure with one fixed mapping in Lab (calibrated by eye on the contact sheet), plus a few
     hand overrides for unusual photos (HAND below).

Read-only on images: they are opened and read, never written.

  PYTHONPATH=<pillow+numpy> python3 scripts/skin/nba-skin.py measure  -> scripts/skin/out/measure.json
  ... sheet <out.png> [--cbb]   contact sheet (crop | old | new), sorted by new lightness
  ... apply                     writes only the `skin:` values in the data files
"""
import json, os, re, sys, math
import numpy as np
np.seterr(all="ignore")
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'scripts', 'skin', 'out')
NBA_FILES = ['nba-guards', 'nba-bigs', 'nba-guard-legends', 'nba-big-legends']
CBB_FILES = ['cbb-players', 'cbb-legends']

# hand-set tones for photos the sampler can't read (a dark or warm studio shoot, a flash-lit rookie photo, an old
# legend's photo), as an ITA angle on the same ramp: scripts/skin/hand.json
HAND = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hand.json'))).items() if k != '_'}

# ── colour ───────────────────────────────────────────────────────────────────────────────────────────────────
def srgb_to_lab(rgb):  # rgb: (...,3) 0-255
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)

def lab_to_hex(L, a, b):
    fy = (L + 16) / 116; fx = fy + a / 500; fz = fy - b / 200
    def inv(t): return t ** 3 if t ** 3 > 0.008856 else (t - 16 / 116) / 7.787
    X, Y, Z = inv(fx) * 0.95047, inv(fy), inv(fz) * 1.08883
    M = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    rgb = M @ np.array([X, Y, Z])
    rgb = np.where(rgb <= 0.0031308, 12.92 * rgb, 1.055 * np.clip(rgb, 0, None) ** (1 / 2.4) - 0.055)
    rgb = np.clip(np.round(rgb * 255), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(rgb)

def hex_to_lab(h):
    return srgb_to_lab(np.array([[int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)]], float))[0]

def lum(h):  # the game's luminance (figure.js / BucketApp)
    return (int(h[1:3], 16) * 0.3 + int(h[3:5], 16) * 0.59 + int(h[5:7], 16) * 0.11) / 255

# ── the exposure correction (calibrated on the contact sheet) ────────────────────────────────────────────────
# Raw lightness off a studio photo is mostly the studio's exposure: Ja Morant's forehead reads nearly as light as
# Tyrese Haliburton's. The dermatologists' Individual Typology Angle, ITA = atan((L - 50) / b), weighs lightness
# against how yellow-brown the skin is, which separates tones far better under bright light. The tone is ordered
# by ITA and placed on a fixed lightness ramp (anchors set by eye on the sheet); its hue comes from the photo,
# with the chroma brought down to a real skin's.
ITA_RAMP = [(-60, 24), (-40, 28), (-20, 33), (0, 38), (15, 42), (28, 46), (36, 55), (42, 64), (50, 71), (60, 76), (75, 80)]
B_CAP = 32.0   # a warm-balanced photo (Devin Booker's) inflates b; past this it's the light, not the skin
CHROMA = 0.8

def ita(L, a, b):
    return math.degrees(math.atan2(L - 50, b))

def ramp(x, pts):
    if x <= pts[0][0]: return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]

def correct(L, a, b, ita_set=None):
    L2 = ramp(ita(L, a, min(b, B_CAP)) if ita_set is None else ita_set, ITA_RAMP)
    C = min(34.0, math.hypot(a, b) * CHROMA)
    h = math.atan2(b, a)
    h = max(math.radians(35), min(math.radians(70), h))
    return L2, C * math.cos(h), C * math.sin(h)

# ── data ─────────────────────────────────────────────────────────────────────────────────────────────────────
NAME_RE = re.compile(r"""name:\s*(['"])((?:\\.|(?!\1).)*)\1""")
SKIN_RE = re.compile(r"""skin:\s*(['"])(#[0-9a-fA-F]{6})\1""")
FC_RE = re.compile(r"faceCenter:\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]")
HS_RE = re.compile(r"""headshot:\s*(['"])([^'"]+)\1""")

def rows():
    nba_map = json.load(open(os.path.join(ROOT, 'src/data/nba-headshots.json')))
    out = []
    for f in NBA_FILES + CBB_FILES:
        lines = open(os.path.join(ROOT, 'src/data', f + '.js'), encoding='utf8').read().split('\n')
        for i, ln in enumerate(lines):
            n, s = NAME_RE.search(ln), SKIN_RE.search(ln)
            if not n: continue
            # a player row with no skin at all (LeBron, many legends): gets one added before `position:`
            if not s and not (re.match(r"\s*\{\s*name:", ln) and 'position:' in ln): continue
            name = n.group(2).replace("\\'", "'").replace('\\"', '"')
            img = None
            if f in NBA_FILES:
                if name in nba_map:
                    img = 'public/headshots/nba/' + nba_map[name]
            else:
                h = HS_RE.search(ln)
                if h: img = 'public/headshots/' + h.group(2)
            if img:
                img = next((img + e for e in ('.webp', '.png', '.jpg') if os.path.exists(os.path.join(ROOT, img + e))), None)
            fc = FC_RE.search(ln)
            out.append({'file': f, 'line': i, 'name': name, 'old': s.group(2).lower() if s else None, 'img': img,
                        'fc': [float(fc.group(1)), float(fc.group(2))] if fc else None, 'cbb': f in CBB_FILES})
    return out

# ── the face ─────────────────────────────────────────────────────────────────────────────────────────────────
def head_of(alpha):
    """Head from the cut-out: top of the mask, and its width a little below the top (the skull)."""
    H, W = alpha.shape
    m = alpha > 128
    cols = m[:, int(W * 0.3):int(W * 0.7)]
    rows_on = np.where(cols.sum(1) > 3)[0]
    if not len(rows_on): return None
    top = rows_on[0]
    # span of the mask in the centre band over the next rows; the head is the first steady width
    spans = []
    for y in range(top, min(H, top + int(H * 0.6))):
        xs = np.where(m[y])[0]
        if len(xs) == 0: spans.append((0, 0, 0)); continue
        # the run that contains the centre
        cx = int(W / 2)
        if not m[y, cx]:
            near = xs[np.argmin(abs(xs - cx))]; cx = near
        l = cx
        while l > 0 and m[y, l - 1]: l -= 1
        r = cx
        while r < W - 1 and m[y, r + 1]: r += 1
        spans.append((l, r, r - l))
    widths = np.array([s[2] for s in spans])
    return top, spans, widths

def face_geom(alpha, fc):
    H, W = alpha.shape
    hd = head_of(alpha)
    if hd is None: return None
    top, spans, widths = hd
    if fc:
        fx, fy = fc[0] / 100 * W, fc[1] / 100 * H
        k = int(fy) - top
        k = max(0, min(len(spans) - 1, k))
        # head width: the widest the head gets between the top and the eye line (hair/ears included)
        hw = widths[:k + 1].max() if k > 0 else widths.max()
        return fx, fy, hw, top
    # no faceCenter: head width = max over the first 0.35 of the band (before shoulders); eye line ~ top + 0.62*hw
    band = widths[: int(len(widths) * 0.5)]
    hw = np.percentile(band[band > 0], 90) if (band > 0).any() else W * 0.25
    # eye line: below the top by a fraction of the head width, calibrated on rows that have faceCenter
    fy = top + CAL_EYE * hw
    k = max(0, min(len(spans) - 1, int(fy) - top))
    l, r, _ = spans[k]
    fx = (l + r) / 2 if r > l else W / 2
    return fx, fy, hw, top

CAL_EYE = 0.75

# The face region, anchored on the hairline found from the skin itself (faceCenter marks different spots on
# different photos, and hair height varies): from just under the hairline down to the upper lip, the middle
# 60% of the head's width. Eyes, brows, teeth, lips, beard and hair drop out on hue/chroma and the trim.
REGION = {'top': 0.06, 'bottom': 0.68, 'half': 0.28}
TRIM = (25, 75)   # the percentile band of lightness kept (drops shadow/beard edge and highlights)

def skin_mask(lab, alpha):
    C = np.hypot(lab[..., 1], lab[..., 2]); hue = np.degrees(np.arctan2(lab[..., 2], lab[..., 1]))
    return (alpha > 240) & (C > 8) & (hue > 15) & (hue < 75) & (lab[..., 0] > 12) & (lab[..., 0] < 92)

def measure_one(path, fc):
    im = Image.open(path)
    im.load()
    rgba = np.asarray(im.convert('RGBA'), dtype=float)
    alpha = rgba[..., 3]
    g = face_geom(alpha, fc)
    if g is None: return None
    fx, fy, hw, top = g
    H, W = alpha.shape
    lab = srgb_to_lab(rgba[..., :3])
    sk = skin_mask(lab, alpha)
    # the hairline: the first row (from the top of the head) where most of the centre strip is skin
    x0, x1 = max(0, int(fx - 0.18 * hw)), min(W, int(fx + 0.18 * hw))
    frac = sk[:, x0:x1].mean(1)
    # brown or blond hair passes the hue test, so the hairline is also where the strip gets as light as the face
    # around the eyes and nose (ref)
    e0, e1 = max(0, int(fy - 0.1 * hw)), min(H, int(fy + 0.2 * hw))
    eye = lab[e0:e1, x0:x1][sk[e0:e1, x0:x1]]
    ref = np.median(eye[:, 0]) if len(eye) > 20 else 50
    medL = np.array([np.median(lab[y, x0:x1, 0]) for y in range(H)])
    ok = (frac > 0.6) & (medL > ref - 15)
    hl = None
    for y in range(top, min(H - 3, top + int(1.3 * hw))):
        if ok[y] and ok[y + 1] and ok[y + 2]: hl = y; break
    if hl is None: hl = int(fy - 0.35 * hw)
    ry0, ry1 = int(hl + REGION['top'] * hw), int(hl + REGION['bottom'] * hw)
    rx0, rx1 = int(fx - REGION['half'] * hw), int(fx + REGION['half'] * hw)
    ry0, rx0 = max(0, ry0), max(0, rx0); ry1, rx1 = min(H, ry1), min(W, rx1)
    box = (rx0, ry0, rx1, ry1)
    s = lab[ry0:ry1, rx0:rx1][sk[ry0:ry1, rx0:rx1]]
    if len(s) < 50: return {'geom': [float(fx), float(fy), float(hw), int(top)], 'boxes': {'face': box}, 'n': int(len(s))}
    s = s[s[:, 0] >= np.percentile(s[:, 0], 75) - 18]   # brows, lashes, brown hair, deep shadow
    lo, hi = np.percentile(s[:, 0], TRIM[0]), np.percentile(s[:, 0], TRIM[1])
    s = s[(s[:, 0] >= lo) & (s[:, 0] <= hi)]
    L, a, b = np.median(s[:, 0]), np.median(s[:, 1]), np.median(s[:, 2])
    return {'geom': [float(fx), float(fy), float(hw), int(top)], 'boxes': {'face': box}, 'n': int(len(s)),
            'hl': int(hl), 'raw': [float(L), float(a), float(b)]}

# ── commands ─────────────────────────────────────────────────────────────────────────────────────────────────
def measure():
    os.makedirs(OUT, exist_ok=True)
    rs = rows()
    cache = {}
    for r in rs:
        if not r['img']: continue
        key = (r['img'], tuple(r['fc']) if r['fc'] else None)
        if key not in cache: cache[key] = measure_one(os.path.join(ROOT, r['img']), r['fc'])
        m = cache[key]
        if m: r.update(m)
    json.dump(rs, open(os.path.join(OUT, 'measure.json'), 'w'))
    print(len(rs), 'rows,', sum(1 for r in rs if r.get('raw')), 'measured')

def new_of(r):
    if not r.get('raw'): return None
    # a hand tone goes with his photo: an NBA name can also be a different college player (Devin Booker)
    key = r['name'] if '/nba/' in r['img'] else r['name'] + ' @' + os.path.basename(r['img']).split('.')[0]
    return lab_to_hex(*correct(*r['raw'], ita_set=HAND.get(key)))

def load():
    return json.load(open(os.path.join(OUT, 'measure.json')))

def sheet(out_png, which='nba', names=None, cols=8, page=0):
    rs = [r for r in load() if r.get('raw')]
    rs = [r for r in rs if (r['cbb'] if which == 'cbb' else not r['cbb'])]
    if names: rs = [r for r in rs if r['name'] in names]
    seen, uniq = set(), []
    for r in rs:
        k = (r['name'], r['img'])
        if k in seen: continue
        seen.add(k); uniq.append(r)
    for r in uniq: r['new'] = new_of(r); r['Lnew'] = hex_to_lab(r['new'])[0]
    uniq.sort(key=lambda r: r['Lnew'])
    CW, CH = 150, 122
    rowsN = math.ceil(len(uniq) / cols)
    img = Image.new('RGB', (cols * CW, rowsN * CH), (40, 44, 40))
    d = ImageDraw.Draw(img)
    for i, r in enumerate(uniq):
        x0, y0 = (i % cols) * CW, (i // cols) * CH
        im = Image.open(os.path.join(ROOT, r['img'])).convert('RGBA')
        fx, fy, hw, top = r['geom']
        box = (int(fx - hw * 0.62), int(fy - hw * 0.55), int(fx + hw * 0.62), int(fy + hw * 0.69))
        cr = im.crop(box).resize((90, 90))
        bg = Image.new('RGBA', cr.size, (128, 128, 128, 255)); bg.alpha_composite(cr)
        img.paste(bg.convert('RGB'), (x0 + 2, y0 + 2))
        d.rectangle([x0 + 94, y0 + 2, x0 + 120, y0 + 91], fill=r['old'] or (40, 44, 40), outline=(90, 90, 90))
        d.rectangle([x0 + 121, y0 + 2, x0 + 147, y0 + 91], fill=r['new'])
        star = '*' if (r['name'] if '/nba/' in r['img'] else r['name'] + ' @' + os.path.basename(r['img']).split('.')[0]) in HAND else ''
        d.text((x0 + 2, y0 + 94), (star + r['name'])[:24], fill=(235, 235, 235))
        d.text((x0 + 2, y0 + 106), '%s>%s %d' % ((r['old'] or '#none  ')[1:], r['new'][1:], i), fill=(170, 200, 170))
    img.save(out_png)
    print(out_png, len(uniq))
    if page:  # the same sheet cut into pages small enough to check by eye
        per = page * CH
        for k in range(math.ceil(img.height / per)):
            img.crop((0, k * per, img.width, min(img.height, (k + 1) * per))).save(out_png.replace('.png', '_p%d.png' % (k + 1)))

def apply():
    rs = load()
    by = {}
    for r in rs:
        nw = new_of(r)
        if nw and nw != r['old']: by.setdefault(r['file'], {})[r['line']] = (r['old'], nw)
    n = 0
    for f, ch in by.items():
        p = os.path.join(ROOT, 'src/data', f + '.js')
        lines = open(p, encoding='utf8').read().split('\n')
        for i, (old, nw) in ch.items():
            ln = lines[i]
            m = SKIN_RE.search(ln)
            if old is None:
                assert not m and ln.count('position:') == 1, (f, i)
                q = "'" if "name: '" in ln else '"'
                lines[i] = ln.replace('position:', 'skin: %s%s%s, position:' % (q, nw, q), 1)
            else:
                assert m and m.group(2).lower() == old, (f, i)
                lines[i] = ln[:m.start(2)] + nw + ln[m.end(2):]
            n += 1
        open(p, 'w', encoding='utf8').write('\n'.join(lines))
    print('changed', n)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'measure': measure()
    elif cmd == 'sheet': sheet(sys.argv[2], 'cbb' if '--cbb' in sys.argv else 'nba',
                               names=[a for a in sys.argv[3:] if not a.startswith('--')] or None,
                               page=8 if '--pages' in sys.argv else 0)
    elif cmd == 'apply': apply()
