import { TEAMS, ATTR } from './qbs'
const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

export const TE_TYPES      = ['speed', 'blocking', 'vertical', 'routeRunning', 'strength', 'hands', 'awareness', 'size', 'afterCatch']
export const TE_LITE_TYPES = ['speed', 'hands', 'blocking', 'size']

export const TE_CATEGORIES = [
  { id: 'physical', label: 'Physical', types: ['speed', 'blocking', 'vertical', 'size'] },
  { id: 'skill',    label: 'Skill',    types: ['routeRunning', 'strength', 'hands', 'awareness', 'afterCatch'] },
]

// blocking replaces bodyControl; strength replaces release
export const TE_ATTR = {
  ...ATTR,
  'size':     { ...ATTR['size'],     label: 'Size',     shortLabel: 'SZE', col: 'var(--c-str)',  hex: '#fb923c' },
  'speed':    { ...ATTR['speed'],    label: 'Speed',    shortLabel: 'SPD', col: 'var(--c-arm)',  hex: '#f87171' },
  'blocking': { label: 'Blocking',  shortLabel: 'BLK', category: 'physical', col: 'var(--c-mob)',  hex: '#60a5fa', bodyZone: 'arm'  },
  'strength': { ...ATTR['strength'], label: 'Strength', shortLabel: 'STR' },
}

const _TE_W = { hands: 0.16, routeRunning: 0.15, size: 0.12, awareness: 0.11, afterCatch: 0.11, blocking: 0.09, strength: 0.09, vertical: 0.09, speed: 0.08 }
function _teOVR(a) {
  const vals   = TE_TYPES.map(t => a[t] ?? 0)
  const avg    = TE_TYPES.reduce((s, t) => s + (a[t] ?? 0) * _TE_W[t], 0)
  const base   = 60 + 2.1 * avg + 0.21 * avg * avg
  const spread = Math.max(...vals) - Math.min(...vals)
  const minVal = Math.min(...vals)
  const bonus  = spread <= 1 ? 2.5 : spread <= 2 ? 1.0 : spread <= 3 ? 0.3 : 0
  const minBonus = minVal >= 9 ? 2.0 : minVal >= 8 ? 0.5 : 0
  return Math.min(99, Math.max(0, Math.round(base + bonus + minBonus)))
}

// Size scale 0–11: 11=S  10=A  9=A-  8=B+  7=B  6=B-  5=C+  3=C-  2=D  0=absolute min
// 70% height / 30% weight; Higgins (6'2") = 0 floor, Washington/Parkinson (6'7") = 11 ceiling
// B/B- (6–7) = average NFL starter-sized TE; most starters cluster 7–9
// Skin: #f0c4a0 white  #b07848 mixed/Polynesian  #5e3c22 Black  #3a2010 Black (very dark)

const _TES = [
  // ARI
  { name: 'Trey McBride',      short: 'McBride',     team: 'ARI', teamName: 'Arizona Cardinals',      skin: '#f0c4a0', height: 76, weight: 258, starter: true,  captain: true,  number: 85,
    attrs: { speed: 8, blocking: 5, vertical: 7, routeRunning: 11, strength: 6, hands: 11, awareness: 10, size: 7, afterCatch: 8 } },
  { name: 'Elijah Higgins',    short: 'Higgins',     team: 'ARI', teamName: 'Arizona Cardinals',      skin: '#5e3c22', height: 74, weight: 235, starter: false, number: 84,
    attrs: { speed: 6, blocking: 5, vertical: 6, routeRunning: 5, strength: 4, hands: 6, awareness: 5, size: 2, afterCatch: 5 } },
  { name: 'Tip Reiman',        short: 'Reiman',      team: 'ARI', teamName: 'Arizona Cardinals',      skin: '#f0c4a0', height: 77, weight: 252, starter: false, number: 87,
    attrs: { speed: 4, blocking: 6, vertical: 5, routeRunning: 3, strength: 6, hands: 3, awareness: 4, size: 9, afterCatch: 3 } },
  // ATL
  { name: 'Kyle Pitts',        short: 'Pitts',       team: 'ATL', teamName: 'Atlanta Falcons',        skin: '#5e3c22', height: 78, weight: 246, starter: true,  captain: true,  number: 8,
    attrs: { speed: 10, blocking: 1, vertical: 8, routeRunning: 8, strength: 3, hands: 8, awareness: 7, size: 10, afterCatch: 6 } },
  { name: 'Charlie Woerner',   short: 'Woerner',     team: 'ATL', teamName: 'Atlanta Falcons',        skin: '#f0c4a0', height: 76, weight: 242, starter: false, number: 89,
    attrs: { speed: 4, blocking: 6, vertical: 4, routeRunning: 3, strength: 5, hands: 4, awareness: 5, size: 6, afterCatch: 3 } },
  { name: 'Austin Hooper',     short: 'Hooper',      team: 'ATL', teamName: 'Atlanta Falcons',        skin: '#b07848', height: 76, weight: 254, starter: false, number: 81,
    attrs: { speed: 4, blocking: 6, vertical: 6, routeRunning: 6, strength: 6, hands: 6, awareness: 6, size: 7, afterCatch: 5 } },
  // BAL
  { name: 'Mark Andrews',      short: 'Andrews',     team: 'BAL', teamName: 'Baltimore Ravens',       skin: '#f0c4a0', height: 77, weight: 256, starter: true,  captain: true,  number: 89,
    attrs: { speed: 6, blocking: 5, vertical: 7, routeRunning: 8, strength: 6, hands: 8, awareness: 8, size: 9, afterCatch: 7 } },
  { name: 'Durham Smythe',     short: 'Smythe',      team: 'BAL', teamName: 'Baltimore Ravens',       skin: '#f0c4a0', height: 77, weight: 250, starter: false, number: 80,
    attrs: { speed: 3, blocking: 7, vertical: 3, routeRunning: 3, strength: 6, hands: 4, awareness: 5, size: 9, afterCatch: 3 } },
  { name: 'Matt Hibner',       short: 'Hibner',      team: 'BAL', teamName: 'Baltimore Ravens',       skin: '#f0c4a0', height: 77, weight: 255, starter: false, number: 88,
    attrs: { speed: 3, blocking: 4, vertical: 3, routeRunning: 3, strength: 6, hands: 3, awareness: 4, size: 9, afterCatch: 2 } },
  // BUF
  { name: 'Dalton Kincaid',    short: 'Kincaid',     team: 'BUF', teamName: 'Buffalo Bills',          skin: '#5e3c22', height: 76, weight: 236, starter: true,  captain: true,  number: 86,
    attrs: { speed: 5, blocking: 3, vertical: 7, routeRunning: 7, strength: 4, hands: 6, awareness: 6, size: 5, afterCatch: 6 } },
  { name: 'Dawson Knox',       short: 'Knox',        team: 'BUF', teamName: 'Buffalo Bills',          skin: '#f0c4a0', height: 76, weight: 254, starter: false, number: 88,
    attrs: { speed: 8, blocking: 5, vertical: 5, routeRunning: 6, strength: 6, hands: 5, awareness: 6, size: 7, afterCatch: 5 } },
  { name: 'Jackson Hawes',     short: 'Hawes',       team: 'BUF', teamName: 'Buffalo Bills',          skin: '#f0c4a0', height: 76, weight: 237, starter: false, number: 85,
    attrs: { speed: 4, blocking: 10, vertical: 4, routeRunning: 3, strength: 8, hands: 4, awareness: 4, size: 5, afterCatch: 4 } },
  // CAR
  { name: 'Tommy Tremble',     short: 'Tremble',     team: 'CAR', teamName: 'Carolina Panthers',      skin: '#5e3c22', height: 75, weight: 251, starter: true,  captain: true,  number: 82,
    attrs: { speed: 5, blocking: 7, vertical: 4, routeRunning: 4, strength: 7, hands: 5, awareness: 6, size: 4, afterCatch: 7 } },
  { name: "Ja'Tavion Sanders", short: 'Sanders',     team: 'CAR', teamName: 'Carolina Panthers',      skin: '#5e3c22', height: 76, weight: 252, starter: false, number: 0,
    attrs: { speed: 7, blocking: 2, vertical: 5, routeRunning: 6, strength: 3, hands: 6, awareness: 4, size: 7, afterCatch: 4 } },
  { name: 'Mitchell Evans',    short: 'Evans',       team: 'CAR', teamName: 'Carolina Panthers',      skin: '#5e3c22', height: 77, weight: 245, starter: false, number: 84,
    attrs: { speed: 5, blocking: 5, vertical: 4, routeRunning: 4, strength: 5, hands: 4, awareness: 4, size: 8, afterCatch: 3 } },
  // CHI
  { name: 'Colston Loveland',  short: 'Loveland',    team: 'CHI', teamName: 'Chicago Bears',          skin: '#f0c4a0', height: 78, weight: 241, starter: true,  captain: true,  number: 84,
    attrs: { speed: 7, blocking: 4, vertical: 7, routeRunning: 9, strength: 4, hands: 8, awareness: 7, size: 10, afterCatch: 8 } },
  { name: 'Cole Kmet',         short: 'Kmet',        team: 'CHI', teamName: 'Chicago Bears',          skin: '#f0c4a0', height: 78, weight: 251, starter: false, number: 85,
    attrs: { speed: 5, blocking: 7, vertical: 9, routeRunning: 5, strength: 7, hands: 6, awareness: 6, size: 10, afterCatch: 6 } },
  { name: 'Sam Roush',         short: 'Roush',       team: 'CHI', teamName: 'Chicago Bears',          skin: '#f0c4a0', height: 77, weight: 243, starter: false, number: 87,
    attrs: { speed: 3, blocking: 5, vertical: 3, routeRunning: 2, strength: 5, hands: 3, awareness: 4, size: 8, afterCatch: 2 } },
  // CIN
  { name: 'Drew Sample',       short: 'Sample',      team: 'CIN', teamName: 'Cincinnati Bengals',     skin: '#f0c4a0', height: 77, weight: 242, starter: true,  captain: true,  number: 89,
    attrs: { speed: 3, blocking: 6, vertical: 3, routeRunning: 3, strength: 6, hands: 4, awareness: 5, size: 8, afterCatch: 2 } },
  { name: 'Mike Gesicki',      short: 'Gesicki',     team: 'CIN', teamName: 'Cincinnati Bengals',     skin: '#f0c4a0', height: 78, weight: 247, starter: false, number: 88,
    attrs: { speed: 7, blocking: 3, vertical: 10, routeRunning: 7, strength: 4, hands: 7, awareness: 5, size: 10, afterCatch: 6 } },
  { name: 'Tanner Hudson',     short: 'Hudson',      team: 'CIN', teamName: 'Cincinnati Bengals',     skin: '#f0c4a0', height: 77, weight: 246, starter: false, number: 87,
    attrs: { speed: 3, blocking: 5, vertical: 5, routeRunning: 5, strength: 4, hands: 5, awareness: 5, size: 8, afterCatch: 5 } },
  // CLE
  { name: 'Harold Fannin Jr.', short: 'Fannin',      team: 'CLE', teamName: 'Cleveland Browns',       skin: '#3a2010', height: 76, weight: 241, starter: true,  captain: true,  number: 44,
    attrs: { speed: 6, blocking: 2, vertical: 7, routeRunning: 9, strength: 3, hands: 9, awareness: 7, size: 6, afterCatch: 7 } },
  { name: 'Blake Whiteheart',  short: 'Whiteheart',  team: 'CLE', teamName: 'Cleveland Browns',       skin: '#f0c4a0', height: 77, weight: 248, starter: false, number: 86,
    attrs: { speed: 4, blocking: 6, vertical: 4, routeRunning: 3, strength: 5, hands: 4, awareness: 4, size: 8, afterCatch: 3 } },
  { name: 'Joe Royer',         short: 'Royer',       team: 'CLE', teamName: 'Cleveland Browns',       skin: '#f0c4a0', height: 76, weight: 242, starter: false, number: 18,
    attrs: { speed: 5, blocking: 4, vertical: 5, routeRunning: 4, strength: 4, hands: 5, awareness: 4, size: 6, afterCatch: 4 } },
  // DAL
  { name: 'Jake Ferguson',     short: 'Ferguson',    team: 'DAL', teamName: 'Dallas Cowboys',         skin: '#f0c4a0', height: 77, weight: 245, starter: true,  captain: true,  number: 87,
    attrs: { speed: 5, blocking: 5, vertical: 5, routeRunning: 7, strength: 6, hands: 6, awareness: 6, size: 8, afterCatch: 5 } },
  { name: 'Brevyn Spann-Ford', short: 'Spann-Ford',  team: 'DAL', teamName: 'Dallas Cowboys',         skin: '#3a2010', height: 78, weight: 252, starter: false, number: 89,
    attrs: { speed: 4, blocking: 7, vertical: 3, routeRunning: 3, strength: 7, hands: 5, awareness: 4, size: 10, afterCatch: 2 } },
  { name: 'Luke Schoonmaker',  short: 'Schoonmaker', team: 'DAL', teamName: 'Dallas Cowboys',         skin: '#f0c4a0', height: 77, weight: 246, starter: false, number: 86,
    attrs: { speed: 5, blocking: 5, vertical: 4, routeRunning: 5, strength: 4, hands: 5, awareness: 5, size: 8, afterCatch: 5 } },
  // DEN
  { name: 'Adam Trautman',     short: 'Trautman',    team: 'DEN', teamName: 'Denver Broncos',         skin: '#f0c4a0', height: 77, weight: 253, starter: true,  captain: true,  number: 82,
    attrs: { speed: 5, blocking: 5, vertical: 5, routeRunning: 5, strength: 5, hands: 5, awareness: 4, size: 9, afterCatch: 4 } },
  { name: 'Evan Engram',       short: 'Engram',      team: 'DEN', teamName: 'Denver Broncos',         skin: '#5e3c22', height: 76, weight: 236, starter: false, number: 1,
    attrs: { speed: 10, blocking: 3, vertical: 6, routeRunning: 7, strength: 3, hands: 7, awareness: 6, size: 5, afterCatch: 7 } },
  { name: 'Justin Joly',       short: 'Joly',        team: 'DEN', teamName: 'Denver Broncos',         skin: '#f0c4a0', height: 77, weight: 248, starter: false, number: 80,
    attrs: { speed: 4, blocking: 4, vertical: 4, routeRunning: 3, strength: 4, hands: 4, awareness: 4, size: 8, afterCatch: 3 } },
  // DET
  { name: 'Sam LaPorta',       short: 'LaPorta',     team: 'DET', teamName: 'Detroit Lions',          skin: '#f0c4a0', height: 75, weight: 245, starter: true,  captain: true,  number: 87,
    attrs: { speed: 7, blocking: 5, vertical: 7, routeRunning: 6, strength: 5, hands: 8, awareness: 6, size: 4, afterCatch: 6 } },
  { name: 'Brock Wright',      short: 'Wright',      team: 'DET', teamName: 'Detroit Lions',          skin: '#f0c4a0', height: 76, weight: 246, starter: false, number: 89,
    attrs: { speed: 4, blocking: 5, vertical: 3, routeRunning: 3, strength: 6, hands: 4, awareness: 4, size: 6, afterCatch: 3 } },
  { name: 'Tyler Conklin',     short: 'Conklin',     team: 'DET', teamName: 'Detroit Lions',          skin: '#f0c4a0', height: 75, weight: 240, starter: false, number: 83,
    attrs: { speed: 4, blocking: 6, vertical: 5, routeRunning: 6, strength: 5, hands: 5, awareness: 5, size: 3, afterCatch: 5 } },
  // GB
  { name: 'Tucker Kraft',      short: 'Kraft',       team: 'GB',  teamName: 'Green Bay Packers',      skin: '#f0c4a0', height: 77, weight: 255, starter: true,  captain: true,  number: 85,
    attrs: { speed: 6, blocking: 6, vertical: 7, routeRunning: 7, strength: 8, hands: 7, awareness: 6, size: 9, afterCatch: 9 } },
  { name: 'Josh Whyle',        short: 'Whyle',       team: 'GB',  teamName: 'Green Bay Packers',      skin: '#f0c4a0', height: 78, weight: 249, starter: false, number: 81,
    attrs: { speed: 6, blocking: 4, vertical: 6, routeRunning: 4, strength: 4, hands: 5, awareness: 4, size: 10, afterCatch: 6 } },
  { name: 'Luke Musgrave',     short: 'Musgrave',    team: 'GB',  teamName: 'Green Bay Packers',      skin: '#f0c4a0', height: 78, weight: 253, starter: false, number: 88,
    attrs: { speed: 7, blocking: 4, vertical: 7, routeRunning: 4, strength: 4, hands: 6, awareness: 5, size: 10, afterCatch: 7 } },
  // HOU
  { name: 'Dalton Schultz',    short: 'Schultz',     team: 'HOU', teamName: 'Houston Texans',         skin: '#f0c4a0', height: 77, weight: 242, starter: true,  captain: true,  number: 86,
    attrs: { speed: 5, blocking: 7, vertical: 5, routeRunning: 7, strength: 4, hands: 7, awareness: 7, size: 8, afterCatch: 5 } },
  { name: 'Foster Moreau',     short: 'Moreau',      team: 'HOU', teamName: 'Houston Texans',         skin: '#5e3c22', height: 77, weight: 254, starter: false, number: 87,
    attrs: { speed: 5, blocking: 6, vertical: 6, routeRunning: 6, strength: 6, hands: 6, awareness: 5, size: 9, afterCatch: 5 } },
  { name: 'Marlin Klein',      short: 'Klein',       team: 'HOU', teamName: 'Houston Texans',         skin: '#f0c4a0', height: 77, weight: 265, starter: false, number: 83,
    attrs: { speed: 3, blocking: 5, vertical: 3, routeRunning: 2, strength: 8, hands: 3, awareness: 4, size: 10, afterCatch: 2 } },
  // IND
  { name: 'Tyler Warren',      short: 'Warren',      team: 'IND', teamName: 'Indianapolis Colts',     skin: '#5e3c22', height: 78, weight: 248, starter: true,  captain: true,  number: 84,
    attrs: { speed: 6, blocking: 8, vertical: 7, routeRunning: 6, strength: 8, hands: 8, awareness: 6, size: 9, afterCatch: 9 } },
  { name: 'Mo Alie-Cox',       short: 'Alie-Cox',    team: 'IND', teamName: 'Indianapolis Colts',     skin: '#5e3c22', height: 78, weight: 267, starter: false, number: 81,
    attrs: { speed: 5, blocking: 8, vertical: 3, routeRunning: 3, strength: 9, hands: 4, awareness: 5, size: 10, afterCatch: 3 } },
  { name: 'Drew Ogletree',     short: 'Ogletree',    team: 'IND', teamName: 'Indianapolis Colts',     skin: '#5e3c22', height: 76, weight: 255, starter: false, number: 85,
    attrs: { speed: 5, blocking: 4, vertical: 5, routeRunning: 4, strength: 4, hands: 5, awareness: 4, size: 7, afterCatch: 5 } },
  // JAX
  { name: 'Brenton Strange',   short: 'Strange',     team: 'JAX', teamName: 'Jacksonville Jaguars',   skin: '#5e3c22', height: 75, weight: 249, starter: true,  captain: true,  number: 85,
    attrs: { speed: 5, blocking: 5, vertical: 6, routeRunning: 6, strength: 5, hands: 6, awareness: 6, size: 4, afterCatch: 5 } },
  { name: 'Nate Boerkircher',  short: 'Boerkircher', team: 'JAX', teamName: 'Jacksonville Jaguars',   skin: '#f0c4a0', height: 76, weight: 248, starter: false, number: 87,
    attrs: { speed: 4, blocking: 6, vertical: 4, routeRunning: 3, strength: 6, hands: 4, awareness: 4, size: 6, afterCatch: 3 } },
  { name: 'Tanner Koziol',     short: 'Koziol',      team: 'JAX', teamName: 'Jacksonville Jaguars',   skin: '#f0c4a0', height: 76, weight: 246, starter: false, number: 89,
    attrs: { speed: 4, blocking: 5, vertical: 3, routeRunning: 3, strength: 5, hands: 4, awareness: 3, size: 6, afterCatch: 3 } },
  // KC
  { name: 'Travis Kelce',      short: 'Kelce',       team: 'KC',  teamName: 'Kansas City Chiefs',     skin: '#f0c4a0', height: 77, weight: 256, starter: true,  captain: true,  number: 87,
    attrs: { speed: 5, blocking: 6, vertical: 4, routeRunning: 11, strength: 6, hands: 9, awareness: 10, size: 9, afterCatch: 7 } },
  { name: 'Noah Gray',         short: 'N. Gray',     team: 'KC',  teamName: 'Kansas City Chiefs',     skin: '#f0c4a0', height: 76, weight: 246, starter: false, number: 83,
    attrs: { speed: 5, blocking: 5, vertical: 5, routeRunning: 6, strength: 5, hands: 6, awareness: 6, size: 6, afterCatch: 5 } },
  { name: 'Jared Wiley',       short: 'Wiley',       team: 'KC',  teamName: 'Kansas City Chiefs',     skin: '#f0c4a0', height: 78, weight: 249, starter: false, number: 12,
    attrs: { speed: 5, blocking: 5, vertical: 5, routeRunning: 4, strength: 7, hands: 5, awareness: 4, size: 10, afterCatch: 5 } },
  // LAC
  { name: 'Oronde Gadsden II', short: 'Gadsden',     team: 'LAC', teamName: 'Los Angeles Chargers',   skin: '#5e3c22', height: 77, weight: 243, starter: true,  captain: true,  number: 86,
    attrs: { speed: 6, blocking: 3, vertical: 6, routeRunning: 7, strength: 4, hands: 6, awareness: 6, size: 8, afterCatch: 6 } },
  { name: 'Charlie Kolar',     short: 'Kolar',       team: 'LAC', teamName: 'Los Angeles Chargers',   skin: '#f0c4a0', height: 78, weight: 248, starter: false, number: 88,
    attrs: { speed: 4, blocking: 5, vertical: 5, routeRunning: 5, strength: 5, hands: 5, awareness: 5, size: 10, afterCatch: 4 } },
  { name: 'David Njoku',       short: 'Njoku',       team: 'LAC', teamName: 'Los Angeles Chargers',   skin: '#3a2010', height: 76, weight: 246, starter: false, number: 83,
    attrs: { speed: 7, blocking: 6, vertical: 8, routeRunning: 7, strength: 7, hands: 7, awareness: 6, size: 7, afterCatch: 8 } },
  // LAR
  { name: 'Colby Parkinson',   short: 'Parkinson',   team: 'LAR', teamName: 'Los Angeles Rams',       skin: '#f0c4a0', height: 79, weight: 255, starter: true,  captain: true,  number: 84,
    attrs: { speed: 4, blocking: 5, vertical: 7, routeRunning: 6, strength: 7, hands: 6, awareness: 6, size: 11, afterCatch: 5 } },
  { name: 'Tyler Higbee',      short: 'Higbee',      team: 'LAR', teamName: 'Los Angeles Rams',       skin: '#f0c4a0', height: 77, weight: 243, starter: false, number: 89,
    attrs: { speed: 4, blocking: 7, vertical: 5, routeRunning: 6, strength: 6, hands: 5, awareness: 5, size: 8, afterCatch: 4 } },
  { name: 'Terrance Ferguson', short: 'T. Ferguson', team: 'LAR', teamName: 'Los Angeles Rams',       skin: '#5e3c22', height: 77, weight: 252, starter: false, number: 18,
    attrs: { speed: 7, blocking: 3, vertical: 6, routeRunning: 5, strength: 4, hands: 5, awareness: 4, size: 9, afterCatch: 5 } },
  // LV
  { name: 'Brock Bowers',      short: 'Bowers',      team: 'LV',  teamName: 'Las Vegas Raiders',      skin: '#f0c4a0', height: 76, weight: 230, starter: true,  captain: true,  number: 89,
    attrs: { speed: 8, blocking: 4, vertical: 8, routeRunning: 10, strength: 4, hands: 9, awareness: 9, size: 5, afterCatch: 9 } },
  { name: 'Michael Mayer',     short: 'Mayer',       team: 'LV',  teamName: 'Las Vegas Raiders',      skin: '#f0c4a0', height: 76, weight: 260, starter: false, number: 87,
    attrs: { speed: 4, blocking: 7, vertical: 5, routeRunning: 5, strength: 8, hands: 6, awareness: 5, size: 7, afterCatch: 4 } },
  { name: 'Ian Thomas',        short: 'Thomas',      team: 'LV',  teamName: 'Las Vegas Raiders',      skin: '#5e3c22', height: 76, weight: 259, starter: false, number: 80,
    attrs: { speed: 3, blocking: 7, vertical: 3, routeRunning: 3, strength: 7, hands: 4, awareness: 5, size: 7, afterCatch: 3 } },
  // MIA
  { name: 'Greg Dulcich',      short: 'Dulcich',     team: 'MIA', teamName: 'Miami Dolphins',         skin: '#f0c4a0', height: 76, weight: 245, starter: true,  captain: true,  number: 85,
    attrs: { speed: 6, blocking: 3, vertical: 6, routeRunning: 6, strength: 4, hands: 6, awareness: 5, size: 6, afterCatch: 6 } },
  { name: 'Will Kacmarek',     short: 'Kacmarek',    team: 'MIA', teamName: 'Miami Dolphins',         skin: '#f0c4a0', height: 78, weight: 247, starter: false, number: 82,
    attrs: { speed: 4, blocking: 5, vertical: 4, routeRunning: 4, strength: 5, hands: 5, awareness: 6, size: 10, afterCatch: 4 } },
  { name: 'Seydou Traore',     short: 'Traore',      team: 'MIA', teamName: 'Miami Dolphins',         skin: '#3a2010', height: 77, weight: 246, starter: false, number: 49,
    attrs: { speed: 5, blocking: 4, vertical: 5, routeRunning: 3, strength: 5, hands: 4, awareness: 4, size: 8, afterCatch: 4 } },
  // MIN
  { name: 'T.J. Hockenson',    short: 'Hockenson',   team: 'MIN', teamName: 'Minnesota Vikings',      skin: '#f0c4a0', height: 76, weight: 251, starter: true,  captain: true,  number: 87,
    attrs: { speed: 6, blocking: 5, vertical: 6, routeRunning: 7, strength: 6, hands: 7, awareness: 6, size: 7, afterCatch: 6 } },
  { name: 'Josh Oliver',       short: 'Oliver',      team: 'MIN', teamName: 'Minnesota Vikings',      skin: '#5e3c22', height: 77, weight: 249, starter: false, number: 84,
    attrs: { speed: 5, blocking: 4, vertical: 5, routeRunning: 4, strength: 5, hands: 6, awareness: 6, size: 8, afterCatch: 5 } },
  { name: 'Ben Yurosek',       short: 'Yurosek',     team: 'MIN', teamName: 'Minnesota Vikings',      skin: '#f0c4a0', height: 77, weight: 246, starter: false, number: 85,
    attrs: { speed: 5, blocking: 4, vertical: 5, routeRunning: 4, strength: 4, hands: 3, awareness: 5, size: 8, afterCatch: 3 } },
  // NE
  { name: 'Hunter Henry',      short: 'Henry',       team: 'NE',  teamName: 'New England Patriots',   skin: '#f0c4a0', height: 77, weight: 250, starter: true,  captain: true,  number: 85,
    attrs: { speed: 5, blocking: 6, vertical: 6, routeRunning: 7, strength: 6, hands: 8, awareness: 7, size: 9, afterCatch: 5 } },
  { name: 'Eli Raridon',       short: 'Raridon',     team: 'NE',  teamName: 'New England Patriots',   skin: '#f0c4a0', height: 78, weight: 252, starter: false, number: 82,
    attrs: { speed: 5, blocking: 5, vertical: 5, routeRunning: 5, strength: 7, hands: 5, awareness: 4, size: 10, afterCatch: 5 } },
  { name: 'C.J. Dippre',       short: 'Dippre',      team: 'NE',  teamName: 'New England Patriots',   skin: '#5e3c22', height: 77, weight: 245, starter: false, number: 81,
    attrs: { speed: 6, blocking: 4, vertical: 4, routeRunning: 3, strength: 6, hands: 4, awareness: 4, size: 8, afterCatch: 3 } },
  // NO
  { name: 'Juwan Johnson',     short: 'J. Johnson',  team: 'NO',  teamName: 'New Orleans Saints',     skin: '#3a2010', height: 76, weight: 239, starter: true,  captain: true,  number: 83,
    attrs: { speed: 6, blocking: 4, vertical: 6, routeRunning: 8, strength: 4, hands: 8, awareness: 7, size: 5, afterCatch: 7 } },
  { name: 'Noah Fant',         short: 'Fant',        team: 'NO',  teamName: 'New Orleans Saints',     skin: '#5e3c22', height: 76, weight: 249, starter: false, number: 87,
    attrs: { speed: 8, blocking: 5, vertical: 6, routeRunning: 5, strength: 4, hands: 6, awareness: 5, size: 6, afterCatch: 7 } },
  { name: 'Oscar Delp',        short: 'Delp',        team: 'NO',  teamName: 'New Orleans Saints',     skin: '#f0c4a0', height: 77, weight: 245, starter: false, number: 88,
    attrs: { speed: 6, blocking: 4, vertical: 5, routeRunning: 5, strength: 6, hands: 5, awareness: 4, size: 8, afterCatch: 5 } },
  // NYG
  { name: 'Isaiah Likely',     short: 'Likely',      team: 'NYG', teamName: 'New York Giants',        skin: '#5e3c22', height: 76, weight: 245, starter: true,  captain: true,  number: 9,
    attrs: { speed: 7, blocking: 3, vertical: 7, routeRunning: 7, strength: 4, hands: 7, awareness: 7, size: 6, afterCatch: 6 } },
  { name: 'Theo Johnson',      short: 'T. Johnson',  team: 'NYG', teamName: 'New York Giants',        skin: '#5e3c22', height: 78, weight: 259, starter: false, number: 84,
    attrs: { speed: 5, blocking: 5, vertical: 8, routeRunning: 5, strength: 7, hands: 6, awareness: 5, size: 10, afterCatch: 6 } },
  { name: 'Chris Manhertz',    short: 'Manhertz',    team: 'NYG', teamName: 'New York Giants',        skin: '#5e3c22', height: 77, weight: 247, starter: false, number: 85,
    attrs: { speed: 3, blocking: 6, vertical: 3, routeRunning: 2, strength: 6, hands: 3, awareness: 6, size: 8, afterCatch: 2 } },
  // NYJ
  { name: 'Mason Taylor',      short: 'Taylor',      team: 'NYJ', teamName: 'New York Jets',          skin: '#f0c4a0', height: 77, weight: 251, starter: true,  captain: true,  number: 85,
    attrs: { speed: 6, blocking: 5, vertical: 6, routeRunning: 5, strength: 6, hands: 6, awareness: 4, size: 9, afterCatch: 4 } },
  { name: 'Kenyon Sadiq',      short: 'Sadiq',       team: 'NYJ', teamName: 'New York Jets',          skin: '#5e3c22', height: 77, weight: 243, starter: false, number: 16,
    attrs: { speed: 11, blocking: 3, vertical: 10, routeRunning: 4, strength: 4, hands: 4, awareness: 3, size: 8, afterCatch: 6 } },
  { name: 'Jeremy Ruckert',    short: 'Ruckert',     team: 'NYJ', teamName: 'New York Jets',          skin: '#f0c4a0', height: 77, weight: 254, starter: false, number: 89,
    attrs: { speed: 4, blocking: 5, vertical: 5, routeRunning: 5, strength: 6, hands: 4, awareness: 5, size: 9, afterCatch: 4 } },
  // PHI
  { name: 'Dallas Goedert',    short: 'Goedert',     team: 'PHI', teamName: 'Philadelphia Eagles',    skin: '#f0c4a0', height: 77, weight: 256, starter: true,  captain: true,  number: 88,
    attrs: { speed: 6, blocking: 6, vertical: 7, routeRunning: 7, strength: 7, hands: 8, awareness: 7, size: 9, afterCatch: 6 } },
  { name: 'Johnny Mundt',      short: 'Mundt',       team: 'PHI', teamName: 'Philadelphia Eagles',    skin: '#f0c4a0', height: 77, weight: 244, starter: false, number: 83,
    attrs: { speed: 3, blocking: 7, vertical: 3, routeRunning: 3, strength: 6, hands: 4, awareness: 3, size: 8, afterCatch: 3 } },
  { name: 'Eli Stowers',       short: 'Stowers',     team: 'PHI', teamName: 'Philadelphia Eagles',    skin: '#5e3c22', height: 77, weight: 250, starter: false, number: 87,
    attrs: { speed: 8, blocking: 0, vertical: 11, routeRunning: 3, strength: 4, hands: 4, awareness: 3, size: 9, afterCatch: 5 } },
  // PIT
  { name: 'Pat Freiermuth',    short: 'Freiermuth',  team: 'PIT', teamName: 'Pittsburgh Steelers',    skin: '#f0c4a0', height: 77, weight: 258, starter: true,  captain: true,  number: 88,
    attrs: { speed: 5, blocking: 8, vertical: 6, routeRunning: 7, strength: 7, hands: 6, awareness: 7, size: 9, afterCatch: 5 } },
  { name: 'Darnell Washington', short: 'Washington',  team: 'PIT', teamName: 'Pittsburgh Steelers',   skin: '#3a2010', height: 79, weight: 264, starter: false, number: 80,
    attrs: { speed: 5, blocking: 10, vertical: 4, routeRunning: 2, strength: 10, hands: 7, awareness: 5, size: 11, afterCatch: 5 } },
  { name: 'Robert Tonyan',     short: 'Tonyan',      team: 'PIT', teamName: 'Pittsburgh Steelers',    skin: '#f0c4a0', height: 77, weight: 240, starter: false, number: 83,
    attrs: { speed: 5, blocking: 4, vertical: 4, routeRunning: 5, strength: 3, hands: 6, awareness: 5, size: 8, afterCatch: 4 } },
  // SEA
  { name: 'AJ Barner',         short: 'Barner',      team: 'SEA', teamName: 'Seattle Seahawks',       skin: '#f0c4a0', height: 76, weight: 240, starter: true,  captain: true,  number: 88,
    attrs: { speed: 6, blocking: 9, vertical: 6, routeRunning: 6, strength: 7, hands: 6, awareness: 6, size: 6, afterCatch: 5 } },
  { name: 'Eric Saubert',      short: 'Saubert',     team: 'SEA', teamName: 'Seattle Seahawks',       skin: '#f0c4a0', height: 77, weight: 248, starter: false, number: 81,
    attrs: { speed: 4, blocking: 6, vertical: 4, routeRunning: 4, strength: 5, hands: 4, awareness: 5, size: 8, afterCatch: 3 } },
  { name: 'Elijah Arroyo',     short: 'Arroyo',      team: 'SEA', teamName: 'Seattle Seahawks',       skin: '#5e3c22', height: 77, weight: 254, starter: false, number: 18,
    attrs: { speed: 6, blocking: 4, vertical: 6, routeRunning: 6, strength: 3, hands: 5, awareness: 4, size: 9, afterCatch: 6 } },
  // SF
  { name: 'George Kittle',     short: 'Kittle',      team: 'SF',  teamName: 'San Francisco 49ers',    skin: '#f0c4a0', height: 76, weight: 250, starter: true,  captain: true,  number: 85,
    attrs: { speed: 8, blocking: 11, vertical: 6, routeRunning: 9, strength: 10, hands: 9, awareness: 9, size: 6, afterCatch: 11 } },
  { name: 'Jake Tonges',       short: 'Tonges',      team: 'SF',  teamName: 'San Francisco 49ers',    skin: '#f0c4a0', height: 77, weight: 252, starter: false, number: 88,
    attrs: { speed: 4, blocking: 6, vertical: 5, routeRunning: 4, strength: 7, hands: 5, awareness: 4, size: 9, afterCatch: 4 } },
  { name: 'Luke Farrell',      short: 'Farrell',     team: 'SF',  teamName: 'San Francisco 49ers',    skin: '#f0c4a0', height: 77, weight: 249, starter: false, number: 89,
    attrs: { speed: 4, blocking: 7, vertical: 3, routeRunning: 3, strength: 6, hands: 4, awareness: 5, size: 8, afterCatch: 3 } },
  // TB
  { name: 'Cade Otton',        short: 'Otton',       team: 'TB',  teamName: 'Tampa Bay Buccaneers',   skin: '#f0c4a0', height: 77, weight: 247, starter: true,  captain: true,  number: 88,
    attrs: { speed: 5, blocking: 5, vertical: 6, routeRunning: 7, strength: 5, hands: 6, awareness: 7, size: 8, afterCatch: 5 } },
  { name: 'Payne Durham',      short: 'Durham',      team: 'TB',  teamName: 'Tampa Bay Buccaneers',   skin: '#f0c4a0', height: 77, weight: 248, starter: false, number: 87,
    attrs: { speed: 4, blocking: 5, vertical: 5, routeRunning: 4, strength: 5, hands: 5, awareness: 4, size: 8, afterCatch: 3 } },
  { name: 'Ko Kieft',          short: 'Kieft',       team: 'TB',  teamName: 'Tampa Bay Buccaneers',   skin: '#f0c4a0', height: 76, weight: 251, starter: false, number: 41,
    attrs: { speed: 3, blocking: 6, vertical: 3, routeRunning: 3, strength: 6, hands: 3, awareness: 5, size: 7, afterCatch: 2 } },
  // TEN
  { name: 'Gunnar Helm',       short: 'Helm',        team: 'TEN', teamName: 'Tennessee Titans',       skin: '#f0c4a0', height: 77, weight: 241, starter: true,  captain: true,  number: 84,
    attrs: { speed: 4, blocking: 5, vertical: 4, routeRunning: 5, strength: 6, hands: 6, awareness: 5, size: 8, afterCatch: 5 } },
  { name: 'Daniel Bellinger',  short: 'Bellinger',   team: 'TEN', teamName: 'Tennessee Titans',       skin: '#5e3c22', height: 77, weight: 257, starter: false, number: 82,
    attrs: { speed: 5, blocking: 5, vertical: 5, routeRunning: 5, strength: 7, hands: 6, awareness: 5, size: 9, afterCatch: 5 } },
  { name: 'Kylen Granson',     short: 'Granson',     team: 'TEN', teamName: 'Tennessee Titans',       skin: '#f0c4a0', height: 76, weight: 236, starter: false, number: 86,
    attrs: { speed: 6, blocking: 3, vertical: 6, routeRunning: 4, strength: 3, hands: 5, awareness: 5, size: 3, afterCatch: 5 } },
  // WAS
  { name: 'Chig Okonkwo',     short: 'Okonkwo',     team: 'WAS', teamName: 'Washington Commanders',  skin: '#3a2010', height: 75, weight: 244, starter: true,  captain: true,  number: 85,
    attrs: { speed: 9, blocking: 2, vertical: 7, routeRunning: 7, strength: 4, hands: 7, awareness: 6, size: 4, afterCatch: 8 } },
  { name: 'John Bates',        short: 'Bates',       team: 'WAS', teamName: 'Washington Commanders',  skin: '#f0c4a0', height: 77, weight: 255, starter: false, number: 87,
    attrs: { speed: 3, blocking: 7, vertical: 3, routeRunning: 3, strength: 8, hands: 3, awareness: 4, size: 9, afterCatch: 2 } },
  { name: 'Ben Sinnott',       short: 'Sinnott',     team: 'WAS', teamName: 'Washington Commanders',  skin: '#f0c4a0', height: 76, weight: 245, starter: false, number: 82,
    attrs: { speed: 5, blocking: 5, vertical: 5, routeRunning: 6, strength: 4, hands: 5, awareness: 4, size: 6, afterCatch: 4 } },
]

export const TES = _TES.map(te => ({
  ...te, attrs: { ...te.attrs }, ...TEAM_COLOR[te.team], ovr: _teOVR(te.attrs),
}))
export const TE_PHYSICALS = Object.fromEntries(_TES.map(te => [te.name, { height: te.height, weight: te.weight }]))
