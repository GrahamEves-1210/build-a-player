#!/usr/bin/env node
// Fetches headshots for every NBA player via ESPN CDN.
// Run: node scripts/fetch-nba-headshots.mjs
//
// Outputs:
//   public/headshots/nba/{espnId}.jpg
//   src/data/nba-headshots.json  — { "Player Name": "espnId", ... }

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_DIR   = path.join(ROOT, 'public', 'headshots', 'nba')
const JSON_OUT  = path.join(ROOT, 'src', 'data', 'nba-headshots.json')

fs.mkdirSync(OUT_DIR, { recursive: true })

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function get(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'build-a-bucket/1.0' }, ...opts }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, opts).then(resolve, reject)
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
      if (res.statusCode === 404 || res.statusCode === 403) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', err => { try { fs.unlinkSync(dest) } catch {} reject(err) })
    } catch (e) { reject(e) }
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Step 1: fetch all ESPN roster data (includes player IDs) ─────────────────
async function fetchAllESPNPlayers() {
  const teamsRes = await fetchJSON('https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=32')
  const teams = teamsRes.sports[0].leagues[0].teams.map(t => ({
    id:   t.team.id,
    name: t.team.displayName,
  }))

  console.log(`Found ${teams.length} NBA teams. Fetching rosters…\n`)

  const espnMap = {} // name → espnId

  for (const team of teams) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`
    try {
      const data = await fetchJSON(url)
      const athletes = data.athletes ?? []
      const players  = athletes.flatMap(g => g.items ?? g.athletes ?? [g]).filter(p => p?.fullName)
      for (const p of players) {
        if (p.id && p.fullName) espnMap[p.fullName] = String(p.id)
      }
      process.stdout.write(`  ✓ ${team.name} (${players.length} players)\n`)
    } catch (e) {
      process.stdout.write(`  ✗ ${team.name}: ${e.message}\n`)
    }
    await sleep(120)
  }

  return espnMap
}

// ─── Step 2: load our player list ─────────────────────────────────────────────
async function loadOurPlayers() {
  const mod = await import('../src/data/nba-players.js')
  return mod.NBA_PLAYERS.map(p => p.name)
}

// ─── Step 3: download headshots ───────────────────────────────────────────────
async function downloadHeadshots(espnMap, ourPlayers) {
  const result   = {}
  let downloaded = 0
  let cached     = 0
  let missing    = 0

  for (const name of ourPlayers) {
    const espnId = espnMap[name]
    if (!espnId) {
      // Try ESPN search as fallback
      try {
        const encoded = encodeURIComponent(name)
        const search  = await fetchJSON(
          `https://site.api.espn.com/apis/common/v3/search?query=${encoded}&limit=5&type=player&sport=basketball&league=nba`
        )
        const hit = (search?.items ?? []).find(i => i.type === 'player' && i.id)
        if (hit) {
          espnMap[name] = String(hit.id)
          process.stdout.write(`  ~ ${name} found via search (id ${hit.id})\n`)
        } else {
          process.stdout.write(`  ✗ ${name} — not found\n`)
          missing++
          continue
        }
      } catch {
        process.stdout.write(`  ✗ ${name} — search failed\n`)
        missing++
        continue
      }
      await sleep(80)
    }

    const id   = espnMap[name]
    const dest = path.join(OUT_DIR, `${id}.jpg`)

    if (fs.existsSync(dest)) {
      result[name] = id
      cached++
      continue
    }

    const url = `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`
    try {
      await downloadImg(url, dest)
      result[name] = id
      downloaded++
      process.stdout.write(`  ✓ ${name} → ${id}.jpg\n`)
    } catch (e) {
      process.stdout.write(`  ✗ ${name} (id ${id}): ${e.message}\n`)
      missing++
    }
    await sleep(60)
  }

  return { result, downloaded, cached, missing }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Build-A-Bucket: NBA Headshot Fetcher ===\n')

  const espnMap   = await fetchAllESPNPlayers()
  console.log(`\nESPN roster map: ${Object.keys(espnMap).length} players found\n`)

  const ourPlayers = await loadOurPlayers()
  console.log(`Our roster: ${ourPlayers.length} players\n`)
  console.log('Downloading headshots…\n')

  const { result, downloaded, cached, missing } = await downloadHeadshots(espnMap, ourPlayers)

  fs.writeFileSync(JSON_OUT, JSON.stringify(result, null, 2))
  console.log(`\n✓ Wrote ${JSON_OUT}`)
  console.log(`  Downloaded: ${downloaded}  Cached: ${cached}  Missing: ${missing}`)
  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
