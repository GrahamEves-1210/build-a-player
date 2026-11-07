// Bench: the combine's 225 (the NBA's 185). In first person, flat on your back: the bar across your view with
// its plates, your fists round it, the spotter leaning in over your head, the count on a board on the ceiling. Each tap drives the bar, gravity takes it back, at lockout the rep
// counts and it comes down on its own. Every rep is heavier: strength sets a real ceiling. As the
// reps climb the taps a rep needs climb too, until the taps can't beat gravity any more: the bar
// grinds, and that's the set. Faster thumbs get closer to the ceiling, never past it.
import { clamp, lerp, outcome, rngOf, prog, easeOut, easeInOut, layer, circle, text, keyCap, particles, nudge, DISPLAY, LABEL, GOOD, BAD, GOLD } from './kit.js'
import { curve, GEAR, GEAR_NBA, clockSlab, taper, officialStrip, officialPunch, OFFICIAL_MS, calm } from './dash.js'
import { INK, tone } from './rig.js'
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
// You, on your back, looking up: the dark ceiling and its lamps, the board with the count hung from it, the
// spotter leaning over your head with his hands ready under the bar, and the bar itself across your view, coming
// at you as it comes down and going away from you, smaller, as you lock it out. Your fists are round it, your arms
// up from the bottom corners. Clean shapes in two tones, one ink line, the plates' 45s in Anton.
const STEEL = '#c6ccd1', STEEL_D = '#8c949b', RUBBER = '#1b2228'
const SPOT = { top: '#2a3540', skin: '#6d4229', hair: '#17120e' }
const CEIL = '#070a0d', CEIL_T = '#0b1015', MINT = '#3ddcb0'
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
// a limb in two tones under one ink line
function limb(ctx, x1, y1, r1, x2, y2, r2, col, inkW = 2.4) {
  ctx.fillStyle = INK; taper(ctx, x1, y1, r1 + inkW, x2, y2, r2 + inkW)
  ctx.fillStyle = tone(col, 0.74); taper(ctx, x1, y1, r1, x2, y2, r2)
  ctx.fillStyle = col; taper(ctx, x1 - r1 * 0.2, y1 - r1 * 0.12, r1 * 0.68, x2 - r2 * 0.2, y2 - r2 * 0.12, r2 * 0.68)
}
// A plate seen from the middle of the bar: a tall disc, its inner face toward you with the 45 on it
function plate(ctx, x, y, s, side) {
  const rx = 19 * s, ry = 70 * s
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, rx + 2.2, ry + 2.2, 0, 0, 6.2832); ctx.fill()
  ctx.fillStyle = RUBBER; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); ctx.fill()
  ctx.fillStyle = '#242c33'; ctx.beginPath(); ctx.ellipse(x - side * rx * 0.18, y, rx * 0.72, ry * 0.86, 0, 0, 6.2832); ctx.fill()
  if (ry > 14) { ctx.save(); ctx.translate(x - side * rx * 0.18, y - ry * 0.48); ctx.scale(0.42, 1); text(ctx, '45', 0, 0, { font: DISPLAY, size: ry * 0.34, color: 'rgba(238,242,246,.86)' }); ctx.restore() }
}
// a fist round the bar: the knuckles over it, a crease between each finger
function fist(ctx, x, y, s, skin) {
  const W = 34 * s, H = 30 * s
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - W / 2 - 2.4, y - H * 0.62 - 2.4, W + 4.8, H + 4.8, 10 * s + 2.4); ctx.fill()
  ctx.fillStyle = tone(skin, 0.74); ctx.beginPath(); ctx.roundRect(x - W / 2, y - H * 0.62, W, H, 10 * s); ctx.fill()
  ctx.fillStyle = skin; ctx.beginPath(); ctx.roundRect(x - W / 2 + 3 * s, y - H * 0.62 + 2 * s, W - 9 * s, H * 0.62, 8 * s); ctx.fill()
  ctx.strokeStyle = tone(skin, 0.6); ctx.lineWidth = Math.max(1, 1.6 * s); ctx.lineCap = 'round'
  for (let k = 1; k < 4; k++) { const fx = x - W / 2 + (W * k) / 4; ctx.beginPath(); ctx.moveTo(fx, y - H * 0.5); ctx.lineTo(fx, y - H * 0.2); ctx.stroke() }
}
const CHALK = ['#ffffff', '#e6eaee', '#d7dde2']
// the ceiling: dark tiles, two long lamps down it. Baked; nothing on it moves
function paintCeiling(x, view) {
  const { w, h } = view
  x.fillStyle = CEIL; x.fillRect(0, 0, w, h)
  x.fillStyle = CEIL_T
  for (let gx = -10; gx < w; gx += 60) for (let gy = 96; gy < h; gy += 60) x.fillRect(gx + 2, gy + 2, 56, 56)
  // the lamps: short flat panels in two rows, set into the tiles
  for (let gy = 96 + 60 * 2; gy < h; gy += 60 * 3) for (const gx of [w / 2 - 150, w / 2 + 90]) {
    x.fillStyle = '#05080b'; x.fillRect(gx - 2, gy + 14, 64, 32)
    x.fillStyle = '#6f7b84'; x.fillRect(gx + 2, gy + 18, 56, 24)
  }
}
export function draw(ctx, g, view) {
  const { w, h } = view
  const court = g.load < 1
  const c = court ? GEAR_NBA : GEAR
  layer(ctx, view, `bench-fp-${h}`, x => paintCeiling(x, view))

  // the bar's travel: down at your chest, near and big; locked out over your shoulders, further and smaller
  let hh = g.h
  if (g.done) hh = lerp(g.overH ?? g.h, 1.03, easeOut(prog(g.t, g.overAt, g.overAt + 480)))
  const strain = g.done ? 0 : g.strain
  const over = g.done ? g.t - g.overAt : -1
  const RACK = 700                               // ms after the clock: the bar's on the hooks, with the spotter's hands on it
  const rack = g.done ? easeInOut(prog(over, 440, RACK)) : 0, off = g.done ? easeOut(prog(over, RACK + 60, RACK + 320)) : 0
  const tick = g.t / 16
  const shake = strain * strain * 2.6
  const chestY = h * 0.72, lockY = h * 0.45, rackY = h * 0.39
  const sb = lerp(lerp(1.02, 0.66, hh), 0.56, rack)
  const barY = lerp(lerp(chestY, lockY, hh), rackY, rack) + Math.sin(tick * 1.9) * shake + Math.sin(tick * 3.1) * shake * 0.5
  // the bar's a spring with weight on its ends: they hang, they whip at the top of a rep, they jump at a tap
  const ageRep = g.t - g.repAt, ageTap = g.t - g.tapAt, ageRack = over - RACK
  let flex = (court ? 1.1 : 1.8) + strain * 1.1
  if (ageRep < 560) flex += 3.3 * (1 + strain * 0.5) * Math.exp(-ageRep / 170) * Math.cos(ageRep / 26)
  if (ageTap < 170 && !g.done) flex += 1 * Math.exp(-ageTap / 70)
  if (ageRack > 0 && ageRack < 520) flex += 3 * Math.exp(-ageRack / 150) * Math.cos(ageRack / 24)
  const onBar = dx => [w / 2 + dx * sb, barY + (flex * dx * dx * sb) / 5200]
  // what happens once. Particles and the camera are the picture's: the rules never see them
  g.dirt ??= particles(24, g.need + 3)
  g.nudge ??= nudge()
  const GRIP = 98
  if (g.tapAt > 0 && !g.chalked) {
    g.chalked = true
    const [hx, hy] = onBar(GRIP)
    g.dirt.burst('dust', hx, hy, g.t, { n: 6, s: sb * 2, colors: CHALK, spread: 1.5 })
  }
  if (g.reps !== g.seenRep) {
    g.seenRep = g.reps
    if (g.reps) {
      const hard = g.strain > 0.45
      if (hard) g.nudge.kick(g.t, 1.1, 0, -1, 130)
      const [hx, hy] = onBar(g.reps % 2 ? GRIP : -GRIP)
      if (g.reps % 4 === 0) g.dirt.burst('dust', hx, hy, g.t, { n: 3, s: sb * 1.6, colors: CHALK, spread: 1.4 })
    }
  }
  if (g.done && !g.racked && over >= RACK) {
    g.racked = true
    g.fx.push('lock', 'h:medium'); g.nudge.kick(g.t, 2.6, 0, 1, 170)
  }
  if (g.done && !g.official && over >= OFFICIAL_MS) { g.official = true; g.fx.push('stamp') }

  // the board on the ceiling, with the count on it (the slab's over it, as in every timed drill)
  const boardTop = 104, boardBot = Math.round(Math.min(186, h * 0.24))
  drawBoard(ctx, g, view, boardTop, boardBot)

  // the hooks the bar goes back to, on the uprights either side of your head
  for (const sd of [-1, 1]) {
    const hx = w / 2 + sd * 172 * 0.56, hy = rackY + 4
    ctx.fillStyle = INK; ctx.fillRect(hx - 9, hy - 2, 18, 16)
    ctx.fillStyle = STEEL_D; ctx.fillRect(hx - 7, hy, 14, 12)
  }
  // the spotter, leaning in over your head: his shoulders, his head between them, his hands under the bar
  const lean = strain * 8 + rack * 10, shY = boardBot + 22 + lean, hdY = shY + 38 + lean * 0.4
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(w / 2 - 82, shY - 26, 164, 58, 26); ctx.fill()
  ctx.fillStyle = tone(SPOT.top, 0.74); ctx.beginPath(); ctx.roundRect(w / 2 - 79.6, shY - 23.6, 159.2, 53.2, 24); ctx.fill()
  ctx.fillStyle = SPOT.top; ctx.beginPath(); ctx.roundRect(w / 2 - 74, shY - 21, 140, 40, 20); ctx.fill()
  for (const sd of [-1, 1]) {
    const sx = w / 2 + sd * 60, sy = shY + 6
    // his hands: on the bar near the top, ready under it below (he can only reach so far)
    const [bx, by] = onBar(sd * 30)
    const dx = bx - sx, dy = by + 6 - sy, dl = Math.hypot(dx, dy) || 1, far = Math.min(1, 176 / dl)
    const hx = sx + dx * far, hy = sy + dy * far
    reach(sx, sy, hx, hy, 92, 92, sd)
    const ex = jx, ey = jy
    limb(ctx, sx, sy, 15, ex, ey, 12, SPOT.top)
    limb(ctx, ex, ey, 12, hx, hy, 9, SPOT.skin)
    ctx.fillStyle = INK; circle(ctx, hx, hy, 11.4); ctx.fill(); ctx.fillStyle = tone(SPOT.skin, 0.74); circle(ctx, hx, hy, 9.2); ctx.fill()
  }
  ctx.fillStyle = INK; circle(ctx, w / 2, hdY, 31.4); ctx.fill()
  ctx.fillStyle = tone(SPOT.skin, 0.74); circle(ctx, w / 2, hdY, 29); ctx.fill()
  ctx.fillStyle = SPOT.skin; circle(ctx, w / 2 - 5, hdY + 3, 21); ctx.fill()
  // (looking down at you: the crown of his head toward the top, the hair on it)
  ctx.fillStyle = SPOT.hair; ctx.beginPath(); ctx.arc(w / 2, hdY, 29, Math.PI * 1.08, Math.PI * 1.92); ctx.quadraticCurveTo(w / 2, hdY - 14, w / 2 - 28, hdY - 9); ctx.fill()
  if (!g.done && g.reps > 0 && strain > 0.55 && Math.floor(g.t / 460) % 2 === 0) {
    text(ctx, 'UP!', w / 2 + 78, hdY + 6, { font: DISPLAY, size: 26, color: '#fff' })
  }

  // the bar, plate to plate, and the plates
  const [lx, ly] = onBar(-200), [rx, ry] = onBar(200), [mx, my] = onBar(0)
  const by0 = 2 * my - (ly + ry) / 2
  for (const [bw, col] of [[9 * sb + 4.4, INK], [9 * sb, STEEL_D], [4 * sb, STEEL]]) {
    ctx.strokeStyle = col; ctx.lineWidth = bw; ctx.lineCap = 'butt'
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(mx, by0, rx, ry); ctx.stroke()
  }
  // the knurl where you hold it
  ctx.fillStyle = 'rgba(8,12,16,.35)'
  for (const sd of [-1, 1]) { const [kx, ky] = onBar(sd * GRIP); ctx.fillRect(kx - 26 * sb, ky - 4.5 * sb, 52 * sb, 9 * sb) }
  const rattle = ageRep < 200 && !g.done ? 3 * (1 - ageRep / 200) : 0
  for (const sd of [-1, 1]) {
    const [cx2, cy2] = onBar(sd * 150)
    ctx.fillStyle = INK; ctx.fillRect(cx2 - 6 * sb, cy2 - 15 * sb, 12 * sb, 30 * sb); ctx.fillStyle = STEEL; ctx.fillRect(cx2 - 4.5 * sb, cy2 - 13.5 * sb, 9 * sb, 27 * sb)
    for (const off2 of [176, 160]) { const [px, py] = onBar(sd * off2); plate(ctx, px + sd * rattle, py, sb, sd) }
  }

  // your arms, up from the bottom corners, and your fists round the bar
  for (const sd of [-1, 1]) {
    let [hx, hy] = onBar(sd * GRIP)
    // (off the bar once it's racked: the arms drop away)
    if (off) { hx = lerp(hx, w / 2 + sd * 150, off); hy = lerp(hy, h + 120, off) }
    const sx = w / 2 + sd * 182, sy = h + 16
    reach(sx, sy, hx, hy + 14, 205, 205, -sd)
    const ex = jx + (strain * strain * Math.sin(tick * 2.7 + sd)) * 3, ey = jy
    const s = lerp(1.15, 0.8, (h - hy) / h)
    limb(ctx, sx, sy, 44, ex, ey, 34, c.top, 2.8)
    ctx.strokeStyle = c.trim ?? '#1b2127'; ctx.lineWidth = 5; ctx.lineCap = 'butt'
    const ux = ex - sx, uy = ey - sy, ul = Math.hypot(ux, uy) || 1, bx = lerp(sx, ex, 0.82), byy = lerp(sy, ey, 0.82), br = lerp(44, 34, 0.82)
    ctx.beginPath(); ctx.moveTo(bx - (uy / ul) * br, byy + (ux / ul) * br); ctx.lineTo(bx + (uy / ul) * br, byy - (ux / ul) * br); ctx.stroke()
    limb(ctx, ex, ey, 31, hx, hy + 10, 21, c.skin, 2.8)
    fist(ctx, hx, hy, s * (0.86 + sb * 0.3), c.skin)
  }
  if (!calm()) g.dirt.draw(ctx, g.t, true)
  if (view.keys && !g.done && g.reps === 0) keyCap(ctx, w / 2, h - 58, 'SPACE')
}
// the slab on top, the same as the 40's; the rep count big on the board hung from the ceiling
function drawBoard(ctx, g, view, top0, bottom) {
  const { w } = view
  const y = 44, ph = 52
  const over = g.done ? g.t - g.overAt : -1, official = over >= OFFICIAL_MS, result = g.done?.hit ? GOOD : BAD
  // the board itself (it drops a little clear of the official strip once that's up)
  const bt = top0 + (over >= 0 ? 22 : 0), bb = bottom + (over >= 0 ? 14 : 0)
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
