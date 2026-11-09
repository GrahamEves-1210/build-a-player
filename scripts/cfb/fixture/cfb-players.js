// TEST FIXTURE ONLY (scripts/cfb): stands in for src/data/cfb-players.js until the data agent's file exists.
// Synthetic players (one starting QB, two RBs, four WRs a team) with the NFL trait keys and grades
// that follow the team's strength. Names are placeholders, never shipped.
import { CFB_TEAMS } from './cfb-teams.js'

const QB_T = ['arm', 'legs', 'size', 'processing', 'leadership', 'vision', 'playmaking', 'accuracy', 'pocket-presence']
const RB_T = ['speed', 'burst', 'strength', 'size', 'balance', 'elusiveness', 'vision', 'hands', 'carrying']
const WR_T = ['speed', 'bodyControl', 'vertical', 'routeRunning', 'release', 'hands', 'awareness', 'size', 'afterCatch']
const YEARS = ['FR', 'SO', 'RS-SO', 'JR', 'RS-JR', 'SR', 'RS-SR']

function rngFor(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = h >>> 0
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const make = (types, team, pos, i, base) => {
  const r = rngFor(`${team.short}-${pos}-${i}`)
  const attrs = Object.fromEntries(types.map(t => [t, Math.max(1, Math.min(11, Math.round(base + (r() + r() + r() - 1.5) * 3.2)))]))
  return {
    name: `${team.name} ${pos.toUpperCase()}${i + 1}`, short: `${team.short} ${pos.toUpperCase()}${i + 1}`,
    team: team.short, conf: team.conf, year: YEARS[Math.floor(r() * YEARS.length)], espn: null,
    starter: i === 0 || (pos === 'wr' && i < 3), color: team.color, color2: team.color2, attrs,
  }
}
const lvl = t => 4.2 + ((t.off + t.def) / 2 - 5.5) * 2.2
export const CFB_QBS = CFB_TEAMS.flatMap(t => [make(QB_T, t, 'qb', 0, lvl(t) + 0.5), make(QB_T, t, 'qb', 1, lvl(t) - 1)])
export const CFB_RBS = CFB_TEAMS.flatMap(t => [0, 1].map(i => make(RB_T, t, 'rb', i, lvl(t) + 0.3 - i)))
export const CFB_WRS = CFB_TEAMS.flatMap(t => [0, 1, 2, 3].map(i => make(WR_T, t, 'wr', i, lvl(t) + 0.4 - i * 0.6)))
