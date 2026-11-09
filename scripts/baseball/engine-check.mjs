// The engine's league line against the environment it's tuned to: node scripts/baseball/engine-check.mjs [games=4000]
import { load } from './bundle.mjs'
const { S, used } = await load()
console.log('data:', JSON.stringify(used))
const n = Number(process.argv[2] ?? 4000)
for (const mode of ['current', 'alltime']) {
  const t0 = Date.now()
  const r = S.baseballEngineCheck(mode, n, 7)
  console.log(mode, `${Date.now() - t0}ms`, JSON.stringify(r))
}
for (const [off, def] of [[8, 5.5], [3, 5.5], [5.5, 8], [5.5, 3]]) {
  const r = S.baseballEngineCheck('current', n, 9, off, def)
  console.log(`off ${off} def ${def}: R/G ${r.rg} (target ${r.target.rg})`)
}
