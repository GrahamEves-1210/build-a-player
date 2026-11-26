// BLACKTOP LIVE: the dribble moves measured on a made-up kid's thumb (the owner, 11-26: "spin moves trigger too often";
// steering must never make a move, and the move he means has to be the one that comes out). Two runs:
//   steering  a minute after minute of a kid just playing with the ball: holding a way with a wobble, turning (most turns
//             small, some quick, a few all the way round, mostly straight across the middle; usually a beat on the new
//             way before the next one), easing off, stopping and going again (and going a while), lifting the thumb.
//             Every move that comes out is an accident: moves a minute (spins too)
//   meant     the moves the way the owner says a kid means them: a quick forward flick and let go (hesitation), a quick
//             back flick (step-back), a clean flick to the side (crossover), the same going forward easy (between the
//             legs) or at speed (behind the back), to the ball hand's side (in-and-out), the stick rolled round (spin).
//             Right when exactly that one move comes out
// Pointer samples 8-16 ms apart with a little shake. The stick goes through gesture.js and the game's own reading of it
// (referee.moveOf, sim.js moveInput: the chain and, before, the second flick that made a spin).
// Run: node scripts/btlive/gesture-bot.mjs [--lib=src/lib/btlive] [--min=30] [--n=1400] [--seed=3]
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const lib = path.resolve(arg('lib') || 'src/lib/btlive')
const L = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const { createGesture, moveInput, moveQueued, HZ } = L
let seed = Number(arg('seed')) || 3
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd())
const logn = (med, sd) => med * Math.exp(gauss() * sd)
const D2R = Math.PI / 180, TICK = 1000 / HZ
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const pol = (a, r) => [Math.cos(a) * r, Math.sin(a) * r]
const HOW = {}, ROLLS = []
const FWD = -90 * D2R                      // the basket is up the stick (the man at the top of the key)

// the man: at the top of the key, the ball in his right hand, going (vx, vy)
function man(vx = 0, vy = 0) {
  return { x: 28, y: 33, vx, vy, fx: 0, fy: -1, hand: 1, R: { topBall: 9.5, hnd: 0.8, top: 10 }, burst: 0, bn: 0, mv: 0, moveCd: 0, mqT: -1, chn: 0, sta: 1, bk: 1, fkx: 0, fky: -1, bdx: 0, bdy: 0, bs: 0, dr: 1 }
}
// a thumb: a path (t -> [x, y], or null: the thumb comes off) run through the reader and the game. vel(t, x, y): how
// he's going then (null: as he was). Returns the moves made, with when
function play(path, ms, p, vel = null) {
  const g = createGesture(); g.aim?.(0, -1)
  const out = []
  let tick = 0, nextTick = 0, lifted = false
  const move = (e, t) => {
    if (!e) return
    const dir = { x: e.dir[0], y: e.dir[1] }, sp = e.kind === 'roll' ? Math.sign(e.turn) || 1 : 0
    const k = moveInput(p, dir, tick, sp)
    HOW[e.how || e.kind] = (HOW[e.how || e.kind] || 0) + 1
    if (e.kind === 'roll') ROLLS.push([Math.round(e.turn / D2R), Math.round(e.ms), p.ctx])
    if (k) out.push({ kind: k, at: t })
  }
  for (let t = 0; t < ms; t += 8 + 8 * rnd()) {
    // the game's ticks in between: a move's clock, and the move that was waiting
    while (nextTick <= t) {
      tick++; nextTick += TICK
      if (p.moveCd > 0) p.moveCd--
      if (p.burst > 0 && --p.burst === 0) { p.mv = 0; p.bs = 0 }
      const q = moveQueued(p, tick); if (q) out.push({ kind: q, at: nextTick })
    }
    const at = path(t)
    if (!at) { if (!lifted) { move(g.release?.(t), t); lifted = true } continue }
    if (lifted) { g.reset(); lifted = false }
    let [x, y] = at
    x += gauss() * 0.006; y += gauss() * 0.006
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m }
    if (vel) { const v = vel(t, x, y); if (v) { p.vx = v[0]; p.vy = v[1] } }
    move(g.feed(t, x, y), t)
  }
  return out
}

// ── steering: a kid just playing, minute after minute ──────────────────────────────────────────────
function steerPath(ms) {
  const segs = []        // { t0, t1, f(t) -> [x, y] | null }
  let t = 0, a = FWD + gauss() * 0.6, r = 0.9
  const at = () => pol(a, r)
  let settle = 0                                        // (a beat on the way he's turned to: a turn is a choice, then he goes)
  while (t < ms) {
    if (settle > 0) {
      const a0 = a, r0 = r, d = settle
      segs.push({ name: 'hold', t0: t, t1: t + d, f: () => pol(a0, r0) })
      t += d; settle = 0; continue
    }
    const u = rnd()
    if (u < 0.45) {
      // hold a way, a wobble on it
      const d = 300 + 1500 * rnd(), a0 = a, r0 = r, w1 = gauss() * 8 * D2R, w2 = gauss() * 0.08, ph = rnd() * 6
      segs.push({ name: 'hold', t0: t, t1: t + d, f: tt => { const k = (tt - t0c) / d; return pol(a0 + w1 * Math.sin(k * 3 + ph), Math.min(1, r0 + w2 * Math.sin(k * 2))) } })
      const t0c = t; t += d; a = a0 + w1 * Math.sin(3 + ph)
    } else if (u < 0.8) {
      // a turn: most small, some all the way round; quick or easy
      const da = (20 + 160 * Math.pow(rnd(), 1.5)) * D2R * (rnd() < 0.5 ? -1 : 1)
      const d = Math.max(45, logn(170, 0.45) * (0.6 + 0.8 * Math.abs(da) / Math.PI))
      const a0 = a, a1 = a + da, r0 = r, t0c = t
      const across = Math.abs(da) > 140 * D2R && rnd() < 0.7
      const p0 = pol(a0, r0), p1 = pol(a1, r0)
      segs.push({ name: 'turn', tag: `${Math.round(da / D2R)}/${Math.round(d)}${across ? 'x' : ''}`, t0: t, t1: t + d, f: tt => { const k = ease((tt - t0c) / d); return across ? [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k] : pol(a0 + da * k, r0 * (1 - 0.12 * Math.sin(Math.PI * k))) } })
      t += d; a = a1
      if (rnd() < 0.75) settle = 90 + 200 * rnd()
    } else if (u < 0.92) {
      // ease off to a stop, rest (the thumb on it, or off it now and then), and go again some way
      const dOff = 120 + 180 * rnd(), rest = 100 + 500 * rnd(), lift = rnd() < 0.3, dOn = Math.max(60, logn(130, 0.4))
      const a0 = a, a1 = a + gauss() * 1.4, r0 = r, t0c = t
      segs.push({ name: 'off', t0: t, t1: t + dOff, f: tt => pol(a0, r0 * (1 - ease((tt - t0c) / dOff))) })
      t += dOff
      const t1c = t, dx = gauss() * 0.03, dy = gauss() * 0.03
      segs.push({ name: 'rest', t0: t, t1: t + rest, f: tt => (lift && tt - t1c > 40 && tt - t1c < rest - 60 ? null : [dx, dy]) })
      t += rest
      const t2c = t, r1 = 0.75 + 0.25 * rnd()
      segs.push({ name: 'on', t0: t, t1: t + dOn, f: tt => pol(a1, r1 * ease((tt - t2c) / dOn)) })
      t += dOn; a = a1; r = r1; settle = 200 + 300 * rnd()
    } else {
      // easing off a little and back on (slowing down, speeding up)
      const d = 150 + 200 * rnd(), r0 = r, a0 = a, t0c = t, low = 0.4 + 0.2 * rnd()
      segs.push({ name: 'jab', t0: t, t1: t + d, f: tt => pol(a0, r0 - (r0 - low) * Math.sin(Math.PI * (tt - t0c) / d)) })
      t += d
    }
  }
  let i = 0
  const f = tt => { while (i < segs.length - 1 && tt >= segs[i].t1) i++; return segs[i].f(Math.min(tt, segs[i].t1)) }
  f.segAt = tt => { const j = segs.findIndex(g => tt >= g.t0 && tt < g.t1 + 60); return j < 0 ? '?' : segs[j].name + (segs[j].tag ? `(${segs[j].tag})` : '') + (j > 0 ? '<' + segs[j - 1].name + (segs[j - 1].tag ? `(${segs[j - 1].tag})` : '') : '') }
  return f
}
const MIN = Number(arg('min')) || 30
const SEG = {}
const steer = { moves: 0, spins: 0, by: {} }
for (let k = 0; k < MIN; k++) {
  const f = steerPath(60000), p = man(); p.ctx = 'steer'
  const o = play(f, 60000, p, (t, x, y) => [x * 9.5, y * 9.5])
  for (const e of o) { const sg = (e.kind === 'spin' ? 'SPIN ' : '') + f.segAt(e.at); SEG[sg] = (SEG[sg] || 0) + 1; steer.moves++; if (e.kind === 'spin') steer.spins++; steer.by[e.kind] = (steer.by[e.kind] || 0) + 1 }
}

// ── meant: the moves as a kid means them ───────────────────────────────────────────────────────────
const LEFT = 180 * D2R, RIGHT = 0, BACK = 90 * D2R          // (the ball in his right hand: left is the off hand)
// a tap: from where the stick is (base) out to a way and back to base (or the middle, or the thumb off it)
function tap(base, a, lead) {
  const dOut = Math.max(30, logn(55, 0.35)), hold = 60 * rnd(), dBack = 50 + 90 * rnd(), r = 0.75 + 0.25 * rnd(), lift = rnd() < 0.3, toMid = rnd() < 0.3
  const P1 = pol(a, r), B = toMid ? [0, 0] : base
  return tt => {
    const t = tt - lead
    if (t < 0) return base
    if (t < dOut) { const k = ease(t / dOut); return [base[0] + (P1[0] - base[0]) * k, base[1] + (P1[1] - base[1]) * k] }
    if (t < dOut + hold) return P1
    if (lift) return null
    const k = ease((t - dOut - hold) / dBack); return [P1[0] + (B[0] - P1[0]) * k, P1[1] + (B[1] - P1[1]) * k]
  }
}
// a snap: from holding a way, thrown to a new way and held there
function snap(base, a, lead) {
  const d = Math.max(30, logn(60, 0.3)), r = 0.8 + 0.2 * rnd(), P1 = pol(a, r)
  return tt => { const t = tt - lead; if (t < 0) return base; const k = ease(t / d); return [base[0] + (P1[0] - base[0]) * k, base[1] + (P1[1] - base[1]) * k] }
}
// a roll: round the rim from where it is (or from the back), this far, this quick, and held where it ends
function rollG(a0, sweep, lead, from = null) {
  const d = 180 + 150 * rnd(), r = 0.8 + 0.2 * rnd()
  return tt => { const t = tt - lead; if (t < 0) return from ?? pol(a0, r); return pol(a0 + sweep * ease(t / d), r) }
}
const noise = s => gauss() * s * D2R
const CASES = {
  hesi: () => { const base = rnd() < 0.6 ? [0, 0] : pol(FWD, 0.3); return { v: [0, 0], f: tap(base, FWD + noise(12), 300) } },
  back: () => {
    if (rnd() < 0.5) return { v: [0, 0], f: tap([0, 0], BACK + noise(12), 300) }
    const base = pol(FWD, 0.92); return { v: [0, -8.5], f: rnd() < 0.5 ? tap(base, BACK + noise(12), 300) : snap(base, BACK + noise(12), 300) }
  },
  cross: () => {
    if (rnd() < 0.5) return { v: [0, 0], f: tap([0, 0], LEFT + noise(15), 300) }
    const base = pol(RIGHT, 0.45); return { v: [3.2, 0], f: rnd() < 0.5 ? tap(base, LEFT + noise(15), 300) : snap(base, LEFT + noise(15), 300) }
  },
  btl: () => { const base = pol(FWD, 0.45); return { v: [0, -3.8], f: rnd() < 0.5 ? tap(base, LEFT + noise(15), 300) : snap(base, LEFT + noise(15), 300) } },
  btb: () => { const base = pol(FWD, 0.95); return { v: [0, -8.6], f: rnd() < 0.5 ? tap(base, LEFT + noise(15), 300) : snap(base, LEFT + noise(15), 300) } },
  inout: () => ({ v: [0, 0], f: tap([0, 0], RIGHT + noise(15), 300) }),
  spin: () => {
    const sg = rnd() < 0.5 ? 1 : -1
    // (rolled round most of a circle; or back and around: from the back round to the front)
    if (rnd() < 0.3) { const a0 = BACK + noise(25); return { v: [0, 0], f: rollG(a0, sg * (170 + 70 * rnd()) * D2R, 300, [0, 0]) } }
    const drive = rnd() < 0.5, a0 = drive ? FWD + noise(15) : (rnd() * 360) * D2R
    return { v: drive ? [0, -8] : [0, 0], f: rollG(a0, sg * (220 + 110 * rnd()) * D2R, 300, drive ? pol(a0, 0.9) : null) }
  },
}
const N = Number(arg('n')) || 1400, KINDS = Object.keys(CASES)
const meant = Object.fromEntries(KINDS.map(k => [k, { n: 0, ok: 0, none: 0, extra: 0, wrong: {} }]))
for (let i = 0; i < N; i++) {
  const k = KINDS[i % KINDS.length], c = CASES[k](), p = man(c.v[0], c.v[1])
  const o = play(c.f, 1100, p).filter(e => e.at >= 280)
  const M = meant[k]; M.n++
  if (!o.length) M.none++
  else if (o.length > 1) M.extra++
  else if (o[0].kind === k) M.ok++
  else M.wrong[o[0].kind] = (M.wrong[o[0].kind] || 0) + 1
}
const tot = KINDS.reduce((s, k) => s + meant[k].ok, 0) / N
console.log(`lib: ${path.relative(process.cwd(), lib) || '.'}`)
console.log(`steering, ${MIN} min: ${(steer.moves / MIN).toFixed(2)} accidental moves a minute (spins ${(steer.spins / MIN).toFixed(2)} a minute)  ${Object.entries(steer.by).map(([k, v]) => `${k} ${(v / MIN).toFixed(2)}`).join('  ')}`)
console.log(`meant, ${N} tries: ${(100 * tot).toFixed(1)}% the right move`)
for (const k of KINDS) { const M = meant[k]; console.log(`  ${k.padEnd(6)} ${(100 * M.ok / M.n).toFixed(0).padStart(3)}%   none ${M.none}  two+ ${M.extra}  wrong ${Object.entries(M.wrong).map(([a, b]) => `${a} ${b}`).join(', ') || '-'}`) }
if (process.argv.includes('--why')) console.log('accidents by what the thumb was doing:', SEG, ' reader:', HOW); console.log('steering rolls', ROLLS.filter(r => r[2] === 'steer').slice(0, 30).map(r => r[0] + '/' + r[1]).join(' ')); console.log('meant rolls', ROLLS.filter(r => r[2] !== 'steer').slice(0, 30).map(r => r[0] + '/' + r[1]).join(' '))
export const result = { perMin: steer.moves / MIN, spinsPerMin: steer.spins / MIN, right: tot }
