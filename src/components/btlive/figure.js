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
    sz: 0.95 + 0.11 * clamp(size, 0, 1) + (big ? 0.02 : 0),   // (11-26: a touch less gap: about 0.95 to 1.08)
    shoe: ['#e4e6e0', '#e4e6e0', '#1d2228'][(h >>> 7) % 3], shoeD: ['#b9bcb4', '#b9bcb4', '#0f1317'][(h >>> 7) % 3],
  }
}

// his frame → the screen. The shoulders and arms turn a little against his hips as he runs (TW, the shoulders' twist
// off his facing; HIP, the hips'): a runner's chest swings against his stride while his head stays on where he's going
const FR = { x: 0, y: 0, ca: 1, sa: 0, sc: 1, ang: 0 }
const PX = (lx, ly) => FR.x + (lx * FR.ca - ly * FR.sa) * FR.sc
const PY = (lx, ly) => FR.y + (lx * FR.sa + ly * FR.ca) * FR.sc
let TW = 0, TWc = 1, TWs = 0, HIP = 0
// a point turned with his shoulders (tx/ty) or his hips (hx/hy), still in his frame
const TP = [0, 0]
function tw(lx, ly) { TP[0] = lx * TWc - ly * TWs; TP[1] = lx * TWs + ly * TWc; return TP }
function frame(f) {
  const lift = (f.air || 0) * f.s * 0.2
  FR.sc = f.s * BODY * (f.look?.sz ?? 1) * (f.scale ?? 1) * (1 + 0.16 * (f.air || 0)); FR.ca = Math.cos(f.ang); FR.sa = Math.sin(f.ang)
  FR.x = f.x; FR.y = f.y - lift; FR.ang = f.ang
  BW = f.look?.bw ?? 1; SH = SH0 * BW
  // a big's arms and legs are thicker in the same measure as his shoulders are broader (the owner, 11-26: a big's arms
  // read as thin sticks off broad shoulders)
  AW = 1 + 0.15 * (BW - 1)
  TW = clamp(f.tw || 0, -0.3, 0.3); TWc = Math.cos(TW); TWs = Math.sin(TW); HIP = clamp(f.hip || 0, -0.3, 0.3)
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
// to 58% raised, 35% low
const FO = [0, 0]
function fore(x, y, z) {
  const f = z >= 0.5 ? 1 - 0.58 * clamp((z - 0.45) / 0.45, 0, 1) : 1 - 0.35 * clamp((0.5 - z) / 0.3, 0, 1), by = clamp(y, -SH, SH)
  FO[0] = x * f; FO[1] = by + (y - by) * f
}
// a held ball's height (ft) as a hand's height (pointAt's z)
export const ballHz = bz => clamp(0.36 + (bz - 3) / 5.3 * 0.64, 0, 1.2)

// An athlete's build seen from above (the owner, 11-26: "they look fat"): a real player's shoulders are about three
// heads across and his chest, front to back, under half that, so from overhead he is a flat shoulder line with a small
// head on it, not a round blob. In his size units: the jersey about 0.46 across and 0.23 deep, the deltoids taking it
// to about 0.6 (a guard a touch less, a big a touch more: bw), the head 0.2 long and 0.17 wide
// (BODY: the whole man a touch bigger than his size unit, so the slimmer build still fills the spot he takes up)
export const BODY = 1.45   // (owner 11-26: the slimmer men read too small: a size up)
const SH0 = 0.255                                 // a shoulder joint: this far out from his middle (times bw)
let SH = SH0, BW = 1, AW = 1
// The poses (pose.js) place the hands and the ball across him for a broader man than this one (the shoulder at 0.33):
// across, a hand and the ball are brought in to this body (inside the shoulder in proportion, past it at a little over
// half the distance), so an arm at his side hangs by his hip instead of sticking out like a wing, a defender's arms are
// still out wide, and the ball stays under the hand
const across = y => { const a = Math.abs(y); return Math.sign(y) * (a <= 0.33 ? a * SH / 0.33 : SH + (a - 0.33) * 0.62) }
const REACH = 0.32

// ── the drawing pieces. A man is drawn in two passes, all of his ink first and then all of his fills on top
// (PASS), so the parts melt into one shape with a single clean outline round the whole man and no lines inside him
let PASS = 0                                      // 0: the ink, 1: the fills
// a capsule tapering from r0 to r1 (screen px), one fill
function limb(ctx, x0, y0, r0, x1, y1, r1, col) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy)
  ctx.fillStyle = col; ctx.beginPath()
  if (l > Math.abs(r0 - r1) + 0.01) {
    const a = Math.atan2(dy, dx), b = Math.acos((r0 - r1) / l)
    ctx.arc(x0, y0, r0, a + b, a - b + TAU); ctx.arc(x1, y1, r1, a - b, a + b)
  } else ctx.arc(x0, y0, Math.max(r0, r1), 0, TAU)
  ctx.closePath(); ctx.fill()
}
// a limb in his frame (points in his units, radii in his units): its ink in the ink pass, then its tone; shaded on the
// side away from the light (the light is up and to the left of the screen: the same for every piece of every man)
function seg(ctx, x0, y0, r0, x1, y1, r1, col, colD, ink) {
  const sc = FR.sc, X0 = PX(x0, y0), Y0 = PY(x0, y0), X1 = PX(x1, y1), Y1 = PY(x1, y1)
  if (PASS === 0) { limb(ctx, X0, Y0, r0 * sc + ink, X1, Y1, r1 * sc + ink, INK); return }
  if (!colD) { limb(ctx, X0, Y0, r0 * sc, X1, Y1, r1 * sc, col); return }
  limb(ctx, X0, Y0, r0 * sc, X1, Y1, r1 * sc, colD)
  const d = Math.min(r0, r1) * sc * 0.3
  limb(ctx, X0 - d, Y0 - d, r0 * sc * 0.72, X1 - d, Y1 - d, r1 * sc * 0.72, col)
}
// an ellipse in his frame (centre lx, ly; rx along his facing, ry across; rot: turned off his facing)
function oval(ctx, lx, ly, rx, ry, col, ink, rot = 0) {
  const sc = FR.sc
  ctx.beginPath(); ctx.ellipse(PX(lx, ly), PY(lx, ly), rx * sc + (PASS === 0 ? ink : 0), ry * sc + (PASS === 0 ? ink : 0), FR.ang + rot, 0, TAU)
  ctx.fillStyle = PASS === 0 ? INK : col; ctx.fill()
}
// the same with its shade: the dark tone, then the light one a little smaller and toward the light
function ovalS(ctx, lx, ly, rx, ry, col, colD, ink, rot = 0) {
  if (PASS === 0) return oval(ctx, lx, ly, rx, ry, col, ink, rot)
  const sc = FR.sc, d = Math.min(rx, ry) * sc * 0.22
  ctx.beginPath(); ctx.ellipse(PX(lx, ly), PY(lx, ly), rx * sc, ry * sc, FR.ang + rot, 0, TAU); ctx.fillStyle = colD; ctx.fill()
  ctx.beginPath(); ctx.ellipse(PX(lx, ly) - d, PY(lx, ly) - d, rx * sc - d * 1.1, ry * sc - d * 1.1, FR.ang + rot, 0, TAU); ctx.fillStyle = col; ctx.fill()
}

// ── the arms. Where the pose puts the hand, seen from above: the shoulder joint (turned with his shoulders), then a
// straight slim arm to the hand (the owner, 11-26: "every time you add elbows and stuff it looks awful"; from straight
// overhead the elbow sits under the line from the shoulder to the hand). Kept within an arm's reach of the shoulder
export function armPts(side, hand) {
  const j = tw(0, side * SH), sx = j[0], sy = j[1]
  fore(hand[0], across(hand[1]), hand[2] || 0)
  let dx = FO[0] - sx, dy = FO[1] - sy
  // (no arm reads long from above: low, it reaches at most a third of a stride out; raised, it's mostly hidden in
  // its own foreshortening and shows no more than about 0.4 of his width out from the shoulder)
  // (hand[3]: the one arm that reaches all the way, up to the rim on a dunk)
  const h = Math.hypot(dx, dy) || 0.001, cap = hand[3] ? 1.4 : REACH - 0.1 * clamp(((hand[2] || 0) - 0.35) / 0.15, 0, 1)
  if (h > cap) { dx *= cap / h; dy *= cap / h }
  return [sx, sy, sx, sy, sx + dx, sy + dy]
}
// One arm, in one outline: the deltoid's round cap at the shoulder, the arm tapering from it to the wrist, a small
// neat hand. Every measure goes with his build (AW), so a big's arm is in proportion to his shoulders. An arm hanging
// at his side shows from above as no more than the deltoid and the top of the arm: one smooth teardrop, no stub
// (hi: an arm raised over his head and shoulders, drawn after him: its deltoid stays under the jersey)
const R_DELT = 0.047, R_ARM = 0.033, R_WRIST = 0.024, R_HAND = 0.027
function arm(ctx, side, hand, L, ink, hi = false, deltOnly = false) {
  const [sx, sy, , , hx, hy] = armPts(side, hand)
  const z = clamp(hand[2] || 0, 0, 1.2), len = Math.hypot(hx - sx, hy - sy)
  const rd = R_DELT * AW, ra = R_ARM * AW, rw = R_WRIST * AW * (1 + 0.08 * z), rh = R_HAND * AW * (1 + 0.1 * z)
  // (a short arm: the taper runs over what shows of it, so it never ends in a knob)
  const k = clamp((len - 0.04) / 0.14, 0, 1), rEnd = rw + (ra - rw) * (1 - k), rH = rEnd + (rh - rEnd) * k
  if (!hi) ovalS(ctx, sx - 0.004, sy, rd * 1.05, rd, L.skin, L.skinD, ink, TW)
  if (deltOnly) return
  // the arm itself: from just out of the deltoid (inside its cap) to the hand, one taper, the hand its rounded end
  const ux = (hx - sx) / (len || 1), uy = (hy - sy) / (len || 1), o = Math.min(len * 0.5, rd * 0.4)
  if (len > 0.01) seg(ctx, sx + ux * o, sy + uy * o, hi ? ra * 1.05 : ra, hx, hy, Math.max(rEnd, rH * 0.92), L.skin, L.skinD, ink)
}

// a raised hand, over his head and shoulders: small and round, its own outline
function hand(ctx, side, hnd, L, ink, all = false) {
  const [, , , , hx, hy] = armPts(side, hnd)
  // (only a hand over his jersey or head: one out past them already shows on the end of its arm)
  if (!all && !(hx < 0.11 && hx > -0.13 && Math.abs(hy) < 0.23 * BW)) return
  ovalS(ctx, hx, hy, R_HAND * AW * 0.98, R_HAND * AW * 0.9, L.skin, L.skinD, ink)
}

// ── the legs: a leg in a stride, from his hip under the shorts to his shoe. The shorts' leg down his thigh, then his
// bare shin to the ankle, the shoe toe the way it points. From overhead little of a leg shows: under the shorts and his
// chest it's hidden, and only a foot out in front or behind him (and the shin over it) peeks out. A foot off the floor
// (foot[2], 0-1) rises toward the camera: the shoe tips up (shorter from above) and the knee comes through over it
function leg(ctx, side, foot, toe, L, ink) {
  const lw = Math.sqrt(AW), hc = Math.cos(HIP), hs = Math.sin(HIP)
  const hx0 = -0.035, hy0 = side * 0.085 * BW
  const hx = hx0 * hc - hy0 * hs, hy = hx0 * hs + hy0 * hc
  const fx = foot[0], fy = foot[1], lift = clamp(foot[2] || 0, 0, 1)
  // the knee: halfway down, pushed forward with a raised foot (the knee drives through) and never behind his hip
  const kx = Math.max(hx + 0.01, (hx + fx) * 0.5 + 0.06 * lift), ky = (hy + fy) * 0.5
  const tx = Math.cos(toe), ty = Math.sin(toe)
  // the shoe: heel and toe, shorter as it tips up off the floor (behind him, the sole turned up to the sky)
  const behind = fx < hx - 0.04 ? 1 : 0.3, sl = 1 - 0.4 * lift * behind, big = 1 + 0.06 * lift
  const ax = fx - tx * 0.045 * sl, ay = fy - ty * 0.045 * sl
  seg(ctx, hx, hy, 0.062 * lw, kx, ky, 0.056 * lw, L.colD, null, ink)                        // the shorts' leg
  seg(ctx, kx, ky, 0.042 * lw, ax, ay, 0.032 * lw, L.skin, L.skinD, ink)                     // the shin
  const x0 = fx - tx * 0.06 * sl, y0 = fy - ty * 0.06 * sl, x1 = fx + tx * 0.085 * sl, y1 = fy + ty * 0.085 * sl
  const rh = 0.036 * lw * big, rt = 0.043 * lw * big
  seg(ctx, x0, y0, rh, x1, y1, rt, L.shoe, null, ink)
  if (PASS === 1) {
    // the heel counter and the collar a shade darker, the toe box catching the light
    const sc = FR.sc, mx = fx - tx * 0.005, my = fy - ty * 0.005
    limb(ctx, PX(x0, y0), PY(x0, y0), rh * sc * 0.62, PX(mx, my), PY(mx, my), rh * sc * 0.45, L.shoeD)
  }
}

// his shorts: what shows of them round his hips from above (behind him when he leans into a run), turned with his hips
function shorts(ctx, f, L, ink) {
  const hc = Math.cos(HIP), hs = Math.sin(HIP)
  ovalS(ctx, -0.04 * hc, -0.04 * hs, 0.092, 0.168 * BW, L.colD, tone(L.col, 0.55), ink, HIP)
}

// the jersey: a sleeveless top seen from above, turned with his shoulders. Square across the shoulder straps, the
// chest a little narrower in front, the upper back flat; his deltoids come out of the armholes (arm), the neckline
// scoops round his neck
// (squared off at the shoulders: a flat line across the top of each shoulder from the front of the strap to the
// back, so a big's broader frame reads as a shoulder line, not a wider oval)
const JPTS = [[0.1, 0], [0.099, 0.1], [0.09, 0.172], [0.06, 0.214], [0.01, 0.23], [-0.06, 0.228], [-0.106, 0.208], [-0.124, 0.15], [-0.128, 0.05], [-0.128, -0.05], [-0.124, -0.15], [-0.106, -0.208], [-0.06, -0.228], [0.01, -0.23], [0.06, -0.214], [0.09, -0.172], [0.099, -0.1]]
function torso(ctx, f, L, ink) {
  const ln = f.lean || 0
  const P = (lx, ly) => { const t = tw(lx, ly * BW); return [PX(t[0] + ln, t[1]), PY(t[0] + ln, t[1])] }
  const path = (g = 1, ox = 0, oy = 0) => {
    ctx.beginPath()
    const pts = JPTS, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const s0 = m(pts[pts.length - 1], pts[0]); let q = P(s0[0] * g, s0[1] * g); ctx.moveTo(q[0] + ox, q[1] + oy)
    for (let i = 0; i < pts.length; i++) { const c = P(pts[i][0] * g, pts[i][1] * g), e0 = m(pts[i], pts[(i + 1) % pts.length]), e = P(e0[0] * g, e0[1] * g); ctx.quadraticCurveTo(c[0] + ox, c[1] + oy, e[0] + ox, e[1] + oy) }
    ctx.closePath()
  }
  const sc = FR.sc
  if (PASS === 0) { path(); ctx.lineJoin = 'round'; ctx.lineWidth = ink * 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = INK; ctx.fill(); return }
  // the jersey: one colour, one soft shade down the side away from the light
  path(); ctx.fillStyle = L.colD; ctx.fill()
  ctx.save(); path(); ctx.clip()
  const d = sc * 0.026
  path(0.96, -d, -d); ctx.fillStyle = L.col; ctx.fill()
  // the neckline: the scoop of skin in front of his neck, its trim round it
  const nc = P(0.048, 0)
  ctx.beginPath(); ctx.ellipse(nc[0], nc[1], sc * 0.098, sc * 0.086, f.ang + TW, 0, TAU)
  ctx.fillStyle = L.skinD; ctx.fill()
  ctx.lineWidth = Math.max(0.8, sc * 0.016); ctx.strokeStyle = L.trim; ctx.stroke()
  ctx.restore()
  // the armholes' trim: along the jersey's edge over each deltoid, thin
  ctx.lineWidth = Math.max(0.7, sc * 0.013); ctx.strokeStyle = L.trim; ctx.lineCap = 'round'
  for (const sd of [-1, 1]) {
    const a0 = P(0.07, sd * 0.172), c = P(0.012, sd * 0.24), a1 = P(-0.074, sd * 0.2)
    ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.quadraticCurveTo(c[0], c[1], a1[0], a1[1]); ctx.stroke()
  }
}

// his head from above: a smaller oval than the shoulders (longer front to back than across), his ears, his hair over
// all of it but his forehead, one outline. It turns a little with his shoulders, not all the way (he looks where he goes)
function head(ctx, f, L, ink) {
  const ln = (f.lean || 0) * 1.5, RX = 0.098, RY = 0.083, sc = FR.sc, ht = TW * 0.35
  const hc = Math.cos(ht), hs = Math.sin(ht), cx = 0.03 + ln
  const at = (x, y) => [cx + x * hc - y * hs, x * hs + y * hc]
  if (PASS === 0) {
    for (const sd of [-1, 1]) { const e = at(0.004, sd * RY * 0.98); oval(ctx, e[0], e[1], 0.022, 0.015, L.skin, ink, ht) }
    oval(ctx, cx, 0, RX, RY, L.skin, ink, ht); return
  }
  for (const sd of [-1, 1]) { const e = at(0.004, sd * RY * 0.98); oval(ctx, e[0], e[1], 0.022, 0.015, L.skinD, 0, ht) }
  ovalS(ctx, cx, 0, RX, RY, L.skin, L.skinD, 0, ht)
  ctx.save(); ctx.beginPath(); ctx.ellipse(PX(cx, 0), PY(cx, 0), RX * sc, RY * sc, f.ang + ht, 0, TAU); ctx.clip()
  const st = L.style
  const capOf = (back, rx, ry, col, ox = 0, oy = 0) => { const c = at(-back * RX, 0); ctx.beginPath(); ctx.ellipse(PX(c[0], c[1]) + ox, PY(c[0], c[1]) + oy, rx * RX * sc, ry * RY * sc, f.ang + ht, 0, TAU); ctx.fillStyle = col; ctx.fill() }
  const back = st === 'twists' ? 0.24 : st === 'braids' ? 0.28 : st === 'fade' ? 0.22 : 0.32
  if (st === 'fade') capOf(0.3, 0.94, 1.06, tone(L.skin, 0.6))
  const rx = st === 'fade' ? 0.76 : 0.93, ry = st === 'fade' ? 0.78 : 1.06
  capOf(back, rx, ry, L.hair)
  // a soft sheen on the crown, toward the light
  const d = sc * 0.03
  ctx.globalAlpha = 0.5; capOf(back + 0.1, rx * 0.6, ry * 0.55, tone(L.hair, 1.22), -d, -d); ctx.globalAlpha = 1
  // cornrows: a few lines front to back
  if (st === 'braids') {
    ctx.strokeStyle = tone(L.hair, 1.35); ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(0.6, sc * 0.008)
    for (const o of [-0.5, 0, 0.5]) { const a = at(0.55 * RX, o * RY * 0.8), b = at(-0.95 * RX, o * RY * 0.95); ctx.beginPath(); ctx.moveTo(PX(a[0], a[1]), PY(a[0], a[1])); ctx.lineTo(PX(b[0], b[1]), PY(b[0], b[1])); ctx.stroke() }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

// his shadow on the floor (drawn for everyone before any man, so no shadow lies on a man): the light is up and to the
// left of the screen, so it falls a little down and to the right. Soft round the body, with a tighter, darker contact
// shadow under his feet while they're on the floor; smaller, lighter and farther off the higher he goes
export function drawShadow(ctx, f) {
  const air = Math.min(1.2, f.air || 0), s = f.s * (BODY / 1.08) * (f.look?.sz ?? 1), bw = f.look?.bw ?? 1
  const a = 0.13 - 0.05 * Math.min(1, air)
  const cx = f.x + s * (0.04 + 0.07 * air), cy = f.y + s * (0.06 + 0.1 * air)
  const rx = s * (0.3 - 0.06 * air) * (f.down ? 1.3 : 1), ry = s * (0.36 - 0.07 * air) * bw
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(f.ang); ctx.scale(rx, ry)
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.2)
  gr.addColorStop(0, `rgba(0,0,0,${(a * 3).toFixed(3)})`); gr.addColorStop(0.55, `rgba(0,0,0,${(a * 2.2).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, TAU); ctx.fill(); ctx.restore()
  const c = 1 - Math.min(1, air * 2.5)
  if (c > 0.02 && !f.down) {
    // (the contact shadow: right under him, where his feet meet the floor)
    ctx.save(); ctx.translate(f.x + s * 0.015, f.y + s * 0.02); ctx.rotate(f.ang); ctx.scale(s * 0.2, s * 0.24 * bw)
    const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    g2.addColorStop(0, `rgba(0,0,0,${(0.3 * c).toFixed(3)})`); g2.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore()
  }
}

export function drawFigure(ctx, f) {
  frame(f)
  const L = f.look, ink = Math.max(1, FR.sc * 0.026)
  const lz = f.lh[2] || 0, rz = f.rh[2] || 0
  // the man in one piece (ink, then fills). A raised arm is in it too, under his jersey and head: from straight
  // above a raised arm is foreshortened to almost nothing, so only what reaches out past his shoulders and head shows,
  // and the hand itself, up over everything (on the ball at his forehead on a jumper, at the rim on a dunk)
  for (PASS = 0; PASS < 2; PASS++) {
    leg(ctx, -1, f.lf, f.toeL || 0, L, ink); leg(ctx, 1, f.rf, f.toeR || 0, L, ink)
    shorts(ctx, f, L, ink)
    arm(ctx, -1, f.lh, L, ink); arm(ctx, 1, f.rh, L, ink)
    torso(ctx, f, L, ink)
    head(ctx, f, L, ink)
  }
  if (lz >= 0.6 || rz >= 0.6) for (PASS = 0; PASS < 2; PASS++) {
    if (lz >= 0.6) hand(ctx, -1, f.lh, L, ink)
    if (rz >= 0.6) hand(ctx, 1, f.rh, L, ink)
  }
}
// A man up at the rim is drawn under the hoop (the rim and net are over him, up at 10 ft); his raised hands go over it,
// drawn again after the hoop (engine.js): the dunking hand with the ball over the rim, hands hanging on it, a block
export function drawHands(ctx, f) {
  frame(f)
  const L = f.look, ink = Math.max(1, FR.sc * 0.026)
  for (PASS = 0; PASS < 2; PASS++) for (const [sd, h] of [[-1, f.lh], [1, f.rh]]) if ((h[2] || 0) >= 0.8 || h[3]) hand(ctx, sd, h, L, ink, true)
}
export { clamp }
