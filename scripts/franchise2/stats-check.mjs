// The league's numbers after a season: leaders at every stat (do they look like an NFL season's?), and how long
// the league's box scores take.   bash scripts/franchise2/run.sh scripts/franchise2/stats-check.mjs
import * as FR from '../../src/lib/franchise2/index'
import { leagueStats, leaders, LEADER_CATS } from '../../src/lib/franchise2/stats'

const F = FR.createFranchise({ seed: 'stats', team: 'DEN', owner: 'G', builds: [] })
FR.simWeeks(F)
let t0 = performance.now()
const tot = leagueStats(F)
console.log(`league boxes: ${(performance.now() - t0).toFixed(0)} ms, ${Object.keys(tot).length} men`)
t0 = performance.now(); leagueStats(F); console.log(`again (cached): ${(performance.now() - t0).toFixed(1)} ms`)
for (const c of LEADER_CATS) {
  const L = leaders(F, c.f ?? c.k, 5, { tot })
  console.log(c.label.padEnd(20), L.map(x => `${x.p.n} ${x.s} ${x.v}`).join(' | '))
}
