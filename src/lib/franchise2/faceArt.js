// FACES, the drawing (2026-11-15, the flat style). A made-up man drawn the way a TV broadcast graphic or a premium
// sports card draws him: flat colour shapes, no ink outlines, two or three tones a material with shadow shapes that
// are designed (under the brow, down the far side of the face, under the nose, the lip and the jaw), real skin tones,
// crisp hair and beards with broken edges. Few features, each one placed where it sits on a real head: an adult
// skull, the eyes halfway down it, the nose base and the mouth on the thirds below, the ears between the brow and the
// nose, a thick football neck into the jersey.
//
// Framing (ESPN's headshots): head and shoulders on a square, the head (crown to chin) 45% of the frame's height,
// centred, the eyes a little above the middle, the jersey's collar across the bottom.
//
//   faceSvg(look, { color, view, mark })  the SVG (viewBox 0 0 100 100; transparent; color: his team's; view: VIEWS;
//                                         mark: a coach's team logo for his cap and chest, { id, src, w, h, o })
//   toUrl(svg)                            a data: URL for an <img>
// Pure: no DOM, no Math.random. The look decides everything; small detail (a beard's broken edge) is seeded by it.

// ── Numbers and colour ───────────────────────────────────────────────────────
import { kitOf } from './kits'
const hexN = h => parseInt(String(h).slice(1, 7), 16)
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const mixC = (a, b, k) => {
  const x = hexN(a), y = hexN(b), c = s => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k)
  return `#${[16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join('')}`
}
export const lum = c => { const x = hexN(c); return 0.299 * ((x >> 16) & 255) + 0.587 * ((x >> 8) & 255) + 0.114 * (x & 255) }
const dark = (c, k) => mixC(c, '#000000', k)
const light = (c, k) => mixC(c, '#ffffff', k)
// (a tenth of a unit is a third of a pixel on the creator's big face: one decimal is all a drawing needs)
const f = n => { const s = String(Math.round(n * 10) / 10); return s.replace(/^(-?)0\./, '$1.') }
const P2 = p => `${f(p[0])} ${f(p[1])}`
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ── Paths ────────────────────────────────────────────────────────────────────
// a smooth curve through points (Catmull-Rom as Béziers); a point with a third element is a corner
function sm(pts, close = true) {
  const n = pts.length, at = i => (close ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)])
  let d = `M${P2(pts[0])}`
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2)
    const h1 = b[2] ? b : [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6]
    const h2 = c[2] ? c : [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6]
    // (a smooth point's first handle mirrors the last one's second: S, two points a piece instead of three)
    d += i && !b[2] ? `S${P2(h2)} ${P2(c)}` : `C${P2(h1)} ${P2(h2)} ${P2(c)}`
  }
  return close ? d + 'Z' : d
}
const poly = (pts, close = true) => `M${pts.map(P2).join('L')}${close ? 'Z' : ''}`
const RX = p => [50 + p[0], p[1], p[2]]
const LX = p => [50 - p[0], p[1], p[2]]
const ML = p => [100 - p[0], p[1], p[2]]
// a loop symmetric about x = 50 from its right half (offsets from the middle, the first and last points on it)
const sym = right => { const r = right.map(RX); return [...r, ...r.slice(1, -1).reverse().map(ML)] }
// a curve through points sampled as a dense polyline (corners kept)
function dense(pts, per = 5) {
  const out = [pts[0].slice(0, 2)]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i][2] || i === 0 ? pts[i] : pts[i - 1], b = pts[i], c = pts[i + 1], e = c[2] || i + 2 >= pts.length ? c : pts[i + 2]
    for (let j = 1; j <= per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t
      out.push([0, 1].map(k => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - e[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + e[k]) * t3)))
    }
  }
  return out
}
// a polyline cut into even steps
function even(pts, step, rnd = null) {
  const out = [pts[0]]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1])
    let s = step - carry, k = step
    while (s <= l) { const t = s / l; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); k = rnd ? step * (0.6 + rnd() * 0.8) : step; s += k }
    carry = l - (s - k)
  }
  const z = pts[pts.length - 1]
  if (Math.hypot(z[0] - out[out.length - 1][0], z[1] - out[out.length - 1][1]) > step * 0.3) out.push(z)
  else out[out.length - 1] = z
  return out
}
// a broken edge: the line nudged in and out along its normal every step (hair's and a beard's edges)
function broken(pts, amp, step, rnd, push = 0) {
  const q = even(pts, step, rnd)
  return q.map((p, i) => {
    if (i === 0 || i === q.length - 1) return p
    const a = q[i - 1], b = q[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const u = rnd(), o = (u < 0.18 ? -0.9 : u < 0.6 ? 0.25 : 1) * amp * (0.5 + rnd() * 0.8) + push
    return [p[0] + ((b[1] - a[1]) / l) * o, p[1] - ((b[0] - a[0]) / l) * o]
  })
}
// an edge of small rounded tufts bulging away from a centre (curls, coils, an afro's outline)
function tufts(pts, r, ctr, rnd, from = true) {
  let d = from ? `M${P2(pts[0])}` : `L${P2(pts[0])}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
    const dx = mx - ctr[0], dy = my - ctr[1], l = Math.hypot(dx, dy) || 1, k = r * (0.65 + 0.7 * rnd())
    d += `Q${f(mx + (dx / l) * k)} ${f(my + (dy / l) * k)} ${P2(b)}`
  }
  return d
}
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0Z`
const fill = (d, c, extra = '') => (d ? `<path d="${d}" fill="${c}"${extra}/>` : '')
// a shape that is both filled and clips what's drawn on it: its path once, used twice
const shape = (id, d, c) => `<defs><path id="${id}" d="${d}"/><clipPath id="${id}c"><use href="#${id}"/></clipPath></defs><use href="#${id}" fill="${c}"/>`
const line = (d, c, w, extra = '') => (d ? `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(w)}"${extra}/>` : '')

// ── Texture ──────────────────────────────────────────────────────────────────
// Print texture in the flat style (owner 11-16: "maybe add some texture"): a jersey's mesh, a halftone in the skin's
// shadows, the grain of short coils, a beard's stipple. Each is one small pattern, defined once in the drawing that uses
// it, laid over the shape's flat colour by reusing the shape's path; the list drawing (64 px and under) has none.
let TX = null
const tag = c => String(c).slice(1, 7)
const pat = (name, w, h, body) => {
  const id = `${TX.P}${name}`
  if (!TX.defs[name]) TX.defs[name] = `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`
  return `url(#${id})`
}
const coilTex = c => (TX && !TX.lo ? pat(`k${tag(c)}`, 1.8, 1.5, `<path d="M.1 .62q.36-.5.72 0M1 1.38q.36-.5.72 0" fill="none" stroke="${c}" stroke-width=".28" stroke-linecap="round"/>`) : null)
const dotTex = (c, k, r, o) => (TX && !TX.lo ? pat(`d${tag(c)}${String(k).replace('.', '')}`, k, k, `<circle cx="${f(k * 0.25)}" cy="${f(k * 0.25)}" r="${r}" fill="${c}" fill-opacity="${o}"/><circle cx="${f(k * 0.75)}" cy="${f(k * 0.75)}" r="${r}" fill="${c}" fill-opacity="${o}"/>`) : null)
// a shape in its flat colour with a texture over it (its path once, used twice)
function tfill(d, c, tex) {
  if (!d) return ''
  if (!tex) return fill(d, c)
  const id = `${TX.P}t${TX.n++}`
  return `<defs><path id="${id}" d="${d}"/></defs><use href="#${id}" fill="${c}"/><use href="#${id}" fill="${tex}"/>`
}

// ── Tones ────────────────────────────────────────────────────────────────────
// a skin's flat tones: B the base, M the half tone (planes turning away), S the shadow, D the deepest creases
// (nostrils, the mouth's line), H the light; warm shadows on fair skin, deeper and richer on dark skin; lips, whites
const TONES = new Map()
function skinTones(sk0) {
  let sk = sk0, t = TONES.get(sk0)
  if (t) return t
  const L0 = lum(sk), d = clamp((205 - L0) / 140, 0, 1)
  // (the deepest tones lifted a touch toward a warm brown, so a face on a dark slab still shows its features)
  sk = d > 0.6 ? mixC(sk, '#7d5038', (d - 0.6) * 0.45) : sk
  const L = lum(sk)
  const warm = mixC('#83301f', '#1c0905', d)
  const S = mixC(sk, warm, 0.3 - d * 0.08)
  t = {
    d, B: sk, S, M: mixC(sk, S, 0.48), D: mixC(sk, dark(warm, 0.45), 0.58),
    H: d < 0.55 ? mixC(sk, '#fff3e8', 0.14 - d * 0.02) : mixC(sk, '#d9b8a8', 0.14 + d * 0.06),
    lipU: d < 0.5 ? mixC(sk, '#9c4a46', 0.3 - d * 0.1) : mixC(sk, '#2a1014', 0.26),
    lipL: d < 0.5 ? mixC(sk, '#c0716a', 0.2 - d * 0.06) : mixC(sk, '#93626a', 0.2),
    white: mixC('#f0ebe5', sk, 0.16 + d * 0.12),
    lash: mixC('#140c09', sk, 0.08),
    blush: d < 0.3 ? mixC(sk, '#d0705e', 0.12) : null,
  }
  TONES.set(sk0, t)
  return t
}
function hairTones(hc, sk) {
  const dk = lum(hc) < 70
  return {
    c: hc, S: dk ? mixC(hc, '#000000', 0.45) : mixC(hc, '#2a1308', 0.36),
    H: dk ? mixC(hc, '#7a5640', 0.3) : mixC(hc, '#fff4dc', 0.3),
    f1: mixC(hc, sk, 0.4), f2: mixC(hc, sk, 0.66),
  }
}

// ── The frame ────────────────────────────────────────────────────────────────
// full: the headshot (crown to chin 46% of the frame, the chin at 62%, beside ESPN's photos in the same list). hero: the creator's big face, the same headshot framing (owner 11-15: never a close-up).
// sm: the full frame drawn lighter for lists (64 px and under). The rest are the creator's thumbnails, each cropped
// to the part it changes.
export const VIEWS = {
  full: '3.7 3.2 92.6 92.6', sm: '3.7 3.2 92.6 92.6', hero: '3.7 3.2 92.6 92.6', head: '22 9 56 56',
  eyes: '33 30 34 21', nose: '37 35 26 26', mouth: '36 44 28 23', low: '24 35 52 52', hair: '16 4 68 68', ear: '24 29 25 25',
}

// ── The head ─────────────────────────────────────────────────────────────────
// half-widths: cw the skull above the ears · tw the temples · cb the cheekbones · jw the jaw's corner (at jy) · ch the
// chin · cy the chin's bottom (the crown is at C0)
const C0 = 17.4
const SHAPE = {
  oval: { cw: 15.4, tw: 14.9, cb: 15.4, jw: 11.9, jy: 53.4, ch: 4.7, cy: 60.5 },
  square: { cw: 15.6, tw: 15.2, cb: 15.6, jw: 13.1, jy: 53.8, ch: 5.7, cy: 60.4 },
  round: { cw: 16.0, tw: 15.7, cb: 16.2, jw: 12.9, jy: 52.8, ch: 5.3, cy: 60.0 },
  long: { cw: 15.0, tw: 14.5, cb: 15.0, jw: 12.0, jy: 54.4, ch: 5.1, cy: 61.6 },
  broad: { cw: 16.4, tw: 16.1, cb: 16.7, jw: 13.9, jy: 53.6, ch: 6.1, cy: 60.6 },
  chiseled: { cw: 15.4, tw: 14.8, cb: 15.8, jw: 12.9, jy: 54.2, ch: 5.4, cy: 61.0 },
}
// what his background gives his face's structure: nk the nose's width · br the bridge's height · lk the lips'
// fullness · ck the cheekbones · eo how open the eyes are · rid how deep the brow sets them
const STRUCT = {
  w: { nk: 0.94, br: 1, lk: 0.9, ck: 0, eo: 1, rid: 1 },
  b: { nk: 1.2, br: 0.55, lk: 1.2, ck: 0.2, eo: 1.06, rid: 0.85 },
  m: { nk: 1.08, br: 0.75, lk: 1.08, ck: 0.15, eo: 1.04, rid: 0.9 },
  l: { nk: 1.02, br: 0.85, lk: 1.02, ck: 0.15, eo: 1.02, rid: 0.95 },
  p: { nk: 1.16, br: 0.7, lk: 1.12, ck: 0.5, eo: 0.98, rid: 0.9 },
}
const NOSE_W = { straight: 3.3, broad: 3.75, narrow: 2.95, short: 3.3, wide: 4.1, boxer: 3.55 }
const NOSE_BR = { straight: 0, broad: -0.15, narrow: 0.25, short: -0.1, wide: -0.2, boxer: 0.1 }
const MOUTH = { neutral: [1, 1, 1, 0, 0], full: [1.22, 1.24, 1.02, 0, 0], thin: [0.72, 0.78, 0.98, 0, 0], smirk: [1, 1, 1, 0, 0.45], wide: [1, 1.05, 1.12, 0.08, 0], stern: [0.86, 0.9, 1, -0.22, 0] }
// the eye: the upper lid's rise, the lower's drop, the tilt up to the outer corner
const EYE = { almond: [1.14, 0.68, 0.14], round: [1.28, 0.84, 0], narrow: [0.98, 0.62, 0.06], hooded: [1.06, 0.66, 0], deep: [1.08, 0.68, 0], upturn: [1.08, 0.66, 0.38] }
const sv = (look, k) => clamp(+look[k] || 0, -1, 1)
// his expression (owner 11-16: "all of the football players look super serious"), the ones real headshots show:
//   cu the mouth's corners up · cw the mouth's width · op how far it opens on the top teeth · ck how far the cheeks
//   lift (the folds from the nose, the apples of the cheeks) · sq how far the lower lids rise · one: one side only
const EXPR = {
  neutral: { cu: 0.05, cw: 1, op: 0, ck: 0, sq: 0 },
  slight: { cu: 0.55, cw: 1.04, op: 0, ck: 0.3, sq: 0.15 },
  warm: { cu: 1, cw: 1.1, op: 0, ck: 0.65, sq: 0.36 },
  grin: { cu: 1.2, cw: 1.18, op: 1.75, ck: 0.95, sq: 0.5, jaw: 0.7 },
  half: { cu: 0.9, cw: 1.05, op: 0, ck: 0.45, sq: 0.2, one: true },
}

function geo(look) {
  const s = SHAPE[look.head] ?? SHAPE.oval, w = look.wide ?? 0.2, X = STRUCT[look.g] ?? STRUCT.w
  const wt = sv(look, 'wt'), jaw = sv(look, 'jaw'), chk = sv(look, 'chk'), chn = sv(look, 'chn')
  // his own bones (look.bone, a seed): where his jaw turns, how square it is, his chin, cheekbones, temples, the set of
  // his eyes and brow, so two men with the same choices don't share one skull
  const br = rngOf(1 + (Number.isFinite(+look.bone) ? +look.bone : hashStr(`${look.head}|${look.skin}|${look.nose}|${look.eyes}`) % 1000) * 7919)
  const b = () => br() - 0.5
  const V = { jw: b() * 1.3, jy: b() * 1.8, ch: b() * 1.1, cy: b() * 1.2, cb: b() * 0.9, tw: b() * 0.8, sq: br(), es: b() * 0.5, ey: b() * 0.6, by: b() * 0.6, nb: b() * 0.8, my: b() * 0.5, rid: br() }
  // a player is 21 to 30: full cheeks and a tight jaw; a coach's face has his years in it (co)
  const young = !look.co
  const G = {
    w, wt, X, V, young,
    cw: s.cw + w * 0.55 + wt * 0.45, tw: s.tw + w * 0.55 + wt * 0.5 + V.tw,
    cb: s.cb + w * 0.6 + wt * 0.65 + chk * 0.55 + X.ck * 0.3 + V.cb + (young ? 0.35 : 0),
    jw: s.jw + w * 0.9 + wt * 0.95 + jaw * 1.3 + V.jw, ch: s.ch + w * 0.3 + wt * 0.45 + jaw * 0.65 + V.ch,
    jy: s.jy + chn * 0.45 + wt * 0.35 + V.jy - (young ? 0.5 : 0), cy: s.cy + chn * 1.2 + wt * 0.25 + V.cy - (young ? 0.9 : 0),
    // (the neck by his build: a lineman's as wide as his jaw, a receiver's a good deal narrower)
    nw: 10.4 + w * 3.4 + wt * 1.1,
    lean: clamp(0.45 - w * 0.3 - wt * 0.5 + chk * 0.4, 0, 1) * (young ? 0.4 : 1), soft: clamp(wt * 0.8 + w * 0.15 + (young ? 0.35 : 0), 0, 1),
    ey: 38.3 + V.ey, es: 6.5 + sv(look, 'esp') * 0.5 + V.es, ez: 1 + sv(look, 'esz') * 0.11 + (young ? 0.05 : 0),
    nb: 47.5 + sv(look, 'nsl') * 0.9 + (look.head === 'long' ? 0.4 : 0) + V.nb,
  }
  G.by = G.ey - 2.85 - sv(look, 'brh') * 0.75 + V.by - (young ? 0.3 : 0)
  G.nwid = (NOSE_W[look.nose] ?? 3.3) * X.nk * (1 + sv(look, 'nsw') * 0.18)
  G.br = clamp(X.br + (NOSE_BR[look.nose] ?? 0), 0.2, 1.3)
  const M = MOUTH[look.mouth] ?? MOUTH.neutral
  G.M = M
  G.mw = 5.3 * M[2] * (1 + sv(look, 'mw') * 0.1) * (0.96 + X.nk * 0.04)
  G.lk = (1 + sv(look, 'lip') * 0.35) * X.lk
  G.my = G.nb + (G.cy - G.nb) * 0.33 + V.my
  G.E = EXPR[look.expr] ?? EXPR.neutral
  // the whole face with the smile (owner 11-17): the cheeks round out and lift, the brows relax up a touch, an open
  // smile drops the jaw a little
  { const E = G.E, k = E.ck * (E.one ? 0.6 : 1)
    G.cb += k * 0.35; G.soft = clamp(G.soft + k * 0.35, 0, 1); G.by -= k * 0.3
    if (E.jaw) { G.cy += E.jaw; G.jy += E.jaw * 0.4 } }
  // (a half smile's side: his own, from his bones)
  G.hs = (Number.isFinite(+look.bone) ? +look.bone : 1) % 2 ? 1 : -1
  // how much one side of the face takes the expression (a half smile: the near side barely)
  G.ex = s => (G.E.one ? (s === G.hs ? 1 : 0.22) : 1)
  G.hl = 24.8 + ((hashStr(`${look.hair}|${look.skin}|${look.head}`) % 9) - 4) * 0.12
  const { cw, tw, cb, jw, jy, ch, cy, lean, soft } = G
  // the head's right half, crown to chin (offsets from the middle)
  G.R = [[0, C0], [cw * 0.5, C0 + 1.25], [cw * 0.84, C0 + 4.6], [cw * 0.98, C0 + 9.2], [cw, C0 + 12.2], [tw, 33.6], [cb, 40.4], [cb - 0.5 - lean * 0.7 + soft * 0.45, 46.2],
    [jw + 0.4, jy - 2.1], [jw - 0.3 + V.sq * 0.3, jy + 0.6 - V.sq * 0.3], [jw - 2.7 + soft * 0.6 + V.sq * 0.7, jy + 3.9 - V.sq * 0.4], [ch + 1.1 + V.sq * 0.3, cy - 1.15], [ch * 0.42, cy - 0.08], [0, cy]]
  G.Rd = dense(G.R, 6)
  return G
}
// the head's half-width at a height
function hx(G, y) {
  const R = G.Rd
  if (y <= R[0][1]) return 0
  for (let i = 1; i < R.length; i++) if (R[i][1] >= y) { const a = R[i - 1], b = R[i], t = (y - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * t }
  return 0
}

// ── Hair ─────────────────────────────────────────────────────────────────────
// a cap of hair on the skull: t how far it stands off the top · ts off the sides · hl the hairline's middle · sb where
// the sideburn (or the sides) end · rec how far the temples are back · sq a line-up's square corner
function capPts(G, { t = 1, ts = 0.35, hl = G.hl, sb = 37.6, rec = 0, sq = false } = {}) {
  const { cw } = G, xb = hx(G, sb)
  const out = [[xb + ts, sb, 1], [Math.max(cw, xb) + ts + 0.1, Math.min(31.4, sb - 0.5)], [cw * 0.97 + ts * 0.4 + t * 0.2, C0 + 7.6 - t * 0.3], [cw * 0.84 + t * 0.35, C0 + 4.4 - t * 0.75], [cw * 0.5 + t * 0.2, C0 + 1.15 - t * 0.95], [0, C0 - t]]
  if (sb <= 31.9) out.splice(1, 1)
  // the hairline: a line-up's straight edge and square corners, or a natural line rising a little at the temples
  const inn = (sq ? [[0, hl + rec * 0.7], [4, hl + 0.1 + rec * 0.9], [cw - 3.4 - rec * 2.4, hl + 0.5 + rec * 3, 1], [cw - 2 - rec * 0.6, hl + 3.2 + rec * 3]]
    : [[0, hl + rec * 0.7], [3.5, hl + 0.15 + rec], [cw - 4.6 - rec * 2.6, hl + 0.9 + rec * 3.2], [cw - 3 - rec * 1.4, hl + 0.2 + rec * 3.8], [cw - 1.7 - rec * 0.4, hl + 2.8 + rec * 2.8]])
    .concat([[cw - 1.3, Math.max(hl + 5.8 + rec * 2.2, 31.4)], [G.tw - 1.25, 34.8]])
    .filter(p => p[1] < sb - 0.4)
  inn.push([xb - 1.05, sb, 1])
  return { out, inn }
}
// the cap's outline: smooth, or its outer edge in tufts (r) for curls and coils
function capD(G, o, r = 0, rnd = null, ctr = [50, 33]) {
  const { out, inn } = capPts(G, o)
  const outer = [...out.map(RX), ...out.slice(0, -1).reverse().map(LX)]
  const inner = [...inn.slice(1).reverse().map(LX), ...inn.map(RX)]
  if (!r) return sm([...outer, ...inner])
  const od = even(dense(outer, 6), r * 1.95)
  return tufts(od, r, ctr, rnd) + `L${dense(inner, 4).map(P2).join('L')}Z`
}
// long hair's mass behind the head (to y1, w past the skull), and the part of it that falls over the shoulders in
// front of the jersey (each side of the neck)
function mass(G, y1, w, rnd, from = 44) {
  const { cw } = G
  // (tucked behind the ears: nothing round the face above them, owner 11-16)
  const right = [[0, C0 - 0.5], [cw * 0.7, C0 + 0.6], [cw - 0.8, C0 + 8], [cw - 0.6, 37], [cw - 0.4, from - 6], [cw + w * 0.55, from], [cw + w, Math.max(from + 6, 52)], [cw + w + 0.6, y1 - 3]]
  const edge = broken(dense([[50 + cw + w + 0.6, y1 - 3], [50 + cw * 0.5, y1], [50, y1 + 0.6], [50 - cw * 0.5, y1], [50 - cw - w - 0.6, y1 - 3]], 6), 0.7, 1.1, rnd)
  return poly([...dense(right.map(RX), 4), ...edge.slice(1), ...dense(right.map(LX), 4).reverse().slice(1)])
}
function flowD(G, rnd) {
  const { cw, nw } = G
  let d = ''
  for (const s of [-1, 1]) {
    const out = [[cw - 1.2, 38], [cw + 0.4, 43], [cw + 1.2, 48.4], [cw + 2.4, 52.6], [cw + 4, 55.2]]
    const bot = broken(dense([[cw + 4, 55.2], [cw + 1.8, 56.4], [nw + 3, 55.4], [nw + 0.4, 54.6]], 5), 0.6, 0.9, rnd)
    d += poly([...dense(out, 4), ...bot.slice(1), [nw, 44]].map(p => [50 + s * p[0], p[1]]))
  }
  return d
}
function panels(G, y1, w, rnd) {
  const { cw, nw } = G
  let d = ''
  for (const s of [-1, 1]) {
    const top = [[nw + 0.4, 57], [cw + w - 0.6, 55]], bot = broken(dense([[cw + w + 0.6, y1 - 2], [(cw + nw) / 2 + 1, y1], [nw + 1, y1 - 1.6]], 5), 0.6, 1, rnd)
    d += poly([...top, ...bot].map(p => [50 + s * p[0], p[1]]))
  }
  return d
}
// how a cut draws on his hair: tight coils, loose curls or straight hair
const TIPS = '#b8893c'
const TEXOF = { b: 'coil', m: 'curl', p: 'curl', l: 'str', w: 'str' }
function hairOf(look, G, T, rnd, lo, hide) {
  // (dyed tips: black hair, the ends of locs and twists in the dye)
  const tip = look.hc === TIPS ? TIPS : null
  const st = hide === 'all' ? 'shaved' : look.hair, H = hairTones(tip ? '#16110e' : look.hc, T.B), tex = TEXOF[look.g] ?? 'str'
  if (tip) H.H = mixC(TIPS, '#16110e', 0.2)
  const coil = tex === 'coil', R = { back: '', mid: '', front: '' }
  const { cw, hl } = G
  const sides = (c, o = {}) => fill(capD(G, { t: 0.3, ts: 0.2, sq: true, ...o }), c)
  // short coils in their grain (so a fade or a buzz on a Black man reads as hair, not a cap); straight hair in strands
  const kt = coilTex(lum(H.c) < 70 ? mixC(H.c, '#a08068', 0.36) : mixC(H.H, H.c, 0.1))
  const coilD = (d, c) => tfill(d, c, kt)
  const strands = (n, sweep = 0, y0 = hl - 0.5, y1 = C0 + 0.6) => {
    if (lo) return ''
    let d = '', e = ''
    for (let i = 0; i < n; i++) {
      const x = -cw + 3.2 + ((i + 0.5) * (2 * cw - 6.4)) / n + (rnd() - 0.5) * 0.8
      const a = [50 + x, y0 + Math.abs(x) * 0.1 - rnd() * 0.8], c = [50 + x * 0.92 + sweep, (y0 + y1) / 2 - 1.2], b = [50 + x * 0.66 + sweep * 1.8, y1 + Math.abs(x) * 0.22]
      if (i % 2) e += `M${P2(a)}Q${P2(c)} ${P2(b)}`
      else d += `M${P2(a)}Q${P2(c)} ${P2(b)}`
    }
    return line(d, H.S, 0.38, ' stroke-linecap="round"') + line(e, H.H, 0.3, ' stroke-linecap="round"')
  }
  // the light across the top of short hair: one designed crescent on the near side
  const sheen = t => (lo ? '' : fill(sm([[50 - cw * 0.8, C0 + 5 - t * 0.45], [50 - cw * 0.5, C0 + 1.4 - t * 0.75], [50 - cw * 0.05, C0 + 0.3 - t * 0.85], [50 + cw * 0.3, C0 + 0.9 - t * 0.78],
    [50 - cw * 0.05, C0 + 1.5 - t * 0.6], [50 - cw * 0.48, C0 + 2.8 - t * 0.5], [50 - cw * 0.72, C0 + 6 - t * 0.4]]), H.H))
  switch (st) {
    case 'shaved': return R
    case 'buzz':
      R.front = (coil ? coilD : fill)(capD(G, { t: 0.35, ts: 0.2, sq: true }, coil ? 0.22 : 0, rnd), mixC(H.c, T.B, coil ? 0.25 : 0.36))
      return R
    case 'crew':
      if (coil) { R.front = coilD(capD(G, { t: 1.0, ts: 0.3, sq: true }, 0.32, rnd), mixC(H.c, T.B, 0.12)); return R }
      R.front = sides(H.f1) + fill(capD(G, { t: 1.9, ts: 0.4, sb: 30.4, hl: hl - 0.2 }), H.c) + strands(9, 0.4)
        + (lo ? '' : fill(sm([[38.6, hl - 0.4], [44, C0 + 0.8], [53, C0 - 0.2], [50, C0 + 1.9], [42.4, hl - 2.2]]), H.H))
      return R
    case 'fade': {
      const top = coil ? coilD(capD({ ...G, cw: G.cw - 1.1 }, { t: 1.6, ts: 0.2, sb: 29.4, sq: true }, 0.42, rnd), H.c)
        : fill(capD(G, { t: 2.6, ts: 0.4, sb: 29.6, hl: hl - 0.4 }), H.c) + strands(9, 0.6) + (lo ? '' : fill(sm([[39, hl - 0.6], [45, C0 - 0.4], [54, C0 - 1.2], [50, C0 + 1.6], [42.6, hl - 2.4]]), H.H))
      R.front = sides(H.f2) + fill(capD(G, { t: 0.5, ts: 0.25, sb: 33.6, sq: true }), H.f1) + top
      return R
    }
    case 'waves': {
      R.front = coilD(capD(G, { t: 0.8, ts: 0.3, sq: true }, 0.18, rnd), mixC(H.c, T.B, 0.08))
      if (!lo) {
        let d = ''
        for (let k = 0; k < 3; k++) { const r = 5 + k * 2.8, y = hl + 2 - k * 0.6; d += `M${f(50 - r)} ${f(y - k * 1.4)}Q50 ${f(y - r * 0.8 - k * 1.6)} ${f(50 + r)} ${f(y - k * 1.4)}` }
        R.front += line(d, mixC(H.H, H.c, 0.35), 0.5, ' stroke-linecap="round"')
      }
      return R
    }
    case 'sidepart': {
      // a side part on his right (the viewer's left): the hair lifted off the part and swept across
      const part = 50 - cw * 0.34
      R.front = sides(H.f1) + fill(capD(G, { t: 2.7, ts: 0.45, sb: 30.6, hl: hl - 0.2 }), H.c) + strands(10, 2.4)
      if (!lo) R.front += fill(sm([[part + 1.4, hl - 0.6], [52, hl - 2], [50 + cw - 3.4, hl - 0.6], [50 + cw - 1.6, hl - 2.8], [56, C0 + 0.6], [part + 1.6, C0 + 2.4]]), H.H)
        + line(`M${f(part)} ${f(hl + 0.2)}Q${f(part - 0.4)} ${f(C0 + 4)} ${f(part + 0.6)} ${f(C0 - 1.6)}`, H.S, 0.55)
      return R
    }
    case 'textured': {
      const { out, inn } = capPts(G, { t: 2.7, ts: 0.4, sb: 30.4, hl: hl + 0.3 })
      const outer = broken(dense([...out.map(RX), ...out.slice(0, -1).reverse().map(LX)], 6), 0.55, 1.25, rnd, 0.25)
      const fringe = broken(dense([...inn.slice(1).reverse().map(LX), ...inn.map(RX)], 4), 0.4, 1.1, rnd)
      R.front = sides(H.f1) + fill(poly([...outer, ...fringe]), H.c) + strands(10, 0.3) + sheen(2.7)
      return R
    }
    case 'curly': case 'afro': {
      const big = st === 'afro', r = big ? 1.25 : coil ? 0.75 : 1.05
      let top
      if (big) {
        const rx = cw + 5, ry = 14.4, yc = C0 + 7.2, o = [[hx(G, 38.4) + 1.2, 38.4, 1]]
        for (let j = 0; j <= 4; j++) { const a = -0.2 + (j / 4) * (Math.PI / 2 + 0.2); o.push(j === 4 ? [0, yc - ry] : [rx * Math.cos(a), yc - ry * Math.sin(a)]) }
        const { inn } = capPts(G, { sb: 38.4, sq: true })
        const od = even(dense([...o.map(RX), ...o.slice(0, -1).reverse().map(LX)], 6), r * 1.7)
        top = tufts(od, r, [50, 30], rnd) + `L${dense([...inn.slice(1).reverse().map(LX), ...inn.map(RX)], 4).map(P2).join('L')}Z`
      } else top = capD(G, { t: coil ? 3.2 : 3.8, ts: 0.6, sb: 31.4, hl: hl + 0.2 }, r, rnd)
      R.front = (big ? '' : sides(H.f1)) + coilD(top, H.c)
      if (!lo) {
        let d = '', e = ''
        const n = big ? 14 : 9, y0 = big ? C0 - 4 : C0 - 0.5, y1 = hl - 3, x0 = big ? 50 - cw - 1 : 50 - cw + 3.5, x1 = 100 - x0
        for (let i = 0; i < n; i++) {
          const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), q = r * (0.7 + rnd() * 0.5)
          d += `M${f(x - q)} ${f(y)}q${f(q)} ${f(q * 0.9)} ${f(q * 2)} 0`
          if (x < 50 && rnd() < 0.6) e += `M${f(x - q)} ${f(y - 0.5)}q${f(q)} ${f(-q * 0.8)} ${f(q * 2)} 0`
        }
        // (curls: their grain is the texture; an afro also gets a few loose curls on its near side)
        if (big) R.front += line(e, mixC(H.H, H.c, 0.3), 0.4, ' stroke-linecap="round"')
      }
      return R
    }
    case 'twists': {
      R.front = sides(H.f2) + fill(capD(G, { t: 0.5, ts: 0.25, sb: 33.4, sq: true }), H.f1)
        + coilD(capD(G, { t: 4.6, ts: 0.5, sb: 30.2, sq: true }, 1.25, rnd, [50, 34]), H.c)
      if (!lo) {
        let d = ''
        for (let x = -cw + 3; x <= cw - 3; x += 2.1) { const xb = 50 + x, y0 = hl - 0.6 + Math.abs(x) * 0.12; d += `M${f(xb)} ${f(y0)}Q${f(xb + x * 0.08 + 0.6)} ${f(y0 - 4)} ${f(xb + x * 0.22)} ${f(C0 - 2.6 + Math.abs(x) * 0.18)}` }
        R.front += line(d, H.S, 0.5)
      }
      return R
    }
    case 'locs': case 'locsup': case 'starter': {
      // locs (owner 11-16: separate ropes with a twisted grain, out of a parted scalp, falling over and behind the
      // shoulders with gravity, darker at the roots, never over his eyes): shoulder-length, tied up in a bun, or short
      // starter locs on top with faded sides
      const root = mixC(H.c, '#000000', 0.25), body = H.c, grain = lum(H.c) < 70 ? mixC(H.c, '#9a7a62', 0.4) : H.H, tipC = tip
      // (each rope its root-dark edge, its body and its twisted grain; the strokes share one group's fill and caps)
      const Ls = (d, c, w, x = '') => `<path d="${d}" stroke="${c}" stroke-width="${f(w)}"${x}/>`
      const RL = { back: '', mid: '', front: '' }
      const rope = (pts, w, layer = 'f', tipped = true) => {
        const d = sm(pts, false)
        let o = Ls(d, root, w + 0.35) + Ls(d, body, w)
        if (!lo) o += Ls(d, grain, w * 0.55, ` stroke-dasharray="${f(w * 0.32)} ${f(w * 0.55)}"`)
        if (tipC && tipped && pts.length > 2) { const z = pts[pts.length - 1], y = pts[pts.length - 2]; o += Ls(`M${P2([z[0] + (y[0] - z[0]) * 0.35, z[1] + (y[1] - z[1]) * 0.35])}L${P2(z)}`, tipC, w) }
        RL[layer === 'b' ? 'back' : layer === 'm' ? 'mid' : 'front'] += o
      }
      const out = () => { for (const k of ['back', 'mid', 'front']) if (RL[k]) R[k] += `<g fill="none" stroke-linecap="round">${RL[k]}</g>`; return R }
      // the scalp under them, parted in rows (dark at the roots)
      if (st === 'starter') R.front = sides(H.f2) + fill(capD(G, { t: 0.5, ts: 0.25, sb: 33.4, sq: true }), H.f1)
      R.front += fill(capD(G, { t: 0.7, ts: 0.3, sb: st === 'starter' ? 30.4 : 37.6, sq: true }), mixC(root, T.B, 0.18))
      const n = 11
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, x = (u * 2 - 1) * (cw - 2.4), w = 1.25 + rnd() * 0.45, y0 = hl + 0.6 + Math.abs(x) * 0.16
        if (st === 'starter') { const h = 3.4 + rnd() * 2; rope([[50 + x, y0], [50 + x * 1.08 + (rnd() - 0.5), y0 - h * 0.6], [50 + x * 1.18 + (rnd() - 0.5) * 1.4, y0 - h]], w); continue }
        // pulled back over the top (to a bun, or over the crown and down the back)
        const top = st === 'locsup' ? [50 + x * 0.25, C0 - 1.4] : [50 + x * 0.8 + (rnd() - 0.5) * 2, C0 - 1.2 + Math.abs(x) * 0.12]
        rope([[50 + x, y0], [50 + x * 1.02 + (rnd() - 0.5), (y0 + top[1]) / 2 - 2.2], top], w, 'f', false)
      }
      if (st === 'starter') return out()
      if (st === 'locsup') {
        // the bun: short loops piled on the crown, a few ends hanging at the back
        for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, x = 50 + Math.cos(a) * 2.6, y = C0 - 3.6 + Math.sin(a) * 1.5; rope([[x - 1.2, y + 0.8], [x, y - 1.6], [x + 1.4, y + 0.4]], 1.5, 'b') }
        for (const s of [-1, 1]) rope([[50 + s * (cw - 1.5), 32], [50 + s * (cw + 0.6), 40], [50 + s * (cw + 0.8), 47]], 1.3, 'b')
        return out()
      }
      // shoulder length: behind the head and shoulders (back), falling over the front of the shoulders (mid), and a few
      // framing the face from the temples, outside the eyes (front)
      for (const s of [-1, 1]) {
        for (let k = 0; k < 9; k++) {
          const x0 = cw - 3.2 + k * 0.4, y0 = 22 + k * 1.5, len = 32 + rnd() * 18, drift = 1.2 + k * 0.6 + rnd() * 2.2
          const pts = [[50 + s * x0, y0], [50 + s * (x0 + drift * 0.8), y0 + len * 0.35], [50 + s * (x0 + drift + (rnd() - 0.3) * 1.6), y0 + len * 0.7], [50 + s * (x0 + drift * 0.9 + (rnd() - 0.5) * 2), y0 + len]]
          rope(pts, 1.15 + rnd() * 0.7, k < 4 ? 'b' : 'm')
        }
        for (let k = 0; k < 2; k++) {
          const x0 = cw - 3.4 + k * 1.1, y0 = hl + 1.8 + k * 1.2
          rope([[50 + s * x0, y0], [50 + s * (cw + 0.9 + k * 0.6), 38 + k * 2], [50 + s * (cw + 1.6 + k), 52 + k * 3], [50 + s * (cw + 1.2 + k * 1.4), 62 + rnd() * 6]], 1.35 + rnd() * 0.3)
        }
      }
      return out()
    }
    case 'cornrows': {
      R.front = fill(capD(G, { t: 0.75, ts: 0.3, sq: true }), H.c)
      if (!lo) {
        let d = '', e = ''
        for (let x = -cw + 2.2; x <= cw - 2; x += 2.9) { const y0 = hl + 0.2 + Math.abs(x) * 0.18; d += `M${f(50 + x)} ${f(y0)}Q${f(50 + x * 0.98)} ${f(y0 - 4)} ${f(50 + x * 0.7)} ${f(C0 - 0.4 + Math.abs(x) * 0.3)}`; e += `M${f(50 + x + 1.3)} ${f(y0 - 0.4)}Q${f(50 + (x + 1.3) * 0.98)} ${f(y0 - 4)} ${f(50 + (x + 1.3) * 0.72)} ${f(C0 + Math.abs(x) * 0.3)}` }
        R.front += line(d, H.S, 0.6) + line(e, H.H, 0.4, ' stroke-dasharray=".9 .5"')
      }
      return R
    }
    case 'hightop': {
      const o = [[cw - 0.6, 30.4, 1], [cw + 0.1, 25], [cw - 0.5, C0 - 3.4], [cw - 2.6, C0 - 6], [cw * 0.4, C0 - 6.9], [0, C0 - 7]]
      const { inn } = capPts(G, { sb: 30.4, sq: true })
      const od = even(dense([...o.map(RX), ...o.slice(0, -1).reverse().map(LX)], 6), 0.75)
      R.front = sides(H.f2) + fill(capD(G, { t: 0.5, ts: 0.25, sb: 33.4, sq: true }), H.f1)
        + coilD(tufts(od, 0.45, [50, 20], rnd) + `L${dense([...inn.slice(1).reverse().map(LX), ...inn.map(RX)], 4).map(P2).join('L')}Z`, H.c)
      return R
    }
    case 'frohawk': {
      const s = [[0, hl - 0.2], [4.6, hl + 0.2, 1], [5.6, C0], [3.6, C0 - 4.6], [0, C0 - 5.6]]
      const od = even(dense([...s.slice(1).map(RX), ...s.slice(1, -1).reverse().map(LX)], 6), 1.3)
      R.front = sides(H.f2) + fill(capD(G, { t: 0.4, ts: 0.25, sb: 33, sq: true }), H.f1)
        + coilD(tufts(od, 0.85, [50, 26], rnd) + `L${f(50 - 4.6)} ${f(hl + 0.2)}L50 ${f(hl - 0.2)}Z`, H.c)
      return R
    }
    case 'flow': case 'mullet': case 'long': {
      // hair grown out: swept back off the face and down behind the ears (flow, to the jaw), short on top and long at
      // the back (mullet, to the collar), or long to the shoulders with a middle part (long)
      const kind = st, y1 = kind === 'flow' ? 56 : kind === 'mullet' ? 66 : 71
      R.back = fill(kind === 'flow' ? flowD(G, rnd) : mass(G, y1, kind === 'mullet' ? 1 : 1.4, rnd, kind === 'mullet' ? 52 : 46), mixC(H.c, H.S, 0.8))
      if (kind === 'long') R.mid = fill(panels(G, 76, 3.4, rnd), H.c)
      if (kind === 'mullet') R.front = sides(H.f1) + fill(capD(G, { t: 2.2, ts: 0.5, sb: 30.6, hl: hl + 0.2 }), H.c) + strands(9, 0.3) + sheen(2.2)
      else if (kind === 'flow') {
        R.front = fill(capD(G, { t: 3.1, ts: 0.5, sb: 33.4, hl: hl - 0.9 }), H.c) + strands(11, 0, hl - 1.2, C0 - 0.6)
        if (!lo) R.front += fill(sm([[39, hl - 1.4], [44, C0 + 0.4], [56, C0 - 0.6], [61, C0 + 1.6], [52, C0 + 2.2], [43.4, hl - 3.2]]), H.H)
          + line(`M${f(50 - cw + 2.6)} ${f(hl + 0.6)}Q${f(50 - cw + 0.6)} ${f(hl - 1)} ${f(50 - cw)} ${f(hl + 5)}M${f(50 + cw - 2.6)} ${f(hl + 0.6)}Q${f(50 + cw - 0.6)} ${f(hl - 1)} ${f(50 + cw)} ${f(hl + 5)}`, H.S, 0.5)
      } else {
        R.front = fill(capD(G, { t: 1.9, ts: 0.6, sb: 34.4, hl: hl - 0.3 }), H.c) + line(`M50 ${f(hl - 0.3)}V${f(C0 + 1)}`, H.S, 0.5)
        if (!lo) R.front += fill(sm([[47.4, hl - 1], [44, C0 + 2], [40, C0 + 5], [42.6, hl + 0.4]]), H.H)
          + line(`M${f(50 - cw - 0.6)} 48Q${f(50 - cw - 2.4)} 60 ${f(50 - cw - 2.2)} 72M${f(50 + cw + 0.8)} 48Q${f(50 + cw + 2.6)} 60 ${f(50 + cw + 2.6)} 72`, H.S, 0.5)
      }
      return R
    }
    case 'bun': {
      R.back = fill(ell(50, C0 - 2.4, 4.4, 3.3), H.c) + fill(sm([[45.8, C0 - 1.6], [50, C0 + 0.6], [54.2, C0 - 1.6], [53, C0 + 1.2], [47, C0 + 1.2]]), H.S)
      R.front = fill(capD(G, { t: 0.9, ts: 0.3 }), H.c)
        + (lo ? '' : line(`M42 ${f(hl + 0.4)}Q44 20 49 ${f(C0)}M46 ${f(hl - 0.2)}Q47.4 20 50.4 ${f(C0 - 0.2)}M54 ${f(hl - 0.2)}Q53 20 51.6 ${f(C0)}M58 ${f(hl + 0.6)}Q56.4 20 53 ${f(C0 + 0.2)}`, H.H, 0.4))
      return R
    }
    case 'receding': {
      if (coil) { R.front = fill(capD(G, { t: 0.9, ts: 0.3, rec: 1, hl: hl - 0.3, sq: true }, 0.28, rnd), mixC(H.c, T.B, 0.15)); return R }
      R.front = sides(H.f1, { rec: 1 }) + fill(capD(G, { t: 1.6, ts: 0.4, sb: 30.4, rec: 1.1, hl: hl - 0.5 }), H.c)
        + (lo ? '' : fill(sm([[44, hl - 0.6], [46, C0 + 0.4], [54, C0 - 0.2], [50, C0 + 2]]), H.H))
      return R
    }
    case 'balding': {
      let d = ''
      for (const s of [-1, 1]) d += poly([[cw + 0.35, 25.2], [cw + 0.5, 30], [hx(G, 37.6) + 0.3, 37.6], [hx(G, 37.6) - 1.05, 37.6], [G.tw - 1.3, 34.4], [cw - 1.4, 30.4], [cw - 0.7, 27.6]].map(p => [50 + s * p[0], p[1]]))
      R.front = fill(d, coil ? mixC(H.c, T.B, 0.2) : H.c)
      return R
    }
    default: return R
  }
}

// ── Facial hair ──────────────────────────────────────────────────────────────
// the beard's shapes: out how far it stands off the jaw · len below the chin · neck how far down the neck it runs ·
// cl how high the cheek line sits · k how much skin shows through
const BEARD = {
  stubble: { out: 0, len: 0, neck: 1.6, cl: 0.4, k: 0.64 },
  short: { out: 0.35, len: 0.7, neck: 2.4, cl: 0.3, k: 0.24 },
  full: { out: 1.2, len: 2.4, neck: 3.4, cl: 0.1, k: 0.18 },
  long: { out: 1.5, len: 6.4, neck: 3.4, cl: 0.15, k: 0.16 },
}
function beardOf(look, G, T, rnd, lo, bc) {
  const kind = look.beard
  if (!kind || kind === 'none') return { under: '', over: '' }
  const { cb, jw, jy, ch, cy, mw, my, lk } = G
  const ll = 1.25 * lk * G.M[1]
  const bb = k => mixC(bc, T.B, k)
  // the area around the mouth and chin (a goatee or a patch: no cheeks)
  if (kind === 'goatee' || kind === 'patch') {
    const pat = kind === 'patch'
    const right = pat ? [[0, my + ll + 0.4], [1.1, my + ll + 0.6], [0.7, my + ll + 2.6], [0, my + ll + 3.2]]
      : [[0, my + ll + 0.45], [mw * 0.55, my + ll * 0.75], [mw + 0.3, my + 0.2], [mw + 0.9, my + 1.8], [Math.max(ch, mw * 0.7) + 0.4, cy - 2], [ch * 0.6, cy + 0.2], [0, cy + 0.6]]
    const loop = [...right.map(RX), ...right.slice(1, -1).reverse().map(LX)]
    const d = poly(broken([...dense(loop, 4), RX(right[0])], 0.28, 0.9, rnd))
    return { under: '', over: fill(d, bb(pat ? 0.18 : 0.22)) + (lo || pat ? '' : fill(sm([[50 - ch - 0.6, cy - 1.6], [50 - ch * 0.2, cy - 2.2], [50 - 1, cy - 0.4], [50 - ch - 0.2, cy - 0.6]]), mixC(bb(0.14), T.H, 0.22))) }
  }
  // a chin strap: a band along the jaw from the sideburns round the chin
  if (kind === 'chin') {
    const o = dense([[hx(G, 37) + 0.1, 37], [cb + 0.15, 41.5], [hx(G, 47) + 0.2, 47], [jw + 0.6, jy - 1.4], [jw - 0.1, jy + 1], [jw - 2.6, jy + 4.4], [ch + 1.2, cy - 0.7], [0, cy + 0.6]], 4)
    const i = dense([[hx(G, 37) - 1.2, 37], [cb - 1.6, 42], [hx(G, 47) - 1.8, 47.4], [jw - 1.6, jy - 1], [jw - 2.4, jy + 1], [jw - 4, jy + 2.9], [ch, cy - 2.6], [0, cy - 1.6]], 4)
    const half = [...broken(o, 0.22, 0.9, rnd), ...broken(i.reverse(), 0.3, 0.9, rnd)]
    return { under: '', over: fill(poly(half.map(p => [p[0] + 50, p[1]])) + poly(half.map(p => [50 - p[0], p[1]])), bb(0.18)) }
  }
  const B = BEARD[kind] ?? BEARD.short
  const sb = 36.8, xs = hx(G, sb)
  // the right half: the sideburn, the face's edge out to the beard's volume, under the jaw onto the neck, then the
  // cheek line down to the mouth's corner and under the lower lip
  const edge = []
  for (const p of G.Rd) if (p[1] >= sb && p[1] <= jy + 0.4) { const u = clamp((p[1] - 41) / 9, 0, 1); edge.push([p[0] + B.out * u, p[1]]) }
  const neckL = [[jw + B.out * 0.9 - 0.3, jy + 1.2], [jw - 1.6 + B.out * 0.6, jy + 2.6 + B.neck * 0.4], [ch + 2.2 + B.out * 0.4, cy + B.neck * 0.55 + B.len * 0.6], [ch * 0.4, cy + B.neck * 0.62 + B.len], [0, cy + B.neck * 0.62 + B.len + 0.2]]
  const cheek = [[xs - 1.25, sb], [cb - 2.2 - B.cl * 2, 42.6 + B.cl * 1.5], [mw + 3.4, my - 3.6 + B.cl * 1.6], [mw + 1.1, my - 0.9]]
  const lip = [[mw + 0.5, my + 0.4], [mw * 0.55, my + ll + 0.2], [0, my + ll + 0.35]]
  const stub = kind === 'stubble'
  const rOut = [[xs + 0.05, sb], ...edge, ...dense(neckL, 4).slice(1)]
  const rOutB = broken(rOut, stub ? 0.26 : 0.34, lo ? 1.8 : 1.05, rnd, stub ? 0 : 0.08)
  const rIn = broken(dense([...cheek, ...lip], lo ? 2 : 4), stub ? 0.3 : 0.42, lo ? 1.7 : 0.92, rnd)
  const half = [...rOutB, ...rIn.slice().reverse()]
  // (the whole loop: the right half's outside down to the middle, the left's up, the left's inside down, the right's up)
  const L = p => [50 - p[0], p[1]], Rr = p => [50 + p[0], p[1]]
  const loop = [...rOutB.map(Rr), ...rOutB.slice().reverse().map(L), ...rIn.map(L), ...rIn.slice().reverse().map(Rr)]
  const d = poly(loop)
  if (stub) {
    // stubble: one flat tone where the beard grows, and on the upper lip
    const lipD = sm([[50 - mw - 0.4, my - 0.5], [50 - mw * 0.5, G.nb + 1.6], [50, G.nb + 1.3], [50 + mw * 0.5, G.nb + 1.6], [50 + mw + 0.4, my - 0.5], [50, my - 1.1]])
    // (the growth is thicker round the mouth and on the chin: a second, denser tone there, its edge broken too)
    const ring = poly(broken(dense([[50 - mw - 1.6, my - 1.2], [50 - mw - 2.2, my + 2.4], [50 - G.ch - 1, G.cy - 0.6], [50, G.cy + 0.8], [50 + G.ch + 1, G.cy - 0.6], [50 + mw + 2.2, my + 2.4], [50 + mw + 1.6, my - 1.2], [50 + mw * 0.4, my + 1.4], [50 - mw * 0.4, my + 1.4]], 4), 0.3, 0.8, rnd))
    return { under: fill(d + lipD, bb(B.k)) + (lo ? '' : fill(ring + lipD, bb(B.k - 0.16))), over: '' }
  }
  // (a light beard keeps its own colour: mixed toward the skin it went muddy)
  const base = bb(lum(bc) > 90 ? B.k * 0.4 : B.k)
  // the cheek line thins: a band of the lighter beard inside it; the far side and under the chin in shade; a light
  // on the near side of the chin
  const thin = poly([...rIn.map(Rr), ...rIn.slice().reverse().map(p => [50 + p[0] + 0.35, p[1] + 0.5])]) + poly([...rIn.map(L), ...rIn.slice().reverse().map(p => [50 - p[0] - 0.35, p[1] + 0.5])])
  const P = `b${(hashStr(d) % 46656).toString(36)}`
  const shade = sm([[50 + cb - 2.4, 42], [104, 42], [104, 92], [50 + ch, 92], [50 + ch + 0.6, cy + 0.4], [50 + jw - 3.4, jy + 1.6], [50 + cb - 3.8, 47.6]])
  const over = shape(P, d, base)
    + `<g clip-path="url(#${P}c)">${fill(shade, dark(base, 0.18))}${fill(sm([[50 - jw, jy + 1.4], [50 - ch - 1.4, cy - 0.2], [50, cy + 0.7], [50 + ch + 1.4, cy - 0.2], [50 + jw, jy + 1.4], [104, 92], [-4, 92]]), dark(base, 0.3))}`
    + (lo ? '' : fill(thin, mixC(base, T.B, 0.3)) + `<rect x="30" y="36" width="40" height="40" fill="${dotTex(mixC(base, T.B, 0.45), 1.1, 0.2, 0.55)}"/>`)
    + `</g>`
  return { under: '', over }
}
// the moustache: thin and short, above the lip, never down past it (owner 11-15)
function stacheOf(look, G, T, rnd, bc) {
  const k = look.stache
  if (!k || k === 'none') return ''
  const { mw, my, nb, lk } = G, ul = 0.95 * lk * G.M[0]
  const top = my - ul - 0.15, w = k === 'thin' ? mw * 0.78 : mw * 0.92
  const rise = k === 'thin' ? 0.85 : Math.min(1.7, top - nb - 0.7)
  const right = [[0, top - rise + 0.25], [1.2, top - rise], [w * 0.62, top - rise * 0.78], [w, top - 0.1], [w + 0.25, top + 0.55, 1], [w * 0.6, top + 0.15], [1.1, top + 0.05], [0, top + 0.22]]
  const half = broken(dense(right, 4), 0.16, 0.7, rnd)
  let d = poly([...half.map(p => [50 + p[0], p[1]]), ...half.slice().reverse().map(p => [50 - p[0], p[1]])])
  // a horseshoe: down either side of the mouth to the jaw
  if (k === 'horseshoe') for (const s of [-1, 1]) d += poly([[50 + s * (mw - 0.2), my - 0.9], [50 + s * (mw + 1.3), my - 1.2], [50 + s * (mw + 1.5), G.cy - 2], [50 + s * (mw + 0.3), G.cy - 2.2]])
  return fill(d, mixC(bc, T.B, k === 'thin' ? 0.3 : 0.16))
}

// ── The features ─────────────────────────────────────────────────────────────
function eyesOf(look, G, T, S, lo) {
  const K = EYE[look.eyes] ?? EYE.almond, iris = look.iris ?? '#2b1a10', X = G.X
  let wh = '', ir = '', pu = '', lash = '', lid = '', cl = ''
  for (const s of [-1, 1]) {
    const q = G.E.sq * G.ex(s)
    const yo = G.young ? 1.08 : 1, cx = 50 + s * G.es, y = G.ey, ew = 3.4 * G.ez, up = K[0] * G.ez * X.eo * yo * 1.05 * (1 - q * 0.1), dn = K[1] * G.ez * X.eo * yo * 1.05 * (1 - q * 0.45), tl = K[2]
    const I = [cx - s * ew, y + 0.2], O = [cx + s * ew, y - tl]
    const U1 = [cx - s * ew * 0.35, y - up * 1.34], U2 = [cx + s * ew * 0.45, y - up * 1.2 - tl * 0.5]
    const L1 = [cx + s * ew * 0.42, y + dn * 1.28], L2 = [cx - s * ew * 0.42, y + dn * 1.24]
    wh += `M${P2(I)}C${P2(U1)} ${P2(U2)} ${P2(O)}C${P2(L1)} ${P2(L2)} ${P2(I)}Z`
    const r = 1.36 * G.ez, ix = cx + s * 0.06, iy = y - 0.12
    ir += ell(ix, iy, r, r)
    pu += ell(ix, iy, r * 0.46, r * 0.46)
    cl += ell(ix - r * 0.38, iy - r * 0.36, r * 0.16, r * 0.16)
    // the upper lid's edge: a dark band along the top of the eye, thicker to the outer corner
    const top = [], bot = []
    for (let j = 0; j <= 8; j++) {
      const t = j / 8, u = 1 - t
      const p = [u * u * u * I[0] + 3 * u * u * t * U1[0] + 3 * u * t * t * U2[0] + t * t * t * O[0], u * u * u * I[1] + 3 * u * u * t * U1[1] + 3 * u * t * t * U2[1] + t * t * t * O[1]]
      top.push([p[0], p[1] - 0.2 - t * 0.12]); bot.push([p[0], p[1] + 0.12 + t * 0.4])
    }
    top.push([O[0] + s * 0.5, O[1] + 0.05, 1])
    lash += sm([...top, ...bot.reverse()])
    // the socket: a half tone from under the brow down to the lid's crease (the lid itself stays lit)
    const cr = up * 1.34 + 0.75 + (look.eyes === 'deep' ? 0.35 : 0)
    const crease = [[I[0] + s * 0.2, I[1] - up * 0.9], [cx - s * ew * 0.25, y - cr], [cx + s * ew * 0.45, y - cr + 0.1 + (look.eyes === 'hooded' ? 0.55 : 0)], [O[0] + s * 0.35, O[1] - 0.5 + (look.eyes === 'hooded' ? 0.35 : 0)]]
    const sock = [[50 + s * 1.5, G.by + 1.3], [cx - s * 1.2, G.by + 0.9], [cx + s * (ew + 0.2), G.by + 1.35], [O[0] + s * 1.3, O[1] - 0.4], ...crease.slice().reverse(), [50 + s * 1.7, y + 0.2]]
    S[s > 0 ? 'S' : 'M'] += sm(sock)
    if (s > 0) S.M += sm([[50 + s * 1.4, G.by + 0.9], [cx + s * (ew + 1), G.by + 0.9], [O[0] + s * 2, O[1] + 0.6], [O[0] + s * 1, O[1] + 0.4], [cx, G.by + 1.6]])
    if (!lo) {
      // the crease's own shadow, and under the eye the lower lid turning into the cheek
      lid += sm([crease[0], crease[1], crease[2], crease[3], [crease[2][0], crease[2][1] + 0.38], [crease[1][0], crease[1][1] + 0.34]])
      // (a young man's lower lid is a fine line, not a bag; a coach's has its years)
      // (a smile's cheek pushing up under the eye: a soft fold below the lower lid)
      if (q > 0.25) S.M += sm([[L2[0], y + dn * 1.2 + 0.75], [L1[0], y + dn * 1.2 + 0.65], [O[0] - s * 0.1, O[1] + 1], [L1[0], y + dn * 1.2 + 1.15 + q * 0.4], [L2[0], y + dn * 1.2 + 1.2 + q * 0.4]])
      if (look.co) S.M += sm([[I[0] + s * 0.4, I[1] + 0.45], [L2[0], y + dn * 1.05 + 0.85], [L1[0], y + dn * 1.05 + 0.75], [O[0] - s * 0.2, O[1] + 0.6], [L1[0], y + dn * 1.05 + 0.25], [L2[0], y + dn * 1.05 + 0.3]])
      lid += sm([[L2[0], y + dn * 1.18 + 0.12], [L1[0], y + dn * 1.22 + 0.1], [O[0] - s * 0.3, O[1] + 0.32], [L1[0], y + dn * 1.22 + 0.32]])
    }
  }
  const light = lum(iris) > 60
  return {
    wh, P: { ir, pu, cl, lash, lid, light, iris },
  }
}
function browsOf(look, G, T, lo) {
  const c = mixC(look.brow ?? look.hc, T.B, lum(look.brow ?? look.hc) > 120 ? 0.35 : 0.1)
  const th = 1.2 * ({ thick: 1.3, thin: 0.75, bushy: 1.5, straight: 1.0, arched: 0.95, angled: 1.05 }[look.brows] ?? 1)
  const arch = { arched: 1.0, angled: 0.8, straight: 0.2, thick: 0.35, thin: 0.6, bushy: 0.3 }[look.brows] ?? 0.4
  let d = '', h = ''
  for (const s of [-1, 1]) {
    const x = k => 50 + s * k, b = G.by, es = G.es, ew = 3.4 * G.ez
    const ang = look.brows === 'angled'
    const top = [[x(1.85), b + 0.15, 1], [x(es - 2.4), b - 0.5 - arch * 0.3], [x(es + (ang ? 1.4 : 0.4)), b - 0.75 - arch * 0.65], [x(es + ew + 1.5), b + 0.1 - arch * 0.2], [x(es + ew + 1.9), b + 0.55, 1]]
    const bot = [[x(es + ew + 0.8), b + 0.55], [x(es + 0.6), b + 0.32 * th - arch * 0.45], [x(es - 2.4), b + 0.75 * th - arch * 0.2], [x(1.9), b + 1.35 * th, 1]]
    const t2 = top.map((p, i) => [p[0], p[1] - (i === 1 ? 0.35 : i === 2 ? 0.15 : 0) * th, p[2]])
    d += sm([...t2, ...bot])
    // the hairs: short strokes up and out from the head of the brow, flatter along the tail, breaking its edges
    if (!lo) for (let i = 0; i < 7; i++) {
      const u = i / 6, px = 1.9 + u * (es + ew - 0.2), py = b + (1.1 - u * 0.9) * th * 0.7 - Math.sin(u * Math.PI) * (0.55 + arch * 0.5)
      const ang = 1.15 - u * 0.95, l = (0.9 - u * 0.35) * th
      h += `M${f(x(px))} ${f(py)}l${f(s * Math.cos(ang) * l)} ${f(-Math.sin(ang) * l)}`
    }
  }
  return fill(d, c) + (h ? line(h, c, 0.26, ' stroke-linecap="round"') : '')
}
function noseOf(look, G, T, S, lo) {
  const { nb, nwid: w, by, ey, br } = G
  // the bridge's far side in shadow (a high bridge casts more of it), the far wing, the underside's shadow on the lip
  S.S += sm([[51.1, by + 1.4], [51.2 + br * 0.5, ey + 1.6], [50 + w * 0.42, nb - 3.4], [50 + w * 0.85, nb - 2.0], [50 + w * 0.38, nb - 2.7], [50.4 + br * 0.15, ey + 2.2], [50.4, by + 2]])
  S.S += sm([[50 + w * 0.5, nb - 2.5], [50 + w * 1.02, nb - 1.4], [50 + w * 0.92, nb + 0.25], [50 + w * 0.55, nb + 0.35], [50 + w * 0.72, nb - 0.9]])
  S.M += sm([[50 - w * 0.5, nb - 2.5], [50 - w * 0.98, nb - 1.4], [50 - w * 0.86, nb + 0.2], [50 - w * 0.64, nb - 0.7]])
  S.S += sm([[50 - w * 0.78, nb - 0.2], [50 - w * 0.32, nb - 0.5], [50, nb - 0.15], [50 + w * 0.34, nb - 0.5], [50 + w * 0.86, nb - 0.1], [50 + w * 0.4, nb + 1.15], [50 - w * 0.1, nb + 1.3], [50 - w * 0.5, nb + 0.7]])
  if (!lo) {
    S.H += sm([[49.3, by + 2.6], [49.85, by + 2.4], [49.75, nb - 3.6], [49.25, nb - 3.4]])
    S.H += ell(49.4, nb - 1.85, 0.85 * w / 3.4, 0.6)
  }
  // the nostrils
  let d = ''
  for (const s of [-1, 1]) { const x = 50 + s * w * 0.43; d += sm([[x - s * 0.7, nb - 0.25], [x + s * 0.05, nb - 0.6], [x + s * 0.75, nb - 0.15], [x, nb + 0.05]]) }
  return fill(d, T.D)
}
function mouthOf(look, G, T, S, lo) {
  const { mw: mw0, my, lk, M, E } = G
  const mw = mw0 * E.cw
  // (a smile stretches the lips thinner, the corners up; a half smile lifts one corner)
  const ul = 1.05 * lk * M[0] * (1 - E.ck * 0.2), ll = 1.38 * lk * M[1] * (1 - E.ck * 0.12), up = M[3], smirk = M[4], op = E.op
  const cuL = E.cu * G.ex(-1), cuR = E.cu * G.ex(1)
  const Lc = [50 - mw, my + 0.1 - up - cuL], Rc = [50 + mw, my + 0.1 - up - cuR - smirk]
  const dip = (cuL + cuR) * 0.12
  const mid = [[50 - mw * 0.5, my + 0.18 - cuL * 0.35 + dip], [50, my + 0.28 + dip], [50 + mw * 0.5, my + 0.18 - smirk * 0.3 - cuR * 0.35 + dip]]
  // an open smile: the lower lip drops away from the top teeth, deepest in the middle
  const midB = op ? [[50 - mw * 0.52, mid[0][1] + op * 0.72], [50, mid[1][1] + op], [50 + mw * 0.52, mid[2][1] + op * 0.72]] : mid
  const upper = sm([[...Lc, 1], [50 - mw * 0.55, my - ul * 0.78 - cuL * 0.3], [50 - 1.05, my - ul], [50, my - ul + 0.32], [50 + 1.05, my - ul], [50 + mw * 0.55, my - ul * 0.78 - smirk * 0.2 - cuR * 0.3], [...Rc, 1], ...mid.slice().reverse()])
  const lower = sm([[...Lc, 1], ...midB, [...Rc, 1], [50 + mw * 0.55, midB[2][1] + ll * 0.88], [50, midB[1][1] + ll * 0.95], [50 - mw * 0.55, midB[0][1] + ll * 0.88]])
  const ln = sm([[Lc[0] - 0.3, Lc[1] - 0.05, 1], ...mid.map(p => [p[0], p[1] - 0.14]), [Rc[0] + 0.3, Rc[1] - 0.05, 1], ...mid.slice().reverse().map(p => [p[0], p[1] + 0.26])])
  const yl = midB[1][1]
  // under the lower lip, in shadow; the chin's light
  S.S += sm([[50 - mw * 0.55, yl + ll + 0.25], [50, yl + ll + 1.35], [50 + mw * 0.6, yl + ll + 0.3], [50 + mw * 0.2, yl + ll + 0.6], [50 - mw * 0.2, yl + ll + 0.6]])
  // the cheeks lifting: the folds from the nose's wings down past the corners, the apples of the cheeks catching the
  // light with a soft shade under them
  for (const sd of [-1, 1]) {
    const k = E.ck * G.ex(sd), c = sd < 0 ? Lc : Rc, w = G.nwid
    if (k < 0.12) continue
    S[k > 0.8 ? 'S' : 'M'] += sm([[50 + sd * (w + 0.5), G.nb - 1.5], [50 + sd * (w + 1.6 + k * 0.6), G.nb + 0.4], [c[0] + sd * (1.2 + k * 0.5), c[1] + 0.3], [c[0] + sd * (0.9 + k * 0.6), c[1] + 1.6 + k * 0.6], [c[0] + sd * (0.7 + k * 0.4), c[1] + 0.4], [50 + sd * (w + 1.1 + k * 0.4), G.nb + 0.2], [50 + sd * (w + 0.2), G.nb - 0.9]])
    if (!lo && k > 0.3) {
      const ax = 50 + sd * (G.es + 0.8), ay = G.ey + 5.6 - k * 0.9
      S.H += sm([[ax - sd * 0.4 - 1.9, ay], [ax - 0.4, ay - 0.75 - k * 0.2], [ax - sd * 0.4 + 1.7, ay - 0.1], [ax - 0.4, ay - 0.35]])
    }
  }
  // the philtrum's groove down to the lip's bow, its far ridge in shade; the corners tucked into shadow
  if (!lo) {
    S.M += sm([[49.5, G.nb + 1.3], [50.5, G.nb + 1.3], [50.55, my - ul + 0.2], [49.45, my - ul + 0.2]])
    S.S += sm([[50.6, G.nb + 1.4], [51.1, G.nb + 1.3], [51.2, my - ul - 0.1], [50.8, my - ul + 0.2]])
    for (const c of [Lc, Rc]) S.S += ell(c[0] + (c === Lc ? -0.3 : 0.3), c[1] + 0.1, 0.55, 0.75)
  }
  let s = ''
  if (op) {
    // the opening: dark; the top teeth one flat off-white shape (never single teeth), a soft shadow under the lip
    const hole = sm([[...Lc, 1], ...mid, [...Rc, 1], ...midB.slice().reverse()])
    const tw = mw * 0.8, tb = op * 0.6
    const teeth = sm([[mid[0][0] - mw * 0.18, mid[0][1] - 0.1], [50, mid[1][1] - 0.2], [mid[2][0] + mw * 0.18, mid[2][1] - 0.1], [50 + tw * 0.8, mid[2][1] + tb * 0.7], [50, mid[1][1] + tb], [50 - tw * 0.8, mid[0][1] + tb * 0.7]])
    const tc = mixC('#e8e0d3', T.B, 0.16 + T.d * 0.08)
    s += fill(hole, mixC(T.D, T.lipU, 0.35)) + fill(teeth, tc)
      + fill(sm([[mid[0][0], mid[0][1] - 0.05], [50, mid[1][1] - 0.1], [mid[2][0], mid[2][1] - 0.05], [50 + tw * 0.5, mid[2][1] + 0.55], [50, mid[1][1] + 0.6], [50 - tw * 0.5, mid[0][1] + 0.55]]), mixC(tc, T.D, 0.3))
  }
  s += fill(upper, T.lipU) + fill(lower, T.lipL)
  // the lower lip's under-plane a shade deeper
  if (!lo) s += fill(sm([[50 - mw * 0.7, yl + ll * 0.62], [50, yl + ll * 0.84], [50 + mw * 0.7, yl + ll * 0.62], [50 + mw * 0.55, yl + ll * 0.88], [50, yl + ll], [50 - mw * 0.55, yl + ll * 0.88]]), mixC(T.lipL, T.lipU, 0.45))
  if (!lo) s += fill(sm([[50 - mw * 0.5, yl + ll * 0.45], [50 - mw * 0.1, yl + ll * 0.32], [50 + mw * 0.05, yl + ll * 0.5], [50 - mw * 0.4, yl + ll * 0.62]]), mixC(T.lipL, '#ffffff', 0.1))
  return s + (op ? '' : fill(ln, T.D))
}
// the years: smile lines, the lids, the forehead, then the jowls
function linesOf(look, G, T, S, lo) {
  // (players are 21 to 30: no lines at all, owner 11-16; only a coach's face shows his years)
  if (!look.co) return
  const ag = look.ag ?? 24, { nb, nwid: w, mw, my, ey, es } = G
  if (ag >= 28 || G.X === STRUCT.p) S.M += sm([[50 + w + 0.4, nb - 1.6], [50 + mw + 1.9, my - 0.4], [50 + mw + 1.2, my + 1.4], [50 + mw + 1.2, my - 0.3], [50 + w + 0.1, nb - 0.8]])
  if (ag < 38 || lo) return
  const k = ag >= 54 ? 1 : 0.6
  S.M += sm([[50 - w - 0.4, nb - 1.6], [50 - mw - 1.8, my - 0.4], [50 - mw - 1.1, my + 1.3], [50 - mw - 1.15, my - 0.3], [50 - w - 0.1, nb - 0.8]])
  for (let i = 0; i < (ag >= 54 ? 3 : 2); i++) { const y = G.by - 4.6 - i * 1.9; S.M += sm([[42 + i, y + 0.4], [50, y - 0.1 * k], [58 - i, y + 0.4], [50, y + 0.35 * k]]) }
  for (const s of [-1, 1]) {
    const x = 50 + s * (es + 3.6)
    S.M += sm([[x, ey - 0.4], [x + s * 1.6, ey - 0.8], [x + s * 0.2, ey + 0.05]]) + sm([[x, ey + 0.5], [x + s * 1.5, ey + 1.2], [x + s * 0.1, ey + 0.9]])
    S.M += sm([[50 + s * (es - 2.4), ey + 2.2], [50 + s * es, ey + 3.3 * k + 0.4], [50 + s * (es + 2.6), ey + 1.9], [50 + s * es, ey + 2.8]])
  }
  if (ag >= 54) S.M += sm([[50 + mw + 1.4, my + 2.2], [50 + G.ch + 2.8, G.cy - 1.4], [50 + G.ch + 2, G.cy - 1], [50 + mw + 0.9, my + 2.4]])
}

// ── Gear ─────────────────────────────────────────────────────────────────────
function eyeBlackOf(look, G) {
  if (!look.eb || look.eb === 'none') return ''
  let d = ''
  for (const s of [-1, 1]) {
    const x = 50 + s * (G.es + 0.3), y = G.ey + 3.1
    d += look.eb === 'paint' ? sm([[x - 2.7, y], [x, y - 0.35], [x + 2.7, y], [x + 2.3, y + 1.6], [x, y + 1.95], [x - 2.3, y + 1.6]]) : poly([[x - 2.8, y - 0.1], [x + 2.8, y - 0.1], [x + 2.8, y + 1.7], [x - 2.8, y + 1.7]])
  }
  return fill(d, '#131417')
}
function headGearOf(look, G, color) {
  const { cw, hl } = G
  if (look.gear === 'headband') {
    const y0 = hl - 0.6, d = sm([[50 - cw - 0.5, y0 + 3.4, 1], [50, y0 - 0.4], [50 + cw + 0.5, y0 + 3.4, 1], [50 + cw + 0.4, y0 + 6.4, 1], [50, y0 + 3], [50 - cw - 0.4, y0 + 6.4, 1]])
    return fill(d, '#eef0f3') + fill(sm([[50 + cw * 0.45, y0 + 0.3], [50 + cw + 0.5, y0 + 3.4, 1], [50 + cw + 0.4, y0 + 6.4, 1], [50 + cw * 0.45, y0 + 3.6]]), '#c3c8d0')
      + line(`M${f(50 - cw)} ${f(y0 + 4.8)}Q50 ${f(y0 + 0.6)} ${f(50 + cw)} ${f(y0 + 4.8)}`, color, 0.9)
  }
  if (look.gear === 'durag') {
    const c = '#1c1d23', y = hl - 0.4
    return fill(capD(G, { t: 0.55, ts: 0.3, hl: y, sb: 33.6 }), c)
      + fill(sm([[50 - cw + 1.4, y + 3.2], [50, y - 1.2], [50 + cw - 1.4, y + 3.2], [50 + cw - 1.7, y + 1.5], [50, y - 3], [50 - cw + 1.7, y + 1.5]]), mixC(c, '#ffffff', 0.08))
      + fill(sm([[50 - cw * 0.78, C0 + 6], [50 - cw * 0.45, C0 + 1.6], [50 - cw * 0.08, C0 + 0.4], [50 - cw * 0.12, C0 + 1.8], [50 - cw * 0.5, C0 + 3.2], [50 - cw * 0.72, C0 + 7.4]]), mixC(c, '#cfd4e0', 0.2))
      + line(`M50 ${f(y - 2.8)}Q49.8 ${f(C0 + 3)} 50 ${f(C0 - 0.5)}`, '#08080a', 0.5) + line(`M50.5 ${f(y - 2.8)}Q50.3 ${f(C0 + 3)} 50.5 ${f(C0 - 0.4)}`, mixC(c, '#ffffff', 0.18), 0.25)
  }
  if (look.gear === 'visor') return visorOf(G, color)
  return ''
}
// his team's logo (a coach's cap and chest; mark: { id, src, w, h, o }: a small png as a data URI, its size, and an
// outline colour when it would vanish on the cloth) centred at x, y in a box mw x mh; sy squashes it a little where the
// cloth leans back (a cap's crown). Never a letter (owner 11-16): no logo, nothing.
function logoOf(mark, x, y, mw, mh, sy = 1) {
  if (!mark?.src) return ''
  const k = Math.min(mw / mark.w, mh / mark.h), w = mark.w * k, h = mark.h * k
  let flt = ''
  if (mark.o) {
    const id = `${TX.P}O`, r = TX.lo ? 0.55 : 0.4
    TX.defs.lo = `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="${r}" result="d"/><feFlood flood-color="${mark.o}"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    flt = ` filter="url(#${id})"`
  }
  const img = `<image href="${mark.src}" x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}"${flt}/>`
  return `<g transform="translate(${f(x)} ${f(y)})${sy !== 1 ? ` scale(1 ${sy})` : ''}">${img}</g>`
}
// a sideline visor (owner 11-17: "visors look too white and weird"): a deep band in the team's colour round the top
// of his forehead (its ends wrap out of sight at the temples), and a pre-curved bill seen from just above, a little
// wider than his head, its corners dropping, its front edge at his brow line; the bill's top in the team's colour with
// its far half in shade, the underside a dark edge, a soft shadow on the brow; his hair shows over the open top
function visorOf(G, color) {
  const yb = G.by - 9.4, w0 = hx(G, yb) + 0.4, w1 = hx(G, yb + 3.4) + 0.5, bot = G.by - 0.6
  const band = sm([[50 - w0, yb + 0.9, 1], [50 - w0 * 0.55, yb - 0.1], [50, yb - 0.4], [50 + w0 * 0.55, yb - 0.1], [50 + w0, yb + 0.9, 1], [50 + w1, yb + 4, 1], [50 + w1 * 0.55, yb + 3.2], [50, yb + 3], [50 - w1 * 0.55, yb + 3.2], [50 - w1, yb + 4, 1]])
  const bl = 50 - w1 - 1.8, br = 50 + w1 + 1.8
  const bill = sm([[bl, yb + 4.6, 1], [50 - w1 * 0.5, yb + 3.2], [50, yb + 3], [50 + w1 * 0.5, yb + 3.2], [br, yb + 4.6, 1], [br - 0.8, yb + 6.2], [50 + w1 * 0.55, bot - 0.9], [50, bot], [50 - w1 * 0.55, bot - 0.9], [bl + 0.8, yb + 6.2]])
  const edge = sm([[bl + 0.8, yb + 6.2], [50 - w1 * 0.55, bot - 0.9], [50, bot], [50 + w1 * 0.55, bot - 0.9], [br - 0.8, yb + 6.2], [br - 1.2, yb + 7], [50 + w1 * 0.55, bot - 0.2], [50, bot + 0.7], [50 - w1 * 0.55, bot - 0.2], [bl + 1.2, yb + 7]])
  return fill(sm([[bl + 2.4, bot - 0.2], [50, bot + 1.4], [br - 2.4, bot - 0.2], [50, bot + 2.6]]), '#000000', ' fill-opacity=".18"')
    + fill(band, color) + fill(sm([[50 + w0 * 0.4, yb - 0.1], [50 + w0, yb + 0.9, 1], [50 + w1, yb + 4, 1], [50 + w1 * 0.4, yb + 3.1]]), dark(color, 0.25))
    + line(`M${f(50 - w1 + 0.4)} ${f(yb + 3.6)}Q50 ${f(yb + 2.4)} ${f(50 + w1 - 0.4)} ${f(yb + 3.6)}`, dark(color, 0.35), 0.4)
    + fill(bill, dark(color, 0.04)) + fill(sm([[50 + w1 * 0.25, yb + 3.1], [br, yb + 4.6, 1], [br - 0.8, yb + 6.2], [50 + w1 * 0.4, bot - 0.5]]), dark(color, 0.24))
    + fill(sm([[bl + 1.6, yb + 4.6], [50 - w1 * 0.4, yb + 3.7], [50 - w1 * 0.1, yb + 3.8], [50 - w1 * 0.45, yb + 4.8]]), light(color, 0.08))
    + fill(edge, dark(color, 0.6))
}
function earringsOf(look, G) {
  if (!look.ear || look.ear === 'none') return ''
  const one = s => fill(ell(50 + s * (G.tw + 0.25), 46.5, 0.6, 0.6), '#e9eef6') + fill(ell(50 + s * (G.tw + 0.1), 46.3, 0.22, 0.22), '#ffffff')
  return look.ear === 'stud' ? one(-1) : one(-1) + one(1)
}
function chainOf(look, G, lo) {
  if (!look.chain || look.chain === 'none') return ''
  const c = look.chain === 'gold' ? ['#7d5c14', '#d9b24a', '#fff0b0'] : ['#5f646d', '#c9ced6', '#ffffff']
  // (from under the collar's band on each side, where the V is at 66.6, down to 72.6 in the middle)
  const nw = G.nw, x = nw * 0.9 - 1.9, d = `M${f(50 - x)} 66.6Q${f(50 - x * 0.4)} 72.4 50 72.2Q${f(50 + x * 0.4)} 72.4 ${f(50 + x)} 66.6`
  return line(d, '#000000', 1.2, ' stroke-opacity=".28" transform="translate(.3 .55)"') + line(d, c[0], 0.85)
    + (lo ? '' : line(d, c[1], 0.62, ' stroke-dasharray=".5 .3"') + line(`M${f(50 - x + 0.4)} 67.4Q${f(50 - x * 0.5)} 72.2 ${f(50 - 1.2)} 72.4`, c[2], 0.22, ' stroke-opacity=".8" stroke-dasharray=".4 .5"'))
}
function glassesOf(look, G) {
  if (!look.specs) return ''
  const { es, ey, tw } = G, fr = look.specs === 2 ? '#5e4430' : '#18191d', w = 4.3, h = 3.1
  let d = '', g = ''
  for (const s of [-1, 1]) {
    const x = 50 + s * es
    d += `M${f(x - w)} ${f(ey - h + 0.4)}H${f(x + w)}V${f(ey + h - 0.8)}Q${f(x + w)} ${f(ey + h)} ${f(x + w - 1.6)} ${f(ey + h)}H${f(x - w + 1.6)}Q${f(x - w)} ${f(ey + h)} ${f(x - w)} ${f(ey + h - 0.8)}Z`
    g += poly([[x - w + 1.2, ey + h - 1], [x - w + 3.6, ey - h + 1], [x - w + 4.6, ey - h + 1], [x - w + 2.2, ey + h - 1]])
  }
  return fill(g, '#ffffff', ' fill-opacity=".14"') + line(d, fr, 0.75)
    + line(`M${f(50 - es + w)} ${f(ey - 1.6)}Q50 ${f(ey - 2.6)} ${f(50 + es - w)} ${f(ey - 1.6)}M${f(50 - es - w)} ${f(ey - 2.2)}L${f(50 - tw + 0.2)} ${f(ey - 2.4)}M${f(50 + es + w)} ${f(ey - 2.2)}L${f(50 + tw - 0.2)} ${f(ey - 2.4)}`, fr, 0.75)
}
// a ball cap in the team's colour: a structured crown (its far panel in shade, the seams), his team's logo across the
// front panels (owner 11-16: "put the logo not a letter"), leaning back with the crown, a curved brim seen from just
// above, its shadow on the brow
function capOf(look, G, color, mark) {
  if (!look.cap) return ''
  if (look.cap === 'visor') return visorOf(G, color)
  // (owner 11-17: "hats look deformed": a structured six-panel crown standing up off his head, its front panels upright
  // round the logo, the seams and the button; a pre-curved brim a little wider than his head, its corners dropping, its
  // front edge just above his brows; its underside a dark edge, its shadow on his brow)
  const { cw } = G, L = 50 - cw - 1, R = 50 + cw + 1, y = Math.min(G.hl + 2.4, G.by - 6.4), top = C0 - 3.8, bot = y + 4.4
  const crown = sm([[L, y + 0.6, 1], [L - 0.3, y - 4.2], [50 - cw * 0.72, top + 1.6], [50 - cw * 0.3, top + 0.2], [50, top], [50 + cw * 0.3, top + 0.2], [50 + cw * 0.72, top + 1.6], [R + 0.3, y - 4.2], [R, y + 0.6, 1], [50, y - 0.5]])
  const bl = L - 1.2, br = R + 1.2
  const brim = sm([[bl, y + 0.9, 1], [50 - cw * 0.5, y - 0.4], [50, y - 0.6], [50 + cw * 0.5, y - 0.4], [br, y + 0.9, 1], [br - 0.8, y + 2.4], [50 + cw * 0.55, bot - 0.8], [50, bot], [50 - cw * 0.55, bot - 0.8], [bl + 0.8, y + 2.4]])
  const edge = sm([[bl + 0.8, y + 2.4], [50 - cw * 0.55, bot - 0.8], [50, bot], [50 + cw * 0.55, bot - 0.8], [br - 0.8, y + 2.4], [br - 1.2, y + 3.2], [50 + cw * 0.55, bot - 0.1], [50, bot + 0.7], [50 - cw * 0.55, bot - 0.1], [bl + 1.2, y + 3.2]])
  const farD = sm([[50 + cw * 0.3, top + 0.2], [50 + cw * 0.72, top + 1.6], [R + 0.3, y - 4.2], [R, y + 0.6, 1], [50 + cw * 0.5, y - 0.3]])
  return fill(sm([[bl + 2.4, bot - 0.2], [50, bot + 1.6], [br - 2.4, bot - 0.2], [50, bot + 2.8]]), '#000000', ' fill-opacity=".2"')
    + fill(crown, color) + fill(farD, dark(color, 0.24))
    + fill(sm([[50 - cw * 0.72, top + 2.4], [50 - cw * 0.34, top + 0.8], [50 - cw * 0.42, top + 3.4], [L + 1.6, y - 2]]), light(color, 0.12))
    + line(`M50 ${f(top + 0.3)}V${f(y - 0.6)}M${f(50 - cw * 0.55)} ${f(top + 1.2)}Q${f(50 - cw * 0.6)} ${f(y - 4)} ${f(50 - cw * 0.66)} ${f(y - 0.3)}M${f(50 + cw * 0.55)} ${f(top + 1.2)}Q${f(50 + cw * 0.6)} ${f(y - 4)} ${f(50 + cw * 0.66)} ${f(y - 0.3)}`, dark(color, 0.32), 0.3)
    + fill(ell(50, top + 0.2, 1, 0.55), dark(color, 0.2))
    + logoOf(mark, 50, (top + y) / 2 + 0.8, cw * 0.95, Math.min(10, y - top - 3.4), 0.94)
    + (mark?.src ? fill(farD, '#000000', ' fill-opacity=".14"') : '')
    + fill(brim, dark(color, 0.1)) + fill(sm([[50 + cw * 0.3, y - 0.5], [br, y + 0.9, 1], [br - 0.8, y + 2.4], [50 + cw * 0.4, bot - 0.5]]), dark(color, 0.26))
    + fill(edge, dark(color, 0.6))
}

// ── The bust ─────────────────────────────────────────────────────────────────
// the neck and the shoulders under the shirt: a football player's thick neck sloping into big shoulders
function neckLoop(G, bare) {
  const { nw } = G
  // (under the shirt it stops short of the shoulder line: its corner at the shoulder is a corner, so the curve can't
  // swing up over the shirt's edge and show a sliver of skin on top of the shoulder, owner 11-17)
  if (!bare) return sym([[0, 44], [nw * 0.9, 44], [nw * 0.94, 52], [nw, 58.6], [nw + 0.8, 62.6], [nw + 4.2, 67], [nw + 8, 70, 1], [nw + 8, 104, 1], [0, 104]])
  return sym([[0, 44], [nw * 0.9, 44], [nw * 0.94, 52], [nw, 58.6], [nw + 0.8, 62.6], [nw + 4.4, 66.2], [nw + 10.4, 68.2], [nw + 17.4, 71.2], [nw + 24, 75.8], [nw + 29.6, 82.6], [56, 94], [56, 104], [0, 104]])
}
// the shirt: neck the neckline's right half from its bottom up to the side of the neck; the shoulders slope off the
// collar over the pads the way ESPN's headshots show them (owner 11-16: "shoulders too broad"), reaching the frame's
// edges only near its bottom
const SHOULDER = [[3.6, 64.6], [10, 66.6], [17, 69.6], [23.6, 74.2], [29.4, 80.6], [34.4, 88.4], [39, 97], [41, 104]]
function shirtLoop(G, neck) {
  const { nw } = G
  return sym([...neck, ...SHOULDER.map(p => [nw + p[0], p[1]]), [0, 104]])
}
// the seam where the shoulder panel meets the chest, collar to sleeve (right side; mirrored)
const seamPts = nw => [[nw + 1, 66.8], [nw + 7.6, 70.8], [nw + 14.6, 74.8], [nw + 20.6, 80.4], [nw + 24.6, 92]]
// cloth: its colour, the far side in shade, the folds, the mesh, the rim of light on the shoulders
function clothOf(G, loop, c, P, lo, rim = true) {
  const { nw } = G, d = sm(loop)
  return shape(`${P}J`, d, c)
    + `<g clip-path="url(#${P}Jc)">${fill(sm([[50 + nw + 19, 58], [104, 58], [104, 104], [50 + nw + 21, 104, 1], [50 + nw + 18.4, 88], [50 + nw + 17.6, 76], [50 + nw + 18.2, 66]]), dark(c, 0.2))}`
    + (lo ? '' : fill(sm([[50 - nw - 3, 74], [50 - nw - 9, 84], [50 - nw - 12, 104], [50 - nw - 9.6, 104], [50 - nw - 7, 86]]) + sm([[50 + nw + 3, 74], [50 + nw + 8, 85], [50 + nw + 10, 104], [50 + nw + 12.4, 104], [50 + nw + 10, 84]]), dark(c, 0.1))
      + `<rect x="-5" y="55" width="110" height="55" fill="${dotTex('#000000', 1.3, 0.24, 0.16)}"/>`)
    + (rim ? line(sm(loop.slice(3, 9), false), light(c, 0.14), 1.6) + line(sm(loop.slice(-8, -2), false), light(c, 0.24), 2) : '')
    + `</g>`
}
// a football jersey in its team's kit (kits.js): the V-neck's band in the trim with the dark inner neckline showing,
// the shoulder seams, and the team's trim pattern (sleeve stripes at the shoulder caps, a stripe pair over the
// shoulder, a contrast yoke, a double-striped collar); crew: a crew neck in the same colours
function jerseyOf(G, K, P, lo, crew = false) {
  const { nw } = G
  const c1 = K.c1, c2 = K.c2, c3 = K.c3 ?? (lum(c1) > 190 ? '#1d2230' : '#ffffff'), pat = K.pat
  // the neckline (ESPN's collars): it rises round the back of the neck at the sides, then runs down the front in a
  // shallow-to-medium V whose sides bow out a little; the band follows it at an even width
  const vb = crew ? 70.6 : 74.4, y0 = 62.6
  const half = crew ? [[nw - 0.3, y0, 1], [nw - 0.6, 66], [nw * 0.6, vb - 0.5], [0, vb]] : [[nw - 0.3, y0, 1], [nw - 1.5, 65.4], [nw * 0.52, 70.2], [nw * 0.2, 73.2], [0, vb, 1]]
  const neck = half.slice().reverse()
  const v = sm([...half.map(LX), ...half.slice(0, -1).reverse().map(RX)], false)
  const seam = seamPts(nw), sh = (o, k = 0.8) => SHOULDER.slice(0, 5).map((p, i) => [nw + p[0] - 0.4, p[1] + o * (i ? 1 : k)]), seamD = sm(seam.map(RX), false) + sm(seam.map(LX), false)
  let g = ''
  // a contrast yoke: the shoulders above the seam in the trim
  if (pat === 'yoke') g += fill(sm([...seam.map(RX), [104, 90], [104, 56], [-4, 56], [-4, 90], ...seam.slice().reverse().map(LX)].map((p, i) => (i === seam.length - 1 || i === seam.length + 4 ? [...p.slice(0, 2), 1] : p))), c2)
  // the seams
  if (!lo) g += line(seamD, pat === 'yoke' ? dark(c2, 0.3) : dark(c1, 0.28), 0.35)
  // a stripe pair over the shoulders, collar to sleeve
  if (pat === 'shoulder') for (const [o, c, w] of [[2.4, c2, 1.6], [4.3, c3, 0.8]]) g += line(sm(sh(o).map(RX), false) + sm(sh(o).map(LX), false), c, w)
  // sleeve stripes round the shoulder caps at the frame's edges
  if (pat === 'stripes2' || pat === 'stripes3') {
    const set = pat === 'stripes2' ? [[0, c2, 1.7], [2.8, c2, 1.7]] : [[0, c2, 1.5], [1.7, c3, 1.1], [3.4, c2, 1.5]]
    for (const [o, c, w] of set) {
      const R = [[nw + 26.4 + o, 77 + o * 0.9], [nw + 26.6 + o, 86], [nw + 28.4 + o, 95], [nw + 30.4 + o, 104]]
      g += line(sm(R.map(RX), false) + sm(R.map(LX), false), c, w)
    }
  }
  // the collar: its dark inner neckline (the inside of the band, on the neck's side), the band in the trim; a double
  // collar's two stripes; the band's own shade on the far side
  // (the band: an even 2.2 wide in the trim, a double collar's stripes in it, its far side in shade; behind the neck
  // its back rises at the sides; inside the V a small dark gap of undershirt and shadow)
  const band = pat === 'double' ? line(v, c2, 5.4) + line(v, c1, 3.2) + line(v, c2, 1.2) : line(v, c2, 5.4) + (lo ? '' : line(v, mixC(c2, c1, 0.45), 0.45))
  const back = `M${f(50 - nw - 0.8)} ${f(y0 + 1.6)}Q50 ${f(y0 - 2.6)} ${f(50 + nw + 0.8)} ${f(y0 + 1.6)}`
  const gap = sm([[50 - nw * 0.42, 70.8], [50, vb - 1.8], [50 + nw * 0.42, 70.8], [50 + nw * 0.3, 72.6], [50, vb - 0.6, 1], [50 - nw * 0.3, 72.6]])
  // (the collar's back goes behind his neck: faceSvg draws it before the neck)
  G.collarBack = line(back, c2, 2.2) + line(back, dark(c2, 0.35), 0.5, ' transform="translate(0 1)"')
  return clothOf(G, shirtLoop(G, neck), c1, P, lo)
    + `<g clip-path="url(#${P}Jc)">${g}${band}${fill(sm([[50 + 1.6, vb + 1.6], [50 + nw - 0.4, y0 + 2.6], [50 + nw + 2.2, y0 + 3], [50 + 2.4, vb + 4.4]]), '#000000', ' fill-opacity=".14"')}</g>`
    + fill(gap, mixC(dark(c1, 0.6), '#08090b', 0.5), ' fill-opacity=".85"')
}
// a basketball tank: bare shoulders, the scoop neck and the arm holes trimmed
function tankOf(G, T, color, P, lo) {
  const { nw } = G
  const accent = lum(color) > 190 ? '#1d2230' : '#f2f3f5'
  const loop = sym([[0, 76.6, 1], [nw * 0.7, 75.4], [nw + 1, 70.2, 1], [nw + 6.6, 70.8, 1], [nw + 8, 82], [nw + 13, 94], [nw + 15, 104], [0, 104]])
  const trim = `M${f(50 - nw - 1)} 70.2C${f(50 - nw - 0.6)} 74.6 ${f(50 - nw * 0.6)} 76.6 50 76.6C${f(50 + nw * 0.6)} 76.6 ${f(50 + nw + 0.6)} 74.6 ${f(50 + nw + 1)} 70.2`
    + `M${f(50 - nw - 6.6)} 70.8C${f(50 - nw - 7.2)} 80 ${f(50 - nw - 9)} 90 ${f(50 - nw - 15)} 104M${f(50 + nw + 6.6)} 70.8C${f(50 + nw + 7.2)} 80 ${f(50 + nw + 9)} 90 ${f(50 + nw + 15)} 104`
  return clothOf(G, loop, color, P, lo, false) + `<g clip-path="url(#${P}Jc)">${line(trim, accent, 2.2)}</g>`
}
// a coach's top, the way NFL sideline coaches dress (owner 11-16: the old dark top with a coloured collar band "looks
// like some kind of religious robe"): a team quarter-zip pullover or a team polo, the body in the team's colour, on a
// man's shoulders (no pads: they come down to his arms inside the frame, not out to its edges)
const COACH_SHOULDER = [[2.6, 63.6], [9.4, 66], [16.4, 68.6], [22.4, 72], [27, 76.8], [29.6, 83.4], [30.8, 92], [31.2, 104]]
const coachLoop = (G, neck) => sym([...neck, ...COACH_SHOULDER.map(p => [G.nw + p[0], p[1]]), [0, 104]])
// quarter-zip: a stand-up collar round his neck (its inside seen behind the neck at the sides), unzipped to a short V
// with the pull hanging at its foot, the zip running on down the chest, a trim line on the collar's edge, raglan seams
// from the collar to the arms, the logo on his left chest
// polo: the collar's band round the neck and its two points lying on the chest, a thin trim on their edges, the
// placket and its buttons, the logo on his left chest
function topOf(look, G, K, P, lo, mark) {
  const { nw } = G, c = K.c1
  const trim = Math.abs(lum(K.c2) - lum(c)) > 40 ? K.c2 : lum(c) > 150 ? dark(c, 0.45) : light(c, 0.45)
  const near = light(c, 0.07), farC = dark(c, 0.18)
  const both = (pts, a, b) => fill(sm(pts.map(LX)), a) + fill(sm(pts.map(RX)), b)
  const edge = (pts, col, w, x = '') => line(sm(pts.map(LX), false) + sm(pts.map(RX), false), col, w, x)
  // the logo on his left chest (the viewer's right), when the drawing is big enough to show it
  const chest = lo ? '' : logoOf(mark, 50 + nw * 0.5 + 7.6, 81.4, 7.4, 5.6)
  const zip = look.top !== 'polo'
  // (the collar's inside, behind his neck: only its sides show, standing up round the neck)
  const back = sm([[50 - nw - 2.2, 64.4], [50 - nw - 1.3, zip ? 57.4 : 59.4], [50, zip ? 55.6 : 57.6], [50 + nw + 1.3, zip ? 57.4 : 59.4], [50 + nw + 2.2, 64.4], [50, 62]])
  G.collarBack = fill(back, dark(c, 0.42))
  let s = clothOf(G, coachLoop(G, [[0, zip ? 73 : 71, 1], [nw * 0.6, 67.6], [nw + 1.6, 62.6, 1]]), c, P, lo)
  if (zip) {
    // raglan seams, collar to underarm
    const rag = [[nw + 2.6, 64.6], [nw + 7, 70], [nw + 12.4, 78.4], [nw + 16.4, 90], [nw + 17.6, 104]]
    if (!lo) s += `<g clip-path="url(#${P}Jc)">${edge(rag, dark(c, 0.3), 0.35)}</g>`
    // the zip down the chest: the tape, its teeth
    s += line('M50 73V89.4', dark(c, 0.5), 0.95) + (lo ? '' : line('M50 74V89', '#aeb4bd', 0.42, ' stroke-dasharray=".28 .28"'))
    // the collar's two halves: the fold on top, open to a V at the zip; the bottom edge's shadow on the chest
    const half = [[nw + 0.9, 57.2, 1], [nw * 0.62, 62.4], [1.1, 69.6, 1], [0.55, 74.6, 1], [nw * 0.55, 70.6], [nw + 3.4, 64.6, 1], [nw + 2.4, 60.4]]
    s += edge([[0.5, 75.4], [nw * 0.55, 71.4], [nw + 3.6, 65.4]], '#000000', 1.1, ' stroke-opacity=".2"')
    s += both(half, near, farC)
    s += edge([[nw + 0.9, 57.2], [nw * 0.62, 62.4], [1.1, 69.6]], trim, lo ? 0.8 : 0.55)
    // (inside the V his neck in the collar's shadow)
    s += fill(sm([[50 - nw * 0.62, 62.4], [50 - 1.1, 69.6], [50, 70.4], [50 + 1.1, 69.6], [50 + nw * 0.62, 62.4], [50, 66.4]]), '#000000', ' fill-opacity=".22"')
    // the pull at the V's foot
    s += fill(sm([[49.3, 69.6, 1], [50.7, 69.6, 1], [50.9, 74.4], [50, 75.3], [49.1, 74.4]]), '#c9ced6') + (lo ? '' : fill(ell(50, 70.5, 0.32, 0.32), dark(c, 0.4)))
    return s + chest
  }
  // the placket: its two edges stitched, the buttons
  s += fill(poly([[48.2, 69], [51.8, 69], [51.8, 84.6], [48.2, 84.6]]), mixC(c, farC, 0.4)) + line('M48.2 69V84.6M51.8 69V84.6', dark(c, 0.32), 0.3)
    + fill(ell(50, 76, 0.6, 0.6) + ell(50, 81, 0.6, 0.6), lum(c) > 170 ? '#3a3f48' : '#eef0f3')
  // the collar: the band round the neck, its points down on the chest either side of the placket
  const leaf = [[nw + 0.6, 59, 1], [nw * 0.55, 64.8], [2, 69.4, 1], [nw * 0.32 + 1.2, 76.4, 1], [nw + 2.6, 70.4], [nw + 4, 65.4, 1], [nw + 2.4, 61.2]]
  s += edge([[2.4, 70.4], [nw * 0.32 + 1.6, 77.4], [nw + 2.8, 71.2], [nw + 4.2, 66.2]], '#000000', 1, ' stroke-opacity=".22"')
  s += both(leaf, near, farC)
  s += edge([[nw * 0.32 + 1.2, 76.4], [nw + 2.6, 70.4], [nw + 4, 65.4]], trim, lo ? 0.8 : 0.5)
  s += fill(sm([[50 - nw * 0.55, 64.8], [50 - 2, 69.4], [50 + 2, 69.4], [50 + nw * 0.55, 64.8], [50, 67.4]]), '#000000', ' fill-opacity=".2"')
  return s + chest
}

// ── The whole bust ───────────────────────────────────────────────────────────
export function faceSvg(look, { color = '#d2aa4f', view = 'full', mark = null } = {}) {
  // (his team's kit, kits.js: a caller may pass the kit, or just the team's colour)
  const K = kitOf(color), col = K.c1, lo = view === 'sm'
  const key = `${JSON.stringify(look)}|${K.id}${col}|${view}|${mark?.id ?? ''}`
  const P = `f${(hashStr(key) % 1679616).toString(36)}`
  const rnd = rngOf(hashStr(JSON.stringify(look)))
  const G = geo(look), T = skinTones(lo && lum(look.skin) < 80 ? mixC(look.skin, '#8a5a3e', 0.22) : look.skin)
  TX = { P, n: 0, defs: {}, lo }
  const { cw, tw, cb, jw, jy, ch, cy, nw, es, ey, mw, my, lean } = G
  const hc0 = look.hc === TIPS ? '#16110e' : look.hc
  const bc = look.bc ?? (lum(hc0) > 120 ? mixC(hc0, '#5e321a', 0.5) : hc0)
  // a cap hides his hair above the band; a durag all of it
  const hide = look.gear === 'durag' ? 'all' : null
  const hp = hairOf(look, G, T, rngOf(hashStr(`${look.hair}|${look.hc}|${look.skin}`)), lo, hide)
  const S = { M: '', S: '', H: '' }
  // the far side (his left, the viewer's right) turning away into shadow: narrow on the temple, in at the
  // cheekbone, wide in the hollow under it, along the jaw to the chin
  S.S += sm([[50 + cw * 0.62, C0 - 3], [50 + cw - 2.8, 20.4], [50 + cw - 2.6, 26], [50 + tw - 2.5, 31], [50 + tw - 2.2, 35.6], [50 + cb - 1.7, 40.6], [50 + cb - (G.young ? 2.6 : 3.4) - lean * 1.3, 46.6],
    [50 + jw - 1.7, jy - 0.4], [50 + jw - 3.4, jy + 3.4], [50 + ch + 0.5, cy - 1.6], [50 + ch - 0.4, cy + 2], [70, cy + 4], [104, cy + 4], [104, C0 - 3]])
  // the near side's edge turning away, a half tone
  S.M += sm([[50 - cw - 3, 22], [50 - cw + 1.1, 25], [50 - tw + 0.9, 34], [50 - cb + 0.7, 41], [50 - cb + 1.3, 46.4], [50 - jw + 0.9, jy], [50 - ch - 0.4, cy - 1.2], [48, cy + 3], [-4, cy + 3]])
  // the hollow under the near cheekbone, the underside of the chin
  S.S += sm([[50 - ch - 1.4, cy - 0.7], [50, cy - 1.0], [50 + ch + 1.4, cy - 0.7], [50 + ch + 2, cy + 3], [50 - ch - 2, cy + 3]])
  // the light: the forehead, the near cheekbone, the chin (a shaved head's dome)
  if (!lo) {
    S.H += sm([[41.4, 29.8], [44.6, 27.2], [49.2, 26.8], [47.4, 28.8], [42.6, 31.4]])
    S.H += sm([[50 - es - 3.2, 42.4], [50 - es - 0.6, 41.6], [50 - es + 1.2, 42.2], [50 - es - 1, 43.2]])
    S.H += ell(48.6, cy - 2.4, 1.5, 0.7)
    if (['shaved', 'balding', 'receding', 'buzz'].includes(look.hair) && !look.cap) S.H += sm([[41, C0 + 3.4], [46, C0 + 0.9], [51, C0 + 1.2], [46.4, C0 + 3.2]])
  }
  if (look.cleft) S.M += sm([[50, cy - 2.6], [50.35, cy - 1.4], [49.8, cy - 1.2]])
  const eyes = eyesOf(look, G, T, S, lo)
  const nose = noseOf(look, G, T, S, lo)
  const mouth = mouthOf(look, G, T, S, lo)
  linesOf(look, G, T, S, lo)
  const beard = beardOf(look, G, T, rnd, lo, bc)
  // the ears: the near one lit, the far one in half tone, the bowl inside each
  let ears = ''
  for (const s of [-1, 1]) {
    const x = 50 + s * (tw - 0.3), X = d => x + s * d
    ears += fill(sm([[X(-0.4), 36], [X(1.4), 35.3], [X(2.3), 37.2], [X(2.2), 40.8], [X(1.6), 44.4], [X(0.9), 46.8], [X(0.1), 47.6], [X(-0.6), 46.2]]), s < 0 ? T.B : T.M)
      + fill(sm([[X(0.3), 37.8], [X(1.3), 37.4], [X(1.5), 40.2], [X(1.1), 43.6], [X(0.3), 44.4]]), s < 0 ? T.M : T.S)
      + (lo ? '' : line(`M${f(X(0.2))} 36.6Q${f(X(1.9))} 36.4 ${f(X(1.8))} 39.6Q${f(X(1.7))} 42.6 ${f(X(1))} 45`, s < 0 ? T.S : T.D, 0.3, ' stroke-linecap="round"')
        + fill(ell(X(0.35), 41.6, 0.45, 0.8), s < 0 ? T.S : T.D))
  }
  // the neck: under the jaw in shadow, its far side, the collar's shadow inside the neckline
  const neckD = sm(neckLoop(G, look.kit === 'hoops' && !look.top))
  const neck = shape(`${P}N`, neckD, T.B)
    + `<g clip-path="url(#${P}Nc)">`
    + fill(sm([[50 - nw - 1, 44], [50 + nw + 1, 44], [50 + nw + 1, jy + 5.6], [50 + ch + 3, cy + 3.6], [50, cy + 4.6], [50 - ch - 3, cy + 3.4], [50 - nw - 1, jy + 4]]), T.S)
    + fill(sm([[50 + nw * 0.5, 52], [50 + nw * 0.6, 61], [50 + nw + 6, 66], [50 + nw + 8, 104], [104, 104], [104, 44]]), T.M)
    + fill(sm([[50 + nw * 0.8, 52], [50 + nw * 0.88, 59], [50 + nw + 4, 65], [104, 68], [104, 44]]), T.S)
    + fill(poly([[50 - nw + 0.4, 62.6], [50, 75.2], [50 + nw - 0.4, 62.6], [50 + nw, 62.6], [50, 80], [50 - nw, 62.6]]), T.S)
    + (lo || G.young ? '' : fill(sm([[50 - nw + 2.6, 55], [50 - 1.8, 65.4], [50 - 2.4, 66], [50 - nw + 2, 57.4]]), T.M))
    + `</g>`
  const shirt = look.top ? topOf(look, G, K, P, lo, mark) : look.kit === 'hoops' ? tankOf(G, T, col, P, lo) : jerseyOf(G, K, P, lo, look.kit === 'crew')
  const headD = sm(sym(G.R))
  const vb = VIEWS[view] ?? VIEWS.full
  const close = view === 'eyes' || view === 'nose' || view === 'mouth'
  const hairFront = look.cap === 'cap' ? `<g clip-path="url(#${P}K)">${hp.front}</g>` : hp.front
  const e = eyes.P
  // (a durag's tails hang behind his neck)
  const tails = look.gear === 'durag' ? fill(sm([[50 + cw - 2, 40], [50 + cw + 0.4, 44], [50 + nw + 3.4, 60], [50 + nw + 4.4, 70], [50 + nw + 1.6, 70], [50 + nw + 0.6, 58], [50 + cw - 3.4, 45]]), '#121317') : ''
  // (the studs sit on the lobes, drawn before the head, so the jaw's edge, a beard, sideburns and hair all cover them)
  const body = (close ? '' : hp.back + tails + (G.collarBack ?? '') + neck + shirt + chainOf(look, G, lo) + hp.mid + ears + earringsOf(look, G))
    + `<use href="#${P}h" fill="${T.B}"/>`
    + `<g clip-path="url(#${P}C)">${T.blush && !lo ? fill(sm([[50 - cb + 2, 44], [50 - cb + 6.4, 43.4], [50 - cb + 5.6, 47.6], [50 - cb + 2.4, 48]]) + sm([[50 + cb - 2, 44], [50 + cb - 6.4, 43.4], [50 + cb - 5.6, 47.6], [50 + cb - 2.4, 48]]), T.blush) : ''}`
    + `${fill(S.M, T.M)}${fill(S.S, T.S)}${fill(S.H, T.H)}${lo ? '' : `<rect x="20" y="10" width="60" height="60" fill="${dotTex(T.D, 0.9, 0.13, 0.07)}"/>`}${beard.under}`
    + line(poly(G.Rd.filter(p => p[1] > 27 && p[1] < jy + 1).map(p => [50 + p[0], p[1]]), false), mixC(T.B, '#f4f0ff', 0.2 + T.d * 0.12), lo ? 1.3 : 0.7) + `</g>`
    + `<use href="#${P}e" fill="${T.white}"/>`
    + `<g clip-path="url(#${P}E)">${fill(e.ir, e.iris)}${e.light ? fill(e.pu, '#0c0807') : ''}${fill(`M0 0H100V${f(ey - 0.1)}H0Z`, '#2a1a12', ' fill-opacity=".18"')}${lo ? '' : fill(e.cl, '#ffffff', ' fill-opacity=".7"')}</g>`
    + fill(e.lid, T.S) + fill(e.lash, T.lash)
    + browsOf(look, G, T, lo) + nose
    + beard.over + mouth + stacheOf(look, G, T, rnd, bc) + eyeBlackOf(look, G)
    + hairFront + headGearOf(look, G, col) + glassesOf(look, G) + capOf(look, G, col, mark)
  const defs = `<defs>${Object.values(TX.defs).join('')}<path id="${P}h" d="${headD}"/><path id="${P}e" d="${eyes.wh}"/><clipPath id="${P}C"><use href="#${P}h"/></clipPath><clipPath id="${P}E"><use href="#${P}e"/></clipPath>${look.cap === 'cap' ? `<clipPath id="${P}K"><path d="M0 ${f(G.hl + 3)}H100V100H0Z"/></clipPath>` : ''}</defs>`
  TX = null
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${defs}${body}</svg>`
}

// a data: URL that encodes only what it must
export const toUrl = svg => `data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}`
