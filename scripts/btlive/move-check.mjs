// BLACKTOP LIVE: how men move, by rating (the owner, 11-26: a quick guard and a slow big clearly different, a first
// step then a build, a sprint in a straight line, cuts that cost speed, stopping that takes room). A man off the ball,
// nobody near him, on the real sim (sim.js move): time to top speed from a standstill, his top speed, what a straight
// sprint adds, what a hard cut costs, how far he slides stopping from a sprint.
// Run: node scripts/btlive/move-check.mjs
import { createGame, step, flatBuild, HZ, GHZ } from '../../src/lib/btlive/index.js'

const STEP = 1 / GHZ                       // the game's seconds a tick
const man = (id, pos, over) => ({ id, name: id, pos, build: flatBuild(pos, 6, over) })
const fmt = (v, d = 1) => v.toFixed(d)

function trial(pos, over, plan) {
  const s = createGame({ teams: [[man('a', 'guard', {})], [man('b', pos, over)]], seed: 'move' })
  for (let i = 0; i < 400 && s.phase !== 'live'; i++) step(s, [{}, {}])
  const a = s.players[0], p = s.players[1]
  s.poss = 0; s.ball.holder = 0; s.ball.st = 'held'; s.mustClear = null       // (the ball his: ours is off it)
  // the man with the ball stands in the far corner; ours starts at half court, still
  a.x = 4; a.y = 4; p.x = 50; p.y = 46; p.vx = p.vy = 0; p.runT = 0
  const log = []
  for (let t = 0; t < plan.length; t++) { step(s, [{}, plan[t]]); log.push({ x: p.x, y: p.y, v: Math.hypot(p.vx, p.vy), top: p.R.top }); s.clock = 99 * HZ }
  return { log, R: p.R }
}
const hold = (n, mx, my) => Array.from({ length: n }, () => ({ mx, my }))

const rows = [
  ['quick guard (Speed 11, Size 2)', 'guard', { speed: 11, size: 2 }],
  ['average guard (Speed 6, Size 5)', 'guard', { speed: 6, size: 5 }],
  ['wing (Speed 7, Size 7)', 'guard', { speed: 7, size: 7 }],
  ['slow big (Speed 2, Size 11)', 'big', { speed: 2, size: 11 }],
]
console.log('off the ball, nobody near him (ft/s; times in real seconds)')
console.log('who'.padEnd(34) + 'top    90% of it in   0-15 ft   sprint (after 2.5 s)   hard cut at speed: speed after 0.25 s   stop from a sprint')
for (const [nm, pos, over] of rows) {
  // straight up the floor (toward the baseline) for 2.5 s
  const n = Math.round(2.5 * GHZ)
  const { log, R } = trial(pos, over, hold(n, -1, 0))
  const t90 = log.findIndex(l => l.v >= 0.9 * R.top) * STEP / (HZ / GHZ)
  const x0 = 50
  const t15 = log.findIndex(l => x0 - l.x >= 15) * STEP / (HZ / GHZ)
  const vs = log[log.length - 1].v
  // a hard cut: running left, then the stick straight down (90 degrees)
  const c = trial(pos, over, [...hold(Math.round(1.2 * GHZ), -1, 0), ...hold(Math.round(0.25 * GHZ), 0, -1)])
  const before = c.log[Math.round(1.2 * GHZ) - 1].v, after = c.log[c.log.length - 1].v
  // stopping: run 1.5 s, let go
  const st = trial(pos, over, [...hold(Math.round(1.5 * GHZ), -1, 0), ...hold(GHZ, 0, 0)])
  const k0 = Math.round(1.5 * GHZ) - 1, stop = Math.abs(st.log[st.log.length - 1].x - st.log[k0].x)
  console.log(nm.padEnd(34) + `${fmt(R.top)}   ${fmt(t90, 2)} s        ${fmt(t15, 2)} s    ${fmt(vs)} (+${fmt((vs / R.top - 1) * 100, 0)}%)`.padEnd(46) + `${fmt(before)} -> ${fmt(after)} (-${fmt((1 - after / before) * 100, 0)}%)`.padEnd(40) + `${fmt(stop)} ft`)
}

// WITH THE BALL, BY WAY (the owner, 11-26: "backing up with the ball should be slower than driving to the basket"): a man
// with the ball at the top of the key, nobody near, the stick held one way for 2 s: his speed at the end (ft/s). And a
// defender a few feet off his man, the same: at him, across, backing off
function wayTrial(pos, over, mx, my, guard = false) {
  const s = createGame({ teams: [[man('a', pos, over)], [man('b', 'guard', {})]], seed: 'way' })
  for (let i = 0; i < 400 && s.phase !== 'live'; i++) step(s, [{}, {}])
  const a = s.players[0], b = s.players[1]
  s.poss = guard ? 1 : 0; s.ball.holder = guard ? 1 : 0; s.ball.st = 'held'; s.mustClear = null
  if (guard) { b.x = 28; b.y = 22; a.x = 28; a.y = 28 } else { a.x = 28; a.y = guard ? 28 : (my > 0 ? 18 : 40); b.x = 6; b.y = 44 }
  a.vx = a.vy = 0; b.vx = b.vy = 0; a.runT = 0
  let top = 0
  for (let t = 0; t < Math.round(1.2 * GHZ); t++) {
    if (guard) { b.x = 28; b.y = 22; b.vx = b.vy = 0; if (Math.hypot(a.x - b.x, a.y - b.y) < 4) { a.x = 28 + (a.x - 28) * 0.0; } }
    step(s, guard ? [{ mx, my }, {}] : [{ mx, my }, {}]); s.clock = 99 * HZ; top = Math.max(top, Math.hypot(a.vx, a.vy))
  }
  return top
}
console.log('\nwith the ball, top speed over 1.2 s by way (ft/s; the basket is up the floor)')
console.log('who'.padEnd(34) + 'at the rim   across   backing out   (backing out / at the rim)')
for (const [nm, pos, over] of [rows[0], rows[3]]) {
  const f = wayTrial(pos, over, 0, -1), sd = wayTrial(pos, over, 1, 0), bk = wayTrial(pos, over, 0, 1)
  console.log(nm.padEnd(34) + `${fmt(f)}         ${fmt(sd)}     ${fmt(bk)}          ${fmt(100 * bk / f, 0)}%`)
}
