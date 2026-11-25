// NBA Franchise: the season's calendar holds together for the GM, start to postseason.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-seasonflow.mjs [seeds=3]
// 1. Every team, several seeds: its 82nd game is on the league's last day, so playing game by game (the hub's Play)
//    always has a next game until the regular season is over. A few teams played all the way through to prove it, and
//    a save with an old schedule (the GM's team done days early) still gets to the postseason (the hub's way forward).
// 2. Deadline day: the league's deals that day and "the deadline has passed" are dated the deadline's day.
// 3. The All-Star teams: starters 22 days before the break, reserves 12, nobody on both teams (a starter traded to the
//    other conference included), seven reserves a side, the game on the break's Sunday and dated that day; the hub's
//    stop for the break (allStarStop) comes on and goes off.
// 4. Words: a series' line ("sweep the", "win the series 4-x", never "tied 0-0"), a first initial for two men with one
//    last name. 5. Down three late: the sim's team and the moment's get the three up with time left.
import * as N from '../../src/lib/franchise2/nba/index'
import { newGame, run, play, TUNE } from '../../src/lib/franchise2/nba/game'
import { setOf, dressed } from '../../src/lib/franchise2/nba/rotation'
const SEEDS = ['qa2-ui', 'flow-a', 'flow-b', 'flow-c', 'flow-d'].slice(0, Math.max(1, +(process.argv[2] ?? 3)))
let bad = 0
const flag = m => { bad++; console.log('  !! ' + m) }
const t0 = Date.now()

// ── 1. the last day ──────────────────────────────────────────────────────────
for (const seed of SEEDS) {
  const F = N.createNbaFranchise({ seed, team: 'MEM', owner: 'T' })
  const end = F.days - 1
  const early = N.SHORTS.filter(s => Math.max(...F.sched.filter(g => g.h === s || g.a === s).map(g => g.d)) < end)
  if (early.length) flag(`${seed}: ${early.length} teams finish before the last day (${early.slice(0, 5).join(' ')})`)
  if (F.sched.filter(g => g.d === end).length !== 15) flag(`${seed}: the last day has ${F.sched.filter(g => g.d === end).length} games`)
}
// (played through, the hub's way: Play the next game until there is none; then the season must be over)
const through = (seed, team, { old = false } = {}) => {
  const F = N.createNbaFranchise({ seed, team, owner: 'T' })
  if (old) {
    // an old save's schedule: the GM's team's last game moved off the last day, to a night a week earlier both teams have free
    const end = F.days - 1, g = F.sched.find(x => x.d === end && (x.h === team || x.a === team))
    const busy = (s, d) => F.sched.some(x => (x.h === s || x.a === s) && Math.abs(x.d - d) <= 1)
    let d = end - 4; while (d > end - 30 && (busy(g.h, d) || busy(g.a, d))) d--
    g.d = d; F.sched.sort((a, b) => a.d - b.d)
  }
  let plays = 0, stuck = 0
  while (F.phase === 'season' && plays < 400) {
    const g = N.nextMine(F)
    if (!g) { stuck++; if (!old) flag(`${seed} ${team}: no next game on day ${F.day} of ${F.days} with the season still on`); N.simTo(F, F.days); break }
    N.playNext(F); plays++
  }
  const R = N.records(F)
  if (F.phase !== 'post') flag(`${seed} ${team}: the regular season never ended (phase ${F.phase}, day ${F.day})`)
  if (N.SHORTS.some(s => R[s].g !== 82)) flag(`${seed} ${team}: a team without 82 games`)
  if (old && !stuck) flag(`${seed} ${team}: the old-schedule case didn't come up`)
  N.startPostseason(F)
  if (F.phase !== 'playin') flag(`${seed} ${team}: the postseason didn't start`)
  return `${team} ${plays} games played${old ? ', old schedule: simmed to the end' : ''}, ${N.recText(R[team])}`
}
console.log('played through:', [through('qa2-ui', 'MEM'), through(SEEDS[1] ?? 'flow-a', 'BOS'), through(SEEDS[2] ?? 'flow-b', 'LAL'), through('qa2-ui', 'MEM', { old: true })].join(' · '))

// ── 2 + 3. the deadline, the All-Star teams ──────────────────────────────────
for (const seed of SEEDS) {
  const F = N.createNbaFranchise({ seed, team: 'BOS', owner: 'T' })
  const sun = N.allStarDay(F)
  if (new Date(F.cal0 + sun * 86400000).getUTCDay() !== 0) flag(`${seed}: the All-Star Game's day isn't a Sunday`)
  N.simTo(F, F.asb[0] - N.AS_STARTERS)
  if (F.asDone !== 1 || F.as?.E?.st?.length !== 5 || F.as?.W?.st?.length !== 5) flag(`${seed}: starters not named ${N.AS_STARTERS} days out (asDone ${F.asDone})`)
  // (an East starter traded West before the reserves are named: he must not make the West's team too)
  const moved = F.as.E.st.map(i => N.manOf(F, i)).filter(Boolean).sort((a, b) => b.o - a.o)[0]
  { const from = N.teamOfMan(F, moved.i), to = 'LAL'; const A = F.teams[from], B = F.teams[to]; const back = B.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0]
    A.r = A.r.filter(p => p !== moved); B.r = B.r.filter(p => p !== back); A.r.push(back); B.r.push(moved); if (F.ss[moved.i]) F.ss[moved.i].s = to; if (F.ss[back.i]) F.ss[back.i].s = from }
  N.simTo(F, F.ddl + 1)
  const dd = F.news.find(x => x.k === 'ddl')
  if (!dd || dd.d !== F.ddl || N.wireDate(F, dd) !== N.dateText(F, F.ddl)) flag(`${seed}: "deadline has passed" dated ${dd ? N.wireDate(F, dd) : 'never'}, the deadline is ${N.dateText(F, F.ddl)}`)
  const late = F.news.filter(x => x.k === 'trade' && x.y === F.year && x.d > F.ddl)
  if (late.length) flag(`${seed}: ${late.length} trades dated after the deadline`)
  const onDay = F.news.filter(x => x.k === 'trade' && x.d === F.ddl).length
  N.simTo(F, F.asb[0] - N.AS_RESERVES)
  if (F.asDone !== 2) flag(`${seed}: reserves not named ${N.AS_RESERVES} days out`)
  const all = ['E', 'W'].flatMap(c => [...F.as[c].st, ...F.as[c].res])
  if (new Set(all).size !== all.length) flag(`${seed}: a man on both All-Star teams (${all.filter((i, k) => all.indexOf(i) !== k).map(i => N.manOf(F, i)?.n).join(', ')})`)
  if (F.as.E.res.length !== 7 || F.as.W.res.length !== 7) flag(`${seed}: reserves ${F.as.E.res.length} East, ${F.as.W.res.length} West`)
  if (!F.as.E.st.includes(moved.i) || F.as.W.res.includes(moved.i)) flag(`${seed}: the traded starter isn't on the East alone`)
  // the break: the hub stops for it, the game is Sunday's
  const g0 = N.nextMine(F)
  while (F.phase === 'season' && N.nextMine(F) && N.nextMine(F).d < F.asb[0]) N.playNext(F)
  if (N.allStarStop(F) !== 'to' && F.day < F.asb[0]) flag(`${seed}: no stop for the break on day ${F.day} (break ${F.asb[0]})`)
  N.simTo(F, F.asb[0])
  if (F.as.g || F.asDone !== 2) flag(`${seed}: the All-Star Game was played before its Sunday`)
  if (N.allStarStop(F) !== 'game' || !N.allStarOn(F)) flag(`${seed}: the break isn't on the hub on its first day`)
  N.simTo(F, sun + 1)
  const ag = F.news.find(x => x.k === 'asg')
  if (!F.as.g || F.asDone !== 3) flag(`${seed}: no All-Star Game by Monday`)
  if (!ag || ag.d !== sun || N.wireDate(F, ag) !== N.dateText(F, sun)) flag(`${seed}: the All-Star Game is dated ${ag ? N.wireDate(F, ag) : 'never'}, Sunday is ${N.dateText(F, sun)}`)
  if (N.allStarStop(F) != null || !N.allStarOn(F)) flag(`${seed}: after the game the stop is still on, or the card is gone`)
  N.playNext(F); N.playNext(F)
  if (N.allStarOn(F)) flag(`${seed}: the All-Star card is still up after the break`)
  console.log(`${seed}: deadline ${N.dateText(F, F.ddl)} (${onDay} league trades that day, dated it), All-Star Game ${N.dateText(F, sun)}: ${ag?.text ?? '-'}`)
}

// ── 4. the words ─────────────────────────────────────────────────────────────
{
  const S = (wh, wl, done = null) => ({ hi: 'NYK', lo: 'ORL', wh, wl, done, g: [] })
  const want = [[S(0, 0), 'Best of seven'], [S(1, 1), 'Series tied 1-1'], [S(2, 1), 'Knicks lead 2-1'], [S(1, 3), 'Magic lead 3-1'], [S(4, 0, 'NYK'), 'Knicks sweep the Magic'], [S(4, 3, 'NYK'), 'Knicks win the series 4-3'], [S(2, 4, 'ORL'), 'Magic win the series 4-2']]
  for (const [s, t] of want) if (N.seriesText(s, 'NYK') !== t) flag(`seriesText ${s.wh}-${s.wl}: "${N.seriesText(s, 'NYK')}", want "${t}"`)
  const men = [{ i: 1, n: 'Derrick White' }, { i: 2, n: 'Coby White' }, { i: 3, n: 'Jalen Williams' }, { i: 4, n: 'Jaylin Williams' }, { i: 5, n: 'Jaren Jackson Jr.' }, { i: 6, n: 'Jayson Tatum' }]
  const nm = i => N.nameIn(men.find(p => p.i === i), men)
  const got = [1, 2, 3, 4, 5, 6].map(nm).join(' | '), exp = 'D. White | C. White | Jalen Williams | Jaylin Williams | Jackson | Tatum'
  if (got !== exp) flag(`names: "${got}", want "${exp}"`)
}

// ── 5. down three late ───────────────────────────────────────────────────────
{
  // the sim: a team with the ball down three, 10 to 24 seconds left in the fourth: how much is left when its trip ends
  const F = N.createNbaFranchise({ seed: 'flow-three', team: 'BOS', owner: 'T' })
  const sideOf = s => ({ short: s, men: dressed(F.teams[s], { year: F.year }), set: setOf(F.teams[s]) })
  let n = 0, early = 0, held = 0, sumLeft = 0
  for (let k = 0; k < 2500 && n < 120; k++) {
    const h = N.SHORTS[k % 30], a = N.SHORTS[(k * 7 + 3) % 30]; if (h === a) continue
    const S = newGame({ seed: `three-${k}`, home: sideOf(h), away: sideOf(a) })
    run(S, { stop: G => G.per === 4 && G.clock <= 24 && G.clock >= 10 && G.sc[G.poss] - G.sc[G.poss === 'h' ? 'a' : 'h'] === -3 })
    if (S.done || !S.stop) continue
    const c0 = S.clock, per = S.per
    play(S)
    const left = S.done || S.per !== per ? 0 : S.clock
    n++; sumLeft += left; if (left >= 3) early++; else held++
  }
  console.log(`down three with the ball, 10-24 seconds left (sim, ${n} trips): ${early} end with 3+ seconds left, ${held} run the clock out; ${(sumLeft / Math.max(1, n)).toFixed(1)} s left on average`)
  if (n < 40) flag(`only ${n} down-three trips found`)
  if (early / Math.max(1, n) < 0.8) flag('a team down three still holds for the buzzer')
  // the moment: down three with more than eight seconds, the three goes up early (three seconds or more left)
  let m3 = 0, okN = 0
  for (const team of ['DEN', 'BOS', 'OKC', 'NYK', 'HOU']) {
  if (m3 >= 6) break
  const G = N.createNbaFranchise({ seed: `flow-three-${team}`, team, owner: 'T' })
  while (G.phase === 'season' && m3 < 6) {
    const out = N.playNext(G, { moments: true, wantMoment: x => x === -3 })
    if (!out?.pending) continue
    const plan = N.momentPlan(G), c = G.pend.left
    if (plan.spot !== 'off') { N.momentSim(G, plan); continue }
    const r = N.momentDone(G, plan, { hit: m3 % 2 === 0, raw: null })
    const row = G.log.at(-1)
    if (c > 8) {
      m3++
      const ok = plan.early && /need a three/.test(plan.situation.tail) && !/hold for the last shot/.test(plan.situation.tail) && row.mo.left >= 2.9
      if (ok) okN++; else flag(`moment down three at ${c}: early ${plan.early}, tail "${plan.situation.tail}", ${row.mo.left} left after the shot`)
      if (m3 <= 2) console.log(`  moment at ${c}s: "${plan.situation.tail}" -> ${N.momentText(G, row)}`)
    } else if (plan.early) flag(`moment down three at ${c}: early with no time`)
  }
  }
  if (m3 < 3) flag(`only ${m3} down-three moments with time found`)
  console.log(`moments down three with 8+ seconds: ${okN} of ${m3} get the three up with time left`)
}
console.log(bad ? `${bad} problems` : 'no problems', `${Date.now() - t0} ms`)
if (bad) process.exit(1)
