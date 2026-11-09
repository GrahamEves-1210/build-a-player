// Renders BaseballSimPage (every stage) and BaseballTeamSpin to HTML in Node, with the baseball data and sim
// imports pointed at scripts/baseball/fixture.mjs, to catch runtime errors before the real files land.
//   node scripts/baseball/render-check.mjs            (fixture)
//   node scripts/baseball/render-check.mjs --real     (the real src/data/mlb-* and utils/baseballSimulation.js)
import { build } from 'esbuild'
import { mkdirSync, existsSync } from 'fs'
import path from 'path'
const real = process.argv.includes('--real')
const simMode = process.argv.includes('--sim')   // the real sim and legends, the 30-club fixture for what hasn't landed
const out = 'F:/bap-dist/baseball-shell-check'
mkdirSync(out, { recursive: true })
const fixture = path.resolve('scripts/baseball/fixture.mjs')
const redirect = {
  name: 'baseball-fixture',
  setup(b) {
    // (only the files that haven't landed yet)
    if (simMode) b.onResolve({ filter: /data\/mlb-(teams|batters|pitchers)$/ }, a => (existsSync(path.resolve(a.resolveDir, a.path + '.js')) ? null : { path: path.resolve('scripts/baseball/fixture30.mjs') }))
    else if (!real) b.onResolve({ filter: /(data\/mlb-(teams|batters|pitchers|legend-batters|legend-pitchers)|utils\/baseballSimulation)$/ }, () => ({ path: fixture }))
    if (!real) b.onResolve({ filter: /data\/mlb-headshots\.json$/ }, () => ({ path: 'hs', namespace: 'hs' }))
    b.onLoad({ filter: /.*/, namespace: 'hs' }, () => ({ contents: '{}', loader: 'json' }))
    b.onResolve({ filter: /\.(css|webp|png|svg)$/ }, a => ({ path: a.path, namespace: 'nul' }))
    b.onLoad({ filter: /.*/, namespace: 'nul' }, () => ({ contents: '', loader: 'js' }))
  },
}
const entry = `
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BaseballSimPage, { BaseballTeamSpin } from '../../src/components/BaseballSimPage.jsx'
import { MLB_TEAMS } from '../../src/data/mlb-teams'
import * as Sim from '../../src/utils/baseballSimulation'
import { BASEBALL_KEYS } from '../../src/lib/baseballUi'
const WANT = (process.env.WANT || 'any')   // any | playoffs | champ
for (const pos of ['bat', 'pit']) {
  const types = BASEBALL_KEYS[pos]
  const hi = Number(process.env.GRADE || 3)
  const build = Object.fromEntries(types.map((t, i) => [t, { type: t, val: Math.min(11, hi + (i % 8)), qbFull: 'Fixture ' + i, team: MLB_TEAMS[i % MLB_TEAMS.length].short, height: 74, weight: 210, bats: 'L', throws: 'R', role: pos === 'pit' ? 'SP' : 'SS' }]))
  let r = null
  for (let k = 0; k < 90 && !r; k++) {
    const x = Sim.runBaseballSimulation(build, types, MLB_TEAMS[k % MLB_TEAMS.length], pos, 'current', 7 + k, 'classic')
    if (WANT === 'any' || (WANT === 'playoffs' && x.madePlayoffs && !x.champion) || (WANT === 'champ' && x.champion)) r = x
  }
  if (!r) { console.log(pos, 'no season matched', WANT); continue }
  console.log(pos, r.team.short, r.wins + '-' + r.losses, 'playoffs', !!r.madePlayoffs, 'champ', !!r.champion, 'rounds', (r.playoffRounds || []).map(x => x.short + ':' + (x.type === 'bye' ? 'bye' : x.wins + '-' + x.losses)).join(' '))
  const html = renderToStaticMarkup(React.createElement(BaseballSimPage, { result: r, build, types, pos, pool: 'current', onBack() {}, onReset() {}, initialScreen: 'final', userName: 'Guest', arch: 'All-Star Slugger' }))
  const first = renderToStaticMarkup(React.createElement(BaseballSimPage, { result: { ...r }, build, types, pos, pool: 'current', onBack() {}, onReset() {}, initialScreen: 0, userName: 'Guest', arch: 'All-Star Slugger' }))
  ;(await import('fs')).writeFileSync('F:/bap-dist/baseball-shell-check/' + pos + '.html', html)
  console.log(pos, 'final', html.length, 'chars;', (html.match(/bbs-sec/g) || []).length, 'sections; first stage', first.length, 'chars')
  for (const bad of [/\\bYou\\b/, /Your Build/, /undefined/, /NaN/]) if (bad.test(html)) console.log('  !! found', bad, '…' + html.slice(Math.max(0, html.search(bad) - 120), html.search(bad) + 60))
}
console.log('team spin', renderToStaticMarkup(React.createElement(BaseballTeamSpin, { isCustomMode: false, onTeamSelected() {}, build: {} })).length, 'chars')
`
await build({
  stdin: { contents: entry, resolveDir: path.resolve('scripts/baseball'), loader: 'jsx' },
  bundle: true, platform: 'node', format: 'esm', outfile: `${out}/check.mjs`, jsx: 'automatic', loader: { '.js': 'jsx', '.jsx': 'jsx' },
  define: { 'import.meta.env': '{"DEV":false}' }, plugins: [redirect], logLevel: 'error',
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url); globalThis.window = globalThis.window || { matchMedia: () => ({ matches: false }), location: { search: '', pathname: '/baseball' }, addEventListener() {}, removeEventListener() {} }; const _el = () => ({ classList: { contains: () => false, add() {}, remove() {}, toggle() {} }, style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, removeAttribute() {}, getAttribute() { return null }, dataset: {}, addEventListener() {}, appendChild() {} }); globalThis.document = globalThis.document || { ..._el(), documentElement: _el(), body: _el(), head: _el(), createElement: _el, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, fonts: null }; globalThis.window.document = globalThis.document; globalThis.window.dispatchEvent = () => {}; globalThis.requestAnimationFrame = f => setTimeout(f, 0); globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; globalThis.sessionStorage = globalThis.localStorage;" },
})
await import(`file:///${out}/check.mjs`)
