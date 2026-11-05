// Dash: the 40 and the 3/4-court sprint, from a camera low behind him on the track. Three-point stance,
// SET, the gun at a moment nobody can time, then LEFT RIGHT LEFT RIGHT as fast as you can go. The faster
// you alternate, the faster he runs, up to the top speed his trait gives him. The same foot twice does
// nothing. His legs run at his speed, not at your presses. The stopwatch is the real result.
import { clamp, lerp, outcome, rngOf, prog, easeOut, circle, text, DISPLAY, LABEL, GOOD, BAD, GOLD } from './kit.js'
import { dashTarget } from './combineNorms.js'
import { athlete } from './art.js'
import { placeStamp } from './read.js'
import { paintRoom as arenaRoom } from './meter.js'

export const how = {
  forty: 'Wait for the gun. Then alternate LEFT and RIGHT as fast as you can.',
  sprint: 'Wait for the whistle. Then alternate LEFT and RIGHT as fast as you can.',
}

// piecewise-linear through [x, y] points
export const curve = (x, pts) => {
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]))
  return pts[pts.length - 1][1]
}

// capOf: the top speed, in yards a second, that runs a given time on a solid go (measured: scripts/mg/calib-dash.mjs).
// slack: how far off that time still passes
const CAPOF_FORTY = [[3.69, 14], [3.79, 13.5], [3.91, 13], [4.03, 12.5], [4.16, 12], [4.31, 11.5], [4.47, 11], [4.64, 10.5], [4.83, 10], [5.04, 9.5], [5.28, 9], [5.54, 8.5], [5.83, 8]]
const CAPOF_SPRINT = [[2.6, 14], [2.67, 13.5], [2.74, 13], [2.82, 12.5], [2.91, 12], [3, 11.5], [3.1, 11], [3.21, 10.5], [3.33, 10], [3.46, 9.5], [3.61, 9], [3.77, 8.5], [3.96, 8]]
const SETUP = {
  forty: { dist: 40, range: 0.9, gun: 'gun', splitAt: 10, slack: 0.34, capOf: CAPOF_FORTY },
  sprint: { dist: 25, range: 0.6, gun: 'whistle', splitAt: 10, slack: 0.28, capOf: CAPOF_SPRINT },
}
// How fast he runs, as a share of his top speed, by the time between your presses (ms)
const BY_GAP = [[110, 1], [140, 0.94], [180, 0.84], [250, 0.66], [400, 0.4], [700, 0.12], [1100, 0]]
const TAU_UP = 0.62       // s: how fast speed climbs to what the presses ask for
const TAU_DOWN = 0.5      // s: and falls away when they slow or stop
const STRIDE_YD = 4.8     // yards a full cycle of the legs covers at speed (short steps out of the blocks)
const GIVE_UP = 10000
const RESET = 720         // ms: a false start stumbling back to the line

export function make({ v, seed, game, pos, capOverride }) {
  const S = SETUP[game] ?? SETUP.forty
  const r = rngOf(seed)
  const target = dashTarget(game, pos, v)
  const cap = capOverride ?? curve(target, S.capOf), passAt = target + S.slack
  const slow = passAt + S.range * 0.5
  const wait = () => 900 + r() * 1500
  const g = {
    t: 0, game, zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, fx: [], done: null, outro: 1700, stamp: null,
    S, cap, dist: S.dist,
    phase: 'set',            // set → run. A press is only ever a false start while this is 'set', and GO is only drawn once it isn't
    gunT: wait(), goAt: null, falses: 0, fsAt: -9999, penalty: 0,
    y: 0, speed: 0, last: null, strideAt: 0, strideN: 0, lastPress: 0, firstPress: null, gapAvg: 200,
    needMs: 0, stumbleAt: -9999,
    cycle: 0, blend: 0, crossed: null, split: null, splitAt: -9999, finalSecs: null,
    kicks: [{ t: -9999, y: 0 }, { t: -9999, y: 0 }, { t: -9999, y: 0 }, { t: -9999, y: 0 }], kickN: 0,
    hud: { prompt: S.gun === 'gun' ? 'WAIT FOR THE GUN' : 'WAIT FOR THE WHISTLE' },
    tick(dt) {
      g.t += dt
      const s = dt / 1000
      if (g.phase === 'set') {
        if (g.t >= g.gunT) {
          g.phase = 'run'; g.goAt = g.t; g.lastPress = g.t
          g.fx.push(S.gun === 'gun' ? 'pop' : 'whistle', 'h:medium')
          g.hud.prompt = null
        }
        return
      }
      if (g.done) g.speed *= Math.exp(-s / 0.55)
      else if (g.firstPress != null) {
        const want = cap * curve(Math.max(g.gapAvg, g.t - g.lastPress), BY_GAP)
        g.speed += (want - g.speed) * (1 - Math.exp(-s / (want > g.speed ? TAU_UP : TAU_DOWN)))
      }
      const was = g.y
      g.y += g.speed * s
      // the legs run at his speed: short quick steps out of the blocks, long ones at the top
      const top = clamp(g.speed / (cap * 0.72), 0, 1), half = Math.floor(g.cycle * 2)
      g.cycle += (g.speed * s) / lerp(2.8, STRIDE_YD, top)
      if (Math.floor(g.cycle * 2) !== half && g.speed > 0.5) g.kicks[g.kickN++ % g.kicks.length] = { t: g.t, y: g.y }
      if (g.firstPress != null) g.blend = Math.min(1, g.blend + dt / 170)
      if (g.done) { g.padLit = null; return }
      // the pad that's lit is the foot that's next
      g.padLit = g.firstPress == null ? null : 1 - (g.last ?? 1)
      if (g.split == null && g.y >= S.splitAt) { g.split = clock(); g.splitAt = g.t }
      if (g.firstPress != null) g.hud.prompt = null
      if (g.y >= g.dist) { g.crossed = g.t - dt * clamp((g.y - g.dist) / (g.y - was || 1), 0, 1); finish() }
      else if (g.t - g.goAt >= GIVE_UP) finish(true)
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const side = a.zone === 'L' ? 0 : a.zone === 'R' ? 1 : null
      if (side == null) return
      if (g.phase === 'set') return falseStart()
      g.lastPress = g.t
      if (g.firstPress == null) { g.firstPress = g.t; stride(side, true); return }
      if (side === g.last) return   // the same foot twice: nothing
      stride(side)
    },
  }
  function falseStart() {
    if (g.t < g.fsAt + RESET) return             // still stumbling back to the line
    g.falses++; g.fsAt = g.t
    g.gunT = g.t + RESET + wait()
    if (g.falses > 2) g.penalty += 0.1
    g.stamp = { text: g.falses > 2 ? 'FALSE START +0.10' : 'FALSE START', good: false, at: g.t, ms: RESET - 20, size: g.falses > 2 ? 32 : 46 }
    g.fx.push('deny', 'h:heavy')
    if (g.falses >= 5) {
      g.phase = 'run'; g.goAt = g.t; g.lastPress = g.t
      g.done = outcome(0, false, 'Disqualified', { secs: GIVE_UP / 1000 })
      g.stamp = { text: 'DISQUALIFIED', good: false, at: g.t, size: 46 }
      g.hud.prompt = null
    }
  }
  function stride(side, first = false) {
    g.gapAvg = first ? 200 : g.gapAvg * 0.7 + (g.t - g.strideAt) * 0.3
    g.last = side; g.strideAt = g.t; g.strideN++
    if (g.strideN % 2 === 0) g.fx.push('tap')
    g.fx.push('h:light')
  }
  const clock = () => (g.t - g.goAt) / 1000 + g.penalty
  function finish(gaveUp = false) {
    const secs = gaveUp ? GIVE_UP / 1000 : (g.crossed - g.goAt) / 1000 + g.penalty
    const score = gaveUp ? 0 : clamp((slow - secs) / S.range, 0, 1)
    const hit = score >= 0.5
    const react = g.firstPress != null ? g.firstPress - g.goAt : 9999
    const parts = [gaveUp ? 'Pulled up' : react < 260 ? 'Great start' : react < 400 ? 'Clean start' : 'Slow start']
    if (g.falses) parts.push(g.falses > 1 ? `${g.falses} false starts` : 'False start')
    g.done = outcome(score, hit, [gaveUp ? null : `${secs.toFixed(2)}s`, ...parts].filter(Boolean).join(' · '), { secs })
    g.finalSecs = secs
    g.hud.prompt = null; g.padLit = null
    // (the time is on the clock, in the result's colour: the stamp only says what it means)
    g.stamp = { text: gaveUp ? 'PULLED UP' : hit ? 'GOOD TIME' : 'TOO SLOW', good: hit, at: g.t, size: 46 }
    g.fx.push('swoosh')
  }
  g.clock = () => (g.goAt == null ? g.penalty : g.finalSecs != null ? g.finalSecs : clock())
  return g
}

// ── Shared with bench.js ────────────────────────────────────────────────────
export function taper(ctx, x1, y1, r1, x2, y2, r2) {
  const a = Math.atan2(y2 - y1, x2 - x1), q = Math.PI / 2
  ctx.beginPath(); ctx.arc(x1, y1, r1, a + q, a - q); ctx.arc(x2, y2, r2, a - q, a + q); ctx.closePath(); ctx.fill()
}
const shades = new Map()
export function shade(hex, f) {
  const id = `${hex}|${f}`
  let c = shades.get(id)
  if (!c) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? '')
    if (!m) c = hex
    else {
      let h = m[1]; if (h.length === 3) h = h.replace(/./g, '$&$&')
      const ch = i => Math.round(clamp(parseInt(h.slice(i, i + 2), 16) * f, 0, 255))
      c = `rgb(${ch(0)},${ch(2)},${ch(4)})`
    }
    shades.set(id, c)
  }
  return c
}
// Combine gear: nobody has a team yet. The same white shirt and dark shorts as the cone and the gauntlet
export const GEAR = {
  top: '#eef1f4', topD: '#c4cbd1', topL: '#ffffff', trim: '#1b2127',
  shorts: '#20262c', shortsD: '#14181c',
  skin: '#8d5a3b', skinD: '#6f452c', skinL: '#a26e4c',
  sock: '#eceeec', sockD: '#b3b6b4', shoe: '#20262c', shoeD: '#14181c', sole: '#e8ebe6', hair: '#17120e',
}
// the NBA combine's: a blue top and shorts
export const GEAR_NBA = { ...GEAR, top: '#1d57a8', topD: '#174687', topL: '#2f70c8', trim: '#ffffff', shorts: '#1d57a8', shortsD: '#174687' }
export const palette = () => GEAR

// ── The leg cycle ───────────────────────────────────────────────────────────
// One leg through one full stride, in keyframes: [phase, thigh, knee, ankle] (radians; 0 hangs straight down, thigh + =
// forward, knee + = bent, ankle + = toes pointed). The other leg runs the same half a cycle on. Toe-off with the leg
// fully out behind him, the heel folding up to the seat, the knee driving through and up high, the shin swinging out
// to a long reach, touchdown, and the body going over the foot.
const GAIT = [
  [0.00, -0.78, 0.22, -0.1],   // toe-off: the whole leg long behind him
  [0.08, -0.74, 0.55, 0.2],    // off the ground, the other knee at its highest
  [0.18, -0.46, 1.4, 0.35],    // the heel coming up
  [0.30, 0.06, 2.0, 0.35],     // folded tight, passing under him
  [0.42, 0.85, 1.95, 0.3],     // the knee driving through
  [0.50, 1.3, 1.75, 0.25],     // the knee at its highest; the other leg's toe-off
  [0.60, 1.18, 1.05, 0.15],    // the shin swinging out
  [0.70, 0.84, 0.42, 0.1],     // the long reach
  [0.78, 0.5, 0.22, 0.28],     // touchdown, flat
  [0.85, 0.08, 0.42, -0.34],   // over the foot
  [0.93, -0.4, 0.24, -0.27],   // driving back, the heel lifting
]
const N = 96
const GH = new Float32Array(N), GK = new Float32Array(N), GA = new Float32Array(N)
// a smooth curve through the keys, round and round: no stop at any of them
const NK = GAIT.length
const keyAt = i => { const k = GAIT[((i % NK) + NK) % NK]; return i >= NK ? [k[0] + 1, k[1], k[2], k[3]] : i < 0 ? [k[0] - 1, k[1], k[2], k[3]] : k }
for (let i = 0; i < N; i++) {
  const p = i / N
  let k = 0
  while (k < NK - 1 && GAIT[k + 1][0] <= p) k++
  const a = keyAt(k - 1), b = keyAt(k), c = keyAt(k + 1), d = keyAt(k + 2), f = (p - b[0]) / (c[0] - b[0])
  // (Catmull-Rom, with the keys unevenly spaced)
  const hermite = col => {
    const m1 = (c[col] - a[col]) / (c[0] - a[0]) * (c[0] - b[0]), m2 = (d[col] - b[col]) / (d[0] - b[0]) * (c[0] - b[0])
    const f2 = f * f, f3 = f2 * f
    return (2 * f3 - 3 * f2 + 1) * b[col] + (f3 - 2 * f2 + f) * m1 + (-2 * f3 + 3 * f2) * c[col] + (f3 - f2) * m2
  }
  GH[i] = hermite(1); GK[i] = hermite(2); GA[i] = hermite(3)
}
const U = 22, L = 22
// A knee or an elbow from where the foot or hand has to be, x forward and y down from the joint.
const reachOf = (x, y, l1, l2) => {
  const d = Math.min(Math.hypot(x, y), l1 + l2 - 0.01)
  const bend = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1))
  return { hip: Math.atan2(x, y) + Math.asin(clamp((l2 * Math.sin(bend)) / d, -1, 1)), bend }
}
// One ink line round the whole figure: every limb's outline goes down first, in one pass, and the
// colours go on top, so a knee or an elbow never shows a seam.
export const INK = '#0d1116'
const INK_W = 1.9
export function line(ctx, x1, y1, x2, y2, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}
// a shoe, on its ankle: ang 0 is flat, toes toward +x
export function shoe(ctx, ax, ay, ang, col = '#20262c', sole = '#e8ebe6') {
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang)
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.roundRect(-4.6, -3.8, 18, 8.4, 3.6); ctx.fill(); ctx.stroke()
  ctx.fillStyle = sole; ctx.fillRect(-3.4, 2.5, 15.6, 1.6)
  ctx.restore()
}
export function hand(ctx, x, y, r, col) {
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.4
  circle(ctx, x, y, r); ctx.fill(); ctx.stroke()
}
// a head, seen from the side: a circle, the hair over the back of it, one mark for the eye.
// turn: 0 looks along +x
export const HEAD_R = 9.6   // the same head on every side-on man: about seven to his height
export function sideHead(ctx, x, y, r, skin, hair, turn = 0) {
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 1.6
  circle(ctx, x, y, r); ctx.fill(); ctx.stroke()
  ctx.save(); ctx.translate(x, y); ctx.rotate(turn)
  ctx.fillStyle = hair
  ctx.beginPath(); ctx.arc(0, 0, r + 0.2, Math.PI * 0.88, Math.PI * 1.86); ctx.quadraticCurveTo(0, -r * 0.39, -r * 0.99, r * 0.22); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#17120e'; ctx.fillRect(r * 0.44, -r * 0.13, r * 0.3, r * 0.13)
  ctx.restore()
}
// cover: how far down the thigh the shorts come. c.pants: long trousers, for the staff
export function runLeg(ctx, hip, knee, ank, far, c, cover = 0.62) {
  const sa = hip - knee
  const kx = Math.sin(hip) * U, ky = Math.cos(hip) * U
  const ax = kx + Math.sin(sa) * L, ay = ky + Math.cos(sa) * L
  const dim = col => (far ? shade(col, 0.74) : col)
  const skin = dim(c.pants ?? c.skin)
  line(ctx, 0, 0, kx, ky, 11 + INK_W, INK); line(ctx, kx, ky, ax, ay, 8.6 + INK_W, INK)
  shoe(ctx, ax, ay, -sa + ank, dim(c.shoe), dim(c.sole))
  line(ctx, kx, ky, ax, ay, 8.6, skin)
  line(ctx, 0, 0, kx, ky, 11, skin)
  if (!c.pants) line(ctx, 0, 0, lerp(0, kx, cover), lerp(0, ky, cover), 11.6, dim(c.shorts))
}
// a leg from the hip to where the ankle has to be, the knee forward
export function legTo(ctx, hx, hy, ax, ay, far, c, toe = 0, cover = 0.62) {
  const a = reachOf(ax - hx, ay - hy, U, L)
  ctx.save(); ctx.translate(hx, hy)
  runLeg(ctx, a.hip, a.bend, a.hip - a.bend + toe, far, c, cover)
  ctx.restore()
}
// an arm through given joints: shoulder, elbow, hand
export function armThrough(ctx, sx, sy, ex, ey, hx, hy, far, c) {
  const skin = far ? shade(c.skin, 0.74) : c.skin
  line(ctx, sx, sy, ex, ey, 6.4 + INK_W, INK); line(ctx, ex, ey, hx, hy, 5.4 + INK_W, INK)
  line(ctx, ex, ey, hx, hy, 5.4, skin)
  line(ctx, lerp(sx, ex, 0.55), lerp(sy, ey, 0.55), ex, ey, 5.8, skin)
  line(ctx, sx, sy, lerp(sx, ex, 0.55), lerp(sy, ey, 0.55), 6.4, far ? shade(c.top, 0.78) : c.top)
  hand(ctx, hx, hy, 3.5, skin)
}
function runArm(ctx, sx, sy, a, e, far, c) {
  const ex = sx + Math.sin(a) * UA, ey = sy + Math.cos(a) * UA
  armThrough(ctx, sx, sy, ex, ey, ex + Math.sin(a + e) * FA, ey + Math.cos(a + e) * FA, far, c)
}
// the torso, in its own frame: y up the spine from the hips, x toward the chest
export function torsoSide(ctx, c) {
  ctx.fillStyle = c.top; ctx.strokeStyle = INK; ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-9, 3); ctx.lineTo(-11, -25); ctx.quadraticCurveTo(0, -38, 11, -25); ctx.lineTo(8.6, 3); ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,.14)'
  ctx.beginPath(); ctx.moveTo(-9, 3); ctx.lineTo(-11, -25); ctx.lineTo(-5, -31); ctx.lineTo(-2.6, 3); ctx.closePath(); ctx.fill()
  ctx.fillStyle = c.pants ?? c.shorts; ctx.strokeStyle = INK; ctx.beginPath(); ctx.roundRect(-9.6, -3, 18.6, 9, 3); ctx.fill(); ctx.stroke()
}

const tiles = new Map()
function tile(view, key, W, H, paint, alpha = false) {
  const id = `${key}|${view.px}`
  let c = tiles.get(id)
  if (!c) {
    if (typeof document === 'undefined') return null
    if (tiles.size > 16) tiles.clear()
    c = document.createElement('canvas')
    c.width = Math.round(W * view.px); c.height = Math.round(H * view.px)
    const x = c.getContext('2d', { alpha })
    x.scale(view.px, view.px)
    paint(x, W, H)
    tiles.set(id, c)
  }
  return c
}
const VENUE_W = 720
function paintVenue(x, W, H, court) {
  // the far side of a big indoor room: dark steel, tiers of seats you can't make out, a lit wall
  const g = x.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, court ? '#07090d' : '#0c1219'); g.addColorStop(0.55, court ? '#11151c' : '#161f28'); g.addColorStop(1, court ? '#1a1f28' : '#1f2b35')
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  // the crowd: small and still, seat by seat
  const wallTop = H - 62
  const shirts = court ? ['#3a4150', '#59616e', '#2b313c', '#7c6a5e', '#c9531e'] : ['#3a4a5a', '#5b6b7a', '#2c3a48', '#7c6a5e', '#2f7fb8']
  let seed = 19
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let y = wallTop - 150, row = 0; y < wallTop - 4; y += 9, row++) {
    x.fillStyle = row % 2 ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.03)'; x.fillRect(0, y, W, 9)
    for (let i = row % 2 ? 3 : 7; i < W - 3; i += 7) {
      if (rnd() < 0.1) continue
      x.fillStyle = shirts[Math.floor(rnd() * shirts.length)]; x.fillRect(i, y + 3.6, 4.6, 4.6)
      x.fillStyle = rnd() < 0.5 ? '#a97f60' : '#6e4a33'; x.fillRect(i + 1, y + 1, 2.6, 2.6)
    }
  }
  x.fillStyle = 'rgba(10,16,24,.5)'; x.fillRect(0, wallTop - 150, W, 150)
  // the wall at the far side of the field, the one thing with colour
  x.fillStyle = court ? '#3a1a0c' : '#102a44'; x.fillRect(0, wallTop, W, 62)
  x.fillStyle = court ? '#ee7a2c' : '#2f7fb8'; x.fillRect(0, wallTop, W, 4); x.fillRect(0, H - 6, W, 3)
  for (const f of [0.25, 0.75]) text(x, 'COMBINE', W * f, wallTop + 31, { font: DISPLAY, size: 22, color: 'rgba(255,255,255,.2)', track: 4 })
}
// Anybody standing about at a drill is the art layer's plain figure, the same one the cone and the
// gauntlet have. x, y: his feet, wherever they are on this flat camera. (Put through a camera that does nothing.)
const FLAT = { w: 360, h: 100 }
export function standAt(ctx, x, y, o) {
  ctx.save(); ctx.translate(x - 180, y - 100)
  athlete(ctx, FLAT, 180, 100, o)
  ctx.restore()
}
export const SCOUT = { color: '#20262c', pants: '#a89a80', kit: 'plain', dir: 'down' }
export const FOLK_SKIN = ['#8d5a3b', '#c09060', '#5e3c22', '#a87548', '#7a5030']
// The whole room, still, for a drill that doesn't travel: hz the far edge of the floor, gy the floor under him
export function paintRoom(x, view, hz, gy, court) {
  // (a drill on a court is in the arena: Crash the Glass's room and floor)
  if (court) { arenaRoom(x, view, { wallY: hz }, view.colors, 'board'); return }
  paintVenue(x, view.w, hz, court)
  paintFloorTile(x, { w: view.w, h: view.h, hz, gy }, court, false)
}
function paintFloorTile(x, cam, court, lanes = true) {
  const { w, h, hz, gy } = cam
  const g = x.createLinearGradient(0, hz, 0, h)
  if (court) { g.addColorStop(0, '#a87543'); g.addColorStop(0.4, '#c8935a'); g.addColorStop(1, '#dbaa72') }
  else { g.addColorStop(0, '#1d6a3b'); g.addColorStop(0.35, '#23793f'); g.addColorStop(1, '#2a8a4a') }
  x.fillStyle = g; x.fillRect(0, hz, w, h - hz)
  if (court) {
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, hz, w, 2)
  } else {
    // turf grain, tight near the far edge
    let y = hz, gap = 1.4
    while (y < h) { x.fillStyle = 'rgba(0,0,0,.055)'; x.fillRect(0, y, w, 1); y += gap; gap *= 1.11 }
    // the lanes he runs between: straight across the frame, this camera is square to them
    if (lanes) for (const q of [0.52, 1.28]) {
      const row = hz + (gy - hz) * q
      x.fillStyle = 'rgba(255,255,255,.86)'; x.fillRect(0, row, w, Math.max(1.5, 3.6 * q))
    }
  }
}

// ── The shot ────────────────────────────────────────────────────────────────
// A camera on a cart behind him, a little off his right shoulder, looking down the lane at his back. The world is
// in yards: X across (0 is his line), Y up, Z down the track. Everything that runs along the track doesn't
// change as the camera tracks along it, so the walls, the lanes and the floor are baked once; only what
// crosses the track (lines, marks, beams, lights) is drawn each frame, as flat shapes in a few batches.
const CAM_H = 4, CAM_D = 7, CAM_SIDE = 0
const NEAR_D = 1.05         // nothing nearer the lens than this
const UY = 50               // the figure's units to a yard: a hundred tall
const C = { F: 400, hz: 300, vx: 230, z: 0, S: 76, gy: 500 }
const X_ = (X, d) => C.vx + (X - CAM_SIDE) * C.F / d
const Y_ = (Y, d) => C.hz + (CAM_H - Y) * C.F / d
function setShot(view) {
  const k = clamp((view.h - 520) / 260, 0, 1)
  C.S = lerp(46, 60, k)
  C.F = C.S * CAM_D
  C.gy = view.h - 96 - lerp(52, 76, k)
  C.hz = Math.round(C.gy - CAM_H * C.S)
  C.vx = Math.round(view.w / 2)
}
const HALLS = {
  // the indoor combine: padded walls down each side and across the end, the one word on the end wall
  forty: { endZ: 54, W: 13, Hc: 9, Hp: 3, floor: '#27803f', apron: '#1c6432' },
  sprint: { endZ: 38, W: 11, Hc: 9, Hp: 3, floor: '#c8935a', apron: '#6d4f38' },
}
const ROOF = '#0e141a', UPPER = '#18212a', PAD = '#102a44', PAD_EDGE = '#2f7fb8', SEAM = '#0a1d31', BEAM = '#080c11'
const WOOD = ['#c8935a', '#c58f56', '#cb975e', '#c28c53', '#cd9a62', '#c79159', '#bf8950']
const LANE = 1.7, HOOP = { keyW: 2.67, ftz: 19 / 3, half: 47 / 3, len: 94 / 3, side: 25 / 3, r: 2, arc: 7.92, arcZ: 1.75 }

function paintHall(x, view, hall, court) {
  const { w } = view, { hz, vx, F } = C, near = 0.6
  const fan = (Xa, Xb, col) => {   // a wedge of floor between two lines along the track
    const xa = vx + (Xa - CAM_SIDE) * F / near, xb = vx + (Xb - CAM_SIDE) * F / near, y = hz + CAM_H * F / near
    x.fillStyle = col; x.beginPath(); x.moveTo(vx, hz); x.lineTo(xa, y); x.lineTo(xb, y); x.closePath(); x.fill()
  }
  const wall = (X, Y0, Y1, col) => {   // a wedge of side wall between two heights
    const xx = vx + (X - CAM_SIDE) * F / near
    x.fillStyle = col; x.beginPath(); x.moveTo(vx, hz); x.lineTo(xx, hz + (CAM_H - Y0) * F / near); x.lineTo(xx, hz + (CAM_H - Y1) * F / near); x.closePath(); x.fill()
  }
  x.fillStyle = ROOF; x.fillRect(0, 0, w, hz + 1)
  for (const X of [-hall.W, hall.W]) { wall(X, -0.1, hall.Hc, UPPER); wall(X, -0.1, hall.Hp, PAD); wall(X, hall.Hp, hall.Hp + 0.12, PAD_EDGE) }
  fan(-hall.W, hall.W, hall.apron)
  if (court) {
    const S = HOOP.side
    let seed = 41
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let X = -S; X < S; X += 0.26) fan(X, X + 0.28, WOOD[Math.floor(rnd() * WOOD.length)])
    fan(-S - 0.09, -S + 0.09, '#f5f1e8'); fan(S - 0.09, S + 0.09, '#f5f1e8')
  } else {
    fan(-11, 11, hall.floor)
    fan(-LANE, LANE, '#2c8c47')
  }
  x.fillStyle = '#05080b'; x.fillRect(0, 0, w, 44)
}
function paintWord(x, W, H) { text(x, 'COMBINE', W / 2, H / 2 + 1, { font: DISPLAY, size: H * 0.8, color: 'rgba(255,255,255,.26)', track: H * 0.1 }) }
// what goes by on the walls: the seams in the side walls and the steel overhead; and the end wall, coming up
function wallsGoBy(ctx, view, hall) {
  const { W, Hc, Hp, endZ } = hall, { w } = view
  ctx.save(); ctx.beginPath(); ctx.rect(0, 44, w, view.h - 44); ctx.clip()
  ctx.fillStyle = BEAM
  ctx.beginPath()
  for (let Z = Math.ceil((C.z + 5) / 7) * 7; Z < endZ; Z += 7) {
    const d = Z - C.z, y = Y_(Hc, d), th = Math.max(0.7, 0.2 * C.F / d)
    if (y > 44) ctx.rect(X_(-W, d), y - th, X_(W, d) - X_(-W, d), th * 2)
  }
  ctx.fill()
  ctx.fillStyle = SEAM
  ctx.beginPath()
  for (let Z = Math.ceil((C.z + 5) / 4) * 4; Z < endZ; Z += 4) {
    const d = Z - C.z, wd = Math.max(0.8, 0.14 * C.F / d), top = Y_(Hc, d), bot = Y_(0, d)
    for (const X of [-W, W]) { const xx = X_(X, d); if (xx > -2 && xx < w + 2) ctx.rect(xx - wd / 2, top, wd, bot - top) }
  }
  ctx.fill()
  const de = endZ - C.z, x0 = X_(-W, de), x1 = X_(W, de), top = Y_(Hc, de), pad = Y_(Hp, de), bot = Y_(0, de)
  ctx.fillStyle = UPPER; ctx.fillRect(x0, top, x1 - x0, pad - top)
  ctx.fillStyle = PAD; ctx.fillRect(x0, pad, x1 - x0, bot - pad)
  ctx.fillStyle = PAD_EDGE; ctx.fillRect(x0, pad - Math.max(0.7, 0.06 * C.F / de), x1 - x0, Math.max(1.4, 0.12 * C.F / de))
  const word = tile(view, 'dash-word', 300, 50, (x, W2, H2) => paintWord(x, W2, H2), true)
  if (word) { const s = C.F / de, ww = 15 * s, wh = 2.5 * s; ctx.drawImage(word, (x0 + x1) / 2 - ww / 2, Y_(7.8, de), ww, wh) }
  ctx.restore()
}

// ── What goes by ────────────────────────────────────────────────────────────
// a line across the floor, from X0 to X1, at Z: never thinner than a pixel, however far off
function lineAcross(ctx, Z, wYd, X0, X1) {
  const d = Z - C.z
  if (d < NEAR_D) return
  const row = Y_(0, d), th = Math.max(0.55, 0.5 * wYd * CAM_H * C.F / (d * d))
  const a = X_(X0, d), b = X_(X1, d)
  ctx.rect(a, row - th, b - a, th * 2)
}
function floorQuad(ctx, X0, X1, Z0, Z1) {
  const d0 = Math.max(Z0 - C.z, NEAR_D), d1 = Z1 - C.z
  if (d1 <= d0) return
  ctx.moveTo(X_(X0, d0), Y_(0, d0)); ctx.lineTo(X_(X1, d0), Y_(0, d0)); ctx.lineTo(X_(X1, d1), Y_(0, d1)); ctx.lineTo(X_(X0, d1), Y_(0, d1)); ctx.closePath()
}
// a ring on the floor, as much of it as is in front of the lens. arc: its share of a circle, opening back toward z = cz
function floorRing(ctx, cz, r, wYd, from = 0, to = Math.PI * 2, n = 44) {
  const ri = r - wYd
  let open = false
  const pts = (rr, rev) => {
    for (let i = 0; i <= n; i++) {
      const a = lerp(from, to, (rev ? n - i : i) / n), d = Math.max(cz + Math.cos(a) * rr - C.z, 0.35), X = Math.sin(a) * rr
      const sx = X_(X, d), sy = Y_(0, d)
      if (open) ctx.lineTo(sx, sy); else { ctx.moveTo(sx, sy); open = true }
    }
  }
  pts(r, false); pts(ri, true); ctx.closePath()
}
function turfGoesBy(ctx, g, hall) {
  const zEnd = hall.endZ
  // mown bands, five yards each
  ctx.fillStyle = 'rgba(8,40,18,.2)'
  ctx.beginPath()
  for (let Z = Math.floor(C.z / 10) * 10 - 5; Z < zEnd; Z += 10) floorQuad(ctx, -11, 11, Z, Math.min(Z + 5, zEnd))
  ctx.fill()
  // the yard lines: every five right across, with the lane's yard ticks between
  ctx.fillStyle = '#f4f6f2'
  ctx.beginPath()
  floorQuad(ctx, -LANE - 0.06, -LANE + 0.06, C.z, zEnd); floorQuad(ctx, LANE - 0.06, LANE + 0.06, C.z, zEnd)
  floorQuad(ctx, -11.1, -10.9, C.z, zEnd); floorQuad(ctx, 10.9, 11.1, C.z, zEnd)
  for (let Z = Math.max(0, Math.ceil(C.z / 5) * 5); Z <= g.dist + 10; Z += 5) if (Z !== g.dist) lineAcross(ctx, Z, Z === 0 ? 0.22 : 0.12, -11, 11)
  for (let Z = Math.max(1, Math.ceil(C.z)); Z < Math.min(zEnd, C.z + 22); Z++) {
    if (Z % 5 === 0) continue
    lineAcross(ctx, Z, 0.09, -LANE - 0.45, -LANE); lineAcross(ctx, Z, 0.09, LANE, LANE + 0.45)
  }
  ctx.fill()
}
function courtGoesBy(ctx, g) {
  const { side: S, keyW, ftz, half, len, r, arc, arcZ } = HOOP
  // the paint at each end
  ctx.fillStyle = '#1c3f6e'
  ctx.beginPath(); floorQuad(ctx, -keyW, keyW, -0.11, ftz); floorQuad(ctx, -keyW, keyW, len - ftz, len); ctx.fill()
  // half court, the baselines, the free-throw lines, and the circles
  ctx.fillStyle = '#f5f1e8'
  ctx.beginPath()
  lineAcross(ctx, 0, 0.22, -S, S); lineAcross(ctx, len, 0.14, -S, S); lineAcross(ctx, half, 0.14, -S, S)
  lineAcross(ctx, ftz, 0.12, -keyW, keyW)
  // (the far foul line is the finish: it's drawn in gold)
  floorQuad(ctx, -keyW - 0.06, -keyW + 0.06, -0.11, ftz); floorQuad(ctx, keyW - 0.06, keyW + 0.06, -0.11, ftz)
  floorQuad(ctx, -keyW - 0.06, -keyW + 0.06, len - ftz, len); floorQuad(ctx, keyW - 0.06, keyW + 0.06, len - ftz, len)
  floorRing(ctx, half, r, 0.12)
  floorRing(ctx, ftz, r, 0.12)
  floorRing(ctx, len - ftz, r, 0.12)
  // the threes, each opening toward its own baseline
  floorRing(ctx, arcZ, arc, 0.12, -1.25, 1.25)
  floorRing(ctx, len - arcZ, arc, 0.12, Math.PI - 1.25, Math.PI + 1.25)
  ctx.fill('nonzero')
}
// The numbers on the turf. Each is plain block shapes put corner by corner through the same lens as the floor, every
// frame, from where the camera is: pinned to the turf, with nothing to tear and nothing to cull. They leave by going off
// the screen. [x0, v0, x1, v1]: in a digit a yard and a half wide, v from its near edge to its far edge
const T = 0.3, T2 = 0.65, T3 = 0.95, TOP = 1.3
const DIGITS = {
  0: [[0, 0, T, 1.6], [0.7, 0, 1, 1.6], [0, TOP, 1, 1.6], [0, 0, 1, T]],
  1: [[0.35, 0, 0.7, 1.6], [0.08, 1.22, 0.4, 1.6]],
  2: [[0, TOP, 1, 1.6], [0.7, T2, 1, 1.6], [0, T2, 1, T3], [0, 0, T, T3], [0, 0, 1, T]],
  3: [[0, TOP, 1, 1.6], [0, 0, 1, T], [0.2, T2, 1, T3], [0.7, 0, 1, 1.6]],
  4: [[0, T2, T, 1.6], [0, T2, 1, T3], [0.7, 0, 1, 1.6]],
}
const NUM_W = 1.5, NUM_D = 2.6    // a yard and a half wide; v runs 0 to 1.6 down four yards of turf
function numberOnTurf(ctx, Xc, Zc, str) {
  const dig = str.length, gap = 0.45, total = dig * NUM_W + (dig - 1) * gap
  const z0 = Zc - 0.8 * NUM_D - C.z
  if (z0 + 1.6 * NUM_D < 0.6) return                 // (behind the lens)
  for (let i = 0; i < dig; i++) {
    const X0 = Xc - total / 2 + i * (NUM_W + gap), rects = DIGITS[str[i]]
    for (let k = 0; k < rects.length; k++) {
      const r = rects[k]
      const da = Math.max(z0 + r[1] * NUM_D, 0.6), db = Math.max(z0 + r[3] * NUM_D, 0.6), xa = X0 + r[0] * NUM_W, xb = X0 + r[2] * NUM_W
      ctx.moveTo(X_(xa, da), Y_(0, da)); ctx.lineTo(X_(xb, da), Y_(0, da)); ctx.lineTo(X_(xb, db), Y_(0, db)); ctx.lineTo(X_(xa, db), Y_(0, db)); ctx.closePath()
    }
  }
}
// a timing gate: one post a side, an eye on it. Dark until he breaks the beam
function gatePost(ctx, g, X, Z, finish) {
  const d = Z - C.z
  if (d < NEAR_D) return
  const s = C.F / d, xx = X_(X, d), base = Y_(0, d), topY = Y_(finish ? 1.5 : 1.15, d), w = Math.max(1.2, 0.05 * s)
  ctx.fillStyle = '#14181c'
  ctx.fillRect(xx - w / 2, topY, w, base - topY)
  ctx.fillRect(xx - 0.18 * s, base - Math.max(1, 0.03 * s), 0.36 * s, Math.max(1.5, 0.05 * s))
  const bw = 0.26 * s, bh = 0.18 * s
  ctx.fillRect(xx - bw / 2 - 0.5, topY - bh - 0.5, bw + 1, bh + 1)
  const lit = g.y >= Z
  ctx.fillStyle = finish ? GOLD : '#e9edf0'
  ctx.fillRect(xx - bw / 2, topY - bh, bw, bh)
  ctx.fillStyle = lit ? GOOD : BAD
  ctx.fillRect(xx - bw * 0.2, topY - bh * 0.75, bw * 0.4, bh * 0.5)
}

// ── The starter ─────────────────────────────────────────────────────────────
// Painted once, twice over: his arm up, then down. He's one more thing going by
const STARTER = { color: '#20262c', pants: '#a89a80', skin: '#6d4229', kit: 'plain', dir: 'down', size: 1.62 }
const STARTER_W = 90, STARTER_H = 120, STARTER_FOOT = 112, STARTER_TALL = 76
function drawStarter(ctx, g, view) {
  const Z = 6, X = 3.2, d = Z - C.z
  if (d < NEAR_D + 0.6) return
  const gone = g.goAt != null && g.t - g.goAt > 460
  const up = !gone
  const img = tile(view, `dash-starter-${up ? 1 : 0}-${g.S.gun}`, STARTER_W, STARTER_H, x => {
    standAt(x, STARTER_W / 2, STARTER_FOOT, { ...STARTER, pose: up ? 'reach-r' : undefined })
    if (up && g.S.gun === 'gun') { x.fillStyle = '#10141a'; x.fillRect(STARTER_W / 2 + 21, STARTER_FOOT - 80, 3, 9) }
  }, true)
  const s = (C.F / d) * 2 / STARTER_TALL, sx = X_(X, d), fy = Y_(0, d)
  if (sx > view.w + 90 * s) return
  if (img) ctx.drawImage(img, sx - STARTER_W / 2 * s, fy - STARTER_FOOT * s, STARTER_W * s, STARTER_H * s)
  // the gun: a flash, then a little smoke. Nothing else marks it but the sound and the word
  if (g.goAt != null && g.S.gun === 'gun' && g.t - g.goAt < 380) {
    const a = (g.t - g.goAt) / 380, fx = sx + 22.5 * s, fyy = fy - 83 * s
    if (a < 0.22) {
      ctx.fillStyle = GOLD; ctx.beginPath()
      for (let q = 0; q < 12; q++) { const r = (q % 2 ? 3 : 8) * Math.max(s, 0.8), an = (q / 12) * Math.PI * 2; ctx.lineTo(fx + Math.cos(an) * r, fyy + Math.sin(an) * r) }
      ctx.closePath(); ctx.fill()
    } else { ctx.fillStyle = 'rgba(226,232,238,.55)'; circle(ctx, fx, fyy - a * 10, 3 + a * 9); ctx.fill() }
  }
}

// ── The sprinter, from behind ───────────────────────────────────────────────
// A real figure in three dimensions: joints worked out in his own frame (x across him, y up, z the way he's
// going, in units of a hundred to his height), put through the same lens as the floor, then drawn back to front.
const HIP_L = 0, HIP_R = 1, KNEE_L = 2, KNEE_R = 3, ANK_L = 4, ANK_R = 5, TOE_L = 6, TOE_R = 7, HEEL_L = 8, HEEL_R = 9
const SH_L = 10, SH_R = 11, EL_L = 12, EL_R = 13, HA_L = 14, HA_R = 15, NECK = 16, HEAD = 17, WA_L = 18, WA_R = 19, NJ = 20
const R_U = 23.5, R_L = 23.5, R_T = 35, R_UA = 16, R_FA = 14.5, R_FOOT = 12, R_HEEL = 4
// The three-point, as this camera needs it: a long flat back, hips no higher than his shoulders, so what you see is his
// back and not his seat. The right hand a post on the line, the right leg long behind him, the left foot under him, the
// left hand back at the knee, eyes up the track
const SET_POSE = new Float64Array([
  -3.8, 31, -8, 3.8, 31, -8,    // hips
  -7, 25, 11, 7, 20, -15,       // knees
  -7, 4.5, 4, 7, 5.5, -30,      // ankles
  -7, 1.5, 15, 7, 1.5, -20,     // toes
  -7, 2, 0, 7, 4.5, -34,        // heels
  -12.5, 37, 25, 11.5, 35, 25,  // shoulders
  -18, 19, 26, 18, 19, 26,      // elbows
  -19, 2.5, 28, 19, 2.5, 28,    // hands
  0, 39, 30,                    // neck
  0, 43, 39,                    // head
  -7, 33, -3, 7, 33, -3,        // waist
])
const J = new Float64Array(NJ * 3), RUN = new Float64Array(NJ * 3)   // (J: his joints' depth, for the drawing order)
// the screen: x, y, and how many pixels a unit is, there
const SX = new Float64Array(NJ), SY = new Float64Array(NJ), SK = new Float64Array(NJ)
const put = (a, i, x, y, z) => { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z }
const gaitAt = (T, q) => { const f = q * N, i = Math.floor(f), a = T[i % N], b = T[(i + 1) % N]; return a + (b - a) * (f - i) }
const smooth = f => f * f * (3 - 2 * f)

function runPose(g, rise, rest, breath, out) {
  const near = ((g.cycle % 1) + 1) % 1, far = (near + 0.5) % 1
  const amp = 1 - rest
  const legRel = (side, q) => {
    const h = lerp(side < 0 ? 0.05 : -0.05, gaitAt(GH, q), amp), b = lerp(0.1, gaitAt(GK, q), amp), a = lerp(0, gaitAt(GA, q), amp)
    return { h, sa: h - b, fa: -(h - b) + a }
  }
  const R = legRel(1, near), Lf = legRel(-1, far)
  const lowest = o => {
    const ay = -Math.cos(o.h) * R_U - Math.cos(o.sa) * R_L
    return Math.min(ay + Math.sin(o.fa) * -R_FOOT, ay + Math.sin(o.fa) * R_HEEL) - 3.4
  }
  const reach = -Math.min(lowest(R), lowest(Lf))
  const floorH = lerp(lerp(38, 43, rise), 0, rest)
  const hipY = Math.max(reach, floorH)
  const lean = lerp(lerp(0.95, 0.5, rise), 0.09, rest)
  const tw = Math.cos(near * Math.PI * 2) * amp       // + as the right leg's going back
  const yawS = tw * 0.14, yawH = -tw * 0.07, rollS = tw * 1.8
  const sl = Math.sin(lean), cl = Math.cos(lean)
  const legOut = (side, o, hi, ki, ai, ti, ei) => {
    const hx = side * 4.6 * Math.cos(yawH), hz = side * 4.6 * Math.sin(yawH)
    const kz = hz + Math.sin(o.h) * R_U, ky = hipY - Math.cos(o.h) * R_U
    const az = kz + Math.sin(o.sa) * R_L, ay = ky - Math.cos(o.sa) * R_L
    const ax = side * lerp(5.2, 6.4, rest), dz = Math.cos(o.fa), dy = -Math.sin(o.fa)
    put(out, hi, hx, hipY, hz); put(out, ki, side * lerp(5.2, 5.6, rest), ky, kz); put(out, ai, ax, ay, az)
    put(out, ti, ax, ay + dy * R_FOOT - 2, az + dz * R_FOOT); put(out, ei, ax, ay - dy * R_HEEL - 2, az - dz * R_HEEL)
  }
  legOut(1, R, HIP_R, KNEE_R, ANK_R, TOE_R, HEEL_R)
  legOut(-1, Lf, HIP_L, KNEE_L, ANK_L, TOE_L, HEEL_L)
  put(out, WA_L, -7 * Math.cos(yawH), hipY + cl * 3.5, sl * 3.5 - 7 * Math.sin(yawH))
  put(out, WA_R, 7 * Math.cos(yawH), hipY + cl * 3.5, sl * 3.5 + 7 * Math.sin(yawH))
  const by = breath * 1.5, bx = 0
  const shY = hipY + cl * R_T + by, shZ = sl * R_T
  put(out, SH_L, bx - 13 * Math.cos(yawS), shY + rollS, shZ - 13 * Math.sin(yawS))
  put(out, SH_R, bx + 13 * Math.cos(yawS), shY - rollS, shZ + 13 * Math.sin(yawS))
  put(out, NECK, bx, shY + 3, shZ + sl * 3)
  // his head stays up whatever his back is doing
  const hl = lean * 0.75
  put(out, HEAD, bx, shY + 3 + Math.cos(hl) * 12 + breath * 0.4, shZ + sl * 3 + Math.sin(hl) * 12)
  // the arms, straight fore and aft with the elbows near his ribs: the hand up at the chest, then the elbow well behind him
  const big = lerp(0.8, 1.25, clamp(g.speed / 5, 0, 1)) * amp
  const armOut = (side, q, si, ei, hi) => {
    const s = Math.cos((q - 0.02) * Math.PI * 2)
    const a = lerp(-0.02, -0.26 + s * big * 0.82 + lean * 0.3, amp), e = lerp(0.3, s > 0 ? lerp(1.7, 2.2, s) : lerp(1.7, 1.45, -s), amp)
    const sx = out[si * 3], sy = out[si * 3 + 1], sz = out[si * 3 + 2]
    const ey = sy - Math.cos(a) * R_UA, ez = sz + Math.sin(a) * R_UA
    const ex = side * lerp(14.8, 17, amp)
    const hy = ey - Math.cos(a + e) * R_FA, hz = ez + Math.sin(a + e) * R_FA
    const inward = clamp(Math.sin(a + e) * 0.9 + 0.2, 0, 1) * amp
    put(out, ei, ex, ey, ez); put(out, hi, side * lerp(lerp(14, 15, amp), 11, inward), hy, hz)
  }
  armOut(1, near, SH_R, EL_R, HA_R)
  armOut(-1, far, SH_L, EL_L, HA_L)
  return hipY
}
const ink = INK, OUTLINE = 1.15
function bone(ctx, a, b, ra, rb, col, grow = 0) {
  ctx.fillStyle = col
  taper(ctx, SX[a], SY[a], ra * SK[a] + grow, SX[b], SY[b], rb * SK[b] + grow)
}
const mixTo = (a, b, f) => a + (b - a) * f
// a limb bone part of the way along: from joint a, f of the way to b
function boneTo(ctx, a, b, f, ra, rb, col, grow = 0) {
  ctx.fillStyle = col
  taper(ctx, SX[a], SY[a], ra * SK[a] + grow, mixTo(SX[a], SX[b], f), mixTo(SY[a], SY[b], f), rb * mixTo(SK[a], SK[b], f) + grow)
}
function drawThigh(ctx, leg, c, court) {
  const { hip, knee } = leg
  bone(ctx, hip, knee, 3.7, 4, c.skin)
  // the shorts, cut square at the hem
  const f = court ? 0.8 : 0.66
  boneTo(ctx, hip, knee, f, 3.7, 4.6, c.shorts)
  ctx.strokeStyle = court ? c.trim : '#3a424a'; ctx.lineWidth = Math.max(1, 0.9 * SK[hip]); ctx.lineCap = 'butt'
  const dx = SX[knee] - SX[hip], dy = SY[knee] - SY[hip], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, r = 4.6 * SK[hip]
  const mx = mixTo(SX[hip], SX[knee], f), my = mixTo(SY[hip], SY[knee], f)
  ctx.beginPath(); ctx.moveTo(mx + nx * r, my + ny * r); ctx.lineTo(mx - nx * r, my - ny * r); ctx.stroke(); ctx.lineCap = 'round'
}
function inkThigh(ctx, leg) { bone(ctx, leg.hip, leg.knee, 3.7, 4.2, ink, OUTLINE) }
function inkShin(ctx, leg) {
  bone(ctx, leg.knee, leg.ank, 4.2, 2.7, ink, OUTLINE)
  bone(ctx, leg.heel, leg.toe, 3.1, 2.6, ink, OUTLINE)
}
function drawShin(ctx, leg, c) {
  const { knee, ank, heel, toe } = leg
  bone(ctx, knee, ank, 4.2, 2.7, c.skin)
    // the sock, then the shoe with its pale sole underneath
  ctx.fillStyle = c.sock
  taper(ctx, mixTo(SX[knee], SX[ank], 0.72), mixTo(SY[knee], SY[ank], 0.72), 3 * SK[ank], SX[ank], SY[ank], 2.8 * SK[ank])
  bone(ctx, heel, toe, 3.1, 2.6, c.shoe)
  ctx.strokeStyle = c.sole; ctx.lineWidth = Math.max(1, 1.3 * SK[heel]); ctx.beginPath()
  const fx = SX[toe] - SX[heel], fy = SY[toe] - SY[heel], fl = Math.hypot(fx, fy) || 1, nx = -fy / fl, ny = fx / fl, sg = 2.1
  ctx.moveTo(SX[heel] + nx * sg * SK[heel], SY[heel] + ny * sg * SK[heel]); ctx.lineTo(SX[toe] + nx * sg * SK[toe], SY[toe] + ny * sg * SK[toe]); ctx.stroke()
}
// the forearm and hand, and the upper arm with its sleeve: apart, because a hand out in front of him goes behind his back
function drawForearm(ctx, el, ha, c) {
  bone(ctx, el, ha, 3.2, 2.4, ink, OUTLINE)
  ctx.beginPath(); ctx.arc(SX[ha], SY[ha], 3 * SK[ha] + OUTLINE, 0, 6.3); ctx.fill()
  bone(ctx, el, ha, 3.2, 2.4, c.skin)
  ctx.beginPath(); ctx.arc(SX[ha], SY[ha], 3 * SK[ha], 0, 6.3); ctx.fill()
}
function drawUpperArm(ctx, sh, el, c) {
  bone(ctx, sh, el, 4.1, 3.3, ink, OUTLINE)
  bone(ctx, sh, el, 3.8, 3.2, c.skin)
  boneTo(ctx, sh, el, 0.58, 4.2, 3.8, c.top)
}
// his back, shoulders to waist, one flat shape; the shirt in shade down the side away from the lights
function drawBack(ctx, c, court) {
  const nx = SX[NECK], ny = SY[NECK], k = SK[NECK]
  const trace = () => {
    ctx.beginPath()
    ctx.moveTo(SX[WA_L], SY[WA_L])
    ctx.quadraticCurveTo(lerp(SX[WA_L], SX[SH_L], 0.5) - 1.8 * k, lerp(SY[WA_L], SY[SH_L], 0.5), SX[SH_L] + 1 * k, SY[SH_L] + 1 * k)
    ctx.quadraticCurveTo(SX[SH_L] + 3 * k, SY[SH_L] - 4.6 * k, nx - 5 * k, ny - 3 * k)
    ctx.lineTo(nx + 5 * k, ny - 3 * k)
    ctx.quadraticCurveTo(SX[SH_R] - 3 * k, SY[SH_R] - 4.6 * k, SX[SH_R] - 1 * k, SY[SH_R] + 1 * k)
    ctx.quadraticCurveTo(lerp(SX[WA_R], SX[SH_R], 0.5) + 1.8 * k, lerp(SY[WA_R], SY[SH_R], 0.5), SX[WA_R], SY[WA_R])
    ctx.closePath()
  }
  trace()
  ctx.fillStyle = c.top; ctx.strokeStyle = ink; ctx.lineWidth = OUTLINE; ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke()
  // the shade, and the crease his shoulder blades make with each arm
  ctx.fillStyle = c.topD
  ctx.beginPath()
  const mw = lerp(SX[WA_L], SX[WA_R], 0.66), mwy = lerp(SY[WA_L], SY[WA_R], 0.66), ms = lerp(SX[SH_L], SX[SH_R], 0.72), msy = lerp(SY[SH_L], SY[SH_R], 0.72)
  ctx.moveTo(mw, mwy); ctx.lineTo(SX[WA_R], SY[WA_R]); ctx.lineTo(SX[SH_R] - 1 * k, SY[SH_R] + 1 * k); ctx.lineTo(ms, msy); ctx.closePath(); ctx.fill()
  // the collar
  ctx.strokeStyle = court ? c.trim : c.topD; ctx.lineWidth = Math.max(1, 1.5 * k); ctx.beginPath()
  ctx.moveTo(nx - 5 * k, ny - 2.4 * k); ctx.quadraticCurveTo(nx, ny + 0.6 * k, nx + 5 * k, ny - 2.4 * k); ctx.stroke()
}
function drawPelvis(ctx, c, court, band) {
  // (no line: this sits over the tops of his thighs and joins them up)
  ctx.fillStyle = c.shorts
  taper(ctx, SX[HIP_L], SY[HIP_L], 3.4 * SK[HIP_L], SX[HIP_R], SY[HIP_R], 3.4 * SK[HIP_R])
  // from the shirt's hem down into both thighs, one plain shape
  const fx = (j, k, f) => mixTo(SX[j], SX[k], f), fy = (j, k, f) => mixTo(SY[j], SY[k], f)
  ctx.beginPath(); ctx.moveTo(SX[WA_L], SY[WA_L]); ctx.lineTo(SX[WA_R], SY[WA_R]); ctx.lineTo(fx(HIP_R, KNEE_R, 0.3), fy(HIP_R, KNEE_R, 0.3)); ctx.lineTo(fx(HIP_L, KNEE_L, 0.3), fy(HIP_L, KNEE_L, 0.3)); ctx.closePath(); ctx.fill()
  if (band < 0.6) return
  // the waistband
  ctx.fillStyle = court ? c.trim : c.shortsD
  ctx.beginPath()
  const bw = 2 * SK[WA_L]
  ctx.moveTo(SX[WA_L] - 0.8 * SK[WA_L], SY[WA_L] + bw * 0.2); ctx.lineTo(SX[WA_R] + 0.8 * SK[WA_R], SY[WA_R] + bw * 0.2); ctx.lineTo(SX[WA_R] + 0.8 * SK[WA_R], SY[WA_R] + bw * 1.1); ctx.lineTo(SX[WA_L] - 0.8 * SK[WA_L], SY[WA_L] + bw * 1.1); ctx.closePath(); ctx.fill()
}
function drawHead(ctx, c) {
  const k = SK[HEAD], hx = SX[HEAD], hy = SY[HEAD], r = 8.3 * k
  bone(ctx, NECK, HEAD, 4.2, 3.8, ink, OUTLINE)
  bone(ctx, NECK, HEAD, 4.2, 3.8, c.skinD)
  ctx.fillStyle = c.skin; ctx.strokeStyle = ink; ctx.lineWidth = OUTLINE * 1.6
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.3); ctx.fill(); ctx.stroke()
  // close-cut hair over the back of it, the neck showing under
  ctx.fillStyle = c.hair
  ctx.beginPath(); ctx.arc(hx, hy, r - 0.4, 0.55, Math.PI - 0.55, true); ctx.quadraticCurveTo(hx, hy + r * 0.74, hx + (r - 0.4) * Math.cos(0.55), hy + (r - 0.4) * Math.sin(0.55)); ctx.closePath(); ctx.fill()
}
const LEG_L = { hip: HIP_L, knee: KNEE_L, ank: ANK_L, toe: TOE_L, heel: HEEL_L }
const LEG_R = { hip: HIP_R, knee: KNEE_R, ank: ANK_R, toe: TOE_R, heel: HEEL_R }
// how far round from dead behind he's turned, on top of the camera being off to his side: more in the stance, so you can read it
const YAW_SET = 0, YAW_RUN = 0
const BODY_DEPTH = 0.5   // (the figure is drawn through a longer lens than the floor: at full perspective a foot behind him drops down the screen and he looks to be running uphill)
const VIEW_S = CAM_SIDE / Math.hypot(CAM_SIDE, CAM_D), VIEW_C = CAM_D / Math.hypot(CAM_SIDE, CAM_D)
function drawRunner(ctx, g, view, c, court) {
  const firstAt = g.firstPress
  const up = firstAt == null ? 0 : smooth(prog(g.t, firstAt, firstAt + 300))
  const rise = smooth(clamp(g.y / (court ? 11 : 14), 0, 1))
  // slowing, or stopped: the stride dies away to a man standing, breathing
  const late = firstAt == null ? 0 : g.done ? 1 : prog(g.t, firstAt + 700, firstAt + 1100)
  let rest = late * (1 - smooth(prog(g.speed, 1.4, 5.2)))
  if (firstAt == null) rest = 1
  const breath = rest * Math.sin(g.t / 300)
  runPose(g, rise, rest, breath, RUN)
  // a false start: up and forward off the line, and back down into it
  let mix = up, off = lerp(-0.56, 0, up), yaw = lerp(YAW_SET, YAW_RUN, up)
  const fsAge = g.t - g.fsAt
  if (fsAge < RESET && firstAt == null) {
    const q = fsAge < 200 ? easeOut(fsAge / 200) : 1 - easeOut((fsAge - 200) / (RESET - 200))
    mix = q * 0.75; off = lerp(-0.56, -0.1, q)
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw)
  for (let i = 0; i < NJ * 3; i += 3) {
    const x = lerp(SET_POSE[i], RUN[i], mix), y = lerp(SET_POSE[i + 1], RUN[i + 1], mix), z = lerp(SET_POSE[i + 2], RUN[i + 2], mix)
    const wx = x * cy + z * sy, wz = z * cy - x * sy
    const d = C.camD + off + (wz / UY) * BODY_DEPTH, s = C.F / d
    const n = i / 3
    SX[n] = X_(wx / UY, d); SY[n] = Y_(y / UY, d); SK[n] = s / UY
    J[i + 2] = wz * VIEW_C - wx * VIEW_S
  }
  // his shadow, tight under him: the room's lit from everywhere
  const d0 = C.camD + off, sk = C.F / d0
  ctx.fillStyle = court ? 'rgba(40,18,4,.34)' : 'rgba(0,22,8,.36)'
  ctx.beginPath(); ctx.ellipse(X_(0, d0), Y_(0, d0), 0.38 * sk, 0.09 * sk, 0, 0, Math.PI * 2); ctx.fill()

  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // back to front, from the lens: an arm or a leg ahead of his back goes behind it. A shin folded up behind the thigh goes over it
  const depth = i => J[i * 3 + 2]
  const folded = leg => depth(leg.ank) < depth(leg.knee) - 2
  const backD = (depth(SH_L) + depth(SH_R) + depth(WA_L) + depth(WA_R)) / 4
  const aheadL = depth(HA_L) > backD, aheadR = depth(HA_R) > backD
  if (aheadL) drawForearm(ctx, EL_L, HA_L, c)
  if (aheadR) drawForearm(ctx, EL_R, HA_R, c)
  const first = depth(KNEE_L) > depth(KNEE_R) ? LEG_L : LEG_R, second = first === LEG_L ? LEG_R : LEG_L
  for (const leg of [first, second]) {
    inkThigh(ctx, leg); inkShin(ctx, leg)
    if (!folded(leg)) drawShin(ctx, leg, c)
    drawThigh(ctx, leg, c, court)
  }
  drawBack(ctx, c, court)
  drawHead(ctx, c)
  drawPelvis(ctx, c, court, mix)
  for (const leg of [first, second]) if (folded(leg)) { inkShin(ctx, leg); drawShin(ctx, leg, c) }
  if (!aheadL) drawForearm(ctx, EL_L, HA_L, c)
  if (!aheadR) drawForearm(ctx, EL_R, HA_R, c)
  drawUpperArm(ctx, SH_L, EL_L, c)
  drawUpperArm(ctx, SH_R, EL_R, c)
}

// ── A frame ─────────────────────────────────────────────────────────────────
export function draw(ctx, g, view) {
  const { w, h } = view
  const court = g.game === 'sprint'
  const hall = HALLS[court ? 'sprint' : 'forty']
  setShot(view)
  // the camera's on a cart: back a little for the stance, in as he gets going. He pulls away from it at speed, and it catches him as he slows
  C.camD = CAM_D * (1 + 0.01 * g.speed + 0.12 * (1 - smooth(prog(g.y, 0, 5))))
  C.z = g.y - C.camD
  // ── the room and the floor, baked; the seams and the end wall going by ──
  const base = tile(view, `dash-hall-${g.game}-${h}`, w, h, x => paintHall(x, view, hall, court))
  if (base) ctx.drawImage(base, 0, 0, w, h)
  wallsGoBy(ctx, view, hall)
  // ── the floor going by ──
  if (court) courtGoesBy(ctx, g)
  else {
    turfGoesBy(ctx, g, hall)
    ctx.fillStyle = '#f4f6f2'
    ctx.beginPath()
    for (let Z = 10; Z <= g.dist; Z += 10) { const str = String(Z); numberOnTurf(ctx, -5.6, Z, str); numberOnTurf(ctx, 5.6, Z, str) }
    ctx.fill()
  }
  // the start line's on the floor already; the finish is gold, wide, and you can see it the whole way
  ctx.fillStyle = GOLD
  ctx.beginPath(); lineAcross(ctx, g.dist, 0.5, court ? -HOOP.keyW : -LANE - 0.9, court ? HOOP.keyW : LANE + 0.9); ctx.fill()
  // ── gates, and whoever's on the track ──
  const gates = court ? GATES_COURT : GATES_TURF
  drawStarter(ctx, g, view)
  for (let i = 0; i < gates.length; i++) if (gates[i] > g.y + 0.3) { gatePost(ctx, g, -LANE - 0.5, gates[i], gates[i] === g.dist); gatePost(ctx, g, LANE + 0.5, gates[i], gates[i] === g.dist) }
  const c = court ? GEAR_NBA : GEAR
  drawRunner(ctx, g, view, c, court)
  for (let i = 0; i < gates.length; i++) if (gates[i] <= g.y + 0.3) { gatePost(ctx, g, -LANE - 0.5, gates[i], gates[i] === g.dist); gatePost(ctx, g, LANE + 0.5, gates[i], gates[i] === g.dist) }

  drawClock(ctx, g, view)
  // the live words up on the wall, clear of him. The result lands where it does in every game
  const wordY = Math.max(lerp(96, C.hz, 0.46), 130)
  placeStamp(g.stamp, view)
  if (g.phase === 'set' && g.t >= g.fsAt + RESET) {
    text(ctx, 'SET', w / 2, wordY, { font: DISPLAY, size: 46, color: '#fff' })
  } else if (g.phase === 'run' && !g.done && g.t - g.goAt < 420) {
    const a = g.t - g.goAt
    const q = 1 + 0.4 * (1 - easeOut(clamp(a / 110, 0, 1)))
    ctx.save(); ctx.translate(w / 2, wordY); ctx.scale(q, q)
    text(ctx, 'GO', 0, 0, { font: DISPLAY, size: 62, color: GOLD })
    ctx.restore()
  }
}
const GATES_TURF = [10, 20, 40], GATES_COURT = [10, 25]
// The slab every timed drill has: across the top under the title, the digits in fixed slots so they
// can't jitter, and a thin bar along the bottom of it for how far along it is
export function clockSlab(ctx, view, str, col, bar = 0) {
  const { w } = view, y = 44, ph = 52
  ctx.fillStyle = '#05080b'; ctx.fillRect(0, y, w, ph)
  if (bar > 0) { ctx.fillStyle = view.accent; ctx.fillRect(0, y + ph - 3, w * clamp(bar, 0, 1), 3) }
  const adv = 25, dot = 12
  let x = w / 2 - ((str.length - 1) * adv + dot) / 2
  ctx.font = `46px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === '.') { ctx.fillText('.', x + dot / 2, y + ph / 2 - 1); x += dot }
    else { ctx.fillText(ch, x + adv / 2, y + ph / 2 - 1); x += adv }
  }
}
function drawClock(ctx, g, view) {
  const { w } = view
  const y = 44, ph = 52
  clockSlab(ctx, view, Math.min(g.clock(), 99.99).toFixed(2), g.done ? (g.done.hit ? GOOD : BAD) : g.goAt != null ? '#fff' : 'rgba(255,255,255,.5)', g.y / g.dist)
  const dim = 'rgba(255,255,255,.72)'
  if (g.split != null) text(ctx, `${g.game === 'sprint' ? '30 FT' : '10 YD'} ${g.split.toFixed(2)}`, 12, y + ph / 2 - 1, { font: LABEL, size: 17, align: 'left', color: dim })
  const left = g.game === 'sprint' ? Math.min(75, Math.floor(g.y * 3)) : Math.min(40, Math.floor(g.y))
  text(ctx, `${left} ${g.game === 'sprint' ? 'FT' : 'YD'}`, w - 12, y + ph / 2 - 1, { font: LABEL, size: 17, align: 'right', color: dim })
}
