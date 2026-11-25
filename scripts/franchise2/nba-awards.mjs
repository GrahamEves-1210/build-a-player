// NBA Franchise, headless: the awards over N seasons, each with the line it was won on, so a reader can check them
// against how the real votes go.
//   FR_TMP=<scratch> bash scripts/franchise2/run.sh scripts/franchise2/nba-awards.mjs [seasons=5] [team=DET] [seed]
// Flags (!!): an MVP from a team under 46 wins (the real floor: Westbrook's 47 in 2017, Jokic's 48 in 2022), an
// All-NBA man under 18 points a game who isn't a big with 10 boards or 2 blocks or a guard with 9 assists, a top-five
// producer who qualified, played for a team with 35 wins or more and was left off All-NBA, an All-Rookie man under
// 14 minutes a game or half a season, a man named twice.
import * as N from '../../src/lib/franchise2/nba/index'
import { prod, eligible, winsOf } from '../../src/lib/franchise2/nba/awards'
const Y = +(process.argv[2] ?? 5), TEAMX = process.argv[3] ?? 'DET', SEED = process.argv[4] ?? 'awards-' + TEAMX
const F = N.createNbaFranchise({ seed: SEED, team: TEAMX, owner: 'Tester' })
const bad = []
const flag = m => { bad.push(m); console.log('  !! ' + m) }
const f1 = v => (Math.round(v * 10) / 10).toFixed(1)
let mvpLow = 0, losing = [0, 0, 0], lowPpg = 99
const mvpWins = []
for (let y = 0; y < Y; y++) {
  N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F)
  const R = N.records(F), W = winsOf(F), ss = { ...F.ss }
  const rec = s => (R[s] ? `${R[s].w}-${R[s].l}` : '')
  const line = i => { const x = ss[i], p = N.manOf(F, i); if (!x?.gp) return `${p?.n ?? i}: no line`; return `${p.n} ${p.p} ${x.s} ${rec(x.s)} | ${x.gp} G ${f1(x.min / x.gp)} MIN ${f1(x.pts / x.gp)} PTS ${f1(x.reb / x.gp)} REB ${f1(x.ast / x.gp)} AST | ${p.o} OVR age ${p.ag}` }
  // the season's best producers who met the 65-game rule, before the awards move anyone
  const top = Object.entries(ss).map(([i, r]) => ({ i: +i, r, v: prod(r), p: N.manOf(F, +i) })).filter(x => x.p && eligible(x.r, 65, x.p)).sort((a, b) => b.v - a.v)
  N.closeSeason(F)
  const A = F.hist.at(-1).aw
  console.log(`\n=== ${N.seasonText(F.year)}: champions ${F.po.champ}`)
  console.log(`  MVP        ${line(A.MVP.i)}`)
  const mw = W.w[ss[A.MVP.i].s] ?? 0
  if (mw < 50) mvpLow++
  mvpWins.push(mw)
  if (mw < 46) flag(`MVP on a ${mw}-win team: ${A.MVP.n}`)
  for (const k of ['DPOY', 'ROY', '6MOY', 'MIP', 'CLUTCH']) if (A[k]) console.log(`  ${k.padEnd(10)} ${line(A[k].i)}`)
  const seen = new Set()
  A.ALL.forEach((t, k) => { console.log(`  ALL-NBA ${['FIRST', 'SECOND', 'THIRD'][k]}`); for (const x of t) {
    console.log(`     ${line(x.i)}`)
    if (seen.has(x.i)) flag(`${x.n} named twice`); seen.add(x.i)
    const s = ss[x.i], p = N.manOf(F, x.i), ppg = s.pts / s.gp
    if ((W.w[s.s] ?? 0) < 41) losing[k]++
    lowPpg = Math.min(lowPpg, ppg)
    if (ppg < 18 && !(s.reb / s.gp >= 10 || s.ast / s.gp >= 9 || s.blk / s.gp >= 2)) flag(`All-NBA on ${f1(ppg)} points a game: ${x.n}`)
  } })
  for (const x of top.slice(0, 5)) if (!seen.has(x.i) && (W.w[x.r.s] ?? 0) >= 35) flag(`a top-five producer left off All-NBA: ${line(x.i)}`)
  for (const x of top.slice(5, 12)) if (!seen.has(x.i)) console.log(`     (left off, production rank ${top.indexOf(x) + 1}: ${line(x.i)})`)
  const rk = new Set()
  ;(A.ROOKIE ?? []).forEach((t, k) => { console.log(`  ALL-ROOKIE ${['FIRST', 'SECOND'][k]}`); for (const x of t) {
    console.log(`     ${line(x.i)}`)
    if (rk.has(x.i)) flag(`${x.n} named twice`); rk.add(x.i)
    const s = ss[x.i]
    if (s.min / s.gp < 14 || s.gp < 41) flag(`All-Rookie on ${f1(s.min / s.gp)} minutes, ${s.gp} games: ${x.n}`)
  } })
  if ((A.ROOKIE ?? []).flat().length < 10) console.log(`  (All-Rookie named ${(A.ROOKIE ?? []).flat().length})`)
  // how much the league's rookies played
  const rookies = Object.entries(ss).map(([i, r]) => ({ r, p: N.manOf(F, +i) })).filter(x => x.p && x.p.rk === F.year && !x.p.fl)
  const reg = rookies.filter(x => x.r.gp >= 41 && x.r.min / x.r.gp >= 14)
  console.log(`  rookies: ${rookies.length} played, ${reg.length} of them 41+ games at 14+ minutes, ${rookies.filter(x => x.r.gp >= 41 && x.r.min / x.r.gp >= 24).length} at 24+`)
  const recNews = (F.news ?? []).filter(n => n.k === 'record' && n.y === F.year)
  for (const n of recNews) console.log(`  RECORD     ${n.text}`)
  while (F.phase === 'off') {
    if (F.off.step === 'resign') for (const i of [...(F.off.mine ?? [])]) N.resignMine(F, i, true)
    if (F.off.step === 'camp') {
      const T = F.teams[F.team]
      while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i)
      for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
    }
    N.nextStep(F)
  }
  for (const n of (F.news ?? []).filter(n => n.k === 'retire' && n.y === F.year - 1)) console.log(`  RETIRES    ${n.text}`)
}
console.log(`\nMVPs from a team under 50 wins: ${mvpLow} of ${Y} (the MVPs' teams won ${mvpWins.join(', ')})`)
console.log(`All-NBA men from losing teams: first team ${losing[0]}, second ${losing[1]}, third ${losing[2]} (of ${Y * 5} each); the lowest scorer named averaged ${f1(lowPpg)}`)
console.log(bad.length ? `${bad.length} flags` : 'no flags')
