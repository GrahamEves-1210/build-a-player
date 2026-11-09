// The academy trial's dribble slalom: six poles in a line, the ball at your feet, in and out of them and through the
// gate at the end. He runs it on his own; you make the cut at each pole: the arrow says which way he's taking it
// next, and the ring closing on the ball is the moment. On time, the ball stays on his foot and he keeps his speed.
// Early or late it's a heavy touch and he has to chase it; the wrong way and he clips the pole. A stopwatch in real
// seconds is the result, like the 3-cone. Dribbling sets the window and how quick he is with it.
import { byV, clamp, lerp, prog, outcome, rngOf, easeOut, GOOD, BAD, GOLD, text, DISPLAY, LABEL, nudge } from './kit.js'
import { clockSlab, officialStrip, officialPunch, OFFICIAL_MS, stopwatch } from './dash.js'
import { placeStamp } from './read.js'
import { camOf, P, stadium, man, ball, POSE, mix, runPose, dribblePose, kitsOf, dress, line, scout } from './soccer.js'

export const how = {
  slalom: 'Press the way the arrow points as the ring closes at each pole. Clean touches are the time.',
}

const Z0 = -44, N = 6, LEAD = 1100, RING = 620, EARLY = 220, FIN = 4.5
const SIDE = 0.78           // how far round the pole he goes

export function make({ v, seed }) {
  const r = rngOf(seed)
  const vClean = byV(v, 4.1, 5.3), win = byV(v, 52, 112)
  const first = r() < 0.5 ? -1 : 1
  // the poles: a line down the middle, the gaps not quite even
  const poles = []
  let z = Z0 + 4.2
  for (let k = 0; k < N; k++) { poles.push({ z, side: k % 2 ? -first : first }); z += 2.7 + r() * 0.9 }
  const finishZ = poles[N - 1].z + FIN
  // a clean run's time, for the board's mark
  const pts = [[0, Z0], ...poles.map(p => [p.side * SIDE, p.z]), [0, finishZ]]
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  const clean = 0.45 + len / vClean       // (a clean run: the first steps up to speed, then flat out)
  // the first leg: up to speed from a standing start (A: how long that takes), then flat out
  const A = 0.45, s0 = tau => vClean * (tau - A * (1 - Math.exp(-tau / A)))
  const g = {
    t: 0, zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, litAt: -999, fx: [], done: null, outro: 2400, stamp: null,
    poles, finishZ, pts, li: 0, k: 0, n: N, win, clean,
    phase: 'set', goAt: null, x: 0, z: Z0, sp: 0, cycle: 0,
    leg: null, cuts: poles.map(p => ({ res: null, why: null, at: 0, arrive: Infinity, want: -p.side })), slips: 0, crossed: null, finalSecs: null,
    hud: { prompt: 'SET', dots: poles.map(() => null) },
    tick(dt) {
      g.t += dt
      const s = dt / 1000
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.phase === 'set') { if (g.t >= LEAD) { g.phase = 'run'; g.goAt = g.t; g.fx.push('whistle'); g.hud.prompt = null; startLeg() } return }
      if (g.phase === 'done') { g.sp *= Math.exp(-s / 0.4); g.z += g.sp * s; g.cycle += (g.sp * s) / 2.2; return }
      const L = g.leg
      if (L.first) { const tau = (g.t - L.t0) / 1000; L.s = s0(tau); g.sp = vClean * (1 - Math.exp(-tau / A)) }
      else { g.sp += (L.spd - g.sp) * (1 - Math.exp(-s / 0.12)); L.s += L.spd * s }
      const f = clamp(L.s / L.len, 0, 1)
      g.x = lerp(L.ax, L.bx, f); g.z = lerp(L.az, L.bz, f)
      g.cycle += (g.sp * s) / 2.2
      // the cut that's due: never pressed by the end of its window, it's a late one
      const c = g.cuts[g.k]
      if (c && c.res == null && g.t > c.arrive + win) judge(null)
      if (f >= 1) {
        if (g.li >= N) { g.crossed = g.t; finish() }
        else { g.li++; startLeg() }
      }
    },
    input(a) {
      if (a.kind !== 'down' || g.phase !== 'run' || g.k >= N) return
      const side = a.zone === 'L' ? -1 : a.zone === 'R' ? 1 : 0
      if (!side) return
      g.padLit = side < 0 ? 0 : 1; g.litAt = g.t
      const c = g.cuts[g.k]
      // (too soon to mean anything: he's still on the last one)
      if (g.t < c.arrive - win - EARLY) return
      judge(side)
    },
  }
  function startLeg() {
    const a = { x: g.x, z: g.z }
    const b = g.li < N ? { x: poles[g.li].side * SIDE, z: poles[g.li].z } : { x: 0, z: finishZ }
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const L = { ax: a.x, az: a.z, bx: b.x, bz: b.z, len, s: 0, t0: g.t, spd: vClean, first: g.li === 0 }
    // the first leg's arrival, from its run-up; the rest at his speed (a heavy touch slows it, see judge)
    if (L.first) { let lo = 0, hi = 5; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (s0(m) < len) lo = m; else hi = m } L.T = hi }
    else L.T = len / L.spd
    if (g.li < N) g.cuts[g.li].arrive = g.t + L.T * 1000
    // the last cut slipped: this leg starts slow
    const prev = g.li > 0 ? g.cuts[g.li - 1] : null
    if (prev && prev.res === false) slow(L, prev.why)
    g.leg = L
  }
  // a heavy touch or the pole: the leg he's on runs slower from here (and the next cut comes later)
  function slow(L, why) {
    if (L.slowed || L.first) return
    L.slowed = true; L.slowAt = g.t
    L.spd = vClean * (why === 'pole' ? 0.5 : 0.62)
    if (g.li < N && g.cuts[g.li].res == null) g.cuts[g.li].arrive = g.t + ((L.len - L.s) / L.spd) * 1000
  }
  function judge(side) {
    const c = g.cuts[g.k]
    const e = side == null ? Infinity : g.t - c.arrive
    let ok = false, why = null
    if (side == null) why = 'late'
    else if (side !== c.want) why = 'pole'
    else if (e < -win) why = 'early'
    else ok = true
    c.res = ok; c.why = why; c.at = g.t
    g.hud.dots[g.k] = ok
    if (!ok) {
      g.slips++; g.fx.push(why === 'pole' ? 'stamp' : 'deny', 'h:heavy'); g.nudge?.kick(g.t, 1.4, 0, 1, 140)
      // the leg after this pole is the one that pays (it may have started already)
      if (g.li === g.k + 1) slow(g.leg, why)
    } else g.fx.push('dribble', 'h:light')
    g.k++
  }
  function finish() {
    const secs = (g.crossed - g.goAt) / 1000
    g.finalSecs = secs
    const slack = 0.55, range = 1.2
    const score = clamp((clean + slack + range * 0.5 - secs) / range, 0, 1), hit = score >= 0.5
    const made = g.cuts.filter(c => c.res).length
    g.done = outcome(score, hit, `${secs.toFixed(2)}s · ${made} of ${N} clean`, { secs, made, of: N })
    g.phase = 'done'
    g.stamp = { text: hit ? (score >= 0.85 ? 'QUICK FEET' : 'GOOD TIME') : 'TOO SLOW', good: hit, at: g.t + OFFICIAL_MS, size: 46 }
    g.outro = 2400 + OFFICIAL_MS
    g.fx.push('swoosh')
  }
  g.clock = () => (g.goAt == null ? 0 : g.finalSecs ?? (g.t - g.goAt) / 1000)
  g.nudge = nudge()
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// a slalom pole: a thin pole on a heavy round base, yellow with a red band
function pole(ctx, C, X, Z, hit) {
  const a = P(C, X, 0, Z), b = P(C, X, 1.6, Z)
  if (!a.ok) return
  const w = Math.max(1.2, 0.045 * a.s)
  ctx.fillStyle = 'rgba(2,10,6,.4)'; ctx.beginPath(); ctx.ellipse(a.x + 0.04 * a.s, a.y, 0.2 * a.s, 0.05 * a.s, 0, 0, 6.2832); ctx.fill()
  ctx.fillStyle = '#20262c'; ctx.beginPath(); ctx.ellipse(a.x, a.y - 0.02 * a.s, 0.15 * a.s, 0.045 * a.s, 0, 0, 6.2832); ctx.fill()
  const lean = hit ? Math.sin(hit / 40) * Math.exp(-hit / 300) * 0.25 * a.s : 0
  ctx.strokeStyle = '#0b1014'; ctx.lineWidth = w + 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + lean, b.y); ctx.stroke()
  ctx.strokeStyle = '#f2d33a'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + lean, b.y); ctx.stroke()
  ctx.strokeStyle = '#c9423a'; ctx.beginPath(); ctx.moveTo(lerp(a.x, b.x + lean, 0.62), lerp(a.y, b.y, 0.62)); ctx.lineTo(lerp(a.x, b.x + lean, 0.8), lerp(a.y, b.y, 0.8)); ctx.stroke()
}
function arrow(ctx, x, y, dir, k, col) {
  ctx.fillStyle = col; ctx.strokeStyle = '#0b1014'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x + dir * 14 * k, y); ctx.lineTo(x - dir * 4 * k, y - 11 * k); ctx.lineTo(x - dir * 4 * k, y - 4.5 * k); ctx.lineTo(x - dir * 14 * k, y - 4.5 * k); ctx.lineTo(x - dir * 14 * k, y + 4.5 * k); ctx.lineTo(x - dir * 4 * k, y + 4.5 * k); ctx.lineTo(x - dir * 4 * k, y + 11 * k); ctx.closePath()
  ctx.stroke(); ctx.fill()
}
// The picture follows a smooth line through the same points the rules run between (a Catmull-Rom curve, the same
// progress along each leg), so he flows round the poles instead of turning on a coin. The rules' timing never moves.
const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3) }
function smoothAt(g) {
  const L = g.leg
  if (!L) return { x: g.x, z: g.z, dx: 0, dz: 1 }
  const i = g.li, P0 = g.pts[Math.max(0, i - 1)], P1 = g.pts[i], P2 = g.pts[Math.min(g.pts.length - 1, i + 1)], P3 = g.pts[Math.min(g.pts.length - 1, i + 2)]
  const f = clamp(L.s / L.len, 0, 1)
  // (leg i runs from where he was to point i + 1; its start is the runner's start point for the first leg)
  const a = i === 0 ? g.pts[0] : P1
  const x = cr(P0[0], a[0], P2[0], P3[0], f), z = cr(P0[1], a[1], P2[1], P3[1], f)
  const x2 = cr(P0[0], a[0], P2[0], P3[0], Math.min(1, f + 0.05)), z2 = cr(P0[1], a[1], P2[1], P3[1], Math.min(1, f + 0.05))
  const dl = Math.hypot(x2 - x, z2 - z) || 1
  return { x, z, dx: (x2 - x) / dl, dz: (z2 - z) / dl }
}
export function draw(ctx, g, view) {
  const sm = g.phase === 'run' ? smoothAt(g) : { x: g.x, z: g.z, dx: 0, dz: 1 }
  // (off to one side of the line of poles and up a little, so the ones he's passed never stand in front of the lens)
  const C = camOf(view, { x: -1.1 + sm.x * 0.3, y: 3.5, z: Math.min(sm.z, g.finishZ) - 6.6, F: 480, hzAt: 0.22 })
  C.vx -= (1.1 * C.F / 6.6) * 0.8   // (and turned in on him, so he's in the middle of the picture)
  const K = kitsOf(view), team = [view.colors.us, view.colors.trim]
  const secs = g.clock()
  stadium(ctx, view, C, { team, board: `SLALOM  ${secs.toFixed(2)}`, empty: true })
  // the scouts on the touchline, watching
  for (const [X, dz, sk] of [[-6.2, 3, '#6d4229'], [-6.8, 7.5, '#f0c4a0'], [6.4, 10, '#8d5a3b']]) scout(ctx, C, X, Z0 + dz, { ...dress(K.staff, { skin: sk }), front: true }, g.t)
  // the start and the gate at the end, the finish line between its cones
  ctx.fillStyle = 'rgba(244,247,242,.8)'; ctx.beginPath(); line(ctx, C, -1.6, Z0, 1.6, Z0, 0.1); ctx.fill()
  ctx.fillStyle = GOLD; ctx.beginPath(); line(ctx, C, -1.6, g.finishZ, 1.6, g.finishZ, 0.2); ctx.fill()
  for (const X of [-1.7, 1.7]) {
    const p = P(C, X, 0, g.finishZ)
    if (p.ok) { const h = 0.32 * p.s, w = 0.24 * p.s; ctx.fillStyle = '#f08a24'; ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y); ctx.lineTo(p.x, p.y - h); ctx.closePath(); ctx.fill() }
  }
  // the coach with the watch at the gate
  const staff = dress(K.staff, { skin: '#8d5a3b' })
  const cp = man(ctx, C, 2.9, g.finishZ + 1.2, g.done && g.done.hit && g.t - g.crossed > OFFICIAL_MS ? POSE.point : { ...POSE.stand, hrx: 13, hry: -86 }, staff)
  if (cp.ok && !g.done) { const k = cp.s * 1.8 / 110; stopwatch(ctx, cp.x + 13 * k, cp.y - 88 * k, Math.max(0.6, k * 1.4)) }
  // the poles, far to near, and him among them
  const me = { x: sm.x, z: sm.z }
  const list = g.poles.filter(p => p.z - C.z > 3.8).map(p => { const i = g.poles.indexOf(p); return { z: p.z, fn: () => pole(ctx, C, 0, p.z, g.cuts[i].why === 'pole' ? g.t - g.cuts[i].at : 0) } })
  // the ball: real touches, one every few strides. It's pushed out ahead, rolls, and he catches it up; each touch on
  // the outside of the foot he'll use next, and a heavy one runs away from him
  const L = g.leg
  const heavy = !!L?.slowed && g.t - (L.slowAt ?? 0) < 600
  const travel = g.cycle * 2.2, u = (travel / 1.25) % 1, n = Math.floor(travel / 1.25)
  const ahead = (heavy ? 1.7 : 0.32) + Math.pow(Math.sin(u * Math.PI), 0.7) * (heavy ? 0.5 : 0.72)
  const foot = n % 2 ? 1 : -1, px = -sm.dz, pz = sm.dx
  const bx = me.x + sm.dx * ahead + px * foot * 0.12, bz = me.z + sm.dz * ahead + pz * foot * 0.12
  if (g.phase === 'run' && n !== g.touchN) { g.touchN = n; g.touchAt = g.t }
  list.push({ z: bz, fn: () => ball(ctx, C, bx, 0.11, bz, g.cycle * 5) })
  // leaning into the turn
  const lean = clamp(sm.dx * 0.55, -0.32, 0.32)
  const kick = g.phase === 'run' && g.t - (g.touchAt ?? -999) < 140
  const run = { ...dribblePose(g.cycle % 1, 0.9, { lean }) }
  if (kick) { if (foot > 0) { run.rx = 9; run.ry = -10; run.rk = 0.6 } else { run.lx = -9; run.ly = -10; run.lk = 0.6 } }
  const pose = g.phase === 'set' ? POSE.ready : g.done ? (g.t - g.crossed > 600 ? (g.done.hit ? POSE.fist : POSE.hips) : runPose(g.cycle % 1, 0.6)) : run
  list.push({ z: me.z, fn: () => man(ctx, C, me.x, me.z, pose, dress(K.train, { number: null, skin: view.cast?.me?.skin ?? '#8d5a3b' })) })
  list.sort((a, b) => b.z - a.z)
  for (const m of list) m.fn()
  // the cut coming up: the arrow which way, the ring closing on the ball
  if (g.phase === 'run' && g.k < g.n && g.cuts[g.k].res == null) {
    const cut = g.cuts[g.k], at = cut.arrive, t = g.t, pz = g.poles[g.k]
    if (t >= at - RING) {
      const p = P(C, pz.side * SIDE, 0.11, pz.z)
      if (p.ok) {
        const f = clamp((t - (at - RING)) / RING, 0, 1), rr = lerp(1.9, 0.32, easeOut(f)) * p.s
        const late = t > at
        ctx.strokeStyle = late ? GOLD : 'rgba(255,255,255,.92)'; ctx.lineWidth = late ? 2.5 : 2
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rr, rr * 0.32, 0, 0, Math.PI * 2); ctx.stroke()
        arrow(ctx, p.x, p.y - 0.95 * p.s - 14, cut.want, 1.1, '#f4f6f2')
      }
    }
  }
  // the clock, as the 40's
  const over = g.crossed == null ? -1 : g.t - g.crossed, official = over >= OFFICIAL_MS
  const col = official ? (g.done.hit ? GOOD : BAD) : g.goAt != null ? '#fff' : 'rgba(255,255,255,.5)'
  const q = over >= 0 ? officialPunch(over) : 1, { w } = view
  if (q !== 1) { ctx.save(); ctx.translate(w / 2, 70); ctx.scale(q, q); ctx.translate(-w / 2, -70) }
  clockSlab(ctx, view, Math.min(secs, 99.99).toFixed(2), col, g.li / g.n)
  if (q !== 1) ctx.restore()
  text(ctx, `POLE ${Math.min(g.k + 1, g.n)} OF ${g.n}`, 12, 70, { font: LABEL, size: 16, align: 'left', color: 'rgba(255,255,255,.72)' })
  if (over >= 0) officialStrip(ctx, view, over, g.done?.hit, `${g.cuts.filter(c => c.res).length} OF ${g.n} CLEAN`)
  if (g.phase === 'set') text(ctx, 'SET', w / 2, C.hz + 120, { font: DISPLAY, size: 46, color: '#fff' })
  placeStamp(g.stamp, view)
}
