// NBA Franchise: the league's teams call the GM (trades.js cpuOffer). Seasons auto-run; every offer is checked when
// it comes (legal, fair by the engine's own book, firsts only for the men firsts buy), half are taken and half turned
// down; the count a season, how many came in the deadline's last ten days and at the summer's stops.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-calls.mjs [seasons=3] [seed=a] [team=BOS]
import * as N from '../../src/lib/franchise2/nba/index'
const Y = +(process.argv[2] ?? 3), SEED = process.argv[3] ?? 'a', TEAM = process.argv[4] ?? 'BOS'
const C = N.CAP_SIM
let bad = 0
const fail = (...m) => { bad++; console.log('  FAIL', ...m) }
const F = N.createNbaFranchise({ seed: 'calls-' + SEED, team: TEAM, owner: 'G' })
const manName = i => N.SHORTS.map(s => F.teams[s].r.find(p => p.i === i)).find(Boolean)?.n ?? '?'
let n = 0, late = 0, off = 0, took = 0
const seen = o => {
  n++
  if (!C.checkTrade(F, o.deal).ok) fail('an offer that is not legal', C.offerText(F, o))
  const g = C.gauge(F, o.deal)
  if (g.a < g.b * 0.79 || g.b < g.a * 0.79) fail('uneven', g.a.toFixed(0), g.b.toFixed(0), C.offerText(F, o))
  if (!F.news.some(x => x.tag === 'TRADE TALKS' && x.text.includes(manName(o.deal.ga[0])))) fail('no wire line')
  console.log(`   ${F.year} ${F.phase === 'season' ? `day ${F.day}${F.ddl - F.day <= 10 ? ' (deadline week)' : ''}` : F.off.step}: ${N.teamWords(C.offerText(F, o))} [${g.a.toFixed(0)} / ${g.b.toFixed(0)}]`)
  const yes = n % 2 === 0
  const before = F.teams[TEAM].r.map(p => p.i).join()
  const r = C.answerOffer(F, yes)
  if (!r.ok) fail('answer', r.why)
  for (const x of r.news ?? []) N.addNews(F, x)
  if (yes) { took++; if (F.teams[TEAM].r.map(p => p.i).join() === before) fail('accepted but nothing moved') }
  if (F.tof) fail('the call still up after the answer')
}
for (let y = 0; y < Y; y++) {
  while (F.phase === 'season') {
    N.simTo(F, F.day + 1)
    const o = C.offerNow(F)
    if (o) { if (F.ddl - (o.d ?? 0) <= 10) late++; seen(o) }
  }
  N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
  while (F.phase === 'off') {
    const o = C.offerNow(F)
    if (o) { off++; seen(o) }
    if (F.off.step === 'camp') { const T = F.teams[TEAM]; while (T.r.filter(p => !p.tw).length > 15) C.cutMan(F, TEAM, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i); for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) } }
    N.nextStep(F)
  }
}
console.log(`calls: ${n} offers in ${Y} seasons (${(n / Y).toFixed(1)} a season), ${late} in the deadline's last ten days, ${off} in the summer; ${took} taken`)
if (n < Y * 2) fail('too few calls', n)
console.log(bad ? `${bad} FAIL` : 'ALL OK')
if (bad) process.exit(1)
