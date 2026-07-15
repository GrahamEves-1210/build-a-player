#!/usr/bin/env node
// Fetches position + starter status for every NBA player from ESPN.
// Run: node scripts/fetch-nba-positions.mjs
// Outputs: src/data/nba-positions.json  — { "Player Name": { pos: "PG", starter: true } }

import fs   from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JSON_OUT  = path.join(__dirname, '..', 'src', 'data', 'nba-positions.json')

const SHORT_MAP = {
  'Atlanta Hawks':'ATL','Boston Celtics':'BOS','Brooklyn Nets':'BKN',
  'Charlotte Hornets':'CHA','Chicago Bulls':'CHI','Cleveland Cavaliers':'CLE',
  'Dallas Mavericks':'DAL','Denver Nuggets':'DEN','Detroit Pistons':'DET',
  'Golden State Warriors':'GSW','Houston Rockets':'HOU','Indiana Pacers':'IND',
  'LA Clippers':'LAC','Los Angeles Clippers':'LAC','Los Angeles Lakers':'LAL',
  'Memphis Grizzlies':'MEM','Miami Heat':'MIA','Milwaukee Bucks':'MIL',
  'Minnesota Timberwolves':'MIN','New Orleans Pelicans':'NOP',
  'New York Knicks':'NYK','Oklahoma City Thunder':'OKC','Orlando Magic':'ORL',
  'Philadelphia 76ers':'PHI','Phoenix Suns':'PHX','Portland Trail Blazers':'POR',
  'Sacramento Kings':'SAC','San Antonio Spurs':'SAS','Toronto Raptors':'TOR',
  'Utah Jazz':'UTA','Washington Wizards':'WAS',
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'build-a-bucket/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve, reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(e) }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(new Error('timeout')) })
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('Fetching NBA team list…')
  const teamsData = await fetchJSON('https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=32')
  const teams = teamsData.sports[0].leagues[0].teams.map(t => ({
    id:   t.team.id,
    name: t.team.displayName,
    short: SHORT_MAP[t.team.displayName] ?? t.team.abbreviation,
  }))
  console.log(`  ${teams.length} teams\n`)

  const result = {}

  for (const team of teams) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`
    try {
      const data = await fetchJSON(url)
      // Current-season: flat athletes array. Off-season: grouped array with items/athletes.
      const raw = data.athletes ?? []
      const players = (
        raw.length && raw[0]?.fullName
          ? raw                                                    // flat (current season)
          : raw.flatMap(g => g.items ?? g.athletes ?? [])         // grouped (off-season)
      ).filter(p => p?.fullName)

      // Fetch depth chart for starter detection
      let depthStarters = new Set()
      try {
        const dc = await fetchJSON(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/depthcharts`
        )
        const positions = dc.positionGroups ?? dc.items ?? []
        for (const pg of positions) {
          const items = pg.athletes ?? pg.items ?? []
          if (items.length > 0) depthStarters.add(items[0]?.athlete?.fullName)
        }
      } catch {}

      for (const p of players) {
        const pos    = p.position?.abbreviation ?? p.position?.name ?? ''
        const isStarter = depthStarters.has(p.fullName) || p.starter === true
        result[p.fullName] = { pos, starter: isStarter }
      }

      process.stdout.write(`  ✓ ${team.short.padEnd(4)} ${players.length} players (${depthStarters.size} depth starters)\n`)
    } catch (e) {
      process.stdout.write(`  ✗ ${team.short}: ${e.message}\n`)
    }
    await sleep(130)
  }

  fs.writeFileSync(JSON_OUT, JSON.stringify(result, null, 2))
  console.log(`\n✓ Wrote ${JSON_OUT}  (${Object.keys(result).length} players)`)
}

main().catch(err => { console.error(err); process.exit(1) })
