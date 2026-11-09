// 2-ON-1: the break. You've got the ball through the middle, a teammate flying up the wing, one man back and the keeper.
// The last defender backs off, and sooner or later he has to commit:
//   he steps up to you        → PASS: square it to the runner for the tap-in
//   he drops off to the runner → SHOOT: it's you and the keeper. soccer.js's shot, the same as every soccer game's: aim
//                                with the stick (held down: low), hold for power, let go, tap again as you strike it
// Go before he's committed and he reads it: the pass is cut out, the shot's blocked. He can sell you a step one way
// before he goes the other. Leave it too long and he's on you (or back across to block it).
// Link-up play buys the time to read him, finishing and composure the shot.
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, particles, nudge, manOf } from './kit.js'
import { placeStamp } from './read.js'
import {
  camOf, stadium, net, goalFrame, ball, man, POSE, mix, runPose, dribblePose, kickPose, kitsOf, dress, boardWords, flashes, crowdUp,
  shooter, strikeOf, shotAt, keeperSave, shotHud, aimMark, aimTo, celebration, scorerAt, mateAt, keeperBeaten, defenderBeaten, keeperRoar,
  strikerDenied, celebMs, skipOutro, POST, BAR, NET_D,
} from './soccer.js'
import { newCtl, control, stickOf, drawControls, tip } from './soccerPads.js'

export const how = {
  'two-on-one': 'Watch the last man. He steps up: square it to the runner. He drops off to the runner: keep it and shoot.',
}

const START_Z = -42
const RUN = 7.3              // m/s, you with the ball
const BACK = 4.2             // the last man backing off
export const FILL = 720      // ms: a shot's power bar in the run of play (quicker than a dead ball)
const WINDUP = 220           // the last touch before the strike
const SHOW = 330             // a fake: the step he sells you
const PASS_MS = 430          // the square ball across
const TAP_MS = 420           // the runner's side-foot into the net
const KZ_OUT = -4.2          // the keeper comes off his line to here

export function make({ v, seed, cast = null, situation = null }) {
  const r = rngOf(seed)
  const rs = r() < 0.5 ? -1 : 1                          // the runner's side
  const x0 = (r() - 0.5) * 2
  const commitGap = 7.2 + r() * 2.2                      // he commits when you're this close
  const goes = r() < 0.5 ? 'ball' : 'runner'
  const fake = r() < 0.45
  const W = byV(v, 670, 950)
  const k = shooter(v, { fill: FILL, windup: WINDUP, pressure: situation ? 0.5 : 0 })
  const g = {
    t: 0, zones: 'none', stick: true, fx: [], done: null, doneAt: null, outro: celebMs() + 300, stamp: null,
    sit: situation ?? null, seed,
    who: { me: manOf(cast, 'us', 'st', 0), mate: manOf(cast, 'us', 'st', 1), cb: manOf(cast, 'them', 'cb', 0), gk: manOf(cast, 'them', 'gk', 0) },
    rs, W, v, goes, fake, commitGap, k,
    me: { x: x0, z: START_Z, cyc: 0 }, mate: { x: rs * 7.2, z: START_Z + 0.6, cyc: 0.4 },
    cb: { x: rs * 1.1, z: -25, cyc: 0, side: 0 }, gk: { x: 0, z: -0.4 },
    chase: [{ x: -rs * 7.5, z: START_Z - 4.5, cyc: 0.2 }, { x: rs * 10.5, z: START_Z - 6, cyc: 0.7 }],
    commitAt: null, showAt: null, showTo: null, act: null, actAt: null, read: null,
    shot: null, pass: null, save: null, res: null, endAt: null, popAt: null, why: null, cel: null, assist: false,
    ctl: newCtl(), vh: 640,
    camX: x0 * 0.5, camZ: START_Z - 14,
    dirt: particles(24, 4), nudge: nudge(),
    hud: { prompt: null },
    tick(dt) {
      g.t += dt
      const s = dt / 1000
      const st = stickOf(g.ctl)
      if (!g.shot && k.phase !== 'done') k.aimAt(st.x, st.y)
      const live = !g.res && !g.act
      // you, the runner, the men chasing back (once it's a goal the celebration has them)
      if (!g.cel) {
        const mySp = g.shot ? RUN * Math.max(0, 1 - (g.t - g.shot.at) / 600) : g.pass ? RUN * Math.max(0.3, 1 - (g.t - g.pass.at) / 900) : g.res ? Math.max(0, RUN * (1 - (g.t - g.endAt) / 500)) : RUN
        g.me.z += mySp * s; g.me.x += -g.me.x * 0.25 * s; g.me.cyc += (mySp * s) / 2.5
        const mSp = g.res ? Math.max(0, RUN * (1 - (g.t - g.endAt) / 700)) : RUN * 1.02
        // the runner holds his line wide, then bends in toward the back post
        const wantX = rs * lerp(7.2, 3.2, clamp((g.mate.z + 24) / 18, 0, 1))
        g.mate.z += mSp * s; g.mate.x += (wantX - g.mate.x) * 1.2 * s; g.mate.cyc += (mSp * s) / 2.5
      }
      // (the men chasing back pull up once it's done: never on into the lens)
      for (const c of g.chase) { const sp = g.res ? Math.max(0, RUN * 0.94 * (1 - (g.t - g.endAt) / 700)) : RUN * 0.94; c.z += sp * s; c.cyc += (sp * s) / 2.6 }
      cbMove(s)
      gkMove(s)
      const gap = g.cb.z - g.me.z
      // the commit (and the show before it)
      if (g.commitAt == null && live) {
        if (fake && g.showAt == null && gap <= commitGap + 3.1) { g.showAt = g.t; g.showTo = goes === 'ball' ? 'runner' : 'ball' }
        if (gap <= commitGap && (!fake || g.t - g.showAt >= SHOW + 260)) { g.commitAt = g.t; g.fx.push('h:light') }
      }
      // too long: he's on you, or back across to block it
      if (live && g.commitAt != null && g.t > g.commitAt + W) settle('late', goes === 'ball' ? 'He got a foot in: took too long' : 'Took too long: he got back across to block it')
      if (k.phase !== 'idle' && !g.shot && !g.res && k.tick(g.t)) strike()
      if (g.shot && !g.res && g.t >= g.shot.at + (g.shot.block ? 180 : g.shot.T)) land()
      if (g.pass && !g.res && g.t >= g.pass.at + PASS_MS + (g.pass.ok ? TAP_MS : 260)) finishPass()
      // the camera rides behind you, a little to the runner's side, and stops once it's done
      const kk = g.res ? 1 - Math.exp(-dt / 300) : 1
      g.camZ += (Math.min(g.me.z - 14, -17) - g.camZ) * kk; g.camX += ((g.me.x + rs * 1.4) * 0.6 - g.camX) * kk
    },
    input(a) {
      if (g.done) { skipOutro(g, a); return }
      control(g.ctl, a, g.vh, g.t, { a: down => shootPress(down), b: down => { if (down) passPress() } })
    },
  }
  // the last man: backs off, shows, commits (to you, or across to the runner)
  function cbMove(s) {
    const c = g.cb
    if (g.res === 'late' || (g.shot && g.shot.block)) { const dx = g.me.x - c.x, dz = g.me.z + 0.8 - c.z, d = Math.hypot(dx, dz) || 1; if (d > 0.7) { c.x += (dx / d) * 6 * s; c.z += (dz / d) * 6 * s; c.cyc += (6 * s) / 2.6 } return }
    if (g.res) { c.cyc += (1.5 * s) / 2.6; return }
    if (g.commitAt == null || g.t < g.commitAt) {
      // jockeying, side-on, backing off; the show is a hard step
      const show = g.showAt != null && g.t - g.showAt < SHOW ? (g.showTo === 'ball' ? 1 : -1) : 0
      c.side = show
      c.z += (show === 1 ? -BACK * 0.15 : BACK) * s
      const wantX = show === -1 ? lerp(g.me.x, g.mate.x, 0.62) : lerp(g.me.x, g.mate.x, 0.3)
      c.x += (wantX - c.x) * (show ? 4 : 1.6) * s; c.cyc += (BACK * s) / 2.4
      return
    }
    if (g.goes === 'ball') {
      const dx = g.me.x - c.x, dz = g.me.z + 1.1 - c.z, d = Math.hypot(dx, dz) || 1
      if (d > 0.9) { c.x += (dx / d) * 6.2 * s; c.z += (dz / d) * 6.2 * s } c.cyc += (6.2 * s) / 2.6; c.side = 1
    } else {
      // across to sit on the pass: between you and the runner, and dropping
      const wantX = lerp(g.me.x, g.mate.x, 0.72), wantZ = g.mate.z + 1.4
      c.x += clamp(wantX - c.x, -6 * s, 6 * s); c.z += clamp(wantZ - c.z, -6 * s, 6 * s); c.cyc += (5.5 * s) / 2.6; c.side = -1
    }
  }
  function gkMove(s) {
    const q = g.gk
    if (g.shot || g.res) return
    // off his line as you come in, square to the ball (across to the runner once it's played)
    q.z += clamp((g.me.z > -22 ? KZ_OUT : -0.4) - q.z, -3.2 * s, 3.2 * s)
    q.x += clamp((g.pass ? g.mate.x * 0.5 : g.me.x * 0.32) - q.x, -3 * s, 3 * s)
  }
  // a press is judged when it lands: has he committed yet, and to what
  const readNow = () => (g.commitAt == null || g.t < g.commitAt ? 'early' : g.goes)
  function passPress() {
    if (g.act) return
    g.act = 'pass'; g.actAt = g.t; g.read = readNow()
    g.pass = { at: g.t, from: { x: g.me.x, z: g.me.z }, ok: g.read === 'ball' }
    g.fx.push('tap', 'h:light')
  }
  function shootPress(down) {
    if (down) {
      if (!g.act) {
        g.act = 'shoot'; g.actAt = g.t; g.read = readNow()
        k.press(g.t, stickOf(g.ctl).y < -0.5 ? 'low' : 'driven')
        g.fx.push('h:light')
      } else if (g.act === 'shoot' && k.phase === 'strike' && k.tap(g.t)) g.fx.push('tap')
      return
    }
    if (g.act === 'shoot' && k.phase === 'power') k.release(g.t)
  }
  function strike() {
    const from = { x: g.me.x + 0.25, z: g.me.z + 0.7 }
    const s = strikeOf(k, from, { v, r, foot: 1, speed: 0.7 })
    s.at = g.t
    // he read it (shot before he went), he's in front of you, or he's had time to get back across
    if (g.read === 'early') { s.block = true; s.why = 'Went too early: he was there to block it' }
    else if (g.read === 'ball') { s.block = true; s.why = 'He stepped up and blocked it' }
    else if (s.at - g.commitAt > W + 650) { s.block = true; s.why = 'Took too long over it: he got back to block it' }
    else {
      const wood = (!s.onTarget && Math.abs(Math.abs(s.to.x) - POST) < 0.17 && s.to.y < BAR + 0.06) || (Math.abs(s.to.y - BAR) < 0.17 && Math.abs(s.to.x) < POST + 0.06)
      if (wood) { s.kind = 'wood'; s.why = Math.abs(s.to.y - BAR) < 0.17 ? 'Off the bar' : 'Off the post' }
      else if (!s.onTarget) { s.kind = 'off'; s.why = s.to.y > BAR ? 'Leaned back: over the bar' : 'Dragged it wide' }
      else {
        const sv = keeperSave(s, { x: g.gk.x, z: g.gk.z, reach: 1.05, dive: 4.2, react: 230, up: 2.4 }, r)
        g.save = sv; s.kind = sv.saved ? 'saved' : 'goal'
        s.why = sv.saved ? (sv.stretch > 0.8 ? 'Good save, down to his side' : 'Too close to the keeper') : Math.abs(s.to.x) > POST - 0.8 ? 'Into the corner, past the keeper' : 'Slotted it past the keeper'
      }
    }
    if (s.block) s.kind = 'blocked'
    g.shot = s
    g.fx.push('stamp', 'h:medium')
  }
  function land() {
    const s = g.shot
    if (s.kind === 'goal') settle('goal', s.why, clamp(0.62 + (s.timed === 'green' ? 0.32 : s.timed === 'ok' ? 0.2 : 0.1), 0, 1))
    else settle(s.kind, s.why)
  }
  function finishPass() {
    const p = g.pass
    if (!p.ok) return settle('cut', g.read === 'early' ? 'Went too early: he read the pass and cut it out' : 'He was sitting on the pass: cut out')
    const e = p.at - g.commitAt
    settle('goal', 'Squared it for the tap-in', 0.66 + 0.34 * clamp(1 - e / W, 0, 1), true)
  }
  function settle(kind, why, score = null, assist = false) {
    if (g.res) return
    g.res = kind; g.endAt = g.t; g.doneAt = g.t; g.why = why; g.assist = assist
    const goal = kind === 'goal'
    g.done = outcome(score ?? (kind === 'saved' || kind === 'wood' ? 0.3 : 0.12), goal, why)
    g.stamp = { text: goal ? 'GOAL' : kind === 'saved' ? 'SAVED' : kind === 'blocked' ? 'BLOCKED' : kind === 'late' ? (g.goes === 'ball' ? 'TACKLED' : 'BLOCKED') : kind === 'cut' ? 'CUT OUT' : kind === 'wood' ? 'OFF THE WOODWORK' : 'MISSED', good: goal, at: g.t, size: 50 }
    if (goal) {
      g.popAt = g.t; g.fx.push('h:success'); g.nudge.kick(g.t, 2.5, 0, 1, 180)
      // the scorer peels away, the other one after him
      const scorer = assist ? g.mate : g.me, other = assist ? g.me : g.mate
      const side = assist ? rs : (scorer.x < 0 ? -1 : 1)
      // (off toward the corner of the box on his side, in front of the camera, not out past it)
      g.cel = celebration(`${seed}-21`, { from: { x: scorer.x, z: scorer.z }, side, toward: { x: scorer.x * 0.4 + side * 4.5, z: Math.max(scorer.z - 1.5, -9) }, mates: [{ x: other.x, z: other.z, who: assist ? g.who.me : g.who.mate }] })
    } else g.fx.push('deny', 'h:heavy')
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
function ballNow(g) {
  const me = g.me
  const at = { x: me.x + 0.25, y: 0.11, z: me.z + 0.75, spin: me.cyc * 2.4 }
  const p = g.pass
  if (p) {
    const f = clamp((g.t - p.at) / PASS_MS, 0, 1)
    if (!p.ok) {
      // it's cut out: to his feet, and away
      const c = g.cb
      if (f < 1) return { x: lerp(p.from.x, c.x, f), y: 0.11, z: lerp(p.from.z + 0.7, c.z, f), spin: f * 10 }
      const a = clamp((g.t - p.at - PASS_MS) / 700, 0, 1)
      return { x: c.x - g.rs * a * 3, y: 0.11, z: c.z - a * 4, spin: 10 + a * 5 }
    }
    const mx = p.mx ?? (p.mx = g.mate.x - g.rs * 0.4), mz = p.mz ?? (p.mz = g.mate.z + 0.4 + (RUN * PASS_MS) / 1000)
    if (f < 1) return { x: lerp(p.from.x, mx, f), y: 0.11, z: lerp(p.from.z + 0.7, mz, f), spin: f * 12 }
    // side-footed into the net from close in
    const a = clamp((g.t - p.at - PASS_MS) / TAP_MS, 0, 1), aim = g.rs * -1.6
    if (a < 1) return { x: lerp(mx, aim, a), y: 0.11, z: lerp(mz, 0, a), spin: 12 + a * 8 }
    const b = clamp((g.t - p.at - PASS_MS - TAP_MS) / 300, 0, 1)
    return { x: aim, y: 0.11, z: lerp(0, NET_D - 0.4, easeOut(b)), spin: 20 }
  }
  const s = g.shot
  if (!s) return at
  const a = g.t - s.at
  if (s.block) {
    const f = clamp(a / 180, 0, 1), c = g.cb
    if (f < 1) return { x: lerp(s.from.x, c.x, f), y: lerp(0.11, 0.6, f), z: lerp(s.from.z, c.z - 0.3, f), spin: f * 10 }
    const b = clamp((a - 180) / 700, 0, 1)
    return { x: c.x + g.rs * b * 2.5, y: Math.max(0.11, 0.6 + Math.sin(b * Math.PI) * 1.2 - b * 0.6), z: c.z - b * 5, spin: 10 + b * 6 }
  }
  if (a < s.T) return shotAt(s, a)
  const after = a - s.T, end = shotAt(s, s.T)
  if (s.kind === 'goal') { const f = clamp(after / 200, 0, 1), drop = clamp((after - 200) / 420, 0, 1); return { x: end.x, y: Math.max(0.11, end.y - drop * drop * end.y), z: lerp(0, NET_D - 0.25, easeOut(f)), spin: 15 } }
  if (s.kind === 'saved') {
    const f = clamp(after / 600, 0, 1), q = g.save ?? end
    return { x: q.x + Math.sign(q.x || 1) * f * 2.4, y: Math.max(0.11, q.y + Math.sin(f * Math.PI) * 0.6 - f * q.y), z: lerp(g.gk.z, g.gk.z + 2.2, f), spin: 15 }
  }
  const f = clamp(after / 600, 0, 1)
  return { x: end.x * (1 + f * 0.25), y: Math.max(0.11, end.y + (s.kind === 'wood' ? -f * 1.2 : f * 0.4)), z: s.kind === 'wood' ? -f * 3 : f * 7, spin: 15 }
}
function mePose(g) {
  const t = g.t, k = g.k
  if (g.act === 'shoot' && !g.res && k.phase !== 'idle') {
    if (k.phase === 'power') return dribblePose(g.me.cyc % 1)
    if (!g.shot) return kickPose(0.42 * easeOut(prog(t, k.relAt, k.strikeAt)))
    return kickPose(0.45 + 0.55 * easeOut(clamp((t - g.shot.at) / 260, 0, 1)))
  }
  if (g.pass && t - g.pass.at < 260) return kickPose(0.5 + 0.5 * (t - g.pass.at) / 260, -1)
  if (g.res && g.res !== 'goal') return strikerDenied(g.res === 'saved' ? 'save' : g.res === 'late' && g.goes === 'ball' ? 'tackle' : 'miss', t - g.endAt, runPose(g.me.cyc % 1, 0.3))
  return g.act ? runPose(g.me.cyc % 1, 0.9) : dribblePose(g.me.cyc % 1)
}
export function draw(ctx, g, view) {
  g.vh = view.h
  const C = camOf(view, { x: g.camX, y: 5.8, z: g.camZ, F: 440, hzAt: 0.15 }), K = kitsOf(view)
  const team = [view.colors.us, view.colors.trim], away = [view.colors.them, view.colors.themTrim]
  stadium(ctx, view, C, { team, away, board: boardWords(g) })
  if (g.popAt != null && !view.empty) { crowdUp(ctx, C, team, g.t - g.popAt); flashes(ctx, C, view, g.t - g.popAt) }
  const b = ballNow(g), s = g.shot
  const ripple = g.res === 'goal' ? (g.assist ? { x: g.rs * -1.6, y: 0.2, at: g.pass.at + PASS_MS + TAP_MS } : { x: s.to.x, y: s.to.y, at: s.at + s.T + 60 }) : null
  net(ctx, C, ripple, g.t)
  if (b.z > 0.05) ball(ctx, C, b.x, b.y, b.z, b.spin)
  goalFrame(ctx, C)
  const age = g.res ? g.t - g.endAt : 0
  // back to front: the keeper, the last man, the runner, you, the men chasing back
  const men = []
  const q = g.gk
  let kpose = g.me.z > -22 ? POSE.set : POSE.ready, klift = 0, kx = q.x, kz = q.z, kfront = true
  const sv = g.save
  if (s && !s.block && s.kind !== 'off' && g.t > s.at + 230) {
    const to = sv ?? { x: s.to.x, y: s.to.y }, dir = Math.sign(to.x - q.x) || 1, d = prog(g.t, s.at + 230, s.at + 650)
    const far = Math.abs(to.x - q.x) > 0.9
    kx = q.x + dir * Math.max(0, Math.abs(to.x - q.x) - (sv?.saved ? 0.5 : 1.1)) * easeOut(d)
    kpose = far ? { ...POSE.dive, rot: dir * lerp(0.3, 1.4, easeOut(d)) } : { ...POSE.set, hlx: dir * 28 - 8, hly: -50, hrx: dir * 28 + 8, hry: -50 }
    klift = far ? Math.sin(d * Math.PI) * 0.3 : 0
  } else if (g.pass?.ok && g.t > g.pass.at + 200) {
    const d = prog(g.t, g.pass.at + 200, g.pass.at + 800), dir = g.rs
    kx = q.x + dir * 1.8 * easeOut(d); kpose = { ...POSE.dive, rot: dir * 1.3 * easeOut(d) }; klift = Math.sin(d * Math.PI) * 0.3
  }
  if (g.res === 'goal') { const kb = keeperBeaten(g.cel, age, { x: kx, z: kz, rot: kpose.rot || (g.assist ? g.rs : 1) * 1.3, ball: { x: g.assist ? g.rs * -1.6 : s.to.x, z: NET_D - 0.4 } }); kx = kb.x; kz = kb.z; kpose = kb.pose; kfront = kb.front ?? true; klift = age < 300 ? klift : 0 }
  else if (g.res === 'saved' && age > 600) { kpose = mix({ ...kpose, rot: (kpose.rot ?? 0) * (1 - prog(age, 600, 1000)) }, keeperRoar(Math.max(0, age - 1000)), easeOut(prog(age, 600, 1000))); klift *= 1 - prog(age, 600, 1000) }
  else if (g.res && age > 500) kpose = mix(kpose, POSE.stand, easeOut(prog(age, 500, 900)))
  men.push({ x: kx, z: kz, pose: { ...kpose, hy: (kpose.hy ?? 50) + (g.res ? 0 : Math.abs(Math.sin(g.t / 160)) * 2) }, look: dress(K.gk, g.who.gk ?? { number: 1, skin: '#c09060' }, { front: kfront, sleeves: true }), o: { lift: klift } })
  const c = g.cb
  let cpose
  if (g.res === 'goal') cpose = defenderBeaten(0, age, runPose(c.cyc % 1, 0.4))
  else if (g.res && age > 300) cpose = g.res === 'cut' || g.res === 'blocked' || g.res === 'late' ? mix(POSE.stand, POSE.fist, easeOut(prog(age, 300, 650))) : POSE.stand
  else if (c.side === 1) cpose = { ...POSE.ready, lean: 0.06, bow: 0.25, hy: 46, lx: -14, rx: 14, lk: 0.4, rk: 0.4 }   // stepping up to you, low
  else if (c.side === -1) cpose = runPose(c.cyc % 1, 0.9)                                                              // turned and running across
  else cpose = { ...POSE.ready, hy: 47 + Math.abs(Math.sin(c.cyc * Math.PI * 2)) * 1.5, lx: -13, rx: 13, lk: 0.3, rk: 0.3, lean: Math.sin(c.cyc * Math.PI * 2) * 0.03 }   // jockeying
  men.push({ x: c.x, z: c.z, pose: cpose, look: dress(K.them, g.who.cb ?? { number: 5, skin: '#5e3c22' }, { front: true }) })
  // the runner (his arm up for it once he's free) and you; once it's a goal, the celebration has the two of you
  const m = g.mate
  let mp = { x: m.x, z: m.z, pose: runPose(m.cyc % 1), lift: 0, turn: 0 }, me = { x: g.me.x, z: g.me.z, pose: mePose(g), lift: 0, turn: 0 }
  if (g.commitAt != null && g.goes === 'ball' && !g.act && !g.res) mp.pose = { ...mp.pose, ...(g.rs < 0 ? { hlx: -24, hly: -116, fl: 1 } : { hrx: 24, hry: -116, fr: 1 }) }
  if (g.pass?.ok && !g.res) { const a = g.t - g.pass.at - PASS_MS; if (a > -80) mp.pose = kickPose(clamp((a + 80) / 380, 0, 1), -g.rs) }
  if (g.res === 'goal') {
    const sc = scorerAt(g.cel, age), mt = mateAt(g.cel, 0, age, sc)
    if (g.assist) { mp = sc; me = mt } else { me = sc; mp = mt }
  } else if (g.res && age > 300) mp.pose = mix(mp.pose, POSE.hips, easeOut(prog(age, 300, 700)))
  men.push({ x: mp.x, z: mp.z, pose: mp.pose, look: dress(K.us, g.who.mate ?? { number: 7, skin: '#f0c4a0' }), o: { lift: mp.lift, turn: mp.turn } })
  men.push({ x: me.x, z: me.z, pose: me.pose, look: dress(K.us, g.who.me ?? { number: 9, skin: '#8d5a3b' }), o: { name: g.res ? null : g.who.me?.name, lift: me.lift, turn: me.turn } })
  for (const [i, ch] of g.chase.entries()) men.push({ x: ch.x, z: ch.z, pose: g.res === 'goal' ? defenderBeaten(i + 1, age, runPose(ch.cyc % 1, 0.4)) : runPose(ch.cyc % 1, g.res ? 0.4 : 1), look: dress(K.them, { number: i ? 4 : 3, skin: i ? '#c09060' : '#3a2a1e' }) })
  men.sort((a, c2) => c2.z - a.z)
  let ballDone = b.z > 0.05
  for (const mm of men) {
    if (!ballDone && b.z > mm.z) { ball(ctx, C, b.x, b.y, b.z, b.spin); ballDone = true }
    man(ctx, C, mm.x, mm.z, mm.pose, mm.look, mm.o ?? {})
  }
  if (!ballDone) ball(ctx, C, b.x, b.y, b.z, b.spin)
  // the aim on the goal, the shot's bar, the controls
  if (!g.res && !g.shot && !g.pass) { const a = aimTo(g.k.aim.x, g.k.aim.y); aimMark(ctx, C, a.x, a.y, { alpha: g.k.phase === 'idle' ? 0.6 : 1 }) }
  shotHud(ctx, view, g.k, { t: g.t, y: view.h - (view.keys ? 64 : 186) })
  drawControls(ctx, view, g.ctl, { stick: 'AIM', a: 'SHOOT', b: 'PASS' }, !g.done, g.t)
  if (!g.act && !g.res && g.t < 1900) tip(ctx, view, 'HE STEPS UP: PASS · HE DROPS OFF: SHOOT', undefined, 13)
  placeStamp(g.stamp, view)
}
