import { TEAMS } from './qbs'
const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

export const RB_TYPES      = ['speed', 'burst', 'strength', 'size', 'balance', 'elusiveness', 'vision', 'hands', 'carrying']
export const RB_LITE_TYPES = ['speed', 'burst', 'strength', 'size']

export const RB_CATEGORIES = [
  { id: 'physical', label: 'Physical', types: ['speed', 'burst', 'strength', 'size', 'hands'] },
  { id: 'skill',    label: 'Skill',    types: ['balance', 'elusiveness', 'vision', 'carrying'] },
]

// Skin tone palette:
//   #f0c4a0 — white (McCaffrey, Shipley, Laube, Saylors, Skattebo)
//   #b07848 — mixed / Polynesian / Latino (Allgeier, Corum, Holani, Pacheco)
//   #5e3c22 — Black (standard)
//   #3a2010 — Black (noticeably very dark: Henry, Stevenson, Mason)
//
// Ratings scale 1–11:  11=S/all-time elite  10=top-2 NFL  9=top-5  8=top-10/Pro Bowl  7=above avg  6=avg starter  5=fringe starter  4=backup  3=poor  2=very poor  1=historically bad
// Size formula: 80% weight score + 20% height score, normalized to min(178lb/67in) → max(247lb/75in). Henry is the only 11.

const _RBS = [
  // ARI
  { name: 'Jeremiyah Love',         short: 'Love',         team: 'ARI', teamName: 'Arizona Cardinals', skin: '#5e3c22', height: 73, weight: 210, starter: true,  captain: true,  number: 4,  attrs: { speed: 10, burst: 9, strength: 6, size: 6, balance: 7, hands: 7, vision: 6, elusiveness: 8,  carrying: 7 } },
  { name: 'Tyler Allgeier',         short: 'Allgeier',     team: 'ARI', teamName: 'Arizona Cardinals', skin: '#b07848', height: 71, weight: 222, starter: false, number: 22, attrs: { speed: 2, burst: 4, strength: 8, size: 7, balance: 8, hands: 3, vision: 6, elusiveness: 4,  carrying: 6 } },
  { name: 'James Conner',           short: 'Conner',       team: 'ARI', teamName: 'Arizona Cardinals', skin: '#5e3c22', height: 73, weight: 233, starter: false, number: 6,  attrs: { speed: 4, burst: 5, strength: 9, size: 9, balance: 8, hands: 6, vision: 7, elusiveness: 4,  carrying: 7 } },
  { name: 'Trey Benson',            short: 'Benson',       team: 'ARI', teamName: 'Arizona Cardinals', skin: '#5e3c22', height: 72, weight: 216, starter: false, number: 33, attrs: { speed: 8, burst: 6, strength: 6, size: 6, balance: 3, hands: 4, vision: 2, elusiveness: 4,  carrying: 5 } },
  // ATL
  { name: 'Bijan Robinson',         short: 'Bijan',        team: 'ATL', teamName: 'Atlanta Falcons', skin: '#5e3c22', height: 72, weight: 215, starter: true,  captain: true,  number: 7,  attrs: { speed: 8, burst: 11, strength: 7, size: 6, balance: 10, hands: 9, vision: 9, elusiveness: 11, carrying: 9 } },
  { name: 'Brian Robinson',         short: 'Br. Robinson', team: 'ATL', teamName: 'Atlanta Falcons', skin: '#5e3c22', height: 73, weight: 228, starter: false, number: 15, attrs: { speed: 5, burst: 4, strength: 8, size: 8, balance: 6, hands: 3, vision: 6, elusiveness: 3,  carrying: 7 } },
  { name: 'Tyler Goodson',          short: 'Goodson',      team: 'ATL', teamName: 'Atlanta Falcons', skin: '#5e3c22', height: 69, weight: 195, starter: false, number: 25, attrs: { speed: 6, burst: 5, strength: 3, size: 3, balance: 4, hands: 5, vision: 3, elusiveness: 4,  carrying: 4 } },
  // BAL
  { name: 'Derrick Henry',          short: 'Henry',        team: 'BAL', teamName: 'Baltimore Ravens', skin: '#3a2010', height: 75, weight: 247, starter: true,  captain: true,  number: 22, attrs: { speed: 8, burst: 3, strength: 11, size: 11, balance: 9, hands: 3, vision: 8, elusiveness: 3,  carrying: 6 } },
  { name: 'Justice Hill',           short: 'J. Hill',      team: 'BAL', teamName: 'Baltimore Ravens', skin: '#5e3c22', height: 69, weight: 195, starter: false, number: 43, attrs: { speed: 6, burst: 8, strength: 2, size: 3, balance: 4, hands: 7, vision: 5, elusiveness: 6,  carrying: 5 } },
  { name: 'Rasheen Ali',            short: 'Ali',          team: 'BAL', teamName: 'Baltimore Ravens', skin: '#5e3c22', height: 68, weight: 195, starter: false, number: 26, attrs: { speed: 5, burst: 6, strength: 3, size: 2, balance: 4, hands: 5, vision: 4, elusiveness: 5,  carrying: 4 } },
  // BUF
  { name: 'James Cook',             short: 'Cook',         team: 'BUF', teamName: 'Buffalo Bills', skin: '#5e3c22', height: 71, weight: 190, starter: true,  captain: true,  number: 4,  attrs: { speed: 9, burst: 8, strength: 2, size: 2, balance: 5, hands: 8, vision: 7, elusiveness: 8,  carrying: 5 } },
  { name: 'Ty Johnson',             short: 'Ty Johnson',   team: 'BUF', teamName: 'Buffalo Bills', skin: '#5e3c22', height: 68, weight: 200, starter: false, number: 26, attrs: { speed: 6, burst: 6, strength: 3, size: 3, balance: 4, hands: 6, vision: 5, elusiveness: 5,  carrying: 5 } },
  { name: 'Ray Davis',              short: 'Davis',        team: 'BUF', teamName: 'Buffalo Bills', skin: '#5e3c22', height: 68, weight: 205, starter: false, number: 7,  attrs: { speed: 5, burst: 5, strength: 6, size: 4, balance: 6, hands: 5, vision: 4, elusiveness: 4,  carrying: 5 } },
  // CAR
  { name: 'Chuba Hubbard',          short: 'Hubbard',      team: 'CAR', teamName: 'Carolina Panthers', skin: '#5e3c22', height: 72, weight: 210, starter: true,  captain: true,  number: 30, attrs: { speed: 7, burst: 8, strength: 6, size: 6, balance: 6, hands: 4, vision: 7, elusiveness: 4,  carrying: 7 } },
  { name: 'Jonathon Brooks',        short: 'Brooks',       team: 'CAR', teamName: 'Carolina Panthers', skin: '#5e3c22', height: 72, weight: 215, starter: false, number: 25, attrs: { speed: 7, burst: 7, strength: 5, size: 7, balance: 7, hands: 5, vision: 6, elusiveness: 6,  carrying: 6 } },
  { name: 'AJ Dillon',              short: 'Dillon',       team: 'CAR', teamName: 'Carolina Panthers', skin: '#5e3c22', height: 72, weight: 247, starter: false, number: 28, attrs: { speed: 4, burst: 2, strength: 10, size: 11, balance: 7, hands: 4, vision: 1, elusiveness: 0,  carrying: 8 } },
  { name: 'Trevor Etienne',         short: 'T. Etienne',   team: 'CAR', teamName: 'Carolina Panthers', skin: '#5e3c22', height: 69, weight: 205, starter: false, number: 23, attrs: { speed: 7, burst: 8, strength: 3, size: 4, balance: 3, hands: 7, vision: 4, elusiveness: 5,  carrying: 5 } },
  // CHI
  { name: "D'Andre Swift",          short: 'Swift',        team: 'CHI', teamName: 'Chicago Bears', skin: '#5e3c22', height: 68, weight: 212, starter: true,  captain: true,  number: 4,  attrs: { speed: 8, burst: 8, strength: 3, size: 4, balance: 5, hands: 8, vision: 3, elusiveness: 8,  carrying: 4 } },
  { name: 'Kyle Monangai',          short: 'Monangai',     team: 'CHI', teamName: 'Chicago Bears', skin: '#5e3c22', height: 68, weight: 207, starter: false, number: 25, attrs: { speed: 4, burst: 5, strength: 8, size: 6, balance: 7, hands: 5, vision: 5, elusiveness: 4,  carrying: 6 } },
  { name: 'Roschon Johnson',        short: 'R. Johnson',   team: 'CHI', teamName: 'Chicago Bears', skin: '#5e3c22', height: 72, weight: 219, starter: false, number: 23, attrs: { speed: 4, burst: 5, strength: 8, size: 7, balance: 6, hands: 3, vision: 4, elusiveness: 3,  carrying: 5 } },
  // CIN
  { name: 'Chase Brown',            short: 'C. Brown',     team: 'CIN', teamName: 'Cincinnati Bengals', skin: '#5e3c22', height: 71, weight: 208, starter: true,  captain: true,  number: 30, attrs: { speed: 9, burst: 9, strength: 4, size: 5, balance: 6, hands: 7, vision: 5, elusiveness: 7,  carrying: 6 } },
  { name: 'Samaje Perine',          short: 'Perine',       team: 'CIN', teamName: 'Cincinnati Bengals', skin: '#5e3c22', height: 70, weight: 230, starter: false, number: 34, attrs: { speed: 4, burst: 5, strength: 9, size: 7, balance: 7, hands: 6, vision: 6, elusiveness: 3,  carrying: 7 } },
  { name: 'Tahj Brooks',            short: 'T. Brooks',    team: 'CIN', teamName: 'Cincinnati Bengals', skin: '#5e3c22', height: 71, weight: 215, starter: false, number: 25, attrs: { speed: 5, burst: 5, strength: 6, size: 6, balance: 5, hands: 4, vision: 5, elusiveness: 4,  carrying: 5 } },
  // CLE
  { name: 'Quinshon Judkins',       short: 'Judkins',      team: 'CLE', teamName: 'Cleveland Browns', skin: '#5e3c22', height: 71, weight: 215, starter: true,  captain: true,  number: 10, attrs: { speed: 7, burst: 8, strength: 8, size: 7, balance: 8, hands: 5, vision: 5, elusiveness: 6,  carrying: 7 } },
  { name: 'Dylan Sampson',          short: 'Sampson',      team: 'CLE', teamName: 'Cleveland Browns', skin: '#5e3c22', height: 69, weight: 208, starter: false, number: 22, attrs: { speed: 7, burst: 7, strength: 4, size: 4, balance: 4, hands: 6, vision: 5, elusiveness: 6,  carrying: 5 } },
  { name: 'Raheim Sanders',         short: 'R. Sanders',   team: 'CLE', teamName: 'Cleveland Browns', skin: '#5e3c22', height: 74, weight: 220, starter: false, number: 35, attrs: { speed: 5, burst: 4, strength: 7, size: 7, balance: 4, hands: 3, vision: 4, elusiveness: 2,  carrying: 5 } },
  // DAL
  { name: 'Javonte Williams',       short: 'J. Williams',  team: 'DAL', teamName: 'Dallas Cowboys', skin: '#5e3c22', height: 70, weight: 212, starter: true,  captain: true,  number: 33, attrs: { speed: 6, burst: 7, strength: 8, size: 6, balance: 9, hands: 5, vision: 6, elusiveness: 6,  carrying: 8 } },
  { name: 'Malik Davis',            short: 'M. Davis',     team: 'DAL', teamName: 'Dallas Cowboys', skin: '#5e3c22', height: 70, weight: 207, starter: false, number: 20, attrs: { speed: 6, burst: 6, strength: 3, size: 5, balance: 3, hands: 5, vision: 4, elusiveness: 5,  carrying: 5 } },
  { name: 'Jaydon Blue',            short: 'Blue',         team: 'DAL', teamName: 'Dallas Cowboys', skin: '#5e3c22', height: 71, weight: 195, starter: false, number: 23, attrs: { speed: 8, burst: 8, strength: 3, size: 3, balance: 5, hands: 6, vision: 5, elusiveness: 6,  carrying: 5 } },
  // DEN
  { name: 'J.K. Dobbins',           short: 'Dobbins',      team: 'DEN', teamName: 'Denver Broncos', skin: '#5e3c22', height: 69, weight: 219, starter: true,  captain: true,  number: 27, attrs: { speed: 7, burst: 7, strength: 7, size: 6, balance: 7, hands: 5, vision: 8, elusiveness: 6,  carrying: 7 } },
  { name: 'RJ Harvey',              short: 'Harvey',       team: 'DEN', teamName: 'Denver Broncos', skin: '#5e3c22', height: 69, weight: 205, starter: false, number: 12, attrs: { speed: 8, burst: 9, strength: 4, size: 4, balance: 5, hands: 7, vision: 5, elusiveness: 7,  carrying: 6 } },
  { name: 'Jonah Coleman',          short: 'Coleman',      team: 'DEN', teamName: 'Denver Broncos', skin: '#5e3c22', height: 70, weight: 200, starter: false, number: 20, attrs: { speed: 7, burst: 7, strength: 3, size: 4, balance: 3, hands: 4, vision: 5, elusiveness: 5,  carrying: 5 } },
  // DET
  { name: 'Jahmyr Gibbs',           short: 'Gibbs',        team: 'DET', teamName: 'Detroit Lions', skin: '#5e3c22', height: 69, weight: 200, starter: true,  captain: true,  number: 26, attrs: { speed: 10, burst: 10, strength: 5, size: 5, balance: 8, hands: 8, vision: 8, elusiveness: 9,  carrying: 8 } },
  { name: 'Isiah Pacheco',          short: 'Pacheco',      team: 'DET', teamName: 'Detroit Lions', skin: '#b07848', height: 71, weight: 216, starter: false, number: 10, attrs: { speed: 6, burst: 7, strength: 7, size: 6, balance: 5, hands: 2, vision: 4, elusiveness: 2,  carrying: 4 } },
  { name: 'Jacob Saylors',          short: 'Saylors',      team: 'DET', teamName: 'Detroit Lions', skin: '#b07848', height: 69, weight: 192, starter: false, number: 25, attrs: { speed: 6, burst: 4, strength: 3, size: 2, balance: 3, hands: 4, vision: 2, elusiveness: 4,  carrying: 4 } },
  // GB
  { name: 'Josh Jacobs',            short: 'Jacobs',       team: 'GB',  teamName: 'Green Bay Packers', skin: '#5e3c22', height: 70, weight: 220, starter: true,  captain: true,  number: 8,  attrs: { speed: 7, burst: 6, strength: 8, size: 7, balance: 8, hands: 6, vision: 7, elusiveness: 6,  carrying: 8 } },
  { name: 'MarShawn Lloyd',         short: 'Lloyd',        team: 'GB',  teamName: 'Green Bay Packers', skin: '#5e3c22', height: 69, weight: 202, starter: false, number: 32, attrs: { speed: 7, burst: 7, strength: 4, size: 4, balance: 3, hands: 5, vision: 4, elusiveness: 6,  carrying: 5 } },
  { name: 'Chris Brooks',           short: 'C. Brooks',    team: 'GB',  teamName: 'Green Bay Packers', skin: '#5e3c22', height: 71, weight: 215, starter: false, number: 30, attrs: { speed: 5, burst: 5, strength: 6, size: 6, balance: 5, hands: 3, vision: 4, elusiveness: 3,  carrying: 5 } },
  // HOU
  { name: 'David Montgomery',       short: 'Montgomery',   team: 'HOU', teamName: 'Houston Texans', skin: '#5e3c22', height: 70, weight: 222, starter: true,  captain: true,  number: 32, attrs: { speed: 6, burst: 5, strength: 8, size: 6, balance: 8, hands: 4, vision: 7, elusiveness: 4,  carrying: 7 } },
  { name: 'Woody Marks',            short: 'Marks',        team: 'HOU', teamName: 'Houston Texans', skin: '#5e3c22', height: 71, weight: 215, starter: false, number: 4,  attrs: { speed: 6, burst: 7, strength: 5, size: 6, balance: 5, hands: 8, vision: 6, elusiveness: 6,  carrying: 7 } },
  { name: 'Evan Hull',              short: 'Hull',         team: 'HOU', teamName: 'Houston Texans', skin: '#5e3c22', height: 71, weight: 200, starter: false, number: 42, attrs: { speed: 6, burst: 6, strength: 3, size: 4, balance: 4, hands: 5, vision: 3, elusiveness: 4,  carrying: 5 } },
  // IND
  { name: 'Jonathan Taylor',        short: 'Taylor',       team: 'IND', teamName: 'Indianapolis Colts', skin: '#5e3c22', height: 70, weight: 226, starter: true,  captain: true,  number: 28, attrs: { speed: 10, burst: 8, strength: 8, size: 8, balance: 9, hands: 7, vision: 9, elusiveness: 7,  carrying: 9 } },
  { name: 'DJ Giddens',             short: 'Giddens',      team: 'IND', teamName: 'Indianapolis Colts', skin: '#5e3c22', height: 70, weight: 198, starter: false, number: 21, attrs: { speed: 7, burst: 6, strength: 3, size: 3, balance: 4, hands: 4, vision: 3, elusiveness: 4,  carrying: 4 } },
  { name: 'Seth McGowan',           short: 'McGowan',      team: 'IND', teamName: 'Indianapolis Colts', skin: '#5e3c22', height: 71, weight: 215, starter: false, number: 20, attrs: { speed: 5, burst: 3, strength: 6, size: 6, balance: 5, hands: 2, vision: 2, elusiveness: 2,  carrying: 4 } },
  // JAX
  { name: 'Bhayshul Tuten',         short: 'Tuten',        team: 'JAX', teamName: 'Jacksonville Jaguars', skin: '#5e3c22', height: 70, weight: 185, starter: true,  captain: true,  number: 33, attrs: { speed: 9, burst: 9, strength: 3, size: 1, balance: 4, hands: 4, vision: 5, elusiveness: 6,  carrying: 4 } },
  { name: 'Chris Rodriguez Jr.',    short: 'Rodriguez',    team: 'JAX', teamName: 'Jacksonville Jaguars', skin: '#5e3c22', height: 72, weight: 217, starter: false, number: 36, attrs: { speed: 5, burst: 6, strength: 5, size: 6, balance: 5, hands: 3, vision: 4, elusiveness: 4,  carrying: 5 } },
  { name: 'LeQuint Allen',          short: 'L. Allen',     team: 'JAX', teamName: 'Jacksonville Jaguars', skin: '#5e3c22', height: 71, weight: 200, starter: false, number: 5,  attrs: { speed: 5, burst: 6, strength: 3, size: 4, balance: 4, hands: 5, vision: 4, elusiveness: 3,  carrying: 4 } },
  // KC
  { name: 'Kenneth Walker III',     short: 'K. Walker',    team: 'KC',  teamName: 'Kansas City Chiefs', skin: '#5e3c22', height: 69, weight: 211, starter: true,  captain: true,  number: 9,  attrs: { speed: 9, burst: 9, strength: 7, size: 5, balance: 7, hands: 4, vision: 7, elusiveness: 7,  carrying: 7 } },
  { name: 'Emari Demercado',        short: 'Demercado',    team: 'KC',  teamName: 'Kansas City Chiefs', skin: '#5e3c22', height: 70, weight: 210, starter: false, number: 25, attrs: { speed: 7, burst: 6, strength: 2, size: 4, balance: 3, hands: 5, vision: 4, elusiveness: 4,  carrying: 4 } },
  { name: 'Emmett Johnson',         short: 'E. Johnson',   team: 'KC',  teamName: 'Kansas City Chiefs', skin: '#5e3c22', height: 71, weight: 215, starter: false, number: 10, attrs: { speed: 5, burst: 5, strength: 4, size: 6, balance: 3, hands: 2, vision: 2, elusiveness: 3,  carrying: 4 } },
  // LAC
  { name: 'Omarion Hampton',        short: 'Hampton',      team: 'LAC', teamName: 'Los Angeles Chargers', skin: '#5e3c22', height: 72, weight: 223, starter: true,  captain: true,  number: 8,  attrs: { speed: 7, burst: 5, strength: 8, size: 7, balance: 7, hands: 5, vision: 4, elusiveness: 6,  carrying: 7 } },
  { name: 'Keaton Mitchell',        short: 'K. Mitchell',  team: 'LAC', teamName: 'Los Angeles Chargers', skin: '#5e3c22', height: 68, weight: 178, starter: false, number: 34, attrs: { speed: 10, burst: 9, strength: 0, size: 0, balance: 2, hands: 6, vision: 5, elusiveness: 5,  carrying: 3 } },
  { name: 'Kimani Vidal',           short: 'Vidal',        team: 'LAC', teamName: 'Los Angeles Chargers', skin: '#5e3c22', height: 69, weight: 200, starter: false, number: 28, attrs: { speed: 7, burst: 7, strength: 5, size: 3, balance: 6, hands: 3, vision: 4, elusiveness: 5,  carrying: 5 } },
  // LAR
  { name: 'Kyren Williams',         short: 'K. Williams',  team: 'LAR', teamName: 'Los Angeles Rams', skin: '#5e3c22', height: 69, weight: 210, starter: true,  captain: true,  number: 23, attrs: { speed: 5, burst: 6, strength: 8, size: 5, balance: 8, hands: 6, vision: 10, elusiveness: 6,  carrying: 8 } },
  { name: 'Blake Corum',            short: 'Corum',        team: 'LAR', teamName: 'Los Angeles Rams', skin: '#b07848', height: 68, weight: 213, starter: false, number: 24, attrs: { speed: 5, burst: 5, strength: 7, size: 5, balance: 7, hands: 5, vision: 6, elusiveness: 5,  carrying: 6 } },
  { name: 'Jarquez Hunter',         short: 'Hunter',       team: 'LAR', teamName: 'Los Angeles Rams', skin: '#5e3c22', height: 70, weight: 204, starter: false, number: 27, attrs: { speed: 8, burst: 8, strength: 3, size: 4, balance: 4, hands: 4, vision: 5, elusiveness: 7,  carrying: 5 } },
  // LV
  { name: 'Ashton Jeanty',          short: 'Jeanty',       team: 'LV',  teamName: 'Las Vegas Raiders', skin: '#5e3c22', height: 69, weight: 215, starter: true,  captain: true,  number: 2,  attrs: { speed: 8, burst: 7, strength: 8, size: 7, balance: 10, hands: 7, vision: 7, elusiveness: 8,  carrying: 8 } },
  { name: 'Mike Washington',        short: 'Washington',   team: 'LV',  teamName: 'Las Vegas Raiders', skin: '#5e3c22', height: 71, weight: 218, starter: false, number: 30, attrs: { speed: 4, burst: 3, strength: 6, size: 6, balance: 5, hands: 3, vision: 4, elusiveness: 2,  carrying: 5 } },
  { name: 'Dylan Laube',            short: 'Laube',        team: 'LV',  teamName: 'Las Vegas Raiders', skin: '#f0c4a0', height: 71, weight: 207, starter: false, number: 23, attrs: { speed: 6, burst: 6, strength: 3, size: 5, balance: 3, hands: 8, vision: 5, elusiveness: 5,  carrying: 7 } },
  // MIA
  { name: "De'Von Achane",          short: 'Achane',       team: 'MIA', teamName: 'Miami Dolphins', skin: '#5e3c22', height: 69, weight: 188, starter: true,  captain: true,  number: 28, attrs: { speed: 11, burst: 10, strength: 2, size: 1, balance: 4, hands: 8, vision: 6, elusiveness: 7,  carrying: 5 } },
  { name: 'Jaylen Wright',          short: 'J. Wright',    team: 'MIA', teamName: 'Miami Dolphins', skin: '#5e3c22', height: 69, weight: 203, starter: false, number: 5,  attrs: { speed: 9, burst: 8, strength: 5, size: 4, balance: 3, hands: 4, vision: 4, elusiveness: 5,  carrying: 5 } },
  { name: 'Ollie Gordon',           short: 'Gordon',       team: 'MIA', teamName: 'Miami Dolphins', skin: '#5e3c22', height: 73, weight: 224, starter: false, number: 0,  attrs: { speed: 4, burst: 4, strength: 7, size: 8, balance: 5, hands: 4, vision: 3, elusiveness: 2,  carrying: 6 } },
  // MIN
  { name: 'Aaron Jones',            short: 'A. Jones',     team: 'MIN', teamName: 'Minnesota Vikings', skin: '#5e3c22', height: 69, weight: 208, starter: true,  captain: true,  number: 33, attrs: { speed: 7, burst: 7, strength: 4, size: 4, balance: 5, hands: 8, vision: 7, elusiveness: 6,  carrying: 5 } },
  { name: 'Jordan Mason',           short: 'Mason',        team: 'MIN', teamName: 'Minnesota Vikings', skin: '#3a2010', height: 71, weight: 232, starter: false, number: 27, attrs: { speed: 6, burst: 7, strength: 8, size: 8, balance: 7, hands: 2, vision: 6, elusiveness: 5,  carrying: 7 } },
  { name: 'Demond Claiborne',       short: 'Claiborne',    team: 'MIN', teamName: 'Minnesota Vikings', skin: '#5e3c22', height: 70, weight: 208, starter: false, number: 21, attrs: { speed: 6, burst: 6, strength: 3, size: 5, balance: 4, hands: 3, vision: 4, elusiveness: 6,  carrying: 5 } },
  // NE
  { name: 'TreVeyon Henderson',     short: 'Henderson',    team: 'NE',  teamName: 'New England Patriots', skin: '#5e3c22', height: 70, weight: 208, starter: true,  captain: true,  number: 32, attrs: { speed: 9, burst: 7, strength: 4, size: 5, balance: 5, hands: 5, vision: 5, elusiveness: 6,  carrying: 8 } },
  { name: 'Rhamondre Stevenson',    short: 'Stevenson',    team: 'NE',  teamName: 'New England Patriots', skin: '#3a2010', height: 72, weight: 230, starter: false, number: 38, attrs: { speed: 6, burst: 5, strength: 8, size: 8, balance: 7, hands: 6, vision: 6, elusiveness: 3,  carrying: 4 } },
  { name: 'Jam Miller',             short: 'J. Miller',    team: 'NE',  teamName: 'New England Patriots', skin: '#5e3c22', height: 71, weight: 210, starter: false, number: 30, attrs: { speed: 4, burst: 4, strength: 6, size: 5, balance: 4, hands: 3, vision: 3, elusiveness: 2,  carrying: 6 } },
  // NO
  { name: 'Travis Etienne Jr.',     short: 'Etienne',      team: 'NO',  teamName: 'New Orleans Saints', skin: '#5e3c22', height: 70, weight: 215, starter: true,  captain: true,  number: 3,  attrs: { speed: 8, burst: 9, strength: 3, size: 5, balance: 6, hands: 8, vision: 7, elusiveness: 7,  carrying: 8 } },
  { name: 'Alvin Kamara',           short: 'Kamara',       team: 'NO',  teamName: 'New Orleans Saints', skin: '#5e3c22', height: 70, weight: 215, starter: false, number: 41, attrs: { speed: 6, burst: 6, strength: 7, size: 6, balance: 8, hands: 9, vision: 7, elusiveness: 6,  carrying: 7 } },
  { name: 'Kendre Miller',          short: 'K. Miller',    team: 'NO',  teamName: 'New Orleans Saints', skin: '#5e3c22', height: 71, weight: 221, starter: false, number: 5,  attrs: { speed: 5, burst: 4, strength: 7, size: 7, balance: 5, hands: 3, vision: 5, elusiveness: 3,  carrying: 6 } },
  // NYG
  { name: 'Cam Skattebo',           short: 'Skattebo',     team: 'NYG', teamName: 'New York Giants', skin: '#f0c4a0', height: 71, weight: 216, starter: true,  captain: true,  number: 44, attrs: { speed: 4, burst: 5, strength: 9, size: 7, balance: 9, hands: 7, vision: 6, elusiveness: 5,  carrying: 8 } },
  { name: 'Tyrone Tracy',           short: 'Tracy',        team: 'NYG', teamName: 'New York Giants', skin: '#5e3c22', height: 72, weight: 205, starter: false, number: 29, attrs: { speed: 7, burst: 7, strength: 4, size: 5, balance: 4, hands: 5, vision: 6, elusiveness: 6,  carrying: 7 } },
  { name: 'Devin Singletary',       short: 'Singletary',   team: 'NYG', teamName: 'New York Giants', skin: '#5e3c22', height: 67, weight: 203, starter: false, number: 26, attrs: { speed: 4, burst: 5, strength: 4, size: 3, balance: 5, hands: 5, vision: 9, elusiveness: 5,  carrying: 6 } },
  // NYJ
  { name: 'Breece Hall',            short: 'Hall',         team: 'NYJ', teamName: 'New York Jets', skin: '#5e3c22', height: 73, weight: 220, starter: true,  captain: true,  number: 20, attrs: { speed: 8, burst: 7, strength: 6, size: 7, balance: 7, hands: 8, vision: 6, elusiveness: 8,  carrying: 6 } },
  { name: 'Braelon Allen',          short: 'B. Allen',     team: 'NYJ', teamName: 'New York Jets', skin: '#5e3c22', height: 72, weight: 235, starter: false, number: 0,  attrs: { speed: 6, burst: 5, strength: 8, size: 10, balance: 5, hands: 4, vision: 3, elusiveness: 4,  carrying: 7 } },
  { name: 'Michael Carter',         short: 'M. Carter',    team: 'NYJ', teamName: 'New York Jets', skin: '#5e3c22', height: 68, weight: 201, starter: false, number: 32, attrs: { speed: 5, burst: 4, strength: 2, size: 3, balance: 4, hands: 5, vision: 5, elusiveness: 6,  carrying: 6 } },
  // PHI
  { name: 'Saquon Barkley',         short: 'Barkley',      team: 'PHI', teamName: 'Philadelphia Eagles', skin: '#5e3c22', height: 71, weight: 233, starter: true,  captain: true,  number: 26, attrs: { speed: 10, burst: 9, strength: 9, size: 9, balance: 7, hands: 8, vision: 8, elusiveness: 10, carrying: 10 } },
  { name: 'Tank Bigsby',            short: 'Bigsby',       team: 'PHI', teamName: 'Philadelphia Eagles', skin: '#5e3c22', height: 71, weight: 206, starter: false, number: 8,  attrs: { speed: 8, burst: 7, strength: 6, size: 5, balance: 6, hands: 2, vision: 5, elusiveness: 5,  carrying: 6 } },
  { name: 'Will Shipley',           short: 'Shipley',      team: 'PHI', teamName: 'Philadelphia Eagles', skin: '#f0c4a0', height: 70, weight: 205, starter: false, number: 28, attrs: { speed: 7, burst: 7, strength: 3, size: 4, balance: 2, hands: 6, vision: 5, elusiveness: 5,  carrying: 5 } },
  // PIT
  { name: 'Jaylen Warren',          short: 'Warren',       team: 'PIT', teamName: 'Pittsburgh Steelers', skin: '#5e3c22', height: 68, weight: 215, starter: true,  captain: true,  number: 30, attrs: { speed: 6, burst: 8, strength: 7, size: 5, balance: 8, hands: 6, vision: 7, elusiveness: 6,  carrying: 9 } },
  { name: 'Rico Dowdle',            short: 'Dowdle',       team: 'PIT', teamName: 'Pittsburgh Steelers', skin: '#5e3c22', height: 69, weight: 208, starter: false, number: 13, attrs: { speed: 7, burst: 7, strength: 6, size: 6, balance: 8, hands: 5, vision: 6, elusiveness: 7,  carrying: 7 } },
  { name: 'Kaleb Johnson',          short: 'K. Johnson',   team: 'PIT', teamName: 'Pittsburgh Steelers', skin: '#5e3c22', height: 71, weight: 226, starter: false, number: 20, attrs: { speed: 5, burst: 6, strength: 7, size: 7, balance: 6, hands: 4, vision: 3, elusiveness: 3,  carrying: 6 } },
  // SF
  { name: 'Christian McCaffrey',    short: 'McCaffrey',    team: 'SF',  teamName: 'San Francisco 49ers', skin: '#f0c4a0', height: 71, weight: 215, starter: true,  captain: true,  number: 23, attrs: { speed: 8, burst: 9, strength: 6, size: 6, balance: 6, hands: 11, vision: 9, elusiveness: 9,  carrying: 10 } },
  { name: 'Jordan James',           short: 'J. James',     team: 'SF',  teamName: 'San Francisco 49ers', skin: '#5e3c22', height: 70, weight: 209, starter: false, number: 29, attrs: { speed: 6, burst: 6, strength: 4, size: 5, balance: 4, hands: 4, vision: 3, elusiveness: 4,  carrying: 6 } },
  { name: 'Isaac Guerendo',         short: 'Guerendo',     team: 'SF',  teamName: 'San Francisco 49ers', skin: '#5e3c22', height: 71, weight: 215, starter: false, number: 31, attrs: { speed: 8, burst: 7, strength: 3, size: 6, balance: 2, hands: 4, vision: 4, elusiveness: 5,  carrying: 5 } },
  // SEA
  { name: 'Jadarian Price',         short: 'Price',        team: 'SEA', teamName: 'Seattle Seahawks', skin: '#5e3c22', height: 72, weight: 205, starter: true,  captain: true,  number: 8,  attrs: { speed: 7, burst: 7, strength: 5, size: 5, balance: 6, hands: 4, vision: 5, elusiveness: 4,  carrying: 7 } },
  { name: 'Zach Charbonnet',        short: 'Charbonnet',   team: 'SEA', teamName: 'Seattle Seahawks', skin: '#5e3c22', height: 72, weight: 224, starter: false, number: 26, attrs: { speed: 5, burst: 6, strength: 8, size: 7, balance: 7, hands: 6, vision: 6, elusiveness: 5,  carrying: 10 } },
  { name: 'George Holani',          short: 'Holani',       team: 'SEA', teamName: 'Seattle Seahawks', skin: '#b07848', height: 71, weight: 210, starter: false, number: 36, attrs: { speed: 6, burst: 7, strength: 4, size: 5, balance: 4, hands: 4, vision: 5, elusiveness: 4,  carrying: 6 } },
  // TB
  { name: 'Bucky Irving',           short: 'Irving',       team: 'TB',  teamName: 'Tampa Bay Buccaneers', skin: '#5e3c22', height: 69, weight: 192, starter: true,  captain: true,  number: 7,  attrs: { speed: 6, burst: 8, strength: 4, size: 2, balance: 7, hands: 6, vision: 7, elusiveness: 10,  carrying: 7 } },
  { name: 'Kenny Gainwell',         short: 'Gainwell',     team: 'TB',  teamName: 'Tampa Bay Buccaneers', skin: '#5e3c22', height: 68, weight: 201, starter: false, number: 1,  attrs: { speed: 7, burst: 8, strength: 4, size: 3, balance: 4, hands: 8, vision: 6, elusiveness: 7,  carrying: 6 } },
  { name: 'Sean Tucker',            short: 'Tucker',       team: 'TB',  teamName: 'Tampa Bay Buccaneers', skin: '#5e3c22', height: 70, weight: 200, starter: false, number: 44, attrs: { speed: 7, burst: 6, strength: 5, size: 4, balance: 4, hands: 5, vision: 3, elusiveness: 3,  carrying: 5 } },
  // TEN
  { name: 'Tony Pollard',           short: 'Pollard',      team: 'TEN', teamName: 'Tennessee Titans', skin: '#5e3c22', height: 72, weight: 210, starter: true,  captain: true,  number: 20, attrs: { speed: 7, burst: 7, strength: 4, size: 5, balance: 5, hands: 7, vision: 7, elusiveness: 6,  carrying: 7 } },
  { name: 'Tyjae Spears',           short: 'Spears',       team: 'TEN', teamName: 'Tennessee Titans', skin: '#5e3c22', height: 70, weight: 188, starter: false, number: 2,  attrs: { speed: 6, burst: 7, strength: 3, size: 2, balance: 5, hands: 7, vision: 7, elusiveness: 6,  carrying: 9 } },
  { name: 'Nicholas Singleton',     short: 'Singleton',    team: 'TEN', teamName: 'Tennessee Titans', skin: '#5e3c22', height: 72, weight: 220, starter: false, number: 32, attrs: { speed: 5, burst: 5, strength: 7, size: 7, balance: 4, hands: 3, vision: 4, elusiveness: 2,  carrying: 5 } },
  // WAS
  { name: 'Jacory Croskey-Merritt', short: 'Croskey',      team: 'WAS', teamName: 'Washington Commanders', skin: '#5e3c22', height: 69, weight: 195, starter: true,  captain: true,  number: 22, attrs: { speed: 7, burst: 9, strength: 3, size: 3, balance: 5, hands: 3, vision: 5, elusiveness: 6,  carrying: 6 } },
  { name: 'Rachaad White',          short: 'R. White',     team: 'WAS', teamName: 'Washington Commanders', skin: '#5e3c22', height: 72, weight: 214, starter: false, number: 1,  attrs: { speed: 7, burst: 6, strength: 5, size: 6, balance: 5, hands: 8, vision: 6, elusiveness: 6,  carrying: 7 } },
  { name: 'Kaytron Allen',          short: 'K. Allen',     team: 'WAS', teamName: 'Washington Commanders', skin: '#5e3c22', height: 71, weight: 219, starter: false, number: 31, attrs: { speed: 5, burst: 5, strength: 6, size: 6, balance: 4, hands: 3, vision: 3, elusiveness: 2,  carrying: 6 } },
  { name: 'Jerome Ford',            short: 'Ford',         team: 'WAS', teamName: 'Washington Commanders', skin: '#5e3c22', height: 70, weight: 213, starter: false, number: 34, attrs: { speed: 7, burst: 7, strength: 4, size: 5, balance: 3, hands: 5, vision: 4, elusiveness: 5,  carrying: 7 } },
]

export const RBS = _RBS.map(rb => ({ ...rb, ...TEAM_COLOR[rb.team] }))

export const RB_PHYSICALS = Object.fromEntries(_RBS.map(rb => [rb.name, { height: rb.height, weight: rb.weight }]))
