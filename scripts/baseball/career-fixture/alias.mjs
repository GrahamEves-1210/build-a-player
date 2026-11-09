// TEST HELPER (career agent): an esbuild plugin for node runs of the baseball career. While the data agent's
// src/data/mlb-*.js or the sim agent's src/utils/baseballSimulation.js are missing, their imports resolve to the
// stand-ins in scripts/baseball/career-fixture/ (the career agent's own; scripts/baseball/fixture/ is the sim
// agent's). Once the real files exist they are used as they are.
import { existsSync } from 'fs'
import { resolve } from 'path'
const FIX = 'F:/build-a-player/scripts/baseball/career-fixture'
const REAL_TEAMS = 'F:/build-a-player/src/data/mlb-teams.js'
const MAP = {
  'mlb-teams': `${FIX}/mlb-teams.js`, 'mlb-batters': `${FIX}/mlb-players.js`, 'mlb-pitchers': `${FIX}/mlb-players.js`,
  'mlb-legend-batters': `${FIX}/mlb-players.js`, 'mlb-legend-pitchers': `${FIX}/mlb-players.js`, 'mlb-headshots.json': `${FIX}/mlb-headshots.json`,
  baseballSimulation: `${FIX}/baseballSimulation.js`,
}
const slash = s => String(s ?? '').split(String.fromCharCode(92)).join('/')
export const baseballAlias = { name: 'baseball-fixture', setup(b) {
  // (the fixture's players are made from the clubs: the real clubs once they're in)
  b.onResolve({ filter: /^\.\/mlb-teams\.js$/ }, a => (slash(a.importer).includes('career-fixture') && existsSync(REAL_TEAMS) ? { path: REAL_TEAMS } : null))
  b.onResolve({ filter: /(mlb-[a-z-]+(\.json)?|baseballSimulation)$/ }, a => {
    const key = a.path.split('/').pop()
    if (!MAP[key]) return null
    const real = resolve(a.resolveDir, a.path)
    if (existsSync(real) || existsSync(`${real}.js`)) return null
    return { path: MAP[key] }
  })
} }
export const usingFixture = () => Object.entries({ teams: 'src/data/mlb-teams.js', batters: 'src/data/mlb-batters.js', pitchers: 'src/data/mlb-pitchers.js', sim: 'src/utils/baseballSimulation.js' }).filter(([, f]) => !existsSync(`F:/build-a-player/${f}`)).map(([k]) => k)
