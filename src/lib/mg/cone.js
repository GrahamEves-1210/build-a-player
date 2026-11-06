// The agility drills, as they're really run. He runs the pattern on his own; the player taps to
// plant at each cone. On time he keeps his line and his speed. Early or late he stutters or goes
// wide and loses it. A stopwatch in real seconds is the result.
//   cone   the 3-cone (L drill): three cones in an L, five yards apart. A to B, touch the line,
//          back to A, touch, back to B, cut inside B to C, around C, back around B, home to A.
//   lane   NBA lane agility, cones on the corners of the lane. Sprint from the foul-line corner to
//          the baseline, slide across it, backpedal up the lane, slide across the foul line. Then
//          the other way round: slide across, sprint to the baseline, slide back, backpedal home.
//          He faces the baseline the whole way.
import { byV, clamp, lerp, outcome, layer, rngOf, prog, easeOut, GOOD, BAD, text, DISPLAY, particles, nudge } from './kit.js'
import { tilt, ground, floodlight, vignette, paintGrass, athlete, warmAthlete, skinOf, dirOf } from './art.js'
import { placeStamp } from './read.js'
import { arenaCam, manAt, POSE, RUN as RUN_F, hoopWith } from './arena.js'
import { project, PT, paintBoard, paintLines, paintHoop, easedState, easedPose, smoothT, CLK } from './meter.js'
import { clockSlab, paintRoom, officialStrip, officialPunch, OFFICIAL_MS, stopwatch, calm } from './dash.js'
import { coneShift } from './combineNorms.js'

export const how = {
  cone: 'Tap PLANT as he reaches each line and cone. Clean plants are the time.',
  lane: 'Tap PLANT as he reaches each corner. Clean plants are the time.',
}

const OUT_T = { cone: 150, lane: 170 }     // ms: how fast he pulls up through the line
const WALK = { cone: 1.3, lane: 3.6 }       // what he walks back at, when it's over
const LEAD = 900         // ms in his stance before he goes
const GATE = 180         // ms before the window that a press still counts as a (too early) press
const RING_MS = 620      // the closing ring always takes this long, so its speed can be learned
const RING_R0 = 66, RING_R = 28
const SETUP = {
  // units: yards for the cone, feet for the lane. keep: how much speed a clean plant carries
  cone: { clean0: 6.92, clean1: 6.32, win0: 39, win1: 78, accel: 10, slide: 240, wrong: 0, rejoin: 0.8, slip: 0.28, spread: 0.1 },
  lane: { clean0: 11.0, clean1: 10.05, win0: 42, win1: 76, accel: 32, slide: 190, wrong: 0, rejoin: 2.4, slip: 0.3, spread: 0.12 },
}
const arc = (pts, cx, cy, r, a0, a1, n = 8) => { for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r) } return pts }

// The 3-cone. A at the origin, B five yards straight on, C five yards off to one side of B.
// `m` mirrors it (C to the screen's right is 1, left is -1). Angles are measured with x to the C side.
function coneLegs(m) {
  const H = Math.PI / 2, lane = -0.42
  const leg = (pts, o) => { if (m < 0) for (let i = 0; i < pts.length; i += 2) pts[i] = -pts[i]; return { pts, ...o } }
  const ax = lane
  return [
    leg([ax, 0, ax, 5], { keep: 0, dwell: 0, vf: 1, cue: 'TOUCH THE LINE', touch: true }),
    leg([ax, 5, ax, 0], { keep: 0.06, dwell: 110, vf: 1, cue: 'TOUCH THE LINE', touch: true }),
    leg([ax, 0, 0.42, 3.95], { keep: 0.06, dwell: 110, vf: 1, cue: 'CUT' }),
    // inside B (between B and A), turning to C
    leg(arc([], 0.92, 3.95, 0.5, Math.PI, H, 6).concat([3.95, 4.45]), { keep: 0.62, dwell: 0, vf: 1, cue: 'AROUND THE CONE' }),
    // around the far side of C, back along the top of the L
    leg(arc([3.95, 4.45], 5, 5, 0.66, -H - 0.35, H + 0.35, 12).concat([0.6, 5.62]), { keep: 0.6, dwell: 0, vf: 1, cue: 'AROUND THE CONE' }),
    // around B's outside and home through A's line
    leg(arc([0.6, 5.62], 0, 5, 0.66, H - 0.35, Math.PI + 0.25, 8).concat([-0.62, 0]), { keep: 0.62, dwell: 0, vf: 1.06, cue: null }),
  ]
}
// The lane: 16 ft wide, 19 long. x from the middle, y up from the foul line. Inset so he runs just
// inside the cones. L is the screen's left: the corner the real drill starts from.
const LW = 8, LH = 19, IN = 1.3
function laneLegs() {
  const FL = [-LW + IN, IN], BL = [-LW + IN, LH - IN], BR = [LW - IN, LH - IN], FR = [LW - IN, IN]
  const SPRINT = 1, SLIDE = 0.74, BACK = 0.8
  const leg = (a, b, mode, vf, cue, cone) => ({ pts: [a[0], a[1], b[0], b[1]], mode, vf, keep: 0.2, dwell: 0, cue, cone })
  const L = [
    leg(FL, BL, 'run', SPRINT, 'SPRINT', 0),
    leg(BL, BR, 'slide', SLIDE, 'SLIDE', 1),
    leg(BR, FR, 'back', BACK, 'BACKPEDAL', 2),
    leg(FR, FL, 'slide', SLIDE, 'SLIDE', 3),
    leg(FL, FR, 'slide', SLIDE, 'SLIDE', 2),
    leg(FR, BR, 'run', SPRINT, 'SPRINT', 1),
    leg(BR, BL, 'slide', SLIDE, 'SLIDE', 0),
    leg(BL, FL, 'back', BACK, 'BACKPEDAL', 3),
  ]
  L[0].keep = 0
  return L
}
function measure(leg) {
  let len = 0
  for (let i = 2; i < leg.pts.length; i += 2) len += Math.hypot(leg.pts[i] - leg.pts[i - 2], leg.pts[i + 1] - leg.pts[i - 1])
  leg.len = len
  return leg
}
// How long a leg takes: speed up at `a`, then hold vT
function legTime(len, v0, vT, a) {
  const ta = Math.max(0, (vT - v0) / a), da = ((v0 + vT) / 2) * ta
  if (da >= len) return (Math.sqrt(v0 * v0 + 2 * a * len) - v0) / a
  return ta + (len - da) / vT
}

export function make({ v, seed, game, pos }) {
  const S = SETUP[game] ?? SETUP.cone
  const lane = game === 'lane'
  const r = rngOf(seed)
  const win = byV(v, S.win0, S.win1)
  const mirror = r() < 0.5 ? -1 : 1
  const legs = (lane ? laneLegs() : coneLegs(mirror)).map(measure)
  const n = legs.length - 1           // a plant at the end of every leg but the last
  const shift = lane ? 0 : coneShift(pos)   // the clock in the drill is the time on the card
  const target = byV(v, S.clean0, S.clean1) + shift + (r() - 0.5) * S.spread
  const cleanRun = b => {
    let sp = 0, T = 0
    for (const L of legs) {
      const v0 = sp * L.keep, vT = b * L.vf
      T += L.dwell / 1000 + legTime(L.len, v0, vT, S.accel)
      sp = Math.min(vT, Math.sqrt(v0 * v0 + 2 * S.accel * L.len))
    }
    return T
  }
  let base = lane ? 18 : 6
  for (let i = 0; i < 10; i++) base *= cleanRun(base) / target

  const cuts = Array.from({ length: n }, () => ({ res: null, why: null, at: 0 }))
  const start = legs[0].pts
  const g = {
    t: 0, game, zones: 'none', pads: ['PLANT'], padLit: null, fx: [], done: null, outro: 2500, stamp: null, litAt: -999,
    legs, cuts, win, S, lane, n, mirror,
    phase: 'set', k: 0, legId: 0,
    x: start[0], y: start[1], ux: 0, uy: 1, sp: 0,
    leg: { pts: start, idx: 0, sAt: 0, segLen: 1, x0: 0, y0: 0, v0: 0, vT: 0, a: S.accel, ta: 0, da: 0, t0: 0, T: 0, arrive: Infinity },
    slideAt: 0, slideT: 0, slideV0: 0, slideV1: 0,
    face: 0, stride: 0, plantAt: -9999,
    secs: 0, clock: 0, noPress: 0, finishAt: 0, made: 0,
    hud: { prompt: 'SET', dots: cuts.map(() => null), hot: false },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.phase === 'set') {
        if (g.t >= LEAD) { g.fx.push('whistle', 'h:light'); startLeg(start[0], start[1], 0) }
      } else if (g.phase === 'run') {
        const L = g.leg
        if (g.t >= L.arrive) {
          const e = L.pts.length - 2
          g.x = L.pts[e]; g.y = L.pts[e + 1]
          g.sp = Math.min(L.vT, L.v0 + L.a * L.T)
          if (g.k >= n) finishRun()
          else if (cuts[g.k].res === true) plant()
          else if (cuts[g.k].res === false) slideOut()
          else g.phase = 'coast'
        } else if (g.t >= L.t0) {
          const tau = g.t - L.t0
          const s = tau < L.ta ? L.v0 * tau / 1000 + 0.5 * L.a * tau * tau / 1e6 : L.da + (L.vT * (tau - L.ta)) / 1000
          follow(L, s)
          g.sp = tau < L.ta ? L.v0 + L.a * tau / 1000 : L.vT
          g.stride += (g.sp * dt) / 1000 / g.strideLen
        }
        g.hud.hot = g.k < n && g.t >= L.arrive - win
      } else if (g.phase === 'coast') {
        g.x += (g.ux * g.sp * dt) / 1000; g.y += (g.uy * g.sp * dt) / 1000
        g.stride += (g.sp * dt) / 1000 / g.strideLen
        if (g.t > g.leg.arrive + win) { g.noPress++; settle(false, 'late'); slideOut() }
      } else if (g.phase === 'slide') {
        const f = prog(g.t, g.slideAt, g.slideAt + g.slideT)
        g.sp = lerp(g.slideV0, g.slideV1, f)
        g.x += (g.ux * g.sp * dt) / 1000; g.y += (g.uy * g.sp * dt) / 1000
        g.stride += (g.sp * dt) / 1000 / g.strideLen
        if (f >= 1) { g.k++; startLeg(g.x, g.y, g.sp, true) }
      } else if (g.phase === 'out') {
        // through the line, up, and walking back to see what he ran
        const walk = WALK[game] ?? 1.3
        if (g.sp > walk) g.sp = Math.max(walk, g.sp * Math.exp(-dt / (OUT_T[game] ?? 150)))
        else {
          const dx = g.homeX - g.x, dy = g.homeY - g.y, dd = Math.hypot(dx, dy)
          if (dd < 0.3) { g.sp = 0 } else { g.ux += (dx / dd - g.ux) * Math.min(1, dt / 160); g.uy += (dy / dd - g.uy) * Math.min(1, dt / 160) }
        }
        g.x += (g.ux * g.sp * dt) / 1000; g.y += (g.uy * g.sp * dt) / 1000
        g.stride += (g.sp * dt) / 1000 / g.strideLen
      }
      if (g.phase !== 'set' && !g.done) g.clock = (g.t - LEAD) / 1000
      turnBody(dt)
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      g.padLit = 0; g.litAt = g.t
      if ((g.phase !== 'run' && g.phase !== 'coast') || g.k >= n) return
      const c = cuts[g.k]
      if (c.res != null) return
      const off = g.t - g.leg.arrive
      // a press well before the cone is nothing: only the press that means this cone counts
      if (off < -(win + GATE)) { g.fx.push('h:light'); return }
      if (Math.abs(off) <= win) settle(true, off < 0 ? 'early' : 'late')
      else settle(false, 'early')
      if (g.phase === 'coast') { if (c.res) plant(); else slideOut() }
    },
  }
  g.strideLen = lane ? 5.2 : 1.7
  g.homeX = lane ? -2 : start[0] * 0.5; g.homeY = lane ? 5 : 1.5

  function startLeg(x, y, v0, slipped = false) {
    const def = legs[g.k]
    let pts = def.pts
    // back from a slip: he rejoins the pattern further along, from wherever he ended up
    if (Math.hypot(pts[0] - x, pts[1] - y) > 0.02) {
      let j = 2
      while (j < pts.length - 2 && Math.hypot(pts[j] - x, pts[j + 1] - y) < S.rejoin) j += 2
      pts = [x, y, ...pts.slice(j)]
    }
    let len = 0
    for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])
    const vT = base * def.vf
    const L = g.leg, a = slipped ? S.accel * 0.6 : S.accel
    const sp0 = Math.min(v0, vT), T = legTime(len, sp0, vT, a)
    L.pts = pts; L.idx = 0; L.sAt = 0
    L.segLen = Math.max(1e-6, Math.hypot(pts[2] - pts[0], pts[3] - pts[1]))
    L.x0 = x; L.y0 = y; L.v0 = sp0; L.vT = vT; L.a = a
    L.ta = (Math.max(0, vT - sp0) / a) * 1000; L.da = ((sp0 + vT) / 2) * (L.ta / 1000)
    const dwell = slipped ? 0 : def.dwell
    L.t0 = g.t + dwell; L.T = T; L.arrive = L.t0 + T * 1000
    g.ux = (pts[2] - pts[0]) / L.segLen; g.uy = (pts[3] - pts[1]) / L.segLen
    g.phase = 'run'; g.legId++
    g.hud.prompt = (lane ? def.cue : g.k < n ? def.cue : null); g.hud.hot = false
  }
  // along the leg's polyline, s from its start
  function follow(L, s) {
    while (s > L.sAt + L.segLen && L.idx < L.pts.length - 4) {
      L.sAt += L.segLen; L.idx += 2
      L.segLen = Math.max(1e-6, Math.hypot(L.pts[L.idx + 2] - L.pts[L.idx], L.pts[L.idx + 3] - L.pts[L.idx + 1]))
    }
    const p = L.pts, i = L.idx, f = clamp((s - L.sAt) / L.segLen, 0, 1)
    g.ux = (p[i + 2] - p[i]) / L.segLen; g.uy = (p[i + 3] - p[i + 1]) / L.segLen
    g.x = p[i] + (p[i + 2] - p[i]) * f; g.y = p[i + 1] + (p[i + 3] - p[i + 1]) * f
  }
  function plant() {
    g.plantAt = g.t; cuts[g.k].hitAt = g.t
    const carry = g.sp * legs[g.k + 1].keep
    g.k++
    startLeg(g.x, g.y, carry)
  }
  // He goes wide, or chops his feet: on the way he was going, shedding speed. Nobody falls.
  function slideOut() {
    g.phase = 'slide'; g.slideAt = g.t; cuts[g.k].hitAt = g.t
    g.slideT = S.slide
    g.slideV0 = g.sp; g.slideV1 = g.sp * S.slip
    g.hud.hot = false
    g.fx.push('swoosh')
  }
  function settle(ok, why) {
    const c = cuts[g.k]
    c.res = ok; c.why = why; c.at = g.t
    g.hud.dots[g.k] = ok
    g.fx.push(ok ? 'tap' : 'pop', ok ? 'h:light' : 'h:medium')
  }
  function finishRun() {
    const secs = Math.round((g.t - LEAD) / 10) / 100
    g.secs = secs; g.clock = secs; g.finishAt = g.t
    const made = cuts.filter(c => c.res === true).length
    const hit = made >= n - 1
    const fast = S.clean1 + shift, slow = S.clean0 + shift + (lane ? 1.8 : 1.2)
    const score = (made / n) * 0.7 + clamp((slow - secs) / (slow - fast), 0, 1) * 0.3
    g.done = outcome(score, hit, `${made} of ${n} clean cuts`, { made, of: n, secs }, g.noPress > 0 && g.noPress >= n - made)
    g.made = made
    g.phase = 'out'
    g.hud.prompt = null; g.hud.hot = false
    // (the time is on the slab, in the result's colour: the stamp says what it means)
    g.stamp = { text: made === n ? 'PERFECT' : hit ? 'GOOD CUTS' : 'SLOPPY', good: hit, at: g.t + OFFICIAL_MS + 60, size: 46 }
  }
  // In the 3-cone he turns to run where he's going. In the lane he faces the baseline, always.
  function turnBody(dt) {
    if (lane) return
    if (g.phase === 'set') return
    const L = g.leg
    if (g.phase === 'run' && g.t < L.t0) return   // down at the line, touching it
    const want = Math.atan2(g.ux, g.uy)
    let d = want - g.face
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    g.face += d * (1 - Math.exp(-dt / (g.phase === 'slide' ? 110 : 45)))
  }
  return g
}

// ── The picture: the broadcast camera, the same as every other game ─────────
// a cone standing on the field: painted once, stamped
const coneRes = 3, CONE_W = 26, CONE_H = 30
let coneC = null
function coneSprite() {
  if (coneC || typeof document === 'undefined') return coneC
  coneC = document.createElement('canvas')
  coneC.width = CONE_W * coneRes; coneC.height = CONE_H * coneRes
  const x = coneC.getContext('2d')
  x.scale(coneRes, coneRes); x.translate(CONE_W / 2, CONE_H - 3)
  x.fillStyle = '#c94a0c'; x.beginPath(); x.ellipse(0, 0, 11.5, 2.8, 0, 0, Math.PI * 2); x.fill()
  x.fillStyle = '#ff6a14'; x.strokeStyle = 'rgba(8,12,16,.8)'; x.lineWidth = 1
  x.beginPath(); x.moveTo(-8, 0); x.lineTo(-1.6, -24); x.lineTo(1.6, -24); x.lineTo(8, 0); x.quadraticCurveTo(0, 2.4, -8, 0); x.closePath(); x.fill(); x.stroke()
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(-5.2, -10.5); x.lineTo(5.2, -10.5); x.lineTo(4.1, -15); x.lineTo(-4.1, -15); x.closePath(); x.fill()
  x.fillStyle = 'rgba(0,0,0,.16)'; x.beginPath(); x.moveTo(1.2, -24); x.lineTo(1.6, -24); x.lineTo(8, 0); x.quadraticCurveTo(5, 1.4, 2.4, 1.6); x.closePath(); x.fill()
  return coneC
}
function stampCone(ctx, c, x, y, k, ang) {
  if (!ang) { ctx.drawImage(c, x - (CONE_W / 2) * k, y - (CONE_H - 3) * k, CONE_W * k, CONE_H * k); return }
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang)
  ctx.drawImage(c, -(CONE_W / 2) * k, -(CONE_H - 3) * k, CONE_W * k, CONE_H * k)
  ctx.restore()
}
function cone(ctx, view, fx, fy, size = 1, ang = 0) {
  const p = tilt(view, fx, fy), c = coneSprite()
  if (!c) return
  const k = p.s * size
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(p.x + 4 * k, p.y + 0.5 * k, 12 * k, 3.2 * k, 0.1, 0, Math.PI * 2); ctx.fill()
  stampCone(ctx, c, p.x, p.y, k, ang)
}
// a ring lying flat on the field
function turfRing(ctx, view, x, y, r) {
  const a = tilt(view, x, y), b = tilt(view, x, y + 1)
  ctx.beginPath(); ctx.ellipse(a.x, a.y, Math.max(0.5, r * a.s), Math.max(0.5, r * Math.max(0.2, b.y - a.y)), 0, 0, Math.PI * 2)
}

// ── The L, on a real field: fixed camera, A and B on yard lines five yards apart ──
function coneLayout(h) {
  const ay = h * 0.82, u = Math.min(52, (ay - h * 0.33) / 5)
  return { u, ay }
}
function bakeL(x, view, g, c) {
  const { h } = view, { u, ay } = coneLayout(h), hy = tilt(view, 0, 0).y
  // the same fieldhouse as the 40: a workout, nobody in the seats
  paintRoom(x, view, Math.round(hy), h, false)
  x.fillStyle = '#123f23'; x.fillRect(0, Math.round(hy), view.w, h - hy)
  ground(x, view, f => paintGrass(f, view, { yards: u, offset: ay }), `cone-grass|${g.mirror}`, 0, Math.round((h - hy) * view.px * 0.7))
  floodlight(x, view)
}
// the scouts past the far line, in plain gear: watches up from the whistle, down when he's through. Then they read them
const SCOUT_X = [66, 142, 218, 294]
function drawConeScouts(ctx, view, g, row) {
  const running = g.phase !== 'set' && !g.done, over = g.done ? g.t - g.finishAt : -1
  for (let i = 0; i < 4; i++) {
    const watch = (i === 0 || i === 2) && (running || (g.done && over < 160)), read = over >= OFFICIAL_MS && (i === 1 || (i === 3 && g.done?.hit))
    const up = watch || read, y = row - (i % 2) * 8
    const p = athlete(ctx, view, SCOUT_X[i], y, { color: '#20262c', pants: '#a89a80', skin: skinOf(i * 3), kit: 'plain', dir: 'down', size: 1, pose: up ? 'reach-r' : null })
    if (up) { const k = p.s; stopwatch(ctx, p.x + 14 * k, p.y - 43 * k, 0.8 * k) }
  }
}
// ── Cones are things: he clips them ─────────────────────────────────────────
// Where each plant's nearest cone is, in the drill's own units, worked out once
function plantCones(g, list) {
  if (g.plantOf) return g.plantOf
  g.plantOf = g.legs.slice(0, g.n).map(L => {
    const e = L.pts.length - 2, ex = L.pts[e], ey = L.pts[e + 1]
    let best = 0, dist = 1e9
    for (let i = 0; i < list.length; i++) { const dd = Math.hypot(list[i][0] - ex, list[i][1] - ey); if (dd < dist) { dist = dd; best = i } }
    return best
  })
  g.coneAng = new Float32Array(list.length); g.coneSide = new Float32Array(list.length)
  return g.plantOf
}
// how far each cone's over right now. A clean plant rocks it. Too late and he's gone through it: it's on its side for the rest of the drill.
function coneState(g, list) {
  const of = plantCones(g, list), t = g.t
  g.coneAng.fill(0); g.coneSide.fill(0)
  for (let i = 0; i < g.n; i++) {
    const c = g.cuts[i]
    if (c.hitAt == null) continue
    const j = of[i], age = t - c.hitAt, side = i % 2 ? 1 : -1
    if (c.res === false && c.why === 'late') { g.coneSide[j] = side; g.coneAng[j] = side * 1.42 * Math.min(1, easeOut(age / 210)) + (age < 340 ? side * Math.sin(age / 40) * 0.05 * (1 - age / 340) : 0) }
    else if (!g.coneSide[j] && age < 620) g.coneAng[j] = side * (c.res ? 0.1 : 0.3) * Math.exp(-age / 190) * Math.cos(age / 36)
  }
}
// the marks he leaves, and the turf, or the floor dust, off the plant. Once a plant.
function plantFx(g, view, q, i, cut, court, chalk, ang) {
  if (cut.hitAt == null || cut.fxd) return
  cut.fxd = true
  g.dirt.burst(chalk ? 'dust' : court ? 'dust' : 'turf', q.x, q.y, g.t, { n: chalk ? 6 : cut.res ? 8 : 14, s: Math.max(0.7, q.s * 1.15), ang, spread: 0.95, speed: cut.res ? 1 : 1.35, colors: chalk ? CHALK : court ? FLOOR_DUST : null })
  if (cut.res === false) g.nudge.kick(g.t, 2.4, 0, 1, 170)
}
const CHALK = ['#ffffff', '#e6eaee', '#d7dde2'], FLOOR_DUST = ['#f5ead6', '#efd9b8', '#e2c79e']
// a lean: into a clean cut, away from a bad one. Around his feet, on top of the baked sprite
function leanOf(g) {
  const a = g.t - g.plantAt
  let lean = 0
  if (g.phase === 'slide') lean = -g.ux * 0.3 * (1 - prog(g.t, g.slideAt, g.slideAt + g.slideT))
  else if (a < 300) lean = g.ux * 0.2 * Math.exp(-a / 130)
  if (g.phase === 'run') lean += g.ux * 0.05
  return lean
}
// ── The lane, in the arena ──────────────────────────────────────────────────
// The camera's on the floor behind the foul line, looking down the lane at the hoop, as in Crash the Glass.
// The drill's y runs up from the foul line, so the floor's z is the foul line's plus y.
const LANE_CAM = { H: 10, D: 26, F: 236, maxF: 250, hzAt: 0.385 }, FOUL_Z = 5.25 - 19, FT_RING = 14
const laneZ = y => FOUL_Z + y
const ME_EASE = easedState()
function ringOn(ctx, cam, x, z, r) {
  project(cam, x, 0, z)
  const rf = r / FT_RING
  ctx.beginPath(); ctx.ellipse(PT.x, PT.y, Math.max(0.5, rf * PT.k), Math.max(0.5, (rf * PT.k * cam.H) / PT.z), 0, 0, Math.PI * 2)
}
function coneOn(ctx, cam, x, z, ang = 0) {
  const c = coneSprite()
  project(cam, x, 0, z)
  if (!c) return
  const k = (PT.k * 1.6) / 24
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(PT.x, PT.y + 0.5 * k, 12 * k, 3.2 * k, 0, 0, Math.PI * 2); ctx.fill()
  stampCone(ctx, c, PT.x, PT.y, k, ang)
}
const CORNERS = [[-LW, LH], [LW, LH], [-LW, 0], [LW, 0]]
function drawLane(ctx, g, view) {
  const t = g.t, cuts = g.cuts, n = g.n
  smoothT(g)
  if (!g.arena || g.arena.h !== view.h) g.arena = arenaCam(view.h, LANE_CAM)
  const G = g.arena, cam = G.cam
  g.dirt ??= particles(28, g.n + 11); g.nudge ??= nudge()
  // the practice gym: the wall, the floor, the lane and the one hoop, and nobody in the seats
  layer(ctx, view, `lane-gym-${view.h}-${view.colors.us}`, x => { paintRoom(x, view, Math.round(G.wallY), view.h, true); paintLines(x, cam, view.colors.us); paintHoop(x, cam, view.colors.us) })
  // two scouts by the baseline
  for (let i = 0; i < 2; i++) manAt(ctx, view, cam, i ? 13.5 : -13.5, laneZ(LH) + 2, g.done && t - g.finishAt >= OFFICIAL_MS && i ? POSE.hands : POSE.hold, { jersey: '#20262c', trim: '#a89a80', skin: i ? '#6d4229' : '#c09060', num: null, back: false })
  // his marks on the floor
  ctx.fillStyle = 'rgba(40,20,6,.28)'
  for (let i = 0; i < n; i++) {
    if (cuts[i].hitAt == null) continue
    const pts = g.legs[i].pts, e = pts.length - 2
    ringOn(ctx, cam, pts[e], laneZ(pts[e + 1]), cuts[i].res ? 3.4 : 6); ctx.fill()
  }
  // the way he's going, on this leg only, chalked on the floor
  if (g.phase !== 'out') {
    const pts = g.phase === 'set' ? g.legs[0].pts : g.phase === 'run' || g.phase === 'coast' ? g.leg.pts : g.k + 1 < g.legs.length ? g.legs[g.k + 1].pts : null
    if (pts) {
      ctx.lineCap = 'round'; ctx.setLineDash([7, 9]); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,.55)'
      project(cam, g.x, 0, laneZ(g.y))
      ctx.beginPath(); ctx.moveTo(PT.x, PT.y)
      const from = g.phase === 'run' ? Math.min(g.leg.idx + 2, pts.length - 2) : 2
      for (let i = from; i < pts.length; i += 2) { project(cam, pts[i], 0, laneZ(pts[i + 1])); ctx.lineTo(PT.x, PT.y) }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt'
    }
  }
  // timing: a ring closing on the spot where he plants. The band is the window.
  if (g.k < n && (g.phase === 'run' || g.phase === 'coast')) {
    const pts = g.legs[g.k].pts, e = pts.length - 2, x = pts[e], z = laneZ(pts[e + 1])
    const left = g.leg.arrive - t, cut = cuts[g.k], rate = (RING_R0 - RING_R) / RING_MS
    ringOn(ctx, cam, x, z, RING_R); ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = Math.max(3, rate * g.win * 2); ctx.stroke()
    if (cut.res == null && left < RING_MS) {
      const inside = Math.abs(left) <= g.win
      ringOn(ctx, cam, x, z, Math.max(5, RING_R + left * rate)); ctx.strokeStyle = inside ? GOOD : '#fff'; ctx.lineWidth = inside ? 4.5 : 3.5; ctx.stroke()
    }
  }
  // him, and the cones in depth around him. He faces the baseline all the way: the feet tell you what he's doing
  const myZ = laneZ(g.y), def = g.legs[Math.min(g.k, g.legs.length - 1)], set = g.phase === 'set'
  const step = Math.floor(g.stride * 4) % 4
  const P = set || (g.phase === 'out' && g.sp === 0) ? POSE.off : g.phase !== 'out' && def.mode === 'slide' ? (step % 2 ? POSE.slideA : POSE.slideB) : RUN_F[step]
  coneState(g, CORNERS)
  for (let i = 0; i < 4; i++) if (laneZ(CORNERS[i][1]) >= myZ) coneOn(ctx, cam, CORNERS[i][0], laneZ(CORNERS[i][1]), g.coneAng[i])
  const behind = myZ > 0.1
  const me = () => {
    project(cam, g.x, 0, myZ)
    const lean = leanOf(g), fx = PT.x, fy = PT.y
    if (lean) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(lean); ctx.translate(-fx, -fy) }
    manAt(ctx, view, cam, g.x, myZ, easedPose(ME_EASE, P, g, CLK.dt, 34), { jersey: '#1d57a8', trim: '#ffffff', skin: '#8d5a3b', num: null, back: true, live: true })
    if (lean) ctx.restore()
  }
  if (behind) me()
  if (behind) paintBoard(ctx, cam)
  hoopWith(ctx, cam, null, null)
  if (!behind) me()
  for (let i = 0; i < 4; i++) if (laneZ(CORNERS[i][1]) < myZ) coneOn(ctx, cam, CORNERS[i][0], laneZ(CORNERS[i][1]), g.coneAng[i])
  if (!calm()) g.dirt.draw(ctx, t)
  // and a word as he plants
  for (let i = 0; i < n; i++) {
    const cut = cuts[i]
    if (cut.res == null) continue
    const age = t - cut.at
    if (age > 440) continue
    const pts = g.legs[i].pts, e = pts.length - 2
    project(cam, pts[e], 0, laneZ(pts[e + 1]))
    const qx = PT.x, qy = PT.y, k = PT.k
    plantFx(g, view, { x: qx, y: qy, s: k / 14 }, i, cut, true, false, -Math.PI / 2)
    const word = cut.res ? 'CLEAN' : cut.why === 'early' ? 'TOO SOON' : 'TOO LATE'
    const x = clamp(qx, 62, view.w - 62), y = qy - Math.max(70, 7.4 * k)
    text(ctx, word, x + 1, y + 1, { font: DISPLAY, size: 24, color: 'rgba(0,0,0,.6)' })
    text(ctx, word, x, y, { font: DISPLAY, size: 24, color: cut.res ? '#fff' : BAD })
  }
  coneTail(ctx, g, view)
}
// the stopwatch, always: the same slab as the 40; and the payoff by the stamp
function coneTail(ctx, g, view) {
  const { w } = view, n = g.n
  const over = g.done ? g.t - g.finishAt : -1, official = over >= OFFICIAL_MS
  if (g.done && !g.official && official) { g.official = true; g.fx.push('stamp') }
  const q = g.done ? officialPunch(over) : 1
  if (q !== 1) { ctx.save(); ctx.translate(w / 2, 70); ctx.scale(q, q); ctx.translate(-w / 2, -70) }
  clockSlab(ctx, view, g.clock.toFixed(2), official ? (g.done.hit ? GOOD : BAD) : '#fff')
  if (q !== 1) ctx.restore()
  placeStamp(g.stamp, view)
  if (g.done) officialStrip(ctx, view, over, g.done.hit, `${g.made} OF ${n} CLEAN`)
}

// every look he'll need, a few a frame while he's in his stance
function warmUp(g) {
  if (!g.warmList) {
    const me = { color: '#eef1f4', trim: '#f4efe6', pants: '#20262c', skin: '#8d5a3b', number: null, kit: 'plain', carry: false }
    g.warmList = []
    for (let step = 0; step < 4; step++) {
      if (g.lane) for (const pose of [null, 'slide', 'back']) g.warmList.push({ ...me, dir: 'up', step, pose })
      else for (const dir of ['up', 'down', 'side']) g.warmList.push({ ...me, dir, step, pose: null })
    }
    if (g.lane) g.warmList.push({ ...me, dir: 'up', step: null, pose: 'ready' })
    else {
      for (const dir of ['up', 'down']) g.warmList.push({ ...me, dir, step: null, pose: 'touch' })
      g.warmList.push({ ...me, dir: 'up', step: null, pose: 'hips' })
      for (let i = 0; i < 4; i++) for (const pose of [null, 'reach-r']) g.warmList.push({ color: '#20262c', trim: '#f4efe6', pants: '#a89a80', skin: skinOf(i * 3), number: null, kit: 'plain', carry: false, dir: 'down', step: null, pose })
    }
  }
  for (let i = 0; i < 3 && g.warmList.length; i++) warmAthlete(g.warmList.pop())
}
export function draw(ctx, g, view) {
  if (g.lane) return drawLane(ctx, g, view)
  warmUp(g)
  const { w, h } = view, t = g.t, cuts = g.cuts, n = g.n, c = view.colors
  // the drill's own units to the flat field
  const m = coneLayout(h)
  g.dirt ??= particles(30, g.n + 7); g.nudge ??= nudge()
  layer(ctx, view, `cone-gym|${g.mirror}`, x => bakeL(x, view, g, c))
  const ox = 180 - g.mirror * 2.5 * m.u, oy = m.ay, ux = m.u
  const fx = wx => ox + wx * ux, fy = wy => oy - wy * ux
  drawConeScouts(ctx, view, g, oy - ux * 5 - 92)
  // the timing gate, at the start and the finish: red until he's through it
  for (const X of [-2.3, 2.3]) {
    const p = tilt(view, fx(X * 0.72 - 0.2), fy(0)), k = p.s
    ctx.fillStyle = '#14181c'; ctx.fillRect(p.x - k, p.y - 30 * k, 2 * k, 30 * k); ctx.fillRect(p.x - 5 * k, p.y - 36 * k, 10 * k, 7 * k)
    ctx.fillStyle = g.done ? GOOD : BAD; ctx.fillRect(p.x - 2.4 * k, p.y - 34 * k, 4.8 * k, 3.4 * k)
  }
  // the marks his cleats have torn up so far
  ctx.fillStyle = 'rgba(8,28,14,.42)'
  for (let i = 0; i < n; i++) {
    if (cuts[i].hitAt == null) continue
    const pts = g.legs[i].pts, e = pts.length - 2
    turfRing(ctx, view, fx(pts[e]), fy(pts[e + 1]), cuts[i].res ? 5 : 9); ctx.fill()
  }

  // the way he's going, on this leg only, chalked on the ground
  if (g.phase !== 'out') {
    const pts = g.phase === 'set' ? g.legs[0].pts : g.phase === 'run' || g.phase === 'coast' ? g.leg.pts : g.k + 1 < g.legs.length ? g.legs[g.k + 1].pts : null
    if (pts) {
      ctx.lineCap = 'round'; ctx.setLineDash([7, 9]); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,.5)'
      const a = tilt(view, fx(g.x), fy(g.y))
      ctx.beginPath(); ctx.moveTo(a.x, a.y)
      const from = g.phase === 'run' ? Math.min(g.leg.idx + 2, pts.length - 2) : 2
      for (let i = from; i < pts.length; i += 2) { const q = tilt(view, fx(pts[i]), fy(pts[i + 1])); ctx.lineTo(q.x, q.y) }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt'
    }
  }
  // timing: a ring closing on the spot where he plants. The band is the window.
  if (g.k < n && (g.phase === 'run' || g.phase === 'coast')) {
    const pts = g.legs[g.k].pts, e = pts.length - 2, x = fx(pts[e]), y = fy(pts[e + 1])
    const left = g.leg.arrive - t, cut = cuts[g.k]
    const rate = (RING_R0 - RING_R) / RING_MS
    turfRing(ctx, view, x, y, RING_R); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = Math.max(4, rate * g.win * 2); ctx.stroke()
    if (cut.res == null && left < RING_MS) {
      const inside = Math.abs(left) <= g.win
      turfRing(ctx, view, x, y, Math.max(5, RING_R + left * rate)); ctx.strokeStyle = inside ? GOOD : '#fff'; ctx.lineWidth = inside ? 4.5 : 3.5; ctx.stroke()
    }
  }

  // him, and the cones in depth around him
  const rowMe = fy(g.y)
  const L_CONES = g.lCones ?? (g.lCones = [[0, 5], [g.mirror * 5, 5], [0, 0]])
  coneState(g, L_CONES)
  const eachCone = near => {
    for (let i = 0; i < 3; i++) {
      const row = fy(L_CONES[i][1])
      if ((row > rowMe) === near) cone(ctx, view, fx(L_CONES[i][0]), row, 1.2, g.coneAng[i])
    }
  }
  eachCone(false)
  const def = g.legs[Math.min(g.k, g.legs.length - 1)]
  const set = g.phase === 'set'
  const touching = !g.lane && g.phase === 'run' && t < g.leg.t0
  let dir, pose = null, step = set ? null : Math.floor(g.stride * 4) % 4
  if (set || touching) {
    dir = set ? 'up' : g.leg.pts[3] > g.leg.pts[1] ? 'down' : 'up'
    pose = 'touch'; step = null
  } else dir = dirOf(g.ux, -g.uy)
  // the drill's over: he's walked back and got his hands on his hips
  if (g.phase === 'out' && g.sp === 0) { dir = 'up'; step = null; pose = 'hips' }
  const lean = leanOf(g), me = tilt(view, fx(g.x), rowMe)
  if (lean) { ctx.save(); ctx.translate(me.x, me.y); ctx.rotate(lean); ctx.translate(-me.x, -me.y) }
  athlete(ctx, view, fx(g.x), rowMe, { color: '#eef1f4', skin: '#8d5a3b', kit: 'plain', dir, step, pose, size: 1.35 })
  if (lean) ctx.restore()
  eachCone(true)
  if (!calm()) g.dirt.draw(ctx, t)
  vignette(ctx, view)
  // and a word as he plants
  for (let i = 0; i < n; i++) {
    const cut = cuts[i]
    if (cut.res == null) continue
    const age = t - cut.at
    if (age > 440) continue
    const pts = g.legs[i].pts, e = pts.length - 2, q = tilt(view, fx(pts[e]), fy(pts[e + 1]))
    plantFx(g, view, q, i, cut, false, !!g.legs[i].touch, Math.atan2(g.uy * 0.6, -g.ux) )
    const word = cut.res ? 'CLEAN' : cut.why === 'early' ? 'TOO SOON' : 'TOO LATE'
    const x = clamp(q.x, 62, w - 62), y = q.y - 62 * q.s
    text(ctx, word, x + 1, y + 1, { font: DISPLAY, size: 24, color: 'rgba(0,0,0,.6)' })
    text(ctx, word, x, y, { font: DISPLAY, size: 24, color: cut.res ? '#fff' : BAD })
  }

  coneTail(ctx, g, view)
}
