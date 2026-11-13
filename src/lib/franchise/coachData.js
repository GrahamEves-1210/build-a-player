// FRANCHISE: where the coaches come from.
//
// Every team's real head coach, offensive coordinator and defensive coordinator live in src/data/nfl-coaches.js
// (NFL_COACHES = [{ name, team, role: 'HC' | 'OC' | 'DC', attrs }], COACH_TYPES), five 0-11 ratings each. That
// file is being researched by another agent. Until it is in the repo the engine plays on PLACEHOLDERS of the
// same shape: one HC, OC and DC a team, named by the job ("KC Head Coach"), ratings set from the team's own
// offense and defense grades, every row marked placeholder: true so the UI can say so.
//
// The real file is picked up by itself the moment it exists: Vite reads the glob below at build time (an empty
// object when there is no file). Node runs of the engine (scripts/franchise) call useCoachData() with the file
// when it is there.
import { NFL_TEAMS } from '../../data/nfl-teams'
import { clamp } from './consts'
import { rngOf } from './rng'

export const COACH_TYPES = ['talentDev', 'offPlaycalling', 'defPlaycalling', 'culture', 'situational']
export const COACH_LABEL = { talentDev: 'TALENT DEVELOPMENT', offPlaycalling: 'OFFENSIVE PLAYCALLING', defPlaycalling: 'DEFENSIVE PLAYCALLING', culture: 'CULTURE BUILDING', situational: 'SITUATIONAL AWARENESS' }
export const COACH_SHORT = { talentDev: 'DEV', offPlaycalling: 'OFF', defPlaycalling: 'DEF', culture: 'CUL', situational: 'SIT' }
export const ROLE_NAME = { HC: 'Head Coach', OC: 'Offensive Coordinator', DC: 'Defensive Coordinator' }

function placeholders() {
  const out = []
  for (const t of NFL_TEAMS) {
    const R = rngOf(`coach-placeholder-${t.short}`)
    const g = (base, sd = 1.3) => clamp(Math.round(base + R.n() * sd), 1, 10)
    const off = 3.2 + t.off * 0.42, def = 3.2 + t.def * 0.42, both = (off + def) / 2
    out.push({ name: `${t.short} Head Coach`, team: t.short, role: 'HC', placeholder: true, attrs: { talentDev: g(both), offPlaycalling: g(off - 0.4), defPlaycalling: g(def - 0.4), culture: g(both + 0.3), situational: g(both) } })
    out.push({ name: `${t.short} Offensive Coordinator`, team: t.short, role: 'OC', placeholder: true, attrs: { talentDev: g(5), offPlaycalling: g(off + 0.5), defPlaycalling: g(2.5, 1), culture: g(5), situational: g(5) } })
    out.push({ name: `${t.short} Defensive Coordinator`, team: t.short, role: 'DC', placeholder: true, attrs: { talentDev: g(5), offPlaycalling: g(2.5, 1), defPlaycalling: g(def + 0.5), culture: g(5), situational: g(5) } })
  }
  return out
}

let found = {}
try { found = import.meta.glob('../../data/nfl-coaches.js', { eager: true }) } catch { found = {} }
let REAL = Object.values(found)[0]?.NFL_COACHES ?? null
// (Node: hand the engine the real list; null goes back to placeholders)
export function useCoachData(list) { REAL = Array.isArray(list) && list.length ? list : null }
export const coachDataIsReal = () => !!REAL

const clean = c => ({ name: String(c.name), team: c.team ?? null, role: ['HC', 'OC', 'DC'].includes(c.role) ? c.role : 'OC', placeholder: !!c.placeholder,
  attrs: Object.fromEntries(COACH_TYPES.map(t => [t, clamp(Math.round(Number(c.attrs?.[t] ?? 5)), 0, 11)])) })
// The list the league is built from: the real file when it is there, with a placeholder for any team's job it
// leaves open (so every team always has all three)
export function coachRows() {
  const base = placeholders()
  if (!REAL) return base
  const real = REAL.filter(c => c && c.name && c.attrs).map(clean)
  const has = new Set(real.filter(c => c.team).map(c => `${c.team}-${c.role}`))
  return [...real, ...base.filter(c => !has.has(`${c.team}-${c.role}`))]
}
