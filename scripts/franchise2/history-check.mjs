// The real team histories (realHistory.js), checked against themselves: every team every season, the games add up
// (wins = losses league-wide, 16 or 17 a team), one champion and one runner-up, the right number of playoff teams and
// of each exit, every division winner with its division's best record, the Super Bowl list matching the seasons,
// and 2025 matching lastSeason.js.
//   bash scripts/franchise2/run.sh scripts/franchise2/history-check.mjs [team]
import { REAL, SUPER_BOWLS, realSeasons, realTitles } from '../../src/lib/franchise2/realHistory'
import { lastSeason } from '../../src/lib/franchise2/lastSeason'
import { SHORTS } from '../../src/lib/franchise2/league'
import { DIVISIONS, CONF_OF } from '../../src/lib/franchise2/schedule'
const bad = []
for (const [y, R] of Object.entries(REAL)) {
  const yr = +y, G = yr >= 2021 ? 17 : 16
  const miss = SHORTS.filter(s => !R[s]); if (miss.length) bad.push(`${y} missing ${miss}`)
  if (Object.keys(R).length !== 32) bad.push(`${y} has ${Object.keys(R).length} teams`)
  let W = 0, L = 0, T = 0
  for (const [s, r] of Object.entries(R)) { W += r.w; L += r.l; T += r.t; if (r.w + r.l + r.t !== G - (yr === 2022 && (s === 'BUF' || s === 'CIN') ? 1 : 0)) bad.push(`${y} ${s} ${r.w}-${r.l}-${r.t} is not ${G} games`) }
  // (2022: Buffalo at Cincinnati was never finished, so those two played 16)
  if (W !== L) bad.push(`${y} wins ${W} losses ${L}`); if (T % 2) bad.push(`${y} ties ${T}`)
  const fins = {}; for (const r of Object.values(R)) fins[r.fin] = (fins[r.fin] ?? 0) + 1
  const want = yr >= 2020 ? { champ: 1, sb: 1, conf: 2, div: 4, wc: 6 } : { champ: 1, sb: 1, conf: 2, div: 4, wc: 4 }
  for (const [k, n] of Object.entries(want)) if ((fins[k] ?? 0) !== n) bad.push(`${y} ${k} ${fins[k] ?? 0} (want ${n})`)
  for (const c of ['AFC', 'NFC']) {
    const po = SHORTS.filter(s => CONF_OF[s] === c && R[s].fin !== 'out')
    if (po.length !== (yr >= 2020 ? 7 : 6)) bad.push(`${y} ${c} playoff teams ${po.length}`)
    if (po.filter(s => ['champ', 'sb'].includes(R[s].fin)).length !== 1) bad.push(`${y} ${c} has no single Super Bowl team`)
  }
  for (const d of DIVISIONS) {
    const win = d.teams.filter(s => R[s].div)
    if (win.length !== 1) { bad.push(`${y} ${d.name} winners ${win}`); continue }
    const pct = s => (R[s].w + R[s].t / 2) / (R[s].w + R[s].l + R[s].t)
    if (d.teams.some(s => pct(s) > pct(win[0]))) bad.push(`${y} ${d.name}: ${win[0]} won it with a worse record`)
    if (R[win[0]].fin === 'out') bad.push(`${y} ${win[0]} won the division and missed the playoffs`)
  }
  const sb = SUPER_BOWLS.find(x => x[0] === yr)
  if (!sb || R[sb[1]].fin !== 'champ' || R[sb[2]].fin !== 'sb') bad.push(`${y} Super Bowl list doesn't match the season`)
}
for (const s of SHORTS) {
  const r = REAL[2025][s], x = lastSeason(s)
  const end = { champ: 'WON SUPER BOWL LX', sb: 'LOST SUPER BOWL LX', conf: `LOST ${CONF_OF[s]} CHAMPIONSHIP`, div: 'LOST DIVISIONAL', wc: 'LOST WILD CARD', out: 'MISSED PLAYOFFS' }[r.fin]
  if (r.w !== x.w || r.l !== x.l || r.t !== x.t || r.div !== x.div || end !== x.end) bad.push(`2025 ${s}: ${r.w}-${r.l}-${r.t} ${r.fin}${r.div ? ' D' : ''} vs lastSeason ${x.rec} ${x.end}${x.div ? ' D' : ''}`)
}
const t = process.argv[2]
if (t) { console.log(t, realTitles(t)); for (const r of realSeasons(t)) console.log(r.y, `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`, r.div ? 'DIV' : '', r.fin) }
console.log(`${Object.keys(REAL).length} seasons · ${SUPER_BOWLS.length} Super Bowls`)
console.log(bad.length ? bad.join('\n') + `\n${bad.length} PROBLEMS` : 'OK: no problems')
if (bad.length) process.exit(1)
