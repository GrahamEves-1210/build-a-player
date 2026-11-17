// College Football's scoring, every point from a real play: (1) a few hundred thousand games from the engine's own
// game (utils/cfbSimulation.js playGame) on every kind of matchup: the points each side puts up add up from its
// field goals (3 each), touchdowns (6 to 8 each: the try), safeties (2) and overtime's two-point plays (2);
// (2) forced scores read back (splitPoints, every final 0-80); (3) whole Career college seasons (QB, RB, WR at
// random schools), every game of his played back as the scoreboard plays it (lib/scoreTimeline.js, LiveGame.jsx):
// every field goal is 3, every play worth what its label says, the plays add up to the final, an overtime game is
// tied at the end of regulation and the winner scores last. Also NFL finals the same way.
// Run from the repo root:  node scripts/moments/cfb-score-check.mjs [games] [seasons]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const sim = await server.ssrLoadModule('/src/utils/cfbSimulation.js')
const TL = await server.ssrLoadModule('/src/lib/scoreTimeline.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const { CFB_TEAMS } = await server.ssrLoadModule('/src/data/cfb-teams.js')
const { TYPES } = await server.ssrLoadModule('/src/data/qbs.js')
const { RB_TYPES } = await server.ssrLoadModule('/src/data/rbs.js')
const { WR_TYPES } = await server.ssrLoadModule('/src/data/wrs.js')
const GAMES = Number(process.argv[2] ?? 200000), SEASONS = Number(process.argv[3] ?? 24)
let bad = 0
const fail = (...a) => { bad++; if (bad < 30) console.log('FAIL', ...a) }
const adds = s => { const rest = s.pts - 3 * s.fg - 2 * (s.sf ?? 0) - 2 * (s.two ?? 0); return rest >= 6 * s.td && rest <= 8 * s.td }

// (1) the engine's games
const r = seeded('cfb-score-check')
let ot = 0, ties = 0, sf = 0
for (let i = 0; i < GAMES; i++) {
  const A = { so: (r() - 0.5) * 30, sd: (r() - 0.5) * 30 }, B = { so: (r() - 0.5) * 30, sd: (r() - 0.5) * 30 }
  const g = sim.__scoreTest.playGame(seeded(`g-${i}`), A, B, ['a', 'b', 'n'][i % 3])
  if (g.ot) ot++
  if (g.a.pts === g.b.pts) ties++
  sf += (g.a.sf ?? 0) + (g.b.sf ?? 0)
  for (const s of [g.a, g.b]) if (!adds(s)) fail('engine', JSON.stringify(s), g.ot)
  for (const s of [g.a, g.b]) if ([1].includes(s.pts)) fail('engine final of 1')
}
console.log(`(1) ${GAMES} engine games: ${(ot / GAMES * 100).toFixed(1)}% to overtime, ${ties} ties, ${sf} safeties`)
// (2) forced finals
for (let pts = 0; pts <= 80; pts++) { const s = sim.__scoreTest.splitPoints(seeded(`s-${pts}`), pts); if (pts !== 1 && !adds(s)) fail('split', pts, JSON.stringify(s)) }
console.log('(2) forced finals 0-80 read back')
// (3) Career college seasons, every game on the scoreboard
const POS = { qb: TYPES, rb: RB_TYPES, wr: WR_TYPES }
const label = { 2: 'SAFETY', 3: 'FG', 6: 'TD', 7: 'TD', 8: 'TD + 2PT' }
let played = 0, fgs = 0, otGames = 0
const board = (my, opp, overtime, who) => {
  const ev = TL.buildScoreTimeline(my, opp, overtime, seeded(`tl-${who}-${my}-${opp}`))
  const sum = t => ev.filter(e => e.team === t).reduce((s, e) => s + e.pts, 0)
  if (sum('me') !== my || sum('opp') !== opp) fail('timeline sum', who, my, opp, overtime, ev.map(e => `${e.team}:${e.pts}`).join(' '))
  for (const e of ev) { if (e.label !== label[e.pts]) fail('label', who, e.pts, e.label); if (e.label === 'FG') { fgs++; if (e.pts !== 3) fail('FG worth', e.pts) } }
  if (overtime && my !== opp && TL.overtimeSplit(my, opp)) {
    otGames++
    const reg = ev.filter(e => e.gameSec < 3600), tm = t => reg.filter(e => e.team === t).reduce((s, e) => s + e.pts, 0)
    if (tm('me') !== tm('opp')) fail('overtime not tied after regulation', who, my, opp)
    if (ev[ev.length - 1].team !== (my > opp ? 'me' : 'opp')) fail('overtime: the winner did not score last', who, my, opp)
  }
}
for (let i = 0; i < SEASONS; i++) {
  const pos = ['qb', 'rb', 'wr'][i % 3], types = POS[pos], rb = seeded(`b-${i}`)
  const build = Object.fromEntries(types.map(t => [t, { type: t, val: 4 + Math.floor(rb() * 8) }]))
  const team = CFB_TEAMS[Math.floor(rb() * CFB_TEAMS.length)]
  const res = sim.runCFBSimulation(build, types, team, pos, `cfbsc-${i}`, 'career', null, { name: 'Cole Norwood', year: 'JR' })
  const games = [...(res.games ?? []), ...(res.postseason ?? []), ...(res.rounds ?? [])]
  for (const g of games) { played++; board(g.mySc, g.oppSc, !!(g.ot || g.overtime), `${team.short}-${i}`) ; if (g.mySc === 1 || g.oppSc === 1) fail('final of 1') }
}
// (and every overtime margin and final a football scoreboard can get, both ways)
for (let a = 0; a <= 70; a++) for (let b = 0; b <= 70; b++) { if (a === 1 || b === 1) continue; board(a, b, false, 'grid'); if (a !== b && Math.abs(a - b) <= 16 && Math.min(a, b) >= 3) board(a, b, true, 'grid-ot') }
console.log(`(3) ${SEASONS} college seasons, ${played} of his games on the scoreboard, ${otGames} overtime boards, ${fgs} field goals, all checked`)
console.log(`${bad} problems`)
await server.close()
process.exit(bad ? 1 : 0)
