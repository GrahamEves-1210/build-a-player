// The meter: press and hold, and a meter runs on one smooth ease-in curve. Two kinds:
//   a shot    fills to the top; let go in the green. The green's half-width is in milliseconds and
//             comes from the trait; where it sits and how long the fill takes change every rep.
//   a peak    rises to the top and falls back; let go at the top. The closer, the more you get.
//   clutch-shot   a three with the clock running and a defender closing out: waiting costs green
//   free-throws   the line, quiet: two shots, and the second one's bar shakes with a smaller green
//   spot          four spots around the arc, quick release
//   velo          peak: three throws into a net, a radar reads the speed
//   vert          peak: three jumps at a Vertec, the vanes say how high
// Also here, for rebound.js: the court in real feet through one camera, and the athletes.
import { clamp, lerp, prog, easeOut, easeIn, easeInOut, rngOf, outcome, layer, text, rr, circle, basketball, themOf, GOOD, BAD, GOLD, DISPLAY, LABEL } from './kit.js'
import { HEAD_R, GEAR, clockSlab, sideHead, paintRoom as combineRoom, standAt, SCOUT, FOLK_SKIN } from './dash.js'
import { vignette, nameTag, inkOn, boardInk, limb, limbShade } from './art.js'
import { castMen } from './read.js'

export const how = {
  'clutch-shot': 'Hold to rise, let go in the green before the clock hits zero. Waiting shrinks the green.',
  'free-throws': 'Hold, let go in the green. Make both. The second one shakes.',
  'spot': 'Four spots. Hold, let go in the green. Make three.',
  'velo': 'Three throws. Hold: the meter rises and falls. Let go at the peak: closer is faster. Two good throws pass.',
  'vert': 'Three jumps. Hold: the meter rises and falls. Let go at the peak: closer is higher. Two good jumps pass.',
}

// half: half-width of the green in ms, grade 1 to grade 11 along t^pow
// fly: ms from the release to the rim / the net / the top of the jump. after: from there to the next rep
const SETUP = {
  'clutch-shot': { n: 1, need: 1, half: [26, 68, 1.3], fly: 980, after: 0, outro: 1750, speed: 1, prompt: 'HOLD TO SHOOT' },
  'free-throws': { n: 2, need: 2, half: [34, 80, 1.2], fly: 800, after: 950, outro: 1500, speed: 1, prompt: 'HOLD TO SHOOT', limit: 7000 },
  'spot':        { n: 4, need: 3, half: [27, 62, 1.2], fly: 860, after: 240, outro: 1300, speed: 0.88, prompt: 'HOLD TO SHOOT', limit: 4000, move: 500 },
  'velo':        { n: 3, need: 2, half: [28, 68, 1.35], fly: 270, after: 800, outro: 1400, speed: 1, prompt: 'HOLD TO THROW', limit: 6000 },
  'vert':        { n: 3, need: 2, half: [28, 68, 1.35], fly: 340, after: 1000, outro: 1500, speed: 1, prompt: 'HOLD TO JUMP', limit: 6000 },
}
const CLOCK = 2800       // the clutch shot's clock, from when the inbound leaves
const CATCH = 620        // ...and when it lands in his hands
const CURVE = 2.6         // needle = (time / fill) ^ 2.6: its speed only ever climbs, and it's quick by the green
const NERVES = 0.86      // the second free throw's green
const FLINCH = 90        // a tap this short isn't a shot: the finger just slipped
const CLOSE = { from: 180, per: 1500, floor: 0.45 } // the closeout: green lost per ms of waiting
export const closeoutOf = wait => clamp(1 - (wait - CLOSE.from) / CLOSE.per, CLOSE.floor, 1)

export function make({ v, seed, game }) {
  const S = SETUP[game] ?? SETUP['clutch-shot']
  const r = rngOf(seed)
  const tv = clamp((v - 1) / 10, 0, 1)
  const half0 = lerp(S.half[0], S.half[1], tv ** S.half[2])
  const t = clamp(v, 0, 11) / 11      // the same t as the career's drillValue
  const peak = game === 'velo' || game === 'vert'
  const reps = Array.from({ length: S.n }, (_, k) => {
    // a peak meter: up to the top at c, the mirror image down. A shot: c is the middle of the green
    const up = lerp(680, 900, r())
    const fill = peak ? up * 2 : lerp(680, 1240, r()) * S.speed
    const wob = game === 'free-throws' && k === 1
    const half = half0 * (wob ? NERVES : 1)
    const c = peak ? up : clamp(fill * lerp(0.62, 0.9, r()), 280 + half, fill - half - 25)
    return {
      k, fill, curve: peak ? 2 : CURVE, c, half, half0: half, peak, wob,
      phase: 'wait', readyAt: 0, shownAt: 0, at: 0, tau: 0, p: 0, res: null, landAt: 0, nextAt: 0, landed: false,
      lo: 0, hi: 0, kind: null, mph: null, inches: null,
    }
  })
  // the one curve: ease-in all the way, no steps. A peak meter runs it up, then back
  const pOf = (m, tau) => (m.peak ? clamp(1 - Math.abs(tau - m.c) / m.c, 0, 1) : clamp(tau / m.fill, 0, 1)) ** m.curve
  const zoneOf = m => { m.lo = pOf(m, m.c - m.half); m.hi = m.peak ? 1 : pOf(m, m.c + m.half) }
  reps.forEach(zoneOf)
  const clutch = game === 'clutch-shot'
  reps[0].readyAt = clutch ? CATCH : 300
  const g = {
    t: 0, game, zones: 'none', fx: [], done: null, outro: S.outro, stamp: null, S, reps, k: 0, rep: reps[0], held: false, tv: t,
    clock: clutch ? CLOCK : null, tick0: 2, catchAt: CATCH, best: null, pOf, theta: lerp(-0.07, 0.07, r()),
    hud: { prompt: S.prompt, dots: reps.map(() => null) },
    tick(dt) {
      g.t += dt
      const m = g.rep
      if (clutch) {
        g.clock = Math.max(0, CLOCK - g.t)
        if (g.clock <= g.tick0 * 1000 && g.tick0 > 0) { g.fx.push('h:light'); g.tick0-- }
        if (g.clock <= 0 && g.tick0 === 0) { g.tick0 = -1; g.fx.push('whistle') }
      }
      if (m.phase === 'wait' && g.t >= m.readyAt) {
        m.phase = 'ready'; m.shownAt = g.t
        if (g.held) begin(m)
      }
      if (clutch && m.phase === 'ready') {
        m.half = m.half0 * closeoutOf(g.t - CATCH)
        zoneOf(m)
      }
      if (m.phase === 'ready' && S.limit && g.t - m.shownAt > S.limit) { settle(m, null, 'clock'); return }
      if (m.phase === 'hold') {
        m.tau = g.t - m.at
        m.p = pOf(m, m.tau)
        if (m.tau >= m.fill) settle(m, m.fill, 'full')
      }
      if (clutch && g.clock <= 0 && !m.res) { settle(m, null, 'clock'); return }
      if (m.res && !m.landed && g.t >= m.landAt) land(m)
      if (m.landed && !g.done && g.t >= m.nextAt && m.k < reps.length - 1) {
        g.k = m.k + 1; g.rep = reps[g.k]
        g.rep.waitAt = g.t
        g.rep.readyAt = g.t + (S.move ?? 300)
        g.hud.prompt = S.prompt
      }
    },
    input(a) {
      if (g.done) return
      if (a.kind === 'down') {
        g.held = true
        if (g.rep.phase === 'ready') begin(g.rep)
      } else if (a.kind === 'up') {
        g.held = false
        const m = g.rep
        if (m.phase !== 'hold') return
        const tau = g.t - m.at
        if (tau < FLINCH) { m.phase = 'ready'; m.p = 0; m.tau = 0; return }
        settle(m, tau, null)
      }
    },
  }
  function begin(m) {
    m.phase = 'hold'; m.at = g.t; m.tau = 0; m.p = 0
    zoneOf(m)
    g.fx.push('h:light')
    g.hud.prompt = m.peak ? 'LET GO AT THE PEAK' : 'LET GO IN THE GREEN'
  }
  function settle(m, tau, why) {
    m.phase = 'fly'
    const off = tau == null ? Infinity : tau - m.c
    const a = Math.abs(off)
    const inZone = a <= m.half
    const q = tau == null ? 0 : inZone ? lerp(1, 0.6, a / m.half) : clamp(0.5 - (0.5 * (a - m.half)) / (m.half * 1.2 + 60), 0, 0.5)
    m.res = { in: inZone, q, off, why: why ?? (inZone ? 'green' : off < 0 ? 'early' : 'late'), far: a > m.half + 70 }
    m.relAt = g.t
    m.tau = tau ?? m.tau
    m.p = tau == null ? m.p : pOf(m, tau)
    g.held = false
    g.hud.prompt = null
    if (tau == null) { m.landAt = g.t; m.nextAt = g.t + 500; land(m); return }
    g.fx.push('swoosh')
    m.kind = !inZone ? (off < 0 ? (m.res.far ? 'air' : 'front') : (m.res.far ? 'board' : 'back')) : q >= 0.8 ? 'swish' : 'rattle'
    if (game === 'velo') {
      m.mph = clamp(Math.round(48 + t * 12 + (q - 0.6) * 6), 44, 64)
      m.flyMs = S.fly - (m.mph - 44) * 3
    } else m.flyMs = S.fly
    if (game === 'vert') m.inches = clamp(Math.round((26 + t * 16 + (q - 0.6) * 7) * 10) / 10, 20, 46)
    m.landAt = g.t + m.flyMs
    m.nextAt = m.landAt + S.after
  }
  function land(m) {
    m.landed = true
    g.hud.dots[m.k] = m.res.in
    if (m.res.why === 'clock') { g.fx.push('deny', 'h:medium') }
    else if (game === 'velo' || game === 'vert') {
      g.fx.push(m.res.in ? 'pop' : 'tap', m.res.in ? 'h:medium' : 'h:light')
      const val = game === 'velo' ? m.mph : m.inches
      if (g.best == null || val > g.best) g.best = val
    } else {
      g.fx.push(m.res.in ? 'swoosh' : 'pop', m.res.in ? 'h:light' : 'h:medium')
    }
    if (m.k === reps.length - 1) finish()
  }
  function finish() {
    const made = reps.filter(m => m.res.in).length
    const avgQ = reps.reduce((s, m) => s + m.res.q, 0) / reps.length
    const bestQ = Math.max(...reps.map(m => m.res.q))
    const hit = made >= S.need
    const timedOut = !hit && reps.some(m => m.res.why === 'clock')
    g.hud.prompt = null
    const m = reps[reps.length - 1]
    // (one shot: the word is the result. Several: the last one lands first, then the drill's verdict)
    const at = g.t + (m.kind === 'rattle' ? 240 : 120) + (game === 'clutch-shot' ? 0 : 800)
    if (game !== 'clutch-shot') g.outro += 800
    if (game === 'clutch-shot') {
      const buzzer = g.clock <= 0
      g.done = outcome(hit ? m.res.q : m.res.q * 0.5, hit, hit ? 'Good' : timedOut ? 'Out of time' : m.res.why === 'early' ? 'Too early' : 'Too late', { made, of: 1 }, timedOut)
      g.stamp = { text: timedOut ? 'OUT OF TIME' : hit ? (buzzer ? 'AT THE BUZZER' : m.kind === 'swish' ? 'SWISH' : 'BUCKET') : (m.kind === 'air' ? 'AIRBALL' : 'BRICK'), good: hit, at, y: 92, size: timedOut || (hit && buzzer) ? 36 : 50 }
    } else if (game === 'free-throws') {
      g.done = outcome(avgQ, hit, `${made} of 2 made`, { made, of: 2 }, timedOut)
      g.stamp = { text: hit ? 'BOTH DOWN' : made ? 'SPLIT' : 'NO GOOD', good: hit, at, y: 92, size: 44 }
    } else if (game === 'spot') {
      g.done = outcome(made / 4 * 0.7 + avgQ * 0.3, hit, `${made} of 4 made`, { made, of: 4 }, timedOut)
      g.stamp = { text: `${made} OF 4`, good: hit, at, y: 92, size: 48 }
    } else if (game === 'velo') {
      const mph = Math.max(...reps.map(x => x.mph ?? 44))
      g.done = outcome(bestQ, hit, `${mph} mph`, { mph, clean: made }, timedOut)
      // (the speed is on the slab: the stamp says what it means)
      g.stamp = { text: hit ? 'GOOD ARM' : 'MISTIMED', good: hit, at, size: 46 }
    } else {
      const inches = Math.max(...reps.map(x => x.inches ?? 20))
      g.done = outcome(bestQ, hit, `${inches}" vertical`, { inches, clean: made }, timedOut)
      g.stamp = { text: hit ? 'GOOD JUMP' : 'MISTIMED', good: hit, at, size: 46 }
    }
  }
  return g
}

// ── The athlete ─────────────────────────────────────────────────────────────
// A pose is where things are, in the figure's own units (about 110 tall): x forward, y up from
// the floor. Knees and elbows are solved, so feet stay planted through a crouch and a hand can be
// put exactly on the ball. Everything lifts with j.
const THIGH = 24, SHIN = 25, UARM = 19, FARM = 20, TORSO = 38
const KEYS = ['hx', 'hy', 'lean', 'fFx', 'fFy', 'fBx', 'fBy', 'hFx', 'hFy', 'hBx', 'hBy', 'toeF', 'toeB', 'j']
export function pose(o) { return { hx: 0, hy: 45, lean: 0, fFx: 9, fFy: 0, fBx: -9, fBy: 0, hFx: 12, hFy: 44, hBx: -6, hBy: 44, toeF: 0, toeB: 0, j: 0, ...o } }
export function mixPose(a, b, f, out) {
  for (let i = 0; i < KEYS.length; i++) { const k = KEYS[i]; out[k] = a[k] + (b[k] - a[k]) * f }
  return out
}
export function newPose() { return pose({}) }
export const copyPose = (a, out) => { for (let i = 0; i < KEYS.length; i++) out[KEYS[i]] = a[KEYS[i]]; return out }
const IK = { jx: 0, jy: 0, ex: 0, ey: 0 }
// an arm: the elbow sits off the shoulder-to-hand line toward where elbows go (px, py), by as much of
// that direction as is square to the line. It's continuous everywhere: it just swings across as the arm does.
function armIK(ax, ay, tx, ty, l1, l2, px, py) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001
  const mx = l1 + l2 - 0.02
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx }
  const ux = dx / d, uy = dy / d, along = px * ux + py * uy, h = Math.sqrt(Math.max(0, l1 * l1 - (d * d) / 4))
  IK.jx = ax + dx / 2 + (px - ux * along) * h; IK.jy = ay + dy / 2 + (py - uy * along) * h
  IK.ex = ax + dx; IK.ey = ay + dy
}
// the outline every athlete wears: the art layer's ink
const INK = 'rgba(8,12,16,.82)'
// A body doesn't jump between poses: two soft lags in a row, so it starts and stops gently
export function easedState() { return { a: newPose(), b: newPose(), g: null } }
export function easedPose(st, target, g, dt, tau = 35) {
  if (st.g !== g || dt > 200) { copyPose(target, st.a); copyPose(target, st.b); st.g = g; return st.b }
  const f = 1 - Math.exp(-dt / tau)
  mixPose(st.a, target, f, st.a); mixPose(st.b, st.a, f, st.b)
  st.b.j = target.j   // (a jump is already a smooth curve, and a lag would cost the hand its height)
  return st.b
}
function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001
  const mx = l1 + l2 - 0.02
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx }
  const a = Math.atan2(dy, dx), c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), b = a + bend * Math.acos(c)
  IK.jx = ax + Math.cos(b) * l1; IK.jy = ay + Math.sin(b) * l1; IK.ex = ax + dx; IK.ey = ay + dy
}
// a tapered limb, added to the current path
function bone(ctx, x0, y0, r0, x1, y1, r1) {
  const a = Math.atan2(y1 - y0, x1 - x0), q = Math.PI / 2
  ctx.moveTo(x0 + Math.cos(a + q) * r0, y0 + Math.sin(a + q) * r0)
  ctx.arc(x0, y0, r0, a + q, a - q)
  ctx.arc(x1, y1, r1, a - q, a + q)
  ctx.closePath()
}
export const HANDS = { fx: 0, fy: 0, bx: 0, by: 0 }  // on the screen: near hand, far hand, the ball
export const SKINS = ['#8d5a3b', '#6d4229', '#a9744f', '#5a3522']
const shadeTable = { '#8d5a3b': '#6f452c', '#6d4229': '#553220', '#a9744f': '#875a3b', '#5a3522': '#452818' }
// (a real man's skin gets its own far-side shade, the same step darker as these)
const shadeFor = skin => {
  if (shadeTable[skin]) return shadeTable[skin]
  const n = parseInt(String(skin).slice(1, 7), 16)
  if (!Number.isFinite(n)) return '#6f452c'
  const v = b => Math.round(((n >> b) & 255) * 0.78).toString(16).padStart(2, '0')
  return (shadeTable[skin] = `#${v(16)}${v(8)}${v(0)}`)
}
// a man's last name under his feet: s is the rig's scale. Small however close he is, and never off the side.
export function meterTag(ctx, view, x, y, name, s) {
  if (!name) return
  const k = clamp(s * 1.05, 0.8, 1.4)
  nameTag(ctx, view, clamp(x, 34, view.w - 34), Math.min(y, view.h - 13 * k), name, k)
}
export function athlete(ctx, x, floorY, P, o = {}) {
  const { jersey = '#1b6fd1', trim = '#fff', skin = '#8d5a3b', s = 1.7, flip = false, gear = 'hoops', num = null, hair = '#15100c', ball = null, spin = 0, shadow = true } = o
  const pants = o.pants ?? (gear === 'fb' ? '#eef0ee' : jersey)
  const shoe = o.shoe ?? (gear === 'fb' ? '#16191c' : '#f3f3f0')
  const sock = o.sock ?? (gear === 'fb' ? jersey : '#f3f3f0')
  const shade = shadeFor(skin)
  const dir = flip ? -1 : 1
  const hipX = P.hx, hipY = -(P.hy + P.j), lean = P.lean
  const sl = Math.sin(lean), cl = Math.cos(lean)
  const sx = hipX + sl * TORSO, sy = hipY - cl * TORSO
  // the floor under him: a shadow, smaller as he leaves it
  if (shadow) {
    const up = clamp(P.j / 60, 0, 1)
    ctx.fillStyle = 'rgba(0,0,0,.3)'
    ctx.beginPath(); ctx.ellipse(x + dir * hipX * s, floorY + 2, (30 - up * 12) * s, (4.5 - up * 2) * s, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.save()
  ctx.translate(x, floorY); ctx.scale(dir * s, s)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // far arm
  armIK(sx - 1, sy + 2, P.hBx, -(P.hBy + P.j), UARM, FARM, -0.62, 0.78)
  const fbx = IK.ex, fby = IK.ey
  ctx.fillStyle = INK; ctx.beginPath()
  bone(ctx, sx - 1, sy + 2, 5.6, IK.jx, IK.jy, 4.6); bone(ctx, IK.jx, IK.jy, 4.6, IK.ex, IK.ey, 3.7)
  ctx.moveTo(IK.ex + 4.4, IK.ey); ctx.arc(IK.ex, IK.ey, 4.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = shade; ctx.beginPath()
  bone(ctx, sx - 1, sy + 2, 4.6, IK.jx, IK.jy, 3.6); bone(ctx, IK.jx, IK.jy, 3.6, IK.ex, IK.ey, 2.7)
  ctx.moveTo(IK.ex + 3.4, IK.ey); ctx.arc(IK.ex, IK.ey, 3.4, 0, Math.PI * 2)
  ctx.fill()
  // far leg
  leg(ctx, hipX - 1.5, hipY, P.fBx, -(P.fBy + P.j), P.toeB, shade, pants, sock, shoe, true, gear)
  // torso
  torso(ctx, hipX, hipY, sx, sy, sl, cl, jersey, trim, gear)
  // near leg
  leg(ctx, hipX + 1.5, hipY, P.fFx, -(P.fFy + P.j), P.toeF, skin, pants, sock, shoe, false, gear, trim)
  // the hips, over both thighs and the bottom of the jersey
  ctx.fillStyle = pants; ctx.beginPath()
  ctx.arc(hipX, hipY, gear === 'fb' ? 8.6 : 9.8, 0, Math.PI * 2); ctx.fill()
  if (gear === 'hoops') { ctx.strokeStyle = trim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hipX + sl * 5 - cl * 9, hipY - cl * 5 - sl * 9); ctx.lineTo(hipX + sl * 5 + cl * 9, hipY - cl * 5 + sl * 9); ctx.stroke() }
  // the number, the right way round whichever way he's facing
  if (num != null) {
    ctx.save(); ctx.translate(hipX + sl * 21, hipY - cl * 21); ctx.rotate(lean); ctx.scale(flip ? -1 : 1, 1)
    text(ctx, String(num), 0, 0, { font: DISPLAY, size: 13, color: inkOn(jersey, trim) })
    ctx.restore()
  }
  // neck and head
  const hx = sx + sl * 13 + 1.2, hy = sy - cl * 13
  ctx.fillStyle = shade; ctx.beginPath(); bone(ctx, sx + 0.5, sy, 4.2, hx - 0.5, hy, 4); ctx.fill()
  if (gear === 'fb') helmet(ctx, hx, hy, jersey, trim)
  else {
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 1.1; circle(ctx, hx, hy, 8.8); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(hx + 8, hy - 2); ctx.lineTo(hx + 10.6, hy + 1.5); ctx.lineTo(hx + 7.4, hy + 3); ctx.fill()
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx, hy, 9.2, -0.8, 2.95, true); ctx.closePath(); ctx.fill()
    ctx.fillStyle = shade; circle(ctx, hx - 1.2, hy + 0.8, 1.9); ctx.fill()
  }
  // the ball, between the body and the near arm
  armIK(sx + 1, sy + 2, P.hFx, -(P.hFy + P.j), UARM, FARM, -0.62, 0.78)
  const ex = IK.ex, ey = IK.ey, jx = IK.jx, jy = IK.jy
  if (ball) {
    const bxL = ex + ball.x, byL = ey - ball.y
    HANDS.bx = x + dir * s * bxL; HANDS.by = floorY + s * byL
    if (ball.draw) ball.draw(ctx, bxL, byL, ball.r, spin)
  }
  // near arm
  ctx.fillStyle = INK; ctx.beginPath()
  bone(ctx, sx + 1, sy + 2, 6, jx, jy, 4.9); bone(ctx, jx, jy, 4.9, ex, ey, 3.9)
  ctx.moveTo(ex + 4.7, ey); ctx.arc(ex, ey, 4.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath()
  bone(ctx, jx, jy, 3.9, ex, ey, 2.9)
  ctx.moveTo(ex + 3.7, ey); ctx.arc(ex, ey, 3.7, 0, Math.PI * 2)
  if (gear !== 'fb') bone(ctx, sx + 1, sy + 2, 5, jx, jy, 3.9)
  ctx.fill()
  if (gear === 'fb') { ctx.fillStyle = jersey; ctx.beginPath(); bone(ctx, sx + 1, sy + 2, 6.4, jx, jy, 4.6); ctx.fill(); ctx.fillStyle = trim; ctx.beginPath(); bone(ctx, lerp(sx + 1, jx, 0.7), lerp(sy + 2, jy, 0.7), 4.9, lerp(sx + 1, jx, 0.84), lerp(sy + 2, jy, 0.84), 4.7); ctx.fill() }
  ctx.restore()
  HANDS.fx = x + dir * s * ex; HANDS.fy = floorY + s * ey
  HANDS.ox = x + dir * s * fbx; HANDS.oy = floorY + s * fby
}
function leg(ctx, hx, hy, fx, fy, toe, skin, pants, sock, shoe, far, gear, trim) {
  ik(hx, hy, fx, fy - 2.5, THIGH, SHIN, -1)
  const jx = IK.jx, jy = IK.jy, ex = IK.ex, ey = IK.ey
  ctx.fillStyle = INK; ctx.beginPath()
  bone(ctx, hx, hy, 7.4, jx, jy, 5.5); bone(ctx, jx, jy, 5.6, ex, ey, 3.9)
  ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath()
  bone(ctx, hx, hy, 6.4, jx, jy, 4.5); bone(ctx, jx, jy, 4.6, ex, ey, 2.9)
  ctx.fill()
  // shorts or pants: cut flat at the hem
  const f = gear === 'fb' ? 1.06 : 0.76, hemW = gear === 'fb' ? 5.6 : 9.2
  const dx = (jx - hx) / THIGH, dy = (jy - hy) / THIGH, mx = lerp(hx, jx, f), my = lerp(hy, jy, f)
  ctx.fillStyle = far ? darker(pants) : pants; ctx.beginPath()
  const topW = gear === 'fb' ? 7.6 : 9
  ctx.moveTo(hx - dy * topW, hy + dx * topW); ctx.lineTo(mx - dy * hemW, my + dx * hemW); ctx.lineTo(mx + dy * hemW, my - dx * hemW); ctx.lineTo(hx + dy * topW, hy - dx * topW); ctx.closePath()
  ctx.fill()
  if (gear === 'hoops' && trim) { ctx.strokeStyle = trim; ctx.lineWidth = 1.7; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(mx - dy * hemW - dx * 2, my + dx * hemW - dy * 2); ctx.lineTo(mx + dy * hemW - dx * 2, my - dx * hemW - dy * 2); ctx.stroke(); ctx.lineCap = 'round' }
  // sock and shoe
  ctx.fillStyle = far ? darker(sock) : sock; ctx.beginPath()
  bone(ctx, lerp(jx, ex, gear === 'fb' ? 0.2 : 0.62), lerp(jy, ey, gear === 'fb' ? 0.2 : 0.62), gear === 'fb' ? 4.2 : 3.4, ex, ey, 3)
  ctx.fill()
  const ca = Math.cos(toe), sa = Math.sin(toe)
  ctx.fillStyle = far ? darker(shoe) : shoe; ctx.beginPath()
  bone(ctx, ex - ca * 2.5, ey + sa * -2.5 + 1, 3.3, ex + ca * 9, ey + sa * 9 + 1.2, 2.5)
  ctx.fill()
}
// a slightly darker version of a colour, for what's on the far side (remembered: asked for every frame)
const darkCache = new Map()
function darker(c) {
  let d = darkCache.get(c)
  if (d) return d
  const m = /^#([0-9a-f]{6})$/i.exec(c)
  if (!m) { d = c } else {
    const n = parseInt(m[1], 16), f = v => Math.round(v * 0.72)
    d = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
  }
  darkCache.set(c, d)
  return d
}
function torso(ctx, hipX, hipY, sx, sy, sl, cl, jersey, trim, gear) {
  const sw = gear === 'fb' ? 13.5 : 11.6, ww = gear === 'fb' ? 9.8 : 9
  const fx = sx + cl * sw, fy = sy + sl * sw, bx = sx - cl * sw, by = sy - sl * sw
  const wfx = hipX + cl * ww, wfy = hipY + sl * ww, wbx = hipX - cl * ww, wby = hipY - sl * ww
  const mx = (sx + hipX) / 2, my = (sy + hipY) / 2
  ctx.fillStyle = jersey; ctx.beginPath()
  ctx.moveTo(fx, fy)
  ctx.quadraticCurveTo(mx + cl * (ww + 3.4), my + sl * (ww + 3.4), wfx, wfy)
  ctx.lineTo(wbx, wby)
  ctx.quadraticCurveTo(mx - cl * (ww + 2.2), my - sl * (ww + 2.2), bx, by)
  ctx.quadraticCurveTo(sx - sl * 0 + sl * 5, sy - cl * 5, fx, fy)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke()
  // collar / side panel in the trim
  ctx.strokeStyle = trim; ctx.lineWidth = 1.7
  ctx.beginPath(); ctx.moveTo(lerp(bx, sx, 0.55), lerp(by, sy, 0.55) - cl * 2.2); ctx.quadraticCurveTo(sx + sl * 1 + cl * 3, sy + cl * 3, lerp(fx, sx, 0.4), lerp(fy, sy, 0.4) - cl * 1.2); ctx.stroke()
}
function helmet(ctx, x, y, jersey, trim) {
  ctx.fillStyle = trim; ctx.strokeStyle = INK; ctx.lineWidth = 1.1; circle(ctx, x, y - 0.6, 11); ctx.fill(); ctx.stroke()
  // the stripe down the crown, the ear hole, the mask
  ctx.strokeStyle = jersey; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(x, y - 0.6, 9.6, -2.9, -0.5); ctx.stroke()
  ctx.fillStyle = '#16191c'; circle(ctx, x - 1, y + 1, 2); ctx.fill()
  ctx.strokeStyle = '#2b3036'; ctx.lineWidth = 1.5; ctx.beginPath()
  ctx.moveTo(x + 8, y - 3.4); ctx.lineTo(x + 14, y - 2.6); ctx.lineTo(x + 13.2, y + 6.8); ctx.lineTo(x + 5, y + 8.4)
  ctx.moveTo(x + 8.8, y + 1.2); ctx.lineTo(x + 13.8, y + 1.6)
  ctx.moveTo(x + 7.5, y + 4.8); ctx.lineTo(x + 13.4, y + 4.4)
  ctx.stroke()
}

// ── The arena, painted once ─────────────────────────────────────────────────
// A cheap repeatable rng for the paint jobs (never touches the game's)
const dice = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
// the dark above the wall, and the roof lights coming down through it
function paintRoof(x, view, horizon, beams, alpha, stops) {
  const bg = x.createLinearGradient(0, 0, 0, horizon)
  stops.forEach((c, i) => bg.addColorStop(i / (stops.length - 1), c))
  x.fillStyle = bg; x.fillRect(0, 0, view.w, horizon)
  return () => {
    const b = x.createLinearGradient(0, 44, 0, horizon)
    b.addColorStop(0, `rgba(255,246,228,${alpha})`); b.addColorStop(1, 'rgba(255,246,228,0)')
    x.fillStyle = b
    for (const c of beams) { x.beginPath(); x.moveTo(c - 11, 44); x.lineTo(c + 11, 44); x.lineTo(c + 88, horizon); x.lineTo(c - 88, horizon); x.fill() }
  }
}
export function paintBowl(x, view, { horizon, us, trim, dim = 0, seed = 7, board = 'BUILD-A-PLAYER' }) {
  const { w } = view
  const U = view.h / 640
  const beams = paintRoof(x, view, horizon, [62, 180, 298], 0.09, ['#05080c', '#0b1219', '#141c26'])
  // the upper deck, row on row of people, in the dark
  const R = dice(seed)
  const pal = ['#2b323b', '#37404a', '#232931', '#434d57', '#4d4a45', us, '#5b3029', '#26394a', '#6a6860']
  let y = 58 * U, row = 0
  while (y < horizon - 26 * U) {
    const f = (y / horizon), hs = lerp(2.4, 5, f) * U, gap = hs * 2.5
    x.fillStyle = `rgba(255,255,255,${lerp(0.015, 0.045, f)})`; x.fillRect(0, y - hs * 1.4, w, 1)
    for (let px = -gap + (row % 2) * gap * 0.5; px < w + gap; px += gap) {
      const jit = R()
      if (jit < 0.05) continue
      x.fillStyle = Math.sin(px * 0.045 + row * 0.25) > 0.45 && R() < 0.72 ? us : pal[Math.floor(R() * pal.length)]
      x.globalAlpha = lerp(0.3, 0.62, f)
      x.fillRect(px - hs * 0.9, y + hs * 0.2, hs * 1.8, hs * 1.8)
      x.fillStyle = R() < 0.5 ? '#6e5340' : '#463326'
      x.beginPath(); x.arc(px + (jit - 0.5) * hs * 0.6, y - hs * 0.15, hs * 0.62, 0, 6.3); x.fill()
    }
    x.globalAlpha = 1
    y += hs * 2.7; row++
  }
  // the lights over it all
  beams()
  // the courtside board
  const bh = 22 * U
  x.fillStyle = '#0a0e12'; x.fillRect(0, horizon - bh, w, bh)
  x.fillStyle = us; x.fillRect(0, horizon - bh + 2 * U, w, bh - 4 * U)
  x.globalAlpha = 0.28; x.fillStyle = '#000'; x.fillRect(0, horizon - bh + 2 * U, w, bh - 4 * U); x.globalAlpha = 1
  for (let px = 54; px < w + 60; px += 134) text(x, board, px, horizon - bh / 2 + 0.5, { font: DISPLAY, size: 12 * U, color: boardInk(us, trim), track: 1 })
  if (dim) { x.fillStyle = `rgba(4,7,11,${dim})`; x.fillRect(0, 0, w, horizon) }
}
// ── The camera ──────────────────────────────────────────────────────────────
// The court is real: feet, the rim at the origin, x across, z toward the baseline, y up. Every line,
// the hoop and the ball go through one projection, so they can't disagree. We look over the
// shooter's shoulder: he's big and close, the rim is as far away as the shot really is.
export const FIG_FT = 110 / 6.5     // rig units a foot
export const RIM_R = 0.75, RIM_Y = 10, BALL_R = 0.43
const BASELINE = 5.25, BOARD_Z = 1.25
const THREE = 23.75, CORNER = 22, CORNER_Z = -Math.sqrt(THREE * THREE - CORNER * CORNER), LANE = 8, FT_Z = BASELINE - 19
export const PT = { x: 0, y: 0, k: 0, z: 0 }
export function project(c, x, y, z) {
  const dx = x - c.cx, dz = z - c.cz, X = dx * c.cos - dz * c.sin, Z = dx * c.sin + dz * c.cos
  PT.z = Z; PT.k = c.F / Math.max(Z, 1); PT.x = c.px + X * PT.k; PT.y = c.hz + (c.H - y) * PT.k
  return PT
}
// point the camera: the shooter stands D feet from the rim at theta (radians, 0 = top of the key),
// and comes out at zs feet from the lens and xs feet left of the rim's line
export function aimCam(c, theta, D, xs, zs) {
  const psi = Math.asin(clamp(xs / D, -1, 1)) - theta, zr = zs + D * Math.cos(theta + psi)
  c.cos = Math.cos(psi); c.sin = Math.sin(psi); c.cx = -zr * c.sin; c.cz = -zr * c.cos
  return c
}
// a painted line on the floor is a thin quad on the floor, so it narrows with distance like a real one
function quad(x, c, ax, az, bx, bz, w) {
  const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * w, nz = (dx / l) * w
  project(c, ax + nx, 0, az + nz); if (PT.z < 2) return; const x0 = PT.x, y0 = PT.y
  project(c, bx + nx, 0, bz + nz); if (PT.z < 2) return; const x1 = PT.x, y1 = PT.y
  project(c, bx - nx, 0, bz - nz); if (PT.z < 2) return; const x2 = PT.x, y2 = PT.y
  project(c, ax - nx, 0, az - nz); if (PT.z < 2) return
  x.moveTo(x0, y0); x.lineTo(x1, y1); x.lineTo(x2, y2); x.lineTo(PT.x, PT.y); x.closePath()
}
function line(x, c, ax, az, bx, bz, n = 4, w = 0.11) {
  for (let i = 0; i < n; i++) quad(x, c, lerp(ax, bx, i / n), lerp(az, bz, i / n), lerp(ax, bx, (i + 1) / n), lerp(az, bz, (i + 1) / n), w)
}
function arcLine(x, c, cx, cz, R, a0, a1, n, w = 0.11) {
  for (let i = 0; i < n; i++) {
    const p = lerp(a0, a1, i / n), q = lerp(a0, a1, (i + 1) / n)
    quad(x, c, cx + R * Math.sin(p), cz - R * Math.cos(p), cx + R * Math.sin(q), cz - R * Math.cos(q), w)
  }
}
// the floor: boards, the paint, and only the lines a real half court has, each where it belongs
export function paintLines(x, c, paint) {
  // past the baseline the floor goes dark
  x.fillStyle = 'rgba(10,8,6,.3)'; x.beginPath(); fan(x, c, [[-70, BASELINE], [70, BASELINE], [70, 40], [-70, 40]]); x.fill()
  // the boards run the length of the court
  x.strokeStyle = 'rgba(70,35,10,.13)'; x.lineWidth = 1; x.beginPath()
  for (let u = -46; u <= 46 && !c.bare; u += 2) {   // (bare: the arena's floor, plain the whole way as the camera travels)
    project(c, u, 0, BASELINE); if (PT.z < 3) continue
    const ax = PT.x, ay = PT.y; project(c, u, 0, -46); if (PT.z < 3) continue
    x.moveTo(ax, ay); x.lineTo(PT.x, PT.y)
  }
  x.stroke()
  // the paint
  x.fillStyle = paint; x.globalAlpha = 0.72; x.beginPath(); fan(x, c, [[-LANE, BASELINE], [LANE, BASELINE], [LANE, FT_Z], [-LANE, FT_Z]]); x.fill()
  x.globalAlpha = 1
  x.fillStyle = '#f7f5ef'; x.beginPath()
  line(x, c, -30, BASELINE, 30, BASELINE, 12)
  line(x, c, -LANE, BASELINE, -LANE, FT_Z, 5); line(x, c, LANE, BASELINE, LANE, FT_Z, 5); line(x, c, -LANE, FT_Z, LANE, FT_Z, 5)
  arcLine(x, c, 0, FT_Z, 6, -Math.PI / 2, Math.PI / 2, 24)
  arcLine(x, c, 0, 0, 4, -Math.PI / 2, Math.PI / 2, 28, 0.09)
  const a = Math.asin(CORNER / THREE)
  arcLine(x, c, 0, 0, THREE, -a, a, 64)
  line(x, c, -CORNER, BASELINE, -CORNER, CORNER_Z, 4); line(x, c, CORNER, BASELINE, CORNER, CORNER_Z, 4)
  x.fill()
}
function fan(x, c, pts) {
  let n = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    // walk each edge, so a corner behind the lens clips instead of folding the shape over
    for (let j = 0; j < 8; j++) {
      project(c, lerp(a[0], b[0], j / 8), 0, lerp(a[1], b[1], j / 8))
      if (PT.z < 2) continue
      if (n++) x.lineTo(PT.x, PT.y); else x.moveTo(PT.x, PT.y)
    }
  }
  x.closePath()
}
function bar(x, c, ax, ay, az, bx, by, bz, w) {
  project(c, ax, ay, az); const x0 = PT.x, y0 = PT.y, k = PT.k
  project(c, bx, by, bz)
  x.lineWidth = Math.max(1, w * k); x.beginPath(); x.moveTo(x0, y0); x.lineTo(PT.x, PT.y); x.stroke()
}
// the board, its arm and post, in the team's pad
export function paintHoop(x, c, us) {
  x.lineCap = 'butt'
  x.strokeStyle = '#3a424b'
  bar(x, c, 0, 11.6, BOARD_Z + 0.1, 0, 12.2, BASELINE + 3.2, 0.34)
  bar(x, c, 0, 10.6, BOARD_Z + 0.1, 0, 9.6, BASELINE + 3.2, 0.3)
  x.strokeStyle = '#2b3138'; bar(x, c, 0, 5, BASELINE + 3.4, 0, 12.4, BASELINE + 3.4, 0.5)
  x.strokeStyle = us; bar(x, c, 0, 0, BASELINE + 3.4, 0, 6, BASELINE + 3.4, 1.15)
  x.strokeStyle = 'rgba(0,0,0,.45)'; bar(x, c, 0, 0, BASELINE + 3.4, 0, 6, BASELINE + 3.4, 1.15)
  project(c, 0, 0, BASELINE + 3.4); x.fillStyle = 'rgba(0,0,0,.34)'; x.beginPath(); x.ellipse(PT.x, PT.y, 1.5 * PT.k, 0.5 * PT.k, 0, 0, Math.PI * 2); x.fill()
  paintBoard(x, c)
}
// the glass, its squares and the bracket: what a man behind the board goes behind
export function paintBoard(x, c) {
  const corners = [[-3, 13], [3, 13], [3, 9.5], [-3, 9.5]]
  x.beginPath()
  corners.forEach((p, i) => { project(c, p[0], p[1], BOARD_Z); if (i) x.lineTo(PT.x, PT.y); else x.moveTo(PT.x, PT.y) })
  x.closePath()
  x.fillStyle = 'rgba(205,225,235,.26)'; x.fill()
  project(c, 0, 11, BOARD_Z)
  x.strokeStyle = '#f4f6f8'; x.lineWidth = Math.max(1.6, 0.14 * PT.k); x.lineJoin = 'round'; x.stroke()
  x.beginPath();
  [[-1, 11.5], [1, 11.5], [1, 10], [-1, 10]].forEach((p, i) => { project(c, p[0], p[1], BOARD_Z); if (i) x.lineTo(PT.x, PT.y); else x.moveTo(PT.x, PT.y) })
  x.closePath(); x.lineWidth = Math.max(1.2, 0.09 * PT.k); x.stroke()
  x.strokeStyle = '#b94c14'; bar(x, c, 0, RIM_Y, BOARD_Z, 0, RIM_Y, RIM_R, 0.2)
}
// half the rim, the half nearer the lens or the half further away. Ball's turn goes in between
export function rimHalf(ctx, c, front, dy = 0) {
  const a0 = Math.atan2(c.cz, c.cx) + (front ? -Math.PI / 2 : Math.PI / 2)
  ctx.strokeStyle = front ? '#f26a1b' : '#a8400f'
  project(c, 0, RIM_Y, 0); ctx.lineWidth = Math.max(front ? 2.2 : 1.8, 0.14 * PT.k); ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i <= 10; i++) {
    const a = a0 + (i / 10) * Math.PI
    project(c, Math.cos(a) * RIM_R, RIM_Y, Math.sin(a) * RIM_R)
    if (i) ctx.lineTo(PT.x, PT.y + dy); else ctx.moveTo(PT.x, PT.y + dy)
  }
  ctx.stroke()
}
// age: ms since the ball went through (null: it hasn't). It whips, and settles
export function netOf(ctx, c, age, dy = 0) {
  let lift = 0, bulge = 0
  if (age != null && age >= 0 && age < 1000) {
    bulge = age < 200 ? Math.sin((age / 200) * Math.PI) * 0.2 : 0
    lift = Math.exp(-age / 260) * (0.34 + Math.sin(age / 42) * 0.2) * Math.min(1, age / 90)
  }
  const H = 1.45 * (1 - lift), botY = RIM_Y - H, midY = RIM_Y - H * 0.5
  const midR = RIM_R * (0.8 + bulge), botR = RIM_R * (0.55 + bulge * 0.5)
  project(c, 0, RIM_Y, 0)
  ctx.strokeStyle = 'rgba(246,248,250,.95)'; ctx.lineWidth = Math.max(0.9, 0.05 * PT.k); ctx.beginPath()
  const N = 8
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, b = ((i + 1) / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b)
    // the diamonds: top to mid, and on to the bottom one strand over
    project(c, ca * RIM_R, RIM_Y, sa * RIM_R); ctx.moveTo(PT.x, PT.y + dy)
    project(c, cb * midR, midY, sb * midR); ctx.lineTo(PT.x, PT.y + dy)
    project(c, ca * botR, botY, sa * botR); ctx.lineTo(PT.x, PT.y + dy)
    project(c, cb * RIM_R, RIM_Y, sb * RIM_R); ctx.moveTo(PT.x, PT.y + dy)
    project(c, ca * midR, midY, sa * midR); ctx.lineTo(PT.x, PT.y + dy)
    project(c, cb * botR, botY, sb * botR); ctx.lineTo(PT.x, PT.y + dy)
  }
  ctx.stroke()
}
// the ball and its shadow, wherever it is on the court
export function ballIn(ctx, c, x, y, z, spin) {
  project(c, x, 0, z)
  const sx = PT.x, sy = PT.y, sk = PT.k
  ctx.fillStyle = `rgba(0,0,0,${y > 7 ? 0.14 : 0.26})`
  ctx.beginPath(); ctx.ellipse(sx, sy, BALL_R * sk * 1.05, BALL_R * sk * 0.42, 0, 0, Math.PI * 2); ctx.fill()
  project(c, x, y, z)
  basketball(ctx, PT.x, PT.y, { r: BALL_R * PT.k, spin })
}

// the ball's trip: a list of parabolas in the court's feet, one after another
function seg(list, dur, ax, ay, az, bx, by, bz, apex = 0, drop = false) { list.push({ dur, ax, ay, az, bx, by, bz, apex, drop }) }
const BALL = { x: 0, y: 0, z: 0 }
export function ballAt(list, tau) {
  let i = 0
  while (i < list.length - 1 && tau > list[i].dur) { tau -= list[i].dur; i++ }
  const s = list[i], f = clamp(tau / s.dur, 0, 1), fy = s.drop ? f * f * 0.65 + f * 0.35 : f
  BALL.x = lerp(s.ax, s.bx, f); BALL.z = lerp(s.az, s.bz, f)
  BALL.y = lerp(s.ay, s.by, fy) + s.apex * 4 * f * (1 - f)
  return BALL
}
const FL = BALL_R
function bounces(list, x, z, dx, dz) {
  seg(list, 400, x, FL, z, x + dx, FL, z + dz, 3.2)
  seg(list, 260, x + dx, FL, z + dz, x + dx * 1.5, FL, z + dz * 1.5, 1.1)
  seg(list, 160, x + dx * 1.5, FL, z + dz * 1.5, x + dx * 1.8, FL, z + dz * 1.8, 0.35)
  seg(list, 500, x + dx * 1.8, FL, z + dz * 1.8, x + dx * 2.4, FL, z + dz * 2.4, 0)
}
// from the hand to the rim, then what the shot does. dx, dz: the way back to the shooter
function shotPath(m, sx, sy, sz) {
  const list = [], F = m.flyMs ?? 800
  const D = Math.hypot(sx, sz), dx = sx / D, dz = sz / D, sideX = -dz, sideZ = dx
  const peak = RIM_Y + D * 0.26   // a real arc: about 16 feet up from 24 feet out
  const apex = yEnd => peak - (sy + yEnd) / 2
  const through = (x, y, z) => {
    seg(list, 130, x, y, z, x, RIM_Y - 1.5, z, 0, true)
    seg(list, 400, x, RIM_Y - 1.5, z, x + dx * 0.3, FL, z + dz * 0.3, 0, true)
    bounces(list, x + dx * 0.3, z + dz * 0.3, dx * 1.5 + sideX * 0.3, dz * 1.5 + sideZ * 0.3)
  }
  const R = RIM_R
  if (m.kind === 'swish') { seg(list, F, sx, sy, sz, 0, RIM_Y + 0.1, 0, apex(RIM_Y)); through(0, RIM_Y + 0.1, 0) }
  else if (m.kind === 'rattle') {
    const fx = dx * R * 0.8, fz = dz * R * 0.8
    seg(list, F, sx, sy, sz, fx, RIM_Y + BALL_R * 0.8, fz, apex(RIM_Y))
    seg(list, 240, fx, RIM_Y + BALL_R * 0.8, fz, 0, RIM_Y + 0.1, 0, 0.7)
    through(0, RIM_Y + 0.1, 0)
  } else if (m.kind === 'front') {
    const fx = dx * (R + 0.1), fz = dz * (R + 0.1), tx = dx * 8 + sideX * 1.5, tz = dz * 8 + sideZ * 1.5
    seg(list, F, sx, sy, sz, fx, RIM_Y + BALL_R, fz, apex(RIM_Y))
    seg(list, 700, fx, RIM_Y + BALL_R, fz, tx, FL, tz, 1.8)
    bounces(list, tx, tz, dx * 3, dz * 3)
  } else if (m.kind === 'back') {
    const fx = -dx * R * 0.75, fz = -dz * R * 0.75, tx = dx * 7 - sideX * 2, tz = dz * 7 - sideZ * 2
    seg(list, F, sx, sy, sz, fx, RIM_Y + BALL_R, fz, apex(RIM_Y))
    seg(list, 800, fx, RIM_Y + BALL_R, fz, tx, FL, tz, 3.4)
    bounces(list, tx, tz, dx * 3, dz * 3)
  } else if (m.kind === 'board') {
    const bz = BOARD_Z - BALL_R, bx = dx * 0.6 + sideX * 0.8, by = 11.8, tx = dx * 10 + sideX * 2.5, tz = dz * 10 + sideZ * 2.5
    seg(list, F, sx, sy, sz, bx, by, bz, apex(by))
    seg(list, 760, bx, by, bz, tx, FL, tz, 2)
    bounces(list, tx, tz, dx * 3, dz * 3)
  } else {
    const tx = dx * 3 + sideX * 0.7, tz = dz * 3 + sideZ * 0.7
    seg(list, F, sx, sy, sz, tx, 8, tz, peak - 0.5 - (sy + 8) / 2)
    seg(list, 260, tx, 8, tz, tx - dx * 0.7, FL, tz - dz * 0.7, 0, true)
    bounces(list, tx - dx * 0.7, tz - dz * 0.7, dx * 1.6, dz * 1.6)
  }
  return list
}

// ── The athlete, from behind or from the front ──────────────────────────────
// The same kind of pose as the side view, but x is across his body: F is his right side (screen
// right from behind), B his left. Knees and elbows solve outward. lean tips him sideways.
function ikOut(ax, ay, tx, ty, l1, l2, out) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001
  const mx = l1 + l2 - 0.02
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx }
  const a = Math.atan2(dy, dx), b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
  const x1 = ax + Math.cos(a + b) * l1, x2 = ax + Math.cos(a - b) * l1
  const pick = (x1 - x2) * out >= 0 ? a + b : a - b
  IK.jx = ax + Math.cos(pick) * l1; IK.jy = ay + Math.sin(pick) * l1; IK.ex = ax + dx; IK.ey = ay + dy
}
// The arms and the legs each go down as one batch of paths: both limbs in one fill per tone. So he's got a
// shoulder, a forearm, a hand, a shadow side, and still costs fewer fills than he did with one limb at a time.
const ARM_A = { sx: 0, sy: 0, jx: 0, jy: 0, ex: 0, ey: 0, out: 1 }, ARM_B = { sx: 0, sy: 0, jx: 0, jy: 0, ex: 0, ey: 0, out: 1 }
function solveArm(A, sx, sy, hx, hy, out) {
  const up = clamp((sy - hy) / 30, 0, 1)   // the hand above the shoulder
  armIK(sx, sy, hx, hy, UARM, FARM, out * (0.32 - 0.14 * up), 0.92 - 0.1 * up)
  A.sx = sx; A.sy = sy; A.jx = IK.jx; A.jy = IK.jy; A.ex = IK.ex; A.ey = IK.ey; A.out = out
}
// (d: how much bigger the ink is than the skin)
function armPath(ctx, A, d) {
  const dx = A.ex - A.jx, dy = A.ey - A.jy, fl = Math.hypot(dx, dy) || 1, ux = dx / fl, uy = dy / fl, px = -uy, py = ux
  const t = -A.out * (px >= 0 ? 1 : -1)   // (the thumb's on the inside of the hand)
  limb(ctx, A.sx, A.sy, 5.5 + d, A.jx, A.jy, 3.5 + d, 0.8, 0.8)
  limb(ctx, A.jx, A.jy, 3.5 + d, A.ex, A.ey, 2 + d, 1.5, 1.5)
  limb(ctx, A.ex + ux * 0.8, A.ey + uy * 0.8, 2.8 + d, A.ex + ux * 4.6, A.ey + uy * 4.6, 2.3 + d)
  const bx = A.ex + ux + px * t * 2.4, by = A.ey + uy + py * t * 2.4
  limb(ctx, bx, by, 1.05 + d, bx + ux * 2.4 + px * t * 0.5, by + uy * 2.4 + py * t * 0.5, 0.85 + d)
}
function paintArms(ctx, a, b, skin, dark) {
  ctx.fillStyle = INK; ctx.beginPath(); if (a) armPath(ctx, a, 1); if (b) armPath(ctx, b, 1); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath(); if (a) armPath(ctx, a, 0); if (b) armPath(ctx, b, 0); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath()
  if (a) { limbShade(ctx, a.sx, a.sy, 5.5, a.jx, a.jy, 3.5, 0.8, 0.8); limbShade(ctx, a.jx, a.jy, 3.5, a.ex, a.ey, 2, 1.5, 1.5) }
  if (b) { limbShade(ctx, b.sx, b.sy, 5.5, b.jx, b.jy, 3.5, 0.8, 0.8); limbShade(ctx, b.jx, b.jy, 3.5, b.ex, b.ey, 2, 1.5, 1.5) }
  ctx.fill()
}
const LEG_A = { hx: 0, hy: 0, jx: 0, jy: 0, ex: 0, ey: 0, out: 1, dx: 0, dy: 1, mx: 0, my: 0, b0: 0, b1: 0 }, LEG_B = { ...LEG_A }
function solveLeg(L, hx, hy, fx, fy, out) {
  const ex = fx, ey = fy - 2.6, reach = clamp(1 - Math.hypot(ex - hx, ey - hy) / (THIGH + SHIN), 0, 1)
  L.hx = hx; L.hy = hy; L.ex = ex; L.ey = ey; L.out = out
  L.jx = (hx + ex) / 2 + out * reach * 9; L.jy = (hy + ey) / 2 - reach * 2
  const tl = Math.hypot(L.jx - hx, L.jy - hy) || 1
  L.dx = (L.jx - hx) / tl; L.dy = (L.jy - hy) / tl; L.mx = lerp(hx, L.jx, 0.8); L.my = lerp(hy, L.jy, 0.8)
  L.b0 = out < 0 ? 1.7 : 0.3; L.b1 = out < 0 ? 0.3 : 1.7   // (the calf swells on the outside)
}
function legInk(ctx, L) { limb(ctx, L.hx, L.hy, 7.9, L.jx, L.jy, 6, 1, 1); limb(ctx, L.jx, L.jy, 6.1, L.ex, L.ey, 4.1, L.b0, L.b1) }
function legSkin(ctx, L) { limb(ctx, L.hx, L.hy, 6.9, L.jx, L.jy, 5, 1, 1); limb(ctx, L.jx, L.jy, 5.1, L.ex, L.ey, 3.1, L.b0, L.b1) }
function legDark(ctx, L) { limbShade(ctx, L.hx, L.hy, 6.9, L.jx, L.jy, 5, 1, 1); limbShade(ctx, L.jx, L.jy, 5.1, L.ex, L.ey, 3.1, L.b0, L.b1) }
// the sock, cut square at the top
function sockPath(ctx, L) {
  const sl = Math.hypot(L.ex - L.jx, L.ey - L.jy) || 1, nx = -(L.ey - L.jy) / sl, ny = (L.ex - L.jx) / sl, a = lerp(L.jx, L.ex, 0.62), b = lerp(L.jy, L.ey, 0.62)
  ctx.moveTo(a + nx * 3.9, b + ny * 3.9); ctx.lineTo(L.ex + nx * 3.1, L.ey + ny * 3.1); ctx.lineTo(L.ex - nx * 3.1, L.ey - ny * 3.1); ctx.lineTo(a - nx * 3.9, b - ny * 3.9); ctx.closePath()
}
// a sneaker, seen a little from the front: heel, collar, a rounded toe
function shoePath(ctx, { ex, ey, out }) {
  const g = ey + 4.5
  ctx.moveTo(ex - out * 3.2, g); ctx.lineTo(ex - out * 3.5, ey + 0.2)
  ctx.quadraticCurveTo(ex - out * 0.6, ey - 2.4, ex + out * 2.2, ey - 0.8)
  ctx.quadraticCurveTo(ex + out * 4.2, ey + 0.2, ex + out * 5.5, ey + 2)
  ctx.quadraticCurveTo(ex + out * 6.2, g - 0.5, ex + out * 5.4, g)
  ctx.closePath()
}
// the colour on the shoe: a heel counter and a panel over the toe
function shoeTrim(ctx, { ex, ey, out }) {
  ctx.moveTo(ex - out * 3.2, ey + 3.4); ctx.lineTo(ex - out * 3.4, ey + 0.6); ctx.lineTo(ex - out * 1.2, ey); ctx.lineTo(ex - out * 0.8, ey + 3.4); ctx.closePath()
  ctx.moveTo(ex + out * 1.8, ey + 3.4); ctx.lineTo(ex + out * 2.8, ey + 0.4); ctx.lineTo(ex + out * 5.1, ey + 2.2); ctx.lineTo(ex + out * 5.3, ey + 3.4); ctx.closePath()
}
function shortsPath(ctx, { hx, hy, mx, my, dx, dy }) {
  ctx.moveTo(hx - dy * 7.4, hy + dx * 7.4); ctx.lineTo(mx - dy * 7.6, my + dx * 7.6); ctx.lineTo(mx + dy * 7.6, my - dx * 7.6); ctx.lineTo(hx + dy * 7.4, hy - dx * 7.4); ctx.closePath()
}
function shortsDark(ctx, { hx, hy, mx, my, dx, dy }) {
  const k = dy >= 0 ? 1 : -1   // (the screen-right side of this leg)
  ctx.moveTo(hx + k * dy * 2, hy - k * dx * 2); ctx.lineTo(mx + k * dy * 2.4, my - k * dx * 2.4); ctx.lineTo(mx + k * dy * 7.6, my - k * dx * 7.6); ctx.lineTo(hx + k * dy * 7.4, hy - k * dx * 7.4); ctx.closePath()
}
// the hem, and a stripe down the outside of the leg
function shortsTrim(ctx, { hx, hy, mx, my, dx, dy, out }) {
  const s = (dy >= 0 ? 1 : -1) * out
  ctx.moveTo(mx - dy * 7.6 - dx * 1.9, my + dx * 7.6 - dy * 1.9); ctx.lineTo(mx + dy * 7.6 - dx * 1.9, my - dx * 7.6 - dy * 1.9)
  ctx.moveTo(hx + s * dy * 5.8, hy - s * dx * 5.8); ctx.lineTo(mx + s * dy * 6 - dx * 2.8, my - s * dx * 6 - dy * 2.8)
}
function paintLegs(ctx, A, B, skin, dark, jersey, trim) {

  ctx.fillStyle = INK; ctx.beginPath(); legInk(ctx, A); legInk(ctx, B); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath(); legSkin(ctx, A); legSkin(ctx, B); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); legDark(ctx, A); legDark(ctx, B); ctx.fill()
  ctx.fillStyle = '#f3f3f0'; ctx.beginPath(); sockPath(ctx, A); sockPath(ctx, B); ctx.fill()
  ctx.fillStyle = '#f7f7f4'; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); shoePath(ctx, A); shoePath(ctx, B); ctx.fill(); ctx.stroke()
  ctx.fillStyle = trim; ctx.beginPath(); shoeTrim(ctx, A); shoeTrim(ctx, B); ctx.fill()
  ctx.fillStyle = '#14181c'; ctx.beginPath()
  ctx.rect(Math.min(A.ex - A.out * 3.3, A.ex + A.out * 5.5), A.ey + 4, 8.8, 1.2); ctx.rect(Math.min(B.ex - B.out * 3.3, B.ex + B.out * 5.5), B.ey + 4, 8.8, 1.2); ctx.fill()
  // the shorts: cut flat at the hem, close to the leg
  ctx.fillStyle = jersey; ctx.beginPath(); shortsPath(ctx, A); shortsPath(ctx, B); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke()
}
export function athleteFront(ctx, x, floorY, P, o = {}) {
  const { jersey = '#1b6fd1', trim = '#fff', skin = '#8d5a3b', s = 1.7, back = true, num = null, hair = '#15100c', ball = null, spin = 0 } = o
  const shade = shadeFor(skin)
  const hipX = P.hx, hipY = -(P.hy + P.j), lean = P.lean, sl = Math.sin(lean), cl = Math.cos(lean)
  const sx = hipX + sl * TORSO, sy = hipY - cl * TORSO
  const up = clamp(P.j / 60, 0, 1)
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath(); ctx.ellipse(x + hipX * s, floorY + 2, (24 - up * 10) * s, (5 - up * 2) * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.translate(x, floorY); ctx.scale(s, s)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const rx = sx + cl * 14.5, ry = sy + sl * 14.5 + 2, lx = sx - cl * 14.5, ly = sy - sl * 14.5 + 2
  const hRy = -(P.hFy + P.j), hLy = -(P.hBy + P.j)
  // from behind, the hands and the ball are beyond him: ball, arms, then the body
  if (back && ball) {
    ikOut(rx, ry, P.hFx, hRy, UARM, FARM, 1)
    const bx = IK.ex + ball.x, by = IK.ey - ball.y
    HANDS.bx = x + s * bx; HANDS.by = floorY + s * by
    if (ball.draw) ball.draw(ctx, bx, by, ball.r, spin)
  }
  solveArm(ARM_A, lx, ly, P.hBx, hLy, -1); solveArm(ARM_B, rx, ry, P.hFx, hRy, 1)
  HANDS.fx = x + s * ARM_B.ex; HANDS.fy = floorY + s * ARM_B.ey
  // a hand across his front comes over the jersey; any other arm hangs from under the armhole
  const overA = !back && Math.abs(ARM_A.ex - hipX) < 15.5 ? ARM_A : null, overB = !back && Math.abs(ARM_B.ex - hipX) < 15.5 ? ARM_B : null
  if (!overA || !overB) paintArms(ctx, overA ? null : ARM_A, overB ? null : ARM_B, skin, shade)
  solveLeg(LEG_A, hipX - cl * 7, hipY - sl * 7, P.fBx, -(P.fBy + P.j), -1)
  solveLeg(LEG_B, hipX + cl * 7, hipY + sl * 7, P.fFx, -(P.fFy + P.j), 1)
  paintLegs(ctx, LEG_A, LEG_B, skin, shade, jersey, trim)
  // the neck into the traps, the ears: one tone, under the jersey
  const hx = sx + sl * 13.5, hy = sy - cl * 13.5
  ctx.fillStyle = shade; ctx.beginPath()
  limb(ctx, sx, sy + 1, 6.6, hx, hy, 4.4)
  ctx.moveTo(hx - 6.5, hy + 0.8); ctx.arc(hx - 8.4, hy + 0.8, 1.9, 0, 6.3); ctx.moveTo(hx + 10.3, hy + 0.8); ctx.arc(hx + 8.4, hy + 0.8, 1.9, 0, 6.3)
  ctx.fill()
  // the jersey: a real armhole curve from the strap down to under the arm
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(lean)
  ctx.fillStyle = jersey; ctx.beginPath()
  ctx.moveTo(-8.6, -1.8); ctx.lineTo(8.6, -1.8); ctx.quadraticCurveTo(8.2, 6.6, 12.4, 11.6); ctx.lineTo(10.8, TORSO); ctx.lineTo(-10.8, TORSO); ctx.lineTo(-12.4, 11.6); ctx.quadraticCurveTo(-8.2, 6.6, -8.6, -1.8); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke()
  // the far side of it falling away, and a fold where it gathers at the waist, in one fill
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath()
  ctx.moveTo(8.6, -1.8); ctx.quadraticCurveTo(8.2, 6.6, 12.4, 11.6); ctx.lineTo(10.8, TORSO); ctx.lineTo(4.6, TORSO); ctx.quadraticCurveTo(7.2, 12, 5, -1.8); ctx.closePath()
  ctx.moveTo(-10.2, TORSO - 7.5); ctx.quadraticCurveTo(-6.4, TORSO - 5, -3.4, TORSO - 0.6); ctx.lineTo(-5, TORSO - 0.6); ctx.quadraticCurveTo(-7.4, TORSO - 4, -10.2, TORSO - 7.5); ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = trim; ctx.lineWidth = 1.9; ctx.beginPath()
  ctx.moveTo(-8.6, -1.8); ctx.quadraticCurveTo(-8.2, 6.6, -12.4, 11.6); ctx.moveTo(8.6, -1.8); ctx.quadraticCurveTo(8.2, 6.6, 12.4, 11.6)
  if (back) { ctx.moveTo(-5.4, -1.4); ctx.quadraticCurveTo(0, 1.8, 5.4, -1.4) } else { ctx.moveTo(-5.2, -1.4); ctx.quadraticCurveTo(0, 7, 5.2, -1.4) }
  ctx.stroke()
  if (num != null) text(ctx, String(num), 0, 18, { font: DISPLAY, size: String(num).length > 1 ? 18 : 20, color: inkOn(jersey, trim) })
  ctx.restore()
  // the seat of the shorts over the hem of the jersey, straight sides so there's no ball at the hips. Then the
  // shade, and every line of trim on them in one stroke
  const wx = cl * 11.4 + sl * 7, wy = sl * 11.4 - cl * 7, ax = cl * 14 - sl * 4, ay = sl * 14 + cl * 4
  ctx.fillStyle = jersey; ctx.beginPath()
  ctx.moveTo(hipX - cl * 11.4 + sl * 7, hipY - sl * 11.4 - cl * 7); ctx.lineTo(hipX + wx, hipY + wy); ctx.lineTo(hipX + ax, hipY + ay); ctx.lineTo(hipX - cl * 14 - sl * 4, hipY - sl * 14 + cl * 4); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); shortsDark(ctx, LEG_A); shortsDark(ctx, LEG_B); ctx.fill()
  ctx.strokeStyle = trim; ctx.lineWidth = 1.7; ctx.lineCap = 'butt'; ctx.beginPath(); shortsTrim(ctx, LEG_A); shortsTrim(ctx, LEG_B)
  ctx.moveTo(hipX - cl * 11.6 + sl * 7, hipY - sl * 11.6 - cl * 7); ctx.lineTo(hipX + cl * 11.6 + sl * 7, hipY + sl * 11.6 - cl * 7); ctx.stroke(); ctx.lineCap = 'round'
  // the head: a skull and a jaw, the far cheek in shade, hair with a hairline and the features in one fill
  const hr = 8.6
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath()
  ctx.arc(hx, hy - 0.6, hr, Math.PI, 0); ctx.quadraticCurveTo(hx + hr, hy + 6.6, hx + 2.8, hy + 8.8); ctx.lineTo(hx - 2.8, hy + 8.8); ctx.quadraticCurveTo(hx - hr, hy + 6.6, hx - hr, hy - 0.6); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = shade; ctx.beginPath()
  ctx.moveTo(hx + hr - 0.5, hy - 0.6); ctx.quadraticCurveTo(hx + hr - 1, hy + 6, hx + 2.8, hy + 8.2); ctx.quadraticCurveTo(hx + 5.6, hy + 4, hx + 5, hy - 2); ctx.closePath()
  ctx.fill()
  ctx.fillStyle = hair; ctx.beginPath()
  if (back) {
    // a tight cut, ending in a line above the nape
    ctx.arc(hx, hy - 0.6, hr + 0.3, 0.16, Math.PI - 0.16, true); ctx.lineTo(hx - 7.4, hy + 3.2); ctx.quadraticCurveTo(hx, hy + 6.2, hx + 7.4, hy + 3.2); ctx.closePath()
  } else {
    ctx.arc(hx, hy - 0.6, hr + 0.3, Math.PI + 0.08, -0.08); ctx.lineTo(hx + 7.2, hy - 2.6); ctx.lineTo(hx + 5.4, hy - 4.6); ctx.quadraticCurveTo(hx, hy - 5.6, hx - 5.4, hy - 4.6); ctx.lineTo(hx - 7.2, hy - 2.6); ctx.closePath()
    // brows, eyes, the line of the mouth
    ctx.rect(hx - 4.8, hy - 2.1, 3.2, 0.8); ctx.rect(hx + 1.6, hy - 2.1, 3.2, 0.8)
    ctx.moveTo(hx - 2.2, hy + 0.3); ctx.arc(hx - 3.3, hy + 0.3, 1.1, 0, 6.3); ctx.moveTo(hx + 4.4, hy + 0.3); ctx.arc(hx + 3.3, hy + 0.3, 1.1, 0, 6.3)
    ctx.rect(hx - 1.9, hy + 4.7, 3.8, 0.7)
  }
  ctx.fill()
  if (overA || overB) paintArms(ctx, overA, overB, skin, shade)
  ctx.restore()
}
// running, seen from either end
export function frontRun(ph, P) {
  const a = Math.sin(ph), b = Math.cos(ph)
  P.hx = 0; P.hy = 47 + Math.abs(b) * 1.5; P.lean = a * 0.05; P.j = 0
  P.fFx = 9; P.fFy = Math.max(0, b) * 15; P.fBx = -9; P.fBy = Math.max(0, -b) * 15; P.toeF = 0; P.toeB = 0
  P.hFx = 17; P.hFy = 46 - a * 7; P.hBx = -17; P.hBy = 46 + a * 7
  return P
}
export const IN_HANDS = { x: -3.4, y: 7.8, r: BALL_R * FIG_FT, draw: (ctx, x, y, r, spin) => basketball(ctx, x, y, { r, spin }) }

// ── Shot poses, from behind ─────────────────────────────────────────────────
const P_SET = pose({ hy: 45, lean: 0, fFx: 13, fBx: -13, hFx: 26, hFy: 62, hBx: 13, hBy: 62 })
const P_DIP = pose({ hy: 33, lean: 0, fFx: 15, fBx: -15, hFx: 22, hFy: 46, hBx: 10, hBy: 47 })
const P_GATHER = pose({ hy: 45, lean: 0, fFx: 11, fBx: -11, hFx: 21, hFy: 90, hBx: 9, hBy: 92 })
const P_POINT = pose({ hy: 49, lean: 0, fFx: 8, fBx: -8, fFy: 1, fBy: 2, hFx: 15, hFy: 106, hBx: 3, hBy: 108 })
const P_RELEASE = pose({ hy: 49, lean: 0, fFx: 8, fBx: -8, fFy: 1, fBy: 2, hFx: 13, hFy: 127, hBx: -6, hBy: 110 })
const P_LANDED = pose({ hy: 46, lean: 0, fFx: 12, fBx: -12, hFx: 14, hFy: 120, hBx: -9, hBy: 98 })
const P_DOWN = pose({ hy: 46, lean: 0, fFx: 11, fBx: -11, hFx: 21, hFy: 47, hBx: -21, hBy: 47 })
const P_DRIB = pose({ hy: 42, lean: 0.05, fFx: 13, fBx: -13, hFx: 24, hFy: 26, hBx: -18, hBy: 52 })
const P_GUARD = pose({ hy: 46, lean: 0, fFx: 13, fBx: -13, hFx: 18, hFy: 122, hBx: -18, hBy: 122 })
const SP = newPose(), SQ = newPose()
const JUMP = 42
const smooth01 = f => f * f * (3 - 2 * f)
const liftOf = p => JUMP * smooth01(prog(p, 0.12, 0.72))
// ...while the meter fills. p is the needle, so the body and the bar can't disagree
function holdPose(p, tau, out) {
  if (p < 0.2) mixPose(P_DIP, P_GATHER, smooth01(p / 0.2), out)
  else mixPose(P_GATHER, P_POINT, smooth01(prog(p, 0.2, 0.72)), out)
  void tau
  out.j = liftOf(p)
  // in the air: his toes hang, feet in under him
  const air = clamp(out.j / JUMP, 0, 1)
  out.fFx = lerp(out.fFx, 7, air); out.fBx = lerp(out.fBx, -7, air); out.fFy = air * 5; out.fBy = air * 8
  return out
}
function afterPose(m, g, out) {
  const age = g.t - m.relAt, j0 = liftOf(m.p)
  mixPose(P_POINT, P_RELEASE, smooth01(prog(age, 0, 230)), out)
  if (age > 260) mixPose(out, P_LANDED, smooth01(prog(age, 260, 620)), out)
  const f = age / 520
  out.j = f >= 1 ? 0 : j0 * (1 + f * 0.7 - 1.7 * f * f)
  // still in the air: toes hanging until he lands
  const air2 = clamp(out.j / JUMP, 0, 1)
  out.fFy = air2 * 5; out.fBy = air2 * 8
  if (m.landed && !m.res.in) mixPose(out, P_DOWN, smooth01(prog(g.t, m.landAt + 200, m.landAt + 760)), out)
  return out
}

// ── The meter ───────────────────────────────────────────────────────────────
// The rules step 120 times a second and a frame takes one, two or three of those steps, which would
// make the needle stutter on a curve this fast. So the picture keeps its own clock from the frame's
// timestamp, and only leans back to the rules' time if it has drifted past a step or so. The needle, the fill and the body all read
// this one number off the one curve.
export const CLK = { g: null, wall: 0, t: 0, dt: 16 }
const frameNow = () => (typeof document !== 'undefined' && document.timeline?.currentTime != null ? document.timeline.currentTime : typeof performance !== 'undefined' ? performance.now() : 0)
export function smoothT(g) {
  const now = frameNow(), dt = now - CLK.wall
  CLK.dt = dt > 0 ? dt : 16
  if (CLK.g !== g || dt > 120 || dt < 0) { CLK.g = g; CLK.t = g.t }
  else { CLK.t += dt; const e = g.t - CLK.t, off = Math.abs(e) - 12; if (off > 0) CLK.t += Math.sign(e) * off * 0.1 }
  CLK.wall = now
  return CLK.t
}
// where the needle is right now
function needleOf(g, m, T) {
  if (m.phase !== 'hold') return m.p
  const p = g.pOf(m, clamp(T - m.at, 0, m.fill))
  m.shown = p
  return p
}
function drawMeter(ctx, G, m, view, g, p) {
  const { U } = G, w = G.meterW, b = G.meterB, L = G.meterL, top = b - L
  // on the second free throw the whole bar shakes in his hands: the curve itself never changes
  const x = G.meterX + (m.wob && m.phase === 'hold' ? Math.sin(g.t / 34) * 2.2 + Math.sin(g.t / 53) * 1.4 : 0)
  ctx.fillStyle = 'rgba(6,10,12,.92)'; rr(ctx, x - 3, top - 3, w + 6, L + 6, 5); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x, top, w, L)
  if (!m.peak) { ctx.fillStyle = BAD; ctx.fillRect(x, top, w, 7 * U) }
  const held = m.phase === 'hold' || (m.phase === 'fly' && m.res.why !== 'clock')
  if (held) {
    ctx.fillStyle = m.res ? (m.res.in ? GOOD : '#d8d4c8') : '#efe9da'
    ctx.fillRect(x, b - p * L, w, p * L)
  }
  if (m.phase !== 'wait' || g.game === 'clutch-shot') {
    const y1 = b - m.hi * L, y0 = b - m.lo * L
    ctx.fillStyle = GOOD; ctx.fillRect(x - 3, y1, w + 6, y0 - y1)
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y0 - 1, w + 6, 2)
    if (!m.peak) ctx.fillRect(x - 3, y1 - 1, w + 6, 2)
  }
  // a meter that comes back down has its peak marked at the top
  if (m.peak) { ctx.fillStyle = GOLD; ctx.fillRect(x - 4, top - 3, w + 8, 4) }
  if (held) {
    const ny = b - p * L
    ctx.fillStyle = '#07100b'; ctx.fillRect(x - 6, ny - 3.5, w + 12, 7)
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, ny - 2.5, w + 10, 5)
  }
  if (m.res && m.res.why !== 'clock' && g.t - m.relAt < 760) {
    const word = m.res.in ? (m.peak ? (m.res.q > 0.86 ? 'PEAK' : 'GOOD') : 'GREEN') : m.res.off < 0 ? 'EARLY' : 'LATE'
    ctx.fillStyle = 'rgba(6,10,12,.86)'; ctx.fillRect(x - 6, top - 32 * U, 74 * U, 26 * U)
    text(ctx, word, x - 3, top - 18 * U, { font: DISPLAY, size: 22 * U, color: m.res.in ? GOOD : BAD, align: 'left' })
  }
}

// A power meter: a stack of blocks that heat up on the way to the top, one gold cap to hit. The band
// you need is green and never moves. Let go and a marker stays where you let go: on the left going up
// (early), on the right coming down (late), with the last reps left beside the bar.
const HEAT = ['#c9d2d8', '#d4d6c4', '#e0d9ae', '#ebdc92', '#f4dc74', '#f8d158', '#fbc145', '#fdae39', '#fe9a31', '#fe862d', '#fd722b', '#fb5f2b', '#f84d2c', '#f33e2e']
function drawPeakMeter(ctx, G, m, view, g, p) {
  const U = G.U, w = 26 * U, x = 20, b = G.meterB, L = G.meterL, top = b - L
  // the housing
  ctx.fillStyle = 'rgba(7,10,14,.95)'; rr(ctx, x - 5, top - 14 * U, w + 10, L + 19 * U, 6); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = 1.5; ctx.stroke()
  // the blocks: lit up to the needle, each one solid from its bottom edge
  const N = HEAT.length, gap = 2.5 * U, bh = (L - gap * (N - 1)) / N
  const live = m.phase === 'hold' || (m.phase === 'fly' && m.res.why !== 'clock')
  for (let i = 0; i < N; i++) {
    const f0 = (i * (bh + gap)) / L, f1 = (i * (bh + gap) + bh) / L, y = b - (i + 1) * bh - i * gap
    const band = f1 > m.lo
    ctx.fillStyle = band ? 'rgba(53,224,122,.26)' : 'rgba(255,255,255,.1)'
    ctx.fillRect(x, y, w, bh)
    if (live && p > f0) {
      const lit = Math.min(1, (p - f0) / (f1 - f0))
      ctx.fillStyle = band ? GOOD : HEAT[i]
      ctx.fillRect(x, y + bh * (1 - lit), w, bh * lit)
    }
  }
  // the peak: a gold cap, wider than the bar, with its name
  ctx.fillStyle = GOLD
  ctx.fillRect(x - 5, top - 14 * U, w + 10, 9 * U)
  text(ctx, 'PEAK', x + w / 2, top - 26 * U, { font: DISPLAY, size: 18 * U, color: GOLD })
  // earlier reps: small marks that stay beside the bar
  for (let i = 0; i < g.k; i++) {
    const q = g.reps[i]
    if (q.res) markOf(ctx, x, w, b - q.p * L, q.res.off < 0, 5 * U, q.res.in ? 'rgba(53,224,122,.8)' : 'rgba(255,255,255,.5)')
  }
  // the needle while it's running; where he let go, after
  if (m.phase === 'hold') {
    const ny = b - p * L
    ctx.fillStyle = '#07100b'; ctx.fillRect(x - 7, ny - 4, w + 14, 8)
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 6, ny - 2.5, w + 12, 5)
  } else if (m.res && m.res.why !== 'clock') {
    const ny = b - m.p * L, early = m.res.off < 0
    ctx.fillStyle = '#07100b'; ctx.fillRect(x - 3, ny - 3, w + 6, 6)
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, ny - 1.5, w + 4, 3)
    markOf(ctx, x, w, ny, early, 8 * U, m.res.in ? GOOD : BAD)
    if (g.t - m.relAt < 900) {
      const word = m.res.in ? (m.res.q > 0.86 ? 'PEAK' : 'GOOD') : early ? 'EARLY' : 'LATE'
      ctx.fillStyle = 'rgba(6,10,12,.86)'; ctx.fillRect(x + w + 16 * U, ny - 13 * U, 66 * U, 26 * U)
      text(ctx, word, x + w + 21 * U, ny, { font: DISPLAY, size: 21 * U, color: m.res.in ? GOOD : BAD, align: 'left' })
    }
  }
}
// a triangle pointing at the bar, from the side he let go on
function markOf(ctx, x, w, y, early, r, color) {
  const tip = early ? x - 6 : x + w + 6, d = early ? -1 : 1
  ctx.fillStyle = color; ctx.strokeStyle = '#07100b'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(tip, y); ctx.lineTo(tip + d * r * 1.5, y - r); ctx.lineTo(tip + d * r * 1.5, y + r); ctx.closePath(); ctx.fill(); ctx.stroke()
}

// a remembered string: a clock only changes ten times a second
let clockT = -1, clockS = ''
const clockStr = ms => { const t = Math.ceil(ms / 100); if (t !== clockT) { clockT = t; clockS = (t / 10).toFixed(1) } return clockS }

// ── The court scene ─────────────────────────────────────────────────────────
// Three cameras on the one court:
//   clutch-shot   wide, behind the shooter: the whole half-court set in frame
//   free-throws   high and square to the rim, centred on the lane
//   spot          tight over his shoulder, panning around the arc with him
const THREE_OUT = 24.2, FT_LINE = 14
const SPOTS = [-62, -24, 24, 62].map(d => (d * Math.PI) / 180)
const CAMS = {
  'clutch-shot': { ppf: 25, zs: 18, H: 15, px: 212, sx: 118, floor: 0.9, D: THREE_OUT },
  'free-throws': { ppf: 18.5, zs: 36, H: 22, px: 180, sx: 180, floor: 0.62, D: FT_LINE, meterX: 240, meterL: 196 },
  spot: { ppf: 33, zs: 24, H: 14, px: 214, sx: 112, floor: 0.88, D: THREE_OUT },
}
const courts = new Map()
function courtOf(view, game) {
  const id = `${game}|${view.h}`
  let G = courts.get(id)
  if (G) return G
  const C = CAMS[game], h = view.h, U = h / 640, ppf = C.ppf * U, floor = h * C.floor, F = ppf * C.zs, hz = floor - C.H * ppf
  G = { h, U, ppf, floor, H: C.H, F, px: C.px, sx: C.sx, zs: C.zs, D: C.D, xs: (C.sx - C.px) / ppf, s: ppf / FIG_FT,
    wallY: hz + (C.H * F) / (C.zs + C.D + 24),
    cam: { F, H: C.H, px: C.px, hz, cos: 1, sin: 0, cx: 0, cz: -48 },
    meterX: C.meterX ?? 13, meterW: 19, meterB: floor - 6 * U, meterL: (C.meterL ?? 262) * U }
  courts.set(id, G)
  return G
}
export function paintRoom(x, view, G, c, game) {
  paintBowl(x, view, { horizon: G.wallY, us: c.us, trim: c.trim, dim: game === 'free-throws' ? 0.42 : game === 'spot' ? 0.18 : 0, seed: game.length })
  const g = x.createLinearGradient(0, G.wallY, 0, view.h)
  g.addColorStop(0, '#a87543'); g.addColorStop(0.4, '#c8935a'); g.addColorStop(1, '#dbaa72')
  x.fillStyle = g; x.fillRect(0, G.wallY, view.w, view.h - G.wallY)
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, G.wallY, view.w, 2)
}

// The set on a late-game possession, in the court's feet: a shooter up top, a man in each corner, one
// on the wing, a big on the block, each with his defender goal-side. Painted once and stamped, so
// they cost a drawImage each. They watch the ball, and crash when it goes up.
const CLUTCH_SET = [
  { x: 9, z: -17.5, team: 'us', num: 11, man: 1, skin: 2, cut: 0.1 },
  { x: 7.4, z: -14, team: 'them', num: 5, man: 1, skin: 1, cut: 0.2 },
  { x: 14.5, z: -3, team: 'us', num: 23, man: 2, skin: 3, cut: 0.1 },
  { x: 12.4, z: -4.6, team: 'them', num: 14, man: 2, skin: 0, cut: 0.2 },
  { x: 5.6, z: -6.4, team: 'us', num: 34, man: 3, skin: 1, cut: 0.4 },
  { x: 3.6, z: -3.8, team: 'them', num: 50, man: 3, skin: 3, cut: 0.3 },
  { x: -10.8, z: -5.5, team: 'us', num: 8, man: 4, skin: 0, cut: 0.1 },
  { x: -8.9, z: -7, team: 'them', num: 2, man: 4, skin: 2, cut: 0.2 },
]
const P_OFFBALL = pose({ hy: 45, fFx: 12, fBx: -12, hFx: 17, hFy: 43, hBx: -17, hBy: 43 })
const P_DENY = pose({ hy: 40, fFx: 15, fBx: -15, hFx: 27, hFy: 82, hBx: -27, hBy: 82 })
const stamps = new Map()
function stampOf(ctx, view, key, s, paint) {
  const id = `${key}|${Math.round(s * 20)}|${view.px}`
  let c = stamps.get(id)
  const W = 110 * s, H = 152 * s
  if (!c && typeof document !== 'undefined') {
    if (stamps.size > 64) stamps.clear()
    c = document.createElement('canvas'); c.width = Math.ceil(W * view.px); c.height = Math.ceil(H * view.px)
    const x = c.getContext('2d')
    x.scale(view.px, view.px); x.translate(W / 2, H - 14 * s)
    paint(x)
    stamps.set(id, c)
  }
  return c
}
// (the names go on after everyone's down: x, y, name, scale)
const TAGS = []
function drawSetPlayer(ctx, view, cam, q, i, g, c, them, rel, M) {
  const crash = rel == null ? 0 : easeInOut(prog(g.t - rel, 160, 1100)) * q.cut
  const sway = Math.sin(g.t / 420 + i * 1.7) * 0.14
  project(cam, q.x * (1 - crash) + sway, 0, q.z * (1 - crash))
  const k = PT.k, sx = PT.x, sy = PT.y, s = k / FIG_FT
  const us = q.team === 'us'
  const col = us ? c.us : them.color, trim = us ? c.trim : them.trim
  const who = M ? (us ? M.us : M.them)[q.man] : null, num = who?.number ?? q.num, skin = who?.skin ?? SKINS[q.skin]
  const sp = stampOf(ctx, view, `${col}|${trim}|${num}|${skin}|${us}`, s, x => athleteFront(x, 0, 0, us ? P_OFFBALL : P_DENY, { jersey: col, trim, s, back: false, num, skin }))
  if (sp) ctx.drawImage(sp, sx - 55 * s, sy - (152 - 14) * s, 110 * s, 152 * s)
  // (a man half off the side of the picture keeps his name to himself)
  if (who && sx > 20 && sx < view.w - 20) TAGS.push(sx, sy, who.name, s)
}
// The free-throw line-up. Lane: defense on the blocks, offense next up, defense above; everyone side-on
// to us, looking across. Behind the shooter past the arc, two teammates with their backs to us.
const P_LANE = pose({ hy: 41, lean: 0.3, fFx: 12, fBx: -11, hFx: 22, hFy: 54, hBx: 18, hBy: 50 })
const LANE_NEAR = -10.2, BEHIND_X = 3.8, BEHIND_Z = -26.5
function paintLaneUp(x, cam, c, them, M) {
  // (men: each side's man from the real five)
  const row = [[-3.4, 'them', 0, [3, 4]], [-6.9, 'us', 2, [3, 4]], [LANE_NEAR, 'them', 1, [1, 2]]]
  // the far pairs first
  for (const [z, team, skin, men] of row) {
    for (const side of [-1, 1]) {
      project(cam, side * (LANE + 1.1), 0, z)
      const us = team === 'us', who = M ? (us ? M.us : M.them)[men[side > 0 ? 1 : 0]] : null
      athlete(x, PT.x, PT.y, P_LANE, { jersey: us ? c.us : them.color, trim: us ? c.trim : them.trim, s: PT.k / FIG_FT, flip: side > 0, skin: who?.skin ?? SKINS[(skin + (side > 0 ? 2 : 0)) % 4], num: who?.number ?? null })
    }
  }
}
function paintBehindLine(x, cam, c, M) {
  for (const [wx, num, skin, man] of [[-BEHIND_X, 8, 1, 1], [BEHIND_X, 23, 3, 2]]) {
    project(cam, wx, 0, BEHIND_Z)
    const who = M?.us[man]
    athleteFront(x, PT.x, PT.y, P_OFFBALL, { jersey: c.us, trim: c.trim, s: PT.k / FIG_FT, back: true, num: who?.number ?? num, skin: who?.skin ?? SKINS[skin] })
  }
}
// The names at the line: the two behind him and the nearest pair on the lane. The rest of the lane is
// shoulder to shoulder, with no floor to put one on. Not baked in: the vignette would dim them.
function lineTags(ctx, view, cam, M) {
  for (const side of [0, 1]) {
    const o = side ? 1 : -1
    project(cam, o * (LANE + 1.1), 0, LANE_NEAR); meterTag(ctx, view, PT.x, PT.y, M.them[1 + side].name, PT.k / FIG_FT)
    project(cam, o * BEHIND_X, 0, BEHIND_Z); meterTag(ctx, view, PT.x, PT.y, M.us[1 + side].name, PT.k / FIG_FT)
  }
}

const ORDER = []     // what's on the floor this frame, furthest first
const poseShot = easedState(), poseGuard = easedState()
function drawCourtScene(ctx, g, view) {
  const game = g.game, G = courtOf(view, game), { U, s, floor, sx, xs, cam, zs } = G
  const c = view.colors, them = themOf(view), m = g.rep
  // (the real men, in the games with a team on the floor: spot-up is a drill)
  const M = game === 'clutch-shot' || game === 'free-throws' ? castMen(g, view) : null
  const T = smoothT(g), p = needleOf(g, m, T), spot = game === 'spot', ft = game === 'free-throws', clutch = game === 'clutch-shot'
  // where the camera is
  let theta = clutch ? g.theta : 0
  if (spot) {
    const to = SPOTS[m.k], from = m.k > 0 ? SPOTS[m.k - 1] : to
    theta = lerp(from, to, m.waitAt != null ? easeInOut(prog(g.t, m.waitAt, m.readyAt - 120)) : 1)
  }
  aimCam(cam, theta, G.D, xs, zs)
  // a fixed view is painted once. Spot-up pans, so its floor is drawn every frame on a plain room
  layer(ctx, view, spot ? `mg-spot-${c.us}-${c.trim}-${c.them}` : `mg-${game}-${c.us}-${c.trim}-${c.them}-${c.themTrim}-${Math.round(theta * 100)}-${M?.key ?? ''}`, x => {
    paintRoom(x, view, G, c, game)
    if (spot) return
    paintLines(x, cam, c.us)
    paintHoop(x, cam, c.us)
    if (ft) { paintLaneUp(x, cam, c, them, M); paintBehindLine(x, cam, c, M) }
    if (clutch) {
      x.fillStyle = '#0c0f13'; rr(x, 284, 58 * U, 66, 44 * U, 4); x.fill()
      x.strokeStyle = '#3a4149'; x.lineWidth = 1.5; x.stroke()
    }
  })
  if (spot) {
    // the stands turn with the camera: they slide, wrapping round, and their foot runs along the floor's far edge,
    // the same angle the court's own lines are at from here, not level
    const slide = -cam.F * (cam.sin / cam.cos) * 0.6, dx = ((slide % view.w) + view.w) % view.w
    const WALL_Z = 24, SIDE_WALL = 34
    project(cam, -60, 0, WALL_Z); const ax = PT.x, ay = PT.y
    project(cam, 60, 0, WALL_Z); const bx = PT.x, by = PT.y
    const slope = (by - ay) / ((bx - ax) || 1), yAt = x => ay + (x - ax) * slope
    const yL = yAt(0), yR = yAt(view.w)
    const key = `mg-spot-${c.us}-${c.trim}-${c.them}`
    // the floor runs right up to that edge
    ctx.fillStyle = '#a87543'; ctx.fillRect(0, Math.min(yL, yR, G.wallY) - 1, view.w, Math.max(yL, yR, G.wallY) - Math.min(yL, yR, G.wallY) + 3)
    ctx.save()
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(view.w, 0); ctx.lineTo(view.w, yR); ctx.lineTo(0, yL); ctx.closePath(); ctx.clip()
    ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, 0, view.w, Math.max(yL, yR))
    for (const off of [dx - view.w, dx]) {
      ctx.save()
      // (a skew: straight up and down stays straight, the foot of the stands lands on the edge)
      ctx.transform(1, slope, 0, 1, off, yAt(0) - G.wallY + slope * off)
      layer(ctx, view, key, x => paintRoom(x, view, G, c, game))
      ctx.restore()
    }
    ctx.restore()
    // down each side: the floor runs out past the sideline to a wall, and the stands rise behind it, all the way toward us
    for (const sd of [-1, 1]) {
      project(cam, sd * SIDE_WALL, 0, WALL_Z); const x0 = PT.x, y0 = PT.y, k0 = PT.k
      let z = WALL_Z, x1 = x0, y1 = y0, k1 = k0
      for (let t = WALL_Z - 6; t > -90; t -= 6) { project(cam, sd * SIDE_WALL, 0, t); if (PT.z < 6) break; x1 = PT.x; y1 = PT.y; k1 = PT.k; z = t }
      void z
      if (x0 < 0 || x0 > view.w || (Math.abs(x1 - x0) < 2 && Math.abs(y1 - y0) < 2)) continue   // (only a corner that's in the picture)
      const out = x1 >= x0 ? 1 : -1, far = out > 0 ? view.w + 300 : -300
      ctx.fillStyle = '#a87543'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(far, y0 + (far - x0) * ((y1 - y0) / ((x1 - x0) || 1))); ctx.lineTo(far, yAt(far) + 4); ctx.lineTo(x0, yAt(x0) + 4); ctx.closePath(); ctx.fill()
      const hA = 1.7 * k0, hB = 1.7 * k1, dirX = x1 - x0, dirY = y1 - y0, len = Math.hypot(dirX, dirY) || 1, ex = x1 + (dirX / len) * 900, ey = y1 + (dirY / len) * 900
      // the stands, in the wedge beyond the wall's top
      ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0 - hA); ctx.lineTo(ex, ey - hB); ctx.lineTo(far, ey - hB); ctx.lineTo(far, -200); ctx.lineTo(x0, -200); ctx.closePath(); ctx.clip()
      layer(ctx, view, key, x => paintRoom(x, view, G, c, game))
      ctx.restore()
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.lineTo(ex, ey - hB); ctx.lineTo(x0, y0 - hA); ctx.closePath()
      ctx.fillStyle = c.us; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.fill()
      ctx.strokeStyle = '#0a0e12'; ctx.lineWidth = 1.4; ctx.stroke()
    }
    paintLines(ctx, cam, c.us)
    paintHoop(ctx, cam, c.us)
    // what's been done from each spot, on the floor where it happened
    for (let i = 0; i < SPOTS.length; i++) {
      const q = g.reps[i], a = SPOTS[i]
      project(cam, THREE_OUT * Math.sin(a), 0, -THREE_OUT * Math.cos(a))
      if (PT.z < 6) continue
      const done = i < g.k || (i === g.k && q.landed)
      ctx.fillStyle = done ? (q.res.in ? GOOD : BAD) : 'rgba(8,12,16,.55)'
      ctx.beginPath(); ctx.ellipse(PT.x, PT.y, 1.5 * PT.k, 0.55 * PT.k, 0, 0, Math.PI * 2); ctx.fill()
      if (!done) { ctx.strokeStyle = i === g.k ? GOLD : '#fff'; ctx.lineWidth = i === g.k ? 2.6 : 1.6; ctx.stroke() }
    }
  }
  // the rim jumps when it's hit, the net whips when it goes through
  let dy = 0, netAge = null
  const last = g.reps[g.k > 0 && !m.res ? g.k - 1 : g.k]
  if (last.res && last.kind) {
    const a = g.t - last.landAt
    if ((last.kind === 'front' || last.kind === 'back' || last.kind === 'rattle') && a >= 0 && a < 520) dy = Math.sin(a / 26) * Math.exp(-a / 130) * 3 * U
    if (last.kind === 'swish') netAge = a
    if (last.kind === 'rattle') netAge = a - 240
  }
  // his pose: wherever the moment says the body should be, eased there, so nothing ever snaps
  const P = SP
  let carry = false
  if (m.phase === 'hold') { holdPose(p, T - m.at, P); carry = true }
  else if (m.phase === 'fly') afterPose(m, g, P)
  else {
    const f = m.waitAt != null ? prog(g.t, m.waitAt, m.waitAt + 240) : 1
    if (ft) {
      copyPose(P_DRIB, SQ)
      const w = Math.abs(Math.sin(g.t / 300))
      SQ.hFy = 18 + w * 10; SQ.hy = 40 + w * 1.2
      mixPose(P_LANDED, SQ, f, P)
    } else if (spot && m.waitAt != null && g.t < m.readyAt - 120) frontRun(g.t / 62, P)
    else {
      copyPose(P_SET, SQ)
      SQ.hy += Math.sin(g.t / 300) * 0.8
      if (g.k > 0) mixPose(P_LANDED, SQ, f, P); else copyPose(SQ, P)
    }
    carry = clutch ? g.t >= CATCH : ft ? false : (m.waitAt == null ? true : g.t >= m.readyAt - 20)
  }
  // a free throw never leaves the floor: a dip, and up onto the toes
  if (ft) { P.j = 0; P.fFy = 0; P.fBy = 0; P.hy = Math.min(P.hy, 48.5) }
  const shown = easedPose(poseShot, P, g, CLK.dt, 34)

  // everything on the floor, far to near, so the ball goes behind whoever it's past
  ORDER.length = 0
  project(cam, 0, RIM_Y, 0)
  const zr = PT.z
  ORDER.push({ z: zr + RIM_R, k: 'rimBack' }, { z: zr - RIM_R, k: 'rimFront' }, { z: zs, k: 'shooter' })
  const rel = clutch && m.res && m.relAt != null ? m.relAt : null
  if (clutch) {
    for (let i = 0; i < CLUTCH_SET.length; i++) { const q = CLUTCH_SET[i]; project(cam, q.x, 0, q.z); ORDER.push({ z: PT.z, k: 'set', q, i }) }
    const f = prog(g.t, 0, CATCH + 1050), dist = lerp(15, 4, f * (2 - f) * 0.5 + f * 0.5)
    ORDER.push({ z: zs + dist, k: 'guard', f, dist })
  }
  for (let i = Math.max(0, g.k - 1); i <= g.k; i++) {
    const q = g.reps[i]
    if (!q.res || !q.kind) continue
    if (i < g.k && g.t > g.reps[g.k].readyAt - 300) continue
    if (!q.path) {
      // the ball leaves from where it was in his hands
      const z = zs + 0.8, k = cam.F / z, X = (HANDS.bx - cam.px) / k, Y = cam.H - (HANDS.by - cam.hz) / k
      q.path = shotPath(q, cam.cx + X * cam.cos + z * cam.sin, Y, cam.cz - X * cam.sin + z * cam.cos)
    }
    const a = g.t - q.relAt, b = ballAt(q.path, a)
    const bx = b.x, by = b.y, bz = b.z
    project(cam, bx, by, bz)
    ORDER.push({ z: PT.z, k: 'ball', bx, by, bz, a })
  }
  ORDER.sort((a, b) => b.z - a.z)
  TAGS.length = 0
  for (let i = 0; i < ORDER.length; i++) {
    const o = ORDER[i]
    if (o.k === 'rimBack') rimHalf(ctx, cam, false, dy)
    else if (o.k === 'rimFront') { netOf(ctx, cam, netAge, dy); rimHalf(ctx, cam, true, dy) }
    else if (o.k === 'ball') ballIn(ctx, cam, o.bx, o.by, o.bz, o.a / 90)
    else if (o.k === 'set') drawSetPlayer(ctx, view, cam, o.q, o.i, g, c, them, rel, M)
    else if (o.k === 'shooter') {
      // the pass in comes from a teammate up the floor, in front of him, and grows as it gets to his hands
      const passF = clutch && g.t < CATCH ? prog(g.t, 0, CATCH) : spot && m.phase === 'wait' && !carry && m.waitAt != null ? prog(g.t, m.readyAt - 300, m.readyAt - 20) : 0
      if (passF > 0) {
        // (Clutch: from the man at the elbow, chest high. Spot-up: from up the floor)
        let ax = sx + 170 * U, ay = floor - 150 * U, ar = 0.55
        if (clutch) { const q = CLUTCH_SET[0]; project(cam, q.x, 0, q.z); ax = PT.x; ay = PT.y - 4.4 * PT.k; ar = PT.k / G.ppf }
        basketball(ctx, lerp(ax, sx + 22 * s, passF), lerp(ay, floor - 70 * s, passF) - Math.sin(passF * Math.PI) * 14 * U, { r: BALL_R * G.ppf * lerp(ar, 1, passF), spin: g.t / 80 })
      }
      athleteFront(ctx, sx, floor, shown, { jersey: spot ? '#1d57a8' : c.us, trim: spot ? '#ffffff' : c.trim, s, back: true, num: M?.us[0].number ?? 3, skin: M?.us[0].skin ?? SKINS[0], ball: carry ? IN_HANDS : null, spin: 0 })
      if (M) TAGS.push(sx, floor, M.us[0].name, s)
    }
    else if (o.k === 'guard') {
      // the man on him, closing out from the paint
      const Z = zs + o.dist, k = cam.F / Z, Q = SQ
      const dx = cam.px + (lerp(xs, 0, o.dist / G.D) + 2.9) * k, fy = cam.hz + cam.H * k
      if (o.f < 1) { frontRun(g.t / 58, Q); Q.hFx = 24; Q.hFy = 74 + o.f * 44; Q.hBx = -24; Q.hBy = 74 + o.f * 44 }
      else {
        copyPose(P_GUARD, Q)
        Q.j = m.phase === 'hold' ? 15 * prog(p, 0.3, 0.9) : m.phase === 'fly' ? Math.max(0, 15 * (1 - (g.t - m.relAt) / 340)) : 0
        if (m.phase === 'ready') Q.hy = 43 + Math.sin(g.t / 90) * 1.6
      }
      athleteFront(ctx, dx, fy, easedPose(poseGuard, Q, g, CLK.dt, 45), { jersey: them.color, trim: them.trim, s: k / FIG_FT, back: false, num: M?.them[0].number ?? 21, skin: M?.them[0].skin ?? SKINS[3] })
      if (M) TAGS.push(dx, fy, M.them[0].name, k / FIG_FT)
    }
  }
  // the pass in, and the dribble at the line
  if (ft && (m.phase === 'ready' || m.phase === 'wait')) {
    const w = Math.abs(Math.sin(g.t / 300))
    basketball(ctx, sx + 24 * s, floor - lerp(BALL_R * G.ppf, (shown.hFy - 7) * s, w), { r: BALL_R * G.ppf, spin: g.t / 200 })
  }
  vignette(ctx, view)
  for (let i = 0; i < TAGS.length; i += 4) meterTag(ctx, view, TAGS[i], TAGS[i + 1], TAGS[i + 2], TAGS[i + 3])
  if (ft && M) lineTags(ctx, view, cam, M)
  if (clutch) {
    const low = g.clock < 1000
    text(ctx, clockStr(g.clock), 317, 81 * U, { font: DISPLAY, size: (low ? 36 : 31) * U, color: low ? '#ff3b2f' : '#ffb21e' })
    if (g.done?.hit && g.t > m.landAt) {
      const R = dice(Math.floor(g.t / 70))
      ctx.fillStyle = '#fff'
      for (let i = 0; i < 12; i++) { const y = lerp(60 * U, G.wallY - 30 * U, R()), x = R() * view.w, d = 1.6 + R() * 2.2; ctx.fillRect(x, y, d, d) }
    }
  } else {
    const q = last
    project(cam, 0, RIM_Y, 0)
    const wx = clamp(PT.x, 120, 280), wy = PT.y - 62 * U
    if (q.res && q.landed && q.res.why !== 'clock') {
      const a = g.t - q.landAt
      if (a < 560 && !(g.done && q === m)) text(ctx, q.res.in ? (q.kind === 'swish' ? 'SWISH' : 'GOOD') : q.kind === 'air' ? 'AIRBALL' : 'BRICK', wx, wy, { font: DISPLAY, size: 28 * U, color: q.res.in ? GOOD : BAD })
    }
    if (q.res?.why === 'clock' && g.t - q.relAt < 700) text(ctx, 'TOO SLOW', wx, wy, { font: DISPLAY, size: 28 * U, color: BAD })
  }
  drawMeter(ctx, G, m, view, g, p)
}

// ── Velocity: a QB, a net, a radar ──────────────────────────────────────────
// The throw, from the side. Set: ball at the shoulder in both hands, feet under him. Coil: weight back, front foot
// light, ball behind the ear, front arm at the net. Over: the step lands, the elbow leads, the hand comes high.
// Throw: arm through at full reach, the back heel coming up. Follow: the hand finishes down by the far hip.
const Q_SET = pose({ hy: 49, lean: 0.03, fFx: 13, fBx: -13, hFx: 14, hFy: 72, hBx: 19, hBy: 70 })
const Q_COIL = pose({ hx: -6, hy: 47, lean: -0.13, fFx: 20, fFy: 3, fBx: -15, hFx: -25, hFy: 90, hBx: 24, hBy: 86, toeF: 0.25 })
const Q_OVER = pose({ hx: 4, hy: 46, lean: 0.12, fFx: 32, fBx: -19, hFx: 10, hFy: 112, hBx: 12, hBy: 72 })
const Q_THROW = pose({ hx: 12, hy: 43, lean: 0.3, fFx: 38, fBx: -18, fBy: 2, hFx: 55, hFy: 98, hBx: 2, hBy: 62, toeB: 0.5 })
const Q_FOLLOW = pose({ hx: 16, hy: 42, lean: 0.5, fFx: 38, fBx: -6, fBy: 6, hFx: 46, hFy: 46, hBx: 2, hBy: 54, toeB: 0.8 })
let veloG = null
function veloOf(view) {
  if (veloG && veloG.h === view.h) return veloG
  const h = view.h, U = h / 640, floor = h * 0.8
  veloG = { h, U, s: 1.5 * U, floor, horizon: floor - 46 * U, vy: floor - 200 * U, qx: 106, netX: 276, netW: 72, netT: floor - 214 * U, netB: floor - 28 * U, meterX: 13, meterW: 19, meterB: floor - 6 * U, meterL: 262 * U }
  return veloG
}
// the same room as the 40 and the bench, with a net in it
function paintFieldhouse(x, view, G) {
  const U = G.U, { netX: nx, netW: nw, netT: nt, netB: nb, floor } = G
  combineRoom(x, view, Math.round(G.horizon), floor, false)
  standAt(x, 206, G.horizon + 7, { ...SCOUT, skin: FOLK_SKIN[1], size: 1.62 })
  standAt(x, 246, G.horizon + 7, { ...SCOUT, skin: FOLK_SKIN[2], size: 1.62 })
  // the target net: a frame on legs, a grid, a square to hit
  x.strokeStyle = 'rgba(255,255,255,.34)'; x.lineWidth = 1
  x.beginPath()
  for (let px = nx; px <= nx + nw; px += 9) { x.moveTo(px, nt); x.lineTo(px, nb) }
  for (let py = nt; py <= nb; py += 9) { x.moveTo(nx, py); x.lineTo(nx + nw, py) }
  x.stroke()
  x.lineCap = 'round'
  for (const [col, wd] of [[INK, 5.4 * U], ['#d7dde2', 3.4 * U]]) {
    x.strokeStyle = col; x.lineWidth = wd
    x.strokeRect(nx, nt, nw, nb - nt)
    x.beginPath(); x.moveTo(nx + 6, nb); x.lineTo(nx - 8, floor + 8 * U); x.moveTo(nx + nw - 6, nb); x.lineTo(nx + nw + 6, floor + 8 * U); x.stroke()
  }
  x.strokeStyle = '#ffd24a'; x.lineWidth = 3 * U; const my = (nt + nb) / 2
  x.strokeRect(nx + nw / 2 - 18, my - 22 * U, 36, 44 * U)
}
// The QB in his shirt and shorts: the same long limbs and two flat tones as every other man, about seven heads tall.
const T_TORSO = 34
function throwerLeg(ctx, hx, hy, fx, fy, far, c, toe) {
  const skin = far ? c.skinD : c.skin, dark = far ? '#5a3723' : c.skinD
  ik(hx, hy, fx, fy - 4.6, THIGH, SHIN, -1)
  const jx = IK.jx, jy = IK.jy, ex = IK.ex, ey = IK.ey
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, hx, hy, 8, jx, jy, 6.1, 1, 1); limb(ctx, jx, jy, 6.1, ex, ey, 4.1, 1.9, 0.2); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath(); limb(ctx, hx, hy, 7, jx, jy, 5.1, 1, 1); limb(ctx, jx, jy, 5.1, ex, ey, 3.1, 1.9, 0.2); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); limbShade(ctx, jx, jy, 5.1, ex, ey, 3.1, 1.9, 0.2); limbShade(ctx, hx, hy, 7, jx, jy, 5.1, 1, 1); ctx.fill()
  // a low white sock
  const sl = Math.hypot(ex - jx, ey - jy) || 1, nx = -(ey - jy) / sl, ny = (ex - jx) / sl, sa = lerp(jx, ex, 0.68), sb = lerp(jy, ey, 0.68)
  ctx.fillStyle = far ? c.sockD : c.sock; ctx.beginPath(); ctx.moveTo(sa + nx * 3.7, sb + ny * 3.7); ctx.lineTo(ex + nx * 3.1, ey + ny * 3.1); ctx.lineTo(ex - nx * 3.1, ey - ny * 3.1); ctx.lineTo(sa - nx * 3.7, sb - ny * 3.7); ctx.closePath(); ctx.fill()
  // the shoe, pivoting on the ball of the foot: heel, collar, toe, a white sole
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(-toe * 0.6)
  ctx.fillStyle = far ? c.shoeD : c.shoe; ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath()
  ctx.moveTo(-4.4, 3.8); ctx.lineTo(-4.6, -1); ctx.quadraticCurveTo(-1, -3, 3, -1.2); ctx.quadraticCurveTo(8.6, 0, 11, 2.2); ctx.quadraticCurveTo(11.8, 3.6, 10.6, 3.8); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = c.sole; ctx.fillRect(-4.4, 3.4, 15.2, 1.3)
  ctx.restore()
  // the shorts to the middle of the thigh, a flat hem, a line down the side
  const mx = lerp(hx, jx, 0.62), my = lerp(hy, jy, 0.62), tl = Math.hypot(jx - hx, jy - hy) || 1, tx = (jx - hx) / tl, ty = (jy - hy) / tl
  ctx.fillStyle = far ? c.shortsD : c.shorts; ctx.beginPath(); limb(ctx, hx, hy, 8, mx, my, 7.2, 0.6, 0.6, true); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke()
  if (!far) { ctx.strokeStyle = c.topD; ctx.lineWidth = 1.5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx - tx * 1.2, my - ty * 1.2); ctx.stroke(); ctx.lineCap = 'round' }
}
function throwerArm(ctx, sx, sy, tx, ty, far, c) {
  armIK(sx, sy, tx, ty, UARM, FARM, -0.62, 0.78)
  const jx = IK.jx, jy = IK.jy, ex = IK.ex, ey = IK.ey, fl = Math.hypot(ex - jx, ey - jy) || 1, ux = (ex - jx) / fl, uy = (ey - jy) / fl
  const skin = far ? c.skinD : c.skin, dark = far ? '#5a3723' : c.skinD, hx = ex + ux * 4.4, hy = ey + uy * 4.4
  // (the thumb on the side away from the fingers' curl, a nub)
  const bx = ex + ux * 1.2 - uy * 2.4, by = ey + uy * 1.2 + ux * 2.4
  ctx.fillStyle = INK; ctx.beginPath()
  limb(ctx, sx, sy, 6.5, jx, jy, 4.9, 0.8, 0.8); limb(ctx, jx, jy, 4.9, ex, ey, 3.2, 1.5, 1.5); limb(ctx, ex + ux, ey + uy, 3.9, hx, hy, 3.3); limb(ctx, bx, by, 2, bx + ux * 2.2, by + uy * 2.2, 1.8); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath()
  limb(ctx, jx, jy, 3.9, ex, ey, 2.2, 1.5, 1.5); limb(ctx, ex + ux, ey + uy, 2.9, hx, hy, 2.3); limb(ctx, bx, by, 1.05, bx + ux * 2.2, by + uy * 2.2, 0.85); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); limbShade(ctx, jx, jy, 3.9, ex, ey, 2.2, 1.5, 1.5); ctx.fill()
  // the upper arm: skin below a short sleeve cut flat, one band on the hem
  const mx = lerp(sx, jx, 0.56), my = lerp(sy, jy, 0.56), tl = Math.hypot(jx - sx, jy - sy) || 1, nx = -(jy - sy) / tl, ny = (jx - sx) / tl
  ctx.fillStyle = skin; ctx.beginPath(); limb(ctx, sx, sy, 5.5, jx, jy, 3.9, 0.8, 0.8); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); limbShade(ctx, sx, sy, 5.5, jx, jy, 3.9, 0.8, 0.8); ctx.fill()
  ctx.fillStyle = far ? c.topD : c.top; ctx.beginPath(); limb(ctx, sx, sy, 6.2, mx, my, 5.3, 0.6, 0.6, true); ctx.fill()
  ctx.fillStyle = far ? 'rgba(0,0,0,.1)' : c.topD; ctx.beginPath(); limbShade(ctx, sx, sy, 6.2, mx, my, 5.3, 0.6, 0.6); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(mx - nx * 5.5, my - ny * 5.5); ctx.lineTo(mx + nx * 5.5, my + ny * 5.5); ctx.stroke(); ctx.lineCap = 'round'
}
function plainThrower(ctx, x, floorY, P, s, holding) {
  const c = GEAR
  ctx.fillStyle = 'rgba(0,18,6,.34)'
  ctx.beginPath(); ctx.ellipse(x + P.hx * s, floorY + 1.5 * s, 34 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.save(); ctx.translate(x, floorY); ctx.scale(s, s)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const hipX = P.hx, hipY = -P.hy, sl = Math.sin(P.lean), cl = Math.cos(P.lean)
  const sx = hipX + sl * T_TORSO, sy = hipY - cl * T_TORSO, ay = sy + 3
  throwerArm(ctx, sx + 2, ay, P.hBx, -P.hBy, true, c)
  throwerLeg(ctx, hipX - 1, hipY, P.fBx, -P.fBy, true, c, P.toeB)
  throwerLeg(ctx, hipX + 1, hipY, P.fFx, -P.fFy, false, c, P.toeF)
  // the seat of the shorts
  ctx.fillStyle = c.shorts; ctx.beginPath(); limb(ctx, hipX - 0.6, hipY - 2, 8.6, hipX, hipY + 3, 8); ctx.fill()
  // the neck, then the shirt over it: a flat back, the chest ahead of him, a band at the collar
  const hx = sx + sl * 13 + 1.4, hy = sy - cl * 13.5
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, sx, sy + 1, 5.6, hx - 0.6, hy, 5); ctx.fill()
  ctx.fillStyle = c.skinD; ctx.beginPath(); limb(ctx, sx, sy + 1, 4.6, hx - 0.6, hy, 4.1); ctx.fill()
  ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(P.lean)
  const T = -T_TORSO
  ctx.fillStyle = c.top; ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath()
  ctx.moveTo(-8.8, 2); ctx.quadraticCurveTo(-11.6, T * 0.5, -10.2, T + 6); ctx.quadraticCurveTo(-9.4, T - 2.6, -1, T - 2.6); ctx.quadraticCurveTo(8.8, T - 2.2, 10.2, T + 7); ctx.quadraticCurveTo(10.8, T * 0.42, 8.8, 2); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = c.topD; ctx.beginPath()
  ctx.moveTo(-8.8, 2); ctx.quadraticCurveTo(-11.6, T * 0.5, -10.2, T + 6); ctx.quadraticCurveTo(-9.8, T - 1.4, -6.8, T - 2.2); ctx.quadraticCurveTo(-3.6, T * 0.5, -3.8, 2); ctx.closePath()
  // a fold or two where it gathers
  ctx.moveTo(8.8, -6); ctx.quadraticCurveTo(4, -8.6, 0.6, -5.8); ctx.quadraticCurveTo(4, -7, 8.6, -4.6); ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = c.trim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4.6, T - 2.2); ctx.quadraticCurveTo(0.6, T + 0.8, 5.4, T - 1.6); ctx.stroke()
  ctx.restore()
  ctx.fillStyle = INK; ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(P.lean); ctx.fillRect(-9.2, -0.2, 18.4, 1.1); ctx.restore()
  sideHead(ctx, hx, hy, HEAD_R, c.skin, c.hair, P.lean * 0.3)
  // the ball sits in the throwing hand, which is the near one, over the far hand when both are on it
  armIK(sx - 1, ay, P.hFx, -P.hFy, UARM, FARM, -0.62, 0.78)
  const ex = IK.ex, ey = IK.ey, jl = Math.hypot(ex - IK.jx, ey - IK.jy) || 1, ux = (ex - IK.jx) / jl, uy = (ey - IK.jy) / jl
  if (holding) footballSide(ctx, ex + ux * 6.5, ey + uy * 6.5, Math.atan2(uy, ux) + 1.2, 0.86)
  throwerArm(ctx, sx - 1, ay, P.hFx, -P.hFy, false, c)
  ctx.restore()
}
const Q_MID = pose({ hx: -3, hy: 48, lean: -0.05, fFx: 15, fBx: -14, hFx: -8, hFy: 80, hBx: 22, hBy: 80 })
const QP = newPose(), poseQB = easedState()
function footballSide(ctx, x, y, ang, k) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k)
  ctx.fillStyle = '#7d4522'; ctx.beginPath(); ctx.ellipse(0, 0, 9.4, 5.6, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.7; ctx.stroke()
  ctx.fillStyle = '#f4efe6'; ctx.fillRect(-3.8, -1.2, 7.6, 1); ctx.fillRect(-2.2, -2, 0.8, 2.6); ctx.fillRect(1.4, -2, 0.8, 2.6)
  ctx.fillRect(-7.6, -2.4, 0.9, 4.8); ctx.fillRect(6.7, -2.4, 0.9, 4.8)
  ctx.restore()
}
// the last rep with a reading on the board
function latestOf(g, key) {
  for (let i = g.k; i >= 0; i--) { const q = g.reps[i]; if (q.landed && q[key] != null) return q }
  return null
}
function drawVelo(ctx, g, view) {
  const G = veloOf(view), { U, s, floor, qx, netX, netW, netT, netB } = G
  const m = g.rep
  layer(ctx, view, 'mg-velo', x => paintFieldhouse(x, view, G))
  const P = QP, needle = needleOf(g, m, smoothT(g))
  if (m.phase === 'hold') {
    // the ball comes back at the shoulder, under the chin, then up behind his ear: never across his face
    const f = easeOut(prog(needle, 0, 0.85))
    if (f < 0.5) mixPose(Q_SET, Q_MID, f * 2, P); else mixPose(Q_MID, Q_COIL, (f - 0.5) * 2, P)
  }
  else if (m.phase === 'fly') {
    const a = g.t - m.relAt
    // (the hand has to come over the top, so through a point up above him on the way)
    if (a < 50) mixPose(Q_COIL, Q_OVER, easeIn(a / 50), P)
    else if (a < 95) mixPose(Q_OVER, Q_THROW, (a - 50) / 45, P)
    else mixPose(Q_THROW, Q_FOLLOW, prog(a, 95, 300), P)
    if (m.res.why === 'clock') copyPose(Q_SET, P)
  } else if (g.k > 0 && m.waitAt != null) mixPose(Q_FOLLOW, Q_SET, easeInOut(prog(g.t, m.waitAt, m.waitAt + 280)), P)
  else { copyPose(Q_SET, P); P.hy += Math.sin(g.t / 320) * 0.5 }
  const holding = m.phase !== 'fly'
  plainThrower(ctx, qx, floor, easedPose(poseQB, P, g, CLK.dt, 16), s * 0.88, holding)
  // the balls
  const mid = (netT + netB) / 2
  for (let i = Math.max(0, g.k - 1); i <= g.k; i++) {
    const q = g.reps[i]
    if (!q.res || !q.kind) continue
    const a = g.t - q.relAt - 40
    if (a < 0) { continue }
    if (q.sx == null) { q.sx = qx + 50 * s; q.sy = floor - 92 * s }
    const f = clamp(a / (q.flyMs - 40), 0, 1)
    const low = (1 - q.res.q) * 90 * U * (q.k % 2 ? -0.5 : 1)   // a bad one sails off the square
    const tx = netX + netW * 0.62, ty = mid + low
    if (f < 1) footballSide(ctx, lerp(q.sx, tx, f), lerp(q.sy, ty, f) - Math.sin(f * Math.PI) * 10 * U, 0.08, s * 1.15)
    else {
      const b = g.t - q.landAt
      // into the net, then down it
      const drop = easeIn(clamp((b - 170) / 420, 0, 1)) * (floor - ty - 8 * U)
      if (i === g.k || b < 650) footballSide(ctx, tx + Math.min(14, b * 0.1) - Math.max(0, b - 170) * 0.01, ty + drop, 0.08 + Math.max(0, b - 170) / 180, s * 1.15)
      // the net kicks back where it hit
      if (b < 300) {
        const k = Math.exp(-b / 90) * 15
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; ctx.beginPath()
        for (let j = -2; j <= 2; j++) {
          const yy = ty + j * 9; ctx.moveTo(tx - 22, yy); ctx.quadraticCurveTo(tx + k, yy + j * 1.5, tx + 22, yy)
          const xx = tx + j * 9; ctx.moveTo(xx, ty - 22); ctx.quadraticCurveTo(xx + k * (1 - Math.abs(j) / 3), ty, xx, ty + 22)
        }
        ctx.stroke()
      }
    }
  }
  // the radar on the slab every timed drill has, the three throws beside it
  const lastM = latestOf(g, 'mph')
  const live = m.phase === 'hold' || (m.phase === 'fly' && !m.landed)
  clockSlab(ctx, view, '', '#fff')
  text(ctx, lastM ? String(lastM.mph) : '--', 180, 69, { font: DISPLAY, size: 46, color: g.done ? (g.done.hit ? GOOD : BAD) : live ? 'rgba(255,255,255,.5)' : '#fff' })
  text(ctx, 'MPH', 348, 69, { font: LABEL, size: 17, align: 'right', color: 'rgba(255,255,255,.72)' })
  for (let i = 0; i < g.reps.length; i++) {
    const q = g.reps[i]
    const v = q.landed && q.mph != null ? String(q.mph) : '–'
    text(ctx, v, 24 + i * 30, 69, { font: DISPLAY, size: 20, color: q.landed ? (q.mph === g.best ? GOLD : q.res.in ? '#fff' : 'rgba(255,255,255,.55)') : 'rgba(255,255,255,.3)' })
  }
  if (g.stamp) g.stamp.y = view.h * 0.885
  drawPeakMeter(ctx, G, m, view, g, needle)
}

// ── The vertical: a Vertec, a row of vanes ──────────────────────────────────
const V_STAND = pose({ hy: 46, lean: 0.03, fFx: 9, fBx: -9, hFx: 10, hFy: 45, hBx: -6, hBy: 45 })
const V_LOAD = pose({ hx: -5, hy: 25, lean: 0.62, fFx: 12, fBx: -9, hFx: -26, hFy: 42, hBx: -30, hBy: 40 })
const V_RISE = pose({ hx: 2, hy: 48, lean: 0.06, fFx: 4, fFy: 0, fBx: -6, fBy: 3, hFx: 22, hFy: 122, hBx: 4, hBy: 62, toeF: 0.7, toeB: 0.8 })
const V_LAND = pose({ hx: 0, hy: 34, lean: 0.36, fFx: 12, fBx: -11, hFx: 22, hFy: 42, hBx: 10, hBy: 40 })
const VP = newPose(), poseV = easedState()
let vertG = null
const VANE_LO = 18, VANE_HI = 48
function vertOf(view) {
  if (vertG && vertG.h === view.h) return vertG
  const h = view.h, U = h / 640, floor = h * 0.84, s = 1.62 * U
  const reach = 121 * s, ppi = (floor - reach - 74 * U) / 49    // the top vane is under the HUD
  const pole = 286, vaneL = 54
  vertG = { h, U, s, floor, horizon: floor - 70 * U, vy: floor - 240 * U, ax: pole - vaneL * 0.5 - 21.5 * s, pole, reach, ppi, vaneL, meterX: 13, meterW: 19, meterB: floor - 6 * U, meterL: 262 * U }
  return vertG
}
function paintGym(x, view, G, c) {
  const U = G.U
  paintRoom(x, view, { wallY: G.horizon }, c, 'board')
  // the pole on its base, with the scale up it
  const { pole, floor, reach, ppi } = G
  x.fillStyle = '#23292f'; rr(x, pole - 34, floor - 8 * U, 62, 15 * U, 3); x.fill()
  x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(pole - 3, floor + 8 * U, 38, 4 * U, 0, 0, Math.PI * 2); x.fill()
  const top = floor - reach - VANE_HI * ppi - 8 * U
  x.fillStyle = '#c5ccd2'; x.fillRect(pole, top, 7 * U, floor - top)
  x.fillStyle = '#8a9299'; x.fillRect(pole + 4.4 * U, top, 2.6 * U, floor - top)
  for (let i = 20; i <= VANE_HI; i += 5) {
    const y = floor - reach - i * ppi
    text(x, String(i), pole - G.vaneL - 5, y, { font: LABEL, size: 13 * U, color: 'rgba(255,255,255,.7)', align: 'right' })
  }
}
function drawVert(ctx, g, view) {
  const G = vertOf(view), { U, s, floor, ax, pole, reach, ppi, vaneL } = G
  const c = view.colors, m = g.rep
  layer(ctx, view, `mg-vert-${c.us}-${c.trim}`, x => paintGym(x, view, G, c))
  // vanes: pushed through once, they stay through. Who pushed them, and when
  let top = 0
  let swatAt = 0
  for (let i = 0; i <= g.k; i++) { const q = g.reps[i]; if (q.inches != null && g.t >= q.landAt - 30) { if (q.inches > top) { top = q.inches; swatAt = q.landAt - 30 } } }
  // the vanes in two passes: plain, and every fifth in colour
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? '#e8452f' : '#e7ebee'
    ctx.beginPath()
    for (let i = VANE_LO; i <= VANE_HI; i++) {
      if ((i % 5 === 0) !== !!pass) continue
      const y = floor - reach - i * ppi
      let side = -1 // to the left, into the jump
      if (i <= top) {
        const start = swatAt + (top - i) * 6
        const f = g.t < start ? 0 : clamp((g.t - start) / 150, 0, 1)
        side = -Math.cos(f * Math.PI)
      }
      const len = vaneL * Math.abs(side)
      ctx.rect(side < 0 ? pole - len : pole + 7 * U, y - 1.6 * U, len, 3.2 * U)
    }
    ctx.fill()
  }
  // the athlete
  const P = VP, needle = needleOf(g, m, smoothT(g))
  let j = 0
  if (m.phase === 'hold') { mixPose(V_STAND, V_LOAD, easeOut(prog(needle, 0, 0.9)), P) }
  else if (m.phase === 'fly' && m.res.why !== 'clock') {
    const a = g.t - m.relAt, H = ((m.inches ?? 26) * ppi) / s, up = m.flyMs
    if (a < up) { mixPose(V_LOAD, V_RISE, easeOut(prog(a, 0, 180)), P); const f = a / up; j = H * (1 - (1 - f) * (1 - f)) }
    else if (a < up * 2) { copyPose(V_RISE, P); const f = (a - up) / up; j = H * (1 - f * f); P.hFx = lerp(P.hFx, 18, f); P.hFy = lerp(P.hFy, 100, f) }
    else { const f = prog(a, up * 2, up * 2 + 160), f2 = prog(a, up * 2 + 160, up * 2 + 480); mixPose(V_RISE, V_LAND, Math.min(1, f * 1.3), P); if (f2 > 0) mixPose(P, V_STAND, f2, P) }
    P.j = j
  } else if (m.waitAt != null) copyPose(V_STAND, P)
  else { copyPose(V_STAND, P); P.hy += Math.sin(g.t / 320) * 0.5 }
  athlete(ctx, ax, floor, easedPose(poseV, P, g, CLK.dt, 28), { jersey: '#1d57a8', trim: '#ffffff', s, num: null, skin: SKINS[1] })
  // the number: large
  const latest = latestOf(g, 'inches')
  const y = 106 * U
  text(ctx, latest ? String(latest.inches) : '--', 52, y, { font: DISPLAY, size: 66 * U, color: latest && latest.res.in ? '#fff' : latest ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.3)', align: 'left' })
  for (let i = 0; i < g.reps.length; i++) {
    const q = g.reps[i]
    text(ctx, q.landed && q.inches != null ? String(q.inches) : '–', 52 + i * 52, y + 52 * U, { font: DISPLAY, size: 20 * U, color: q.landed ? (q.inches === g.best ? GOLD : 'rgba(255,255,255,.7)') : 'rgba(255,255,255,.3)', align: 'left' })
  }
  drawPeakMeter(ctx, G, m, view, g, needle)
}

export function draw(ctx, g, view) {
  if (g.game === 'velo') return drawVelo(ctx, g, view)
  if (g.game === 'vert') return drawVert(ctx, g, view)
  drawCourtScene(ctx, g, view)
}
