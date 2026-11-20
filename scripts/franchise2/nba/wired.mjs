// Bundle a script with core's nba/seams.js swapped for seams-wired.js (the cap engine in, the sim's stand-ins kept),
// then run it: core's own season and summer, on the real money.
//   node scripts/franchise2/nba/wired.mjs scripts/franchise2/nba/wired-season.mjs [args...]
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const [src, ...args] = process.argv.slice(2)
const out = path.join(process.env.FR_TMP ?? 'F:/bap-agents/frnba-cap/tmp', path.basename(src, '.mjs') + '.wired.mjs')
const wired = path.join(ROOT, 'scripts/franchise2/nba/seams-wired.js')
await build({
  entryPoints: [path.join(ROOT, src)], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
  define: { 'import.meta.env': '{"DEV":false}' }, loader: { '.json': 'json' },
  plugins: [{ name: 'seams', setup(b) { b.onResolve({ filter: /^\.\/seams$/ }, a => (a.importer.replace(/\\/g, '/').includes('lib/franchise2/nba/') ? { path: wired } : null)) } }],
})
execFileSync(process.execPath, ['--max-old-space-size=1536', out, ...args], { stdio: 'inherit' })
