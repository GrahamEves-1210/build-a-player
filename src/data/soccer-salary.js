// SALARY CAP (soccer): the five columns and the player pool, shared by the Salary Cap
// screen (components/SoccerSalaryCap.jsx) and the live server's check (lib/verifyCore.js).
// The parallel of data/nba-salary.js. Prices are basketball's: the same five rating tiers
// (lib/salaryCore.js), not real wages or transfer fees.
import { SOCCER_STRIKERS, WC_STRIKERS } from './soccer-strikers'

// ─── The pool ────────────────────────────────────────────────────────────────
// Every player on the Top Divisions wheel (team = club), plus the World Cup players who
// aren't at a top-five-league club (Messi, Ronaldo...: team = nation, teamKind 'nation').
// A player in both pools keeps his club card. Same floor as basketball's pool.
const CLUB_NAMES = new Set(SOCCER_STRIKERS.map(p => p.name))
export const SOCCER_SAL_POOL = [
  ...SOCCER_STRIKERS.map(p => ({ ...p, teamKind: 'club' })),
  ...WC_STRIKERS.filter(p => !CLUB_NAMES.has(p.name)).map(p => ({ ...p, teamKind: 'nation' })),
]
  .filter(p => {
    if (!p.attrs) return false
    const vals = Object.values(p.attrs)
    return vals.reduce((s, v) => s + v, 0) / vals.length >= 3.0
  })
  .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)

// ─── The five columns: each covers two of the striker's ten traits ─────────────
// A pick's card is his real ratings on his column's traits; the five picks make the
// whole striker (nothing is averaged in, unlike basketball's IQ / clutch / rebounding).
export const SOCCER_SAL_COLS = [
  { key: 'finishing', label: 'FINISHING',    types: ['finishing', 'shotPower'] },
  { key: 'control',   label: 'BALL CONTROL', types: ['dribbling', 'firstTouch'] },
  { key: 'linkup',    label: 'LINK-UP PLAY', types: ['linkUp', 'composure'] },
  { key: 'box',       label: 'IN THE BOX',   types: ['offBall', 'heading'] },
  { key: 'physical',  label: 'PACE & POWER', types: ['pace', 'strength'] },
]

export const soccerSalTypesFor = (player, col) => col.types

// The build the picks make: each column's traits at that player's real ratings
// (the screen adds the card fields; the server only needs val / name / team)
export function soccerSalBuild(picks, extra = () => ({})) {
  const build = {}
  SOCCER_SAL_COLS.forEach((col, ci) => {
    const p = picks[ci]
    col.types.forEach(type => { build[type] = { type, val: p?.attrs?.[type] ?? 5, qb: p?.short ?? p?.name, qbFull: p?.name, team: p?.team, ...extra(p, type) } })
  })
  return build
}

// The board's stat line (the parallel of basketball's PPG / APG / RPG): each column's best
// card rating, turned into a striker's league season. It only breaks ties on the boards.
export function soccerSalStats(best) {
  const [f, c, l, b, p] = best
  const overall = Math.round(f + c + l + b + p)
  const goals   = Math.round((f + b) / 2 * 2.4 + 4)
  const assists = Math.round(l * 0.9 + c * 0.2 + 1)
  return { overall, goals, assists }
}
