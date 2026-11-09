// Can the season director (lib/seasonDirector.js) drive a soccer season? node scripts/soccer/director-test.mjs
// Plays a season the way the season page would: reveal every match, a moment's nudge mid-season (a re-simulated
// stretch, spliced in), then finalize. Checks the spliced games, the totals and that the final keeps the
// soccer fields. (The director has no soccer branches yet: totals, sitGame scores and draws are the
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
const team = { short: 'BOU', name: 'Bournemouth' }
const simFn = (bb, tt, seed) => S.runSoccerSimulation(bb, T, tt, 'current', seed)
const base = simFn(b, team, 'dir-base')
const D = S.createDirector({ sport: 'soccer', pos: 'st', build: b, team: base.team, simFn, base, seed: 'dirtest', name: 'Guest', types: T })
let ok = true
for (let k = 1; k <= D.total; k++) {
  D.observe(k)
  if (k === 15) D.nudge({ attr: { finishing: 1 }, team: { off: 1 } }, 15, 25, 'HOT STREAK')
}
const fin = D.finalize()
const goals = D.games.reduce((s, g) => s + g.goals, 0)
ok &&= D.games.length === base.games.length && D.games.every(g => g.goals <= g.mySc)
ok &&= fin.games === D.games && fin.sport === 'soccer' && fin.goldenBoot && fin.standings?.length === base.standings.length
const awards = S.soccerAwards(fin, { goals, assists: D.games.reduce((s, g) => s + g.assists, 0) })
console.log(`director: ${D.total} matches, stops at ${D.stops.map(s => s.at).join(', ')}; spliced games carry tags ${D.games.filter(g => g.tags).length}`)
console.log(`final: ${fin.wins}-${fin.draws}-${fin.losses} (record from the booked run), his games ${goals} goals (run said ${fin.goals}); soccerAwards on the games: boot rank ${awards.goldenBoot.rank}, BdO ${awards.ballonDor.finish ?? '-'}`)
console.log(`director's own wins from the games: ${D.games.filter(g => g.won).length}; draws it can't see: ${D.games.filter(g => g.drawn).length}`)
console.log(ok ? 'director contract: OK' : 'director contract: FAILED')
