// NBA Franchise: the schedule's rules on many seeds and seasons: 82 games, 41 at home, no team twice a night or three
// nights running, 11-18 back-to-backs, nothing in the All-Star break, no pair three straight, and the last day: all 30
// teams play on it (15 games), so no team's season ends before the league's does.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-sched.mjs [seeds=40]
import { makeSchedule, scheduleProblems, dateText } from '../../src/lib/franchise2/nba/schedule'
import { SHORTS, CONF_OF } from '../../src/lib/franchise2/nba/league'
const N = +(process.argv[2] ?? 40)
const seeds = ['a', 'b', 'c', 'd', 'e', 'qa2-ui', ...Array.from({ length: Math.max(0, N - 6) }, (_, i) => `sch${i}`)]
let bad = 0, early = 0, ms = 0, worst = 0
const b2bAll = [], lastN = [], inter = []
for (const seed of seeds) for (const year of [2026, 2027]) {
  const F = { seed, year }
  const t = Date.now(); makeSchedule(F); const dt = Date.now() - t; ms += dt; worst = Math.max(worst, dt)
  const P = scheduleProblems(F)
  const end = F.days - 1
  const lastOf = s => Math.max(...F.sched.filter(g => g.h === s || g.a === s).map(g => g.d))
  const e = SHORTS.filter(s => lastOf(s) < end)
  early += e.length
  const fin = F.sched.filter(g => g.d === end)
  lastN.push(fin.length); inter.push(fin.filter(g => CONF_OF[g.h] !== CONF_OF[g.a]).length)
  b2bAll.push(...Object.values(P.b2b))
  if (new Date(F.cal0 + end * 86400000).getUTCDay() !== 0) { bad++; console.log(seed, year, 'the last day is not a Sunday') }
  if (F.ddl >= F.asb[0] || F.asb[1] - F.asb[0] !== 6) { bad++; console.log(seed, year, 'deadline / break dates off', F.ddl, F.asb) }
  if (P.bad.length || e.length) { bad++; console.log(seed, year, 'BAD', P.bad.slice(0, 4).join('; '), e.length ? `· finish early: ${e.join(' ')}` : '') }
  if (seed === 'a' || seed === 'qa2-ui') console.log(seed, year, `${dt} ms, opens ${dateText(F, 0)}, deadline ${dateText(F, F.ddl)}, break ${dateText(F, F.asb[0])}-${dateText(F, F.asb[1])}, ends ${dateText(F, end)}, last day ${fin.length} games (${inter.at(-1)} interconference), b2b ${Math.min(...Object.values(P.b2b))}-${Math.max(...Object.values(P.b2b))}`)
}
const n = seeds.length * 2
console.log(`${n} schedules: ${bad} bad, teams finishing before the last day ${early}, last-day games ${Math.min(...lastN)}-${Math.max(...lastN)}, back-to-backs ${Math.min(...b2bAll)}-${Math.max(...b2bAll)} (avg ${(b2bAll.reduce((a, b) => a + b, 0) / b2bAll.length).toFixed(1)}), ${(ms / n).toFixed(0)} ms each (worst ${worst})`)
console.log(bad ? `${bad} problems` : 'no problems')
if (bad) process.exit(1)
