// NBA Franchise: the wire. A season, its summer and the next season's first month with the GM's team auto-run;
// what the wire holds at each stop (kinds, how many injuries in the top 15, the summer's dates) and its size in the save.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-wire.mjs [seed=w] [team=BOS] [dump=0]
import * as N from '../../src/lib/franchise2/nba/index'
const SEED = process.argv[2] ?? 'w', TEAMX = process.argv[3] ?? 'BOS', DUMP = +(process.argv[4] ?? 0)
const F = N.createNbaFranchise({ seed: 'wire-' + SEED, team: TEAMX, owner: 'G' })
const kinds = L => { const c = {}; for (const n of L) c[n.k ?? '?'] = (c[n.k ?? '?'] ?? 0) + 1; return JSON.stringify(c) }
const show = label => {
  const L = F.news ?? []
  const top = L.slice(0, 15)
  const qo = L.filter(n => n.tag === 'QUALIFYING OFFER').length
  console.log(`${label}: ${L.length} items · top15 inj ${top.filter(n => n.k === 'inj').length} · QO ${qo} · ${kinds(L)}`)
  if (DUMP) for (const n of L.slice(0, DUMP)) console.log(`   ${N.wireDate(F, n)} ${n.tag} · ${n.text.slice(0, 90)}`)
}
N.simTo(F, 40); show('day 40')
N.simTo(F, F.days); show('season end')
N.startPostseason(F); N.simPostseason(F); show('finals')
N.closeSeason(F)
while (F.phase === 'off') {
  if (F.off.step === 'camp') {
    const T = F.teams[F.team]
    while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i)
    for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
  }
  const was = F.off.step
  N.nextStep(F)
  show(`after ${was}`)
}
N.simTo(F, 30); show('next season day 30')
const L = F.news
const has = re => L.some(n => re.test(n.tag + ' ' + n.text))
console.log('still on the wire: draft', has(/^DRAFT/), '· MVP', has(/^MVP/), '· champion', has(/^NBA FINALS/), '· big signings', L.filter(n => n.tag === 'FREE AGENCY').length)
const ds = L.map(n => N.wireDate(F, n)); console.log('dates: undated', L.filter(n => n.t == null).length, '· summer', ds.filter(d => /^(JUN|JUL|AUG|SEP)/.test(d)).length, '· seasons shown as 20xx-yy', ds.filter(d => /^\d{4}-/.test(d)).length)
console.log('wire bytes in the save', JSON.stringify(L).length, '· save', N.nbaSaveSize(F))
