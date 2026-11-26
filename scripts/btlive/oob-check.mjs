// BLACKTOP LIVE: how often the man with the ball steps out of bounds (the owner, 11-26: "goes out of bounds too
// easily"). CPU games, and a person bot: a kid with the ball running to spots all over the floor, the lines and
// corners among them (some just past a line), stopping on them, against a CPU defender.
// Run: node scripts/btlive/oob-check.mjs [--lib=src/lib/btlive] [--games=60]
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const lib = path.resolve(arg('lib') || 'src/lib/btlive')
const { createGame, step, cpuInput, flatBuild, COURT, HZ } = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const G = Number(arg('games')) || 60
let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const man = (id, pos) => ({ id, name: id, pos, build: flatBuild(pos, 7) })
function games(teams, bot) {
  let oob = 0, poss = 0, n = 0
  for (let g = 0; g < G; g++) {
    const s = createGame({ teams: teams(), seed: `oob-${g}` }), spot = {}
    while (s.phase !== 'over' && s.tick < 25 * 60 * HZ) {
      const inp = s.players.map((p, i) => (bot && i === 0 ? bot(s, i, spot) : cpuInput(s, i, 'pro')))
      step(s, inp)
      for (const e of s.events) { if (e.e === 'oob' && e.pid != null) oob++; if (e.e === 'poss') poss++ }
    }
    n++
  }
  return `${(oob / n).toFixed(2)} a game (${(100 * oob / Math.max(1, poss)).toFixed(1)}% of possessions)`
}
// the kid: with the ball he runs at a spot (a third of them on or just past a line), stops there a beat, goes on;
// shoots now and then; without it the CPU plays him
const kid = (s, i, sp) => {
  const p = s.players[i]
  if (!(s.phase === 'live' && s.ball.st === 'held' && s.ball.holder === i) || p.act === 'gather') return cpuInput(s, i, 'pro')
  if (!sp.t || s.tick > sp.t) {
    const edge = rnd() < 0.4, side = Math.floor(rnd() * 4)
    sp.x = COURT.minX + 2 + rnd() * 46; sp.y = COURT.minY + 2 + rnd() * 40
    if (edge) { if (side === 0) sp.x = COURT.minX - 0.5 + rnd(); else if (side === 1) sp.x = COURT.maxX + 0.5 - rnd(); else if (side === 2) sp.y = COURT.minY - 0.5 + rnd(); else sp.y = COURT.maxY + 0.5 - rnd() }
    sp.t = s.tick + Math.round((0.8 + 1.6 * rnd()) * HZ)
  }
  const dx = sp.x - p.x, dy = sp.y - p.y, d = Math.hypot(dx, dy)
  const o = { mx: d > 0.5 ? dx / d : 0, my: d > 0.5 ? dy / d : 0, shoot: rnd() < 0.01 }
  return o
}
console.log(`lib: ${path.relative(process.cwd(), lib) || '.'}`)
console.log(`  1v1 CPU (pro v pro):        ${games(() => [[man('a', 'guard')], [man('b', 'guard')]])}`)
console.log(`  2v2 CPU:                    ${games(() => [[man('a', 'guard'), man('c', 'big')], [man('b', 'guard'), man('d', 'big')]])}`)
console.log(`  1v1, a kid steering to spots by the lines: ${games(() => [[man('a', 'guard')], [man('b', 'guard')]], kid)}`)
