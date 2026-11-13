// FRANCHISE: where the coaches come from.
//
// Every team's real head coach, offensive coordinator and defensive coordinator, and a market of real coaches
// who are out of the league, live in src/data/nfl-coaches.js (NFL_COACHES, COACH_FREE_AGENTS): five 0-11
// ratings each, and who calls the plays. The engine reads them as they are. A team's job the file leaves
// open (there is none today) gets a placeholder of the same shape, named by the job and marked placeholder:
// true, so every team always has all three.
import { NFL_COACHES, COACH_FREE_AGENTS, COACH_TYPES as DATA_TYPES, COACH_ATTR } from '../../data/nfl-coaches'
import { NFL_TEAMS } from '../../data/nfl-teams'
import { clamp } from './consts'
import { rngOf } from './rng'

export const COACH_TYPES = DATA_TYPES ?? ['talentDev', 'offPlaycalling', 'defPlaycalling', 'culture', 'situational']
export const COACH_LABEL = { talentDev: 'TALENT DEVELOPMENT', offPlaycalling: 'OFFENSIVE PLAYCALLING', defPlaycalling: 'DEFENSIVE PLAYCALLING', culture: 'CULTURE BUILDING', situational: 'SITUATIONAL AWARENESS' }
export const COACH_SHORT = { talentDev: 'DEV', offPlaycalling: 'OFF', defPlaycalling: 'DEF', culture: 'CUL', situational: 'SIT' }
export const ROLE_NAME = { HC: 'Head Coach', OC: 'Offensive Coordinator', DC: 'Defensive Coordinator' }
export { COACH_ATTR }

// A coach's overall, 0-99: the data file's own formula (its header), so a built coach reads on the same scale.
//   head coach:   0.26 culture + 0.22 situational + 0.18 talent development + 0.24 his better play-calling side + 0.10 the other
//   coordinator:  0.50 his own side's play-calling + 0.20 talent development + 0.15 situational + 0.10 culture + 0.05 the other side
// `a`: his ratings ({ talentDev: 7, … }) or a build ({ talentDev: { val: 7 }, … })
export function coachOvr(a, role = 'HC') {
  const v = k => { const x = a?.[k]; return typeof x === 'number' ? x : typeof x?.val === 'number' ? x.val : 5 }
  const off = v('offPlaycalling'), def = v('defPlaycalling')
  const c = role === 'HC' ? 0.26 * v('culture') + 0.22 * v('situational') + 0.18 * v('talentDev') + 0.24 * Math.max(off, def) + 0.10 * Math.min(off, def)
    : 0.50 * (role === 'OC' ? off : def) + 0.20 * v('talentDev') + 0.15 * v('situational') + 0.10 * v('culture') + 0.05 * (role === 'OC' ? def : off)
  return clamp(Math.round(46 + 5.1 * c), 0, 99)
}

function placeholders() {
  const out = []
  for (const t of NFL_TEAMS) {
    const R = rngOf(`coach-placeholder-${t.short}`)
    const g = (base, sd = 1.3) => clamp(Math.round(base + R.n() * sd), 1, 10)
    const off = 3.2 + t.off * 0.42, def = 3.2 + t.def * 0.42, both = (off + def) / 2
    out.push({ name: `${t.short} Head Coach`, team: t.short, role: 'HC', placeholder: true, attrs: { talentDev: g(both), offPlaycalling: g(off - 0.4), defPlaycalling: g(def - 0.4), culture: g(both + 0.3), situational: g(both) } })
    out.push({ name: `${t.short} Offensive Coordinator`, team: t.short, role: 'OC', placeholder: true, calls: true, attrs: { talentDev: g(5), offPlaycalling: g(off + 0.5), defPlaycalling: g(2.5, 1), culture: g(5), situational: g(5) } })
    out.push({ name: `${t.short} Defensive Coordinator`, team: t.short, role: 'DC', placeholder: true, calls: true, attrs: { talentDev: g(5), offPlaycalling: g(2.5, 1), defPlaycalling: g(def + 0.5), culture: g(5), situational: g(5) } })
  }
  return out
}

let REAL = [...(NFL_COACHES ?? []), ...(COACH_FREE_AGENTS ?? [])]
// (the checks can hand the engine another list, or none: null plays on placeholders)
export function useCoachData(list) { REAL = Array.isArray(list) ? list : [] }
export const coachDataIsReal = () => REAL.length > 0

const clean = c => ({
  name: String(c.name), team: c.team ?? null, role: ['HC', 'OC', 'DC'].includes(c.role) ? c.role : 'OC', placeholder: !!c.placeholder,
  age: typeof c.age === 'number' ? c.age : null, since: c.since ?? null, calls: c.calls ?? null, side: c.side ?? null, interim: !!c.interim, title: c.title ?? null,
  attrs: Object.fromEntries(COACH_TYPES.map(t => [t, clamp(Math.round(Number(c.attrs?.[t] ?? 5)), 0, 11)])),
})
// The list the league is built from: the real coaches, with a placeholder for any team's job left open
export function coachRows() {
  const real = REAL.filter(c => c && c.name && c.attrs).map(clean)
  const has = new Set(real.filter(c => c.team).map(c => `${c.team}-${c.role}`))
  return [...real, ...placeholders().filter(c => !has.has(`${c.team}-${c.role}`)).map(clean)]
}
