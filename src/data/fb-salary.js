// SALARY CAP (football), every position: the five columns and the player pool each
// position's board is dealt from. QB is the daily game's own (data/qb-salary.js, untouched);
// the others play Infinite only (QBSalaryCap.jsx → Change Position). A board prices its
// players the same way at every position (lib/salaryCore.js): each column ranks the pool on
// that column's traits and the five price tiers take a fifth of it each, so price tracks
// rating. Read by the game and by the live server's check (lib/verifyCore.js).
import { QB_SAL_POOL, QB_SAL_COLS } from './qb-salary'
import { TYPES } from './qbs'
import { RBS, RB_TYPES } from './rbs'
import { RB_LEGENDS } from './rb-legends'
import { WRS, WR_TYPES } from './wrs'
import { WR_LEGENDS } from './wr-legends'
import { TES, TE_TYPES } from './tes'
import { TE_LEGENDS } from './te-legends'
import { DBS, DB_TYPES } from './dbs'
import { DB_LEGENDS } from './db-legends'
import { DLS, DL_TYPES } from './dls'
import { DL_LEGENDS } from './dl-legends'

// the positions Change Position offers, in the game's order (OL is Coming Soon; LB isn't here)
export const FB_SAL_POS = ['qb', 'rb', 'wr', 'te', 'db', 'dl']

// A position's pool, built the way QB's is: the current players, plus the strongest 18
// all-time legends who aren't on a current roster; everyone fully rated, an average of 3+
const LEGEND_COUNT = 18
const firstOfName = (p, i, a) => a.findIndex(q => q.name === p.name) === i
function salPool(current, legends, types) {
  const rated = p => p.attrs && types.every(t => typeof p.attrs[t] === 'number')
  const avg = p => types.reduce((s, t) => s + p.attrs[t], 0) / types.length
  const names = new Set(current.map(p => p.name))
  const legs = legends
    .filter(p => rated(p) && !names.has(p.name))
    .sort((a, b) => (avg(b) - avg(a)) || a.name.localeCompare(b.name))
    .filter(firstOfName)   // multi-team legends: their strongest entry
    .slice(0, LEGEND_COUNT)
    .map(p => ({ ...p, legend: true }))
  return [...current.filter(rated), ...legs].filter(p => avg(p) >= 3.0).filter(firstOfName)
}

// One pick per column; together a position's five columns cover all nine of its traits
export const FB_SAL = {
  qb: { label: 'QB', types: TYPES, pool: QB_SAL_POOL, cols: QB_SAL_COLS },
  rb: { label: 'RB', types: RB_TYPES, pool: salPool(RBS, RB_LEGENDS, RB_TYPES), cols: [
    { key: 'speed',   label: 'SPEED',   types: ['speed', 'burst'] },
    { key: 'power',   label: 'POWER',   types: ['strength', 'size'] },
    { key: 'elusive', label: 'ELUSIVE', types: ['elusiveness', 'balance'] },
    { key: 'vision',  label: 'VISION',  types: ['vision'] },
    { key: 'hands',   label: 'HANDS',   types: ['hands', 'carrying'] },
  ] },
  wr: { label: 'WR', types: WR_TYPES, pool: salPool(WRS, WR_LEGENDS, WR_TYPES), cols: [
    { key: 'speed',   label: 'SPEED',   types: ['speed', 'afterCatch'] },
    { key: 'routes',  label: 'ROUTES',  types: ['routeRunning', 'release'] },
    { key: 'hands',   label: 'HANDS',   types: ['hands', 'bodyControl'] },
    { key: 'mentals', label: 'MENTALS', types: ['awareness'] },
    { key: 'size',    label: 'SIZE',    types: ['size', 'vertical'] },
  ] },
  te: { label: 'TE', types: TE_TYPES, pool: salPool(TES, TE_LEGENDS, TE_TYPES), cols: [
    { key: 'speed',    label: 'SPEED',    types: ['speed', 'afterCatch'] },
    { key: 'routes',   label: 'ROUTES',   types: ['routeRunning', 'awareness'] },
    { key: 'hands',    label: 'HANDS',    types: ['hands'] },
    { key: 'blocking', label: 'BLOCKING', types: ['blocking', 'strength'] },
    { key: 'size',     label: 'SIZE',     types: ['size', 'vertical'] },
  ] },
  db: { label: 'DB', types: DB_TYPES, pool: salPool(DBS, DB_LEGENDS, DB_TYPES), cols: [
    { key: 'speed',    label: 'SPEED',    types: ['speed', 'fluidity'] },
    { key: 'coverage', label: 'COVERAGE', types: ['manCoverage', 'press'] },
    { key: 'hands',    label: 'HANDS',    types: ['hands'] },
    { key: 'mentals',  label: 'MENTALS',  types: ['zoneIQ', 'playRecognition'] },
    { key: 'tackling', label: 'TACKLING', types: ['runSupport', 'size'] },
  ] },
  // Size, from the bio, is its own column: that pick decides whether the build plays edge or tackle
  dl: { label: 'DL', types: DL_TYPES, pool: salPool(DLS, DL_LEGENDS, DL_TYPES), cols: [
    { key: 'getoff',  label: 'GET OFF',  types: ['getOff', 'speed'] },
    { key: 'power',   label: 'POWER',    types: ['powerMoves', 'strength'] },
    { key: 'finesse', label: 'FINESSE',  types: ['finesseMoves', 'bend'] },
    { key: 'runstop', label: 'RUN STOP', types: ['blockShed', 'playRecognition'] },
    { key: 'size',    label: 'SIZE',     types: ['size'] },
  ] },
}
export const fbSalFor = pos => FB_SAL[pos] ?? FB_SAL.qb
