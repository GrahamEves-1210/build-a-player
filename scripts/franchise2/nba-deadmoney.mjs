// NBA Franchise, headless: dead money ages exactly once a league year, whenever the man was waived.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-deadmoney.mjs [team=BOS]
// Waives the GM's men in the season (plain and stretched), at the re-sign stop, in free agency and in camp
// (plain and stretched), then plays two league years and checks each waiver's money lands in exactly the
// seasons it was booked for (what the books said the moment he was waived) at every step along the way.
import * as N from '../../src/lib/franchise2/nba/index'
import { deadIn } from '../../src/lib/franchise2/nba/cap'
const TEAMX = process.argv[2] ?? 'BOS'
const C = N.CAP_SIM
const bad = []
const flag = m => { bad.push(m); console.log('  !! ' + m) }
let F = N.createNbaFranchise({ seed: 'dead-' + TEAMX, team: TEAMX, owner: 'Graham' })
F.moments = 'off'
const T = () => F.teams[F.team]
// a waived man's money by season, as the books have it now
const bySeason = n => {
  const cy = C.capYear(F), out = {}
  for (const d of T().dead ?? []) if (d.n === n) for (let y = F.year - 1; y < F.year + 12; y++) { const v = deadIn(d, y, cy); if (v) out[y] = Math.round(((out[y] ?? 0) + v) * 10) / 10 }
  return out
}
const want = {}   // name -> { season: $ } booked at the waiver (seasons from the books' season on)
const cut = (label, { stretch = false, min = 2 } = {}) => {
  const p = T().r.filter(x => !x.tw && x.b == null).map(x => [x, C.cutCost(F, x, { stretch })]).filter(([, c]) => c.total > 0 && c.years >= min).sort((a, b) => b[1].total - a[1].total)[0]
  if (!p) { console.log(`  (${label}: no one with ${min}+ guaranteed seasons)`); return }
  const [m, c] = p
  C.cutMan(F, F.team, m.i, { stretch, force: true })
  want[m.n] = bySeason(m.n)
  const tot = Object.values(want[m.n]).reduce((a, v) => a + v, 0)
  console.log(`  ${label}: ${m.n} (${F.phase} ${F.off?.step ?? ''} ${F.year}) ${JSON.stringify(want[m.n])}`)
  if (Math.abs(tot - c.total) > 0.3) flag(`${label}: ${m.n} booked ${tot.toFixed(1)}, owed ${c.total}`)
  if (stretch && c.stretch && Object.keys(want[m.n]).length !== c.years) flag(`${label}: ${m.n} stretched over ${Object.keys(want[m.n]).length} seasons, cutCost says ${c.years}`)
}
// every waiver's money from the books' season on is what it was booked as
const check = at => {
  const cy = C.capYear(F)
  for (const [n, w] of Object.entries(want)) {
    const now = bySeason(n)
    for (let y = cy; y < F.year + 12; y++) if ((now[y] ?? 0) !== (w[y] ?? 0)) flag(`${at}: ${n} season ${y}: ${now[y] ?? 0} on the books, booked ${w[y] ?? 0}`)
  }
  const pay = C.payroll(F, F.team), dead = Object.keys(want).reduce((a, n) => a + (bySeason(n)[cy] ?? 0), 0)
  console.log(`  ${at}: books ${cy}, payroll ${pay}, these waivers ${dead.toFixed(1)} this league year`)
}
const playTo = day => { while (F.phase === 'season' && F.day < day) N.playNext(F, { moments: false }) }
const finishSeason = () => {
  while (F.phase === 'season') N.playNext(F, { moments: false })
  N.startPostseason(F)
  while (F.phase === 'playin' || F.phase === 'playoffs') N.playPoNight(F, { moments: false })
  N.closeSeason(F)
}
const summer = ({ waive = true } = {}) => {
  while (F.phase === 'off') {
    const st = F.off.step
    if (st === 'resign') {
      for (const i of [...(F.off.mine ?? [])]) N.resignMine(F, i, true)
      check('re-sign stop')
      if (waive) cut('re-sign stop waiver')
    }
    if (st === 'fa') {
      check('free agency')
      if (waive) cut('free agency stretch', { stretch: true, min: 1 })
      for (let d = 1; d <= (C.FA_DAYS ?? 6); d++) N.faNext(F)
    }
    if (st === 'camp') {
      check('camp')
      if (waive) { cut('camp waiver', { min: 1 }); cut('camp stretch', { stretch: true, min: 1 }) }
      // (a legal roster for opening night: 14-15 standard men)
      while (T().r.filter(p => !p.tw).length > 15) { const p = T().r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0]; C.cutMan(F, F.team, p.i) }
      let k = 0
      while (T().r.filter(p => !p.tw).length < 14 && k++ < 6) { const f = N.minPool(F, 1)[0] ?? F.fa.filter(x => !x.tw && x.fr !== F.team).sort((a, b) => b.o - a.o)[0]; if (!f) break; N.signMin(F, f.i) }
    }
    N.nextStep(F)
  }
  check(`opening night ${F.year}`)
}
console.log(`${F.team} ${F.year}: in-season waivers`)
playTo(20)
cut('in-season waiver')
cut('in-season stretch', { stretch: true })
check('in season')
playTo(60)
check('day 60')
finishSeason()
check('season over')
summer()
console.log(`${F.year}: the second league year`)
playTo(30)
cut('in-season waiver 2', { min: 1 })
check('in season 2')
finishSeason()
summer({ waive: false })
playTo(10)
check(`in season ${F.year}`)
// a waiver whose last season has passed is off the books
for (const d of T().dead ?? []) if (d.to != null && d.to < F.year) flag(`${d.n}: an entry through ${d.to} still on the ${F.year} books`)
console.log(bad.length ? `${bad.length} problems` : 'no problems')
process.exit(bad.length ? 1 : 0)
