// Plays seasons on the autopilot and prints what happened. bash scripts/franchise/run.sh scripts/franchise/season-smoke.mjs [seasons] [team]
import * as FR from '../../src/lib/franchise/index'
const N = Number(process.argv[2] ?? 1), team = process.argv[3] ?? 'DEN'
let F = FR.createFranchise({ team, gmName: 'Graham', seed: 'season-smoke' })
for (let y = 0; y < N; y++) {
  const t0 = performance.now()
  let weeks = 0, wk = 0
  while (F.phase !== 'offseason') { const a = performance.now(); F = FR.autopilot(F, { until: 'week' }); wk = Math.max(wk, performance.now() - a); weeks++ }
  const t1 = performance.now()
  const h = FR.history(F).seasons[0]
  console.log(`${h.year}: ${h.champion.short} beat ${h.runnerUp.short} ${h.score}; MVP ${h.awards.MVP?.name} (${h.awards.MVP?.line}); DPOY ${h.awards.DPOY?.name} (${h.awards.DPOY?.line}); ${team} ${h.user.record} ${h.user.finish}; security ${Math.round(F.gm.security)}; ${weeks} weeks ${(t1 - t0).toFixed(0)} ms (worst ${wk.toFixed(0)})`)
  const o0 = performance.now()
  let stages = 0
  while (F.phase === 'offseason') { F = FR.advanceStage(F, { auto: true }); stages++ }
  console.log(`   offseason ${stages} stages ${(performance.now() - o0).toFixed(0)} ms; players ${Object.keys(F.players).length} fa ${F.fa.length}; cap ${F.cap}; save ${(FR.packFranchise(F).length * 2 / 1024).toFixed(0)} KB`)
}
