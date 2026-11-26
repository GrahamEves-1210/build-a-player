// BLACKTOP LIVE: the floor. The court pictures in the shop (public/court-*.webp, public/courts/*) are 56 x 42 ft of
// asphalt, all with the same painted lines, but those lines aren't a real court's (a short lane, a three-point line
// 26 ft out at the top, no restricted area, the hoop on the baseline). So the picture is used for its surface only:
// its own lines and hoop are painted out (each line's pixels replaced by the asphalt mirrored from beside it), the
// picture is carried on down to half court (51.6 ft: tune.js COURT), and a real NBA half court is painted on it from
// the same numbers the game plays by, in worn white paint. The hoop is drawn on the game's canvas (drawHoop), in among
// the men, so a man under the rim is under it and a man in front of it is over it.
import { COURT } from '../../lib/btlive/index.js'

const C = COURT, RIM = C.rim
// the shop pictures' own lines, in the picture's pixels (1451 x 1084: measured; every court has the same ones)
const OLD = {
  w: 1451,
  side: [79, 1373], base: 61, half: 1026,
  lane: [552, 896], ft: 482, corner: [186.5, 1264.5], cornerTo: 433,
  ftC: [724.5, 481.5, 148, 161], arc: [725.5, 221.5, 569.5], halfC: [725.5, 1027, 128.5],
  hash: [214.5, 236.5, 304.5, 374.5], hashX: [[523, 553], [895, 925]],
  // (the free-throw circle's dashed top half is drawn a little taller than round: ftC's last number)
  hoop: [628, 48, 822, 178],          // the backboard, rim and net (x0, y0, x1, y1)
}
const BAND = 11                       // px either side of an old line's middle that are painted out

// a seeded roll (the wear in the paint is the same every game)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

// Paint out the picture's lines: every pixel within BAND of one is replaced by the pixel mirrored across the band's
// edge on its own side (the asphalt's grain carries on through), walking on past any other line it lands in
function eraseOld(cv, sc) {
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const W = cv.width, H = cv.height, img = ctx.getImageData(0, 0, W, H), d = img.data
  const mask = new Uint8Array(W * H), NX = new Float32Array(W * H), NY = new Float32Array(W * H), DC = new Float32Array(W * H)
  const B = BAND * sc
  const mark = (x, y, nx, ny, dc) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; mask[i] = 1; NX[i] = nx; NY[i] = ny; DC[i] = dc }
  // a straight line (vertical or horizontal) from a to b at c
  const vline = (x, y0, y1) => { x *= sc; for (let y = Math.floor(y0 * sc - B); y <= y1 * sc + B; y++) for (let px = Math.floor(x - B); px <= x + B; px++) { const dx = px - x; mark(px, y, dx >= 0 ? 1 : -1, 0, Math.abs(dx)) } }
  const hline = (y, x0, x1) => { y *= sc; for (let py = Math.floor(y - B); py <= y + B; py++) for (let x = Math.floor(x0 * sc - B); x <= x1 * sc + B; x++) { const dy = py - y; mark(x, py, 0, dy >= 0 ? 1 : -1, Math.abs(dy)) } }
  // a circle, or an ellipse up top (ry: its height above the middle), only where keep(y) says
  const circ = (cx, cy, r, keep = () => true, ry = r) => {
    cx *= sc; cy *= sc; r *= sc; ry *= sc
    for (let y = Math.floor(cy - ry - B); y <= cy + r + B; y++) {
      if (!keep(y / sc)) continue
      const rv = y < cy ? ry : r
      for (let x = Math.floor(cx - r - B); x <= cx + r + B; x++) {
        const dx = x - cx, dy = (y - cy) * r / rv, l = Math.hypot(dx, dy) || 1, dc = l - r
        if (Math.abs(dc) <= B) mark(x, y, dx / l * (dc >= 0 ? 1 : -1), dy / l * (dc >= 0 ? 1 : -1), Math.abs(dc))
      }
    }
  }
  const O = OLD
  for (const x of O.side) vline(x, O.base, O.half)
  hline(O.base, O.side[0], O.side[1]); hline(O.half, O.side[0], O.side[1])
  for (const x of O.lane) vline(x, O.base, O.ft)
  hline(O.ft, O.lane[0], O.lane[1])
  for (const x of O.corner) vline(x, O.base, O.cornerTo + 8)
  circ(O.ftC[0], O.ftC[1], O.ftC[2], undefined, O.ftC[3])
  circ(O.arc[0], O.arc[1], O.arc[2], y => y >= O.cornerTo - 12)
  circ(O.halfC[0], O.halfC[1], O.halfC[2], y => y <= O.half + 10)
  for (const y of O.hash) for (const [x0, x1] of O.hashX) hline(y, x0, x1)
  // fill: mirrored across the band's edge (along the line's normal, or failing that the nearest clear way), so the
  // grain carries on through; where two lines cross it walks on past both
  const src = new Uint8ClampedArray(d)
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]]
  const clear = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !mask[y * W + x]
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    if (!mask[i]) continue
    let best = 1e9, bx = 0, by = 0
    const tryDir = (nx, ny, max) => {
      for (let t = 1; t < Math.min(best, max); t++) {
        const qx = Math.round(x + nx * t), qy = Math.round(y + ny * t)
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) return
        if (!mask[qy * W + qx]) {
          // mirrored about the edge: as far past it as he is inside it
          const mx = Math.round(x + nx * (2 * t - 1)), my = Math.round(y + ny * (2 * t - 1))
          best = t; if (clear(mx, my)) { bx = mx; by = my } else { bx = qx; by = qy }
          return
        }
      }
    }
    tryDir(NX[i], NY[i], 4 * B)
    if (best > 2 * B + 2) for (const [nx, ny] of DIRS) tryDir(nx, ny, 6 * B)
    if (best >= 1e9) continue
    const j = (by * W + bx) * 4, k = i * 4
    d[k] = src[j]; d[k + 1] = src[j + 1]; d[k + 2] = src[j + 2]
  }
  ctx.putImageData(img, 0, 0)
  // the old hoop (backboard, rim, net): the lane's floor from just below it, laid over it, feathered at the edges
  const [x0, y0, x1, y1] = O.hoop.map(v => v * sc), hw = x1 - x0, hh = y1 - y0, off = hh + 10 * sc
  const patch = document.createElement('canvas'); patch.width = Math.ceil(hw); patch.height = Math.ceil(hh)
  const pc = patch.getContext('2d')
  pc.drawImage(cv, x0, y0 + off, hw, hh, 0, 0, hw, hh)
  pc.globalCompositeOperation = 'destination-in'
  const g = pc.createLinearGradient(0, 0, hw, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.12, '#000'); g.addColorStop(0.88, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)')
  pc.fillStyle = g; pc.fillRect(0, 0, hw, hh)
  ctx.drawImage(patch, x0, y0)
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

// The floor from a shop picture (a loaded <img>): a canvas C.W x C.H ft, at the picture's own pixels a foot
export function paintCourt(img) {
  const px = img.naturalWidth / C.W, sc = img.naturalWidth / OLD.w
  const W = img.naturalWidth, H0 = img.naturalHeight, H = Math.round(C.H * px)
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H0
  cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0)
  eraseOld(cv, sc)
  const out = document.createElement('canvas'); out.width = W; out.height = H
  const ctx = out.getContext('2d')
  ctx.drawImage(cv, 0, 0)
  // on down to half court and past it: the floor from just inside the picture's old half-court line, mirrored (the
  // surface carries on with no seam; the picture's own strip of apron under that line goes)
  const cut = Math.round((OLD.half - 14) * sc), ext = H - cut
  if (ext > 0) { ctx.save(); ctx.translate(0, cut * 2); ctx.scale(1, -1); ctx.drawImage(cv, 0, cut - ext, W, ext, 0, cut - ext, W, ext); ctx.restore() }
  paintLines(ctx, px, W, H)
  return out
}

// The hoop, on the game's canvas (k: px a foot), drawn from above: the stanchion's arm out over the baseline, the
// backboard 4 ft in, the rim 15 in out from it, the net hanging under it. sway: the rim's offset (a dunk), [x, y] px
export function drawHoop(ctx, k, sway = null, part = 'all') {
  const rx = RIM.x * k + (sway?.[0] || 0), ry = RIM.y * k + (sway?.[1] || 0), r = C.rimR * k * 1.1, by = C.board.y * k, bw = C.board.w * k
  const INK = 'rgba(8,10,12,.9)'
  if (part !== 'front') {
    // the arm, from the pole behind the baseline to the board
    ctx.fillStyle = '#3a3f44'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, k * 0.08)
    ctx.beginPath(); ctx.rect(RIM.x * k - k * 0.22, (C.minY - 2.1) * k, k * 0.44, by - (C.minY - 2.1) * k - k * 0.3); ctx.fill(); ctx.stroke()
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
