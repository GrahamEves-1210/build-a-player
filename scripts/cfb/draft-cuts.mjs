// The draft cuts the engine derives from the data: node scripts/cfb/draft-cuts.mjs
import { loadCFB } from './load.mjs'
const { vite, sim } = await loadCFB()
try {
  for (const pos of ['qb', 'rb', 'wr']) {
    const b = Object.fromEntries(sim.CFB_TYPES_BY_POS[pos].map(t => [t, { val: 7 }]))
    sim.runCFBSimulation(b, null, 'OSU', pos, 'cuts')
    console.log(pos, 'top10 / R1 / Day 2 / Day 3 / PFA at OVR', sim.cfbLeague().draftCuts[pos].join(' / '))
  }
} finally { await vite.close() }
