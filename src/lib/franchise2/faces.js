// FRANCHISE: drawn faces. The men the game makes up (draft prospects, rookies, generated depth, free agents, coaches
// without a photo) and every one of the player's builds. Real players use their ESPN headshot; never a drawn face on a
// real man without a photo (initials beat a made-up face on a real player).
//
// The look (owner 2026-11-15: "AAA stylized", light on the CPU): a painted bust in plain SVG. One key light from the
// upper left, a form shadow down the far side, a cool rim on the far edge, specular hits on the forehead, the nose and
// the lower lip. The shading is soft blobs: ellipses filled with a radial gradient that fades to nothing (no filters),
// clipped to the head or the neck. Skin has an undertone (pink, neutral, golden, olive, red, cool) that tints its
// shadow, its blush and its lips, and deep skin takes a cool sheen in place of a white highlight. A grown NFL man: a
// skull and a real jaw, a thick neck with its two neck muscles into a football jersey's V-neck in the team's colour.
//
// The man is one coherent person, not parts picked at random: first his background (weighted by position the way NFL
// rooms are), then a skin tone, head, features, hair, hair colour and facial hair that go together on real players.
//
//   lookOf(key, pos, ag)          the look, seeded by the key (his name); ag his age (lines come with the years)
//   faceSvg(look, { color, view }) the SVG bust (drawn on 100 × 100, framed 74 × 74; transparent; color: his team's;
//                                 view: a crop of it for the creator's thumbnails, VIEWS)
//   faceUrl(key, pos, color, ag)  the same as a data: URL for an <img> (cached)
//   genFace(p, color)             a league man's face url (p: league.js's player): his key is his name
// The player's builds: B.face (the creator's choices, FacePick.jsx), buildLook(B), buildFaceUrl(B, color, view).
//
// Pure: no DOM, no Math.random. The same name always draws the same man (a prospect keeps his face as a rookie).
// Every SVG string is cached by its look, so a face is built once (about 0.2 ms) and then reused.
import { seeded } from '../rng'

// ── Who he is ────────────────────────────────────────────────────────────────
// background: b Black · w white · m mixed · p Polynesian · l Latino
// (the shares by room, from the game's own rosters: QB rooms and offensive lines are about half white, corners
// almost all Black, Polynesian men mostly on the lines)
const MIX = {
  qb: { b: 0.38, w: 0.52, m: 0.06, p: 0.02, l: 0.02 },
  rb: { b: 0.80, w: 0.10, m: 0.07, p: 0.02, l: 0.01 },
  wr: { b: 0.78, w: 0.13, m: 0.07, p: 0.01, l: 0.01 },
  te: { b: 0.40, w: 0.48, m: 0.07, p: 0.03, l: 0.02 },
  ol: { b: 0.40, w: 0.44, m: 0.05, p: 0.08, l: 0.03 },
  dl: { b: 0.74, w: 0.11, m: 0.06, p: 0.07, l: 0.02 },
  lb: { b: 0.62, w: 0.25, m: 0.07, p: 0.04, l: 0.02 },
  db: { b: 0.86, w: 0.06, m: 0.06, p: 0.01, l: 0.01 },
}

// ── The choices (the creator's lists: value, label) ──────────────────────────
// skin: value, label, undertone (the older saves' twelve tones are all still here, so an old face keeps its skin)
export const FACE_SKIN = [
  ['#f6dccb', 'PORCELAIN', 'pink'], ['#f4d2b6', 'FAIR', 'neutral'], ['#eab996', 'LIGHT', 'pink'], ['#deae84', 'TAN', 'golden'],
  ['#d9a582', 'SAND', 'neutral'], ['#cfa27c', 'OLIVE', 'olive'], ['#c99064', 'HONEY', 'golden'], ['#b98058', 'GOLDEN', 'golden'],
  ['#ae7a56', 'TAWNY', 'olive'], ['#a06c44', 'BRONZE', 'golden'], ['#9c6440', 'COPPER', 'red'], ['#8a5634', 'BROWN', 'neutral'],
  ['#7a4a2c', 'CHESTNUT', 'red'], ['#6a4128', 'MAHOGANY', 'red'], ['#5e3a22', 'DEEP', 'neutral'], ['#4e2f1e', 'ESPRESSO', 'cool'],
  ['#432818', 'DARK', 'neutral'], ['#33201a', 'EBONY', 'cool'],
]
export const FACE_HEAD = [['oval', 'OVAL'], ['square', 'SQUARE'], ['round', 'ROUND'], ['long', 'LONG'], ['broad', 'BROAD'], ['chiseled', 'CHISELED']]
export const FACE_EYES = [['almond', 'ALMOND'], ['round', 'ROUND'], ['narrow', 'NARROW'], ['hooded', 'HOODED'], ['deep', 'DEEP SET'], ['upturn', 'UPTURNED']]
export const FACE_IRIS = [['#2b1a10', 'DARK BROWN'], ['#4a2c16', 'BROWN'], ['#6e5226', 'HAZEL'], ['#56683a', 'GREEN'], ['#47698c', 'BLUE'], ['#6a7783', 'GREY']]
export const FACE_BROWS = [['straight', 'STRAIGHT'], ['thick', 'THICK'], ['arched', 'ARCHED'], ['angled', 'ANGLED'], ['thin', 'THIN'], ['bushy', 'BUSHY']]
export const FACE_NOSE = [['straight', 'STRAIGHT'], ['broad', 'BROAD'], ['narrow', 'NARROW'], ['short', 'SHORT'], ['wide', 'WIDE'], ['boxer', 'BROKEN']]
export const FACE_MOUTH = [['neutral', 'NEUTRAL'], ['full', 'FULL'], ['thin', 'THIN'], ['smirk', 'SMIRK'], ['wide', 'WIDE'], ['stern', 'STERN']]
export const FACE_HAIR = [
  ['shaved', 'BALD'], ['buzz', 'BUZZ'], ['crew', 'CREW CUT'], ['fade', 'FADE'], ['waves', 'WAVES'], ['sidepart', 'SIDE PART'],
  ['textured', 'TEXTURED'], ['curly', 'CURLS'], ['twists', 'TWISTS'], ['locs', 'LOCS'], ['cornrows', 'BRAIDS'], ['afro', 'AFRO'],
  ['hightop', 'HIGH TOP'], ['frohawk', 'FROHAWK'], ['flow', 'FLOW'], ['long', 'LONG'], ['bun', 'BUN'], ['mullet', 'MULLET'],
  ['receding', 'RECEDING'], ['balding', 'THINNING'],
]
export const FACE_HC = [
  ['#16110e', 'BLACK'], ['#2a1d15', 'DARK'], ['#5a3b24', 'BROWN'], ['#86492a', 'AUBURN'], ['#9a4526', 'RED'], ['#a8824e', 'SANDY'],
  ['#c9a46c', 'BLOND'], ['#ddd0ac', 'PLATINUM'], ['#b8893c', 'TIPS'], ['#57534f', 'SALT & PEPPER'], ['#8f8a82', 'GREY'], ['#b4b0a9', 'SILVER'], ['#e2dfd8', 'WHITE'],
]
export const FACE_BEARD = [['none', 'CLEAN'], ['stubble', 'STUBBLE'], ['patch', 'CHIN PATCH'], ['chin', 'STRAP'], ['goatee', 'GOATEE'], ['short', 'SHORT'], ['full', 'FULL'], ['long', 'LONG']]
export const FACE_STACHE = [['none', 'NONE'], ['thin', 'THIN'], ['full', 'FULL'], ['horseshoe', 'HORSESHOE']]
export const FACE_GEAR = [['none', 'NONE'], ['headband', 'HEADBAND'], ['durag', 'DURAG'], ['visor', 'VISOR']]
export const FACE_EB = [['none', 'NONE'], ['paint', 'EYE BLACK'], ['strips', 'STRIPS']]
export const FACE_EAR = [['none', 'NONE'], ['studs', 'STUDS'], ['stud', 'ONE STUD']]
export const FACE_CHAIN = [['none', 'NONE'], ['gold', 'GOLD'], ['silver', 'SILVER']]
// the shape sliders: key, label (each -1 … 1, 0 the head's own)
export const FACE_SLIDERS = [
  ['wt', 'FACE WEIGHT'], ['jaw', 'JAW WIDTH'], ['chn', 'CHIN LENGTH'], ['chk', 'CHEEKBONES'],
  ['esz', 'EYE SIZE'], ['esp', 'EYE SPACING'], ['brh', 'BROW HEIGHT'],
  ['nsw', 'NOSE WIDTH'], ['nsl', 'NOSE LENGTH'], ['lip', 'LIP FULLNESS'], ['mw', 'MOUTH WIDTH'],
]
const SL = FACE_SLIDERS.map(x => x[0])

// ── How often each goes with each background ─────────────────────────────────
// (the draws for the first parts are the older faces' own, in their order, so a made-up man keeps who he was)
const SKIN = {
  b: ['#a06c44', '#9c6440', '#8a5634', '#8a5634', '#7a4a2c', '#7a4a2c', '#5e3a22', '#432818'],
  w: ['#f4d2b6', '#eab996', '#eab996', '#d9a582', '#deae84'],
  m: ['#c99064', '#b98058', '#a06c44', '#deae84'],
  p: ['#b98058', '#a06c44', '#9c6440', '#c99064'],
  l: ['#deae84', '#c99064', '#b98058', '#d9a582'],
}
// (then, now and then, a neighbouring tone the older list didn't have)
const SKIN_NEXT = { '#f4d2b6': '#f6dccb', '#d9a582': '#cfa27c', '#b98058': '#ae7a56', '#7a4a2c': '#6a4128', '#5e3a22': '#4e2f1e', '#432818': '#33201a', '#deae84': '#cfa27c' }
const HAIR = {
  b: [['fade', 26], ['waves', 12], ['buzz', 12], ['locs', 13], ['twists', 9], ['cornrows', 6], ['hightop', 3], ['shaved', 9], ['afro', 4], ['curly', 3]],
  w: [['crew', 24], ['sidepart', 13], ['textured', 16], ['flow', 12], ['buzz', 14], ['curly', 5], ['shaved', 5], ['mullet', 4], ['fade', 5], ['long', 2]],
  m: [['fade', 24], ['curly', 24], ['buzz', 12], ['twists', 10], ['locs', 8], ['afro', 6], ['shaved', 6], ['textured', 6], ['waves', 4]],
  p: [['bun', 28], ['long', 18], ['buzz', 16], ['fade', 18], ['curly', 10], ['shaved', 6], ['mullet', 4]],
  l: [['fade', 32], ['crew', 20], ['textured', 16], ['buzz', 14], ['curly', 8], ['shaved', 6], ['sidepart', 4]],
}
const HC = {
  b: [['#16110e', 90], ['#2a1d15', 8], ['#b8893c', 2]],      // (the last: blond-dyed tips, locs and twists only)
  w: [['#5a3b24', 34], ['#2a1d15', 24], ['#a8824e', 18], ['#c9a46c', 9], ['#86492a', 7], ['#16110e', 8]],
  m: [['#16110e', 58], ['#2a1d15', 36], ['#5a3b24', 6]],
  p: [['#16110e', 84], ['#2a1d15', 16]],
  l: [['#16110e', 62], ['#2a1d15', 38]],
}
const BEARD = {
  b: [['none', 32], ['stubble', 10], ['goatee', 15], ['short', 20], ['full', 14], ['chin', 8], ['long', 1]],
  w: [['none', 40], ['stubble', 22], ['short', 16], ['full', 14], ['goatee', 4], ['chin', 2], ['long', 2]],
  m: [['none', 40], ['goatee', 16], ['short', 14], ['full', 12], ['stubble', 12], ['chin', 6]],
  p: [['none', 32], ['full', 24], ['short', 16], ['goatee', 14], ['stubble', 10], ['long', 4]],
  l: [['none', 40], ['goatee', 20], ['short', 14], ['full', 12], ['stubble', 14]],
}
const HEAD = {
  b: [['oval', 30], ['square', 30], ['long', 16], ['round', 12], ['broad', 12]],
  w: [['square', 32], ['oval', 28], ['long', 18], ['round', 12], ['broad', 10]],
  m: [['oval', 34], ['square', 26], ['long', 16], ['round', 14], ['broad', 10]],
  p: [['broad', 36], ['round', 26], ['square', 26], ['oval', 12]],
  l: [['oval', 32], ['square', 28], ['round', 20], ['long', 10], ['broad', 10]],
}
const NOSE = {
  b: [['broad', 46], ['straight', 34], ['short', 14], ['narrow', 6]],
  w: [['straight', 50], ['narrow', 24], ['short', 16], ['broad', 10]],
  m: [['straight', 40], ['broad', 30], ['short', 20], ['narrow', 10]],
  p: [['broad', 50], ['straight', 34], ['short', 16]],
  l: [['straight', 50], ['broad', 22], ['short', 18], ['narrow', 10]],
}
const MOUTH = {
  b: [['full', 46], ['neutral', 40], ['smirk', 10], ['thin', 4]],
  w: [['neutral', 46], ['thin', 30], ['smirk', 14], ['full', 10]],
  m: [['neutral', 44], ['full', 30], ['smirk', 14], ['thin', 12]],
  p: [['full', 44], ['neutral', 44], ['smirk', 12]],
  l: [['neutral', 50], ['full', 24], ['smirk', 14], ['thin', 12]],
}
const IRIS = {
  b: [['#2b1a10', 70], ['#4a2c16', 28], ['#6e5226', 2]],
  w: [['#4a2c16', 30], ['#47698c', 28], ['#6e5226', 16], ['#56683a', 12], ['#6a7783', 8], ['#2b1a10', 6]],
  m: [['#4a2c16', 50], ['#2b1a10', 30], ['#6e5226', 16], ['#56683a', 4]],
  p: [['#2b1a10', 70], ['#4a2c16', 30]],
  l: [['#2b1a10', 40], ['#4a2c16', 46], ['#6e5226', 14]],
}
const EYES = [['almond', 40], ['narrow', 22], ['hooded', 22], ['round', 16]]
const BROWS = [['straight', 34], ['thick', 28], ['angled', 18], ['arched', 12], ['thin', 8]]
const pickW = (r, list) => { const t = list.reduce((a, x) => a + x[1], 0); let u = r() * t; for (const x of list) { u -= x[1]; if (u < 0) return x[0] } return list[list.length - 1][0] }
const BIG = new Set(['ol', 'dl', 'te'])
const wideOf = pos => (BIG.has(pos) ? 1 : pos === 'lb' || pos === 'rb' ? 0.5 : 0.2)
const r2 = v => Math.round(v * 100) / 100
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

// the newer parts (iris, shape sliders, the eye black / earrings / chain split out of the old single gear), from a
// second stream so the first parts keep their older draws
function extras(key, L, pos) {
  const r = seeded(`face2|${key}`)
  const g = L.g, big = BIG.has(pos), lean = pos === 'db' || pos === 'wr'
  const s = () => r2((r() + r() + r()) / 1.5 - 1)   // -1 … 1, most near the middle
  const x = {
    iris: pickW(r, IRIS[g] ?? IRIS.w),
    wt: r2(clamp((big ? 0.55 : lean ? -0.35 : pos === 'qb' ? -0.1 : 0.1) + s() * 0.45, -1, 1)),
    jaw: r2(s() * 0.7 + (big ? 0.2 : 0)), chn: r2(s() * 0.6), chk: r2(s() * 0.7 + (lean ? 0.15 : 0)),
    esz: r2(s() * 0.5), esp: r2(s() * 0.5), brh: r2(s() * 0.5),
    nsw: r2(s() * 0.6), nsl: r2(s() * 0.5), lip: r2(s() * 0.6 + (g === 'b' ? 0.2 : 0)), mw: r2(s() * 0.5),
    eb: 'none', ear: 'none', chain: 'none', cleft: r() < 0.25,
  }
  if (L.gear === 'eyeblack') x.eb = 'paint'
  if (L.gear === 'studs') x.ear = 'studs'
  const u = r()
  if (x.eb === 'none' && u < 0.04) x.eb = 'strips'
  if (x.ear === 'none' && g !== 'w' && u > 0.9) x.ear = u > 0.96 ? 'stud' : 'studs'
  if (r() < 0.07) x.chain = r() < 0.75 ? 'gold' : 'silver'
  if (r() < 0.25 && SKIN_NEXT[L.skin]) x.skin = SKIN_NEXT[L.skin]
  if (r() < 0.12) x.head = 'chiseled'
  const v = r()
  if (v < 0.08) x.nose = g === 'w' ? 'boxer' : 'wide'
  if (v > 0.9) x.mouth = v > 0.95 ? 'stern' : 'wide'
  const w = r()
  if (w < 0.1) x.eyes = 'deep'
  else if (w > 0.94) x.eyes = 'upturn'
  if (r() < 0.08 && L.brows === 'thick') x.brows = 'bushy'
  if (L.hair === 'fade' && (g === 'b' || g === 'm') && r() < 0.06) x.hair = 'frohawk'
  if (L.beard === 'none' && r() < 0.06) x.beard = 'patch'
  return x
}

export function lookOf(key, pos = 'wr', ag = null) {
  const r = seeded(`face|${key}`)
  const mix = MIX[pos] ?? MIX.wr
  const g = pickW(r, Object.entries(mix).map(([k, v]) => [k, v * 100]))
  const skin = SKIN[g][Math.floor(r() * SKIN[g].length)]
  const hair = pickW(r, HAIR[g])
  let hc = pickW(r, HC[g])
  // dyed tips only on locs or twists; otherwise his natural colour
  if (hc === '#b8893c' && hair !== 'locs' && hair !== 'twists') hc = '#16110e'
  let beard = pickW(r, BEARD[g])
  // (a shaved head usually comes with a beard)
  if (hair === 'shaved' && beard === 'none' && r() < 0.6) beard = 'full'
  // the moustache that goes with the beard: a full beard or a goatee has one, a clean face now and then a thin one
  const stache = beard === 'full' || beard === 'long' || beard === 'short' ? 'full' : beard === 'goatee' ? (r() < 0.8 ? 'full' : 'horseshoe')
    : beard === 'none' && r() < 0.08 ? 'thin' : 'none'
  let head = pickW(r, HEAD[g])
  if (BIG.has(pos) && head === 'long' && r() < 0.6) head = 'broad'
  const u = r()
  const gear = u < 0.07 ? 'eyeblack' : u < 0.1 ? 'headband' : u < 0.12 && (g === 'b' || g === 'm') && hair !== 'afro' && hair !== 'hightop' ? 'durag' : u < 0.16 && g !== 'w' ? 'studs' : 'none'
  const L = {
    g, skin, head, eyes: pickW(r, EYES), brows: pickW(r, BROWS), nose: pickW(r, NOSE[g]), mouth: pickW(r, MOUTH[g]),
    hair, hc, brow: hc === '#b8893c' ? '#16110e' : hc, beard, stache, gear, wide: wideOf(pos),
  }
  const x = extras(key, L, pos)
  return { ...L, ...x, gear: gear === 'eyeblack' || gear === 'studs' ? 'none' : gear, ag: ag ?? 24 }
}

// ── Colour ───────────────────────────────────────────────────────────────────
const hex = h => parseInt(h.slice(1, 7), 16)
const mixC = (a, b, k) => { const x = hex(a), y = hex(b); const c = s => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k); return `#${[16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join('')}` }
const shade = (c, k) => mixC(c, '#0b0c10', k)
const lite = (c, k) => mixC(c, '#ffffff', k)
const lum = c => { const x = hex(c); return 0.299 * ((x >> 16) & 255) + 0.587 * ((x >> 8) & 255) + 0.114 * (x & 255) }
// numbers as short as they go (".5", "-1.2")
const f1 = n => { const r = Math.round(n * 10) / 10; return r >= 1 || r <= -1 ? String(r) : r === 0 ? '0' : r > 0 ? String(r).slice(1) : `-${String(-r).slice(1)}` }
const o2 = n => String(Math.round(n * 100) / 100).replace(/^0\./, '.')

// a skin's tones: its lit side, its shadow (tinted by its undertone), the deep creases, the blush, the specular hit,
// the lips and the line of the features
const UT = {
  pink: ['#7a2e2a', '#e0786c'], neutral: ['#5a3020', '#cf7358'], golden: ['#6a3a14', '#d27a48'],
  olive: ['#4a3c1e', '#b8744e'], red: ['#5e1e12', '#c4503a'], cool: ['#2a1522', '#9a4a52'],
}
const UT_OF = new Map(FACE_SKIN.map(x => [x[0], x[2]]))
const TONES = new Map()
function tonesOf(sk) {
  let t = TONES.get(sk)
  if (t) return t
  const L = lum(sk), d = clamp((205 - L) / 150, 0, 1)      // 0 the fairest … 1 the deepest
  const ut = UT_OF.get(sk) ?? (L > 170 ? 'neutral' : L > 110 ? 'golden' : 'neutral')
  const [shT, blT] = UT[ut]
  const shTint = mixC(shT, '#000000', d * 0.72)
  t = {
    d, base: sk,
    lit: mixC(sk, '#fff0dc', 0.1 + d * 0.04),
    sh: mixC(sk, shTint, 0.5 + d * 0.1),
    dk: mixC(sk, '#120605', 0.66),
    bl: blT,
    spec: d < 0.55 ? '#fff6ee' : mixC('#cdd6ee', sk, 0.2),
    specA: d < 0.55 ? 0.42 + d * 0.3 : 0.55,
    line: mixC(sk, '#160a07', 0.6),
    lipU: d < 0.5 ? mixC(sk, '#8a3a40', 0.42 - d * 0.2) : mixC(sk, '#1c0d12', 0.3),
    lipL: d < 0.5 ? mixC(sk, '#b85a5e', 0.34 - d * 0.1) : mixC(sk, '#8e5258', 0.24),
  }
  TONES.set(sk, t)
  return t
}

// ── The frame ────────────────────────────────────────────────────────────────
// the head and the tops of the shoulders, the way a broadcast headshot is cropped (a high top or an afro may touch
// the top edge); the creator's thumbnails crop to the part they change
export const VIEWS = { full: '13 6 74 74', eyes: '30 33 40 25', nose: '36 41 28 28', mouth: '35 49 30 25', low: '24 38 52 52', hair: '14 3 72 72', ear: '21 36 26 26' }
const TOP = 17

// ── The head ─────────────────────────────────────────────────────────────────
// cw half the skull's width · cb half the face at the cheekbones · jw half the jaw at its corner · jy the jaw corner's
// height · ch half the chin's width · cy the chin
const SHAPE = {
  oval: { cw: 16.2, cb: 15.8, jw: 13.2, jy: 58, ch: 6.0, cy: 68 },
  square: { cw: 16.4, cb: 16.2, jw: 15.2, jy: 59, ch: 8.0, cy: 67.8 },
  round: { cw: 17.0, cb: 16.9, jw: 14.4, jy: 57, ch: 6.8, cy: 67.2 },
  long: { cw: 15.4, cb: 15.3, jw: 13.4, jy: 60, ch: 6.6, cy: 69.6 },
  broad: { cw: 17.6, cb: 17.5, jw: 16.4, jy: 58.6, ch: 8.8, cy: 68 },
  chiseled: { cw: 16.4, cb: 16.7, jw: 14.8, jy: 59.6, ch: 7.2, cy: 68.8 },
}
const NOSE_W = { straight: 4.1, broad: 5.2, narrow: 3.3, short: 4.0, wide: 5.9, boxer: 4.6 }
const MOUTH_W = { neutral: 5.1, full: 5.4, thin: 4.8, smirk: 5.1, wide: 6, stern: 5.2 }
const sv = (look, k) => clamp(+look[k] || 0, -1, 1)
function geo(look) {
  const s = SHAPE[look.head] ?? SHAPE.oval, w = look.wide ?? 0.2
  const wt = sv(look, 'wt'), jaw = sv(look, 'jaw'), chk = sv(look, 'chk'), chn = sv(look, 'chn')
  const G = {
    cw: s.cw + w * 0.8 + wt * 0.5,
    cb: s.cb + w * 0.9 + wt * 0.9 + chk * 0.8,
    jw: s.jw + w * 1.2 + wt * 1.1 + jaw * 1.7,
    ch: s.ch + w * 0.5 + wt * 0.5 + jaw * 1,
    jy: s.jy + chn * 0.5 + wt * 0.4,
    cy: s.cy + chn * 1.5 + wt * 0.3,
    nw: 11.2 + w * 3 + wt * 1.5,
    lean: clamp(0.55 - w * 0.35 - wt * 0.5 + chk * 0.35, 0, 1),
    soft: clamp(wt * 0.7 + w * 0.25, 0, 1),
    ey: 43, es: 7.5 + sv(look, 'esp') * 0.9, ez: 1 + sv(look, 'esz') * 0.14,
    by: 39.2 - sv(look, 'brh') * 1.3,
    ny: 53.2 + sv(look, 'nsl') * 1.3, nwid: (NOSE_W[look.nose] ?? 4.1) * 1.06 * (1 + sv(look, 'nsw') * 0.2),
    mwid: (MOUTH_W[look.mouth] ?? 5.1) * 1.1 * (1 + sv(look, 'mw') * 0.12), lipk: 1 + sv(look, 'lip') * 0.45,
  }
  G.my = 60.2 + sv(look, 'nsl') * 0.4 + chn * 0.35
  return G
}
// a shape mirrored down the middle: p0 on the middle line, segs the right side's curves down to the middle again
const pt = p => `${f1(p[0])} ${f1(p[1])}`
const mr = p => [100 - p[0], p[1]]
function sym(p0, segs) {
  let d = `M${pt(p0)}`
  for (const [a, b, c] of segs) d += `C${pt(a)} ${pt(b)} ${pt(c)}`
  for (let i = segs.length - 1; i >= 0; i--) { const [a, b] = segs[i]; d += `C${pt(mr(b))} ${pt(mr(a))} ${pt(mr(i ? segs[i - 1][2] : p0))}` }
  return d + 'Z'
}
function headD(G) {
  const { cw, cb, jw, jy, ch, cy, soft } = G
  return sym([50, TOP], [
    [[50 + cw * 0.62, TOP], [50 + cw + 0.2, TOP + 6.6], [50 + cw, 35]],
    [[50 + cw - 0.2, 39.4], [50 + cb, 43], [50 + cb, 47]],
    [[50 + cb, 51], [50 + jw + 0.5 + soft * 1.2, jy - 3], [50 + jw, jy]],
    [[50 + jw - 1.5 + soft * 0.8, jy + 2.6 + soft], [50 + ch + 2 + soft * 0.8, cy - 0.7], [50 + ch, cy - 0.2]],
    [[50 + ch - 1.3, cy + 0.35], [51.8, cy + 0.7], [50, cy + 0.7]],
  ])
}
// a cap of hair on the skull: t how far it stands off the skull, line the hairline's middle, side how far down the
// sides it comes, tc the temple corner (0 a line-up's square corner … 1 a soft round one), rec how far the temples go
// back (a receding line)
function capD(G, { t = 1, line = 27.6, side = 39, tc = 0.3, rec = 0 } = {}) {
  const { cw } = G, o = cw + 0.7 + t * 0.3
  const tx = 50 + cw - 2.4 - tc * 0.8 - rec * 1.4, ty = line + 2.2 - rec * 2.4
  return sym([50, TOP - t], [
    [[50 + o * 0.58, TOP - t], [50 + o, TOP + 8 - t * 0.4], [50 + o, side]],
    [[50 + o - 0.6, side], [50 + cw - 1.2, side], [50 + cw - 1.5, side - 0.4]],
    [[50 + cw - 1.6, side - 4], [tx + 0.6, ty + 3 + tc], [tx, ty]],
    [[tx - 1.2 - tc * 2, ty - 1.6 + rec * 0.4], [50 + 6, line - rec * 0.2], [50, line - 0.4 + rec * 0.6]],
  ])
}

// ── Drawing helpers ──────────────────────────────────────────────────────────
// a soft blob: an ellipse filled with one of the fading radial gradients (s shadow · h highlight · b blush · o the
// deep creases · c the cool rim)
function E(P, x, y, rx, ry, g, o = 1, rot = 0) {
  return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="url(#${P}${g})"${o < 1 ? ` opacity="${o2(o)}"` : ''}${rot ? ` transform="rotate(${f1(rot)} ${f1(x)} ${f1(y)})"` : ''}/>`
}
const rg = (id, c, a) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o2(a)}"/><stop offset=".5" stop-color="${c}" stop-opacity="${o2(a * 0.5)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
const lg = (id, stops, x2 = 0, y2 = 1, x1 = 0, y1 = 0) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${o2(a)}"` : ''}/>`).join('')}</linearGradient>`
const stroke = (d, c, w, o = 1, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${o < 1 ? ` opacity="${o2(o)}"` : ''}${extra}/>`
const fill = (d, c, o = 1, extra = '') => `<path d="${d}" fill="${c}"${o < 1 ? ` opacity="${o2(o)}"` : ''}${extra}/>`
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) }

// ── The features ─────────────────────────────────────────────────────────────
function eyeShape(look, G, s) {
  const cx = 50 + s * G.es, y = G.ey, ew = 3.1 * G.ez
  const eh = ({ almond: 1.45, round: 1.75, narrow: 1.1, hooded: 1.3, deep: 1.35, upturn: 1.4 }[look.eyes] ?? 1.45) * G.ez
  const tilt = look.eyes === 'upturn' ? 0.7 : look.eyes === 'almond' ? 0.25 : 0
  const I = [cx - s * ew, y + 0.25], O = [cx + s * ew, y - 0.1 - tilt]
  const up = [[I[0] + s * ew * 0.3, y - eh * 1.25], [cx + s * ew * 0.5, y - eh * 1.45 - tilt * 0.4], O]
  const lo = [[cx + s * ew * 0.55, y + eh * 0.92], [cx - s * ew * 0.45, y + eh * 0.98], I]
  const d = `M${pt(I)}C${pt(up[0])} ${pt(up[1])} ${pt(up[2])}C${pt(lo[0])} ${pt(lo[1])} ${pt(lo[2])}Z`
  return { cx, y, ew, eh, I, O, up, lo, d, tilt }
}
function eyesOf(look, G, T, P) {
  const A = [eyeShape(look, G, -1), eyeShape(look, G, 1)]
  const iris = look.iris ?? '#2b1a10'
  let under = '', s = ''
  for (const e of A) {
    const sd = e.cx < 50 ? -1 : 1, { cx, y, ew, eh, I, O, up } = e
    const deep = look.eyes === 'deep'
    // the socket under the brow, the lid catching light, the bag under the eye
    under += E(P, cx + sd * 0.4, y - 0.8, 5.4 * G.ez, (deep ? 4.2 : 3.4) * G.ez, 's', sd > 0 ? 0.85 : 0.6)
    under += E(P, cx - sd * 0.2, y - eh - 1.5, ew * 0.75, 0.9, 'h', sd > 0 ? 0.22 : 0.4)
    under += E(P, cx + sd * 0.3, y + eh + 1.3, ew * 0.95, 1.1, 's', 0.32 + clamp(((look.ag ?? 24) - 26) / 30, 0, 0.4))
  }
  // the whites, the irises (clipped to the whites), the lid's shadow on the ball, the catchlights
  s += A.map(e => fill(e.d, `url(#${P}w)`)).join('')
  s += `<g clip-path="url(#${P}E)">`
  for (const e of A) {
    const r = Math.min(e.eh * 1.05, 1.5) * (1 + (G.ez - 1) * 0.6), ix = e.cx + (e.cx < 50 ? 0.12 : -0.12), iy = e.y - 0.1
    s += `<circle cx="${f1(ix)}" cy="${f1(iy)}" r="${f1(r)}" fill="url(#${P}i)"/><circle cx="${f1(ix)}" cy="${f1(iy)}" r="${f1(r * 0.42)}" fill="#0a0706"/>`
    s += E(P, e.cx, e.y - e.eh * 1.05, e.ew * 1.1, e.eh * 0.85, 'o', 0.75)
    s += `<circle cx="${f1(ix - r * 0.38)}" cy="${f1(iy - r * 0.4)}" r="${f1(r * 0.24)}" fill="#fff" opacity=".9"/>`
  }
  s += '</g>'
  for (const e of A) {
    const sd = e.cx < 50 ? -1 : 1, { cx, y, ew, eh, I, O, up } = e
    // the upper lash line, heavier toward the outer corner, and its little flick
    const back = `C${pt([up[1][0], up[1][1] + 0.75])} ${pt([up[0][0], up[0][1] + 0.55])} ${pt([I[0] + sd * 0.3, I[1] + 0.15])}`
    s += fill(`M${pt(I)}C${pt(up[0])} ${pt(up[1])} ${pt([O[0] + sd * 0.55, O[1] + 0.05])}L${pt([O[0] - sd * 0.2, O[1] + 0.5])}${back}Z`, '#120a08', 0.95)
    // the crease above the lid (a hooded lid: the fold of skin over it)
    if (look.eyes === 'hooded') s += fill(`M${pt([I[0] - sd * 0.4, y - eh * 0.6])}Q${f1(cx)} ${f1(y - eh * 2.4)} ${pt([O[0] + sd * 0.9, O[1] - 0.2])}Q${f1(cx + sd * 0.4)} ${f1(y - eh * 1.25)} ${pt([I[0] - sd * 0.4, y - eh * 0.6])}Z`, T.sh, 0.85)
    else s += stroke(`M${pt([I[0] + sd * 0.5, y - eh * 1.05])}Q${f1(cx + sd * 0.3)} ${f1(y - eh * 2.15 - 0.4)} ${pt([O[0] + sd * 0.3, O[1] - eh * 0.75])}`, T.line, 0.45, 0.5)
    // the lower lid
    s += stroke(`M${pt([O[0] - sd * 0.3, O[1] + 0.35])}Q${f1(cx + sd * 0.2)} ${f1(y + eh * 1.12)} ${pt([I[0] + sd * 0.4, I[1] + 0.2])}`, T.line, 0.4, 0.45)
  }
  return { under, eyes: s, clip: A.map(e => `<path d="${e.d}"/>`).join('') }
}
function browsOf(look, G, P, T) {
  const c = look.brow ?? look.hc, cL = lum(c) < 60 ? mixC(c, '#6a6f7a', 0.35) : lite(c, 0.25)
  const t = ({ thick: 2.8, thin: 1.45, bushy: 3.2, straight: 2.25, arched: 2.1, angled: 2.35 }[look.brows] ?? 2.25)
  const arch = { arched: 1.8, angled: 1, straight: 0.45, thick: 0.6, thin: 0.8, bushy: 0.5 }[look.brows] ?? 0.6
  let s = '', grads = ''
  for (const sd of [-1, 1]) {
    const y = G.by, x0 = 50 + sd * 3.4, x1 = 50 + sd * (G.es + 3.1 * G.ez + 1.8), xp = x0 + (x1 - x0) * 0.6
    const inner = look.brows === 'angled' ? y + 0.9 : y + 0.3
    const d = `M${f1(x0)} ${f1(inner + t * 0.55)}C${f1(x0 + sd * 2.6)} ${f1(inner + t * 0.35)} ${f1(xp)} ${f1(y - arch + t * 0.45)} ${f1(x1)} ${f1(y + 1.6)}`
      + `C${f1(x1 - sd * 0.6)} ${f1(y + 0.2)} ${f1(xp + sd * 0.4)} ${f1(y - arch - t * 0.55)} ${f1(xp - sd * 1.2)} ${f1(y - arch - t * 0.5)}`
      + `C${f1(x0 + sd * 2.2)} ${f1(inner - t * 0.5)} ${f1(x0 - sd * 0.2)} ${f1(inner - t * 0.2)} ${f1(x0)} ${f1(inner + t * 0.55)}Z`
    const id = `${P}b${sd > 0 ? 'r' : 'l'}`
    grads += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f1(x0)}" y1="0" x2="${f1(x1)}" y2="0"><stop offset="0" stop-color="${c}" stop-opacity=".5"/><stop offset=".3" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".85"/></linearGradient>`
    s += fill(d, `url(#${id})`)
    // the hairs: upward at the inner end, along the brow beyond it
    let h = ''
    for (let i = 0; i < 3; i++) h += `M${f1(x0 + sd * (0.4 + i * 0.8))} ${f1(inner + t * 0.45)}l${f1(sd * 0.5)} ${f1(-t * 0.85)}`
    for (let i = 0; i < 2; i++) { const x = x0 + (x1 - x0) * (0.45 + i * 0.22); h += `M${f1(x - sd * 1.1)} ${f1(y - arch * (0.75 - i * 0.3) + 0.35)}l${f1(sd * 1.9)} -.25` }
    s += stroke(h, cL, 0.32, 0.6)
  }
  return { brows: s, grads }
}
function noseOf(look, G, T, P) {
  const y = G.ny - (look.nose === 'short' ? 0.9 : 0), w = G.nwid, top = G.ey + 0.6
  const kink = look.nose === 'boxer' ? 0.9 : 0
  let s = ''
  // the bridge: its lit plane, the shadow down its far side, the tip's ball and its specular
  s += E(P, 49.3 + kink * 0.4, (top + y) / 2, 1.15, (y - top) / 2 + 0.3, 'h', 0.55)
  s += E(P, 52.1 + kink * 0.2, y - 4.4, 1.5, 5.4, 's', 0.7, -6 - kink * 5)
  s += E(P, 47.6, y - 4.2, 1, 4.4, 's', 0.28, 6)
  if (kink) s += stroke(`M49.4 ${f1(top + 3.6)}l1.1 1.4-.4 1.6`, T.line, 0.45, 0.35)
  s += E(P, 50.4, y - 0.5, w * 0.62, 2.1, 's', 0.45)
  s += E(P, 49.4, y - 1.4, 1.4, 1.05, 'h', 0.9)
  // the wings, each a soft shade and the crease round it
  for (const sd of [-1, 1]) {
    s += E(P, 50 + sd * (w - 0.7), y - 0.3, 1.5, 1.7, 's', sd > 0 ? 0.6 : 0.35)
    s += stroke(`M${f1(50 + sd * (w - 0.5))} ${f1(y - 2.1)}C${f1(50 + sd * (w + 0.9))} ${f1(y - 0.9)} ${f1(50 + sd * (w + 0.4))} ${f1(y + 1.3)} ${f1(50 + sd * (w - 1.2))} ${f1(y + 1.25)}`, T.line, 0.6, sd > 0 ? 0.75 : 0.5)
  }
  // the nostrils and the shadow the nose throws down on the lip
  s += E(P, 50.3, y + 1.45, w * 0.78, 1.15, 'o', 0.55)
  for (const sd of [-1, 1]) s += `<ellipse cx="${f1(50 + sd * w * 0.42)}" cy="${f1(y + 1.05)}" rx="${f1(0.55 + w * 0.12)}" ry=".52" fill="${T.dk}" transform="rotate(${sd * 16} ${f1(50 + sd * w * 0.42)} ${f1(y + 1.05)})"/>`
  s += E(P, 51, y + 2.7, 3, 1.4, 's', 0.55)
  return s
}
function mouthOf(look, G, T, P) {
  const y = G.my, w = G.mwid, k = G.lipk
  const up = ({ full: 1.75, thin: 0.75, wide: 1.2, stern: 1, smirk: 1.2 }[look.mouth] ?? 1.25) * k, lo = ({ full: 2.5, thin: 1.25, wide: 1.8, stern: 1.6, smirk: 1.8 }[look.mouth] ?? 1.9) * k
  const rise = look.mouth === 'smirk' ? 1 : 0, drop = look.mouth === 'stern' ? 0.6 : 0
  const L = [50 - w, y + drop], R = [50 + w, y - rise + drop]
  let s = ''
  // the philtrum's ridge, the muzzle's light
  s += E(P, 49.6, (G.ny + y) / 2 + 0.6, 1.4, 1.9, 'h', 0.3)
  // the upper lip (turned down, in shade), the lower (turned up to the light), the line between, the corners
  s += fill(`M${pt(L)}C${f1(50 - w * 0.62)} ${f1(y - up * 0.55)} ${f1(50 - w * 0.34)} ${f1(y - up * 1.08)} 48.9 ${f1(y - up)}Q50 ${f1(y - up * 0.72)} 51.1 ${f1(y - up)}C${f1(50 + w * 0.34)} ${f1(y - up * 1.08)} ${f1(50 + w * 0.62)} ${f1(y - up * 0.55 - rise)} ${pt(R)}Q50 ${f1(y + 0.6)} ${pt(L)}Z`, T.lipU)
  s += fill(`M${f1(L[0] + 0.5)} ${f1(L[1] + 0.1)}C${f1(50 - w * 0.55)} ${f1(y + lo * 1.2)} ${f1(50 + w * 0.55)} ${f1(y + lo * 1.2 - rise * 0.3)} ${f1(R[0] - 0.5)} ${f1(R[1] + 0.1)}Q50 ${f1(y + 0.7)} ${f1(L[0] + 0.5)} ${f1(L[1] + 0.1)}Z`, T.lipL)
  s += E(P, 49.2, y + lo * 0.55, w * 0.4, lo * 0.32, 'h', 0.55)
  s += stroke(`M${pt(L)}Q${f1(50 - w * 0.5)} ${f1(y + 0.7)} 50 ${f1(y + 0.45)}Q${f1(50 + w * 0.5)} ${f1(y + 0.7 - rise * 0.6)} ${pt(R)}`, T.dk, 0.7)
  s += E(P, L[0] - 0.2, L[1] + 0.2, 0.9, 0.8, 'o', 0.6) + E(P, R[0] + 0.2, R[1] + 0.2, 0.9, 0.8, 'o', 0.6)
  // the shadow under the lower lip
  s += E(P, 50.4, y + lo * 1.25 + 1.2, w * 0.8, 1.3, 's', 0.6)
  return s
}
// the years: smile lines, forehead lines, crow's feet, a heavier jaw
function linesOf(look, G, T, P) {
  const ag = look.ag ?? 24
  if (ag < 26) return ''
  const k = clamp((ag - 23) / 26, 0, 1), y = G.ny, my = G.my
  let s = ''
  for (const sd of [-1, 1]) {
    s += stroke(`M${f1(50 + sd * (G.nwid + 0.9))} ${f1(y - 1)}C${f1(50 + sd * (G.nwid + 2.8))} ${f1(y + 1.6)} ${f1(50 + sd * (G.mwid + 1.8))} ${f1(my - 2)} ${f1(50 + sd * (G.mwid + 1.2))} ${f1(my + 0.8)}`, T.line, 0.5 + k * 0.2, 0.12 + k * 0.22)
    if (sd < 0) s += stroke(`M${f1(50 - G.nwid - 1.9)} ${f1(y - 1.2)}C${f1(50 - G.nwid - 4)} ${f1(y + 2)} ${f1(50 - G.mwid - 3.2)} ${f1(my - 1)} ${f1(50 - G.mwid - 2.4)} ${f1(my + 2.4)}`, T.spec, 0.6, 0.08 + k * 0.1)
  }
  if (ag >= 34 && !look.cap) s += stroke(`M43 30.6Q50 29.4 57 30.6M44.6 33.2Q50 32.2 55.4 33.2${ag >= 52 ? 'M45.6 28Q50 27.1 54.4 28' : ''}`, T.line, 0.5, 0.15 + k * 0.35)
  if (ag >= 45) {
    for (const sd of [-1, 1]) {
      const x = 50 + sd * (G.es + 3.6)
      s += stroke(`M${f1(x)} ${f1(G.ey - 1)}l${f1(sd * 1.6)} -.7M${f1(x + sd * 0.2)} ${f1(G.ey + 0.6)}l${f1(sd * 1.6)} .4`, T.line, 0.45, 0.4 * k)
      s += E(P, 50 + sd * (G.jw - 1.5), G.jy + 1.5, 3, 4, 's', 0.3 * k)
    }
  }
  return s
}

// ── Facial hair ──────────────────────────────────────────────────────────────
// the beard's ground: its outer edge on the head's own edge (a touch outside it) from the sideburns round the jaw,
// past the chin by its length; its edge on the cheek a diagonal from the sideburn to the corner of the mouth (cl: 0 a
// high, full cheek line … 1 a low one), then under the lower lip
function beardArea(G, len, cl) {
  const { cw, cb, jw, jy, ch, cy, my, mwid, soft } = G
  const by = cy + len, bw = ch + 0.8 + len * 0.12, lo = len > 5 ? 1.6 : 0
  const segs = [
    [[50 + cw + 0.2, 42], [50 + cb + 0.4, 44.2], [50 + cb + 0.35, 47]],
    [[50 + cb + 0.35, 51.2], [50 + jw + 0.9 + soft * 1.2, jy - 3], [50 + jw + 0.45, jy + 0.2]],
    [[50 + jw - 1 + soft * 0.8, jy + 3 + len * 0.5], [50 + bw + 2.2, by - 0.6], [50 + bw, by]],
    [[50 + bw - 1.4, by + 0.4 + lo], [51.8, by + 0.8 + lo], [50, by + 0.8 + lo]],
  ]
  let d = `M${f1(50 + cw + 0.35)} 38.6`
  for (const [a, b, c] of segs) d += `C${pt(a)} ${pt(b)} ${pt(c)}`
  for (let i = segs.length - 1; i >= 0; i--) { const [a, b] = segs[i]; d += `C${pt(mr(b))} ${pt(mr(a))} ${pt(mr(i ? segs[i - 1][2] : [50 + cw + 0.35, 38.6]))}` }
  const ix = cw - 1.8, mx = mwid + 1.3
  const side = sd => [[50 + sd * (ix - cl * 1.4), 44 + cl * 4], [50 + sd * (mx + 3.2 - cl), my - 5.4 + cl * 2], [50 + sd * mx, my - 1.2]]
  const [a, b, c] = side(-1)
  d += `L${f1(50 - ix)} 38.6C${pt(a)} ${pt(b)} ${pt(c)}`
  d += `C${f1(50 - mwid - 0.6)} ${f1(my + 1.8)} 47.6 ${f1(my + 2.5)} 50 ${f1(my + 2.5)}C52.4 ${f1(my + 2.5)} ${f1(50 + mwid + 0.6)} ${f1(my + 1.8)} ${pt([50 + mx, my - 1.2])}`
  const [a2, b2] = side(1)
  return d + `C${pt(b2)} ${pt(a2)} ${f1(50 + ix)} 38.6Z`
}
function hairTones(hc) {
  const dark = lum(hc) < 70
  return { hc, hD: shade(hc, dark ? 0.45 : 0.4), hL: dark ? mixC(hc, '#8592a8', 0.34) : lite(hc, 0.3) }
}
function beardOf(look, G, T, P) {
  const hc = look.bc ?? look.brow ?? look.hc, { hD, hL } = hairTones(hc), { cy, my, jw, jy, ch, mwid } = G
  // the hair's grain: short strokes down the jaw and the chin, light on the lit side, dark on the far
  const grain = len => {
    let d = '', e = ''
    for (let i = 0; i < 13; i++) {
      const a = -1 + i / 6, x = 50 + a * (jw - 1), yy = jy + (cy - jy) * (1 - a * a) + len * 0.55 - 2.6
      const l = 1.8 + len * 0.3, k = `M${f1(x)} ${f1(yy - l)}l${f1(a * 0.5)} ${f1(l)}`
      if (a < 0.15) d += k; else e += k
    }
    return stroke(d, hL, 0.38, 0.6) + stroke(e, hD, 0.42, 0.7)
  }
  const body = (len, cl) => {
    const id = `${P}B`
    return `<defs><path id="${id}" d="${beardArea(G, len, cl)}"/><clipPath id="${P}Q"><use href="#${id}"/></clipPath></defs>`
      + `<use href="#${id}" fill="none" stroke="${hc}" stroke-width="1.6" opacity=".3"/><use href="#${id}" fill="url(#${P}a)"/><g clip-path="url(#${P}Q)">${grain(len)}${E(P, 50, cy + len * 0.5, ch + 2.4, 2 + len * 0.3, 'c', 0.35)}${E(P, 50 + jw * 0.8, jy + 2, 5, 9, 'o', 0.35)}</g>`
  }
  switch (look.beard) {
    case 'stubble': {
      // a shadow of hair, not a shape: low, soft at its edges, cool on fair skin
      const c = lum(hc) < 90 && T.d < 0.5 ? mixC(hc, '#4d5566', 0.35) : hc, d = beardArea(G, 0.3, 0.8) + `M${f1(50 - mwid - 0.4)} ${f1(my - 0.8)}C${f1(50 - mwid + 0.4)} ${f1(G.ny + 2.8)} 47 ${f1(G.ny + 2.2)} 50 ${f1(G.ny + 2.4)}C53 ${f1(G.ny + 2.2)} ${f1(50 + mwid - 0.4)} ${f1(G.ny + 2.8)} ${f1(50 + mwid + 0.4)} ${f1(my - 0.8)}Q50 ${f1(my - 1.6)} ${f1(50 - mwid - 0.4)} ${f1(my - 0.8)}Z`
      return `<path d="${d}" fill="${c}" stroke="${c}" stroke-width="1.4" stroke-opacity=".35" opacity="${T.d > 0.6 ? 0.36 : 0.2}"/>`
    }
    case 'short': return body(1, 0.75)
    case 'full': return body(3.4, 0.2)
    case 'long': return body(9, 0.1) + stroke(`M46 ${f1(cy + 3)}q.4 3 1 6.4M50 ${f1(cy + 4)}v7.4M54 ${f1(cy + 3)}q-.4 3-1 6.4`, hL, 0.5, 0.5)
    case 'chin':
      // a strap along the jaw line, sideburn to sideburn: the jaw's edge, the inner half of a wide line
      return `<g clip-path="url(#${P}C)">${stroke(`M${f1(50 - G.cw)} 38.6C${f1(50 - G.cw)} 44 ${f1(50 - G.cb)} 45 ${f1(50 - G.cb)} 48C${f1(50 - G.cb)} 52 ${f1(50 - jw - 0.5)} ${f1(jy - 3)} ${f1(50 - jw)} ${f1(jy)}C${f1(50 - jw + 1.5)} ${f1(jy + 3)} ${f1(50 - ch - 2)} ${f1(cy - 0.6)} 50 ${f1(cy + 0.4)}C${f1(50 + ch + 2)} ${f1(cy - 0.6)} ${f1(50 + jw - 1.5)} ${f1(jy + 3)} ${f1(50 + jw)} ${f1(jy)}C${f1(50 + jw + 0.5)} ${f1(jy - 3)} ${f1(50 + G.cb)} 52 ${f1(50 + G.cb)} 48C${f1(50 + G.cb)} 45 ${f1(50 + G.cw)} 44 ${f1(50 + G.cw)} 38.6`, `url(#${P}a)`, 4.4)}</g>`
    case 'goatee': {
      const w = mwid + 0.5
      const d = `M${f1(50 - w)} ${f1(my + 0.6)}C${f1(50 - w)} ${f1(cy)} 47 ${f1(cy + 2.4)} 50 ${f1(cy + 2.4)}C53 ${f1(cy + 2.4)} ${f1(50 + w)} ${f1(cy)} ${f1(50 + w)} ${f1(my + 0.6)}C${f1(50 + w - 1.4)} ${f1(my + 2.6)} 51.6 ${f1(my + 2.9)} 50 ${f1(my + 2.9)}C48.4 ${f1(my + 2.9)} ${f1(50 - w + 1.4)} ${f1(my + 2.6)} ${f1(50 - w)} ${f1(my + 0.6)}Z`
      return fill(d, `url(#${P}a)`) + stroke(`M47.4 ${f1(cy - 1.4)}l.3 2.6M50 ${f1(cy - 1)}v2.8M52.6 ${f1(cy - 1.4)}l-.3 2.6`, hL, 0.4, 0.5)
    }
    case 'patch': return fill(`M48.5 ${f1(my + 2.9)}Q50 ${f1(my + 2.4)} 51.5 ${f1(my + 2.9)}L50.9 ${f1(my + 5.8)}Q50 ${f1(my + 6.4)} 49.1 ${f1(my + 5.8)}Z`, `url(#${P}a)`)
    default: return ''
  }
}
function stacheOf(look, G, P) {
  const hc = look.bc ?? look.brow ?? look.hc, { hL } = hairTones(hc), y = G.my - 1.9 * G.lipk + 0.2, w = G.mwid
  switch (look.stache) {
    case 'thin': return fill(`M${f1(50 - w + 0.6)} ${f1(y + 0.5)}Q50 ${f1(y - 1.4)} ${f1(50 + w - 0.6)} ${f1(y + 0.5)}Q50 ${f1(y - 0.3)} ${f1(50 - w + 0.6)} ${f1(y + 0.5)}Z`, hc, 0.9)
    case 'full': return fill(`M${f1(50 - w - 0.8)} ${f1(y + 1.6)}C${f1(50 - w)} ${f1(y - 1.4)} 47.6 ${f1(y - 2.4)} 50 ${f1(y - 1.5)}C52.4 ${f1(y - 2.4)} ${f1(50 + w)} ${f1(y - 1.4)} ${f1(50 + w + 0.8)} ${f1(y + 1.6)}C${f1(50 + w - 2)} ${f1(y + 0.6)} ${f1(50 - w + 2)} ${f1(y + 0.6)} ${f1(50 - w - 0.8)} ${f1(y + 1.6)}Z`, `url(#${P}a)`)
      + stroke(`M46 ${f1(y - 0.8)}l-.8 1.6M48 ${f1(y - 1.2)}l-.5 1.7M52 ${f1(y - 1.2)}l.5 1.7M54 ${f1(y - 0.8)}l.8 1.6`, hL, 0.35, 0.55)
    case 'horseshoe': return fill(`M${f1(50 - w - 0.6)} ${f1(y + 1.4)}C${f1(50 - w)} ${f1(y - 1.4)} 47.6 ${f1(y - 2.3)} 50 ${f1(y - 1.4)}C52.4 ${f1(y - 2.3)} ${f1(50 + w)} ${f1(y - 1.4)} ${f1(50 + w + 0.6)} ${f1(y + 1.4)}L${f1(50 + w + 0.9)} ${f1(G.my + 6)}L${f1(50 + w - 0.7)} ${f1(G.my + 6)}L${f1(50 + w - 0.8)} ${f1(y + 1.8)}C52 ${f1(y + 0.6)} 48 ${f1(y + 0.6)} ${f1(50 - w + 0.8)} ${f1(y + 1.8)}L${f1(50 - w + 0.7)} ${f1(G.my + 6)}L${f1(50 - w - 0.9)} ${f1(G.my + 6)}Z`, `url(#${P}a)`)
    default: return ''
  }
}

// ── Hair ─────────────────────────────────────────────────────────────────────
// every cut is built from a few pieces: the faded sides (a gradient from the hair down to the skin), the mass on top
// (the hair gradient, lit from above), a sheen where the light catches it, and its texture (coils, waves, rows, ropes)
function hairParts(look, G, T, P) {
  const { hair } = look, { cw } = G, L = 50 - cw, R = 50 + cw
  const { hc, hD, hL } = hairTones(look.hc === '#b8893c' ? '#16110e' : look.hc)
  const tips = look.hc === '#b8893c' ? '#c99a48' : null
  const front = [], back = []
  // the mass on top, kept as a shape its texture is clipped to
  const massD = (d, f = 'a') => `<defs><path id="${P}m" d="${d}"/><clipPath id="${P}H"><use href="#${P}m"/></clipPath></defs><use href="#${P}m" fill="url(#${P}${f})"/>`
  const mass = (o, f = 'a') => massD(capD(G, o), f)
  const tex = (...a) => `<g clip-path="url(#${P}H)">${a.join('')}</g>`
  const fadeSides = (o = {}) => fill(capD(G, { t: 0.3, line: 27.8, side: 46, tc: 0, ...o }), `url(#${P}f)`)
  // the light catching the top of the hair: a soft cool sheen
  const sheen = (t, o = 0.5) => E(P, 50 - cw * 0.28, TOP + 2.2 - t, cw * 0.5, 2.4, 'c', o, -8)
  const lineUp = (line = 27.6) => stroke(`M${f1(R - 2.4)} ${f1(line + 2.2)}L${f1(R - 3.2)} ${f1(line + 0.3)}Q50 ${f1(line - 0.8)} ${f1(L + 3.2)} ${f1(line + 0.3)}L${f1(L + 2.4)} ${f1(line + 2.2)}`, hD, 0.5, 0.7)
  // a rope (a loc, a twist, a braid): dark under, the hair, a lighter broken line down it
  const ropes = (d, w, dash) => stroke(d, hD, w + 0.7) + stroke(d, hc, w) + stroke(d, hL, w * 0.45, 0.55, ` stroke-dasharray="${dash}"`)
  // tight coils: a scatter of little arcs
  const coils = (x0, x1, y0, y1, n, o = 0.55) => {
    let d = ''
    for (let i = 0; i < n; i++) {
      const u = (i * 0.7548777 + 0.31) % 1, v = (i * 0.5698403 + 0.13) % 1, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * v
      d += `M${f1(x)} ${f1(y)}q.6 -.9 1.4 0`
    }
    return stroke(d, hL, 0.45, o)
  }
  // a coily cut's edge: little bumps of hair along the top of the mass (t how far it stands off the skull)
  const bumps = (t, n = 13, r = 1.5) => {
    let c = ''
    const rx = cw + 0.5 + t * 0.3, ry = 13.4 + t, y0 = TOP + 13.4
    for (let i = 0; i < n; i++) { const a = Math.PI * (1.1 + (0.8 * i) / (n - 1)); c += `<circle cx="${f1(50 + Math.cos(a) * rx)}" cy="${f1(y0 + Math.sin(a) * ry)}" r="${r}"/>` }
    return `<g fill="url(#${P}a)">${c}</g>`
  }
  // a cut with a shaped edge: the outer edge over the dome in clumps (n of them, each swept one way and standing amp
  // off the dome), the hairline across the forehead in smaller clumps hanging fr below it (fn of them), the temples
  // down to side; lift raises the right side (a side part's volume)
  const spiky = ({ t = 2, line = 27.4, side = 33, n = 11, amp = 1.2, fn = 8, fr = 0.9, lift = 0, sweep = 1 }) => {
    const rx = cw + 0.7 + t * 0.3, ry = 13.4 + t, y0 = TOP + 13.4
    const at = (a, k = 0) => [50 + Math.cos(a) * (rx + k), y0 + Math.sin(a) * (ry + k) - lift * Math.max(0, Math.cos(a) + 0.4)]
    let d = `M${f1(L - 0.6)} ${f1(side)}L${pt(at(Math.PI))}`
    for (let i = 0; i < n; i++) {
      const a1 = Math.PI * (1 + (i + 1) / n), am = Math.PI * (1 + (i + 0.5 + sweep * 0.3) / n)
      const k = amp * (0.7 + ((i * 7) % 5) / 8)
      d += `L${pt(at(am, k))}Q${pt(at((am + a1) / 2, k * 0.5))} ${pt(at(a1))}`
    }
    const yl = x => line + ((x - 50) / cw) ** 2 * 1.8
    const xr = R - 2.8, xl = L + 2.8
    d += `L${f1(R + 0.6)} ${f1(side)}L${f1(R - 1.5)} ${f1(side)}C${f1(R - 1.6)} ${f1(side - 4)} ${f1(R - 2.4)} ${f1(yl(xr) + 3)} ${f1(xr)} ${f1(yl(xr) + 1)}`
    for (let j = 0; j < fn; j++) {
      const xb = xr - ((xr - xl) * (j + 1)) / fn, xm = xr - ((xr - xl) * (j + 0.5 + sweep * 0.25)) / fn
      const k = fr * (0.7 + ((j * 5) % 3) / 4)
      d += `L${f1(xm)} ${f1(yl(xm) + k)}Q${f1((xm + xb) / 2)} ${f1(yl(xb) + k * 0.3)} ${f1(xb)} ${f1(yl(xb) - 0.3)}`
    }
    return d + `C${f1(L + 2.4)} ${f1(yl(xl) + 3)} ${f1(L + 1.6)} ${f1(side - 4)} ${f1(L + 1.5)} ${f1(side)}Z`
  }
  // clumped ends along an edge from a to b: n tips, each pushed by (dx, dy)
  const tipsE = (a, b, n, dx, dy) => {
    let d = ''
    const lp = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
    for (let i = 0; i < n; i++) {
      const m = lp((i + 0.45) / n), p1 = lp((i + 1) / n), k = 0.75 + ((i * 5) % 3) / 4, tip = [m[0] + dx * k, m[1] + dy * k]
      d += `L${pt(tip)}Q${pt([(tip[0] + p1[0]) / 2 + dx * 0.15, (tip[1] + p1[1]) / 2 + dy * 0.15])} ${pt(p1)}`
    }
    return d
  }
  switch (hair) {
    case 'shaved':
      front.push(fill(capD(G, { t: 0, line: 27.8, side: 44, tc: 0 }), hc, T.d > 0.6 ? 0.18 : 0.12))
      break
    case 'buzz':
      front.push(mass({ t: 0.4, line: 27.6, side: 43, tc: 0.4 }, 'z'), tex(coils(L + 3, R - 4, TOP, 30, 20, 0.3)), lineUp())
      break
    case 'crew':
      front.push(fadeSides(), massD(spiky({ t: 2, line: 27.2, side: 32, n: 13, amp: 0.9, fn: 9, fr: 1, sweep: 1 })))
      front.push(tex(stroke(`M42 29l-.6-2.8M44.6 28.4l-.5-3M47.4 28l-.4-3.1M50.2 27.8l-.2-3.2M53 28l.2-3.1M55.8 28.4l.4-3M58.4 29l.5-2.8M40 24.4l-.4-3M45.2 22.6l-.2-3.2M50.6 22l.1-3.3M55.8 22.6l.3-3.2`, hD, 0.55, 0.65), stroke(`M43.4 26.4l-.4-2.6M46 25.6l-.3-2.8M48.8 25.2l-.1-2.9M51.6 25.2l.1-2.9M54.4 25.6l.3-2.8M57 26.4l.4-2.6`, hL, 0.45, 0.6), sheen(2)))
      break
    case 'fade':
      front.push(fadeSides(), mass({ t: 2.2, line: 27.6, side: 31, tc: 0 }), bumps(1.6), tex(coils(L + 3, R - 4, TOP - 2.4, 28, 30), sheen(2.4, 0.35)), lineUp())
      break
    case 'frohawk':
      front.push(fadeSides({ side: 46 }))
      front.push(fill(`M${f1(L + 7)} 29C${f1(L + 5.4)} 16 ${f1(L + 7)} 8.2 50 7.4C${f1(R - 7)} 8.2 ${f1(R - 5.4)} 16 ${f1(R - 7)} 29Q50 26.8 ${f1(L + 7)} 29Z`, `url(#${P}a)`), coils(L + 8, R - 9, 9, 26, 22, 0.6), stroke(`M45 11Q48 8.6 52 9`, hL, 1.2, 0.4))
      break
    case 'waves':
      front.push(fadeSides({ side: 44 }), mass({ t: 1, line: 27.6, side: 33, tc: 0 }), lineUp())
      {
        let d = ''
        // 360 waves: rings of ripples round the crown, each a light crest over a dark trough
        let e = ''
        for (let i = 0; i < 6; i++) {
          const ry = 2.4 + i * 2.1, rx = 5 + i * 2.7, n = 3 + i
          let w = `M${f1(50 - rx)} ${f1(TOP + ry + 1.4)}`
          for (let j = 1; j <= n * 2; j++) { const x = 50 - rx + (2 * rx * j) / (n * 2), xm = x - rx / (n * 2), u = (x - 50) / rx, um = (xm - 50) / rx; w += `Q${f1(xm)} ${f1(TOP + ry + 1.4 * um * um - (j % 2 ? 0.8 : -0.8))} ${f1(x)} ${f1(TOP + ry + 1.4 * u * u)}` }
          d += w; e += w.replace(/(\d) (\d+(\.\d)?)/g, (m, a, b) => `${a} ${f1(+b + 0.9)}`)
        }
        front.push(tex(stroke(e, hD, 0.8, 0.7), stroke(d, hL, 0.7, 0.75), sheen(1, 0.3)))
      }
      break
    case 'sidepart':
      front.push(fadeSides({ side: 44 }), massD(spiky({ t: 3.2, line: 26.6, side: 33, n: 6, amp: 1.5, fn: 5, fr: 1.2, lift: 2.2, sweep: 1 })))
      front.push(tex(stroke(`M43.4 ${TOP - 3}Q42 ${TOP + 3} 43 ${TOP + 10}`, hD, 0.8, 0.85),
        stroke(`M45.4 ${TOP - 2.6}Q55 ${TOP - 3.4} ${f1(R - 1)} ${TOP + 6}M45.8 ${TOP + 0.6}Q55 ${TOP - 0.8} ${f1(R - 2)} ${TOP + 10}M46.2 ${TOP + 4}Q55 ${TOP + 2.4} ${f1(R - 3)} ${TOP + 12.4}M46.6 ${TOP + 7.2}Q54 ${TOP + 5.6} ${f1(R - 4)} ${TOP + 13.4}`, hL, 0.55, 0.5),
        stroke(`M45.6 ${TOP - 1}Q55 ${TOP - 1.8} ${f1(R - 1.6)} ${TOP + 8}M46 ${TOP + 2.4}Q55 ${TOP + 1} ${f1(R - 2.6)} ${TOP + 11.4}M46.4 ${TOP + 5.6}Q55 ${TOP + 4} ${f1(R - 3.6)} ${TOP + 13}`, hD, 0.5, 0.55),
        stroke(`M41.6 ${TOP - 1}Q${f1(L + 1.6)} ${TOP + 3} ${f1(L + 0.6)} 31M39.6 ${TOP + 3}Q${f1(L + 2)} ${TOP + 7} ${f1(L + 1.6)} 31`, hL, 0.45, 0.4), sheen(3.4, 0.45)))
      break
    case 'textured':
      front.push(fadeSides({ side: 44 }), massD(spiky({ t: 3.4, line: 27, side: 32, n: 8, amp: 2.2, fn: 6, fr: 2.4, sweep: -1 })))
      front.push(tex(stroke(`M42 ${TOP - 1}l-1.2 8M46 ${TOP - 2.6}l-.8 9.4M50.6 ${TOP - 3}l.2 9M55 ${TOP - 2.4}l1 9M59 ${TOP - 0.6}l1.2 8`, hD, 0.55, 0.6), stroke(`M44 ${TOP - 1.8}l-.8 7.6M48.4 ${TOP - 2.8}l-.3 8M53 ${TOP - 2.8}l.6 8M57.4 ${TOP - 1.4}l1 7.6`, hL, 0.5, 0.55), sheen(4, 0.4)))
      break
    case 'curly': {
      front.push(fadeSides({ side: 44 }), mass({ t: 1.6, line: 28, side: 32, tc: 0.8 }))
      const pts = [[L + 3, 27.4], [L + 5, 22.6], [L + 8.6, 19], [44.6, 16.6], [50, 15.6], [55.4, 16.6], [R - 8.6, 19], [R - 5, 22.6], [R - 3, 27.4], [45, 22.4], [50.2, 21], [55.4, 22.4], [42, 26.6], [47.4, 26.6], [52.8, 26.6], [58.2, 26.6]]
      let c = '', h = '', dk = ''
      for (const [x, y] of pts) {
        c += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.9"/>`
        h += `M${f1(x - 1.7)} ${f1(y - 0.2)}q1.2 -1.9 3 -.6`
        dk += `M${f1(x - 1)} ${f1(y + 1.9)}q1.6 .7 2.8 -.9`
      }
      front.push(`<g fill="url(#${P}a)">${c}</g>`, stroke(dk, hD, 0.6, 0.6), stroke(h, hL, 0.5, 0.6))
      break
    }
    case 'afro': {
      // a round mass with a soft, bumpy edge, lit from above, darker where it meets the face
      const rx = cw + 7.2, ry = cw + 3.6, cx = 50, cy = 25
      let d = ''
      const n = 22
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * (0.92 + (1.16 * i) / n), a2 = Math.PI * (0.92 + (1.16 * (i - 0.5)) / n)
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry
        d += i ? `Q${f1(cx + Math.cos(a2) * rx * 1.07)} ${f1(cy + Math.sin(a2) * ry * 1.07)} ${f1(x)} ${f1(y)}` : `M${f1(x)} ${f1(y)}`
      }
      d += `C${f1(R + 6)} 40 ${f1(R + 2)} 42 ${f1(R)} 42L${f1(L)} 42C${f1(L - 2)} 42 ${f1(L - 6)} 40 ${f1(cx + Math.cos(Math.PI * 0.92) * rx)} ${f1(cy + Math.sin(Math.PI * 0.92) * ry)}Z`
      back.push(fill(d, `url(#${P}a)`), coils(cx - rx + 3, cx + rx - 4, cy - ry + 2, 36, 46, 0.5))
      front.push(mass({ t: 1, line: 28, side: 40, tc: 1 }), tex(coils(L + 3, R - 4, TOP - 1, 30, 18, 0.45)), E(P, 50, 28.4, cw - 2, 1.6, 'o', 0.5))
      break
    }
    case 'hightop':
      front.push(fadeSides({ side: 45 }))
      front.push(fill(`M${f1(L + 1.4)} 31L${f1(L + 2.2)} 7.4Q${f1(L + 2.4)} 5 ${f1(L + 5)} 5L${f1(R - 5)} 5Q${f1(R - 2.4)} 5 ${f1(R - 2.2)} 7.4L${f1(R - 1.4)} 31C${f1(R - 3)} 29 ${f1(R - 5)} 27.6 ${f1(50 + 6)} 27.4L50 27.2L${f1(50 - 6)} 27.4C${f1(L + 5)} 27.6 ${f1(L + 3)} 29 ${f1(L + 1.4)} 31Z`, `url(#${P}a)`), coils(L + 3, R - 4, 6, 26, 30, 0.5), lineUp(27.4))
      front.push(stroke(`M${f1(L + 2.6)} 6.4H${f1(R - 2.6)}`, hL, 0.9, 0.5))
      break
    case 'twists': case 'locs': {
      const long = hair === 'locs'
      front.push(fadeSides({ side: long ? 40 : 45 }), mass({ t: 0.8, line: 27.8, side: long ? 40 : 31, tc: 0.4 }))
      // on top: ropes from the hairline up and back over the skull, each tipped out from the middle
      const n = long ? 9 : 11, span = cw - 2.2
      let d = '', t = ''
      for (let i = 0; i < n; i++) {
        const x = 50 - span + (2 * span * i) / (n - 1), dx = (x - 50) / cw, ys = 27.4 + dx * dx * 2
        const len = long ? 9.6 : 7.4, tx = x + dx * 5.4, ty = ys - len + dx * dx * 4
        d += `M${f1(x)} ${f1(ys)}Q${f1(x + dx * 1.6)} ${f1(ys - len * 0.6)} ${f1(tx)} ${f1(ty)}`
        if (tips) t += `M${f1(x + (tx - x) * 0.8)} ${f1(ys + (ty - ys) * 0.8)}L${f1(tx)} ${f1(ty)}`
      }
      if (long) {
        // the locs fall behind the ears to the shoulders, two in front of each shoulder
        let b = '', bt = ''
        for (const [x, y1, bend] of [[L - 3.6, 74, -2], [L - 0.6, 78, -1], [L + 2, 70, 0], [R - 2, 70, 0], [R + 0.6, 78, 1], [R + 3.6, 74, 2]]) {
          b += `M${f1(x - bend * 0.3)} 24Q${f1(x + bend)} ${f1((24 + y1) / 2)} ${f1(x + bend * 0.4)} ${f1(y1)}`
          if (tips) bt += `M${f1(x + bend * 0.5)} ${f1(y1 - 6)}L${f1(x + bend * 0.4)} ${f1(y1)}`
        }
        back.push(ropes(b, 2.5, '1 .7'))
        if (tips) back.push(stroke(bt, tips, 2.4))
      }
      front.push(ropes(d, long ? 2.4 : 2.1, long ? '1 .7' : '.8 .8'))
      if (tips) front.push(stroke(t, tips, long ? 2.2 : 2))
      break
    }
    case 'cornrows': {
      front.push(fill(capD(G, { t: 0.6, line: 27.6, side: 40, tc: 0.4 }), mixC(look.skin, hc, 0.7)))
      let d = ''
      for (const x of [L + 2.6, L + 6.6, 45.4, 50, 54.6, R - 6.6, R - 2.6]) d += `M${f1(x)} 28.4Q${f1((x + 50) / 2 + (x - 50) * 0.3)} ${f1(21)} ${f1(50 + (x - 50) * 0.45)} ${f1(TOP - 0.6)}`
      front.push(ropes(d, 2.5, '.9 .5'))
      const b = `M${f1(L + 1.6)} 40Q${f1(L + 0.6)} 56 ${f1(L + 1.4)} 72M${f1(L + 4.6)} 42Q${f1(L + 4)} 58 ${f1(L + 4.6)} 74M${f1(R - 1.6)} 40Q${f1(R - 0.6)} 56 ${f1(R - 1.4)} 72M${f1(R - 4.6)} 42Q${f1(R - 4)} 58 ${f1(R - 4.6)} 74`
      back.push(ropes(b, 2.4, '.9 .5'))
      break
    }
    case 'flow': case 'mullet': case 'long': {
      const to = hair === 'long' ? 79 : hair === 'flow' ? 62 : 72
      // behind: the hair falling to the neck (or the shoulders), its ends in clumps
      back.push(fill(`M${f1(L - 2.6)} 38C${f1(L - 3.6)} 22 ${f1(50 - cw * 0.6)} ${TOP - 3} 50 ${TOP - 3}C${f1(50 + cw * 0.6)} ${TOP - 3} ${f1(R + 3.6)} 22 ${f1(R + 2.6)} 38L${f1(R + 3.4)} ${to - 5}`
        + tipsE([R + 3.4, to - 5], [R - 2.6, to - 3], 3, 0.6, 2.6) + `L${f1(R - 3)} 50L${f1(L + 3)} 50L${f1(L + 2.6)} ${to - 3}` + tipsE([L + 2.6, to - 3], [L - 3.4, to - 5], 3, -0.6, 2.6) + 'Z', `url(#${P}a)`))
      back.push(stroke(`M${f1(L - 1.6)} 40Q${f1(L - 2.8)} 52 ${f1(L - 1.4)} ${to - 4}M${f1(R + 1.6)} 40Q${f1(R + 2.8)} 52 ${f1(R + 1.4)} ${to - 4}`, hL, 0.6, 0.35) + stroke(`M${f1(L + 0.4)} 44Q${f1(L - 0.6)} 54 ${f1(L + 0.6)} ${to - 5}M${f1(R - 0.4)} 44Q${f1(R + 0.6)} 54 ${f1(R - 0.6)} ${to - 5}`, hD, 0.6, 0.5))
      if (hair === 'mullet') {
        front.push(fadeSides({ side: 44 }), massD(spiky({ t: 2.4, line: 27.2, side: 34, n: 10, amp: 1.1, fn: 7, fr: 1.4, sweep: -1 })), tex(stroke(`M44 ${TOP}l-.6 8M49 ${TOP - 1}l-.2 8.6M54 ${TOP - 0.6}l.6 8.4`, hL, 0.5, 0.5), sheen(2.4, 0.4)))
        break
      }
      // in front: the top, parted, falling past the temples in two curtains with clumped ends
      const sy = hair === 'long' ? 51 : 45, part = hair === 'long' ? 50 : 47.6
      const d = `M${f1(L - 1)} ${sy}C${f1(L - 2)} ${TOP + 4} ${f1(50 - cw * 0.62)} ${TOP - 3.4} 50 ${TOP - 3.4}C${f1(50 + cw * 0.62)} ${TOP - 3.4} ${f1(R + 2)} ${TOP + 4} ${f1(R + 1)} ${sy}`
        + tipsE([R + 1, sy], [R - 2.2, sy - 3.6], 2, -0.2, 2.2)
        + `C${f1(R - 2.6)} 35 ${f1(R - 4)} 28.6 ${f1(part + 7)} 27.8C${f1(part + 3)} 27.4 ${f1(part + 0.6)} 26.4 ${f1(part)} 24.6C${f1(part - 1.4)} 27 ${f1(part - 4)} 27.8 ${f1(L + 5)} 29.8C${f1(L + 2.8)} 31.6 ${f1(L + 2.2)} 36 ${f1(L + 2.2)} ${f1(sy - 3.6)}`
        + tipsE([L + 2.2, sy - 3.6], [L - 1, sy], 2, 0.2, 2.2) + 'Z'
      front.push(massD(d))
      front.push(tex(stroke(`M${part} ${TOP - 2}Q${part - 1} 21 ${part} 24.4M${part + 3} ${TOP - 1.6}Q${part + 9} 21 ${f1(R - 1.6)} 31M${part - 3} ${TOP - 1.6}Q${part - 8} 21 ${f1(L + 1.6)} 32M${f1(R - 0.4)} 32Q${f1(R + 0.4)} 40 ${f1(R - 0.6)} ${sy - 2}M${f1(L + 0.4)} 32Q${f1(L - 0.4)} 40 ${f1(L + 0.6)} ${sy - 2}`, hL, 0.6, 0.45),
        stroke(`M${part + 1.6} ${TOP - 0.6}Q${part + 6} 22 ${f1(R - 3.4)} 28.6M${part - 1.8} ${TOP - 0.6}Q${part - 6} 22 ${f1(L + 3.4)} 29.6M${f1(R - 1.4)} 34Q${f1(R - 1)} 42 ${f1(R - 1.6)} ${sy - 3}M${f1(L + 1.4)} 34Q${f1(L + 1)} 42 ${f1(L + 1.6)} ${sy - 3}`, hD, 0.55, 0.5), sheen(3.4, 0.4)))
      break
    }
    case 'receding':
      front.push(fadeSides({ side: 43, line: 25, rec: 1 }), mass({ t: 1, line: 25.4, side: 31, tc: 0.8, rec: 1.2 }), tex(stroke(`M44 ${TOP + 1.4}Q50 ${TOP} 56 ${TOP + 1.4}`, hL, 0.8, 0.4), stroke(`M44 24.6l-.4-2.6M47 24.4l-.2-2.8M50 24.6v-2.8M53 24.4l.2-2.8M56 24.6l.4-2.6`, hD, 0.45, 0.6)))
      break
    case 'balding':
      for (const sd of [-1, 1]) front.push(fill(`M${f1(50 + sd * (cw + 0.8))} 42C${f1(50 + sd * (cw + 1.4))} 34 ${f1(50 + sd * (cw + 0.6))} 28.4 ${f1(50 + sd * (cw - 2.2))} 25.4C${f1(50 + sd * (cw - 3.2))} 28 ${f1(50 + sd * (cw - 2.6))} 34 ${f1(50 + sd * (cw - 1.6))} 40Z`, `url(#${P}a)`))
      front.push(E(P, 50, TOP + 4, cw * 0.5, 3, 's', 0.2))
      break
    case 'bun':
      back.push(`<ellipse cx="50" cy="${f1(TOP - 3.4)}" rx="5.6" ry="4.2" fill="url(#${P}a)"/>`, stroke(`M46 ${f1(TOP - 4)}q4 -2.6 8 0M46.6 ${f1(TOP - 2)}q3.4 -2 6.8 0`, hL, 0.5, 0.5))
      front.push(fadeSides({ side: 44 }), mass({ t: 0.9, line: 27.6, side: 33, tc: 0.6 }), tex(stroke(`M${f1(L + 3)} 31Q${f1(L + 5)} 21 49 ${TOP}M${f1(L + 6)} 29Q${f1(L + 8)} 21 49.6 ${TOP + 0.4}M54 28.6Q55 21 50.6 ${TOP + 0.4}M${f1(R - 3)} 31Q${f1(R - 5)} 21 51 ${TOP}`, hL, 0.5, 0.45), sheen(0.9, 0.4)))
      break
  }
  // a bare or close-cut scalp catches the light
  if (hair === 'shaved' || hair === 'balding' || hair === 'buzz') front.push(E(P, 45.5, TOP + 5, 6.5, 3.4, 'h', hair === 'buzz' ? 0.35 : 0.75))
  return { front: front.join(''), back: back.join('') }
}

// ── Gear ─────────────────────────────────────────────────────────────────────
function eyeBlackOf(look, G, P) {
  if (!look.eb || look.eb === 'none') return ''
  let s = ''
  for (const sd of [-1, 1]) {
    const x = 50 + sd * G.es, y = G.ey + 3.6 * G.ez + 0.4
    if (look.eb === 'paint') {
      const d = `M${f1(x - 3.5)} ${f1(y)}C${f1(x - 1.4)} ${f1(y - 0.5)} ${f1(x + 1.4)} ${f1(y - 0.5)} ${f1(x + 3.5)} ${f1(y)}L${f1(x + 3.1)} ${f1(y + 2.3)}C${f1(x + 1)} ${f1(y + 2.7)} ${f1(x - 1)} ${f1(y + 2.7)} ${f1(x - 3.1)} ${f1(y + 2.3)}Z`
      s += fill(d, '#141417', 0.94) + stroke(`M${f1(x - 2.6)} ${f1(y + 0.4)}Q${f1(x - 1)} ${f1(y)} ${f1(x + 0.6)} ${f1(y + 0.2)}`, '#8a90a0', 0.5, 0.6)
    } else {
      s += `<rect x="${f1(x - 3.3)}" y="${f1(y - 0.2)}" width="6.6" height="2.4" rx=".4" fill="#1a1b20" transform="rotate(${sd * -4} ${f1(x)} ${f1(y)})"/>`
        + stroke(`M${f1(x - 2.8)} ${f1(y + 0.5)}h5.6`, '#5d6270', 0.4, 0.8, ` transform="rotate(${sd * -4} ${f1(x)} ${f1(y)})"`)
    }
  }
  return s
}
function headGearOf(look, G, color, P) {
  const { cw } = G, L = 50 - cw, R = 50 + cw
  switch (look.gear) {
    case 'headband': {
      const d = `M${f1(L - 1)} 30.4C${f1(L - 0.2)} 25.2 ${f1(R + 0.2)} 25.2 ${f1(R + 1)} 30.4L${f1(R + 0.8)} 35C${f1(R - 1.6)} 31 ${f1(L + 1.6)} 31 ${f1(L - 0.8)} 35Z`
      return fill(d, `url(#${P}g)`) + stroke(`M${f1(L)} 32.2C${f1(L + 2)} 28.6 ${f1(R - 2)} 28.6 ${f1(R)} 32.2`, color, 1.2) + stroke(`M${f1(L + 3)} 27.6C${f1(L + 6)} 26.4 46 26 49 26`, '#ffffff', 0.7, 0.7)
    }
    case 'durag': {
      const d = capD(G, { t: 1.4, line: 27.2, side: 40, tc: 1 })
      return fill(d, `url(#${P}d)`) + stroke(`M50 ${TOP - 1.2}V27.2`, '#000', 0.5, 0.5)
        + stroke(`M${f1(L + 2)} 27Q${f1(L + 6)} 18 47 ${TOP - 0.4}M${f1(R - 3)} 29Q${f1(R - 6)} 20 54 ${TOP}`, '#c4cad8', 1.1, 0.35) + stroke(`M${f1(L + 1)} 31Q46 28.4 ${f1(R - 1)} 31`, '#c4cad8', 0.6, 0.25)
    }
    case 'visor': return visorOf(G, color, P)
    default: return ''
  }
}
function visorOf(G, color, P) {
  const { cw } = G, L = 50 - cw, R = 50 + cw
  const band = `M${f1(L - 1.2)} 31.4C${f1(L - 0.6)} 26.6 ${f1(R + 0.6)} 26.6 ${f1(R + 1.2)} 31.4L${f1(R + 0.8)} 34.2C${f1(R - 2)} 30.6 ${f1(L + 2)} 30.6 ${f1(L - 0.8)} 34.2Z`
  const brim = `M${f1(L + 0.6)} 32.4C${f1(L + 4)} 29.2 ${f1(R - 4)} 29.2 ${f1(R - 0.6)} 32.4C${f1(R - 3)} 37.4 ${f1(L + 3)} 37.4 ${f1(L + 0.6)} 32.4Z`
  return E(P, 50, 38, cw + 1, 4.2, 's', 0.85) + fill(band, `url(#${P}t)`) + fill(brim, shade(color, 0.4)) + stroke(`M${f1(L + 2)} 32.6C${f1(L + 5)} 30.2 ${f1(R - 5)} 30.2 ${f1(R - 2)} 32.6`, lite(color, 0.35), 0.5, 0.6)
}
function earringsOf(look, G) {
  if (!look.ear || look.ear === 'none') return ''
  const one = sd => { const x = 50 + sd * (Math.max(G.cw, G.cb) + 0.6), y = 51.4; return `<circle cx="${f1(x)}" cy="${y}" r=".95" fill="#e8eef8"/><circle cx="${f1(x - 0.3)}" cy="${f1(y - 0.3)}" r=".35" fill="#fff"/>` }
  return look.ear === 'stud' ? one(-1) : one(-1) + one(1)
}
function chainOf(look, G) {
  if (!look.chain || look.chain === 'none') return ''
  const c = look.chain === 'gold' ? ['#a87a22', '#e8c25a'] : ['#7d828c', '#e2e6ee']
  const d = `M${f1(50 - G.nw + 1)} 66.4Q${f1(50 - G.nw * 0.5)} 74.6 50 75.4Q${f1(50 + G.nw * 0.5)} 74.6 ${f1(50 + G.nw - 1)} 66.4`
  return stroke(d, c[0], 1.1) + stroke(d, c[1], 0.7, 1, ' stroke-dasharray=".8 .5"')
}

// ── A coach's pieces ─────────────────────────────────────────────────────────
// the top: a polo in the team's colour (its collar open at the neck, the placket's buttons) or a quarter-zip (dark,
// the stand-up collar in the team's colour, the zip)
function topOf(look, G, color, P) {
  const { nw } = G
  const polo = look.top === 'polo'
  const body = sym([50, 76], [
    [[50 + 2, 74], [50 + nw - 1, 70], [50 + nw + 0.4, 67.6]],
    [[50 + nw + 8, 68.6], [50 + nw + 20, 70], [50 + nw + 26, 72.4]],
    [[50 + nw + 29, 73.6], [100, 76], [102, 79]],
    [[102, 84], [90, 86], [50, 86]],
  ])
  let s = fill(body, `url(#${P}j)`) + stroke(`M${f1(50 - nw - 26)} 72.4C${f1(50 - nw - 20)} 70 ${f1(50 - nw - 8)} 68.6 ${f1(50 - nw - 0.4)} 67.6`, '#ffffff', 0.6, 0.25)
  if (polo) {
    const fl = lite(color, 0.1)
    // the collar's two points lying open at the throat, the placket and its button
    s += fill(`M${f1(50 - nw - 0.4)} 66.4L${f1(50 - nw - 4.2)} 69.6L${f1(50 - 3.6)} 75.6L50 73.4Z`, fl) + fill(`M${f1(50 + nw + 0.4)} 66.4L${f1(50 + nw + 4.2)} 69.6L${f1(50 + 3.6)} 75.6L50 73.4Z`, shade(fl, 0.2))
    s += stroke(`M48.6 74.4V86M51.4 74.4V86`, shade(color, 0.4), 0.5, 0.7) + `<circle cx="50" cy="78.6" r=".75" fill="#f2f3f5"/>`
  } else {
    s += fill(`M${f1(50 - nw - 1.2)} 64.6Q50 70.6 ${f1(50 + nw + 1.2)} 64.6L${f1(50 + nw + 2.4)} 70.6Q50 78.4 ${f1(50 - nw - 2.4)} 70.6Z`, `url(#${P}t)`)
    s += stroke('M50 74.6V86', '#0d0e12', 1.2) + stroke('M50 74.6V86', '#9aa0aa', 0.45) + `<rect x="48.9" y="77.6" width="2.2" height="3.4" rx=".6" fill="#c9ced6"/>`
  }
  return s
}
function glassesOf(look, G) {
  if (!look.specs) return ''
  const { cw, es, ey } = G, L = 50 - cw, R = 50 + cw
  const fr = look.specs === 2 ? '#6e5236' : '#17181d', w = 5.2, h = 3.8
  let s = stroke(`M${f1(L + 0.2)} ${f1(ey - 1.6)}L${f1(50 - es - w)} ${f1(ey - 1.8)}M${f1(50 + es + w)} ${f1(ey - 1.8)}L${f1(R - 0.2)} ${f1(ey - 1.6)}`, fr, 0.9)
  for (const sd of [-1, 1]) {
    const x = 50 + sd * es
    s += `<rect x="${f1(x - w)}" y="${f1(ey - h)}" width="${f1(w * 2)}" height="${f1(h * 2 - 0.4)}" rx="2" fill="#dfe8f4" fill-opacity=".1" stroke="${fr}" stroke-width="1"/>`
    s += fill(`M${f1(x - w + 1.6)} ${f1(ey + h - 1)}L${f1(x - w + 4.4)} ${f1(ey - h + 0.6)}H${f1(x - w + 5.8)}L${f1(x - w + 3)} ${f1(ey + h - 1)}Z`, '#ffffff', 0.16)
  }
  return s + stroke(`M${f1(50 - es + w)} ${f1(ey - 1.2)}Q50 ${f1(ey - 2.6)} ${f1(50 + es - w)} ${f1(ey - 1.2)}`, fr, 0.9)
}
// a ball cap or a visor in the team's colour, his hair under it
function capOf(look, G, color, P) {
  if (!look.cap) return ''
  if (look.cap === 'visor') return visorOf(G, color, P)
  const { cw } = G, L = 50 - cw, R = 50 + cw
  const crown = `M${f1(L - 1.2)} 32.6C${f1(L - 2)} ${TOP + 1} ${f1(50 - cw * 0.6)} ${TOP - 3.8} 50 ${TOP - 3.8}C${f1(50 + cw * 0.6)} ${TOP - 3.8} ${f1(R + 2)} ${TOP + 1} ${f1(R + 1.2)} 32.6C${f1(R - 3)} 30 ${f1(L + 3)} 30 ${f1(L - 1.2)} 32.6Z`
  const brim = `M${f1(L + 0.4)} 31.6C${f1(L + 4)} 28.8 ${f1(R - 4)} 28.8 ${f1(R - 0.4)} 31.6C${f1(R - 2.6)} 37.2 ${f1(L + 2.6)} 37.2 ${f1(L + 0.4)} 31.6Z`
  return E(P, 50, 38.4, cw + 1, 4.6, 's', 0.9) + fill(crown, `url(#${P}t)`)
    + stroke(`M50 ${TOP - 3.6}V30.6M${f1(50 - cw * 0.5)} ${TOP - 1}Q${f1(50 - cw * 0.42)} 24 ${f1(50 - cw * 0.46)} 30.8M${f1(50 + cw * 0.5)} ${TOP - 1}Q${f1(50 + cw * 0.42)} 24 ${f1(50 + cw * 0.46)} 30.8`, shade(color, 0.35), 0.5, 0.8)
    + `<circle cx="50" cy="${f1(TOP - 3.4)}" r="1.2" fill="${shade(color, 0.2)}"/>` + fill(brim, shade(color, 0.42)) + stroke(`M${f1(L + 2)} 31.6C${f1(L + 5)} 29.6 ${f1(R - 5)} 29.6 ${f1(R - 2)} 31.6`, lite(color, 0.3), 0.5, 0.6)
}

// ── The bust ─────────────────────────────────────────────────────────────────
function jerseyOf(G, color, P) {
  const { nw } = G
  const body = sym([50, 79.6], [
    [[50 + 2.2, 76.6], [50 + nw - 1.2, 70.6], [50 + nw + 0.4, 66.4]],
    [[50 + nw + 1.4, 66.6], [50 + nw + 2.6, 67.2], [50 + nw + 4, 67.6]],
    [[50 + nw + 10, 68.6], [50 + nw + 19, 69.4], [50 + nw + 25, 71.4]],
    [[50 + nw + 28, 72.6], [100, 75], [102, 78]],
    [[102, 84], [90, 86], [50, 86]],
  ])
  const trim = `M${f1(50 - nw - 0.2)} 66.2C${f1(50 - nw + 1)} 70.8 ${f1(50 - 3)} 76.8 50 80.2C${f1(50 + 3)} 76.8 ${f1(50 + nw - 1)} 70.8 ${f1(50 + nw + 0.2)} 66.2`
  const accent = lum(color) > 200 ? '#1d2230' : '#f4f5f7'
  return fill(body, `url(#${P}j)`)
    // the pads' shoulder line catching the key light, the far shoulder in shade, the collar's piping
    + stroke(`M${f1(50 - nw - 25)} 71.4C${f1(50 - nw - 19)} 69.4 ${f1(50 - nw - 10)} 68.6 ${f1(50 - nw - 4)} 67.6`, '#ffffff', 0.7, 0.3)
    + E(P, 50 + nw + 18, 79, 14, 9, 'o', 0.35)
    + stroke(trim, accent, 3) + stroke(trim, color, 1.7) + stroke(trim, '#000', 0.4, 0.25)
}
const OUTLINE = '#120c0a'
// blobs grouped by their gradient (one fill attribute a group): [x, y, rx, ry, g, o, rot]
function layer(P, items) {
  const by = new Map()
  for (const it of items) { if (!it || it[5] <= 0.02) continue; const k = it[4]; if (!by.has(k)) by.set(k, ''); by.set(k, by.get(k) + `<ellipse cx="${f1(it[0])}" cy="${f1(it[1])}" rx="${f1(it[2])}" ry="${f1(it[3])}"${it[5] < 1 ? ` opacity="${o2(it[5])}"` : ''}${it[6] ? ` transform="rotate(${f1(it[6])} ${f1(it[0])} ${f1(it[1])})"` : ''}/>`) }
  let s = ''
  for (const [k, v] of by) s += `<g fill="url(#${P}${k})">${v}</g>`
  return s
}
export function faceSvg(look, { color = '#d2aa4f', view = 'full' } = {}) {
  const col = color || '#d2aa4f'
  const P = `f${hashStr(`${JSON.stringify(look)}|${col}|${view}`).slice(0, 4)}`
  const G = geo(look), T = tonesOf(look.skin)
  const { cw, cb, jw, jy, cy, ch, nw } = G, L = 50 - cw, R = 50 + cw
  const durag = look.gear === 'durag'
  // (a durag covers the hair; long hair that hangs still shows behind it)
  const hp = hairParts(durag ? { ...look, hair: ['locs', 'long', 'flow', 'mullet', 'cornrows'].includes(look.hair) ? look.hair : 'shaved' } : look, G, T, P)
  const hfront = durag || look.cap === 'cap' ? '' : hp.front
  const ey = eyesOf(look, G, T, P), br = browsOf(look, G, P, T)
  const hcol = hairTones(look.hc === '#b8893c' ? '#16110e' : look.hc)
  const zip = look.top && look.top !== 'polo'
  const top = zip ? '#2a2e37' : mixC(col, '#0b0c10', 0.16)
  // the neck: into the jersey, the jaw's shadow on it, the two neck muscles, the far side in shade
  const neckD = sym([50, 49], [
    [[50 + nw * 0.3, 49], [50 + nw * 0.6, 49], [50 + nw * 0.86, 49]],
    [[50 + nw * 0.9, 57], [50 + nw, 62], [50 + nw + 0.6, 66]],
    [[50 + nw + 3, 68.4], [50 + nw + 9, 69.6], [50 + nw + 16, 71]],
    [[50 + nw + 16, 76], [50 + nw + 16, 80], [50 + nw + 16, 84]],
    [[50 + nw, 84], [55, 84], [50, 84]],
  ])
  const iris = look.iris ?? '#2b1a10'
  // (only the gradients the drawing uses go in)
  const grads = [
    ['s', rg(`${P}s`, T.sh, 0.95)], ['h', rg(`${P}h`, T.spec, T.specA)], ['b', rg(`${P}b`, T.bl, 0.36)], ['o', rg(`${P}o`, T.dk, 0.9)], ['c', rg(`${P}c`, hcol.hL, 0.6)],
    ['S', `<radialGradient id="${P}S"><stop offset="0" stop-color="${T.sh}"/><stop offset=".62" stop-color="${T.sh}" stop-opacity=".9"/><stop offset="1" stop-color="${T.sh}" stop-opacity="0"/></radialGradient>`],
    ['k', lg(`${P}k`, [[0, T.lit], [0.45, T.base], [1, mixC(T.base, T.sh, 0.45)]], 0.95, 0.3, 0.05, 0)],
    ['j', lg(`${P}j`, [[0, lite(top, 0.12)], [0.5, top], [1, shade(top, 0.38)]], 1, 0.25)],
    ['t', lg(`${P}t`, [[0, lite(col, 0.15)], [0.55, col], [1, shade(col, 0.35)]], 1, 0.2)],
    ['a', lg(`${P}a`, [[0, mixC(hcol.hc, hcol.hL, 0.55)], [0.5, hcol.hc], [1, hcol.hD]])],
    ['f', lg(`${P}f`, [[0, hcol.hc], [0.55, hcol.hc, 0.92], [0.8, hcol.hc, 0.5], [1, hcol.hc, 0]])],
    ['z', lg(`${P}z`, [[0, hcol.hc, 0.92], [0.6, hcol.hc, 0.8], [1, hcol.hc, 0.25]])],
    ['w', lg(`${P}w`, [[0, mixC('#9a9088', T.base, 0.25)], [0.55, mixC('#e2dacf', T.base, 0.1)], [1, '#e9e2d8']])],
    ['i', `<radialGradient id="${P}i" cx=".42" cy=".38"><stop offset="0" stop-color="${lite(iris, 0.3)}"/><stop offset=".65" stop-color="${iris}"/><stop offset="1" stop-color="${shade(iris, 0.6)}"/></radialGradient>`],
    ['r', lg(`${P}r`, [[0, '#cfe0ff', 0], [0.6, '#cfe0ff', 0], [1, '#d6e4ff', 0.85]], 1, 0)],
    ['g', lg(`${P}g`, [[0, '#ffffff'], [0.6, '#eceef2'], [1, '#b9bdc6']], 1, 0.2)],
    ['d', lg(`${P}d`, [[0, '#3a3d48'], [0.5, '#17181d'], [1, '#0b0b0e']], 0.9, 0.6)],
  ]
  const defs = body => `<defs><path id="${P}p" d="${headD(G)}"/><path id="${P}n" d="${neckD}"/>`
    + grads.filter(([k]) => body.includes(`#${P}${k})`)).map(x => x[1]).join('')
    + br.grads
    + `<clipPath id="${P}C"><use href="#${P}p"/></clipPath><clipPath id="${P}N"><use href="#${P}n"/></clipPath><clipPath id="${P}E">${ey.clip}</clipPath>`
    + `</defs>`
  const ears = [-1, 1].map(sd => {
    const ex = 50 + sd * (Math.max(cw, cb) - 0.9), X = d => f1(ex + sd * d)
    const rim = `M${X(0)} 40.2C${X(2.4)} 38 ${X(4.1)} 39.8 ${X(3.9)} 43.6C${X(3.7)} 47.6 ${X(2.6)} 50.8 ${X(0.5)} 52.4`
    return fill(`${rim}L${X(-0.6)} 50.4Z`, sd < 0 ? T.lit : mixC(T.base, T.sh, 0.5))
      + E(P, ex + sd * 2, 45.2, 1.4, 3, 'o', 0.6) + E(P, ex + sd * 2.4, 44.6, 2, 4, 'b', 0.55)
      + stroke(`M${X(0.7)} 41.2C${X(2.5)} 40.2 ${X(3.1)} 41.8 ${X(2.9)} 44.4C${X(2.7)} 46.8 ${X(2)} 48.8 ${X(1)} 50`, T.line, 0.5, 0.55) + stroke(`M${X(1.2)} 39.4C${X(2.8)} 39 ${X(3.6)} 40.6 ${X(3.5)} 43`, T.spec, 0.5, sd < 0 ? 0.45 : 0.15)
      + stroke(rim, OUTLINE, 0.55, 0.45)
  }).join('')
  const lean = G.lean
  const neck = `<g clip-path="url(#${P}N)">` + layer(P, [
    [51, cy + 1.4, jw + 2.4, 6.4, 'o', 0.9],
    [50 + nw * 0.95, 66, 4.4, 12, 'S', 0.8], [50 - nw * 0.75, 63, 3, 8, 'h', 0.3],
    [50, 71, 2, 1.6, 'o', 0.6], [50, 62.6, 1.2, 1.7, 'h', 0.25], [50, 73, nw, 3, 'o', 0.35],
  ]) + stroke(`M${f1(50 - nw + 2.4)} 56C${f1(50 - nw + 3.4)} 62 47.4 67.6 47.6 71M${f1(50 + nw - 2.4)} 56C${f1(50 + nw - 3.4)} 62 52.6 67.6 52.4 71`, T.sh, 1.4, 0.55)
    + stroke(`M${f1(50 - nw + 1.2)} 57C${f1(50 - nw + 2)} 62 46 67.4 46.2 70.4`, T.spec, 0.9, 0.2) + '</g>'
  const shading = `<g clip-path="url(#${P}C)">` + layer(P, [
    // the far side's plane (a firm edge), the near edge turning away, the temples' planes
    [50 + cw * 1.08, 47, cw * 0.6, 26, 'S', 0.72 + (1 - T.d) * 0.16], [L - 1.4, 49, 3, 18, 's', 0.42],
    [L + 1.4, 33.6, 2.6, 6.4, 's', 0.4], [R - 1.4, 33.6, 2.6, 6.4, 's', 0.6],
    // the forehead's light, its specular hit, the brow ridge catching the light, the glabella
    [46.4, 27.6, 8.6, 5.6, 'h', 0.5], [44.8, 26.4, 2.6, 1.6, 'h', 0.6], [47.6, G.by - 2.6, 8.4, 1.9, 'h', 0.35], [50, G.by + 0.6, 1.2, 1.8, 's', 0.18],
    // the cheekbones catching the light, the plane under them falling away to the mouth, the blush
    ...[-1, 1].flatMap(sd => [
      [50 + sd * (cb - 5), 47.6, 4.8, 2.2, 'h', sd > 0 ? 0.16 : 0.55, sd * 16],
      [50 + sd * (cb - 4.4), 55, 2.3, 6.8, 's', 0.2 + lean * 0.4 + (sd > 0 ? 0.15 : 0), sd * 30],
      [50 + sd * (cb - 6.4), 50.6, 4.2, 2.8, 'b', 0.3 - T.d * 0.06 - (1 - T.d) * 0.1],
      [50 + sd * (jw - 1.6), jy - 3.4, 2.2, 4, 'h', sd > 0 ? 0 : 0.25],
    ]),
    // the jaw's underside turning away, the chin's light, the line under it
    [50 + jw * 0.62, jy + 3.2, 8, 3.8, 's', 0.6, -24], [50 - jw * 0.62, jy + 3.2, 7, 3.4, 's', 0.32, 24],
    [49, cy - 3.6, 3.6, 2.2, 'h', 0.45], [50, cy + 0.4, ch + 1.6, 1.5, 's', 0.55],
  ]) + (look.cleft ? stroke(`M50 ${f1(cy - 2.8)}v1.8`, T.sh, 0.7, 0.45) : '') + ey.under + `</g>`
  // the cool rim down the far edge and the jaw, the head's fine edge
  const rim = `<g clip-path="url(#${P}C)"><use href="#${P}p" fill="none" stroke="url(#${P}r)" stroke-width="1.8" opacity=".55"/></g><use href="#${P}p" fill="none" stroke="${OUTLINE}" stroke-width=".6" opacity=".5"/>`
  const vb = VIEWS[view] ?? VIEWS.full
  // (a close crop of the eyes, the nose or the mouth leaves out what it can't show: less to draw for a thumbnail)
  const close = view === 'eyes' || view === 'nose' || view === 'mouth'
  const body = (close ? '' : hp.back
    + `<use href="#${P}n" fill="url(#${P}k)"/>` + neck
    + chainOf(look, G)
    + (look.top ? topOf(look, G, col, P) : jerseyOf(G, col, P)))
    + (view === 'nose' || view === 'mouth' ? '' : ears)
    + `<use href="#${P}p" fill="url(#${P}k)"/>`
    + shading
    + rim
    + (look.beard === 'stubble' ? beardOf(look, G, T, P) : '')
    + linesOf(look, G, T, P)
    + ey.eyes
    + br.brows
    + noseOf(look, G, T, P)
    + (look.beard !== 'stubble' ? beardOf(look, G, T, P) : '')
    + mouthOf(look, G, T, P)
    + stacheOf(look, G, P)
    + eyeBlackOf(look, G, P)
    + hfront
    + headGearOf(look, G, col, P)
    + earringsOf(look, G)
    + glassesOf(look, G)
    + capOf(look, G, col, P)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" stroke-linecap="round" stroke-linejoin="round">${defs(body)}${body}</svg>`
}
// a data: URL that encodes only what it must (smaller than encodeURIComponent's)
// (the drawing never holds a % or a brace, so the quote, the hash and the angle brackets are all there is to escape)
const toUrl = svg => `data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}`

// ── Coaches ──────────────────────────────────────────────────────────────────
// A coach is an older man (35 to 70): hair greying with the years, receding or gone, a crew cut or a side part, the
// lines of his face, a heavier jaw; often glasses, a moustache or a grey beard, a visor or a cap; a team polo or a
// quarter-zip. The backgrounds of the NFL's coaching staffs: mostly white, about a fifth Black, a few others.
//   coachLook(key, { g, ag })         the look (g: his background if it's known, ag: his age, greyer every year)
//   coachUrl(key, { g, ag, color })   the same as a data: URL (cached)
export const COACH_MIX = [['w', 74], ['b', 20], ['l', 4], ['p', 2]]
const COACH_HAIR = {
  w: [['crew', 26], ['sidepart', 24], ['receding', 20], ['balding', 12], ['buzz', 10], ['shaved', 8]],
  b: [['buzz', 30], ['shaved', 30], ['fade', 16], ['receding', 14], ['balding', 6], ['waves', 4]],
  l: [['crew', 30], ['sidepart', 20], ['receding', 20], ['buzz', 16], ['shaved', 14]],
  p: [['buzz', 40], ['shaved', 30], ['crew', 30]],
  m: [['buzz', 34], ['crew', 26], ['receding', 20], ['shaved', 20]],
}
const COACH_BEARD = [['none', 46], ['stache', 18], ['short', 16], ['goatee', 10], ['stubble', 6], ['full', 4]]
const GREYS = { w: ['#9b958c', '#c9c4bb', '#e2ded6'], b: ['#6f6b66', '#9d9993', '#c8c4bd'], l: ['#77726c', '#aaa59d', '#d6d2ca'], m: ['#77726c', '#aaa59d', '#d6d2ca'], p: ['#6f6b66', '#9d9993', '#c8c4bd'] }
export function coachLook(key, { g = null, ag = null } = {}) {
  const r = seeded(`coach-face|${key}`)
  const bg = g ?? pickW(r, COACH_MIX)
  const age = ag ?? 38 + Math.floor(r() * 26)
  const base = lookOf(`coach|${key}|${bg}`, 'qb')
  const skin = SKIN[bg] ? SKIN[bg][Math.floor(r() * SKIN[bg].length)] : base.skin
  let hair = pickW(r, COACH_HAIR[bg] ?? COACH_HAIR.w)
  if (age < 42 && hair === 'balding') hair = 'receding'
  // his natural colour, then grey: salt and pepper in his late forties, grey in his fifties, white past sixty
  const nat = pickW(r, HC[bg] ?? HC.w).replace('#b8893c', '#16110e')
  const G3 = GREYS[bg] ?? GREYS.w
  const grey = age < 45 ? null : age < 52 ? mixC(nat, G3[0], 0.55) : age < 60 ? G3[1] : G3[2]
  const hc = grey ?? nat
  let beard = pickW(r, COACH_BEARD), stache = 'none'
  if (beard === 'stache') { beard = 'none'; stache = 'full' } else if (beard === 'short' || beard === 'full' || beard === 'goatee') stache = 'full'
  const u = r()
  const L = {
    g: bg, ag: age, skin, head: pickW(r, [['square', 40], ['broad', 30], ['oval', 20], ['round', 10]]), eyes: pickW(r, [['hooded', 40], ['narrow', 30], ['almond', 30]]),
    brows: pickW(r, [['thick', 34], ['straight', 40], ['angled', 26]]), nose: base.nose, mouth: pickW(r, [['thin', 40], ['neutral', 50], ['smirk', 10]]),
    hair, hc, brow: age >= 58 ? mixC(nat, G3[1], 0.6) : nat, bc: hc, beard, stache, gear: 'none', wide: 0.45,
    specs: r() < (age >= 55 ? 0.45 : 0.25) ? (r() < 0.75 ? 1 : 2) : 0,
    cap: u < 0.18 ? 'visor' : u < 0.3 ? 'cap' : null,
    top: r() < 0.55 ? 'polo' : 'zip',
  }
  // the newer parts: his eyes' colour and his shape (a coach carries a little more weight than he did)
  const r3 = seeded(`coach-face2|${key}`)
  const s = () => r2((r3() + r3() + r3()) / 1.5 - 1)
  return {
    ...L, iris: pickW(r3, IRIS[bg] ?? IRIS.w), wt: r2(clamp(s() * 0.6 + (age - 50) / 70, -1, 1)), jaw: r2(s() * 0.6), chn: r2(s() * 0.5), chk: r2(s() * 0.5 - 0.2),
    esz: r2(s() * 0.4 - 0.15), esp: r2(s() * 0.5), brh: r2(s() * 0.5 - 0.2), nsw: r2(s() * 0.5), nsl: r2(s() * 0.5 + 0.15), lip: r2(s() * 0.5 - 0.2), mw: r2(s() * 0.4),
    eb: 'none', ear: 'none', chain: 'none', cleft: r3() < 0.2,
  }
}
const CCACHE = new Map()
export function coachUrl(key, { g = null, ag = null, color = '#d2aa4f' } = {}) {
  // (the face changes only as he greys: keyed by his age in steps)
  const step = ag == null ? '' : ag < 45 ? 0 : ag < 52 ? 1 : ag < 58 ? 2 : ag < 60 ? 3 : 4
  const k = `${key}|${g ?? ''}|${step}|${color}`
  let u = CCACHE.get(k)
  if (!u) {
    u = toUrl(faceSvg(coachLook(key, { g, ag }), { color }))
    if (CCACHE.size > 400) CCACHE.clear()
    CCACHE.set(k, u)
  }
  return u
}
// a coach's saved face (the player's built coach: { key, coach: 1, g?, ag? }, or an older save's player-style
// { key, pos }) as a url
export const coachFaceUrl = (face, color, ag = null) => (!face ? null : face.coach ? coachUrl(face.key, { g: face.g ?? null, ag: ag ?? face.ag ?? null, color }) : faceUrl(face.key, face.pos, color))

// a league man's age in steps (his face changes only as he matures: 25, 29, 32)
const ageStep = ag => (ag == null || ag <= 25 ? 24 : ag <= 29 ? 28 : ag <= 32 ? 31 : 34)
const CACHE = new Map()
export function faceUrl(key, pos, color, ag = null) {
  const a = ageStep(ag)
  const k = `${key}|${pos}|${color ?? ''}|${a}`
  let u = CACHE.get(k)
  if (!u) {
    u = toUrl(faceSvg(lookOf(key, pos, a), { color }))
    if (CACHE.size > 800) CACHE.clear()
    CACHE.set(k, u)
  }
  return u
}
// a league man's face (a made-up man only: the caller checks he isn't real and isn't a build)
export const genFace = (p, color) => (p ? faceUrl(p.fk ?? p.n, p.p, color, p.ag ?? null) : null)

// ── A build's face: the player's own pick ────────────────────────────────────
// Every build gets a face of his own (never a real man's photo). It starts as one coherent made-up man (lookOf, keyed
// by the setup's seed and the roster spot), and the player can change any part of it (FacePick.jsx). Saved on the
// build as B.face = { skin, head, eyes, iris, brows, nose, mouth, hair, hc, beard, stache, gear, eb, ear, chain, and
// the sliders wt jaw chn chk esz esp brh nsw nsl lip mw }.
//   defaultFace(key, pos)     a coherent random look, in the creator's terms
//   buildLook(B)              the look the drawing reads (B.face over his default: an older save's face gets the parts
//                             it never had from the default, its beard and its gear mapped onto today's)
//   buildFaceUrl(B, color, view)  the build's face as a data: URL (view: a crop, VIEWS)
export const FACE_KEYS = ['skin', 'head', 'eyes', 'iris', 'brows', 'nose', 'mouth', 'hair', 'hc', 'beard', 'stache', 'gear', 'eb', 'ear', 'chain', ...SL]
const near = (list, c) => list.reduce((a, x) => (Math.abs(lum(x[0]) - lum(c)) < Math.abs(lum(a[0]) - lum(c)) ? x : a))[0]
const ok = (list, v) => list.some(x => x[0] === v)
export function defaultFace(key, pos) {
  const L = lookOf(`build|${key}`, pos)
  const f = {}
  for (const k of FACE_KEYS) f[k] = L[k]
  f.skin = ok(FACE_SKIN, L.skin) ? L.skin : near(FACE_SKIN, L.skin)
  f.hc = ok(FACE_HC, L.hc) ? L.hc : near(FACE_HC, L.hc)
  return f
}
// an older face's beard (before 2026-11-15 the moustache was part of the beard) and gear (eye black and earrings
// were gear then; now each is its own part)
const OLD_BEARD = { stache: ['none', 'full'], goatee: ['goatee', 'full'], full: ['full', 'full'] }
const OLD_GEAR = { eyeblack: ['eb', 'paint'], studs: ['ear', 'studs'] }
const groupOfSkin = s => (lum(s) > 175 ? 'w' : lum(s) > 120 ? 'm' : 'b')
const LISTS = [['head', FACE_HEAD], ['eyes', FACE_EYES], ['iris', FACE_IRIS], ['brows', FACE_BROWS], ['nose', FACE_NOSE], ['mouth', FACE_MOUTH], ['hair', FACE_HAIR], ['beard', FACE_BEARD], ['stache', FACE_STACHE], ['gear', FACE_GEAR], ['eb', FACE_EB], ['ear', FACE_EAR], ['chain', FACE_CHAIN]]
export function normFace(face, base) {
  const f = { ...base, ...(face ?? {}) }
  if (face && !face.stache && OLD_BEARD[face.beard]) [f.beard, f.stache] = OLD_BEARD[face.beard]
  if (face && OLD_GEAR[face.gear]) { const [k, v] = OLD_GEAR[face.gear]; f.gear = 'none'; if (!face[k]) f[k] = v }
  for (const [k, list] of LISTS) if (!ok(list, f[k])) f[k] = base[k]
  if (!ok(FACE_SKIN, f.skin)) f.skin = near(FACE_SKIN, f.skin)
  if (!ok(FACE_HC, f.hc)) f.hc = base.hc
  for (const k of SL) f[k] = Number.isFinite(+f[k]) ? clamp(+f[k], -1, 1) : 0
  return f
}
export function buildLook(B) {
  const pos = B?.pos ?? 'wr'
  const f = normFace(B?.face, defaultFace(B?.name ?? 'build', pos))
  // dyed tips only show on locs and twists; on any other cut the colour underneath is black
  const hc = f.hc === '#b8893c' && f.hair !== 'locs' && f.hair !== 'twists' ? '#16110e' : f.hc
  return { ...f, g: groupOfSkin(f.skin), hc, brow: f.hc === '#b8893c' ? '#16110e' : hc, wide: wideOf(pos), ag: ageStep(B?.age) }
}
const BCACHE = new Map()
export function buildFaceUrl(B, color, view = 'full') {
  if (!B) return null
  const L = buildLook(B)
  const k = `${FACE_KEYS.map(x => L[x]).join('|')}|${L.wide}|${L.ag}|${color ?? ''}|${view}`
  let u = BCACHE.get(k)
  if (!u) {
    u = toUrl(faceSvg(L, { color, view }))
    if (BCACHE.size > 600) BCACHE.clear()
    BCACHE.set(k, u)
  }
  return u
}
