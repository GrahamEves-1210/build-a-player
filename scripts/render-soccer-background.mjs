// Renders public/soccerbackground.webp (1672 x 941, the size of bucketbackground.webp): a night stadium seen
// from behind one penalty area toward the far goal. Mown stripes, white lines, floodlights along the roof,
// a dark crowd. No branding of any kind. Pure code: a per-pixel ray caster for the bowl, an SVG layer for
// the goal and the lamps, and a blurred copy of the lamps for their bloom.
// Usage: node scripts/render-soccer-background.mjs [out.webp]
import sharp from 'sharp'

const OUT = process.argv[2] || 'public/soccerbackground.webp'
const OW = 1672, OH = 941, SS = 2                   // the output size; rendered at 2x and scaled down
const W = OW * SS, H = OH * SS
const cx = W / 2, y0 = 295 * SS, f = 1240 * SS, camH = 10.5   // horizon at y0 (high, so the lamps sit near the top like the arena lights), the camera 10.5 m up, level
const GOAL_Z = 60, HALF_W = 34                      // the far goal line, the touchlines
const BOARD_Z = GOAL_Z + 5, STAND_Z = GOAL_Z + 8    // the boards behind the goal, where the stand starts
const SIDE_X = HALF_W + 7                           // where the side stands start
const SLOPE = 0.56, ROOF_H = 27, ROOF_FRONT = 26    // the rake of the stands, the roof's height and its overhang

// ── small helpers ──
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t) }
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295 }
function vnoise(x, y) {           // value noise, 0..1
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, y) => vnoise(x, y) * .5 + vnoise(x * 2.1, y * 2.1) * .3 + vnoise(x * 4.3, y * 4.3) * .2

// ── the floodlights: one row along the far roof's front edge, one along each side roof ──
const LAMPS = []
for (let i = 0; i < 9; i++) LAMPS.push([-44 + i * 11, GOAL_Z + 34, ROOF_H - 1])        // far
for (let i = 0; i < 6; i++) { LAMPS.push([-(SIDE_X + 20), 8 + i * 10, ROOF_H - 1]); LAMPS.push([SIDE_X + 20, 8 + i * 10, ROOF_H - 1]) }
function light(X, Z, h = 0) {     // the light falling on a point (cosine-weighted, inverse square), ~0..1.3
  let e = 0
  for (const [lx, lz, lh] of LAMPS) { const dh = lh - h, d2 = (X - lx) ** 2 + (Z - lz) ** 2 + dh * dh; e += dh / (d2 * Math.sqrt(d2)) }
  return e * 520
}

// ── the markings, in metres on the grass ──
const SEG = []
const seg = (x1, z1, x2, z2) => SEG.push([x1, z1, x2, z2])
seg(-HALF_W, GOAL_Z, HALF_W, GOAL_Z)                                   // goal line
seg(-HALF_W, -40, -HALF_W, GOAL_Z); seg(HALF_W, -40, HALF_W, GOAL_Z)   // touchlines
const PA_W = 20.16, PA_D = 16.5, SY_W = 9.16, SY_D = 5.5
seg(-PA_W, GOAL_Z - PA_D, PA_W, GOAL_Z - PA_D); seg(-PA_W, GOAL_Z - PA_D, -PA_W, GOAL_Z); seg(PA_W, GOAL_Z - PA_D, PA_W, GOAL_Z)
seg(-SY_W, GOAL_Z - SY_D, SY_W, GOAL_Z - SY_D); seg(-SY_W, GOAL_Z - SY_D, -SY_W, GOAL_Z); seg(SY_W, GOAL_Z - SY_D, SY_W, GOAL_Z)
const HALFWAY = GOAL_Z - 52.5
seg(-HALF_W, HALFWAY, HALF_W, HALFWAY)
const SPOT = GOAL_Z - 11
function segDist(px, pz, [x1, z1, x2, z2]) {
  const dx = x2 - x1, dz = z2 - z1, t = clamp(((px - x1) * dx + (pz - z1) * dz) / (dx * dx + dz * dz))
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t))
}
function lineDist(X, Z) {
  let d = 1e9
  for (const s of SEG) d = Math.min(d, segDist(X, Z, s))
  // the D (the 9.15 m arc round the spot, outside the box)
  const r = Math.hypot(X, Z - SPOT); if (Z < GOAL_Z - PA_D) d = Math.min(d, Math.abs(r - 9.15))
  // the centre circle
  d = Math.min(d, Math.abs(Math.hypot(X, Z - HALFWAY) - 9.15))
  // corner arcs
  for (const sx of [-1, 1]) { const rc = Math.hypot(X - sx * HALF_W, Z - GOAL_Z); if (Math.sign(X) === sx && Math.abs(X) < HALF_W && Z < GOAL_Z) d = Math.min(d, Math.abs(rc - 1)) }
  // the spots
  d = Math.min(d, Math.max(0, Math.hypot(X, Z - SPOT) - 0.11), Math.max(0, Math.hypot(X, Z - HALFWAY) - 0.11))
  return d
}

// ── the surfaces a ray can hit ──
const rgb = new Float32Array(W * H * 3)
function grass(X, Z, px, py) {
  const onPitch = Math.abs(X) < HALF_W + 3 && Z < GOAL_Z + 3
  const e = light(X, Z)
  // mown stripes across the pitch, every 5.5 m from the goal line: the contrast grows toward the far end
  // (a grazing look shows the lay of the grass more)
  const k = Math.floor((GOAL_Z - Z) / 5.5)
  const stripe = onPitch ? (k % 2 ? 0.76 : 1.0) : 0.86
  const sheen = 1 + (stripe - 1) * (0.8 + 0.2 * smooth(10, 55, Z))
  const wear = 1 - 0.12 * smooth(0.55, 0.85, fbm(X * .35, Z * .35)) - 0.08 * (Math.abs(X) < 6 && Z > GOAL_Z - 7 ? 1 : 0)
  const grain = 0.9 + 0.2 * hash(px, py)
  const L = clamp(e * 1.12, 0, 1.3) * sheen * wear * grain
  let r = 0.092 * L, g = 0.182 * L, b = 0.106 * L
  // the lines: anti-aliased by the pixel's footprint on the grass
  if (onPitch) {
    const fp = Math.max(Z / f, Z * Z / (f * camH)) * 0.7
    const cov = clamp((0.06 - lineDist(X, Z)) / fp + 0.5) * clamp(0.06 / fp + .25)
    if (cov > 0) { const wl = 0.56 * clamp(e, .35, 1.05); r += (wl - r) * cov; g += (wl - g) * cov; b += (wl * .97 - b) * cov }
  }
  return [r, g, b]
}
// a raked stand: rows of seats, people in them, lit from the lamps, darker up high
function stand(u, h, X, Z, px, py, far) {
  if (h < 0.15) return [0.012, 0.013, 0.014]
  // the tier front (a fascia) at about 9 m up, the walkway at the bottom
  if (h > 8.4 && h < 9.6) { const e = clamp(light(X, Z, h)); const v = h > 9.45 ? 0.05 + e * .05 : 0.014 + e * .012; return [v, v, v * 1.06] }
  const row = h / (SLOPE * 0.8)                      // a row every 0.8 m of rake
  const ri = Math.floor(row), rf = row - ri
  const seatW = 0.5, us = u / seatW + (ri % 2) * 0.5, si = Math.floor(us), uf = us - si
  const occ = hash(si, ri) < 0.82                    // most seats taken
  let c = 0.016
  if (rf > 0.82) c = 0.006                           // the step's shadow
  else if (occ) {
    const jx = (hash(si + 3, ri) - .5) * .25, jy = (hash(si, ri + 9) - .5) * .12
    const head = ((uf - .5 - jx) / .2) ** 2 + ((rf - .2 - jy) / .16) ** 2 < 1
    const body = Math.abs(uf - .5 - jx * .6) < .4 && rf > .34 + jy && rf < .82
    const tone = hash(si * 7 + 1, ri * 3 + 2)
    if (head) c = 0.05 + tone * 0.07
    else if (body) {
      c = 0.025 + hash(si + 11, ri + 5) * 0.09
      if (hash(si + 17, ri + 2) > 0.92) c = 0.17     // a few in white shirts, no team colours
    }
  }
  const e = clamp(light(X, Z, h) * 1.1, 0, 1) * (1 - 0.55 * smooth(4, 22, h))
  const v = c * 0.8 * (0.2 + e * 1.7) * (0.8 + 0.4 * hash(px, py))
  const warm = far ? 1 : 0.98
  return [v * warm, v * warm, v * 1.03]
}

for (let py = 0; py < H; py++) {
  for (let px = 0; px < W; px++) {
    const dx = (px + .5 - cx) / f, dy = (y0 - (py + .5)) / f    // ray (dx, dy, 1), y up
    let best = Infinity, col = null
    // the grass, out to the boards
    if (dy < 0) {
      const t = camH / -dy, X = dx * t, Z = t
      if (Z < BOARD_Z && Math.abs(X) < SIDE_X) { best = t; col = grass(X, Z, px, py) }
      else if (Z < STAND_Z && Math.abs(X) < SIDE_X + 2) { best = t; col = [0.012, 0.014, 0.013] }   // the track behind the boards
    }
    // the advertising boards behind the goal line: blank, dark, a thin lit edge
    {
      const t = BOARD_Z, X = dx * t, h = camH + dy * t
      if (h >= 0 && h <= 0.9 && Math.abs(X) < HALF_W + 4 && t < best) {
        best = t; const e = light(X, BOARD_Z, .5)
        const v = h > 0.84 ? 0.09 * e : 0.012 + 0.012 * e
        col = [v, v, v * 1.05]
      }
    }
    // the far stand: h = SLOPE (Z - STAND_Z)
    {
      const den = SLOPE - dy
      if (den > 0) { const t = (camH + SLOPE * STAND_Z) / den, h = camH + dy * t, X = dx * t
        if (t > STAND_Z && h < ROOF_H - 1 && Math.abs(X) < SIDE_X + (t - STAND_Z) + 6 && t < best) { best = t; col = stand(X, h, X, t, px, py, true) } }
    }
    // the side stands: h = SLOPE (|X| - SIDE_X)
    {
      const ax = Math.abs(dx), den = ax - dy / SLOPE
      if (den > 0) { const t = (SIDE_X + camH / SLOPE) / den, h = camH + dy * t, X = dx * t
        if (h > 0 && h < ROOF_H - 1 && t > 0 && t < best) { best = t; col = stand(t, h, X, t, px, py, false) } }
    }
    // the roof's underside, and its front edge where the lamps hang
    if (dy > 0) {
      const t = (ROOF_H - camH) / dy, X = dx * t
      const front = Math.min(t - (STAND_Z + ROOF_FRONT), Math.abs(X) - (SIDE_X + 14))
      if (front > -1.2 && t < best) {
        best = t
        const edge = front < 0 ? 1 : 0
        const truss = (X / 9 - Math.floor(X / 9)) < 0.05 || (t / 7 - Math.floor(t / 7)) < 0.04
        const bounce = 0.016 + 0.024 * Math.exp(-(((t - (STAND_Z + ROOF_FRONT)) / 22) ** 2))
        const v = edge ? 0.05 : truss ? bounce * 2.2 : bounce
        col = [v, v, v * 1.08]
      }
    }
    if (!col) {   // the night sky over the roof
      const s = 0.008 + 0.010 * (1 - py / y0)
      col = [s * .9, s * .95, s * 1.15]
    }
    const i = (py * W + px) * 3
    rgb[i] = col[0]; rgb[i + 1] = col[1]; rgb[i + 2] = col[2]
  }
}

// the haze the lamps throw into the air above the pitch, and the vignette
for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
  const i = (py * W + px) * 3
  const ny = py / H, nx = (px - cx) / W
  const haze = 0.03 * Math.exp(-(((py - (y0 - 60 * SS)) / (170 * SS)) ** 2)) * (0.75 + 0.25 * Math.cos(nx * 3))
  const vig = 1 - 0.62 * smooth(0.28, 0.78, Math.hypot(nx * 1.05, (ny - 0.5) * 1.15))
  const bottom = 1 - 0.55 * smooth(0.72, 1, ny)
  for (let c = 0; c < 3; c++) rgb[i + c] = (rgb[i + c] + haze * (c === 2 ? 1.05 : 1)) * vig * bottom
}

// to 8-bit with a gentle filmic curve and a touch of grain (so the darks don't band)
const out = Buffer.alloc(W * H * 3)
for (let i = 0; i < W * H * 3; i++) {
  const v = rgb[i]
  const g = clamp(v / (1 + v * .4)) * 255 + (hash(i, 7) - .5) * 2.4
  out[i] = clamp(Math.round(g), 0, 255)
}

// ── the goal, the lamps: an SVG layer over the raster ──
const P = (X, Z, h = 0) => [cx + f * X / Z, y0 - f * (h - camH) / Z]
const pt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`
const GW = 3.66, GH = 2.44, ND = 2.0
const net = []
{
  const fr = Array.from({ length: 2 }, (_, k) => k ? GOAL_Z + ND : GOAL_Z)
  const [bl, br, tl, tr] = [P(-GW, GOAL_Z), P(GW, GOAL_Z), P(-GW, GOAL_Z, GH), P(GW, GOAL_Z, GH)]
  const [nbl, nbr, ntl, ntr] = [P(-GW, fr[1]), P(GW, fr[1]), P(-GW, fr[1], GH * .75), P(GW, fr[1], GH * .75)]
  net.push(`<polygon points="${[tl, tr, ntr, ntl].map(pt).join(' ')}" fill="rgba(230,234,238,.06)"/>`)
  net.push(`<polygon points="${[ntl, ntr, nbr, nbl].map(pt).join(' ')}" fill="rgba(230,234,238,.07)"/>`)
  for (let k = 0; k <= 30; k++) { const a = k / 30, x1 = ntl[0] + (ntr[0] - ntl[0]) * a, x2 = tl[0] + (tr[0] - tl[0]) * a
    net.push(`<line x1="${x1.toFixed(1)}" y1="${ntl[1].toFixed(1)}" x2="${x1.toFixed(1)}" y2="${nbl[1].toFixed(1)}" stroke="rgba(235,238,240,.09)" stroke-width="${.6 * SS}"/>`)
    net.push(`<line x1="${x2.toFixed(1)}" y1="${tl[1].toFixed(1)}" x2="${x1.toFixed(1)}" y2="${ntl[1].toFixed(1)}" stroke="rgba(235,238,240,.09)" stroke-width="${.6 * SS}"/>`) }
  for (let k = 0; k <= 8; k++) { const y = ntl[1] + (nbl[1] - ntl[1]) * k / 8
    net.push(`<line x1="${ntl[0].toFixed(1)}" y1="${y.toFixed(1)}" x2="${ntr[0].toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(235,238,240,.08)" stroke-width="${.6 * SS}"/>`) }
  for (const s of [[tl, ntl, nbl], [tr, ntr, nbr]]) net.push(`<polyline points="${s.map(pt).join(' ')}" fill="none" stroke="rgba(235,238,240,.12)" stroke-width="${.8 * SS}"/>`)
  const post = `stroke="#c9cacc" stroke-width="${(0.12 * f / GOAL_Z).toFixed(2)}" stroke-linecap="square"`
  net.push(`<polyline points="${[bl, tl, tr, br].map(pt).join(' ')}" fill="none" ${post}/>`)
  // its shadow under the lamps
  net.push(`<polygon points="${[bl, br, P(GW + .4, GOAL_Z - 1.6), P(-GW - .4, GOAL_Z - 1.6)].map(pt).join(' ')}" fill="rgba(0,0,0,.18)"/>`)
}
// the lamp heads: a bank of small squares on the roof edge, facing the pitch
const lamps = [], glow = []
for (const [lx, lz, lh] of LAMPS) {
  const [x, y] = P(lx, lz, lh)
  if (x < -40 || x > W + 40) continue
  const s = f / lz * 0.55                                 // a lamp about 0.55 m across
  // one bank: a short, thin lit strip under the roof's edge (blocks of lamps read as UI shapes when the
  // picture is small: a strip reads as the stadium's light)
  const bw = s * 9.5, bh = s * 0.9
  lamps.push(`<rect x="${(x - bw / 2).toFixed(1)}" y="${(y - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bh / 2).toFixed(1)}" fill="#e2e5ec"/>`)
  glow.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(s * 9).toFixed(1)}" ry="${(s * 3).toFixed(1)}" fill="#dfe7ff" opacity=".5"/>`)
}
// the beams: each bank throws a soft cone down onto the pitch, faint in the night air
const beams = []
for (const [lx, lz, lh] of LAMPS) {
  const [x, y] = P(lx, lz, lh); if (x < -40 * SS || x > W + 40 * SS) continue
  const tz = lz - 30, [ax, ay] = P(lx * .55 - 7, tz), [bx] = P(lx * .55 + 7, tz)
  beams.push(`<polygon points="${pt([x - 6 * SS, y])} ${pt([x + 6 * SS, y])} ${pt([bx, ay])} ${pt([ax, ay])}" fill="#e8eeff" opacity=".16"/>`)
}
const svg = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`)
const bloom = await sharp(svg(glow.join('') + lamps.join(''))).blur(16 * SS).modulate({ brightness: .62 }).png().toBuffer()
const beamLayer = await sharp(svg(beams.join(''))).blur(18 * SS).png().toBuffer()
const bloomWide = await sharp(svg(glow.join(''))).blur(60 * SS).modulate({ brightness: .45 }).png().toBuffer()

const big = await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .composite([
    { input: svg(net.join('')) },
    { input: beamLayer, blend: 'screen' },
    { input: bloomWide, blend: 'screen' },
    { input: bloom, blend: 'screen' },
    { input: svg(lamps.join('')) },
  ])
  .png().toBuffer()
await sharp(big).resize(OW, OH, { kernel: 'lanczos3' }).webp({ quality: 78, effort: 6 }).toFile(OUT)
console.log('wrote', OUT)
