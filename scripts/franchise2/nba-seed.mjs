// NBA Franchise: the same seed gives the same league. Plays a season, a summer and on to the deadline twice on one
// seed (and a third time with the clock jumping a second on every read: nothing in the engine may depend on the
// time of day), and compares every roster, payroll and trade.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-seed.mjs [seed=det] [team=CHA]
import * as N from '../../src/lib/franchise2/nba/index'
const C = N.CAP_SIM
const SEED = process.argv[2] ?? 'det', TEAM = process.argv[3] ?? 'CHA'
function play() {
  const F = N.createNbaFranchise({ seed: SEED, team: TEAM, owner: 'QA' })
  N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
  while (F.phase === 'off') {
    if (F.off.step === 'draft') N.draftTo(F, { stopMine: false })
    if (F.off.step === 'fa') for (let d = 0; d < C.FA_DAYS; d++) N.faNext(F)
    if (F.off.step === 'camp') { const T = F.teams[F.team]; while (T.r.filter(p => !p.tw).length > 15) C.cutMan(F, F.team, T.r.filter(p => !p.tw && p.b == null).sort((a, b) => a.o - b.o)[0].i); for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) } }
    N.nextStep(F)
  }
  N.simTo(F, F.ddl + 1)
  const fp = []
  for (const s of N.SHORTS) fp.push(`${s}:${C.payroll(F, s)}:${F.teams[s].r.map(p => `${p.i}/${p.$}/${p.y}`).sort().join('.')}`)
  fp.push((F.trl ?? []).map(d => d.t).join('|'))
  fp.push(F.fa.map(p => p.i).sort((a, b) => a - b).join('.'))
  let h = 7
  for (const c of fp.join('\n')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return { h, fp, trades: (F.trl ?? []).length, fa: F.fa.length, nid: F.nid }
}
const a = play()
const b = play()
const real = Date.now
let t = real()
Date.now = () => (t += 1000)
const c = play()
Date.now = real
console.log(`seed ${SEED}/${TEAM}: run 1 ${a.h} · run 2 ${b.h} · run 3 (clock jumping) ${c.h} · ${a.trades} trades, ${a.fa} on the street`)
let bad = 0
for (const [n, x] of [['run 2', b], ['run 3', c]]) {
  if (x.h === a.h) continue
  bad++
  const k = x.fp.findIndex((line, j) => line !== a.fp[j])
  console.log(`  FAIL ${n} differs from run 1, first at`, (a.fp[k] ?? '').slice(0, 90), 'vs', (x.fp[k] ?? '').slice(0, 90))
}
console.log(bad ? `${bad} FAILED` : 'ALL OK')
if (bad) process.exit(1)
