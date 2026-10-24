// app-clean: team "logos" are badges, the team's abbreviation on its colors
// (no real logos in this branch). Run: node scripts/team-badges.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { NFL_TEAMS } from '../src/data/nfl-teams.js'
import { NBA_TEAMS } from '../src/data/nba-teams.js'

const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
const badge = ({ short, color, color2 }) => {
  const ink = lum(color) > 0.62 ? '#111111' : '#FFFFFF'
  const ring = color2 && color2.toLowerCase() !== color.toLowerCase() ? color2 : ink
  const size = short.length > 2 ? 34 : 42
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
<circle cx="60" cy="60" r="56" fill="${color}" stroke="${ring}" stroke-width="7"/>
<text x="60" y="61" text-anchor="middle" dominant-baseline="central" font-family="Impact, 'Arial Black', 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="${size}" letter-spacing="1" fill="${ink}">${short}</text>
</svg>
`
}
mkdirSync('public/logos/nba', { recursive: true })
for (const t of NFL_TEAMS) writeFileSync(`public/logos/${t.short}.svg`, badge(t))
for (const t of NBA_TEAMS) writeFileSync(`public/logos/nba/${t.short}.svg`, badge(t))
console.log(`${NFL_TEAMS.length} + ${NBA_TEAMS.length} badges`)
