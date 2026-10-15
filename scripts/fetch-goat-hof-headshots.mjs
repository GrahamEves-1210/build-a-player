// One-time: Hall of Fame portraits for the post-2000 players on the football GOAT
// lists that ESPN has no photo for (mostly players who retired before ~2010).
// Source: the Pro Football Hall of Fame's own site (profootballhof.com, on the
// NFL's image CDN) — no Wikipedia. Each player's page lists his portrait; we take
// the wide version and cut a square around his face.
// node scripts/fetch-goat-hof-headshots.mjs        then npm run build (→ webp)

import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { NFL_GOAT } from '../src/data/nfl-goat.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'headshots.json')
const headshots = JSON.parse(fs.readFileSync(MAP, 'utf8'))
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

const get = (url, asBuffer = false) => new Promise((resolve, reject) => {
  const req = https.get(url, { headers: { 'User-Agent': UA } }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return get(new URL(res.headers.location, url).href, asBuffer).then(resolve, reject)
    const chunks = []
    res.on('data', c => chunks.push(c))
    res.on('end', () => resolve({ status: res.statusCode, body: asBuffer ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8') }))
  })
  req.on('error', reject)
  req.setTimeout(20000, () => req.destroy(new Error('timeout')))
})

const hasFile = id => id && ['webp', 'jpg', 'png'].some(ext => fs.existsSync(path.join(OUT, id.includes('.') ? id : `${id}.${ext}`)))
const slugOf = name => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-')

const want = Object.values(NFL_GOAT).flat().filter(g => {
  const last = g.years.split('–')[1]
  return (last ? +last : 2026) >= 2000 && !hasFile(headshots[g.name])
})

const report = []
for (const g of want) {
  const slug = slugOf(g.name)
  const page = await get(`https://www.profootballhof.com/players/${slug}/`)
  const id = page.status === 200 && page.body.match(/og:image" content="[^"]*\/hof\/([a-z0-9]+)"/)?.[1]
  if (!id) { report.push(`✗ ${g.name}: no Hall of Fame portrait (page HTTP ${page.status})`); continue }
  const img = await get(`https://static.clubs.nfl.com/image/upload/t_ratio16_9-size60-f_webp-c_fill/hof/${id}`, true)
  if (img.status !== 200 || img.body.length < 8000) { report.push(`✗ ${g.name}: portrait HTTP ${img.status}`); continue }
  // the wide portrait has him in the middle: a square from the centre, a touch high
  // (faces sit in the upper half), at the size the other headshots use
  const { width: W, height: H } = await sharp(img.body).metadata()
  const side = Math.min(W, H)
  const left = Math.round((W - side) / 2), top = 0
  const file = `hof_${slug.replace(/-/g, '')}`
  await sharp(img.body).extract({ left, top, width: side, height: side }).resize(360, 360).jpeg({ quality: 86 }).toFile(path.join(OUT, `${file}.jpg`))
  headshots[g.name] = file
  report.push(`✓ ${g.name} → ${file}`)
}
fs.writeFileSync(MAP, JSON.stringify(headshots, null, 2) + '\n')
console.log(report.join('\n'))
console.log(`${report.filter(r => r.startsWith('✓')).length} of ${want.length} found. Run npm run build to convert to webp.`)
