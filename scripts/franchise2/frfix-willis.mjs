// Where Malik Willis is when a franchise starts (a player's report, 2026-11-19: "not on the Dolphins").
//   bash scripts/franchise2/run.sh scripts/franchise2/frfix-willis.mjs
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
FR.useContracts(CONTRACTS)
for (const team of ['MIA', 'DEN']) {
  const F = FR.createFranchise({ seed: 'w-' + team, team, owner: 'G', builds: [] })
  const w = FR.SHORTS.map(s => [s, F.teams[s].r.find(p => p.n === 'Malik Willis')]).find(x => x[1])
  const fa = (F.fa ?? []).find(p => p.n === 'Malik Willis')
  console.log(`${team} franchise: Willis ${w ? `${w[0]} OVR ${w[1].o} $${w[1].$}M` : fa ? 'a free agent' : 'nowhere'} | MIA QBs ${F.teams.MIA.r.filter(p => p.p === 'qb').map(p => `${p.n} ${p.o}`).join(', ')}`)
  console.log(`  ${team} wire: ${(F.news ?? []).filter(n => n.s === team).map(n => n.text).join(' | ') || 'nothing'} | room ${FR.capSheet(F, team).room}M`)
}
