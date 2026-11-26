// BLACKTOP LIVE: does a set defender stay in front of a straight drive (the owner, 11-26: "too easy to blow past a CPU
// defender")? A handler at the top of the key, his man (a CPU) set in front of him; the bot drives: straight at the
// rim (the stick held there), at the rim a little to one side (going round him), or a crossover then the drive. Clean
// by: he gets within 7 ft of the rim with his man a step or more behind him (or frozen) inside 3 s.
// Run: node scripts/btlive/drive-check.mjs [--n=300] [--lib=src/lib/btlive]
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const lib = path.resolve(arg('lib') || 'src/lib/btlive')
const { createGame, step, cpuInput, flatBuild, COURT, HZ } = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const N = Number(arg('n')) || 300
const RIM = COURT.rim
const grade = 1 + (80 - 57) / 44 * 9
const rd = p => Math.hypot(p.x - RIM.x, p.y - RIM.y)
function trial(lvl, how, g, over = {}) {
  const s = createGame({ teams: [[{ id: 'h', pos: 'guard', build: flatBuild('guard', grade, over) }], [{ id: 'd', pos: 'guard', build: flatBuild('guard', grade) }]], seed: `dr-${how}-${lvl}-${g}` })
  for (let i = 0; i < 400 && s.phase !== 'live'; i++) step(s, [{}, {}])
  const h = s.players[0], d = s.players[1]
  s.poss = 0; s.ball.holder = 0; s.ball.st = 'held'; s.mustClear = null; s.clock = 600
  const jx = (g % 7 - 3) * 0.6
  h.x = 28 + jx; h.y = 31; h.vx = h.vy = 0; d.x = 28 + jx * 0.8; d.y = 26.6; d.vx = d.vy = 0; d.act = 'free'
  // (his man settles in front first: a beat)
  for (let t = 0; t < 10; t++) step(s, [{ mx: 0, my: 0 }, cpuInput(s, 1, lvl)])
  const side = g % 2 ? 1 : -1
  for (let t = 0; t < 3 * HZ; t++) {
    const dR = rd(h) || 1, ux = (RIM.x - h.x) / dR, uy = (RIM.y - h.y) / dR
    let mx = ux, my = uy
    const inp = { mx, my }
    if (how === 'wide') { mx = ux - uy * side * 1.0; my = uy + ux * side * 1.0; const l = Math.hypot(mx, my); inp.mx = mx / l; inp.my = my / l }
    if (how === 'zig') { const k = Math.floor(t / 14) % 2 ? 1 : -1; mx = ux - uy * side * k * 0.9; my = uy + ux * side * k * 0.9; const l = Math.hypot(mx, my); inp.mx = mx / l; inp.my = my / l }
    if (how === 'round') { mx = ux - uy * side * 0.45; my = uy + ux * side * 0.45; const l = Math.hypot(mx, my); inp.mx = mx / l; inp.my = my / l }
    if (how === 'cross' && t === 2) { inp.dx = -uy * side; inp.dy = ux * side; inp.mx = ux * 0.5 - uy * side * 0.8; inp.my = uy * 0.5 + ux * side * 0.8 }
    if (how === 'cross' && t > 2 && t < 10) { inp.mx = ux * 0.5 - uy * side * 0.8; inp.my = uy * 0.5 + ux * side * 0.8 }
    step(s, [inp, cpuInput(s, 1, lvl)])
    if (s.ball.st !== 'held' || s.ball.holder !== 0) return false
    if (rd(h) < 7) return d.act === 'frozen' || d.act === 'down' || rd(d) > rd(h) + 1.5
  }
  return false
}
console.log(`lib: ${path.relative(process.cwd(), lib) || '.'}   (two 80 guards, ${N} tries each: clean by his man)`)
for (const [nm, how, over] of [['straight at the rim', 'straight', {}], ['at the rim, round him', 'round', {}], ['wide round him (45 deg off)', 'wide', {}], ['zigzag at him (no move)', 'zig', {}], ['crossover, then go', 'cross', {}], ['straight, Speed 11 + Handles 11 v an 80', 'straight', { speed: 11, handles: 11 }]]) {
  const row = ['rookie', 'pro', 'allstar'].map(l => { let k = 0; for (let g = 0; g < N; g++) if (trial(l, how, g, over)) k++; return `${l} ${Math.round(100 * k / N)}%` })
  console.log(`  ${nm.padEnd(42)} ${row.join('   ')}`)
}
