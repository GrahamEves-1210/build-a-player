// BLACKTOP LIVE: a man on the court, seen from straight above (a broadcast skycam), in the mini games' flat look
// (src/lib/mg/rig.js: round capsule limbs, one even ink line round every part, two flat tones with the light up and to
// the left of the screen, a big number on the jersey). From above a player is mostly shoulders and the top of his
// head: the singlet in his side's colour with his number across his upper back, bare shoulders and arms, his hair,
// the shorts showing at his hips, his shoes when he strides. Drawn fresh every frame from a pose (pose.js makes those
// from the game): nothing here knows the rules.
//
// A pose is in the man's own frame, in units of his size (s px, about his shoulders' width): x forward (the way he
// faces), y to his right. Hands carry a height too (0 at his waist, 1 over his head): a high hand is drawn a touch
// bigger and over his head and shoulders, a low one under them.
//   drawFigure(ctx, f)   f: { x, y, s, ang, scale, air, lean, down, lh: [x, y, z], rh: [x, y, z], lf: [x, y],
//                             rf: [x, y], toeL, toeR, look: { col, colD, colL, trim, skin, skinD, skinL, hair, style, num, ink } }
//   pointAt(f, lx, ly, out) a point in his frame on the screen: [px, py, the same point's floor py]
const INK = '#0b1014'
const TAU = Math.PI * 2
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// a colour, darker or lighter (f < 1 darker)
export function tone(hex, f) {
  let h = String(hex || '#888').replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h.slice(0, 6), 16)
  if (!Number.isFinite(n)) return hex
  const c = v => Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1))))
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`
}
const lum = hex => { const n = parseInt(String(hex || '#888').replace('#', '').slice(0, 6), 16) || 0; return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255 }
const hashOf = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

// What a man looks like: his side's colour, his skin tone and number from the roster, and a haircut. The rosters
// carry no hair, so a cut is picked from his name (the same one every game): a young man's hair, dark, never grey,
// never thin.
const SKINS = ['#8d5a3b', '#6d4229', '#a9744f', '#5a3522', '#c09060']
const STYLES = ['short', 'short', 'fade', 'fade', 'twists', 'waves', 'braids']
export function lookOf({ name = '', skin = null, num = null, col = '#4da3ff' }) {
  const h = hashOf(name || 'player')
  const sk = /^#[0-9a-f]{6}$/i.test(skin || '') ? skin : SKINS[h % SKINS.length]
  const light = lum(sk) > 0.62
  return {
    col, colD: tone(col, 0.68), colL: tone(col, 1.18), trim: '#f4efe6',
    skin: sk, skinD: tone(sk, 0.74), skinL: tone(sk, 1.1),
    hair: light ? ['#3a2a1c', '#4a3524', '#2a1e14'][(h >>> 3) % 3] : '#16110d',
    style: light ? ['short', 'short', 'fade', 'waves'][(h >>> 5) % 4] : STYLES[(h >>> 5) % STYLES.length],
    num: num == null || num === '' ? null : String(num).slice(0, 2),
    ink: lum(col) > 0.6 ? '#10151a' : '#f4efe6',                       // the number, readable on the jersey
    shoe: ['#f2f3ee', '#f2f3ee', '#1d2228'][(h >>> 7) % 3],
  }
}

// his frame → the screen
const FR = { x: 0, y: 0, ca: 1, sa: 0, sc: 1 }
const PX = (lx, ly) => FR.x + (lx * FR.ca - ly * FR.sa) * FR.sc
const PY = (lx, ly) => FR.y + (lx * FR.sa + ly * FR.ca) * FR.sc
function frame(f) {
  const lift = (f.air || 0) * f.s * 0.2
  FR.sc = f.s * (f.scale ?? 1) * (1 + 0.16 * (f.air || 0)); FR.ca = Math.cos(f.ang); FR.sa = Math.sin(f.ang)
  FR.x = f.x; FR.y = f.y - lift
}
// a point in his frame on the screen: out = [px, py, the same point on the floor's py] (the ball in his hand, its shadow)
export function pointAt(f, lx, ly, out) {
  frame(f)
  out[0] = PX(lx, ly); out[1] = PY(lx, ly); out[2] = out[1] + (f.air || 0) * f.s * 0.2
  return out
}

const SH = 0.39                                   // a shoulder: this far out from his middle
const UARM = 0.27, FARM = 0.27, REACH = UARM + FARM - 0.01

// ── the drawing pieces. A man is drawn in two passes, all of his ink first and then all of his fills on top
// (PASS), so the parts melt into one shape with a single clean outline round the whole man and no lines inside him.
// Flat fills: one tone a part, and the jersey alone keeps one soft shade (the owner, 11-25: "the lines and creases on
// the model are too much")
let PASS = 0                                      // 0: the ink, 1: the fills
function capInk(ctx, x0, y0, x1, y1, r, ink) {
  if (PASS !== 0) return
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = (r + ink) * 2
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke()
}
function cap2(ctx, x0, y0, x1, y1, r, col) {
  if (PASS !== 1) return
  ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = r * 2
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke()
}
function dot2(ctx, x, y, r, col, ink) {
  if (PASS === 0) { if (ink) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + ink, 0, TAU); ctx.fill() } return }
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
}

// An arm from the shoulder to where the pose puts the hand, bent at the elbow the way a real arm bends: worked out in
// three dimensions (the hand's height counts) and then seen from above. The elbow points down at the floor and in at
// his ribs, so from straight above it stays close to his body: never out past the line of his shoulder, whatever the
// hand does (the owner, 11-25: the elbows were too far out)
const SHZ = 0.55, ZH = 1.0                        // a hand's height over his shoulder is z * ZH - SHZ (his size): z 0.2-0.35 is his hip, 1 over his head
export function armPts(side, hand) {
  const sx = 0.0, sy = side * SH
  let dx = hand[0] - sx, dy = hand[1] - sy, h = Math.hypot(dx, dy) || 0.001
  if (h > REACH) { dx *= REACH / h; dy *= REACH / h; h = REACH }
  // (the hand stays where the pose puts it across the floor; its height gives way when the arm can't reach both)
  const zMax = Math.sqrt(Math.max(0, REACH * REACH - h * h))
  const dz = clamp(clamp(hand[2] || 0, 0, 1.2) * ZH - SHZ, -zMax, zMax)
  const d = Math.hypot(h, dz) || 0.001, ux = dx / d, uy = dy / d, uz = dz / d
  // where the elbow points: down (the floor) and in toward his middle, a touch back with a low hand, a touch forward
  // under a raised one
  const up = clamp(((hand[2] || 0) - 0.5) / 0.4, 0, 1)
  let px = -0.25 * (1 - up) + 0.15 * up, py = -side * 0.2, pz = -1
  const dot = px * ux + py * uy + pz * uz
  px -= dot * ux; py -= dot * uy; pz -= dot * uz
  const pl = Math.hypot(px, py, pz)
  if (pl < 1e-4) { px = 0; py = -side; pz = 0 } else { px /= pl; py /= pl; pz /= pl }
  const bend = Math.sqrt(Math.max(0, UARM * UARM - d * d / 4))
  let ex = sx + dx / 2 + px * bend, ey = sy + dy / 2 + py * bend
  // never out past the shoulder, and no farther out than the straight line from the shoulder to the hand
  const lineY = sy + dy * clamp(((ex - sx) * dx + (ey - sy) * dy) / ((dx * dx + dy * dy) || 1), 0, 1)
  const wide = Math.min(sy * side - 0.01, Math.max(lineY * side, sy * side - 0.1))
  if (ey * side > wide) ey = wide * side
  return [sx, sy, ex, ey, sx + dx, sy + dy]
}
function arm(ctx, side, hand, L, ink) {
  const [sx, sy, ex, ey, hx, hy] = armPts(side, hand)
  const z = clamp(hand[2] || 0, 0, 1.2), sc = FR.sc, up = 1 + 0.22 * z
  const ru = sc * 0.07, rf = sc * 0.062 * up, rh = sc * 0.072 * up
  capInk(ctx, PX(sx, sy), PY(sx, sy), PX(ex, ey), PY(ex, ey), ru, ink)
  capInk(ctx, PX(ex, ey), PY(ex, ey), PX(hx, hy), PY(hx, hy), rf, ink)
  dot2(ctx, PX(hx, hy), PY(hx, hy), rh, L.skin, ink)
  cap2(ctx, PX(sx, sy), PY(sx, sy), PX(ex, ey), PY(ex, ey), ru, L.skin)
  cap2(ctx, PX(ex, ey), PY(ex, ey), PX(hx, hy), PY(hx, hy), rf, L.skin)
}

// a leg in a stride: from under his shorts to the shoe (only drawn when the foot is out from under him)
function leg(ctx, side, foot, toe, L, ink) {
  const hx = -0.04, hy = side * 0.14, sc = FR.sc
  const fx = foot[0], fy = foot[1]
  const out = Math.hypot(fx - hx, fy - hy)
  if (out > 0.16) {
    const r = sc * 0.075
    capInk(ctx, PX(hx, hy), PY(hx, hy), PX(fx, fy), PY(fx, fy), r, ink)
    cap2(ctx, PX(hx, hy), PY(hx, hy), PX(fx, fy), PY(fx, fy), r, L.skin)
  }
  // the shoe, toe the way it points
  const tx = Math.cos(toe), ty = Math.sin(toe)
  const x0 = fx - tx * 0.07, y0 = fy - ty * 0.07, x1 = fx + tx * 0.1, y1 = fy + ty * 0.1, r = sc * 0.068
  capInk(ctx, PX(x0, y0), PY(x0, y0), PX(x1, y1), PY(x1, y1), r, ink)
  cap2(ctx, PX(x0, y0), PY(x0, y0), PX(x1, y1), PY(x1, y1), r, L.shoe)
}

// his shorts: the part of them that shows round his hips from above (wider than his waist, below the jersey)
function shorts(ctx, f, L, ink) {
  const ln = f.lean || 0, cx = -0.06 - ln * 0.5
  ctx.save(); ctx.translate(PX(cx, 0), PY(cx, 0)); ctx.rotate(f.ang)
  const rx = FR.sc * 0.2, ry = FR.sc * 0.31
  if (PASS === 0) { ctx.beginPath(); ctx.ellipse(0, 0, rx + ink, ry + ink, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill() }
  else { ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fillStyle = L.colD; ctx.fill() }
  ctx.restore()
}

// the jersey: the singlet over his shoulders and back, one colour with one soft shade on the far side, his number
function torso(ctx, f, L, ink) {
  const ln = f.lean || 0
  const P = (lx, ly) => [PX(lx + ln, ly), PY(lx + ln, ly)]
  const path = (g = 1) => {
    // (from above: a broad back curving into square shoulders, the chest a little narrower)
    ctx.beginPath()
    const pts = [[-0.33, 0], [-0.31, -0.24 * g], [-0.18, -0.36 * g], [0.02, -0.37 * g], [0.15, -0.3 * g], [0.2, -0.14 * g], [0.21, 0], [0.2, 0.14 * g], [0.15, 0.3 * g], [0.02, 0.37 * g], [-0.18, 0.36 * g], [-0.31, 0.24 * g]]
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    let s0 = m(pts[pts.length - 1], pts[0]); let q = P(s0[0], s0[1]); ctx.moveTo(q[0], q[1])
    for (let i = 0; i < pts.length; i++) { const c = P(pts[i][0], pts[i][1]), e0 = m(pts[i], pts[(i + 1) % pts.length]), e = P(e0[0], e0[1]); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]) }
    ctx.closePath()
  }
  if (PASS === 0) { path(); ctx.lineJoin = 'round'; ctx.lineWidth = ink * 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = INK; ctx.fill(); return }
  // the one shade: a thin crescent of the darker tone down the side away from the light
  path(); ctx.fillStyle = L.colD; ctx.fill()
  ctx.save(); path(); ctx.clip()
  const d = FR.sc * 0.045
  ctx.translate(-d, -d); path(0.95); ctx.fillStyle = L.col; ctx.fill()
  ctx.restore()
  // the bare shoulders (a singlet)
  for (const sd of [-1, 1]) { const p = P(0.0, sd * SH); dot2(ctx, p[0], p[1], FR.sc * 0.07, L.skin, 0) }
  // his number across his upper back (it reads from behind him)
  if (L.num) {
    const c0 = P(-0.2, 0), fs = FR.sc * (L.num.length > 1 ? 0.22 : 0.25)
    ctx.save(); ctx.translate(c0[0], c0[1]); ctx.rotate(f.ang + Math.PI / 2)
    ctx.font = `${fs.toFixed(1)}px "BAP Anton", "Anton", "BAP Bebas", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = L.ink; ctx.fillText(L.num, 0, fs * 0.04)
    ctx.restore()
  }
}

// his head from above: skin, his hair over all of it but his forehead, one outline
function head(ctx, f, L, ink) {
  const ln = (f.lean || 0) * 1.5, cx = 0.085 + ln, R = 0.16, sc = FR.sc
  const hx = PX(cx, 0), hy = PY(cx, 0), r = R * sc
  if (PASS === 0) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx, hy, r + ink, 0, TAU); ctx.fill(); return }
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.fill()
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.clip()
  const st = L.style
  const capOf = (back, rx, ry, col) => { ctx.beginPath(); ctx.ellipse(PX(cx - back * R, 0), PY(cx - back * R, 0), rx * r, ry * r, f.ang, 0, TAU); ctx.fillStyle = col; ctx.fill() }
  if (st === 'fade') { capOf(0.3, 0.94, 1.04, tone(L.skin, 0.6)); capOf(0.2, 0.72, 0.7, L.hair) }
  else capOf(st === 'twists' ? 0.26 : st === 'braids' ? 0.3 : 0.34, 0.92, 1.04, L.hair)
  ctx.restore()
}

// his shadow on the floor (drawn for everyone before any man, so no shadow lies on a man)
export function drawShadow(ctx, f) {
  const air = Math.min(1.2, f.air || 0), s = f.s
  ctx.fillStyle = `rgba(0,0,0,${(0.34 - 0.12 * Math.min(1, air)).toFixed(3)})`
  ctx.beginPath(); ctx.ellipse(f.x + s * (0.05 + 0.07 * air), f.y + s * (0.08 + 0.1 * air), s * (0.48 - 0.08 * air) * (f.down ? 1.2 : 1), s * (0.42 - 0.08 * air), f.ang, 0, TAU); ctx.fill()
}

export function drawFigure(ctx, f) {
  frame(f)
  const L = f.look, ink = Math.max(1, FR.sc * 0.032)
  const lz = f.lh[2] || 0, rz = f.rh[2] || 0
  // the man in one piece (ink, then fills), then a raised arm over his head the same way
  for (PASS = 0; PASS < 2; PASS++) {
    leg(ctx, -1, f.lf, f.toeL || 0, L, ink); leg(ctx, 1, f.rf, f.toeR || 0, L, ink)
    shorts(ctx, f, L, ink)
    if (lz < 0.6) arm(ctx, -1, f.lh, L, ink)
    if (rz < 0.6) arm(ctx, 1, f.rh, L, ink)
    torso(ctx, f, L, ink)
    head(ctx, f, L, ink)
  }
  if (lz >= 0.6 || rz >= 0.6) for (PASS = 0; PASS < 2; PASS++) {
    if (lz >= 0.6) arm(ctx, -1, f.lh, L, ink)
    if (rz >= 0.6) arm(ctx, 1, f.rh, L, ink)
  }
}
export { clamp }
