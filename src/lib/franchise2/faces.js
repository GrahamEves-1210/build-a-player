// FRANCHISE: drawn faces. The men the game makes up (draft prospects, rookies, generated depth, free agents, coaches
// without a photo) and every one of the player's builds. Real players use their ESPN headshot; never a drawn face on a
// real man without a photo (initials beat a made-up face on a real player).
//
// This file decides who he is; faceArt.js draws him (the flat broadcast-graphic style, owner 2026-11-15).
// The man is one coherent person, not parts picked at random: first his background (weighted by position the way NFL
// rooms are), then a skin tone, head, features, hair, hair colour and facial hair that go together on real players.
//
//   lookOf(key, pos, ag)          the look, seeded by the key (his name); ag his age (lines come with the years)
//   faceSvg(look, { color, view }) the SVG bust (faceArt.js; transparent; color: his team's; view: VIEWS)
//   faceUrl(key, pos, color, ag, small)  the same as a data: URL for an <img> (cached; small: the lighter drawing
//                                 for lists at 64 px and under)
//   genFace(p, color, small)      a league man's face url (p: league.js's player): his key is his name
// The player's builds: B.face (the creator's choices, FacePick.jsx), buildLook(B), buildFaceUrl(B, color, view).
//
// Pure: no DOM, no Math.random. The same name always draws the same man (a prospect keeps his face as a rookie).
// Every SVG string is cached by its look, so a face is built once and then reused.
import { seeded } from '../rng'
import { faceSvg, VIEWS, toUrl, mixC, lum } from './faceArt'
// (a colour a caller passes: a hex, or a team's kit from kits.js; the caches key a kit by its id)
const ck = c => (c && typeof c === 'object' ? c.id ?? c.short ?? c.color : c ?? '')

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
// a room's backgrounds as [background, weight] (names.js draws a made-up man's background from it), and the one his
// face will be drawn with (lookOf's first draw), so a name and a face agree
export const mixOf = pos => Object.entries(MIX[roomOf(pos)]).map(([k, v]) => [k, v * 100])
export const bgOf = (key, pos) => pickW(seeded(`face|${key}`), mixOf(pos))

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
  ['receding', 'RECEDING'], ['balding', 'THINNING'], ['locsup', 'LOCS UP'], ['starter', 'STARTER LOCS'],
]
// a player is 21 to 30 (owner 11-16: "no gray hair please these are supposed to be 21yos"): his creator never offers
// grey hair or a hairline that's going (the full lists stay for coaches and for reading older saves)
const OLD_HAIR = { receding: 'crew', balding: 'buzz' }
export const PLAYER_HAIR = FACE_HAIR.filter(x => !OLD_HAIR[x[0]])
export const FACE_HC = [
  ['#16110e', 'BLACK'], ['#2a1d15', 'DARK'], ['#5a3b24', 'BROWN'], ['#86492a', 'AUBURN'], ['#9a4526', 'RED'], ['#a8824e', 'SANDY'],
  ['#c9a46c', 'BLOND'], ['#ddd0ac', 'PLATINUM'], ['#b8893c', 'TIPS'], ['#57534f', 'SALT & PEPPER'], ['#8f8a82', 'GREY'], ['#b4b0a9', 'SILVER'], ['#e2dfd8', 'WHITE'],
]
const GREY = new Set(['#57534f', '#8f8a82', '#b4b0a9', '#e2dfd8', '#ddd0ac'])
export const PLAYER_HC = FACE_HC.filter(x => !GREY.has(x[0]))
export const FACE_BEARD = [['none', 'CLEAN'], ['stubble', 'STUBBLE'], ['patch', 'CHIN PATCH'], ['chin', 'STRAP'], ['goatee', 'GOATEE'], ['short', 'SHORT'], ['full', 'FULL'], ['long', 'LONG']]
export const FACE_STACHE = [['none', 'NONE'], ['thin', 'THIN'], ['full', 'FULL'], ['horseshoe', 'HORSESHOE']]
export const FACE_GEAR = [['none', 'NONE'], ['headband', 'HEADBAND'], ['durag', 'DURAG'], ['visor', 'VISOR']]
// (no visor on a player, owner 11-16: coaches keep their caps and visors)
export const PLAYER_GEAR = FACE_GEAR.filter(x => x[0] !== 'visor')
export const FACE_EB = [['none', 'NONE'], ['paint', 'EYE BLACK'], ['strips', 'STRIPS']]
export const FACE_EAR = [['none', 'NONE'], ['studs', 'STUDS'], ['stud', 'ONE STUD']]
export const FACE_CHAIN = [['none', 'NONE'], ['gold', 'GOLD'], ['silver', 'SILVER']]
// his expression (owner 11-16: "all of the football players look super serious"): the ones real headshots show
export const FACE_EXPR = [['neutral', 'RELAXED'], ['slight', 'SLIGHT SMILE'], ['warm', 'WARM SMILE'], ['grin', 'BIG SMILE'], ['half', 'HALF SMILE']]
// how often each shows (a count of 100 ESPN headshots in public/headshots, 11-16: 53 open smiles, 25 relaxed, 11
// slight closed smiles, 8 warm closed smiles, 3 half smiles); a coach a little more reserved
const EXPRS = [['grin', 46], ['neutral', 26], ['slight', 13], ['warm', 10], ['half', 5]]
const COACH_EXPRS = [['neutral', 34], ['slight', 24], ['warm', 18], ['grin', 16], ['half', 8]]
// (from a stream of its own, keyed by his name, so his other parts keep their draws and he always wears the same face)
export const exprOf = (key, coach = false) => pickW(seeded(`face5|${key}`), coach ? COACH_EXPRS : EXPRS)
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
  b: [['fade', 28], ['waves', 12], ['buzz', 12], ['locs', 6], ['locsup', 3], ['starter', 3], ['twists', 8], ['cornrows', 5], ['hightop', 2], ['shaved', 9], ['afro', 3], ['curly', 4]],
  w: [['crew', 18], ['sidepart', 8], ['textured', 26], ['flow', 12], ['buzz', 8], ['curly', 12], ['shaved', 1], ['mullet', 4], ['fade', 11]],   // (young men's cuts: a textured crop, curls, a fade, the flow; a shaved head read older; no long hair: it read as a costume)
  m: [['fade', 26], ['curly', 24], ['buzz', 12], ['twists', 8], ['locs', 4], ['starter', 4], ['afro', 4], ['shaved', 6], ['textured', 8], ['waves', 4]],
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
  b: [['none', 32], ['stubble', 15], ['goatee', 13], ['short', 20], ['full', 11], ['chin', 8], ['long', 1]],   // (players 21 to 30: fewer heavy beards)
  w: [['none', 54], ['stubble', 24], ['short', 13], ['full', 5], ['goatee', 3], ['chin', 1]],   // (players are 21 to 30: mostly clean or a light beard)
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
// the build by position (owner 11-16: "why are my TEs fat"): linemen wide, tight ends and linebackers athletic, the
// backs, receivers, corners, safeties, quarterbacks and kickers lean
const TIPPED = new Set(['locs', 'locsup', 'starter', 'twists'])
const BIG = new Set(['ol', 'dl'])
const MID = new Set(['te', 'lb'])
const wideOf = pos => { const k = roomOf(pos); return BIG.has(k) ? 1 : MID.has(k) ? 0.5 : k === 'rb' ? 0.3 : 0.1 }
const r2 = v => Math.round(v * 100) / 100
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

// the newer parts (iris, shape sliders, the eye black / earrings / chain split out of the old single gear), from a
// second stream so the first parts keep their older draws
function extras(key, L, pos) {
  const r = seeded(`face2|${key}`)
  const room = roomOf(pos), g = L.g, big = BIG.has(room), mid = MID.has(room), lean = room === 'db' || room === 'cb' || room === 's' || room === 'wr'
  const s = () => r2((r() + r() + r()) / 1.5 - 1)   // -1 … 1, most near the middle
  const x = {
    iris: pickW(r, IRIS[g] ?? IRIS.w),
    wt: r2(clamp((big ? 0.5 : mid ? -0.05 : lean ? -0.5 : room === 'rb' ? -0.2 : -0.3) + s() * (big ? 0.4 : 0.3), -1, big ? 1 : 0.35)),
    jaw: r2(s() * 0.7 + (big ? 0.2 : mid ? 0.1 : 0)), chn: r2(s() * 0.6), chk: r2(s() * 0.7 + (lean ? 0.15 : 0)),
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
  // (his bones, faceArt.js: a seed for where his jaw turns, his chin, cheekbones and the set of his eyes)
  x.bone = Math.floor(r() * 1000)
  x.expr = exprOf(key)
  return x
}

// Young NFL rooms by position (owner 11-16: "less big beards for skill positions and less bald"), from a stream of its
// own so his other parts keep their draws: a shaved head is rare (a lineman's now and then), the others keep a cut of
// their background's (a fade, waves, a buzz, curls, a crop); the backs, receivers, corners, safeties, quarterbacks and
// kickers are mostly clean, stubbled, lined up or in a thin goatee, a full beard rare; the big men keep more beards
const SKILL = new Set(['qb', 'rb', 'wr', 'cb', 's', 'db', 'k'])
const NOT_BALD = { b: [['fade', 50], ['waves', 22], ['buzz', 18], ['twists', 10]], m: [['fade', 50], ['curly', 30], ['buzz', 20]], p: [['fade', 40], ['curly', 35], ['buzz', 25]], l: [['fade', 50], ['crew', 30], ['buzz', 20]], w: [['crew', 40], ['textured', 40], ['buzz', 20]] }
const LIGHT = [['none', 46], ['stubble', 24], ['chin', 12], ['goatee', 12], ['patch', 6]]
function byPosition(key, L, pos) {
  const r = seeded(`face4|${key}`), room = roomOf(pos), skill = SKILL.has(room)
  if (L.hair === 'shaved' && r() > (BIG.has(room) ? 0.9 : 0.4)) L.hair = pickW(r, NOT_BALD[L.g] ?? NOT_BALD.w)
  const heavy = L.beard === 'full' || L.beard === 'long', mid = L.beard === 'short'
  // (long hair keeps the beard that goes with it)
  if (L.hair === 'long' || L.hair === 'bun') return
  let nb = L.beard
  if (skill && heavy && r() < 0.6) nb = pickW(r, LIGHT)
  else if (skill && mid && r() < 0.55) nb = pickW(r, LIGHT)
  else if (!skill && L.beard === 'long' && r() < 0.6) nb = 'full'
  if (nb === L.beard) return
  L.beard = nb
  L.stache = nb === 'goatee' ? 'full' : nb === 'full' || nb === 'short' ? 'full' : 'none'
}
export function lookOf(key, pos = 'wr', ag = null) {
  const r = seeded(`face|${key}`)
  const mix = MIX[roomOf(pos)]
  const g = pickW(r, Object.entries(mix).map(([k, v]) => [k, v * 100]))
  const skin = SKIN[g][Math.floor(r() * SKIN[g].length)]
  const hair = pickW(r, HAIR[g])
  let hc = pickW(r, HC[g])
  // dyed tips only on locs or twists; otherwise his natural colour
  if (hc === '#b8893c' && !TIPPED.has(hair)) hc = '#16110e'
  let beard = pickW(r, BEARD[g])
  // (a shaved head usually comes with a beard; hair to the shoulders or tied up always does, so it reads as a
  // football player's, never a woman's)
  if (hair === 'shaved' && beard === 'none' && r() < 0.6) beard = 'full'
  if ((hair === 'long' || hair === 'bun') && (beard === 'none' || beard === 'stubble' || beard === 'chin')) beard = g === 'p' ? 'full' : 'short'
  // (hair over the ears with a bare face reads young and soft in a drawing: a flow or a mullet gets some stubble)
  if ((hair === 'flow' || hair === 'mullet') && beard === 'none') beard = 'stubble'
  // (and in the flat drawing a grown-out cut on a bare or stubbled face read as a woman's bob: most get a trimmed beard)
  if ((hair === 'flow' || hair === 'mullet' || hair === 'long') && (beard === 'stubble' || beard === 'none') && seeded(`face3|${key}`)() < 0.4) beard = 'short'
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
  byPosition(key, L, pos)
  const x = extras(key, L, pos)
  return { ...L, ...x, gear: gear === 'eyeblack' || gear === 'studs' ? 'none' : gear, ag: ag ?? 24 }
}

// ── The drawing ──────────────────────────────────────────────────────────────
// (faceArt.js: the flat style; this file decides who he is, that one draws him)
export { faceSvg, VIEWS }

// ── Coaches ──────────────────────────────────────────────────────────────────
// A coach is a grown man from his mid-thirties to his late sixties, the way NFL head coaches run (the young ones in
// modern cuts and beards, no grey; grey only from his late forties, white past sixty; lines with the years; glasses
// more often as he ages), a plain visor or a team cap with its logo, a team polo or a quarter-zip. The backgrounds of the
// NFL's coaching staffs: mostly white, about a fifth Black, a few others.
//   coachLook(key, { g, ag })         the look (g: his background if it's known, ag: his age, greyer every year)
//   coachUrl(key, { g, ag, color, small, mark })   the same as a data: URL (cached; small: the lighter drawing for
//                                           64 px and under; mark: his team's logo for his cap and chest,
//                                           coachFace.js teamMark)
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
    eb: 'none', ear: 'none', chain: 'none', cleft: r3() < 0.2, co: 1, bone: Math.floor(r3() * 1000), expr: exprOf(`coach|${key}`, true),
  }
}
const CCACHE = new Map()
export function coachUrl(key, { g = null, ag = null, color = '#d2aa4f', small = false, mark = null } = {}) {
  // (the face changes only as he ages: drawn at his age in steps, the steps where his hair greys and his lines come)
  const a = ag == null ? null : ag < 40 ? 36 : ag < 42 ? 40 : ag < 47 ? 44 : ag < 54 ? 50 : ag < 61 ? 57 : 64
  const k = `${key}|${g ?? ''}|${a ?? ''}|${ck(color)}|${small ? 1 : 0}|${mark?.id ?? ''}`
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
  const k = `${key}|${pos}|${ck(color)}|${a}|${small ? 1 : 0}`
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
export const FACE_KEYS = ['skin', 'head', 'eyes', 'iris', 'brows', 'nose', 'mouth', 'hair', 'hc', 'beard', 'stache', 'gear', 'eb', 'ear', 'chain', ...SL, 'bone', 'expr']
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
const LISTS = [['expr', FACE_EXPR], ['head', FACE_HEAD], ['eyes', FACE_EYES], ['iris', FACE_IRIS], ['brows', FACE_BROWS], ['nose', FACE_NOSE], ['mouth', FACE_MOUTH], ['hair', FACE_HAIR], ['beard', FACE_BEARD], ['stache', FACE_STACHE], ['gear', FACE_GEAR], ['eb', FACE_EB], ['ear', FACE_EAR], ['chain', FACE_CHAIN]]
export function normFace(face, base) {
  const f = { ...base, ...(face ?? {}) }
  if (face && !face.stache && OLD_BEARD[face.beard]) [f.beard, f.stache] = OLD_BEARD[face.beard]
  if (face && OLD_GEAR[face.gear]) { const [k, v] = OLD_GEAR[face.gear]; f.gear = 'none'; if (!face[k]) f[k] = v }
  for (const [k, list] of LISTS) if (!ok(list, f[k])) f[k] = base[k]
  // (a skin off the list is kept when it's a real colour: a Career saved before its face keeps its old skin exactly)
  if (!ok(FACE_SKIN, f.skin)) f.skin = /^#[0-9a-f]{6}$/i.test(f.skin ?? '') ? f.skin : near(FACE_SKIN, f.skin ?? base.skin)
  if (!ok(FACE_HC, f.hc)) f.hc = base.hc
  // (a player's face: an older save's grey, platinum or thinning hair back to his own colour and a full head of it)
  if (GREY.has(f.hc)) f.hc = GREY.has(base.hc) ? '#2a1d15' : base.hc
  if (f.gear === 'visor') f.gear = 'none'
  if (OLD_HAIR[f.hair]) f.hair = groupOfSkin(f.skin) === 'b' && f.hair === 'receding' ? 'fade' : OLD_HAIR[f.hair]
  for (const k of SL) f[k] = Number.isFinite(+f[k]) ? clamp(+f[k], -1, 1) : 0
  // (a face saved before his bones had a seed takes his default's)
  f.bone = Number.isFinite(+f.bone) && f.bone !== null && f.bone !== '' ? Math.floor(+f.bone) % 1000 : (base.bone ?? 0)
  return f
}
// what a man wears under his face: fb a football jersey's V-neck (the default) · hoops a basketball tank · crew a
// crew-neck shirt (soccer, baseball)
export const KITS = ['fb', 'hoops', 'crew']
export function buildLook(B) {
  const pos = B?.pos ?? 'wr'
  const f = normFace(B?.face, defaultFace(B?.name ?? 'build', pos))
  // dyed tips only show on locs and twists; on any other cut the colour underneath is black
  const hc = f.hc === '#b8893c' && !TIPPED.has(f.hair) ? '#16110e' : f.hc
  // B.kit: what he wears under his face (KITS; eye black is football's only)
  const kit = KITS.includes(B?.kit) ? B.kit : 'fb'
  return { ...f, g: groupOfSkin(f.skin), hc, brow: f.hc === '#b8893c' ? '#16110e' : hc, wide: wideOf(pos), ag: ageStep(B?.age), kit, ...(kit !== 'fb' ? { eb: 'none' } : null) }
}
const BCACHE = new Map()
export function buildFaceUrl(B, color, view = 'full') {
  if (!B) return null
  const L = buildLook(B)
  const k = `${FACE_KEYS.map(x => L[x]).join('|')}|${L.wide}|${L.ag}|${L.kit}|${ck(color)}|${view}`
  let u = BCACHE.get(k)
  if (!u) {
    u = toUrl(faceSvg(L, { color, view }))
    if (BCACHE.size > 600) BCACHE.clear()
    BCACHE.set(k, u)
  }
  return u
}
