// Alley-oop, for bigs: the lob comes from the SIDE. A teammate on the wing throws it up across the lane
// toward the rim and you go up from the weak side to meet it.
//   1. Press to jump. The jump takes a fixed time to reach the top and the hands stay up for a window
//      set by the grade (a higher grade goes higher too), so the ball has to come into your hands at the
//      top. The lob's arc is drawn ahead of it: press as the ball reaches the gold ring.
//   2. Caught it: a gold ring closes on the rim. Tap as it meets the rim and you throw it down. Too
//      soon and it's off the front of the rim; a beat late and you can only lay it in (it counts, for
//      less); later than that and it rolls off.
// Three lobs, from either wing, the arc different every time. Two finished to pass.
import { byV, clamp, lerp, prog, easeIn, easeOut, easeInOut, rngOf, outcome, layer, text, themOf, nudge, basketball, GOOD, BAD, GOLD, DISPLAY } from './kit.js'
import { pose, mixPose, copyPose, newPose, easedState, easedPose, smoothT, CLK, paintRoom, paintLines, paintHoop, rimHalf, netOf, ballIn, athleteFront, project, PT, FIG_FT, RIM_R, RIM_Y, BALL_R, SKINS, warmCrowd, crowdUp, boardFlash, camFlashes, lightFx, R_UP, R_FLEX, R_HEAD, R_HIPS, frontRun } from './meter.js'
import { POSE, tagAt, tagsDown } from './arena.js'
import { castMen } from './read.js'

export const how = {
  'alley-oop': 'The lob comes in from the wing. Press as the ball hits the gold ring to meet it at the top, then tap as the ring closes on the rim to throw it down.',
}

const RISE = 300          // press to the top of the jump
const FALL = 330          // the top back to the floor
const SET = 760           // a lob's set: the wing has it, the big's on the move
const SLAM_GAP = 450      // the catch to the moment to throw it down (the ring closes on the rim)
// a press is in time if his hands are all but at the top when the ball gets there: easeOut is 97% up at 0.83 of the rise
const UP = 0.83 * RISE
const LAY = 150           // after the slam's window: still a lay-in
const THROW_S = 110, THROW_T = 200   // the tap to the ball through the iron: a two-hand slam, and a tomahawk's longer swing over the top
const throwOf = b => (b.style ? THROW_T : THROW_S)
const HANG = 430          // on the rim after a slam
const DROP = 260          // off the rim to the floor
const NEED = 2
const REST = { slam: 2050, lay: 1450, miss: 1350 }

const sideOf = (r, last, run) => {
  let s = r() < 0.5 ? -1 : 1
  if (s === last && run >= 2) s = -s
  return s
}
// the call at the end
export const finalWord = (made, slams) => (slams >= 2 ? `${slams} SLAMS` : `${made} OF 3`)

export function make({ v, seed, game }) {
  const r = rngOf(seed)
  const look = rngOf(`${seed}|look`)   // (what things look like, never what happens)
  const f = clamp((v - 1) / 10, 0, 1)
  const win = lerp(70, 172, f ** 1.1)            // the hands at the top (the window is this and RISE - UP more)
  const J = byV(v, 46, 66)                         // how high he gets, in the rig's units
  const slamWin = lerp(140, 275, f ** 1.1)         // the throw-down's window, all of it
  let at = 380, last = 0, run = 0
  const reps = Array.from({ length: 3 }, (_, k) => {
    const s = sideOf(r, last, run)
    run = s === last ? run + 1 : 1; last = s
    const relAt = at + SET + r() * 220
    const T = lerp(1440, 1280, k / 2) + lerp(-60, 60, r())   // (a lob floats: long enough for the camera to settle first)
    const apex = lerp(3.6, 6.4, r())
    const catchAt = relAt + T
    const b = { k, s, at, relAt, T, apex, catchAt, aimAt: catchAt - (RISE + win + UP) / 2, slamAt: catchAt + SLAM_GAP, press: null, caught: null, tap: null, res: null, why: null, q: 0, doneAt: 0, nextAt: Infinity, ev: [], style: look() < 0.5 ? 0 : 1, flair: look() }
    at = catchAt + SLAM_GAP + 2400   // (only a guess: the next starts when this one's done)
    return b
  })
  const g = {
    t: 0, game, zones: 'none', fx: [], done: null, outro: 1700, stamp: null,
    reps, rep: reps[0], win, J, slamWin, look: look(), nudge: nudge(),
    hud: { prompt: 'WATCH THE WING', dots: reps.map(() => null), hot: false },
    tick(dt) {
      g.t += dt
      const b = g.rep
      for (const e of b.ev) if (!e.done && g.t >= e.at) { e.done = true; g.fx.push(...e.fx); if (e.kick) g.nudge.kick(g.t, e.kick, 0, 1, 220) }
      if (!b.relFx && g.t >= b.relAt) { b.relFx = true; g.fx.push('swoosh'); g.hud.prompt = 'GO UP' }
      if (!b.hotFx && g.t >= b.aimAt - 260 && b.caught == null) { b.hotFx = true; g.hud.hot = true }
      if (b.caught == null && g.t >= b.catchAt) catchOf(b)
      if (b.caught && !b.res && g.t >= b.slamAt + slamWin / 2 + LAY) finish(b, null)
      if (b.res && !g.done && b.k < reps.length - 1 && g.t >= b.nextAt) {
        const n = reps[b.k + 1], shift = b.nextAt - n.at
        for (const key of ['at', 'relAt', 'catchAt', 'aimAt', 'slamAt']) n[key] += shift
        g.rep = n
        g.hud.prompt = 'WATCH THE WING'; g.hud.hot = false
      }
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const b = g.rep
      if (b.res || g.t < b.relAt) return   // (nothing to time till the ball's in the air)
      if (!b.press) { b.press = { at: g.t }; g.fx.push('h:light'); return }
      // the second tap only counts once he has it
      // (two taps in all: the jump, then the throw-down. A second tap while he's still going up to it is kept, and he throws it down the moment he has it)
      if (!b.tap && b.caught) { b.tap = { at: g.t }; finish(b, g.t) }
      else if (!b.tap && b.caught == null && b.early == null) b.early = g.t
    },
  }
  function catchOf(b) {
    const p = b.press
    let ok = false, why
    if (!p || p.at + UP > b.catchAt) why = 'late'
    else if (p.at + RISE + win < b.catchAt) why = 'early'
    else { ok = true; why = 'clean' }
    b.caught = ok
    b.q1 = ok ? clamp(1 - (Math.abs(p.at - b.aimAt) / ((win + RISE - UP) / 2)) * 0.4, 0.6, 1) : 0
    if (ok) {
      g.fx.push('catchball', 'h:medium')
      g.hud.prompt = 'THROW IT DOWN'; g.hud.hot = true
      if (b.early != null && !b.tap) { b.tap = { at: g.t }; finish(b, g.t) }
    } else {
      b.res = 'miss'; b.why = why; b.doneAt = g.t
      b.ev.push({ at: g.t + 160, fx: ['pop'] })
      settle(b)
    }
  }
  // the second tap (null: he never threw it down)
  function finish(b, t) {
    const lo = b.slamAt - slamWin / 2, hi = b.slamAt + slamWin / 2
    b.doneAt = t ?? g.t
    if (t == null) { b.res = 'miss'; b.why = 'back' }
    else if (t <= hi) { b.res = 'slam'; b.why = b.style ? 'tomahawk' : 'slam'; b.q2 = clamp(1 - (Math.abs(t - b.slamAt) / (slamWin / 2)) * 0.4, 0.6, 1) }
    else { b.res = 'lay'; b.why = 'lay' }
    if (b.res === 'slam') b.ev.push({ at: b.doneAt + throwOf(b), fx: ['make', 'stamp', 'h:heavy'], kick: 5 })
    else if (b.res === 'lay') b.ev.push({ at: b.doneAt + 300, fx: ['make', 'h:medium'] })
    else b.ev.push({ at: b.doneAt + (b.why === 'front' ? 120 : 260), fx: ['rimmiss', 'h:light'], kick: 2 })
    settle(b)
  }
  function settle(b) {
    b.q = b.res === 'slam' ? 0.7 + 0.3 * ((b.q1 + b.q2) / 2) : b.res === 'lay' ? 0.42 + 0.08 * b.q1 : 0
    b.nextAt = b.doneAt + REST[b.res]
    g.hud.dots[b.k] = b.res !== 'miss'
    g.hud.prompt = null; g.hud.hot = false
    if (b.k === reps.length - 1) {
      const made = reps.filter(x => x.res === 'slam' || x.res === 'lay').length, slams = reps.filter(x => x.res === 'slam').length
      const hit = made >= NEED
      g.done = outcome(reps.reduce((s, x) => s + x.q, 0) / 3, hit, `${made} of 3 finished${slams ? `, ${slams} slam${slams > 1 ? 's' : ''}` : ''}`, { made, slams, of: 3 })
      g.stamp = { text: finalWord(made, slams), good: hit, at: b.doneAt + (b.res === 'slam' ? 1250 : 800), y: 100, size: 44 }
      g.outro = b.res === 'slam' ? 2500 : 1900
    }
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// On the floor on the weak side, turned across the lane toward the wing, so the lob crosses the picture.
// The set is wide enough to have the passer in it; when the ball goes up we push in on the rim with it
// (a broadcast's push, painted live only while it moves). Everything goes through the one camera
// (lib/mg/meter.js), in real feet, so the men, the ball and the iron can't disagree.
// The set is shot higher and further round, so the run from the weak-side wing goes away from us into the
// picture and the passer, the rim and the run fill the middle of it; the push swings down and round to the rim.
// (th: degrees round from straight down the floor; H: feet up; F: the lens for a phone 640 high; hz: the horizon)
const DEG = Math.PI / 180
const WIDE = { D: 56, x: 6, z: -3, th: 52, H: 10, F: 760, hz: 0.33 }, CLOSE = { D: 28, x: -0.3, z: -1, th: 25, H: 6, F: 640, hz: 0.42 }
let G0 = null
function geoOf(view) {
  if (G0 && G0.h === view.h) return G0
  const h = view.h, U = h / 640
  const cam = { F: 0, H: 0, px: 180, hz: 0, cos: 1, sin: 0, cx: 0, cz: 0 }
  G0 = { h, U, cam, wallY: 0 }
  aimAt(G0, 1, 1); G0.wallY = wallOf(G0)
  return G0
}
function aimAt(G, s, u) {
  const cam = G.cam, L = (k) => lerp(WIDE[k], CLOSE[k], u)
  const D = L('D'), ax = s * L('x'), az = L('z'), th = L('th') * DEG
  cam.sin = s * Math.sin(th); cam.cos = Math.cos(th)
  cam.cx = ax - cam.sin * D; cam.cz = az - cam.cos * D
  cam.H = L('H'); cam.F = L('F') * G.U; cam.hz = L('hz') * G.h
  return cam
}
// the foot of the wall behind the hoop, through this camera
const wallOf = G => G.cam.hz + (G.cam.H * G.cam.F) / (-G.cam.cx * G.cam.sin - G.cam.cz * G.cam.cos + 26)
// how far in we've pushed: wide on the set, in on the rim once the ball's on its way
// (it's still from SETTLE before the gold-ring moment, so the ring and the white ring don't move while you time it)
const SETTLE = 480
const pushOf = (b, t) => easeInOut(prog(t, b.relAt - 150, b.aimAt - SETTLE))

// where everyone is, in feet (s: the wing the ball is on)
const PASS = { x: 13, z: -9 }, PASS_D = { x: 10.7, z: -7.2 }
const BIG0 = { x: -12.5, z: -10 }, BIG_T = { x: -1.9, z: -2.5 }, BIG_HANG = { x: -0.95, z: -1.55 }
// the cut: BIG0 to his spot on a straight line, at a running pace (feet a ms)
const RUN_L = Math.hypot(BIG_T.x - BIG0.x, BIG_T.z - BIG0.z), RUN_DX = (BIG_T.x - BIG0.x) / RUN_L, RUN_DZ = (BIG_T.z - BIG0.z) / RUN_L
const MAN0 = { x: 1.5, z: -5.5 }, MAN_T = { x: 0.4, z: -1.5 }
const handY = J => (123 + J) / FIG_FT      // the ball at the top of his reach

// the poses (the rig's units: x across the screen, y up from the floor)
const STAND = pose({ hy: 45, fFx: 12, fBx: -12, hFx: 17, hFy: 43, hBx: -17, hBy: 43 })
const GATHER = pose({ hy: 39, fFx: 14, fBx: -14, hFx: 22, hFy: 52, hBx: -22, hBy: 52 })
const LOAD = pose({ hy: 31, lean: 0.04, fFx: 15, fBx: -15, hFx: 24, hFy: 36, hBx: -24, hBy: 36 })
const REACH = pose({ hy: 49, fFx: 8, fBx: -8, fFy: 3, fBy: 24, hFx: 10, hFy: 122, hBx: -10, hBy: 122 })
const HANGP = pose({ hy: 50, fFx: 11, fBx: -5, fFy: 15, fBy: 9, hFx: 8, hFy: 124, hBx: -8, hBy: 124 })
// the plant: the near foot down under him, the other knee coming through, the arms swinging up
const TAKEOFF = pose({ hy: 44, lean: 0.03, fFx: 9, fFy: 0, fBx: -8, fBy: 22, hFx: 20, hFy: 84, hBx: -18, hBy: 78 })
const P_STRIDE = newPose()
const LANDP = pose({ hy: 33, fFx: 16, fBx: -16, hFx: 26, hFy: 40, hBx: -26, hBy: 40 })
const PASS_HOLD = pose({ hy: 46, fFx: 12, fBx: -12, hFx: 8, hFy: 104, hBx: -8, hBy: 104 })
const P_SIT = pose({ hx: 6, hy: 14, lean: 0.34, fFx: -22, fFy: 2, fBx: -42, fBy: 4, hFx: 36, hFy: 3, hBx: 2, hBy: 40 })
const DENY = POSE.deny, CONTEST = POSE.hands
const P_BIG = newPose(), P_PASS = newPose(), P_MAN = newPose(), P_PD = newPose()
const E_BIG = easedState(), E_PASS = easedState(), E_MAN = easedState()

// the lob, the arc in feet: from the passer's hands to the catch, apex feet over the line between them
const BP = { x: 0, y: 0, z: 0 }
function lobAt(b, J, f) {
  const x0 = b.s * (PASS.x - 0.45), y0 = 7.1, z0 = PASS.z + 0.2, x1 = b.s * BIG_T.x, y1 = handY(J), z1 = BIG_T.z + 0.15
  BP.x = lerp(x0, x1, f); BP.z = lerp(z0, z1, f); BP.y = lerp(y0, y1, f) + 4 * b.apex * f * (1 - f)
  return BP
}
const flyTo = (ax, ay, az, bx, by, bz, f, apex = 0) => { BP.x = lerp(ax, bx, f); BP.y = lerp(ay, by, f) + 4 * apex * f * (1 - f); BP.z = lerp(az, bz, f); return BP }
// a ball loose on the floor: from where it landed, along (dx, dz) feet a second, a bounce that dies away
function rollOn(x, z, dx, dz, a) {
  const t = a / 1000
  BP.x = x + dx * (1 - Math.exp(-t * 1.6)) / 1.6; BP.z = z + dz * (1 - Math.exp(-t * 1.6)) / 1.6
  BP.y = BALL_R + Math.abs(Math.sin(a / 150)) * 1.6 * Math.exp(-a / 260)
  return BP
}
// where the lob comes down if no one's there for it (f past 1 on the same arc)
function lobLandF(b, J) { let f = 1; while (f < 3 && lobAt(b, J, f).y > BALL_R) f += 0.01; return f }

// both hands on the ball at (bx, by) on the screen, as near as his arms reach: then the ball's where his hands are.
// (spread: the rig's units either side; one: only the near hand, the other out for balance)
const HB = { x: 0, y: 0 }
function handsTo(P, fx, fy, sc, bx, by, spread = 7, one = 0) {
  const ux = (bx - fx) / sc, uy = (fy - by) / sc - P.j - 2, shY = P.hy + 36
  let cx = 0, cy = 0, n = 0
  for (const d of [1, -1]) {
    if (one && d !== one) continue
    const sx = P.hx + d * 14.5
    let tx = ux + d * (one ? 0 : spread), ty = uy
    const dx = tx - sx, dy = ty - shY, L = Math.hypot(dx, dy)
    if (L > 37) { tx = sx + (dx * 37) / L; ty = shY + (dy * 37) / L }
    if (d > 0) { P.hFx = tx; P.hFy = ty } else { P.hBx = tx; P.hBy = ty }
    cx += tx - d * (one ? 0 : spread); cy += ty; n++
  }
  if (one) { if (one > 0) { P.hBx = -26; P.hBy = 84 } else { P.hFx = 26; P.hFy = 84 } }
  HB.x = fx + (cx / n) * sc; HB.y = fy - (cy / n + P.j + 2) * sc
  return HB
}
const ringAt = (ctx, cam, x, y, z, U, color, w, pad) => {
  project(cam, x, y, z)
  ctx.strokeStyle = color; ctx.lineWidth = w * U
  ctx.beginPath(); ctx.arc(PT.x, PT.y, BALL_R * PT.k + pad * U, 0, Math.PI * 2); ctx.stroke()
}
// the gold ring closing on the rim: k times the rim's size, flat on it
function rimRing(ctx, cam, k, U, color, w) {
  ctx.strokeStyle = color; ctx.lineWidth = w * U; ctx.beginPath()
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2
    project(cam, Math.cos(a) * RIM_R * k, RIM_Y + 0.04, Math.sin(a) * RIM_R * k)
    if (i) ctx.lineTo(PT.x, PT.y); else ctx.moveTo(PT.x, PT.y)
  }
  ctx.stroke()
}
// a pose turned the other way round
function mirror(P) {
  const fx = P.fFx, fy = P.fFy, hx = P.hFx, hy = P.hFy
  P.hx = -P.hx; P.lean = -P.lean
  P.fFx = -P.fBx; P.fFy = P.fBy; P.fBx = -fx; P.fBy = fy
  P.hFx = -P.hBx; P.hFy = P.hBy; P.hBx = -hx; P.hBy = hy
  return P
}
// (a name only under a man who's in the picture)
const on = x => x > -12 && x < 372
// what's drawn, far to near (fn paints it)
const LIST = []
const item = (z, fn) => { LIST.push({ z, fn }) }

export function draw(ctx, g, view) {
  const G = geoOf(view), { U, cam } = G, c = view.colors, them = themOf(view), M = castMen(g, view)
  const T = smoothT(g), t = g.t
  const b = g.rep, s = b.s, J = g.J
  const u = pushOf(b, t)
  aimAt(G, s, u)
  // ── the floor, the room and the hoop ──
  const stageOf = x => {
    const dy = wallOf(G) - G.wallY
    x.save(); x.translate(0, dy); paintRoom(x, view, G, c, 'board'); x.restore()
    if (dy < 0) { x.fillStyle = '#dbaa72'; x.fillRect(0, view.h + dy - 1, view.w, 2 - dy) }
    paintLines(x, cam, c.us); paintHoop(x, cam, c.us)
  }
  if (u <= 0 || u >= 1) layer(ctx, view, `oop-${u >= 1 ? 'in' : 'set'}-${s}-${c.us}-${c.trim}`, stageOf)
  else {
    const dy = wallOf(G) - G.wallY
    ctx.save(); ctx.translate(0, dy); layer(ctx, view, `oop-room-${c.us}-${c.trim}`, x => paintRoom(x, view, G, c, 'board')); ctx.restore()
    if (dy < 0) { ctx.fillStyle = '#dbaa72'; ctx.fillRect(0, view.h + dy - 1, view.w, 2 - dy) }
    paintLines(ctx, cam, c.us); paintHoop(ctx, cam, c.us)
  }
  if (!g.warm) { g.warm = true; warmCrowd(view, G, c, 'board') }
  const since = b.res ? t - b.doneAt : -1
  const slam = b.res === 'slam', lay = b.res === 'lay'
  const inAt = b.doneAt + throwOf(b)       // (a slam: the ball through the iron)
  // the building on its feet for a slam, the board at the foot of the stands in our colour
  if (slam && t >= inAt && t - inAt < 1900 && !lightFx()) {
    crowdUp(ctx, view, G, c, 'board', t, 110)
    paintHoop(ctx, cam, c.us)
    if (t - inAt < 1300) camFlashes(ctx, view, G, t, 12)
  }
  if ((slam || lay) && t >= inAt && t - inAt < 1000) { const a = t - inAt; boardFlash(ctx, view, G, c.trim, (1 - a / 1000) * (Math.floor(a / 90) % 2 ? 0.34 : 0.62) * (slam ? 1 : 0.6)) }

  // ── the ball: where it is, and whose hands it's in ──
  const fwdX = cam.sin, fwdZ = cam.cos        // (away from us)
  const C = lobAt(b, J, 1), Cx = C.x, Cy = C.y, Cz = C.z
  let ball = null, inHands = null, spin = T / 90, netAge = null, jolt = null, hang = 0
  const caught = b.caught === true
  if (t < b.relAt) inHands = 'pass'
  else if (!caught && (b.caught == null || t < b.catchAt)) ball = lobAt(b, J, (t - b.relAt) / b.T)
  else if (!caught) {
    // nobody there: it goes on over, down and away
    const fl = b.landF ?? (b.landF = lobLandF(b, J)), f = (t - b.relAt) / b.T
    if (f < fl) ball = lobAt(b, J, f)
    else { const end = lobAt(b, J, fl); const ex = end.x, ez = end.z; ball = rollOn(ex, ez, -s * 3.2, 1.4, (f - fl) * b.T) }
  } else {
    // he has it: the cock, then whatever the tap did with it
    const cock = easeOut(prog(t, b.catchAt, b.catchAt + SLAM_GAP))
    // a tomahawk: one hand, the ball cocked way back and up behind his head, then swung over the top. A slam: two hands, a short cock
    const ax = b.style ? -s * 1.05 : 0, back = b.style ? 0.8 : 0.55
    const hx = Cx + (-fwdX * back + ax) * cock, hy = Cy + (b.style ? 0.75 : 0.18) * cock, hz = Cz - fwdZ * back * cock
    if (!b.res || since < 0) { inHands = 'big'; BP.x = hx; BP.y = hy; BP.z = hz; ball = BP }
    else if (slam) {
      if (since < throwOf(b)) { inHands = 'big'; ball = flyTo(hx, hy, hz, 0, RIM_Y + 0.35, 0, b.style ? easeIn(since / throwOf(b)) : easeOut(since / throwOf(b)), b.style ? 0.55 : 0) }
      else {
        const a = (since - throwOf(b)) * 1.5, ft = a / 420
        BP.x = 0; BP.z = -0.1 - Math.max(0, ft - 1) * 1.8
        BP.y = ft < 1 ? RIM_Y + 0.35 + (BALL_R - RIM_Y - 0.35) * ft * ft : BALL_R + Math.abs(Math.sin((ft - 1) * 3.1)) * 1.7 * Math.exp(-(ft - 1) * 1.4)
        ball = BP; netAge = since - throwOf(b); hang = since - throwOf(b)
      }
    } else if (lay) {
      if (since < 300) { inHands = since < 140 ? 'big' : null; ball = flyTo(hx, hy, hz, fwdX * 0.2, RIM_Y + 0.55, fwdZ * 0.2, easeInOut(since / 300), 0.5) }
      else if (since < 470) { const f = (since - 300) / 170; BP.x = fwdX * 0.2 * (1 - f); BP.z = fwdZ * 0.2 * (1 - f); BP.y = RIM_Y + 0.55 - f * 0.3; ball = BP; jolt = since - 300 }
      else {
        const a = since - 470, ft = a / 420
        BP.x = 0; BP.z = -0.1 - Math.max(0, ft - 1) * 1.6
        BP.y = ft < 1 ? RIM_Y + 0.25 + (BALL_R - RIM_Y - 0.25) * ft * ft : BALL_R + Math.abs(Math.sin((ft - 1) * 3.1)) * 1.5 * Math.exp(-(ft - 1) * 1.4)
        ball = BP; netAge = a
      }
    } else if (b.why === 'front') {
      // thrown down too soon: off the front of the iron and back out at us
      const fx0 = -fwdX * 0.72, fz0 = -fwdZ * 0.72
      if (since < 120) { inHands = since < 60 ? 'big' : null; ball = flyTo(hx, hy, hz, fx0, RIM_Y + 0.3, fz0, since / 120) }
      else if (since < 820) { ball = flyTo(fx0, RIM_Y + 0.3, fz0, -s * 3.4 - fwdX * 3, BALL_R, -fwdZ * 4.2, (since - 120) / 700, 2.8); jolt = since - 120 }
      else { ball = rollOn(-s * 3.4 - fwdX * 3, -fwdZ * 4.2, -s * 1.5, -2, since - 820); jolt = since - 120 }
    } else {
      // held too long: he lets it go coming down, it climbs the back iron and rolls off
      const bx0 = fwdX * 0.62, bz0 = fwdZ * 0.62
      if (since < 260) { inHands = since < 120 ? 'big' : null; ball = flyTo(hx, hy, hz, bx0, RIM_Y + 0.35, bz0, since / 260, 0.7) }
      else if (since < 900) { ball = flyTo(bx0, RIM_Y + 0.35, bz0, s * 2.6, BALL_R, 4, (since - 260) / 640, 2.2); jolt = since - 260 }
      else { ball = rollOn(s * 2.6, 4, s * 1.2, 1.5, since - 900); jolt = since - 260 }
    }
  }
  // the rim: shaken by the iron, pulled down while he hangs on it and snapping back after
  let rimDy = 0
  if (hang > 0) {
    const pull = hang < HANG ? Math.min(1, hang / 60) : Math.max(0, 1 - (hang - HANG) / 40)
    const ring = hang >= HANG ? Math.sin((hang - HANG) / 30) * 3.4 * Math.exp(-(hang - HANG) / 170) : Math.sin(hang / 45) * 0.8
    rimDy = (pull * 5 + ring) * U
  } else if (jolt != null && jolt < 560) rimDy = Math.sin(jolt / 26) * Math.exp(-jolt / 140) * 3.2 * U
  else if (lay && netAge != null && netAge < 300) rimDy = Math.sin(netAge / 30) * Math.exp(-netAge / 120) * 1.2 * U
  const onIron = ball && !inHands && Math.hypot(ball.x, ball.z) <= RIM_R + BALL_R && ball.y > RIM_Y - 1.6 && ball.y < RIM_Y + 1.2
  rimHalf(ctx, cam, false, rimDy)
  if (onIron) ballIn(ctx, cam, ball.x, ball.y, ball.z, spin)
  netOf(ctx, cam, netAge, rimDy, jolt)
  rimHalf(ctx, cam, true, rimDy)

  // ── the men ──
  const us = { color: c.us, trim: c.trim }
  const me = M?.us[0] ?? { number: 33, skin: SKINS[1], name: null }, wing = M?.us[1] ?? { number: 3, skin: SKINS[2], name: null }
  const man = M?.them[0] ?? { number: 21, skin: SKINS[3], name: null }, wingD = M?.them[1] ?? { number: 7, skin: SKINS[0], name: null }
  const W = (p, out) => { out.x = s * p.x; out.z = p.z; return out }
  const SP = { x: 0, z: 0 }

  // him: already running when the lob's set, from out on the weak-side wing, one long cut at the rim. The pace
  // has him on his spot as the ball reaches the gold ring, so a good press takes him off his stride right
  // there; early and he goes from further out, late and he's gone past it. He carries on in to the catch.
  const p = b.press, tau = p ? t - p.at : -1
  const runAt = b.at, runV = RUN_L / (b.aimAt - b.at)
  const runD = t2 => { const d = Math.max(0, t2 - runAt) * runV; return d <= RUN_L ? d : RUN_L + 2.2 * (1 - Math.exp(-(d - RUN_L) / 2.2)) }
  const dOff = runD(p ? Math.min(t, p.at) : t)
  const RX = s * (BIG0.x + RUN_DX * dOff), RZ = BIG0.z + RUN_DZ * dOff
  let bx = RX, bz = RZ
  const running = !p && t >= runAt
  let lift = 0, back = true, landed = false
  const topOut = caught ? (b.res ? b.doneAt + (slam ? throwOf(b) + HANG : lay ? 140 : b.why === 'front' ? 60 : 120) : Infinity) : null
  if (p) {
    // in the air he keeps going: in to the catch, and on a bit after it
    const go = easeOut(prog(tau, 0, RISE)), on = Math.min(0.9, Math.max(0, tau - RISE) * 0.0016)
    bx = lerp(RX, s * (BIG_T.x + RUN_DX * 0.3), go) + s * RUN_DX * on; bz = lerp(RZ, BIG_T.z + RUN_DZ * 0.3, go) + RUN_DZ * on
    if (tau < RISE) lift = easeOut(tau / RISE)
    else if (caught && t < topOut) lift = 1
    else {
      const down0 = caught ? topOut : p.at + RISE + g.win, d = t - down0
      lift = d < 0 ? 1 : Math.max(0, 1 - (d / (slam ? DROP : FALL)) ** 2)
      if (slam && b.hangJ) lift *= b.hangJ / J
      landed = d >= (slam ? DROP : FALL)
    }
    if (slam && since >= 0) {
      // up and in, onto the rim
      const f = easeOut(prog(since, 0, throwOf(b) + 80))
      bx = lerp(bx, s * BIG_HANG.x, f); bz = lerp(bz, BIG_HANG.z, f)
    }
  }
  const landAt = p ? (caught ? (topOut + (slam ? DROP : FALL)) : p.at + RISE + g.win + FALL) : Infinity
  project(cam, bx, 0, bz)
  const bfx = PT.x, bfy = PT.y, bk = PT.k, bsc = bk / FIG_FT, bZ = PT.z
  // the body
  if (!p) {
    if (running && runD(t) < RUN_L + 1.9) frontRun(runD(t) / 0.5, P_BIG)
    else if (running) { copyPose(STAND, P_BIG); P_BIG.lean = 0.04 }
    else { copyPose(GATHER, P_BIG); P_BIG.hy += Math.sin(t / 160) * 0.7 }
  } else if (!landed) {
    // off one foot, out of his stride: the plant, the other knee driving up, the hands going up for it
    if (tau < 80) { frontRun(runD(p.at) / 0.5, P_STRIDE); mixPose(P_STRIDE, TAKEOFF, clamp(tau / 80, 0, 1), P_BIG) }
    else mixPose(TAKEOFF, slam && since > throwOf(b) ? HANGP : REACH, clamp((tau - 80) / 150, 0, 1), P_BIG)
    if (s < 0) { const fx = P_BIG.fFx, fy = P_BIG.fFy; P_BIG.fFx = -P_BIG.fBx; P_BIG.fFy = P_BIG.fBy; P_BIG.fBx = -fx; P_BIG.fBy = fy }
    if (!caught && t > p.at + RISE + g.win) mixPose(P_BIG, LANDP, clamp((t - p.at - RISE - g.win) / FALL, 0, 1) * 0.6, P_BIG)
    P_BIG.j = lift * J
  } else {
    const a = t - landAt
    copyPose(LANDP, P_BIG)
    if (a > 180) {
      if (slam) {
        // he's turned round to them: the flex, and he means it
        back = a < 260
        mixPose(LANDP, R_FLEX, clamp((a - 200) / 140, 0, 1), P_BIG)
        if (a > 340) { const w = Math.sin((a - 340) / 85); P_BIG.hy += w * 2.4; P_BIG.hFy += w * 5; P_BIG.hBy += w * 5 }
      } else if (lay) mixPose(LANDP, R_UP, clamp((a - 180) / 160, 0, 1) * 0.55, P_BIG)
      else mixPose(LANDP, b.flair < 0.5 ? R_HEAD : R_HIPS, clamp((a - 180) / 200, 0, 1), P_BIG)
    }
  }
  const PB = easedPose(E_BIG, P_BIG, b, CLK.dt, 22)
  // his hands: on the ball while it's his, on the iron while he hangs
  let ballScr = null
  if (inHands === 'big' && ball) {
    project(cam, ball.x, ball.y, ball.z)
    const one = b.style && b.caught && t > b.catchAt + 90 ? (s > 0 ? 1 : -1) : 0
    // the tomahawk's cock, in his own frame: the ball up and out past his head on the throwing side, the arm straight up
    // and back, then whipped over the top into the rim as the throw goes (depth alone can't show it from behind him)
    if (one) {
      const ck = b.res ? Math.max(0, 1 - since / throwOf(b)) : easeOut(prog(t, b.catchAt + 90, b.catchAt + SLAM_GAP * 0.7))
      const cxp = bfx + (PB.hx + one * 24) * bsc, cyp = bfy - (PB.hy + 36 + 31 + PB.j + 2) * bsc
      PT.x = lerp(PT.x, cxp, ck); PT.y = lerp(PT.y, cyp, ck)
    }
    const h = handsTo(PB, bfx, bfy, bsc, PT.x, PT.y, 7, one)
    ballScr = { x: h.x, y: h.y, r: BALL_R * bk }
  } else if (slam && since >= throwOf(b) && t < topOut) {
    // two hands on the front of the rim
    project(cam, -fwdX * RIM_R * 0.9, RIM_Y, -fwdZ * RIM_R * 0.9)
    const need = (bfy - PT.y - rimDy) / bsc - 124
    b.hangJ = Math.max(J * 0.8, need); PB.j = b.hangJ; P_BIG.j = PB.j
    // (a tomahawk hangs on by the hand that threw it; a two-hand slam by both)
    handsTo(PB, bfx, bfy, bsc, PT.x, PT.y + rimDy - 2 * bsc, 9, b.style ? (s > 0 ? 1 : -1) : 0)
  } else if (p && !landed && !caught && b.caught == null && ball && tau > 100) {
    // up for it: the hands go where the ball's coming
    project(cam, Cx, Cy, Cz)
    const hit = handsTo(PB, bfx, bfy, bsc, PT.x, PT.y, 9)
    void hit
  }
  item(bZ, () => {
    if (ballScr) basketball(ctx, ballScr.x, ballScr.y, { r: ballScr.r, spin })
    athleteFront(ctx, bfx, bfy, PB, { jersey: us.color, trim: us.trim, s: bsc, back, num: me.number, skin: me.skin })
    if (M && on(bfx)) tagAt(bfx, bfy - 11, me.name, bsc)
  })

  // the man on him: ball-watching on the wing, late to it, and up a beat after
  const mGo = easeInOut(prog(t, b.relAt + 250, b.catchAt - 120))
  let mx = s * lerp(MAN0.x, MAN_T.x, mGo), mz = lerp(MAN0.z, MAN_T.z, mGo)
  const mUp = t - (b.catchAt - 110)
  const mLift = mUp <= 0 ? 0 : mUp < 260 ? easeOut(mUp / 260) : mUp < 300 ? 1 : Math.max(0, 1 - ((mUp - 300) / 300) ** 2)
  const poster = slam && t >= inAt
  if (poster) {
    // posterized: the slam puts him on the floor
    const a = t - inAt
    copyPose(a < 160 ? POSE.stumbleL : P_SIT, P_MAN)
    if (s < 0) mirror(P_MAN)
    mx += s * 0.5 * easeOut(prog(a, 0, 260)); mz += 0.6 * easeOut(prog(a, 0, 260))
  } else if (mLift > 0.01) { mixPose(DENY, CONTEST, mLift, P_MAN); P_MAN.j = mLift * 30 }
  else if (t < b.relAt + 250) { copyPose(DENY, P_MAN); P_MAN.hy += Math.sin(t / 210) * 0.6 }
  else copyPose(mGo > 0 && mGo < 1 ? POSE.slideA : DENY, P_MAN)
  project(cam, mx, 0, mz)
  const mfx = PT.x, mfy = PT.y, mk = PT.k, mZ = PT.z
  const PM = easedPose(E_MAN, P_MAN, b, CLK.dt, 40)
  item(mZ, () => {
    athleteFront(ctx, mfx, mfy, PM, { jersey: them.color, trim: them.trim, s: mk / FIG_FT, back: false, num: man.number, skin: man.skin })
    if (M && on(mfx)) tagAt(mfx, mfy - 11, man.name, mk / FIG_FT)
  })

  // the wing: the ball over his head, a look, and up it goes; his arms follow it across
  W(PASS, SP); const px = SP.x, pz = SP.z
  project(cam, px, 0, pz)
  const pfx = PT.x, pfy = PT.y, pk = PT.k, psc = pk / FIG_FT, pZ = PT.z
  // he faces the rim he's throwing to: his back to us only when it's further from the camera than he is (his man faces him)
  project(cam, 0, 0, 0); const passBack = PT.z > pZ
  const rel = t - b.relAt
  if (rel < 0) {
    copyPose(PASS_HOLD, P_PASS)
    if (rel > -520 && rel < -260) P_PASS.hy -= Math.sin(((rel + 520) / 260) * Math.PI) * 3
  } else if (rel < 320) {
    copyPose(PASS_HOLD, P_PASS)
    const f = easeOut(rel / 320)
    P_PASS.hFx = lerp(8, -s * 13 + 8, f); P_PASS.hBx = lerp(-8, -s * 13 - 8, f); P_PASS.hFy = P_PASS.hBy = lerp(104, 116, f); P_PASS.lean = -s * 0.06 * f
  } else if (slam && t > inAt + 150) {
    copyPose(R_UP, P_PASS); P_PASS.j = Math.abs(Math.sin((t - inAt - 150) / 150)) * 22
  } else if (b.res === 'miss' && since > 300) copyPose(R_HIPS, P_PASS)
  else copyPose(STAND, P_PASS)
  const PP = easedPose(E_PASS, P_PASS, b, CLK.dt, 30)
  let passBall = null
  if (inHands === 'pass') {
    const pb = lobAt(b, J, 0)
    project(cam, pb.x, pb.y - (rel > -520 && rel < -260 ? 0.15 : 0), pb.z)
    const h = handsTo(PP, pfx, pfy, psc, PT.x, PT.y, 7)
    passBall = { x: h.x, y: h.y, r: BALL_R * PT.k }
  }
  item(pZ, () => {
    if (passBall) basketball(ctx, passBall.x, passBall.y, { r: passBall.r, spin: 0 })
    athleteFront(ctx, pfx, pfy, PP, { jersey: us.color, trim: us.trim, s: psc, back: passBack, num: wing.number, skin: wing.skin })
    if (M && on(pfx)) tagAt(pfx, pfy - 11, wing.name, psc)
  })
  // his man, up in him on the closeout (a stamp's worth of man: he barely moves)
  W(PASS_D, SP)
  project(cam, SP.x, 0, SP.z)
  const dfx = PT.x, dfy = PT.y, dk = PT.k, dZ = PT.z
  copyPose(rel > 0 && rel < 600 ? CONTEST : DENY, P_PD)
  if (rel > 0 && rel < 600) P_PD.j = Math.sin(Math.min(1, rel / 500) * Math.PI) * 18
  item(dZ, () => athleteFront(ctx, dfx, dfy, P_PD, { jersey: them.color, trim: them.trim, s: dk / FIG_FT, back: !passBack, num: wingD.number, skin: wingD.skin }))

  // the free ball, in among them by its depth
  if (ball && !inHands && !onIron) {
    project(cam, ball.x, 0, ball.z)
    const z = PT.z
    const bb = { x: ball.x, y: ball.y, z: ball.z }
    item(z, () => ballIn(ctx, cam, bb.x, bb.y, bb.z, spin))
  }
  LIST.sort((a2, b2) => b2.z - a2.z)
  for (const it of LIST) it.fn()
  LIST.length = 0
  if (M) tagsDown(ctx, view)

  // ── what to read ──
  // the lob's arc ahead of it, the white ring where it meets his hands, the gold ring that says go
  if (t >= b.relAt && b.caught == null) {
    const f = (t - b.relAt) / b.T
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.beginPath()
    for (let i = 1; i <= 19; i++) {
      const q = i / 20
      if (q < f + 0.02) continue
      lobAt(b, J, q); project(cam, BP.x, BP.y, BP.z)
      ctx.rect(PT.x - 1.4 * U, PT.y - 1.4 * U, 2.8 * U, 2.8 * U)
    }
    ctx.fill()
    ringAt(ctx, cam, Cx, Cy, Cz, U, '#fff', 2.4, 3)
    const aim = clamp((b.aimAt - b.relAt) / b.T, 0.02, 1)
    if (f < aim + 0.05) { lobAt(b, J, aim); ringAt(ctx, cam, BP.x, BP.y, BP.z, U, GOLD, 3.6, 4) }
  }
  // the ring closing on the rim: tap as it meets the iron
  if (caught && !b.res) {
    const left = b.slamAt - t
    // gold while it closes; green for as long as a tap throws it down (the window's centred on the ring meeting the rim)
    const now = Math.abs(left) <= g.slamWin / 2
    if (left > -g.slamWin / 2) rimRing(ctx, cam, 1 + Math.max(0, left / SLAM_GAP) * 2.6, U, now ? GOOD : GOLD, now ? 3.8 : 3.2)
  }
  // the word on each one
  const lastRep = b.k === g.reps.length - 1
  if (b.res && since < 900 && !(g.done && lastRep && since > 700)) {
    const word = slam ? (b.style ? 'TOMAHAWK' : 'SLAM') : lay ? 'LAID IN' : b.why === 'early' ? 'TOO SOON' : b.why === 'late' ? 'TOO LATE' : b.why === 'front' ? 'FRONT RIM' : 'RIMMED OUT'
    const shown = slam ? since - throwOf(b) : since
    if (shown >= 0) {
      const pop = reduceShown(shown)
      text(ctx, word, 180, view.h * 0.8, { font: DISPLAY, size: 32 * U * pop, color: slam ? GOOD : lay ? GOLD : BAD })
    }
  }
}
// a word lands a touch big and settles
const reduceShown = a => (lightFx() ? 1 : 1 + 0.18 * Math.exp(-a / 90))
