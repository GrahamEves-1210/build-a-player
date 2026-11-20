// The real men without a birth year (src/data/player-ages.js): how many, and the age each now starts at.
//   bash scripts/franchise2/run.sh scripts/franchise2/frfix-ages.mjs
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
FR.useContracts(CONTRACTS)
const pool = FR.realPool()
let n = 0, miss = 0
const rows = []
for (const pos of FR.POS) for (const r of pool[pos]) { n++; if (r.est) { miss++; rows.push(`${pos} ${r.name} ${r.team} ${r.age ?? 'random'}`) } else if (r.age == null) { miss++; rows.push(`${pos} ${r.name} ${r.team} (age from the draft year)`) } }
console.log(`${n} real men, ${miss} without a birth year`)
console.log(rows.slice(0, 40).join('\n'))
console.log('the scouts stage for a starter with room left, by age:', ['qb', 'rb', 'lb', 'ol'].map(pos => `${pos.toUpperCase()} ` + [22, 24, 25, 26, 27, 28, 29, 30, 31, 33].map(ag => `${ag} ${FR.scoutRead({ i: 7, p: pos, ag, o: 82, pk: 90 }, true).stage.split(' ').map(w => w[0]).join('')}`).join(' ')).join(' | '))
const F = FR.createFranchise({ seed: 'ages', team: 'CLE', owner: 'G', builds: [] })
for (const nm of ['Jacob Rodriguez', 'Carson Schwesinger', 'Roquan Smith']) for (const s of FR.SHORTS) { const p = F.teams[s].r.find(x => x.n === nm); if (p) console.log(`${nm} (${s}) starts the franchise at ${p.ag}: ${FR.scoutRead(p, true).line}, ${FR.scoutRead(p, true).stage}`) }
for (const nm of ['Jacob Rodriguez', 'Carson Schwesinger']) for (const pos of FR.POS) { const r = pool[pos].find(x => x.name === nm); if (r) console.log(nm, r.age, r.est ? '(estimated)' : '') }
