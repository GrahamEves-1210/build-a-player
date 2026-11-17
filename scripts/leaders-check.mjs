// League leaders on the single-season sim (lib/seasonFacts.js leaderBoard), Current and All-Time, football and
// basketball, over many seeded seasons. A build is spun from the mode's pool and simulated the way the app does it,
// then checked:
//  - his rank is where his line sits among the league's lines (1 + the lines at or above his)
//  - an All-Time field lists each legend once and is no bigger than the current league's
//  - the same line ranks about the same in both modes (the owner's report: a 4,000-yard All-Time year read 50th)
// Run from the repo root:  node scripts/leaders-check.mjs [seasons-per-position]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const L = p => server.ssrLoadModule(p)
const SF = await L('/src/lib/seasonFacts.js'), S = await L('/src/utils/simulation.js'), B = await L('/src/utils/bucketSimulation.js')
const NFL = await L('/src/data/nfl-teams.js'), NBA = await L('/src/data/nba-teams.js')
const { seeded } = await L('/src/lib/rng.js')
const d = f => L(`/src/data/${f}.js`)
const N = Number(process.argv[2] ?? 40)

const [qbs, ql, rbs, wrs, tes, dbs, dls, lbs, ols, ks] = await Promise.all(['qbs', 'qb-legends', 'rbs', 'wrs', 'tes', 'dbs', 'dls', 'lbs', 'ols', 'ks'].map(d))
const [g, gl, bg, bl] = await Promise.all(['nba-guards', 'nba-guard-legends', 'nba-bigs', 'nba-big-legends'].map(d))
const nflRun = (fn, short) => short ? (b, ty, t, a) => fn(b, t, a) : (b, ty, t, a) => fn(b, ty, t, a)
const POS = [
  ['nfl', 'qb', qbs.QBS, ql.LEGENDS, qbs.TYPES, ql.LEGEND_TYPES, nflRun(S.runSimulation), 'seasonPassYds'],
  ['nfl', 'rb', rbs.RBS, (await d('rb-legends')).RB_LEGENDS, rbs.RB_TYPES, null, nflRun(S.runRBSimulation), 'seasonRushYds'],
  ['nfl', 'wr', wrs.WRS, (await d('wr-legends')).WR_LEGENDS, wrs.WR_TYPES, null, nflRun(S.runWRSimulation), 'seasonRecYds'],
  ['nfl', 'te', tes.TES, (await d('te-legends')).TE_LEGENDS, tes.TE_TYPES, null, nflRun(S.runTESimulation), 'seasonRecYds'],
  ['nfl', 'db', dbs.DBS, (await d('db-legends')).DB_LEGENDS, dbs.DB_TYPES, null, nflRun(S.runDBSimulation, 1), 'seasonINTs'],
  ['nfl', 'dl', dls.DLS, (await d('dl-legends')).DL_LEGENDS, dls.DL_TYPES, null, nflRun(S.runDLSimulation, 1), 'seasonSacks'],
  ['nfl', 'lb', lbs.LBS, (await d('lb-legends')).LB_LEGENDS, lbs.LB_TYPES, null, nflRun(S.runLBSimulation, 1), 'seasonTackles'],
  ['nfl', 'ol', ols.OLS, (await d('ol-legends')).OL_LEGENDS, ols.OL_TYPES, null, nflRun(S.runOLSimulation, 1), 'seasonPancakes'],
  ['nfl', 'k', ks.KS, (await d('k-legends')).K_LEGENDS, ks.K_TYPES, null, nflRun(S.runKSimulation, 1), 'seasonPoints'],
  ['bucket', 'guard', g.NBA_GUARD_PLAYERS, gl.NBA_ALLTIME_GUARD_PLAYERS, g.GUARD_TYPES, null, (b, ty, t, a) => B.runBucketSimulation(b, ty, t, 'guard', null, a ? 'all-time' : 'classic'), 'ppg'],
  ['bucket', 'big', bg.NBA_BIG_PLAYERS, bl.NBA_ALLTIME_BIG_PLAYERS, bg.BIG_TYPES, null, (b, ty, t, a) => B.runBucketSimulation(b, ty, t, 'big', null, a ? 'all-time' : 'classic'), 'ppg'],
]

let fails = 0
const fail = msg => { fails++; if (fails <= 25) console.log('  FAIL', msg) }
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const rankIn = (lines, v) => 1 + lines.filter(x => x.value >= v).length

console.log(`pos      mode  his line (med)  rank med/best/worst   same line in Current (med)   field`)
for (const [sport, pos, cur, at, types, atTypes, run, key] of POS) {
  for (const allTime of [false, true]) {
    const spinPool = (allTime ? at : cur).filter(p => p.attrs), ty = allTime && atTypes ? atTypes : types
    const r = seeded(`lc-${pos}-${allTime}`)
    const vals = [], ranks = [], curRanks = [], gaps = []
    let fieldN = 0
    for (let i = 0; i < N; i++) {
      // a build spun from the mode's pool, each slot a random player's rating
      const b = {}
      for (const t of ty) { const p = spinPool[Math.floor(r() * spinPool.length)]; b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.name, qbFull: p.name, team: p.team, subpos: p.subpos ?? null } }
      let team
      if (sport === 'nfl') {
        const t0 = NFL.NFL_TEAMS[Math.floor(r() * NFL.NFL_TEAMS.length)], atr = NFL.ALLTIME_RATINGS[t0.short]
        team = allTime && atr ? { ...t0, off: atr.off, def: atr.def, isAllTime: true } : t0
      } else team = NBA.NBA_TEAMS[Math.floor(r() * NBA.NBA_TEAMS.length)]
      const v = run(b, ty, team, allTime)[key]
      const seed = 5000 + i * 7
      // the props the season screens pass (SimPage / BucketSimPage)
      const args = { sport, pos, pool: allTime ? at : cur, seed, league: allTime ? cur : null }
      const lines = SF.leaderField(args)
      const board = SF.leaderBoard({ ...args, you: { name: 'Guest', team: team.short, value: v } })
      if (board.rank !== rankIn(lines, v)) fail(`${pos} ${allTime ? 'AT' : 'cur'} seed ${seed}: rank ${board.rank}, his ${v} sits ${rankIn(lines, v)}`)
      if (board.of !== lines.length + 1) fail(`${pos}: board of ${board.of} vs ${lines.length + 1}`)
      const curLines = SF.leaderField({ sport, pos, pool: cur, seed })
      if (allTime) {
        const names = lines.map(x => x.name)
        if (new Set(names).size !== names.length) fail(`${pos} AT seed ${seed}: a legend listed twice`)
        if (lines.length > curLines.length) fail(`${pos} AT seed ${seed}: field ${lines.length} > current ${curLines.length}`)
        const legendNames = new Set(at.map(p => p.name))
        if (lines.some(x => !legendNames.has(x.name))) fail(`${pos} AT: a non-legend on the board`)
      }
      const cr = rankIn(curLines, v)
      // (a legends pool shorter than the league: a line under its last legend is last, not further down)
      vals.push(v); ranks.push(board.rank); curRanks.push(cr); gaps.push(Math.abs(board.rank - Math.min(cr, lines.length + 1)))
      fieldN = lines.length
    }
    // the same line in the two leagues: about the same place (the lines are the same model's, the order of names aside)
    if (allTime && med(gaps) > 1) fail(`${pos} AT: the same line sits ${med(gaps)} places from its Current rank (median)`)
    if (allTime && Math.max(...gaps) > 3) fail(`${pos} AT: the same line sits up to ${Math.max(...gaps)} places from its Current rank`)
    console.log(`${(sport === 'bucket' ? 'nba ' : '') + pos}`.padEnd(9) + (allTime ? 'AT  ' : 'cur ') + `  ${String(med(vals)).padStart(8)}        ${med(ranks)}/${Math.min(...ranks)}/${Math.max(...ranks)}`.padEnd(40) + `${med(curRanks)}`.padEnd(29) + fieldN)
  }
}
// the owner's case: a 4,000-yard All-Time passing year
const qb4000 = med(Array.from({ length: 50 }, (_, i) => SF.leaderBoard({ sport: 'nfl', pos: 'qb', pool: ql.LEGENDS, league: qbs.QBS, seed: 900 + i, you: { name: 'Guest', value: 4000 } }).rank))
const qb4000old = med(Array.from({ length: 50 }, (_, i) => SF.leaderBoard({ sport: 'nfl', pos: 'qb', pool: ql.LEGENDS, seed: 900 + i, you: { name: 'Guest', value: 4000 } }).rank))
console.log(`4,000 passing yards, All-Time: #${qb4000} (the old board: #${qb4000old})`)
if (qb4000 > 15) fail(`4,000 All-Time passing yards rank ${qb4000}`)
console.log(fails ? `${fails} FAILED` : 'all passed')
await server.close()
process.exit(fails ? 1 : 0)
