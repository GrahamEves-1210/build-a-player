// Can the season director (lib/seasonDirector.js) drive a baseball season? node scripts/baseball/director-test.mjs
// Plays a season the way the season page would: reveal every game, a moment's nudge mid-season (a re-simulated
// stretch, spliced in), a stint on the injured list, then finalize with rebookBaseball as onFinal. Checks that the
// spliced games keep their dates and opponents (the schedule doesn't follow the seed), that the final's line adds up
// to the games, and how many engine runs the director needed. (The director has no baseball branch yet: its COUNTS,
// sitGame scores and stops are the integration's job; this checks the engine's side of the contract.)
import { load } from './bundle.mjs'

const { S, teams } = await load(`export { createDirector } from './src/lib/seasonDirector.js'`)
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const BT = S.BAT_TRAITS, PT = S.PIT_TRAITS
const mk = (keys, v) => Object.fromEntries(keys.map(k => [k, { type: k, val: v }]))
let runs = 0
for (const [pos, types] of [['bat', BT], ['pit', PT]]) {
  const b = mk(types, 8)
  const team = { short: teams.find(t => t.short === 'SEA')?.short ?? teams[0].short }
  // the director's re-runs: team.fast (no award field; rebookBaseball books it at the end)
  const simFn = (bb, tt, seed) => { runs++; return S.runBaseballSimulation(bb, types, { ...tt, fast: true }, pos, 'current', seed) }
  const base = S.runBaseballSimulation(b, types, team, pos, 'current', 'dir-base')
  runs = 0
  const t0 = performance.now()
  const D = S.createDirector({ sport: 'baseball', pos, build: b, team: base.team, simFn, base, seed: 'dirtest', name: 'Guest', types, onFinal: (f, t, games) => S.rebookBaseball(f, games) })
  for (let k = 1; k <= D.total; k++) {
    D.observe(k)
    if (k === 40) D.nudge({ attr: { [types[0]]: 1 }, team: { off: 1 } }, 40, 60, 'HOT STREAK')
    if (k === 100) D.sidelined(100, 12)
  }
  const fin = D.finalize()
  const ms = performance.now() - t0
  const sameSched = D.games.every((g, i) => g.opponent === base.games[i].opponent && g.date === base.games[i].date && g.home === base.games[i].home)
  const t = S.baseballTotals(D.games, pos, fin)
  const adds = pos === 'bat' ? t.hr === fin.hr && t.pa === fin.pa && fin.g === D.games.filter(g => !g.sat && g.gp).length : t.k === fin.k && t.ipOuts === fin.ipOuts
  const ok = D.games.length === 162 && sameSched && adds && fin.wins === D.games.filter(g => g.won).length && !!fin.awards && !!fin.standings?.length
  console.log(`${pos}: ${D.total} games, stops at ${D.stops.map(s => s.at).join(', ')}; ${D.games.filter(g => g.tags).length} games tagged, ${D.games.filter(g => g.sat).length} sat`)
  console.log(`  final ${fin.wins}-${fin.losses} (${fin.madePlayoffs ? 'in' : 'out'}), ${pos === 'bat' ? `${fin.line.AVG}/${fin.line.OBP}/${fin.line.SLG}, ${fin.hr} HR, ${fin.war} WAR` : `${fin.line['W-L']}, ${fin.line.ERA} ERA, ${fin.line.IP} IP, ${fin.war} WAR`}; MVP rank ${fin.awards.mvp.rank ?? '-'}, All-Star ${fin.awards.allStar?.selected ? 'yes' : 'no'}`)
  console.log(`  schedule kept through the splices ${sameSched ? 'OK' : 'FAILED'}; line from the games ${adds ? 'OK' : 'FAILED'}; ${runs} engine runs in ${ms.toFixed(0)} ms`)
  console.log(ok ? '  director contract: OK' : '  director contract: FAILED')
}
