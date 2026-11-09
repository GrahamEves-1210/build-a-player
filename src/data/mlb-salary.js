// SALARY CAP (baseball): the five columns and the player pool, shared by the Salary Cap screen
// (components/BaseballSalaryCap.jsx) and the live server's check (lib/baseballKits.js → lib/verifyCore.js).
// The parallel of data/soccer-salary.js and data/nba-salary.js. Batters only: one board a day, like basketball's.
// Prices are the other sports': the same five rating tiers (lib/salaryCore.js, $50M down to $10M), dealt off each
// player's real ratings in that column, not his real contract.
// Only the baseball screen's chunk and the worker import this file (it carries the rosters).
import { MLB_BATTERS } from './mlb-batters'
import { MLB_LEGEND_BATTERS } from './mlb-legend-batters'
import MLB_HEADSHOTS from './mlb-headshots.json'

// ─── The pool ─────────────────────────────────────────────────────────────────
// Every batter on the CURRENT wheel (the 2026 rosters), plus the franchise legends with an ESPN headshot
// (basketball's rule: a legend's card always has his face), flagged legend: true so the board deals two a day
// at the tier their ratings earn. A name on both lists (an active franchise great) keeps his 2026 card.
// Same floor as soccer's and basketball's pools.
const hasPhoto = p => p.espn != null && !!MLB_HEADSHOTS[String(p.espn)]
const floor = p => { const v = Object.values(p.attrs ?? {}); return v.length && v.reduce((s, x) => s + x, 0) / v.length >= 3.0 }
const NAMES = new Set(MLB_BATTERS.map(p => p.name))
export const MLB_SAL_POOL = [
  ...MLB_BATTERS.map(p => ({ ...p, legend: false })),
  ...MLB_LEGEND_BATTERS.filter(p => hasPhoto(p) && !NAMES.has(p.name)).map(p => ({ ...p, legend: true })),
]
  .filter(p => p.attrs && floor(p))
  .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)

// ─── The five columns: each covers two of the batter's ten traits ──────────────
// A pick's card is his real ratings on his column's traits; the five picks make the whole batter
// (nothing averaged in, like soccer's striker).
export const MLB_SAL_COLS = [
  { key: 'hit',      label: 'HIT TOOL',    types: ['contact', 'avoidK'] },
  { key: 'power',    label: 'POWER',       types: ['power', 'gap'] },
  { key: 'approach', label: 'APPROACH',    types: ['eye', 'clutch'] },
  { key: 'legs',     label: 'SPEED',       types: ['speed', 'baserunning'] },
  { key: 'glove',    label: 'GLOVE & ARM', types: ['fielding', 'arm'] },
]
export const mlbSalTypesFor = (player, col) => col.types

// The build the picks make: each column's traits at that player's real ratings
// (the screen adds the card fields; the server only needs val / name / team)
export function mlbSalBuild(picks, extra = () => ({})) {
  const build = {}
  MLB_SAL_COLS.forEach((col, ci) => {
    const p = picks[ci]
    col.types.forEach(type => { build[type] = { type, val: p?.attrs?.[type] ?? 5, qb: p?.short ?? p?.name, qbFull: p?.name, team: p?.team, ...extra(p, type) } })
  })
  return build
}

// The board's stat line (the parallel of soccer's goals / assists): each column's best card rating, turned into
// home runs and RBI. It only breaks ties on the boards. (On the 0-11 scale an S slugger lands near 50 homers.)
export function mlbSalStats(best) {
  const [hit, pow, app, legs, glove] = best
  return {
    overall: Math.round(hit + pow + app + legs + glove),
    hr: Math.round(pow * 4 + 4),
    rbi: Math.round(pow * 6 + hit * 3 + app * 2 + 25),
  }
}
