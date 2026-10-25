// Economy audit (read-only): what a typical season pays. Plays N seasons per sport with
// builds made the way the spins make them (each trait the best of a few real players),
// on random teams, and prints the averages. Run: node scripts/economy-seasons.mjs [N]
import { createServer } from 'vite'

const N = +(process.argv[2] || 300)
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const sim = await vite.ssrLoadModule('/src/utils/simulation.js')
  const bsim = await vite.ssrLoadModule('/src/utils/bucketSimulation.js')
  const { QBS, TYPES } = await vite.ssrLoadModule('/src/data/qbs.js')
  const { NFL_TEAMS } = await vite.ssrLoadModule('/src/data/nfl-teams.js')
  const { NBA_GUARD_PLAYERS, GUARD_TYPES } = await vite.ssrLoadModule('/src/data/nba-guards.js')
  const { NBA_TEAMS } = await vite.ssrLoadModule('/src/data/nba-teams.js')
  const { COINS, XP } = await vite.ssrLoadModule('/src/lib/progress.js')
  const pick = a => a[Math.floor(Math.random() * a.length)]
  const buildFor = (pool, types, tries) => Object.fromEntries(types.map(t => {
    const p = Array.from({ length: tries }, () => pick(pool)).sort((a, b) => (b.attrs?.[t] ?? 0) - (a.attrs?.[t] ?? 0))[0]
    return [t, { type: t, val: p.attrs?.[t] ?? 5, qb: p.short, qbFull: p.name, team: p.team }]
  }))
  const report = (label, rows) => {
    const avg = f => rows.reduce((a, r) => a + f(r), 0) / rows.length
    const pct = f => `${Math.round(avg(r => (f(r) ? 1 : 0)) * 100)}%`
    console.log(`${label.padEnd(20)} OVR ${avg(r => r.ovr).toFixed(1)} · wins ${avg(r => r.wins).toFixed(1)} · winning ${pct(r => r.winning)} · playoffs ${pct(r => r.playoffs)} · titles ${pct(r => r.champion)} · coins ${avg(r => r.coins).toFixed(1)} · XP ${avg(r => r.xp).toFixed(1)} (before awards)`)
  }
  for (const tries of [2, 4]) {
    const nfl = [], nba = []
    for (let i = 0; i < N; i++) {
      const b = buildFor(QBS.filter(p => p.attrs), TYPES, tries)
      const r = sim.runSimulation(b, TYPES, pick(NFL_TEAMS), false)
      const ovr = sim.calcOVR(b, TYPES)
      const champion = !!(r.sbResult?.won ?? r.champion)
      const playoffs = !!(r.playoffs ?? r.madePlayoffs ?? r.sbResult)
      const winning = r.wins >= 10
      nfl.push({ ovr, wins: r.wins, playoffs, champion, winning,
        coins: COINS.season + r.wins * COINS.winNfl + (playoffs ? COINS.playoffs : 0) + (champion ? COINS.ring : 0),
        xp: XP.season + (winning ? XP.winning : 0) + (playoffs ? XP.playoffs : 0) + (champion ? XP.ring : 0) })
      const g = buildFor(NBA_GUARD_PLAYERS.filter(p => p.attrs), GUARD_TYPES, tries)
      const t = pick(NBA_TEAMS)
      const br = bsim.runBucketSimulation(g, GUARD_TYPES, t, 'guard', null, 'classic')
      const bw = br.wins >= 50
      nba.push({ ovr: br.ovr ?? 0, wins: br.wins, playoffs: !!br.madePlayoffs, champion: !!br.champion, winning: bw,
        coins: COINS.season + Math.round(br.wins * COINS.winNba) + (br.madePlayoffs ? COINS.playoffs : 0) + (br.champion ? COINS.ring : 0),
        xp: XP.season + (bw ? XP.winning : 0) + (br.champion ? XP.ring : 0) })
    }
    report(`football (best of ${tries})`, nfl)
    report(`basketball (best of ${tries})`, nba)
  }
} finally { await vite.close() }
