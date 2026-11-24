// Can the season director (lib/seasonDirector.js) drive a soccer season? node scripts/soccer/director-test.mjs
// Plays a season the way the season page would: reveal every match, a moment's nudge mid-season (a re-simulated
// stretch, spliced in), then finalize. Checks the spliced games, the totals and that the final keeps the
// soccer fields, for a build's Champions League season and the domestic one. (The director has no soccer branches yet: totals, sitGame scores and draws are the
// integration's job; this only checks the engine's side of the contract.)
import { build } from 'esbuild'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const plugin = { name: 'd', setup(b) { b.onResolve({ filter: /\/data\/soccer-(clubs|nations|strikers)$/ }, a => { const n = a.path.match(/soccer-\w+$/)[0]; const real = join(ROOT, 'src', 'data', `${n}.js`); return { path: existsSync(real) && !process.env.SOCCER_FIXTURE ? real : join(ROOT, 'scripts', 'soccer', 'fixture', `${n}.js`) } }) } }
const outDir = join(process.env.SOCCER_TEST_OUT ?? tmpdir(), 'bap-soccer-test')
mkdirSync(outDir, { recursive: true })
const outfile = join(outDir, `dir-${Date.now()}.mjs`)
await build({
  stdin: { contents: `export * from './src/utils/soccerSimulation.js'\nexport { createDirector } from './src/lib/seasonDirector.js'\nexport { oneOffDirector } from './src/lib/soccerDirector.js'`, resolveDir: ROOT, loader: 'js' },
  bundle: true, format: 'esm', platform: 'node', outfile, plugins: [plugin], logLevel: 'error', loader: { '.jsx': 'jsx', '.json': 'json' }, define: { 'import.meta.env': '{}' },
})
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const S = await import(pathToFileURL(outfile).href)
const T = S.SOCCER_TRAITS
const b = Object.fromEntries(T.map(t => [t, { type: t, val: 8 }]))
// a build's season (the Champions League: eight league phase matches) and the domestic one (Career's, team.domestic)
let ok = true
for (const [label, team] of [['Champions League', { short: 'BOU', name: 'Bournemouth' }], ['domestic', { short: 'BOU', name: 'Bournemouth', domestic: true }]]) {
  const simFn = (bb, tt, seed) => S.runSoccerSimulation(bb, T, { ...tt, ...(team.domestic ? { domestic: true } : {}) }, 'current', seed)
  const base = simFn(b, team, 'dir-base')
  const D = S.createDirector({ sport: 'soccer', pos: 'st', build: b, team: base.team, simFn, base, seed: 'dirtest', name: 'Guest', types: T })
  const at = Math.min(15, Math.max(1, D.total - 3))
  for (let k = 1; k <= D.total; k++) {
    D.observe(k)
    if (k === at) D.nudge({ attr: { finishing: 1 }, team: { off: 1 } }, at, Math.min(D.total, at + 10), 'HOT STREAK')
  }
  let fin = D.finalize()
  const goals = D.games.reduce((s, g) => s + g.goals, 0)
  ok &&= D.games.length === base.games.length && D.games.every(g => g.goals <= g.mySc)
  ok &&= fin.games === D.games && fin.sport === 'soccer' && !!fin.goldenBoot && fin.standings?.length === base.standings.length
  // (the one-off page books a Champions League season through soccerUclRebook: its league phase from the games)
  if (S.isUclResult(fin)) {
    fin = S.soccerUclRebook(fin, D.games)
    const ko = fin.fixtures.filter(m => m.stage !== 'md')
    ok &&= fin.wins === D.games.filter(g => g.won).length && fin.goals === goals + ko.reduce((s, m) => s + m.goals, 0) && fin.standings.filter(r => r.isUs).length === 1
    ok &&= fin.standings.every((r, i) => r.pos === i + 1) && fin.fixtures.length === D.games.length + ko.length
  }
  const awards = S.soccerAwards(fin, { goals: fin.goals, assists: fin.assists })
  console.log(`${label} director: ${D.total} matches, stops at ${D.stops.map(s => s.at).join(', ')}; spliced games carry tags ${D.games.filter(g => g.tags).length}`)
  console.log(`  final: ${fin.wins}-${fin.draws}-${fin.losses}, ${fin.seed}${S.isUclResult(fin) ? ` of 36, ${fin.finish}` : ''}; his games ${goals} goals, season ${fin.goals}; awards again: top scorer rank ${awards.goldenBoot.rank}${awards.ballonDor ? `, BdO ${awards.ballonDor.finish ?? '-'}` : `, Player of the Season #${awards.playerOfSeason.rank}`}`)
}
// The one-off page's own director (soccerDirector.js oneOffDirector) on a Champions League season, the way the page
// plays it: its own seed (not the season's), a hot stretch, two matches sat out. The league phase must keep its eight
// opponents and matchdays, and the booked table must add up for every club (2026-11-24: a moment re-drew the
// league phase against other clubs, and the table's other rows kept the old results).
for (let n = 0; n < 30; n++) {
  const base = S.runSoccerSimulation(b, T, { short: 'BOU', name: 'Bournemouth' }, 'current', `dir-ucl-${n}`)
  const D = S.oneOffDirector({ result: base, build: b, types: T, seed: `page-${n}` })
  for (let k = 1; k <= D.total; k++) {
    D.observe(k)
    if (k === 2) D.nudge({ attr: { finishing: 2 }, team: { off: 1 } }, 2, D.total, 'HOT STREAK')
    if (k === 3) { D.sitOut(4, 'INJURED'); D.sitOut(5, 'INJURED') }
  }
  D.finalize()
  const fin = S.soccerUclRebook(base, D.games)
  const bad = []
  base.games.forEach((g, i) => { const x = fin.games[i]; if (!x || x.opponent !== g.opponent || !!x.home !== !!g.home) bad.push(`MD${i + 1} was ${g.opponent}, now ${x?.opponent}`) })
  if (fin.games.some(g => !g.md)) bad.push('a match reads MD0')
  if (new Set(fin.games.map(g => g.opponent)).size !== fin.games.length) bad.push('an opponent twice')
  const sum = k => fin.standings.reduce((s2, r) => s2 + r[k], 0)
  if (sum('wins') !== sum('losses')) bad.push(`wins ${sum('wins')} vs losses ${sum('losses')}`)
  if (sum('draws') % 2) bad.push(`draws ${sum('draws')} (odd)`)
  if (sum('gf') !== sum('ga') || sum('gd') !== 0) bad.push(`goals ${sum('gf')}-${sum('ga')}, gd ${sum('gd')}`)
  if (fin.standings.some(r => r.points !== r.wins * 3 + r.draws || r.wins + r.draws + r.losses !== 8)) bad.push('a row with wrong points or not 8 matches')
  if (bad.length) { ok = false; console.log(`  !! ucl ${n}: ${bad.join('; ')}`) }
}
console.log('one-off Champions League director, 30 seasons with moments: fixtures kept, table adds up' + (ok ? '' : ' (see above)'))
console.log(ok ? 'director contract: OK' : 'director contract: FAILED')
process.exitCode = ok ? 0 : 1
