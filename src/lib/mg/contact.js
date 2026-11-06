// What a hit is made of, for the games built on contact (cut.js, leverage.js, rush.js): the picture stops for a
// beat, the camera takes it, turf comes up. All of it cosmetic: nothing here touches the rules or their rng.
import { tilt, warmAthlete } from './art.js'
import { rngOf } from './kit.js'

export const HIT_STOP = 70    // ms the picture holds on the moment of a real hit
// time since a hit, with the stop taken out: drive what happens after the hit off this
export const afterStop = since => Math.max(0, since - HIT_STOP)
// a seed for the particles, from the game's seed, without touching the game's own rng
export const fxSeed = seed => Math.floor(rngOf(`${seed}|fx`)() * 4294967295) + 1

// a real hit at a field point: turf up, a puff, the camera. side: the way the hit's going
export function hitFx(g, view, x, y, { power = 5, n = 14, dust = 3, side = 0, s = 1, up = 0 } = {}) {
  const p = tilt(view, x, y), at = p.y - up * p.s
  g.dirt?.burst('turf', p.x, at, g.t, { n, s: p.s * s * 1.25, ang: -Math.PI / 2 + side * 0.5, spread: 1.25, speed: 1.2 })
  if (dust) g.dirt?.burst('dust', p.x, p.y - 4 * p.s, g.t, { n: dust, s: p.s * s, spread: 1.6, life: 300 })
  if (power) g.nudge?.kick(g.t, power, side * 0.4, 1)
}
// a planted foot: turf thrown the other way from where he's going
export function plantFx(g, view, x, y, side, n = 8, s = 1) {
  const p = tilt(view, x, y)
  g.dirt?.burst('turf', p.x, p.y, g.t, { n, s: p.s * s, ang: -Math.PI / 2 - side * 0.85, spread: 0.55, speed: 1.15 })
}
// a body landing flat on the turf
export function landFx(g, view, x, y, { power = 2.5, dust = 5, side = 0, s = 1 } = {}) {
  const p = tilt(view, x, y)
  g.dirt?.burst('dust', p.x + side * 18 * p.s, p.y, g.t, { n: dust, s: p.s * s, ang: -Math.PI / 2, spread: 1.5, life: 340 })
  g.dirt?.burst('turf', p.x + side * 22 * p.s, p.y, g.t, { n: 4, s: p.s * s, ang: -Math.PI / 2 + side * 0.6, spread: 0.8, speed: 0.8 })
  if (power) g.nudge?.kick(g.t, power, 0, 1, 150)
}
// The picture pushed in. bake: the most it'll ever push (the backdrop and the men are painted for that many
// pixels, so it stays sharp, and painted once: z can move all it likes). Pair with ctx.restore().
export function pushIn(ctx, g, view, z, ax, ay, bake = z, toX = ax, toY = ay) {
  const v = g.zv ?? (g.zv = {})
  Object.assign(v, view)
  v.px = view.px * bake
  ctx.save()
  ctx.translate(toX, toY); ctx.scale(z, z); ctx.translate(-ax, -ay)
  return v
}
// a few looks a frame before they're needed, so a first cut never hitches
export function warmSome(g, build, n = 3) {
  g.warmL ??= build()
  g.warmed = g.warmed ?? 0
  for (let i = 0; i < n && g.warmed < g.warmL.length; i++, g.warmed++) warmAthlete(g.warmL[g.warmed])
}
