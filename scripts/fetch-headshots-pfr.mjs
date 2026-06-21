/**
 * Downloads QB headshots from Pro Football Reference.
 * Permission obtained from Sports Reference owner.
 *
 * PFR headshot URL: https://www.pro-football-reference.com/req/202106291/images/headshots/{id}.jpg
 * PFR ID format: [Last4][First2][NN]
 *   Last4 = first 4 chars of last name (Title case)
 *   First2 = first 2 chars of first name (lower case)
 *   NN = 00, 01, 02 … (try in order until one 200s)
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'headshots')

// All QBs in the game
const NAMES = [
  'Jacoby Brissett', 'Gardner Minshew', 'Carson Beck',
  'Michael Penix Jr.', 'Tua Tagovailoa', 'Trevor Siemian',
  'Lamar Jackson', 'Tyler Huntley', 'Skylar Thompson',
  'Josh Allen', 'Kyle Allen', 'Shane Buechele',
  'Bryce Young', 'Kenny Pickett', 'Will Grier',
  'Caleb Williams', 'Tyson Bagent', 'Case Keenum',
  'Joe Burrow', 'Joe Flacco', 'Josh Johnson',
  'Shedeur Sanders', 'Deshaun Watson', 'Dillon Gabriel',
  'Dak Prescott', 'Joe Milton III', 'Sam Howell',
  'Bo Nix', 'Jarrett Stidham', 'Sam Ehlinger',
  'Jared Goff', 'Teddy Bridgewater', 'Luke Altmyer',
  'Jordan Love', 'Tyrod Taylor', 'Kyle McCord',
  'C.J. Stroud', 'Davis Mills', 'Graham Mertz',
  'Daniel Jones', 'Anthony Richardson', 'Riley Leonard',
  'Trevor Lawrence', 'Nick Mullens', 'Carter Bradley',
  'Patrick Mahomes', 'Justin Fields', 'Garrett Nussmeier',
  'Kirk Cousins', 'Fernando Mendoza', "Aidan O'Connell",
  'Justin Herbert', 'Trey Lance', 'D.J. Uiagalelei',
  'Matthew Stafford', 'Ty Simpson', 'Stetson Bennett',
  'Malik Willis', 'Quinn Ewers', 'Cam Miller',
  'Kyler Murray', 'J.J. McCarthy', 'Carson Wentz',
  'Drake Maye', 'Tommy DeVito', 'Behren Morton',
  'Tyler Shough', 'Spencer Rattler', 'Zach Wilson',
  'Jaxson Dart', 'Jameis Winston', 'Brandon Allen',
  'Geno Smith', 'Cade Klubnik', 'Brady Cook',
  'Jalen Hurts', 'Tanner McKee', 'Andy Dalton',
  'Aaron Rodgers', 'Mason Rudolph', 'Will Howard',
  'Brock Purdy', 'Mac Jones', 'Adrian Martinez',
  'Sam Darnold', 'Drew Lock', 'Jalen Milroe',
  'Baker Mayfield', 'Jake Browning', 'Connor Bazelak',
  'Cam Ward', 'Mitchell Trubisky', 'Will Levis',
  'Jayden Daniels', 'Marcus Mariota', 'Athan Kaliakmanis',
]

function buildId(fullName, n = 0) {
  // Strip suffixes
  const clean = fullName.replace(/\s+(Jr\.|Sr\.|III|II|IV)\s*$/, '').trim()
  const parts = clean.split(/\s+/)
  const first = parts[0]
  const last  = parts[parts.length - 1]

  // Strip punctuation for initials like "C.J." → "CJ"
  const firstClean = first.replace(/\./g, '')
  const lastClean  = last.replace(/[^a-zA-Z]/g, '')

  const last4  = (lastClean.charAt(0).toUpperCase() + lastClean.slice(1).toLowerCase()).substring(0, 4)
  const first2 = firstClean.substring(0, 2).toLowerCase()
  const nn     = String(n).padStart(2, '0')
  return `${last4}${first2}${nn}`
}

function download(url, dest) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest)
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        file.close()
        fs.unlink(dest, () => {})
        resolve(false)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(true) })
    })
    req.on('error', () => { file.close(); fs.unlink(dest, () => {}); resolve(false) })
    req.setTimeout(8000, () => { req.destroy(); resolve(false) })
  })
}

async function findAndDownload(name) {
  for (let n = 0; n <= 5; n++) {
    const id  = buildId(name, n)
    const url = `https://www.pro-football-reference.com/req/202106291/images/headshots/${id}.jpg`
    const dest = path.join(OUT_DIR, `${id}.jpg`)

    // Skip if already downloaded
    if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
      console.log(`✓  ${name} → ${id} (cached)`)
      return id
    }

    const ok = await download(url, dest)
    if (ok) {
      const size = fs.statSync(dest).size
      if (size > 5000) {
        console.log(`✓  ${name} → ${id}`)
        return id
      }
      fs.unlinkSync(dest)
    }
  }
  console.warn(`✗  ${name} — not found`)
  return null
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const map = {}

  for (const name of NAMES) {
    const id = await findAndDownload(name)
    if (id) map[name] = id
    // Small delay to be polite to PFR's servers
    await new Promise(r => setTimeout(r, 300))
  }

  const jsonPath = path.join(__dirname, '..', 'src', 'data', 'headshots.json')
  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2))
  console.log(`\nDone — ${Object.keys(map).length}/${NAMES.length} headshots saved to headshots.json`)
}

main().catch(console.error)
