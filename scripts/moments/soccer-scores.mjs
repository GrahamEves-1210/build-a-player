// Soccer tie scorelines with a moment in them (QA 2026-11-25): do the legs look like football? For each matchup band
// and hit rate: the lean before the moment (dPre - d), goals a leg, ties won by four or more, a leg with five-plus,
// and moments that came up with the tie already gone (three or more down or up on aggregate).
// node scripts/moments/soccer-scores.mjs [rounds]
import { planMoment, playMoment } from '../../src/lib/inGame.js'
import { seeded } from '../../src/lib/rng.js'
const N = Number(process.argv[2] ?? 4000)
const POOL = ['penalty', 'one-on-one', 'header', 'volley', 'free-kick', 'two-on-one']
console.log('   p    hr  lean  goals/leg  rout4+  leg5+  dead-moment')
let bad = 0
for (const p of [0.25, 0.4, 0.5, 0.6, 0.75, 0.82]) for (const hr of [0.5, 0.68, 0.86]) {
  let g = 0, legsN = 0, rout = 0, five = 0, dead = 0, lean = 0
  for (let i = 0; i < N; i++) {
    const ctx = { sport: 'soccer', seed: `sc-${p}-${hr}-${i}`, pGame: p, pool: POOL, used: [], hOf: () => hr, us: 'AAA', them: 'BBB', legs: i % 3 === 0 ? 1 : 2, home: i % 3 === 0 ? null : i % 2 === 0 }
    const plan = planMoment(ctx)
    lean += plan.M.d - plan.dPre
    const agg = plan.mine - plan.opp + (plan.leg1 ? plan.leg1[0] - plan.leg1[1] : 0)
    if (Math.abs(agg) >= 3) dead++
    const res = playMoment(plan, seeded(`u-${ctx.seed}`)() < hr)
    for (const l of res.legs) { g += l[0] + l[1]; legsN++; if (l[0] >= 5 || l[1] >= 5) five++ }
    if (Math.abs(res.mine - res.opp) >= 4) rout++
  }
  const row = [p, hr, (lean / N).toFixed(2), (g / legsN).toFixed(2), (rout / N * 100).toFixed(1) + '%', (five / legsN * 100).toFixed(1) + '%', (dead / N * 100).toFixed(1) + '%']
  if (g / legsN > 3.4 || rout / N > 0.12 || dead / N > 0.05) bad++
  console.log(row.map(x => String(x).padStart(6)).join(' '))
}
console.log(bad ? `${bad} bands off` : 'scorelines: OK')
