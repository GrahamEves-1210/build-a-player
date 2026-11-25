// NBA Franchise: dynasties. Seasons played out with the GM's team auto-run; the champions, and each year's champion's
// core (its best four: OVR, age, salary, years left) and its payroll against the tax and aprons.
// And the league's health, a line a season and the averages at the end: the teams that pay the tax and finish past
// each apron, the biggest payroll against the second apron, the trades (in the season and in the summer), the men
// rated 85+ and 90+, the best and worst records, the GM's team's own season.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-dynasty.mjs [seasons=10] [seed=a] [team=BOS] [watch=SAS]
import * as N from '../../src/lib/franchise2/nba/index'
const Y = +(process.argv[2] ?? 10), SEED = process.argv[3] ?? 'a', TEAMX = process.argv[4] ?? 'BOS', WATCH = process.argv[5] ?? 'SAS'
const F = N.createNbaFranchise({ seed: 'dyn-' + SEED, team: TEAMX, owner: 'G' })
const champs = []
const t0 = Date.now()
const C = N.CAP_SIM
const H = []   // a season's health: { y, tax, a1, a2, top, a2line, trS, trO, n85, n90, best, worst, gm }
let seenTr = F.trn ?? 0
const newTrades = () => { const n = (F.trn ?? 0) - seenTr; seenTr = F.trn ?? 0; return n }
const top = s => F.teams[s].r.slice().sort((a, b) => b.o - a.o).slice(0, 4).map(p => `${p.n.split(' ').pop()} ${p.o}/${p.ag} $${(p.$ ?? 0).toFixed(0)}x${p.y}`).join(', ')
const cap = s => { const x = N.CAP_SIM.capSheet(F, s); return `$${x.pay.toFixed(0)} ${x.over}` }
for (let y = 0; y < Y; y++) {
  const men0 = N.SHORTS.flatMap(s => F.teams[s].r.filter(p => !p.tw))
  const n85 = men0.filter(p => p.o >= 85).length, n90 = men0.filter(p => p.o >= 90).length
  N.simTo(F, F.days)
  const trS = newTrades()
  // (the books as the regular season ends: what the tax is assessed on)
  const yr = F.year, pays = N.SHORTS.map(s => C.payroll(F, s, yr))
  const tax = pays.filter(v => v > C.taxOf(yr)).length, a1 = pays.filter(v => v > C.apron1Of(yr)).length, a2 = pays.filter(v => v > C.apron2Of(yr)).length
  N.startPostseason(F); N.simPostseason(F)
  const c = F.po.champ
  champs.push(c)
  const R = N.records(F)
  const ws = N.SHORTS.map(s => R[s].w).sort((x, y) => y - x)
  const made = [...(F.po.final?.E ?? []), ...(F.po.final?.W ?? [])].includes(F.team)
  const h = { y: yr, tax, a1, a2, top: Math.max(...pays), a2line: C.apron2Of(yr), trS, trO: 0, n85, n90, best: ws[0], worst: ws[ws.length - 1], gm: `${N.recText(R[F.team])}${made ? ' (playoffs)' : ''}` }
  H.push(h)
  const best = N.SHORTS.slice().sort((a, b) => R[b].w - R[a].w)[0]
  console.log(`${F.year} ${c} (${N.recText(R[c])}) ovr ${N.teamOvr(F, c)} ${cap(c)} | ${top(c)} | best record ${best} ${N.recText(R[best])}`)
  if (WATCH !== c) console.log(`   ${WATCH} ${N.recText(R[WATCH])} ovr ${N.teamOvr(F, WATCH)} ${cap(WATCH)} | ${top(WATCH)}`)
  N.closeSeason(F)
  while (F.phase === 'off') {
    if (F.off.step === 'camp') {
      const T = F.teams[F.team]
      while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i)
      for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
    }
    N.nextStep(F)
  }
  h.trO = newTrades()
  console.log(`   health ${h.y}: taxpayers ${h.tax}, past the first apron ${h.a1}, past the second ${h.a2}; top payroll $${h.top.toFixed(0)}M (second apron $${h.a2line.toFixed(0)}M); trades ${h.trS} in season + ${h.trO} in the summer; 85+ ${h.n85}, 90+ ${h.n90}; records ${h.best}-${82 - h.best} to ${h.worst}-${82 - h.worst}; ${TEAMX} ${h.gm}`)
}
const avg = k => (H.reduce((a, x) => a + x[k], 0) / H.length).toFixed(1), rng = k => `${Math.min(...H.map(x => x[k]))}-${Math.max(...H.map(x => x[k]))}`
console.log(`HEALTH dyn-${SEED} over ${H.length} seasons: taxpayers ${avg('tax')} a season (${rng('tax')}), past the second apron ${avg('a2')} (${rng('a2')}); top payroll ${(100 * H.reduce((a, x) => a + x.top / x.a2line, 0) / H.length).toFixed(0)}% of the second apron on average (most ${(100 * Math.max(...H.map(x => x.top / x.a2line))).toFixed(0)}%); trades ${avg('trS')} in season (${rng('trS')}) + ${avg('trO')} in the summer (${rng('trO')}); 85+ men ${H[0].n85} at the start, ${H.at(-1).n85} at the end (${rng('n85')}), 90+ ${H[0].n90} and ${H.at(-1).n90} (${rng('n90')}); best record ${rng('best')} wins, worst ${rng('worst')} wins; ${TEAMX} (auto-run, nobody re-signed): ${H.map(x => x.gm).join(', ')}`)
const cnt = {}
for (const c of champs) cnt[c] = (cnt[c] ?? 0) + 1
console.log('titles', JSON.stringify(cnt), 'max', Math.max(...Object.values(cnt)), `${((Date.now() - t0) / 1000).toFixed(0)}s`)
