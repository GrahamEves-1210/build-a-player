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
// (the shares by position, the way NFL rooms are: corners almost all Black, safeties, receivers and backs mostly
// Black, the defensive line Black with a few Polynesian men, linebackers about 70/25, tight ends and offensive lines
// about half and half with Polynesian linemen, quarterbacks mostly white, kickers and punters nearly all white)
const MIX = {
  qb: { b: 0.38, w: 0.58, m: 0.02, p: 0.01, l: 0.01 },
  rb: { b: 0.85, w: 0.12, m: 0.02, p: 0.005, l: 0.005 },
  wr: { b: 0.88, w: 0.1, m: 0.015, l: 0.005 },
  te: { b: 0.45, w: 0.52, m: 0.01, p: 0.01, l: 0.01 },
  ol: { b: 0.42, w: 0.48, p: 0.08, m: 0.01, l: 0.01 },
  dl: { b: 0.8, w: 0.1, p: 0.08, m: 0.015, l: 0.005 },
  lb: { b: 0.7, w: 0.25, p: 0.03, m: 0.015, l: 0.005 },
  cb: { b: 0.97, w: 0.01, m: 0.02 },
  s: { b: 0.8, w: 0.17, m: 0.02, p: 0.01 },
  db: { b: 0.9, w: 0.075, m: 0.02, p: 0.005 },
  k: { b: 0.05, w: 0.92, l: 0.02, m: 0.01 },
  any: { b: 0.57, w: 0.36, p: 0.03, m: 0.03, l: 0.01 },
}
// any position or spot a caller has (league.js's p and s, a real roster's subpos, a Career position) to its room
const ROOM = {
  edge: 'dl', dt: 'dl', de: 'dl', di: 'dl', idl: 'dl', nt: 'dl', olb: 'lb', ilb: 'lb', mlb: 'lb', big: 'lb',
  nb: 'cb', fs: 's', ss: 's', saf: 's', p: 'k', ls: 'k', lt: 'ol', lg: 'ol', c: 'ol', rg: 'ol', rt: 'ol', g: 'ol', t: 'ol', ot: 'ol', og: 'ol', iol: 'ol',
  hb: 'rb', fb: 'rb',
}
export const roomOf = pos => { const k = String(pos ?? '').toLowerCase(); return MIX[k] ? k : ROOM[k] ?? 'any' }
// a league man's room: his spot when it splits his position (a corner or a safety; an edge or a tackle)
// (fs: the spot he had when he was first drawn, kept when he moves rooms, so a corner moved to safety keeps his face)
export const facePos = p => { const s = p?.fs ?? p?.s; return p ? ((p.p === 'db' || p.p === 'dl') && s ? s : p.p) : 'any' }

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
  b: ['#a06c44', '#9c6440', '#8a5634', '#8a5634', '#7a4a2c', '#7a4a2c', '#6a4128', '#5e3a22', '#5e3a22', '#4e2f1e', '#432818'],
  w: ['#f4d2b6', '#eab996', '#eab996', '#d9a582', '#deae84'],
  m: ['#c99064', '#b98058', '#a06c44', '#deae84'],
  p: ['#a06c44', '#9c6440', '#8a5634', '#b98058'],
  l: ['#deae84', '#c99064', '#b98058', '#d9a582'],
}
// (then, now and then, a neighbouring tone the older list didn't have)
const SKIN_NEXT = { '#f4d2b6': '#f6dccb', '#d9a582': '#cfa27c', '#b98058': '#ae7a56', '#7a4a2c': '#6a4128', '#5e3a22': '#4e2f1e', '#432818': '#33201a', '#deae84': '#cfa27c' }
const HAIR = {
  b: [['fade', 28], ['waves', 12], ['buzz', 12], ['locs', 12], ['twists', 8], ['cornrows', 5], ['hightop', 2], ['shaved', 9], ['afro', 3], ['curly', 4]],
  w: [['crew', 26], ['sidepart', 12], ['textured', 16], ['flow', 12], ['buzz', 16], ['curly', 5], ['shaved', 4], ['mullet', 3], ['fade', 6]],   // (no long hair on a made-up white man: it read as a costume)
  m: [['fade', 26], ['curly', 24], ['buzz', 12], ['twists', 8], ['locs', 8], ['afro', 4], ['shaved', 6], ['textured', 8], ['waves', 4]],
  p: [['curly', 20], ['long', 14], ['buzz', 18], ['fade', 20], ['bun', 10], ['shaved', 10], ['mullet', 4]],
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
  b: [['none', 28], ['stubble', 12], ['goatee', 12], ['short', 22], ['full', 16], ['chin', 8], ['long', 1]],
  w: [['none', 38], ['stubble', 24], ['short', 18], ['full', 14], ['goatee', 3], ['chin', 1], ['long', 2]],
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
const wideOf = pos => { const k = roomOf(pos); return BIG.has(k) ? 1 : k === 'lb' || k === 'rb' ? 0.5 : 0.2 }
const r2 = v => Math.round(v * 100) / 100
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

// the newer parts (iris, shape sliders, the eye black / earrings / chain split out of the old single gear), from a
// second stream so the first parts keep their older draws
function extras(key, L, pos) {
  const r = seeded(`face2|${key}`)
  const room = roomOf(pos), g = L.g, big = BIG.has(room), lean = room === 'db' || room === 'cb' || room === 's' || room === 'wr'
  const s = () => r2((r() + r() + r()) / 1.5 - 1)   // -1 … 1, most near the middle
  const x = {
    iris: pickW(r, IRIS[g] ?? IRIS.w),
    wt: r2(clamp((big ? 0.55 : lean ? -0.35 : room === 'qb' || room === 'k' ? -0.1 : 0.1) + s() * 0.45, -1, 1)),
    jaw: r2(s() * 0.7 + (big ? 0.2 : 0)), chn: r2(s() * 0.6), chk: r2(s() * 0.7 + (lean ? 0.15 : 0)),
    esz: r2(s() * 0.5), esp: r2(s() * 0.5), brh: r2(s() * 0.5),
    nsw: r2(s() * 0.6), nsl: r2(s() * 0.5), lip: r2(s() * 0.6 + (g === 'b' ? 0.2 : 0)), mw: r2(s() * 0.5),
    eb: 'none', ear: 'none', chain: 'none', cleft: r() < 0.25,
  }
  if (L.gear === 'eyeblack') x.eb = 'paint'
  if (L.gear === 'studs') x.ear = 'studs'
  const u = r()
  // (a headshot: eye black is rare, strips never; a stud now and then; a chain now and then)
  if (x.ear === 'none' && g !== 'w' && u > 0.94) x.ear = u > 0.98 ? 'stud' : 'studs'
  if (r() < 0.04) x.chain = r() < 0.75 ? 'gold' : 'silver'
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
  if (L.beard === 'none' && r() < 0.05) x.beard = 'patch'
  return x
}

export function lookOf(key, pos = 'wr', ag = null) {
  const r = seeded(`face|${key}`)
  const mix = MIX[roomOf(pos)]
  const g = pickW(r, Object.entries(mix).map(([k, v]) => [k, v * 100]))
  const skin = SKIN[g][Math.floor(r() * SKIN[g].length)]
  const hair = pickW(r, HAIR[g])
  let hc = pickW(r, HC[g])
  // dyed tips only on locs or twists; otherwise his natural colour
  if (hc === '#b8893c' && hair !== 'locs' && hair !== 'twists') hc = '#16110e'
  let beard = pickW(r, BEARD[g])
  // (a shaved head usually comes with a beard; hair to the shoulders or tied up always does, so it reads as a
  // football player's, never a woman's)
  if (hair === 'shaved' && beard === 'none' && r() < 0.6) beard = 'full'
  if ((hair === 'long' || hair === 'bun') && (beard === 'none' || beard === 'stubble' || beard === 'chin')) beard = g === 'p' ? 'full' : 'short'
  // (hair over the ears with a bare face reads young and soft in a drawing: a flow or a mullet gets some stubble)
  if ((hair === 'flow' || hair === 'mullet') && beard === 'none') beard = 'stubble'
  // the moustache that goes with the beard: a full beard or a goatee has one, a clean face now and then a thin one
  const stache = beard === 'full' || beard === 'long' || beard === 'short' ? 'full' : beard === 'goatee' ? (r() < 0.8 ? 'full' : 'horseshoe')
    : beard === 'none' && r() < 0.04 ? 'thin' : 'none'
  let head = pickW(r, HEAD[g])
  if (BIG.has(roomOf(pos)) && head === 'long' && r() < 0.6) head = 'broad'
  const u = r()
  // (a headshot: now and then eye black or a headband, a stud; never a durag on a made-up man)
  const gear = u < 0.02 ? 'eyeblack' : u < 0.04 && hair !== 'afro' && hair !== 'hightop' ? 'headband' : u < 0.09 && g !== 'w' ? 'studs' : 'none'
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

// the ink: one warm near-black (the jersey, the hair); on the skin the ink is the skin's own darkest brown, so the
// lines read as drawn edges, not a black cartoon outline
const INK = '#150d0a'
// a skin's flat tones (inked cel shading: flat tones, no gradients): its base, a half tone (the planes turning away),
// its shadow (tinted by its undertone), the deep creases, its highlight (deep skin takes a cool sheen in place of a
// warm one), the rim of cool light down the shadow side, the ink on the skin, the line of the features, the lips, the
// whites of the eyes
const UT = { pink: '#8c2e2c', neutral: '#6e3622', golden: '#7c4612', olive: '#4e4220', red: '#76200f', cool: '#3c1832' }
const UT_OF = new Map(FACE_SKIN.map(x => [x[0], x[2]]))
const TONES = new Map()
function tonesOf(sk) {
  let t = TONES.get(sk)
  if (t) return t
  const L = lum(sk), d = clamp((205 - L) / 150, 0, 1)      // 0 the fairest … 1 the deepest
  const tint = mixC(UT[UT_OF.get(sk) ?? (L > 110 && L < 170 ? 'golden' : 'neutral')], '#000000', 0.2 + d * 0.5)
  const sh = mixC(sk, tint, 0.3 + d * 0.06)
  t = {
    d, base: sk, sh,
    md: mixC(sk, sh, 0.5),
    dk: mixC(sk, mixC(tint, '#000000', 0.5), 0.52 + d * 0.08),
    hl: d < 0.5 ? mixC(sk, '#fff3e6', 0.3 - d * 0.22) : mixC(sk, '#e3d7e0', 0.17 - d * 0.04),
    rim: mixC(sk, '#cfe0ff', 0.2 + d * 0.1),
    ink: mixC(sk, INK, 0.8 + d * 0.06),
    line: mixC(sk, INK, 0.6),
    lipU: d < 0.5 ? mixC(sk, '#7a2c34', 0.34 - d * 0.16) : mixC(sk, '#1e0c16', 0.26),
    lipL: d < 0.5 ? mixC(sk, '#c0645f', 0.24 - d * 0.08) : mixC(sk, '#8a4c58', 0.18),
    white: mixC('#e8e0d6', sk, 0.12 + d * 0.1),
  }
  TONES.set(sk, t)
  return t
}

// ── The frame ────────────────────────────────────────────────────────────────
// ESPN's headshot framing (their cutouts are 600 × 436, and a square slot shows the middle of one; measured against
// them side by side at the same box): the face about 35% of the frame's width, the eyes about a third of the way
// down, the chin at about 62%, the shoulders and the top of the chest filling the bottom, the frame's full width by
// about 80% down (a high top or an afro can run out of the top, as they do in the photos).
// hero: the creator's big face, a closer crop to edit by. The creator's thumbnails crop to the part they change.
// ('sm' is the full frame drawn for a list: 64 px and under, the fine lines left out.)
export const VIEWS = {
  full: '4 11 92 92', sm: '4 11 92 92', hero: '12 10 76 76', head: '21 11 58 58',
  eyes: '30 34 40 25', nose: '36 41 28 28', mouth: '35 49 30 25', low: '24 40 52 52', hair: '16 4 68 68', ear: '21 36 26 26',
}
const TOP = 17

// ── The head ─────────────────────────────────────────────────────────────────
// a grown man's skull: cw half the skull's width · tw the temples · cb the cheekbones · jw the jaw at its corner · jy
// the corner's height · ch half the chin · cy the chin. The face is narrower than the skull at the temples, widest at
// the cheekbones, a little hollow under them, then the jaw's corner and a chin with some width to it.
const SHAPE = {
  oval: { cw: 15.6, tw: 14.8, cb: 15.2, jw: 12.4, jy: 59.6, ch: 4.9, cy: 68.6 },
  square: { cw: 15.8, tw: 15.1, cb: 15.4, jw: 13.4, jy: 60.2, ch: 5.8, cy: 68.4 },
  round: { cw: 16.2, tw: 15.6, cb: 15.9, jw: 13.2, jy: 59.2, ch: 5.4, cy: 68.0 },
  long: { cw: 15.0, tw: 14.2, cb: 14.6, jw: 12.3, jy: 61.0, ch: 5.2, cy: 70.0 },
  broad: { cw: 16.6, tw: 16.0, cb: 16.4, jw: 14.2, jy: 60.0, ch: 6.2, cy: 68.6 },
  chiseled: { cw: 15.6, tw: 14.6, cb: 15.6, jw: 13.2, jy: 60.6, ch: 5.5, cy: 69.2 },
}
// what his background gives his structure (always with his skin, his hair and his beard): br the height of the
// nose's bridge · nk the nose's width · lk the lips' fullness · rid how deep the brow ridge sets the eyes · ck the
// cheekbones · eo how open the eyes are
const BGS = {
  w: { br: 1, nk: 0.92, lk: 0.86, rid: 1, ck: 0, eo: 1 },
  b: { br: 0.42, nk: 1.2, lk: 1.32, rid: 0.82, ck: 0.25, eo: 1.06 },
  m: { br: 0.62, nk: 1.08, lk: 1.14, rid: 0.86, ck: 0.2, eo: 1.04 },
  l: { br: 0.78, nk: 1.02, lk: 1.06, rid: 0.92, ck: 0.2, eo: 1.02 },
  p: { br: 0.7, nk: 1.18, lk: 1.2, rid: 0.84, ck: 0.6, eo: 1 },
}
const NOSE_W = { straight: 3.4, broad: 3.9, narrow: 2.95, short: 3.4, wide: 4.3, boxer: 3.7 }
const NOSE_BR = { straight: 0, broad: -0.12, narrow: 0.28, short: -0.1, wide: -0.18, boxer: 0.06 }
const MOUTH_W = { neutral: 5.7, full: 5.9, thin: 5.5, smirk: 5.7, wide: 6.5, stern: 5.8 }
// the eye: the upper lid's rise, the lower's drop, the tilt up to the outer corner
const EYE = { almond: [1.3, 0.82, 0.25], round: [1.48, 0.98, 0], narrow: [1.02, 0.72, 0.1], hooded: [1.18, 0.8, 0], deep: [1.2, 0.82, 0], upturn: [1.26, 0.78, 0.55] }
const sv = (look, k) => clamp(+look[k] || 0, -1, 1)
function geo(look) {
  const s = SHAPE[look.head] ?? SHAPE.oval, w = look.wide ?? 0.2, B = BGS[look.g] ?? BGS.w
  const wt = sv(look, 'wt'), jaw = sv(look, 'jaw'), chk = sv(look, 'chk'), chn = sv(look, 'chn')
  const G = {
    cw: s.cw + 0.4 + w * 0.5 + wt * 0.45,
    tw: s.tw + 0.4 + w * 0.5 + wt * 0.5,
    cb: s.cb + 0.5 + w * 0.6 + wt * 0.7 + chk * 0.6 + B.ck * 0.35,
    jw: s.jw + 0.4 + w * 0.8 + wt * 0.8 + jaw * 1.5,
    ch: s.ch + w * 0.3 + wt * 0.3 + jaw * 0.8,
    jy: s.jy + chn * 0.5 + wt * 0.3,
    cy: s.cy + chn * 1.5 + wt * 0.3,
    nw: 9.6 + w * 2.4 + wt * 1.0,
    lean: clamp(0.5 - w * 0.35 - wt * 0.5 + chk * 0.35, 0, 1),
    soft: clamp(wt * 0.7 + w * 0.25, 0, 1),
    ey: 43.2, es: 6.5 + sv(look, 'esp') * 0.65, ez: 0.94 + sv(look, 'esz') * 0.12, eo: B.eo,
    by: 40.2 - sv(look, 'brh') * 1.1, rid: B.rid * (look.eyes === 'deep' ? 1.35 : 1),
    ny: 53.6 + sv(look, 'nsl') * 1.3, nwid: (NOSE_W[look.nose] ?? 3.4) * B.nk * (1 + sv(look, 'nsw') * 0.2),
    br: clamp(B.br + (NOSE_BR[look.nose] ?? 0), 0.15, 1.3),
    mwid: (MOUTH_W[look.mouth] ?? 5.2) * (1 + sv(look, 'mw') * 0.12), lipk: (1 + sv(look, 'lip') * 0.4) * B.lk,
  }
  G.my = 59.3 + sv(look, 'nsl') * 0.4 + chn * 0.35
  // the head's outline: a smooth curve through these points (the right side, top to chin; the left is its mirror)
  const { cw, tw, cb, jw, jy, ch, cy, lean, soft } = G
  G.R = [
    [50 + cw * 0.52, TOP + 0.6], [50 + cw * 0.87, TOP + 4.2], [50 + cw, TOP + 10.2], [50 + cw - 0.15, TOP + 15.4],
    [50 + tw, 37.2], [50 + cb, 44.6], [50 + cb - 0.5 - lean * 0.55 + soft * 0.35, 50.8],
    [50 + jw + 0.3, jy - 2.5], [50 + jw - 0.25, jy + 0.35], [50 + jw - 2.1, jy + 3.1], [50 + ch + 1.4, cy - 1.45], [50 + ch * 0.5, cy - 0.12],
  ]
  G.segs = crSegs([[50, TOP], ...G.R, [50, cy], ...G.R.slice().reverse().map(mr)])
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
// a smooth closed curve through points as its Bézier pieces ([from, handle, handle, to] each), so a stretch of it can
// be drawn on its own (the jaw's ink lies exactly on the head's edge)
function crSegs(p) {
  const n = p.length, at = i => p[(i + n) % n], s = []
  for (let i = 0; i < n; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2)
    s.push([b, [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6], [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6], c])
  }
  return s
}
const segD = (s, close = false) => `M${pt(s[0][0])}${s.map(x => `C${pt(x[1])} ${pt(x[2])} ${pt(x[3])}`).join('')}${close ? 'Z' : ''}`
// a point along a piece (t 0 … 1) and the outward normal there (the outline runs clockwise)
function onSeg([a, b, c, d], t) {
  const u = 1 - t
  const p = [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]
  const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]), dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1])
  const l = Math.hypot(dx, dy) || 1
  return [p, [dy / l, -dx / l]]
}
// the outline sampled from piece i0 to piece i1 (k points a piece), each point pushed out along its normal by off(u)
// (u 0 … 1 along the stretch)
function along(G, i0, i1, k, off = () => 0) {
  const out = [], n = (i1 - i0) * k
  for (let j = 0; j <= n; j++) {
    const i = Math.min(i0 + Math.floor(j / k), i1 - 1), t = j === n ? 1 : (j % k) / k
    const [p, nm] = onSeg(G.segs[i], t), o = off(j / n)
    out.push([p[0] + nm[0] * o, p[1] + nm[1] * o])
  }
  return out
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
// a polyline (hair's broken edges)
const poly = (p, close = false) => `M${p.map(pt).join('L')}${close ? 'Z' : ''}`
// an ellipse as path data (so many go in one path)
const ell = (x, y, rx, ry) => `M${f1(x - rx)} ${f1(y)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(rx * 2)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-rx * 2)} 0Z`
const stroke = (d, c, w, extra = '') => (d ? `<path d="${d}" fill="none" stroke="${c}" stroke-width="${String(w).replace(/^0\./, '.')}"${extra}/>` : '')
const fill = (d, c, extra = '') => (d ? `<path d="${d}" fill="${c}"${extra}/>` : '')
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) }
const headD = G => segD(G.segs, true)
// the jaw: from under one cheekbone round the chin to under the other (pieces 7 … 19 of the outline)
const jawD = G => segD(G.segs.slice(7, 20))
// a cap of hair on the skull: t how far it stands off the skull, line the hairline's middle, side how far down the
// sides it comes, tc the temple corner (0 a line-up's square corner … 1 a soft round one), rec how far the temples go
// back (a receding line)
function capD(G, { t = 1, line = 27.6, side = 39, tc = 0.3, rec = 0 } = {}) {
  const { cw } = G, o = cw + 0.5 + t * 0.3
  const tx = 50 + cw - 2.4 - tc * 0.8 - rec * 1.4, ty = line + 2.2 - rec * 2.4
  return sym([50, TOP - t], [
    [[50 + o * 0.58, TOP - t], [50 + o, TOP + 8 - t * 0.4], [50 + o, side]],
    [[50 + o - 0.6, side], [50 + cw - 1.2, side], [50 + cw - 1.5, side - 0.4]],
    [[50 + cw - 1.6, side - 4], [tx + 0.6, ty + 3 + tc], [tx, ty]],
    [[tx - 1.2 - tc * 2, ty - 1.6 + rec * 0.4], [50 + 6, line - rec * 0.2], [50, line - 0.4 + rec * 0.6]],
  ])
}

// ── The features ─────────────────────────────────────────────────────────────
// Each feature adds its flat shapes to the head's shading tones (S.md the half tone, S.sh the shadow, S.dk the deep
// creases, S.hl the light: one path each, so the whole face is a handful of elements) and returns its own drawing.
function eyesOf(look, G, T, S, P, lo) {
  const k = EYE[look.eyes] ?? EYE.almond, iris = look.iris ?? '#2b1a10', ring = shade(iris, 0.5)
  let wh = '', band = '', ir = '', pu = '', cl = '', lash = '', crease = '', lid = '', fold = ''
  for (const s of [-1, 1]) {
    const cx = 50 + s * G.es, y = G.ey, ew = 3.15 * G.ez, up = k[0] * G.ez * G.eo, dn = k[1] * G.ez * G.eo, tilt = k[2]
    const I = [cx - s * ew, y + 0.3], O = [cx + s * ew, y - tilt + 0.15]
    const u1 = [cx - s * ew * 0.45, y - up * 1.3], u2 = [cx + s * ew * 0.42, y - up * 1.26 - tilt * 0.4]
    const l1 = [cx + s * ew * 0.45, y + dn * 1.2], l2 = [cx - s * ew * 0.45, y + dn * 1.15]
    wh += `M${pt(I)}C${pt(u1)} ${pt(u2)} ${pt(O)}C${pt(l1)} ${pt(l2)} ${pt(I)}Z`
    // the upper lid's shadow across the top of the ball
    band += `M${pt(I)}C${pt(u1)} ${pt(u2)} ${pt(O)}L${pt([O[0], O[1] + 0.5])}C${pt([u2[0], u2[1] + up * 0.7 + 0.3])} ${pt([u1[0], u1[1] + up * 0.7 + 0.3])} ${pt([I[0], I[1] + 0.3])}Z`
    // the iris (tucked a little under the upper lid, the way a relaxed eye sits), the pupil, a small catchlight
    const r = Math.min(1.18 * G.ez, (up + dn) * 0.6), ix = cx + s * 0.05, iy = y - 0.05
    ir += ell(ix, iy, r, r)
    pu += ell(ix, iy, r * 0.42, r * 0.42)
    cl += ell(ix - r * 0.4, iy - r * 0.38, r * 0.17, r * 0.17)
    // the lash line: the upper lid's edge, thin at the inner corner, a touch heavier to the outer
    lash += `M${pt([I[0] + s * 0.1, I[1] - 0.05])}C${pt([u1[0], u1[1] - 0.06])} ${pt([u2[0], u2[1] - 0.1])} ${pt([O[0] + s * 0.35, O[1] - 0.15])}L${pt([O[0] - s * 0.15, O[1] + 0.3])}C${pt([u2[0], u2[1] + 0.48])} ${pt([u1[0], u1[1] + 0.36])} ${pt([I[0] + s * 0.4, I[1] + 0.14])}Z`
    // the lid's crease (a deep-set eye's sits higher; a hooded eye's is a fold of skin over the outer lid)
    const ch = look.eyes === 'deep' ? 2.5 : look.eyes === 'narrow' ? 1.9 : 2.15
    if (look.eyes === 'hooded') {
      fold += `M${pt([cx - s * ew * 0.3, y - up * 1.7])}Q${f1(cx + s * ew * 0.7)} ${f1(y - up * 1.65)} ${pt([O[0] + s * 0.5, O[1] + 0.1])}Q${f1(cx + s * ew * 0.45)} ${f1(y - up * 0.95)} ${pt([cx - s * ew * 0.3, y - up * 1.7])}Z`
      crease += `M${pt([I[0] + s * 0.6, I[1] - up * 0.9])}Q${f1(cx - s * ew * 0.2)} ${f1(y - up * 1.75)} ${pt([cx + s * ew * 0.2, y - up * 1.25])}Q${f1(cx + s * ew * 0.6)} ${f1(y - up * 1.05)} ${pt([O[0] + s * 0.5, O[1] + 0.1])}`
    } else crease += `M${pt([I[0] + s * 0.8, I[1] - up * 0.95])}Q${f1(cx + s * 0.1)} ${f1(y - up * ch - 0.4)} ${pt([O[0] + s * 0.1, O[1] - up * 0.75])}`
    // the lower lid: a short line under the outer half
    lid += `M${pt([O[0] - s * 0.4, O[1] + 0.45])}Q${f1(cx + s * 0.6)} ${f1(y + dn * 1.25 + 0.15)} ${pt([cx - s * ew * 0.35, y + dn * 1.1 + 0.2])}`
    // the socket under the brow ridge (a half tone down to the crease, its inner corner by the bridge in shadow)
    const rd = G.rid, sy = y - up * ch - 0.3
    S.md += crv([[50 + s * 2, G.by + 1.4], [50 + s * (G.es - 0.6), G.by + 1.3], [50 + s * (G.es + ew + 0.6), G.by + 1.9], [O[0] + s * 0.9, O[1] - 0.2],
      [O[0] + s * 0.3, O[1] + 1.2], [cx + s * ew * 0.4, sy + 0.5 - (1 - rd) * 1.1], [cx - s * ew * 0.3, sy + 0.2 - (1 - rd) * 1.1], [I[0] - s * 0.2, I[1] - 0.6], [50 + s * 1.6, y + 1.2 * rd]])
    S.sh += crv([[50 + s * 1.9, G.by + 2.5], [I[0] - s * 0.1, I[1] - 1.3], [I[0] - s * 0.3, I[1] + 0.3], [50 + s * 1.5, y + 0.4]])
    // under the eye: the lid's lower edge turning into the cheek; with the years, a bag
    S.md += `M${pt([I[0] + s * 0.4, I[1] + 0.9])}Q${f1(cx)} ${f1(y + dn * 1.25 + 1.5)} ${pt([O[0] + s * 0.2, O[1] + 0.9])}Q${f1(cx)} ${f1(y + dn * 1.25 + 0.7)} ${pt([I[0] + s * 0.4, I[1] + 0.9])}Z`
    if (!lo && (look.ag ?? 24) >= 28) S.sh += `M${pt([I[0] + s * 0.6, I[1] + 1.3])}Q${f1(cx)} ${f1(y + dn * 1.3 + 2)} ${pt([O[0] - s * 0.2, O[1] + 1.2])}Q${f1(cx)} ${f1(y + dn * 1.3 + 1.3)} ${pt([I[0] + s * 0.6, I[1] + 1.3])}Z`
  }
  // (the eyes' shape is drawn once, in the defs: filled here and the clip for what's inside them)
  const clip = `<path id="${P}e" d="${wh}"/>`
  const eyes = `<use href="#${P}e" fill="${T.white}"/>`
    + `<g clip-path="url(#${P}E)">${fill(ir, iris, lo ? '' : ` stroke="${ring}" stroke-width=".25"`)}${fill(pu, '#080505')}${fill(band, '#2a1a14', ' fill-opacity=".42"')}${lo ? '' : fill(cl, '#ffffff', ' fill-opacity=".85"')}</g>`
    + fill(lash, mixC(INK, T.base, 0.12))
    + (fold ? fill(fold, T.md) : '')
    + (lo ? '' : stroke(crease, T.line, 0.3) + stroke(lid, T.sh, 0.3))
  return { clip, eyes }
}
function browsOf(look, G, T) {
  // (the brow's hair over the skin: a touch of the skin in it, so a black brow on dark skin isn't a cut-out)
  const c = mixC(mixC(look.brow ?? look.hc, INK, 0.15), T.base, 0.12)
  const t = { thick: 1.35, thin: 0.72, bushy: 1.55, straight: 1.02, arched: 0.95, angled: 1.08 }[look.brows] ?? 1.02
  const arch = { arched: 1.2, angled: 0.9, straight: 0.3, thick: 0.4, thin: 0.65, bushy: 0.38 }[look.brows] ?? 0.42
  let d = ''
  for (const s of [-1, 1]) {
    const y = G.by, x0 = 50 + s * 2.4, x1 = 50 + s * (G.es + 3.15 * G.ez + 1.3), at = u => x0 + (x1 - x0) * u
    const yi = y + (look.brows === 'angled' ? 1.2 : 0.75)
    // the inner end soft and squared, the tail tapering to a point
    d += crv([[x0, yi + t * 0.35], [at(0.35), y + 0.5 - arch * 0.4], [at(0.68), y + 0.1 - arch * 0.82], [x1, y + 1.05],
      [x1 - s * 0.9, y + 0.15], [at(0.64), y - arch - t * 0.7], [at(0.3), y - t * 0.8 - arch * 0.35], [x0 + s * 0.1, yi - t * 0.55]])
  }
  return fill(d, c)
}
function noseOf(look, G, T, S, lo) {
  const y = G.ny - (look.nose === 'short' ? 0.8 : 0), w = G.nwid, br = G.br
  // a high bridge starts its plane right under the brow; a low one only lower down
  const ys = G.by + 1.8 + (1 - br) * 5, xs = 50.9 + (1 - br) * 0.3, mid = (ys + y) / 2, pw = 0.8 + (1 - br) * 0.7
  // the side of the nose away from the light, from the bridge down round the wing (a half tone, the shadow by the wing)
  S.md += crv([[xs - 0.2, ys], [xs + pw, mid], [50 + w * 0.95, y - 2.6], [50 + w + 0.3, y - 0.6], [50 + w * 0.5, y - 0.9], [51.2, y - 2.2], [xs + 0.1, mid + 1]])
  S.sh += crv([[50 + w * 0.55, y - 2.4], [50 + w + 0.35, y - 0.9], [50 + w * 0.8, y + 0.5], [50 + w * 0.45, y - 0.6]])
  // the wing on the lit side, the nose's shadow thrown down on the lip
  if (!lo) S.md += crv([[50 - w - 0.2, y - 2], [50 - w + 0.7, y - 2.6], [50 - w + 1.2, y - 0.6], [50 - w + 0.3, y + 0.6]])
  S.sh += crv([[50.3, y + 1.2], [50 + w * 0.8, y + 0.9], [50 + w * 0.5, y + 2.5], [50.9, y + 2.9]])
  // the underside: between the nostrils in deep shadow, the nostrils (a broad nose shows more of them)
  const nr = 0.5 + w * 0.11
  S.dk += `M${f1(50 - w * 0.72)} ${f1(y + 0.1)}C${f1(50 - w * 0.3)} ${f1(y + 1.15)} ${f1(50 + w * 0.3)} ${f1(y + 1.15)} ${f1(50 + w * 0.72)} ${f1(y + 0.1)}C${f1(50 + w * 0.3)} ${f1(y + 0.6)} ${f1(50 - w * 0.3)} ${f1(y + 0.6)} ${f1(50 - w * 0.72)} ${f1(y + 0.1)}Z`
  for (const s of [-1, 1]) S.dk += ell(50 + s * w * 0.44, y + 0.3, nr, 0.45)
  // the light down the bridge and on the ball of the tip
  S.hl += crv([[49.5, ys + 1.2], [49.9, mid + 0.4], [49.75, y - 3], [49.05, mid + 0.6]]) + ell(49.3, y - 1.6, 0.8 + w * 0.05, 0.55)
  if (look.nose === 'boxer') S.sh += crv([[50.2, ys + 2.4], [51.3, ys + 3.6], [50.6, ys + 4.4]])
  // the ink: round each wing into its nostril (the lit side's lighter), the far edge of a high bridge
  let ink = '', inkL = ''
  for (const s of [-1, 1]) {
    const d = `M${f1(50 + s * (w - 1))} ${f1(y - 2.5)}C${f1(50 + s * (w + 0.45))} ${f1(y - 2)} ${f1(50 + s * (w + 0.55))} ${f1(y + 0.4)} ${f1(50 + s * (w - 0.4))} ${f1(y + 0.75)}Q${f1(50 + s * w * 0.6)} ${f1(y + 0.95)} ${f1(50 + s * w * 0.3)} ${f1(y + 0.5)}`
    if (s > 0) ink += d; else inkL += d
  }
  if (!lo && br > 0.6) ink += `M${f1(xs + 0.4)} ${f1(ys + 2.6)}Q${f1(xs + pw)} ${f1(mid + 1)} ${f1(50 + w * 0.6)} ${f1(y - 3)}`
  return stroke(ink, T.line, lo ? 0.5 : 0.36) + stroke(inkL, T.dk, lo ? 0.45 : 0.32)
}
function mouthOf(look, G, T, S, lo) {
  const y = G.my, w = G.mwid, k = G.lipk
  const up = ({ full: 1.6, thin: 0.75, wide: 1.15, stern: 0.95, smirk: 1.15 }[look.mouth] ?? 1.2) * k
  const dn = ({ full: 2.1, thin: 1.1, wide: 1.55, stern: 1.3, smirk: 1.55 }[look.mouth] ?? 1.6) * k
  const rise = look.mouth === 'smirk' ? 0.8 : 0, drop = look.mouth === 'stern' ? 0.4 : 0
  // (a relaxed mouth: the corners a touch up, the way most headshots are taken)
  const lift = look.mouth === 'stern' ? 0 : 0.25
  const L = [50 - w, y + drop - lift], R = [50 + w, y - rise + drop - lift]
  // the philtrum's far side, the shadow under the lower lip, the chin's ball of light
  if (!lo) S.md += crv([[50.6, G.ny + 2.6], [51.4, G.ny + 2.9], [51.2, y - up - 0.2], [50.6, y - up - 0.3]])
  const ly = y + dn * 1.15
  S.sh += `M${f1(50 - w * 0.65)} ${f1(ly + 0.4)}Q50 ${f1(ly + 2.2)} ${f1(50 + w * 0.7)} ${f1(ly + 0.3)}Q50 ${f1(ly + 1)} ${f1(50 - w * 0.65)} ${f1(ly + 0.4)}Z`
  // the folds out from the corners of the mouth (the muscles round it), the half tone on the far side of the chin
  S.md += `M${f1(50 + w + 0.4)} ${f1(y - 1.4)}Q${f1(50 + w + 1.6)} ${f1(y + 0.4)} ${f1(50 + w + 0.6)} ${f1(y + 2.2)}Q${f1(50 + w + 0.9)} ${f1(y + 0.4)} ${f1(50 + w + 0.4)} ${f1(y - 1.4)}Z`
  let s = ''
  // the upper lip (turned down, in shade), the lower (turned up to the light, its highlight), the line between
  s += fill(`M${pt(L)}C${f1(50 - w * 0.62)} ${f1(y - up * 0.5)} ${f1(50 - w * 0.32)} ${f1(y - up * 1.05)} 48.9 ${f1(y - up)}Q50 ${f1(y - up * 0.7)} 51.1 ${f1(y - up)}C${f1(50 + w * 0.32)} ${f1(y - up * 1.05)} ${f1(50 + w * 0.62)} ${f1(y - up * 0.5 - rise)} ${pt(R)}Q50 ${f1(y + 0.4)} ${pt(L)}Z`, T.lipU)
  s += fill(`M${f1(L[0] + 0.6)} ${f1(L[1] + 0.2)}C${f1(50 - w * 0.55)} ${f1(y + dn * 1.15)} ${f1(50 + w * 0.55)} ${f1(y + dn * 1.15 - rise * 0.3)} ${f1(R[0] - 0.6)} ${f1(R[1] + 0.2)}Q50 ${f1(y + 0.5)} ${f1(L[0] + 0.6)} ${f1(L[1] + 0.2)}Z`, T.lipL)
  if (!lo) s += fill(crv([[47.6, y + dn * 0.55], [49.4, y + dn * 0.34], [50.8, y + dn * 0.5], [49.2, y + dn * 0.76]]), mixC(T.lipL, '#ffffff', T.d > 0.5 ? 0.12 : 0.18))
  s += stroke(`M${pt(L)}Q${f1(50 - w * 0.5)} ${f1(y + 0.45)} 50 ${f1(y + 0.3)}Q${f1(50 + w * 0.5)} ${f1(y + 0.45 - rise * 0.6)} ${pt(R)}`, mixC(INK, T.lipU, 0.25), 0.42)
  if (!lo) s += stroke(`M${f1(L[0] - 0.4)} ${f1(L[1] - 0.5)}q.3 .4 .25 1.1M${f1(R[0] + 0.4)} ${f1(R[1] - 0.5)}q-.3 .4 -.25 1.1`, T.sh, 0.32)
  return s
}
// the years: lines from the nose to the mouth, across the forehead, out from the eyes, a heavier jaw
function linesOf(look, G, T, S, lo) {
  const ag = look.ag ?? 24, y = G.ny, my = G.my
  // (every man has a faint fold from the nose's wing toward the mouth; it deepens with the years)
  for (const s of [-1, 1]) {
    const k = clamp((ag - 24) / 26, 0, 1)
    S[ag >= 30 ? 'sh' : 'md'] += crv([[50 + s * (G.nwid + 0.7), y - 1.4], [50 + s * (G.nwid + 2.4), y + 1.2], [50 + s * (G.mwid + 1.4), my + 0.6], [50 + s * (G.mwid + 1), my + 0.1], [50 + s * (G.nwid + 1.5 - k * 0.6), y + 1]])
    if (ag >= 45) S.sh += crv([[50 + s * (G.jw - 2.6), G.jy - 2], [50 + s * (G.jw - 0.4), G.jy + 1], [50 + s * (G.ch + 2), G.cy - 1.6], [50 + s * (G.jw - 2.4), G.jy + 0.6]])
  }
  if (lo || ag < 27) return ''
  const k = clamp((ag - 24) / 26, 0, 1)
  let d = ''
  if (ag >= 42 && !look.cap) d += `M43 31Q50 29.8 57 31${ag >= 48 ? 'M44.4 33.6Q50 32.6 55.6 33.6' : ''}${ag >= 56 ? 'M45.6 28.6Q50 27.6 54.4 28.6' : ''}`
  if (ag >= 45) for (const s of [-1, 1]) { const x = 50 + s * (G.es + 3.7); d += `M${f1(x)} ${f1(G.ey - 0.8)}l${f1(s * 1.4)} -.7M${f1(x + s * 0.2)} ${f1(G.ey + 0.7)}l${f1(s * 1.4)} .5` }
  return stroke(d, T.sh, 0.38 + k * 0.14)
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
  const cel = (d, { hi = '', tex = '', c = H, w = 0.55, dy = 1.5 } = {}) => `<defs><path id="${P}m" d="${d}"/><clipPath id="${P}H"><use href="#${P}m"/></clipPath></defs><use href="#${P}m" fill="${c.hD}"/>`
    + `<g clip-path="url(#${P}H)"><use href="#${P}m" fill="${c.hc}" transform="translate(-.8 -${dy})"/>`
    + fill(`M${f1(50 + cw * 0.22)} -2C${f1(50 + cw * 0.55)} 10 ${f1(R)} 18 ${f1(R - 1.4)} 30L${f1(R - 3)} 92H104V-2Z`, c.hD)
    + hi + (lo ? '' : tex) + `</g><use href="#${P}m" fill="none" stroke="${c.hI}" stroke-width="${w}"/>`
  // a piece of hair outside the mass: flat, inked
  const flat = (d, c = hc, w = 0.5) => fill(d, c, ` stroke="${hI}" stroke-width="${w}"`)
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
  const ropes = (d, w, dash) => stroke(d, hI, w + 0.55) + stroke(d, hc, w) + (lo ? '' : stroke(d, hL, w * 0.4, ` stroke-dasharray="${dash}"`))
  // the coil light, up on the lit side of a coily cut
  const coilHi = (y0, y1, n = 9) => coils(L + 2.4, 50 + cw * 0.25, y0, y1, n, hL, 0.5)
  switch (hair) {
    case 'shaved':
      front.push(fill(capD(G, { t: -5, line: 27.8, side: 44, tc: 0 }), mixC(T.base, hc, T.d > 0.6 ? 0.07 : 0.1)))   // (a shaved scalp: the skin, a shadow of stubble on it)
      break
    case 'buzz': {
      // (a buzz is hair close to the scalp: the hair's own colour with a little skin through it, a soft sheen, no hard edge)
      const c = { hc: mixC(hc, T.base, 0.2), hD: mixC(hc, T.base, 0.08), hL: mixC(mixC(hc, T.base, 0.2), '#a3acbd', 0.16), hI: mixC(hc, T.base, 0.1) }
      front.push(cel(capD(G, { t: 0.4, line: 27.6, side: 43, tc: 0.3 }), { c: { ...c, hI: mixC(c.hD, INK, 0.4) }, hi: band(0.4, c.hL), w: 0.4, dy: 1 }))
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
      front.push(fadeSides({ side: 44 }), cel(capD(G, { t: 1.6, line: 28.4, side: 32, tc: 0.8 }), { hi: band(1.6) }), fill(c, hc, ` stroke="${hI}" stroke-width=".45"`), lo ? '' : stroke(h, hL, 0.5))
      break
    }
    case 'afro': {
      // a round mass, its edge in bumps, behind the head; the front of it over the forehead
      const rx = cw + 7.2, ry = cw + 3.6, cx = 50, cy = 25, n = 18, a0 = 0.9, a1 = 2.1
      const at = a => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], r = (Math.PI * (rx + ry) * 0.5 * (a1 - a0)) / n * 0.62
      let d = `M${pt(at(Math.PI * a0))}`
      for (let i = 1; i <= n; i++) d += `A${f1(r)} ${f1(r)} 0 0 1 ${pt(at(Math.PI * (a0 + ((a1 - a0) * i) / n)))}`
      d += `C${f1(R + 5)} 42 ${f1(R + 2)} 44 ${f1(R)} 44L${f1(L)} 44C${f1(L - 2)} 44 ${f1(L - 5)} 42 ${pt(at(Math.PI * a0))}Z`
      back.push(cel(d, { hi: coils(cx - rx + 3, 50, cy - ry + 1, cy - 4, 16, hL, 0.55), tex: coils(52, cx + rx - 4, cy - ry + 4, 36, 14, hD, 0.5), w: 0.6, dy: 2 }))
      front.push(fill(capD(G, { t: 1, line: 28, side: 40, tc: 1 }), hc), lo ? '' : coils(L + 3, 50, TOP + 2, 27, 8, hL, 0.5), stroke(`M${f1(L + 1.6)} 33Q${f1(L + 3)} 28.6 ${f1(L + 6)} 28Q50 26.6 ${f1(R - 6)} 28Q${f1(R - 3)} 28.6 ${f1(R - 1.6)} 33`, hI, 0.45))
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
      const to = hair === 'long' ? 79 : hair === 'flow' ? 57 : 72
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
// Hair on the face, not a shape stuck on it: every edge where it thins onto the skin is broken into short tufts, a
// light layer runs past the main one so the cheek line fades instead of stopping, the density varies (skin shows
// through stubble and through a short beard's edges), and it takes its own light and shadow (a cool sheen on the lit
// side, the far side and the underside dark), so a black beard reads as hair on the deepest skin.
const bell = (u, h = 0.3) => Math.max(0, 1 - ((u - 0.5) / h) ** 2)
// a line made denser: each straight stretch cut in m
function dense(p, m) {
  const out = [p[0]]
  for (let i = 1; i < p.length; i++) for (let j = 1; j <= m; j++) out.push([p[i - 1][0] + (p[i][0] - p[i - 1][0]) * j / m, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * j / m])
  return out
}
// a broken edge of hair: between each two points a tuft pushed amp along the line's normal (its right hand: on the
// head's clockwise outline, outward), the lengths varying; sk skews each tuft along the line
function tufts(p, amp, sk = 0.15) {
  const out = [p[0]]
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
    const k = amp * (0.5 + ((i * 7) % 5) / 7)
    out.push([(a[0] + b[0]) / 2 + (dy / l) * k + dx * sk, (a[1] + b[1]) / 2 - (dx / l) * k + dy * sk], b)
  }
  return out
}
function beardTones(hc, T) {
  const dark = lum(hc) < 70
  // (a black beard: lifted toward a cool grey so it is hair on any skin, its sheen a cool light)
  const base = dark ? mixC(hc, '#3c3b42', 0.26 + T.d * 0.14) : hc
  return {
    dark, base, dk: dark ? '#0a0707' : mixC(hc, '#1a0c06', 0.4), lt: dark ? mixC(base, '#a6afc0', 0.36 + T.d * 0.1) : mixC(hc, '#fff4e0', 0.4),
    stub: dark ? mixC('#1d1a1e', T.base, 0.1) : mixC(hc, '#3a3f4c', 0.35),
  }
}
// the cheek line, left sideburn to right: down the cheek to the corner of the mouth, under the lower lip (gap: how far
// under it), up the other side. cl 0 a high, full cheek line … 1 a low one
function cheekLine(G, cl, gap = 2.2) {
  const { tw, cb, mwid, my } = G
  const L = [[50 - tw + 1.1, 38.6], [50 - cb + 2.3 + cl * 1.9, 44.6 + cl * 3.4], [50 - mwid - 3.1 + cl * 0.6, my - 4.2 + cl * 1.8], [50 - mwid - 1.15, my - 0.5],
    [50 - mwid * 0.62, my + gap - 0.2], [50, my + gap + 0.3]]
  return [...L, ...L.slice(0, -1).reverse().map(mr)]
}
// a beard's ground: its outer edge on the head's own edge (len more below the chin, out more past the face), its
// inner edge the cheek line; both broken into tufts (amp: how ragged)
function beardD(G, { len = 0, out = 0.3, cl = 0.5, gap = 2.2, amp = 0.55, ampO = 0.5, lo = false }) {
  const k = lo ? 1 : 2
  const o = along(G, 5, 21, k, u => out + len * bell(u, 0.34))
  const inn = dense(cheekLine(G, cl, gap), lo ? 1 : 2)
  return poly([...tufts(o, ampO), ...tufts(inn, amp)], true)
}
function beardOf(look, G, T, P, lo) {
  const B = beardTones(look.bc ?? look.brow ?? look.hc, T), { cy, jw, jy, my, mwid } = G
  const op = (c, a) => ` fill-opacity="${a}"`
  // the grain: short strokes down and out along the jaw, light on the lit side, dark on the far side
  const grain = len => {
    let l = '', d = ''
    for (let i = 0; i < 15; i++) {
      const a = -0.92 + i * 0.131, x = 50 + a * (jw - 1.8), yy = jy - 1 + (cy - jy) * (1 - a * a) + len * 0.45 * (1 - a * a) - 1.4
      const s = `M${f1(x)} ${f1(yy - 1.6)}l${f1(a * 0.7)} ${f1(1.6 + len * 0.18)}`
      if (a < 0.1) l += s; else d += s
    }
    return stroke(l, B.lt, 0.34, ' stroke-opacity=".8"') + stroke(d, B.dk, 0.32, ' stroke-opacity=".55"')
  }
  // a beard: its fading edge, its body, then (clipped to it) the far side and the underside in shadow, the lit side's
  // sheen, the grain
  const body = (o, dens) => {
    const d = beardD(G, { ...o, lo })
    if (lo) return fill(beardD(G, { ...o, cl: o.cl - 0.3, amp: 0.9, lo }), B.base, op(0, 0.35)) + fill(d, B.base, op(0, dens))
    return fill(beardD(G, { ...o, cl: o.cl - 0.2, gap: (o.gap ?? 2.2) - 0.4, amp: 0.9, ampO: 0.3 }), B.base, op(0, B.dark ? 0.3 : 0.26))
      + `<defs><path id="${P}B" d="${d}"/><clipPath id="${P}Q"><use href="#${P}B"/></clipPath></defs><use href="#${P}B" fill="${B.base}" fill-opacity="${dens}"/>`
      + `<g clip-path="url(#${P}Q)">${fill(`M${f1(50 + jw * 0.3)} 40C${f1(50 + jw * 0.55)} 52 ${f1(50 + jw * 0.4)} ${f1(cy)} 51 ${f1(cy + 12)}H104V40Z`, B.dk, op(0, 0.3))}`
      + fill(`M${f1(50 - jw - 3)} ${f1(jy - 6)}C${f1(50 - jw + 3)} ${f1(jy + 4)} ${f1(50 - G.ch)} ${f1(cy + 2)} 50 ${f1(cy + 2)}V40H${f1(50 - jw - 3)}Z`, B.lt, op(0, B.dark ? 0.14 : 0.12))
      + fill(`M30 ${f1(cy + 0.4 + (o.len ?? 0) * 0.55)}Q50 ${f1(cy - 1.6 + (o.len ?? 0) * 0.55)} 70 ${f1(cy + 0.4 + (o.len ?? 0) * 0.55)}V100H30Z`, B.dk, op(0, 0.3))
      + grain(o.len ?? 0) + `</g>`
  }
  switch (look.beard) {
    case 'stubble': {
      // a shadow of hair, not a shape: a light even layer, a little denser along the jaw and the chin
      const d = beardD(G, { out: 0, cl: 0.55, gap: 2.4, amp: 0.4, ampO: 0.15, lo })
      const lip = `M${f1(50 - mwid - 0.6)} ${f1(my - 0.7)}C${f1(50 - mwid + 0.3)} ${f1(G.ny + 2.6)} 47 ${f1(G.ny + 2.1)} 50 ${f1(G.ny + 2.3)}C53 ${f1(G.ny + 2.1)} ${f1(50 + mwid - 0.3)} ${f1(G.ny + 2.6)} ${f1(50 + mwid + 0.6)} ${f1(my - 0.7)}Q50 ${f1(my - 1.5)} ${f1(50 - mwid - 0.6)} ${f1(my - 0.7)}Z`
      const a = T.d > 0.6 ? 0.34 : 0.24
      return fill(d + lip, B.stub, op(0, a)) + (lo ? '' : fill(beardD(G, { out: 0, cl: 1.1, gap: 3, amp: 0.5, ampO: 0.1 }), B.stub, op(0, a * 0.6)))
    }
    case 'short': return body({ len: 0.4, out: 0.25, cl: 0.7, amp: 0.55, ampO: 0.3 }, 0.78)
    case 'full': return body({ len: 2.4, out: 0.6, cl: 0.42, amp: 0.65, ampO: 0.6 }, 0.86)
    case 'long': return body({ len: 6.5, out: 0.9, cl: 0.32, amp: 0.7, ampO: 0.8 }, 0.88)
    case 'chin': {
      // a strap: a band along the jaw line, sideburn to sideburn, its inner edge broken
      const o = along(G, 5, 21, lo ? 1 : 2, () => 0.25), i = along(G, 5, 21, lo ? 1 : 2, u => -(1.7 + 1.3 * bell(u, 0.2))).reverse()
      return fill(poly([...tufts(o, 0.25), ...tufts(i, 0.45)], true), B.base, op(0, 0.88)) + (lo ? '' : grain(0))
    }
    case 'goatee': {
      // round the mouth to the chin: the moustache joins it at the corners; under the lower lip a little skin shows
      const w = mwid + 0.9, ly = my + 1.9 * G.lipk
      const p = dense([[50 + w - 0.1, my - 0.4], [50 + w + 0.3, my + 2.4], [50 + G.ch + 0.4, cy - 1.6], [50 + G.ch * 0.4, cy + 0.9], [50, cy + 1.2],
        [50 - G.ch * 0.4, cy + 0.9], [50 - G.ch - 0.4, cy - 1.6], [50 - w - 0.3, my + 2.4], [50 - w + 0.1, my - 0.4]], lo ? 1 : 2)
      const inn = dense([[50 - w + 0.8, my + 0.2], [50 - mwid * 0.55, ly + 0.5], [50, ly + 1], [50 + mwid * 0.55, ly + 0.5], [50 + w - 0.8, my + 0.2]], lo ? 1 : 2)
      const d = poly([...tufts(p, 0.45), ...tufts(inn, 0.4)], true)
      return fill(d, B.base, op(0, 0.88)) + (lo ? '' : fill(`M47.6 ${f1(cy - 1)}Q50 ${f1(cy + 0.4)} 52.4 ${f1(cy - 1)}L52 ${f1(cy + 0.8)}Q50 ${f1(cy + 1.4)} 48 ${f1(cy + 0.8)}Z`, B.dk, op(0, 0.4))
        + stroke(`M47.4 ${f1(cy - 2.4)}l-.2 1.6M48.8 ${f1(cy - 2)}l-.1 1.6M50.4 ${f1(cy - 2)}l.1 1.6`, B.lt, 0.3, ' stroke-opacity=".75"'))
    }
    case 'patch': {
      const ly = my + 2 * G.lipk + 0.4
      return fill(poly(tufts(dense([[48.7, ly], [50, ly - 0.3], [51.3, ly], [50.8, ly + 2.4], [50, ly + 3.2], [49.2, ly + 2.4], [48.7, ly]], 1), 0.3), true), B.base, op(0, 0.85))
    }
    default: return ''
  }
}
// the moustache: from under the nose down over the upper lip, its lower edge broken where it meets the lip; with a
// beard its ends run down into the beard at the corners of the mouth
function stacheOf(look, G, T) {
  if (!look.stache || look.stache === 'none') return ''
  const B = beardTones(look.bc ?? look.brow ?? look.hc, T), y = G.my - 1.05 * G.lipk - 0.35, w = G.mwid, ny = G.ny
  const joined = ['short', 'full', 'long', 'goatee'].includes(look.beard)
  const top = look.stache === 'thin' ? y - 0.5 : Math.max(ny + 1.9, y - 2.1)
  const end = joined ? G.my + 1.2 : look.stache === 'horseshoe' ? G.my + 6.2 : y + 1.7
  const ow = w + (look.stache === 'thin' ? 0.1 : 0.9)
  // the upper edge (left corner up under the nose, a dip at the philtrum, down to the right corner)
  const up = dense([[50 - ow, end], [50 - ow + 0.1, y + 0.6], [50 - w * 0.62, top + 0.5], [50 - 1.4, top], [50, top + 0.35], [50 + 1.4, top], [50 + w * 0.62, top + 0.5], [50 + ow - 0.1, y + 0.6], [50 + ow, end]], 1)
  // the lower edge, back over the lip (tufts down onto it)
  const lowY = look.stache === 'thin' ? y + 0.5 : y + 1.05
  const dn = dense([[50 + ow - 1, end], [50 + w - 0.2, lowY + 0.6], [50 + w * 0.5, lowY], [50, lowY + 0.1], [50 - w * 0.5, lowY], [50 - w + 0.2, lowY + 0.6], [50 - ow + 1, end]], 2)
  const d = poly([...up, ...tufts(dn, look.stache === 'thin' ? 0.25 : 0.5)], true)
  return fill(d, B.base, ` fill-opacity="${look.stache === 'thin' ? 0.8 : 0.92}"`)
    + fill(`M50 ${f1(top + 0.4)}L${f1(50 + w * 0.62)} ${f1(top + 0.6)}L${f1(50 + ow)} ${f1(y + 0.8)}L${f1(50 + w * 0.4)} ${f1(lowY + 0.3)}Z`, B.dk, ' fill-opacity=".35"')
    + stroke(`M${f1(50 - w * 0.7)} ${f1(top + 0.9)}l-.5 1.2M${f1(50 - w * 0.4)} ${f1(top + 0.5)}l-.3 1.3M48.4 ${f1(top + 0.4)}l-.2 1.2`, B.lt, 0.28, ' stroke-opacity=".7"')
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
    case 'visor': return visorOf(G, color, null)
    default: return ''
  }
}
// a team's mark on a cap or a visor: one clean letter (mark.t, the team's initial) in its contrasting colour (mark.c),
// or without one a plain star; never a traced logo
const markOf = (mark, x, y, size, color) => {
  const c = mark?.c ?? (lum(color) > 170 ? '#14161b' : '#ffffff')
  if (mark?.t && /^[A-Z]$/.test(mark.t)) return `<text x="${f1(x)}" y="${f1(y + size * 0.36)}" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="${f1(size)}" fill="${c}">${mark.t}</text>`
  const r = size * 0.48
  let d = ''
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? r * 0.42 : r; d += `${k ? 'L' : 'M'}${f1(x + Math.cos(a) * q)} ${f1(y + Math.sin(a) * q)}` }
  return fill(d + 'Z', c)
}
// a sideline visor: a stiff band round the head in the team's colour, the mark on its front, a wide flat brim out over
// the brow (its underside dark), his hair showing over the top
function visorOf(G, color, mark) {
  const { cw } = G, L = 50 - cw - 0.6, R = 50 + cw + 0.6
  const ink = ` stroke="${INK}" stroke-width=".55"`
  const band = `M${f1(L)} 32.4C${f1(L + 0.4)} 27.4 ${f1(R - 0.4)} 27.4 ${f1(R)} 32.4L${f1(R - 0.3)} 34.6C${f1(R - 3)} 31.2 ${f1(L + 3)} 31.2 ${f1(L + 0.3)} 34.6Z`
  const brim = `M${f1(L - 1.4)} 33.4C${f1(L + 5)} 30.4 ${f1(R - 5)} 30.4 ${f1(R + 1.4)} 33.4C${f1(R + 0.4)} 37.6 ${f1(R - 6)} 41.2 50 41.2C${f1(L + 6)} 41.2 ${f1(L - 0.4)} 37.6 ${f1(L - 1.4)} 33.4Z`
  return fill(`M${f1(L + 1.4)} 38C${f1(L + 6)} 42.6 ${f1(R - 6)} 42.6 ${f1(R - 1.4)} 38L${f1(R - 2)} 42.4C${f1(R - 7)} 44.6 ${f1(L + 7)} 44.6 ${f1(L + 2)} 42.4Z`, '#000000', ' fill-opacity=".26"')
    + fill(band, color, ink) + fill(`M${f1(50 + cw * 0.35)} 28.6C${f1(R - 2)} 29 ${f1(R)} 30.6 ${f1(R)} 32.4L${f1(R - 0.3)} 34.6C${f1(R - 1.6)} 33 ${f1(R - 4)} 31.8 ${f1(50 + cw * 0.35)} 31.2Z`, shade(color, 0.25))
    + markOf(mark, 50, 30.4, 3.2, color)
    + fill(brim, shade(color, 0.08), ink) + fill(`M${f1(L)} 35.6C${f1(L + 6)} 39.2 ${f1(R - 6)} 39.2 ${f1(R)} 35.6C${f1(R - 1.6)} 39.4 ${f1(R - 7)} 41 50 41C${f1(L + 7)} 41 ${f1(L + 1.6)} 39.4 ${f1(L)} 35.6Z`, shade(color, 0.5))
    + stroke(`M${f1(L + 3)} 33.4C${f1(L + 7)} 31.8 ${f1(R - 7)} 31.8 ${f1(R - 3)} 33.4`, lite(color, 0.28), 0.4)
}
function earringsOf(look, G) {
  if (!look.ear || look.ear === 'none') return ''
  const one = s => { const x = 50 + s * (G.tw + 0.6), y = 51.6; return ell(x, y, 0.95, 0.95) }
  return fill(look.ear === 'stud' ? one(-1) : one(-1) + one(1), '#e8eef8', ` stroke="${INK}" stroke-width=".35"`)
}
function chainOf(look, G) {
  if (!look.chain || look.chain === 'none') return ''
  const c = look.chain === 'gold' ? ['#8a6418', '#e8c25a'] : ['#6d727c', '#e2e6ee']
  const d = `M${f1(50 - G.nw - 0.4)} 69.4Q${f1(50 - G.nw * 0.45)} 81.4 50 82.2Q${f1(50 + G.nw * 0.45)} 81.4 ${f1(50 + G.nw + 0.4)} 69.4`
  return stroke(d, c[0], 1.1) + stroke(d, c[1], 0.65, ' stroke-dasharray=".8 .5"')
}

// ── A coach's pieces ─────────────────────────────────────────────────────────
// the top: a polo in the team's colour (its collar open at the neck, the placket's buttons) or a quarter-zip (dark,
// the stand-up collar in the team's colour, the zip)
function topOf(look, G, color, P, lo) {
  const { nw } = G
  const polo = look.top === 'polo'
  const top = polo ? mixC(color, '#0b0c10', 0.12) : '#2a2e37'
  let s = clothOf(shirtD(G, 77, [[50 + nw * 0.55, 77], [50 + nw, 73], [50 + nw + 0.4, 69]]), top, P, lo, G)
  if (polo) {
    const fl = lite(color, 0.1), ink = ` stroke="${INK}" stroke-width=".5"`
    // the collar's two points lying open at the throat, the placket and its button
    s += fill(`M${f1(50 - nw - 0.4)} 68.4L${f1(50 - nw - 4.4)} 72.4L${f1(50 - 3.4)} 79.4L50 76.8Z`, fl, ink) + fill(`M${f1(50 + nw + 0.4)} 68.4L${f1(50 + nw + 4.4)} 72.4L${f1(50 + 3.4)} 79.4L50 76.8Z`, shade(fl, 0.25), ink)
    s += stroke(`M48.6 77.8V92M51.4 77.8V92`, shade(color, 0.45), 0.45) + fill(ell(50, 82.6, 0.7, 0.7), '#f2f3f5')
  } else {
    s += fill(`M${f1(50 - nw - 1.2)} 66.8Q50 73 ${f1(50 + nw + 1.2)} 66.8L${f1(50 + nw + 2.4)} 73Q50 80.8 ${f1(50 - nw - 2.4)} 73Z`, color, ` stroke="${INK}" stroke-width=".55"`)
      + fill(`M50 70.4Q${f1(50 + nw)} 69.4 ${f1(50 + nw + 1.2)} 67L${f1(50 + nw + 2.4)} 73Q${f1(50 + nw)} 76.4 50 77Z`, shade(color, 0.3))
    s += stroke('M50 77V120', '#0d0e12', 1.1) + stroke('M50 77V120', '#9aa0aa', 0.4) + `<rect x="49" y="80" width="2" height="3.2" rx=".6" fill="#c9ced6"/>`
  }
  return s
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
// a ball cap or a visor in the team's colour, his hair under it: the cap a structured crown of six panels (the seams
// and the button), the mark on the front panels, a curved brim seen from just above (its top in the team's colour
// darkened, the underside a dark sliver), the brim's shadow over his brow
function capOf(look, G, color, mark) {
  if (!look.cap) return ''
  if (look.cap === 'visor') return visorOf(G, color, mark)
  const { cw } = G, L = 50 - cw - 0.9, R = 50 + cw + 0.9, ink = ` stroke="${INK}" stroke-width=".55"`
  const top = TOP - 4.2
  const crown = `M${f1(L)} 32.2C${f1(L - 0.6)} ${f1(top + 6)} ${f1(50 - cw * 0.62)} ${f1(top)} 50 ${f1(top)}C${f1(50 + cw * 0.62)} ${f1(top)} ${f1(R + 0.6)} ${f1(top + 6)} ${f1(R)} 32.2C${f1(R - 4)} 30.4 ${f1(L + 4)} 30.4 ${f1(L)} 32.2Z`
  const brim = `M${f1(L + 0.2)} 31.8C${f1(L + 5)} 29.8 ${f1(R - 5)} 29.8 ${f1(R - 0.2)} 31.8C${f1(R - 0.6)} 35.6 ${f1(R - 6)} 38.2 50 38.2C${f1(L + 6)} 38.2 ${f1(L + 0.6)} 35.6 ${f1(L + 0.2)} 31.8Z`
  return fill(`M${f1(L + 1.4)} 36C${f1(L + 6)} 40.2 ${f1(R - 6)} 40.2 ${f1(R - 1.4)} 36L${f1(R - 1.8)} 40C${f1(R - 6)} 42 ${f1(L + 6)} 42 ${f1(L + 1.8)} 40Z`, '#000000', ' fill-opacity=".24"')
    + fill(crown, color, ink)
    // the far side of the crown in shade, the near front panel catching the light
    + fill(`M${f1(50 + cw * 0.3)} ${f1(top + 0.2)}C${f1(R - 1)} ${f1(top + 1.6)} ${f1(R + 0.6)} ${f1(top + 6)} ${f1(R)} 32.2C${f1(R - 1.4)} 31.4 ${f1(R - 3)} 31 ${f1(R - 4.4)} 30.8C${f1(R - 3.6)} 24 ${f1(R - 6)} ${f1(top + 3)} ${f1(50 + cw * 0.3)} ${f1(top + 0.2)}Z`, shade(color, 0.26))
    + fill(`M${f1(L + 2)} 29C${f1(L + 2.4)} ${f1(top + 6)} ${f1(50 - cw * 0.5)} ${f1(top + 2)} ${f1(50 - cw * 0.3)} ${f1(top + 1.2)}L${f1(50 - cw * 0.36)} ${f1(top + 3)}C${f1(50 - cw * 0.6)} ${f1(top + 4.4)} ${f1(L + 3.4)} ${f1(top + 8)} ${f1(L + 3.2)} 29Z`, lite(color, 0.14))
    + stroke(`M50 ${f1(top + 0.4)}V30.6M${f1(50 - cw * 0.52)} ${f1(top + 2)}Q${f1(50 - cw * 0.5)} 24 ${f1(50 - cw * 0.56)} 31M${f1(50 + cw * 0.52)} ${f1(top + 2)}Q${f1(50 + cw * 0.5)} 24 ${f1(50 + cw * 0.56)} 31`, shade(color, 0.38), 0.35)
    + fill(ell(50, top + 0.4, 1, 0.6), shade(color, 0.2))
    + markOf(mark, 50, 24.6, 7.4, color)
    + fill(brim, shade(color, 0.3), ink)
    + fill(`M${f1(L + 1.2)} 33.4C${f1(L + 4)} 36.6 ${f1(R - 4)} 36.6 ${f1(R - 1.2)} 33.4C${f1(R - 2)} 36.8 ${f1(R - 7)} 38 50 38C${f1(L + 7)} 38 ${f1(L + 2)} 36.8 ${f1(L + 1.2)} 33.4Z`, shade(color, 0.55))
    + stroke(`M${f1(L + 2.4)} 32C${f1(L + 7)} 30.6 ${f1(R - 7)} 30.6 ${f1(R - 2.4)} 32`, lite(color, 0.25), 0.4)
}

// ── The bust ─────────────────────────────────────────────────────────────────
// the shirt's outline from the bottom of its neckline round the shoulders: a football player's build (the trapezius
// sloping off a thick neck, the shoulders filling the frame's width by about 85% down). vb: how low the neckline
// dips (a V's point, a crew's front), cut: the neckline's own curve from there up to the side of the neck
function shirtD(G, vb, cut) {
  const { nw } = G
  return sym([50, vb], [
    cut,
    [[50 + nw + 3, 69.8], [50 + nw + 9, 71.9], [50 + nw + 15, 74.2]],
    [[50 + nw + 22, 77], [91, 78.6], [97, 82.4]],
    [[102, 85.6], [105, 92], [106, 100]],
    [[106.5, 108], [106, 116], [106, 120]],
    [[90, 120], [70, 120], [50, 120]],
  ])
}
// cloth: its flat colour, the far side in shadow, the near shoulder's light, the seams from the collar to the arms,
// the ink round it
function clothOf(body, c, P, lo, G) {
  const nw = G.nw
  return `<defs><path id="${P}j" d="${body}"/><clipPath id="${P}J"><use href="#${P}j"/></clipPath></defs><use href="#${P}j" fill="${c}"/>`
    + `<g clip-path="url(#${P}J)">${fill('M62 72C72 77 78 88 77 120H110V60H66Z', shade(c, 0.26))}`
    + (lo ? '' : fill(`M-6 94C0 83 13 77.6 ${f1(50 - nw - 12)} 74.6L${f1(50 - nw - 11)} 76.2C14 79 4 85 -4 96Z`, lite(c, 0.12))
      + stroke(`M${f1(50 - nw - 6)} 71.8Q20 82 13 120M${f1(50 + nw + 6)} 71.8Q80 82 87 120`, shade(c, 0.32), 0.45))
    + `</g><use href="#${P}j" fill="none" stroke="${INK}" stroke-width=".6"/>`
}
function jerseyOf(G, color, P, lo, crew = false) {
  const { nw } = G
  const vb = crew ? 75.6 : 82.2
  const cut = crew ? [[50 + nw * 0.6, 75.6], [50 + nw, 72.8], [50 + nw + 0.4, 69]] : [[50 + 2.2, 79.6], [50 + nw - 1, 72.6], [50 + nw + 0.4, 69]]
  const trim = crew ? `M${f1(50 - nw - 0.2)} 68.8C${f1(50 - nw)} 73 ${f1(50 - nw * 0.6)} 75.8 50 75.8C${f1(50 + nw * 0.6)} 75.8 ${f1(50 + nw)} 73 ${f1(50 + nw + 0.2)} 68.8`
    : `M${f1(50 - nw - 0.2)} 68.8C${f1(50 - nw + 1)} 73 ${f1(50 - 3)} 79 50 82.4C${f1(50 + 3)} 79 ${f1(50 + nw - 1)} 73 ${f1(50 + nw + 0.2)} 68.8`
  const accent = lum(color) > 200 ? '#1d2230' : '#f4f5f7'
  const u = (c, w) => `<use href="#${P}v" fill="none" stroke="${c}" stroke-width="${w}"/>`
  return clothOf(shirtD(G, vb, cut), color, P, lo, G) + `<defs><path id="${P}v" d="${trim}"/></defs>` + u(INK, 2.5) + u(accent, 1.9) + u(color, 0.8)
}
// a basketball tank: bare shoulders (the skin's tones, the far one in shadow, the deltoid's line), the tank's scoop
// neck and its arm holes trimmed, the straps over the traps
function tankOf(G, T, color, P, lo) {
  const { nw } = G
  const sh = shirtD(G, 76, [[50 + nw * 0.5, 76], [50 + nw, 72], [50 + nw + 0.4, 69]])
  const ink = ` stroke="${T.ink}" stroke-width=".6"`
  const tank = sym([50, 80.6], [
    [[50 + nw * 0.6, 80.6], [50 + nw + 1.4, 75.4], [50 + nw + 1.8, 70.4]],
    [[50 + nw + 3.6, 70.8], [50 + nw + 5.6, 71.4], [50 + nw + 7.4, 72]],
    [[50 + nw + 7.8, 80], [50 + nw + 10.6, 92], [50 + nw + 19, 100]],
    [[50 + nw + 24, 104], [104, 110], [106, 120]],
    [[90, 120], [70, 120], [50, 120]],
  ])
  const accent = lum(color) > 200 ? '#1d2230' : '#f4f5f7'
  return fill(sh, T.base, ink) + fill(`M${f1(50 + nw + 7)} 72.6C${f1(50 + nw + 16)} 74 ${f1(50 + nw + 26)} 78 104 88L106 120H${f1(50 + nw + 10)}Z`, T.sh)
    + (lo ? '' : stroke(`M${f1(50 - nw - 20)} 77Q${f1(50 - nw - 24)} 88 ${f1(50 - nw - 22)} 100M${f1(50 + nw + 20)} 77Q${f1(50 + nw + 24)} 88 ${f1(50 + nw + 22)} 100`, T.sh, 0.7))
    + clothOf(tank, color, P, lo, G)
    + stroke(`M${f1(50 - nw - 1.6)} 70.6C${f1(50 - nw - 1.2)} 74.6 ${f1(50 - nw * 0.6)} 80.4 50 80.4C${f1(50 + nw * 0.6)} 80.4 ${f1(50 + nw + 1.2)} 74.6 ${f1(50 + nw + 1.6)} 70.6`
      + `M${f1(50 - nw - 7.2)} 72.4C${f1(50 - nw - 7.8)} 80 ${f1(50 - nw - 10.4)} 91 ${f1(50 - nw - 18.4)} 99.4M${f1(50 + nw + 7.2)} 72.4C${f1(50 + nw + 7.8)} 80 ${f1(50 + nw + 10.4)} 91 ${f1(50 + nw + 18.4)} 99.4`, accent, 1.1)
}
export function faceSvg(look, { color = '#d2aa4f', view = 'full', mark = null } = {}) {
  const col = color || '#d2aa4f', lo = view === 'sm'
  const P = `f${hashStr(`${JSON.stringify(look)}|${col}|${view}|${mark?.t ?? ''}`).slice(0, 4)}`
  const G = geo(look), T = tonesOf(look.skin)
  const { cw, tw, cb, jw, jy, cy, ch, nw, es, ey, mwid, my, lean } = G
  const durag = look.gear === 'durag'
  // (a durag covers the hair; long hair that hangs still shows behind it)
  const hp = hairParts(durag ? { ...look, hair: ['locs', 'long', 'flow', 'mullet', 'cornrows'].includes(look.hair) ? look.hair : 'shaved' } : look, G, T, P, lo)
  const hfront = durag || look.cap === 'cap' ? '' : hp.front
  // the head's shading: flat tones, each one path, every shape designed (no soft blends). The light is up to his
  // right (the viewer's left), so the far side turns away in a half tone with a narrower shadow at its edge; the lit
  // side's edge turns away in a thin half tone.
  const S = { lm: '', md: '', sh: '', dk: '', hl: '' }
  // the far side: the temple, round the outer eye, the cheekbone's side, the hollow under it, down the jaw to the chin
  S.md += crv([[50 + cw * 0.55, TOP - 3], [50 + cw - 3.4, TOP + 7], [50 + tw - 3, 34], [50 + es + 3.7, G.by + 1.6], [50 + es + 3.5, ey + 2.4], [50 + cb - 3, 47],
    [50 + cb - 4.4 - lean, 52], [50 + jw - 3.2, jy - 0.4], [50 + ch + 0.6, cy - 2.6], [51.4, cy + 1], [56, cy + 5], [104, cy + 5], [104, TOP - 4]], true, false)
  S.sh += crv([[50 + cw - 1.1, TOP + 9], [50 + tw - 1.2, 37.6], [50 + cb - 1.3, 45.4], [50 + cb - 2.2 - lean * 0.6, 51], [50 + jw - 1.5, jy - 0.2],
    [50 + ch + 0.3, cy - 1.4], [52, cy + 0.8], [60, cy + 5], [104, cy + 4], [104, TOP]])
  // the lit side's own edge turning away
  S.md += crv([[50 - cw - 2, 27], [50 - cw + 1, 31], [50 - tw + 0.9, 38.2], [50 - cb + 0.8, 46], [50 - cb + 1.4 + lean * 0.5, 51], [50 - jw + 1, jy - 0.4],
    [50 - ch - 0.4, cy - 1.2], [49, cy + 1.4], [-4, cy + 4], [-4, 27]])
  // the temples, a little hollow; the hollow under each cheekbone, down toward the mouth (deeper on a lean face)
  for (const s of [-1, 1]) S.md += crv([[50 + s * (tw - 2.4), 31.6], [50 + s * (tw - 0.8), 34], [50 + s * (tw - 1), 38.4], [50 + s * (tw - 2.6), 36]])
  S.lm += crv([[50 - cb + 1.7, 48.6], [50 - cb + 4, 49.6], [50 - mwid - 2.6, my - 3], [50 - cb + 2.4, 52.6]])
  if (lean > 0.15) S.sh += crv([[50 + cb - 2.4, 48.6], [50 + cb - 4.6, 49.8], [50 + mwid + 2.6, my - 2.6], [50 + cb - 3.2, 53]])
  // the underside of the chin
  S.sh += crv([[50 - ch - 1.2, cy - 0.9], [50, cy - 0.3], [50 + ch + 1.2, cy - 0.9], [50 + ch + 2, cy + 3], [50 - ch - 2, cy + 3]])
  // the light: on the forehead, down the brow ridge, on the lit cheekbone, the ball of the chin
  S.hl += crv([[43.6, 23.4], [47.6, 22.2], [49.4, 25.4], [47.4, 29.2], [44, 28]])
  S.hl += crv([[50 - cb + 2.4, 45.8], [50 - cb + 6, 45.6], [50 - cb + 3.4, 47.2]])
  if (!lo) S.hl += crv([[50 - es - 2.6, G.by - 1.6], [50 - 2.4, G.by - 1.2], [50 - es - 2, G.by - 0.9]]) + ell(48.9, cy - 2.6, 1.4, 0.75)
  if (look.cleft) S.sh += crv([[50, cy - 2.8], [50.4, cy - 1.3], [49.8, cy - 1.1]])
  const ey2 = eyesOf(look, G, T, S, P, lo)
  const nose = noseOf(look, G, T, S, lo)
  const mouth = mouthOf(look, G, T, S, lo)
  const lines = linesOf(look, G, T, S, lo)
  // the ears: lit and in shade, the bowl inside, the rim
  let ears = '', rims = ''
  for (const s of [-1, 1]) {
    const ex = 50 + s * (tw - 0.7), X = d => f1(ex + s * d)
    ears += fill(`M${X(0)} 40.8C${X(2)} 38.8 ${X(3.5)} 40.2 ${X(3.4)} 43.6C${X(3.3)} 47.2 ${X(2.4)} 50.6 ${X(0.6)} 52.4L${X(-0.8)} 50.4Z`, s < 0 ? T.base : T.md, ` stroke="${T.ink}" stroke-width=".5"`)
      + fill(`M${X(0.8)} 42.3C${X(2.2)} 41.4 ${X(2.7)} 43 ${X(2.4)} 45C${X(2.1)} 47.2 ${X(1.5)} 48.3 ${X(0.9)} 48Z`, s < 0 ? T.md : T.sh)
    rims += `M${X(1.2)} 40.8C${X(2.6)} 40.4 ${X(3)} 42 ${X(2.8)} 44.2`
  }
  if (!lo) ears += stroke(rims, T.line, 0.3)
  // the neck: into the shirt, the jaw's shadow on it, the two neck muscles, the far side in shade
  const neckD = sym([50, 49], [
    [[50 + nw * 0.3, 49], [50 + nw * 0.6, 49], [50 + nw * 0.85, 49]],
    [[50 + nw * 0.88, 56], [50 + nw * 0.95, 63], [50 + nw + 0.4, 68.4]],
    [[50 + nw + 3, 70.4], [50 + nw + 10, 72.4], [50 + nw + 18, 75]],
    [[50 + nw + 18, 82], [50 + nw + 18, 88], [50 + nw + 18, 92]],
    [[50 + nw, 92], [55, 92], [50, 92]],
  ])
  const neck = `<use href="#${P}n" fill="${T.base}"/><g clip-path="url(#${P}N)">`
    + fill(`M${f1(50 + nw * 0.4)} 48C${f1(50 + nw * 0.62)} 60 ${f1(50 + nw * 0.3)} 70 ${f1(50 + nw * 0.4)} 92H104V48Z`, T.md)
    + fill(`M${f1(50 + nw * 0.72)} 48C${f1(50 + nw * 0.85)} 60 ${f1(50 + nw * 0.8)} 66 ${f1(50 + nw + 2)} 72H104V48Z`, T.sh)
    + `<use href="#${P}p" fill="${T.sh}" transform="translate(.4 3.4)"/><use href="#${P}p" fill="${T.dk}" transform="translate(.4 1.3)"/>`
    + fill(`M46.6 74L50 83L53.4 74Q50 76 46.6 74Z`, T.md)
    + (lo ? '' : stroke(`M${f1(50 - nw + 2.2)} 57C${f1(50 - nw + 3.4)} 63 47.4 69 47.6 73M${f1(50 + nw - 2.2)} 57C${f1(50 + nw - 3.4)} 63 52.6 69 52.4 73`, T.md, 0.8))
    + `</g><use href="#${P}n" fill="none" stroke="${T.ink}" stroke-width=".55"/>`
  const vb = VIEWS[view] ?? VIEWS.full
  // (a close crop of the eyes, the nose or the mouth leaves out what it can't show: less to draw for a thumbnail)
  const close = view === 'eyes' || view === 'nose' || view === 'mouth'
  const body = (close ? '' : hp.back + neck + (look.top ? topOf(look, G, col, P, lo) : look.kit === 'hoops' ? tankOf(G, T, col, P, lo) : jerseyOf(G, col, P, lo, look.kit === 'crew')) + chainOf(look, G))
    + (view === 'nose' || view === 'mouth' ? '' : ears)
    + `<use href="#${P}p" fill="${T.base}"/>`
    + `<g clip-path="url(#${P}C)">${fill(S.lm, mixC(T.base, T.md, 0.5))}${fill(S.md, T.md)}${fill(S.sh, T.sh)}${fill(S.dk, T.dk)}${fill(S.hl, T.hl)}`
    // the thin rim of cool light down the far edge
    + (lo ? '' : stroke(`M${f1(50 + tw - 0.5)} 37C${f1(50 + tw - 0.4)} 41 ${f1(50 + cb - 0.5)} 43 ${f1(50 + cb - 0.5)} 47C${f1(50 + cb - 0.6)} 51 ${f1(50 + jw + 0.1)} ${f1(jy - 3.4)} ${f1(50 + jw - 0.5)} ${f1(jy)}C${f1(50 + jw - 1.2)} ${f1(jy + 2)} ${f1(50 + ch + 2.2)} ${f1(cy - 2)} ${f1(50 + ch - 0.2)} ${f1(cy - 1.1)}`, T.rim, 0.5))
    + `</g>`
    // the ink: the head's edge in the skin's darkest brown, a touch more weight under the jaw
    + `<use href="#${P}p" fill="none" stroke="${T.ink}" stroke-width=".6"/>` + stroke(jawD(G), T.ink, 0.45, ' transform="translate(.15 .15)"')
    + (look.beard === 'stubble' ? beardOf(look, G, T, P, lo) : '')
    + lines + ey2.eyes + browsOf(look, G, T) + nose
    + (look.beard !== 'stubble' ? beardOf(look, G, T, P, lo) : '')
    + mouth + stacheOf(look, G, T) + eyeBlackOf(look, G)
    + hfront + headGearOf(look, G, col) + earringsOf(look, G) + glassesOf(look, G) + capOf(look, G, col, mark)
  const defs = `<defs><path id="${P}p" d="${headD(G)}"/><path id="${P}n" d="${neckD}"/>${ey2.clip}<clipPath id="${P}C"><use href="#${P}p"/></clipPath><clipPath id="${P}N"><use href="#${P}n"/></clipPath><clipPath id="${P}E"><use href="#${P}e"/></clipPath></defs>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" stroke-linecap="round" stroke-linejoin="round">${defs}${body}</svg>`
}

// a data: URL that encodes only what it must (smaller than encodeURIComponent's)
// (the drawing never holds a % or a brace, so the quote, the hash and the angle brackets are all there is to escape)
const toUrl = svg => `data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}`

// ── Coaches ──────────────────────────────────────────────────────────────────
// A coach is a grown man from his mid-thirties to his late sixties, the way NFL head coaches run (the young ones in
// modern cuts and beards, no grey; grey only from his late forties, white past sixty; lines with the years; glasses
// more often as he ages), a visor or a team cap with its mark, a team polo or a quarter-zip. The backgrounds of the
// NFL's coaching staffs: mostly white, about a fifth Black, a few others.
//   coachLook(key, { g, ag })         the look (g: his background if it's known, ag: his age, greyer every year)
//   coachUrl(key, { g, ag, color, small, mark })   the same as a data: URL (cached; small: the lighter drawing for
//                                           64 px and under; mark: his team's mark on a cap or visor, { t, c })
export const COACH_MIX = [['w', 74], ['b', 20], ['l', 4], ['p', 2]]
const COACH_HAIR = {
  w: [['crew', 24], ['sidepart', 20], ['textured', 12], ['fade', 8], ['receding', 14], ['balding', 8], ['buzz', 8], ['shaved', 6]],
  b: [['fade', 26], ['buzz', 26], ['shaved', 24], ['waves', 8], ['receding', 10], ['balding', 6]],
  l: [['crew', 24], ['sidepart', 18], ['fade', 16], ['textured', 10], ['receding', 14], ['buzz', 10], ['shaved', 8]],
  p: [['buzz', 34], ['shaved', 26], ['crew', 20], ['fade', 20]],
  m: [['fade', 26], ['buzz', 26], ['crew', 20], ['receding', 14], ['shaved', 14]],
}
const COACH_BEARD = [['none', 40], ['short', 20], ['stubble', 14], ['stache', 10], ['goatee', 8], ['full', 8]]
const GREYS = { w: ['#9b958c', '#c9c4bb', '#e2ded6'], b: ['#6f6b66', '#9d9993', '#c8c4bd'], l: ['#77726c', '#aaa59d', '#d6d2ca'], m: ['#77726c', '#aaa59d', '#d6d2ca'], p: ['#6f6b66', '#9d9993', '#c8c4bd'] }
export function coachLook(key, { g = null, ag = null } = {}) {
  const r = seeded(`coach-face|${key}`)
  const bg = g ?? pickW(r, COACH_MIX)
  const age = ag ?? 34 + Math.floor(r() * 32)
  const base = lookOf(`coach|${key}|${bg}`, 'qb')
  const skin = SKIN[bg] ? SKIN[bg][Math.floor(r() * SKIN[bg].length)] : base.skin
  let hair = pickW(r, COACH_HAIR[bg] ?? COACH_HAIR.w)
  // (the hairline goes with the years: none of it before forty, a receding line before a bald crown)
  if (age < 46 && hair === 'balding') hair = 'receding'
  if (age < 40 && hair === 'receding') hair = bg === 'b' ? 'fade' : 'crew'
  // his natural colour, then grey: salt and pepper from his late forties, grey in his fifties, white past sixty
  const nat = pickW(r, HC[bg] ?? HC.w).replace('#b8893c', '#16110e')
  const G3 = GREYS[bg] ?? GREYS.w
  const grey = age < 47 ? null : age < 54 ? mixC(nat, G3[0], 0.45) : age < 61 ? G3[1] : G3[2]
  const hc = grey ?? nat
  let beard = pickW(r, COACH_BEARD), stache = 'none'
  if (beard === 'stache') { beard = 'none'; stache = 'full' } else if (beard === 'short' || beard === 'full' || beard === 'goatee') stache = 'full'
  const u = r()
  const L = {
    g: bg, ag: age, skin, head: pickW(r, [['square', 40], ['broad', 30], ['oval', 20], ['round', 10]]), eyes: pickW(r, [['hooded', 40], ['narrow', 30], ['almond', 30]]),
    brows: pickW(r, [['thick', 34], ['straight', 40], ['angled', 26]]), nose: base.nose, mouth: pickW(r, [['thin', 40], ['neutral', 50], ['smirk', 10]]),
    hair, hc, brow: age >= 60 ? mixC(nat, G3[1], 0.6) : nat, bc: hc, beard, stache, gear: 'none', wide: 0.45,
    specs: r() < (age >= 55 ? 0.4 : age >= 45 ? 0.2 : 0.08) ? (r() < 0.75 ? 1 : 2) : 0,
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
export function coachUrl(key, { g = null, ag = null, color = '#d2aa4f', small = false, mark = null } = {}) {
  // (the face changes only as he ages: drawn at his age in steps, the steps where his hair greys and his lines come)
  const a = ag == null ? null : ag < 40 ? 36 : ag < 42 ? 40 : ag < 47 ? 44 : ag < 54 ? 50 : ag < 61 ? 57 : 64
  const k = `${key}|${g ?? ''}|${a ?? ''}|${color}|${small ? 1 : 0}|${mark?.t ?? ''}${mark?.c ?? ''}`
  let u = CCACHE.get(k)
  if (!u) {
    u = toUrl(faceSvg(coachLook(key, { g, ag: a }), { color, view: small ? 'sm' : 'full', mark }))
    if (CCACHE.size > 400) CCACHE.clear()
    CCACHE.set(k, u)
  }
  return u
}
// a coach's saved face (the player's built coach: { key, coach: 1, g?, ag? }, or an older save's player-style
// { key, pos }) as a url
export const coachFaceUrl = (face, color, ag = null, small = false, mark = null) => (!face ? null : face.coach ? coachUrl(face.key, { g: face.g ?? null, ag: ag ?? face.ag ?? null, color, small, mark }) : faceUrl(face.key, face.pos, color, null, small))

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
export const genFace = (p, color, small = false) => (p ? faceUrl(p.fk ?? p.n, facePos(p), color, p.ag ?? null, small) : null)

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
