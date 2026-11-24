// BASKETBALL FRANCHISE: the coaches' pieces for football's screens. The coach builder (CoachBuild.jsx) and the staff's
// lower-thirds (Staff.jsx StaffL3, Grades) take a league the way Slots.jsx does; these are the NBA's: its teams, the
// five basketball ratings, its styles, the wheel of the league's real head coaches (lib/franchise2/nba/coach.js).
// Faces: a real coach's ESPN studio headshot when ESPN has one, else his initials (never a drawing of a real man);
// a made-up assistant and the GM's built coach are drawn (faces.js coachUrl / coachFaceUrl).
import { TEAM, FIRST_YEAR, NC } from '../../../lib/franchise2/nba'
import { coachLook, coachFaceUrl, coachUrl } from '../../../lib/franchise2/faces'
import { coachName } from '../../../lib/franchise2/coachNames'

const colorOf = team => TEAM[team]?.color ?? '#3a4048'
export function nbaCoachPhoto(c, team, small = false) {
  if (!c) return null
  if (c.mine || c.face) return c.face ? coachFaceUrl(c.face, colorOf(team), c.ag ?? null, small, null) : null
  if (c.real) return NC.coachShot(c)
  return coachUrl(c.n ?? c.name ?? 'Coach', { g: c.g ?? 'w', ag: c.ag ?? null, color: colorOf(team), small })
}
// the GM's coach's faces: a strip of eight drawn coaches, 34 to 61, as NBA benches look (about two in five Black)
const AGES = [34, 37, 40, 43, 46, 50, 55, 61]
function faces(seed, page = 0) {
  const out = []
  let black = 0
  for (let k = 0; k < 80 && out.length < 8; k++) {
    const key = `nbacoach-${seed}-${page}-${k}`, ag = AGES[(k + page * 3) % AGES.length]
    const g = coachLook(key, { ag }).g
    if (g !== 'b' && out.length >= 5 && black < 3) continue
    if (g === 'b') black++
    out.push({ key, coach: 1, g, ag, y: FIRST_YEAR })
  }
  return out
}
function randomName(not) {
  for (let k = 0; k < 20; k++) {
    const [first, ...rest] = coachName(Math.random, Math.random() < 0.55 ? 'w' : 'b').split(' ')
    const last = rest.join(' ')
    if (!not || first !== not.first || last !== not.last) return { first, last }
  }
  return { first: 'Marcus', last: 'Hale' }
}
// CoachBuild.jsx's league
export const NBA_COACH = {
  TEAM, CTYPES: NC.CTYPES, CLABEL: NC.CLABEL, SHORT_LABEL: NC.CSHORT, STYLES: NC.STYLES, RESPINS: NC.RESPINS, cLetter: NC.cLetter, coachGrade: NC.coachGrade,
  wheelOf: NC.wheelOf, dealSpin: NC.dealSpin, dealRespin: NC.dealRespin, coachByName: NC.coachByName, takeLine: NC.takeLine, linesDone: NC.linesDone, realHC: NC.realHC,
  photo: nbaCoachPhoto, color: colorOf, mark: () => null, faces, randomName,
  hireSub: real => `TAKES OVER FROM ${real.name.toUpperCase()}`,
}
// Staff.jsx's league (StaffL3, Grades)
const fiveOf = (F, c) => (c?.mine ? F?.coach?.r ?? null : NC.rOf(c))
export const NBA_STAFF = { CTYPES: NC.CTYPES, CNAME: NC.CNAME, CWORD: NC.CWORD, cLetter: NC.cLetter, coachGrade: NC.coachGrade, JOB: NC.JOB, five: fiveOf, photo: nbaCoachPhoto }
