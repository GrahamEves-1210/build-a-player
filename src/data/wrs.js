import { TEAMS, ATTR } from './qbs'
const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

export const WR_TYPES      = ['speed', 'bodyControl', 'vertical', 'routeRunning', 'release', 'hands', 'awareness', 'size', 'afterCatch']
export const WR_LITE_TYPES = ['speed', 'hands', 'routeRunning', 'size']

export const WR_CATEGORIES = [
  { id: 'physical', label: 'Physical', types: ['speed', 'bodyControl', 'vertical', 'size'] },
  { id: 'skill',    label: 'Skill',    types: ['routeRunning', 'release', 'hands', 'awareness', 'afterCatch'] },
]

const _WR_W = { hands:0.14, routeRunning:0.14, speed:0.14, size:0.14, awareness:0.10, afterCatch:0.10, bodyControl:0.08, vertical:0.08, release:0.08 }
function _wrOVR(a) {
  const vals = WR_TYPES.map(t => a[t] ?? 0)
  const avg  = WR_TYPES.reduce((s, t) => s + (a[t] ?? 0) * _WR_W[t], 0)
  const base = 60 + 2.1 * avg + 0.21 * avg * avg
  const spread = Math.max(...vals) - Math.min(...vals)
  const minVal = Math.min(...vals)
  const bonus  = spread <= 1 ? 2.5 : spread <= 2 ? 1.0 : spread <= 3 ? 0.3 : 0
  const minBonus = minVal >= 9 ? 2.0 : minVal >= 8 ? 0.5 : 0
  return Math.min(99, Math.max(0, Math.round(base + bonus + minBonus)))
}

// Skin tone palette:
//   #f0c4a0 — white   #b07848 — mixed/Polynesian/Latino   #5e3c22 — Black   #3a2010 — Black (very dark)
//
// Ratings 0–11: 11=S-tier  10=top-2 NFL  9=top-5  8=top-10/Pro Bowl  7=above avg  6=avg starter  5=fringe  4=backup  3=depth  2=very limited  1=barely
// Size: 75% height + 25% weight, 0-11. Anchors: 66"/155lb=0, Mike Evans 77"/231lb=11

const _WRS = [
  // ARI
  { name: 'Marvin Harrison Jr.', short: 'Harrison',    team: 'ARI', teamName: 'Arizona Cardinals',     skin: '#5e3c22', height: 76, weight: 205, starter: true,  captain: true,  number: 18,
    attrs: { speed: 7,  bodyControl: 6,  vertical: 8,  routeRunning: 6,  release: 8,  hands: 4,  awareness: 5,  size: 9,  afterCatch: 5  } },
  { name: 'Michael Wilson',      short: 'Wilson',      team: 'ARI', teamName: 'Arizona Cardinals',     skin: '#5e3c22', height: 75, weight: 220, starter: false, number: 14,
    attrs: { speed: 6,  bodyControl: 7,  vertical: 6,  routeRunning: 5,  release: 6,  hands: 6,  awareness: 5,  size: 9,  afterCatch: 5  } },
  { name: 'Kendrick Bourne',     short: 'Bourne',      team: 'ARI', teamName: 'Arizona Cardinals',     skin: '#5e3c22', height: 73, weight: 203, starter: false, number: 84,
    attrs: { speed: 5,  bodyControl: 5,  vertical: 5,  routeRunning: 6,  release: 5,  hands: 4,  awareness: 5,  size: 7,  afterCatch: 3  } },
  { name: 'Simi Fehoko',         short: 'Fehoko',      team: 'ARI', teamName: 'Arizona Cardinals',     skin: '#b07848', height: 76, weight: 225, starter: false, number: 19,
    attrs: { speed: 3,  bodyControl: 3,  vertical: 6,  routeRunning: 2,  release: 3,  hands: 4,  awareness: 4,  size: 10, afterCatch: 3  } },
  // ATL
  { name: 'Drake London',        short: 'London',      team: 'ATL', teamName: 'Atlanta Falcons',       skin: '#5e3c22', height: 76, weight: 219, starter: true,  captain: true,  number: 5,
    attrs: { speed: 6,  bodyControl: 9,  vertical: 9,  routeRunning: 7,  release: 7,  hands: 9,  awareness: 7,  size: 10, afterCatch: 6  } },
  { name: 'Jahan Dotson',        short: 'Dotson',      team: 'ATL', teamName: 'Atlanta Falcons',       skin: '#5e3c22', height: 71, weight: 178, starter: false, number: 1,
    attrs: { speed: 7,  bodyControl: 5,  vertical: 7,  routeRunning: 5,  release: 5,  hands: 5,  awareness: 5,  size: 5,  afterCatch: 5  } },
  { name: 'Olamide Zaccheaus',   short: 'Zaccheaus',   team: 'ATL', teamName: 'Atlanta Falcons',       skin: '#3a2010', height: 68, weight: 192, starter: false, number: 17,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 5,  routeRunning: 5,  release: 5,  hands: 4,  awareness: 5,  size: 3,  afterCatch: 7  } },
  { name: 'Zachariah Branch',    short: 'Branch',      team: 'ATL', teamName: 'Atlanta Falcons',       skin: '#5e3c22', height: 71, weight: 170, starter: false, number: 2,
    attrs: { speed: 9,  bodyControl: 5,  vertical: 6,  routeRunning: 3,  release: 2,  hands: 4,  awareness: 3,  size: 4,  afterCatch: 6  } },
  // BAL
  { name: 'Zay Flowers',         short: 'Flowers',     team: 'BAL', teamName: 'Baltimore Ravens',      skin: '#3a2010', height: 69, weight: 175, starter: true,  captain: true,  number: 4,
    attrs: { speed: 9,  bodyControl: 9,  vertical: 5,  routeRunning: 8,  release: 8,  hands: 6,  awareness: 7,  size: 3,  afterCatch: 8  } },
  { name: 'Rashod Bateman',      short: 'Bateman',     team: 'BAL', teamName: 'Baltimore Ravens',      skin: '#5e3c22', height: 72, weight: 190, starter: false, number: 1,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 6,  routeRunning: 6,  release: 6,  hands: 4,  awareness: 4,  size: 6,  afterCatch: 4  } },
  { name: 'Devontez Walker',     short: 'Walker',      team: 'BAL', teamName: 'Baltimore Ravens',      skin: '#5e3c22', height: 73, weight: 190, starter: false, number: 14,
    attrs: { speed: 8,  bodyControl: 3,  vertical: 6,  routeRunning: 2,  release: 4,  hands: 2,  awareness: 3,  size: 7,  afterCatch: 3  } },
  { name: "Ja'Kobi Lane",        short: 'Lane',        team: 'BAL', teamName: 'Baltimore Ravens',      skin: '#5e3c22', height: 72, weight: 195, starter: false, number: 15,
    attrs: { speed: 5,  bodyControl: 4,  vertical: 8,  routeRunning: 3,  release: 3,  hands: 6,  awareness: 2,  size: 6,  afterCatch: 3  } },
  // BUF
  { name: 'DJ Moore',            short: 'DJ Moore',    team: 'BUF', teamName: 'Buffalo Bills',         skin: '#3a2010', height: 72, weight: 210, starter: true,  captain: true,  number: 2,
    attrs: { speed: 8,  bodyControl: 7,  vertical: 7,  routeRunning: 6,  release: 7,  hands: 7,  awareness: 7,  size: 6,  afterCatch: 9  } },
  { name: 'Joshua Palmer',       short: 'Palmer',      team: 'BUF', teamName: 'Buffalo Bills',         skin: '#5e3c22', height: 73, weight: 200, starter: false, number: 5,
    attrs: { speed: 5,  bodyControl: 5,  vertical: 4,  routeRunning: 6,  release: 5,  hands: 5,  awareness: 5,  size: 7,  afterCatch: 4  } },
  { name: 'Khalil Shakir',       short: 'Shakir',      team: 'BUF', teamName: 'Buffalo Bills',         skin: '#5e3c22', height: 71, weight: 190, starter: false, number: 10,
    attrs: { speed: 7,  bodyControl: 6,  vertical: 4,  routeRunning: 5,  release: 3,  hands: 5,  awareness: 7,  size: 5,  afterCatch: 6  } },
  { name: 'Skyler Bell',         short: 'Bell',        team: 'BUF', teamName: 'Buffalo Bills',         skin: '#b07848', height: 71, weight: 188, starter: false, number: 15,
    attrs: { speed: 6,  bodyControl: 4,  vertical: 3,  routeRunning: 3,  release: 4,  hands: 4,  awareness: 3,  size: 5,  afterCatch: 4  } },
  // CAR
  { name: 'Tetairoa McMillan',   short: 'McMillan',    team: 'CAR', teamName: 'Carolina Panthers',     skin: '#b07848', height: 77, weight: 212, starter: true,  captain: true,  number: 4,
    attrs: { speed: 6,  bodyControl: 9,  vertical: 7,  routeRunning: 6,  release: 6,  hands: 8,  awareness: 7,  size: 10, afterCatch: 7  } },
  { name: 'Xavier Legette',      short: 'Legette',     team: 'CAR', teamName: 'Carolina Panthers',     skin: '#5e3c22', height: 74, weight: 221, starter: false, number: 17,
    attrs: { speed: 7,  bodyControl: 0,  vertical: 7,  routeRunning: 3,  release: 3,  hands: 2,  awareness: 3,  size: 8,  afterCatch: 3  } },
  { name: 'John Metchie III',    short: 'Metchie',     team: 'CAR', teamName: 'Carolina Panthers',     skin: '#b07848', height: 72, weight: 195, starter: false, number: 8,
    attrs: { speed: 6,  bodyControl: 6,  vertical: 5,  routeRunning: 4,  release: 4,  hands: 4,  awareness: 4,  size: 6,  afterCatch: 5  } },
  { name: 'Chris Brazzell II',   short: 'Brazzell',    team: 'CAR', teamName: 'Carolina Panthers',     skin: '#5e3c22', height: 77, weight: 210, starter: false, number: 18,
    attrs: { speed: 8,  bodyControl: 5,  vertical: 7,  routeRunning: 3,  release: 3,  hands: 4,  awareness: 3,  size: 10, afterCatch: 3  } },
  { name: 'Jalen Coker',         short: 'Coker',       team: 'CAR', teamName: 'Carolina Panthers',     skin: '#3a2010', height: 74, weight: 200, starter: false, number: 15,
    attrs: { speed: 6,  bodyControl: 6,  vertical: 9,  routeRunning: 5,  release: 5,  hands: 8,  awareness: 8,  size: 8,  afterCatch: 4  } },
  // CHI
  { name: 'Rome Odunze',         short: 'Odunze',      team: 'CHI', teamName: 'Chicago Bears',         skin: '#5e3c22', height: 75, weight: 215, starter: true,  captain: true,  number: 15,
    attrs: { speed: 8,  bodyControl: 8,  vertical: 9,  routeRunning: 7,  release: 7,  hands: 8,  awareness: 6,  size: 9,  afterCatch: 6  } },
  { name: 'Luther Burden III',   short: 'Burden',      team: 'CHI', teamName: 'Chicago Bears',         skin: '#3a2010', height: 72, weight: 210, starter: false, number: 2,
    attrs: { speed: 9,  bodyControl: 7,  vertical: 6,  routeRunning: 5,  release: 5,  hands: 6,  awareness: 5,  size: 6,  afterCatch: 8  } },
  { name: 'Scotty Miller',       short: 'Miller',      team: 'CHI', teamName: 'Chicago Bears',         skin: '#f0c4a0', height: 70, weight: 174, starter: false, number: 10,
    attrs: { speed: 9,  bodyControl: 4,  vertical: 4,  routeRunning: 4,  release: 5,  hands: 4,  awareness: 4,  size: 4,  afterCatch: 4  } },
  { name: 'Kalif Raymond',       short: 'Raymond',     team: 'CHI', teamName: 'Chicago Bears',         skin: '#5e3c22', height: 69, weight: 170, starter: false, number: 4,
    attrs: { speed: 9,  bodyControl: 4,  vertical: 4,  routeRunning: 4,  release: 4,  hands: 5,  awareness: 5,  size: 3,  afterCatch: 5  } },
  // CIN
  { name: "Ja'Marr Chase",       short: 'Chase',       team: 'CIN', teamName: 'Cincinnati Bengals',    skin: '#3a2010', height: 72, weight: 201, starter: true,  captain: true,  number: 1,
    attrs: { speed: 10, bodyControl: 11, vertical: 10, routeRunning: 9, release: 10, hands: 11, awareness: 9, size: 6,  afterCatch: 11 } },
  { name: 'Tee Higgins',         short: 'Higgins',     team: 'CIN', teamName: 'Cincinnati Bengals',    skin: '#3a2010', height: 76, weight: 216, starter: false, captain: true,  number: 5,
    attrs: { speed: 7,  bodyControl: 10,  vertical: 10, routeRunning: 7,  release: 8,  hands: 10,  awareness: 7,  size: 10, afterCatch: 5  } },
  { name: 'Andrei Iosivas',      short: 'Iosivas',     team: 'CIN', teamName: 'Cincinnati Bengals',    skin: '#b07848', height: 75, weight: 200, starter: false, number: 80,
    attrs: { speed: 8,  bodyControl: 4,  vertical: 7,  routeRunning: 4,  release: 5,  hands: 4,  awareness: 4,  size: 8,  afterCatch: 4  } },
  { name: 'Colbie Young',        short: 'Young',       team: 'CIN', teamName: 'Cincinnati Bengals',    skin: '#5e3c22', height: 75, weight: 215, starter: false, number: 19,
    attrs: { speed: 4,  bodyControl: 3,  vertical: 6,  routeRunning: 3,  release: 4,  hands: 4,  awareness: 3,  size: 9,  afterCatch: 3  } },
  // CLE
  { name: 'Denzel Boston',       short: 'Boston',      team: 'CLE', teamName: 'Cleveland Browns',      skin: '#5e3c22', height: 76, weight: 215, starter: true,  captain: true,  number: 1,
    attrs: { speed: 8,  bodyControl: 4,  vertical: 7,  routeRunning: 4,  release: 4,  hands: 6,  awareness: 5,  size: 10, afterCatch: 4  } },
  { name: 'Jerry Jeudy',         short: 'Jeudy',       team: 'CLE', teamName: 'Cleveland Browns',      skin: '#3a2010', height: 73, weight: 195, starter: false, number: 3,
    attrs: { speed: 8,  bodyControl: 4,  vertical: 5,  routeRunning: 9,  release: 7,  hands: 3,  awareness: 2,  size: 7,  afterCatch: 4  } },
  { name: 'Cedric Tillman',      short: 'Tillman',     team: 'CLE', teamName: 'Cleveland Browns',      skin: '#5e3c22', height: 75, weight: 210, starter: false, number: 11,
    attrs: { speed: 4,  bodyControl: 6,  vertical: 7,  routeRunning: 3,  release: 5,  hands: 6,  awareness: 5,  size: 9,  afterCatch: 2  } },
  { name: 'Malachi Corley',      short: 'Corley',      team: 'CLE', teamName: 'Cleveland Browns',      skin: '#3a2010', height: 70, weight: 215, starter: false, number: 84,
    attrs: { speed: 6,  bodyControl: 2,  vertical: 4,  routeRunning: 2,  release: 4,  hands: 3,  awareness: 4,  size: 5,  afterCatch: 7  } },
  // DAL
  { name: 'CeeDee Lamb',         short: 'Lamb',        team: 'DAL', teamName: 'Dallas Cowboys',        skin: '#5e3c22', height: 74, weight: 198, starter: true,  captain: true,  number: 88,
    attrs: { speed: 7,  bodyControl: 11, vertical: 9,  routeRunning: 9, release: 10, hands: 9, awareness: 9,  size: 8,  afterCatch: 9 } },
  { name: 'George Pickens',      short: 'Pickens',     team: 'DAL', teamName: 'Dallas Cowboys',        skin: '#3a2010', height: 75, weight: 200, starter: false, captain: true,  number: 11,
    attrs: { speed: 8,  bodyControl: 11,  vertical: 10, routeRunning: 6,  release: 8,  hands: 11,  awareness: 6,  size: 8,  afterCatch: 6  } },
  { name: 'KaVontae Turpin',     short: 'Turpin',      team: 'DAL', teamName: 'Dallas Cowboys',        skin: '#3a2010', height: 69, weight: 155, starter: false, number: 9,
    attrs: { speed: 10, bodyControl: 5,  vertical: 7,  routeRunning: 5,  release: 3,  hands: 3,  awareness: 5,  size: 2,  afterCatch: 9  } },
  { name: 'Ryan Flournoy',       short: 'Flournoy',    team: 'DAL', teamName: 'Dallas Cowboys',        skin: '#5e3c22', height: 74, weight: 200, starter: false, number: 18,
    attrs: { speed: 5,  bodyControl: 3,  vertical: 3,  routeRunning: 3,  release: 3,  hands: 4,  awareness: 3,  size: 8,  afterCatch: 3  } },
  // DEN
  { name: 'Courtland Sutton',    short: 'Sutton',      team: 'DEN', teamName: 'Denver Broncos',        skin: '#5e3c22', height: 76, weight: 218, starter: true,  captain: true,  number: 14,
    attrs: { speed: 7,  bodyControl: 9,  vertical: 9, routeRunning: 6,  release: 6,  hands: 9,  awareness: 8,  size: 10, afterCatch: 5  } },
  { name: 'Jaylen Waddle',       short: 'Waddle',      team: 'DEN', teamName: 'Denver Broncos',        skin: '#3a2010', height: 70, weight: 185, starter: false, captain: true,  number: 17,
    attrs: { speed: 11, bodyControl: 7,  vertical: 7,  routeRunning: 7,  release: 8,  hands: 7,  awareness: 7,  size: 4,  afterCatch: 9  } },
  { name: 'Marvin Mims Jr.',     short: 'Mims',        team: 'DEN', teamName: 'Denver Broncos',        skin: '#3a2010', height: 71, weight: 173, starter: false, number: 15,
    attrs: { speed: 9,  bodyControl: 5,  vertical: 7,  routeRunning: 3,  release: 6,  hands: 6,  awareness: 6,  size: 4,  afterCatch: 5  } },
  { name: "Lil'Jordan Humphrey", short: 'Humphrey',    team: 'DEN', teamName: 'Denver Broncos',        skin: '#5e3c22', height: 76, weight: 225, starter: false, number: 13,
    attrs: { speed: 1,  bodyControl: 5,  vertical: 6,  routeRunning: 3,  release: 4,  hands: 5,  awareness: 5,  size: 10, afterCatch: 2  } },
  { name: 'Troy Franklin',       short: 'Franklin',    team: 'DEN', teamName: 'Denver Broncos',        skin: '#5e3c22', height: 74, weight: 178, starter: false, number: 3,
    attrs: { speed: 7,  bodyControl: 4,  vertical: 4,  routeRunning: 3,  release: 2,  hands: 4,  awareness: 3,  size: 7,  afterCatch: 3  } },
  // DET
  { name: 'Jameson Williams',    short: 'Jam. Williams', team: 'DET', teamName: 'Detroit Lions',       skin: '#3a2010', height: 74, weight: 196, starter: true,  captain: true,  number: 9,
    attrs: { speed: 11, bodyControl: 6,  vertical: 7,  routeRunning: 5,  release: 7,  hands: 5,  awareness: 4,  size: 7,  afterCatch: 7  } },
  { name: 'Amon-Ra St. Brown',   short: 'St. Brown',   team: 'DET', teamName: 'Detroit Lions',        skin: '#b07848', height: 72, weight: 197, starter: false, captain: true,  number: 14,
    attrs: { speed: 8,  bodyControl: 10, vertical: 7,  routeRunning: 9, release: 9,  hands: 9, awareness: 10,  size: 6,  afterCatch: 7  } },
  { name: 'Isaac TeSlaa',        short: 'TeSlaa',      team: 'DET', teamName: 'Detroit Lions',        skin: '#f0c4a0', height: 77, weight: 220, starter: false, number: 10,
    attrs: { speed: 6,  bodyControl: 7,  vertical: 8,  routeRunning: 3,  release: 5,  hands: 7,  awareness: 4,  size: 11, afterCatch: 4  } },
  { name: 'Cedrick Wilson Jr.',  short: 'C. Wilson',   team: 'DET', teamName: 'Detroit Lions',        skin: '#5e3c22', height: 74, weight: 196, starter: false, number: 16,
    attrs: { speed: 5,  bodyControl: 5,  vertical: 4,  routeRunning: 3,  release: 4,  hands: 3,  awareness: 3,  size: 7,  afterCatch: 2  } },
  // GB
  { name: 'Jayden Reed',         short: 'J. Reed',     team: 'GB',  teamName: 'Green Bay Packers',     skin: '#b07848', height: 71, weight: 191, starter: true,  captain: true,  number: 11,
    attrs: { speed: 9,  bodyControl: 7,  vertical: 7,  routeRunning: 6,  release: 7,  hands: 6,  awareness: 6,  size: 5,  afterCatch: 6  } },
  { name: 'Christian Watson',    short: 'Watson',      team: 'GB',  teamName: 'Green Bay Packers',     skin: '#3a2010', height: 76, weight: 208, starter: false, number: 9,
    attrs: { speed: 10, bodyControl: 5,  vertical: 7,  routeRunning: 4,  release: 6,  hands: 4,  awareness: 4,  size: 9,  afterCatch: 5  } },
  { name: 'Matthew Golden',      short: 'M. Golden',   team: 'GB',  teamName: 'Green Bay Packers',     skin: '#5e3c22', height: 71, weight: 185, starter: false, number: 16,
    attrs: { speed: 10, bodyControl: 6,  vertical: 6,  routeRunning: 4,  release: 5,  hands: 5,  awareness: 3,  size: 5,  afterCatch: 5  } },
  { name: 'Savion Williams',     short: 'S. Williams', team: 'GB',  teamName: 'Green Bay Packers',     skin: '#5e3c22', height: 77, weight: 235, starter: false, number: 17,
    attrs: { speed: 3,  bodyControl: 1,  vertical: 5,  routeRunning: 2,  release: 3,  hands: 3,  awareness: 2,  size: 11, afterCatch: 7  } },
  // HOU
  { name: 'Nico Collins',        short: 'Collins',     team: 'HOU', teamName: 'Houston Texans',        skin: '#3a2010', height: 76, weight: 215, starter: true,  captain: true,  number: 12,
    attrs: { speed: 9,  bodyControl: 8,  vertical: 6, routeRunning: 7,  release: 7,  hands: 7,  awareness: 7,  size: 10, afterCatch: 5  } },
  { name: 'Jayden Higgins',      short: 'J. Higgins',  team: 'HOU', teamName: 'Houston Texans',        skin: '#f0c4a0', height: 76, weight: 214, starter: false, number: 81,
    attrs: { speed: 6,  bodyControl: 6,  vertical: 8,  routeRunning: 5,  release: 5,  hands: 5,  awareness: 5,  size: 10, afterCatch: 5  } },
  { name: 'Tank Dell',           short: 'Dell',        team: 'HOU', teamName: 'Houston Texans',        skin: '#3a2010', height: 68, weight: 165, starter: false, number: 3,
    attrs: { speed: 9,  bodyControl: 7,  vertical: 6,  routeRunning: 6,  release: 4,  hands: 6,  awareness: 7,  size: 2,  afterCatch: 6  } },
  { name: 'Jaylin Noel',         short: 'Noel',        team: 'HOU', teamName: 'Houston Texans',        skin: '#5e3c22', height: 70, weight: 185, starter: false, number: 15,
    attrs: { speed: 7,  bodyControl: 4,  vertical: 5,  routeRunning: 3,  release: 5,  hands: 3,  awareness: 3,  size: 4,  afterCatch: 4  } },
  // IND
  { name: 'Josh Downs',          short: 'Downs',       team: 'IND', teamName: 'Indianapolis Colts',    skin: '#5e3c22', height: 69, weight: 174, starter: true,  captain: true,  number: 1,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 4,  routeRunning: 8,  release: 7,  hands: 6,  awareness: 7,  size: 3,  afterCatch: 5  } },
  { name: 'Alec Pierce',         short: 'Pierce',      team: 'IND', teamName: 'Indianapolis Colts',    skin: '#f0c4a0', height: 75, weight: 211, starter: false, number: 14,
    attrs: { speed: 8,  bodyControl: 5,  vertical: 6,  routeRunning: 4,  release: 5,  hands: 5,  awareness: 5,  size: 9,  afterCatch: 3  } },
  { name: 'Nick Westbrook-Ikhine', short: 'Westbrook', team: 'IND', teamName: 'Indianapolis Colts',   skin: '#b07848', height: 74, weight: 203, starter: false, number: 15,
    attrs: { speed: 4,  bodyControl: 5,  vertical: 5,  routeRunning: 5,  release: 4,  hands: 5,  awareness: 5,  size: 8,  afterCatch: 4  } },
  { name: 'Ashton Dulin',        short: 'Dulin',       team: 'IND', teamName: 'Indianapolis Colts',    skin: '#5e3c22', height: 71, weight: 200, starter: false, number: 83,
    attrs: { speed: 6,  bodyControl: 3,  vertical: 4,  routeRunning: 2,  release: 3,  hands: 3,  awareness: 3,  size: 5,  afterCatch: 3  } },
  // JAX
  { name: 'Brian Thomas Jr.',    short: 'B. Thomas',   team: 'JAX', teamName: 'Jacksonville Jaguars',  skin: '#3a2010', height: 75, weight: 209, starter: true,  captain: true,  number: 7,
    attrs: { speed: 9,  bodyControl: 5,  vertical: 8,  routeRunning: 6,  release: 5,  hands: 3,  awareness: 4,  size: 9,  afterCatch: 5  } },
  { name: 'Jakobi Meyers',       short: 'Meyers',      team: 'JAX', teamName: 'Jacksonville Jaguars',  skin: '#5e3c22', height: 73, weight: 196, starter: false, number: 16,
    attrs: { speed: 5,  bodyControl: 7,  vertical: 6,  routeRunning: 7,  release: 6,  hands: 7,  awareness: 7,  size: 7,  afterCatch: 5  } },
  { name: 'Parker Washington',   short: 'P. Washington', team: 'JAX', teamName: 'Jacksonville Jaguars', skin: '#3a2010', height: 70, weight: 205, starter: false, number: 11,
    attrs: { speed: 6,  bodyControl: 8,  vertical: 6,  routeRunning: 8,  release: 4,  hands: 8,  awareness: 8,  size: 5,  afterCatch: 6  } },
  { name: 'Travis Hunter',       short: 'Hunter',      team: 'JAX', teamName: 'Jacksonville Jaguars',  skin: '#3a2010', height: 73, weight: 185, starter: false, number: 12,
    attrs: { speed: 9,  bodyControl: 10, vertical: 9,  routeRunning: 4,  release: 3,  hands: 9,  awareness: 6,  size: 5,  afterCatch: 6  } },
  // KC
  { name: 'Xavier Worthy',       short: 'Worthy',      team: 'KC',  teamName: 'Kansas City Chiefs',    skin: '#3a2010', height: 70, weight: 165, starter: true,  captain: true,  number: 1,
    attrs: { speed: 11, bodyControl: 6,  vertical: 5,  routeRunning: 5,  release: 3,  hands: 4,  awareness: 4,  size: 3,  afterCatch: 3  } },
  { name: 'Rashee Rice',         short: 'Rice',        team: 'KC',  teamName: 'Kansas City Chiefs',    skin: '#5e3c22', height: 73, weight: 204, starter: false, captain: true,  number: 4,
    attrs: { speed: 7,  bodyControl: 4,  vertical: 6,  routeRunning: 6,  release: 6,  hands: 6,  awareness: 3,  size: 7,  afterCatch: 7  } },
  { name: 'Tyquan Thornton',     short: 'Thornton',    team: 'KC',  teamName: 'Kansas City Chiefs',    skin: '#3a2010', height: 74, weight: 181, starter: false, number: 10,
    attrs: { speed: 9,  bodyControl: 3,  vertical: 4,  routeRunning: 4,  release: 4,  hands: 3,  awareness: 4,  size: 7,  afterCatch: 2  } },
  { name: 'Jalen Royals',        short: 'Royals',      team: 'KC',  teamName: 'Kansas City Chiefs',    skin: '#5e3c22', height: 72, weight: 200, starter: false, number: 18,
    attrs: { speed: 6,  bodyControl: 4,  vertical: 5,  routeRunning: 3,  release: 5,  hands: 4,  awareness: 4,  size: 6,  afterCatch: 4  } },
  // LAC
  { name: 'Ladd McConkey',       short: 'McConkey',    team: 'LAC', teamName: 'Los Angeles Chargers',  skin: '#f0c4a0', height: 72, weight: 185, starter: true,  captain: true,  number: 15,
    attrs: { speed: 9,  bodyControl: 8,  vertical: 6,  routeRunning: 9,  release: 8,  hands: 8,  awareness: 9,  size: 6,  afterCatch: 5  } },
  { name: 'Quentin Johnston',    short: 'Johnston',    team: 'LAC', teamName: 'Los Angeles Chargers',  skin: '#3a2010', height: 76, weight: 215, starter: false, number: 1,
    attrs: { speed: 6,  bodyControl: 3,  vertical: 5,  routeRunning: 3,  release: 4,  hands: 3,  awareness: 4,  size: 10, afterCatch: 7  } },
  { name: "Tre' Harris",         short: 'Harris',      team: 'LAC', teamName: 'Los Angeles Chargers',  skin: '#5e3c22', height: 74, weight: 205, starter: false, number: 13,
    attrs: { speed: 8,  bodyControl: 5,  vertical: 5,  routeRunning: 4,  release: 5,  hands: 4,  awareness: 4,  size: 8,  afterCatch: 5  } },
  { name: 'Brenen Thompson',     short: 'Thompson',    team: 'LAC', teamName: 'Los Angeles Chargers',  skin: '#5e3c22', height: 72, weight: 185, starter: false, number: 83,
    attrs: { speed: 10, bodyControl: 4,  vertical: 7,  routeRunning: 2,  release: 3,  hands: 2,  awareness: 3,  size: 6,  afterCatch: 2  } },
  // LAR
  { name: 'Puka Nacua',          short: 'Nacua',       team: 'LAR', teamName: 'Los Angeles Rams',      skin: '#b07848', height: 74, weight: 202, starter: true,  captain: true,  number: 17,
    attrs: { speed: 8,  bodyControl: 10,  vertical: 7,  routeRunning: 6,  release: 8,  hands: 10,  awareness: 9,  size: 8,  afterCatch: 10  } },
  { name: 'Davante Adams',       short: 'Adams',       team: 'LAR', teamName: 'Los Angeles Rams',      skin: '#5e3c22', height: 73, weight: 215, starter: false, captain: true,  number: 82,
    attrs: { speed: 6,  bodyControl: 9, vertical: 6,  routeRunning: 11, release: 10, hands: 8, awareness: 10, size: 7,  afterCatch: 5  } },
  { name: 'Xavier Smith',        short: 'X. Smith',    team: 'LAR', teamName: 'Los Angeles Rams',      skin: '#5e3c22', height: 71, weight: 185, starter: false, number: 88,
    attrs: { speed: 7,  bodyControl: 4,  vertical: 5,  routeRunning: 2,  release: 4,  hands: 3,  awareness: 2,  size: 5,  afterCatch: 3  } },
  { name: 'Jordan Whittington',  short: 'Whittington', team: 'LAR', teamName: 'Los Angeles Rams',      skin: '#3a2010', height: 73, weight: 193, starter: false, number: 1,
    attrs: { speed: 5,  bodyControl: 5,  vertical: 6,  routeRunning: 3,  release: 4,  hands: 3,  awareness: 3,  size: 7,  afterCatch: 4  } },
  // LV
  { name: 'Tre Tucker',          short: 'Tucker',      team: 'LV',  teamName: 'Las Vegas Raiders',     skin: '#3a2010', height: 70, weight: 171, starter: true,  captain: true,  number: 11,
    attrs: { speed: 9,  bodyControl: 6,  vertical: 5,  routeRunning: 5,  release: 5,  hands: 5,  awareness: 4,  size: 4,  afterCatch: 5  } },
  { name: 'Jack Bech',           short: 'Bech',        team: 'LV',  teamName: 'Las Vegas Raiders',     skin: '#f0c4a0', height: 74, weight: 205, starter: false, number: 18,
    attrs: { speed: 4,  bodyControl: 3,  vertical: 4,  routeRunning: 4,  release: 3,  hands: 4,  awareness: 5,  size: 8,  afterCatch: 3  } },
  { name: 'Jalen Nailor',        short: 'Nailor',      team: 'LV',  teamName: 'Las Vegas Raiders',     skin: '#5e3c22', height: 72, weight: 195, starter: false, number: 16,
    attrs: { speed: 6,  bodyControl: 5,  vertical: 4,  routeRunning: 3,  release: 4,  hands: 3,  awareness: 4,  size: 6,  afterCatch: 4  } },
  { name: "Dont'e Thornton Jr.", short: 'D. Thornton', team: 'LV',  teamName: 'Las Vegas Raiders',     skin: '#3a2010', height: 77, weight: 218, starter: false, number: 84,
    attrs: { speed: 8,  bodyControl: 1,  vertical: 6,  routeRunning: 1,  release: 2,  hands: 2,  awareness: 2,  size: 11, afterCatch: 3  } },
  // MIA
  { name: 'Tutu Atwell',         short: 'Atwell',      team: 'MIA', teamName: 'Miami Dolphins',        skin: '#5e3c22', height: 69, weight: 155, starter: true,  captain: true,  number: 2,
    attrs: { speed: 9,  bodyControl: 7,  vertical: 5,  routeRunning: 5,  release: 5,  hands: 4,  awareness: 4,  size: 2,  afterCatch: 5  } },
  { name: 'Jalen Tolbert',       short: 'Tolbert',     team: 'MIA', teamName: 'Miami Dolphins',        skin: '#5e3c22', height: 76, weight: 205, starter: false, number: 8,
    attrs: { speed: 7,  bodyControl: 5,  vertical: 7,  routeRunning: 3,  release: 5,  hands: 3,  awareness: 3,  size: 9,  afterCatch: 3  } },
  { name: 'Malik Washington',    short: 'M. Washington', team: 'MIA', teamName: 'Miami Dolphins',      skin: '#5e3c22', height: 71, weight: 196, starter: false, number: 17,
    attrs: { speed: 6,  bodyControl: 5,  vertical: 5,  routeRunning: 3,  release: 4,  hands: 3,  awareness: 3,  size: 5,  afterCatch: 5  } },
  { name: 'Chris Bell',          short: 'C. Bell',     team: 'MIA', teamName: 'Miami Dolphins',        skin: '#3a2010', height: 75, weight: 205, starter: false, number: 14,
    attrs: { speed: 6,  bodyControl: 4,  vertical: 5,  routeRunning: 2,  release: 3,  hands: 3,  awareness: 2,  size: 9,  afterCatch: 2  } },
  // MIN
  { name: 'Justin Jefferson',    short: 'Jefferson',   team: 'MIN', teamName: 'Minnesota Vikings',     skin: '#3a2010', height: 73, weight: 195, starter: true,  captain: true,  number: 18,
    attrs: { speed: 9,  bodyControl: 10, vertical: 9,  routeRunning: 11, release: 11, hands: 11, awareness: 10,  size: 7,  afterCatch: 8 } },
  { name: 'Jordan Addison',      short: 'Addison',     team: 'MIN', teamName: 'Minnesota Vikings',     skin: '#5e3c22', height: 71, weight: 173, starter: false, number: 3,
    attrs: { speed: 8,  bodyControl: 8,  vertical: 7,  routeRunning: 7,  release: 7,  hands: 6,  awareness: 6,  size: 4,  afterCatch: 6  } },
  { name: 'Dillon Bell',         short: 'D. Bell',     team: 'MIN', teamName: 'Minnesota Vikings',     skin: '#3a2010', height: 71, weight: 202, starter: false, number: 83,
    attrs: { speed: 2,  bodyControl: 5,  vertical: 5,  routeRunning: 3,  release: 4,  hands: 4,  awareness: 3,  size: 5,  afterCatch: 4  } },
  { name: 'Jauan Jennings',      short: 'Jennings',    team: 'MIN', teamName: 'Minnesota Vikings',     skin: '#5e3c22', height: 75, weight: 218, starter: false, number: 10,
    attrs: { speed: 5,  bodyControl: 6,  vertical: 8,  routeRunning: 4,  release: 5,  hands: 7,  awareness: 8,  size: 9,  afterCatch: 6  } },
  // NE
  { name: 'A.J. Brown',          short: 'AJ Brown',    team: 'NE',  teamName: 'New England Patriots',  skin: '#3a2010', height: 73, weight: 226, starter: true,  captain: true,  number: 1,
    attrs: { speed: 8,  bodyControl: 8,  vertical: 9, routeRunning: 7,  release: 9,  hands: 7,  awareness: 8,  size: 8,  afterCatch: 9  } },
  { name: 'Mack Hollins',        short: 'Hollins',     team: 'NE',  teamName: 'New England Patriots',  skin: '#f0c4a0', height: 76, weight: 221, starter: false, number: 7,
    attrs: { speed: 4,  bodyControl: 4,  vertical: 6,  routeRunning: 3,  release: 4,  hands: 4,  awareness: 5,  size: 10, afterCatch: 3  } },
  { name: 'Romeo Doubs',         short: 'Doubs',       team: 'NE',  teamName: 'New England Patriots',  skin: '#b07848', height: 74, weight: 204, starter: false, number: 15,
    attrs: { speed: 7,  bodyControl: 5,  vertical: 6,  routeRunning: 4,  release: 6,  hands: 3,  awareness: 3,  size: 8,  afterCatch: 4  } },
  { name: 'Kayshon Boutte',      short: 'Boutte',      team: 'NE',  teamName: 'New England Patriots',  skin: '#3a2010', height: 73, weight: 196, starter: false, number: 9,
    attrs: { speed: 7,  bodyControl: 7,  vertical: 5,  routeRunning: 3,  release: 5,  hands: 4,  awareness: 5,  size: 7,  afterCatch: 4  } },
  { name: 'Kyle Williams',       short: 'K. Williams', team: 'NE',  teamName: 'New England Patriots',  skin: '#f0c4a0', height: 70, weight: 185, starter: false, number: 18,
    attrs: { speed: 9,  bodyControl: 4,  vertical: 4,  routeRunning: 3,  release: 4,  hands: 3,  awareness: 4,  size: 4,  afterCatch: 5  } },
  // NO
  { name: 'Chris Olave',         short: 'Olave',       team: 'NO',  teamName: 'New Orleans Saints',    skin: '#b07848', height: 73, weight: 188, starter: true,  captain: true,  number: 12,
    attrs: { speed: 9,  bodyControl: 8,  vertical: 7,  routeRunning: 9,  release: 8,  hands: 6,  awareness: 7,  size: 6,  afterCatch: 6  } },
  { name: 'Jordyn Tyson',        short: 'Tyson',       team: 'NO',  teamName: 'New Orleans Saints',    skin: '#5e3c22', height: 74, weight: 200, starter: false, number: 18,
    attrs: { speed: 9,  bodyControl: 8,  vertical: 7,  routeRunning: 7,  release: 7,  hands: 4,  awareness: 3,  size: 8,  afterCatch: 5  } },
  { name: 'Brandin Cooks',       short: 'Cooks',       team: 'NO',  teamName: 'New Orleans Saints',    skin: '#b07848', height: 70, weight: 183, starter: false, number: 10,
    attrs: { speed: 7,  bodyControl: 5,  vertical: 4,  routeRunning: 4,  release: 4,  hands: 4,  awareness: 6,  size: 4,  afterCatch: 3  } },
  { name: 'Devaughn Vele',       short: 'Vele',        team: 'NO',  teamName: 'New Orleans Saints',    skin: '#5e3c22', height: 75, weight: 200, starter: false, number: 13,
    attrs: { speed: 7,  bodyControl: 3,  vertical: 5,  routeRunning: 3,  release: 4,  hands: 3,  awareness: 5,  size: 8,  afterCatch: 4  } },
  // NYG
  { name: 'Malik Nabers',        short: 'Nabers',      team: 'NYG', teamName: 'New York Giants',       skin: '#3a2010', height: 72, weight: 200, starter: true,  captain: true,  number: 1,
    attrs: { speed: 10, bodyControl: 10,  vertical: 8,  routeRunning: 9,  release: 10,  hands: 8,  awareness: 8,  size: 6,  afterCatch: 9  } },
  { name: 'Darius Slayton',      short: 'Slayton',     team: 'NYG', teamName: 'New York Giants',       skin: '#5e3c22', height: 72, weight: 190, starter: false, number: 86,
    attrs: { speed: 8,  bodyControl: 5,  vertical: 6,  routeRunning: 3,  release: 6,  hands: 4,  awareness: 5,  size: 6,  afterCatch: 4  } },
  { name: 'Odell Beckham Jr.',   short: 'OBJ',         team: 'NYG', teamName: 'New York Giants',       skin: '#5e3c22', height: 71, weight: 198, starter: false, number: 13,
    attrs: { speed: 5,  bodyControl: 5,  vertical: 4,  routeRunning: 5,  release: 4,  hands: 7,  awareness: 4,  size: 5,  afterCatch: 6  } },
  { name: 'Jalin Hyatt',         short: 'Hyatt',       team: 'NYG', teamName: 'New York Giants',       skin: '#5e3c22', height: 72, weight: 185, starter: false, number: 17,
    attrs: { speed: 9,  bodyControl: 3,  vertical: 5,  routeRunning: 2,  release: 4,  hands: 3,  awareness: 1,  size: 6,  afterCatch: 3  } },
  { name: 'Darnell Mooney',      short: 'Mooney',      team: 'NYG', teamName: 'New York Giants',       skin: '#5e3c22', height: 70, weight: 183, starter: false, number: 18,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 7,  routeRunning: 5,  release: 5,  hands: 6,  awareness: 6,  size: 4,  afterCatch: 5  } },
  { name: 'Calvin Austin III',   short: 'C. Austin',   team: 'NYG', teamName: 'New York Giants',       skin: '#3a2010', height: 68, weight: 170, starter: false, number: 19,
    attrs: { speed: 9,  bodyControl: 5,  vertical: 5,  routeRunning: 6,  release: 5,  hands: 4,  awareness: 5,  size: 2,  afterCatch: 4  } },
  // NYJ
  { name: 'Garrett Wilson',      short: 'G. Wilson',   team: 'NYJ', teamName: 'New York Jets',         skin: '#5e3c22', height: 72, weight: 192, starter: true,  captain: true,  number: 17,
    attrs: { speed: 8,  bodyControl: 9,  vertical: 7,  routeRunning: 8,  release: 7,  hands: 9,  awareness: 8,  size: 6,  afterCatch: 7  } },
  { name: 'Adonai Mitchell',     short: 'Mitchell',    team: 'NYJ', teamName: 'New York Jets',         skin: '#3a2010', height: 74, weight: 210, starter: false, number: 10,
    attrs: { speed: 7,  bodyControl: 4,  vertical: 6,  routeRunning: 5,  release: 4,  hands: 5,  awareness: 3,  size: 8,  afterCatch: 5  } },
  { name: 'Omar Cooper Jr.',     short: 'Cooper',      team: 'NYJ', teamName: 'New York Jets',         skin: '#5e3c22', height: 74, weight: 204, starter: false, number: 1,
    attrs: { speed: 7,  bodyControl: 5,  vertical: 6,  routeRunning: 4,  release: 4,  hands: 3,  awareness: 5,  size: 8,  afterCatch: 5  } },
  { name: 'Tim Patrick',         short: 'T. Patrick',  team: 'NYJ', teamName: 'New York Jets',         skin: '#5e3c22', height: 76, weight: 212, starter: false, number: 11,
    attrs: { speed: 4,  bodyControl: 4,  vertical: 7,  routeRunning: 3,  release: 4,  hands: 6,  awareness: 4,  size: 10, afterCatch: 4  } },
  { name: 'Arian Smith',         short: 'A. Smith',    team: 'NYJ', teamName: 'New York Jets',         skin: '#5e3c22', height: 71, weight: 174, starter: false, number: 13,
    attrs: { speed: 10, bodyControl: 4,  vertical: 5,  routeRunning: 2,  release: 3,  hands: 1,  awareness: 2,  size: 4,  afterCatch: 3  } },
  // PHI
  { name: 'DeVonta Smith',       short: 'D. Smith',    team: 'PHI', teamName: 'Philadelphia Eagles',   skin: '#3a2010', height: 72, weight: 170, starter: true,  captain: true,  number: 6,
    attrs: { speed: 9,  bodyControl: 11, vertical: 8,  routeRunning: 8,  release: 8, hands: 10,  awareness: 9,  size: 5,  afterCatch: 6  } },
  { name: 'Dontayvion Wicks',    short: 'Wicks',       team: 'PHI', teamName: 'Philadelphia Eagles',   skin: '#5e3c22', height: 73, weight: 205, starter: false, number: 11,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 6,  routeRunning: 4,  release: 7,  hands: 4,  awareness: 5,  size: 7,  afterCatch: 5  } },
  { name: 'Makai Lemon',         short: 'Lemon',       team: 'PHI', teamName: 'Philadelphia Eagles',   skin: '#3a2010', height: 72, weight: 193, starter: false, number: 2,
    attrs: { speed: 7,  bodyControl: 6,  vertical: 6,  routeRunning: 5,  release: 6,  hands: 6,  awareness: 5,  size: 5,  afterCatch: 7  } },
  { name: 'Elijah Moore',        short: 'E. Moore',    team: 'PHI', teamName: 'Philadelphia Eagles',   skin: '#5e3c22', height: 71, weight: 178, starter: false, number: 8,
    attrs: { speed: 9,  bodyControl: 6,  vertical: 5,  routeRunning: 3,  release: 4,  hands: 4,  awareness: 3,  size: 5,  afterCatch: 4  } },
  // PIT
  { name: 'DK Metcalf',          short: 'Metcalf',     team: 'PIT', teamName: 'Pittsburgh Steelers',   skin: '#3a2010', height: 75, weight: 229, starter: true,  captain: true,  number: 4,
    attrs: { speed: 9,  bodyControl: 5,  vertical: 9,  routeRunning: 5,  release: 5,  hands: 5,  awareness: 6,  size: 9,  afterCatch: 6  } },
  { name: 'Michael Pittman Jr.', short: 'Pittman',     team: 'PIT', teamName: 'Pittsburgh Steelers',   skin: '#5e3c22', height: 76, weight: 223, starter: false, number: 11,
    attrs: { speed: 6,  bodyControl: 6,  vertical: 7,  routeRunning: 6,  release: 5,  hands: 7,  awareness: 7,  size: 10, afterCatch: 5  } },
  { name: 'Roman Wilson',        short: 'R. Wilson',   team: 'PIT', teamName: 'Pittsburgh Steelers',   skin: '#3a2010', height: 72, weight: 193, starter: false, number: 10,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 6,  routeRunning: 4,  release: 4,  hands: 4,  awareness: 4,  size: 6,  afterCatch: 4  } },
  // SF
  { name: 'Mike Evans',          short: 'Evans',       team: 'SF',  teamName: 'San Francisco 49ers',   skin: '#3a2010', height: 77, weight: 231, starter: true,  captain: true,  number: 13,
    attrs: { speed: 7,  bodyControl: 7,  vertical: 8, routeRunning: 6,  release: 7,  hands: 8, awareness: 8,  size: 11, afterCatch: 4  } },
  { name: 'Ricky Pearsall',      short: 'Pearsall',    team: 'SF',  teamName: 'San Francisco 49ers',   skin: '#5e3c22', height: 74, weight: 195, starter: false, number: 14,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 5,  routeRunning: 6,  release: 5,  hands: 6,  awareness: 6,  size: 7,  afterCatch: 5  } },
  { name: 'Christian Kirk',      short: 'C. Kirk',     team: 'SF',  teamName: 'San Francisco 49ers',   skin: '#5e3c22', height: 71, weight: 190, starter: false, number: 10,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 5,  routeRunning: 4,  release: 5,  hands: 4,  awareness: 5,  size: 5,  afterCatch: 5  } },
  { name: 'Deebo Samuel',        short: 'Samuel',      team: 'SF',  teamName: 'San Francisco 49ers',   skin: '#3a2010', height: 71, weight: 215, starter: false, number: 19,
    attrs: { speed: 6,  bodyControl: 3,  vertical: 5,  routeRunning: 3,  release: 4,  hands: 4,  awareness: 7,  size: 6,  afterCatch: 10 } },
  // SEA
  { name: 'Jaxon Smith-Njigba',  short: 'JSN',         team: 'SEA', teamName: 'Seattle Seahawks',      skin: '#5e3c22', height: 72, weight: 196, starter: true,  captain: true,  number: 11,
    attrs: { speed: 9,  bodyControl: 11, vertical: 7,  routeRunning: 11,  release: 10,  hands: 10,  awareness: 11,  size: 6,  afterCatch: 7  } },
  { name: 'Rashid Shaheed',      short: 'Shaheed',     team: 'SEA', teamName: 'Seattle Seahawks',      skin: '#5e3c22', height: 72, weight: 175, starter: false, number: 19,
    attrs: { speed: 10, bodyControl: 6,  vertical: 6,  routeRunning: 5,  release: 6,  hands: 4,  awareness: 6,  size: 5,  afterCatch: 8  } },
  { name: 'Tory Horton',         short: 'Horton',      team: 'SEA', teamName: 'Seattle Seahawks',      skin: '#b07848', height: 75, weight: 195, starter: false, number: 18,
    attrs: { speed: 8,  bodyControl: 5,  vertical: 7,  routeRunning: 3,  release: 3,  hands: 3,  awareness: 3,  size: 8,  afterCatch: 4  } },
  { name: 'Cooper Kupp',         short: 'Kupp',        team: 'SEA', teamName: 'Seattle Seahawks',      skin: '#f0c4a0', height: 74, weight: 208, starter: false, number: 10,
    attrs: { speed: 4,  bodyControl: 6,  vertical: 3,  routeRunning: 6, release: 5,  hands: 5,  awareness: 9,  size: 7,  afterCatch: 3  } },
  { name: 'Cody White',          short: 'C. White',    team: 'SEA', teamName: 'Seattle Seahawks',      skin: '#f0c4a0', height: 76, weight: 220, starter: false, number: 81,
    attrs: { speed: 1,  bodyControl: 3,  vertical: 4,  routeRunning: 3,  release: 3,  hands: 4,  awareness: 4,  size: 10, afterCatch: 3  } },
  // TB
  { name: 'Emeka Egbuka',        short: 'Egbuka',      team: 'TB',  teamName: 'Tampa Bay Buccaneers',  skin: '#5e3c22', height: 73, weight: 205, starter: true,  captain: true,  number: 2,
    attrs: { speed: 9,  bodyControl: 8,  vertical: 7,  routeRunning: 7,  release: 6,  hands: 6,  awareness: 6,  size: 7,  afterCatch: 7  } },
  { name: 'Jalen McMillan',      short: 'J. McMillan', team: 'TB',  teamName: 'Tampa Bay Buccaneers',  skin: '#5e3c22', height: 73, weight: 200, starter: false, number: 15,
    attrs: { speed: 7,  bodyControl: 6,  vertical: 6,  routeRunning: 4,  release: 5,  hands: 4,  awareness: 4,  size: 7,  afterCatch: 4  } },
  { name: 'Tez Johnson',         short: 'Tez Johnson', team: 'TB',  teamName: 'Tampa Bay Buccaneers',  skin: '#3a2010', height: 69, weight: 173, starter: false, number: 18,
    attrs: { speed: 9,  bodyControl: 8,  vertical: 6,  routeRunning: 5,  release: 3,  hands: 5,  awareness: 4,  size: 3,  afterCatch: 6  } },
  { name: 'Chris Godwin',        short: 'Godwin',      team: 'TB',  teamName: 'Tampa Bay Buccaneers',  skin: '#f0c4a0', height: 73, weight: 209, starter: false, number: 14,
    attrs: { speed: 5,  bodyControl: 6,  vertical: 4,  routeRunning: 3,  release: 5,  hands: 5,  awareness: 6,  size: 7,  afterCatch: 6  } },
  { name: 'Ted Hurst III',       short: 'Hurst',       team: 'TB',  teamName: 'Tampa Bay Buccaneers',  skin: '#5e3c22', height: 75, weight: 208, starter: false, number: 13,
    attrs: { speed: 7,  bodyControl: 3,  vertical: 5,  routeRunning: 3,  release: 3,  hands: 4,  awareness: 3,  size: 9,  afterCatch: 2  } },
  // TEN
  { name: 'Carnell Tate',        short: 'Tate',        team: 'TEN', teamName: 'Tennessee Titans',      skin: '#5e3c22', height: 74, weight: 192, starter: true,  captain: true,  number: 14,
    attrs: { speed: 8,  bodyControl: 7,  vertical: 7,  routeRunning: 6,  release: 6,  hands: 6,  awareness: 6,  size: 7,  afterCatch: 5  } },
  { name: 'Calvin Ridley',       short: 'Ridley',      team: 'TEN', teamName: 'Tennessee Titans',      skin: '#3a2010', height: 73, weight: 190, starter: false, captain: true,  number: 10,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 5,  routeRunning: 7,  release: 8,  hands: 3,  awareness: 4,  size: 7,  afterCatch: 5  } },
  { name: "Wan'Dale Robinson",   short: 'Robinson',    team: 'TEN', teamName: 'Tennessee Titans',      skin: '#5e3c22', height: 68, weight: 188, starter: false, number: 17,
    attrs: { speed: 8,  bodyControl: 6,  vertical: 3,  routeRunning: 6,  release: 2,  hands: 4,  awareness: 6,  size: 3,  afterCatch: 6  } },
  { name: 'Elic Ayomanor',       short: 'Ayomanor',    team: 'TEN', teamName: 'Tennessee Titans',      skin: '#5e3c22', height: 74, weight: 200, starter: false, number: 84,
    attrs: { speed: 7,  bodyControl: 5,  vertical: 6,  routeRunning: 3,  release: 4,  hands: 4,  awareness: 3,  size: 8,  afterCatch: 4  } },
  // WAS
  { name: 'Terry McLaurin',      short: 'McLaurin',    team: 'WAS', teamName: 'Washington Commanders', skin: '#3a2010', height: 72, weight: 210, starter: true,  captain: true,  number: 17,
    attrs: { speed: 9,  bodyControl: 9,  vertical: 8,  routeRunning: 7,  release: 7,  hands: 9,  awareness: 8,  size: 6,  afterCatch: 7  } },
  { name: 'Treylon Burks',       short: 'T. Burks',    team: 'WAS', teamName: 'Washington Commanders', skin: '#5e3c22', height: 75, weight: 225, starter: false, number: 16,
    attrs: { speed: 6,  bodyControl: 3,  vertical: 5,  routeRunning: 3,  release: 4,  hands: 5,  awareness: 4,  size: 9,  afterCatch: 6  } },
  { name: 'Dyami Brown',         short: 'D. Brown',    team: 'WAS', teamName: 'Washington Commanders', skin: '#b07848', height: 73, weight: 185, starter: false, number: 2,
    attrs: { speed: 7,  bodyControl: 5,  vertical: 6,  routeRunning: 4,  release: 4,  hands: 4,  awareness: 4,  size: 6,  afterCatch: 4  } },
  { name: 'Luke McCaffrey',      short: 'McCaffrey',   team: 'WAS', teamName: 'Washington Commanders', skin: '#f0c4a0', height: 74, weight: 185, starter: false, number: 6,
    attrs: { speed: 8,  bodyControl: 5,  vertical: 4,  routeRunning: 3,  release: 3,  hands: 3,  awareness: 3,  size: 7,  afterCatch: 3  } },
]

export const WRS = _WRS.map(wr => ({ ...wr, ...TEAM_COLOR[wr.team], ovr: _wrOVR(wr.attrs) }))

export const WR_PHYSICALS = Object.fromEntries(_WRS.map(wr => [wr.name, { height: wr.height, weight: wr.weight }]))

export const WR_ATTR = { ...ATTR, 'size': { ...ATTR['size'], label: 'Size', shortLabel: 'SZE' }, 'speed': { ...ATTR['speed'], label: 'Speed', shortLabel: 'SPD' }, 'bodyControl': { ...ATTR['agility'], label: 'Body Control', shortLabel: 'BCT' } }
