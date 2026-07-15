// Fetches current NBA rosters from ESPN's public API (no key needed)
// Outputs player names + teams so we can update nba-players.js

const SHORT_MAP = {
  'Atlanta Hawks':           'ATL',
  'Boston Celtics':          'BOS',
  'Brooklyn Nets':           'BKN',
  'Charlotte Hornets':       'CHA',
  'Chicago Bulls':           'CHI',
  'Cleveland Cavaliers':     'CLE',
  'Dallas Mavericks':        'DAL',
  'Denver Nuggets':          'DEN',
  'Detroit Pistons':         'DET',
  'Golden State Warriors':   'GSW',
  'Houston Rockets':         'HOU',
  'Indiana Pacers':          'IND',
  'LA Clippers':             'LAC',
  'Los Angeles Clippers':    'LAC',
  'Los Angeles Lakers':      'LAL',
  'Memphis Grizzlies':       'MEM',
  'Miami Heat':              'MIA',
  'Milwaukee Bucks':         'MIL',
  'Minnesota Timberwolves':  'MIN',
  'New Orleans Pelicans':    'NOP',
  'New York Knicks':         'NYK',
  'Oklahoma City Thunder':   'OKC',
  'Orlando Magic':           'ORL',
  'Philadelphia 76ers':      'PHI',
  'Phoenix Suns':            'PHX',
  'Portland Trail Blazers':  'POR',
  'Sacramento Kings':        'SAC',
  'San Antonio Spurs':       'SAS',
  'Toronto Raptors':         'TOR',
  'Utah Jazz':               'UTA',
  'Washington Wizards':      'WAS',
}

// Step 1 — Get all team IDs
const teamsRes = await fetch('https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=32')
const teamsData = await teamsRes.json()
const teams = teamsData.sports[0].leagues[0].teams.map(t => ({
  id: t.team.id,
  name: t.team.displayName,
  short: SHORT_MAP[t.team.displayName] ?? t.team.abbreviation,
}))

console.log(`Found ${teams.length} teams\n`)

// Step 2 — Fetch each roster
const allPlayers = []

for (const team of teams) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`
  const res = await fetch(url)
  if (!res.ok) { console.error(`FAILED ${team.short}: ${res.status}`); continue }
  const data = await res.json()

  const athletes = data.athletes ?? []
  const players = athletes.flatMap(group => group.items ?? group.athletes ?? [group]).filter(p => p?.fullName)

  for (const p of players) {
    allPlayers.push({ name: p.fullName, team: team.short, position: p.position?.abbreviation ?? '' })
  }
  console.log(`✓ ${team.short.padEnd(4)} — ${players.length} players`)
}

console.log(`\nTotal players: ${allPlayers.length}`)
console.log('\n--- JSON (copy into script) ---')
console.log(JSON.stringify(allPlayers, null, 2))
