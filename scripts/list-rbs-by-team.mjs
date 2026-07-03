// Pull current RB rosters from Sleeper API and print top players per team.
// Run: node scripts/list-rbs-by-team.mjs

import https from 'node:https'

const NFL_TEAMS = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WAS']

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'build-a-player/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return get(res.headers.location).then(resolve, reject)
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(e) }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(30000, () => req.destroy(new Error('timeout')))
  })
}

const players = await get('https://api.sleeper.app/v1/players/nfl')
console.log(`Total players: ${Object.keys(players).length}\n`)

const byTeam = {}
for (const team of NFL_TEAMS) byTeam[team] = []

for (const [id, p] of Object.entries(players)) {
  if (p.position !== 'RB') continue
  if (!p.team || !byTeam[p.team]) continue
  if (p.status === 'Inactive' || p.status === 'Suspended') continue
  byTeam[p.team].push({
    id,
    name: p.full_name,
    number: p.number,
    status: p.status,
    depth: p.depth_chart_order ?? 99,
    age: p.age,
  })
}

for (const team of NFL_TEAMS) {
  const rbs = byTeam[team]
    .sort((a, b) => a.depth - b.depth || a.age - b.age)
    .slice(0, 4)
  const lines = rbs.map(r => `  ${String(r.number ?? '?').padStart(2)}  ${r.name.padEnd(26)} depth:${r.depth}  age:${r.age ?? '?'}  [${r.id}]`)
  console.log(`${team}`)
  lines.forEach(l => console.log(l))
  console.log()
}
