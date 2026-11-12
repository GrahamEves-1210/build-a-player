// Bench: the combine's 225 (the NBA's 185). The broadcast's shot of it: the lifter on his back on the bench, from
// his side, the spotter over his head, the count on a board hung from the roof. Each tap drives the bar, gravity takes it back, at lockout the rep
// counts and it comes down on its own. Every rep is heavier: strength sets a real ceiling. As the
// reps climb the taps a rep needs climb too, until the taps can't beat gravity any more: the bar
// grinds, and that's the set. Faster thumbs get closer to the ceiling, never past it.
import { clamp, lerp, outcome, rngOf, prog, easeOut, easeInOut, layer, circle, text, keyCap, particles, nudge, DISPLAY, LABEL, GOOD, BAD, GOLD } from './kit.js'
import { curve, GEAR, GEAR_NBA, clockSlab, officialStrip, officialPunch, OFFICIAL_MS, calm, standAt, clipboard, SCOUT, FOLK_SKIN } from './dash.js'
import { INK } from './rig.js'
import { limb, limbShade, bareHead } from './art.js'
import { benchCeil } from './combineNorms.js'

export const how = {
  bench: 'Tap fast. Drive the bar to lockout, as many reps as possible.',
  nbench: 'Tap fast. Drive the bar to lockout, as many reps as possible.',
}

const SECS = 10
const G = 10            // gravity, in full lifts a second squared
const D = 2             // what the bar's speed bleeds a second
const LOWER = 110       // ms: the bar back to the chest
const BIG_AT = 21       // the ceiling past which a tap's push grows with it
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
  // a big man's set (a ceiling past about 21: the combine's real counts, lib/mg/combineNorms.js, a defensive tackle's 28 on a
  // normal day) moves the bar further a tap, so his set comes as quick as a running back's: ten seconds of tapping
  // reaches the same share of either ceiling
  const big = Math.max(1, ceil / BIG_AT)
  const J = curve(v, PUSH[game] ?? PUSH.bench) * form * big
  const failAt = k => Math.min(0.995, Math.pow(k / ceil, P_FAIL))
  const end = SECS * 1000
  const g = {
    t: 0, game, zones: 'none', fx: [], done: null, outro: 2500, stamp: null,
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
    g.stamp = { text: hit ? 'GOOD SET' : 'TOO FEW', good: hit, at: g.t + OFFICIAL_MS + 160, size: 46 }
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────
// The broadcast's shot of it: from his side and a little above, his head to the left under the rack, so the bar
// comes at the camera a little and you see down it from plate to plate. The spotter stands over his head with his
// hands ready under the bar; the staff and the other prospects are along the padded wall; the count is on the board
// hung from the roof. The same hall, the same plain kit and the same one ink line as the 40 and the throwing drills.
// (Everything here is drawn from what the rules say: the bar's height, the reps, the strain. None of it feeds back.)
const STEEL = '#c6ccd1', STEEL_D = '#8c949b', STEEL_DD = '#5d656c', RUBBER = '#1b2228', RUBBER_L = '#2b343c', BEAM = '#080c11'
const PAD = '#151a1f', PAD_L = '#262e36', MINT = '#3ddcb0'
const SPOT = { top: '#2a3540', topD: '#1f2830', trim: '#3ddcb0', pants: '#a89a80', pantsD: '#857a64', skin: '#6d4229', skinD: '#55331f', shoe: '#20262c', sole: '#e8ebe6' }
// The bar's half-length, out to the inside of the collar, as the camera sees it, in his units: the near end comes
// down and to the right, at the camera; the far end goes up and to the left, away from it
const AX = 14, AY = 9, ANG = Math.atan2(AY, AX)
const THIGH = 24, SHIN = 25, UARM = 19, FARM = 20
// where the middle of the bar is: on his chest, locked out over his shoulders, back on the hooks over his eyes
const BOT = [-13, -43], TOP = [-21, -71], HOOK = [-45, -73]
const GRIP = 0.5, POST = 0.86
// the plates on each end: where along the bar (in half-lengths), how big, what's on them
const PLATES = { 1: [[1.04, 10.6, '45'], [1.13, 10.6, '45']], 0: [[1.04, 10.6, '45'], [1.12, 8.2, '25']] }
const CHALK = ['#ffffff', '#e6eaee', '#d7dde2']

let BG = null
function benchOf(view) {
  if (BG && BG.h === view.h) return BG
  const h = view.h, U = h / 640, floor = Math.round(h * 0.8), horizon = Math.round(floor - 62 * U), padH = Math.round(44 * U)
  const bb = Math.round(Math.min(186, h * 0.24))
  const truss = Math.round(bb + 26 + (horizon - padH - bb - 26) * 0.2)
  BG = { h, U, floor, horizon, padH, truss, s: 1.86 * U, ox: 204 }
  return BG
}

// two bones from a to where the end has to be; side (+1 or -1) is which way the joint goes
const J = { jx: 0, jy: 0, ex: 0, ey: 0 }
function bend(ax, ay, tx, ty, l1, l2, side) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001
  const mx = l1 + l2 - 0.05, mn = Math.abs(l1 - l2) + 0.5
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx }
  if (d < mn) { dx *= mn / d; dy *= mn / d; d = mn }
  const a = Math.atan2(dy, dx), c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), b = a + side * Math.acos(c)
  J.jx = ax + Math.cos(b) * l1; J.jy = ay + Math.sin(b) * l1; J.ex = ax + dx; J.ey = ay + dy
}

// ── The hall ────────────────────────────────────────────────────────────
// The throwing drill's building: dark steel siding, lamps off a truss, the padded wall with the one word on it.
// The floor is turf at the football combine and a gym floor at the NBA's. On it, the platform, the bench and its rack:
// none of that moves, so it's painted once.
function paintBenchHall(x, view, G, court) {
  const { U, floor, padH, truss, s, ox } = G, w = view.w, h = view.h, H = G.horizon, wallB = H - padH
  const wall = x.createLinearGradient(0, 40, 0, wallB)
  wall.addColorStop(0, '#0b1016'); wall.addColorStop(0.6, court ? '#14181f' : '#151d26'); wall.addColorStop(1, court ? '#1b2029' : '#1d2832')
  x.fillStyle = wall; x.fillRect(0, 0, w, wallB)
  for (let i = 12; i < w; i += 44) { x.fillStyle = 'rgba(0,0,0,.26)'; x.fillRect(i, 0, 1.5, wallB); x.fillStyle = 'rgba(255,255,255,.022)'; x.fillRect(i + 1.5, 0, 1, wallB) }
  for (const lx of [74, 290]) {
    x.fillStyle = 'rgba(214,228,238,.04)'
    x.beginPath(); x.moveTo(lx - 14, truss + 37); x.lineTo(lx + 14, truss + 37); x.lineTo(lx + 66, wallB); x.lineTo(lx - 66, wallB); x.closePath(); x.fill()
  }
  x.fillStyle = BEAM; x.fillRect(0, truss, w, 5); x.fillRect(0, truss + 21, w, 3)
  x.strokeStyle = BEAM; x.lineWidth = 1.6; x.beginPath()
  for (let i = -6; i < w; i += 24) { x.moveTo(i, truss + 4); x.lineTo(i + 12, truss + 22); x.lineTo(i + 24, truss + 4) }
  x.stroke()
  for (const lx of [74, 290]) { x.fillStyle = BEAM; x.fillRect(lx - 1, truss + 24, 2, 7); x.fillRect(lx - 15, truss + 31, 30, 4); x.fillStyle = '#c9d3da'; x.fillRect(lx - 13, truss + 35, 26, 1.6) }
  // the padded wall
  x.fillStyle = court ? '#3a1a0c' : '#102a44'; x.fillRect(0, wallB, w, padH)
  x.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 30; i < w; i += 60) x.fillRect(i, wallB, 1.5, padH)
  x.fillStyle = court ? '#ee7a2c' : '#2f7fb8'; x.fillRect(0, wallB, w, 4 * U); x.fillRect(0, H - 6 * U, w, 3 * U)
  for (const f of [0.25, 0.75]) text(x, 'COMBINE', w * f, wallB + padH / 2, { font: DISPLAY, size: 21 * U, color: 'rgba(255,255,255,.2)', track: 4 })
  // the floor
  if (court) {
    const wood = x.createLinearGradient(0, H, 0, h)
    wood.addColorStop(0, '#8a5a30'); wood.addColorStop(0.4, '#a26c3c'); wood.addColorStop(1, '#b67c47')
    x.fillStyle = wood; x.fillRect(0, H, w, h - H)
    // the boards, end to end, the rows wider apart toward the camera
    let y = H, gap = 2.2, row = 0
    while (y < h) {
      x.fillStyle = 'rgba(40,20,6,.22)'; x.fillRect(0, y, w, 0.8)
      const len = 70 + gap * 8
      for (let bx = ((row * 37) % len) - len; bx < w; bx += len) x.fillRect(bx, y, 0.8, gap)
      if (row % 3 === 1) { x.fillStyle = 'rgba(255,230,190,.05)'; x.fillRect(0, y + 1, w, gap - 1) }
      y += gap; gap *= 1.1; row++
    }
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, H, w, 2 * U)
    x.fillStyle = 'rgba(255,255,255,.62)'; x.fillRect(0, H + 9 * U, w, 1.8 * U)
  } else {
    const turf = x.createLinearGradient(0, H, 0, h)
    turf.addColorStop(0, '#1d6a3b'); turf.addColorStop(0.35, '#23793f'); turf.addColorStop(1, '#2a8a4a')
    x.fillStyle = turf; x.fillRect(0, H, w, h - H)
    const vx = 180, vy = H - 150 * U, at = (fx, y) => vx + (fx - vx) * (y - vy) / (floor - vy)
    x.fillStyle = 'rgba(0,0,0,.055)'
    for (let fx = -300; fx < w + 300; fx += 120) { x.beginPath(); x.moveTo(at(fx, H), H); x.lineTo(at(fx + 60, H), H); x.lineTo(at(fx + 60, h), h); x.lineTo(at(fx, h), h); x.closePath(); x.fill() }
    let y = H, gap = 1.4
    while (y < h) { x.fillStyle = 'rgba(0,0,0,.055)'; x.fillRect(0, y, w, 1); y += gap; gap *= 1.11 }
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, H, w, 2 * U)
    x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, H + 5 * U, w, 1.6 * U)
  }
  // the platform, the bench and the rack's far side, in his units
  x.save(); x.translate(ox, floor); x.scale(s, s)
  x.lineCap = 'round'; x.lineJoin = 'round'
  const P = (ux, f) => [ux + AX * f, AY * f]
  // the platform: a slab of black rubber on the floor, its front edge toward the camera
  const [ax0, ay0] = P(-98, -1.25), [ax1, ay1] = P(64, -1.25), [ax2, ay2] = P(64, 1.25), [ax3, ay3] = P(-98, 1.25)
  x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.moveTo(ax0 - 3, ay0 + 2); x.lineTo(ax1 + 5, ay1 + 2); x.lineTo(ax2 + 5, ay2 + 6); x.lineTo(ax3 - 3, ay3 + 6); x.closePath(); x.fill()
  x.fillStyle = '#12171c'; x.beginPath(); x.moveTo(ax3, ay3 - 2.6); x.lineTo(ax2, ay2 - 2.6); x.lineTo(ax2, ay2); x.lineTo(ax3, ay3); x.closePath(); x.fill()
  x.fillStyle = '#1e252c'; x.strokeStyle = INK; x.lineWidth = 0.9
  x.beginPath(); x.moveTo(ax0, ay0 - 2.6); x.lineTo(ax1, ay1 - 2.6); x.lineTo(ax2, ay2 - 2.6); x.lineTo(ax3, ay3 - 2.6); x.closePath(); x.fill(); x.stroke()
  x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 0.6; x.beginPath()
  for (let k = 1; k < 6; k++) { const f = -1.25 + k * (2.5 / 6), [p0, q0] = P(-98, f), [p1, q1] = P(64, f); x.moveTo(p0, q0 - 2.6); x.lineTo(p1, q1 - 2.6) }
  x.stroke()
  x.fillStyle = view.accent; x.globalAlpha = 0.75; x.beginPath(); x.moveTo(ax3, ay3 - 2.6); x.lineTo(ax2, ay2 - 2.6); x.lineTo(ax2, ay2 - 1.8); x.lineTo(ax3, ay3 - 1.8); x.closePath(); x.fill(); x.globalAlpha = 1
  // the rack's base: a steel foot across under his head, from the far upright to the near one
  const [fb0, fb1] = P(HOOK[0], -POST), [nb0, nb1] = P(HOOK[0], POST)
  for (const [col, wd] of [[INK, 5.2], [STEEL_DD, 3.6]]) { x.strokeStyle = col; x.lineWidth = wd; x.beginPath(); x.moveTo(fb0 - 3, fb1 - 3.4); x.lineTo(nb0 - 3, nb1 - 3.4); x.stroke() }
  // the bench: the far legs, the frame, the pad, the near legs
  const legs = [-42, 14]
  for (const lx of legs) { const [p, q] = P(lx, -0.24); x.fillStyle = INK; x.fillRect(p - 2.2, q - 17, 4.4, 15); x.fillStyle = STEEL_DD; x.fillRect(p - 1.3, q - 16.5, 2.6, 14) }
  x.fillStyle = INK; x.fillRect(-48, -17.4, 70, 4.6); x.fillStyle = STEEL_D; x.fillRect(-47, -16.6, 68, 3)
  x.fillStyle = INK; x.beginPath(); x.roundRect(-52, -23.4, 77, 7.8, 3); x.fill()
  x.fillStyle = PAD; x.beginPath(); x.roundRect(-51.2, -22.6, 75.4, 6.2, 2.4); x.fill()
  x.fillStyle = PAD_L; x.fillRect(-49, -22.2, 71, 1.2)
  for (const lx of legs) {
    const [p, q] = P(lx, 0.24)
    x.fillStyle = INK; x.fillRect(p - 2.4, q - 17.6, 4.8, 16.2); x.fillStyle = STEEL_D; x.fillRect(p - 1.4, q - 17, 2.8, 15)
    // its foot on the platform
    x.fillStyle = INK; x.beginPath(); x.roundRect(p - 5, q - 3.6, 10, 3.6, 1.4); x.fill(); x.fillStyle = '#2b333b'; x.fillRect(p - 4.2, q - 3, 8.4, 2)
  }
  x.restore()
  // the corners fall away
  const dim = x.createRadialGradient(w / 2, h * 0.56, h * 0.3, w / 2, h * 0.56, h * 0.74)
  dim.addColorStop(0, 'rgba(0,0,0,0)'); dim.addColorStop(1, 'rgba(0,0,0,.3)')
  x.fillStyle = dim; x.fillRect(0, 0, w, h)
}
// An upright of the rack and its hook: f, which side (-POST far, POST near)
function upright(ctx, f) {
  const px = HOOK[0] + AX * f - 3, py = AY * f, cup = HOOK[1] + AY * f + 2.2
  ctx.fillStyle = INK; ctx.fillRect(px - 2.6, py - 88, 5.2, 85.6)
  ctx.fillStyle = f < 0 ? STEEL_DD : STEEL_D; ctx.fillRect(px - 1.6, py - 87, 3.2, 83.8)
  if (f > 0) { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(px - 1.4, py - 86, 0.9, 82) }
  // the holes up it, and the hook: a cup the bar sits down into, its lip toward his feet
  ctx.fillStyle = 'rgba(8,12,16,.6)'; for (let k = 0; k < 7; k++) ctx.fillRect(px - 0.5, py - 84 + k * 6.4, 1, 1.6)
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(px, cup - 1); ctx.lineTo(px + 7.4, cup - 1); ctx.lineTo(px + 7.4, cup - 5.4); ctx.lineTo(px + 9.8, cup - 5.4); ctx.lineTo(px + 9.8, cup + 2.6); ctx.lineTo(px, cup + 2.6); ctx.closePath(); ctx.fill()
  ctx.fillStyle = f < 0 ? STEEL_D : STEEL; ctx.fillRect(px + 0.6, cup - 0.2, 8.4, 2); ctx.fillRect(px + 7.9, cup - 4.6, 1.2, 4.4)
}
// A plate, seen nearly face on: its face, its rim, the hub, the number on it. f: where along the bar it is
function plateAt(ctx, cx, cy, R, label, f) {
  const near = f > 0, rx = R * 0.58, th = 2.2 * (near ? -1 : 1)
  // (the rim: the plate's thickness, toward the bar's middle for the near ones, the far ones' outside face behind)
  const bx = cx + Math.cos(ANG) * th, by = cy + Math.sin(ANG) * th, mx = -Math.sin(ANG) * R, my = Math.cos(ANG) * R
  ctx.fillStyle = INK
  ctx.beginPath(); ctx.ellipse(bx, by, rx + 0.9, R + 0.9, ANG, 0, 6.2832); ctx.fill()
  ctx.beginPath(); ctx.moveTo(cx + mx * 1.08, cy + my * 1.08); ctx.lineTo(bx + mx * 1.08, by + my * 1.08); ctx.lineTo(bx - mx * 1.08, by - my * 1.08); ctx.lineTo(cx - mx * 1.08, cy - my * 1.08); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.ellipse(cx, cy, rx + 0.9, R + 0.9, ANG, 0, 6.2832); ctx.fill()
  ctx.fillStyle = '#11161b'; ctx.beginPath(); ctx.ellipse(bx, by, rx, R, ANG, 0, 6.2832); ctx.fill()
  ctx.beginPath(); ctx.moveTo(cx + mx, cy + my); ctx.lineTo(bx + mx, by + my); ctx.lineTo(bx - mx, by - my); ctx.lineTo(cx - mx, cy - my); ctx.closePath(); ctx.fill()
  ctx.fillStyle = RUBBER; ctx.beginPath(); ctx.ellipse(cx, cy, rx, R, ANG, 0, 6.2832); ctx.fill()
  ctx.fillStyle = RUBBER_L; ctx.beginPath(); ctx.ellipse(cx - mx * 0.06, cy - my * 0.06, rx * 0.74, R * 0.74, ANG, 0, 6.2832); ctx.fill()
  ctx.fillStyle = RUBBER; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.6, R * 0.6, ANG, 0, 6.2832); ctx.fill()
  ctx.fillStyle = STEEL_D; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.2, R * 0.2, ANG, 0, 6.2832); ctx.fill()
  if (near) {
    ctx.save(); ctx.translate(cx - mx * 0.67, cy - my * 0.67); ctx.rotate(ANG); ctx.scale(0.58, 1)
    text(ctx, label, 0, 0, { font: DISPLAY, size: R * 0.38, color: 'rgba(238,242,246,.88)' })
    ctx.restore()
  }
}

// ── The lifter, on his back ───────────────────────────────────────────────
// The QB's long limbs and two flat tones, lying down: shirt, shorts, a low sock, flat shoes on the floor
function benchLeg(ctx, hx, hy, ax, ay, far, c) {
  bend(hx, hy, ax, ay, THIGH, SHIN, -1)
  const jx = J.jx, jy = J.jy, ex = J.ex, ey = J.ey
  const skin = far ? c.skinD : c.skin, dark = far ? '#5a3723' : c.skinD
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, hx, hy, 8.4, jx, jy, 6.1, 1, 1); limb(ctx, jx, jy, 6.1, ex, ey, 4.1, 0.2, 1.9); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath(); limb(ctx, hx, hy, 7.4, jx, jy, 5.1, 1, 1); limb(ctx, jx, jy, 5.1, ex, ey, 3.1, 0.2, 1.9); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); limbShade(ctx, jx, jy, 5.1, ex, ey, 3.1, 0.2, 1.9); ctx.fill()
  const sl = Math.hypot(ex - jx, ey - jy) || 1, nx = -(ey - jy) / sl, ny = (ex - jx) / sl, sa = lerp(jx, ex, 0.68), sb = lerp(jy, ey, 0.68)
  ctx.fillStyle = far ? c.sockD : c.sock; ctx.beginPath(); ctx.moveTo(sa + nx * 3.7, sb + ny * 3.7); ctx.lineTo(ex + nx * 3.1, ey + ny * 3.1); ctx.lineTo(ex - nx * 3.1, ey - ny * 3.1); ctx.lineTo(sa - nx * 3.7, sb - ny * 3.7); ctx.closePath(); ctx.fill()
  // the shoe, flat on the platform, toes toward the camera's right
  ctx.save(); ctx.translate(ex, ey)
  ctx.fillStyle = far ? c.shoeD : c.shoe; ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath()
  ctx.moveTo(-4.4, 3.8); ctx.lineTo(-4.6, -1); ctx.quadraticCurveTo(-1, -3, 3, -1.2); ctx.quadraticCurveTo(8.6, 0, 11, 2.2); ctx.quadraticCurveTo(11.8, 3.6, 10.6, 3.8); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = c.sole; ctx.fillRect(-4.4, 3.4, 15.2, 1.3)
  ctx.restore()
  // the shorts, to the middle of the thigh
  const mx = lerp(hx, jx, 0.6), my = lerp(hy, jy, 0.6)
  ctx.fillStyle = far ? c.shortsD : c.shorts; ctx.beginPath(); limb(ctx, hx, hy, 8.4, mx, my, 7.4, 0.6, 0.6, true); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke()
  if (!far) { ctx.strokeStyle = c.topD; ctx.lineWidth = 1.5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(hx, hy - 6); ctx.lineTo(mx, my - 6.6); ctx.stroke(); ctx.lineCap = 'round' }
}
// an arm from the shoulder to a fist; the elbow goes down beside the bench, toward his feet
function benchArm(ctx, sx, sy, hx, hy, far, c) {
  bend(sx, sy, hx, hy, UARM, FARM, 1)
  const jx = J.jx, jy = J.jy, ex = J.ex, ey = J.ey, fl = Math.hypot(ex - jx, ey - jy) || 1, ux = (ex - jx) / fl, uy = (ey - jy) / fl
  const skin = far ? c.skinD : c.skin, dark = far ? '#5a3723' : c.skinD
  const wx = ex - ux * 2.6, wy = ey - uy * 2.6
  ctx.fillStyle = INK; ctx.beginPath()
  limb(ctx, sx, sy, 6.9, jx, jy, 5.2, 0.8, 0.8); limb(ctx, jx, jy, 5.2, wx, wy, 3.5, 1.6, 1.6); ctx.fill()
  circle(ctx, ex, ey, 5); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath(); limb(ctx, jx, jy, 4.2, wx, wy, 2.5, 1.6, 1.6); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); limbShade(ctx, jx, jy, 4.2, wx, wy, 2.5, 1.6, 1.6); ctx.fill()
  // the fist round the bar: the knuckles over it
  ctx.fillStyle = skin; circle(ctx, ex, ey, 3.9); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(ex, ey, 3.9, ANG, ANG + Math.PI); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(ex - ux * 1.6 - uy * 2.6, ey - uy * 1.6 + ux * 2.6); ctx.lineTo(ex - ux * 1.6 + uy * 2.6, ey - uy * 1.6 - ux * 2.6); ctx.stroke()
  // the upper arm: skin below a short sleeve
  const mx = lerp(sx, jx, 0.55), my = lerp(sy, jy, 0.55), tl = Math.hypot(jx - sx, jy - sy) || 1, nx = -(jy - sy) / tl, ny = (jx - sx) / tl
  ctx.fillStyle = skin; ctx.beginPath(); limb(ctx, sx, sy, 5.8, jx, jy, 4.2, 0.8, 0.8); ctx.fill()
  ctx.fillStyle = dark; ctx.beginPath(); limbShade(ctx, sx, sy, 5.8, jx, jy, 4.2, 0.8, 0.8); ctx.fill()
  ctx.fillStyle = far ? c.topD : c.top; ctx.beginPath(); limb(ctx, sx, sy, 6.5, mx, my, 5.6, 0.6, 0.6, true); ctx.fill()
  ctx.fillStyle = far ? 'rgba(0,0,0,.12)' : c.topD; ctx.beginPath(); limbShade(ctx, sx, sy, 6.5, mx, my, 5.6, 0.6, 0.6); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(mx - nx * 5.8, my - ny * 5.8); ctx.lineTo(mx + nx * 5.8, my + ny * 5.8); ctx.stroke(); ctx.lineCap = 'round'
}
// the torso on the pad: a flat back, the chest up off it, the belly down to the waist. arch: the chest comes up as he drives
function benchTorso(ctx, c, arch) {
  const a = arch * 1.6
  ctx.fillStyle = c.top; ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath()
  ctx.moveTo(15, -22.4); ctx.lineTo(-27, -22.4)
  ctx.quadraticCurveTo(-33.5, -24, -32, -31); ctx.quadraticCurveTo(-30.5, -37.5, -24, -39 - a)
  ctx.quadraticCurveTo(-14, -43.6 - a, -6, -41.6 - a); ctx.quadraticCurveTo(2, -39.4 - a * 0.6, 7, -35.6 - a * 0.3)
  ctx.quadraticCurveTo(13, -33, 16, -31); ctx.closePath(); ctx.fill(); ctx.stroke()
  // the side away from the lamps, along his back; a fold where the shirt gathers at the belly
  ctx.fillStyle = c.topD; ctx.beginPath()
  ctx.moveTo(15, -22.4); ctx.lineTo(-27, -22.4); ctx.quadraticCurveTo(-31, -23.6, -31.6, -27.6); ctx.quadraticCurveTo(-8, -26.2, 15.6, -27.4); ctx.closePath()
  ctx.moveTo(10, -33.6); ctx.quadraticCurveTo(5, -32, 1.4, -34.4); ctx.quadraticCurveTo(5, -33.4, 9.6, -32.4); ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = c.trim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-31.2, -27); ctx.quadraticCurveTo(-29.6, -31, -30.6, -35); ctx.stroke()
  // the waistband
  ctx.fillStyle = c.shorts; ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.roundRect(11.4, -33.2, 7.6, 11.2, 3); ctx.fill(); ctx.stroke()
}

// ── The spotter ─────────────────────────────────────────────────────────
// Staff: a dark polo, khakis. He stands over the lifter's head facing his feet and leans in over the bar
function spotLeg(ctx, hx, hy, ax, ay, far) {
  bend(hx, hy, ax, ay, THIGH, SHIN, -1)
  const jx = J.jx, jy = J.jy, ex = J.ex, ey = J.ey, col = far ? SPOT.pantsD : SPOT.pants
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, hx, hy, 8, jx, jy, 6.4, 0.8, 0.8); limb(ctx, jx, jy, 6.4, ex, ey, 5, 0.6, 0.6); ctx.fill()
  ctx.fillStyle = col; ctx.beginPath(); limb(ctx, hx, hy, 7, jx, jy, 5.4, 0.8, 0.8); limb(ctx, jx, jy, 5.4, ex, ey, 4, 0.6, 0.6); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); limbShade(ctx, jx, jy, 5.4, ex, ey, 4, 0.6, 0.6); ctx.fill()
  ctx.save(); ctx.translate(ex, ey + 1)
  ctx.fillStyle = far ? '#14181c' : SPOT.shoe; ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath()
  ctx.moveTo(-4.4, 3.8); ctx.lineTo(-4.6, -1); ctx.quadraticCurveTo(-1, -3, 3, -1.2); ctx.quadraticCurveTo(8.6, 0, 11, 2.2); ctx.quadraticCurveTo(11.8, 3.6, 10.6, 3.8); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = SPOT.sole; ctx.fillRect(-4.4, 3.4, 15.2, 1.3)
  ctx.restore()
}
function spotArm(ctx, sx, sy, tx, ty, far) {
  bend(sx, sy, tx, ty, UARM, FARM, 1)
  const jx = J.jx, jy = J.jy, ex = J.ex, ey = J.ey
  const skin = far ? SPOT.skinD : SPOT.skin
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, sx, sy, 6.3, jx, jy, 4.8, 0.8, 0.8); limb(ctx, jx, jy, 4.8, ex, ey, 3.3, 1.2, 1.2); ctx.fill()
  circle(ctx, ex, ey, 4.4); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath(); limb(ctx, jx, jy, 3.8, ex, ey, 2.3, 1.2, 1.2); ctx.fill()
  circle(ctx, ex, ey, 3.4); ctx.fill()
  ctx.fillStyle = SPOT.skinD; ctx.beginPath(); limbShade(ctx, jx, jy, 3.8, ex, ey, 2.3, 1.2, 1.2); ctx.fill()
  const mx = lerp(sx, jx, 0.6), my = lerp(sy, jy, 0.6)
  ctx.fillStyle = skin; ctx.beginPath(); limb(ctx, sx, sy, 5.2, jx, jy, 3.8, 0.8, 0.8); ctx.fill()
  ctx.fillStyle = far ? SPOT.topD : SPOT.top; ctx.beginPath(); limb(ctx, sx, sy, 6, mx, my, 5.1, 0.6, 0.6, true); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); limbShade(ctx, sx, sy, 6, mx, my, 5.1, 0.6, 0.6); ctx.fill()
}
const SP = { sx: 0, sy: 0 }
function spotterBody(ctx, hipX, lean, look) {
  const hipY = -50, sl = Math.sin(lean), cl = Math.cos(lean), T = 34
  const sx = hipX + sl * T, sy = hipY - cl * T
  SP.sx = sx; SP.sy = sy + 3
  spotLeg(ctx, hipX - 1, hipY, hipX - 4 - AX * 0.16, -4.6 - AY * 0.16, true)
  spotLeg(ctx, hipX + 1, hipY, hipX + 1 + AX * 0.16, -4.6 + AY * 0.16, false)
  ctx.fillStyle = SPOT.pants; ctx.beginPath(); limb(ctx, hipX - 0.6, hipY - 2, 8.6, hipX, hipY + 3, 8); ctx.fill()
  const hx = sx + Math.sin(lean + 0.25) * 13, hy = sy - Math.cos(lean + 0.25) * 13
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, sx, sy + 1, 5.6, hx - 0.6, hy, 5); ctx.fill()
  ctx.fillStyle = SPOT.skinD; ctx.beginPath(); limb(ctx, sx, sy + 1, 4.6, hx - 0.6, hy, 4.1); ctx.fill()
  ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(lean)
  const t = -T
  ctx.fillStyle = SPOT.top; ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath()
  ctx.moveTo(-9, 2); ctx.quadraticCurveTo(-12, t * 0.5, -10.4, t + 6); ctx.quadraticCurveTo(-9.6, t - 2.6, -1, t - 2.6); ctx.quadraticCurveTo(9, t - 2.2, 10.4, t + 7); ctx.quadraticCurveTo(11.4, t * 0.42, 9, 2); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = SPOT.topD; ctx.beginPath()
  ctx.moveTo(-9, 2); ctx.quadraticCurveTo(-12, t * 0.5, -10.4, t + 6); ctx.quadraticCurveTo(-10, t - 1.4, -7, t - 2.2); ctx.quadraticCurveTo(-3.8, t * 0.5, -4, 2); ctx.closePath(); ctx.fill()
  // the polo's collar, and the staff's mint on the chest
  ctx.strokeStyle = '#3a4754'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-4.6, t - 2.2); ctx.quadraticCurveTo(0.6, t + 1.2, 5.4, t - 1.6); ctx.stroke()
  ctx.fillStyle = SPOT.trim; ctx.fillRect(3.4, t + 8, 3, 1.4)
  ctx.restore()
  ctx.fillStyle = INK; ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(lean); ctx.fillRect(-9.4, -0.2, 18.8, 1.1); ctx.restore()
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(look); bareHead(ctx, 0, 0, 'side', SPOT.skin); ctx.restore()
  return { hx, hy }
}

// The staff and the other prospects, the art layer's plain figures. Each look is one object, so its sprite is painted once
const LOOKS = new Map()
function lookOf(key, base, pose) {
  const id = `${key}|${pose}`
  let o = LOOKS.get(id)
  if (!o) { o = { ...base, ...(pose ? { pose } : null) }; LOOKS.set(id, o) }
  return o
}
// (made on first use: dash.js and this file load each other's neighbours, so its SCOUT isn't there yet at load)
const COACH_K = 1.76
const coachOf = pose => lookOf('coach', { ...SCOUT, color: '#2a3540', skin: FOLK_SKIN[1], size: COACH_K }, pose)
const counterOf = () => lookOf('counter', { ...SCOUT, skin: FOLK_SKIN[2], size: 1.3 }, null)
const MATES = [276, 300, 324, 348], MATE_SKIN = [0, 3, 2, 4]

export function draw(ctx, g, view) {
  const { w, h } = view
  const court = g.load < 1
  const c = court ? GEAR_NBA : GEAR
  const G = benchOf(view), { s, ox, floor: F, U } = G
  layer(ctx, view, `bench-tp-${court ? 1 : 0}`, x => paintBenchHall(x, view, G, court))
  const quiet = calm()

  // the bar's travel: on his chest, locked out over his shoulders; once the clock's gone, the spotter's hands on it
  // and back onto the hooks
  let hh = g.h
  if (g.done) hh = lerp(g.overH ?? g.h, 1.03, easeOut(prog(g.t, g.overAt, g.overAt + 480)))
  const strain = g.done ? 0 : g.strain
  const over = g.done ? g.t - g.overAt : -1
  const RACK = 700                               // ms after the clock: the bar's on the hooks, with the spotter's hands on it
  const rack = g.done ? easeInOut(prog(over, 440, RACK)) : 0, off = g.done ? easeOut(prog(over, RACK + 60, RACK + 320)) : 0
  const tick = g.t / 16
  const shake = quiet ? 0 : strain * strain * 1.3
  let bx = lerp(BOT[0], TOP[0], easeOut(clamp(hh, 0, 1))), by = lerp(BOT[1], TOP[1], hh)
  bx = lerp(bx, HOOK[0], rack); by = lerp(by, HOOK[1], rack)
  by += Math.sin(tick * 1.9) * shake + Math.sin(tick * 3.1) * shake * 0.5
  // the bar's a spring with weight on its ends: they hang, they whip at the top of a rep, they jump at a tap
  const ageRep = g.t - g.repAt, ageTap = g.t - g.tapAt, ageRack = over - RACK
  let flex = (court ? 1.1 : 1.8) + strain * 1.1
  if (!quiet) {
    if (ageRep < 560) flex += 3.3 * (1 + strain * 0.5) * Math.exp(-ageRep / 170) * Math.cos(ageRep / 26)
    if (ageTap < 170 && !g.done) flex += 1 * Math.exp(-ageTap / 70)
    if (ageRack > 0 && ageRack < 520) flex += 3 * Math.exp(-ageRack / 150) * Math.cos(ageRack / 24)
  }
  const OB = [0, 0]
  const onBar = f => { OB[0] = bx + AX * f; OB[1] = by + AY * f + flex * 0.34 * f * f; return OB }
  const scr = (ux, uy) => [ox + ux * s, F + uy * s]
  // what happens once. Particles and the camera are the picture's: the rules never see them
  g.dirt ??= particles(24, g.need + 3)
  g.nudge ??= nudge()
  if (g.tapAt > 0 && !g.chalked) {
    g.chalked = true
    const [ux, uy] = onBar(GRIP), [hx, hy] = scr(ux, uy)
    g.dirt.burst('dust', hx, hy, g.t, { n: 6, s: s * 1.1, colors: CHALK, spread: 1.5 })
  }
  if (g.reps !== g.seenRep) {
    g.seenRep = g.reps
    if (g.reps) {
      const hard = g.strain > 0.45
      if (hard) g.nudge.kick(g.t, 1.1, 0, -1, 130)
      const [ux, uy] = onBar(g.reps % 2 ? GRIP : -GRIP), [hx, hy] = scr(ux, uy)
      if (g.reps % 4 === 0) g.dirt.burst('dust', hx, hy, g.t, { n: 3, s: s * 0.9, colors: CHALK, spread: 1.4 })
    }
  }
  if (g.done && !g.racked && over >= RACK) {
    g.racked = true
    g.fx.push('lock', 'h:medium'); g.nudge.kick(g.t, 2.6, 0, 1, 170)
  }
  if (g.done && !g.official && over >= OFFICIAL_MS) { g.official = true; g.fx.push('stamp') }

  // how the room takes it. Past what he needs, the prospects along the wall get loud with each rep; once the number's
  // official, a good set gets a hand and a big one has them all up. A short set gets nothing
  const verdict = !!(g.done && g.stamp && g.t >= g.stamp.at)
  const hit = !!g.done?.hit
  const big = hit && g.reps >= g.need + Math.max(2, Math.round((g.ceil - g.need) * 0.6))
  const loud = !g.done && g.reps >= g.need && ageRep < 520
  const sy = G.horizon + 6
  standAt(ctx, 24, sy, counterOf())
  clipboard(ctx, 24 - 7 * 1.3, sy - 19.5 * 1.3 + 4, 1.05)
  for (let i = 0; i < MATES.length; i++) {
    const pose = verdict ? (big ? 'arms-up' : hit ? (i % 2 ? 'catch-l' : null) : (i === 2 ? 'hips' : null)) : loud && (i + g.reps) % 2 === 0 ? 'catch-r' : null
    standAt(ctx, MATES[i], sy - (i % 2) * 3 * U, lookOf(`mate${court ? 'n' : 'f'}${i}`, { color: c.top, trim: c.trim, pants: c.shorts, skin: FOLK_SKIN[MATE_SKIN[i]], kit: 'plain', dir: 'down', size: 1.3 }, pose))
  }

  // the board hung from the roof, with the count on it
  drawBoard(ctx, g, view, 104, Math.round(Math.min(186, h * 0.24)))

  ctx.save(); ctx.translate(ox, F); ctx.scale(s, s)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const plates = PLATES[court ? 0 : 1]
  // the far end of the bar: its plates, the collar, the sleeve, then the far upright in front of them
  {
    const [x0, y0] = onBar(-1.5), ex = x0, ey = y0, [x1, y1] = onBar(-1.2)
    for (const [col, wd] of [[INK, 4.6], [STEEL_DD, 3]]) { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(x1, y1); ctx.stroke() }
    for (let k = plates.length - 1; k >= 0; k--) { const [f, R, label] = plates[k], [px, py] = onBar(-f); plateAt(ctx, px, py, R, label, -f) }
    const [cx, cy] = onBar(-1.0)
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(cx, cy, 2.4, 3.6, ANG, 0, 6.2832); ctx.fill()
    ctx.fillStyle = STEEL_D; ctx.beginPath(); ctx.ellipse(cx, cy, 1.6, 2.7, ANG, 0, 6.2832); ctx.fill()
  }
  upright(ctx, -POST)

  // the lifter. His hands: on the bar, until it's racked and he lets go
  const arch = strain * (g.reps > 0 ? 1 : 0.4)
  const shN = [-15 + AX * 0.28, -28.5 + AY * 0.28], shF = [-15 - AX * 0.28, -28.5 - AY * 0.28]
  let [nhx, nhy] = onBar(GRIP); nhx -= 0.4; nhy += 0.2
  let [fhx, fhy] = onBar(-GRIP)
  if (off > 0) {
    // (off the bar: his hands come down onto his chest; once it's official, a fist at the roof for a big one, a
    // hand over his eyes for a short one)
    const rest = [-5 + AX * 0.22, -45 + AY * 0.22], restF = [-8 - AX * 0.22, -44 - AY * 0.22]
    let tN = rest
    const after = verdict ? easeInOut(prog(g.t, g.stamp.at, g.stamp.at + 260)) : 0
    if (after > 0 && big) tN = [lerp(rest[0], shN[0] + 3, after), lerp(rest[1], shN[1] - 37, after)]
    else if (after > 0 && !hit) tN = [lerp(rest[0], -36 + AX * 0.3, after), lerp(rest[1], -40 + AY * 0.3, after)]
    nhx = lerp(nhx, tN[0], off); nhy = lerp(nhy, tN[1], off)
    fhx = lerp(fhx, restF[0], off); fhy = lerp(fhy, restF[1], off)
  }
  benchArm(ctx, shF[0], shF[1], fhx, fhy, true, c)
  // (he drives through the floor as it gets hard: the heels dig in)
  const dig = arch * 1.4
  benchLeg(ctx, 13 - AX * 0.2, -27 - AY * 0.2, 33 - AX * 0.32 - dig, -4.6 - AY * 0.32, true, c)

  // the spotter: his hands ready under the bar, close under it as it slows, on it once the clock's gone
  const assist = g.done ? 1 - off : 0
  const lean = lerp(0.58 + strain * 0.12, 0.62, assist) * (1 - off * 0.8) + off * 0.1
  const hipX = -82
  const sp = spotterBody(ctx, hipX, lean, lerp(0.34 + strain * 0.12, 0.4, assist) * (1 - off) + off * 0.12)
  const under = lerp(5 - strain * 2.4, 0.8, assist)
  const [s1x, s1y] = onBar(-0.13), sTf = [s1x, s1y + under]
  const [s2x, s2y] = onBar(0.13), sTn = [s2x, s2y + under]
  if (off > 0) { const dx = SP.sx + 5, dy = SP.sy + 33; sTf[0] = lerp(sTf[0], dx - 3, off); sTf[1] = lerp(sTf[1], dy, off); sTn[0] = lerp(sTn[0], dx + 2, off); sTn[1] = lerp(sTn[1], dy + 1, off) }
  spotArm(ctx, SP.sx + 1.5, SP.sy, sTf[0], sTf[1], true)
  // (the near upright goes behind him: in front, it would cut his face in two)
  upright(ctx, POST)

  // his body on the pad, his head on the end of it
  benchTorso(ctx, c, arch)
  const hdx = -40.4, hdy = -31.6
  ctx.fillStyle = INK; ctx.beginPath(); limb(ctx, -29, -30, 5.4, hdx + 5, hdy, 5); ctx.fill()
  ctx.fillStyle = c.skinD; ctx.beginPath(); limb(ctx, -29, -30, 4.4, hdx + 5, hdy, 4.1); ctx.fill()
  ctx.save(); ctx.translate(hdx, hdy); ctx.rotate(-Math.PI / 2 - strain * 0.14); bareHead(ctx, 0, 0, 'side', c.skin); ctx.restore()
  benchLeg(ctx, 13 + AX * 0.2, -27 + AY * 0.2, 33 + AX * 0.32 - dig, -4.6 + AY * 0.32, false, c)

  // the bar, sleeve to sleeve, over him
  {
    const [lx, ly] = onBar(-1.0), lX = lx, lY = ly, [mx, my] = onBar(0), mX = mx, mY = my, [rx, ry] = onBar(1.0)
    const cx = 2 * mX - (lX + rx) / 2, cy = 2 * mY - (lY + ry) / 2
    for (const [col, wd] of [[INK, 3.8], [STEEL_D, 2.4], [STEEL, 1]]) {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'butt'
      ctx.beginPath(); ctx.moveTo(lX, lY - (col === STEEL ? 0.5 : 0)); ctx.quadraticCurveTo(cx, cy - (col === STEEL ? 0.5 : 0), rx, ry - (col === STEEL ? 0.5 : 0)); ctx.stroke()
    }
    ctx.lineCap = 'round'
  }
  spotArm(ctx, SP.sx - 1, SP.sy, sTn[0], sTn[1], false)
  benchArm(ctx, shN[0], shN[1], nhx, nhy, false, c)

  // the near plates, the collar and the sleeve: the closest things to the camera
  {
    const [cx, cy] = onBar(1.0)
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(cx, cy, 2.4, 3.6, ANG, 0, 6.2832); ctx.fill()
    ctx.fillStyle = STEEL; ctx.beginPath(); ctx.ellipse(cx, cy, 1.6, 2.7, ANG, 0, 6.2832); ctx.fill()
    for (let k = 0; k < plates.length; k++) { const [f, R, label] = plates[k], [px, py] = onBar(f); plateAt(ctx, px, py, R, label, f) }
    const [x1, y1] = onBar(1.2), sx1 = x1, sy1 = y1, [x2, y2] = onBar(1.55)
    for (const [col, wd] of [[INK, 4.8], [STEEL_D, 3.2], [STEEL, 1.2]]) { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(x2, y2); ctx.stroke() }
    ctx.lineCap = 'round'
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(sx1, sy1, 2.6, 4.4, ANG, 0, 6.2832); ctx.fill()
    ctx.fillStyle = STEEL_D; ctx.beginPath(); ctx.ellipse(sx1, sy1, 1.8, 3.4, ANG, 0, 6.2832); ctx.fill()
  }
  ctx.restore()

  // the man with the count, at the foot of the bench: his fist goes up for a big number and nothing else
  const cy0 = F + 34 * U, ck = COACH_K
  const cPose = verdict && big ? 'reach-r' : null
  standAt(ctx, 324, cy0, coachOf(cPose))
  clipboard(ctx, 324 + (cPose ? -8 : -7) * ck, cy0 + (cPose ? -17 : -19.5) * ck + 4, 1.3)

  if (!quiet) g.dirt.draw(ctx, g.t, true)
  // the spotter, at him, as it slows
  if (!g.done && g.reps > 0 && strain > 0.55) {
    const [tx, ty] = scr(sp.hx - 4, sp.hy - 16)
    text(ctx, 'UP!', tx, ty, { font: DISPLAY, size: 24, color: '#fff' })
  }
  if (view.keys && !g.done && g.reps === 0) keyCap(ctx, w / 2, h - 58, 'SPACE')
}
// the slab on top, the same as the 40's; the rep count big on the board hung from the ceiling
function drawBoard(ctx, g, view, top0, bottom) {
  const { w } = view
  const y = 44, ph = 52
  const over = g.done ? g.t - g.overAt : -1, official = over >= OFFICIAL_MS, result = g.done?.hit ? GOOD : BAD
  // the board itself (it drops a little clear of the official strip once that's up)
  const bt = top0 + (over >= 0 ? 22 : 0), bb = bottom + (over >= 0 ? 14 : 0)
  // (hung on two rods from the roof, behind the slab)
  ctx.fillStyle = BEAM; ctx.fillRect(58, y + ph, 2.4, bt - y - ph); ctx.fillRect(w - 60.4, y + ph, 2.4, bt - y - ph)
  ctx.fillStyle = INK; ctx.fillRect(20, bt, w - 40, bb - bt)
  ctx.fillStyle = '#080d11'; ctx.fillRect(23, bt + 3, w - 46, bb - bt - 6)
  ctx.fillStyle = MINT; ctx.fillRect(23, bb - 6, w - 46, 3)
  clockSlab(ctx, view, g.left.toFixed(2), official ? result : g.done ? '#fff' : g.left < 3 ? BAD : '#fff', g.left / SECS)
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
  const room = Math.max(40, bb - bt - 12)
  if (g.stamp) g.stamp.y = view.h * 0.885
  // the reps, punched on each one, and once more as it goes official
  const big = Math.min(100, room * 0.72)
  const a = g.t - g.repAt
  const q = (1 + 0.2 * (1 - easeOut(clamp(a / 130, 0, 1)))) * (g.done ? officialPunch(over) : 1)
  const my = bt + 4 + room * 0.42
  text(ctx, 'REPS', 36, bt + 16, { font: LABEL, size: 15, align: 'left', color: dim })
  ctx.save(); ctx.translate(w / 2, my); ctx.scale(q, q)
  text(ctx, String(g.reps), 0, 2, { font: DISPLAY, size: big, color: official ? result : g.done ? '#fff' : passed ? GOOD : '#fff' })
  ctx.restore()
  // a tick a rep, up to what he needs; past it they go gold, and there's no telling how far they go
  const tickW = Math.min(9, 230 / Math.max(g.need, g.reps)) - 2.2, step = tickW + 2.2, n = Math.max(g.need, g.reps), x0 = w / 2 - (n * step) / 2, ty = bb - 16
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i >= g.need ? GOLD : i < g.reps ? (passed ? GOOD : '#fff') : 'rgba(255,255,255,.2)'
    ctx.fillRect(x0 + i * step, ty, tickW, 4)
  }
  if (g.done) officialStrip(ctx, view, over, g.done.hit, `${g.load < 1 ? 185 : 225} LB   ${g.reps} REP${g.reps === 1 ? '' : 'S'}`)
}
