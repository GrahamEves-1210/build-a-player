// PFR headshot pass for WR legends not found on Sleeper/ESPN.
// Merges into existing headshots.json (does NOT overwrite).
// Run: node scripts/fetch-headshots-wrs-pfr.mjs
//
// PFR URL: https://www.pro-football-reference.com/req/202106291/images/headshots/{id}.jpg
// ID format: Last4First2NN  (Last4=first 4 of last, First2=first 2 of first, NN=00-05)

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_DIR   = path.join(ROOT, 'public', 'headshots')
const MAP_FILE  = path.join(ROOT, 'src', 'data', 'headshots.json')

// Players still missing after Sleeper + ESPN passes
const MISSING = [
  'Eric Moulds',
  'Lee Evans',
  'Muhsin Muhammad',
  'Willie Gault',
  'Chad Ochocinco',     // PFR profile is under "Chad Johnson"
  'Michael Irvin',
  'Ed McCaffrey',
  'Herman Moore',
  'Sterling Sharpe',
  'Donald Driver',
  'Keenan McCardell',
  'Hines Ward',
  'John Stallworth',
  'Lynn Swann',
  'Steve Largent',
  'Louis Lipps',
  'Dwight Clark',
  'Brian Blades',
  'Joey Galloway',
  'Art Monk',
  'Gary Clark',
  'Ernest Givins',
  'Haywood Jeffires',
  'Webster Slaughter',
  'Don Maynard',
  'Al Toon',
  'Wayne Chrebet',
  'Harold Carmichael',
  'Mike Quick',
  'Plaxico Burress',
  'Amani Toomer',
  'Isaac Bruce',
  'Torry Holt',
  'Mark Duper',
  'Mark Clayton',
  'Cliff Branch',
  'Fred Biletnikoff',
  'Lance Alworth',
  'Charlie Joiner',
  'Wes Chandler',
  'Ahmad Rashad',
  'Otis Taylor',
  'Chris Collinsworth',
  'James Lofton',
]

// Override PFR search name for players with changed/unusual names
const PFR_NAME_OVERRIDES = {
  'Chad Ochocinco': 'Chad Johnson',   // his PFR profile is under original name
}

function buildPfrId(fullName, n = 0) {
  const clean = fullName.replace(/\s+(Jr\.|Sr\.|III|II|IV)\s*$/, '').trim()
  const parts = clean.split(/\s+/)
  const first = parts[0].replace(/\./g, '')
  const last  = parts[parts.length - 1].replace(/[^a-zA-Z]/g, '')
  const last4  = (last.charAt(0).toUpperCase() + last.slice(1).toLowerCase()).substring(0, 4)
  const first2 = first.substring(0, 2).toLowerCase()
  const nn     = String(n).padStart(2, '0')
  return `${last4}${first2}${nn}`
}

function download(url, dest) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest)
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return resolve(false) }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(true) })
    })
    req.on('error', () => { file.close(); fs.unlink(dest, () => {}); resolve(false) })
    req.setTimeout(10000, () => { req.destroy(); resolve(false) })
  })
}

async function findPfr(jsonName) {
  const searchName = PFR_NAME_OVERRIDES[jsonName] ?? jsonName
  for (let n = 0; n <= 5; n++) {
    const id   = buildPfrId(searchName, n)
    const url  = `https://www.pro-football-reference.com/req/202106291/images/headshots/${id}.jpg`
    const dest = path.join(OUT_DIR, `pfr_${id}.jpg`)
    if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
      return `pfr_${id}`
    }
    const ok = await download(url, dest)
    if (ok) {
      const size = fs.statSync(dest).size
      if (size > 5000) return `pfr_${id}`
      fs.unlinkSync(dest)
    }
    await new Promise(r => setTimeout(r, 250))
  }
  return null
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const existing = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))

  const added  = {}
  const failed = []

  for (const name of MISSING) {
    if (existing[name]) { console.log(`  (skip) ${name}`); continue }
    const id = await findPfr(name)
    if (id) {
      console.log(`  ✓ ${name} → ${id}`)
      added[name] = id
    } else {
      console.log(`  ✗ ${name}`)
      failed.push(name)
    }
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify({ ...existing, ...added }, null, 2))
  console.log(`\nDone. Added ${Object.keys(added).length} via PFR`)
  if (failed.length) {
    console.log('Still not found:')
    failed.forEach(n => console.log(`  - ${n}`))
  }
}

main().catch(err => { console.error(err.message); process.exit(1) })
