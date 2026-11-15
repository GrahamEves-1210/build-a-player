// Where a save's bytes go.  bash scripts/franchise2/run.sh scripts/franchise2/size.mjs
import * as FR from '../../src/lib/franchise2/index'
let F = FR.createFranchise({ seed: 'size', team: 'DEN', owner: 'G', builds: [] })
FR.simWeeks(F)
for (const [k, v] of Object.entries(F)) console.log(k.padEnd(12), JSON.stringify(v ?? null).length)
console.log('player sample', JSON.stringify(F.teams.DEN.r[0]), JSON.stringify(F.dc[0]))
