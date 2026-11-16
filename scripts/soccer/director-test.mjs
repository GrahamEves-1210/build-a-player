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
  stdin: { contents: `export * from './src/utils/soccerSimulation.js'\nexport { createDirector } from './src/lib/seasonDirector.js'`, resolveDir: ROOT, loader: 'js' },
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
console.log(ok ? 'director contract: OK' : 'director contract: FAILED')
process.exitCode = ok ? 0 : 1
