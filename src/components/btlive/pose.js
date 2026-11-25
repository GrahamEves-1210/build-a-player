// BLACKTOP LIVE: what each man's body is doing, as a pose figure.js can draw. Read every frame from the game's
// state and what just happened (the simulation's events): which way he's turned (where he's going, the man he
// guards, the rim he's shooting at), his stride, the dribble and each dribble move, the gather and the jumper with
// its release and follow-through, a layup, the dunk (gather, takeoff, the ball cocked back, thrown down, the hang,
// the landing), a hand up on defence, a swipe, a jump at a shot, a man frozen by a move or sat down by one. Only
// the picture: nothing here changes the game.
import { COURT, T, MOVES, HZ, gticks } from '../../lib/btlive/index.js'

const RIM = COURT.rim, STEP = 1000 / HZ, TAU = Math.PI * 2
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const ease = t => { t = c01(t); return t * t * (3 - 2 * t) }
const out3 = t => { t = c01(t); return 1 - (1 - t) * (1 - t) * (1 - t) }
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a }
const set3 = (h, x, y, z) => { h[0] = x; h[1] = y; h[2] = z }
const mix3 = (h, x, y, z, w) => { h[0] += (x - h[0]) * w; h[1] += (y - h[1]) * w; h[2] += (z - h[2]) * w }

const STRIDE = 5.4                    // feet of floor to one full stride (two steps)
const DRIB = 430, DRIB_RUN = 330      // ms a bounce, standing and at a run
export const DUNK = { hang: 230, drop: 190, land: 120 }   // ms: on the rim, coming down, the knees taking it
const FOLLOW = 560                    // ms a shooter holds his follow-through

export function createPoser(N) {
  const A = Array.from({ length: N }, () => ({
    ang: -Math.PI / 2, x: null, y: 0, run: 0, sp: 0, lx: 1, ly: 0, hand: 1, handT: 1, drib: 0,
    inMv: 0, mvSide: 1, mvT0: 0, gT0: -1, gKind: null, gSide: 1, gAir: 0,
    rel: null, slam: 0, swipe: null, pass: null, hit: null, wob: 1, cheer: false, land: 0,
  }))
  const Z = Array.from({ length: N }, () => ({ ang: 0, lh: [0, 0, 0], rh: [0, 0, 0], lf: [0, 0], rf: [0, 0], air: 0, scale: 1, lean: 0, down: 0, ox: 0, oy: 0, ball: false, bl: [0, 0, 0], two: false, bounce: false, thud: false, burst: 0, toeL: 0, toeR: 0 }))

  // what happened: the things a pose can't read off the state
  function on(e, s, now) {
    const p = e.pid != null ? A[e.pid] : null
    if (e.e === 'release') p.rel = { t0: now, kind: e.kind, air: p.gAir, side: p.gSide, slam: 0, out: 0 }
    else if (e.e === 'make') {
      if (p.rel) { p.rel.out = now; if (e.kind === 'dunk') p.rel.slam = now }
      // a poster: the man under it goes down
      if (e.poster && e.on != null) {
        const j = typeof e.on === 'number' ? e.on : s.players.findIndex(o => o.id === e.on)
        if (j >= 0) { const d = s.players[j], q = s.players[e.pid]; let ux = d.x - q.x, uy = d.y - q.y; const l = Math.hypot(ux, uy) || 1; A[j].hit = { t0: now, ux: ux / l, uy: l < 0.2 ? 1 : uy / l } }
      }
    } else if (e.e === 'miss') { if (p.rel) p.rel.out = now }
    else if (e.e === 'block') { const q = A[e.on]; if (q) { q.rel = { t0: now, kind: e.kind, air: q.gAir, side: q.gSide, slam: 0, out: now, blocked: true } } }
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
  // sFt: the figure's size in feet, me }
  function pose(s, i, now, env) {
    const p = s.players[i], a = A[i], z = Z[i], b = s.ball, P = s.players
    const live = s.phase === 'live', has = b.st === 'held' && b.holder === i
    const dt = env.dt
    // how far he went since the last frame: his stride comes from the floor he covers
    if (a.x == null) { a.x = env.x; a.y = env.y }
    const mvx = env.x - a.x, mvy = env.y - a.y, dist = Math.hypot(mvx, mvy)
    a.x = env.x; a.y = env.y
    const sp = dt > 0 ? Math.min(30, dist / dt * 1000) : 0                 // ft a real second
    if (dt > 0) a.sp += (sp - a.sp) * (1 - Math.exp(-dt / 90))
    if (dist < 3) a.run += dist / STRIDE * TAU
    const amp = c01(a.sp / 9)

    // ── which way he's turned ──
    let fa = Math.atan2(p.fy, p.fx), turn = 85
    const toRim = Math.atan2(RIM.y - env.y, RIM.x - env.x), dRim = Math.hypot(RIM.x - env.x, RIM.y - env.y)
    const ballX = b.st === 'held' ? P[b.holder].x : b.x, ballY = b.st === 'held' ? P[b.holder].y : b.y
    const toBall = Math.atan2(ballY - env.y, ballX - env.x)
    const shooting = p.act === 'gather' || (a.rel && now - a.rel.t0 < FOLLOW + 200)
    const man = p.man >= 0 ? P[p.man] : null
    const guarding = live && p.team !== s.poss && man && !has
    if (shooting) { if (dRim > 1.2) fa = toRim; else fa = a.ang; turn = 60 }
    else if (a.pass && now - a.pass.t0 < 220) { fa = a.pass.a; turn = 40 }
    else if (a.swipe && now - a.swipe.t0 < 260) { fa = a.swipe.a; turn = 50 }
    else if (p.act === 'jump' || p.act === 'land') fa = (b.st === 'shot' || b.st === 'loose') && !guarding ? toBall : man && guarding ? Math.atan2(man.y - env.y, man.x - env.x) : toBall
    else if (p.act === 'frozen' || p.act === 'down') fa = a.ang
    else if (guarding) {
      // on his man: squared up to him. Chasing a man who's gone by: turned to run
      const dm = Math.hypot(man.x - env.x, man.y - env.y), toMan = Math.atan2(man.y - env.y, man.x - env.x)
      const going = a.sp > 4 ? Math.atan2(mvy, mvx) : toMan
      fa = dm > 9 && a.sp > 6 && Math.abs(wrap(going - toMan)) > 1.3 ? going : toMan
    } else if (live && !has && b.st === 'pass' && b.to === i) fa = toBall
    else if (live && !has && a.sp < 2.2) fa = toBall
    else if (!live && a.sp < 1) fa = Math.atan2(p.fy, p.fx)
    a.ang += wrap(fa - a.ang) * (1 - Math.exp(-dt / turn))
    z.ang = a.ang
    const ca = Math.cos(a.ang), sa = Math.sin(a.ang)
    // the floor he's covering, in his own frame (forward, to his right): his feet go that way
    // (kept from the last frame he moved in: a frame drawn twice, or the game stopped, doesn't stand him up)
    if (dist > 0.0005) { a.lx = (mvx * ca + mvy * sa) / dist; a.ly = (-mvx * sa + mvy * ca) / dist }
    const lx = a.lx, ly = a.ly

    // ── standing and running ──
    const sw = Math.sin(a.run)
    z.air = 0; z.scale = 1; z.lean = 0.05 * amp * Math.max(0, lx); z.down = 0; z.ox = 0; z.oy = 0; z.ball = false; z.two = false; z.bounce = false; z.thud = false; z.burst = 0; z.toeL = 0; z.toeR = 0
    // (a long stride: from above a runner's front foot shows past his chest, his back one behind him)
    const stx = lx * 0.5 * amp, sty = ly * 0.2 * amp, rest = 0.07 * (1 - amp)
    z.lf[0] = rest + stx * sw; z.lf[1] = -0.17 + sty * sw
    z.rf[0] = rest - stx * sw; z.rf[1] = 0.17 - sty * sw
    set3(z.lh, 0.13 - 0.24 * amp * sw * Math.sign(lx || 1), -0.5, 0.25)
    set3(z.rh, 0.13 + 0.24 * amp * sw * Math.sign(lx || 1), 0.5, 0.25)

    // ── a man on defence: low, wide, a hand in it ──
    if (guarding && p.act === 'free') {
      const dm = Math.hypot(man.x - env.x, man.y - env.y), onBall = b.st === 'held' && b.holder === man.i
      const wide = c01((10 - dm) / 4) * (1 - 0.5 * c01((a.sp - 7) / 4))                // squared up when he's on him, running when he's chasing
      z.lf[1] -= 0.12 * wide; z.rf[1] += 0.12 * wide
      mix3(z.lh, 0.24, -0.66, 0.35, wide); mix3(z.rh, 0.24, 0.66, 0.35, wide)
      if (onBall && dm < 8.5) {
        // the hand on the ball's side goes up at it; when the man rises to shoot, straight up
        const sd = A[man.i].hand * (Math.cos(a.ang - A[man.i].ang) < 0 ? -1 : 1) >= 0 ? 1 : -1
        const up = man.act === 'gather' ? 1 : 0.72, hand = sd > 0 ? z.rh : z.lh
        mix3(hand, man.act === 'gather' ? 0.5 : 0.46, sd * (man.act === 'gather' ? 0.1 : 0.24), up, c01((8.5 - dm) / 2))
      }
    }
    // off the ball, on offence: hands ready for a pass on its way; an arm up when he calls for it
    if (live && !has && p.team === s.poss && p.act === 'free') {
      if (b.st === 'pass' && b.to === i) { set3(z.lh, 0.44, -0.15, 0.55); set3(z.rh, 0.44, 0.15, 0.55) }
      else if (s.call && s.call.pid === i && s.tick - s.call.tick < 40) set3(z.rh, 0.16, 0.42 + 0.08 * Math.sin(now / 70), 1)
    }

    // ── the ball in his hands ──
    if (has && p.act !== 'gather') {
      z.ball = true
      if (!live) {
        // between plays: held in both hands at his belt
        set3(z.lh, 0.3, -0.11, 0.4); set3(z.rh, 0.3, 0.11, 0.4); set3(z.bl, 0.32, 0, 3.2); z.two = true
      } else dribble(s, p, a, z, now, env, amp)
    } else a.inMv = 0

    // ── a pass just thrown: both hands through it ──
    if (a.pass) {
      const t = now - a.pass.t0
      if (t < 200) { const w = t < 60 ? t / 60 : 1 - (t - 60) / 140; mix3(z.lh, 0.6, -0.1, 0.55, w); mix3(z.rh, 0.6, 0.1, 0.55, w) } else a.pass = null
    }
    // ── a swipe at the ball: the arm shot out, and back ──
    if (a.swipe) {
      const t = now - a.swipe.t0, dur = a.swipe.miss ? 420 : 240
      if (t < dur) {
        const w = t < 80 ? out3(t / 80) : 1 - ease((t - 80) / (dur - 80))
        const la = wrap(a.swipe.a - a.ang), sd = Math.sin(la) >= 0 ? 1 : -1
        mix3(sd > 0 ? z.rh : z.lh, 0.02 + Math.cos(la) * 0.62, sd * 0.4 + Math.sin(la) * 0.62, 0.45, w)
        z.lean = Math.max(z.lean, 0.1 * w)
      } else a.swipe = null
    }

    // ── going up ──
    if (p.act === 'gather' && p.shot) gather(p, a, z, now, env, dRim, toRim)
    else if (a.gT0 >= 0) a.gT0 = -1
    if (a.rel) follow(s, p, a, z, now, env, toRim, dRim)

    // ── a jump at a shot or a board ──
    if (p.act === 'jump') {
      const t = c01((p.actT + env.a) / gticks(T.jumpTime)), up = Math.sin(Math.PI * t)
      z.air = 0.95 * up; a.gAir = z.air
      const board = (b.st === 'shot' || b.st === 'loose') && !guarding
      if (board || p.team === s.poss) { set3(z.lh, 0.28, -0.17, 1); set3(z.rh, 0.28, 0.17, 1) }      // both hands up for a board
      else { set3(z.rh, 0.46, 0.1, 1); set3(z.lh, 0.3, -0.26, 0.75) }                                  // a hand up at the shot
      z.lf[0] = -0.12; z.rf[0] = -0.16; z.lf[1] = -0.14; z.rf[1] = 0.14
      a.land = now
    } else if (p.act === 'land' || (a.land && now - a.land < 150)) {
      // the knees take the landing
      z.scale = 0.95; z.lf[1] = -0.26; z.rf[1] = 0.26; mix3(z.lh, 0.2, -0.56, 0.3, 1); mix3(z.rh, 0.2, 0.56, 0.3, 1)
      if (p.act !== 'land' && now - a.land >= 150) a.land = 0
    }

    // ── beaten by a move: frozen on his heels, or sat down ──
    if (p.act === 'frozen' && !(a.swipe && a.swipe.miss)) {
      const t = (p.actT + env.a) * STEP, w = c01(1 - t / 520)
      z.ang = a.ang + a.wob * 0.42 * Math.sin(t / 60) * w
      z.lean = -0.07
      set3(z.lh, 0.02, -0.7, 0.55); set3(z.rh, 0.1 + 0.1 * Math.sin(t / 45), 0.7, 0.55)
      z.lf[0] = 0.16 * a.wob; z.lf[1] = -0.1; z.rf[0] = -0.14 * a.wob; z.rf[1] = 0.2
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
    // ── the final: the winners' arms go up ──
    if (s.phase === 'over' && a.cheer) {
      const hop = Math.abs(Math.sin(now / 190))
      set3(z.lh, 0.08, -0.46, 1); set3(z.rh, 0.08, 0.46, 1); z.air = 0.22 * hop
    }
    return z
  }

  // on the floor: legs out in front of him, his hands back behind him (w: how far down, up: how far back up)
  function floor(z, w, up) {
    const k = Math.min(w, up)
    z.down = k > 0.5 ? 1 : 0; z.lean = -0.1 * k; z.scale = 1 - 0.03 * k
    z.lf[0] += (0.52 - z.lf[0]) * k; z.lf[1] = -0.18; z.rf[0] += (0.46 - z.rf[0]) * k; z.rf[1] = 0.18
    mix3(z.lh, -0.34, -0.5, 0, k); mix3(z.rh, -0.36, 0.5, 0, k)
  }

  // the dribble, and each move by its own shape
  function dribble(s, p, a, z, now, env, amp) {
    const P = s.players
    // which hand: the one away from the men on him (the nearest counting most), kept until they're clearly on the other side
    const rx = -Math.sin(a.ang), ry = Math.cos(a.ang)
    let sum = 0
    for (const o of P) {
      if (o === p || o.team === p.team) continue
      const ox = o.x - p.x, oy = o.y - p.y, d2 = ox * ox + oy * oy
      if (d2 < 64) sum += (ox * rx + oy * ry) / Math.max(4, d2)
    }
    const M = p.burst > 0 ? p.mv : 0
    if (M && a.inMv !== M) {
      // a move starts: a crossover and a behind-the-back take the ball to the hand on the side he's going
      a.mvT0 = now
      const side = p.bdx * rx + p.bdy * ry
      if (M === MOVES.cross.n || M === MOVES.btb.n) a.handT = Math.abs(side) > 0.15 ? (side > 0 ? 1 : -1) : -a.handT
      a.mvSide = a.handT
    } else if (!M && Math.abs(sum) > 0.06) a.handT = sum > 0 ? -1 : 1
    a.inMv = M
    const f = M ? c01(1 - (p.burst - env.a) / Math.max(1, p.bn)) : 0
    a.hand += (a.handT - a.hand) * (1 - Math.exp(-env.dt / (M ? 55 : 80)))
    const h = a.hand, mid = 1 - Math.abs(h)                                       // mid: the ball on its way across him
    // the bounce
    const per = DRIB + (DRIB_RUN - DRIB) * amp
    const was = Math.floor(a.drib)
    a.drib += env.dt / per
    const ph = a.drib % 1, up = Math.sin(Math.PI * ph)                            // 0 on the floor, 1 in his hand
    z.bounce = true; z.thud = Math.floor(a.drib) !== was                          // (thud: it hit the floor this frame)
    let bx = 0.47 + 0.1 * mid, by = h * 0.47, bz = 0.5 + 2.4 * up, hz = 0.22 + 0.22 * up
    z.burst = M ? 1 : 0
    if (M === MOVES.cross.n) {
      // low and hard across his body, his shoulders dropped into it
      bx = 0.5 + 0.2 * mid; bz = 0.4 + 1.0 * Math.abs(h) * up; z.lean = 0.1
      z.ang = a.ang - a.mvSide * 0.3 * Math.sin(Math.PI * f)
      z.lf[1] -= 0.08; z.rf[1] += 0.08
    } else if (M === MOVES.btb.n) {
      // round behind him: out of sight of the man in front
      bx = 0.4 - 0.84 * mid; by = h * 0.44; bz = 0.5 + 1.2 * up; z.lean = 0.04
    } else if (M === MOVES.hesi.n) {
      // up on his toes with the ball high, as if he's stopping, then down and gone
      const st = c01(f / 0.3), go = c01((f - 0.3) / 0.3)
      bz = 0.5 + 3.3 * Math.sin(Math.PI * Math.min(1, st)) * (1 - go) + 0.9 * go * up; hz = 0.3 + 0.45 * (1 - go) * Math.sin(Math.PI * st)
      z.scale = 1 + 0.05 * Math.sin(Math.PI * st) * (1 - go); z.lean = -0.04 * (1 - go) + 0.13 * go
      bx = 0.42 + 0.1 * go
    } else if (M === MOVES.back.n) {
      // a hop back off both feet, the ball pulled in to his hip ready to go up
      const hop = Math.sin(Math.PI * f)
      z.air = 0.22 * hop; z.lean = -0.05
      z.lf[0] = 0.22 * (1 - f); z.rf[0] = 0.26 * (1 - f); z.lf[1] = -0.2; z.rf[1] = 0.2
      bx = 0.2; by = h * 0.4; bz = 2.6; hz = 0.4
    } else if (M === MOVES.spin.n) {
      // all the way round off his man, the ball kept tight on the far hip
      z.ang = a.ang + Math.sign(p.bs || 1) * TAU * ease(f)
      bx = 0.26; by = h * 0.34; bz = 1.8; hz = 0.35
      z.lf[0] = 0.2; z.rf[0] = -0.14
    }
    set3(z.bl, bx, by, bz)
    // the hand on the ball, the other arm up between it and his man
    const bh = h >= 0 ? z.rh : z.lh, oh = h >= 0 ? z.lh : z.rh, sd = h >= 0 ? 1 : -1
    set3(bh, bx - 0.1, by - sd * 0.05, hz)
    if (M === MOVES.btb.n && mid > 0.3) set3(oh, bx - 0.02, -by * 0.2 - sd * 0.3, 0.2)   // the other hand reaching back for it
    else set3(oh, 0.2 + 0.1 * amp * Math.sin(a.run), -sd * 0.52, 0.4)
  }

  // rising for a shot: by its kind. g: 0 as he starts, 1 where the green is
  function gather(p, a, z, now, env, dRim, toRim) {
    const sh = p.shot, kind = sh.kind
    if (a.gT0 < 0 || a.gKind !== kind) { a.gT0 = now; a.gKind = kind; a.gSide = kind === 'jumper' ? 1 : a.hand >= 0 ? 1 : -1; a.rel = null }
    const ideal = sh.spec?.ideal || (kind === 'jumper' ? T.jIdealMs : T.lIdealMs)
    const g = Math.max(0, env.held) / ideal, sd = a.gSide
    z.ball = true; z.two = true
    if (kind === 'jumper') {
      // the dip, then up: the ball over his forehead, his guide hand beside it, off the floor as it peaks
      const r = ease((g - 0.22) / 0.78)
      z.scale = 1 - 0.04 * Math.sin(Math.PI * c01(g / 0.4))
      z.air = 0.72 * ease((g - 0.4) / 0.6) + 0.1 * c01(g - 1)
      set3(z.bl, 0.3 - 0.07 * r, 0.05, 3 + 5.3 * r)
      set3(z.rh, 0.28 - 0.08 * r, 0.11, 0.35 + 0.65 * r); set3(z.lh, 0.31 - 0.06 * r, -0.1, 0.35 + 0.55 * r)
      z.lf[0] = 0.05; z.rf[0] = 0.09; z.lf[1] = -0.17; z.rf[1] = 0.17
    } else if (kind === 'layup') {
      // two steps with it tucked, then up off one foot, the ball out in front on one hand
      const r = ease((g - 0.4) / 0.6)
      z.air = 0.95 * r
      const hx = 0.26 + 0.34 * r, hy = sd * (0.3 - 0.22 * r)
      set3(z.bl, hx + 0.06, hy, 3.2 + 5.2 * r)
      const bh = sd > 0 ? z.rh : z.lh, oh = sd > 0 ? z.lh : z.rh
      set3(bh, hx, hy, 0.4 + 0.6 * r); set3(oh, 0.24 - 0.2 * r, -sd * (0.14 + 0.3 * r), 0.4 - 0.1 * r)
      z.lf[0] = sd > 0 ? 0.1 - 0.3 * r : 0.24 * (1 - r); z.rf[0] = sd > 0 ? 0.24 * (1 - r) : 0.1 - 0.3 * r
      z.lean = 0.08
    } else {
      // THE DUNK. The gather: down into his legs with the ball in both hands. The takeoff: up hard (most of the height
      // in the first third of it), the ball cocked back behind his head on one arm, his legs trailing
      const r = out3((g - 0.36) / 0.64)
      z.scale = 1 - 0.07 * Math.sin(Math.PI * c01(g / 0.5)) * (1 - r)
      z.air = 1.2 * r
      const bh = sd > 0 ? z.rh : z.lh, oh = sd > 0 ? z.lh : z.rh
      const hx = 0.22 - 0.46 * r, hy = sd * (0.32 - 0.16 * r)
      set3(z.bl, hx - 0.03 * r, hy, 2.6 + 8 * r)
      set3(bh, hx + 0.04, hy, 0.38 + 0.62 * r); set3(oh, 0.22 + 0.16 * r, -sd * (0.12 + 0.1 * r), 0.38 + 0.4 * r)
      z.lf[0] = 0.2 * (1 - r) - 0.26 * r; z.rf[0] = -0.05 * (1 - r) - 0.32 * r; z.lf[1] = -0.15; z.rf[1] = 0.15
      z.lean = 0.06 + 0.06 * r
      glide(z, env, toRim, dRim, 0.55 * r * r)
    }
    a.gAir = z.air
  }

  // a dunker goes to the rim: his hand ends up on it (the rim is painted at the floor, so by the height he's drawn at too)
  function glide(z, env, toRim, dRim, w) {
    if (dRim < 0.3 || w <= 0) return
    const reach = 0.6 * env.sFt * (1 + 0.2 * z.air), lift = z.air * env.sFt * 0.2
    const cx = RIM.x - Math.cos(z.ang) * reach, cy = RIM.y - Math.sin(z.ang) * reach + lift
    z.ox = (cx - env.x) * w; z.oy = (cy - env.y) * w
  }

  // the ball gone: the follow-through, the dunk's throw-down, hang and landing
  function follow(s, p, a, z, now, env, toRim, dRim) {
    const R = a.rel, t = now - R.t0, sd = R.side
    const bh = sd > 0 ? z.rh : z.lh, oh = sd > 0 ? z.lh : z.rh
    if (R.kind === 'dunk' && !R.blocked) {
      const fly = gticks(0.16) * STEP                                       // the throw-down: as long as the game has the ball in the air
      const slam = R.slam, miss = !slam && R.out
      if (!slam && !miss && t > fly + 260) { a.rel = null; return }        // (the game never said how it ended)
      const since = slam ? now - slam : miss ? now - R.out : -1
      // up: at the rim through the throw and the hang, then down
      let up = 1
      if (slam) up = since < DUNK.hang ? 1 : 1 - ease((since - DUNK.hang) / DUNK.drop)
      else if (miss) up = 1 - ease(since / (DUNK.drop + 40))
      const total = slam ? DUNK.hang + DUNK.drop + DUNK.land : DUNK.drop + 40 + DUNK.land
      if (since > total) { a.rel = null; return }
      const w = c01(t / fly), thr = out3(w)
      z.air = Math.max(R.air, 1.2) * up + (slam && since < DUNK.hang ? 0.05 * Math.sin(since / 40) : 0)
      // the arm comes over the top and down through the rim; on the hang his legs swing through under it
      set3(bh, -0.24 + 0.86 * thr, sd * 0.16 * (1 - thr), 1); set3(oh, 0.38 - 0.1 * thr, -sd * 0.22, 0.75 - 0.3 * thr)
      const swing = slam ? Math.sin(Math.PI * c01(since / (DUNK.hang + DUNK.drop * 0.6))) : 0
      z.lf[0] = -0.26 + 0.52 * swing; z.rf[0] = -0.32 + 0.56 * swing; z.lf[1] = -0.15; z.rf[1] = 0.15
      z.lean = 0.1 - 0.16 * swing
      if (up <= 0.02) { const l = c01((since - (total - DUNK.land)) / DUNK.land); z.scale = 0.92 + 0.08 * l; z.lf[0] = 0.07; z.rf[0] = 0.07; z.lf[1] = -0.27 + 0.1 * l; z.rf[1] = 0.27 - 0.1 * l; mix3(bh, 0.2, sd * 0.56, 0.3, 1); mix3(oh, 0.2, -sd * 0.56, 0.3, 1); z.lean = 0.05 }
      glide(z, env, toRim, dRim, (0.55 + 0.45 * thr) * Math.min(1, up * 1.6))
      // the ball stays in his hand until it's through
      if (!slam && !miss) { z.ball = true; z.two = false; set3(z.bl, -0.24 + 0.86 * thr + 0.05, sd * 0.16 * (1 - thr), 10.6) }
      a.gAir = z.air
      return
    }
    if (t > FOLLOW + 160 || (p.act === 'gather')) { if (p.act !== 'gather') a.rel = null; return }
    const hold = 1 - ease((t - FOLLOW) / 160), snap = out3(t / 90)
    // coming down as the game has him (T.follow), the shooting arm left up there
    const fall = c01(t / (gticks(T.follow) * STEP * 0.8))
    z.air = Math.max(z.air, R.air * (1 - ease(fall)))
    if (R.blocked) { mix3(bh, 0.3, sd * 0.3, 0.5, hold); return }
    if (R.kind === 'jumper') { mix3(bh, 0.3 + 0.3 * snap, 0.07, 1, hold); mix3(oh, 0.26, -0.36, 0.6 - 0.2 * snap, hold) }
    else { mix3(bh, 0.6 + 0.02 * snap, sd * 0.06, 1 - 0.2 * ease(t / 300), hold); mix3(oh, 0.04, -sd * 0.44, 0.3, hold) }
  }

  return { on, pose, anim: A, poses: Z }
}
