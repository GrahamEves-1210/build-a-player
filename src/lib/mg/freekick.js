// DIRECT FREE KICK: twenty-odd metres out, late on, the wall nine and a half metres in front of you covering the near
// post, the keeper shading the far side, the ref's spray on the grass. It's your ball. The shot is soccer.js's own
// (shooter / strikeOf / shotAt / keeperSave), the same as every soccer game's:
//   AIM with the stick (the arrows): where on the goal you're putting it.
//   CURL (hold, let go): the finesse one, up and over the wall and dipping. Over it, the keeper's unsighted till it's
//        past them: into the corner on the wall's side and he can't get across. Too little on it and it's in the wall.
//   SHOOT (hold, let go): driven. Too flat to get over a wall from here, so it goes at the keeper's side. With the
//        stick held down it's low, and a low one goes under the wall when it jumps (unless a man's lying behind it).
//   Too much power and it's over the bar. Tap again as his foot meets it: a perfect strike, tighter and quicker.
//   Or DRAW it (a finger, the mouse: soccer.js's draw the shot): from the ball to the spot. Bow the line and it's
//        curled (bowed his foot's way, the inside of the boot; the other way, the outside), lifted up over the wall
//        the more pace it has; straight and quick it's driven, along the grass if it ends short of the goal line.
// Finishing and composure set the scatter and the strike's window. Everything a player (or a bot) needs is on the
// screen: the wall, the man behind it, the keeper, the aim.
import { clamp, lerp, prog, outcome, rngOf, easeOut, particles, nudge, manOf } from './kit.js'
import { placeStamp } from './read.js'
import {
  camOf, staticStadium, net, goalFrame, ball, man, POSE, mix, runPose, kickPose, kitsOf, dress, boardWords, flashes, crowdUp, line,
  shooter, strikeOf, shotAt, keeperSave, shotHud, aimMark, aimTo, celebration, scorerAt, mateAt, keeperShot, heldBall, parried, defenderBeaten, keeperRoar,
  strikerDenied, celebMs, skipOutro, POST, BAR, NET_D, P,
  stroke, strokeDown, strokeMove, strokeUp, readStroke, drawnShot, strokeTrail, ghostStroke, drawnSoFar,
} from './soccer.js'
import { newCtl, control, stickOf, drawControls, tip } from './soccerPads.js'

export const how = {
  'free-kick': 'Draw it from the ball to your spot. Bend the line and it’s curled up over the wall; straight and quick, it’s driven; short and quick, it’s along the grass, under the wall when it jumps. Too quick and it’s over the bar. On a keyboard: aim with the arrows, hold E to curl it or SPACE to drive it, and let go to set the power.',
}

const WHISTLE = 1300
const WALL_D = 9.15, WALL_H = 1.86, JUMP = 0.42, JUMP_MS = 560
const KZ = -0.35
const LATE = 11000           // the ref's had enough: he strikes it whatever's on the bar
export const FILL = 900, RUNUP = 420
// the keeper: what he covers standing, how quick across, how late he picks up one coming over the wall
const K_REACH = 1.25, K_DIVE = 3.5, K_SPAN = 0.95, K_REACT = 210, K_BLIND = 270

export function make({ v, seed, cast = null, situation = null }) {
  const r = rngOf(seed)
  const sgn = r() < 0.5 ? -1 : 1                         // which side of the goal the ball's on
  const bx = sgn * (1.2 + r() * 5.2), bz = -(21 + r() * 5)
  const fw = WALL_D / Math.hypot(bx, bz), wz = lerp(bz, 0, fw)
  // the wall: from just outside the near post inwards, a man for each half metre of it
  const n = Math.abs(bx) < 3 ? 4 : 3
  const step = 0.56 / fw
  const SK = ['#5e3c22', '#8d5a3b', '#c09060', '#f0c4a0', '#3a2a1e']
  const wall = Array.from({ length: n }, (_, i) => {
    const gx = sgn * (POST + 0.7) - sgn * step * (i + 0.5)
    return { x: lerp(bx, gx, fw), jumpAt: 0, delay: 40 + r() * 70, skin: SK[Math.floor(r() * 5)] }
  })
  const span = [Math.min(...wall.map(m => m.x)) - 0.38, Math.max(...wall.map(m => m.x)) + 0.38]
  const sleeper = r() < 0.38
  const kx0 = -sgn * lerp(0.45, 0.85, clamp(Math.abs(bx) / 6, 0, 1))
  const k = shooter(v, { fill: FILL, windup: RUNUP, pressure: situation ? 0.5 : 0 })
  const g = {
    t: 0, zones: 'none', stick: true, fx: [], done: null, doneAt: null, outro: celebMs() + 300, stamp: null,
    sit: situation ?? null, seed,
    who: { me: manOf(cast, 'us', 'st', 0), gk: manOf(cast, 'them', 'gk', 0), mates: [manOf(cast, 'us', 'st', 1), manOf(cast, 'us', 'st', 2)] },
    bx, bz, sgn, wall, wz, fw, span, sleeper, kx0, v, k, foot: sgn < 0 ? 1 : -1,
    phase: 'set', btn: null, shot: null, res: null, endAt: null, popAt: null, cel: null, save: null,
    ctl: newCtl(), vh: 640, st: stroke(), lastView: null, keysView: false,
    dirt: particles(24, 3), nudge: nudge(),
    hud: { prompt: null },
    tick(dt) {
      g.t += dt
      if (g.phase === 'set' && g.t >= WHISTLE) { g.phase = 'aim'; g.fx.push('whistle') }
      // the aim: where the stick points, until his foot's through it
      const s = stickOf(g.ctl)
      if (!g.shot && k.phase !== 'done') k.aimAt(s.x, s.y)
      if (g.phase === 'aim' && k.phase === 'idle' && !g.st.on && g.t >= LATE) { k.press(g.t - FILL * 0.4, 'driven'); k.release(g.t) }
      if (k.phase !== 'idle' && !g.shot && k.tick(g.t)) strike()
      if (g.shot && !g.res && g.t - g.shot.at >= (g.shot.block ? g.shot.blockAt : g.shot.T)) land()
    },
    input(a) {
      if (g.done) { skipOutro(g, a); return }
      if (drawIn(a)) return
      control(g.ctl, a, g.vh, g.t, { a: down => press('S', down), b: down => press('P', down) })
    },
  }
  function press(btn, down) {
    if (g.shot) return
    if (down) {
      if (g.phase === 'aim' && k.phase === 'idle') {
        const type = btn === 'P' ? 'finesse' : stickOf(g.ctl).y < -0.5 ? 'low' : 'driven'
        if (k.press(g.t, type)) { g.btn = btn; g.fx.push('h:light') }
      } else if (k.phase === 'strike' && k.tap(g.t)) g.fx.push('tap')
      return
    }
    if (k.phase === 'power' && btn === g.btn) k.release(g.t)
  }
  // ── drawing it: from the ball ──
  g.aimView = () => { const C = lensOf(g, g.lastView ?? { w: 360, h: g.vh }); return { C, ball: P(C, bx, 0.11, bz) } }
  function drawIn(a) {
    if (a.kind !== 'down' && a.kind !== 'move' && a.kind !== 'up') return false
    const id = a.id ?? 0, st = g.st
    if (a.kind === 'down') {
      if (g.phase === 'aim' && k.phase === 'idle' && !g.shot) strokeDown(st, a.x, a.y, g.t, id, g.aimView().ball)
      return true
    }
    if (id !== st.id) return false
    if (a.kind === 'move') { strokeMove(st, a.x, a.y, g.t, id); return true }
    strokeUp(st, a.x, a.y, g.t, id)
    if (k.phase !== 'idle' || g.shot) return true
    const rd = readStroke(st, g.aimView().C, { foot: g.foot })
    if (rd.tap || rd.back) { g.hint = g.t; return true }
    drawnShot(k, rd, g.t, RUNUP)
    g.fx.push('h:light')
    return true
  }
  function strike() {
    // (twenty-five yards out the goal's small in the picture: a finger's own error is already most of a drawn one's)
    const s = strikeOf(k, { x: bx, z: bz }, { v, r, foot: g.foot, drawErr: 0.7, err: k.drawn ? 1 : 1.3 })
    const L = Math.hypot(s.to.x - bx, bz)
    // a free kick's curler is struck to get up and over the wall and dip: more on it, more height (soccer.js's
    // finesse is the open-play one, side-footed low). It swings less than one bent round a defender, and his foot sets
    // the way: whoever's on the ball is the one whose curl takes it in over the wall and out to the near post
    // (drawn, the bend is the stroke's own, either way)
    if (s.type === 'finesse') { s.apex = lerp(1.05, 2.45, clamp(s.power / 0.85, 0, 1)) * clamp(L / 22, 0.85, 1.2); if (!s.drawn) s.curve = -sgn * Math.abs(s.curve) * 0.5 }
    s.at = g.t
    for (const m of wall) m.jumpAt = s.at + m.delay
    // at the wall: over it, round it, under the jump, or into it
    const tw = s.T * fw, b = shotAt(s, tw)
    const inSpan = b.x > span[0] && b.x < span[1]
    const lift = Math.max(...wall.map(m => liftOf(m, s.at + tw)))
    const top = WALL_H + lift + 0.11
    let block = null
    if (inSpan && b.y < top) {
      if (b.y < lift - 0.02) { if (sleeper && b.y < 0.5) block = 'sleeper' }
      else block = 'wall'
    }
    s.block = block; s.blockAt = tw; s.blind = inSpan && !block
    // past the wall: on target, the woodwork, or off it; on target, can he get to it
    const wood = (!s.onTarget && Math.abs(Math.abs(s.to.x) - POST) < 0.17 && s.to.y < BAR + 0.06) || (Math.abs(s.to.y - BAR) < 0.17 && Math.abs(s.to.x) < POST + 0.06)
    let kind, why
    if (block === 'wall') { kind = 'wall'; why = b.y > top - 0.3 ? 'Clipped the top of the wall' : 'Straight into the wall' }
    else if (block === 'sleeper') { kind = 'wall'; why = 'Under the wall, but the man lying behind it kept it out' }
    else if (wood) { kind = 'wood'; why = Math.abs(s.to.y - BAR) < 0.17 ? 'Off the bar' : 'Off the post' }
    else if (!s.onTarget) { kind = 'off'; why = s.to.y > BAR ? (s.over ? 'Too much on it: over the bar' : 'Just over the bar') : 'Wide of the post' }
    else {
      // (floated up and over from twenty-five yards, he's watched it all the way and has all day to get across)
      const sv = keeperSave(s, s.chip ? { x: kx0, z: KZ, reach: K_REACH + 1.6, dive: K_DIVE, react: K_REACT, up: 2.9 } : { x: kx0, z: KZ, reach: K_REACH, dive: K_DIVE, span: K_SPAN, react: s.blind ? tw + K_BLIND : K_REACT, up: 2.75 }, r)
      g.save = sv
      if (sv.saved) { kind = 'saved'; why = sv.y > 1.9 ? 'Tipped over the bar' : sv.stretch > 0.8 ? 'Fingertip save' : sv.stretch > 0.45 ? 'The keeper got across to it' : 'Straight at the keeper' }
      else {
        kind = 'goal'
        why = s.blind ? (s.low ? 'Under the jumping wall and in' : Math.abs(s.to.x) > POST - 0.8 && s.to.y > 1.6 ? 'Over the wall, into the top corner' : 'Over the wall and in') : s.type === 'finesse' ? 'Bent it round the wall and in' : 'Drilled in at the keeper’s side'
      }
    }
    s.kind = kind; s.why = why
    g.shot = s; g.phase = 'flight'
    g.fx.push('stamp', 'h:medium')
  }
  function land() {
    const s = g.shot, goal = s.kind === 'goal'
    g.res = s.kind; g.endAt = g.t; g.doneAt = g.t
    const score = goal ? clamp(0.62 + (s.timed === 'green' ? 0.3 : s.timed === 'ok' ? 0.18 : 0.08) + (s.blind ? 0.06 : 0), 0, 1) : s.kind === 'saved' || s.kind === 'wood' ? 0.32 : 0.15
    g.done = outcome(score, goal, s.why)
    g.stamp = { text: goal ? 'GOAL' : s.kind === 'wall' ? 'BLOCKED' : s.kind === 'saved' ? 'SAVED' : s.kind === 'wood' ? (s.why === 'Off the bar' ? 'OFF THE BAR' : 'OFF THE POST') : 'MISSED', good: goal, at: g.t, size: 50 }
    if (goal) {
      g.popAt = g.t; g.fx.push('h:success'); g.nudge.kick(g.t, 2.5, 0, 1, 180)
      // away to the corner on his side, his teammates after him
      g.cel = celebration(`${seed}-fk`, { sit: g.sit, from: { x: bx - g.foot * 0.4, z: bz - 0.3 }, side: sgn, toward: { x: bx * 0.55 + sgn * 2.2, z: bz + 5.5 }, mates: [{ x: bx + sgn * 3, z: bz + 4, who: g.who.mates[0] }, { x: bx - sgn * 4, z: bz + 2, who: g.who.mates[1] }] })
    } else g.fx.push(s.kind === 'saved' ? 'catchball' : 'deny', 'h:heavy')
  }
  return g
}
const liftOf = (m, t) => { const a = t - m.jumpAt; return m.jumpAt && a > 0 && a < JUMP_MS ? JUMP * Math.sin((a / JUMP_MS) * Math.PI) : 0 }

// ── The picture ─────────────────────────────────────────────────────────────
// Behind the ball and up a little, the wall in front, the goal over it. The camera stays put: the stadium is baked
// (yawed to look from behind the ball straight at the middle of the goal, the way a taker sees it)
const camFor = g => {
  if (g.cam) return g.cam
  const L = Math.hypot(g.bx, g.bz), fx = -g.bx / L, fz = -g.bz / L, back = 9.5
  return (g.cam = { x: g.bx - fx * back + g.foot * 0.2, y: 2.75, z: g.bz - fz * back, F: 640, hzAt: 0.25, yaw: Math.atan2(fx, fz) })
}
// (a tall phone: the lens longer, so the goal's as big in the picture as the screen has room for)
const lensOf = (g, view) => { const cam = camFor(g); return camOf(view, { ...cam, F: cam.F * clamp(view.h / 520, 1, 1.24) }) }
const WALL_POSE = { ...POSE.stand, lx: -6, rx: 6, hlx: -5, hly: -44, hrx: 6, hry: -46, elbow: 0.5 }
const WATCH = { ...POSE.stand, lx: -10, rx: 10, hlx: -17, hly: -50, hrx: 17, hry: -50, tilt: 0.3 }
const STANCE = { ...POSE.stand, lx: -13, rx: 13, hy: 52, hlx: -18, hly: -46, hrx: 18, hry: -46 }
function strikerAt(g) {
  const t = g.t, k = g.k
  const F = g.foot, from = { x: g.bx - F * 1.25, z: g.bz - 2.6 }, plant = { x: g.bx - F * 0.4, z: g.bz - 0.3 }
  if (k.phase === 'idle' || k.phase === 'power') return { x: from.x, z: from.z, pose: { ...STANCE, hy: 52 + Math.sin(t / 420) * 0.5 } }
  const at = g.shot?.at ?? Infinity
  if (t < at) {
    const f = prog(t, k.relAt, k.strikeAt - 120)
    if (f < 1) return { x: lerp(from.x, plant.x, easeOut(f)), z: lerp(from.z, plant.z - 0.3, easeOut(f)), pose: runPose(((t - k.relAt) / 300) % 1, 0.85) }
    return { x: plant.x, z: plant.z, pose: kickPose(0.42 * easeOut(prog(t, k.strikeAt - 120, k.strikeAt)), F) }
  }
  const after = t - at
  // through it, then his foot comes down and he stands and watches it all the way
  const now = after < 260 ? kickPose(0.45 + 0.55 * easeOut(clamp(after / 260, 0, 1)), F) : mix(kickPose(1, F), WATCH, easeOut(prog(after, 260, 640)))
  if (!g.res) return { x: plant.x, z: plant.z, pose: now }
  const a = t - g.endAt
  if (g.res === 'goal') { const c = scorerAt(g.cel, a); return { x: c.x, z: c.z, pose: c.pose, lift: c.lift, turn: c.turn } }
  return { x: plant.x, z: plant.z, pose: strikerDenied(g.res === 'saved' ? 'save' : 'miss', a, now) }
}
function keeperAt(g) {
  const t = g.t, s = g.shot, x0 = g.kx0, k = g.k
  const ready = k.phase !== 'idle'
  const go = s ? s.at + (s.blind ? s.blockAt + K_BLIND : K_REACT) : Infinity
  if (!s || s.kind === 'wall' || s.kind === 'off' || t < go) {
    // on his line, the far side, up on his toes once the taker's going
    const bounce = ready && !g.res ? Math.abs(Math.sin(t / 150)) * 2.5 : 0
    const base = ready ? POSE.set : POSE.ready
    if (g.res && g.res !== 'goal' && t - g.endAt > 300) return { x: x0, z: KZ, lift: 0, pose: g.res === 'saved' ? keeperRoar(t - g.endAt - 300, base) : mix(base, POSE.stand, easeOut(prog(t - g.endAt, 300, 700))) }
    return { x: x0 + (s ? 0 : Math.sin(t / 700) * 0.08), z: KZ, lift: 0, pose: { ...base, hy: base.hy + bounce } }
  }
  // the dive: on to it when he saves it, short of it when he's beaten, and after
  const sv = g.save ?? { x: s.to.x, y: s.to.y, saved: false, f: 1 }
  return keeperShot(t, { x0, z: KZ, go, cross: s.at + (sv.f ?? 1) * s.T, ball: { x: sv.x, y: sv.y }, saved: !!sv.saved, res: g.res, resAt: g.endAt, cel: g.cel, ballIn: { x: s.to.x, z: NET_D - 0.4 } })
}
function ballNow(g) {
  const s = g.shot
  if (!s) return { x: g.bx, y: 0.11, z: g.bz, spin: 0 }
  const a = g.t - s.at
  const endMs = s.block ? s.blockAt : s.kind === 'saved' && g.save ? g.save.f * s.T : s.T
  if (a < endMs) return shotAt(s, a)
  const after = a - endMs, end = shotAt(s, endMs)
  if (s.kind === 'wall') {
    // off a body and away, up and back toward the halfway line
    const f = clamp(after / 700, 0, 1)
    return { x: end.x + g.sgn * 1.4 * f, y: Math.max(0.11, end.y + Math.sin(f * Math.PI) * 1.6 - f * end.y), z: end.z - f * 6, spin: 14 + f * 4 }
  }
  if (s.kind === 'goal') {
    const f = clamp(after / 200, 0, 1), drop = clamp((after - 200) / 420, 0, 1)
    return { x: end.x * (1 + f * 0.08), y: Math.max(0.11, end.y - drop * drop * end.y), z: lerp(0, NET_D - 0.25, easeOut(f)), spin: 15 }
  }
  if (s.kind === 'saved') {
    // held, or pushed away round the post or over the bar
    if (g.save?.held) return { x: end.x, y: end.y, z: KZ - 0.3, spin: 0, held: true, age: after }
    return parried(end, after, KZ)
  }
  if (s.kind === 'wood') { const f = clamp(after / 650, 0, 1); return { x: end.x - Math.sign(end.x) * f * 1.2, y: Math.max(0.11, end.y - f * 1.4), z: -f * 4, spin: 15 } }
  const f = clamp(after / 600, 0, 1)
  return { x: end.x * (1 + f * 0.2), y: end.y + f * (end.y > BAR ? 2 : 0.2), z: f * 8, spin: 15 }
}
export function draw(ctx, g, view) {
  g.vh = view.h; g.keysView = !!view.keys; g.lastView = { w: view.w, h: view.h }
  const C = lensOf(g, view), K = kitsOf(view)
  const team = [view.colors.us, view.colors.trim], away = [view.colors.them, view.colors.themTrim]
  staticStadium(ctx, view, C, `fk${g.bx.toFixed(2)}`, { team, away, board: boardWords(g) })
  if (g.popAt != null && !view.empty) { crowdUp(ctx, C, team, g.t - g.popAt); flashes(ctx, C, view, g.t - g.popAt) }
  // the spray: the line the wall stands on
  ctx.fillStyle = 'rgba(250,252,250,.7)'; ctx.beginPath()
  for (let i = 0; i < 9; i++) { const x0 = g.span[0] - 0.4 + i * ((g.span[1] - g.span[0] + 0.8) / 9); line(ctx, C, x0, g.wz - 0.35, x0 + 0.24, g.wz - 0.35, 0.09) }
  ctx.fill()
  const b = ballNow(g), s = g.shot
  const ripple = g.res === 'goal' ? { x: s.to.x, y: s.to.y, at: s.at + s.T + 60 } : null
  net(ctx, C, ripple, g.t)
  if (b.z > 0.05) ball(ctx, C, b.x, b.y, b.z, b.spin)
  goalFrame(ctx, C)
  const kp = keeperAt(g)
  if (b.held) { const h = heldBall(kp, b.age); b.x = h.x; b.y = h.y }
  man(ctx, C, kp.x, kp.z, kp.pose, dress(K.gk, g.who.gk ?? { number: 1, skin: '#c09060' }, { front: kp.front ?? true, sleeves: true }), { lift: kp.lift })
  if (b.z <= 0.05 && b.z > g.wz + 0.3) ball(ctx, C, b.x, b.y, b.z, b.spin)
  // the man lying down behind the wall
  if (g.sleeper) man(ctx, C, (g.span[0] + g.span[1]) / 2, g.wz + 0.9, { ...POSE.dive, hy: 8, rot: g.sgn * 1.55 }, dress(K.them, { number: 6, skin: '#8d5a3b' }, { front: true }))
  // the wall: arms in, then up together as he strikes it. Beaten, they turn round and watch it go in, hands on hips
  const order = [...g.wall].sort((a, c) => Math.abs(c.x - C.x) - Math.abs(a.x - C.x))
  order.forEach((m, i) => {
    const lift = liftOf(m, g.t)
    let pose = lift > 0.05 ? { ...WALL_POSE, ly: -6, ry: -6, lk: 0.6, rk: 0.6, hy: 54 } : WALL_POSE
    const turned = g.res === 'goal' && g.t - g.endAt > 200
    if (turned) pose = defenderBeaten(i, g.t - g.endAt, WALL_POSE)
    else if (g.res === 'wall' && g.t - g.endAt > 250) pose = mix(WALL_POSE, POSE.stand, easeOut(prog(g.t - g.endAt, 250, 600)))
    man(ctx, C, m.x, g.wz, pose, dress(K.them, { number: null, skin: m.skin }, { front: true }), { lift, turn: turned ? easeOut(prog(g.t - g.endAt, 200, 500)) : 0 })
  })
  if (b.z <= g.wz + 0.3) ball(ctx, C, b.x, b.y, b.z, b.spin)
  const sp = strikerAt(g)
  man(ctx, C, sp.x, sp.z, sp.pose, dress(K.us, g.who.me ?? { number: 10, skin: '#8d5a3b' }), { name: g.res ? null : g.who.me?.name, lift: sp.lift ?? 0, turn: sp.turn ?? 0 })
  // his teammates in after him
  if (g.res === 'goal') for (let i = 0; i < g.cel.mates.length; i++) {
    const m = mateAt(g.cel, i, g.t - g.endAt)
    man(ctx, C, m.x, m.z, m.pose, dress(K.us, g.cel.mates[i].who ?? { number: i ? 7 : 8, skin: i ? '#f0c4a0' : '#5e3c22' }), { lift: m.lift, turn: m.turn })
  }
  // the aim, the shot's bar, the controls
  const dr = g.k.drawn
  if (!g.shot && dr) aimMark(ctx, C, dr.x, dr.y)
  else if (!g.shot && g.phase !== 'set' && (view.keys || g.k.phase !== 'idle')) { const a = aimTo(g.k.aim.x, g.k.aim.y); aimMark(ctx, C, a.x, a.y, { alpha: g.k.phase === 'idle' ? 0.75 : 1 }) }
  strokeTrail(ctx, g.st, g.t, { C, k: g.k, foot: g.foot })
  shotHud(ctx, view, g.k, { t: g.t, y: view.h - (view.keys ? 64 : 104) })
  // (on a phone the shot's drawn: no stick, no buttons)
  if (view.keys) drawControls(ctx, view, g.ctl, { stick: 'AIM', a: 'SHOOT', b: 'CURL' }, !g.done, g.t)
  // (on a phone there's nothing under the picture: the words sit low, clear of the taker)
  const tipY = view.keys ? undefined : view.h - 96
  if (g.phase === 'set') tip(ctx, view, 'WAIT FOR THE WHISTLE', tipY)
  else if (g.k.phase === 'idle' && !g.st.on) {
    // the first one: a curler drawn off the ball over the wall into the corner on its side, and the line under it
    const b = P(C, g.bx, 0.11, g.bz), to = P(C, g.sgn * (POST - 0.55), 1.9, 0)
    if (drawnSoFar() < 2) ghostStroke(ctx, { x: b.x, y: b.y }, { x: to.x, y: to.y }, g.foot * 0.18, g.t - WHISTLE - 300)
    tip(ctx, view, view.keys ? 'OR DRAW IT WITH THE MOUSE · BEND IT TO CURL IT' : 'DRAW IT FROM THE BALL · BEND IT TO CURL IT', tipY, 14)
  }
  placeStamp(g.stamp, view)
}
