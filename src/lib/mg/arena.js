// One picture for every game played on a court: the arena of Crash the Glass (rebound.js). A camera near
// head height, level, on the floor with the players; the hoop up against a wall of people; the same room,
// floor, lines, board and rim (lib/mg/meter.js) and the same big men in their singlets. Everything goes
// through one projection in real feet, so the men, the lines, the rim and the ball can't disagree.
//   arenaCam     a camera: how high, how far from the rim, how wide
//   arenaStage   the room, the floor and the hoop: baked while the camera rests, painted while it travels
//   manAt        a man at a point on the floor, drawn live if he's close or in the air, stamped otherwise
//   hoopFront / flyTo / dropThrough   the rim with the ball in it, and the ball's trips
//   tagAt / tagsDown   the names under their feet, slid apart so two never sit on each other
import { clamp, lerp, layer } from './kit.js'
import { pose, athleteFront, frontRun, paintRoom, paintLines, paintHoop, rimHalf, netOf, ballIn, project, PT, FIG_FT, RIM_Y, RIM_R, BALL_R, meterTag } from './meter.js'

// ── The camera ──────────────────────────────────────────────────────────────
// H: feet off the floor. D: feet back from the rim. F: the lens, for a phone 640 high (the width of the
// picture is fixed, so a taller phone doesn't get a wider lens). hzAt: the horizon, as a share of the
// height: Crash the Glass has it at 0.415. px: where the rim's line sits across the screen.
const ROOM_BEYOND = 26     // feet from the rim to the wall behind it
export function arenaCam(h, { H, D, F, hzAt = 0.415, hz: hz0, px = 180, x = 0, maxF = Infinity }) {
  const U = h / 640, Fu = Math.min(maxF, F * U), hz = hz0 ?? h * hzAt
  return { h, U, H, D, F: Fu, hz, px, wallY: hz + (H * Fu) / (D + ROOM_BEYOND), cam: { F: Fu, H, px, hz, cos: 1, sin: 0, cx: x, cz: -D, bare: true } }
}
// Crash the Glass's own camera: seven feet up, the near man's feet 150 above the bottom of the screen, 12 feet off
export const CRASH_CAM = h => ({ H: 7, F: 33.8 * 12, hz: h - 150 - 7 * 33.8 * (h / 640) })
// the camera's been moved along the floor: feet back from the rim, and feet across
export function dolly(G, D, x = G.cam.cx) { G.cam.cz = -D; G.cam.cx = x; return G }
export const wallNow = G => G.hz + (G.H * G.F) / (-G.cam.cz + ROOM_BEYOND)

// ── The stage ───────────────────────────────────────────────────────────────
// key: anything that changes what's baked. A camera at rest costs one drawImage. On the move the room slides
// as one piece and the lines and the hoop are painted each frame, as Spot-up's pan does.
export function arenaStage(ctx, view, G, key, moving = false) {
  const c = view.colors, id = `arena-${c.us}-${c.trim}`
  if (!moving) {
    // (the same room, slid as far as the camera has come, so nothing pops when it stops)
    layer(ctx, view, `${id}-${key}`, x => {
      const dy = wallNow(G) - G.wallY
      x.save(); x.translate(0, dy); paintRoom(x, view, G, c, 'board'); x.restore()
      if (dy < 0) { x.fillStyle = '#dbaa72'; x.fillRect(0, view.h + dy - 1, view.w, 2 - dy) }
      paintLines(x, G.cam, c.us, !!G.full, G.sc ?? 1); paintHoop(x, G.cam, c.us)
    })
    return
  }
  const dy = wallNow(G) - G.wallY
  ctx.save(); ctx.translate(0, dy)
  layer(ctx, view, `${id}-room-${Math.round(G.wallY)}`, x => paintRoom(x, view, G, c, 'board'))
  ctx.restore()
  if (dy < 0) { ctx.fillStyle = '#dbaa72'; ctx.fillRect(0, view.h + dy - 1, view.w, 2 - dy) }
  paintLines(ctx, G.cam, c.us, !!G.full, G.sc ?? 1)
  paintHoop(ctx, G.cam, c.us)
}

// ── The men ─────────────────────────────────────────────────────────────────
// Each pose has a name, so a man at a distance can be painted once and stamped. x is across the screen,
// the hands and feet in the figure's units. The off-ball poses come from the shooting games and the boards.
const named = o => { const out = {}; for (const k of Object.keys(o)) { out[k] = pose(o[k]); out[k].id = k } return out }
export const POSE = named({
  off: { hy: 45, fFx: 12, fBx: -12, hFx: 17, hFy: 43, hBx: -17, hBy: 43 },             // standing ready, off the ball
  hold: { hy: 44, fFx: 12, fBx: -12, hFx: 9, hFy: 74, hBx: -9, hBy: 74 },              // the ball at his chest
  guardA: { hy: 40, fFx: 16, fBx: -16, hFx: 33, hFy: 58, hBx: -30, hBy: 44 },          // sat down on D, hands working
  guardB: { hy: 40, fFx: 16, fBx: -16, hFx: 30, hFy: 44, hBx: -33, hBy: 58 },
  isoD: { hy: 40, fFx: 17, fBx: -17, hFx: 27, hFy: 50, hBx: -27, hBy: 50 },            // down in his stance, both hands low, waiting
  deny: { hy: 40, fFx: 15, fBx: -15, hFx: 34, hFy: 62, hBx: -34, hBy: 62 },
  shadeL: { hx: -4, hy: 40, lean: -0.08, fFx: 13, fBx: -19, hFx: 27, hFy: 50, hBx: -36, hBy: 50 },
  shadeR: { hx: 4, hy: 40, lean: 0.08, fFx: 19, fBx: -13, hFx: 36, hFy: 50, hBx: -27, hBy: 50 },
  reachL: { hx: -7, hy: 38, lean: -0.16, fFx: 13, fBx: -25, hFx: 24, hFy: 50, hBx: -50, hBy: 38 },   // a hand down at the ball
  reachR: { hx: 7, hy: 38, lean: 0.16, fFx: 25, fBx: -13, hFx: 50, hFy: 38, hBx: -24, hBy: 50 },
  stumbleL: { hx: -12, hy: 36, lean: -0.42, fFx: 2, fFy: 7, fBx: -30, hFx: 24, hFy: 92, hBx: -44, hBy: 42 },
  stumbleR: { hx: 12, hy: 36, lean: 0.42, fFx: 30, fBx: -2, fBy: 7, hFx: 44, hFy: 42, hBx: -24, hBy: 92 },
  dribL: { hx: -2, hy: 41, lean: -0.05, fFx: 15, fBx: -15, hFx: 20, hFy: 58, hBx: -27, hBy: 30 },   // the ball out low in one hand, the other arm up for his man
  dribR: { hx: 2, hy: 41, lean: 0.05, fFx: 15, fBx: -15, hFx: 27, hFy: 30, hBx: -20, hBy: 58 },
  dribC: { hy: 38, fFx: 18, fBx: -18, hFx: 15, hFy: 22, hBx: -15, hBy: 22 },
  post: { hy: 41, fFx: 17, fBx: -17, hFx: 9, hFy: 58, hBx: -9, hBy: 58 },               // sat down on his man, the ball at his waist
  dropL: { hx: -5, hy: 40, lean: -0.1, fFx: 11, fBx: -27, hFx: 12, hFy: 60, hBx: -6, hBy: 60 },
  dropR: { hx: 5, hy: 40, lean: 0.1, fFx: 27, fBx: -11, hFx: 6, hFy: 60, hBx: -12, hBy: 60 },
  layup: { hy: 50, lean: 0.06, fFx: 10, fFy: 24, fBx: -6, fBy: 0, hFx: 12, hFy: 128, hBx: -16, hBy: 62 },   // up off one foot, the far hand laying it in
  shoot: { hy: 49, fFx: 8, fBx: -8, fFy: 1, fBy: 2, hFx: 13, hFy: 130, hBx: -21, hBy: 100 },
  gather: { hy: 43, fFx: 12, fBx: -12, hFx: 15, hFy: 94, hBx: 2.5, hBy: 95 },
  hands: { hy: 49, fFx: 8, fBx: -8, fFy: 2, fBy: 4, hFx: 11, hFy: 125, hBx: -11, hBy: 123 },   // straight up, the boards' reach
  slideA: { hy: 40, fFx: 21, fBx: -13, hFx: 27, hFy: 72, hBx: -27, hBy: 72 },
  slideB: { hy: 41, fFx: 13, fBx: -21, hFx: 27, hFy: 72, hBx: -27, hBy: 72 },
  land: { hy: 46, fFx: 12, fBx: -12, hFx: 21, hFy: 47, hBx: -21, hBy: 47 },
})
// the four frames of a run, either end on
export const RUN = [0, 1, 2, 3].map(i => { const p = frontRun((i * Math.PI) / 2, pose({})); p.id = `run${i}`; return p })
export const stride = step => RUN[step]

const stamps = new Map()
const SIZES = [0.62, 1, 1.5]
function stampOf(view, id, s, paint) {
  const res = SIZES.find(v => v >= s) ?? SIZES[SIZES.length - 1]
  const key = `${id}|${res}|${view.px}`
  let c = stamps.get(key)
  if (!c && typeof document !== 'undefined') {
    if (stamps.size > 150) stamps.clear()
    c = document.createElement('canvas'); c.width = Math.ceil(110 * res * view.px); c.height = Math.ceil(152 * res * view.px)
    const x = c.getContext('2d')
    x.scale(view.px, view.px); x.translate(55 * res, 138 * res)
    paint(x, res)
    stamps.set(key, c)
  }
  return c
}
const LIVE_S = 1.32    // this close, or off the floor, he's drawn for real: he's what you're looking at
// x, z: the floor under him, in feet. P: a pose. o: { jersey, trim, skin, num, back, ball, spin, live }.
// Returns his size on the screen in PT (x, y of his feet; k pixels a foot), or false: he's behind the lens.
export function manAt(ctx, view, cam, x, z, P, o) {
  project(cam, x, 0, z)
  if (PT.z < 2.5) return false
  const k = PT.k, sx = PT.x, sy = PT.y, s = k / FIG_FT
  if (sx < -70 * s - 10 || sx > view.w + 70 * s + 10) return true
  if (o.live || !P.id || s > LIVE_S || P.j > 0 || o.ball) {
    athleteFront(ctx, sx, sy, P, { jersey: o.jersey, trim: o.trim, skin: o.skin, s, back: o.back, num: o.num, ball: o.ball ?? null, spin: o.spin ?? 0 })
  } else {
    const st = stampOf(view, `${P.id}|${o.jersey}|${o.trim}|${o.num}|${o.skin}|${o.back ? 1 : 0}`, s, (c, res) => athleteFront(c, 0, 0, P, { jersey: o.jersey, trim: o.trim, skin: o.skin, s: res, back: o.back, num: o.num }))
    if (st) ctx.drawImage(st, sx - 55 * s, sy - 138 * s, 110 * s, 152 * s)
  }
  PT.x = sx; PT.y = sy; PT.k = k
  return true
}
// where a man's chest is on the screen, and how far a tap is from his body, knees to head
export function chestOf(cam, x, z, out) {
  project(cam, x, 0, z)
  out.x = PT.x; out.y = PT.y - 3.9 * PT.k
  return out
}
export function tapGap(cam, x, z, ax, ay) {
  project(cam, x, 0, z)
  const top = PT.y - 6.2 * PT.k, bot = PT.y - 1.4 * PT.k, half = 0.9 * PT.k
  const dx = Math.max(0, Math.abs(ax - PT.x) - half), dy = ay < top ? top - ay : ay > bot ? ay - bot : 0
  return Math.hypot(dx, dy)
}

// ── The names ───────────────────────────────────────────────────────────────
const TAGS = []
let tagN = 0
export function tagAt(x, y, name, s) {
  if (!name) return
  const t = TAGS[tagN] ?? (TAGS[tagN] = {})
  tagN++
  t.x = x; t.y = y; t.name = name; t.s = s
  t.k = clamp(s * 1.05, 0.8, 1.4); t.w = (name.length * 5.6 + 6) * t.k
}
export function tagsDown(ctx, view) {
  // (two men close together slide theirs apart, each still under his man)
  for (let a = 0; a < tagN; a++) for (let b = a + 1; b < tagN; b++) {
    const A = TAGS[a], B = TAGS[b], H = 11 * Math.max(A.k, B.k)
    const ox = (A.w + B.w) / 2 - Math.abs(A.x - B.x), oy = H - Math.abs(A.y - B.y)
    if (ox <= 0 || oy <= 0) continue
    const push = (ox / 2) * Math.min(1, oy / (H * 0.5)), sd = A.x <= B.x ? 1 : -1
    A.x -= sd * push; B.x += sd * push
  }
  for (let i = 0; i < tagN; i++) { const t = TAGS[i]; meterTag(ctx, view, t.x, t.y, t.name, t.s) }
  tagN = 0
}

// ── The ball ────────────────────────────────────────────────────────────────
export const AB = { x: 0, y: 0, z: 0 }
// from a point to a point, with an arc: apex is feet over the straight line at the middle of the trip
export function flyTo(ax, ay, az, bx, by, bz, f, apex = 0) {
  AB.x = lerp(ax, bx, f); AB.z = lerp(az, bz, f); AB.y = lerp(ay, by, f) + apex * 4 * f * (1 - f)
  return AB
}
// through the net and down: age in ms since it reached the rim. The ball's on the floor by 420, with a bounce
export function dropThrough(age, x = 0, z = -0.1) {
  const t = age / 420, y = t < 1 ? RIM_Y + (BALL_R - RIM_Y) * t * t : BALL_R + Math.abs(Math.sin((t - 1) * 3.1)) * 1.7 * Math.exp(-(t - 1) * 1.4)
  AB.x = x; AB.z = z - Math.max(0, t - 1) * 1.8; AB.y = y
  return AB
}
// the arc to the rim from a shot taken D feet away: about what a real shot does
export const shotApex = D => 1.2 + D * 0.2
// the hoop's two halves, the net between them, and the ball in the right place if it's at the iron
export function hoopWith(ctx, cam, ball, netAge, spin = 0, dy = 0) {
  const on = ball && Math.abs(ball.z) <= RIM_R + BALL_R && ball.y > RIM_Y - 1.7 && Math.abs(ball.x) <= RIM_R + BALL_R
  rimHalf(ctx, cam, false, dy)
  if (on) ballIn(ctx, cam, ball.x, ball.y, ball.z, spin)
  netOf(ctx, cam, netAge, dy)
  rimHalf(ctx, cam, true, dy)
  return on
}
// a named pose, off the floor by j. (Off the floor he's drawn live, so these can be shared and reused.)
const LIFTED = Array.from({ length: 8 }, () => pose({}))
let liftN = 0
export function liftPose(P, j) {
  const o = LIFTED[liftN = (liftN + 1) % LIFTED.length]
  for (const k in P) if (k !== 'id') o[k] = P[k]
  o.j = j
  return o
}
