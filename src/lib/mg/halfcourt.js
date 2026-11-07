// GET A BUCKET: five on five, the half court, one possession. You have the ball and you play it: move with the stick
// (the arrows, WASD), and the other nine play off you. Your four space the floor (the corners, the wings, the dunker
// spot) and get out of your lane when you drive. Their five play man: your man sits between you and the rim, the
// others sag off theirs toward the ball, the nearest one steps over to stop the ball when you beat yours, and whoever
// your pass goes to has his man flying at him.
//   moves     a quick flick sideways (a double tap of LEFT or RIGHT) is a crossover: the ball changes hands with a
//             burst the other way. A man leaning the old way bites and he's beaten; one sat down in his stance just
//             gives you a step. A flick back (a double tap of DOWN), or a quick reversal, is a spin: on a man who's
//             chest to chest with you it takes you round him; with nobody on you it's a waste of a second.
//   shooting  hold SHOOT and let go in the green: Clutch Shot's meter, the same curve and the same green off the same
//             ratings. Who's on you shrinks it, so does a long one; a pull-up off the move is a touch tighter. Inside
//             the restricted area SHOOT takes it up: a layup, or a dunk with room. A man in front of you at the rim
//             can block it.
//   passing   PASS hits the most open man (a flat ring under him says who). A defender in the lane picks it off.
//   lost      a reach that finds the ball (dribble into traffic and they come for it), a block, a miss, the shot clock.
// The rules are in feet, the rim at the origin, z toward the baseline: the same court as every basketball game here.
import { clamp, lerp, prog, easeOut, easeInOut, rngOf, outcome, nudge, text, rr, circle, keyCap, particles, byV, GOOD, BAD, GOLD, DISPLAY, LABEL } from './kit.js'
import { arenaCam, dolly, arenaStage, wallNow, manAt, POSE, RUN, tagAt, tagsDown, AB, flyTo, dropThrough, hoopWith, shotApex, liftPose } from './arena.js'
import { frontRun, ballIn, easedState, easedPose, newPose, copyPose, mixPose, pose, project, smoothT, CLK, IN_HANDS, PT, FIG_FT, BALL_R, RIM_R, RIM_Y, R_HEAD, R_HIPS, R_UP, warmCrowd, crowdUp, camFlashes, boardFlash, lightFx, SKINS } from './meter.js'
import { crowdPop } from './art.js'
import { castMen, teamOf } from './read.js'

export const how = {
  'half-court': 'Five on five, one possession. Move with the stick (arrows on a keyboard). Change direction to cross over, roll the stick to spin. Hold SHOOT and let go in the green. PASS kicks it to the open man for the shot. Score before the shot clock runs out.',
}

// ── The rules ───────────────────────────────────────────────────────────────
const SET_MS = 650            // checked up top before the clock starts
const CLOCK_MS = 12000        // the shot clock
// the court: 90% of a real one about the rim (less floor to cover); everything on it scales with CS
const CS = 0.9
const BASE = 5.25 * CS        // the baseline, feet behind the rim
const SIDE = 25 * CS - 0.8, BACKCOURT = -38 * CS
const THREE_D = 23.75 * CS, CORNER_X = 22 * CS
const BODY = 2.05             // two men nearer than this are touching
const GAP = 3.3               // your man's cushion
const LAYUP_D = 10.5          // inside this SHOOT is a layup (or a dunk): a step or two out, as a real one starts
const DUNK_D = 7
const TM_V = 0.0148           // a teammate getting to his spot, feet a ms
const CHASE_V = 0.0166, SLIDE_V = 0.0151, BACK_V = 0.0136, CLOSE_V = 0.0176, HELP_V = 0.0162   // the defense
const DEF_ACC = 75, CLOSE_ACC = 210, OWN_ACC = 85
const LAG = 185               // ms your man is behind what you do
const HELP_REACT = 230        // and the help, behind your man being beaten
const CROSS_MS = 190, CROSS_BURST = 330, SPIN_MS = 400, MOVE_GAP = 260
const BITE_MS = [430, 720], ANKLES_MS = 950, SPUN_MS = 640, WHIFF_MS = 430, HESI_MS = 380
const REACH_MS = 290          // a reach from the start of it to his hand getting there
const FLICK_MS = 115, TAP2_MS = 400
const SWAP_MS = 480           // keys: LEFT then RIGHT (or back) inside this is a crossover too
const CROSS_WIN = 420         // the stick: one side, then the other inside this, is a crossover
const ROLL_MS = 480, ROLL_RAD = 2.5   // the stick rolled round this far (about 145°) this quickly is a spin
const KEY_ROLL_MS = 560       // keys: three directions round in a row (LEFT, DOWN, RIGHT) inside this is a spin
const BACK_MS = 900           // a give-and-go: how long the man you kicked it to holds it before it comes back
const PASS_V = 0.06          // a pass, feet a ms
const GATHER = 150, LAY_REL = 380, DUNK_AT = 340
const LAY_GREEN = 2.1          // a layup's green, against a jumper's
// Clutch Shot's meter (lib/mg/meter.js): the same curve, and the green off the same half-width
const CURVE = 2.6, FLINCH = 90
const halfOf = v => lerp(26, 68, clamp((v - 1) / 10, 0, 1) ** 1.3)
// the green for where he's shooting from: a mid-range pull-up a little bigger, a deep one a lot smaller
// (a touch bigger in close, 1 at the line, then smaller the deeper he goes: about a third of it from half court)
const distGreen = D => (D < THREE_D ? lerp(1.16, 1, clamp((D - 8) / (THREE_D - 8), 0, 1)) : lerp(1, 0.34, clamp((D - THREE_D) / (20 * CS), 0, 1) ** 0.8))
const isThree = (x, z) => Math.hypot(x, z) >= THREE_D || (Math.abs(x) >= CORNER_X && z > -8.9 * CS)

const SPOTS = [
  { x: -22.7, z: 1.2, w: 0 }, { x: 22.7, z: 1.2, w: 0 },          // the corners
  { x: -19.6, z: -14.6, w: 1.2 }, { x: 19.6, z: -14.6, w: 1.2 },  // the wings
  { x: -11, z: -24, w: 3.5 }, { x: 11, z: -24, w: 3.5 },  // the slots
  { x: 0, z: -26.8, w: 4.5 },                                     // the top
].map(s => ({ ...s, x: s.x * CS, z: s.z * CS }))
const DUNKER = [{ x: -9.4 * CS, z: 1.7 }, { x: 9.4 * CS, z: 1.7 }]
const HIST = 96
const hyp = Math.hypot

export function make({ v, seed, cast, situation = null }) {
  const r = rngOf(seed), look = rngOf(`${seed}|look`)
  const tv = clamp((v - 1) / 10, 0, 1)
  const mir = r() < 0.5 ? -1 : 1
  const SPD = byV(v, 0.0158, 0.0194)
  const fill = lerp(640, 800, r()), cRel = lerp(0.7, 0.86, r())   // (the meter: quicker than Clutch Shot's, it's a live play)
  const half0 = halfOf(v)
  // where everyone starts: you up top, a man in each corner, a shooter on one wing, the big on the other block
  const O0 = [[0, -27.5], [-22.7 * mir, 1.2], [22.7 * mir, 1.2], [19.6 * mir, -14.6], [-9.4 * mir, 1.7]].map(([x, z]) => [x * CS, z * CS])
  const men = []
  for (let i = 0; i < 10; i++) {
    const o = i < 5, [x, z] = o ? O0[i] : O0[i - 5]
    men.push({ i, o, x, z, vx: 0, vz: 0, tx: x, tz: z, st: 'ok', stAt: 0, stEnd: 0, lag: o ? 0 : LAG + r() * 40, hand: 1, big: i % 5 === 4, run: 0, reach: null, help: false, closing: 0, jump: 0 })
  }
  // the defense starts set: each man goal-side of his
  for (let i = 0; i < 5; i++) { const d = men[5 + i], m = men[i], dd = hyp(m.x, m.z) || 1; d.x = m.x - (m.x / dd) * (i ? 5 : GAP); d.z = m.z - (m.z / dd) * (i ? 5 : GAP) }
  const HX = new Float32Array(HIST), HZ = new Float32Array(HIST), HVX = new Float32Array(HIST)
  const g = {
    t: 0, game: 'half-court', zones: 'none', stick: true, fx: [], done: null, outro: 2400, stamp: null, later: null,
    men, h: 0, phase: 'set', clock: CLOCK_MS, liveAt: SET_MS, mir, v, SPD, fill, cRel, half0,
    shot: null, pass: null, mv: null, moveReady: 0, burst: null, help: null, target: -1, word: null, stillSince: 0,
    nudge: nudge(), dust: particles(28, 7), look: look(), sit: situation ? { ...situation } : null,
    // what the controls are doing: the stick (touch, or an analog one), the keys, and which finger is where
    ctl: { tid: null, ox: 0, oy: 0, tx: 0, ty: 0, ax: 0, ay: 0, ext: false, keys: { L: 0, R: 0, U: 0, D: 0 }, lastDown: {}, lastUp: {}, sid: null, sx: 0, sy: 0, hist: [], passLit: -999, shootLit: false },
    vh: 640, keysView: false,
    hud: { prompt: null, dots: null },
    tick(dt) {
      g.t += dt
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      if (g.phase === 'set') { if (g.t >= g.liveAt) { g.phase = 'live'; g.fx.push('whistle'); g.stillSince = g.t } settleMen(dt); return }
      if (!g.done && g.phase !== 'over') {
        g.clock = Math.max(0, CLOCK_MS - (g.t - g.liveAt))
        if (g.clock <= 0 && !(g.shot && g.shot.rel)) { violation(); return }
      }
      stickNow()
      if (g.phase === 'live' || g.phase === 'shot') handler(dt)
      teammates(dt)
      defense(dt)
      collide()
      if (g.phase === 'live') reaches(dt)
      ballFlight()
      // the history your man reads you from
      const H = men[0], k = Math.floor(g.t / (1000 / 120)) % HIST
      HX[k] = H.x; HZ[k] = H.z; HVX[k] = H.vx
      g.target = g.phase === 'live' && g.h === 0 ? bestPass() : -1
    },
    input(a) { control(a) },
    // what a man's history looks like, ms ago (your man reads you from this)
    seen(ms, o) { const n = Math.round(ms / (1000 / 120)), k = ((Math.floor(g.t / (1000 / 120)) - n) % HIST + HIST) % HIST; o.x = HX[k]; o.z = HZ[k]; o.vx = HVX[k]; return o },
    stickOut: { x: 0, y: 0 },
  }
  for (let k = 0; k < HIST; k++) { HX[k] = men[0].x; HZ[k] = men[0].z }
  const SEEN = { x: 0, z: 0, vx: 0 }

  // ── the controls ──
  function control(a) {
    const c = g.ctl
    if (a.kind === 'stick') { c.ax = clamp(a.x, -1, 1); c.ay = clamp(a.y, -1, 1); c.ext = true; return }
    if (a.kind === 'key') {
      const k = a.zone
      if (k === 'S') { if (g.h !== 0) { callBack(); return } if (!c.sid) { c.sid = 'key'; shootDown() } return }
      if (k === 'P') { c.passLit = g.t; if (g.h !== 0) callBack(); else passIt(); return }
      if (!(k in c.keys)) return
      // three directions round in a row (LEFT, DOWN, RIGHT, or the other way round): a spin
      const ANG = { R: 0, U: 1, L: 2, D: 3 }
      c.seq = (c.seq ?? []).filter(e => g.t - e.t < KEY_ROLL_MS && e.k !== k).concat({ k, t: g.t })
      const q = c.seq.slice(-3)
      if (q.length === 3) {
        const s1 = (ANG[q[1].k] - ANG[q[0].k] + 4) % 4, s2 = (ANG[q[2].k] - ANG[q[1].k] + 4) % 4
        if ((s1 === 1 && s2 === 1) || (s1 === 3 && s2 === 3)) { startMove('spin', s1 === 1 ? -1 : 1); c.seq = []; c.lastDown[k] = g.t; c.keys[k] = 1; return }
      }
      // a double tap: the same direction again, quickly, with a let-go in between
      if ((k === 'L' || k === 'R' || k === 'D') && c.lastDown[k] != null && g.t - c.lastDown[k] < TAP2_MS && (c.lastUp[k] ?? -1) > c.lastDown[k]) {
        if (k === 'D') startMove('spin', spinSide()); else startMove('cross', k === 'L' ? -1 : 1)
      } else if (k === 'L' || k === 'R') {
        // one side, then the other, quickly (still held, or just let go): the ball goes across
        const o = k === 'L' ? 'R' : 'L'
        if (c.keys[o] || (c.lastDown[o] != null && g.t - c.lastDown[o] < SWAP_MS)) startMove('cross', k === 'L' ? -1 : 1)
      }
      c.lastDown[k] = g.t; c.keys[k] = 1
      return
    }
    if (a.kind === 'keyup') {
      const k = a.zone
      if (k === 'S') { if (c.sid === 'key') { c.sid = null; shootUp() } return }
      if (k in c.keys) { c.keys[k] = 0; c.lastUp[k] = g.t }
      return
    }
    // a finger: the left half of the screen is the stick (it starts where the thumb lands), the right is the buttons
    const id = a.id ?? 0, C = ctlOf(g.vh)
    if (a.kind === 'down') {
      if (a.x < 180) { c.tid = id; c.ox = a.x; c.oy = a.y; c.tx = 0; c.ty = 0; c.hist.length = 0 }
      else if (hyp(a.x - C.pass.x, a.y - C.pass.y) < C.pass.r + 14) { c.passLit = g.t; if (g.h !== 0) callBack(); else passIt() }
      else if (g.h !== 0) callBack()
      else if (c.sid == null) { c.sid = id; shootDown() }
    } else if (a.kind === 'move') {
      if (id === c.tid) { const R = C.stick.R; c.tx = clamp((a.x - c.ox) / R, -1.4, 1.4); c.ty = clamp(-(a.y - c.oy) / R, -1.4, 1.4); const m = hyp(c.tx, c.ty); if (m > 1) { c.tx /= m; c.ty /= m } }
    } else if (a.kind === 'up') {
      if (id === c.tid) { c.tid = null; c.tx = 0; c.ty = 0 }
      else if (id === c.sid) { c.sid = null; shootUp() }
    }
  }
  // where the stick is this tick, and a move in it. A crossover: going one way with it, then the other (the ball
  // changes hands). A spin: rolling the stick round, half a turn or more, without coming through the middle
  function stickNow() {
    const c = g.ctl, o = g.stickOut
    const analog = c.tid != null || c.ext
    if (c.tid != null) { o.x = c.tx; o.y = c.ty }
    else if (c.ext) { o.x = c.ax; o.y = c.ay }
    else { o.x = c.keys.R - c.keys.L; o.y = c.keys.U - c.keys.D; const m = hyp(o.x, o.y); if (m > 1) { o.x /= m; o.y /= m } }
    if (!analog) { c.hist.length = 0; return }
    const H = c.hist, m = hyp(o.x, o.y)
    H.push({ t: g.t, x: o.x, y: o.y, m, a: Math.atan2(o.y, o.x) })
    while (H.length && g.t - H[0].t > ROLL_MS) H.shift()
    // which side he's going with it (sideways enough to count), and since when
    const sd = m > 0.5 && Math.abs(o.x) > 0.42 * m ? Math.sign(o.x) : 0
    if (g.t < g.moveReady || g.phase !== 'live' || g.h !== 0) { if (sd) { c.side = sd; c.sideAt = g.t } return }
    // the spin: the stick rolled round, kept out from the middle the whole way
    let sweep = 0, held = true
    for (let i = 1; i < H.length; i++) {
      if (H[i].m < 0.5 || H[i - 1].m < 0.5) { held = false; break }
      let d = H[i].a - H[i - 1].a; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI
      if (Math.abs(d) > 1.3) { held = false; break }   // (a snap straight across is a crossover, not a roll)
      sweep += d
    }
    if (held && Math.abs(sweep) > ROLL_RAD) { startMove('spin', sweep > 0 ? -1 : 1); H.length = 0; c.side = sd; c.sideAt = g.t; return }
    // the crossover: the other side from the one he was just going (through the middle, or straight across)
    if (sd && c.side && sd !== c.side && g.t - c.sideAt < CROSS_WIN) {
      // (not partway round a roll: that's a spin coming)
      let roll = true
      for (let i = H.length - 1; i >= 0 && g.t - H[i].t < 200; i--) if (H[i].m < 0.5) { roll = false; break }
      if (!roll || Math.abs(sweep) < 1.2) { startMove('cross', sd); H.length = 0 }
    }
    if (sd) { c.side = sd; c.sideAt = g.t }
  }
  const spinSide = (x = 0) => (Math.abs(x) > 0.2 ? Math.sign(x) : Math.abs(g.stickOut.x) > 0.2 ? Math.sign(g.stickOut.x) : men[g.h].hand)

  // ── you ──
  const U = { x: 0, z: 0 }
  function toRim(m, o = U) { const d = hyp(m.x, m.z) || 1; o.x = -m.x / d; o.z = -m.z / d; return o }
  // is d between m and the rim? (on the line, near enough to it, short of the rim)
  function inFront(d, m) {
    const ax = -m.x, az = -m.z, L2 = ax * ax + az * az || 1
    const t = ((d.x - m.x) * ax + (d.z - m.z) * az) / L2
    if (t <= 0 || t > 1.05) return false
    const ex = m.x + ax * t - d.x, ez = m.z + az * t - d.z
    return hyp(ex, ez) < 2.3
  }
  function handler(dt) {
    const H = men[0], s = g.stickOut, mv = g.mv
    // (the man holding it gives it back when the lane's clear, or lobs it over the top once he's held it long enough)
    if (g.h !== 0 && g.phase === 'live' && !g.pass && g.t - g.catchAt > g.catchShot) teamShot()
    if (g.phase === 'shot') { shotTick(men[g.h], dt); return }
    if (mv && g.t >= mv.end) { g.mv = null }
    if (g.mv?.kind === 'spin' && g.h === 0) {
      // round him: a curve from where you were, past his shoulder, to goal-side of him
      const f = easeInOut(prog(g.t, g.mv.at, g.mv.end)), p = g.mv
      const x = (1 - f) * (1 - f) * p.sx + 2 * (1 - f) * f * p.mx + f * f * p.ex, z = (1 - f) * (1 - f) * p.sz + 2 * (1 - f) * f * p.mz + f * f * p.ez
      H.vx = (x - H.x) / dt; H.vz = (z - H.z) / dt; H.x = x; H.z = z
      H.run += hyp(H.vx, H.vz) * dt
      bound(H)
      return
    }
    let sp = SPD * (g.burst && g.t < g.burst.end ? 1.32 : 1)
    let wx = s.x * sp, wz = s.y * sp
    if (g.burst && g.t < g.burst.end) { wx = g.burst.side * sp * 0.94 + s.x * sp * 0.06; wz = Math.max(wz, s.y * sp * 0.5) + sp * 0.12 }
    const k = 1 - Math.exp(-dt / (g.burst && g.t < g.burst.end ? 40 : OWN_ACC))
    H.vx += (wx - H.vx) * k; H.vz += (wz - H.vz) * k
    H.x += H.vx * dt; H.z += H.vz * dt
    H.run += hyp(H.vx, H.vz) * dt
    bound(H)
    if (hyp(H.vx, H.vz) > 0.004) g.stillSince = g.t
  }
  function bound(m) {
    m.x = clamp(m.x, -SIDE, SIDE); m.z = clamp(m.z, BACKCOURT, BASE - 0.8)
    // nobody runs through the stanchion: behind the board is out of the play
    if (m.z > 1.3 && Math.abs(m.x) < 3.2) m.z = 1.3
  }
  function startMove(kind, side) {
    if (g.phase !== 'live' || g.t < g.moveReady || g.pass || g.h !== 0) return
    const H = men[g.h], d = men[5 + g.h]
    if (kind === 'cross') {
      // what he was doing a moment ago: sliding with you, or set
      const u = toRim(H), px = u.z, pz = -u.x   // (across your line to the rim: + is to your right)
      const sx = side * px, sz = side * pz
      g.seen(160, SEEN)
      const wasGoing = -(SEEN.vx * sx)
      const near = []
      for (let i = 5; i < 10; i++) { const q = men[i]; if (hyp(q.x - H.x, q.z - H.z) < 7.5 && q.st !== 'ankles') near.push(q) }
      g.mv = { kind, side, at: g.t, end: g.t + CROSS_MS }
      g.burst = { side: sx, sideZ: sz, end: g.t + CROSS_BURST }
      H.hand = side
      for (const q of near) {
        const lean = -(q.vx * sx + q.vz * sz)          // his feet going the old way
        // (how far he's committed is how likely he is to bite: a man barely moving can still stop and sit down)
        const bites = r() < clamp((lean - 0.0042) / 0.0075, 0, 0.9) + (q === d && wasGoing > 0.0095 ? 0.15 : 0)
        if (bites && (q.st === 'ok' || q.st === 'closing')) {
          const hard = lean > 0.0128 && wasGoing > 0.011 && hyp(q.x - H.x, q.z - H.z) < 4.6 && r() < 0.45
          q.st = hard ? 'ankles' : 'bit'; q.stAt = g.t; q.stEnd = g.t + (hard ? ANKLES_MS : byV(v, BITE_MS[0], BITE_MS[1]))
          q.reach = null
          g.word = { text: hard ? 'ANKLES' : 'CROSSED UP', at: g.t, i: q.i }
          g.fx.push(hard ? 'h:heavy' : 'h:medium')
          if (hard) g.nudge.kick(g.t, 2.4, side, 0.2, 170)
        } else if (q === d && q.st === 'ok') q.hesi = g.t + HESI_MS
      }
      g.fx.push('dribble', 'h:light')
      g.moveReady = g.t + CROSS_MS + MOVE_GAP
      return
    }
    // the spin: on whoever's chest to chest with you, in front
    let on = null, best = 4
    for (let i = 5; i < 10; i++) { const q = men[i]; const e = hyp(q.x - H.x, q.z - H.z); if (e < best && q.st !== 'ankles' && inFront(q, H)) { best = e; on = q } }
    const u = toRim(H), px = u.z, pz = -u.x
    const m = { kind, side, at: g.t, end: g.t + SPIN_MS, sx: H.x, sz: H.z, on: on?.i ?? -1 }
    if (on) {
      m.mx = on.x + px * side * 2.5 - u.x * 0.2; m.mz = on.z + pz * side * 2.5 - u.z * 0.2
      m.ex = on.x + u.x * 1.9 + px * side * 1.7; m.ez = on.z + u.z * 1.9 + pz * side * 1.7
      on.st = 'spun'; on.stAt = g.t; on.stEnd = g.t + SPUN_MS; on.reach = null
      g.word = { text: 'SPUN HIM', at: g.t + 200, i: on.i }
      g.fx.push('h:medium')
    } else {
      // nobody to spin off: a turn on the spot, a step the way you were going
      m.mx = H.x + px * side * 0.8; m.mz = H.z + pz * side * 0.8; m.ex = H.x + px * side * 1.2 - u.x * 0.4; m.ez = H.z + pz * side * 1.2 - u.z * 0.4
    }
    g.mv = m
    g.burst = null
    g.fx.push('dribble')
    g.moveReady = g.t + SPIN_MS + MOVE_GAP
  }

  // ── the shot ──
  function contestOn(H) {
    let best = 0, front = 0, by = -1, near = Infinity
    for (let i = 5; i < 10; i++) {
      const q = men[i], e = hyp(q.x - H.x, q.z - H.z)
      if (q.st !== 'ankles') near = Math.min(near, e)
      const ahead = inFront(q, H) || ((q.x - H.x) * -H.x + (q.z - H.z) * -H.z) > 0
      let c = clamp((6.6 - e) / 5, 0, 1) * (ahead ? 1 : 0.45)
      if (q.st === 'bit' || q.st === 'spun' || q.st === 'off') c *= 0.55
      if (q.st === 'ankles') c = 0
      if (c > best) { best = c; by = i }
      if (ahead && inFront(q, H) && q.st !== 'ankles' && q.st !== 'spun') front = Math.max(front, clamp((3.6 - e) / 2.4, 0, 1) * (q.st === 'bit' || q.st === 'off' ? 0.4 : 1))
    }
    return { c: best, front, by, open: clamp((near - 7) / 5, 0, 1) }
  }
  function shootDown() {
    g.ctl.shootLit = true
    if (g.phase !== 'live' || g.pass || g.mv?.kind === 'spin' || g.h !== 0) return
    const H = men[g.h], D = hyp(H.x, H.z)
    const moving = hyp(H.vx, H.vz)
    g.phase = 'shot'; g.mv = null; g.burst = null
    if (D <= LAYUP_D) {
      const ct = contestOn(H)
      const dunk = D <= DUNK_D && v >= 4 && ct.front < 0.3
      g.shot = { kind: dunk ? 'dunk' : 'layup', at: g.t, D, three: false, x0: H.x, z0: H.z, vx: H.vx, vz: H.vz, rel: null, res: null, side: H.x < 0 ? -1 : 1 }
      // a layup has the meter too: quicker, and a bigger green than a jumper's (a hand at the rim still shrinks it)
      if (!dunk) {
        const L = g.shot
        Object.assign(L, { meter: true, fill: fill * 0.75, p: 0, tau: 0, contest: ct.c, front: ct.front, by: ct.by })
        L.c = L.fill * cRel
        L.half = half0 * LAY_GREEN * clamp(1 - 0.45 * ct.c, 0.45, 1)
        L.lo = pOf(L, L.c - L.half); L.hi = pOf(L, L.c + L.half)
      }
      g.fx.push('h:light')
      return
    }
    g.shot = {
      kind: 'jumper', at: g.t, D, three: isThree(H.x, H.z), x0: H.x, z0: H.z, rel: null, res: null,
      fill: fill * (moving > 0.009 ? 0.94 : 1), c: 0, half: half0, pull: moving > 0.009 ? 0.88 : 1, p: 0, tau: 0, held: true, contest: 0,
      lean: clamp(H.vx / SPD, -1, 1) * 0.17,   // (across the screen: the way he was going)
    }
    g.shot.c = g.shot.fill * cRel
    greenNow(g.shot, H)
    g.fx.push('h:light')
  }
  function greenNow(s, H) {
    const ct = contestOn(H)
    s.contest = ct.c; s.front = ct.front; s.by = ct.by
    // how open he is: the nearest man's hand in his face shrinks it, a step of room is the same, wide open grows it a little
    s.half = half0 * distGreen(s.D) * s.pull * clamp(1 - 0.62 * ct.c, 0.32, 1) * lerp(1, 1.12, ct.open)
    s.lo = pOf(s, s.c - s.half); s.hi = pOf(s, s.c + s.half)
  }
  const pOf = (s, tau) => clamp(tau / s.fill, 0, 1) ** CURVE
  function shootUp() {
    g.ctl.shootLit = false
    const s = g.shot
    if (!s || s.rel || g.phase !== 'shot') return
    const tau = g.t - s.at
    if (s.meter) { layRelease(s, men[0], tau); return }
    if (s.kind !== 'jumper') return
    if (tau < FLINCH) { g.phase = 'live'; g.shot = null; return }   // (the finger slipped: no shot)
    release(s, tau)
  }
  function shotTick(H, dt) {
    const s = g.shot
    // a man shooting stops where he is (a layup carries him on in)
    if (s.auto) {
      H.vx *= 0.8; H.vz *= 0.8
      if (!s.rel) { s.tau = g.t - s.at; if (g.t >= s.relAt) { const made = r() < s.makeP; release(s, made ? s.c : s.c + (r() < 0.5 ? -1 : 1) * (s.half + 40 + r() * 60)) } }
      bound(H)
      return
    }
    if (s.kind === 'jumper') {
      const keep = s.rel ? 0.82 : 0.9   // (a drift on the way up, then he lands where he went)
      H.vx *= keep; H.vz *= keep * 0.85; H.x += H.vx * dt; H.z += H.vz * dt
      if (!s.rel) {
        s.tau = g.t - s.at; s.p = pOf(s, s.tau)
        if (s.tau >= s.fill) release(s, s.fill)
      }
    } else {
      const u = g.t - s.at, carry = clamp(1 - u / 420, 0, 1)
      const tr = toRim(H)
      const sp = Math.min(SPD, hyp(s.vx, s.vz)) * carry
      if (hyp(H.x, H.z) > 2.2) { H.x += tr.x * sp * dt; H.z += tr.z * sp * dt }
      if (s.meter) { if (!s.rel) { s.tau = u; s.p = pOf(s, u); if (u >= s.fill) layRelease(s, H, s.fill) } }
      else if (!s.rel && u >= DUNK_AT) finish(s, H)
    }
    bound(H)
  }
  // a jumper's let-go: judged as Clutch Shot judges it
  function release(s, tau) {
    const H = men[g.h]
    s.rel = g.t; s.tau = tau; s.p = pOf(s, tau)
    // (the green was set when he went up, as Clutch Shot's is: what's in his face now is a block, or isn't)
    s.front = contestOn(H).front
    const off = tau - s.c, a = Math.abs(off), inZone = a <= s.half
    const q = inZone ? lerp(1, 0.6, a / s.half) : clamp(0.5 - (0.5 * (a - s.half)) / (s.half * 1.2 + 60), 0, 0.5)
    // a man right in front of you, up with you, can get a piece of a jumper
    const block = s.front > 0.55 && r() < 0.28 * s.front * s.front
    s.res = { in: inZone && !block, q, off, why: block ? 'block' : inZone ? 'green' : off < 0 ? 'early' : 'late', block, far: a > s.half + 70 }
    s.kind2 = block ? 'block' : !inZone ? (off < 0 ? (s.res.far ? 'air' : 'front') : (s.res.far ? 'board' : 'back')) : q >= 0.8 ? 'swish' : 'rattle'
    s.fly = 560 + s.D * 15
    s.rimAt = g.t + (block ? 260 : s.fly)
    s.buzzer = g.clock < 700
    g.fx.push('swoosh')
    // everyone goes: the man on you up at it, the rest to the glass
    if (s.by >= 0) men[s.by].jump = g.t
  }
  // a layup let go: judged on the meter, then finished at the rim
  function layRelease(s, H, tau) {
    s.tau = tau; s.p = pOf(s, tau)
    const off = tau - s.c, a = Math.abs(off)
    s.tq = a <= s.half ? 1 : clamp(1 - (a - s.half) / (s.half * 1.1 + 50), 0.15, 1)
    s.off = off
    finish(s, H)
    s.res.off = off
    if (!s.res.block) s.res.why = a <= s.half ? 'green' : s.res.why
  }
  function finish(s, H) {
    s.rel = g.t
    const ct = contestOn(H)
    s.contest = ct.c; s.front = ct.front
    const blockP = s.kind === 'dunk' ? ct.front * 0.3 : clamp(ct.front * 0.6, 0, 0.6)
    const block = r() < blockP
    const makeP = s.kind === 'dunk' ? 0.97 * (1 - 0.3 * ct.c) : lerp(0.62, 0.92, tv) * (1 - 0.42 * ct.c)
    // (a layup off the meter: in the green as before and a touch better, out of it a lot worse)
    const tq = s.meter ? s.tq : 1
    const made = !block && r() < (s.meter ? (tq >= 1 ? Math.min(0.97, makeP + 0.04) : makeP * (0.2 + 0.6 * tq * tq)) : makeP)
    s.res = { in: made, q: made ? clamp(1 - ct.c * 0.6, 0.5, 1) : 0.2, why: block ? 'block' : made ? 'make' : 'miss', block }
    s.kind2 = block ? 'block' : made ? 'rattle' : 'front'
    s.fly = s.kind === 'dunk' ? 40 : 230
    s.rimAt = g.t + s.fly
    s.buzzer = g.clock < 700
    if (ct.by >= 0) men[ct.by].jump = g.t - 80
    g.fx.push(s.kind === 'dunk' ? 'h:medium' : 'swoosh')
  }
  function ballFlight() {
    const s = g.shot
    if (s?.rel && !s.landed && g.t >= s.rimAt) {
      s.landed = true
      const made = s.res.in, pts = s.three ? 3 : 2
      g.phase = 'over'
      if (s.res.block) {
        g.fx.push('stamp', 'h:heavy'); g.nudge.kick(g.t, 4, 0, 1, 200)
        end(0.08, false, 'Blocked', 'BLOCKED', 0, pts)
      } else if (made) {
        g.fx.push('make', s.kind === 'dunk' ? 'stamp' : 'h:medium')
        if (s.kind === 'dunk') { g.nudge.kick(g.t, 5, 0, 1, 240); g.fx.push('h:heavy') }
        if (g.sit) g.sit = { ...g.sit, mine: g.sit.mine + pts }
        const word = s.buzzer ? 'AT THE BUZZER' : s.kind === 'dunk' ? 'SLAM' : s.kind === 'layup' ? 'AND IN' : s.three && s.kind2 === 'swish' ? 'SPLASH' : s.kind2 === 'swish' ? 'SWISH' : 'BUCKET'
        const open = 1 - s.contest
        end(clamp(0.6 + (s.three ? 0.12 : 0) + 0.16 * s.res.q + 0.12 * open, 0, 1), true, `${s.three ? 'A three' : s.kind === 'dunk' ? 'A dunk' : s.kind === 'layup' ? 'A layup' : 'A two'}${s.contest > 0.6 ? ', contested' : s.contest < 0.2 ? ', wide open' : ''}`, word, 1, pts)
      } else {
        if (s.kind2 !== 'air') g.fx.push('rimmiss', 'h:light')
        end(0.18 + 0.12 * s.res.q, false, s.auto ? (s.three ? 'Kick-out three, no good' : 'Kick-out, no good') : s.kind === 'jumper' ? (s.res.why === 'early' ? 'Too early' : s.res.why === 'late' ? 'Too late' : 'Off the rim') : 'Missed at the rim', s.kind2 === 'air' ? 'AIRBALL' : s.kind === 'jumper' && Math.abs(s.res.off) <= s.half + 40 ? 'IN AND OUT' : 'NO GOOD', 0, pts)
      }
    }
    const p = g.pass
    if (p && g.t >= p.land) {
      g.pass = null
      if (p.thief >= 0) {
        g.phase = 'over'
        const q = men[p.thief]; q.x = p.ix; q.z = p.iz
        g.fx.push('catchball', 'h:heavy'); g.nudge.kick(g.t, 2.5, 0, 1, 160)
        g.stolen = { at: g.t, by: p.thief }
        end(0.05, false, 'Picked off', 'PICKED OFF', 0, 2)
        return
      }
      const R = men[p.to]
      g.h = p.to; g.catchAt = g.t; g.called = false
      g.catchShot = 330 + r() * 220   // (catch, square up, let it go)
      R.hand = R.x < 0 ? 1 : -1
      g.fx.push('catchball', 'h:light')
      // his man flies at him; the help gets back to his own
      const d = men[5 + p.to]; d.st = d.st === 'ankles' ? d.st : 'closing'; d.closing = g.t
      g.help = null
      for (let i = 5; i < 10; i++) men[i].help = false
      g.stillSince = g.t
    }
  }
  function violation() {
    g.phase = 'over'
    g.fx.push('whistle', 'h:heavy')
    g.shot = null
    end(0, false, 'Shot clock', 'SHOT CLOCK', 0, 2, true)
  }
  function end(score, hit, note, word, made, pts, out = false) {
    if (g.done) return
    g.done = outcome(score, hit, note, { made, of: 1, pts }, out)
    g.endAt = g.t
    g.outro = hit ? 2700 : 2000
    g.stamp = { text: word, good: hit, at: g.t + 60, size: word.length > 10 ? 34 : 46 }
    g.hud.prompt = null
  }

  // ── the pass ──
  function laneRisk(P, R, skip = -1) {
    let min = Infinity, who = -1, at = 0
    const ax = R.x - P.x, az = R.z - P.z, L2 = ax * ax + az * az || 1
    for (let i = 5; i < 10; i++) {
      if (i === skip) continue
      const q = men[i]
      if (q.st === 'ankles') continue
      const t = clamp(((q.x - P.x) * ax + (q.z - P.z) * az) / L2, 0.12, 0.94)
      const e = hyp(P.x + ax * t - q.x, P.z + az * t - q.z)
      if (e < min) { min = e; who = i; at = t }
    }
    return { e: min, who, at }
  }
  const openOf = j => { let m = Infinity; for (let i = 5; i < 10; i++) { const q = men[i]; m = Math.min(m, hyp(q.x - men[j].x, q.z - men[j].z) + (q.st === 'ankles' ? 6 : q.st === 'bit' || q.st === 'spun' ? 2 : 0)) } return m }
  function bestPass() {
    const P = men[g.h]
    let best = -1, bs = -Infinity
    for (let j = 0; j < 5; j++) {
      if (j === g.h) continue
      const R = men[j], dist = hyp(R.x - P.x, R.z - P.z)
      if (dist > 42) continue
      const lr = laneRisk(P, R)
      const sc = Math.min(openOf(j), 12) - clamp((2.6 - lr.e) / 2.6, 0, 1) * 6 - dist * 0.04 + (hyp(R.x, R.z) < 9 ? 1.5 : 0)
      if (sc > bs) { bs = sc; best = j }
    }
    return best
  }
  // a kick-out: the man he found catches and shoots. How open he is (and from where) decides it
  function callBack() {}
  function teamShot() {
    const H = men[g.h], D = hyp(H.x, H.z)
    g.phase = 'shot'; g.mv = null; g.burst = null
    const s = g.shot = { kind: 'jumper', auto: true, at: g.t, D, three: isThree(H.x, H.z), x0: H.x, z0: H.z, rel: null, res: null, fill: 600, c: 450, half: 60, pull: 1, p: 0, tau: 0, held: true, contest: 0, lean: 0 }
    const ct = contestOn(H)
    s.contest = ct.c; s.front = ct.front; s.by = ct.by
    // a decent shooter's make rate from there, wide open; a hand in his face takes most of it away
    const base = D < 14 ? 0.56 : s.three ? lerp(0.44, 0.2, clamp((D - THREE_D) / 8, 0, 1)) : 0.48
    s.makeP = clamp(base * (1 - 0.7 * ct.c) * lerp(0.92, 1.12, ct.open), 0.04, 0.68)
    s.relAt = g.t + 420
    g.fx.push('h:light')
  }
  function giveBack() { passTo(0, true) }
  function passIt() {
    if (g.phase !== 'live' || g.pass || g.mv?.kind === 'spin' || g.h !== 0) return
    const j = bestPass()
    if (j < 0) return
    passTo(j)
  }
  function passTo(j, back = false) {
    const P = men[g.h], R = men[j], dist = hyp(R.x - P.x, R.z - P.z)
    const lr = laneRisk(P, R)
    // in his lane, he gets a hand on it. Further off it he might
    let thief = -1
    if (!back && (lr.e < 0.9 || (lr.e < 1.7 && r() < ((1.7 - lr.e) / 0.8) * 0.45))) thief = lr.who
    else if (back && lr.e < 0.5 && r() < 0.25) thief = lr.who   // (the give-back: over the top, only a man right in it gets a hand on it)
    const ms = 110 + dist / PASS_V
    g.pass = { from: g.h, to: j, at: g.t, land: g.t + ms, x0: P.x, z0: P.z, x1: R.x, z1: R.z, thief, ix: 0, iz: 0, dist }
    if (thief >= 0) { const ax = R.x - P.x, az = R.z - P.z; g.pass.ix = P.x + ax * lr.at; g.pass.iz = P.z + az * lr.at; g.pass.land = g.t + 110 + (dist * lr.at) / PASS_V }
    g.mv = null; g.burst = null
    g.fx.push('swoosh', 'h:light')
  }

  // ── your four ──
  let spotsAt = -1
  function teammates(dt) {
    const H = men[g.h]
    if (g.t - spotsAt >= 200) { spotsAt = g.t; pickSpots(H) }
    for (let j = 0; j < 5; j++) {
      if (j === 0) continue
      const m = men[j]
      if (j === g.h && !g.done) { m.vx *= 0.82; m.vz *= 0.82; m.x += m.vx * dt; m.z += m.vz * dt; continue }
      // the man a pass is going to comes to meet it
      if (g.pass?.to === j) { m.vx *= 0.85; m.vz *= 0.85; m.x += m.vx * dt; m.z += m.vz * dt; continue }
      if (g.done && g.done.hit && g.t - g.endAt > 150) {
        // they all go to him
        const a = Math.atan2(m.x - H.x, m.z - H.z), want = 2.6 + j * 0.25
        steer(m, H.x + Math.sin(a) * want, H.z + Math.cos(a) * want, TM_V * 1.1, 120, dt)
      } else if (g.phase === 'over' || g.shot?.rel) {
        // the shot's up: the big crashes, the rest stay home
        if (m.big && g.shot?.rel) steer(m, m.x * 0.5, Math.min(m.z, 0) * 0.4 - 2, TM_V, 150, dt)
        else { m.vx *= 0.9; m.vz *= 0.9 }
      } else steer(m, m.tx, m.tz, TM_V, 130, dt)
      m.x += m.vx * dt; m.z += m.vz * dt
      m.run += hyp(m.vx, m.vz) * dt
      bound(m)
    }
  }
  function pickSpots(H) {
    const dRim = hyp(H.x, H.z)
    const driving = dRim < 22 && (H.vx * -H.x + H.vz * -H.z) / (dRim || 1) > 0.006
    const taken = []
    const big = men.find((m, i) => i < 5 && m.big && i !== g.h)
    if (big) {
      // the big lives on the dunker spot away from the ball
      const side = Math.abs(H.x) < 3 ? (big.tx < 0 ? 0 : 1) : H.x > 0 ? 0 : 1
      big.tx = DUNKER[side].x; big.tz = DUNKER[side].z
      taken.push(DUNKER[side])
    }
    const shooters = []
    for (let j = 0; j < 5; j++) if (j !== g.h && men[j] !== big) shooters.push(men[j])
    // whoever's furthest from a good spot picks last
    const free = SPOTS.filter(s => {
      if (hyp(s.x - H.x, s.z - H.z) < 11.5) return false
      if (driving) {
        const ax = -H.x, az = -H.z, L2 = ax * ax + az * az || 1, t = clamp(((s.x - H.x) * ax + (s.z - H.z) * az) / L2, 0, 1)
        if (hyp(H.x + ax * t - s.x, H.z + az * t - s.z) < 7) return false
      }
      return true
    })
    const order = shooters.map(m => ({ m, d: Math.min(...free.map(s => hyp(s.x - m.x, s.z - m.z))) })).sort((a, b) => a.d - b.d)
    for (const { m } of order) {
      let best = null, bc = Infinity
      for (const s of free) {
        if (taken.includes(s)) continue
        const crowd = taken.some(q => hyp(q.x - s.x, q.z - s.z) < 10) ? 30 : 0
        const c = hyp(s.x - m.x, s.z - m.z) * 0.22 + s.w + crowd
        if (c < bc) { bc = c; best = s }
      }
      if (best) { taken.push(best); m.tx = best.x; m.tz = best.z }
    }
  }
  function steer(m, tx, tz, vmax, tau, dt) {
    const dx = tx - m.x, dz = tz - m.z, d = hyp(dx, dz)
    const want = d < 0.08 ? 0 : Math.min(vmax, d / 120)
    const wx = d > 1e-6 ? (dx / d) * want : 0, wz = d > 1e-6 ? (dz / d) * want : 0
    const k = 1 - Math.exp(-dt / tau)
    m.vx += (wx - m.vx) * k; m.vz += (wz - m.vz) * k
  }

  // ── their five ──
  const P0 = { x: 0, z: 0 }
  function defense(dt) {
    const H = men[g.h], dOn = men[5 + g.h], dRim = hyp(H.x, H.z)
    const ballX = g.pass ? lerp(g.pass.x0, g.pass.x1, prog(g.t, g.pass.at, g.pass.land)) : H.x
    const ballZ = g.pass ? lerp(g.pass.z0, g.pass.z1, prog(g.t, g.pass.at, g.pass.land)) : H.z
    // the help: your man's not between you and the rim and you're coming, or you're in the paint
    const live = g.phase === 'live' && !g.pass
    const beaten = live && (!inFront(dOn, H) || dOn.st !== 'ok') && dRim < 23
    if (beaten) g.beatenSince ??= g.t; else g.beatenSince = null
    if (live && !g.help && ((g.beatenSince != null && g.t - g.beatenSince > 90) || dRim < 10)) {
      // the man nearest where you're going steps over
      const u = toRim(H), sx = H.x + u.x * 3.2, sz = H.z + u.z * 3.2
      let best = -1, bd = Infinity
      for (let i = 5; i < 10; i++) { if (i === 5 + g.h) continue; const q = men[i]; if (q.st === 'ankles') continue; const e = hyp(q.x - sx, q.z - sz) + (hyp(q.x, q.z) > 16 ? 6 : 0); if (e < bd) { bd = e; best = i } }
      if (best >= 0 && bd < 17) { g.help = { d: best, at: g.t + HELP_REACT }; men[best].help = true }
    }
    if (g.help && (!live || (inFront(dOn, H) && dOn.st === 'ok' && dRim > 12))) { men[g.help.d].help = false; g.help = null }
    for (let i = 5; i < 10; i++) {
      const q = men[i], man = men[i - 5]
      if (q.st !== 'ok' && q.st !== 'closing' && g.t >= q.stEnd) { q.st = 'ok' }
      if (q.st === 'closing' && (g.t - q.closing > 650 || hyp(q.x - man.x, q.z - man.z) < GAP + 0.6)) q.st = 'ok'
      let tx, tz, vmax = SLIDE_V, acc = DEF_ACC, lateral = true
      if (g.done) {
        // it's over: a make, hands on hips; anything else, they're off the other way
        if (g.done.hit) { q.vx *= 0.9; q.vz *= 0.9 } else steer(q, q.x * 0.9, q.z - 8, 0.012, 300, dt)
        q.x += q.vx * dt; q.z += q.vz * dt
        continue
      }
      if (g.shot?.rel || (g.phase === 'shot' && i !== 5 + g.h && i !== g.shot?.by)) {
        // the shot: the man on him goes at him, the rest turn and find a body
        if (i === g.shot?.by || i === 5 + g.h) { const u = toRim(H); tx = H.x + u.x * 2.2; tz = H.z + u.z * 2.2; vmax = CLOSE_V }
        else { tx = man.x * 0.75; tz = man.z * 0.75 - 0.8; vmax = 0.013 }
        lateral = false
      } else if (i === 5 + g.h && !g.pass) {
        // on the ball: between you and the rim, reading you a beat late
        const lag = q.lag + (q.hesi && g.t < q.hesi ? 110 : 0)
        g.seen(lag, SEEN)
        const sx = SEEN.x + SEEN.vx * 60, sz = SEEN.z
        const d = hyp(sx, sz) || 1, gap = Math.min(GAP, Math.max(1.2, d - 1.5))
        tx = sx - (sx / d) * gap; tz = sz - (sz / d) * gap
        if (q.st === 'closing') { vmax = CLOSE_V; acc = CLOSE_ACC }
        // beaten, level with you or behind: he turns his hips and runs to cut you off, no more sliding
        const u = toRim(H), ahead = (q.x - H.x) * u.x + (q.z - H.z) * u.z
        if (ahead < 0.9 && q.st === 'ok') { lateral = false; vmax = CHASE_V; acc = 110; q.chase = g.t } else if (q.chase && g.t - q.chase > 260) q.chase = 0
      } else if (g.help?.d === i && g.t >= g.help.at) {
        const u = toRim(H); tx = H.x + u.x * 2.9; tz = H.z + u.z * 2.9; vmax = HELP_V; lateral = false
      } else {
        // off the ball: goal-side of his man, sagged off toward the ball, more the further he is from it
        const away = hyp(man.x - ballX, man.z - ballZ)
        let sag = away > 24 ? 0.46 : away > 15 ? 0.33 : 0.22
        if (g.help) sag += 0.12
        P0.x = lerp(ballX, 0, 0.45); P0.z = lerp(ballZ, 0, 0.45)
        tx = lerp(man.x, P0.x, sag); tz = lerp(man.z, P0.z, sag)
        // never further off him than a closeout can make up, and always a step goal-side
        const ox = tx - man.x, oz = tz - man.z, od = hyp(ox, oz)
        if (od > 10) { tx = man.x + (ox / od) * 10; tz = man.z + (oz / od) * 10 }
        const md = hyp(man.x, man.z) || 1
        tx -= (man.x / md) * 1.4; tz -= (man.z / md) * 1.4
        vmax = 0.0145
      }
      // what his state does to him: bitten, he keeps going the wrong way a beat, then gets back slowly
      let slow = 1
      if (q.st === 'bit') { slow = g.t - q.stAt < 200 ? 0 : 0.35 }
      else if (q.st === 'ankles') slow = g.t - q.stAt < 650 ? 0 : 0.3
      else if (q.st === 'spun') slow = 0.3
      else if (q.st === 'off') slow = 0.45
      else if (q.st === 'reach') slow = 0.5
      if (slow === 0) {
        // momentum: he slides on the way he was going and stops
        const k = 1 - Math.exp(-dt / (q.st === 'ankles' ? 120 : 160)); q.vx -= q.vx * k; q.vz -= q.vz * k
      } else if (lateral) {
        // a defender's feet: quickest sliding across, slower backing up toward the rim, quick closing out
        const dx = tx - q.x, dz = tz - q.z, d = hyp(dx, dz)
        const want = d < 0.05 ? 0 : Math.min(0.03, d / 95)
        let wx = d > 1e-6 ? (dx / d) * want : 0, wz = d > 1e-6 ? (dz / d) * want : 0
        const u = toRim(q), along = wx * u.x + wz * u.z, px = -u.z, pz = u.x, across = wx * px + wz * pz
        const a2 = clamp(along, -(q.st === 'closing' ? CLOSE_V : 0.0168), BACK_V) * slow, c2 = clamp(across, -vmax, vmax) * slow
        wx = u.x * a2 + px * c2; wz = u.z * a2 + pz * c2
        const m2 = hyp(wx, wz), cap = Math.max(vmax, q.st === 'closing' ? CLOSE_V : 0) * slow
        if (m2 > cap) { wx *= cap / m2; wz *= cap / m2 }
        const k = 1 - Math.exp(-dt / acc)
        q.vx += (wx - q.vx) * k; q.vz += (wz - q.vz) * k
      } else steer(q, tx, tz, vmax * slow, acc, dt)
      q.x += q.vx * dt; q.z += q.vz * dt
      q.run += hyp(q.vx, q.vz) * dt
      bound(q)
    }
  }
  // nobody goes through anybody: you're walled off by a man in front of you
  function collide() {
    const H = men[g.h], spin = g.mv?.kind === 'spin' ? g.mv.on : -2
    for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) {
      const A = men[a], B = men[b]
      if (A.o === B.o && A.o) continue
      if ((a === g.h && b === spin) || (b === g.h && a === spin)) continue
      if (A.st === 'ankles' || B.st === 'ankles') continue
      const dx = B.x - A.x, dz = B.z - A.z, d = hyp(dx, dz)
      const min = A.o === B.o ? 1.7 : BODY
      if (d >= min || d < 1e-6) continue
      const nx = dx / d, nz = dz / d, push = min - d
      // the ball handler gives way to a man set in front of him; anyone else, half each
      const hw = g.phase === 'shot' || g.shot ? 0.08 : 0.8
      const wa = A === H ? hw : B === H ? 1 - hw : 0.5
      A.x -= nx * push * wa; A.z -= nz * push * wa; B.x += nx * push * (1 - wa); B.z += nz * push * (1 - wa)
      const va = A.vx * nx + A.vz * nz, vb = B.vx * nx + B.vz * nz
      if (va > vb) { const j = (va - vb) * 0.5; A.vx -= nx * j * 1.4 * wa * 2; A.vz -= nz * j * 1.4 * wa * 2; B.vx += nx * j * (1 - wa) * 2; B.vz += nz * j * (1 - wa) * 2 }
    }
  }
  // the hands: a man on you or in the gap comes for the ball. You see it start, and the ball in the other hand is safe
  const BALL = { x: 0, z: 0 }
  function ballSpot(H, o = BALL) { o.x = H.x + H.hand * 1.4; o.z = H.z + 0.5; return o }
  function reaches(dt) {
    if (g.pass || g.mv?.kind === 'spin') return
    const H = men[g.h]
    ballSpot(H)
    let close = 0
    for (let i = 5; i < 10; i++) { const q = men[i]; if (hyp(q.x - H.x, q.z - H.z) < 3.4 && q.st === 'ok') close++ }
    const still = g.t - g.stillSince > 750
    for (let i = 5; i < 10; i++) {
      const q = men[i]
      if (q.st === 'reach') {
        if (g.t >= q.stAt + REACH_MS) {
          ballSpot(H)
          const e = hyp(BALL.x - q.reach.x, BALL.z - q.reach.z)
          if (e < byV(v, 1.55, 1.1)) {
            g.phase = 'over'
            g.stolen = { at: g.t, by: i }
            g.fx.push('catchball', 'h:heavy'); g.nudge.kick(g.t, 3, 0, 1, 170)
            end(0.04, false, 'Stripped', 'STRIPPED', 0, 2)
            return
          }
          q.st = 'off'; q.stAt = g.t; q.stEnd = g.t + WHIFF_MS; q.reach = null
          g.word = { text: 'REACHED', at: g.t, i }
        }
        continue
      }
      if (q.st !== 'ok' || g.t < (q.noReach ?? 0)) continue
      const e = hyp(BALL.x - q.x, BALL.z - q.z)
      if (e > 3.3) continue
      let rate = i === 5 + g.h ? 0.00032 : 0.00062
      if (g.mv && g.t - g.mv.at < 320) rate *= 2.4
      if (still) rate *= 1.9
      if (close >= 2) rate *= 2
      if (e < 2.4) rate *= 1.4
      if (r() < rate * dt) {
        q.st = 'reach'; q.stAt = g.t; q.stEnd = g.t + REACH_MS + 50
        const k = Math.min(2.1, e) / (e || 1)
        q.reach = { x: q.x + (BALL.x - q.x) * k, z: q.z + (BALL.z - q.z) * k, side: BALL.x > q.x ? 1 : -1 }
        q.noReach = g.t + 1300
      }
    }
  }
  // before the clock: everyone into his spot
  function settleMen(dt) { teammates(dt); defense(dt) }
  return g
}

// the controls on a touch screen, in the screen's units
const CTL = new Map()
export function ctlOf(h) {
  let c = CTL.get(h)
  if (!c) { c = { stick: { x: 82, y: h - 96, R: 44 }, shoot: { x: 360 - 66, y: h - 92, r: 42 }, pass: { x: 360 - 162, y: h - 62, r: 28 } }; CTL.set(h, c) }
  return c
}

// ── The picture ─────────────────────────────────────────────────────────────
// High behind the ball, the whole half court in front of it: the lens rides BACK feet behind whoever has it.
const BACK = 15
const CAM = { H: 17, D: 50, F: 312, hzAt: 0.26 }
let G0 = null
const geoOf = view => (G0 && G0.h === view.h ? G0 : (G0 = Object.assign(arenaCam(view.h, CAM), { full: true, sc: CS })))
const both = o => { const R = pose(o); return { [1]: R, [-1]: mirror(R) } }
function mirror(P) {
  const o = pose({})
  o.hx = -P.hx; o.hy = P.hy; o.lean = -P.lean; o.j = P.j
  o.fFx = -P.fBx; o.fFy = P.fBy; o.fBx = -P.fFx; o.fBy = P.fFy; o.toeF = P.toeB; o.toeB = P.toeF
  o.hFx = -P.hBx; o.hFy = P.hBy; o.hBx = -P.hFx; o.hBy = P.hFy
  return o
}
// the ball handler's moves (Lockdown's, seen from behind him)
const P_CROSS = both({ hy: 33, lean: 0.14, hx: 3, fFx: 21, fBx: -21, hFx: 19, hFy: 17, hBx: -15, hBy: 16 })
const P_SPIN = pose({ hy: 40, lean: 0, fFx: 15, fBx: -15, hFx: 34, hFy: 48, hBx: -30, hBy: 70 })
const P_GATHER = pose({ hy: 43, fFx: 12, fBx: -12, hFx: 15, hFy: 94, hBx: 2.5, hBy: 95 })
const P_DUNK = pose({ hy: 49, fFx: 8, fBx: -8, fFy: 2, fBy: 7, hFx: 6, hFy: 122, hBx: -22, hBy: 80 })
const P_PASS = both({ hy: 45, fFx: 14, fBx: -11, hFx: 46, hFy: 76, hBx: 20, hBy: 80 })
const CALL = pose({ hy: 46, fFx: 12, fBx: -12, hFx: 20, hFy: 84, hBx: -20, hBy: 84 }); CALL.id = 'call'
const FIST = pose({ hy: 47, fFx: 13, fBx: -13, hFx: 18, hFy: 122, hBx: -20, hBy: 47 })
const HEADS = pose({ hy: 46, fFx: 11, fBx: -11, hFx: 12, hFy: 104, hBx: -12, hBy: 104 })
// the defense: sat down, hands working; up at a shot; bitten and stumbling; on the seat of his shorts
const D_ST = pose({ hy: 36, fFx: 21, fBx: -21, hFx: 33, hFy: 58, hBx: -31, hBy: 64 }); D_ST.id = 'dst'
const D_ST2 = pose({ hy: 36, fFx: 21, fBx: -21, hFx: 31, hFy: 64, hBx: -33, hBy: 58 }); D_ST2.id = 'dst2'
const D_BIT = both({ hx: 9, hy: 33, lean: 0.2, fFx: 34, fBx: -10, fBy: 4, hFx: 54, hFy: 50, hBx: -16, hBy: 66 })
const D_CONTEST = pose({ hy: 49, fFx: 9, fBx: -9, fFy: 2, fBy: 4, hFx: 13, hFy: 128, hBx: -9, hBy: 126 })
const P_SIT = pose({ hy: 15, fFx: 30, fFy: 3, fBx: -30, fBy: 3, hFx: 26, hFy: 6, hBx: -26, hBy: 6 })
const ST = Array.from({ length: 10 }, () => easedState()), PP = Array.from({ length: 10 }, () => newPose())
const STRIDE = 2.9
const DRIB = 380
const rattle = age => (age < 0 || age > 600 ? 0 : Math.sin(age / 26) * 3.2 * Math.exp(-age / 200))
const ORDER = []
const SKIN_OF = [SKINS[0], SKINS[2], SKINS[1], SKINS[3], SKINS[1], SKINS[1], SKINS[3], SKINS[0], SKINS[2], SKINS[3]]
const NUM_OF = [3, 11, 23, 8, 34, 5, 14, 2, 21, 50]

export function draw(ctx, g, view) {
  g.vh = view.h; g.keysView = !!view.keys
  const T = smoothT(g), dt = CLK.dt
  const c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1), G = geoOf(view), U = view.h / 640
  const men = g.men, H = men[g.h], s = g.shot
  const M = castMen(g, view)
  // the camera: behind the ball, a little toward it across the floor
  const C = g.cm ?? (g.cm = { z: H.z - BACK, x: H.x * 0.55, t: g.t })
  const me = men[0], ballMan = g.pass ? men[g.pass.to] : H
  const fz = (me.z * 2 + ballMan.z) / 3, fx = (me.x * 2 + ballMan.x) / 3
  const tz = clamp(fz - BACK, -60, -19), tx = clamp(fx * 0.55, -9, 9)
  const k = 1 - Math.exp(-clamp(g.t - C.t, 0, 60) / 280); C.t = g.t
  C.z += (tz - C.z) * k; C.x += (tx - C.x) * k
  dolly(G, -C.z, C.x)
  const cam = G.cam
  arenaStage(ctx, view, G, 'hc', true)
  const dy = wallNow(G) - G.wallY
  if (!g._warm) { g._warm = true; if (!lightFx()) { warmCrowd(view, G, c, 'board'); crowdPop(ctx, view, [c.us, c.trim], -1, { foot: G.wallY - 22 * U }) } }
  // the building: on its feet as the clock runs down, up and roaring on a make
  const made = g.done?.hit, endAge = g.endAt != null ? g.t - g.endAt : -1
  if (!g.done && g.clock < 4000 && g.phase !== 'set' && !lightFx()) { ctx.save(); ctx.translate(0, dy); crowdUp(ctx, view, G, c, 'board', g.t, 170); ctx.restore() }
  if (made && endAge >= 0) {
    ctx.save(); ctx.translate(0, dy)
    crowdPop(ctx, view, [c.us, c.trim], endAge, { ms: 2200, power: s?.kind === 'dunk' || s?.three ? 1 : 0.8, foot: G.wallY - 22 * U })
    if (endAge < 1100) { camFlashes(ctx, view, G, g.t, s?.buzzer || s?.kind === 'dunk' ? 18 : 12); boardFlash(ctx, view, G, c.us, 0.55 * (1 - endAge / 1100)) }
    ctx.restore()
  }
  shotClock(ctx, g, cam)

  // ── the ball ──
  let ball = AB, netAge = null, spin = g.t / 160, rimDy = 0, inHands = false
  const top = Math.abs(Math.cos((Math.PI * g.t) / DRIB))
  if (g.stolen) {
    // the thief has it, and he's gone the other way
    const q = men[g.stolen.by], u = g.t - g.stolen.at
    if (u < 260) flyTo(ballSpotOf(H).x, 2, H.z + 0.5, q.x + 0.9, 3, q.z - 0.4, u / 260, 0.6)
    else { AB.x = q.x + 1.3; AB.z = q.z - 0.5; AB.y = lerp(BALL_R, 2.7, Math.abs(Math.cos((Math.PI * u) / 330))) }
  } else if (g.pass) {
    const p = g.pass, f = prog(g.t, p.at, p.land)
    const ex = p.thief >= 0 ? p.ix : men[p.to].x, ez = p.thief >= 0 ? p.iz : men[p.to].z
    flyTo(p.x0 + (men[p.from].hand ?? 1) * 0.6, 4.4, p.z0 + 0.5, ex, 4.2, ez, f, Math.min(3.5, p.dist * 0.06))
    spin = g.t / 80
  } else if (s && s.kind === 'jumper') {
    const D = s.D
    if (!s.rel) { inHands = true; ball = null }
    else {
      const u = g.t - s.rel
      const fx = H.x + 0.25, fz = H.z + 0.6, fy = 8.6 + jumpOf(s, g.t) / FIG_FT
      if (s.res.block) {
        const bu = g.t - s.rel
        if (bu < 260) flyTo(fx, fy, fz, fx + (s.x0 < 0 ? -0.4 : 0.4), fy + 1.4, fz + 1.4, bu / 260, 0.4)
        else { const b = (bu - 260) / 700, o = H.x <= 0 ? -1 : 1; flyTo(fx, fy + 1.4, fz + 1.4, fx + o * 9, BALL_R, fz - 4, clamp(b, 0, 1), 3); if (b > 1) { const q = b - 1; AB.x = fx + o * (9 + q * 3); AB.z = fz - 4 - q * 3; AB.y = BALL_R + Math.abs(Math.sin(q * 6)) * 1.4 * Math.exp(-q * 2.4) } }
        spin = bu / 40
      } else if (u < s.fly) { flyTo(fx, fy, fz, 0, RIM_Y + 0.3, -0.08, u / s.fly, shotApex(D)); spin = u / 70 }
      else {
        const v = u - s.fly
        if (s.res.in) {
          if (s.kind2 === 'rattle' && v < 220) { AB.x = Math.sin(v / 40) * RIM_R * 0.6; AB.z = Math.cos(v / 40) * RIM_R * 0.6 - 0.05; AB.y = RIM_Y + 0.3; rimDy = rattle(v) * U }
          else { const w = s.kind2 === 'rattle' ? v - 220 : v; dropThrough(w); netAge = w }
        } else missPath(v, s, H)
        spin = u / 70
      }
    }
  } else if (s) {
    // a layup or a dunk
    const u = g.t - s.at, relAt = s.kind === 'dunk' ? DUNK_AT : LAY_REL
    if (!s.rel || g.t - s.rel < 0) { inHands = true; ball = null }
    else {
      const v = g.t - s.rel
      if (s.res.block) {
        const o = s.side
        if (v < 140) { inHands = true; ball = null }
        else { const b = (v - 140) / 720; flyTo(H.x + 0.3, 10, H.z + 0.8, o * 14, BALL_R, H.z - 6, clamp(b, 0, 1), 2.2); if (b > 1) { const q = b - 1; AB.x = o * (14 + q * 3); AB.z = H.z - 6 - q * 3; AB.y = BALL_R + Math.abs(Math.sin(q * 6)) * 1.4 * Math.exp(-q * 2.4) } spin = v / 40 }
      } else if (s.kind === 'dunk') {
        if (s.res.in) { dropThrough(v); netAge = v; rimDy = rattle(v) * U * 1.4 }
        else missPath(v, s, H)
      } else if (v < s.fly) flyTo(H.x + 0.25, 9.6, H.z + 0.6, 0, RIM_Y + 0.35, -0.1, v / s.fly, 0.8)
      else if (s.res.in) { dropThrough(v - s.fly); netAge = v - s.fly }
      else missPath(v - s.fly, s, H)
    }
    void u; void relAt
  } else {
    // on the bounce, in his hand away from his man, crossing low on a crossover
    const mv = g.mv, b = ballSpotOf(H)
    if (mv?.kind === 'cross' && g.t < mv.end) {
      const f = prog(g.t, mv.at, mv.end)
      AB.x = H.x + lerp(-mv.side, mv.side, f) * 1.4; AB.z = H.z + 0.55; AB.y = BALL_R + 1.1 * Math.abs(Math.cos(Math.PI * f))
      spin = f * 6 * mv.side
    } else if (mv?.kind === 'spin' && g.t < mv.end) {
      const f = prog(g.t, mv.at, mv.end), a = f * Math.PI * 2 * mv.side
      AB.x = H.x + Math.cos(a) * 1.4 * H.hand; AB.z = H.z + Math.sin(a) * 1.1; AB.y = lerp(BALL_R, 2.4, Math.abs(Math.cos(f * Math.PI * 1.5)))
    } else if (g.phase === 'set') { inHands = true; ball = null }
    else { AB.x = b.x; AB.z = b.z; AB.y = lerp(BALL_R, 2.7, top) }
    const bn = Math.floor(g.t / DRIB + 0.5)
    if (ball && g.phase === 'live' && bn !== g._bn) { g._bn = bn; g.fx.push('dribble') }
  }
  const atIron = hoopWith(ctx, cam, ball && (s?.rel || g.done) ? ball : null, netAge, spin, rimDy)

  // ── the men, far to near ──
  ORDER.length = 0
  for (let i = 0; i < 10; i++) ORDER.push(i)
  ORDER.sort((a, b) => men[b].z - men[a].z)
  let ballDrawn = !ball || atIron
  const tgt = g.target
  for (const i of ORDER) {
    const m = men[i]
    if (!ballDrawn && AB.z > m.z) { ballIn(ctx, cam, AB.x, AB.y, AB.z, spin); ballDrawn = true }
    // the pass: a flat ring on the floor under the man it'd go to, while he's open
    if (i === tgt && !g.done && !g.shot && !g.pass) {
      project(cam, m.x, 0, m.z)
      if (PT.z > 2) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1.4, 0.16 * PT.k); ctx.beginPath(); ctx.ellipse(PT.x, PT.y + 1, 1.9 * PT.k, 0.62 * PT.k, 0, 0, Math.PI * 2); ctx.stroke() }
    }
    if (i === g.h && !g.done && g.phase !== 'set') {
      // you: a ring under your feet in your colour
      project(cam, m.x, 0, m.z)
      if (PT.z > 2) { ctx.strokeStyle = c.trim; ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(1.6, 0.18 * PT.k); ctx.beginPath(); ctx.ellipse(PT.x, PT.y + 1, 1.7 * PT.k, 0.55 * PT.k, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
    }
    const { P, back, live, hop } = poseOf(g, i, T, dt, cam)
    const who = M ? (m.o ? M.us[i] : M.them[i - 5]) : null
    const side = m.o ? us : them
    const o = { jersey: side.color, trim: side.trim, skin: who?.skin ?? SKIN_OF[i], num: who?.number ?? NUM_OF[i], back, live, ball: inHands && i === g.h ? IN_HANDS : null, spin }
    const PJ = hop ? liftPose(P, hop) : P
    if (!manAt(ctx, view, cam, m.x, m.z, PJ, o)) continue
    if (M && PT.x > 6 && PT.x < view.w - 6) tagAt(PT.x, PT.y - 11 - (PJ.j ?? 0) * (PT.k / FIG_FT), who?.name, PT.k / FIG_FT)
  }
  if (M) tagsDown(ctx, view)
  if (!ballDrawn) ballIn(ctx, cam, AB.x, AB.y, AB.z, spin)
  g.dust.draw(ctx, g.t, true)

  // the word over a man you've beaten
  if (g.word && g.t - g.word.at < 760 && g.t >= g.word.at) {
    const q = men[g.word.i]
    project(cam, q.x, 7.2, q.z)
    const a = g.t - g.word.at
    ctx.globalAlpha = a > 520 ? 1 - (a - 520) / 240 : 1
    text(ctx, g.word.text, clamp(PT.x, 50, view.w - 50), PT.y - 6 * U, { font: DISPLAY, size: 19 * U, color: g.word.text === 'REACHED' ? GOLD : GOOD })
    ctx.globalAlpha = 1
    if (g.word.text === 'ANKLES' && !g.word.puff && a > 250) { g.word.puff = true; project(cam, q.x, 0, q.z); g.dust.burst('dust', PT.x, PT.y, g.t, { n: 9, s: PT.k / 9, spread: 1.4 }) }
  }
  // the meter, beside the shooter
  if ((s?.kind === 'jumper' && !s.auto) || s?.meter) shotMeter(ctx, view, g, s, cam, H, U)
  if (g.stamp && g.stamp.y == null) g.stamp.y = view.h * 0.3
  if (g.later && g.later.y == null) g.later.y = view.h * 0.3
  drawControls(ctx, view, g, U)
}
function ballSpotOf(H) { return { x: H.x + H.hand * 1.4, z: H.z + 0.5 } }
// a miss: off the iron and away
function missPath(v, s, H) {
  const o = (s.x0 ?? H.x) <= 0 ? 1 : -1, far = s.kind2 === 'air' || s.kind2 === 'board'
  if (s.kind2 === 'air') { flyTo(0, RIM_Y + 0.3, -0.08, o * 1.5, BALL_R, 3.4, clamp(v / 360, 0, 1), 0.2); return }
  const w = v / 700
  flyTo(0.1 * o, RIM_Y + 0.3, -RIM_R - 0.2, o * (far ? 6 : 4.5), BALL_R, -7, clamp(w, 0, 1), 2.8)
  if (w > 1) { const q = w - 1; AB.x = o * ((far ? 6 : 4.5) + q * 2); AB.z = -7 - q * 3; AB.y = BALL_R + Math.abs(Math.sin(q * 5)) * 1.6 * Math.exp(-q * 2) }
}
// how high a jumper has him: up with the hold, the top of it about the release
function jumpOf(s, t) {
  if (!s) return 0
  const u = t - s.at, rise = 34 * easeOut(clamp(u / Math.max(300, s.c * 0.9), 0, 1))
  if (!s.rel) return rise
  const after = t - s.rel
  return rise * (1 - easeInOut(clamp(after / 380, 0, 1)))
}
// every man's body, right now
function poseOf(g, i, T, dt, cam) {
  const m = g.men[i], P = PP[i], st = ST[i], sp = Math.hypot(m.vx, m.vz), H = g.men[g.h], s = g.shot
  const ph = (m.run / STRIDE) * Math.PI
  let back = m.o, live = i === g.h || i === 5 + g.h || (s && i === s.by) || m.st !== 'ok', hop = 0, tau = 26, raw = null
  const endAge = g.endAt != null ? g.t - g.endAt : -1
  if (m.o) {
    if (i === g.h) {
      const mv = g.mv
      if (g.done && !g.done.hit && endAge > 250) raw = endAge > 700 ? R_HEAD : R_HIPS
      else if (g.done?.hit && endAge > 200 && (!s || s.kind !== 'dunk' || endAge > 500)) { raw = FIST; hop = Math.abs(Math.sin(endAge / 150)) * 6 }
      else if (s?.kind === 'jumper') {
        const u = T - s.at
        if (!s.rel) { mixPose(P_GATHER, POSE.shoot, clamp(u / Math.max(260, s.c), 0, 1), P); P.j = jumpOf(s, T); raw = P }
        else { copyPose(POSE.shoot, P); P.j = jumpOf(s, T); if (T - s.rel > 420) copyPose(POSE.land, P); raw = P }
        // on the move: the same shot, just leaning the way he was going (straightening up as he lands)
        if (s.lean) P.lean = (P.lean ?? 0) + s.lean * (s.rel ? clamp(1 - (T - s.rel) / 500, 0, 1) : clamp(u / 160, 0, 1))
        tau = 8
      } else if (s) {
        const u = T - s.at
        if (u < GATHER) { copyPose(P_GATHER, P); raw = P }
        else if (s.kind === 'dunk') { mixPose(P_GATHER, P_DUNK, clamp((u - GATHER) / 160, 0, 1), P); P.j = 66 * Math.sin(Math.PI * clamp((u - GATHER) / 640, 0, 1)); raw = P }
        else { copyPose(POSE.layup, P); P.j = 36 * Math.sin(Math.PI * clamp((u - GATHER) / 620, 0, 1)); raw = P }
        tau = 12
      } else if (g.pass?.from === i && T - g.pass.at < 300) raw = P_PASS[g.men[g.pass.to].x > m.x ? 1 : -1]
      else if (mv?.kind === 'cross' && T < mv.end) { raw = P_CROSS[mv.side]; tau = 10 }
      else if (mv?.kind === 'spin' && T < mv.end) {
        const f = prog(T, mv.at, mv.end)
        copyPose(P_SPIN, P); if (mv.side < 0) copyPose(mirror(P_SPIN), P)
        back = f < 0.3 || f > 0.75   // (round he goes: his back, his front, his back)
        raw = P; tau = 8
      } else if (g.phase === 'set') raw = POSE.hold
      else if (sp > 0.004) {
        frontRun(ph, P)
        P.hy -= 4; const bh = 22 + 14 * Math.abs(Math.cos(ph)) ** 0.8
        if (m.hand > 0) { P.hFx = 29; P.hFy = bh; P.hBx = -20; P.hBy = 62 } else { P.hBx = -29; P.hBy = bh; P.hFx = 20; P.hFy = 62 }
        raw = P
      } else {
        copyPose(m.hand < 0 ? POSE.dribL : POSE.dribR, P)
        const tp = Math.abs(Math.cos((Math.PI * T) / DRIB))
        if (m.hand < 0) P.hBy = 24 + tp * 13; else P.hFy = 24 + tp * 13
        raw = P
      }
      return { P: easedPose(st, raw, g, dt, tau), back, live: true, hop }
    }
    // a teammate
    if (g.done?.hit && endAge > 120) { hop = Math.abs(Math.sin(endAge / 130 + i)) * 10; return { P: R_UP, back: m.z < H.z - 0.5, live: true, hop } }   // (turned to him: a man past him, nearer the rim, faces back toward the camera)
    if (g.done && !g.done.hit && endAge > 300) return { P: R_HIPS, back: true, live: false, hop: 0 }
    if (g.pass?.to === i) return { P: CALL, back: true, live: false, hop: 0 }
    if (sp > 0.004) return { P: RUN[Math.floor(ph / (Math.PI / 2)) & 3], back: true, live: false, hop: 0 }
    // open, and asking for it
    if (g.target === i && !g.shot && openish(g, i)) return { P: CALL, back: true, live: false, hop: 0 }
    return { P: POSE.off, back: true, live: false, hop: 0 }
  }
  // a defender
  if (g.done?.hit && endAge > 300) return { P: R_HIPS, back: false, live: false, hop: 0 }   // (scored on: hands on his hips, never up)
  if (g.stolen?.by === i) { frontRun(ph, P); return { P, back: false, live: true, hop: 0 } }
  if (g.done && !g.done.hit && endAge > 200) { if (sp > 0.004) { frontRun(ph, P); return { P, back: false, live: true, hop: 0 } } return { P: POSE.off, back: false, live: false, hop: 0 } }
  if (m.jump && T - m.jump < 640 && T - m.jump > -100) {
    copyPose(D_CONTEST, P); P.j = 40 * Math.sin(Math.PI * clamp((T - m.jump) / 600, 0, 1))
    return { P: easedPose(st, P, g, dt, 14), back: false, live: true, hop: 0 }
  }
  const side = Math.sign(m.vx) || 1
  if (m.st === 'ankles') {
    const u = T - m.stAt
    raw = u < 220 ? D_BIT[side] : u < 650 ? P_SIT : POSE.land
    return { P: easedPose(st, raw, g, dt, 30), back: false, live: true, hop: 0 }
  }
  if (m.st === 'bit' || m.st === 'off') return { P: easedPose(st, D_BIT[m.st === 'off' && m.reach ? m.reach.side : side], g, dt, 20), back: false, live: true, hop: 0 }
  if (m.st === 'spun') return { P: easedPose(st, POSE.stumbleR, g, dt, 20), back: (T - m.stAt) > 200 && (T - m.stAt) < 520, live: true, hop: 0 }
  if (m.st === 'reach') { const sd = m.reach?.side ?? 1; return { P: easedPose(st, sd < 0 ? POSE.reachL : POSE.reachR, g, dt, 12), back: false, live: true, hop: 0 } }
  if (i === 5 + g.h || m.help) {
    const lat = Math.abs(m.vx) > Math.abs(m.vz)
    if (sp > 0.012 && !lat) { frontRun(ph, P); raw = P }
    else if (sp > 0.004) raw = Math.floor(m.run / 1.6) % 2 ? POSE.slideA : POSE.slideB
    else raw = Math.floor(T / 260) % 2 ? D_ST : D_ST2
    return { P: easedPose(st, raw, g, dt, 24), back: sp > 0.012 && !lat && m.vz > 0, live: true, hop: 0 }
  }
  if (sp > 0.006) return { P: RUN[Math.floor(ph / (Math.PI / 2)) & 3], back: m.vz > 0.004, live: false, hop: 0 }
  return { P: Math.floor(T / 420 + i) % 2 ? POSE.guardA : POSE.guardB, back: false, live: false, hop: 0 }
}
function openish(g, j) { const m = g.men[j]; for (let i = 5; i < 10; i++) { const q = g.men[i]; if (Math.hypot(q.x - m.x, q.z - m.z) < 6) return false } return true }

// Clutch Shot's meter where Clutch Shot has it, down the left side, clear of the play and the thumbs: the green, the needle, what it was
function shotMeter(ctx, view, g, s, cam, H, U) {
  if (s.landed && g.t - s.rimAt > 700) return
  const w = 19, L = 150 * U, x = 14, b = view.h - (view.keys ? 70 : 178) * U, topY = b - L
  ctx.fillStyle = 'rgba(6,10,12,.92)'; rr(ctx, x - 3, topY - 3, w + 6, L + 6, 5); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x, topY, w, L)
  ctx.fillStyle = BAD; ctx.fillRect(x, topY, w, 6 * U)
  const p = s.rel ? s.p : s.p
  ctx.fillStyle = s.res ? (s.res.in || s.res.why === 'green' ? GOOD : '#d8d4c8') : '#efe9da'
  ctx.fillRect(x, b - p * L, w, p * L)
  const y1 = b - s.hi * L, y0 = b - s.lo * L
  ctx.fillStyle = GOOD; ctx.fillRect(x - 3, y1, w + 6, Math.max(1.5, y0 - y1))
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y0 - 1, w + 6, 2); ctx.fillRect(x - 3, y1 - 1, w + 6, 2)
  const ny = b - p * L
  ctx.fillStyle = '#07100b'; ctx.fillRect(x - 6, ny - 3.5, w + 12, 7)
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, ny - 2.5, w + 10, 5)
  if (s.res && g.t - s.rel < 760) {
    const ok = s.res.why === 'green' || s.res.why === 'block' || (s.meter && Math.abs(s.res.off ?? 0) <= s.half)
    const inG = s.meter ? Math.abs(s.res.off ?? 0) <= s.half : s.res.in
    const word = s.res.why === 'block' ? 'GREEN' : inG ? 'GREEN' : s.res.off < 0 ? 'EARLY' : 'LATE'
    ctx.fillStyle = 'rgba(6,10,12,.86)'; ctx.fillRect(x - 6, topY - 30 * U, 74 * U, 24 * U)
    text(ctx, word, x - 2, topY - 17 * U, { font: DISPLAY, size: 20 * U, color: ok ? GOOD : BAD, align: 'left' })
  } else if (!s.res && s.contest > 0.55) {
    text(ctx, 'CONTESTED', x + w / 2, topY - 12 * U, { font: LABEL, size: 13 * U, color: GOLD, track: 1 })
  } else if (!s.res && s.contest < 0.15) {
    text(ctx, 'OPEN', x + w / 2, topY - 12 * U, { font: LABEL, size: 13 * U, color: GOOD, track: 1 })
  }
}
// the shot clock over the board: tenths under five, red at the end
function shotClock(ctx, g, cam) {
  const sec = g.clock / 1000
  project(cam, 0, 13.85, 1.3)
  const k = PT.k, w = 2.5 * k, h = 1.15 * k, x = PT.x, y = PT.y
  ctx.fillStyle = '#0a0c0f'; ctx.fillRect(x - w / 2, y - h / 2, w, h)
  ctx.strokeStyle = '#3a424b'; ctx.lineWidth = Math.max(1, 0.1 * k); ctx.strokeRect(x - w / 2, y - h / 2, w, h)
  const str = sec < 5 ? sec.toFixed(1) : String(Math.ceil(sec))
  text(ctx, str, x, y + 0.5, { font: DISPLAY, size: h * 0.82, color: sec < 5 ? '#ff3b2f' : '#ffb21f' })
}
// the stick and the two buttons on a phone; the keys on a computer
function drawControls(ctx, view, g, U) {
  const C = ctlOf(view.h), c = g.ctl, s = g.stickOut
  const live = !g.done
  if (view.keys) {
    const y = view.h - 22
    ctx.fillStyle = 'rgba(6,10,12,.72)'; rr(ctx, 8, y - 15, view.w - 16, 30, 5); ctx.fill()
    // (real keys: the arrow cluster, the spacebar, E. The moves are on the opening prompt)
    keyCap(ctx, 34, y, 'ARROWS')
    text(ctx, 'MOVE', 60, y + 1, { size: 13, align: 'left', track: 1 })
    keyCap(ctx, 140, y, 'SPACE'); text(ctx, 'SHOOT', 178, y + 1, { size: 13, align: 'left', track: 1 })
    keyCap(ctx, 248, y, 'E'); text(ctx, 'PASS', 264, y + 1, { size: 13, align: 'left', track: 1 })
    if (g.phase === 'set' && !g.done) prompt(ctx, view, 'GET A BUCKET', view.h - 60)
    return
  }
  // the stick: where the thumb landed, or its rest spot
  const ax = c.tid != null ? c.ox : C.stick.x, ay = c.tid != null ? c.oy : C.stick.y, R = C.stick.R
  ctx.globalAlpha = live ? 1 : 0.4
  ctx.fillStyle = 'rgba(6,10,12,.42)'; circle(ctx, ax, ay, R + 6); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; circle(ctx, ax, ay, R + 6); ctx.stroke()
  ctx.fillStyle = c.tid != null || Math.hypot(s.x, s.y) > 0.1 ? '#e9eef0' : 'rgba(233,238,240,.7)'
  circle(ctx, ax + s.x * R, ay - s.y * R, 19); ctx.fill()
  ctx.strokeStyle = 'rgba(6,10,12,.5)'; ctx.lineWidth = 1.5; ctx.stroke()
  // the buttons
  const lit = c.sid != null && live
  ctx.fillStyle = lit ? view.accent : 'rgba(28,38,43,.9)'; circle(ctx, C.shoot.x, C.shoot.y, C.shoot.r); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke()
  text(ctx, g.shot || nearRim(g) ? (nearRim(g) && !g.shot ? 'LAYUP' : 'SHOOT') : 'SHOOT', C.shoot.x, C.shoot.y + 1, { font: DISPLAY, size: 18, color: lit ? '#06100c' : '#fff' })
  const pl = g.t - c.passLit < 140
  ctx.fillStyle = pl ? view.accent : 'rgba(28,38,43,.9)'; circle(ctx, C.pass.x, C.pass.y, C.pass.r); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke()
  text(ctx, 'PASS', C.pass.x, C.pass.y + 1, { font: DISPLAY, size: 15, color: pl ? '#06100c' : '#fff' })
  ctx.globalAlpha = 1
  if (g.phase === 'set' && !g.done) prompt(ctx, view, 'GET A BUCKET', view.h - 168)
  else if (g.phase === 'live' && g.t - g.liveAt < 2200) prompt(ctx, view, 'CHANGE SIDES TO CROSS · ROLL THE STICK TO SPIN', view.h - 168, 13)
}
const nearRim = g => { const H = g.men[g.h]; return Math.hypot(H.x, H.z) <= LAYUP_D }
function prompt(ctx, view, str, y, size = 18) {
  ctx.font = `${size}px ${LABEL}`
  const tw = ctx.measureText(str).width + 24 + str.length * 1.5
  ctx.fillStyle = 'rgba(6,10,12,.72)'; rr(ctx, view.w / 2 - tw / 2, y - 15, tw, 30, 4); ctx.fill()
  text(ctx, str, view.w / 2, y + 1, { size, track: 1.5, color: '#fff' })
}
