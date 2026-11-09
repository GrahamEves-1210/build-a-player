// HEADER: a ball into the box from the right wing. You play the run in real time.
//   lose him  move with the stick (the arrows). Your marker is touch-tight, goal-side, tracking you. Every so often
//             he turns to watch the winger: his shoulders open, he drops off half a yard, and he isn't tracking you.
//             Move then and you're away from him. Move while he's watching you and he just comes with you.
//   the run   the winger picks out where you're going: dart to the near post and it's whipped in low and quick, drift
//             to the back post and it's floated. The camera pulls out as he shapes to cross it, so you see it all
//             the way from his foot. Get under it: the ring is where it's coming down.
//   attack it press HEAD (SPACE) to go up: meet it at the top of your jump as the ring closes. Aim with the stick
//             as you go up: back across the keeper or into the near post, down into the ground or up. With your
//             marker on you he's in for it too; tight on you, he gets there first.
// Heading is the jump's window and the header's power; off-ball movement is how long he ball-watches and how slow
// he is to pick you up again.
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, easeIn, GOOD, GOLD, particles, nudge, manOf, text, rr, lightMode, LABEL } from './kit.js'
import { placeStamp } from './read.js'
import { camOf, P, stadium, net, goalFrame, ball, man, POSE, mix, runPose, kickPose, kitsOf, dress, boardWords, flashes, crowdUp, POST, BAR, NET_D,
  shooter, strikeOf, shotAt, keeperSave, aimMark, celebration, scorerAt, mateAt, keeperBeaten, defenderBeaten, keeperRoar, strikerDenied, celebMs, skipOutro, padCtl, padInput, padStick, drawPads } from './soccer.js'

export const how = {
  header: 'Lose the marker: move when he turns to watch the winger. Make the run near post or far post, get under the ring, and press HEAD as it closes. Aim with the stick on the way up.',
}

const RISE = 250                    // ms from leaving the ground to the top of the jump
const ME0 = { x: -0.8, z: -10.2 }
const ZONE = { x0: -6, x1: 4.6, z0: -13.5, z1: -4.8 }
const WING0 = { x: 23, z: -27 }, CROSS = { x: 19.5, z: -14.5 }
const KEEP_Z = -0.6

export function make({ v, seed, cast = null, situation = null }) {
  const r = rngOf(seed), tv = clamp((v - 1) / 10, 0, 1)
  const W = byV(v, 70, 150)
  const runMs = 2700 + r() * 1100            // the winger, from picking it up to the cross
  // when the marker watches the ball: a few looks, longer the better your movement, and a last long one as he crosses
  const looks = []
  let t = 700 + r() * 500
  while (t < runMs - 1100) { const d = byV(v, 260, 520) * (0.8 + r() * 0.4); looks.push({ at: t, end: t + d }); t += d + 650 + r() * 700 }
  looks.push({ at: runMs - 560, end: runMs + byV(v, 120, 380) })
  const mSpeed = byV(v, 5.5, 4.6), mLag = byV(v, 200, 340)
  const k = shooter(v, { windup: 0 })
  k.type = 'header'
  const g = {
    t: 0, game: 'header', zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 2800, stamp: null,
    sit: situation ?? null, looks, runMs, W, k,
    phase: 'mark', watching: false, glance: false,
    me: { x: ME0.x, z: ME0.z, vx: 0, vz: 0, cycle: 0 }, mk: { x: ME0.x + 0.5, z: ME0.z + 0.85, vx: 0, vz: 0, cycle: 0, turn: 0, hist: [] },
    wing: { x: WING0.x, z: WING0.z, cycle: 0 }, gk: { x: 1.4, z: KEEP_Z, vx: 0 },
    crossAt: null, flight: 0, arriveAt: null, to: null, jumpAt: null, shot: null, res: null, why: '', endAt: null, popAt: null, doneAt: null,
    sep: 0, free: false, ctl: padCtl(), vh: 640, cam: 0,
    who: { me: manOf(cast, 'us', 'st', 0), gk: manOf(cast, 'them', 'gk', 0), mark: manOf(cast, 'them', 'cb', 0), mate: manOf(cast, 'us', 'st', 1) },
    dirt: particles(24, 3), nudge: nudge(),
    hud: { prompt: 'LOSE THE MARKER' },
    tick(dt) {
      g.t += dt
      const s = dt / 1000, o = padStick(g.ctl)
      const look = looks.find(l => g.t >= l.at && g.t < l.end)
      g.watching = !!look && g.phase === 'mark'
      if (g.t > 1600 && g.hud.prompt === 'LOSE THE MARKER') g.hud.prompt = null
      // the winger: down the line with it, then the cross
      if (g.phase === 'mark') {
        const f = clamp(g.t / runMs, 0, 1)
        g.wing.x = lerp(WING0.x, CROSS.x, f); g.wing.z = lerp(WING0.z, CROSS.z, f); g.wing.cycle += 0.02 * dt / 8.33
        if (g.t >= runMs) cross()
      }
      // you: anywhere in the box, the stick
      if (!g.res && g.jumpAt == null) {
        const sp = byV(v, 4.6, 5.8), acc = 1 - Math.exp(-s / 0.12)
        g.me.vx += (o.x * sp - g.me.vx) * acc; g.me.vz += (o.y * sp - g.me.vz) * acc
        g.me.x = clamp(g.me.x + g.me.vx * s, ZONE.x0, ZONE.x1); g.me.z = clamp(g.me.z + g.me.vz * s, ZONE.z0, ZONE.z1)
      } else { g.me.vx *= 0.9; g.me.vz *= 0.9 }
      g.me.cycle += Math.hypot(g.me.vx, g.me.vz) * s / 2.4
      marker(s)
      keeper(s)
      // the lens: tight on the box, then out wide as the winger shapes to cross it
      if (g.phase === 'cross' && g.jumpAt == null && g.t > g.arriveAt + W) settle('missed', g.sep < 0.9 ? 'Marker got in front of him and headed it clear' : 'Never got there: it flashed across the box')
      if (g.shot && !g.res) shotTick()
      if (g.endAt != null && !g.done && g.t >= g.endAt) finish()
    },
    input(a) {
      if (skipOutro(g, a)) return
      padInput(g.ctl, a, g.vh, { hasP: false, down: id => { if (id === 'S') head() } })
    },
  }
  function marker(s) {
    const m = g.mk, me = g.me
    m.hist.push({ t: g.t, x: me.x, z: me.z }); while (m.hist.length > 2 && g.t - m.hist[1].t > mLag) m.hist.shift()
    const seen = m.hist[0]
    // ball-watching: turned to the winger, half a yard off you, not tracking. Otherwise: goal-side of where you were a
    // moment ago, touch-tight
    m.turn += ((g.watching ? 1 : 0) - m.turn) * (1 - Math.exp(-s / 0.09))
    let tx, tz, sp
    if (g.watching) { tx = m.x + 0.6 * s * 3; tz = m.z + 0.5 * s * 3; sp = 1.2 }
    else if (g.phase === 'cross' && g.to) {
      // caught ball-watching as it came in: a beat to turn and find you again
      tx = lerp(seen.x, g.to.x, 0.3) + 0.35; tz = lerp(seen.z, g.to.z, 0.3) + 0.6
      sp = g.free && g.t - g.crossAt < 450 ? mSpeed * 0.35 : mSpeed * 0.9
    }
    else { tx = seen.x + 0.45; tz = seen.z + 0.8; sp = mSpeed }
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz)
    if (d > 0.05) { const st = Math.min(d, sp * s); m.vx = (dx / d) * st / s; m.vz = (dz / d) * st / s; m.x += (dx / d) * st; m.z += (dz / d) * st } else { m.vx = 0; m.vz = 0 }
    m.cycle += Math.hypot(m.vx, m.vz) * s / 2.4
    g.sep = Math.hypot(me.x - m.x, me.z - m.z)
  }
  function keeper(s) {
    // on the line from the winger (or the ball) to the middle of the goal; across with the cross
    const K = g.gk
    let want = 1.5
    if (g.phase === 'cross' && g.to) { const f = clamp((g.t - g.crossAt) / g.flight, 0, 1); want = lerp(1.5, g.to.x * 0.45, f) }
    if (g.shot) return
    K.vx = clamp((want - K.x) * 6, -4.2, 4.2); K.x += K.vx * s
  }
  function cross() {
    g.phase = 'cross'; g.crossAt = g.t
    // he picks out where you're going
    const me = g.me
    const lead = { x: me.x + me.vx * 0.55, z: me.z + me.vz * 0.55 }
    const to = { x: clamp(lead.x + (r() - 0.5) * 0.6, ZONE.x0 + 0.5, ZONE.x1 - 0.3), z: clamp(lead.z + (r() - 0.5) * 0.6, ZONE.z0 + 0.5, ZONE.z1 - 0.2) }
    g.to = to
    const near = to.x > 0.5
    const L = Math.hypot(to.x - CROSS.x, to.z - CROSS.z)
    g.flight = (L / (near ? 22 : 17.5)) * 1000 + 120
    g.arriveAt = g.crossAt + g.flight
    g.apex = near ? 3.0 : 4.6
    g.free = g.sep > 1.3; g.sepX = g.sep
    g.fx.push('tap')
    g.hud.prompt = g.free ? 'LOST HIS MARKER' : null
    g.hud.hot = g.free
  }
  function head() {
    if (g.phase !== 'cross' || g.jumpAt != null || g.res) return
    g.jumpAt = g.t
    g.fx.push('h:light')
    const e = g.t + RISE - g.arriveAt
    const reach = Math.hypot(g.me.x - g.to.x, g.me.z - g.to.z)
    // the marker: right on you, he's up for it too and he's first to it more often than not
    // (how far off you he was as it was crossed counts: he's had to turn and find you)
    const sep = Math.max(g.sep, (g.sepX ?? 0) * 0.8)
    if (Math.abs(e) > g.W * 1.6) return settle(e < 0 ? 'missed' : 'missed', e < 0 ? 'Went up too early: it went over his head' : 'Too late: it was past him', true)
    if (reach > 1.55) return settle('missed', 'Couldn’t get there: wrong side of the ball', true)
    if (sep < 0.8 && r() < lerp(0.62, 0.3, tv)) return settle('cleared', 'His marker got there first and cleared it', true)
    const q = clamp(1 - Math.abs(e) / g.W, 0, 1) * (reach > 0.8 ? 0.8 : 1)
    const o = padStick(g.ctl)
    k.press(0, 'header'); k.phase = 'strike'
    k.aimAt(Math.abs(o.x) > 0.2 ? o.x : -(Math.sign(g.gk.x - g.to.x * 0.4) || 1) * 0.6, o.y)
    k.power = clamp(0.3 + 0.6 * q + (g.free ? 0.08 : 0), 0, 0.88)
    k.timed = Math.abs(e) < g.W * 0.3 ? 'green' : Math.abs(e) < g.W * 0.75 ? 'ok' : 'red'
    const s = strikeOf(k, { x: g.to.x, z: g.to.z }, { v, r, y0: 2.3, pressure: clamp((1.6 - sep) / 0.8, 0, 1) })
    if (o.y < -0.4) { s.to.y = Math.min(s.to.y, 0.5); s.bounce = true }
    g.shot = { ...s, at: g.arriveAt }
    const K = g.gk
    g.shot.save = s.onTarget ? keeperSave(g.shot, { x: K.x, z: KEEP_Z, react: s.bounce ? 290 : 230, reach: 0.8, up: 2.45, dive: 3.8, read: Math.sign(K.vx) * 0.4 }, r) : null
    g.q = q
  }
  function shotTick() {
    const s = g.shot, a = g.t - s.at
    if (a < 0) return
    if (s.save?.saved && a >= s.save.f * s.T) return settle('saved', s.save.held ? 'Headed it straight at the keeper' : 'Good header, better save')
    if (a >= s.T) {
      if (s.over) return settle('over', 'Got under it: over the bar')
      if (s.wide) return settle('wide', 'Glanced it wide of the post')
      if (!s.onTarget) return settle('over', 'Over the bar')
      settle('goal', s.timed === 'green' ? 'Met it perfectly' : s.bounce ? 'Headed it down and in' : g.to.x > 0.5 ? 'Flicked it in at the near post' : 'Back across the keeper, into the far corner')
    }
  }
  function settle(kind, why, now = false) {
    if (g.res) return
    g.res = kind; g.why = why; g.resAt = g.t; g.endAt = g.t + (now ? 380 : kind === 'goal' ? 120 : 60)
    if (kind === 'goal') {
      g.cel = celebration(`${seed}|head`, { from: { x: g.to.x, z: g.to.z }, toward: { x: clamp(g.to.x + 2, -3, 3.6), z: g.to.z - 3.4 }, side: 1, athletic: v >= 8, mates: [{ x: -5.2, z: -9.4 }, { x: CROSS.x - 4, z: CROSS.z + 1 }, { x: -2, z: -16 }] })
      g.kAt = { x: g.gk.x + (Math.sign(g.shot.to.x - g.gk.x) || 1) * 1.3, z: KEEP_Z, rot: (Math.sign(g.shot.to.x - g.gk.x) || 1) * 1.4, ball: { x: clamp(g.shot.to.x, -3, 3), z: 1.5 } }
    }
  }
  function finish() {
    const goal = g.res === 'goal'
    const q = goal ? clamp(0.58 + 0.25 * (g.q ?? 0.5) + (g.free ? 0.12 : 0), 0, 1) : clamp(0.1 + (g.free ? 0.15 : 0), 0, 0.4)
    g.done = outcome(q, goal, g.why); g.doneAt = g.t
    g.outro = goal ? celebMs() + 300 : lightMode() ? 1100 : 2200
    const word = { goal: 'GOAL', saved: 'SAVED', over: 'OVER THE BAR', wide: 'WIDE', cleared: 'CLEARED', missed: 'MISSED IT' }[g.res]
    g.stamp = { text: word, good: goal, at: g.t, size: word.length > 9 ? 40 : 50 }
    if (goal) { g.popAt = g.t; g.fx.push('h:success') } else g.fx.push(g.res === 'saved' ? 'catchball' : 'deny', 'h:heavy')
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// The camera behind the box, turned a touch to the right where the cross comes from; and, as on TV, a small picture
// of the winger in the corner from when he gets his head up till the ball's on its way, so you see it leave his foot
const CAM = { x: 0.6, y: 3.7, z: -20.5, yaw: 0.08, F: 520, hzAt: 0.19 }, BIG = 1
const camFor = (g, view) => camOf(view, CAM)
const INSET = { w: 148, h: 92 }
function wingInset(ctx, view, g, team, away, K) {
  const on = g.t > g.runMs - 1400 && (g.crossAt == null || g.t < g.crossAt + 650) && !g.res
  if (!on) return
  const a = Math.min(1, (g.t - (g.runMs - 1400)) / 200, g.crossAt == null ? 1 : (g.crossAt + 650 - g.t) / 200)
  const x0 = view.w - INSET.w - 8, y0 = 52
  ctx.save(); ctx.globalAlpha = Math.max(0, a)
  ctx.beginPath(); ctx.rect(x0, y0, INSET.w, INSET.h); ctx.clip()
  // a lens out on the wing, looking down the line at him and into the box
  const C = { x: g.wing.x - 3.5, y: 2.4, z: g.wing.z - 9, F: 230, vx: x0 + INSET.w * 0.4, hz: y0 + INSET.h * 0.34, near: 0.4, yaw: 0.25, cy: Math.cos(0.25), sn: Math.sin(0.25) }
  ctx.fillStyle = '#0d2a18'; ctx.fillRect(x0, y0, INSET.w, INSET.h)
  stadium(ctx, { w: view.w, h: view.h, empty: view.empty }, C, { team, away, board: '' })
  const b = ballNow(g)
  if (b && b.z < g.wing.z + 6) ball(ctx, C, b.x, b.y, b.z, b.spin)
  const ca = g.crossAt != null ? g.t - g.crossAt : -1
  const pose = ca >= 0 ? (ca < 300 ? kickPose(0.45 + 0.55 * ca / 300, -1) : kickPose(1, -1)) : g.t > g.runMs - 260 ? kickPose(0.42 * prog(g.t, g.runMs - 260, g.runMs), -1) : runPose(g.t / 260 % 1, 0.9)
  man(ctx, C, g.wing.x, g.wing.z, pose, dress(K.us, g.who.mate ?? { number: 7, skin: '#5e3c22' }))
  ctx.restore()
  ctx.globalAlpha = Math.max(0, a)
  ctx.strokeStyle = 'rgba(242,242,238,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, y0 + 0.5, INSET.w - 1, INSET.h - 1)
  ctx.fillStyle = 'rgba(6,8,10,.82)'; ctx.fillRect(x0, y0 + INSET.h - 15, 58, 15)
  text(ctx, 'THE CROSS', x0 + 5, y0 + INSET.h - 7, { size: 11, align: 'left', track: 1, color: '#f2f2ee' })
  ctx.globalAlpha = 1
}
function ballNow(g) {
  if (g.phase === 'mark') return { x: g.wing.x + 0.5, y: 0.11, z: g.wing.z + 0.7, spin: g.t / 60, atFeet: true }
  const s = g.shot, to = g.to
  const arc = f => ({ x: lerp(CROSS.x + 0.4, to.x, f), y: lerp(0.2, 2.3, f) + Math.sin(Math.min(1, f) * Math.PI) * g.apex, z: lerp(CROSS.z + 0.6, to.z, f), spin: f * 14 })
  const f = (g.t - g.crossAt) / g.flight
  if (!s || g.t < s.at) {
    if (g.res && g.res !== 'goal' && f > 1) { const b = arc(1), a = (f - 1) * g.flight / 1000; return g.res === 'cleared' ? { x: b.x - a * 6, y: 2.3 + a * 5 - a * a * 6, z: b.z - a * 9, spin: f * 14 } : { x: b.x - a * 14, y: Math.max(0.11, 2.3 - a * 4), z: b.z - a * 3, spin: f * 14 } }
    return arc(Math.min(f, 1.6))
  }
  const a = g.t - s.at
  if (s.save?.saved && a >= s.save.f * s.T) { if (s.save.held) return { x: g.gk.x, y: 1.0, z: KEEP_Z - 0.4, spin: 0, held: true }; const p = shotAt(s, s.save.f * s.T), b = clamp((a - s.save.f * s.T) / 500, 0, 1); return { x: p.x + Math.sign(p.x - g.gk.x || 1) * b * 2.6, y: Math.max(0.11, p.y + Math.sin(b * Math.PI) * 0.8), z: lerp(p.z, 2.2, b), spin: a / 30 } }
  if (a < s.T) { const p = shotAt(s, a); if (s.bounce) { const ff = a / s.T; p.y = ff < 0.55 ? lerp(2.3, 0.11, ff / 0.55) : 0.11 + Math.sin((ff - 0.55) / 0.45 * Math.PI) * 0.6 + (s.to.y - 0.11) * (ff - 0.55) / 0.45 } return p }
  const af = a - s.T
  if (g.res === 'goal') { if (g.kHold) return { x: g.kHold.x, y: 0.85, z: g.kHold.z - 0.25, spin: 0, held: true }; const b = clamp(af / 220, 0, 1), drop = clamp((af - 200) / 420, 0, 1); return { x: s.to.x * (1 + b * 0.1), y: Math.max(0.11, s.to.y - drop * drop * s.to.y), z: lerp(0, NET_D - 0.3, easeOut(b)), spin: 20 } }
  const b = clamp(af / 600, 0, 1)
  return { x: s.to.x + Math.sign(s.to.x) * b, y: s.to.y + b * 0.4, z: b * 5, spin: 20 }
}
function meNow(g) {
  const me = g.me, sp = Math.hypot(me.vx, me.vz)
  if (g.jumpAt != null && (!g.res || g.t - g.resAt < 500)) {
    const a = g.t - g.jumpAt
    const up = a < RISE ? easeOut(a / RISE) : a < RISE + 120 ? 1 : 1 - easeIn(clamp((a - RISE - 120) / RISE, 0, 1))
    const o = g.k.aim
    return { x: me.x, z: me.z, lift: up * 0.62, pose: { ...POSE.jump, lean: (o?.x ?? 0) * 0.3 * clamp((a - RISE + 60) / 160, 0, 1), tilt: a > RISE - 40 ? -0.6 : 0.6 } }
  }
  if (g.res && g.res !== 'goal') return { x: me.x, z: me.z, lift: 0, pose: strikerDenied(g.res === 'saved' || g.res === 'over' || g.res === 'wide' ? 'save' : 'miss', g.t - g.resAt - 200, POSE.stand) }
  // eyes on the ball out wide
  return { x: me.x, z: me.z, lift: 0, pose: sp > 0.6 ? { ...runPose(me.cycle % 1, clamp(sp / 5.5, 0.3, 1)), head: 0.6 } : { ...POSE.ready, head: 0.7, tilt: g.phase === 'cross' ? 0.5 : 0 } }
}
function markNow(g) {
  const m = g.mk, sp = Math.hypot(m.vx, m.vz)
  if (g.res === 'goal') return { x: m.x, z: m.z, lift: 0, turn: 0, pose: defenderBeaten(1, g.t - g.endAt, POSE.stand) }
  if (g.jumpAt != null && g.sep < 1.6 && !g.res) { const a = g.t - g.jumpAt - 40, up = a < 0 ? 0 : a < RISE ? easeOut(a / RISE) : 1 - easeIn(clamp((a - RISE) / RISE, 0, 1)); return { x: m.x, z: m.z, lift: up * 0.5, turn: 0, pose: { ...POSE.jump, head: 0.4 } } }
  if (g.res === 'cleared') return { x: m.x, z: m.z, lift: 0, turn: 0, pose: mix(POSE.jump, POSE.stand, prog(g.t - g.resAt, 0, 400)) }
  // ball-watching: turned side-on to the winger, head round, arms down. Tight on you: square to you, an arm on you
  const turned = m.turn
  const base = sp > 0.8 ? runPose(m.cycle % 1, clamp(sp / 5, 0.3, 1)) : { ...POSE.ready, hlx: -24, hly: -66, elbow: 0.4 }
  return { x: m.x, z: m.z, lift: 0, turn: turned * 0.38, pose: { ...mix(base, { ...POSE.stand, tilt: 0.25 }, turned), head: lerp(-0.4, 1, turned) } }
}
function keeperNow(g) {
  const K = g.gk, s = g.shot, t = g.t
  if (g.res === 'goal' && g.cel) return null
  if (s && t >= s.at) {
    const a = prog(t, s.at, s.at + Math.max(200, (s.save?.f ?? 1) * s.T)), dir = Math.sign((s.save?.x ?? s.to.x) - K.x) || 1
    const pose = g.res === 'saved' && t - g.resAt > 450 ? keeperRoar(t - g.resAt - 450, POSE.stand) : s.save?.held ? mix(POSE.set, { ...POSE.set, hlx: -8, hly: -66, hrx: 8, hry: -66 }, a) : { ...POSE.dive, rot: dir * 1.35 * easeOut(a) }
    return { x: K.x + (s.save?.held ? 0 : dir * 1.2 * easeOut(a)), lift: s.save?.held || g.res === 'saved' && t - g.resAt > 450 ? 0 : Math.sin(a * Math.PI) * 0.4, pose }
  }
  if (g.res && g.res !== 'goal') return { x: K.x, lift: 0, pose: mix(POSE.set, POSE.stand, prog(t - g.resAt, 0, 500)) }
  const bob = Math.abs(Math.sin(t / 170)) * 2.5
  return { x: K.x, lift: 0, pose: { ...(g.phase === 'cross' ? POSE.set : POSE.ready), hy: (g.phase === 'cross' ? 44 : 49) + bob, head: 0.6 } }
}
// the others in the box: a defender at the near post, one on the six, a teammate at the back post
const EXTRAS = [{ x: 3.1, z: -3.4, side: 'them', n: 5 }, { x: -3.4, z: -6.6, side: 'them', n: 6 }, { x: -5.4, z: -10.6, side: 'us', n: 11 }]
const manB = (ctx, C, X, Z, pose, look, o = {}) => man(ctx, C, X, Z, pose, look, { ...o, size: BIG })
export function draw(ctx, g, view) {
  g.vh = view.h
  const C = camFor(g, view), K = kitsOf(view), team = [view.colors.us, view.colors.trim], away = [view.colors.them, view.colors.themTrim ?? '#f4efe6']
  stadium(ctx, view, C, { team, away, board: boardWords(g) })
  if (g.popAt != null && !view.empty) { crowdUp(ctx, C, team, g.t - g.popAt, 2400, away); flashes(ctx, C, view, g.t - g.popAt) }
  const b = ballNow(g), s = g.shot
  const ripple = g.res === 'goal' ? { x: s.to.x, y: s.to.y, at: s.at + s.T + 80 } : null
  net(ctx, C, ripple, g.t)
  if (b.z > 0.05 && !b.held) ball(ctx, C, b.x, b.y, b.z, b.spin)
  goalFrame(ctx, C)
  const gkLook = dress(K.gk, g.who.gk ?? { number: 1, skin: '#f0c4a0' }, { front: true, sleeves: true }), meLook = dress(K.us, g.who.me ?? { number: 9 })
  const mkLook = dress(K.them, g.who.mark ?? { number: 4, skin: '#7a5030' }, { front: true })
  const list = [], age = g.endAt != null ? g.t - g.endAt : 0
  if (g.res === 'goal' && g.cel) {
    const kb = keeperBeaten(g.cel, age, g.kAt)
    g.kHold = kb.holds ? { x: kb.x, z: kb.z } : null
    list.push({ z: kb.z, fn: () => manB(ctx, C, kb.x, kb.z, kb.pose, { ...gkLook, front: kb.front }) })
    const sc = scorerAt(g.cel, age)
    list.push({ z: sc.z, fn: () => manB(ctx, C, sc.x, sc.z, sc.pose, meLook, { lift: sc.lift, turn: sc.turn, name: g.who.me?.name }) })
    g.cel.mates.forEach((m, i) => { if (age < m.delay) return; const at = mateAt(g.cel, i, age, sc); list.push({ z: at.z, fn: () => manB(ctx, C, at.x, at.z, at.pose, dress(K.us, i === 0 ? { number: 11, skin: '#c09060' } : i === 1 ? { number: 7, skin: '#5e3c22' } : { number: 8, skin: '#f0c4a0' }), { lift: at.lift, turn: at.turn }) }) })
  } else {
    const kp = keeperNow(g)
    list.push({ z: KEEP_Z, fn: () => manB(ctx, C, kp.x, KEEP_Z, kp.pose, gkLook, { lift: kp.lift }) })
    const me = meNow(g)
    list.push({ z: me.z, fn: () => manB(ctx, C, me.x, me.z, me.pose, meLook, { lift: me.lift, name: g.who.me?.name }) })
    // the winger, in from the right with it, and his cross
    if (g.phase === 'mark' || g.t - (g.crossAt ?? 0) < 900) {
      const w = g.wing, ca = g.crossAt != null ? g.t - g.crossAt : -1
      const pose = ca >= 0 ? (ca < 300 ? kickPose(0.45 + 0.55 * ca / 300, -1) : kickPose(1, -1)) : g.t > g.runMs - 260 ? kickPose(0.42 * prog(g.t, g.runMs - 260, g.runMs), -1) : runPose(g.t / 260 % 1, 0.9)
      list.push({ z: w.z, fn: () => manB(ctx, C, w.x, w.z, pose, dress(K.us, g.who.mate ?? { number: 7, skin: '#5e3c22' })) })
    }
  }
  const mk = markNow(g)
  list.push({ z: mk.z, fn: () => manB(ctx, C, mk.x, mk.z, mk.pose, mkLook, { lift: mk.lift, turn: mk.turn }) })
  EXTRAS.forEach((e, i) => {
    let pose = { ...(e.side === 'them' ? POSE.ready : POSE.stand), head: 0.8 }
    if (g.res === 'goal' && g.t > g.endAt + 200) pose = e.side === 'them' ? defenderBeaten(i * 2, g.t - g.endAt - 200) : POSE.armsOut
    list.push({ z: e.z, fn: () => manB(ctx, C, e.x, e.z, pose, dress(e.side === 'us' ? K.us : K.them, { number: e.n, skin: e.n === 5 ? '#5e3c22' : '#c09060' }, { front: e.side === 'them' })) })
  })
  if (b.z <= 0.05 && !b.held) list.push({ z: b.z - 0.02, fn: () => ball(ctx, C, b.x, b.y, b.z, b.spin) })
  list.sort((p, q) => q.z - p.z)
  for (const m of list) m.fn()
  if (b.held) ball(ctx, C, b.x, b.y, b.z, b.spin, 0, false)
  // the tell, at a glance: a quiet line over him while he's watching the ball, and the gap between you on the grass
  if (g.phase === 'mark' && !g.res) {
    const p = P(C, g.mk.x, 2.35, g.mk.z)
    if (g.mk.turn > 0.5 && p.ok) tag(ctx, 'HE’S BALL-WATCHING', p.x, p.y - 6, clamp((g.mk.turn - 0.5) * 3, 0, 1))
  }
  ring(ctx, C, g)
  wingInset(ctx, view, g, team, away, K)
  if (g.phase === 'cross' && g.jumpAt == null && !g.res) { const o = padStick(g.ctl); aimMark(ctx, C, (Math.abs(o.x) > 0.2 ? o.x : -(Math.sign(g.gk.x - g.to.x * 0.4) || 1) * 0.6) * (POST - 0.7), o.y < -0.4 ? 0.3 : lerp(0.3, BAR - 0.45, (o.y + 1) / 2), { alpha: 0.75 }) }
  if (g.res === 'goal' && g.done && !g.kicked) { g.kicked = true; g.nudge.kick(g.t, 2.5, 0, 1, 180) }
  drawPads(ctx, view, g.ctl, { move: g.phase === 'mark' ? 'MOVE' : 'AIM', S: 'HEAD' }, !g.done)
  placeStamp(g.stamp, view)
}
function tag(ctx, str, x, y, a = 1) {
  ctx.globalAlpha = a
  ctx.font = `13px ${LABEL}`
  const w = ctx.measureText(str).width + 14 + str.length
  ctx.fillStyle = 'rgba(6,8,10,.82)'; rr(ctx, x - w / 2, y - 10, w, 20, 3); ctx.fill()
  text(ctx, str, x, y + 0.5, { size: 13, track: 1, color: '#f2f2ee' })
  ctx.globalAlpha = 1
}
// the ring where it's coming down, closing at the moment to go up
function ring(ctx, C, g) {
  if (g.phase !== 'cross' || g.jumpAt != null || g.res) return
  const at = g.arriveAt - RISE, t = g.t, R0 = 620
  if (t < at - R0) return
  const p = P(C, g.to.x, 2.3, g.to.z), q = P(C, g.to.x, 0, g.to.z)
  if (!p.ok) return
  const f = clamp((t - (at - R0)) / R0, 0, 1), late = t > at
  const rr2 = lerp(2.2, 0.42, easeOut(f)) * p.s
  // the spot under it on the grass
  ctx.strokeStyle = 'rgba(242,242,238,.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.7 * q.s, 0.22 * q.s, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = late ? GOLD : 'rgba(255,255,255,.92)'; ctx.lineWidth = late ? 2.5 : 2
  ctx.beginPath(); ctx.arc(p.x, p.y, rr2, 0, Math.PI * 2); ctx.stroke()
  if (late) { ctx.strokeStyle = GOOD; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, 0.42 * p.s, 0, Math.PI * 2); ctx.stroke() }
}
