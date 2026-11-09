// Loads src/utils/cfbSimulation.js through Vite's SSR loader (it imports football's sim, which reads
// import.meta.env). If the data agent's src/data/cfb-*.js files aren't there yet, the imports are pointed at
// the fixture in scripts/cfb/fixture/ (never in src/). Pass FIXTURE=1 to force the fixture.
import { createServer } from 'vite'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const DATA = ['cfb-conferences', 'cfb-teams', 'cfb-players']

export async function loadCFB() {
  const force = process.env.FIXTURE === '1'
  const missing = DATA.filter(d => force || !existsSync(path.join(root, 'src/data', `${d}.js`)))
  const plugin = {
    name: 'cfb-fixture',
    enforce: 'pre',
    resolveId(id) {
      const m = id.match(/(?:^|\/)data\/(cfb-[a-z]+)(?:\.js)?$/)
      if (m && missing.includes(m[1])) return path.join(here, 'fixture', `${m[1]}.js`)
      return null
    },
  }
  const vite = await createServer({
    root, configFile: false, plugins: [plugin], logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    cacheDir: 'F:/bap-dist/cfbsim-cache', optimizeDeps: { noDiscovery: true, include: [] },
  })
  const sim = await vite.ssrLoadModule('/src/utils/cfbSimulation.js')
  const data = {}
  for (const d of DATA) data[d] = await vite.ssrLoadModule(missing.includes(d) ? path.join(here, 'fixture', `${d}.js`) : `/src/data/${d}.js`)
  return { vite, sim, data, usingFixture: missing }
}
