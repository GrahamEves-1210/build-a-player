// Baseball's kits for the live server's checks: Compete's scoring (lib/competeCore.js) and the season check
// before a board row is saved (lib/verifyCore.js). Importing this file adds them. Its own file so baseball's
// rosters and season sim stay out of the other sports' bundles: competeCore and verifyCore are in every app's.
// The live worker imports it (live/src/compete.js, live/src/submit.js); the baseball app doesn't need it.
//
// The kits are BaseballApp.jsx's: a batter's or a pitcher's ten traits (BAT_TYPES / PIT_TYPES), the OVR the
// build screen shows (calcBaseballOVR with the position), and the spins dealt from the same rosters and clubs
// the spin screen gets: 'current' = the 2026 rosters, 'alltime' = the franchise legends, the 30 clubs for both.
// Salary Cap's kit (batters only: 'baseball-bat') is the board's: data/mlb-salary.js.

import { addCompeteKit } from './competeCore'
import { addSeasonKit, addSalaryKit } from './verifyCore'
import { MLB_SAL_POOL, MLB_SAL_COLS, mlbSalTypesFor, mlbSalBuild, mlbSalStats } from '../data/mlb-salary'
import { calcBaseballOVR } from '../utils/baseballSimulation'
import { BAT_TYPES, PIT_TYPES } from '../data/mlb-attrs'
import { MLB_TEAMS } from '../data/mlb-teams'
import { MLB_BATTERS } from '../data/mlb-batters'
import { MLB_PITCHERS } from '../data/mlb-pitchers'
import { MLB_LEGEND_BATTERS } from '../data/mlb-legend-batters'
import { MLB_LEGEND_PITCHERS } from '../data/mlb-legend-pitchers'

const POOLS = { bat: { current: MLB_BATTERS, alltime: MLB_LEGEND_BATTERS }, pit: { current: MLB_PITCHERS, alltime: MLB_LEGEND_PITCHERS } }
const TYPES = { bat: BAT_TYPES, pit: PIT_TYPES }
// the app's game modes ('classic' / 'all-time') or the pool keys ('current' / 'alltime')
const poolOf = mode => (mode === 'all-time' || mode === 'alltime' ? 'alltime' : 'current')
const kit = (pos, mode) => {
  if (pos !== 'bat' && pos !== 'pit') return null
  const types = TYPES[pos]
  return { pool: POOLS[pos][poolOf(mode)], types, teams: MLB_TEAMS, ovr: b => calcBaseballOVR(b, types, pos) }
}
export const BASEBALL_KITS = { kit }

// Compete: a batter's or a pitcher's pool (competeCore hands over 'current' or 'alltime' once
// COMPETE_POS / COMPETE_MODES list baseball: the Compete agent's switch)
addCompeteKit('baseball', (pos, mode) => kit(pos, mode))
// A season: 'classic' / 'all-time' as BaseballApp saves it (lib/submit.js saveSeason('baseball', 'bat' | 'pit', gameMode))
addSeasonKit('baseball', (pos, mode) => (mode == null || ['classic', 'all-time', 'current', 'alltime'].includes(mode) ? kit(pos, mode) : null))

// Salary Cap (BaseballSalaryCap.jsx buildFromSel + calcStats): batters only, one board a day like basketball's.
// Each column's two traits at the player's real ratings make the whole batter, scored with calcBaseballOVR; the stat
// line (the boards' tiebreak) is each column's best card rating. There is no pitcher kit, so a 'pit' play is turned
// away ('unknown sport'). (The tables have no position column: supabase/baseball_salary.sql.)
addSalaryKit('baseball-bat', {
  cols: MLB_SAL_COLS, pool: MLB_SAL_POOL, typesFor: mlbSalTypesFor,
  score: (real, row) => {
    const st = mlbSalStats(MLB_SAL_COLS.map((col, ci) => Math.max(...col.types.map(t => real[ci].attrs?.[t] ?? 5))))
    const ovr = Math.max(0, Math.min(99, Math.round(calcBaseballOVR(mlbSalBuild(real), BAT_TYPES, 'bat') ?? 0)))
    return { ...row, overall_score: ovr, hr: st.hr, rbi: st.rbi }
  },
})
