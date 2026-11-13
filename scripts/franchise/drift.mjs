// Does the league hold its shape over the years? Plays N seasons on the autopilot and prints, every other
// year: the best players at each position, ages, the cap and payrolls, and the season's scoring.
//   bash scripts/franchise/run.sh scripts/franchise/drift.mjs [seasons=12] [team=KC] [seed]
import * as FR from '../../src/lib/franchise/index'
import { payroll } from '../../src/lib/franchise/money'

const N = Number(process.argv[2] ?? 12), team = process.argv[3] ?? 'KC'
let F = FR.createFranchise({ team, gmName: 'Drift', seed: process.argv[4] ?? 'drift' })
const line = () => {
  const P = Object.values(F.players).filter(p => p.team)
  const top = (pos, n) => { const l = P.filter(p => p.pos === pos).map(p => p.ovr).sort((a, b) => b - a).slice(0, n); return (l.reduce((a, b) => a + b, 0) / l.length).toFixed(1) }
  const dev = [0, 0, 0, 0]; for (const p of P) dev[p.dev]++
  const pay = Object.values(F.teams).map(t => payroll(F, t))
  const o90 = P.filter(p => p.ovr >= 90).length, o95 = P.filter(p => p.ovr >= 95).length
  return `${F.year}: QB32 ${top('qb', 32)} RB32 ${top('rb', 32)} WR96 ${top('wr', 96)} TE32 ${top('te', 32)} OL160 ${top('ol', 160)} DL128 ${top('dl', 128)} LB96 ${top('lb', 96)} DB128 ${top('db', 128)} K32 ${top('k', 32)} | all ${(P.reduce((a, p) => a + p.ovr, 0) / P.length).toFixed(1)} 90+ ${o90} 95+ ${o95} | age ${(P.reduce((a, p) => a + p.age, 0) / P.length).toFixed(1)} | dev ${dev.join('/')} | cap ${F.cap.toFixed(0)} pay avg ${(pay.reduce((a, b) => a + b, 0) / 32).toFixed(0)} min ${Math.min(...pay).toFixed(0)} | fa ${F.fa.length} n ${P.length}`
}
console.log(line())
for (let y = 0; y < N; y++) {
  while (F.phase !== 'offseason') F = FR.autopilot(F, { until: 'week' })
  const st = Object.values(F.teams).map(t => t.st), g = st.reduce((a, s) => a + s.g, 0)
  const pts = (st.reduce((a, s) => a + s.pf, 0) / g).toFixed(1), py = (st.reduce((a, s) => a + s.py, 0) / g).toFixed(0), ry = (st.reduce((a, s) => a + s.ry, 0) / g).toFixed(0)
  while (F.phase === 'offseason') F = FR.advanceStage(F, { auto: true })
  if (y % 2 === 1 || y === N - 1) console.log(line(), `| last season: ${pts} pts, ${py} pass, ${ry} rush`)
}
