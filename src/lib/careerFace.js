// CAREER: the player's own drawn face (owner 2026-11-15: "player icon customization should be in career too so it's
// not your profile icon"). Never the account's avatar, never a real man's photo: his face is made in the same creator
// as Franchise's builds (FacePick) on the name step, saved on the career as c.face (faces.js B.face), and edited any
// time from the career screen (tap his face). He wears his club's colour under it, in his sport's kit.
//   careerFace(c)        his face: c.face, or (a career saved before faces) a default keyed by the career, in the skin
//                        that career already showed (its old skin source), so nothing changes colour
//   careerKit(c)         what he wears: a football jersey, a basketball tank, a soccer shirt, a crew-neck shirt (baseball)
//   careerFaceUrl(c, small)  the drawing as a url, in his club's colour (before he has one, graphite)
//   careerSkin(c)        his skin for the figure and the mini games' cast (c.face's)
//   careerMix(c)         the backgrounds his random look is drawn from: a soccer Career's country's (faceNations.js),
//                        else his position's NFL or NBA room (null)
//   careerShirt(c)       what colours he wears: soccer his club's shirt in its two colours, else his club's colour
import { defaultFace, buildFaceUrl } from './franchise2/faces'
import { FACE_RATING } from './career'
import { nationMix } from './faceNations'

const KIT = { nfl: 'fb', bucket: 'hoops', soccer: 'soccer', baseball: 'crew' }
export const careerKit = c => KIT[c?.sport] ?? 'fb'
// (the face's build: a football position keeps its own, a lineman's head and neck wider; other sports a lean frame)
const FB = new Set(['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db', 'k'])
export const careerFacePos = c => (FB.has(c?.pos) && (c?.sport ?? 'nfl') === 'nfl' ? c.pos : c?.pos === 'big' ? 'lb' : 'wr')
const lum = h => { const x = parseInt(String(h).slice(1, 7), 16); return 0.299 * ((x >> 16) & 255) + 0.587 * ((x >> 8) & 255) + 0.114 * (x & 255) }
// the skin a career showed before it had a face: the cast's own source (lib/career.js gameCast)
const oldSkin = c => c?.skin ?? c?.build?.[FACE_RATING[c?.pos]]?.skinColor ?? c?.build?.skin ?? null
// a new career's first face: a coherent random man keyed by the name step's key
export const careerMix = c => (c?.sport === 'soccer' && c.nation ? nationMix(c.nation) : null)
export const newCareerFace = (key, c) => defaultFace(`career|${key}`, careerFacePos(c), careerMix(c))
const DEF = new Map()
export function careerFace(c) {
  if (!c) return null
  if (c.face) return c.face
  const id = `${c.sport ?? 'nfl'}|${c.seed ?? c.name ?? 'career'}`
  let f = DEF.get(id)
  if (f) return f
  const pos = careerFacePos(c), sk = oldSkin(c), mix = careerMix(c)
  // (of a dozen made-up men keyed by the career, the one whose skin is nearest the old one: his hair and features
  // go with that skin), then that old skin exactly
  f = defaultFace(`career|${id}|0`, pos, mix)
  if (/^#[0-9a-f]{6}$/i.test(sk ?? '')) {
    for (let i = 1; i < 12; i++) { const g = defaultFace(`career|${id}|${i}`, pos, mix); if (Math.abs(lum(g.skin) - lum(sk)) < Math.abs(lum(f.skin) - lum(sk))) f = g }
    f = { ...f, skin: sk }
  }
  DEF.set(id, f)
  return f
}
export const careerColor = c => c?.fit?.color ?? '#3a4048'
// a soccer shirt in two colours (a club's or a country's): the body, and the collar and trim in the second colour (when
// the two are too close to tell apart, white or a dark navy)
export const soccerShirt = (id, c1, c2) => {
  if (!c1) return null
  const a = String(c1).toLowerCase(), b = c2 ? String(c2).toLowerCase() : null
  const far = b && Math.abs(lum(b) - lum(a)) > 40
  return { id: `soc-${id}`, c1: a, c2: far ? b : lum(a) > 170 ? '#1d2230' : '#ffffff', c3: null, pat: 'solid' }
}
export const careerShirt = c => (c?.sport === 'soccer' && c.fit?.color ? soccerShirt(c.team ?? c.fit.short ?? c.fit.color, c.fit.color, c.fit.color2) : careerColor(c))
export const careerFaceUrl = (c, small = false) => (c ? buildFaceUrl({ pos: careerFacePos(c), kit: careerKit(c), face: careerFace(c), age: c.age }, careerShirt(c), small ? 'sm' : 'full') : null)
export const careerSkin = c => c?.face?.skin ?? null
