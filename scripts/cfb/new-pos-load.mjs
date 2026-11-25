// Loads the College Football engine for the new-position checks (TE, DL, DB: new-pos-check.mjs) through Vite's SSR
// loader, like load.mjs. STUB_DIR=<dir> points the DL/DB data files (cfb-dls, cfb-dbs, cfb-dl-legends, cfb-db-legends)
// at stand-ins in that folder (never in src/), for engine work before the real files are written; without it, src/data's.
import { createServer } from 'vite'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const STUBBED = ['cfb-dls', 'cfb-dbs', 'cfb-dl-legends', 'cfb-db-legends']

export async function loadEngine() {
  const stub = process.env.STUB_DIR || null
  const use = stub ? STUBBED.filter(d => existsSync(path.join(stub, `${d}.js`))) : []
  const plugin = {
    name: 'cfb-stub', enforce: 'pre',
    resolveId(id) {
      const m = id.match(/(?:^|\/)data\/(cfb-[a-z-]+?)(?:\.js)?$/)
      if (m && use.includes(m[1])) return path.join(stub, `${m[1]}.js`)
      return null
    },
  }
  const vite = await createServer({
    root, configFile: false, plugins: [plugin], logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    cacheDir: path.join(os.tmpdir(), 'bap-cfb-newpos-cache'), optimizeDeps: { noDiscovery: true, include: [] },
  })
  const sim = await vite.ssrLoadModule('/src/utils/cfbSimulation.js')
  return { vite, sim, stubbed: use }
}
