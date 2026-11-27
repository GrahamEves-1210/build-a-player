// TRAIT AUCTION, college, in the football and basketball apps: the rules' kits (lib/collegeAuction.js) and how the
// cards look: his school's colours and logo (College Football's /logos/cfb, College Basketball's own logo list), his
// ESPN photo where the data has one. Imported only when COLLEGE is picked, so the college rosters stay out of the
// pro bundles. (The app's clean art swaps the photos and logos like everywhere else: lib/appArt.js reads the paths.)
import './collegeAuction'
import { addAuctionLook } from './auction'
import { cfbAuctionKit, cbbAuctionKit } from './collegeAuction'
import { CFB_TEAM_BY_SHORT } from '../data/cfb-teams'
import { CBB_TEAM_BY_SHORT } from '../data/cbb-teams'
import { HEADSHOT_BASE } from '../utils/simulation'

const look = (kitOf, teams, logoOf) => pos => {
  const byName = new Map(kitOf(pos).pool.map(p => [p.name, p]))
  return {
    label: pos.toUpperCase(),
    photo: name => { const h = byName.get(name)?.headshot; return h ? `${HEADSHOT_BASE}/${h}.webp` : null },
    logo: logoOf,
    teamColor: (team, name) => byName.get(name)?.color ?? teams[team]?.color ?? '#22314f',
  }
}
addAuctionLook('cfb', look(cfbAuctionKit, CFB_TEAM_BY_SHORT, s => `/logos/cfb/${s}.png`))
addAuctionLook('cbb', look(cbbAuctionKit, CBB_TEAM_BY_SHORT, s => CBB_TEAM_BY_SHORT[s]?.logo ?? `/logos/cbb/${s}.png`))
