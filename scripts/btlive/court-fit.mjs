// BLACKTOP LIVE: measure each shop court picture's own painted lines (their centres, in the picture's pixels) for
// court.js OLDS, so its lines can be painted out exactly. Prints one OLDS row a court; paste them in (a court whose
// sidelines aren't white paint gets side: null by hand). Run: node scripts/btlive/court-fit.mjs [court names...]
import { createRequire } from 'node:module'
const repo = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
const only = process.argv.slice(2)
const require = createRequire(repo + '/package.json')
const sharp = require('sharp')
const NAMES = ['court-blacktop1', ...'alley autumn carnival checker goldenhour harbor ivy marble midnight neon nightrain oldstone overcast patchwork redzone retro snow space tropic warehouse'.split(' ').map(s => 'ct-' + s)]
const REF = {
  side: [79, 1373], base: 61, half: 1026,
  lane: [552, 896], ft: 482, corner: [186.5, 1264.5],
  ftC: [724.5, 481.5, 148, 161], arc: [725.5, 221.5, 569.5], halfC: [725.5, 1027, 128.5],
  hash: [214.5, 236.5, 304.5, 374.5],
}
for (const name of NAMES) {
  if (only.length && !only.includes(name)) continue
  const file = repo + '/public/' + (name === 'court-blacktop1' ? name : 'courts/' + name) + '.webp'
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, ch = info.channels
  const wh = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2]
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b)
    wh[i] = Math.max(0, Math.min(1, (mn - 110) / 80)) * Math.max(0, Math.min(1, 1 - (mx - mn - 70) / 60))
  }
  const at = (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= W || y >= H ? 0 : wh[y * W + x] }
  // contrast of a line point: on it vs 11 px either side along the normal
  const pt = (x, y, nx, ny) => { const on = (at(x, y) + at(x + nx * 2, y + ny * 2) + at(x - nx * 2, y - ny * 2)) / 3; return on - 0.5 * Math.max(at(x + nx * 11, y + ny * 11), at(x - nx * 11, y - ny * 11)) - 0.5 * Math.min(at(x + nx * 11, y + ny * 11), at(x - nx * 11, y - ny * 11)) }
  const vS = (x, y0, y1) => { let s = 0, n = 0; for (let y = y0; y <= y1; y += 2) { s += pt(x, y, 1, 0); n++ } return s / n }
  const hS = (y, x0, x1) => { let s = 0, n = 0; for (let x = x0; x <= x1; x += 2) { s += pt(x, y, 0, 1); n++ } return s / n }
  const cS = (cx, cy, r, a0, a1, ry = r) => { let s = 0, n = 0; const st = 1.5 / r; for (let a = a0; a <= a1; a += st) { const c = Math.cos(a), sn = Math.sin(a); const rr = sn < 0 ? ry : r; s += pt(cx + c * r, cy + sn * rr, c, sn); n++ } return s / n }
  const best1 = (f, lo, hi, step = 0.5) => { let bv = -1e9, bx = lo; for (let v = lo; v <= hi; v += step) { const s = f(v); if (s > bv) { bv = s; bx = v } } return [bx, +bv.toFixed(3)] }
  const sc = W / 1451, R = v => v * sc
  const g = { w: W, q: {} }
  const q = g.q
  // sidelines and baseline, half line
  let s
  ;[g.base, q.base] = best1(y => hS(y, R(300), R(560)) + hS(y, R(880), R(1150)), R(30), R(130))
  ;[g.half, q.half] = best1(y => hS(y, R(200), R(560)) + hS(y, R(900), R(1250)), R(950), R(1060))
  const sL = best1(x => vS(x, R(500), R(900)), R(40), R(150)), sR = best1(x => vS(x, R(500), R(900)), R(1300), R(1420))
  g.side = [sL[0], sR[0]]; q.side = [sL[1], sR[1]]
  const lL = best1(x => vS(x, g.base + 40, R(440)), R(510), R(600)), lR = best1(x => vS(x, g.base + 40, R(440)), R(850), R(940))
  g.lane = [lL[0], lR[0]]; q.lane = [lL[1], lR[1]]
  ;[g.ft, q.ft] = best1(y => hS(y, g.lane[0] + 15, g.lane[1] - 15), R(420), R(540))
  const cL = best1(x => vS(x, g.base + 40, g.base + 250), R(140), R(260)), cR = best1(x => vS(x, g.base + 40, g.base + 250), R(1190), R(1320))
  g.corner = [cL[0], cR[0]]; q.corner = [cL[1], cR[1]]
  // arc: centre x near the middle, centre y and r searched (lower half, below the corners' end)
  let bv = -1e9
  for (let cx = R(712); cx <= R(738); cx += 1) for (let cy = R(140); cy <= R(320); cy += 2) for (let r = R(470); r <= R(680); r += 2) {
    // the arc must reach the corners: r >= |corner - cx|
    if (r < Math.max(cx - g.corner[0], g.corner[1] - cx)) continue
    const v = cS(cx, cy, r, 0.55, Math.PI - 0.55)
    if (v > bv) { bv = v; g.arc = [cx, cy, r] }
  }
  for (const d of [1, 0.5]) for (let it = 0; it < 3; it++) { // refine
    let [cx, cy, r] = g.arc
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) { const v = cS(cx + a * d, cy + b * d, r + c * d, 0.55, Math.PI - 0.55); if (v > bv) { bv = v; g.arc = [cx + a * d, cy + b * d, r + c * d] } }
  }
  q.arc = +bv.toFixed(3)
  // where each corner line stops (the paint on the column runs out)
  // free-throw circle: lower half solid (cx, cy, r), then the dashed top's height
  bv = -1e9
  for (let cx = R(710); cx <= R(740); cx += 1) for (let cy = g.ft - 12; cy <= g.ft + 12; cy += 1) for (let r = R(120); r <= R(175); r += 1) { const v = cS(cx, cy, r, 0.25, Math.PI - 0.25); if (v > bv) { bv = v; g.ftC = [cx, cy, r] } }
  q.ftC = +bv.toFixed(3)
  ;[s, q.ftTop] = best1(ry => cS(g.ftC[0], g.ftC[1], g.ftC[2], Math.PI + 0.35, 2 * Math.PI - 0.35, ry), g.ftC[2] - 10, g.ftC[2] + 30)
  g.ftC.push(s)
  // half-court circle (top half)
  bv = -1e9
  for (let cx = R(710); cx <= R(740); cx += 1) for (let cy = g.half - 14; cy <= g.half + 14; cy += 1) for (let r = R(100); r <= R(160); r += 1) { const v = cS(cx, cy, r, Math.PI + 0.3, 2 * Math.PI - 0.3); if (v > bv) { bv = v; g.halfC = [cx, cy, r] } }
  q.halfC = +bv.toFixed(3)
  // the lane's hash marks: peaks down the column just outside each lane line
  const hashes = []
  for (const [lx, sd] of [[g.lane[0], -1], [g.lane[1], 1]]) {
    const prof = []
    for (let y = Math.round(g.base + 60); y < g.ft - 20; y++) { let v = 0; for (let k = 6; k <= 22; k += 2) v += at(lx + sd * k, y); prof.push([y, v / 9]) }
    const pk = []
    for (let i = 3; i < prof.length - 3; i++) { const v = prof[i][1]; if (v > 0.35 && v >= prof[i - 1][1] && v >= prof[i + 1][1] && v >= prof[i - 3][1] && v >= prof[i + 3][1] && !pk.some(p => Math.abs(p - prof[i][0]) < 8)) pk.push(prof[i][0]) }
    hashes.push(pk)
  }
  g.hash = hashes
  const h = v => Math.round(v * 2) / 2
  const hs = [...g.hash[0], ...g.hash[1]].map(Math.round).sort((a, b) => a - b), H2 = []
  for (const y of hs) { if (H2.length && y - H2[H2.length - 1] < 8) H2[H2.length - 1] = (H2[H2.length - 1] + y) / 2; else H2.push(y) }
  const L = a => '[' + a.map(h).join(', ') + ']'
  console.log(`  '${name}': { w: ${W}, side: ${L(g.side)}, base: ${h(g.base)}, half: ${h(g.half)}, lane: ${L(g.lane)}, ft: ${h(g.ft)}, corner: ${L(g.corner)}, arc: ${L(g.arc)}, ftC: ${L(g.ftC)}, halfC: ${L(g.halfC)}, hash: ${L(H2)} },   // fit ${JSON.stringify(g.q)}`)
}
