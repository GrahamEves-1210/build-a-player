// Career's schedules, football and basketball (lib/leagueSchedule.js), checked two ways:
//   1. the draw itself, every team over many seasons: football's 17 (each division rival home and away, 4 + 4 + 2 + 1
//      others, nobody else twice, 8 or 9 at home, the last game in the division, both sides of every game agree);
//      basketball's 82 (4 / 4-or-3 / 2, 41 at home, never the same team two games running)
//   2. whole seasons played the way the Career screen plays them (decisions taken, the bye, injuries), then the
//      season's games as they ended up: the same schedule, after every re-run of the season.
// Run from the repo root:  node scripts/moments/schedule-check.mjs [seasons] [careers]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const L = await server.ssrLoadModule('/src/lib/leagueSchedule.js')
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const { NFL_TEAMS } = await server.ssrLoadModule('/src/data/nfl-teams.js')
const SEASONS = Number(process.argv[2] ?? 12), CAREERS = Number(process.argv[3] ?? 6)
let bad = 0
const fail = (...a) => { bad++; if (bad < 40) console.log('FAIL', ...a) }

// ── 1. the draw ──
const T = Object.fromEntries(NFL_TEAMS.map(t => [t.short, t]))
const place = sh => T[sh].off + T[sh].def
let homeN = { 8: 0, 9: 0 }
for (let s = 2026; s < 2026 + SEASONS; s++) {
  const all = Object.fromEntries(NFL_TEAMS.map(t => [t.short, L.nflSchedule(t.short, s, place)]))
  for (const t of NFL_TEAMS) {
    const g = all[t.short], cnt = {}
    for (const x of g) cnt[x.short] = (cnt[x.short] ?? 0) + 1
    if (g.length !== 17) fail(s, t.short, 'games', g.length)
    const div = NFL_TEAMS.filter(o => o.div === t.div && o.short !== t.short)
    for (const o of div) { const h = g.filter(x => x.short === o.short); if (h.length !== 2 || h[0].home === h[1].home) fail(s, t.short, 'division', o.short, h.length) }
    const others = g.filter(x => T[x.short].div !== t.div)
    if (others.length !== 11 || new Set(others.map(x => x.short)).size !== 11) fail(s, t.short, 'non-division repeats')
    if (cnt[t.short]) fail(s, t.short, 'plays itself')
    const byDiv = {}
    for (const x of others) byDiv[T[x.short].div] = (byDiv[T[x.short].div] ?? 0) + 1
    const sameConf = Object.entries(byDiv).filter(([d]) => d.startsWith(t.conf)).map(([, n]) => n).sort().join(',')
    const otherConf = Object.entries(byDiv).filter(([d]) => !d.startsWith(t.conf)).map(([, n]) => n).sort().join(',')
    if (sameConf !== '1,1,4') fail(s, t.short, 'conference shape', sameConf)
    if (otherConf !== '1,4') fail(s, t.short, 'other conference shape', otherConf)
    const home = g.filter(x => x.home).length
    if (home !== 8 && home !== 9) fail(s, t.short, 'home games', home); else homeN[home]++
    if (T[g[16].short].div !== t.div) fail(s, t.short, 'last game not in the division')
    for (let i = 0; i < 17; i++) for (let j = Math.max(0, i - 3); j < i; j++) if (g[i].short === g[j].short) fail(s, t.short, 'rematch within three weeks')
    // the other side of each game: he's on their schedule, at the other venue
    for (const x of others) { const back = all[x.short].filter(y => y.short === t.short); if (back.length !== 1 || back[0].home === x.home) fail(s, t.short, 'the other side disagrees', x.short) }
  }
}
console.log(`football draw: ${SEASONS} seasons x 32 teams, home 8: ${homeN[8]}, home 9: ${homeN[9]}`)
const NB = C.SPORT.bucket, NT = NB.teams.map(t => NB.teamOf(t.short))
for (let s = 2026; s < 2026 + SEASONS; s++) for (const t of NT) {
  const g = L.nbaSchedule(t.short, s, NT), cnt = {}
  for (const x of g) cnt[x.opponent] = (cnt[x.opponent] ?? 0) + 1
  if (g.length !== 82) fail('nba', s, t.short, 'games', g.length)
  for (const o of NT) {
    if (o.short === t.short) continue
    const n = cnt[o.short] ?? 0, want = o.div === t.div ? [4] : o.conf === t.conf ? [3, 4] : [2]
    if (!want.includes(n)) fail('nba', s, t.short, o.short, n)
  }
  if (NT.filter(o => o.conf === t.conf && o.div !== t.div && cnt[o.short] === 3).length !== 4) fail('nba', s, t.short, 'three-game teams')
  if (g.filter(x => x.home).length !== 41) fail('nba', s, t.short, 'home', g.filter(x => x.home).length)
  if (g.some((x, i) => i && x.opponent === g[i - 1].opponent)) fail('nba', s, t.short, 'same team two games running')
}
console.log(`basketball draw: ${SEASONS} seasons x 30 teams`)

// ── 2. seasons played ──
const buildFor = (S, pos, r) => {
  const pool = S.pool[pos].filter(p => p.attrs), b = {}
  for (const t of S.types[pos]) {
    let p = pool[Math.floor(r() * pool.length)]
    for (let j = 0; j < 5; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
    b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
  }
  return b
}
const CASES = [['nfl', 'qb'], ['nfl', 'wr'], ['nfl', 'rb'], ['nfl', 'dl'], ['nfl', 'db'], ['nfl', 'te'], ['bucket', 'guard'], ['bucket', 'big']]
let played = 0
for (let i = 0; i < CAREERS; i++) for (const [sport, pos] of CASES) {
  const S = C.SPORT[sport]
  let c = C.newCareer({ sport, pos, build: buildFor(S, pos, seeded(`sch-${sport}-${pos}-${i}`)), name: 'Cole Norwood', owner: 'Guest', games: 'advanced', slot: 0 })
  c = C.skipCombine(c); c = C.runDraft(c)
  let D; [c, D] = C.startSeason(c)
  const sched = c.active.base.games.map(g => `${g.opponent}|${g.home}`)
  let guard = 0
  while (c.active.k < D.total && guard++ < 900) {
    if (C.byeNow?.(c)) { c = C.byeRest(c, D); continue }
    if (c.active.injury) { const [n] = C.resolveInjury(c, D, false, false); c = n; continue }
    if (c.active.moment) { const [n] = C.chooseMoment(c, D, c.active.moment.options[i % c.active.moment.options.length]); c = n; continue }
    if (C.canDeadlineTrade?.(c) && i % 3 === 1) { const [n, D2] = C.deadlineTrade(c, D, 'any'); c = n; D = D2; continue }
    const [n] = C.advanceWeek(c, D); c = n
  }
  const traded = c.active.deadline?.granted ? c.active.deadline.k : null
  const got = D.games.map(g => `${g.opponent}|${g.home}`)
  played++
  if (traded == null && got.join() !== sched.join()) fail('played season changed its schedule', sport, pos, c.team)
  if (sport === 'nfl' && traded == null) {
    const cnt = {}; for (const g of D.games) cnt[g.opponent] = (cnt[g.opponent] ?? 0) + 1
    const div = NFL_TEAMS.filter(o => o.div === T[c.team].div && o.short !== c.team).map(o => o.name)
    for (const [o, n] of Object.entries(cnt)) if (n !== (div.includes(o) ? 2 : 1)) fail('season', pos, c.team, o, n)
  }
  if (i === 0) console.log(`${sport}/${pos} ${c.team}${traded != null ? ` (traded after game ${traded})` : ''}: ${D.games.slice(0, 17).map(g => `${g.home ? '' : '@'}${String(g.opponent).split(' ').pop()}`).join(' ')}${sport === 'bucket' ? ' ...' : ''}`)
}
console.log(`${played} seasons played, ${bad} problems`)
await server.close()
process.exit(bad ? 1 : 0)
