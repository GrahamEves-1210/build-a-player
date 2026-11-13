// A quick look at a new league: rosters, money, the schedule. bash scripts/franchise/run.sh scripts/franchise/smoke.mjs
import { buildLeague } from '../../src/lib/franchise/league'
import { scheduleProblems } from '../../src/lib/franchise/schedule'
import { payroll } from '../../src/lib/franchise/money'
import { teamRating, rosterProblems } from '../../src/lib/franchise/core'
import { slotOf, ROSTER_MAX } from '../../src/lib/franchise/consts'

const t0 = performance.now()
const F = buildLeague({ team: process.argv[2] ?? 'KC', gmName: 'Test GM', seed: 'smoke-1' })
console.log('built in', (performance.now() - t0).toFixed(0), 'ms; players', Object.keys(F.players).length, 'FA', F.fa.length, 'coaches', Object.keys(F.coaches).length)
console.log('schedule problems', scheduleProblems(F.sched.weeks, F.sched.bye))
const rows = Object.values(F.teams).map(t => ({ s: t.short, n: t.roster.length, pay: payroll(F, t), ...teamRating(F, t), probs: rosterProblems(F, t, ROSTER_MAX).length }))
rows.sort((a, b) => b.ovr - a.ovr)
console.log(rows.map(r => `${r.s} n${r.n} $${r.pay.toFixed(0)} off${r.off} def${r.def} ovr${r.ovr}${r.probs ? ' PROBLEMS' : ''}`).join('\n'))
console.log('cap', F.cap, 'avg payroll', (rows.reduce((s, r) => s + r.pay, 0) / 32).toFixed(1), 'max', Math.max(...rows.map(r => r.pay)).toFixed(1), 'min', Math.min(...rows.map(r => r.pay)).toFixed(1))
const top = Object.values(F.players).filter(p => p.team).sort((a, b) => b.con.sal - a.con.sal).slice(0, 25)
console.log(top.map(p => `${p.name} ${slotOf(p)} ${p.ovr} age${p.age} $${p.con.sal}x${p.con.yrs} g${p.con.guar} dev${p.dev}`).join('\n'))
const dev = [0, 0, 0, 0]
for (const p of Object.values(F.players)) dev[p.dev]++
console.log('dev tiers', dev)
const ages = {}
for (const p of Object.values(F.players)) if (p.team) ages[p.age] = (ages[p.age] ?? 0) + 1
console.log('ages', JSON.stringify(ages))
console.log('json size', JSON.stringify(F).length)
