// BLACKTOP LIVE: points a possession by how it was played (the owner, 11-27: "the post game already feels slightly
// overpowered"). CPU games, all-star both sides, equal builds: a big on a big, a big on a guard (both ways). Every
// possession that ended in a shot, by what it was: a post-up (he was in the post this time), a drive (a layup or a dunk,
// no post), a jumper. Points each (a make is 1, a three 2). And the post with S Size against A.
// Run: node scripts/btlive/ppp-check.mjs [--games=200] [--lib=src/lib/btlive]
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const lib = path.resolve(arg('lib') || 'src/lib/btlive')
const { createGame, step, cpuInput, flatBuild, HZ } = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const G = Number(arg('games')) || 200
const grade = 1 + (80 - 57) / 44 * 9
function run(name, a, b) {
  const by = { post: [0, 0], drive: [0, 0], jumper: [0, 0] }
  for (let g = 0; g < G; g++) {
    const s = createGame({ teams: [[{ id: 'a', pos: a[0], build: flatBuild(a[0], a[1] ?? grade, a[2]) }], [{ id: 'b', pos: b[0], build: flatBuild(b[0], b[1] ?? grade, b[2]) }]], seed: `ppp-${name}-${g}` })
    let posted = new Set(), shot = null
    while (s.phase !== 'over' && s.tick < 30 * 60 * HZ) {
      step(s, [cpuInput(s, 0, 'allstar'), cpuInput(s, 1, 'allstar')])
      for (const e of s.events) {
        if (e.e === 'post') posted.add(e.pid)
        if (e.e === 'release') shot = { pid: e.pid, kind: posted.has(e.pid) || e.kind === 'hook' || e.kind === 'fade' ? 'post' : e.kind === 'jumper' ? 'jumper' : 'drive', pts: 0 }
        if (e.e === 'block' && shot === null) shot = { pid: e.on, kind: posted.has(e.on) ? 'post' : e.kind === 'jumper' ? 'jumper' : 'drive', pts: 0 }
        if (e.e === 'make' && shot) shot.pts = e.pts
        if (e.e === 'poss' || e.e === 'make' || e.e === 'miss' || e.e === 'block') {
          if (shot && (e.e === 'make' || e.e === 'miss' || e.e === 'block')) { by[shot.kind][0]++; by[shot.kind][1] += shot.pts; shot = null }
          if (e.e === 'poss') posted = new Set()
        }
      }
    }
  }
  const f = k => by[k][0] ? `${(by[k][1] / by[k][0]).toFixed(2)} (${by[k][0]})` : '-'
  console.log(`  ${name.padEnd(36)} post ${f('post').padEnd(13)} drive ${f('drive').padEnd(13)} jumper ${f('jumper')}`)
}
console.log(`lib: ${path.relative(process.cwd(), lib) || '.'}   points a shot, by what it was (all-star CPUs, ${G} games)`)
run('big v big, equal (80)', ['big'], ['big'])
run('big v guard, equal (80)', ['big'], ['guard'])
run('guard v big, equal (80)', ['guard'], ['big'])
run('big S Size v big A Size (rest A)', ['big', 9, { size: 11 }], ['big', 9])
run('big A+ Size v big A Size (rest A)', ['big', 9, { size: 10 }], ['big', 9])
