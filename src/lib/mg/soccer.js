// The soccer games' picture and the parts they share (penalty.js, oneonone.js, header.js, volley.js, sprint30.js,
// slalom.js, finishing.js, and any new soccer game): a real stadium pitch at night, through a camera that works in
// metres. Rules never come in here, except the shooting model, which every soccer game shares.
//
// ── EXPORTS FOR SOCCER GAMES (stable: add, don't rename) ────────────────────────────────────────────────────────────
//  pitch    camOf(view, { x, y, z, F, hzAt, yaw })  the camera (yaw: radians turned toward +X, the right)
//           P(C, X, Y, Z)                          a point in metres → { x, y, s (px a metre there), d, ok }
//           stadium(ctx, view, C, o) / staticStadium(ctx, view, C, key, o)
//                                                   o: { team: [c1, c2], away: [c1, c2], board, goal, empty }
//                                                   empty: true is the academy's empty ground (no crowd, half the lights)
//           net(ctx, C, ripple, t) · goalFrame(ctx, C, back) · line(ctx, C, x0, z0, x1, z1, w) · ball(ctx, C, X, Y, Z, spin)
//           crowdUp(ctx, C, team, age) (the home end on its feet) · flashes(ctx, C, view, age) · boardWords(g)
//           POST BAR NET_D NET_TOP SPOT BOX SIX BOX_W SIX_W ARC_R HALF_W
//  men      man(ctx, C, X, Z, pose, look, { lift, name, size, turn, shadow })   one player, feet on the grass
//           dress(kit, who, extra) → look · kitsOf(view) → { us, them, gk, gkUs, ref, train, bib, staff }
//           look extras: front (facing the camera), sleeves (a keeper's), gloves, hair ('crop' 'fade' 'curly' 'long'
//           'bun' 'buzz'), hairColor, boot, clipboard
//           POSE (named poses) · mix(a, b, f) · runPose(phase, k, { lean, arms }) · kickPose(f, foot) · dribblePose
//           scout(ctx, C, X, Z, look, t) (a coach or scout with a clipboard)
//  moments  celebration(seed, o) → plan · scorerAt(plan, age) · mateAt(plan, i, age) · keeperBeaten(plan, age, at)
//           defenderBeaten(i, age) · keeperRoar(age) · strikerDenied(kind, age) · CELEB_MS · celebMs() · skipOutro(g)
//  shooting shooter(v, o) → the shot in progress (power bar, aim, the timed finish) · strikeOf(k, from, o) → a shot
//           shotAt(shot, t) → the ball in flight · keeperSave(shot, keeper, o) · shotHud(ctx, view, k, o)
//           aimMark(ctx, C, x, y, o) · aimTo(sx, sy) · SHOT_TYPES
//  controls padCtl() · padInput(c, a, vh, { down, up }) · padStick(c) · drawPads(ctx, view, c, labels, live) · padLayout(h)
//
// Real sizes: the goal 7.32 by 2.44, the box 16.5 deep and 40.32 wide, the six-yard box 5.5 by 18.32, the spot at 11,
// the arc 9.15 from it. A man is 1.8 m. The mower's stripes are 5.5 m, so the six, the spot and the box all sit on one.
import { clamp, lerp, prog, text, layer, warmSkin, lightMode, DISPLAY, LABEL, rr, keyCap as keyCapS } from './kit.js'
import { inkOn, nameTag } from './art.js'
import { tone, INK } from './rig.js'

export const POST = 3.66, BAR = 2.44, NET_D = 2.1, NET_TOP = 2.15
export const SPOT = -11, BOX = -16.5, SIX = -5.5, BOX_W = 20.16, SIX_W = 9.16, ARC_R = 9.15, HALF_W = 34
const RIG_M = 1.8 / 110            // a rig unit (a man is about 110 of them) in metres

// ── The camera ──────────────────────────────────────────────────────────────
// The scene's room: under the title bar (44) and over the pads (96). hzAt puts the horizon in it. yaw turns the lens
// toward +X (the right of the picture) about its own spot.
export function camOf(view, { x = 0, y = 2.6, z = -20, F = 600, hzAt = 0.3, yaw = 0 } = {}) {
  const top = 44, room = view.h - 140
  return { x, y, z, F: F * view.w / 360, vx: view.w / 2, hz: Math.round(top + room * hzAt), near: 0.4, yaw, cy: Math.cos(yaw), sn: Math.sin(yaw) }
}
// a point in the camera's own frame: across (r) and depth (d)
const camX = (C, X, Z) => (C.yaw ? (X - C.x) * C.cy - (Z - C.z) * C.sn : X - C.x)
const camD = (C, X, Z) => (C.yaw ? (X - C.x) * C.sn + (Z - C.z) * C.cy : Z - C.z)
export function P(C, X, Y, Z) {
  const d = camD(C, X, Z)
  if (d < C.near) return { x: 0, y: 0, s: 0, d, ok: false }
  const s = C.F / d
  return { x: C.vx + camX(C, X, Z) * s, y: C.hz + (C.y - Y) * s, s, d, ok: true }
}
const sy = (C, Y, d) => C.hz + (C.y - Y) * C.F / d
// a flat shape on the grass (or at height Y), clipped where it comes past the lens. pts: [X, Z, X, Z...]
function flat(ctx, C, pts, Y = 0) {
  const n = pts.length / 2, out = []
  for (let i = 0; i < n; i++) {
    const ax0 = pts[i * 2], az0 = pts[i * 2 + 1], j = (i + 1) % n, bx0 = pts[j * 2], bz0 = pts[j * 2 + 1]
    const ax = camX(C, ax0, az0), ad = camD(C, ax0, az0), bx = camX(C, bx0, bz0), bd = camD(C, bx0, bz0)
    const ain = ad >= C.near, bin = bd >= C.near
    if (ain) out.push(ax, ad)
    if (ain !== bin) { const f = (C.near - ad) / (bd - ad); out.push(ax + (bx - ax) * f, C.near) }
  }
  if (out.length < 6) return
  for (let i = 0; i < out.length; i += 2) {
    const px = C.vx + out[i] * C.F / out[i + 1], py = sy(C, Y, out[i + 1])
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath()
}
// a painted line on the grass, w metres wide
export function line(ctx, C, x0, z0, x1, z1, w = 0.12) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = (-dz / L) * w / 2, nz = (dx / L) * w / 2
  flat(ctx, C, [x0 + nx, z0 + nz, x1 + nx, z1 + nz, x1 - nx, z1 - nz, x0 - nx, z0 - nz])
}
function arcLine(ctx, C, cx, cz, r, a0, a1, w = 0.12, n = 20) {
  for (let i = 0; i < n; i++) {
    const a = lerp(a0, a1, i / n), b = lerp(a0, a1, (i + 1) / n)
    const ri = r - w / 2, ro = r + w / 2
    flat(ctx, C, [cx + Math.sin(a) * ri, cz + Math.cos(a) * ri, cx + Math.sin(b) * ri, cz + Math.cos(b) * ri, cx + Math.sin(b) * ro, cz + Math.cos(b) * ro, cx + Math.sin(a) * ro, cz + Math.cos(a) * ro])
  }
}
// a flat board standing on the grass at Z, across x0..x1 (each end at its own depth when the lens is turned)
function board(ctx, C, x0, x1, y0, y1, Z) {
  const pa = P(C, x0, y0, Z), pb = P(C, x1, y0, Z)
  if (!pa.ok && !pb.ok) return null
  const d = Math.max(C.near, camD(C, (x0 + x1) / 2, Z))
  const a = pa.ok ? pa.x : -9999, b = pb.ok ? pb.x : 9999
  return { a, b, t: sy(C, y1, d), u: sy(C, y0, d), s: C.F / d }
}

// ── Colours ─────────────────────────────────────────────────────────────────
const rgb = h => { const n = parseInt(String(h ?? '').replace('#', '').slice(0, 6), 16); return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128] }
const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) }
const lum = h => { const [r, g, b] = rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255 }
// a keeper's kit: whichever of the usual ones is furthest from both teams
const GK = ['#c6ec3a', '#f08a24', '#2bd4c5', '#e84fa1', '#f2d33a', '#7a4fd6', '#1c1f24']
export function keeperKit(a, b, skip = null) {
  let best = GK[0], far = -1
  for (const k of GK) { if (k === skip) continue; const d = Math.min(dist(k, a), dist(k, b)); if (d > far) { far = d; best = k } }
  return best
}
// The two sides' kits, from the stage's colours: the shirt in the club's colour, its second colour on the shorts
// and the trim, the socks in the shirt colour. Each side's keeper in his own colour. The referee in black (yellow
// when a side's in black)
export function kitsOf(view) {
  const c = view.colors ?? {}
  const us = c.us ?? '#1f4fa8', trim = c.trim ?? '#f4efe6', them = c.them ?? '#c9423a', themTrim = c.themTrim ?? '#f4efe6'
  const kit = (shirt, second) => ({ shirt, trim: second, shorts: lum(second) > 0.8 || lum(second) < 0.18 ? second : shirt, socks: shirt, num: inkOn(shirt, second) })
  const gkThem = keeperKit(us, them), gkUs = keeperKit(us, them, gkThem)
  const ref = Math.min(dist(us, '#16191d'), dist(them, '#16191d')) < 90 ? '#f2d33a' : '#16191d'
  return {
    us: kit(us, trim), them: kit(them, themTrim),
    gk: { shirt: gkThem, trim: tone(gkThem, 0.62), shorts: tone(gkThem, 0.55), socks: gkThem, num: inkOn(gkThem, '#10151a'), gloves: '#eef0ea', gloveTrim: tone(gkThem, 0.7) },
    gkUs: { shirt: gkUs, trim: tone(gkUs, 0.62), shorts: tone(gkUs, 0.55), socks: gkUs, num: inkOn(gkUs, '#10151a'), gloves: '#f2f4f2' },
    ref: { shirt: ref, trim: ref === '#16191d' ? '#f2f4f2' : '#16191d', shorts: '#16191d', socks: '#16191d', num: '#f2f4f2' },
    train: { shirt: '#e8edf2', trim: '#20262c', shorts: '#20262c', socks: '#e8edf2', num: '#20262c' },
    bib: { shirt: '#f08a24', trim: '#f08a24', shorts: '#20262c', socks: '#20262c', num: '#20262c' },
    staff: { shirt: '#20262c', trim: '#2a3540', shorts: '#2a3540', socks: '#20262c', num: '#f2f4f2' },
  }
}

// ── The bowl ────────────────────────────────────────────────────────────────
// The crowd is painted once into a picture (rows of people, the home colours, aisles, a tunnel, the away end in its
// own block in the corner with empty seats either side of it) and laid into the stand a band at a time, each band at
// its own depth: the far rows smaller, as they are. mode: 'sit' (the crowd), 'up' (the home end on its feet: arms and
// scarves up, laid over the sitting picture; the away end stays down), 'empty' (the academy's ground: seats, nobody)
const crowds = new Map()
const AWAY0 = 0.71, AWAY1 = 0.9    // the away end's block, across the picture
function crowdPic(team, rows, seed, wide = 1024, mode = 'sit', away = null) {
  const id = `${team.join()}|${(away ?? []).join()}|${rows}|${seed}|${wide}|${mode}`
  let c = crowds.get(id)
  if (c || typeof document === 'undefined') return c
  if (crowds.size > 10) crowds.clear()
  const RH = 12, H = rows * RH, up = mode === 'up', empty = mode === 'empty'
  c = document.createElement('canvas'); c.width = wide; c.height = H
  const x = c.getContext('2d')
  let s = seed
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647
  if (!up) { x.fillStyle = empty ? '#0b1015' : '#0d1318'; x.fillRect(0, 0, wide, H) }
  const pal = ['#1b222b', '#262e38', '#313a45', '#3f4954', '#55606b', '#6d6459', '#8a8f96', '#b9bcc0', '#e8edf2']
  const heads = ['#5e3c22', '#8d5a3b', '#c09060', '#f0c4a0', '#3a2a1e', '#a87548']
  const aw = away ?? ['#c9c9c4', '#3a3f45']
  for (let r = 0; r < rows; r++) {
    const y = r * RH
    if (!up) { x.fillStyle = r % 2 ? '#10171d' : '#121a21'; x.fillRect(0, y + RH - 3, wide, 3) }   // the seat rows
    for (let px = (r % 2) * 3; px < wide; px += 6.4) {
      if ((px % 160) < 9) continue   // an aisle
      const f = px / wide, awayEnd = f > AWAY0 && f < AWAY1, gap = (f > AWAY0 - 0.025 && f <= AWAY0) || (f >= AWAY1 && f < AWAY1 + 0.025)
      if (empty || gap) {
        // an empty seat: its back, in the stand's dull plastic
        if (up) continue
        x.fillStyle = (Math.floor(px / 6.4) + r) % 7 === 0 ? '#2a323b' : '#1c242c'; x.fillRect(px + 0.4, y + 4.5, 3.8, 4.5)
        continue
      }
      if (R() < 0.07) continue   // an empty seat
      const home = !awayEnd && R() < 0.84
      const shirt = awayEnd ? aw[R() < 0.7 ? 0 : 1] : home ? team[R() < 0.78 ? 0 : 1] : pal[Math.floor(R() * pal.length)], head = heads[Math.floor(R() * heads.length)]
      if (up) {
        // on their feet: up a head, arms in the air, scarves held up over their heads. The away end stays sat down
        if (awayEnd || !home || R() < 0.2) continue
        x.fillStyle = shirt; x.fillRect(px, y + 0.5, 4.6, 6)
        x.fillStyle = head; x.fillRect(px + 1, y - 2.6, 2.8, 3)
        const arms = R()
        x.fillStyle = shirt
        if (arms < 0.22) {
          // a scarf, held out tight between the hands, over the head: the club's two colours in bars
          x.fillRect(px - 1, y - 5.5, 1.3, 5.5); x.fillRect(px + 4.3, y - 5.5, 1.3, 5.5)
          for (let k = 0; k < 4; k++) { x.fillStyle = team[k % 2]; x.fillRect(px - 1.6 + k * 2.1, y - 7.2, 2.1, 1.9) }
        } else if (arms < 0.72) { x.fillRect(px - 0.6, y - 5, 1.4, 5.5); x.fillRect(px + 3.8, y - 5, 1.4, 5.5) }
        else if (arms < 0.88) x.fillRect(px + 3.8, y - 5.4, 1.4, 6)
        continue
      }
      x.fillStyle = shirt
      x.fillRect(px, y + 3.5, 4.6, 6)
      x.fillStyle = head
      x.fillRect(px + 1, y + 0.6, 2.8, 3)
      // a scarf round a neck, here and there
      if (home && R() < 0.06) { x.fillStyle = team[1]; x.fillRect(px - 0.2, y + 3.4, 5, 1.4) }
    }
    // the aisle steps
    if (!up) for (let px = 0; px < wide; px += 160) { x.fillStyle = '#2a333c'; x.fillRect(px + 1, y, 6, RH) }
  }
  if (!up) {
    // the away end's railings, and a tunnel out of the lower rows
    x.fillStyle = '#3a434c'
    if (!empty) for (const f of [AWAY0 - 0.025, AWAY1 + 0.024]) x.fillRect(f * wide, 0, 2, H)
    x.fillStyle = '#05080b'
    for (let px = 80; px < wide; px += 320) x.fillRect(px, H - RH * 3.2, 26, RH * 3.2)
  }
  crowds.set(id, c)
  return c
}
// a tier of the stand behind the goal: from its front (y0 at z0) to its back (y1 at z1), w either side of the middle
function tier(ctx, C, pic, w, y0, z0, y1, z1, n = 26) {
  if (!pic) return
  for (let i = 0; i < n; i++) {
    const f0 = i / n, f1 = (i + 1) / n
    const za = lerp(z0, z1, f0), zb = lerp(z0, z1, f1), ya = lerp(y0, y1, f0), yb = lerp(y0, y1, f1)
    const da = camD(C, 0, za), db = camD(C, 0, zb)
    if (da < C.near) continue
    const top = sy(C, yb, db), bot = sy(C, ya, da) + 0.6, zm = (za + zb) / 2
    const pa = P(C, -w, 0, zm), pb = P(C, w, 0, zm)
    if (!pa.ok || !pb.ok) continue
    const srcY = (1 - f1) * pic.height, srcH = Math.max(1, (f1 - f0) * pic.height)
    ctx.drawImage(pic, 0, srcY, pic.width, srcH, pa.x, top, pb.x - pa.x, bot - top)
  }
}
// The home end on its feet after a goal: the same rows, up, arms and scarves in the air, laid over the stand as it
// rises and falls back (the away end stays sat down). Nothing under the light look. age: ms since the goal
export function crowdUp(ctx, C, team, age, ms = 2400, away = null) {
  if (lightMode() || !(age >= 0) || age >= ms) return
  const rise = age < 220 ? age / 220 : age > ms - 600 ? (ms - age) / 600 : 1
  const bob = Math.abs(Math.sin(age / 190)) * 0.25
  ctx.globalAlpha = rise
  tier(ctx, C, crowdPic(team, 16, 31, 1024, 'up', away), 60, 14.5 + bob, STAND_BACK + 16, 30.5 + bob, STAND_BACK + 31)
  tier(ctx, C, crowdPic(team, 14, 17, 1024, 'up', away), 60, 1.1 + bob, STAND_BACK + 1.2, 12.4 + bob, STAND_BACK + 15)
  ctx.globalAlpha = 1
}
const STAND_BACK = 6
// the boards round the pitch: dark panels with the name on them, every other one in the home colour
const boardPics = new Map()
function boardPic(us) {
  let c = boardPics.get(us)
  if (c || typeof document === 'undefined') return c
  c = document.createElement('canvas'); c.width = 1200; c.height = 40
  const x = c.getContext('2d')
  for (let i = 0; i < 6; i++) {
    const home = i % 2 === 1
    x.fillStyle = home ? us : '#080c10'; x.fillRect(i * 200, 0, 200, 40)
    x.fillStyle = home ? tone(us, 0.7) : '#0f161c'; x.fillRect(i * 200, 34, 200, 6)
    text(x, 'BUILD-A-PLAYER', i * 200 + 100, 18, { font: DISPLAY, size: 21, track: 1.5, color: home ? inkOn(us, '#ffffff') : '#e8edf2' })
  }
  boardPics.set(us, c)
  return c
}
// one lamp in the haze, painted once
let glowPic = null
function glow() {
  if (glowPic || typeof document === 'undefined') return glowPic
  glowPic = document.createElement('canvas'); glowPic.width = glowPic.height = 64
  const x = glowPic.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 32)
  g.addColorStop(0, 'rgba(235,245,255,.5)'); g.addColorStop(0.25, 'rgba(210,228,255,.14)'); g.addColorStop(1, 'rgba(200,220,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 64, 64)
  return glowPic
}
// The whole stadium behind the goal, the pitch and its lines, the frame of the goal. o: { team: [c1, c2], board
// (the scoreboard's words), goal (false: a training pitch with no goal at this end), grain }
export function stadium(ctx, view, C, o = {}) {
  const { w, h } = view, team = o.team ?? ['#39424c', '#aab0b6'], empty = !!(o.empty || view.empty), mode = empty ? 'empty' : 'sit', away = o.away ?? null
  // the night
  ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, w, h)
  const back = 6
  // the roof over the far end, and the lights along its edge
  const roof = board(ctx, C, -60, 60, 31, 34, back + 30)
  if (roof) {
    ctx.fillStyle = '#0a0f14'; ctx.fillRect(0, roof.t - 40, w, roof.u - roof.t + 40)
    ctx.fillStyle = '#141c24'; ctx.fillRect(0, roof.u - 3, w, 3)
  }
  // the upper tier, the ribbon board between, the lower tier
  tier(ctx, C, crowdPic(team, 16, 31, 1024, mode, away), 60, 14.5, back + 16, 30.5, back + 31)
  const rib = board(ctx, C, -60, 60, 12.6, 14.6, back + 15.6)
  if (rib) {
    ctx.fillStyle = '#05080b'; ctx.fillRect(rib.a, rib.t - 1, rib.b - rib.a, rib.u - rib.t + 2)
    const bp = empty ? null : boardPic(team[0])
    if (bp) { const k = (rib.u - rib.t) / 40, tw = 1200 * k * 0.75; for (let x0 = rib.a - ((rib.a % tw) + tw) % tw; x0 < Math.min(w, rib.b); x0 += tw) ctx.drawImage(bp, 0, 0, 1200, 40, x0, rib.t + 1, tw, rib.u - rib.t - 2) }
  }
  tier(ctx, C, crowdPic(team, 14, 17, 1024, mode, away), 60, 1.1, back + 1.2, 12.4, back + 15)
  // the scoreboard up on the upper tier
  const sb = board(ctx, C, -5.8, 5.8, 24.5, 29.2, back + 30.6)
  if (sb && sb.b - sb.a > 20) {
    ctx.fillStyle = '#020405'; ctx.fillRect(sb.a - 2, sb.t - 2, sb.b - sb.a + 4, sb.u - sb.t + 4)
    ctx.fillStyle = '#0b1218'; ctx.fillRect(sb.a, sb.t, sb.b - sb.a, sb.u - sb.t)
    const words = o.board ?? 'BUILD-A-PLAYER', size = (sb.u - sb.t) * 0.42
    ctx.save(); ctx.beginPath(); ctx.rect(sb.a, sb.t, sb.b - sb.a, sb.u - sb.t); ctx.clip()
    text(ctx, words, (sb.a + sb.b) / 2, (sb.t + sb.u) / 2 + 1, { font: DISPLAY, size, color: '#f4f6f2', track: size * 0.06 })
    ctx.restore()
    ctx.fillStyle = team[0]; ctx.fillRect(sb.a, sb.u - Math.max(1.5, (sb.u - sb.t) * 0.08), sb.b - sb.a, Math.max(1.5, (sb.u - sb.t) * 0.08))
  }
  // the light banks
  if (roof) {
    const g = glow(), lamps = [-34, -24, -14, -4, 6, 16, 26, 36]
    for (const [li, X] of lamps.entries()) {
      // (the academy's ground: half the banks on, the rest dark)
      if (empty && li % 2) { const p = P(C, X, 32.4, back + 30); if (p.ok) { ctx.fillStyle = '#1b232b'; ctx.fillRect(p.x - 1.1 * p.s, p.y - 0.25 * p.s, 2.2 * p.s, Math.max(1.4, 0.5 * p.s)) } continue }
      const p = P(C, X, 32.4, back + 30)
      if (!p.ok || p.x < -40 || p.x > w + 40) continue
      const r = Math.max(14, 7 * p.s)
      if (g) ctx.drawImage(g, p.x - r, p.y - r, r * 2, r * 2)
      ctx.fillStyle = '#f3f8ff'; ctx.fillRect(p.x - 1.1 * p.s, p.y - 0.25 * p.s, 2.2 * p.s, Math.max(1.4, 0.5 * p.s))
    }
  }
  // the stand along the right touchline, when the lens is turned toward it (a cross from the right wing)
  if (C.yaw > 0.12) sideStand(ctx, C, crowdPic(team, 14, 23, 1024, mode, away), w)
  // the front wall of the stand, the surround, the boards
  const wall = board(ctx, C, -70, 70, 0, 1.2, back + 1.2)
  if (wall) { ctx.fillStyle = '#0b1116'; ctx.fillRect(0, wall.t, w, wall.u - wall.t + 1) }
  ctx.fillStyle = '#1a4a2c'; ctx.beginPath(); flat(ctx, C, [-70, back + 1.2, 70, back + 1.2, 70, 0, -70, 0]); ctx.fill()
  // the grass of the pitch: mown across in 5.5 m bands, out to the touchlines, the run-off past them
  ctx.fillStyle = '#1b5a32'; ctx.beginPath(); flat(ctx, C, [-70, 0, 70, 0, 70, -130, -70, -130]); ctx.fill()
  const far = o.goal === false ? -130 : 0
  for (let z = 0, i = 0; z > -110; z -= 5.5, i++) {
    ctx.fillStyle = i % 2 ? '#23733f' : '#2a8048'
    ctx.beginPath(); flat(ctx, C, [-HALF_W, z, HALF_W, z, HALF_W, z - 5.5, -HALF_W, z - 5.5]); ctx.fill()
  }
  void far
  // the mower's grain and the wear in front of goal (a baked picture only: cheap enough, but not every frame)
  if (o.grain) {
    let s = 9
    const R = () => (s = (s * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 1400; i++) {
      const X = (R() - 0.5) * 40, Z = -R() * 40, p = P(C, X, 0, Z)
      if (!p.ok || p.y > h) continue
      ctx.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.07)'
      ctx.fillRect(p.x, p.y, Math.max(1, 0.5 * p.s), Math.max(0.6, 0.05 * p.s))
    }
    for (let i = 0; i < 70; i++) {
      const X = (R() + R() - 1) * 3.2, Z = -R() * 6, p = P(C, X, 0, Z)
      if (!p.ok) continue
      ctx.fillStyle = `rgba(120,96,60,${(0.08 + R() * 0.1).toFixed(3)})`
      ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(1, 0.35 * p.s), Math.max(0.5, 0.06 * p.s), 0, 0, 6.2832); ctx.fill()
    }
  }
  // the lines
  ctx.fillStyle = 'rgba(244,247,242,.9)'; ctx.beginPath()
  if (o.goal !== false) {
    line(ctx, C, -HALF_W, 0, HALF_W, 0)                                   // the goal line
    line(ctx, C, -BOX_W, 0, -BOX_W, BOX); line(ctx, C, BOX_W, 0, BOX_W, BOX); line(ctx, C, -BOX_W, BOX, BOX_W, BOX)
    line(ctx, C, -SIX_W, 0, -SIX_W, SIX); line(ctx, C, SIX_W, 0, SIX_W, SIX); line(ctx, C, -SIX_W, SIX, SIX_W, SIX)
    // the D: the part of the circle round the spot that's outside the box
    const a = Math.acos(5.5 / ARC_R)
    arcLine(ctx, C, 0, SPOT, ARC_R, Math.PI - a, Math.PI + a, 0.12, 22)
    // the spot
    flat(ctx, C, [-0.12, SPOT - 0.12, 0.12, SPOT - 0.12, 0.12, SPOT + 0.12, -0.12, SPOT + 0.12])
    // the corner arcs
    arcLine(ctx, C, -HALF_W, 0, 1, Math.PI / 2, Math.PI, 0.12, 6); arcLine(ctx, C, HALF_W, 0, 1, -Math.PI, -Math.PI / 2, 0.12, 6)
  }
  line(ctx, C, -HALF_W, 0, -HALF_W, -105); line(ctx, C, HALF_W, 0, HALF_W, -105)                 // the touchlines
  line(ctx, C, -HALF_W, -52.5, HALF_W, -52.5)                                                       // halfway
  arcLine(ctx, C, 0, -52.5, ARC_R, 0, Math.PI * 2, 0.12, 40)
  ctx.fill()
  // the boards behind the goal line, in two runs either side of the goal
  const bp = boardPic(empty ? '#20262c' : team[0])
  for (const [x0, x1] of [[-32, -5.2], [5.2, 32]]) {
    const r = board(ctx, C, x0, x1, 0, 0.95, 3.6)
    if (!r || !bp) continue
    ctx.fillStyle = '#05080b'; ctx.fillRect(r.a - 1, r.t - 1, r.b - r.a + 2, r.u - r.t + 2)
    const k = (r.u - r.t) / 40, tw = 1200 * k
    ctx.save(); ctx.beginPath(); ctx.rect(r.a, r.t, r.b - r.a, r.u - r.t); ctx.clip()
    for (let x0b = r.a - (x0 + 40) * r.s * 0.35; x0b < r.b; x0b += tw) ctx.drawImage(bp, x0b, r.t, tw, r.u - r.t)
    ctx.restore()
  }
  // the photographers along the byline, crouched by the boards (none at a trial)
  for (const X of empty ? [] : [-17, -14.6, -11.8, 10.5, 13.2, 16.4]) {
    const p = P(C, X, 0, 2.2)
    if (!p.ok || p.x < -10 || p.x > w + 10) continue
    const k = p.s
    ctx.fillStyle = '#10151a'; ctx.fillRect(p.x - 0.28 * k, p.y - 0.95 * k, 0.56 * k, 0.95 * k)
    ctx.fillStyle = '#2b2620'; ctx.fillRect(p.x - 0.16 * k, p.y - 1.25 * k, 0.32 * k, 0.32 * k)
    ctx.fillStyle = '#05080b'; ctx.fillRect(p.x - 0.42 * k, p.y - 1.0 * k, 0.32 * k, 0.2 * k)
  }
  // the corner flags
  for (const sd of [-1, 1]) {
    const a = P(C, sd * HALF_W, 0, 0), b = P(C, sd * HALF_W, 1.5, 0)
    if (!a.ok || a.x < -10 || a.x > w + 10) continue
    ctx.strokeStyle = '#f2d33a'; ctx.lineWidth = Math.max(1, 0.05 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    ctx.fillStyle = team[0]; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - sd * 0.45 * b.s, b.y + 0.15 * b.s); ctx.lineTo(b.x, b.y + 0.32 * b.s); ctx.fill()
  }
  if (o.goal !== false) goalFrame(ctx, C, true)
  // the lights land on the grass: the far end a touch darker into the shade of the stand
  const hz = C.hz
  const fall = ctx.createLinearGradient(0, hz, 0, hz + (h - hz) * 0.45)
  fall.addColorStop(0, 'rgba(4,10,6,.28)'); fall.addColorStop(1, 'rgba(4,10,6,0)')
  ctx.fillStyle = fall; ctx.fillRect(0, hz - 2, w, (h - hz) * 0.45)
  // half the lights: the whole ground a shade dimmer, the far end most
  if (empty) { ctx.fillStyle = 'rgba(2,6,10,.2)'; ctx.fillRect(0, 0, w, h) }
}
// The stand down the right touchline: the same rows of people, laid a slice at a time along the pitch, each slice
// from the front wall (x 37, 1 m up) back and up to the top row (x 52, 13 m up). Only the slices the lens can see
function sideStand(ctx, C, pic, w) {
  if (!pic) return
  const n = 40, z0 = -95, z1 = 6
  for (let i = 0; i < n; i++) {
    const za = lerp(z0, z1, i / n), zb = lerp(z0, z1, (i + 1) / n)
    const fa = P(C, 37, 1.1, za), fb = P(C, 37, 1.1, zb), ta = P(C, 52, 13, za), tb = P(C, 52, 13, zb)
    if (!fa.ok || !fb.ok || !ta.ok || !tb.ok) continue
    const left = Math.min(fa.x, fb.x, ta.x, tb.x), right = Math.max(fa.x, fb.x, ta.x, tb.x)
    if (right < -10 || left > w + 10) continue
    const top = Math.min(ta.y, tb.y), bot = Math.max(fa.y, fb.y)
    const sx = (i / n) * pic.width, sw = Math.max(1, pic.width / n)
    ctx.fillStyle = '#0b1116'; ctx.fillRect(left, bot - 2, right - left + 1, Math.max(2, (bot - top) * 0.06))
    ctx.drawImage(pic, sx, 0, sw, pic.height, left, top, right - left + 1, bot - top)
  }
}
// A camera at rest: the whole picture painted once and stamped. key: anything that changes it
export function staticStadium(ctx, view, C, key, o = {}) {
  layer(ctx, view, `soccer|${key}|${C.x}|${C.y}|${C.z}|${C.F}|${C.hz}|${C.yaw}|${(o.team ?? []).join()}|${(o.away ?? []).join()}|${o.board ?? ''}|${o.empty ? 1 : 0}`, x => stadium(x, view, C, { ...o, grain: true }))
}

// ── The goal ────────────────────────────────────────────────────────────────
// The posts and the bar, white and round, with a shade down one side. back: the frame and the stanchions behind
// (painted under the net), else the front of it (over the net and the ball)
export function goalFrame(ctx, C, back = false) {
  const lp = P(C, -POST, 0, 0), rp = P(C, POST, 0, 0), lt = P(C, -POST, BAR, 0), rt = P(C, POST, BAR, 0)
  if (!lp.ok) return
  const pw = Math.max(1.6, 0.12 * lp.s)
  if (back) {
    // the stanchions and the back of the net's frame
    const bl = P(C, -POST - 0.25, 0, NET_D), br = P(C, POST + 0.25, 0, NET_D), blt = P(C, -POST - 0.1, NET_TOP, NET_D), brt = P(C, POST + 0.1, NET_TOP, NET_D)
    ctx.strokeStyle = '#c8ced2'; ctx.lineWidth = Math.max(1, pw * 0.4)
    ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(blt.x, blt.y); ctx.lineTo(brt.x, brt.y); ctx.lineTo(br.x, br.y)
    ctx.moveTo(lt.x, lt.y); ctx.lineTo(blt.x, blt.y); ctx.moveTo(rt.x, rt.y); ctx.lineTo(brt.x, brt.y); ctx.stroke()
    return
  }
  ctx.lineCap = 'butt'
  ctx.fillStyle = INK
  ctx.fillRect(lp.x - pw / 2 - 1, lt.y - pw / 2 - 1, pw + 2, lp.y - lt.y + pw / 2 + 1)
  ctx.fillRect(rp.x - pw / 2 - 1, rt.y - pw / 2 - 1, pw + 2, rp.y - rt.y + pw / 2 + 1)
  ctx.fillRect(lt.x - pw / 2 - 1, lt.y - pw / 2 - 1, rt.x - lt.x + pw + 2, pw + 2)
  ctx.fillStyle = '#f7f8f6'
  ctx.fillRect(lp.x - pw / 2, lt.y - pw / 2, pw, lp.y - lt.y + pw / 2)
  ctx.fillRect(rp.x - pw / 2, rt.y - pw / 2, pw, rp.y - rt.y + pw / 2)
  ctx.fillRect(lt.x - pw / 2, lt.y - pw / 2, rt.x - lt.x + pw, pw)
  ctx.fillStyle = '#c7ccd0'
  ctx.fillRect(lp.x + pw * 0.15, lt.y + pw / 2, pw * 0.35, lp.y - lt.y - pw / 2)
  ctx.fillRect(rp.x + pw * 0.15, rt.y + pw / 2, pw * 0.35, rp.y - rt.y - pw / 2)
  ctx.fillRect(lt.x, lt.y + pw * 0.15, rt.x - lt.x, pw * 0.35)
}
// The net: a mesh from the bar back to the frame and down, and the sides. ripple: { x, y, at } where the ball hit
// the back of it (metres, across and up), at: when. The mesh around it is pushed back and stretched out, and it
// shakes as it settles.
const NX = 18, NY = 8
export function net(ctx, C, ripple = null, t = 0) {
  const age = ripple ? t - ripple.at : -1
  const live = ripple && age >= 0 && age < 1600
  const amp = live ? Math.exp(-age / 420) * (0.9 + 0.1 * Math.cos(age / 70)) : 0
  const bulge = (X, Y) => {
    if (!live) return [0, 0, 0]
    const dx = X - ripple.x, dy = Y - ripple.y, r2 = dx * dx + dy * dy
    const f = Math.exp(-r2 / 0.9) * amp, wob = Math.sin(Math.sqrt(r2) * 4 - age / 45) * 0.12 * amp * Math.exp(-r2 / 3)
    return [dx * f * 0.25, dy * f * 0.25 - f * 0.15, f * 0.55 + wob]
  }
  ctx.strokeStyle = 'rgba(236,240,242,.55)'; ctx.lineWidth = 0.8
  ctx.beginPath()
  // the back: across and down
  const pt = (X, Y, Z) => { const b = bulge(X, Y); return P(C, X + b[0], Y + b[1], Z + b[2]) }
  for (let j = 0; j <= NY; j++) {
    const Y = (NET_TOP * j) / NY
    for (let i = 0; i <= NX; i++) {
      const X = lerp(-POST, POST, i / NX), q = pt(X, Y, NET_D)
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y)
    }
  }
  for (let i = 0; i <= NX; i++) {
    const X = lerp(-POST, POST, i / NX)
    for (let j = 0; j <= NY; j++) { const q = pt(X, (NET_TOP * j) / NY, NET_D); if (j === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y) }
    // and the roof, back to the bar
    const top = pt(X, NET_TOP, NET_D), bar = P(C, X, BAR, 0)
    ctx.moveTo(top.x, top.y); ctx.lineTo(bar.x, bar.y)
  }
  for (let k = 1; k < 4; k++) {
    const Z = (NET_D * k) / 4, Y = lerp(BAR, NET_TOP, k / 4)
    const a = P(C, -POST, Y, Z), b = P(C, POST, Y, Z); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
  }
  // the sides
  for (const sd of [-1, 1]) {
    for (let k = 0; k <= 4; k++) {
      const Z = (NET_D * k) / 4, a = P(C, sd * POST, 0, Z), b = P(C, sd * POST, lerp(BAR, NET_TOP, k / 4), Z)
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
    }
    for (let j = 0; j <= 4; j++) {
      const Y = (BAR * j) / 4, a = P(C, sd * POST, Y, 0), b = P(C, sd * POST, Math.min(Y, NET_TOP), NET_D)
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
    }
  }
  ctx.stroke()
}

// ── The ball ────────────────────────────────────────────────────────────────
// A white ball with the twelve black panels of the classic one, turned by its spin
const PH = (1 + Math.sqrt(5)) / 2
const PENTS = [[-1, PH, 0], [1, PH, 0], [-1, -PH, 0], [1, -PH, 0], [0, -1, PH], [0, 1, PH], [0, -1, -PH], [0, 1, -PH], [PH, 0, -1], [PH, 0, 1], [-PH, 0, -1], [-PH, 0, 1]].map(([a, b, c]) => { const m = Math.hypot(a, b, c); return [a / m, b / m, c / m] })
export function ballAt(ctx, px, py, r, spin = 0, roll = 0) {
  if (r < 0.6) return
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, r + Math.max(0.6, r * 0.14), 0, 6.2832); ctx.fill()
  ctx.fillStyle = '#f7f7f4'; ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832); ctx.fill()
  if (r >= 2.2) {
    const ca = Math.cos(spin), sa = Math.sin(spin), cb = Math.cos(roll), sb = Math.sin(roll)
    ctx.fillStyle = '#16191d'
    for (const [a, b, c] of PENTS) {
      // turn it: over the top (spin), then round (roll)
      const y1 = b * ca - c * sa, z1 = b * sa + c * ca
      const x2 = a * cb + z1 * sb, z2 = -a * sb + z1 * cb
      if (z2 < 0.12) continue
      const pr = r * 0.3 * (0.45 + 0.55 * z2)
      ctx.beginPath(); ctx.arc(px + x2 * r * 0.8, py + y1 * r * 0.8, pr, 0, 6.2832); ctx.fill()
    }
  }
  // the light on it, from up and to the left; the shade under it
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(px, py, r, 0.2, 2.9); ctx.arc(px - r * 0.2, py - r * 0.25, r * 0.92, 2.9, 0.2, true); ctx.fill()
}
export function ball(ctx, C, X, Y, Z, spin = 0, roll = 0, shadow = true) {
  const p = P(C, X, Y, Z)
  if (!p.ok) return p
  if (shadow) {
    const g = P(C, X, 0, Z)
    const k = clamp(1 - Y / 6, 0.3, 1)
    ctx.fillStyle = `rgba(2,10,6,${(0.36 * k).toFixed(3)})`
    ctx.beginPath(); ctx.ellipse(g.x + 0.04 * g.s, g.y, 0.15 * g.s * (1.3 - k * 0.3), 0.045 * g.s, 0, 0, 6.2832); ctx.fill()
  }
  ballAt(ctx, p.x, p.y, Math.max(1.1, 0.11 * p.s), spin, roll)
  return p
}

// ── The men ─────────────────────────────────────────────────────────────────
// A footballer, not a padded one: a slim athletic build in a fitted short-sleeved shirt (the number big on the back,
// small on the chest with the badge), shorts, socks pulled up over the shin pads, boots. Real hair and skin. The keeper
// in his own kit, long sleeves and gloves. Every part is outlined in the art layer's ink, lit from the upper left.
//
// A pose, in the rig's units (a man about 110 high, his feet at 0, up is minus):
//   hy the hips' height · hx the hips across · lean the body across (radians, + to the screen's right)
//   bow how far he's folded toward or away from the camera (0-0.8: the body shortens)
//   lx ly / rx ry the feet (screen left / right) · lk / rk the knees: +1 driven up and forward, -1 a heel kicked up
//   hlx hly / hrx hry the hands · elbow 0 hanging, 1 out wide (hands on the hips, on the head) · fore 0-1 how much the
//   elbows bend toward or away from the camera (a runner's arms: foreshortened, not out to the sides)
//   rot the whole man turned about his hips (a dive, a slide, a flip) · head the head turned (-1..1) · tilt up + / down -
//   face 0 set, 1 a roar, 2 gutted, 3 a finger on the lips · fl / fr a finger out of that hand (pointing)
const DEF = { hy: 53, hx: 0, lean: 0, bow: 0, lx: -8, ly: 0, rx: 8, ry: 0, lk: 0, rk: 0, hlx: -16.5, hly: -47.5, hrx: 16.5, hry: -47.5, elbow: 0, fore: 0, rot: 0, head: 0, tilt: 0, face: 0, fl: 0, fr: 0 }
const pz = o => ({ ...DEF, ...o })
export const mix = (a, b, f) => {
  const o = {}
  for (const k in DEF) { const x = a[k] ?? DEF[k], y = b[k] ?? DEF[k]; o[k] = k === 'face' ? (f < 0.5 ? x : y) : x + (y - x) * f }
  return o
}
export const POSE = {
  stand: pz({}),
  ready: pz({ hy: 50, bow: 0.06, lx: -11, rx: 11, hlx: -19, hly: -56, hrx: 19, hry: -56, elbow: 0.25 }),
  // a keeper set: knees bent, weight forward, hands out in front of him ready
  set: pz({ hy: 44, bow: 0.16, lx: -15, rx: 15, lk: 0.3, rk: 0.3, hlx: -22, hly: -62, hrx: 22, hry: -62, elbow: 0.45, fore: 0.4 }),
  hips: pz({ lx: -9, rx: 9, hlx: -11, hly: -57, hrx: 11, hry: -57, elbow: 1 }),
  knees: pz({ hy: 41, bow: 0.5, lx: -11, rx: 11, lk: 0.5, rk: 0.5, hlx: -10, hly: -32, hrx: 10, hry: -32, elbow: 0.4, tilt: -0.6 }),
  headHands: pz({ lx: -8, rx: 8, hlx: -5, hly: -103, hrx: 5, hry: -103, elbow: 1, tilt: 0.3 }),
  armsOut: pz({ hlx: -42, hly: -94, hrx: 42, hry: -94, face: 1 }),
  plane: pz({ hlx: -46, hly: -86, hrx: 46, hry: -86, face: 1 }),
  roar: pz({ hy: 51, lx: -14, rx: 14, hlx: -22, hly: -116, hrx: 22, hry: -116, elbow: 0.3, face: 1, tilt: 0.5 }),
  fist: pz({ hy: 52, lean: 0.03, lx: -10, rx: 10, hlx: -15, hly: -52, hrx: 16, hry: -114, face: 1 }),
  point: pz({ hrx: 12, hry: -119, fr: 1 }),
  sky: pz({ hlx: -9, hly: -119, hrx: 9, hry: -119, fl: 1, fr: 1, tilt: 1 }),
  // the knee slide: on his knees, leaning back, arms out wide, head back
  slide: pz({ hy: 25, bow: 0.22, lx: -14, ly: 3, rx: 14, ry: 3, lk: -1, rk: -1, hlx: -40, hly: -70, hrx: 40, hry: -70, face: 1, tilt: 1 }),
  // landed from the jump and the turn: feet wide, chest out, arms out and down
  landed: pz({ hy: 45, lx: -19, rx: 19, lk: 0.2, rk: 0.2, hlx: -40, hly: -58, hrx: 40, hry: -58, face: 1, tilt: 0.6 }),
  badge: pz({ hlx: 3, hly: -89, hrx: 16.5, hry: -48, elbow: 0.7, tilt: -0.4 }),
  shush: pz({ hlx: -34, hly: -66, hrx: 1, hry: -93, fr: 1, elbow: 0.5, face: 3 }),
  jump: pz({ hy: 50, lx: -7, ly: -14, rx: 7, ry: -16, lk: 1, rk: 1, hlx: -30, hly: -76, hrx: 30, hry: -76, elbow: 0.5 }),
  tuck: pz({ hy: 50, lx: -8, ly: -36, rx: 8, ry: -36, lk: 1, rk: 1, hlx: -12, hly: -52, hrx: 12, hry: -52, elbow: 0.3 }),
  dive: pz({ lx: -6, rx: 6, ry: -4, hlx: -7, hly: -126, hrx: 7, hry: -126 }),
  down: pz({ lx: -7, rx: 7, hlx: -10, hly: -112, hrx: 10, hry: -112 }),
  smother: pz({ hy: 22, bow: 0.3, lx: -22, ly: -2, rx: 22, ry: -2, lk: 1, rk: 1, hlx: -34, hly: -30, hrx: 34, hry: -30 }),
  // sat down on the grass, knees up, hands on his knees
  sit: pz({ hy: 11, lx: -13, ly: 5, rx: 13, ry: 5, lk: 1, rk: 1, hlx: -12, hly: -22, hrx: 12, hry: -22, elbow: 0.6, tilt: -0.7, face: 2 }),
  // bent into the net for the ball
  pick: pz({ hy: 48, bow: 0.62, lx: -10, rx: 10, lk: 0.3, rk: 0.3, hlx: -5, hly: -26, hrx: 5, hry: -26 }),
  argue: pz({ lx: -10, rx: 10, hlx: -27, hly: -62, hrx: 27, hry: -62, elbow: 0.8, head: -0.8, face: 2 }),
  drop: pz({ bow: 0.12, hlx: -11, hly: -57, hrx: 11, hry: -57, elbow: 1, tilt: -1, face: 2 }),
  // up on a teammate's back: legs round his waist, arms round his shoulders
  piggy: pz({ hy: 40, lx: -17, ly: -12, rx: 17, ry: -12, lk: 1, rk: 1, hlx: -13, hly: -60, hrx: 18, hry: -114, elbow: 0.7, face: 1 }),
  ruffle: pz({ hrx: 22, hry: -101, elbow: 0.2, face: 1 }),
  pointAt: pz({ hrx: 40, hry: -86, fr: 1, face: 1 }),
  appeal: pz({ lx: -10, rx: 10, hlx: -30, hly: -66, hrx: 30, hry: -66, elbow: 0.7, face: 2 }),
  clip: pz({ hlx: -6, hly: -66, hrx: 7, hry: -68, elbow: 0.8 }),   // a coach with his clipboard
}
// Running: the legs through a real stride (the trailing heel comes up, then the knee drives through), the arms
// pumping opposite them with the elbows bent, the hips rising and falling. phase 0-1 through a stride; k 0-1 how hard.
// o: { lean (a bank into a turn), arms: 'pump' | 'out' | 'fist' | 'wide' }
export function runPose(phase, k = 1, base = null, o = null) {
  const out = { ...DEF, ...(base ?? null) }
  const leg = u => {
    u = ((u % 1) + 1) % 1
    if (u < 0.42) return { y: 0, kn: 0.2 }
    const f = (u - 0.42) / 0.58
    return { y: -Math.sin(f * Math.PI) * (16 + 12 * k) * k, kn: -Math.cos(f * Math.PI) }
  }
  const L = leg(phase), R = leg(phase + 0.5), s = Math.sin(phase * Math.PI * 2)
  out.lx = -6.5; out.rx = 6.5; out.ly = L.y; out.ry = R.y; out.lk = L.kn; out.rk = R.kn
  out.hy = 52 + Math.abs(Math.cos(phase * Math.PI * 2)) * 2.2 * k
  out.bow = 0.08 * k
  out.lean = s * 0.025 * k + (o?.lean ?? 0)
  out.hx = (o?.lean ?? 0) * -10
  const arms = o?.arms ?? 'pump'
  // pumping: the hand coming forward rises to the chest and in, the one going back drops and out
  const fwdL = (1 - s) / 2, fwdR = (1 + s) / 2
  out.hlx = lerp(-15, -6, fwdL * k); out.hly = lerp(-58, -70, fwdL * k)
  out.hrx = lerp(15, 6, fwdR * k); out.hry = lerp(-58, -70, fwdR * k)
  out.elbow = 0; out.fore = 0.85
  if (arms === 'out') { out.hlx = -46; out.hly = -86 + s * 3; out.hrx = 46; out.hry = -86 - s * 3; out.elbow = 0; out.fore = 0; out.face = 1 }
  if (arms === 'wide') { out.hlx = -42; out.hly = -94; out.hrx = 42; out.hry = -94; out.elbow = 0; out.fore = 0; out.face = 1 }
  if (arms === 'fist') { const pump = Math.abs(Math.sin(phase * Math.PI)); out.hrx = 15; out.hry = lerp(-96, -118, pump); out.elbow = 0.3; out.fore = 0.3; out.face = 1 }
  return out
}
// on the ball: a shorter stride, the head down a touch, the arms out a little for balance
export function dribblePose(phase, k = 1, o = null) {
  const p = runPose(phase, k * 0.75, null, o)
  p.bow = 0.12; p.tilt = -0.35
  p.hlx -= 4; p.hrx += 4; p.hly += 3; p.hry += 3
  return p
}
// The strike, from behind him: f 0-1 from the last step to the follow-through. foot: 1 the right foot, -1 the left.
// The standing foot planted by the ball, the kicking leg back (the heel up), then through and up across him, the
// far arm out wide for balance.
export function kickPose(f, foot = 1, o = null) {
  const out = { ...DEF }, F = foot
  const back = clamp(f / 0.45, 0, 1), thru = clamp((f - 0.45) / 0.55, 0, 1), e = 1 - (1 - thru) * (1 - thru)
  const plantX = -F * 8
  const kx = F * lerp(lerp(9, 13, back), 2, e), ky = lerp(lerp(0, -30, back), -(o?.high ? 62 : 48), e)
  const kk = thru > 0 ? lerp(-1, 1, e) : -back
  if (F > 0) { out.lx = plantX; out.ly = 0; out.rx = kx; out.ry = ky; out.rk = kk; out.lk = 0.3 }
  else { out.rx = plantX; out.ry = 0; out.lx = kx; out.ly = ky; out.lk = kk; out.rk = 0.3 }
  out.hy = 52 - back * 4 + e * 2
  out.lean = -F * (0.06 + 0.12 * back) + F * 0.14 * e
  out.bow = 0.12 + 0.12 * e
  out.tilt = -0.4 * (1 - e)
  const wide = lerp(30, 44, back)
  if (F > 0) { out.hlx = -wide; out.hly = lerp(-64, -82, back); out.hrx = lerp(18, -2, e); out.hry = lerp(-54, -62, e) }
  else { out.hrx = wide; out.hry = lerp(-64, -82, back); out.hlx = lerp(-18, 2, e); out.hly = lerp(-54, -62, e) }
  out.elbow = 0.2
  return out
}

const TH = 27, SH = 26, UA = 18.5, FA = 17.5, TORSO = 33, HR = 7.4, SHW = 10.6, HIPW = 5
const OL = 1.15   // the ink round every part, in rig units
// a limb: two circles joined by their tangents (a cone with round ends)
function taper(x, ax, ay, ra, bx, by, rb) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy)
  if (d < Math.abs(ra - rb) + 0.05) { const r = Math.max(ra, rb), cx = ra > rb ? ax : bx, cy = ra > rb ? ay : by; x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, 6.2832); return }
  const a = Math.atan2(dy, dx), phi = Math.acos(clamp((ra - rb) / d, -1, 1))
  x.moveTo(ax + ra * Math.cos(a + phi), ay + ra * Math.sin(a + phi))
  x.arc(ax, ay, ra, a + phi, a + 2 * Math.PI - phi)
  x.arc(bx, by, rb, a - phi, a + phi)
  x.closePath()
}
// a set of limbs in one colour: the ink round them first, then the colour, then the shade down their right side
function limbs(x, list, col, shade = true) {
  x.fillStyle = INK; x.beginPath(); for (const l of list) taper(x, l[0], l[1], l[2] + OL, l[3], l[4], l[5] + OL); x.fill()
  x.fillStyle = shade ? tone(col, 0.74) : col; x.beginPath(); for (const l of list) taper(x, l[0], l[1], l[2], l[3], l[4], l[5]); x.fill()
  if (!shade) return
  x.fillStyle = col; x.beginPath(); for (const l of list) { const k = 0.3; taper(x, l[0] - l[2] * k, l[1] - l[2] * 0.12, l[2] * 0.72, l[3] - l[5] * k, l[4] - l[5] * 0.12, l[5] * 0.72) } x.fill()
}
// an arm: the elbow off the line to the hand toward (px, py)
function armOf(ax, ay, tx, ty, px, py, fore = 0) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001
  const mx = UA + FA - 0.05
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx }
  const ux = dx / d, uy = dy / d, along = px * ux + py * uy, h = Math.sqrt(Math.max(0, UA * UA - (d * d) / 4)) * (1 - 0.8 * fore)
  let qx = px - ux * along, qy = py - uy * along
  const ql = Math.hypot(qx, qy) || 1; qx /= ql; qy /= ql
  return { sx: ax, sy: ay, jx: ax + dx * (UA / (UA + FA)) + qx * h, jy: ay + dy * (UA / (UA + FA)) + qy * h, ex: ax + dx, ey: ay + dy }
}
// the knee: neutral (a little out), driven up (the shin hangs under it), or a heel kicked up (the thigh straight down)
function kneeOf(hx, hy, ax, ay, k, out) {
  const L = Math.hypot(ax - hx, ay - hy), bend = clamp(1 - L / (TH + SH), 0, 1)
  const nx = (hx + ax) / 2 + out * bend * 7, ny = (hy + ay) / 2 - bend * 5
  let kx = nx, ky = ny
  if (k > 0) { kx = lerp(nx, lerp(hx, ax, 0.45) + out * 2, k); ky = lerp(ny, Math.min(ay - SH * 0.92, hy + TH), k) }
  else if (k < 0) { kx = lerp(nx, lerp(hx, ax, 0.3) + out * 1.5, -k); ky = lerp(ny, hy + TH * 0.94, -k) }
  // never longer than the thigh
  const tx = kx - hx, ty = ky - hy, tl = Math.hypot(tx, ty)
  if (tl > TH) { kx = hx + (tx / tl) * TH; ky = hy + (ty / tl) * TH }
  return [kx, ky]
}
// a hair colour that goes with the skin, and a cut, from who he is (the same man always looks the same)
const HAIRS_DARK = ['#120e0b', '#17110d', '#1d1510']
const HAIRS = ['#15110e', '#2c1f16', '#4a3220', '#6b4a2c', '#a07a48', '#c9a86a']
const CUTS = ['crop', 'fade', 'curly', 'crop', 'long', 'fade', 'bun', 'buzz', 'crop', 'curly']
const hashOf = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h }
function hairFor(L) {
  const h = hashOf(`${L.number ?? ''}|${L.skin ?? ''}|${L.name ?? ''}`)
  const n = parseInt(String(warmSkin(L.skin ?? '#8d5a3b')).slice(1, 7), 16), lum = (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255
  const col = L.hairColor ?? (lum < 0.45 ? HAIRS_DARK[h % 3] : HAIRS[(h >> 2) % (lum > 0.62 ? 6 : 4)])
  let cut = L.cut ?? CUTS[(h >> 3) % CUTS.length]
  if (cut === 'curly' && lum > 0.6 && !L.cut) cut = 'crop'
  return { col, cut }
}
const BOOTS = ['#15181c', '#f2f2ee', '#f08a24', '#2bd4c5', '#e84fa1', '#15181c', '#c6ec3a', '#2a64d8']
// One man, painted in his own units at 0, 0 (his feet). look: { shirt, trim, shorts, socks, num, gloves, skin, hair
// (a cut), hairColor, number, front (facing the camera), sleeves (long: a keeper), boot, build (0 slim - 1 strong),
// clipboard }
export function paintMan(x, o, L) {
  const lean = o.lean ?? 0, bow = clamp(Math.abs(o.bow ?? 0), 0, 0.8), front = !!L.front
  const skin = warmSkin(L.skin ?? '#8d5a3b'), skinD = tone(skin, 0.78)
  const bw = 1 + ((L.build ?? 0.45) - 0.45) * 0.16
  const T = TORSO * (1 - 0.4 * bow)
  const cl = Math.cos(lean), sl = Math.sin(lean), hipX = o.hx ?? 0, hipY = -(o.hy ?? 53)
  const sxx = hipX + sl * T, syy = hipY - cl * T, W = SHW * bw
  const lS = [sxx - cl * W, syy - sl * W + 3.2], rS = [sxx + cl * W, syy + sl * W + 3.2]
  const lH = [hipX - cl * HIPW, hipY - sl * HIPW], rH = [hipX + cl * HIPW, hipY + sl * HIPW]
  const lA = [o.lx, o.ly - 2.6], rA = [o.rx, o.ry - 2.6]
  const lK = kneeOf(lH[0], lH[1], lA[0], lA[1], o.lk ?? 0, -1), rK = kneeOf(rH[0], rH[1], rA[0], rA[1], o.rk ?? 0, 1)
  const el = o.elbow ?? 0
  const pole = (S, hy, out) => { const up = clamp((S[1] - hy) / 28, 0, 1); return [out * lerp(0.3 + 0.5 * up, 1, el), lerp(0.95 - 0.55 * up, 0.1, el)] }
  const lp = pole(lS, o.hly, -1), rp = pole(rS, o.hry, 1)
  const lArm = armOf(lS[0], lS[1], o.hlx, o.hly, lp[0], lp[1], o.fore ?? 0), rArm = armOf(rS[0], rS[1], o.hrx, o.hry, rp[0], rp[1], o.fore ?? 0)
  const tilt = o.tilt ?? 0, turnH = o.head ?? 0
  const nl = 4.5 * (1 - 0.3 * bow), hx = sxx + sl * (nl + HR) + turnH * 1.2, hy = syy - cl * (nl + HR) + (bow > 0.3 ? bow * 4 : 0) - tilt * 0.6
  const gk = !!L.gloves, handR = gk ? 3.7 : 2.6
  const { col: hairC, cut } = hairFor({ ...L, cut: L.hair && L.hair[0] !== '#' ? L.hair : L.cut, hairColor: L.hairColor ?? (L.hair && L.hair[0] === '#' && L.hair !== '#17120e' ? L.hair : undefined) })
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'
  if (o.rot) { x.translate(hipX, hipY); x.rotate(o.rot); x.translate(-hipX, -hipY) }
  // which arms go behind the body: from behind, a hand in front of him (inside the shirt's outline) is hidden
  const inside = a => Math.abs(a.ex - sxx) < 9 && a.ey > syy + 2 && a.ey < hipY + 4
  const armBehind = a => !front && inside(a)
  const armOverHead = a => a.ey < hy + 4 && Math.abs(a.ex - hx) < 11
  // 1. the arms behind him
  for (const [a, out] of [[lArm, -1], [rArm, 1]]) if (armBehind(a)) paintArm(x, a, out, L, skin, handR, gk, o, front)
  // 2. the legs: boots, socks over the shin pads, the knees, the thighs
  const legs = [[lH, lK, lA, -1], [rH, rK, rA, 1]]
  const boot = L.boot ?? BOOTS[hashOf(`${L.number}|${L.skin}`) % BOOTS.length]
  for (const [H, K, A, out] of legs) {
    // the boot: from behind his heel, from the front the toe, a little out
    const fx = A[0] + out * 2.4, fy = A[1] + 3.1
    x.fillStyle = INK; x.beginPath(); taper(x, A[0], A[1] + 0.6, 3.0 + OL, fx, fy, 2.7 + OL); x.fill()
    x.fillStyle = boot; x.beginPath(); taper(x, A[0], A[1] + 0.6, 3.0, fx, fy, 2.7); x.fill()
    x.fillStyle = boot === '#15181c' ? '#f2f2ee' : '#15181c'; x.fillRect(Math.min(A[0], fx) - 1.5, fy + 0.9, Math.abs(fx - A[0]) + 3, 1.1)
  }
  const sockTop = (K, A) => [lerp(K[0], A[0], 0.2), lerp(K[1], A[1], 0.2)]
  limbs(x, legs.map(([H, K, A]) => { const s = sockTop(K, A); return [s[0], s[1], 4.3 * bw, A[0], A[1], 2.7] }), L.socks)
  // the shin pad under the sock: a slight ridge down the front of it
  if (front) { x.fillStyle = tone(L.socks, 1.12); x.beginPath(); for (const [, K, A] of legs) { const s = sockTop(K, A); taper(x, lerp(s[0], A[0], 0.12), lerp(s[1], A[1], 0.12), 1.7, lerp(s[0], A[0], 0.72), lerp(s[1], A[1], 0.72), 1.1) } x.fill() }
  // the turn-over at the top of the sock, in the trim
  x.fillStyle = L.trim; x.beginPath(); for (const [, K, A] of legs) { const s = sockTop(K, A), e = [lerp(K[0], A[0], 0.29), lerp(K[1], A[1], 0.29)]; taper(x, s[0], s[1], 4.4 * bw, e[0], e[1], 4.2 * bw) } x.fill()
  limbs(x, legs.map(([H, K, A]) => { const s = sockTop(K, A); return [K[0], K[1], 4.1 * bw, s[0], s[1], 4.0 * bw] }), skin)
  limbs(x, legs.map(([H, K]) => [lerp(H[0], K[0], 0.4), lerp(H[1], K[1], 0.4), 5.2 * bw, K[0], K[1], 4.2 * bw]), skin)
  // 3. the shorts: the legs of them and the seat, the hem in the trim
  limbs(x, legs.map(([H, K]) => [H[0], H[1], 6.1 * bw, lerp(H[0], K[0], 0.46), lerp(H[1], K[1], 0.46), 5.9 * bw]), L.shorts)
  const waist = (d) => {
    const ww = HIPW + 4.6 * bw + d, nx = -sl, ny = cl
    x.beginPath()
    x.moveTo(hipX - cl * ww - nx * (6 + d), hipY - sl * ww - ny * (6 + d)); x.lineTo(hipX + cl * ww - nx * (6 + d), hipY + sl * ww - ny * (6 + d))
    x.lineTo(hipX + cl * (ww + 0.6) + nx * (3 + d), hipY + sl * (ww + 0.6) + ny * (3 + d)); x.lineTo(hipX - cl * (ww + 0.6) + nx * (3 + d), hipY - sl * (ww + 0.6) + ny * (3 + d)); x.closePath()
  }
  waist(OL); x.fillStyle = INK; x.fill(); waist(0); x.fillStyle = L.shorts; x.fill()
  x.strokeStyle = L.trim; x.lineWidth = 1.1; x.lineCap = 'butt'; x.beginPath()
  for (const [H, K, , out] of legs) {
    const a = [lerp(H[0], K[0], 0.46), lerp(H[1], K[1], 0.46)], dx = K[0] - H[0], dy = K[1] - H[1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl
    x.moveTo(a[0] + nx * 5.2, a[1] + ny * 5.2); x.lineTo(a[0] - nx * 5.2, a[1] - ny * 5.2)
    void out
  }
  x.stroke(); x.lineCap = 'round'
  // 4. the shirt: fitted, cut in at the waist, the far side in shade; the collar; the number
  x.save(); x.translate(sxx, syy); x.rotate(lean)
  const shirt = () => {
    const w = W, wa = W * 0.82, ww = 8.4 * bw, wh = 8.9 * bw
    x.beginPath()
    x.moveTo(-w + 2.5, -0.8); x.quadraticCurveTo(-w - 0.6, -0.4, -w - 0.4, 4.6); x.lineTo(-wa, 10.5)
    x.quadraticCurveTo(-ww - 0.6, T * 0.62, -ww, T - 2.5); x.lineTo(-wh, T + 2.2); x.lineTo(wh, T + 2.2); x.lineTo(ww, T - 2.5)
    x.quadraticCurveTo(ww + 0.6, T * 0.62, wa, 10.5); x.lineTo(w + 0.4, 4.6); x.quadraticCurveTo(w + 0.6, -0.4, w - 2.5, -0.8); x.closePath()
  }
  shirt(); x.strokeStyle = INK; x.lineWidth = OL * 2; x.stroke(); x.fillStyle = L.shirt; x.fill()
  x.save(); shirt(); x.clip()
  x.fillStyle = tone(L.shirt, 0.8); x.beginPath(); x.moveTo(4.2, -2); x.quadraticCurveTo(6.8, T * 0.5, 4.6, T + 3); x.lineTo(14, T + 3); x.lineTo(14, -2); x.closePath(); x.fill()
  // the fold where it tucks in at the waist
  x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(-10, T - 0.4, 20, 2.8)
  x.restore()
  // the collar
  x.strokeStyle = L.trim; x.lineWidth = 1.5
  x.beginPath()
  if (front) { x.moveTo(-4.4, -0.6); x.quadraticCurveTo(0, 5.2, 4.4, -0.6) } else { x.moveTo(-4.6, -0.4); x.quadraticCurveTo(0, 1.8, 4.6, -0.4) }
  x.stroke()
  if (front) { x.fillStyle = skinD; x.beginPath(); x.moveTo(-3.6, -0.7); x.quadraticCurveTo(0, 4.2, 3.6, -0.7); x.closePath(); x.fill() }
  if (L.number != null && bow < 0.55) {
    const n = String(L.number)
    if (front) {
      text(x, n, -4.6, 8.4, { font: DISPLAY, size: 6.2, color: L.num })
      // the badge, over his heart (his left: the screen's right)
      x.fillStyle = L.trim; x.beginPath(); x.moveTo(3.2, 5.6); x.lineTo(6.8, 5.6); x.lineTo(6.8, 8.6); x.quadraticCurveTo(5, 10.6, 3.2, 8.6); x.closePath(); x.fill()
      x.fillStyle = tone(L.shirt, 0.7); x.fillRect(4.3, 6.8, 1.4, 1.6)
    } else text(x, n, 0, 12.5 + (T - TORSO) * 0.3, { font: DISPLAY, size: n.length > 1 ? 14 : 15.5, color: L.num, track: n.length > 1 ? -0.4 : 0 })
  }
  x.restore()
  // 5. the arms in front, the head, then any hand up at the head
  const late = []
  for (const [a, out] of [[lArm, -1], [rArm, 1]]) { if (armBehind(a)) continue; if (armOverHead(a) || (front && Math.abs(a.ex - hx) < 9 && Math.abs(a.ey - hy) < 12)) late.push([a, out]); else paintArm(x, a, out, L, skin, handR, gk, o, front) }
  paintHead(x, sxx, syy, hx, hy, skin, skinD, hairC, cut, front, o, tilt, turnH)
  for (const [a, out] of late) paintArm(x, a, out, L, skin, handR, gk, o, front)
  // a clipboard held in front of him
  if (L.clipboard) {
    const cx = (lArm.ex + rArm.ex) / 2, cy = (lArm.ey + rArm.ey) / 2 - 2
    x.fillStyle = INK; x.fillRect(cx - 5, cy - 6.5, 10, 13)
    x.fillStyle = front ? '#e9ebe6' : '#6b5134'; x.fillRect(cx - 4.2, cy - 5.7, 8.4, 11.4)
    if (front) { x.fillStyle = '#9aa3a9'; for (let i = 0; i < 4; i++) x.fillRect(cx - 3, cy - 3 + i * 2.4, 6 - (i % 2) * 1.5, 0.6) }
    x.fillStyle = '#c9ccce'; x.fillRect(cx - 1.6, cy - 7, 3.2, 1.8)
    for (const a of [lArm, rArm]) { x.fillStyle = INK; x.beginPath(); x.arc(a.ex, a.ey, handR + OL, 0, 6.2832); x.fill(); x.fillStyle = skin; x.beginPath(); x.arc(a.ex, a.ey, handR, 0, 6.2832); x.fill() }
  }
  x.restore()
}
function paintArm(x, a, out, L, skin, handR, gk, o, front) {
  // the sleeve: short, fitted, ends halfway down the upper arm with a cuff in the trim (a keeper's runs to the wrist)
  const m = [lerp(a.sx, a.jx, 0.55), lerp(a.sy, a.jy, 0.55)]
  if (L.sleeves) {
    limbs(x, [[a.jx, a.jy, 3.1, a.ex, a.ey, 2.6], [a.sx, a.sy, 4.1, a.jx, a.jy, 3.2]], L.shirt)
  } else {
    limbs(x, [[a.jx, a.jy, 2.9, a.ex, a.ey, 2.2], [m[0], m[1], 3.3, a.jx, a.jy, 3.0]], skin)
    limbs(x, [[a.sx, a.sy, 4.2, m[0], m[1], 3.7]], L.shirt)
    x.strokeStyle = L.trim; x.lineWidth = 1.2; x.lineCap = 'butt'
    const dx = a.jx - a.sx, dy = a.jy - a.sy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl
    x.beginPath(); x.moveTo(m[0] + nx * 3.6 - dx / dl * 0.6, m[1] + ny * 3.6 - dy / dl * 0.6); x.lineTo(m[0] - nx * 3.6 - dx / dl * 0.6, m[1] - ny * 3.6 - dy / dl * 0.6); x.stroke(); x.lineCap = 'round'
  }
  // the hand (a glove: bigger, with its cuff), and a finger out if he's pointing
  const hc = gk ? L.gloves : skin
  x.fillStyle = INK; x.beginPath(); x.arc(a.ex, a.ey, handR + OL, 0, 6.2832); x.fill()
  x.fillStyle = tone(hc, 0.8); x.beginPath(); x.arc(a.ex, a.ey, handR, 0, 6.2832); x.fill()
  x.fillStyle = hc; x.beginPath(); x.arc(a.ex - handR * 0.22, a.ey - handR * 0.22, handR * 0.74, 0, 6.2832); x.fill()
  if (gk) { x.strokeStyle = tone(L.gloves, 0.55); x.lineWidth = 1.2; const dx = a.ex - a.jx, dy = a.ey - a.jy, dl = Math.hypot(dx, dy) || 1; x.beginPath(); x.moveTo(a.ex - dx / dl * 3 - dy / dl * 3, a.ey - dy / dl * 3 + dx / dl * 3); x.lineTo(a.ex - dx / dl * 3 + dy / dl * 3, a.ey - dy / dl * 3 - dx / dl * 3); x.stroke() }
  const finger = out < 0 ? o.fl : o.fr
  if (finger > 0.5) {
    const dx = a.ex - a.jx, dy = a.ey - a.jy, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl
    const tx = a.ex + ux * 5.2, ty = a.ey + uy * 5.2
    x.strokeStyle = INK; x.lineWidth = 1.6 + OL * 2; x.beginPath(); x.moveTo(a.ex + ux * 1.5, a.ey + uy * 1.5); x.lineTo(tx, ty); x.stroke()
    x.strokeStyle = skin; x.lineWidth = 1.6; x.beginPath(); x.moveTo(a.ex, a.ey); x.lineTo(tx, ty); x.stroke()
  }
}
function paintHead(x, sxx, syy, hx, hy, skin, skinD, hair, cut, front, o, tilt, turnH) {
  // the neck, then the head: a skull and a jaw, the ears, the far cheek in shade
  limbs(x, [[sxx, syy + 1, 3.9, hx, hy + 3.5, 3.3]], front ? skinD : tone(skin, 0.9), false)
  const rx = HR * 0.9, ry = HR * 1.04
  x.fillStyle = INK; x.beginPath(); x.ellipse(hx, hy, rx + OL, ry + OL, 0, 0, 6.2832); x.fill()
  for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(hx + sd * (rx - 0.2) - turnH * 1.2, hy + 0.8, 1.7 + OL, 2.2 + OL, 0, 0, 6.2832); x.fill() }
  x.fillStyle = skinD
  for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(hx + sd * (rx - 0.2) - turnH * 1.2, hy + 0.8, 1.7, 2.2, 0, 0, 6.2832); x.fill() }
  x.fillStyle = skin; x.beginPath(); x.ellipse(hx, hy, rx, ry, 0, 0, 6.2832); x.fill()
  if (front) { x.fillStyle = tone(skin, 0.88); x.beginPath(); x.ellipse(hx + rx * 0.5, hy + 0.6, rx * 0.5, ry * 0.9, 0, -1.4, 1.6); x.fill() }
  const up = clamp(tilt, -1, 1)
  x.fillStyle = hair; x.beginPath()
  if (!front) {
    // from behind the hair covers the head down to the nape; looking up shows more neck, down more crown
    const nape = hy + (cut === 'long' ? 9.5 : cut === 'buzz' ? 6.2 : 6.9) - up * 2
    x.ellipse(hx, hy - 0.3, rx + 0.45, ry + 0.35, 0, Math.PI * 0.86, Math.PI * 2.14)
    x.quadraticCurveTo(hx + rx * 0.7, nape, hx, nape + 0.6); x.quadraticCurveTo(hx - rx * 0.7, nape, hx - (rx + 0.45) * Math.cos(Math.PI * 0.14), hy - 0.3 + (ry + 0.35) * Math.sin(Math.PI * 0.14)); x.closePath()
    if (cut === 'long') { x.moveTo(hx - rx - 0.4, hy); x.lineTo(hx - rx + 0.6, nape + 1.5); x.lineTo(hx + rx - 0.6, nape + 1.5); x.lineTo(hx + rx + 0.4, hy); x.closePath() }
  } else {
    // from the front: the hairline across the forehead
    const line = hy - 3.4 + up * 1.4
    x.ellipse(hx, hy - 0.6, rx + 0.5, ry + 0.3, 0, Math.PI * 1.02, Math.PI * 1.98)
    x.lineTo(hx + rx - 0.4, line + 0.8); x.quadraticCurveTo(hx, line - 1.2, hx - rx + 0.4, line + 0.8); x.closePath()
    if (cut === 'long') { x.moveTo(hx - rx - 0.5, hy - 2); x.lineTo(hx - rx - 0.2, hy + 6.5); x.lineTo(hx - rx + 1.8, hy + 6.5); x.lineTo(hx - rx + 1.6, line + 1); x.closePath(); x.moveTo(hx + rx + 0.5, hy - 2); x.lineTo(hx + rx + 0.2, hy + 6.5); x.lineTo(hx + rx - 1.8, hy + 6.5); x.lineTo(hx + rx - 1.6, line + 1); x.closePath() }
  }
  if (cut === 'buzz') { x.globalAlpha = 0.62; x.fill(); x.globalAlpha = 1 } else x.fill()
  if (cut === 'curly') { for (let i = 0; i < 6; i++) { const a = Math.PI * (1.08 + i * 0.168); x.beginPath(); x.arc(hx + Math.cos(a) * (rx + 0.2), hy - 0.6 + Math.sin(a) * (ry + 0.1), 2.3, 0, 6.2832); x.fill() } }
  if (cut === 'bun') { x.beginPath(); x.arc(hx, hy - ry - 1.4, 2.6, 0, 6.2832); x.fill() }
  if (cut === 'fade') { x.fillStyle = tone(hair, 1.0); x.globalAlpha = 0.35; x.beginPath(); for (const sd of [-1, 1]) x.ellipse(hx + sd * (rx - 0.6), hy + 0.4, 1.4, 2.6, 0, 0, 6.2832); x.fill(); x.globalAlpha = 1 }
  if (!front) return
  // the face: brows, eyes, the nose's shade, the mouth (a roar, a set mouth, gutted)
  const f = o.face ?? 0, fy = hy + up * -1.2, fx = hx + turnH * 1.4
  x.fillStyle = '#1a120d'
  const brow = f === 1 ? -0.5 : f === 2 ? 0.45 : 0
  for (const sd of [-1, 1]) { x.save(); x.translate(fx + sd * 2.7, fy - 1.9); x.rotate(sd * brow); x.fillRect(-1.4, -0.4, 2.8, 0.85); x.restore() }
  x.beginPath(); x.arc(fx - 2.6, fy + 0.3, 0.85, 0, 6.2832); x.arc(fx + 2.6, fy + 0.3, 0.85, 0, 6.2832); x.fill()
  x.fillStyle = tone(skin, 0.72); x.beginPath(); x.ellipse(fx + 0.5, fy + 2.4, 0.9, 1.3, 0, 0, 6.2832); x.fill()
  if (f === 1) { x.fillStyle = '#2a0f0c'; x.beginPath(); x.ellipse(fx, fy + 4.9, 2.1, 2.3, 0, 0, 6.2832); x.fill(); x.fillStyle = '#f2f0ea'; x.fillRect(fx - 1.5, fy + 3.1, 3, 0.8) }
  else if (f === 2) { x.strokeStyle = '#2a0f0c'; x.lineWidth = 0.8; x.beginPath(); x.arc(fx, fy + 6.6, 2, Math.PI * 1.2, Math.PI * 1.8); x.stroke() }
  else if (f !== 3) { x.fillStyle = '#3a1a14'; x.fillRect(fx - 1.6, fy + 4.6, 3.2, 0.75) }
}
// A man at a spot on the grass: X across, Z along. A shadow tight under him, his name under his feet.
// o: { lift (metres off the grass), name, size, turn (0-1: turning round, 1 the other way), shadow }
export function man(ctx, C, X, Z, pose, look, o = {}) {
  const lift = o.lift ?? 0, p = P(C, X, 0, Z)
  if (!p.ok) return p
  const k = p.s * RIG_M * (o.size ?? 1)
  if (p.x < -90 * k || p.x > 460 + 90 * k) return p
  if (o.shadow !== false) {
    const lie = Math.abs(pose.rot ?? 0) > 0.6 && Math.abs(Math.abs(pose.rot ?? 0) - Math.PI * 2) > 0.6
    ctx.fillStyle = `rgba(2,10,6,${(0.42 * clamp(1 - lift / 2, 0.3, 1)).toFixed(3)})`
    ctx.beginPath(); ctx.ellipse(p.x + 2 * k, p.y + 0.5 * k, (lie ? 44 : 15) * k * clamp(1 - lift / 3, 0.5, 1), 3.6 * k, 0, 0, 6.2832); ctx.fill()
  }
  const turn = o.turn ?? 0, sxk = Math.max(0.16, Math.abs(Math.cos(turn * Math.PI)))
  const L = turn > 0.5 ? { ...look, front: !look.front } : look
  ctx.save(); ctx.translate(p.x, p.y - lift * p.s); ctx.scale(k * sxk, k)
  paintMan(ctx, pose, L)
  ctx.restore()
  if (o.name) nameTag(ctx, null, p.x, p.y, o.name, clamp(k * 1.4, 0.7, 1.15))
  return p
}
// look: a kit and the man in it
export const dress = (kit, who = null, extra = null) => ({ ...kit, skin: who?.skin ?? '#8d5a3b', number: who?.number ?? null, name: who?.name ?? null, ...extra })
// a coach or a scout on the touchline with his clipboard (a quick look up at the play now and then)
export function scout(ctx, C, X, Z, look, t = 0, o = {}) {
  const glance = Math.sin(t / 900 + X) > 0.7
  return man(ctx, C, X, Z, { ...POSE.clip, tilt: glance ? 0.1 : -0.6, head: o.head ?? 0 }, { ...look, clipboard: true }, o)
}

// ── The moments after: what players really do ──────────────────────────────
// A goal: the scorer peels away (a knee slide toward the corner, the airplane, the jump-turn landing with his arms
// out, kissing the badge, pointing to the sky, a finger to the lips, off to the bench, a backflip if he's built for
// it, or a plain run with a fist pumping), and his teammates chase him down: one jumps on his back, one ruffles his
// hair, one points at him. The beaten keeper face-down or sat with his hands on his knees, then picking the ball out
// of the net; their defenders hands on hips, on knees, or having a go at a teammate. Nobody beaten ever celebrates.
// A save: the keeper roars and pumps his fist; the striker's hands go to his head. A missed penalty: the keeper's
// celebration, the taker's head drops. About 2.6 s, then the card (skippable; short under Reduce Motion / low power).
export const CELEB_MS = 2600
export const celebMs = () => (lightMode() ? 1100 : CELEB_MS)
// a tap once it's decided cuts to the card (the host counts its outro from when the game finished)
export function skipOutro(g, a) {
  if (!g.done || g.doneAt == null) return false
  if (a.kind !== 'down' && a.kind !== 'key') return false
  if (g.t - g.doneAt < 250) return false
  g.outro = Math.min(g.outro ?? 2400, g.t - g.doneAt + 90)
  return true
}
const KINDS = ['slide', 'plane', 'jumpturn', 'badge', 'sky', 'shush', 'bench', 'fist', 'slide', 'jumpturn', 'plane', 'flip']
// seed: anything (the same goal always gets the same one). o: { from {x, z}, side (+1: he peels off to the screen's
// right), athletic (a backflip's allowed), mates [{x, z, who}], toward {x, z} (where he runs, else off to the side), kind }
export function celebration(seed, o = {}) {
  let h = 0; for (const ch of String(seed)) h = (h * 33 + ch.charCodeAt(0)) % 1000003
  let kind = o.kind ?? KINDS[h % KINDS.length]
  if (kind === 'flip' && !o.athletic) kind = 'fist'
  const side = o.side ?? (h % 2 ? 1 : -1), from = o.from ?? { x: 0, z: -10 }
  const dist = kind === 'bench' ? 9 : kind === 'plane' ? 7.5 : 6
  const to = o.toward ?? { x: from.x + side * dist * 0.78, z: from.z - dist * 0.45 }
  const roles = ['back', 'ruffle', 'point']
  const mates = (o.mates ?? []).map((m, i) => ({ ...m, role: roles[(i + (h >> 3)) % 3], delay: 260 + i * 190 }))
  return { kind, side, from, to, mates, seed: h, keeper: h % 3 === 0 ? 'sit' : 'down', run: kind === 'bench' ? 1900 : kind === 'plane' ? 1500 : 950 }
}
const ease = f => 1 - (1 - f) * (1 - f)
// where the scorer is and what he's doing, age ms after the goal: { x, z, pose, lift, turn, rot }
export function scorerAt(c, age) {
  const a = Math.max(0, age), R = c.run, f = clamp(a / R, 0, 1)
  // the run off: quick away, easing off at the end (the airplane swings round in an arc)
  const bend = c.kind === 'plane' ? Math.sin(f * Math.PI) * 1.6 * c.side : 0
  let x = lerp(c.from.x, c.to.x, ease(f)), z = lerp(c.from.z, c.to.z, ease(f)) - bend
  const phase = a / 255
  const run = (k = 1, o = null) => runPose(phase, k * (1 - 0.6 * clamp((f - 0.85) / 0.15, 0, 1)), null, o)
  let pose = run(), lift = 0, turn = 0
  switch (c.kind) {
    case 'slide': {
      // down on his knees and on along the grass, leaning back, arms wide
      const s = prog(a, R - 120, R + 600)
      if (a < R - 120) pose = run(1, { arms: a > 350 ? 'wide' : 'pump' })
      else {
        const dx = c.to.x - c.from.x, dz = c.to.z - c.from.z, dl = Math.hypot(dx, dz) || 1
        x += (dx / dl) * 2.4 * ease(s); z += (dz / dl) * 2.4 * ease(s)
        pose = mix(run(1, { arms: 'wide' }), POSE.slide, ease(prog(a, R - 120, R + 80)))
      }
      break
    }
    case 'plane':
      pose = a < R ? run(1, { arms: 'out', lean: -c.side * 0.26 * Math.sin(f * Math.PI) }) : mix(run(0.4, { arms: 'out' }), POSE.plane, ease(prog(a, R, R + 300)))
      break
    case 'jumpturn': {
      // stops, a little jump, spins round in the air and lands facing the crowd, arms out, chest out
      const up = prog(a, R + 150, R + 560)
      if (a < R + 150) pose = a < R ? run() : mix(run(0.3), { ...POSE.ready, hlx: -24, hly: -70, hrx: 24, hry: -70 }, ease(prog(a, R, R + 150)))
      else if (up < 1) { lift = Math.sin(up * Math.PI) * 0.62; turn = ease(up); pose = mix(POSE.jump, { ...POSE.jump, hlx: -30, hly: -100, hrx: 30, hry: -100 }, Math.sin(up * Math.PI)) }
      else { turn = 1; pose = mix({ ...POSE.landed, hy: 38 }, POSE.landed, ease(prog(a, R + 560, R + 760))) }
      break
    }
    case 'badge':
    case 'shush': {
      // turns to the camera; the badge to his lips, or a finger to them for the away end
      const t = prog(a, R - 100, R + 220)
      if (a < R - 100) pose = run()
      else { turn = ease(t); pose = mix(run(0.3), c.kind === 'badge' ? POSE.badge : POSE.shush, ease(prog(a, R, R + 300))) }
      break
    }
    case 'sky':
      pose = a < R ? run() : mix(run(0.3), POSE.sky, ease(prog(a, R, R + 280)))
      break
    case 'bench':
      pose = run(1, { arms: 'fist' })
      break
    case 'flip': {
      // a hop, then all the way over backwards, tucked, and up with his arms in the air
      const s = prog(a, R + 120, R + 720)
      if (a < R + 120) pose = a < R ? run() : mix(run(0.2), { ...POSE.ready, hy: 42 }, ease(prog(a, R, R + 120)))
      else if (s < 1) { lift = Math.sin(s * Math.PI) * 1.25; pose = { ...mix(POSE.jump, POSE.tuck, Math.sin(s * Math.PI)), rot: -c.side * s * Math.PI * 2 } }
      else pose = mix({ ...POSE.roar, hy: 40 }, POSE.roar, ease(prog(a, R + 720, R + 900)))
      break
    }
    default:
      // a run with his fist going, then turns to the camera and roars
      if (a < R + 400) pose = run(1, { arms: 'fist' })
      else { turn = ease(prog(a, R + 400, R + 650)); pose = mix(run(0.3, { arms: 'fist' }), POSE.fist, ease(prog(a, R + 400, R + 650))) }
  }
  if (c.kind === 'bench' || c.kind === 'plane') { x = lerp(c.from.x, c.to.x, ease(f)); z = lerp(c.from.z, c.to.z, ease(f)) - bend }
  return { x, z, pose, lift, turn, low: c.kind === 'slide' && a > R }
}
// a teammate i: in from where he was, then on him
export function mateAt(c, i, age, me = null) {
  const m = c.mates[i], s = me ?? scorerAt(c, age)
  const a = Math.max(0, age - m.delay)
  // (the one on his back is behind him, as we look: on the far side if he's turned to us, else he's in for a hug)
  const facing = s.turn > 0.5, role = m.role === 'back' && !facing && !s.low ? 'hug' : m.role
  const off = role === 'back' ? { x: 0.05, z: 0.3 } : role === 'hug' ? { x: c.side * 0.35, z: -0.4 } : role === 'ruffle' ? { x: -c.side * 0.62, z: -0.15 } : { x: c.side * 0.9, z: -0.7 }
  const tx = s.x + off.x, tz = s.z + off.z, d = Math.hypot(tx - m.x, tz - m.z)
  const T = Math.max(500, (d / 7.4) * 1000), f = clamp(a / T, 0, 1)
  const x = lerp(m.x, tx, ease(f)), z = lerp(m.z, tz, ease(f))
  const phase = (age + i * 90) / 250
  if (f < 1) return { x, z, pose: runPose(phase, 1, null, m.role === 'point' && f > 0.5 ? { arms: 'pump' } : null), lift: 0, turn: 0 }
  const on = age - m.delay - T
  if (s.low) {
    // he's down on his knees: in on top of him, arms round him
    return { x, z, pose: mix(POSE.stand, { ...POSE.knees, hy: 40, hlx: c.side * 4 - 14, hly: -44, hrx: c.side * 4 + 14, hry: -44, face: 1 }, ease(prog(on, 0, 200))), lift: 0, turn: 0 }
  }
  if (role === 'back') { const j = ease(prog(on, 0, 220)); return { x, z, pose: mix(POSE.jump, POSE.piggy, j), lift: 0.55 * j + Math.sin(prog(on, 0, 220) * Math.PI) * 0.2, turn: 1, front: true } }
  if (role === 'hug') return { x, z, pose: { ...POSE.stand, hlx: -c.side * 8 - 4, hly: -82, hrx: -c.side * 8 + 4, hry: -82, elbow: 0.8, fore: 0.5, face: 1, head: -c.side * 0.5 }, lift: Math.abs(Math.sin(on / 180)) * 0.08, turn: 0 }
  if (role === 'ruffle') return { x, z, pose: { ...POSE.ruffle, hrx: c.side * -22, hlx: c.side * 15, hry: -101 + Math.sin(on / 60) * 2, hly: -50 }, lift: 0, turn: 0 }
  return { x, z, pose: { ...POSE.pointAt, hrx: c.side * -40, hlx: c.side * 15, fr: c.side < 0 ? 1 : 0, fl: c.side < 0 ? 0 : 1 }, lift: 0, turn: 0 }
}
// the beaten keeper: down where he landed (face-down, or sat up with his hands on his knees), then up, back into the
// net for the ball, and out with it. at: { x, z, rot } where he finished. Returns { x, z, pose, lift, front, holds }
export function keeperBeaten(c, age, at) {
  const a = Math.max(0, age), side = Math.sign(at.rot ?? 1) || 1
  if (a < 1150) {
    if (c.keeper === 'sit') return { x: at.x, z: at.z, pose: mix({ ...POSE.dive, rot: at.rot ?? side * 1.4 }, POSE.sit, ease(prog(a, 250, 650))), lift: 0, front: true }
    // face-down: rolled over on to his front
    return { x: at.x, z: at.z, pose: { ...POSE.dive, rot: side * 1.52, hly: -118, hry: -118, tilt: -1 }, lift: 0, front: a < 300, holds: false }
  }
  if (a < 1550) return { x: at.x, z: at.z, pose: mix(c.keeper === 'sit' ? POSE.sit : { ...POSE.dive, rot: side * 1.52 }, POSE.hips, ease(prog(a, 1150, 1550))), lift: 0, front: true }
  // back into the net, slowly, his back to us now
  const ball = at.ball ?? { x: at.x * 0.6, z: 1.4 }
  const f = prog(a, 1550, 2300)
  const x = lerp(at.x, ball.x, ease(f)), z = lerp(at.z, ball.z - 0.4, ease(f))
  if (f < 1) return { x, z, pose: { ...runPose(a / 420, 0.35), tilt: -0.6, hlx: -11, hly: -57, hrx: 11, hry: -57, elbow: 1 }, lift: 0, front: false }
  return { x, z, pose: mix(POSE.stand, POSE.pick, Math.sin(clamp((a - 2300) / 500, 0, 1) * Math.PI)), lift: 0, front: false, holds: a > 2550 }
}
// their defenders once it's gone in: hands on hips, hands on knees, or a word with a teammate. Never a hand up.
export function defenderBeaten(i, age, base = POSE.stand) {
  const f = ease(prog(age, 150 + i * 120, 600 + i * 120))
  const to = i % 3 === 0 ? POSE.hips : i % 3 === 1 ? POSE.knees : { ...POSE.argue, head: i % 2 ? 0.8 : -0.8 }
  return mix(base, to, f)
}
// a keeper after a save: up, a roar, the fist pumping twice
export function keeperRoar(age, base = POSE.stand) {
  const f = ease(prog(age, 0, 280))
  if (age < 280) return mix(base, POSE.stand, f)
  const pump = Math.abs(Math.sin((age - 280) / 170))
  return age < 1300 ? { ...POSE.fist, hry: lerp(-86, -116, pump), hrx: 18, face: 1, tilt: 0.4 } : mix(POSE.fist, POSE.roar, ease(prog(age, 1300, 1550)))
}
// the striker who didn't score: 'save' hands on his head, 'miss' his head drops, 'tackle' arms out at the referee
export function strikerDenied(kind, age, base = POSE.stand) {
  const f = ease(prog(age, 120, 520))
  if (kind === 'save') return age < 2200 ? mix(base, POSE.headHands, f) : mix(POSE.headHands, POSE.drop, ease(prog(age, 2200, 2600)))
  if (kind === 'tackle') return mix(base, POSE.appeal, f)
  return mix(base, POSE.drop, f)
}

// ── Shooting: one model for every soccer game (the way FIFA does it) ────────
// Hold SHOOT and the power bar fills; let go and he strikes it. Aim with the stick (or the arrows) while you hold
// it: across the goal, and up for high, down for low. Too much power and it goes over the bar, and more power is
// always less accurate. The shot types, on their own inputs:
//   driven   SHOOT, held and let go: the normal strike, hard and rising a little
//   low      SHOOT with the stick held down: driven along the grass, skims and stays under the keeper's hands
//   finesse  CURL held and let go (the CHIP button held): side-footed, curled into the far corner, placed and
//            more accurate, less pace
//   chip     a quick tap of CHIP (or of SHOOT with the stick up): the dink over a keeper who's come off his line
//   volley   the ball in the air: struck first time, the hardest to keep down
//   header   in the air in the box: aimed with the stick, the power from how well he meets it
// The timed finish: a second tap of SHOOT as his foot meets the ball. Inside the small window (finishing and
// composure set it, and pressure shrinks it) it's a perfect strike; a bad one is worse than not trying.
// The body: across his body on his stronger foot, his weak foot, or flat out at speed, it's less accurate, and
// a defender on him costs more the less composed he is.
export const SHOT_TYPES = {
  driven: { label: 'DRIVEN', speed: [17, 30], acc: 1, over: 0.8, apex: 0.45, curve: 0 },
  low: { label: 'LOW DRIVEN', speed: [16, 27], acc: 0.9, over: 0.97, apex: 0.05, curve: 0, low: true },
  finesse: { label: 'FINESSE', speed: [13, 21], acc: 0.6, over: 0.9, apex: 0.7, curve: 1 },
  chip: { label: 'CHIP', speed: [8.5, 13], acc: 0.78, over: 0.74, apex: 3.2, curve: 0, chip: true },
  volley: { label: 'VOLLEY', speed: [20, 32], acc: 1.15, over: 0.7, apex: 0.25, curve: 0, dip: true },
  header: { label: 'HEADER', speed: [11, 20], acc: 1.05, over: 0.9, apex: -0.2, curve: 0 },
  pen: { label: 'PENALTY', speed: [17, 29], acc: 1.25, over: 0.84, apex: 0.15, curve: 0 },
}
const gaussOf = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
// The shot being lined up. v: the grade (finishing and composure); o: { fill (ms to full power), pressure (0-1: the
// situation: the minute, a shootout), windup (ms from the release to the strike) }
export function shooter(v, o = {}) {
  const tv = clamp((v - 1) / 10, 0, 1), fill = o.fill ?? 820, windup = o.windup ?? 190
  const k = {
    phase: 'idle', type: 'driven', at: 0, power: 0, aim: { x: 0, y: -0.2 }, relAt: 0, strikeAt: 0, tapAt: null, timed: 'none',
    fill, windup, tv, pressure: o.pressure ?? 0,
    // the perfect-strike window (ms either side of the strike), and the near-miss band round it
    green: lerp(24, 56, tv) * (1 - 0.3 * (o.pressure ?? 0) * (1 - tv)),
    press(t, type = 'driven') { if (k.phase !== 'idle') return false; k.phase = 'power'; k.type = type; k.at = t; k.power = 0; return true },
    // (the stick's circle spread to the goal's square: pushed into a corner, it's the corner)
    aimAt(x, y) { if (k.phase === 'done') return; const m = Math.min(1, Math.hypot(x, y)), c = Math.max(Math.abs(x), Math.abs(y)); if (c > 0.01) { x = (x / c) * m; y = (y / c) * m } k.aim.x = clamp(x, -1, 1); k.aim.y = clamp(y, -1, 1) },
    powerAt(t) { return k.phase === 'power' ? clamp((t - k.at) / fill, 0, 1) : k.power },
    release(t) { if (k.phase !== 'power') return false; k.power = clamp((t - k.at) / fill, 0, 1); k.phase = 'strike'; k.relAt = t; k.strikeAt = t + windup; return true },
    // a second tap: the timed finish
    tap(t) {
      if (k.phase !== 'strike' || k.tapAt != null) return false
      k.tapAt = t
      const e = Math.abs(t - k.strikeAt)
      k.timed = e <= k.green ? 'green' : e <= k.green * 2.6 ? 'ok' : 'red'
      return true
    },
    // held right to the end of the bar: it goes anyway, at full power
    tick(t) {
      if (k.phase === 'power' && t - k.at >= fill + 160) { k.power = 1; k.phase = 'strike'; k.relAt = t; k.strikeAt = t + windup * 0.6 }
      if (k.phase === 'strike' && t >= k.strikeAt + Math.max(70, k.green * 2.6)) { k.phase = 'done'; return true }
      return false
    },
    reset() { k.phase = 'idle'; k.power = 0; k.tapAt = null; k.timed = 'none' },
  }
  return k
}
// The shot itself, struck from (x, z) at the goal at z = 0. o: { v, r (the game's random), foot (1 right, -1 left),
// weak (on his weaker foot), speed (0-1 how fast he's going), pressure (0-1 a defender on him), dist override, y0 }
// Returns { type, from, to, T (ms in the air), curve, apex, power, timed, err, onTarget, over, wide, speed }
export function strikeOf(k, from, o = {}) {
  const D = SHOT_TYPES[k.type] ?? SHOT_TYPES.driven, r = o.r ?? Math.random
  const tv = clamp(((o.v ?? 6) - 1) / 10, 0, 1), p = k.power
  const dist = Math.hypot(from.x, from.z)
  // where he's aiming: across the goal, low to high (the inside of the posts and the bar)
  let ax = k.aim.x * (POST - 0.7), ay = lerp(0.3, BAR - 0.45, (k.aim.y + 1) / 2)
  if (D.low) ay = 0.22
  if (D.chip) ay = lerp(1.1, 2.0, (k.aim.y + 1) / 2)
  // how far off it goes: the grade, the range, the power, the type, the body, the pressure, the strike
  const foot = o.foot ?? 1
  const across = D.curve ? 0 : (foot > 0 ? clamp(-(ax - from.x * 0.3) / 3, 0, 1) : clamp((ax - from.x * 0.3) / 3, 0, 1))
  const body = 1 + across * 0.3 + (o.weak ? 0.38 : 0) + (o.speed ?? 0) * 0.32
  const press = 1 + (o.pressure ?? 0) * lerp(1.0, 0.35, tv) + k.pressure * lerp(0.5, 0.15, tv)
  const timed = k.timed === 'green' ? 0.3 : k.timed === 'ok' ? 0.82 : k.timed === 'red' ? 1.75 : 1
  const range = clamp(dist / 16, 0.45, 2)
  const pw = D.chip ? 0.7 + 0.6 * Math.abs(p - 0.5) : 0.42 + 1.3 * p * p
  const err = lerp(0.9, 0.3, tv) * range * D.acc * pw * body * press * timed
  let tx = ax + gaussOf(r) * err, ty = ay + gaussOf(r) * err * 0.55
  // too much on it: up and over (a chip with too much on it clears the bar, with too little drops short)
  let over = false
  if (p > D.over) { ty += (p - D.over) * (D.chip ? 5 : 7.5) * clamp(dist / 14, 0.6, 1.8); if (ty > BAR) over = true }
  if (k.timed === 'red' && r() < 0.35) ty += 0.9
  ty = Math.max(D.low ? 0.11 : 0.15, ty)
  const wide = Math.abs(tx) > POST - 0.12
  const speed = lerp(D.speed[0], D.speed[1], D.chip ? clamp(p, 0, 1) : p) * (k.timed === 'green' ? 1.06 : k.timed === 'red' ? 0.9 : 1) * (o.pace ?? lerp(0.84, 1.08, tv))
  const L = Math.hypot(tx - from.x, -from.z), T = (L / speed) * 1000 * (D.chip ? 1.15 : 1)
  // the curl: out and back in, toward the far post (the side he's aiming)
  const curve = D.curve ? -(Math.sign(tx - from.x) || 1) * lerp(0.9, 2.1, clamp(L / 22, 0, 1)) : 0
  const apex = D.chip ? lerp(2.2, 3.6, clamp(L / 18, 0, 1)) + (p - 0.5) : D.apex * clamp(L / 16, 0.4, 1.4)
  return { type: k.type, label: D.label, from: { x: from.x, z: from.z, y: o.y0 ?? 0.11 }, to: { x: tx, y: ty }, T, curve, apex, power: p, timed: k.timed, err, over, wide, onTarget: !over && !wide && ty < BAR - 0.11, speed, low: !!D.low, chip: !!D.chip, dip: !!D.dip }
}
// The ball in flight, ms after the strike: to the goal line at f = 1 and on through it (the game takes it from there)
export function shotAt(s, ms) {
  const f = ms / s.T, g = clamp(f, 0, 1.4)
  const x = lerp(s.from.x, s.to.x, g) + s.curve * Math.sin(clamp(g, 0, 1) * Math.PI) * (g > 1 ? 0 : 1)
  const z = lerp(s.from.z, 0, g)
  let y
  if (s.low) { const b = Math.abs(Math.sin(clamp(g, 0, 1) * Math.PI * 1.5)); y = 0.11 + b * 0.22 + lerp(0, s.to.y - 0.11, g) }
  else if (s.dip) y = lerp(s.from.y, s.to.y, g) + s.apex * Math.sin(clamp(g, 0, 1) * Math.PI) + (g < 1 ? (1 - g) * g * 0.8 : 0)
  else y = lerp(s.from.y, s.to.y, g) + s.apex * Math.sin(clamp(g, 0, 1) * Math.PI)
  return { x, y: Math.max(0.11, y), z, f, spin: g * 16 }
}
// Does the keeper get to it? K: { x, z, reach (m he can cover, standing to full stretch), react (ms), read (-1..1:
// the side he's leaning), up (how high he gets: a standing keeper's 2.4 m, one on the floor's 0.5) }
// Returns { saved, held (caught, not parried), x, y, f } where the ball crosses him
export function keeperSave(s, K, r = Math.random) {
  const fk = clamp((K.z - s.from.z) / (0 - s.from.z), 0, 1)
  const at = shotAt(s, fk * s.T)
  const time = Math.max(0, fk * s.T - (K.react ?? 220)) / 1000
  const dx = at.x - K.x, side = Math.sign(dx) || 1
  const lean = (K.read ?? 0) * side   // + he's already going that way
  const cover = (K.reach ?? 1.5) + Math.min(time, 0.55) * (K.dive ?? 4.4) + lean * 0.55
  const up = K.up ?? 2.45
  const reachUp = up - Math.abs(dx) * 0.18
  const got = Math.abs(dx) <= cover + 0.15 && at.y <= reachUp
  if (!got) return { saved: false, x: at.x, y: at.y, f: fk }
  // a hard one at full stretch is palmed away; one at him, or a soft one, he holds
  const stretch = Math.abs(dx) / Math.max(0.5, cover)
  const held = s.speed < 14 || stretch < 0.35 || r() < 0.35
  return { saved: true, held, x: at.x, y: at.y, f: fk, stretch }
}
// The shot HUD: the power bar (its over-the-bar end marked), the shot type, and the timed-finish marker after the
// release. Ink panels, chalk, Bebas. o: { y (the bar's middle), t (now) }
export function shotHud(ctx, view, k, o = {}) {
  const t = o.t ?? 0
  if (!k || k.phase === 'idle' || (k.phase === 'done' && t - k.strikeAt > 600)) return
  const w = 150, h = 9, x0 = view.w / 2 - w / 2, y = o.y ?? view.h - 186
  const D = SHOT_TYPES[k.type] ?? SHOT_TYPES.driven, p = k.powerAt(t)
  ctx.fillStyle = 'rgba(6,8,10,.8)'; rr(ctx, x0 - 8, y - 20, w + 16, h + 28, 4); ctx.fill()
  text(ctx, D.label, x0, y - 10, { font: LABEL, size: 12, align: 'left', track: 1.2, color: '#c6c7cb' })
  // the over-the-bar end
  const ov = x0 + w * D.over
  ctx.fillStyle = '#26282c'; ctx.fillRect(x0, y, w, h)
  ctx.save(); ctx.beginPath(); ctx.rect(ov, y, x0 + w - ov, h); ctx.clip()
  ctx.strokeStyle = 'rgba(242,242,238,.28)'; ctx.lineWidth = 1.2
  for (let i = -2; i < 12; i++) { ctx.beginPath(); ctx.moveTo(ov + i * 5, y + h); ctx.lineTo(ov + i * 5 + h, y); ctx.stroke() }
  ctx.restore()
  ctx.fillStyle = p > D.over ? '#ff5a48' : '#f2f2ee'; ctx.fillRect(x0, y, w * p, h)
  ctx.strokeStyle = 'rgba(242,242,238,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y + 0.5, w - 1, h - 1)
  // the timed finish: a ring closing on the strike, the window in chalk
  if (k.phase === 'strike' || (k.phase === 'done' && t - k.strikeAt < 500)) {
    const cx = x0 + w - 6, cy = y - 10, left = k.strikeAt - t
    const f = clamp(1 - left / k.windup, 0, 1.4)
    ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.2832); ctx.stroke()
    if (k.phase === 'strike' && f < 1.2) { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(cx, cy, 4 + (1 - Math.min(1, f)) * 12, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1 }
    const word = k.timed === 'green' ? 'PERFECT' : k.timed === 'ok' ? 'GOOD' : k.timed === 'red' ? 'MISTIMED' : null
    if (word) text(ctx, word, cx - 12, cy, { font: LABEL, size: 12, align: 'right', track: 1, color: k.timed === 'green' ? '#f7cf55' : k.timed === 'red' ? '#ff8a7a' : '#f2f2ee' })
  }
}
// where he's aiming: a small ring on the goal face (z = 0)
export function aimMark(ctx, C, ax, ay, o = {}) {
  const p = P(C, ax, ay, 0)
  if (!p.ok) return
  const r = Math.max(4, 0.24 * p.s), a = o.alpha ?? 1
  ctx.globalAlpha = a
  ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.stroke()
  ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832)
  ctx.moveTo(p.x - r * 1.7, p.y); ctx.lineTo(p.x - r * 0.55, p.y); ctx.moveTo(p.x + r * 0.55, p.y); ctx.lineTo(p.x + r * 1.7, p.y)
  ctx.moveTo(p.x, p.y - r * 1.7); ctx.lineTo(p.x, p.y - r * 0.55); ctx.moveTo(p.x, p.y + r * 0.55); ctx.lineTo(p.x, p.y + r * 1.7); ctx.stroke()
  ctx.globalAlpha = 1
}
// where on the goal face a stick (or arrow keys) points: x across (-1 the left post), y up (-1 low, 1 high)
export const aimTo = (sx, sy) => ({ x: (POST - 0.7) * clamp(sx, -1, 1), y: lerp(0.3, BAR - 0.45, (clamp(sy, -1, 1) + 1) / 2) })

// ── The moments' words, in the scene ────────────────────────────────────────
// the scoreboard's line: the score and the minute when there's a game on, or the club name in a drill
export function boardWords(g) {
  const s = g.sit
  if (s && s.us) return `${s.us} ${s.mine}-${s.opp} ${s.them}${s.clockText ? `  ${s.clockText}` : ''}`
  return 'BUILD-A-PLAYER'
}
// a flash bulb going off in the stand: a few white dots, twinkling, after a goal. Cheap: none under the light look
export function flashes(ctx, C, view, age, seed = 7) {
  if (lightMode() || view.empty || age < 0 || age > 2200) return   // (an empty ground: nobody's phone)
  let s = seed
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 40; i++) {
    const X = (R() - 0.5) * 50, Y = 2 + R() * 26, Z = 8 + (Y / 30) * 28, on = R() * 2200
    if (Math.abs(age - on) > 60) continue
    const p = P(C, X, Y, Z)
    if (p.ok) ctx.fillRect(p.x - 1, p.y - 1, 2, 2)
  }
}
// the in-scene line at the bottom (the pads cover the rest): "WAIT FOR THE WHISTLE" style comes from hud.prompt
export const lerpAng = lerp
export { LABEL }

// ── The controls every free-control soccer game shares ──────────────────────
// A thumbstick on the left half of a phone screen (it starts where the thumb lands), two buttons on the right; on a
// computer the arrows (or WASD), SPACE for S and E for P (the host sends them as 'key' / 'keyup' with zones L R U D S P).
//   padCtl()                          the state
//   padInput(c, a, vh, on)            feed it the game's input; on: { down(id), up(id) } for the buttons 'S' and 'P'
//   padStick(c) → { x, y }            where the stick (or the arrows) points, -1..1, y up
//   drawPads(ctx, view, c, labels, live)   labels: { S: 'SHOOT', P: 'CHIP', keyS, keyP } (P: null for one button)
const PADS = new Map()
export function padLayout(h) {
  let c = PADS.get(h)
  if (!c) { c = { stick: { x: 82, y: h - 96, R: 44 }, S: { x: 360 - 66, y: h - 92, r: 42 }, P: { x: 360 - 162, y: h - 62, r: 28 } }; PADS.set(h, c) }
  return c
}
export function padCtl() { return { tid: null, ox: 0, oy: 0, tx: 0, ty: 0, ax: 0, ay: 0, ext: false, keys: { L: 0, R: 0, U: 0, D: 0 }, sid: null, pid: null, out: { x: 0, y: 0 } } }
export function padInput(c, a, vh, on = {}) {
  if (a.kind === 'stick') { c.ax = clamp(a.x, -1, 1); c.ay = clamp(a.y, -1, 1); c.ext = true; return }
  if (a.kind === 'key') { if (a.zone === 'S' || a.zone === 'P') { c[a.zone === 'S' ? 'sid' : 'pid'] = 'key'; on.down?.(a.zone) } else if (a.zone in c.keys) c.keys[a.zone] = 1; return }
  if (a.kind === 'keyup') { if (a.zone === 'S' || a.zone === 'P') { c[a.zone === 'S' ? 'sid' : 'pid'] = null; on.up?.(a.zone) } else if (a.zone in c.keys) c.keys[a.zone] = 0; return }
  const id = a.id ?? 0, B = padLayout(vh)
  if (a.kind === 'down') {
    if (on.hasP !== false && Math.hypot(a.x - B.P.x, a.y - B.P.y) < B.P.r + 12) { c.pid = id; on.down?.('P') }
    else if (a.x < 180) { c.tid = id; c.ox = a.x; c.oy = a.y; c.tx = 0; c.ty = 0 }
    else { c.sid = id; on.down?.('S') }
  } else if (a.kind === 'move') {
    if (id === c.tid) { const R = B.stick.R; c.tx = clamp((a.x - c.ox) / R, -1.4, 1.4); c.ty = clamp(-(a.y - c.oy) / R, -1.4, 1.4); const m = Math.hypot(c.tx, c.ty); if (m > 1) { c.tx /= m; c.ty /= m } }
  } else if (a.kind === 'up') {
    if (id === c.tid) { c.tid = null; c.tx = 0; c.ty = 0 }
    else if (id === c.pid) { c.pid = null; on.up?.('P') }
    else if (id === c.sid) { c.sid = null; on.up?.('S') }
  }
}
export function padStick(c) {
  const o = c.out
  if (c.tid != null) { o.x = c.tx; o.y = c.ty } else if (c.ext) { o.x = c.ax; o.y = c.ay }
  else { o.x = c.keys.R - c.keys.L; o.y = c.keys.U - c.keys.D; const m = Math.hypot(o.x, o.y); if (m > 1) { o.x /= m; o.y /= m } }
  return o
}
export function drawPads(ctx, view, c, labels = {}, live = true) {
  const B = padLayout(view.h), s = c.out
  if (view.keys) {
    const y = view.h - 22
    ctx.fillStyle = 'rgba(6,8,10,.78)'; rr(ctx, 8, y - 15, view.w - 16, 30, 4); ctx.fill()
    keyCapS(ctx, 34, y, 'ARROWS'); text(ctx, labels.move ?? 'MOVE', 60, y + 1, { size: 13, align: 'left', track: 1 })
    keyCapS(ctx, 140, y, 'SPACE'); text(ctx, labels.S ?? 'SHOOT', 178, y + 1, { size: 13, align: 'left', track: 1 })
    if (labels.P) { keyCapS(ctx, 248, y, 'E'); text(ctx, labels.P, 264, y + 1, { size: 13, align: 'left', track: 1 }) }
    return
  }
  const ax = c.tid != null ? c.ox : B.stick.x, ay = c.tid != null ? c.oy : B.stick.y, R = B.stick.R
  ctx.globalAlpha = live ? 1 : 0.4
  ctx.fillStyle = 'rgba(6,8,10,.45)'; ctx.beginPath(); ctx.arc(ax, ay, R + 6, 0, 6.2832); ctx.fill()
  ctx.strokeStyle = 'rgba(242,242,238,.28)'; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = c.tid != null || Math.hypot(s.x, s.y) > 0.1 ? '#f2f2ee' : 'rgba(242,242,238,.7)'
  ctx.beginPath(); ctx.arc(ax + s.x * R, ay - s.y * R, 19, 0, 6.2832); ctx.fill()
  for (const [id, B2, size] of [['S', B.S, 18], ['P', B.P, 14]]) {
    if (!labels[id]) continue
    const lit = (id === 'S' ? c.sid : c.pid) != null && live
    ctx.fillStyle = lit ? '#f2f2ee' : 'rgba(26,27,30,.92)'; ctx.beginPath(); ctx.arc(B2.x, B2.y, B2.r, 0, 6.2832); ctx.fill()
    ctx.strokeStyle = 'rgba(242,242,238,.25)'; ctx.lineWidth = 2; ctx.stroke()
    text(ctx, labels[id], B2.x, B2.y + 1, { font: DISPLAY, size: labels[id].length > 6 ? size - 4 : size, color: lit ? '#0b0c0e' : '#f2f2ee' })
  }
  ctx.globalAlpha = 1
}
