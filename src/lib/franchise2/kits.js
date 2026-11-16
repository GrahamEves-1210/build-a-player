// What a drawn man wears: his team's jersey (owner 11-16: "make the jerseys they are wearing better and match teams
// better"). The colours are the team data the game already has (data/nfl-teams.js, data/cfb-teams.js: color,
// color2) plus white; never a logo, a wordmark or a traced mark, only colours and a trim pattern.
//   c1 the jersey · c2 the trim (collar band, stripes, yoke) · c3 the second trim · pat the trim pattern:
//     solid     a plain body, the collar band in the trim
//     double    two thin stripes round the collar
//     stripes2  two sleeve stripes at the shoulder caps
//     stripes3  three sleeve stripes (trim, white, trim)
//     shoulder  a stripe pair over the top of the shoulder from the collar to the sleeve
//     yoke      the shoulders in a contrast panel down to a seam across the chest
// A team's home jersey isn't always its first colour (the Bears, Steelers, Browns, Saints, Cowboys and Bengals wear
// their second at home), so each NFL kit names which of the two it wears.
//   teamKit(short)          an NFL team's kit (null for an unknown team)
//   schoolKit(t)            a college's kit from its { short, color, color2 }
//   kitOf(x)                any colour a caller has: a kit, an NFL team's colour, else a plain kit in that colour
import { NFL_TEAMS } from '../../data/nfl-teams'

const W = '#ffffff'
// short: [the jersey: 1 its color, 2 its color2] [the trim: 1, 2 or W] [the second trim] pattern
const NFL = {
  ARI: [1, 2, W, 'shoulder'], ATL: [1, 2, W, 'yoke'], BAL: [1, 2, W, 'stripes2'], BUF: [1, 2, W, 'shoulder'],
  CAR: [1, 2, W, 'yoke'], CHI: [2, 1, W, 'stripes3'], CIN: [2, 1, W, 'stripes2'], CLE: [2, 1, W, 'stripes3'],
  DAL: [2, 1, W, 'stripes2'], DEN: [1, 2, W, 'yoke'], DET: [1, 2, W, 'solid'], GB: [1, 2, W, 'stripes3'],
  HOU: [1, 2, W, 'shoulder'], IND: [1, W, 2, 'shoulder'], JAX: [1, 2, W, 'yoke'], KC: [1, W, 2, 'stripes3'],
  LV: [1, 2, W, 'solid'], LAC: [1, 2, W, 'shoulder'], LAR: [1, 2, W, 'shoulder'], MIA: [1, 2, W, 'stripes2'],
  MIN: [1, 2, W, 'shoulder'], NE: [1, 2, W, 'stripes2'], NO: [2, 1, W, 'solid'], NYG: [1, 2, W, 'stripes2'],
  NYJ: [1, W, 2, 'stripes2'], PHI: [1, 2, W, 'yoke'], PIT: [2, 1, W, 'stripes3'], SF: [1, 2, W, 'stripes3'],
  SEA: [1, 2, W, 'shoulder'], TB: [1, 2, W, 'double'], TEN: [1, 2, W, 'yoke'], WAS: [1, 2, W, 'stripes2'],
}
const pick = (t, k) => (k === 1 ? t.color : k === 2 ? t.color2 : k)
const low = c => String(c ?? '').toLowerCase()
const KITS = new Map(), BY_COLOR = new Map()
for (const t of NFL_TEAMS) {
  const s = NFL[t.short]
  if (!s) continue
  const kit = { id: t.short, c1: low(pick(t, s[0])), c2: low(pick(t, s[1])), c3: low(pick(t, s[2])), pat: s[3] }
  KITS.set(t.short, kit)
  if (!BY_COLOR.has(low(t.color))) BY_COLOR.set(low(t.color), kit)
}
export const teamKit = short => KITS.get(short) ?? null

const lum = c => { const x = parseInt(String(c).slice(1, 7), 16); return 0.299 * ((x >> 16) & 255) + 0.587 * ((x >> 8) & 255) + 0.114 * (x & 255) }
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
const PATS = ['stripes2', 'solid', 'stripes3', 'double', 'shoulder', 'stripes2', 'yoke']
// a trim that stands off the jersey: the second colour when it does, else white (or black on a light jersey)
const trimFor = (c1, c2) => (c2 && Math.abs(lum(c2) - lum(c1)) > 45 ? low(c2) : lum(c1) > 170 ? '#14161b' : W)
const SCHOOLS = new Map()
export function schoolKit(t) {
  if (!t?.color) return null
  const id = `cfb:${t.short ?? t.color}`
  let k = SCHOOLS.get(id)
  if (!k) {
    const c1 = low(t.color), c2 = trimFor(c1, t.color2)
    k = { id, c1, c2, c3: c2 === W ? (lum(c1) > 150 ? '#14161b' : low(t.color2 ?? W)) : W, pat: PATS[hash(id) % PATS.length] }
    if (k.c3 === c1 || Math.abs(lum(k.c3) - lum(c1)) < 30) k.c3 = W
    SCHOOLS.set(id, k)
  }
  return k
}
const PLAIN = new Map()
export function kitOf(x) {
  if (x && typeof x === 'object') return x.c1 ? x : schoolKit(x)
  const c = low(x || '#d2aa4f')
  const k = BY_COLOR.get(c)
  if (k) return k
  let p = PLAIN.get(c)
  if (!p) { p = { id: c, c1: c, c2: trimFor(c, null), c3: null, pat: 'solid' }; PLAIN.set(c, p) }
  return p
}
