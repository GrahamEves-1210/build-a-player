// Bench: the combine's 225 (the NBA's 185). In the same room as the 40, side on: the same athlete flat
// on the bench, a bar with round plates, the spotter at his head with his hands on it, scouts counting. Each tap drives the bar, gravity takes it back, at lockout the rep
// counts and it comes down on its own. Every rep is heavier: strength sets a real ceiling. As the
// reps climb the taps a rep needs climb too, until the taps can't beat gravity any more: the bar
// grinds, and that's the set. Faster thumbs get closer to the ceiling, never past it.
import { clamp, lerp, outcome, rngOf, prog, easeOut, layer, circle, text, DISPLAY, LABEL, GOOD, BAD } from './kit.js'
import { HEAD_R, curve, GEAR, GEAR_NBA, INK, clockSlab, line, runLeg, armThrough, torsoSide, sideHead, hand, paintRoom, standAt, SCOUT, FOLK_SKIN } from './dash.js'
import { benchCeil } from './combineNorms.js'

export const how = {
  bench: 'Tap fast. Drive the bar to lockout, as many reps as you can.',
  nbench: 'Tap fast. Drive the bar to lockout, as many reps as you can.',
}

const SECS = 10
const G = 10            // gravity, in full lifts a second squared
const D = 2             // what the bar's speed bleeds a second
const LOWER = 110       // ms: the bar back to the chest
// the push a tap gives, by grade: how much of the ceiling the set can get to
const PUSH = {
  bench: [[1, 1.556], [3, 1.698], [5, 1.825], [8, 2.125], [11, 2.623]],
  nbench: [[1, 1.153], [3, 1.288], [5, 1.351], [8, 1.612], [11, 1.738]],
}
const P_FAIL = 2.2
// A tap's push grows with the time since the last one: a slower, fuller press lifts nearly what two
// quick ones do, up to a point, so a steady 6 a second isn't shut out. Above 9.5 a second the bar is moving and each tap adds more: real thumbs reach the ceiling
const fuller = ms => (ms < 105 ? Math.pow(105 / Math.max(ms, 52), 0.75) : Math.pow(Math.min(ms, 190) / 105, 1.05))
const gaussOf = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export function make({ v, seed, def, game, pos }) {
  const load = def?.load ?? (game === 'nbench' ? 0.62 : 1)
  const r = rngOf(seed)
  const ceil = benchCeil(game, pos, v)
  const need = Math.max(1, Math.round(ceil * (load < 1 ? 0.52 : 0.6)))
  // strength on the day: some days the bar's lighter
  const form = 1 + clamp(gaussOf(r), -2.2, 2.2) * 0.045
  const J = curve(v, PUSH[game] ?? PUSH.bench) * form
  const failAt = k => Math.min(0.995, Math.pow(k / ceil, P_FAIL))
  const end = SECS * 1000
  const g = {
    t: 0, game, zones: 'none', fx: [], done: null, outro: 1700, stamp: null,
    load, ceil, need, reps: 0, h: 0, vel: 0, phase: 'press', lowerAt: 0, preload: 0,
    lastTap: -300, power: 0, strain: 0, repAt: -999, tapAt: -999, overAt: null, passedAt: null,
    left: SECS, hud: { prompt: 'TAP TAP TAP' },
    tick(dt) {
      g.t += dt
      const s = dt / 1000
      g.left = Math.max(0, (end - g.t) / 1000)
      // how much of a lift the recent taps are worth, against gravity: the grind
      g.power *= Math.exp(-s / 0.35)
      const f = failAt(g.reps)
      const net = (g.power / 0.35) * (1 - f) - G
      const want = clamp(1 - net / (G * 0.55), 0, 1)
      g.strain += (want - g.strain) * (1 - Math.exp(-dt / 220))
      if (g.done) return
      if (g.phase === 'lower') {
        g.h = 1 - prog(g.t, g.lowerAt, g.lowerAt + LOWER)
        if (g.t >= g.lowerAt + LOWER) { g.phase = 'press'; g.h = 0; g.vel = g.preload; g.preload = 0 }
      } else {
        g.vel += -G * s
        g.vel *= Math.exp(-D * s)
        g.h += g.vel * s
        if (g.h <= 0) { g.h = 0; g.vel = Math.max(0, g.vel) }
        if (g.h >= 1) {
          g.h = 1; g.vel = 0; g.reps++; g.repAt = g.t
          g.phase = 'lower'; g.lowerAt = g.t; g.preload = 0
          g.fx.push('tap', 'h:medium')
          if (g.reps === need) { g.passedAt = g.t; g.fx.push('swoosh') }
          g.hud.prompt = null
        }
      }
      if (g.reps > 0) g.hud.prompt = g.strain > 0.72 && g.left > 0.3 ? 'GRIND' : null
      if (g.t >= end) finish()
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const gap = g.t - g.lastTap
      if (gap < 30) return                    // a bounce, not a tap
      g.lastTap = g.t; g.tapAt = g.t
      const push = J * fuller(gap) * (1 - failAt(g.reps))
      g.power += J * fuller(gap)
      if (g.phase === 'lower') g.preload = Math.min(push, g.preload + push)
      else g.vel += push
    },
  }
  function finish() {
    const reps = g.reps
    const hit = reps >= need
    const score = hit ? 0.5 + 0.5 * clamp((reps - need) / Math.max(1, ceil - need), 0, 1) : 0.5 * clamp(reps / need, 0, 1)
    g.done = outcome(score, hit, `${reps} rep${reps === 1 ? '' : 's'}`, { reps })
    g.overAt = g.t; g.overH = g.h
    g.hud.prompt = null
    // (the count is up on the wall, in the result's colour: the stamp says what it means)
    g.stamp = { text: hit ? 'GOOD SET' : 'TOO FEW', good: hit, at: g.t + 300, size: 46 }
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────
// The room the 40 runs in, and the runner's own body lying on a bench, drawn at his scale. Everything
// here is in his units: x along the bench, feet to the right, y up from the floor (negative). The bar
// runs away from the camera at a slant, so the hands, the chest and the face all stay in view: the
// near plates sit over his hips, the far ones up past his head.
const STEEL = '#c6ccd1', STEEL_D = '#8c949b'
const SPOTTER = { top: '#8b949c', pants: '#a89a80', shorts: '#a89a80', skin: '#6d4229', skinD: '#553220', shoe: '#20262c', sole: '#e8ebe6', hair: '#17120e' }
const SLANT = 0.2                 // how far the bar drops on the screen per unit it comes toward the camera
const ARM = 20.5                   // his upper arm and forearm. (A shade longer than the runner's: the press needs the travel)
let jx = 0, jy = 0
// two-bone reach: the elbow, on the given side of the line from a to b
function reach(ax, ay, bx, by, l1, l2, side) {
  const dx = bx - ax, dy = by - ay, full = Math.hypot(dx, dy) || 1
  const d = clamp(full, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01)
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  jx = ax + (dx / full) * a + side * h * (dy / full)
  jy = ay + (dy / full) * a - side * h * (dx / full)
}
// A plate, flat on to the camera: rubber, a raised rim, its weight, the steel hub
function plate(ctx, x, y, R) {
  ctx.fillStyle = '#1d2329'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6
  circle(ctx, x, y, R); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = 0.8
  circle(ctx, x, y, R * 0.82); ctx.stroke()
  ctx.fillStyle = STEEL; ctx.strokeStyle = INK; ctx.lineWidth = 1
  circle(ctx, x, y, R * 0.2); ctx.fill(); ctx.stroke()
}
export function draw(ctx, g, view) {
  const { w, h } = view
  const k = clamp((h - 520) / 260, 0, 1)
  const b = lerp(1.4, 2.05, k)                 // his scale: a step closer than the runner, nobody's running
  const base = Math.round(h - lerp(96, 124, k)) // the floor under him: the prompt and the stamp sit below his feet
  const hz = Math.round(base - 34 * b)
  const court = g.load < 1
  const cx = w / 2 - 2 * b
  layer(ctx, view, `bench-room-${g.game}-${hz}-${court ? view.colors.us + view.colors.trim : ''}`, x => paintRoom(x, view, hz, base, court))
  const c = court ? GEAR_NBA : GEAR

  // the bar's travel. Bottom: just off his chest. Top: arms locked
  const shX = -14, shY = -37
  const botY = shY - 18, topY = shY - ARM * 2 * 0.97
  let hh = g.h
  if (g.done) hh = lerp(g.overH ?? g.h, 1.03, easeOut(prog(g.t, g.overAt, g.overAt + 480)))
  const strain = g.done ? 0 : g.strain
  const tick = g.t / 16
  const shake = (strain * strain * 1.6) / b
  const barY = lerp(botY, topY, hh) + Math.sin(tick * 1.9) * shake + Math.sin(tick * 3.1) * shake * 0.5
  const raised = g.t - g.repAt < 240 && !g.done
  const R = court ? 12.5 : 14
  const bx = -7                                 // the middle of the bar, over his chest
  const onBar = dx => [bx + dx, barY + dx * SLANT]
  const END_N = 30, END_F = 22                  // (the far half of the bar is further off, so shorter)

  // scouts along the far side, one with a hand up on every rep
  if (!court) {
    standAt(ctx, w - 72, hz + 7, { ...SCOUT, skin: FOLK_SKIN[1], size: 1.62 })
    standAt(ctx, w - 28, hz + 7, { ...SCOUT, skin: FOLK_SKIN[2], size: 1.62, pose: raised ? 'reach-r' : null })
  }

  ctx.save()
  ctx.translate(cx, base); ctx.scale(b, b)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const [fpx, fpy] = onBar(-END_F), [npx, npy] = onBar(END_N)

  // the shadow on the floor
  ctx.fillStyle = court ? 'rgba(40,18,4,.3)' : 'rgba(0,18,6,.32)'
  ctx.beginPath(); ctx.ellipse(-8, 1, 62, 3.6, 0, 0, Math.PI * 2); ctx.fill()
  // the rack: two uprights behind him, a hook at the top of each
  for (const dx of [-14, 14]) {
    const [px] = onBar(dx), ty = topY - 8
    line(ctx, px, ty, px, dx < 0 ? -6 : -1, 3.4, INK); line(ctx, px, ty, px, dx < 0 ? -6 : -1, 1.8, STEEL_D)
    ctx.fillStyle = INK; ctx.fillRect(px - 2.6, ty + 5, 5.2, 2.2)
  }
  // the far plates, past him
  plate(ctx, fpx + 2.4, fpy + 2.4 * SLANT, R * 0.92, null)
  plate(ctx, fpx, fpy, R * 0.92, null)

  // the spotter, on his feet at the head of the bench, bent to the bar
  const spHipX = -62, spHipY = -47, spLean = 0.26
  const ssx = spHipX + Math.sin(spLean) * 28, ssy = spHipY - Math.cos(spLean) * 28
  ctx.save(); ctx.translate(spHipX, spHipY)
  runLeg(ctx, -0.05, 0.15, -0.2, true, SPOTTER)
  ctx.rotate(spLean); torsoSide(ctx, SPOTTER); ctx.rotate(-spLean)
  runLeg(ctx, 0.3, 0.5, -0.2, false, SPOTTER)
  ctx.restore()
  const shx = ssx + 6, shy = ssy - 16
  line(ctx, ssx + 3, ssy - 4, shx, shy, 8.4, INK); line(ctx, ssx + 3, ssy - 4, shx, shy, 6.5, SPOTTER.skinD)
  sideHead(ctx, shx, shy, HEAD_R, SPOTTER.skin, SPOTTER.hair, 0.4)

  // the bench
  ctx.fillStyle = STEEL_D; ctx.strokeStyle = INK; ctx.lineWidth = 1.2
  for (const lx of [-34, 8]) { ctx.beginPath(); ctx.rect(lx - 1.8, -22, 3.6, 22); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.rect(lx - 7, -2, 14, 2.4); ctx.fill(); ctx.stroke() }
  ctx.fillStyle = '#1a2230'; ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.roundRect(-46, -28, 66, 7.5, 2.4); ctx.fill(); ctx.stroke()

  // him, the far side first. The hips sit on the pad, the thighs run out level, the shins come straight down
  const hipX = 14, hipY = -34.5
  ctx.save(); ctx.translate(hipX - 1.5, hipY - 1); runLeg(ctx, 1.22, 1.28, -0.06, true, c); ctx.restore()
  // far arm, up to the bar behind the chest
  const [fhx, fhy] = onBar(-2)
  reach(shX - 2, shY - 3, fhx, fhy, ARM, ARM, -1)
  const fex = jx, fey = jy
  armThrough(ctx, shX - 2, shY - 3, fex, fey, fhx, fhy, true, c)
  // the bar, plate to plate
  line(ctx, fpx, fpy, npx, npy, 3.2, INK); line(ctx, fpx, fpy, npx, npy, 1.7, STEEL)
  hand(ctx, fhx, fhy, 3.5, '#6f452c')
  // the torso, flat: the spine runs to the left, the chest faces up
  ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(-Math.PI / 2); torsoSide(ctx, c); ctx.restore()
  // the head, on the pad, face to the ceiling
  const hdX = -31.5, hdY = -39.5
  line(ctx, -19, -38, hdX, hdY, 8.4, INK); line(ctx, -19, -38, hdX, hdY, 6.5, c.skinD)
  sideHead(ctx, hdX, hdY, HEAD_R, c.skin, c.hair, -Math.PI / 2)
  // the near leg
  ctx.save(); ctx.translate(hipX, hipY); runLeg(ctx, 1.22, 1.28, -0.06, false, c); ctx.restore()

  // the spotter's arms: both hands on the bar, between his
  for (const dx of [-12, -7]) {
    const [hx, hy] = onBar(dx)
    reach(ssx, ssy + 1, hx, hy, 23, 22, -1)
    armThrough(ctx, ssx, ssy + 1, jx, jy, hx, hy, dx < -8, SPOTTER)
  }
  // his near arm, the fist round the bar
  const [nhx, nhy] = onBar(11.5)
  reach(shX + 1, shY, nhx, nhy, ARM, ARM, -1)
  armThrough(ctx, shX + 1, shY, jx + (strain * strain * Math.sin(tick * 2.7)) / b, jy, nhx, nhy, false, c)
  // the near plates, in front of everything: two, side by side
  plate(ctx, npx - 2.6, npy - 2.6 * SLANT, R, null)
  plate(ctx, npx, npy, R)
  ctx.restore()

  drawBoard(ctx, g, view, base + (topY - END_F * SLANT - R) * b)
}
// the slab on top, the same as the 40's; the rep count big over the crowd
function drawBoard(ctx, g, view, roomBottom) {
  const { w } = view
  const y = 44, ph = 52
  clockSlab(ctx, view, g.left.toFixed(2), g.done ? (g.done.hit ? GOOD : BAD) : g.left < 3 ? BAD : '#fff', g.left / SECS)
  const passed = g.reps >= g.need
  const dim = 'rgba(255,255,255,.72)', row = y + ph / 2 - 1
  const pair = (x, align, label, value, col) => {
    ctx.font = `17px ${LABEL}`; const lw = ctx.measureText(label).width + 6
    ctx.font = `24px ${DISPLAY}`; const vw = ctx.measureText(value).width
    const x0 = align === 'left' ? x : x - lw - vw
    text(ctx, label, x0, row, { font: LABEL, size: 17, align: 'left', color: dim })
    text(ctx, value, x0 + lw, row, { font: DISPLAY, size: 24, align: 'left', color: col })
  }
  pair(12, 'left', 'NEED', String(g.need), passed ? GOOD : '#fff')
  const top = y + ph, room = Math.max(70, roomBottom - top)
  if (g.stamp) g.stamp.y = view.h * 0.885
  // the reps, punched on each one
  const big = Math.min(100, room * 0.8)
  const a = g.t - g.repAt
  const q = 1 + 0.2 * (1 - easeOut(clamp(a / 130, 0, 1)))
  ctx.save(); ctx.translate(w / 2, top + room / 2); ctx.scale(q, q)
  text(ctx, String(g.reps), 0, 2, { font: DISPLAY, size: big, color: g.done ? (g.done.hit ? GOOD : BAD) : passed ? GOOD : '#fff' })
  ctx.restore()
}
