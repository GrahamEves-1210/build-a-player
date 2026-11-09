// Bundles src/utils/baseballSimulation.js (and anything else asked for) with esbuild for the baseball test scripts.
// The data imports go to src/data/mlb-*.js when the data agent's files are there, and to scripts/baseball/fixture/
// when they aren't (BASEBALL_FIXTURE=1: always the fixture). Prints which.
import { build } from 'esbuild'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export async function load(extra = '') {
  const used = {}
  const plugin = {
    name: 'mlb-data',
    setup(b) {
      b.onResolve({ filter: /\/data\/mlb-(teams|batters|pitchers|legend-batters|legend-pitchers)$/ }, args => {
        const name = args.path.match(/mlb-[a-z-]+$/)[0]
        const real = join(ROOT, 'src', 'data', `${name}.js`)
        const useReal = existsSync(real) && !process.env.BASEBALL_FIXTURE
        used[name] = useReal ? 'src/data' : 'fixture'
        return { path: useReal ? real : join(ROOT, 'scripts', 'baseball', 'fixture', `${name}.js`) }
      })
    },
  }
  const outDir = join(process.env.BASEBALL_TEST_OUT ?? tmpdir(), 'bap-baseball-test')
  mkdirSync(outDir, { recursive: true })
  const outfile = join(outDir, `sim-${process.pid}-${Date.now()}.mjs`)
  await build({
    stdin: { contents: `export * from './src/utils/baseballSimulation.js'\n${extra}`, resolveDir: ROOT, loader: 'js' },
    bundle: true, format: 'esm', platform: 'node', outfile, plugins: [plugin], logLevel: 'error', loader: { '.jsx': 'jsx', '.json': 'json' }, define: { 'import.meta.env': '{}' },
  })
  const S = await import(pathToFileURL(outfile).href)
  const teamsFile = used['mlb-teams'] === 'src/data' ? join(ROOT, 'src/data/mlb-teams.js') : join(ROOT, 'scripts/baseball/fixture/mlb-teams.js')
  const T = await import(pathToFileURL(teamsFile).href)
  return { S, used, teams: T.MLB_TEAMS ?? Object.values(T).find(Array.isArray) }
}
