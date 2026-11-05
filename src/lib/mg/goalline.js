// Fourth & goal at the five: one quick pass, for the game.
//   A receiver or a back: the agility drill and the contested catch in one. Tap CUT as the ring
//   closes on the spot (lib/mg/cone.js), then press the shoulder the ball comes over as it gets
//   there (lib/mg/catch.js). Cut on time and the man on you is a step behind; miss it and he sits on it.
//   A quarterback: the same play from the other side, thrown the way every other game throws
//   (lib/mg/throw.js): press where the ball goes, hold to put more on it. One man comes open.
// Either way it's a touchdown over the line, or a man tackled with his head across it: the spot's
// where he lands.
import { clamp, lerp, prog, outcome, rngOf, byV, easeOut, manOf, paceOf, circle, rr } from './kit.js'
import { breakupPose, dirOf, tilt, untilt, skinOf, airBall, ballShadow, warmQb, qbStance } from './art.js'
import { paintFieldFlat, looseBall, qbPose, handsFor, HOLD_MS, YD, scatterOf, catchOf, trackOf, flightOf, arcOf, inRange, turfRing, drawHoldRing, SPIKE_MS, flightAt } from './throw.js'
import { walk, put, action, fieldStage, ballInAir, teamOf } from './read.js'

export const how = {
  'goal-line': 'Tap CUT as the ring closes on the spot. Then press the shoulder the ball comes over as it gets to you. At quarterback: press where the ball goes.',
}

const GOAL = 5                // yards from the line of scrimmage
const BODY = 2                // he falls forward: the spot's at his head, this far past his feet
const PYD = 11                // flat-field units a yard, on this camera
const XU = 6.45               // across the field, units a yard
const QB_Y = -5
const SET_MS = 800, RELEASE_LAG = 420   // RELEASE_LAG: a catcher's QB lets him get out of the break first
const STEM_V = 0.0112, OUT_V = 0.0125, ROUTE_V = 0.0105, RUN_V = 0.0118   // yards a ms: into the break, out of it, working back to the ball, and with it
const DEF_V = 0.0112, TACKLE_V = 0.013, CONTACT = 1, TACKLE_MS = 420
// the cut reads like the agility drill, the catch like the contested catch: their windows, their rings
const CUT_WIN = v => byV(v, 39, 78), CUT_GATE = 170
const CATCH_WIN = v => byV(v, 75, 130), CATCH_GATE = 170
const CUT_RING_MS = 420, CUT_R0 = 66, CUT_R = 28, CATCH_RING_MS = 300, CATCH_R0 = 33, CATCH_R = 12
const AIR_MS = 300, SHOULDER = 13   // the ball hangs up there, and comes down over one shoulder
const LAG_GOOD = v => byV(v, 240, 400), CONTEST_D = 1.7, CONTEST_P = 0.3, MISSED_CUT_P = 0.34
const STAND_OFF = 1.25  // before the ball's there a defender's on his hip, not in him
const CATCHER_PACE = 0.62  // playing the catch, the whole play runs at this: there are two presses to make in it
const QB_DROP = 0.7, RUSH_V = 0.0085, SACK_D = 1.1, PULL_UP = 1.7  // the man who beats his block: how fast, how close is a sack, and where he stops once it's gone

// [start, the break, where the route goes from there] in (x, yards from the line). All on one side; the play can be flipped
const ROUTES = {
  wr: [
    { name: 'SLANT', a: [46, 0], b: [46, 2.4], c: [216, 13] },
    { name: 'QUICK OUT', a: [70, 0], b: [70, 3.8], c: [14, 4.6] },
    { name: 'QUICK CORNER', a: [70, 0], b: [70, 3], c: [14, 13] },
  ],
  te: [
    { name: 'STICK', a: [118, 0], b: [118, 3.4], c: [64, 4.2] },
    { name: 'SEAM SLANT', a: [118, 0], b: [118, 2.2], c: [214, 13] },
  ],
  rb: [
    { name: 'FLAT', a: [232, QB_Y + 0.6], b: [284, -1.6], c: [346, 8] },
    { name: 'OUT', a: [232, QB_Y + 0.6], b: [254, 1.2], c: [346, 3] },
    { name: 'TEXAS', a: [232, QB_Y + 0.6], b: [272, 0.5], c: [130, 12] },
  ],
}
// when it isn't for him: he clears out, straight up the field
const clearOut = x => ({ name: 'CLEAR', a: [x, 0], b: [x, 2.6], c: [x, 14] })
const STAY_IN = { name: 'BLOCK', a: [232, QB_Y + 0.6], b: [226, -2.4], c: [226, -2.4] }
const gaussOf = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const dist = (ax, ay, bx, by) => Math.hypot((ax - bx) / XU, ay - by)
function seek(p, tx, ty, v, dt) {
  const dx = (tx - p.x) / XU, dy = ty - p.y, e = Math.hypot(dx, dy)
  if (e < 0.02) return
  const mv = Math.min(e, v * dt)
  p.x += (dx / e) * mv * XU; p.y += (dy / e) * mv
}
// who you are: asked for by name, else the man the career put in the roster, else any of the four
function roleOf(pos, cast, r) {
  if (['qb', 'rb', 'wr', 'te'].includes(pos)) return pos
  for (const k of ['qb', 'rb', 'wr', 'te']) if (cast?.us?.[k]?.[0]?.me) return k
  return ['qb', 'wr', 'te', 'rb'][Math.floor(r() * 4)]
}

export function make({ v, arm = v, seed, game, pos = null, cast = null }) {
  const r = rngOf(seed)
  const role = roleOf(pos, cast, r)
  const flip = r() < 0.5, Mx = x => (flip ? 360 - x : x)
  const K = role === 'qb' ? 1 : CATCHER_PACE
  const pick = list => list[Math.floor(r() * list.length)]
  const snapAt = SET_MS + r() * 500
  const pace = (group, i) => paceOf(cast, 'us', group, i)
  const mkRec = (id, group, i, route, side) => {
    const X = x => Mx(side > 0 ? 360 - x : x)
    const ax = X(route.a[0]), ay = route.a[1], bx = X(route.b[0]), by = route.b[1]
    const stem = Math.hypot((bx - ax) / XU, by - ay)
    const breakAt = snapAt + Math.max(430 / K, stem / (STEM_V * K))
    return { id, group, i, name: route.name, ax, ay, bx, by, cx: X(route.c[0]), cy: route.c[1], breakAt, cutAt: null, cutX: 0, cutY: 0, x: ax, y: ay, v: OUT_V * K * pace(group, i), run: RUN_V * K * pace(group, i), carry: false, track: false }
  }
  const pickT = list => list[Math.floor(r() * list.length)]
  // (the back's routes run on his own side: never flipped twice)
  const X = mkRec('X', 'wr', 0, role === 'qb' || role === 'wr' ? pickT(ROUTES.wr) : clearOut(46), -1)
  const Z = mkRec('Z', 'wr', 1, role === 'qb' ? pickT(ROUTES.wr) : clearOut(46), 1)
  const TE = mkRec('TE', 'te', 0, role === 'qb' || role === 'te' ? pickT(ROUTES.te) : clearOut(118), role === 'wr' ? 1 : -1)
  const RB = mkRec('RB', 'rb', 0, role === 'qb' || role === 'rb' ? pickT(ROUTES.rb) : STAY_IN, -1)
  const recs = [X, Z, TE, RB]
  const me = role === 'wr' ? X : role === 'te' ? TE : role === 'rb' ? RB : null
  if (me) me.v = ROUTE_V * K * pace(me.group, me.i)
  const open = me ?? recs[Math.floor(r() * recs.length)]
  const side = r() < 0.5 ? 0 : 1, cutWin = CUT_WIN(v)
  // the man on each of them, on his inside shoulder, a little off. A man who's beaten chases
  const defs = recs.map((p, k) => {
    const lev = (p.bx < 180 ? 1 : -1) * 12
    return { id: `D${k}`, x: p.group === 'rb' ? p.bx : p.ax + lev, y: Math.max(p.ay + 3, 3), lev, on: p, chaseAt: Infinity }
  })
  const lbs = [{ x: Mx(132), y: 4.1 }, { x: Mx(228), y: 4.1 }]
  const QB = { x: Mx(180), y: QB_Y }
  const OL = [-2, -1, 0, 1, 2].map(i => ({ x: Mx(180 + i * 30), y: -0.4 }))
  const DL = [-1.5, -0.5, 0.5, 1.5].map(i => ({ x: Mx(180 + i * 34), y: 0.8 }))
  const sackAt = snapAt + byV(v, 1650, 2300)   // about when a man who's beaten his block gets there
  const rushI = Math.floor(r() * DL.length), rusher = DL[rushI]
  const reach = catchOf(v) + 2, scat = scatterOf(v), track = trackOf(v)
  const g = {
    t: 0, game, role, zones: 'none', aim: !me, pads: me ? ['CUT'] : null, padLit: null, fx: [], done: null, outro: 1500, stamp: null,
    snapAt, flip, recs, me, open, side, cutWin, defs, lbs, QB, OL, DL, los: 400, cam: { w: 360, h: 700 },
    K, phase: 'set', ball: null, hold: null, tryCatch: null, res: null, q: 0, win: CATCH_WIN(v), who: castOf(cast, role),
    hud: { prompt: '4TH & GOAL', dots: [null] },
    screenOf(x, fy) { return tilt(g.cam, x, g.los - fy * PYD) },
    project(p, ms, o = {}) { posAt(p, g.t + ms, o); return o },
    airTo(x, y, pw) { return flightOf('goal-line', arm, Math.hypot(x - QB.x, (y - QB.y) * YD), pw) },
    power() { return g.hold ? clamp((g.t - g.hold.at) / HOLD_MS, 0, 1) : 0 },
    keyTargets: me ? undefined : () => {
      if (g.phase !== 'run') return null
      return recs.map(p => { const q = tilt(g.cam, p.x, g.los - p.y * PYD); return { x: q.x, y: q.y - 15 * q.s } })
    },
    tick(dt) {
      g.t += dt
      if (g.t - (g.litAt ?? -999) > 110) g.padLit = null
      if (g.phase === 'set') {
        if (g.t >= snapAt) { g.phase = 'run'; g.hud.prompt = me ? null : 'PRESS WHERE THE BALL GOES'; g.fx.push('whistle') }
        return
      }
      step(dt)
      if (g.phase === 'run') {
        if (me && me.cutAt == null && g.t >= me.breakAt + cutWin + 60) cut(me)
        // the ball's up: the pad for that shoulder lights until it's decided
        if (me && g.ball && g.padLit == null) g.padLit = side
        if (me && me.cutAt != null && !g.ball && g.t >= me.cutAt + RELEASE_LAG) throwToMe()
        if (!me && g.hold && g.power() >= 1) letGo()
      }
      if (g.ball && !g.res) {
        const b = g.ball
        if (me) {
          if (g.t >= b.land && (g.tryCatch || g.t >= b.land + g.win + 40)) settleCatch()
        } else if (g.t >= b.land) settleThrow()
      }
    },
    input(a) {
      if (g.done || g.res) return
      if (me) {
        if (a.kind !== 'down' || g.phase !== 'run') return
        if (me.cutAt == null) {
          g.padLit = 0; g.litAt = g.t
          // a press well before the spot is nothing: only the press that means this one counts
          if (g.t - me.breakAt < -(cutWin + CUT_GATE)) { g.fx.push('h:light'); return }
          cut(me)
          return
        }
        const sd = a.zone === 'L' ? 0 : a.zone === 'R' ? 1 : null
        if (sd == null || g.tryCatch || !g.ball) return
        g.padLit = sd; g.litAt = g.t
        const off = Math.abs(g.t - g.ball.land)
        if (off > g.win + CATCH_GATE) { g.fx.push('h:light'); return }
        g.tryCatch = { ok: sd === side && off <= g.win, why: sd !== side ? 'swat' : g.t < g.ball.land ? 'early' : 'late' }
        return
      }
      if (g.phase !== 'run' || g.ball) return
      if (a.kind === 'down' && !g.hold) {
        const f = aimOf(a)
        const m = inRange({ x: QB.x, y: QB.y * YD }, clamp(f.x, 10, 350), f.y * YD, arm)
        g.hold = { fx: m.x, fy: m.y / YD, at: g.t }
        g.hud.prompt = 'LET GO TO THROW'
        g.fx.push('h:light')
      } else if (a.kind === 'up' && g.hold) letGo()
    },
  }
  function aimOf(a) {
    const f = untilt(g.cam, a.x, a.y)
    if (!a.exact) {
      let best = null, bd = Infinity
      for (const p of recs) {
        const q = tilt(g.cam, p.x, g.los - p.y * PYD)
        if (Math.abs(a.x - q.x) < 13 * q.s && a.y < q.y + 4 * q.s && a.y > q.y - 32 * q.s) {
          const e = Math.abs(a.x - q.x) + Math.abs(a.y - (q.y - 15 * q.s))
          if (e < bd) { bd = e; best = p }
        }
      }
      if (best) return { x: best.x, y: best.y }
    }
    return { x: f.x, y: (g.los - f.y) / PYD }
  }
  // where a route has him at time t: closed form, so a throw can lead him
  function posAt(p, t, o) {
    if (t <= snapAt) { o.x = p.ax; o.y = p.ay; return o }
    const c = p.cutAt ?? (me === p ? null : p.breakAt)
    if (c == null || t <= c) {
      const f = (t - snapAt) / (p.breakAt - snapAt)
      o.x = lerp(p.ax, p.bx, f); o.y = lerp(p.ay, p.by, f)
      return o
    }
    const f0 = (c - snapAt) / (p.breakAt - snapAt), sx = lerp(p.ax, p.bx, f0), sy = lerp(p.ay, p.by, f0)
    const dx = (p.cx - sx) / XU, dy = p.cy - sy, e = Math.hypot(dx, dy) || 1, s = Math.min(e, (t - c) * p.v)
    o.x = sx + (dx / e) * s * XU; o.y = sy + (dy / e) * s
    return o
  }
  function cut(p) {
    p.cutAt = g.t
    // the agility drill's rule: in the ring it's clean, out of it he's rounded it off
    g.q = Math.abs(g.t - p.breakAt) <= cutWin ? 1 : 0
    const d = defs[recs.indexOf(p)]
    // on time he's a step behind it. Not, and he's sitting on the route
    d.chaseAt = g.t + (g.q ? LAG_GOOD(v) / K : -40)
    g.hud.prompt = null
    g.zones = 'lr'
    g.pads = ['LEFT SHOULDER', 'RIGHT SHOULDER']
    g.padLit = null
    g.fx.push('tap', 'h:light')
  }
  function launch(tx, ty, lx, ly, pw, flight, target) {
    g.ball = { tx, ty, lx, ly, pw, x0: QB.x, y0: QB.y, H: arcOf(Math.hypot(lx - QB.x, (ly - QB.y) * YD), pw) * (PYD / YD), at: g.t, land: g.t + flight, flight, target, trackAt: g.t + flight - Math.min(flight * 0.7, track + 130) }
    g.fx.push('swoosh', pw > 0.8 ? 'h:medium' : 'h:light')
  }
  // the QB, when you're not him: right on the money, to where you'll be
  function throwToMe() {
    const o = {}
    posAt(me, g.t + AIR_MS / K, o)
    // (over the shoulder that's on that side of the screen: ball, catch point and pad all agree)
    const lx = o.x + (side ? SHOULDER : -SHOULDER)
    launch(lx, o.y, lx, o.y, 1, AIR_MS / K, me)   // (a bullet)
    g.hud.prompt = null
  }
  function letGo() {
    const pw = g.power(), h = g.hold
    g.hold = null
    const lx = clamp(h.fx + gaussOf(r) * scat, 6, 354), ly = h.fy + (gaussOf(r) * scat) / YD
    const air = g.airTo(lx, ly, pw)
    let best = null, bd = Infinity
    const o = {}
    for (const p of recs) { posAt(p, g.t + air, o); const e = Math.hypot(o.x - lx, (o.y - ly) * YD); if (e < bd) { bd = e; best = p } }
    launch(h.fx, h.fy, lx, ly, pw, air, best)
    g.hud.prompt = null
  }
  function sacked() {
    g.res = { why: 'sack', at: g.t }
    g.phase = 'over'; g.hud.prompt = null; g.hud.dots[0] = false
    g.done = outcome(0, false, 'The rush got there.', { made: 0, of: 1 }, true)
    g.stamp = { text: 'SACKED', good: false, at: g.t + 300 }
    g.fx.push('pop', 'h:heavy')
  }
  function settleCatch() {
    const t = g.tryCatch
    if (!t) return miss(me, 'late')
    if (!t.ok) return miss(me, t.why, t.why === 'swat' ? defs[recs.indexOf(me)] : null)
    // cut clean, he's clear of the man. Missed the cut, and it's a fight for it
    if (!g.q && r() >= MISSED_CUT_P) return miss(me, 'swat', defs[recs.indexOf(me)])
    caught(me)
  }
  function settleThrow() {
    const b = g.ball, tp = b.target
    const rr2 = Math.hypot(tp.x - b.lx, (tp.y - b.ly) * YD), forward = b.ly > tp.y
    const has = rr2 <= reach * (forward ? 1.3 : 1)
    let dq = null, dd = Infinity
    for (const d of defs) { const e = dist(d.x, d.y, b.lx, b.ly); if (e < dd) { dd = e; dq = d } }
    const closeBy = dd <= CONTEST_D * 0.9
    if (has && !closeBy) return caught(tp)
    if (has) return r() < CONTEST_P + (tp === open ? 0.15 : 0) ? caught(tp) : miss(tp, 'swat', dq)
    if (closeBy) return miss(tp, 'swat', dq)
    miss(tp, b.ly > tp.y + 1 ? 'over' : b.ly < tp.y - 1 ? 'under' : 'wide')
  }
  function caught(p) {
    p.carry = true
    g.res = { why: 'catch', at: g.t, who: p }
    g.phase = 'over'; g.hud.prompt = null
    g.padLit = null
    g.fx.push('tap', 'h:medium')
  }
  function miss(p, why, d = null) {
    g.res = { why, at: g.t, who: p, dq: d, x: g.ball.lx, y: g.ball.ly }
    g.phase = 'over'; g.hud.prompt = null; g.hud.dots[0] = false
    g.padLit = null
    const word = { early: 'TOO SOON', late: 'DROPPED', swat: 'BROKEN UP', over: 'OVERTHROWN', under: 'UNDERTHROWN', wide: 'INCOMPLETE' }[why]
    g.done = outcome(why === 'swat' ? 0.25 : 0.15, false, 'Turned over on downs.', { made: 0, of: 1 })
    g.stamp = { text: word, good: false, at: g.t + 120 }
    g.fx.push('pop', 'h:medium')
  }
  function endIt(td, y) {
    g.hud.dots[0] = td
    const short = Math.max(1, Math.ceil(GOAL - y))
    g.done = outcome(td ? 0.65 + 0.35 * (me ? g.q : 1) : 0.3, td, td ? 'Touchdown.' : `Stopped ${short} short.`, { made: td ? 1 : 0, of: 1 })
    g.stamp = { text: td ? 'TOUCHDOWN' : 'STOPPED', good: td, at: g.t + (g.res?.who?.tk ? 340 : td ? 40 : 200) }   // (brought down: the word comes when he's landed, and the spot's where his head is)
    g.fx.push(td ? 'tap' : 'pop', 'h:heavy')
    if (td && !g.res?.who?.tk) g.tdAt = g.t + 180
  }
  function step(dt) {
    const res = g.res, rt = g.t - snapAt
    const f = clamp(rt / (sackAt - snapAt), 0, 1)
    OL.forEach((o, i) => { o.y = -0.4 - f * (i === 0 || i === 4 ? 1.7 : 1) })
    DL.forEach((d, i) => { if (d.free == null) d.y = 0.7 - f * (i === 0 || i === 3 ? 2.6 : 1.2) })
    // one of them beats his man in time to get there, and it's only a sack when he does
    if (!me) {
      const qy = QB.y - QB_DROP, away = dist(rusher.x, rusher.y, QB.x, qy)   // (to where he's dropped back to)
      if (rusher.free == null && !res && !g.ball && g.t >= sackAt - away / RUSH_V) { rusher.free = g.t; g.rusher = rusher }
      if (rusher.free != null) {
        if (res?.why === 'sack') seek(rusher, QB.x, qy + 0.5, 0.004, dt)
        else if (res || g.ball) { if (away > PULL_UP) seek(rusher, QB.x, qy, RUSH_V * 0.45, dt) }
        else { seek(rusher, QB.x, qy, RUSH_V, dt); if (dist(rusher.x, rusher.y, QB.x, qy) <= SACK_D) sacked() }
      }
    }
    lbs.forEach(l => { if (!res) seek(l, l.x, 3.6, 0.002, dt) })   // (holding their spots at the goal line until there's a man to tackle)
    const A = {}
    const b = g.ball
    for (const p of recs) {
      if (p.carry) {
        if (p.tk) { p.y = Math.min(p.tk.end, p.y + dt * 0.0016); continue }
        seek(p, p.x + (p.x < 180 ? 8 : -8), GOAL + 3, p.run, dt)
        if (p.y >= GOAL && !g.done) endIt(true, p.y)
        continue
      }
      if (!me && b && !res && p === b.target && g.t >= b.trackAt) { seek(p, b.lx, b.ly, p.v * 1.2, dt); continue }
      if (res) { const k = clamp(1 - (g.t - res.at) / 500, 0, 1); if (k > 0) { posAt(p, g.t, A); const s = dt * p.v * k; seek(p, A.x, A.y, s / Math.max(dt, 1), dt) } continue }
      if (me !== p && p.cutAt == null && g.t >= p.breakAt) {
        p.cutAt = p.breakAt
        const d = defs[recs.indexOf(p)]
        d.chaseAt = p === open && !me ? p.breakAt + LAG_GOOD(v) * 0.55 : p.breakAt - 60
      }
      posAt(p, g.t, A); p.x = A.x; p.y = A.y
    }
    const carrier = res?.why === 'catch' ? res.who : null
    defs.forEach(d => {
      const p = d.on
      if (g.done?.hit) return   // a touchdown: nobody keeps chasing him
      if (carrier) {
        // everyone rallies to the ball
        seek(d, carrier.x, carrier.y, TACKLE_V * K * paceOf(cast, 'them', 'db', 0), dt)
        if (!carrier.tk && !g.done && dist(d.x, d.y, carrier.x, carrier.y) <= CONTACT) tackle(carrier, d)
      } else if (p.cutAt != null && g.t < d.chaseAt) {
        // caught leaning: he's still going the way the route was, a step, then he turns
        seek(d, d.x, d.y + 1, 0.002, dt)
      } else if (p.cutAt == null) {
        seek(d, p.x + d.lev, Math.max(p.y + 2, 2.2), 0.0078 * K, dt)
      } else {
        const e = dist(d.x, d.y, p.x, p.y)
        if (e > STAND_OFF) seek(d, p.x, p.y, DEF_V * K * paceOf(cast, 'them', 'db', 0), dt)
      }
    })
    if (carrier && !carrier.tk && !g.done) {
      for (const l of lbs) {
        seek(l, carrier.x, carrier.y, 0.0085 * K, dt)
        if (dist(l.x, l.y, carrier.x, carrier.y) <= CONTACT) { tackle(carrier, l); break }
      }
    }
    if (g.done && !carrier?.tk) { /* over the line: he trots on */ }
  }
  function tackle(p, by) {
    p.tk = { at: g.t, by, end: p.y + 0.6, side: by.x <= p.x ? -1 : 1 }
    const head = p.tk.end + BODY
    g.outro = 1500 + TACKLE_MS
    endIt(head >= GOAL, head)
  }
  return g
}

// the real men
function castOf(cast, role) {
  const bare = m => m && { number: m.number, skin: m.skin }
  const named = (group, i) => manOf(cast, 'us', group, i)
  const names = { QB: named('qb', 0), X: named('wr', 0), Z: named('wr', 1), TE: named('te', 0), RB: named('rb', 0) }
  const keep = { qb: 'QB', wr: 'X', te: 'TE', rb: 'RB' }[role]
  for (const k of Object.keys(names)) if (k !== keep && k !== 'QB') names[k] = bare(names[k])
  return {
    ...names,
    ol: [0, 1, 2, 3, 4].map(i => bare(manOf(cast, 'us', 'ol', i))),
    dl: [0, 1, 2, 3].map(i => bare(manOf(cast, 'them', 'dl', i))),
    db: [0, 1, 2, 3].map(i => manOf(cast, 'them', 'db', i)),
  }
}

// ── The picture ──────────────────────────────────────────────────────────
const SIZE = 0.8
const NUMS = { QB: 7, RB: 28, X: 11, Z: 15, TE: 87 }, OL_NUM = [71, 64, 55, 66, 77], DL_NUM = [94, 97, 91, 99], LB_NUM = [52, 58], DB_NUM = [24, 21, 31, 38]
const losOf = view => Math.round(untilt(view, 180, view.h - 172).y) + Math.round(QB_Y * PYD)
export function draw(ctx, g, view) {
  const c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1)
  const los = losOf(view), fl = y => los - y * PYD
  g.los = los; g.cam = view
  // (the words land in the backfield: the catch is in the end zone and stays in sight)
  if (g.stamp && g.stamp.y == null) g.stamp.y = view.h - (g.res?.why === 'sack' ? 72 : 150)
  const res = g.res, b = g.ball, since = res ? g.t - res.at : -1, sn = g.t >= g.snapAt, me = g.me, who = g.who
  fieldStage(ctx, view, `goal-line|${los}`, (f, v) => {
    paintFieldFlat(f, v, los - GOAL * PYD, PYD, c.us)
    f.fillStyle = '#3f86ff'; f.fillRect(8, los - 1.6, v.w - 16, 3.2)
    f.fillStyle = 'rgba(255,255,255,.95)'; f.fillRect(8, los - GOAL * PYD - 2, v.w - 16, 4)
  }, los - (GOAL + 10) * PYD)
  // where to cut: a ring closing on the spot, the agility drill's. The band is the window
  if (me && me.cutAt == null && !res) {
    const left = me.breakAt - g.t, rate = (CUT_R0 - CUT_R) / CUT_RING_MS, x = me.bx, y = fl(me.by)
    turfRing(ctx, view, x, y, CUT_R); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = Math.max(4, rate * g.cutWin * 2); ctx.stroke()
    if (left < CUT_RING_MS / g.K) {
      const inside = Math.abs(left) <= g.cutWin
      turfRing(ctx, view, x, y, Math.max(5, CUT_R + left * rate)); ctx.strokeStyle = inside ? '#35e07a' : '#fff'; ctx.lineWidth = inside ? 4.5 : 3.5; ctx.stroke()
    }
  }
  // the QB's routes, on the grass
  if (!me && !b && !res) {
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'
    for (const p of g.recs) {
      ctx.beginPath()
      const A = tilt(view, p.ax, fl(p.ay)); ctx.moveTo(A.x, A.y)
      const B = tilt(view, p.bx, fl(p.by)); ctx.lineTo(B.x, B.y)
      const C = tilt(view, p.cx, fl(p.cy)); ctx.lineTo(C.x, C.y)
      ctx.stroke()
    }
  }
  if (g.hold) drawHoldRing(ctx, view, g.hold.fx, fl(g.hold.fy), g.power())

  // the line
  const hitBy = res?.why === 'sack' && g.rusher ? (g.rusher.x <= g.QB.x ? 1 : -1) : 0
  g.DL.forEach((d, i) => {
    const look = { dir: 'down', skin: skinOf(i + 2), number: DL_NUM[i], size: SIZE, ...who.dl[i] }
    if (d.free == null) return put(d.x, fl(d.y), them, { ...look, pose: sn ? 'block' : 'stance' })
    // through the line with his arms up, and onto the QB
    if (hitBy) return put(d.x, fl(d.y), them, { ...look, fall: clamp(since / 320, 0, 1), fallX: hitBy })
    put(d.x, fl(d.y), them, { ...look, pose: 'arms-up', step: res ? null : Math.floor(g.t / 90) % 4 })
  })
  g.OL.forEach((o, i) => put(o.x, fl(o.y), us, { dir: 'up', pose: sn ? 'block' : 'stance', skin: skinOf(i + 9), number: OL_NUM[i], size: SIZE, ...who.ol[i] }))
  g.lbs.forEach((l, i) => { const w = walk(g, `lb${i}`, l.x, fl(l.y), 11); put(l.x, fl(l.y), them, { dir: 'down', step: w.step, pose: w.step == null ? 'ready' : null, skin: skinOf(i + 6), number: LB_NUM[i], size: SIZE }) })
  // the man on each receiver
  g.defs.forEach((d, i) => {
    const w = walk(g, d.id, d.x, fl(d.y), 11), swat = res?.dq === d && since < 300, wave = res?.dq === d && since >= 420 && res.why === 'swat'
    const man = i === g.recs.indexOf(me ?? g.open) ? who.db[i] : who.db[i] && { number: who.db[i].number, skin: who.db[i].skin }
    put(d.x, fl(d.y), them, { dir: 'down', step: swat || wave ? null : w.step, pose: wave ? breakupPose(since - 420, Math.floor(res.at)) : swat ? (b.lx < d.x ? 'swipe-l' : 'swipe-r') : w.step == null ? 'ready' : null, skin: skinOf(i + 3), number: DB_NUM[i], size: SIZE, ...man })
  })
  // the receivers, and the man with the ball going down at the spot
  g.recs.forEach(p => {
    const w = walk(g, p.id, p.x, fl(p.y), 11), look = { skin: skinOf(p.id.charCodeAt(0)), number: NUMS[p.id], ...who[p.id] }
    const o = { dir: 'up', size: SIZE, carry: p.carry, ...look }
    if (p.tk) {
      const f = clamp((g.t - p.tk.at - 40) / 300, 0, 1)
      put(p.x, fl(p.y), us, { ...o, fall: f, fallX: 0 })
    } else {
      if (g.tdAt != null && g.t >= g.tdAt && p.carry) { const a = g.t - g.tdAt; put(p.x, fl(p.y), us, { ...o, dir: 'up', step: null, pose: a < SPIKE_MS ? 'spike-up' : null, carry: a < SPIKE_MS }); return }
      const near = b && g.t >= b.land - 190 && (!res || since < 120) && p === b.target && !p.carry
      put(p.x, fl(p.y), us, { ...o, dir: sn && !near && p.cutAt != null && w.step != null ? dirOf(w.dx, w.dy) : 'up', step: !sn ? null : near ? null : w.step, pose: !sn ? 'stance' : near ? handsFor(b.lx, p.x, Math.hypot((b.lx - p.x) / XU, b.ly - p.y) < 2) : w.step == null ? 'ready' : null })
    }
  })
  // the QB
  const age = b ? g.t - b.at : -1, q = g.QB, sacked = res?.why === 'sack'
  const pose = sn && !sacked ? qbPose(g.hold ? g.power() : null, age) : null
  const fall = sacked ? clamp((since - 40) / 320, 0, 1) : 0
  // after the snap: a short drop, drawn only (the ball still goes from his spot), then set with it at his shoulder
  const qt = g.t - g.snapAt, qst = sn && !pose && !b && !sacked ? qbStance(qt) : null
  const qback = sn ? easeOut(clamp(qt / 300, 0, 1)) * PYD * QB_DROP : 0
  if (!sn) warmQb({ color: us.color, trim: us.trim, pants: us.pants ?? us.trim, skin: skinOf(9), number: NUMS.QB, kit: 'pads', ...who.QB })
  put(q.x, fl(q.y) + qback, us, { dir: pose ? 'side' : 'up', pose: qst ? qst.pose : pose, step: qst ? qst.step : null, fall, fallX: hitBy, carry: !qst && !b, skin: skinOf(9), number: NUMS.QB, size: SIZE, ...who.QB })
  action(ctx, view)

  // the ball, and when it's his to catch, the ring closing on his hands
  if (b && !res) {
    const f = prog(g.t, b.at, b.land)
    if (f < 1) {
      const air = flightAt(view, b.x0, fl(b.y0), b.lx, fl(b.ly), f, b.H)
      ballShadow(ctx, view, air.gx, air.gy, air.lift)
      airBall(ctx, air.x, air.y, { axis: air.axis, len: air.len, spin: ((g.t - b.at) / 1000) * lerp(4, 6.5, b.pw) })
    }
    if (me) {
      // the contested catch's ring, at the catch point, its band the window
      const left = b.land - g.t, a = tilt(view, b.lx, fl(b.ly)), hy = a.y - 26 * a.s, rate = (CATCH_R0 - CATCH_R) / CATCH_RING_MS
      if (left < CATCH_RING_MS / g.K && left > -g.win - 40) {
        const inside = Math.abs(left) <= g.win
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.4)'; circle(ctx, a.x, hy, CATCH_R); ctx.stroke()
        ctx.lineWidth = inside ? 3.5 : 2.5; ctx.strokeStyle = inside ? '#35e07a' : '#fff'; circle(ctx, a.x, hy, Math.max(5, CATCH_R + left * rate)); ctx.stroke()
      }
    }
  }
  const scorer = g.tdAt != null && g.t >= g.tdAt + SPIKE_MS ? g.recs.find(p => p.carry) : null
  if (scorer) looseBall(ctx, view, scorer.x + 6, fl(scorer.y), g.t - g.tdAt - SPIKE_MS, true)
  if (res && res.why !== 'catch' && res.why !== 'sack') looseBall(ctx, view, res.x, fl(res.y), since, res.why === 'swat')
}
