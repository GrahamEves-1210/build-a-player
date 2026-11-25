// Draw the shot (lib/mg/soccer.js): the stroke read the way it's meant. Run from the repo root:
//   node scripts/soccer/draw-check.mjs
// The picture's point under a spot on the goal maps back to it (straight and turned lenses); a stroke from the ball to
// a spot reads that spot; too quick balloons it; a bow curls it (his foot's way the inside of the boot, the other way the
// outside) and the ball bends late and still finishes on its spot; slow and lifted is the chip (the Panenka up the
// middle from the spot); drawn back is no shot; a better finisher's is truer.
import { camOf, P, onGoal, stroke, strokeDown, strokeMove, strokeUp, readStroke, shooter, drawnShot, strikeOf, shotAt, DRAW, POST, BAR } from '../../src/lib/mg/soccer.js'

let bad = 0
const ok = (cond, what) => { if (!cond) { bad++; console.log('FAIL', what) } else console.log('ok  ', what) }
const view = { w: 360, h: 700 }
const PEN = camOf(view, { x: -0.3, y: 3.3, z: -21, F: 720, hzAt: 0.15 })
const FK = camOf(view, { x: 6, y: 2.75, z: -32, F: 640, hzAt: 0.25, yaw: Math.atan2(-0.25, 0.97) })

// the lens, both ways
for (const [name, C] of [['penalty lens', PEN], ['turned free-kick lens', FK]]) {
  let worst = 0
  for (const [X, Y] of [[-3, 0.3], [2.9, 2.1], [0, 1.2], [5, -1]]) { const p = P(C, X, Y, 0), q = onGoal(C, p.x, p.y); worst = Math.max(worst, Math.hypot(q.x - X, q.y - Y)) }
  ok(worst < 1e-6, `${name}: onGoal undoes P (worst ${worst.toExponential(1)} m)`)
}
// a stroke drawn at a pace (px/ms), bowed by bend, from the ball to a point of the picture
function drawn(C, from, to, { pace = 1.2, bend = 0, n = 24, base = 'pen', foot = 1 } = {}) {
  const st = stroke(), dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L
  const pts = []
  for (let i = 0; i <= n; i++) { const u = i / n, b = ((u - u ** 4) / 0.4725) * bend * L; pts.push({ x: from.x + dx * u + nx * b, y: from.y + dy * u + ny * b }) }
  let len = 0
  for (let i = 1; i <= n; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  const T = len / pace
  strokeDown(st, from.x, from.y, 0, 1, from)
  for (let i = 1; i < n; i++) strokeMove(st, pts[i].x, pts[i].y, (T * i) / n, 1)
  strokeUp(st, pts[n].x, pts[n].y, T, 1)
  return readStroke(st, C, { base, foot })
}
const ball = P(PEN, 0, 0.11, -11)
const spot = (X, Y) => P(PEN, X, Y, 0)

let rd = drawn(PEN, ball, spot(2.8, 1.7))
ok(Math.abs(rd.x - 2.8) < 0.05 && Math.abs(rd.y - 1.7) < 0.05 && rd.type === 'pen', `straight to the top corner reads it: ${rd.x.toFixed(2)}, ${rd.y.toFixed(2)} ${rd.label}`)
rd = drawn(PEN, ball, { x: ball.x + (spot(-2.8, DRAW.yLow).x - ball.x) * 0.4, y: ball.y + (spot(-2.8, DRAW.yLow).y - ball.y) * 0.4 })
ok(rd.short && rd.y === DRAW.yLow && Math.abs(rd.x + 2.8) < 0.1, `short of the line goes on along it, low: ${rd.x.toFixed(2)}, ${rd.y}`)
const p1 = drawn(PEN, ball, spot(2, 1), { pace: 0.8 }).power, p2 = drawn(PEN, ball, spot(2, 1), { pace: 1.5 }).power
ok(p2 > p1, `quicker is harder (${p1.toFixed(2)} → ${p2.toFixed(2)})`)
// too quick: over the bar, every time
{
  const k = shooter(6, { windup: 0 }); let over = 0
  for (let i = 0; i < 200; i++) { k.reset(); drawnShot(k, drawn(PEN, ball, spot(1.5, 1.6), { pace: 2.3 }), 0, 0); const s = strikeOf(k, { x: 0, z: -11 }, { v: 6, r: rng(i) }); if (s.over || s.to.y > BAR) over++ }
  ok(over > 170, `too quick balloons it: over ${over}/200`)
}
// the bow: inside of the boot (his foot's way), outside the other way; it bends late and lands on its spot
rd = drawn(PEN, ball, spot(-2.5, 1.2), { bend: 0.2 })
ok(rd.curl && !rd.outside && rd.bend > 0, `bowed right, right foot: the inside of the boot (${rd.label})`)
rd = drawn(PEN, ball, spot(2.5, 1.2), { bend: -0.2 })
ok(rd.curl && rd.outside && rd.label === 'OUTSIDE OF THE BOOT', `bowed left, right foot: ${rd.label}`)
rd = drawn(PEN, ball, spot(2.5, 1.2), { bend: -0.2, foot: -1 })
ok(rd.curl && !rd.outside, 'bowed left, left foot: the inside')
ok(!drawn(PEN, ball, spot(2.5, 1.2), { bend: 0.03 }).curl, 'a slight wobble is no curl')
{
  const fball = P(FK, 5, 0.11, -24), k = shooter(8, { windup: 0 })
  const r0 = drawn(FK, fball, P(FK, 3, 1.8, 0), { bend: -0.22, base: 'driven', foot: -1 })
  drawnShot(k, r0, 0, 0)
  const s = strikeOf(k, { x: 5, z: -24 }, { v: 8, r: rng(3), foot: -1 })
  const off = g => { const b = shotAt(s, g * s.T), lx = s.from.x + (s.to.x - s.from.x) * g; return b.x - lx }
  const mid = Math.abs(off(0.4)), peak = Math.abs(off(0.63)), end = shotAt(s, s.T)
  ok(s.type === 'finesse' && !s.outside && Math.abs(s.curve) > 0.5, `a free kick's curler: ${s.label}, ${s.curve.toFixed(2)} m of bend`)
  ok(peak > mid && Math.abs(end.x - s.to.x) < 1e-6 && Math.abs(end.y - s.to.y) < 1e-6, `it bends late (${mid.toFixed(2)} m out at 40%, ${peak.toFixed(2)} at 63%) and finishes on its spot`)
}
// slow and lifted: the chip, the Panenka up the middle
rd = drawn(PEN, ball, spot(0.2, 1.6), { pace: 0.35 })
ok(rd.type === 'chip' && rd.label === 'PANENKA', `soft up the middle: ${rd.label}`)
rd = drawn(PEN, ball, spot(2.4, 1.6), { pace: 0.35, base: 'driven' })
ok(rd.type === 'chip' && rd.label === 'CHIP', `soft and lifted in open play: ${rd.label}`)
// drawn back, or a tap: no shot
ok(drawn(PEN, ball, { x: ball.x + 60, y: ball.y + 40 }).back, 'drawn back toward his own goal: no shot')
ok(drawn(PEN, ball, { x: ball.x + 4, y: ball.y - 8 }).tap, 'a tap: no shot')
// the grade: the same stroke, truer from a better finisher
{
  const scatter = v => { let e = 0; const k = shooter(v, { windup: 0 }); for (let i = 0; i < 400; i++) { k.reset(); drawnShot(k, drawn(PEN, ball, spot(2, 1.2)), 0, 0); const s = strikeOf(k, { x: 0, z: -11 }, { v, r: rng(i + 7) }); e += Math.hypot(s.to.x - 2, s.to.y - 1.2) } return e / 400 }
  const a = scatter(2), b = scatter(10)
  ok(a > b * 1.5, `a better finisher's stroke is truer: ${a.toFixed(2)} m off at grade 2, ${b.toFixed(2)} at 10`)
}
ok(POST > 3, 'the goal is the real one')
console.log(bad ? `${bad} FAILED` : 'all good')
process.exit(bad ? 1 : 0)
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647 }
