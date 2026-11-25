// BLACKTOP LIVE: a man on the court, seen from straight above, in the mini games' flat look (one ink line round
// every part, two tones, no gradients): the top of his head and his hair, his shoulders and jersey in his side's
// colour with his number across his back, bare arms that go where the pose puts his hands, legs and shoes that
// stride out from under him. Drawn fresh every frame from a pose (pose.js makes those from the game): nothing
// here knows the rules.
//
// A pose is in the man's own frame, in units of his size (s px, about his shoulders' width): x forward (the way he
// faces), y to his right. Hands carry a height too (0 at his waist, 1 over his head): a high hand is drawn bigger
// and over his head, a low one under his jersey.
//   drawFigure(ctx, f)   f: { x, y, s, ang, scale, air, lean, down, lh: [x, y, z], rh: [x, y, z], lf: [x, y],
//                             rf: [x, y], look: { col, trim, skin, hair, style, num }, flex }
//   handAt(f, hand, out) where a hand is on the screen: out = [px, py]
const INK = 'rgba(8,12,16,.88)'
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

// What a man looks like: his side's colour, his skin tone and number from the roster where the game has them, and
// a haircut. The rosters carry no hair, so a cut is picked from his name (the same one every game): a young man's
// hair, dark, never grey, never thin.
const SKINS = ['#8d5a3b', '#6d4229', '#a9744f', '#5a3522', '#c09060']
const STYLES = ['short', 'short', 'fade', 'fade', 'twists', 'waves', 'braids']
export function lookOf({ name = '', skin = null, num = null, col = '#4da3ff' }) {
  const h = hashOf(name || 'player')
  const sk = /^#[0-9a-f]{6}$/i.test(skin || '') ? skin : SKINS[h % SKINS.length]
  const light = lum(sk) > 0.62
  return {
    col, colD: tone(col, 0.7), colL: tone(col, 1.25), trim: '#f4efe6',
    skin: sk, skinD: tone(sk, 0.78),
    hair: light ? ['#3a2a1c', '#4a3524', '#2a1e14'][(h >>> 3) % 3] : '#17120e',
    style: light ? ['short', 'short', 'fade', 'waves'][(h >>> 5) % 4] : STYLES[(h >>> 5) % STYLES.length],
    num: num == null || num === '' ? null : String(num).slice(0, 2),
    ink: lum(col) > 0.6 ? '#10151a' : '#f4efe6',                       // the number, readable on the jersey
  }
}

// his frame → the screen
const FR = { x: 0, y: 0, ca: 1, sa: 0, sc: 1 }
const PX = (lx, ly) => FR.x + (lx * FR.ca - ly * FR.sa) * FR.sc
const PY = (lx, ly) => FR.y + (lx * FR.sa + ly * FR.ca) * FR.sc
function frame(f) {
  const lift = (f.air || 0) * f.s * 0.2
  FR.sc = f.s * (f.scale ?? 1) * (1 + 0.2 * (f.air || 0)); FR.ca = Math.cos(f.ang); FR.sa = Math.sin(f.ang)
  FR.x = f.x; FR.y = f.y - lift
}
const SH = 0.4                                   // a shoulder: this far out from his middle
export function handAt(f, hand, out) {
  frame(f)
  // (the same reach the arm is drawn with)
  const sy = hand === f.lh ? -SH : SH, dx = hand[0] - 0.02, dy = hand[1] - sy, d = Math.hypot(dx, dy) || 0.001, k = Math.min(1, REACH / d)
  out[0] = PX(0.02 + dx * k, sy + dy * k); out[1] = PY(0.02 + dx * k, sy + dy * k)
  return out
}
// a point in his frame on the screen: out = [px, py, the same point on the floor's py] (the ball in his hand, its shadow)
export function pointAt(f, lx, ly, out) {
  frame(f)
  out[0] = PX(lx, ly); out[1] = PY(lx, ly); out[2] = out[1] + (f.air || 0) * f.s * 0.2
  return out
}

const UARM = 0.31, FARM = 0.31, REACH = UARM + FARM - 0.01
// a part with the ink line round it: a tapered stroke between two points
function bone(ctx, x0, y0, x1, y1, w, col, ink) {
  ctx.lineCap = 'round'
  ctx.strokeStyle = INK; ctx.lineWidth = w + ink * 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx, x, y, r, col, ink) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill()
  if (ink) { ctx.lineWidth = ink; ctx.strokeStyle = INK; ctx.stroke() }
}

function arm(ctx, f, side, hand, L, ink) {
  const sx = 0.02, sy = side * SH
  let dx = hand[0] - sx, dy = hand[1] - sy, d = Math.hypot(dx, dy) || 0.001
  if (d > REACH) { dx *= REACH / d; dy *= REACH / d; d = REACH }
  // the elbow: off the line to the hand, out and back from his chest
  const hgt = Math.sqrt(Math.max(0, UARM * UARM - d * d / 4)), ux = dx / d, uy = dy / d
  let ox = -uy, oy = ux
  if (ox * -0.6 + oy * side < 0) { ox = -ox; oy = -oy }
  const ex = sx + dx / 2 + ox * hgt, ey = sy + dy / 2 + oy * hgt, hx = sx + dx, hy = sy + dy
  const z = hand[2] || 0, sc = FR.sc, up = 1 + 0.3 * z
  bone(ctx, PX(sx, sy), PY(sx, sy), PX(ex, ey), PY(ex, ey), sc * 0.125, L.skin, ink)
  bone(ctx, PX(ex, ey), PY(ex, ey), PX(hx, hy), PY(hx, hy), sc * 0.105 * up, L.skin, ink)
  dot(ctx, PX(hx, hy), PY(hx, hy), sc * 0.078 * up, L.skin, ink)
}

function leg(ctx, side, foot, L, ink, toe) {
  const hx = -0.1, hy = side * 0.15, sc = FR.sc
  const fx = foot[0], fy = foot[1]
  const kx = hx + (fx - hx) * 0.6, ky = hy + (fy - hy) * 0.6 + side * 0.02
  if (Math.hypot(fx - hx, fy - hy) > 0.14) {
    bone(ctx, PX(kx, ky), PY(kx, ky), PX(fx, fy), PY(fx, fy), sc * 0.105, L.skin, ink)         // his calf
    // his sock, over the ankle
    const ax = kx + (fx - kx) * 0.6, ay = ky + (fy - ky) * 0.6
    ctx.strokeStyle = '#e8ebe6'; ctx.lineWidth = sc * 0.105; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(PX(ax, ay), PY(ax, ay)); ctx.lineTo(PX(fx, fy), PY(fx, fy)); ctx.stroke()
    bone(ctx, PX(hx, hy), PY(hx, hy), PX(kx, ky), PY(kx, ky), sc * 0.18, L.colD, ink)          // his shorts, to the knee
  }
  // the shoe, toe the way he faces: his side's colour, a white toe and sole
  const tx = Math.cos(toe), ty = Math.sin(toe)
  const x0 = fx - tx * 0.05, y0 = fy - ty * 0.05, x1 = fx + tx * 0.13, y1 = fy + ty * 0.13
  bone(ctx, PX(x0, y0), PY(x0, y0), PX(x1, y1), PY(x1, y1), sc * 0.16, '#f2f3ee', ink)
  ctx.strokeStyle = L.colD; ctx.lineWidth = sc * 0.1; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(PX(x0, y0), PY(x0, y0)); ctx.lineTo(PX(fx + tx * 0.04, fy + ty * 0.04), PY(fx + tx * 0.04, fy + ty * 0.04)); ctx.stroke()
}

function torso(ctx, f, L, ink) {
  const ln = f.lean || 0, P = (lx, ly) => [PX(lx + ln, ly), PY(lx + ln, ly)]
  const path = () => {
    ctx.beginPath()
    let p = P(-0.36, -0.2); ctx.moveTo(p[0], p[1])
    const q = (cx, cy, x, y) => { const c = P(cx, cy), e = P(x, y); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]) }
    q(-0.34, -0.41, -0.04, -0.41); q(0.17, -0.41, 0.18, -0.2); q(0.24, 0, 0.18, 0.2); q(0.17, 0.41, -0.04, 0.41); q(-0.34, 0.41, -0.36, 0.2); q(-0.41, 0, -0.36, -0.2)
    ctx.closePath()
  }
  path(); ctx.fillStyle = L.col; ctx.fill()
  // the small of his back, in shade; his shoulders catch the light
  ctx.save(); path(); ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,.2)'
  ctx.beginPath(); let a = P(-0.5, -0.6), b = P(-0.31, -0.6), c = P(-0.31, 0.6), d = P(-0.5, 0.6)
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.14)'
  ctx.beginPath(); a = P(0.06, -0.6); b = P(0.3, -0.6); c = P(0.3, 0.6); d = P(0.06, 0.6)
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.fill()
  // the piping down each side
  ctx.strokeStyle = L.trim; ctx.lineWidth = Math.max(1, FR.sc * 0.035); ctx.lineCap = 'butt'
  for (const sd of [-1, 1]) { const m = P(-0.4, sd * 0.32), n = P(0.2, sd * 0.32); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(n[0], n[1]); ctx.stroke() }
  ctx.restore()
  path(); ctx.lineWidth = ink; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke()
  // his number, across his back (it reads from behind him)
  if (L.num) {
    const c0 = P(-0.225, 0), fs = FR.sc * (L.num.length > 1 ? 0.27 : 0.3)
    ctx.save(); ctx.translate(c0[0], c0[1]); ctx.rotate(f.ang + Math.PI / 2)
    ctx.font = `${fs.toFixed(1)}px "BAP Anton", "Anton", "BAP Bebas", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = L.ink; ctx.fillText(L.num, 0, fs * 0.04)
    ctx.restore()
  }
  // his shoulders: bare (a singlet)
  for (const sd of [-1, 1]) { const p = P(0.015, sd * SH); dot(ctx, p[0], p[1], FR.sc * 0.092, L.skin, ink) }
}

function head(ctx, f, L, ink) {
  const ln = (f.lean || 0) * 1.6, cx = 0.115 + ln, R = 0.2, sc = FR.sc
  const hx = PX(cx, 0), hy = PY(cx, 0), r = R * sc
  // the collar under his chin
  ctx.beginPath(); ctx.arc(PX(cx - 0.035, 0), PY(cx - 0.035, 0), r * 1.04, 0, TAU); ctx.fillStyle = L.trim; ctx.fill()
  // ears, then his head
  for (const sd of [-1, 1]) dot(ctx, PX(cx - 0.01, sd * R * 0.98), PY(cx - 0.01, sd * R * 0.98), r * 0.24, L.skinD, ink * 0.8)
  dot(ctx, hx, hy, r, L.skin, ink)
  // his nose, just past his forehead
  dot(ctx, PX(cx + R * 1.0, 0), PY(cx + R * 1.0, 0), r * 0.2, L.skinD, ink * 0.7)
  dot(ctx, hx, hy, r - ink * 0.5, L.skin, 0)
  // his hair, from above: all of the top of his head but his forehead
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r - ink * 0.4, 0, TAU); ctx.clip()
  const st = L.style
  const cap = (back, rx, ry, col) => { ctx.beginPath(); ctx.ellipse(PX(cx - back * R, 0), PY(cx - back * R, 0), rx * r, ry * r, f.ang, 0, TAU); ctx.fillStyle = col; ctx.fill() }
  if (st === 'fade') { cap(0.3, 0.92, 1.02, tone(L.skin, 0.62)); cap(0.2, 0.7, 0.68, L.hair) }
  else if (st === 'waves') { cap(0.34, 0.9, 1.02, L.hair); ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = Math.max(0.8, r * 0.09); for (const k of [0.3, 0.58, 0.86]) { ctx.beginPath(); ctx.ellipse(PX(cx - 0.34 * R, 0), PY(cx - 0.34 * R, 0), k * r, k * r, 0, 0, TAU); ctx.stroke() } }
  else if (st === 'braids') {
    cap(0.3, 0.94, 1.04, L.hair); ctx.strokeStyle = tone(L.skin, 0.7); ctx.lineWidth = Math.max(0.8, r * 0.1)
    for (const k of [-0.5, -0.17, 0.17, 0.5]) { ctx.beginPath(); ctx.moveTo(PX(cx + R * 0.55, k * R), PY(cx + R * 0.55, k * R)); ctx.lineTo(PX(cx - R, k * R * 1.25), PY(cx - R, k * R * 1.25)); ctx.stroke() }
  } else cap(st === 'twists' ? 0.26 : 0.34, 0.9, 1.02, L.hair)
  ctx.restore()
  if (st === 'twists') {
    // twists stand up off his head: a ring of them past its edge
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.35, kx = cx - 0.05 + Math.cos(a) * R * 0.84, ky = Math.sin(a) * R * 0.86; if (Math.cos(a) > 0.5) continue; dot(ctx, PX(kx, ky), PY(kx, ky), r * 0.2, L.hair, 0) }
  }
  // a little light on the crown
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.ellipse(hx - r * 0.2, hy - r * 0.3, r * 0.34, r * 0.2, -0.6, 0, TAU); ctx.fill()
}

// his shadow on the floor (drawn for everyone before any man, so no shadow lies on a man)
export function drawShadow(ctx, f) {
  const air = f.air || 0, s = f.s
  ctx.fillStyle = `rgba(0,0,0,${(0.36 - 0.12 * Math.min(1, air)).toFixed(3)})`
  ctx.beginPath(); ctx.ellipse(f.x + s * (0.04 + 0.05 * air), f.y + s * (0.09 + 0.1 * air), s * (0.5 - 0.09 * Math.min(1, air)) * (f.down ? 1.15 : 1), s * (0.44 - 0.09 * Math.min(1, air)), 0, 0, TAU); ctx.fill()
}

export function drawFigure(ctx, f) {
  frame(f)
  const L = f.look, ink = Math.max(1, FR.sc * 0.034)
  // legs and shoes under him
  leg(ctx, -1, f.lf, L, ink, f.toeL || 0); leg(ctx, 1, f.rf, L, ink, f.toeR || 0)
  // his shorts show behind his jersey when he's bent or on the floor
  if (f.down) { const a = PX(-0.3, 0), b = PY(-0.3, 0); ctx.beginPath(); ctx.ellipse(a, b, FR.sc * 0.2, FR.sc * 0.3, f.ang, 0, TAU); ctx.fillStyle = L.colD; ctx.fill(); ctx.lineWidth = ink; ctx.strokeStyle = INK; ctx.stroke() }
  const lz = f.lh[2] || 0, rz = f.rh[2] || 0
  if (lz < 0.6) arm(ctx, f, -1, f.lh, L, ink)
  if (rz < 0.6) arm(ctx, f, 1, f.rh, L, ink)
  torso(ctx, f, L, ink)
  head(ctx, f, L, ink)
  if (lz >= 0.6) arm(ctx, f, -1, f.lh, L, ink)
  if (rz >= 0.6) arm(ctx, f, 1, f.rh, L, ink)
}
export { clamp }
