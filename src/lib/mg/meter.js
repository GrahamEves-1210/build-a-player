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
import { clamp, lerp, prog, easeOut, easeIn, easeInOut, rngOf, outcome, layer, text, rr, basketball, themOf, particles, nudge, reduceMotion, GOOD, BAD, GOLD, DISPLAY, LABEL, warmSkin } from './kit.js'
import { HEAD_R, GEAR, clockSlab, sideHead, standAt, clipboard, SCOUT, FOLK_SKIN } from './dash.js'
import { vignette, nameTag, inkOn, boardInk, limb, limbShade, airBall, bareHead } from './art.js'
import { castMen } from './read.js'

export const how = {
  'clutch-shot': 'Hold to rise, let go in the green at the top of the jump, before the clock hits zero. Waiting shrinks the green.',
  'free-throws': 'Hold, let go in the green. Make both. The second one shakes.',
  'spot': 'Four spots. Hold, let go in the green at the top of the jump. Make three.',
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
// Clutch: how he gets his shot. Catch and shoot over the closeout; a pump fake that sends the man flying by, one
// dribble and a pull-up from the elbow; or a crossover into a step-back three. The move is his (it's picked for the
// look, never the result): the green opens when it's done, and the clock carries the time it takes
const MOVES = ['catch', 'pump', 'step'], MOVE_MS = { catch: 0, pump: 980, step: 860 }
// The space a move makes. The pull-up is from the elbow with his man behind him: a bigger green, and it goes slowly.
// The step-back buys a step on the man: a touch bigger, a touch slower
export const clutchPts = move => (move === 'pump' ? 2 : 3)
const MOVE_GREEN = { catch: 1, pump: 1.18, step: 1.06 }, MOVE_CLOSE = { catch: 1, pump: 1.8, step: 1.25 }
// (on the dev server, ?move=pump or ?move=step picks one)
const forcedMove = () => { try { const v = typeof location !== 'undefined' && location.hostname === 'localhost' ? new URLSearchParams(location.search).get('move') : null; return MOVES.includes(v) ? v : null } catch { return null } }

const SLOW = 0.5         // the last of a clutch shot's flight: the ball hangs (the rules are done by then, nothing to judge)
const BOUNCE = 430       // a free throw's dribble: one trip down and back
export function make({ v, seed, game, situation = null }) {
  const S = SETUP[game] ?? SETUP['clutch-shot']
  const r = rngOf(seed)
  // (a second stream for what things look like, so a look can never change a result)
  const look = rngOf(`${seed}|look`)
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
      lo: 0, hi: 0, kind: null, mph: null, inches: null, look: look(), irons: NO_IRON, ironN: 0, rimAt: 0,
    }
  })
  // the one curve: ease-in all the way, no steps. A peak meter runs it up, then back
  const pOf = (m, tau) => (m.peak ? clamp(1 - Math.abs(tau - m.c) / m.c, 0, 1) : clamp(tau / m.fill, 0, 1)) ** m.curve
  const zoneOf = m => { m.lo = pOf(m, m.c - m.half); m.hi = m.peak ? 1 : pOf(m, m.c + m.half) }
  reps.forEach(zoneOf)
  const clutch = game === 'clutch-shot'
  let move = clutch ? forcedMove() ?? MOVES[Math.floor(look() * MOVES.length)] : 'catch'
  if (move === 'pump' && situation && situation.opp - situation.mine >= 2) move = 'step'   // (a two doesn't win it from two down)
  const freeAt = CATCH + MOVE_MS[move]
  reps[0].readyAt = clutch ? freeAt : 300
  if (clutch) { reps[0].half = reps[0].half0 * MOVE_GREEN[move]; zoneOf(reps[0]) }
  const g = {
    t: 0, game, zones: 'none', fx: [], done: null, outro: S.outro, stamp: null, S, reps, k: 0, rep: reps[0], held: false, tv: t,
    clock: clutch ? CLOCK + MOVE_MS[move] : null, move, freeAt, tick0: 2, catchAt: CATCH, best: null, pOf, theta: lerp(-0.07, 0.07, r()),
    hud: { prompt: S.prompt, dots: reps.map(() => null) },
    look: look(), parts: particles(44, Math.floor(look() * 1e6)), nudge: nudge(), hornAt: null,
    tick(dt) {
      const m = g.rep
      // the ball hangs on the way down to the rim: the game on it, everyone watching
      if (clutch && m.res && !m.landed && m.res.why !== 'clock') dt *= lerp(1, SLOW, prog(m.landAt - g.t, 430, 300))
      // and a big man hangs at the top of a jump
      if (game === 'vert' && m.res && m.res.why !== 'clock' && Math.abs(g.t - m.rimAt) < 90) dt *= 0.45
      g.t += dt
      // on the iron: every touch of it is heard
      if (m.ironN < m.irons.length && g.t >= m.rimAt + m.irons[m.ironN]) { m.ironN++; g.fx.push('rimmiss', 'h:light') }
      if (game === 'free-throws' && m.phase === 'ready') {
        const n = Math.floor((g.t - m.shownAt + BOUNCE / 2) / BOUNCE)
        if (n > (m.bounced ?? 0) && n <= 3) { m.bounced = n; g.fx.push('dribble') }
      }
      if (clutch) {
        g.clock = Math.max(0, CLOCK + MOVE_MS[g.move] - g.t)
        if (g.clock <= g.tick0 * 1000 && g.tick0 > 0) { g.fx.push('h:light'); g.tick0-- }
        if (g.clock <= 0 && g.tick0 === 0) { g.tick0 = -1; g.hornAt = g.t; g.fx.push('whistle') }
      }
      if (m.phase === 'wait' && g.t >= m.readyAt) {
        m.phase = 'ready'; m.shownAt = g.t
        if (g.held) begin(m)
      }
      if (clutch && m.phase === 'ready') {
        m.half = m.half0 * MOVE_GREEN[g.move] * closeoutOf((g.t - g.freeAt) / MOVE_CLOSE[g.move])
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
    // what it does on the iron decides when it's decided: the word waits for the ball
    m.rimAt = g.t + m.flyMs
    if (!peak) ironOf(m, game)
    m.landAt = m.rimAt + (m.hang ?? 0)
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
      // (the iron was already heard)
      g.fx.push(m.res.in ? 'make' : m.irons.length ? 'h:light' : 'pop', m.res.in ? 'h:light' : 'h:medium')
    }
    if (game === 'clutch-shot' && m.res.in && g.sit) g.sit = { ...g.sit, mine: g.sit.mine + clutchPts(g.move) }
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
    const at = g.t + 120 + (game === 'clutch-shot' ? 0 : 800)
    if (game !== 'clutch-shot') g.outro += 800
    if (game === 'clutch-shot') {
      const buzzer = g.clock <= 0
      // (the mob needs the time to get to him, and a miss needs time to hurt)
      g.outro = hit ? (buzzer ? 3400 : 2900) : 2300
      g.done = outcome(hit ? m.res.q : m.res.q * 0.5, hit, hit ? 'Good' : timedOut ? 'Out of time' : m.res.why === 'early' ? 'Too early' : 'Too late', { made, of: 1, pts: clutchPts(g.move) }, timedOut)
      g.stamp = { text: timedOut ? 'OUT OF TIME' : hit ? (buzzer ? 'AT THE BUZZER' : m.kind === 'swish' ? 'SWISH' : 'BUCKET') : (m.kind === 'air' ? 'AIRBALL' : m.rimOut ? 'IN AND OUT' : 'BRICK'), good: hit, at, y: 92, size: timedOut || (hit && buzzer) || m.rimOut ? 36 : 50 }
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
      g.stamp = { text: hit ? (mph >= 58 ? 'CANNON' : 'GOOD ARM') : 'MISTIMED', good: hit, at, size: 46 }
    } else {
      const inches = Math.max(...reps.map(x => x.inches ?? 20))
      g.done = outcome(bestQ, hit, `${inches}" vertical`, { inches, clean: made }, timedOut)
      g.stamp = { text: hit ? (inches >= 36 ? 'ABOVE THE RIM' : 'GOOD JUMP') : 'MISTIMED', good: hit, at, size: hit && inches >= 36 ? 36 : 46 }
    }
  }
  return g
}

// A shot on the iron. irons: ms after it first gets there that it touches iron. hang: how long until it's decided.
// A good-not-great one rattles in. A near miss goes round and out. Now and then a good one kisses the glass.
const NO_IRON = []
function ironOf(m, game) {
  const near = Math.abs(m.res.off) <= m.half + 40
  if (m.kind === 'rattle') {
    if (game !== 'free-throws' && m.look > 0.72) { m.bank = true; m.hang = 190; m.irons = NO_IRON }
    else if (m.res.q >= 0.7) { m.hang = 260; m.irons = [0, 150] }
    else { m.hang = 410; m.irons = [0, 170, 300] }
  } else if (m.kind === 'front' || m.kind === 'back') {
    m.rimOut = near
    m.hang = near ? 170 : 0
    m.irons = near ? [0, 170] : [0]
  }
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
export const HANDS = { fx: 0, fy: 0, bx: 0, by: 0 }  // on the screen: near hand, far hand, the ball
export const SKINS = ['#8d5a3b', '#6d4229', '#a9744f', '#5a3522']
const shadeTable = { '#8d5a3b': '#6f452c', '#6d4229': '#553220', '#a9744f': '#875a3b', '#5a3522': '#452818' }
// (a real man's skin gets its own far-side shade, the same step darker as these)
const shadeFor = skin => {
  if (shadeTable[skin]) return shadeTable[skin]
  const n = parseInt(String(skin).slice(1, 7), 16)
  if (!Number.isFinite(n)) return '#6f452c'
  const v = b => Math.round(((n >> b) & 255) * (b === 16 ? 0.8 : b === 8 ? 0.74 : 0.7)).toString(16).padStart(2, '0')
  return (shadeTable[skin] = `#${v(16)}${v(8)}${v(0)}`)
}
// a man's last name under his feet: s is the rig's scale. Small however close he is, and never off the side.
export function meterTag(ctx, view, x, y, name, s) {
  if (!name) return
  const k = clamp(s * 1.05, 0.8, 1.4)
  nameTag(ctx, view, clamp(x, 34, view.w - 34), Math.min(y, view.h - 13 * k), name, k)
}
// The man side-on in his singlet: the same long limbs, two flat tones and outline as every other man on the floor.
// (The legs are the QB's at the combine, in his colours.)
const S_TORSO = 37
const sideLooks = new Map()
function sideLook(jersey, trim, skin) {
  const id = `${jersey}|${trim}|${skin}`
  let c = sideLooks.get(id)
  if (!c) {
    const skinD = shadeFor(skin)
    c = { skin, skinD, skinDD: darker(skinD), top: jersey, topD: trim, shorts: jersey, shortsD: darker(jersey), sock: '#f3f3f0', sockD: '#b9bcba', shoe: '#f3f3f0', shoeD: '#c4c7c5', sole: '#14181c' }
    sideLooks.set(id, c)
  }
  return c
}
function sideArm(ctx, sx, sy, tx, ty, far, c) {
  armIK(sx, sy, tx, ty, UARM, FARM, -0.62, 0.78)
  const jx = IK.jx, jy = IK.jy, ex = IK.ex, ey = IK.ey, fl = Math.hypot(ex - jx, ey - jy) || 1, ux = (ex - jx) / fl, uy = (ey - jy) / fl
  const skin = far ? c.skinD : c.skin, dark = far ? c.skinDD : c.skinD, hx = ex + ux * 4.4, hy = ey + uy * 4.4
  const bx = ex + ux * 1.2 - uy * 2.4, by = ey + uy * 1.2 + ux * 2.4
  ctx.fillStyle = INK; ctx.beginPath()
  limb(ctx, sx, sy, 6.5, jx, jy, 4.9, 0.8, 0.8); limb(ctx, jx, jy, 4.9, ex, ey, 3.2, 1.5, 1.5); limb(ctx, ex + ux, ey + uy, 3.9, hx, hy, 3.3); limb(ctx, bx, by, 2, bx + ux * 2.2, by + uy * 2.2, 1.8); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath()
  limb(ctx, sx, sy, 5.5, jx, jy, 3.9, 0.8, 0.8); limb(ctx, jx, jy, 3.9, ex, ey, 2.2, 1.5, 1.5); limb(ctx, ex + ux, ey + uy, 2.9, hx, hy, 2.3); limb(ctx, bx, by, 1.05, bx + ux * 2.2, by + uy * 2.2, 0.85); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); limbShade(ctx, sx, sy, 5.5, jx, jy, 3.9, 0.8, 0.8); limbShade(ctx, jx, jy, 3.9, ex, ey, 2.2, 1.5, 1.5); ctx.fill()
}
export function athlete(ctx, x, floorY, P, o = {}) {
  const { jersey = '#1b6fd1', trim = '#fff', skin: skinIn = '#8d5a3b', s = 1.7, flip = false, num = null, hair = '#15100c', shadow = true } = o
  const skin = warmSkin(skinIn)
  const c = sideLook(jersey, trim, skin), dir = flip ? -1 : 1
  const hipX = P.hx, hipY = -(P.hy + P.j), lean = P.lean, sl = Math.sin(lean), cl = Math.cos(lean)
  const sx = hipX + sl * S_TORSO, sy = hipY - cl * S_TORSO, ay = sy + 3
  // the floor under him: a shadow, smaller as he leaves it
  if (shadow) {
    const up = clamp(P.j / 60, 0, 1)
    ctx.fillStyle = 'rgba(0,0,0,.3)'
    ctx.beginPath(); ctx.ellipse(x + dir * hipX * s, floorY + 2, (30 - up * 12) * s, (4.5 - up * 2) * s, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.save(); ctx.translate(x, floorY); ctx.scale(dir * s, s)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  sideArm(ctx, sx + 2, ay, P.hBx, -(P.hBy + P.j), true, c)
  throwerLeg(ctx, hipX - 1, hipY, P.fBx, -(P.fBy + P.j), true, c, P.toeB)
  throwerLeg(ctx, hipX + 1, hipY, P.fFx, -(P.fFy + P.j), false, c, P.toeF)
  ctx.fillStyle = c.shorts; ctx.beginPath(); limb(ctx, hipX - 0.6, hipY - 2, 8.6, hipX, hipY + 3, 8); ctx.fill()
  // the neck, then the singlet over it: a flat back, the chest ahead of him, a cut armhole, the trim on the edges
  const hx = sx + sl * 13 + 1.4, hy = sy - cl * 13.5
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, sx, sy + 1, 5.6, hx - 0.6, hy, 5); ctx.fill()
  ctx.fillStyle = c.skinD; ctx.beginPath(); limb(ctx, sx, sy + 1, 4.6, hx - 0.6, hy, 4.1); ctx.fill()
  ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(lean)
  const T = -S_TORSO
  ctx.fillStyle = jersey; ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath()
  ctx.moveTo(-8.8, 2); ctx.quadraticCurveTo(-11.6, T * 0.5, -9.6, T + 5); ctx.quadraticCurveTo(-8.6, T - 2.2, -1, T - 2.2); ctx.quadraticCurveTo(8.2, T - 2, 9.6, T + 6); ctx.quadraticCurveTo(10.8, T * 0.42, 8.8, 2); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath()
  ctx.moveTo(-8.8, 2); ctx.quadraticCurveTo(-11.6, T * 0.5, -9.6, T + 5); ctx.quadraticCurveTo(-9.2, T - 1, -6.4, T - 2); ctx.quadraticCurveTo(-3.6, T * 0.5, -3.8, 2); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = trim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-4.6, T - 1.8); ctx.quadraticCurveTo(0.6, T + 1.4, 5.2, T - 1.2); ctx.moveTo(-8.8, 0.6); ctx.lineTo(8.8, 0.6); ctx.stroke()
  if (num != null) { ctx.save(); ctx.scale(flip ? -1 : 1, 1); text(ctx, String(num), 0, T * 0.52, { font: DISPLAY, size: 13, color: inkOn(jersey, trim) }); ctx.restore() }
  ctx.restore()
  sideHead(ctx, hx, hy, HEAD_R, skin, hair, lean * 0.3)
  sideArm(ctx, sx - 1, ay, P.hFx, -(P.hFy + P.j), false, c)
  ctx.restore()
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
const BOARD_H = 22
const SEAT_TONES = ['#161c23', '#1a2129', '#1e252e', '#20282f']
// cheer: 0 sitting; 1 and 2 are the two frames of a building on its feet, the same people in the same seats
export function paintBowl(x, view, { horizon, us, trim, dim = 0, seed = 7, board = 'BUILD-A-PLAYER', cheer = 0 }) {
  const { w } = view
  const U = view.h / 640, E = !!view.empty
  // (an empty house, the combine or camp: nobody in the seats and half the lights on)
  const beams = paintRoof(x, view, horizon, E ? [180] : [62, 180, 298], 0.07, ['#05080c', '#0b1219', '#141c26'])
  const R = dice(seed), C = dice(seed + 91)
  const pal = ['#2b323b', '#37404a', '#232931', '#434d57', '#4d4a45', us, '#5b3029', '#26394a', '#6a6860']
  const foot = horizon - BOARD_H * U, roof = lerp(46, foot, 0.1), rib = lerp(roof, foot, 0.42)
  // a tier: row on row, closer rows bigger and better lit, broken up by its stairs
  const tier = (y0, y1, h0, h1, a0, a1, stairs) => {
    let y = y0, row = 0
    while (y < y1) {
      const f = (y - y0) / Math.max(1, y1 - y0), hs = lerp(h0, h1, f) * U, gap = hs * 2.75, alpha = lerp(a0, a1, f)
      x.fillStyle = `rgba(255,255,255,${lerp(0.015, 0.05, f)})`; x.fillRect(0, y - hs * 1.4, w, 1)
      for (let px = -gap + (row % 2) * gap * 0.5; px < w + gap; px += gap) {
        const jit = R()
        const body = Math.sin(px * 0.045 + row * 0.25) > 0.45 && R() < 0.72 ? us : pal[Math.floor(R() * pal.length)]
        const skin = R() < 0.5 ? '#6e5340' : '#463326'
        const c0 = C(), c1 = C(), c2 = C()
        if (jit < 0.09 || Math.abs(((px - stairs + 480) % 120) - 60) < hs * 1.05) continue
        // (empty: the seat back where he'd sit, the home sections in the home colour)
        if (E) { const home = body === us; x.globalAlpha = home ? alpha * 0.45 : Math.min(1, alpha * 1.3); x.fillStyle = home ? us : SEAT_TONES[row % SEAT_TONES.length]; x.fillRect(px - hs * 0.85, y + hs * 0.7, hs * 1.7, hs * 1.2); continue }
        // on their feet: half of them up at a time, the other half on the next frame
        const up = cheer ? hs * ((c0 < 0.5) === (cheer === 1) ? 1.25 : 0.4) : 0
        x.globalAlpha = cheer ? Math.min(1, alpha + 0.14) : alpha
        x.fillStyle = body; x.fillRect(px - hs * 0.9, y + hs * 0.2 - up, hs * 1.8, hs * 1.8)
        x.fillStyle = skin; x.beginPath(); x.arc(px + (jit - 0.5) * hs * 0.6, y - hs * 0.15 - up, hs * 0.62, 0, 6.3); x.fill()
        if (!cheer) continue
        if (c1 < 0.6) { const sp = (cheer === 1 ? 1 : -1) * hs * 0.35; x.fillRect(px - hs * 1 + sp, y - hs * 1.5 - up, hs * 0.42, hs * 1.3); x.fillRect(px + hs * 0.6 + sp, y - hs * 1.5 - up, hs * 0.42, hs * 1.3) }
        else if (c2 < 0.3) { x.fillStyle = c2 < 0.12 ? '#f1f3f4' : trim; x.fillRect(px + (cheer === 1 ? -hs * 1.5 : hs * 0.2), y - hs * 2.2 - up, hs * 1.3, hs * 0.9) }
      }
      x.globalAlpha = 1
      y += hs * 2.75; row++
    }
  }
  tier(roof + 4 * U, rib - 5 * U, 2.1, 3, 0.26, 0.46, 0)
  tier(rib + 8 * U, foot - 4 * U, 3.5, 5.2, 0.52, 0.74, 60)
  // the ribbon board round the bowl, between the decks
  x.fillStyle = '#05080c'; x.fillRect(0, rib - 3 * U, w, 9 * U)
  for (let i = 0; i < 12; i++) { x.fillStyle = i % 3 === 1 ? trim : us; x.globalAlpha = i % 3 === 1 ? 0.75 : 0.9; x.fillRect((i * w) / 12 + 0.5, rib - 1 * U, w / 12 - 1, 5 * U) }
  x.globalAlpha = 1
  // the lights over it all, and the banners in the rafters
  beams()
  for (const c of [62, 180, 298]) { x.fillStyle = E && c !== 180 ? '#2a323b' : '#e8eef4'; x.fillRect(c - 9, 45, 18, 2) }
  for (let i = 0; i < 3; i++) {
    const bx = 22 + i * 25, bw = 19, bt = 45, bb = bt + (i === 1 ? 42 : 34) * U
    x.fillStyle = us; x.beginPath(); x.moveTo(bx, bt); x.lineTo(bx + bw, bt); x.lineTo(bx + bw, bb); x.lineTo(bx + bw / 2, bb + 5 * U); x.lineTo(bx, bb); x.closePath(); x.fill()
    x.fillStyle = 'rgba(0,0,0,.28)'; x.fill()
    x.fillStyle = trim; x.fillRect(bx + 2, bt + 4 * U, bw - 4, 2 * U); x.fillRect(bx + 2, bb - 6 * U, bw - 4, 2 * U); x.fillRect(bx + 5, bt + 12 * U, bw - 10, 8 * U)
  }
  // the courtside board
  const bh = BOARD_H * U
  x.fillStyle = '#0a0e12'; x.fillRect(0, horizon - bh, w, bh)
  x.fillStyle = us; x.fillRect(0, horizon - bh + 2 * U, w, bh - 4 * U)
  x.globalAlpha = 0.28; x.fillStyle = '#000'; x.fillRect(0, horizon - bh + 2 * U, w, bh - 4 * U); x.globalAlpha = 1
  for (let px = 54; px < w + 60; px += 134) text(x, board, px, horizon - bh / 2 + 0.5, { font: DISPLAY, size: 12 * U, color: boardInk(us, trim), track: 1 })
  if (dim) { x.fillStyle = `rgba(4,7,11,${dim})`; x.fillRect(0, 0, w, horizon) }
}
// The building on its feet: the same bowl in two frames, painted once at the start of the game and flipped, one opaque
// blit in place of the seated crowd. G: anything with wallY. (A pan like Spot-up's can't use it: that's a drill anyway.)
const crowds = new Map()
function crowdBand(view, G, c, game, n) {
  const id = `${c.us}|${c.trim}|${G.wallY}|${view.h}|${view.px}|${game}|${n}|${view.empty ? 'E' : ''}`
  let cv = crowds.get(id)
  if (!cv && typeof document !== 'undefined') {
    if (crowds.size > 8) crowds.clear()
    const h = G.wallY - (BOARD_H * view.h) / 640
    cv = document.createElement('canvas'); cv.width = Math.round(view.w * view.px); cv.height = Math.round(h * view.px)
    const x = cv.getContext('2d', { alpha: false })
    x.scale(view.px, view.px)
    paintBowl(x, view, bowlOf(G, c, game, n))
    cv.bandH = h
    crowds.set(id, cv)
  }
  return cv
}
// Reduce Motion or a slow machine: the light version, the building stays in its seats and nothing flashes
export const lightFx = () => reduceMotion() || (typeof document !== 'undefined' && document.documentElement.classList.contains('low-power'))
export function warmCrowd(view, G, c, game) { if (lightFx() || view.empty) return; crowdBand(view, G, c, game, 1); crowdBand(view, G, c, game, 2) }
// rate: ms a frame. Slow while they're getting up for it, quick when it's gone in
export function crowdUp(ctx, view, G, c, game, t, rate = 110) {
  if (lightFx() || view.empty) return   // (an empty house: nobody to get up)
  const cv = crowdBand(view, G, c, game, 1 + (Math.floor(t / rate) % 2))
  if (cv) ctx.drawImage(cv, 0, 0, view.w, cv.bandH)
}
// the courtside board lighting up with the team's colour
export function boardFlash(ctx, view, G, color, a) {
  if (lightFx() || view.empty) return
  const U = view.h / 640
  ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillRect(0, G.wallY - (BOARD_H - 2) * U, view.w, (BOARD_H - 4) * U); ctx.globalAlpha = 1
}
const hash01 = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s) }
// phones going off in the seats: where and when come from the clock, so there's nothing to keep
export function camFlashes(ctx, view, G, t, n = 12) {
  if (lightFx() || view.empty) return
  const U = view.h / 640, tick = Math.floor(t / 80)
  ctx.fillStyle = '#fff'
  for (let i = 0; i < n; i++) {
    const a = hash01(tick * 3.1 + i * 7.7), b = hash01(tick * 1.7 + i * 11.3), d = 1.4 + hash01(tick + i) * 2
    ctx.fillRect(a * view.w, lerp(60 * U, G.wallY - 28 * U, b), d, d)
  }
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
// full: the whole half court (sidelines, the half-court line). sc: the court's lines drawn smaller about the rim
// (a game that wants less floor to cover)
export function paintLines(x, c, paint, full = false, sc = 1) {
  const BL = BASELINE * sc, LN = LANE * sc, FT = FT_Z * sc, TH = THREE * sc, CO = CORNER * sc, CZ = CORNER_Z * sc
  // past the baseline the floor goes dark
  x.fillStyle = 'rgba(10,8,6,.3)'; x.beginPath(); fan(x, c, [[-70, BL], [70, BL], [70, 40], [-70, 40]]); x.fill()
  // the boards run the length of the court
  x.strokeStyle = 'rgba(70,35,10,.13)'; x.lineWidth = 1; x.beginPath()
  for (let u = -46; u <= 46 && !c.bare; u += 2) {   // (bare: the arena's floor, plain the whole way as the camera travels)
    project(c, u, 0, BL); if (PT.z < 3) continue
    const ax = PT.x, ay = PT.y; project(c, u, 0, -46); if (PT.z < 3) continue
    x.moveTo(ax, ay); x.lineTo(PT.x, PT.y)
  }
  x.stroke()
  // the paint
  x.fillStyle = paint; x.globalAlpha = 0.72; x.beginPath(); fan(x, c, [[-LN, BL], [LN, BL], [LN, FT], [-LN, FT]]); x.fill()
  x.globalAlpha = 1
  x.fillStyle = '#f7f5ef'; x.beginPath()
  line(x, c, -30, BL, 30, BL, 12)
  line(x, c, -LN, BL, -LN, FT, 5); line(x, c, LN, BL, LN, FT, 5); line(x, c, -LN, FT, LN, FT, 5)
  arcLine(x, c, 0, FT, 6 * sc, -Math.PI / 2, Math.PI / 2, 24)
  arcLine(x, c, 0, 0, 4, -Math.PI / 2, Math.PI / 2, 28, 0.09)
  const a = Math.asin(CORNER / THREE)
  arcLine(x, c, 0, 0, TH, -a, a, 64)
  line(x, c, -CO, BL, -CO, CZ, 4); line(x, c, CO, BL, CO, CZ, 4)
  if (full) {
    const SL = 25 * sc, HALF = BL - 47 * sc
    line(x, c, -SL, BL, -SL, HALF - 6, 12); line(x, c, SL, BL, SL, HALF - 6, 12)
    line(x, c, -SL, HALF, SL, HALF, 8)
    arcLine(x, c, 0, HALF, 6 * sc, -Math.PI / 2, Math.PI / 2, 24)
  }
  x.fill()
  // out of bounds, past the sidelines, a shade darker
  if (full) { const SL = 25 * sc + 0.5; x.fillStyle = 'rgba(10,8,6,.22)'; x.beginPath(); fan(x, c, [[-70, BL], [-SL, BL], [-SL, -60], [-70, -60]]); x.fill(); x.beginPath(); fan(x, c, [[SL, BL], [70, BL], [70, -60], [SL, -60]]); x.fill() }
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
  if (front) dy *= 1.3   // (it's on the end of its bracket: the front moves most)
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
// The net: rows of knots, each row a half-step round from the last, and the strands crossing between them.
// age: ms since the ball went through (null: it hasn't). The ball swells it on the way down, then the bottom whips
// up and out, snaps from side to side and settles. jolt: ms since the rim was hit, a shiver.
const NET_N = 10, NET_ROWS = 3
const NET_C = Array.from({ length: NET_N * 2 }, (_, i) => Math.cos((i / NET_N) * Math.PI)), NET_S = NET_C.map((_, i) => Math.sin((i / NET_N) * Math.PI))
const NET_X = new Float32Array(NET_N * (NET_ROWS + 1)), NET_Y = new Float32Array(NET_N * (NET_ROWS + 1))
export function netOf(ctx, c, age, dy = 0, jolt = null) {
  let lift = 0, swing = 0, flare = 0, run = -1
  if (age != null && age >= 0 && age < 1300) {
    const on = Math.min(1, age / 130)
    run = age / 150
    lift = Math.exp(-age / 330) * (0.48 + Math.sin(age / 48) * 0.3) * on
    swing = Math.exp(-age / 430) * Math.sin(age / 80) * 0.24 * on
    flare = Math.exp(-age / 240) * 0.26 * on
  } else if (jolt != null && jolt >= 0 && jolt < 700) {
    swing = Math.exp(-jolt / 240) * Math.sin(jolt / 34) * 0.13
    lift = Math.exp(-jolt / 180) * 0.12
  }
  const H = 1.5
  for (let L = 0; L <= NET_ROWS; L++) {
    const f = L / NET_ROWS, y = RIM_Y - H * f * (1 - lift * f), off = L % 2
    const bulge = run >= 0 && run < 1.6 ? Math.exp(-((f - run) * (f - run)) / 0.07) * 0.28 : 0
    const r = RIM_R * lerp(1, 0.58, f) * (1 + bulge + flare * f), sway = swing * f * f
    for (let i = 0; i < NET_N; i++) {
      const a = 2 * i + off
      project(c, NET_C[a] * r + sway, y, NET_S[a] * r)
      NET_X[L * NET_N + i] = PT.x; NET_Y[L * NET_N + i] = PT.y + dy
    }
  }
  project(c, 0, RIM_Y, 0)
  ctx.strokeStyle = 'rgba(246,248,250,.95)'; ctx.lineWidth = Math.max(0.9, 0.05 * PT.k); ctx.beginPath()
  for (let L = 0; L < NET_ROWS; L++) {
    const here = L * NET_N, next = here + NET_N, step = L % 2 ? 1 : NET_N - 1
    for (let i = 0; i < NET_N; i++) {
      const a = next + i, b = next + (i + step) % NET_N
      ctx.moveTo(NET_X[a], NET_Y[a]); ctx.lineTo(NET_X[here + i], NET_Y[here + i]); ctx.lineTo(NET_X[b], NET_Y[b])
    }
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
  const list = [], F = (m.flyMs ?? 800) - PUSH
  const D = Math.hypot(sx, sz), dx = sx / D, dz = sz / D, sideX = -dz, sideZ = dx
  // a real arc: about 16 feet up from 24 feet out. A pure one's higher, one he got under or pushed is flatter
  const peak = RIM_Y + D * 0.26 * (m.kind === 'swish' ? 1.1 : m.kind === 'front' || m.kind === 'air' ? 0.84 : 1)
  const apex = yEnd => peak - (sy + yEnd) / 2
  const through = (x, y, z) => {
    seg(list, 130, x, y, z, x, RIM_Y - 1.5, z, 0, true)
    seg(list, 400, x, RIM_Y - 1.5, z, x + dx * 0.3, FL, z + dz * 0.3, 0, true)
    bounces(list, x + dx * 0.3, z + dz * 0.3, dx * 1.5 + sideX * 0.3, dz * 1.5 + sideZ * 0.3)
  }
  const R = RIM_R, Y = RIM_Y + BALL_R * 0.85
  if (m.kind === 'swish') { seg(list, F, sx, sy, sz, 0, RIM_Y + 0.1, 0, apex(RIM_Y)); through(0, RIM_Y + 0.1, 0) }
  else if (m.bank) {
    // the glass, the square, and down
    const bx = sideX * 0.45, by = 11.15, bz = BOARD_Z - BALL_R
    seg(list, F, sx, sy, sz, bx, by, bz, apex(by))
    seg(list, m.hang, bx, by, bz, 0, RIM_Y + 0.1, 0, 0, true)
    through(0, RIM_Y + 0.1, 0)
  } else if (m.kind === 'rattle') {
    // front iron, back iron, (round the side,) and it falls
    const fx = dx * R * 0.85, fz = dz * R * 0.85, bx = -dx * R * 0.8, bz = -dz * R * 0.8
    seg(list, F, sx, sy, sz, fx, Y, fz, apex(Y))
    if (m.irons.length > 2) {
      const ox = sideX * R * 0.8, oz = sideZ * R * 0.8
      seg(list, 170, fx, Y, fz, bx, Y, bz, 0.85)
      seg(list, 130, bx, Y, bz, ox, Y, oz, 0.42)
      seg(list, 110, ox, Y, oz, 0, RIM_Y + 0.1, 0, 0.12)
    } else {
      seg(list, 150, fx, Y, fz, bx, Y, bz, 0.6)
      seg(list, 110, bx, Y, bz, 0, RIM_Y + 0.1, 0, 0.1)
    }
    through(0, RIM_Y + 0.1, 0)
  } else if (m.kind === 'front') {
    const fx = dx * (R + 0.1), fz = dz * (R + 0.1), tx = dx * 8 + sideX * 1.5, tz = dz * 8 + sideZ * 1.5
    seg(list, F, sx, sy, sz, fx, RIM_Y + BALL_R, fz, apex(RIM_Y))
    if (m.rimOut) {
      // up off the front, onto the back: so close. Then away
      const bx = -dx * R * 0.8, bz = -dz * R * 0.8
      seg(list, 170, fx, RIM_Y + BALL_R, fz, bx, Y, bz, 0.8)
      seg(list, 760, bx, Y, bz, tx, FL, tz, 2.6)
    } else seg(list, 700, fx, RIM_Y + BALL_R, fz, tx, FL, tz, 1.8)
    bounces(list, tx, tz, dx * 3, dz * 3)
  } else if (m.kind === 'back') {
    const fx = -dx * R * 0.75, fz = -dz * R * 0.75, tx = dx * 7 - sideX * 2, tz = dz * 7 - sideZ * 2
    seg(list, F, sx, sy, sz, fx, RIM_Y + BALL_R, fz, apex(RIM_Y))
    if (m.rimOut) {
      // off the back, onto the front, and it spits out
      const bx = dx * R * 0.85, bz = dz * R * 0.85
      seg(list, 170, fx, RIM_Y + BALL_R, fz, bx, Y, bz, 0.7)
      seg(list, 700, bx, Y, bz, tx, FL, tz, 2.2)
    } else seg(list, 800, fx, RIM_Y + BALL_R, fz, tx, FL, tz, 3.4)
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
// (ELBOWS.wide: elbows out to the sides instead of hanging, for a pose with the forearms flat across him)
const ELBOWS = { wide: 0 }
function solveArm(A, sx, sy, hx, hy, out) {
  const up = clamp((sy - hy) / 30, 0, 1)   // the hand above the shoulder
  armIK(sx, sy, hx, hy, UARM, FARM, out * lerp(0.32 - 0.14 * up, 0.9, ELBOWS.wide), lerp(0.92 - 0.1 * up, 0.42, ELBOWS.wide))
  A.sx = sx; A.sy = sy; A.jx = IK.jx; A.jy = IK.jy; A.ex = IK.ex; A.ey = IK.ey; A.out = out
}
// (d: how much bigger the ink is than the skin)
function armPath(ctx, A, d) {
  const dx = A.ex - A.jx, dy = A.ey - A.jy, fl = Math.hypot(dx, dy) || 1, ux = dx / fl, uy = dy / fl, px = -uy, py = ux
  const t = -A.out * (px >= 0 ? 1 : -1)   // (the thumb's on the inside of the hand)
  limb(ctx, A.sx, A.sy, 5.5 + d, A.jx, A.jy, 3.5 + d, 0.8, 0.8)
  limb(ctx, A.jx, A.jy, 3.5 + d, A.ex, A.ey, 2 + d, 1.5, 1.5)
  // (flick: the wrist over the top, the fingers going away from us into the shot)
  const hl = 4.6 - (A.flick ?? 0) * 2.8
  limb(ctx, A.ex + ux * 0.8, A.ey + uy * 0.8, 2.8 + d, A.ex + ux * hl, A.ey + uy * hl, 2.3 + d)
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
  // the seat: the shorts carried across both hips, so a leg out wide never opens a corner of skin under the waistband
  const ux = B.hx - A.hx, uy = B.hy - A.hy, L = Math.hypot(ux, uy) || 1, cx = ux / L, cy = uy / L, nx = -cy, ny = cx
  const a0x = A.hx - cx * 7.5, a0y = A.hy - cy * 7.5, b0x = B.hx + cx * 7.5, b0y = B.hy + cy * 7.5
  const a1x = A.hx - cx * 6.6 + nx * 6.5, a1y = A.hy - cy * 6.6 + ny * 6.5, b1x = B.hx + cx * 6.6 + nx * 6.5, b1y = B.hy + cy * 6.6 + ny * 6.5
  ctx.fillStyle = jersey; ctx.beginPath(); ctx.moveTo(a0x, a0y); ctx.lineTo(b0x, b0y); ctx.lineTo(b1x, b1y); ctx.lineTo(a1x, a1y); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(a0x, a0y); ctx.lineTo(lerp(a0x, a1x, 0.4), lerp(a0y, a1y, 0.4)); ctx.moveTo(b0x, b0y); ctx.lineTo(lerp(b0x, b1x, 0.4), lerp(b0y, b1y, 0.4)); ctx.stroke()
}
export function athleteFront(ctx, x, floorY, P, o = {}) {
  const { jersey = '#1b6fd1', trim = '#fff', skin: skinIn = '#8d5a3b', s = 1.7, back = true, num = null, hair = '#15100c', ball = null, spin = 0, armsOver = false, elbowsOut = false, point = false } = o
  const skin = warmSkin(skinIn)
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
  ELBOWS.wide = elbowsOut ? 1 : 0
  solveArm(ARM_A, lx, ly, P.hBx, hLy, -1); solveArm(ARM_B, rx, ry, P.hFx, hRy, 1)
  ELBOWS.wide = 0
  ARM_B.flick = P.flick ?? 0
  HANDS.fx = x + s * ARM_B.ex; HANDS.fy = floorY + s * ARM_B.ey
  // a hand across his front comes over the jersey; any other arm hangs from under the armhole
  // (armsOver: a pose with both arms across his front, like Dame Time, keeps them over the jersey wherever the hands are)
  const overA = !back && (armsOver || Math.abs(ARM_A.ex - hipX) < 15.5) ? ARM_A : null, overB = !back && (armsOver || Math.abs(ARM_B.ex - hipX) < 15.5) ? ARM_B : null
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
  // point: the screen-left hand's index finger out, pointing at the other wrist (Dame Time)
  if (point) {
    let ux = ARM_B.ex - ARM_A.ex, uy = ARM_B.ey - ARM_A.ey - 5
    const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L
    const at = d => [ARM_A.ex + ux * d, ARM_A.ey + uy * d], [ix, iy] = at(2.6), [tx, ty] = at(5.4), [sx0, sy0] = at(0.4)
    // (the ink only where it sticks out of the fist; the skin runs back into the hand so there's no seam)
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.9; ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(tx, ty); ctx.stroke()
    ctx.strokeStyle = skin; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(tx, ty); ctx.stroke()
  }
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
const P_DIP = pose({ hy: 39, lean: 0, fFx: 14, fBx: -14, hFx: 22, hFy: 52, hBx: 10, hBy: 53 })
const P_GATHER = pose({ hy: 45, lean: 0, fFx: 11, fBx: -11, hFx: 20, hFy: 82, hBx: 8, hBy: 84 })
const P_LANDED = pose({ hy: 46, lean: 0, fFx: 12, fBx: -12, hFx: 14, hFy: 124, hBx: -21, hBy: 62 })
const P_DRIB = pose({ hy: 40, lean: 0.05, fFx: 13, fBx: -13, hFx: 26, hFy: 36, hBx: -18, hBy: 52 })
const P_GUARD = pose({ hy: 46, lean: 0, fFx: 13, fBx: -13, hFx: 18, hFy: 122, hBx: -18, hBy: 122 })
const SP = newPose(), SQ = newPose()
const JUMP = 34, RISE = 250, PUSH = 85
const smooth01 = f => f * f * (3 - 2 * f)
// How a man shoots it. H: how high he gets. set: where the ball sits when he's up there (the elbow under it). rel: where
// the hand finishes. guide: where the off hand goes when it comes away. kick: a leg swinging out on the way down.
// drift, tilt: carrying sideways through the shot, leaning into or away from it. dip: how far he sits down first.
const STYLE = (H, set, rel, guide, dip = 31, kick = 0, drift = 0, tilt = 0) => {
  const air = { hy: 49, lean: 0, fFx: 8, fBx: -8, fFy: 1, fBy: 2 }
  return { H, set, rel, guide, dip, kick, drift, tilt, point: pose({ ...air, hFx: set[0], hFy: set[1], hBx: set[0] - 12.5, hBy: set[1] + 1 }), release: pose({ ...air, hFx: rel[0], hFy: rel[1], hBx: guide[0], hBy: guide[1] }) }
}
const STYLES = {
  pure: STYLE(1, [15, 102], [13, 122], [-19, 103]),
  high: STYLE(1.08, [11, 106], [10, 124], [-21, 106], 30),
  quick: STYLE(0.8, [20, 94], [15, 120], [-16, 96], 33),
  kick: STYLE(0.94, [16, 100], [15, 122], [-20, 100], 32, 1),
  fade: STYLE(0.9, [13, 104], [17, 121], [-17, 104], 32, 0.5, -11, -0.15),
  lean: STYLE(0.9, [17, 100], [11, 121], [-22, 99], 32, 0.3, 9, 0.11),
}
const STYLES_OF = { 'clutch-shot': ['fade', 'pure', 'lean', 'high', 'kick'], spot: ['pure', 'quick', 'kick', 'high', 'lean'] }
const styleOf = (m, game) => m.sty ?? (m.sty = STYLES[(STYLES_OF[game] ?? STYLES_OF.spot)[Math.floor(m.look * 5)]])
// the whole man, across the floor
const carryAcross = (out, d) => { out.hx += d; out.fFx += d; out.fBx += d; out.hFx += d; out.hBx += d }
function legsInAir(out, air, kick) {
  out.fFx = lerp(out.fFx, 7, air); out.fBx = lerp(out.fBx, -7, air); out.fFy = air * 5; out.fBy = air * 8
  if (kick) { out.fFx += kick * air * 15; out.fFy += kick * air * 13 }
}
// ── Clutch moves ──
// Where the move has taken him, in court feet in the camera's frame: across (dx) and toward the rim (dz)
const MV = { dx: 0, dz: 0, bx: 0, by: 0 }
function moveSpot(g, t) {
  const a = t - CATCH
  MV.dx = 0; MV.dz = 0
  // one hard dribble going left and in: from the arc to the elbow
  if (g.move === 'pump') { const e = easeInOut(prog(a, 470, 900)); MV.dx = -1.4 * e; MV.dz = 5 * e }
  // a jab right on the in-and-out, then the crossover and the hop back to the left, behind the line
  else if (g.move === 'step') { const e1 = easeInOut(prog(a, 130, 300)), e2 = easeOut(prog(a, 440, 680)); MV.dx = 0.8 * e1 - 1.8 * e2; MV.dz = 0.4 * e1 - 1.4 * e2 }
  return MV
}
const P_PUMP = pose({ hy: 47, lean: 0, fFx: 13, fBx: -13, hFx: 19, hFy: 91, hBx: 6, hBy: 92, toeF: 0.45, toeB: 0.45 })
const P_PICK = pose({ hy: 39, lean: 0, fFx: 15, fBx: -15, hFx: 24, hFy: 56, hBx: 11, hBy: 57 })
const P_LOW = pose({ hy: 39, lean: 0, fFx: 16, fBx: -16, hFx: 22, hFy: 40, hBx: 4, hBy: 52 })
const BR = BALL_R * FIG_FT
// the ball where IN_HANDS puts it, for a hand at (x, y)
const heldX = x => x + IN_HANDS.x, heldY = y => y + IN_HANDS.y
// His body through the move. Returns true while the ball is in his shooting hand (drawn with it); false while
// it's loose, at MV.bx / MV.by (across from his hips, up from the floor, in his own units)
function movePose(g, t, P) {
  const a = t - CATCH
  copyPose(P_SET, P)
  if (a < 130) return true
  if (g.move === 'pump') {
    // the fake: up to the chin onto his toes, quick, and back down. He never leaves the floor
    if (a < 440) { mixPose(P_SET, P_PUMP, smooth01(prog(a, 130, 280)) * (1 - smooth01(prog(a, 300, 440))), P); return true }
    // the one dribble: down off his right hand as he goes, and back up into it
    if (a < 810) {
      frontRun((a - 440) / 50, P); P.hy -= 3
      const u = prog(a, 480, 760), drib = Math.abs(u * 2 - 1)
      P.hFx = 21; P.hFy = 36 + drib * 16; P.hBx = -15; P.hBy = 52
      if (a < 480 || a >= 760) {
        // (the push down and the catch: the ball between on top of the hand and under it)
        const f = a < 480 ? 1 - prog(a, 440, 480) : prog(a, 760, 810)
        MV.bx = lerp(P.hFx - 1, heldX(P.hFx), f); MV.by = lerp(P.hFy - BR - 1, heldY(P.hFy), f)
        return false
      }
      MV.bx = 19.5; MV.by = lerp(BR, P.hFy - BR - 1, drib)
      return false
    }
    // the stop: two feet, sitting into it, and up to the set
    mixPose(P_PICK, P_SET, smooth01(prog(a, 850, MOVE_MS.pump)), P)
    return true
  }
  // the in-and-out: right hand down to his right as he jabs that way, back up on top of it, then the crossover
  // through the floor in front of him and up into his left hand
  const k0 = [130, 210, 290, 365, 440], kx = [heldX(P_SET.hFx), 21, 20, 1, -20], ky = [heldY(P_SET.hFy), 28, 40, BR, 29]
  if (a < 440) {
    mixPose(P_SET, P_LOW, smooth01(prog(a, 130, 230)), P)
    let i = 0
    while (i < 3 && a >= k0[i + 1]) i++
    const f = prog(a, k0[i], k0[i + 1]), e = i === 1 ? 1 - (1 - f) * (1 - f) : i === 2 ? f * f : i === 3 ? 1 - (1 - f) * (1 - f) : f
    MV.bx = lerp(kx[i], kx[i + 1], f); MV.by = lerp(ky[i], ky[i + 1], e)
    // his right hand rides on top of it, then lets it go across; his left meets it
    if (a < 300) { P.hFx = MV.bx + 1; P.hFy = a < 150 ? lerp(P_SET.hFy, MV.by + BR + 1, prog(a, 130, 150)) : MV.by + BR + 1 }
    else { const l = smooth01(prog(a, 300, 380)); P.hFx = lerp(21, 24, l); P.hFy = lerp(40 + BR, 42, l) }
    const l = smooth01(prog(a, 300, 430)); P.hBx = lerp(P_SET.hBx, -21, l); P.hBy = lerp(P_SET.hBy, 26, l)
    // (the jab: his weight onto the right foot)
    const jab = Math.sin(Math.PI * prog(a, 130, 330)); P.hx += jab * 2.5; P.lean = jab * 0.06
    return false
  }
  // the step back: a hop off the front foot, the ball in his left hand coming up, landing wide behind the line
  const h = prog(a, 440, 650), land = prog(a, 650, 860)
  copyPose(P_LOW, P)
  P.j = Math.sin(Math.PI * h) * 7 * (h < 1 ? 1 : 0)
  P.fFx = lerp(16, 9, Math.sin(Math.PI * h)); P.fBx = -P.fFx
  P.hy = lerp(39, 42, h)
  const up = smooth01(prog(a, 440, 700)), gather = smooth01(land)
  MV.bx = lerp(lerp(-20, -6, up), heldX(P_SET.hFx), gather); MV.by = lerp(lerp(29, 52, up), heldY(P_SET.hFy), gather)
  P.hBx = MV.bx - 1; P.hBy = MV.by - BR - 1
  P.hFx = lerp(24, P_SET.hFx, gather); P.hFy = lerp(42, P_SET.hFy, gather)
  if (land > 0) mixPose(P, P_SET, gather, P)
  if (gather >= 1) return true
  return false
}
// The man on him through the move: the pump sends him flying past (he lands behind the shooter and turns to chase);
// the crossover sends his weight the wrong way
const GM = { Z: 0, xo: 0, mode: null, j: 0, back: false, f: 0 }
function guardMove(g, t, zs, dist) {
  const a = t - CATCH
  GM.Z = zs + dist; GM.xo = 0; GM.mode = null; GM.j = 0; GM.back = false; GM.f = 0
  if (g.move === 'pump' && a > 230) {
    const jb = prog(a, 230, 760)
    GM.Z = zs + lerp(dist, -0.7, easeInOut(jb)); GM.xo = 1.1 * jb
    if (jb < 1) { GM.mode = 'fly'; GM.j = Math.sin(Math.PI * jb) * 24; GM.f = jb }
    else {
      const r = easeInOut(prog(a, 860, 1600))
      GM.Z = zs - 0.7 + r * 3.2; GM.back = a > 820; GM.mode = r > 0 && r < 1 ? 'chase' : 'recover'
    }
  } else if (g.move === 'step' && a > 170) {
    GM.xo = 2.2 * easeInOut(prog(a, 180, 380)) - 1.1 * easeInOut(prog(a, 600, 1150))
    GM.mode = a < 760 ? 'bit' : null
  }
  return GM
}
// The jump is a real jump: quick off the floor, slow at the top, and the top of it is the middle of the green, so the
// body says when as well as the bar. Hold past it and he's coming down with the ball still in his hands.
// One motion, base to set point: the ball sinks to the hip as the knees go, then rides straight up the middle as the
// legs drive, past the chest and the chin and into the set point without ever stopping (a smooth curve through the
// keys, with no hold at any of them).
const P_LOAD = pose({ hy: 38, lean: 0, fFx: 14, fBx: -14, hFx: 21, hFy: 49, hBx: 9, hBy: 50 })
const P_DRIVE = pose({ hy: 44, lean: 0, fFx: 12, fBx: -12, hFx: 19, hFy: 70, hBx: 7, hBy: 71 })
const P_CHIN = pose({ hy: 47, lean: 0, fFx: 10, fBx: -10, hFx: 17, hFy: 88, hBx: 5, hBy: 89 })
const FLOW_T = [0, 0, 0, 0, 0], FLOW_P = [P_SET, P_LOAD, P_DRIVE, P_CHIN, null]
function flowPose(m, tau, S, out) {
  const c = m.c, t0 = Math.max(60, c - RISE), load = Math.min(230, t0 * 0.6)
  if (!m.flowLoad) { m.flowLoad = copyPose(P_LOAD, newPose()); m.flowLoad.hy += (31 - S.dip) * 0.5 }
  FLOW_T[0] = 0; FLOW_T[1] = load; FLOW_T[2] = Math.max(load + 40, t0 + 30); FLOW_T[3] = Math.max(FLOW_T[2] + 40, c - 165); FLOW_T[4] = Math.max(FLOW_T[3] + 40, c - 85)
  FLOW_P[1] = m.flowLoad; FLOW_P[4] = S.point
  const n = FLOW_T.length
  // there: a real set point, the ball over his head, settling a touch higher while he waits on the top of the jump
  if (tau >= FLOW_T[n - 1]) { copyPose(S.point, out); const z = smooth01(prog(tau, FLOW_T[n - 1], c)); out.hFy += z * 2; out.hBy += z * 2; return out }
  let i = 0
  while (i < n - 2 && tau >= FLOW_T[i + 1]) i++
  const ta = FLOW_T[i], tb = FLOW_T[i + 1], h = tb - ta, u = clamp((tau - ta) / h, 0, 1)
  const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2
  const A = FLOW_P[i], B = FLOW_P[i + 1]
  for (let q = 0; q < KEYS.length; q++) {
    const k = KEYS[q]
    // a tangent at each inner key from its neighbours (zero at the ends and at a turn, so nothing overshoots)
    const slope = j => {
      if (j <= 0 || j >= n - 1) return 0
      const d0 = (FLOW_P[j][k] - FLOW_P[j - 1][k]) / (FLOW_T[j] - FLOW_T[j - 1]), d1 = (FLOW_P[j + 1][k] - FLOW_P[j][k]) / (FLOW_T[j + 1] - FLOW_T[j])
      return d0 * d1 <= 0 ? 0 : (2 * d0 * d1) / (d0 + d1)
    }
    out[k] = h00 * A[k] + h10 * h * slope(i) + h01 * B[k] + h11 * h * slope(i + 1)
  }
  return out
}
function holdPose(m, tau, out, game) {
  const S = styleOf(m, game), c = m.c, t0 = Math.max(40, c - RISE)
  flowPose(m, tau, S, out)
  copyPose(out, m.lastHold ?? (m.lastHold = newPose()))
  const H = JUMP * S.H, e = (tau - c) / RISE
  out.j = Math.abs(e) < 1 ? H * (1 - e * e) : 0
  const up = clamp(out.j / (H * 0.5), 0, 1)
  legsInAir(out, up, 0)
  if (tau > c + RISE - 40) out.hy = lerp(out.hy, 43, prog(tau, c + RISE - 40, c + RISE + 60))
  const f = prog(tau, t0, c + RISE * 0.8)
  out.lean = S.tilt * f
  carryAcross(out, S.drift * f)
  return out
}
// off his hand: from here he's just falling, from wherever he was going
function flightOf(m, game) {
  if (m.airG != null) return
  const S = styleOf(m, game), H = JUMP * S.H, G = (2 * H) / (RISE * RISE), e = m.tau - m.c, up = Math.abs(e) < RISE
  m.airG = G
  m.airJ = up ? H * (1 - (e * e) / (RISE * RISE)) : 0
  m.airV = up ? -G * e : Math.sqrt(2 * G * H * 0.3)
  m.airT = (m.airV + Math.sqrt(m.airV * m.airV + 2 * G * m.airJ)) / G
  m.airF = prog(m.tau, Math.max(40, m.c - RISE), m.c + RISE * 0.8)
}
function afterPose(m, g, out) {
  const game = g.game, S = styleOf(m, game)
  flightOf(m, game)
  const age = g.t - m.relAt, inAir = age < m.airT
  const from = m.lastHold ?? S.point
  mixPose(from, S.point, smooth01(prog(age, 0, PUSH * 0.45)), out)
  mixPose(out, S.release, smooth01(prog(age, PUSH * 0.2, PUSH)), out)
  // the off hand's gone before the ball is, and falls away
  const off = prog(age, 150, 500)
  if (off > 0) { out.hBx = lerp(out.hBx, -21, off); out.hBy = lerp(out.hBy, 58, smooth01(off)) }
  out.j = inAir ? m.airJ + m.airV * age - 0.5 * m.airG * age * age : 0
  const up = clamp(out.j / (JUMP * 0.5), 0, 1), f = clamp(age / m.airT, 0, 1)
  legsInAir(out, up, S.kick * smooth01(prog(f, 0.05, 0.6)) * (1 - prog(f, 0.75, 1)))
  if (!inAir) {
    // down: he sits into it, feet where they came down, the hand still up
    const d = age - m.airT
    out.fFx = lerp(out.fFx, 12, prog(d, 0, 60)); out.fBx = lerp(out.fBx, -12, prog(d, 0, 60)); out.fFy = 0; out.fBy = 0
    out.hy = 47 - Math.exp(-d / 110) * Math.min(1, d / 40) * 11
  }
  out.lean = S.tilt * (m.airF + (1 - m.airF) * f) * (1 - prog(age, m.airT, m.airT + 360))
  carryAcross(out, S.drift * lerp(m.airF, 1, f))
  return out
}
// ── Free throws: their own motion. Three bounces, the ball to the belly, a breath. Then up to the chin, the knees bend,
// he rises onto his toes without ever leaving the floor, and the arm stays up in the air until it's over.
const F = { fFx: 12, fFy: 1.5, fBx: -11, fBy: 0 }
const F_SET = pose({ ...F, hy: 45, hFx: 18, hFy: 60, hBx: 5, hBy: 62 })
const F_CHIN = pose({ ...F, hy: 44, hFx: 17, hFy: 84, hBx: 5, hBy: 85 })
const F_DIP = pose({ ...F, hy: 35, hFx: 18, hFy: 82, hBx: 6, hBy: 83 })
const F_TOES = pose({ ...F, hy: 49, hFx: 13, hFy: 110, hBx: 0.5, hBy: 111 })
const F_REL = pose({ ...F, hy: 49, hFx: 12, hFy: 129, hBx: -18, hBy: 102 })
const F_AFTER = pose({ ...F, hy: 47, hFx: 12, hFy: 127, hBx: -20, hBy: 60 })
function ftHold(m, tau, out) {
  const c = m.c
  if (tau < c * 0.34) mixPose(F_SET, F_CHIN, smooth01(tau / (c * 0.34)), out)
  else if (tau < c * 0.68) mixPose(F_CHIN, F_DIP, smooth01(prog(tau, c * 0.34, c * 0.68)), out)
  else mixPose(F_DIP, F_TOES, smooth01(prog(tau, c * 0.68, c)), out)
  out.j = 3 * smooth01(prog(tau, c * 0.8, c))
  return out
}
function ftAfter(m, g, out) {
  const a = g.t - m.relAt
  mixPose(F_TOES, F_REL, smooth01(prog(a, 0, PUSH)), out)
  if (a > PUSH + 80) mixPose(out, F_AFTER, smooth01(prog(a, PUSH + 80, 520)), out)
  out.j = 3 * (1 - prog(a, 120, 300))
  if (m.landed) mixPose(out, F_SET, smooth01(prog(g.t, m.landAt + 420, m.landAt + 800)), out)
  return out
}
// ── After the shot ──
const R = (hFx, hFy, hBx, hBy, o = {}) => pose({ hy: 46, fFx: 12, fBx: -12, hFx, hFy, hBx, hBy, ...o })
export const R_UP = R(23, 134, -23, 134, { hy: 48 }), R_FLEX = R(31, 92, -31, 92), R_SMALL = R(27, 27, -18, 46, { lean: 0.05, hy: 42 })
const R_POINT = R(15, 120, -20, 48, { hy: 48 }), R_SHIMMY = R(29, 66, -29, 66, { hy: 43 }), R_WRIST = R(0, 66, -7, 70, { hy: 47 })
export const R_HEAD = R(10, 111, -10, 111), R_KNEES = R(15, 34, -15, 34, { hy: 36 }), R_WIDE = R(35, 74, -35, 74), R_HIPS = R(18, 53, -18, 53)
const R_FIST = R(19, 112, -20, 50, { hy: 45 })
const CELEBRATE = [R_UP, R_FLEX, R_POINT, R_SHIMMY, R_WRIST], DEJECT = [R_HEAD, R_KNEES, R_WIDE]
function celebrate(g, m, a, out) {
  const P = CELEBRATE[Math.floor(g.look * CELEBRATE.length)], b = a - 320
  g.celeb = P
  mixPose(out, P, smooth01(prog(b, 0, 130)), out)
  if (b <= 0) return
  if (P === R_UP) out.j = Math.abs(Math.sin(b / 150)) * 26
  else if (P === R_FLEX) { out.hy += Math.sin(b / 85) * 2.4; out.hFy += Math.sin(b / 85) * 5; out.hBy += Math.sin(b / 85) * 5 }
  else if (P === R_SMALL) { const w = Math.abs(Math.sin(b / 125)); out.hFy += w * 9 }
  else if (P === R_SHIMMY) { const w = Math.sin(b / 72); out.lean = w * 0.13; out.hx = w * 3; out.hFx += w * 5; out.hBx += w * 5 }
  // Dame Time (he has turned to the crowd): both forearms flat across his stomach, elbows out, the top hand tapping the wrist, two
  // quick taps and a beat, again. He stands tall and lets them see it
  else if (P === R_WRIST) {
    const k = b % 760, lift = k < 260 ? Math.sin(Math.PI * ((k % 130) / 130)) : 0
    out.hBy += lift * 3.5; out.hBx -= lift * 0.5
    out.hy += Math.sin(b / 380) * 0.6
  }
  else if (P === R_POINT) out.hFy += Math.sin(b / 160) * 2
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
const bowlOf = (G, c, game, cheer = 0) => ({ horizon: G.wallY, us: c.us, trim: c.trim, dim: game === 'free-throws' ? 0.42 : game === 'spot' ? 0.18 : 0, seed: game.length, cheer })
export function paintRoom(x, view, G, c, game) {
  paintBowl(x, view, bowlOf(G, c, game))
  const g = x.createLinearGradient(0, G.wallY, 0, view.h)
  g.addColorStop(0, '#a87543'); g.addColorStop(0.4, '#c8935a'); g.addColorStop(1, '#dbaa72')
  x.fillStyle = g; x.fillRect(0, G.wallY, view.w, view.h - G.wallY)
  // the roof lights lying on the polish
  const fh = view.h - G.wallY
  for (const lx of [62, 180, 298]) {
    x.save(); x.translate(lx, G.wallY + fh * 0.2); x.scale(1, 0.24)
    const r = x.createRadialGradient(0, 0, 4, 0, 0, 74)
    r.addColorStop(0, 'rgba(255,244,220,.2)'); r.addColorStop(1, 'rgba(255,244,220,0)')
    x.fillStyle = r; x.beginPath(); x.arc(0, 0, 74, 0, 6.3); x.fill(); x.restore()
  }
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
// A man at a distance is a picture of him, at one of a few sizes, so he costs a drawImage however he's moving.
const stamps = new Map()
const STAMP_SIZES = [0.62, 1, 1.5, 2]
function stampOf(view, key, s, paint) {
  const res = STAMP_SIZES.find(v => v >= s) ?? 2, id = `${key}|${res}|${view.px}`
  let c = stamps.get(id)
  if (!c && typeof document !== 'undefined') {
    if (stamps.size > 80) stamps.clear()
    c = document.createElement('canvas'); c.width = Math.ceil(110 * res * view.px); c.height = Math.ceil(152 * res * view.px)
    const x = c.getContext('2d')
    x.scale(view.px, view.px); x.translate(55 * res, 138 * res)
    paint(x, res)
    stamps.set(id, c)
  }
  return c
}
// (the names go on after everyone's down: x, y, name, scale)
const TAGS = []
// where the shooter's standing, on the floor: the camera says
const SHOOTER = { x: 0, z: 0 }
function shooterAt(cam, xs, zs) { SHOOTER.x = cam.cx + xs * cam.cos + zs * cam.sin; SHOOTER.z = cam.cz - xs * cam.sin + zs * cam.cos; return SHOOTER }
// [feet across, feet toward the rim] from the shooter: where each teammate ends up when it's gone in
const MOB = [[-5.2, 3.4], [5.6, 3.6], [-2.6, 6.2], [2.8, 6.4]]
function drawSetPlayer(ctx, view, cam, q, i, g, c, them, rel, M, xs, zs, landed, hit) {
  const crash = rel == null ? 0 : easeInOut(prog(g.t - rel, 160, 1100)) * q.cut
  const sway = landed != null ? 0 : Math.sin(g.t / 420 + i * 1.7) * 0.14
  const us = q.team === 'us'
  let x = q.x * (1 - crash) + sway, z = q.z * (1 - crash), P = us ? P_OFFBALL : P_DENY, id = us ? 'off' : 'deny', hop = 0
  if (landed != null) {
    const a = g.t - landed
    if (hit && us) {
      // they all go to him, arms up
      const man = q.man - 1, f = easeInOut(prog(a, 110 + man * 45, 820 + man * 45)), W = shooterAt(cam, xs, zs), mx = MOB[man][0], mz = MOB[man][1]
      x = lerp(x, W.x + mx * cam.cos + mz * cam.sin, f); z = lerp(z, W.z - mx * cam.sin + mz * cam.cos, f)
      if (a > 60 + man * 40) { P = R_UP; id = 'up'; hop = Math.abs(Math.sin(a / 130 + i)) * (f < 1 ? 3 : 15) }
    } else if (hit || us) { if (a > 180 + i * 30) { P = R_HIPS; id = 'hips' } }
    else if (a > 120 + i * 30) { P = R_UP; id = 'up'; hop = Math.abs(Math.sin(a / 150 + i)) * 9 }
  }
  project(cam, x, 0, z)
  if (PT.z < 3) return
  const k = PT.k, sx = PT.x, sy = PT.y, s = k / FIG_FT
  const col = us ? c.us : them.color, trim = us ? c.trim : them.trim
  const who = M ? (us ? M.us : M.them)[q.man] : null, num = who?.number ?? q.num, skin = who?.skin ?? SKINS[q.skin]
  const sp = stampOf(view, `${col}|${trim}|${num}|${skin}|${us}|${id}`, s, (v, res) => athleteFront(v, 0, 0, P, { jersey: col, trim, s: res, back: false, num, skin }))
  if (sp) ctx.drawImage(sp, sx - 55 * s, sy - 138 * s - hop * s, 110 * s, 152 * s)
  // (a man half off the side of the picture keeps his name to himself)
  // (drawn with him, so a man in front of him covers his name, as he covers the man)
  if (who && sx > 20 && sx < view.w - 20) meterTag(ctx, view, sx, sy, who.name, s)
}
// The free-throw line-up. Lane: defense on the blocks, offense next up, defense above; everyone side-on to us, looking
// across. Stood up on the first (the ball's dead whatever happens), sat down on the last one and in for the board as soon
// as it's off his hand. Behind the shooter past the arc, two teammates with their backs to us.
const L_STAND = pose({ hy: 46, lean: 0.06, fFx: 10, fBx: -9, hFx: 12, hFy: 48, hBx: 4, hBy: 46 })
const L_SET = pose({ hy: 39, lean: 0.34, fFx: 14, fBx: -12, hFx: 25, hFy: 54, hBx: 20, hBy: 50 })
const L_IN = pose({ hx: 3, hy: 42, lean: 0.2, fFx: 18, fBx: -13, hFx: 19, hFy: 92, hBx: 15, hBy: 90 })
const L_DOWN = pose({ hy: 45, lean: 0.14, fFx: 11, fBx: -10, hFx: 7, hFy: 52, hBx: 2, hBy: 50 })
const LANE_MEN = [[-3.8, 'them', 0, 3], [-9.8, 'us', 2, 3]].flatMap(([z, team, skin, man]) => [-1, 1].map(side => ({ z, team, skin: (skin + (side > 0 ? 2 : 0)) % 4, man: man + (side > 0 ? 1 : 0), side })))
const LANE_NEAR = -9.8, BEHIND_X = 4.7, BEHIND_Z = -22.5
function drawLaneMan(ctx, view, cam, q, g, c, them, M) {
  const m = g.rep, last = m.k === g.reps.length - 1, us = q.team === 'us'
  const rel = last && m.res && m.res.why !== 'clock' ? g.t - m.relAt : -1
  let P = last ? L_SET : L_STAND, id = last ? 's' : 'a', inn = 0
  if (rel >= 0) { inn = easeOut(prog(rel, 40, 340)); P = L_IN; id = 'i' }
  if (m.landed && m.res.in && last) { P = L_DOWN; id = 'd'; inn *= 1 - prog(g.t, m.landAt + 500, m.landAt + 1100) }
  project(cam, q.side * (LANE + 1.1 - inn * 1.5), 0, q.z)
  const s = PT.k / FIG_FT, sx = PT.x, sy = PT.y
  const who = M ? (us ? M.us : M.them)[q.man] : null, col = us ? c.us : them.color, trim = us ? c.trim : them.trim, num = who?.number ?? null, skin = who?.skin ?? SKINS[q.skin]
  const sp = stampOf(view, `L${id}|${col}|${trim}|${num}|${skin}|${q.side}`, s, (v, res) => athlete(v, 0, 0, P, { jersey: col, trim, s: res, flip: q.side > 0, skin, num }))
  if (sp) ctx.drawImage(sp, sx - 55 * s, sy - 138 * s, 110 * s, 152 * s)
}
function drawBehind(ctx, view, cam, side, g, c, M) {
  const man = side > 0 ? 2 : 1, who = M?.us[man], num = who?.number ?? (side > 0 ? 23 : 8), skin = who?.skin ?? SKINS[side > 0 ? 3 : 1]
  const q = g.reps[g.k > 0 && !g.rep.res ? g.k - 1 : g.k]
  let P = P_OFFBALL, id = 'o', hop = 0
  if (q.landed && g.t < q.landAt + 900 + (g.done ? 1500 : 0)) {
    const a = g.t - q.landAt
    if (q.res.in) { if (g.done?.hit) { P = R_UP; id = 'u'; hop = Math.abs(Math.sin(a / 140 + side)) * 9 } else { P = side > 0 ? R_FIST : P_OFFBALL; id = side > 0 ? 'f' : 'o' } }
    else if (a > 100) { P = R_HIPS; id = 'h' }
  }
  project(cam, side * BEHIND_X, 0, BEHIND_Z)
  const s = PT.k / FIG_FT, sx = PT.x, sy = PT.y
  const sp = stampOf(view, `B${id}|${c.us}|${c.trim}|${num}|${skin}`, s, (v, res) => athleteFront(v, 0, 0, P, { jersey: c.us, trim: c.trim, s: res, back: true, num, skin }))
  if (sp) ctx.drawImage(sp, sx - 55 * s, sy - 138 * s - hop * s, 110 * s, 152 * s)
}
// the man with the whistle, on the baseline side of the lane, the ball comes back through him
const REF_LOOK = { jersey: '#8c9196', trim: '#20262c', back: false, num: null, skin: SKINS[2] }
function paintRef(x, cam) {
  project(cam, LANE + 3.2, 0, 3.4)
  athleteFront(x, PT.x, PT.y, P_OFFBALL, { ...REF_LOOK, s: PT.k / FIG_FT })
}
// Sticks going behind the basket when the second one's coming up: every road free throw has them
function thundersticks(ctx, G, c, them, t, U) {
  const y1 = G.wallY - BOARD_H * U
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? them.trim : them.color; ctx.lineWidth = 3 * U; ctx.lineCap = 'round'; ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const bx = 74 + i * 30 + pass * 15 - (i > 3 ? -8 : 8), a = Math.sin(t / (150 + i * 9) + i * 2.1) * 0.62 + (i % 2 ? 0.1 : -0.1)
      ctx.moveTo(bx, y1 + 2 * U); ctx.lineTo(bx + Math.sin(a) * 19 * U, y1 + 2 * U - Math.cos(a) * 19 * U)
    }
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
}
// The names at the line: the two behind him and the nearest pair on the lane. The rest of the lane is
// shoulder to shoulder, with no floor to put one on. Not baked in: the vignette would dim them.
function lineTags(ctx, view, cam, M) {
  for (const side of [0, 1]) {
    const o = side ? 1 : -1
    project(cam, o * (LANE + 1.1), 0, LANE_NEAR); meterTag(ctx, view, PT.x, PT.y, M.us[3 + side].name, PT.k / FIG_FT)
    project(cam, o * BEHIND_X, 0, BEHIND_Z); meterTag(ctx, view, PT.x, PT.y, M.us[1 + side].name, PT.k / FIG_FT)
  }
}

const ORDER = []     // what's on the floor this frame, furthest first
const poseShot = easedState(), poseGuard = easedState()
const COACH_Z = -6.5, POSE_COACH = pose({ hy: 45, fFx: 11, fBx: -11, hFx: 15, hFy: 66, hBx: -15, hBy: 66 })
// how close the camera gets to the rim with a shot in the air
const PUSH_TO = { 'clutch-shot': 2.3, 'free-throws': 1.75, spot: 1.4 }
function pushOf(q, g, game) {
  if (!q.res || !q.kind || reduceMotion()) return 1
  const spot = game === 'spot', hold = spot ? 30 : game === 'free-throws' ? 260 : 520, back = spot ? 190 : 520
  const inn = easeInOut(prog(g.t - q.relAt, q.flyMs * 0.22, q.flyMs * 0.92))
  const out = q.landed ? easeInOut(prog(g.t, q.landAt + hold, q.landAt + hold + back)) : 0
  return 1 + (PUSH_TO[game] - 1) * inn * (1 - out)
}
// the strip of lights round the edge of the glass
function boardEdge(ctx, c, color) {
  ctx.beginPath()
  project(c, -3, 13, BOARD_Z); ctx.moveTo(PT.x, PT.y); project(c, 3, 13, BOARD_Z); ctx.lineTo(PT.x, PT.y); project(c, 3, 9.5, BOARD_Z); ctx.lineTo(PT.x, PT.y); project(c, -3, 9.5, BOARD_Z); ctx.lineTo(PT.x, PT.y); ctx.closePath()
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2.2, 0.24 * PT.k); ctx.lineJoin = 'round'; ctx.stroke()
}
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
  // the shot in the air, or the one just finished
  const last = g.reps[g.k > 0 && !m.res ? g.k - 1 : g.k]
  // The camera goes with the ball to the rim, stays for the net, and comes back for the people. Only the picture moves:
  // the meter and the clock hold still.
  const z = pushOf(last, g, game)
  project(cam, 0, RIM_Y - 0.5, 0)
  const rx = PT.x, ry = PT.y, w01 = (z - 1) / (PUSH_TO[game] - 1)
  const zx = clamp(lerp(rx, 180, w01) - rx * z, view.w - view.w * z, 0), zy = clamp(lerp(ry, view.h * 0.36, w01) - ry * z, view.h - view.h * z, 0)
  ctx.save()
  if (z > 1.001) { ctx.translate(zx, zy); ctx.scale(z, z) }
  // a fixed view is painted once. Spot-up pans, so its floor is drawn every frame on a plain room
  layer(ctx, view, spot ? `mg-spot-${c.us}-${c.trim}-${c.them}` : `mg-${game}-${c.us}-${c.trim}-${c.them}-${c.themTrim}-${Math.round(theta * 100)}-${M?.key ?? ''}`, x => {
    paintRoom(x, view, G, c, game)
    if (spot) return
    paintLines(x, cam, c.us)
    if (ft) paintRef(x, cam)
    paintHoop(x, cam, c.us)
  })
  if (!spot && !g.warm) { g.warm = true; warmCrowd(view, G, c, game) }
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
      ctx.fillStyle = done ? (q.res.in ? GOOD : BAD) : 'rgba(255,255,255,.1)'
      ctx.beginPath(); ctx.ellipse(PT.x, PT.y, 1.5 * PT.k, 0.55 * PT.k, 0, 0, Math.PI * 2); ctx.fill()
      if (!done) { ctx.strokeStyle = i === g.k ? GOLD : '#fff'; ctx.lineWidth = i === g.k ? 2.6 : 1.6; ctx.stroke() }
    }
  }
  // the building: up for it as the clock goes, up and jumping when it's gone in. A miss sits them down.
  const flew = m.res && m.res.why !== 'clock'
  const madeAll = g.done?.hit && m.landed
  const roar = clutch ? (madeAll ? 110 : !m.landed && g.clock < 1500 ? 250 : 0) : ft && madeAll ? 130 : 0
  if (roar && !lightFx() && !view.empty) {
    crowdUp(ctx, view, G, c, game, g.t, roar)
    if (ft) paintRef(ctx, cam)
    paintHoop(ctx, cam, c.us)
    if (madeAll && !reduceMotion()) camFlashes(ctx, view, G, g.t, clutch ? 16 : 9)
  }
  // (no thundersticks behind the basket: the owner didn't want them)
  // the lights round the board go red at zero
  if (clutch && g.hornAt != null && g.t - g.hornAt < 2600) boardEdge(ctx, cam, '#ff2a1f')
  // the board at the foot of the stands goes with it
  if (!spot && last.landed && last.res.in && last.kind) { const a = g.t - last.landAt; if (a < 1000) boardFlash(ctx, view, G, c.trim, (1 - a / 1000) * (Math.floor(a / 90) % 2 ? 0.34 : 0.62)) }
  // the rim jumps every time it's hit, the net shivers, and it whips when the ball goes through
  let dy = 0, netAge = null, jolt = null
  if (last.res && last.kind) {
    for (let i = 0; i < last.irons.length; i++) { const a = g.t - last.rimAt - last.irons[i]; if (a >= 0) jolt = a }
    if (jolt != null && jolt < 560) dy = Math.sin(jolt / 26) * Math.exp(-jolt / 140) * 3.2 * U
    if (last.res.in) netAge = g.t - last.landAt
    if (!last.kicked && g.t >= last.rimAt && last.kind !== 'air' && last.kind !== 'swish') { last.kicked = true; g.nudge.kick(g.t, last.kind === 'board' ? 2.6 : 1.6, 0, 1, 150) }
    if (clutch && madeAll && !g.kicked) { g.kicked = true; g.nudge.kick(g.t, 3.2, 0, 1, 220) }
  }
  // his pose: wherever the moment says the body should be, eased there, so nothing ever snaps
  const P = SP, airAge = m.relAt != null ? g.t - m.relAt : 0
  let carry = false, turn = 0, drib = -1, looseBall = false
  if (m.phase === 'hold') { if (ft) ftHold(m, T - m.at, P); else holdPose(m, T - m.at, P, game); carry = !(ft && m.dropY != null && T - m.at < 110) }
  else if (flew) {
    if (ft) ftAfter(m, g, P); else afterPose(m, g, P)
    carry = airAge < PUSH
    if (m.landed && m.k === g.reps.length - 1) {
      const a = g.t - m.landAt
      if (m.res.in) {
        if (clutch) { celebrate(g, m, a, P); turn = prog(a, 300, 460) }
        else if (madeAll) { mixPose(P, R_FIST, smooth01(prog(a, 300, 470)), P); P.hFy += Math.sin(a / 110) * 3 * prog(a, 300, 470) }
      } else if (a > 200) mixPose(P, (game === 'clutch-shot' ? R_KNEES : DEJECT[Math.floor((((g.look * 7919) + (m.relAt ?? 0) * 0.0137) % 1) * DEJECT.length)]), smooth01(prog(a, 200, 460)), P)
    }
  } else if (m.phase === 'fly') { mixPose(P_SET, R_HIPS, 0.3 * prog(g.t, m.relAt, m.relAt + 300), P); P.hFx = 26; P.hFy = 62; carry = true }   // out of time, the ball still in his hands
  else {
    const f = m.waitAt != null ? prog(g.t, m.waitAt, m.waitAt + 240) : 1
    if (ft) {
      const b = m.phase === 'ready' ? (g.t - m.shownAt) % (BOUNCE * 3 + 2400) : -1
      if (b >= 0 && b < BOUNCE * 3) {
        // the routine: bounce, bounce, bounce, the hand meeting it on the way up
        drib = Math.abs(((b % BOUNCE) / BOUNCE) * 2 - 1)
        copyPose(P_DRIB, P); P.hFy = 30 + drib * 12; P.hy = 39 + drib * 1.6
      } else {
        // the ball at his belly, a breath
        copyPose(F_SET, P); P.hy += Math.sin(g.t / 520) * 0.8; P.hFy += Math.sin(g.t / 520) * 1.4; P.hBy += Math.sin(g.t / 520) * 1.4
        carry = m.phase === 'ready' || m.k === 0; m.dropY = null
      }
    } else if (spot && m.waitAt != null && g.t < m.readyAt - 120) frontRun(g.t / 62, P)
    else {
      copyPose(P_SET, SQ)
      SQ.hy += Math.sin(g.t / 300) * 0.8
      if (g.k > 0) mixPose(P_LANDED, SQ, f, P); else copyPose(SQ, P)
    }
    if (!ft) carry = clutch ? g.t >= CATCH : (m.waitAt == null ? true : g.t >= m.readyAt - 20)
    if (clutch && g.move !== 'catch' && g.t >= CATCH && g.t < g.freeAt) { carry = movePose(g, g.t, P); looseBall = !carry }
  }
  const shown = easedPose(poseShot, P, g, CLK.dt, flew && airAge < 150 ? 9 : 34)
  // (the wrist over the top, and it stays over until he lets it down)
  shown.flick = flew ? smooth01(prog(airAge, PUSH * 0.6, PUSH + 70)) * (1 - prog(airAge, 900, 1100)) : 0

  // everything on the floor, far to near, so the ball goes behind whoever it's past
  ORDER.length = 0
  project(cam, 0, RIM_Y, 0)
  const zr = PT.z
  // (the move takes him across and in, or back: he's drawn where it put him, at that depth)
  const W = clutch ? moveSpot(g, g.t) : null, shX = xs + (W?.dx ?? 0), shZ = zs + (W?.dz ?? 0), shK = cam.F / shZ
  const shx = W ? cam.px + shX * shK : sx, shFloor = W ? cam.hz + cam.H * shK : floor, shS = W ? shK / FIG_FT : s
  ORDER.push({ z: zr + RIM_R, k: 'rimBack' }, { z: zr - RIM_R, k: 'rimFront' }, { z: shZ, k: 'shooter' })
  const rel = clutch && m.res && m.relAt != null ? m.relAt : null
  if (clutch) {
    for (let i = 0; i < CLUTCH_SET.length; i++) { const q = CLUTCH_SET[i]; project(cam, q.x, 0, q.z); ORDER.push({ z: PT.z, k: 'set', q, i }) }
    const f = prog(g.t, 0, CATCH + 1050), dist = lerp(15, 4, f * (2 - f) * 0.5 + f * 0.5)
    const gm = guardMove(g, g.t, zs, dist)
    ORDER.push({ z: gm.Z, k: 'guard', f, dist, Z: gm.Z, xo: gm.xo, mode: gm.mode, gj: gm.j, back: gm.back, gf: gm.f })
  }
  if (ft) {
    for (let i = 0; i < LANE_MEN.length; i++) { project(cam, LANE_MEN[i].side * LANE, 0, LANE_MEN[i].z); ORDER.push({ z: PT.z, k: 'lane', q: LANE_MEN[i] }) }
    project(cam, 0, 0, BEHIND_Z); ORDER.push({ z: PT.z, k: 'behind', side: -1 }, { z: PT.z, k: 'behind', side: 1 })
  }
  if (spot) { project(cam, 0, 0, COACH_Z); ORDER.push({ z: PT.z, k: 'coach' }) }
  for (let i = Math.max(0, g.k - 1); i <= g.k; i++) {
    const q = g.reps[i]
    if (!q.res || !q.kind) continue
    if (i < g.k && g.t > g.reps[g.k].readyAt - 300) continue
    const a = g.t - q.relAt - PUSH
    if (a < 0) continue   // (still on his fingers)
    if (!q.path) {
      // the ball leaves from where it was in his hands
      const bz = shZ + 0.8, k = cam.F / bz, X = (HANDS.bx - cam.px) / k, Y = cam.H - (HANDS.by - cam.hz) / k
      q.path = shotPath(q, cam.cx + X * cam.cos + bz * cam.sin, Y, cam.cz - X * cam.sin + bz * cam.cos)
    }
    const b = ballAt(q.path, a)
    const bx = b.x, by = b.y, bz = b.z
    q.bx = bx; q.by = by; q.bz = bz
    project(cam, bx, by, bz)
    ORDER.push({ z: PT.z, k: 'ball', bx, by, bz, a })
  }
  ORDER.sort((a, b) => b.z - a.z)
  TAGS.length = 0
  for (let i = 0; i < ORDER.length; i++) {
    const o = ORDER[i]
    if (o.k === 'rimBack') rimHalf(ctx, cam, false, dy)
    else if (o.k === 'rimFront') { netOf(ctx, cam, netAge, dy, jolt); rimHalf(ctx, cam, true, dy) }
    else if (o.k === 'ball') ballIn(ctx, cam, o.bx, o.by, o.bz, -o.a / 70)
    else if (o.k === 'set') drawSetPlayer(ctx, view, cam, o.q, o.i, g, c, them, rel, M, shX, shZ, m.landed ? m.landAt : null, !!m.res?.in)
    else if (o.k === 'lane') drawLaneMan(ctx, view, cam, o.q, g, c, them, M)
    else if (o.k === 'behind') drawBehind(ctx, view, cam, o.side, g, c, M)
    else if (o.k === 'coach') {
      project(cam, 0, 0, COACH_Z)
      const cs = PT.k / FIG_FT, cx = PT.x, cy = PT.y
      const glad = g.done?.hit && m.landed
      const sp = stampOf(view, glad ? 'coachUp' : 'coach', cs, (v, res) => athleteFront(v, 0, 0, glad ? R_UP : POSE_COACH, { jersey: '#3a424b', trim: '#d7dde2', s: res, back: false, num: null, skin: SKINS[2] }))
      if (sp && PT.z > 3) ctx.drawImage(sp, cx - 55 * cs, cy - 138 * cs, 110 * cs, 152 * cs)
    }
    else if (o.k === 'shooter') {
      // the pass in comes from a teammate up the floor, in front of him, and grows as it gets to his hands
      const passF = clutch && g.t < CATCH ? prog(g.t, 0, CATCH) : spot && m.phase === 'wait' && !carry && m.waitAt != null ? prog(g.t, m.readyAt - 300, m.readyAt - 20) : 0
      if (passF > 0) {
        // (Clutch: from the man at the elbow, chest high. Spot-up: from the coach under the rim)
        let ax, ay, ar
        if (clutch) { const q = CLUTCH_SET[0]; project(cam, q.x, 0, q.z); ax = PT.x; ay = PT.y - 4.4 * PT.k; ar = PT.k / G.ppf }
        else { project(cam, 0, 4.2, COACH_Z); ax = PT.x; ay = PT.y; ar = PT.k / G.ppf }
        basketball(ctx, lerp(ax, sx + 22 * s, passF), lerp(ay, floor - 70 * s, passF) - Math.sin(passF * Math.PI) * 14 * U, { r: BALL_R * G.ppf * lerp(ar, 1, passF), spin: g.t / 80 })
      }
      // (turning to the crowd: the width of him closes and opens again, and he's facing us)
      // the ball off his hand in the move: in front of him, so his body is over it
      if (looseBall) basketball(ctx, shx + MV.bx * shS, shFloor - (MV.by + shown.j) * shS, { r: BR * shS, spin: g.t / 60 })
      const tw = turn > 0 && turn < 1 ? Math.max(0.2, Math.abs(Math.cos(turn * Math.PI))) : 1
      if (tw < 1) { ctx.save(); ctx.translate(shx, 0); ctx.scale(tw, 1); ctx.translate(-shx, 0) }
      athleteFront(ctx, shx, shFloor, shown, { jersey: spot ? '#1d57a8' : c.us, trim: spot ? '#ffffff' : c.trim, s: shS, back: turn < 0.5, armsOver: g.celeb === R_WRIST && turn >= 0.5, elbowsOut: g.celeb === R_WRIST && turn >= 0.5, num: M?.us[0].number ?? 3, skin: M?.us[0].skin ?? SKINS[0], ball: carry ? IN_HANDS : null, spin: 0 })
      if (tw < 1) ctx.restore()
      if (M) TAGS.push(shx, shFloor, M.us[0].name, shS)
    }
    else if (o.k === 'guard') {
      // the man on him, closing out from the paint
      const Z = o.Z, k = cam.F / Z, Q = SQ
      const dx = cam.px + (lerp(xs, 0, Math.max(0, o.dist) / G.D) + 2.9 + o.xo) * k, fy = cam.hz + cam.H * k
      if (o.mode === 'fly') {
        // he bit: off his feet, both hands up, going right by
        copyPose(P_GUARD, Q); Q.hFx = 13; Q.hFy = 130; Q.hBx = -13; Q.hBy = 130; Q.j = o.gj
        Q.fFy = Math.sin(Math.PI * o.gf) * 6; Q.fBy = Math.sin(Math.PI * o.gf) * 9
      } else if (o.mode === 'chase') frontRun(g.t / 52, Q)
      else if (o.mode === 'recover') { copyPose(P_GUARD, Q); Q.hy = 44 }
      else if (o.mode === 'bit') { copyPose(P_GUARD, Q); Q.hy = 40; Q.hx = 2; Q.lean = 0.08; Q.fFx = 19; Q.fBx = -9 }
      else if (o.f < 1) { frontRun(g.t / 58, Q); Q.hFx = 24; Q.hFy = 74 + o.f * 44; Q.hBx = -24; Q.hBy = 74 + o.f * 44 }
      else {
        copyPose(P_GUARD, Q)
        if (g.move === 'pump') Q.hy = 44   // (behind him now: nothing to contest)
        else Q.j = m.phase === 'hold' ? 19 * prog(T - m.at, m.c - RISE, m.c) : m.phase === 'fly' ? Math.max(0, 19 * (1 - (g.t - m.relAt) / 340)) : 0
        if (m.phase === 'ready') Q.hy = 43 + Math.sin(g.t / 90) * 1.6
      }
      if (m.landed) {
        const a = g.t - m.landAt
        if (m.res.in) { mixPose(Q, a > 900 ? R_HIPS : R_KNEES, smooth01(prog(a, 60, 260)), Q); Q.j = 0 }   // (he gave it up: hands to his knees, then his hips)
        else { mixPose(Q, R_UP, smooth01(prog(a, 80, 260)), Q); Q.j = Math.abs(Math.sin(a / 150)) * 12 * prog(a, 80, 260) }
      }
      athleteFront(ctx, dx, fy, easedPose(poseGuard, Q, g, CLK.dt, 45), { jersey: them.color, trim: them.trim, s: k / FIG_FT, back: o.back, num: M?.them[0].number ?? 21, skin: M?.them[0].skin ?? SKINS[3] })
      if (M) TAGS.push(dx, fy, M.them[0].name, k / FIG_FT)
    }
  }
  if (ft) {
    const r = BALL_R * G.ppf
    if (drib >= 0) {
      // the dribble: the floor and back up to his hand
      const bx = HANDS.fx, by = lerp(floor - r, HANDS.fy + 4 * s, drib)
      basketball(ctx, bx, by, { r, spin: g.t / 200 })
      m.dropX = bx; m.dropY = by
    } else if (m.phase === 'hold' && !carry) {
      // pressed with the ball on its way: it comes up into his hands
      const f = prog(T - m.at, 0, 110)
      basketball(ctx, lerp(m.dropX, HANDS.fx - 3.4 * s, f), lerp(m.dropY, HANDS.fy - 7.8 * s, f), { r, spin: g.t / 200 })
    } else if (m.phase === 'wait' && m.k > 0) {
      // the ball coming back to him on a bounce, from wherever it got to
      const q = g.reps[m.k - 1], f = prog(g.t, m.waitAt, m.readyAt), W = shooterAt(cam, xs, zs), x0 = q.bx ?? 0, z0 = q.bz ?? 0, y0 = q.by ?? FL
      ballIn(ctx, cam, lerp(x0, W.x + 0.9, f), f < 0.5 ? lerp(y0, FL, (f * 2) ** 2) : lerp(FL, 3.8, (f - 0.5) * 2), lerp(z0, W.z + 0.4, f), -g.t / 90)
    }
  }
  // zero on the clock, and it's good
  if (clutch && madeAll && g.clock <= 0 && !g.confetti && !lightFx()) {
    g.confetti = true
    for (let i = 0; i < 3; i++) g.parts.burst('confetti', 60 + i * 120, 48 * U, g.t, { n: 12, s: 1.3, ang: Math.PI / 2, spread: 1.2, colors: [c.us, c.trim, '#ffffff'] })
  }
  g.parts.draw(ctx, g.t)
  ctx.restore()
  vignette(ctx, view)
  if (z < 1.02) {
    for (let i = 0; i < TAGS.length; i += 4) meterTag(ctx, view, TAGS[i], TAGS[i + 1], TAGS[i + 2], TAGS[i + 3])
    if (ft && M) lineTags(ctx, view, cam, M)
  }
  if (clutch) {
    const low = g.clock < 1000
    ctx.fillStyle = '#0c0f13'; rr(ctx, 284, 58 * U, 66, 44 * U, 4); ctx.fill()
    ctx.strokeStyle = g.hornAt != null ? '#ff2a1f' : '#3a4149'; ctx.lineWidth = 1.5; ctx.stroke()
    text(ctx, clockStr(g.clock), 317, 81 * U, { font: DISPLAY, size: (low ? 36 : 31) * U, color: low ? '#ff3b2f' : '#ffb21e' })
  } else {
    const q = last
    project(cam, 0, RIM_Y, 0)
    const wx = clamp(zx + PT.x * z, 120, 280), wy = Math.max(66 * U, zy + PT.y * z - 62 * U * Math.sqrt(z))
    if (q.res && q.landed && q.res.why !== 'clock') {
      const a = g.t - q.landAt
      if (a < 560 && !(g.done && q === m)) text(ctx, q.res.in ? (q.kind === 'swish' ? 'SWISH' : 'GOOD') : q.kind === 'air' ? 'AIRBALL' : q.rimOut ? 'IN AND OUT' : 'BRICK', wx, wy, { font: DISPLAY, size: 28 * U, color: q.res.in ? GOOD : BAD })
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
const Q_THROW = pose({ hx: 12, hy: 44, lean: 0.3, fFx: 38, fBx: -20, fBy: 1, hFx: 55, hFy: 98, hBx: 2, hBy: 62, toeB: 0.7 })
const Q_FOLLOW = pose({ hx: 16, hy: 44, lean: 0.5, fFx: 38, fBx: -16, fBy: 1, hFx: 46, hFy: 46, hBx: 2, hBy: 54, toeB: 1 })   // (the back foot stays down behind him, up on its toes: it doesn't kick up)
// After it's gone he comes up out of it, the back foot through under him, and shows what he thought of it: a fist
// for one he got all of, hands on his hips for one he didn't. The drill over, a finger at the roof for a cannon.
const Q_UP = pose({ hx: 17, hy: 47.5, lean: 0.05, fFx: 38, fBx: -3, hFx: 27, hFy: 49, hBx: 11, hBy: 48 })
const Q_PUMP = pose({ hx: 16, hy: 46.5, lean: 0, fFx: 38, fBx: -3, hFx: 36, hFy: 98, hBx: 9, hBy: 54 })
const Q_YES = pose({ hx: 17, hy: 45, lean: 0.1, fFx: 38, fBx: -3, hFx: 30, hFy: 73, hBx: 11, hBy: 51 })
const Q_HIPS = pose({ hx: 17, hy: 47.5, lean: 0.1, fFx: 38, fBx: -3, hFx: 25, hFy: 52, hBx: 12, hBy: 52 })
const Q_SKY = pose({ hx: 17, hy: 48, lean: -0.03, fFx: 38, fBx: -3, hFx: 47, hFy: 116, hBx: 9, hBy: 49 })   // (up at the board: that number's his)
const Q_SLOW = pose({ hy: 48, lean: 0.1, fFx: 13, fBx: -13, hFx: 15, hFy: 58, hBx: 19, hBy: 56 })   // (the clock ran out on him: the ball comes down)
const V_REL = 84          // ms after he lets go that the ball is out of his hand: the arm has to come through first
const NET_PITCH = 9
let veloG = null
function veloOf(view) {
  if (veloG && veloG.h === view.h) return veloG
  const h = view.h, U = h / 640, floor = h * 0.8, horizon = floor - 46 * U, padH = Math.round(56 * U)
  const truss = Math.round(96 + (horizon - padH - 96) * 0.24), netT = floor - 214 * U, netB = floor - 28 * U
  veloG = {
    h, U, s: 1.5 * U, floor, horizon, padH, truss, vy: floor - 200 * U, qx: 106, netX: 276, netW: 72, netT, netB,
    // the bullseye hung in the net: gold for the peak, the white ring round it for anything in the green
    tx: 276 + 36, ty: (netT + netB) / 2,
    // the radar board, hung off the truss between him and the net
    bx: 146, bw: 118, by: truss + 24 + 13 * U, bh: 64 * U,
    meterX: 13, meterW: 19, meterB: floor - 6 * U, meterL: 262 * U,
  }
  return veloG
}
const STEEL = '#d7dde2', STEEL_D = '#8c949b', BEAM = '#080c11'
// a cone on the turf: k its size
function drillCone(x, cx, cy, k) {
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(cx - 5 * k, cy + 2 * k, 11 * k, 2.5 * k)
  x.fillStyle = '#ff8a2a'; x.strokeStyle = INK; x.lineWidth = 0.9; x.lineJoin = 'round'
  x.beginPath(); x.moveTo(cx, cy - 10 * k); x.lineTo(cx + 5 * k, cy + 3 * k); x.lineTo(cx - 5 * k, cy + 3 * k); x.closePath(); x.fill(); x.stroke()
  x.fillStyle = '#f4efe6'; x.fillRect(cx - 2.6 * k, cy - 3.6 * k, 5.2 * k, 2 * k)
}
// The combine's building, the way the accuracy drill and the cones have it: dark steel, lamps off a truss, the padded
// wall with the one word on it, turf. Nobody in it but the staff. And what this drill needs: a line to throw from,
// a bag of balls, and the board the gun reads out on.
function paintVeloHall(x, view, G) {
  const { U, floor, qx, padH, truss } = G, w = view.w, h = view.h, H = Math.round(G.horizon), wallB = H - padH
  const wall = x.createLinearGradient(0, 40, 0, wallB)
  wall.addColorStop(0, '#0b1016'); wall.addColorStop(0.6, '#151d26'); wall.addColorStop(1, '#1d2832')
  x.fillStyle = wall; x.fillRect(0, 0, w, wallB)
  // the steel siding, sheet by sheet
  for (let i = 12; i < w; i += 44) { x.fillStyle = 'rgba(0,0,0,.26)'; x.fillRect(i, 0, 1.5, wallB); x.fillStyle = 'rgba(255,255,255,.022)'; x.fillRect(i + 1.5, 0, 1, wallB) }
  // the lamps' light down the wall, then the truss they hang from
  for (const lx of [98, 318]) {
    x.fillStyle = 'rgba(214,228,238,.04)'
    x.beginPath(); x.moveTo(lx - 14, truss + 37); x.lineTo(lx + 14, truss + 37); x.lineTo(lx + 66, wallB); x.lineTo(lx - 66, wallB); x.closePath(); x.fill()
  }
  x.fillStyle = BEAM; x.fillRect(0, truss, w, 5); x.fillRect(0, truss + 21, w, 3)
  x.strokeStyle = BEAM; x.lineWidth = 1.6; x.beginPath()
  for (let i = -6; i < w; i += 24) { x.moveTo(i, truss + 4); x.lineTo(i + 12, truss + 22); x.lineTo(i + 24, truss + 4) }
  x.stroke()
  for (const lx of [98, 318]) { x.fillStyle = BEAM; x.fillRect(lx - 1, truss + 24, 2, 7); x.fillRect(lx - 15, truss + 31, 30, 4); x.fillStyle = '#c9d3da'; x.fillRect(lx - 13, truss + 35, 26, 1.6) }
  // the board: two rods off the truss, a dark face, the mint line under it
  const { bx, bw, by, bh } = G
  x.fillStyle = BEAM; x.fillRect(bx + 18, truss + 24, 2.4, by - truss - 24); x.fillRect(bx + bw - 20.4, truss + 24, 2.4, by - truss - 24)
  x.fillStyle = '#04070a'; x.fillRect(bx - 3, by - 3, bw + 6, bh + 6)
  x.fillStyle = '#0a1015'; x.fillRect(bx, by, bw, bh)
  x.fillStyle = view.accent; x.fillRect(bx, by + bh - 3 * U, bw, 3 * U)
  text(x, 'RADAR', bx + 9, by + 11 * U, { font: LABEL, size: 12 * U, color: 'rgba(255,255,255,.62)', align: 'left', track: 1.2 })
  text(x, 'MPH', bx + bw - 9, by + bh - 15 * U, { font: LABEL, size: 14 * U, color: 'rgba(255,255,255,.62)', align: 'right', track: 1 })
  // the padded wall along the far side of the turf
  x.fillStyle = '#102a44'; x.fillRect(0, wallB, w, padH)
  x.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 30; i < w; i += 60) x.fillRect(i, wallB, 1.5, padH)
  x.fillStyle = '#2f7fb8'; x.fillRect(0, wallB, w, 4 * U); x.fillRect(0, H - 6 * U, w, 3 * U)
  for (const f of [0.25, 0.75]) text(x, 'COMBINE', w * f, wallB + padH / 2, { font: DISPLAY, size: 21 * U, color: 'rgba(255,255,255,.2)', track: 4 })
  // the turf: its grain tight at the far edge, the mowing in bands away from the camera, the far sideline
  const turf = x.createLinearGradient(0, H, 0, h)
  turf.addColorStop(0, '#1d6a3b'); turf.addColorStop(0.35, '#23793f'); turf.addColorStop(1, '#2a8a4a')
  x.fillStyle = turf; x.fillRect(0, H, w, h - H)
  const vx = 180, vy = H - 150 * U, at = (fx, y) => vx + (fx - vx) * (y - vy) / (floor - vy)
  x.fillStyle = 'rgba(0,0,0,.055)'
  for (let fx = -300; fx < w + 300; fx += 120) { x.beginPath(); x.moveTo(at(fx, H), H); x.lineTo(at(fx + 60, H), H); x.lineTo(at(fx + 60, h), h); x.lineTo(at(fx, h), h); x.closePath(); x.fill() }
  let y = H, gap = 1.4
  while (y < h) { x.fillStyle = 'rgba(0,0,0,.055)'; x.fillRect(0, y, w, 1); y += gap; gap *= 1.11 }
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, H, w, 2 * U)
  x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, H + 5 * U, w, 1.6 * U)
  // the line he throws from, a cone at each end of it
  const lx = qx + 64 * U
  x.fillStyle = 'rgba(255,255,255,.82)'
  x.beginPath(); x.moveTo(at(lx - 1, H + 5 * U), H + 5 * U); x.lineTo(at(lx + 1, H + 5 * U), H + 5 * U); x.lineTo(at(lx + 2.4, h), h); x.lineTo(at(lx - 2.4, h), h); x.closePath(); x.fill()
  drillCone(x, at(lx, H + 13 * U), H + 13 * U, 0.8 * U)
  drillCone(x, at(lx, floor + 62 * U), floor + 62 * U, 1.5 * U)
  // the bag of balls by his back foot: open, three in it
  const gx = qx - 34 * U, gy = floor + 34 * U
  x.fillStyle = 'rgba(0,18,6,.3)'; x.beginPath(); x.ellipse(gx + 2 * U, gy + 9 * U, 22 * U, 4.5 * U, 0, 0, Math.PI * 2); x.fill()
  x.fillStyle = '#0d1216'; x.strokeStyle = INK; x.lineWidth = 1.3; x.beginPath(); x.ellipse(gx, gy - 2 * U, 17 * U, 5 * U, 0, 0, Math.PI * 2); x.fill(); x.stroke()
  for (const [dx, dy, ang] of [[-8, -5, 0.5], [7, -6, -0.35], [-1, -9, 0.1]]) {
    x.save(); x.translate(gx + dx * U, gy + dy * U); x.rotate(ang)
    x.fillStyle = '#8f4f22'; x.strokeStyle = INK; x.lineWidth = 1.2; x.beginPath(); x.ellipse(0, 0, 8.6 * U, 5.2 * U, 0, 0, Math.PI * 2); x.fill(); x.stroke()
    x.fillStyle = '#f4efe6'; x.fillRect(-3.2 * U, -1.2 * U, 6.4 * U, 1.2 * U)
    x.restore()
  }
  x.fillStyle = '#27303a'; x.strokeStyle = INK; x.lineWidth = 1.3
  x.beginPath(); x.moveTo(gx - 17 * U, gy - 2 * U); x.quadraticCurveTo(gx - 18 * U, gy + 8 * U, gx - 13 * U, gy + 10 * U); x.lineTo(gx + 13 * U, gy + 10 * U); x.quadraticCurveTo(gx + 18 * U, gy + 8 * U, gx + 17 * U, gy - 2 * U); x.quadraticCurveTo(gx, gy + 5 * U, gx - 17 * U, gy - 2 * U); x.closePath(); x.fill(); x.stroke()
  x.fillStyle = view.accent; x.globalAlpha = 0.7; x.fillRect(gx - 12.5 * U, gy + 5.6 * U, 25 * U, 1.6 * U); x.globalAlpha = 1
  // where the net stands
  x.fillStyle = 'rgba(0,18,6,.3)'; x.beginPath(); x.ellipse(G.netX + G.netW / 2 + 4, floor + 3 * U, G.netW * 0.62, 6 * U, 0, 0, Math.PI * 2); x.fill()
  // the corners fall away
  const dim = x.createRadialGradient(w / 2, h * 0.56, h * 0.3, w / 2, h * 0.56, h * 0.74)
  dim.addColorStop(0, 'rgba(0,0,0,0)'); dim.addColorStop(1, 'rgba(0,0,0,.3)')
  x.fillStyle = dim; x.fillRect(0, 0, w, h)
}
// The net: a steel frame with some depth to it on two weighted feet, the mesh, and the bullseye hung in it. It's
// drawn each frame because it moves: a ball rocks it back on its feet. ring: the bullseye lit, 0 to 1
function drawVeloNet(ctx, G, rock, ring) {
  const { U, floor, netX: nx, netW: nw, netT: nt, netB: nb, tx, ty } = G
  ctx.save()
  if (rock) { ctx.translate(nx + nw / 2, floor); ctx.rotate(rock); ctx.translate(-(nx + nw / 2), -floor) }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const dx = 8, dy = -7 * U, fy = floor + 3 * U
  // the back of the frame, and the feet it stands on
  for (const [col, wd] of [[INK, 4.6 * U], [STEEL_D, 2.6 * U]]) {
    ctx.strokeStyle = col; ctx.lineWidth = wd
    ctx.strokeRect(nx + dx, nt + dy, nw, nb - nt)
    ctx.beginPath()
    for (const px of [nx, nx + nw]) { ctx.moveTo(px, nt); ctx.lineTo(px + dx, nt + dy); ctx.moveTo(px - 7, fy + 6 * U); ctx.lineTo(px + dx + 5, fy + dy - 4 * U); ctx.moveTo(px + dx, nb + dy); ctx.lineTo(px + dx, fy + dy) }
    ctx.stroke()
  }
  // the mesh
  ctx.fillStyle = 'rgba(4,8,12,.24)'; ctx.fillRect(nx, nt, nw, nb - nt)
  ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1
  ctx.beginPath()
  for (let px = nx; px <= nx + nw; px += NET_PITCH) { ctx.moveTo(px, nt); ctx.lineTo(px, nb) }
  for (let py = nt; py <= nb; py += NET_PITCH) { ctx.moveTo(nx, py); ctx.lineTo(nx + nw, py) }
  ctx.stroke()
  // the bullseye: a white ring, a gold one inside it
  ctx.fillStyle = 'rgba(6,12,18,.42)'; ctx.beginPath(); ctx.ellipse(tx, ty, 30, 38 * U, 0, 0, Math.PI * 2); ctx.fill()
  for (const [rx, ry, col, wd] of [[30, 38 * U, '#f4f6f8', 2.4 * U], [11.5, 14.5 * U, GOLD, 3.2 * U]]) {
    ctx.strokeStyle = INK; ctx.lineWidth = wd + 2; ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
  }
  if (ring > 0) { ctx.strokeStyle = `rgba(255,255,255,${(0.9 * ring).toFixed(2)})`; ctx.lineWidth = 3.2 * U; ctx.beginPath(); ctx.ellipse(tx, ty, 11.5, 14.5 * U, 0, 0, Math.PI * 2); ctx.stroke() }
  // the front of the frame, down to its feet, a sandbag on each
  for (const [col, wd] of [[INK, 5.6 * U], [STEEL, 3.4 * U]]) {
    ctx.strokeStyle = col; ctx.lineWidth = wd
    ctx.strokeRect(nx, nt, nw, nb - nt)
    ctx.beginPath(); ctx.moveTo(nx, nb); ctx.lineTo(nx, fy); ctx.moveTo(nx + nw, nb); ctx.lineTo(nx + nw, fy); ctx.stroke()
  }
  for (const px of [nx, nx + nw]) {
    ctx.fillStyle = '#1b2228'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.ellipse(px - 2, fy + 2 * U, 10, 4.6 * U, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.ellipse(px - 4, fy + 0.8 * U, 5, 1.4 * U, -0.25, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}
// The scout's radar gun, in his hand. aim: up and on the quarterback; otherwise down at his side
function radarGun(ctx, x, y, aim) {
  ctx.save(); ctx.translate(x, y); if (!aim) ctx.rotate(-1.25)
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(-11, -3.6, 12, 6.2, 1.6); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(-3.4, 1.4, 3.6, 5.6, 1); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#10151a'; ctx.fillRect(-13, -3, 2.6, 5)
  ctx.fillStyle = aim ? '#ff5a48' : '#7a2a22'; ctx.fillRect(-1.6, -2.2, 1.6, 1.6)
  ctx.restore()
}
// where his gun hand is for each thing the scout does, off his feet, in the figure's own units
const GUN_AT = { 'jab-l': [-14, -30], 'reach-r': [-8, -17], hips: [-15, -21] }, GUN_DOWN = [-7, -19.5]
// The QB in his shirt and shorts: the same long limbs and two flat tones as every other man, about seven heads tall.
const T_TORSO = 34
function throwerLeg(ctx, hx, hy, fx, fy, far, c, toe) {
  const skin = far ? c.skinD : c.skin, dark = far ? (c.skinDD ?? '#5a3723') : c.skinD
  const lift = toe * 6.5
  ik(hx, hy, fx - toe * 2.5, fy - 4.6 - lift, THIGH, SHIN, -1)
  const jx = IK.jx, jy = IK.jy, ex = IK.ex, ey = IK.ey
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, hx, hy, 8, jx, jy, 6.1, 1, 1); limb(ctx, jx, jy, 6.1, ex, ey, 4.1, 1.9, 0.2); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath(); limb(ctx, hx, hy, 7, jx, jy, 5.1, 1, 1); limb(ctx, jx, jy, 5.1, ex, ey, 3.1, 1.9, 0.2); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); limbShade(ctx, jx, jy, 5.1, ex, ey, 3.1, 1.9, 0.2); limbShade(ctx, hx, hy, 7, jx, jy, 5.1, 1, 1); ctx.fill()
  // a low white sock
  const sl = Math.hypot(ex - jx, ey - jy) || 1, nx = -(ey - jy) / sl, ny = (ex - jx) / sl, sa = lerp(jx, ex, 0.68), sb = lerp(jy, ey, 0.68)
  ctx.fillStyle = far ? c.sockD : c.sock; ctx.beginPath(); ctx.moveTo(sa + nx * 3.7, sb + ny * 3.7); ctx.lineTo(ex + nx * 3.1, ey + ny * 3.1); ctx.lineTo(ex - nx * 3.1, ey - ny * 3.1); ctx.lineTo(sa - nx * 3.7, sb - ny * 3.7); ctx.closePath(); ctx.fill()
  // the shoe, pivoting on the ball of the foot: heel, collar, toe, a white sole
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(toe * 0.62)
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
const QH = { x: 0, y: 0 }   // his throwing hand on the screen: the ball leaves from there
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
  // the same bare head as the men with the stopwatches: a jaw, an ear, a hairline
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(P.lean * 0.3); bareHead(ctx, 0, 0, 'side', c.skin); ctx.restore()
  // the ball sits in the throwing hand, which is the near one, over the far hand when both are on it
  armIK(sx - 1, ay, P.hFx, -P.hFy, UARM, FARM, -0.62, 0.78)
  const ex = IK.ex, ey = IK.ey, jl = Math.hypot(ex - IK.jx, ey - IK.jy) || 1, ux = (ex - IK.jx) / jl, uy = (ey - IK.jy) / jl
  QH.x = x + (ex + ux * 6.5) * s; QH.y = floorY + (ey + uy * 6.5) * s
  if (holding) airBall(ctx, ex + ux * 6.5, ey + uy * 6.5, { ang: Math.atan2(uy, ux) + 1.2, len: 18, spin: 0.08 })
  throwerArm(ctx, sx - 1, ay, P.hFx, -P.hFy, false, c)
  ctx.restore()
}
const Q_MID = pose({ hx: -3, hy: 48, lean: -0.05, fFx: 15, fBx: -14, hFx: -8, hFy: 80, hBx: 22, hBy: 80 })
const QP = newPose(), poseQB = easedState(), QB_WAS = newPose()
const LIE = [0.5, -0.45, 0.16]   // how each dead ball lies under the net
// What his body does once he's let go: a: ms since. The arm comes through, he watches it into the net out of his
// follow-through, then comes up out of it and reacts. (None of this is the rules: they were done when he let go.)
function veloAfter(g, m, a, P) {
  if (a < 40) return mixPose(Q_COIL, Q_OVER, easeIn(a / 40), P)
  if (a < 78) return mixPose(Q_OVER, Q_THROW, (a - 40) / 38, P)
  const seen = m.flyMs + 130
  if (a < seen) return mixPose(Q_THROW, Q_FOLLOW, easeOut(prog(a, 78, 290)), P)
  const b = a - seen, great = m.res.in && m.res.q > 0.86, up = easeInOut(prog(b, 0, 240))
  mixPose(Q_FOLLOW, great ? Q_PUMP : m.res.in ? Q_UP : Q_HIPS, up, P)
  P.fBy += Math.sin(up * Math.PI) * 6      // (the back foot steps through: it doesn't slide)
  if (great && b > 240) mixPose(Q_PUMP, Q_YES, easeOut(prog(b, 240, 380)), P)
  // the drill's over and the word's up
  if (g.done && g.stamp && g.t >= g.stamp.at) mixPose(P, !g.done.hit ? Q_HIPS : g.stamp.text === 'CANNON' ? Q_SKY : Q_PUMP, easeInOut(prog(g.t, g.stamp.at, g.stamp.at + 220)), P)
  return P
}
// the last rep with a reading on the board
function latestOf(g, key) {
  for (let i = g.k; i >= 0; i--) { const q = g.reps[i]; if (q.landed && q[key] != null) return q }
  return null
}
// The staff: the man on the gun, and a coach with the clipboard. Each look is one object, so its sprite is painted once
const STAFF_K = 1.62
const GUN_MAN = Object.fromEntries([null, 'jab-l', 'reach-r', 'hips'].map(p => [p, { ...SCOUT, skin: FOLK_SKIN[2], size: STAFF_K, ...(p ? { pose: p } : null) }]))
const COACH = { ...SCOUT, color: '#2a3540', skin: FOLK_SKIN[1], size: STAFF_K }, COACH_UP = { ...COACH, pose: 'reach-r' }
function drawVelo(ctx, g, view) {
  const G = veloOf(view), { U, s, floor, qx, tx, ty } = G
  const m = g.rep
  layer(ctx, view, 'mg-velo', x => paintVeloHall(x, view, G))
  const lastM = latestOf(g, 'mph'), lately = lastM && g.t - lastM.landAt < 1150 ? lastM : null
  const live = m.phase === 'hold' || (m.phase === 'fly' && !m.landed)
  const verdict = g.done && g.stamp && g.t >= g.stamp.at ? g.stamp.text : null
  const quiet = lightFx()
  // the gun takes a moment: it runs up to the reading, and the reading lands
  const read = lastM ? g.t - lastM.landAt : Infinity
  const shown = lastM ? Math.round(lerp(lastM.mph - 16, lastM.mph, easeOut(clamp(read / 230, 0, 1)))) : null
  const punch = read >= 230 && read < 400 ? 1 + 0.12 * (1 - (read - 230) / 170) : 1
  const numCol = g.done ? (g.done.hit ? GOOD : BAD) : live ? 'rgba(255,255,255,.5)' : lastM && read >= 230 && lastM.mph === g.best && g.k > 0 ? GOLD : '#fff'
  // the board on the wall has it too: it's what the room reads. A new best in the green and its frame goes gold
  ctx.save(); ctx.translate(G.bx + G.bw / 2, G.by + 37.5 * U); ctx.scale(punch, punch)
  text(ctx, shown != null ? String(shown) : '--', 0, 0, { font: DISPLAY, size: 38 * U, color: numCol })
  ctx.restore()
  if (lastM && lastM.res.in && lastM.mph === g.best && read >= 230 && read < 760) {
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.globalAlpha = 1 - (read - 230) / 530
    ctx.strokeRect(G.bx - 2, G.by - 2, G.bw + 4, G.bh + 4); ctx.globalAlpha = 1
  }
  // the staff. The coach has seen a few of these: his fist only goes up for a cannon with all three in the green. The man on the gun brings it
  // up as the arm comes back, and it's on the quarterback until the ball's in the net
  const sy = G.horizon + 7
  const allIn = verdict === 'CANNON' && g.reps.every(q => q.res?.in)
  standAt(ctx, 190, sy, allIn ? COACH_UP : COACH)
  clipboard(ctx, 190 + (allIn ? -8 : -7) * STAFF_K, sy + (allIn ? -17 : -19.5) * STAFF_K + 4, 1.25)
  const gp = live ? 'jab-l' : verdict ? (verdict === 'CANNON' ? 'reach-r' : verdict === 'MISTIMED' ? 'hips' : null) : lately ? (lately.res.q > 0.86 ? 'reach-r' : !lately.res.in ? 'hips' : null) : null
  standAt(ctx, 250, sy, GUN_MAN[gp])
  const ga = GUN_AT[gp] ?? GUN_DOWN
  radarGun(ctx, 250 + ga[0] * STAFF_K - (gp === 'jab-l' ? 2 : 0), sy + ga[1] * STAFF_K + (gp === 'jab-l' ? -1 : 4), gp === 'jab-l')
  // the net: the last ball into it rocks it back on its feet, and one in the gold lights the ring
  let rock = 0, ring = 0
  for (let i = g.k; i >= 0; i--) {
    const q = g.reps[i]
    if (!q.landed || !q.kind) continue
    const b = g.t - q.landAt, hard = (q.mph ?? 50) - 44
    if (b < 620 && !quiet) rock = (0.01 + hard * 0.0013) * Math.exp(-b / 150) * Math.cos(b / 46)
    if (q.res.in && q.res.q > 0.86 && b < 280) ring = 1 - b / 280
    break
  }
  drawVeloNet(ctx, G, rock, ring)
  const P = QP, needle = needleOf(g, m, smoothT(g))
  // (his front foot comes down in the turf as it goes)
  if (m.phase === 'fly' && m.res?.why !== 'clock' && g.t - m.relAt >= 90 && !m.fxPlant) {
    m.fxPlant = true
    g.vDirt ??= particles(22, 11)
    g.vDirt.burst('turf', qx + 34 * s, floor, g.t, { n: 7, s: 1.1, speed: 0.9, spread: 1.1, ang: -2.1 })
  }
  let holding = true, tau = 16
  if (m.phase === 'hold') {
    // the ball comes back at the shoulder, under the chin, then up behind his ear: never across his face
    const f = easeOut(prog(needle, 0, 0.85))
    if (f < 0.5) mixPose(Q_SET, Q_MID, f * 2, P); else mixPose(Q_MID, Q_COIL, (f - 0.5) * 2, P)
  }
  else if (m.phase === 'fly') {
    const a = g.t - m.relAt
    // (the hand has to come over the top, so through a point up above him on the way)
    if (m.res.why === 'clock') mixPose(Q_SET, Q_SLOW, easeOut(prog(a, 0, 220)), P)
    else { veloAfter(g, m, a, P); holding = a < V_REL; tau = a < 150 ? 9 : 24 }
    copyPose(P, QB_WAS)
  } else if (g.k > 0 && m.waitAt != null) {
    // back to his spot for the next ball: a step with each foot, not a slide
    const f = prog(g.t, m.waitAt, m.waitAt + 280)
    mixPose(QB_WAS, Q_SET, easeInOut(f), P)
    P.fFy += Math.sin(prog(f, 0, 0.6) * Math.PI) * 5; P.fBy += Math.sin(prog(f, 0.4, 1) * Math.PI) * 5
    holding = f > 0.55 || g.reps[g.k - 1].res?.why === 'clock'
    if (f >= 1) P.hy += Math.sin(g.t / 320) * 0.5
  }
  else { copyPose(Q_SET, P); P.hy += Math.sin(g.t / 320) * 0.5 }
  plainThrower(ctx, qx, floor, easedPose(poseQB, P, g, CLK.dt, tau), s * 0.88, holding)
  // the balls: the one in the air, the one in the net, and the ones lying under it
  for (let i = 0; i <= g.k; i++) {
    const q = g.reps[i]
    if (!q.res || !q.kind) continue
    const a = g.t - q.relAt - V_REL
    if (a < 0) continue
    if (q.sx == null) { q.sx = QH.x; q.sy = QH.y }
    const f = clamp(a / (q.flyMs - V_REL), 0, 1)
    const low = (1 - q.res.q) * 90 * U * (q.k % 2 ? -0.5 : 1)   // a bad one sails off the bullseye
    const ex = tx, ey = ty + low
    const hard = (q.mph ?? 50) - 44    // 0 a soft toss, 20 a cannon
    if (f < 1) {
      // a rope has next to no arc on it; a soft one has to be lifted there. A bad one wobbles: it's no spiral
      const arc = (3 + (20 - hard) * 0.5) * U
      const bx = lerp(q.sx, ex, f), by = lerp(q.sy, ey, f) - Math.sin(f * Math.PI) * arc
      const ang = Math.atan2(ey - q.sy - Math.cos(f * Math.PI) * Math.PI * arc, ex - q.sx), cs = Math.cos(ang), sn = Math.sin(ang)
      // the air it's coming through: the harder it's thrown the longer the line
      const tail = (14 + hard * 2.6) * U * Math.min(1, f * 5), from = 11 * U
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2 * U
      ctx.beginPath(); ctx.moveTo(bx - cs * from, by - sn * from); ctx.lineTo(bx - cs * (from + tail), by - sn * (from + tail))
      if (hard >= 8) for (const o of [-4.6 * U, 4.6 * U]) { ctx.moveTo(bx - cs * (from + 3) + sn * o, by - sn * (from + 3) - cs * o); ctx.lineTo(bx - cs * (from + 3 + tail * 0.55) + sn * o, by - sn * (from + 3 + tail * 0.55) - cs * o) }
      ctx.stroke(); ctx.lineCap = 'butt'
      airBall(ctx, bx, by, { ang: ang + Math.sin(a / 21) * (1 - q.res.q) * 0.5, len: 24 * U, spin: (a / 1000) * 9 })
      continue
    }
    const b = g.t - q.landAt
    // the frame it gets there: the picture takes it, the harder the more
    if (!q.fxHit) {
      q.fxHit = true
      g.nudge ??= nudge()
      g.nudge.kick(g.t, clamp(hard * 0.24, 0.8, 4.2), 1, 0, 170)
    }
    // into the net, then down it, and it's dead on the turf: each one lies a little along from the last
    const fall = easeIn(clamp((b - 170) / 420, 0, 1)), restX = ex - 14 + q.k * 15, restY = floor - 6 * U
    if (b >= 590 && !q.fxDead) { q.fxDead = true; g.vDirt?.burst('dust', restX, restY, g.t, { n: 3, s: 1.2, spread: 1.4 }) }
    const bx = lerp(ex + Math.min(9, b * 0.1), restX, fall), by = lerp(ey, restY, fall)
    if (fall > 0.6) { ctx.fillStyle = 'rgba(0,18,6,.3)'; ctx.beginPath(); ctx.ellipse(bx, floor + 0.5 * U, 11 * U, 2.6 * U, 0, 0, Math.PI * 2); ctx.fill() }
    airBall(ctx, bx, by, { ang: 0.08 + fall * LIE[q.k % 3], len: 24 * U, spin: 0.1 + q.k * 0.27 })
    // the net kicks back where it hit
    if (b < 300) {
      const k = Math.exp(-b / 90) * (7 + hard * 0.9)
      const gx = G.netX + Math.round((ex - G.netX) / NET_PITCH) * NET_PITCH, gy = G.netT + Math.round((ey - G.netT) / NET_PITCH) * NET_PITCH
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.4; ctx.beginPath()
      for (let j = -2; j <= 2; j++) {
        const yy = gy + j * NET_PITCH; ctx.moveTo(gx - 22, yy); ctx.quadraticCurveTo(gx + k, yy + j * 1.5, gx + 22, yy)
        const xx = gx + j * NET_PITCH; ctx.moveTo(xx, gy - 22); ctx.quadraticCurveTo(xx + k * (1 - Math.abs(j) / 3), gy, xx, gy + 22)
      }
      ctx.stroke()
    }
  }
  if (!reduceMotion() && !document.documentElement.classList.contains('low-power')) g.vDirt?.draw(ctx, g.t)
  // the radar on the slab every timed drill has, the three throws beside it
  clockSlab(ctx, view, '', '#fff')
  ctx.save(); ctx.translate(180, 69); ctx.scale(punch, punch)
  text(ctx, shown != null ? String(shown) : '--', 0, 0, { font: DISPLAY, size: 46, color: numCol })
  ctx.restore()
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
const V_RISE = pose({ hx: 2, hy: 48, lean: 0.06, fFx: 15, fFy: 17, fBx: -5, fBy: 2, hFx: 22, hFy: 122, hBx: 2, hBy: 66, toeF: 0.35, toeB: 0.9 })
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
// The combine's gym: a block wall, a pad along the foot of it, a maple floor, nobody in the seats. Staff, and a basket
// at its real height against the scale, so you can see how far over the rim the hand got.
const RIM_VANE = 36
function paintGym(x, view, G, c) {
  const U = G.U, H = G.horizon, w = view.w
  const wall = x.createLinearGradient(0, 0, 0, H)
  wall.addColorStop(0, '#20262d'); wall.addColorStop(1, '#343c45')
  x.fillStyle = wall; x.fillRect(0, 0, w, H)
  x.fillStyle = 'rgba(255,255,255,.035)'
  for (let i = 0, y = 48; y < H - 40 * U; i++, y += 26 * U) { x.fillRect(0, y, w, 1); for (let bx = (i % 2) * 26; bx < w; bx += 52) x.fillRect(bx, y, 1, 26 * U) }
  // the lights on the wall
  for (const lx of [70, 200, 330]) {
    x.save(); x.translate(lx, 48); x.scale(1, 2.2)
    const r = x.createRadialGradient(0, 0, 2, 0, 0, 74)
    r.addColorStop(0, 'rgba(255,248,232,.12)'); r.addColorStop(1, 'rgba(255,248,232,0)')
    x.fillStyle = r; x.beginPath(); x.arc(0, 0, 74, 0, 6.3); x.fill(); x.restore()
  }
  // the pad and its lettering
  x.fillStyle = '#17437e'; x.fillRect(0, H - 40 * U, w, 40 * U)
  x.fillStyle = '#2f70c8'; x.fillRect(0, H - 40 * U, w, 3 * U)
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, H - 2 * U, w, 2 * U)
  for (const f of [0.22, 0.72]) text(x, 'COMBINE', w * f, H - 18 * U, { font: DISPLAY, size: 19 * U, color: 'rgba(255,255,255,.34)', track: 4 })
  // the maple
  const fl = x.createLinearGradient(0, H, 0, view.h)
  fl.addColorStop(0, '#a87543'); fl.addColorStop(0.4, '#c8935a'); fl.addColorStop(1, '#dbaa72')
  x.fillStyle = fl; x.fillRect(0, H, w, view.h - H)
  x.strokeStyle = 'rgba(70,35,10,.13)'; x.lineWidth = 1; x.beginPath()
  for (let i = -24; i < 40; i++) { x.moveTo(180 + i * 16, H); x.lineTo(180 + i * 44, view.h) }
  x.stroke()
  // staff at the wall, clipboards out
  standAt(x, 118, H + 16 * U, { ...SCOUT, skin: FOLK_SKIN[1], size: 1.5 })
  standAt(x, 152, H + 14 * U, { ...SCOUT, color: '#1d57a8', skin: FOLK_SKIN[2], size: 1.45 })
  // the basket, off the wall, at ten feet on this scale
  const rimY = G.floor - G.reach - RIM_VANE * G.ppi, bx = 160
  x.strokeStyle = '#59626b'; x.lineWidth = 3 * U; x.beginPath(); x.moveTo(-4, rimY - 40 * U); x.lineTo(bx, rimY - 24 * U); x.moveTo(-4, rimY + 22 * U); x.lineTo(bx, rimY + 2 * U); x.stroke()
  x.fillStyle = 'rgba(205,225,235,.5)'; x.fillRect(bx, rimY - 40 * U, 4 * U, 54 * U)
  x.strokeStyle = '#f4f6f8'; x.lineWidth = 1.2; x.strokeRect(bx, rimY - 40 * U, 4 * U, 54 * U)
  x.strokeStyle = 'rgba(246,248,250,.9)'; x.lineWidth = 1; x.beginPath()
  const r0 = bx + 6 * U, r1 = r0 + 30 * U
  for (let i = 0; i <= 4; i++) { const px = lerp(r0, r1, i / 4), qx = lerp(r0 + 6 * U, r1 - 6 * U, (4 - i) / 4); x.moveTo(px, rimY); x.lineTo(qx, rimY + 21 * U) }
  x.stroke()
  x.strokeStyle = '#f26a1b'; x.lineWidth = 3.2 * U; x.lineCap = 'round'; x.beginPath(); x.moveTo(bx + 4 * U, rimY); x.lineTo(r1, rimY); x.stroke(); x.lineCap = 'butt'
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
  // the rim's height across the scale
  const ry = floor - reach - RIM_VANE * ppi
  x.fillStyle = '#f26a1b'; x.fillRect(pole - G.vaneL - 3, ry - 1 * U, G.vaneL + 3, 2 * U)
  text(x, 'RIM', pole + 10 * U, ry, { font: LABEL, size: 13 * U, color: '#f26a1b', align: 'left' })
}
function drawVert(ctx, g, view) {
  const G = vertOf(view), { U, s, floor, ax, pole, reach, ppi, vaneL } = G
  const c = view.colors, m = g.rep
  layer(ctx, view, `mg-vert-${c.us}-${c.trim}`, x => paintGym(x, view, G, c))
  // vanes: pushed through once, they stay through. Who pushed them, and when
  let top = 0
  let swatAt = 0
  for (let i = 0; i <= g.k; i++) { const q = g.reps[i]; if (q.inches != null && g.t >= q.landAt - 30) { if (q.inches > top) { top = q.inches; swatAt = q.landAt - 30 } } }
  // the vanes in two passes: plain, and every fifth in colour. The hand goes up through them, lowest first; each one
  // whips across and chatters on its pin
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? '#e8452f' : '#e7ebee'
    ctx.beginPath()
    for (let i = VANE_LO; i <= VANE_HI; i++) {
      if ((i % 5 === 0) !== !!pass) continue
      const y = floor - reach - i * ppi
      let side = -1 // to the left, into the jump
      let dyV = 0
      if (i <= top) {
        const start = swatAt - (top - i) * 5, a = g.t - start
        const f = a < 0 ? 0 : clamp(a / 90, 0, 1)
        side = -Math.cos(f * Math.PI)
        if (a > 90) { const d = a - 90; side *= 1 + Math.sin(d / 20) * Math.exp(-d / 150) * 0.14; dyV = Math.sin(d / 16 + i) * Math.exp(-d / 110) * 1.5 * U }
      }
      const len = vaneL * Math.abs(side)
      ctx.rect(side < 0 ? pole - len : pole + 7 * U, y - 1.6 * U + dyV, len, 3.2 * U)
    }
    ctx.fill()
  }
  // the best of them, in gold: the mark to beat
  if (top > 0 && g.t > swatAt + 120) {
    const y = floor - reach - Math.floor(top) * ppi
    ctx.fillStyle = GOLD; ctx.fillRect(pole + 7 * U, y - 2.2 * U, vaneL, 4.4 * U)
    text(ctx, String(top), pole + 7 * U + vaneL + 2, y, { font: DISPLAY, size: 13 * U, color: GOLD, align: 'left' })
  }
  // the athlete
  const P = VP, needle = needleOf(g, m, smoothT(g))
  let j = 0
  if (m.phase === 'hold') { mixPose(V_STAND, V_LOAD, easeOut(prog(needle, 0, 0.9)), P) }
  else if (m.phase === 'fly' && m.res.why !== 'clock') {
    const a = g.t - m.relAt, H = ((m.inches ?? 26) * ppi) / s, up = m.flyMs
    if (a < up) { mixPose(V_LOAD, V_RISE, easeOut(prog(a, 0, 180)), P); const f = a / up; j = H * (1 - (1 - f) * (1 - f)) }
    else if (a < up * 2) { copyPose(V_RISE, P); const f = (a - up) / up; j = H * (1 - f * f); P.hFx = lerp(P.hFx, 18, f); P.hFy = lerp(P.hFy, 100, f) }
    else {
      const f = prog(a, up * 2, up * 2 + 160), f2 = prog(a, up * 2 + 160, up * 2 + 480); mixPose(V_RISE, V_LAND, Math.min(1, f * 1.3), P); if (f2 > 0) mixPose(P, V_STAND, f2, P)
      // he comes down hard: the floor takes it, and so does the picture
      if (!m.kicked) { m.kicked = true; g.nudge.kick(g.t, 1.6 + (m.inches ?? 26) / 16, 0, 1, 180) }
    }
    P.j = j
  } else if (m.waitAt != null) copyPose(V_STAND, P)
  else { copyPose(V_STAND, P); P.hy += Math.sin(g.t / 320) * 0.5 }
  athlete(ctx, ax, floor, easedPose(poseV, P, g, CLK.dt, 28), { jersey: '#1d57a8', trim: '#ffffff', s, num: null, skin: SKINS[1] })
  // the number: large
  const latest = latestOf(g, 'inches')
  const y = 106 * U
  // (it lands: big for a moment, then its own size)
  const bump = latest ? 1 + 0.28 * (1 - easeOut(prog(g.t - latest.landAt, 0, 170))) : 1
  text(ctx, latest ? String(latest.inches) : '--', 52, y, { font: DISPLAY, size: 66 * U * bump, color: latest && latest.res.in ? '#fff' : latest ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.3)', align: 'left' })
  for (let i = 0; i < g.reps.length; i++) {
    const q = g.reps[i]
    text(ctx, q.landed && q.inches != null ? String(q.inches) : '–', 52 + i * 37, y + 52 * U, { font: DISPLAY, size: 20 * U, color: q.landed ? (q.inches === g.best ? GOLD : 'rgba(255,255,255,.7)') : 'rgba(255,255,255,.3)', align: 'left' })
  }
  drawPeakMeter(ctx, G, m, view, g, needle)
}

export function draw(ctx, g, view) {
  if (g.game === 'velo') return drawVelo(ctx, g, view)
  if (g.game === 'vert') return drawVert(ctx, g, view)
  drawCourtScene(ctx, g, view)
}
