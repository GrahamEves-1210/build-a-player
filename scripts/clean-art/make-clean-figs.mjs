// The clean build's Home figures (public/modes/clean/fig-*.webp): the same art as public/modes/fig-*.webp with the
// teams' marks painted out (helmet logos, sleeve logos, a wordmark on the chest), filled from the cloth round each
// one so the shading carries through. The originals are untouched; lib/appArt.js swaps them in the clean build only.
// node scripts/clean-art/make-clean-figs.mjs   (needs sharp from node_modules)
import sharp from 'sharp'
import { mkdirSync } from 'fs'

// [cx, cy, rx, ry, mask] in the art's own pixels (mask: the patch runs into the facemask, whose black is kept)
const MARKS = {
  'fig-qb':  [[163, 28, 22, 24, true], [279, 113, 17, 13]],   // fleur-de-lis on the helmet, the B on the sleeve
  'fig-qb2': [[168, 29, 23, 24, true], [280, 112, 17, 10]],   // falcon on the helmet, raven on the sleeve
  'fig-wr':  [[132, 180, 25, 9]],                        // the team's name over the number
}
mkdirSync('public/modes/clean', { recursive: true })
for (const [name, marks] of Object.entries(MARKS)) {
  const { data, info } = await sharp(`public/modes/${name}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const hole = new Uint8Array(W * H)
  const lum = i => 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]
  for (const [cx, cy, rx, ry, mask = false] of marks) {
    const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
    // (the facemask's black stays: dark pixels joined to dark outside the patch, when the patch runs into one)
    const keep = new Set()
    if (mask) {
      const dark = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 8 && lum(y * W + x) < 40
      const todo = []
      for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) if (!inside(x, y) && dark(x, y)) todo.push([x, y])
      while (todo.length) {
        const [x, y] = todo.pop()
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy, k = Y * W + X
          if (inside(X, Y) && !keep.has(k) && dark(X, Y)) { keep.add(k); todo.push([X, Y]) }
        }
      }
    }
    for (let y = Math.max(0, cy - ry); y <= Math.min(H - 1, cy + ry); y++)
      for (let x = Math.max(0, cx - rx); x <= Math.min(W - 1, cx + rx); x++)
        if (inside(x, y) && data[(y * W + x) * 4 + 3] > 8 && !keep.has(y * W + x)) hole[y * W + x] = 1
  }
  // fill each hole from its edge inward: every pass, a hole pixel takes the mean of its known, opaque neighbours
  const known = Uint8Array.from(hole, h => 1 - h)
  for (let pass = 0; pass < 200; pass++) {
    let left = 0
    const next = known.slice()
    for (let i = 0; i < W * H; i++) {
      if (known[i]) continue
      const x = i % W, y = (i / W) | 0
      let r = 0, g = 0, b = 0, n = 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue
        const j = Y * W + X
        if (!known[j] || data[j * 4 + 3] < 200 || (!hole[j] && lum(j) < 45)) continue   // (filled from the cloth, not the facemask or an outline)
        r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2]; n++
      }
      if (n >= 2) { data[i * 4] = r / n; data[i * 4 + 1] = g / n; data[i * 4 + 2] = b / n; next[i] = 1 } else left++
    }
    known.set(next)
    if (!left) break
  }
  // and smooth the patch so the fill's streaks don't show
  for (let pass = 0; pass < 12; pass++)
    for (let i = 0; i < W * H; i++) {
      if (!hole[i]) continue
      const x = i % W, y = (i / W) | 0
      for (let c = 0; c < 3; c++) {
        let s = 0, n = 0
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * W + x + dx; if (data[j * 4 + 3] > 200 && (hole[j] || lum(j) >= 45)) { s += data[j * 4 + c]; n++ } }
        if (n) data[i * 4 + c] = (data[i * 4 + c] + s) / (n + 1)
      }
    }
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toFile(`public/modes/clean/${name}.webp`)
  console.log(name, marks.length ? 'marks painted out' : 'copied')
}
