// OVR spread of the real players and where a season's time goes: node scripts/cfb/profile.mjs
import { loadCFB } from './load.mjs'
const { vite, sim } = await loadCFB()
try {
  const L = sim.cfbLeague()
  for (const pos of ['qb', 'rb', 'wr']) {
    const o = L.players[pos].map(p => p.ovr).sort((a, b) => b - a)
    const st = L.players[pos].filter(p => p.depth === 1).map(p => p.ovr).sort((a, b) => b - a)
    console.log(pos, 'top10', o.slice(0, 10).join(' '), '| depth-1 p10/p50/p90', st[Math.floor(st.length * 0.1)], st[Math.floor(st.length * 0.5)], st[Math.floor(st.length * 0.9)])
  }
  const b = Object.fromEntries(sim.CFB_TYPES_BY_POS.qb.map(t => [t, { val: 7 }]))
  sim.runCFBSimulation(b, null, 'OSU', 'qb', 'warm')
  const t0 = performance.now(); for (let i = 0; i < 30; i++) sim.runCFBSimulation(b, null, 'OSU', 'qb', 'p' + i)
  console.log('ms/season', ((performance.now() - t0) / 30).toFixed(1))
} finally { await vite.close() }
// lite (the director's re-runs)
{
  const { vite: v2, sim: s2 } = await loadCFB()
  try {
    const b = Object.fromEntries(s2.CFB_TYPES_BY_POS.qb.map(t => [t, { val: 7 }]))
    s2.runCFBSimulation(b, null, 'OSU', 'qb', 'warm', 'classic', null, { lite: true })
    let t0 = performance.now(); for (let i = 0; i < 30; i++) s2.runCFBSimulation(b, null, 'OSU', 'qb', 'p' + i, 'classic', null, { lite: true })
    console.log('lite ms/season', ((performance.now() - t0) / 30).toFixed(1))
    t0 = performance.now(); for (let i = 0; i < 30; i++) s2.runCFBSimulation(b, null, 'OSU', 'qb', 'p' + i)
    console.log('full ms/season', ((performance.now() - t0) / 30).toFixed(1))
  } finally { await v2.close() }
}
