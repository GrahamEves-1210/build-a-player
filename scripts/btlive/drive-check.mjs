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

// ── From the check, in a real game, as a kid plays it (the owner, 11-26: "you can just kinda run by the CPU in practice
// every time"). The rows above start from a set spot against an 80 shooter; practice is played from the check-up with
// real stars, nearly all of them great shooters, and the CPU's late read on a shooter's first step let a plain curl get
// by most of the time. Each try is a real possession of a real game (the CPU plays both sides in between): the stick
// held at the rim, held on a diagonal and turned in once he's level, curled round him, taken to the wing then down the
// baseline, or gone straight off the check. Clean by: as above.
const RIMX = RIM.x, RIMY = RIM.y
const nrm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l] }
function stickFor(how, t, h, d, side) {
  const [ux, uy] = nrm(RIMX - h.x, RIMY - h.y)
  let mx = ux, my = uy
  if (how === 'now') { mx = 0; my = -1 }
  else if (how === 'diag') [mx, my] = nrm(side, -1)
  else if (how === 'curl') { const a = Math.max(0, 80 - t / HZ * 66) * Math.PI / 180;[mx, my] = [ux * Math.cos(a) - uy * side * Math.sin(a), uy * Math.cos(a) + ux * side * Math.sin(a)] }
  else if (how === 'baseline') { if (h.y > RIMY + 5 && t < 4 * HZ) [mx, my] = Math.abs(h.x - RIMX) < 13 ? nrm(side, -0.35) : [side * 0.1, -1] }
  else if (how === 'seek') { const lat = (d.x - h.x) * -uy + (d.y - h.y) * ux, sg = lat >= 0 ? -1 : 1;[mx, my] = nrm(d.x - uy * sg * 3.6 + ux * 1.5 - h.x, d.y + ux * sg * 3.6 + uy * 1.5 - h.y) }
  // (level with him or past him, or near the rim: a kid turns it in)
  if (rd(h) < rd(d) + (how === 'diag' ? 1 : 0) || h.y < RIMY + 6) [mx, my] = [ux, uy]
  return { mx, my }
}
function gameTries(lvl, how, hb, db, hpos, dpos, want) {
  let k = 0, n = 0, g = 0
  while (n < want && g < 200) {
    const s = createGame({ teams: [[{ id: 'h', pos: hpos, build: hb }], [{ id: 'd', pos: dpos, build: db }]], seed: `gt-${how}-${lvl}-${g++}` })
    while (n < want) {
      let c = 0
      while (c++ < 20000 && !(s.phase === 'over' || (s.phase === 'check' && s.poss === 0 && s.mustClear == null && s.ball.holder === 0))) step(s, [cpuInput(s, 0, lvl), cpuInput(s, 1, lvl)])
      if (s.phase !== 'check') break
      while (s.phase !== 'live') step(s, [{}, cpuInput(s, 1, lvl)])
      const h = s.players[0], d = s.players[1], side = n % 2 ? 1 : -1, wait = how === 'now' ? 0 : (n % 4) * 4
      let ok = 0
      for (let t = 0; t < 5 * HZ; t++) {
        step(s, [t < wait ? {} : stickFor(how, t - wait, h, d, side), cpuInput(s, 1, lvl)])
        if (s.ball.st !== 'held' || s.ball.holder !== 0) break
        if (rd(h) < 7) { ok = d.act === 'frozen' || d.act === 'down' || rd(d) > rd(h) + 1.5 ? 1 : 0; break }
      }
      k += ok; n++
    }
  }
  return Math.round(100 * k / Math.max(1, n))
}
const NG = Math.max(40, Math.round(N / 2))
const star = flatBuild('guard', grade, { jumpShot: 1 + (95 - 57) / 44 * 9 })
const plain = flatBuild('guard', grade)
const fast = flatBuild('guard', grade, { speed: 1 + (95 - 57) / 44 * 9, handles: 1 + (92 - 57) / 44 * 9, jumpShot: 1 + (90 - 57) / 44 * 9 })
const slowBig = flatBuild('big', grade, { speed: 1 + (62 - 57) / 44 * 9 })
console.log(`\nfrom the check, in a real game (${NG} possessions each; targets on plain drives, equal men: rookie <=35, pro <=15, all-star <=8)`)
for (const [nm, hb, db, hp, dp] of [['80 v 80, he shoots 95', star, star, 'guard', 'guard'], ['80 v 80', plain, plain, 'guard', 'guard'], ['quick guard v slow big', fast, slowBig, 'guard', 'big']]) {
  console.log(`  ${nm}`)
  for (const how of ['now', 'diag', 'curl', 'baseline', 'seek']) {
    const row = ['rookie', 'pro', 'allstar'].map(l => `${l} ${gameTries(l, how, hb, db, hp, dp, NG)}%`)
    console.log(`    ${how.padEnd(10)} ${row.join('   ')}`)
  }
}
