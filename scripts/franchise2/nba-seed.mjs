// NBA Franchise: the same seed gives the same league. Plays a season, a summer and on to the deadline twice on one
// seed (and a third time with the clock jumping a second on every read: nothing in the engine may depend on the
// time of day), and compares every roster, payroll and trade. Then the same save plays the same: a fourth run is
// saved and loaded again (packed and unpacked) every few nights, at each of the summer's stops and each day of free
// agency, and a fifth does that and looks around at every stop the way the screens do (every team's situation and
// cap sheet, every free agent's ask): nothing the engine keeps off the save, and no read, may change what happens.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-seed.mjs [seed=det] [team=CHA]
import * as N from '../../src/lib/franchise2/nba/index'
const C = N.CAP_SIM
const SEED = process.argv[2] ?? 'det', TEAM = process.argv[3] ?? 'CHA'
function play({ reload = false, look = false } = {}) {
  let F = N.createNbaFranchise({ seed: SEED, team: TEAM, owner: 'QA' })
  // (a stop: the save written and read back, and the screens' reads)
  const stop = () => {
    if (reload) F = N.unpackNba(N.packNba(F))
    if (look) { for (const s of N.SHORTS) { C.situationOf(F, s); C.capSheet(F, s) } for (const p of (F.fa ?? []).slice(0, 80)) C.askOf(F, p); for (const p of F.teams[F.team].r) C.tradeValue(F, p, 'BOS') }
  }
  const simTo = to => { if (!reload && !look) return N.simTo(F, to); while (F.phase === 'season' && F.day < to) { N.simTo(F, Math.min(to, F.day + 3)); stop() } }
  simTo(F.days); N.startPostseason(F); stop(); N.simPostseason(F); N.closeSeason(F)
  while (F.phase === 'off') {
    stop()
    if (F.off.step === 'draft') N.draftTo(F, { stopMine: false })
    if (F.off.step === 'fa') for (let d = 0; d < C.FA_DAYS; d++) { N.faNext(F); stop() }
    if (F.off.step === 'camp') { const T = F.teams[F.team]; while (T.r.filter(p => !p.tw).length > 15) C.cutMan(F, F.team, T.r.filter(p => !p.tw && p.b == null).sort((a, b) => a.o - b.o)[0].i); for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) } }
    N.nextStep(F)
  }
  simTo(F.ddl + 1)
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
const d = play({ reload: true })
const e = play({ reload: true, look: true })
console.log(`seed ${SEED}/${TEAM}: run 1 ${a.h} · run 2 ${b.h} · run 3 (clock jumping) ${c.h} · run 4 (saved and loaded all the way) ${d.h} · run 5 (and the screens' reads) ${e.h} · ${a.trades} trades, ${a.fa} on the street`)
let bad = 0
for (const [n, x] of [['run 2', b], ['run 3', c], ['run 4', d], ['run 5', e]]) {
  if (x.h === a.h) continue
  bad++
  const k = x.fp.findIndex((line, j) => line !== a.fp[j])
  console.log(`  FAIL ${n} differs from run 1, first at`, (a.fp[k] ?? '').slice(0, 90), 'vs', (x.fp[k] ?? '').slice(0, 90))
}
console.log(bad ? `${bad} FAILED` : 'ALL OK')
if (bad) process.exit(1)
