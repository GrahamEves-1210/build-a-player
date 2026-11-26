// TRAIT AUCTION, soccer, in the soccer app: the rules' kit (lib/soccerAuction.js) and how its cards look, the way
// Salary Cap's soccer cards do (SoccerSalaryCap.jsx): his club's crest and colours (a nation's flag only where the data
// has no club for him), his ESPN photo (FotMob where ESPN has none, lib/soccerFace.js).
import './soccerAuction'
import { addAuctionLook } from './auction'
import { SOCCER_SAL_POOL } from '../data/soccer-salary'
import { SOCCER_ALL_CLUBS } from '../data/soccer-clubs'
import { SOCCER_ALL_STRIKERS } from '../data/soccer-strikers'
import { WC_ALL_NATIONS } from '../data/soccer-nations'
import { soccerFaceKey } from './soccerFace'
import { HEADSHOT_BASE } from '../utils/simulation'

const CLUB_META = Object.fromEntries(SOCCER_ALL_CLUBS.map(t => [t.short, t]))
const NATION_META = Object.fromEntries(WC_ALL_NATIONS.map(t => [t.short, t]))
const CLUB_OF_PLAYER = new Map(SOCCER_ALL_STRIKERS.map(p => [p.name, p.team]))
const BY_NAME = new Map(SOCCER_SAL_POOL.map(p => [p.name, p]))
const crestOf = team => {
  const nation = !CLUB_META[team] && NATION_META[team]
  return nation ? { src: `/logos/nations/${team}.png`, meta: nation } : { src: `/logos/soccer/${team}.png`, meta: CLUB_META[team] }
}
// a nation card whose player is at a club in the data wears the club's crest (SoccerSalaryCap crestOf)
const crestFor = (name, team) => {
  const p = BY_NAME.get(name)
  const club = p?.teamKind === 'nation' ? CLUB_OF_PLAYER.get(name) : null
  return club && CLUB_META[club] ? crestOf(club) : crestOf(team)
}

addAuctionLook('soccer', {
  label: 'ST',
  photo: (name, team) => { const p = BY_NAME.get(name); const k = soccerFaceKey(p ?? { name, team }); return k ? `${HEADSHOT_BASE}/${k}.webp` : null },
  logo: team => crestOf(team).src,
  crest: (name, team) => crestFor(name, team).src,
  teamColor: (team, name) => (name ? crestFor(name, team) : crestOf(team)).meta?.color ?? '#3a2a22',
})
