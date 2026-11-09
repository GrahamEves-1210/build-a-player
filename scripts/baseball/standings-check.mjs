// The clubs' simulated records against their real 2026 ones (mlb-teams.js y2026, when the data has it):
// node scripts/baseball/standings-check.mjs [seasons=40]. No build: each season a club's own ratings (a script).
import { load } from './bundle.mjs'
const { S, teams } = await load()
const N = Number(process.argv[2] ?? 40)
const acc = Object.fromEntries(teams.map(t => [t.short, { w: 0, rs: 0, ra: 0, po: 0, ws: 0 }]))
const sixth = []
for (let i = 0; i < N; i++) {
  const t = teams[i % teams.length]
  const sc = S.scriptBaseballSeason({ short: t.short }, { off: t.off, def: t.def }, `st-${i}`)
  const r = S.runBaseballSimulation({}, null, { short: t.short }, 'bat', 'current', `st-${i}`, 'check', sc)
  for (const lg of ['AL', 'NL']) for (const row of Object.values(r.divisions[lg]).flat()) {
    const a = acc[row.short]; a.w += row.wins; a.rs += row.rs; a.ra += row.ra; a.po += row.seed ? 1 : 0
    if (row.seed === 6) sixth.push(row.wins)
  }
  if (r.wsWinner) acc[r.wsWinner].ws++
}
const rows = teams.map(t => ({ t, ...acc[t.short] })).sort((a, b) => b.w - a.w)
let se = 0, n = 0
console.log('club  off def   sim W  RS/G  RA/G  October  titles   real 2026 W')
for (const r of rows) {
  const real = r.t.y2026?.w
  if (real != null) { se += (r.w / N - real) ** 2; n++ }
  console.log(`${r.t.short.padEnd(5)} ${String(r.t.off).padStart(3)} ${String(r.t.def).padStart(3)}   ${(r.w / N).toFixed(1).padStart(5)}  ${(r.rs / N / 162).toFixed(2)}  ${(r.ra / N / 162).toFixed(2)}  ${((r.po / N) * 100).toFixed(0).padStart(5)}%  ${((r.ws / N) * 100).toFixed(0).padStart(4)}%   ${real ?? '-'}`)
}
const sd = Math.sqrt(rows.reduce((s, r) => s + (r.w / N - 81) ** 2, 0) / rows.length)
console.log(`the 6th seed ${(sixth.reduce((a, b) => a + b, 0) / sixth.length).toFixed(1)} wins; spread of the clubs' average wins ${sd.toFixed(1)}${n ? `; rms off their real 2026 record ${Math.sqrt(se / n).toFixed(1)} wins` : ''}`)
