// NBA Franchise, part C: the game's own checks. Seeded replays, the box score's arithmetic, the user's rotation
// (starters and minutes), fouls, blowouts and close games, the key-moment seam, noInj, rest, speed.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba/game-check.mjs
import { makeLeague } from './league.mjs'
import * as C from '../../../src/lib/franchise2/nba/sim'

const F = makeLeague('gc')
let fails = 0
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m) } else console.log('  ok   ' + m) }
const sum = (lines, k) => lines.reduce((s, l) => s + l[k], 0)

// 1. replays
const a = C.simGame(F, 'BOS', 'NYK', { seed: 'x1' }), b = C.simGame(F, 'BOS', 'NYK', { seed: 'x1' }), c = C.simGame(F, 'BOS', 'NYK', { seed: 'x2' })
ok(JSON.stringify(a) === JSON.stringify(b), `same seed, same game (${a.hs}-${a.as})`)
ok(JSON.stringify(a) !== JSON.stringify(c), `another seed, another game (${c.hs}-${c.as})`)

// 2. 400 games: the arithmetic, fouls, blowouts, the stints
let fouledOut = 0, maxPf = 0, blowStar = [], closeStar = [], otGames = 0, bad = 0, hiMin = 0, hiReg = 0
const t0 = performance.now()
const pairs = Object.keys(F.teams)
for (let k = 0; k < 400; k++) {
  const h = pairs[k % 30], aw = pairs[(k * 7 + 3) % 30]
  if (h === aw) continue
  const r = C.simGame(F, h, aw, { seed: `g${k}` })
  if (r.ot) otGames++
  for (const [s, L] of Object.entries(r.box)) {
    const pts = sum(L, 'pts'), want = s === h ? r.hs : r.as
    if (pts !== want) bad++
    if (sum(L, 'fgm') * 2 + sum(L, 'tpm') + sum(L, 'ftm') !== pts) bad++
    if (L.some(l => l.fgm > l.fga || l.tpm > l.tpa || l.ftm > l.fta || l.tpa > l.fga || l.oreb > l.reb)) bad++
    const mins = sum(L, 'min'); if (Math.abs(mins - (240 + 25 * r.ot)) > 5) bad++
    if (L.filter(l => l.st).length !== 5) bad++
    for (const l of L) { maxPf = Math.max(maxPf, l.pf); if (l.pf >= 6) fouledOut++; hiMin = Math.max(hiMin, l.min); hiReg = Math.max(hiReg, l.min - 5 * r.ot) }
    const star = L.filter(l => l.st).sort((x, y) => y.pts - x.pts)[0]
    const margin = Math.abs(r.hs - r.as)
    if (margin >= 28) blowStar.push(star.min); else if (margin <= 4) closeStar.push(star.min)
  }
  // +/- adds to zero over both teams, five times the margin for each side
  const pmH = sum(r.box[h], 'pm'), pmA = sum(r.box[aw], 'pm')
  if (pmH !== 5 * (r.hs - r.as) || pmA !== -pmH) bad++
}
const ms = (performance.now() - t0) / 400
const mean = x => (x.reduce((s, y) => s + y, 0) / (x.length || 1)).toFixed(1)
ok(bad === 0, `400 games: points, makes, minutes (240 + 25 an overtime), five starters, +/- all add up (${bad} bad)`)
ok(maxPf <= 6, `nobody past six fouls (most: ${maxPf}); ${fouledOut} foul-outs in 800 team-games (the NBA: about one every ten games)`)
ok(blowStar.length > 5 && +mean(blowStar) < +mean(closeStar) - 4, `a blowout sits the starters: the top scorer plays ${mean(blowStar)} in 28-point games, ${mean(closeStar)} in games within 4`)
ok(hiReg <= 46, `the most minutes a man played: ${hiReg} past his overtimes' (in any game: ${hiMin}; a triple overtime is 63)`)
ok(ms < 8, `speed: ${ms.toFixed(2)} ms a game`)
console.log(`  (${otGames} overtime games in 400: the NBA has about 6%)`)

// 3. the user's rotation: his starters, his minutes
const T = F.teams.LAL
const byO = [...T.r].sort((x, y) => y.o - x.o)
const star = byO[0], bench = byO.slice(5)
T.rot = [bench[0].i, bench[1].i, byO[1].i, byO[2].i, byO[3].i, star.i, ...byO.slice(4).map(p => p.i).filter(i => i !== bench[0].i && i !== bench[1].i)]
T.min = { [star.i]: 24, [bench[0].i]: 30 }
const rot = C.rotationOf(F, 'LAL')
ok(rot.filter(x => x.st).map(x => x.i).includes(bench[0].i) && !rot.find(x => x.i === star.i).st, `rotationOf honours his starters (${bench[0].n} starts, ${star.n} comes off the bench)`)
ok(Math.abs(rot.reduce((s, x) => s + x.min, 0) - 240) < 1, `the targets fill 240 minutes (${rot.length} men in the rotation)`)
let sm = 0, bm = 0
for (let k = 0; k < 20; k++) { const r = C.simGame(F, 'LAL', 'PHX', { seed: `rot${k}` }); sm += r.box.LAL.find(l => l.i === star.i).min; bm += r.box.LAL.find(l => l.i === bench[0].i).min }
ok(Math.abs(sm / 20 - 24) < 4 && Math.abs(bm / 20 - 30) < 4, `his minutes: ${star.n} ${(sm / 20).toFixed(1)} (set 24), ${bench[0].n} ${(bm / 20).toFixed(1)} (set 30)`)
T.rot = null; T.min = null
const auto = C.rotationOf(F, 'LAL')
ok(auto.length >= 8 && auto.length <= 11 && auto.filter(x => x.st).length === 5, `the coach's own rotation: ${auto.length} men, starters ${auto.filter(x => x.st).map(x => Math.round(x.min)).join('/')} minutes`)

// 4. the key-moment seam
const G = C.startGame(F, 'DEN', 'OKC', { seed: 'mom1' })
C.playTo(G, 24)
ok(G.done || (G.per >= 4 && G.clock <= 24.01), `playTo stops with ${G.clock.toFixed(0)} seconds left in period ${G.per} (${G.sc.h}-${G.sc.a})`)
const jok = F.teams.DEN.r.find(p => p.n === 'Nikola Jokic'), murray = F.teams.DEN.r.find(p => p.n === 'Jamal Murray')
const before = G.sc.h, jb = G.box[jok.i].pts, ja = G.box[murray?.i]?.ast ?? 0
C.possession(G, 'DEN', { pts: 3, by: jok.i, ast: murray?.i, kind: 'three' })
ok(G.sc.h === before + 3 && G.box[jok.i].pts === jb + 3, `a moment's three counts: DEN ${before} → ${G.sc.h}, Jokic +3`)
ok(!murray || G.box[murray.i].ast === ja + 1, 'the moment\'s assist is credited')
const before2 = G.sc.a
C.possession(G, 'OKC', { pts: 0, by: F.teams.OKC.r[0].i, kind: 'rim' })
ok(G.sc.a === before2, 'a missed moment scores nothing')
// (the state is plain JSON: saved mid-moment and picked up again, it plays out the same)
const saved = JSON.stringify(G)
const G2 = JSON.parse(saved)
const res2 = C.finishGame(G2)
const res = C.finishGame(G)
ok(JSON.stringify(res) === JSON.stringify(res2), `a moment's game saved as JSON (${(saved.length / 1024).toFixed(1)} KB) and reloaded plays out the same`)
ok(!saved.includes('"teams"'), 'no F inside the saved game')
ok(sum(res.box.DEN, 'pts') === res.hs && sum(res.box.OKC, 'pts') === res.as && res.hs !== res.as, `finishGame: a final, ${res.hs}-${res.as}${res.ot ? ` (${res.ot}OT)` : ''}, the box adds up`)
ok(res.q.length >= 4 && res.q.reduce((s, q) => s + q[0], 0) === res.hs, 'the quarters add up to the final')

// 5. injuries off, rest
F.noInj = 1
const r = C.simGame(F, 'MIA', 'ATL', { seed: 'ni' })
for (let k = 0; k < 50; k++) C.rollInjuries(F, { d: k, h: 'MIA', a: 'ATL' }, r)
ok(![...F.teams.MIA.r, ...F.teams.ATL.r].some(p => p.inj), 'noInj: nobody is hurt')
delete F.noInj
let rested = 0
for (let k = 0; k < 400; k++) rested += C.restFor(F, 'PHI', { d: k }, true).length
const lebron = F.teams.PHI.r.find(p => p.n === 'LeBron James')
ok(rested > 20 && rested < 240, `load management: PHI rests a star on ${rested} of 400 second nights (LeBron is ${lebron?.ag})`)
ok(C.restFor(F, 'PHI', { d: 1, po: true }, true).length === 0, 'no rest in the playoffs')
console.log(fails ? `\n${fails} FAILED` : '\nall good')
if (fails) process.exitCode = 1
