// Soccer's kits for the live server's checks: Compete's scoring (lib/competeCore.js) and the
// season check before a board row is saved (lib/verifyCore.js). Importing this file adds them.
// Its own file so soccer's rosters and season sim stay out of football's and basketball's
// bundles: competeCore and verifyCore are in every app's. The live worker imports it
// (live/src/compete.js, live/src/submit.js); the soccer app doesn't need it.
//
// The kits are SoccerApp.jsx's: the striker's ten traits (SOCCER_TYPES), the OVR the season page
// shows (calcSoccerOVR), and the pool's spins dealt from the same rosters and teams the spin
// screen gets (SoccerApp TEAMS_OF / POOL_PLAYERS): 'current' = TOP DIVISIONS (the clubs' players),
// 'alltime' = WORLD CUP (the nations').

import { addCompeteKit } from './competeCore'
import { addSeasonKit, addSalaryKit } from './verifyCore'
import { SOCCER_SAL_POOL, SOCCER_SAL_COLS, soccerSalTypesFor, soccerSalBuild, soccerSalStats } from '../data/soccer-salary'
import { calcSoccerOVR } from '../utils/soccerSimulation'
import { SOCCER_TYPES } from '../data/soccer-attrs'
import { SOCCER_STRIKERS, WC_STRIKERS } from '../data/soccer-strikers'
import { SOCCER_CLUBS } from '../data/soccer-clubs'
import { WC_NATIONS } from '../data/soccer-nations'

const ovr = b => calcSoccerOVR(b, SOCCER_TYPES)
export const SOCCER_KITS = {
  current: { pool: SOCCER_STRIKERS, types: SOCCER_TYPES, teams: SOCCER_CLUBS, ovr },
  alltime: { pool: WC_STRIKERS, types: SOCCER_TYPES, teams: WC_NATIONS, ovr },
}
// the app's game modes ('classic' / 'all-time') or the pool keys ('current' / 'alltime')
const poolOf = mode => (mode === 'all-time' || mode === 'alltime' ? 'alltime' : 'current')

// Compete: the striker only (GK is locked); competeCore hands over 'current' or 'alltime'
addCompeteKit('soccer', (pos, mode) => (pos === 'st' ? SOCCER_KITS[poolOf(mode)] : null))
// A season: 'classic' / 'all-time' as SoccerApp saves it (lib/submit.js saveSeason('soccer', 'st', gameMode))
addSeasonKit('soccer', (pos, mode) => (pos === 'st' && (mode == null || ['classic', 'all-time', 'current', 'alltime'].includes(mode)) ? SOCCER_KITS[poolOf(mode)] : null))

// Salary Cap (SoccerSalaryCap.jsx buildFromSel + calcStats): each column's two traits at the
// player's real ratings make the whole striker; the stat line is each column's best card rating
addSalaryKit('soccer', {
  cols: SOCCER_SAL_COLS, pool: SOCCER_SAL_POOL, typesFor: soccerSalTypesFor,
  score: (real, row) => {
    const st = soccerSalStats(SOCCER_SAL_COLS.map((col, ci) => Math.max(...col.types.map(t => real[ci].attrs?.[t] ?? 5))))
    return { ...row, overall_score: Math.round(ovr(soccerSalBuild(real)) ?? 0), goals: st.goals, assists: st.assists }
  },
})
