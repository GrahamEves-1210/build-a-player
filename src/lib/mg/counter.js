// 2-ON-1: the break. You've got the ball through the middle, a teammate flying up the wing, one man back and the keeper.
// The last defender backs off, and sooner or later he has to commit:
//   he steps up to you        → PASS: square it to the runner for the tap-in
//   he drops off to the runner → SHOOT: it's you and the keeper. soccer.js's shot, the same as every soccer game's: aim
//                                with the stick (held down: low), hold for power, let go, tap again as you strike it
// Go before he's committed and he reads it: the pass is cut out, the shot's blocked. He can sell you a step one way
// before he goes the other. Leave it too long and he's on you (or back across to block it).
// Or DRAW the shot (soccer.js's draw the shot): a finger anywhere but on PASS, a mouse anywhere. The stroke is read as
// though it's drawn from the ball (the ring on the goal shows where it's going): where it points, its pace the power,
// a bow in it the curl. The moment the finger goes down is the moment he's chosen to shoot; drawn back across toward
// the runner, it's the square ball instead.
// Link-up play buys the time to read him, finishing and composure the shot.
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, particles, nudge, manOf, text, rr, LABEL } from './kit.js'
import { placeStamp } from './read.js'
import {
  camOf, stadium, net, goalFrame, ball, man, POSE, mix, runPose, dribblePose, kickPose, kitsOf, dress, boardWords, flashes, crowdUp,
  shooter, strikeOf, shotAt, keeperSave, shotHud, aimMark, aimTo, celebration, scorerAt, mateAt, keeperBeaten, keeperShot, keeperDive, keeperLanded, heldBall, defenderBeaten,
  strikerDenied, celebMs, skipOutro, POST, BAR, NET_D, P,
  stroke, strokeDown, strokeMove, strokeUp, readStroke, drawnShot, strokeTrail, ghostStroke, drawnSoFar,
} from './soccer.js'
import { newCtl, control, stickOf, drawControls, tip, padsOf } from './soccerPads.js'

export const how = {
  'two-on-one': 'A break, the runner up the wing, one man back. Watch him: he steps up to you, PASS and square it for the tap-in; he drops off to the runner, draw your shot. Go before he commits and he reads it; leave it too long and he’s back.',
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
const RUNNER_X = 6.2         // the runner's line, wide of you: in the picture from the first second

export function make({ v, seed, cast = null, situation = null }) {
  const r = rngOf(seed)
  const rs = r() < 0.5 ? -1 : 1                          // the runner's side
  const x0 = (r() - 0.5) * 2
  const commitGap = 7.2 + r() * 2.2                      // he commits when you're this close
  const goes = r() < 0.5 ? 'ball' : 'runner'
  const fake = r() < 0.45
  const W = byV(v, 1000, 1300)
  const k = shooter(v, { fill: FILL, windup: WINDUP, pressure: situation ? 0.5 : 0 })
  const g = {
    t: 0, zones: 'none', stick: true, fx: [], done: null, doneAt: null, outro: celebMs() + 300, stamp: null,
    sit: situation ?? null, seed,
    who: { me: manOf(cast, 'us', 'st', 0), mate: manOf(cast, 'us', 'st', 1), cb: manOf(cast, 'them', 'cb', 0), gk: manOf(cast, 'them', 'gk', 0) },
    rs, W, v, goes, fake, commitGap, k,
    me: { x: x0, z: START_Z, cyc: 0 }, mate: { x: rs * RUNNER_X, z: START_Z + 0.6, cyc: 0.4 },
    cb: { x: rs * 1.1, z: -25, cyc: 0, side: 0 }, gk: { x: 0, z: -0.4 },
    chase: [{ x: -rs * 7.5, z: START_Z - 4.5, cyc: 0.2 }, { x: rs * 10.5, z: START_Z - 6, cyc: 0.7 }],
    commitAt: null, showAt: null, showTo: null, act: null, actAt: null, read: null,
    shot: null, pass: null, save: null, res: null, endAt: null, popAt: null, why: null, cel: null, assist: false,
    ctl: newCtl(), vh: 640, st: stroke(), lastView: null, keysView: false, downAt: null,
    camX: x0 * 0.5, camZ: START_Z - 14,
    dirt: particles(24, 4), nudge: nudge(),
    hud: { prompt: null },
    tick(dt) {
      g.t += dt
      const s = dt / 1000
      const st = stickOf(g.ctl)
      if (!g.shot && k.phase !== 'done') k.aimAt(st.x, st.y)
      const live = !g.res && !g.act && !k.drawing   // (a finger down drawing it: he's chosen, the shot's coming)
      // you, the runner, the men chasing back (once it's a goal the celebration has them)
      if (!g.cel) {
        const mySp = g.shot ? RUN * Math.max(0, 1 - (g.t - g.shot.at) / 600) : g.pass ? RUN * Math.max(0.3, 1 - (g.t - g.pass.at) / 900) : g.res ? Math.max(0, RUN * (1 - (g.t - g.endAt) / 500)) : RUN
        g.me.z += mySp * s; g.me.x += -g.me.x * 0.25 * s; g.me.cyc += (mySp * s) / 2.5
        const mSp = g.res ? Math.max(0, RUN * (1 - (g.t - g.endAt) / 700)) : RUN * 1.02
        // the runner holds his line wide, then bends in toward the back post
        const wantX = rs * lerp(RUNNER_X, 3.2, clamp((g.mate.z + 24) / 18, 0, 1))
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
      if (g.shot && !g.res && g.t >= g.shot.at + (g.shot.block ? 180 : g.shot.kind === 'saved' && g.save ? g.save.f * g.shot.T : g.shot.T)) land()
      if (g.pass && !g.res && g.t >= g.pass.at + PASS_MS + (g.pass.ok ? TAP_MS : 260)) finishPass()
      // the camera rides behind you, a little to the runner's side, and stops once it's done
      const kk = g.res ? 1 - Math.exp(-dt / 300) : 1
      g.camZ += (Math.min(g.me.z - 14, -17) - g.camZ) * kk; g.camX += ((g.me.x + rs * 1.9) * 0.6 - g.camX) * kk
    },
    input(a) {
      if (g.done) { skipOutro(g, a); return }
      if (drawIn(a)) return
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
  const readNow = (t = g.t) => (g.commitAt == null || t < g.commitAt ? 'early' : g.goes)
  // ── drawing it: anywhere but PASS ──
  const camNow = () => camOf(g.lastView ?? { w: 360, h: g.vh }, { x: g.camX, y: 5.8, z: g.camZ, F: 440, hzAt: 0.15 })
  g.aimView = () => { const C = camNow(); return { C, ball: P(C, g.me.x + 0.25, 0.11, g.me.z + 0.75) } }
  function drawIn(a) {
    if (a.kind !== 'down' && a.kind !== 'move' && a.kind !== 'up') return false
    const id = a.id ?? 0, st = g.st
    if (a.kind === 'down') {
      if (!g.keysView) { const B = padsOf(g.vh).b; if (Math.hypot(a.x - B.x, a.y - B.y) < B.r + 14) return false }
      if (!g.act && !g.res && k.shape(g.t)) { strokeDown(st, a.x, a.y, g.t, id, null); g.downAt = g.t }
      return true
    }
    if (id !== st.id) return false
    if (a.kind === 'move') { strokeMove(st, a.x, a.y, g.t, id); return true }
    strokeUp(st, a.x, a.y, g.t, id)
    if (!k.drawing || g.act || g.res) { if (k.drawing) k.reset(); return true }
    const v0 = g.aimView(), rd = readStroke(st, v0.C, { foot: 1, origin: v0.ball })
    if (rd.tap) { k.reset(); return true }
    if (rd.back) {
      // drawn back across toward the runner: the square ball (judged as he chose it, when the finger went down)
      k.reset()
      if (Math.sign(rd.dx) === Math.sign(g.mate.x - g.me.x)) { passPress(); g.read = readNow(g.downAt) ; g.pass.ok = g.read === 'ball' }
      return true
    }
    g.act = 'shoot'; g.actAt = g.downAt; g.read = readNow(g.downAt)
    drawnShot(k, rd, g.t, WINDUP)
    g.fx.push('h:light')
    return true
  }
  function passPress() {
    if (g.act) return
    g.act = 'pass'; g.actAt = g.t; g.read = readNow()
    g.pass = { at: g.t, from: { x: g.me.x, z: g.me.z }, ok: g.read === 'ball' }
    g.fx.push('tap', 'h:light')
  }
  function shootPress(down) {
    if (k.drawing || k.drawn) return
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
        const sv = keeperSave(s, { x: g.gk.x, z: g.gk.z, reach: 0.9, dive: 3.6, react: 260, up: 2.4 }, r)
        g.save = sv; s.kind = sv.saved ? 'saved' : 'goal'
        s.why = sv.saved ? (sv.stretch > 0.8 ? 'Good save, down to his side' : 'Too close to the keeper') : Math.abs(s.to.x) > POST - 0.8 ? 'Into the corner, past the keeper' : 'Slotted it past the keeper'
      }
    }
    if (s.block) s.kind = 'blocked'
    // the keeper goes for one on target (and one off the woodwork): soccer.js's keeperShot draws it
    if (!s.block && (g.save || s.kind === 'wood')) { const sv = s.kind === 'wood' ? null : g.save; g.kShot = { x0: g.gk.x, z: g.gk.z, go: s.at + 260, cross: s.at + (sv?.f ?? 1) * s.T, ball: sv ? { x: sv.x, y: sv.y } : { x: s.to.x, y: s.to.y }, saved: !!sv?.saved, held: !!sv?.held } }
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
    g.done = outcome(score ?? (kind === 'saved' || kind === 'wood' ? 0.3 : 0.12), goal, why, goal && assist ? { assist: true } : null)   // (squared for the tap-in: the goal is a teammate's, the assist is his)
    g.stamp = { text: goal ? 'GOAL' : kind === 'saved' ? 'SAVED' : kind === 'blocked' ? 'BLOCKED' : kind === 'late' ? (g.goes === 'ball' ? 'TACKLED' : 'BLOCKED') : kind === 'cut' ? 'CUT OUT' : kind === 'wood' ? 'OFF THE WOODWORK' : 'MISSED', good: goal, at: g.t, size: 50, sub: why }
    if (goal) {
      g.popAt = g.t; g.fx.push('h:success'); g.nudge.kick(g.t, 2.5, 0, 1, 180)
      // the scorer peels away, the other one after him
      const scorer = assist ? g.mate : g.me, other = assist ? g.me : g.mate
      const side = assist ? rs : (scorer.x < 0 ? -1 : 1)
      // (off toward the corner of the box on his side, in front of the camera, not out past it)
      g.cel = celebration(`${seed}-21`, { sit: g.sit, from: { x: scorer.x, z: scorer.z }, side, toward: { x: scorer.x * 0.4 + side * 4.5, z: Math.max(scorer.z - 1.5, -9) }, mates: [{ x: other.x, z: other.z, who: assist ? g.who.me : g.who.mate }] })
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
  // (a save is made where the keeper is, off his line: the ball never goes on through him)
  const endMs = s.kind === 'saved' && g.save ? g.save.f * s.T : s.T
  if (a < endMs) return shotAt(s, a)
  const after = a - endMs, end = shotAt(s, endMs)
  if (s.kind === 'goal') { const f = clamp(after / 200, 0, 1), drop = clamp((after - 200) / 420, 0, 1); return { x: end.x, y: Math.max(0.11, end.y - drop * drop * end.y), z: lerp(0, NET_D - 0.25, easeOut(f)), spin: 15 } }
  if (s.kind === 'saved') {
    const f = clamp(after / 600, 0, 1), q = g.save ?? end
    if (g.save?.held) return { x: q.x, y: q.y, z: g.gk.z - 0.25, spin: 0, held: true, age: after }
    // palmed away to the side and back out into play
    return { x: q.x + (Math.sign(q.x - g.gk.x) || 1) * f * 2.8, y: Math.max(0.11, q.y + Math.sin(f * Math.PI) * 0.6 - f * q.y), z: g.gk.z - 0.2 - f * 1.2, spin: 15 }
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
  g.vh = view.h; g.keysView = !!view.keys; g.lastView = { w: view.w, h: view.h }
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
  const ballIn = { x: g.assist ? g.rs * -1.6 : s?.to.x ?? 0, z: NET_D - 0.4 }
  let kp = { x: q.x, z: q.z, lift: 0, front: true, pose: g.me.z > -22 ? POSE.set : POSE.ready }
  if (g.kShot) kp = keeperShot(g.t, { ...g.kShot, res: g.res, resAt: g.endAt, cel: g.cel, ballIn })
  else if (g.pass?.ok && g.t > g.pass.at + 200) {
    // squared across him: he throws himself at the runner's side, and it's rolled in behind him
    const t0 = g.pass.at + 200, D = { hx: 2, hy: 0.45, at: 520 }, d = keeperDive(g.t - t0, g.rs, D), landAt = t0 + d.end + 80
    if (g.res === 'goal' && g.t >= landAt) { const L = keeperLanded(g.rs, D); kp = keeperBeaten(g.cel, g.t - Math.max(landAt, g.endAt), { x: q.x + L.dx, z: q.z, rot: L.rot, lift: L.lift, ball: ballIn }) }
    else kp = { x: q.x + d.dx, z: q.z, lift: d.lift, pose: d.pose, front: true }
  } else if (g.res === 'goal') kp = keeperBeaten(g.cel, age, { x: q.x, z: q.z, rot: 0, ball: ballIn })
  else if (g.res && age > 500) kp = { ...kp, pose: mix(kp.pose, POSE.stand, easeOut(prog(age, 500, 900))) }
  else if (!g.res && !s) kp = { ...kp, pose: { ...kp.pose, hy: kp.pose.hy + Math.abs(Math.sin(g.t / 160)) * 2 } }
  if (b.held) { const h = heldBall(kp, b.age); b.x = h.x; b.y = h.y }
  men.push({ x: kp.x, z: kp.z, pose: kp.pose, look: dress(K.gk, g.who.gk ?? { number: 1, skin: '#c09060' }, { front: kp.front ?? true, sleeves: true }), o: { lift: kp.lift ?? 0 } })
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
  const dr = g.k.drawn
  if (!g.res && !g.shot && !g.pass && dr) aimMark(ctx, C, dr.x, dr.y)
  else if (!g.res && !g.shot && !g.pass && !g.k.drawing && (view.keys || g.k.phase !== 'idle')) { const a = aimTo(g.k.aim.x, g.k.aim.y); aimMark(ctx, C, a.x, a.y, { alpha: g.k.phase === 'idle' ? 0.6 : 1 }) }
  strokeTrail(ctx, g.st, g.t, { C, k: g.k, foot: 1, origin: P(C, g.me.x + 0.25, 0.11, g.me.z + 0.75) })
  shotHud(ctx, view, g.k, { t: g.t, y: view.h - (view.keys ? 64 : 186) })
  // (on a phone the shot's drawn: PASS is the one button)
  drawControls(ctx, view, g.ctl, view.keys ? { stick: 'AIM', a: 'SHOOT', b: 'PASS' } : { stick: false, a: null, b: 'PASS' }, !g.done, g.t)
  // his commit, said over him the moment he makes it (the coach on the touchline): stepping up to you, or off to the runner
  if (g.commitAt != null && !g.act && !g.res) {
    const p = P(C, g.cb.x, 2.35, g.cb.z)
    if (p.ok) callout(ctx, g.goes === 'ball' ? 'HE’S STEPPED UP: SQUARE IT' : 'HE’S DROPPED OFF: SHOOT', p.x, p.y - 8)
  }
  if (!g.act && !g.res && g.t < 2600) tip(ctx, view, 'HE STEPS UP: PASS · HE DROPS OFF: SHOOT', undefined, 13)
  else if (!g.act && !g.res && !g.k.drawing && g.t < 4600) {
    // the first one: the stroke that's a shot, and the line under it
    if (drawnSoFar() < 2) { const from = view.keys ? P(C, g.me.x + 0.25, 0.11, g.me.z + 0.75) : { x: 250, y: view.h - 170 }; ghostStroke(ctx, from, { x: from.x - g.rs * 30, y: from.y - 120 }, 0.1, g.t - 1900) }
    tip(ctx, view, view.keys ? 'DRAW YOUR SHOT WITH THE MOUSE · E TO PASS' : 'DRAW YOUR SHOT · PASS TO SQUARE IT', undefined, 14)
  }
  placeStamp(g.stamp, view)
}

function callout(ctx, str, x, y) {
  ctx.font = `14px ${LABEL}`
  const w = ctx.measureText(str).width + 16 + str.length * 1.1
  x = clamp(x, w / 2 + 6, 354 - w / 2)
  ctx.fillStyle = 'rgba(6,8,10,.86)'; rr(ctx, x - w / 2, y - 12, w, 24, 3); ctx.fill()
  text(ctx, str, x, y + 0.5, { font: LABEL, size: 14, track: 1, color: '#f7cf55' })
}
