#!/usr/bin/env node
// Fetches headshots for GOAT list legends via ESPN search API.
// Run: node scripts/fetch-goat-headshots.mjs

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_DIR   = path.join(ROOT, 'public', 'headshots', 'nba')
const JSON_OUT  = path.join(ROOT, 'src', 'data', 'nba-headshots.json')

fs.mkdirSync(OUT_DIR, { recursive: true })

// Skip truly old-era players with no ESPN headshot assets
const LEGENDS = [
  'Michael Jordan',
  'Kobe Bryant',
  'Shaquille O\'Neal',
  'Tim Duncan',
  'Dirk Nowitzki',
  'Kevin Garnett',
  'Charles Barkley',
  'Hakeem Olajuwon',
  'Magic Johnson',
  'Kareem Abdul-Jabbar',
  'Larry Bird',
  'Julius Erving',
  'Moses Malone',
  'David Robinson',
  'Karl Malone',
  'John Stockton',
  'Kevin Durant',
  'Giannis Antetokounmpo',
  'Stephen Curry',
  'LeBron James',
]

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'build-a-bucket/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve, reject)
      }
      resolve(res)
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(new Error('timeout')) })
  })
}

function fetchJSON(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await get(url)
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(e) }
      })
      res.on('error', reject)
    } catch (e) { reject(e) }
  })
}

function downloadImg(url, dest) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await get(url)
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', err => { try { fs.unlinkSync(dest) } catch {} reject(err) })
    } catch (e) { reject(e) }
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function searchPlayer(name) {
  const encoded = encodeURIComponent(name)
  const url = `https://site.api.espn.com/apis/common/v3/search?query=${encoded}&limit=5&type=player&sport=basketball&league=nba`
  try {
    const data = await fetchJSON(url)
    const hit = (data?.items ?? []).find(i => i.type === 'player' && i.id)
    return hit ? String(hit.id) : null
  } catch {
    return null
  }
}

async function main() {
  console.log('=== GOAT Headshot Fetcher ===\n')

  const existing = JSON.parse(fs.readFileSync(JSON_OUT, 'utf8'))

  for (const name of LEGENDS) {
    // Check if we already have this player's headshot file on disk
    if (existing[name]) {
      const dest = path.join(OUT_DIR, `${existing[name]}.jpg`)
      if (fs.existsSync(dest)) {
        console.log(`  ✓ ${name} (cached)`)
        continue
      }
    }

    process.stdout.write(`  Searching ${name}… `)
    const id = await searchPlayer(name)
    await sleep(150)

    if (!id) {
      console.log('not found in ESPN search')
      continue
    }

    const dest = path.join(OUT_DIR, `${id}.jpg`)
    if (fs.existsSync(dest)) {
      existing[name] = id
      console.log(`✓ id=${id} (file cached)`)
      continue
    }

    const url = `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`
    try {
      await downloadImg(url, dest)
      existing[name] = id
      console.log(`✓ id=${id} downloaded`)
    } catch (e) {
      console.log(`✗ id=${id} — ${e.message}`)
    }
    await sleep(100)
  }

  fs.writeFileSync(JSON_OUT, JSON.stringify(existing, null, 2))
  console.log('\n✓ Updated nba-headshots.json')
  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
