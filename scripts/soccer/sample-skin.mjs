// Skin tone for the Champions League players added on 2026-11-16 (the figure's face and arms), the same way the
// rest of the pool got theirs (data/soccer-strikers.js header): scripts/extract-nba-skin-colors.mjs's sampler on the
// ESPN headshot or, with no ESPN photo, on the FotMob player cut-out, read in memory and never stored, then snapped
// to the nearest skin swatch used in data/nba-*.js.
// node scripts/soccer/sample-skin.mjs      -> scripts/soccer/ucl-skin.json { fotmobId: '#rrggbb' } (grade-nine.mjs reads it)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Jimp } = require('jimp')
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'scripts', 'soccer', 'ucl-skin.json')
const ADD = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'soccer', 'ucl-additions.json'), 'utf8'))
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }

// the swatches: every skin value in the NBA rosters
const SW = new Set()
for (const f of fs.readdirSync(path.join(ROOT, 'src', 'data')).filter(f => /^nba-.*\.js$/.test(f))) {
  for (const m of fs.readFileSync(path.join(ROOT, 'src', 'data', f), 'utf8').matchAll(/'(#[0-9a-fA-F]{6})'/g)) SW.add(m[1].toLowerCase())
}
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const SWATCHES = [...SW].map(h => [h, rgb(h)]).filter(([, [r, g, b]]) => r > g && g >= b * 0.6 && r - b > 20)
const snap = hex => { const [r, g, b] = rgb(hex); let best = null, bd = 1e9; for (const [h, [R, G, B]] of SWATCHES) { const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < bd) { bd = d; best = h } } return best }

// the sampler from scripts/extract-nba-skin-colors.mjs (face region x 20-80%, y 5-55%, flesh-tone pixels averaged)
function isSkinTone(r, g, b) {
  if (r < 60) return false
  if (r < g || r < b) return false
  if (g < b * 0.5) return false
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (min > 210 && max - min < 25) return false
  const sat = max === 0 ? 0 : (max - min) / max
  if (sat < 0.06 || sat > 0.80) return false
  return true
}
async function sample(buf) {
  const img = await Jimp.read(buf)
  const w = img.bitmap.width, h = img.bitmap.height
  let R = 0, G = 0, B = 0, n = 0
  for (let y = Math.floor(h * 0.05); y < Math.floor(h * 0.55); y += 3) for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x += 3) {
    const c = img.getPixelColor(x, y), r = (c >> 24) & 255, g = (c >> 16) & 255, b = (c >> 8) & 255, a = c & 255
    if (a > 200 && isSkinTone(r, g, b)) { R += r; G += g; B += b; n++ }
  }
  if (n < 8) return null
  return '#' + [R, G, B].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('')
}
async function grab(url) { const res = await fetch(url, { headers: UA }); return res.ok ? Buffer.from(await res.arrayBuffer()) : null }

const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
let n = 0, miss = []
for (const c of Object.values(ADD.clubs)) for (const a of c.added) {
  if (out[a.fotmob]) continue
  let hex = null
  if (a.espn) { const b = await grab(`https://a.espncdn.com/i/headshots/soccer/players/full/${a.espn}.png`); if (b && b.length > 6000) hex = await sample(b).catch(() => null) }
  if (!hex) { const b = await grab(`https://images.fotmob.com/image_resources/playerimages/${a.fotmob}.png`); if (b && b.length > 3000) hex = await sample(b).catch(() => null) }
  if (hex) { out[a.fotmob] = snap(hex); n++ } else miss.push(a.name)
  await new Promise(r => setTimeout(r, 400))
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`${n} sampled, ${miss.length} without a usable photo: ${miss.join(', ')}`)
