// Fetch headshots for missing OPOY pool players (classic WRs + all-time RBs/WRs)
// Run once: node scripts/fetch-headshots-opoy.mjs
// Patches src/data/headshots.json and saves images to public/headshots/

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_DIR   = path.join(ROOT, 'public', 'headshots')
const MAP_FILE  = path.join(ROOT, 'src', 'data', 'headshots.json')

const OPOY_NAMES = [
  // Classic OPOY WRs
  'Justin Jefferson',
  "Ja'Marr Chase",
  'Puka Nacua',
  // All-time OPOY RBs
  'Barry Sanders',
  'Emmitt Smith',
  'LaDainian Tomlinson',
  'Walter Payton',
  'Adrian Peterson',
  'Eric Dickerson',
  // All-time OPOY WRs
  'Jerry Rice',
  'Randy Moss',
  'Calvin Johnson',
  'Julio Jones',
]

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[.''`]/g, '')
    .replace(/\s+jr\.?\s*$/i, '')
    .replace(/\s+sr\.?\s*$/i, '')
    .replace(/\s+ii\s*$/i, '')
    .replace(/\s+iii\s*$/i, '')
    .trim()
}

function get(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'build-a-player/1.0' }, ...opts }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, opts).then(resolve, reject)
      }
      resolve(res)
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')) })
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
      if (res.statusCode === 404 || res.statusCode === 403) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', err => { try { fs.unlinkSync(dest) } catch {} reject(err) })
    } catch (e) { reject(e) }
  })
}

async function findESPNId(name) {
  const encoded = encodeURIComponent(name)
  const url = `https://site.api.espn.com/apis/common/v3/search?query=${encoded}&limit=5&type=player&sport=football&league=nfl`
  try {
    const data = await fetchJSON(url)
    const items = data?.items ?? []
    for (const item of items) {
      if (item.type === 'player' && item.id) return String(item.id)
    }
    return null
  } catch { return null }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const existing = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
  const alreadyDone = new Set(Object.keys(existing))

  console.log('Fetching Sleeper player list (~4 MB)...')
  const players = await fetchJSON('https://api.sleeper.app/v1/players/nfl')
  console.log(`Loaded ${Object.keys(players).length} total players`)

  const byName = new Map()
  for (const [id, p] of Object.entries(players)) {
    if (p.full_name) {
      byName.set(normalize(p.full_name), { id, ...p })
    }
  }

  const added = {}
  const failed = []

  for (const name of OPOY_NAMES) {
    if (alreadyDone.has(name)) {
      console.log(`  (skip) ${name} — already in headshots.json`)
      continue
    }

    const key = normalize(name)
    let sleeperMatch = byName.get(key)

    if (!sleeperMatch) {
      const parts = key.split(/\s+/)
      if (parts.length >= 2) {
        for (const [k, v] of byName) {
          if (k.startsWith(parts[0][0]) && k.endsWith(parts[parts.length - 1])) {
            sleeperMatch = v
            break
          }
        }
      }
    }

    if (sleeperMatch) {
      const sleeperId = sleeperMatch.id
      const dest = path.join(OUT_DIR, `${sleeperId}.jpg`)
      if (!fs.existsSync(dest)) {
        try {
          await downloadImg(`https://sleepercdn.com/content/nfl/players/${sleeperId}.jpg`, dest)
          console.log(`  ✓ ${name} → ${sleeperId}.jpg (Sleeper)`)
          added[name] = sleeperId
          continue
        } catch (e) {
          console.log(`  ~ ${name} Sleeper image failed (${e.message}), trying ESPN...`)
        }
      } else {
        console.log(`  (cached) ${name} → ${sleeperId}.jpg`)
        added[name] = sleeperId
        continue
      }
    }

    // ESPN fallback
    const espnId = await findESPNId(name)
    if (!espnId) {
      console.log(`  ✗ ${name} — not found anywhere`)
      failed.push(name)
      continue
    }
    const espnKey = `espn_${espnId}`
    const dest = path.join(OUT_DIR, `${espnKey}.jpg`)
    if (!fs.existsSync(dest)) {
      try {
        await downloadImg(`https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`, dest)
        console.log(`  ✓ ${name} → ${espnKey}.jpg (ESPN ${espnId})`)
        added[name] = espnKey
      } catch (e) {
        console.log(`  ✗ ${name} — ESPN download failed (${e.message})`)
        failed.push(name)
      }
    } else {
      console.log(`  (cached) ${name} → ${espnKey}.jpg`)
      added[name] = espnKey
    }
  }

  const updated = { ...existing, ...added }
  fs.writeFileSync(MAP_FILE, JSON.stringify(updated, null, 2))

  console.log(`\nDone. Added ${Object.keys(added).length} players to headshots.json`)
  if (failed.length) {
    console.log('No headshot found for:')
    failed.forEach(n => console.log(`  - ${n}`))
  }
}

main().catch(err => { console.error(err.message); process.exit(1) })
