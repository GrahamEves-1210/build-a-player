// BLACKTOP LIVE: the post game and the pump fake, by the numbers (the owner, 11-26). On the real step:
//   post-ups by size: a man on the block, his man (a CPU, pro) on him; a kid backs him down for 2 s, then the hook
//   (an average kid's timing), or the drop step (the other way round, a coin flip which). Ground gained, the hook's
//   make, how often the drop step gets by him and the layup after it goes in
//   pump fakes: a man faked at from 18 ft, by the CPU's level and the defender's IQ; the shot right after a bite
//   CPU games: how often the CPUs post up, hook, fade and fake
// Run: node scripts/btlive/post-check.mjs [--n=300]
import { createGame, step, cpuInput, flatBuild, gauss, meterQuality, sdFor, T, HZ, COURT, CPU_STATS, LEVELS } from '../../src/lib/btlive/index.js'
const N = Number(process.argv.find(a => a.startsWith('--n='))?.slice(4)) || 300
const RIM = COURT.rim
const idle = s => s.players.map(() => ({ mx: 0, my: 0 }))
let rs = 9; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296 }
const live = s => { for (let i = 0; i < 400 && s.phase !== 'live'; i++) step(s, idle(s)) }
const pct = v => `${(100 * v).toFixed(0)}%`.padStart(4)
// one post-up. off/def: [pos, over]. how: 'hook' | 'drop'
function postUp(off, def, how, g) {
  const s = createGame({ teams: [[{ id: 'o', pos: off[0], build: flatBuild(off[0], 7, off[1]) }], [{ id: 'd', pos: def[0], build: flatBuild(def[0], 7, def[1]) }]], seed: `post-${g}` })
  live(s)
  const P = s.players, o = P[0], d = P[1]
  s.poss = 0; s.ball.holder = 0; s.ball.st = 'held'; s.mustClear = null; s.clock = 600
  o.x = 21.5; o.y = 17.5; o.vx = o.vy = 0; d.x = 22.6; d.y = 14.6; d.vx = d.vy = 0; d.act = 'free'
  const r0 = Math.hypot(o.x - RIM.x, o.y - RIM.y)
  let posted = false, res = null, rel = null, by = null
  for (let t = 0; t < 8 * HZ && !res; t++) {
    const inp = [{ mx: 0, my: 0 }, cpuInput(s, 1, 'pro')]
    const dR = Math.hypot(RIM.x - o.x, RIM.y - o.y), ux = (RIM.x - o.x) / dR, uy = (RIM.y - o.y) / dR
    if (o.post) posted = true
    if (o.act === 'gather') {
      if (!rel) rel = Math.max(2, Math.round((o.shot.spec.ideal + gauss(rnd(), rnd()) * sdFor(T.kidSd, o.shot.kind)) / (1000 / HZ)))
      if (o.actT >= rel) { inp[0].q = meterQuality(o.shot.spec, rel * 1000 / HZ) } else inp[0].shoot = true
    } else if (s.ball.holder === 0 && s.ball.st === 'held') {
      if (o.post && t < 2 * HZ && dR > 6) { inp[0].mx = ux; inp[0].my = uy }
      else if (o.post && how === 'drop' && by == null) { const sd = rnd() < 0.5 ? 1 : -1; inp[0].dx = -uy * sd; inp[0].dy = ux * sd }
      else if (by != null && o.burst > 0) { inp[0].mx = ux; inp[0].my = uy }
      else if (!o.post && !posted && t < HZ) { inp[0].mx = ux * 0.5; inp[0].my = uy * 0.5 }
      else inp[0].shoot = true
    }
    step(s, inp)
    for (const e of s.events) {
      if (e.e === 'move' && e.post) by = e.freeze
      if (e.e === 'make' || e.e === 'miss' || e.e === 'block') res = { e: e.e, kind: e.kind }
    }
  }
  return { posted, gained: r0 - Math.hypot(o.x - RIM.x, o.y - RIM.y), res, by }
}
const ROWS = [
  ['a big (Size 10) on a guard (Size 3)', ['big', { size: 10 }], ['guard', { size: 3 }]],
  ['a big on a big, both Size 8', ['big', { size: 8 }], ['big', { size: 8 }]],
  ['a big (Size 5) on a big (Size 10)', ['big', { size: 5 }], ['big', { size: 10, interiorDefense: 9 }]],
  ['a strong wing (Size 9) on a small guard (Size 4)', ['guard', { size: 9 }], ['guard', { size: 4 }]],
  ['a big A (Size 9) on a big A (Size 9)', ['big', { size: 9 }], ['big', { size: 9 }]],
  ['a big A+ (Size 10) on a big A (Size 9)', ['big', { size: 10 }], ['big', { size: 9 }]],
  ['a big S (Size 11) on a big A (Size 9)', ['big', { size: 11 }], ['big', { size: 9 }]],
]
console.log('POST-UPS (a kid backs his man down 2 s, then the shot; an average kid\'s timing on it; the man on him a pro CPU)')
console.log('who'.padEnd(46) + 'in the post  ground  hook made   drop step: got by  then made')
for (const [w, off, def] of ROWS) {
  let posted = 0, gain = 0, hk = 0, hm = 0, dn = 0, db = 0, dm = 0
  for (let g = 0; g < N; g++) {
    const a = postUp(off, def, 'hook', g); if (a.posted) posted++; gain += a.gained
    if (a.res && a.res.kind === 'hook') { hk++; if (a.res.e === 'make') hm++ }
    const b = postUp(off, def, 'drop', g + 9999); if (b.by != null) { dn++; if (b.by) db++; if (b.res?.e === 'make') dm++ }
  }
  console.log(w.padEnd(46) + `${pct(posted / N)}        ${(gain / N).toFixed(1)} ft   ${pct(hm / Math.max(1, hk))} of ${hk}    ${pct(db / Math.max(1, dn))}              ${pct(dm / Math.max(1, dn))}`)
}

// ── pump fakes ──
function fake(lvl, defOver, shooter, g, bite = null) {
  const s = createGame({ teams: [[{ id: 'o', pos: 'guard', build: flatBuild('guard', 7, shooter) }], [{ id: 'd', pos: 'guard', build: flatBuild('guard', 7, defOver) }]], seed: `fk-${g}` })
  live(s)
  const P = s.players, o = P[0], d = P[1]
  s.poss = 0; s.ball.holder = 0; s.ball.st = 'held'; s.mustClear = null; s.clock = 600
  o.x = 28; o.y = 25.5; o.vx = o.vy = 0; o.dr = 1; d.x = 28; d.y = 21.5; d.vx = d.vy = 0; d.act = 'free'
  let bit = false
  for (let t = 0; t < 30; t++) {
    const inp = [{ mx: 0, my: 0, shoot: t < 3 }, cpuInput(s, 1, lvl)]
    step(s, inp)
    for (const e of s.events) if (e.e === 'bite') bit = true
  }
  return bit
}
console.log('\nPUMP FAKES: how often a CPU defender goes up for one (a guard faked at from 18 ft)')
console.log('defender'.padEnd(34) + Object.keys(LEVELS).map(l => l.padStart(9)).join(''))
for (const [w, dv, sh] of [['average IQ, average shooter', {}, {}], ['IQ 3 (bites more)', { basketballIQ: 3 }, {}], ['IQ 10 (disciplined)', { basketballIQ: 10 }, {}], ['average, on a non-shooter (JS 2)', {}, { jumpShot: 2 }], ['average, on a sniper (JS 11)', {}, { jumpShot: 11 }]]) {
  console.log(w.padEnd(34) + Object.keys(LEVELS).map(l => { let b = 0; for (let g = 0; g < N; g++) if (fake(l, dv, sh, g)) b++; return pct(b / N).padStart(9) }).join(''))
}
// the green window after a bite vs a plain one, the same spot (shotWindow)
{
  const s = createGame({ teams: [[{ id: 'o', pos: 'guard', build: flatBuild('guard', 7) }], [{ id: 'd', pos: 'guard', build: flatBuild('guard', 7) }]], seed: 'win' })
  live(s)
  const P = s.players, o = P[0], d = P[1]
  s.poss = 0; s.ball.holder = 0; s.ball.st = 'held'; s.mustClear = null
  o.x = 28; o.y = 25.5; d.x = 28; d.y = 21.5
  const w = open => { const q = JSON.parse(JSON.stringify(s)); const a = q.players[0]; if (open) { a.openT = q.tick + 30; q.players[1].act = 'jump'; q.players[1].bit = 1 } const inp = [{ shoot: true }, { mx: 0, my: 0 }]; step(q, inp); return a.shot?.spec?.win }
  console.log(`  an 18-footer, his man 4 ft off: green +/- ${w(false).toFixed(0)} ms; right after his man bit: +/- ${w(true).toFixed(0)} ms`)
}

// ── CPU games ──
{
  const ev = { post: 0, hook: 0, fade: 0, drop: 0, fake: 0, bite: 0, games: 0, poss: 0, pick: 0 }
  CPU_STATS.fakes = 0; CPU_STATS.bites = 0
  for (let g = 0; g < 60; g++) {
    const mk = (id, pos) => ({ id, name: id, pos, build: flatBuild(pos, 7.5) })
    const s = createGame({ teams: g % 2 ? [[mk('a', 'big')], [mk('b', 'big')]] : [[mk('a', 'guard'), mk('c', 'big')], [mk('b', 'guard'), mk('d', 'big')]], seed: `cpu-post-${g}` })
    while (s.phase !== 'over' && s.tick < 30 * 60 * HZ) {
      step(s, s.players.map((_, i) => cpuInput(s, i, 'pro')))
      for (const e of s.events) {
        if (e.e === 'post') ev.post++; if (e.e === 'release' && (e.kind === 'hook' || e.kind === 'fade')) ev[e.kind]++
        if (e.e === 'move' && e.post) ev.drop++; if (e.e === 'fake') { ev.fake++; if (e.pick) ev.pick++ } if (e.e === 'bite') ev.bite++; if (e.e === 'poss') ev.poss++
      }
    }
    ev.games++
  }
  const G = ev.games
  console.log(`\nCPU games (pro; big v big 1v1 and 2v2), a game: ${(ev.poss / G).toFixed(1)} possessions, ${(ev.post / G).toFixed(1)} post-ups, ${(ev.hook / G).toFixed(1)} hooks, ${(ev.fade / G).toFixed(1)} fadeaways, ${(ev.drop / G).toFixed(1)} drop steps/spins, ${(ev.fake / G).toFixed(1)} pump fakes (${ev.pick} picked up), ${(ev.bite / G).toFixed(1)} bites; the CPU defenders went up for ${pct(CPU_STATS.bites / Math.max(1, CPU_STATS.fakes))} of the fakes they saw`)
}
