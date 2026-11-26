// A person drawing a shot with a finger (soccer.js's draw the shot): from the ball to a spot on the goal, as he sees
// it in the picture, bowed when he wants it curled, at the pace he means. A person's error in each: the spot (px), the
// pace (how quick he meant it), the bow, and a shake in the line. The sharper the human, the truer the stroke.
//   strokeErr(human) → { aim px, pace, bend, shake px }
//   planStroke(t0, from, to, { bend, power, ring }, human, r) → [{ t, kind, x, y, id }]   (from/to: points in the picture)
//   spotOf(C, X, Y) → the picture's point of a spot on the goal face
//   player(g) → step() helper that sends a planned stroke's events as the game reaches their times
import { P, DRAW } from '../../../src/lib/mg/soccer.js'

const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export function strokeErr(h) {
  const tm = (h.timing ?? 42) * (process.env.DRAWERR != null ? +process.env.DRAWERR : 1)
  return { aim: 1.5 + tm * 0.13, pace: 0.04 + tm * 0.004, bend: 0.012 + tm * 0.0008, shake: tm * 0.03 }
}
export const spotOf = (C, X, Y) => { const p = P(C, X, Y, 0); return { x: p.x, y: p.y } }
export function planStroke(t0, from, to, want, human, r, id = 7) {
  const e = strokeErr(human)
  // (want.ring: the game shows a ring on the goal where it's going as he draws, and he steers the end of it onto his
  // spot: a closer finish than a stroke he can only judge by its end)
  const aim = e.aim * (want.ring ? 0.6 : 1)
  const E = { x: to.x + gauss(r) * aim, y: to.y + gauss(r) * aim * 0.8 }
  const bend = (want.bend ?? 0) + gauss(r) * e.bend
  const dx = E.x - from.x, dy = E.y - from.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L
  const N = 40, pts = []
  for (let i = 0; i <= N; i++) {
    const u = i / N, b = ((u - u ** 4) / 0.4725) * bend * L, sh = i > 0 && i < N ? gauss(r) * e.shake : 0
    pts.push({ x: from.x + dx * u + nx * (b + sh), y: from.y + dy * u + ny * (b + sh) })
  }
  let len = 0
  const cum = [0]
  for (let i = 1; i <= N; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(len) }
  // (FLICK=1: a kid who just flicks it, whatever pace it wants: anywhere from a firm stroke to a quick swipe)
  const p = process.env.FLICK ? 0.55 + r() * 0.65 : Math.max(0, (want.power ?? 0.6) * (1 + gauss(r) * e.pace))
  const speed = DRAW.s0 + p * (DRAW.s1 - DRAW.s0), dur = len / speed
  const at = s => { let i = 1; while (i < N && cum[i] < s) i++; const f = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f } }
  const out = [{ t: t0, kind: 'down', x: from.x + gauss(r) * 6, y: from.y + gauss(r) * 6, id }]
  const off = { x: out[0].x - from.x, y: out[0].y - from.y }
  const step = 1000 / 120
  for (let t = step; t < dur; t += step) { const q = at((t / dur) * len); out.push({ t: t0 + t, kind: 'move', x: q.x + off.x, y: q.y + off.y, id }) }
  out.push({ t: t0 + dur, kind: 'up', x: pts[N].x + off.x, y: pts[N].y + off.y, id })
  return out
}
// sends the queue's events once the game's clock reaches them
export function sender(g) {
  const q = []
  return {
    q,
    add(evs) { q.push(...evs) },
    clear() { q.length = 0 },
    due(out) { while (q.length && q[0].t <= g.t) { const e = q.shift(); out.push({ kind: e.kind, x: e.x, y: e.y, id: e.id }) } },
  }
}
