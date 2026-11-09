// How deep the real 2027 draft class is in the data, by OVR: node scripts/cfb/class-depth.mjs
import { loadCFB } from './load.mjs'
const { vite, sim } = await loadCFB()
try {
  const L = sim.cfbLeague()
  for (const pos of ['qb', 'rb', 'wr']) {
    const starters = L.players[pos].filter(p => (p.depth ?? 1) <= (pos === 'wr' ? 3 : 1))
    const sen = starters.filter(p => /SR|GR/.test(String(p.year).toUpperCase()))
    const elig = starters.filter(p => /JR|SR|GR|RS-SO/.test(String(p.year).toUpperCase()))
    const n = (list, o) => list.filter(p => p.ovr >= o).length
    console.log(pos, `starters ${starters.length} · eligible ${elig.length} · seniors ${sen.length} | seniors OVR>=90 ${n(sen, 90)}, >=85 ${n(sen, 85)}, >=80 ${n(sen, 80)} | eligible >=90 ${n(elig, 90)}, >=85 ${n(elig, 85)}`)
  }
} finally { await vite.close() }
