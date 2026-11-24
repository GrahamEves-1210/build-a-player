// The Three-Point Contest, All-Star Saturday: five racks round the arc and two deep balls, 70 seconds.
//   Racks: left corner, left wing, top of the key, right wing, right corner. Four balls a point each and a money
//   ball (red, white and blue) for two on every rack; one rack, his choice (def.moneyRack), is all money balls.
//   Two deep balls, six feet behind the line, one between racks 2 and 3 and one between 3 and 4: three points each.
//   27 balls, 40 points the most there is.
// Every shot is spot-up's (lib/mg/meter.js): hold, the needle climbs one ease-in curve, let go in the green at the
// top of the jump. The green is wider for a better jump shooter, tighter from deep. The clock runs from the whistle
// while he picks up, shoots and runs rack to rack (that part's automatic, and it costs time): a quick, clean release
// is time saved. A ball counts if it's off his hand before the clock hits zero.
// def = { moneyRack 0-4 (default 4), round 'first' | 'final', label (his name on the board), toBeat (the final's score to beat) }
// done = outcome(points / 40, points >= (toBeat ?? 20), note, { points, made, of: 27, shot, racks, deep, timeLeft })
import { clamp, lerp, prog, easeOut, easeInOut, rngOf, outcome, layer, text, rr, circle, basketball, particles, nudge, reduceMotion, GOOD, BAD, GOLD, DISPLAY, LABEL } from './kit.js'
import { pose, mixPose, copyPose, newPose, easedState, easedPose, smoothT, CLK, paintRoom, paintLines, paintHoop, rimHalf, netOf, ballAt, athleteFront, frontRun, project, aimCam, PT, FIG_FT, RIM_R, RIM_Y, BALL_R, SKINS, HANDS, crowdUp, camFlashes, boardFlash, warmCrowd, lightFx, R_UP, R_HEAD, R_HIPS } from './meter.js'

export const how = {
  'three-contest': 'Five racks round the arc and two deep balls, 70 seconds on the clock. Hold, let go in the green at the top of the jump. One point a ball, two for a money ball, three from deep. The clock runs rack to rack: a quick release saves time.',
}

const GAME = 'three-contest'
const DEG = Math.PI / 180
export const CLOCK = 70000      // the contest clock
const START = 1100              // the whistle: the clock starts here
const PICK = 1200               // off the rack and up into his set, between balls on one rack
const FIRST = 700               // the first ball at a new spot, once he's there
const FLINCH = 90               // (a tap this short isn't a shot: the finger slipped)
const CURVE = 2.6               // spot-up's needle: (time / fill) ^ 2.6
const FILL = [640, 960]         // ms to the top of the meter: a quick, compact release
const DEEP_GREEN = 0.72         // the deep ball's green, against a rack ball's
const FLY = 860, PUSH = 85      // release to the rim; the ball still on his fingers
const STEP_FT = 0.95            // a ball's room on the rack: he shuffles along it one ball at a time
const RACK_OFF = 2.0            // the next ball sits this far to his right
// the half-width of the green, ms, by his Jump Shot grade (0-11). The invitees are A (9) and up, so 9, 10, 11 are
// spread out: a good shooter, a great one, the best there is
const HALF = [[0, 13], [3, 17], [6, 23], [9, 31], [10, 36], [11, 42]]
export function greenOf(v) {
  const x = clamp(v, 0, 11)
  for (let i = 1; i < HALF.length; i++) if (x <= HALF[i][0]) return lerp(HALF[i - 1][1], HALF[i][1], (x - HALF[i - 1][0]) / (HALF[i][0] - HALF[i - 1][0]))
  return HALF[HALF.length - 1][1]
}
// the spots, in shooting order. th: degrees round from the top of the key (left is negative), D: feet from the rim.
// A rack's th is where he takes its first ball: he shuffles right along it from there.
const SPOTS = [
  { kind: 'rack', r: 0, th: -80, D: 23.6 },
  { kind: 'rack', r: 1, th: -49, D: 24.4 },
  { kind: 'deep', d: 0, th: -22, D: 29.8 },
  { kind: 'rack', r: 2, th: -4.5, D: 24.4 },
  { kind: 'deep', d: 1, th: 22, D: 29.8 },
  { kind: 'rack', r: 3, th: 40, D: 24.4 },
  { kind: 'rack', r: 4, th: 71, D: 23.6 },
].map(s => ({ ...s, th: s.th * DEG, n: s.kind === 'rack' ? 5 : 1, dth: STEP_FT / s.D }))
// where he stands for ball k of a spot
const thOf = (s, k) => s.th + k * s.dth
const atTh = (th, D, out) => { out.x = D * Math.sin(th); out.z = -D * Math.cos(th); return out }
// the run from one spot to the next: from where he took its last ball, a jog round the arc
const P0 = { x: 0, z: 0 }, P1 = { x: 0, z: 0 }
const MOVES = SPOTS.slice(0, -1).map((s, i) => {
  atTh(thOf(s, s.n - 1), s.D, P0); atTh(SPOTS[i + 1].th, SPOTS[i + 1].D, P1)
  return Math.round(1100 + Math.hypot(P1.x - P0.x, P1.z - P0.z) * 130)
})

export function make({ v = 9, seed = 1, def = null } = {}) {
  const D0 = def ?? {}
  const moneyRack = Number.isInteger(D0.moneyRack) ? clamp(D0.moneyRack, 0, 4) : 4
  const final = D0.round === 'final'
  const toBeat = Number.isFinite(D0.toBeat) ? D0.toBeat : null
  const label = String(D0.label ?? '').trim().toUpperCase() || 'GUEST'
  const r = rngOf(seed)
  const look = rngOf(`${seed}|look`)   // (what things look like: never what happens)
  const half0 = greenOf(v)
  const pOf = (m, tau) => clamp(tau / m.fill, 0, 1) ** CURVE
  const balls = []
  SPOTS.forEach((s, si) => {
    for (let k = 0; k < s.n; k++) {
      const kind = s.kind === 'deep' ? 'deep' : s.r === moneyRack || k === 4 ? 'money' : 'reg'
      const half = half0 * (kind === 'deep' ? DEEP_GREEN : 1)
      // the deep ball's a longer motion: a touch more to the top of the meter
      const fill = lerp(FILL[0], FILL[1], r()) * (kind === 'deep' ? 1.08 : 1)
      const c = clamp(fill * lerp(0.64, 0.86, r()), 260 + half, fill - half - 25)
      const m = {
        i: balls.length, si, k, kind, pts: kind === 'deep' ? 3 : kind === 'money' ? 2 : 1, rack: s.kind === 'rack' ? s.r : null, deep: s.kind === 'deep' ? s.d : null,
        fill, c, half, curve: CURVE, peak: false, wob: false, lo: 0, hi: 0,
        phase: 'wait', pickAt: 0, readyAt: 0, shownAt: 0, at: 0, tau: 0, p: 0, res: null, relAt: null, rimAt: 0, landAt: 0, landed: false,
        kind2: null, irons: NO_IRON, ironN: 0, hang: 0, look: look(), hot: false,
      }
      m.lo = pOf(m, m.c - m.half); m.hi = pOf(m, m.c + m.half)
      balls.push(m)
    }
  })
  balls[0].pickAt = START - FIRST * 0.4; balls[0].readyAt = START + FIRST * 0.6
  const g = {
    t: 0, game: GAME, zones: 'none', fx: [], done: null, outro: 2300, stamp: null,
    balls, reps: balls, k: 0, rep: balls[0], last: null, held: false, v, half0,
    moneyRack, final, toBeat, label, clock: CLOCK, clockAt: null, horned: false, hornAt: null, whistled: false, tock: 5,
    move: null, streak: 0, points: 0, made: 0, pOf,
    hotAt: null, hotWord: null, roarAt: null, popAt: null, popBall: null,
    hud: { prompt: 'HOLD TO SHOOT', dots: null, hot: false },
    look: look(), parts: particles(48, Math.floor(look() * 1e6)), nudge: nudge(),
    tick(dt) {
      g.t += dt
      const t = g.t
      if (!g.whistled && t >= START) { g.whistled = true; g.fx.push('whistle', 'h:light') }
      if (!g.horned) {
        g.clock = g.clockAt != null ? g.clockAt : clamp(CLOCK - (t - START), 0, CLOCK)
        // the last five seconds, out loud
        if (g.clockAt == null && g.tock > 0 && g.clock <= g.tock * 1000) { g.fx.push('tick'); g.tock-- }
        if (g.clock <= 0) horn()
      }
      // every touch of the iron is heard, then the ball's decided
      for (const b of balls) {
        if (!b.res || b.landed) continue
        if (b.ironN < b.irons.length && t >= b.rimAt + b.irons[b.ironN]) { b.ironN++; g.fx.push('rimmiss', 'h:light') }
        if (t >= b.landAt) land(b)
      }
      const m = g.rep
      if (!g.horned && m && !m.res) {
        if (m.phase === 'wait' && t >= m.readyAt) {
          m.phase = 'ready'; m.shownAt = t
          g.hud.prompt = promptOf(m); g.hud.hot = m.kind !== 'reg'
          if (g.held) begin(m)
        }
        if (m.phase === 'hold') {
          m.tau = t - m.at; m.p = pOf(m, m.tau)
          if (m.tau >= m.fill) settle(m, m.fill, 'full')
        }
      }
      if (g.move && t >= g.move.until) g.move = null
      if (!g.done && balls.every(b => b.landed || b.phase === 'dead') && (g.horned || balls.every(b => b.res))) finish()
    },
    input(a) {
      if (g.done || g.horned) return
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
  function promptOf(m) {
    if (m.kind === 'deep') return 'DEEP BALL'
    if (m.kind === 'money') return m.rack === moneyRack ? (m.k === 0 ? 'MONEY RACK' : null) : 'MONEY BALL'
    return m.i === 0 ? 'HOLD TO SHOOT' : null
  }
  function begin(m) {
    m.phase = 'hold'; m.at = g.t; m.tau = 0; m.p = 0
    g.fx.push('h:light')
    if (m.i === 0) g.hud.prompt = 'LET GO IN THE GREEN'
  }
  function settle(m, tau, why) {
    m.phase = 'fly'
    const off = tau - m.c, a = Math.abs(off), inZone = a <= m.half
    const q = inZone ? lerp(1, 0.6, a / m.half) : clamp(0.5 - (0.5 * (a - m.half)) / (m.half * 1.2 + 60), 0, 0.5)
    m.res = { in: inZone, q, off, why: why ?? (inZone ? 'green' : off < 0 ? 'early' : 'late'), far: a > m.half + 70 }
    m.relAt = g.t; m.tau = tau; m.p = pOf(m, tau)
    m.hot = g.streak >= 3
    g.held = false
    g.hud.prompt = null; g.hud.hot = false
    g.fx.push('swoosh')
    // what it does: in the green it's down, the middle of it clean; outside it's on the iron, or worse the further off
    const way = a > m.half + 150 ? 'way' : null
    m.kind2 = !inZone ? (off < 0 ? (way ? 'air' : 'front') : (way ? 'board' : 'back')) : q >= 0.8 ? 'swish' : 'rattle'
    m.flyMs = FLY + (m.kind === 'deep' ? 120 : 0)
    m.rimAt = g.t + m.flyMs
    ironOf(m)
    m.landAt = m.rimAt + m.hang
    g.last = m
    // the clock stops on the last ball off his hand
    if (m.i === balls.length - 1) { g.clockAt = g.clock; return }
    const n = balls[m.i + 1]
    if (n.si === m.si) { n.pickAt = g.t; n.readyAt = g.t + PICK }
    else {
      g.move = { from: m.si, to: n.si, at: g.t + 180, until: g.t + 180 + MOVES[m.si] }
      n.pickAt = g.move.until; n.readyAt = g.move.until + FIRST
    }
    g.k = n.i; g.rep = n
  }
  function land(m) {
    m.landed = true
    const s = SPOTS[m.si]
    if (m.res.in) {
      g.points += m.pts; g.made++
      g.streak++
      g.fx.push('make', m.kind === 'reg' ? 'h:light' : 'h:medium')
      if (m.kind !== 'reg') { g.fx.push('pop'); g.popAt = g.t; g.popBall = m }
      if (g.streak === 3 || g.streak === 6) { g.hotAt = g.t; g.hotWord = g.streak >= 6 ? 'ON FIRE' : 'HEATING UP' }
    } else {
      g.streak = 0
      if (!m.irons.length) g.fx.push('h:light')
    }
    // five for five off one rack: the building comes up
    if (s.kind === 'rack' && m.k === 4 && balls.filter(b => b.si === m.si).every(b => b.res?.in)) {
      g.roarAt = g.t; g.roarRack = s.r
      g.fx.push('snd-roar', 'h:success')
    }
  }
  function horn() {
    g.horned = true; g.hornAt = g.t; g.clock = 0
    g.fx.push('snd-horn', 'h:heavy')
    g.hud.prompt = null; g.hud.hot = false
    // anything not off his hand by now doesn't count (the one in his hands stays there)
    const m = g.rep
    if (!m.res) m.heldAtHorn = m.phase === 'ready' || m.phase === 'hold' || (m.phase === 'wait' && g.t >= m.pickAt + (m.readyAt - m.pickAt) * TAKE)
    for (const b of balls) if (!b.res) { b.phase = 'dead'; b.landed = true }
  }
  function finish() {
    const racks = [0, 1, 2, 3, 4].map(ri => balls.filter(b => b.rack === ri).map(b => !!b.res?.in))
    const deep = [0, 1].map(d => !!balls.find(b => b.deep === d)?.res?.in)
    const points = g.points, made = g.made
    const timeLeft = g.clockAt != null ? Math.round(g.clockAt) / 1000 : 0
    const hit = points >= (toBeat ?? 20)
    const shot = balls.filter(b => b.res).length   // (off his hand before the horn)
    g.done = outcome(points / 40, hit, `${points} points, ${made} of 27`, { points, made, of: 27, shot, racks, deep, timeLeft })
    g.hud.prompt = null; g.hud.hot = false
    const lastIn = g.last?.res?.in
    // (at the horn, the horn first: the score lands a beat after it)
    const atHorn = g.hornAt != null && g.t - g.hornAt < 600
    g.stamp = { text: `${points} POINTS`, good: hit, at: g.t + (atHorn ? 750 : lastIn ? 420 : 260), y: null, size: 46 }
    g.outro = g.roarAt != null && g.t - g.roarAt < 200 ? 3000 : 2500
  }
  return g
}

// A shot on the iron (spot-up's): irons are the ms after it gets there that it touches iron; hang, until it's decided.
const NO_IRON = []
const TAKE = 0.5   // (the share of a pick when the ball comes off the rack into his hands)
function ironOf(m) {
  const near = Math.abs(m.res.off) <= m.half + 40
  m.irons = NO_IRON; m.hang = 0; m.bank = false; m.rimOut = false
  if (m.kind2 === 'rattle') {
    if (m.look > 0.88) { m.bank = true; m.hang = 190 }
    else if (m.res.q >= 0.7) { m.hang = 260; m.irons = [0, 150] }
    else { m.hang = 410; m.irons = [0, 170, 300] }
  } else if (m.kind2 === 'front' || m.kind2 === 'back') {
    m.rimOut = near
    m.hang = near ? 170 : 0
    m.irons = near ? [0, 170] : [0]
  }
}

// ── The ball's trip (spot-up's): parabolas in the court's feet, one after another ──
const BOARD_Z = 1.25, FL = BALL_R
function seg(list, dur, ax, ay, az, bx, by, bz, apex = 0, drop = false) { list.push({ dur, ax, ay, az, bx, by, bz, apex, drop }) }
function bounces(list, x, z, dx, dz) {
  seg(list, 400, x, FL, z, x + dx, FL, z + dz, 3.2)
  seg(list, 260, x + dx, FL, z + dz, x + dx * 1.5, FL, z + dz * 1.5, 1.1)
  seg(list, 160, x + dx * 1.5, FL, z + dz * 1.5, x + dx * 1.8, FL, z + dz * 1.8, 0.35)
  seg(list, 420, x + dx * 1.8, FL, z + dz * 1.8, x + dx * 2.4, FL, z + dz * 2.4, 0)
}
function shotPath(m, sx, sy, sz) {
  const list = [], F = m.flyMs - PUSH
  const D = Math.hypot(sx, sz), dx = sx / D, dz = sz / D, sideX = -dz, sideZ = dx
  const peak = RIM_Y + D * 0.26 * (m.kind2 === 'swish' ? 1.1 : m.kind2 === 'front' || m.kind2 === 'air' ? 0.84 : 1)
  const apex = yEnd => peak - (sy + yEnd) / 2
  const through = (x, y, z) => {
    seg(list, 130, x, y, z, x, RIM_Y - 1.5, z, 0, true)
    seg(list, 400, x, RIM_Y - 1.5, z, x + dx * 0.3, FL, z + dz * 0.3, 0, true)
    bounces(list, x + dx * 0.3, z + dz * 0.3, dx * 1.5 + sideX * 0.3, dz * 1.5 + sideZ * 0.3)
  }
  const R = RIM_R, Y = RIM_Y + BALL_R * 0.85
  if (m.kind2 === 'swish') { seg(list, F, sx, sy, sz, 0, RIM_Y + 0.1, 0, apex(RIM_Y)); through(0, RIM_Y + 0.1, 0) }
  else if (m.bank) {
    const bx = sideX * 0.45, by = 11.15, bz = BOARD_Z - BALL_R
    seg(list, F, sx, sy, sz, bx, by, bz, apex(by))
    seg(list, m.hang, bx, by, bz, 0, RIM_Y + 0.1, 0, 0, true)
    through(0, RIM_Y + 0.1, 0)
  } else if (m.kind2 === 'rattle') {
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
  } else if (m.kind2 === 'front') {
    const fx = dx * (R + 0.1), fz = dz * (R + 0.1), tx = dx * 8 + sideX * 1.5, tz = dz * 8 + sideZ * 1.5
    seg(list, F, sx, sy, sz, fx, RIM_Y + BALL_R, fz, apex(RIM_Y))
    if (m.rimOut) {
      const bx = -dx * R * 0.8, bz = -dz * R * 0.8
      seg(list, 170, fx, RIM_Y + BALL_R, fz, bx, Y, bz, 0.8)
      seg(list, 760, bx, Y, bz, tx, FL, tz, 2.6)
    } else seg(list, 700, fx, RIM_Y + BALL_R, fz, tx, FL, tz, 1.8)
    bounces(list, tx, tz, dx * 3, dz * 3)
  } else if (m.kind2 === 'back') {
    const fx = -dx * R * 0.75, fz = -dz * R * 0.75, tx = dx * 7 - sideX * 2, tz = dz * 7 - sideZ * 2
    seg(list, F, sx, sy, sz, fx, RIM_Y + BALL_R, fz, apex(RIM_Y))
    if (m.rimOut) {
      const bx = dx * R * 0.85, bz = dz * R * 0.85
      seg(list, 170, fx, RIM_Y + BALL_R, fz, bx, Y, bz, 0.7)
      seg(list, 700, bx, Y, bz, tx, FL, tz, 2.2)
    } else seg(list, 800, fx, RIM_Y + BALL_R, fz, tx, FL, tz, 3.4)
    bounces(list, tx, tz, dx * 3, dz * 3)
  } else if (m.kind2 === 'board') {
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
  list.total = list.reduce((s, q) => s + q.dur, 0)
  return list
}

// ── The picture ─────────────────────────────────────────────────────────────
// Spot-up's camera: tight over his shoulder, going round the arc with him, the rim as far away as the shot is.
// The building's a bowl round us: the stands turn as the camera does.
// (a touch lower than spot-up's, so the glass clears the scoreboard on the shortest screen)
const CAM = { ppf: 33, zs: 24, H: 12, px: 214, sx: 112, floor: 0.88 }
let G0 = null
function geoOf(view) {
  if (G0 && G0.h === view.h) return G0
  const h = view.h, U = h / 640, ppf = CAM.ppf * U, floor = h * CAM.floor, F = ppf * CAM.zs, hz = floor - CAM.H * ppf
  G0 = {
    h, U, ppf, floor, F, s: ppf / FIG_FT, sx: CAM.sx, xs: (CAM.sx - CAM.px) / ppf,
    wallY: hz + (CAM.H * F) / (CAM.zs + 24.4 + 22),
    cam: { F, H: CAM.H, px: CAM.px, hz, cos: 1, sin: 0, cx: 0, cz: -48 },
    meterX: 13, meterW: 19, meterB: floor - 6 * U, meterL: 250 * U,
  }
  return G0
}
// where he is right now: th and D on the arc (a run, the shuffle along a rack, or standing at his ball)
const WHERE = { th: 0, D: 24, run: false, f: 0 }
function whereOf(g, t) {
  const mv = g.move
  if (mv) {
    // (the beat after the last ball of a spot, before he sets off: still where he shot it. g.rep is already the next
    // spot's first ball, and reading it here snapped the camera, and the ball in the air, to the next rack and back)
    const a = SPOTS[mv.from], b = SPOTS[mv.to], f = t >= mv.at ? easeInOut(prog(t, mv.at, mv.until)) : 0
    WHERE.th = lerp(thOf(a, a.n - 1), b.th, f); WHERE.D = lerp(a.D, b.D, f); WHERE.run = t >= mv.at && f < 1; WHERE.f = f
    return WHERE
  }
  const m = g.rep, s = SPOTS[m.si]
  // a step along the rack to the next ball, as he goes to get it
  const k = m.k > 0 && m.phase === 'wait' ? lerp(m.k - 1, m.k, easeInOut(prog(t, m.pickAt, m.pickAt + (m.readyAt - m.pickAt) * TAKE * 0.9))) : m.k
  WHERE.th = thOf(s, k); WHERE.D = s.D; WHERE.run = false; WHERE.f = 1
  return WHERE
}

// the money ball: red, white and blue panels
function moneyBall(ctx, x, y, r, spin) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin)
  circle(ctx, 0, 0, r); ctx.fillStyle = '#f2f1ec'; ctx.fill()
  ctx.save(); ctx.clip()
  ctx.fillStyle = '#c8102e'; ctx.fillRect(-r, -r, r * 0.72, r * 2)
  ctx.fillStyle = '#1d428a'; ctx.fillRect(r * 0.28, -r, r * 0.72, r * 2)
  ctx.restore()
  ctx.strokeStyle = 'rgba(20,22,34,.78)'; ctx.lineWidth = Math.max(1, r * 0.13)
  circle(ctx, 0, 0, r); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke()
  ctx.beginPath(); ctx.arc(-r * 1.1, 0, r * 0.8, -0.8, 0.8); ctx.stroke()
  ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.8, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke()
  ctx.restore()
}
const ballArt = (ctx, x, y, r, spin, kind) => (kind === 'money' ? moneyBall(ctx, x, y, r, spin) : basketball(ctx, x, y, { r, spin }))
// a ball on the court, with its shadow
function courtBall(ctx, cam, x, y, z, spin, kind) {
  project(cam, x, 0, z)
  if (PT.z < 2) return
  const sx = PT.x, sy = PT.y, sk = PT.k
  ctx.fillStyle = `rgba(0,0,0,${y > 7 ? 0.14 : 0.26})`
  ctx.beginPath(); ctx.ellipse(sx, sy, BALL_R * sk * 1.05, BALL_R * sk * 0.42, 0, 0, Math.PI * 2); ctx.fill()
  project(cam, x, y, z)
  ballArt(ctx, PT.x, PT.y, BALL_R * PT.k, spin, kind)
}
// where ball k of a spot sits: on the rack to his right, a touch back off the line
const RB = { x: 0, z: 0 }
function rackSpot(s, k) { return atTh(thOf(s, k) + RACK_OFF / s.D, s.D + 0.3, RB) }
const RACK_Y = 2.95
// A rack: a steel cart, its rail at hip height, the balls in a row along it. The deep ball's a gold stand.
function drawRack(ctx, cam, g, si) {
  const s = SPOTS[si], balls = g.balls
  ctx.lineCap = 'round'
  if (s.kind === 'deep') {
    const p = rackSpot(s, 0), x = p.x, z = p.z
    project(cam, x, 0, z); if (PT.z < 3) return
    const fx = PT.x, fy = PT.y, k = PT.k
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(fx, fy, 0.9 * k, 0.32 * k, 0, 0, Math.PI * 2); ctx.fill()
    project(cam, x, RACK_Y, z)
    ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = Math.max(2, 0.34 * k); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(PT.x, PT.y); ctx.stroke()
    ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1.4, 0.22 * k); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(PT.x, PT.y); ctx.stroke()
    ctx.fillStyle = '#c9a43c'; ctx.beginPath(); ctx.ellipse(PT.x, PT.y, 0.55 * k, 0.2 * k, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a1f25'; rr(ctx, fx - 0.7 * k, fy - 1.35 * k, 1.4 * k, 0.8 * k, 0.12 * k); ctx.fill()
    if (k > 9) text(ctx, '3', fx, fy - 0.95 * k, { font: DISPLAY, size: Math.max(9, 0.62 * k), color: GOLD })
    const b = balls.find(q => q.si === si)
    if (!onRack(g, b)) return
    ballArt(ctx, PT.x, PT.y - BALL_R * k, BALL_R * k, 0, 'deep')
    return
  }
  // the rail and the legs: from before the first ball to past the last
  const ends = [-0.6, 4.6].map(k => { const p = rackSpot(s, k); return { x: p.x, z: p.z } })
  const leg = (p, y) => { project(cam, p.x, y, p.z); return { x: PT.x, y: PT.y, k: PT.k, z: PT.z } }
  const a0 = leg(ends[0], 0), a1 = leg(ends[0], RACK_Y), b0 = leg(ends[1], 0), b1 = leg(ends[1], RACK_Y)
  if (a0.z < 3 || b0.z < 3) return
  ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.beginPath(); ctx.moveTo(a0.x, a0.y + 0.2 * a0.k); ctx.lineTo(b0.x, b0.y + 0.2 * b0.k); ctx.lineTo(b0.x, b0.y - 0.2 * b0.k); ctx.lineTo(a0.x, a0.y - 0.2 * a0.k); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#1c2127'; ctx.lineWidth = Math.max(1.6, 0.2 * a1.k)
  ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke()
  ctx.strokeStyle = '#8f9aa3'; ctx.lineWidth = Math.max(1.6, 0.16 * a1.k)
  ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.stroke()
  ctx.strokeStyle = '#5d6770'; ctx.beginPath()
  const m0 = leg(ends[0], RACK_Y - 1), m1 = leg(ends[1], RACK_Y - 1)
  ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke()
  for (const w of [a0, b0]) { ctx.fillStyle = '#111518'; circle(ctx, w.x, w.y - 0.16 * w.k, Math.max(1.4, 0.17 * w.k)); ctx.fill() }
  // the balls, far one first
  const list = balls.filter(q => q.si === si)
  const near = (() => { project(cam, rackSpot(s, 0).x, 0, rackSpot(s, 0).z); const z0 = PT.z; project(cam, rackSpot(s, 4).x, 0, rackSpot(s, 4).z); return PT.z < z0 })()
  for (let j = 0; j < list.length; j++) {
    const b = list[near ? j : list.length - 1 - j]
    if (!onRack(g, b)) continue
    const p = rackSpot(s, b.k)
    project(cam, p.x, RACK_Y + BALL_R, p.z)
    if (PT.z < 3) continue
    ballArt(ctx, PT.x, PT.y, BALL_R * PT.k, b.look * 6, b.kind)
  }
}
// still on the rack: not his yet (he takes it partway into the pick), or never shot
function onRack(g, b) {
  if (!b || b.res) return false
  if (b.phase === 'dead') return !b.heldAtHorn
  if (b !== g.rep) return true
  if (b.phase !== 'wait') return false
  return g.t < b.pickAt + (b.readyAt - b.pickAt) * TAKE
}

// ── Him, from behind ──
const P_SET = pose({ hy: 45, fFx: 13, fBx: -13, hFx: 26, hFy: 62, hBx: 13, hBy: 62 })
const P_DIP = pose({ hy: 39, fFx: 14, fBx: -14, hFx: 22, hFy: 52, hBx: 10, hBy: 53 })
const P_GATHER = pose({ hy: 45, fFx: 11, fBx: -11, hFx: 20, hFy: 82, hBx: 8, hBy: 84 })
const AIR = { hy: 49, fFx: 8, fBx: -8, fFy: 1, fBy: 2 }
const P_POINT = pose({ ...AIR, hFx: 18, hFy: 97, hBx: 5.5, hBy: 98 })
const P_REL = pose({ ...AIR, hFx: 14, hFy: 121, hBx: -17, hBy: 99 })
const P_LANDED = pose({ hy: 46, fFx: 12, fBx: -12, hFx: 14, hFy: 124, hBx: -21, hBy: 62 })
// down to the rack on his right: the near hand on the ball
const P_REACH = pose({ hy: 37, lean: 0.12, fFx: 16, fBx: -12, hFx: 36, hFy: 50, hBx: 22, hBy: 54 })
const JUMP = 32, RISE = 250
const smooth01 = f => f * f * (3 - 2 * f)
const legsInAir = (out, air) => { out.fFx = lerp(out.fFx, 7, air); out.fBx = lerp(out.fBx, -7, air); out.fFy = air * 5; out.fBy = air * 8 }
function holdPose(m, tau, out) {
  const c = m.c, t0 = Math.max(60, c - RISE)
  if (tau < t0 * 0.5) mixPose(P_SET, P_DIP, smooth01(tau / (t0 * 0.5)), out)
  else if (tau < t0) mixPose(P_DIP, P_GATHER, smooth01((tau - t0 * 0.5) / (t0 * 0.5)), out)
  else mixPose(P_GATHER, P_POINT, smooth01(prog(tau, t0, c - 40)), out)
  // the top of the jump is the middle of the green
  const e = (tau - c) / RISE
  out.j = Math.abs(e) < 1 ? JUMP * (1 - e * e) : 0
  legsInAir(out, clamp(out.j / (JUMP * 0.5), 0, 1))
  return out
}
function afterPose(m, t, out) {
  const age = t - m.relAt, e = (m.tau - m.c) / RISE
  const j0 = Math.abs(e) < 1 ? JUMP * (1 - e * e) : 0, G = (2 * JUMP) / (RISE * RISE), v0 = Math.abs(e) < 1 ? -G * (m.tau - m.c) : 0
  const airT = (v0 + Math.sqrt(v0 * v0 + 2 * G * j0)) / G
  mixPose(P_POINT, P_REL, smooth01(prog(age, 0, PUSH)), out)
  const off = prog(age, 150, 500)
  if (off > 0) { out.hBx = lerp(out.hBx, -21, off); out.hBy = lerp(out.hBy, 58, smooth01(off)) }
  const inAir = age < airT
  out.j = inAir ? Math.max(0, j0 + v0 * age - 0.5 * G * age * age) : 0
  legsInAir(out, clamp(out.j / (JUMP * 0.5), 0, 1))
  if (!inAir) {
    const d = age - airT
    out.fFx = lerp(out.fFx, 12, prog(d, 0, 60)); out.fBx = lerp(out.fBx, -12, prog(d, 0, 60)); out.fFy = 0; out.fBy = 0
    out.hy = 47 - Math.exp(-d / 110) * Math.min(1, d / 40) * 10
  }
  return out
}
const P_STAND = pose({ hy: 45, fFx: 12, fBx: -12, hFx: 17, hFy: 43, hBx: -17, hBy: 43 })
const SP = newPose(), EASE = easedState()
// what he's doing: the pose goes in out, and back comes the ball in his hands (or null)
const BASE = newPose()
function bodyOf(g, t, T, out, live = false) {
  const m = g.rep, L = g.last, since = L ? t - L.relAt : Infinity
  if (g.done && !live) {
    // it's over: the arms go up, or the hands go to his head or his hips, from wherever he was when it ended (the
    // follow-through held on the last ball, standing at the horn) so nothing snaps
    const at = Math.max(L?.landed ? L.landAt + 300 : 0, g.hornAt != null ? g.hornAt + 750 : 0)
    if (t > at) { bodyOf(g, at, at, BASE, true); mixPose(BASE, g.done.hit ? R_UP : g.look < 0.5 ? R_HEAD : R_HIPS, smooth01(prog(t, at, at + 260)), out); return null }
  }
  if (g.move && t >= g.move.at && t < g.move.until) { frontRun(t / 62, out); return null }
  if (m.phase === 'hold') { holdPose(m, T - m.at, out); return m }
  if (m.res || m.phase === 'dead') {
    // (the last ball of the round: he holds his follow-through while it's in the air, never drops it and puts it back)
    const holdIt = L && L === m && m.i === g.balls.length - 1
    if (L && (since < 1400 || holdIt)) { afterPose(L, t, out); return since < PUSH ? L : null }
    copyPose(m.heldAtHorn ? P_SET : P_STAND, out)
    return m.heldAtHorn ? m : null
  }
  if (m.phase === 'wait') {
    const P = m.readyAt - m.pickAt, take = m.pickAt + P * TAKE
    if (t < m.pickAt) {
      if (L && since < 1400) { afterPose(L, t, out); return since < PUSH ? L : null }
      copyPose(P_STAND, out); out.hy += Math.sin(t / 340) * 0.7
      return null
    }
    if (t < take) {
      // the follow-through, then down to the rack for the next one
      if (L && L.si === m.si) { afterPose(L, t, out); mixPose(out, P_REACH, smooth01(prog(t, L.relAt + 200, take)), out); return since < PUSH ? L : null }
      mixPose(P_STAND, P_REACH, smooth01(prog(t, m.pickAt, take)), out)
      return null
    }
    mixPose(P_REACH, P_SET, smooth01(prog(t, take, m.pickAt + P * 0.85)), out)
    return m
  }
  copyPose(P_SET, out); out.hy += Math.sin(t / 300) * 0.8
  return m
}
// the ball in his hands, in the same art as the rack's
const HELD = { x: -3.4, y: 7.8, r: BALL_R * FIG_FT, kind: 'reg', draw: (ctx, x, y, r, spin) => ballArt(ctx, x, y, r, spin, HELD.kind) }

// the strip of lights round the glass: red at the horn
function boardEdge(ctx, c, color) {
  ctx.beginPath()
  const pts = [[-3, 13], [3, 13], [3, 9.5], [-3, 9.5]]
  pts.forEach((p, i) => { project(c, p[0], p[1], BOARD_Z); if (i) ctx.lineTo(PT.x, PT.y); else ctx.moveTo(PT.x, PT.y) })
  ctx.closePath()
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2.2, 0.24 * PT.k); ctx.lineJoin = 'round'; ctx.stroke()
}
// the stands, turned with the camera (two copies of the one painted bowl, wrapping round)
function standsOff(view, G, psi) {
  const slide = -psi * G.F * 0.55
  return ((slide % view.w) + view.w) % view.w
}
const ORDER = []
const pop = (age, ms = 110) => (lightFx() ? 1 : 1 + 0.35 * (1 - easeOut(clamp(age / ms, 0, 1))))

// A perfect thumb for the how-to-play card (MgDemo): on the button as each ball comes up, off it in the middle of the
// green. The demo's rep is the first rack, and it plays out a moment before it starts again.
export function pilot(g) {
  let seen = null, down = false, upAt = 0
  return () => {
    const m = g.rep
    if (!m || g.done || g.horned) return
    if (seen !== m && (m.phase === 'wait' || m.phase === 'ready')) { seen = m; upAt = 0; if (down) { down = false; return [{ kind: 'up', zone: null, x: 180, y: 400 }] } }
    if (seen === m && !down && m.phase === 'ready') { down = true; return [{ kind: 'down', zone: null, x: 180, y: 400 }] }
    if (seen === m && m.phase === 'hold' && down) {
      if (!upAt) upAt = m.at + Math.max(95, m.c)
      if (g.t >= upAt) { down = false; return [{ kind: 'up', zone: null, x: 180, y: 400 }] }
    }
  }
}
export const demoRep = g => (g.balls.slice(0, 5).every(b => b.landed) ? true : null)
export const demoAfter = 1400

export function draw(ctx, g, view) {
  const G = geoOf(view), { U, cam } = G, c = view.colors, t = g.t
  const T = smoothT(g)
  const W = whereOf(g, t)
  aimCam(cam, W.th, W.D, G.xs, CAM.zs)
  const psi = Math.atan2(cam.sin, cam.cos), off = standsOff(view, G, psi)
  // the building
  const key = `3pt-room-${c.us}-${c.trim}`
  for (const o of [off - view.w, off]) { ctx.save(); ctx.translate(o, 0); layer(ctx, view, key, x => paintRoom(x, view, G, c, GAME)); ctx.restore() }
  if (!g.warm) { g.warm = true; warmCrowd(view, G, c, GAME) }
  // five for five: on their feet, phones up, the board in his colours
  const roar = g.roarAt != null ? t - g.roarAt : -1
  const done = g.done && g.last?.landed ? t - g.last.landAt : -1
  if (((roar >= 0 && roar < 1700) || (done >= 0 && g.done.hit)) && !lightFx() && !view.empty) {
    for (const o of [off - view.w, off]) { ctx.save(); ctx.translate(o, 0); crowdUp(ctx, view, G, c, GAME, t, 110); ctx.restore() }
    if (!reduceMotion()) camFlashes(ctx, view, G, t, 14)
  }
  if (roar >= 0 && roar < 1000) boardFlash(ctx, view, G, c.trim, (1 - roar / 1000) * (Math.floor(roar / 90) % 2 ? 0.34 : 0.62))
  paintLines(ctx, cam, c.us)
  paintHoop(ctx, cam, c.us)
  if (g.hornAt != null && t - g.hornAt < 2600) boardEdge(ctx, cam, '#ff2a1f')

  // the rim jumps when it's hit, the net whips when one goes through: whichever ball was there last
  let dy = 0, netAge = null, jolt = null
  for (const b of g.balls) {
    if (!b.res || t < b.rimAt || t - b.rimAt > 1500) continue
    for (let i = 0; i < b.irons.length; i++) { const a = t - b.rimAt - b.irons[i]; if (a >= 0 && (jolt == null || a < jolt)) jolt = a }
    if (b.res.in && t >= b.landAt && (netAge == null || t - b.landAt < netAge)) netAge = t - b.landAt
    if (!b.kicked && b.kind2 !== 'air' && b.kind2 !== 'swish') { b.kicked = true; g.nudge.kick(t, b.kind2 === 'board' ? 2.4 : 1.4, 0, 1, 150) }
  }
  if (jolt != null && jolt < 560) dy = Math.sin(jolt / 26) * Math.exp(-jolt / 140) * 3.2 * U

  // everything on the floor, far to near
  ORDER.length = 0
  project(cam, 0, RIM_Y, 0)
  const zr = PT.z
  ORDER.push({ z: zr + RIM_R, k: 'rimBack' }, { z: zr - RIM_R, k: 'rimFront' }, { z: CAM.zs, k: 'him' })
  for (let si = 0; si < SPOTS.length; si++) {
    const s = SPOTS[si], p = rackSpot(s, s.kind === 'deep' ? 0 : 2)
    project(cam, p.x, 0, p.z)
    // (a rack's always behind him: he jogs past the one he's leaving, never through it)
    if (PT.z > 3) ORDER.push({ z: Math.max(PT.z + 0.4, CAM.zs + 0.05), k: 'rack', si })
  }
  // the ball in the air (and the one before it, still coming down)
  for (const b of g.balls) {
    if (!b.res || b.relAt == null) continue
    const a = t - b.relAt - PUSH
    if (a < 0) continue
    if (!b.path) {
      // off his hand: where it was in his hands on the screen, back into the court's feet
      const fresh = g.handsAt != null && b.relAt - g.handsAt < 200
      const bz = CAM.zs + 0.8, k = cam.F / bz
      const X = fresh ? (HANDS.bx - cam.px) / k : G.xs + 0.6, Y = fresh ? cam.H - (HANDS.by - cam.hz) / k : 9.2
      b.path = shotPath(b, cam.cx + X * cam.cos + bz * cam.sin, Y, cam.cz - X * cam.sin + bz * cam.cos)
    }
    if (a > b.path.total + 200) continue
    const q = ballAt(b.path, a)
    project(cam, q.x, q.y, q.z)
    ORDER.push({ z: PT.z, k: 'ball', b, x: q.x, y: q.y, zz: q.z, a })
  }
  ORDER.sort((p, q) => q.z - p.z)
  const HOT = '#ff8a3c'
  for (let i = 0; i < ORDER.length; i++) {
    const o = ORDER[i]
    if (o.k === 'rimBack') rimHalf(ctx, cam, false, dy)
    else if (o.k === 'rimFront') { netOf(ctx, cam, netAge, dy, jolt); rimHalf(ctx, cam, true, dy) }
    else if (o.k === 'rack') drawRack(ctx, cam, g, o.si)
    else if (o.k === 'ball') {
      const b = o.b, fade = o.a > b.path.total - 200 ? clamp((b.path.total + 200 - o.a) / 400, 0, 1) : 1
      if (fade < 1) ctx.globalAlpha = fade
      // a shooter who's hot leaves a trail on it
      if (b.hot && o.a < b.flyMs && !lightFx()) {
        for (let j = 3; j >= 1; j--) {
          const q = ballAt(b.path, Math.max(0, o.a - j * 32)); project(cam, q.x, q.y, q.z)
          ctx.globalAlpha = fade * (0.5 - j * 0.12); ctx.fillStyle = HOT; circle(ctx, PT.x, PT.y, BALL_R * PT.k * (1 - j * 0.12)); ctx.fill()
        }
        ctx.globalAlpha = fade
      }
      courtBall(ctx, cam, o.x, o.y, o.zz, -o.a / 70, b.kind)
      if (fade < 1) ctx.globalAlpha = 1
    } else if (o.k === 'him') {
      const held = bodyOf(g, t, T, SP)
      const shown = easedPose(EASE, SP, g, CLK.dt, g.move && t >= g.move.at ? 40 : 30)
      if (held) HELD.kind = held.kind
      const me = view.cast?.me
      athleteFront(ctx, G.sx, G.floor, shown, { jersey: c.us, trim: c.trim, s: G.s, back: true, num: me?.number ?? 30, skin: me?.skin ?? SKINS[0], ball: held ? HELD : null, spin: 0 })
      if (held) g.handsAt = t
    }
  }

  // ── what to read ──
  drawMeter(ctx, G, g, view, T)
  // the points as they drop, at the rim
  project(cam, 0, RIM_Y + 1.6, 0)
  const rimX = PT.x, rimY = PT.y
  for (const b of g.balls) {
    if (!b.landed || !b.res?.in) continue
    const a = t - b.landAt
    if (a < 0 || a > 650) continue
    const col = b.kind === 'money' ? '#ffffff' : b.kind === 'deep' ? GOLD : '#ffffff'
    const y = Math.max(140, rimY - 6 * U - easeOut(a / 650) * 22 * U)   // (never up under the board)
    const s = (b.kind === 'reg' ? 20 : 28) * U * pop(a)
    if (b.kind === 'money') { ctx.fillStyle = 'rgba(200,16,46,.92)'; rr(ctx, rimX - 22 * U, y - s * 0.58, 44 * U, s * 1.12, 4); ctx.fill(); ctx.fillStyle = '#1d428a'; ctx.fillRect(rimX - 22 * U, y + s * 0.34, 44 * U, s * 0.2) }
    text(ctx, `+${b.pts}`, rimX, y, { font: DISPLAY, size: Math.max(14, s), color: col })
  }
  // the money ball: a pop of red, white and blue off the rim
  if (g.popAt != null && g.popFired !== g.popAt) { g.popFired = g.popAt; g.parts.burst('confetti', rimX, rimY, t, { n: 16, s: U, ang: -Math.PI / 2, spread: 1.3, speed: 0.9, colors: ['#c8102e', '#ffffff', '#1d428a'], life: 900 }) }
  if (g.roarAt != null && g.roarFired !== g.roarAt) { g.roarFired = g.roarAt; g.parts.burst('confetti', view.w / 2, 120, t, { n: 30, s: 1.2, ang: Math.PI / 2, spread: 1.4, speed: 1, colors: [c.us, c.trim, '#ffffff'] }) }
  g.parts.draw(ctx, t)
  // the call: heating up, five for five
  const word = (str, at, y, col, size, ms = 1100) => {
    const a = t - at
    if (a < 0 || a > ms) return
    const s = size * pop(a, 120)
    ctx.font = `${s}px ${DISPLAY}`
    const tw = ctx.measureText(str).width + 22
    ctx.fillStyle = 'rgba(6,10,12,.84)'; rr(ctx, view.w / 2 - tw / 2, y - s * 0.62, tw, s * 1.24, 4); ctx.fill()
    text(ctx, str, view.w / 2, y + 1, { font: DISPLAY, size: s, color: col })
  }
  if (!g.done || t < (g.stamp?.at ?? Infinity)) {
    if (g.hotAt != null) word(g.hotWord, g.hotAt, 150, HOT, 26)
    if (roar >= 0) word('5 FOR 5', g.roarAt, 192, GOLD, 34, 1400)
  }
  scoreboard(ctx, view, g, HOT)
}

// The meter (spot-up's): the green across it, the needle climbing, the word when he lets go. The rep it shows is the
// one in his hands, or, for a moment after it's gone, the one just shot.
function drawMeter(ctx, G, g, view, T) {
  const { U } = G, w = G.meterW, b = G.meterB, L = G.meterL, top = b - L, t = g.t
  const cur = g.rep, last = g.last
  const showLast = last && last !== cur ? t - last.relAt < 520 && cur.phase !== 'hold' : last === cur && last?.res
  const m = showLast ? last : cur
  if (!m || (m.phase === 'dead' && !showLast)) return
  const x = G.meterX, hot = g.streak >= 3
  ctx.fillStyle = 'rgba(6,10,12,.92)'; rr(ctx, x - 3, top - 3, w + 6, L + 6, 5); ctx.fill()
  if (hot) { ctx.strokeStyle = '#ff8a3c'; ctx.lineWidth = 2; rr(ctx, x - 4, top - 4, w + 8, L + 8, 6); ctx.stroke() }
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x, top, w, L)
  ctx.fillStyle = BAD; ctx.fillRect(x, top, w, 7 * U)
  let p = 0
  if (m.phase === 'hold') p = g.pOf(m, clamp(T - m.at, 0, m.fill))
  else if (m.res) p = m.p
  const live = m.phase === 'hold' || !!m.res
  if (live) { ctx.fillStyle = m.res ? (m.res.in ? GOOD : '#d8d4c8') : '#efe9da'; ctx.fillRect(x, b - p * L, w, p * L) }
  if (m.phase !== 'wait') {
    const y1 = b - m.hi * L, y0 = b - m.lo * L
    ctx.fillStyle = GOOD; ctx.fillRect(x - 3, y1, w + 6, y0 - y1)
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y0 - 1, w + 6, 2); ctx.fillRect(x - 3, y1 - 1, w + 6, 2)
  }
  if (live) {
    const ny = b - p * L
    ctx.fillStyle = '#07100b'; ctx.fillRect(x - 6, ny - 3.5, w + 12, 7)
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, ny - 2.5, w + 10, 5)
  }
  // what this one's worth, over the bar
  const tag = m.kind === 'deep' ? '3 PTS' : m.kind === 'money' ? '2 PTS' : '1 PT'
  const tagCol = m.kind === 'deep' ? GOLD : m.kind === 'money' ? '#ff6b7d' : 'rgba(255,255,255,.75)'
  // (the round's last ball keeps its word: there's no next ball's worth to show)
  if (m.res && (t - m.relAt < 520 || m.i === g.balls.length - 1)) {
    const word = m.res.in ? 'GREEN' : m.res.off < 0 ? 'EARLY' : 'LATE'
    ctx.fillStyle = 'rgba(6,10,12,.86)'; ctx.fillRect(x - 6, top - 32 * U, 74 * U, 26 * U)
    text(ctx, word, x - 3, top - 18 * U, { font: DISPLAY, size: Math.max(16, 22 * U), color: m.res.in ? GOOD : BAD, align: 'left' })
  } else {
    ctx.fillStyle = 'rgba(6,10,12,.86)'; ctx.fillRect(x - 6, top - 30 * U, 56, 22 * U)
    text(ctx, tag, x - 1, top - 18 * U, { font: LABEL, size: Math.max(14, 17 * U), color: tagCol, align: 'left', track: 0.5 })
  }
}

// The board: his name and points, the contest clock, the round (the score to beat in the final), and every ball
// on every rack, in shooting order
const clockStr = ms => (ms >= 10000 ? String(Math.ceil(ms / 1000 - 1e-6)) : (Math.ceil(ms / 100 - 1e-6) / 10).toFixed(1))
function scoreboard(ctx, view, g, HOT) {
  const { w } = view, y = 44, h = 78, t = g.t
  ctx.fillStyle = '#05080b'; ctx.fillRect(0, y, w, h)
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, y + h - 1, w, 1)
  const hot = g.streak >= 3
  text(ctx, g.label.length > 12 ? `${g.label.slice(0, 11)}.` : g.label, 12, y + 14, { font: LABEL, size: 15, align: 'left', color: hot ? HOT : 'rgba(255,255,255,.82)', track: 0.6 })
  const lastIn = g.balls.reduce((a, b) => (b.landed && b.res?.in && (!a || b.landAt > a.landAt) ? b : a), null)
  const bump = lastIn ? pop(t - lastIn.landAt, 160) : 1
  text(ctx, String(g.points), 12, y + 40, { font: DISPLAY, size: 32 * bump, align: 'left', color: '#fff' })
  // the clock: red in the last five, punched at the horn
  const ms = g.clock
  const col = g.horned ? BAD : ms <= 5000 && g.clockAt == null ? (Math.floor(ms / 250) % 2 ? '#ffffff' : BAD) : '#ffffff'
  const k = g.hornAt != null ? pop(t - g.hornAt, 200) : 1
  ctx.save(); ctx.translate(w / 2, y + 30); ctx.scale(k, k)
  ctx.fillStyle = '#10161b'; rr(ctx, -46, -20, 92, 40, 4); ctx.fill()
  text(ctx, clockStr(ms), 0, 1, { font: DISPLAY, size: 34, color: col })
  ctx.restore()
  text(ctx, g.final ? 'FINAL ROUND' : 'FIRST ROUND', w - 12, y + 14, { font: LABEL, size: 15, align: 'right', color: 'rgba(255,255,255,.82)', track: 0.6 })
  if (g.toBeat != null) {
    text(ctx, 'TO BEAT', w - 46, y + 40, { font: LABEL, size: 15, align: 'right', color: 'rgba(255,255,255,.7)', track: 0.5 })
    text(ctx, String(g.toBeat), w - 12, y + 40, { font: DISPLAY, size: 26, align: 'right', color: g.points >= g.toBeat ? GOOD : GOLD })
  } else text(ctx, `${g.made} OF 27`, w - 12, y + 40, { font: LABEL, size: 17, align: 'right', color: 'rgba(255,255,255,.7)', track: 0.5 })
  // the racks
  const R = 4.6, step = 10.4, gap = 10
  const widths = SPOTS.map(s => (s.n - 1) * step + R * 2)
  let x = w / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (SPOTS.length - 1)) / 2
  const cy = y + 66
  let bi = 0
  SPOTS.forEach((s, si) => {
    for (let k = 0; k < s.n; k++, bi++) {
      const b = g.balls[bi], cx = x + R + k * step
      const doneB = b.landed && b.res
      if (doneB && b.res.in) {
        if (b.kind === 'money') moneyBall(ctx, cx, cy, R, 0)
        else { ctx.fillStyle = b.kind === 'deep' ? GOLD : '#e8772e'; circle(ctx, cx, cy, R); ctx.fill() }
      } else if (doneB || b.phase === 'dead') { ctx.fillStyle = 'rgba(255,90,72,.5)'; circle(ctx, cx, cy, R - 1); ctx.fill() }
      else {
        ctx.strokeStyle = b === g.rep && !g.horned ? GOLD : b.kind === 'money' ? '#ff6b7d' : b.kind === 'deep' ? 'rgba(245,220,138,.75)' : 'rgba(255,255,255,.4)'
        ctx.lineWidth = b === g.rep && !g.horned ? 2 : 1.4; circle(ctx, cx, cy, R - 0.6); ctx.stroke()
      }
    }
    x += widths[si] + gap
  })
}
