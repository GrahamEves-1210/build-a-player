// Renders public/baseballbackground.webp (1672 x 941, the size of the basketball and soccer pictures): a ballpark at
// night, seen from high behind home plate toward center field. The infield skin and the mound, the bases, the
// crosshatched outfield grass, the foul lines, the warning track, a padded wall with its distances, the batter's eye,
// a lit crowd in the bleachers and the light towers above them. No branding of any kind: no club, no league, no
// sponsor. Pure code, like render-soccer-background.mjs: a per-pixel ray caster for the ground, the wall and the
// stands, an SVG layer for the light towers, and blurred copies of the lamps for their bloom.
// Usage: node scripts/render-baseball-background.mjs [out.webp]
import sharp from 'sharp'

const OUT = process.argv[2] || 'public/baseballbackground.webp'
const OW = 1672, OH = 941, SS = 2                    // the output size; rendered at 2x and scaled down
const W = OW * SS, H = OH * SS
const cx = W / 2, y0 = 300 * SS, f = 1150 * SS       // the horizon at y0, the focal length
const camH = 15, CAMB = 24                           // the camera: 15 m up, 24 m behind home plate, level
const R2 = Math.SQRT2

// ── the field, in metres: home plate at the origin, Z out to center field, X toward first base ──
const BASE = 27.43                                    // 90 ft
const RUBBER = 18.44                                  // 60 ft 6 in
const SKIN_R = 28.96                                  // the infield arc, 95 ft from the rubber
const POLE = 100.6, CENTER = 121.9, ALLEY = 114.3     // 330 down the lines, 375 in the alleys, 400 to center
const WALL_H = 2.8, TRACK = 4.6                       // the wall, the warning track in front of it
const D_FOUL = 17                                     // foul ground out to the side stands
const EYE = 7.5 * Math.PI / 180, EYE_H = 12           // the batter's eye: a dark block behind center field
const SLOPE = 0.62, BL_TOP = 21                       // the bleachers' rake and their top row
const P45 = Math.PI / 4
const wallP = Math.log((CENTER - ALLEY) / (CENTER - POLE)) / Math.log(0.5)   // the wall's curve through 330 / 375 / 400
const wallR = ath => CENTER - (CENTER - POLE) * Math.pow(Math.min(1, ath / P45), wallP)

// ── small helpers ──
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t) }
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295 }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, y) => vnoise(x, y) * .5 + vnoise(x * 2.1, y * 2.1) * .3 + vnoise(x * 4.3, y * 4.3) * .2

// ── the light towers: four over the outfield stands (two each side of the batter's eye), and the ones over the
// grandstands down the lines and behind home, which light the field from out of the frame ──
const TOWERS = []
const polar = (deg, r, h) => { const t = deg * Math.PI / 180; return [r * Math.sin(t), r * Math.cos(t), h] }
for (const s of [-1, 1]) {
  TOWERS.push({ p: polar(s * 15, wallR(15 * Math.PI / 180) + 31, 44), seen: true })
  TOWERS.push({ p: polar(s * 34, wallR(34 * Math.PI / 180) + 27, 42), seen: true })
  TOWERS.push({ p: [s * 62, 34, 44], seen: false })
  TOWERS.push({ p: [s * 52, -8, 44], seen: false })
  TOWERS.push({ p: [s * 22, -34, 40], seen: false })
}
const AIM = [0, 0, 55]                                 // every bank points at the middle of the field
function rawLight(X, Z, h) {
  let e = 0
  for (const { p: [lx, lz, lh] } of TOWERS) {
    const dh = lh - h, d2 = (X - lx) ** 2 + (Z - lz) ** 2 + dh * dh
    // a bank throws its light forward: a point behind it (the stands it stands on) gets only the spill
    const fx = AIM[0] - lx, fz = AIM[2] - lz, fl = Math.hypot(fx, fz) || 1
    const px = X - lx, pz = Z - lz, pl = Math.hypot(px, pz) || 1
    const aim = 0.28 + 0.72 * clamp((px * fx + pz * fz) / (pl * fl))
    e += aim * Math.max(dh, 2) / (d2 * Math.sqrt(d2))
  }
  return e
}
const REF = rawLight(0, BASE * R2 * .5, 0)
// a lit ballpark is even: the pools are there, but soft
const light = (X, Z, h = 0) => clamp(Math.pow(rawLight(X, Z, h) / REF, 0.42), 0.35, 1.3)

// ── where a point is: (a, b) run along the first- and third-base lines from home ──
const ab = (X, Z) => [(X + Z) / R2, (Z - X) / R2]
function inField(X, Z) {      // inside the wall and the side fences
  const [a, b] = ab(X, Z)
  if (a < -D_FOUL || b < -D_FOUL) return false
  if (b < 0) return a < POLE                    // foul ground, first-base side
  if (a < 0) return b < POLE                    // third-base side
  if (Z < 0) return true
  return Math.hypot(X, Z) < wallR(Math.abs(Math.atan2(X, Z)))
}

// the stands beyond the wall: how high they stand at a point (0 = open air)
function standsAt(X, Z) {
  const [a, b] = ab(X, Z)
  if (a > 0 && b > 0) {
    const rho = Math.hypot(X, Z), ath = Math.abs(Math.atan2(X, Z))
    const R = wallR(ath)
    if (ath < EYE) return rho > R + 2.5 ? EYE_H : 0
    const d = rho - R - 1.2
    if (d < 0) return 0
    const hh = WALL_H + 0.4 + SLOPE * d
    return hh < BL_TOP ? hh : (hh < BL_TOP + 2 ? BL_TOP + 1.3 : 0)
  }
  // the corners: the grandstands along the lines, past the foul poles
  const s = b < 0 ? -b : -a, u = b < 0 ? a : b
  const d = Math.max(s - D_FOUL, u - POLE - 1.2)
  if (d < 0) return 0
  const hh = WALL_H + 0.4 + SLOPE * d
  return hh < BL_TOP + 3 ? hh : 0
}

// ── the surfaces ──
const GRASS = [0.084, 0.170, 0.094], CLAY = [0.262, 0.142, 0.092], TRACKC = [0.150, 0.086, 0.064]
function ground(X, Z, t, px, py) {
  const e = light(X, Z)
  const [a, b] = ab(X, Z)
  const rho = Math.hypot(X, Z), ath = Math.abs(Math.atan2(X, Z))
  const fair = a >= 0 && b >= 0
  const fp = Math.max(t / f, t * t / (f * camH)) * 0.7          // a pixel's footprint on the ground
  const cover = (d, w) => clamp((w - d) / fp + 0.5) * clamp(w / fp + .3)
  // which surface
  const dRub = Math.hypot(X, Z - RUBBER)
  const nearHome = rho < 3.96
  // the skin runs a few feet past the foul lines: a foul-ground point is measured from its spot on the line
  const [qx, qz] = b < 0 ? [a / R2, a / R2] : a < 0 ? [-b / R2, b / R2] : [X, Z]
  const inSkin = Math.hypot(qx, qz - RUBBER) < SKIN_R && a > -1.8 && b > -1.8
  const grassIn = a > 0.95 && b > 0.95 && a < BASE - 1.5 && b < BASE - 1.5 && !nearHome &&
    Math.hypot(a - BASE, b) > 4.6 && Math.hypot(a, b - BASE) > 4.6
  const mound = Math.hypot(X, Z - (RUBBER - 0.3)) < 2.74
  const R = fair ? wallR(ath) : Infinity
  let warn = fair ? rho > R - TRACK : false
  if (!fair) { const s = b < 0 ? -b : -a, u = b < 0 ? a : b; warn = s > D_FOUL - TRACK * .7 || u > POLE - TRACK }
  let base, kind
  if (mound) { base = CLAY; kind = 'mound' }
  else if (warn) { base = TRACKC; kind = 'track' }
  else if ((inSkin || nearHome) && !grassIn) { base = CLAY; kind = 'clay' }
  else { base = GRASS; kind = 'grass' }
  // texture: the grass crosshatched by the mowers (squares along the lines), the clay raked and worn
  let k = 1
  if (kind === 'grass') {
    const s = fair && rho > 34 ? 4.6 : 3.2
    const chk = (Math.floor(a / s) + Math.floor(b / s)) & 1
    const far = smooth(20, 110, rho)
    k = (chk ? 0.80 : 1.0) * (0.96 + 0.06 * far)
    k *= 1 - 0.10 * smooth(0.6, 0.9, fbm(X * .3, Z * .3))
    // the grass right at the skin's edge is a shade darker (the lip)
    if (inSkin && grassIn) k *= 0.9
  } else {
    k = 0.86 + 0.22 * fbm(X * 1.7, Z * 1.7)
    if (kind === 'clay') {
      // worn spots where the fielders stand and the runners turn, a touch darker (watered)
      for (const [qa, qb] of [[BASE, 0], [0, BASE], [BASE, BASE]]) k *= 1 - 0.14 * Math.exp(-((a - qa) ** 2 + (b - qb) ** 2) / 6)
      k *= 1 - 0.1 * Math.exp(-(X * X + (Z - 31) ** 2) / 30) - 0.08 * Math.exp(-((X - 12) ** 2 + (Z - 27) ** 2) / 26) - 0.08 * Math.exp(-((X + 12) ** 2 + (Z - 27) ** 2) / 26)
    }
    if (kind === 'mound') { const m = Math.hypot(X, Z - (RUBBER - 0.3)) / 2.74; k *= 1.08 - 0.16 * m * m + (Z > RUBBER + 0.4 ? -0.1 * smooth(0.3, 1, m) : 0) }
    if (kind === 'track') k *= 0.95 + 0.1 * hash(Math.floor(X * 3), Math.floor(Z * 3))
  }
  const grain = 0.92 + 0.16 * hash(px, py)
  const L = e * k * grain
  let r = base[0] * L, g = base[1] * L, bl = base[2] * L
  // the chalk: the foul lines out to the wall, the bases, the rubber
  let ink = 0
  if (a > -0.2 && a < POLE) ink = Math.max(ink, cover(Math.abs(b), 0.05))
  if (b > -0.2 && b < POLE) ink = Math.max(ink, cover(Math.abs(a), 0.05))
  const sq = (ca, cb, hw) => cover(Math.max(Math.abs(a - ca), Math.abs(b - cb)), hw)
  ink = Math.max(ink, sq(BASE - 0.19, 0.19, 0.19), sq(0.19, BASE - 0.19, 0.19), sq(BASE, BASE, 0.19))
  if (Math.abs(X) < 0.305 && Z > RUBBER && Z < RUBBER + 0.15) ink = 1
  if (ink > 0) { const wl = 0.6 * clamp(e, .45, 1.1); r += (wl - r) * ink; g += (wl - g) * ink; bl += (wl * .96 - bl) * ink }
  return [r, g, bl]
}

// the wall: dark navy padding in panels, a lighter cap, the distances in cream
const GLYPH = {
  0: ['1111', '1001', '1001', '1001', '1001', '1001', '1111'],
  3: ['1111', '0001', '0001', '0111', '0001', '0001', '1111'],
  4: ['1001', '1001', '1001', '1111', '0001', '0001', '0001'],
  5: ['1111', '1000', '1000', '1111', '0001', '0001', '1111'],
  7: ['1111', '0001', '0001', '0010', '0100', '0100', '0100'],
}
const MARKS = [[0, '400'], [-22.5, '375'], [22.5, '375']]   // (330 sits on the lines, at the picture's edges: left off)
function markAt(s, h) {      // s: metres along the wall from center
  const CH = 0.17, GW = 4 * CH, GAP = 0.2
  for (const [deg, txt] of MARKS) {
    const th = deg * Math.PI / 180, s0 = wallR(Math.abs(th)) * th
    const wTot = txt.length * GW + (txt.length - 1) * GAP
    const lx = s - (s0 - wTot / 2), ly = (WALL_H - 0.55) - h
    if (lx < 0 || lx > wTot || ly < 0 || ly > 7 * CH) continue
    const gi = Math.floor(lx / (GW + GAP)), gx = lx - gi * (GW + GAP)
    if (gx > GW) return false
    const row = GLYPH[txt[gi]][Math.floor(ly / CH)]
    return row[Math.floor(gx / CH)] === '1'
  }
  return false
}
function wall(X, Z, h, px, py) {
  const e = light(X, Z, h) * 0.9
  const th = Math.atan2(X, Z), s = wallR(Math.abs(th)) * th
  let c
  if (h > WALL_H - 0.16) c = [0.11, 0.115, 0.12]                          // the padded cap
  else {
    const seam = (s / 2.4 - Math.floor(s / 2.4)) < 0.03 ? 0.7 : 1
    const k = (0.92 + 0.12 * hash(px, py)) * seam * (0.85 + 0.15 * smooth(0, WALL_H, h))
    c = [0.026 * k, 0.040 * k, 0.074 * k]
    if (markAt(s, h)) c = [0.42, 0.40, 0.355]
  }
  return [c[0] * e, c[1] * e, c[2] * e]
}

// the crowd: rows of seats, people in them, lit by the towers' spill; mostly dark clothes, some white and cream,
// a few reds and blues (a real crowd, no one team)
const SHIRTS = [[.16, .155, .14], [.13, .035, .035], [.03, .045, .09], [.09, .09, .095], [.15, .12, .07]]
function crowd(u, h, X, Z, px, py) {
  const row = (h - WALL_H) / (SLOPE * 0.82)
  const ri = Math.floor(row), rf = row - ri
  const us = u / 0.52 + (ri % 2) * 0.5, si = Math.floor(us), uf = us - si
  const occ = hash(si, ri) < 0.86
  let c = [0.014, 0.014, 0.016]
  if (rf > 0.84) c = [0.005, 0.005, 0.006]                                   // the step's shadow
  else if (occ) {
    const jx = (hash(si + 3, ri) - .5) * .25, jy = (hash(si, ri + 9) - .5) * .12
    const head = ((uf - .5 - jx) / .2) ** 2 + ((rf - .2 - jy) / .16) ** 2 < 1
    const body = Math.abs(uf - .5 - jx * .6) < .4 && rf > .34 + jy && rf < .84
    if (head) { const t = 0.05 + hash(si * 7 + 1, ri * 3 + 2) * 0.07; c = [t * 1.08, t * .92, t * .8] }
    else if (body) {
      const r = hash(si + 11, ri + 5), q = hash(si + 17, ri + 2)
      const v = 0.02 + r * 0.06
      c = [v, v, v * 1.04]
      if (q > 0.9) c = SHIRTS[Math.floor(hash(si + 5, ri + 13) * SHIRTS.length)]
    }
  }
  const e = clamp(light(X, Z, h) * 1.05, 0, 1.2) * (1 - 0.35 * smooth(6, BL_TOP, h))
  const k = (0.26 + e * 1.3) * (0.82 + 0.36 * hash(px, py))
  return [c[0] * k, c[1] * k, c[2] * k]
}
function standColour(X, Z, h, px, py) {
  const [a, b] = ab(X, Z)
  if (a > 0 && b > 0) {
    const ath = Math.abs(Math.atan2(X, Z))
    if (ath < EYE + 0.004) {                       // the batter's eye: flat, matte, nearly black green
      const e = light(X, Z, h) * 0.7
      const top = h > EYE_H - 0.25 ? 1.8 : 1
      return [0.010 * e * top, 0.016 * e * top, 0.013 * e * top]
    }
    if (h > BL_TOP + 0.2) { const v = 0.03 * light(X, Z, h); return [v, v, v * 1.08] }   // the top rail and the walkway
    // the concrete end wall where the bleachers meet the batter's eye (the crowd stops at a wall, not a cut)
    if (ath < EYE + 0.011) { const v = (0.026 + 0.006 * hash(px, py)) * light(X, Z, h); return [v, v * .99, v * 1.04] }
    const th = Math.atan2(X, Z)
    return crowd(Math.hypot(X, Z) * th, h, X, Z, px, py)
  }
  return crowd(b < 0 ? a : b, h, X, Z, px, py)
}

// ── the ray caster ──
const rgb = new Float32Array(W * H * 3)
// where each column's ray (its path on the ground depends only on dx) leaves the field
const tWall = new Float32Array(W)
for (let px = 0; px < W; px++) {
  const dx = (px + .5 - cx) / f
  let t = 20, lo = t, hi = 600
  while (t < 600) { const n = t + 0.5; if (!inField(dx * n, n - CAMB)) { lo = t; hi = n; break } t = n }
  for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (inField(dx * m, m - CAMB)) lo = m; else hi = m }
  tWall[px] = (lo + hi) / 2
}
for (let py = 0; py < H; py++) {
  const dy = (y0 - (py + .5)) / f
  for (let px = 0; px < W; px++) {
    const dx = (px + .5 - cx) / f
    const tw = tWall[px]
    let col = null
    const tg = dy < 0 ? camH / -dy : Infinity
    if (tg < tw) col = ground(dx * tg, tg - CAMB, tg, px, py)
    else {
      const hw = camH + dy * tw
      if (hw >= 0 && hw <= WALL_H) col = wall(dx * tw, tw - CAMB, hw, px, py)
      else if (hw > WALL_H) {
        // past the wall: step out until the ray meets the stands (or clears everything)
        let t0 = tw, hit = -1
        for (let t = tw + 0.6; t < 520; t += 0.6) {
          const h = camH + dy * t
          if (dy >= 0 && h > BL_TOP + 4 && h > EYE_H + 1) break
          if (h <= standsAt(dx * t, t - CAMB)) { hit = t; break }
          t0 = t
        }
        if (hit > 0) {
          let lo = t0, hi = hit
          for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (camH + dy * m <= standsAt(dx * m, m - CAMB)) hi = m; else lo = m }
          const t = hi
          col = standColour(dx * t, t - CAMB, camH + dy * t, px, py)
        } else if (dy < 0) col = [0.006, 0.006, 0.008]          // the concourse behind the stands, in the dark
      }
    }
    if (!col) {    // the night sky: navy-black, a little lighter at the horizon
      const s = 0.008 + 0.010 * clamp(1 - (y0 - py) / y0)
      col = [s * .78, s * .88, s * 1.32]
    }
    const i = (py * W + px) * 3
    rgb[i] = col[0]; rgb[i + 1] = col[1]; rgb[i + 2] = col[2]
  }
}

// the haze the towers throw into the air over the field, the vignette, the bottom falling into the dark
for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
  const i = (py * W + px) * 3
  const ny = py / H, nx = (px - cx) / W
  const haze = 0.022 * Math.exp(-(((py - (y0 - 70 * SS)) / (160 * SS)) ** 2)) * (0.75 + 0.25 * Math.cos(nx * 3))
  const vig = 1 - 0.58 * smooth(0.3, 0.8, Math.hypot(nx * 1.05, (ny - 0.48) * 1.15))
  const bottom = 1 - 0.5 * smooth(0.74, 1, ny)
  for (let c = 0; c < 3; c++) rgb[i + c] = (rgb[i + c] + haze * (c === 2 ? 1.08 : c === 1 ? 1.0 : 0.96)) * vig * bottom
}

// to 8-bit with a gentle filmic curve and a touch of grain (so the darks don't band)
const out = Buffer.alloc(W * H * 3)
for (let i = 0; i < W * H * 3; i++) {
  const v = rgb[i]
  const g = clamp(v / (1 + v * .4)) * 255 + (hash(i, 7) - .5) * 2.4
  out[i] = clamp(Math.round(g), 0, 255)
}

// ── the light towers: a pole, a frame, a bank of lamps facing the field ──
// (the bank is one lit panel with hairline gaps between its lamps, and a wide halo: at Home's size a grid of
// separate dots reads as a speaker grille, a lit panel in its own haze reads as a light)
const P = (X, Z, h = 0) => { const z = Z + CAMB; return [cx + f * X / z, y0 - f * (h - camH) / z] }
const pt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`
const towers = [], lamps = [], glow = [], beams = []
const LAMP = '#f6f1e3'                                   // a warm white, the ball's leather lit
for (const { p: [lx, lz, lh], seen } of TOWERS) {
  if (!seen) continue
  const [x, y] = P(lx, lz, lh)
  const z = lz + CAMB, m = f / z                         // pixels per metre at the tower
  const bw = 9 * m, bh = 4.2 * m
  // the pole down to the stands, and two thin braces
  const [, yb] = P(lx, lz, 4)
  towers.push(`<rect x="${(x - .45 * m).toFixed(1)}" y="${(y + bh / 2).toFixed(1)}" width="${(.9 * m).toFixed(1)}" height="${(yb - y - bh / 2).toFixed(1)}" fill="#14171c"/>`)
  towers.push(`<line x1="${(x - bw * .3).toFixed(1)}" y1="${(y + bh / 2).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + bh / 2 + 3.2 * m).toFixed(1)}" stroke="#14171c" stroke-width="${(.35 * m).toFixed(1)}"/>`)
  towers.push(`<line x1="${(x + bw * .3).toFixed(1)}" y1="${(y + bh / 2).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + bh / 2 + 3.2 * m).toFixed(1)}" stroke="#14171c" stroke-width="${(.35 * m).toFixed(1)}"/>`)
  towers.push(`<rect x="${(x - bw / 2 - .4 * m).toFixed(1)}" y="${(y - bh / 2 - .4 * m).toFixed(1)}" width="${(bw + .8 * m).toFixed(1)}" height="${(bh + .8 * m).toFixed(1)}" fill="#101318"/>`)
  lamps.push(`<rect x="${(x - bw / 2).toFixed(1)}" y="${(y - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(.25 * m).toFixed(1)}" fill="${LAMP}"/>`)
  for (let c = 1; c < 8; c++) { const gx = x - bw / 2 + c * bw / 8; lamps.push(`<line x1="${gx.toFixed(1)}" y1="${(y - bh / 2).toFixed(1)}" x2="${gx.toFixed(1)}" y2="${(y + bh / 2).toFixed(1)}" stroke="#b9b4a8" stroke-opacity=".55" stroke-width="${(.12 * m).toFixed(2)}"/>`) }
  for (let r = 1; r < 4; r++) { const gy = y - bh / 2 + r * bh / 4; lamps.push(`<line x1="${(x - bw / 2).toFixed(1)}" y1="${gy.toFixed(1)}" x2="${(x + bw / 2).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#b9b4a8" stroke-opacity=".55" stroke-width="${(.12 * m).toFixed(2)}"/>`) }
  glow.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(bw * 1.05).toFixed(1)}" ry="${(bh * 1.4).toFixed(1)}" fill="#fff4dc" opacity=".7"/>`)
  // its light falling through the night air onto the field: a faint cone
  const [ax, ay] = P(lx * .35 - 10, lz * .45), [bx, by] = P(lx * .35 + 10, lz * .45)
  beams.push(`<polygon points="${pt([x - bw / 2, y])} ${pt([x + bw / 2, y])} ${pt([bx, by])} ${pt([ax, ay])}" fill="#fff2d8" opacity=".10"/>`)
  console.log('tower', lx.toFixed(0), lz.toFixed(0), '->', (x / SS).toFixed(0), (y / SS).toFixed(0))
}
const svg = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`)
const bloom = await sharp(svg(lamps.join(''))).blur(7 * SS).modulate({ brightness: .75 }).png().toBuffer()
const haze = await sharp(svg(glow.join(''))).blur(26 * SS).modulate({ brightness: .55 }).png().toBuffer()   // (the air round each bank)
const beamLayer = await sharp(svg(beams.join(''))).blur(22 * SS).png().toBuffer()
const bloomWide = await sharp(svg(glow.join(''))).blur(56 * SS).modulate({ brightness: .5 }).png().toBuffer()

const big = await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .composite([
    { input: beamLayer, blend: 'screen' },
    { input: svg(towers.join('')) },
    { input: bloomWide, blend: 'screen' },
    { input: haze, blend: 'screen' },
    { input: bloom, blend: 'screen' },
    { input: svg(lamps.join('')) },
  ])
  .png().toBuffer()
await sharp(big).resize(OW, OH, { kernel: 'lanczos3' }).webp({ quality: 78, effort: 6 }).toFile(OUT)
// where things land (for the CSS that frames it)
for (const [n, X, Z, h] of [['2B', 0, BASE * R2, 0], ['mound', 0, RUBBER, 0], ['arc', 0, RUBBER + SKIN_R, 0], ['wall-c', 0, CENTER, WALL_H], ['track-c', 0, CENTER - TRACK, 0]]) {
  const [x, y] = P(X, Z, h); console.log(n.padEnd(8), (x / SS).toFixed(0), (y / SS).toFixed(0))
}
console.log('wrote', OUT)
