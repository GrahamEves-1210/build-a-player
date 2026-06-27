// Fetch headshots for All-Time legends from Sleeper (primary) then ESPN (fallback).
// Run once: node scripts/fetch-headshots-legends.mjs
// Patches src/data/headshots.json and saves images to public/headshots/

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_DIR   = path.join(ROOT, 'public', 'headshots')
const MAP_FILE  = path.join(ROOT, 'src', 'data', 'headshots.json')

// All unique legend names from legends.js that aren't already in the classic pool
const LEGEND_NAMES = [
  // ARI
  'Kurt Warner', 'Carson Palmer', 'Jim Hart',
  // ATL
  'Matt Ryan', 'Michael Vick', 'Steve Bartkowski',
  // BAL
  'Joe Flacco', 'Trent Dilfer', 'Steve McNair',
  // BUF
  'Jim Kelly', 'Drew Bledsoe',
  // CAR
  'Cam Newton', 'Jake Delhomme', 'Kerry Collins',
  // CHI
  'Sid Luckman', 'Jim McMahon', 'Jay Cutler',
  // CIN
  'Ken Anderson', 'Boomer Esiason',
  // CLE
  'Otto Graham', 'Bernie Kosar',
  // DAL
  'Roger Staubach', 'Troy Aikman', 'Tony Romo',
  // DEN
  'John Elway', 'Peyton Manning', 'Jake Plummer',
  // DET
  'Bobby Layne',
  // GB
  'Brett Favre', 'Bart Starr',
  // HOU
  'Matt Schaub',
  // IND
  'Andrew Luck', 'Johnny Unitas',
  // JAX
  'Mark Brunell',
  // KC
  'Joe Montana', 'Alex Smith',
  // LV
  'Ken Stabler', 'Jim Plunkett', 'Rich Gannon',
  // LAC
  'Dan Fouts', 'Philip Rivers',
  // LAR
  'Roman Gabriel',
  // MIA
  'Dan Marino', 'Bob Griese', 'Ryan Tannehill',
  // MIN
  'Fran Tarkenton', 'Daunte Culpepper',
  // NO
  'Drew Brees', 'Archie Manning', 'Bobby Hebert',
  // NYG
  'Eli Manning', 'Phil Simms', 'Y.A. Tittle',
  // NYJ
  'Joe Namath', 'Vinny Testaverde', 'Mark Sanchez', 'Chad Pennington',
  // PHI
  'Randall Cunningham', 'Donovan McNabb', 'Nick Foles',
  // PIT
  'Terry Bradshaw', 'Ben Roethlisberger', 'Kordell Stewart',
  // SF
  'Steve Young', 'Jeff Garcia',
  // SEA
  'Matt Hasselbeck', 'Jim Zorn',
  // TB
  'Tom Brady', 'Brad Johnson',
  // TEN
  'Warren Moon', 'Vince Young',
  // WAS
  'Sammy Baugh', 'Joe Theismann', 'Sonny Jurgensen',
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

  // Load existing mapping
  const existing = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
  const alreadyDone = new Set(Object.keys(existing))

  // Load Sleeper player list (covers retired players)
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

  for (const name of LEGEND_NAMES) {
    if (alreadyDone.has(name)) {
      console.log(`  (skip) ${name} — already in headshots.json`)
      continue
    }

    const key = normalize(name)
    let sleeperMatch = byName.get(key)

    // fuzzy: try last-name-only + first initial if full name fails
    if (!sleeperMatch) {
      const parts = key.split(/\s+/)
      if (parts.length >= 2) {
        const shortKey = parts[0][0] + ' ' + parts[parts.length - 1]
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

  // Patch headshots.json
  const updated = { ...existing, ...added }
  fs.writeFileSync(MAP_FILE, JSON.stringify(updated, null, 2))

  console.log(`\nDone. Added ${Object.keys(added).length} legends to headshots.json`)
  if (failed.length) {
    console.log('No headshot found for:')
    failed.forEach(n => console.log(`  - ${n}`))
  }
}

main().catch(err => { console.error(err.message); process.exit(1) })
