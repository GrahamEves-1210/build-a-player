// NBA Franchise: dynasties. Seasons played out with the GM's team auto-run; the champions, and each year's champion's
// core (its best four: OVR, age, salary, years left) and its payroll against the tax and aprons.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-dynasty.mjs [seasons=10] [seed=a] [team=BOS] [watch=SAS]
import * as N from '../../src/lib/franchise2/nba/index'
const Y = +(process.argv[2] ?? 10), SEED = process.argv[3] ?? 'a', TEAMX = process.argv[4] ?? 'BOS', WATCH = process.argv[5] ?? 'SAS'
const F = N.createNbaFranchise({ seed: 'dyn-' + SEED, team: TEAMX, owner: 'G' })
const champs = []
const t0 = Date.now()
const top = s => F.teams[s].r.slice().sort((a, b) => b.o - a.o).slice(0, 4).map(p => `${p.n.split(' ').pop()} ${p.o}/${p.ag} $${(p.$ ?? 0).toFixed(0)}x${p.y}`).join(', ')
const cap = s => { const x = N.CAP_SIM.capSheet(F, s); return `$${x.pay.toFixed(0)} ${x.over}` }
for (let y = 0; y < Y; y++) {
  N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F)
  const c = F.po.champ
  champs.push(c)
  const R = N.records(F)
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
}
const cnt = {}
for (const c of champs) cnt[c] = (cnt[c] ?? 0) + 1
console.log('titles', JSON.stringify(cnt), 'max', Math.max(...Object.values(cnt)), `${((Date.now() - t0) / 1000).toFixed(0)}s`)
