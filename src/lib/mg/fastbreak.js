// FAST BREAK: a steal, and they're running. You have the ball, pushing it up the floor, a teammate on
// the wing (two of them from the second break), defenders getting back. The last man has to commit: he
// steps up to the ball, or he takes a wing. That's the read, and there's about half a second of it:
//   he takes the ball   → hit the wing he left (in a 3-on-2, the one the other man isn't on)
//   he takes a wing     → keep it and finish yourself
// From the second break the top man can stop the ball (the tandem): then the last man takes one wing, and
// the other's the pass. From the second break he can also fake: a hard show one way, then the real commit
// the other. Go on the fake, go before he's committed, pass to a covered man or hold it too long, and
// it's a turnover: picked off, blocked at the rim or a charge. Three breaks, two to win.
//
// The rules are timing only (make): when he commits, how long the window stays open, what you pressed and
// when. Where everyone is comes from formulas in the play's own time (scene), so the bot, the stamp and the
// picture agree. We ride behind the ball, high, and the camera comes in with the finish.
import { reactMs } from '../minigames.js'
import { clamp, lerp, prog, easeOut, easeInOut, rngOf, outcome, themOf, nudge, reduceMotion } from './kit.js'
import { pose, mixPose, copyPose, newPose, easedState, easedPose, smoothT, CLK, frontRun, ballIn, project, PT, FIG_FT, BALL_R, RIM_Y, IN_HANDS, SKINS, camFlashes, boardFlash, lightFx } from './meter.js'
import { arenaCam, dolly, arenaStage, wallNow, manAt, POSE, tagAt, tagsDown, flyTo, dropThrough, hoopWith, AB } from './arena.js'
import { crowdPop } from './art.js'
import { castMen } from './read.js'

export const how = {
  'fast-break': 'The last man commits. He takes the ball: hit the open wing. He takes a wing: keep it and finish.',
}

// ── The rules ───────────────────────────────────────────────────────────────
const PRE = 260               // the push out of the steal: a press here counts for nothing
const COMMIT = 300            // ms his commit takes to happen: he's moving, it's there to see
const ARRIVE = [2250, 2050, 1850]       // from the outlet to the foul line, each break quicker
// the read window: what passing and IQ buy. reactMs is the shared trait clock (lib/minigames.js)
const W0 = [875, 815, 755], PER = [0.45, 0.37, 0.3]
const windowOf = (v, k) => W0[k] + (reactMs(clamp(v, 1, 11)) - reactMs(1)) * PER[k]
const FLOOR_MS = 380          // the look itself: free for the score
const FLASH = 400             // how long a fake looks like the real thing
const PASS_MS = 300           // a pass to the wing, hands to hands
const PICK_MS = 190           // a pass that's jumped: his hands get there first
const RUN_V = 0.021           // a finisher at full tilt, feet a ms
const DUNK_AT = 330, DUNK_HANG = 150, DUNK_FALL = 240   // off the floor: to the iron, hung there, back down
const REL = 270, SHOT = 300   // a layup: off the floor to the release, and its trip to the rim
const CONTACT = 300           // a charge: from the late moment to the collision
// he pushes it a step off the middle, so the last man is there to see past him
const hxOf = u => (u < 0.5 ? -1 : 1) * lerp(1.4, 2.4, (u % 0.5) * 2)
const sgn = z => (z === 0 ? -1 : 1)

export function make({ v, seed, def, cast }) {
  const r = rngOf(seed)
  const rounds = def?.rounds ?? 3
  let last = -1, last2 = -1
  const plan = Array.from({ length: rounds }, (_, k) => {
    const T = windowOf(v, k), arrive = ARRIVE[k] ?? ARRIVE[2]
    const p = { k, T, arrive, delay: arrive - T, at: 0, res: null, hx: hxOf(r()), ph: r() * 6.28, wz: [lerp(-0.6, 0.6, r()), 0, lerp(-0.6, 0.6, r())] }
    for (let tries = 0; tries < 3; tries++) {
      if (k === 0) {
        // two on one: a wing, and the last man
        p.n = 2; p.setup = 'two'; p.s = r() < 0.5 ? 0 : 2; p.d1 = r() < 0.5 ? 'ball' : p.s
        p.open = p.d1 === 'ball' ? p.s : 1
        p.d1x = sgn(p.s) * 0.4
      } else if (r() < 0.55) {
        // three on two, the top man running with one wing: the last man has the ball or the other wing
        p.n = 3; p.setup = 'deny'; p.a = r() < 0.5 ? 0 : 2; p.b = 2 - p.a; p.d1 = r() < 0.5 ? 'ball' : p.b
        p.open = p.d1 === 'ball' ? p.b : 1
        p.d1x = sgn(p.b) * 1.2
      } else {
        // the tandem: the top man stops the ball, the last man takes a wing, the other one's open
        p.n = 3; p.setup = 'tandem'; p.d2x = r() < 0.5 ? -2.2 : 2.2; p.d1 = r() < 0.5 ? 0 : 2
        p.open = 2 - p.d1
        p.d1x = -Math.sign(p.d2x) * 1.8
      }
      if (!(p.open === last && p.open === last2)) break
    }
    last2 = last; last = p.open
    // the fake: a hard show at the other thing, then the real commit
    p.decoy = null
    if (k > 0 && r() < 0.6) {
      const to = p.setup === 'tandem' ? 2 - p.d1 : p.d1 === 'ball' ? p.b : 'ball'
      const bait = p.setup === 'tandem' ? p.d1 : p.d1 === 'ball' ? 1 : p.b
      const room = p.delay - PRE - FLASH
      p.decoy = { to, k: bait, at: PRE + room * lerp(0.3, 0.55, r()), flash: FLASH }
    }
    return p
  })
  const padsOf = p => (p.n === 2 ? (p.s === 0 ? ['LEFT', 'KEEP', ''] : ['', 'KEEP', 'RIGHT']) : ['LEFT', 'KEEP', 'RIGHT'])
  const liveOf = p => (p.n === 2 ? [p.s === 0, true, p.s === 2] : [true, true, true])
  // (the first break says what the read is; after that it's yours)
  const promptOf = p => (p.k === 0 ? 'HE TAKES BALL: PASS · WING: KEEP' : `${p.n} ON ${p.n - 1} · READ THE LAST MAN`)
  const g = {
    t: 0, game: 'fast-break', zones: 'three', fx: [], done: null, outro: 1500, stamp: null, later: null,
    plan, i: 0, rep: plan[0], pads: padsOf(plan[0]), live: liveOf(plan[0]), padLit: null, litAt: -999,
    nudge: nudge(), cast,
    // what the play's showing right now, by pad: null, 'open' or 'bait'. Nothing marks it on the screen: it's in
    // how the last man moves. (This is what the bot gets to read, at the price of a look.)
    cues: [null, null, null],
    hud: { prompt: promptOf(plan[0]), dots: plan.map(() => null) },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 120) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const rep = g.rep
      if (rep.res) {
        if (!g.done && g.t - rep.res.at >= rep.res.beat) next()
        return
      }
      const age = g.t - rep.at, d = rep.decoy
      g.cues[0] = g.cues[1] = g.cues[2] = null
      if (d && age >= d.at && age < d.at + d.flash) g.cues[d.k] = 'bait'
      if (age >= rep.delay) g.cues[rep.open] = 'open'
      if (age > rep.delay + rep.T) settle('late', 1)
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const k = a.zone
      if (k !== 0 && k !== 1 && k !== 2) return
      g.padLit = k; g.litAt = g.t
      const rep = g.rep
      if (rep.res || !g.live[k]) { g.fx.push('h:light'); return }
      const age = g.t - rep.at
      if (age < PRE) return
      if (g.cues[k] === 'bait') settle('bait', k)
      else if (age < rep.delay) settle('early', k)
      else if (k !== rep.open) settle('wrong', k)
      else settle('good', k, age - rep.delay)
    },
  }
  function settle(kind, k, ms = 0) {
    const rep = g.rep, fa = g.t - rep.at, good = kind === 'good'
    // what it turns into on the floor
    let how
    if (good) how = 'finish'
    else if (kind === 'late') how = rep.d1 === 'ball' || rep.setup === 'tandem' ? 'charge' : 'block'
    else if (k !== 1) how = 'pick'
    else how = kind === 'wrong' ? 'charge' : 'block'
    const res = { kind, k, how, at: g.t, fa, ms, dunk: good && ms <= rep.T * 0.45, score: 0, beat: 0, makeAt: 0, stampAt: 0 }
    rep.res = res
    res.plan = finishPlan(rep, res)
    if (good) {
      res.score = clamp(1 - Math.max(0, ms - FLOOR_MS) / Math.max(1, rep.T - FLOOR_MS), 0.35, 1)
      res.makeAt = res.plan.makeAt
      res.beat = res.makeAt + 1400
      res.stampAt = res.makeAt + 40
    } else {
      res.beat = how === 'block' ? res.plan.hitAt + 1500 : 1850
      res.stampAt = how === 'pick' ? PICK_MS + 60 : how === 'charge' ? CONTACT + 40 : res.plan.hitAt + 20
    }
    g.cues[0] = g.cues[1] = g.cues[2] = null
    g.hud.dots[g.i] = good
    g.hud.prompt = null
    g.fx.push(k === 1 ? 'h:light' : 'swoosh', good ? 'h:light' : 'h:medium')
    const word = good ? (k === 1 ? (res.dunk ? 'SLAM' : 'LAYUP') : (res.dunk ? 'DUNK' : 'LAYUP'))
      : kind === 'early' ? 'TOO EARLY' : how === 'pick' ? 'PICKED OFF' : how === 'charge' ? 'CHARGE' : 'BLOCKED'
    g.stamp = { text: word, good, at: g.t + res.stampAt, ms: Math.max(520, res.beat - res.stampAt - 160), size: word.length > 9 ? 34 : 40 }
    if (plan.every(p => p.res)) {
      const made = plan.filter(p => p.res.kind === 'good').length, hit = made >= Math.min(2, rounds)
      const avg = plan.reduce((s, p) => s + p.res.score, 0) / rounds
      const misses = plan.filter(p => p.res.kind !== 'good'), lastMiss = misses[misses.length - 1]?.res
      const why = !lastMiss ? '' : lastMiss.kind === 'bait' ? ' · took the fake' : lastMiss.kind === 'early' ? ' · went early' : lastMiss.kind === 'late' ? ' · too slow' : lastMiss.how === 'pick' ? ' · picked off' : lastMiss.how === 'charge' ? ' · charge' : ' · blocked'
      const outs = misses.filter(p => p.res.kind === 'late').length
      g.done = outcome(hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, hit ? `${made} of ${rounds} breaks` : `${made} of ${rounds}${why}`, { made, of: rounds }, !hit && outs > 0 && outs >= misses.length)
      const tw = hit ? (made === rounds ? 'SHOWTIME' : 'ON THE RUN') : 'NO EASY ONES'
      g.later = { text: tw, good: hit, at: g.t + res.beat - 200, size: tw.length > 10 ? 34 : 44 }
      g.outro = res.beat + 1100
    }
  }
  function next() {
    g.i++
    const rep = g.rep = plan[g.i]
    rep.at = g.t
    g.stamp = null
    g.pads = padsOf(rep); g.live = liveOf(rep)
    g.hud.prompt = promptOf(rep)
  }
  return g
}

// ── The play, in feet: the rim at the origin, z toward half court is negative ─────────────
const Z0 = -45, ZD = -14.5            // where the ball starts, and the foul line he gets to as the window shuts
const LANE0 = 9.2, LANE1 = 7.8       // the wings' lanes, narrowing on the way in
const STRIDE = 8.6                    // feet a full stride covers, flat out
// the handler: flat out off the steal, slowing as he gets there (a third the speed at the line)
function zRun(rep, a) {
  const f = a / rep.arrive, D = ZD - Z0
  return f <= 1 ? Z0 + D * (1.48 * f - 0.48 * f * f) : ZD + (a - rep.arrive) * (D * 0.52) / rep.arrive
}
const xRun = (rep, a) => rep.hx + Math.sin(a / 520 + rep.ph) * 0.35
function wingAt(rep, w, a, o) {
  const f = clamp(a / rep.arrive, 0, 1)
  o.x = sgn(w) * lerp(LANE0, LANE1, f); o.z = zRun(rep, a) + lerp(0.8, 3.2, f) + rep.wz[w]
  return o
}
// up and down, then back: how a fake goes
const hump = (t, L) => (t < 0 || t > L ? 0 : t < L * 0.4 ? easeOut(t / (L * 0.4)) : t < L * 0.62 ? 1 : 1 - easeInOut((t - L * 0.62) / (L * 0.38)))
// where the last man goes when he commits: up on the ball, or out to a wing's lane
function spotOf(rep, to, a, o) {
  // (two moves you can't mix up: straight at the ball and big as he comes, or all the way out into a wing's passing lane, the paint left empty)
  if (to === 'ball') { const hx = xRun(rep, a); o.x = hx - Math.sign(hx || 1) * 2.1; o.z = clamp(zRun(rep, a) + 4.2, -19.5, -7.2) }   // (on his inside shoulder: you see him past the ball) else { o.x = sgn(to) * 7.6; o.z = -14.2 }
  return o
}
const Q = { x: 0, z: 0 }
function d1At(rep, a, o) {
  o.x = rep.d1x; o.z = lerp(-15.6, -12.6, easeOut(clamp(a / rep.delay, 0, 1)))
  const d = rep.decoy
  if (d && a >= d.at) { const f = hump(a - d.at, d.flash) * 0.5; if (f > 0) { spotOf(rep, d.to, a, Q); o.x = lerp(o.x, Q.x, f); o.z = lerp(o.z, Q.z, f) } }
  if (a >= rep.delay) { const f = easeOut(prog(a, rep.delay, rep.delay + COMMIT)); spotOf(rep, rep.d1, a, Q); o.x = lerp(o.x, Q.x, f); o.z = lerp(o.z, Q.z, f) }
  return o
}
const W = { x: 0, z: 0 }
function d2At(rep, a, o) {
  if (rep.setup === 'deny') { wingAt(rep, rep.a, a, W); o.x = W.x - sgn(rep.a) * 2.1; o.z = W.z + 2.3; return o }
  // the tandem's top man: back ahead of the ball, then up on it
  o.x = rep.d2x; o.z = Math.min(-6, zRun(rep, a) + 8.4)
  if (a >= rep.delay) { const f = easeOut(prog(a, rep.delay, rep.delay + COMMIT)); o.x = lerp(o.x, xRun(rep, a) * 0.7 + rep.d2x * 0.35, f); o.z = lerp(o.z, zRun(rep, a) + 4.3, f) }
  return o
}
// slowing to a stop: distance-time over L ms
const slow = (u, L = 700) => (u < L ? u - (u * u) / (2 * L) : L / 2)
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

// The finish, worked out once at the moment it's decided: the path, the take-off, when it's in (or lost)
function finishPlan(rep, res) {
  const fa = res.fa, H0 = { x: xRun(rep, fa), z: zRun(rep, fa) }
  const P = { H0, fa }
  const D1 = d1At(rep, fa, { x: 0, z: 0 }), D2 = rep.n === 3 ? d2At(rep, fa, { x: 0, z: 0 }) : null
  P.D1 = D1; P.D2 = D2
  const away = rep.d1 === 'ball' ? (H0.x > 0 ? -1 : 1) : -sgn(rep.d1)
  if (res.how === 'finish' && res.k === 1) {
    P.fin = 'h'; P.S0 = H0; P.TK = { x: away * 0.9, z: -5.2 }; P.TK2 = { x: away * 0.55, z: -2.5 }
    P.go = 0; P.tr = dist(H0, P.TK) / RUN_V
  } else if (res.how === 'finish') {
    const w = res.k, W0 = wingAt(rep, w, fa, { x: 0, z: 0 })
    P.fin = w; P.W0 = W0; P.C = { x: sgn(w) * 8.1, z: Math.min(-10.2, W0.z + 3) }
    P.S0 = P.C; P.TK = { x: sgn(w) * 2.5, z: -4.9 }; P.TK2 = { x: sgn(w) * 1.15, z: -2.4 }
    P.go = PASS_MS; P.tr = dist(P.C, P.TK) / RUN_V
    P.bounce = rep.d1 === 'ball' || rep.setup === 'tandem'
  } else if (res.how === 'pick') {
    const w = res.k, W0 = wingAt(rep, w, fa, { x: 0, z: 0 })
    P.W0 = W0; P.C = { x: sgn(w) * 8.1, z: Math.min(-10.2, W0.z + 3) }
    P.thief = rep.setup === 'deny' && w === rep.a ? 'd2' : 'd1'
    const T0 = P.thief === 'd2' ? D2 : D1
    P.T0 = T0; P.I = { x: lerp(H0.x, P.C.x, 0.6), z: lerp(H0.z, P.C.z, 0.6) }
  } else if (res.how === 'charge') {
    P.taker = rep.setup === 'tandem' ? 'd2' : 'd1'
    P.T0 = P.taker === 'd2' ? D2 : D1
    P.set = { x: H0.x + 0.15, z: H0.z + 3.1 }
  } else {
    // blocked: he goes up, and the last man's there with him
    P.TK = { x: away * 0.8, z: -5.4 }; P.TK2 = { x: away * 0.5, z: -3 }
    P.tr = dist(H0, P.TK) / RUN_V
    P.B = { x: away * 0.2, z: -2.9 }
    P.hitAt = P.tr + 250
  }
  if (res.how === 'finish') {
    P.up = P.go + P.tr                         // off the floor
    P.makeAt = P.up + (res.dunk ? DUNK_AT : REL + SHOT)
  }
  return P
}

// ── The picture ─────────────────────────────────────────────────────────────
const BACK = 14.5                     // feet the lens rides behind the ball
const CAM = { H: 10, D: 60, F: 256, maxF: 280, hzAt: 0.385 }   // D: as far back as it ever is (the room's painted from there)
const P_DUNK = pose({ hy: 49, fFx: 8, fBx: -8, fFy: 2, fBy: 7, hFx: 6, hFy: 122, hBx: -22, hBy: 80 })
const P_SIT = pose({ hy: 15, fFx: 30, fFy: 3, fBx: -30, fBy: 3, hFx: 26, hFy: 6, hBx: -26, hBy: 6 })   // on the seat of his shorts, hands back
const P_FLOP = pose({ hy: 40, lean: 0, fFx: 15, fBx: -15, hFx: 30, hFy: 88, hBx: -30, hBy: 88 })      // the contact: arms up, going down
const GUNS = pose({ hy: 46, fFx: 14, fBx: -14, hFx: 31, hFy: 94, hBx: -31, hBy: 94 })
const FIST = pose({ hy: 47, fFx: 13, fBx: -13, hFx: 18, hFy: 122, hBx: -20, hBy: 47 })
const HEADS = pose({ hy: 46, fFx: 11, fBx: -11, hFx: 12, hFy: 104, hBx: -12, hBy: 104 })
const HIPS = pose({ hy: 46, fFx: 12, fBx: -12, hFx: 18, hFy: 53, hBx: -18, hBy: 53 })
const CALL = pose({ hy: 46, fFx: 12, fBx: -12, hFx: 20, hFy: 84, hBx: -20, hBy: 84 })                   // hands up for it
const SHOW = pose({ hy: 40, fFx: 18, fBx: -18, hFx: 40, hFy: 70, hBx: -40, hBy: 70 })                   // squared up on the ball, wide
const PASS_R = pose({ hy: 45, fFx: 14, fBx: -11, hFx: 46, hFy: 76, hBx: 20, hBy: 80 })
const PASS_L = pose({ hy: 45, fFx: 11, fBx: -14, hFx: -20, hFy: 80, hBx: -46, hBy: 76 })
const PUSH = pose({ hy: 45, fFx: 12, fBx: -12, hFx: 14, hFy: 92, hBx: -14, hBy: 92 })                   // the ball out front, two hands
const ST = { h: easedState(), w0: easedState(), w2: easedState(), d1: easedState(), d2: easedState() }
const PP = { h: newPose(), w0: newPose(), w2: newPose(), d1: newPose(), d2: newPose() }
const runPose = (ph, P) => frontRun(ph, P)
const rattle = age => (age < 0 || age > 600 ? 0 : Math.sin(age / 26) * 3.2 * Math.exp(-age / 200))

// everyone, at a moment of the play: a = ms since it started. Positions, and what he's doing.
const MEN = { h: { x: 0, z: 0, j: 0 }, w0: { x: 0, z: 0, j: 0 }, w2: { x: 0, z: 0, j: 0 }, d1: { x: 0, z: 0, j: 0 }, d2: { x: 0, z: 0, j: 0 } }
const TMP = { h: { x: 0, z: 0, j: 0 }, w0: { x: 0, z: 0, j: 0 }, w2: { x: 0, z: 0, j: 0 }, d1: { x: 0, z: 0, j: 0 }, d2: { x: 0, z: 0, j: 0 } }
const lerpTo = (o, A, B, f) => { o.x = lerp(A.x, B.x, f); o.z = lerp(A.z, B.z, f); return o }
// the finisher's run: to the take-off, then through the air toward the rim
function finRun(P, u, o) {
  const v = u - P.go
  if (v < P.tr) lerpTo(o, P.S0, P.TK, v / P.tr)
  else lerpTo(o, P.TK, P.TK2, easeOut(prog(v - P.tr, 0, 380)))
  return o
}
function place(rep, a, M) {
  const res = rep.res, fa = res ? res.fa : Infinity, b = Math.min(a, fa)
  M.h.x = xRun(rep, b); M.h.z = zRun(rep, b)
  wingAt(rep, 0, b, M.w0); wingAt(rep, 2, b, M.w2)
  d1At(rep, b, M.d1)
  if (rep.n === 3) d2At(rep, b, M.d2)
  if (!res || a <= fa) return M
  const u = a - fa, P = res.plan, sl = slow(u)
  // whoever's not in it eases up
  M.h.x = xRun(rep, fa + sl); M.h.z = zRun(rep, fa + sl)
  wingAt(rep, 0, fa + sl, M.w0); wingAt(rep, 2, fa + sl, M.w2)
  if (rep.n === 3) {
    d2At(rep, fa + Math.min(u, COMMIT), M.d2)
    // the top man, beaten by it: he turns and gets out of the lane after it
    if (rep.setup === 'tandem' && (res.how === 'finish' || res.how === 'block')) { const f = easeInOut(prog(u, 120, 700)); M.d2.x += Math.sign(M.d2.x || rep.d2x) * 6 * f; M.d2.z += 1.5 * f }
  }
  d1At(rep, fa + Math.min(u, COMMIT), M.d1)
  if (res.how === 'finish') {
    const fin = P.fin === 'h' ? M.h : P.fin === 0 ? M.w0 : M.w2
    if (P.fin !== 'h') {
      // the wing cuts for the ball: to the catch, then the rim
      if (u < PASS_MS) lerpTo(fin, P.W0, P.C, u / PASS_MS)
      else finRun(P, u, fin)
      // and the passer jogs in behind it
      M.h.z = zRun(rep, fa) + slow(u, 900) * 0.006; M.h.x = lerp(xRun(rep, fa), -sgn(P.fin) * 4.8, easeInOut(prog(u, 100, 800)))
    } else finRun(P, u, fin)
    // the last man turns and chases it, a step late
    const chase = prog(u, 220, 220 + 900)
    if (chase > 0) { const side = -Math.sign(P.TK.x || 1), tgt = P.fin === 'h' ? { x: side * 5.2, z: 0.4 } : { x: side * 5.8, z: -9.8 }; const cf = easeInOut(chase) * (P.fin === 'h' ? 1 : 0.8); M.d1.x = lerp(M.d1.x, tgt.x, cf); M.d1.z = lerp(M.d1.z, tgt.z, cf) }
  } else if (res.how === 'pick') {
    const th = P.thief === 'd2' ? M.d2 : M.d1
    if (u < PICK_MS) lerpTo(th, P.T0, P.I, easeOut(u / PICK_MS))
    else if (u < 380) { th.x = P.I.x; th.z = P.I.z }
    else { const v = u - 380; th.x = P.I.x + Math.sign(P.I.x || 1) * v * 0.0035; th.z = P.I.z - v * 0.022 }
    // the man it was going to pulls up
    const w = res.k === 0 ? M.w0 : M.w2
    wingAt(rep, res.k, fa + slow(u, 360), w)
  } else if (res.how === 'charge') {
    const tk = P.taker === 'd2' ? M.d2 : M.d1
    lerpTo(tk, P.T0, P.set, easeOut(prog(u, 0, 200)))
    if (u > CONTACT) tk.z += 1.1 * easeOut(prog(u, CONTACT, CONTACT + 260))
    M.h.x = P.H0.x; M.h.z = P.H0.z + 1.6 * prog(u, 0, CONTACT) + 0.5 * easeOut(prog(u, CONTACT, CONTACT + 300))
  } else {
    // blocked
    if (u < P.tr) lerpTo(M.h, P.H0, P.TK, u / P.tr)
    else lerpTo(M.h, P.TK, P.TK2, easeOut(prog(u - P.tr, 0, 380)))
    lerpTo(M.d1, P.D1, P.B, easeInOut(prog(u, 60, P.tr - 40)))
  }
  return M
}

// the camera's own memory: it eases where it's told
function camOf(g, view, rep, a) {
  const C = g.camS ?? (g.camS = { i: -1, z: 0, x: 0, t: 0 })
  const res = rep.res, u = res ? a - res.fa : -1, P = res?.plan
  let tz = zRun(rep, res ? res.fa : a) - BACK, tx = xRun(rep, res ? res.fa : a) * 0.15
  if (!res) { tz = zRun(rep, a) - BACK }
  else if (res.how === 'finish' || res.how === 'block') {
    const fin = res.how === 'block' || P.fin === 'h' ? MEN.h : P.fin === 0 ? MEN.w0 : MEN.w2
    tz = Math.min(fin.z - 10.5, -13); tx = fin.x * 0.5
  } else if (res.how === 'pick') {
    const th = P.thief === 'd2' ? MEN.d2 : MEN.d1
    tz = Math.min(zRun(rep, res.fa) - BACK, th.z - 9); tx = th.x * 0.35
  }
  if (C.i !== g.i) { C.i = g.i; C.z = tz; C.x = tx; C.t = g.t }
  const dt = Math.min(80, Math.max(0, g.t - C.t)); C.t = g.t
  if (!res) { C.z = tz; C.x += (tx - C.x) * (1 - Math.exp(-dt / 300)) }
  else { const k = 1 - Math.exp(-dt / (res.how === 'pick' ? 260 : 230)); C.z += (tz - C.z) * k; C.x += (tx - C.x) * k }
  return C
}

// the push out of the steal, as it looks: from a standing start up to the play's own pace by GO_MS, the same from there on
const GO_MS = 360
const outlet = a => (a >= GO_MS ? a : a <= 0 ? GO_MS / 2 : (a * a) / (2 * GO_MS) + GO_MS / 2)
const SKIN = [SKINS[0], SKINS[2], SKINS[1], SKINS[3], SKINS[2]]
const ARR = []
export function draw(ctx, g, view) {
  smoothT(g)
  const rep = g.rep, res = rep.res, c = view.colors, us = { color: c.us, trim: c.trim }, them = themOf(view)
  // (the play's own clock, as the rules have it: what smoothT smooths is the poses, not where anyone is.
  // From the outlet he gets up to speed over the first few strides instead of starting the picture flat out)
  const a = outlet(g.t - rep.at), u = res ? a - res.fa : -1, P = res?.plan
  const M = castMen(g, view)
  place(rep, a, MEN)
  place(rep, a - 24, TMP)          // (a moment ago: how fast each man's going, and which way)
  // the camera
  const G = g.fbG && g.fbG.h === view.h ? g.fbG : (g.fbG = arenaCam(view.h, CAM))
  const C = camOf(g, view, rep, a)
  dolly(G, -C.z, C.x)
  const cam = G.cam
  arenaStage(ctx, view, G, 'fb', true)
  const dy = wallNow(G) - G.wallY, U = view.h / 640
  // the building's two standing-up pictures, painted now in the still moment before the clock starts, not on the first make
  if (!g._warm) { g._warm = true; if (!lightFx()) crowdPop(ctx, view, [c.us, c.trim], -1, { foot: G.wallY - 22 * U }) }
  // the building: up for a make, phones going off
  const made = res?.how === 'finish' && u >= res.makeAt
  if (made && !rep._in) { rep._in = true; rep.popAt = g.t; if (g.sit) g.sit = { ...g.sit, mine: g.sit.mine + 2 } }
  if (rep.popAt != null) {
    const age = g.t - rep.popAt
    ctx.save(); ctx.translate(0, dy)
    crowdPop(ctx, view, [c.us, c.trim], age, { ms: 1500, power: res?.dunk || g.done?.hit ? 0.9 : 0.7, foot: G.wallY - 22 * U })
    if (age < 900) { camFlashes(ctx, view, G, g.t, res?.dunk ? 16 : 10); boardFlash(ctx, view, G, c.us, 0.5 * (1 - age / 900)) }
    ctx.restore()
  }

  // ── the ball ──
  let ball = AB, netAge = null, spin = g.t / 160, rimDy = 0, carry = null
  const H = MEN.h
  const DRIB = 380, top = Math.abs(Math.cos((Math.PI * a) / DRIB))
  const dribbling = !res || (res.how === 'finish' && P.fin === 'h' && u < P.tr) || (res.how === 'block' && u < P.tr) || (res.how === 'charge' && u < CONTACT)
  const bn = Math.floor(a / DRIB + 0.5)
  if (dribbling && bn !== rep._bn) { rep._bn = bn; if (a > 60) g.fx.push('dribble') }
  if (dribbling) { AB.x = H.x + 1.55; AB.z = H.z + 0.55; AB.y = lerp(BALL_R, 2.7, top) }
  else if (res.how === 'finish') {
    const fin = P.fin === 'h' ? MEN.h : P.fin === 0 ? MEN.w0 : MEN.w2
    const v = u - P.up
    if (P.fin !== 'h' && u < PASS_MS) {
      // the pass: a bounce pass under a man up on the ball, chest high otherwise
      const f = u / PASS_MS, sx = P.H0.x + sgn(P.fin) * 0.9, ex = P.C.x - sgn(P.fin) * 0.6
      if (P.bounce) {
        const f1 = 0.55
        if (f < f1) flyTo(sx, 3.4, P.H0.z + 0.6, lerp(sx, ex, f1), BALL_R, lerp(P.H0.z, P.C.z, f1), f / f1)
        else flyTo(lerp(sx, ex, f1), BALL_R, lerp(P.H0.z, P.C.z, f1), ex, 3.6, P.C.z, (f - f1) / (1 - f1), 0.5)
        if (f >= f1 && !rep._bp) { rep._bp = true; g.fx.push('dribble') }
      } else flyTo(sx, 4, P.H0.z + 0.6, ex, 4, P.C.z, f, 0.35)
      spin = g.t / 90
    } else if (v < 0) {
      // in his hands to the take-off (the keeper's still bouncing it, above)
      if (P.fin !== 'h' && !rep._cb) { rep._cb = true; g.fx.push('catchball', 'h:light') }
      ball = null; carry = IN_HANDS
    } else if (res.dunk) {
      if (v < DUNK_AT) { ball = null; carry = IN_HANDS }
      else { dropThrough(v - DUNK_AT); netAge = v - DUNK_AT; rimDy = rattle(v - DUNK_AT) }
    } else if (v < REL) { ball = null; carry = IN_HANDS }
    else if (v < REL + SHOT) {
      // off the glass and in: up off his fingertips to the rim
      project(cam, fin.x, 0, fin.z)
      flyTo(fin.x + 0.25, 9.3, fin.z + 0.5, 0, RIM_Y + 0.35, -0.05, (v - REL) / SHOT, 1.1)
      spin = g.t / 70
    } else { dropThrough(v - REL - SHOT); netAge = v - REL - SHOT }
  } else if (res.how === 'pick') {
    const th = P.thief === 'd2' ? MEN.d2 : MEN.d1
    if (u < PICK_MS) {
      const f = u / PICK_MS, sx = P.H0.x + sgn(res.k) * 0.9
      flyTo(sx, 4, P.H0.z + 0.6, P.I.x, 4.2, P.I.z, f * 0.97, 0.2); spin = g.t / 90
    } else if (u < 380) { ball = null; carry = IN_HANDS }
    else { const tb = Math.abs(Math.cos((Math.PI * u) / 330)); AB.x = th.x + 1.5; AB.z = th.z - 0.5; AB.y = lerp(BALL_R, 2.8, tb) }
  } else if (res.how === 'charge') {
    const f = prog(u, CONTACT, CONTACT + 700)
    flyTo(H.x + 1.4, 2.4, H.z + 0.4, H.x + 4.2, BALL_R, H.z + 4, Math.min(1, f * 1.6), 1.4)
    if (f > 0.62) { const b = (f - 0.62) / 0.38; AB.x = H.x + 4.2 + b * 2; AB.z = H.z + 4 + b * 3; AB.y = BALL_R + Math.abs(Math.sin(b * 6)) * 1.2 * (1 - b) }
    spin = u / 60
  } else {
    // up for the layup, and it's sent away
    const v = u - P.tr
    if (v < 250) { ball = null; carry = IN_HANDS }
    else {
      const f = clamp((v - 250) / 560, 0, 1), o = MEN.h.x <= 0 ? 1 : -1
      flyTo(MEN.h.x + 0.3, 9.4, MEN.h.z + 0.4, o * 12, BALL_R, -9, f, 2.6)
      if (f >= 1) { const b = (v - 810) / 900; AB.x = o * (12 + b * 4); AB.z = -9 - b * 4; AB.y = BALL_R + Math.abs(Math.sin(b * 7)) * 1.6 * Math.exp(-b * 2.5) }
      spin = v / 40
    }
  }
  // the sounds and the hits of it
  if (res) {
    if (res.how === 'finish' && netAge != null && once(rep, '_mk')) { g.fx.push('make', res.dunk ? 'stamp' : 'h:medium'); if (res.dunk) { g.nudge.kick(g.t, 5, 0, 1, 240); g.fx.push('h:heavy') } }
    if (res.how === 'pick' && u >= PICK_MS && once(rep, '_pk')) { g.fx.push('catchball', 'h:medium'); g.nudge.kick(g.t, 2.5, sgn(res.k), 0, 160) }
    if (res.how === 'charge' && u >= CONTACT && once(rep, '_ch')) { g.fx.push('whistle', 'h:heavy'); g.nudge.kick(g.t, 4, 0, 1, 200) }
    if (res.how === 'block' && u >= P.hitAt && once(rep, '_bk')) { g.fx.push('stamp', 'h:heavy'); g.nudge.kick(g.t, 4, 0, 1, 200) }
  }
  const atIron = hoopWith(ctx, cam, ball, netAge, spin, rimDy)

  // ── the men, far to near ──
  ARR.length = 0
  const pushMan = (key, side, back, who, P2, ball2, lift) => ARR.push({ key, m: MEN[key], side, back, who, P: P2, ball: ball2, lift })
  // the handler
  const hp = PP.h, hv = speedOf('h')
  if (!res) dribPose(hp, H.z, top)
  else if (res.how === 'finish' && P.fin === 'h') finPose(hp, rep, res, u, H.z, top, cam, MEN.h)
  else if (res.how === 'block') {
    const v = u - P.tr
    if (v < 0) dribPose(hp, H.z, top)
    else { copyPose(POSE.layup, hp); hp.j = Math.sin(clamp(v / 640, 0, 1) * Math.PI) * 34; if (v > 640) copyPose(v > 900 ? HEADS : POSE.land, hp) }
  } else if (res.how === 'charge') {
    if (u < CONTACT) dribPose(hp, H.z, top)
    else copyPose(u < CONTACT + 380 ? POSE.stumbleR : HEADS, hp)
  } else if (res.how === 'pick') {
    copyPose(u < 420 ? (res.k === 0 ? PASS_L : PASS_R) : u < 700 ? POSE.off : HEADS, hp)
  } else {
    // he's given it up: the follow-through, then a jog in behind it, and up when it's down
    if (u < 260) copyPose(res.k === 0 ? PASS_L : PASS_R, hp)
    else if (made && g.t - rep.popAt < 1200) copyPose(POSE.hands, hp)
    else if (hv > 0.004) runPose((H.z - Z0) / STRIDE * Math.PI * 2, hp)
    else copyPose(POSE.off, hp)
  }
  pushMan('h', us, true, M?.us[0] ?? { number: 3, skin: SKIN[0] }, easedPose(ST.h, hp, g, CLK.dt, 22), carry && whoHas(res, P) === 'h' ? IN_HANDS : null)
  // the wings
  for (const w of [0, 2]) {
    if (rep.n === 2 && w !== rep.s) continue
    const key = w === 0 ? 'w0' : 'w2', m = MEN[key], pp = PP[key], v = speedOf(key)
    const isFin = res?.how === 'finish' && P.fin === w
    if (isFin && u >= PASS_MS) finPose(pp, rep, res, u, m.z, 0, cam, m)
    else if (isFin) { runPose((m.z - Z0) / STRIDE * Math.PI * 2, pp); const f = u / PASS_MS; pp.hFy = lerp(pp.hFy, 86, f); pp.hBy = lerp(pp.hBy, 86, f); pp.hFx = lerp(pp.hFx, 20, f); pp.hBx = lerp(pp.hBx, -20, f) }
    else if (made) copyPose(g.t - rep.popAt < 1100 ? POSE.hands : POSE.off, pp)
    else if (res && res.how === 'pick' && res.k === w && u > 300) copyPose(u > 800 ? HIPS : CALL, pp)
    else if (v > 0.004) runPose((m.z - Z0) / STRIDE * Math.PI * 2 + (w ? 1.3 : 0.4), pp)
    else copyPose(res && !made && u > 900 ? HIPS : POSE.off, pp)
    const who = M?.us[rep.n === 2 ? 1 : w === 0 ? 1 : 2] ?? { number: w === 0 ? 11 : 24, skin: SKIN[w === 0 ? 1 : 2] }
    pushMan(key, us, true, who, easedPose(ST[key], pp, g, CLK.dt, 22), isFin && carry ? IN_HANDS : null)
  }
  // the last man
  const d1p = PP.d1
  d1Pose(d1p, rep, res, P, u, a, g)
  pushMan('d1', them, false, M?.them[3] ?? { number: 34, skin: SKIN[3] }, easedPose(ST.d1, d1p, g, CLK.dt, 26), res?.how === 'pick' && P.thief === 'd1' && u >= PICK_MS && u < 380 ? IN_HANDS : null)
  if (rep.n === 3) {
    const d2p = PP.d2
    d2Pose(d2p, rep, res, P, u, a, g)
    pushMan('d2', them, false, M?.them[0] ?? { number: 5, skin: SKIN[4] }, easedPose(ST.d2, d2p, g, CLK.dt, 26), res?.how === 'pick' && P.thief === 'd2' && u >= PICK_MS && u < 380 ? IN_HANDS : null)
  }
  // a thief with it, running the other way, has it in his hands and then on the bounce
  ARR.sort((p, q) => q.m.z - p.m.z)
  let ballDrawn = !ball || atIron
  for (const e of ARR) {
    if (!ballDrawn && AB.z > e.m.z) { ballIn(ctx, cam, AB.x, AB.y, AB.z, spin); ballDrawn = true }
    if (!manAt(ctx, view, cam, e.m.x, e.m.z, e.P, { jersey: e.side.color, trim: e.side.trim, skin: e.who.skin, num: e.who.number, back: e.back, ball: e.ball, spin, live: true })) continue
    if (M && PT.x > 6 && PT.x < view.w - 6) tagAt(PT.x, PT.y - 11 - (e.P.j ?? 0) * (PT.k / FIG_FT), e.who.name, PT.k / FIG_FT)
  }
  if (M) tagsDown(ctx, view)
  if (!ballDrawn) ballIn(ctx, cam, AB.x, AB.y, AB.z, spin)
  if (g.later && g.later.y == null) g.later.y = view.h - 160
  if (g.stamp && g.stamp.y == null) g.stamp.y = view.h - 160

  function speedOf(key) { return Math.hypot(MEN[key].x - TMP[key].x, MEN[key].z - TMP[key].z) / 24 }
}
const once = (o, k) => (o[k] ? false : (o[k] = true))
const whoHas = (res, P) => (!res ? 'h' : res.how === 'finish' ? (P.fin === 'h' ? 'h' : 'w') : res.how === 'block' ? 'h' : 'x')
// running with it: legs from the stride, the ball hand (his right, screen right from behind) on the bounce
function dribPose(P, z, top) {
  runPose(((z - Z0) / STRIDE) * Math.PI * 2, P)
  P.hFx = 25; P.hFy = Math.max(30, lerp(BALL_R * FIG_FT, 2.7 * FIG_FT, top) + 7)
  P.hBx = -19; P.hBy = 58
}
// the finisher, whoever he is: the gather, up, the dunk or the layup, and the celebration
function finPose(Pz, rep, res, u, z, top, cam, m) {
  const P = res.plan, v = u - P.up
  if (v < 0) {
    if (P.fin === 'h') dribPose(Pz, z, top)
    else { runPose(((z - Z0) / STRIDE) * Math.PI * 2, Pz); Pz.hFx = 12; Pz.hFy = 80; Pz.hBx = -8; Pz.hBy = 80 }
    if (v > -120) copyPose(POSE.gather, Pz)
    return
  }
  if (res.dunk) {
    // how high his hand has to go to be at the iron, through this lens, from where he is
    project(cam, 0, RIM_Y + 0.1, -0.75)
    const ironY = PT.y
    project(cam, m.x, 0, m.z)
    const need = Math.max(20, (PT.y - ironY) / (PT.k / FIG_FT) - P_DUNK.hFy)
    const fall = prog(v, DUNK_AT + DUNK_HANG, DUNK_AT + DUNK_HANG + DUNK_FALL)
    mixPose(POSE.gather, P_DUNK, clamp(v / 170, 0, 1), Pz)
    if (fall > 0) mixPose(Pz, POSE.land, fall, Pz)
    Pz.j = Math.min(need, 70) * easeOut(prog(v, 0, DUNK_AT)) * (1 - fall * fall)
    if (v > DUNK_AT + DUNK_HANG + DUNK_FALL + 120) copyPose(GUNS, Pz)
  } else {
    const air = 640
    copyPose(POSE.layup, Pz)
    Pz.j = Math.sin(clamp(v / air, 0, 1) * Math.PI) * 36
    if (v > air) copyPose(v > air + 160 ? FIST : POSE.land, Pz)
  }
}
// the last man: the backpedal, the fake, the commit, and what happens to him
function d1Pose(Pz, rep, res, P, u, a, g) {
  const mv = Math.hypot(MEN.d1.x - TMP.d1.x, MEN.d1.z - TMP.d1.z) / 24, lat = Math.abs(MEN.d1.x - TMP.d1.x) > Math.abs(MEN.d1.z - TMP.d1.z)
  const to = !res || u < 0 ? (a >= rep.delay ? rep.d1 : rep.decoy && a >= rep.decoy.at && a < rep.decoy.at + rep.decoy.flash ? rep.decoy.to : null) : null
  if (res && u >= 0) {
    if (res.how === 'pick' && P.thief === 'd1') { if (u < 380) copyPose(POSE.hands, Pz); else runPose(u / 55, Pz); return }
    if (res.how === 'charge' && P.taker === 'd1') { chargePose(Pz, u); return }
    if (res.how === 'block') {
      const v = u - P.tr
      if (v > -20 && v < 700) { copyPose(POSE.hands, Pz); Pz.j = Math.sin(clamp((v + 20) / 640, 0, 1) * Math.PI) * 40; return }
      if (v >= 700) { copyPose(POSE.off, Pz); return }
    }
    if (res.how === 'finish') {
      // beaten: a step late, a hand up as it goes in, then hands on hips
      const v = u - P.up
      if (v > -60 && v < 520) { copyPose(POSE.hands, Pz); Pz.j = Math.sin(clamp((v + 60) / 560, 0, 1) * Math.PI) * 16; return }
      if (v >= 520) { copyPose(HIPS, Pz); return }
    }
  }
  if (mv > 0.004 && lat) copyPose(Math.floor(g.t / 95) % 2 ? POSE.slideA : POSE.slideB, Pz)
  else if (mv > 0.006) runPose(g.t / 60, Pz)
  else copyPose(Math.floor(g.t / 340) % 2 ? POSE.guardA : POSE.guardB, Pz)
  // his arms say what he's doing: wide on the ball, the near arm out into a lane
  if (to === 'ball') {
    // up at him: squared, low, both arms high and wide
    if (mv > 0.006) runPose(g.t / 50, Pz); else copyPose(SHOW, Pz)
    Pz.hy = 39; Pz.lean = 0; Pz.hx = 0; Pz.hFx = 46; Pz.hFy = 90; Pz.hBx = -46; Pz.hBy = 90
  } else if (to === 0 || to === 2) {
    // hips turned and running out to the wing, the lane arm out in front of the pass
    const sd = sgn(to)
    if (mv > 0.004) { runPose(g.t / 50, Pz); Pz.lean = sd * 0.22; Pz.hx = sd * 4 } else { copyPose(POSE.deny, Pz); Pz.lean = sd * 0.1; Pz.hx = sd * 2 }
    // (the lane arm reaching out to that side, the other lower and out the other way: spread across his lane)
    if (sd > 0) { Pz.hFx = 60; Pz.hFy = 84; Pz.hBx = -32; Pz.hBy = 64 } else { Pz.hBx = -60; Pz.hBy = 84; Pz.hFx = 32; Pz.hFy = 64 }
  }
}
function d2Pose(Pz, rep, res, P, u, a, g) {
  if (res && u >= 0 && res.how === 'pick' && P.thief === 'd2') { if (u < 380) copyPose(POSE.hands, Pz); else runPose(u / 55, Pz); return }
  if (res && u >= 0 && res.how === 'charge' && P.taker === 'd2') { chargePose(Pz, u); return }
  const mv = Math.hypot(MEN.d2.x - TMP.d2.x, MEN.d2.z - TMP.d2.z) / 24
  if (mv > 0.006) runPose(((MEN.d2.z - Z0) / STRIDE) * Math.PI * 2 + 2, Pz)
  else copyPose(POSE.isoD, Pz)
  if (rep.setup === 'deny') {
    // denying his man: the arm on the passing lane's side up in it
    if (rep.a === 0) { Pz.hFx = 36; Pz.hFy = 74 } else { Pz.hBx = -36; Pz.hBy = 74 }
  } else if (a >= rep.delay || (res && u >= 0)) { Pz.hFx = SHOW.hFx; Pz.hFy = SHOW.hFy; Pz.hBx = SHOW.hBx; Pz.hBy = SHOW.hBy }
}
function chargePose(Pz, u) {
  if (u < CONTACT) copyPose(SHOW, Pz)
  else if (u < CONTACT + 160) copyPose(P_FLOP, Pz)
  else mixPose(P_FLOP, P_SIT, prog(u, CONTACT + 160, CONTACT + 320), Pz)
}
void reduceMotion
