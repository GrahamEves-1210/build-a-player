// BLACKTOP LIVE: the one-stick dribble moves (lib/btlive/gesture.js), measured on made-up thumbs. Quick motions make
// a move the way the stick ends up (a flick out from rest, a snap sideways, a cross back through the middle); steady
// play (holding, a drive curving round, easing off, the thumb landing and pushing out, letting go) makes none. And
// the keyboard: a tap, a hard change of direction. Run: node scripts/btlive/gesture-check.mjs [--seed=7]
import { createGesture, createTaps } from '../../src/lib/btlive/gesture.js'

let seed = Number(process.argv.find(a => a.startsWith('--seed='))?.slice(7)) || 7
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd())
let fails = 0
const ok = (c, w) => { if (!c) { console.log(`FAIL  ${w}`); fails++ } }
const D2R = Math.PI / 180
const pol = (th, r) => [Math.cos(th) * r, Math.sin(th) * r]
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

// a thumb: a path (t -> [x, y]) sampled like pointer events (8-20 ms apart), a little shake on it
function run(path, ms) {
  const g = createGesture(), out = []
  for (let t = 0; t < ms; t += 8 + 12 * rnd()) {
    let [x, y] = path(t)
    x += gauss() * 0.006; y += gauss() * 0.006
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m }
    const e = g.feed(t, x, y)
    if (e) out.push({ ...e, at: t })
  }
  return out
}
const way = (e, th) => e && e.dir[0] * Math.cos(th) + e.dir[1] * Math.sin(th) > 0.9
let n1 = 0
for (let n = 0; n < 40; n++, n1 += 4) {
  const th = rnd() * 2 * Math.PI, d = 50 + 60 * rnd()
  let o = run(t => (t < 200 ? [0, 0] : pol(th, ease((t - 200) / d))), 600)
  ok(o.length === 1 && way(o[0], th), `flick out from rest in ${d.toFixed(0)} ms: one move that way (${o.length})`)
  o = run(t => (t < 300 ? pol(th, 1) : pol(th + Math.PI / 2 * ease((t - 300) / d), 1)), 700)
  ok(o.length === 1 && way(o[0], th + Math.PI / 2), `snap sideways in ${d.toFixed(0)} ms: one move the new way (${o.length})`)
  o = run(t => { const u = ease((t - 300) / (d + 30)); return t < 300 ? pol(th, 1) : [Math.cos(th) * (1 - 2 * u), Math.sin(th) * (1 - 2 * u)] }, 700)
  ok(o.length === 1 && way(o[0], th + Math.PI), `straight across in ${(d + 30).toFixed(0)} ms: one move the other way (${o.length})`)
  o = run(t => { const seg = Math.floor(t / 250), u = ease((t % 250) / 70), a = seg % 2 ? th : th + Math.PI, b = seg % 2 ? th + Math.PI : th; return seg === 0 ? pol(th, 1) : [Math.cos(a) + (Math.cos(b) - Math.cos(a)) * u, Math.sin(a) + (Math.sin(b) - Math.sin(a)) * u] }, 1000)
  ok(o.length === 3, `three quick reversals: three moves (${o.length})`)
}
let n2 = 0
for (let n = 0; n < 40; n++, n2 += 4) {
  const th = rnd() * 2 * Math.PI, w = (60 + 120 * rnd()) * D2R * (rnd() < 0.5 ? -1 : 1)
  let o = run(t => pol(th + w * t / 1000, 0.95), 1500)
  ok(o.length === 0, `steering round at ${(Math.abs(w) / D2R).toFixed(0)} deg/s: no move`)
  o = run(t => pol(th, ease(t / 60)), 500)
  ok(o.length === 0, 'the thumb landing and pushing out: no move')
  o = run(t => pol(th, 1 - ease((t - 200) / 60)), 500)
  ok(o.length === 0, 'snapping back to the middle: no move')
  o = run(t => pol(th + Math.PI / 2 * ease((t - 200) / 600), 1), 1100)
  ok(o.length === 0, 'a steady quarter turn (600 ms): no move')
}
const K = createTaps()
ok(K.down('a', 0, [0, 0], [-1, 0]) === false && K.up('a', 120, [-1, 0], [0, 0]) === 'tap', 'a tap: a move as it comes up')
ok(K.down('a', 0, [0, 0], [-1, 0]) === false && K.up('a', 400, [-1, 0], [0, 0]) === null, 'a key held: no move')
ok(K.down('d', 0, [0, 0], [1, 0]) === false && K.down('a', 300, [1, 0], [0, 0]) === false && K.up('d', 380, [1, 0], [-1, 0]) === 'turn', 'D held, A pressed too, D let go: a move left (the screen hands it the way he was going)')
ok(K.down('a', 0, [1, 0], [-1, 0]) === true && K.up('a', 100, [-1, 0], [0, 0]) === null, 'D held, then A: a move at once (and not again on the way up)')
ok(K.down('d', 0, [0, -1], [Math.SQRT1_2, -Math.SQRT1_2]) === false, 'W held, D added: a drift, no move')
ok(K.down('s', 0, [0, -1], [0, 0]) === false, 'W held, S pressed (stop): no move')
console.log(`${n1} quick motions, ${n2} steady ones, 5 key cases: ${fails ? `${fails} FAILED` : 'all ok'}`)
process.exit(fails ? 1 : 0)
