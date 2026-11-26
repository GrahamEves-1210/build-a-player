// BLACKTOP LIVE: the floor. The court pictures in the shop (public/court-*.webp, public/courts/*) are 56 x 42 ft of
// asphalt, all painted to one design (each a few px off it: OLDS), but those lines aren't a real court's (a short lane,
// a three-point line 26 ft out at the top, no restricted area, the hoop on the baseline). So the picture is used for
// its surface only: its own lines and hoop are painted out (each line's pixels replaced by the floor mirrored from
// beside it), a theme's coloured lane, circles and stripe are moved to the real lines (THEME), the
// picture is carried on down to half court (51.6 ft: tune.js COURT), and a real NBA half court is painted on it from
// the same numbers the game plays by, in worn white paint. The hoop is drawn on the game's canvas (drawHoop), in among
// the men, so a man under the rim is under it and a man in front of it is over it.
import { COURT } from '../../lib/btlive/index.js'

const C = COURT, RIM = C.rim
// The view is from above and behind half court, so a thing off the floor is drawn up the screen by VIEW_LIFT ft a foot
// of its height (the ball is drawn the same way: engine.js). The rim is 10 ft up, so the hoop is drawn HOOP_LIFT up from
// the spot on the floor under it (where the game measures from, and its shadow falls): it reads at the baseline, as
// a hoop seen from the stands does, while the rim is still 5 ft 3 in in from the baseline on the floor
export const VIEW_LIFT = 0.27
export const HOOP_LIFT = VIEW_LIFT * 10
// the rim as drawn: a touch bigger than its 18 in (the ball is drawn big to be seen, so the rim keeps pace with it)
export const RIM_DRAW = 1.3
// each shop picture's own lines, in its own pixels (measured from the pictures: scripts/btlive/court-fit.mjs).
// They're all drawn to one design but not to the pixel, so each court has its own row: line centres; ftC and halfC are
// [x, y, r] (ftC's dashed top half a little taller than round: its 4th number); hash: the lane marks' heights
const OLDS = {
'court-blacktop1': { w: 1451, side: [76.5, 1373.5], base: 61.5, half: 1026.5, lane: [552.5, 896.5], ft: 480.5, corner: [184.5, 1265.5], arc: [726.5, 221.5, 570.5], ftC: [724, 486.5, 145, 169.5], halfC: [726, 1022.5, 126], hash: [211.5, 233.5, 302, 372] },
  'ct-alley': { w: 1448, side: [78, 1371], base: 63, half: 1028.5, lane: [551, 895.5], ft: 482.5, corner: [186.5, 1262.5], arc: [726, 225.5, 568], ftC: [722.5, 487.5, 145, 169.5], halfC: [725.5, 1024.5, 125], hash: [212, 234, 303, 373] },
  'ct-autumn': { w: 1448, side: [80, 1368], base: 62, half: 1025.5, lane: [553, 892.5], ft: 481.5, corner: [183.5, 1263.5], arc: [723, 220.5, 571.5], ftC: [721.5, 485.5, 146, 168.5], halfC: [724.5, 1024.5, 124], hash: [214.5, 235, 302.5, 372.5] },
  'ct-carnival': { w: 1448, side: [79, 1371], base: 63, half: 1028.5, lane: [554, 896.5], ft: 481.5, corner: [189.5, 1263.5], arc: [725, 231.5, 561.5], ftC: [723.5, 488.5, 144, 172], halfC: [724.5, 1026.5, 127], hash: [164, 214, 233, 301, 372.5] },
  'ct-checker': { w: 1448, side: [80, 1370], base: 62, half: 1027.5, lane: [550, 895.5], ft: 482.5, corner: [184.5, 1262.5], arc: [724, 222.5, 570.5], ftC: [722.5, 489.5, 144, 172], halfC: [723.5, 1024.5, 126], hash: [214.5, 237, 303, 373] },
  'ct-goldenhour': { w: 1448, side: [81, 1368], base: 63, half: 1028.5, lane: [554, 892.5], ft: 482.5, corner: [188.5, 1263.5], arc: [723.5, 226, 566.5], ftC: [721.5, 487.5, 145, 170], halfC: [724.5, 1022.5, 123], hash: [212, 236, 302, 373.5] },
  'ct-harbor': { w: 1448, side: [82, 1376], base: 64, half: 1026.5, lane: [555, 892.5], ft: 481.5, corner: [184.5, 1264.5], arc: [727.5, 228, 566], ftC: [723.5, 488.5, 146, 170.5], halfC: [724.5, 1023.5, 123], hash: [211.5, 235.5, 302, 372.5] },
  'ct-ivy': { w: 1448, side: [78, 1369], base: 61, half: 1016.5, lane: [559, 888.5], ft: 471.5, corner: [182.5, 1265.5], arc: [725, 212.5, 568.5], ftC: [721.5, 476.5, 142, 168.5], halfC: [722.5, 1006.5, 121], hash: [202, 224, 291, 359] },
  'ct-marble': { w: 1448, side: [80, 1371], base: 62, half: 1028.5, lane: [551, 892.5], ft: 481.5, corner: [184.5, 1260.5], arc: [724.5, 224, 569], ftC: [721.5, 485.5, 146, 168], halfC: [722.5, 1022.5, 124], hash: [212, 235.5, 302.5, 372.5] },
  'ct-midnight': { w: 1448, side: [82, 1372], base: 63, half: 1024.5, lane: [553, 892.5], ft: 481.5, corner: [187.5, 1263.5], arc: [725.5, 224.5, 568], ftC: [723.5, 485.5, 145, 168], halfC: [725.5, 1024.5, 126], hash: [212, 237, 302, 372] },
  'ct-neon': { w: 1448, side: [84, 1362], base: 63, half: 1022.5, lane: [553, 893.5], ft: 481.5, corner: [187.5, 1259.5], arc: [722.5, 228.5, 564.5], ftC: [722.5, 485.5, 146, 168], halfC: [723.5, 1020.5, 123], hash: [212, 234, 302, 375] },
  'ct-nightrain': { w: 1448, side: [79, 1373], base: 62, half: 1027.5, lane: [553, 895.5], ft: 480.5, corner: [188.5, 1264.5], arc: [725, 227, 565], ftC: [723.5, 486.5, 146, 169.5], halfC: [724.5, 1024.5, 126], hash: [214, 234.5, 302, 372] },
  'ct-oldstone': { w: 1448, side: null, base: 101, half: 1026.5, lane: [556, 891.5], ft: 489.5, corner: [193.5, 1253.5], arc: [724.5, 234, 565], ftC: [723.5, 493.5, 146, 165.5], halfC: [723.5, 1021.5, 123], hash: [223.5, 247, 314.5, 385] },
  'ct-overcast': { w: 1448, side: [80, 1349], base: 61, half: 1024.5, lane: [550, 895.5], ft: 480.5, corner: [188.5, 1262.5], arc: [726, 224.5, 568], ftC: [722.5, 487.5, 144, 171], halfC: [725.5, 1022.5, 125], hash: [211, 233, 302, 372] },
  'ct-patchwork': { w: 1448, side: [104, 1353], base: 69, half: 1022.5, lane: [556, 891.5], ft: 479.5, corner: [206.5, 1248.5], arc: [724, 244.5, 548], ftC: [723.5, 488.5, 142, 172], halfC: [723.5, 1017.5, 119], hash: [213.5, 237.5, 301, 370] },
  'ct-redzone': { w: 1448, side: [92, 1353], base: 75, half: 1017.5, lane: [553, 890.5], ft: 483.5, corner: [197.5, 1248.5], arc: [725, 232, 558], ftC: [721.5, 490.5, 142, 167], halfC: [722.5, 1014.5, 123], hash: [220, 241, 308, 378.5] },
  'ct-retro': { w: 1448, side: [77, 1371], base: 62, half: 1023.5, lane: [552, 896.5], ft: 479.5, corner: [187.5, 1264.5], arc: [725, 222.5, 570], ftC: [721.5, 483.5, 145, 167.5], halfC: [724.5, 1022.5, 124], hash: [213.5, 233.5, 304, 371.5] },
  'ct-snow': { w: 1448, side: [78, 1368], base: 63, half: 1025.5, lane: [549, 892.5], ft: 480.5, corner: [182.5, 1259.5], arc: [723, 222.5, 569.5], ftC: [720.5, 482.5, 145, 166], halfC: [723.5, 1017.5, 121], hash: [211, 232, 301, 371] },
  'ct-space': { w: 1448, side: [81, 1372], base: 63, half: 1026.5, lane: [553, 895.5], ft: 481.5, corner: [185.5, 1263.5], arc: [723.5, 225.5, 568], ftC: [722.5, 487.5, 145, 170], halfC: [725.5, 1023.5, 125], hash: [212, 234, 302.5, 372.5] },
  'ct-tropic': { w: 1448, side: [79, 1372], base: 63, half: 1023.5, lane: [553, 895.5], ft: 481.5, corner: [183.5, 1264.5], arc: [726, 224, 568.5], ftC: [723.5, 485.5, 145, 169], halfC: [725.5, 1024.5, 126], hash: [212, 233, 302, 372] },
  'ct-warehouse': { w: 1448, side: [88, 1366], base: 62, half: 1026.5, lane: [551, 892.5], ft: 480.5, corner: [184.5, 1262.5], arc: [723, 224.5, 568], ftC: [722.5, 485.5, 146, 169], halfC: [724.5, 1023.5, 126], hash: [212, 234.5, 302, 372] },
}
const BAND = 11                       // px either side of an old line's middle that are painted out

// a seeded roll (the wear in the paint is the same every game)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

// Courts whose theme paints the court's areas in a colour (the lane, the free-throw circle's lower half, the half-court
// circle, a stripe inside the three-point line). Those are painted to the picture's old lines, so they're moved to
// the real ones: the paint's own texture, stretched from where it was to where it goes. band: the three-point stripe's
// inside edge and its far edge, px in from the line's middle
const THEME = {
  'ct-harbor': { key: 1, ftLow: 1, halfC: 1 },
  'ct-carnival': { key: 1 },
  'ct-redzone': { key: 1, ftLow: 1, halfC: 1, band: [4, 23] },
  // (not paint, but the same kind of thing: how the old hoop is covered, and no white-paint sweep on white squares)
  'ct-marble': { hoopFrom: [180, 204] },
  'ct-checker': { bw: 15, ext: 252, grid: [[63, 183, 303, 422, 545, 663, 784, 900, 1024, 1146, 1266, 1386], [58, 177, 296, 415, 537, 662, 788, 914, 1040]] },
  'ct-snow': { noSweep: 1 },
}
const HOOP = [628, 48, 822, 178]      // the picture's hoop (backboard, rim and net: x0, y0, x1, y1), the same on every one

// where the old three-point line's corner meets its arc, each side
const joinY = (O, x) => O.arc[1] + Math.sqrt(Math.max(0, O.arc[2] * O.arc[2] - (x - O.arc[0]) ** 2))

// Paint out the picture's lines: every pixel within BAND of one is replaced by the pixel mirrored across the band's
// edge on its own side (the asphalt's grain carries on through), walking on past any other line it lands in.
// th.band: the three-point stripe goes with its line (the band reaches in that much farther on the inside)
function eraseOld(cv, sc, O, th) {
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const W = cv.width, H = cv.height, img = ctx.getImageData(0, 0, W, H), d = img.data
  const mask = new Uint8Array(W * H), NX = new Float32Array(W * H), NY = new Float32Array(W * H)
  const B = (th.bw || BAND) * sc, IN = th.band ? (th.band[1] + 6) * sc : B
  const mark = (x, y, nx, ny) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; mask[i] = 1; NX[i] = nx; NY[i] = ny }
  // a straight line (vertical or horizontal) from a to b at c; lo/hi: how far the band reaches either side
  const vline = (x, y0, y1, lo = B, hi = B) => { x *= sc; for (let y = Math.floor(y0 * sc - B); y <= y1 * sc + B; y++) for (let px = Math.floor(x - lo); px <= x + hi; px++) mark(px, y, px - x >= 0 ? 1 : -1, 0) }
  const hline = (y, x0, x1) => { y *= sc; for (let py = Math.floor(y - B); py <= y + B; py++) for (let x = Math.floor(x0 * sc - B); x <= x1 * sc + B; x++) mark(x, py, 0, py - y >= 0 ? 1 : -1) }
  // a circle, or an ellipse up top (ry: its height above the middle), only where keep(y) says; lo: the band inside it
  const circ = (cx, cy, r, keep = () => true, ry = r, lo = B) => {
    cx *= sc; cy *= sc; r *= sc; ry *= sc
    for (let y = Math.floor(cy - ry - B); y <= cy + r + B; y++) {
      if (!keep(y / sc)) continue
      const rv = y < cy ? ry : r
      for (let x = Math.floor(cx - r - B); x <= cx + r + B; x++) {
        const dx = x - cx, dy = (y - cy) * r / rv, l = Math.hypot(dx, dy) || 1, dc = l - r
        if (dc <= B && dc >= -lo) mark(x, y, dx / l * (dc >= 0 ? 1 : -1), dy / l * (dc >= 0 ? 1 : -1))
      }
    }
  }
  if (O.side) for (const x of O.side) vline(x, O.base, O.half)
  hline(O.base, O.side ? O.side[0] : O.corner[0] - 60, O.side ? O.side[1] : O.corner[1] + 60)
  hline(O.half, O.side ? O.side[0] : O.corner[0] - 60, O.side ? O.side[1] : O.corner[1] + 60)
  for (const x of O.lane) vline(x, O.base, O.ft)
  hline(O.ft, O.lane[0], O.lane[1])
  const jl = joinY(O, O.corner[0]), jr = joinY(O, O.corner[1])
  vline(O.corner[0], O.base, jl + 20, B, IN); vline(O.corner[1], O.base, jr + 20, IN, B)
  circ(O.ftC[0], O.ftC[1], O.ftC[2], undefined, O.ftC[3])
  circ(O.arc[0], O.arc[1], O.arc[2], y => y >= Math.min(jl, jr) - 20, undefined, IN)
  circ(O.halfC[0], O.halfC[1], O.halfC[2], y => y <= O.half + 10)
  for (const y of O.hash) for (const [x0, x1] of [[O.lane[0] - 30, O.lane[0]], [O.lane[1], O.lane[1] + 30]]) hline(y, x0, x1)
  const src = new Uint8ClampedArray(d)
  const far = 2 * Math.max(B, IN) + 2
  // what the measured lines missed (a line that bends off its circle where a corner turns into the arc, a mark a
  // couple of px off): any thin run of white paint near them goes too. Thin: white with no white 10 px away along
  // one of the four ways, so a white square, a snowbank or a light patch is never taken for paint
  if (!th.noSweep) {
    const white = i => { const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn > 150 && mx - mn < 95 }
    const R = 22 * sc | 0, near = new Uint8Array(W * H), tmp = new Uint8Array(W * H)
    // near: within R of a measured line (a box dilation, rows then columns)
    for (let y = 0; y < H; y++) { let run = -1e9; for (let x = 0; x < W; x++) { if (mask[y * W + x]) run = x; if (x - run <= R) tmp[y * W + x] = 1 } run = 1e9; for (let x = W - 1; x >= 0; x--) { if (mask[y * W + x]) run = x; if (run - x <= R) tmp[y * W + x] = 1 } }
    for (let x = 0; x < W; x++) { let run = -1e9; for (let y = 0; y < H; y++) { if (tmp[y * W + x]) run = y; if (y - run <= R) near[y * W + x] = 1 } run = 1e9; for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) run = y; if (run - y <= R) near[y * W + x] = 1 } }
    const g = 10 * sc | 0, add = []
    for (let y = g; y < H - g; y++) for (let x = g; x < W - g; x++) {
      const i = y * W + x
      if (mask[i] || !near[i] || !white(i)) continue
      if ((!white(i - g) && !white(i + g)) || (!white(i - g * W) && !white(i + g * W)) || (!white(i - g * W - g) && !white(i + g * W + g)) || (!white(i - g * W + g) && !white(i + g * W - g))) add.push(i)
    }
    const P = 3 * sc | 0
    for (const i of add) { const x = i % W, y = (i / W) | 0; for (let yy = y - P; yy <= y + P; yy++) for (let xx = x - P; xx <= x + P; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H && !mask[yy * W + xx]) { mask[yy * W + xx] = 2; NX[yy * W + xx] = 0; NY[yy * W + xx] = 0 } }
  }
  // a floor of squares (th.grid: the squares' edges across and down, measured): the old hoop goes the same way as the
  // lines, and every pixel is the same spot in another square of its colour (one across and one down, or two along),
  // so each square comes back whole with straight edges
  const done = new Uint8Array(W * H)
  if (th.grid) {
    const [GX, GY] = th.grid.map(a => a.map(v => v * sc)), NXC = GX.length - 1, NYC = GY.length - 1
    for (let y = HOOP[1] * sc | 0; y < HOOP[3] * sc; y++) for (let x = HOOP[0] * sc | 0; x < HOOP[2] * sc; x++) { mask[y * W + x] = 2; NX[y * W + x] = NY[y * W + x] = 0 }
    // the squares aren't laid to the pixel: each edge is found again along each square it bounds (where the light
    // changes most, within 7 px of the measured line, on floor no line covers)
    const lum = i => src[i * 4] + src[i * 4 + 1] + src[i * 4 + 2]
    const local = (G, A, across) => G.map((g, k) => Array.from({ length: A.length - 1 }, (_, c) => {
      let best = g, bv = 0
      for (let v = Math.round(g - 7 * sc); v <= g + 7 * sc; v++) {
        let s = 0, n = 0
        for (let u = Math.ceil(A[c] + 8); u < A[c + 1] - 8; u += 2) {
          const [x0, y0, x1, y1] = across ? [v - 2, u, v + 2, u] : [u, v - 2, u, v + 2]
          if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H) continue
          const i0 = y0 * W + x0, i1 = y1 * W + x1
          if (mask[i0] || mask[i1]) continue
          s += Math.abs(lum(i1) - lum(i0)); n++
        }
        if (n > 25 && s / n > bv) { bv = s / n; best = v }
      }
      return best
    }))
    const VE = local(GX, GY, true), HE = local(GY, GX, false)   // VE[k][row], HE[k][column]
    const find = (L, v) => { for (let k = 0; k < L.length - 1; k++) if (v >= L[k] && v < L[k + 1]) return k; return -1 }
    const box = (cx, cy) => [VE[cx][cy], VE[cx + 1][cy], HE[cy][cx], HE[cy + 1][cx]]
    const cellOf = (x, y) => {
      let cy = find(GY, y); if (cy < 0) return null
      const cx = find(VE.map(e => e[cy]), x); if (cx < 0) return null
      cy = find(HE.map(e => e[cx]), y); if (cy < 0) return null
      return [cx, cy]
    }
    // each square's own light (the board is lit from one side): a copy takes its new square's
    const mean = new Float64Array(NXC * NYC * 4)
    for (let cy = 0; cy < NYC; cy++) for (let cx = 0; cx < NXC; cx++) {
      const m = (cy * NXC + cx) * 4, [l, r, t, b] = box(cx, cy)
      for (let y = Math.ceil(t + 6); y < b - 6; y += 2) for (let x = Math.ceil(l + 6); x < r - 6; x += 2) { const i = y * W + x; if (x >= W || y >= H || mask[i]) continue; mean[m] += src[i * 4]; mean[m + 1] += src[i * 4 + 1]; mean[m + 2] += src[i * 4 + 2]; mean[m + 3]++ }
      if (mean[m + 3]) for (let c = 0; c < 3; c++) mean[m + c] /= mean[m + 3]
    }
    // (the copies come from floor that was never under a line; a pixel done here is left alone after)
    const OFF = [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]]
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (!mask[i]) continue
      const c = cellOf(x, y); if (!c) continue
      const [cx, cy] = c, [l, r, t, b] = box(cx, cy)
      const fx = Math.min(0.96, Math.max(0.04, (x - l) / (r - l))), fy = Math.min(0.96, Math.max(0.04, (y - t) / (b - t))), mt = (cy * NXC + cx) * 4
      for (const [ox, oy] of OFF) {
        const nx = cx + ox, ny = cy + oy
        if (nx < 0 || ny < 0 || nx >= NXC || ny >= NYC) continue
        const [sl, sr, st, sb] = box(nx, ny), sx = Math.round(sl + fx * (sr - sl)), sy = Math.round(st + fy * (sb - st))
        if (sx < 0 || sy < 0 || sx >= W || sy >= H || mask[sy * W + sx]) continue
        const j = (sy * W + sx) * 4, k = i * 4, ms = (ny * NXC + nx) * 4, lit = mean[mt + 3] && mean[ms + 3]
        for (let q = 0; q < 3; q++) d[k + q] = src[j + q] + (lit ? mean[mt + q] - mean[ms + q] : 0)
        done[i] = 1
        break
      }
    }
  }
  // fill: each pixel is the floor mirrored across the band's edge, along the line's normal, so the grain carries on
  // through. Where the floor either side isn't the same (a stripe's edge, a square's, a shadow's crosses the line)
  // it's mirrored along whichever way joins like to like instead, so the edge carries straight on across
  const clear = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !mask[y * W + x]
  const walk = (x, y, nx, ny, max) => { for (let t = 1; t < max; t++) { const qx = Math.round(x + nx * t), qy = Math.round(y + ny * t); if (qx < 0 || qy < 0 || qx >= W || qy >= H) return -1; if (!mask[qy * W + qx]) return t } return -1 }
  const col = (x, y, nx, ny, t, o) => { let n = 0; o[0] = o[1] = o[2] = 0; for (let k = 0; k < 4; k++) { const qx = Math.round(x + nx * (t + k * 2)), qy = Math.round(y + ny * (t + k * 2)); if (!clear(qx, qy)) continue; const j = (qy * W + qx) * 4; o[0] += src[j]; o[1] += src[j + 1]; o[2] += src[j + 2]; n++ } if (n) { o[0] /= n; o[1] /= n; o[2] /= n } return n }
  const ca = [0, 0, 0], cb = [0, 0, 0], diff = () => Math.abs(ca[0] - cb[0]) + Math.abs(ca[1] - cb[1]) + Math.abs(ca[2] - cb[2])
  let lastK = 0
  const NA = 12, ANG = Array.from({ length: NA }, (_, k) => [Math.cos(k * Math.PI / NA), Math.sin(k * Math.PI / NA)])
  const put = (i, x, y, nx, ny, t) => {
    // mirrored about the edge: as far past it as he is inside it
    let mx = Math.round(x + nx * (2 * t - 1)), my = Math.round(y + ny * (2 * t - 1))
    if (!clear(mx, my)) { mx = Math.round(x + nx * t); my = Math.round(y + ny * t) }
    const j = (my * W + mx) * 4, k = i * 4
    d[k] = src[j]; d[k + 1] = src[j + 1]; d[k + 2] = src[j + 2]
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    if (!mask[i] || done[i]) continue
    const nx = NX[i], ny = NY[i]
    if (nx || ny) {
      const t1 = walk(x, y, nx, ny, 2 * far), t2 = walk(x, y, -nx, -ny, 2 * far)
      if (t1 > 0 && (t2 < 0 || (col(x, y, nx, ny, t1, ca) && col(x, y, -nx, -ny, t2, cb) && diff() < 110))) { put(i, x, y, nx, ny, t1); continue }
    }
    // the way that joins like to like (and short), mirrored from its nearer end
    // (the way the pixel before it took first: along an edge, the next one along takes it too)
    let bc = 1e9, bnx = 0, bny = 0, bt = 0
    for (let q = -1; q < NA; q++) {
      const k = q < 0 ? lastK : q
      if (q >= 0 && k === lastK) continue
      const [ax, ay] = ANG[k]
      const ta = walk(x, y, ax, ay, Math.min(2 * far, bc / 0.7)); if (ta < 0) continue
      const tb = walk(x, y, -ax, -ay, Math.min(2 * far, bc / 0.7 - ta)); if (tb < 0) continue
      if (!col(x, y, ax, ay, ta, ca) || !col(x, y, -ax, -ay, tb, cb)) continue
      const c = diff() + 0.7 * (ta + tb)
      if (c < bc) { bc = c; lastK = k; if (ta <= tb) { bnx = ax; bny = ay; bt = ta } else { bnx = -ax; bny = -ay; bt = tb } }
      if (q < 0 && bc < 50 + 0.7 * 2 * far) break
    }
    if (bt) { put(i, x, y, bnx, bny, bt); continue }
    for (const [ax, ay] of ANG) for (const s of [1, -1]) { const t = walk(x, y, ax * s, ay * s, 2 * far); if (t > 0 && (!bt || t < bt)) { bt = t; bnx = ax * s; bny = ay * s } }
    if (bt) put(i, x, y, bnx, bny, bt)
  }
  ctx.putImageData(img, 0, 0)
  if (th.grid) return
  // the old hoop (backboard, rim, net): the lane's floor from just below it, laid over it, feathered at the edges
  // (th.hoopFrom: rows stretched over it instead, a floor that only runs up and down)
  const [x0, y0, x1, y1] = HOOP.map(v => v * sc), hw = x1 - x0, hh = y1 - y0, off = (hh + 10) * sc
  const patch = document.createElement('canvas'); patch.width = Math.ceil(hw); patch.height = Math.ceil(hh)
  const pc = patch.getContext('2d')
  if (th.hoopFrom) pc.drawImage(cv, x0, th.hoopFrom[0] * sc, hw, (th.hoopFrom[1] - th.hoopFrom[0]) * sc, 0, 0, hw, hh)
  else pc.drawImage(cv, x0, y0 + off, hw, hh, 0, 0, hw, hh)
  pc.globalCompositeOperation = 'destination-in'
  const g = pc.createLinearGradient(0, 0, hw, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.12, '#000'); g.addColorStop(0.88, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)')
  pc.fillStyle = g; pc.fillRect(0, 0, hw, hh)
  ctx.drawImage(patch, x0, y0)
}

// A painted half-court circle that isn't at half court any more: each pixel in it is the floor mirrored up across the
// circle's top edge (the grain carries straight on), feathered into what's round it
function eraseDisc(cv, sc, O) {
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const [cx, cy, r0] = O.halfC.map(v => v * sc), R = r0 + BAND * sc, Wd = Math.ceil(R + 2)
  const x0 = Math.max(0, Math.floor(cx - Wd)), x1 = Math.min(cv.width, Math.ceil(cx + Wd)), y0 = Math.max(0, Math.floor(cy - 3 * R)), y1 = Math.min(cv.height, Math.ceil(cy + BAND * sc + 2))
  const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0), d = img.data, w = x1 - x0, src = new Uint8ClampedArray(d)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const dx = x - cx, dy = y - cy
    if (dx * dx + dy * dy > R * R || dy < -R) continue
    const top = cy - Math.sqrt(R * R - dx * dx), sy = Math.max(y0, Math.round(2 * top - y))
    const k = ((y - y0) * w + x - x0) * 4, j = ((sy - y0) * w + x - x0) * 4
    d[k] = src[j]; d[k + 1] = src[j + 1]; d[k + 2] = src[j + 2]
  }
  ctx.putImageData(img, x0, y0)
}

// The theme's colour fills, moved from the picture's old lines (tex: the picture with its lines painted out, before
// the fills were) to the real court's (px: the picture's pixels a foot)
function paintFills(out, tex, orig, sc, O, th, px) {
  const ctx = out.getContext('2d', { willReadFrequently: true })
  const f = v => v * px, s = v => v * sc
  if (th.key) {
    // the lane: the old one's paint, inside its lines, stretched to the real one (16 ft, out to the free-throw line)
    ctx.drawImage(tex, s(O.lane[0] + 8), s(O.base + 8), s(O.lane[1] - O.lane[0] - 16), s(O.ft - O.base - 16),
      f(C.paint.x0), f(C.minY), f(C.paint.x1 - C.paint.x0), f(C.paint.y1 - C.minY))
  }
  const half = (cx, cy, r, ncx, ncy, nr, down) => {
    // half a circle's paint: the old one's (below its middle: down, else above) stretched onto the real one's
    ctx.save(); ctx.beginPath(); ctx.arc(f(ncx), f(ncy), f(nr), down ? 0 : Math.PI, down ? Math.PI : 2 * Math.PI); ctx.closePath(); ctx.clip()
    const rr = r - 2
    ctx.drawImage(tex, s(cx - rr), s(down ? cy : cy - rr), s(2 * rr), s(rr), f(ncx - nr), f(down ? ncy : ncy - nr), f(2 * nr), f(nr))
    ctx.restore()
  }
  if (th.ftLow) half(O.ftC[0], O.ftC[1], O.ftC[2], RIM.x, C.paint.y1, C.ftR, true)
  if (th.halfC) half(O.halfC[0], O.halfC[1], O.halfC[2], RIM.x, C.maxY, C.centerR, false)
  if (th.band) {
    // the stripe inside the three-point line: each pixel of the real one's is the old one's at the same way along it
    // (from the left baseline round to the right) and the same depth in from the line, from the picture as it came (the
    // stripe's own edge against its line is under the new line)
    const T = orig.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, orig.width, orig.height), td = T.data, TW = orig.width, TH = orig.height
    const [d0, d1] = th.band, D1 = s(d1 + 4), FEATHER = 4 * sc
    // a three-point line: its corners' x, the baseline, the arc (centre, radius), as a path a point can be put on
    const path = (xl, xr, base, ax, ay, ar) => {
      const yl = ay + Math.sqrt(Math.max(0, ar * ar - (xl - ax) ** 2)), yr = ay + Math.sqrt(Math.max(0, ar * ar - (xr - ax) ** 2))
      const al = Math.atan2(yl - ay, xl - ax), aR = Math.atan2(yr - ay, xr - ax)
      const L1 = yl - base, L2 = ar * (al - aR), L3 = yr - base
      return { xl, xr, base, ax, ay, ar, yl, yr, al, aR, L1, L2, L3, len: L1 + L2 + L3 }
    }
    const P0 = path(s(O.corner[0]), s(O.corner[1]), s(O.base), s(O.arc[0]), s(O.arc[1]), s(O.arc[2]))
    const P1 = path(f(RIM.x - C.arcSideX), f(RIM.x + C.arcSideX), f(C.minY), f(C.arcC.x), f(C.arcC.y), f(C.arcR))
    const at = (P, u, dd) => {               // a point dd in from the line, u of the way along it
      let t = u * P.len
      if (t < P.L1) return [P.xl + dd, P.base + t]
      t -= P.L1
      if (t < P.L2) { const a = P.al - t / P.ar; return [P.ax + Math.cos(a) * (P.ar - dd), P.ay + Math.sin(a) * (P.ar - dd)] }
      t -= P.L2
      return [P.xr - dd, P.base + P.L3 - t]
    }
    const y0 = Math.floor(P1.base), y1 = Math.ceil(P1.ay + P1.ar), x0 = Math.floor(P1.xl), x1 = Math.ceil(P1.xr)
    const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0), d = img.data, w = x1 - x0
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      let u, dd
      if (y < P1.yl && x - P1.xl < D1) { dd = x - P1.xl; u = (y - P1.base) / P1.len }
      else if (y < P1.yr && P1.xr - x < D1) { dd = P1.xr - x; u = (P1.len - (y - P1.base)) / P1.len }
      else if (y >= Math.min(P1.yl, P1.yr)) {
        const a = Math.atan2(y - P1.ay, x - P1.ax)
        if (a > P1.al || a < P1.aR) continue
        dd = P1.ar - Math.hypot(x - P1.ax, y - P1.ay); u = (P1.L1 + (P1.al - a) * P1.ar) / P1.len
      } else continue
      if (dd < 0 || dd >= D1) continue
      const [sx, sy] = at(P0, u, Math.max(dd, s(d0))).map(Math.round)
      if (sx < 0 || sy < 0 || sx >= TW || sy >= TH) continue
      const j = (sy * TW + sx) * 4, k = ((y - y0) * w + x - x0) * 4
      const a = Math.min(1, (D1 - dd) / FEATHER)
      d[k] += (td[j] - d[k]) * a; d[k + 1] += (td[j + 1] - d[k + 1]) * a; d[k + 2] += (td[j + 2] - d[k + 2]) * a
    }
    ctx.putImageData(img, x0, y0)
  }
}

// the real lines, in feet (tune.js COURT), on a layer of their own; then the wear: the paint flaked off in specks,
// thinner in places, the way a park court's lines are
function paintLines(ctx, px, W, H) {
  const L = document.createElement('canvas'); L.width = W; L.height = H
  const g = L.getContext('2d')
  const f = v => v * px, lw = 0.3 * px
  g.strokeStyle = '#ece6d6'; g.fillStyle = '#ece6d6'; g.lineWidth = lw; g.lineCap = 'butt'; g.lineJoin = 'miter'
  const seg = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(f(x0), f(y0)); g.lineTo(f(x1), f(y1)); g.stroke() }
  const arc = (cx, cy, r, a0, a1, dash = null) => { g.setLineDash(dash ? dash.map(f) : []); g.beginPath(); g.arc(f(cx), f(cy), f(r), a0, a1); g.stroke(); g.setLineDash([]) }
  const h = lw / px / 2
  // the boundary: baseline, sidelines, half-court line (the paint's outside edge on the line itself)
  g.strokeRect(f(C.minX), f(C.minY), f(C.maxX - C.minX), f(C.maxY - C.minY))
  // the lane and the free-throw line
  g.strokeRect(f(C.paint.x0), f(C.minY), f(C.paint.x1 - C.paint.x0), f(C.paint.y1 - C.minY))
  // the lane's marks, outside each side: the block (7 ft up), then marks at 8, 11 and 14 ft from the baseline
  for (const sd of [-1, 1]) {
    const x = sd < 0 ? C.paint.x0 : C.paint.x1
    g.fillRect(f(sd < 0 ? x - 0.67 : x), f(C.minY + 7), f(0.67), f(1))
    for (const y of [8 + 1 + h, 11 + 1, 14 + 1]) g.fillRect(f(sd < 0 ? x - 0.5 : x), f(C.minY + y - 0.08), f(0.5), f(0.17))
  }
  // the free-throw circle: solid out past the line, dashed inside the lane
  arc(C.rim.x, C.paint.y1, C.ftR, 0, Math.PI)
  arc(C.rim.x, C.paint.y1, C.ftR, Math.PI, 2 * Math.PI, [1.25, 1.1])
  // the restricted area: 4 ft round the rim, straight back to the backboard's face
  arc(RIM.x, RIM.y, C.ra, 0, Math.PI)
  seg(RIM.x - C.ra, RIM.y, RIM.x - C.ra, C.board.y); seg(RIM.x + C.ra, RIM.y, RIM.x + C.ra, C.board.y)
  // the three-point line: straight up each corner, then round the rim
  const ay = C.arcSideY, a0 = Math.atan2(ay - C.arcC.y, C.arcSideX), a1 = Math.atan2(ay - C.arcC.y, -C.arcSideX)
  g.beginPath(); g.moveTo(f(RIM.x + C.arcSideX), f(C.minY)); g.lineTo(f(RIM.x + C.arcSideX), f(ay))
  g.arc(f(C.arcC.x), f(C.arcC.y), f(C.arcR), a0, a1); g.lineTo(f(RIM.x - C.arcSideX), f(C.minY)); g.stroke()
  // the centre circle at half court (our side of it)
  arc(RIM.x, C.maxY, C.centerR, Math.PI, 2 * Math.PI); arc(RIM.x, C.maxY, C.centerR2, Math.PI, 2 * Math.PI)
  // the wear
  const r = rng(0xb1ac), n = Math.round(W * H / 260)
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, s = (0.4 + r() * r() * 2.6) * px / 26
    g.globalAlpha = 0.25 + 0.75 * r()
    g.beginPath(); g.ellipse(x, y, s * (1 + r()), s, r() * 3.14, 0, 6.283); g.fill()
  }
  // ...and broad faded stretches
  for (let i = 0; i < 26; i++) { g.globalAlpha = 0.12 + 0.2 * r(); g.beginPath(); g.ellipse(r() * W, r() * H, px * (1 + 3 * r()), px * (0.6 + 1.5 * r()), r() * 3.14, 0, 6.283); g.fill() }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 0.93; ctx.drawImage(L, 0, 0); ctx.globalAlpha = 1
}

// The floor from a shop picture (a loaded <img>): a canvas C.W x C.H ft, at the picture's own pixels a foot. The last
// one is kept, so a rematch on the same court doesn't paint it again
let last = null
const copy = cv => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); return c }
export function paintCourt(img) {
  const name = (img.currentSrc || img.src || '').split('/').pop().split(/[.?#]/)[0]
  if (last && last.src === (img.currentSrc || img.src) && last.w === img.naturalWidth) return copy(last.cv)
  const O = OLDS[name] || OLDS['court-blacktop1'], th = THEME[name] || {}
  const px = img.naturalWidth / C.W, sc = img.naturalWidth / O.w
  const W = img.naturalWidth, H0 = img.naturalHeight, H = Math.round(C.H * px)
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H0
  cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0)
  const orig = th.band ? copy(cv) : null
  eraseOld(cv, sc, O, th)
  const tex = th.key || th.ftLow || th.halfC ? copy(cv) : null
  if (th.halfC) eraseDisc(cv, sc, O)
  const out = document.createElement('canvas'); out.width = W; out.height = H
  const ctx = out.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(cv, 0, 0)
  // on down to half court and past it: the floor from just inside the picture's old half-court line, mirrored (the
  // surface carries on with no seam; the picture's own strip of apron under that line goes)
  const cut = Math.round((O.half - 14) * sc), ext = H - cut
  // (th.ext: a pattern that repeats every that many px down carries on by its repeat instead, from its last row)
  if (th.ext) for (let y = Math.round((th.grid ? th.grid[1][th.grid[1].length - 1] : O.half) * sc), P = Math.round(th.ext * sc); y < H; y += P) ctx.drawImage(out, 0, y - P, W, Math.min(P, H - y), 0, y, W, Math.min(P, H - y))
  else if (ext > 0) { ctx.save(); ctx.translate(0, cut * 2); ctx.scale(1, -1); ctx.drawImage(cv, 0, cut - ext, W, ext, 0, cut - ext, W, ext); ctx.restore() }
  paintFills(out, tex, orig, sc, O, th, px)
  paintLines(ctx, px, W, H)
  last = { src: img.currentSrc || img.src, w: img.naturalWidth, cv: out }
  return copy(out)
}

// The hoop, on the game's canvas (k: px a foot), drawn from above: the stanchion's arm out over the baseline, the
// backboard 4 ft in, the rim 15 in out from it, the net hanging under it. sway: the rim's offset (a dunk), [x, y] px
export function drawHoop(ctx, k, sway = null, part = 'all') {
  const up = HOOP_LIFT * k
  const rx = RIM.x * k + (sway?.[0] || 0), ry = RIM.y * k - up + (sway?.[1] || 0), r = C.rimR * k * RIM_DRAW, by = C.board.y * k - up, bw = C.board.w * k
  const INK = 'rgba(8,10,12,.9)'
  if (part !== 'front') {
    // the arm, from the pole behind the baseline to the board
    ctx.fillStyle = '#3a3f44'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, k * 0.08)
    ctx.beginPath(); ctx.rect(RIM.x * k - k * 0.22, (C.minY - 2.1) * k - up, k * 0.44, by - (C.minY - 2.1) * k + up - k * 0.3); ctx.fill(); ctx.stroke()
    // the board, seen edge on from above (glass, a steel frame)
    ctx.fillStyle = 'rgba(232,240,246,.95)'; ctx.beginPath(); ctx.rect(RIM.x * k - bw / 2, by - k * 0.36, bw, k * 0.36); ctx.fill(); ctx.stroke()
    ctx.fillStyle = 'rgba(160,170,178,.9)'; ctx.fillRect(RIM.x * k - bw / 2, by - k * 0.36, bw, k * 0.1)
    // the bracket to the rim
    ctx.fillStyle = '#d0581f'; ctx.fillRect(rx - k * 0.14, by, k * 0.28, ry - r - by + k * 0.05)
    // the net: from the rim down to its narrower mouth (lower on the screen: it hangs toward the camera's foot)
    const ny = ry + k * 0.95, nr = r * 0.55
    ctx.strokeStyle = 'rgba(246,246,240,.9)'; ctx.lineWidth = Math.max(1, k * 0.07)
    ctx.beginPath()
    for (let j = 0; j < 12; j++) { const a = j / 12 * 6.283, b = a + 0.5; ctx.moveTo(rx + Math.cos(a) * r, ry + Math.sin(a) * r * 0.92); ctx.lineTo(rx + Math.cos(b) * nr, ny + Math.sin(b) * nr * 0.7) }
    ctx.stroke()
    ctx.beginPath(); ctx.ellipse(rx, (ry + ny) / 2, (r + nr) / 2, (r + nr) / 2 * 0.8, 0, 0, 6.283); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(rx, ny, nr, nr * 0.7, 0, 0, 6.283); ctx.stroke()
  }
  if (part !== 'back') {
    // the rim
    ctx.lineWidth = Math.max(2.5, k * 0.2); ctx.strokeStyle = INK
    ctx.beginPath(); ctx.arc(rx, ry, r, 0, 6.283); ctx.stroke()
    ctx.lineWidth = Math.max(1.6, k * 0.13); ctx.strokeStyle = '#ef6a24'
    ctx.beginPath(); ctx.arc(rx, ry, r, 0, 6.283); ctx.stroke()
  }
}

// The hoop's shadow on the floor (drawn with the floor, under everything): the sun is the one the men's shadows
// show (high, a touch from the top left), so a thing 10 ft up throws its shadow most of a foot down and right of
// where it stands. The arm, the board, the rim (a ring) and the net (a thin shade); the rim's moves with a dunk
export function drawHoopShadow(ctx, k, sway = null) {
  const sx = 0.055, sy = 0.085                     // ft of shadow offset per ft of height
  const off = h => [h * sx * k, h * sy * k]
  const [ax, ay] = off(10.5), [bx, by] = off(12), [rx0, ry0] = off(10)
  const by0 = C.board.y * k, bw = C.board.w * k
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,.24)'
  ctx.beginPath()
  // the arm (from the pole behind the baseline) and the board, one shape so they don't darken where they meet
  ctx.rect(RIM.x * k - k * 0.22 + ax, (C.minY - 2.1) * k + ay, k * 0.44, by0 - (C.minY - 2.1) * k - k * 0.3)
  ctx.rect(RIM.x * k - bw / 2 + bx, by0 - k * 0.36 + by, bw, k * 0.42)
  ctx.fill()
  const rx = RIM.x * k + (sway?.[0] || 0) + rx0, ry = RIM.y * k + (sway?.[1] || 0) + ry0, r = C.rimR * k * RIM_DRAW
  // the net: a faint shade inside the ring, out to where the net's own shadow falls
  ctx.fillStyle = 'rgba(0,0,0,.1)'
  ctx.beginPath(); ctx.ellipse(rx + k * 0.05, ry + k * 0.12, r * 0.95, r * 1.05, 0, 0, 6.283); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.26)'; ctx.lineWidth = Math.max(1.6, k * 0.16)
  ctx.beginPath(); ctx.arc(rx, ry, r, 0, 6.283); ctx.stroke()
  ctx.restore()
}
