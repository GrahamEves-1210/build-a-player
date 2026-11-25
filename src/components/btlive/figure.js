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
const LIT = 0.24                                  // the lit part sits this share of a part's radius up and to the left

// ── the drawing pieces: everything gets its ink first, then two tones (rig.js's cap2 / dot2) ──
function capInk(ctx, x0, y0, x1, y1, r, ink) {
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = (r + ink) * 2
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke()
}
function cap2(ctx, x0, y0, x1, y1, r, col, dark) {
  ctx.lineCap = 'round'
  ctx.strokeStyle = dark; ctx.lineWidth = r * 2
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke()
  const d = r * LIT
  ctx.strokeStyle = col; ctx.lineWidth = r * 1.3
  ctx.beginPath(); ctx.moveTo(x0 - d, y0 - d); ctx.lineTo(x1 - d + 0.01, y1 - d); ctx.stroke()
}
function dot2(ctx, x, y, r, col, dark, ink) {
  if (ink) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + ink, 0, TAU); ctx.fill() }
  ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x - r * LIT, y - r * LIT, r * 0.7, 0, TAU); ctx.fill()
}

// an arm from the shoulder to where the pose puts the hand; the elbow bends out from his side, never across him
function armPts(side, hand) {
  const sx = 0.0, sy = side * SH
  let dx = hand[0] - sx, dy = hand[1] - sy, d = Math.hypot(dx, dy) || 0.001
  if (d > REACH) { dx *= REACH / d; dy *= REACH / d; d = REACH }
  const hgt = Math.sqrt(Math.max(0, UARM * UARM - d * d / 4)), ux = dx / d, uy = dy / d
  let ox = -uy, oy = ux
  if (ox * -0.5 + oy * side < 0) { ox = -ox; oy = -oy }               // (out to his side and a little back)
  return [sx, sy, sx + dx / 2 + ox * hgt, sy + dy / 2 + oy * hgt, sx + dx, sy + dy]
}
function arm(ctx, side, hand, L, ink) {
  const [sx, sy, ex, ey, hx, hy] = armPts(side, hand)
  const z = clamp(hand[2] || 0, 0, 1.2), sc = FR.sc, up = 1 + 0.22 * z
  const ru = sc * 0.074, rf = sc * 0.064 * up, rh = sc * 0.074 * up
  capInk(ctx, PX(sx, sy), PY(sx, sy), PX(ex, ey), PY(ex, ey), ru, ink)
  capInk(ctx, PX(ex, ey), PY(ex, ey), PX(hx, hy), PY(hx, hy), rf, ink)
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(PX(hx, hy), PY(hx, hy), rh + ink, 0, TAU); ctx.fill()
  cap2(ctx, PX(sx, sy), PY(sx, sy), PX(ex, ey), PY(ex, ey), ru, L.skin, L.skinD)
  cap2(ctx, PX(ex, ey), PY(ex, ey), PX(hx, hy), PY(hx, hy), rf, L.skin, L.skinD)
  dot2(ctx, PX(hx, hy), PY(hx, hy), rh, L.skin, L.skinD, 0)
}

// a leg in a stride: from under his shorts to the shoe (only drawn when the foot is out from under him)
function leg(ctx, side, foot, toe, L, ink) {
  const hx = -0.04, hy = side * 0.14, sc = FR.sc
  const fx = foot[0], fy = foot[1]
  const out = Math.hypot(fx - hx, fy - hy)
  if (out > 0.16) {
    const r = sc * 0.075
    capInk(ctx, PX(hx, hy), PY(hx, hy), PX(fx, fy), PY(fx, fy), r, ink)
    cap2(ctx, PX(hx, hy), PY(hx, hy), PX(fx, fy), PY(fx, fy), r, L.skin, L.skinD)
  }
  // the shoe, toe the way it points
  const tx = Math.cos(toe), ty = Math.sin(toe)
  const x0 = fx - tx * 0.07, y0 = fy - ty * 0.07, x1 = fx + tx * 0.1, y1 = fy + ty * 0.1, r = sc * 0.068
  capInk(ctx, PX(x0, y0), PY(x0, y0), PX(x1, y1), PY(x1, y1), r, ink)
  cap2(ctx, PX(x0, y0), PY(x0, y0), PX(x1, y1), PY(x1, y1), r, L.shoe, tone(L.shoe, 0.72))
  ctx.strokeStyle = L.colD; ctx.lineWidth = Math.max(1, r * 0.5); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(PX(x0 + tx * 0.04, y0 + ty * 0.04), PY(x0 + tx * 0.04, y0 + ty * 0.04)); ctx.lineTo(PX(fx + tx * 0.02, fy + ty * 0.02), PY(fx + tx * 0.02, fy + ty * 0.02)); ctx.stroke()
}

// his shorts: the part of them that shows round his hips from above (wider than his waist, below the jersey)
function shorts(ctx, f, L, ink) {
  const ln = f.lean || 0, cx = -0.06 - ln * 0.5
  ctx.save(); ctx.translate(PX(cx, 0), PY(cx, 0)); ctx.rotate(f.ang)
  const rx = FR.sc * 0.2, ry = FR.sc * 0.31
  ctx.beginPath(); ctx.ellipse(0, 0, rx + ink, ry + ink, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill()
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fillStyle = L.colD; ctx.fill()
  ctx.restore()
}

// the jersey: the singlet over his shoulders and back, two tones, the trim at the neck and arm holes, his number
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
  path(); ctx.lineJoin = 'round'; ctx.lineWidth = ink * 2; ctx.strokeStyle = INK; ctx.stroke()
  ctx.fillStyle = L.colD; ctx.fill()
  // the lit side: the same shape a little up and to the left, inside it
  ctx.save(); path(); ctx.clip()
  const d = FR.sc * 0.06
  ctx.translate(-d, -d); path(0.92); ctx.fillStyle = L.col; ctx.fill()
  ctx.restore()
  // the bare shoulders (a singlet): the arm holes, trimmed
  for (const sd of [-1, 1]) {
    const p = P(0.0, sd * SH)
    dot2(ctx, p[0], p[1], FR.sc * 0.074, L.skin, L.skinD, 0)
  }
  // his number across his upper back (it reads from behind him)
  if (L.num) {
    const c0 = P(-0.2, 0), fs = FR.sc * (L.num.length > 1 ? 0.22 : 0.25)
    ctx.save(); ctx.translate(c0[0], c0[1]); ctx.rotate(f.ang + Math.PI / 2)
    ctx.font = `${fs.toFixed(1)}px "BAP Anton", "Anton", "BAP Bebas", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, fs * 0.14); ctx.strokeStyle = L.ink === '#10151a' ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)'; ctx.strokeText(L.num, 0, fs * 0.04)
    ctx.fillStyle = L.ink; ctx.fillText(L.num, 0, fs * 0.04)
    ctx.restore()
  }
}

function head(ctx, f, L, ink) {
  const ln = (f.lean || 0) * 1.5, cx = 0.085 + ln, R = 0.16, sc = FR.sc
  const hx = PX(cx, 0), hy = PY(cx, 0), r = R * sc
  // the collar round his neck
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(PX(cx - 0.03, 0), PY(cx - 0.03, 0), r * 1.16 + ink, 0, TAU); ctx.fill()
  ctx.fillStyle = L.trim; ctx.beginPath(); ctx.arc(PX(cx - 0.03, 0), PY(cx - 0.03, 0), r * 1.16, 0, TAU); ctx.fill()
  // ears, his nose just past his brow, then his head
  for (const sd of [-1, 1]) dot2(ctx, PX(cx - 0.01, sd * R * 0.98), PY(cx - 0.01, sd * R * 0.98), r * 0.2, L.skin, L.skinD, ink * 0.7)
  dot2(ctx, PX(cx + R * 0.98, 0), PY(cx + R * 0.98, 0), r * 0.17, L.skin, L.skinD, ink * 0.7)
  dot2(ctx, hx, hy, r, L.skin, L.skinD, ink)
  // his hair, from above: all of the top of his head but his forehead
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.clip()
  const st = L.style
  const capOf = (back, rx, ry, col) => { ctx.beginPath(); ctx.ellipse(PX(cx - back * R, 0), PY(cx - back * R, 0), rx * r, ry * r, f.ang, 0, TAU); ctx.fillStyle = col; ctx.fill() }
  if (st === 'fade') { capOf(0.3, 0.94, 1.04, tone(L.skin, 0.6)); capOf(0.2, 0.72, 0.7, L.hair) }
  else if (st === 'waves') { capOf(0.34, 0.92, 1.04, L.hair); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = Math.max(0.8, r * 0.09); for (const k of [0.32, 0.6]) { ctx.beginPath(); ctx.arc(PX(cx - 0.34 * R, 0), PY(cx - 0.34 * R, 0), k * r, 0, TAU); ctx.stroke() } }
  else if (st === 'braids') {
    capOf(0.3, 0.96, 1.06, L.hair); ctx.strokeStyle = tone(L.skin, 0.66); ctx.lineWidth = Math.max(0.8, r * 0.1)
    for (const k of [-0.5, -0.17, 0.17, 0.5]) { ctx.beginPath(); ctx.moveTo(PX(cx + R * 0.55, k * R), PY(cx + R * 0.55, k * R)); ctx.lineTo(PX(cx - R, k * R * 1.25), PY(cx - R, k * R * 1.25)); ctx.stroke() }
  } else capOf(st === 'twists' ? 0.26 : 0.34, 0.92, 1.04, L.hair)
  // the light on the crown
  ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.beginPath(); ctx.ellipse(hx - r * 0.28, hy - r * 0.3, r * 0.34, r * 0.2, -0.7, 0, TAU); ctx.fill()
  ctx.restore()
  if (st === 'twists') for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.35, kx = cx - 0.05 + Math.cos(a) * R * 0.84, ky = Math.sin(a) * R * 0.86; if (Math.cos(a) > 0.5) continue; dot2(ctx, PX(kx, ky), PY(kx, ky), r * 0.19, L.hair, L.hair, 0) }
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.lineWidth = ink; ctx.strokeStyle = INK; ctx.stroke()
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
  leg(ctx, -1, f.lf, f.toeL || 0, L, ink); leg(ctx, 1, f.rf, f.toeR || 0, L, ink)
  shorts(ctx, f, L, ink)
  const lz = f.lh[2] || 0, rz = f.rh[2] || 0
  if (lz < 0.6) arm(ctx, -1, f.lh, L, ink)
  if (rz < 0.6) arm(ctx, 1, f.rh, L, ink)
  torso(ctx, f, L, ink)
  head(ctx, f, L, ink)
  if (lz >= 0.6) arm(ctx, -1, f.lh, L, ink)
  if (rz >= 0.6) arm(ctx, 1, f.rh, L, ink)
}
export { clamp }
