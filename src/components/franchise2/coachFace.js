// A coach's face on a Franchise screen.
//   Real coaches: their photo (src/data/coach-headshots.json, keyed by name, files in public/headshots/coaches/)
//   when one has been gathered; until then, or without one, a drawn face.
//   Up-and-comers (made-up men) and the player's built coach: always a drawn face.
// The drawn face is a coach (faces.js coachLook): an older man, greying with his age, often glasses, a cap or visor,
// a team polo or quarter-zip. A real man's drawing keeps his background (below, from the real coaches' public
// photos) so it isn't someone else.
import { coachUrl, coachFaceUrl } from '../../lib/franchise2/faces'
import { TEAM } from '../../lib/franchise2'
import { teamKit } from '../../lib/franchise2/kits'
import { CAP_LOGOS } from '../../lib/franchise2/capLogos'

// (the file may not be there yet: the glob finds it when it is)
const FILES = import.meta.glob('../../data/coach-headshots.json', { eager: true, import: 'default' })
const SHOTS = Object.values(FILES)[0] ?? {}
function shotOf(name) {
  const v = SHOTS[name]
  if (!v) return null
  const s = typeof v === 'string' ? v : v.src ?? v.url ?? v.file ?? v.path ?? null
  if (!s) return null
  return /^(https?:|data:|\/)/.test(s) ? s : `/headshots/coaches/${s}`
}

// b Black · w white · l Latino / Middle Eastern · m mixed
const BLACK = ['Anthony Weaver', 'Christian Parker', 'Vance Joseph', 'Kelvin Sheppard', 'DeMeco Ryans', 'Eric Bieniemy', 'Nate Scheelhaase', 'Brian Flores', 'Dennard Wilson', 'Aaron Glenn', 'Patrick Graham', 'Raheem Morris', 'Aden Durde', 'Todd Bowles', 'George Edwards', 'Daronte Jones', 'Mike Tomlin', 'Marvin Lewis', 'Jim Caldwell', 'Antonio Pierce', 'Ejiro Evero', 'Lovie Smith', 'Jerod Mayo']
const BG = { ...Object.fromEntries(BLACK.map(n => [n, 'b'])), 'Dave Canales': 'l', 'Robert Saleh': 'l', 'Mike McDaniel': 'm' }
// a coach the game draws: c.g his background if known (generated coaches carry it), c.ag his age (greyer each year)
// small: a list's face (64 px and under), the lighter drawing
export function drawnCoach(c, color, small = false, mark = null) {
  const name = c?.n ?? c?.name ?? 'Coach'
  // (a generated coach carries his background; a real one is in BG or white, as the real staffs are)
  return coachUrl(name, { g: c?.g ?? BG[name] ?? 'w', ag: c?.ag ?? null, color, small, mark })
}
// any coach on a team: the player's built coach (his own face), a real man's photo, else the drawing
//   c: a staff coach (coach.js: { n, ag, g, ... }), myHC (mine, face), or the setup's coach ({ name, face })
export function coachPhoto(c, team, small = false) {
  const color = teamKit(team) ?? TEAM[team]?.color, mark = teamMark(team)
  if (!c) return null
  if (c.mine || c.face) return c.face ? coachFaceUrl(c.face, color, c.ag ?? null, small, mark) : drawnCoach(c, color, small, mark)
  const name = c.n ?? c.name
  if (!c.g) { const s = shotOf(name); if (s) return s }
  return drawnCoach(c, color, small, mark)
}
// his team's logo on a drawn cap and on his chest (owner 11-16: "put the logo not a letter"; never on a visor): a small
// copy of the team's logo (capLogos.js, made by scripts/franchise2/cap-logos.mjs) the drawing embeds; outlined in white
// (or near-black on a light colour) when its own colours would vanish on the team-coloured cloth
const rgbOf = h => { const x = parseInt(String(h ?? '#000000').slice(1, 7), 16); return [(x >> 16) & 255, (x >> 8) & 255, x & 255] }
const lumOf = h => { const [r, g, b] = rgbOf(h); return 0.299 * r + 0.587 * g + 0.114 * b }
const MARKS = new Map()
export function teamMark(team) {
  if (MARKS.has(team)) return MARKS.get(team)
  const L = CAP_LOGOS[team], t = TEAM[team]
  let m = null
  if (L && t) {
    const [src, w, h, avg] = L, cloth = teamKit(team)?.c1 ?? t.color
    const a = rgbOf(avg), b = rgbOf(cloth)
    const o = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 50 ? (lumOf(cloth) > 150 ? '#14161b' : '#ffffff') : null
    m = { id: team, src, w, h, o }
  }
  MARKS.set(team, m)
  return m
}
