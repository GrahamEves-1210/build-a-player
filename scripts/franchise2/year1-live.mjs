// Year one against the live 2026 season: each team's OVR and its simulated year-one record, against its real 2026
// record so far (ratings.js SEASON_2026). The year-one carry-over should steer the sim toward it, not copy it.
//   bash scripts/franchise2/run.sh scripts/franchise2/year1-live.mjs [seasons=12]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { SEASON_2026 } from '../../src/lib/franchise2/ratings'
FR.useContracts(CONTRACTS)
const N = Number(process.argv[2] ?? 12)
const mean = a => a.reduce((x, y) => x + y, 0) / a.length
const corr = (x, y) => { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2 } return a / Math.sqrt(b * c) }
const live = s => { const r = SEASON_2026?.[s]; return r ? (r[0] + r[2] / 2) / (r[0] + r[1] + r[2]) : null }
const wins = Object.fromEntries(FR.SHORTS.map(s => [s, []]))
let ovr = null
for (let k = 0; k < N; k++) {
  const F = FR.createFranchise({ seed: `y1-${k}`, team: 'DEN', owner: 'Graham', builds: [] })
  if (!ovr) ovr = Object.fromEntries(FR.SHORTS.map(s => [s, FR.strength(F, s).ovr]))
  for (let w = 0; F.phase === 'season' && w < 40; w++) { if (F.ev) FR.chooseEvent(F, 0); FR.playWeek(F, { moments: false }) }
  const recs = FR.records(F)
  for (const s of FR.SHORTS) wins[s].push(recs[s].w + recs[s].t / 2)
}
const S = FR.SHORTS.filter(s => live(s) != null)
const avgW = s => mean(wins[s])
console.log(`OVR vs live 2026 win% r ${corr(S.map(s => ovr[s]), S.map(live)).toFixed(2)} · sim year-one wins vs live win% r ${corr(S.map(avgW), S.map(live)).toFixed(2)} (${N} seasons)`)
const rows = S.map(s => ({ s, o: ovr[s], w: avgW(s), l: live(s), r: SEASON_2026[s] })).sort((a, b) => b.l - a.l)
console.log(rows.map(t => `${t.s.padEnd(4)}${String(t.o).padStart(3)} OVR  sim ${t.w.toFixed(1).padStart(4)} W  live ${t.r[0]}-${t.r[1]}${t.r[2] ? '-' + t.r[2] : ''} (${Math.round(t.l * 17)} W pace)`).join('\n'))
console.log('JSON ' + JSON.stringify(Object.fromEntries(rows.map(t => [t.s, [t.o, +t.w.toFixed(1)]]))))
