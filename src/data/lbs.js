import { TEAMS } from './nfl-teams'
const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

export { LB_LIVE } from '../lib/lbLive'   // the switch for everything players see about LB

// Linebackers (off-ball: MIKE, WILL, SAM): the current-player pool for LB mode. Pass-rush OLBs live in dls.js as EDGE, not here.
// ESTIMATED RATINGS: placeholders so the mode plays; the owner's rater replaces them.
// Ratings are on the 0-11 grade scale (F … S); null = not rated yet.
// pos: LB; subpos: lb; years: their stretch with the team.
// Height (total inches), weight (lbs) and jersey number as listed for the 2026 season.
// skin: #f0c4a0 white  #b07848 mixed/Polynesian/Latino  #5e3c22 Black  #3a2010 very dark Black
export const LB_TYPES = ['range', 'size', 'power', 'tackling', 'blockShed', 'zoneInstincts', 'passRush', 'playRecognition', 'leadership']
export const LB_LITE_TYPES = ['range', 'tackling', 'zoneInstincts', 'size']

export const LB_CATEGORIES = [
  { id: 'physical', label: 'Physical', types: ['range', 'size', 'power'] },
  { id: 'skill',    label: 'Skill',    types: ['tackling', 'blockShed', 'zoneInstincts', 'passRush'] },
  { id: 'mental',   label: 'Mental',   types: ['playRecognition', 'leadership'] },
]

export const LB_ATTR = {
  range:           { label: 'Range',            shortLabel: 'RNG', category: 'physical', col: 'var(--c-mob)',  hex: '#60a5fa', bodyZone: 'legs' },
  size:            { label: 'Size',             shortLabel: 'SZE', category: 'physical', col: 'var(--c-vis)',  hex: '#38bdf8', bodyZone: 'core' },
  power:           { label: 'Power',            shortLabel: 'PWR', category: 'physical', col: 'var(--c-str)',  hex: '#fb923c', bodyZone: 'core' },
  tackling:        { label: 'Tackling',         shortLabel: 'TKL', category: 'skill',    col: 'var(--c-arm)',  hex: '#f87171', bodyZone: 'arm'  },
  blockShed:       { label: 'Block Shed',       shortLabel: 'SHD', category: 'skill',    col: 'var(--c-pkt)',  hex: '#2dd4bf', bodyZone: 'arm'  },
  zoneInstincts:   { label: 'Zone Instincts',   shortLabel: 'ZON', category: 'skill',    col: 'var(--c-acc)',  hex: '#34d399', bodyZone: 'hand' },
  passRush:        { label: 'Pass Rush',        shortLabel: 'RSH', category: 'skill',    col: 'var(--c-comp)', hex: '#fbbf24', bodyZone: 'legs' },
  playRecognition: { label: 'Play Recognition', shortLabel: 'REC', category: 'mental',   col: 'var(--c-iq)',   hex: '#e879f9', bodyZone: 'head' },
  leadership:      { label: 'Leadership',       shortLabel: 'LDR', category: 'mental',   col: 'var(--c-lead)', hex: '#a78bfa', bodyZone: 'head' },
}
// Size, the 2nd rating: worked out from the bio, 50% height, 50% weight, on a linebacker scale: 212 lb and 5'10" = F,
// 252 lb and 6'4" = S, so a typical 6'1" 235 lb starter grades B. Never rated by hand.
export const LB_SIZE_SCALE = { lb: [212, 252], in: [70, 76] }
export const lbSizeGrade = (height, weight) => {
  const g = (v, [lo, hi]) => Math.max(0, Math.min(11, (v - lo) / (hi - lo) * 11))
  return Math.round(g(weight, LB_SIZE_SCALE.lb) * 0.5 + g(height, LB_SIZE_SCALE.in) * 0.5)
}

// LB PLACEHOLDER FIGURE: there's no linebacker art yet, so LB is drawn on the DL figure (public/dl-silhouette.webp
// with DLFigureOverlay). Each LB trait takes a DL trait's dot and colored body part: LB trait -> DL trait.
export const LB_AS_DL = {
  playRecognition: 'playRecognition', // helmet
  power:           'strength',        // bare arm
  blockShed:       'powerMoves',      // elbow pad
  range:           'getOff',          // shoe
  tackling:        'blockShed',       // arm sleeve
  size:            'size',            // jersey chest
  zoneInstincts:   'finesseMoves',    // glove
  passRush:        'bend',            // knee
  leadership:      'speed',           // sock
}
export const lbAsDlBuild = build => Object.fromEntries(Object.entries(LB_AS_DL).map(([lb, dl]) => [dl, build?.[lb]]))
// The one line to swap when LB gets its own figure (then give LB its own zones in Silhouette.jsx and its own overlay)
export const LB_SILHOUETTE = '/dl-silhouette.webp'

const _LBS = [
  // ARI
  { name: "Mack Wilson Sr.", short: "M. Wilson", team: 'ARI', teamName: "Arizona Cardinals", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 240, number: 2, starter: true, years: "2025-",
    attrs: { range: 6, power: 6, tackling: 6, blockShed: 6, zoneInstincts: 5, passRush: 5, playRecognition: 6, leadership: 6 } },
  { name: "Akeem Davis-Gaither", short: "Davis-Gaither", team: 'ARI', teamName: "Arizona Cardinals", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 224, number: 59, starter: true, years: "2025-",
    attrs: { range: 6, power: 4, tackling: 5, blockShed: 4, zoneInstincts: 6, passRush: 4, playRecognition: 5, leadership: 4 } },
  { name: "Owen Pappoe", short: "Pappoe", team: 'ARI', teamName: "Arizona Cardinals", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 225, number: 35, starter: false, years: "2023-",
    attrs: { range: 6, power: 4, tackling: 4, blockShed: 3, zoneInstincts: 4, passRush: 4, playRecognition: 4, leadership: 3 } },
  // ATL
  { name: "Kaden Elliss", short: "Elliss", team: 'ATL', teamName: "Atlanta Falcons", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 240, number: 55, starter: true, captain: true, years: "2023-",
    attrs: { range: 6, power: 6, tackling: 6, blockShed: 6, zoneInstincts: 5, passRush: 7, playRecognition: 6, leadership: 7 } },
  { name: "Divine Deablo", short: "Deablo", team: 'ATL', teamName: "Atlanta Falcons", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 226, number: 5, starter: true, years: "2025-",
    attrs: { range: 6, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 6, passRush: 4, playRecognition: 5, leadership: 5 } },
  { name: "JD Bertrand", short: "Bertrand", team: 'ATL', teamName: "Atlanta Falcons", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 73, weight: 235, number: 40, starter: false, years: "2024-",
    attrs: { range: 4, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 3, playRecognition: 5, leadership: 4 } },
  // BAL
  { name: "Roquan Smith", short: "R. Smith", team: 'BAL', teamName: "Baltimore Ravens", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 232, number: 0, starter: true, captain: true, years: "2022-",
    attrs: { range: 10, power: 8, tackling: 10, blockShed: 8, zoneInstincts: 9, passRush: 6, playRecognition: 10, leadership: 10 } },
  { name: "Teddye Buchanan", short: "Buchanan", team: 'BAL', teamName: "Baltimore Ravens", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 233, number: 53, starter: true, years: "2025-",
    attrs: { range: 6, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 4, playRecognition: 5, leadership: 5 } },
  { name: "Trenton Simpson", short: "Simpson", team: 'BAL', teamName: "Baltimore Ravens", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 235, number: 23, starter: false, years: "2023-",
    attrs: { range: 7, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 6, playRecognition: 4, leadership: 4 } },
  // BUF
  { name: "Terrel Bernard", short: "Bernard", team: 'BUF', teamName: "Buffalo Bills", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 224, number: 43, starter: true, captain: true, years: "2022-",
    attrs: { range: 8, power: 5, tackling: 7, blockShed: 5, zoneInstincts: 8, passRush: 6, playRecognition: 7, leadership: 8 } },
  { name: "Matt Milano", short: "Milano", team: 'BUF', teamName: "Buffalo Bills", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 72, weight: 223, number: 58, starter: true, years: "2017-",
    attrs: { range: 7, power: 5, tackling: 7, blockShed: 5, zoneInstincts: 8, passRush: 5, playRecognition: 7, leadership: 7 } },
  { name: "Dorian Williams", short: "D. Williams", team: 'BUF', teamName: "Buffalo Bills", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 228, number: 42, starter: false, years: "2023-",
    attrs: { range: 7, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 5, passRush: 5, playRecognition: 5, leadership: 4 } },
  // CAR
  { name: "Devin Lloyd", short: "Lloyd", team: 'CAR', teamName: "Carolina Panthers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 235, number: 33, starter: true, years: "2026-",
    attrs: { range: 8, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 8, passRush: 5, playRecognition: 7, leadership: 6 } },
  { name: "Trevin Wallace", short: "Wallace", team: 'CAR', teamName: "Carolina Panthers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 237, number: 56, starter: true, years: "2024-",
    attrs: { range: 7, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 4, playRecognition: 5, leadership: 4 } },
  { name: "Christian Rozeboom", short: "Rozeboom", team: 'CAR', teamName: "Carolina Panthers", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 230, number: 47, starter: false, years: "2025-",
    attrs: { range: 5, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 3, playRecognition: 6, leadership: 6 } },
  // CHI
  { name: "T.J. Edwards", short: "Edwards", team: 'CHI', teamName: "Chicago Bears", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 73, weight: 230, number: 53, starter: true, captain: true, years: "2023-",
    attrs: { range: 6, power: 6, tackling: 8, blockShed: 6, zoneInstincts: 7, passRush: 5, playRecognition: 8, leadership: 8 } },
  { name: "Tremaine Edmunds", short: "Edmunds", team: 'CHI', teamName: "Chicago Bears", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 77, weight: 250, number: 49, starter: true, years: "2023-",
    attrs: { range: 7, power: 6, tackling: 6, blockShed: 6, zoneInstincts: 7, passRush: 4, playRecognition: 6, leadership: 6 } },
  { name: "Noah Sewell", short: "N. Sewell", team: 'CHI', teamName: "Chicago Bears", pos: 'LB', subpos: 'lb', skin: '#b07848', height: 74, weight: 250, number: 44, starter: false, years: "2023-",
    attrs: { range: 5, power: 7, tackling: 6, blockShed: 6, zoneInstincts: 4, passRush: 4, playRecognition: 4, leadership: 4 } },
  // CIN
  { name: "Demetrius Knight Jr.", short: "Knight", team: 'CIN', teamName: "Cincinnati Bengals", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 235, number: 23, starter: true, years: "2025-",
    attrs: { range: 6, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 5, playRecognition: 5, leadership: 5 } },
  { name: "Barrett Carter", short: "B. Carter", team: 'CIN', teamName: "Cincinnati Bengals", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 231, number: 47, starter: true, years: "2025-",
    attrs: { range: 7, power: 4, tackling: 5, blockShed: 4, zoneInstincts: 6, passRush: 5, playRecognition: 5, leadership: 4 } },
  { name: "Oren Burks", short: "Burks", team: 'CIN', teamName: "Cincinnati Bengals", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 233, number: 42, starter: false, years: "2025-",
    attrs: { range: 5, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 4, playRecognition: 4, leadership: 5 } },
  // CLE
  { name: "Carson Schwesinger", short: "Schwesinger", team: 'CLE', teamName: "Cleveland Browns", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 242, number: 52, starter: true, years: "2025-",
    attrs: { range: 8, power: 6, tackling: 8, blockShed: 6, zoneInstincts: 7, passRush: 5, playRecognition: 8, leadership: 6 } },
  { name: "Devin Bush", short: "Bush", team: 'CLE', teamName: "Cleveland Browns", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 71, weight: 234, number: 30, starter: true, captain: true, years: "2025-",
    attrs: { range: 7, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 5, playRecognition: 6, leadership: 5 } },
  { name: "Mohamoud Diabate", short: "Diabate", team: 'CLE', teamName: "Cleveland Browns", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 229, number: 43, starter: false, years: "2024-",
    attrs: { range: 6, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 5, playRecognition: 4, leadership: 4 } },
  // DAL
  { name: "DeMarvion Overshown", short: "Overshown", team: 'DAL', teamName: "Dallas Cowboys", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 229, number: 13, starter: true, years: "2023-",
    attrs: { range: 8, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 7, passRush: 6, playRecognition: 6, leadership: 6 } },
  { name: "Logan Wilson", short: "L. Wilson", team: 'DAL', teamName: "Dallas Cowboys", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 241, number: 55, starter: true, years: "2025-",
    attrs: { range: 6, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 7, passRush: 4, playRecognition: 7, leadership: 6 } },
  { name: "Shemar James", short: "James", team: 'DAL', teamName: "Dallas Cowboys", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 226, number: 58, starter: false, years: "2025-",
    attrs: { range: 6, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 4, playRecognition: 4, leadership: 3 } },
  // DEN
  { name: "Alex Singleton", short: "Singleton", team: 'DEN', teamName: "Denver Broncos", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 240, number: 49, starter: true, captain: true, years: "2022-",
    attrs: { range: 6, power: 7, tackling: 8, blockShed: 7, zoneInstincts: 6, passRush: 5, playRecognition: 8, leadership: 9 } },
  { name: "Dre Greenlaw", short: "Greenlaw", team: 'DEN', teamName: "Denver Broncos", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 230, number: 57, starter: true, years: "2025-",
    attrs: { range: 8, power: 7, tackling: 7, blockShed: 6, zoneInstincts: 7, passRush: 5, playRecognition: 7, leadership: 6 } },
  { name: "Justin Strnad", short: "Strnad", team: 'DEN', teamName: "Denver Broncos", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 75, weight: 235, number: 40, starter: false, years: "2020-",
    attrs: { range: 5, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 4, playRecognition: 5, leadership: 4 } },
  // DET
  { name: "Jack Campbell", short: "J. Campbell", team: 'DET', teamName: "Detroit Lions", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 77, weight: 243, number: 46, starter: true, captain: true, years: "2023-",
    attrs: { range: 8, power: 8, tackling: 10, blockShed: 8, zoneInstincts: 8, passRush: 6, playRecognition: 9, leadership: 9 } },
  { name: "Derrick Barnes", short: "Barnes", team: 'DET', teamName: "Detroit Lions", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 245, number: 55, starter: true, years: "2021-",
    attrs: { range: 6, power: 7, tackling: 7, blockShed: 6, zoneInstincts: 6, passRush: 6, playRecognition: 6, leadership: 5 } },
  { name: "Malcolm Rodriguez", short: "Rodriguez", team: 'DET', teamName: "Detroit Lions", pos: 'LB', subpos: 'lb', skin: '#b07848', height: 71, weight: 232, number: 44, starter: false, years: "2022-",
    attrs: { range: 5, power: 5, tackling: 6, blockShed: 4, zoneInstincts: 5, passRush: 4, playRecognition: 6, leadership: 5 } },
  // GB
  { name: "Edgerrin Cooper", short: "Cooper", team: 'GB', teamName: "Green Bay Packers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 230, number: 56, starter: true, years: "2024-",
    attrs: { range: 9, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 7, passRush: 7, playRecognition: 7, leadership: 5 } },
  { name: "Zaire Franklin", short: "Franklin", team: 'GB', teamName: "Green Bay Packers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 235, number: 44, starter: true, captain: true, years: "2026-",
    attrs: { range: 6, power: 6, tackling: 8, blockShed: 6, zoneInstincts: 6, passRush: 4, playRecognition: 7, leadership: 9 } },
  { name: "Isaiah McDuffie", short: "McDuffie", team: 'GB', teamName: "Green Bay Packers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 227, number: 58, starter: false, years: "2021-",
    attrs: { range: 5, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 5, passRush: 4, playRecognition: 5, leadership: 4 } },
  // HOU
  { name: "Azeez Al-Shaair", short: "Al-Shaair", team: 'HOU', teamName: "Houston Texans", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 228, number: 0, starter: true, captain: true, years: "2024-",
    attrs: { range: 7, power: 6, tackling: 8, blockShed: 6, zoneInstincts: 6, passRush: 5, playRecognition: 7, leadership: 8 } },
  { name: "Henry To’oTo’o", short: "To’oTo’o", team: 'HOU', teamName: "Houston Texans", pos: 'LB', subpos: 'lb', skin: '#b07848', height: 73, weight: 228, number: 39, starter: true, years: "2023-",
    attrs: { range: 6, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 6, passRush: 4, playRecognition: 7, leadership: 6 } },
  { name: "Jake Hansen", short: "Hansen", team: 'HOU', teamName: "Houston Texans", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 73, weight: 238, number: 49, starter: false, years: "2022-",
    attrs: { range: 4, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 3, playRecognition: 4, leadership: 4 } },
  // IND
  { name: "Germaine Pratt", short: "Pratt", team: 'IND', teamName: "Indianapolis Colts", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 240, number: 57, starter: true, captain: true, years: "2025-",
    attrs: { range: 5, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 6, passRush: 4, playRecognition: 6, leadership: 6 } },
  { name: "Jaylon Carlies", short: "Carlies", team: 'IND', teamName: "Indianapolis Colts", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 227, number: 52, starter: true, years: "2024-",
    attrs: { range: 7, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 6, passRush: 4, playRecognition: 4, leadership: 4 } },
  { name: "Segun Olubi", short: "Olubi", team: 'IND', teamName: "Indianapolis Colts", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 225, number: 45, starter: false, years: "2021-",
    attrs: { range: 5, power: 4, tackling: 5, blockShed: 3, zoneInstincts: 4, passRush: 3, playRecognition: 4, leadership: 4 } },
  // JAX
  { name: "Foyesade Oluokun", short: "Oluokun", team: 'JAX', teamName: "Jacksonville Jaguars", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 230, number: 23, starter: true, captain: true, years: "2022-",
    attrs: { range: 7, power: 5, tackling: 8, blockShed: 5, zoneInstincts: 6, passRush: 4, playRecognition: 7, leadership: 8 } },
  { name: "Ventrell Miller", short: "V. Miller", team: 'JAX', teamName: "Jacksonville Jaguars", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 232, number: 51, starter: true, years: "2024-",
    attrs: { range: 6, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 4, playRecognition: 5, leadership: 5 } },
  { name: "Jack Kiser", short: "Kiser", team: 'JAX', teamName: "Jacksonville Jaguars", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 231, number: 58, starter: false, years: "2025-",
    attrs: { range: 5, power: 4, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 4, playRecognition: 4, leadership: 3 } },
  // KC
  { name: "Nick Bolton", short: "Bolton", team: 'KC', teamName: "Kansas City Chiefs", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 71, weight: 237, number: 32, starter: true, captain: true, years: "2021-",
    attrs: { range: 7, power: 7, tackling: 9, blockShed: 7, zoneInstincts: 6, passRush: 5, playRecognition: 8, leadership: 9 } },
  { name: "Leo Chenal", short: "Chenal", team: 'KC', teamName: "Kansas City Chiefs", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 75, weight: 250, number: 54, starter: true, years: "2022-",
    attrs: { range: 6, power: 9, tackling: 7, blockShed: 8, zoneInstincts: 4, passRush: 7, playRecognition: 6, leadership: 5 } },
  { name: "Drue Tranquill", short: "Tranquill", team: 'KC', teamName: "Kansas City Chiefs", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 234, number: 23, starter: false, years: "2023-",
    attrs: { range: 7, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 7, passRush: 6, playRecognition: 6, leadership: 6 } },
  // LV
  { name: "Devin White", short: "White", team: 'LV', teamName: "Las Vegas Raiders", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 237, number: 40, starter: true, years: "2025-",
    attrs: { range: 7, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 6, playRecognition: 5, leadership: 5 } },
  { name: "Elandon Roberts", short: "Roberts", team: 'LV', teamName: "Las Vegas Raiders", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 238, number: 52, starter: true, captain: true, years: "2025-",
    attrs: { range: 4, power: 8, tackling: 7, blockShed: 8, zoneInstincts: 3, passRush: 5, playRecognition: 6, leadership: 7 } },
  { name: "Tommy Eichenberg", short: "Eichenberg", team: 'LV', teamName: "Las Vegas Raiders", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 233, number: 45, starter: false, years: "2024-",
    attrs: { range: 5, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 3, playRecognition: 5, leadership: 4 } },
  // LAC
  { name: "Daiyan Henley", short: "Henley", team: 'LAC', teamName: "Los Angeles Chargers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 225, number: 0, starter: true, years: "2023-",
    attrs: { range: 8, power: 5, tackling: 7, blockShed: 5, zoneInstincts: 7, passRush: 6, playRecognition: 6, leadership: 6 } },
  { name: "Denzel Perryman", short: "Perryman", team: 'LAC', teamName: "Los Angeles Chargers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 71, weight: 240, number: 6, starter: true, captain: true, years: "2024-",
    attrs: { range: 4, power: 8, tackling: 8, blockShed: 8, zoneInstincts: 4, passRush: 4, playRecognition: 7, leadership: 7 } },
  { name: "Junior Colson", short: "Colson", team: 'LAC', teamName: "Los Angeles Chargers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 238, number: 25, starter: false, years: "2024-",
    attrs: { range: 5, power: 6, tackling: 5, blockShed: 5, zoneInstincts: 4, passRush: 3, playRecognition: 4, leadership: 4 } },
  // LAR
  { name: "Nate Landman", short: "Landman", team: 'LAR', teamName: "Los Angeles Rams", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 75, weight: 235, number: 53, starter: true, captain: true, years: "2025-",
    attrs: { range: 6, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 6, passRush: 4, playRecognition: 7, leadership: 7 } },
  { name: "Omar Speights", short: "Speights", team: 'LAR', teamName: "Los Angeles Rams", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 230, number: 46, starter: true, years: "2024-",
    attrs: { range: 6, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 4, playRecognition: 5, leadership: 4 } },
  { name: "Troy Reeder", short: "Reeder", team: 'LAR', teamName: "Los Angeles Rams", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 75, weight: 245, number: 51, starter: false, years: "2025-",
    attrs: { range: 4, power: 5, tackling: 5, blockShed: 5, zoneInstincts: 4, passRush: 4, playRecognition: 5, leadership: 5 } },
  // MIA
  { name: "Jordyn Brooks", short: "Brooks", team: 'MIA', teamName: "Miami Dolphins", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 240, number: 20, starter: true, captain: true, years: "2024-",
    attrs: { range: 7, power: 7, tackling: 9, blockShed: 7, zoneInstincts: 6, passRush: 5, playRecognition: 7, leadership: 8 } },
  { name: "Tyrel Dodson", short: "Dodson", team: 'MIA', teamName: "Miami Dolphins", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 237, number: 25, starter: true, years: "2025-",
    attrs: { range: 6, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 6, passRush: 5, playRecognition: 5, leadership: 5 } },
  { name: "K.J. Britt", short: "Britt", team: 'MIA', teamName: "Miami Dolphins", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 235, number: 52, starter: false, years: "2025-",
    attrs: { range: 4, power: 6, tackling: 5, blockShed: 6, zoneInstincts: 4, passRush: 3, playRecognition: 5, leadership: 4 } },
  // MIN
  { name: "Blake Cashman", short: "Cashman", team: 'MIN', teamName: "Minnesota Vikings", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 73, weight: 235, number: 51, starter: true, captain: true, years: "2024-",
    attrs: { range: 7, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 7, passRush: 6, playRecognition: 7, leadership: 7 } },
  { name: "Ivan Pace Jr.", short: "Pace", team: 'MIN', teamName: "Minnesota Vikings", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 70, weight: 231, number: 40, starter: true, years: "2023-",
    attrs: { range: 7, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 8, playRecognition: 5, leadership: 5 } },
  { name: "Eric Wilson", short: "E. Wilson", team: 'MIN', teamName: "Minnesota Vikings", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 73, weight: 230, number: 56, starter: false, years: "2025-",
    attrs: { range: 5, power: 5, tackling: 5, blockShed: 5, zoneInstincts: 5, passRush: 6, playRecognition: 5, leadership: 5 } },
  // NE
  { name: "Robert Spillane", short: "Spillane", team: 'NE', teamName: "New England Patriots", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 73, weight: 229, number: 14, starter: true, captain: true, years: "2025-",
    attrs: { range: 6, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 6, passRush: 5, playRecognition: 7, leadership: 8 } },
  { name: "Christian Elliss", short: "C. Elliss", team: 'NE', teamName: "New England Patriots", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 73, weight: 235, number: 53, starter: true, years: "2023-",
    attrs: { range: 6, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 5, playRecognition: 5, leadership: 5 } },
  { name: "Jahlani Tavai", short: "Tavai", team: 'NE', teamName: "New England Patriots", pos: 'LB', subpos: 'lb', skin: '#b07848', height: 74, weight: 255, number: 48, starter: false, years: "2020-",
    attrs: { range: 4, power: 7, tackling: 6, blockShed: 7, zoneInstincts: 4, passRush: 5, playRecognition: 5, leadership: 5 } },
  // NO
  { name: "Pete Werner", short: "Werner", team: 'NO', teamName: "New Orleans Saints", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 75, weight: 242, number: 20, starter: true, captain: true, years: "2021-",
    attrs: { range: 6, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 6, passRush: 4, playRecognition: 6, leadership: 6 } },
  { name: "Danny Stutsman", short: "Stutsman", team: 'NO', teamName: "New Orleans Saints", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 75, weight: 233, number: 55, starter: true, years: "2025-",
    attrs: { range: 6, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 4, passRush: 5, playRecognition: 5, leadership: 4 } },
  { name: "Jaylan Ford", short: "Ford", team: 'NO', teamName: "New Orleans Saints", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 240, number: 53, starter: false, years: "2024-",
    attrs: { range: 5, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 4, passRush: 3, playRecognition: 4, leadership: 4 } },
  // NYG
  { name: "Bobby Okereke", short: "Okereke", team: 'NYG', teamName: "New York Giants", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 239, number: 58, starter: true, captain: true, years: "2023-",
    attrs: { range: 7, power: 6, tackling: 7, blockShed: 6, zoneInstincts: 7, passRush: 4, playRecognition: 7, leadership: 8 } },
  { name: "Micah McFadden", short: "McFadden", team: 'NYG', teamName: "New York Giants", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 240, number: 41, starter: true, years: "2022-",
    attrs: { range: 6, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 6, playRecognition: 5, leadership: 5 } },
  { name: "Darius Muasau", short: "Muasau", team: 'NYG', teamName: "New York Giants", pos: 'LB', subpos: 'lb', skin: '#b07848', height: 73, weight: 225, number: 53, starter: false, years: "2024-",
    attrs: { range: 5, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 4, passRush: 4, playRecognition: 4, leadership: 4 } },
  // NYJ
  { name: "Quincy Williams", short: "Q. Williams", team: 'NYJ', teamName: "New York Jets", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 71, weight: 225, number: 56, starter: true, years: "2019-",
    attrs: { range: 8, power: 7, tackling: 8, blockShed: 6, zoneInstincts: 6, passRush: 7, playRecognition: 6, leadership: 6 } },
  { name: "Jamien Sherwood", short: "Sherwood", team: 'NYJ', teamName: "New York Jets", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 216, number: 44, starter: true, years: "2021-",
    attrs: { range: 7, power: 5, tackling: 8, blockShed: 5, zoneInstincts: 7, passRush: 4, playRecognition: 7, leadership: 6 } },
  { name: "Demario Davis", short: "D. Davis", team: 'NYJ', teamName: "New York Jets", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 248, number: 50, starter: true, captain: true, years: "2026-",
    attrs: { range: 5, power: 6, tackling: 8, blockShed: 6, zoneInstincts: 6, passRush: 6, playRecognition: 8, leadership: 10 } },
  // PHI
  { name: "Zack Baun", short: "Baun", team: 'PHI', teamName: "Philadelphia Eagles", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 225, number: 53, starter: true, captain: true, years: "2024-",
    attrs: { range: 8, power: 6, tackling: 8, blockShed: 6, zoneInstincts: 8, passRush: 8, playRecognition: 8, leadership: 7 } },
  { name: "Jihaad Campbell", short: "Ji. Campbell", team: 'PHI', teamName: "Philadelphia Eagles", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 235, number: 30, starter: true, years: "2025-",
    attrs: { range: 8, power: 6, tackling: 6, blockShed: 6, zoneInstincts: 6, passRush: 7, playRecognition: 5, leadership: 4 } },
  { name: "Nakobe Dean", short: "Dean", team: 'PHI', teamName: "Philadelphia Eagles", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 71, weight: 231, number: 17, starter: false, years: "2022-",
    attrs: { range: 7, power: 5, tackling: 7, blockShed: 5, zoneInstincts: 6, passRush: 6, playRecognition: 7, leadership: 6 } },
  // PIT
  { name: "Patrick Queen", short: "Queen", team: 'PIT', teamName: "Pittsburgh Steelers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 232, number: 6, starter: true, captain: true, years: "2024-",
    attrs: { range: 8, power: 6, tackling: 7, blockShed: 5, zoneInstincts: 6, passRush: 6, playRecognition: 6, leadership: 6 } },
  { name: "Payton Wilson", short: "P. Wilson", team: 'PIT', teamName: "Pittsburgh Steelers", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 76, weight: 233, number: 41, starter: true, years: "2024-",
    attrs: { range: 9, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 7, passRush: 6, playRecognition: 6, leadership: 5 } },
  { name: "Malik Harrison", short: "Harrison", team: 'PIT', teamName: "Pittsburgh Steelers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 75, weight: 245, number: 40, starter: false, years: "2025-",
    attrs: { range: 4, power: 7, tackling: 5, blockShed: 6, zoneInstincts: 4, passRush: 4, playRecognition: 4, leadership: 4 } },
  // SF
  { name: "Fred Warner", short: "Warner", team: 'SF', teamName: "San Francisco 49ers", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 75, weight: 230, number: 54, starter: true, captain: true, years: "2018-",
    attrs: { range: 10, power: 7, tackling: 10, blockShed: 8, zoneInstincts: 11, passRush: 5, playRecognition: 11, leadership: 10 } },
  { name: "Dee Winters", short: "Winters", team: 'SF', teamName: "San Francisco 49ers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 71, weight: 227, number: 53, starter: true, years: "2023-",
    attrs: { range: 7, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 6, playRecognition: 5, leadership: 5 } },
  { name: "Tatum Bethune", short: "Bethune", team: 'SF', teamName: "San Francisco 49ers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 229, number: 48, starter: false, years: "2024-",
    attrs: { range: 5, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 3, playRecognition: 5, leadership: 4 } },
  // SEA
  { name: "Ernest Jones IV", short: "E. Jones", team: 'SEA', teamName: "Seattle Seahawks", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 230, number: 13, starter: true, captain: true, years: "2024-",
    attrs: { range: 7, power: 7, tackling: 8, blockShed: 6, zoneInstincts: 6, passRush: 5, playRecognition: 8, leadership: 8 } },
  { name: "Tyrice Knight", short: "T. Knight", team: 'SEA', teamName: "Seattle Seahawks", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 235, number: 48, starter: true, years: "2024-",
    attrs: { range: 6, power: 6, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 4, playRecognition: 5, leadership: 5 } },
  { name: "Drake Thomas", short: "D. Thomas", team: 'SEA', teamName: "Seattle Seahawks", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 72, weight: 228, number: 42, starter: false, years: "2025-",
    attrs: { range: 7, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 6, passRush: 5, playRecognition: 6, leadership: 5 } },
  // TB
  { name: "Lavonte David", short: "L. David", team: 'TB', teamName: "Tampa Bay Buccaneers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 233, number: 54, starter: true, captain: true, years: "2012-",
    attrs: { range: 7, power: 6, tackling: 8, blockShed: 6, zoneInstincts: 8, passRush: 6, playRecognition: 9, leadership: 10 } },
  { name: "SirVocea Dennis", short: "Dennis", team: 'TB', teamName: "Tampa Bay Buccaneers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 226, number: 8, starter: true, years: "2023-",
    attrs: { range: 7, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 5, passRush: 5, playRecognition: 5, leadership: 4 } },
  { name: "Anthony Walker Jr.", short: "A. Walker", team: 'TB', teamName: "Tampa Bay Buccaneers", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 235, number: 5, starter: false, years: "2025-",
    attrs: { range: 5, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 5, passRush: 4, playRecognition: 6, leadership: 6 } },
  // TEN
  { name: "Cedric Gray", short: "Gray", team: 'TEN', teamName: "Tennessee Titans", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 74, weight: 234, number: 33, starter: true, captain: true, years: "2024-",
    attrs: { range: 7, power: 6, tackling: 7, blockShed: 5, zoneInstincts: 6, passRush: 5, playRecognition: 6, leadership: 6 } },
  { name: "Cody Barton", short: "Barton", team: 'TEN', teamName: "Tennessee Titans", pos: 'LB', subpos: 'lb', skin: '#f0c4a0', height: 74, weight: 237, number: 55, starter: true, years: "2025-",
    attrs: { range: 6, power: 5, tackling: 6, blockShed: 5, zoneInstincts: 6, passRush: 4, playRecognition: 6, leadership: 6 } },
  { name: "James Williams", short: "J. Williams", team: 'TEN', teamName: "Tennessee Titans", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 76, weight: 235, number: 30, starter: false, years: "2024-",
    attrs: { range: 6, power: 6, tackling: 5, blockShed: 5, zoneInstincts: 4, passRush: 4, playRecognition: 4, leadership: 3 } },
  // WAS
  { name: "Bobby Wagner", short: "Wagner", team: 'WAS', teamName: "Washington Commanders", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 72, weight: 242, number: 54, starter: true, captain: true, years: "2024-",
    attrs: { range: 6, power: 7, tackling: 9, blockShed: 7, zoneInstincts: 9, passRush: 6, playRecognition: 10, leadership: 11 } },
  { name: "Frankie Luvu", short: "Luvu", team: 'WAS', teamName: "Washington Commanders", pos: 'LB', subpos: 'lb', skin: '#b07848', height: 74, weight: 235, number: 4, starter: true, years: "2024-",
    attrs: { range: 7, power: 7, tackling: 6, blockShed: 6, zoneInstincts: 5, passRush: 9, playRecognition: 6, leadership: 7 } },
  { name: "Jordan Magee", short: "Magee", team: 'WAS', teamName: "Washington Commanders", pos: 'LB', subpos: 'lb', skin: '#5e3c22', height: 73, weight: 228, number: 50, starter: false, years: "2024-",
    attrs: { range: 6, power: 5, tackling: 5, blockShed: 4, zoneInstincts: 5, passRush: 4, playRecognition: 4, leadership: 4 } },
]
export const LBS = _LBS.map(p => ({ ...p, ...TEAM_COLOR[p.team], attrs: { ...p.attrs, size: lbSizeGrade(p.height, p.weight) } }))
