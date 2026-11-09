// Same seed, same season, whatever ran before it: node scripts/baseball/repro-check.mjs
// Runs a set of seeded seasons fresh (first thing in the process), then plays 50 other seasons (batters, pitchers,
// all-time, career, fast, squad), then runs the same seeds again. The JSON must be byte-identical: the worker
// re-simulates seeded seasons to verify leaderboard rows, so nothing that ran earlier may change a result.
import { load } from './bundle.mjs'
import { createHash } from 'crypto'

const { S, teams } = await load()
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const BT = S.BAT_TRAITS, PT = S.PIT_TRAITS
const mk = (keys, v) => Object.fromEntries(keys.map((k, i) => [k, { type: k, val: Math.max(1, Math.min(11, v + ((i * 7) % 3) - 1)) }]))
const short = i => teams[i % teams.length].short
const CASES = [
  ['bat-current', () => S.runBaseballSimulation(mk(BT, 8), BT, { short: short(3) }, 'bat', 'current', 'repro-1')],
  ['pit-current', () => S.runBaseballSimulation(mk(PT, 8), PT, { short: short(7) }, 'pit', 'current', 'repro-2')],
  ['bat-alltime', () => S.runBaseballSimulation(mk(BT, 7), BT, { short: short(11) }, 'bat', 'alltime', 'repro-3', 'all-time')],
  ['pit-closer', () => S.runBaseballSimulation(mk(PT, 7), PT, { short: short(2), role: 'CL' }, 'pit', 'current', 'repro-4')],
  ['bat-career', () => S.runBaseballSimulation(mk(BT, 6), BT, { short: short(5), career: true, off: 5.2, def: 6.1, role: 'SS', usage: 1, order: 3, rookie: true, age: 22, year: 2027 }, 'bat', 'current', 'repro-5')],
  ['pit-career-fast', () => S.runBaseballSimulation(mk(PT, 9), PT, { short: short(9), career: true, fast: true, off: 6, def: 5, role: 'SP', slot: 1, age: 27, year: 2030 }, 'pit', 'current', 'repro-6')],
]
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
const fresh = CASES.map(([name, f]) => [name, hash(f())])
// 50 other seasons, every kind
for (let i = 0; i < 50; i++) {
  const pit = i % 2 === 1, types = pit ? PT : BT, kind = i % 5
  const team = { short: short(i * 7 + 1), ...(kind === 3 ? { career: true, off: 3 + (i % 7), def: 4 + (i % 5), role: pit ? (i % 3 ? 'SP' : 'RP') : 'CF', usage: 0.8, age: 20 + (i % 15), year: 2026 + i } : {}), ...(kind === 4 ? { career: true, fast: true } : {}) }
  S.runBaseballSimulation(mk(types, 3 + (i % 8)), types, team, pit ? 'pit' : 'bat', kind === 2 ? 'alltime' : 'current', i % 9 === 0 ? null : `noise-${i}`, kind === 2 ? 'all-time' : 'classic')
  if (i % 10 === 0 && S.scriptBaseballSeason) S.scriptBaseballSeason({ short: short(i) }, { off: 6, def: 6 }, `squad-${i}`)
}
const after = CASES.map(([name, f]) => [name, hash(f())])
let ok = true
for (let i = 0; i < CASES.length; i++) {
  const same = fresh[i][1] === after[i][1]
  ok = ok && same
  console.log(`${fresh[i][0].padEnd(16)} fresh ${fresh[i][1]}  after 50 ${after[i][1]}  ${same ? 'same' : 'DIFFERENT'}`)
}
console.log(ok ? 'reproducible: OK' : 'reproducible: FAILED')
process.exit(ok ? 0 : 1)
