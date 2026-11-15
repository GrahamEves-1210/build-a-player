// FRANCHISE: drawn faces. The men the game makes up (draft prospects, rookies, generated depth, free agents, coaches
// without a photo) and every one of the player's builds. Real players use their ESPN headshot; never a drawn face on a
// real man without a photo (initials beat a made-up face on a real player).
//
// The look (owner 2026-11-15, the second pass: "pick a style and commit to it"): inked, cel-shaded sports
// illustration, the look of an illustrated trading card. Confident ink, heaviest round the head and the jaw, thin on
// the features. Two or three flat tones a material (skin, hair, jersey) with designed shadow shapes (under the brow
// ridge, under the cheekbone, down the nose's far side, under the lower lip, under the jaw on the neck), one crisp
// light on the forehead, the bridge and the cheekbone, a hard rim of cool light down the shadow side. No gradients,
// no filters. Grounded adult proportions: a skull with a forehead and temples, cheekbones, a jaw and a chin; a thick
// neck into a football jersey's V-neck in the team's colour. The face's structure comes from his background with his
// skin, hair and beard (BGS: the nose's bridge and width, the lips, how deep the eyes sit); every man has eyes set
// in sockets under a brow ridge, a lid crease and whites either side of the iris.

// The man is one coherent person, not parts picked at random: first his background (weighted by position the way NFL
// rooms are), then a skin tone, head, features, hair, hair colour and facial hair that go together on real players.
//
//   lookOf(key, pos, ag)          the look, seeded by the key (his name); ag his age (lines come with the years)
//   faceSvg(look, { color, view }) the SVG bust (drawn on 100 × 100, framed 74 × 74; transparent; color: his team's;
//                                 view: a crop of it for the creator's thumbnails, VIEWS)
//   faceUrl(key, pos, color, ag, small)  the same as a data: URL for an <img> (cached; small: the lighter drawing
//                                 for lists at 64 px and under)
//   genFace(p, color, small)      a league man's face url (p: league.js's player): his key is his name
// The player's builds: B.face (the creator's choices, FacePick.jsx), buildLook(B), buildFaceUrl(B, color, view).
//
// Pure: no DOM, no Math.random. The same name always draws the same man (a prospect keeps his face as a rookie).
// Every SVG string is cached by its look, so a face is built once and then reused.
import { seeded } from '../rng'

// ── Who he is ────────────────────────────────────────────────────────────────
// background: b Black · w white · m mixed · p Polynesian · l Latino
// (the shares by room: across the league about 57% Black and a third white, a few Polynesian, mixed and Latino men;
// QB rooms and offensive lines are mostly white, corners almost all Black, Polynesian men mostly on the lines)
const MIX = {
  qb: { b: 0.30, w: 0.62, m: 0.04, p: 0.02, l: 0.02 },
  rb: { b: 0.74, w: 0.17, m: 0.05, p: 0.02, l: 0.02 },
  wr: { b: 0.72, w: 0.20, m: 0.05, p: 0.01, l: 0.02 },
  te: { b: 0.34, w: 0.56, m: 0.05, p: 0.03, l: 0.02 },
  ol: { b: 0.34, w: 0.50, m: 0.04, p: 0.09, l: 0.03 },
  dl: { b: 0.70, w: 0.15, m: 0.05, p: 0.08, l: 0.02 },
  lb: { b: 0.56, w: 0.32, m: 0.05, p: 0.05, l: 0.02 },
  db: { b: 0.82, w: 0.11, m: 0.05, p: 0.01, l: 0.01 },
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
  p: ['#a06c44', '#9c6440', '#8a5634', '#b98058'],
  l: ['#deae84', '#c99064', '#b98058', '#d9a582'],
}
// (then, now and then, a neighbouring tone the older list didn't have)
const SKIN_NEXT = { '#f4d2b6': '#f6dccb', '#d9a582': '#cfa27c', '#b98058': '#ae7a56', '#7a4a2c': '#6a4128', '#5e3a22': '#4e2f1e', '#432818': '#33201a', '#deae84': '#cfa27c' }
const HAIR = {
  b: [['fade', 26], ['waves', 12], ['buzz', 12], ['locs', 13], ['twists', 9], ['cornrows', 6], ['hightop', 3], ['shaved', 9], ['afro', 4], ['curly', 3]],
  w: [['crew', 24], ['sidepart', 13], ['textured', 16], ['flow', 12], ['buzz', 14], ['curly', 5], ['shaved', 5], ['mullet', 4], ['fade', 5], ['long', 2]],
  m: [['fade', 24], ['curly', 24], ['buzz', 12], ['twists', 10], ['locs', 8], ['afro', 6], ['shaved', 6], ['textured', 6], ['waves', 4]],
  p: [['curly', 22], ['long', 16], ['buzz', 18], ['fade', 18], ['bun', 14], ['shaved', 8], ['mullet', 4]],
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
  p: [['none', 22], ['full', 30], ['short', 20], ['goatee', 14], ['stubble', 10], ['long', 4]],
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
// (eyes by background: a narrow eye is rare on a Black or Polynesian man; a hooded lid is common on Polynesian men)
const EYES = {
  b: [['almond', 40], ['round', 28], ['hooded', 20], ['narrow', 12]], w: [['almond', 36], ['hooded', 26], ['narrow', 24], ['round', 14]],
  p: [['almond', 38], ['hooded', 30], ['round', 24], ['narrow', 8]], m: [['almond', 42], ['hooded', 24], ['round', 20], ['narrow', 14]],
  l: [['almond', 42], ['hooded', 24], ['round', 20], ['narrow', 14]],
}
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
    g, skin, head, eyes: pickW(r, EYES[g] ?? EYES.w), brows: pickW(r, BROWS), nose: pickW(r, NOSE[g]), mouth: pickW(r, MOUTH[g]),
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

// the ink: one warm near-black for every line on the man
const INK = '#150d0a'
// a skin's flat tones (the style is inked cel shading, two or three flat tones a material, no gradients): its base,
// its shadow (tinted by its undertone), the deep creases, its highlight (deep skin takes a cool sheen in place of a
// warm one), the rim of cool light down the shadow side, the line of the features, the lips, the whites of the eyes
const UT = { pink: '#8c2e2c', neutral: '#6e3622', golden: '#7c4612', olive: '#4e4220', red: '#76200f', cool: '#3c1832' }
const UT_OF = new Map(FACE_SKIN.map(x => [x[0], x[2]]))
const TONES = new Map()
function tonesOf(sk) {
  let t = TONES.get(sk)
  if (t) return t
  const L = lum(sk), d = clamp((205 - L) / 150, 0, 1)      // 0 the fairest … 1 the deepest
  const tint = mixC(UT[UT_OF.get(sk) ?? (L > 110 && L < 170 ? 'golden' : 'neutral')], '#000000', 0.2 + d * 0.5)
  t = {
    d, base: sk,
    sh: mixC(sk, tint, 0.36 + d * 0.06),
    dk: mixC(sk, mixC(tint, '#000000', 0.5), 0.6 + d * 0.06),
    hl: d < 0.5 ? mixC(sk, '#fff5ea', 0.4 - d * 0.3) : mixC(sk, '#e8dde6', 0.24 - d * 0.06),
    rim: mixC(sk, '#cfe0ff', 0.3 + d * 0.12),
    line: mixC(sk, INK, 0.74),
    lipU: d < 0.5 ? mixC(sk, '#7a2c34', 0.42 - d * 0.2) : mixC(sk, '#1e0c16', 0.32),
    lipL: d < 0.5 ? mixC(sk, '#c0645f', 0.3 - d * 0.1) : mixC(sk, '#8a4c58', 0.22),
    white: mixC('#f1ebe4', sk, 0.06 + d * 0.06), whiteS: mixC('#a99c93', sk, 0.3),
  }
  TONES.set(sk, t)
  return t
}

// ── The frame ────────────────────────────────────────────────────────────────
// the head and the tops of the shoulders, the way a broadcast headshot is cropped (a high top or an afro may touch
// the top edge); the creator's thumbnails crop to the part they change ('sm' is the full frame drawn for a list:
// 64 px and under, the fine lines left out)
export const VIEWS = { full: '13 6 74 74', sm: '13 6 74 74', eyes: '30 33 40 25', nose: '36 41 28 28', mouth: '35 49 30 25', low: '24 38 52 52', hair: '14 3 72 72', ear: '21 36 26 26' }
const TOP = 17

// ── The head ─────────────────────────────────────────────────────────────────
// a grown man's skull: cw half the skull's width · tw the temples · cb the cheekbones · jw the jaw at its corner · jy
// the corner's height · ch half the chin · cy the chin. The face is narrower than the skull at the temples, widest at
// the cheekbones, and its width below comes from the jaw, not from the cheeks.
const SHAPE = {
  oval: { cw: 15.8, tw: 15.0, cb: 15.3, jw: 12.6, jy: 59.4, ch: 5.4, cy: 68.6 },
  square: { cw: 16.0, tw: 15.3, cb: 15.5, jw: 13.8, jy: 60.2, ch: 6.3, cy: 68.4 },
  round: { cw: 16.5, tw: 15.9, cb: 16.2, jw: 13.6, jy: 58.8, ch: 6.0, cy: 67.8 },
  long: { cw: 15.2, tw: 14.4, cb: 14.7, jw: 12.6, jy: 61.2, ch: 5.8, cy: 70.2 },
  broad: { cw: 16.9, tw: 16.3, cb: 16.8, jw: 14.8, jy: 59.8, ch: 7.0, cy: 68.6 },
  chiseled: { cw: 15.8, tw: 14.8, cb: 15.8, jw: 13.6, jy: 60.6, ch: 5.9, cy: 69.4 },
}
// what his background gives his structure (always with his skin, his hair and his beard): br the height of the
// nose's bridge · nk the nose's width · lk the lips' fullness · rid how deep the brow ridge sets the eyes · ck the
// cheekbones · eo how open the eyes are
const BGS = {
  w: { br: 1, nk: 0.92, lk: 0.86, rid: 1, ck: 0, eo: 1 },
  b: { br: 0.42, nk: 1.2, lk: 1.32, rid: 0.82, ck: 0.25, eo: 1.08 },
  m: { br: 0.62, nk: 1.08, lk: 1.14, rid: 0.86, ck: 0.2, eo: 1.05 },
  l: { br: 0.78, nk: 1.02, lk: 1.06, rid: 0.92, ck: 0.2, eo: 1.02 },
  p: { br: 0.7, nk: 1.18, lk: 1.2, rid: 0.84, ck: 0.6, eo: 1 },
}
const NOSE_W = { straight: 3.6, broad: 4.1, narrow: 3.1, short: 3.6, wide: 4.6, boxer: 3.9 }
const NOSE_BR = { straight: 0, broad: -0.12, narrow: 0.28, short: -0.1, wide: -0.18, boxer: 0.06 }
const MOUTH_W = { neutral: 5.9, full: 6.2, thin: 5.7, smirk: 5.9, wide: 6.8, stern: 6.0 }
// the eye: the upper lid's rise, the lower's drop, the tilt up to the outer corner
const EYE = { almond: [1.42, 0.92, 0.25], round: [1.62, 1.1, 0], narrow: [1.14, 0.8, 0.1], hooded: [1.3, 0.9, 0], deep: [1.32, 0.92, 0], upturn: [1.38, 0.86, 0.6] }
const sv = (look, k) => clamp(+look[k] || 0, -1, 1)
function geo(look) {
  const s = SHAPE[look.head] ?? SHAPE.oval, w = look.wide ?? 0.2, B = BGS[look.g] ?? BGS.w
  const wt = sv(look, 'wt'), jaw = sv(look, 'jaw'), chk = sv(look, 'chk'), chn = sv(look, 'chn')
  const G = {
    cw: s.cw + w * 0.6 + wt * 0.45,
    tw: s.tw + w * 0.6 + wt * 0.5,
    cb: s.cb + w * 0.7 + wt * 0.7 + chk * 0.7 + B.ck * 0.4,
    jw: s.jw + w * 0.8 + wt * 0.8 + jaw * 1.6,
    ch: s.ch + w * 0.3 + wt * 0.3 + jaw * 0.9,
    jy: s.jy + chn * 0.5 + wt * 0.3,
    cy: s.cy + chn * 1.5 + wt * 0.3,
    nw: 10.4 + w * 2.6 + wt * 1.2,
    lean: clamp(0.5 - w * 0.35 - wt * 0.5 + chk * 0.35, 0, 1),
    soft: clamp(wt * 0.7 + w * 0.25, 0, 1),
    ey: 43.2, es: 6.8 + sv(look, 'esp') * 0.7, ez: 1 + sv(look, 'esz') * 0.13, eo: B.eo,
    by: 40.3 - sv(look, 'brh') * 1.2, rid: B.rid * (look.eyes === 'deep' ? 1.35 : 1),
    ny: 53.8 + sv(look, 'nsl') * 1.3, nwid: (NOSE_W[look.nose] ?? 3.6) * B.nk * (1 + sv(look, 'nsw') * 0.2),
    br: clamp(B.br + (NOSE_BR[look.nose] ?? 0), 0.15, 1.3),
    mwid: (MOUTH_W[look.mouth] ?? 5.2) * 1.04 * (1 + sv(look, 'mw') * 0.12), lipk: (1 + sv(look, 'lip') * 0.4) * B.lk,
  }
  G.my = 59.4 + sv(look, 'nsl') * 0.4 + chn * 0.35
  return G
}
// a shape mirrored down the middle: p0 on the middle line, segs the right side's curves down to the middle again
const pt = p => `${f1(p[0])} ${f1(p[1])}`, pt1 = pt
const mr = p => [100 - p[0], p[1]]
function sym(p0, segs) {
  let d = `M${pt(p0)}`
  for (const [a, b, c] of segs) d += `C${pt(a)} ${pt(b)} ${pt(c)}`
  for (let i = segs.length - 1; i >= 0; i--) { const [a, b] = segs[i]; d += `C${pt(mr(b))} ${pt(mr(a))} ${pt(mr(i ? segs[i - 1][2] : p0))}` }
  return d + 'Z'
}
// an open line mirrored: from the left of S, through the middle, to S (segs: S's side, from S to the middle)
function arc2(S, segs) {
  let d = `M${pt(mr(S))}`
  for (const [a, b, c] of segs) d += `C${pt(mr(a))} ${pt(mr(b))} ${pt(mr(c))}`
  for (let i = segs.length - 1; i >= 0; i--) { const [a, b] = segs[i]; d += `C${pt(b)} ${pt(a)} ${pt(i ? segs[i - 1][2] : S)}` }
  return d
}
// a smooth curve through points (Catmull-Rom as Béziers), closed by default
// (big, soft-edged shapes pass whole numbers: q)
const pq = p => `${Math.round(p[0])} ${Math.round(p[1])}`
function crv(p, close = true, q = false) {
  const n = p.length, at = i => (close ? p[(i + n) % n] : p[clamp(i, 0, n - 1)]), pt = q ? pq : pt1
  let d = `M${pt(p[0])}`
  // (the curve is smooth through every point, so after the first piece each one's first handle is the last one's
  // mirrored: S, two points a piece instead of three)
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2), h = pt([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])
    d += i ? `S${h} ${pt(c)}` : `C${pt([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${h} ${pt(c)}`
  }
  return close ? d + 'Z' : d
}
// an ellipse as path data (so many go in one path)
const ell = (x, y, rx, ry) => `M${f1(x - rx)} ${f1(y)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(rx * 2)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-rx * 2)} 0Z`
const stroke = (d, c, w, extra = '') => (d ? `<path d="${d}" fill="none" stroke="${c}" stroke-width="${String(w).replace(/^0\./, '.')}"${extra}/>` : '')
const fill = (d, c, extra = '') => (d ? `<path d="${d}" fill="${c}"${extra}/>` : '')
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) }
const headSegs = G => {
  const { cw, tw, cb, jw, jy, ch, cy, soft, lean } = G
  return [
    [[50 + cw * 0.6, TOP], [50 + cw, TOP + 6], [50 + cw, 31]],
    [[50 + cw, 34.4], [50 + tw + 0.1, 36.6], [50 + tw, 39]],
    [[50 + tw - 0.1, 41.6], [50 + cb, 43.4], [50 + cb, 46.6]],
    [[50 + cb - lean * 0.5, 50.4 + soft], [50 + jw + 0.6 + soft, jy - 4], [50 + jw, jy]],
    [[50 + jw - 0.9, jy + 2.2], [50 + ch + 2.6, cy - 1.6], [50 + ch, cy - 0.5]],
    [[50 + ch - 0.8, cy + 0.1], [50 + ch * 0.45, cy + 0.15], [50, cy + 0.15]],
  ]
}
const headD = G => sym([50, TOP], headSegs(G))
// the jaw, cheekbone to cheekbone under the chin (its ink is the heaviest line on him)
const jawD = G => { const s = headSegs(G); return arc2(s[2][2], s.slice(3)) }
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

// ── The features ─────────────────────────────────────────────────────────────
// Each feature adds its flat shapes to the head's three shading tones (S.sh the shadow, S.dk the deep creases, S.hl
// the light: one path each, so the whole face is a handful of elements) and returns its own drawing.
function eyesOf(look, G, T, S, P, lo) {
  const k = EYE[look.eyes] ?? EYE.almond, iris = look.iris ?? '#2b1a10', ring = shade(iris, 0.55)
  let wh = '', band = '', ir = '', pu = '', cl = '', lash = '', crease = '', lid = '', fold = ''
  for (const s of [-1, 1]) {
    const cx = 50 + s * G.es, y = G.ey, ew = 3.4 * G.ez, up = k[0] * G.ez * G.eo, dn = k[1] * G.ez * G.eo, tilt = k[2]
    const I = [cx - s * ew, y + 0.35], O = [cx + s * ew, y - tilt + 0.15]
    const u1 = [cx - s * ew * 0.5, y - up * 1.32], u2 = [cx + s * ew * 0.42, y - up * 1.3 - tilt * 0.4]
    const l1 = [cx + s * ew * 0.45, y + dn * 1.25], l2 = [cx - s * ew * 0.45, y + dn * 1.2]
    wh += `M${pt(I)}C${pt(u1)} ${pt(u2)} ${pt(O)}C${pt(l1)} ${pt(l2)} ${pt(I)}Z`
    // the upper lid's shadow across the top of the ball
    band += `M${pt(I)}C${pt(u1)} ${pt(u2)} ${pt(O)}L${pt([O[0], O[1] + 0.4])}C${pt([u2[0], u2[1] + up * 0.6 + 0.3])} ${pt([u1[0], u1[1] + up * 0.6 + 0.3])} ${pt([I[0], I[1] + 0.3])}Z`
    // the iris (its dark ring), the pupil, the catchlight up toward the key light
    const r = Math.min(1.34 * G.ez, (up + dn) * 0.66), ix = cx + s * 0.06, iy = y + 0.1
    ir += ell(ix, iy, r, r)
    pu += ell(ix, iy, r * 0.44, r * 0.44)
    cl += ell(ix - r * 0.42, iy - r * 0.42, r * 0.24, r * 0.24)
    // the lash line: heavy ink, thickest toward the outer corner, a flick past it
    lash += `M${pt([I[0] + s * 0.1, I[1] - 0.05])}C${pt([u1[0], u1[1] - 0.12])} ${pt([u2[0], u2[1] - 0.18])} ${pt([O[0] + s * 0.6, O[1] - 0.3])}L${pt([O[0] - s * 0.1, O[1] + 0.45])}C${pt([u2[0], u2[1] + 0.78])} ${pt([u1[0], u1[1] + 0.58])} ${pt([I[0] + s * 0.4, I[1] + 0.22])}Z`
    // the lid's crease (a deep-set eye's sits higher; a hooded eye's is a fold of skin over the outer lid)
    const ch = look.eyes === 'deep' ? 2.6 : look.eyes === 'narrow' ? 1.95 : 2.25
    if (look.eyes === 'hooded') {
      fold += `M${pt([cx - s * ew * 0.35, y - up * 1.75])}Q${f1(cx + s * ew * 0.7)} ${f1(y - up * 1.7)} ${pt([O[0] + s * 0.7, O[1] + 0.1])}Q${f1(cx + s * ew * 0.45)} ${f1(y - up * 0.9)} ${pt([cx - s * ew * 0.35, y - up * 1.75])}Z`
      crease += `M${pt([I[0] + s * 0.6, I[1] - up * 0.9])}Q${f1(cx - s * ew * 0.2)} ${f1(y - up * 1.8)} ${pt([cx + s * ew * 0.2, y - up * 1.25])}Q${f1(cx + s * ew * 0.6)} ${f1(y - up * 1.05)} ${pt([O[0] + s * 0.7, O[1] + 0.1])}`
    } else crease += `M${pt([I[0] + s * 0.7, I[1] - up * 0.95])}Q${f1(cx + s * 0.1)} ${f1(y - up * ch - 0.5)} ${pt([O[0] + s * 0.25, O[1] - up * 0.7])}`
    // the lower lid
    lid += `M${pt([O[0] - s * 0.5, O[1] + 0.5])}Q${f1(cx + s * 0.1)} ${f1(y + dn * 1.3 + 0.2)} ${pt([I[0] + s * 0.8, I[1] + 0.42])}`
    // the socket under the brow ridge (its shadow down to the crease) and the deep corner beside the bridge
    const rd = G.rid, sy = y - up * ch - 0.3
    S.sh += crv([[50 + s * 2, G.by + 1.2], [50 + s * (G.es - 0.6), G.by + 1.1], [50 + s * (G.es + ew + 0.5), G.by + 1.6], [O[0] + s * 0.9, O[1] - 0.5 - (1 - rd) * 0.8],
      [cx + s * ew * 0.4, sy + 0.2 - (1 - rd) * 1.2], [cx - s * ew * 0.3, sy - (1 - rd) * 1.2], [I[0] - s * 0.2, I[1] - 0.9], [50 + s * 1.7, y + 1.3 * rd]])
    S.dk += crv([[50 + s * 1.9, G.by + 2.4], [I[0] - s * 0.15, I[1] - 1.5], [I[0] - s * 0.35, I[1] + 0.35], [50 + s * 1.55, y + 0.4]])
    // the bag under the eye, with the years
    if (!lo && (look.ag ?? 24) >= 28) S.sh += `M${pt([I[0] + s * 0.6, I[1] + 1.2])}Q${f1(cx)} ${f1(y + dn * 1.3 + 1.9)} ${pt([O[0] - s * 0.2, O[1] + 1.1])}Q${f1(cx)} ${f1(y + dn * 1.3 + 1.1)} ${pt([I[0] + s * 0.6, I[1] + 1.2])}Z`
  }
  // (the eyes' shape is drawn once, in the defs: filled here and the clip for what's inside them)
  const clip = `<path id="${P}e" d="${wh}"/>`
  const eyes = `<use href="#${P}e" fill="${T.white}"/>`
    + `<g clip-path="url(#${P}E)">${fill(ir, iris, lo ? '' : ` stroke="${ring}" stroke-width=".3"`)}${fill(pu, '#070505')}${lo ? '' : fill(band, '#2a1a14', ' fill-opacity=".38"')}${fill(cl, '#ffffff')}</g>`
    + fill(lash, INK)
    + (fold ? fill(fold, T.sh) : '')
    + (lo ? '' : stroke(crease, T.line, 0.42) + stroke(lid, T.dk, 0.42))
  return { clip, eyes }
}
function browsOf(look, G) {
  const c = mixC(look.brow ?? look.hc, INK, 0.2)
  const t = { thick: 1.6, thin: 0.85, bushy: 1.85, straight: 1.2, arched: 1.1, angled: 1.25 }[look.brows] ?? 1.2
  const arch = { arched: 1.3, angled: 0.95, straight: 0.3, thick: 0.45, thin: 0.7, bushy: 0.4 }[look.brows] ?? 0.45
  let d = ''
  for (const s of [-1, 1]) {
    const y = G.by, x0 = 50 + s * 2.3, x1 = 50 + s * (G.es + 3.2 * G.ez + 1.5), at = u => x0 + (x1 - x0) * u
    const yi = y + (look.brows === 'angled' ? 1.3 : 0.8)
    d += crv([[x0, yi + t * 0.35], [at(0.35), y + 0.55 - arch * 0.4], [at(0.66), y + 0.15 - arch * 0.85], [x1, y + 1.1],
      [x1 - s * 0.7, y + 0.35], [at(0.64), y - arch - t * 0.75], [at(0.3), y - t * 0.85 - arch * 0.35], [x0 + s * 0.15, yi - t * 0.6]])
  }
  return fill(d, c)
}
function noseOf(look, G, T, S, lo) {
  const y = G.ny - (look.nose === 'short' ? 0.8 : 0), w = G.nwid, br = G.br
  // a high bridge starts its plane right under the brow; a low one only lower down
  const ys = G.by + 1.6 + (1 - br) * 5.2, xs = 51 + (1 - br) * 0.3, mid = (ys + y) / 2, pw = 0.85 + (1 - br) * 0.8
  // the side of the nose away from the light, from the bridge down round the wing
  S.sh += crv([[xs - 0.2, ys], [xs + pw, mid], [50 + w * 0.95, y - 2.6], [50 + w + 0.3, y - 0.6], [50 + w * 0.5, y - 0.9], [51.3, y - 2.2], [xs + 0.1, mid + 1]])
  // the wing on the lit side, the underside of the nose, its shadow thrown down on the lip
  if (!lo) S.sh += crv([[50 - w - 0.2, y - 2], [50 - w + 0.7, y - 2.6], [50 - w + 1.3, y - 0.6], [50 - w + 0.3, y + 0.6]])
  S.sh += crv([[50.4, y + 1.2], [50 + w * 0.8, y + 0.9], [50 + w * 0.5, y + 2.7], [51, y + 3.2]])
  // the underside: between the nostrils in deep shadow, the nostrils (a broad nose shows more of them)
  const nr = 0.55 + w * 0.12
  S.dk += `M${f1(50 - w * 0.75)} ${f1(y + 0.1)}C${f1(50 - w * 0.3)} ${f1(y + 1.3)} ${f1(50 + w * 0.3)} ${f1(y + 1.3)} ${f1(50 + w * 0.75)} ${f1(y + 0.1)}C${f1(50 + w * 0.3)} ${f1(y + 0.7)} ${f1(50 - w * 0.3)} ${f1(y + 0.7)} ${f1(50 - w * 0.75)} ${f1(y + 0.1)}Z`
  for (const s of [-1, 1]) S.dk += ell(50 + s * w * 0.44, y + 0.3, nr, 0.5)
  // the light down the bridge and on the ball of the tip
  S.hl += crv([[49.5, ys + 1], [49.95, mid + 0.4], [49.8, y - 3], [49, mid + 0.6]]) + ell(49.2, y - 1.7, 0.95 + w * 0.06, 0.65)
  if (look.nose === 'boxer') S.dk += crv([[50.2, ys + 2.4], [51.4, ys + 3.6], [50.7, ys + 4.4]])
  // the ink: round each wing into its nostril, the far edge of a high bridge
  let ink = ''
  for (const s of [-1, 1]) ink += `M${f1(50 + s * (w - 1.1))} ${f1(y - 2.7)}C${f1(50 + s * (w + 0.5))} ${f1(y - 2.2)} ${f1(50 + s * (w + 0.6))} ${f1(y + 0.4)} ${f1(50 + s * (w - 0.4))} ${f1(y + 0.8)}Q${f1(50 + s * w * 0.6)} ${f1(y + 1)} ${f1(50 + s * w * 0.3)} ${f1(y + 0.5)}`
  if (!lo && br > 0.6) ink += `M${f1(xs + 0.5)} ${f1(ys + 2.4)}Q${f1(xs + pw + 0.1)} ${f1(mid + 1)} ${f1(50 + w * 0.6)} ${f1(y - 3)}`
  return stroke(ink, T.line, lo ? 0.6 : 0.5)
}
function mouthOf(look, G, T, S, lo) {
  const y = G.my, w = G.mwid, k = G.lipk
  const up = ({ full: 1.75, thin: 0.8, wide: 1.25, stern: 1.05, smirk: 1.25 }[look.mouth] ?? 1.3) * k
  const dn = ({ full: 2.3, thin: 1.2, wide: 1.7, stern: 1.45, smirk: 1.7 }[look.mouth] ?? 1.75) * k
  const rise = look.mouth === 'smirk' ? 0.9 : 0, drop = look.mouth === 'stern' ? 0.5 : 0
  const L = [50 - w, y + drop], R = [50 + w, y - rise + drop]
  // the philtrum's far side, the shadow under the lower lip, the chin's light
  if (!lo) S.sh += crv([[50.6, G.ny + 2.6], [51.5, G.ny + 2.9], [51.3, y - up - 0.2], [50.6, y - up - 0.3]])
  const ly = y + dn * 1.15
  S.sh += `M${f1(50 - w * 0.7)} ${f1(ly + 0.5)}Q50 ${f1(ly + 2.4)} ${f1(50 + w * 0.75)} ${f1(ly + 0.4)}Q50 ${f1(ly + 1.1)} ${f1(50 - w * 0.7)} ${f1(ly + 0.5)}Z`
  let s = ''
  // the upper lip (turned down, in shade), the lower (turned up to the light, its highlight), the line between
  s += fill(`M${pt(L)}C${f1(50 - w * 0.62)} ${f1(y - up * 0.5)} ${f1(50 - w * 0.32)} ${f1(y - up * 1.05)} 48.9 ${f1(y - up)}Q50 ${f1(y - up * 0.7)} 51.1 ${f1(y - up)}C${f1(50 + w * 0.32)} ${f1(y - up * 1.05)} ${f1(50 + w * 0.62)} ${f1(y - up * 0.5 - rise)} ${pt(R)}Q50 ${f1(y + 0.5)} ${pt(L)}Z`, T.lipU)
  s += fill(`M${f1(L[0] + 0.5)} ${f1(L[1] + 0.1)}C${f1(50 - w * 0.55)} ${f1(y + dn * 1.2)} ${f1(50 + w * 0.55)} ${f1(y + dn * 1.2 - rise * 0.3)} ${f1(R[0] - 0.5)} ${f1(R[1] + 0.1)}Q50 ${f1(y + 0.6)} ${f1(L[0] + 0.5)} ${f1(L[1] + 0.1)}Z`, T.lipL)
  if (!lo) s += fill(crv([[47.4, y + dn * 0.55], [49.4, y + dn * 0.32], [51, y + dn * 0.5], [49.2, y + dn * 0.78]]), mixC(T.lipL, '#ffffff', T.d > 0.5 ? 0.16 : 0.22))
  s += stroke(`M${pt(L)}Q${f1(50 - w * 0.5)} ${f1(y + 0.6)} 50 ${f1(y + 0.4)}Q${f1(50 + w * 0.5)} ${f1(y + 0.6 - rise * 0.6)} ${pt(R)}`, INK, 0.6)
  if (!lo) s += stroke(`M${f1(L[0] - 0.5)} ${f1(L[1] - 0.6)}q.4 .5 .3 1.3M${f1(R[0] + 0.5)} ${f1(R[1] - 0.6)}q-.4 .5 -.3 1.3`, T.line, 0.4)
  return s
}
// the years: lines from the nose to the mouth, across the forehead, out from the eyes, a heavier jaw
function linesOf(look, G, T, S, lo) {
  const ag = look.ag ?? 24
  if (ag < 27) return ''
  const k = clamp((ag - 24) / 26, 0, 1), y = G.ny, my = G.my
  for (const s of [-1, 1]) {
    // the fold from the nose's wing to the corner of the mouth
    S.sh += crv([[50 + s * (G.nwid + 0.6), y - 1.6], [50 + s * (G.nwid + 2.6), y + 1.4], [50 + s * (G.mwid + 1.6), my + 1.2], [50 + s * (G.mwid + 0.9), my + 0.6], [50 + s * (G.nwid + 1.6 - k), y + 1.2]])
    if (ag >= 45) S.sh += crv([[50 + s * (G.jw - 2.6), G.jy - 2], [50 + s * (G.jw - 0.4), G.jy + 1], [50 + s * (G.ch + 2), G.cy - 1.6], [50 + s * (G.jw - 2.4), G.jy + 0.6]])
  }
  if (lo) return ''
  let d = ''
  if (ag >= 34 && !look.cap) d += `M43 31Q50 29.8 57 31M44.4 33.6Q50 32.6 55.6 33.6${ag >= 52 ? 'M45.6 28.6Q50 27.6 54.4 28.6' : ''}`
  if (ag >= 45) for (const s of [-1, 1]) { const x = 50 + s * (G.es + 3.9); d += `M${f1(x)} ${f1(G.ey - 0.8)}l${f1(s * 1.5)} -.7M${f1(x + s * 0.2)} ${f1(G.ey + 0.7)}l${f1(s * 1.5)} .5` }
  return stroke(d, T.sh, 0.45 + k * 0.15)
}

// ── Hair ─────────────────────────────────────────────────────────────────────
// a hair colour's cel tones: base, shadow, light (black hair takes a cool sheen), ink
function hairTones(hc) {
  const dark = lum(hc) < 70
  return { hc, hD: dark ? mixC(hc, '#000000', 0.5) : mixC(hc, '#1a0c06', 0.36), hL: dark ? mixC(hc, '#8a98b0', 0.42) : mixC(hc, '#fff6e2', 0.4), hI: dark ? '#060404' : mixC(hc, INK, 0.72) }
}
// tight coils: a scatter of little arcs
function coils(x0, x1, y0, y1, n, c, w = 0.45) {
  let d = ''
  for (let i = 0; i < n; i++) {
    const u = (i * 0.7548777 + 0.31) % 1, v = (i * 0.5698403 + 0.13) % 1
    d += `M${f1(x0 + (x1 - x0) * u)} ${f1(y0 + (y1 - y0) * v)}q.6 -.9 1.4 0`
  }
  return stroke(d, c, w)
}
function hairParts(look, G, T, P, lo) {
  const { hair } = look, { cw } = G, L = 50 - cw, R = 50 + cw
  const H = hairTones(look.hc === '#b8893c' ? '#16110e' : look.hc), { hc, hD, hL, hI } = H
  const tips = look.hc === '#b8893c' ? '#c99a48' : null
  const front = [], back = []
  // the one mass a cut is shaded on: the mass in its shadow tone, its lit part (the mass moved up and toward the
  // light, so a band along the hairline and the far edge stays in shadow), the far side, the light, the texture, the
  // ink round it
  const cel = (d, { hi = '', tex = '', c = H, w = 0.8, dy = 1.5 } = {}) => `<defs><path id="${P}m" d="${d}"/><clipPath id="${P}H"><use href="#${P}m"/></clipPath></defs><use href="#${P}m" fill="${c.hD}"/>`
    + `<g clip-path="url(#${P}H)"><use href="#${P}m" fill="${c.hc}" transform="translate(-.8 -${dy})"/>`
    + fill(`M${f1(50 + cw * 0.22)} -2C${f1(50 + cw * 0.55)} 10 ${f1(R)} 18 ${f1(R - 1.4)} 30L${f1(R - 3)} 92H104V-2Z`, c.hD)
    + hi + (lo ? '' : tex) + `</g><use href="#${P}m" fill="none" stroke="${c.hI}" stroke-width="${w}"/>`
  // a piece of hair outside the mass: flat, inked
  const flat = (d, c = hc, w = 0.7) => fill(d, c, ` stroke="${hI}" stroke-width="${w}"`)
  // the light on a smooth crop: a crescent over the crown toward the key light
  const band = (t = 1, c = hL) => fill(crv([[L + 1.6, TOP + 9.4 - t * 0.3], [L + 3.2, TOP + 3.6 - t * 0.6], [50 - cw * 0.3, TOP + 0.4 - t * 0.9], [50 + cw * 0.24, TOP - t + 1], [50 - cw * 0.28, TOP + 2 - t * 0.8], [L + 3.8, TOP + 5.6 - t * 0.5], [L + 2.6, TOP + 9.8 - t * 0.3]]), c)
  // the light on a cut with strands: a few sharp flicks swept with the hair
  const flicks = (list, c = hL, w = 0.55) => stroke(list.map(([x, y, dx, dy]) => `M${f1(x)} ${f1(y)}q${f1(dx * 0.3)} ${f1(dy * 0.6)} ${f1(dx)} ${f1(dy)}`).join(''), c, w)
  // the faded sides: two flat tones from the hair down into the skin (inside the head's ink line)
  const fadeSides = (o = {}) => fill(capD(G, { t: -5, line: 27.8, side: 45, tc: 0, ...o }), mixC(T.base, hc, T.d > 0.6 ? 0.6 : 0.5))
  // a line-up's hairline: square temple corners, a straight front
  const lineUp = (line, side) => `L${f1(R - 1.6)} ${f1(side)}L${f1(R - 2.4)} ${f1(line + 2.4)}L${f1(R - 3.2)} ${f1(line + 0.4)}Q50 ${f1(line - 0.9)} ${f1(L + 3.2)} ${f1(line + 0.4)}L${f1(L + 2.4)} ${f1(line + 2.4)}L${f1(L + 1.6)} ${f1(side)}Z`
  // a coily top: the dome's edge in little round bumps (t how far it stands off the skull, n bumps)
  const dome = ({ t = 2, line = 27.6, side = 31.5, n = 13, a0 = 1, a1 = 2 }) => {
    const rx = cw + 0.6 + t * 0.3, ry = 13.4 + t, y0 = TOP + 13.4
    const at = a => [50 + Math.cos(a) * rx, y0 + Math.sin(a) * ry]
    const first = at(Math.PI * a0), r = (Math.PI * (rx + ry) * 0.5 * (a1 - a0)) / n * 0.62
    let d = `M${f1(L + 1.6)} ${f1(side)}L${f1(first[0])} ${f1(Math.max(first[1], side))}L${pt(first)}`
    for (let i = 1; i <= n; i++) d += `A${f1(r)} ${f1(r)} 0 0 1 ${pt(at(Math.PI * (a0 + ((a1 - a0) * i) / n)))}`
    return d + `L${f1(R + 0.4)} ${f1(side)}` + lineUp(line, side)
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
    const lp = u => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
    for (let i = 0; i < n; i++) {
      const m = lp((i + 0.45) / n), p1 = lp((i + 1) / n), k = 0.75 + ((i * 5) % 3) / 4, tip = [m[0] + dx * k, m[1] + dy * k]
      d += `L${pt(tip)}Q${pt([(tip[0] + p1[0]) / 2 + dx * 0.15, (tip[1] + p1[1]) / 2 + dy * 0.15])} ${pt(p1)}`
    }
    return d
  }
  // a rope (a loc, a twist, a braid): ink under, the hair, a light broken line down it
  const ropes = (d, w, dash) => stroke(d, hI, w + 0.8) + stroke(d, hc, w) + (lo ? '' : stroke(d, hL, w * 0.4, ` stroke-dasharray="${dash}"`))
  // the coil light, up on the lit side of a coily cut
  const coilHi = (y0, y1, n = 9) => coils(L + 2.4, 50 + cw * 0.25, y0, y1, n, hL, 0.5)
  switch (hair) {
    case 'shaved':
      front.push(fill(capD(G, { t: -5, line: 27.8, side: 44, tc: 0 }), mixC(T.base, hc, T.d > 0.6 ? 0.26 : 0.16)))
      break
    case 'buzz': {
      const c = { hc: mixC(hc, T.base, 0.28), hD: mixC(hc, T.base, 0.1), hL: mixC(mixC(hc, T.base, 0.28), T.hl, 0.45), hI: mixC(hc, INK, 0.5) }
      front.push(cel(capD(G, { t: 0.4, line: 27.6, side: 43, tc: 0.3 }), { c: { ...c, hI: mixC(c.hD, INK, 0.4) }, hi: band(0.4, c.hL), w: 0.5, dy: 1 }))
      break
    }
    case 'crew':
      front.push(fadeSides(), cel(spiky({ t: 2, line: 27.2, side: 32, n: 13, amp: 0.9, fn: 9, fr: 1, sweep: 1 }), {
        hi: band(2) + flicks([[43, 25.4, -0.4, -3], [46, 24.6, -0.2, -3.2], [49, 24.2, 0, -3.3]]),
        tex: stroke(`M53 27.6l.2-3M56 28.2l.4-2.8M58.6 29l.5-2.6M54 22.4l.3-3M51.6 21.8l.1-3.2`, hD, 0.5),
      }))
      break
    case 'fade':
      front.push(fadeSides(), cel(dome({ t: 2.2, line: 27.6, side: 31.5, n: 13 }), { hi: coilHi(TOP - 1.5, TOP + 8), tex: coils(50, R - 4, TOP + 1, 28, 7, hD, 0.5) }))
      break
    case 'frohawk':
      front.push(fadeSides({ side: 46 }), cel(`M${f1(L + 7)} 29C${f1(L + 5.4)} 16 ${f1(L + 7)} 8.2 50 7.4C${f1(R - 7)} 8.2 ${f1(R - 5.4)} 16 ${f1(R - 7)} 29Q50 26.8 ${f1(L + 7)} 29Z`,
        { hi: coils(L + 8, 50, 9, 18, 10, hL, 0.5), tex: coils(50, R - 9, 12, 26, 8, hD, 0.5) }))
      break
    case 'waves': {
      let d = '', e = ''
      // 360 waves: rings of ripples round the crown, each a light crest over a dark trough
      for (let i = 0; i < 6; i++) {
        const ry = 2.4 + i * 2.1, rx = 5 + i * 2.7, n = 3 + i
        let w = `M${f1(50 - rx)} ${f1(TOP + ry + 1.4)}`
        for (let j = 1; j <= n * 2; j++) { const x = 50 - rx + (2 * rx * j) / (n * 2), xm = x - rx / (n * 2), u = (x - 50) / rx, um = (xm - 50) / rx; w += `Q${f1(xm)} ${f1(TOP + ry + 1.4 * um * um - (j % 2 ? 0.8 : -0.8))} ${f1(x)} ${f1(TOP + ry + 1.4 * u * u)}` }
        if (i < 4) d += w
        e += w.replace(/(\d) (\d+(\.\d)?)/g, (m, a, b) => `${a} ${f1(+b + 0.9)}`)
      }
      front.push(fadeSides({ side: 44 }), cel(`M${f1(L + 1.6)} 33L${f1(L - 0.4)} 33C${f1(L - 0.6)} ${TOP + 3} ${f1(50 - cw * 0.6)} ${TOP - 1} 50 ${TOP - 1}C${f1(50 + cw * 0.6)} ${TOP - 1} ${f1(R + 0.6)} ${TOP + 3} ${f1(R + 0.4)} 33` + lineUp(27.6, 33), { hi: stroke(d, hL, 0.6), tex: stroke(e, hD, 0.7) }))
      break
    }
    case 'sidepart':
      front.push(fadeSides({ side: 44 }), cel(spiky({ t: 3.2, line: 26.6, side: 33, n: 6, amp: 1.5, fn: 5, fr: 1.2, lift: 2.2, sweep: 1 }), {
        hi: band(3.4) + stroke(`M45.4 ${TOP - 2.6}Q55 ${TOP - 3.4} ${f1(R - 1)} ${TOP + 6}M46.2 ${TOP + 4}Q55 ${TOP + 2.4} ${f1(R - 3)} ${TOP + 12.4}`, hL, 0.55),
        tex: stroke(`M43.4 ${TOP - 3}Q42 ${TOP + 3} 43 ${TOP + 10}`, hI, 0.7) + stroke(`M45.6 ${TOP - 1}Q55 ${TOP - 1.8} ${f1(R - 1.6)} ${TOP + 8}M46.4 ${TOP + 5.6}Q55 ${TOP + 4} ${f1(R - 3.6)} ${TOP + 13}`, hD, 0.5),
      }))
      break
    case 'textured':
      front.push(fadeSides({ side: 44 }), cel(spiky({ t: 3.4, line: 27, side: 32, n: 8, amp: 2.2, fn: 6, fr: 2.4, sweep: -1 }), {
        hi: flicks([[41.6, TOP + 6, -1.2, -7], [45.4, TOP + 5, -0.8, -7.6], [49.4, TOP + 5, -0.2, -7.6]], hL, 0.7),
        tex: stroke(`M53 ${TOP + 6}l.6-7.6M57 ${TOP + 7}l1-7M60 ${TOP + 9}l1.1-6`, hD, 0.55),
      }))
      break
    case 'curly': {
      const pts = [[L + 2.6, 28.2], [L + 4.6, 23.2], [L + 8.2, 19.4], [44.4, 17], [50, 16], [55.6, 17], [R - 8.2, 19.4], [R - 4.6, 23.2], [R - 2.6, 28.2], [43, 27.4], [48.4, 27.8], [53.6, 27.6]]
      let c = '', h = ''
      for (const [x, y] of pts) { c += ell(x, y, 2.7, 2.6); h += `M${f1(x - 1.6)} ${f1(y - 0.4)}q1.1 -1.7 2.8 -.6` }
      front.push(fadeSides({ side: 44 }), cel(capD(G, { t: 1.6, line: 28.4, side: 32, tc: 0.8 }), { hi: band(1.6) }), fill(c, hc, ` stroke="${hI}" stroke-width=".6"`), lo ? '' : stroke(h, hL, 0.5))
      break
    }
    case 'afro': {
      // a round mass, its edge in bumps, behind the head; the front of it over the forehead
      const rx = cw + 7.2, ry = cw + 3.6, cx = 50, cy = 25, n = 18, a0 = 0.9, a1 = 2.1
      const at = a => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], r = (Math.PI * (rx + ry) * 0.5 * (a1 - a0)) / n * 0.62
      let d = `M${pt(at(Math.PI * a0))}`
      for (let i = 1; i <= n; i++) d += `A${f1(r)} ${f1(r)} 0 0 1 ${pt(at(Math.PI * (a0 + ((a1 - a0) * i) / n)))}`
      d += `C${f1(R + 5)} 42 ${f1(R + 2)} 44 ${f1(R)} 44L${f1(L)} 44C${f1(L - 2)} 44 ${f1(L - 5)} 42 ${pt(at(Math.PI * a0))}Z`
      back.push(cel(d, { hi: coils(cx - rx + 3, 50, cy - ry + 1, cy - 4, 16, hL, 0.55), tex: coils(52, cx + rx - 4, cy - ry + 4, 36, 14, hD, 0.5), w: 0.9, dy: 2 }))
      front.push(fill(capD(G, { t: 1, line: 28, side: 40, tc: 1 }), hc), lo ? '' : coils(L + 3, 50, TOP + 2, 27, 8, hL, 0.5), stroke(`M${f1(L + 1.6)} 33Q${f1(L + 3)} 28.6 ${f1(L + 6)} 28Q50 26.6 ${f1(R - 6)} 28Q${f1(R - 3)} 28.6 ${f1(R - 1.6)} 33`, hI, 0.6))
      break
    }
    case 'hightop':
      front.push(fadeSides({ side: 45 }), cel(`M${f1(L + 1.4)} 31L${f1(L + 2.2)} 7.4Q${f1(L + 2.4)} 5 ${f1(L + 5)} 5L${f1(R - 5)} 5Q${f1(R - 2.4)} 5 ${f1(R - 2.2)} 7.4L${f1(R - 1.4)} 31C${f1(R - 3)} 29 ${f1(R - 5)} 27.6 ${f1(50 + 6)} 27.4L50 27.2L${f1(50 - 6)} 27.4C${f1(L + 5)} 27.6 ${f1(L + 3)} 29 ${f1(L + 1.4)} 31Z`,
        { hi: fill(`M${f1(L + 2.6)} 6.6H${f1(R - 6)}V8.4H${f1(L + 2.7)}Z`, hL) + coils(L + 3, 50, 9, 22, 12, hL, 0.5), tex: coils(50, R - 4, 10, 26, 12, hD, 0.5) }))
      break
    case 'twists': case 'locs': {
      const long = hair === 'locs'
      front.push(fadeSides({ side: long ? 40 : 45 }), cel(capD(G, { t: 0.8, line: 27.8, side: long ? 40 : 31, tc: 0.4 }), { hi: band(0.8) }))
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
      front.push(fill(capD(G, { t: -5, line: 27.6, side: 40, tc: 0.4 }), mixC(T.base, hc, 0.7)))
      let d = ''
      for (const x of [L + 2.6, L + 6.6, 45.4, 50, 54.6, R - 6.6, R - 2.6]) d += `M${f1(x)} 28.4Q${f1((x + 50) / 2 + (x - 50) * 0.3)} 21 ${f1(50 + (x - 50) * 0.45)} ${f1(TOP - 0.6)}`
      front.push(ropes(d, 1.9, '.9 .5'))
      back.push(ropes(`M${f1(L + 1.6)} 40Q${f1(L + 0.6)} 56 ${f1(L + 1.4)} 72M${f1(L + 4.6)} 42Q${f1(L + 4)} 58 ${f1(L + 4.6)} 74M${f1(R - 1.6)} 40Q${f1(R - 0.6)} 56 ${f1(R - 1.4)} 72M${f1(R - 4.6)} 42Q${f1(R - 4)} 58 ${f1(R - 4.6)} 74`, 2.4, '.9 .5'))
      break
    }
    case 'flow': case 'mullet': case 'long': {
      const to = hair === 'long' ? 79 : hair === 'flow' ? 62 : 72
      // behind: the hair falling to the neck (or the shoulders), its ends in clumps, the far half in shadow
      back.push(flat(`M${f1(L - 2.6)} 38C${f1(L - 3.6)} 22 ${f1(50 - cw * 0.6)} ${TOP - 3} 50 ${TOP - 3}C${f1(50 + cw * 0.6)} ${TOP - 3} ${f1(R + 3.6)} 22 ${f1(R + 2.6)} 38L${f1(R + 3.4)} ${to - 5}`
        + tipsE([R + 3.4, to - 5], [R - 2.6, to - 3], 3, 0.6, 2.6) + `L${f1(R - 3)} 50L${f1(L + 3)} 50L${f1(L + 2.6)} ${to - 3}` + tipsE([L + 2.6, to - 3], [L - 3.4, to - 5], 3, -0.6, 2.6) + 'Z', hc, 0.8))
      back.push(fill(`M${f1(R - 2)} 36L${f1(R + 3)} 40L${f1(R + 3.2)} ${to - 5}L${f1(R - 2.4)} ${to - 4}Z`, hD))
      if (!lo) back.push(stroke(`M${f1(L - 1.6)} 40Q${f1(L - 2.8)} 52 ${f1(L - 1.4)} ${to - 4}`, hL, 0.6) + stroke(`M${f1(L + 0.4)} 44Q${f1(L - 0.6)} 54 ${f1(L + 0.6)} ${to - 5}M${f1(R + 1.2)} 44Q${f1(R + 1.8)} 54 ${f1(R + 0.8)} ${to - 5}`, hI, 0.5))
      if (hair === 'flow') {
        // flow: swept back off the forehead, tucked behind the ears, out the back to the neck
        front.push(cel(spiky({ t: 3, line: 26.8, side: 37, n: 9, amp: 1.3, fn: 6, fr: 0.9, sweep: -1, lift: 0.8 }), {
          hi: band(3) + flicks([[42.4, TOP + 9, 1.6, -9], [46, TOP + 9.4, 2.4, -9.4], [49.6, TOP + 9.6, 3, -9.6]], hL, 0.6),
          tex: stroke(`M53.4 ${TOP + 10}q2.4 -4 4.6 -7M57 ${TOP + 11}q2 -3 3.4 -5.4`, hD, 0.5),
        }))
        break
      }
      if (hair === 'mullet') {
        front.push(fadeSides({ side: 44 }), cel(spiky({ t: 2.4, line: 27.2, side: 34, n: 10, amp: 1.1, fn: 7, fr: 1.4, sweep: -1 }), { hi: band(2.4) + flicks([[44, TOP + 6, -0.6, -6], [48.4, TOP + 5, -0.2, -6.4]]) }))
        break
      }
      // in front: the top, parted, falling past the temples in two curtains with clumped ends
      const sy = hair === 'long' ? 51 : 45, part = hair === 'long' ? 50 : 47.6
      const d = `M${f1(L - 1)} ${sy}C${f1(L - 2)} ${TOP + 4} ${f1(50 - cw * 0.62)} ${TOP - 3.4} 50 ${TOP - 3.4}C${f1(50 + cw * 0.62)} ${TOP - 3.4} ${f1(R + 2)} ${TOP + 4} ${f1(R + 1)} ${sy}`
        + tipsE([R + 1, sy], [R - 2.2, sy - 3.6], 2, -0.2, 2.2)
        + `C${f1(R - 2.6)} 35 ${f1(R - 4)} 28.6 ${f1(part + 7)} 27.8C${f1(part + 3)} 27.4 ${f1(part + 0.6)} 26.4 ${f1(part)} 24.6C${f1(part - 1.4)} 27 ${f1(part - 4)} 27.8 ${f1(L + 5)} 29.8C${f1(L + 2.8)} 31.6 ${f1(L + 2.2)} 36 ${f1(L + 2.2)} ${f1(sy - 3.6)}`
        + tipsE([L + 2.2, sy - 3.6], [L - 1, sy], 2, 0.2, 2.2) + 'Z'
      front.push(cel(d, {
        hi: stroke(`M${part - 1.4} ${TOP - 1}Q${part - 7} 20 ${f1(L + 1.4)} 31M${part - 3.4} ${TOP}Q${part - 9} 22 ${f1(L + 0.8)} 36`, hL, 0.7),
        tex: stroke(`M${part} ${TOP - 2}Q${part - 1} 21 ${part} 24.4M${part + 2.6} ${TOP - 1}Q${part + 8} 21 ${f1(R - 1.6)} 31M${f1(R - 1.4)} 34Q${f1(R - 1)} 42 ${f1(R - 1.6)} ${sy - 3}`, hI, 0.5),
      }))
      break
    }
    case 'receding':
      front.push(fadeSides({ side: 43, line: 25, rec: 1 }), cel(capD(G, { t: 1, line: 25.4, side: 31, tc: 0.8, rec: 1.2 }), { hi: band(1), tex: stroke(`M53 24.4l.2-2.8M56 24.6l.4-2.6`, hD, 0.45) }))
      break
    case 'balding':
      for (const s of [-1, 1]) front.push(flat(`M${f1(50 + s * (cw + 0.6))} 42C${f1(50 + s * (cw + 1.2))} 34 ${f1(50 + s * (cw + 0.4))} 28.4 ${f1(50 + s * (cw - 2.2))} 25.4C${f1(50 + s * (cw - 3.2))} 28 ${f1(50 + s * (cw - 2.6))} 34 ${f1(50 + s * (cw - 1.6))} 40Z`, s > 0 ? hD : hc, 0.6))
      break
    case 'bun':
      back.push(flat(ell(50, TOP - 3.4, 5.6, 4.2)), lo ? '' : stroke(`M46 ${f1(TOP - 4)}q4 -2.6 8 0`, hL, 0.6))
      front.push(fadeSides({ side: 44 }), cel(capD(G, { t: 0.9, line: 27.6, side: 33, tc: 0.6 }), { hi: band(0.9), tex: stroke(`M${f1(L + 3)} 31Q${f1(L + 5)} 21 49 ${TOP}M54 28.6Q55 21 50.6 ${TOP + 0.4}M${f1(R - 3)} 31Q${f1(R - 5)} 21 51 ${TOP}`, hD, 0.5) }))
      break
  }
  // a bare or close-cut scalp catches the light in one crisp shape
  if (hair === 'shaved' || hair === 'balding') front.push(fill(crv([[42.2, TOP + 6.4], [44.4, TOP + 2.6], [49.4, TOP + 1.2], [47.6, TOP + 3.4], [44.2, TOP + 7.2]]), T.hl))
  return { front: front.join(''), back: back.join('') }
}

// ── Facial hair ──────────────────────────────────────────────────────────────
// the beard's ground: its outer edge on the head's own edge (a touch outside it) from the sideburns round the jaw,
// past the chin by its length; its edge on the cheek a diagonal from the sideburn to the corner of the mouth (cl: 0 a
// high, full cheek line … 1 a low one), then under the lower lip
function beardArea(G, len, cl) {
  const { cw, cb, jw, jy, ch, cy, my, mwid, soft, tw } = G
  const by = cy + len, bw = ch + 0.8 + len * 0.12, lo = len > 5 ? 1.6 : 0
  const segs = [
    [[50 + tw + 0.2, 42], [50 + cb + 0.4, 44.2], [50 + cb + 0.35, 47]],
    [[50 + cb + 0.35, 51.2], [50 + jw + 0.9 + soft * 1.2, jy - 3], [50 + jw + 0.45, jy + 0.2]],
    [[50 + jw - 1 + soft * 0.8, jy + 3 + len * 0.5], [50 + bw + 2.2, by - 0.6], [50 + bw, by]],
    [[50 + bw - 1.4, by + 0.4 + lo], [51.8, by + 0.8 + lo], [50, by + 0.8 + lo]],
  ]
  const x0 = 50 + tw + 0.3
  let d = `M${f1(x0)} 38.6`
  for (const [a, b, c] of segs) d += `C${pt(a)} ${pt(b)} ${pt(c)}`
  for (let i = segs.length - 1; i >= 0; i--) { const [a, b] = segs[i]; d += `C${pt(mr(b))} ${pt(mr(a))} ${pt(mr(i ? segs[i - 1][2] : [x0, 38.6]))}` }
  const ix = tw - 1.6, mx = mwid + 1.3
  const side = sd => [[50 + sd * (ix - cl * 1.4), 44 + cl * 4], [50 + sd * (mx + 3.2 - cl), my - 5.4 + cl * 2], [50 + sd * mx, my - 1.2]]
  const [a, b, c] = side(-1)
  d += `L${f1(50 - ix)} 38.6C${pt(a)} ${pt(b)} ${pt(c)}`
  d += `C${f1(50 - mwid - 0.6)} ${f1(my + 1.8)} 47.6 ${f1(my + 2.5)} 50 ${f1(my + 2.5)}C52.4 ${f1(my + 2.5)} ${f1(50 + mwid + 0.6)} ${f1(my + 1.8)} ${pt([50 + mx, my - 1.2])}`
  const [a2, b2] = side(1)
  return d + `C${pt(b2)} ${pt(a2)} ${f1(50 + ix)} 38.6Z`
}
function beardOf(look, G, T, P, lo) {
  const H = hairTones(look.bc ?? look.brow ?? look.hc), { hD, hL, hI } = H, { cy, my, jw, jy, mwid } = G
  // (a black beard is lifted a little toward its sheen, so it reads as hair on any skin, not as a black shape)
  const hc = lum(H.hc) < 70 ? mixC(H.hc, hL, 0.48) : H.hc
  const body = (len, cl) => {
    // cel: the beard in shadow, its lit part (moved up toward the light, so its underside stays dark), the far
    // side, a few strokes of grain catching the light, the ink round it
    let g = ''
    for (let i = 0; i < 9; i++) { const a = -0.95 + i * 0.15, x = 50 + a * (jw - 1.5), yy = jy + (cy - jy) * (1 - a * a) + len * 0.5 - 3; g += `M${f1(x)} ${f1(yy - 1.8 - len * 0.2)}l${f1(a * 0.5)} ${f1(1.8 + len * 0.25)}` }
    return `<defs><path id="${P}B" d="${beardArea(G, len, cl)}"/><clipPath id="${P}Q"><use href="#${P}B"/></clipPath></defs><use href="#${P}B" fill="${H.hc}"/>`
      + `<g clip-path="url(#${P}Q)"><use href="#${P}B" fill="${hc}" transform="translate(-.6 -${f1(1.2 + len * 0.15)})"/>${fill(`M${f1(50 + jw * 0.4)} 36C${f1(50 + jw * 0.62)} 50 ${f1(50 + jw * 0.45)} 60 ${f1(52.5)} 82H100V36Z`, lum(H.hc) < 70 ? H.hc : hD)}${lo ? '' : stroke(g, hL, 0.5)}</g>`
      + `<use href="#${P}B" fill="none" stroke="${hI}" stroke-width=".7"/>`
  }
  switch (look.beard) {
    case 'stubble': {
      // a shadow of hair, not a shape: one flat tone between the skin's shadow and the hair
      const d = beardArea(G, 0.3, 0.8) + `M${f1(50 - mwid - 0.4)} ${f1(my - 0.8)}C${f1(50 - mwid + 0.4)} ${f1(G.ny + 2.8)} 47 ${f1(G.ny + 2.2)} 50 ${f1(G.ny + 2.4)}C53 ${f1(G.ny + 2.2)} ${f1(50 + mwid - 0.4)} ${f1(G.ny + 2.8)} ${f1(50 + mwid + 0.4)} ${f1(my - 0.8)}Q50 ${f1(my - 1.6)} ${f1(50 - mwid - 0.4)} ${f1(my - 0.8)}Z`
      return fill(d, mixC(T.base, mixC(H.hc, '#3a3f4c', T.d < 0.5 && lum(H.hc) < 120 ? 0.3 : 0), T.d > 0.6 ? 0.36 : 0.24))
    }
    case 'short': return body(1, 0.75)
    case 'full': return body(3.4, 0.2)
    case 'long': return body(9, 0.1) + (lo ? '' : stroke(`M46 ${f1(cy + 3)}q.4 3 1 6.4M50 ${f1(cy + 4)}v7.4`, hL, 0.5))
    case 'chin': {
      // a strap along the jaw line, sideburn to sideburn
      const d = `M${f1(50 - G.tw)} 38.6C${f1(50 - G.tw)} 44 ${f1(50 - G.cb)} 45 ${f1(50 - G.cb)} 48C${f1(50 - G.cb)} 52 ${f1(50 - jw - 0.5)} ${f1(jy - 3)} ${f1(50 - jw)} ${f1(jy)}C${f1(50 - jw + 1.5)} ${f1(jy + 3)} ${f1(50 - G.ch - 2)} ${f1(cy - 0.6)} 50 ${f1(cy + 0.4)}C${f1(50 + G.ch + 2)} ${f1(cy - 0.6)} ${f1(50 + jw - 1.5)} ${f1(jy + 3)} ${f1(50 + jw)} ${f1(jy)}C${f1(50 + jw + 0.5)} ${f1(jy - 3)} ${f1(50 + G.cb)} 52 ${f1(50 + G.cb)} 48C${f1(50 + G.cb)} 45 ${f1(50 + G.tw)} 44 ${f1(50 + G.tw)} 38.6`
      return `<g clip-path="url(#${P}C)">${stroke(d, hI, 5.4)}${stroke(d, hc, 4.2)}</g>`
    }
    case 'goatee': {
      const w = mwid + 0.5
      const d = `M${f1(50 - w)} ${f1(my + 0.6)}C${f1(50 - w)} ${f1(cy)} 47 ${f1(cy + 2.4)} 50 ${f1(cy + 2.4)}C53 ${f1(cy + 2.4)} ${f1(50 + w)} ${f1(cy)} ${f1(50 + w)} ${f1(my + 0.6)}C${f1(50 + w - 1.4)} ${f1(my + 2.6)} 51.6 ${f1(my + 2.9)} 50 ${f1(my + 2.9)}C48.4 ${f1(my + 2.9)} ${f1(50 - w + 1.4)} ${f1(my + 2.6)} ${f1(50 - w)} ${f1(my + 0.6)}Z`
      return fill(d, hc, ` stroke="${hI}" stroke-width=".6"`) + fill(`M50.6 ${f1(my + 3)}C${f1(50 + w - 1)} ${f1(my + 3)} ${f1(50 + w - 0.2)} ${f1(cy)} 50.6 ${f1(cy + 2.1)}Z`, H.hc) + (lo ? '' : stroke(`M47.4 ${f1(cy - 1.4)}l.3 2.6M49.2 ${f1(cy - 1)}v2.6`, hL, 0.45))
    }
    case 'patch': return fill(`M48.5 ${f1(my + 2.9)}Q50 ${f1(my + 2.4)} 51.5 ${f1(my + 2.9)}L50.9 ${f1(my + 5.8)}Q50 ${f1(my + 6.4)} 49.1 ${f1(my + 5.8)}Z`, hc, ` stroke="${hI}" stroke-width=".5"`)
    default: return ''
  }
}
function stacheOf(look, G) {
  const H = hairTones(look.bc ?? look.brow ?? look.hc), y = G.my - 1.1 * G.lipk - 0.5, w = G.mwid
  const ink = ` stroke="${H.hI}" stroke-width=".5"`
  switch (look.stache) {
    case 'thin': return fill(`M${f1(50 - w + 0.6)} ${f1(y + 0.5)}Q50 ${f1(y - 1.4)} ${f1(50 + w - 0.6)} ${f1(y + 0.5)}Q50 ${f1(y - 0.3)} ${f1(50 - w + 0.6)} ${f1(y + 0.5)}Z`, H.hc)
    case 'full': return fill(`M${f1(50 - w - 0.8)} ${f1(y + 1.6)}C${f1(50 - w)} ${f1(y - 1.4)} 47.6 ${f1(y - 2.4)} 50 ${f1(y - 1.5)}C52.4 ${f1(y - 2.4)} ${f1(50 + w)} ${f1(y - 1.4)} ${f1(50 + w + 0.8)} ${f1(y + 1.6)}C${f1(50 + w - 2)} ${f1(y + 0.6)} ${f1(50 - w + 2)} ${f1(y + 0.6)} ${f1(50 - w - 0.8)} ${f1(y + 1.6)}Z`, H.hc, ink)
      + fill(`M50 ${f1(y - 1.4)}C52.4 ${f1(y - 2.2)} ${f1(50 + w)} ${f1(y - 1.2)} ${f1(50 + w + 0.6)} ${f1(y + 1.3)}C${f1(50 + w - 2)} ${f1(y + 0.5)} 52 ${f1(y + 0.5)} 50 ${f1(y + 0.4)}Z`, H.hD)
    case 'horseshoe': return fill(`M${f1(50 - w - 0.6)} ${f1(y + 1.4)}C${f1(50 - w)} ${f1(y - 1.4)} 47.6 ${f1(y - 2.3)} 50 ${f1(y - 1.4)}C52.4 ${f1(y - 2.3)} ${f1(50 + w)} ${f1(y - 1.4)} ${f1(50 + w + 0.6)} ${f1(y + 1.4)}L${f1(50 + w + 0.9)} ${f1(G.my + 6)}L${f1(50 + w - 0.7)} ${f1(G.my + 6)}L${f1(50 + w - 0.8)} ${f1(y + 1.8)}C52 ${f1(y + 0.6)} 48 ${f1(y + 0.6)} ${f1(50 - w + 0.8)} ${f1(y + 1.8)}L${f1(50 - w + 0.7)} ${f1(G.my + 6)}L${f1(50 - w - 0.9)} ${f1(G.my + 6)}Z`, H.hc, ink)
    default: return ''
  }
}

// ── Gear ─────────────────────────────────────────────────────────────────────
function eyeBlackOf(look, G) {
  if (!look.eb || look.eb === 'none') return ''
  let d = ''
  for (const s of [-1, 1]) {
    const x = 50 + s * G.es, y = G.ey + 3.4 * G.ez + 0.5
    d += look.eb === 'paint' ? `M${f1(x - 3.5)} ${f1(y)}C${f1(x - 1.4)} ${f1(y - 0.5)} ${f1(x + 1.4)} ${f1(y - 0.5)} ${f1(x + 3.5)} ${f1(y)}L${f1(x + 3.1)} ${f1(y + 2.3)}C${f1(x + 1)} ${f1(y + 2.7)} ${f1(x - 1)} ${f1(y + 2.7)} ${f1(x - 3.1)} ${f1(y + 2.3)}Z`
      : `M${f1(x - 3.3)} ${f1(y - 0.2 + s * 0.2)}L${f1(x + 3.3)} ${f1(y - 0.2 - s * 0.2)}L${f1(x + 3.3)} ${f1(y + 2.2 - s * 0.2)}L${f1(x - 3.3)} ${f1(y + 2.2 + s * 0.2)}Z`
  }
  return fill(d, '#141417')
}
function headGearOf(look, G, color) {
  const { cw } = G, L = 50 - cw, R = 50 + cw
  switch (look.gear) {
    case 'headband': {
      const d = `M${f1(L - 1)} 30.4C${f1(L - 0.2)} 25.2 ${f1(R + 0.2)} 25.2 ${f1(R + 1)} 30.4L${f1(R + 0.8)} 35C${f1(R - 1.6)} 31 ${f1(L + 1.6)} 31 ${f1(L - 0.8)} 35Z`
      return fill(d, '#f2f3f5', ` stroke="${INK}" stroke-width=".7"`) + fill(`M${f1(R - 6)} 27.4C${f1(R - 2)} 28 ${f1(R + 0.6)} 29.4 ${f1(R + 0.9)} 31.6L${f1(R + 0.8)} 35C${f1(R - 1.6)} 31.6 ${f1(R - 4)} 30.4 ${f1(R - 6)} 30Z`, '#b9bdc6') + stroke(`M${f1(L)} 32.2C${f1(L + 2)} 28.6 ${f1(R - 2)} 28.6 ${f1(R)} 32.2`, color, 1.1)
    }
    case 'durag': {
      const d = capD(G, { t: 1.4, line: 27.2, side: 40, tc: 1 })
      return fill(d, '#1b1c22', ` stroke="${INK}" stroke-width=".8"`) + fill(`M${f1(50 + cw * 0.3)} ${TOP - 1}C${f1(R)} ${TOP + 2} ${f1(R + 1.6)} 30 ${f1(R + 1.4)} 40L${f1(R - 1.4)} 39C${f1(R - 1)} 30 ${f1(R - 3)} 22 ${f1(50 + cw * 0.2)} ${TOP + 1}Z`, '#0c0c0f')
        + stroke(`M${f1(L + 2)} 27Q${f1(L + 6)} 18 47 ${TOP - 0.4}M43 ${TOP + 2}Q${f1(L + 4)} 22 ${f1(L + 2.4)} 31`, '#6a7080', 0.9) + stroke(`M50 ${TOP - 1.2}V27.2`, '#000000', 0.5)
    }
    case 'visor': return visorOf(G, color)
    default: return ''
  }
}
function visorOf(G, color) {
  const { cw } = G, L = 50 - cw, R = 50 + cw
  const band = `M${f1(L - 1.2)} 31.4C${f1(L - 0.6)} 26.6 ${f1(R + 0.6)} 26.6 ${f1(R + 1.2)} 31.4L${f1(R + 0.8)} 34.2C${f1(R - 2)} 30.6 ${f1(L + 2)} 30.6 ${f1(L - 0.8)} 34.2Z`
  const brim = `M${f1(L + 0.6)} 32.4C${f1(L + 4)} 29.2 ${f1(R - 4)} 29.2 ${f1(R - 0.6)} 32.4C${f1(R - 3)} 37.4 ${f1(L + 3)} 37.4 ${f1(L + 0.6)} 32.4Z`
  const ink = ` stroke="${INK}" stroke-width=".8"`
  // the brim's shadow over the brow, the band, the brim
  return fill(`M${f1(L + 0.4)} 33C${f1(L + 4)} 37.6 ${f1(R - 4)} 37.6 ${f1(R - 0.4)} 33L${f1(R - 0.6)} 38.6C${f1(R - 5)} 40.4 ${f1(L + 5)} 40.4 ${f1(L + 0.6)} 38.6Z`, '#000000', ' fill-opacity=".28"')
    + fill(band, color, ink) + fill(brim, shade(color, 0.4), ink) + stroke(`M${f1(L + 2)} 32.6C${f1(L + 5)} 30.2 ${f1(R - 5)} 30.2 ${f1(R - 2)} 32.6`, lite(color, 0.35), 0.5)
}
function earringsOf(look, G) {
  if (!look.ear || look.ear === 'none') return ''
  const one = s => { const x = 50 + s * (G.tw + 0.6), y = 51.6; return ell(x, y, 0.95, 0.95) }
  return fill(look.ear === 'stud' ? one(-1) : one(-1) + one(1), '#e8eef8', ` stroke="${INK}" stroke-width=".35"`)
}
function chainOf(look, G) {
  if (!look.chain || look.chain === 'none') return ''
  const c = look.chain === 'gold' ? ['#8a6418', '#e8c25a'] : ['#6d727c', '#e2e6ee']
  const d = `M${f1(50 - G.nw + 1)} 66.4Q${f1(50 - G.nw * 0.5)} 74.6 50 75.4Q${f1(50 + G.nw * 0.5)} 74.6 ${f1(50 + G.nw - 1)} 66.4`
  return stroke(d, c[0], 1.2) + stroke(d, c[1], 0.7, ' stroke-dasharray=".8 .5"')
}

// ── A coach's pieces ─────────────────────────────────────────────────────────
// the top: a polo in the team's colour (its collar open at the neck, the placket's buttons) or a quarter-zip (dark,
// the stand-up collar in the team's colour, the zip)
function topOf(look, G, color, P, lo) {
  const { nw } = G
  const polo = look.top === 'polo'
  const top = polo ? mixC(color, '#0b0c10', 0.12) : '#2a2e37'
  const body = sym([50, 76], [
    [[50 + 2, 74], [50 + nw - 1, 70], [50 + nw + 0.4, 67.6]],
    [[50 + nw + 8, 68.6], [50 + nw + 20, 70], [50 + nw + 26, 72.4]],
    [[50 + nw + 29, 73.6], [100, 76], [102, 79]],
    [[102, 84], [90, 86], [50, 86]],
  ])
  let s = clothOf(body, top, P, lo)
  if (polo) {
    const fl = lite(color, 0.1), ink = ` stroke="${INK}" stroke-width=".6"`
    // the collar's two points lying open at the throat, the placket and its button
    s += fill(`M${f1(50 - nw - 0.4)} 66.4L${f1(50 - nw - 4.2)} 69.6L${f1(50 - 3.6)} 75.6L50 73.4Z`, fl, ink) + fill(`M${f1(50 + nw + 0.4)} 66.4L${f1(50 + nw + 4.2)} 69.6L${f1(50 + 3.6)} 75.6L50 73.4Z`, shade(fl, 0.25), ink)
    s += stroke(`M48.6 74.4V86M51.4 74.4V86`, shade(color, 0.45), 0.5) + fill(ell(50, 78.6, 0.75, 0.75), '#f2f3f5')
  } else {
    s += fill(`M${f1(50 - nw - 1.2)} 64.6Q50 70.6 ${f1(50 + nw + 1.2)} 64.6L${f1(50 + nw + 2.4)} 70.6Q50 78.4 ${f1(50 - nw - 2.4)} 70.6Z`, color, ` stroke="${INK}" stroke-width=".7"`)
      + fill(`M50 ${f1(68)}Q${f1(50 + nw)} 67 ${f1(50 + nw + 1.2)} 64.8L${f1(50 + nw + 2.4)} 70.6Q${f1(50 + nw)} 74 50 74.6Z`, shade(color, 0.3))
    s += stroke('M50 74.6V86', '#0d0e12', 1.2) + stroke('M50 74.6V86', '#9aa0aa', 0.45) + `<rect x="48.9" y="77.6" width="2.2" height="3.4" rx=".6" fill="#c9ced6"/>`
  }
  return s
}
// cloth: its flat colour, the far side in shadow, the near shoulder's light, the ink round it
function clothOf(body, c, P, lo) {
  return `<defs><path id="${P}j" d="${body}"/><clipPath id="${P}J"><use href="#${P}j"/></clipPath></defs><use href="#${P}j" fill="${c}"/>`
    + `<g clip-path="url(#${P}J)">${fill('M58 70C66 74 70 80 70 90H104V60H64Z', shade(c, 0.3))}${lo ? '' : fill('M14 76C20 72.6 28 70.4 36 69.6L37 71C29 72 22 74.2 15 78Z', lite(c, 0.1))}</g>`
    + `<use href="#${P}j" fill="none" stroke="${INK}" stroke-width=".9"/>`
}
function glassesOf(look, G) {
  if (!look.specs) return ''
  const { tw, es, ey } = G, L = 50 - tw, R = 50 + tw
  const fr = look.specs === 2 ? '#6e5236' : '#17181d', w = 5, h = 3.6
  let s = stroke(`M${f1(L + 0.2)} ${f1(ey - 1.6)}L${f1(50 - es - w)} ${f1(ey - 1.8)}M${f1(50 + es + w)} ${f1(ey - 1.8)}L${f1(R - 0.2)} ${f1(ey - 1.6)}M${f1(50 - es + w)} ${f1(ey - 1.2)}Q50 ${f1(ey - 2.6)} ${f1(50 + es - w)} ${f1(ey - 1.2)}`, fr, 0.9)
  let g = ''
  for (const s2 of [-1, 1]) {
    const x = 50 + s2 * es
    s += `<rect x="${f1(x - w)}" y="${f1(ey - h)}" width="${f1(w * 2)}" height="${f1(h * 2 - 0.4)}" rx="1.8" fill="none" stroke="${fr}" stroke-width="1"/>`
    g += `M${f1(x - w + 1.6)} ${f1(ey + h - 1.2)}L${f1(x - w + 4.2)} ${f1(ey - h + 0.6)}H${f1(x - w + 5.4)}L${f1(x - w + 2.8)} ${f1(ey + h - 1.2)}Z`
  }
  return s + fill(g, '#ffffff', ' fill-opacity=".22"')
}
// a ball cap or a visor in the team's colour, his hair under it
function capOf(look, G, color) {
  if (!look.cap) return ''
  if (look.cap === 'visor') return visorOf(G, color)
  const { cw } = G, L = 50 - cw, R = 50 + cw, ink = ` stroke="${INK}" stroke-width=".8"`
  const crown = `M${f1(L - 1.2)} 32.6C${f1(L - 2)} ${TOP + 1} ${f1(50 - cw * 0.6)} ${TOP - 3.8} 50 ${TOP - 3.8}C${f1(50 + cw * 0.6)} ${TOP - 3.8} ${f1(R + 2)} ${TOP + 1} ${f1(R + 1.2)} 32.6C${f1(R - 3)} 30 ${f1(L + 3)} 30 ${f1(L - 1.2)} 32.6Z`
  const brim = `M${f1(L + 0.4)} 31.6C${f1(L + 4)} 28.8 ${f1(R - 4)} 28.8 ${f1(R - 0.4)} 31.6C${f1(R - 2.6)} 37.2 ${f1(L + 2.6)} 37.2 ${f1(L + 0.4)} 31.6Z`
  return fill(`M${f1(L + 0.4)} 32.4C${f1(L + 4)} 37.4 ${f1(R - 4)} 37.4 ${f1(R - 0.4)} 32.4L${f1(R - 0.6)} 38.8C${f1(R - 5)} 40.6 ${f1(L + 5)} 40.6 ${f1(L + 0.6)} 38.8Z`, '#000000', ' fill-opacity=".28"')
    + fill(crown, color, ink) + fill(`M${f1(50 + cw * 0.15)} ${TOP - 3.6}C${f1(R)} ${TOP - 2} ${f1(R + 2)} ${TOP + 3} ${f1(R + 1.2)} 32.4C${f1(R - 1)} 31.4 ${f1(R - 3)} 30.8 ${f1(R - 4)} 30.6C${f1(R - 3)} 24 ${f1(R - 6)} ${TOP} ${f1(50 + cw * 0.15)} ${TOP - 3.6}Z`, shade(color, 0.28))
    + stroke(`M50 ${TOP - 3.6}V30.6M${f1(50 - cw * 0.5)} ${TOP - 1}Q${f1(50 - cw * 0.42)} 24 ${f1(50 - cw * 0.46)} 30.8`, shade(color, 0.4), 0.5)
    + fill(ell(50, TOP - 3.4, 1.2, 1.2), shade(color, 0.2)) + fill(brim, shade(color, 0.42), ink) + stroke(`M${f1(L + 2)} 31.6C${f1(L + 5)} 29.6 ${f1(R - 5)} 29.6 ${f1(R - 2)} 31.6`, lite(color, 0.3), 0.5)
}

// ── The bust ─────────────────────────────────────────────────────────────────
function jerseyOf(G, color, P, lo, crew = false) {
  const { nw } = G
  // (a crew neck: the collar round the base of the neck, not a V)
  const body = sym([50, crew ? 73.4 : 79.6], [
    [crew ? [50 + nw * 0.6, 73.4] : [50 + 2.2, 76.6], crew ? [50 + nw, 70.6] : [50 + nw - 1.2, 70.6], [50 + nw + 0.4, 66.4]],
    [[50 + nw + 1.4, 66.6], [50 + nw + 2.6, 67.2], [50 + nw + 4, 67.6]],
    [[50 + nw + 10, 68.6], [50 + nw + 19, 69.4], [50 + nw + 25, 71.4]],
    [[50 + nw + 28, 72.6], [100, 75], [102, 78]],
    [[102, 84], [90, 86], [50, 86]],
  ])
  const trim = crew ? `M${f1(50 - nw - 0.2)} 66.2C${f1(50 - nw)} 70.8 ${f1(50 - nw * 0.6)} 73.6 50 73.6C${f1(50 + nw * 0.6)} 73.6 ${f1(50 + nw)} 70.8 ${f1(50 + nw + 0.2)} 66.2`
    : `M${f1(50 - nw - 0.2)} 66.2C${f1(50 - nw + 1)} 70.8 ${f1(50 - 3)} 76.8 50 80.2C${f1(50 + 3)} 76.8 ${f1(50 + nw - 1)} 70.8 ${f1(50 + nw + 0.2)} 66.2`
  const accent = lum(color) > 200 ? '#1d2230' : '#f4f5f7'
  const u = (c, w) => `<use href="#${P}v" fill="none" stroke="${c}" stroke-width="${w}"/>`
  return clothOf(body, color, P, lo) + `<defs><path id="${P}v" d="${trim}"/></defs>` + u(INK, 3.6) + u(accent, 2.8) + u(color, 1.4)
}
// a basketball tank: bare shoulders (the skin's tones, the far one in shadow, the deltoid's line), the tank's scoop
// neck and its arm holes trimmed, the straps over the traps
function tankOf(G, T, color, P, lo) {
  const { nw } = G
  const sh = sym([50, 76], [
    [[50 + nw * 0.5, 76], [50 + nw, 69], [50 + nw + 0.6, 66]],
    [[50 + nw + 6, 68.2], [50 + nw + 16, 68.6], [50 + nw + 23, 71.6]],
    [[50 + nw + 28, 73.6], [100, 77], [102, 80]],
    [[102, 86], [90, 86], [50, 86]],
  ])
  const ink = ` stroke="${INK}" stroke-width=".9"`
  const tank = sym([50, 76.4], [
    [[50 + nw * 0.55, 76.4], [50 + nw + 1.2, 71], [50 + nw + 1.6, 67.4]],
    [[50 + nw + 3.4, 67.6], [50 + nw + 5.4, 67.8], [50 + nw + 7, 68.2]],
    [[50 + nw + 7.4, 74], [50 + nw + 10, 79], [50 + nw + 15, 81.6]],
    [[50 + nw + 15, 84], [80, 86], [50, 86]],
  ])
  const accent = lum(color) > 200 ? '#1d2230' : '#f4f5f7'
  return fill(sh, T.base, ink) + fill(`M${f1(50 + nw + 6)} 70C${f1(50 + nw + 14)} 70.4 ${f1(50 + nw + 22)} 72 100 77L102 86H${f1(50 + nw + 8)}Z`, T.sh)
    + (lo ? '' : stroke(`M${f1(50 - nw - 14)} 70.6Q${f1(50 - nw - 17)} 76 ${f1(50 - nw - 15)} 84M${f1(50 + nw + 14)} 70.6Q${f1(50 + nw + 17)} 76 ${f1(50 + nw + 15)} 84`, T.sh, 0.9))
    + clothOf(tank, color, P, lo)
    + stroke(`M${f1(50 - nw - 1.4)} 68C${f1(50 - nw - 1)} 71.4 ${f1(50 - nw * 0.55)} 75.8 50 75.8C${f1(50 + nw * 0.55)} 75.8 ${f1(50 + nw + 1)} 71.4 ${f1(50 + nw + 1.4)} 68`
      + `M${f1(50 - nw - 6.6)} 68.8C${f1(50 - nw - 7)} 74 ${f1(50 - nw - 9.6)} 78.6 ${f1(50 - nw - 14.4)} 81.2M${f1(50 + nw + 6.6)} 68.8C${f1(50 + nw + 7)} 74 ${f1(50 + nw + 9.6)} 78.6 ${f1(50 + nw + 14.4)} 81.2`, accent, 1.2)
}
export function faceSvg(look, { color = '#d2aa4f', view = 'full' } = {}) {
  const col = color || '#d2aa4f', lo = view === 'sm'
  const P = `f${hashStr(`${JSON.stringify(look)}|${col}|${view}`).slice(0, 4)}`
  const G = geo(look), T = tonesOf(look.skin)
  const { cw, tw, cb, jw, jy, cy, ch, nw, es, ey, mwid, my, lean } = G
  const durag = look.gear === 'durag'
  // (a durag covers the hair; long hair that hangs still shows behind it)
  const hp = hairParts(durag ? { ...look, hair: ['locs', 'long', 'flow', 'mullet', 'cornrows'].includes(look.hair) ? look.hair : 'shaved' } : look, G, T, P, lo)
  const hfront = durag || look.cap === 'cap' ? '' : hp.front
  // the head's shading: three flat tones, each one path, every shape designed (no soft blends)
  const S = { sh: '', dk: '', hl: '' }
  // the side of the face away from the light: down the forehead, round the outer eye, out over the cheekbone (it
  // catches the light), into the hollow under it, down the jaw to the chin
  S.sh += crv([[50 + cw * 0.42, TOP - 3], [50 + cw * 0.64, 28], [50 + es + 3.6, G.by - 0.4], [50 + es + 2.1, ey + 2], [50 + cb - 2.6, 46.8],
    [50 + cb - 4.4 - lean * 0.9, 51.8], [50 + jw - 3.4, jy - 0.6], [50 + ch + 0.5, cy - 2.6], [51.6, cy + 2.4], [104, cy + 3], [104, TOP - 4]], true, true)
  // the lit side's own edge turning away (the temple, the cheek's side, the jaw's underside)
  S.sh += crv([[50 - cw - 2, 27], [50 - cw + 0.9, 31.4], [50 - tw + 0.7, 38.4], [50 - cb + 0.5, 46.4], [50 - cb + 1.1 + lean * 0.4, 51], [50 - jw + 0.8, jy - 0.6],
    [50 - ch - 0.6, cy - 1], [49, cy + 2.6], [-4, cy + 4], [-4, 27]], true, true)
  // the hollow under the lit cheekbone, down toward the mouth
  if (lean > 0.15) S.sh += crv([[50 - cb + 1.6, 48.4], [50 - cb + 4.4, 49.8], [50 - mwid - 2, my - 2.2], [50 - cb + 2.4, 52.8]])
  // the chin's light, the forehead's, the brow ridge, the lit cheekbone
  S.hl += crv([[43.4, 22.6], [48.4, 21.2], [50.4, 25.2], [47.8, 30], [43.6, 28.6]])
  S.hl += crv([[50 - cb + 2.2, 45.7], [50 - cb + 6.4, 45.8], [50 - cb + 3.4, 47.4]])
  if (!lo) S.hl += crv([[50 - es - 2.6, G.by - 1.9], [50 - 2.2, G.by - 1.3], [50 - es - 2, G.by - 1.1]]) + ell(48.8, cy - 3.2, 1.6, 0.9)
  if (look.cleft) S.dk += crv([[50, cy - 3], [50.4, cy - 1.4], [49.8, cy - 1.2]])
  const ey2 = eyesOf(look, G, T, S, P, lo)
  const nose = noseOf(look, G, T, S, lo)
  const mouth = mouthOf(look, G, T, S, lo)
  const lines = linesOf(look, G, T, S, lo)
  // the ears: lit and in shade, the bowl inside, the rim
  let ears = '', rims = ''
  for (const s of [-1, 1]) {
    const ex = 50 + s * (tw - 0.6), X = d => f1(ex + s * d)
    ears += fill(`M${X(0)} 40.6C${X(2.2)} 38.6 ${X(3.8)} 40 ${X(3.7)} 43.6C${X(3.6)} 47.4 ${X(2.6)} 51 ${X(0.6)} 52.8L${X(-0.8)} 50.6Z`, s < 0 ? T.base : T.sh, ` stroke="${INK}" stroke-width=".8"`)
      + fill(`M${X(0.9)} 42.2C${X(2.4)} 41.2 ${X(2.9)} 43 ${X(2.6)} 45C${X(2.3)} 47.4 ${X(1.6)} 48.6 ${X(1)} 48.2Z`, s < 0 ? T.sh : T.dk)
    rims += `M${X(1.3)} 40.6C${X(2.8)} 40.2 ${X(3.2)} 42 ${X(3)} 44.2`
  }
  if (!lo) ears += stroke(rims, T.line, 0.4)
  // the neck: into the jersey, the jaw's shadow on it, the two neck muscles, the far side in shade
  const neckD = sym([50, 49], [
    [[50 + nw * 0.3, 49], [50 + nw * 0.6, 49], [50 + nw * 0.86, 49]],
    [[50 + nw * 0.9, 57], [50 + nw, 62], [50 + nw + 0.6, 66]],
    [[50 + nw + 3, 68.4], [50 + nw + 9, 69.6], [50 + nw + 16, 71]],
    [[50 + nw + 16, 76], [50 + nw + 16, 80], [50 + nw + 16, 84]],
    [[50 + nw, 84], [55, 84], [50, 84]],
  ])
  const neck = `<use href="#${P}n" fill="${T.base}"/><g clip-path="url(#${P}N)">`
    + fill(`M${f1(50 + nw * 0.42)} 48C${f1(50 + nw * 0.6)} 60 ${f1(50 + nw * 0.25)} 70 ${f1(50 + nw * 0.3)} 86H104V48Z`, T.sh)
    + `<use href="#${P}p" fill="${T.sh}" transform="translate(.6 3.8)"/><use href="#${P}p" fill="${T.dk}" transform="translate(.6 1.6)"/>`
    + fill(`M47 72L50 81L53 72Q50 74 47 72Z`, T.sh)
    + (lo ? '' : stroke(`M${f1(50 - nw + 2.4)} 56C${f1(50 - nw + 3.4)} 62 47.4 67.6 47.6 71M${f1(50 + nw - 2.4)} 56C${f1(50 + nw - 3.4)} 62 52.6 67.6 52.4 71`, T.sh, 0.9))
    + `</g><use href="#${P}n" fill="none" stroke="${INK}" stroke-width=".9"/>`
  const vb = VIEWS[view] ?? VIEWS.full
  // (a close crop of the eyes, the nose or the mouth leaves out what it can't show: less to draw for a thumbnail)
  const close = view === 'eyes' || view === 'nose' || view === 'mouth'
  const body = (close ? '' : hp.back + neck + chainOf(look, G) + (look.top ? topOf(look, G, col, P, lo) : look.kit === 'hoops' ? tankOf(G, T, col, P, lo) : jerseyOf(G, col, P, lo, look.kit === 'crew')))
    + (view === 'nose' || view === 'mouth' ? '' : ears)
    + `<use href="#${P}p" fill="${T.base}"/>`
    + `<g clip-path="url(#${P}C)">${fill(S.sh, T.sh)}${fill(S.dk, T.dk)}${fill(S.hl, T.hl)}`
    // the hard rim of cool light down the far edge
    + (lo ? '' : stroke(`M${f1(50 + tw - 0.7)} 36C${f1(50 + tw - 0.6)} 41 ${f1(50 + cb - 0.7)} 43 ${f1(50 + cb - 0.7)} 47C${f1(50 + cb - 0.8)} 51 ${f1(50 + jw)} ${f1(jy - 3.4)} ${f1(50 + jw - 0.7)} ${f1(jy)}C${f1(50 + jw - 1.4)} ${f1(jy + 2)} ${f1(50 + ch + 2.4)} ${f1(cy - 2)} ${f1(50 + ch - 0.2)} ${f1(cy - 1.2)}`, T.rim, 0.75))
    + `</g>`
    // the ink: the head's edge, heaviest round the jaw
    + `<use href="#${P}p" fill="none" stroke="${INK}" stroke-width="1"/>` + stroke(jawD(G), INK, 1.7)
    + (look.beard === 'stubble' ? beardOf(look, G, T, P, lo) : '')
    + lines + ey2.eyes + browsOf(look, G) + nose
    + (look.beard !== 'stubble' ? beardOf(look, G, T, P, lo) : '')
    + mouth + stacheOf(look, G) + eyeBlackOf(look, G)
    + hfront + headGearOf(look, G, col) + earringsOf(look, G) + glassesOf(look, G) + capOf(look, G, col)
  const defs = `<defs><path id="${P}p" d="${headD(G)}"/><path id="${P}n" d="${neckD}"/>${ey2.clip}<clipPath id="${P}C"><use href="#${P}p"/></clipPath><clipPath id="${P}N"><use href="#${P}n"/></clipPath><clipPath id="${P}E"><use href="#${P}e"/></clipPath></defs>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" stroke-linecap="round" stroke-linejoin="round">${defs}${body}</svg>`
}

// a data: URL that encodes only what it must (smaller than encodeURIComponent's)
// (the drawing never holds a % or a brace, so the quote, the hash and the angle brackets are all there is to escape)
const toUrl = svg => `data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}`

// ── Coaches ──────────────────────────────────────────────────────────────────
// A coach is an older man (35 to 70): hair greying with the years, receding or gone, a crew cut or a side part, the
// lines of his face, a heavier jaw; often glasses, a moustache or a grey beard, a visor or a cap; a team polo or a
// quarter-zip. The backgrounds of the NFL's coaching staffs: mostly white, about a fifth Black, a few others.
//   coachLook(key, { g, ag })         the look (g: his background if it's known, ag: his age, greyer every year)
//   coachUrl(key, { g, ag, color, small })   the same as a data: URL (cached; small: the lighter drawing for 64 px
//                                           and under)
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
export function coachUrl(key, { g = null, ag = null, color = '#d2aa4f', small = false } = {}) {
  // (the face changes only as he greys: keyed by his age in steps)
  const step = ag == null ? '' : ag < 45 ? 0 : ag < 52 ? 1 : ag < 58 ? 2 : ag < 60 ? 3 : 4
  const k = `${key}|${g ?? ''}|${step}|${color}|${small ? 1 : 0}`
  let u = CCACHE.get(k)
  if (!u) {
    u = toUrl(faceSvg(coachLook(key, { g, ag }), { color, view: small ? 'sm' : 'full' }))
    if (CCACHE.size > 400) CCACHE.clear()
    CCACHE.set(k, u)
  }
  return u
}
// a coach's saved face (the player's built coach: { key, coach: 1, g?, ag? }, or an older save's player-style
// { key, pos }) as a url
export const coachFaceUrl = (face, color, ag = null, small = false) => (!face ? null : face.coach ? coachUrl(face.key, { g: face.g ?? null, ag: ag ?? face.ag ?? null, color, small }) : faceUrl(face.key, face.pos, color, null, small))

// a league man's age in steps (his face changes only as he matures: 25, 29, 32)
const ageStep = ag => (ag == null || ag <= 25 ? 24 : ag <= 29 ? 28 : ag <= 32 ? 31 : 34)
const CACHE = new Map()
// small: the lighter drawing for a list (64 px and under: the fine lines left out)
export function faceUrl(key, pos, color, ag = null, small = false) {
  const a = ageStep(ag)
  const k = `${key}|${pos}|${color ?? ''}|${a}|${small ? 1 : 0}`
  let u = CACHE.get(k)
  if (!u) {
    u = toUrl(faceSvg(lookOf(key, pos, a), { color, view: small ? 'sm' : 'full' }))
    if (CACHE.size > 800) CACHE.clear()
    CACHE.set(k, u)
  }
  return u
}
// a league man's face (a made-up man only: the caller checks he isn't real and isn't a build)
export const genFace = (p, color, small = false) => (p ? faceUrl(p.fk ?? p.n, p.p, color, p.ag ?? null, small) : null)

// ── A build's face: the player's own pick ────────────────────────────────────
// Every build gets a face of his own (never a real man's photo). It starts as one coherent made-up man (lookOf, keyed
// by the setup's seed and the roster spot), and the player can change any part of it (FacePick.jsx). Saved on the
// build as B.face = { skin, head, eyes, iris, brows, nose, mouth, hair, hc, beard, stache, gear, eb, ear, chain, and
// the sliders wt jaw chn chk esz esp brh nsw nsl lip mw }.
//   defaultFace(key, pos)     a coherent random look, in the creator's terms
//   buildLook(B)              the look the drawing reads (B.face over his default: an older save's face gets the parts
//                             it never had from the default, its beard and its gear mapped onto today's)
//   buildFaceUrl(B, color, view)  the build's face as a data: URL (view: a crop, VIEWS; 'sm' the lighter drawing
//                             for a list)
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
  // (a skin off the list is kept when it's a real colour: a Career saved before its face keeps its old skin exactly)
  if (!ok(FACE_SKIN, f.skin)) f.skin = /^#[0-9a-f]{6}$/i.test(f.skin ?? '') ? f.skin : near(FACE_SKIN, f.skin ?? base.skin)
  if (!ok(FACE_HC, f.hc)) f.hc = base.hc
  for (const k of SL) f[k] = Number.isFinite(+f[k]) ? clamp(+f[k], -1, 1) : 0
  return f
}
// what a man wears under his face: fb a football jersey's V-neck (the default) · hoops a basketball tank · crew a
// crew-neck shirt (soccer, baseball)
export const KITS = ['fb', 'hoops', 'crew']
export function buildLook(B) {
  const pos = B?.pos ?? 'wr'
  const f = normFace(B?.face, defaultFace(B?.name ?? 'build', pos))
  // dyed tips only show on locs and twists; on any other cut the colour underneath is black
  const hc = f.hc === '#b8893c' && f.hair !== 'locs' && f.hair !== 'twists' ? '#16110e' : f.hc
  // B.kit: what he wears under his face (KITS; eye black is football's only)
  const kit = KITS.includes(B?.kit) ? B.kit : 'fb'
  return { ...f, g: groupOfSkin(f.skin), hc, brow: f.hc === '#b8893c' ? '#16110e' : hc, wide: wideOf(pos), ag: ageStep(B?.age), kit, ...(kit !== 'fb' ? { eb: 'none' } : null) }
}
const BCACHE = new Map()
export function buildFaceUrl(B, color, view = 'full') {
  if (!B) return null
  const L = buildLook(B)
  const k = `${FACE_KEYS.map(x => L[x]).join('|')}|${L.wide}|${L.ag}|${L.kit}|${color ?? ''}|${view}`
  let u = BCACHE.get(k)
  if (!u) {
    u = toUrl(faceSvg(L, { color, view }))
    if (BCACHE.size > 600) BCACHE.clear()
    BCACHE.set(k, u)
  }
  return u
}
