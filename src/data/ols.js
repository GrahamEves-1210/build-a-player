// Offensive line — 2026 starters (LT/LG/C/RG/RT), one row per team per spot.
// Grades → value: S=11 A+=10 A=9 A-=8 B+=7 B=6 B-=5 C+=4 C=3 C-=2 D=1 F=0
// Height (total inches), weight (lbs) and jersey number from ESPN athlete bios (Oct 2026).
// arm: arm length in inches from each player's combine or pro day (MockDraftable,
//      cross-checked against ESPN college; pre-draft measurables tables for the rest).
// size:   graded mostly from weight with a little height — index = weight + 4 lb per inch
//         over 6'5" (minus 4 per inch under); every 6.5 index points = one grade, 280 = F.
// length: graded from arm length — every half inch = one grade, 30⅝" = F, 36⅛"+ = S.
// skin: #f0c4a0 white  #b07848 mixed/Polynesian/Latino  #5e3c22 Black  #3a2010 very dark Black

import { TEAMS } from './nfl-teams'
const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

export const OL_TYPES      = ['size', 'length', 'anchor', 'passPro', 'runBlock', 'mobility', 'blitzPickup', 'discipline', 'pancake']
export const OL_LITE_TYPES = ['size', 'anchor', 'passPro', 'runBlock']

export const OL_CATEGORIES = [
  { id: 'physical', label: 'Physical', types: ['size', 'length', 'anchor', 'mobility'] },
  { id: 'skill',    label: 'Skill',    types: ['passPro', 'runBlock', 'pancake'] },
  { id: 'mental',   label: 'Mental',   types: ['blitzPickup', 'discipline'] },
]

export const OL_ATTR = {
  'size':        { label: 'Size',         shortLabel: 'SZE', category: 'physical', col: 'var(--c-str)',  hex: '#fb923c', bodyZone: 'core' },
  'length':      { label: 'Length',       shortLabel: 'LEN', category: 'physical', col: 'var(--c-acc)',  hex: '#34d399', bodyZone: 'arm'  },
  'anchor':      { label: 'Anchor',       shortLabel: 'ANC', category: 'physical', col: 'var(--c-vis)',  hex: '#38bdf8', bodyZone: 'legs' },
  'passPro':     { label: 'Pass Pro',     shortLabel: 'PP',  category: 'skill',    col: 'var(--c-pkt)',  hex: '#2dd4bf', bodyZone: 'arm'  },
  'runBlock':    { label: 'Run Block',    shortLabel: 'RB',  category: 'skill',    col: 'var(--c-arm)',  hex: '#f87171', bodyZone: 'arm'  },
  'mobility':    { label: 'Mobility',     shortLabel: 'MOB', category: 'physical', col: 'var(--c-mob)',  hex: '#60a5fa', bodyZone: 'legs' },
  'blitzPickup': { label: 'Blitz Pickup', shortLabel: 'BLZ', category: 'mental',   col: 'var(--c-iq)',   hex: '#e879f9', bodyZone: 'head' },
  'discipline':  { label: 'Discipline',   shortLabel: 'DIS', category: 'mental',   col: 'var(--c-lead)', hex: '#a78bfa', bodyZone: 'hand' },
  'pancake':     { label: 'Pancake',      shortLabel: 'PNK', category: 'skill',    col: 'var(--c-comp)', hex: '#fbbf24', bodyZone: 'legs' },
}

const _OLS = [
  // BUF
  { name: "Dion Dawkins",              team: 'BUF', teamName: 'Buffalo Bills',          pos: 'LT', skin: '#5e3c22', height: 77, weight: 320, arm: 35, number: 73, attrs: { size:  6, length:  9, anchor: 8, passPro: 8, runBlock: 7, mobility: 5, blitzPickup: 8, discipline: 1, pancake: 6 } },
  { name: "Alec Anderson",             team: 'BUF', teamName: 'Buffalo Bills',          pos: 'LG', skin: '#f0c4a0', height: 77, weight: 305, arm: 33.25, number: 70, attrs: { size:  4, length:  5, anchor: 4, passPro: 4, runBlock: 4, mobility: 5, blitzPickup: 4, discipline: 4, pancake: 3 } },
  { name: "Connor McGovern",           team: 'BUF', teamName: 'Buffalo Bills',          pos: 'C',  skin: '#f0c4a0', height: 78, weight: 318, arm: 34.125, number: 66, attrs: { size:  6, length:  7, anchor: 7, passPro: 7, runBlock: 5, mobility: 6, blitzPickup: 7, discipline: 8, pancake: 4 } },
  { name: "O'Cyrus Torrence",          team: 'BUF', teamName: 'Buffalo Bills',          pos: 'RG', skin: '#5e3c22', height: 77, weight: 330, arm: 33.875, number: 64, attrs: { size:  8, length:  7, anchor: 8, passPro: 4, runBlock: 6, mobility: 3, blitzPickup: 4, discipline: 10, pancake: 7 } },
  { name: "Spencer Brown",             team: 'BUF', teamName: 'Buffalo Bills',          pos: 'RT', skin: '#f0c4a0', height: 80, weight: 311, arm: 34.75, number: 79, attrs: { size:  7, length:  8, anchor: 6, passPro: 4, runBlock: 9, mobility: 7, blitzPickup: 5, discipline: 5, pancake: 7 } },
  // MIA
  { name: "Patrick Paul",              team: 'MIA', teamName: 'Miami Dolphins',         pos: 'LT', skin: '#5e3c22', height: 79, weight: 326, arm: 36.25, number: 52, attrs: { size:  8, length: 11, anchor: 5, passPro: 4, runBlock: 4, mobility: 5, blitzPickup: 4, discipline: 3, pancake: 4 } },
  { name: "Kadyn Proctor",             team: 'MIA', teamName: 'Miami Dolphins',         pos: 'LG', skin: '#b07848', height: 79, weight: 352, arm: 33.375, number: 74, attrs: { size: 11, length:  6, anchor: 8, passPro: 4, runBlock: 7, mobility: 5, blitzPickup: 3, discipline: 4, pancake: 8 } },
  { name: "Aaron Brewer",              team: 'MIA', teamName: 'Miami Dolphins',         pos: 'C',  skin: '#5e3c22', height: 73, weight: 295, arm: 32.75, number: 55, attrs: { size:  0, length:  4, anchor: 6, passPro: 8, runBlock: 10, mobility: 10, blitzPickup: 8, discipline: 5, pancake: 7 } },
  { name: "Jonah Savaiinaea",          team: 'MIA', teamName: 'Miami Dolphins',         pos: 'RG', skin: '#b07848', height: 77, weight: 326, arm: 33.875, number: 71, attrs: { size:  7, length:  7, anchor: 5, passPro: 3, runBlock: 4, mobility: 4, blitzPickup: 3, discipline: 8, pancake: 5 } },
  { name: "Austin Jackson",            team: 'MIA', teamName: 'Miami Dolphins',         pos: 'RT', skin: '#5e3c22', height: 77, weight: 310, arm: 34.125, number: 73, attrs: { size:  5, length:  7, anchor: 5, passPro: 5, runBlock: 6, mobility: 7, blitzPickup: 5, discipline: 4, pancake: 5 } },
  // NE
  { name: "Will Campbell",             team: 'NE',  teamName: 'New England Patriots',   pos: 'LT', skin: '#f0c4a0', height: 78, weight: 319, arm: 32.625, number: 66, attrs: { size:  7, length:  4, anchor: 5, passPro: 5, runBlock: 6, mobility: 7, blitzPickup: 5, discipline: 5, pancake: 6 } },
  { name: "Alijah Vera-Tucker",        team: 'NE',  teamName: 'New England Patriots',   pos: 'LG', skin: '#b07848', height: 76, weight: 308, arm: 32.125, number: 75, attrs: { size:  4, length:  3, anchor: 7, passPro: 7, runBlock: 7, mobility: 7, blitzPickup: 6, discipline: 6, pancake: 6 } },
  { name: "Jared Wilson",              team: 'NE',  teamName: 'New England Patriots',   pos: 'C',  skin: '#5e3c22', height: 75, weight: 310, arm: 32.375, number: 55, attrs: { size:  3, length:  4, anchor: 3, passPro: 2, runBlock: 3, mobility: 9, blitzPickup: 3, discipline: 7, pancake: 3 } },
  { name: "Mike Onwenu",               team: 'NE',  teamName: 'New England Patriots',   pos: 'RG', skin: '#5e3c22', height: 75, weight: 350, arm: 34.375, number: 71, attrs: { size: 10, length:  8, anchor: 8, passPro: 7, runBlock: 6, mobility: 4, blitzPickup: 7, discipline: 8, pancake: 7 } },
  { name: "Morgan Moses",              team: 'NE',  teamName: 'New England Patriots',   pos: 'RT', skin: '#5e3c22', height: 78, weight: 320, arm: 35.375, number: 76, attrs: { size:  7, length: 10, anchor: 7, passPro: 6, runBlock: 7, mobility: 3, blitzPickup: 8, discipline: 5, pancake: 7 } },
  // NYJ
  { name: "Olu Fashanu",               team: 'NYJ', teamName: 'New York Jets',          pos: 'LT', skin: '#5e3c22', height: 78, weight: 312, arm: 34, number: 74, attrs: { size:  6, length:  7, anchor: 4, passPro: 5, runBlock: 4, mobility: 8, blitzPickup: 4, discipline: 8, pancake: 3 } },
  { name: "Dylan Parham",              team: 'NYJ', teamName: 'New York Jets',          pos: 'LG', skin: '#5e3c22', height: 75, weight: 311, arm: 33.125, number: 64, attrs: { size:  4, length:  5, anchor: 5, passPro: 4, runBlock: 4, mobility: 6, blitzPickup: 5, discipline: 6, pancake: 4 } },
  { name: "Josh Myers",                team: 'NYJ', teamName: 'New York Jets',          pos: 'C',  skin: '#f0c4a0', height: 77, weight: 310, arm: 32, number: 71, attrs: { size:  5, length:  3, anchor: 4, passPro: 3, runBlock: 3, mobility: 4, blitzPickup: 4, discipline: 7, pancake: 2 } },
  { name: "Joe Tippmann",              team: 'NYJ', teamName: 'New York Jets',          pos: 'RG', skin: '#f0c4a0', height: 78, weight: 313, arm: 32.75, number: 66, attrs: { size:  6, length:  4, anchor: 5, passPro: 5, runBlock: 5, mobility: 7, blitzPickup: 6, discipline: 5, pancake: 5 } },
  { name: "Armand Membou",             team: 'NYJ', teamName: 'New York Jets',          pos: 'RT', skin: '#5e3c22', height: 76, weight: 332, arm: 33.5, number: 70, attrs: { size:  7, length:  6, anchor: 7, passPro: 6, runBlock: 5, mobility: 9, blitzPickup: 4, discipline: 3, pancake: 7 } },
  // BAL
  { name: "Ronnie Stanley",            team: 'BAL', teamName: 'Baltimore Ravens',       pos: 'LT', skin: '#5e3c22', height: 78, weight: 310, arm: 35.625, number: 79, attrs: { size:  5, length: 10, anchor: 6, passPro: 6, runBlock: 5, mobility: 5, blitzPickup: 7, discipline: 6, pancake: 4 } },
  { name: "John Simpson",              team: 'BAL', teamName: 'Baltimore Ravens',       pos: 'LG', skin: '#5e3c22', height: 76, weight: 330, arm: 34.125, number: 74, attrs: { size:  7, length:  7, anchor: 7, passPro: 4, runBlock: 5, mobility: 5, blitzPickup: 4, discipline: 1, pancake: 6 } },
  { name: "Jovaughn Gwyn",             team: 'BAL', teamName: 'Baltimore Ravens',       pos: 'C',  skin: '#b07848', height: 74, weight: 301, arm: 31.75, number: 54, attrs: { size:  1, length:  2, anchor: 3, passPro: 4, runBlock: 4, mobility: 5, blitzPickup: 4, discipline: 6, pancake: 3 } },
  { name: "Olaivavega Ioane",          team: 'BAL', teamName: 'Baltimore Ravens',       pos: 'RG', skin: '#b07848', height: 76, weight: 320, arm: 32.75, number: 71, attrs: { size:  6, length:  4, anchor: 8, passPro: 5, runBlock: 7, mobility: 4, blitzPickup: 4, discipline: 5, pancake: 7 } },
  { name: "Roger Rosengarten",         team: 'BAL', teamName: 'Baltimore Ravens',       pos: 'RT', skin: '#f0c4a0', height: 77, weight: 316, arm: 33.5, number: 70, attrs: { size:  6, length:  6, anchor: 5, passPro: 6, runBlock: 6, mobility: 7, blitzPickup: 5, discipline: 7, pancake: 5 } },
  // CIN
  { name: "Orlando Brown Jr.",         team: 'CIN', teamName: 'Cincinnati Bengals',     pos: 'LT', skin: '#5e3c22', height: 80, weight: 350, arm: 35, number: 75, attrs: { size: 11, length:  9, anchor: 9, passPro: 4, runBlock: 4, mobility: 1, blitzPickup: 6, discipline: 1, pancake: 4 } },
  { name: "Dylan Fairchild",           team: 'CIN', teamName: 'Cincinnati Bengals',     pos: 'LG', skin: '#f0c4a0', height: 77, weight: 318, arm: 33, number: 63, attrs: { size:  6, length:  5, anchor: 5, passPro: 4, runBlock: 5, mobility: 7, blitzPickup: 4, discipline: 5, pancake: 5 } },
  { name: "Ted Karras",                team: 'CIN', teamName: 'Cincinnati Bengals',     pos: 'C',  skin: '#f0c4a0', height: 76, weight: 310, arm: 32.5, number: 64, attrs: { size:  4, length:  4, anchor: 6, passPro: 6, runBlock: 4, mobility: 4, blitzPickup: 8, discipline: 7, pancake: 3 } },
  { name: "Dalton Risner",             team: 'CIN', teamName: 'Cincinnati Bengals',     pos: 'RG', skin: '#f0c4a0', height: 77, weight: 312, arm: 34, number: 66, attrs: { size:  5, length:  7, anchor: 6, passPro: 6, runBlock: 5, mobility: 4, blitzPickup: 6, discipline: 6, pancake: 4 } },
  { name: "Amarius Mims",              team: 'CIN', teamName: 'Cincinnati Bengals',     pos: 'RT', skin: '#3a2010', height: 80, weight: 350, arm: 36.125, number: 71, attrs: { size: 11, length: 11, anchor: 7, passPro: 5, runBlock: 5, mobility: 6, blitzPickup: 4, discipline: 8, pancake: 6 } },
  // CLE
  { name: "Spencer Fano",              team: 'CLE', teamName: 'Cleveland Browns',       pos: 'LT', skin: '#b07848', height: 78, weight: 315, arm: 32.125, number: 55, attrs: { size:  6, length:  3, anchor: 4, passPro: 6, runBlock: 8, mobility: 10, blitzPickup: 5, discipline: 6, pancake: 6 } },
  { name: "Zion Johnson",              team: 'CLE', teamName: 'Cleveland Browns',       pos: 'LG', skin: '#5e3c22', height: 75, weight: 315, arm: 34, number: 77, attrs: { size:  4, length:  7, anchor: 6, passPro: 4, runBlock: 4, mobility: 5, blitzPickup: 5, discipline: 8, pancake: 5 } },
  { name: "Elgton Jenkins",            team: 'CLE', teamName: 'Cleveland Browns',       pos: 'C',  skin: '#5e3c22', height: 77, weight: 310, arm: 34, number: 74, attrs: { size:  5, length:  7, anchor: 7, passPro: 7, runBlock: 5, mobility: 5, blitzPickup: 7, discipline: 6, pancake: 5 } },
  { name: "Teven Jenkins",             team: 'CLE', teamName: 'Cleveland Browns',       pos: 'RG', skin: '#b07848', height: 78, weight: 321, arm: 33.5, number: 78, attrs: { size:  7, length:  6, anchor: 7, passPro: 6, runBlock: 6, mobility: 5, blitzPickup: 5, discipline: 4, pancake: 7 } },
  { name: "Tytus Howard",              team: 'CLE', teamName: 'Cleveland Browns',       pos: 'RT', skin: '#5e3c22', height: 77, weight: 320, arm: 34, number: 71, attrs: { size:  6, length:  7, anchor: 6, passPro: 4, runBlock: 5, mobility: 5, blitzPickup: 5, discipline: 4, pancake: 5 } },
  // PIT
  { name: "Troy Fautanu",              team: 'PIT', teamName: 'Pittsburgh Steelers',    pos: 'LT', skin: '#b07848', height: 76, weight: 317, arm: 34.5, number: 76, attrs: { size:  5, length:  8, anchor: 5, passPro: 4, runBlock: 6, mobility: 8, blitzPickup: 4, discipline: 8, pancake: 7 } },
  { name: "Mason McCormick",           team: 'PIT', teamName: 'Pittsburgh Steelers',    pos: 'LG', skin: '#f0c4a0', height: 77, weight: 315, arm: 33.875, number: 66, attrs: { size:  5, length:  7, anchor: 6, passPro: 7, runBlock: 5, mobility: 5, blitzPickup: 6, discipline: 10, pancake: 5 } },
  { name: "Zach Frazier",              team: 'PIT', teamName: 'Pittsburgh Steelers',    pos: 'C',  skin: '#f0c4a0', height: 75, weight: 310, arm: 32.25, number: 54, attrs: { size:  3, length:  3, anchor: 9, passPro: 7, runBlock: 7, mobility: 6, blitzPickup: 8, discipline: 8, pancake: 7 } },
  { name: "Brock Hoffman",             team: 'PIT', teamName: 'Pittsburgh Steelers',    pos: 'RG', skin: '#f0c4a0', height: 76, weight: 302, arm: 33.25, number: 67, attrs: { size:  3, length:  5, anchor: 5, passPro: 4, runBlock: 4, mobility: 4, blitzPickup: 5, discipline: 8, pancake: 4 } },
  { name: "Max Iheanachor",            team: 'PIT', teamName: 'Pittsburgh Steelers',    pos: 'RT', skin: '#5e3c22', height: 78, weight: 321, arm: 33.875, number: 71, attrs: { size:  7, length:  7, anchor: 4, passPro: 4, runBlock: 4, mobility: 8, blitzPickup: 2, discipline: 3, pancake: 4 } },
  // HOU
  { name: "Aireontae Ersery",          team: 'HOU', teamName: 'Houston Texans',         pos: 'LT', skin: '#5e3c22', height: 78, weight: 330, arm: 33.125, number: 79, attrs: { size:  8, length:  5, anchor: 6, passPro: 4, runBlock: 5, mobility: 5, blitzPickup: 4, discipline: 2, pancake: 5 } },
  { name: "Keylan Rutledge",           team: 'HOU', teamName: 'Houston Texans',         pos: 'LG', skin: '#f0c4a0', height: 76, weight: 330, arm: 33.25, number: 66, attrs: { size:  7, length:  5, anchor: 7, passPro: 4, runBlock: 7, mobility: 5, blitzPickup: 4, discipline: 4, pancake: 7 } },
  { name: "Evan Brown",                team: 'HOU', teamName: 'Houston Texans',         pos: 'C',  skin: '#f0c4a0', height: 75, weight: 320, arm: 32.5, number: 63, attrs: { size:  5, length:  4, anchor: 5, passPro: 4, runBlock: 4, mobility: 4, blitzPickup: 6, discipline: 6, pancake: 3 } },
  { name: "Wyatt Teller",              team: 'HOU', teamName: 'Houston Texans',         pos: 'RG', skin: '#f0c4a0', height: 76, weight: 315, arm: 34, number: 75, attrs: { size:  5, length:  7, anchor:  7, passPro:  5, runBlock:  7, mobility:  6, blitzPickup:  6, discipline:  5, pancake:  6 } },
  { name: "Braden Smith",              team: 'HOU', teamName: 'Houston Texans',         pos: 'RT', skin: '#f0c4a0', height: 78, weight: 312, arm: 32.25, number: 71, attrs: { size:  6, length:  3, anchor: 7, passPro: 5, runBlock: 6, mobility: 5, blitzPickup: 6, discipline: 5, pancake: 6 } },
  // IND
  { name: "Bernhard Raimann",          team: 'IND', teamName: 'Indianapolis Colts',     pos: 'LT', skin: '#f0c4a0', height: 78, weight: 303, arm: 32.875, number: 79, attrs: { size:  4, length:  5, anchor: 7, passPro: 7, runBlock: 7, mobility: 8, blitzPickup: 7, discipline: 4, pancake: 6 } },
  { name: "Quenton Nelson",            team: 'IND', teamName: 'Indianapolis Colts',     pos: 'LG', skin: '#f0c4a0', height: 77, weight: 330, arm: 33.75, number: 56, attrs: { size:  8, length:  6, anchor: 10, passPro: 9, runBlock: 9, mobility: 7, blitzPickup: 9, discipline: 9, pancake: 10 } },
  { name: "Tanor Bortolini",           team: 'IND', teamName: 'Indianapolis Colts',     pos: 'C',  skin: '#f0c4a0', height: 76, weight: 303, arm: 31.5, number: 60, attrs: { size:  3, length:  2, anchor: 6, passPro: 5, runBlock: 9, mobility: 9, blitzPickup: 6, discipline: 9, pancake: 7 } },
  { name: "Matt Goncalves",            team: 'IND', teamName: 'Indianapolis Colts',     pos: 'RG', skin: '#f0c4a0', height: 78, weight: 317, arm: 33.25, number: 71, attrs: { size:  6, length:  5, anchor: 5, passPro: 5, runBlock: 4, mobility: 4, blitzPickup: 4, discipline: 6, pancake: 4 } },
  { name: "Jalen Travis",              team: 'IND', teamName: 'Indianapolis Colts',     pos: 'RT', skin: '#b07848', height: 80, weight: 339, arm: 34.875, number: 75, attrs: { size: 11, length:  9, anchor: 5, passPro: 4, runBlock: 4, mobility: 4, blitzPickup: 3, discipline: 4, pancake: 4 } },
  // JAX
  { name: "Anton Harrison",            team: 'JAX', teamName: 'Jacksonville Jaguars',   pos: 'LT', skin: '#3a2010', height: 76, weight: 315, arm: 34.125, number: 77, attrs: { size:  5, length:  7, anchor: 4, passPro: 6, runBlock: 4, mobility: 7, blitzPickup: 4, discipline: 5, pancake: 4 } },
  { name: "Ezra Cleveland",            team: 'JAX', teamName: 'Jacksonville Jaguars',   pos: 'LG', skin: '#f0c4a0', height: 78, weight: 312, arm: 33.375, number: 76, attrs: { size:  6, length:  6, anchor: 5, passPro: 6, runBlock: 4, mobility: 7, blitzPickup: 6, discipline: 10, pancake: 4 } },
  { name: "Robert Hainsey",            team: 'JAX', teamName: 'Jacksonville Jaguars',   pos: 'C',  skin: '#f0c4a0', height: 76, weight: 306, arm: 32.125, number: 73, attrs: { size:  3, length:  3, anchor: 4, passPro: 3, runBlock: 4, mobility: 5, blitzPickup: 6, discipline: 6, pancake: 3 } },
  { name: "Patrick Mekari",            team: 'JAX', teamName: 'Jacksonville Jaguars',   pos: 'RG', skin: '#f0c4a0', height: 76, weight: 305, arm: 31.625, number: 65, attrs: { size:  3, length:  2, anchor: 5, passPro: 5, runBlock: 4, mobility: 5, blitzPickup: 7, discipline: 3, pancake: 4 } },
  { name: "Cole Van Lanen",            team: 'JAX', teamName: 'Jacksonville Jaguars',   pos: 'RT', skin: '#f0c4a0', height: 77, weight: 312, arm: 33.375, number: 70, attrs: { size:  5, length:  6, anchor: 5, passPro: 5, runBlock: 5, mobility: 5, blitzPickup: 4, discipline: 5, pancake: 4 } },
  // TEN
  { name: "Dan Moore Jr.",             team: 'TEN', teamName: 'Tennessee Titans',       pos: 'LT', skin: '#5e3c22', height: 77, weight: 315, arm: 34.5, number: 75, attrs: { size:  5, length:  8, anchor: 4, passPro: 3, runBlock: 4, mobility: 6, blitzPickup: 4, discipline: 5, pancake: 3 } },
  { name: "Peter Skoronski",           team: 'TEN', teamName: 'Tennessee Titans',       pos: 'LG', skin: '#f0c4a0', height: 76, weight: 313, arm: 32.25, number: 77, attrs: { size:  4, length:  3, anchor: 7, passPro: 8, runBlock: 6, mobility: 7, blitzPickup: 8, discipline: 8, pancake: 5 } },
  { name: "Austin Schlottmann",        team: 'TEN', teamName: 'Tennessee Titans',       pos: 'C',  skin: '#f0c4a0', height: 78, weight: 300, arm: 32.25, number: 51, attrs: { size:  4, length:  3, anchor: 4, passPro: 4, runBlock: 4, mobility: 4, blitzPickup: 5, discipline: 3, pancake: 3 } },
  { name: "Fernando Carmona",          team: 'TEN', teamName: 'Tennessee Titans',       pos: 'RG', skin: '#b07848', height: 77, weight: 316, arm: 32.125, number: 66, attrs: { size:  6, length:  3, anchor: 5, passPro: 4, runBlock: 5, mobility: 4, blitzPickup: 3, discipline: 4, pancake: 5 } },
  { name: "JC Latham",                 team: 'TEN', teamName: 'Tennessee Titans',       pos: 'RT', skin: '#5e3c22', height: 78, weight: 342, arm: 35.125, number: 55, attrs: { size: 10, length:  9, anchor: 8, passPro: 3, runBlock: 6, mobility: 4, blitzPickup: 3, discipline: 0, pancake: 7 } },
  // DEN
  { name: "Garett Bolles",             team: 'DEN', teamName: 'Denver Broncos',         pos: 'LT', skin: '#f0c4a0', height: 77, weight: 300, arm: 34, number: 72, attrs: { size:  3, length:  7, anchor: 8, passPro: 11, runBlock: 8, mobility: 8, blitzPickup: 9, discipline: 4, pancake: 7 } },
  { name: "Ben Powers",                team: 'DEN', teamName: 'Denver Broncos',         pos: 'LG', skin: '#f0c4a0', height: 76, weight: 310, arm: 33.75, number: 74, attrs: { size:  4, length:  6, anchor: 7, passPro: 6, runBlock: 5, mobility: 4, blitzPickup: 7, discipline: 4, pancake: 4 } },
  { name: "Luke Wattenberg",           team: 'DEN', teamName: 'Denver Broncos',         pos: 'C',  skin: '#f0c4a0', height: 77, weight: 300, arm: 34.125, number: 60, attrs: { size:  3, length:  7, anchor: 5, passPro: 6, runBlock: 6, mobility: 7, blitzPickup: 6, discipline: 6, pancake: 4 } },
  { name: "Quinn Meinerz",             team: 'DEN', teamName: 'Denver Broncos',         pos: 'RG', skin: '#f0c4a0', height: 75, weight: 320, arm: 33.375, number: 77, attrs: { size:  5, length:  6, anchor: 10, passPro: 8, runBlock: 10, mobility: 8, blitzPickup: 8, discipline: 10, pancake: 11 } },
  { name: "Mike McGlinchey",           team: 'DEN', teamName: 'Denver Broncos',         pos: 'RT', skin: '#f0c4a0', height: 80, weight: 315, arm: 34, number: 69, attrs: { size:  7, length:  7, anchor: 7, passPro: 6, runBlock: 8, mobility: 5, blitzPickup: 7, discipline: 3, pancake: 7 } },
  // KC
  { name: "Josh Simmons",              team: 'KC',  teamName: 'Kansas City Chiefs',     pos: 'LT', skin: '#5e3c22', height: 77, weight: 310, arm: 33, number: 71, attrs: { size:  5, length:  5, anchor: 5, passPro: 5, runBlock: 4, mobility: 7, blitzPickup: 4, discipline: 1, pancake: 4 } },
  { name: "Kingsley Suamataia",        team: 'KC',  teamName: 'Kansas City Chiefs',     pos: 'LG', skin: '#b07848', height: 76, weight: 326, arm: 34.25, number: 76, attrs: { size:  6, length:  7, anchor: 5, passPro: 3, runBlock: 3, mobility: 6, blitzPickup: 3, discipline: 6, pancake: 3 } },
  { name: "Creed Humphrey",            team: 'KC',  teamName: 'Kansas City Chiefs',     pos: 'C',  skin: '#f0c4a0', height: 76, weight: 302, arm: 32.5, number: 52, attrs: { size:  3, length:  4, anchor: 9, passPro: 9, runBlock: 9, mobility: 11, blitzPickup: 11, discipline: 10, pancake: 7 } },
  { name: "Trey Smith",                team: 'KC',  teamName: 'Kansas City Chiefs',     pos: 'RG', skin: '#5e3c22', height: 78, weight: 321, arm: 33.75, number: 65, attrs: { size:  7, length:  6, anchor: 9, passPro: 7, runBlock: 6, mobility: 6, blitzPickup: 6, discipline: 8, pancake: 7 } },
  { name: "Kahlil Benson",             team: 'KC',  teamName: 'Kansas City Chiefs',     pos: 'RT', skin: '#5e3c22', height: 78, weight: 319, arm: 34.625, number: 70, attrs: { size:  7, length:  8, anchor:  4, passPro:  4, runBlock:  5, mobility:  5, blitzPickup:  3, discipline:  4, pancake:  4 } },
  // LV
  { name: "Kolton Miller",             team: 'LV',  teamName: 'Las Vegas Raiders',      pos: 'LT', skin: '#f0c4a0', height: 80, weight: 326, arm: 34.125, number: 74, attrs: { size:  9, length:  7, anchor: 7, passPro: 9, runBlock: 6, mobility: 8, blitzPickup: 7, discipline: 7, pancake: 5 } },
  { name: "Spencer Burford",           team: 'LV',  teamName: 'Las Vegas Raiders',      pos: 'LG', skin: '#5e3c22', height: 76, weight: 300, arm: 34.75, number: 70, attrs: { size:  2, length:  8, anchor: 4, passPro: 3, runBlock: 4, mobility: 6, blitzPickup: 4, discipline: 8, pancake: 3 } },
  { name: "Tyler Linderbaum",          team: 'LV',  teamName: 'Las Vegas Raiders',      pos: 'C',  skin: '#f0c4a0', height: 74, weight: 305, arm: 31.125, number: 65, attrs: { size:  2, length:  1, anchor: 7, passPro: 7, runBlock: 9, mobility: 11, blitzPickup: 8, discipline: 8, pancake: 7 } },
  { name: "Jackson Powers-Johnson",    team: 'LV',  teamName: 'Las Vegas Raiders',      pos: 'RG', skin: '#f0c4a0', height: 75, weight: 325, arm: 32.25, number: 58, attrs: { size:  6, length:  3, anchor: 7, passPro: 5, runBlock: 6, mobility: 6, blitzPickup: 4, discipline: 6, pancake: 6 } },
  { name: "DJ Glaze",                  team: 'LV',  teamName: 'Las Vegas Raiders',      pos: 'RT', skin: '#5e3c22', height: 76, weight: 331, arm: 34.875, number: 71, attrs: { size:  7, length:  9, anchor: 4, passPro: 3, runBlock: 4, mobility: 5, blitzPickup: 4, discipline: 8, pancake: 3 } },
  // LAC
  { name: "Rashawn Slater",            team: 'LAC', teamName: 'Los Angeles Chargers',   pos: 'LT', skin: '#5e3c22', height: 76, weight: 315, arm: 33, number: 70, attrs: { size:  5, length:  5, anchor: 8, passPro: 9, runBlock: 8, mobility: 8, blitzPickup: 8, discipline: 9, pancake: 7 } },
  { name: "Kayode Awosika",            team: 'LAC', teamName: 'Los Angeles Chargers',   pos: 'LG', skin: '#3a2010', height: 75, weight: 312, arm: 32.625, number: 74, attrs: { size:  4, length:  4, anchor: 4, passPro: 4, runBlock: 4, mobility: 5, blitzPickup: 4, discipline: 6, pancake: 3 } },
  { name: "Tyler Biadasz",             team: 'LAC', teamName: 'Los Angeles Chargers',   pos: 'C',  skin: '#f0c4a0', height: 76, weight: 318, arm: 32.25, number: 63, attrs: { size:  5, length:  3, anchor: 6, passPro: 6, runBlock: 5, mobility: 4, blitzPickup: 7, discipline: 9, pancake: 4 } },
  { name: "Cole Strange",              team: 'LAC', teamName: 'Los Angeles Chargers',   pos: 'RG', skin: '#f0c4a0', height: 77, weight: 305, arm: 33, number: 69, attrs: { size:  4, length:  5, anchor: 4, passPro: 4, runBlock: 4, mobility: 6, blitzPickup: 4, discipline: 8, pancake: 4 } },
  { name: "Joe Alt",                   team: 'LAC', teamName: 'Los Angeles Chargers',   pos: 'RT', skin: '#f0c4a0', height: 80, weight: 322, arm: 34.25, number: 76, attrs: { size:  8, length:  7, anchor: 8, passPro: 8, runBlock: 7, mobility: 7, blitzPickup: 7, discipline: 8, pancake: 7 } },
  // DAL
  { name: "Tyler Guyton",              team: 'DAL', teamName: 'Dallas Cowboys',         pos: 'LT', skin: '#5e3c22', height: 79, weight: 325, arm: 34.125, number: 60, attrs: { size:  8, length:  7, anchor: 4, passPro: 3, runBlock: 5, mobility: 8, blitzPickup: 3, discipline: 1, pancake: 5 } },
  { name: "Tyler Smith",               team: 'DAL', teamName: 'Dallas Cowboys',         pos: 'LG', skin: '#5e3c22', height: 77, weight: 328, arm: 34, number: 73, attrs: { size:  7, length:  7, anchor: 8, passPro: 7, runBlock: 8, mobility: 7, blitzPickup: 7, discipline: 4, pancake: 9 } },
  { name: "Cooper Beebe",              team: 'DAL', teamName: 'Dallas Cowboys',         pos: 'C',  skin: '#f0c4a0', height: 75, weight: 320, arm: 31.5, number: 56, attrs: { size:  5, length:  2, anchor: 8, passPro: 6, runBlock: 6, mobility: 4, blitzPickup: 6, discipline: 9, pancake: 6 } },
  { name: "Tyler Booker",              team: 'DAL', teamName: 'Dallas Cowboys',         pos: 'RG', skin: '#3a2010', height: 77, weight: 330, arm: 34.5, number: 52, attrs: { size:  8, length:  8, anchor: 7, passPro: 4, runBlock: 7, mobility: 4, blitzPickup: 5, discipline: 5, pancake: 7 } },
  { name: "Terence Steele",            team: 'DAL', teamName: 'Dallas Cowboys',         pos: 'RT', skin: '#b07848', height: 78, weight: 320, arm: 35.125, number: 78, attrs: { size:  7, length:  9, anchor: 6, passPro: 4, runBlock: 5, mobility: 5, blitzPickup: 5, discipline: 8, pancake: 5 } },
  // NYG
  { name: "Andrew Thomas",             team: 'NYG', teamName: 'New York Giants',        pos: 'LT', skin: '#5e3c22', height: 77, weight: 315, arm: 36.125, number: 78, attrs: { size:  5, length: 11, anchor: 8, passPro: 10, runBlock: 8, mobility: 8, blitzPickup: 8, discipline: 9, pancake: 7 } },
  { name: "Jon Runyan Jr.",            team: 'NYG', teamName: 'New York Giants',        pos: 'LG', skin: '#f0c4a0', height: 76, weight: 307, arm: 33.25, number: 76, attrs: { size:  4, length:  5, anchor: 6, passPro: 5, runBlock: 4, mobility: 5, blitzPickup: 6, discipline: 8, pancake: 4 } },
  { name: "John Michael Schmitz Jr.",  team: 'NYG', teamName: 'New York Giants',        pos: 'C',  skin: '#f0c4a0', height: 76, weight: 320, arm: 32.625, number: 61, attrs: { size:  6, length:  4, anchor: 4, passPro: 4, runBlock: 4, mobility: 5, blitzPickup: 4, discipline: 7, pancake: 3 } },
  { name: "Francis Mauigoa",           team: 'NYG', teamName: 'New York Giants',        pos: 'RG', skin: '#b07848', height: 78, weight: 335, arm: 33.25, number: 65, attrs: { size:  9, length:  5, anchor: 8, passPro: 5, runBlock: 7, mobility: 4, blitzPickup: 4, discipline: 4, pancake: 8 } },
  { name: "Jermaine Eluemunor",        team: 'NYG', teamName: 'New York Giants',        pos: 'RT', skin: '#5e3c22', height: 76, weight: 338, arm: 33.25, number: 72, attrs: { size:  8, length:  5, anchor: 6, passPro: 4, runBlock: 5, mobility: 5, blitzPickup: 5, discipline: 1, pancake: 5 } },
  // PHI
  { name: "Jordan Mailata",            team: 'PHI', teamName: 'Philadelphia Eagles',    pos: 'LT', skin: '#b07848', height: 80, weight: 365, arm: 35.5, number: 68, attrs: { size: 11, length: 10, anchor: 11, passPro: 9, runBlock: 10, mobility: 7, blitzPickup: 7, discipline: 5, pancake: 10 } },
  { name: "Landon Dickerson",          team: 'PHI', teamName: 'Philadelphia Eagles',    pos: 'LG', skin: '#f0c4a0', height: 78, weight: 332, arm: 33.25, number: 69, attrs: { size:  9, length:  5, anchor: 8, passPro: 5, runBlock: 6, mobility: 5, blitzPickup: 6, discipline: 4, pancake: 8 } },
  { name: "Cam Jurgens",               team: 'PHI', teamName: 'Philadelphia Eagles',    pos: 'C',  skin: '#f0c4a0', height: 75, weight: 303, arm: 33.375, number: 51, attrs: { size:  2, length:  6, anchor: 5, passPro: 5, runBlock: 6, mobility: 9, blitzPickup: 7, discipline: 8, pancake: 5 } },
  { name: "Tyler Steen",               team: 'PHI', teamName: 'Philadelphia Eagles',    pos: 'RG', skin: '#b07848', height: 78, weight: 321, arm: 32.75, number: 56, attrs: { size:  7, length:  4, anchor: 6, passPro: 7, runBlock: 6, mobility: 6, blitzPickup: 5, discipline: 4, pancake: 6 } },
  { name: "Lane Johnson",              team: 'PHI', teamName: 'Philadelphia Eagles',    pos: 'RT', skin: '#f0c4a0', height: 78, weight: 325, arm: 35.25, number: 65, attrs: { size:  8, length:  9, anchor: 10, passPro: 10, runBlock: 8, mobility: 8, blitzPickup: 10, discipline: 7, pancake: 7 } },
  // WAS
  { name: "Laremy Tunsil",             team: 'WAS', teamName: 'Washington Commanders',  pos: 'LT', skin: '#5e3c22', height: 77, weight: 313, arm: 34.25, number: 78, attrs: { size:  5, length:  7, anchor: 8, passPro: 10, runBlock: 6, mobility: 7, blitzPickup: 9, discipline: 3, pancake: 5 } },
  { name: "Brandon Coleman",           team: 'WAS', teamName: 'Washington Commanders',  pos: 'LG', skin: '#b07848', height: 78, weight: 320, arm: 34.625, number: 74, attrs: { size:  7, length:  8, anchor: 4, passPro: 3, runBlock: 4, mobility: 6, blitzPickup: 4, discipline: 3, pancake: 4 } },
  { name: "Lucas Patrick",             team: 'WAS', teamName: 'Washington Commanders',  pos: 'C',  skin: '#f0c4a0', height: 75, weight: 313, arm: 32.25, number: 63, attrs: { size:  4, length:  3, anchor:  5, passPro:  4, runBlock:  5, mobility:  4, blitzPickup:  6, discipline:  5, pancake:  4 } },
  { name: "Sam Cosmi",                 team: 'WAS', teamName: 'Washington Commanders',  pos: 'RG', skin: '#f0c4a0', height: 79, weight: 309, arm: 33, number: 76, attrs: { size:  6, length:  5, anchor: 7, passPro: 7, runBlock: 6, mobility: 8, blitzPickup: 6, discipline: 9, pancake: 6 } },
  { name: "Josh Conerly Jr.",          team: 'WAS', teamName: 'Washington Commanders',  pos: 'RT', skin: '#5e3c22', height: 76, weight: 315, arm: 33.5, number: 72, attrs: { size:  5, length:  6, anchor: 4, passPro: 4, runBlock: 4, mobility: 7, blitzPickup: 4, discipline: 1, pancake: 3 } },
  // CHI
  { name: "Braxton Jones",             team: 'CHI', teamName: 'Chicago Bears',          pos: 'LT', skin: '#5e3c22', height: 77, weight: 303, arm: 35.375, number: 70, attrs: { size:  4, length: 10, anchor: 4, passPro: 5, runBlock: 4, mobility: 6, blitzPickup: 5, discipline: 6, pancake: 3 } },
  { name: "Joe Thuney",                team: 'CHI', teamName: 'Chicago Bears',          pos: 'LG', skin: '#f0c4a0', height: 77, weight: 301, arm: 32.25, number: 62, attrs: { size:  3, length:  3, anchor: 9, passPro: 11, runBlock: 5, mobility: 6, blitzPickup: 11, discipline: 10, pancake: 5 } },
  { name: "Garrett Bradbury",          team: 'CHI', teamName: 'Chicago Bears',          pos: 'C',  skin: '#f0c4a0', height: 75, weight: 305, arm: 31.75, number: 67, attrs: { size:  3, length:  2, anchor: 3, passPro: 3, runBlock: 5, mobility: 8, blitzPickup: 5, discipline: 10, pancake: 3 } },
  { name: "Jonah Jackson",             team: 'CHI', teamName: 'Chicago Bears',          pos: 'RG', skin: '#b07848', height: 75, weight: 319, arm: 33.5, number: 73, attrs: { size:  5, length:  6, anchor: 6, passPro: 5, runBlock: 5, mobility: 5, blitzPickup: 6, discipline: 7, pancake: 5 } },
  { name: "Darnell Wright",            team: 'CHI', teamName: 'Chicago Bears',          pos: 'RT', skin: '#5e3c22', height: 77, weight: 325, arm: 33.75, number: 58, attrs: { size:  7, length:  6, anchor: 9, passPro: 7, runBlock: 8, mobility: 6, blitzPickup: 7, discipline: 1, pancake: 9 } },
  // DET
  { name: "Penei Sewell",              team: 'DET', teamName: 'Detroit Lions',          pos: 'LT', skin: '#b07848', height: 77, weight: 335, arm: 33.25, number: 58, attrs: { size:  8, length:  5, anchor: 10, passPro: 8, runBlock: 11, mobility: 10, blitzPickup: 8, discipline: 9, pancake: 11 } },
  { name: "Christian Mahogany",        team: 'DET', teamName: 'Detroit Lions',          pos: 'LG', skin: '#b07848', height: 75, weight: 330, arm: 33.5, number: 73, attrs: { size:  6, length:  6, anchor: 7, passPro: 4, runBlock: 6, mobility: 4, blitzPickup: 4, discipline: 8, pancake: 7 } },
  { name: "Cade Mays",                 team: 'DET', teamName: 'Detroit Lions',          pos: 'C',  skin: '#f0c4a0', height: 78, weight: 325, arm: 34.125, number: 64, attrs: { size:  8, length:  7, anchor: 5, passPro: 6, runBlock: 4, mobility: 5, blitzPickup: 5, discipline: 8, pancake: 3 } },
  { name: "Tate Ratledge",             team: 'DET', teamName: 'Detroit Lions',          pos: 'RG', skin: '#f0c4a0', height: 78, weight: 322, arm: 32.25, number: 69, attrs: { size:  7, length:  3, anchor: 7, passPro: 5, runBlock: 7, mobility: 5, blitzPickup: 4, discipline: 4, pancake: 7 } },
  { name: "Blake Miller",              team: 'DET', teamName: 'Detroit Lions',          pos: 'RT', skin: '#f0c4a0', height: 78, weight: 320, arm: 34.25, number: 76, attrs: { size:  7, length:  7, anchor: 6, passPro: 5, runBlock: 5, mobility: 5, blitzPickup: 5, discipline: 6, pancake: 4 } },
  // GB
  { name: "Jordan Morgan",             team: 'GB',  teamName: 'Green Bay Packers',      pos: 'LT', skin: '#b07848', height: 77, weight: 311, arm: 32.875, number: 77, attrs: { size:  5, length:  5, anchor: 4, passPro: 4, runBlock: 5, mobility: 7, blitzPickup: 4, discipline: 6, pancake: 4 } },
  { name: "Aaron Banks",               team: 'GB',  teamName: 'Green Bay Packers',      pos: 'LG', skin: '#b07848', height: 77, weight: 325, arm: 33.125, number: 65, attrs: { size:  7, length:  5, anchor: 7, passPro: 4, runBlock: 5, mobility: 4, blitzPickup: 4, discipline: 5, pancake: 6 } },
  { name: "Sean Rhyan",                team: 'GB',  teamName: 'Green Bay Packers',      pos: 'C',  skin: '#b07848', height: 77, weight: 321, arm: 32.375, number: 75, attrs: { size:  6, length:  4, anchor: 2, passPro: 1, runBlock: 5, mobility: 5, blitzPickup: 2, discipline: 7, pancake: 5 } },
  { name: "Kevin Zeitler",             team: 'GB',  teamName: 'Green Bay Packers',      pos: 'RG', skin: '#f0c4a0', height: 76, weight: 314, arm: 32.75, number: 70, attrs: { size:  5, length:  4, anchor: 9, passPro: 8, runBlock: 6, mobility: 3, blitzPickup: 10, discipline: 7, pancake: 6 } },
  { name: "Zach Bako-Bewele",          team: 'GB',  teamName: 'Green Bay Packers',      pos: 'RT', skin: '#b07848', height: 76, weight: 304, arm: 33.25, number: 50, attrs: { size:  3, length:  5, anchor: 7, passPro: 8, runBlock: 8, mobility: 9, blitzPickup: 8, discipline: 10, pancake: 7 } },
  // MIN
  { name: "Christian Darrisaw",        team: 'MIN', teamName: 'Minnesota Vikings',      pos: 'LT', skin: '#5e3c22', height: 77, weight: 315, arm: 34.25, number: 71, attrs: { size:  5, length:  7, anchor: 9, passPro: 9, runBlock: 7, mobility: 8, blitzPickup: 6, discipline: 2, pancake: 8 } },
  { name: "Donovan Jackson",           team: 'MIN', teamName: 'Minnesota Vikings',      pos: 'LG', skin: '#5e3c22', height: 76, weight: 324, arm: 33.5, number: 74, attrs: { size:  6, length:  6, anchor: 6, passPro: 4, runBlock: 5, mobility: 7, blitzPickup: 4, discipline: 8, pancake: 5 } },
  { name: "Blake Brandel",             team: 'MIN', teamName: 'Minnesota Vikings',      pos: 'C',  skin: '#f0c4a0', height: 78, weight: 315, arm: 33.25, number: 64, attrs: { size:  6, length:  5, anchor: 4, passPro: 4, runBlock: 4, mobility: 5, blitzPickup: 4, discipline: 4, pancake: 3 } },
  { name: "Will Fries",                team: 'MIN', teamName: 'Minnesota Vikings',      pos: 'RG', skin: '#f0c4a0', height: 78, weight: 321, arm: 32.875, number: 76, attrs: { size:  7, length:  5, anchor: 5, passPro: 4, runBlock: 4, mobility: 6, blitzPickup: 5, discipline: 8, pancake: 4 } },
  { name: "Brian O'Neill",             team: 'MIN', teamName: 'Minnesota Vikings',      pos: 'RT', skin: '#f0c4a0', height: 79, weight: 310, arm: 34.125, number: 75, attrs: { size:  6, length:  7, anchor: 7, passPro: 7, runBlock: 8, mobility: 9, blitzPickup: 8, discipline: 6, pancake: 7 } },
  // ATL
  { name: "Jake Matthews",             team: 'ATL', teamName: 'Atlanta Falcons',        pos: 'LT', skin: '#f0c4a0', height: 77, weight: 310, arm: 33.375, number: 70, attrs: { size:  5, length:  6, anchor: 7, passPro: 8, runBlock: 4, mobility: 5, blitzPickup: 9, discipline: 3, pancake: 4 } },
  { name: "Matthew Bergeron",          team: 'ATL', teamName: 'Atlanta Falcons',        pos: 'LG', skin: '#b07848', height: 77, weight: 315, arm: 33.75, number: 65, attrs: { size:  5, length:  6, anchor: 6, passPro: 7, runBlock: 6, mobility: 7, blitzPickup: 6, discipline: 9, pancake: 5 } },
  { name: "Ryan Neuzil",               team: 'ATL', teamName: 'Atlanta Falcons',        pos: 'C',  skin: '#f0c4a0', height: 75, weight: 305, arm: 31.5, number: 64, attrs: { size:  3, length:  2, anchor: 6, passPro: 4, runBlock: 7, mobility: 7, blitzPickup: 5, discipline: 8, pancake: 5 } },
  { name: "Chris Lindstrom",           team: 'ATL', teamName: 'Atlanta Falcons',        pos: 'RG', skin: '#f0c4a0', height: 76, weight: 310, arm: 34.125, number: 63, attrs: { size:  4, length:  7, anchor: 8, passPro: 8, runBlock: 11, mobility: 10, blitzPickup: 8, discipline: 6, pancake: 9 } },
  { name: "Jawaan Taylor",             team: 'ATL', teamName: 'Atlanta Falcons',        pos: 'RT', skin: '#5e3c22', height: 77, weight: 312, arm: 35.125, number: 71, attrs: { size:  5, length:  9, anchor: 6, passPro: 4, runBlock: 5, mobility: 5, blitzPickup: 4, discipline: 0, pancake: 5 } },
  // CAR
  { name: "Ikem Ekwonu",               team: 'CAR', teamName: 'Carolina Panthers',      pos: 'LT', skin: '#5e3c22', height: 76, weight: 320, arm: 34, number: 79, attrs: { size:  6, length:  7, anchor: 7, passPro: 5, runBlock: 7, mobility: 7, blitzPickup: 5, discipline: 3, pancake: 8 } },
  { name: "Damien Lewis",              team: 'CAR', teamName: 'Carolina Panthers',      pos: 'LG', skin: '#5e3c22', height: 74, weight: 327, arm: 33, number: 68, attrs: { size:  5, length:  5, anchor: 8, passPro: 7, runBlock: 7, mobility: 5, blitzPickup: 7, discipline: 6, pancake: 7 } },
  { name: "Luke Fortner",              team: 'CAR', teamName: 'Carolina Panthers',      pos: 'C',  skin: '#f0c4a0', height: 78, weight: 300, arm: 33.125, number: 77, attrs: { size:  4, length:  5, anchor: 4, passPro: 5, runBlock: 4, mobility: 5, blitzPickup: 4, discipline: 6, pancake: 3 } },
  { name: "Robert Hunt",               team: 'CAR', teamName: 'Carolina Panthers',      pos: 'RG', skin: '#b07848', height: 78, weight: 323, arm: 33.5, number: 50, attrs: { size:  7, length:  6, anchor: 8, passPro: 6, runBlock: 7, mobility: 5, blitzPickup: 6, discipline: 6, pancake: 8 } },
  { name: "Taylor Moton",              team: 'CAR', teamName: 'Carolina Panthers',      pos: 'RT', skin: '#5e3c22', height: 77, weight: 325, arm: 34.125, number: 72, attrs: { size:  7, length:  7, anchor: 8, passPro: 7, runBlock: 7, mobility: 6, blitzPickup: 8, discipline: 6, pancake: 7 } },
  // NO
  { name: "Kelvin Banks Jr.",          team: 'NO',  teamName: 'New Orleans Saints',     pos: 'LT', skin: '#5e3c22', height: 77, weight: 315, arm: 33.5, number: 71, attrs: { size:  5, length:  6, anchor: 5, passPro: 5, runBlock: 7, mobility: 7, blitzPickup: 4, discipline: 2, pancake: 6 } },
  { name: "David Edwards",             team: 'NO',  teamName: 'New Orleans Saints',     pos: 'LG', skin: '#f0c4a0', height: 78, weight: 308, arm: 33.375, number: 76, attrs: { size:  5, length:  6, anchor: 7, passPro: 7, runBlock: 5, mobility: 5, blitzPickup: 6, discipline: 9, pancake: 5 } },
  { name: "Erik McCoy",                team: 'NO',  teamName: 'New Orleans Saints',     pos: 'C',  skin: '#b07848', height: 76, weight: 303, arm: 33, number: 78, attrs: { size:  3, length:  5, anchor: 7, passPro: 8, runBlock: 7, mobility: 8, blitzPickup: 9, discipline: 6, pancake: 6 } },
  { name: "Cesar Ruiz",                team: 'NO',  teamName: 'New Orleans Saints',     pos: 'RG', skin: '#5e3c22', height: 76, weight: 316, arm: 33.125, number: 51, attrs: { size:  5, length:  5, anchor: 6, passPro: 4, runBlock: 5, mobility: 5, blitzPickup: 5, discipline: 7, pancake: 5 } },
  { name: "Taliese Fuaga",             team: 'NO',  teamName: 'New Orleans Saints',     pos: 'RT', skin: '#b07848', height: 78, weight: 324, arm: 33.125, number: 75, attrs: { size:  7, length:  5, anchor: 7, passPro: 4, runBlock: 6, mobility: 5, blitzPickup: 4, discipline: 4, pancake: 7 } },
  // TB
  { name: "Tristan Wirfs",             team: 'TB',  teamName: 'Tampa Bay Buccaneers',   pos: 'LT', skin: '#b07848', height: 77, weight: 320, arm: 34, number: 78, attrs: { size:  6, length:  7, anchor: 10, passPro: 10, runBlock: 10, mobility: 10, blitzPickup: 9, discipline: 7, pancake: 9 } },
  { name: "Ben Bredeson",              team: 'TB',  teamName: 'Tampa Bay Buccaneers',   pos: 'LG', skin: '#f0c4a0', height: 77, weight: 315, arm: 31.125, number: 68, attrs: { size:  5, length:  1, anchor: 6, passPro: 4, runBlock: 4, mobility: 4, blitzPickup: 6, discipline: 7, pancake: 4 } },
  { name: "Graham Barton",             team: 'TB',  teamName: 'Tampa Bay Buccaneers',   pos: 'C',  skin: '#f0c4a0', height: 77, weight: 314, arm: 32.875, number: 62, attrs: { size:  5, length:  5, anchor: 4, passPro: 4, runBlock: 5, mobility: 7, blitzPickup: 5, discipline: 5, pancake: 4 } },
  { name: "Cody Mauch",                team: 'TB',  teamName: 'Tampa Bay Buccaneers',   pos: 'RG', skin: '#f0c4a0', height: 78, weight: 303, arm: 32.375, number: 69, attrs: { size:  4, length:  4, anchor: 5, passPro: 5, runBlock: 5, mobility: 7, blitzPickup: 5, discipline: 6, pancake: 5 } },
  { name: "Luke Goedeke",              team: 'TB',  teamName: 'Tampa Bay Buccaneers',   pos: 'RT', skin: '#f0c4a0', height: 77, weight: 312, arm: 32.25, number: 67, attrs: { size:  5, length:  3, anchor: 6, passPro: 7, runBlock: 6, mobility: 6, blitzPickup: 6, discipline: 4, pancake: 6 } },
  // ARI
  { name: "Paris Johnson Jr.",         team: 'ARI', teamName: 'Arizona Cardinals',      pos: 'LT', skin: '#5e3c22', height: 78, weight: 325, arm: 36.125, number: 70, attrs: { size:  8, length: 11, anchor: 6, passPro: 6, runBlock: 6, mobility: 7, blitzPickup: 5, discipline: 4, pancake: 6 } },
  { name: "Isaac Seumalo",             team: 'ARI', teamName: 'Arizona Cardinals',      pos: 'LG', skin: '#b07848', height: 76, weight: 310, arm: 33, number: 73, attrs: { size:  4, length:  5, anchor: 7, passPro: 7, runBlock: 5, mobility: 5, blitzPickup: 8, discipline: 11, pancake: 4 } },
  { name: "Hjalte Froholdt",           team: 'ARI', teamName: 'Arizona Cardinals',      pos: 'C',  skin: '#f0c4a0', height: 77, weight: 310, arm: 31.25, number: 72, attrs: { size:  5, length:  1, anchor: 6, passPro: 7, runBlock: 4, mobility: 5, blitzPickup: 7, discipline: 8, pancake: 4 } },
  { name: "Isaiah Adams",              team: 'ARI', teamName: 'Arizona Cardinals',      pos: 'RG', skin: '#b07848', height: 76, weight: 315, arm: 33.875, number: 74, attrs: { size:  5, length:  7, anchor: 5, passPro: 3, runBlock: 4, mobility: 4, blitzPickup: 3, discipline: 4, pancake: 4 } },
  { name: "Elijah Wilkinson",          team: 'ARI', teamName: 'Arizona Cardinals',      pos: 'RT', skin: '#5e3c22', height: 78, weight: 315, arm: 34, number: 65, attrs: { size:  6, length:  7, anchor: 4, passPro: 3, runBlock: 4, mobility: 3, blitzPickup: 4, discipline: 1, pancake: 3 } },
  // LAR
  { name: "Alaric Jackson",            team: 'LAR', teamName: 'Los Angeles Rams',       pos: 'LT', skin: '#5e3c22', height: 79, weight: 338, arm: 32.5, number: 77, attrs: { size: 10, length:  4, anchor: 7, passPro: 7, runBlock: 9, mobility: 6, blitzPickup: 6, discipline: 8, pancake: 8 } },
  { name: "Steve Avila",               team: 'LAR', teamName: 'Los Angeles Rams',       pos: 'LG', skin: '#b07848', height: 75, weight: 332, arm: 33, number: 73, attrs: { size:  7, length:  5, anchor: 7, passPro: 7, runBlock: 6, mobility: 5, blitzPickup: 6, discipline: 11, pancake: 6 } },
  { name: "Coleman Shelton",           team: 'LAR', teamName: 'Los Angeles Rams',       pos: 'C',  skin: '#f0c4a0', height: 77, weight: 292, arm: 31.5, number: 65, attrs: { size:  2, length:  2, anchor: 4, passPro: 5, runBlock: 7, mobility: 7, blitzPickup: 8, discipline: 8, pancake: 4 } },
  { name: "Kevin Dotson",              team: 'LAR', teamName: 'Los Angeles Rams',       pos: 'RG', skin: '#3a2010', height: 76, weight: 328, arm: 33, number: 69, attrs: { size:  7, length:  5, anchor: 8, passPro: 5, runBlock: 9, mobility: 6, blitzPickup: 6, discipline: 8, pancake: 9 } },
  { name: "Warren McClendon Jr.",      team: 'LAR', teamName: 'Los Angeles Rams',       pos: 'RT', skin: '#5e3c22', height: 76, weight: 315, arm: 34.5, number: 71, attrs: { size:  5, length:  8, anchor: 5, passPro: 5, runBlock: 5, mobility: 5, blitzPickup: 5, discipline: 9, pancake: 4 } },
  // SF
  { name: "Trent Williams",            team: 'SF',  teamName: 'San Francisco 49ers',    pos: 'LT', skin: '#5e3c22', height: 77, weight: 320, arm: 34.25, number: 71, attrs: { size:  6, length:  7, anchor: 9, passPro: 8, runBlock: 10, mobility: 9, blitzPickup: 10, discipline: 7, pancake: 10 } },
  { name: "Connor Colby",              team: 'SF',  teamName: 'San Francisco 49ers',    pos: 'LG', skin: '#f0c4a0', height: 77, weight: 309, arm: 32, number: 75, attrs: { size:  4, length:  3, anchor: 4, passPro: 3, runBlock: 4, mobility: 4, blitzPickup: 3, discipline: 4, pancake: 4 } },
  { name: "Jake Brendel",              team: 'SF',  teamName: 'San Francisco 49ers',    pos: 'C',  skin: '#f0c4a0', height: 76, weight: 299, arm: 31.625, number: 64, attrs: { size:  2, length:  2, anchor: 4, passPro: 4, runBlock: 6, mobility: 7, blitzPickup: 6, discipline: 8, pancake: 4 } },
  { name: "Dominick Puni",             team: 'SF',  teamName: 'San Francisco 49ers',    pos: 'RG', skin: '#b07848', height: 77, weight: 313, arm: 33.375, number: 77, attrs: { size:  5, length:  6, anchor: 6, passPro: 6, runBlock: 6, mobility: 6, blitzPickup: 6, discipline: 7, pancake: 6 } },
  { name: "Colton McKivitz",           team: 'SF',  teamName: 'San Francisco 49ers',    pos: 'RT', skin: '#f0c4a0', height: 78, weight: 301, arm: 33.75, number: 68, attrs: { size:  4, length:  6, anchor: 6, passPro: 5, runBlock: 9, mobility: 6, blitzPickup: 6, discipline: 6, pancake: 7 } },
  // SEA
  { name: "Charles Cross",             team: 'SEA', teamName: 'Seattle Seahawks',       pos: 'LT', skin: '#5e3c22', height: 77, weight: 317, arm: 34.5, number: 67, attrs: { size:  6, length:  8, anchor: 6, passPro: 8, runBlock: 6, mobility: 7, blitzPickup: 7, discipline: 7, pancake: 5 } },
  { name: "Grey Zabel",                team: 'SEA', teamName: 'Seattle Seahawks',       pos: 'LG', skin: '#f0c4a0', height: 78, weight: 316, arm: 32, number: 76, attrs: { size:  6, length:  3, anchor: 6, passPro: 5, runBlock: 6, mobility: 7, blitzPickup: 5, discipline: 6, pancake: 6 } },
  { name: "Jalen Sundell",             team: 'SEA', teamName: 'Seattle Seahawks',       pos: 'C',  skin: '#f0c4a0', height: 77, weight: 301, arm: 33.125, number: 61, attrs: { size:  3, length:  5, anchor: 4, passPro: 5, runBlock: 5, mobility: 6, blitzPickup: 5, discipline: 7, pancake: 4 } },
  { name: "Christian Haynes",          team: 'SEA', teamName: 'Seattle Seahawks',       pos: 'RG', skin: '#5e3c22', height: 75, weight: 317, arm: 33.5, number: 64, attrs: { size:  4, length:  6, anchor: 4, passPro: 3, runBlock: 4, mobility: 6, blitzPickup: 3, discipline: 6, pancake: 4 } },
  { name: "Abraham Lucas",             team: 'SEA', teamName: 'Seattle Seahawks',       pos: 'RT', skin: '#b07848', height: 78, weight: 322, arm: 33.875, number: 72, attrs: { size:  7, length:  7, anchor: 6, passPro: 7, runBlock: 7, mobility: 6, blitzPickup: 7, discipline: 8, pancake: 6 } },
]

// Pass protection carries the most weight — a sack or a hit on the QB swings
// a drive more than any single run block — with the power/run-game traits
// close behind, then the mental traits and the raw measurables (size, length)
// that the technique grades already partly reflect.
export const OL_ATTR_WEIGHT = {
  'passPro':     0.18,
  'runBlock':    0.15,
  'anchor':      0.14,
  'pancake':     0.10,
  'mobility':    0.10,
  'blitzPickup': 0.09,
  'discipline':  0.08,
  'size':        0.08,
  'length':      0.08,
}

// Same curve every other position uses (base + balance bonus), so an OL OVR
// reads on the same scale as a QB/RB/WR/TE/DB OVR.
export function olOVR(vals) {
  const filled = OL_TYPES.filter(t => vals[t] != null)
  if (!filled.length) return null
  const totalW = filled.reduce((s, t) => s + OL_ATTR_WEIGHT[t], 0)
  const avg    = filled.reduce((s, t) => s + vals[t] * OL_ATTR_WEIGHT[t] / totalW, 0)
  const base   = 60 + 2.1 * avg + 0.21 * avg * avg
  let bonus = 0
  if (filled.length === OL_TYPES.length) {
    const v = filled.map(t => vals[t])
    const spread = Math.max(...v) - Math.min(...v)
    const minVal = Math.min(...v)
    if (spread <= 1) bonus += 2.5
    else if (spread <= 2) bonus += 1.0
    else if (spread <= 3) bonus += 0.3
    if (minVal >= 9) bonus += 2.0
    else if (minVal >= 8) bonus += 0.5
  }
  return Math.min(99, Math.max(0, Math.round(base + bonus)))
}

// Last name for reel/chip short labels — skips generational suffixes so
// "Jon Runyan Jr." reads "Runyan", not "Jr.".
const SUFFIXES = new Set(['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'V'])
function shortName(name) {
  const parts = name.split(' ')
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1])) parts.pop()
  return parts[parts.length - 1]
}

// Every row is that team's starter at the spot. `subpos` mirrors `pos` so the
// chip carries the OL spot through the same field DB chips use for CB/S, and
// — like DB — it's the Size chip whose spot, jersey and HT/WT the build takes.
export const OLS = _OLS.map(ol => ({
  ...ol,
  short: shortName(ol.name),
  subpos: ol.pos,
  starter: true,
  attrs: { ...ol.attrs },
  ...TEAM_COLOR[ol.team],
  ovr: olOVR(ol.attrs),
}))

// First-Team All-Pro ballot — three names per spot, best first (the vote leans
// toward the front of the list), then an alternate who steps in when one of
// the three is the starter your build replaced on its own team. Hand-picked,
// not just top OVR, so a well-graded player who isn't All-Pro caliber stays off.
export const OL_ALL_PRO_BALLOT = {
  LT: ['Jordan Mailata', 'Penei Sewell',    'Tristan Wirfs',    'Trent Williams'],
  LG: ['Quenton Nelson', 'Joe Thuney',      'Tyler Smith',      'Damien Lewis'],
  C:  ['Creed Humphrey', 'Aaron Brewer',    'Tyler Linderbaum', 'Zach Frazier'],
  RG: ['Quinn Meinerz',  'Chris Lindstrom', 'Mike Onwenu',      'Trey Smith'],
  RT: ['Lane Johnson',   'Joe Alt',         "Brian O'Neill",    'Taylor Moton'],
}

export const OL_PHYSICALS = Object.fromEntries(_OLS.map(ol => [ol.name, { height: ol.height, weight: ol.weight }]))
export const OL_POS_BY_NAME = Object.fromEntries(_OLS.map(ol => [ol.name, ol.pos]))
