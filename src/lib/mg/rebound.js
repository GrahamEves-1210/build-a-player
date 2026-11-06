// Crash the glass: three shots go up, each comes off the rim to one side on an arc you can see.
// Press that side: the jump takes a fixed time to reach the top and the hands stay up for a window
// set by the trait, so the ball has to land in your hands. Too early and you're coming down, too
// late and the other big, who goes up at a set moment, takes it. The wrong side has no chance.
import { byV, clamp, lerp, prog, easeOut, rngOf, outcome, layer, text, themOf, nudge, reduceMotion, GOOD, BAD, GOLD, DISPLAY } from './kit.js'
import { pose, mixPose, copyPose, newPose, easedState, easedPose, smoothT, CLK, paintRoom, paintLines, paintHoop, rimHalf, netOf, ballIn, athleteFront, project, PT, FIG_FT, RIM_R, RIM_Y, BALL_R, SKINS, IN_HANDS, meterTag, warmCrowd, crowdUp, boardFlash, camFlashes, lightFx, R_UP } from './meter.js'
import { castMen } from './read.js'

export const how = {
  board: 'Read which side it comes off. Press that side as the ball hits the gold ring: it lands in your hands at the top.',
}

const RISE = 230          // press to the top of the jump
const FALL = 300          // the top back to the floor
const FLIGHT = 700        // the shot's trip to the rim
const OP_RISE = 250       // the other big's jump...
const OP_LATE = 34        // ...gets to the ball this long after it arrives
const REST = 760          // from the rebound to the next shot going up

// the call at the end. It can't say BOXED OUT unless he just was
export const finalWord = (made, gotLast) => (made === 3 ? 'ALL GLASS' : made === 2 ? '2 OF 3' : gotLast ? `${made} OF 3` : 'BOXED OUT')
export function make({ v, seed, game }) {
  const r = rngOf(seed)
  const look = rngOf(`${seed}|look`)   // (what things look like, never what happens)
  const win = lerp(58, 145, clamp((v - 1) / 10, 0, 1) ** 1.2)
  const bounceUnits = byV(v, 32, 44)
  let at = 420, last = null, run = 0
  const reps = Array.from({ length: 3 }, (_, k) => {
    let side = r() < 0.5 ? 0 : 1
    if (side === last && run >= 2) side = 1 - side
    run = side === last ? run + 1 : 1; last = side
    const air = lerp(800, 690, k / 2) + lerp(-25, 25, r())
    const hitAt = at + FLIGHT, arriveAt = hitAt + air
    const b = { k, side, upAt: at, hitAt, air, arriveAt, aimAt: arriveAt - RISE - win / 2, press: null, res: null, q: 0, why: null, doneAt: 0, pop: 0.8 + r() * 0.3, hitFx: false, glass: look() < 0.4, glassFx: false }
    at = arriveAt + REST
    return b
  })
  const g = {
    t: 0, game, zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, litAt: -999, fx: [], done: null, outro: 1500, stamp: null,
    reps, rep: reps[0], win, bounce: bounceUnits, look: look(), nudge: nudge(),
    hud: { prompt: 'READ THE RIM', dots: reps.map(() => null), hot: false },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      const b = g.rep
      if (b.glass && !b.glassFx && g.t >= b.upAt + FLIGHT * GLASS_F) { b.glassFx = true; g.fx.push('pop') }
      if (!b.hitFx && g.t >= b.hitAt) { b.hitFx = true; g.fx.push('rimmiss', 'h:light'); g.hud.prompt = 'GO UP'; g.hud.hot = true }
      if (!b.res && g.t >= b.arriveAt) settle(b)
      if (b.res && !g.done && b.k < reps.length - 1 && g.t >= reps[b.k + 1].upAt) {
        g.rep = reps[b.k + 1]
        g.hud.prompt = 'READ THE RIM'; g.hud.hot = false
      }
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const side = a.zone === 'L' ? 0 : a.zone === 'R' ? 1 : null
      if (side == null) return
      g.padLit = side; g.litAt = g.t
      const b = g.rep
      if (b.press || b.res || g.t < b.upAt) return
      b.press = { side, at: g.t }
      g.fx.push('h:light')
    },
  }
  function settle(b) {
    const p = b.press
    let ok = false, why
    if (!p) why = 'late'
    else if (p.side !== b.side) why = 'wrong'
    else if (p.at + RISE > b.arriveAt) why = 'late'
    else if (p.at + RISE + win < b.arriveAt) why = 'early'
    else { ok = true; why = 'clean' }
    b.res = ok ? 'us' : 'them'; b.why = why; b.doneAt = g.t
    b.q = ok ? clamp(1 - (Math.abs(p.at - b.aimAt) / (win / 2)) * 0.4, 0.6, 1) : 0
    g.hud.dots[b.k] = ok
    g.hud.prompt = null; g.hud.hot = false
    g.fx.push(ok ? 'catchball' : 'pop', ok ? 'h:medium' : 'h:light')
    if (b.k === reps.length - 1) {
      const made = reps.filter(x => x.res === 'us').length
      const hit = made >= 2
      g.done = outcome(reps.reduce((s, x) => s + x.q, 0) / 3, hit, `${made} of 3 rebounds`, { made, of: 3 })
      g.stamp = { text: finalWord(made, b.res === 'us'), good: hit, at: g.t + 900, y: 100, size: 44 }
      g.outro = (g.outro ?? 1500) + 700
    }
  }
  return g
}
const GLASS_F = 0.72      // a shot off the glass: how far through its trip it hits the board

// ── The picture: from the free-throw line, the two bigs with their backs to us ──────
// One camera for the court, the hoop and the ball (lib/mg/meter.js), so the ball's depth is real:
// in front of the board always, over the back of the rim and under the front of it while it's on
// the iron, and in front of everything once it's coming off toward us.
let G0 = null
const CAM_Z = 16, US_Z = -4, THEM_Z = -3.2, H = 7
function geoOf(view) {
  if (G0 && G0.h === view.h) return G0
  const h = view.h, U = h / 640, floor = h - 150, ppf = 33.8 * U, F = ppf * (CAM_Z + US_Z), hz = floor - H * ppf
  G0 = { h, U, floor, ppf, s: ppf / FIG_FT, wallY: hz + (H * F) / 42, cam: { F, H, px: 180, hz, cos: 1, sin: 0, cx: 0, cz: -CAM_Z }, off: 2.95 }
  return G0
}
// the poses
const STANCE = pose({ hy: 40, fFx: 16, fBx: -16, hFx: 23, hFy: 62, hBx: -23, hBy: 62 })
const REACH = pose({ hy: 49, fFx: 8, fBx: -8, fFy: 2, fBy: 4, hFx: 11, hFy: 125, hBx: -11, hBy: 123 })
const SECURE = pose({ hy: 42, fFx: 14, fBx: -14, hFx: 10, hFy: 114, hBx: -10, hBy: 114 })
// brought down under the chin with the elbows out: nobody's taking it
const CHIN = pose({ hy: 39, fFx: 17, fBx: -17, hFx: 13, hFy: 88, hBx: -13, hBy: 88 })
const BEATEN = pose({ hx: 3, hy: 42, lean: 0.14, fFx: 19, fBx: -14, hFx: 30, hFy: 60, hBx: -24, hBy: 74 })
const HIPS = pose({ hy: 46, fFx: 12, fBx: -12, hFx: 18, hFy: 53, hBx: -18, hBy: 53 })
const US = newPose(), OP = newPose(), usEase = easedState(), opEase = easedState()
const CARRY = { ...IN_HANDS, x: -9, y: 8 }
const liftAt = (tau, win) => {
  if (tau <= 0) return 0
  if (tau < RISE) return easeOut(tau / RISE)
  if (tau < RISE + win) return 1
  return Math.max(0, 1 - ((tau - RISE - win) / FALL) ** 2)
}
// the arc off the rim, in feet: from the iron, out and down to the catch
const AP = { x: 0, y: 0, z: 0 }
function arc(b, dir, Yc, off, f) {
  const x0 = dir * RIM_R * 0.62, y0 = RIM_Y + BALL_R * 0.9
  AP.x = lerp(x0, dir * off, f); AP.z = lerp(-0.1, US_Z, f)
  AP.y = lerp(y0, Yc, f) + 4 * f * (1 - f) * (1.5 + b.pop * 1.5)
  return AP
}
// where the ball is before someone has it. false: no free ball right now
function freeBall(g, b, dir, Yc, off) {
  if (g.t < b.upAt) return false
  if (g.t < b.hitAt) {
    const f = (g.t - b.upAt) / FLIGHT, sx = (b.k % 2 ? 1.2 : -1.2), gx = dir * 0.9, gy = 11.9, gz = 1.25 - BALL_R
    if (b.glass && f < GLASS_F) {
      // up onto the glass
      const u = f / GLASS_F
      AP.x = lerp(sx, gx, u); AP.z = lerp(-11, gz, u); AP.y = lerp(3, gy, u) + 4 * u * (1 - u) * 4.6
    } else if (b.glass) {
      // and down onto the iron, on the side it'll come off
      const u = (f - GLASS_F) / (1 - GLASS_F)
      AP.x = lerp(gx, dir * RIM_R * 0.62, u); AP.z = lerp(gz, -0.1, u); AP.y = lerp(gy, RIM_Y + BALL_R * 0.9, u * u)
    } else {
      AP.x = lerp(sx, dir * RIM_R * 0.62, f); AP.z = lerp(-11, -0.1, f)
      AP.y = lerp(3, RIM_Y + BALL_R * 0.9, f) + 4 * f * (1 - f) * 5.4
    }
    return true
  }
  if (!b.res) { arc(b, dir, Yc, off, clamp((g.t - b.hitAt) / b.air, 0, 1)); return true }
  return false
}
export function draw(ctx, g, view) {
  const G = geoOf(view), { U, s, floor, ppf, cam, off } = G, c = view.colors, them = themOf(view), M = castMen(g, view)
  smoothT(g)
  layer(ctx, view, `mg-board-${c.us}-${c.trim}-${c.them}`, x => {
    paintRoom(x, view, G, c, 'board')
    paintLines(x, cam, c.us)
    paintHoop(x, cam, c.us)
  })
  const b = g.rep, dir = b.side ? 1 : -1, J = g.bounce, Yc = (124 + J) / FIG_FT
  const age = b.res ? g.t - b.doneAt : -1
  const rimAge = g.t - b.hitAt
  const dy = rimAge >= 0 && rimAge < 500 ? Math.sin(rimAge / 26) * Math.exp(-rimAge / 120) * 4.5 * U : 0
  const free = freeBall(g, b, dir, Yc, off), spin = (g.t / 70) * dir
  // the hoop, with the ball between its halves while it's on the iron
  const onIron = free && Math.abs(AP.z) <= RIM_R && AP.y > RIM_Y - 0.2 && Math.abs(AP.x) <= RIM_R + BALL_R
  const bx = AP.x, by = AP.y, bz = AP.z
  rimHalf(ctx, cam, false, dy)
  if (onIron) ballIn(ctx, cam, bx, by, bz, spin)
  netOf(ctx, cam, null, dy, rimAge)
  rimHalf(ctx, cam, true, dy)

  // the other big goes up at his set moment, to the same ball from his side
  const opAt = b.arriveAt + OP_LATE - OP_RISE, opTau = g.t - opAt
  project(cam, 0, 0, THEM_Z)
  const opK = PT.k, opFloor = PT.y
  const opBase = 1.5, opTop = dir * off + dir * 0.95
  const opLift = opTau < OP_RISE ? (opTau > 0 ? easeOut(opTau / OP_RISE) : 0) : Math.max(0, 1 - ((opTau - OP_RISE - 70) / FALL) ** 2)
  const backOp = b.res ? prog(age, 340, 720) : 0
  const opFt = lerp(opBase + Math.sin(g.t / 170) * 0.06, opTop, easeOut(opTau > 0 ? prog(opTau, 0, OP_RISE) : 0) * (1 - backOp))
  const opHas = b.res === 'them' && age >= 0 && age < 420
  const lastRep = b.k === g.reps.length - 1
  // the two of them leaning on each other the whole time, a shove every so often
  const shove = Math.sin(g.t / 310) * Math.max(0, Math.sin(g.t / 1130 + 1)), jostle = shove * 0.2
  if (opLift > 0.01) { mixPose(opHas ? SECURE : STANCE, REACH, opLift, OP); OP.j = opLift * (J - 4) }
  else if (opHas) copyPose(SECURE, OP)
  else if (b.res === 'them' && age < 760) mixPose(CHIN, STANCE, prog(age, 420, 760), OP)
  else if (b.res === 'us' && age >= 0 && age < 760) copyPose(BEATEN, OP)
  else { copyPose(STANCE, OP); OP.hy += Math.sin(g.t / 190) * 0.8; OP.lean = -0.05 - shove * 0.05 }
  // a board taken off him knocks him off his spot
  const knocked = b.res === 'us' && age >= 0 ? Math.exp(-age / 420) * Math.min(1, age / 70) * 1.1 * dir : 0
  const opX = 180 + (opFt + jostle * 0.5 + knocked) * opK
  athleteFront(ctx, opX, opFloor, easedPose(opEase, OP, g, CLK.dt, 20), { jersey: them.color, trim: them.trim, s: opK / FIG_FT, back: true, num: M?.them[0].number ?? 44, skin: M?.them[0].skin ?? SKINS[3], ball: opHas || (b.res === 'them' && age < 420) ? CARRY : null })

  // him: the press commits him, up and across
  const p = b.press, tau = p ? g.t - p.at : 0, pDir = p ? (p.side ? 1 : -1) : -1
  const lift = p ? liftAt(tau, g.win) : 0
  const has = b.res === 'us' && age >= 0 && age < 420
  const backUs = b.res ? prog(age, 340, 720) : 0
  const usFt = lerp(-1.5 + Math.sin(g.t / 150) * 0.06 + jostle, p ? pDir * off : -1.5, (p ? easeOut(prog(tau, 0, RISE)) : 0) * (1 - backUs))
  if (lift > 0) { mixPose(has ? SECURE : STANCE, REACH, lift, US); US.j = lift * J; US.fFy += lift * 8; US.fBy += lift * 2; US.fFx = lerp(US.fFx, 12, lift) }
  else if (has) copyPose(CHIN, US)
  else if (b.res === 'them' && age >= 0 && age < 800) { copyPose(BEATEN, US); US.lean = -BEATEN.lean * dir; US.hx = -BEATEN.hx * dir }
  else { copyPose(STANCE, US); US.hy += Math.sin(g.t / 170) * 0.8; US.lean = 0.05 + shove * 0.05 }
  // when it's over
  if (g.done && lastRep && age > 480) {
    if (!g.done.hit) mixPose(US, HIPS, prog(age, 480, 700), US)
  }
  if (b.res === 'us' && !b.bumped && age >= 0) { b.bumped = true; g.nudge.kick(g.t, 2.4, 0, 1, 170) }
  const ux = 180 + usFt * ppf, ry = (6.5 - clamp(US.j / 60, 0, 1) * 1.5) * U
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(ux, floor + 3 * U, 47 * U, 11 * U + ry - 6.5 * U, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * U; ctx.stroke()
    athleteFront(ctx, ux, floor, easedPose(usEase, US, g, CLK.dt, 20), { jersey: c.us, trim: c.trim, s, back: true, num: M?.us[0].number ?? 12, skin: M?.us[0].skin ?? SKINS[0], ball: has ? CARRY : null })
  // (between their feet: the prompt sits right under his)
  if (M) { meterTag(ctx, view, 180 + opFt * opK, opFloor - 11, M.them[0].name, opK / FIG_FT); meterTag(ctx, view, ux, floor - 11, M.us[0].name, s) }

  // coming off the rim: the arc it's on, the ring where it lands, the gold ring that says go
  if (g.t >= b.hitAt && !b.res) {
    const f = clamp((g.t - b.hitAt) / b.air, 0, 1)
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath()
    for (let i = 1; i <= 15; i++) {
      const u = i / 16
      if (u < f) continue
      arc(b, dir, Yc, off, u); project(cam, AP.x, AP.y, AP.z)
      ctx.rect(PT.x - 1.4 * U, PT.y - 1.4 * U, 2.8 * U, 2.8 * U)
    }
    ctx.fill()
    project(cam, dir * off, Yc, US_Z)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4 * U
    ctx.beginPath(); ctx.arc(PT.x, PT.y, BALL_R * PT.k + 3 * U, 0, Math.PI * 2); ctx.stroke()
    const aim = clamp((b.aimAt - b.hitAt) / b.air, 0.02, 1)
    if (f < aim + 0.06) {
      arc(b, dir, Yc, off, aim); project(cam, AP.x, AP.y, AP.z)
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3.6 * U
      ctx.beginPath(); ctx.arc(PT.x, PT.y, BALL_R * PT.k + 4 * U, 0, Math.PI * 2); ctx.stroke()
    }
  }
  // the free ball, this side of everything once it's off the iron
  if (free && !onIron) ballIn(ctx, cam, bx, by, bz, spin)
  // the outlet: out of his hands and off past us
  if (b.res && age >= 420 && age < REST - 150) {
    const f = prog(age, 420, REST - 150), holder = b.res === 'us' ? usFt : opFt / 1.1
    ballIn(ctx, cam, lerp(holder, holder * 0.4, f), lerp(7, 3, f), lerp(US_Z, -7.5, f), g.t / 80)
  }
  // the verdict on the play
  if (b.res && age < 620 && !(g.done && b.k === g.reps.length - 1)) {
    const word = b.res === 'us' ? 'BOARD' : b.why === 'early' ? 'TOO SOON' : b.why === 'wrong' ? 'WRONG WAY' : 'TOO LATE'
    text(ctx, word, 180, cam.hz + 4 * U, { font: DISPLAY, size: 30 * U, color: b.res === 'us' ? GOOD : BAD })
  }
}
