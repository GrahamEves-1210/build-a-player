// The baseball games' picture and the models they share (atbat.js, pitch.js, steal.js, dash60.js, ofarm.js): a real
// ballpark at night through a camera that works in metres, the men in real uniforms, the white ball with its red
// stitches, and the three models every baseball game plays by: the pitch (its arsenal, its flight), the swing (the
// timing, the contact zone, what comes off the bat) and what a ball in play turns into.
//
// ── EXPORTS (stable: add, don't rename) ─────────────────────────────────────────────────────────────────────────────
//  camera   camOf(view, { x, y, z, yaw, pitch, F, cy }) · P(C, X, Y, Z) → { x, y, s (px a metre there), d, ok }
//  park     park(ctx, view, C, o) / staticPark(ctx, view, C, key, o)   o: { team, away, empty, night }
//           crowdRise(ctx, C, view, team, age) (the home crowd on its feet) · scoreboard(ctx, C, g) · scouts(...)
//  men      baller(ctx, C, X, Z, pose, look, o) · paintBaller(x, pose, look) · uniforms(view) · dressB(kit, who, extra)
//           BP (named poses) · mixB · runB(phase, k, o) · swingPose(f, hand, o) · pitchPose(f, hand, o) · throwPose(f, hand)
//  ball     baseballAt(ctx, x, y, r, spin) · ballB(ctx, C, X, Y, Z, spin)
//  models   arsenalOf(attrs, v, throws) · pitchPath(p, f) · locate(...) · swingModel · contactOf(...) · inPlay(...)
//           batterProfile(attrs, v) · batterAI(...) · runsOn(...) · inZone(x, y)
//  hud      scorebug(ctx, view, s) · tracker(ctx, view, o) · radar(ctx, view, mph, o) · meterB(...)
//  moments  celebMsB() · skipOutroB(g, a) · mobAt(...) · gatorade(...) · batFlip(...)
//
// Real sizes: the plate 17 inches across (0.432 m), the rubber 60'6" (18.44 m) out, the bases 90 feet (27.43 m)
// apart, the mound 10 inches high, the zone about knee to letters (0.48 m to 1.08 m for a 6'1" hitter). A man is
// about 1.85 m. Home plate is at the origin, +Z out to the pitcher and centre field, +X toward first base.
import { clamp, lerp, prog, text, layer, warmSkin, lightMode, reduceMotion, DISPLAY, LABEL, rr, keyCap, GOOD, BAD, GOLD } from './kit.js'
import { inkOn, nameTag } from './art.js'
import { tone, INK } from './rig.js'
import { RUBBER, MOUND_H, BASE, PLATE_Z, ZONE, FT, fenceFt, PITCH_INFO, zoneOf } from './baseballModel.js'
export * from './baseballModel.js'

export const FIRST = { x: 19.4, z: 19.4 }, SECOND = { x: 0, z: 38.79 }, THIRD = { x: -19.4, z: 19.4 }
const RIG_M = 1.85 / 110               // a rig unit (a man is about 110 of them) in metres
export const RED = '#c8102e', CREAM = '#f1e9d8', NAVY = '#14213d'

// ── The camera ──────────────────────────────────────────────────────────────
// A real lens: turned (yaw, toward +X) and tipped down (pitch) about its own spot. cy: where the middle of the lens
// sits on the screen, as a share of the room under the title bar (44) and over the pads (96).
export function camOf(view, { x = 0, y = 2, z = -3, yaw = 0, pitch = 0, F = 400, cy = 0.4, near = 0.3 } = {}) {
  const top = 44, room = view.h - 140
  return { x, y, z, F: F * view.w / 360, vx: view.w / 2, cy: Math.round(top + room * cy), near, yaw, pitch, cyw: Math.cos(yaw), syw: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) }
}
const Q = { x: 0, y: 0, d: 0 }
function cs(C, X, Y, Z, o = Q) {
  const dx = X - C.x, dy = Y - C.y, dz = Z - C.z
  const rx = dx * C.cyw - dz * C.syw, rz = dx * C.syw + dz * C.cyw
  o.x = rx; o.y = dy * C.cp + rz * C.sp; o.d = -dy * C.sp + rz * C.cp
  return o
}
export function P(C, X, Y, Z) {
  cs(C, X, Y, Z)
  if (Q.d < C.near) return { x: 0, y: 0, s: 0, d: Q.d, ok: false }
  const s = C.F / Q.d
  return { x: C.vx + Q.x * s, y: C.cy - Q.y * s, s, d: Q.d, ok: true }
}
// a flat shape at height Y (the grass, the dirt), clipped where it comes past the lens. pts: [X, Z, X, Z...]
const CL = []
function flat(ctx, C, pts, Y = 0) {
  const n = pts.length / 2
  CL.length = 0
  const a = { x: 0, y: 0, d: 0 }, b = { x: 0, y: 0, d: 0 }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    cs(C, pts[i * 2], Y, pts[i * 2 + 1], a); cs(C, pts[j * 2], Y, pts[j * 2 + 1], b)
    const ain = a.d >= C.near, bin = b.d >= C.near
    if (ain) CL.push(a.x, a.y, a.d)
    if (ain !== bin) { const f = (C.near - a.d) / (b.d - a.d); CL.push(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, C.near) }
  }
  if (CL.length < 9) return false
  for (let i = 0; i < CL.length; i += 3) {
    const s = C.F / CL[i + 2], px = C.vx + CL[i] * s, py = C.cy - CL[i + 1] * s
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath()
  return true
}
export const flatB = flat
// a chalk line on the ground, w metres wide
export function lineB(ctx, C, x0, z0, x1, z1, w = 0.08, Y = 0.004) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = (-dz / L) * w / 2, nz = (dx / L) * w / 2
  flat(ctx, C, [x0 + nx, z0 + nz, x1 + nx, z1 + nz, x1 - nx, z1 - nz, x0 - nx, z0 - nz], Y)
}
function disc(ctx, C, cx, cz, r, n = 28, Y = 0.002) {
  const pts = []
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(cx + Math.cos(a) * r, cz + Math.sin(a) * r) }
  return flat(ctx, C, pts, Y)
}
// a flat upright board facing the lens: corners projected, drawn as its screen box
function upright(C, x0, z0, x1, z1, y0, y1) {
  const a = P(C, x0, y0, z0), b = P(C, x1, y0, z1), c = P(C, x1, y1, z1), d = P(C, x0, y1, z0)
  if (!a.ok || !b.ok || !c.ok || !d.ok) return null
  return [a, b, c, d]
}
function quad(ctx, q) { ctx.moveTo(q[0].x, q[0].y); ctx.lineTo(q[1].x, q[1].y); ctx.lineTo(q[2].x, q[2].y); ctx.lineTo(q[3].x, q[3].y); ctx.closePath() }

// ── The park's shape ────────────────────────────────────────────────────────
// The fence by the angle off dead centre (degrees, -45 the left-field line, 45 the right): 330 down the lines, 375
// in the alleys, 400 to centre, in feet.
const fenceAt = phi => { const r = fenceFt(phi) * FT, a = phi * Math.PI / 180; return { x: Math.sin(a) * r, z: Math.cos(a) * r } }
const FENCE = Array.from({ length: 37 }, (_, i) => fenceAt(-45 + i * 2.5))
const WALL_H = 2.6
// the front of the stands round foul ground: up the left-field line to behind the plate and out the right-field line
const BOWL = (() => {
  const out = []
  const lf = fenceAt(-45)
  // (a little out from the line at the pole, more of it near the plate, and the backstop 60 feet behind it)
  for (let i = 0; i <= 8; i++) { const f = i / 8, along = lerp(Math.hypot(lf.x, lf.z), 22, f), off = lerp(4, 16, f); out.push({ x: -along * Math.SQRT1_2 - off * Math.SQRT1_2, z: along * Math.SQRT1_2 - off * Math.SQRT1_2 }) }
  for (let i = 1; i < 12; i++) { const a = lerp(-Math.PI * 0.77, -Math.PI * 0.23, i / 12); out.push({ x: Math.cos(a) * 18.5, z: Math.sin(a) * 18.5 + 2 }) }
  for (let i = 8; i >= 0; i--) { const f = i / 8, along = lerp(Math.hypot(lf.x, lf.z), 22, f), off = lerp(4, 16, f); out.push({ x: along * Math.SQRT1_2 + off * Math.SQRT1_2, z: along * Math.SQRT1_2 - off * Math.SQRT1_2 }) }
  return out
})()

// ── Colours: the uniforms ───────────────────────────────────────────────────
const rgb = h => { const n = parseInt(String(h ?? '').replace('#', '').slice(0, 6), 16); return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128] }
const lum = h => { const [r, g, b] = rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255 }
const far = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) }
// The home side in whites, the road side in road grays, as they really are: the club colour on the cap, the
// lettering, the piping, the undershirt and the socks. (A club whose first colour is very light wears its second.)
export function uniforms(view, homeIsUs = true) {
  const c = view.colors ?? {}
  const club = (col, col2) => { const main = lum(col) > 0.78 && col2 ? col2 : col; const second = main === col ? (col2 ?? '#f4efe6') : col; return { main, second } }
  const u = club(c.us ?? RED, c.trim ?? '#14213d'), t = club(c.them ?? NAVY, c.themTrim ?? '#c8102e')
  const kit = (cl, home) => ({
    jersey: home ? '#f3f1ea' : '#a7abb0', pants: home ? '#eeece4' : '#9fa4aa', trim: cl.main, letter: cl.main, letter2: far(cl.second, home ? '#f3f1ea' : '#a7abb0') > 90 ? cl.second : '#14213d',
    cap: cl.main, capFront: far(cl.second, cl.main) > 90 ? cl.second : '#f3f1ea', socks: cl.main, under: lum(cl.main) < 0.5 ? cl.main : '#14213d', home,
  })
  return {
    us: kit(u, homeIsUs), them: kit(t, !homeIsUs),
    ump: { jersey: '#1c2433', pants: '#7d838b', trim: '#1c2433', letter: '#e8ebee', letter2: '#e8ebee', cap: '#141a24', capFront: '#141a24', socks: '#141a24', under: '#141a24', ump: true },
    staff: { jersey: '#20262c', pants: '#2a3540', trim: '#20262c', letter: '#e8ebee', letter2: '#e8ebee', cap: '#20262c', capFront: '#e8ebee', socks: '#20262c', under: '#20262c', staff: true },
    scout: { jersey: '#e8e2d6', pants: '#3a3f45', trim: '#3a3f45', letter: '#3a3f45', letter2: '#3a3f45', cap: '#1f2a3a', capFront: '#e8ebee', socks: '#1f2a3a', under: '#e8e2d6', staff: true },
  }
}
export const dressB = (kit, who = null, extra = null) => ({ ...kit, skin: who?.skin ?? '#8d5a3b', number: who?.number ?? null, name: who?.name ?? null, ...extra })

// ── The crowd ───────────────────────────────────────────────────────────────
// Painted once into a picture (rows of fans in caps and the home colours, aisles, a few empty seats) and laid into
// the stands a slice at a time. mode: 'sit', 'up' (on their feet, arms up: laid over the sitting picture), 'empty'
// (the showcase: seats, nobody)
const crowds = new Map()
function crowdPic(team, rows, seed, wide = 1024, mode = 'sit', seat = '#123a2c', k2 = 1) {
  const id = `${team.join()}|${rows}|${seed}|${wide}|${mode}|${seat}|${k2}`
  let c = crowds.get(id)
  if (c || typeof document === 'undefined') return c
  if (crowds.size > 12) crowds.clear()
  const RH = 12, H = rows * RH, up = mode === 'up', empty = mode === 'empty'
  c = document.createElement('canvas'); c.width = wide * k2; c.height = H * k2
  const x = c.getContext('2d')
  if (k2 !== 1) x.scale(k2, k2)
  let s = seed
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647
  if (!up) { x.fillStyle = '#0c1116'; x.fillRect(0, 0, wide, H) }
  const pal = ['#1b222b', '#262e38', '#3f4954', '#55606b', '#8a8f96', '#b9bcc0', '#e8edf2', '#6d6459']
  const heads = ['#5e3c22', '#8d5a3b', '#c09060', '#f0c4a0', '#3a2a1e', '#a87548']
  for (let r = 0; r < rows; r++) {
    const y = r * RH
    if (!up) { x.fillStyle = r % 2 ? '#10161c' : '#131a21'; x.fillRect(0, y + RH - 3, wide, 3) }
    for (let px = (r % 2) * 3; px < wide; px += 6.4) {
      if (px % 170 < 9) continue
      if (empty) { if (up) continue; x.fillStyle = (Math.floor(px / 6.4) + r) % 9 === 0 ? tone(seat, 1.25) : seat; x.fillRect(px + 0.4, y + 4.5, 3.8, 4.5); continue }
      if (R() < 0.06) { if (!up) { x.fillStyle = seat; x.fillRect(px + 0.4, y + 4.5, 3.8, 4.5) } continue }
      const home = R() < 0.72
      const shirt = home ? team[R() < 0.7 ? 0 : 1] : pal[Math.floor(R() * pal.length)], head = heads[Math.floor(R() * heads.length)]
      const cap = R() < 0.45
      if (up) {
        if (!home || R() < 0.25) continue
        x.fillStyle = shirt; x.fillRect(px, y + 0.5, 4.6, 6)
        x.fillStyle = head; x.fillRect(px + 1, y - 2.6, 2.8, 3)
        if (cap) { x.fillStyle = team[0]; x.fillRect(px + 0.8, y - 3.2, 3.2, 1.3) }
        const arms = R()
        x.fillStyle = shirt
        if (arms < 0.6) { x.fillRect(px - 0.6, y - 5, 1.4, 5.5); x.fillRect(px + 3.8, y - 5, 1.4, 5.5) }
        else if (arms < 0.85) x.fillRect(px + 3.8, y - 5.4, 1.4, 6)
        continue
      }
      x.fillStyle = shirt; x.fillRect(px, y + 3.5, 4.6, 6)
      x.fillStyle = head; x.fillRect(px + 1, y + 0.6, 2.8, 3)
      if (cap) { x.fillStyle = home ? team[0] : '#20262c'; x.fillRect(px + 0.8, y + 0.2, 3.2, 1.3) }
    }
    if (!up) for (let px = 0; px < wide; px += 170) { x.fillStyle = '#2a333c'; x.fillRect(px + 1, y, 6, RH) }
  }
  crowds.set(id, c)
  return c
}
// A stand along a run of its front (pts, each { x, z }): from the front wall (y0, at the front) back `deep` metres and
// up to y1, the picture laid a slice at a time. side: which way is back (+1: to the right of the run's direction)
const TILE_M = 48
function standRun(ctx, C, pic, pts, deep, y0, y1, side = -1, n0 = 4, list = null) {
  if (!pic) return
  let total = 0
  const segs = []
  for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z); segs.push({ a, b, L, at: total }); total += L }
  for (const sg of segs) {
    const { a, b, L } = sg, nx = (-(b.z - a.z) / L) * side, nz = ((b.x - a.x) / L) * side
    // (a slice every three metres or so: n0 says how fine, 1 the lightest)
    const n = Math.max(1, Math.ceil(L / (n0 >= 3 ? 3 : 9)))
    for (let k = 0; k < n; k++) {
      const f0 = k / n, f1 = (k + 1) / n
      const ax = lerp(a.x, b.x, f0), az = lerp(a.z, b.z, f0), bx = lerp(a.x, b.x, f1), bz = lerp(a.z, b.z, f1)
      const fa = P(C, ax, y0, az), fb = P(C, bx, y0, bz), ta = P(C, ax + nx * deep, y1, az + nz * deep), tb = P(C, bx + nx * deep, y1, bz + nz * deep)
      if (!fa.ok || !fb.ok || !ta.ok || !tb.ok) continue
      const d = (fa.d + tb.d) / 2
      // (where in the picture: by the metre along the stand, the picture repeating every TILE_M)
      const m0 = sg.at + f0 * L, m1 = sg.at + f1 * L, t0 = Math.floor(m0 / TILE_M)
      const u0 = ((m0 - t0 * TILE_M) / TILE_M) * pic.width, u1 = Math.min(pic.width, ((m1 - t0 * TILE_M) / TILE_M) * pic.width)
      const draw = () => {
        const left = Math.min(fa.x, fb.x, ta.x, tb.x), right = Math.max(fa.x, fb.x, ta.x, tb.x)
        if (right < -20 || left > 380) return
        const top = Math.min(ta.y, tb.y), bot = Math.max(fa.y, fb.y)
        // the slice, its corners where they really are: a front edge and a back edge, skewed
        ctx.save(); ctx.beginPath(); ctx.moveTo(fa.x, fa.y); ctx.lineTo(fb.x, fb.y); ctx.lineTo(tb.x, tb.y); ctx.lineTo(ta.x, ta.y); ctx.closePath(); ctx.clip()
        ctx.drawImage(pic, Math.min(u0, u1), 0, Math.max(1, Math.abs(u1 - u0)), pic.height, left, top, right - left + 1, bot - top + 1)
        ctx.restore()
        // the front wall under the first row
        ctx.fillStyle = '#0b1116'; ctx.beginPath(); ctx.moveTo(fa.x, fa.y); ctx.lineTo(fb.x, fb.y); const g0 = P(C, bx, 0, bz), g1 = P(C, ax, 0, az); ctx.lineTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.closePath(); ctx.fill()
      }
      if (list) list.push({ d, draw }); else draw()
    }
  }
}
// one lamp's haze, painted once
let glowPic = null
function glow() {
  if (glowPic || typeof document === 'undefined') return glowPic
  glowPic = document.createElement('canvas'); glowPic.width = glowPic.height = 64
  const x = glowPic.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 32)
  g.addColorStop(0, 'rgba(240,246,255,.55)'); g.addColorStop(0.25, 'rgba(215,230,255,.16)'); g.addColorStop(1, 'rgba(200,220,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 64, 64)
  return glowPic
}
// a light tower: a steel mast, the bank of lamps on top (half of them dark at an empty showcase)
function tower(ctx, C, X, Z, H, empty, list) {
  const base = P(C, X, 0, Z), top = P(C, X, H, Z)
  if (!base.ok || !top.ok) return
  list.push({ d: base.d, draw: () => {
    if (top.x < -60 || top.x > 420) return
    ctx.strokeStyle = '#1a222b'; ctx.lineWidth = Math.max(1, 0.5 * top.s); ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke()
    const w = 9 * top.s, h = 4.2 * top.s
    ctx.fillStyle = '#10161c'; ctx.fillRect(top.x - w / 2, top.y - h, w, h)
    const g = glow(), rows = 3, cols = 6
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lx = top.x - w / 2 + (c + 0.5) * w / cols, ly = top.y - h + (r + 0.5) * h / rows
      if (empty && (r + c) % 2) { ctx.fillStyle = '#2a333c'; ctx.fillRect(lx - w / cols * 0.3, ly - h / rows * 0.3, w / cols * 0.6, h / rows * 0.6); continue }
      ctx.fillStyle = '#f4f8ff'; ctx.fillRect(lx - w / cols * 0.32, ly - h / rows * 0.32, w / cols * 0.64, h / rows * 0.64)
    }
    if (g && !empty) { const rr2 = Math.max(18, w * 1.3); ctx.drawImage(g, top.x - rr2, top.y - h / 2 - rr2, rr2 * 2, rr2 * 2) }
  } })
}

// ── The ballpark ────────────────────────────────────────────────────────────
// Everything that doesn't move: the night, the stands and the upper deck, the light towers, the scoreboard's frame,
// the batter's eye, the wall with its numbers and the yellow line, the foul poles, the warning track, the grass in its
// mowed checks, the infield skin, the mound, the plate, the chalk. o: { team: [c1, c2], empty (the showcase: an empty
// park, half the lights), seat (the seats' colour), wall (the wall's colour), lite (a camera on the move, drawn every
// frame: no dirt texture, no upper deck, a slice a run of the stands) }
export function park(ctx, view, C, o = {}) {
  const { w, h } = view, team = o.team ?? ['#39424c', '#aab0b6'], empty = !!(o.empty || view.empty), mode = empty ? 'empty' : 'sit'
  C.empty = empty   // (crowdRise and flashesB read it off the camera: nobody to get up in an empty park)
  const seat = o.seat ?? '#173a5c', wallC = o.wall ?? '#173628'
  ctx.fillStyle = '#060a12'; ctx.fillRect(0, 0, w, h)
  // the sky low down, a shade lighter in the haze of the lights
  const hz = C.cy - C.F * Math.tan(C.pitch)
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, hz - 140, w, 140)
  ctx.fillStyle = '#0e1626'; ctx.fillRect(0, hz - 60, w, 60)
  // ── the ground ──
  // foul ground and everything round the field: a darker grass to the stands
  ctx.fillStyle = '#1d5a33'; ctx.beginPath(); flat(ctx, C, [-200, -60, 200, -60, 200, 200, -200, 200]); ctx.fill()
  // the outfield, mowed in a check: stripes across the field and along it
  ctx.save(); ctx.beginPath(); const fpts = [0, 0]; for (const p of FENCE) fpts.push(p.x, p.z); if (flat(ctx, C, fpts)) ctx.clip()
  ctx.fillStyle = '#27783f'; ctx.beginPath(); flat(ctx, C, fpts); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.06)'
  for (let u = -264; u < 0; u += 12) { ctx.beginPath(); flat(ctx, C, band(u, u + 6, 0, 270)); ctx.fill() }
  ctx.fillStyle = 'rgba(0,0,0,.07)'
  for (let v = 0; v < 270; v += 12) { ctx.beginPath(); flat(ctx, C, band(-270, 0, v, v + 6)); ctx.fill() }
  ctx.restore()
  // the warning track: 15 feet of dirt in front of the wall
  { const pts = []; for (const p of FENCE) pts.push(p.x, p.z); for (let i = FENCE.length - 1; i >= 0; i--) { const p = FENCE[i], r = Math.hypot(p.x, p.z), k = (r - 4.6) / r; pts.push(p.x * k, p.z * k) } ctx.fillStyle = '#8a5b38'; ctx.beginPath(); flat(ctx, C, pts); ctx.fill() }
  // the infield skin: the arc 95 feet from the rubber, between the lines
  { const pts = [0, 0]; for (let i = 0; i <= 30; i++) { const a = lerp(-Math.PI / 4, Math.PI / 4, i / 30), r = 28.96; pts.push(Math.sin(a) * r, RUBBER + Math.cos(a) * r - 0) } ctx.fillStyle = '#a36b42'; ctx.beginPath(); flat(ctx, C, clipLines(pts)); ctx.fill() }
  // the infield grass, the cut-outs round the bases, the base paths, the plate's circle and the mound
  ctx.fillStyle = '#2a7f45'; ctx.beginPath(); flat(ctx, C, [0, 2.6, 16.4, 19.4, 0, 35.8, -16.4, 19.4]); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); flat(ctx, C, [0, 2.6, 8.2, 11, -0.4, 19.6, -8.6, 11]); ctx.fill(); ctx.beginPath(); flat(ctx, C, [0.4, 19.6, 8.6, 27.6, 0, 35.8, -8.2, 27.6]); ctx.fill()
  ctx.fillStyle = '#a36b42'
  for (const b of [FIRST, SECOND, THIRD]) { ctx.beginPath(); disc(ctx, C, b.x, b.z, 3.6); ctx.fill() }
  ctx.beginPath(); disc(ctx, C, 0, 0.2, 3.96, 32); ctx.fill()
  ctx.beginPath(); disc(ctx, C, 0, RUBBER - 0.45, 2.74, 28); ctx.fill()
  ctx.fillStyle = '#9b643c'; ctx.beginPath(); disc(ctx, C, 0, RUBBER - 0.45, 1.3, 20, 0.12); ctx.fill()
  // the running lane down to first, the dirt paths
  ctx.fillStyle = '#a36b42'; ctx.beginPath(); flat(ctx, C, [0.5, 1.6, 1.4, 1.6, 19.9, 17.6, 19.0, 18.5]); ctx.fill()
  ctx.beginPath(); flat(ctx, C, [-0.5, 1.6, -1.4, 1.6, -19.9, 17.6, -19.0, 18.5]); ctx.fill()
  // the dirt's texture, faint (baked: cheap enough once)
  let sd = 11
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < (o.lite ? 0 : 900); i++) {
    const X = (R() - 0.5) * 50, Z = R() * 48, p = P(C, X, 0, Z)
    if (!p.ok || p.y > h || p.y < 0) continue
    ctx.fillStyle = R() < 0.5 ? 'rgba(255,240,220,.05)' : 'rgba(40,20,5,.08)'
    ctx.fillRect(p.x, p.y, Math.max(1, 0.25 * p.s), Math.max(0.6, 0.04 * p.s))
  }
  // ── the chalk ──
  ctx.fillStyle = 'rgba(246,244,236,.92)'; ctx.beginPath()
  const lf = FENCE[0], rf = FENCE[FENCE.length - 1]
  lineB(ctx, C, 0, 0, lf.x, lf.z, 0.08); lineB(ctx, C, 0, 0, rf.x, rf.z, 0.08)
  // the batter's boxes (4 by 6 feet, six inches off the plate) and the catcher's box
  for (const sd2 of [-1, 1]) {
    const x0 = sd2 * 0.368, x1 = sd2 * 1.587, z0 = -0.85, z1 = 0.98
    lineB(ctx, C, x0, z0, x0, z1, 0.06); lineB(ctx, C, x1, z0, x1, z1, 0.06); lineB(ctx, C, x0, z0, x1, z0, 0.06); lineB(ctx, C, x0, z1, x1, z1, 0.06)
  }
  lineB(ctx, C, -0.55, -0.85, -0.55, -2.4, 0.06); lineB(ctx, C, 0.55, -0.85, 0.55, -2.4, 0.06); lineB(ctx, C, -0.55, -2.4, 0.55, -2.4, 0.06)
  ctx.fill()
  // the plate (a white pentagon, its point to the catcher) and the bases, raised a little
  ctx.fillStyle = '#f7f6f0'; ctx.beginPath(); flat(ctx, C, [-0.216, 0.43, 0.216, 0.43, 0.216, 0.216, 0, 0, -0.216, 0.216], 0.01); ctx.fill()
  for (const b of [FIRST, SECOND, THIRD]) { ctx.fillStyle = '#f7f6f0'; ctx.beginPath(); flat(ctx, C, [b.x - 0.19, b.z, b.x, b.z + 0.19, b.x + 0.19, b.z, b.x, b.z - 0.19], 0.06); ctx.fill() }
  // the rubber
  ctx.fillStyle = '#f7f6f0'; ctx.beginPath(); flat(ctx, C, [-0.3, RUBBER, 0.3, RUBBER, 0.3, RUBBER + 0.15, -0.3, RUBBER + 0.15], MOUND_H); ctx.fill()
  // ── the uprights, far to near ──
  const list = []
  // the wall: padded, the yellow line along its top, the numbers at the lines, the alleys and centre
  for (let i = 0; i + 1 < FENCE.length; i++) {
    const a = FENCE[i], b = FENCE[i + 1], q = upright(C, a.x, a.z, b.x, b.z, 0, WALL_H)
    if (!q) continue
    const phi = -45 + i * 2.5
    list.push({ d: (q[0].d + q[1].d) / 2, draw: () => {
      const eye = Math.abs(phi + 1.25) < 9
      ctx.fillStyle = eye ? '#0d1f17' : wallC; ctx.beginPath(); quad(ctx, q); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.6; ctx.stroke()
      ctx.fillStyle = '#f2c21b'; const yl = lerp(q[3].y, q[0].y, 0.04); ctx.fillRect(Math.min(q[0].x, q[1].x), yl - Math.max(0.8, 0.07 * q[0].s), Math.abs(q[1].x - q[0].x) + 0.5, Math.max(0.8, 0.07 * q[0].s))
    } })
  }
  for (const [phi, num] of [[-44, '330'], [-22.5, '375'], [0, '400'], [22.5, '375'], [44, '330']]) {
    const p = fenceAt(phi), r = Math.hypot(p.x, p.z), k = (r - 0.05) / r, at = P(C, p.x * k, WALL_H * 0.55, p.z * k)
    if (!at.ok || at.s < 0.6) continue
    list.push({ d: at.d - 0.5, draw: () => text(ctx, num, at.x, at.y, { font: DISPLAY, size: Math.max(5, 1.1 * at.s), color: '#f3f1ea' }) })
  }
  // the foul poles, yellow, 'til well up over the stands
  for (const p of [FENCE[0], FENCE[FENCE.length - 1]]) {
    const a = P(C, p.x, 0, p.z), b = P(C, p.x, 24, p.z)
    if (!a.ok || !b.ok) continue
    list.push({ d: a.d - 1, draw: () => { ctx.strokeStyle = '#f2c21b'; ctx.lineWidth = Math.max(1, 0.25 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() } })
  }
  // the bleachers over the outfield wall (the batter's eye in dead centre: dark, nobody in it)
  const pic = crowdPic(team, 20, 23, 1024, mode, seat)
  const runL = [], runR = []
  for (let i = 0; i < FENCE.length; i++) { const phi = -45 + i * 2.5; const p = FENCE[i], r = Math.hypot(p.x, p.z), k = (r + 1.5) / r; const q = { x: p.x * k, z: p.z * k }; if (phi <= -10) runL.push(q); if (phi >= 7.5) runR.push(q) }
  const nS = o.lite ? 1 : 3
  standRun(ctx, C, pic, runL, 22, WALL_H + 0.4, 15, 1, nS, list)
  standRun(ctx, C, pic, runR, 22, WALL_H + 0.4, 15, 1, nS, list)
  // the batter's eye: a dark green block behind dead centre
  { const a = fenceAt(-10), b = fenceAt(7.5), ka = 1 + 1.5 / Math.hypot(a.x, a.z), kb = 1 + 1.5 / Math.hypot(b.x, b.z)
    const q = upright(C, a.x * ka, a.z * ka, b.x * kb, b.z * kb, WALL_H, 13)
    if (q) list.push({ d: (q[0].d + q[1].d) / 2 + 2, draw: () => { ctx.fillStyle = '#0a1a12'; ctx.beginPath(); quad(ctx, q); ctx.fill() } }) }
  // the scoreboard's frame, up behind right-centre (its lights are drawn live: scoreboard())
  { const q = upright(C, 22, 150, 52, 140, 17, 31)
    if (q) list.push({ d: (q[0].d + q[1].d) / 2, draw: () => { ctx.fillStyle = '#05080b'; ctx.beginPath(); quad(ctx, q); ctx.fill(); ctx.strokeStyle = '#1b232b'; ctx.lineWidth = Math.max(1, 0.4 * q[0].s); ctx.stroke() } }) }
  // the stands round foul ground: the lower bowl, a gap, the upper deck over it
  const lower = crowdPic(team, 26, 31, 1024, mode, seat, o.lite ? 1 : 2), upper = crowdPic(team, 20, 17, 1024, mode, seat)
  standRun(ctx, C, lower, BOWL, 24, 1.3, 13, -1, nS, list)
  if (!o.lite) { const deck = BOWL.map(p => { const r = Math.hypot(p.x, p.z - 10), k = (r + 22) / r; return { x: p.x * k, z: 10 + (p.z - 10) * k } }); standRun(ctx, C, upper, deck, 18, 17, 30, -1, 3, list) }
  // the dugouts: dark mouths in the front wall either side of the plate, the rail, men on it
  for (const sd2 of [-1, 1]) {
    const x0 = sd2 * 14, z0 = 2, x1 = sd2 * 25, z1 = 11
    const q = upright(C, x0 + sd2 * 4.2, z0 - 4.2, x1 + sd2 * 4.2, z1 - 4.2, 0, 1.25)
    if (!q) continue
    list.push({ d: (q[0].d + q[1].d) / 2 - 0.3, draw: () => {
      ctx.fillStyle = '#030507'; ctx.beginPath(); quad(ctx, q); ctx.fill()
      ctx.fillStyle = '#2a333c'; ctx.fillRect(Math.min(q[3].x, q[2].x), Math.min(q[3].y, q[2].y) - 1, Math.abs(q[2].x - q[3].x), Math.max(1.2, 0.08 * q[0].s))
      // the men on the top step, leaning on the rail
      if (empty) return
      for (let k = 0; k < 7; k++) {
        const f = (k + 0.5) / 7, px = lerp(q[3].x, q[2].x, f), py = lerp(q[3].y, q[2].y, f), s = lerp(q[3].s, q[2].s, f)
        ctx.fillStyle = sd2 < 0 ? team[0] : '#2a3036'; ctx.fillRect(px - 0.22 * s, py - 0.55 * s, 0.44 * s, 0.6 * s)
        ctx.fillStyle = '#8d5a3b'; ctx.fillRect(px - 0.11 * s, py - 0.8 * s, 0.22 * s, 0.24 * s)
        ctx.fillStyle = sd2 < 0 ? team[0] : '#2a3036'; ctx.fillRect(px - 0.14 * s, py - 0.86 * s, 0.28 * s, 0.09 * s)
      }
    } })
  }
  // the light towers, along the tops of the stands
  for (const [X, Z] of [[-62, 34], [-40, -8], [40, -8], [62, 34], [-58, 108], [58, 108]]) tower(ctx, C, X, Z, 46, empty, list)
  list.sort((a, b) => b.d - a.d)
  for (const it of list) it.draw()
  // the lights land on the grass: a shade under the stands, and half the lights at a showcase
  if (empty) { ctx.fillStyle = 'rgba(2,6,10,.22)'; ctx.fillRect(0, 0, w, h) }
}
// the mower's checks: a band of the outfield between u0..u1 (u = X - Z, along the first-base line) and v0..v1
// (v = X + Z, along the third-base line), as X, Z corners
const band = (u0, u1, v0, v1) => [(u0 + v0) / 2, (v0 - u0) / 2, (u0 + v1) / 2, (v1 - u0) / 2, (u1 + v1) / 2, (v1 - u1) / 2, (u1 + v0) / 2, (v0 - u1) / 2]
// keep a shape between the foul lines (the infield skin's arc reaches past them)
function clipLines(pts) {
  const out = []
  for (let i = 0; i < pts.length; i += 2) { let x = pts[i], z = pts[i + 1]; if (Math.abs(x) > z) x = Math.sign(x) * z; out.push(x, z) }
  return out
}
// A camera at rest: the whole park painted once and stamped. key: anything that changes it
export function staticPark(ctx, view, C, key, o = {}) {
  C.empty = !!(o.empty || view.empty)
  layer(ctx, view, `bb|${key}|${C.x}|${C.y}|${C.z}|${C.F}|${C.cy}|${C.yaw}|${C.pitch}|${(o.team ?? []).join()}|${o.empty ? 1 : 0}`, x => park(x, view, C, o))
}

// ── The men ─────────────────────────────────────────────────────────────────
// A ballplayer: the cap (or the batting helmet, its flap over the ear toward the mound), the button-front jersey with
// its piping and the club's script across the chest, the number big on the back with the name over it, the belt, the
// pants (whites at home, grays on the road) to just under the knee with the socks high in the club colour, or down
// to the cleats; the undershirt sleeves, batting gloves, the fielder's glove on the other hand, the bat. The catcher
// in his gear, the umpire in his. Every part outlined in the art layer's ink, lit from the upper left.
//
// A pose is soccer's (lib/mg/soccer.js) in the same rig units (a man about 110 high, feet at 0, up is minus), plus:
//   bat 1 he holds the bat · ba its angle on the screen (radians, 0 pointing right) · bl how much of it shows (0-1,
//   it shortens pointing at or away from the lens) · bf 1 the bat in front of him, 0 behind · mitt 1 the glove open
//   to the lens (a catcher's target, a fielder taking a throw) · cap 0 off (the helmet in the air)
const DEF = { hy: 53, hx: 0, lean: 0, bow: 0, lx: -8, ly: 0, rx: 8, ry: 0, lk: 0, rk: 0, hlx: -16.5, hly: -47.5, hrx: 16.5, hry: -47.5, elbow: 0, fore: 0, rot: 0, head: 0, tilt: 0, face: 0, fl: 0, fr: 0, bat: 0, ba: -1.6, bl: 0.85, bf: 1, mitt: 0, cap: 1 }
const pz = o => ({ ...DEF, ...o })
const angMix = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * f }
export const mixB = (a, b, f) => {
  const o = {}
  for (const k in DEF) { const x = a[k] ?? DEF[k], y = b[k] ?? DEF[k]; o[k] = k === 'face' || k === 'bat' || k === 'bf' || k === 'cap' ? (f < 0.5 ? x : y) : k === 'ba' ? angMix(x, y, f) : x + (y - x) * f }
  return o
}
// (mirror a pose left to right: a left-handed hitter's stance, a lefty's delivery)
export function flipB(p) {
  const o = { ...p }
  o.hx = -(p.hx ?? 0); o.lean = -(p.lean ?? 0); o.rot = -(p.rot ?? 0); o.head = -(p.head ?? 0)
  o.lx = -(p.rx ?? DEF.rx); o.rx = -(p.lx ?? DEF.lx); o.ly = p.ry ?? 0; o.ry = p.ly ?? 0; o.lk = p.rk ?? 0; o.rk = p.lk ?? 0
  o.hlx = -(p.hrx ?? DEF.hrx); o.hrx = -(p.hlx ?? DEF.hlx); o.hly = p.hry ?? DEF.hry; o.hry = p.hly ?? DEF.hly; o.fl = p.fr ?? 0; o.fr = p.fl ?? 0
  o.ba = Math.PI - (p.ba ?? DEF.ba)
  return o
}
export const BP = {
  stand: pz({}),
  hips: pz({ lx: -9, rx: 9, hlx: -11, hly: -57, hrx: 11, hry: -57, elbow: 1, tilt: -0.2 }),
  hipsDown: pz({ lx: -9, rx: 9, hlx: -11, hly: -57, hrx: 11, hry: -57, elbow: 1, tilt: -0.9, face: 2 }),
  knees: pz({ hy: 41, bow: 0.5, lx: -11, rx: 11, lk: 0.5, rk: 0.5, hlx: -10, hly: -32, hrx: 10, hry: -32, elbow: 0.4, tilt: -0.6, face: 2 }),
  fist: pz({ hy: 51, lean: 0.04, lx: -12, rx: 12, hlx: -16, hly: -54, hrx: 17, hry: -114, elbow: 0.25, face: 1, tilt: 0.3 }),
  roar: pz({ hy: 50, lx: -14, rx: 14, hlx: -22, hly: -114, hrx: 22, hry: -114, elbow: 0.3, face: 1, tilt: 0.5 }),
  armsUp: pz({ hy: 52, lx: -11, rx: 11, hlx: -14, hly: -122, hrx: 14, hry: -122, face: 1, tilt: 0.6 }),
  jump: pz({ hy: 50, lx: -8, ly: -16, rx: 8, ry: -18, lk: 1, rk: 1, hlx: -16, hly: -120, hrx: 16, hry: -120, face: 1, tilt: 0.5 }),
  clap: pz({ hlx: -2, hly: -80, hrx: 2, hry: -80, elbow: 0.6, fore: 0.6, face: 1 }),
  point: pz({ hrx: 12, hry: -119, fr: 1, face: 1, tilt: 0.6 }),
  // an umpire's calls: set behind the catcher, the punch-out, safe (arms out), out (a fist hammered down)
  umpSet: pz({ hy: 40, bow: 0.32, lx: -15, rx: 15, lk: 0.4, rk: 0.4, hlx: -9, hly: -46, hrx: 9, hry: -46, elbow: 0.5 }),
  punch: pz({ hy: 50, lx: -11, rx: 13, hlx: -12, hly: -60, hrx: 34, hry: -86, elbow: 0.2, face: 1 }),
  safe: pz({ hy: 47, bow: 0.15, lx: -14, rx: 14, lk: 0.2, rk: 0.2, hlx: -46, hly: -72, hrx: 46, hry: -72, face: 1 }),
  outCall: pz({ hy: 50, lx: -11, rx: 11, hlx: -10, hly: -60, hrx: 16, hry: -116, elbow: 0.25, face: 1 }),
  // a catcher in his crouch, his glove up as the target (moved by the game), the bare hand tucked behind
  crouch: pz({ hy: 27, bow: 0.12, lx: -17, rx: 17, lk: 0.85, rk: 0.85, hlx: -15, hly: -56, hrx: 8, hry: -30, elbow: 0.5, fore: 0.5, mitt: 1 }),
  // a fielder set for the ball, a man walking off with his head down, a beaten pitcher watching it go
  ready: pz({ hy: 47, bow: 0.18, lx: -13, rx: 13, lk: 0.3, rk: 0.3, hlx: -15, hly: -52, hrx: 15, hry: -52, elbow: 0.35 }),
  walkOff: pz({ tilt: -1, face: 2, hlx: -15, hly: -48, hrx: 15, hry: -48 }),
  stare: pz({ lx: -9, rx: 9, hlx: -11, hly: -57, hrx: 11, hry: -57, elbow: 1, tilt: 0.7 }),
  // the pitcher on the rubber, the ball hidden in his glove at his chest
  set: pz({ lx: -9, rx: 9, hlx: -3, hly: -74, hrx: 4, hry: -72, elbow: 0.6, fore: 0.7 }),
  // a runner's lead off first: low, wide, his weight on the balls of his feet
  lead: pz({ hy: 42, bow: 0.22, lx: -17, rx: 17, lk: 0.4, rk: 0.4, hlx: -14, hly: -44, hrx: 14, hry: -44, elbow: 0.25 }),
}
// Running: soccer's stride, in spikes. phase 0-1 through a stride; k 0-1 how hard. o: { lean, arms: 'pump' | 'fist' | 'up' }
export function runB(phase, k = 1, o = null) {
  const out = { ...DEF }
  const leg = u => { u = ((u % 1) + 1) % 1; if (u < 0.42) return { y: 0, kn: 0.2 }; const f = (u - 0.42) / 0.58; return { y: -Math.sin(f * Math.PI) * (16 + 12 * k) * k, kn: -Math.cos(f * Math.PI) } }
  const L = leg(phase), R = leg(phase + 0.5), s = Math.sin(phase * Math.PI * 2)
  out.lx = -6.5; out.rx = 6.5; out.ly = L.y; out.ry = R.y; out.lk = L.kn; out.rk = R.kn
  out.hy = 52 + Math.abs(Math.cos(phase * Math.PI * 2)) * 2.2 * k
  out.bow = 0.1 * k; out.lean = s * 0.025 * k + (o?.lean ?? 0); out.hx = (o?.lean ?? 0) * -10
  const fwdL = (1 - s) / 2, fwdR = (1 + s) / 2
  out.hlx = lerp(-15, -6, fwdL * k); out.hly = lerp(-58, -70, fwdL * k); out.hrx = lerp(15, 6, fwdR * k); out.hry = lerp(-58, -70, fwdR * k)
  out.elbow = 0; out.fore = 0.85
  if (o?.arms === 'fist') { const pump = Math.abs(Math.sin(phase * Math.PI)); out.hrx = 15; out.hry = lerp(-96, -118, pump); out.elbow = 0.3; out.fore = 0.3; out.face = 1 }
  if (o?.arms === 'up') { out.hlx = -14; out.hly = -120; out.hrx = 14; out.hry = -120; out.fore = 0; out.face = 1 }
  return out
}
const easeO = f => 1 - (1 - f) * (1 - f)
// The swing, seen from behind him (the hitting camera), for a right-handed hitter: hand -1 mirrors it.
// f: 0 the stance, 0.2 the load, 0.38 the stride down, 0.55 the bat through the zone (contact), 1 the finish.
// o: { pci: { y } how high he's swinging (-1 low .. 1 high) }
const SW_STANCE = pz({ hy: 48, lean: -0.04, lx: -13, rx: 11, lk: 0.2, rk: 0.25, hlx: 9, hly: -93, hrx: 13, hry: -96, elbow: 0.7, fore: 0.6, bat: 1, ba: -1.95, bl: 0.85 })
const SW_LOAD = pz({ hy: 50, lean: -0.08, lx: -11, ly: -7, rx: 11, lk: 0.6, rk: 0.25, hlx: 14, hly: -91, hrx: 18, hry: -94, elbow: 0.7, fore: 0.6, bat: 1, ba: -2.15, bl: 0.8 })
const SW_STRIDE = pz({ hy: 45, lean: -0.05, lx: -18, rx: 11, lk: 0.35, rk: 0.3, hlx: 15, hly: -88, hrx: 19, hry: -91, elbow: 0.6, fore: 0.6, bat: 1, ba: -2.3, bl: 0.7 })
const SW_HIT = pz({ hy: 45, lean: 0.06, lx: -18, rx: 10, rk: -0.3, hlx: 20, hly: -63, hrx: 25, hry: -61, elbow: 0.3, fore: 0.2, bat: 1, ba: 0.04, bl: 1 })
const SW_FINISH = pz({ hy: 48, lean: 0.1, lx: -17, rx: 9, ry: -4, rk: -0.7, hlx: -10, hly: -98, hrx: -6, hry: -102, elbow: 0.5, fore: 0.3, bat: 1, ba: 2.75, bl: 0.75, bf: 0 })
export const STANCE = SW_STANCE
export function swingPose(f, hand = 1, o = null) {
  let p
  if (f <= 0) p = SW_STANCE
  else if (f < 0.2) p = mixB(SW_STANCE, SW_LOAD, easeO(f / 0.2))
  else if (f < 0.38) p = mixB(SW_LOAD, SW_STRIDE, (f - 0.2) / 0.18)
  else if (f < 0.55) { const k = (f - 0.38) / 0.17; p = mixB(SW_STRIDE, SW_HIT, k * k) }
  else p = mixB(SW_HIT, SW_FINISH, easeO(clamp((f - 0.55) / 0.45, 0, 1)))
  // a low pitch takes the hands down and the barrel under, a high one up
  if (o?.pci && f > 0.3) { const k = Math.sin(clamp((f - 0.3) / 0.5, 0, 1) * Math.PI); p = { ...p, hly: p.hly - o.pci.y * 16 * k, hry: p.hry - o.pci.y * 16 * k, ba: p.ba - o.pci.y * 0.25 * k } }
  return hand < 0 ? flipB(p) : p
}
// The delivery, from behind him (the pitching camera), for a right-hander: hand -1 mirrors it.
// f: 0 set, 0.3 the leg up, 0.55 the stride and the arm back, 0.68 the release, 1 the follow-through.
// o: { slide } the slide step: the knee barely up, quick to the plate
const PI_SET = BP.set
const PI_LIFT = pz({ hy: 55, lean: -0.06, lx: -6, ly: -36, lk: 1, rx: 4, hlx: -2, hly: -82, hrx: 4, hry: -80, elbow: 0.6, fore: 0.7, tilt: 0.1 })
const PI_SLIDE = pz({ hy: 50, lean: -0.03, lx: -8, ly: -10, lk: 0.4, rx: 5, hlx: -2, hly: -78, hrx: 4, hry: -76, elbow: 0.6, fore: 0.7 })
const PI_STRIDE = pz({ hy: 44, lean: 0.04, lx: -17, ly: -4, rx: 11, rk: 0.4, hlx: -30, hly: -84, hrx: 34, hry: -66, elbow: 0.25, fore: 0.1 })
const PI_REL = pz({ hy: 43, lean: -0.1, bow: 0.3, lx: -15, ly: -4, rx: 10, rk: -0.2, hlx: -16, hly: -62, hrx: 9, hry: -124, elbow: 0.15 })
const PI_FIN = pz({ hy: 44, lean: -0.18, bow: 0.42, lx: -12, ly: -2, rx: 13, ry: -22, rk: -1, hlx: -10, hly: -66, hrx: -22, hry: -42, elbow: 0.3, fore: 0.3, tilt: 0.3 })
export function pitchPose(f, hand = 1, o = null) {
  let p
  const top = o?.slide ? PI_SLIDE : PI_LIFT
  if (f <= 0) p = PI_SET
  else if (f < 0.3) p = mixB(PI_SET, top, easeO(f / 0.3))
  else if (f < 0.55) p = mixB(top, PI_STRIDE, (f - 0.3) / 0.25)
  else if (f < 0.68) p = mixB(PI_STRIDE, PI_REL, (f - 0.55) / 0.13)
  else p = mixB(PI_REL, PI_FIN, easeO(clamp((f - 0.68) / 0.32, 0, 1)))
  return hand < 0 ? flipB(p) : p
}
// a throw (an outfielder's, a catcher's): the arm back, over the top, through. f 0-1, from behind him
const TH_BACK = pz({ hy: 48, lean: 0.05, lx: -15, rx: 12, hlx: -32, hly: -86, hrx: 38, hry: -78, elbow: 0.2 })
const TH_REL = pz({ hy: 46, lean: -0.12, bow: 0.3, lx: -15, rx: 10, rk: -0.3, hlx: -14, hly: -60, hrx: 8, hry: -122 })
const TH_FIN = pz({ hy: 47, lean: -0.15, bow: 0.4, lx: -12, rx: 12, ry: -14, rk: -0.8, hlx: -10, hly: -62, hrx: -20, hry: -46, elbow: 0.3 })
export function throwPose(f, hand = 1) {
  const p = f < 0.45 ? mixB(BP.ready, TH_BACK, easeO(f / 0.45)) : f < 0.62 ? mixB(TH_BACK, TH_REL, (f - 0.45) / 0.17) : mixB(TH_REL, TH_FIN, easeO(clamp((f - 0.62) / 0.38, 0, 1)))
  return hand < 0 ? flipB(p) : p
}

const TH = 27, SH = 26, UA = 18.5, FA = 17.5, TORSO = 33, HR = 7.4, SHW = 11.2, HIPW = 5.4
const OL = 1.15
function taper(x, ax, ay, ra, bx, by, rb) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy)
  if (d < Math.abs(ra - rb) + 0.05) { const r = Math.max(ra, rb), cx = ra > rb ? ax : bx, cy = ra > rb ? ay : by; x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, 6.2832); return }
  const a = Math.atan2(dy, dx), phi = Math.acos(clamp((ra - rb) / d, -1, 1))
  x.moveTo(ax + ra * Math.cos(a + phi), ay + ra * Math.sin(a + phi))
  x.arc(ax, ay, ra, a + phi, a + 2 * Math.PI - phi)
  x.arc(bx, by, rb, a - phi, a + phi)
  x.closePath()
}
function limbs(x, list, col, shade = true) {
  x.fillStyle = INK; x.beginPath(); for (const l of list) taper(x, l[0], l[1], l[2] + OL, l[3], l[4], l[5] + OL); x.fill()
  x.fillStyle = shade ? tone(col, 0.76) : col; x.beginPath(); for (const l of list) taper(x, l[0], l[1], l[2], l[3], l[4], l[5]); x.fill()
  if (!shade) return
  x.fillStyle = col; x.beginPath(); for (const l of list) { const k = 0.3; taper(x, l[0] - l[2] * k, l[1] - l[2] * 0.12, l[2] * 0.72, l[3] - l[5] * k, l[4] - l[5] * 0.12, l[5] * 0.72) } x.fill()
}
function armOf(ax, ay, tx, ty, px, py, fore = 0) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001
  const mx = UA + FA - 0.05
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx }
  const ux = dx / d, uy = dy / d, along = px * ux + py * uy, h = Math.sqrt(Math.max(0, UA * UA - (d * d) / 4)) * (1 - 0.8 * fore)
  let qx = px - ux * along, qy = py - uy * along
  const ql = Math.hypot(qx, qy) || 1; qx /= ql; qy /= ql
  return { sx: ax, sy: ay, jx: ax + dx * (UA / (UA + FA)) + qx * h, jy: ay + dy * (UA / (UA + FA)) + qy * h, ex: ax + dx, ey: ay + dy }
}
function kneeOf(hx, hy, ax, ay, k, out) {
  const L = Math.hypot(ax - hx, ay - hy), bend = clamp(1 - L / (TH + SH), 0, 1)
  const nx = (hx + ax) / 2 + out * bend * 7, ny = (hy + ay) / 2 - bend * 5
  let kx = nx, ky = ny
  if (k > 0) { kx = lerp(nx, lerp(hx, ax, 0.45) + out * 2, k); ky = lerp(ny, Math.min(ay - SH * 0.92, hy + TH), k) }
  else if (k < 0) { kx = lerp(nx, lerp(hx, ax, 0.3) + out * 1.5, -k); ky = lerp(ny, hy + TH * 0.94, -k) }
  const tx = kx - hx, ty = ky - hy, tl = Math.hypot(tx, ty)
  if (tl > TH) { kx = hx + (tx / tl) * TH; ky = hy + (ty / tl) * TH }
  return [kx, ky]
}
const hashOf = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h }
const HAIRS_DARK = ['#120e0b', '#17110d', '#1d1510'], HAIRS = ['#15110e', '#2c1f16', '#4a3220', '#6b4a2c', '#a07a48', '#c9a86a']
const BATS = ['#d9b98a', '#1d1a17', '#c9a26d', '#5a3a22', 'two', '#d9b98a']
const looks = new Map()
function lookOf(L) {
  const id = `${L.number ?? ''}|${L.skin ?? ''}|${L.name ?? ''}`
  let o = looks.get(id)
  if (o) return o
  const h = hashOf(id)
  const n = parseInt(String(warmSkin(L.skin ?? '#8d5a3b')).slice(1, 7), 16), lm = (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255
  o = { hair: lm < 0.45 ? HAIRS_DARK[h % 3] : HAIRS[(h >> 2) % (lm > 0.62 ? 6 : 4)], beard: h % 5 < 2, high: h % 3 !== 0, long: h % 4 < 2, bat: BATS[(h >> 4) % BATS.length], cleat: (h >> 5) % 3 === 0 ? '#f2f2ee' : '#15181c', gloveCol: ['#7a4a22', '#1b1612', '#9a5a26', '#5c3518'][(h >> 6) % 4] }
  if (looks.size > 200) looks.clear()
  looks.set(id, o)
  return o
}
// One man, in his own units at 0, 0 (his feet). look: a uniform (uniforms()) plus { skin, number, name, front,
// helmet (a batting helmet; flap: -1 the flap on the screen's left, 1 the right), batGloves [c1, c2], glove ('L' |
// 'R': the hand the fielder's glove is on), catcher (his gear), word (the script across his chest), capLetter,
// socksHigh, long (undershirt sleeves), beard, build (0 slim - 1 strong) }
export function paintBaller(x, o, L) {
  const lean = o.lean ?? 0, bow = clamp(Math.abs(o.bow ?? 0), 0, 0.8), front = !!L.front
  const skin = warmSkin(L.skin ?? '#8d5a3b'), skinD = tone(skin, 0.78)
  const lk0 = lookOf(L), lk = { ...lk0, high: L.socksHigh ?? lk0.high, long: L.long ?? lk0.long, beard: L.beard ?? lk0.beard }
  const bw = 1 + ((L.build ?? 0.5) - 0.45) * 0.18
  const T = TORSO * (1 - 0.4 * bow)
  const cl = Math.cos(lean), sl = Math.sin(lean), hipX = o.hx ?? 0, hipY = -(o.hy ?? 53)
  const sxx = hipX + sl * T, syy = hipY - cl * T, W = SHW * bw
  const lS = [sxx - cl * W, syy - sl * W + 3.2], rS = [sxx + cl * W, syy + sl * W + 3.2]
  const lH = [hipX - cl * HIPW, hipY - sl * HIPW], rH = [hipX + cl * HIPW, hipY + sl * HIPW]
  const lA = [o.lx ?? DEF.lx, (o.ly ?? 0) - 2.6], rA = [o.rx ?? DEF.rx, (o.ry ?? 0) - 2.6]
  const lK = kneeOf(lH[0], lH[1], lA[0], lA[1], o.lk ?? 0, -1), rK = kneeOf(rH[0], rH[1], rA[0], rA[1], o.rk ?? 0, 1)
  const el = o.elbow ?? 0
  const pole = (S, hy, out) => { const up = clamp((S[1] - hy) / 28, 0, 1); return [out * lerp(0.3 + 0.5 * up, 1, el), lerp(0.95 - 0.55 * up, 0.1, el)] }
  const lp = pole(lS, o.hly, -1), rp = pole(rS, o.hry, 1)
  const lArm = armOf(lS[0], lS[1], o.hlx, o.hly, lp[0], lp[1], o.fore ?? 0), rArm = armOf(rS[0], rS[1], o.hrx, o.hry, rp[0], rp[1], o.fore ?? 0)
  const tilt = o.tilt ?? 0, turnH = o.head ?? 0
  const nl = 4.2 * (1 - 0.3 * bow), hx = sxx + sl * (nl + HR) + turnH * 1.2, hy = syy - cl * (nl + HR) + (bow > 0.3 ? bow * 4 : 0) - tilt * 0.6
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'
  if (o.rot) { x.translate(hipX, hipY); x.rotate(o.rot); x.translate(-hipX, -hipY) }
  const inside = a => Math.abs(a.ex - sxx) < 9 && a.ey > syy + 2 && a.ey < hipY + 4
  const armBehind = a => !front && inside(a)
  const armOverHead = a => a.ey < hy + 4 && Math.abs(a.ex - hx) < 11
  const batOn = o.bat > 0.5 && !L.noBat
  if (batOn && !o.bf) paintBat(x, o, lArm, rArm, lk, L)
  for (const [a, out] of [[lArm, -1], [rArm, 1]]) if (armBehind(a)) paintArmB(x, a, out, L, skin, o, front, lk)
  // the legs: the cleats, the socks (high, or the pants down over them), the pant legs
  const legs = [[lH, lK, lA, -1], [rH, rK, rA, 1]]
  for (const [, , A, out] of legs) {
    const fx = A[0] + out * 2.6, fy = A[1] + 3.1
    x.fillStyle = INK; x.beginPath(); taper(x, A[0], A[1] + 0.6, 3.1 + OL, fx, fy, 2.8 + OL); x.fill()
    x.fillStyle = lk.cleat; x.beginPath(); taper(x, A[0], A[1] + 0.6, 3.1, fx, fy, 2.8); x.fill()
    x.fillStyle = lk.cleat === '#15181c' ? '#f2f2ee' : '#15181c'; x.fillRect(Math.min(A[0], fx) - 1.5, fy + 0.9, Math.abs(fx - A[0]) + 3, 1.1)
  }
  const sockTop = (K, A) => [lerp(K[0], A[0], 0.12), lerp(K[1], A[1], 0.12)]
  if (L.catcher) {
    // shin guards over the pants: hard shells from the instep to over the knee, the knee caps
    limbs(x, legs.map(([, K, A]) => [K[0], K[1] - 2, 4.9 * bw, A[0], A[1] - 1, 3.6]), L.pants)
    limbs(x, legs.map(([, K, A]) => [lerp(K[0], A[0], 0.05), lerp(K[1], A[1], 0.05), 4.8 * bw, lerp(K[0], A[0], 0.92), lerp(K[1], A[1], 0.92), 3.4]), '#22272d')
    x.fillStyle = '#3a414a'; x.beginPath(); for (const [, K] of legs) { x.moveTo(K[0] + 4.4, K[1]); x.arc(K[0], K[1], 4.4, 0, 6.2832) } x.fill()
  } else if (lk.high && !L.ump && !L.staff) {
    limbs(x, legs.map(([, K, A]) => { const s = sockTop(K, A); return [s[0], s[1], 4.4 * bw, A[0], A[1], 2.8] }), L.socks)
    // the stirrup's stripe, in the pants' colour
    x.fillStyle = L.pants; x.beginPath(); for (const [, K, A] of legs) { const a = [lerp(K[0], A[0], 0.42), lerp(K[1], A[1], 0.42)], b = [lerp(K[0], A[0], 0.5), lerp(K[1], A[1], 0.5)]; taper(x, a[0], a[1], 4.1 * bw, b[0], b[1], 3.9 * bw) } x.fill()
    limbs(x, legs.map(([H, K]) => [lerp(H[0], K[0], 0.3), lerp(H[1], K[1], 0.3), 6.4 * bw, K[0], K[1] + 3, 5.0 * bw]), L.pants)
    // the cuff, gathered just under the knee
    x.fillStyle = tone(L.pants, 0.82); x.beginPath(); for (const [, K, A] of legs) { const c = [lerp(K[0], A[0], 0.1), lerp(K[1], A[1], 0.1)]; taper(x, K[0], K[1] + 1.5, 5.0 * bw, c[0], c[1] + 0.6, 4.7 * bw) } x.fill()
  } else {
    // the pants worn long, down over the top of the cleats
    limbs(x, legs.map(([, K, A]) => [K[0], K[1], 5.2 * bw, A[0], A[1] + 0.4, 4.4 * bw]), L.pants)
  }
  limbs(x, legs.map(([H, K]) => [H[0], H[1], 6.8 * bw, K[0], K[1], 5.3 * bw]), L.pants)
  // the piping down the outside of each leg
  if (!L.ump && !L.staff) { x.strokeStyle = L.trim; x.lineWidth = 0.9; x.beginPath(); for (const [H, K, , out] of legs) { x.moveTo(H[0] + out * 6.2 * bw, H[1] + 2); x.lineTo(K[0] + out * 4.8 * bw, K[1]) } x.stroke() }
  // the seat of the pants
  const waist = d => {
    const ww = HIPW + 5.2 * bw + d, nx = -sl, ny = cl
    x.beginPath()
    x.moveTo(hipX - cl * ww - nx * (5 + d), hipY - sl * ww - ny * (5 + d)); x.lineTo(hipX + cl * ww - nx * (5 + d), hipY + sl * ww - ny * (5 + d))
    x.lineTo(hipX + cl * (ww + 0.6) + nx * (4 + d), hipY + sl * (ww + 0.6) + ny * (4 + d)); x.lineTo(hipX - cl * (ww + 0.6) + nx * (4 + d), hipY - sl * (ww + 0.6) + ny * (4 + d)); x.closePath()
  }
  waist(OL); x.fillStyle = INK; x.fill(); waist(0); x.fillStyle = L.pants; x.fill()
  // the jersey: loose, the far side in shade; the placket and buttons, the piping, the script, the number
  x.save(); x.translate(sxx, syy); x.rotate(lean)
  const jersey = () => {
    const w = W, wa = W * 0.88, ww = 9.6 * bw, wh = 9.8 * bw
    x.beginPath()
    x.moveTo(-w + 2.5, -0.8); x.quadraticCurveTo(-w - 0.8, -0.4, -w - 0.6, 4.6); x.lineTo(-wa, 10.5)
    x.quadraticCurveTo(-ww - 0.8, T * 0.62, -ww, T - 2.2); x.lineTo(-wh, T + 1.6); x.lineTo(wh, T + 1.6); x.lineTo(ww, T - 2.2)
    x.quadraticCurveTo(ww + 0.8, T * 0.62, wa, 10.5); x.lineTo(w + 0.6, 4.6); x.quadraticCurveTo(w + 0.8, -0.4, w - 2.5, -0.8); x.closePath()
  }
  jersey(); x.strokeStyle = INK; x.lineWidth = OL * 2; x.stroke(); x.fillStyle = L.jersey; x.fill()
  x.save(); jersey(); x.clip()
  x.fillStyle = tone(L.jersey, 0.84); x.beginPath(); x.moveTo(4.6, -2); x.quadraticCurveTo(7.2, T * 0.5, 5, T + 3); x.lineTo(15, T + 3); x.lineTo(15, -2); x.closePath(); x.fill()
  // the catcher's chest protector
  if (L.catcher && front) { x.fillStyle = INK; rr(x, -8.6, 1.2, 17.2, T - 3.5, 4); x.fill(); x.fillStyle = '#262c33'; rr(x, -7.8, 2, 15.6, T - 5, 3.5); x.fill(); x.fillStyle = '#3a424b'; for (let i = 0; i < 3; i++) x.fillRect(-7, 7 + i * 7, 14, 1.2) }
  if (L.catcher && !front) { x.strokeStyle = '#20252b'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-8, 2); x.lineTo(8, T - 4); x.moveTo(8, 2); x.lineTo(-8, T - 4); x.stroke() }
  x.fillStyle = '#1a1d22'; x.fillRect(-12, T - 1.8, 24, 3.4)   // the belt
  if (front) { x.fillStyle = '#c9ccce'; x.fillRect(-1.2, T - 1.6, 2.4, 3) }
  x.restore()
  // the piping: round the collar, down the front
  x.strokeStyle = L.trim; x.lineWidth = 1.2
  x.beginPath()
  if (front) { x.moveTo(-4.6, -0.6); x.lineTo(0, 4.6); x.lineTo(4.6, -0.6) } else { x.moveTo(-4.8, -0.4); x.quadraticCurveTo(0, 1.6, 4.8, -0.4) }
  x.stroke()
  if (front && !L.catcher) {
    x.fillStyle = skinD; x.beginPath(); x.moveTo(-3.6, -0.7); x.lineTo(0, 3.8); x.lineTo(3.6, -0.7); x.closePath(); x.fill()
    if (!L.ump && !L.staff) {
      x.strokeStyle = L.trim; x.lineWidth = 1; x.beginPath(); x.moveTo(0.8, 4.6); x.lineTo(0.8, T - 2); x.stroke()
      x.fillStyle = tone(L.jersey, 0.7); for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-0.6, 8 + i * 5.6, 0.55, 0, 6.2832); x.fill() }
    }
  }
  if (bow < 0.55 && !L.ump) {
    if (front && !L.catcher) {
      // the script across the chest, the number under it on his left (the screen's right)
      const word = String(L.word ?? '').toUpperCase()
      if (word && !L.staff) { x.save(); x.translate(0, 9.6); x.rotate(-0.08); x.font = `italic 6.6px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; const tw = x.measureText(word).width, k2 = Math.min(1, 16 / Math.max(1, tw)); x.scale(k2, 1); x.lineJoin = 'round'; x.strokeStyle = L.letter2; x.lineWidth = 1.4; x.strokeText(word, 0, 0); x.fillStyle = L.letter; x.fillText(word, 0, 0); x.restore() }
      if (L.number != null && !L.staff) text(x, String(L.number), 5.2, 17.5, { font: DISPLAY, size: 5.6, color: L.letter })
    } else if (!front && L.number != null && !L.staff) {
      const n = String(L.number)
      if (L.name) { x.save(); x.font = `4.6px ${LABEL}`; x.textAlign = 'center'; x.textBaseline = 'middle'; const tw = x.measureText(L.name).width, k2 = Math.min(1, 15 / Math.max(1, tw)); x.translate(0, 4.6); x.scale(k2, 1); x.fillStyle = L.letter; x.fillText(L.name, 0, 0); x.restore() }
      x.lineJoin = 'round'
      x.font = `${n.length > 1 ? 13 : 14.5}px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'
      x.strokeStyle = L.letter2; x.lineWidth = 1.6; x.strokeText(n, 0, 15 + (T - TORSO) * 0.3)
      x.fillStyle = L.letter; x.fillText(n, 0, 15 + (T - TORSO) * 0.3)
    }
  }
  x.restore()
  // the arms in front, the head, then any hand up at the head, then the bat
  const late = []
  for (const [a, out] of [[lArm, -1], [rArm, 1]]) { if (armBehind(a)) continue; if (armOverHead(a) || (front && Math.abs(a.ex - hx) < 9 && Math.abs(a.ey - hy) < 12)) late.push([a, out]); else paintArmB(x, a, out, L, skin, o, front, lk) }
  paintHeadB(x, sxx, syy, hx, hy, skin, skinD, lk, front, o, tilt, turnH, L)
  for (const [a, out] of late) paintArmB(x, a, out, L, skin, o, front, lk)
  if (batOn && o.bf) paintBat(x, o, lArm, rArm, lk, L)
  x.restore()
}
// the bat, from the hands: the knob under the bottom hand, the barrel out along ba; the batting gloves over it
function paintBat(x, o, lArm, rArm, lk, L) {
  const hx = (lArm.ex + rArm.ex) / 2, hy = (lArm.ey + rArm.ey) / 2, a = o.ba ?? -1.6, len = 52 * clamp(o.bl ?? 0.85, 0.15, 1)
  const ux = Math.cos(a), uy = Math.sin(a)
  const kx = hx - ux * 4, ky = hy - uy * 4, ex = hx + ux * len, ey = hy + uy * len
  const col = lk.bat === 'two' ? '#1d1a17' : lk.bat, handle = lk.bat === 'two' ? '#d9b98a' : lk.bat
  const mx = lerp(kx, ex, 0.5), my = lerp(ky, ey, 0.5)
  x.fillStyle = INK; x.beginPath(); taper(x, kx, ky, 1.2 + OL, mx, my, 1.5 + OL); taper(x, mx, my, 1.5 + OL, ex, ey, 2.7 + OL); x.fill()
  x.fillStyle = handle; x.beginPath(); taper(x, kx, ky, 1.2, mx, my, 1.5); x.fill()
  x.fillStyle = col; x.beginPath(); taper(x, lerp(kx, ex, 0.48), lerp(ky, ey, 0.48), 1.5, ex, ey, 2.7); x.fill()
  x.fillStyle = 'rgba(255,255,255,.24)'; x.beginPath(); taper(x, lerp(kx, ex, 0.56) + uy * 0.8, lerp(ky, ey, 0.56) - ux * 0.8, 0.45, ex + uy * 1.2, ey - ux * 1.2, 0.75); x.fill()
  x.fillStyle = INK; x.beginPath(); x.arc(kx, ky, 2.3, 0, 6.2832); x.fill(); x.fillStyle = handle; x.beginPath(); x.arc(kx, ky, 1.6, 0, 6.2832); x.fill()
  const g = L.batGloves ?? ['#f2f2ee', '#1a1d22']
  for (const [A, c] of [[lArm, g[0]], [rArm, g[1]]]) { x.fillStyle = INK; x.beginPath(); x.arc(A.ex, A.ey, 3 + OL, 0, 6.2832); x.fill(); x.fillStyle = c; x.beginPath(); x.arc(A.ex, A.ey, 3, 0, 6.2832); x.fill() }
}
function paintArmB(x, a, out, L, skin, o, front, lk) {
  const m = [lerp(a.sx, a.jx, 0.62), lerp(a.sy, a.jy, 0.62)]
  // the forearm (an undershirt sleeve to the wrist, or skin), the upper arm, the jersey's short sleeve over it
  const fore = lk.long || L.ump || L.staff ? L.under : skin
  limbs(x, [[a.jx, a.jy, 3.0, a.ex, a.ey, 2.4], [m[0], m[1], 3.5, a.jx, a.jy, 3.1]], fore)
  if (!lk.long && !L.ump && !L.staff) limbs(x, [[m[0], m[1], 3.5, a.jx, a.jy, 3.1]], L.under)
  limbs(x, [[a.sx, a.sy, 4.9, m[0], m[1], 4.4]], L.jersey)
  if (!L.ump && !L.staff) {
    x.strokeStyle = L.trim; x.lineWidth = 1.1; x.lineCap = 'butt'
    const dx = a.jx - a.sx, dy = a.jy - a.sy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl
    x.beginPath(); x.moveTo(m[0] + nx * 4.4, m[1] + ny * 4.4); x.lineTo(m[0] - nx * 4.4, m[1] - ny * 4.4); x.stroke(); x.lineCap = 'round'
  }
  // the hand: the fielder's glove on his glove hand, skin otherwise (a hand on the bat is drawn with the bat)
  if (o.bat > 0.5 && !L.noBat) return
  if (L.glove === (out < 0 ? 'L' : 'R')) {
    const big = L.catcher ? 6.6 : 5.4, open = o.mitt > 0.5 && (front || L.catcher)
    x.fillStyle = INK; x.beginPath(); x.ellipse(a.ex, a.ey - 1, big + OL, big * 1.12 + OL, 0, 0, 6.2832); x.fill()
    x.fillStyle = lk.gloveCol; x.beginPath(); x.ellipse(a.ex, a.ey - 1, big, big * 1.12, 0, 0, 6.2832); x.fill()
    if (open) { x.fillStyle = tone(lk.gloveCol, 1.25); x.beginPath(); x.ellipse(a.ex, a.ey - 0.5, big * 0.6, big * 0.72, 0, 0, 6.2832); x.fill(); x.strokeStyle = tone(lk.gloveCol, 0.55); x.lineWidth = 0.7; x.beginPath(); for (let i = -1; i <= 1; i++) { x.moveTo(a.ex + i * big * 0.35, a.ey - big * 1.0); x.lineTo(a.ex + i * big * 0.35, a.ey - big * 0.45) } x.stroke() }
    else { x.fillStyle = tone(lk.gloveCol, 0.75); x.beginPath(); x.ellipse(a.ex + 1, a.ey, big * 0.55, big * 0.8, 0.3, 0, 6.2832); x.fill() }
    return
  }
  const hc = L.batGloves && !L.catcher && !L.noGloves ? L.batGloves[out < 0 ? 0 : 1] : skin
  x.fillStyle = INK; x.beginPath(); x.arc(a.ex, a.ey, 2.7 + OL, 0, 6.2832); x.fill()
  x.fillStyle = tone(hc, 0.82); x.beginPath(); x.arc(a.ex, a.ey, 2.7, 0, 6.2832); x.fill()
  x.fillStyle = hc; x.beginPath(); x.arc(a.ex - 0.6, a.ey - 0.6, 2.0, 0, 6.2832); x.fill()
  if (o.ball === (out < 0 ? -1 : 1)) { x.fillStyle = '#f6f4ec'; x.beginPath(); x.arc(a.ex, a.ey - 1.4, 1.6, 0, 6.2832); x.fill() }
  const finger = out < 0 ? o.fl : o.fr
  if (finger > 0.5) {
    const dx = a.ex - a.jx, dy = a.ey - a.jy, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl
    x.strokeStyle = INK; x.lineWidth = 1.6 + OL * 2; x.beginPath(); x.moveTo(a.ex + ux * 1.5, a.ey + uy * 1.5); x.lineTo(a.ex + ux * 5.2, a.ey + uy * 5.2); x.stroke()
    x.strokeStyle = skin; x.lineWidth = 1.6; x.beginPath(); x.moveTo(a.ex, a.ey); x.lineTo(a.ex + ux * 5.2, a.ey + uy * 5.2); x.stroke()
  }
}
function paintHeadB(x, sxx, syy, hx, hy, skin, skinD, lk, front, o, tilt, turnH, L) {
  limbs(x, [[sxx, syy + 1, 4.0, hx, hy + 3.5, 3.4]], front ? skinD : tone(skin, 0.9), false)
  const rx = HR * 0.9, ry = HR * 1.04, up = clamp(tilt, -1, 1)
  x.fillStyle = INK; x.beginPath(); x.ellipse(hx, hy, rx + OL, ry + OL, 0, 0, 6.2832); x.fill()
  for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(hx + sd * (rx - 0.2) - turnH * 1.2, hy + 0.8, 1.7 + OL, 2.2 + OL, 0, 0, 6.2832); x.fill() }
  x.fillStyle = skinD; for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(hx + sd * (rx - 0.2) - turnH * 1.2, hy + 0.8, 1.7, 2.2, 0, 0, 6.2832); x.fill() }
  x.fillStyle = skin; x.beginPath(); x.ellipse(hx, hy, rx, ry, 0, 0, 6.2832); x.fill()
  // the hair under the cap: the back of his head from behind, a little at the temples from the front
  x.fillStyle = lk.hair; x.beginPath()
  if (!front) {
    const nape = hy + 6.6 - up * 2
    x.ellipse(hx, hy - 0.3, rx + 0.4, ry + 0.3, 0, Math.PI * 0.86, Math.PI * 2.14)
    x.quadraticCurveTo(hx + rx * 0.7, nape, hx, nape + 0.6); x.quadraticCurveTo(hx - rx * 0.7, nape, hx - (rx + 0.4) * Math.cos(Math.PI * 0.14), hy - 0.3 + (ry + 0.3) * Math.sin(Math.PI * 0.14)); x.closePath(); x.fill()
  } else {
    for (const sd of [-1, 1]) { x.moveTo(hx + sd * rx, hy - 2); x.lineTo(hx + sd * (rx - 0.2), hy + 1.6); x.lineTo(hx + sd * (rx - 1.6), hy - 2.4); x.closePath() }
    x.fill()
    const f = o.face ?? 0, fy = hy + up * -1.2, fx = hx + turnH * 1.4
    if (lk.beard) { x.fillStyle = lk.hair; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(hx, hy + 3.6, rx * 0.86, ry * 0.52, 0, 0.1, Math.PI - 0.1); x.fill(); x.globalAlpha = 1 }
    x.fillStyle = '#1a120d'
    const brow = f === 1 ? -0.5 : f === 2 ? 0.45 : 0
    for (const sd of [-1, 1]) { x.save(); x.translate(fx + sd * 2.7, fy - 1.6); x.rotate(sd * brow); x.fillRect(-1.4, -0.4, 2.8, 0.85); x.restore() }
    x.beginPath(); x.arc(fx - 2.6, fy + 0.5, 0.85, 0, 6.2832); x.arc(fx + 2.6, fy + 0.5, 0.85, 0, 6.2832); x.fill()
    x.fillStyle = tone(skin, 0.72); x.beginPath(); x.ellipse(fx + 0.5, fy + 2.6, 0.9, 1.3, 0, 0, 6.2832); x.fill()
    if (f === 1) { x.fillStyle = '#2a0f0c'; x.beginPath(); x.ellipse(fx, fy + 5, 2.1, 2.3, 0, 0, 6.2832); x.fill(); x.fillStyle = '#f2f0ea'; x.fillRect(fx - 1.5, fy + 3.2, 3, 0.8) }
    else if (f === 2) { x.strokeStyle = '#2a0f0c'; x.lineWidth = 0.8; x.beginPath(); x.arc(fx, fy + 6.8, 2, Math.PI * 1.2, Math.PI * 1.8); x.stroke() }
    else { x.fillStyle = '#3a1a14'; x.fillRect(fx - 1.6, fy + 4.8, 3.2, 0.75) }
  }
  if (o.cap === 0) return
  if (L.catcher) {
    // the catcher's helmet and mask: the shell, the cage across his face from the front
    x.fillStyle = INK; x.beginPath(); x.ellipse(hx, hy - 0.6, rx + 1.6 + OL, ry + 1.2 + OL, 0, 0, 6.2832); x.fill()
    x.fillStyle = '#20252b'; x.beginPath(); x.ellipse(hx, hy - 0.6, rx + 1.6, ry + 1.2, 0, 0, 6.2832); x.fill()
    x.fillStyle = L.cap; x.beginPath(); x.ellipse(hx, hy - 2.6, rx + 0.8, ry * 0.6, 0, Math.PI, Math.PI * 2); x.fill()
    if (front) { x.strokeStyle = '#8a9096'; x.lineWidth = 0.9; x.beginPath(); for (let i = -1; i <= 1; i++) { x.moveTo(hx - rx, hy + i * 2.6 + 1); x.lineTo(hx + rx, hy + i * 2.6 + 1) } x.moveTo(hx, hy - 2); x.lineTo(hx, hy + 6.5); x.stroke(); x.fillStyle = '#1a1d22'; x.fillRect(hx - 3, hy + 6.6, 6, 3.2) }
    return
  }
  if (L.ump) {
    x.fillStyle = INK; x.beginPath(); x.ellipse(hx, hy - 3, rx + 1 + OL, ry * 0.62 + OL, 0, Math.PI, Math.PI * 2); x.fill()
    x.fillStyle = L.cap; x.beginPath(); x.ellipse(hx, hy - 3, rx + 1, ry * 0.62, 0, Math.PI, Math.PI * 2); x.fill()
    if (front && L.mask !== false) { x.strokeStyle = '#2a2f36'; x.lineWidth = 1.4; x.beginPath(); x.rect(hx - rx + 0.5, hy - 2.5, rx * 2 - 1, ry * 1.5); x.stroke(); x.beginPath(); x.moveTo(hx - rx + 0.5, hy + 1.5); x.lineTo(hx + rx - 0.5, hy + 1.5); x.stroke() }
    return
  }
  if (L.helmet) {
    // the batting helmet: bigger than a cap, glossy, down over the ears; the flap over the ear facing the mound
    const flap = L.flap ?? -1
    x.fillStyle = INK; x.beginPath(); x.ellipse(hx, hy - 1.4, rx + 1.9 + OL, ry + 0.9 + OL, 0, Math.PI * 0.92, Math.PI * 2.08); x.fill()
    x.beginPath(); x.ellipse(hx + flap * (rx - 0.2), hy + 1.2, 3.6 + OL, 4.4 + OL, 0, 0, 6.2832); x.fill()
    x.fillStyle = L.cap; x.beginPath(); x.ellipse(hx, hy - 1.4, rx + 1.9, ry + 0.9, 0, Math.PI * 0.92, Math.PI * 2.08); x.fill()
    x.beginPath(); x.ellipse(hx + flap * (rx - 0.2), hy + 1.2, 3.6, 4.4, 0, 0, 6.2832); x.fill()
    x.fillStyle = tone(L.cap, 0.72); x.beginPath(); x.ellipse(hx + flap * (rx - 0.2), hy + 1.4, 1.4, 1.8, 0, 0, 6.2832); x.fill()
    x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.ellipse(hx - 2.4, hy - ry + 0.6, 2.6, 1.1, -0.3, 0, 6.2832); x.fill()
    if (front) { x.fillStyle = tone(L.cap, 0.6); x.beginPath(); x.ellipse(hx, hy - 3.2, rx + 1.4, 1.8, 0, 0, Math.PI); x.fill(); if (L.capLetter) text(x, String(L.capLetter).slice(0, 1), hx, hy - 6.2, { font: DISPLAY, size: 4.6, color: L.capFront }) }
    return
  }
  // a ball cap: the crown, the button, the bill out over the eyes from the front, the strap from behind
  x.fillStyle = INK; x.beginPath(); x.ellipse(hx, hy - 2.4, rx + 0.8 + OL, ry * 0.72 + OL, 0, Math.PI, Math.PI * 2); x.fill()
  x.fillStyle = L.cap; x.beginPath(); x.ellipse(hx, hy - 2.4, rx + 0.8, ry * 0.72, 0, Math.PI, Math.PI * 2); x.fill()
  x.fillStyle = INK; x.fillRect(hx - rx - 0.8 - OL, hy - 2.9, (rx + 0.8 + OL) * 2, 1.6)
  if (front) {
    x.fillStyle = INK; x.beginPath(); x.ellipse(hx, hy - 1.7, rx + 2.2 + OL, 2.2 + OL, 0, 0, Math.PI); x.fill()
    x.fillStyle = tone(L.cap, 0.8); x.beginPath(); x.ellipse(hx, hy - 1.7, rx + 2.2, 2.2, 0, 0, Math.PI); x.fill()
    if (L.capLetter) text(x, String(L.capLetter).slice(0, 1), hx, hy - 5.6, { font: DISPLAY, size: 4.4, color: L.capFront })
  } else { x.fillStyle = tone(L.cap, 0.7); x.fillRect(hx - 2, hy - 3.2, 4, 1.3) }
  x.fillStyle = L.cap; x.beginPath(); x.arc(hx, hy - 2.4 - ry * 0.72, 0.9, 0, 6.2832); x.fill()
}
// A man on the field: X across, Z along. A shadow tight under him, his name under his feet.
// o: { lift (metres off the grass), y (the ground under him: the mound), name, size, turn (0-1), shadow, alpha }
export function baller(ctx, C, X, Z, pose, look, o = {}) {
  const lift = o.lift ?? 0, p = P(C, X, o.y ?? 0, Z)
  if (!p.ok) return p
  const k = p.s * RIG_M * (o.size ?? 1)
  if (p.x < -110 * k || p.x > 470 + 110 * k) return p
  if (o.shadow !== false) {
    ctx.fillStyle = `rgba(2,8,4,${(0.4 * clamp(1 - lift / 2, 0.3, 1)).toFixed(3)})`
    ctx.beginPath(); ctx.ellipse(p.x + 2 * k, p.y + 0.5 * k, 17 * k * clamp(1 - lift / 3, 0.5, 1), 3.8 * k, 0, 0, 6.2832); ctx.fill()
  }
  const turn = o.turn ?? 0, sxk = Math.max(0.18, Math.abs(Math.cos(turn * Math.PI)))
  const L = turn > 0.5 ? { ...look, front: !look.front } : look
  if (o.alpha != null) ctx.globalAlpha = o.alpha
  ctx.save(); ctx.translate(p.x, p.y - lift * p.s); ctx.scale(k * sxk, k)
  paintBaller(ctx, pose, L)
  ctx.restore()
  if (o.alpha != null) ctx.globalAlpha = 1
  if (o.name) nameTag(ctx, null, p.x, p.y, o.name, clamp(k * 1.4, 0.7, 1.15))
  return p
}

// ── The ball ────────────────────────────────────────────────────────────────
// A white ball, its two red seams curving round it, turned by its spin
export function baseballAt(ctx, px, py, r, spin = 0) {
  if (r < 0.5) return
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, r + Math.max(0.5, r * 0.14), 0, 6.2832); ctx.fill()
  ctx.fillStyle = '#f6f4ec'; ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832); ctx.fill()
  if (r >= 2) {
    ctx.strokeStyle = RED; ctx.lineWidth = Math.max(0.6, r * 0.15)
    const c = Math.cos(spin), s = Math.sin(spin)
    for (const sd of [-1, 1]) {
      ctx.beginPath()
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * Math.PI - Math.PI / 2
        const ux = sd * (0.66 - 0.36 * Math.cos(t * 2)), uy = Math.sin(t) * 0.8
        const x2 = ux * c - uy * s, y2 = ux * s + uy * c
        if (i === 0) ctx.moveTo(px + x2 * r, py + y2 * r); else ctx.lineTo(px + x2 * r, py + y2 * r)
      }
      ctx.stroke()
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.arc(px, py, r, 0.2, 2.9); ctx.arc(px - r * 0.2, py - r * 0.25, r * 0.92, 2.9, 0.2, true); ctx.fill()
}
// the ball in the park: its shadow on the ground, drawn a touch bigger the farther off it is, so it always reads
export function ballB(ctx, C, X, Y, Z, spin = 0, o = {}) {
  const p = P(C, X, Y, Z)
  if (!p.ok) return p
  if (o.shadow !== false && Y < 30) {
    const g = P(C, X, 0, Z)
    if (g.ok) { const k = clamp(1 - Y / 12, 0.25, 1); ctx.fillStyle = `rgba(2,8,4,${(0.34 * k).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(g.x, g.y, Math.max(1, 0.07 * g.s), Math.max(0.5, 0.025 * g.s), 0, 0, 6.2832); ctx.fill() }
  }
  const real = 0.037 * p.s
  baseballAt(ctx, p.x, p.y, Math.max(o.min ?? 1.6, real * lerp(2.4, 1, clamp(real / 5, 0, 1))), spin)
  return p
}

// ── The scorebug ────────────────────────────────────────────────────────────
// The broadcast's corner graphic: the two teams and the score, the inning (a triangle up for the top), the bases,
// the count and the outs. s: { us, them, mine, opp, half 'T' | 'B', inning, on [1st, 2nd, 3rd], balls, strikes, outs,
// usCol, themCol, usHome }
export function scorebug(ctx, view, s, y = 50) {
  if (!s) return
  const x0 = 8, h = 34, w = 186
  ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, x0, y, w, h, 4); ctx.fill()
  // the teams: the road team on top, as on a real bug
  const rows = s.usHome ? [[s.them, s.opp, s.themCol], [s.us, s.mine, s.usCol]] : [[s.us, s.mine, s.usCol], [s.them, s.opp, s.themCol]]
  rows.forEach(([name, runs, col], i) => {
    const ry = y + 3 + i * 14.5
    ctx.fillStyle = col ?? '#39424c'; ctx.fillRect(x0 + 3, ry, 4, 13)
    text(ctx, String(name ?? '').slice(0, 4), x0 + 11, ry + 7, { font: LABEL, size: 13, align: 'left', track: 0.6 })
    text(ctx, String(runs ?? 0), x0 + 66, ry + 7, { font: DISPLAY, size: 13, align: 'right' })
  })
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x0 + 72, y + 4, 1, h - 8)
  // the inning
  const ix = x0 + 86, iy = y + h / 2
  ctx.fillStyle = GOLD; ctx.beginPath()
  if (s.half === 'B') { ctx.moveTo(ix - 4, iy + 1); ctx.lineTo(ix + 4, iy + 1); ctx.lineTo(ix, iy + 6) } else { ctx.moveTo(ix - 4, iy - 1); ctx.lineTo(ix + 4, iy - 1); ctx.lineTo(ix, iy - 6) }
  ctx.fill()
  text(ctx, String(s.inning ?? 9), ix + 11, iy + 0.5, { font: DISPLAY, size: 14, align: 'center' })
  // the bases: a diamond of three, lit where there's a man
  const bx = x0 + 126, by = y + h / 2 + 1
  for (const [i, dx, dy] of [[1, 0, -7], [0, 7, 0], [2, -7, 0]]) {
    ctx.save(); ctx.translate(bx + dx, by + dy); ctx.rotate(Math.PI / 4)
    ctx.fillStyle = s.on?.[i] ? GOLD : 'rgba(255,255,255,.14)'; ctx.fillRect(-4, -4, 8, 8)
    ctx.restore()
  }
  // the count and the outs
  text(ctx, `${s.balls ?? 0}-${s.strikes ?? 0}`, x0 + 160, y + 11, { font: DISPLAY, size: 13 })
  for (let i = 0; i < 2; i++) { ctx.fillStyle = i < (s.outs ?? 0) ? '#f2f2ee' : 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.arc(x0 + 155 + i * 10, y + 25, 3, 0, 6.2832); ctx.fill() }
}
// The pitch tracker: the zone and its nine boxes, from the catcher's side, the pitches so far as numbered dots in their
// colours. o: { x, y, w (the box), pitches [{ to, type, n }], aim {x, y}, heat { hot, cold, hand } (the hitter's zones),
// live: the one in flight }
export function tracker(ctx, o) {
  const { x, y, w } = o, h = w * 1.18
  ctx.fillStyle = 'rgba(6,9,13,.78)'; rr(ctx, x, y, w, h, 4); ctx.fill()
  // the plate's world (x -0.55..0.55, y 0.2..1.36) to the box
  const X = mx => x + w / 2 + (mx / 0.55) * (w / 2) * 0.92, Y = my => y + h - 6 - ((my - 0.2) / 1.16) * (h - 12)
  const zx0 = X(ZONE.x0), zx1 = X(ZONE.x1), zy0 = Y(ZONE.y1), zy1 = Y(ZONE.y0)
  if (o.heat) {
    // his zones: hot in red, cold in blue
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const cx = lerp(ZONE.x0, ZONE.x1, (j + 0.5) / 3), cy = lerp(ZONE.y1, ZONE.y0, (i + 0.5) / 3), z = zoneOf(cx, cy, o.heat.hand)
      const hot = z.startsWith(o.heat.hot.split('-')[0]) && z.endsWith(o.heat.hot.split('-')[1]), cold = z.startsWith(o.heat.cold.split('-')[0]) && z.endsWith(o.heat.cold.split('-')[1])
      if (!hot && !cold) continue
      ctx.fillStyle = hot ? 'rgba(200,16,46,.5)' : 'rgba(60,120,210,.42)'
      ctx.fillRect(lerp(zx0, zx1, j / 3), lerp(zy0, zy1, i / 3), (zx1 - zx0) / 3, (zy1 - zy0) / 3)
    }
  }
  ctx.strokeStyle = 'rgba(242,242,238,.8)'; ctx.lineWidth = 1.3; ctx.strokeRect(zx0, zy0, zx1 - zx0, zy1 - zy0)
  ctx.strokeStyle = 'rgba(242,242,238,.28)'; ctx.lineWidth = 0.8; ctx.beginPath()
  for (let k = 1; k < 3; k++) { const gx = lerp(zx0, zx1, k / 3), gy = lerp(zy0, zy1, k / 3); ctx.moveTo(gx, zy0); ctx.lineTo(gx, zy1); ctx.moveTo(zx0, gy); ctx.lineTo(zx1, gy) }
  ctx.stroke()
  // the batter's side: a small stripe where he stands
  if (o.heat?.hand || o.hand) { const hd = o.heat?.hand ?? o.hand; ctx.fillStyle = 'rgba(242,242,238,.22)'; ctx.fillRect(hd > 0 ? x + 3 : x + w - 6, y + 10, 3, h - 20) }
  for (const p of o.pitches ?? []) {
    const px = X(p.to.x), py = Y(p.to.y)
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, 5.4, 0, 6.2832); ctx.fill()
    ctx.fillStyle = PITCH_INFO[p.type]?.col ?? '#f2f2ee'; ctx.beginPath(); ctx.arc(px, py, 4.4, 0, 6.2832); ctx.fill()
    text(ctx, String(p.n), px, py + 0.5, { font: LABEL, size: 7.5, color: '#0b0c0e' })
  }
  if (o.aim) {
    const ax = X(o.aim.x), ay = Y(o.aim.y), r = Math.max(4, (o.aimR ?? 0.05) / 0.55 * w / 2)
    ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(ax, ay, r, 0, 6.2832); ctx.stroke()
    ctx.strokeStyle = o.aimCol ?? '#f2f2ee'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ax, ay, r, 0, 6.2832)
    ctx.moveTo(ax - r * 1.7, ay); ctx.lineTo(ax - r * 0.5, ay); ctx.moveTo(ax + r * 0.5, ay); ctx.lineTo(ax + r * 1.7, ay); ctx.moveTo(ax, ay - r * 1.7); ctx.lineTo(ax, ay - r * 0.5); ctx.moveTo(ax, ay + r * 0.5); ctx.lineTo(ax, ay + r * 1.7); ctx.stroke()
  }
  return { X, Y, h }
}
// a radar gun's reading: the mph big, on its own dark slab (a stadium's velocity board, a scout's gun)
export function radar(ctx, x, y, mph, o = {}) {
  const w = o.w ?? 74, h = o.h ?? 30
  ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, x - w / 2, y - h / 2, w, h, 4); ctx.fill()
  text(ctx, o.label ?? 'MPH', x + w / 2 - 6, y + 6, { font: LABEL, size: 10, align: 'right', color: 'rgba(242,242,238,.6)', track: 0.8 })
  text(ctx, mph == null ? '--' : String(Math.round(mph)), x - 6, y + 1, { font: DISPLAY, size: o.size ?? 22, color: o.col ?? '#f2f2ee' })
}
// The ballpark's scoreboard, live: the score, the inning, the count and the outs on the board up behind right-centre.
// (the frame is in the baked park: this paints its face, a few words a frame)
export function scoreboard(ctx, C, s, words = null) {
  const a = P(C, 22, 31, 150), b = P(C, 52, 31, 140), c = P(C, 52, 17, 140), d = P(C, 22, 17, 150)
  if (!a.ok || !b.ok || !c.ok || !d.ok) return
  const L = Math.min(a.x, d.x), R = Math.max(b.x, c.x), T = Math.min(a.y, b.y), B = Math.max(c.y, d.y)
  if (R - L < 14 || R < 0 || L > 360) return
  const w = R - L, h = B - T
  ctx.fillStyle = '#0a1016'; ctx.fillRect(L + w * 0.03, T + h * 0.05, w * 0.94, h * 0.9)
  if (!s) { text(ctx, words ?? 'BUILD-A-PLAYER', L + w / 2, T + h / 2, { font: DISPLAY, size: Math.max(4, h * 0.22), color: '#f4f6f2' }); return }
  const size = Math.max(3.5, h * 0.2)
  text(ctx, `${String(s.them).slice(0, 3)} ${s.opp}`, L + w * 0.28, T + h * 0.3, { font: DISPLAY, size, color: '#f4f6f2' })
  text(ctx, `${String(s.us).slice(0, 3)} ${s.mine}`, L + w * 0.28, T + h * 0.62, { font: DISPLAY, size, color: '#f4f6f2' })
  text(ctx, `${s.half === 'B' ? 'BOT' : 'TOP'} ${s.inning}`, L + w * 0.74, T + h * 0.3, { font: LABEL, size: size * 0.9, color: GOLD })
  text(ctx, `B${s.balls ?? 0} S${s.strikes ?? 0} O${s.outs ?? 0}`, L + w * 0.74, T + h * 0.62, { font: LABEL, size: size * 0.8, color: '#f4f6f2' })
  ctx.fillStyle = RED; ctx.fillRect(L + w * 0.03, B - h * 0.12, w * 0.94, Math.max(1, h * 0.05))
}
// the home crowd on its feet: the same rows, up, arms in the air, over the stands, rising and settling back
export function crowdRise(ctx, C, team, age, ms = 2600) {
  if (lightMode() || C.empty || !(age >= 0) || age >= ms) return
  const rise = age < 220 ? age / 220 : age > ms - 600 ? (ms - age) / 600 : 1
  const bob = Math.abs(Math.sin(age / 190)) * 0.3
  ctx.globalAlpha = rise
  const pic = crowdPic(team, 26, 31, 1024, 'up')
  standRun(ctx, C, pic, BOWL, 24, 1.3 + bob, 13 + bob, -1, 3)
  const runL = [], runR = []
  for (let i = 0; i < FENCE.length; i++) { const phi = -45 + i * 2.5; const p = FENCE[i], r = Math.hypot(p.x, p.z), k = (r + 1.5) / r; const q = { x: p.x * k, z: p.z * k }; if (phi <= -10) runL.push(q); if (phi >= 7.5) runR.push(q) }
  const up = crowdPic(team, 20, 23, 1024, 'up')
  standRun(ctx, C, up, runL, 22, WALL_H + 0.4 + bob, 15 + bob, 1, 3)
  standRun(ctx, C, up, runR, 22, WALL_H + 0.4 + bob, 15 + bob, 1, 3)
  ctx.globalAlpha = 1
}
// camera flashes in the stands after a big one: a few white dots, twinkling. Nothing under the light look
export function flashesB(ctx, C, age, seed = 7) {
  if (lightMode() || C.empty || age < 0 || age > 2200) return
  let s = seed
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 46; i++) {
    const k = Math.floor(R() * BOWL.length), p = BOWL[k], back = R() * 22, Y = 2 + back * 0.5, on = R() * 2200
    if (Math.abs(age - on) > 60) continue
    const nx = p.x * (1 + back / 60), nz = p.z + (p.z < 10 ? -back : back * 0.3)
    const q = P(C, nx, Y, nz)
    if (q.ok && q.x > 0 && q.x < 360) ctx.fillRect(q.x - 1, q.y - 1, 2, 2)
  }
}

// ── The moments after ───────────────────────────────────────────────────────
// A home run: the bat flip (end over end), the trot, the mob at the plate, the helmet thrown in the air; a walk-off
// has the Gatorade bath. A strikeout: the pitcher's fist pump and his yell, a hop off the mound, the catcher's glove
// slap. The beaten side never celebrates: the pitcher who gave it up stands with his hands on his hips, or watches it
// go and then drops his head; the hitter who struck out walks back to the dugout, head down. About 3 s, skippable,
// short under Reduce Motion and on a weak machine.
export const CELEB_B = 3000
export const celebMsB = () => (lightMode() ? 1200 : CELEB_B)
export function skipOutroB(g, a) {
  if (!g.done || g.doneAt == null) return false
  if (a.kind !== 'down' && a.kind !== 'key') return false
  if (g.t - g.doneAt < 250) return false
  g.outro = Math.min(g.outro ?? 2400, g.t - g.doneAt + 90)
  return true
}
// the bat after a flip: from the hands at (x, y) on the screen, end over end up and away and down. age ms
export function batFlip(ctx, x0, y0, age, s, dir = 1, col = '#d9b98a') {
  if (age < 0 || age > 1100) return
  const t = age / 1000, x = x0 + dir * 70 * t * s / 40, y = y0 - (210 * t - 260 * t * t) * s / 40, a = -1.6 + dir * t * 13
  const L = 0.86 * s, ux = Math.cos(a), uy = Math.sin(a)
  ctx.lineCap = 'round'
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, 0.07 * s); ctx.beginPath(); ctx.moveTo(x - ux * L / 2, y - uy * L / 2); ctx.lineTo(x + ux * L / 2, y + uy * L / 2); ctx.stroke()
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 0.045 * s); ctx.beginPath(); ctx.moveTo(x - ux * L / 2, y - uy * L / 2); ctx.lineTo(x + ux * L / 2, y + uy * L / 2); ctx.stroke()
}
// The Gatorade bath: the cooler tipped over him from behind, the orange pouring down in a sheet and splashing off.
// x, y: the top of his head on the screen; s: px a metre there. age ms since the pour started
export function gatorade(ctx, x, y, s, age, col = '#f08a24') {
  if (age < 0 || age > 1300) return
  const pour = clamp(age / 260, 0, 1), fall = clamp((age - 120) / 900, 0, 1)
  ctx.globalAlpha = 0.85 * (1 - clamp((age - 900) / 400, 0, 1))
  ctx.fillStyle = col
  // the sheet coming down over him
  const top = y - lerp(0.9, 0.2, pour) * s, w = 0.55 * s
  ctx.beginPath(); ctx.moveTo(x - w * 0.4, top); ctx.lineTo(x + w * 0.4, top); ctx.lineTo(x + w * 0.7, y + fall * 1.6 * s); ctx.lineTo(x - w * 0.7, y + fall * 1.6 * s); ctx.closePath(); ctx.fill()
  // the splash, and ice
  let sd = 3
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 2.6, v = (0.6 + R()) * s * 1.4, t = clamp((age - 200 - R() * 300) / 1000, 0, 1)
    if (t <= 0) continue
    const px = x + Math.cos(a) * v * t, py = y + 1.2 * s + Math.sin(a) * v * t + 3 * s * t * t
    ctx.fillStyle = R() < 0.25 ? '#e8f4ff' : col
    ctx.fillRect(px - 1, py - 1, Math.max(1.5, 0.05 * s), Math.max(1.5, 0.05 * s))
  }
  ctx.globalAlpha = 1
}
// the cooler: an orange tub held over a head (x, y on the screen, s px a metre, tip 0-1)
export function cooler(ctx, x, y, s, tip = 0, col = '#f08a24') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-tip * 1.9)
  ctx.fillStyle = INK; ctx.fillRect(-0.22 * s - 1, -0.3 * s - 1, 0.44 * s + 2, 0.42 * s + 2)
  ctx.fillStyle = col; ctx.fillRect(-0.22 * s, -0.3 * s, 0.44 * s, 0.42 * s)
  ctx.fillStyle = '#f4f6f2'; ctx.fillRect(-0.24 * s, -0.33 * s, 0.48 * s, 0.07 * s)
  ctx.restore()
}
// scouts behind the plate with their radar guns up (the showcase): a row of men in polos and caps, a gun each
export function radarScout(ctx, C, X, Z, look, t = 0, up = true) {
  const pose = up ? { ...BP.stand, hy: 30, lx: -10, ly: 0, rx: 10, lk: 0.9, rk: 0.9, hlx: -3, hly: -84, hrx: 4, hry: -86, elbow: 0.6, fore: 0.6, tilt: 0.1 } : { ...BP.stand, hy: 30, lx: -10, rx: 10, lk: 0.9, rk: 0.9, hlx: -9, hly: -50, hrx: 9, hry: -50 }
  const p = baller(ctx, C, X, Z, pose, { ...look, front: true, noBat: true }, { shadow: false })
  if (p.ok && up) {
    const k = p.s * RIG_M
    ctx.fillStyle = INK; ctx.fillRect(p.x - 4 * k, p.y - 92 * k, 8 * k, 7 * k)
    ctx.fillStyle = '#2a3036'; ctx.fillRect(p.x - 3.4 * k, p.y - 91.4 * k, 6.8 * k, 5.8 * k)
    ctx.fillStyle = '#c84a3a'; ctx.fillRect(p.x - 1.2 * k, p.y - 89.6 * k, 2.4 * k, 2 * k)
  }
  return p
}

// The prompt on a computer: the keys' strip runs along the bottom where the host puts the prompt, so the game keeps
// its prompt (g.hud made by hudB) and draws it a line higher there; on a phone the host draws it as ever.
export const hudB = prompt => ({ _p: prompt, keysView: false, get prompt() { return this.keysView ? null : this._p }, set prompt(v) { this._p = v } })
export function promptB(ctx, view, g) {
  g.hud.keysView = !!view.keys
  const p = view.keys ? g.hud._p : null
  if (!p) return
  const y = view.h - 62
  ctx.font = `18px ${LABEL}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px'
  const tw = ctx.measureText(p).width + 24
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  ctx.fillStyle = 'rgba(6,10,12,.72)'; rr(ctx, view.w / 2 - tw / 2, y - 15, tw, 30, 4); ctx.fill()
  text(ctx, p, view.w / 2, y + 1, { size: 18, track: 1.5 })
}
// ── Controls: soccer's thumbstick and two buttons, the arrows, SPACE and E on a computer ─────
// (lib/mg/soccer.js has them: re-exported here so the baseball games read from one place)
export { padCtl, padInput, padStick, drawPads, padLayout } from './soccer.js'
// the in-scene line over the pads: what to do right now (the host draws hud.prompt)
export const keyCapB = keyCap
export { GOOD, BAD, GOLD, reduceMotion, prog }
