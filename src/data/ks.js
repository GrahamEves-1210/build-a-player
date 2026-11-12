import { TEAMS } from './nfl-teams'
const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

export { K_LIVE } from '../lib/kLive'   // the switch for everything players see about the kicker

// Kickers: the current-player pool for K mode. One per team, the man kicking now on ESPN's rosters (Nov 10, 2026);
// a second only where two placekickers are on the active roster (the Rams: McManus kicks, Karty kicks off).
// Three ratings on the 0-11 grade scale (F … S), graded from 2025 and 2026 production (ESPN season stats and play-by-play):
//   power     50+ makes and attempts, the longest makes, how often he's sent out from 55+
//   accuracy  field goal percentage, weighted to 40-49 and in, extra-point misses against him
//   clutch    game-winners and late tying / go-ahead kicks made and missed, playoff kicks
// fg25 / fg26: field goals made/attempted in 2025 and in 2026 through Week 9 (null: didn't kick); long: his longest in those two years.
// Unsettled on Nov 10 (re-check before a ratings pass): ATL signed Moody that day (Folk released); BAL's Loop is on IR with no
// healthy kicker listed; MIA's Gonzalez and NO's Smyth are practice-squad elevations; KC has Tucker on the practice squad.
// Height (total inches), weight (lbs) and jersey number from ESPN's rosters (Nov 2026).
// skin: #f0c4a0 white  #b07848 mixed/Polynesian/Latino  #5e3c22 Black  #3a2010 very dark Black
export const K_TYPES = ['power', 'accuracy', 'clutch']
export const K_LITE_TYPES = K_TYPES   // three ratings: there is nothing to trim

export const K_CATEGORIES = [
  { id: 'physical', label: 'Physical', types: ['power'] },
  { id: 'skill',    label: 'Skill',    types: ['accuracy'] },
  { id: 'mental',   label: 'Mental',   types: ['clutch'] },
]

export const K_ATTR = {
  power:    { label: 'Power',    shortLabel: 'PWR', category: 'physical', col: 'var(--c-str)',  hex: '#fb923c', bodyZone: 'legs' },
  accuracy: { label: 'Accuracy', shortLabel: 'ACC', category: 'skill',    col: 'var(--c-acc)',  hex: '#34d399', bodyZone: 'legs' },
  clutch:   { label: 'Clutch',   shortLabel: 'CLU', category: 'mental',   col: 'var(--c-lead)', hex: '#a78bfa', bodyZone: 'head' },
}

// Accuracy is the job; the leg decides how far out the coach will send him; clutch is the handful of kicks a season
// that decide games.
export const K_ATTR_WEIGHT = { accuracy: 0.42, power: 0.33, clutch: 0.25 }

// Same curve every other position uses, so a K OVR reads on the same scale.
export function kOVR(vals) {
  const filled = K_TYPES.filter(t => vals[t] != null)
  if (!filled.length) return null
  const totalW = filled.reduce((s, t) => s + K_ATTR_WEIGHT[t], 0)
  const avg    = filled.reduce((s, t) => s + vals[t] * K_ATTR_WEIGHT[t] / totalW, 0)
  const base   = 60 + 2.1 * avg + 0.21 * avg * avg
  // Three ratings max out far more easily than nine (a build takes the best leg, the best accuracy and the best
  // nerve in the league from three spins), so the top of the curve runs at about half above 88 and there is no
  // all-A bonus: S / S / A+ is a 98, three A+ a 96, three A a 92; only S across the board is a 99. Below 88 it
  // reads on the same scale as every other position (the owner, 2026-11-10: kicker overalls ran high)
  const top = base > 88 ? 88 + (base - 88) * 0.54 : base
  return Math.min(99, Math.max(0, Math.round(top)))
}

// K's own figure (public/k-silhouette.webp, colored by components/KFigureOverlay.jsx, zones in Silhouette.jsx K_ZONES):
//   clutch → the helmet and face, accuracy → the jersey, sleeves and hands, power → both legs and the shoes.
export const K_SILHOUETTE = '/k-silhouette.webp'

const _KS = [
  // ARI
  { name: "Chad Ryland", short: "Ryland", team: 'ARI', teamName: "Arizona Cardinals", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 72, weight: 195, number: 38, starter: true,
    fg25: '25/33', fg26: '20/22', long: 60,
    attrs: { power: 6, accuracy: 5, clutch: 7 } },
  // ATL
  { name: "Jake Moody", short: "Moody", team: 'ATL', teamName: "Atlanta Falcons", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 73, weight: 210, number: 45, starter: true,
    fg25: '19/23', fg26: '1/1', long: 56,
    attrs: { power: 4, accuracy: 4, clutch: 5 } },
  // BAL
  { name: "Tyler Loop", short: "Loop", team: 'BAL', teamName: "Baltimore Ravens", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 71, weight: 191, number: 33, starter: true,
    fg25: '30/34', fg26: '13/17', long: 64,
    attrs: { power: 7, accuracy: 5, clutch: 4 } },
  // BUF
  { name: "Tyler Bass", short: "Bass", team: 'BUF', teamName: "Buffalo Bills", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 70, weight: 183, number: 16, starter: true,
    fg25: null, fg26: '19/19', long: 56,
    attrs: { power: 6, accuracy: 7, clutch: 5 } },
  // CAR
  { name: "Ryan Fitzgerald", short: "Fitzgerald", team: 'CAR', teamName: "Carolina Panthers", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 71, weight: 193, number: 10, starter: true,
    fg25: '24/29', fg26: '13/14', long: 57,
    attrs: { power: 4, accuracy: 4, clutch: 7 } },
  // CHI
  { name: "Cairo Santos", short: "Santos", team: 'CHI', teamName: "Chicago Bears", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 68, weight: 173, number: 8, starter: true,
    fg25: '25/30', fg26: '15/19', long: 58,
    attrs: { power: 3, accuracy: 5, clutch: 6 } },
  // CIN
  { name: "Evan McPherson", short: "McPherson", team: 'CIN', teamName: "Cincinnati Bengals", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 71, weight: 185, number: 2, starter: true,
    fg25: '25/28', fg26: '12/12', long: 63,
    attrs: { power: 9, accuracy: 8, clutch: 7 } },
  // CLE
  { name: "Andre Szmyt", short: "Szmyt", team: 'CLE', teamName: "Cleveland Browns", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 72, weight: 200, number: 25, starter: true,
    fg25: '24/27', fg26: '19/21', long: 56,
    attrs: { power: 6, accuracy: 7, clutch: 7 } },
  // DAL
  { name: "Brandon Aubrey", short: "Aubrey", team: 'DAL', teamName: "Dallas Cowboys", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 75, weight: 218, number: 17, starter: true,
    fg25: '36/42', fg26: '17/22', long: 64,
    attrs: { power: 11, accuracy: 9, clutch: 9 } },
  // DEN
  { name: "Wil Lutz", short: "Lutz", team: 'DEN', teamName: "Denver Broncos", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 71, weight: 184, number: 3, starter: true,
    fg25: '28/32', fg26: '16/19', long: 57,
    attrs: { power: 5, accuracy: 6, clutch: 8 } },
  // DET
  { name: "Jake Bates", short: "Bates", team: 'DET', teamName: "Detroit Lions", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 70, weight: 205, number: 39, starter: true,
    fg25: '27/34', fg26: '16/17', long: 59,
    attrs: { power: 6, accuracy: 5, clutch: 7 } },
  // GB
  { name: "Trey Smack", short: "Smack", team: 'GB', teamName: "Green Bay Packers", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 73, weight: 188, number: 28, starter: true,
    fg25: null, fg26: '14/19', long: 59,
    attrs: { power: 5, accuracy: 3, clutch: 5 } },
  // HOU
  { name: "Ka'imi Fairbairn", short: "Fairbairn", team: 'HOU', teamName: "Houston Texans", pos: 'K', subpos: 'k', skin: '#b07848', height: 72, weight: 183, number: 15, starter: true,
    fg25: '44/48', fg26: '18/19', long: 58,
    attrs: { power: 8, accuracy: 11, clutch: 6 } },
  // IND
  { name: "Spencer Shrader", short: "Shrader", team: 'IND', teamName: "Indianapolis Colts", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 74, weight: 201, number: 3, starter: true,
    fg25: '13/14', fg26: '22/24', long: 59,
    attrs: { power: 6, accuracy: 8, clutch: 6 } },
  // JAX
  { name: "Cam Little", short: "Little", team: 'JAX', teamName: "Jacksonville Jaguars", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 73, weight: 172, number: 39, starter: true,
    fg25: '30/34', fg26: '14/16', long: 68,
    attrs: { power: 11, accuracy: 7, clutch: 7 } },
  // KC
  { name: "Harrison Butker", short: "Butker", team: 'KC', teamName: "Kansas City Chiefs", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 76, weight: 205, number: 7, starter: true,
    fg25: '33/38', fg26: '12/19', long: 59,
    attrs: { power: 5, accuracy: 3, clutch: 9 } },
  // LV
  { name: "Matt Gay", short: "Gay", team: 'LV', teamName: "Las Vegas Raiders", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 72, weight: 232, number: 14, starter: true,
    fg25: '17/23', fg26: '19/21', long: 59,
    attrs: { power: 5, accuracy: 5, clutch: 5 } },
  // LAC
  { name: "Cameron Dicker", short: "Dicker", team: 'LAC', teamName: "Los Angeles Chargers", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 73, weight: 216, number: 11, starter: true,
    fg25: '38/41', fg26: '15/17', long: 59,
    attrs: { power: 5, accuracy: 10, clutch: 7 } },
  // LAR
  { name: "Brandon McManus", short: "McManus", team: 'LAR', teamName: "Los Angeles Rams", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 75, weight: 201, number: 19, starter: true,
    fg25: '24/30', fg26: '3/3', long: 56,
    attrs: { power: 5, accuracy: 4, clutch: 5 } },
  { name: "Joshua Karty", short: "Karty", team: 'LAR', teamName: "Los Angeles Rams", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 74, weight: 208, number: 16, starter: false,
    fg25: '10/15', fg26: null, long: 51,
    attrs: { power: 5, accuracy: 3, clutch: 3 } },
  // MIA
  { name: "Zane Gonzalez", short: "Gonzalez", team: 'MIA', teamName: "Miami Dolphins", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 72, weight: 202, number: 45, starter: true,
    fg25: '19/22', fg26: '5/7', long: 56,
    attrs: { power: 5, accuracy: 5, clutch: 6 } },
  // MIN
  { name: "Will Reichard", short: "Reichard", team: 'MIN', teamName: "Minnesota Vikings", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 73, weight: 190, number: 16, starter: true,
    fg25: '33/35', fg26: '20/22', long: 62,
    attrs: { power: 10, accuracy: 10, clutch: 5 } },
  // NE
  { name: "Andy Borregales", short: "Borregales", team: 'NE', teamName: "New England Patriots", pos: 'K', subpos: 'k', skin: '#b07848', height: 71, weight: 202, number: 8, starter: true,
    fg25: '27/32', fg26: '10/13', long: 59,
    attrs: { power: 5, accuracy: 4, clutch: 5 } },
  // NO
  { name: "Charlie Smyth", short: "Smyth", team: 'NO', teamName: "New Orleans Saints", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 76, weight: 210, number: 39, starter: true,
    fg25: '12/16', fg26: '3/4', long: 57,
    attrs: { power: 5, accuracy: 3, clutch: 5 } },
  // NYG
  { name: "Dominic Zvada", short: "Zvada", team: 'NYG', teamName: "New York Giants", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 75, weight: 187, number: 34, starter: true,
    fg25: null, fg26: '17/22', long: 56,
    attrs: { power: 5, accuracy: 3, clutch: 3 } },
  // NYJ
  { name: "Jason Sanders", short: "Sanders", team: 'NYJ', teamName: "New York Jets", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 71, weight: 186, number: 19, starter: true,
    fg25: null, fg26: '21/24', long: 54,
    attrs: { power: 5, accuracy: 6, clutch: 5 } },
  // PHI
  { name: "Jake Elliott", short: "Elliott", team: 'PHI', teamName: "Philadelphia Eagles", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 69, weight: 167, number: 4, starter: true,
    fg25: '20/27', fg26: '7/8', long: 58,
    attrs: { power: 5, accuracy: 4, clutch: 7 } },
  // PIT
  { name: "Chris Boswell", short: "Boswell", team: 'PIT', teamName: "Pittsburgh Steelers", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 74, weight: 185, number: 9, starter: true,
    fg25: '27/32', fg26: '18/23', long: 60,
    attrs: { power: 9, accuracy: 6, clutch: 9 } },
  // SF
  { name: "Eddy Pineiro", short: "Pineiro", team: 'SF', teamName: "San Francisco 49ers", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 71, weight: 190, number: 18, starter: true,
    fg25: '28/29', fg26: '7/10', long: 59,
    attrs: { power: 5, accuracy: 6, clutch: 7 } },
  // SEA
  { name: "Jason Myers", short: "Myers", team: 'SEA', teamName: "Seattle Seahawks", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 70, weight: 190, number: 5, starter: true,
    fg25: '41/48', fg26: '16/18', long: 57,
    attrs: { power: 7, accuracy: 7, clutch: 10 } },
  // TB
  { name: "Chase McLaughlin", short: "McLaughlin", team: 'TB', teamName: "Tampa Bay Buccaneers", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 72, weight: 190, number: 4, starter: true,
    fg25: '32/38', fg26: '22/22', long: 65,
    attrs: { power: 10, accuracy: 8, clutch: 7 } },
  // TEN
  { name: "Joey Slye", short: "Slye", team: 'TEN', teamName: "Tennessee Titans", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 71, weight: 213, number: 6, starter: true,
    fg25: '28/35', fg26: '12/13', long: 58,
    attrs: { power: 7, accuracy: 5, clutch: 6 } },
  // WAS
  { name: "Drew Stevens", short: "Stevens", team: 'WAS', teamName: "Washington Commanders", pos: 'K', subpos: 'k', skin: '#f0c4a0', height: 73, weight: 213, number: 19, starter: true,
    fg25: null, fg26: '16/19', long: 57,
    attrs: { power: 5, accuracy: 4, clutch: 4 } },
]
export const KS = _KS.map(p => ({ ...p, ...TEAM_COLOR[p.team], attrs: { ...p.attrs }, ovr: kOVR(p.attrs) }))

// First-Team All-Pro ballot: three names, best first (the vote leans to the front), then an alternate who steps in when
// one of the three is the kicker the build replaced on its own team. Hand-picked from 2025-26, not just top OVR.
export const K_ALL_PRO_BALLOT = ['Brandon Aubrey', "Ka'imi Fairbairn", 'Chase McLaughlin', 'Will Reichard']
