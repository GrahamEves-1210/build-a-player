// NBA Franchise: short rosters. The sim with 0-14 men (cut, or hurt), the box's arithmetic every time, the roster
// floor (a team under 13 signs back up before the night), the Waive button's floor, two-way men (no playoffs, 50
// games), DNP reasons, and the box minutes adding to 240 (265 an overtime).
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-shorthanded.mjs
import * as N from '../../src/lib/franchise2/nba/index'
import * as C from '../../src/lib/franchise2/nba/sim'
import { twGames, TW_GAMES, dressed } from '../../src/lib/franchise2/nba/rotation'

let fails = 0
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m) } else console.log('  ok   ' + m) }
const sum = (L, k) => L.reduce((s, l) => s + (l[k] ?? 0), 0)
const fresh = () => N.createNbaFranchise({ seed: 'short', team: 'BOS', owner: 'G' })

// 1. 0-14 men: cut down, then hurt down
for (const how of ['cut', 'hurt']) {
  const bad = [], threw = []
  for (let n = 0; n <= 14; n++) {
    const F = fresh(), T = F.teams.BOS
    const men = T.r.filter(p => !p.tw).sort((a, b) => b.o - a.o)
    T.r = T.r.filter(p => !p.tw)
    if (how === 'cut') T.r = men.slice(0, n)
    else men.slice(n).forEach(p => { p.inj = { g: 5, k: 'sprained left ankle' } })
    for (let k = 0; k < 30; k++) {
      let r
      try { r = C.simGame(F, k % 2 ? 'BOS' : 'NYK', k % 2 ? 'NYK' : 'BOS', { seed: `sh-${how}-${n}-${k}` }) } catch (e) { threw.push(`${n} men: ${String(e.message)}`); continue }
      for (const [s, L] of Object.entries(r.box)) {
        const pts = sum(L, 'pts'), want = s === Object.keys(r.box)[0] ? r.hs : r.as
        const played = L.filter(l => l.min > 0)
        if (r.ff) continue
        if (pts !== (s === (k % 2 ? 'BOS' : 'NYK') ? r.hs : r.as)) bad.push(`${how} ${n}: ${s} box ${pts} score ${want}`)
        const m = sum(L, 'min'), five = Math.min(5, played.length)
        if (played.length >= 5 && m !== 240 + 25 * r.ot) bad.push(`${how} ${n}: ${s} minutes ${m}`)
        if (played.length < 5 && s !== 'BOS') bad.push(`${how} ${n}: ${s} only ${played.length} played`)
        if (s === 'BOS' && five < Math.min(5, n) && how === 'cut') bad.push(`${how} ${n}: BOS played ${played.length}`)
      }
    }
  }
  ok(!threw.length, `${how} to 0-14 men: nothing throws${threw.length ? ` (${threw.slice(0, 3).join('; ')})` : ''}`)
  ok(!bad.length, `${how}: every box adds up to the score and 240 minutes${bad.length ? ` (${bad.slice(0, 4).join('; ')})` : ''}`)
}
{
  // hurt to three: the day-to-day men suit up so five play
  const F = fresh(), T = F.teams.BOS
  T.r = T.r.filter(p => !p.tw)
  T.r.slice(3).forEach((p, k) => { p.inj = { g: 2 + k, k: 'illness' } })
  const r = C.simGame(F, 'BOS', 'NYK', { seed: 'three' })
  const L = r.box.BOS
  ok(L.filter(l => l.min > 0).length === 5 && L.filter(l => l.dnp === 'inj').length === T.r.length - 5, `three healthy: the two shortest injuries suit up (5 play, ${L.filter(l => l.dnp === 'inj').length} out hurt)`)
  const F0 = fresh(); F0.teams.BOS.r = []
  const r0 = C.simGame(F0, 'BOS', 'NYK', { seed: 'none' })
  ok(r0.ff === 'BOS' && r0.as === 2 && r0.hs === 0, `nobody at all: a 2-0 forfeit (${r0.hs}-${r0.as}, ff ${r0.ff})`)
}

// 2. the roster floor: the GM's team cut to 7 signs back to 14 on opening night; at 13 it gets two weeks
{
  const F = fresh(), T = F.teams.BOS
  while (T.r.filter(p => !p.tw).length > 7) { const p = T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0]; T.r = T.r.filter(x => x !== p); F.fa.push(p) }
  let err = null
  try { N.playDay(F) } catch (e) { err = e.message }
  ok(!err && T.r.filter(p => !p.tw).length === 14, `cut to 7 before opening night: signs back to ${T.r.filter(p => !p.tw).length} (${err ?? 'no error'})`)
  const p = T.r.filter(x => !x.tw)[13]
  ok(N.cutBlock(F, p.i) === null, 'at 14 he can waive a man')
  N.CAP_SIM.cutMan(F, 'BOS', p.i)
  ok(T.r.filter(x => !x.tw).length === 13, 'waived to 13')
  const q = T.r.filter(x => !x.tw)[12]
  ok(typeof N.cutBlock(F, q.i) === 'string', `at 13 the Waive button says: "${N.cutBlock(F, q.i)}"`)
  N.CAP_SIM.cutMan(F, 'BOS', q.i)
  ok(T.r.filter(x => !x.tw).length === 13, 'and cutMan itself won\'t take him under 13')
  for (let k = 0; k < 6; k++) N.playDay(F)
  ok(T.r.filter(x => !x.tw).length === 13, 'a week at 13: still 13')
  N.simTo(F, F.day + 12)
  ok(T.r.filter(x => !x.tw).length === 14, 'two weeks at 13: back to 14')
}

// 3. a season: two-way men (50 games, not in the playoffs), DNP reasons, every man who played in the totals
{
  const F = N.createNbaFranchise({ seed: 'short-season', team: 'BOS', owner: 'G' })
  let mism = 0, minBad = 0, dnpKinds = {}, lines = 0
  const twIds = new Set(N.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.tw).map(p => p.i)))
  const box = []
  while (F.phase === 'season') {
    const before = F.box?.length ?? 0
    N.playDay(F)
    if ((F.box?.length ?? 0) !== before || F.box?.length === 12) box.push(F.box.at(-1))
  }
  for (const b of box.slice(-30)) for (const [s, L] of Object.entries(b.box)) {
    for (const l of L) if (l.dnp) dnpKinds[l.dnp] = (dnpKinds[l.dnp] ?? 0) + 1
    if (sum(L, 'min') !== 240 + 25 * (b.ot ?? 0)) minBad++
    if (sum(L, 'pts') !== (s === b.h ? b.hs : b.as)) mism++
    lines += L.length
  }
  ok(!minBad && !mism, `the GM's boxes: minutes are 240 (265 an overtime) and the points the score (${minBad} / ${mism} off)`)
  ok(dnpKinds.cd > 0, `DNP reasons on the box lines: ${JSON.stringify(dnpKinds)}`)
  // season totals: every game's points are in F.ss (sum of the league's points = the scores')
  const tot = Object.values(F.ss).reduce((s, r) => s + (r.pts ?? 0), 0), sc = F.sched.reduce((s, g) => s + (g.hs ?? 0) + (g.as ?? 0), 0)
  ok(tot === sc, `season totals hold every point scored (${tot} = ${sc})`)
  const tw = N.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.tw))
  const most = Math.max(0, ...tw.map(p => F.ss[p.i]?.gp ?? 0)), act = Math.max(0, ...tw.map(p => twGames(p, F.year)))
  ok(most <= TW_GAMES && act <= TW_GAMES, `two-way men: ${most} games at most (${act} with the team; the limit is ${TW_GAMES})`)
  N.startPostseason(F); N.simPostseason(F)
  const twPo = Object.keys(F.ps).filter(i => twIds.has(+i) && F.ps[i].gp > 0)
  ok(!twPo.length, `no two-way man plays in the playoffs (${twPo.length})`)
  ok(N.SHORTS.every(s => !dressed(F.teams[s], { po: true }).some(p => p.tw)), 'dressed() leaves them out of a playoff game')
}
console.log(fails ? `\n${fails} FAILED` : '\nall good')
