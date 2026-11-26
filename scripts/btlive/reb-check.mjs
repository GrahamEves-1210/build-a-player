// BLACKTOP LIVE: who comes down with a miss in 1v1 (the owner, 11-26: "CPU grabs its own rebound every time"). The CPU
// (pro) against a person bot (balance.mjs's average hands, defending as the CPU does: on his man, a hand up, then to
// the glass). Of the misses that someone rebounds: the shooter's own share, short (within 10 ft) and long.
// Run: node scripts/btlive/reb-check.mjs [--games=120] [--lib=src/lib/btlive]
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const lib = path.resolve(arg('lib') || 'src/lib/btlive')
const { createGame, step, cpuInput, flatBuild, HZ } = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const G = Number(arg('games')) || 120
const person = { meterSd: 55, react: 12, contest: 0.8, steal: 0.16, help: 0.45, ev: 0.08, move: 0.75, gap: 0.3, fake: 0.1, bite: 1 }
const grade = 1 + (80 - 57) / 44 * 9
const R = { cpu: [0, 0, 0, 0], kid: [0, 0, 0, 0] }      // own short, all short, own long, all long
for (const pos of ['guard', 'big']) for (let g = 0; g < G; g++) {
  const s = createGame({ teams: [[{ id: 'p', pos, build: flatBuild(pos, grade) }], [{ id: 'c', pos, build: flatBuild(pos, grade) }]], seed: `rb-${pos}-${g}` })
  let miss = null
  while (s.phase !== 'over' && s.tick < 30 * 60 * HZ) {
    step(s, [cpuInput(s, 0, person), cpuInput(s, 1, 'pro')])
    for (const e of s.events) {
      if (e.e === 'release') miss = { pid: e.pid, d: e.d }
      if (e.e === 'miss' && miss) miss.miss = true
      if (e.e === 'board' && e.reb && miss?.miss) {
        const who = miss.pid === 1 ? R.cpu : R.kid, long = miss.d > 10 ? 2 : 0
        who[long + 1]++; if (e.pid === miss.pid) who[long]++
        miss = null
      }
      if (e.e === 'poss' || e.e === 'make') miss = null
    }
  }
}
const pc = (a, b) => `${b ? Math.round(100 * a / b) : 0}%`
console.log(`lib: ${path.relative(process.cwd(), lib) || '.'}   ${G * 2} games (guards and bigs)`)
for (const [k, v] of Object.entries(R)) console.log(`  ${k === 'cpu' ? 'CPU shooter   ' : 'person shooter'}  his own miss: ${pc(v[0] + v[2], v[1] + v[3])} (short ${pc(v[0], v[1])} of ${v[1]}, long ${pc(v[2], v[3])} of ${v[3]})`)
