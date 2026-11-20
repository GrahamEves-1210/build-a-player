// The real men without a birth year (src/data/player-ages.js): how many, and the age each now starts at.
//   bash scripts/franchise2/run.sh scripts/franchise2/frfix-ages.mjs
import * as FR from '../../src/lib/franchise2/index'
const pool = FR.realPool()
let n = 0, miss = 0
const rows = []
for (const pos of FR.POS) for (const r of pool[pos]) { n++; if (r.est) { miss++; rows.push(`${pos} ${r.name} ${r.team} ${r.age ?? 'random'}`) } else if (r.age == null) { miss++; rows.push(`${pos} ${r.name} ${r.team} random 23-30`) } }
console.log(`${n} real men, ${miss} without a birth year`)
console.log(rows.slice(0, 40).join('\n'))
for (const nm of ['Jacob Rodriguez', 'Carson Schwesinger']) for (const pos of FR.POS) { const r = pool[pos].find(x => x.name === nm); if (r) console.log(nm, r.age, r.est ? '(estimated)' : '') }
