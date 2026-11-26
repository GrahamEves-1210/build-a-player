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
//  moments  celebration(seed, o) → plan (o.sit: the score and the minute pick how big it is: goalMood) ·
//           plan · scorerAt(plan, age) · mateAt(plan, i, age) · keeperBeaten(plan, age, at)
//           defenderBeaten(i, age) · keeperRoar(age) · strikerDenied(kind, age) · CELEB_MS · celebMs() · skipOutro(g)
//           keeperShot(t, o) (a keeper on his line and a shot: all of it) · heldBall(kp, age) · parried(p, age, z) ·
//           keeperDive(ms, K, { hx, hy, at }) · keeperLanded(K, o) · keeperUp(age, from) · KEEPER_DOWN
//  shooting shooter(v, o) → the shot in progress (power bar, aim, the timed finish) · strikeOf(k, from, o) → a shot
//           shotAt(shot, t) → the ball in flight · keeperSave(shot, keeper, o) · shotHud(ctx, view, k, o)
//           aimMark(ctx, C, x, y, o) · aimTo(sx, sy) · SHOT_TYPES
//           draw the shot: stroke() · strokeDown/strokeMove/strokeUp · readStroke(st, C, o) → the shot's read ·
//           drawnShot(k, read, t, windup) · strokeTrail(ctx, st, t, o) · ghostStroke(...) · onGoal(C, x, y) · DRAW
//  controls padCtl() · padInput(c, a, vh, { down, up }) · padStick(c) · drawPads(ctx, view, c, labels, live) · padLayout(h)
//
// Real sizes: the goal 7.32 by 2.44, the box 16.5 deep and 40.32 wide, the six-yard box 5.5 by 18.32, the spot at 11,
// the arc 9.15 from it. A man is 1.8 m. The mower's stripes are 5.5 m, so the six, the spot and the box all sit on one.
import { clamp, lerp, prog, text, layer, warmSkin, lightMode, faceLook, DISPLAY, LABEL, rr, keyCap as keyCapS } from './kit.js'
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
//   hlx hly / hrx hry the hands · elbow 0 hanging, 1 out wide (hands on the hips, on the head); el / er added to it for
//   one arm · fore 0-1 how much the
//   elbows bend toward or away from the camera (a runner's arms: foreshortened, not out to the sides)
//   rot the whole man turned about his hips (a dive, a slide, a flip) · head the head turned (-1..1) · tilt up + / down -
//   face 0 set, 1 a roar, 2 gutted, 3 a finger on the lips · fl / fr a finger out of that hand (pointing)
const DEF = { hy: 53, hx: 0, lean: 0, bow: 0, lx: -8, ly: 0, rx: 8, ry: 0, lk: 0, rk: 0, hlx: -16.5, hly: -47.5, hrx: 16.5, hry: -47.5, elbow: 0, el: 0, er: 0, fore: 0, rot: 0, head: 0, tilt: 0, face: 0, fl: 0, fr: 0, hip: 0, zl: 0, zr: 0, kn: 0, palm: 0 }
const pz = o => ({ ...DEF, ...o })
export const mix = (a, b, f) => {
  const o = {}
  for (const k in DEF) { const x = a[k] ?? DEF[k], y = b[k] ?? DEF[k]; o[k] = k === 'face' ? (f < 0.5 ? x : y) : x + (y - x) * f }
  return o
}
export const POSE = {
  // stood: his weight on his right leg (that hip up, the shoulders the other way), the left knee easy, the arms
  // hanging loose with a little bend at the elbow and the hands turned in at his thighs
  stand: pz({ hx: 0.6, hip: 0.08, lean: -0.02, lx: -10, ly: -0.6, lk: 0.34, rx: 5.6, hlx: -15.0, hly: -45.8, hrx: 13.8, hry: -45.4, el: 0, er: 0, fore: 0.95, head: 0.15 }),
  // a penalty taker waiting on the whistle: loose, the shoulders down, his weight on his right leg, the arms hanging
  // easy a touch in front of him, his eyes on the keeper
  wait: pz({ hx: 0.8, hip: 0.1, lean: -0.02, lx: -11.5, ly: -0.3, lk: 0.42, rx: 4.6, hlx: -15.6, hly: -45.6, hrx: 13.9, hry: -45.2, el: 0, er: 0, fore: 0.95, tilt: 0.12, head: 0.35 }),
  // on his toes, knees soft, arms hanging loose just off his sides
  ready: pz({ hy: 50, bow: 0.1, lx: -11, rx: 11, lk: 0.2, rk: 0.2, hlx: -16.2, hly: -48, hrx: 16.2, hry: -48, el: 0, er: 0, fore: 0.95 }),
  // a keeper set: feet a bit wider than his shoulders, knees bent, his weight forward on the balls of his feet, the
  // hands out in front of him at his hips, palms to the ball, elbows in and soft
  set: pz({ hy: 45, bow: 0.2, lx: -14, rx: 14, lk: 0.42, rk: 0.42, hlx: -15.5, hly: -53, hrx: 15.5, hry: -53, elbow: 0, fore: 0.9, tilt: 0.12, palm: 1 }),
  hips: pz({ lx: -9, rx: 9, hlx: -13, hly: -56, hrx: 13, hry: -56, elbow: 0.3, fore: 0.75 }),
  knees: pz({ hy: 41, bow: 0.5, lx: -11, rx: 11, lk: 0.5, rk: 0.5, hlx: -10, hly: -32, hrx: 10, hry: -32, elbow: 0.1, tilt: -0.6, fore: 0.6 }),
  headHands: pz({ lx: -8, rx: 8, hlx: -5, hly: -103, hrx: 5, hry: -103, elbow: 0.45, tilt: 0.3, fore: 0.55 }),
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
  badge: pz({ hlx: 3, hly: -89, hrx: 16.5, hry: -48, elbow: 0.4, tilt: -0.4, fore: 0.6 }),
  shush: pz({ hlx: -19, hly: -52, hrx: 3, hry: -84, fr: 1, er: 0.9, face: 3 }),
  // up for a header, or off the ground in a celebration: one knee driven up, the other leg hanging, the arms out and
  // down for balance (no elbows winged out)
  jump: pz({ hy: 52, bow: 0.06, lx: -6, ly: -3, lk: 0.1, rx: 5, ry: -17, rk: 1, hlx: -27, hly: -51, hrx: 26, hry: -54, elbow: 0, fore: 0.2, tilt: 0.3 }),
  tuck: pz({ hy: 50, lx: -8, ly: -36, rx: 8, ry: -36, lk: 1, rk: 1, hlx: -12, hly: -52, hrx: 12, hry: -52, elbow: 0, fore: 0.6 }),
  dive: pz({ lx: -6, rx: 6, ry: -4, hlx: -7, hly: -126, hrx: 7, hry: -126 }),
  down: pz({ lx: -7, rx: 7, hlx: -10, hly: -112, hrx: 10, hry: -112 }),
  smother: pz({ hy: 22, bow: 0.3, lx: -22, ly: -2, rx: 22, ry: -2, lk: 1, rk: 1, hlx: -34, hly: -30, hrx: 34, hry: -30 }),
  // sat down on the grass, knees up, hands on his knees
  sit: pz({ hy: 11, lx: -13, ly: 5, rx: 13, ry: 5, lk: 1, rk: 1, hlx: -12, hly: -22, hrx: 12, hry: -22, elbow: 0.2, tilt: -0.7, face: 2, fore: 0.6 }),
  // bent into the net for the ball
  pick: pz({ hy: 48, bow: 0.62, lx: -10, rx: 10, lk: 0.3, rk: 0.3, hlx: -5, hly: -26, hrx: 5, hry: -26 }),
  argue: pz({ lx: -10, rx: 10, hlx: -26, hly: -60, hrx: 26, hry: -60, elbow: 0.1, fore: 0.75, head: -0.8, face: 2 }),
  drop: pz({ bow: 0.12, hlx: -13, hly: -56, hrx: 13, hry: -56, elbow: 0.3, tilt: -1, face: 2, fore: 0.75 }),
  // up on a teammate's back: legs round his waist, arms round his shoulders
  piggy: pz({ hy: 40, lx: -17, ly: -12, rx: 17, ry: -12, lk: 1, rk: 1, hlx: -13, hly: -60, hrx: 18, hry: -114, elbow: 0.4, face: 1, fore: 0.5 }),
  ruffle: pz({ hrx: 22, hry: -101, elbow: 0.2, face: 1 }),
  pointAt: pz({ hrx: 40, hry: -86, fr: 1, face: 1 }),
  appeal: pz({ lx: -10, rx: 10, hlx: -29, hly: -64, hrx: 29, hry: -64, elbow: 0.1, fore: 0.75, face: 2, tilt: 0.2 }),
  clip: pz({ hlx: -6, hly: -66, hrx: 7, hry: -68, elbow: 0.3, fore: 0.7}),   // a coach with his clipboard
  // the end of a knee slide: still on his knees, leaning back, both fists up by his head, roaring at the sky
  slideRoar: pz({ hy: 26, bow: 0.18, lx: -14, ly: 3, rx: 14, ry: 3, lk: -1, rk: -1, hlx: -23, hly: -92, hrx: 23, hry: -92, elbow: 0.35, fore: 0.4, face: 1, tilt: 1 }),
  // the badge: both hands take the shirt by the crest and pull it out, then up to his lips
  grab: pz({ hlx: 2.5, hly: -77, hrx: 9, hry: -75, elbow: 0.45, fore: 0.75, tilt: -0.25, face: 1 }),
  kiss: pz({ hlx: 1, hly: -84.5, hrx: 5.5, hry: -83, elbow: 0.5, fore: 0.75, tilt: -0.55, head: 0.15, face: 3 }),
  // feet set wide, a little crouch, both fists dragged down to his chest, elbows out: "come on!"
  flex: pz({ hy: 48, bow: 0.12, lx: -14, rx: 14, lk: 0.35, rk: 0.35, hlx: -11, hly: -68, hrx: 11, hry: -68, elbow: 0.35, fore: 0.7, face: 1, tilt: 0.45 }),
  // a hand cupped to his ear for the away end
  ear: pz({ lx: -9, rx: 9, hlx: -36, hly: -78, hrx: 10.5, hry: -95, elbow: 0.2, er: 0.8, face: 1, tilt: 0.3, head: -0.3 }),
}
// Running: a real stride. Each foot is down under him for the first part of its cycle (the knee soft as he takes his
// weight), then the heel flicks up behind him toward his backside (from behind, you see the sole), the knee drives
// through and the foot reaches out for the grass again. The hips drop over the planted foot and rise in the flight,
// sway a touch over each foot; the arms pump opposite the legs, elbows bent at a right angle: the one going back
// comes out past his side with the elbow up, the one going forward drives up to his chest (from behind, out of sight).
// phase 0-1 through a stride (the left foot lands at 0); k 0-1 how hard.
// o: { lean (a bank into a turn), arms: 'pump' | 'out' | 'fist' | 'wide' }
const smooth = f => { f = clamp(f, 0, 1); return f * f * (3 - 2 * f) }
const STANCE = 0.36
function strideLeg(u, k) {
  u = ((u % 1) + 1) % 1
  if (u < STANCE) { const f = u / STANCE; return { y: 0, kn: 0.12 + 0.18 * Math.sin(f * Math.PI) * k, x: 0 } }
  const f = (u - STANCE) / (1 - STANCE)
  // the foot: up fast behind him, peaking a third of the way through the swing, then down and out in front
  const rise = Math.sin(Math.PI * Math.pow(f, 0.62))
  const y = -rise * (10 + 30 * k) * k
  // the knee: folded behind (heel up), then driven through, then nearly straight as the foot reaches the grass
  const kn = f < 0.42 ? -1 * smooth(f / 0.16) * Math.min(1, 0.4 + k) : f < 0.8 ? lerp(-1 * Math.min(1, 0.4 + k), 0.85 * k, smooth((f - 0.42) / 0.3)) : lerp(0.85 * k, 0.12, smooth((f - 0.8) / 0.2))
  // the swinging foot comes in under him, toward the line he's running on
  return { y, kn, x: Math.sin(f * Math.PI) * 2.2 }
}
export function runPose(phase, k = 1, base = null, o = null) {
  const out = { ...DEF, ...(base ?? null) }
  const L = strideLeg(phase, k), R = strideLeg(phase + 0.5, k)
  const c = Math.cos((phase - STANCE / 2) * Math.PI * 2)      // +1 over the left foot, -1 over the right
  out.lx = -5.6 + L.x; out.rx = 5.6 - R.x; out.ly = L.y; out.ry = R.y; out.lk = L.kn; out.rk = R.kn
  out.hy = 52.4 - 2.6 * k * Math.cos((phase - STANCE / 2) * Math.PI * 4)
  out.bow = 0.1 * k
  out.lean = -c * 0.035 * k + (o?.lean ?? 0)
  out.hx = -c * 1.6 * k + (o?.lean ?? 0) * -10
  out.tilt = -0.15 * k
  const arms = o?.arms ?? 'pump'
  // the left arm forward while the right leg comes through (over the left foot), and back as the left leg does
  const fL = (1 + c) / 2, fR = 1 - fL, a = Math.min(1, 0.35 + k)
  // forward: the hand up by the chest and in; back: the hand by the hip, out past his side, the elbow up behind him
  // (both arms swing toward and away from the camera, so they're foreshortened: the one coming back is a short bent
  // arm by his side with the elbow out behind him, the one going forward mostly hidden by his body)
  const arm = (f, sd) => ({ x: sd * lerp(lerp(15, 14, a), lerp(15, 6.5, a), f), y: lerp(lerp(-52, -61, a), lerp(-58, -73, a), f), el: (1 - f) * 0.12 * a })
  const AL = arm(fL, -1), AR = arm(fR, 1)
  out.hlx = AL.x; out.hly = AL.y; out.hrx = AR.x; out.hry = AR.y; out.el = AL.el; out.er = AR.el
  out.elbow = 0; out.fore = lerp(0.6, 0.9, a)
  const s = Math.sin(phase * Math.PI * 2)
  if (arms === 'out') { out.hlx = -46; out.hly = -86 + s * 3; out.hrx = 46; out.hry = -86 - s * 3; out.elbow = 0; out.el = out.er = 0; out.fore = 0; out.face = 1; out.tilt = 0.2 }
  if (arms === 'wide') { out.hlx = -42; out.hly = -94; out.hrx = 42; out.hry = -94; out.elbow = 0; out.el = out.er = 0; out.fore = 0; out.face = 1; out.tilt = 0.3 }
  if (arms === 'fist') { const pump = Math.abs(Math.sin(phase * Math.PI)); out.hrx = 15; out.hry = lerp(-96, -118, pump); out.elbow = 0.3; out.er = 0; out.fore = 0.3; out.face = 1; out.tilt = 0.3 }
  return out
}
// on the ball: a shorter, quicker-looking stride, the head down over it, the arms out a little for balance
export function dribblePose(phase, k = 1, o = null) {
  const p = runPose(phase, k * 0.72, null, o)
  p.bow = 0.14; p.tilt = -0.5
  p.hlx -= 5; p.hrx += 5; p.hly += 2; p.hry += 2; p.el += 0.15; p.er += 0.15
  return p
}
// The strike, from behind him: f 0-1 from the last stride to the follow-through; the foot meets the ball at about 0.47
// (a game's shot goes at 0.45). foot: 1 the right foot, -1 the left. The last stride is a long one, the standing foot
// planted beside the ball, the body leaning away over it; the kicking leg drawn back with the heel high, the far arm
// out wide and up for balance; then the leg whips through the ball, the head still down over it, and on up and across
// him, his weight up on the toes of the standing foot. o: { high (a chip, a volley: the leg finishes higher) }
const KICK = [
  // [f, pose for the right foot]
  [0, { hy: 52, bow: 0.1, lx: -5, ly: -9, lk: 0.6, rx: 5.5, ry: 0, rk: 0.2, hlx: -17, hly: -56, hrx: 15, hry: -52, el: 0, er: 0.4, fore: 0.7, lean: 0.02, tilt: -0.2 }],
  [0.2, { hy: 49, bow: 0.12, lx: -10, ly: -2, lk: 0.35, rx: 6, ry: -14, rk: -0.9, hlx: -27, hly: -60, hrx: 16, hry: -50, el: 0.1, er: 0, fore: 0.5, lean: -0.08, tilt: -0.35 }],
  [0.4, { hy: 48, bow: 0.13, lx: -10, ly: 0, lk: 0.3, rx: 10, ry: -40, rk: -1, hlx: -43, hly: -68, hrx: 17, hry: -50, el: 0, er: 0, fore: 0.3, lean: -0.17, tilt: -0.55 }],
  [0.47, { hy: 50, bow: 0.14, lx: -10, ly: 0, lk: 0.25, rx: 3, ry: -5, rk: 0.15, hlx: -44, hly: -66, hrx: 15, hry: -52, el: 0, er: 0, fore: 0.3, lean: -0.11, tilt: -0.65, zr: 0.3 }],
  [0.7, { hy: 53, bow: 0.18, lx: -9, ly: -2, lk: 0.1, rx: -1, ry: -34, rk: 1, hlx: -41, hly: -63, hrx: 8, hry: -57, el: 0, er: 0, fore: 0.6, lean: 0.04, tilt: -0.25, zr: 0.92 }],
  [1, { hy: 53.5, bow: 0.16, lx: -8.5, ly: -3, lk: 0.15, rx: -2, ry: -26, rk: 0.85, hlx: -37, hly: -60, hrx: 10, hry: -55, el: 0.1, er: 0, fore: 0.6, lean: 0.08, tilt: 0, zr: 0.75 }],
]
const HIGH = { 0.7: { ry: -50, lean: 0.12, bow: 0.1, tilt: 0.1 }, 1: { ry: -42, lean: 0.14, bow: 0.08, tilt: 0.2 } }
export function kickPose(f, foot = 1, o = null) {
  f = clamp(f, 0, 1)
  let i = 0; while (i < KICK.length - 2 && f > KICK[i + 1][0]) i++
  const [f0, a0] = KICK[i], [f1, a1] = KICK[i + 1]
  const A = o?.high && HIGH[f0] ? { ...a0, ...HIGH[f0] } : a0, B = o?.high && HIGH[f1] ? { ...a1, ...HIGH[f1] } : a1
  const p = mix({ ...DEF, ...A }, { ...DEF, ...B }, smooth((f - f0) / (f1 - f0)))
  if (foot > 0) return p
  // the left foot: the same strike, mirrored
  return { ...p, lx: -p.rx, ly: p.ry, lk: p.rk, rx: -p.lx, ry: p.ly, rk: p.lk, hlx: -p.hrx, hly: p.hry, hrx: -p.hlx, hry: p.hly, el: p.er, er: p.el, lean: -p.lean, hx: -p.hx, zl: p.zr, zr: p.zl }
}

const TH = 27, SH = 26, UA = 19, FA = 17.8, TORSO = 33, HR = 7.4, SHW = 11.3, HIPW = 3.9
const OL = 1.4   // the ink round every part, in rig units
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
const CUTS = ['crop', 'fade', 'curly', 'crop', 'fade', 'crop', 'bun', 'buzz', 'crop', 'curly']   // ('long' only when a look asks for it)
const hashOf = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h }
function hairFor(L) {
  const h = hashOf(`${L.number ?? ''}|${L.skin ?? ''}|${L.name ?? ''}`)
  const n = parseInt(String(warmSkin(L.skin ?? '#8d5a3b')).slice(1, 7), 16), lum = (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255
  const col = L.hairColor ?? (lum < 0.45 ? HAIRS_DARK[h % 3] : HAIRS[(h >> 2) % (lum > 0.62 ? 6 : 4)])
  let cut = L.cut ?? CUTS[(h >> 3) % CUTS.length]
  if (cut === 'curly' && lum > 0.6 && !L.cut) cut = 'crop'
  return { col, cut }
}
// Ink, then colour: one outline round the whole of a part and none inside it, so a leg is one shape (thigh, knee, calf,
// sock and boot) and not a string of beads. A part: [ax, ay, ra, bx, by, rb].
function inkT(x, list, grow = OL) { x.fillStyle = INK; x.beginPath(); for (const l of list) taper(x, l[0], l[1], l[2] + grow, l[3], l[4], l[5] + grow); x.fill() }
// the colour: its shade first, then the lit side, inset up and to the left (the light's over his left shoulder)
const lums = new Map()
function lumOf(c) {
  let v = lums.get(c)
  if (v != null) return v
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(String(c))
  v = m ? (0.3 * +m[1] + 0.59 * +m[2] + 0.11 * +m[3]) / 255 : lum(c)
  if (lums.size > 300) lums.clear()
  lums.set(c, v)
  return v
}
const DARK = 0.2
function fillT(x, list, col, shade = true) {
  if (shade && lumOf(col) < DARK) {
    // a dark kit: a cool edge of light down each part's lit side, so a black leg over black shorts (or one dark leg
    // over the other) is still two shapes against the ink, the way a broadcast light catches a dark shirt
    x.fillStyle = tone(col, 1.3); x.beginPath(); for (const l of list) taper(x, l[0], l[1], l[2], l[3], l[4], l[5]); x.fill()
    x.fillStyle = col; x.beginPath(); for (const l of list) taper(x, l[0] + 0.4, l[1] + 0.25, Math.max(0.4, l[2] - 0.6), l[3] + 0.4, l[4] + 0.25, Math.max(0.4, l[5] - 0.6)); x.fill()
    x.fillStyle = tone(col, 1.1); x.beginPath(); for (const l of list) taper(x, l[0] - l[2] * 0.2, l[1] - l[2] * 0.1, l[2] * 0.45, l[3] - l[5] * 0.2, l[4] - l[5] * 0.1, l[5] * 0.45); x.fill()
    return
  }
  x.fillStyle = shade ? tone(col, 0.76) : col; x.beginPath(); for (const l of list) taper(x, l[0], l[1], l[2], l[3], l[4], l[5]); x.fill()
  if (!shade) return
  x.fillStyle = col; x.beginPath(); for (const l of list) taper(x, l[0] - l[2] * 0.26, l[1] - l[2] * 0.12, l[2] * 0.72, l[3] - l[5] * 0.26, l[4] - l[5] * 0.12, l[5] * 0.72); x.fill()
}
// a band across a limb at a point along it (a sock's top, a sleeve's cuff, the shorts' hem)
function band(x, ax, ay, bx, by, at, r, col, w) {
  const dx = bx - ax, dy = by - ay, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, px = lerp(ax, bx, at), py = lerp(ay, by, at)
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'butt'
  x.beginPath(); x.moveTo(px + nx * r, py + ny * r); x.lineTo(px - nx * r, py - ny * r); x.stroke(); x.lineCap = 'round'
}
// ── Body parts by their bones ──
// A part runs from bone end a to bone end b, and its fullness down each side is a profile, [[t, r], ...] (t 0-1 along the
// bone): a thigh swells high on its outside and low on its inside, a calf high on the back, a forearm just under the
// elbow. p: the profile down the + side (the left of a→b as the screen shows it), m: down the other. t0 / t1: only that
// stretch of it; ca / cb: a round end (1) or one cut straight across (0: a hem, a cuff, a sock's top); k: its scale.
const rAt = (pr, t) => {
  if (t <= pr[0][0]) return pr[0][1]
  for (let i = 1; i < pr.length; i++) if (t <= pr[i][0]) { const [t0, r0] = pr[i - 1], [t1, r1] = pr[i]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0 || 1) }
  return pr[pr.length - 1][1]
}
const PTS = [[], []]
function sideOf(out, pr, t0, t1) {
  out.length = 0; out.push(t0, rAt(pr, t0))
  for (const p of pr) if (p[0] > t0 + 0.02 && p[0] < t1 - 0.02) out.push(p[0], p[1])
  out.push(t1, rAt(pr, t1))
  return out
}
// a smooth line on through a run of points (each corner rounded off through the midpoints)
function through(x, xs, ys, n) {
  if (n < 3) { x.lineTo(xs[n - 1], ys[n - 1]); return }
  for (let i = 1; i < n - 1; i++) x.quadraticCurveTo(xs[i], ys[i], i === n - 2 ? xs[n - 1] : (xs[i] + xs[i + 1]) / 2, i === n - 2 ? ys[n - 1] : (ys[i] + ys[i + 1]) / 2)
}
const BX = [new Float64Array(24), new Float64Array(24)], BY = [new Float64Array(24), new Float64Array(24)]
function part(x, d, g = 0, kp = 1, km = 1) {
  // (an outline can be thinner down one side: d.gp / d.gm, the ink's width down the + / - side, in place of g)
  const gp = g && d.gp != null ? d.gp : g, gm = g && d.gm != null ? d.gm : g
  const [ax, ay] = d.a, [bx, by] = d.b, t0 = d.t0 ?? 0, t1 = d.t1 ?? 1, k = d.k ?? 1
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.001, ux = dx / L, uy = dy / L, nx = -uy, ny = ux
  const P = sideOf(PTS[0], d.p, t0, t1), M = sideOf(PTS[1], d.m, t0, t1), np = P.length / 2, nm = M.length / 2
  const xp = BX[0], yp = BY[0], xm = BX[1], ym = BY[1]
  for (let i = 0; i < np; i++) { const t = P[i * 2], r = P[i * 2 + 1] * k * kp + gp; xp[i] = ax + dx * t + nx * r; yp[i] = ay + dy * t + ny * r }
  for (let i = 0; i < nm; i++) { const t = M[nm * 2 - 2 - i * 2], r = M[nm * 2 - 1 - i * 2] * k * km + gm; xm[i] = ax + dx * t - nx * r; ym[i] = ay + dy * t - ny * r }
  const th = Math.atan2(ny, nx)
  x.moveTo(xp[0], yp[0]); through(x, xp, yp, np)
  // the end at b
  const rpB = P[np * 2 - 1] * k * kp + gp, rmB = M[nm * 2 - 1] * k * km + gm, Bx = ax + dx * t1, By = ay + dy * t1
  if (d.cb === 0) x.lineTo(xm[0], ym[0])
  else x.arc(Bx + (nx * (rpB - rmB)) / 2, By + (ny * (rpB - rmB)) / 2, Math.max(0.05, (rpB + rmB) / 2), th, th - Math.PI, true)
  through(x, xm, ym, nm)
  const rpA = P[1] * k * kp + gp, rmA = M[1] * k * km + gm, Ax = ax + dx * t0, Ay = ay + dy * t0
  if (d.ca === 0) x.lineTo(xp[0], yp[0])
  else x.arc(Ax + (nx * (rpA - rmA)) / 2, Ay + (ny * (rpA - rmA)) / 2, Math.max(0.05, (rpA + rmA) / 2), th + Math.PI, th, true)
  x.closePath()
}
// which side of a bone is in shade (the light's up and to the left): +1 the + side
const shadeSide = d => { const dx = d.b[0] - d.a[0], dy = d.b[1] - d.a[1]; return -dy * 0.8 + dx * 0.5 >= 0 ? 1 : -1 }
function inkP(x, list, g = OL) { x.fillStyle = INK; x.beginPath(); for (const d of list) part(x, d, g); x.fill() }
// the colour in two flat tones, the way the art layer does it: the part in its shade, then the lit side over most of it
// (a dark kit the other way about: the part, and an edge of light down its lit side, so it still reads on the ink)
const KD = 0.32
// the trim where it would vanish on the shirt (white on white): the shorts' colour if that shows, or the shirt's shade
const trimOn = L => (Math.abs(lumOf(L.trim) - lumOf(L.shirt)) > 0.15 ? L.trim : Math.abs(lumOf(L.shorts) - lumOf(L.shirt)) > 0.25 ? L.shorts : tone(L.shirt, 0.55))
// the small creases, seams and studs only on a man big enough on the screen to show them (a far man is a few flat shapes)
let FINE = true
function fillP(x, list, col, shade = true) {
  if (!shade) { x.fillStyle = col; x.beginPath(); for (const d of list) part(x, d); x.fill(); return }
  const dark = lumOf(col) < DARK
  x.fillStyle = dark ? tone(col, 1.38) : tone(col, 0.78); x.beginPath(); for (const d of list) part(x, d); x.fill()
  x.fillStyle = col; x.beginPath()
  for (const d of list) { const s = shadeSide(d); if (dark) part(x, d, 0, s > 0 ? 1 : 0.7, s > 0 ? 0.7 : 1); else part(x, d, 0, s > 0 ? KD : 1, s > 0 ? 1 : KD) }
  x.fill()
}
// a line along a part, a little in from one side (a crease, a seam, a tendon)
function alongP(x, d, s, f, ta, tb, col, w) {
  const [ax, ay] = d.a, [bx, by] = d.b, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.001, nx = -dy / L, ny = dx / L, k = d.k ?? 1, pr = s > 0 ? d.p : d.m
  x.strokeStyle = col; x.lineWidth = w; x.beginPath()
  for (let i = 0; i <= 4; i++) { const t = lerp(ta, tb, i / 4), r = rAt(pr, t) * k * f * s, px = ax + dx * t + nx * r, py = ay + dy * t + ny * r; if (i) x.lineTo(px, py); else x.moveTo(px, py) }
  x.stroke()
}
// across a part at t (a hem's line, a cuff, the fold of a sock)
function acrossP(x, d, t, col, w, f = 1) {
  const [ax, ay] = d.a, [bx, by] = d.b, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.001, nx = -dy / L, ny = dx / L, k = (d.k ?? 1) * f
  const px = ax + dx * t, py = ay + dy * t, rp = rAt(d.p, t) * k, rm = rAt(d.m, t) * k
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'butt'
  x.beginPath(); x.moveTo(px + nx * rp, py + ny * rp); x.lineTo(px - nx * rm, py - ny * rm); x.stroke(); x.lineCap = 'round'
}
const D = (a, b, p, m, o) => ({ a, b, p, m, t0: 0, t1: 1, ca: 1, cb: 1, k: 1, ...o })
const sides = (s, outer, inner) => (s > 0 ? [outer, inner] : [inner, outer])
const add = (pr, g) => pr.map(([t, r]) => [t, r + g])

// The leg: the thigh full at the top and swelling on its outside, the inside (the teardrop) low by the knee; a real knee;
// the calf high and fuller on the inside, in to a slim ankle
const THIGH_O = [[0, 5.2], [0.3, 5.2], [0.6, 4.85], [0.85, 4.3], [1, 3.9]]
const THIGH_I = [[0, 4.9], [0.2, 4.9], [0.5, 4.55], [0.78, 4.1], [0.9, 4.2], [1, 3.75]]
const SHIN_O = [[0, 3.8], [0.1, 3.75], [0.27, 4.6], [0.5, 3.75], [0.78, 2.35], [0.93, 2.0], [1, 2.15]]
const SHIN_I = [[0, 3.7], [0.1, 3.7], [0.31, 5.0], [0.53, 3.95], [0.78, 2.45], [0.93, 2.1], [1, 2.25]]
const SOCK_O = add(SHIN_O, 0.4), SOCK_I = add(SHIN_I, 0.4), FOLD_O = add(SHIN_O, 0.95), FOLD_I = add(SHIN_I, 0.95)
const SHORT_O = [[0, 5.05], [1, 5.3]], SHORT_I = [[0, 4.8], [1, 4.8]]
const NECK = [[0, 4.9], [0.35, 4.4], [1, 4.1]]
const SOCK_T = 0.15, FOLD_T = [0.11, 0.21]
// boots: [the upper, its flash, the soleplate]
const BOOTS = [['#15181c', '#f2f2ee', '#e6e8e4'], ['#f2f2ee', '#15181c', '#2a2e33'], ['#f08a24', '#15181c', '#15181c'], ['#2bd4c5', '#10151a', '#f2f2ee'], ['#e84fa1', '#f2f2ee', '#f2f2ee'], ['#15181c', '#c6ec3a', '#c6ec3a'], ['#c6ec3a', '#15181c', '#15181c'], ['#2a64d8', '#f2f2ee', '#f2f2ee'], ['#c9302c', '#f2f2ee', '#15181c']]
const bootOf = c => BOOTS.find(b => b[0] === c) ?? [c, lumOf(c) > 0.5 ? '#15181c' : '#f2f2ee', '#e6e8e4']
// A boot on the ground (or a foot down under him), by its ankle: from behind, the heel and its counter with the outside of
// the foot and the soleplate past it; from the front, the toe box at us, the laces, the sole. A flash down the outside.
// (stamped from a picture painted once per boot, way and size, like the head)
const boots = new Map(), BB = [-7.5, -7, 15, 9.5]
function bootUp(x, A, out, bt, front, bw, ink) {
  const m = typeof x.getTransform === 'function' ? x.getTransform() : null, sc = m ? Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) : 0
  if (!m || typeof document === 'undefined' || sc < 0.25 || sc > 12) return bootPaint(x, A, out, bt, front, bw, ink)
  const res = 2 ** (Math.ceil(Math.log2(sc) * 4) / 4), b = Math.round(bw * 20) / 20
  const id = `${bt[0]}|${out}|${front ? 1 : 0}|${ink ? 1 : 0}|${b}|${FINE ? 1 : 0}|${res}`
  let c = boots.get(id)
  if (!c) {
    if (boots.size > 200) boots.delete(boots.keys().next().value)
    c = document.createElement('canvas'); c.width = Math.ceil(BB[2] * res); c.height = Math.ceil(BB[3] * res)
    const h = c.getContext('2d'); h.scale(res, res); h.translate(-BB[0], -BB[1]); h.lineCap = 'round'; h.lineJoin = 'round'
    bootPaint(h, [0, -2.6], out, bt, front, b, ink)
    boots.set(id, c)
  }
  x.drawImage(c, A[0] + BB[0], A[1] + 2.6 + BB[1], BB[2], BB[3])
}
function bootPaint(x, A, out, bt, front, bw, ink) {
  const [up, flash, plate] = bt, ax = A[0], ay = A[1], s = out
  x.save(); x.translate(ax, ay + 2.6); x.scale(s * bw, bw)
  // (in his units now: x out from the ankle, the ground at 0)
  const heel = () => { x.moveTo(-2.25, -4.3); x.lineTo(2.25, -4.3); x.quadraticCurveTo(2.9, -3.2, 2.85, -1.7); x.lineTo(2.75, -0.7); x.lineTo(-2.75, -0.7); x.lineTo(-2.85, -1.7); x.quadraticCurveTo(-2.9, -3.2, -2.25, -4.3); x.closePath() }
  const fore = () => { x.moveTo(0.6, -3.1); x.quadraticCurveTo(3.6, -3.0, 4.9, -1.7); x.quadraticCurveTo(5.5, -0.9, 5.0, -0.6); x.lineTo(0.4, -0.6); x.closePath() }
  const toe = () => { x.moveTo(-2.1, -4.4); x.lineTo(2.1, -4.4); x.quadraticCurveTo(3.3, -3.4, 3.25, -1.6); x.quadraticCurveTo(3.2, -0.6, 2.6, -0.6); x.lineTo(-2.9, -0.6); x.quadraticCurveTo(-3.4, -0.6, -3.35, -1.6); x.quadraticCurveTo(-3.3, -3.4, -2.1, -4.4); x.closePath() }
  const sole = () => (front ? x.roundRect(-3.5, -1.05, 7.0, 1.15, 0.5) : x.roundRect(-2.95, -1.05, 8.1, 1.15, 0.5))
  if (ink) {
    x.fillStyle = INK; x.strokeStyle = INK; x.lineWidth = OL * 2 / bw; x.beginPath()
    if (front) toe(); else { heel(); fore() }
    sole(); x.fill(); x.stroke(); x.restore(); return
  }
  if (front) {
    x.fillStyle = tone(up, 0.8); x.beginPath(); toe(); x.fill()
    x.fillStyle = up; x.beginPath(); x.moveTo(-2.1, -4.4); x.lineTo(1.2, -4.4); x.quadraticCurveTo(2.2, -2.6, 1.6, -0.6); x.lineTo(-2.9, -0.6); x.quadraticCurveTo(-3.4, -0.6, -3.35, -1.6); x.quadraticCurveTo(-3.3, -3.4, -2.1, -4.4); x.fill()
    // the laces up the instep, and the flash down the outside
    x.strokeStyle = tone(up, lumOf(up) > 0.5 ? 0.62 : 1.6); x.lineWidth = 0.45; x.beginPath(); for (const yy of [-3.9, -3.2, -2.5]) { x.moveTo(-0.9, yy); x.lineTo(0.9, yy) } x.stroke()
    x.strokeStyle = flash; x.lineWidth = 0.75; x.beginPath(); x.moveTo(2.2, -3.6); x.quadraticCurveTo(2.9, -2.2, 2.6, -1.1); x.stroke()
  } else {
    x.fillStyle = tone(up, 0.74); x.beginPath(); fore(); x.fill()
    x.strokeStyle = flash; x.lineWidth = 0.8; x.beginPath(); x.moveTo(1.4, -2.0); x.quadraticCurveTo(3.4, -2.3, 4.6, -1.5); x.stroke()
    x.fillStyle = tone(up, 0.82); x.beginPath(); heel(); x.fill()
    x.fillStyle = up; x.beginPath(); x.moveTo(-2.25, -4.3); x.lineTo(1.0, -4.3); x.quadraticCurveTo(1.5, -2.4, 1.2, -0.7); x.lineTo(-2.75, -0.7); x.lineTo(-2.85, -1.7); x.quadraticCurveTo(-2.9, -3.2, -2.25, -4.3); x.fill()
    // the heel counter, and its tab
    x.fillStyle = flash; x.beginPath(); x.moveTo(-2.75, -1.2); x.quadraticCurveTo(0, -2.2, 2.75, -1.2); x.lineTo(2.72, -0.7); x.lineTo(-2.72, -0.7); x.closePath(); x.fill()
    x.fillStyle = tone(up, 0.6); x.fillRect(-0.45, -4.3, 0.9, 1.5)
  }
  x.fillStyle = plate; x.beginPath(); sole(); x.fill()
  // the studs under it
  x.fillStyle = tone(plate, 0.7)
  if (FINE) for (const sx of front ? [-2.4, 2.4] : [-2.0, 2.0, 4.3]) x.fillRect(sx - 0.45, -0.05, 0.9, 0.45)
  x.restore()
}
// One leg, hip to boot. From behind, a heel kicked up shows the sole and its studs.
function paintLeg(x, H, K, A, out, L, skin, bw, boot, front, k, z = 0, kn = 0) {
  bw *= 1 + 0.16 * z   // (nearer the camera, a touch bigger)
  const bt = bootOf(boot)
  const [tp, tm] = sides(-out, THIGH_O, THIGH_I), [sp, sm] = sides(-out, SHIN_O, SHIN_I), [kp, km] = sides(-out, SOCK_O, SOCK_I), [fp, fm] = sides(-out, FOLD_O, FOLD_I)
  const thigh = D(H, K, tp, tm, { k: bw }), shin = D(K, A, sp, sm, { k: bw, cb: 1 })
  const sock = D(K, A, kp, km, { k: bw, t0: SOCK_T, ca: 0 }), fold = D(K, A, fp, fm, { k: bw, t0: FOLD_T[0], t1: FOLD_T[1], ca: 0, cb: 0 })
  // the boot: from behind, a heel kicked up shows its sole; a foot swung at the camera, from the front, is all sole
  // (kneeling, from behind: the shin comes at us along the grass and the sole's up, toward us)
  const up = -A[1] - 2.6, kneelB = !front && kn > 0.5, sole = !front && ((k < -0.25 && up > 7) || kneelB), atUs = z > 0.5
  const bx0 = A[0], by0 = A[1] + 0.4, bx1 = A[0] + out * (sole ? 0.7 : 0.3), by1 = kneelB ? A[1] + 4.6 : sole ? A[1] - 4.8 : A[1] + 1.6
  // (kneeling, from the front: the shin and the boot go back behind the knee, out of sight behind the thigh)
  const behind = front && kn > 0.35
  const flat = !sole && !atUs && !behind
  const SOLE = [[0, 2.5], [0.35, 2.35], [0.72, 2.95], [1, 2.6]], soleD = D([bx0, by0], [bx1, by1], SOLE, SOLE, { k: bw })
  const atD = D([bx0, by0 + 0.4], [bx0 + out * 0.3, by0 + 2], [[0, 3.5], [1, 3.8]], [[0, 3.5], [1, 3.8]], { k: bw })
  const knee = () => {
    const kx = K[0], ky = K[1]
    if (front) {
      // the kneecap catching the light, and its shade under it; the teardrop of the thigh above it on the inside
      x.strokeStyle = tone(skin, 0.7); x.lineWidth = 0.55; x.beginPath(); x.arc(kx - out * 0.3, ky - 1.2, 2.0 * bw, Math.PI * 0.25, Math.PI * 0.75); x.stroke()
      alongP(x, thigh, out, 0.5, 0.7, 0.9, tone(skin, 0.8), 0.5)
    } else {
      // behind the knee: the crease across it, and the hamstrings' tendons coming down to it either side
      x.strokeStyle = tone(skin, 0.64); x.lineWidth = 0.6; x.beginPath(); x.moveTo(kx - 1.9 * bw, ky + 0.1); x.quadraticCurveTo(kx, ky + 1.0, kx + 1.9 * bw, ky + 0.1); x.stroke()
    }
  }
  const socks = () => {
    fillP(x, [sock], L.socks)
    // the calf's two heads under the sock from behind; the shin pad's ridge from the front
    if (!FINE) {} else if (front) alongP(x, sock, out, 0.05, 0.3, 0.7, tone(L.socks, lumOf(L.socks) < DARK ? 1.35 : 1.06), 1.2)
    else alongP(x, sock, 1, 0.08, 0.27, 0.5, 'rgba(0,0,0,.16)', 0.6)
    // the turned-over top: its own band, a little proud of the sock, the club's hoops round it
    x.fillStyle = INK; x.beginPath(); part(x, fold, OL * 0.8); x.fill()
    fillP(x, [fold], L.socks)
    acrossP(x, fold, (FOLD_T[0] + FOLD_T[1]) / 2, L.trim, 1.25, 1.0)
    if (FINE) acrossP(x, fold, FOLD_T[1] - 0.004, 'rgba(0,0,0,.32)', 0.55, 0.96)
  }
  if (behind) {
    inkP(x, [shin, sock]); bootUp(x, A, out, bt, true, bw, true)
    fillP(x, [shin], skin); socks()
    inkP(x, [thigh]); fillP(x, [thigh], skin)
    x.strokeStyle = tone(skin, 0.7); x.lineWidth = 0.7; x.beginPath(); x.arc(K[0] - out * 0.3, K[1] - 0.4, 2.2, Math.PI * 0.15, Math.PI * 0.85); x.stroke()
    return
  }
  if (flat) bootUp(x, A, out, bt, front, bw, true)
  inkP(x, flat ? [thigh, shin, sock] : [thigh, shin, sock, atUs ? atD : soleD])
  // (a thigh coming straight at us is foreshortened: mostly its underside, in shade, the knee catching the light at its end)
  if (z > 0.3) { fillP(x, [shin], skin); fillP(x, [thigh], tone(skin, 0.84)); x.fillStyle = skin; x.beginPath(); x.ellipse(K[0] - out * 0.4, K[1] - 0.6, 3.0 * bw, 2.6 * bw, 0, 0, 6.2832); x.fill() } else fillP(x, [thigh, shin], skin)
  if (FINE && z <= 0.3) knee()
  socks()
  if (flat) { bootUp(x, A, out, bt, front, bw, false); return }
  const [upc, , plate] = bt
  if (sole) {
    // the sole and its studs, toward us
    // (its edge the boot's colour, the plate inside it, the studs: two under the heel, four under the ball of the foot)
    fillP(x, [soleD], upc, false)
    x.fillStyle = plate; x.beginPath(); part(x, { ...soleD, k: bw * 0.72 }); x.fill()
    const ux = (bx1 - bx0) / (Math.hypot(bx1 - bx0, by1 - by0) || 1), uy = (by1 - by0) / (Math.hypot(bx1 - bx0, by1 - by0) || 1), L5 = Math.hypot(bx1 - bx0, by1 - by0)
    x.fillStyle = tone(plate, lumOf(plate) > 0.5 ? 0.6 : 1.8)
    for (const [t, sn] of [[0.15, -0.8], [0.15, 0.8], [0.62, -1.2], [0.62, 1.2], [0.88, -1], [0.88, 1]]) { x.beginPath(); x.arc(bx0 + ux * L5 * t - uy * sn * bw, by0 + uy * L5 * t + ux * sn * bw, 0.5, 0, 6.2832); x.fill() }
  } else {
    // the boot swung up at us: its sole and studs to the camera
    const cx = (atD.a[0] + atD.b[0]) / 2, cy = (atD.a[1] + atD.b[1]) / 2
    fillP(x, [atD], upc)
    x.fillStyle = plate; x.beginPath(); x.ellipse(cx, cy, 2.9 * bw, 3.7 * bw, out * 0.25, 0, 6.2832); x.fill()
    x.fillStyle = tone(plate, 0.62); for (const [sx, sy] of [[-1.5, -2.6], [1.5, -2.6], [-1.6, -0.4], [1.6, -0.4], [-1, 2.4], [1, 2.4]]) { x.beginPath(); x.arc(cx + sx * bw, cy + sy * bw, 0.55, 0, 6.2832); x.fill() }
  }
}
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
  const lS = [sxx - cl * W - sl * 3.2, syy - sl * W + cl * 3.2], rS = [sxx + cl * W - sl * 3.2, syy + sl * W + cl * 3.2]
  // (hip: the pelvis tipped, + his right hip up, the way a man stands with his weight on one leg)
  const ht = (o.hip ?? 0) * HIPW
  const lH = [hipX - cl * HIPW, hipY - sl * HIPW + ht], rH = [hipX + cl * HIPW, hipY + sl * HIPW - ht]
  const lA = [o.lx, o.ly - 2.6], rA = [o.rx, o.ry - 2.6]
  // (a leg swung at the camera, from the front: foreshortened, the thigh and shin short and nearly in line, so a
  // follow-through reads as the leg coming through at us and not a knee lifted)
  const zL = front ? clamp(o.zl ?? 0, 0, 1) : 0, zR = front ? clamp(o.zr ?? 0, 0, 1) : 0
  const knee = (H, A, k, out, z) => {
    if (z <= 0) return kneeOf(H[0], H[1], A[0], A[1], k, out)
    const f = lerp(1, clamp(Math.hypot(A[0] - H[0], A[1] - H[1]) / (TH + SH) * 1.04, 0.12, 1), z)
    const K = kneeOf(H[0], H[1], H[0] + (A[0] - H[0]) / f, H[1] + (A[1] - H[1]) / f, k * (1 - z), out)
    const kx = H[0] + (K[0] - H[0]) * f, ky = H[1] + (K[1] - H[1]) * f
    return [lerp(kx, lerp(H[0], A[0], 0.4), z), lerp(ky, lerp(H[1], A[1], 0.4), z)]
  }
  // (and the foot that's come through at us is up in front of him, over his shorts, not down by his other knee)
  const atUs = (A, H, z, out) => { if (z <= 0) return; A[0] = lerp(A[0], H[0] - out * 3.5, z * 0.75); A[1] = lerp(A[1], H[1] + 6, z * 0.85) }
  atUs(lA, lH, zL, -1); atUs(rA, rH, zR, 1)
  const lK = knee(lH, lA, o.lk ?? 0, -1, zL), rK = knee(rH, rA, o.rk ?? 0, 1, zR)
  // (on his knees (kn): the knees on the grass, the shins flat on it behind him: from behind they come at us, the
  // soles up; from the front they go away behind his thighs, out of sight)
  // (knl / knr: one knee down and the other not, a man getting up off them one foot at a time)
  const kn = clamp(o.kn ?? 0, 0, 1), knL = clamp(o.knl ?? kn, 0, 1), knR = clamp(o.knr ?? kn, 0, 1)
  for (const [H, K, A, out, kn] of [[lH, lK, lA, -1, knL], [rH, rK, rA, 1, knR]]) {
    if (kn <= 0) continue
    const gx = lerp(K[0], H[0] + out * 2.4, kn), gy = lerp(K[1], -2.2, kn)
    const tx = gx - H[0], ty = gy - H[1], tl = Math.hypot(tx, ty), kx = tl > TH ? H[0] + tx / tl * TH : gx, ky = tl > TH ? H[1] + ty / tl * TH : gy
    K[0] = kx; K[1] = ky
    A[0] = lerp(A[0], kx + out * (front ? -0.3 : 1.6), kn); A[1] = lerp(A[1], -2.2 + (front ? -5.5 : 6.2), kn)   // (the feet stay on the grass behind him as the knees come up off it)
  }
  const elL = clamp((o.elbow ?? 0) + (o.el ?? 0), 0, 1), elR = clamp((o.elbow ?? 0) + (o.er ?? 0), 0, 1)
  const pole = (S, hy, out, el) => { const up = clamp((S[1] - hy) / 28, 0, 1); return [out * lerp(0.3 + 0.5 * up, 1, el), lerp(0.95 - 0.55 * up, 0.1, el)] }
  const lp = pole(lS, o.hly, -1, elL), rp = pole(rS, o.hry, 1, elR)
  // (an arm hanging loose bends forward at the elbow, toward or away from us, not out to the side like a wrestler's)
  const foreOf = (S, hy, el) => { const hang = clamp((hy - S[1] - 22) / 8, 0, 1) * (1 - clamp(el / 0.5, 0, 1)); return Math.max(o.fore ?? 0, 0.7 * hang) }
  const lArm = armOf(lS[0], lS[1], o.hlx, o.hly, lp[0], lp[1], foreOf(lS, o.hly, elL)), rArm = armOf(rS[0], rS[1], o.hrx, o.hry, rp[0], rp[1], foreOf(rS, o.hry, elR))
  const tilt = o.tilt ?? 0, turnH = o.head ?? 0
  const nl = 4.6 * (1 - 0.3 * bow), hx = sxx + sl * (nl + HR) + turnH * 1.2, hy = syy - cl * (nl + HR) + (bow > 0.3 ? bow * 4 : 0) - tilt * 0.6
  const gk = !!L.gloves, handR = gk ? 3.7 : 2.5
  const { col: hairC, cut } = hairFor({ ...L, cut: L.hair && L.hair[0] !== '#' ? L.hair : L.cut, hairColor: L.hairColor ?? (L.hair && L.hair[0] === '#' && L.hair !== '#17120e' ? L.hair : undefined) })
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'
  if (o.rot) { x.translate(hipX, hipY); x.rotate(o.rot); x.translate(-hipX, -hipY) }
  // which arms go where: from behind, a hand in front of him (inside the shirt's outline) is hidden; one over his head
  // goes over it; one across his front, from the front, over the shirt; the rest hang at his sides, under the shirt's edge
  const inside = a => Math.abs(a.ex - sxx) < 9 && a.ey > syy - (front ? 12 : -2) && a.ey < hipY + (front ? 14 : 4)
  const armOverHead = a => a.ey < hy + 4 && Math.abs(a.ex - hx) < 11
  const arms = [[lArm, -1], [rArm, 1]].map(([a, out]) => ({ a, out, at: !front && inside(a) ? 'back' : armOverHead(a) || (front && Math.abs(a.ex - hx) < 9 && Math.abs(a.ey - hy) < 12) ? 'late' : front && inside(a) ? 'front' : 'side' }))
  // (an arm in front of him, from behind: from under its sleeve down; the sleeve's part of the shirt, below)
  for (const r of arms) if (r.at === 'back') paintArm(x, r.a, r.out, L, skin, handR, gk, o, front, 'bare')
  // the legs: the far one first (from behind, the one swinging through; from the front, the one going back)
  const boot = L.boot ?? BOOTS[hashOf(`${L.number}|${L.skin}`) % BOOTS.length][0]
  const legs = [[lH, lK, lA, -1, o.lk ?? 0, zL, knL], [rH, rK, rA, 1, o.rk ?? 0, zR, knR]].sort((p, q) => (front ? p[4] + p[5] * 2 - p[6] * 3 - q[4] - q[5] * 2 + q[6] * 3 : q[4] - p[4]))
  const later = []
  for (const g of legs) { if (front && ((g[4] > 0.45 && g[2][1] < -7) || g[5] > 0.3) && g[6] < 0.3) later.push(g); else paintLeg(x, g[0], g[1], g[2], g[3], L, skin, bw, boot, front, g[4], g[5], g[6]) }
  // the neck, behind the shirt's neckline: a column up off the trapezius; from behind the groove of the nape, from the
  // front the jaw's shadow across its top
  const neck = D([sxx - sl * 1.5, syy + cl * 1.5], [hx, hy + 3.2], NECK, NECK)
  inkP(x, [neck]); fillP(x, [neck], skin)
  // (no clip: the head goes over the top of the shadow and the shirt over its foot)
  if (front) { x.fillStyle = skinD; x.beginPath(); x.ellipse(hx, hy + 4.4, 3.4, 2.6, 0, 0, 6.2832); x.fill() }
  else if (FINE) { x.strokeStyle = tone(skin, 0.74); x.lineWidth = 0.55; x.beginPath(); x.moveTo(lerp(sxx, hx, 0.35), lerp(syy, hy, 0.35)); x.lineTo(lerp(sxx, hx, 0.75), lerp(syy, hy, 0.75)); x.stroke() }
  // the body: the shorts, the shirt and the sleeves, inked as one
  // The shorts: fitted, to the middle of the thigh, a leg of them round each thigh with its hem cut straight across.
  // (a thigh driven at us or away from us is short on the screen; the shorts still hang off it, so the leg of them goes
  // on down over the top of it and isn't balled up at his hip)
  const shortsL = [lH, rH].map((H, i) => {
    const K = i ? rK : lK, f = clamp(1 - Math.hypot(K[0] - H[0], K[1] - H[1]) / (TH * 0.8), 0, 1), out = i ? 1 : -1
    const ex = lerp(lerp(H[0], K[0], 0.47), H[0] + out * 0.6, f), ey = lerp(lerp(H[1], K[1], 0.47), H[1] + 10, f)
    const [p, m] = sides(-out, SHORT_O, SHORT_I)
    return D([lerp(H[0], ex, 0.06), lerp(H[1], ey, 0.06)], [ex, ey], p, m, { ca: 0, cb: 0, k: bw })
  })
  // the seat and the waistband: from the hips across, down to the fork
  const waist = d => {
    const w0 = 7.9 * bw + d, w1 = HIPW + 4.9 * bw + d, nx = -sl, ny = cl
    // (wound the same way as the legs of them, so the two fill as one)
    x.moveTo(hipX - cl * w0 - nx * (5.6 + d), hipY - sl * w0 - ny * (5.6 + d)); x.lineTo(hipX - cl * w1 + nx * (2 + d), hipY - sl * w1 + ny * (2 + d))
    x.lineTo(hipX + nx * (3.4 + d), hipY + ny * (3.4 + d)); x.lineTo(hipX + cl * w1 + nx * (2 + d), hipY + sl * w1 + ny * (2 + d)); x.lineTo(hipX + cl * w0 - nx * (5.6 + d), hipY + sl * w0 - ny * (5.6 + d)); x.closePath()
  }
  // The shirt, in its own frame (0, 0 the middle of his shoulders, y down to the hem): the neckline, the trapezius
  // sloping down to the shoulders (not a box), round over the deltoid into the sleeve; under the arm the lats, in to a
  // waist only a little narrower than the chest (a V from the shoulders, not an hourglass), straight down over the shorts
  const wa = W - 0.5, wl = W - 0.2, ww = 9.9 * bw, wh = 9.6 * bw, T2 = T - 2.6   // (T2: the hem, over the top of the shorts)
  const shirt = () => {
    x.moveTo(-3.7, -2.6)
    x.quadraticCurveTo(-W * 0.55, -2.0, -W + 1.2, 0.3)
    x.quadraticCurveTo(-W - 1.6, 1.4, -W - 1.0, 6.2)
    x.lineTo(-wa, 10.5)
    x.quadraticCurveTo(-wl, 14.5, -ww - 0.4, T * 0.72)
    x.quadraticCurveTo(-ww, T2 - 2.5, -wh + 0.3, T2 + 0.6)
    x.quadraticCurveTo(-wh - 0.4, T2 + 2.2, -wh, T2 + 2.8)
    x.quadraticCurveTo(0, T2 + 3.9, wh, T2 + 2.8)
    x.quadraticCurveTo(wh + 0.4, T2 + 2.2, wh - 0.3, T2 + 0.6)
    x.quadraticCurveTo(ww, T2 - 2.5, ww + 0.4, T * 0.72)
    x.quadraticCurveTo(wl, 14.5, wa, 10.5)
    x.lineTo(W + 1.0, 6.2)
    x.quadraticCurveTo(W + 1.6, 1.4, W - 1.2, -0.2)
    x.quadraticCurveTo(W * 0.55, -2.0, 3.7, -2.6)
    if (front) x.quadraticCurveTo(0, 1.4, -3.7, -2.2); else x.quadraticCurveTo(0, -0.9, -3.7, -2.2)
    x.closePath()
  }
  const sides0 = arms.filter(r => r.at === 'side'), sleeves = sides0.map(r => sleeveOf(r.a, r.out, bw))
  // (and the sleeve of an arm swung across in front of him, from behind: inked with the shirt, so it's the shoulder
  // going round and not a round sleeve stuck on it)
  const backs = arms.filter(r => r.at === 'back'), sleevesB = backs.map(r => sleeveOf(r.a, r.out, bw))
  // (the armpit: the shirt's side carried on up into the sleeve, so a sleeve grows out of the shirt and isn't a tube
  // stuck on its shoulder, and there's no notch of ink where they meet)
  const tp = (X, Y) => [sxx + cl * X - sl * Y, syy + sl * X + cl * Y]
  const webs = sides0.map(r => { const S = r.out < 0 ? lS : rS, hang = clamp((r.a.jy - r.a.sy) / (Math.hypot(r.a.jx - r.a.sx, r.a.jy - r.a.sy) || 1), 0, 1), b = tp(r.out * (wa - 2.2), lerp(4.5, 12, smooth(hang * 1.15))), m = [lerp(r.a.sx, r.a.jx, 0.3), lerp(r.a.sy, r.a.jy, 0.3)]; return [[b[0], b[1], 3.2, m[0], m[1], 3.9], [b[0], b[1], 3.2, S[0], S[1], 4.2]] }).flat()
  x.fillStyle = INK
  x.beginPath(); waist(OL); x.fill()
  inkP(x, shortsL.concat(sleeves, sleevesB)); inkT(x, webs)
  x.save(); x.translate(sxx, syy); x.rotate(lean); x.beginPath(); shirt(); x.strokeStyle = INK; x.lineWidth = OL * 2; x.stroke(); x.fill(); x.restore()
  // the arms at his sides, under the sleeves' edges
  for (const r of sides0) paintArm(x, r.a, r.out, L, skin, handR, gk, o, front, 'arm')
  // the shorts: the far side in shade, the hem's stripe, the seat's seam and the folds where the legs meet it
  const stripe = String(L.shorts).toLowerCase() === String(L.trim).toLowerCase() ? L.shirt : L.trim
  // (one piece of cloth: the far leg of them in shade down its outside, the near leg's inside in shade under the fork)
  const shL = lumOf(L.shorts) < DARK
  x.fillStyle = L.shorts; x.beginPath(); waist(0); for (const s of shortsL) part(x, s); x.fill()
  // (the shade's inside the far leg of them and the shirt's shadow inside the waist: no clip needed)
  { const s = shortsL[1], sd = shadeSide(s); x.fillStyle = shL ? tone(L.shorts, 1.38) : tone(L.shorts, 0.8); x.beginPath(); part(x, s, 0, sd > 0 ? 1 : -0.35, sd > 0 ? -0.35 : 1); x.fill() }
  { const s = shortsL[0]; x.lineCap = 'butt'; alongP(x, s, shadeSide(s), 0.8, 0.25, 0.97, shL ? tone(L.shorts, 1.38) : tone(L.shorts, 0.82), 1.6); x.lineCap = 'round' }
  // the shirt's shadow across the top of them
  x.fillStyle = 'rgba(0,0,0,.12)'; x.beginPath(); x.ellipse(hipX + sl * 2, hipY + 1.2, 9, 2.0, lean, 0, 6.2832); x.fill()
  for (const s of shortsL) { acrossP(x, s, 0.9, stripe, 1.15, 1.0); acrossP(x, s, 0.985, 'rgba(0,0,0,.28)', 0.5, 1.0) }
  const fold = 'rgba(0,0,0,.2)'
  if (!FINE) {} else if (!front && bow < 0.5) {
    // from behind: the seam down the seat, and the gluteal fold across each leg of them
    x.strokeStyle = fold; x.lineWidth = 0.6; x.beginPath(); x.moveTo(hipX - sl * -4, hipY - 4); x.lineTo(hipX + sl * 3, hipY + 3.4); x.stroke()
    // (no folds drawn across the seat: they round it)
  } else if (front) {
    // from the front: the creases from the fork, and the number small on his left leg
    x.strokeStyle = fold; x.lineWidth = 0.55; x.beginPath(); x.moveTo(hipX - 1, hipY + 2.6); x.lineTo(hipX - 3.6, hipY - 0.4); x.moveTo(hipX + 1, hipY + 2.6); x.lineTo(hipX + 3.6, hipY - 0.4); x.stroke()
    if (L.number != null && bow < 0.4) { const s = shortsL[1]; text(x, String(L.number), lerp(s.a[0], s.b[0], 0.72) + 1.2, lerp(s.a[1], s.b[1], 0.72) - 1.6, { font: DISPLAY, size: 3.4, color: stripe }) }
  }
  // the hands by his sides: over the shorts' edge, not lost behind it
  for (const r of sides0) paintArm(x, r.a, r.out, L, skin, handR, gk, o, front, 'hand')
  // the sleeves, under the shirt's own colour: the shirt goes over their tops (the far one in the shirt's shade), the
  // cuff in the trim (a keeper's runs on down to the glove)
  sides0.forEach((r, i) => { const c = r.out > 0 ? tone(L.shirt, 0.86) : L.shirt; fillP(x, [sleeves[i]], c); fillT(x, webs.slice(i * 2, i * 2 + 2), r.out > 0 ? tone(L.shirt, 0.8) : c, false) })
  backs.forEach((r, i) => fillP(x, [sleevesB[i]], r.out > 0 ? tone(L.shirt, 0.86) : L.shirt))
  if (!L.sleeves) for (const s of sleeves.concat(sleevesB)) acrossP(x, s, SLEEVE_T - 0.035, trimOn(L), 1.2)
  // the shirt: fitted, in at the waist, hanging a touch loose over the shorts; the far side in shade, the light along
  // the near shoulder; the shoulder blades and the spine from behind, the chest from the front; the cloth pulled in folds
  // from under the arms to the waist
  x.save(); x.translate(sxx, syy); x.rotate(lean)
  const darkShirt = lumOf(L.shirt) < DARK, sh = L.shirt
  x.beginPath(); shirt(); x.fillStyle = darkShirt ? tone(sh, 1.32) : sh; x.fill()
  x.save(); x.beginPath(); shirt(); x.clip()
  if (darkShirt) { x.save(); x.translate(0.8, 0.45); x.scale(0.975, 0.985); x.beginPath(); shirt(); x.fillStyle = sh; x.fill(); x.restore() }
  // the far side, round the body: its edge follows the lat up over the shoulder blade
  x.fillStyle = darkShirt ? tone(sh, 0.8) : tone(sh, 0.78)
  x.beginPath(); x.moveTo(4.6, -3); x.quadraticCurveTo(8.6, 2, 7.6, 10); x.quadraticCurveTo(5.2, T * 0.6, 5.4, T2 + 5); x.lineTo(16, T2 + 5); x.lineTo(16, -3); x.closePath(); x.fill()
  // the light along the near shoulder and down the trapezius
  x.fillStyle = darkShirt ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.16)'
  x.beginPath(); x.moveTo(-3.6, -2.0); x.quadraticCurveTo(-W * 0.62, -1.7, -W + 1.1, 0.1); x.quadraticCurveTo(-W - 0.8, 1.6, -W - 0.4, 4.6); x.quadraticCurveTo(-W + 1.6, 1.6, -3.2, 0.2); x.closePath(); x.fill()
  const ln = (w, c) => { x.lineWidth = w; x.strokeStyle = c }
  x.lineCap = 'round'
  if (!FINE) {} else if (!front) {
    // the shoulder blades under the cloth: their inside edges and their points
    ln(0.6, 'rgba(0,0,0,.13)'); x.beginPath()
    x.moveTo(-2.4, 4.4); x.quadraticCurveTo(-2.6, 9.4, -5.4, 11.8); x.moveTo(2.4, 4.4); x.quadraticCurveTo(2.6, 9.4, 5.4, 11.8); x.stroke()
    // the spine's valley down the middle
    ln(0.6, 'rgba(0,0,0,.11)'); x.beginPath(); x.moveTo(0, 2); x.quadraticCurveTo(0.3, T * 0.5, 0, T2 - 3); x.stroke()
  } else {
    // the chest: the underside of each pec, and the sternum between them
    ln(0.7, 'rgba(0,0,0,.14)'); x.beginPath()
    x.moveTo(-1.0, 11.4); x.quadraticCurveTo(-4.6, 13.0, -8.0, 10.6); x.moveTo(1.0, 11.4); x.quadraticCurveTo(4.6, 13.0, 8.0, 10.6); x.stroke()
  }
  // the folds: from under each arm in toward the waist, and where it gathers over the shorts
  if (FINE) {
    ln(0.55, 'rgba(0,0,0,.12)'); x.beginPath()
    x.moveTo(-wa + 0.4, 12.2); x.quadraticCurveTo(-6.6, 14.6, -5.2, 17.4)
    x.moveTo(wa - 0.4, 12.2); x.quadraticCurveTo(6.6, 14.6, 5.2, 17.4)
    x.stroke()
  }
  // the hem's band
  x.fillStyle = 'rgba(0,0,0,.12)'; x.beginPath(); x.moveTo(-wh - 1, T2 + 1.2); x.quadraticCurveTo(0, T2 + 2.4, wh + 1, T2 + 1.2); x.lineTo(wh + 1, T2 + 5); x.lineTo(-wh - 1, T2 + 5); x.closePath(); x.fill()
  x.restore()
  // where the shirt hangs over the shorts
  x.strokeStyle = INK; x.lineWidth = OL * 0.9; x.beginPath(); x.moveTo(-wh, T2 + 2.8); x.quadraticCurveTo(0, T2 + 3.9, wh, T2 + 2.8); x.stroke()
  x.restore()
  // the number and the badge
  x.save(); x.translate(sxx, syy); x.rotate(lean)
  if (L.number != null && bow < 0.55) {
    const n = String(L.number)
    if (front) {
      text(x, n, -4.4, 9.4, { font: DISPLAY, size: 5.6, color: L.num })
      // the badge, over his heart (his left: the screen's right)
      x.fillStyle = INK; x.beginPath(); x.moveTo(2.8, 5.8); x.lineTo(6.9, 5.8); x.lineTo(6.9, 8.9); x.quadraticCurveTo(4.85, 11.4, 2.8, 8.9); x.closePath(); x.fill()
      x.fillStyle = L.trim; x.beginPath(); x.moveTo(3.3, 6.3); x.lineTo(6.4, 6.3); x.lineTo(6.4, 8.8); x.quadraticCurveTo(4.85, 10.6, 3.3, 8.8); x.closePath(); x.fill()
      x.fillStyle = tone(L.shirt, 0.7); x.fillRect(4.3, 7.2, 1.1, 1.6)
    } else {
      text(x, n, 0, 14.2 + (T - TORSO) * 0.3, { font: DISPLAY, size: n.length > 1 ? 13.2 : 14.6, color: L.num, track: n.length > 1 ? -0.4 : 0 })
    }
  }
  // the collar: a ribbed band round the neckline in the shirt's own shade, the trim along its edge
  {
    const band = lumOf(L.shirt) < DARK ? tone(L.shirt, 1.5) : tone(L.shirt, 0.8)
    const c = () => { x.beginPath(); if (front) { x.moveTo(-4.4, -2.5); x.quadraticCurveTo(0, 2.9, 4.4, -2.5); x.lineTo(3.4, -3.0); x.quadraticCurveTo(0, 1.0, -3.4, -3.0) } else { x.moveTo(-4.5, -2.2); x.quadraticCurveTo(0, -0.5, 4.5, -2.2); x.lineTo(3.7, -3.5); x.quadraticCurveTo(0, -2.0, -3.7, -3.5) } x.closePath() }
    c(); x.strokeStyle = INK; x.lineWidth = OL * 1.3; x.stroke(); x.fillStyle = band; x.fill()
    x.strokeStyle = trimOn(L); x.lineWidth = 0.5; x.beginPath(); if (front) { x.moveTo(-4.0, -2.55); x.quadraticCurveTo(0, 2.25, 4.0, -2.55) } else { x.moveTo(-4.15, -2.45); x.quadraticCurveTo(0, -0.95, 4.15, -2.45) } x.stroke()
  }
  x.restore()
  // a knee coming up toward us, from the front, over the shorts
  // (and the leg of the shorts goes over the top of that thigh again)
  for (const g of later) {
    paintLeg(x, g[0], g[1], g[2], g[3], L, skin, bw, boot, front, g[4], g[5], g[6])
    const sp = shortsL[g[3] > 0 ? 1 : 0]
    if (g[5] >= 0.3) { const H = g[0], K = g[1], f = D(sp.a, [lerp(H[0], K[0], 0.55), lerp(H[1], K[1], 0.55)], sp.p, sp.m, { ca: 0, cb: 0, k: bw * 1.04 }); inkP(x, [f]); fillP(x, [f], L.shorts); acrossP(x, f, 0.9, String(L.shorts).toLowerCase() === String(L.trim).toLowerCase() ? L.shirt : L.trim, 1.15) }
    else { inkP(x, [sp]); fillP(x, [sp], L.shorts); acrossP(x, sp, 0.9, String(L.shorts).toLowerCase() === String(L.trim).toLowerCase() ? L.shirt : L.trim, 1.15) }
  }
  // the arms across his front, the head, then any hand up at the head
  for (const r of arms) if (r.at === 'front') paintArm(x, r.a, r.out, L, skin, handR, gk, o, front, 'full')
  paintHead(x, sxx, syy, hx, hy, skin, skinD, hairC, L.beard ? `${cut}|${L.beard}` : cut, front, o, tilt, turnH)
  for (const r of arms) if (r.at === 'late') paintArm(x, r.a, r.out, L, skin, handR, gk, o, front, 'full')
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
// An arm. 'full': the sleeve and all, with its own outline (an arm behind him, or across his front); 'bare': from under
// the sleeve's cuff down (an arm at his side: the body's sleeve goes over its top).
// The upper arm: the deltoid round the shoulder (under the sleeve), the biceps and triceps, in to the elbow; the forearm
// full just under the elbow on its outside, in to a slim wrist; then a hand: the palm, the fingers easy and turned in
// (a fist when it's up), the thumb. Not a tube: the shape is what reads at 60 px.
const UP_O = [[0, 3.9], [0.35, 3.65], [0.7, 3.1], [1, 2.6]], UP_I = [[0, 3.4], [0.5, 3.15], [1, 2.55]]
const FO_O = [[0, 2.6], [0.25, 2.85], [0.6, 2.35], [1, 1.6]], FO_I = [[0, 2.55], [0.3, 2.65], [1, 1.55]]
const SLEEVE_T = 0.56   // a short sleeve: how far down the upper arm
const SLV_O = [[0, 4.1], [0.3, 4.3], [SLEEVE_T, 4.0]], SLV_I = [[0, 3.9], [SLEEVE_T, 3.7]]
const PALM = [[0, 1.3], [0.5, 1.65], [1, 1.7]], FING = [[0, 1.65], [0.55, 1.45], [1, 1.05]], FIST = [[0, 1.6], [0.35, 2.1], [0.8, 2.15], [1, 1.85]]
const THUMB = [[0, 1.0], [1, 0.78]], GLOVE = [[0, 3.0], [0.35, 3.7], [1, 3.75]], GLOVEF = [[0, 3.75], [0.6, 3.6], [1, 3.0]]
function sleeveOf(a, out, k = 1) { const [p, m] = sides(-out, SLV_O, SLV_I); return D([a.sx, a.sy], [a.jx, a.jy], p, m, { t1: SLEEVE_T, cb: 0, k }) }
function paintArm(x, a, out, L, skin, handR, gk, o, front, seg = 'full') {
  const col = L.sleeves ? L.shirt : skin
  const dx = a.ex - a.jx, dy = a.ey - a.jy, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl
  // (a keeper's glove turned up, palm to the ball: the fingers up whichever way the forearm goes)
  const pm = gk ? clamp(o.palm ?? 0, 0, 1) : 0
  let gx = ux, gy = uy
  if (pm > 0) { const vx = lerp(ux, out * 0.2, pm), vy = lerp(uy, -1, pm), vl = Math.hypot(vx, vy) || 1; gx = vx / vl; gy = vy / vl }
  // the wrist, a little short of the hand's middle
  const wr = [a.ex - ux * (gk ? 1.6 : 2.3), a.ey - uy * (gk ? 1.6 : 2.3)]
  const [up, um] = sides(-out, UP_O, UP_I), [fp, fm] = sides(-out, FO_O, FO_I)
  const upper = D([a.sx, a.sy], [a.jx, a.jy], up, um, { t0: seg === 'full' ? 0 : 0.3 }), fore = D([a.jx, a.jy], wr, fp, fm)
  // which way is in, toward his body (the fingers curl that way, the thumb's on that side)
  const nx = -uy, ny = ux, inS = (nx * -out + ny * 0.0) >= 0 ? 1 : -1, ix = nx * inS, iy = ny * inS
  const finger = out < 0 ? o.fl : o.fr
  // a hand up by his head or over it is a fist; one hanging is open and easy
  const fist = !gk && (a.ey < a.jy - 2 || finger > 0.5 || a.ey < a.sy - 4)
  let hand
  if (gk) hand = [D(wr, [wr[0] + gx * 4.6, wr[1] + gy * 4.6], GLOVE, GLOVE), D([wr[0] + gx * 4.3, wr[1] + gy * 4.3], [wr[0] + gx * 7.0, wr[1] + gy * 7.0], GLOVEF, GLOVEF)]
  else if (fist) hand = [D(wr, [wr[0] + ux * 3.8, wr[1] + uy * 3.8], FIST, FIST)]
  else {
    // the fingers: on from the knuckles, curled a touch in toward his thigh
    const kx = wr[0] + ux * 2.9, ky = wr[1] + uy * 2.9, c = 0.22, fx = ux * Math.cos(c) + ix * Math.sin(c), fy = uy * Math.cos(c) + iy * Math.sin(c)
    hand = [D(wr, [kx, ky], PALM, PALM), D([kx - ux * 0.3, ky - uy * 0.3], [kx + fx * 3.0, ky + fy * 3.0], FING, FING)]
  }
  const thumb = !gk && front ? D([wr[0] + ix * 1.3 + ux * 0.5, wr[1] + iy * 1.3 + uy * 0.5], [wr[0] + ix * 1.9 + ux * (fist ? 2.9 : 3.5), wr[1] + iy * 1.9 + uy * (fist ? 2.9 : 3.5)], THUMB, THUMB) : null
  const top = sleeveOf(a, out)
  // ('arm': all but the hand; 'hand': only the hand, over whatever it's by)
  const body = seg !== 'hand', withHand = seg !== 'arm'
  // (a lighter line round the arm and lighter still round the hand: slim, not a sausage in a thick outline)
  // (an arm by his side: only a hairline down its inside, so where it hangs close to the shirt the two outlines don't run
  // together into one thick black band)
  if (seg === 'arm') { const o2 = -out > 0, gi = 0.4, go = OL * 0.85; upper.gp = o2 ? go : gi; upper.gm = o2 ? gi : go; fore.gp = upper.gp; fore.gm = upper.gm }
  if (body) inkP(x, seg === 'full' ? [top, upper, fore] : [upper, fore], OL * 0.85)
  if (withHand) inkP(x, gk ? hand : hand.concat(thumb ? [thumb] : []), gk ? OL : OL * 0.62)
  if (body) fillP(x, [upper, fore], col)
  if (body && L.sleeves) {
    // the keeper's long sleeve: its cuff at the wrist
    acrossP(x, fore, 0.86, tone(L.shirt, 0.72), 1.3)
  }
  if (!withHand) return
  if (seg === 'full') {
    fillP(x, [top], out > 0 && !front ? tone(L.shirt, 0.86) : L.shirt)
    if (!L.sleeves) acrossP(x, top, SLEEVE_T - 0.035, trimOn(L), 1.2)
  }
  if (gk) {
    fillP(x, hand, L.gloves)
    // the strap at the wrist and the fingers' seams
    acrossP(x, hand[0], 0.18, tone(L.gloves, 0.55), 1.6)
    const nx2 = -gy, ny2 = gx, ex = wr[0], ey = wr[1]
    // (turned to us: the palm's grip, a shade darker)
    if (pm > 0.4 && front) { x.fillStyle = tone(L.gloves, 0.84); x.beginPath(); x.ellipse(ex + gx * 4.2, ey + gy * 4.2, 2.5, 2.9, Math.atan2(gy, gx) + Math.PI / 2, 0, 6.2832); x.fill() }
    x.strokeStyle = tone(L.gloves, 0.62); x.lineWidth = 0.55
    x.beginPath(); for (const s of [-1.3, 0, 1.3]) { x.moveTo(ex + gx * 5.0 + nx2 * s, ey + gy * 5.0 + ny2 * s); x.lineTo(ex + gx * 7.6 + nx2 * s * 1.1, ey + gy * 7.6 + ny2 * s * 1.1) } x.stroke()
  } else {
    fillP(x, hand, skin)
    // the knuckles' line; a fist's fingers folded over
    const h = hand[hand.length - 1]
    if (!FINE) {} else if (fist) { acrossP(x, h, 0.72, tone(skin, 0.7), 0.5, 0.8); alongP(x, h, inS, 0.45, 0.5, 0.95, tone(skin, 0.7), 0.45) }
    else acrossP(x, hand[0], 0.97, tone(skin, 0.76), 0.45, 0.8)
  }
  if (thumb) { fillP(x, [thumb], skin, false); x.strokeStyle = tone(skin, 0.58); x.lineWidth = 0.45; x.beginPath(); part(x, thumb); x.stroke() }
  if (finger > 0.5) {
    const sx = wr[0] + ux * 3.6, sy = wr[1] + uy * 3.6, tx = wr[0] + ux * 8.4, ty = wr[1] + uy * 8.4
    x.strokeStyle = INK; x.lineWidth = 1.7 + OL * 2; x.beginPath(); x.moveTo(sx, sy); x.lineTo(tx, ty); x.stroke()
    x.strokeStyle = skin; x.lineWidth = 1.7; x.beginPath(); x.moveTo(sx - ux, sy - uy); x.lineTo(tx, ty); x.stroke()
  }
}
// The head: a skull and a jaw (not an egg), the ears, the hair as its own shape with its own volume (inked with the
// head, so a curly top or a bun is part of the silhouette), and from the front a face kept simple: brows, eyes, the
// nose's shade, the mouth. Every man is about 21: a full head of hair in a young man's colour, never grey or thin.
const SK = 6.5, SKY = 7.0, JAW = 7.5
// (from behind there's no chin: the back of the skull comes down round into the neck, the jaw's corners just showing)
function skull(x, hx, hy, back = false) {
  x.moveTo(hx - SK, hy - 0.8)
  x.ellipse(hx, hy - 0.8, SK, SKY, 0, Math.PI, Math.PI * 2)
  if (back) {
    x.bezierCurveTo(hx + SK, hy + 3.0, hx + 5.4, hy + 5.2, hx + 4.0, hy + 6.2)
    x.quadraticCurveTo(hx, hy + 7.0, hx - 4.0, hy + 6.2)
    x.bezierCurveTo(hx - 5.4, hy + 5.2, hx - SK, hy + 3.0, hx - SK, hy - 0.8)
  } else {
    // (a man's jaw: the corners square under the ears, a flat chin)
    x.bezierCurveTo(hx + SK + 0.2, hy + 4.2, hx + 5.8, hy + JAW - 0.3, hx + 2.7, hy + JAW + 0.1)
    x.lineTo(hx - 2.7, hy + JAW + 0.1)
    x.bezierCurveTo(hx - 5.8, hy + JAW - 0.3, hx - SK - 0.2, hy + 4.2, hx - SK, hy - 0.8)
  }
  x.closePath()
}
// one loc: a rope of hair from (x0, y0) to (x1, y1), bowed out a little, inked round
function rope(x, x0, y0, x1, y1, w, hair, bow = 0.6) {
  x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2 + Math.sign(x1 - x0 || 1) * bow, (y0 + y1) / 2, x1, y1)
  x.strokeStyle = INK; x.lineWidth = w + OL * 1.2; x.stroke()
  x.strokeStyle = hair; x.lineWidth = w; x.stroke()
}
const VOL = { crop: 0.7, fade: 1.3, curly: 1.6, long: 0.8, bun: 0.35, buzz: 0.2 }
// the hair's outer shape over the crown (its volume); g grows it (for the ink)
function crown(x, hx, hy, cut, g = 0) {
  const v = VOL[cut] ?? 0.7
  if (cut === 'curly') {
    x.moveTo(hx - SK - 1.0 - g, hy - 0.4)
    for (let i = 0; i <= 7; i++) { const a = Math.PI * (1 + i / 7), r = 1.75 + g; x.arc(hx + Math.cos(a) * (SK + 0.1), hy - 1.0 + Math.sin(a) * (SKY + v - 0.9), r, a - 1.3, a + 1.3) }
    x.lineTo(hx + SK + 1.0 + g, hy - 0.4); x.lineTo(hx + SK, hy - 0.8); x.ellipse(hx, hy - 0.8, SK, SKY, 0, 0, Math.PI, true); x.closePath(); return
  }
  // a crop or a fade: higher at the front-left where it's pushed up; the rest close to the skull
  x.moveTo(hx - SK - 0.45 - g, hy - 0.2)
  x.bezierCurveTo(hx - SK - 0.6 - g, hy - SKY - v - 0.6 - g, hx - 1.4, hy - SKY - v - 1.5 - g, hx + 0.6, hy - SKY - v - 0.8 - g)
  x.bezierCurveTo(hx + 3.8, hy - SKY - v - 0.2 - g, hx + SK + 0.6 + g, hy - SKY + 0.6, hx + SK + 0.45 + g, hy - 0.2)
  // (and back over the top of the skull: the volume is only what stands off it, the hairline's drawn on the head)
  x.lineTo(hx + SK, hy - 0.8); x.ellipse(hx, hy - 0.8, SK, SKY, 0, 0, Math.PI, true)
  x.closePath()
  if (cut === 'bun') { x.moveTo(hx + 2.9 + g, hy - SKY - 1.9); x.arc(hx, hy - SKY - 1.9, 2.9 + g, 0, 6.2832) }
}
// (the head a touch big, the way a game draws a man so his head reads at a glance: grown up and out from his neck)
const HS = 1.08
// The head is the costliest part to paint (its clips and curls) and the same from frame to frame, so it's painted once
// per look, face, tilt and turn (a little rounded) at the size it's drawn, and stamped. (Its box, about its middle.)
const heads = new Map(), HB = [-12.5, -18, 25, 31]
function paintHead(x, sxx, syy, hx, hy, skin, skinD, hair, cut, front, o, tilt, turnH, collar = null) {
  const m = typeof x.getTransform === 'function' ? x.getTransform() : null, sc = m ? Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) : 0
  if (!m || typeof document === 'undefined' || sc < 0.25 || sc > 12) {
    x.save(); x.translate(hx, hy + 6); x.scale(HS, HS); x.translate(-hx, -(hy + 6))
    headOf(x, sxx, syy, hx, hy, skin, skinD, hair, cut, front, o, tilt, turnH, collar)
    x.restore(); return
  }
  const res = 2 ** (Math.ceil(Math.log2(sc) * 4) / 4), up = Math.round(clamp(tilt, -1, 1) * 8) / 8, tn = Math.round(turnH * 10) / 10, face = o.face ?? 0
  const id = `${skin}|${hair}|${cut}|${front ? 1 : 0}|${face}|${up}|${tn}|${FINE ? 1 : 0}|${res}`
  let c = heads.get(id)
  if (!c) {
    if (heads.size > 300) heads.delete(heads.keys().next().value)
    c = document.createElement('canvas'); c.width = Math.ceil(HB[2] * res); c.height = Math.ceil(HB[3] * res)
    const h = c.getContext('2d')
    h.scale(res, res); h.translate(-HB[0], -HB[1]); h.lineCap = 'round'; h.lineJoin = 'round'
    h.translate(0, 6); h.scale(HS, HS); h.translate(0, -6)
    headOf(h, 0, 0, 0, 0, skin, skinD, hair, cut, front, { face }, up, tn, null)
    heads.set(id, c)
  }
  x.drawImage(c, hx + HB[0], hy + HB[1], HB[2], HB[3])
}
function headOf(x, sxx, syy, hx, hy, skin, skinD, hair, cutIn, front, o, tilt, turnH, collar = null) {
  const up = clamp(tilt, -1, 1)
  // (cut|beard: a created face, its beard riding on the cut; locs hang like long hair, in ropes)
  const parts = String(cutIn).split('|'), made = parts.length > 1
  const [cut0, beard = 'none'] = parts, locs = cut0 === 'locs', cut = locs ? 'long' : cut0, ropes = made && locs
  collar?.()
  const ex = -turnH * 1.3, ears = sd => [hx + sd * (SK - 0.1) + ex, hy + 0.6]
  // (a created face's locs from the front: the ones falling behind his head and neck, before the head)
  if (ropes && front) for (const sd of [-1, 1]) { rope(x, hx + sd * 4.4, hy - 6, hx + sd * (SK + 2.4), hy + 9.2, 1.9, hair); rope(x, hx + sd * 2.6, hy - 6, hx + sd * (SK + 0.9), hy + 10.4, 1.9, hair) }
  // the ink: the skull and jaw, the ears, the hair
  x.fillStyle = INK; x.strokeStyle = INK; x.lineWidth = OL * 2
  x.beginPath(); skull(x, hx, hy, !front); crown(x, hx, hy, cut); x.fill(); x.stroke()
  if (cut === 'long' && !ropes) { x.beginPath(); if (front) { x.roundRect(hx - SK - 1.2 - OL, hy - 2, 2.2 + OL * 2, 6.6 + OL, 1.1); x.roundRect(hx + SK - 1.0 - OL, hy - 2, 2.2 + OL * 2, 6.6 + OL, 1.1) } else x.roundRect(hx - SK - 0.4 - OL, hy - 3, (SK + 0.4 + OL) * 2, 8.4 + OL, 3.4); x.fill() }
  for (const sd of [-1, 1]) { const [ax, ay] = ears(sd); x.beginPath(); x.ellipse(ax, ay, 1.6 + OL, 2.2 + OL, 0, 0, 6.2832); x.fill() }
  // (long hair from behind falls over the ears)
  for (const sd of [-1, 1]) { const [ax, ay] = ears(sd); x.fillStyle = skinD; x.beginPath(); x.ellipse(ax, ay, 1.6, 2.2, 0, 0, 6.2832); x.fill(); x.fillStyle = tone(skin, 0.68); x.beginPath(); x.ellipse(ax + sd * 0.3, ay + 0.2, 0.6, 1.1, 0, 0, 6.2832); x.fill() }
  x.fillStyle = skin; x.beginPath(); skull(x, hx, hy, !front); x.fill()
  x.save(); x.beginPath(); skull(x, hx, hy, !front); x.clip()
  // the far cheek and the jaw's side in shade (the light's up and to the left)
  x.fillStyle = tone(skin, 0.86); x.beginPath(); x.ellipse(hx + SK * 0.95 + ex * 0.6, hy + 1.2, SK * 0.55, SKY * 1.2, 0, 0, 6.2832); x.fill()
  if (!front) {
    // from behind: the hair over the back of the head down to the nape; the nape's skin under it
    const nape = hy + (cut === 'long' ? 8 : cut === 'buzz' || cut === 'fade' ? 3.4 : 4.6) - up * 1.6
    x.fillStyle = hair; x.globalAlpha = cut === 'buzz' ? 0.7 : 1
    // (over the ears it's cut up off them; behind them it comes down and in to the nape)
    const back = d => {
      x.beginPath(); x.moveTo(hx - SK - 1, hy - 12); x.lineTo(hx + SK + 1, hy - 12)
      if (cut === 'long') { x.lineTo(hx + SK + 1, nape - 1.2); x.quadraticCurveTo(hx, nape + 1.2, hx - SK - 1, nape - 1.2) }
      else { x.lineTo(hx + SK + 1, hy - 1.6 - d); x.quadraticCurveTo(hx + SK - 0.4, nape - 2.4 - d, hx + 2.8, nape - 0.6 - d); x.quadraticCurveTo(hx, nape + 0.5 - d, hx - 2.8, nape - 0.6 - d); x.quadraticCurveTo(hx - SK + 0.4, nape - 2.4 - d, hx - SK - 1, hy - 1.6 - d) }
      x.closePath(); x.fill()
    }
    if (cut === 'fade') { x.globalAlpha = 0.5; back(0); x.globalAlpha = 1; back(2.6) } else back(0)
    x.globalAlpha = 1
    // the crown's shade on its right
    x.fillStyle = tone(hair, 0.8); x.beginPath(); x.ellipse(hx + SK * 1.08, hy - 1.6, SK * 0.5, SKY * 1.15, 0, 0, 6.2832); x.fill()
  } else {
    // from the front: the hairline across the forehead, down to the sideburns at the ears
    const line = hy - 4.6 + up * 1.2, sb = cut === 'fade' || cut === 'buzz' ? hy - 1.6 : hy + 0.6
    x.fillStyle = hair; x.globalAlpha = cut === 'buzz' ? 0.7 : 1
    x.beginPath(); x.moveTo(hx - SK - 1, hy - 12); x.lineTo(hx + SK + 1, hy - 12); x.lineTo(hx + SK + 1, sb); x.quadraticCurveTo(hx + SK - 0.7, sb + 0.3, hx + SK - 1.35, sb - 1.4)
    x.lineTo(hx + SK - 1.5, line + 2.0); x.quadraticCurveTo(hx + SK - 2.2, line - 0.2, hx + 2.4, line - 0.3); x.quadraticCurveTo(hx, line + 0.5, hx - 2.4, line - 0.5); x.quadraticCurveTo(hx - SK + 2.2, line - 0.4, hx - SK + 1.5, line + 1.8)
    x.lineTo(hx - SK + 1.35, sb - 1.4); x.quadraticCurveTo(hx - SK + 0.7, sb + 0.3, hx - SK - 1, sb); x.closePath(); x.fill()
    x.globalAlpha = 1
    if (cut === 'fade' && made) {
      // a created fade: short sideburns, tapered to a point in front of the ear, faded like the sides
      x.globalAlpha = 0.5
      for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(hx + sd * (SK + 1), sb - 1.2); x.lineTo(hx + sd * (SK - 1.45), sb - 1.2); x.quadraticCurveTo(hx + sd * (SK - 1.25), sb + 1.3, hx + sd * (SK - 0.45), sb + 3.1); x.lineTo(hx + sd * (SK + 1), sb + 3.1); x.closePath(); x.fill() }
      x.globalAlpha = 1
    } else if (cut === 'fade') { x.globalAlpha = 0.4; x.fillRect(hx - SK - 1, sb, 2.6, 3.2); x.fillRect(hx + SK - 1.6, sb, 2.6, 3.2); x.globalAlpha = 1 }
    if (beard !== 'none') {
      // the beard, every edge on the jaw (the skull's clip): full / stubble from the sideburns down over the cheeks to
      // the moustache; a chin strap a band along the jaw from the sideburns round the chin; a goatee the moustache
      // and the chin, joined round the mouth
      const bx = hx + turnH * 1.5, by = hy + up * -1.1, jy = hy + JAW + 0.1
      x.fillStyle = hair
      if (beard === 'full' || beard === 'stubble') {
        x.globalAlpha = beard === 'stubble' ? 0.32 : 1
        x.beginPath(); x.moveTo(hx - SK - 1, sb - 1); x.lineTo(hx - SK + 1.6, sb - 1); x.quadraticCurveTo(hx - SK + 2.2, by + 3.6, bx - 2.6, by + 3.6)
        x.quadraticCurveTo(bx, by + 3.0, bx + 2.6, by + 3.6); x.quadraticCurveTo(hx + SK - 2.2, by + 3.6, hx + SK - 1.6, sb - 1); x.lineTo(hx + SK + 1, sb - 1); x.lineTo(hx + SK + 1, hy + 12); x.lineTo(hx - SK - 1, hy + 12); x.closePath(); x.fill()
        x.globalAlpha = 1
      } else if (beard === 'goatee') {
        x.beginPath(); x.moveTo(bx - 2.5, by + 5.2); x.quadraticCurveTo(bx - 2.6, by + 3.5, bx, by + 3.6); x.quadraticCurveTo(bx + 2.6, by + 3.5, bx + 2.5, by + 5.2)
        x.quadraticCurveTo(bx + 2.9, by + 6.8, bx + 2.7, jy + 1); x.lineTo(bx - 2.7, jy + 1); x.quadraticCurveTo(bx - 2.9, by + 6.8, bx - 2.5, by + 5.2); x.closePath(); x.fill()
      } else {
        x.strokeStyle = hair; x.lineWidth = 2.6; x.lineJoin = 'round'; x.beginPath(); x.moveTo(hx - SK, sb - 1); x.lineTo(hx - SK, hy - 0.8)
        x.bezierCurveTo(hx - SK - 0.2, hy + 4.2, hx - 5.8, hy + JAW - 0.3, hx - 2.7, jy); x.lineTo(hx + 2.7, jy)
        x.bezierCurveTo(hx + 5.8, hy + JAW - 0.3, hx + SK + 0.2, hy + 4.2, hx + SK, hy - 0.8); x.lineTo(hx + SK, sb - 1); x.stroke()
        x.beginPath(); x.ellipse(bx, jy - 0.3, 2.2, 1.3, 0, 0, 6.2832); x.fill()
      }
      // (the lower lip clear of it, the mouth's line drawn on that with the face)
      if (beard === 'full' || beard === 'goatee') { x.fillStyle = tone(skin, 0.9); x.beginPath(); x.ellipse(bx, by + 5.15, 1.75, 0.62, 0, 0, 6.2832); x.fill() }
    }
  }
  x.restore()
  // the volume over the crown (and long hair down past the jaw)
  x.fillStyle = hair; x.globalAlpha = cut === 'buzz' ? 0.7 : 1
  x.beginPath(); crown(x, hx, hy, cut); x.fill()
  if (ropes) {} else if (cut === 'long') {
    x.beginPath()
    if (front) { x.roundRect(hx - SK - 1.2, hy - 2, 2.2, 6.6, 1.1); x.roundRect(hx + SK - 1.0, hy - 2, 2.2, 6.6, 1.1) } else x.roundRect(hx - SK - 0.4, hy - 3, (SK + 0.4) * 2, 8.4, 3.4)
    x.fill()
    if (locs) {
      x.strokeStyle = tone(hair, lumOf(hair) < 0.12 ? 1.6 : 0.7); x.lineWidth = 0.4; x.globalAlpha = 0.35; x.beginPath()
      const xs = front ? [hx - SK - 0.6, hx - SK + 0.4, hx + SK - 0.4, hx + SK + 0.6] : [-5.2, -3.1, -1, 1.1, 3.2, 5.3].map(d => hx + d)
      for (const lx of xs) { x.moveTo(lx, hy - (front ? 1.4 : 2.6)); x.lineTo(lx + 0.1, hy + (front ? 4.2 : 5.0)) }
      x.stroke(); x.globalAlpha = 1
    }
  }
  x.globalAlpha = 1
  // the hair's own shade, down its right side, and a parting's line through a crop
  x.save(); x.beginPath(); crown(x, hx, hy, cut); x.clip(); x.fillStyle = tone(hair, 0.7); x.beginPath(); x.ellipse(hx + SK + 0.4, hy - 2.5, 3.2, 8, 0, 0, 6.2832); x.fill(); x.restore()
  // the light on the hair: a sheen over the crown on its lit side; a curly top's curls catching it
  if (FINE) {
    x.save(); x.beginPath(); crown(x, hx, hy, cut); if (!front) skull(x, hx, hy, !front); x.clip()
    const sheen = tone(hair, lumOf(hair) < 0.12 ? 1.2 : 1.14)
    if (cut === 'curly') {
      x.strokeStyle = tone(hair, lumOf(hair) < 0.12 ? 1.14 : 1.1); x.lineWidth = 0.45; x.beginPath()
      for (const [cx, cy] of [[-4.6, -5.4], [-2.2, -7.6], [0.6, -8.4], [-4.2, -1.8], [-1.6, -4.4], [1.4, -5.6], [3.6, -7.2], [-5.4, 1.6]]) { if (front && cy > -3) continue; x.moveTo(hx + cx - 1.1, hy + cy + 0.2); x.quadraticCurveTo(hx + cx, hy + cy - 1.1, hx + cx + 1.1, hy + cy + 0.2) }
      x.stroke()
    } else if (cut !== 'buzz') {
      x.fillStyle = sheen; x.beginPath(); x.ellipse(hx - 2.4, hy - SKY - 0.4, 4.4, 2.3, -0.3, 0, 6.2832); x.fill()
      x.fillStyle = hair; x.beginPath(); x.ellipse(hx - 1.6, hy - SKY + 1.0, 4.9, 2.6, -0.3, 0, 6.2832); x.fill()
    }
    x.restore()
  }
  if (ropes) {
    // a created face's locs: ropes from the crown, framing his face past the ears to his shoulders; from behind,
    // side by side down the back of his head over the collar
    if (front) for (const sd of [-1, 1]) rope(x, hx + sd * (SK - 1.3), hy - 4.2, hx + sd * (SK + 0.5), hy + 9.6, 1.9, hair, 0.9)
    else {
      const xs = [-6.4, -4.4, -2.2, 0, 2.2, 4.4, 6.4], ys = [8.4, 9.8, 9.2, 10.2, 9.0, 9.8, 8.6]
      x.strokeStyle = INK; x.lineWidth = 2.1 + OL * 1.2; x.beginPath(); xs.forEach((d, i) => { x.moveTo(hx + d, hy - 3.4); x.lineTo(hx + d * 1.06, hy + ys[i]) }); x.stroke()
      x.strokeStyle = hair; x.lineWidth = 2.1; x.stroke()
      x.strokeStyle = lumOf(hair) < 0.12 ? 'rgba(255,255,255,.13)' : tone(hair, 0.72); x.lineWidth = 0.4; x.beginPath()
      for (let i = 0; i < xs.length - 1; i++) { const m = (xs[i] + xs[i + 1]) / 2; x.moveTo(hx + m, hy - 1.4); x.lineTo(hx + m * 1.06, hy + Math.min(ys[i], ys[i + 1]) - 0.4) }
      x.stroke()
      // (their roots under the hair over the crown, so each one starts out of it)
      x.save(); x.beginPath(); skull(x, hx, hy, true); x.clip(); x.fillStyle = hair; x.beginPath(); x.moveTo(hx - SK - 1, hy - 12); x.lineTo(hx + SK + 1, hy - 12); x.lineTo(hx + SK + 1, hy - 2.4)
      x.quadraticCurveTo(hx, hy - 0.6, hx - SK - 1, hy - 2.4); x.closePath(); x.fill(); x.clip(); x.fillStyle = tone(hair, 0.8); x.beginPath(); x.ellipse(hx + SK * 1.08, hy - 1.6, SK * 0.5, SKY * 1.15, 0, 0, 6.2832); x.fill(); x.restore()
    }
  }
  if (!front) return
  // the face: brows, eyes, the nose's shade, the mouth (a roar, a set mouth, gutted)
  const f = o.face ?? 0, fy = hy + up * -1.1, fx = hx + turnH * 1.5
  const brow = f === 1 ? -0.45 : f === 2 ? 0.4 : 0
  x.fillStyle = tone(hair, 0.8)
  for (const sd of [-1, 1]) { x.save(); x.translate(fx + sd * 2.6, fy - 1.8); x.rotate(sd * brow); x.beginPath(); x.moveTo(-1.6 * sd, 0.45); x.quadraticCurveTo(0, -0.75, 1.6 * sd, 0.1); x.lineTo(1.5 * sd, 0.7); x.quadraticCurveTo(0, 0.1, -1.6 * sd, 0.9); x.closePath(); x.fill(); x.restore() }
  x.fillStyle = '#17100c'
  x.beginPath(); x.ellipse(fx - 2.5, fy + 0.4, 0.72, 0.9, 0, 0, 6.2832); x.ellipse(fx + 2.5, fy + 0.4, 0.72, 0.9, 0, 0, 6.2832); x.fill()
  // the nose: its shade down the right side and under it
  x.fillStyle = tone(skin, 0.8); x.beginPath(); x.moveTo(fx + 0.1, fy + 0.8); x.quadraticCurveTo(fx + 1.2, fy + 2.7, fx + 0.9, fy + 3.2); x.lineTo(fx - 0.6, fy + 3.2); x.quadraticCurveTo(fx - 0.1, fy + 2.9, fx + 0.1, fy + 0.8); x.fill()
  if (f === 1) { x.fillStyle = '#2a0f0c'; x.beginPath(); x.ellipse(fx, fy + 5.2, 1.9, 1.9, 0, 0, 6.2832); x.fill(); x.fillStyle = '#f2f0ea'; x.fillRect(fx - 1.3, fy + 3.7, 2.6, 0.7) }
  else if (f === 2) { x.strokeStyle = '#3a1a14'; x.lineWidth = 0.75; x.beginPath(); x.arc(fx, fy + 6.7, 1.9, Math.PI * 1.22, Math.PI * 1.78); x.stroke() }
  else if (f !== 3) { x.strokeStyle = '#3a1a14'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(fx - 1.5, fy + 5.0); x.quadraticCurveTo(fx, fy + 5.3, fx + 1.5, fy + 4.9); x.stroke() }
}
// Nobody stands frozen: a man on his feet and still breathes (the chest and shoulders rise a touch), his weight
// drifts from one foot to the other, his head moves. A man running, flying or on the grass is left as he is.
// t: ms; seed: anything that tells this man from the next (they don't all breathe together). (Off under Reduce Motion.)
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0)
export function idlePose(t, p, seed = 0, lift = 0) {
  if (lift || Math.abs(p.rot ?? 0) > 0.05 || (p.ly ?? 0) < -4 || (p.ry ?? 0) < -4 || lightMode()) return p
  const br = Math.sin(t / 640 + seed), w = Math.sin(t / 1900 + seed * 1.7), hd = Math.sin(t / 2600 + seed * 0.7)
  const q = { ...p }
  q.hy = (p.hy ?? 53) + 0.22 * br
  q.hly = (p.hly ?? -47.5) - 0.45 * br; q.hry = (p.hry ?? -47.5) - 0.45 * br
  q.hx = (p.hx ?? 0) + 0.7 * w; q.hlx = (p.hlx ?? -16.5) + 0.55 * w; q.hrx = (p.hrx ?? 16.5) + 0.55 * w
  q.lean = (p.lean ?? 0) - 0.012 * w
  q.head = (p.head ?? 0) + 0.1 * hd
  return q
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
  const turn = o.turn ?? 0, sxk = Math.max(0.45, Math.abs(Math.cos(turn * Math.PI)))   // (side-on he's still a body's depth wide)
  const L = turn > 0.5 ? { ...look, front: !look.front } : look
  ctx.save(); ctx.translate(p.x, p.y - lift * p.s); ctx.scale(k * sxk, k)
  FINE = k * 110 > 64
  paintMan(ctx, o.still ? pose : idlePose(o.t ?? now(), pose, X * 3.1 + Z * 1.7, lift), L)
  FINE = true
  ctx.restore()
  if (o.name) nameTag(ctx, null, p.x, p.y, o.name, clamp(k * 1.4, 0.7, 1.15))
  return p
}
// look: a kit and the man in it
// (the player's own created face, in a Career: his skin, his cut and its colour, his beard)
const faceOf = who => { const f = faceLook(who); return f ? { skin: f.skin, hairColor: f.hair, cut: f.cut, beard: f.beard } : null }
export const dress = (kit, who = null, extra = null) => ({ ...kit, skin: who?.skin ?? '#8d5a3b', number: who?.number ?? null, name: who?.name ?? null, ...faceOf(who), ...extra })
// a coach or a scout on the touchline with his clipboard (a quick look up at the play now and then)
export function scout(ctx, C, X, Z, look, t = 0, o = {}) {
  const glance = Math.sin(t / 900 + X) > 0.7
  return man(ctx, C, X, Z, { ...POSE.clip, tilt: glance ? 0.1 : -0.6, head: o.head ?? 0 }, { ...look, clipboard: true }, o)
}

// ── The moments after: what players really do ──────────────────────────────
// A goal: the knee slide, every time. The scorer peels away toward the corner and the crowd, his arms opening as he
// goes; a last long stride and he drops on to both knees at full pace, shins flat on the grass, and slides on, leaning
// back with his arms flung wide, the turf and the wet spraying off his knees and a skid left behind him. As he slows
// the chest comes out, the head goes back, the fists come up and he roars. His teammates pile in: the first down on his
// knees beside him with an arm round him, the next over the top of him, the last jumping on the lot. How much the goal
// means (goalMood) only makes it bigger: a longer slide, more of them in on him, the whole ground up.
// The beaten keeper face-down or sat with his hands on his knees, then picking the ball out of the net; their defenders
// hands on hips, on knees, or having a go at a teammate. Nobody beaten ever celebrates.
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
// How much it means: 'big' a late winner or a late equaliser, 'calm' one that puts it out of reach, 'back' one when
// they're still behind after it (the slide's short and he's straight up for the restart), null anything else.
// sit: { mine, opp, minute } before the goal
export function goalMood(sit) {
  if (!sit || sit.mine == null || sit.opp == null || sit.shootout) return null
  const after = sit.mine + 1 - sit.opp, late = (sit.minute ?? sit.clock ?? 90) >= 75
  if (after < 0) return 'back'
  if (after <= 1) return late ? 'big' : null
  return after >= 3 ? 'calm' : null
}
// len: the slide's length; mates: how many get to him; roar: how long the home end's up (ms)
const SIZES = { big: { len: 1.25, mates: 3, roar: 3200 }, calm: { len: 0.8, mates: 2, roar: 1900 }, back: { len: 0.7, mates: 1, roar: 1500 } }
const SIZE0 = { len: 1, mates: 3, roar: 2400 }
const ACC = 0.32   // the part of his run he spends getting up to full pace
// seed: anything (the same goal always plays the same way). o: { from {x, z}, toward {x, z} (where he runs to, and
// drops: the slide carries on past it the same way), side (+1: he peels off to the screen's right, when there's no
// toward), mates [{x, z, who}], sit (or mood) }
export function celebration(seed, o = {}) {
  let h = 0; for (const ch of String(seed)) h = (h * 33 + ch.charCodeAt(0)) % 1000003
  const mood = o.mood !== undefined ? o.mood : goalMood(o.sit), sz = SIZES[mood] ?? SIZE0, pace = lightMode() ? 0.6 : 1
  const side = o.side ?? (h % 2 ? 1 : -1), from = o.from ?? { x: 0, z: -10 }
  // the move: the knee slide, or now and then (about one goal in six, never one that only pulls one back) the jump,
  // the half turn in the air and the landing, feet wide and arms flung down and out, to the crowd
  // (window.__bapCelMove: a test's way to pick one)
  const move = o.move ?? (typeof window !== 'undefined' ? window.__bapCelMove : undefined) ?? (mood !== 'back' && Math.floor(h / 7) % 6 === 0 ? 'spin' : 'slide')
  // He goes to the crowd: off toward the corner on his side, away from the camera, so it sees him from behind or side-on
  // playing to the fans (the game's own 'toward' only says how far he goes). Short of the goal line, inside the pitch.
  const want = o.toward ? Math.hypot(o.toward.x - from.x, o.toward.z - from.z) : 4.6
  let dl = clamp(want, 3, 5.4), ux = side * 0.76, uz = 0.65
  const v0 = dl / (clamp((dl / 6.6) * 1000 * (1 + ACC / 2), 560, 1150) / 1000) / (1 - ACC / 2)
  const len0 = move === 'spin' ? 1.3 : clamp(v0 * 0.4 * sz.len, 1.4, 4.2), room = -1.6 - from.z
  if (room < (dl + len0) * uz) { uz = clamp(room / (dl + len0), 0.08, uz); ux = side * Math.sqrt(1 - uz * uz) }
  if (Math.abs(from.x + ux * (dl + len0)) > HALF_W - 2) { ux = -ux }
  const to = { x: from.x + ux * dl, z: from.z + uz * dl }
  const run = clamp((dl / 6.6) * 1000 * (1 + ACC / 2), 560, 1150) * pace
  const v = dl / (run / 1000) / (1 - ACC / 2)                  // his pace as he goes down (m/s)
  const len = move === 'spin' ? 1.3 : clamp(v * 0.4 * sz.len, 1.4, 4.2)   // the slide (or the skip and the jump)
  const S = move === 'spin' ? SPIN.land * pace : clamp((2 * len) / v * 1000, 520, 1200) * pace
  const end = { x: to.x + ux * len, z: to.z + uz * len }
  // (he turns to the lens only if he's somehow coming at it)
  const face = uz < -0.35
  // His teammates run over and join him the way players do: the first in puts an arm round him, the next ruffles his
  // head or slaps his back, the last comes up alongside pointing at him. Nobody dives on him; they all face the fans.
  const list = (o.mates ?? []).slice(0, sz.mates)
  const order = list.map((m, i) => [i, Math.hypot(m.x - end.x, m.z - end.z)]).sort((p, q) => p[1] - q[1]).map(p => p[0])
  // (after the jump they give him his moment, the landing held, before they get to him)
  const stop = run + S + (move === 'spin' ? 650 * pace : 0)
  let s0 = 0
  // (one starting back toward the camera is already on his way in by the time the lens has turned to the corner: he
  // comes in from no nearer than a few metres short of him, never across the front of the picture)
  const mates = list.map((m0, i) => {
    const far = Math.hypot(m0.x - end.x, m0.z - end.z) > 4.5, m = far ? { ...m0, z: Math.max(m0.z, end.z - 2.4) } : m0
    const rank = order.indexOf(i), role = ['hug', 'pat', 'point'][rank]
    let sd = Math.sign(m.x - end.x) || (rank % 2 ? -side : side)
    if (rank === 0) s0 = sd
    if (rank === 1) sd = -s0 || sd
    if (rank === 2) sd = s0 || sd
    const t = role === 'hug' ? { x: end.x + sd * 0.55, z: end.z + 0.06 } : role === 'pat' ? { x: end.x + sd * 0.6, z: end.z + 0.12 } : { x: end.x + sd * 1.7, z: end.z - 0.55 }
    // (one coming from nearer the lens than the slide would run in across it, in front of the moment: he swings out
    // wide and comes in from the side)
    const wide = m.z < end.z - 1.2, q = wide ? { x: end.x + sd * Math.max(3.4, Math.abs(m.x - end.x)), z: lerp(m.z, t.z, 0.8) } : { x: (m.x + t.x) / 2, z: (m.z + t.z) / 2 }
    const d = Math.hypot(q.x - m.x, q.z - m.z) + Math.hypot(t.x - q.x, t.z - q.z)
    // (each in when he gets there: none of them stood about waiting for the slide to finish)
    const arrive = Math.max(stop + (rank * 240 - 120) * pace, Math.min((d / 8.6) * 1000 * 1.2, stop + (rank * 240 + 420) * pace))
    return { ...m, role, sd, tx: t.x, tz: t.z, qx: q.x, qz: q.z, arrive, delay: 0 }
  })
  return { kind: 'slide', move, mood, side, from, to, end, ux, uz, len, v, S, run, stop, face, pace, mates, roar: sz.roar, seed: h, keeper: h % 3 === 0 ? 'sit' : 'down' }
}
// The jump and the turn, in ms from the end of his run: two quick skipping steps (the arms swing back), off both feet,
// half a turn in the air, and down hard, feet wide, knees bent, arms flung down and out, chest out, the shout
const SPIN = { skip: 300, off: 330, land: 820, peak: 0.62 }
const SPIN_AIR = pz({ hy: 52, bow: 0.04, lx: -10, ly: -8, lk: 0.6, rx: 10, ry: -8, rk: 0.6, hlx: -30, hly: -92, hrx: 30, hry: -92, elbow: 0.2, fore: 0.2, face: 1, tilt: 0.4 })
const SPIN_LAND = pz({ hy: 43, bow: 0.06, lx: -19, rx: 19, lk: 0.45, rk: 0.45, hlx: -36, hly: -52, hrx: 36, hry: -52, elbow: 0, el: 0, er: 0, fore: 0, face: 1, tilt: 0.55 })
POSE.spinLand = SPIN_LAND
const ease = f => 1 - (1 - f) * (1 - f)
// the slide, as a man: on both knees, the shins flat on the grass behind him (kn), leaning back (bow), arms out wide
const KNEE_SLIDE = pz({ hy: 27, bow: 0.24, lx: -11, ly: 0, rx: 11, ry: 0, lk: -1, rk: -1, kn: 1, hlx: -45, hly: -80, hrx: 45, hry: -80, elbow: 0, el: 0, er: 0, fore: 0, face: 1, tilt: 0.85 })
// stopped: chest out, the head back, both fists up by his head, roaring
const KNEE_ROAR = pz({ ...KNEE_SLIDE, hy: 28.5, bow: 0.18, hlx: -23, hly: -80, hrx: 23, hry: -80, elbow: 1, fore: 0, tilt: 1 })
POSE.kneeSlide = KNEE_SLIDE; POSE.kneeRoar = KNEE_ROAR
// how far along his line he is at age ms (the run, then the slide)
function slideDist(c, a) {
  const L = Math.hypot(c.to.x - c.from.x, c.to.z - c.from.z)
  if (a < c.run) { const f = a / c.run; return (L * (f < ACC ? (f * f) / (2 * ACC) : f - ACC / 2)) / (1 - ACC / 2) }
  if (c.move === 'spin') {
    // (the skip carries him half a metre on, the jump the rest; down, he stays put)
    const t = (a - c.run) / c.pace
    return L + c.len * (t < SPIN.off ? 0.4 * smoothS(t / SPIN.off) : 0.4 + 0.6 * clamp((t - SPIN.off) / (SPIN.land - SPIN.off), 0, 1))
  }
  const u = clamp((a - c.run) / c.S, 0, 1)
  return L + c.len * (1 - (1 - u) * (1 - u))
}
// where the scorer is and what he's doing, age ms after the goal: { x, z, pose, lift, turn, low }
export function scorerAt(c, age) {
  const a = Math.max(0, age), d = slideDist(c, a), p = c.pace
  const x = c.from.x + c.ux * d, z = c.from.z + c.uz * d
  // (turned to the lens as he peels away, if that's the way he's going)
  const turn = c.face ? smoothS(prog(a, 40 * p, 40 * p + Math.min(260, c.run * 0.35))) : 0
  if (c.move === 'spin') return spinnerAt(c, a, x, z)
  const down = c.run - 80 * p, hit = c.run + 70 * p
  let pose
  if (a < down) {
    // the run: flat out, the arms opening wide as he picks his spot
    const ph = a / 250, w = smoothS(prog(a, c.run * 0.35, c.run * 0.9))
    pose = mix(runPose(ph, 1), runPose(ph, 1, null, { arms: 'wide' }), w)
  } else if (a < hit) {
    // the last stride: down on to both knees at full pace
    const f = smoothS(prog(a, down, hit))
    pose = mix(runPose(down / 250, 1, null, { arms: 'wide' }), KNEE_SLIDE, f)
  } else {
    // the slide: the knees take the grass (he sinks into it), the body shakes a touch over the turf, and as it runs
    // out he comes up on his knees, the fists up and the roar
    const u = clamp((a - c.run) / c.S, 0, 1), r = smoothS(prog(a, c.stop - 260 * p, c.stop + 120 * p))
    pose = mix(KNEE_SLIDE, KNEE_ROAR, r)
    pose.hy -= Math.sin(prog(a, hit - 40 * p, hit + 200 * p) * Math.PI) * 2.2
    pose.lean = Math.sin(a / 47) * 0.014 * (1 - u)
    // (held there, the fists shaking, the roar going on)
    if (a > c.stop) { const k = Math.sin((a - c.stop) / 140) * (1 - prog(a, c.stop + 700, c.stop + 1400)); pose.hly += k * 2.5; pose.hry -= k * 2.5 }
    // (the one down on his knees beside him: his arm comes down round him)
    const kn = c.mates.find(m => m.role === 'hug')
    if (kn) {
      const w = smoothS(prog(a, kn.arrive + 60 * p, kn.arrive + 300 * p)), ax = (kn.tx - c.end.x) / RIG_M * 0.85
      if (kn.sd > 0) { pose.hrx = lerp(pose.hrx, ax + 6, w); pose.hry = lerp(pose.hry, -64, w); pose.er = lerp(pose.er, 0, w) } else { pose.hlx = lerp(pose.hlx, ax - 6, w); pose.hly = lerp(pose.hly, -64, w); pose.el = lerp(pose.el, 0, w) }
    }
  }
  return { x, z, pose, lift: 0, turn, low: a > down + 60 }
}
// the jump and the turn, as a man (a: ms since the goal; x, z where he is)
function spinnerAt(c, a, x, z) {
  const p = c.pace, t = (a - c.run) / p
  if (t < 0) {
    // the run in to the corner, the arms pumping
    return { x, z, pose: runPose(a / 250, 1), lift: 0, turn: 0, low: false }
  }
  if (t < SPIN.off) {
    // two quick skipping steps, shortening, the arms swinging down and back to load the jump
    const f = t / SPIN.off, step = runPose(c.run / 250 + f * 1.1, lerp(0.9, 0.45, f))
    const load = pz({ hy: 47, bow: 0.12, lx: -8, rx: 8, lk: 0.45, rk: 0.45, hlx: -17, hly: -50, hrx: 17, hry: -50, el: 0, er: 0, fore: 0.9, tilt: 0.1 })
    return { x, z, pose: mix(step, load, smoothS(prog(f, 0.45, 1))), lift: Math.abs(Math.sin(f * Math.PI * 2)) * 0.05, turn: 0, low: false }
  }
  if (t < SPIN.land) {
    // in the air: off both feet, the arms come up, the knees tuck a touch, and he turns half way round over the
    // jump (the turn's quickest in the middle of it), to land facing back up the pitch
    const f = (t - SPIN.off) / (SPIN.land - SPIN.off), lift = 4 * SPIN.peak * f * (1 - f)
    const pose = mix(mix(POSE.ready, SPIN_AIR, smoothS(prog(f, 0, 0.3))), SPIN_LAND, smoothS(prog(f, 0.7, 1)))
    return { x, z, pose, lift, turn: smoothS(prog(f, 0.08, 0.92)), low: false }
  }
  // down hard: the dip of the landing and back up into it, then held, the shout going on, the chest out
  const u = t - SPIN.land, dip = Math.sin(prog(u, 0, 220) * Math.PI) * (1 - prog(u, 0, 220) * 0.4)
  const pose = { ...SPIN_LAND }
  pose.hy -= dip * 4.5; pose.hly += dip * 3; pose.hry += dip * 3
  const hold = Math.sin(Math.max(0, u - 300) / 180) * (1 - prog(u, 900, 1600))
  pose.hlx -= hold * 1.2; pose.hrx += hold * 1.2; pose.tilt = SPIN_LAND.tilt + 0.15 * prog(u, 0, 300)
  return { x, z, pose, lift: 0, turn: 1, low: false }
}
// a teammate i: in from where he was, then in with him, turned to the fans like him
export function mateAt(c, i, age, me = null) {
  const m = c.mates[i], s = me ?? scorerAt(c, age), a = Math.max(0, age), p = c.pace
  // (up to speed in a few strides, then easing down as he gets to him: a jog in at the end, not a dive)
  const T = m.arrive, f = clamp(a / T, 0, 1), A0 = 0.2, A1 = 0.22, e = (f < A0 ? (f * f) / (2 * A0) : f > 1 - A1 ? 1 - A0 / 2 - A1 / 2 - ((1 - f) * (1 - f)) / (2 * A1) : f - A0 / 2) / (1 - A0 / 2 - A1 / 2)
  const u = 1 - e, x = u * u * m.x + 2 * u * e * m.qx + e * e * m.tx, z = u * u * m.z + 2 * u * e * m.qz + e * e * m.tz
  // (he faces the way he's running; once he's in with him, he's turned with him toward the crowd)
  const dz = m.tz - m.z, runTurn = dz < -Math.abs(m.tx - m.x) * 0.5 ? 1 : 0, sp = (Math.hypot(m.tx - m.x, m.tz - m.z) / (T / 1000)) * clamp(Math.min(f / A0, (1 - f) / A1 + 0.25), 0, 1)
  const k = clamp(sp / 7, 0.3, 1), ph = (age + i * 90) / 255
  // (the last strides, the arms come up: he's after him)
  const runP = () => mix(runPose(ph, k), runPose(ph, k, null, { arms: 'fist' }), smoothS(prog(f, 0.6, 0.95)) * (m.role === 'point' ? 0 : 0.6))
  const t = a - T
  const dxr = (s.x - m.tx) / RIG_M   // (the scorer, across from him, in his own units)
  const kneeling = c.move !== 'spin', sh = kneeling ? -58 : -82, hd = kneeling ? -72 : -98, sg = Math.sign(dxr) || -m.sd
  const live = Math.sin(Math.max(0, t) / 170 + i) * (1 - prog(t, 700, 1500))
  let pose
  if (m.role === 'hug') {
    // the arm round him (across his shoulders), the other fist up to the fans, bent in over him if he's down
    pose = pz({ hy: kneeling ? 49 : 52, bow: kneeling ? 0.3 : 0.08, lean: sg * (kneeling ? 0.12 : 0.06), hx: dxr * 0.05, lx: -8, rx: 8, lk: 0.3, rk: 0.3, elbow: 0.1, fore: 0.4, face: 1, tilt: 0.35 })
    const near = dxr + sg * 6, up = -112 + live * 4
    if (sg > 0) { pose.hrx = near; pose.hry = sh; pose.hlx = -16; pose.hly = up; pose.el = 0.3 } else { pose.hlx = near; pose.hly = sh; pose.hrx = 16; pose.hry = up; pose.er = 0.3 }
  } else if (m.role === 'pat') {
    // a hand on his head (a ruffle of it), the other arm out to the crowd
    pose = pz({ hy: 52, bow: kneeling ? 0.18 : 0.05, lean: sg * 0.05, lx: -8, rx: 8, lk: 0.2, rk: 0.2, elbow: 0.15, fore: 0.3, face: 1, tilt: 0.3 })
    const near = dxr * 0.9, ruffle = Math.sin(Math.max(0, t) / 90) * 2 * (1 - prog(t, 300, 900))
    if (sg > 0) { pose.hrx = near + ruffle; pose.hry = hd; pose.hlx = -30; pose.hly = -96; pose.el = 0.1 } else { pose.hlx = near + ruffle; pose.hly = hd; pose.hrx = 30; pose.hry = -96; pose.er = 0.1 }
  } else {
    // alongside, both arms out at him: this man, him
    pose = pz({ hy: 51, bow: 0.05, lean: sg * 0.03, lx: -10, rx: 10, lk: 0.2, rk: 0.2, elbow: 0, fore: 0.1, face: 1, tilt: 0.25 })
    const ax = sg * 34, ay = -82 + live * 2
    if (sg > 0) { pose.hrx = ax; pose.hry = ay; pose.fr = 1; pose.hlx = ax * 0.55; pose.hly = ay - 2; pose.fl = 1 } else { pose.hlx = ax; pose.hly = ay; pose.fl = 1; pose.hrx = ax * 0.55; pose.hry = ay - 2; pose.fr = 1 }
  }
  if (t < -200 * p) return { x, z, pose: runP(), lift: 0, turn: runTurn }
  const g = smoothS(prog(t, -200 * p, 160 * p))
  return { x, z, pose: mix(runP(), pose, g), lift: 0, turn: lerp(runTurn, 0, g) }
}
// The lens on the slide: once he's off, the camera eases in on where he'll go down (the end of the slide in the middle
// of the picture, close enough that the slide and the pile on him fill it), and stays there. C: the game's camera.
export function celebLens(C, c, age, view) {
  if (!c || c.kind !== 'slide' || !C) return C
  const k = smoothS(prog(age, 0, c.run * 0.7 + 200))
  if (k <= 0) return C
  // (with him as he goes, settling on where the slide ends)
  const d = slideDist(c, age), w = smoothS(prog(age, 0, c.stop)), px = c.from.x + c.ux * d, pz0 = c.from.z + c.uz * d
  const tx = lerp(px, c.end.x, w), tz = lerp(pz0, c.end.z, w)
  // (down a little, and close: a man about a quarter of the picture high, his feet clear of the controls)
  const y = lerp(C.y, Math.min(C.y, 3), k), fx = C.sn ?? 0, fz = C.cy ?? 1, want = 44 + (view.h - 140) * 0.72
  const D = Math.max(4.2, (1.8 * C.F) / (view.h * 0.25), (y * C.F) / Math.max(30, want - C.hz))
  return { ...C, y, x: lerp(C.x, tx - fx * D, k), z: lerp(C.z, tz - fz * D, k) }
}
// The slide's marks on the grass ('under': the skid, under the men) and the spray off his knees ('over': over them)
const rnd = s => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
export function celebFx(ctx, C, c, age, layer = 'under') {
  if (!c || c.kind !== 'slide') return
  if (c.move === 'spin') {
    // the landing: a puff of turf and dust off his studs, out low and wide, falling back
    const at = c.run + SPIN.land * c.pace
    if (layer !== 'over' || lightMode() || age < at) return
    const t = (age - at) / 1000
    if (t > 0.7) return
    ctx.save()
    const fade = 1 - t / 0.7, q0 = P(C, c.end.x, 0.05, c.end.z)
    if (q0.ok) { ctx.globalAlpha = 0.3 * fade; ctx.fillStyle = '#e8eedf'; ctx.beginPath(); ctx.ellipse(q0.x, q0.y, q0.s * (0.5 + t * 1.2), q0.s * (0.1 + t * 0.15), 0, 0, 6.2832); ctx.fill() }
    for (let i = 0; i < 22; i++) {
      const r1 = rnd(c.seed * 13 + i * 7), r2 = rnd(c.seed * 29 + i * 11), ang = r1 * 6.2832, sp = 0.8 + r2 * 1.6, vy = 0.5 + r2 * 1.2, life = (2 * vy) / 9.8
      if (t > life) continue
      const X = c.end.x + Math.cos(ang) * (0.25 + sp * t), Z = c.end.z + Math.sin(ang) * (0.25 + sp * t) * 0.6, Y = vy * t - 4.9 * t * t
      const q = P(C, X, Math.max(0, Y), Z)
      if (!q.ok) continue
      ctx.globalAlpha = 0.4 + 0.6 * (1 - t / life); ctx.fillStyle = ['#3f9a55', '#2c7a42', '#6bc47a', '#5a3e25'][i % 4]
      const sz = Math.max(1, q.s * 0.04); ctx.fillRect(q.x - sz, q.y - sz * 0.3, sz * 2, sz * 0.6)
    }
    ctx.restore()
    return
  }
  const hit = c.run + 40 * c.pace
  if (age < hit) return
  const at = a => { const d = slideDist(c, a); return [c.from.x + c.ux * d, c.from.z + c.uz * d] }
  const nx = -c.uz, nz = c.ux
  if (layer === 'under') {
    // two strips of flattened, darker turf where his knees went, a scuffed lighter edge; they stay
    const [x0, z0] = at(hit), [x1, z1] = at(Math.min(age, c.stop))
    if (Math.hypot(x1 - x0, z1 - z0) < 0.05) return
    ctx.save()
    for (const sd of [-1, 1]) {
      const o = sd * 0.15, w0 = 0.05, w1 = 0.1
      ctx.fillStyle = 'rgba(8,38,18,.42)'; ctx.beginPath()
      flat(ctx, C, [x0 + nx * (o - w0), z0 + nz * (o - w0), x1 + nx * (o - w1), z1 + nz * (o - w1), x1 + nx * (o + w1), z1 + nz * (o + w1), x0 + nx * (o + w0), z0 + nz * (o + w0)]); ctx.fill()
      ctx.fillStyle = 'rgba(150,200,140,.16)'; ctx.beginPath()
      flat(ctx, C, [x0 + nx * (o + w0), z0 + nz * (o + w0), x1 + nx * (o + w1), z1 + nz * (o + w1), x1 + nx * (o + w1 + 0.03), z1 + nz * (o + w1 + 0.03), x0 + nx * (o + w0 + 0.01), z0 + nz * (o + w0 + 0.01)]); ctx.fill()
    }
    ctx.restore()
    return
  }
  if (lightMode()) return
  // the spray: bits of turf and water thrown up off his knees, forward and out, falling back
  ctx.save()
  const n = Math.round(48 * c.len / 2.6)
  for (let i = 0; i < n; i++) {
    const r1 = rnd(c.seed * 31 + i * 7), r2 = rnd(c.seed * 17 + i * 13), r3 = rnd(c.seed * 7 + i * 29), r4 = rnd(c.seed + i * 41)
    const ts = hit + r1 * r1 * c.S * 0.75, t = (age - ts) / 1000
    if (t < 0) continue
    const u = clamp((ts - c.run) / c.S, 0, 1), vs = c.v * (1 - u)   // (his pace when it came off)
    const vy = 0.7 + r2 * r2 * 2.3, life = (2 * vy) / 9.8
    if (t > life) continue
    const sd = r3 < 0.5 ? -1 : 1, [kx, kz] = at(ts)
    const fw = vs * (0.55 + 0.45 * r4), out = sd * (0.4 + 1.5 * r2)
    const X = kx + nx * sd * 0.15 + c.ux * fw * t + nx * out * t, Z = kz + nz * sd * 0.15 + c.uz * fw * t + nz * out * t, Y = 0.05 + vy * t - 4.9 * t * t
    const q = P(C, X, Math.max(0, Y), Z)
    if (!q.ok) continue
    const water = i % 2 === 0, sz = Math.max(1, q.s * (water ? 0.035 : 0.045)), fade = 1 - t / life
    ctx.globalAlpha = 0.35 + 0.65 * fade
    ctx.fillStyle = water ? '#e6f2f6' : ['#3f9a55', '#2c7a42', '#6bc47a', '#5a3e25'][i % 4]
    if (water) { ctx.beginPath(); ctx.arc(q.x, q.y, sz * 0.6, 0, 6.2832); ctx.fill() }
    else { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(r4 * 6 + t * 9); ctx.fillRect(-sz, -sz * 0.25, sz * 2, sz * 0.5); ctx.restore() }
  }
  // a low puff of spray at the knees while he's going quick
  const u = clamp((age - c.run) / c.S, 0, 1)
  if (u < 1) {
    const [kx, kz] = at(age), q = P(C, kx + c.ux * 0.35, 0.08, kz + c.uz * 0.35)
    if (q.ok) { ctx.globalAlpha = 0.28 * (1 - u); ctx.fillStyle = '#e8f4f0'; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.s * (0.45 + 0.2 * u), q.s * 0.12, 0, 0, 6.2832); ctx.fill() }
  }
  ctx.restore()
}
// the beaten keeper: down where he landed (face-down, or sat up with his hands on his knees), then up, back into the
// net for the ball, and out with it. at: { x, z, rot } where he finished. Returns { x, z, pose, lift, front, holds }
export function keeperBeaten(c, age, at) {
  const a = Math.max(0, age), side = Math.sign(at.rot ?? 1) || 1
  // (at.lift: where his dive left him. keeperDive lays him on the grass, KEEPER_DOWN; a dive of a game's own ends at 0)
  const lie = at.lift ?? 0, r0 = at.rot ?? side * 1.4
  // his arms come down to his sides before he moves: a beaten keeper is never seen with his hands up
  // (face-down, he gets up round his knees: he's up a little toward where his legs were)
  const upDx = Math.abs(r0) < 0.6 || c.keeper === 'sit' ? 0 : -Math.sin(side * 1.52) * KNEEL_D * RIG_M
  const flat = (rot, f) => { const d = landedOf(Math.sign(rot) || 1, rot); return { ...armsIn(d, { ...d, hlx: -9.5, hrx: 9.5, hly: -50, hry: -50, elbow: 0, fore: 0 }, f), rot, tilt: -f, face: 2 } }
  // (still on his feet, beaten where he stood: his hands drop to his knees, then his hips)
  if (Math.abs(r0) < 0.6 && a < 1550) {
    const base = at.pose ?? POSE.set
    return { x: at.x, z: at.z, pose: a < 900 ? mix(base, { ...POSE.knees, face: 2 }, ease(prog(a, 120, 520))) : mix({ ...POSE.knees, face: 2 }, POSE.hips, ease(prog(a, 900, 1300))), lift: lie * (1 - prog(a, 0, 200)), front: true }
  }
  if (a < 1150) {
    if (c.keeper === 'sit') {
      const f = ease(prog(a, 520, 900))
      return { x: at.x, z: at.z, pose: a < 520 ? flat(r0, ease(prog(a, 220, 520))) : feetDown(mix(flat(r0, 1), POSE.sit, f), flat(r0, 1), POSE.sit, f), lift: lie * (1 - f), front: true }
    }
    // face-down: rolled over on to his front
    return { x: at.x, z: at.z, pose: { ...flat(lerp(r0, side * 1.52, ease(prog(a, 0, 260))), ease(prog(a, 260, 700)) * 0.12), tilt: -1 }, lift: lie, front: a < 300, holds: false }
  }
  if (a < 1550) {
    if (c.keeper === 'sit') return { x: at.x, z: at.z, pose: mix(POSE.sit, POSE.hips, ease(prog(a, 1150, 1550))), lift: 0, front: true }
    // up off the grass: his hands under his shoulders and a push up, his knees staying on the grass (he comes up round
    // them, never swung up off his feet), up on to his knees, then his feet, his hands on his hips
    const u = ease(prog(a, 1420, 1550))
    if (u > 0) return { x: at.x + upDx, z: at.z, pose: offKnees(KNEEL_UP, POSE.hips, u), lift: 0, front: true }
    const pu = smoothS(prog(a, 1150, 1270)), k = smoothS(prog(a, 1240, 1420)), r = side * 1.52 * (1 - k)
    const pose = mix(flat(side * 1.52, 0.12), KNEEL_UP, k)
    pose.rot = r; pose.tilt = lerp(-1, KNEEL_UP.tilt, k)
    // (the push: the hands flat on the grass under his shoulders, going to his thighs once he's up on his knees)
    const ground = (out) => [out * 6 + Math.sin(r) * 23, -(pose.hy + 26) + Math.cos(r) * 23]
    const w = pu * (1 - smoothS(prog(k, 0.5, 1)))
    const [lx, ly] = ground(-1), [rx, ry] = ground(1)
    pose.hlx = lerp(pose.hlx, lx, w); pose.hly = lerp(pose.hly, ly, w); pose.hrx = lerp(pose.hrx, rx, w); pose.hry = lerp(pose.hry, ry, w)
    pose.elbow = lerp(pose.elbow, 0.15, w); pose.fore = lerp(pose.fore, 0, w)
    // (the hips' height as he comes up round his knees, never under where he lay)
    const hipM = Math.max(HIP_M + lie, (2 + KNEEL_D * Math.cos(r)) * RIG_M)
    return { x: at.x + (Math.sin(side * 1.52) - Math.sin(r)) * -KNEEL_D * RIG_M, z: at.z, pose, lift: hipM - pose.hy * RIG_M, front: Math.abs(r) < 0.95 }
  }
  // back into the net, slowly, his back to us now
  const ball = at.ball ?? { x: at.x * 0.6, z: 1.4 }
  const f = prog(a, 1550, 2300)
  const x = lerp(at.x + upDx, ball.x, ease(f)), z = lerp(at.z, ball.z - 0.4, ease(f))
  if (f < 1) return { x, z, pose: { ...runPose(a / 420, 0.35), tilt: -0.6, hlx: -11, hly: -57, hrx: 11, hry: -57, elbow: 1 }, lift: 0, front: false }
  return { x, z, pose: mix(POSE.stand, POSE.pick, Math.sin(clamp((a - 2300) / 500, 0, 1) * Math.PI)), lift: 0, front: false, holds: a > 2550 }
}
// their defenders once it's gone in: hands on hips, hands on knees, or a word with a teammate. Never a hand up.
export function defenderBeaten(i, age, base = POSE.stand) {
  const f = ease(prog(age, 150 + i * 120, 600 + i * 120))
  const to = i % 3 === 0 ? POSE.hips : i % 3 === 1 ? POSE.knees : { ...POSE.argue, head: i % 2 ? 0.8 : -0.8 }
  return mix(base, to, f)
}
// A keeper's dive, to the side K (+1: the screen's right, as he's drawn), ms after he went. He sets, pushes off, and
// flies with his arms over his head, his body at the angle the ball asks for (flat for a low one, up for one under the
// bar), then comes down on his side on the grass. o: { hx, hy: where his hands get to (metres across from where he
// stood, and up): the ball, when he saves it; short of it when it beats him. at: ms into the dive his hands are there }
// → { dx (across from where he stood), lift, pose, down (he's landed), end (ms into it he lands) }. KEEPER_DOWN: the
// lift that lays a man flat. handsOf(pose, lift): where a man's hands are (metres across from his feet, and up)
const ARM_M = (121 - 53) * RIG_M, HIP_M = 53 * RIG_M
export const KEEPER_DOWN = -(HIP_M - 0.17)
const KNEEL = { ...POSE.knees, hy: 27, ly: 2, ry: 2, lk: -1, rk: -1, face: 2 }, KNEEL_D = 25
// Up off his knees the way a man gets up: one foot brought through and planted under him (that knee up in front of
// him), then the push up off it, the other knee coming up off the grass as he rises. f: 0 on his knees, 1 stood (to)
function offKnees(from, to, f) {
  const a = smoothS(clamp(f / 0.45, 0, 1)), b = smoothS(clamp((f - 0.4) / 0.6, 0, 1))
  // (half up: the right foot flat under him, the knee up toward us, the left knee still down)
  const half = { ...from, hy: 30, rx: 9, ry: 0, rk: 0.85, lean: -0.04, hx: -1 }
  const p = mix(mix(from, half, a), to, b)
  p.knr = (1 - a) * (1 - b); p.knl = 1 - b; p.kn = 0
  return p
}
// (a beaten keeper up on his knees off his front: knees on the grass, shins flat behind, hands on his thighs, head down)
const KNEEL_UP = pz({ hy: 27, bow: 0.15, lx: -10, ly: 0, rx: 10, ry: 0, lk: -1, rk: -1, kn: 1, hlx: -9, hly: -30, hrx: 9, hry: -30, elbow: 0.3, tilt: -0.7, face: 2 })
// (for a game's own keeper: on his knees with it, and up with it held to his chest)
POSE.kneel = { ...KNEEL, face: 0, tilt: 0.2, hlx: -6, hrx: 6, hly: -46, hry: -46 }
const smoothS = f => f * f * (3 - 2 * f)
// A keeper on his line before the kick: on the balls of his feet, a little bounce in his knees, his weight going from
// one foot to the other, the hands low and out in front, never up by his head. t: ms (anything that runs); set 0-1
// (1: the taker's on his last strides, he's down and still); lean: the side he's shading (-1..1). → { pose, lift }
export function keeperReady(t, set = 0, lean = 0) {
  const b = Math.abs(Math.sin(t / 190)) * (1 - set), w = Math.sin(t / 380) * (1 - set)
  const p = { ...POSE.set }
  p.hy = lerp(46.5, 44.5, set) - b * 1.4
  p.lk = p.rk = lerp(0.34, 0.45, set) + b * 0.1
  p.ly = -0.9 * b + (w > 0 ? -w * 1.2 : 0); p.ry = -0.9 * b + (w < 0 ? w * 1.2 : 0)
  p.hx = w * 1.1 + lean * 2.4; p.lean = -w * 0.02 + lean * 0.05
  p.hlx = lerp(-17, -15.5, set) + p.hx * 0.8; p.hrx = lerp(17, 15.5, set) + p.hx * 0.8
  p.hly = p.hry = -(p.hy + lerp(5, 6, set)) + b * 0.6
  p.fl = p.fr = 0
  return { pose: p, lift: 0 }
}
// a keeper in the air toward K (+1: the screen's right, which is his own right side down once he's turned over): the
// bottom leg long, the top one bent at the knee, the hands together over his head, the top one reaching further
// a man on the grass bringing his arms in from over his head: in close past his head and down his front, never
// swung out through the air beside him
// a man coming up off his side to sitting (or the other way), the pose mixed from a to b at f: his feet kept where they
// are on the screen's grass, so the legs swing round on the ground and never up into the air as his body turns
function feetDown(p, a, b, f) {
  const at = (q, x, y) => { const r = q.rot ?? 0, dx = x - (q.hx ?? 0), dy = y - 2.6 + (q.hy ?? 53); return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)] }
  const r = -(p.rot ?? 0), o = { ...p }
  for (const [kx, ky] of [['lx', 'ly'], ['rx', 'ry']]) {
    const A = at(a, a[kx] ?? DEF[kx], a[ky] ?? 0), B = at(b, b[kx] ?? DEF[kx], b[ky] ?? 0), T = [lerp(A[0], B[0], f), lerp(A[1], B[1], f)]
    o[kx] = (p.hx ?? 0) + T[0] * Math.cos(r) - T[1] * Math.sin(r); o[ky] = -(p.hy ?? 53) + 2.6 + T[0] * Math.sin(r) + T[1] * Math.cos(r)
  }
  return o
}
function armsIn(a, b, f) {
  const mid = { ...a, hlx: -3, hrx: 3, hly: -96, hry: -96, elbow: 0.5, fore: 0.6 }
  return f < 0.5 ? mix(a, mid, smoothS(f * 2)) : mix(mid, b, smoothS(f * 2 - 1))
}
const landedOf = (K, rot = K * 1.52) => { const f = diveOf(K); return { ...f, lk: 0.3, rk: 0.3, ly: K > 0 ? -6 : -2, ry: K > 0 ? -2 : -6, rot } }
function diveOf(K) {
  const p = { ...POSE.dive, lx: -5, ly: 0, lk: 0, rx: 5, ry: 0, rk: 0, hlx: -6, hly: -127, hrx: 6, hry: -124, elbow: 0, fore: 0, face: 1, tilt: 0.3 }
  if (K > 0) { p.lx = -4; p.ly = -19; p.lk = 0.95; p.hlx = -8; p.hly = -129; p.hrx = 3; p.hry = -121 }
  else { p.rx = 4; p.ry = -19; p.rk = 0.95; p.hrx = 8; p.hry = -129; p.hlx = -3; p.hly = -121 }
  return p
}
export function keeperDive(ms, K, o = {}) {
  const at = clamp(o.at ?? 520, 260, 780), reach = Math.max(0.2, Math.abs(o.hx ?? 2.6)), hy = clamp(o.hy ?? 1, 0.2, 2.6)
  // (a ball near him: he can't be flat and still have his hands on it)
  const rc = Math.min(lerp(1.5, 0.62, clamp((hy - 0.5) / 1.8, 0, 1)), Math.asin(clamp((reach - 0.05) / ARM_M, 0.2, 1)))
  const Lc = clamp(hy - HIP_M - Math.cos(rc) * ARM_M, KEEPER_DOWN, 0.9), xc = Math.max(0.05, reach - Math.sin(rc) * ARM_M)
  const PUSH = Math.min(130, at * 0.3)
  // (the push: low, the weight on the near foot, the far one stepping across; then he flies, the bottom leg long, the
  // top one bent up behind it, both hands going for it, the top one over)
  const crouch = { ...POSE.set, hy: 37, lean: K * 0.26, hx: K * 5, hlx: -24 + K * 10, hrx: 24 + K * 10, hly: -49, hry: -49, elbow: 0.1, lx: K > 0 ? -9 : -17, rx: K > 0 ? 17 : 9 }
  const fly = diveOf(K)
  const fall = 220 + Math.max(0, Lc - KEEPER_DOWN) * 190, end = at + fall
  if (ms <= PUSH) { const f = ease(clamp(ms / PUSH, 0, 1)); return { dx: K * 0.14 * f, lift: 0, pose: mix(POSE.set, crouch, f), down: false, end } }
  if (ms <= at) {
    const f = clamp((ms - PUSH) / (at - PUSH), 0, 1), e = f * (1.5 - 0.5 * f), hop = Lc < 0 ? 0.08 : 0.22
    const pose = mix(crouch, { ...fly, rot: K * rc }, smoothS(clamp(f / 0.55, 0, 1)))
    return { dx: K * lerp(0.14, xc, e), lift: Lc * e + Math.sin(f * Math.PI) * hop * (1 - f * 0.5), pose, down: false, end }
  }
  const g = clamp((ms - at) / fall, 0, 1)
  return { dx: K * (xc + 0.38 * ease(g)), lift: lerp(Lc, KEEPER_DOWN, g * g), pose: { ...mix(fly, landedOf(K), ease(g)), rot: K * lerp(rc, 1.52, ease(g)) }, down: g >= 1, end }
}
export function handsOf(p, lift = 0) {
  const hip = p.hy ?? 53, r = p.rot ?? 0, ux = ((p.hlx ?? -16) + (p.hrx ?? 16)) / 2 - (p.hx ?? 0)
  let uy = -((p.hly ?? -47) + (p.hry ?? -47)) / 2 - hip
  uy = Math.min(uy, 68)   // (an arm's only so long)
  return { x: ((p.hx ?? 0) + ux * Math.cos(r) + uy * Math.sin(r)) * RIG_M, y: (hip + uy * Math.cos(r) - ux * Math.sin(r)) * RIG_M + lift }
}
// where that dive leaves him (for keeperBeaten's at, and keeperUp's from): { dx, rot, lift }
export function keeperLanded(K, o = {}) { const d = keeperDive(1e6, K, o); return { dx: d.dx, rot: d.pose.rot, lift: d.lift } }
// A keeper who's made the save, off the grass: a moment down, on to his knees, up, then the roar. from: { rot, lift }
// where his dive left him (on his feet: straight to the roar). age: ms since the save. → { pose, lift }
// (held: the ball's in his arms: he clutches it to his chest and roars over it, no fist)
const CLUTCH = { ...POSE.stand, hlx: -6, hly: -77, hrx: 6, hry: -77, elbow: 0.7, face: 1, tilt: 0.4 }
POSE.clutch = CLUTCH
export function keeperUp(age, from = {}, roar = true, held = false) {
  const r0 = from.rot ?? 0, l0 = from.lift ?? 0
  if (held) roar = false
  const end = held ? CLUTCH : POSE.stand
  if (Math.abs(r0) < 0.5) return { pose: roar ? keeperRoar(age - 200, from.pose ?? POSE.set) : mix(from.pose ?? POSE.set, end, ease(prog(age, 0, 400))), lift: l0 * (1 - prog(age, 0, 200)) }
  // (down on his side: the arms in, rolled up to sitting (the hips stay on the grass the whole way), on to his feet
  // from a crouch, then the roar)
  const K = Math.sign(r0) || 1, down = landedOf(K, r0)
  const hc = held ? [6, 22] : null
  const lying = { ...down, hlx: hc ? -hc[0] : -9.5, hrx: hc ? hc[0] : 9.5, hly: hc ? -75 : -50, hry: hc ? -75 : -50, elbow: 0, fore: 0 }
  const sitUp = { ...POSE.sit, face: 0, tilt: 0.25, hlx: hc ? -6 : -15, hrx: hc ? 6 : 15, hly: hc ? -38 : -24, hry: hc ? -38 : -24 }
  const crouch = { ...POSE.knees, hy: 34, bow: 0.3, lx: -12, rx: 12, lk: 0.8, rk: 0.8, face: 0, tilt: 0.1, hlx: hc ? -6 : -12, hrx: hc ? 6 : 12, hly: hc ? -60 : -38, hry: hc ? -60 : -38 }
  if (age < 380) return { pose: armsIn(down, lying, prog(age, 160, 380)), lift: l0 }
  if (age < 640) {
    // (rolling up to sitting: the hands stay down by his hips the whole way (or on the ball at his chest), never
    // swinging up past his head as the body turns under them)
    const f = smoothS(prog(age, 380, 640)), p = feetDown(mix(lying, sitUp, f), lying, sitUp, f)
    const up = hc ? lerp(22, 27, f) : lerp(-1, 13, f * f * f), out = hc ? 6 : lerp(11, 15, f)
    return { pose: { ...p, hly: -(p.hy + up), hry: -(p.hy + up), hlx: -out, hrx: out, elbow: hc ? 0.6 : 0, el: 0, er: 0 }, lift: l0 * (1 - f) }
  }
  if (age < 860) return { pose: mix(sitUp, crouch, smoothS(prog(age, 640, 860))), lift: 0 }
  if (age < 1060) return { pose: mix(crouch, end, smoothS(prog(age, 860, 1060))), lift: 0 }
  return { pose: roar ? keeperRoar(age - 1060 + 280, POSE.stand) : end, lift: 0 }
}
// A keeper set on his line and a shot coming: the whole of it, from set to what he does after. One near him he takes
// on his feet, his hands to it; one away from him he dives for (keeperDive): on to it when he saves it, short of it
// when he's beaten, and only as far as the time he had. Then: beaten, he's down and gets the ball out of the net
// (keeperBeaten); a save, he's up and roaring (keeperUp); off target, he just gets up.
// o: { x0, z (where he stood), go (when he moves), cross (when the ball reaches him), ball: { x, y } (where it crosses
// him), saved, res ('goal' 'saved' or anything else once it's over), resAt, cel (the celebration, for keeperBeaten),
// ballIn: { x, z } (the ball in the net), base (his pose before he goes), held (he's caught it) }
// → { x, z, lift, pose, front, holds }
export function keeperShot(t, o) {
  const off = o.ball.x - o.x0, K = Math.sign(off) || 1, dist = Math.abs(off), z = o.z
  if (t < o.go) return { x: o.x0, z, lift: 0, pose: o.base ?? POSE.set, front: true }
  let me, landAt, from
  if (dist <= 1.15) {
    const end = Math.max(o.go + 180, o.cross), f = ease(prog(t, o.go, end)), y = o.ball.y, low = y < 0.6
    const shift = clamp(off, -1, 1) * 0.5, hx = clamp((off - shift) / RIG_M, -34, 34), hy = -clamp(y / RIG_M, 16, 118)
    const b0 = o.base ?? POSE.set
    const pose = { ...POSE.set, hy: lerp(b0.hy ?? 45, y > 1.5 ? 53 : low ? 31 : 47, f), bow: low ? 0.16 + 0.34 * f : 0.16, hlx: lerp(b0.hlx ?? -17.5, hx - 7, f), hly: lerp(b0.hly ?? -51, hy, f), hrx: lerp(b0.hrx ?? 17.5, hx + 7, f), hry: lerp(b0.hry ?? -51, hy, f) }
    me = { x: o.x0 + shift * f, z, lift: y > 2 ? Math.sin(f * Math.PI) * 0.25 : 0, pose, front: true }
    landAt = end; from = { x: o.x0 + shift, rot: 0, lift: 0, pose }
  } else {
    const room = Math.max(0, o.cross - o.go)
    const D = { hx: Math.min(o.saved ? dist : Math.max(0.9, dist - 0.55), o.saved ? 9 : 1.1 + room * 0.0045), hy: !o.saved && o.ball.y > 1.9 ? o.ball.y - 0.4 : o.ball.y, at: clamp(room, 280, 780) }
    const d = keeperDive(t - o.go, K, D), L = keeperLanded(K, D)
    me = { x: o.x0 + d.dx, z, lift: d.lift, pose: d.pose, front: true }
    landAt = o.go + d.end + 80; from = { x: o.x0 + L.dx, rot: L.rot, lift: L.lift }
  }
  if (!o.res || t < landAt) return me
  const at = { ...from, z, ball: o.ballIn }
  if (o.res === 'goal' && o.cel) return keeperBeaten(o.cel, t - Math.max(landAt, o.resAt ?? 0), at)
  const u = keeperUp(t - Math.max(landAt, (o.resAt ?? 0) + 300), at, o.res === 'saved', !!o.held)
  return { x: at.x, z, lift: u.lift, pose: u.pose, front: true }
}
// A saved ball that isn't held: palmed round the post from out wide, tipped over the bar from the middle or from
// under it. It never crosses the line between the posts. p: where he met it { x, y }; z: his line; age: ms since
export function parried(p, age, z = -0.3) {
  const sd = Math.sign(p.x) || 1, g = clamp(age / 700, 0, 1)
  if (Math.abs(p.x) > 1.3 && p.y < 1.9) { const x = p.x + sd * (POST + 1.6 - Math.abs(p.x)) * ease(g); return { x, y: Math.max(0.11, p.y + Math.sin(g * Math.PI) * 0.7 - g * p.y * 0.8), z: z - 0.1 + Math.max(0, Math.abs(x) - POST - 0.25) * 2.2, spin: 9 + g * 6 } }
  return { x: p.x + sd * g * 0.8, y: p.y + (BAR + 1 - p.y) * ease(Math.min(1, g * 2.2)) + g * 0.5, z: z - 0.1 + 3.2 * g * g, spin: 9 + g * 6 }
}
// a ball he's holding: in his hands as he takes it, then pulled in to his chest. kp: the keeper now ({ x, pose, lift })
export function heldBall(kp, age) {
  const h = handsOf(kp.pose, kp.lift ?? 0), r = kp.pose.rot ?? 0, hip = (kp.pose.hy ?? 53) * RIG_M + (kp.lift ?? 0)
  const chest = { x: Math.sin(r) * 0.42, y: hip + Math.cos(r) * 0.42 }, f = ease(prog(age, 120, 520))
  return { x: kp.x + lerp(h.x, chest.x, f), y: Math.max(0.14, lerp(h.y, chest.y, f)) }
}
// a keeper after a save: up, a roar, the fist pumping twice
export function keeperRoar(age, base = POSE.stand) {
  const f = ease(prog(age, 0, 280))
  if (age < 280) return mix(base, POSE.stand, f)
  const pump = Math.abs(Math.sin((age - 280) / 170))
  const fist = { ...POSE.fist, hry: lerp(-86, -116, pump), hrx: 18, face: 1, tilt: 0.4 }
  // (the arm comes up into the first pump: no jump from his side to over his head)
  if (age < 400) return mix(POSE.stand, fist, ease(prog(age, 280, 400)))
  if (age < 1300) return fist
  // (the other arm swings up out to his side to join it, not folded up past his chest)
  const f2 = ease(prog(age, 1300, 1550)), p = mix(POSE.fist, POSE.roar, f2)
  return { ...p, hlx: p.hlx - Math.sin(f2 * Math.PI) * 24, hly: p.hly + Math.sin(f2 * Math.PI) * 6 }
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
  pen: { label: 'PENALTY', speed: [17, 29], acc: 1.1, over: 0.84, apex: 0.15, curve: 0 },
}
const gaussOf = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
// The shot being lined up. v: the grade (finishing and composure); o: { fill (ms to full power), pressure (0-1: the
// situation: the minute, a shootout), windup (ms from the release to the strike) }
export function shooter(v, o = {}) {
  const tv = clamp((v - 1) / 10, 0, 1), fill = o.fill ?? 820, windup = o.windup ?? 190
  const k = {
    phase: 'idle', type: 'driven', at: 0, power: 0, aim: { x: 0, y: -0.2 }, relAt: 0, strikeAt: 0, tapAt: null, timed: 'none',
    drawn: null, drawing: false,   // (a drawn shot: readStroke's read of it; drawing: a finger's on it now)
    fill, windup, tv, pressure: o.pressure ?? 0,
    // the perfect-strike window (ms either side of the strike), and the near-miss band round it
    green: lerp(24, 56, tv) * (1 - 0.3 * (o.pressure ?? 0) * (1 - tv)),
    press(t, type = 'driven') { if (k.phase !== 'idle') return false; k.phase = 'power'; k.type = type; k.at = t; k.power = 0; return true },
    // (the stick's circle spread to the goal's square: pushed into a corner, it's the corner)
    aimAt(x, y) { if (k.phase === 'done' || k.drawn) return; const m = Math.min(1, Math.hypot(x, y)), c = Math.max(Math.abs(x), Math.abs(y)); if (c > 0.01) { x = (x / c) * m; y = (y / c) * m } k.aim.x = clamp(x, -1, 1); k.aim.y = clamp(y, -1, 1) },
    powerAt(t) { return k.phase === 'power' ? clamp((t - k.at) / fill, 0, 1) : k.power },
    release(t) { if (k.phase !== 'power') return false; k.power = clamp((t - k.at) / fill, 0, 1); k.phase = 'strike'; k.relAt = t; k.strikeAt = t + windup; return true },
    // a second tap: the timed finish
    tap(t) {
      if (k.phase !== 'strike' || k.tapAt != null || k.drawn) return false
      k.tapAt = t
      const e = Math.abs(t - k.strikeAt)
      k.timed = e <= k.green ? 'green' : e <= k.green * 2.6 ? 'ok' : 'red'
      return true
    },
    // held right to the end of the bar: it goes anyway, at full power
    tick(t) {
      if (k.phase === 'power' && !k.drawing && t - k.at >= fill + 160) { k.power = 1; k.phase = 'strike'; k.relAt = t; k.strikeAt = t + windup * 0.6 }
      // (a drawn shot has no second tap to wait for: he strikes it as he gets there)
      if (k.phase === 'strike' && t >= k.strikeAt + (k.drawn ? 0 : Math.max(70, k.green * 2.6))) { k.phase = 'done'; return true }
      return false
    },
    // a drawn one's clean-strike band: the top of the range, just short of where it goes over (wider the better the
    // finisher, narrower under pressure). In it, with a steady line, it's struck as sweetly as a perfectly timed one
    band(type) { const D = SHOT_TYPES[type] ?? SHOT_TYPES.driven, w = lerp(0.12, 0.22, tv) * (1 - 0.3 * (o.pressure ?? 0) * (1 - tv)); return [D.over - w, D.over] },
    // a finger's gone down to draw it: he shapes to shoot (no bar filling: the stroke is the power)
    shape(t) { if (k.phase !== 'idle') return false; k.phase = 'power'; k.type = 'driven'; k.at = t; k.power = 0; k.drawing = true; return true },
    reset() { k.phase = 'idle'; k.power = 0; k.tapAt = null; k.timed = 'none'; k.drawn = null; k.drawing = false },
  }
  return k
}
// The shot itself, struck from (x, z) at the goal at z = 0. o: { v, r (the game's random), foot (1 right, -1 left),
// weak (on his weaker foot), speed (0-1 how fast he's going), pressure (0-1 a defender on him), dist override, y0 }
// drawErr: a drawn shot's scatter, against the rest (a game whose goal is small in the picture, where the finger's own
// error is already metres, asks for less). err: the whole scatter, scaled (a game's own difficulty)
// Returns { type, from, to, T (ms in the air), curve, apex, power, timed, err, onTarget, over, wide, speed }
export function strikeOf(k, from, o = {}) {
  const D = SHOT_TYPES[k.type] ?? SHOT_TYPES.driven, r = o.r ?? Math.random
  const tv = clamp(((o.v ?? 6) - 1) / 10, 0, 1), p = k.power, dr = k.drawn
  const dist = Math.hypot(from.x, from.z)
  // where he's aiming: across the goal, low to high (the inside of the posts and the bar). A drawn shot goes where
  // the stroke ended, wherever that is: right in the corner, or off the frame altogether
  let ax = k.aim.x * (POST - 0.7), ay = lerp(0.3, BAR - 0.45, (k.aim.y + 1) / 2)
  if (dr) { ax = dr.x; ay = D.chip ? clamp(dr.y, 0.9, 2.3) : D.low ? Math.min(dr.y, 0.5) : dr.y }
  else if (D.low) ay = 0.22
  else if (D.chip) ay = lerp(1.1, 2.0, (k.aim.y + 1) / 2)
  // how far off it goes: the grade, the range, the power, the type, the body, the pressure, the strike
  const foot = o.foot ?? 1
  const across = D.curve ? 0 : (foot > 0 ? clamp(-(ax - from.x * 0.3) / 3, 0, 1) : clamp((ax - from.x * 0.3) / 3, 0, 1))
  const body = 1 + across * 0.3 + (o.weak ? 0.38 : 0) + (o.speed ?? 0) * 0.32
  const press = 1 + (o.pressure ?? 0) * lerp(1.0, 0.35, tv) + k.pressure * lerp(0.5, 0.15, tv)
  const timed = k.timed === 'green' ? 0.3 : k.timed === 'ok' ? 0.82 : k.timed === 'red' ? 1.75 : 1
  const range = clamp(dist / 16, 0.45, 2)
  const pw = D.chip ? 0.7 + 0.6 * Math.abs(p - 0.5) : 0.42 + 1.3 * p * p
  // (a drawn one: the outside of the boot is the harder strike, and a shaky stroke a less clean one, the more so the
  // poorer the finisher)
  const drawK = dr ? (dr.outside ? DRAW.outsideErr : 1) * (1 + clamp(dr.wobble * 10, 0, 0.6) * lerp(1, 0.4, tv)) * DRAW.err * (o.drawErr ?? 1) : 1
  const err = lerp(0.9, 0.3, tv) * range * D.acc * pw * body * press * timed * drawK * (o.err ?? 1)
  let tx = ax + gaussOf(r) * err, ty = ay + gaussOf(r) * err * 0.55
  // too much on it: up and over (a chip with too much on it clears the bar, with too little drops short)
  let over = false
  if (p > D.over) { ty += (p - D.over) * (D.chip ? 5 : 7.5) * clamp(dist / 14, 0.6, 1.8); if (ty > BAR) over = true }
  if (k.timed === 'red' && r() < 0.35) ty += 0.9
  ty = Math.max(D.low ? 0.11 : 0.15, ty)
  const wide = Math.abs(tx) > POST - 0.12
  const speed = lerp(D.speed[0], D.speed[1], clamp(p, 0, 1)) * (k.timed === 'green' ? 1.06 : k.timed === 'red' ? 0.9 : 1) * (o.pace ?? lerp(0.84, 1.08, tv))
  const L = Math.hypot(tx - from.x, -from.z), T = (L / speed) * 1000 * (D.chip ? 1.15 : 1)
  // the curl: out and back in, toward the far post (the side he's aiming)
  // (drawn: the stroke's own bend, as much as his grade gets on it; the outside of the boot gets less)
  const curve = dr ? curlOf(dr, L, tv, r) : D.curve ? -(Math.sign(tx - from.x) || 1) * lerp(0.9, 2.1, clamp(L / 22, 0, 1)) : 0
  const apex = D.chip ? lerp(2.2, 3.6, clamp(L / 18, 0, 1)) + (p - 0.5) : D.apex * clamp(L / 16, 0.4, 1.4)
  return { type: k.type, label: dr ? dr.label : D.label, from: { x: from.x, z: from.z, y: o.y0 ?? 0.11 }, to: { x: tx, y: ty }, T, curve, apex, power: p, timed: k.timed, err, over, wide, onTarget: !over && !wide && ty < BAR - 0.11, speed, low: !!D.low, chip: !!D.chip, dip: !!D.dip, drawn: !!dr, late: !!dr, lob: !!dr, outside: !!dr?.outside }
}
// The ball in flight, ms after the strike: to the goal line at f = 1 and on through it (the game takes it from there)
// (a drawn shot's curl bends late, the way a struck ball does: out on its line, then whipped in as it slows. Lofted,
// it dips: up quickly, and down late onto its spot)
const lateBend = g => (g - g * g * g * g) / 0.4725
const dipArc = g => (g - g * g * g) / 0.3849
export function shotAt(s, ms) {
  const f = ms / s.T, g = clamp(f, 0, 1.4), c = clamp(g, 0, 1)
  const x = lerp(s.from.x, s.to.x, g) + s.curve * (s.late ? lateBend(c) : Math.sin(c * Math.PI)) * (g > 1 ? 0 : 1)
  const z = lerp(s.from.z, 0, g)
  let y
  if (s.low) { const b = Math.abs(Math.sin(c * Math.PI * 1.5)); y = 0.11 + b * 0.22 + lerp(0, s.to.y - 0.11, g) }
  else if (s.dip) y = lerp(s.from.y, s.to.y, g) + s.apex * Math.sin(c * Math.PI) + (g < 1 ? (1 - g) * g * 0.8 : 0)
  else if (s.lob) y = lerp(s.from.y, s.to.y, g) + s.apex * dipArc(c)
  else y = lerp(s.from.y, s.to.y, g) + s.apex * Math.sin(c * Math.PI)
  return { x, y: Math.max(0.11, y), z, f, spin: g * 16 }
}
// Does the keeper get to it? K: { x, z, reach (m he can cover, standing to full stretch), react (ms), read (-1..1:
// the side he's leaning), up (how high he gets: a standing keeper's 2.4 m, one on the floor's 0.5), span (the longest
// he's in the air, s: 0.55) }
// Returns { saved, held (caught, not parried), x, y, f } where the ball crosses him
export function keeperSave(s, K, r = Math.random) {
  const fk = clamp((K.z - s.from.z) / (0 - s.from.z), 0, 1)
  const at = shotAt(s, fk * s.T)
  const time = Math.max(0, fk * s.T - (K.react ?? 220)) / 1000
  const dx = at.x - K.x, side = Math.sign(dx) || 1
  const lean = (K.read ?? 0) * side   // + he's already going that way
  const cover = (K.reach ?? 1.5) + Math.min(time, K.span ?? 0.55) * (K.dive ?? 4.4) + lean * 0.55
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
  if (k.drawing) return   // (the stroke's trail shows its own pace while it's being drawn)
  const D = SHOT_TYPES[k.type] ?? SHOT_TYPES.driven, p = Math.min(1, k.powerAt(t))
  ctx.fillStyle = 'rgba(6,8,10,.8)'; rr(ctx, x0 - 8, y - 20, w + 16, h + 28, 4); ctx.fill()
  text(ctx, k.drawn ? k.drawn.label : D.label, x0, y - 10, { font: LABEL, size: 13, align: 'left', track: 1.2, color: '#c6c7cb' })
  // (a drawn one in its clean-strike band: said over the bar, in gold)
  if (k.drawn && k.timed === 'green') {
    ctx.fillStyle = 'rgba(6,8,10,.8)'; rr(ctx, x0 + w - 98, y - 46, 106, 22, 4); ctx.fill()
    text(ctx, 'CLEAN STRIKE', x0 + w - 45, y - 34, { font: LABEL, size: 14, track: 1.2, color: '#f7cf55' })
  }
  // the over-the-bar end
  const ov = x0 + w * D.over
  ctx.fillStyle = '#26282c'; ctx.fillRect(x0, y, w, h)
  ctx.save(); ctx.beginPath(); ctx.rect(ov, y, x0 + w - ov, h); ctx.clip()
  ctx.strokeStyle = 'rgba(242,242,238,.28)'; ctx.lineWidth = 1.2
  for (let i = -2; i < 12; i++) { ctx.beginPath(); ctx.moveTo(ov + i * 5, y + h); ctx.lineTo(ov + i * 5 + h, y); ctx.stroke() }
  ctx.restore()
  ctx.fillStyle = k.powerAt(t) > D.over ? '#ff5a48' : '#f2f2ee'; ctx.fillRect(x0, y, w * p, h)
  ctx.strokeStyle = 'rgba(242,242,238,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y + 0.5, w - 1, h - 1)
  // the timed finish: a ring closing on the strike, the window in chalk
  if (!k.drawn && (k.phase === 'strike' || (k.phase === 'done' && t - k.strikeAt < 500))) {
    const cx = x0 + w - 6, cy = y - 10, left = k.strikeAt - t
    const f = clamp(1 - left / k.windup, 0, 1.4)
    ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.2832); ctx.stroke()
    if (k.phase === 'strike' && f < 1.2) { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(cx, cy, 4 + (1 - Math.min(1, f)) * 12, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1 }
    const word = k.drawn ? null : k.timed === 'green' ? 'PERFECT' : k.timed === 'ok' ? 'GOOD' : k.timed === 'red' ? 'MISTIMED' : null
    if (word) text(ctx, word, cx - 12, cy, { font: LABEL, size: 13, align: 'right', track: 1, color: k.timed === 'green' ? '#f7cf55' : k.timed === 'red' ? '#ff8a7a' : '#f2f2ee' })
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

// ── Draw the shot: the stroke is the strike ─────────────────────────────────
// The way the best phone football games do it: a finger (or the mouse) on the ball, and draw the shot. The stroke is
// the strike, and the shooting model above takes it from there (strikeOf, shotAt, keeperSave):
//   where it ends   the spot on the goal: draw it into the top corner and that's where he's putting it. A stroke that
//                   stops short of the goal line goes on along its line, along the grass (the low one)
//   how quick       the pace: a quick stroke is struck hard, a slow one stroked. Too quick and he's leaned back: it
//                   balloons over the bar. The trail shows it as it's drawn: chalk, gold at the top of the range, red
//                   when it's going over
//   its bend        the curl: a stroke bowed out one way and back in is bent with the inside of the boot, bowed the
//                   other way it's the outside of the boot (less bend on it, harder to keep on target). Bowed to the
//                   right is the inside for a right-footer. The ball goes out on its line and bends in late
//   slow and lifted the chip: a soft stroke up into the goal is the dink over the keeper (from twelve yards, the Panenka)
// The striker's grade shapes all of it: a good finisher's stroke comes off truer (less scatter, more bend in his boot),
// a poor one's wilder, and a shaky line costs him more.
//   stroke()                                 the stroke's state (the points, in the picture's units)
//   strokeDown(st, x, y, t, id, ball)        the finger goes down; ball: the ball's point in the picture. The stroke is
//                                            drawn from the ball wherever the finger lands (it's moved onto it)
//   strokeMove(st, x, y, t, id) · strokeUp(st, x, y, t, id)
//   readStroke(st, C, o) → { x, y (the spot on the goal face, m), power, bend, curl, outside, type, label, short }
//                          or { tap } (too short to be a shot) or { back, dx, dy } (drawn back toward his own goal)
//                          o: { foot (1 right, -1 left), base ('driven', or 'pen' for a penalty), origin (the ball's
//                          point, when the stroke's drawn away from it: a run-of-play game's right thumb) }
//   drawnShot(k, read, t, windup)            the shooter set to strike it as drawn, windup ms from now
//   strokeTrail(ctx, st, t, { C, k, ... })   the trail while it's drawn and just after, and where a short one's going
//                                            (with o.origin, a ring on the goal where it's going, all the way)
//   ghostStroke(ctx, from, to, bend, age)    the first shot's teaching stroke (three goes, then it stops)
//   onGoal(C, x, y)                          the point of the goal face (z = 0) under a point of the picture
//   DRAW                                     the numbers: the pace to power, the bend to curl
export const DRAW = {
  minLen: 22,                // px: shorter than this is a tap, not a shot
  s0: 0.15, s1: 1.9,         // px/ms: a stroke this quick is no power, this quick full power (quicker balloons)
  maxP: 1.4, soft: 0.7, softK: 0.4,   // (past soft, the power climbs at softK: maxP is 0.98)
  dead: 0.08, full: 0.32,    // the bend (its bow over its length) that starts to curl it, and the most he can put on it
  chipP: 0.42, chipY: 1.0,   // softer than this, up into the goal: the chip
  lowY: 0.5, yLow: 0.22,     // under this it's driven along the grass; a short stroke goes in at this height
  err: 0.7, outsideErr: 1.35,
}
// the point on the goal face (z = 0) a point in the picture sits over (the lens may be turned)
export function onGoal(C, sx, sy) {
  const u = (sx - C.vx) / C.F, cy = C.yaw ? C.cy : 1, sn = C.yaw ? C.sn : 0
  const dx = (-C.z * (u * cy + sn)) / (cy - u * sn)
  const d = dx * sn - C.z * cy
  return { x: C.x + dx, y: C.y - ((sy - C.hz) * d) / C.F }
}
let LEARNT = 0               // drawn shots this visit: the teaching stroke stops after the first couple
export const drawnSoFar = () => LEARNT
export function stroke() { return { id: null, on: false, pts: [], ox: 0, oy: 0, at: 0, upAt: -1e9 } }
export function strokeDown(st, x, y, t, id, ball) {
  if (st.on) return false
  st.on = true; st.id = id; st.at = t
  st.ox = ball ? ball.x - x : 0; st.oy = ball ? ball.y - y : 0
  st.pts.length = 0; st.pts.push({ x: x + st.ox, y: y + st.oy, t })
  return true
}
export function strokeMove(st, x, y, t, id) {
  if (!st.on || id !== st.id) return false
  const q = st.pts[st.pts.length - 1], X = x + st.ox, Y = y + st.oy
  if (Math.hypot(X - q.x, Y - q.y) >= 1.2 && st.pts.length < 400) st.pts.push({ x: X, y: Y, t })
  return true
}
export function strokeUp(st, x, y, t, id) {
  if (!st.on || id !== st.id) return false
  strokeMove(st, x, y, t, id)
  st.on = false; st.upAt = t; st.id = null
  return true
}
// its pace: the length over the time the finger was moving (a hold before it starts doesn't count; while it's still
// being drawn, a stop does)
function paceOf(pts, now = null) {
  const n = pts.length, P0 = pts[0]
  let len = 0, t0 = null
  for (let i = 1; i < n; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (t0 == null && Math.hypot(pts[i].x - P0.x, pts[i].y - P0.y) > 6) t0 = pts[i - 1].t }
  const t1 = now ?? pts[n - 1].t, dur = Math.max(24, t1 - (t0 ?? P0.t))
  const speed = len / dur
  // (past a firm stroke it climbs slower: a natural quick swipe is a hard shot, and only a real slash of a stroke
  // balloons over the bar)
  const raw = clamp((speed - DRAW.s0) / (DRAW.s1 - DRAW.s0), 0, DRAW.maxP)
  return { len, dur, speed, power: raw > DRAW.soft ? DRAW.soft + (raw - DRAW.soft) * DRAW.softK : raw }
}
export function readStroke(st, C, o = {}) {
  const pts = st.pts, n = pts.length, P0 = pts[0]
  if (!P0 || n < 2) return { tap: true }
  const pace = paceOf(pts)
  if (pace.len < DRAW.minLen) return { tap: true }
  const E = pts[n - 1], cx = E.x - P0.x, cy = E.y - P0.y, cl = Math.hypot(cx, cy) || 1
  // drawn back toward his own goal (or flat across): not a shot
  if (cy > -0.3 * cl) return { back: true, dx: cx / cl, dy: cy / cl, len: pace.len }
  // the bend: how far it bows off the straight line from the ball to where it ends, over that line's length (+ to the
  // right of it), and how much it shakes about its own smooth line
  const nx = -cy / cl, ny = cx / cl, ds = []
  let dmax = 0
  for (const q of pts) { const d = (q.x - P0.x) * nx + (q.y - P0.y) * ny; ds.push(d); if (Math.abs(d) > Math.abs(dmax)) dmax = d }
  let w2 = 0
  for (let i = 2; i < n - 2; i++) { const m = (ds[i - 2] + ds[i - 1] + ds[i] + ds[i + 1] + ds[i + 2]) / 5; w2 += (ds[i] - m) ** 2 }
  const bend = dmax / cl, wobble = n > 6 ? Math.sqrt(w2 / (n - 4)) / cl : 0
  // the spot: where it ends on the goal face, or on along its line to the goal line when it stops short (o.origin: the
  // stroke was drawn somewhere else, on the thumb's side of the screen: it's read as though drawn from there, the ball)
  const ox = o.origin ? o.origin.x - P0.x : 0, oy = o.origin ? o.origin.y - P0.y : 0
  const B = onGoal(C, P0.x + ox, P0.y + oy), G = onGoal(C, E.x + ox, E.y + oy)
  let x = G.x, y = G.y, short = false
  if (y < DRAW.yLow) { const den = G.y - B.y; if (den > 0.01) x = B.x + ((DRAW.yLow - B.y) / den) * (G.x - B.x); y = DRAW.yLow; short = true }
  x = clamp(x, -(POST + 3), POST + 3); y = clamp(y, 0.12, BAR + 2.5)
  // (o.power: a game whose power is set, the free kick's: the stroke is only the spot and the shape)
  const foot = o.foot ?? 1, pen = o.base === 'pen', power = o.power ?? pace.power
  const curl = Math.abs(bend) >= DRAW.dead, outside = curl && Math.sign(bend) === -foot
  // (o.base: the game's plain strike: 'driven', 'pen' for a penalty, 'volley' for one hit first time)
  const base = o.base ?? 'driven'
  let type, label
  // (o.chipP: a game where a careful, slow line shouldn't turn into a dink: only a really soft one is)
  if (power < (o.chipP ?? DRAW.chipP) && y > DRAW.chipY) { type = 'chip'; label = pen && Math.abs(x) < 1.1 ? 'PANENKA' : 'CHIP' }
  else if (curl) { type = pen ? 'pen' : 'finesse'; label = outside ? 'OUTSIDE OF THE BOOT' : pen ? 'PLACED' : 'CURLER' }
  else if (base === 'driven' && y < DRAW.lowY) { type = 'low'; label = 'LOW DRIVEN' }
  else { type = base; label = { pen: 'PENALTY', volley: 'FIRST TIME' }[base] ?? 'DRIVEN' }
  return { x, y, power, bend: type === 'chip' ? 0 : bend, wobble, curl: curl && type !== 'chip', outside: outside && type !== 'chip', type, label, short, len: pace.len, dur: pace.dur, speed: pace.speed }
}
// the bend he gets on it: the stroke's bow, as much as his boot has in it from there
function curlOf(dr, L, tv, r) {
  if (!dr.curl) return 0
  const amt = clamp((Math.abs(dr.bend) - DRAW.dead) / (DRAW.full - DRAW.dead), 0, 1)
  const most = lerp(0.35, 2.4, clamp((L - 8) / 18, 0, 1)) * lerp(0.6, 1.1, tv) * (dr.outside ? 0.62 : 1)
  return Math.sign(dr.bend) * amt * most * (1 + gaussOf(r) * 0.12 * (1.2 - tv))
}
export function drawnShot(k, rd, t, windup = k.windup) {
  k.drawn = rd; k.drawing = false; k.type = rd.type
  k.power = rd.type === 'chip' ? lerp(0.3, 0.72, clamp(rd.power / DRAW.chipP, 0, 1)) : rd.power
  k.aim.x = clamp(rd.x / (POST - 0.7), -1.6, 1.6); k.aim.y = clamp(((rd.y - 0.3) / (BAR - 0.75)) * 2 - 1, -1, 1.8)
  k.phase = 'strike'; k.at = t; k.relAt = t; k.strikeAt = t + windup; k.tapAt = null; k.timed = 'none'
  const [lo, hi] = k.band(rd.type)
  if (rd.type !== 'chip' && rd.power >= lo && rd.power <= hi && rd.wobble < 0.025) k.timed = 'green'
  LEARNT++
}
// The trail: chalk on an ink edge, thicker the quicker it's drawn, gold at the top of the range and red once it's
// going over (o.over: the power that does it). A stroke that stops short shows where it's going on, dotted, to the
// spot. It fades once he's struck it
export function strokeTrail(ctx, st, t, o = {}) {
  const pts = st.pts, n = pts.length
  if (n < 2) return
  const age = st.on ? 0 : t - st.upAt
  if (age > 520) return
  const pace = paceOf(pts, st.on ? t : null)
  // (the band for the shot it is so far: o.k, the shooter, and o.base, the game's own strike)
  let lo = (o.over ?? 0.8) - 0.18, hi = o.over ?? 0.8
  if (o.k && o.C) { const rd = readStroke(st, o.C, o); if (rd.type) [lo, hi] = rd.type === 'chip' ? [9, 9] : o.k.band(rd.type) }
  // (o.power: the power's set, so the line's plain chalk at one weight)
  const col = o.power != null ? '#f2f2ee' : pace.power > hi ? '#ff5a48' : pace.power >= lo ? '#f7cf55' : '#f2f2ee'
  const w = o.power != null ? 4.5 : 3 + 2.6 * clamp(pace.power, 0, 1)
  ctx.save()
  ctx.globalAlpha = st.on ? 1 : 1 - age / 520
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y) }
  path(); ctx.strokeStyle = 'rgba(6,8,10,.62)'; ctx.lineWidth = w + 4; ctx.stroke()
  path(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke()
  const E = pts[n - 1]
  if (o.C && st.on && (o.origin || o.ring)) {
    // drawn away from the ball: the ring on the goal where it's going
    const rd = readStroke(st, o.C, o)
    if (rd.type) { ctx.globalAlpha = 1; aimMark(ctx, o.C, rd.x, rd.y) }
  } else if (o.C && st.on) {
    // short of the goal line: on along its line, to the spot it's going in at
    const B = onGoal(o.C, pts[0].x, pts[0].y), G = onGoal(o.C, E.x, E.y)
    if (G.y < DRAW.yLow && G.y - B.y > 0.01 && pace.len >= DRAW.minLen && E.y < pts[0].y - 8) {
      const X = B.x + ((DRAW.yLow - B.y) / (G.y - B.y)) * (G.x - B.x), q = P(o.C, clamp(X, -(POST + 3), POST + 3), DRAW.yLow, 0)
      if (q.ok) {
        ctx.setLineDash([3, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(242,242,238,.7)'
        ctx.beginPath(); ctx.moveTo(E.x, E.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = 'rgba(242,242,238,.85)'; ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, 6.2832); ctx.fill()
      }
    }
  }
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(E.x, E.y, w * 0.5 + 3, 0, 6.2832); ctx.fill(); ctx.stroke()
  ctx.restore()
}
// The teaching stroke on the first shot: a dotted chalk line drawn off the ball to a spot, bowed by bend, a fingertip
// on its end; three goes, then it rests. age: ms since it started
export const GHOST_MS = 1700
export function ghostStroke(ctx, from, to, bend, age) {
  if (age < 0 || age > GHOST_MS * 3) return
  const c = age % GHOST_MS, f = easeOutS(clamp(c / 820, 0, 1)), fade = c < 1250 ? 1 : 1 - (c - 1250) / 450
  const dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L
  const at = u => { const b = ((u - u * u * u * u) / 0.4725) * bend * L; return { x: from.x + dx * u + nx * b, y: from.y + dy * u + ny * b } }
  ctx.save(); ctx.globalAlpha = 0.85 * fade
  ctx.lineCap = 'round'; ctx.setLineDash([2, 7]); ctx.lineWidth = 4; ctx.strokeStyle = '#f2f2ee'
  ctx.beginPath(); ctx.moveTo(from.x, from.y)
  for (let i = 1; i <= 24; i++) { const q = at((i / 24) * f); ctx.lineTo(q.x, q.y) }
  ctx.stroke(); ctx.setLineDash([])
  const h = at(f)
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#f2f2ee'; ctx.fillStyle = 'rgba(242,242,238,.28)'
  ctx.beginPath(); ctx.arc(h.x, h.y, 12, 0, 6.2832); ctx.fill(); ctx.stroke()
  ctx.restore()
}
const easeOutS = x => 1 - (1 - x) * (1 - x)

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
  // (labels.stick false: no stick, the shot's drawn on the picture)
  if (labels.stick !== false) {
    ctx.fillStyle = 'rgba(6,8,10,.45)'; ctx.beginPath(); ctx.arc(ax, ay, R + 6, 0, 6.2832); ctx.fill()
    ctx.strokeStyle = 'rgba(242,242,238,.28)'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = c.tid != null || Math.hypot(s.x, s.y) > 0.1 ? '#f2f2ee' : 'rgba(242,242,238,.7)'
    ctx.beginPath(); ctx.arc(ax + s.x * R, ay - s.y * R, 19, 0, 6.2832); ctx.fill()
  }
  for (const [id, B2, size] of [['S', B.S, 18], ['P', B.P, 14]]) {
    if (!labels[id]) continue
    const lit = (id === 'S' ? c.sid : c.pid) != null && live
    ctx.fillStyle = lit ? '#f2f2ee' : 'rgba(26,27,30,.92)'; ctx.beginPath(); ctx.arc(B2.x, B2.y, B2.r, 0, 6.2832); ctx.fill()
    ctx.strokeStyle = 'rgba(242,242,238,.25)'; ctx.lineWidth = 2; ctx.stroke()
    text(ctx, labels[id], B2.x, B2.y + 1, { font: DISPLAY, size: labels[id].length > 6 ? Math.max(13, size - 4) : size, color: lit ? '#0b0c0e' : '#f2f2ee' })
  }
  ctx.globalAlpha = 1
}
