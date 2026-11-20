// Core's own season and summer with the cap engine wired in (the sim's stand-ins for the games): setup, 82 games and
// the deadline, the tax, the postseason, awards, lottery, draft, re-signing, free agency, camp, the next season. The
// GM's team is run through core's calls (resignMine, signFA, faNext, campCheck). Checks every team's books and
// rosters at each stop.
//   node scripts/franchise2/nba/wired.mjs scripts/franchise2/nba/wired-season.mjs [seasons=3] [seed]
import * as NBA from '../../../src/lib/franchise2/nba/index'
import * as CAP from '../../../src/lib/franchise2/nba/cap'
import * as K from '../../../src/lib/franchise2/nba/contracts'

const N = Number(process.argv[2] ?? 3), SEED = process.argv[3] ?? 'wired'
const F = NBA.createNbaFranchise({ seed: SEED, team: 'NYK', owner: 'Guest' })
const S = NBA.SHORTS
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
function check(where, { camp = false } = {}) {
  for (const s of S) {
    const L = K.legalRoster(F, s, camp ? { season: false } : {})
    if (!L.ok && s !== F.team) bad(`${where}: ${s} ${L.why}${/hard/.test(L.why) ? ` ($${CAP.payroll(F, s)}M, ${JSON.stringify(F.teams[s].exc)}, ${F.teams[s].r.filter(p => !p.tw).length} men; newest: ${F.teams[s].r.filter(p => p.sgn === CAP.capYear(F)).map(p => `${p.n} $${p.$}`).join(', ')})` : ''}`)
    for (const p of F.teams[s].r) {
      if (!(p.y > 0) || p.$ == null) bad(`${where}: ${s} ${p.n} has no deal`)
      if ((p.sc?.length ?? 0) !== p.y - 1) bad(`${where}: ${s} ${p.n} schedule ${p.sc?.length} for ${p.y}`)
    }
  }
}
function books(where) {
  const y = CAP.capYear(F)
  const pays = S.map(s => CAP.payroll(F, s))
  const mean = pays.reduce((a, b) => a + b, 0) / 30
  const maxers = S.flatMap(s => F.teams[s].r).filter(p => !p.tw && p.$ >= CAP.capOf(y) * 0.25 - 0.05).length
  const over = k => S.filter(s => ['tax', 'a1', 'a2'].slice(k).includes(CAP.capSheet(F, s).over)).length
  console.log(`${where}: cap $${CAP.capOf(y)}M · mean $${mean.toFixed(1)}M (${(mean / CAP.capOf(y)).toFixed(2)} caps) · low $${Math.min(...pays)}M · high $${Math.max(...pays)}M · tax ${over(0)} · a1 ${over(1)} · a2 ${over(2)} · max deals ${maxers}`)
  if (mean / CAP.capOf(y) < 0.98 || mean / CAP.capOf(y) > 1.3) bad(`${where}: mean payroll ${(mean / CAP.capOf(y)).toFixed(2)} caps`)
}
check('setup')
books('setup')
const wire = { trade: 0, sign: 0 }
for (let k = 0; k < N; k++) {
  const tag = NBA.seasonText(F.year)
  NBA.simTo(F, F.days + 5)
  if (F.sched.some(g => g.hs == null)) bad(`${tag}: games left unplayed`)
  check(`${tag} season's end`)
  const paid = CAP.assessTax(F, F.year)
  NBA.startPostseason(F)
  NBA.simPostseason(F)
  NBA.closeSeason(F)
  if (F.phase !== 'off') { bad(`${tag}: the summer never started (phase ${F.phase})`); break }
  // the summer, stop by stop
  let guard = 0
  while (F.off && guard++ < 12) {
    const step = F.off.step
    if (step === 'resign') {
      // the GM keeps everyone he can afford who'd play for him
      for (const id of [...(F.off.mine ?? [])]) { const p = F.fa.find(x => x.i === id); NBA.resignMine(F, id, !!p && p.o >= 72) }
    }
    if (step === 'fa') {
      for (let d = 1; d <= 6; d++) {
        // the GM signs one man a day at his ask if the money's there
        const best = [...F.fa].filter(p => p.o >= 70).sort((a, b) => b.o - a.o).slice(0, 12)
        for (const p of best) if (NBA.signFA(F, p.i).ok) break
        NBA.faNext(F)
      }
    }
    if (step === 'camp') {
      // the GM's roster to the CBA's limits
      const t = F.teams[F.team], std = () => t.r.filter(p => !p.tw)
      while (std().length > 15) K.cutMan(F, F.team, [...std()].sort((a, b) => a.o - b.o)[0].i)
      let g = 0
      while (std().length < 14 && g++ < 6) { const p = [...F.fa].sort((a, b) => b.o - a.o).find(x => K.canSign(F, F.team, x, { $: CAP.minOf(x.ys ?? 0, CAP.capYear(F)), y: 1 }).ok); if (!p) break; K.signMan(F, F.team, p, { $: CAP.minOf(p.ys ?? 0, CAP.capYear(F)), y: 1, r: 0 }) }
      const c = NBA.campCheck(F)
      if (!c.ok) bad(`${tag} camp: the GM's roster: ${c.why}`)
      check(`${tag} camp`, { camp: true })
    }
    NBA.nextStep(F)
  }
  for (const x of F.news ?? []) { if (x.k === 'trade') wire.trade++; if (x.k === 'sign') wire.sign++ }
  console.log(`${tag}: ${paid.length} taxpayers ($${Math.round(paid.reduce((a, x) => a + x.bill, 0))}M) · ${F.hist?.slice(-1)[0]?.champ} won the title · wire now: ${(F.news ?? []).slice(0, 4).map(x => x.text).join(' / ')}`)
  check(`${NBA.seasonText(F.year)} opening night`)
  books(`${NBA.seasonText(F.year)} opening night`)
  if (NBA.nbaSaveSize(F) > 1.2e6) bad(`save size ${NBA.nbaSaveSize(F)}`)
}
console.log(`save ${Math.round(NBA.nbaSaveSize(F) / 1024)} KB · trades made ${F.trn ?? 0}`)
console.log(problems.length ? `${problems.length} PROBLEMS` : 'ALL CHECKS PASS')
process.exit(problems.length ? 1 : 0)
