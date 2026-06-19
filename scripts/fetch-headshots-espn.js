// Fetch headshots from ESPN for players missing from Sleeper CDN.
// Run once: node scripts/fetch-headshots-espn.js

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_DIR   = path.join(ROOT, 'public', 'headshots')

// Players missing from Sleeper CDN → their Sleeper IDs (used as filenames)
const MISSING = {
  'Carson Beck':       '13272',
  'Luke Altmyer':      '13314',
  'Graham Mertz':      '12705',
  'Garrett Nussmeier': '13404',
  'D.J. Uiagalelei':   '12773',
  'Cam Miller':        '12688',
  'Behren Morton':     '13295',
  'Brady Cook':        '12538',
  'Connor Bazelak':    '12776',
  'Athan Kaliakmanis': '13557',
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
      if (item.type === 'player' && item.id) return item.id
    }
    return null
  } catch { return null }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const [name, sleeperId] of Object.entries(MISSING)) {
    const dest = path.join(OUT_DIR, `${sleeperId}.jpg`)
    if (fs.existsSync(dest)) { console.log(`  (cached) ${name}`); continue }

    const espnId = await findESPNId(name)
    if (!espnId) { console.log(`  ✗ ${name} — not found on ESPN`); continue }

    // ESPN headshot CDN
    const url = `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
    try {
      await downloadImg(url, dest)
      console.log(`  ✓ ${name} → ${sleeperId}.jpg (ESPN id ${espnId})`)
    } catch (e) {
      console.log(`  ✗ ${name} (ESPN ${espnId}: ${e.message})`)
    }
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err.message); process.exit(1) })
