// The cap at the start of a league: every team's cap used, the biggest deals, the rookie scale, the builds' slots.
//   bash scripts/franchise2/run.sh scripts/franchise2/cap.mjs
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { capSheet, rookieScale, buildSlot } from '../../src/lib/franchise2/contracts'

// (the real contracts: Vite reads the file itself; a headless run hands it in)
console.log(`real contracts: ${FR.useContracts(CONTRACTS)}`)
const F = FR.createFranchise({ seed: 'cap', team: 'DEN', owner: 'G', builds: [] })
const rows = FR.SHORTS.map(s => [s, capSheet(F, s)]).sort((a, b) => b[1].used - a[1].used)
console.log(rows.map(([s, c]) => `${s} used ${c.used} (men ${c.pay} + rest ${c.rest}) room ${c.room}`).join('\n'))
const top = FR.SHORTS.flatMap(s => F.teams[s].r).sort((a, b) => b.$ - a.$).slice(0, 15)
console.log(top.map(p => `${p.n} ${p.p}/${p.s ?? ''} ${p.o} $${p.$}M ${p.y}y`).join('\n'))
console.log('rookie scale', [1, 5, 10, 20, 32, 33, 50, 64, 65, 100, 150, 262].map(n => `${n}:${rookieScale(n).$}`).join(' '))
console.log('build slots', [99, 95, 90, 85, 80, 75, 70].map(o => `${o}->${buildSlot(o)}`).join(' '))
