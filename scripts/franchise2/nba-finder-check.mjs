// NBA Franchise: the trade finder (nba/finder.js), headless.
//   FR_TMP=<tmp> bash scripts/franchise2/run.sh scripts/franchise2/nba-finder-check.mjs
// Every offer and every price it shows is proposed on a copy of the franchise: each one must be a YES, close to
// even by the league's values, and never send a man as good as the one coming back. Plus timing and samples.
import * as N from '../../src/lib/franchise2/nba/index'
import * as T from '../../src/lib/franchise2/nba/trades'
import * as FD from '../../src/lib/franchise2/nba/finder'
const C = N.CAP_SIM
const L = (...a) => console.log(...a)
let bad = 0, n = 0
const ok = (c, msg) => { n++; if (!c) { bad++; L(`FAIL ${msg}`) } }
const clone = F => N.unpackNba(N.packNba(F))
const nm = (F, s, ids) => ids.map(i => F.teams[s].r.find(p => p.i === i)).map(p => `${p.n} ${p.o}`)
const pk = (F, list) => list.map(e => { const k = F.picks[typeof e === 'number' ? e : e.i]; return `${k.y} ${k.o} R${k.r}${e.top ? ` top-${e.top}` : ''}` })
const show = (F, d) => `${d.b}: send [${[...nm(F, d.a, d.ga), ...pk(F, d.pa)].join(', ')}] get [${[...nm(F, d.b, d.gb), ...pk(F, d.pb)].join(', ')}]`
const tryIt = (F, d, tag) => {
  const G = clone(F), r = T.proposeTrade(G, d)
  ok(r.ok, `${tag} not accepted: ${show(F, d)} -> ${r.text}`)
  const g = C.gauge(F, d)
  ok(g.a >= g.b * FD.FIND_EVEN - 0.6, `${tag} not close to even ${g.a.toFixed(0)} vs ${g.b.toFixed(0)}: ${show(F, d)}`)
}
const runs = (process.argv[2] ?? 'qa-find:WAS,qa-find2:BOS,qa-find3:LAL,qa-find4:OKC').split(',').map(x => x.split(':'))
for (const [seed, team, phase] of runs) {
  let F = N.createNbaFranchise({ seed, team, owner: 'G' })
  L(`\n── ${team} (${C.situationOf(F, team)}) payroll ${C.payroll(F, team).toFixed(1)}`)
  const roster = F.teams[team].r.filter(p => !p.tw && !C.whyNot(F, team, p)).sort((a, b) => b.o - a.o)
  for (const p of [roster[1], roster[5], roster[10]].filter(Boolean)) {
    const t = performance.now(), R = FD.shopOffers(F, { ga: [p.i], pa: [] }), ms = performance.now() - t
    L(`shop ${p.n} ${p.o}/${p.ag} $${p.$}: ${R.list.length} offers from ${R.teams} teams (${ms.toFixed(0)} ms)${R.line ? ` · ${R.line}` : ''}`)
    R.list.slice(0, 3).forEach(o => L(`   ${o.k.padEnd(6)} ${show(F, o.deal)}  (${o.g.a.toFixed(0)}/${o.g.b.toFixed(0)})`))
    R.list.forEach(o => tryIt(F, o.deal, 'shop'))
  }
  const first = T.picksOf(F, team).find(k => k.r === 1)
  const R1 = FD.shopOffers(F, { ga: [], pa: [first.i] })
  L(`shop ${first.y} first: ${R1.list.length} offers${R1.line ? ` · ${R1.line}` : ''}`)
  R1.list.slice(0, 2).forEach(o => L(`   ${show(F, o.deal)}`))
  R1.list.forEach(o => tryIt(F, o.deal, 'shop-pick'))
  for (const q of [{ pos: 'C' }, { pos: 'PG', minO: 80 }, { pos: 'SF', ageMax: 25 }, { pos: 'SG', max$: 10 }]) {
    const t = performance.now(), R = FD.findDeals(F, q), ms = performance.now() - t
    L(`find ${JSON.stringify(q)}: ${R.list.length} of ${R.priced} priced (${R.total} fit) (${ms.toFixed(0)} ms)`)
    R.list.slice(0, 3).forEach(r => L(`   ${r.p.n} ${r.p.o} -> ${show(F, r.deal)}`))
    R.no.slice(0, 2).forEach(r => L(`   no ${r.p.n} ${r.p.o}: ${r.text}`))
    for (const r of R.list) {
      tryIt(F, r.deal, 'find')
      const best = Math.max(0, ...r.deal.ga.map(i => F.teams[team].r.find(p => p.i === i).o))
      ok(best < r.p.o, `find sends a man as good as ${r.p.n}`)
    }
  }
}
L(`\n${n - bad}/${n} ok${bad ? ` · ${bad} FAIL` : ''}`)
process.exit(bad ? 1 : 0)
