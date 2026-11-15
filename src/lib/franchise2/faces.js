// FRANCHISE: drawn faces. The men the game makes up (draft prospects, rookies, generated depth, free agents, coaches
// without a photo) and every one of the player's builds. Real players use their ESPN headshot; never a drawn face on a
// real man without a photo (initials beat a made-up face on a real player).
//
// The look (owner 2026-11-15: grown NFL players, never cartoonish): a bust in the game's illustrated style
// (components/app/avatarArt.jsx): flat fills with one shade tone, the game's dark outline round every shape. Adult
// proportions: a skull and a real jaw, a thick neck into broad shoulders, a navy shirt with the team's colour at the
// collar. Hair and beards drawn as hair (a hairline, a fade's sides, locs that hang, a beard that follows the jaw).
//
// The man is one coherent person, not parts picked at random: first his background (weighted by position the way NFL
// rooms are), then a skin tone, head, features, hair, hair colour and facial hair that go together on real players.
//
//   lookOf(key, pos)              the look, seeded by the key (his name)
//   faceSvg(look, { color })      the SVG bust (drawn on 100 × 100, framed 74 × 74; transparent; color: the collar)
//   faceUrl(key, pos, color)      the same as a data: URL for an <img> (cached)
//   genFace(p, color)             a league man's face url (p: league.js's player): his key is his name
// The player's builds: B.face (the picker's choices, FacePick.jsx), buildLook(B), buildFaceUrl(B, color).
//
// A look: { g background, skin, head, eyes, brows, nose, mouth, hair, hc (hair colour), brow (brow colour), beard,
//           stache, gear, wide (0 slim … 1 a lineman) }
// Pure: no DOM, no Math.random. The same name always draws the same man (a prospect keeps his face as a rookie).
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

// ── The choices (the picker's lists: value, label) ───────────────────────────
export const FACE_SKIN = [
  ['#f4d2b6', 'FAIR'], ['#eab996', 'LIGHT'], ['#d9a582', 'SAND'], ['#deae84', 'TAN'], ['#c99064', 'OLIVE'], ['#b98058', 'GOLDEN'],
  ['#a06c44', 'BRONZE'], ['#9c6440', 'BROWN'], ['#8a5634', 'CHESTNUT'], ['#7a4a2c', 'MAHOGANY'], ['#5e3a22', 'DEEP'], ['#432818', 'DARKEST'],
]
export const FACE_HEAD = [['oval', 'OVAL'], ['square', 'SQUARE'], ['round', 'ROUND'], ['long', 'LONG'], ['broad', 'BROAD']]
export const FACE_EYES = [['almond', 'ALMOND'], ['round', 'ROUND'], ['narrow', 'NARROW'], ['hooded', 'HOODED']]
export const FACE_BROWS = [['straight', 'STRAIGHT'], ['thick', 'THICK'], ['arched', 'ARCHED'], ['angled', 'ANGLED'], ['thin', 'THIN']]
export const FACE_NOSE = [['straight', 'STRAIGHT'], ['broad', 'BROAD'], ['narrow', 'NARROW'], ['short', 'SHORT']]
export const FACE_MOUTH = [['neutral', 'NEUTRAL'], ['full', 'FULL'], ['thin', 'THIN'], ['smirk', 'SMIRK']]
export const FACE_HAIR = [
  ['shaved', 'BALD'], ['buzz', 'BUZZ'], ['crew', 'CREW CUT'], ['fade', 'FADE'], ['waves', 'WAVES'], ['sidepart', 'SIDE PART'],
  ['textured', 'TEXTURED'], ['curly', 'CURLS'], ['twists', 'TWISTS'], ['locs', 'LOCS'], ['cornrows', 'BRAIDS'], ['afro', 'AFRO'],
  ['hightop', 'HIGH TOP'], ['flow', 'FLOW'], ['long', 'LONG'], ['bun', 'BUN'], ['mullet', 'MULLET'],
]
export const FACE_HC = [
  ['#16110e', 'BLACK'], ['#2a1d15', 'DARK'], ['#5a3b24', 'BROWN'], ['#86492a', 'AUBURN'], ['#a8824e', 'SANDY'], ['#c9a46c', 'BLOND'], ['#b8893c', 'TIPS'], ['#8f8a82', 'GREY'],
]
export const FACE_BEARD = [['none', 'CLEAN'], ['stubble', 'STUBBLE'], ['chin', 'STRAP'], ['goatee', 'GOATEE'], ['short', 'SHORT'], ['full', 'FULL'], ['long', 'LONG']]
export const FACE_STACHE = [['none', 'NONE'], ['thin', 'THIN'], ['full', 'FULL'], ['horseshoe', 'HORSESHOE']]
export const FACE_GEAR = [['none', 'NONE'], ['eyeblack', 'EYE BLACK'], ['headband', 'HEADBAND'], ['durag', 'DURAG'], ['studs', 'STUDS']]

// ── How often each goes with each background ─────────────────────────────────
const SKIN = {
  b: ['#a06c44', '#9c6440', '#8a5634', '#8a5634', '#7a4a2c', '#7a4a2c', '#5e3a22', '#432818'],
  w: ['#f4d2b6', '#eab996', '#eab996', '#d9a582', '#deae84'],
  m: ['#c99064', '#b98058', '#a06c44', '#deae84'],
  p: ['#b98058', '#a06c44', '#9c6440', '#c99064'],
  l: ['#deae84', '#c99064', '#b98058', '#d9a582'],
}
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
const EYES = [['almond', 40], ['narrow', 22], ['hooded', 22], ['round', 16]]
const BROWS = [['straight', 34], ['thick', 28], ['angled', 18], ['arched', 12], ['thin', 8]]
const pickW = (r, list) => { const t = list.reduce((a, x) => a + x[1], 0); let u = r() * t; for (const x of list) { u -= x[1]; if (u < 0) return x[0] } return list[list.length - 1][0] }
const BIG = new Set(['ol', 'dl', 'te'])
const wideOf = pos => (BIG.has(pos) ? 1 : pos === 'lb' || pos === 'rb' ? 0.5 : 0.2)

export function lookOf(key, pos = 'wr') {
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
  return {
    g, skin, head, eyes: pickW(r, EYES), brows: pickW(r, BROWS), nose: pickW(r, NOSE[g]), mouth: pickW(r, MOUTH[g]),
    hair, hc, brow: hc === '#b8893c' ? '#16110e' : hc, beard, stache, gear, wide: wideOf(pos),
  }
}

// ── Colour ───────────────────────────────────────────────────────────────────
const hex = h => parseInt(h.slice(1, 7), 16)
const mixC = (a, b, k) => { const x = hex(a), y = hex(b); const c = s => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k); return `#${[16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join('')}` }
const shade = (c, k) => mixC(c, '#0b0c10', k)
const lite = (c, k) => mixC(c, '#ffffff', k)
const lum = c => { const x = hex(c); return 0.299 * ((x >> 16) & 255) + 0.587 * ((x >> 8) & 255) + 0.114 * (x & 255) }
const K = '#15171e'               // the game's outline (avatarArt.jsx)
const SHIRT = '#1d2a44', SHIRT_SH = '#16203a'
const f1 = n => Math.round(n * 10) / 10

// ── The head ─────────────────────────────────────────────────────────────────
// cw half the skull's width · jw half the jaw at its corner · jy the jaw corner's height · cy the chin · ch half the
// chin's width. A lineman's head (wide) is a little broader all round.
const SHAPE = {
  oval: { cw: 16.4, jw: 13.4, jy: 54, cy: 66.5, ch: 6 },
  square: { cw: 16.8, jw: 15.4, jy: 56, cy: 66.5, ch: 8.4 },
  round: { cw: 17.4, jw: 14.6, jy: 53, cy: 65.5, ch: 6.6 },
  long: { cw: 15.8, jw: 13.4, jy: 57.5, cy: 68.5, ch: 7 },
  broad: { cw: 18.2, jw: 16.8, jy: 55.5, cy: 66.5, ch: 9 },
}
const TOP = 17                    // the top of the skull
// the frame: the head and the tops of the shoulders, the way a broadcast headshot is cropped (a high top or an afro
// may touch the top edge)
const VIEW = '13 6 74 74'
const EYE_Y = 42.5, BROW_Y = 37.6, NOSE_Y = 52, MOUTH_Y = 58.4

function geo(look) {
  const s = SHAPE[look.head] ?? SHAPE.oval, w = look.wide ?? 0.2
  return { ...s, cw: s.cw + w * 1.1, jw: s.jw + w * 1.4, ch: s.ch + w * 0.8, nw: 10.6 + w * 3.4 }
}
function headPath(G) {
  const { cw, jw, jy, cy, ch } = G, L = 50 - cw, R = 50 + cw
  return `M${f1(L)} 40C${f1(L)} 25 ${f1(50 - cw * 0.58)} ${TOP} 50 ${TOP}C${f1(50 + cw * 0.58)} ${TOP} ${f1(R)} 25 ${f1(R)} 40`
    + `C${f1(R)} 47 ${f1(50 + jw + 0.8)} ${jy - 4} ${f1(50 + jw)} ${jy}`
    + `C${f1(50 + jw - 1.2)} ${jy + 5.4} ${f1(50 + ch + 3.4)} ${cy - 0.4} ${f1(50 + ch)} ${cy}`
    + `L${f1(50 - ch)} ${cy}`
    + `C${f1(50 - ch - 3.4)} ${cy - 0.4} ${f1(50 - jw + 1.2)} ${jy + 5.4} ${f1(50 - jw)} ${jy}`
    + `C${f1(50 - jw - 0.8)} ${jy - 4} ${f1(L)} 47 ${f1(L)} 40Z`
}
// the far side of the face in shade: a hard-edged band down the cheek to the jaw
function cheekShade(G) {
  const { cw, jw, jy, cy, ch } = G, R = 50 + cw
  return `M${f1(R - 0.4)} 34C${f1(R)} 44 ${f1(50 + jw + 0.6)} ${jy - 4} ${f1(50 + jw - 0.2)} ${jy}C${f1(50 + jw - 1.4)} ${jy + 5} ${f1(50 + ch + 3)} ${cy - 0.6} ${f1(50 + ch - 0.6)} ${cy - 0.2}`
    + `C${f1(50 + ch + 3.4)} ${cy - 4} ${f1(50 + jw - 4.6)} ${jy} ${f1(50 + jw - 4)} ${jy - 6}C${f1(R - 4.6)} 46 ${f1(R - 4)} 39 ${f1(R - 0.4)} 34Z`
}

// ── The features ─────────────────────────────────────────────────────────────
function eyesOf(look, sk) {
  const ry = { almond: 1.75, round: 2.1, narrow: 1.25, hooded: 1.5 }[look.eyes] ?? 1.75
  const iris = lum(sk) > 170 ? '#3b2a1e' : '#1d140e'
  const one = x => {
    let s = `<path d="M${x - 3} ${EYE_Y}Q${x} ${f1(EYE_Y - ry * 1.5)} ${x + 3} ${EYE_Y}Q${x} ${f1(EYE_Y + ry * 1.1)} ${x - 3} ${EYE_Y}Z" fill="#e4dccf"/>`
    s += `<circle cx="${x + (x < 50 ? 0.4 : -0.4)}" cy="${f1(EYE_Y - 0.1)}" r="${f1(Math.min(1.7, ry + 0.1))}" fill="${iris}"/>`
    // the upper lid, the eye's dark line
    s += `<path d="M${x - 3.4} ${f1(EYE_Y + 0.2)}Q${x} ${f1(EYE_Y - ry * 1.7)} ${x + 3.4} ${f1(EYE_Y + 0.2)}" stroke="${K}" stroke-width="1.15" fill="none" stroke-linecap="round"/>`
    if (look.eyes === 'hooded') s += `<path d="M${x - 3.6} ${f1(EYE_Y - 0.6)}Q${x} ${f1(EYE_Y - 3.6)} ${x + 3.6} ${f1(EYE_Y - 0.6)}Q${x} ${f1(EYE_Y - 2)} ${x - 3.6} ${f1(EYE_Y - 0.6)}Z" fill="${shade(sk, 0.2)}"/>`
    return s
  }
  return one(42.6) + one(57.4)
}
function browsOf(look) {
  const c = look.brow ?? look.hc, t = { thick: 2.9, thin: 1.4 }[look.brows] ?? 2.2
  const one = (x0, x1, side) => {
    // x0 the inner end, x1 the outer; side -1 left, 1 right
    const y = BROW_Y, mid = (x0 + x1) / 2
    const lift = look.brows === 'arched' ? 2.2 : look.brows === 'angled' ? 0.4 : 0.9
    const inner = look.brows === 'angled' ? y + 1.2 : y + 0.4
    return `<path d="M${x0} ${f1(inner)}Q${mid} ${f1(y - lift)} ${x1} ${f1(y + 0.6)}L${f1(x1 - side * 0.4)} ${f1(y + 0.6 + t * 0.55)}Q${mid} ${f1(y - lift + t)} ${x0} ${f1(inner + t)}Z" fill="${c}"/>`
  }
  return one(46.6, 37.8, -1) + one(53.4, 62.2, 1)
}
function noseOf(look, sk) {
  const dk = shade(sk, 0.2), w = { broad: 5.4, narrow: 3.2, short: 4, straight: 4.2 }[look.nose] ?? 4.2
  const y = look.nose === 'short' ? NOSE_Y - 1 : NOSE_Y
  // the bridge's shade on the far side, the wings and the line under them
  let s = `<path d="M51 ${EYE_Y + 1}C51.6 ${y - 7} ${50 + w * 0.5} ${y - 4} ${50 + w * 0.7} ${y - 1.2}L${50 + w * 0.2} ${y - 1.6}C${f1(50.6)} ${y - 5} 50.4 ${y - 7} 50.2 ${EYE_Y + 1}Z" fill="${dk}"/>`
  s += `<path d="M${f1(50 - w)} ${f1(y - 0.6)}C${f1(50 - w - 0.6)} ${f1(y + 1.6)} ${f1(50 - w * 0.4)} ${f1(y + 2)} 50 ${f1(y + 1.2)}C${f1(50 + w * 0.4)} ${f1(y + 2)} ${f1(50 + w + 0.6)} ${f1(y + 1.6)} ${f1(50 + w)} ${f1(y - 0.6)}" stroke="${K}" stroke-width="1.05" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  s += `<path d="M${f1(50 - w * 0.55)} ${f1(y + 0.4)}l1.1 .5M${f1(50 + w * 0.55)} ${f1(y + 0.4)}l-1.1 .5" stroke="${shade(sk, 0.45)}" stroke-width="1" stroke-linecap="round"/>`
  return s
}
function mouthOf(look, sk) {
  const lip = mixC(sk, lum(sk) > 170 ? '#a3524a' : '#5a2a24', lum(sk) > 170 ? 0.32 : 0.3)
  const lipDk = shade(lip, 0.2)
  const y = MOUTH_Y, w = { full: 5.4, thin: 4.6, neutral: 5, smirk: 5 }[look.mouth] ?? 5
  const up = look.mouth === 'full' ? 1.8 : look.mouth === 'thin' ? 0.7 : 1.2, lo = look.mouth === 'full' ? 2.6 : look.mouth === 'thin' ? 1.2 : 1.9
  const rise = look.mouth === 'smirk' ? 1.1 : 0
  let s = `<path d="M${50 - w} ${y}Q${50 - w * 0.4} ${f1(y - up)} 50 ${f1(y - up * 0.7)}Q${50 + w * 0.4} ${f1(y - up)} ${50 + w} ${f1(y - rise)}Z" fill="${lipDk}"/>`
  s += `<path d="M${50 - w + 0.6} ${y}Q50 ${f1(y + lo * 1.5)} ${50 + w - 0.6} ${f1(y - rise)}Z" fill="${lip}"/>`
  s += `<path d="M${50 - w} ${y}Q50 ${f1(y + 0.5)} ${50 + w} ${f1(y - rise)}" stroke="${K}" stroke-width="1.05" fill="none" stroke-linecap="round"/>`
  return s
}

// ── Facial hair ──────────────────────────────────────────────────────────────
// a beard follows the jaw: from the sideburns down the cheeks, round the mouth, and past the chin by its length
function beardPath(G, len, cheek, outerOnly = false) {
  const { cw, jw, jy, cy, ch } = G, L = 50 - cw, R = 50 + cw
  const by = cy + len, bw = ch + (len > 6 ? 1 : 2)
  const ty = 38.6   // the sideburn's top (under the hair: a beard runs up into the sideburns)
  return `M${f1(L + 0.2)} ${ty}C${f1(L)} 48 ${f1(50 - jw - 0.6)} ${jy - 4} ${f1(50 - jw - 0.3)} ${jy}`
    + `C${f1(50 - jw - 1)} ${f1(jy + 5 + len * 0.4)} ${f1(50 - bw - 3)} ${f1(by - 0.6)} ${f1(50 - bw)} ${f1(by)}`
    + (len > 6 ? `Q50 ${f1(by + 3.4)} ${f1(50 + bw)} ${f1(by)}` : `L${f1(50 + bw)} ${f1(by)}`)
    + `C${f1(50 + bw + 3)} ${f1(by - 0.6)} ${f1(50 + jw + 1)} ${f1(jy + 5 + len * 0.4)} ${f1(50 + jw + 0.3)} ${jy}`
    + `C${f1(50 + jw + 0.6)} ${jy - 4} ${f1(R)} 48 ${f1(R - 0.2)} ${ty}`
    + (outerOnly ? '' : ''
    // (the cheek line: down the side of the face first, then in to the corner of the mouth; the cheeks stay clear)
    + `L${f1(R - 2.6 - cheek)} ${ty}C${f1(R - 6 - cheek)} ${f1(ty + 13)} ${f1(50 + 10.5)} ${f1(MOUTH_Y + 0.4)} ${f1(50 + 6.4)} ${f1(MOUTH_Y + 0.6)}`
    + `Q50 ${f1(MOUTH_Y + 4)} ${f1(50 - 6.4)} ${f1(MOUTH_Y + 0.6)}C${f1(50 - 10.5)} ${f1(MOUTH_Y + 0.4)} ${f1(L + 6 + cheek)} ${f1(ty + 13)} ${f1(L + 2.6 + cheek)} ${ty}Z`)
}
// a beard: the hair, its outer edge in the outline (where it runs past the jaw), its edge on the cheek a shade of
// the skin (a beard isn't drawn round with a line where it meets the face)
const beardFill = (G, len, cheek, hc, sk) => `<path d="${beardPath(G, len, cheek)}" fill="${hc}" stroke="${shade(sk, 0.32)}" stroke-width=".8" stroke-linejoin="round"/>`
  + `<path d="${beardPath(G, len, cheek, true)}" stroke="${K}" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`
function beardOf(look, G, sk) {
  const hc = look.bc ?? look.brow ?? look.hc, { cw, jw, jy, cy, ch } = G, L = 50 - cw, R = 50 + cw
  switch (look.beard) {
    case 'stubble': return `<path d="${beardPath(G, 0.6, 1.4)}" fill="${mixC(sk, hc, lum(sk) > 150 ? 0.32 : 0.42)}"/>`
    case 'short': return beardFill(G, 1.6, 1.6, hc, sk)
    case 'full': return beardFill(G, 4, 0.6, hc, sk)
    case 'long': return beardFill(G, 11, 0.4, hc, sk) + `<path d="M46 ${cy + 3}l1 5M50 ${cy + 4}v6M54 ${cy + 3}l-1 5" stroke="${lite(hc, 0.14)}" stroke-width=".8" fill="none" stroke-linecap="round"/>`
    case 'chin': {
      // a strap along the jaw line, sideburn to sideburn
      const o = `M${f1(L + 0.2)} 44C${f1(L)} 48 ${f1(50 - jw - 0.6)} ${jy - 4} ${f1(50 - jw - 0.3)} ${jy}C${f1(50 - jw - 1)} ${f1(jy + 5.6)} ${f1(50 - ch - 3)} ${f1(cy + 0.6)} ${f1(50 - ch)} ${f1(cy + 1)}L${f1(50 + ch)} ${f1(cy + 1)}C${f1(50 + ch + 3)} ${f1(cy + 0.6)} ${f1(50 + jw + 1)} ${f1(jy + 5.6)} ${f1(50 + jw + 0.3)} ${jy}C${f1(50 + jw + 0.6)} ${jy - 4} ${f1(R)} 48 ${f1(R - 0.2)} 44`
      const i = `L${f1(R - 2.2)} 44C${f1(R - 2.4)} 49 ${f1(50 + jw - 2.4)} ${jy - 2} ${f1(50 + jw - 2.6)} ${f1(jy + 0.4)}C${f1(50 + jw - 3.6)} ${jy + 4} ${f1(50 + ch + 1)} ${f1(cy - 2.6)} ${f1(50 + ch - 1)} ${f1(cy - 2.4)}L${f1(50 - ch + 1)} ${f1(cy - 2.4)}C${f1(50 - ch - 1)} ${f1(cy - 2.6)} ${f1(50 - jw + 3.6)} ${jy + 4} ${f1(50 - jw + 2.6)} ${f1(jy + 0.4)}C${f1(50 - jw + 2.4)} ${jy - 2} ${f1(L + 2.4)} 49 ${f1(L + 2.2)} 44Z`
      return `<path d="${o}${i}" fill="${hc}" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>`
    }
    case 'goatee': return `<path d="M44 ${f1(MOUTH_Y + 2)}C44.4 ${f1(cy + 1.6)} 46.6 ${cy + 3} 50 ${cy + 3}C53.4 ${cy + 3} 55.6 ${f1(cy + 1.6)} 56 ${f1(MOUTH_Y + 2)}C54 ${f1(MOUTH_Y + 3.6)} 46 ${f1(MOUTH_Y + 3.6)} 44 ${f1(MOUTH_Y + 2)}Z" fill="${hc}" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>`
    default: return ''
  }
}
function stacheOf(look) {
  const hc = look.bc ?? look.brow ?? look.hc, y = MOUTH_Y - 2.2
  switch (look.stache) {
    case 'thin': return `<path d="M45.4 ${f1(y + 0.4)}Q50 ${f1(y - 1.2)} 54.6 ${f1(y + 0.4)}Q50 ${f1(y - 0.2)} 45.4 ${f1(y + 0.4)}Z" fill="${hc}"/>`
    case 'full': return `<path d="M44 ${f1(y + 1.4)}C44.6 ${f1(y - 1.4)} 48 ${f1(y - 2.2)} 50 ${f1(y - 1.2)}C52 ${f1(y - 2.2)} 55.4 ${f1(y - 1.4)} 56 ${f1(y + 1.4)}C53.6 ${f1(y + 0.4)} 46.4 ${f1(y + 0.4)} 44 ${f1(y + 1.4)}Z" fill="${hc}" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>`
    case 'horseshoe': return `<path d="M44 ${f1(y + 1.4)}C44.6 ${f1(y - 1.4)} 48 ${f1(y - 2.2)} 50 ${f1(y - 1.2)}C52 ${f1(y - 2.2)} 55.4 ${f1(y - 1.4)} 56 ${f1(y + 1.4)}L56.4 ${f1(MOUTH_Y + 6)}L54.6 ${f1(MOUTH_Y + 6)}L54.2 ${f1(y + 2)}C52 ${f1(y + 0.6)} 48 ${f1(y + 0.6)} 45.8 ${f1(y + 2)}L45.4 ${f1(MOUTH_Y + 6)}L43.6 ${f1(MOUTH_Y + 6)}Z" fill="${hc}" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>`
    default: return ''
  }
}

// ── Hair ─────────────────────────────────────────────────────────────────────
// a cap of hair on the skull: its top (how high it stands over the skull), the hairline at the front (line), and
// how far down the sides it comes (side: the temple's height)
function cap(G, top, line, side = 40) {
  const { cw } = G, L = 50 - cw, R = 50 + cw
  return `M${f1(L - 0.6)} ${side}C${f1(L - 1.4)} ${f1(top + 8)} ${f1(50 - cw * 0.62)} ${f1(top)} 50 ${f1(top)}C${f1(50 + cw * 0.62)} ${f1(top)} ${f1(R + 1.4)} ${f1(top + 8)} ${f1(R + 0.6)} ${side}`
    + `L${f1(R - 1.8)} ${side - 2}C${f1(R - 2.2)} ${f1(line + 4)} ${f1(R - 5)} ${f1(line + 0.6)} ${f1(50 + 8)} ${f1(line)}Q50 ${f1(line - 1.2)} ${f1(50 - 8)} ${f1(line)}C${f1(L + 5)} ${f1(line + 0.6)} ${f1(L + 2.2)} ${f1(line + 4)} ${f1(L + 1.8)} ${side - 2}Z`
}
const OUT = `stroke="${K}" stroke-width="1.6" stroke-linejoin="round"`
// the cap filled, its outer edge in the outline, the hairline softer (a line of the hair's own shade: a hairline isn't
// an edge drawn round the face)
function capped(G, top, line, side = 40, fill) {
  if (typeof side === 'string') { fill = side; side = 40 }
  const { cw } = G, L = 50 - cw, R = 50 + cw
  const outer = `M${f1(L - 0.6)} ${side}C${f1(L - 1.4)} ${f1(top + 8)} ${f1(50 - cw * 0.62)} ${f1(top)} 50 ${f1(top)}C${f1(50 + cw * 0.62)} ${f1(top)} ${f1(R + 1.4)} ${f1(top + 8)} ${f1(R + 0.6)} ${side}`
  const inner = `M${f1(L + 1.8)} ${side - 2}C${f1(L + 2.2)} ${f1(line + 4)} ${f1(L + 5)} ${f1(line + 0.6)} ${f1(50 - 8)} ${f1(line)}Q50 ${f1(line - 1.2)} ${f1(50 + 8)} ${f1(line)}C${f1(R - 5)} ${f1(line + 0.6)} ${f1(R - 2.2)} ${f1(line + 4)} ${f1(R - 1.8)} ${side - 2}`
  return `<path d="${cap(G, top, line, side)}" fill="${fill}"/><path d="${outer}" stroke="${K}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="${inner}" stroke="${shade(fill, 0.3)}" stroke-width=".9" fill="none" stroke-linecap="round"/>`
}
function hairParts(look, G, sk) {
  const { hair, hc } = look, { cw } = G, L = 50 - cw, R = 50 + cw
  const front = [], back = []
  const faded = mixC(sk, hc, 0.62)        // a fade's sides, a buzz on the skin
  const hi = lite(hc, 0.16)
  const tips = hc === '#b8893c', base = tips ? '#16110e' : hc
  switch (hair) {
    case 'shaved':
      front.push(`<path d="M${f1(50 - cw * 0.5)} 21Q50 18.6 ${f1(50 + cw * 0.3)} 20.4" stroke="${lite(sk, 0.22)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`)
      break
    case 'buzz': front.push(`${capped(G, TOP - 0.6, 28.6, `${mixC(sk, hc, 0.8)}`)}`); break
    case 'crew': front.push(`${capped(G, TOP - 2.6, 27.6, `${hc}`)}`, `<path d="M44 ${TOP + 1}Q50 ${f1(TOP - 0.6)} 57 ${f1(TOP + 1.6)}" stroke="${hi}" stroke-width="1" fill="none" stroke-linecap="round"/>`); break
    case 'fade':
      front.push(`${capped(G, TOP - 0.4, 28.4, `${faded}`)}`)
      front.push(`<path d="M${f1(L + 3.4)} 27C${f1(L + 3)} ${TOP - 3} ${f1(R - 3)} ${TOP - 3} ${f1(R - 3.4)} 27C${f1(R - 6)} 28.4 ${f1(L + 6)} 28.4 ${f1(L + 3.4)} 27Z" fill="${hc}" ${OUT}/>`)
      break
    case 'waves':
      front.push(`${capped(G, TOP - 1.2, 28, `${hc}`)}`)
      front.push(`<path d="M41 21.6Q45.5 20.2 50 21.6T59 21.6M38.6 25Q44 23.6 50 25T61.4 25" stroke="${hi}" stroke-width="1" fill="none" stroke-linecap="round"/>`)
      break
    case 'sidepart':
      front.push(`<path d="M${f1(L - 0.6)} 40C${f1(L - 2)} ${TOP + 4} ${f1(50 - cw * 0.6)} ${TOP - 4} 51 ${TOP - 4}C${f1(50 + cw * 0.7)} ${TOP - 4} ${f1(R + 2)} ${TOP + 4} ${f1(R + 0.6)} 40L${f1(R - 1.8)} 40C${f1(R - 2.4)} 31 ${f1(R - 6)} 27 ${f1(50 + 5)} 26.6C47 26.2 43 27.6 ${f1(L + 4)} 31C${f1(L + 2.4)} 34 ${f1(L + 2)} 37 ${f1(L + 1.8)} 40Z" fill="${hc}" ${OUT}/>`)
      front.push(`<path d="M43 ${f1(TOP - 2.6)}Q41.6 ${TOP + 4} 43.4 ${TOP + 10}" stroke="${shade(hc, 0.4)}" stroke-width="1.1" fill="none"/><path d="M47 ${f1(TOP - 1.4)}Q55 ${TOP - 2} 60 ${TOP + 3}" stroke="${hi}" stroke-width="1" fill="none" stroke-linecap="round"/>`)
      break
    case 'textured':
      front.push(`<path d="M${f1(L - 0.6)} 40C${f1(L - 1.6)} ${TOP + 4} ${f1(50 - cw * 0.6)} ${TOP - 4} 50 ${f1(TOP - 4.4)}C${f1(50 + cw * 0.6)} ${TOP - 4} ${f1(R + 1.6)} ${TOP + 4} ${f1(R + 0.6)} 40L${f1(R - 1.8)} 40C${f1(R - 2)} 33 ${f1(R - 3)} 30 ${f1(R - 5)} 28.6L${f1(R - 7)} 25.4L${f1(R - 9.4)} 28L56.4 24.6L53.6 27.8L50.4 24.4L47.4 27.6L44.4 24.6L41.8 28.2L39.2 25.6L${f1(L + 4.6)} 29C${f1(L + 2.4)} 31.6 ${f1(L + 2)} 35 ${f1(L + 1.8)} 40Z" fill="${hc}" ${OUT}/>`)
      break
    case 'curly': {
      front.push(`${capped(G, TOP - 2, 28.6, `${hc}`)}`)
      const pts = [[L + 2.6, 27], [L + 5.6, 21.4], [43, 17.4], [50, 16], [57, 17.4], [R - 5.6, 21.4], [R - 2.6, 27], [46.5, 22], [53.5, 22]]
      front.push(pts.map(([x, y]) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="3.6" fill="${hc}"/>`).join(''))
      front.push(pts.slice(0, 7).map(([x, y]) => `<path d="M${f1(x - 1.6)} ${f1(y - 0.4)}q1.6 -1.6 3.2 0" stroke="${hi}" stroke-width=".8" fill="none"/>`).join(''))
      break
    }
    case 'afro': {
      const r = cw + 7.4
      back.push(`<ellipse cx="50" cy="27.4" rx="${f1(r)}" ry="${f1(r - 3.2)}" fill="${hc}" ${OUT}/>`)
      front.push(`<path d="${cap(G, TOP - 1, 28.4, 41)}" fill="${hc}"/>`)
      front.push(`<path d="M${f1(50 - r + 4)} 22q2 -2 4 0M${f1(50 + r - 8)} 20q2 -2 4 0M46 11q2 -2 4 0M56 13q2 -2 4 0M38 15q2 -2 4 0" stroke="${hi}" stroke-width=".9" fill="none"/>`)
      break
    }
    case 'hightop':
      front.push(`<path d="M${f1(L + 0.6)} 38L${f1(L + 1.6)} 7.6Q${f1(L + 2)} 5 ${f1(L + 5)} 5L${f1(R - 5)} 5Q${f1(R - 2)} 5 ${f1(R - 1.6)} 7.6L${f1(R - 0.6)} 38L${f1(R - 2)} 38C${f1(R - 2.6)} 31 ${f1(R - 5)} 28.4 ${f1(50 + 8)} 28Q50 27 ${f1(50 - 8)} 28C${f1(L + 5)} 28.4 ${f1(L + 2.6)} 31 ${f1(L + 2)} 38Z" fill="${hc}" ${OUT}/>`)
      front.push(`<path d="M${f1(L - 0.4)} 40L${f1(L + 0.8)} 30L${f1(L + 2.4)} 31L${f1(L + 1.8)} 40ZM${f1(R + 0.4)} 40L${f1(R - 0.8)} 30L${f1(R - 2.4)} 31L${f1(R - 1.8)} 40Z" fill="${faded}"/>`)
      break
    case 'twists': case 'locs': {
      const long = hair === 'locs'
      front.push(`${capped(G, TOP - 0.6, 28.4, `${long ? base : faded}`)}`)
      // the twists and the tops of the locs: short clumps that sit on the skull, each tipped a little away from the middle
      const n = long ? 9 : 11, span = cw - 2.4
      const clumps = Array.from({ length: n }, (_, i) => {
        const x = 50 - span + (2 * span * i) / (n - 1), dx = (x - 50) / cw
        const ys = TOP + 12 * dx * dx, ht = long ? 7.4 : 6.4
        return `<rect x="${f1(x - 2)}" y="${f1(ys - ht * 0.62)}" width="4" height="${f1(ht)}" rx="2" transform="rotate(${f1(dx * 34)} ${f1(x)} ${f1(ys)})" fill="${base}" stroke="${K}" stroke-width="1.2"/>`
          + (tips ? `<rect x="${f1(x - 2)}" y="${f1(ys - ht * 0.62)}" width="4" height="2.6" rx="1.3" transform="rotate(${f1(dx * 34)} ${f1(x)} ${f1(ys)})" fill="${hc}"/>` : '')
      })
      if (long) {
        // the locs fall behind the ears to the shoulders
        const hang = [L - 3.4, L - 0.2, R + 0.2, R + 3.4]
        back.push(hang.map((x, i) => `<rect x="${f1(x - 2)}" y="26" width="4" height="${44 + (i % 2) * 6}" rx="2" fill="${base}" ${OUT}/>`).join(''))
        if (tips) back.push(hang.map((x, i) => `<rect x="${f1(x - 2)}" y="${64 + (i % 2) * 6}" width="4" height="6" rx="2" fill="${hc}"/>`).join(''))
      }
      front.push(clumps.join(''))
      break
    }
    case 'cornrows': {
      front.push(`${capped(G, TOP - 1, 27.8, `${hc}`)}`)
      const rows = [37, 41.6, 46, 50, 54, 58.4, 63].map(x => `M${x} 28Q${f1((x + 50) / 2)} 21 ${f1(50 + (x - 50) * 0.5)} ${f1(TOP - 0.4)}`).join('')
      front.push(`<path d="${rows}" stroke="${lite(hc, 0.22)}" stroke-width=".9" fill="none" stroke-linecap="round"/>`)
      const ropes = `M${f1(L + 2)} 44L${f1(L + 1)} 66M${f1(L + 5)} 46L${f1(L + 4.6)} 68M${f1(R - 2)} 44L${f1(R - 1)} 66M${f1(R - 5)} 46L${f1(R - 4.6)} 68`
      back.push(`<path d="${ropes}" stroke="${K}" stroke-width="4.4" stroke-linecap="round"/><path d="${ropes}" stroke="${hc}" stroke-width="2.6" stroke-linecap="round"/>`)
      break
    }
    case 'flow': case 'mullet': case 'long': {
      const to = hair === 'long' ? 78 : hair === 'flow' ? 60 : 68
      back.push(`<path d="M${f1(L - 2.6)} 40C${f1(L - 3.6)} 22 ${f1(50 - cw * 0.6)} ${TOP - 3} 50 ${TOP - 3}C${f1(50 + cw * 0.6)} ${TOP - 3} ${f1(R + 3.6)} 22 ${f1(R + 2.6)} 40L${f1(R + 3.6)} ${to - 6}C${f1(R + 2)} ${to} ${f1(R - 3)} ${to} ${f1(R - 4.4)} ${to - 4}L${f1(R - 4)} 50L${f1(L + 4)} 50L${f1(L + 4.4)} ${to - 4}C${f1(L + 3)} ${to} ${f1(L - 2)} ${to} ${f1(L - 3.6)} ${to - 6}Z" fill="${hc}" ${OUT}/>`)
      front.push(`<path d="M${f1(L - 0.6)} 41C${f1(L - 1.6)} ${TOP + 4} ${f1(50 - cw * 0.6)} ${TOP - 3} 50 ${TOP - 3}C${f1(50 + cw * 0.6)} ${TOP - 3} ${f1(R + 1.6)} ${TOP + 4} ${f1(R + 0.6)} 41C${f1(R - 1.4)} 33 ${f1(R - 5)} 27.6 ${f1(50 + 6)} 27.6C51 27.6 49.6 26 49 24.4C47.6 27 44 28.4 ${f1(L + 5)} 30C${f1(L + 2.4)} 32.6 ${f1(L + 0.8)} 36.4 ${f1(L - 0.6)} 41Z" fill="${hc}" ${OUT}/>`)
      front.push(`<path d="M49 ${TOP - 1}Q48 21 49 24.4M54 ${TOP}Q58 22 ${f1(R - 3)} 30" stroke="${hi}" stroke-width="1" fill="none" stroke-linecap="round"/>`)
      break
    }
    case 'receding':
      // the hairline gone back at the temples (an M), the top thinner
      front.push(`<path d="M${f1(L - 0.6)} 39C${f1(L - 1.4)} ${TOP + 5} ${f1(50 - cw * 0.62)} ${f1(TOP - 1.4)} 50 ${f1(TOP - 1.4)}C${f1(50 + cw * 0.62)} ${f1(TOP - 1.4)} ${f1(R + 1.4)} ${TOP + 5} ${f1(R + 0.6)} 39L${f1(R - 1.8)} 37C${f1(R - 2.4)} 30 ${f1(R - 4)} 23.6 ${f1(R - 6.4)} 23.4C${f1(R - 9)} 24.6 55 25.6 50 25.4C45 25.6 ${f1(L + 9)} 24.6 ${f1(L + 6.4)} 23.4C${f1(L + 4)} 23.6 ${f1(L + 2.4)} 30 ${f1(L + 1.8)} 37Z" fill="${hc}" stroke="${K}" stroke-width="1.6" stroke-linejoin="round"/>`)
      front.push(`<path d="M44 ${TOP + 2}Q50 ${f1(TOP + 0.6)} 56 ${TOP + 2}" stroke="${lite(hc, 0.2)}" stroke-width=".9" fill="none" stroke-linecap="round"/>`)
      break
    case 'balding':
      // the crown bare, hair round the sides and the back
      front.push(`<path d="M${f1(L - 0.8)} 41C${f1(L - 1.4)} 33 ${f1(L - 0.4)} 28 ${f1(L + 2.4)} 25.6C${f1(L + 3.4)} 28 ${f1(L + 3)} 33 ${f1(L + 2)} 38ZM${f1(R + 0.8)} 41C${f1(R + 1.4)} 33 ${f1(R + 0.4)} 28 ${f1(R - 2.4)} 25.6C${f1(R - 3.4)} 28 ${f1(R - 3)} 33 ${f1(R - 2)} 38Z" fill="${hc}" stroke="${K}" stroke-width="1.3" stroke-linejoin="round"/>`)
      front.push(`<path d="M${f1(50 - cw * 0.5)} 21Q50 18.6 ${f1(50 + cw * 0.3)} 20.4" stroke="${lite(sk, 0.22)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`)
      break
    case 'bun':
      front.push(`${capped(G, TOP - 1.4, 28, `${hc}`)}`)
      front.push(`<ellipse cx="50" cy="${f1(TOP - 4.4)}" rx="6.4" ry="4.8" fill="${hc}" ${OUT}/>`, `<path d="M44 ${TOP + 3}Q50 ${TOP + 1} 56 ${TOP + 3}M42 ${TOP + 7}Q50 ${f1(TOP + 4.6)} 58 ${TOP + 7}" stroke="${hi}" stroke-width=".9" fill="none"/>`)
      break
  }
  return { front: front.join(''), back: back.join('') }
}

// ── Gear ─────────────────────────────────────────────────────────────────────
function gearOf(look, G, color) {
  const { cw } = G, L = 50 - cw, R = 50 + cw
  switch (look.gear) {
    case 'eyeblack': return `<path d="M38.6 46.6h7.4l-.6 2.6h-6.2zM54 46.6h7.4l-.6 2.6h-6.2z" fill="#121318"/>`
    case 'headband': return `<path d="M${f1(L - 0.8)} 29.6C${f1(L)} 25 ${f1(R)} 25 ${f1(R + 0.8)} 29.6L${f1(R + 0.4)} 34.6C${f1(R - 2)} 31 ${f1(L + 2)} 31 ${f1(L - 0.4)} 34.6Z" fill="#f2f3f5" ${OUT}/><path d="M${f1(L)} 31.4C${f1(L + 2)} 28 ${f1(R - 2)} 28 ${f1(R)} 31.4" stroke="${color}" stroke-width="1.2" fill="none"/>`
    case 'durag': {
      const c = '#1b1c22'
      return `<path d="M${f1(L - 1)} 39C${f1(L - 1.6)} 21 ${f1(50 - cw * 0.6)} ${TOP - 2} 50 ${TOP - 2}C${f1(50 + cw * 0.6)} ${TOP - 2} ${f1(R + 1.6)} 21 ${f1(R + 1)} 39L${f1(R - 1.6)} 38C${f1(R - 2.4)} 31 ${f1(R - 6)} 28.4 50 28.4C${f1(L + 6)} 28.4 ${f1(L + 2.4)} 31 ${f1(L + 1.6)} 38Z" fill="${c}" ${OUT}/><path d="M50 ${f1(TOP - 1.6)}V27.6M${f1(L + 4)} 24Q50 20.6 ${f1(R - 4)} 24" stroke="${lite(c, 0.18)}" stroke-width="1" fill="none"/>`
    }
    case 'studs': return `<circle cx="${f1(L - 0.6)}" cy="48.6" r="1.3" fill="#f4f6fa" stroke="${K}" stroke-width=".8"/><circle cx="${f1(R + 0.6)}" cy="48.6" r="1.3" fill="#f4f6fa" stroke="${K}" stroke-width=".8"/>`
    default: return ''
  }
}

// ── A coach's pieces ─────────────────────────────────────────────────────────
// the top: a polo in the team's colour (its collar open at the neck, the placket's buttons) or a quarter-zip (dark,
// the stand-up collar in the team's colour, the zip)
function topOf(look, G, color) {
  const { nw } = G, sh = 23
  const body = look.top === 'polo' ? color : '#262a33', bodySh = shade(body, 0.22)
  const shoulders = `M-2 102L-2 90C1 82 ${f1(50 - nw - sh)} 75.4 ${f1(50 - nw - 6)} 72.6C${f1(50 - nw - 2)} 71.6 ${f1(50 - nw)} 70.4 ${f1(50 - nw)} 69.6Q50 80 ${f1(50 + nw)} 69.6C${f1(50 + nw)} 70.4 ${f1(50 + nw + 2)} 71.6 ${f1(50 + nw + 6)} 72.6C${f1(50 + nw + sh)} 75.4 99 82 102 90L102 102Z`
  let s = `<path d="${shoulders}" fill="${body}" ${OUT}/>`
    + `<path d="M${f1(50 + nw + 8)} 73.2C${f1(50 + nw + sh)} 76 97 83 101 91L101 101L${f1(50 + nw + 14)} 101C${f1(50 + nw + 12)} 92 ${f1(50 + nw + 10)} 82 ${f1(50 + nw + 8)} 73.2Z" fill="${bodySh}"/>`
  if (look.top === 'polo') {
    // the open collar: two flaps lying on the shoulders, the placket down from the V
    const fl = lite(color, 0.12)
    s += `<path d="M${f1(50 - nw - 0.6)} 68.4L${f1(50 - nw - 7)} 73.4L${f1(50 - 6)} 82.4L50 77.6Z" fill="${fl}" ${OUT}/><path d="M${f1(50 + nw + 0.6)} 68.4L${f1(50 + nw + 7)} 73.4L${f1(50 + 6)} 82.4L50 77.6Z" fill="${shade(fl, 0.12)}" ${OUT}/>`
    s += `<path d="M48.4 78.6V90M51.6 78.6V90" stroke="${shade(color, 0.35)}" stroke-width=".9"/><circle cx="50" cy="83" r=".9" fill="#f2f3f5"/><circle cx="50" cy="87.4" r=".9" fill="#f2f3f5"/>`
  } else {
    // the stand-up collar in the team's colour and the zip pulled half down
    s += `<path d="M${f1(50 - nw - 1.2)} 66.6Q50 72.6 ${f1(50 + nw + 1.2)} 66.6L${f1(50 + nw + 2.2)} 72.4Q50 79.6 ${f1(50 - nw - 2.2)} 72.4Z" fill="${color}" ${OUT}/>`
    s += `<path d="M50 75.6V100" stroke="${K}" stroke-width="1.4"/><path d="M50 75.6V100" stroke="#9aa0aa" stroke-width=".6"/><rect x="48.8" y="80" width="2.4" height="3.6" rx=".6" fill="#c9ced6" stroke="${K}" stroke-width=".6"/>`
  }
  return s
}
// the lines of a face that has coached thirty years: the forehead, the smile lines, the corners of the eyes
function linesOf(look, sk) {
  const ag = look.ag ?? 0
  if (ag < 42) return ''
  const c = shade(sk, 0.3), w = ag >= 58 ? 0.9 : 0.75
  let s = `<path d="M45.6 51.4C43.8 53.4 43.2 55.8 44 58.2M54.4 51.4C56.2 53.4 56.8 55.8 56 58.2" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`
  if (ag >= 48 && !look.cap) s += `<path d="M44 31Q50 29.8 56 31M45.4 33.6Q50 32.6 54.6 33.6" stroke="${c}" stroke-width=".7" fill="none" stroke-linecap="round"/>`
  if (ag >= 55) s += `<path d="M37.6 41.6l-1.6-.8M37.8 43.4l-1.6.4M62.4 41.6l1.6-.8M62.2 43.4l1.6.4M40.4 45.6Q42.6 46.6 45 45.6M55 45.6Q57.4 46.6 59.6 45.6" stroke="${c}" stroke-width=".7" fill="none" stroke-linecap="round"/>`
  return s
}
function glassesOf(look, G) {
  if (!look.specs) return ''
  const { cw } = G, L = 50 - cw, R = 50 + cw
  const fr = look.specs === 2 ? '#7a6248' : '#1b1d24'
  return `<path d="M${f1(L + 0.4)} 40.8L37.4 40.6M62.6 40.6L${f1(R - 0.4)} 40.8" stroke="${fr}" stroke-width="1.1"/>`
    + `<rect x="37.2" y="38.6" width="10.2" height="7.4" rx="2.4" fill="#ffffff" fill-opacity=".08" stroke="${fr}" stroke-width="1.3"/><rect x="52.6" y="38.6" width="10.2" height="7.4" rx="2.4" fill="#ffffff" fill-opacity=".08" stroke="${fr}" stroke-width="1.3"/>`
    + `<path d="M47.4 41Q50 39.8 52.6 41" stroke="${fr}" stroke-width="1.1" fill="none"/>`
}
// a ball cap or a visor in the team's colour, his hair under it
function capOf(look, G, color) {
  if (!look.cap) return ''
  const { cw } = G, L = 50 - cw, R = 50 + cw
  const brim = shade(color, 0.28), ink = `stroke="${K}" stroke-width="1.6" stroke-linejoin="round"`
  const band = `M${f1(L - 1.2)} 31.4C${f1(L - 0.6)} 27.4 ${f1(R + 0.6)} 27.4 ${f1(R + 1.2)} 31.4`
  const brimP = `M${f1(L + 1)} 30.6C${f1(L + 4)} 27.6 ${f1(R - 4)} 27.6 ${f1(R - 1)} 30.6C${f1(R - 3)} 35.6 ${f1(L + 3)} 35.6 ${f1(L + 1)} 30.6Z`
  if (look.cap === 'visor') return `<path d="${band}L${f1(R + 0.6)} 33.6C${f1(R - 2)} 30.4 ${f1(L + 2)} 30.4 ${f1(L - 0.6)} 33.6Z" fill="${color}" ${ink}/><path d="${brimP}" fill="${brim}" ${ink}/>`
  const crown = `M${f1(L - 1.2)} 32C${f1(L - 2)} ${TOP + 2} ${f1(50 - cw * 0.6)} ${TOP - 3.6} 50 ${TOP - 3.6}C${f1(50 + cw * 0.6)} ${TOP - 3.6} ${f1(R + 2)} ${TOP + 2} ${f1(R + 1.2)} 32C${f1(R - 3)} 29.4 ${f1(L + 3)} 29.4 ${f1(L - 1.2)} 32Z`
  return `<path d="${crown}" fill="${color}" ${ink}/><path d="M50 ${TOP - 3.4}V29.6M${f1(50 - cw * 0.5)} ${TOP - 1}Q${f1(50 - cw * 0.4)} 24 ${f1(50 - cw * 0.45)} 30M${f1(50 + cw * 0.5)} ${TOP - 1}Q${f1(50 + cw * 0.4)} 24 ${f1(50 + cw * 0.45)} 30" stroke="${shade(color, 0.3)}" stroke-width=".9" fill="none"/><circle cx="50" cy="${f1(TOP - 3.2)}" r="1.4" fill="${color}" ${ink}/><path d="${brimP}" fill="${brim}" ${ink}/>`
}

// ── The bust ─────────────────────────────────────────────────────────────────
export function faceSvg(look, { color = '#d2aa4f' } = {}) {
  const G = geo(look)
  const sk = look.skin, dk = shade(sk, 0.17)
  const { cw, jw, jy, cy, nw } = G, L = 50 - cw, R = 50 + cw
  const collar = color || '#d2aa4f'
  // (a durag covers the hair; long hair that hangs still shows behind it)
  const hp = hairParts(look.gear === 'durag' ? { ...look, hair: ['locs', 'long', 'flow', 'mullet'].includes(look.hair) ? look.hair : 'shaved' } : look, G, sk)
  const front = look.gear === 'durag' ? '' : hp.front
  const sh = 22 + (look.wide ?? 0.2) * 3   // how far the shoulders reach past the neck
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW}">`
    + hp.back
    // the neck, thick, into the traps; the jaw's shadow on it
    + `<path d="M${f1(50 - nw)} 52L${f1(50 - nw - 1)} 74L${f1(50 + nw + 1)} 74L${f1(50 + nw)} 52Z" fill="${sk}" ${OUT}/>`
    + `<path d="M${f1(50 - nw + 0.8)} 56L${f1(50 + nw - 0.8)} 56L${f1(50 + nw - 0.6)} ${f1(cy + 1)}Q50 ${f1(cy + 7)} ${f1(50 - nw + 0.6)} ${f1(cy + 1)}Z" fill="${dk}"/>`
    // the shirt: broad shoulders, the far side in shade, a crew collar in the team's colour (a coach: his polo or zip)
    + (look.top ? topOf(look, G, collar) : `<path d="M-2 102L-2 90C1 82 ${f1(50 - nw - sh)} 75.4 ${f1(50 - nw - 6)} 72.6C${f1(50 - nw - 2)} 71.6 ${f1(50 - nw)} 70.4 ${f1(50 - nw)} 69.6Q50 80 ${f1(50 + nw)} 69.6C${f1(50 + nw)} 70.4 ${f1(50 + nw + 2)} 71.6 ${f1(50 + nw + 6)} 72.6C${f1(50 + nw + sh)} 75.4 99 82 102 90L102 102Z" fill="${SHIRT}" ${OUT}/>`
    + `<path d="M${f1(50 + nw + 8)} 73.2C${f1(50 + nw + sh)} 76 97 83 101 91L101 101L${f1(50 + nw + 14)} 101C${f1(50 + nw + 12)} 92 ${f1(50 + nw + 10)} 82 ${f1(50 + nw + 8)} 73.2Z" fill="${SHIRT_SH}"/>`
    + `<path d="M${f1(50 - nw - 0.4)} 69.4Q50 80.4 ${f1(50 + nw + 0.4)} 69.4L${f1(50 + nw + 4.4)} 71.6Q50 86 ${f1(50 - nw - 4.4)} 71.6Z" fill="${collar}" ${OUT}/>`)
    // ears, then the head
    + `<ellipse cx="${f1(L + 0.2)}" cy="44.4" rx="3.2" ry="5.4" fill="${sk}" ${OUT}/><ellipse cx="${f1(R - 0.2)}" cy="44.4" rx="3.2" ry="5.4" fill="${dk}" ${OUT}/>`
    + `<path d="M${f1(L - 0.6)} 42.6q1.2 -1.6 1.8 1.4" stroke="${dk}" stroke-width="1.1" fill="none"/>`
    + `<path d="${headPath(G)}" fill="${sk}" ${OUT}/>`
    + `<path d="${cheekShade(G)}" fill="${dk}"/>`
    + (look.beard === 'stubble' ? beardOf(look, G, sk) : '')
    + eyesOf(look, sk)
    + browsOf(look)
    + noseOf(look, sk)
    + (look.beard !== 'stubble' ? beardOf(look, G, sk) : '')
    + linesOf(look, sk)
    + mouthOf(look, sk)
    + stacheOf(look)
    + (look.gear === 'eyeblack' ? gearOf(look, G, collar) : '')
    + front
    + (look.gear !== 'eyeblack' ? gearOf(look, G, collar) : '')
    + glassesOf(look, G)
    + capOf(look, G, collar)
    // the head's outline once more over the hair's edge at the temples (keeps the skull's line clean)
    + `<path d="M${f1(L)} 40C${f1(L)} 47 ${f1(50 - jw - 0.8)} ${jy - 4} ${f1(50 - jw)} ${jy}M${f1(R)} 40C${f1(R)} 47 ${f1(50 + jw + 0.8)} ${jy - 4} ${f1(50 + jw)} ${jy}" stroke="${K}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    + `</svg>`
}

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
  return {
    g: bg, ag: age, skin, head: pickW(r, [['square', 40], ['broad', 30], ['oval', 20], ['round', 10]]), eyes: pickW(r, [['hooded', 40], ['narrow', 30], ['almond', 30]]),
    brows: pickW(r, [['thick', 34], ['straight', 40], ['angled', 26]]), nose: base.nose, mouth: pickW(r, [['thin', 40], ['neutral', 50], ['smirk', 10]]),
    hair, hc, brow: age >= 58 ? mixC(nat, G3[1], 0.6) : nat, bc: hc, beard, stache, gear: 'none', wide: 0.7,
    specs: r() < (age >= 55 ? 0.45 : 0.25) ? (r() < 0.75 ? 1 : 2) : 0,
    cap: u < 0.18 ? 'visor' : u < 0.3 ? 'cap' : null,
    top: r() < 0.55 ? 'polo' : 'zip',
  }
}
const CCACHE = new Map()
export function coachUrl(key, { g = null, ag = null, color = '#d2aa4f' } = {}) {
  // (the face changes only as he greys: keyed by his age in steps)
  const step = ag == null ? '' : ag < 45 ? 0 : ag < 52 ? 1 : ag < 58 ? 2 : ag < 60 ? 3 : 4
  const k = `${key}|${g ?? ''}|${step}|${color}`
  let u = CCACHE.get(k)
  if (!u) {
    u = `data:image/svg+xml,${encodeURIComponent(faceSvg(coachLook(key, { g, ag }), { color }))}`
    if (CCACHE.size > 400) CCACHE.clear()
    CCACHE.set(k, u)
  }
  return u
}
// a coach's saved face (the player's built coach: { key, coach: 1, g?, ag? }, or an older save's player-style
// { key, pos }) as a url
export const coachFaceUrl = (face, color, ag = null) => (!face ? null : face.coach ? coachUrl(face.key, { g: face.g ?? null, ag: ag ?? face.ag ?? null, color }) : faceUrl(face.key, face.pos, color))

const CACHE = new Map()
export function faceUrl(key, pos, color) {
  const k = `${key}|${pos}|${color ?? ''}`
  let u = CACHE.get(k)
  if (!u) {
    u = `data:image/svg+xml,${encodeURIComponent(faceSvg(lookOf(key, pos), { color }))}`
    if (CACHE.size > 800) CACHE.clear()
    CACHE.set(k, u)
  }
  return u
}
// a league man's face (a made-up man only: the caller checks he isn't real and isn't a build)
export const genFace = (p, color) => (p ? faceUrl(p.fk ?? p.n, p.p, color) : null)

// ── A build's face: the player's own pick ────────────────────────────────────
// Every build gets a face of his own (never a real man's photo). It starts as one coherent made-up man (lookOf, keyed
// by the setup's seed and the roster spot), and the player can change any part of it (FacePick.jsx). Saved on the
// build as B.face = { skin, head, eyes, brows, nose, mouth, hair, hc, beard, stache, gear }.
//   defaultFace(key, pos)     a coherent random look, in the picker's terms
//   buildLook(B)              the look the drawing reads (B.face over his default: an older save's face, which had
//                             only skin, hair, hc and beard, gets the rest from the default and its beard mapped)
//   buildFaceUrl(B, color)    the build's face as a data: URL
export const FACE_KEYS = ['skin', 'head', 'eyes', 'brows', 'nose', 'mouth', 'hair', 'hc', 'beard', 'stache', 'gear']
const near = (list, c) => list.reduce((a, x) => (Math.abs(lum(x[0]) - lum(c)) < Math.abs(lum(a[0]) - lum(c)) ? x : a))[0]
const ok = (list, v) => list.some(x => x[0] === v)
export function defaultFace(key, pos) {
  const L = lookOf(`build|${key}`, pos)
  return {
    skin: near(FACE_SKIN, L.skin), head: L.head, eyes: L.eyes, brows: L.brows, nose: L.nose, mouth: L.mouth,
    hair: L.hair, hc: ok(FACE_HC, L.hc) ? L.hc : near(FACE_HC, L.hc), beard: L.beard, stache: L.stache, gear: L.gear,
  }
}
// an older face's beard (before 2026-11-15 the moustache was part of the beard)
const OLD_BEARD = { stache: ['none', 'full'], goatee: ['goatee', 'full'], full: ['full', 'full'] }
const groupOfSkin = s => (lum(s) > 175 ? 'w' : lum(s) > 120 ? 'm' : 'b')
export function buildLook(B) {
  const pos = B?.pos ?? 'wr'
  const base = defaultFace(B?.name ?? 'build', pos)
  const f = { ...base, ...(B?.face ?? {}) }
  if (B?.face && !B.face.stache && OLD_BEARD[B.face.beard]) [f.beard, f.stache] = OLD_BEARD[B.face.beard]
  for (const [k, list] of [['head', FACE_HEAD], ['eyes', FACE_EYES], ['brows', FACE_BROWS], ['nose', FACE_NOSE], ['mouth', FACE_MOUTH], ['hair', FACE_HAIR], ['beard', FACE_BEARD], ['stache', FACE_STACHE], ['gear', FACE_GEAR]]) if (!ok(list, f[k])) f[k] = base[k]
  // dyed tips only show on locs and twists; on any other cut the colour underneath is black
  const hc = f.hc === '#b8893c' && f.hair !== 'locs' && f.hair !== 'twists' ? '#16110e' : f.hc
  return { ...f, g: groupOfSkin(f.skin), hc, brow: f.hc === '#b8893c' ? '#16110e' : hc, wide: wideOf(pos) }
}
const BCACHE = new Map()
export function buildFaceUrl(B, color) {
  if (!B) return null
  const L = buildLook(B)
  const k = `${FACE_KEYS.map(x => L[x]).join('|')}|${L.wide}|${color ?? ''}`
  let u = BCACHE.get(k)
  if (!u) {
    u = `data:image/svg+xml,${encodeURIComponent(faceSvg(L, { color }))}`
    if (BCACHE.size > 400) BCACHE.clear()
    BCACHE.set(k, u)
  }
  return u
}
