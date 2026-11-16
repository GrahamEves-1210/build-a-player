// Career's trade demand at the deadline, end to end through lib/career.js (loaded the way the app loads it, through
// Vite): football and basketball careers played to the deadline, a demand made both ways (A CONTENDER, ANY TEAM) on
// many seeds, then the season played out and booked. Checks the odds, the team change, that the games left are the
// new team's, that the season line adds up, that the playoffs go by the new team's record, that a no keeps him,
// that a saved season picks back up the same, and that nothing throws.
// Run from the repo root:  node scripts/moments/deadline-check.mjs [careers-per-position]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const N = Number(process.argv[2] ?? 12)

const buildFor = (S, pos, r) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < 5; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
// one stop of the season the way the Career screen drives it (the first option of a card, sit out an injury, rest the bye)
function step(c, D) {
  if (C.byeNow(c)) return [C.byeRest(c, D), D]
  if (c.active.injury) return [C.resolveInjury(c, D, false, false)[0], D]
  if (c.active.moment) return [C.chooseMoment(c, D, c.active.moment.options[0])[0], D]
  return [C.advanceWeek(c, D)[0], D]
}
// to the deadline: the first stop the ask is open (or null: hurt for the season, say)
function toDeadline(c0) {
  let c = C.skipCombine(c0); c = C.runDraft(c)
  let D; [c, D] = C.startSeason(c)
  for (let g = 0; g < 900 && c.active.k < D.total; g++) {
    if (C.canDeadlineTrade(c)) return [c, D]
    if (C.deadlineGame(c) != null && c.active.k > C.deadlineGame(c)) return null
    ;[c, D] = step(c, D)
  }
  return null
}
function toEnd(c, D) {
  for (let g = 0; g < 900 && c.active.k < D.total; g++) [c, D] = step(c, D)
  let n = C.finishRegular(c, D)
  // the playoffs, if he's in: every round simulated
  for (let g = 0; g < 8 && n.phase === 'season' && n.active?.po && n.active.po.stage !== 'done'; g++) {
    const po = n.active.po, game = C.playoffGame(n, po)
    n = C.playoffRound(n, 0.6, game, seeded(`dl-po-${n.seed}-${po.idx}`)() < 0.6, null)
  }
  if (n.phase === 'season') n = C.bookSeason(n)
  return n
}
const COUNT = { qb: 'passYds', rb: 'rushYds', wr: 'recYds', te: 'recYds', db: 'tackles', dl: 'sacks', lb: 'tackles', ol: 'sacks', k: 'fgm', guard: 'pts', big: 'pts' }
const CASES = [['nfl', 'qb'], ['nfl', 'rb'], ['nfl', 'wr'], ['nfl', 'te'], ['nfl', 'db'], ['nfl', 'dl'], ['nfl', 'lb'], ['nfl', 'ol'], ['nfl', 'k'], ['bucket', 'guard'], ['bucket', 'big']]
let bad = 0
const tally = { contender: { asks: 0, yes: 0 }, any: { asks: 0, yes: 0 } }
const fail = (...m) => { bad++; console.log('PROBLEM', ...m) }
let seen = 0, oppBefore = 0, oppAfter = 0, made = 0, booked = 0, benchedAfter = 0, resumed = 0
for (const [sport, pos] of CASES) {
  if (C.ensureSport) await C.ensureSport(sport)
  const S = C.SPORT[sport]
  if (!S?.pool?.[pos]) { console.log(sport, pos, 'not in this build'); continue }
  for (let i = 0; i < N; i++) {
    let start = null
    for (let t = 0; t < 12 && !start; t++) {
      const rt = seeded(`dlcheck-${sport}-${pos}-${i}-${t}`)
      try { start = toDeadline(C.newCareer({ sport, pos, build: buildFor(S, pos, rt), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 })) } catch (e) { fail(sport, pos, i, 'to the deadline:', e.stack.split('\n').slice(0, 3).join(' | ')) }
    }
    if (!start) { console.log(sport, pos, i, 'never reached the deadline'); continue }
    seen++
    const [c0] = start
    const k0 = C.deadlineGame(c0)
    if (!(c0.active.k <= k0)) fail('deadline past', c0.active.k, k0)
    if (sport === 'nfl' && !(C.weekOfGame(c0, c0.active.k) >= 7 && C.weekOfGame(c0, c0.active.k) <= 9)) fail('football deadline week', C.weekOfGame(c0, c0.active.k))
    if (sport === 'bucket' && !(c0.active.k >= 40 && c0.active.k <= 52)) fail('basketball deadline game', c0.active.k)
    for (const aim of ['contender', 'any']) {
      try {
        // (a fresh director for each ask: the screen's, rebuilt from the save)
        const c = JSON.parse(JSON.stringify(c0)), D = C.resumeSeason(c)
        const before = D.games.slice(0, c.active.k).map(g => JSON.stringify(g))
        const oldName = S.teamOf(c.team).name
        const [n, D2] = C.deadlineTrade(c, D, aim)
        tally[aim].asks++
        const yes = n.team !== c.team
        if (yes) tally[aim].yes++
        if (n.rep !== Math.max(1, c.rep - 2)) fail('reputation', c.rep, n.rep)
        if (!n.tradeAsked) fail('tradeAsked not set')
        if (C.canDeadlineTrade(n) && !n.tradeAsked) fail('can ask twice')
        const again = C.deadlineTrade(n, D2, aim)[0]
        if (again.team !== n.team || again.rep !== n.rep) fail('asked twice')
        if (!yes) {
          if (aim === 'any') fail('ANY TEAM turned down')
          if (D2 !== D) fail('a no made a new director')
          if (!n.active.deadline || n.active.deadline.granted) fail('a no not on the season')
        } else {
          const k = n.active.k, dl = n.active.deadline
          if (!dl?.granted || dl.from !== c.team || dl.to !== n.team) fail('deadline record', dl)
          if (n.contract.left !== c.contract.left || n.contract.perYear !== c.contract.perYear || n.contract.starter) fail('contract', c.contract, n.contract)
          if (D2.games.slice(0, k).some((g, j) => JSON.stringify(g) !== before[j])) fail('the games he played changed', sport, pos)
          // the games left: the new team's schedule (never against itself; how often the old one had them)
          if (sport === 'nfl') {
            const newName = S.teamOf(n.team).name
            if (D.games.slice(k).some(g => g.opponent === newName)) oppBefore++
            if (D2.games.slice(k).some(g => g.opponent === newName)) { oppAfter++; fail('the new team plays itself', newName) }
          }
          if (n.active.benched) benchedAfter++
          // a save picks back up the same
          const back = C.resumeSeason(JSON.parse(JSON.stringify(n)))
          if (JSON.stringify(back.games) !== JSON.stringify(D2.games)) fail('resume differs', sport, pos)
          else resumed++
        }
        // play it out
        let e = toEnd(n, D2)
        const s = e.seasons[e.seasons.length - 1]
        booked++
        const T = D2.total
        if (s.wins + s.losses !== T) fail('record', s.wins, s.losses, T)
        if (yes) {
          if (s.team !== n.team || !s.from || s.from.team !== c.team) fail('season team', s.team, s.from)
          // his record: his games, both teams'
          if (s.from.wins + s.from.losses !== n.active.deadline.k) fail('record with the old team', s.from)
          // the team's record decides the playoffs: the new team's games before him, then his
          const fin = n.active.deadline.pre.wins + (s.wins - s.from.wins)
          if (s.from.teamWins !== fin) fail('team record', s.from.teamWins, fin)
          if (s.playoffs) made++
          if (s.playoffs && !C.SPORT[sport].made({ wins: s.from.teamWins, playoffs: true, playoffRounds: [{ won: true }, { won: true }], ...(sport === 'bucket' ? { playoffRounds: [1] } : {}) })) fail('playoffs on a team record that misses', s.from.teamWins)
          for (const r of s.rounds ?? []) if (r.opponent === S.teamOf(n.team).name) fail('playoffs against his own team', r.opponent)
          if (s.rounds?.length && s.rounds.some(r => r.opponent === undefined)) fail('round with no opponent')
          if (e.team !== n.team && !e.traded) fail('team after booking', e.team, n.team)
          if (s.stats[COUNT[pos]] == null && !['ol', 'k'].includes(pos)) fail('stat missing', pos, COUNT[pos], Object.keys(s.stats))
          // the next summer is the next year of the deal: he can ask again there
          if (e.tradeAsked) fail('the summer ask is gone after a deadline ask')
        } else if (s.team !== c.team || s.from) fail('a no moved him', s.team)
        if (i === 0) console.log(`${sport}/${pos} ${aim}: k ${c.active.k}/${T} ${yes ? `${oldName} -> ${S.teamOf(n.team).name} (${n.role}${n.active.benched ? `, behind ${n.active.benched.behind}` : ''})` : 'turned down'} | season ${s.wins}-${s.losses}${s.from ? ` (${s.from.wins}-${s.from.losses} with the old team; team ${s.from.teamWins}-${s.from.teamLosses})` : ''} ${s.playoffs ? `playoffs ${s.rounds.map(r => (r.won ? 'W' : 'L')).join('')}` : 'no playoffs'}`)
      } catch (e) { fail(sport, pos, i, aim, e.stack.split('\n').slice(0, 4).join(' | ')) }
    }
  }
}
// the stats add up: one season line for both teams (the counts are the games' own, before and after the trade)
{
  await C.ensureSport?.('nfl')
  const S = C.SPORT.nfl
  let checked = 0
  for (let i = 0; i < 6 && checked < 3; i++) {
    const st = toDeadline(C.newCareer({ sport: 'nfl', pos: 'rb', build: buildFor(S, 'rb', seeded(`dlsum-${i}`)), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 }))
    if (!st) continue
    const [n, D2] = C.deadlineTrade(st[0], st[1], 'any')
    let c = n, D = D2
    for (let g = 0; g < 900 && c.active.k < D.total; g++) [c, D] = step(c, D)
    const f = D.finalize()
    const sum = f.games.reduce((a, g) => a + (g.rushYds ?? 0), 0)
    if (f.seasonRushYds !== sum) fail('rushing yards', f.seasonRushYds, sum)
    const k = n.active.deadline.k
    const split = D.games.slice(0, k).reduce((a, g) => a + (g.rushYds ?? 0), 0) + D.games.slice(k).reduce((a, g) => a + (g.rushYds ?? 0), 0)
    if (split !== sum) fail('split', split, sum)
    console.log(`rb season line: ${f.seasonRushYds} yards = ${D.games.slice(0, k).reduce((a, g) => a + (g.rushYds ?? 0), 0)} with the ${n.active.deadline.fromName} + ${D.games.slice(k).reduce((a, g) => a + (g.rushYds ?? 0), 0)} with the ${n.active.deadline.toName}`)
    checked++
  }
}
// a summer ask uses up the deadline's (one ask a contract year)
{
  await C.ensureSport?.('nfl')
  const S = C.SPORT.nfl
  const st = toDeadline(C.newCareer({ sport: 'nfl', pos: 'wr', build: buildFor(S, 'wr', seeded('dl-summer')), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 }))
  if (st) {
    const c = { ...st[0], tradeAsked: true }
    const [n] = C.deadlineTrade(c, st[1], 'any')
    if (n.team !== c.team || n.rep !== c.rep) fail('asked at the deadline after the summer ask')
    else console.log('summer ask: the deadline ask is gone that year (ok)')
  }
}
// the odds on their own: one career at the deadline, the ask made on 600 careers' seeds
const odds = { contender: { asks: 0, yes: 0 }, any: { asks: 0, yes: 0 } }
{
  await C.ensureSport?.('bucket')
  const S = C.SPORT.bucket
  const st = toDeadline(C.newCareer({ sport: 'bucket', pos: 'guard', build: buildFor(S, 'guard', seeded('dl-odds')), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 }))
  if (st) for (let i = 0; i < 600; i++) for (const aim of ['contender', 'any']) {
    if (aim === 'any' && i % 10) continue
    const c = { ...JSON.parse(JSON.stringify(st[0])), seed: `odds-${i}` }
    const [n] = C.deadlineTrade(c, C.resumeSeason(c), aim)
    odds[aim].asks++
    if (n.team !== c.team) odds[aim].yes++
  }
}
const pct = x => (x.asks ? `${Math.round((x.yes / x.asks) * 1000) / 10}%` : '-')
console.log(`deadlines reached ${seen} | A CONTENDER granted ${tally.contender.yes}/${tally.contender.asks} (${pct(tally.contender)}) | ANY TEAM granted ${tally.any.yes}/${tally.any.asks} (${pct(tally.any)})`)
console.log(`seasons booked ${booked} | traded into the playoffs ${made} | traded onto the bench ${benchedAfter} | resumed the same ${resumed} | old schedule had the new team left ${oppBefore}, new schedule ${oppAfter}`)
console.log(`odds alone: A CONTENDER granted ${odds.contender.yes}/${odds.contender.asks} (${pct(odds.contender)}) | ANY TEAM ${odds.any.yes}/${odds.any.asks} (${pct(odds.any)})`)
if (Math.abs(odds.contender.yes / Math.max(1, odds.contender.asks) - 0.7) > 0.06) fail('contender odds off 70%')
if (odds.any.yes !== odds.any.asks) fail('ANY TEAM not always granted')
console.log(`${bad} problems`)
await server.close()
process.exit(bad ? 1 : 0)
