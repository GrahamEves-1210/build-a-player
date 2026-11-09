// Lockdown: you're the man on the ball at the top of the key. He sizes you up on a low dribble, then goes:
// a hard first step to one side. Press that side and you slide with him, chest to chest, and he has to
// pull it back out. Three moves. Some are a hesitation or a jab: he shows you one way and goes the other,
// and if you've already gone with the show he crosses back and he's by you. Wait for the real step (the
// ball pushed out ahead, the long first stride), then go. Two stops and he's out of time: a contested heave
// over your hands that clanks off the iron. Beaten twice and he's gone, and it's a layup.
// It's Iso turned round (cut.js): the same camera behind the ball, the same window off the trait.
import { lanesMs } from '../minigames.js'
import { clamp, lerp, prog, easeOut, easeInOut, outcome, rngOf, nudge, text, reduceMotion, GOOD, BAD, DISPLAY } from './kit.js'
import { arenaCam, CRASH_CAM, dolly, arenaStage, manAt, POSE, RUN, tagAt, tagsDown, AB, flyTo, dropThrough, hoopWith, shotApex } from './arena.js'
import { frontRun, ballIn, easedState, easedPose, newPose, copyPose, mixPose, pose, project, smoothT, CLK, IN_HANDS, PT, FIG_FT, BALL_R, RIM_R, RIM_Y, R_HEAD, R_HIPS, warmCrowd, crowdUp, camFlashes, boardFlash, lightFx, paintHoop } from './meter.js'
import { castMen, teamOf } from './read.js'

export const how = {
  lockdown: 'Press the side he really drives to and slide with him. Wait out the hesitation: go early and he crosses over.',
}

// ── The rules ───────────────────────────────────────────────────────────────
const N = 3
const LD_T = [1.08, 1, 0.94]
// the window from his first step to him being by you: Iso's crossover window, from the same traits' grade
export const lockWindow = (v, k) => (530 + (lanesMs(v) - lanesMs(1)) * 0.25) * LD_T[k]
const REACT_FLOOR = 420     // a press this quick off his first step is a perfect slide
const BITE_GO = 420         // after a bite, how long his crossback takes to get by you
const SLIDE_MS = 190        // a press to your chest on his
const CUT_HOLD = 380        // cut off: he holds, then backs it out
const BACK_MS = 620         // backing it out to the top
const STEP_MS = 650         // beaten (not the last): the step he gets on you before you recover
const RECOVER_MS = 720
// the last stop: he picks it up and has to throw it up over you
const HEAVE_UP = 300, HEAVE_REL = 560, HEAVE_FLY = 820
// the last blow-by: to the rim and up
const RIM_RUN = 680, LAY_REL = 880, LAY_FLY = 230

export function make({ v, seed, def }) {
  const r = rngOf(seed), look = rngOf(`${seed}|look`), mv = rngOf(`${seed}|moves`)   // (mv: which dribble move, never what happens)
  const need = def?.need ?? 2
  let est = 300
  const moves = Array.from({ length: N }, (_, k) => {
    // the size-up; then his shows, if any; then the real first step. The same start every time.
    let t = (k === 0 ? 620 : 380) + r() * 420
    const count = k === 0 ? (r() < 0.25 ? 1 : 0) : k === 1 ? (r() < 0.7 ? 1 : 0) : 1 + (r() < 0.4 ? 1 : 0)
    const dir = r() < 0.5 ? -1 : 1
    // a hesitation shows the other way; a single show is now and then a jab-and-go, the same way
    const jabGo = count === 1 && r() < 0.3
    const shows = []
    for (let i = 0; i < count; i++) {
      const side = jabGo ? dir : (count - i) % 2 ? -dir : dir
      const dur = 210 + r() * 90
      shows.push({ at: t, dur, side, u: mv() })
      t += dur + 150 + r() * 160
    }
    const T = lockWindow(v, k)
    est += t + T * 0.55 + CUT_HOLD + BACK_MS
    return { k, at: 0, shows, attackAt: t, dir, T, hand: r() < 0.5 ? -1 : 1, goU: mv(), go: null, press: null, res: null }
  })
  const g = {
    t: 0, game: 'lockdown', zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, litAt: -999, fx: [], done: null, outro: 2400, stamp: null, later: null,
    moves, i: 0, cur: moves[0], stops: 0, beats: 0, need, side0: look() < 0.5 ? -1 : 1, look: look(), nudge: nudge(),
    // the shot clock, from what three moves take: it's about out by the last one
    clock0: Math.round(est / 100) / 10 + 0.4, clockStop: null,
    final: null,
    // what his body is showing: all a player (or a bot) knows
    tell: { show: 0, go: 0 },
    hud: { prompt: 'STAY IN FRONT', dots: moves.map(() => null) },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const f = g.final
      if (f) { finalFx(f); return }
      const b = g.cur
      if (b.res) {
        if (g.t >= b.res.nextAt) next()
        return
      }
      const a = g.t - b.at
      g.tell.show = b.shows.find(s => a >= s.at && a < s.at + s.dur)?.side ?? 0
      if (!b.go && a >= b.attackAt) { b.go = { at: g.t, dir: b.dir, dur: b.T }; g.tell.go = b.dir; g.tell.show = 0 }
      if (b.go && g.t >= b.go.at + b.go.dur) settle('late', 0)
    },
    input(a) {
      if (a.kind !== 'down') return
      const side = a.zone === 'L' ? -1 : a.zone === 'R' ? 1 : 0
      if (!side) return
      g.padLit = side < 0 ? 0 : 1; g.litAt = g.t
      const b = g.cur
      if (g.done || b.res || g.t < b.at) return
      g.fx.push('tap')
      // before his real step: you've gone with the show (or a guess), and he crosses you back the other way
      if (!b.go) { b.go = { at: g.t + 60, dir: -side, dur: BITE_GO, bite: true }; settle('bite', side); return }
      settle(side === b.go.dir ? 'stop' : 'wrong', side, g.t - b.go.at)
    },
  }
  function settle(kind, side, ms = 0) {
    const b = g.cur, ok = kind === 'stop'
    b.press = side ? { side, at: g.t } : null
    const score = ok ? clamp(1 - Math.max(0, ms - REACT_FLOOR) / Math.max(1, b.T - REACT_FLOOR), 0.4, 1) : 0
    const res = { kind, ok, at: g.t, score }
    if (ok) {
      res.tc = Math.max(g.t, b.go.at + 100) + SLIDE_MS
      res.nextAt = res.tc + CUT_HOLD + BACK_MS + 60
      g.stops++
    } else {
      res.goEnd = Math.max(g.t, b.go.at + b.go.dur)
      res.nextAt = res.goEnd + STEP_MS + RECOVER_MS + 60
      g.beats++
    }
    b.res = res
    g.tell.show = 0; g.tell.go = 0
    g.hud.dots[g.i] = ok
    g.hud.prompt = null
    g.fx.push(ok ? 'pop' : 'swoosh', ok ? 'h:medium' : 'h:heavy')
    const won = g.stops >= need, lost = g.beats > N - need
    if (won || lost) {
      const played = moves.filter(m => m.res)
      const avg = played.reduce((s, m) => s + m.res.score, 0) / N
      g.done = outcome(won ? Math.max(avg, 0.5) : Math.min(avg, 0.45), won, `${g.stops} of ${played.length} stops`, { stops: g.stops, of: played.length })
      g.clean = won && g.beats === 0
      if (won) {
        const at0 = res.tc
        g.final = { kind: 'stop', at0, rel: at0 + HEAVE_REL, clank: at0 + HEAVE_REL + HEAVE_FLY, fired: 0 }
        g.later = { text: g.clean ? 'LOCKDOWN' : 'STOP', good: true, at: g.final.clank + 120, size: 46, y: 150 }
        g.outro = g.final.clank + 1500 - g.t
      } else {
        const at0 = res.goEnd
        g.final = { kind: 'score', at0, rel: at0 + LAY_REL, make: at0 + LAY_REL + LAY_FLY, fired: 0 }
        g.later = { text: 'SCORED ON', good: false, at: g.final.make + 260, size: 46, y: 150 }
        g.outro = g.final.make + 1300 - g.t
      }
    }
  }
  function finalFx(f) {
    if (f.kind === 'stop') {
      if (f.fired < 1 && g.t >= f.rel) { f.fired = 1; g.clockStop = g.t; g.fx.push('h:light') }
      if (f.fired < 2 && g.t >= f.clank) { f.fired = 2; g.fx.push('rimmiss', 'h:success') }
      if (f.fired < 3 && g.t >= f.clank + 120) { f.fired = 3; g.fx.push('stamp') }
    } else {
      if (f.fired < 1 && g.t >= f.rel) { f.fired = 1; g.fx.push('h:light') }
      if (f.fired < 2 && g.t >= f.make) { f.fired = 2; g.clockStop = g.t; g.fx.push('make') }
      if (f.fired < 3 && g.t >= f.make + 260) { f.fired = 3; g.fx.push('stamp') }
    }
  }
  function next() {
    const was = g.cur
    g.i++
    g.cur = moves[g.i]
    g.cur.at = g.t
    g.cur.hand = was.go?.dir ?? g.cur.hand   // (the ball's still in the hand he drove with)
    g.hud.prompt = 'STAY IN FRONT'
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// Iso's camera, low and behind the ball: his back to us, the man on him (you) beyond him, facing us, a
// step off to one side so you can see his feet. Everything is worked out from the clock, so the picture
// can't drift from the rules.
const FY = 24.5          // feet from the rim to the ball handler at the top
const NEAR = 12          // the lens behind him
const GAP = 3.7          // how far off him you're playing
const OFF = 1.65         // and to which side, so you're in the picture
const JAB = 0.6          // a show's lateral step
const ATT = 1.9          // his drive's, by the time he's by you
const HAND_FT = 1.6
const BOUNCE = 400

const mirror = P => {
  const o = pose({})
  o.hx = -P.hx; o.hy = P.hy; o.lean = -P.lean; o.j = P.j
  o.fFx = -P.fBx; o.fFy = P.fBy; o.fBx = -P.fFx; o.fBy = P.fFy; o.toeF = P.toeB; o.toeB = P.toeF
  o.hFx = -P.hBx; o.hFy = P.hBy; o.hBx = -P.hFx; o.hBy = P.hFy
  return o
}
const both = o => { const R = pose(o); return { [1]: R, [-1]: mirror(R) } }
// you: sat down wide, hands out and working
const D_ST = pose({ hy: 36, fFx: 21, fBx: -21, hFx: 33, hFy: 58, hBx: -31, hBy: 64 })
const D_ST2 = pose({ hy: 36, fFx: 21, fBx: -21, hFx: 31, hFy: 64, hBx: -33, hBy: 58 })
const D_SHADE = both({ hx: 3, hy: 36, lean: 0.06, fFx: 24, fBx: -17, hFx: 38, hFy: 56, hBx: -26, hBy: 66 })
// the slide: a push off the trail foot, wide, then the gather; the lead hand out in his lane
const D_PUSH = both({ hx: 4, hy: 35, lean: 0.07, fFx: 29, fBx: -20, fBy: 3, hFx: 44, hFy: 62, hBx: -24, hBy: 70 })
const D_GATHER = both({ hx: 3, hy: 37, lean: 0.05, fFx: 18, fBx: -12, hFx: 42, hFy: 64, hBx: -22, hBy: 70 })
// chest to chest: he's run into you
const D_WALL = pose({ hy: 39, fFx: 18, fBx: -18, hFx: 30, hFy: 92, hBx: -30, hBy: 92 })
// gone with the show: weight over the wrong foot, reaching
const D_BIT = both({ hx: 9, hy: 33, lean: 0.2, fFx: 34, fBx: -10, fBy: 4, hFx: 54, hFy: 50, hBx: -16, hBy: 66 })
// a late reach at the ball as it goes by
const D_LATE = both({ hx: 6, hy: 35, lean: 0.16, fFx: 27, fBx: -14, hFx: 52, hFy: 40, hBx: -22, hBy: 62 })
// up with him on the heave
const D_CONTEST = pose({ hy: 49, fFx: 9, fBx: -9, fFy: 2, fBy: 4, hFx: 13, hFy: 128, hBx: -9, hBy: 126 })
// him: the jab: the lead foot out, the shoulder and the ball with it
const H_JAB = both({ hx: 8, hy: 37, lean: 0.19, fFx: 36, fFy: 2, fBx: -11, hFx: 36, hFy: 24, hBx: -15, hBy: 66 })
// backing it out: upright, the ball protected
const H_BACK = both({ hy: 43, lean: -0.03, fFx: 14, fBx: -14, hFx: 25, hFy: 32, hBx: -20, hBy: 62 })
// cut off: knocked upright, the ball pulled in
const H_CUT = pose({ hy: 44, lean: 0, fFx: 13, fBx: -13, hFx: 12, hFy: 70, hBx: -12, hBy: 70 })
const H_FADE = pose({ hy: 49, lean: -0.08, fFx: 8, fBx: -8, fFy: 2, fBy: 1, hFx: 13, hFy: 130, hBx: -21, hBy: 100 })

const ME = easedState(), HIM = easedState(), MP = newPose(), HP = newPose()
const bump = f => (f <= 0 || f >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, f * 1.25)) ** 0.8 * (f < 0.8 ? 1 : 1 - (f - 0.8) / 0.2) ** 0.5)
// His drive: a real one, across the floor and down toward the rim. He's up to speed in a stride and a half and keeps
// going till something stops him. driveS: feet along his path, ga ms after his first step.
const DRV_V = 0.0062, DRV_ACC = 150, DRV_LAT = 0.86, DRV_FWD = 0.5, STRIDE = 1.45
const driveS = ga => (ga <= 0 ? 0 : ga < DRV_ACC ? (DRV_V * ga * ga) / (2 * DRV_ACC) : DRV_V * (ga - DRV_ACC / 2))
const latOf = (go, ga) => driveS(ga) * DRV_LAT
const fwdOf = (go, ga) => driveS(ga) * DRV_FWD
// walled off: he runs into you and his feet come to a stop in a step, not on the spot
const coast = (ga, at) => (ga <= at ? ga : at + 55 * (1 - Math.exp(-(ga - at) / 55)))
// a driving stride, seen from behind: the legs from frontRun, set by how far he's gone, so his feet keep pace with the floor;
// sat a little lower and leaning into it, the ball hand out on the drive side pounding it, the other arm up for the defender
function drivePose(dir, s, ramp, out) {
  const ph = (s / STRIDE) * Math.PI
  frontRun(ph, out)
  out.hy -= 5 * ramp; out.lean = dir * 0.13 * ramp; out.hx = dir * 4 * ramp
  const bh = 22 + 14 * Math.abs(Math.cos(ph)) ** 0.8
  if (dir > 0) { out.hFx = 31; out.hFy = bh; out.hBx = -22; out.hBy = 62 } else { out.hBx = -31; out.hBy = bh; out.hFx = 22; out.hFy = 62 }
  return out
}

// where both of them are at time t, before any reset back to the top
const H = { x: 0, z: 0, s: 0 }, D = { x: 0, z: 0 }
function rawAt(g, b, t, rest) {
  const res = b.res, go = b.go, a = t - b.at, sway = Math.sin(t / 420) * 0.12
  // him
  let hx = sway, hz = -FY
  H.s = 0
  for (const s of b.shows) hx += s.side * JAB * bump((a - s.at) / s.dur)
  if (go) {
    let ga = t - go.at
    if (res?.ok) ga = coast(ga, res.tc - go.at)
    else if (res && t > res.goEnd) ga = res.goEnd - go.at
    hx += go.dir * latOf(go, ga); hz += fwdOf(go, ga); H.s = driveS(ga)
    if (res?.ok && t > res.tc) hz -= 0.45 * Math.sin(Math.PI * clamp((t - res.tc) / 300, 0, 1))
    if (res && !res.ok && t > res.goEnd) {
      const ge = t - res.goEnd
      if (rest) {
        // by you: he keeps driving, turning the corner, and runs out of room as you recover
        const e = DRV_V * 300 * (1 - Math.exp(-ge / 300))
        hx += go.dir * 0.35 * e; hz += 1.3 * e; H.s += e
      } else {
        // the last one: all the way, to the rim
        const u = prog(ge, 0, RIM_RUN), f = lerp(u, easeOut(u), 0.5)
        const x0 = hx, z0 = hz
        hx = lerp(x0, go.dir * 1.3, f); hz = lerp(z0, -3.6, f); H.s += Math.hypot(go.dir * 1.3 - x0, -3.6 - z0) * f
      }
    }
  }
  // you
  let dx = OFF + Math.sin(t / 330 + 1) * 0.08, dz = -FY + GAP
  const p = b.press
  if (!p) for (const s of b.shows) dx += s.side * 0.33 * bump((a - s.at) / s.dur)
  if (p) {
    if (res.ok) {
      // to where he'll be when you meet him
      const want = go.dir * (latOf(go, res.tc - go.at) + 1.5)   // (in his lane: your chest where his next step was going)
      const f = easeInOut(prog(t, p.at, res.tc))
      dx = lerp(dx, want, f); dz = lerp(dz, -FY + fwdOf(go, res.tc - go.at) + GAP * 0.86, f)
      if (t > res.tc) dz += 0.25 * Math.sin(Math.PI * clamp((t - res.tc) / 300, 0, 1))
    } else {
      dx = lerp(dx, OFF + p.side * 2.0, easeOut(prog(t, p.at, p.at + 260)))
    }
  } else if (res && !res.ok) {
    dx = lerp(dx, OFF + go.dir * 0.7, easeOut(prog(t, res.at, res.at + 220)))
  }
  // beaten: turned round, chasing his hip
  if (res && !res.ok && t > res.goEnd + 60) {
    const f = easeOut(prog(t, res.goEnd + 60, res.goEnd + (rest ? 420 : 600)))
    // (at his hip, the far side of him, so he's going by you in the picture too)
    dx = lerp(dx, hx - go.dir * 1.8, f); dz = lerp(dz, hz + 0.45, f)
  }
  // the last stop: once it's off the iron he walks away from you, head down
  const f = g.final
  if (f?.kind === 'stop' && !rest && t > f.clank) { const w = easeInOut(prog(t, f.clank + 150, f.clank + 1100)); hx -= (go?.dir || 1) * 2.2 * w; hz -= 1.2 * w }
  const bp = f?.kind === 'stop' && !rest && t > f.clank ? easeInOut(prog(t, f.clank + 700, f.clank + 1500)) : 0
  dz += 1.3 * bp
  H.x = hx; H.z = hz; D.x = dx; D.z = dz
}
// and with the reset: both back to the top for his next move
const RH = { x: 0, z: 0 }, RD = { x: 0, z: 0 }
function placeAt(g, b, t) {
  const res = b.res, last = g.final && g.cur === b
  let r0 = Infinity, r1 = Infinity
  if (res && !last) {
    if (res.ok) { r0 = res.tc + CUT_HOLD; r1 = r0 + BACK_MS } else { r0 = res.goEnd + STEP_MS; r1 = r0 + RECOVER_MS }
  }
  if (t <= r0) { rawAt(g, b, t, !last); return 0 }
  rawAt(g, b, r0, true)
  RH.x = H.x; RH.z = H.z; RD.x = D.x; RD.z = D.z
  const f = easeInOut(prog(t, r0, r1))
  const sway = Math.sin(t / 420) * 0.12
  H.x = lerp(RH.x, sway, f); H.z = lerp(RH.z, -FY, f)
  D.x = lerp(RD.x, OFF + Math.sin(t / 330 + 1) * 0.08, f); D.z = lerp(RD.z, -FY + GAP, f)
  return f
}
// His dribble moves. Every show and his real first step is one: a change of hands (a crossover, between the legs,
// behind the back), an in-and-out (the ball goes at the other hand and comes back), a hesitation (he hangs on it,
// then pounds it), or a jab. The real step out of the same hand is a rip: straight into the burst.
// Which one comes from the look stream; when it starts is the rules' show or step, so the read doesn't move.
const MOVE_MS = { cross: 105, btl: 135, btb: 165 }
const swapKind = u => (u < 0.42 ? 'cross' : u < 0.72 ? 'btl' : 'btb')
const TK = { hand: 1, prev: 1, kind: null, f: -1, at: 0, dur: 0, id: '' }
function trickAt(b, t) {
  const a = t - b.at
  let hand = b.hand
  TK.kind = null; TK.f = -1; TK.prev = hand
  const put = (kind, at, dur, from, id) => { if (t >= at) { TK.kind = kind; TK.at = at; TK.dur = dur; TK.prev = from; TK.f = t - at < dur ? (t - at) / dur : -1; TK.id = id } }
  b.shows.forEach((s, i) => {
    if (a < s.at) return
    const from = hand
    if (s.side !== hand) {
      if (s.u < 0.78) { const k = swapKind(s.u / 0.78); hand = s.side; put(k, b.at + s.at, MOVE_MS[k], from, `s${i}`) }
      else put('inout', b.at + s.at, Math.min(s.dur, 280), from, `s${i}`)
    } else put(s.u < 0.5 ? 'hesi' : 'jab', b.at + s.at, s.dur, from, `s${i}`)
  })
  if (b.go && t >= b.go.at) {
    const from = hand
    if (b.go.dir !== hand) { const k = swapKind(b.goU); hand = b.go.dir; put(k, b.go.at, MOVE_MS[k], from, 'g') }
    else put('rip', b.go.at, 70, from, 'g')
  }
  TK.hand = hand
  return TK
}
// the bodies for each, going to the + hand (the mirror for the other)
const P_CROSS = both({ hy: 33, lean: 0.14, hx: 3, fFx: 21, fBx: -21, hFx: 19, hFy: 17, hBx: -15, hBy: 16 })
const P_BTL = both({ hy: 31, lean: 0.06, fFx: 27, fFy: 1, fBx: -19, hFx: 15, hFy: 13, hBx: -11, hBy: 12 })
const P_BTB = both({ hy: 37, lean: 0.15, hx: 3, fFx: 18, fBx: -18, hFx: 32, hFy: 38, hBx: 7, hBy: 44 })
// the in-and-out, ball in the + hand: the shoulders sell going the other way while the ball goes in
const P_INOUT = both({ hy: 35, lean: -0.17, hx: -5, fFx: 15, fBx: -27, fBy: 1, hFx: 9, hFy: 20, hBx: -26, hBy: 60 })
// the hang on a hesitation: upright, ball held at the hip, eyes up
const P_HANG = both({ hy: 45, lean: 0.02, fFx: 14, fBx: -14, hFx: 27, hFy: 42, hBx: -20, hBy: 56 })
const trickPose = k => (k === 'cross' ? P_CROSS : k === 'btl' ? P_BTL : P_BTB)

let G0 = null
const CAM_X = OFF * 0.45
const geoOf = view => (G0 && G0.h === view.h ? G0 : (G0 = arenaCam(view.h, { ...CRASH_CAM(view.h), D: FY + NEAR, x: CAM_X })))

export function draw(ctx, g, view) {
  const c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1), G = geoOf(view), cam = G.cam, U = G.U
  const T = smoothT(g), b = g.cur, res = b.res, f = g.final
  placeAt(g, b, T)
  // the camera leans with the play, so both of them stay in the picture: still while they are, and baked once it's settled
  const cs = g.ldCam ?? (g.ldCam = { cx: CAM_X, t: T })
  const want = Math.round(lerp(CAM_X, (H.x + D.x - Math.sin(T / 420) * 0.12 - Math.sin(T / 330 + 1) * 0.08) / 2, 0.75) * 20) / 20, dtc = clamp(T - cs.t, 0, 60); cs.t = T
  cs.cx = Math.abs(want - cs.cx) < 0.015 ? want : cs.cx + (want - cs.cx) * (1 - Math.exp(-dtc / 200))
  const panning = cs.cx !== want
  dolly(G, FY + NEAR, panning ? cs.cx : Math.round(cs.cx * 50) / 50)
  arenaStage(ctx, view, G, `lockdown-${cam.cx.toFixed(2)}`, panning)
  if (!g.warm) { g.warm = true; warmCrowd(view, G, c, 'board') }
  // the building: on its feet for a stop, and up and roaring when he's had to throw it away
  const sinceClank = f?.kind === 'stop' ? T - f.clank : -1
  const roar = sinceClank >= 0 && sinceClank < 2400 ? 110 : f?.kind === 'stop' ? 240 : !f && g.i > 0 ? 420 : 0
  if (roar && !lightFx() && !view.empty) {
    crowdUp(ctx, view, G, c, 'board', T, roar)
    paintHoop(ctx, cam, c.us)
    if (sinceClank >= 0 && !reduceMotion()) camFlashes(ctx, view, G, T, 14)
  }
  if (sinceClank >= 0 && sinceClank < 1100) boardFlash(ctx, view, G, c.trim, (1 - sinceClank / 1100) * (Math.floor(sinceClank / 90) % 2 ? 0.34 : 0.62))
  shotClock(ctx, g, cam, T)

  const hx = H.x, hz = H.z, dx = D.x, dz = D.z
  const go = b.go, ga = go ? T - go.at : -1, a = T - b.at
  const tk = trickAt(b, T), hand = tk.hand, A = tk.prev, tf = tk.f, swap = tf >= 0 && MOVE_MS[tk.kind] != null
  const ph = (T % BOUNCE) / BOUNCE, top = Math.abs(Math.cos(ph * Math.PI))
  const st = g.ld ?? (g.ld = { bn: -1, shook: -1 })

  // ── him ──
  let carry = null, ball = AB, hj = 0
  const tc = res?.ok ? res.tc : Infinity, ge = res && !res.ok ? T - res.goEnd : -1
  const showNow = b.shows.find(s => a >= s.at && a < s.at + s.dur)
  const reset = res && (res.ok ? T > res.tc + CUT_HOLD : ge > STEP_MS)
  let dribbling = true
  if (f?.kind === 'stop' && T > tc) {
    // cut off and out of time: he picks it up and throws it up over you
    const u = T - tc
    dribbling = false
    if (u < HEAVE_UP) copyPose(H_CUT, HP)
    else if (u < HEAVE_REL + 300) { mixPose(POSE.gather, H_FADE, clamp((u - HEAVE_UP) / 200, 0, 1), HP); hj = 18 * Math.sin(Math.PI * clamp((u - HEAVE_UP) / 560, 0, 1)) }
    else if (sinceClank < 150) mixPose(POSE.off, POSE.land, 0.5, HP)
    else copyPose(R_HIPS, HP)
    HP.j = hj
    if (u < HEAVE_REL) { carry = IN_HANDS; ball = null }
  } else if (f?.kind === 'score' && ge > 0) {
    // by you and up at the rim
    dribbling = ge < RIM_RUN - 120
    if (ge < RIM_RUN) drivePose(go.dir, H.s, 1, HP)
    else {
      const u = ge - RIM_RUN
      mixPose(POSE.gather, POSE.layup, clamp(u / 140, 0, 1), HP)
      hj = 26 * Math.sin(Math.PI * clamp(u / 480, 0, 1))
      if (u > 480) mixPose(HP, POSE.land, clamp((u - 480) / 200, 0, 1), HP)
      HP.j = hj
    }
    if (ge >= RIM_RUN - 120 && ge < LAY_REL) { carry = IN_HANDS; ball = null }
  } else if (res?.ok && T > tc && !reset) { copyPose(H_BACK[hand], HP); HP.lean -= hand * 0.08 }
  else if (reset) copyPose(H_BACK[hand], HP)
  else if (go && ga >= 0 && (!res || res.ok ? ga < (res?.ok ? tc - go.at : go.dur) : ge < STEP_MS)) {
    // the real step: the change of hands, then the burst, then the run with his shoulder past you
    if (swap) { copyPose(trickPose(tk.kind)[go.dir], HP); HP.lean += go.dir * 0.08 }
    else drivePose(go.dir, H.s, clamp(ga / 200, 0, 1), HP)
  } else if (swap) copyPose(trickPose(tk.kind)[hand], HP)
  else if (showNow && tf >= 0 && tk.kind === 'inout') {
    const inn = Math.sin(Math.PI * clamp(tf / 0.55, 0, 1))
    mixPose(POSE[A < 0 ? 'dribL' : 'dribR'], P_INOUT[A], inn, HP)
  } else if (showNow && tf >= 0 && tk.kind === 'hesi') {
    // the hang, then the pound and the jab
    if (tf < 0.6) copyPose(P_HANG[A], HP)
    else mixPose(P_HANG[A], H_JAB[showNow.side], clamp((tf - 0.6) / 0.15, 0, 1), HP)
  } else if (showNow) copyPose(H_JAB[showNow.side], HP)
  else { copyPose(hand < 0 ? POSE.dribL : POSE.dribR, HP); if (hand < 0) HP.hBy = 24 + top * 13; else HP.hFy = 24 + top * 13 }

  // the ball
  let spin = T / 170, netAge = null, rimDy = 0
  if (f?.kind === 'stop' && T > tc + HEAVE_REL) {
    // the heave: up over your hands and off the front of the iron
    const u = T - tc - HEAVE_REL, from = { x: hx + 0.3, y: 9.2, z: hz + 0.4 }
    if (u < HEAVE_FLY) flyTo(from.x, from.y, from.z, 0.15, RIM_Y + 0.2, -RIM_R - 0.25, u / HEAVE_FLY, shotApex(FY))
    else {
      const w = (u - HEAVE_FLY) / 700, sd = g.look < 0.5 ? -1 : 1
      flyTo(0.15, RIM_Y + 0.2, -RIM_R - 0.25, sd * 4.5, BALL_R, -7, clamp(w, 0, 1), 2.6)
      if (w > 1) { const q = w - 1; AB.x = sd * (4.5 + q * 2); AB.z = -7 - q * 3; AB.y = BALL_R + Math.abs(Math.sin(q * 5)) * 1.6 * Math.exp(-q * 2) }
      const ra = u - HEAVE_FLY
      rimDy = ra < 520 ? Math.sin(ra / 26) * Math.exp(-ra / 130) * 4 * U : 0
    }
    spin = u / 70
  } else if (f?.kind === 'score' && ge >= LAY_REL) {
    const u = ge - LAY_REL
    if (u < LAY_FLY) flyTo(hx + go.dir * 0.2, 9.6, hz + 0.6, 0, RIM_Y + 0.35, -0.1, u / LAY_FLY, 0.7)
    else { dropThrough(u - LAY_FLY); netAge = u - LAY_FLY }
    spin = u / 60
    if (netAge != null && netAge < 500) rimDy = Math.cos(netAge / 42) * 2.4 * Math.exp(-netAge / 160)
  } else if (ball) {
    const driving = go && ga >= 0 && !swap && !reset && (res?.ok ? T < tc : res ? ge < STEP_MS || f?.kind === 'score' : true)
    const low = lerp(BALL_R, (37 - 3) / FIG_FT - BALL_R, top)
    let key = `d${Math.floor((T + BOUNCE / 2) / BOUNCE)}`
    if (swap) {
      // the ball, low and quick, hand to hand
      const B = hand, k = tk.kind
      if (k === 'cross') { AB.x = hx + lerp(A, B, tf) * 1.5; AB.z = hz + 0.55; AB.y = BALL_R + 1.2 * Math.abs(Math.cos(Math.PI * tf)) }
      else if (k === 'btl') { AB.x = hx + lerp(A, B, easeInOut(tf)) * 1.35; AB.z = hz + 0.05; AB.y = BALL_R + 1.25 * Math.abs(Math.cos(Math.PI * tf)) }
      else if (tf < 0.7) { const w = tf / 0.7; AB.x = hx + A * 1.5 * Math.cos(Math.PI * w); AB.z = hz - 0.6 * Math.sin(Math.PI * w); AB.y = 2.7 }
      else { AB.x = hx + B * 1.5; AB.z = hz + 0.2; AB.y = lerp(2.7, BALL_R, (tf - 0.7) / 0.3) }
      spin = tf * 6 * B
      key = tf >= (k === 'btb' ? 0.95 : 0.5) ? `${b.k}${tk.id}` : st.key
    } else if (driving) {
      // pushed out hard, ahead of him, a quick low bounce
      // pounded on every stride: on the floor as each foot lands
      const ph = (H.s / STRIDE) * Math.PI, q = Math.abs(Math.cos(ph)) ** 0.8, out = clamp(ga / 120, 0, 1)
      AB.x = hx + go.dir * lerp(1.5, 1.6, out); AB.z = hz + lerp(0.3, 0.9, out); AB.y = BALL_R + 2.0 * q
      spin = H.s * 2 * go.dir
      key = `r${b.k}-${Math.floor(ph / Math.PI - 0.5)}`
    } else if (showNow && tf >= 0 && tk.kind === 'inout') {
      const inn = Math.sin(Math.PI * clamp(tf / 0.55, 0, 1))
      AB.x = hx + A * lerp(1.5, 0.25, inn); AB.z = hz + 0.45; AB.y = BALL_R + 1.2 * Math.abs(Math.cos(Math.PI * tf * 2.2))
      key = `i${b.k}${tk.id}${Math.floor(tf * 2.2 + 0.5)}`
    } else if (showNow && tf >= 0 && tk.kind === 'hesi') {
      AB.x = hx + A * 1.5; AB.z = hz + 0.3
      AB.y = tf < 0.6 ? 2.75 : BALL_R + 2.3 * Math.abs(Math.cos((Math.PI / 2) * ((tf - 0.6) / 0.2)))
      if (tf > 0.8) AB.y = BALL_R + 2.3 * Math.abs(Math.sin((Math.PI / 2) * ((tf - 0.8) / 0.2)))
      key = tf >= 0.8 ? `h${b.k}${tk.id}` : st.key
    } else { AB.x = hx + hand * HAND_FT; AB.z = hz + 0.2; AB.y = showNow ? lerp(BALL_R, 1.7, top) : low }
    if (dribbling && key !== st.key) { st.key = key; g.fx.push('dribble') }
  }

  // ── you ──
  let back = false, mj = 0
  const p = b.press, sinceP = p ? T - p.at : -1
  if (f?.kind === 'stop' && T > tc) {
    const u = T - tc
    if (u < HEAVE_UP) copyPose(D_WALL, MP)
    else if (sinceClank < 0 || T < f.clank + 60) {
      // up with him, hands straight up in his face
      mixPose(D_WALL, D_CONTEST, clamp((u - HEAVE_UP) / 160, 0, 1), MP)
      mj = 20 * Math.sin(Math.PI * clamp((u - HEAVE_UP - 60) / 560, 0, 1))
      MP.j = mj
    } else celebrate(g, T - f.clank - 60, MP)
  } else if (res && !res.ok && ge > 60 && !(reset && placeT(g, b, T) > 0.35)) {
    back = true
    copyPose(RUN[Math.floor(T / 66) % 4], MP)
    if (f?.kind === 'score') {
      const u = ge - RIM_RUN
      if (u > 0) { mixPose(MP, POSE.hands, clamp(u / 160, 0, 1), MP); MP.j = 14 * Math.sin(Math.PI * clamp((u - 40) / 460, 0, 1)) }
      if (T > f.make + 200) { back = true; copyPose(R_HIPS, MP) }
    }
  } else if (res && !res.ok && !reset) {
    if (p) copyPose(D_BIT[p.side], MP)
    else copyPose(D_LATE[go.dir], MP)
  } else if (res?.ok && T >= tc - 20 && !reset) copyPose(D_WALL, MP)
  else if (p && res?.ok && T < tc) copyPose((Math.floor(sinceP / 85) % 2 ? D_GATHER : D_PUSH)[go.dir], MP)
  else if (reset) copyPose(Math.floor(T / 110) % 2 ? D_PUSH[Math.sign(OFF - D.x) || 1] : D_ST, MP)
  else if (!p && showNow) copyPose(D_SHADE[showNow.side], MP)
  else {
    // hands working
    mixPose(D_ST, D_ST2, 0.5 + 0.5 * Math.sin(T / 210), MP)
  }
  // the contact on a stop
  if (res?.ok && T >= tc && st.shook !== g.i) { st.shook = g.i; g.nudge.kick(g.t, 2.6, -go.dir, 0.3, 160) }
  if (f?.kind === 'stop' && sinceClank >= 0 && !st.clanked) { st.clanked = true; g.nudge.kick(g.t, 3.2, 0, 1, 200) }

  // the hoop, with the ball between its halves when it's at the iron
  const up = (f?.kind === 'stop' && T > tc + HEAVE_REL) || (f?.kind === 'score' && ge >= LAY_REL)
  const atIron = hoopWith(ctx, cam, up ? ball : null, netAge, spin, rimDy)
  if (up && ball && !atIron && (AB.z > -2.5 || netAge != null || (f.kind === 'stop' && T > f.clank))) { ballIn(ctx, cam, AB.x, AB.y, AB.z, spin); ball = null }

  const M = castMen(g, view)
  const him = M?.them[0] ?? { number: 3, skin: '#6d4229', name: null }, me = M?.us[0] ?? { number: 1, skin: '#8d5a3b', name: null }
  const list = [
    [hx, hz, easedPose(HIM, HP, g, CLK.dt, swap ? 10 : 24), them, him, true, carry],
    [dx, dz, easedPose(ME, MP, g, CLK.dt, p && !res?.ok ? 18 : 26), us, me, back, null],
  ]
  list.sort((x, y) => y[1] - x[1])
  for (const q of list) {
    if (manAt(ctx, view, cam, q[0], q[1], q[2], { jersey: q[3].color, trim: q[3].trim, skin: q[4].skin, num: q[4].number, back: q[5], ball: q[6], live: true }) && M) tagAt(PT.x, PT.y - 11, q[4].name, PT.k / FIG_FT)
  }
  if (M) tagsDown(ctx, view)
  if (ball && !atIron) ballIn(ctx, cam, AB.x, AB.y, AB.z, spin)

  // the word on each move (the last one's is the stamp)
  if (res && !f) {
    const age = T - res.at
    if (age < 700) {
      const word = res.ok ? (res.score >= 0.9 ? 'LOCKED UP' : 'IN FRONT') : res.kind === 'bite' ? 'ANKLES' : res.kind === 'wrong' ? 'WRONG WAY' : 'TOO LATE'
      text(ctx, word, 180, view.h * 0.2, { font: DISPLAY, size: 30 * U, color: res.ok ? GOOD : BAD })
    }
  }
}
// how far into the reset (0 before it)
function placeT(g, b, t) {
  const res = b.res
  if (!res || (g.final && g.cur === b)) return 0
  const r0 = res.ok ? res.tc + CUT_HOLD : res.goEnd + STEP_MS, r1 = r0 + (res.ok ? BACK_MS : RECOVER_MS)
  return prog(t, r0, r1)
}
// a stop: no show. He comes down out of his stance, one clap, and backpedals into the next one
const D_TALL = pose({ hy: 45, fFx: 13, fBx: -13, hFx: 19, hFy: 50, hBx: -19, hBy: 50 })
const D_CLAP = pose({ hy: 45, fFx: 13, fBx: -13, hFx: 3, hFy: 82, hBx: -3, hBy: 82 })
function celebrate(g, u, out) {
  mixPose(D_CONTEST, D_TALL, clamp(u / 220, 0, 1), out)
  out.j = 0
  // the one clap: hands together at the chest and apart again
  const c = Math.sin(Math.PI * clamp((u - 300) / 260, 0, 1))
  if (c > 0) mixPose(out, D_CLAP, c, out)
  // the backpedal: short steps, feet trading
  if (u > 700 && u < 1500) { const st = Math.sin((u - 700) / 70) * 4; out.fFx += st; out.fBx += st }
}
// the shot clock over the board: tenths under five, red and frozen when it's done
function shotClock(ctx, g, cam, T) {
  const s = Math.max(0, g.clock0 - (g.clockStop ?? T) / 1000)
  project(cam, 0, 13.85, 1.3)
  const k = PT.k, w = 2.5 * k, h = 1.15 * k, x = PT.x, y = PT.y
  ctx.fillStyle = '#0a0c0f'; ctx.fillRect(x - w / 2, y - h / 2, w, h)
  ctx.strokeStyle = '#3a424b'; ctx.lineWidth = Math.max(1, 0.1 * k); ctx.strokeRect(x - w / 2, y - h / 2, w, h)
  const str = s < 5 ? s.toFixed(1) : String(Math.ceil(s))
  text(ctx, str, x, y + 0.5, { font: DISPLAY, size: h * 0.82, color: s < 5 ? '#ff3b2f' : '#ffb21f' })
}
