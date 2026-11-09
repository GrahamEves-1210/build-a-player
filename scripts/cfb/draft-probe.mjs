// Where each build tier lands on the draft board: node scripts/cfb/draft-probe.mjs [N=60] [teams=OSU,BOIS] [positions]
import { loadCFB } from './load.mjs'
const N = +(process.argv[2] || 60), TEAMS = (process.argv[3] || 'OSU,BOIS').split(','), POS = (process.argv[4] || 'qb,rb,wr').split(',')
const { vite, sim } = await loadCFB()
const TIERS = process.env.TIERS ? Object.fromEntries(process.env.TIERS.split(',').map(v => [`all-${v}`, () => +v])) : { elite: i => (i % 2 ? 10 : 9), good: () => 7, average: () => 5, poor: () => 3 }
try {
  for (const pos of POS) for (const [tier, f] of Object.entries(TIERS)) for (const team of TEAMS) {
    const types = sim.CFB_TYPES_BY_POS[pos]
    const b = Object.fromEntries(types.map((t, i) => [t, { type: t, val: f(i) }]))
    const ranks = [], tiers = {}
    let of = 0
    for (let i = 0; i < N; i++) {
      const d = sim.runCFBSimulation(b, types, team, pos, `dp-${pos}-${tier}-${team}-${i}`).cfb.draft
      ranks.push(d.boardRank); of += d.boardOf; tiers[d.tier] = (tiers[d.tier] ?? 0) + 1
    }
    ranks.sort((a, b) => a - b)
    console.log(pos, tier.padEnd(8), team.padEnd(5), `board rank median ${ranks[ranks.length >> 1]} (p10 ${ranks[Math.floor(N * 0.1)]}, p90 ${ranks[Math.floor(N * 0.9)]}) of ~${Math.round(of / N)}`, '|', ['top10', 'r1', 'day2', 'day3', 'pfa', 'udfa'].filter(k => tiers[k]).map(k => `${k} ${Math.round(tiers[k] / N * 100)}%`).join(' '))
  }
} finally { await vite.close() }
