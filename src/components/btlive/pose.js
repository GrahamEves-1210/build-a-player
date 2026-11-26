// BLACKTOP LIVE: what each man's body is doing, as a pose figure.js can draw. Read every frame from the game's
// state and what just happened (the simulation's events): which way he's turned (where he's going, the man he
// guards, the rim he's shooting at), his stride, the dribble in the hand the game says the ball is in (player.hand)
// and each dribble move by its own shape (the ball across in front, between the legs, behind the back, the
// in-and-out, the hesitation, the step-back, the spin), the jumper and its follow-through, the layup, the dunk,
// a defensive stance, a swipe, a contest, a man frozen by a move or sat down by one. Only the picture.
//
// Every stride is a real cycle (gait): a cadence and a stride length by his speed, the feet planted and pushing back,
// hips and shoulders turning against each other, the dribble in time with his feet; stops, starts and landings settle.
// Arms move only as a real player's do, slim and close (figure.js draws them straight, no elbows): the dribbling hand at his side
// working the ball, the off arm a little out in front to protect it, a small swing running without it, both hands out
// and active in front guarding, both up only on a shot, a
// contest or a block, a quick reach on a steal. Every pose is a target the drawn hands and feet ease to (no snaps).
import { COURT, T, MOVES, MOVE_KEYS, HZ, gticks } from '../../lib/btlive/index.js'
import { HOOP_LIFT } from './court.js'
import { BODY } from './figure.js'

const RIM = COURT.rim, STEP = 1000 / HZ, TAU = Math.PI * 2
const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const ease = t => { t = c01(t); return t * t * (3 - 2 * t) }
const out3 = t => { t = c01(t); return 1 - (1 - t) * (1 - t) * (1 - t) }
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a }
const set3 = (h, x, y, z) => { h[0] = x; h[1] = y; h[2] = z }
const mix3 = (h, x, y, z, w) => { h[0] += (x - h[0]) * w; h[1] += (y - h[1]) * w; h[2] += (z - h[2]) * w }

const DRIB = 440, DRIB_RUN = 340      // ms a bounce, standing and at a run
export const DUNK = { hang: 290, drop: 240, land: 150 }   // ms: on the rim, coming down, the knees taking it (owner 11-26: a touch slower, so it reads; all after the make, in the dead ball before the check)
const FOLLOW = 560                    // ms a shooter holds his follow-through
const EASE_HAND = 70, EASE_FAST = 24, EASE_FOOT = 34      // ms: how quickly the drawn hands and feet reach the pose
const FOOT_V = 3.6                    // the quickest a drawn foot moves (his size units a second)

// (the post's shots by the shape they're drawn in: the fadeaway a jumper going back, the hook a one-hand shot at the rim)
const shape = k => (k === 'fade' ? 'jumper' : k === 'hook' ? 'layup' : k)
export function createPoser(N) {
  const A = Array.from({ length: N }, () => ({
    ang: -Math.PI / 2, x: null, y: 0, sp: 0, gp: 0, gR: 0, gS: 0, gL: 0, gRr: 0, mdx: 1, mdy: 0, acc: 0, spP: 0, stopT: -1e9, goT: -1e9, landT: -1e9, pAir: 0, bsd: 0, lfW: null, rfW: null, GL: [0, 0], GR: [0, 0], lx: 1, ly: 0, side: 1, from: 1, drib: 0,
    inMv: 0, mvT0: 0, gT0: -1, gKind: null, gSide: 1, gAir: 0,
    rel: null, swipe: null, pass: null, hit: null, wob: 1, cheer: false, land: 0, gOx: 0, gOy: 0,
    swat: null, cele: null, sad: 0, dvx: 0, dvy: 0, cutAt: 0,
    // what is drawn: eased toward each frame's pose
    lh: null, rh: null, lf: null, rf: null,
  }))
  const Z = Array.from({ length: N }, () => ({ ang: 0, lh: [0, 0, 0, 0], rh: [0, 0, 0, 0], lf: [0, 0, 0], rf: [0, 0, 0], tw: 0, hip: 0, air: 0, scale: 1, lean: 0, down: 0, ox: 0, oy: 0, ball: false, bl: [0, 0, 0], bside: 1, two: false, bounce: false, thud: false, under: false, toeL: 0, toeR: 0, cut: false }))
  const TL = [0, 0, 0, 0], TR = [0, 0, 0, 0], CL = [0, 0], CR = [0, 0], FW = [0, 0, 0], RH = [0, 0, 0, 0], RO = [0, 0, 0, 0]
  let lastMiss = null

  // what happened: the things a pose can't read off the state
  function on(e, s, now) {
    const p = e.pid != null ? A[e.pid] : null
    // a big bucket (a dunk, a poster, a three): once he's down, a fist pump after a dunk, a point after a three
    if (e.e === 'make' && p && (e.kind === 'dunk' || e.poster || e.deep || e.three)) p.cele = { t0: now + (e.kind === 'dunk' ? 560 : 420), pump: e.kind === 'dunk' || !!e.poster }
    if (e.e === 'release') p.rel = { t0: now, kind: shape(e.kind), air: p.gAir, side: p.gSide, slam: 0, out: 0 }
    else if (e.e === 'make' || e.e === 'waved') {
      if (p.rel) { p.rel.out = now; if (e.kind === 'dunk') p.rel.slam = now }
      // a poster: the man under it goes down
      if (e.poster && e.on != null) {
        const j = typeof e.on === 'number' ? e.on : s.players.findIndex(o => o.id === e.on)
        if (j >= 0) { const d = s.players[j], q = s.players[e.pid]; let ux = d.x - q.x, uy = d.y - q.y; const l = Math.hypot(ux, uy) || 1; A[j].hit = { t0: now, ux: ux / l, uy: l < 0.2 ? 1 : uy / l } }
      }
    } else if (e.e === 'miss') { if (p.rel) p.rel.out = now; lastMiss = { pid: e.pid, t: now } }
    else if (e.e === 'block') {
      const q = A[e.on]; if (q) { q.rel = { t0: now, kind: e.kind, air: q.gAir, side: q.gSide, slam: 0, out: now, blocked: true } }
      // the block itself: his arm swats through the ball, at the shooter
      const d = s.players[e.pid], o = s.players[e.on]; if (d && o) p.swat = { t0: now, a: Math.atan2(o.y - d.y, o.x - d.x) }
    }
    // a miss the other side came down with: the shooter's head drops for a moment
    else if (e.e === 'board') { if (lastMiss && now - lastMiss.t < 2500 && s.players[lastMiss.pid] && s.players[lastMiss.pid].team !== s.players[e.pid].team) A[lastMiss.pid].sad = now; lastMiss = null }
    // King of the Hill's check: the bounce pass over to the king, both hands through it
    else if (e.e === 'checkup') { const q = s.players[e.pid], to = s.players[e.to]; if (q && to) p.pass = { t0: now, a: Math.atan2(to.y - q.y, to.x - q.x) } }
    else if (e.e === 'swipe' || e.e === 'steal') {
      const h = e.e === 'steal' ? s.players[e.from] : s.ball.st === 'held' ? s.players[s.ball.holder] : null, q = s.players[e.pid]
      if (h) p.swipe = { t0: now, a: Math.atan2(h.y - q.y, h.x - q.x), miss: e.e === 'swipe' }
    } else if (e.e === 'pass') { const q = s.players[e.pid], to = s.players[e.to]; p.pass = { t0: now, a: Math.atan2(to.y - q.y, to.x - q.x) } }
    else if (e.e === 'move') { if (e.freeze && e.def >= 0) A[e.def].wob = (e.pid + s.tick) % 2 ? 1 : -1 }
    else if (e.e === 'final') { for (let i = 0; i < N; i++) A[i].cheer = s.players[i].team === e.winner }
    else if (e.e === 'check') { for (const a of A) { a.swipe = a.pass = null } }
  }

  // i's pose this frame. env: { x, y: where he's drawn (feet), a: how far into the tick the frame is (0-1), dt (ms),
  // held: ms his shot has been going up (his own meter's clock on this device; else from the game's ticks),
  // sFt: the figure's size in feet }
  function pose(s, i, now, env) {
    const p = s.players[i], a = A[i], z = Z[i], b = s.ball, P = s.players
    const live = s.phase === 'live', has = b.st === 'held' && b.holder === i
    const dt = env.dt
    a.nowT = now; TL[3] = TR[3] = 0
    // how far he went since the last frame: his stride comes from the floor he covers
    if (a.x == null) { a.x = env.x; a.y = env.y }
    const mvx = env.x - a.x, mvy = env.y - a.y, dist = Math.hypot(mvx, mvy)
    a.x = env.x; a.y = env.y
    const sp = dt > 0 ? Math.min(30, dist / dt * 1000) : 0                 // ft a real second
    if (dt > 0) a.sp += (sp - a.sp) * (1 - Math.exp(-dt / 90))
    const amp = c01(a.sp / 9)
    let fast = false
    // a hard cut: going fast and the way he goes swings round sharply, or a hard stop (a scuff on the floor: the screen
    // draws it). A dribble move's first step and a pull-up's plant leave one too (dribble, gather)
    z.cut = false
    if (dist > 0.02 && dist < 3) {
      const ux = mvx / dist, uy = mvy / dist
      // (or a hard stop: from a run to half that in a moment, the plant foot taking it)
      a.pk = Math.max(sp, (a.pk || 0) * Math.exp(-dt / 220))
      if (now - a.cutAt > 300 && ((a.sp > 6.5 && (a.dvx || a.dvy) && ux * a.dvx + uy * a.dvy < 0.8) || (a.pk > 8.5 && sp < a.pk * 0.45))) { z.cut = true; a.cutAt = now; if (sp < a.pk * 0.45) { a.stopT = now; a.stopF = (a.GL[0] * a.lx > a.GR[0] * a.lx) ? -1 : 1; a.stopX = a.mdx; a.stopY = a.mdy } a.pk = 0 }
      const kd = 1 - Math.exp(-dt / 260); a.dvx += (ux - a.dvx) * kd; a.dvy += (uy - a.dvy) * kd
      const l = Math.hypot(a.dvx, a.dvy) || 1; a.dvx /= l; a.dvy /= l
    }

    // ── which way he's turned ──
    let fa = Math.atan2(p.fy, p.fx), turn = 85
    const toRim = Math.atan2(RIM.y - env.y, RIM.x - env.x), dRim = Math.hypot(RIM.x - env.x, RIM.y - env.y)
    const ballX = b.st === 'held' ? P[b.holder].x : b.x, ballY = b.st === 'held' ? P[b.holder].y : b.y
    const toBall = Math.atan2(ballY - env.y, ballX - env.x)
    const shooting = p.act === 'gather' || (a.rel && now - a.rel.t0 < FOLLOW + 200)
    const man = p.man >= 0 ? P[p.man] : null
    const guarding = live && p.team !== s.poss && man && !has
    const M = has && p.burst > 0 ? p.mv : 0
    // a shot up or a ball coming off the rim: a man between his man and the rim puts his back into him and faces the
    // ball (the box-out)
    let boxOn = null
    if (live && !has && p.act === 'free' && (b.st === 'shot' || (b.st === 'loose' && b.reb))) {
      for (const o of P) {
        if (o.team === p.team || o.out) continue
        const d = Math.hypot(o.x - env.x, o.y - env.y)
        if (d < 4.6 && Math.hypot(RIM.x - o.x, RIM.y - o.y) > dRim + 0.6 && (!boxOn || d < boxOn.d)) boxOn = { d, o }
      }
    }
    if (shooting) { if (dRim > 1.2) fa = toRim; else fa = a.ang; turn = 60 }
    else if (boxOn) { fa = toBall; turn = 80 }
    else if (a.pass && now - a.pass.t0 < 220) { fa = a.pass.a; turn = 40 }
    else if (a.swipe && now - a.swipe.t0 < 260) { fa = a.swipe.a; turn = 50 }
    else if (p.act === 'jump' || p.act === 'land') fa = (b.st === 'shot' || b.st === 'loose') && !guarding ? toBall : man && guarding ? Math.atan2(man.y - env.y, man.x - env.x) : toBall
    else if (p.act === 'frozen' || p.act === 'down') fa = a.ang
    else if (M && M !== MOVES.spin.n) {
      // a move: square to the basket, the shoulders only partly into it (a crossover doesn't turn him sideways)
      const go = Math.atan2(p.bdy, p.bdx)
      fa = M === MOVES.back.n ? Math.atan2(-p.bdy, -p.bdx) : toRim + wrap(go - toRim) * 0.35
      turn = 70
    } else if (guarding) {
      // on his man: squared up to him. Chasing a man who's gone by: turned to run
      const dm = Math.hypot(man.x - env.x, man.y - env.y), toMan = Math.atan2(man.y - env.y, man.x - env.x)
      const going = a.sp > 4 ? Math.atan2(mvy, mvx) : toMan
      fa = dm > 9 && a.sp > 6 && Math.abs(wrap(going - toMan)) > 1.3 ? going : toMan
      turn = 110
    } else if (has && live && (p.post || p.pick || p.act === 'fake')) fa = Math.atan2(p.fy, p.fx)   // (the post: his back to his man; picked up: the way he pivots; a fake: square up)
    else if (has && live && (a.sp < 3 || Math.cos(Math.atan2(mvy, mvx) - toRim) < -0.2)) fa = toRim + clamp(wrap(Math.atan2(mvy, mvx) - toRim), -0.6, 0.6) * c01((a.sp - 3) / 4)   // (with the ball, backing out or side to side: still facing up the floor)
    else if (live && !has && b.st === 'pass' && b.to === i) fa = toBall
    else if (live && !has && a.sp < 2.2) fa = toBall
    else if (!live && a.sp < 1) fa = Math.atan2(p.fy, p.fx)
    a.ang += wrap(fa - a.ang) * (1 - Math.exp(-dt / turn))
    z.ang = a.ang
    const ca = Math.cos(a.ang), sa = Math.sin(a.ang)
    // the floor he's covering, in his own frame (forward, to his right): his feet go that way
    if (dist > 0.0005) { a.lx = (mvx * ca + mvy * sa) / dist; a.ly = (-mvx * sa + mvy * ca) / dist }
    const lx = a.lx, ly = a.ly

    // ── standing and running ──
    z.air = 0; z.scale = 1; z.lean = 0.04 * amp * Math.max(0, lx); z.down = 0; z.ox = 0; z.oy = 0; z.ball = false; z.two = false; z.bounce = false; z.thud = false; z.under = false; z.toeL = 0; z.toeR = 0
    // his stride (gait, below): squared up on his man it's the defensive slide, else a run
    const dm0 = guarding && p.act === 'free' ? Math.hypot(man.x - env.x, man.y - env.y) : 99
    const wide = c01((10 - dm0) / 4) * (1 - c01((a.sp - 8) / 3))
    gait(a, z, dt, now, wide, env)
    // the arms: at his sides, a small swing against his stride when he runs (each hand with the shoulder over it,
    // forward as the other side's foot goes forward), the hands coming up a little as they swing through
    const sw = a.gS * (lx >= -0.2 ? 1 : -0.5)
    set3(TL, 0.08 - 0.075 * sw, -0.45, 0.2 + 0.06 * Math.max(0, -sw)); set3(TR, 0.08 + 0.075 * sw, 0.45, 0.2 + 0.06 * Math.max(0, sw))

    // ── a man on defense: low, wide, both arms out and steady ──
    if (guarding && p.act === 'free') {
      const dm = Math.hypot(man.x - env.x, man.y - env.y), onBall = b.st === 'held' && b.holder === man.i
      // (the stance and the slide are in his stride: gait)
      mix3(TL, 0.05, -0.5, 0.3, wide); mix3(TR, 0.05, 0.5, 0.3, wide)
      z.lean = Math.max(z.lean, 0.03 * wide)
      // his man rising for a shot: a hand up at it (no jump: that's the button)
      if (P[man.i].act === 'gather') {
        const w = c01((8.5 - dm) / 3), toS = wrap(Math.atan2(man.y - env.y, man.x - env.x) - a.ang), sd = Math.sin(toS) >= 0 ? 1 : -1
        mix3(sd > 0 ? TR : TL, 0.22, sd * 0.2, 1, w)
      }
      if (onBall && dm < 8) {
        // the hand on the ball's side a little out in front of it, low (where a swipe comes from)
        // (which side that is, held until it's clearly the other: no flicking across when he's square to him)
        const cf = Math.cos(a.ang - A[man.i].ang); if (Math.abs(cf) > 0.3 || !a.bsd) a.bsd = cf < 0 ? -1 : 1
        const ballSide = (P[man.i].hand || 1) * a.bsd
        const w = c01((8 - dm) / 2)
        mix3(ballSide > 0 ? TR : TL, 0.15, ballSide > 0 ? 0.47 : -0.47, 0.34, w)
        // the hands working, a little (a quick small in-and-out, never a wave)
        const hw = 0.03 * w * Math.sin(now / 115)
        TL[0] += hw; TR[0] -= hw
      }
    }
    // the box-out: wide and low, his arms out to feel for the man behind him, sat back into him
    if (boxOn) {
      const w = c01((4.6 - boxOn.d) / 1.2)
      z.lf[1] -= 0.1 * w; z.rf[1] += 0.1 * w; z.lf[0] *= 1 - 0.6 * w; z.rf[0] *= 1 - 0.6 * w
      z.toeL = -0.2 * w; z.toeR = 0.2 * w; z.lean = -0.04 * w; z.scale = 1 - 0.03 * w
      mix3(TL, 0.04, -0.46, 0.42, w); mix3(TR, 0.04, 0.46, 0.42, w)
    }
    // off the ball, on offense: hands ready for a pass on its way; one arm up, held, when he calls for it
    if (live && !has && p.team === s.poss && p.act === 'free') {
      if (b.st === 'pass' && b.to === i) { set3(TL, 0.17, -0.08, 0.45); set3(TR, 0.17, 0.08, 0.45) }
      else if (s.call && s.call.pid === i && s.tick - s.call.tick < 40) set3(TR, 0.1, 0.42, 1)
    }
    // the check coming to him: both hands out for it
    if (b.st === 'check' && b.to === i) { set3(TL, 0.17, -0.08, 0.45); set3(TR, 0.17, 0.08, 0.45) }

    // ── the ball in his hands ──
    if (has && p.act !== 'gather') {
      z.ball = true
      if (live && (p.pick || p.act === 'fake')) {
        // picked up: the ball held in both hands at his chest, no dribble; a pump fake shows it up over his head and
        // brings it back down
        const f = p.act === 'fake' ? c01((p.actT + env.a) / Math.max(1, p.actN)) : 0, up = Math.sin(Math.PI * f)
        set3(TL, 0.3, -0.12, 0.45 + 0.45 * up); set3(TR, 0.3, 0.12, 0.45 + 0.45 * up); set3(z.bl, 0.33, 0, 3.6 + 3.2 * up)
        z.scale = 1 + 0.03 * up; z.two = true; z.lf[1] = -0.18; z.rf[1] = 0.18
        a.side = p.hand || 1
      } else if (!live) {
        // between plays: in triple threat, the ball on his strong hip in both hands, knees bent, the foot on that side
        // back (his pivot foot forward); while he's walking it up, at his belt
        const hd = p.hand || 1, tt = c01(1 - (a.sp - 1) / 3)
        set3(TL, 0.3, -0.12, 0.4); set3(TR, 0.3, 0.12, 0.4); set3(z.bl, 0.33, 0, 3.2)
        mix3(hd > 0 ? TR : TL, 0.13, hd * 0.42, 0.36, tt); mix3(hd > 0 ? TL : TR, 0.2, hd * 0.26, 0.38, tt)
        z.bl[0] += (0.16 - z.bl[0]) * tt; z.bl[1] += (hd * 0.36 - z.bl[1]) * tt; z.bl[2] += (3.0 - z.bl[2]) * tt
        if (tt > 0.5) { const back = hd > 0 ? z.rf : z.lf, fr = hd > 0 ? z.lf : z.rf; back[0] = -0.08; fr[0] = 0.12; z.lf[1] = -0.19; z.rf[1] = 0.19; z.scale = 0.97 }
        z.two = true
        a.side = hd
      } else {
        dribble(s, p, a, z, now, env, amp)
        // the post: down low and wide, his back in his man
        if (p.post && p.burst <= 0) { z.scale = Math.min(z.scale, 0.95); z.lf[1] -= 0.06; z.rf[1] += 0.06; z.lean = -0.05 }
      }
    } else { a.inMv = 0; a.side = p.hand || 1 }

    // ── a pass just thrown: both hands through it ──
    if (a.pass) {
      const t = now - a.pass.t0
      if (t < 220) { const w = t < 70 ? t / 70 : 1 - (t - 70) / 150; mix3(TL, 0.56, -0.12, 0.5, w); mix3(TR, 0.56, 0.12, 0.5, w); fast = true } else a.pass = null
    }
    // ── a swipe at the ball: one arm shot out at it, and back ──
    if (a.swipe) {
      const t = now - a.swipe.t0, dur = a.swipe.miss ? 380 : 260
      if (t < dur) {
        const w = t < 90 ? out3(t / 90) : 1 - ease((t - 90) / (dur - 90))
        const la = wrap(a.swipe.a - a.ang), sd = Math.sin(la) >= 0 ? 1 : -1
        mix3(sd > 0 ? TR : TL, 0.06 + Math.cos(la) * 0.2, sd * 0.38 + Math.sin(la) * 0.16, 0.4, w)
        z.lean = Math.max(z.lean, 0.08 * w)
        fast = true
      } else a.swipe = null
    }

    // ── going up ──
    if (p.act === 'gather' && p.shot) { gather(p, a, z, now, env, dRim, toRim); fast = true }
    else if (a.gT0 >= 0) a.gT0 = -1
    if (a.rel) { if (follow(s, p, a, z, now, env, toRim, dRim)) fast = true }

    // ── a jump: a contest or a block (both hands up at the shot), a board (both up for it) ──
    if (p.act === 'jump') {
      const t = c01((p.actT + env.a) / gticks(T.jumpTime)), up = Math.sin(Math.PI * t)
      z.air = 0.9 * up; a.gAir = z.air
      const board = (b.st === 'shot' || b.st === 'loose') && !guarding
      // (straight up, a touch forward: from above an arm reaching up is short, the hand over the shoulder)
      if (board || p.team === s.poss) { set3(TL, 0.13, -0.24, 1); set3(TR, 0.13, 0.24, 1) }
      else { set3(TR, 0.2, 0.17, 1); set3(TL, 0.1, -0.42, 0.4) }
      z.lf[0] = -0.08; z.rf[0] = -0.1; z.lf[1] = -0.13; z.rf[1] = 0.13
      a.land = now; fast = true
    } else if (p.act === 'land' || (a.land && now - a.land < 150)) {
      // the knees take the landing
      z.scale = 0.96; z.lf[1] = -0.22; z.rf[1] = 0.22; set3(TL, 0.18, -0.5, 0.3); set3(TR, 0.18, 0.5, 0.3)
      if (p.act !== 'land' && now - a.land >= 150) a.land = 0
    }
    // the block: the arm on the shooter's side goes through the ball at him and comes back (in the air or not)
    if (a.swat) {
      const t = now - a.swat.t0
      if (t < 320) {
        const w = t < 70 ? out3(t / 70) : 1 - ease((t - 70) / 250)
        const la = wrap(a.swat.a - a.ang), sd = Math.sin(la) >= 0 ? 1 : -1
        mix3(sd > 0 ? TR : TL, 0.18 + Math.cos(la) * 0.22, sd * 0.2 + Math.sin(la) * 0.18, 1.05, w)
        fast = true
      } else a.swat = null
    }

    // ── beaten by a move: caught leaning, on his heels; or sat down ──
    if (p.act === 'frozen' && !(a.swipe && a.swipe.miss)) {
      const t = (p.actT + env.a) * STEP, w = c01(1 - t / 420)
      z.ang = a.ang + a.wob * 0.32 * Math.sin(Math.min(1, t / 160) * Math.PI * 0.5) * (0.4 + 0.6 * w)
      z.lean = -0.06
      set3(TL, 0.06, -0.53, 0.28); set3(TR, 0.06, 0.53, 0.28)
      z.lf[0] = 0.1 * a.wob; z.lf[1] = -0.17; z.rf[0] = -0.1 * a.wob; z.rf[1] = 0.17
      // off balance: his weight goes the wrong way and a foot has to come across to catch it (a stagger, not a fall)
      const st = Math.sin(Math.PI * c01((t - 60) / 380))
      if (a.wob > 0) { z.rf[1] -= 0.16 * st; z.rf[0] += 0.08 * st } else { z.lf[1] += 0.16 * st; z.lf[0] += 0.08 * st }
      z.oy = -Math.cos(a.ang) * a.wob * 0.35 * st; z.ox = Math.sin(a.ang) * a.wob * 0.35 * st
    } else if (p.act === 'down') floor(z, c01((p.actT + env.a) * STEP / 170), c01((p.actN - p.actT - env.a) * STEP / 220))
    // ── dunked on ──
    if (a.hit) {
      const t = now - a.hit.t0
      if (t > 900 || s.phase === 'live') a.hit = null
      else {
        const go = out3(t / 240) * (1 - ease((t - 520) / 380))
        z.ox = a.hit.ux * 1.7 * go; z.oy = a.hit.uy * 1.7 * go
        z.ang = Math.atan2(-a.hit.uy, -a.hit.ux)
        floor(z, c01(t / 150), c01((900 - t) / 300))
      }
    }
    // ── after a big bucket, once he's down: a fist pump (a dunk, a poster) or a finger up (a three) ──
    if (a.cele) {
      const t = now - a.cele.t0
      if (t > 900 || has || p.act === 'gather') { if (t > 900 || has) a.cele = null }
      else if (t >= 0) {
        const w = c01(t / 120) * (1 - ease((t - 700) / 200)), bh = (p.hand || 1) > 0 ? TR : TL, sd = (p.hand || 1) > 0 ? 1 : -1
        if (a.cele.pump) { const pump = Math.abs(Math.sin(t / 900 * Math.PI * 2.5)); mix3(bh, 0.08 + 0.26 * pump, sd * 0.34, 0.95 - 0.45 * pump, w) }
        else mix3(bh, 0.3, sd * 0.24, 1.05, w)
      }
    }
    // ── a miss the other side came down with: his head drops a moment, a hand to it ──
    if (a.sad) {
      const t = now - a.sad
      if (t > 1000) a.sad = 0
      else if (!has && p.act === 'free' && a.sp < 6) {
        const w = c01(t / 150) * (1 - ease((t - 750) / 250))
        z.lean += 0.05 * w
        mix3((p.hand || 1) > 0 ? TR : TL, 0.06, ((p.hand || 1) > 0 ? 1 : -1) * 0.12, 1, w * 0.9)
      }
    }
    // ── the final: the winners' arms go up ──
    if (s.phase === 'over' && a.cheer) {
      const hop = Math.abs(Math.sin(now / 190))
      set3(TL, 0.08, -0.44, 1); set3(TR, 0.08, 0.44, 1); z.air = 0.2 * hop
    }

    // ── after a dunk: from the spot in front of the rim he came down on back to where the game has him, eased ──
    if (a.dT !== now && a.dT > 0 && now - a.dT < 360) { const k = 1 - ease((now - a.dT) / 360); z.ox += a.dox * k; z.oy += a.doy * k }
    // ── coming down: the knees take it (a dip, then back up), the feet a touch wider ──
    if (a.pAir > 0.2 && z.air < 0.05) a.landT = now
    a.pAir = z.air
    const lt = now - a.landT
    if (lt >= 0 && lt < 260 && z.air < 0.05 && !z.down) {
      const k = Math.sin(Math.PI * Math.pow(lt / 260, 0.7))
      z.scale = Math.min(z.scale, 1 - 0.045 * k); z.lf[1] -= 0.035 * k; z.rf[1] += 0.035 * k
    }
    // a foot the pose put somewhere else than his stride (a shot, a move, a stance): flat on the floor, or tucked up
    // under him in the air
    const offL = Math.abs(z.lf[0] - a.GL[0]) + Math.abs(z.lf[1] - a.GL[1]) > 0.015, offR = Math.abs(z.rf[0] - a.GR[0]) + Math.abs(z.rf[1] - a.GR[1]) > 0.015
    const tuck = c01(z.air / 0.4) * 0.5
    z.lf[2] = offL || z.air > 0.05 ? tuck : a.gL; z.rf[2] = offR || z.air > 0.05 ? tuck : a.gRr
    if ((offL && offR) || z.air > 0.05 || z.down) { z.tw = 0; z.hip = 0 }

    // ── ease what is drawn to the pose (the ball hand while dribbling stays with the ball) ──
    // The feet ease in the floor's directions, not his: when he turns, a planted foot stays where it is on the floor
    // and catches up a step later (no feet swinging round with his shoulders)
    const ca2 = Math.cos(z.ang), sa2 = Math.sin(z.ang)
    const toW = (f, o) => { o[0] = f[0] * ca2 - f[1] * sa2; o[1] = f[0] * sa2 + f[1] * ca2; o[2] = f[2]; return o }
    if (!a.lh) { a.lh = [...TL]; a.rh = [...TR]; a.lfW = toW(z.lf, [0, 0, 0]); a.rfW = toW(z.rf, [0, 0, 0]); a.tw = 0; a.hip = 0 }
    const kh = 1 - Math.exp(-dt / (fast ? EASE_FAST : EASE_HAND)), kb = 1 - Math.exp(-dt / EASE_FAST), kf = 1 - Math.exp(-dt / EASE_FOOT)
    const ballHand = z.ball && z.bounce ? (a.side >= 0 ? 1 : -1) : 0
    for (let j = 0; j < 3; j++) {
      a.lh[j] += (TL[j] - a.lh[j]) * (ballHand < 0 ? kb : kh)
      a.rh[j] += (TR[j] - a.rh[j]) * (ballHand > 0 ? kb : kh)
    }
    // (and no faster than a quick real step: a pose that puts a foot somewhere new sends it there in a step, it
    // doesn't jump)
    const vmax = FOOT_V * dt / 1000
    const stepTo = (W) => {
      let ex = (FW[0] - W[0]) * kf, ey = (FW[1] - W[1]) * kf
      const l = Math.hypot(ex, ey); if (l > vmax) { ex *= vmax / l; ey *= vmax / l }
      W[0] += ex; W[1] += ey; W[2] += (FW[2] - W[2]) * kf
    }
    toW(z.lf, FW); stepTo(a.lfW)
    toW(z.rf, FW); stepTo(a.rfW)
    a.tw += (z.tw - a.tw) * kf; a.hip += (z.hip - a.hip) * kf
    set3(z.lh, a.lh[0], a.lh[1], a.lh[2]); set3(z.rh, a.rh[0], a.rh[1], a.rh[2]); z.lh[3] = TL[3] || Math.hypot(a.lh[0], a.lh[1]) > 0.6 ? 1 : 0; z.rh[3] = TR[3] || Math.hypot(a.rh[0], a.rh[1]) > 0.6 ? 1 : 0   // (a hand still coming back from the rim keeps its reach)
    z.lf[0] = a.lfW[0] * ca2 + a.lfW[1] * sa2; z.lf[1] = -a.lfW[0] * sa2 + a.lfW[1] * ca2; z.lf[2] = a.lfW[2]
    z.rf[0] = a.rfW[0] * ca2 + a.rfW[1] * sa2; z.rf[1] = -a.rfW[0] * sa2 + a.rfW[1] * ca2; z.rf[2] = a.rfW[2]
    z.tw = a.tw; z.hip = a.hip
    return z
  }

  // His stride, worked out the way a real one goes: a cadence (steps a second) and a stride length by how fast he's
  // going, each foot flat on the floor and pushing back under him for part of the cycle (the stance: longer walking,
  // short at a sprint) and swinging through in the air for the rest, eased. The stride is as long as the floor he
  // covers while a foot is down, so a planted foot stays planted, but never long: from overhead a runner's legs are
  // mostly under his shorts and chest, and only his feet show, out in front and behind (the owner, 11-26: the legs
  // looked silly and exaggerated). Every number eases with his speed, so standing, a jog, a sprint and a stop blend
  // with no pops. His hips turn with his legs and his shoulders a little against them; his body rises and falls with
  // each step. Squared up on a man (wide: 0-1) it's the defensive slide: a wide stance, short quick steps, the feet
  // never crossing; backing up, short quick steps back
  function gait(a, z, dt, now, wide, env) {
    const v = a.sp, uFt = (env.sFt || 3.6) * BODY
    // his way across the floor in his own frame, smoothed (a frame's wobble doesn't turn his feet)
    const km = 1 - Math.exp(-dt / 70)
    a.mdx += (a.lx - a.mdx) * km; a.mdy += (a.ly - a.mdy) * km
    // (not renormalized: turning back the way he came it shrinks through nothing instead of flipping his feet over)
    const ml = Math.hypot(a.mdx, a.mdy), dx = ml > 1 ? a.mdx / ml : a.mdx, dy = ml > 1 ? a.mdy / ml : a.mdy
    // speeding up and slowing down (ft/s²), smoothed
    if (dt > 0) a.acc += ((v - a.spP) / dt * 1000 - a.acc) * (1 - Math.exp(-dt / 120))
    a.spP = v
    const moving = c01((v - 0.5) / 1.5), runK = c01((v - 3) / 6)
    const back = c01((-dx - 0.35) / 0.4), lat = Math.abs(dy)
    // the stance's share of a stride, the strides a second (a slide and a backpedal are quicker and shorter)
    const D = 0.6 - 0.3 * c01((v - 2) / 8) + 0.12 * wide
    const cad = (1.0 + 0.075 * Math.min(v, 12)) * (1 + 0.18 * wide + 0.12 * back)
    let R = (v / uFt) * D / (2 * cad) * 0.95
    R = Math.min(0.19 - 0.05 * back - 0.06 * wide, R) * moving
    // the feet under his hips: closer in at a run (a runner's feet land near his middle line), wide in a stance, a touch
    // wider going sideways
    const W = (0.13 - 0.05 * runK) * (1 - wide) + 0.24 * wide + 0.05 * lat * (1 - wide)
    // (going sideways the feet step out and close, never across)
    if (lat > 0.01) R = Math.min(R, 0.75 * W / lat)
    a.gR += (R - a.gR) * (1 - Math.exp(-dt / (R > a.gR ? 90 : 130)))
    // the cycle runs on while there's a stride left to finish (a stop finishes its step rather than freezing mid-air)
    a.cad = cad
    if (moving > 0.02 || a.gR > 0.008) a.gp += Math.max(cad, 1.5) * dt / 1000
    const u = a.gp - Math.floor(a.gp)
    const cyc = (q, o) => {
      q = q - Math.floor(q)
      if (q < D) { o[0] = 1 - 2 * q / D; o[1] = 0 } else { const w = (q - D) / (1 - D); o[0] = -1 + 2 * ease(w); o[1] = Math.sin(Math.PI * w) }
      return o
    }
    cyc(u, CL); cyc(u + 0.5, CR)
    const Rd = a.gR, lift = c01(Rd / 0.07) * (1 - 0.6 * wide)
    const x0 = -0.015 * (1 - moving) * (1 - wide) + 0.01 * wide + 0.035 * runK * (1 - back)
    z.lf[0] = x0 + dx * Rd * CL[0]; z.lf[1] = -W + dy * Rd * CL[0]
    z.rf[0] = x0 + dx * Rd * CR[0]; z.rf[1] = W + dy * Rd * CR[0]
    a.gL = CL[1] * lift; a.gRr = CR[1] * lift
    a.GL[0] = z.lf[0]; a.GL[1] = z.lf[1]; a.GR[0] = z.rf[0]; a.GR[1] = z.rf[1]
    // the toes: the way he's going when he runs forward; square and turned out a little in a stance or backing up
    const fwd = c01((dx + 0.2) / 0.6) * (1 - wide)
    const toe = Math.atan2(dy, Math.max(0.05, dx)) * 0.55 * fwd * moving
    z.toeL = toe - 0.12 - 0.22 * wide; z.toeR = toe + 0.12 + 0.22 * wide
    // the hips and shoulders: the hips turn with the forward foot, the shoulders a little against them (a slide and a
    // backpedal keep him square)
    const st = (CL[0] - CR[0]) * 0.5 * c01(Rd / 0.12) * (1 - wide) * (1 - back) * fwd
    a.gS = st
    z.hip = 0.09 * st; z.tw = -0.11 * st
    // the bounce of his stride (from overhead: a touch bigger at the top of each step, nearer the camera)
    z.scale *= 1 + 0.012 * runK * Math.cos(4 * Math.PI * u + 0.6)
    // leaning into it as he gets going, back as he puts the brakes on
    z.lean += 0.022 * clamp(a.acc / 25, -1, 1) * (1 - wide)
    // a first step from standing: a dip into it and the weight forward
    if (v > 2.5 && a.goArm) { a.goT = now; a.goArm = false }
    if (v < 1) a.goArm = true
    const gt = now - a.goT
    if (gt >= 0 && gt < 240) { const k = Math.sin(Math.PI * gt / 240); z.lean += 0.03 * k * (1 - wide); z.scale *= 1 - 0.018 * k }
    // a hard stop (pose: z.cut, from a run to half that): the front foot plants out ahead, the weight back over it,
    // knees down, and a settle
    const stT = now - a.stopT
    if (stT >= 0 && stT < 340 && v < 6) {
      const k = stT < 70 ? out3(stT / 70) : 1 - ease((stT - 70) / 270)
      const fl = a.stopF < 0 ? z.lf : z.rf, bk = a.stopF < 0 ? z.rf : z.lf
      fl[0] += (a.stopX * 0.15 - fl[0]) * k; fl[1] += (a.stopY * 0.15 + (a.stopF < 0 ? -0.15 : 0.15) - fl[1]) * k
      bk[0] += (-a.stopX * 0.05 - bk[0]) * k; bk[1] += ((a.stopF < 0 ? 0.15 : -0.15) - bk[1]) * k
      a.GL[0] = z.lf[0]; a.GL[1] = z.lf[1]; a.GR[0] = z.rf[0]; a.GR[1] = z.rf[1]
      a.gL *= 1 - k; a.gRr *= 1 - k
      z.lean -= 0.05 * k; z.scale *= 1 - 0.03 * k
    }
  }

  // on the floor: legs out in front of him, his hands back behind him (w: how far down, up: how far back up)
  function floor(z, w, up) {
    const k = Math.min(w, up)
    z.down = k > 0.5 ? 1 : 0; z.lean = -0.1 * k; z.scale = 1 - 0.03 * k
    z.lf[0] += (0.5 - z.lf[0]) * k; z.lf[1] = -0.16; z.rf[0] += (0.44 - z.rf[0]) * k; z.rf[1] = 0.16
    mix3(TL, -0.3, -0.48, 0, k); mix3(TR, -0.32, 0.48, 0, k)
  }

  // the dribble in the hand the game says (player.hand), and each move by its own shape
  function dribble(s, p, a, z, now, env, amp) {
    const M = p.burst > 0 ? p.mv : 0, key = MOVE_KEYS[M], mv = MOVES[key]
    const hand = p.hand || 1
    if (M && a.inMv !== M) { a.mvT0 = now; a.from = a.side >= 0 ? 1 : -1; if (a.sp > 3 && now - a.cutAt > 200) { z.cut = true; a.cutAt = now } }   // (a move's first step bites the floor)
    a.inMv = M
    const f = M ? c01(1 - (p.burst - env.a) / Math.max(1, p.bn)) : 0
    // where the ball is across him: -1 his left hand, 1 his right; a move that changes hands takes it across
    if (M && mv?.swap) a.side = a.from + (hand - a.from) * ease(c01(f / 0.62))
    else a.side += (hand - a.side) * (1 - Math.exp(-env.dt / 90))
    const side = a.side, mid = 1 - Math.min(1, Math.abs(side)), sg = side >= 0 ? 1 : -1
    z.bside = sg
    // the bounce (a move works the ball low and quick)
    const lock = M ? 0 : c01((a.sp - 3) / 3)
    const per = (DRIB + (DRIB_RUN - DRIB) * amp) * (M ? 0.7 : 1) * (1 - lock) + lock * 1000 / (a.cad || 1.5)
    const was = Math.floor(a.drib)
    a.drib += env.dt / per
    // on the move the bounce keeps time with his feet: one bounce a stride, the ball meeting the floor as the foot on
    // its side comes down (pulled into step gently, never a jump)
    if (lock > 0) {
      let d = (a.gp + (side >= 0 ? 0.5 : 0)) - a.drib
      d -= Math.round(d)
      a.drib += d * lock * Math.min(1, env.dt / 160)
    }
    const ph = a.drib % 1, up = Math.sin(Math.PI * ph)                            // 0 on the floor, 1 in his hand
    z.bounce = true; z.thud = Math.floor(a.drib) !== was
    // (at a run the ball is pushed out ahead of him and bounces a touch lower)
    let bx = 0.21 + 0.07 * amp * (M ? 0 : 1), by = side * 0.46, bz = 0.35 + (2.0 - 0.35 * amp) * up, hz = 0.26 + 0.1 * up
    if (key === 'cross') {
      // low and hard across in front of him, his shoulders dipping into it
      bx = 0.36 + 0.14 * mid; bz = 0.3 + 1.6 * up * (1 - 0.7 * mid); z.lean = 0.06
    } else if (key === 'btl') {
      // through his legs: under him at the middle of it (the ball under his body), a wide step
      bx = 0.34 - 0.32 * mid; bz = 0.3 + 1.2 * up * (1 - mid); z.under = mid > 0.45
      z.lf[0] = 0.18; z.rf[0] = -0.12; z.lf[1] = -0.22; z.rf[1] = 0.22; z.lean = 0.04
    } else if (key === 'btb') {
      // round behind his back, out of the reach of the man in front
      bx = 0.34 - 0.74 * Math.sin(Math.PI * c01(f / 0.62)); bz = 0.5 + 1.2 * up * (1 - mid)
    } else if (key === 'inout') {
      // the fake: the ball goes in toward his middle as if it's coming across, and back out to the same hand
      const k = Math.sin(Math.PI * c01(f / 0.7))
      by = hand * (0.5 - 0.34 * k); bx = 0.38 + 0.06 * k; bz = 0.3 + 1.4 * up
      z.ang += -hand * 0.18 * k
    } else if (key === 'hesi') {
      // up on his toes, the ball pulled up as if he's stopping; then low and gone
      const st = c01(f / 0.35), go = c01((f - 0.35) / 0.25)
      bz = 0.35 + 2.6 * Math.sin(Math.PI * 0.5 * st) * (1 - go) + 1.0 * go * up; hz = 0.26 + 0.24 * (1 - go) * st
      z.scale = 1 + 0.04 * Math.sin(Math.PI * st) * (1 - go); z.lean = -0.04 * (1 - go) + 0.08 * go
    } else if (key === 'back') {
      // a hop back off both feet, the ball pulled in to his hip ready to go up
      const hop = Math.sin(Math.PI * f)
      z.air = 0.18 * hop; z.lean = -0.04
      z.lf[0] = 0.16 * (1 - f); z.rf[0] = 0.2 * (1 - f); z.lf[1] = -0.18; z.rf[1] = 0.18
      bx = 0.2; by = hand * 0.42; bz = 2.4; hz = 0.4
    } else if (key === 'spin') {
      // all the way round off his man, the ball kept tight on his hip
      z.ang = a.ang + Math.sign(p.bs || 1) * TAU * ease(f)
      bx = 0.16; by = side * 0.42; bz = 1.8; hz = 0.34
      z.lf[0] = 0.16; z.rf[0] = -0.12
    }
    set3(z.bl, bx, by, bz)
    // the hand on the ball (it meets it at the top of the bounce), the other arm out a little between it and his man
    const bh = sg > 0 ? TR : TL, oh = sg > 0 ? TL : TR
    set3(bh, bx - 0.03, sg * Math.max(0.3, Math.abs(by) * 0.96), hz)
    if (key === 'btb' && mid > 0.25) set3(bh, -0.12, sg * 0.42, 0.2)                       // reaching round behind him
    else if (key === 'btl' && mid > 0.25) set3(bh, 0.12, sg * 0.3, 0.12)                    // down through his legs
    if ((key === 'cross' || key === 'btl' || key === 'btb') && mid > 0.3) set3(oh, bx - 0.02, -sg * 0.34, 0.24)   // the other hand takes it
    else set3(oh, 0.07, -sg * 0.47, 0.28)
  }

  // rising for a shot: by its kind. g: 0 as he starts, 1 where the green is
  function gather(p, a, z, now, env, dRim, toRim) {
    const sh = p.shot, kind = shape(sh.kind)
    if (a.gT0 < 0 || a.gKind !== kind) { a.dU = null; a.gT0 = now; a.gKind = kind; a.gSide = kind === 'jumper' ? 1 : a.side >= 0 ? 1 : -1; a.rel = null }
    const ideal = sh.spec?.ideal || (kind === 'jumper' ? T.jIdealMs : T.lIdealMs)
    const g = Math.max(0, env.held) / ideal, sd = a.gSide
    if (kind === 'jumper' && (sh.run ?? 0) > 0.45 && now - a.gT0 < 40 && now - a.cutAt > 200) { z.cut = true; a.cutAt = now }   // (a pull-up off the run: the plant)
    z.ball = true; z.two = true
    if (kind === 'jumper') {
      // the dip, then up: the ball over his forehead, his guide hand beside it, off the floor as it peaks
      const r = ease((g - 0.22) / 0.78)
      z.scale = 1 - 0.04 * Math.sin(Math.PI * c01(g / 0.4))
      z.air = 0.7 * ease((g - 0.4) / 0.6) + 0.1 * c01(g - 1)
      set3(z.bl, 0.28 - 0.07 * r, 0.06, 3 + 5.3 * r)
      set3(TR, 0.26 - 0.06 * r, 0.12 - 0.05 * r, 0.35 + 0.65 * r); set3(TL, 0.28 - 0.06 * r, -0.08 + 0.03 * r, 0.35 + 0.6 * r)
      z.lf[0] = 0.04; z.rf[0] = 0.08; z.lf[1] = -0.15; z.rf[1] = 0.15
      // pulling up on the move: a hard plant (a hop into a wide stance, his weight back to stop himself), then the
      // body carries on a little the way he was going while he's up (the drift); the quicker he was going, the more
      const run = sh.run ?? 0
      if (run > 0.3) {
        const k = c01((run - 0.3) / 0.6), plant = c01(g / 0.32)
        const fx = Math.cos(a.ang), fy = Math.sin(a.ang), mx = sh.mx ?? 0, my = sh.my ?? 0
        const fwd = mx * fx + my * fy, lat = -mx * fy + my * fx                  // the way he was going, in his own frame
        z.lf[0] += 0.2 * k * fwd * (1 - 0.6 * plant); z.rf[0] += 0.1 * k * fwd * (1 - 0.6 * plant)
        z.lf[1] -= 0.08 * k * (1 - plant * 0.5); z.rf[1] += 0.08 * k * (1 - plant * 0.5)
        z.lf[1] += 0.12 * k * lat * (1 - plant); z.rf[1] += 0.12 * k * lat * (1 - plant)
        z.lean = -0.07 * k * Math.sin(Math.PI * plant) * (fwd > 0 ? 1 : -0.5)
        z.scale *= 1 - 0.03 * k * Math.sin(Math.PI * plant)
        const drift = 0.75 * k * ease((g - 0.35) / 0.75)
        z.ox = mx * drift; z.oy = my * drift
        a.gOx = z.ox; a.gOy = z.oy
      } else { a.gOx = 0; a.gOy = 0 }
    } else if (kind === 'layup') {
      // two steps with it tucked, then up off one foot, the ball out in front on one hand
      const r = ease((g - 0.4) / 0.6)
      z.air = 0.9 * r
      const hx = 0.26 + 0.16 * r, hy = sd * (0.3 - 0.2 * r)
      set3(z.bl, hx + 0.05, hy, 3.2 + 5.2 * r)
      const bh = sd > 0 ? TR : TL, oh = sd > 0 ? TL : TR
      set3(bh, hx, hy, 0.4 + 0.6 * r); set3(oh, 0.2 - 0.1 * r, -sd * (0.3 + 0.2 * r), 0.36)
      z.lf[0] = sd > 0 ? 0.1 - 0.28 * r : 0.22 * (1 - r); z.rf[0] = sd > 0 ? 0.22 * (1 - r) : 0.1 - 0.28 * r
      z.lean = 0.06
      // the two steps of the gather before he goes up: the foot on the ball's side, then the other one he jumps off.
      // Coming across the lane on the move, the second step goes back the other way round his man (a euro step)
      const st = c01(g / 0.42)
      if (st < 1) {
        const s1 = ease(c01(st / 0.5)), s2 = ease(c01((st - 0.5) / 0.5)), f1 = sd > 0 ? z.rf : z.lf, f2 = sd > 0 ? z.lf : z.rf
        f1[0] = -0.1 + 0.36 * s1 - 0.3 * s2; f2[0] = 0.18 - 0.3 * s1 + 0.42 * s2
        z.lean = 0.06 + 0.03 * Math.sin(Math.PI * st)
      }
      const run = sh.run ?? 0, mx = sh.mx ?? 0, my = sh.my ?? 0
      const lat = -mx * Math.sin(a.ang) + my * Math.cos(a.ang)              // across him: + to his right
      if (run > 0.4 && Math.abs(lat) > 0.45) {
        const k = c01((Math.abs(lat) - 0.45) / 0.3) * c01((run - 0.4) / 0.3), sg = Math.sign(lat)
        const off = sg * k * (0.9 * Math.sin(Math.PI * c01(st / 0.55)) - 0.6 * Math.sin(Math.PI * c01((st - 0.45) / 0.55))) * (1 - ease((g - 0.42) / 0.3))
        z.ox = -Math.sin(a.ang) * off; z.oy = Math.cos(a.ang) * off
        const f = off > 0 ? z.rf : z.lf; f[1] += Math.sign(off) * 0.1 * Math.min(1, Math.abs(off) / 0.6)
      }
    } else {
      // THE DUNK. The gather: down into his legs with the ball in both hands. The takeoff: up hard, the ball cocked
      // back behind his head on one arm, his legs trailing
      const r = ease((g - 0.3) / 0.7)   // (a steady rise, not a snap: the same take-off and top as the game's)
      z.scale = 1 - 0.07 * Math.sin(Math.PI * c01(g / 0.5)) * (1 - r)
      z.air = 0.75 * r
      const bh = sd > 0 ? TR : TL, oh = sd > 0 ? TL : TR
      const hx = 0.2 - 0.24 * r, hy = sd * (0.3 - 0.12 * r)
      set3(z.bl, hx - 0.03 * r, hy, 2.6 + 8 * r)
      set3(bh, hx + 0.04, hy, 0.38 + 0.62 * r); set3(oh, 0.14 - 0.04 * r, -sd * (0.3 + 0.08 * r), 0.38)
      z.lf[0] = 0.18 * (1 - r) - 0.22 * r; z.rf[0] = -0.04 * (1 - r) - 0.28 * r; z.lf[1] = -0.14; z.rf[1] = 0.14
      z.lean = 0.05 + 0.05 * r
      glide(z, env, a, 0.55 * r * r)
    }
    a.gAir = z.air
  }

  // A dunk from overhead (the owner, 11-26: "it should look like a real dunk"): he rises toward the rim from in front of
  // it and his body stays there, on the court side, about a foot and a half short of the rim's middle (never over it or
  // into the board), a touch up the screen for his height; only his arm and the ball go up over the rim (rimHand). The
  // way in front is the way he came from (a.dU, kept from the gather), never round behind the rim
  const FRONT = 1.5
  function glide(z, env, a, w) {
    if (w <= 0) return
    if (!a.dU) { let ux = env.x - RIM.x, uy = env.y - RIM.y; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l; if (uy < 0.45) { uy = 0.45; const m = Math.hypot(ux, uy); ux /= m; uy /= m } a.dU = [ux, uy] }
    const cx = RIM.x + a.dU[0] * FRONT, cy = RIM.y + a.dU[1] * FRONT
    z.ox = (cx - env.x) * w; z.oy = (cy - env.y) * w
    a.dox = z.ox; a.doy = z.oy; a.dT = a.nowT
  }
  // A hand up on the rim as drawn (the rim is drawn HOOP_LIFT up the screen: court.js), in the pose's own terms for that
  // hand (figure.js draws a raised hand foreshortened and brought in across him: undone here), with its long-reach mark
  // (h[3]: figure.js lets that one arm reach). back: ft short of the rim's middle toward him; side: ft along the rim
  function rimHand(h, z, env, back = 0, side = 0) {
    const air = z.air, uFt = env.sFt * BODY * (z.scale || 1) * (1 + 0.16 * air)
    const bx = env.x + z.ox, by = env.y + z.oy - air * env.sFt * 0.2, rx = RIM.x, ry = RIM.y - HOOP_LIFT
    const l = Math.hypot(rx - bx, ry - by) || 1, nx = (rx - bx) / l, ny = (ry - by) / l
    const vx = rx - nx * back - ny * side - bx, vy = ry - ny * back + nx * side - by
    const ca = Math.cos(z.ang), sa = Math.sin(z.ang)
    const lx = (vx * ca + vy * sa) / uFt, ly = (-vx * sa + vy * ca) / uFt
    const SHn = 0.255, m = Math.abs(ly)
    h[0] = lx / 0.42; h[1] = Math.sign(ly) * (m <= SHn ? m * 0.33 / SHn : 0.33 + (m - SHn) / (0.62 * 0.42)); h[2] = 1; h[3] = 1
    return h
  }

  // the ball gone: the follow-through, the dunk's throw-down, hang and landing. True while it's a quick motion
  function follow(s, p, a, z, now, env, toRim, dRim) {
    const R = a.rel, t = now - R.t0, sd = R.side
    const bh = sd > 0 ? TR : TL, oh = sd > 0 ? TL : TR
    if (R.kind === 'dunk' && !R.blocked) {
      const fly = gticks(0.16) * STEP                                       // the throw-down: as long as the game has the ball in the air
      const slam = R.slam, miss = !slam && R.out
      if (!slam && !miss && t > fly + 260) { a.rel = null; return false }
      const since = slam ? now - slam : miss ? now - R.out : -1
      let up = 1
      if (slam) up = since < DUNK.hang ? 1 : 1 - ease((since - DUNK.hang) / DUNK.drop)
      else if (miss) up = 1 - ease(since / (DUNK.drop + 40))
      const total = slam ? DUNK.hang + DUNK.drop + DUNK.land : DUNK.drop + 40 + DUNK.land
      if (since > total) { a.rel = null; return false }
      const w = c01(t / fly), thr = ease(w)
      z.air = Math.max(R.air, 0.75) * up + (slam && since < DUNK.hang ? 0.03 * Math.sin(since / 40) : 0)
      // his body: in front of the rim the whole way, up and down (glide), through the landing
      glide(z, env, a, 0.55 + 0.45 * thr)
      // the arm: from cocked by his head, up over the rim and down through it (the ball with it); on the hang both
      // hands on the front of the rim; then they come down with him
      set3(oh, 0.1, -sd * 0.38, 0.4)
      rimHand(RH, z, env, 0.15, 0)
      const c0 = -0.04, c1 = sd * 0.18
      bh[0] = c0 + (RH[0] - c0) * thr; bh[1] = c1 + (RH[1] - c1) * thr; bh[2] = 1; bh[3] = thr > 0.05 ? 1 : 0
      if (slam && since < DUNK.hang + DUNK.drop * 0.5) {
        const k = since < DUNK.hang ? 1 : 1 - ease((since - DUNK.hang) / (DUNK.drop * 0.5))
        rimHand(RH, z, env, 0.55, sd * 0.45); rimHand(RO, z, env, 0.55, -sd * 0.45)
        for (let j = 0; j < 3; j++) { bh[j] = 0.1 + (RH[j] - 0.1) * k; oh[j] = 0.1 + (RO[j] - 0.1) * k }
        bh[1] = sd * 0.3 + (RH[1] - sd * 0.3) * k; oh[1] = -sd * 0.3 + (RO[1] + sd * 0.3) * k; bh[2] = oh[2] = 0.4 + 0.6 * k
        bh[3] = oh[3] = k > 0.3 ? 1 : 0
      } else if (slam) { set3(bh, 0.12, sd * 0.42, 0.4); bh[3] = 0 }
      else if (miss) { bh[3] = up > 0.5 ? 1 : 0 }
      // on the hang his legs swing a little under him; coming down they reach for the floor
      const swing = slam ? Math.sin(Math.PI * c01(since / (DUNK.hang + DUNK.drop * 0.6))) : 0
      z.lf[0] = -0.1 + 0.2 * swing; z.rf[0] = -0.14 + 0.22 * swing; z.lf[1] = -0.14; z.rf[1] = 0.14
      z.lean = 0.05 - 0.08 * swing
      if (up <= 0.02) { const l = c01((since - (total - DUNK.land)) / DUNK.land); z.scale = 0.94 + 0.06 * l; z.lf[0] = 0.04; z.rf[0] = 0.04; z.lf[1] = -0.22 + 0.08 * l; z.rf[1] = 0.22 - 0.08 * l; set3(bh, 0.14, sd * 0.46, 0.3); set3(oh, 0.14, -sd * 0.46, 0.3); bh[3] = oh[3] = 0; z.lean = 0.03 }
      if (!slam && !miss) { z.ball = true; z.two = false; set3(z.bl, bh[0] + 0.03, bh[1], 10.6) }
      a.gAir = z.air
      return true
    }
    if (t > FOLLOW + 160 || (p.act === 'gather')) { if (p.act !== 'gather') a.rel = null; return false }
    const hold = 1 - ease((t - FOLLOW) / 160), snap = out3(t / 90)
    // coming down as the game has him (T.follow), the shooting arm left up there
    const fall = c01(t / (gticks(T.follow) * STEP * 0.8))
    z.air = Math.max(z.air, R.air * (1 - ease(fall)))
    if (R.blocked) { mix3(bh, 0.28, sd * 0.3, 0.5, hold); return true }
    if (R.kind === 'jumper') {
      mix3(bh, 0.26 + 0.14 * snap, 0.1, 1, hold); mix3(oh, 0.16, -0.36, 0.4 - 0.1 * snap, hold)
      // a drifting jumper lands where the drift took him, and the body settles back over his feet
      if (a.gOx || a.gOy) { const back = 1 - ease(t / 260); z.ox = a.gOx * back; z.oy = a.gOy * back; if (back <= 0) a.gOx = a.gOy = 0 }
    }
    else { mix3(bh, 0.42 + 0.02 * snap, sd * 0.06, 1 - 0.2 * ease(t / 300), hold); mix3(oh, 0.06, -sd * 0.44, 0.3, hold) }
    return t < 200
  }

  return { on, pose, anim: A, poses: Z }
}
