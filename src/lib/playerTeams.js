// app-clean: a player's "photo" is their team's badge (the abbreviation on the team's
// colors, public/logos/*.svg). The team comes from the player data: the current
// pools first, then the all-time ones.
import { QBS } from '../data/qbs'
import { RBS } from '../data/rbs'
import { WRS } from '../data/wrs'
import { TES } from '../data/tes'
import { DBS } from '../data/dbs'
import { OLS } from '../data/ols'
import { DLS } from '../data/dls'
import { LEGENDS } from '../data/qb-legends'
import { RB_LEGENDS } from '../data/rb-legends'
import { WR_LEGENDS } from '../data/wr-legends'
import { TE_LEGENDS } from '../data/te-legends'
import { DB_LEGENDS } from '../data/db-legends'
import { NBA_GUARD_PLAYERS } from '../data/nba-guards'
import { NBA_BIG_PLAYERS } from '../data/nba-bigs'
import { NBA_ALLTIME_GUARD_PLAYERS } from '../data/nba-guard-legends'
import { NBA_ALLTIME_BIG_PLAYERS } from '../data/nba-big-legends'

export const badgeUrl = (sport, team) => (team ? (sport === 'bucket' ? `/logos/nba/${team}.svg` : `/logos/${team}.svg`) : null)

let maps = null
function build() {
  const map = lists => { const m = new Map(); for (const l of lists) for (const p of l ?? []) if (p?.name && p.team && !m.has(p.name)) m.set(p.name, p.team); return m }
  maps = {
    nfl: map([QBS, RBS, WRS, TES, DBS, OLS, DLS, LEGENDS, RB_LEGENDS, WR_LEGENDS, TE_LEGENDS, DB_LEGENDS]),
    bucket: map([NBA_GUARD_PLAYERS, NBA_BIG_PLAYERS, NBA_ALLTIME_GUARD_PLAYERS, NBA_ALLTIME_BIG_PLAYERS]),
  }
  return maps
}
export const teamOfPlayer = (sport, name) => (name ? (maps ?? build())[sport === 'bucket' ? 'bucket' : 'nfl'].get(name) ?? null : null)
// the badge for a player: their team (given, or from the data)
export const playerBadge = (sport, name, team = null) => badgeUrl(sport, team ?? teamOfPlayer(sport, name))
