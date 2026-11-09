// ONE-ON-ONE: through on goal, the ball at your feet, a defender chasing and the keeper to beat. You play it with the
// stick (the arrows on a keyboard), as Get a Bucket is played: every touch pushes the ball ahead of you, and the
// two players against you think for themselves.
//   moving   the stick steers. Up is a sprint: quicker, but every touch goes further ahead (a heavy touch), and a
//            loose ball is the keeper's to come and claim. Let go and he runs on at a jog, the ball close. Down checks
//            him up. A sharp change of direction with the ball close is a touch away: round the keeper as he commits,
//            or off the defender's toes.
//   shooting hold SHOOT (SPACE) and the power bar fills; aim with the stick while you hold it (across the goal, up
//            for high, down to drive it low) and let go to strike it. Too much and it's over the bar. Tap SHOOT
//            again as his foot meets it for a timed finish. CHIP (E): a quick tap is the dink over a keeper who's come
//            off his line; held, it's a finesse shot, curled and placed. With a teammate arriving and the stick pulled
//            back, a tap of SHOOT cuts it back for him.
//   the keeper  comes off his line to narrow the angle, sets himself and spreads as you get close, comes to claim a
//            heavy touch, goes down at your feet if you take it too close, and reads your hips: he leans the way
//            you're running. The angle matters: out wide there's less of the goal to aim at, the near post's tight.
//   the defender  recovers from behind or alongside and slides in if you're slow or the ball's loose.
// The grade (pace, finishing, composure) is everything: your speed against his, the size of the touch, the shot's
// accuracy and the timed finish's window, and how much the keeper reads you.
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, nudge, manOf, paceOf, text, rr, circle, keyCap, lightMode, DISPLAY, LABEL } from './kit.js'
import { placeStamp } from './read.js'
import { camOf, P, stadium, net, goalFrame, ball, man, POSE, mix, runPose, dribblePose, kickPose, kitsOf, dress, boardWords, flashes, crowdUp, POST, BAR, NET_D, BOX_W,
  shooter, strikeOf, shotAt, keeperSave, shotHud, aimMark, celebration, scorerAt, mateAt, keeperBeaten, defenderBeaten, keeperRoar, strikerDenied, celebMs, skipOutro } from './soccer.js'

export const how = {
  'one-on-one': 'Through on goal. Run at him with the stick (up to sprint: the touches get heavier). Hold SHOOT and aim, let go to strike it, tap again at contact for a perfect finish. Tap CHIP to dink a keeper who’s off his line, hold it to curl one. Cut sharply as he commits to go round him.',
}

const FRICTION = 10.5        // m/s²: how fast a touched ball slows on the grass (a touch is a push, not a pass)
const REACH = 0.62           // the ball's on his foot inside this
const CONTROL = 1.55         // close enough to strike it
const K_RUN = 5.2, K_SIDE = 4.4, K_DIVE = 6.2
const SLIDE_MS = 430, SLIDE_GO = 2.8

export function make({ v, seed, cast = null, situation = null }) {
  const r = rngOf(seed), tv = clamp((v - 1) / 10, 0, 1)
  // the start: through the middle, or out of the left or right channel; the keeper on his line or off it already;
  // the defender behind you or level with you; now and then a teammate arriving late on the other side
  const where = r() < 0.4 ? 0 : r() < 0.5 ? -1 : 1
  const kOff = r() < 0.32, level = r() < 0.34, withMate = r() < 0.42
  const style = r() < 0.34 ? 'rusher' : r() < 0.5 ? 'stayer' : 'sweeper'
  const x0 = where * (9 + r() * 4) + (r() - 0.5) * 2, z0 = -29 - r() * 4
  const dSide = where ? -where : r() < 0.5 ? -1 : 1
  const jog = byV(v, 5.5, 6.5), sprint = byV(v, 6.9, 8.7), slow = 3.3
  const dSpeed = 6.75 * paceOf(cast, 'them', 'cb', 0)
  // the touch: how far ahead a sprinting touch goes (first touch and dribbling: a good one keeps it closer)
  const heavyLead = byV(v, 4.3, 2.5), jogLead = byV(v, 1.35, 0.95)
  const readK = lerp(0.95, 0.35, tv)      // how much the keeper reads the hips
  const pressure = situation?.clockText && /(\d+)/.test(situation.clockText) && +RegExp.$1 >= 80 ? 0.7 : 0.3
  const k = shooter(v, { pressure })
  const g = {
    t: 0, game: 'one-on-one', zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 2900, stamp: null,
    sit: situation ?? null, v, tv, where, kOff, level, style, withMate,
    who: { me: manOf(cast, 'us', 'st', 0), gk: manOf(cast, 'them', 'gk', 0), def: manOf(cast, 'them', 'cb', 0), mate: manOf(cast, 'us', 'st', 1) },
    phase: 'set', liveAt: 650,
    me: { x: x0, z: z0, vx: 0, vz: sprint * 0.9, cycle: 0, lean: 0 },
    bl: { x: x0 + 0.1, z: z0 + 1.1, vx: 0, vz: sprint * 0.9, y: 0.11, owner: 'me', touchAt: -999, lead: jogLead, spin: 0 },
    gk: { x: x0 * 0.06, z: kOff ? -7.5 - r() * 2.5 : -0.5, vx: 0, vz: 0, st: kOff ? 'out' : 'line', at: 0, side: 0, lean: 0, cycle: 0 },
    df: { x: x0 + dSide * (level ? 2.6 : 1.2), z: z0 - (level ? 1.0 : 4.2 + r() * 1.8), vx: 0, vz: dSpeed * 0.8, st: 'chase', at: 0, dir: 0, cycle: 0 },
    mt: withMate ? { x: -dSide * 8 + x0 * 0.3, z: z0 - 7, vx: 0, vz: 0, cycle: 0, on: false } : null,
    k, shot: null, pass: null, res: null, why: '', resAt: null, endAt: null, popAt: null, doneAt: null,
    camX: x0 * 0.6, camZ: z0 - 9, hist: [], take: null, word: null,
    ctl: { tid: null, ox: 0, oy: 0, tx: 0, ty: 0, ax: 0, ay: 0, ext: false, keys: { L: 0, R: 0, U: 0, D: 0 }, sid: null, cid: null, chipAt: null, shootAt: null, side: 0, sideAt: -999 },
    stickOut: { x: 0, y: 0 }, vh: 640, keysView: false,
    nudge: nudge(),
    hud: { prompt: 'THROUGH ON GOAL' },
    tick(dt) {
      g.t += dt
      const s = dt / 1000
      if (g.word && g.t - g.word.at > 1100) g.word = null
      if (g.phase === 'set') { if (g.t >= g.liveAt) { g.phase = 'live'; g.fx.push('whistle'); g.hud.prompt = kOff ? 'KEEPER’S OFF HIS LINE' : 'PICK A SPOT' } return }
      if (g.hud.prompt && g.t - g.liveAt > 1500) g.hud.prompt = null
      stickNow()
      if (!g.res) striker(s)
      else after(s)
      ballMove(s)
      if (!g.res) { keeper(s); defender(s); mate(s) } else { keeperAfter(s); defenderAfter(s); mate(s) }
      // (the strike waits for him to get to the ball, up to a beat)
      if (k.phase === 'strike' && !g.res && Math.hypot(g.bl.x - g.me.x, g.bl.z - g.me.z) > CONTROL && g.t > k.strikeAt - 40 && g.t - k.relAt < 900) k.strikeAt = g.t + 40
      if (k.tick(g.t)) strike()
      if (g.shot && !g.res) shotTick()
      if (g.pass && !g.res) passTick()
      // the lens: behind you, easing round to the celebration once it's in
      const fx = g.res === 'goal' && g.cel ? scorerAt(g.cel, g.t - g.endAt) : null
      // (a little to the side away from the defender, so the man chasing never fills the lens)
      const off = (Math.sign(g.me.x - g.df.x) || 1) * 1.6
      const wantZ = fx ? fx.z - 11 : g.me.z - 9.4, wantX = fx ? fx.x : g.me.x * 0.6 + off
      const kk = 1 - Math.exp(-dt / (g.res ? 240 : 160))
      g.camZ += (Math.min(wantZ, -10.6) - g.camZ) * kk; g.camX += (wantX - g.camX) * kk
      if (g.endAt != null && !g.done && g.t - g.endAt >= 0) finish()
    },
    input(a) { if (skipOutro(g, a)) return; control(a) },
  }
  // ── the controls: a thumbstick on the left of the screen, SHOOT and CHIP on the right; the arrows, SPACE and E ──
  function control(a) {
    const c = g.ctl
    if (a.kind === 'stick') { c.ax = clamp(a.x, -1, 1); c.ay = clamp(a.y, -1, 1); c.ext = true; return }
    if (a.kind === 'key') {
      if (a.zone === 'S') return shootDown('key')
      if (a.zone === 'P') return chipDown('key')
      if (a.zone in c.keys) c.keys[a.zone] = 1
      return
    }
    if (a.kind === 'keyup') {
      if (a.zone === 'S') return shootUp('key')
      if (a.zone === 'P') return chipUp('key')
      if (a.zone in c.keys) c.keys[a.zone] = 0
      return
    }
    const id = a.id ?? 0, B = ctlOf(g.vh)
    if (a.kind === 'down') {
      if (Math.hypot(a.x - B.chip.x, a.y - B.chip.y) < B.chip.r + 12) { c.cid = id; chipDown(id) }
      else if (a.x < 180) { c.tid = id; c.ox = a.x; c.oy = a.y; c.tx = 0; c.ty = 0 }
      else { c.sid = id; shootDown(id) }
    } else if (a.kind === 'move') {
      if (id === c.tid) { const R = B.stick.R; c.tx = clamp((a.x - c.ox) / R, -1.4, 1.4); c.ty = clamp(-(a.y - c.oy) / R, -1.4, 1.4); const m = Math.hypot(c.tx, c.ty); if (m > 1) { c.tx /= m; c.ty /= m } }
    } else if (a.kind === 'up') {
      if (id === c.tid) { c.tid = null; c.tx = 0; c.ty = 0 }
      else if (id === c.cid) { c.cid = null; chipUp(id) }
      else if (id === c.sid) { c.sid = null; shootUp(id) }
    }
  }
  function stickNow() {
    const c = g.ctl, o = g.stickOut
    if (c.tid != null) { o.x = c.tx; o.y = c.ty } else if (c.ext) { o.x = c.ax; o.y = c.ay }
    else { o.x = c.keys.R - c.keys.L; o.y = c.keys.U - c.keys.D; const m = Math.hypot(o.x, o.y); if (m > 1) { o.x /= m; o.y /= m } }
    // aiming while the shot's being lined up: no stick across is the side he's not covering
    if (k.phase === 'power' || (k.phase === 'strike' && g.t < k.strikeAt - 30)) {
      const open = -(Math.sign(g.gk.x - g.me.x * 0.25) || 1) * 0.6
      k.aimAt(Math.abs(o.x) > 0.2 ? o.x : open, o.y)
      if (k.type === 'driven' && o.y < -0.5) k.type = 'low'
      else if (k.type === 'low' && o.y >= -0.5) k.type = 'driven'
    }
  }
  function canShoot() { return g.phase === 'live' && !g.res && !g.shot && !g.pass }
  function shootDown() {
    const c = g.ctl
    if (k.phase === 'strike') { if (k.tap(g.t)) g.fx.push('h:light'); return }
    if (!canShoot() || k.phase !== 'idle') return
    c.shootAt = g.t
    k.press(g.t, g.stickOut.y < -0.5 ? 'low' : 'driven')
    g.hud.prompt = null
  }
  function shootUp() {
    const c = g.ctl
    if (k.phase !== 'power' || (k.type !== 'driven' && k.type !== 'low')) return
    const quick = g.t - (c.shootAt ?? g.t) < 150
    // a quick tap with the stick pulled back and a man arriving: cut it back to him. With the stick up: the dink
    if (quick && g.mt?.on && g.stickOut.y < -0.4 && Math.hypot(g.bl.x - g.me.x, g.bl.z - g.me.z) < CONTROL) { k.reset(); return cutBack() }
    if (quick && g.stickOut.y > 0.55) { k.type = 'chip'; k.power = 0.5 }
    k.release(g.t)
    if (k.type === 'chip') k.power = clamp(0.45 + g.stickOut.y * 0.1, 0, 1)
  }
  function chipDown() {
    const c = g.ctl
    if (!canShoot() || k.phase !== 'idle') return
    c.chipAt = g.t
    k.press(g.t, 'finesse')
    g.hud.prompt = null
  }
  function chipUp() {
    const c = g.ctl
    if (k.phase !== 'power' || k.type !== 'finesse') return
    if (g.t - (c.chipAt ?? g.t) < 170) { k.type = 'chip'; k.release(g.t); k.power = clamp(0.5 + (Math.hypot(g.gk.x - g.me.x, g.gk.z - g.me.z) - 6) * 0.02, 0.35, 0.7); return }
    k.release(g.t)
  }

  // ── you, and the ball at your feet ──
  const S = { x: 0, z: 0 }
  function striker(s) {
    const m = g.me, o = g.stickOut, b = g.bl
    const shooting = k.phase === 'power' || k.phase === 'strike'
    // where he wants to go: the stick, or on at goal at a jog
    let dx = o.x, dz = o.y
    const mag = Math.hypot(dx, dz)
    let sp = jog
    if (shooting) {
      // shaping to shoot: he keeps going, the ball kept close, on toward goal
      dx = o.x * 0.4 - b.x * 0.04; dz = 1
      sp = Math.max(jog * 0.88, Math.min(Math.hypot(m.vx, m.vz), sprint))
    }
    else if (mag < 0.2) { dx = -m.x * 0.02; dz = 1; sp = jog }
    else if (dz > 0.55 && mag > 0.7) sp = sprint
    else if (dz < -0.55) { sp = slow; dz = 0.15 }
    else { sp = jog; dz = Math.max(dz, 0.45) }   // (across: on the diagonal, still going at goal)
    const dl = Math.hypot(dx, dz) || 1
    S.x = dx / dl; S.z = dz / dl
    // the touch away: the stick snapped across with the ball close, a burst that way
    const sd = Math.abs(o.x) > 0.6 ? Math.sign(o.x) : 0
    if (!shooting && sd && g.ctl.side && sd !== g.ctl.side && g.t - g.ctl.sideAt < 380 && b.owner === 'me' && Math.hypot(b.x - m.x, b.z - m.z) < 1.5 && (!g.take || g.t - g.take.at > 500)) takeAway(sd)
    else if (!shooting && sd && !g.ctl.side) { /* first side */ }
    if (sd) { if (sd !== g.ctl.side) { g.ctl.side = sd; g.ctl.sideAt = g.t } } else if (Math.abs(o.x) < 0.25 && g.t - g.ctl.sideAt > 380) g.ctl.side = 0
    // chasing a ball that's gone ahead: he goes after it
    const toBall = Math.hypot(b.x - m.x, b.z - m.z)
    // (only when it's out in front of where he's going: he doesn't circle a ball he's turned away from)
    const ahead = toBall > 0.01 ? ((b.x - m.x) * S.x + (b.z - m.z) * S.z) / toBall : 1
    if (b.owner === 'me' && toBall > 1.25 && ahead <= 0.4) { S.x = (b.x - m.x) / toBall; S.z = (b.z - m.z) / toBall }   // (it's got away behind him: back for it)
    else if ((!shooting || toBall > 1.2) && toBall > 1.1 && b.owner === 'me' && ahead > 0.4) { const bx = b.x - m.x, bz = b.z - m.z; S.x = lerp(S.x, bx / toBall, 0.65); S.z = lerp(S.z, bz / toBall, 0.65); const n = Math.hypot(S.x, S.z) || 1; S.x /= n; S.z /= n }
    const burst = g.take && g.t - g.take.at < 320 ? 1.18 : 1
    const acc = 1 - Math.exp(-s / 0.16)
    m.vx += (S.x * sp * burst - m.vx) * acc; m.vz += (S.z * sp * burst - m.vz) * acc
    m.x += m.vx * s; m.z += m.vz * s
    m.lean += (clamp(-m.vx / 9, -0.3, 0.3) * 0.0 + clamp((S.x * sp - m.vx) * -0.06 + m.vx * 0.04, -0.28, 0.28) - m.lean) * (1 - Math.exp(-s / 0.12))
    const v2 = Math.hypot(m.vx, m.vz)
    m.cycle += (v2 * s) / 2.5
    g.hist.push({ t: g.t, vx: m.vx }); while (g.hist.length && g.t - g.hist[0].t > 420) g.hist.shift()
    // a touch: he's got to the ball, he pushes it on the way he's going
    // (or it's at his side or behind him as he turns: he takes it round with him)
    if (b.owner === 'me' && (toBall < REACH || (toBall < 1.25 && ahead < 0.5)) && g.t - b.touchAt > 180 && k.phase !== 'strike' && !(g.take && g.t - g.take.at < 160)) {
      const lead = shooting ? 0.7 : sp >= sprint * 0.96 ? heavyLead * (0.85 + r() * 0.3) : sp <= slow ? 0.55 : jogLead
      touch(S.x, S.z, v2, lead)
    }
    // out of play, or into the side netting
    if (m.z > 0.3 || Math.abs(m.x) > BOX_W + 6) resolve('out', 'Ran it out of play')
    if (b.owner === 'me' && (b.z > 0.2 || Math.abs(b.x) > HALF_W_)) resolve('out', 'Ran it out of play')
    if (g.t - g.liveAt > 12000) resolve('tackled', 'Took too long: they got back')
  }
  function touch(ux, uz, spd, lead) {
    const b = g.bl, du = Math.sqrt(2 * FRICTION * lead)
    b.vx = ux * (spd + du); b.vz = uz * (spd + du)
    b.touchAt = g.t; b.lead = lead
    g.fx.push(lead > 2.5 ? 'dribble' : 'tap')
    if (lead > 2.5) b.heavy = g.t; else b.heavy = null
  }
  function takeAway(side) {
    const m = g.me, b = g.bl
    g.take = { at: g.t, side }
    // the ball knocked across and on, past whoever's coming at it
    const ux = side * 0.88, uz = 0.47
    b.x = m.x + ux * 0.4; b.z = m.z + uz * 0.4
    const du = Math.sqrt(2 * FRICTION * byV(v, 2.3, 2.0))
    b.vx = ux * (Math.hypot(m.vx, m.vz) * 0.5 + du); b.vz = uz * (Math.hypot(m.vx, m.vz) * 0.5 + du)
    b.touchAt = g.t; b.heavy = null
    g.fx.push('dribble', 'h:medium')
    // a keeper who's committed can't come back for it; one who's stood up reacts
    const K = g.gk, near = Math.hypot(K.x - m.x, K.z - m.z)
    if (near < 5.5) {
      if (K.st === 'down' || K.st === 'rush') { if (Math.sign(K.side || 1) !== side) { g.word = { text: 'ROUNDED HIM', at: g.t }; K.beatenAt = g.t } }
      else K.react = g.t + byV(v, 210, 360)
    }
  }
  function ballMove(s) {
    const b = g.bl
    if (b.owner !== 'me' && b.owner !== null) return
    if (g.shot) return
    const sp = Math.hypot(b.vx, b.vz)
    if (sp > 0) { const n = Math.max(0, sp - FRICTION * s) / sp; b.vx *= n; b.vz *= n }
    b.x += b.vx * s; b.z += b.vz * s
    b.spin += (sp * s) / 0.11
    // loose when it's away from him
    b.loose = Math.hypot(b.x - g.me.x, b.z - g.me.z) > 2.0
  }

  // ── the keeper ──
  function keeper(s) {
    const K = g.gk, b = g.bl, m = g.me
    const D = Math.hypot(b.x, b.z)
    K.cycle += (Math.hypot(K.vx, K.vz) * s) / 2.3
    // committed: he's going for it
    if (K.st === 'rush' || K.st === 'down') {
      const a = g.t - K.at
      if (K.st === 'rush') {
        const dx = b.x - K.x, dz = b.z - K.z, d = Math.hypot(dx, dz) || 1
        K.vx = (dx / d) * K_DIVE; K.vz = (dz / d) * K_DIVE
        K.x += K.vx * s; K.z += K.vz * s
        if (d < 1.15) { if (Math.hypot(b.x - m.x, b.z - m.z) > 0.9) return resolve('claimed', 'Heavy touch: the keeper came and claimed it'); K.st = 'down'; K.at = g.t; K.side = Math.sign(dx) || 1; K.tx = b.x; K.tz = b.z }
        if (a > 1400) { K.st = 'set'; K.at = g.t }
      } else {
        // down at your feet: spread, sliding in, covering where the ball is
        // (sliding in at where the ball was when he went: a touch away from there and he's beaten)
        // (a beat to go down, then sliding in)
        if (a > 170 && a < 600) { const tx = K.tx - K.x, tz = K.tz - K.z, td = Math.hypot(tx, tz); if (td > 0.2) { K.x += (tx / td) * 3.9 * s; K.z += (tz / td) * 3.9 * s } }
        const reachB = Math.hypot(b.x - K.x, b.z - K.z)
        if (a > 170 && a < 800 && reachB < 0.95 && !g.shot && !(g.take && K.beatenAt)) return resolve('smothered', 'Keeper smothers it at his feet')
        // missed it: back up, scrambling across his line
        if (a > 1100) { K.st = 'set'; K.at = g.t }
      }
      return
    }
    if (K.react && g.t >= K.react) {
      // reacting to a touch past him: he dives at it
      K.react = 0; K.st = 'down'; K.at = g.t; K.side = Math.sign(b.x - K.x) || 1; K.tx = b.x + b.vx * 0.2; K.tz = b.z + b.vz * 0.2
      if (Math.hypot(b.x - K.x, b.z - K.z) < 2.3) return resolve('smothered', 'He stayed on his feet and got down to it')
      return
    }
    if (K.react) return
    // a heavy touch: if he's there first, he comes for it
    if (b.loose && b.owner === 'me' && b.heavy != null) {
      const kb = Math.hypot(b.x - K.x, b.z - K.z), mb = Math.hypot(b.x - m.x, b.z - m.z)
      const kT = kb / K_DIVE + 0.18, mT = mb / Math.max(4, Math.hypot(m.vx, m.vz))
      if (kT < mT - 0.05 && kb < 9 && b.z > -16) { K.st = 'rush'; K.at = g.t; g.word = { text: 'HE’S COMING', at: g.t }; g.fx.push('h:light'); return }
    }
    // close in with the ball under control: he goes down at your feet
    const kb = Math.hypot(b.x - K.x, b.z - K.z), km = Math.hypot(m.x - K.x, m.z - K.z)
    if (kb < 3.3 && km < 4.0) { K.st = 'down'; K.at = g.t; K.side = Math.sign(b.x - K.x) || 1; K.tx = b.x + b.vx * 0.25; K.tz = b.z + b.vz * 0.25 - 0.4; g.word = { text: 'HE’S GONE DOWN', at: g.t }; g.fx.push('h:light'); return }
    // where he wants to be: on the line from the ball to the middle of the goal, as far out as his style says,
    // leaning the way you were running a moment ago
    const out = style === 'rusher' ? clamp(D * 0.4, 0.5, 11) : style === 'stayer' ? clamp(D * 0.17, 0.5, 4.2) : clamp(D * 0.29, 0.5, 7.5)
    const ux = b.x / (D || 1), uz = b.z / (D || 1)
    const seen = g.hist[0]?.vx ?? 0
    K.lean += (clamp(seen / 7, -1, 1) * readK - K.lean) * (1 - Math.exp(-s / 0.25))
    const tx = ux * out + K.lean * 0.9, tz = uz * out
    // within eight metres: he stops and sets himself, big
    const close = km < 8.5
    const dx = tx - K.x, dz = tz - K.z, d = Math.hypot(dx, dz)
    const spd = close ? 1.4 : K_RUN
    if (d > 0.05) { const st = Math.min(d, spd * s); K.vx = (dx / d) * st / s; K.vz = (dz / d) * st / s; K.x += (dx / d) * st; K.z += (dz / d) * st } else { K.vx = 0; K.vz = 0 }
    K.st = close ? 'set' : d > 0.3 ? 'out' : 'line'
  }
  // ── the defender ──
  function defender(s) {
    const d = g.df, b = g.bl, m = g.me
    d.cycle += (Math.hypot(d.vx, d.vz) * s) / 2.6
    if (d.st === 'slide') {
      const a = g.t - d.at, f = clamp(a / SLIDE_MS, 0, 1)
      const sp = SLIDE_GO * 2.4 * (1 - f)
      d.x += d.dx * sp * s; d.z += d.dz * sp * s
      const footX = d.x + d.dx * 0.9, footZ = d.z + d.dz * 0.9
      if (!g.res && Math.hypot(b.x - footX, b.z - footZ) < 0.8 && !g.shot) { g.word = null; return resolve('tackled', b.loose ? 'Loose touch: the defender slid in and won it' : 'The defender got back and slid in') }
      if (a > SLIDE_MS) { d.st = 'down'; d.at = g.t; g.word = { text: 'MISSED HIM', at: g.t } }
      return
    }
    if (d.st === 'down') { if (g.t - d.at > 900) d.st = 'chase'; d.vx *= 0.9; d.vz *= 0.9; return }
    // he runs at a point goal-side of the ball
    const tx = b.x * 0.92, tz = b.z + 0.9
    const dx = tx - d.x, dz = tz - d.z, dd = Math.hypot(dx, dz) || 1
    const acc = 1 - Math.exp(-s / 0.2)
    d.vx += ((dx / dd) * dSpeed - d.vx) * acc; d.vz += ((dz / dd) * dSpeed - d.vz) * acc
    d.x += d.vx * s; d.z += d.vz * s
    // close enough to the ball, and it's loose or you're slow: he goes to ground
    const db = Math.hypot(b.x - d.x, b.z - d.z), mySp = Math.hypot(m.vx, m.vz)
    const lead = Math.hypot(b.x - m.x, b.z - m.z)
    // (never through the back of him: he has to be alongside, or goal-side)
    const alongside = d.z > m.z - 0.7
    if (db < 2.0 && alongside && (lead > 1.9 || mySp < 4.0) && g.t - g.liveAt > 600) {
      d.st = 'slide'; d.at = g.t; const n = db || 1; d.dx = (b.x + b.vx * 0.2 - d.x) / n; d.dz = (b.z + b.vz * 0.2 - d.z) / n
      const nn = Math.hypot(d.dx, d.dz) || 1; d.dx /= nn; d.dz /= nn
      g.fx.push('h:light')
    }
    if (Math.hypot(d.x - m.x, d.z - m.z) < 2.4 && !g.word) g.word = { text: 'DEFENDER ON HIS SHOULDER', at: g.t }
  }
  // the teammate: in from behind on the far side, into the box, calling for it
  function mate(s) {
    const M = g.mt
    if (!M) return
    if (g.res === 'goal' && g.cel) return
    const tx = -Math.sign(g.me.x || dSide) * 5.5 - dSide * 0.5, tz = Math.min(-8, g.me.z + 1.5)
    const dx = tx - M.x, dz = tz - M.z, d = Math.hypot(dx, dz) || 1
    const sp = 7.4, acc = 1 - Math.exp(-s / 0.25)
    if (g.pass?.kind === 'shot') { M.vx *= 0.9; M.vz *= 0.9 } else { M.vx += ((dx / d) * sp - M.vx) * acc; M.vz += ((dz / d) * sp - M.vz) * acc }
    M.x += M.vx * s; M.z += M.vz * s; M.cycle += (Math.hypot(M.vx, M.vz) * s) / 2.5
    const was = M.on
    M.on = !g.res && M.z > -15 && Math.abs(M.z - g.me.z) < 6
    if (M.on && !was && !g.pass) g.word = { text: 'MAN ARRIVING', at: g.t }
  }

  // ── the strike ──
  function strike() {
    const m = g.me, b = g.bl
    // the ball's got away from him: he can't get the shot off cleanly
    const far = Math.hypot(b.x - m.x, b.z - m.z)
    const from = { x: b.x, z: b.z }
    const dPress = Math.hypot(g.df.x - m.x, g.df.z - m.z)
    const weak = b.x < m.x - 0.25
    const s = strikeOf(k, from, { v, r, foot: 1, weak, speed: clamp((Math.hypot(m.vx, m.vz) - jog) / (sprint - jog), 0, 1), pressure: clamp((3.2 - dPress) / 2.4, 0, 1) })
    if (far > CONTROL) { s.to.x += (r() - 0.5) * 2.4; s.to.y += 0.5; s.wide = Math.abs(s.to.x) > POST - 0.12; s.onTarget = s.onTarget && !s.wide; g.why = 'Stretching for it' }
    g.shot = { ...s, at: g.t }
    b.owner = null
    g.fx.push(s.type === 'chip' ? 'tap' : 'stamp', 'h:medium')
    // the defender in the way blocks it
    const d = g.df
    if (d.st === 'chase' || d.st === 'slide') {
      const lx = s.to.x - from.x, lz = -from.z, L = Math.hypot(lx, lz) || 1, t = ((d.x - from.x) * lx + (d.z - from.z) * lz) / (L * L)
      if (t > 0 && t < 0.35 && !s.chip) { const ex = from.x + lx * t - d.x, ez = from.z + lz * t - d.z; if (Math.hypot(ex, ez) < 0.75) g.shot.block = t }
    }
    // the keeper: what he can do about it, from where he is and what he's doing
    const K = g.gk
    const kk = { x: K.x, z: K.z, read: K.lean, react: K.st === 'set' || K.st === 'line' ? byV(v, 170, 230) : 290, reach: K.st === 'set' ? 1.12 : 0.95, up: K.st === 'down' ? 0.55 : K.st === 'rush' ? 1.5 : 2.45, dive: K.st === 'down' || K.st === 'rush' ? 1.5 : 4.4 }
    if (K.st === 'down' || K.st === 'rush') kk.reach = 1.45
    g.shot.save = s.onTarget && !g.shot.block ? keeperSave(g.shot, kk, r) : null
  }
  function shotTick() {
    const s = g.shot, a = g.t - s.at
    if (s.block != null && a >= s.block * s.T) return resolve('blocked', 'The defender got back and blocked it')
    if (s.save?.saved && a >= s.save.f * s.T) return resolve('saved', s.save.held ? (s.chip ? 'He got back and took the chip' : 'Straight into his arms') : s.type === 'low' ? 'Down low, and he got a hand to it' : 'Good save: he got a strong hand to it', 'gk')
    if (a >= s.T) {
      if (s.over) return resolve('over', s.chip ? 'Too much on the chip: over the bar' : 'Leaned back: over the bar')
      if (s.wide) return resolve('wide', Math.abs(s.from.x) > 8 ? 'From a tight angle, past the post' : 'Dragged it wide')
      if (!s.onTarget) return resolve('over', 'Over the bar')
      const how = s.timed === 'green' ? 'Timed it perfectly' : s.type === 'chip' ? 'Dinked it over him' : s.type === 'finesse' ? 'Curled it into the corner' : s.type === 'low' ? 'Drilled it low past him' : g.take && g.gk.beatenAt ? 'Rounded the keeper and slotted it' : 'Picked his spot'
      resolve('goal', how)
    }
  }
  // the cut-back: square it to the man arriving, who side-foots it first time
  function cutBack() {
    const m = g.me, M = g.mt, b = g.bl
    g.pass = { at: g.t, from: { x: b.x, z: b.z }, to: { x: M.x + M.vx * 0.35, z: M.z + M.vz * 0.35 }, T: 0, kind: 'pass' }
    g.pass.T = Math.max(260, (Math.hypot(g.pass.to.x - b.x, g.pass.to.z - b.z) / 15) * 1000)
    b.owner = null
    g.fx.push('tap', 'h:light')
    // through the defender?
    const d = g.df, lx = g.pass.to.x - b.x, lz = g.pass.to.z - b.z, L = Math.hypot(lx, lz) || 1, t = clamp(((d.x - b.x) * lx + (d.z - b.z) * lz) / (L * L), 0, 1)
    g.pass.cut = Math.hypot(b.x + lx * t - d.x, b.z + lz * t - d.z) < 0.9 && d.st !== 'down' ? t : null
    void m
  }
  function passTick() {
    const p = g.pass, a = g.t - p.at, b = g.bl
    if (p.kind === 'pass') {
      if (p.cut != null && a >= p.cut * p.T) return resolve('blocked', 'The defender cut out the pass')
      const f = clamp(a / p.T, 0, 1)
      b.x = lerp(p.from.x, p.to.x, f); b.z = lerp(p.from.z, p.to.z, f); b.spin += 0.4
      if (f >= 1) {
        // first time, side-footed: the keeper's chance depends on where he is
        const K = g.gk, kk2 = shooter(6)
        kk2.press(0, 'finesse'); kk2.power = 0.45; kk2.phase = 'strike'
        kk2.aimAt(-(Math.sign(K.x - b.x * 0.3) || 1) * 0.65, -0.6)
        const s = strikeOf(kk2, { x: b.x, z: b.z }, { v: 7, r })
        const committed = K.st === 'down' || K.st === 'rush'
        g.pass = { kind: 'shot', at: g.t }
        g.shot = { ...s, at: g.t, mate: true }
        g.shot.save = s.onTarget ? keeperSave(g.shot, { x: K.x, z: K.z, react: committed ? 99999 : 320, reach: committed ? 0.8 : 1.0, up: committed ? 0.5 : 2.4, dive: committed ? 0.5 : 4.0 }, r) : null
        g.fx.push('stamp')
      }
    }
  }

  // ── decided: the payoff plays out ──
  function resolve(kind, why, by = null) {
    if (g.res) return
    g.res = kind; g.why = g.why && kind !== 'goal' && g.why === 'Stretching for it' ? `${g.why}: ${why.toLowerCase()}` : why; g.resAt = g.t
    g.endAt = g.t + (kind === 'goal' ? 140 : kind === 'saved' ? 60 : 0)
    k.phase = k.phase === 'idle' ? 'idle' : 'done'
    if (kind === 'goal') {
      const me = g.shot?.mate ? g.mt : g.me
      const mates = [g.mt && !g.shot?.mate ? { x: g.mt.x, z: g.mt.z } : { x: g.me.x, z: g.me.z }, { x: me.x - 6, z: me.z - 9 }, { x: me.x + 5, z: me.z - 11 }]
      g.cel = celebration(`${seed}|oo`, { from: { x: me.x, z: me.z }, side: me.x > 0 ? 1 : me.x < 0 ? -1 : (r() < 0.5 ? -1 : 1), athletic: v >= 8, mates })
      g.scorer = g.shot?.mate ? 'mate' : 'me'
      g.kAt = { x: g.gk.x, z: g.gk.z, rot: (Math.sign(g.shot?.to.x - g.gk.x) || 1) * 1.4, ball: { x: clamp(g.shot?.to.x ?? 0, -3, 3), z: 1.5 } }
    }
    if (kind === 'tackled' || kind === 'blocked') g.fx.push('stamp', 'h:heavy')
  }
  function after(s) {
    const m = g.me
    // he comes to a stop (or runs off to celebrate: the picture takes him from here)
    m.vx *= Math.exp(-s / 0.35); m.vz *= Math.exp(-s / 0.35)
    if (g.res !== 'goal' || g.scorer !== 'me') { m.x += m.vx * s; m.z += m.vz * s; m.cycle += (Math.hypot(m.vx, m.vz) * s) / 2.5 }
    const b = g.bl
    if (g.res === 'tackled' && !g.shot) { b.vx = b.vx * 0.97 + (g.df.dx ?? 0) * 0.2; b.vz = b.vz * 0.97 + (g.df.dz ?? 0) * 0.2 }
    if ((g.res === 'claimed' || g.res === 'smothered') && !g.shot) { b.x = lerp(b.x, g.gk.x, 0.2); b.z = lerp(b.z, g.gk.z - 0.3, 0.2); b.vx = 0; b.vz = 0; b.owner = 'gk' }
  }
  function keeperAfter(s) { const K = g.gk; K.vx *= 0.9; K.vz *= 0.9; K.x += K.vx * s; K.z += K.vz * s }
  function defenderAfter(s) {
    const d = g.df
    if (d.st === 'slide') { const a = g.t - d.at, f = clamp(a / SLIDE_MS, 0, 1); d.x += d.dx * SLIDE_GO * 2.4 * (1 - f) * s; d.z += d.dz * SLIDE_GO * 2.4 * (1 - f) * s; if (a > SLIDE_MS) { d.st = 'down'; d.at = g.t } return }
    d.vx *= Math.exp(-s / 0.3); d.vz *= Math.exp(-s / 0.3); d.x += d.vx * s; d.z += d.vz * s; d.cycle += (Math.hypot(d.vx, d.vz) * s) / 2.6
  }
  function finish() {
    const goal = g.res === 'goal', s = g.shot
    let q = 0.15
    if (goal) q = clamp(0.62 + (s?.timed === 'green' ? 0.16 : 0) + (s?.type === 'chip' || s?.type === 'finesse' ? 0.08 : 0) + (Math.abs(s?.to.x ?? 0) > POST - 1 ? 0.08 : 0) + (g.take && g.gk.beatenAt ? 0.1 : 0) + (s?.mate ? -0.12 : 0), 0, 1)
    else q = clamp(0.08 + (g.res === 'saved' ? 0.17 : g.res === 'wide' || g.res === 'over' ? 0.1 : 0.04), 0, 0.4)
    g.done = outcome(q, goal, g.why); g.doneAt = g.t
    g.outro = goal ? celebMs() + 300 : lightMode() ? 1100 : 2200
    const word = { goal: 'GOAL', saved: 'SAVED', wide: 'WIDE', over: 'OVER THE BAR', tackled: 'TACKLED', claimed: 'CLAIMED', smothered: 'SMOTHERED', blocked: 'BLOCKED', out: 'OUT OF PLAY' }[g.res]
    g.stamp = { text: word, good: goal, at: g.t, size: word.length > 9 ? 38 : 50 }
    if (goal) { g.popAt = g.t; g.fx.push('h:success') } else g.fx.push(g.res === 'saved' || g.res === 'claimed' || g.res === 'smothered' ? 'catchball' : 'deny', 'h:heavy')
  }
  return g
}
const HALF_W_ = 33.5

// the controls on a touch screen, in the screen's units
const CTL = new Map()
export function ctlOf(h) {
  let c = CTL.get(h)
  if (!c) { c = { stick: { x: 82, y: h - 96, R: 44 }, shoot: { x: 360 - 66, y: h - 92, r: 42 }, chip: { x: 360 - 162, y: h - 62, r: 28 } }; CTL.set(h, c) }
  return c
}

// ── The picture ─────────────────────────────────────────────────────────────
function ballNow(g) {
  const b = g.bl, s = g.shot
  if (s) {
    const a = g.t - s.at
    if (s.block != null && a >= s.block * s.T) { const p = shotAt(s, s.block * s.T), f = clamp((a - s.block * s.T) / 600, 0, 1); return { x: p.x + f * 2.5, y: 0.11 + Math.sin(f * Math.PI) * 1.4, z: p.z - f * 3, spin: a / 40 } }
    if (s.save?.saved && a >= s.save.f * s.T) {
      const p = shotAt(s, s.save.f * s.T), f = clamp((a - s.save.f * s.T) / 520, 0, 1)
      if (s.save.held) return { x: g.gk.x + 0.1, y: 0.9, z: g.gk.z - 0.25, spin: 0, held: true }
      const sd = Math.sign(p.x - g.gk.x) || 1
      return { x: p.x + sd * f * 3, y: Math.max(0.11, p.y + Math.sin(f * Math.PI) * 0.9), z: lerp(p.z, p.z - 2.4, f), spin: a / 30 }
    }
    if (a < s.T) return shotAt(s, a)
    const after = a - s.T
    if (g.res === 'goal' || (!g.res && s.onTarget)) {
      const f = clamp(after / 220, 0, 1), drop = clamp((after - 200) / 400, 0, 1)
      const held = g.res === 'goal' && g.kHold
      if (held) return { x: g.kHold.x, y: 0.85, z: g.kHold.z - 0.25, spin: 0, held: true }
      return { x: s.to.x * (1 + f * 0.08), y: Math.max(0.11, s.to.y - drop * drop * s.to.y * 1.1), z: lerp(0, NET_D - 0.3, easeOut(f)), spin: 10 }
    }
    const f = clamp(after / 600, 0, 1)
    return { x: s.to.x + Math.sign(s.to.x) * f * 1.5, y: Math.max(0.11, s.to.y + f * (s.over ? 1.2 : 0)), z: f * 5, spin: 10 }
  }
  return { x: b.x, y: 0.11, z: b.z, spin: b.spin, held: b.owner === 'gk' }
}
function strikerPose(g) {
  const m = g.me, k = g.k, sp = Math.hypot(m.vx, m.vz)
  if (g.res === 'goal' && g.scorer === 'me' && g.cel) return null
  if (g.res && g.res !== 'goal') {
    const a = g.t - g.resAt
    if (g.res === 'tackled') { const f = prog(a, 0, 350); if (f < 1) return { ...dribblePose(m.cycle % 1, 1), rot: f * 1.2 * (g.df.x < m.x ? 1 : -1), hy: 53 - f * 22 }; return strikerDenied('tackle', a - 600, { ...POSE.knees, rot: 0 }) }
    const base = g.shot && a < 300 ? kickPose(1) : dribblePose(m.cycle % 1, clamp(sp / 6, 0, 1))
    return strikerDenied(g.res === 'saved' || g.res === 'over' || g.res === 'wide' ? 'save' : 'miss', a - 250, base)
  }
  if (g.shot && !g.shot.mate) { const a = g.t - g.shot.at; if (a < 320) return kickPose(0.45 + 0.55 * easeOut(a / 320), 1, { high: g.shot.type === 'chip' }) ; if (a < 700) return mix(kickPose(1), runPose(m.cycle % 1, 0.4), (a - 320) / 380) }
  if (k.phase === 'power' || k.phase === 'strike') {
    // shaping to shoot: the backswing as the bar fills
    const f = k.phase === 'power' ? clamp((g.t - k.at) / k.fill, 0, 1) : 1
    if (Math.hypot(g.bl.x - m.x, g.bl.z - m.z) < 1.8) return kickPose(0.42 * f, 1)
  }
  const k2 = clamp(sp / 7.5, 0, 1)
  return { ...(sp > 6.9 ? runPose(m.cycle % 1, k2, null, { lean: m.lean }) : dribblePose(m.cycle % 1, k2, { lean: m.lean })) }
}
function keeperPose(g) {
  const K = g.gk, t = g.t
  if (g.res) {
    const a = g.t - g.resAt
    if (g.res === 'goal' && g.cel) return null
    if (g.res === 'saved' || g.res === 'claimed' || g.res === 'smothered') {
      const sv = g.shot?.save
      const base = sv && !sv.held ? { ...POSE.dive, rot: (Math.sign(sv.x - K.x) || 1) * 1.3 } : g.res === 'saved' ? { ...POSE.set, hlx: -6, hly: -64, hrx: 6, hry: -64 } : { ...POSE.smother, rot: K.side * 1.2 }
      return a < 500 ? base : keeperRoar(a - 500, base)
    }
    if (g.res === 'wide' || g.res === 'over') return mix(POSE.set, POSE.hips, easeOut(prog(a, 300, 700)))
    return mix(POSE.set, POSE.stand, easeOut(prog(a, 200, 600)))
  }
  if (g.shot?.save) {
    // the dive for it
    const a = g.t - g.shot.at, f = clamp(a / Math.max(160, g.shot.save.f * g.shot.T), 0, 1), sd = Math.sign(g.shot.save.x - K.x) || 1
    return f < 0.2 ? POSE.set : { ...POSE.dive, rot: sd * 1.35 * easeOut((f - 0.2) / 0.8) }
  }
  if (g.shot && g.shot.onTarget) {
    const a = g.t - g.shot.at, f = clamp(a / g.shot.T, 0, 1), sd = Math.sign(g.shot.to.x - K.x) || 1
    return f < 0.25 ? POSE.set : { ...POSE.dive, rot: sd * 1.3 * easeOut((f - 0.25) / 0.75) }
  }
  if (K.st === 'down') { const a = prog(t - K.at, 0, 300); return mix(POSE.set, { ...POSE.smother, rot: K.side * 1.25 }, easeOut(a)) }
  if (K.st === 'rush') return { ...runPose(K.cycle % 1, 1), hlx: -22, hly: -60, hrx: 22, hry: -60 }
  if (K.st === 'set') return { ...POSE.set, lean: K.lean * 0.12, hy: 44 + Math.abs(Math.sin(t / 150)) * 1.2 }
  if (K.st === 'out') return { ...runPose(K.cycle % 1, 0.8), hlx: -22, hly: -60, hrx: 22, hry: -60 }
  return { ...POSE.ready, hy: 49 + Math.abs(Math.sin(t / 170)) * 2 }
}
function defenderPose(g) {
  const d = g.df
  if (d.st === 'slide') { const f = prog(g.t - d.at, 0, 160); return { ...mix(runPose(d.cycle % 1, 1), { ...POSE.slide, hy: 20, lk: 0, rk: 0, lx: -18, ly: -6, rx: 24, ry: -14, hlx: -34, hly: -44, hrx: 28, hry: -58, face: 0, tilt: 0 }, f), rot: (d.dx ?? 0) > 0 ? -0.9 * f : 0.9 * f } }
  if (d.st === 'down') { const a = g.t - d.at; return a < 500 ? { ...POSE.slide, hy: 18, lk: 0, rk: 0, rot: (d.dx ?? 0) > 0 ? -0.9 : 0.9, face: 0, tilt: 0 } : mix(POSE.knees, POSE.stand, prog(a, 500, 900)) }
  if (g.res === 'goal') return defenderBeaten(0, g.t - g.endAt, runPose(d.cycle % 1, 0.5))
  if (g.res) return mix(runPose(d.cycle % 1, 0.5), POSE.stand, easeOut(prog(g.t - g.resAt, 0, 500)))
  return runPose(d.cycle % 1, clamp(Math.hypot(d.vx, d.vz) / 7.5, 0.3, 1))
}
export function draw(ctx, g, view) {
  g.vh = view.h; g.keysView = !!view.keys
  const C = camOf(view, { x: g.camX, y: 5.4, z: g.camZ, F: 480, hzAt: 0.13 })
  const K = kitsOf(view), team = [view.colors.us, view.colors.trim], away = [view.colors.them, view.colors.themTrim ?? '#f4efe6']
  stadium(ctx, view, C, { team, away, board: boardWords(g) })
  if (g.popAt != null && !view.empty) { crowdUp(ctx, C, team, g.t - g.popAt, 2400, away); flashes(ctx, C, view, g.t - g.popAt) }
  const b = ballNow(g), s = g.shot
  const ripple = g.res === 'goal' && s ? { x: s.to.x, y: s.to.y, at: s.at + s.T + 80 } : null
  net(ctx, C, ripple, g.t)
  if (b.z > 0.05 && !b.held) ball(ctx, C, b.x, b.y, b.z, b.spin)
  goalFrame(ctx, C)
  const meLook = dress(K.us, g.who.me ?? { number: 9 }), gkLook = dress(K.gk, g.who.gk ?? { number: 1, skin: '#c09060' }, { front: true, sleeves: true })
  const dfLook = dress(K.them, g.who.def ?? { number: 4, skin: '#5e3c22' }), mtLook = dress(K.us, g.who.mate ?? { number: 11, skin: '#f0c4a0' })
  const list = []
  const age = g.endAt != null ? g.t - g.endAt : -1
  // the keeper (beaten: down, then into the net for the ball)
  if (g.res === 'goal' && g.cel) {
    const kb = keeperBeaten(g.cel, age, g.kAt)
    g.kHold = kb.holds ? { x: kb.x, z: kb.z } : null
    list.push({ z: kb.z, fn: () => man(ctx, C, kb.x, kb.z, kb.pose, { ...gkLook, front: kb.front }) })
  } else list.push({ z: g.gk.z, fn: () => man(ctx, C, g.gk.x, g.gk.z, keeperPose(g), gkLook, { lift: g.shot?.save && !g.res ? 0.3 * Math.sin(clamp((g.t - g.shot.at) / g.shot.T, 0, 1) * Math.PI) : 0 }) })
  // you (or off celebrating), your mate, the defender
  if (g.res === 'goal' && g.cel) {
    const sc = scorerAt(g.cel, age)
    const scorerLook = g.scorer === 'mate' ? mtLook : meLook
    list.push({ z: sc.z, fn: () => man(ctx, C, sc.x, sc.z, sc.pose, scorerLook, { lift: sc.lift, turn: sc.turn, name: g.scorer === 'me' ? g.who.me?.name : null }) })
    g.cel.mates.forEach((m, i) => {
      const at = mateAt(g.cel, i, age, sc), look = i === 0 ? (g.scorer === 'mate' ? meLook : mtLook) : dress(K.us, { number: [7, 10, 8][i], skin: ['#5e3c22', '#c09060', '#8d5a3b'][i] })
      if (i > 0 && age < m.delay) return
      if (i === 0 && !g.mt && g.scorer === 'me') return
      list.push({ z: at.z, fn: () => man(ctx, C, at.x, at.z, at.pose, look, { lift: at.lift, turn: at.turn, name: i === 0 && g.scorer === 'mate' ? g.who.me?.name : null }) })
    })
  } else {
    const mp = strikerPose(g)
    if (mp) list.push({ z: g.me.z, fn: () => man(ctx, C, g.me.x, g.me.z, mp, meLook, { name: g.who.me?.name }) })
    if (g.mt) list.push({ z: g.mt.z, fn: () => man(ctx, C, g.mt.x, g.mt.z, g.shot?.mate && g.t - g.shot.at < 320 ? kickPose(0.45 + 0.55 * (g.t - g.shot.at) / 320, 1) : runPose(g.mt.cycle % 1, 0.9, null, g.mt.on && !g.res ? { arms: 'wide' } : null), mtLook) })
  }
  list.push({ z: g.df.z, fn: () => man(ctx, C, g.df.x, g.df.z, defenderPose(g), dfLook) })
  if (b.z <= 0.05 && !b.held) list.push({ z: b.z - 0.01, fn: () => ball(ctx, C, b.x, b.y, b.z, b.spin) })
  list.sort((p, q) => q.z - p.z)
  for (const m of list) m.fn()
  if (b.held) ball(ctx, C, b.x, b.y, b.z, b.spin, 0, false)
  // the aim, on the goal, while he's lining it up
  if ((g.k.phase === 'power' || g.k.phase === 'strike') && !g.res) {
    const a = g.k.aim
    aimMark(ctx, C, a.x * (POST - 0.7), g.k.type === 'low' ? 0.25 : g.k.type === 'chip' ? lerp(1.1, 2.0, (a.y + 1) / 2) : lerp(0.3, BAR - 0.45, (a.y + 1) / 2))
  }
  if (g.res === 'goal' && g.done && !g.kicked) { g.kicked = true; g.nudge.kick(g.t, 2.5, 0, 1, 180) }
  // the word on the play
  if (g.word && !g.res) {
    const p = P(C, g.me.x, 2.4, g.me.z)
    if (p.ok) { const al = clamp(1 - (g.t - g.word.at - 700) / 400, 0, 1); ctx.globalAlpha = al; tag(ctx, g.word.text, p.x, p.y - 8); ctx.globalAlpha = 1 }
  }
  shotHud(ctx, view, g.k, { t: g.t, y: view.keys ? view.h - 70 : view.h - 186 })
  drawControls(ctx, view, g)
  placeStamp(g.stamp, view)
}
function tag(ctx, str, x, y) {
  ctx.font = `13px ${LABEL}`
  const w = ctx.measureText(str).width + 14 + str.length
  ctx.fillStyle = 'rgba(6,8,10,.8)'; rr(ctx, x - w / 2, y - 10, w, 20, 3); ctx.fill()
  text(ctx, str, x, y + 0.5, { size: 13, track: 1, color: '#f2f2ee' })
}
function drawControls(ctx, view, g) {
  const B = ctlOf(view.h), c = g.ctl, s = g.stickOut, live = !g.done
  if (view.keys) {
    const y = view.h - 22
    ctx.fillStyle = 'rgba(6,8,10,.78)'; rr(ctx, 8, y - 15, view.w - 16, 30, 4); ctx.fill()
    keyCap(ctx, 34, y, 'ARROWS'); text(ctx, 'MOVE', 60, y + 1, { size: 13, align: 'left', track: 1 })
    keyCap(ctx, 140, y, 'SPACE'); text(ctx, 'SHOOT', 178, y + 1, { size: 13, align: 'left', track: 1 })
    keyCap(ctx, 248, y, 'E'); text(ctx, 'CHIP · CURL', 264, y + 1, { size: 13, align: 'left', track: 1 })
    return
  }
  const ax = c.tid != null ? c.ox : B.stick.x, ay = c.tid != null ? c.oy : B.stick.y, R = B.stick.R
  ctx.globalAlpha = live ? 1 : 0.4
  ctx.fillStyle = 'rgba(6,8,10,.45)'; circle(ctx, ax, ay, R + 6); ctx.fill()
  ctx.strokeStyle = 'rgba(242,242,238,.28)'; ctx.lineWidth = 2; circle(ctx, ax, ay, R + 6); ctx.stroke()
  ctx.fillStyle = c.tid != null || Math.hypot(s.x, s.y) > 0.1 ? '#f2f2ee' : 'rgba(242,242,238,.7)'
  circle(ctx, ax + s.x * R, ay - s.y * R, 19); ctx.fill()
  const lit = c.sid != null && live
  ctx.fillStyle = lit ? '#f2f2ee' : 'rgba(26,27,30,.92)'; circle(ctx, B.shoot.x, B.shoot.y, B.shoot.r); ctx.fill()
  ctx.strokeStyle = 'rgba(242,242,238,.25)'; ctx.lineWidth = 2; ctx.stroke()
  text(ctx, 'SHOOT', B.shoot.x, B.shoot.y + 1, { font: DISPLAY, size: 18, color: lit ? '#0b0c0e' : '#f2f2ee' })
  const cl = c.cid != null && live
  ctx.fillStyle = cl ? '#f2f2ee' : 'rgba(26,27,30,.92)'; circle(ctx, B.chip.x, B.chip.y, B.chip.r); ctx.fill()
  ctx.strokeStyle = 'rgba(242,242,238,.25)'; ctx.lineWidth = 2; ctx.stroke()
  text(ctx, 'CHIP', B.chip.x, B.chip.y + 1, { font: DISPLAY, size: 15, color: cl ? '#0b0c0e' : '#f2f2ee' })
  ctx.globalAlpha = 1
}
