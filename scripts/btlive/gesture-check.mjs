// BLACKTOP LIVE: the one-stick dribble moves (lib/btlive/gesture.js), measured on made-up thumbs. Normal play (holding,
// curving drives, ordinary turns, stops, the thumb coming off and landing again) must make no move; the deliberate
// gestures (a snap, a reversal through the middle, a pump, a half circle) must make the right one. And the keyboard's
// double tap. Run: node scripts/btlive/gesture-check.mjs [--min=30] [--seed=7]   (no bundle needed)
import { createGesture, createTaps, GEST } from '../../src/lib/btlive/gesture.js'

const args = process.argv.slice(2)
const MIN = Number(args.find(a => a.startsWith('--min='))?.slice(6)) || 30
let seed = Number(args.find(a => a.startsWith('--seed='))?.slice(7)) || 7
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const U = (a, b) => a + (b - a) * rnd()
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd())
let fails = 0
const ok = (c, w) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${w}`); if (!c) fails++ }
const D2R = Math.PI / 180

// a thumb: a path (t -> [x, y]) sampled like pointer events (8-20 ms apart, every tick too), a little shake on it
function run(path, ms, g = createGesture(), out = []) {
  let t = 0
  const T0 = path.t0 ?? 0
  while (t < ms) {
    let [x, y] = path(t)
    x += gauss() * 0.006; y += gauss() * 0.006
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m }
    const e = g.feed(T0 + t, x, y)
    if (e) out.push({ ...e, at: t })
    t += U(8, 20)
  }
  return out
}
const pol = (th, r) => [Math.cos(th) * r, Math.sin(th) * r]
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

// ── normal play: a stream of ordinary thumb work, as pieces one after another ─────────────────────
// hold (drifting a little), curve (a drive bending round: up to 300 deg/s), turn (a cut to a new way: 30-180 deg, as a
// person turns a stick while steering: 160-600 ms, a few as quick as 140), stop (ease to the middle, wait, go again),
// lift (thumb off, back on). Returns false moves
function normal(minutes) {
  const pieces = []
  let th = U(0, 2 * Math.PI), r = 0.9, t = 0
  const end = minutes * 60000
  while (t < end) {
    const k = rnd()
    const th0 = th, r0 = r
    if (k < 0.3) { const d = U(300, 1500), w = U(-40, 40) * D2R; pieces.push({ t, d, f: u => pol(th0 + w * u * d / 1000, r0 + Math.sin(u * 6) * 0.03) }); th = th0 + w * d / 1000 }
    else if (k < 0.5) { const d = U(300, 1200), w = U(60, 300) * D2R * (rnd() < 0.5 ? -1 : 1); pieces.push({ t, d, f: u => pol(th0 + w * u * d / 1000, r0) }); th = th0 + w * d / 1000 }
    else if (k < 0.78) {
      const turn = U(30, 180) * D2R * (rnd() < 0.5 ? -1 : 1), d = Math.max(140, 160 + Math.abs(gauss()) * 180), r1 = U(0.7, 1), arc = rnd() < 0.6
      const a = pol(th0, r0), b = pol(th0 + turn, r1)
      pieces.push({ t, d, f: u => { const e = ease(u); return arc ? pol(th0 + turn * e, r0 + (r1 - r0) * e) : [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e] } })
      th = th0 + turn; r = r1
    } else if (k < 0.93) {
      const d1 = U(150, 400), hold = U(150, 800), d2 = U(90, 260), th1 = th0 + U(-180, 180) * D2R, r1 = U(0.7, 1)
      pieces.push({ t, d: d1 + hold + d2, f: u => { const s = u * (d1 + hold + d2); if (s < d1) return pol(th0, r0 * (1 - ease(s / d1))); if (s < d1 + hold) return [0, 0]; return pol(th1, r1 * ease((s - d1 - hold) / d2)) } })
      th = th1; r = r1
    } else { const d = U(150, 600), th1 = U(0, 2 * Math.PI), r1 = U(0.7, 1); pieces.push({ t, d, lift: true, f: u => (u < 0.4 ? null : pol(th1, r1 * ease((u - 0.4) / 0.3))) }); th = th1; r = r1 }
    t += pieces[pieces.length - 1].d
  }
  // play it: one gesture reader, the thumb lifting where a piece says so
  const g = createGesture(), out = []
  let tt = 0, pi = 0, lifted = false
  while (tt < end && pi < pieces.length) {
    const P = pieces[pi]
    if (tt >= P.t + P.d) { pi++; continue }
    const u = (tt - P.t) / P.d
    const v = P.f(u)
    if (v == null) { if (!lifted) { g.reset(); lifted = true } }
    else {
      lifted = false
      let [x, y] = v; x += gauss() * 0.006; y += gauss() * 0.006
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m }
      const e = g.feed(tt, x, y); if (e) out.push({ ...e, at: tt })
    }
    tt += U(8, 20)
  }
  return out
}

// ── deliberate gestures: held first (as a player does), then the gesture, then held ─────────────
function gestureTrial(kind) {
  const th0 = U(0, 2 * Math.PI), r0 = U(0.7, 1), r1 = U(0.8, 1), hold = U(150, 500)
  let f, d, want
  if (kind === 'snap') {
    const turn = U(80, 150) * D2R * (rnd() < 0.5 ? -1 : 1), arc = rnd() < 0.5; d = U(45, 110)
    const a = pol(th0, r0), b = pol(th0 + turn, r1)
    f = u => { const e = ease(u); return arc ? pol(th0 + turn * e, r0 + (r1 - r0) * e) : [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e] }
    want = { kind: 'snap', th: th0 + turn }
  } else if (kind === 'diagonal') {
    // driving one way, a quick flick an eighth of a turn over (at the basket, to the crossover's diagonal)
    const turn = U(42, 60) * D2R * (rnd() < 0.5 ? -1 : 1); d = U(25, 55)
    const a = pol(th0, r0), b = pol(th0 + turn, r1)
    f = u => { const e = ease(u); return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e] }
    want = { kind: 'snap', th: th0 + turn }
  } else if (kind === 'reverse') {
    const th1 = th0 + Math.PI + U(-25, 25) * D2R; d = U(60, 120)
    const a = pol(th0, r0), b = pol(th1, r1)
    f = u => { const e = ease(u); return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e] }
    want = { kind: 'snap', th: th1 }
  } else if (kind === 'pump') {
    const d1 = U(60, 120), p = U(0, 80), d2 = U(60, 120), inn = U(0, 0.3), th1 = th0 + U(-20, 20) * D2R; d = d1 + p + d2
    f = u => { const s = u * d; if (s < d1) return pol(th0, r0 + (inn - r0) * ease(s / d1)); if (s < d1 + p) return pol(th0, inn); return pol(th1, inn + (r1 - inn) * ease((s - d1 - p) / d2)) }
    want = { kind: 'pump', th: th1 }
  } else {
    const turn = U(185, 240) * D2R * (rnd() < 0.5 ? -1 : 1); d = U(180, 340)
    f = u => pol(th0 + turn * ease(u), r0 + (r1 - r0) * u)
    want = { kind: 'spin', th: th0 + turn }
  }
  const path = t => (t < hold ? pol(th0, r0) : t < hold + d ? f((t - hold) / d) : f(1))
  const out = run(path, hold + d + 300)
  const hit = out.length === 1 && out[0].kind === want.kind && Math.acos(Math.min(1, out[0].dir[0] * Math.cos(want.th) + out[0].dir[1] * Math.sin(want.th))) < 20 * D2R
  return { hit, out }
}

console.log(`gesture thresholds: snap ${GEST.snapMs} ms / ${GEST.snapDeg} deg or ${GEST.flickMs} ms / ${GEST.flickDeg} deg, pump ${GEST.pumpMs} ms, spin ${GEST.spinMs} ms / ${GEST.spinDeg} deg, held ${GEST.stillMs} ms`)
const fl = normal(MIN)
const per = fl.length / MIN
const byK = fl.reduce((m, e) => ((m[e.kind] = (m[e.kind] || 0) + 1), m), {})
console.log(`normal play, ${MIN} min of thumb: ${fl.length} false moves (${per.toFixed(2)} a minute) ${JSON.stringify(byK)}`)
ok(per <= 0.5, `normal steering: at most one false move every two minutes (${per.toFixed(2)}/min)`)
for (const k of ['snap', 'diagonal', 'reverse', 'pump', 'spin']) {
  let h = 0; const N = 400, miss = {}
  for (let i = 0; i < N; i++) { const r = gestureTrial(k); if (r.hit) h++; else { const w = r.out.map(e => e.kind).join('+') || 'none'; miss[w] = (miss[w] || 0) + 1 } }
  ok(h / N >= 0.9, `${k}: ${(100 * h / N).toFixed(1)}% make the right move ${h < N ? JSON.stringify(miss) : ''}`)
}
// a thumb landing and pushing out (any speed), and the slowest ordinary cut, are never moves
{
  let n = 0
  for (let i = 0; i < 300; i++) { const th = U(0, 6.3), d = U(20, 200); n += run(t => pol(th, ease(t / d)), d + 300).length }
  ok(n === 0, `a thumb landing and pushing out from the middle: no move (${n} in 300)`)
}

// ── the keyboard: a double tap ────────────────────────────────────────────────────────────────────
{
  // normal WASD play: holds of 120-1500 ms, gaps 0-400 ms, the same key again now and then
  let fk = 0, presses = 0
  const tp = createTaps(); let t = 0
  for (let i = 0; i < MIN * 60; i++) {
    const k = 'wasd'[Math.floor(rnd() * 4)], hold = rnd() < 0.15 ? U(60, 200) : U(250, 1500)
    if (tp.down(k, t)) fk++
    presses++
    t += hold; tp.up(k, t); t += rnd() < 0.3 ? U(0, 120) : U(150, 600)
  }
  console.log(`keyboard, ${presses} ordinary presses: ${fk} double taps by accident (${(fk / MIN).toFixed(2)} a minute)`)
  ok(fk / MIN <= 1, 'keyboard: about one accidental double tap a minute at most')
  let h = 0
  for (let i = 0; i < 400; i++) { const tq = createTaps(), t0 = U(0, 1000), a = U(40, 160), g = U(40, 180); tq.down('a', t0); tq.up('a', t0 + a); if (tq.down('a', t0 + a + g) === 'a') h++ }
  ok(h === 400, `keyboard: a double tap (taps 40-160 ms, 40-180 ms apart) always counts (${h}/400)`)
}
console.log(fails ? `\n${fails} FAILED` : '\nall ok')
process.exit(fails ? 1 : 0)
