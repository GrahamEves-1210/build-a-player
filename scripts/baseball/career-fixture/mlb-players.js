// TEST FIXTURE (career agent): stand-ins for src/data/mlb-batters.js, mlb-pitchers.js and the legends, made up from
// each club's strength so a node run has rosters to play with. Only used while the real data is missing.
import { MLB_TEAMS } from './mlb-teams.js'
const rng = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 } }
const FIRST = ['Aaron', 'Bobby', 'Carlos', 'Dylan', 'Eli', 'Felix', 'Gunnar', 'Hector', 'Ivan', 'Jose', 'Kyle', 'Luis', 'Matt', 'Nolan', 'Oscar', 'Pete', 'Rafael', 'Shane', 'Tyler', 'Vlad', 'Will', 'Yordan', 'Zack', 'Corbin']
const LAST = ['Alvarez', 'Bichette', 'Castro', 'Diaz', 'Estrada', 'Franco', 'Garcia', 'Hayes', 'Iglesias', 'Jansen', 'Kirk', 'Lowe', 'Machado', 'Nimmo', 'Ortiz', 'Perez', 'Quintana', 'Rojas', 'Suarez', 'Torres', 'Urias', 'Vargas', 'Walker', 'Young']
const BAT = ['contact', 'power', 'eye', 'avoidK', 'gap', 'speed', 'baserunning', 'fielding', 'arm', 'clutch']
const PIT = ['velocity', 'movement', 'breaking', 'changeup', 'control', 'command', 'stamina', 'groundball', 'composure', 'pitchIQ']
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const make = (t, kind, i, legend = false) => {
  const r = rng(`${t.short}-${kind}-${i}-${legend}`)
  const base = (kind === 'bat' ? t.off : t.def) * 0.6 + 2.6 + (legend ? 2 : 0) - i * 0.25
  const keys = kind === 'bat' ? BAT : PIT
  const attrs = Object.fromEntries(keys.map(k => [k, clamp(Math.round(base + (r() - 0.5) * 5), 1, 11)]))
  if (kind === 'pit') attrs.stamina = i < 4 ? clamp(attrs.stamina + 2, 1, 11) : clamp(attrs.stamina - 4, 1, 11)
  const role = kind === 'bat' ? ['CF', 'SS', '1B', 'RF', 'C', 'DH'][i] : i < 4 ? 'SP' : i === 4 ? 'CL' : 'RP'
  const name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}${legend ? ' Sr.' : ''}`
  return { name, short: name.split(' ').pop(), team: t.short, number: 1 + Math.floor(r() * 70), height: 70 + Math.floor(r() * 8), weight: 180 + Math.floor(r() * 60), age: legend ? 30 : 23 + Math.floor(r() * 12), bats: r() < 0.3 ? 'L' : 'R', throws: r() < 0.25 ? 'L' : 'R', skin: ['#8d5a3b', '#c09060', '#f0c4a0'][Math.floor(r() * 3)], espn: null, starter: i === (kind === 'bat' ? 2 : 0), role, attrs, ...(legend ? { years: '1990-2005' } : {}) }
}
export const MLB_BATTERS = MLB_TEAMS.flatMap(t => [0, 1, 2, 3, 4, 5].map(i => make(t, 'bat', i)))
export const MLB_PITCHERS = MLB_TEAMS.flatMap(t => [0, 1, 2, 3, 4, 5].map(i => make(t, 'pit', i)))
export const MLB_LEGEND_BATTERS = MLB_TEAMS.flatMap(t => [0, 1].map(i => make(t, 'bat', i, true)))
export const MLB_LEGEND_PITCHERS = MLB_TEAMS.flatMap(t => [0, 1].map(i => make(t, 'pit', i, true)))
