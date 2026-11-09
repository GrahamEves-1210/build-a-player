// Bundles an entry with esbuild to check every import resolves (no vite build: several agents share the
// machine). The baseball data and sim point at scripts/baseball/fixture.mjs until the real files land.
//   node scripts/baseball/bundle-check.mjs [entry] [--real]
import { build } from 'esbuild'
import path from 'path'
const real = process.argv.includes('--real')
const entry = process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'src/main.jsx'
const fixture = path.resolve('scripts/baseball/fixture.mjs')
const plugin = {
  name: 'baseball-check',
  setup(b) {
    if (!real) b.onResolve({ filter: /(data\/mlb-(teams|batters|pitchers|legend-batters|legend-pitchers)|utils\/baseballSimulation)$/ }, () => ({ path: fixture }))
    if (!real) b.onResolve({ filter: /data\/mlb-headshots\.json$/ }, () => ({ path: 'hs', namespace: 'hs' }))
    b.onLoad({ filter: /.*/, namespace: 'hs' }, () => ({ contents: '{}', loader: 'json' }))
    b.onResolve({ filter: /^\/.*\.(webp|png|svg|woff2?)$/ }, a => ({ path: a.path, external: true }))
    // another agent's file that's mid-way (its own imports not written yet): stubbed and listed, not a failure of ours
    const MINE = /(BaseballApp|BaseballSimPage|baseballUi|baseballShare|baseballAwards|baseballLive|AppHome|AppHomeClassic|SplashScreen|Navbar|SpinScreen|Silhouette|ReportCard|RatingsTable|main)\.(jsx?|mjs)$/
    b.onResolve({ filter: /^\.\.?\// }, async a => {
      if (a.pluginData?.inner) return null
      const res = await b.resolve(a.path, { resolveDir: a.resolveDir, kind: a.kind, importer: a.importer, pluginData: { inner: true } })
      if (!res.errors.length) return null
      if (MINE.test(a.importer)) return null
      console.log('  (stubbed, not ours)', a.path, 'from', path.relative('.', a.importer))
      return { path: a.path, namespace: 'stub' }
    })
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'module.exports = {}', loader: 'js' }))
  },
}
const r = await build({
  entryPoints: [entry], bundle: true, write: false, format: 'esm', splitting: true, outdir: 'F:/bap-dist/baseball-shell-check/bundle',
  jsx: 'automatic', loader: { '.js': 'jsx', '.jsx': 'jsx', '.webp': 'file', '.png': 'file', '.svg': 'file', '.woff2': 'file', '.woff': 'file', '.ttf': 'file', '.mp3': 'file', '.json': 'json' },
  define: { 'import.meta.env': '{"DEV":false,"PROD":true}', 'import.meta.glob': 'undefined' }, plugins: [plugin], logLevel: 'error', metafile: true,
}).catch(e => { console.error('BUNDLE FAILED'); process.exit(1) })
console.log('bundled', entry, Object.keys(r.metafile.outputs).length, 'outputs')
