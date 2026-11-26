# The hair colour of every soccer player with a photo, for the striker figure's hair (StrikerFigureOverlay.jsx,
# lib/soccerHair.js hairOf). Read off his headshot (lib/soccerFace.js soccerFaceKey: ESPN, else FotMob; the images are
# only read, never written): the head is found in the photo's alpha (the top of the head to the narrowest point of the
# neck), the face's skin is sampled on the forehead and cheeks, and the hair is the band across the crown, kept inside
# the head (the cut-out's soft edge eroded away) and with the pixels that read as his skin taken out. Too little hair
# left there (the crown is his skin) means bald or shaved. The hair's colour is then put in a small palette of real
# hair colours (PALETTE), so it reads cleanly in the figure's flat style; grey goes to the dark it once was (the
# players are drawn at about 21).
#
#   PYTHONPATH=<pillow+numpy> python3 scripts/soccer/hair-colors.py [--sheet out.png [names...]]
#     -> src/data/soccer-hair.json { "<photo key>": "<palette name>" } ("soccer/fmr-123": "blond", "bald" for no hair)
#        --sheet: a contact sheet (photo crop, the crown band, the sampled colour and the palette swatch) to check by eye
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'src', 'data', 'soccer-hair.json')

# the palette's names (the figure's tones are in lib/soccerHair.js HAIR)
PALETTE_ORDER = ['black', 'darkbrown', 'brown', 'lightbrown', 'darkblond', 'blond', 'platinum', 'auburn', 'ginger', 'bald']
SWATCH = {   # (the sheet's swatches only)
  'black': '#16110e', 'darkbrown': '#2c1f17', 'brown': '#4a3222', 'lightbrown': '#6e4d33', 'darkblond': '#8f6d46',
  'blond': '#b89462', 'platinum': '#d6c7a3', 'auburn': '#6a3020', 'ginger': '#a0522a', 'bald': '#888888',
}
# hand checks against the photo, where the crown band reads wrong (a headband, a hat, a strong light)
OVERRIDE = {
  'Kevin De Bruyne': 'ginger',   # his crown is in shadow in the ESPN photo (reads dark brown); his hair is red
  'Oliver McBurnie': 'ginger',   # a sunlit, red skin tone: his red hair reads close to it
  'Tyler Morton': 'auburn',
  'João Pedro': 'black',         # a highlight across the crown
  'Vedat Muriqi': 'bald',        # a shaved, shining crown read as blond
  'Keisuke Honda': 'blond',      # bleached crop on light skin, read as his scalp
  'Troy Parrott': 'darkbrown',   # the studio light's grey sheen across his curls
  'Andrés Iniesta': 'bald',
  'Evidence Makgopa': 'bald',
  'Victor Osimhen': 'blond',     # the bleached top of his crop is small in the photo
}
SKIN_SIGMA = 2.6
CROWN = 0.18
BALD_GRAIN = 0.75


def players():
  js = """
const S = await import('./src/data/soccer-strikers.js'); const L = await import('./src/data/soccer-legends.js');
const all = [...S.SOCCER_ALL_STRIKERS, ...S.WC2026_STRIKERS, ...L.WC_LEGENDS]
console.log(JSON.stringify(all.map(p => ({ name: p.name, team: p.team, espn: p.espn ?? null, skin: p.skin ?? null }))))
"""
  out = subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
  return json.loads(out)


def face_key(p, espn, fm, by_name):
  e = espn.get(str(p['espn'])) if p['espn'] is not None else None
  if e:
    return e.rsplit('.', 1)[0]
  i = fm.get(f"{p['name']}|{p['team']}") or by_name.get(p['name'])
  return f'soccer/fmr-{i}' if i else None


def lab(rgb):
  c = rgb / 255.0
  c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
  M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
  xyz = c @ M.T / np.array([0.9505, 1.0, 1.089])
  f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
  L = 116 * f[..., 1] - 16
  a = 500 * (f[..., 0] - f[..., 1])
  b = 200 * (f[..., 1] - f[..., 2])
  return np.stack([L, a, b], -1)


def erode(m, r):
  out = m.copy()
  for dy in range(-r, r + 1):
    for dx in range(-r, r + 1):
      if dx * dx + dy * dy <= r * r:
        out &= np.roll(np.roll(m, dy, 0), dx, 1)
  return out


def measure(path):
  im = np.asarray(Image.open(path).convert('RGBA')).astype(np.float64)
  A = im[..., 3] > 200
  rows = np.where(A.any(1))[0]
  if len(rows) == 0:
    return None
  y0 = rows[0]
  H, W = A.shape
  width = A.sum(1)
  # the head's width: the widest row in the top part (the ears), the neck: the narrowest row below it
  top = width[y0:y0 + 200]
  hw = top[:150].max()
  ear = y0 + int(np.argmax(top[:150]))
  below = width[ear:min(H, ear + 160)]
  neck = ear + int(np.argmin(np.where(below > 0, below, 9999)))
  hh = max(60, neck - y0)
  # the head's centre line (the middle of the opaque run at the ear row)
  xs = np.where(A[ear])[0]
  cx = (xs[0] + xs[-1]) / 2
  inner = erode(A, 5)
  L = lab(im[..., :3])
  # his skin: forehead-to-cheek patch in the middle of the face, its skin-like pixels' median
  fy0, fy1 = int(y0 + hh * 0.42), int(y0 + hh * 0.70)
  fx0, fx1 = int(cx - hw * 0.28), int(cx + hw * 0.28)
  patch = L[fy0:fy1, fx0:fx1][inner[fy0:fy1, fx0:fx1]]
  rgbp = im[fy0:fy1, fx0:fx1, :3][inner[fy0:fy1, fx0:fx1]]
  if len(patch) < 50:
    return None
  # skin: reddish, not the darkest (eyes, brows) nor the brightest (glare)
  ok = (rgbp[:, 0] > rgbp[:, 2]) & (patch[:, 1] > 4)
  sk = patch[ok] if ok.sum() > 40 else patch
  lo, hi = np.percentile(sk[:, 0], [20, 75])
  sk = sk[(sk[:, 0] >= lo) & (sk[:, 0] <= hi)]
  skin = np.median(sk, 0)
  # the crown: the top of the head down a sixth of the head, in the middle 70% of its width (the hair on every
  # head that has any, above the hairline of the shortest crop)
  by0, by1 = int(y0), int(y0 + hh * CROWN)
  bx0, bx1 = int(cx - hw * 0.36), int(cx + hw * 0.36)
  band = inner[by0:by1, bx0:bx1]
  bl = L[by0:by1, bx0:bx1][band]
  brgb = im[by0:by1, bx0:bx1, :3][band]
  if len(bl) < 80:
    return None
  # a crown pixel reads as skin when its colour (a, b) is inside the spread of his face's (Mahalanobis on the skin's
  # own covariance, floored so a very even face doesn't make every slight shift hair) at about the face's lightness
  ab = sk[:, 1:]
  cov = np.cov(ab.T) + np.eye(2) * 4.0
  inv = np.linalg.inv(cov)
  dd = bl[:, 1:] - ab.mean(0)
  mah = np.sqrt(np.einsum('ni,ij,nj->n', dd, inv, dd))
  skinlike = (mah < SKIN_SIGMA) & (np.abs(bl[:, 0] - skin[0]) < 16)
  # the crown's grain: hair is fine-textured (strands, curls, stubble), a bare scalp smooth (only broad light and shine)
  Lc = L[by0:by1, bx0:bx1, 0]
  blur = sum(np.roll(np.roll(Lc, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
  grain = float(np.median(np.abs(Lc - blur)[erode(band, 2)])) if erode(band, 2).sum() > 40 else 0.0
  frac = 1 - skinlike.mean()
  hair = ~skinlike
  hl = bl[hair] if hair.sum() > 30 else bl
  hrgb = brgb[hair] if hair.sum() > 30 else brgb
  # the hair's colour as it reads: its richer half (a studio top light puts a grey sheen across the crown of dark hair,
  # and the sheen has no colour of its own), and of that the upper middle of its lightness (the lit strands: not the
  # shine, not the deep shadow between the strands, near-black on every head)
  hC = np.hypot(hl[:, 1], hl[:, 2])
  rich = hC >= np.percentile(hC, 50)
  q1, q2 = np.percentile(hl[rich, 0], [50, 85])
  mid = rich & (hl[:, 0] >= q1) & (hl[:, 0] <= q2)
  col = np.median(hrgb[mid], 0)
  clab = np.median(hl[mid], 0)
  # and the hair's middle: dark, glossy hair under a studio light has bright strands too, but its middle stays dark
  lmed = float(np.median(hl[:, 0]))
  return dict(skin=skin.tolist(), lab=clab.tolist(), rgb=col.tolist(), frac=float(frac), grain=grain, lmed=lmed, box=(int(cx - hw * 0.6), int(y0 - 10), int(cx + hw * 0.6), int(y0 + hh * 1.05)), band=(bx0, by0, bx1, by1))


def classify(m):
  Lh, a, b = m['lab']
  C = (a * a + b * b) ** 0.5
  hue = np.degrees(np.arctan2(b, a))
  sL, sa, sb = m['skin']
  sC = (sa * sa + sb * sb) ** 0.5
  # how far the crown's colour is from his skin's (a, b only: a scalp is lit and shaded unlike the face)
  dab = ((a - sa) ** 2 + (b - sb) ** 2) ** 0.5
  # bald or shaved: most of the crown reads as skin, or it is smooth (no grain of hair), the skin's colour and not
  # much deeper than the face (a short dark crop on dark skin is smooth too, but well below the skin; when in doubt
  # he keeps hair: a crop drawn as hair reads right, a head of hair drawn bald doesn't)
  if m['frac'] < 0.25 or (m['grain'] < BALD_GRAIN and dab < 10 and Lh > 0.6 * sL):
    return 'bald'
  # red hair: rich and toward red (blond is yellower), and off his skin's own colour (not the skin showing through)
  # (and with a grain of hair: a smooth, sunlit scalp is as rich)
  if C >= 28 and hue < 53 and 28 < Lh < 62 and dab > 8 and m['grain'] >= 1.0:
    return 'ginger' if Lh > 36 else 'auburn'
  # lighter than his face and in its own hue: the light shining on the skin of a dark-skinned player's short crop,
  # not hair (bleached hair is yellower)
  shue = np.degrees(np.arctan2(sb, sa))
  if sL < 58 and Lh > sL and hue < 56 and abs(hue - shue) < 12:
    return 'black'
  if C < 8 and Lh < 42 or Lh < 16:
    return 'black'
  if C < 10 and Lh < 60:   # grey: the dark it once was
    return 'darkbrown'
  if Lh < 30:
    return 'darkbrown'
  if Lh < 38:
    return 'brown'
  if Lh < 46:
    return 'lightbrown'
  if Lh < 53:
    return 'darkblond'
  if Lh < 68 or C > 14:
    return 'blond'
  return 'platinum'


def main():
  espn = json.load(open(os.path.join(ROOT, 'src', 'data', 'soccer-headshots.json')))
  fm = json.load(open(os.path.join(ROOT, 'src', 'data', 'soccer-fotmob-headshots.json')))
  by_name = {}
  for k, i in fm.items():
    n = k[:k.rindex('|')]
    by_name[n] = None if n in by_name and by_name[n] != i else i
  ps = players()
  res, info, seen = {}, {}, set()
  for p in ps:
    k = face_key(p, espn, fm, by_name)
    if not k or k in seen:
      continue
    seen.add(k)
    f = os.path.join(ROOT, 'public', 'headshots', k + '.webp')
    if not os.path.exists(f):
      continue
    m = measure(f)
    if not m:
      continue
    c = OVERRIDE.get(p['name']) or classify(m)
    res[k] = c
    info[k] = (p['name'], m, c, f)
  json.dump(dict(sorted(res.items())), open(OUT, 'w'), indent=0, ensure_ascii=False)
  open(OUT, 'a').write('\n')
  from collections import Counter
  print(len(res), 'players;', dict(Counter(res.values())))
  if '--sheet' in sys.argv:
    i = sys.argv.index('--sheet')
    out, names = sys.argv[i + 1], sys.argv[i + 2:]
    rows = [v for v in info.values() if not names or v[0] in names or any(n in v[0] for n in names)]
    if names and names[0].startswith('every:'):   # every:N -> every Nth player
      rows = list(info.values())[::int(names[0][6:])]
    if names and names[0].startswith('class:'):   # class:blond -> everyone put in that colour
      rows = [v for v in info.values() if v[2] == names[0][6:]]
    sheet(rows, out)


def sheet(rows, out):
  if not rows:
    return
  cw, ch, cols = 230, 210, 8
  S = Image.new('RGB', (cw * cols, ch * ((len(rows) + cols - 1) // cols)), (60, 60, 60))
  dr = ImageDraw.Draw(S)
  for n, (name, m, c, f) in enumerate(rows):
    im = Image.open(f).convert('RGBA')
    x0, y0, x1, y1 = m['box']
    crop = im.crop((x0, y0, x1, y1))
    crop.thumbnail((cw - 10, 140))
    bg = Image.new('RGBA', crop.size, (60, 60, 60, 255)); bg.alpha_composite(crop)
    ox, oy = (n % cols) * cw, (n // cols) * ch
    S.paste(bg.convert('RGB'), (ox + 5, oy + 2))
    sc = crop.size[0] / (x1 - x0)
    bx0, by0, bx1, by1 = m['band']
    dr.rectangle([ox + 5 + (bx0 - x0) * sc, oy + 2 + (by0 - y0) * sc, ox + 5 + (bx1 - x0) * sc, oy + 2 + (by1 - y0) * sc], outline=(255, 0, 255))
    r, g, b = [int(v) for v in m['rgb']]
    dr.rectangle([ox + 5, oy + 146, ox + 45, oy + 176], fill=(r, g, b))
    dr.rectangle([ox + 48, oy + 146, ox + 88, oy + 176], fill=SWATCH[c])
    dr.text((ox + 92, oy + 148), c, fill=(255, 255, 255))
    Lh, a, b = m['lab']
    dr.text((ox + 92, oy + 162), f"L{Lh:.0f} C{(a*a+b*b)**.5:.0f} h{np.degrees(np.arctan2(b, a)):.0f} f{m['frac']:.2f} g{m['grain']:.1f} m{m['lmed']:.0f}", fill=(200, 200, 200))
    sL, sa, sb = m['skin']
    dr.text((ox + 5, oy + 182), name[:22] + f"  s{sL:.0f} C{(sa*sa+sb*sb)**.5:.0f} h{np.degrees(np.arctan2(sb, sa)):.0f}", fill=(255, 255, 255))
  S.save(out)


main()
