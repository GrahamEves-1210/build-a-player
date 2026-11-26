// BLACKTOP LIVE: the one-stick dribble moves (lib/btlive/gesture.js), measured on made-up thumbs. Moves only when meant:
// a tap (out fast and back, or let go), a snap (held out, thrown round fast and held), a roll (round the rim most of a
// circle, or back and around: the spin). Steady play makes none: holding, a drive curving round, a U-turn, easing off,
// the thumb landing and pushing out (even quick: that's starting to run), letting go. And the keyboard: a tap, a hard
// change of direction. (How a kid's thumb does over minutes of play: gesture-bot.mjs.) Run: node scripts/btlive/gesture-check.mjs [--seed=7]
import { createGesture, createTaps } from '../../src/lib/btlive/gesture.js'

let seed = Number(process.argv.find(a => a.startsWith('--seed='))?.slice(7)) || 7
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd())
let fails = 0
const ok = (c, w) => { if (!c) { console.log(`FAIL  ${w}`); fails++ } }
const D2R = Math.PI / 180
const pol = (th, r) => [Math.cos(th) * r, Math.sin(th) * r]
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

// a thumb: a path (t -> [x, y], null: the thumb off) sampled like pointer events (8-20 ms apart), a little shake on it
function run(path, ms) {
  const g = createGesture(), out = []
  g.aim(0, -1)
  let off = false
  for (let t = 0; t < ms; t += 8 + 12 * rnd()) {
    const at = path(t)
    if (!at) { if (!off) { const e = g.release(t); if (e) out.push({ ...e, at: t }); off = true } continue }
    off = false
    let [x, y] = at
    x += gauss() * 0.006; y += gauss() * 0.006
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m }
    const e = g.feed(t, x, y)
    if (e) out.push({ ...e, at: t })
  }
  return out
}
const way = (e, th) => e && e.dir[0] * Math.cos(th) + e.dir[1] * Math.sin(th) > 0.9
const one = (o, kind) => o.length === 1 && o[0].kind === kind
let n1 = 0
for (let n = 0; n < 40; n++, n1 += 6) {
  const th = rnd() * 2 * Math.PI, d = 40 + 25 * rnd()
  // a tap: out from rest and back
  let o = run(t => (t < 200 ? [0, 0] : t < 200 + d ? pol(th, ease((t - 200) / d)) : t < 260 + d ? pol(th, 1) : pol(th, 1 - ease((t - 260 - d) / 80))), 700)
  ok(one(o, 'flick') && way(o[0], th), `a tap out and back (out in ${d.toFixed(0)} ms): one move that way (${o.map(e => e.kind)})`)
  // ...and out, the thumb off
  o = run(t => (t < 200 ? [0, 0] : t < 200 + d ? pol(th, ease((t - 200) / d)) : t < 250 + d ? pol(th, 1) : null), 700)
  ok(one(o, 'flick') && way(o[0], th), `a tap out, the thumb off: one move that way (${o.length})`)
  // a snap: held out, thrown a quarter round and held
  o = run(t => (t < 300 ? pol(th, 1) : pol(th, 1).map((v, i) => v + (pol(th + Math.PI / 2, 1)[i] - v) * ease((t - 300) / d))), 800)
  ok(one(o, 'flick') && way(o[0], th + Math.PI / 2), `a snap a quarter round in ${d.toFixed(0)} ms: one move the new way (${o.length})`)
  // ...straight across through the middle (a cross back)
  o = run(t => { const u = ease((t - 300) / d); return t < 300 ? pol(th, 1) : [Math.cos(th) * (1 - 2 * u), Math.sin(th) * (1 - 2 * u)] }, 800)
  ok(one(o, "flick") && way(o[0], th + Math.PI), `a snap straight across in ${d.toFixed(0)} ms: one move the other way (${JSON.stringify(o)} th ${th.toFixed(2)})`)
  // a roll: most of a circle, quick
  const sg = rnd() < 0.5 ? 1 : -1, sw = (230 + 100 * rnd()) * D2R, rd = 180 + 120 * rnd()
  o = run(t => (t < 300 ? pol(th, 0.95) : pol(th + sg * sw * ease((t - 300) / rd), 0.95)), 1000)
  ok(one(o, 'roll') && Math.sign(o[0].turn) === sg && way(o[0], th + sg * sw), `rolled round ${(sw / D2R).toFixed(0)} deg in ${rd.toFixed(0)} ms: one roll, that way, ending where it ends (${o.map(e => e.kind)})`)
  // back and around: from the back half round to the front
  const b0 = Math.PI / 2 + (rnd() - 0.5) * 0.6
  o = run(t => (t < 300 ? pol(b0, 0.95) : pol(b0 + sg * 175 * D2R * ease((t - 300) / 220), 0.95)), 900)
  ok(one(o, 'roll'), `back and around (175 deg from the back): one roll (${o.map(e => e.kind)})`)
}
let n2 = 0
for (let n = 0; n < 40; n++, n2 += 7) {
  const th = rnd() * 2 * Math.PI, w = (60 + 120 * rnd()) * D2R * (rnd() < 0.5 ? -1 : 1)
  let o = run(t => pol(th + w * t / 1000, 0.95), 1500)
  ok(o.length === 0, `steering round at ${(Math.abs(w) / D2R).toFixed(0)} deg/s: no move`)
  o = run(t => (t < 200 ? [0, 0] : pol(th, ease((t - 200) / (55 + 60 * rnd())))), 700)
  ok(o.length === 0, 'pushing out from rest, quick, and holding (starting to run): no move')
  o = run(t => pol(th, ease(t / 60)), 500)
  ok(o.length === 0, 'the thumb landing and pushing out: no move')
  o = run(t => pol(th, 1 - ease((t - 200) / 60)), 500)
  ok(o.length === 0, 'snapping back to the middle: no move')
  o = run(t => pol(th + Math.PI / 2 * ease((t - 200) / 600), 1), 1100)
  ok(o.length === 0, 'a steady quarter turn (600 ms): no move')
  const u = 230 + 120 * rnd()
  o = run(t => (t < 200 ? pol(-Math.PI / 2, 0.95) : pol(-Math.PI / 2 + Math.sign(w) * Math.PI * ease((t - 200) / u), 0.95)), 1000)
  ok(!o.some(e => e.kind === 'roll'), `a U-turn round the rim from going forward (180 deg in ${u.toFixed(0)} ms): no spin (${o.map(e => e.kind)})`)
  o = run(t => (t < 200 ? pol(th, 0.95) : pol(th + w / Math.abs(w) * 50 * D2R * ease((t - 200) / 250), 0.95)), 800)
  ok(o.length === 0, 'a 50 degree turn in a quarter second: no move')
}
const K = createTaps()
ok(K.down('a', 0, [0, 0], [-1, 0]) === false && K.up('a', 120, [-1, 0], [0, 0]) === 'tap', 'a tap: a move as it comes up')
ok(K.down('a', 0, [0, 0], [-1, 0]) === false && K.up('a', 400, [-1, 0], [0, 0]) === null, 'a key held: no move')
ok(K.down('d', 0, [0, 0], [1, 0]) === false && K.down('a', 300, [1, 0], [0, 0]) === false && K.up('d', 380, [1, 0], [-1, 0]) === 'turn', 'D held, A pressed too, D let go: a move left (the screen hands it the way he was going)')
ok(K.down('a', 0, [1, 0], [-1, 0]) === true && K.up('a', 100, [-1, 0], [0, 0]) === null, 'D held, then A: a move at once (and not again on the way up)')
ok(K.down('d', 0, [0, -1], [Math.SQRT1_2, -Math.SQRT1_2]) === false, 'W held, D added: a drift, no move')
ok(K.down('s', 0, [0, -1], [0, 0]) === false, 'W held, S pressed (stop): no move')
console.log(`${n1} meant motions, ${n2} steady ones, 5 key cases: ${fails ? `${fails} FAILED` : 'all ok'}`)
process.exit(fails ? 1 : 0)
