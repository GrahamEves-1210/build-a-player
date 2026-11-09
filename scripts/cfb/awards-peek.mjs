// Who wins the awards against an elite build: node scripts/cfb/awards-peek.mjs [pos] [team] [n]
import { loadCFB } from './load.mjs'
const [pos = 'wr', team = 'OSU', n = 6] = process.argv.slice(2)
const { vite, sim } = await loadCFB()
try {
  const types = sim.CFB_TYPES_BY_POS[pos]
  const b = Object.fromEntries(types.map((t, i) => [t, { val: i % 2 ? 10 : 9 }]))
  const key = { qb: 'daveyOBrien', rb: 'doakWalker', wr: 'biletnikoff' }[pos]
  for (let i = 0; i < +n; i++) {
    const r = sim.runCFBSimulation(b, null, team, pos, 'peek' + i)
    const a = r.cfb.awards[key]
    const tc = r.cfb.totals.throughCCG; console.log(`${r.wins}-${r.losses} user through CCG: ${JSON.stringify(tc).slice(0, 110)}`)
    console.log('   ', key, a.finalists.map(f => `${f.name}${f.isUser ? '*' : ''} (${f.team}): ${f.line}`).join(' | '))
    console.log('    Heisman', r.cfb.awards.heisman.ballot.slice(0, 4).map(f => `${f.name} ${f.pos} ${f.team} ${f.pts}: ${f.line}`).join(' | '))
  }
} finally { await vite.close() }
