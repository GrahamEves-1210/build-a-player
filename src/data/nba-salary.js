// SALARY CAP (basketball): the five columns and the player pool, shared by
// the Salary Cap screen and the Trait Auction (lib/auction.js)
import { NBA_GUARD_PLAYERS } from './nba-guards'
import { NBA_BIG_PLAYERS } from './nba-bigs'

// ─── All-time legends (only players with headshots) ──────────────────────────
export const GOAT_SALARY_PLAYERS = [
  {
    name: 'Michael Jordan', team: 'CHI', legend: true, posGroup: 'guard',
    attrs: { jumpShot:7, finishing:11, perimeterDefense:11, interiorDefense:7, passing:8, handles:9, playmaking:8, size:9, speed:10, bounce:11 },
  },
  {
    name: 'Kobe Bryant', team: 'LAL', legend: true, posGroup: 'guard',
    attrs: { jumpShot:9, finishing:10, perimeterDefense:8, interiorDefense:6, passing:6, handles:9, playmaking:8, size:7, speed:9, bounce:9 },
  },
  {
    name: 'Larry Bird', team: 'BOS', legend: true, posGroup: 'guard',
    attrs: { jumpShot:10, finishing:9, perimeterDefense:6, interiorDefense:6, passing:10, handles:7, playmaking:10, size:8, speed:3, bounce:3 },
  },
  {
    name: 'Allen Iverson', team: 'PHI', legend: true, posGroup: 'guard',
    attrs: { jumpShot:8, finishing:9, perimeterDefense:6, interiorDefense:3, passing:9, handles:11, playmaking:10, size:2, speed:11, bounce:9 },
  },
  {
    name: 'Dwyane Wade', team: 'MIA', legend: true, posGroup: 'guard',
    attrs: { jumpShot:7, finishing:10, perimeterDefense:9, interiorDefense:5, passing:8, handles:9, playmaking:8, size:7, speed:10, bounce:10 },
  },
  {
    name: 'Chris Paul', team: 'PHX', legend: true, posGroup: 'guard',
    attrs: { jumpShot:7, finishing:7, perimeterDefense:10, interiorDefense:4, passing:11, handles:10, playmaking:11, size:3, speed:8, bounce:7 },
  },
  {
    name: 'Kareem Abdul-Jabbar', team: 'LAL', legend: true, posGroup: 'big',
    attrs: { jumpShot:2, finishing:11, perimeterDefense:6, interiorDefense:10, passing:5, handles:3, playmaking:6, size:10, speed:5, bounce:10 },
  },
  {
    name: "Shaquille O'Neal", team: 'LAL', legend: true, posGroup: 'big',
    attrs: { jumpShot:0, finishing:11, perimeterDefense:4, interiorDefense:10, passing:5, handles:3, playmaking:6, size:11, speed:8, bounce:11 },
  },
  {
    name: 'Tim Duncan', team: 'SAS', legend: true, posGroup: 'big',
    attrs: { jumpShot:7, finishing:10, perimeterDefense:7, interiorDefense:11, passing:8, handles:5, playmaking:8, size:9, speed:5, bounce:6 },
  },
  {
    name: 'Wilt Chamberlain', team: 'PHI', legend: true, posGroup: 'big',
    attrs: { jumpShot:0, finishing:11, perimeterDefense:5, interiorDefense:11, passing:6, handles:4, playmaking:6, size:11, speed:9, bounce:11 },
  },
  {
    name: 'Charles Barkley', team: 'PHX', legend: true, posGroup: 'big',
    attrs: { jumpShot:6, finishing:9, perimeterDefense:7, interiorDefense:9, passing:6, handles:6, playmaking:6, size:9, speed:8, bounce:8 },
  },
  {
    name: 'Dirk Nowitzki', team: 'DAL', legend: true, posGroup: 'big',
    attrs: { jumpShot:10, finishing:8, perimeterDefense:6, interiorDefense:6, passing:7, handles:5, playmaking:7, size:10, speed:4, bounce:5 },
  },
  {
    name: 'Bill Russell', team: 'BOS', legend: true, posGroup: 'big',
    attrs: { jumpShot:0, finishing:9, perimeterDefense:6, interiorDefense:11, passing:6, handles:3, playmaking:6, size:9, speed:8, bounce:9 },
  },
  {
    name: 'Tracy McGrady', team: 'ORL', legend: true, posGroup: 'guard',
    attrs: { jumpShot:9, finishing:9, perimeterDefense:7, interiorDefense:5, passing:7, handles:9, playmaking:8, size:8, speed:8, bounce:9 },
  },
  {
    name: 'Carmelo Anthony', team: 'NYK', legend: true, posGroup: 'guard',
    attrs: { jumpShot:9, finishing:9, perimeterDefense:5, interiorDefense:5, passing:6, handles:9, playmaking:9, size:8, speed:6, bounce:7 },
  },
  {
    name: 'Paul Pierce', team: 'BOS', legend: true, posGroup: 'guard',
    attrs: { jumpShot:9, finishing:8, perimeterDefense:7, interiorDefense:6, passing:7, handles:7, playmaking:7, size:7, speed:5, bounce:6 },
  },
  {
    name: 'Ray Allen', team: 'BOS', legend: true, posGroup: 'guard',
    attrs: { jumpShot:11, finishing:6, perimeterDefense:8, interiorDefense:5, passing:6, handles:6, playmaking:6, size:6, speed:8, bounce:6 },
  },
  {
    name: 'Steve Nash', team: 'PHX', legend: true, posGroup: 'guard',
    attrs: { jumpShot:10, finishing:7, perimeterDefense:4, interiorDefense:3, passing:11, handles:11, playmaking:11, size:4, speed:8, bounce:6 },
  },
]

// ─── Player pool (Jul 18+ and infinite) ──────────────────────────────────────
export const BUCKET_SAL_POOL = [...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS, ...GOAT_SALARY_PLAYERS]
  .filter(p => {
    if (!p.attrs) return false
    const vals = Object.values(p.attrs)
    return vals.reduce((s, v) => s + v, 0) / vals.length >= 3.0
  })
  .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)

export const SAL_COLS = [
  { key: 'finishing',  label: 'FINISHING',          guardTypes: ['finishing'],                          bigTypes: ['finishing'] },
  { key: 'shooting',   label: 'SHOOTING',           guardTypes: ['jumpShot'],                           bigTypes: ['jumpShot'] },
  { key: 'defense',    label: 'DEFENSE',            guardTypes: ['perimeterDefense'],                   bigTypes: ['interiorDefense'] },
  { key: 'playmaking', label: 'PLAYMAKING',         guardTypes: ['handles', 'passing'],                 bigTypes: ['playmaking'] },
  { key: 'size',       label: 'SIZE & ATHLETICISM', guardTypes: ['speed', 'bounce', 'size'],             bigTypes: ['size', 'bounce'] },
]

export function playerPosGroup(player) {
  if (player.posGroup) return player.posGroup
  const pos = player.position
  return (pos === 'C' || pos === 'PF') ? 'big' : 'guard'
}

export function salTypesFor(player, col) {
  return playerPosGroup(player) === 'big' ? col.bigTypes : col.guardTypes
}

