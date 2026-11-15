// A coach's face on a Franchise screen.
//   Real coaches: their photo (src/data/coach-headshots.json, keyed by name, files in public/headshots/coaches/)
//   when one has been gathered; until then, or without one, a drawn face.
//   Up-and-comers (made-up men) and the player's built coach: always a drawn face (lib/franchise2/faces.js).
// The drawn face is one coherent man (faces.js lookOf), drawn from the coach's background so a real man's drawing
// isn't someone else (the background of the real coaches below, from their public photos), with the short cuts a
// coaching staff wears and his hair greying with age.
import { lookOf, faceSvg, faceUrl } from '../../lib/franchise2/faces'
import { TEAM } from '../../lib/franchise2'

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
const CUTS = new Set(['fade', 'buzz', 'crew', 'sidepart', 'textured', 'shaved', 'waves', 'curly'])
const POS_FOR = { b: 'db', w: 'qb', l: 'ol', m: 'rb', p: 'ol' }
const GREY = { w: ['#8f8a82', '#c9c5bd'], l: ['#77726c', '#b3aea6'], m: ['#6f6b66', '#a9a49c'], b: ['#5f5c58', '#9a968f'], p: ['#6a6661', '#a8a39b'] }
const CACHE = new Map()
export function drawnCoach(c, color) {
  const name = c?.n ?? c?.name ?? 'Coach'
  const g = c?.g ?? BG[name] ?? 'w'
  const ag = c?.ag ?? 45
  const key = `${name}|${g}|${ag >= 62 ? 2 : ag >= 52 ? 1 : 0}|${color ?? ''}`
  let u = CACHE.get(key)
  if (u) return u
  let look = null
  for (let k = 0; k < 240; k++) {
    const L = lookOf(`coach|${name}|${k}`, POS_FOR[g] ?? 'qb')
    if (L.g !== g) continue
    look = L
    if (CUTS.has(L.hair)) break
  }
  look = { ...(look ?? lookOf(`coach|${name}`, 'qb')) }
  if (!CUTS.has(look.hair)) look.hair = g === 'b' ? 'fade' : 'crew'
  if (ag >= 52) { look.hc = GREY[look.g]?.[ag >= 62 ? 1 : 0] ?? look.hc; look.brow = look.hc }
  look.wide = 0.3
  u = `data:image/svg+xml,${encodeURIComponent(faceSvg(look, { color }))}`
  if (CACHE.size > 400) CACHE.clear()
  CACHE.set(key, u)
  return u
}
// any coach on a team: the player's built coach (his own face), a real man's photo, else the drawing
//   c: a staff coach (coach.js: { n, ag, g, ... }), myHC (mine, face), or the setup's coach ({ name, face })
export function coachPhoto(c, team) {
  const color = TEAM[team]?.color
  if (!c) return null
  if (c.mine || c.face) return c.face ? faceUrl(c.face.key, c.face.pos, color) : drawnCoach(c, color)
  const name = c.n ?? c.name
  if (!c.g) { const s = shotOf(name); if (s) return s }
  return drawnCoach(c, color)
}
