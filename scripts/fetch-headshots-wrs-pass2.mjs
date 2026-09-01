// Second pass for WR legends not found in first run — try alternative names and ESPN overrides
// Run: node scripts/fetch-headshots-wrs-pass2.mjs

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_DIR   = path.join(ROOT, 'public', 'headshots')
const MAP_FILE  = path.join(ROOT, 'src', 'data', 'headshots.json')

// name-in-headshots.json → Sleeper search name (or null to skip Sleeper) + ESPN ID override (or null)
const OVERRIDES = [
  // Name to use in headshots.json         Sleeper search name       ESPN numeric ID (null = search)
  ['Chad Ochocinco',   'Chad Johnson',        null],
  ['Michael Irvin',    'Michael Irvin',       '339'],    // ESPN ID for Michael Irvin
  ['Hines Ward',       'Hines Ward',          null],
  ['John Stallworth',  'John Stallworth',     null],
  ['Lynn Swann',       'Lynn Swann',          null],
  ['Steve Largent',    'Steve Largent',       null],
  ['Ed McCaffrey',     'Ed McCaffrey',        null],
  ['Herman Moore',     'Herman Moore',        null],
  ['Sterling Sharpe',  'Sterling Sharpe',     null],
  ['Donald Driver',    'Donald Driver',       null],
  ['Eric Moulds',      'Eric Moulds',         null],
  ['Lee Evans',        'Lee Evans',           null],
  ['Muhsin Muhammad',  'Muhsin Muhammad',     null],
  ['Willie Gault',     'Willie Gault',        null],
  ['Isaac Bruce',      'Isaac Bruce',         null],
  ['Torry Holt',       'Torry Holt',          null],
  ['Mark Duper',       'Mark Duper',          null],
  ['Mark Clayton',     'Mark Clayton',        null],
  ['Plaxico Burress',  'Plaxico Burress',     null],
  ['Amani Toomer',     'Amani Toomer',        null],
  ['Wayne Chrebet',    'Wayne Chrebet',       null],
  ['Harold Carmichael','Harold Carmichael',   null],
  ['Mike Quick',       'Mike Quick',          null],
  ['Louis Lipps',      'Louis Lipps',         null],
  ['Dwight Clark',     'Dwight Clark',        null],
  ['Brian Blades',     'Brian Blades',        null],
  ['Joey Galloway',    'Joey Galloway',       null],
  ['Art Monk',         'Art Monk',            null],
  ['Gary Clark',       'Gary Clark',          null],
  ['Ernest Givins',    'Ernest Givins',       null],
  ['Haywood Jeffires', 'Haywood Jeffires',    null],
  // Very old (ESPN page may exist but no headshot image)
  ['Keenan McCardell', 'Keenan McCardell',    null],
  ['Webster Slaughter','Webster Slaughter',   null],
  ['Don Maynard',      'Don Maynard',         null],
  ['Al Toon',          'Al Toon',             null],
  ['Cliff Branch',     'Cliff Branch',        null],
  ['Fred Biletnikoff', 'Fred Biletnikoff',    null],
  ['Lance Alworth',    'Lance Alworth',       null],
  ['Charlie Joiner',   'Charlie Joiner',      null],
  ['Wes Chandler',     'Wes Chandler',        null],
  ['Ahmad Rashad',     'Ahmad Rashad',        null],
  ['Otis Taylor',      'Otis Taylor',         null],
  ['Chris Collinsworth','Chris Collinsworth', null],
  ['James Lofton',     'James Lofton',        null],
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

  console.log('Fetching Sleeper player list...')
  const players = await fetchJSON('https://api.sleeper.app/v1/players/nfl')
  const byName = new Map()
  for (const [id, p] of Object.entries(players)) {
    if (p.full_name) byName.set(normalize(p.full_name), { id, ...p })
  }

  const added = {}
  const failed = []

  for (const [jsonName, searchName, espnIdOverride] of OVERRIDES) {
    if (existing[jsonName]) {
      console.log(`  (skip) ${jsonName} — already in headshots.json`)
      continue
    }

    const key = normalize(searchName)
    const sleeperMatch = byName.get(key)

    if (sleeperMatch) {
      const sleeperId = sleeperMatch.id
      const dest = path.join(OUT_DIR, `${sleeperId}.jpg`)
      if (!fs.existsSync(dest)) {
        try {
          await downloadImg(`https://sleepercdn.com/content/nfl/players/${sleeperId}.jpg`, dest)
          console.log(`  ✓ ${jsonName} → ${sleeperId}.jpg (Sleeper)`)
          added[jsonName] = sleeperId
          continue
        } catch (e) {
          console.log(`  ~ ${jsonName} Sleeper image failed, trying ESPN...`)
        }
      } else {
        console.log(`  (cached) ${jsonName} → ${sleeperId}.jpg`)
        added[jsonName] = sleeperId
        continue
      }
    }

    // Try ESPN override ID first
    const espnId = espnIdOverride ?? await findESPNId(searchName)
    if (!espnId) {
      console.log(`  ✗ ${jsonName} — not found`)
      failed.push(jsonName)
      continue
    }
    const espnKey = `espn_${espnId}`
    const dest = path.join(OUT_DIR, `${espnKey}.jpg`)
    if (!fs.existsSync(dest)) {
      try {
        await downloadImg(`https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`, dest)
        console.log(`  ✓ ${jsonName} → ${espnKey}.jpg (ESPN)`)
        added[jsonName] = espnKey
      } catch (e) {
        console.log(`  ✗ ${jsonName} — ESPN download failed (${e.message})`)
        failed.push(jsonName)
      }
    } else {
      console.log(`  (cached) ${jsonName} → ${espnKey}.jpg`)
      added[jsonName] = espnKey
    }
  }

  const updated = { ...existing, ...added }
  fs.writeFileSync(MAP_FILE, JSON.stringify(updated, null, 2))

  console.log(`\nDone. Added ${Object.keys(added).length} more WRs to headshots.json`)
  if (failed.length) {
    console.log('Still not found:')
    failed.forEach(n => console.log(`  - ${n}`))
  }
}

main().catch(err => { console.error(err.message); process.exit(1) })
