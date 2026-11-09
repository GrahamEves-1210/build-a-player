// The Build-A-Player figure: a clean mannequin, not an almost-real man. Round capsule limbs, one even ink line
// round the outside, two flat tones (the light is up and to the left), a big number on the jersey, no face.
// It takes the same looks and the same poses as art.js's athlete (padsPose: the feet, the hands, the lean), stands
// on the same spot and is the same size, so a game can switch to it without its motion changing.
//
//   figure(ctx, view, x, y, opts)   athlete()'s drop-in: a man at a field point, through the game's camera
//   put(x, y, team, o) + action(ctx, view)   read.js's queue, drawn back to front with figure()
//   paintFigure(x, opts)            one man painted into any context: his feet at 0, 0, in the sprite's units
//
// Sprites are painted once per look at the size they're drawn (a sharp edge at any devicePixelRatio) and stamped.
// They're a few flat shapes each, so painting one is cheap, and a frame never paints more than a few.
import { clamp, lerp, text, DISPLAY, warmSkin } from './kit.js'
import { tilt, inkOn, padsPose, rigArm, nameTag } from './art.js'

export const INK = '#0b1014'
const RIG = 0.42                        // rig units (a man is about 110) to the sprite's
const BOX = 56, FEET = 50               // the sprite, in the units athlete() uses: the same box, the same feet
const R_TORSO = 34, R_THIGH = 27, R_SHIN = 27
const O = 1.7                           // the ink line, in rig units: the same weight on every part
const FALL_Y = [1, 0.8, 0.6, 0.42]

const tones = new Map()
// a colour's light and dark: f under 1 darkens, over 1 lifts toward white
export function tone(hex, f) {
  const id = `${hex}|${f}`
  let c = tones.get(id)
  if (c) return c
  let h = String(hex ?? '').replace('#', '')
  if (h.length === 3) h = h.replace(/./g, '$&$&')
  const n = parseInt(h.slice(0, 6), 16)
  if (!/^[0-9a-f]{6}/i.test(h) || !Number.isFinite(n)) c = hex
  else {
    const ch = v => Math.round(clamp(f <= 1 ? v * f : v + (255 - v) * (f - 1), 0, 255))
    c = `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`
  }
  if (tones.size > 400) tones.clear()
  tones.set(id, c)
  return c
}

// ── The shapes ──────────────────────────────────────────────────────────────
// a capsule: a line with round ends, as wide as the limb
function cap(x, ax, ay, bx, by, r, col) {
  x.strokeStyle = col; x.lineWidth = r * 2
  x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx + (ax === bx && ay === by ? 0.01 : 0), by); x.stroke()
}
// the same capsule in two tones: the dark one, then the lit one a little up and to the left, inside it
function cap2(x, ax, ay, bx, by, r, col) {
  cap(x, ax, ay, bx, by, r, tone(col, 0.72))
  const d = r * 0.24
  cap(x, ax - d, ay - d, bx - d, by - d, r * 0.66, col)
}
function dot2(x, cx, cy, r, col) {
  x.fillStyle = tone(col, 0.72); x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill()
  x.fillStyle = col; x.beginPath(); x.arc(cx - r * 0.24, cy - r * 0.24, r * 0.68, 0, 6.2832); x.fill()
}
// where the knee goes, the way art.js's leg finds it: out to the side as the leg folds
function knee(hx, hy, ex, ey, out) {
  const reach = clamp(1 - Math.hypot(ex - hx, ey - hy) / (R_THIGH + R_SHIN), 0, 1)
  return [(hx + ex) / 2 + out * reach * 9, (hy + ey) / 2 - reach * 2]
}
function ball(x, bx, by, ang) {
  x.save(); x.translate(bx, by); x.rotate(ang)
  x.fillStyle = INK; x.beginPath(); x.ellipse(0, 0, 6.6 + O, 9.6 + O, 0, 0, 6.2832); x.fill()
  x.fillStyle = '#6e3d1d'; x.beginPath(); x.ellipse(0, 0, 6.6, 9.6, 0, 0, 6.2832); x.fill()
  x.fillStyle = '#8a4f27'; x.beginPath(); x.ellipse(-1.4, -1.4, 4.4, 7.4, 0, 0, 6.2832); x.fill()
  x.fillStyle = '#f2efe8'; x.fillRect(-2.6, -0.6, 5.2, 1.2)
  x.restore()
}

// ── One man, painted ────────────────────────────────────────────────────────
// opts: athlete()'s look. kit 'plain': a t-shirt and a bare head (the staff, the combine)
export function paintFigure(x, { color, trim, pants, skin, number, dir, step, carry, pose, kit, fallStage = 0 }) {
  const plain = kit === 'plain', fy = FALL_Y[fallStage] ?? 1, back = dir === 'up'
  skin = warmSkin(skin)
  const glove = plain ? skin : trim
  const sock = plain ? '#e9ecee' : color, shoe = '#1a2026'
  x.save(); x.scale(RIG, RIG * fy); x.lineCap = 'round'; x.lineJoin = 'round'
  const o = padsPose(dir === 'side' ? 'down' : dir, step, pose, carry)
  const sl = Math.sin(o.lean), cl = Math.cos(o.lean), hipY = -o.hy
  const sx = sl * R_TORSO, sy = hipY - cl * R_TORSO, SH = plain ? 12.5 : 14.5
  const lS = [sx - cl * SH, sy - sl * SH + 3], rS = [sx + cl * SH, sy + sl * SH + 3]
  const lH = [-cl * 6.4, hipY - sl * 6.4], rH = [cl * 6.4, hipY + sl * 6.4]
  const lA = [o.lx, o.ly - 3], rA = [o.rx, o.ry - 3]
  const lK = knee(lH[0], lH[1], lA[0], lA[1], -1), rK = knee(rH[0], rH[1], rA[0], rA[1], 1)
  const pole = (sY, hY, out) => out * (0.22 - 0.12 * clamp((sY - hY) / 30, 0, 1))
  const lArm = rigArm(lS[0], lS[1], o.hlx, o.hly, pole(lS[1], o.hly, -1), 0.92)
  const rArm = rigArm(rS[0], rS[1], o.hrx, o.hry, pole(rS[1], o.hry, 1), 0.92)
  const hx = sx + sl * 15, hy = sy - cl * 15, HR = plain ? 9.4 : 11
  const armsOver = !back && pose && !['slide', 'ready', 'back', 'touch', 'sprint', 'plant-l', 'plant-r'].includes(pose)
  // a gesture with the ball (the point at the sky when he's clear): the ball goes in the hand that carried it, held
  // out in that hand and over it, and the other hand does the pointing. Running and cutting, it's tucked behind the arm
  const held = carry && pose && !['sprint', 'plant-l', 'plant-r', 'ready', 'slide', 'back', 'block', 'stance', 'wrap', 'touch'].includes(pose)
  const T = R_TORSO

  // the torso's outline, in its own frame: square shoulders in to the waist
  const torso = () => { x.beginPath(); x.moveTo(-15, 1); x.lineTo(15, 1); x.lineTo(10.5, T - 1); x.lineTo(-10.5, T - 1); x.closePath() }
  const inTorso = fn => { x.save(); x.translate(sx, sy); x.rotate(o.lean); if (plain) x.scale(0.86, 1); fn(); x.restore() }
  const leg = (H, K, A, out) => [[H, K, 7.2], [K, A, 5.6], [A, [A[0] + out * 3, A[1] + 1], 4.4]]
  const legs = [leg(lH, lK, lA, -1), leg(rH, rK, rA, 1)]
  const arm = (S, a) => [[S, [a.jx, a.jy], 5.4], [[a.jx, a.jy], [a.ex, a.ey], 4.4]]

  // 1. one ink silhouette under everything: every part a line's width wider
  const ink = (S, a) => { for (const [p, q, r] of arm(S, a)) cap(x, p[0], p[1], q[0], q[1], r + O, INK); x.fillStyle = INK; x.beginPath(); x.arc(a.ex, a.ey, 4.8 + O, 0, 6.2832); x.fill() }
  if (!armsOver) { ink(lS, lArm); ink(rS, rArm) }
  for (const L of legs) for (const [p, q, r] of L) cap(x, p[0], p[1], q[0], q[1], r + O, INK)
  cap(x, lH[0], lH[1], rH[0], rH[1], 8.4 + O, INK)
  inTorso(() => { torso(); x.strokeStyle = INK; x.lineWidth = 9 + O * 2; x.fillStyle = INK; x.fill(); x.stroke(); cap(x, -14, 3, 14, 3, 7 + O, INK) })
  cap(x, sx, sy, hx, hy, 5 + O, INK)
  x.fillStyle = INK; x.beginPath(); x.arc(hx, hy, HR + O, 0, 6.2832); x.fill()

  // 2. the arms that hang behind him
  const paintArm = (S, a) => {
    const mx = lerp(S[0], a.jx, 0.72), my = lerp(S[1], a.jy, 0.72)
    cap2(x, a.jx, a.jy, a.ex, a.ey, 4.4, skin)
    cap2(x, mx, my, a.jx, a.jy, 4.9, skin)
    cap2(x, S[0], S[1], mx, my, 5.4, color)
    dot2(x, a.ex, a.ey, 4.8, glove)
  }
  if (!armsOver) {
    if (back && carry && !held) ball(x, o.hlx - 3, o.hly - 2, 0.25)
    paintArm(lS, lArm); paintArm(rS, rArm)
  }
  // 3. the legs: pants to the knee, the sock in his colour, the shoe
  for (let i = 0; i < 2; i++) {
    const [[H, K], [, A], [, F]] = legs[i]
    cap(x, A[0], A[1], F[0], F[1], 4.4, shoe)
    cap2(x, K[0], K[1], A[0], A[1], 5.6, plain ? skin : sock)
    if (plain) cap(x, lerp(K[0], A[0], 0.7), lerp(K[1], A[1], 0.7), A[0], A[1], 5, sock)
    cap2(x, H[0], H[1], lerp(H[0], K[0], plain ? 0.72 : 1.04), lerp(H[1], K[1], plain ? 0.72 : 1.04), 7.2, pants)
    if (plain) cap2(x, lerp(H[0], K[0], 0.7), lerp(H[1], K[1], 0.7), K[0], K[1], 6.2, skin)
  }
  cap2(x, lH[0], lH[1], rH[0], rH[1], 8.4, pants)
  // 4. the jersey: one flat shape, its far side in shade, square pads across the top, the number
  inTorso(() => {
    torso(); x.fillStyle = color; x.strokeStyle = color; x.lineWidth = 9; x.fill(); x.stroke()
    x.beginPath(); x.moveTo(5, 1); x.lineTo(15, 1); x.lineTo(10.5, T - 1); x.lineTo(4, T - 1); x.closePath()
    x.fillStyle = tone(color, 0.76); x.strokeStyle = x.fillStyle; x.lineWidth = 9; x.fill(); x.stroke()
    if (!plain) { cap(x, -14, 3, 14, 3, 7, color); cap(x, 7, 3, 14, 3, 7, tone(color, 0.76)) }
    // the collar, and the waistband over the jersey
    x.fillStyle = back || plain ? tone(color, 0.6) : tone(skin, 0.7)
    x.beginPath(); x.ellipse(0, -1, 5.6, 2.6, 0, 0, 6.2832); x.fill()
    x.fillStyle = tone(pants, 0.8); x.fillRect(-12.5, T - 2.4, 25, 4.4)
    if (number != null && !plain) text(x, String(number), 0, back ? 16 : 17, { font: DISPLAY, size: String(number).length > 1 ? 19 : 22, color: inkOn(color, trim) })
  })
  // 5. the head: a helmet shell with his stripe and a dark visor, or a bare head and its hair. No face.
  cap(x, sx, sy - 1, hx, hy, 5, tone(skin, 0.72))
  x.save(); x.translate(hx, hy); x.scale(1, 1 / fy)
  if (plain) {
    dot2(x, 0, 0, HR, skin)
    x.fillStyle = '#16110d'; x.beginPath()
    if (back) { x.arc(0, 0, HR, Math.PI * 1.02, Math.PI * 1.98 + 0.4); x.lineTo(0, HR * 0.5); x.closePath() }
    else { x.arc(0, 0, HR, Math.PI * 1.05, Math.PI * 1.95); x.quadraticCurveTo(0, -HR * 0.45, -HR * 0.97, -HR * 0.2) }
    x.fill()
  } else {
    dot2(x, 0, 0, HR, trim)
    x.strokeStyle = back ? color : tone(color, 1); x.lineWidth = 3.4; x.lineCap = 'butt'
    x.beginPath(); x.moveTo(0, -HR + 0.6); x.lineTo(0, back ? HR - 2 : -HR * 0.25); x.stroke(); x.lineCap = 'round'
    if (!back) {
      // the visor and the bar under it: one dark shape where a face would be
      x.fillStyle = '#10161b'; x.beginPath(); x.roundRect(-7.6, -2.2, 15.2, 9.6, 3.6); x.fill()
      x.fillStyle = tone(trim, 0.86); x.fillRect(-7.2, 4.4, 14.4, 1.6)
    } else { x.fillStyle = tone(trim, 0.62); x.beginPath(); x.ellipse(0, HR - 2.2, 6.5, 2.6, 0, 0, 6.2832); x.fill() }
  }
  x.restore()
  // 6. arms in front of him, with their own line round them
  if (armsOver) { ink(lS, lArm); paintArm(lS, lArm); ink(rS, rArm); paintArm(rS, rArm) }
  if (!back && carry && !held) ball(x, o.hlx - 3, o.hly - 2, 0.25)
  if (held) {
    // in the palm: the ball on the carrying hand, the fingers round its near side
    ball(x, lArm.ex - 2, lArm.ey + 1, -0.3)
    x.fillStyle = INK; x.beginPath(); x.arc(lArm.ex + 1.5, lArm.ey + 2, 3.4 + O, 0, 6.2832); x.fill()
    dot2(x, lArm.ex + 1.5, lArm.ey + 2, 3.4, glove)
  }
  x.restore()
}

// ── Sprites, at the size they're drawn ──────────────────────────────────────
const TIERS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7]
const BYTES = (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4) ? 14e6 : 28e6
const sprites = new Map(), latest = new Map()
let bytes = 0, frame = 0, painted = 0
const PAINTS_PER_FRAME = 3
const sk = v => (v == null ? '' : v)
const lookId = o => `${sk(o.color)}|${sk(o.trim)}|${sk(o.pants)}|${sk(o.skin)}|${sk(o.number)}|${sk(o.dir)}|${sk(o.step)}|${sk(o.kit)}|${sk(o.carry)}|${sk(o.pose)}|${o.fallStage ?? 0}`
function spriteOf(o, need) {
  const res = TIERS.find(t => t >= need) ?? TIERS[TIERS.length - 1]
  const look = lookId(o), id = `${look}|${res}`
  let c = sprites.get(id)
  if (c) { if (c.used !== frame) { c.used = frame; sprites.delete(id); sprites.set(id, c) } return c }
  if (typeof document === 'undefined') return null
  // this frame's paints are spent: the same look at another size will do for a frame
  const near = latest.get(look)
  if (painted >= PAINTS_PER_FRAME && near && sprites.get(near.id) === near) return near
  while (bytes > BYTES && sprites.size) {
    const [k, old] = sprites.entries().next().value
    if (old.used === frame) break
    bytes -= old.width * old.height * 4; sprites.delete(k)
  }
  const px = Math.ceil(BOX * res)
  c = document.createElement('canvas'); c.width = px; c.height = px
  const x = c.getContext('2d')
  x.scale(px / BOX, px / BOX); x.translate(BOX / 2, FEET)
  paintFigure(x, o)
  c.used = frame; c.id = id
  sprites.set(id, c); latest.set(look, c)
  if (latest.size > 600) latest.clear()
  bytes += px * px * 4; painted++
  return c
}
const LOOK = { color: '', trim: '', pants: '', skin: '', number: null, dir: 'up', step: null, kit: 'pads', carry: false, pose: null, fallStage: 0 }
// x, y: the field point under his feet. The same options as athlete()
export function figure(ctx, view, x, y, { color = '#1b6fd1', trim = '#f4efe6', pants = null, skin = '#8d5a3b', number = null, dir = 'up', step = null, kit = 'pads', carry = false, size = 1, pose = null, fall = 0, fallX = 0, squat = 0, lift = 0 } = {}) {
  const p = tilt(view, x, y)
  const k = p.s * size * (kit === 'pads' ? 0.92 : 1)
  if (!(k > 0) || p.y - FEET * k > view.h) return p
  // the shadow: one flat ellipse, tight under him
  ctx.fillStyle = 'rgba(2,10,6,.42)'
  ctx.beginPath(); ctx.ellipse(p.x + (2 + fallX * fall * 26) * k, p.y + 0.5 * k - fall * 6 * k, (12 + fall * 3) * k, (3.4 + fall * 5) * k, 0, 0, Math.PI * 2); ctx.fill()
  const flip = dir === 'left'
  LOOK.color = color; LOOK.trim = trim; LOOK.pants = pants ?? (kit === 'pads' ? '#eceae2' : '#20262c'); LOOK.skin = skin
  LOOK.number = dir === 'up' || dir === 'down' ? number : null; LOOK.dir = dir === 'left' || dir === 'right' ? 'side' : dir
  LOOK.step = step; LOOK.kit = kit; LOOK.carry = carry; LOOK.pose = pose
  LOOK.fallStage = fall > 0 && !fallX ? (fall < 0.34 ? 1 : fall < 0.67 ? 2 : 3) : 0
  const c = spriteOf(LOOK, k * (view.px || 2))
  if (!c) return p
  const w = BOX * k, top = p.y - (FEET + lift) * k
  if (fall > 0 && fallX) {
    const e = 1 - (1 - fall) * (1 - fall)
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(fallX * e * 1.4); if (flip) ctx.scale(-1, 1)
    ctx.drawImage(c, -w / 2, -FEET * k, w, w)
    ctx.restore()
    return p
  }
  if (squat > 0) ctx.drawImage(c, p.x - w / 2, p.y - FEET * k * (1 - squat), w, w * (1 - squat))
  else if (flip) { ctx.save(); ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.drawImage(c, -w / 2, top, w, w); ctx.restore() }
  else ctx.drawImage(c, p.x - w / 2, top, w, w)
  return p
}

// ── read.js's queue, drawn with the new figure ──────────────────────────────
const CAST = []
let castN = 0
export function put(x, y, team, o) {
  const c = CAST[castN] ?? (CAST[castN] = {})
  castN++
  c.x = x; c.y = y; c.z = o.z ?? y
  c.color = team.color; c.trim = team.trim; c.pants = team.pants ?? team.trim; c.skin = o.skin ?? '#8d5a3b'
  c.number = o.number ?? null; c.dir = o.dir ?? 'up'; c.step = o.step ?? null; c.pose = o.pose ?? null
  c.carry = !!o.carry; c.size = o.size ?? 0.9; c.fall = o.fall ?? 0; c.fallX = o.fallX ?? 0; c.kit = o.kit ?? 'pads'; c.squat = o.squat ?? 0; c.lean = o.lean ?? 0
  c.tag = o.name ?? null; c.quiet = !!o.quiet
}
// his last name under him, the same as read.js's queue: a quiet man's (a blocker off the play) once the play's over
let TAG_ALL = false
export const tagsAll = on => { TAG_ALL = !!on }
const byZ = (a, b) => a.z - b.z
export function action(ctx, view) {
  frame++; painted = 0
  const list = CAST.slice(0, castN).sort(byZ)
  castN = 0
  for (const c of list) {
    let p
    if (c.lean) {
      const q = tilt(view, c.x, c.y)
      ctx.save(); ctx.translate(q.x, q.y); ctx.transform(1, 0, -c.lean, 1, 0, 0); ctx.translate(-q.x, -q.y)
      p = figure(ctx, view, c.x, c.y, c)
      ctx.restore()
    } else p = figure(ctx, view, c.x, c.y, c)
    if (c.tag && !c.fall && (TAG_ALL || !c.quiet) && p?.s > 0) {
      const k = Math.min(1.15, Math.max(0.8, p.s * c.size)), w = (c.tag.length * 5.6 + 6) * k
      nameTag(ctx, view, clamp(p.x, w / 2 + 1, view.w - w / 2 - 1), p.y, c.tag, k)
    }
  }
  TAG_ALL = false
}
// a frame that draws figures without the queue (a tile, a stamp) still counts its paints from here
export function rigFrame() { frame++; painted = 0 }
