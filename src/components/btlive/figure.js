// BLACKTOP LIVE: a man on the court, seen from straight above (a broadcast skycam), in the mini games' flat look
// (src/lib/mg/rig.js: round limbs, one even ink line round the whole man, flat tones with the light up and to the left
// of the screen). From above a player is his shoulder line and the top of his head: the sleeveless jersey in his
// side's colour over his shoulders and upper back (a neckline round his head, the armholes with his deltoids out of
// them), slim bare arms close to his sides, his hair, his shorts at his hips, and his legs and shoes stepping out from
// under him when he moves. No number on his back (the owner, 11-26: "you don't need to see their number"); his name
// tag says who he is. Drawn fresh every frame from a pose (pose.js makes those from the game): nothing here knows
// the rules.
//
// A pose is in the man's own frame, in units of his size (s px, about his shoulders' width): x forward (the way he
// faces), y to his right. Hands carry a height too (0 at his waist, 1 over his head): a high hand is drawn a touch
// bigger and over his head and shoulders, a low one under them.
//   drawFigure(ctx, f)   f: { x, y, s, ang, scale, air, lean, down, lh: [x, y, z], rh: [x, y, z], lf: [x, y],
//                             rf: [x, y], toeL, toeR, look: { col, colD, colL, trim, skin, skinD, skinL, hair, style, bw, shoe } }
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

// What a man looks like: his side's colour, his skin tone from the roster, his build, and a haircut. The rosters
// carry no hair, so a cut is picked from his name (the same one every game): a young man's hair, dark, never grey,
// never thin.
const SKINS = ['#8d5a3b', '#6d4229', '#a9744f', '#5a3522', '#c09060']
const STYLES = ['short', 'short', 'fade', 'fade', 'twists', 'waves', 'braids']
// bw: how broad he is across the shoulders, by his Size rating (0-1) and his spot: a guard lean, a big broader
// his skin as the court shows it (owner 11-26: white players looked too dark): the tones are sampled off studio photos,
// so the light and medium ones read dark and red on the asphalt; they're lifted toward a natural light skin by how
// light they are (a dark tone barely moves)
const MIXC = (a, b, t) => { const p = x => parseInt(x.slice(1), 16), A = p(a), B = p(b), c = k => Math.round(((A >> k) & 255) * (1 - t) + ((B >> k) & 255) * t); return '#' + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0') }
function onCourt(hex) {
  const l = lum(hex)
  const t = l >= 0.55 ? 0.5 : l >= 0.45 ? 0.2 + (l - 0.45) * 3 : l >= 0.35 ? (l - 0.35) * 2 : 0
  return MIXC(hex, '#f3d6c2', Math.min(0.55, t))
}
export function lookOf({ name = '', skin = null, col = '#4da3ff', size = 0.5, big = false }) {
  const h = hashOf(name || 'player')
  const sk = /^#[0-9a-f]{6}$/i.test(skin || '') ? onCourt(skin) : SKINS[h % SKINS.length]
  const light = lum(sk) > 0.62
  return {
    col, colD: tone(col, 0.7), colL: tone(col, 1.18),
    skin: sk, skinD: tone(sk, 0.74), skinL: tone(sk, 1.1),
    hair: light ? ['#3a2a1c', '#4a3524', '#2a1e14'][(h >>> 3) % 3] : '#16110d',
    style: light ? ['short', 'short', 'fade', 'waves'][(h >>> 5) % 4] : STYLES[(h >>> 5) % STYLES.length],
    trim: lum(col) > 0.6 ? tone(col, 0.55) : '#f4efe6',               // the collar and armhole trim
    bw: (big ? 1.02 : 0.88) + (big ? 0.14 : 0.1) * clamp(size, 0, 1),
    // his whole frame by his Size (owner 11-26: a bigger gap between small men and big ones): a small guard 0.92, a 7-footer about 1.12
    sz: 0.92 + 0.16 * clamp(size, 0, 1) + (big ? 0.04 : 0),
    shoe: ['#e4e6e0', '#e4e6e0', '#1d2228'][(h >>> 7) % 3], shoeD: ['#b9bcb4', '#b9bcb4', '#0f1317'][(h >>> 7) % 3],
  }
}

// his frame → the screen
const FR = { x: 0, y: 0, ca: 1, sa: 0, sc: 1, ang: 0 }
const PX = (lx, ly) => FR.x + (lx * FR.ca - ly * FR.sa) * FR.sc
const PY = (lx, ly) => FR.y + (lx * FR.sa + ly * FR.ca) * FR.sc
function frame(f) {
  const lift = (f.air || 0) * f.s * 0.2
  FR.sc = f.s * BODY * (f.look?.sz ?? 1) * (f.scale ?? 1) * (1 + 0.16 * (f.air || 0)); FR.ca = Math.cos(f.ang); FR.sa = Math.sin(f.ang)
  FR.x = f.x; FR.y = f.y - lift; FR.ang = f.ang
  BW = f.look?.bw ?? 1; SH = SH0 * BW
}
// a point in his frame on the screen: out = [px, py, the same point on the floor's py] (the ball in his hand, its shadow)
// (z: for a hand, or a ball held in the hands, its height as a hand's 0-1.2: foreshortened as the arm is, below)
export function pointAt(f, lx, ly, out, z = null) {
  frame(f)
  ly = across(ly)
  if (z != null) { fore(lx, ly, z); lx = FO[0]; ly = FO[1] }
  out[0] = PX(lx, ly); out[1] = PY(lx, ly); out[2] = out[1] + (f.air || 0) * f.s * 0.2
  return out
}
// Seen from straight overhead an arm is foreshortened unless it's held out level: a hand raised over his head, or down
// at his hip or his knees, shows only a little way out from his shoulder line, not a whole arm's length (the owner,
// 11-26: the arms read as long rods). A hand (and a ball held in the hands) is drawn in toward his shoulder line by up
// to 45% raised, 35% low
const FO = [0, 0]
function fore(x, y, z) {
  const f = z >= 0.5 ? 1 - 0.45 * clamp((z - 0.45) / 0.45, 0, 1) : 1 - 0.35 * clamp((0.5 - z) / 0.3, 0, 1), by = clamp(y, -SH, SH)
  FO[0] = x * f; FO[1] = by + (y - by) * f
}
// a held ball's height (ft) as a hand's height (pointAt's z)
export const ballHz = bz => clamp(0.36 + (bz - 3) / 5.3 * 0.64, 0, 1.2)

// An athlete's build seen from above (the owner, 11-26: "they look fat"): a real player's shoulders are about three
// heads across and his chest, front to back, under half that, so from overhead he is a flat shoulder line with a small
// head on it, not a round blob. In his size units: the jersey about 0.43 across and 0.24 deep, the deltoids taking it
// to about 0.6 (a guard a touch less, a big a touch more: bw), the head 0.2 long and 0.17 wide
// (BODY: the whole man a touch bigger than his size unit, so the slimmer build still fills the spot he takes up)
const BODY = 1.45   // (owner 11-26: the slimmer men read too small: a size up)
const SH0 = 0.26                                  // a shoulder joint: this far out from his middle (times bw)
let SH = SH0, BW = 1
// The poses (pose.js) place the hands and the ball across him for a broader man than this one (the shoulder at 0.33):
// across, a hand and the ball are brought in to this body (inside the shoulder in proportion, past it at a little over
// half the distance), so an arm at his side hangs by his hip instead of sticking out like a wing, a defender's arms are
// still out wide, and the ball stays under the hand
const across = y => { const a = Math.abs(y); return Math.sign(y) * (a <= 0.33 ? a * SH / 0.33 : SH + (a - 0.33) * 0.62) }
const UARM = 0.27, FARM = 0.27, REACH = UARM + FARM - 0.01

// ── the drawing pieces. A man is drawn in two passes, all of his ink first and then all of his fills on top
// (PASS), so the parts melt into one shape with a single clean outline round the whole man and no lines inside him
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
// an ellipse in his frame (centre lx, ly; rx along his facing, ry across)
function oval(ctx, lx, ly, rx, ry, col, ink) {
  const sc = FR.sc
  ctx.beginPath(); ctx.ellipse(PX(lx, ly), PY(lx, ly), rx * sc + (PASS === 0 ? ink : 0), ry * sc + (PASS === 0 ? ink : 0), FR.ang, 0, TAU)
  ctx.fillStyle = PASS === 0 ? INK : col; ctx.fill()
}

// An arm from the shoulder to where the pose puts the hand, bent at the elbow the way a real arm bends: worked out in
// three dimensions (the hand's height counts) and then seen from above. The elbow points down at the floor and in at
// his ribs, so from straight above it stays close to his body: never out past the line of his shoulder, whatever the
// hand does (the owner, 11-25: the elbows were too far out; 11-26: keep the arms simple, slim, close to him)
const SHZ = 0.55, ZH = 1.0                        // a hand's height over his shoulder is z * ZH - SHZ (his size): z 0.2-0.35 is his hip, 1 over his head
export function armPts(side, hand) {
  const sx = 0.0, sy = side * SH
  fore(hand[0], across(hand[1]), hand[2] || 0)
  let dx = FO[0] - sx, dy = FO[1] - sy, h = Math.hypot(dx, dy) || 0.001
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
// The arm is drawn as one slim limb straight from the shoulder to the hand, tapering to the wrist (the owner, 11-26:
// "every time you add elbows and stuff it looks awful"). From straight overhead a real arm reads that way: the elbow
// sits under the line from the shoulder to the hand, so no joint shows. One skin tone, the one outline round it
function limb(ctx, x0, y0, r0, x1, y1, r1, col) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy)
  ctx.fillStyle = col; ctx.beginPath()
  if (l > Math.abs(r0 - r1) + 0.01) {
    const a = Math.atan2(dy, dx), b = Math.acos((r0 - r1) / l)
    ctx.arc(x0, y0, r0, a + b, a - b + TAU); ctx.arc(x1, y1, r1, a - b, a + b)
  } else ctx.arc(x0, y0, Math.max(r0, r1), 0, TAU)
  ctx.closePath(); ctx.fill()
}
function arm(ctx, side, hand, L, ink) {
  const [sx, sy, , , hx, hy] = armPts(side, hand)
  const z = clamp(hand[2] || 0, 0, 1.2), sc = FR.sc, up = 1 + 0.1 * z
  // (slim: the upper arm tapering to the wrist, the hand a small round end on it)
  const ru = sc * 0.031, rw = sc * 0.023, rh = sc * 0.03 * up
  const X0 = PX(sx, sy), Y0 = PY(sx, sy), X1 = PX(hx, hy), Y1 = PY(hx, hy)
  if (PASS === 0) { limb(ctx, X0, Y0, ru + ink, X1, Y1, rw + ink, INK); ctx.beginPath(); ctx.arc(X1, Y1, rh + ink, 0, TAU); ctx.fill() }
  else { limb(ctx, X0, Y0, ru, X1, Y1, rw, L.skin); ctx.beginPath(); ctx.arc(X1, Y1, rh, 0, TAU); ctx.fill() }
}

// a leg in a stride: out from under his shorts (the shorts down his thigh, then his bare shin) to the shoe. Only drawn
// once the foot is out from under him; the shoe always
function leg(ctx, side, foot, toe, L, ink) {
  const hx = -0.04, hy = side * 0.09 * BW, sc = FR.sc
  const fx = foot[0], fy = foot[1]
  const out = Math.hypot(fx - hx, fy - hy)
  if (out > 0.14) {
    const kx = hx + (fx - hx) * 0.45, ky = hy + (fy - hy) * 0.45
    capInk(ctx, PX(hx, hy), PY(hx, hy), PX(fx, fy), PY(fx, fy), sc * 0.042, ink)
    capInk(ctx, PX(hx, hy), PY(hx, hy), PX(kx, ky), PY(kx, ky), sc * 0.056, ink)
    cap2(ctx, PX(hx, hy), PY(hx, hy), PX(fx, fy), PY(fx, fy), sc * 0.042, L.skin)
    cap2(ctx, PX(hx, hy), PY(hx, hy), PX(kx, ky), PY(kx, ky), sc * 0.056, L.colD)
  }
  // the shoe, toe the way it points: long and narrow, its heel half a shade darker
  const tx = Math.cos(toe), ty = Math.sin(toe)
  const x0 = fx - tx * 0.06, y0 = fy - ty * 0.06, x1 = fx + tx * 0.08, y1 = fy + ty * 0.08, r = sc * 0.042
  capInk(ctx, PX(x0, y0), PY(x0, y0), PX(x1, y1), PY(x1, y1), r, ink)
  cap2(ctx, PX(x0, y0), PY(x0, y0), PX(x1, y1), PY(x1, y1), r, L.shoe)
  if (PASS === 1) { const mx = fx - tx * 0.01, my = fy - ty * 0.01; cap2(ctx, PX(x0, y0), PY(x0, y0), PX(mx, my), PY(mx, my), r * 0.55, L.shoeD) }
}

// his shorts: what shows of them round his hips from above (they show behind him when he leans into a run)
function shorts(ctx, f, L, ink) {
  oval(ctx, -0.04, 0, 0.085, 0.165 * BW, L.colD, ink)
}

// the jersey: a sleeveless top seen from above. Square across the shoulder straps, the chest a little narrower in
// front, the upper back flat; his deltoids come out of the armholes, the neckline scoops round his neck
const JPTS = [[0.1, 0], [0.098, 0.11], [0.07, 0.19], [0.005, 0.228], [-0.075, 0.215], [-0.118, 0.15], [-0.128, 0.06], [-0.128, -0.06], [-0.118, -0.15], [-0.075, -0.215], [0.005, -0.228], [0.07, -0.19], [0.098, -0.11]]
function torso(ctx, f, L, ink) {
  const ln = f.lean || 0
  const P = (lx, ly) => [PX(lx + ln, ly * BW), PY(lx + ln, ly * BW)]
  const path = (g = 1) => {
    ctx.beginPath()
    const pts = JPTS, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const s0 = m(pts[pts.length - 1], pts[0]); let q = P(s0[0] * g, s0[1] * g); ctx.moveTo(q[0], q[1])
    for (let i = 0; i < pts.length; i++) { const c = P(pts[i][0] * g, pts[i][1] * g), e0 = m(pts[i], pts[(i + 1) % pts.length]), e = P(e0[0] * g, e0[1] * g); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]) }
    ctx.closePath()
  }
  const sc = FR.sc
  // the deltoids: rounded caps at the ends of his shoulder line, under the jersey's armholes
  for (const sd of [-1, 1]) oval(ctx, ln - 0.008, sd * SH, 0.074, 0.058 * Math.min(1.1, BW), L.skin, ink)
  if (PASS === 0) { path(); ctx.lineJoin = 'round'; ctx.lineWidth = ink * 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = INK; ctx.fill(); return }
  // the deltoids' shade: the side away from the light
  for (const sd of [-1, 1]) {
    ctx.save(); oval(ctx, ln - 0.008, sd * SH, 0.074, 0.058 * Math.min(1.1, BW), L.skin, 0); ctx.clip()
    ctx.translate(sc * 0.03, sc * 0.03); oval(ctx, ln - 0.008, sd * SH, 0.074, 0.058 * Math.min(1.1, BW), L.skinD, 0)
    ctx.restore()
  }
  // the jersey: one colour, one soft shade down the side away from the light
  path(); ctx.fillStyle = L.colD; ctx.fill()
  ctx.save(); path(); ctx.clip()
  const d = sc * 0.03
  ctx.translate(-d, -d); path(0.97); ctx.fillStyle = L.col; ctx.fill()
  ctx.restore()
  // the neckline: the scoop of skin in front of his neck, its trim round it
  ctx.save(); path(); ctx.clip()
  const nc = P(0.045, 0)
  ctx.beginPath(); ctx.ellipse(nc[0], nc[1], sc * 0.1, sc * 0.088, f.ang, 0, TAU)
  ctx.fillStyle = L.skinD; ctx.fill()
  ctx.lineWidth = Math.max(1, sc * 0.018); ctx.strokeStyle = L.trim; ctx.stroke()
  ctx.restore()
  // the armholes' trim: along the jersey's edge over each deltoid
  ctx.lineWidth = Math.max(1, sc * 0.016); ctx.strokeStyle = L.trim; ctx.lineCap = 'round'
  for (const sd of [-1, 1]) {
    const a0 = P(0.075, sd * 0.165), c = P(0.01, sd * 0.25), a1 = P(-0.085, sd * 0.19)
    ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.quadraticCurveTo(c[0], c[1], a1[0], a1[1]); ctx.stroke()
  }
}

// his head from above: a smaller oval than the shoulders (longer front to back than across), his ears, his hair over
// all of it but his forehead, one outline
function head(ctx, f, L, ink) {
  const ln = (f.lean || 0) * 1.5, cx = 0.03 + ln, RX = 0.1, RY = 0.084, sc = FR.sc
  if (PASS === 0) { for (const sd of [-1, 1]) dot2(ctx, PX(cx + 0.005, sd * RY), PY(cx + 0.005, sd * RY), sc * 0.019, L.skin, ink); oval(ctx, cx, 0, RX, RY, L.skin, ink); return }
  for (const sd of [-1, 1]) dot2(ctx, PX(cx + 0.005, sd * RY), PY(cx + 0.005, sd * RY), sc * 0.019, L.skinD, 0)
  oval(ctx, cx, 0, RX, RY, L.skin, 0)
  ctx.save(); ctx.beginPath(); ctx.ellipse(PX(cx, 0), PY(cx, 0), RX * sc, RY * sc, f.ang, 0, TAU); ctx.clip()
  const st = L.style
  const capOf = (back, rx, ry, col) => { ctx.beginPath(); ctx.ellipse(PX(cx - back * RX, 0), PY(cx - back * RX, 0), rx * RX * sc, ry * RY * sc, f.ang, 0, TAU); ctx.fillStyle = col; ctx.fill() }
  if (st === 'fade') { capOf(0.3, 0.94, 1.06, tone(L.skin, 0.6)); capOf(0.22, 0.74, 0.74, L.hair) }
  else capOf(st === 'twists' ? 0.24 : st === 'braids' ? 0.28 : 0.32, 0.93, 1.06, L.hair)
  ctx.restore()
}

// his shadow on the floor (drawn for everyone before any man, so no shadow lies on a man): soft, darkest under him
// and fading out at its edge, smaller and lighter the higher he goes
export function drawShadow(ctx, f) {
  const air = Math.min(1.2, f.air || 0), s = f.s * (BODY / 1.08) * (f.look?.sz ?? 1), bw = f.look?.bw ?? 1
  const a = 0.13 - 0.05 * Math.min(1, air)
  const cx = f.x + s * (0.04 + 0.07 * air), cy = f.y + s * (0.06 + 0.1 * air)
  const rx = s * (0.3 - 0.06 * air) * (f.down ? 1.3 : 1), ry = s * (0.36 - 0.07 * air) * bw
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(f.ang); ctx.scale(rx, ry)
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.2)
  gr.addColorStop(0, `rgba(0,0,0,${(a * 3).toFixed(3)})`); gr.addColorStop(0.55, `rgba(0,0,0,${(a * 2.2).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, TAU); ctx.fill(); ctx.restore()
}

export function drawFigure(ctx, f) {
  frame(f)
  const L = f.look, ink = Math.max(1, FR.sc * 0.028)
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
