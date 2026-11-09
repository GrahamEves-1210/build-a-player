// The academy trial's 30 m sprint, in first person on the stadium pitch: the 40's rules (lib/mg/dash.js: wait for the
// whistle, then LEFT RIGHT LEFT RIGHT as fast as possible, the same foot twice does nothing, his legs run at his speed)
// on 30 metres of grass, from the halfway side of the D to the edge of the box. Timing gates at 0, 10 and 30, cones
// down the lane, the academy staff with their watches at the finish and the time on the big screen.
import { make as dashMake, clockSlab, officialStrip, officialPunch, OFFICIAL_MS, calm, stopwatch } from './dash.js'
import { clamp, lerp, prog, easeOut, text, DISPLAY, LABEL, GOOD, BAD, GOLD, nudge } from './kit.js'
import { placeStamp } from './read.js'
import { camOf, P, stadium, man, POSE, kitsOf, dress, line, scout } from './soccer.js'

export const how = {
  sprint30: 'Wait for the whistle. Then alternate LEFT and RIGHT as fast as possible.',
}
export const make = o => dashMake({ ...o, game: 'sprint30' })

const YD = 0.9144
const Z0 = -46.5, DIST = 30, LANE = 1.7
const MPH = 2.045
function beats(g) {
  if (g.goAt != null && !g.done) g.topMph = Math.max(g.topMph ?? 0, g.speed * MPH)
  if (g.done && g.crossed != null && !g.settled) {
    g.settled = true
    if (g.stamp) g.stamp.at += OFFICIAL_MS
    g.outro = (g.outro ?? 1700) + OFFICIAL_MS
  }
  if (g.crossed != null && !g.official && g.t - g.crossed >= OFFICIAL_MS) { g.official = true; g.fx.push('stamp') }
}
const smooth = f => f * f * (3 - 2 * f)
function camFor(g, view) {
  const first = g.firstPress, quiet = calm()
  const up = first == null ? 0 : smooth(prog(g.t, first, first + 320))
  const top = clamp(g.speed / (g.cap * 0.72), 0, 1)
  const bob = quiet ? 0 : Math.sin(g.cycle * Math.PI * 4) * 0.045 * top
  let fs = 0
  const fsAge = g.t - g.fsAt
  if (fsAge < 720 && first == null) fs = fsAge < 200 ? easeOut(fsAge / 200) : 1 - easeOut((fsAge - 200) / 520)
  const m = g.y * YD
  return camOf(view, { x: 0, y: lerp(1.22, 1.68, Math.max(up, fs * 0.5)) + bob, z: Z0 + m - lerp(0.45, 0.1, up) + fs * 0.3, F: 300, hzAt: lerp(0.33, 0.3, up) + (quiet ? 0 : Math.cos(g.cycle * Math.PI * 4) * 0.004 * top) })
}
// a timing gate: a tripod each side, the reflector on top, the beam between
function gate(ctx, C, Z, hit, finish) {
  for (const sd of [-1, 1]) {
    const X = sd * (LANE + 0.55), a = P(C, X, 0, Z), b = P(C, X, 1.05, Z)
    if (!a.ok || a.d < 0.8) continue
    const w = Math.max(1, 0.05 * a.s)
    ctx.strokeStyle = '#161b20'; ctx.lineWidth = w
    ctx.beginPath(); ctx.moveTo(a.x - 0.18 * a.s, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(a.x + 0.18 * a.s, a.y); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke()
    ctx.fillStyle = finish ? GOLD : '#d8dde1'; ctx.fillRect(b.x - 0.1 * b.s, b.y - 0.16 * b.s, 0.2 * b.s, 0.16 * b.s)
    ctx.fillStyle = hit ? GOOD : '#c9423a'; ctx.fillRect(b.x - 0.04 * b.s, b.y - 0.11 * b.s, 0.08 * b.s, 0.06 * b.s)
  }
}
function cones(ctx, C) {
  for (let m = 5; m < DIST; m += 5) for (const sd of [-1, 1]) {
    const p = P(C, sd * LANE, 0, Z0 + m)
    if (!p.ok || p.d < 0.9) continue
    const h = 0.3 * p.s, w = 0.22 * p.s
    ctx.fillStyle = '#f08a24'; ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y); ctx.lineTo(p.x, p.y - h); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#f4f6f2'; ctx.fillRect(p.x - w * 0.22, p.y - h * 0.55, w * 0.44, Math.max(0.6, h * 0.12))
  }
}
function drawClock(ctx, g, view) {
  const { w } = view, y = 44, ph = 52
  const over = g.crossed == null ? -1 : g.t - g.crossed, official = over >= OFFICIAL_MS || (g.done && g.crossed == null)
  const col = official ? (g.done.hit ? GOOD : BAD) : g.goAt != null ? '#fff' : 'rgba(255,255,255,.5)'
  const q = over >= 0 ? officialPunch(over) : 1
  if (q !== 1) { ctx.save(); ctx.translate(w / 2, y + ph / 2); ctx.scale(q, q); ctx.translate(-w / 2, -(y + ph / 2)) }
  clockSlab(ctx, view, Math.min(g.clock(), 99.99).toFixed(2), col, g.y / g.dist)
  if (q !== 1) ctx.restore()
  const dim = 'rgba(255,255,255,.72)'
  if (g.split != null) text(ctx, `10 M ${g.split.toFixed(2)}`, 12, y + ph / 2 - 1, { font: LABEL, size: 17, align: 'left', color: g.t - g.splitAt < 520 ? GOLD : dim })
  text(ctx, `${Math.min(DIST, Math.floor(g.y * YD))} M`, w - 12, y + ph / 2 - 11, { font: LABEL, size: 16, align: 'right', color: dim })
  if (g.goAt != null) {
    const flat = !g.done && g.speed >= g.cap * 0.965
    text(ctx, `${((g.done ? g.topMph ?? 0 : g.speed * MPH) * 1.609).toFixed(1)} KM/H`, w - 12, y + ph / 2 + 9, { font: LABEL, size: 16, align: 'right', color: flat ? GOLD : dim })
  }
  if (over >= 0) {
    const react = g.firstPress != null ? Math.max(0, (g.firstPress - g.goAt) / 1000) : 0
    officialStrip(ctx, view, over, g.done?.hit, `REACTION ${react.toFixed(2)}   TOP ${((g.topMph ?? 0) * 1.609).toFixed(1)} KM/H`)
  }
}
export function draw(ctx, g, view) {
  const C = camFor(g, view), K = kitsOf(view)
  g.nudge ??= nudge()
  if (g.firstPress != null && !g.felt) { g.felt = true; g.nudge.kick(g.t, 1.6, 0, -1, 130) }
  beats(g)
  const team = [view.colors.us, view.colors.trim]
  const clockStr = g.goAt == null ? '0.00' : Math.min(g.clock(), 99.99).toFixed(2)
  stadium(ctx, view, C, { team, board: `30 M  ${clockStr}`, empty: true })
  // the lane: its edges painted on the grass, the start line, the finish on the edge of the box
  ctx.fillStyle = 'rgba(244,247,242,.75)'; ctx.beginPath()
  line(ctx, C, -LANE, Z0, -LANE, Z0 + DIST, 0.06); line(ctx, C, LANE, Z0, LANE, Z0 + DIST, 0.06)
  line(ctx, C, -LANE - 0.6, Z0, LANE + 0.6, Z0, 0.1)
  ctx.fill()
  ctx.fillStyle = GOLD; ctx.beginPath(); line(ctx, C, -LANE - 0.6, Z0 + DIST, LANE + 0.6, Z0 + DIST, 0.22); ctx.fill()
  // far to near: the staff at the finish, the gates, the cones
  const over = g.crossed == null ? -1 : g.t - g.crossed, good = g.done?.hit
  const staff = dress(K.staff, { skin: '#6d4229' })
  const watchUp = g.crossed == null || g.t < g.crossed + 240
  for (const [X, dz, sk] of [[-LANE - 1.7, 1.2, '#6d4229'], [LANE + 1.8, 1.6, '#c09060'], [LANE + 3.2, 3.2, '#8d5a3b']]) {
    const pose = over >= OFFICIAL_MS && X > 0 && good ? POSE.point : watchUp ? { ...POSE.stand, hrx: 13, hry: -86 } : POSE.stand
    const p = man(ctx, C, X, Z0 + DIST + dz, pose, { ...staff, skin: sk })
    if (p.ok && watchUp) { const k = p.s * 1.8 / 110; stopwatch(ctx, p.x + 13 * k, p.y - 88 * k, Math.max(0.6, k * 1.4)) }
  }
  // the scouts along the touchline, with their clipboards
  for (const [X, dz, sk] of [[-LANE - 6.5, 14, '#f0c4a0'], [LANE + 6.8, 18, '#5e3c22'], [LANE + 7.4, 22, '#c09060']]) scout(ctx, C, X, Z0 + dz, { ...staff, skin: sk, front: true }, g.t, { head: X < 0 ? 0.6 : -0.6 })
  // the other trialists, in bibs, waiting their turn by the start
  for (const [X, dz] of [[-LANE - 3.4, 4], [-LANE - 4.2, 5.2], [LANE + 4.6, 6.5]]) man(ctx, C, X, Z0 + dz, { ...POSE.stand, head: X < 0 ? 0.6 : -0.6 }, dress(K.bib, { number: null, skin: X < -5 ? '#f0c4a0' : '#5e3c22' }, { front: true }))
  for (const Z of [DIST, 10, 0]) gate(ctx, C, Z0 + Z, g.y * YD >= Z && g.goAt != null, Z === DIST)
  cones(ctx, C)
  drawClock(ctx, g, view)
  const { w } = view, wordY = C.hz + Math.min(150, (view.h - 96 - C.hz) * 0.35)
  placeStamp(g.stamp, view)
  if (g.phase === 'set' && g.t >= g.fsAt + 720) text(ctx, 'SET', w / 2, wordY, { font: DISPLAY, size: 46, color: '#fff' })
  else if (g.phase === 'run' && !g.done && g.t - g.goAt < 420) {
    const q = 1 + 0.4 * (1 - easeOut(clamp((g.t - g.goAt) / 110, 0, 1)))
    ctx.save(); ctx.translate(w / 2, wordY); ctx.scale(q, q)
    text(ctx, 'GO', 0, 0, { font: DISPLAY, size: 62, color: GOLD })
    ctx.restore()
  }
}
