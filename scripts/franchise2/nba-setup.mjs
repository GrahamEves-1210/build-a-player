// NBA Franchise, the setup's previews against the league that really starts (lib/franchise2/nba/setup.js):
//   the PLAYERS step names the man a full roster waives for each build: the same men createNbaFranchise waives, by
//   name, for every team, three seeds, three orders of builds, the cap on and off
//   last season's records: 30 teams, 82 games each, wins = losses, 16 playoff teams, six division champions, one champion
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-setup.mjs
import * as N from '../../src/lib/franchise2/nba/index'
import { lastSeason, setupLeague, buildWaives, setupStarters, fixSetup } from '../../src/lib/franchise2/nba/setup'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs'
let bad = 0
const fail = (...m) => { bad++; console.log('  FAIL', ...m) }
const asB = a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { val: v }]))
const G = NBA_GUARD_PLAYERS.filter(p => p.attrs).slice(0, 5), B = NBA_BIG_PLAYERS.filter(p => p.attrs).slice(0, 5)
// (one build a spot, PG..C, in the order the GM added them)
const ORDERS = [['PG', 'SG', 'C'], ['C', 'PG', 'SF'], ['PF', 'C', 'SG'], ['PG'], [], ['SF', 'PG', 'C', 'SG', 'PF']]
const grp = k => (k === 'PF' || k === 'C' ? 'big' : 'guard')
let n = 0, waived = 0, ms = 0, starts = 0, benched = 0
for (const seed of ['su-a', 'su-b', 'su-c']) for (const team of N.SHORTS) for (const [oi, order] of ORDERS.entries()) {
  const rules = { cap: (n + oi) % 4 !== 0, inj: (n + oi) % 5 !== 0 }
  const picks = order.map((spot, k) => ({ id: `b${k}`, pos: grp(spot), spot }))
  const builds = Object.fromEntries(picks.map((p, k) => [p.id, { pos: p.pos, build: asB((p.pos === 'big' ? B : G)[k].attrs), name: `Test Build${k}`, num: 90 + k }]))
  const S = { seed, team, picks, builds, rules }
  const t0 = Date.now()
  const out = buildWaives(S)
  ms += Date.now() - t0
  // the franchise, the way NbaFranchise starts it (the builds in S.picks' order)
  const F = N.createNbaFranchise({ seed, team, owner: 'G', rules, builds: picks.map(p => ({ ...builds[p.id], spot: p.spot })) })
  // day one: every build starts at his spot, in the place of the man the setup said he replaces (on the bench, still
  // on the roster unless he is the man waived); the rest of the five is the coach's
  const five = setupStarters(S), T = F.teams[team]
  const rot = N.CAP_SIM.rotationOf(F, team), st = new Set(rot.filter(x => x.st).map(x => x.i))
  const want = new Set(N.SPOTS.map(k => (order.includes(k) ? T.r.find(x => x.b != null && F.builds[x.b].spot === k)?.i : T.r.find(x => x.n === five[k]?.n)?.i)))
  for (const k of order) { const b = T.r.find(x => x.b != null && x.p === k); if (!b) fail(seed, team, 'no build at', k); else if (!st.has(b.i)) fail(seed, team, 'build at', k, 'not starting'); else starts++ }
  for (const k of order) { const m = five[k], r = m && T.r.find(x => x.n === m.n); if (m && !Object.values(out).some(w => w.n === m.n) && !r) fail(seed, team, m.n, 'replaced at', k, 'but gone'); if (r && st.has(r.i)) fail(seed, team, m.n, 'replaced at', k, 'still starts'); if (r) benched++ }
  if ([...want].some(i => i == null) || [...want].some(i => !st.has(i)) || st.size !== 5) fail(seed, team, order.join('/'), 'the five', [...st].map(i => T.r.find(x => x.i === i)?.n).join(', '))
  // the GM's own order overrides: his five start (rotation.js setOf: no bst with T.rot)
  if (order.length) { const T2 = { ...T, rot: rot.map(x => x.i).reverse() }; const set = N.CAP_SIM.rotationOf({ ...F, teams: { ...F.teams, [team]: T2 } }, team); const b5 = new Set(T2.rot.filter(i => set.some(x => x.i === i)).slice(0, 5)); if (set.filter(x => x.st).some(x => !b5.has(x.i))) fail(seed, team, 'the GM order not honoured with builds') }
  // (the wire's signing item for each build: "Test Build0, a ... signs with ...; X is waived", with or without the
  // wire's full stop)
  const real = Object.fromEntries(picks.map((p, k) => { const x = F.news.find(n => n.k === 'sign' && n.s === team && n.text.startsWith(`Test Build${k},`)); return [p.id, x?.text.match(/; (.+) is waived\.?$/)?.[1] ?? null] }))
  for (const p of picks) if ((out[p.id]?.n ?? null) !== real[p.id]) fail(seed, team, order.join('/'), p.id, 'the setup says', out[p.id]?.n ?? 'nobody', '· the league waived', real[p.id] ?? 'nobody')
  for (const p of picks) { const m = out[p.id]; if (m && F.teams[team].r.some(x => x.n === m.n)) fail(seed, team, m.n, 'named as waived but still on the roster') }
  if (F.teams[team].r.filter(x => x.b != null).length !== picks.length) fail(seed, team, 'builds on the roster', F.teams[team].r.filter(x => x.b != null).length)
  n++; waived += Object.values(real).filter(Boolean).length
}
// the same league twice: the cache is by seed, team and rules
const a = setupLeague({ seed: 'su-a', team: 'BOS' }), b = setupLeague({ seed: 'su-a', team: 'BOS' }), c = setupLeague({ seed: 'su-a', team: 'NYK' })
if (a !== b || a === c) fail('setupLeague cache')
console.log(`waive previews: ${n} setups, ${waived} men waived, ${(ms / n).toFixed(1)} ms a preview · day one: ${starts} builds starting at their spots, ${benched} replaced starters to the bench`)
// a setup from before (guards and bigs, ROTATIONS, PACE AND SPACE) in today's shape
{
  const S = { seed: 'old', team: 'BOS', picks: [{ id: 'a', pos: 'guard' }, { id: 'b', pos: 'guard' }, { id: 'c', pos: 'big' }], builds: { a: { pos: 'guard', build: asB(G[0].attrs), name: 'A B' } }, cb: { lines: { rot: { v: 7, from: 'X', t: 'MIA' } } }, coach: { style: 'pace' } }
  const X = fixSetup(S)
  if (!X || X.picks.length !== 3 || new Set(X.picks.map(p => p.spot)).size !== 3 || X.picks.some(p => grp(p.spot) !== p.pos) || !X.cb.lines.cul || X.cb.lines.rot || X.coach.style !== 'motivator') fail('old setup', JSON.stringify(X))
  if (fixSetup(X) !== null) fail('old setup fixed twice')
  const Y = fixSetup({ ...S, picks: [...S.picks, { id: 'd', pos: 'big' }, { id: 'e', pos: 'big' }] })
  if (Y.picks.length !== 4) fail('old setup with three bigs', Y.picks.map(p => p.spot).join())
}
// the staff and its searches: no surname twice (the head coach, the three assistants, the fifteen candidates), in the
// setup; and in an offseason search (the GM's staff, the candidates, the man from within)
const sur = n => String(n).split(' ').slice(-1)[0]
let lists = 0
for (const seed of ['su-a', 'su-b', 'su-c', 'su-d']) for (const team of N.SHORTS) {
  const men = [N.NC.realHC(team).name, ...N.NC.JOBS.flatMap(k => N.NC.setupCandidates(seed, team, k).map(c => c.n))]
  if (men.length !== 19) fail(seed, team, 'candidates', men.length)
  if (new Set(men.map(sur)).size !== men.length) fail(seed, team, 'a surname twice in the setup:', men.map(sur).sort().filter((x, i, a) => a[i - 1] === x).join(', '))
  const again = N.NC.JOBS.flatMap(k => N.NC.setupCandidates(seed, team, k).map(c => c.n))
  if (again.join() !== men.slice(1).join()) fail(seed, team, 'the candidates change between reads')
  lists++
}
{
  const F = N.createNbaFranchise({ seed: 'su-off', team: 'DET', owner: 'G', coach: { name: 'Grant Mercer', r: { dev: 6, off: 6, def: 6, cul: 6, late: 6 }, style: 'developer', face: null } })
  for (let y = 0; y < 3; y++) {
    N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
    for (const k of N.NC.JOBS) {
      const M = N.NC.staffMen(F, F.team), list = N.NC.staffCandidates(F, k)
      const men = [...Object.values(M).filter(Boolean).map(c => c.n), ...list.map(c => c.n)]
      if (new Set(men.map(sur)).size !== men.length) fail(F.year, k, 'a surname twice in the offseason search:', men.map(sur).sort().filter((x, i, a) => a[i - 1] === x).join(', '))
      if (list.length < 3) fail(F.year, k, 'a short search', list.length)   // (the first summer's pool is thin: three men a job at least)
    }
    for (const s of N.SHORTS) { const men = Object.values(N.NC.staffMen(F, s)).filter(Boolean).map(c => sur(c.n)); if (new Set(men).size !== men.length) fail(F.year, s, 'a surname twice on one staff:', men.sort().filter((x, i, a) => a[i - 1] === x).join(', ')) }
    while (F.phase === 'off') {
      if (F.off.step === 'camp') {
        const T = F.teams[F.team]
        while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw && p.b == null).sort((a, c) => a.o - c.o)[0].i)
        for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
      }
      N.nextStep(F)
    }
    for (const s of N.SHORTS) { const men = Object.values(N.NC.staffMen(F, s)).filter(Boolean).map(c => sur(c.n)); if (new Set(men).size !== men.length) fail(F.year, s, 'a surname twice on one staff after the summer:', men.sort().filter((x, i, a) => a[i - 1] === x).join(', ')) }
  }
}
console.log(`staff surnames: ${lists} setups and three offseasons' searches`)
// last season
const L = N.SHORTS.map(s => [s, lastSeason(s)])
if (L.some(([, x]) => !x)) fail('last season: a team is missing', L.filter(([, x]) => !x).map(x => x[0]).join())
else {
  const sum = k => L.reduce((t, [, x]) => t + x[k], 0)
  if (L.some(([, x]) => x.w + x.l !== 82)) fail('last season: not 82 games', L.filter(([, x]) => x.w + x.l !== 82).map(x => x[0]).join())
  if (sum('w') !== 1230 || sum('l') !== 1230) fail('last season: wins', sum('w'), 'losses', sum('l'))
  const po = L.filter(([, x]) => !/PLAY-IN|MISSED/.test(x.end)), pi = L.filter(([, x]) => /PLAY-IN/.test(x.end))
  if (po.length !== 16 || pi.length !== 4) fail('last season: playoff teams', po.length, 'play-in losers', pi.length)
  for (const c of ['E', 'W']) if (po.filter(([s]) => N.CONF_OF[s] === c).length !== 8) fail('last season: eight a conference', c)
  if (L.filter(([, x]) => x.champ).length !== 1 || L.filter(([, x]) => x.end === 'LOST NBA FINALS').length !== 1) fail('last season: one champion, one runner-up')
  const divs = L.filter(([, x]) => x.div)
  if (divs.length !== 6 || new Set(divs.map(([, x]) => x.div)).size !== 6) fail('last season: six division champions', divs.map(x => x[0]).join())
  // (a division's champion has its best record)
  for (const [s, x] of divs) for (const o of N.DIVS[N.DIV_OF[s]]) if (lastSeason(o).w > x.w) fail('last season:', s, 'won the', x.div, 'behind', o)
  for (const [c, word] of [['E', 'EAST'], ['W', 'WEST']]) {
    if (L.filter(([s, x]) => N.CONF_OF[s] === c && (x.end === `LOST ${word} FINALS` || /NBA FINALS/.test(x.end))).length !== 2) fail('last season: conference finalists', c)
    if (L.filter(([s, x]) => N.CONF_OF[s] !== c && x.end.includes(word)).length) fail('last season: a team in the wrong conference', c)
  }
  console.log(`last season: ${L.length} teams, champion ${L.find(([, x]) => x.champ)[0]}, division champions ${divs.map(x => x[0]).join(' ')}`)
}
console.log(bad ? `${bad} FAILED` : 'ALL OK')
process.exit(bad ? 1 : 0)
