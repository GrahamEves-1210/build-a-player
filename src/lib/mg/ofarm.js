// OUTFIELD ARM, the showcase's arm strength: from right field, a fungo rolled out to him, he charges it, and throws
// home on a line, the gun on it. Three throws.
//   aim     the stick (left/right) lines the throw up on the plate; up throws it with more air under it, down keeps
//           it on a line to the cutoff man's head.
//   throw   hold THROW (SPACE) through the crow hop: the meter fills to his release point, and letting go right at the
//           top is all of it on the gun. Early leaves some in the hand; hold it too long and he's thrown it flat-footed.
// The gun reads every throw, the best one counts; the scouts note how many were on line to the plate.
import { clamp, lerp, prog, outcome, rngOf, easeOut, nudge, text, DISPLAY, LABEL, rr, GOOD, BAD, GOLD } from './kit.js'
import { placeStamp } from './read.js'
import { bbTarget } from './combineNorms.js'
import { camOf, P, staticPark, baller, ballB, uniforms, dressB, BP, mixB, runB, throwPose, radar, radarScout, padCtl, padInput, padStick, drawPads, lineB, gauss , hudB, promptB } from './baseball.js'

export const how = {
  'arm-strength': 'Right field, a ball rolled out. Charge it, line the throw up on the plate with the stick, then hold THROW through the crow hop and let go right at the top of the meter. Three throws; the best one on the gun counts.',
}
const FIELD = { x: 50.5, z: 67.5 }, HOME = { x: 0, z: 0.2 }
const DX = HOME.x - FIELD.x, DZ = HOME.z - FIELD.z, DL = Math.hypot(DX, DZ), UX = DX / DL, UZ = DZ / DL
const PEAK = 360, GREEN = 70, LATE = 560

export function make({ v, seed, pos = null }) {
  const r = rngOf(seed), tv = clamp((v - 1) / 10, 0, 1)
  // (a stronger arm has more in it than the mark asks: a cannon can let a throw go a hair early or late and still be on it)
  // the mark: what a good throw from an arm of this grade reads (lib/mg/combineNorms.js); all of it, a touch more
  const mark = bbTarget('ofArm', pos === 'pit' ? 'pit' : 'bat', v), max = mark + lerp(0.15, 2.1, tv)
  const g = {
    t: 0, game: 'arm-strength', zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 1900, stamp: null,
    tv, max, mark, reps: 3, rep: 0, reads: [], onLine: 0, aim: { x: 0, y: 0 },
    phase: 'roll', at: 0, holdAt: null, relAt: null, throw: null, call: null, callAt: null, doneAt: null,
    ctl: padCtl(), vh: 640, nudge: nudge(),
    hud: hudB('CHARGE IT, THEN THROW HOME'),
    tick(dt) {
      g.t += dt
      const o = padStick(g.ctl)
      if (g.phase === 'roll' || g.phase === 'field') { g.aim.x = clamp(g.aim.x + o.x * 7 * dt / 1000, -6, 6); g.aim.y = clamp(o.y, -1, 1) }
      if (g.phase === 'roll' && g.t - g.at >= 1500) { g.phase = 'field'; g.at = g.t; g.fx.push('catchball'); g.hud.prompt = 'HOLD THROW · LET GO AT THE TOP' }
      // held too long: he's let it go flat-footed
      if (g.phase === 'hop' && g.t - g.holdAt >= LATE) release()
      if (g.phase === 'flight' && g.t >= g.throw.arrive) arrive()
      if (g.phase === 'call' && g.t - g.callAt >= 1100) next()
      // (fielded, and nobody's thrown it: the coach wants it home)
      if (g.phase === 'field' && g.t - g.at >= 3200) { g.holdAt = g.t - 200; g.phase = 'hop'; release() }
    },
    input(a) {
      if (g.done) { if ((a.kind === 'down' || a.kind === 'key') && g.t - g.doneAt > 250) g.outro = Math.min(g.outro, g.t - g.doneAt + 90); return }
      padInput(g.ctl, a, g.vh, { down: id => { if (id === 'S' && g.phase === 'field') { g.phase = 'hop'; g.holdAt = g.t; g.hud.prompt = null; g.fx.push('h:light') } }, up: id => { if (id === 'S' && g.phase === 'hop') release() }, hasP: false })
    },
  }
  function release() {
    const held = g.t - g.holdAt, off = (held - PEAK) / GREEN
    // all of it right at the top; early leaves some in the hand, late is flat-footed
    const k = held > LATE - 5 ? 0.88 : clamp(1 - 0.17 * off * off, 0.75, 1)
    const mph = Math.round((g.max * k + gauss(r) * 0.9) * 10) / 10
    // the line: where he aimed it, off by his arm and his timing; the arc: up is air under it, down a line drive
    const lat = g.aim.x + gauss(r) * lerp(2.6, 1.2, tv) * (1 + Math.abs(off) * 0.4)
    const arc = g.aim.y
    const onLine = Math.abs(lat) < 2.2 && arc > -0.75 && arc < 0.7
    const secs = DL / (mph * 0.447 * (arc > 0.3 ? 0.78 : 0.86)) * 0.55
    g.throw = { mph, lat, arc, onLine, at: g.t, arrive: g.t + secs * 1000, apex: lerp(3.5, 11, (arc + 1) / 2), perfect: Math.abs(off) <= 0.5 }
    g.phase = 'flight'; g.fx.push('swoosh', 'h:medium')
  }
  function arrive() {
    const T = g.throw
    g.reads.push(T.mph); if (T.onLine) g.onLine++
    g.call = { word: `${Math.round(T.mph)} MPH`, sub: T.onLine ? 'ON LINE TO THE PLATE' : Math.abs(T.lat) >= 2.2 ? `${T.lat < 0 ? 'UP THE FIRST-BASE LINE' : 'UP THE THIRD-BASE LINE'}` : T.arc >= 0.7 ? 'TOO MUCH AIR UNDER IT' : 'SHORT-HOPPED THE CATCHER', good: T.onLine && T.mph >= g.mark }
    g.callAt = g.t; g.phase = 'call'
    g.fx.push(T.onLine ? 'catchball' : 'tap')
  }
  function next() {
    g.rep++
    if (g.rep >= g.reps) return finish()
    g.phase = 'roll'; g.at = g.t; g.throw = null; g.call = null
  }
  function finish() {
    const best = Math.max(...g.reads), need = g.mark
    const hit = best >= need
    const score = clamp(0.5 + (best - need) / 6 + (g.onLine - 1.5) * 0.06, 0, 1)
    g.done = outcome(score, hit, `${Math.round(best)} mph best · ${g.onLine} of ${g.reps} on line`, { mph: Math.round(best), best, made: g.onLine, of: g.reps, reads: g.reads })
    g.doneAt = g.t
    g.stamp = { text: hit ? (best >= need + 3 ? 'A CANNON' : 'PLUS ARM') : 'BELOW THE MARK', good: hit, at: g.t, size: 42 }
    g.fx.push(hit ? 'h:success' : 'h:heavy')
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// Behind him in right field, looking in at the plate: the empty park, the cutoff man, the catcher at home, the scouts
// with their guns behind the plate, the radar board
const camFor = view => camOf(view, { x: FIELD.x - UX * 9.5, y: 4.4, z: FIELD.z - UZ * 9.5, yaw: Math.atan2(UX, UZ), pitch: 0.075, F: 820, cy: 0.33 })
function fielderAt(g) {
  const t = g.t
  // the charge in on the ball, gloved on the run, the crow hop and the throw
  if (g.phase === 'roll') { const k = prog(t - g.at, 300, 1500); return { x: FIELD.x - UX * lerp(6, 0, easeOut(k)), z: FIELD.z - UZ * lerp(6, 0, easeOut(k)), pose: k < 1 ? runB(t / 230, 0.9) : BP.ready } }
  if (g.phase === 'field') return { x: FIELD.x, z: FIELD.z, pose: { ...BP.ready, hy: 44, hlx: -6, hly: -64, hrx: 6, hry: -62, elbow: 0.6 } }
  if (g.phase === 'hop') { const k = clamp((t - g.holdAt) / PEAK, 0, 1.4); return { x: FIELD.x + UX * k * 1.2, z: FIELD.z + UZ * k * 1.2, pose: throwPose(k * 0.45, 1), lift: Math.sin(clamp(k, 0, 1) * Math.PI) * 0.12 } }
  const a = g.throw ? t - g.throw.at : 999
  return { x: FIELD.x + UX * 1.7, z: FIELD.z + UZ * 1.7, pose: a < 600 ? throwPose(0.45 + 0.55 * clamp(a / 420, 0, 1), 1) : mixB(throwPose(1, 1), BP.stand, prog(a, 600, 1000)) }
}
function ballNow(g) {
  const t = g.t
  if (g.phase === 'roll') { const k = clamp((t - g.at) / 1500, 0, 1), from = { x: 18, z: 26 }; return { x: lerp(from.x, FIELD.x, easeOut(k)), y: 0.05 + Math.abs(Math.sin(k * 9)) * 0.25 * (1 - k), z: lerp(from.z, FIELD.z, easeOut(k)) } }
  const T = g.throw
  if (!T) return null
  const f = clamp((t - T.at) / (T.arrive - T.at), 0, 1.02)
  const end = { x: HOME.x + -UZ * T.lat, z: HOME.z + UX * T.lat }
  const start = { x: FIELD.x + UX * 2, z: FIELD.z + UZ * 2 }
  const hop = T.arc < -0.3 ? Math.abs(Math.sin(Math.max(0, f - 0.82) / 0.18 * Math.PI)) * 0.6 * (f > 0.82 ? 1 : 0) : 0
  const y = f < 0.82 || T.arc >= -0.3 ? lerp(1.9, 0.9, f) + T.apex * 4 * f * (1 - f) * (T.arc < -0.3 ? 0.5 : 1) : hop + 0.1
  return { x: lerp(start.x, end.x, f), y: Math.max(0.05, y), z: lerp(start.z, end.z, f) }
}
export function draw(ctx, g, view) {
  g.vh = view.h
  const C = camFor(view), K = uniforms(view, true)
  staticPark(ctx, view, C, 'ofarm', { team: [view.colors.us, view.colors.trim], empty: true })
  // the line to the plate: where he's lined it up, chalked faint across the grass
  if (g.phase === 'roll' || g.phase === 'field' || g.phase === 'hop') {
    const tx = HOME.x + -UZ * g.aim.x, tz = HOME.z + UX * g.aim.x
    ctx.fillStyle = 'rgba(242,242,238,.18)'; ctx.beginPath(); lineB(ctx, C, FIELD.x + UX * 4, FIELD.z + UZ * 4, tx, tz, 0.35); ctx.fill()
    const m = P(C, tx, 0.9, tz)
    if (m.ok) { ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, 6.2832); ctx.moveTo(m.x - 7, m.y); ctx.lineTo(m.x + 7, m.y); ctx.stroke() }
  }
  const list = []
  // the catcher at the plate, the cutoff man on the line, the scouts behind home with their guns
  list.push({ x: 0, z: -0.5, fn: () => baller(ctx, C, 0, -0.5, { ...BP.ready, hlx: -10, hly: -72, mitt: 1 }, dressB(K.us, { number: 9, skin: '#a87548' }, { front: true, catcher: true, glove: 'R' })) })
  const cut = { x: FIELD.x * 0.42, z: FIELD.z * 0.42 }
  list.push({ x: cut.x, z: cut.z, fn: () => baller(ctx, C, cut.x, cut.z, { ...BP.stand, hlx: -16, hly: -112, hrx: 16, hry: -112 }, dressB(K.us, { number: 25, skin: '#f0c4a0' }, { front: true, glove: 'R' })) })
  const scout = dressB(K.scout, { skin: '#c09060' }, {})
  ;[[-3, -17], [-1.6, -17.2], [-0.2, -16.9], [1.2, -17.1], [2.6, -17]].forEach(([X, Z], i) => list.push({ x: X, z: Z, fn: () => radarScout(ctx, C, X, Z, { ...scout, skin: ['#c09060', '#5e3c22', '#f0c4a0', '#8d5a3b', '#a87548'][i] }, g.t, g.phase === 'hop' || g.phase === 'flight') }))
  for (const it of list) it.d = P(C, it.x, 0, it.z).d
  list.sort((p, q) => q.d - p.d)
  for (const it of list) it.fn()
  const b = ballNow(g)
  if (b && b.z < FIELD.z - 3) ballB(ctx, C, b.x, b.y, b.z, g.t / 50)
  const f = fielderAt(g)
  baller(ctx, C, f.x, f.z, f.pose, dressB(K.us, { number: 27, skin: '#8d5a3b' }, { front: false, glove: 'L' }), { lift: f.lift ?? 0 })
  if (b && b.z >= FIELD.z - 3) ballB(ctx, C, b.x, b.y, b.z, g.t / 50)
  drawHud(ctx, g, view)
}
function drawHud(ctx, g, view) {
  const { w, h } = view
  ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, 8, 50, 160, 34, 4); ctx.fill()
  text(ctx, `THROW ${Math.min(g.rep + 1, g.reps)} OF ${g.reps} · ${g.onLine} ON LINE`, 16, 60, { font: LABEL, size: 12, align: 'left', track: 0.8, color: 'rgba(242,242,238,.75)' })
  text(ctx, g.reads.length ? `BEST ${Math.round(Math.max(...g.reads))} MPH` : `MARK ${Math.round(g.mark)} MPH`, 16, 75, { font: DISPLAY, size: 13, align: 'left' })
  // the gun, reading as it goes
  radar(ctx, w - 50, 67, g.throw && (g.phase === 'flight' || g.phase === 'call') ? g.throw.mph : null, { w: 76 })
  // the meter: the crow hop to the release point, the top marked
  if (g.phase === 'hop' || (g.phase === 'flight' && g.t - g.throw.at < 400)) {
    const held = g.phase === 'hop' ? g.t - g.holdAt : g.throw.at - g.holdAt
    const x0 = w / 2 - 80, y = h - 196, W = 160
    ctx.fillStyle = 'rgba(6,9,13,.82)'; rr(ctx, x0 - 8, y - 18, W + 16, 30, 4); ctx.fill()
    ctx.fillStyle = '#26282c'; ctx.fillRect(x0, y, W, 8)
    const gx = x0 + W * ((PEAK - GREEN * 0.6) / LATE), gw = W * (GREEN * 1.2 / LATE)
    ctx.fillStyle = 'rgba(53,224,122,.4)'; ctx.fillRect(gx, y, gw, 8)
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(x0, y, W * clamp(held / LATE, 0, 1), 8)
    text(ctx, 'CROW HOP', x0, y - 8, { font: LABEL, size: 11, align: 'left', track: 1, color: 'rgba(242,242,238,.7)' })
  }
  if (g.call && g.phase === 'call') {
    const y = h - 214
    ctx.font = `20px ${DISPLAY}`
    const tw = Math.max(150, ctx.measureText(g.call.sub).width * 0.7 + 30)
    ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, w / 2 - tw / 2, y - 16, tw, 42, 4); ctx.fill()
    ctx.fillStyle = g.call.good ? GOOD : '#f2f2ee'; ctx.fillRect(w / 2 - tw / 2, y + 23, tw, 3)
    text(ctx, g.call.word, w / 2, y + 1, { font: DISPLAY, size: 20 })
    text(ctx, g.call.sub, w / 2, y + 16, { font: LABEL, size: 11, track: 1, color: 'rgba(242,242,238,.75)' })
  }
  placeStamp(g.stamp, view)
  promptB(ctx, view, g)
  drawPads(ctx, view, g.ctl, { move: 'AIM', S: 'THROW', P: null }, !g.done)
}
