// Career's trade demand in the summer (the offseason's DEMAND A TRADE), through lib/career.js loaded the way the app
// loads it (Vite): careers played through a season to the offseason, then each ask the sheet offers (A CONTENDER,
// ANY TEAM; soccer's transfer request) on many seeds. Checks that nothing throws, that a yes moves him to another
// team with its roster, a no keeps him with a line saying so, reputation drops two either way, and he can't ask twice.
// (2026-11-19: every granted summer ask threw, so the screen never moved.)
// Run from the repo root:  node scripts/moments/offseason-trade-check.mjs [careers-per-position]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const N = Number(process.argv[2] ?? 6)

const buildFor = (S, pos, r) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < 5; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
function step(c, D) {
  if (C.byeNow?.(c)) return [C.byeRest(c, D), D]
  if (c.active.injury) return [C.resolveInjury(c, D, false, false)[0], D]
  if (c.active.moment) return [C.chooseMoment(c, D, c.active.moment.options[0])[0], D]
  return [C.advanceWeek(c, D)[0], D]
}
// a season played and booked: the summer after it
function toSummer(c0) {
  let c = C.skipCombine(c0); c = C.runDraft(c)
  let D; [c, D] = C.startSeason(c)
  for (let g = 0; g < 900 && c.active.k < D.total; g++) [c, D] = step(c, D)
  let n = C.finishRegular(c, D)
  for (let g = 0; g < 8 && n.phase === 'season' && n.active?.po && n.active.po.stage !== 'done'; g++) {
    const po = n.active.po, game = C.playoffGame(n, po)
    n = C.playoffRound(n, 0.6, game, seeded(`ot-po-${n.seed}-${po.idx}`)() < 0.6, null)
  }
  if (n.phase === 'season') n = C.bookSeason(n)
  return n
}
const CASES = [['nfl', 'qb'], ['nfl', 'wr'], ['nfl', 'db'], ['nfl', 'k'], ['bucket', 'guard'], ['bucket', 'big']]   // (soccer: not live, its transfer request isn't checked here)
let bad = 0
const fail = (...m) => { bad++; console.log('PROBLEM', ...m) }
const tally = {}
for (const [sport, pos] of CASES) {
  if (C.ensureSport) { try { await C.ensureSport(sport) } catch { console.log(sport, 'not in this build'); continue } }
  const S = C.SPORT[sport]
  if (!S?.pool?.[pos]) { console.log(sport, pos, 'not in this build'); continue }
  const aims = sport === 'soccer' ? ['contender'] : ['contender', 'any']
  for (let i = 0; i < N; i++) {
    let c0
    try { c0 = toSummer(C.newCareer({ sport, pos, build: buildFor(S, pos, seeded(`otcheck-${sport}-${pos}-${i}`)), name: 'Cole Norwood', owner: 'Guest', games: 'off', slot: 0 })) } catch (e) { fail(sport, pos, i, 'to the summer:', e.stack.split('\n').slice(0, 3).join(' | ')); continue }
    if (c0.phase !== 'offseason') { console.log(sport, pos, i, 'not in the offseason:', c0.phase); continue }
    for (const aim of aims) {
      const key = `${sport}/${aim}`, t = (tally[key] ??= { asks: 0, yes: 0 })
      try {
        const c = JSON.parse(JSON.stringify(c0))
        if (c.tradeAsked) fail('asked already at the start of the summer')
        const n = C.demandTrade(c, aim)
        t.asks++
        const yes = n.team !== c.team
        if (yes) t.yes++
        if (!n.tradeAsked) fail(key, 'tradeAsked not set')
        if (n.rep !== Math.max(1, c.rep - 2)) fail(key, 'reputation', c.rep, n.rep)
        if (C.demandTrade(n, aim) !== n) fail(key, 'asked twice')
        const last = n.events[n.events.length - 1]?.text ?? ''
        if (yes) {
          if (!n.roster || !n.fit || n.fit.name !== S.teamOf(n.team).name) fail(key, 'moved without the new team', n.team, n.fit?.name)
          if (n.contract.starter) fail(key, 'the old team\'s starter promise went with him')
        } else {
          if (aim === 'any' && sport !== 'soccer') fail(key, 'ANY TEAM turned down')
          if (!/no|turned|won't|refus/i.test(last)) fail(key, 'a no without a line', last)
        }
        // the next season starts with whichever team he's on
        const [s] = C.startSeason(C.nextSeason(n))
        if (s.team !== n.team) fail(key, 'the season started elsewhere')
        if (i === 0) console.log(`${key} ${pos}: ${S.teamOf(c.team).name} -> ${yes ? S.teamOf(n.team).name : 'stays'} | ${last}`)
      } catch (e) { fail(key, pos, i, e.stack.split('\n').slice(0, 4).join(' | ')) }
    }
  }
}
for (const [k, t] of Object.entries(tally)) console.log(`${k}: ${t.yes}/${t.asks} granted`)
console.log(bad ? `${bad} PROBLEMS` : 'ALL GOOD')
await server.close()
process.exit(bad ? 1 : 0)
