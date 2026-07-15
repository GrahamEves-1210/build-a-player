import { readFileSync, writeFileSync } from 'fs'

const src = readFileSync('./src/data/nba-players.js', 'utf8')

// Insert a team comment before the first player of each new team in each array
const result = src.replace(
  /^(  \{ name: "[^"]+", short: "[^"]+", team: '([A-Z]+)',)/gm,
  (match, line, team, offset, str) => {
    // Check if the previous player line had the same team
    const before = str.slice(0, offset)
    const lastTeamMatch = before.match(/team: '([A-Z]+)'[^\n]*\n[^[]*$/)
    const lastTeam = lastTeamMatch ? lastTeamMatch[1] : null
    if (lastTeam !== team) {
      return `\n  // ─── ${team} ───────────────────────────────────────────────────────────\n${line}`
    }
    return match
  }
)

writeFileSync('./src/data/nba-players.js', result, 'utf8')
console.log('Done')
