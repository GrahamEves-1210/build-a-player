// CAREER: one player, a whole career. Build → the draft → seasons played game
// by game (the season director runs each one, so the moments and decisions of
// a normal season are all here) → the offseason (growth, a development point,
// contracts, free agency, surprises) → legacy. Plain data, saved on every
// change (localStorage, per account), so a career can be left and picked up
// mid-season. Football and basketball run on the same engine: everything that
// differs lives in SPORT below. Screens: components/app/AppCareer.jsx.

import { dashTarget, dashTypical, benchTypical, coneShift } from './mg/combineNorms.js'
import { seeded } from './rng'
import { traitValue, pickMomentGame } from './minigames'
import { momentSituation, finalScore } from './situations'
import { queueCloudSave, fetchCloudCareer, deleteCloudCareer } from './careerCloud'
import { createDirector } from './seasonDirector'
import {
  runSimulation, runRBSimulation, runWRSimulation, runTESimulation, runDBSimulation, runDLSimulation, runLBSimulation, runOLSimulation,
  calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVRDL, calcOVRLB, calcOVROL, dlBuildSpot, olBuildSpot,
  calcMVPResult, calcOPOYResult, calcWROPOYResult, calcTEOPOYResult, calcDBDpoyResult, calcDLDpoyResult, calcLBDpoyResult, valToGrade, nflHeadshot, HEADSHOT_BASE, snapNFL,
} from '../utils/simulation'
import { runBucketSimulation, calcBucketOVR, TEAM_RATINGS as NBA_RATINGS } from '../utils/bucketSimulation'
import { TYPES, ATTR, QBS, QB_PHYSICALS } from '../data/qbs'
import { RB_TYPES, RB_ATTR, RBS } from '../data/rbs'
import { WR_TYPES, WR_ATTR, WRS } from '../data/wrs'
import { TE_TYPES, TE_ATTR, TES } from '../data/tes'
import { DB_TYPES, DB_ATTR, DBS } from '../data/dbs'
import { DL_TYPES, DL_ATTR, DLS, dlSizeGrade } from '../data/dls'
import { OLS, OL_ATTR_WEIGHT, olOVR, OL_TYPES, OL_ATTR, OL_POS_BY_NAME } from '../data/ols'
import { OL_LEGENDS } from '../data/ol-legends'
import { OL_LIVE } from './olLive'
import { ladderWindow, closedLine, lateLine, mindTraits, lowLabel, andList, LADDER } from './ageLadder'
import HEADSHOTS from '../data/headshots.json'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
import { NFL_TEAMS } from '../data/nfl-teams'
import { NBA_TEAMS } from '../data/nba-teams'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs'
import { BUCKET_ATTR } from '../data/nba-attrs'
import { BIRTH } from '../data/player-ages'
import { LEGENDS, QB_LEGEND_PHYSICALS } from '../data/qb-legends'
import { RB_LEGENDS, RB_LEGEND_PHYSICALS } from '../data/rb-legends'
import { WR_LEGENDS, WR_LEGEND_PHYSICALS } from '../data/wr-legends'
import { TE_LEGENDS } from '../data/te-legends'
import { DB_LEGENDS } from '../data/db-legends'
import { DL_LEGENDS } from '../data/dl-legends'
import { LB_TYPES, LB_ATTR, LBS, lbSizeGrade, LB_LIVE } from '../data/lbs'
import { LB_LEGENDS } from '../data/lb-legends'
import { NBA_ALLTIME_GUARD_PLAYERS } from '../data/nba-guard-legends'
import { NBA_ALLTIME_BIG_PLAYERS } from '../data/nba-big-legends'
import { RESUMES } from '../data/legacy-resumes'
import { RECORDS } from './seasonFacts'
import { seasonRaw } from './careerStats'

export const CAREER_V = 1
const FIRST_SEASON = 2026
export const MAX_SEASONS = 20
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const r10 = v => Math.round(v * 10) / 10
const avgAttr = p => { const v = Object.values(p.attrs || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }
const buildOf = (types, p) => Object.fromEntries(types.map(t => [t, { val: p.attrs?.[t] ?? 5 }]))
const nick = name => (name || '').split(' ').slice(-1)[0]

// ── The sports ────────────────────────────────────────────────────────────────
const NBA_EAST = new Set(['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS'])
// the NBA's six divisions (2024-25): only a label, the schedule doesn't use them
const NBA_DIV = Object.fromEntries(Object.entries({
  Atlantic: ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'], Central: ['CHI', 'CLE', 'DET', 'IND', 'MIL'], Southeast: ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'],
  Northwest: ['DEN', 'MIN', 'OKC', 'POR', 'UTA'], Pacific: ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'], Southwest: ['DAL', 'HOU', 'MEM', 'NOP', 'SAS'],
}).flatMap(([d, list]) => list.map(t => [t, d])))
const NFL_POS_TYPES = { qb: TYPES, rb: RB_TYPES, wr: WR_TYPES, te: TE_TYPES, db: DB_TYPES, dl: DL_TYPES, lb: LB_TYPES, ol: OL_TYPES }
const NFL_OVR = { qb: b => calcOVR(b, TYPES), rb: b => calcOVRRB(b, RB_TYPES), wr: b => calcOVRWR(b, WR_TYPES), te: b => calcOVRTE(b, TE_TYPES), db: b => calcOVRDB(b, DB_TYPES), dl: b => calcOVRDL(b, DL_TYPES), lb: b => calcOVRLB(b, LB_TYPES), ol: b => calcOVROL(b, OL_TYPES) }
const NFL_AWARD = { qb: calcMVPResult, rb: calcOPOYResult, wr: calcWROPOYResult, te: calcTEOPOYResult, db: calcDBDpoyResult, dl: calcDLDpoyResult, lb: calcLBDpoyResult }
// A career DB keeps DB_PICK_KEEP of the sim's interceptions (the rest are broken up: a pass
// defensed). Fifteen years at the sim's rate ran an elite DB to 90-119 picks, past the real
// record (81); now about 70-85. Career only: the other modes keep the sim as it is.
// Coverage: each game also gets the throws at him (tgtA), completions (cmpA), yards (ydsA)
// and touchdowns (tdA) allowed, from his coverage grades and that game's own PBUs and picks.
// No dice: every number here comes from a hash of the game and the build (`unit`), so the
// sim's own draws, and every seeded run, are exactly what they were.
export const DB_PICK_KEEP = 0.8
const covGrade = b => { const v = t => b?.[t]?.val ?? 5; return clamp((v('manCoverage') * 0.3 + v('zoneIQ') * 0.2 + v('fluidity') * 0.2 + v('speed') * 0.15 + v('press') * 0.15 - 4) / 7, 0, 1) }
function careerPicks(r, b) {
  const q = covGrade(b), safety = b?.size?.subpos === 's'
  const bk = DB_TYPES.map(t => b?.[t]?.val ?? 0).join('')
  const games = r.games.map(g => {
    const key = `${bk}|${g.wk}|${g.opponent}|${g.mySc}|${g.oppSc}|${g.ints ?? 0}|${g.pbus ?? 0}|${g.tackles ?? 0}`
    let ints = 0
    for (let i = 0; i < (g.ints ?? 0); i++) if (unit(`${key}-pk${i}`) < DB_PICK_KEEP) ints++
    const pbus = (g.pbus ?? 0) + (g.ints ?? 0) - ints
    // the throws his way: fewer at a lockdown corner (a safety sees fewer still), more on a busy day
    const tgtA = Math.max(pbus + ints + 1, Math.round(((5.2 - 1.6 * q) * (safety ? 0.72 : 1)) + 0.35 * (pbus + ints) + (unit(`${key}-t`) - 0.5) * 2.4))
    const open = tgtA - pbus - ints
    const cmpA = clamp(Math.round(open * (0.8 - 0.04 * q + (unit(`${key}-c`) - 0.5) * 0.16)), 0, open)
    const ydsA = Math.round(cmpA * Math.max(5, 15.5 - 2.5 * q + (unit(`${key}-y`) - 0.5) * 4))
    const tdA = Math.floor(cmpA * (0.075 - 0.035 * q) + unit(`${key}-d`))
    return { ...g, ints, pickSixes: Math.min(g.pickSixes ?? 0, ints), pbus, tgtA, cmpA, ydsA, tdA }
  })
  const sum = k => games.reduce((t, g) => t + (g[k] ?? 0), 0)
  return { ...r, games, seasonINTs: sum('ints'), seasonPickSixes: sum('pickSixes'), seasonPBUs: sum('pbus'), seasonTgtA: sum('tgtA'), seasonCmpA: sum('cmpA'), seasonYdsA: sum('ydsA'), seasonTdA: sum('tdA') }
}
// A DB's season, judged on coverage: passes defended (PBUs + picks), the picks, the passer
// rating thrown at him and some tackling. A lockdown corner's year (2-3 picks, ~20 PD,
// a rating in the 50s) sits right at the All-Pro bar; a ball hawk's 8-pick year about the same. Picks still count, they
// just aren't the whole case. (No rating on record, from a season begun before these: neutral.)
export function dbCoverage(s, c = null) {
  const pd = (s.pbus ?? 0) + (s.ints ?? 0), safety = !!c && dbSpot(c) === 's'
  return 0.5 * Math.min(1.25, pd / 22) + 0.08 * Math.min(1.25, (s.ints ?? 0) / 7) + 0.42 * (s.rtgA == null ? 0.5 : clamp((105 - s.rtgA) / 50, 0, 1.2)) + 0.05 * Math.min(1, (s.tackles ?? 0) / (safety ? 110 : 85))
}
// the DPOY case: the coverage, plus a shutdown premium for a low rating and few yards (a
// Surtain year can win it on that)
export const dbDpoyCase = (s, c = null) => dbCoverage(s, c) + (s.rtgA == null ? 0 : 0.4 * clamp((60 - s.rtgA) / 20, 0, 1) + 0.15 * clamp((450 - (s.ydsA ?? 450)) / 100, 0, 1))
// a season past a real record (passes defended or picks) is an All-Pro, whatever else it did
const dbRecord = s => (s.pbus ?? 0) > 31 || (s.ints ?? 0) > 14
// (set so DBs win about as many honors as they did on picks alone)
export const DB_BARS = { proBowl: 0.8, allPro: 1.06, near: 0.98, dpoy: 1.76, spread: 0.1 }
// passer rating allowed, the NFL formula on the throws at him (null: no throws on record)
export const ratingAllowed = st => {
  const att = st.tgtA ?? 0
  if (!att) return null
  const k = x => clamp(x, 0, 2.375)
  const sum = k(((st.cmpA ?? 0) / att - 0.3) * 5) + k(((st.ydsA ?? 0) / att - 3) * 0.25) + k(((st.tdA ?? 0) / att) * 20) + k(2.375 - ((st.ints ?? 0) / att) * 25)
  return Math.round((sum / 6) * 1000) / 10
}
const olScore = p => Object.entries(OL_ATTR_WEIGHT).reduce((s, [k, w]) => s + (p.attrs?.[k] ?? 5) * w, 0) / Object.values(OL_ATTR_WEIGHT).reduce((a, b) => a + b, 0)

// ── An offensive lineman's career ────────────────────────────────────────────
// His spot (LT, LG, C, RG, RT) is his build's Size chip, like a DL's edge or tackle.
export const OL_SPOTS = ['LT', 'LG', 'C', 'RG', 'RT']
export const olSpot = c => { const s = olBuildSpot(c?.build); return OL_SPOTS.includes(s) ? s : 'LT' }
export const OL_SPOT_NAME = { LT: 'LEFT TACKLE', LG: 'LEFT GUARD', C: 'CENTER', RG: 'RIGHT GUARD', RT: 'RIGHT TACKLE' }
const olGroup = sp => (sp === 'C' ? 'center' : sp === 'LG' || sp === 'RG' ? 'guard' : 'tackle')
// (on the player, else from the OL data by name)
const olSlotOf = p => (OL_SPOTS.includes(p?.slot) ? p.slot : OL_POS_BY_NAME[p?.name] ?? null)
// The men around him move his line, with no dice (a hash of the game and the build, like a DB's
// coverage): sacks are partly the quarterback's (one who gets rid of it fast turns fewer pressures
// into sacks, one who holds it more), and a weak line beside him draws the stunts and games his way.
// t.olQB / t.olLine: the fit's grades (0-11), carried on the team the sim plays (simTeam).
const OL_SACK_QB = q => clamp(1 + (6 - q) * 0.07, 0.65, 1.45)
const OL_PRS_LINE = l => clamp(1 + (6 - l) * 0.03, 0.85, 1.18)
function careerLine(r, b, t) {
  if (t?.olQB == null) return r
  const qM = OL_SACK_QB(t.olQB), lM = OL_PRS_LINE(t.olLine ?? 6)
  const bk = OL_TYPES.map(x => b?.[x]?.val ?? 0).join('')
  const games = r.games.map(g => {
    const key = `ol|${bk}|${g.wk}|${g.opponent}|${g.mySc}|${g.oppSc}|${g.pressures ?? 0}|${g.sacks ?? 0}|${g.pancakes ?? 0}`
    const pressures = Math.max(0, Math.floor((g.pressures ?? 0) * lM + unit(`${key}-p`)))
    const sacks = clamp(Math.floor((g.sacks ?? 0) * qM + unit(`${key}-s`)), 0, pressures)
    return { ...g, pressures, sacks, qbHits: Math.min(g.qbHits ?? 0, pressures - sacks) }
  })
  const sum = k => games.reduce((s, g) => s + (g[k] ?? 0), 0)
  return { ...r, games, seasonPressures: sum('pressures'), seasonSacksAllowed: sum('sacks'), seasonQBHits: sum('qbHits'), seasonPenalties: sum('penalties'), seasonPancakes: sum('pancakes'), seasonHolding: sum('holding'), seasonFalseStarts: sum('falseStarts'), seasonSnaps: sum('snaps') }
}
// PFF-style 0-100 grades from what he allowed and finished (the sim's formula, utils/simulation.js
// olSeasonGrades, without its noise: a booked season always grades the same)
export function olGrades({ prs = 0, sacksA = 0, pen = 0, pancakes = 0, snaps = 0, rbwr = 70 }) {
  const g = v => Math.round(clamp(v, 30, 95) * 10) / 10
  const sets = Math.max(1, (snaps || 1100) * 0.58)
  const passGrade = g(100 - 5.4 * (prs / sets) * 100 - 1.2 * sacksA)
  const runGrade = g(40 + (rbwr - 60) * 1.75 + Math.min(10, pancakes / 6))
  return { passGrade, runGrade, grade: g(passGrade * 0.6 + runGrade * 0.4 - Math.max(0, pen - 5) * 0.8) }
}
// A lineman's season, from the games he played (a backup's bench weeks count for nothing)
function olSeason(f) {
  const played = (f.games ?? []).filter(g => !g.sat)
  const sum = (k, all) => (f.games ? played.reduce((s, g) => s + (g[k] ?? 0), 0) : all ?? 0)
  const st = { sacksA: sum('sacks', f.seasonSacksAllowed), prs: sum('pressures', f.seasonPressures), pancakes: sum('pancakes', f.seasonPancakes), pen: sum('penalties', f.seasonPenalties), hitsA: sum('qbHits', f.seasonQBHits), holding: sum('holding', f.seasonHolding), falseStarts: sum('falseStarts', f.seasonFalseStarts), snaps: sum('snaps', f.seasonSnaps), starts: f.games ? played.length : 17 }
  return { ...st, ...(st.starts ? olGrades({ ...st, rbwr: f.seasonRBWR ?? 70 }) : {}) }
}
// The honors (a First-Team All-Pro is the top of it: there's no lineman of the year), judged on the
// grade with the sacks and the flags as a check. An elite year (85-92, 0-2 sacks) is an All-Pro, a good one (80-84) a Pro Bowl.
// (set so an elite career lands about 13 Pro Bowls and 6 All-Pros, a good one 8 and 2: like a DL's, where the awards also count)
export const OL_BARS = { proBowl: 80.5, allPro: 85, near: 83 }
const olProBowl = s => (s.grade ?? 0) >= OL_BARS.proBowl && (s.sacksA ?? 99) <= 5
const olAllPro = s => (s.grade ?? 0) >= OL_BARS.allPro && (s.sacksA ?? 99) <= 3 && (s.pen ?? 99) <= 7
// (no MVP, OPOY or DPOY for a lineman: All-Pro is his trophy, so it counts as such on the screens, never twice in the legacy)
export const OL_FIRST_BONUS = 10, OL_START_LEGACY = 0.2

export const SPORT = {
  nfl: {
    id: 'nfl', league: 'NFL', isBucket: false, screen: 'ag-screen--nfl',
    teams: NFL_TEAMS, logo: s => `/logos/${s}.png`,
    // a team as the career sees it: off / def on a 1–10 scale
    teamOf: short => { const t = NFL_TEAMS.find(x => x.short === short) ?? NFL_TEAMS[0]; return { short: t.short, name: t.name, color: t.color, color2: t.color2, off: t.off, def: t.def, conf: t.conf, div: t.div } },
    status: core => (core >= 7 ? 'Contender' : core >= 5.5 ? 'In the mix' : 'Rebuilding'),
    // the career positions, and which side of the ball each plays
    // (an OL career plays inside the 'ol' group every team already keeps: no new roster group, so nobody else's roster moves)
    positions: ['qb', 'rb', 'wr', 'te', 'db', 'dl', ...(LB_LIVE ? ['lb'] : []), ...(OL_LIVE ? ['ol'] : [])],   // LB_LIVE: data/lbs.js, OL_LIVE: lib/olLive.js
    side: { qb: 'off', rb: 'off', wr: 'off', te: 'off', db: 'def', dl: 'def', lb: 'def', ol: 'off' },
    label: { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB', dl: 'DL', lb: 'LB', ol: 'OL' }, posName: { qb: 'Quarterback', rb: 'Running back', wr: 'Wide receiver', te: 'Tight end', db: 'Defensive back', dl: 'Defensive lineman', lb: 'Linebacker', ol: 'Offensive lineman' },
    types: NFL_POS_TYPES, attr: { qb: ATTR, rb: RB_ATTR, wr: WR_ATTR, te: TE_ATTR, db: DB_ATTR, dl: DL_ATTR, lb: LB_ATTR, ol: OL_ATTR },
    pool: { qb: QBS, rb: RBS, wr: WRS, te: TES, ol: OLS, db: DBS, dl: DLS, lb: LBS },
    // every roster group a team keeps: the offense, then the defense
    // (dl, then lb, stay last: rosters are dealt in this order from one seeded stream, so everyone else's come out the same)
    // (lb only once LB is live: before then no roster, formation or fit shows a linebacker)
    groups: ['qb', 'rb', 'wr', 'te', 'ol', 'db', 'dl', ...(LB_LIVE ? ['lb'] : [])], starters: { qb: 1, rb: 1, wr: 3, te: 1, ol: 5, db: 4, dl: 4, lb: 3 }, keep: { qb: 2, rb: 2, wr: 4, te: 2, ol: 5, db: 5, dl: 5, lb: 4 },
    slots: { ol: ['LT', 'LG', 'C', 'RG', 'RT'] },
    depthLabel: (pos, i) => `${({ qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB', dl: 'DL', lb: 'LB', ol: 'OL' })[pos]}${i}`,
    ovr: (pos, b) => NFL_OVR[pos]?.(b) ?? 0,
    realOvr: (pos, p) => Math.round(pos === 'ol' ? (olOVR(p.attrs) ?? 72) : (p.ovr ?? NFL_OVR[pos](buildOf(NFL_POS_TYPES[pos], p)))),
    photo: name => (HEADSHOTS[name] ? nflHeadshot(HEADSHOTS[name]) : null),
    sim: pos => ({ qb: (b, t) => runSimulation(b, TYPES, t, false), rb: (b, t) => runRBSimulation(b, RB_TYPES, t, false), wr: (b, t) => runWRSimulation(b, WR_TYPES, t, false), te: (b, t) => runTESimulation(b, TE_TYPES, t, false), db: (b, t) => careerPicks(runDBSimulation(b, t, false), b), dl: (b, t) => runDLSimulation(b, t, false), lb: (b, t) => runLBSimulation(b, t, false), ol: (b, t) => careerLine(runOLSimulation(b, t, false), b, t) })[pos],
    // what the sim plays against: the team, its offense moved by the fit and the year's events
    // the pieces around you move your side of the ball: the offense for a skill player, the defense for a DB
    // a true star (93+) lifts his side of the ball too: the sims barely let a DB or a receiver
    // move a team (a 99 DB's teams went 8-9), so a career adds it (a quarterback already carries one)
    simTeam: (t, fit, m, c) => {
      const def = SPORT.nfl.side[c?.pos] === 'def'
      const star = clamp(((c?.ovr ?? 0) - 92) / 7, 0, 1) * ({ rb: 1, wr: 1.4, te: 1, db: 3, dl: 3, lb: 3, ol: 1 }[c?.pos] ?? 0)
      // (a lineman's sim also reads the quarterback and the line beside him: careerLine)
      return { ...t, off: clamp(fit.off + (def ? 0 : fit.adj + star) + (m.off ?? 0), 1, 10), def: clamp(fit.def + (def ? fit.adj + star : 0) + (m.def ?? 0), 1, 10), ...(c?.pos === 'ol' ? { olQB: fit.qb ?? 6, olLine: fit.line ?? 6 } : {}) }
    },
    // the pieces of the offense around you, graded 0–11
    fit: (ro, pos, notMe, spot = null) => {
      // a lineman's world: the men beside him on the line (a real rush means fewer double teams),
      // then the coverage behind it (a quarterback who holds the ball is a sack)
      if (pos === 'dl') {
        const room = (ro.dl ?? []).filter(notMe)
        const mates = dlFront(room, spot)
        const rushG = r10(ovrGradeVal(avgOvr(mates)))
        const back = (ro.db ?? []).slice(0, 4), secG = r10(ovrGradeVal(avgOvr(back)))
        // what a team needs: the starters at his spot, when it's known; else the whole line
        const atSpot = spot ? room.filter(p => dlSpotOf(p) === spot).sort(byOvr).slice(0, 2) : mates
        return { groups: [{ k: 'PASS RUSH', v: rushG, names: mates.map(p => p.name) }, { k: 'SECONDARY', v: secG, names: back.map(p => p.name) }], adj: (rushG - 6) * 0.25 + (secG - 6) * 0.15, need: 11 - r10(ovrGradeVal(avgOvr(atSpot))), rush: rushG, secondary: secG }
      }
      // a linebacker's world: the front that keeps blockers off him, the man beside him, the coverage behind
      if (pos === 'lb') {
        const front = dlFront(ro.dl ?? []), frontG = r10(ovrGradeVal(avgOvr(front)))
        const mates = (ro.lb ?? []).filter(notMe).sort(byOvr).slice(0, 2), lbG = r10(ovrGradeVal(avgOvr(mates)))
        const back = (ro.db ?? []).slice(0, 4), secG = r10(ovrGradeVal(avgOvr(back)))
        return { groups: [{ k: 'PASS RUSH', v: frontG, names: front.map(p => p.name) }, { k: 'LINEBACKERS', v: lbG, names: mates.map(p => p.name) }, { k: 'SECONDARY', v: secG, names: back.map(p => p.name) }], adj: (frontG - 6) * 0.2 + (lbG - 6) * 0.1 + (secG - 6) * 0.15, need: 11 - lbG, front: frontG, secondary: secG }
      }
      // an offensive lineman's world: the four men beside him, the quarterback he protects (a quick
      // release takes sacks off him) and the backs he blocks for. Need: the man at his spot.
      if (pos === 'ol') {
        const room = (ro.ol ?? []).filter(notMe)
        const atSpot = spot ? room.filter(p => olSlotOf(p) === spot).sort(byOvr) : []
        const line = spot ? OL_SPOTS.filter(s => s !== spot).map(s => room.find(p => olSlotOf(p) === s)).filter(Boolean) : [...room].sort(byOvr).slice(0, 4)
        for (const p of [...room].sort(byOvr)) if (line.length < 4 && !line.includes(p) && !atSpot.includes(p)) line.push(p)
        const qb = (ro.qb ?? [])[0] ?? null
        const backs = [(ro.rb ?? [])[0], (ro.te ?? [])[0]].filter(Boolean)
        const lineG = r10(ovrGradeVal(avgOvr(line))), qbG = qb ? r10(ovrGradeVal(qb.ovr)) : 5, backG = r10(ovrGradeVal(avgOvr(backs)))
        const groups = [{ k: 'O-LINE', v: lineG, names: line.map(p => p.name) }, { k: 'QB', v: qbG, names: qb ? [qb.name] : [] }, { k: 'BACKFIELD', v: backG, names: backs.map(p => p.name) }]
        return { groups, adj: (lineG - 6) * 0.15 + (qbG - 6) * 0.2 + (backG - 6) * 0.1, need: 11 - (atSpot.length ? r10(ovrGradeVal(atSpot[0].ovr)) : lineG), line: lineG, qb: qbG, backs: backG }
      }
      if (SPORT.nfl.side[pos] === 'def') {
        // a DB's world: the rest of the secondary, and the pass rush in front of it (linebackers join when they're in the game)
        const mates = (ro.db ?? []).filter(notMe).sort((a, b) => b.ovr - a.ovr).slice(0, 3)
        const secG = r10(ovrGradeVal(avgOvr(mates)))
        const front = ['dl', 'lb'].filter(g => ro[g]?.length).map(g => { const men = g === 'dl' ? dlFront(ro.dl) : ro[g].slice(0, 3); return { k: g === 'dl' ? 'PASS RUSH' : 'LINEBACKERS', v: r10(ovrGradeVal(avgOvr(men))), names: men.map(p => p.name) } })
        const frontAdj = front.reduce((s, g) => s + (g.v - 6) * 0.15, 0)
        return { groups: [{ k: 'SECONDARY', v: secG, names: mates.map(p => p.name) }, ...front], adj: (secG - 6) * 0.25 + frontAdj, need: 11 - secG, secondary: secG }
      }
      const ol = ro.ol.slice(0, 5)
      const weapons = [...ro.wr, ...ro.te, ...ro.rb].filter(p => p.pos !== pos).filter(notMe).sort((a, b) => b.ovr - a.ovr).slice(0, 3)
      const qb = pos === 'qb' ? null : ro.qb.filter(notMe)[0] ?? null
      const olG = r10(ovrGradeVal(avgOvr(ol))), wpG = r10(ovrGradeVal(avgOvr(weapons))), qbG = qb ? r10(ovrGradeVal(qb.ovr)) : 5
      const groups = [...(pos !== 'qb' ? [{ k: 'QB', v: qbG, names: qb ? [qb.name] : [] }] : []), { k: 'O-LINE', v: olG, names: ol.map(p => p.name) }, { k: 'WEAPONS', v: wpG, names: weapons.map(p => p.name) }]
      const adj = pos === 'qb' ? (olG - 6) * 0.25 + (wpG - 6) * 0.25 : (qbG - 6) * 0.3 + (olG - 6) * 0.15
      const need = pos === 'qb' ? 11 - qbG : 11 - wpG
      return { groups, adj, need, ol: olG, weapons: wpG, qb: qbG }
    },
    fitNote: (f, pos) => (pos === 'ol' ? (f.qb >= 8 ? 'A quarterback who gets the ball out fast. Pressure rarely turns into a sack on him.' : f.qb < 5 ? 'A quarterback who holds the ball. Some of those sacks will land on the line.' : f.line < 5 ? 'A weak line beside him. The stunts and blitzes come at his gap.' : f.line >= 8 ? 'A real line beside him. Nobody can hide a rusher in the gaps.' : 'An honest line and an honest quarterback. He has to win his own block.') : pos === 'lb' ? (f.front >= 8 ? 'A real front keeps the guards off him. He runs free to the ball.' : f.front < 5 ? 'A soft front: the guards climb to him on every run.' : 'An honest front. He has to beat a block to make his tackles.') : pos === 'dl' ? (f.rush >= 8 ? 'Real rushers beside him mean one-on-ones and fewer double teams.' : f.rush < 5 ? 'Nobody else on the line scares a quarterback. Every slide comes his way.' : 'An honest line around him. He has to win his own matchups.') : pos === 'db' ? 'The secondary around him decides how often he is left on an island.' : pos === 'qb'
      ? (f.ol < 4.5 ? 'A bad line hurts a quarterback: sacks, hits, hurried throws.' : f.weapons >= 8 ? 'Elite weapons make a quarterback\'s numbers.' : 'A workable line and honest weapons. The quarterback decides it.')
      : (f.qb >= 8 ? 'A real quarterback feeds his weapons: targets, yards, touchdowns.' : f.qb < 5 ? 'A weak quarterback caps a skill player. Fewer good balls.' : 'A middling quarterback. The plays have to be made after the catch.')),
    physical: { qb: ['legs', 'arm'], rb: ['speed', 'burst', 'elusiveness'], wr: ['speed', 'vertical', 'afterCatch'], te: ['speed', 'vertical', 'strength'], db: ['speed', 'fluidity'], dl: ['getOff', 'speed', 'bend'], lb: ['range', 'power'], ol: ['mobility', 'anchor'] },
    // the reads: age doesn't take these (a lineman's: picking up the blitz, and keeping the flags off)
    ageless: ['processing', 'leadership', 'vision', 'pocket-presence', 'awareness', 'zoneIQ', 'playRecognition', 'blitzPickup', 'discipline'],
    finalsAward: 'SUPER BOWL MVP',
    ageShift: pos => (pos === 'qb' ? 2 : 0),
    // the physical traits train until this age (then the window shuts); the body fades from declineAt
    trainUntil: pos => ({ qb: 28, rb: 24, wr: 26, te: 26, db: 25, dl: 26, lb: 26, ol: 27 })[pos] ?? 26,
    // offseason work: 2 points a year through this age, then 1 until the body turns
    devYoung: () => 23, devPrime: pos => SPORT.nfl.declineAt(pos),
    // (linemen last: the body turns about 31-32)
    declineAt: pos => ({ qb: 33, rb: 27, wr: 30, te: 30, db: 28, dl: 30, lb: 29, ol: 32 })[pos] ?? 31,
    bigInjury: 6,
    draft: {
      rounds: 7,
      // positional value: a quarterback is slotted as if ~4 better (any 90+ goes first),
      // receivers and DBs at face value, a tight end ~2 worse, a running back ~3 worse;
      // an edge rusher ~2 better (the premium spot after quarterback), an interior lineman ~1 worse
      // (a tackle ~1 better, a guard or a center ~2 worse)
      stock: (ovr0, pos, c = null) => { if (pos === 'qb' && ovr0 >= 90) return [1, 1]; const ovr = ovr0 + (pos === 'dl' ? (c && dlSpot(c) === 'dt' ? -1 : 2) : pos === 'ol' ? (!c || olGroup(olSpot(c)) === 'tackle' ? 1 : -2) : { qb: 4, te: -2, rb: -3, lb: -1 }[pos] ?? 0); return (ovr >= 95 ? [1, 5] : ovr >= 90 ? [3, 12] : ovr >= 86 ? [8, 24] : ovr >= 82 ? [18, 45] : ovr >= 78 ? [36, 80] : ovr >= 74 ? [70, 130] : ovr >= 70 ? [110, 180] : [160, 224]) },
      rookie: o => ({ kind: 'rookie', years: 4, left: 4, perYear: o <= 5 ? 9.5 : o <= 10 ? 6.5 : o <= 16 ? 4.5 : o <= 32 ? 3.2 : o <= 64 ? 1.8 : o <= 100 ? 1.3 : 1.0, option: o <= 32 }),
      posList: ['EDGE', 'OT', 'CB', 'WR', 'QB', 'LB', 'DT', 'S', 'RB', 'TE', 'G', 'C'],
      // How much a team wants this position with this pick (1 = neutral), on top of its need:
      // a team with its quarterback doesn't spend a first on another one, and a young good
      // quarterback means the first-rounders go to his line and his receivers, not a back
      want: (ro, pos, round) => {
        const qb = ro.qb?.[0], ovr = qb?.ovr ?? 0, age = qb?.age ?? 30, starter = ro[pos]?.[0]
        const franchise = ovr >= 80 && age <= 31
        if (pos === 'qb') {
          if (franchise || (age <= 25 && ovr >= 72)) return round === 1 ? 0.01 : round <= 3 ? 0.08 : 0.4
          if (ovr < 74) return 4
          if (age >= 35) return 2.5
          return ovr >= 80 ? 0.3 : 2
        }
        if (pos === 'rb') {
          const young = ovr >= 80 && age <= 28
          let w = round === 1 && young ? 0.015 : round === 2 && young ? 0.5 : 1
          if ((starter?.ovr ?? 0) >= 84 && (starter?.age ?? 30) <= 26) w *= round === 1 ? 0.15 : 0.5
          return w
        }
        return 1
      },
    },
    combine: {
      qb: [['forty', '40-yard dash', 'legs'], ['velo', 'Throwing velocity', 'arm'], ['acc', 'Accuracy drill', 'accuracy']],
      rb: [['forty', '40-yard dash', 'speed'], ['cone', '3-cone drill', 'elusiveness'], ['bench', 'Bench press', 'strength']],
      wr: [['forty', '40-yard dash', 'speed'], ['cone', '3-cone drill', 'routeRunning'], ['gauntlet', 'Gauntlet drill', 'hands']],
      te: [['forty', '40-yard dash', 'speed'], ['bench', 'Bench press', 'strength'], ['gauntlet', 'Gauntlet drill', 'hands']],
      db: [['forty', '40-yard dash', 'speed'], ['cone', '3-cone drill', 'fluidity'], ['gauntlet', 'Ball skills drill', 'hands']],
      dl: [['forty', '40-yard dash', 'speed'], ['bench', 'Bench press', 'strength'], ['cone', '3-cone drill', 'bend']],
      lb: [['forty', '40-yard dash', 'range'], ['bench', 'Bench press', 'power'], ['gauntlet', 'Coverage drill', 'zoneInstincts']],
      ol: [['forty', '40-yard dash', 'mobility'], ['bench', 'Bench press', 'anchor'], ['cone', '3-cone drill', 'mobility']],
    },
    goals: {
      qb: ovr => [['passYds', 'Throw for', ovr >= 90 ? 4000 : ovr >= 82 ? 3500 : 3000, 'yards'], ['tds', 'Throw', ovr >= 90 ? 30 : ovr >= 82 ? 24 : 18, 'TDs'], ['wins', 'Win', ovr >= 90 ? 11 : ovr >= 82 ? 9 : 7, 'games']],
      rb: ovr => [['rushYds', 'Rush for', ovr >= 90 ? 1300 : ovr >= 82 ? 1000 : 750, 'yards'], ['tds', 'Score', ovr >= 90 ? 13 : ovr >= 82 ? 9 : 6, 'TDs'], ['wins', 'Win', ovr >= 90 ? 10 : 8, 'games']],
      wr: ovr => [['recYds', 'Catch', ovr >= 90 ? 1300 : ovr >= 82 ? 1000 : 750, 'yards'], ['tds', 'Score', ovr >= 90 ? 11 : ovr >= 82 ? 8 : 5, 'TDs'], ['recs', 'Make', ovr >= 90 ? 95 : ovr >= 82 ? 75 : 55, 'catches']],
      db: ovr => [['ints', 'Pick off', ovr >= 90 ? 6 : ovr >= 82 ? 4 : 2, 'passes'], ['pbus', 'Defend', ovr >= 90 ? 18 : ovr >= 82 ? 13 : 9, 'passes'], ['tackles', 'Make', ovr >= 90 ? 75 : ovr >= 82 ? 62 : 50, 'tackles']],
      // (a tackle's sacks are not an edge's: 8 from inside is a big year)
      dl: (ovr, c) => { const dt = c && dlSpot(c) === 'dt'; return [['sacks', 'Get', dt ? (ovr >= 90 ? 8 : ovr >= 82 ? 5 : 3) : (ovr >= 90 ? 13 : ovr >= 82 ? 9 : 6), 'sacks'], ['tfl', 'Make', dt ? (ovr >= 90 ? 12 : ovr >= 82 ? 8 : 5) : (ovr >= 90 ? 16 : ovr >= 82 ? 11 : 8), 'TFL'], ['tackles', 'Make', ovr >= 90 ? 50 : ovr >= 82 ? 42 : 34, 'tackles']] },
      lb: ovr => [['tackles', 'Make', ovr >= 90 ? 140 : ovr >= 82 ? 115 : 90, 'tackles'], ['tfl', 'Make', ovr >= 90 ? 11 : ovr >= 82 ? 8 : 5, 'TFL'], ['ints', 'Pick off', ovr >= 90 ? 3 : ovr >= 82 ? 2 : 1, 'passes']],
      // (a lineman's goal can be a ceiling: `low`, at most this many)
      ol: ovr => [['sacksA', 'Allow at most', ovr >= 90 ? 2 : ovr >= 82 ? 4 : 6, 'sacks', true], ['pancakes', 'Make', ovr >= 90 ? 45 : ovr >= 82 ? 35 : 25, 'pancakes'], ['grade', 'Grade out at', ovr >= 90 ? 85 : ovr >= 82 ? 76 : 66, 'or better']],
      te: ovr => [['recYds', 'Catch', ovr >= 90 ? 1000 : ovr >= 82 ? 750 : 550, 'yards'], ['tds', 'Score', ovr >= 90 ? 9 : ovr >= 82 ? 6 : 4, 'TDs'], ['recs', 'Make', ovr >= 90 ? 80 : ovr >= 82 ? 60 : 45, 'catches']],
    },
    seasonStats: (pos, f) => pos === 'qb'
      ? { passYds: f.seasonPassYds, tds: f.seasonTDs, ints: f.seasonINTs, rating: f.seasonRating, rushYds: f.seasonRushYds, rushTDs: f.seasonRushTDs ?? 0, compPct: f.seasonCompPct }
      : pos === 'db' ? { ints: f.seasonINTs, pbus: f.seasonPBUs, tackles: f.seasonTackles, tfl: f.seasonTFL, ff: f.seasonFF, pickSixes: f.seasonPickSixes, ...(f.seasonTgtA ? { tgtA: f.seasonTgtA, cmpA: f.seasonCmpA, ydsA: f.seasonYdsA, tdA: f.seasonTdA, rtgA: ratingAllowed({ tgtA: f.seasonTgtA, cmpA: f.seasonCmpA, ydsA: f.seasonYdsA, tdA: f.seasonTdA, ints: f.seasonINTs }) } : {}) }
      : pos === 'dl' ? { sacks: f.seasonSacks, tfl: f.seasonTFL, tackles: f.seasonTackles, qbHits: f.seasonQBHits, ff: f.seasonFF, fr: f.seasonFR, pbus: f.seasonPBUs, safeties: f.seasonSafeties }
      : pos === 'ol' ? olSeason(f)
      : pos === 'lb' ? { tackles: f.seasonTackles, tfl: f.seasonTFL, sacks: f.seasonSacks, qbHits: f.seasonQBHits, pds: f.seasonPDs, ints: f.seasonINTs, ff: f.seasonFF, fr: f.seasonFR, pickSixes: f.seasonPickSixes }
      : pos === 'rb' ? { rushYds: f.seasonRushYds, tds: (f.seasonRushTDs ?? 0) + (f.seasonRecTDs ?? 0), recYds: f.seasonRecYds, ypc: f.seasonYPC, fumbles: f.seasonFumbles }
      : { recs: f.seasonRecs, recYds: f.seasonRecYds, tds: f.seasonRecTDs, ypr: f.seasonYPR },
    rateKeys: ['rating', 'compPct', 'ypc', 'ypr', 'rtgA', 'grade', 'passGrade', 'runGrade'],     // per-game rates: never summed into career totals
    averages: null,
    headline: { qb: ['passYds', 'tds', 'ints'], rb: ['rushYds', 'tds', 'recYds'], wr: ['recs', 'recYds', 'tds'], te: ['recs', 'recYds', 'tds'], db: ['ints', 'pbus', 'tackles'], dl: ['sacks', 'tfl', 'tackles'], lb: ['tackles', 'sacks', 'ints'], ol: ['sacksA', 'pancakes', 'grade'] },
    // (a lineman has no season award: his slot is the All-Pro team, shown as his trophy; s.award stays false)
    awardName: { qb: 'MVP', rb: 'OPOY', wr: 'OPOY', te: 'OPOY', db: 'DPOY', dl: 'DPOY', lb: 'DPOY', ol: 'ALL-PRO' },
    honor: 'Pro Bowl', honors: 'PRO BOWLS', first: 'All-Pro',
    // games played to be considered (of 17): the award and All-Pro 12, the Pro Bowl 9
    minGames: { award: 12 / 17, first: 12 / 17, honor: 9 / 17 },
    // the numbers that get a player there (a lineman by his spot: c is the career)
    // (RB and TE raised: their careers piled up 12-16 Pro Bowls, 9-13 All-Pros and 3-4 OPOYs, about twice the real greats)
    proBowl: { qb: s => s.tds >= 30 || s.passYds >= 4300, rb: s => s.rushYds >= 1300 || (s.rushYds >= 1100 && s.tds >= 12), wr: s => s.recYds >= 1200 || s.tds >= 10, te: s => s.recYds >= 1050 || (s.recYds >= 900 && s.tds >= 11), db: (s, c) => dbCoverage(s, c) >= DB_BARS.proBowl || dbRecord(s), dl: (s, c) => (dlSpot(c) === 'dt' ? s.sacks >= 7 || (s.sacks >= 5 && s.tfl >= 11) : s.sacks >= 11 || (s.sacks >= 9 && s.tfl >= 15)), lb: s => s.tackles >= 125 || (s.tackles >= 105 && (s.ints >= 3 || s.sacks >= 5)), ol: olProBowl },
    allPro: { db: (s, c) => dbCoverage(s, c) >= DB_BARS.allPro || dbRecord(s), qb: s => s.tds >= 38 || (s.tds >= 34 && s.passYds >= 4600), rb: s => s.rushYds >= 1650 || (s.rushYds >= 1500 && s.tds >= 16), wr: s => s.recYds >= 1500 || (s.recYds >= 1350 && s.tds >= 12), te: s => s.recYds >= 1400 || (s.recYds >= 1250 && s.tds >= 16), dl: (s, c) => (dlSpot(c) === 'dt' ? s.sacks >= 12 || (s.sacks >= 10 && s.tfl >= 15) : s.sacks >= 16 || (s.sacks >= 14 && s.tfl >= 20)), lb: s => s.tackles >= 150 || (s.tackles >= 130 && (s.ints >= 4 || s.sacks >= 6)), ol: olAllPro },
    allProNear: { qb: s => s.tds >= 32, rb: s => s.rushYds >= 1450, wr: s => s.recYds >= 1300, te: s => s.recYds >= 1200, db: (s, c) => dbCoverage(s, c) >= DB_BARS.near, dl: (s, c) => s.sacks >= (dlSpot(c) === 'dt' ? 9 : 14), lb: s => s.tackles >= 135, ol: s => (s.grade ?? 0) >= OL_BARS.near },
    // (and about one year in four somebody else has the season of his life: a star won ~45% of his prime)
    award: (c, f, s) => {
      const bar = { qb: () => (s.tds ?? 0) + (f.seasonRushTDs ?? 0) >= 36 && s.passYds >= 4400 && f.wins >= 11, rb: () => s.rushYds >= 1900 || (s.rushYds >= 1750 && s.tds >= 18), wr: () => s.recYds >= 1600 && s.tds >= 11, te: () => s.recYds >= 1500 && s.tds >= 14, dl: () => (dlSpot(c) === 'dt' ? s.sacks >= 13 || (s.sacks >= 11 && s.tfl >= 18) : s.sacks >= 17 || (s.sacks >= 15 && s.ff >= 4)), lb: () => s.tackles >= 155 && (s.ints >= 3 || s.sacks >= 6 || (s.ff ?? 0) >= 4) }
      // a tight end past both the yards and TD records on a winner: nobody out-votes that
      if (c.pos === 'ol') return false   // (no award for a lineman: the All-Pro team is the top of it)
      if (c.pos === 'te' && s.recYds > 1416 && s.tds > 18 && f.wins >= 10) return true
      if (seeded(`${c.seed}-poy-${c.year}`)() < 0.28) return false
      // a DB's DPOY: his case (coverage, plus the shutdown premium) against the year's best rival,
      // a seeded field (most years about DB_BARS.dpoy, now and then a down year or a monster)
      if (c.pos === 'db') { const u = clamp(seeded(`${c.seed}-dpoy-${c.year}`)(), 0.001, 0.999); return dbDpoyCase(s, c) > DB_BARS.dpoy + DB_BARS.spread * Math.log(u / (1 - u)) }
      return !!NFL_AWARD[c.pos](f, false, c.team).userWins && bar[c.pos]()
    },
    // (a lineman: the grade, then the pancakes and a clean sheet; an 88 grade on a winner is about 0.9, a 67 on an 8-win team 0.43)
    seasonScore: (pos, s) => { const st = s.stats; return pos === 'ol' ? clamp(((st.grade ?? 55) - 55) / 35, 0, 1.1) * .5 + Math.min(1.2, (st.pancakes ?? 0) / 50) * .1 + clamp(1 - (st.sacksA ?? 8) / 8, 0, 1) * .1 + s.wins / 15 * .3 : pos === 'lb' ? (st.tackles ?? 0) / 150 * .4 + ((st.ints ?? 0) / 4 + (st.sacks ?? 0) / 8) * .15 + s.wins / 15 * .3 : pos === 'dl' ? (s.spot === 'dt' ? (st.sacks ?? 0) / 10 * .45 + (st.tfl ?? 0) / 14 * .25 : (st.sacks ?? 0) / 16 * .45 + (st.tfl ?? 0) / 20 * .25) + s.wins / 15 * .3 : pos === 'db' ? (st.ints ?? 0) / 7 * .45 + (st.pbus ?? 0) / 20 * .25 + s.wins / 15 * .3 : pos === 'qb' ? st.tds / 40 * .4 + st.passYds / 5000 * .3 + s.wins / 15 * .3 : pos === 'rb' ? st.rushYds / 1700 * .5 + st.tds / 18 * .3 + s.wins / 15 * .2 : st.recYds / 1600 * .5 + st.tds / 14 * .3 + s.wins / 15 * .2 },
    // a DB's production: picks and the ones taken back; a lineman's: sacks (the greats are scored the same way)
    // (a lineman's: the games he started; his All-Pros carry OL_FIRST_BONUS more in legacyScore, the greats' the same way)
    legacyProd: (pos, st) => (pos === 'ol' ? (st.starts ?? 0) * OL_START_LEGACY : pos === 'lb' ? (st.tackles ?? 0) / 40 + (st.ints ?? 0) * 0.8 + (st.sacks ?? 0) * 0.3 : pos === 'dl' ? (st.sacks ?? 0) * 0.5 : pos === 'db' ? (st.ints ?? 0) * 1.3 + (st.pickSixes ?? 0) * 2 : pos === 'qb' ? (st.tds ?? 0) / 10 + (st.passYds ?? 0) / 1000 : pos === 'rb' ? (st.tds ?? 0) / 4 + (st.rushYds ?? 0) / 500 : (st.tds ?? 0) / 4 + (st.recYds ?? 0) / 500),
    // the sim lets every 10-win team in; here 11 is safe, 10 needs the tiebreakers (the sim's own
    // first playoff game, a coin the booked season keeps) and 9 needs them twice
    made: f => { const po = f.playoffRounds ?? []; return !!f.playoffs && (f.wins >= 11 || (f.wins === 10 && !!po[0]?.won) || (f.wins === 9 && !!po[0]?.won && !!po[1]?.won)) },
    rounds: ['Wild Card', 'Divisional', 'Conference Championship', 'Super Bowl'], final: 'Super Bowl', series: false,
    lineKeys: ['passYds', 'tds', 'ints', 'rushYds', 'rushTDs', 'recYds', 'rec', 'recTDs', 'tackles', 'pbus', 'sacks', 'tfl', 'qbHits', 'ff', 'pds', 'sacksA', 'prs', 'pancakes', 'pen'],
    step: 1, gameWord: 'WEEK', snaps: 'snaps', injScale: 1, moneyWord: 'yards',
    // [what, weeks out (low, high), how often]. Only the season-enders list ends a season
    injuries: [['hamstring strain', 1, 3, 5], ['high ankle sprain', 2, 6, 4], ['rib cartilage', 1, 3, 2], ['concussion', 1, 2, 4], ['MCL sprain', 2, 6, 3], ['shoulder (AC joint)', 1, 4, 3], ['turf toe', 1, 4, 2], ['knee bone bruise', 1, 3, 2], ['fractured hand', 2, 4, 1.5], ['broken collarbone', 6, 8, 0.8], ['fractured fibula', 6, 9, 0.6]],
    seasonEnders: ['torn ACL', 'torn Achilles', 'Lisfranc fracture', 'torn pectoral'],
    money: { qb: [8, 58], rb: [2, 18], wr: [4, 34], te: [2, 19], db: [2, 22], dl: [3, 44], lb: [2, 21], ol: [2, 28] },
    // (a career's range: S.moneyOf. An elite edge is paid past a top receiver, a tackle tops out about $32M)
    // (a lineman by his spot: a top left tackle about $28M a year in 2026, a guard $20M, a center $15M)
    moneyOf: c => (c.pos === 'dl' && dlSpot(c) === 'dt' ? [2, 32] : c.pos === 'ol' ? ({ tackle: [2, 28], guard: [2, 20], center: [2, 15] })[olGroup(olSpot(c))] : SPORT.nfl.money[c.pos]),
    primeNote: pos => { const S = SPORT.nfl; return `Physical traits can be trained until ${S.trainUntil(pos) + 1} (the last year at double the cost) and start to fade at ${S.declineAt(pos)}; technique until ${LADDER.nfl[pos]?.techAt[1] ?? 32}, the reads for good. Big injuries and a fragile body can cost him a grade.` },
  },
  bucket: {
    id: 'bucket', league: 'NBA', isBucket: true, screen: 'ag-screen--bucket',
    teams: NBA_TEAMS, logo: s => `/logos/nba/${s}.png`,
    // NBA ratings (about 60–85) mapped onto football's 1–10 scale, so the league's moves have the same weight
    teamOf: short => { const t = NBA_TEAMS.find(x => x.short === short) ?? NBA_TEAMS[0]; const R = NBA_RATINGS[t.short] ?? { off: 68, def: 65 }; return { short: t.short, name: t.name, color: t.color, color2: t.color2, off: clamp(r10((R.off - 55) / 3.3), 1, 10), def: clamp(r10((R.def - 55) / 3.3), 1, 10), conf: NBA_EAST.has(t.short) ? 'East' : 'West', div: NBA_DIV[t.short] ?? null } },
    status: core => (core >= 7 ? 'Contender' : core >= 5.5 ? 'In the mix' : 'Rebuilding'),
    positions: ['guard', 'big'],
    label: { guard: 'GUARD', big: 'BIG' }, posName: { guard: 'Guard', big: 'Big' },
    types: { guard: GUARD_TYPES, big: BIG_TYPES }, attr: { guard: BUCKET_ATTR, big: BUCKET_ATTR },
    pool: { guard: NBA_GUARD_PLAYERS, big: NBA_BIG_PLAYERS },
    groups: ['guard', 'big'], starters: { guard: 3, big: 2 }, keep: { guard: 5, big: 4 },
    slots: {},
    depthLabel: (pos, i) => `${pos === 'guard' ? 'GUARD' : 'BIG'} ${i}`,
    ovr: (pos, b) => calcBucketOVR(b, pos === 'big' ? BIG_TYPES : GUARD_TYPES, pos),
    realOvr: (pos, p) => Math.round(p.ovr ?? calcBucketOVR(buildOf(pos === 'big' ? BIG_TYPES : GUARD_TYPES, p), pos === 'big' ? BIG_TYPES : GUARD_TYPES, pos)),
    photo: name => (NBA_HEADSHOTS[name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[name]}.webp` : null),
    sim: pos => (b, t) => runBucketSimulation(b, pos === 'big' ? BIG_TYPES : GUARD_TYPES, t, pos, null, 'classic'),
    // 1–10 like football; `career` tells the sim (and the bench games) to use these, not its own table
    // usage: your share of the offense, from how good you are and who's beside you
    simTeam: (t, fit, m, c) => {
      const mates = [...(c.roster?.guard ?? []), ...(c.roster?.big ?? [])].filter(p => p.name !== c.name)
      const best = Math.max(0, ...mates.map(p => p.ovr))
      // off the bench: fewer minutes, a smaller role (a backup still plays in basketball)
      // (capped at 0.75: even a 99 shares the ball, about 30 a night, not 40)
      const usage = clamp((0.42 + (c.ovr - 70) * 0.012 - (best > c.ovr ? 0.06 : 0)) * (c.benchRole ? 0.62 : 1), 0.3, 0.75)
      // the sim's star lift is a straight line, 82 → 99 (+0.20 a game); a career bends it so
      // the true stars carry a team, a good player doesn't win 55 a year by himself and a
      // weak one doesn't ride a good roster into the playoffs most years (a 99 keeps it all)
      // (the cost a game, turned into off and def: 0.039 a game is one point of off + def)
      const x = clamp((c.ovr - 82) / 17, 0, 1), cost = 0.2 * x * (1 - x) + 0.02 * (1 - x) + clamp((86 - c.ovr) * 0.006, 0, 0.1), bend = cost / 0.078
      return { ...t, off: clamp(fit.off + fit.adj + (m.off ?? 0) - bend, 1, 10), def: clamp(fit.def + (m.def ?? 0) - bend, 1, 10), career: true, usage, bench: !!c.benchRole }
    },
    fit: (ro, pos, notMe) => {
      const guards = ro.guard.filter(notMe).sort((a, b) => b.ovr - a.ovr).slice(0, 3), bigs = ro.big.filter(notMe).sort((a, b) => b.ovr - a.ovr).slice(0, 2)
      // graded against the league (a median group is a C+, the best an A), not on the raw
      // overall scale: NBA groups all sit in the 78–90 range and would all read as a B
      const vs = (list, med, per) => list.length ? r10(clamp(6 + (avgOvr(list) - med) * per, 1, 11)) : 1
      const gG = vs(guards, 83, 0.75), bG = vs(bigs, 80.5, 0.65)
      const five = new Set([...guards, ...bigs].map(p => p.name))
      const bench = [...ro.guard, ...ro.big].filter(notMe).filter(p => !five.has(p.name)).sort((a, b) => b.ovr - a.ovr).slice(0, 4)
      const benchG = vs(bench, 75.5, 1.6)
      const groups = [{ k: 'BACKCOURT', v: gG, names: guards.map(p => p.name) }, { k: 'FRONTCOURT', v: bG, names: bigs.map(p => p.name) }, { k: 'BENCH', v: benchG, names: bench.map(p => p.name) }]
      const adj = pos === 'guard' ? (bG - 6) * 0.2 + (gG - 6) * 0.15 + (benchG - 6) * 0.1 : (gG - 6) * 0.25 + (bG - 6) * 0.1 + (benchG - 6) * 0.1
      const need = pos === 'guard' ? 11 - gG : 11 - bG
      return { groups, adj, need, backcourt: gG, frontcourt: bG, bench: benchG }
    },
    fitNote: (f, pos) => (pos === 'guard'
      ? (f.frontcourt >= 8 ? 'Elite bigs set screens, clean the glass and finish the lobs. A guard eats here.' : f.frontcourt < 5 ? 'A thin frontcourt: no rim protection, no second chances. The guard has to carry it.' : 'An honest frontcourt. The backcourt decides it.')
      : (f.backcourt >= 8 ? 'Real guards feed a big: lobs, pocket passes, space to work.' : f.backcourt < 5 ? 'Weak guards starve a big. Fewer good touches.' : 'A middling backcourt. The big has to create for himself.')),
    physical: { guard: ['speed', 'bounce'], big: ['bounce', 'speed'] },
    // the skills and the head: age doesn't take these
    ageless: ['jumpShot', 'passing', 'playmaking', 'basketballIQ', 'clutch'],
    finalsAward: 'FINALS MVP',
    ageShift: () => 0,
    trainUntil: () => 25,                     // speed and bounce train only while young (drafted at 19–20)
    declineAt: () => 31,
    // drafted at 19–20: 2 points a year through 20, 1 through 24, then the prime holds (a 99 at 25 was every average build)
    devYoung: () => 20, devPrime: () => 25,
    bigInjury: 20,
    draft: {
      rounds: 2,
      stock: ovr => (ovr >= 95 ? [1, 3] : ovr >= 90 ? [1, 5] : ovr >= 86 ? [5, 15] : ovr >= 82 ? [10, 25] : ovr >= 78 ? [18, 35] : ovr >= 74 ? [28, 48] : ovr >= 70 ? [40, 58] : [48, 60]),
      rookie: o => ({ kind: 'rookie', years: o <= 30 ? 4 : 2, left: o <= 30 ? 4 : 2, perYear: o <= 1 ? 12.5 : o <= 5 ? 9.5 : o <= 10 ? 6.5 : o <= 14 ? 5 : o <= 30 ? 2.8 : 1.9, option: o <= 30 }),
      posList: ['G', 'F', 'C', 'G/F', 'F/C', 'PG', 'SG', 'SF', 'PF', 'C'],
    },
    combine: {
      guard: [['sprint', '3/4-court sprint', 'speed'], ['lane', 'Lane agility', 'perimeterDefense'], ['spot', 'Spot-up shooting', 'jumpShot']],
      big: [['vert', 'Max vertical', 'bounce'], ['nbench', 'Bench press', 'size'], ['spot', 'Spot-up shooting', 'jumpShot']],
    },
    goals: {
      guard: ovr => [['ppg', 'Average', ovr >= 90 ? 26 : ovr >= 82 ? 21 : 16, 'points'], ['apg', 'Average', ovr >= 90 ? 8 : ovr >= 82 ? 6 : 4, 'assists'], ['wins', 'Win', ovr >= 90 ? 55 : ovr >= 82 ? 48 : 40, 'games']],
      big: ovr => [['ppg', 'Average', ovr >= 90 ? 25 : ovr >= 82 ? 20 : 15, 'points'], ['rpg', 'Average', ovr >= 90 ? 12 : ovr >= 82 ? 10 : 9, 'rebounds'], ['wins', 'Win', ovr >= 90 ? 55 : ovr >= 82 ? 48 : 40, 'games']],
    },
    // the season's numbers come from the games you played (a bench stint counts for nothing)
    seasonStats: (pos, f) => {
      const played = (f.games ?? []).filter(g => !g.sat)
      const gp = played.length || 1
      const sum = k => played.reduce((s, g) => s + (g[k] ?? 0), 0)
      const pts = sum('pts'), reb = sum('reb'), ast = sum('ast')
      return { ppg: r10(pts / gp), rpg: r10(reb / gp), apg: r10(ast / gp), spg: f.spg, bpg: f.bpg, pts, reb, ast, gp: played.length }
    },
    rateKeys: ['ppg', 'rpg', 'apg', 'spg', 'bpg'],
    averages: { ppg: 'pts', rpg: 'reb', apg: 'ast' },      // career averages, from the totals
    headline: { guard: ['ppg', 'apg', 'rpg'], big: ['ppg', 'rpg', 'apg'] },
    awardName: { guard: 'MVP', big: 'MVP' },
    honor: 'All-Star', honors: 'ALL-STARS', first: 'All-NBA',
    // games played to be considered (of 82): the 65-game rule for MVP and All-NBA, 40 for an All-Star
    minGames: { award: 65 / 82, first: 65 / 82, honor: 40 / 82 },
    proBowl: { guard: s => s.ppg >= 21 || (s.ppg >= 17 && s.apg >= 7), big: s => s.ppg >= 20 || (s.ppg >= 16 && s.rpg >= 10) },
    allPro: { guard: s => s.ppg >= 25 || (s.ppg >= 22 && s.apg >= 8), big: s => s.ppg >= 24 || (s.ppg >= 20 && s.rpg >= 11) },
    allProNear: { guard: s => s.ppg >= 22, big: s => s.ppg >= 20 },
    // the MVP vote: points, plus playmaking or the glass, on a winner, against the year's
    // best rival (a seeded field: most years a ~54 season, now and then a down year or a monster)
    award: (c, f, s) => {
      const r = seeded(`${c.seed}-mvp-${c.year}`)
      const score = s.ppg + s.apg * 1.5 + s.rpg * 0.75 + (f.wins - 55) * 0.25
      const u = clamp(r(), 0.001, 0.999), rival = 54 + 6 * Math.log(u / (1 - u))
      return f.wins >= 48 && s.ppg >= 20 && score > rival
    },
    seasonScore: (pos, s) => { const st = s.stats; return pos === 'guard' ? st.ppg / 30 * .45 + st.apg / 10 * .25 + s.wins / 60 * .3 : st.ppg / 28 * .45 + st.rpg / 13 * .25 + s.wins / 60 * .3 },
    legacyProd: (pos, st) => (st.pts ?? 0) / 600 + ((st.reb ?? 0) + (st.ast ?? 0)) / 700,
    // (an MVP after the first is worth less extra here than a DPOY is in football: longevity still counts, and LeBron stays first)
    awardRepeat: 4,
    // in the bracket (a top-10 seed) on a near-.500 record (40-42 and up): no 30-win team gets in
    made: f => (f.playoffRounds?.length ?? 0) > 0 && (f.wins ?? 0) >= 40,
    rounds: ['First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals'], final: 'NBA Finals', series: true,
    lineKeys: ['pts', 'reb', 'ast'],
    // (injScale 2026-11-08: 26/82, was 17/82: an NBA season costs a rotation player about six games, not four;
    // injSerious: one injury in twenty ends the season, not one in twelve as in football)
    step: 10, gameWord: 'GAME', snaps: 'minutes', injScale: 26 / 82, injSerious: 0.05, moneyWord: 'points',
    // [what, games out (low, high), how often]. Only the season-enders list ends a season
    injuries: [['ankle sprain', 2, 10, 6], ['knee soreness', 2, 6, 4], ['hamstring strain', 5, 15, 3], ['concussion', 1, 5, 2], ['back spasms', 2, 6, 3], ['wrist sprain', 3, 10, 2], ['calf strain', 6, 16, 2], ['plantar fasciitis', 4, 14, 1.5], ['MCL sprain', 8, 20, 1], ['fractured hand', 12, 25, 0.8]],
    seasonEnders: ['torn ACL', 'ruptured Achilles', 'torn meniscus'],
    money: { guard: [2, 55], big: [2, 52] },
    moneyOf: c => SPORT.bucket.money[c.pos],
    primeNote: () => { const S = SPORT.bucket; return `Speed, bounce and size can be trained until ${S.trainUntil() + 1} (the last year at double the cost) and speed and bounce start to fade at ${S.declineAt()}; finishing, handles, rebounding and defense until ${LADDER.bucket.guard.techAt[1]}, the shot and the head for good. The shot, passing, IQ and clutch never fade. Big injuries and a fragile body can cost him a grade.` },
  },
}
export const sportOf = c => SPORT[c?.sport] ?? SPORT.nfl
// merged lookups (position keys never collide between the sports)
export const CAREER_POS = SPORT.nfl.positions
export const OFFENSE_POS = CAREER_POS     // (older name)
export const POS_LABEL = { ...SPORT.nfl.label, ...SPORT.bucket.label }
export const POS_NAME = { ...SPORT.nfl.posName, ...SPORT.bucket.posName }
export const POS_TYPES = { ...SPORT.nfl.types, ...SPORT.bucket.types }
export const POS_ATTR = { ...SPORT.nfl.attr, ...SPORT.bucket.attr }
export const AWARD_NAME = { ...SPORT.nfl.awardName, ...SPORT.bucket.awardName }
export const STARTERS = { ...SPORT.nfl.starters, ...SPORT.bucket.starters }
export const PO_ROUNDS = SPORT.nfl.rounds
// a build dressed in its team's colours (the model on Career and on home's Career card), and in his own number
// (num: jerseyOf; every chip carries it, since each figure reads the number off a different trait)
export const inTeamColors = (build, fit, num = null) => (fit ? Object.fromEntries(Object.entries(build).map(([t, ch]) => [t, ch ? { ...ch, teamColor: fit.color, teamColor2: fit.color2, team: fit.short, ...(num != null ? { number: num } : null) } : ch])) : build)
export const STAT_LABEL = { passYds: 'PASS YDS', tds: 'TD', ints: 'INT', rating: 'RTG', rushYds: 'RUSH YDS', rushTDs: 'RUSH TD', compPct: 'CMP%', recYds: 'REC YDS', ypc: 'YPC', fumbles: 'FUM', recs: 'REC', ypr: 'YPR', pbus: 'PD', tackles: 'TKL', pickSixes: 'PICK-6', sacks: 'SCK', tfl: 'TFL', qbHits: 'QB HITS', ff: 'FF', fr: 'FR', safeties: 'SFTY', pds: 'PD', rtgA: 'RTG ALLOWED', ydsA: 'YDS ALLOWED', sacksA: 'SACKS ALLOWED', prs: 'PRESSURES', pancakes: 'PANCAKES', pen: 'PENALTIES', grade: 'GRADE', hitsA: 'QB HITS ALLOWED', starts: 'STARTS', passGrade: 'PASS GRADE', runGrade: 'RUN GRADE', ppg: 'PPG', rpg: 'RPG', apg: 'APG', spg: 'SPG', bpg: 'BPG', pts: 'PTS', reb: 'REB', ast: 'AST',
  // soccer
  apps: 'APPS', goals: 'G', assists: 'A', xg: 'xG', avgRating: 'RATING', lgGoals: 'LEAGUE G', mins: 'MINS', shots: 'SHOTS', sot: 'ON TARGET', hatTricks: 'HAT-TRICKS', motm: 'MOTM', cupGoals: 'CUP G', euroGoals: 'EUROPE G' }
export const HEADLINE_STATS = { ...SPORT.nfl.headline, ...SPORT.bucket.headline }
// more numbers where there's room (the season wrap, the career totals): a QB's legs
export const EXTRA_STATS = { qb: ['rushYds', 'rushTDs'], db: ['rtgA', 'ydsA'], dl: ['qbHits', 'ff'], lb: ['tfl', 'pds'], ol: ['prs', 'pen'] }
export const ovrOf = (pos, build, sport = null) => (sport ? SPORT[sport] : sportForPos(pos)).ovr(pos, build) ?? 0
const sportForPos = pos => (SPORT.bucket.positions.includes(pos) ? SPORT.bucket : SPORT.soccer?.positions.includes(pos) ? SPORT.soccer : SPORT.baseball?.positions.includes(pos) ? SPORT.baseball : SPORT.nfl)
const fmtStat = v => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : (v ?? 0).toLocaleString())

// ── Save ──────────────────────────────────────────────────────────────────────
// Three career slots per sport. Slot 0 keeps the original key (careers saved
// before slots land there); slots 1 and 2 add a suffix. In the cloud a slot is
// its own row: sport 'nfl', 'nfl#1', 'nfl#2' (same table, no schema change).
export const CAREER_SLOTS = 3
const key = (sport, uid, slot = 0) => `bap_career_${sport}_${uid || 'guest'}${slot ? `_s${slot}` : ''}`
export const cloudSport = (sport, slot = 0) => (slot ? `${sport}#${slot}` : sport)
const histKey = sport => `bap_career_hist_${sport}`
const validCareer = c => !!(c && c.v === CAREER_V && c.pos)
export function loadCareer(sport, uid, slot = 0) {
  try { const c = JSON.parse(localStorage.getItem(key(sport, uid, slot))); return validCareer(c) ? realAges({ ...c, slot }) : null } catch { return null }
}
// Every save stamps `updatedAt` (local and cloud copies are merged by it) and,
// for a signed-in player, queues the cloud copy (lib/careerCloud.js). A save
// that changes nothing (a screen re-saving what it loaded) keeps the old stamp,
// so an untouched copy never looks newer than real progress on another device.
const sameCareer = (a, b) => { try { return JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 }) } catch { return false } }
export function saveCareer(c) {
  if (!c) return
  try {
    const slot = c.slot ?? 0
    const prev = loadCareer(c.sport, c.uid, slot)
    if (prev && prev.updatedAt && sameCareer(prev, { ...c, slot })) return
    const s = { ...c, slot, updatedAt: Date.now() }
    localStorage.setItem(key(c.sport, c.uid, slot), JSON.stringify(s))
    queueCloudSave(s)
  } catch {}
}
export function clearCareer(sport, uid, slot = 0) { try { localStorage.removeItem(key(sport, uid, slot)) } catch {}; deleteCloudCareer(sport, uid, slot) }
// Signed in: pull the account's cloud copy and keep whichever is newer (by
// `updatedAt`). A guest career moves onto the account on first sign-in when
// the account has none in that slot. Offline / any failure: the local copy stands.
export async function syncCareerFromCloud(sport, uid, slot = 0) {
  if (!uid) return loadCareer(sport, uid, slot)
  const cloud = await fetchCloudCareer(sport, uid, slot)
  const local = loadCareer(sport, uid, slot)   // read after the fetch: it may have moved on meanwhile
  if (cloud === undefined) return local
  const good = validCareer(cloud) && cloud.sport === sport ? { ...cloud, uid, slot } : null
  if (good && (!local || (good.updatedAt || 0) > (local.updatedAt || 0))) {
    try { localStorage.setItem(key(sport, uid, slot), JSON.stringify(good)) } catch {}
    return realAges(good)
  }
  if (local) {
    if (!good || (local.updatedAt || 0) > (good.updatedAt || 0)) queueCloudSave(local.updatedAt ? local : { ...local, updatedAt: Date.now() })
    return local
  }
  if (cloud === null) {   // the account has no career in this slot: bring the guest one over
    const guest = loadCareer(sport, null, slot)
    if (guest) {
      const moved = { ...guest, uid, slot, updatedAt: Date.now() }
      try { localStorage.setItem(key(sport, uid, slot), JSON.stringify(moved)); localStorage.removeItem(key(sport, null, slot)) } catch {}
      queueCloudSave(moved)
      return moved
    }
  }
  return null
}
// Every slot for the career screen: [career | null, …]
export const loadSlots = (sport, uid) => Promise.all(Array.from({ length: CAREER_SLOTS }, (_, i) => syncCareerFromCloud(sport, uid, i)))
export function pastCareers(sport) { try { const l = JSON.parse(localStorage.getItem(histKey(sport)) || '[]'); return Array.isArray(l) ? l : [] } catch { return [] } }
export function logCareer(c) {
  if (!c || c.logged) return c
  const L = legacyOf(c), t = careerTotals(c)
  const at = Date.now()
  const entry = { at, pos: c.pos, name: c.name, seasons: c.seasons.length, score: L.score, tier: L.tier, rank: L.rank, ranked: L.ranked, hof: c.hof?.in ?? false, rings: t.rings, awards: c.pos === 'ol' ? t.allPros : t.awards, team: c.team, sandbox: !!c.sandbox, comeback: !!c.unretired }
  // a comeback retiring for good: the line from the first retirement is replaced, not doubled
  const was = c.unretired?.logAt
  const rest = pastCareers(c.sport).filter(x => !(was && x.at === was))
  try { localStorage.setItem(histKey(c.sport), JSON.stringify([entry, ...rest].slice(0, 20))) } catch {}
  return { ...c, logged: true, logAt: at }
}
// the past-careers line a retired career wrote (careers retired before logAt was kept: by name and numbers)
const loggedLine = c => (c.logAt ? pastCareers(c.sport).find(x => x.at === c.logAt) : null)
  ?? pastCareers(c.sport).find(x => x.name === c.name && x.pos === c.pos && x.seasons === c.seasons.length && x.score === legacyOf(c).score) ?? null

// ── Teams: the real roster around you, and how it moves year to year ─────────
// OVR → the 0–11 grade scale (F … S) the rest of the game uses
export const ovrGradeVal = ovr => clamp((ovr - 60) / 3.5, 0, 11)
export const gradeOfOvr = ovr => valToGrade(ovrGradeVal(ovr))
export const gradeOf = v => valToGrade(clamp(v, 0, 11))
const hashN = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) }
// A saved roster missing a whole group: that team's real group for the year this career is in
function withGroups(c, ro, short) {
  const S = sportOf(c)
  const missing = S.groups.filter(g => !Array.isArray(ro[g]))
  if (!missing.length) return { ...ro }
  const made = makeRoster(short, c.sport, rosterYrs(c), outOf(c, short))
  return { ...ro, ...Object.fromEntries(missing.map(g => [g, made[g]])) }
}
// Real ages: the birth year against the season (yrs = seasons past the first)
const born = (sport, name) => (SPORT[sport]?.x?.born ? SPORT[sport].x.born(name) : BIRTH[sport === 'bucket' ? 'bucket' : 'nfl'][name])
const ageOf = (sport, name, yrs = 0) => (born(sport, name) ? FIRST_SEASON - born(sport, name) : 23 + (hashN(name) % 6)) + yrs
// how long a position lasts: gone at the cap, maybe gone in the two years before it
const RETIRE_AT = { qb: 41, rb: 33, wr: 35, te: 35, ol: 36, db: 35, dl: 35, lb: 35, guard: 38, big: 38, st: 36 }
// a real player too old to be on a team this many seasons on (room: years short of the cap that already count). Year one is today's league as it is.
const pastCap = (sport, g, name, yrs, room = 0) => yrs > 0 && ageOf(sport, name, yrs) >= RETIRE_AT[g] - room
// how many seasons past the first a roster is for (in the offseason, the one coming up)
const rosterYrs = c => Math.max(0, (c.season ?? FIRST_SEASON) + (c.phase === 'offseason' ? 1 : 0) - FIRST_SEASON)
const man = (S, pos, p, yrs = 0) => ({ name: p.name, pos, ovr: S.realOvr(pos, p), age: ageOf(S.id, p.name, yrs), photo: p.headshot ? nflHeadshot(p.headshot) : S.photo(p.name), slot: p.pos ?? p.subpos ?? null, from: p.team, ...(pos === 'dl' || pos === 'lb' ? { height: p.height, weight: p.weight, size: p.attrs?.size } : {}) })
const byOvr = (a, b) => b.ovr - a.ovr
const avgOvr = list => (list.length ? list.reduce((s, p) => s + p.ovr, 0) / list.length : 72)
// A team's real roster (the depth the lineup needs, the five starting linemen in football)
// A career saved before real ages: the real players on the roster get theirs
function realAges(c0) {
  // (a sport still loading, soccer: as saved; its module asks for it, and the screens wait for it)
  if (c0?.sport && !sportReady(c0.sport)) { ensureSport(c0.sport); return c0 }
  if (!c0?.roster) return c0
  // a deal run past its end in an older save (it showed -1 years): never below 0, and a season under way is on a one-year deal
  const left = c0.contract?.left
  const c = left == null || left > 0 ? c0 : { ...c0, contract: { ...c0.contract, left: c0.phase === 'preseason' || c0.phase === 'season' ? 1 : 0 } }
  const yrs = rosterYrs(c)
  const S = sportOf(c)
  // a group this save has never heard of (a career from before the line was in the game): the team's real one, years on
  const ro = c.team ? withGroups(c, c.roster, c.team) : { ...c.roster }
  for (const g of S.groups) if (Array.isArray(ro[g])) ro[g] = ro[g].map(p => (born(c.sport, p.name) && !p.rookie ? { ...p, age: ageOf(c.sport, p.name, yrs) } : p))
  // a real player an older save still has past his position's cap (a deadline deal for a 50-year-old): a draft pick has his spot
  const r = seeded(`${c.seed}-fill-${c.year}`)
  let replaced = false
  for (const g of S.groups) {
    if (!Array.isArray(ro[g]) || !ro[g].some(p => born(c.sport, p.name) && !p.rookie && pastCap(c.sport, g, p.name, yrs))) continue
    replaced = true
    const taken = new Set(ro[g].map(p => p.name))
    ro[g] = ro[g].map(p => (born(c.sport, p.name) && !p.rookie && pastCap(c.sport, g, p.name, yrs) ? genPick(r, g, g === 'db' ? spotOf(p) : g === 'dl' ? dlSpotOf(p) : p.slot, taken) : p))
  }
  // a starting spot left empty by an older save (a veteran dropped too early): a rookie fills it
  for (const g of S.groups) {
    const slots = S.slots[g]; if (!slots || !Array.isArray(ro[g])) continue
    const missing = slots.filter(sl => !ro[g].some(p => p.slot === sl))
    if (!missing.length) continue
    const names = new Set(ro[g].map(p => p.name))
    const add = missing.map(sl => ({ name: freshName(r, names), pos: g, ovr: clamp(Math.round(74 + (r() - 0.5) * 10), 64, 84), age: 22 + Math.floor(r() * 4), photo: null, slot: sl, rookie: true }))
    const all = [...ro[g], ...add]
    ro[g] = slots.map(sl => all.find(p => p.slot === sl)).filter(Boolean).concat(all.filter(p => !slots.includes(p.slot))).slice(0, S.keep[g])
  }
  const next = { ...c, roster: ro }
  return replaced && c.team && c.fit ? { ...next, fit: fitFor(next) } : next
}
// Years into a career the league has lived those years: every season each
// player is a year older and better or worse for it (the young ones grow, the
// old ones fade), the ones at the end retire, and their spots go to draft picks
// who develop the same way. Seeded by team, so a roster for year N always
// comes out the same, and year N+1 follows from it.
// A year's change by age, one roll 0-1: the young climb, the prime holds, the thirties slide
const ageStep = (age, x) => (age <= 24 ? 1 + Math.floor(x * 4) : age <= 27 ? Math.floor(x * 3) : age <= 30 ? Math.floor(x * 3) - 1 : age <= 32 ? Math.floor(x * 3) - 2 : -1 - Math.floor(x * 4))
// a made-up pick climbs normally to about 82, slowly after that, and tops out at 90 (they were all turning into 95s)
const grownOvr = (p, step) => (p.rookie && step > 0 && p.ovr >= 82 ? Math.max(p.ovr, Math.min(90, p.ovr + Math.ceil(step / 3))) : p.ovr + step)
// a pick who'll grow into the job: about 73 at 21-22, a starter by 25, now and then a star
const genPick = (r, g, slot, taken) => withBody({ name: freshName(r, taken, g), pos: g, ovr: clamp(Math.round(73 + (r() + r() + r() - 1.5) * 12), 58, 88), age: 21 + Math.floor(r() * 2), photo: null, slot, rookie: true })
// a made-up lineman's body, fixed by his name (no dice, so nobody else's rolls move): a real edge's or a
// real tackle's height and weight, and the size grade those give (the same one the real players carry)
const withBody = p => {
  if (p.pos === 'lb') {   // a made-up linebacker: 6'0" to 6'4", 225 to 254, the same size grade the real ones carry
    const h = hashN(`${p.name}-body`), height = 72 + h % 5, weight = 225 + (h >> 3) % 30
    return { ...p, height, weight, size: lbSizeGrade(height, weight) }
  }
  if (p.pos !== 'dl') return p
  const h = hashN(`${p.name}-body`), dt = dlSpotOf(p) === 'dt'
  const height = (dt ? 73 : 74) + h % 6, weight = dt ? 290 + (h >> 3) % 46 : 245 + (h >> 3) % 36
  return { ...p, height, weight, size: dlSizeGrade(height, weight, dt ? 'dt' : 'edge') }
}
// a made-up name no one on the roster already has (two picks could share one)
function freshName(r, taken = null, g = null) {
  const nameOf = NAMERS[g] ?? rookieName   // (a made-up footballer sounds like one: soccer's registers its own)
  let n = nameOf(r)
  for (let i = 0; taken && taken.has(n) && i < 25; i++) n = nameOf(r)
  taken?.add(n)
  return n
}
// a DB pick goes where the room is short: a corner or a safety (one with no spot counted as a
// corner, so over the years the safeties retired and the safety spots went empty)
const shortSpot = list => { const s = list.filter(p => spotOf(p) === 's').length; return s < list.length - s ? 's' : 'cb' }
// the same for a line: an edge or a tackle, whichever the room is short of
const shortLine = list => { const dt = list.filter(p => dlSpotOf(p) === 'dt').length; return dt < list.length - dt ? 'dt' : 'edge' }
// who a line keeps: the two best at each spot first (two ends and two tackles always start), then the best of the rest
function keepLine(list, n) {
  const sorted = [...list].sort(byOvr)
  const sure = new Set(['edge', 'dt'].flatMap(sp => sorted.filter(p => dlSpotOf(p) === sp).slice(0, 2)))
  return sorted.filter(p => sure.has(p)).concat(sorted.filter(p => !sure.has(p))).slice(0, n).sort(byOvr)
}
// a group's spots filled and in order: an empty starting spot always gets a draft pick, so a lineup never has a hole
function placeGroup(S, g, list, r) {
  const slots = S.slots[g]
  const taken = new Set(list.map(p => p.name))
  for (const sl of slots ?? []) if (!list.some(p => p.slot === sl)) list.push(genPick(r, g, sl, taken))
  if (g === 'dl') {
    for (const sp of ['edge', 'dt']) while (list.filter(p => dlSpotOf(p) === sp).length < 2) list.push(genPick(r, g, sp, taken))
    // (the rest of the room are backups: a made-up pick never comes in ahead of the men already there)
    while (list.length < S.keep[g]) { const low = Math.min(...list.map(p => p.ovr)), p = genPick(r, g, shortLine(list), taken); list.push({ ...p, ovr: Math.max(55, Math.min(p.ovr, low - 1)) }) }
    return keepLine(list, S.keep[g])
  }
  // (soccer: the academy kids fill the forwards' room behind the real ones, never ahead of them)
  if (g === 'st') { while (list.length < S.keep[g]) { const low = list.length ? Math.min(...list.map(p => p.ovr)) : 80, p = genPick(r, g, null, taken); list.push({ ...p, age: 18 + (p.age - 21) * 2, ovr: Math.max(60, Math.min(p.ovr, low - 2)) }) } }
  // (a registered sport fills its own rooms: baseball's bench and bullpen, lib/careerBaseball.js)
  if (S.fill?.[g]) return S.fill[g](list, slot => genPick(r, g, slot, taken), S.keep[g])
  while (list.length < S.keep[g]) list.push(genPick(r, g, g === 'db' ? shortSpot(list) : null, taken))
  return slots ? slots.map(s => list.find(p => p.slot === s)).filter(Boolean).concat(list.filter(p => !slots.includes(p.slot)).sort(byOvr)).slice(0, S.keep[g]) : list.sort(byOvr).slice(0, S.keep[g])
}
// a group one season on: older, better or worse for it, the ones at the end retired, the gaps drafted
const ageGroup = (S, g, list, r) => placeGroup(S, g, list
  .map(p => ({ ...p, age: p.age + 1, ovr: clamp(grownOvr(p, ageStep(p.age + 1, r())), 55, 99) }))
  .filter(p => p.age < RETIRE_AT[g] && !(p.age >= RETIRE_AT[g] - 2 && r() < 0.35)), r)
export function makeRoster(short, sport = 'nfl', yrs = 0, gone = []) {
  const S = SPORT[sport] ?? SPORT.nfl
  const ro = { team: short, sport }
  const r = seeded(`${short}-${sport}-fill`)
  for (const g of S.groups) {
    // year one is today's league as it is (a 36-year-old guard still starts)
    let list = placeGroup(S, g, S.pool[g].filter(p => p.team === short && !gone.includes(p.name)).map(p => man(S, g, p, 0)), r)
    for (let y = 1; y <= yrs; y++) list = ageGroup(S, g, list, r)
    ro[g] = list
  }
  return ro
}
// A team you played for, as you left it (c.kept[short] = { roster, yrs }), carried forward to now:
// coming back years later finds the same people, older, not a roster made fresh
function keptRoster(c, short) {
  const k = c.kept?.[short]
  if (!k?.roster || k.roster.team !== short) return null
  const S = sportOf(c), years = rosterYrs(c) - k.yrs
  if (years <= 0) return withGroups(c, k.roster, short)
  const r = seeded(`${c.seed}-back-${short}-${k.yrs}`)
  const ro = { team: short, sport: k.roster.sport ?? c.sport }
  for (const g of S.groups) { let list = [...(k.roster[g] ?? [])]; for (let y = 0; y < years; y++) list = ageGroup(S, g, list, r); ro[g] = list }
  return ro
}
// leaving c.team: its roster is kept for the day you come back
const keepRoster = c => (c.team && c.roster?.team === c.team ? { ...(c.kept ?? {}), [c.team]: { roster: c.roster, yrs: rosterYrs(c) } } : c.kept)
// a team's roster as this career sees it: years older, and without anyone who's retired
// who's gone from a team's real roster: the retired, and anyone the front office dealt for (he's on the career's team now)
const outOf = (c, short = null) => [...(c.gone ?? []), ...Object.entries(c.dealt ?? {}).filter(([, t]) => t !== short).map(([n]) => n)]
const rosterOf = (c, short) => keptRoster(c, short) ?? makeRoster(short, c.sport, rosterYrs(c), outOf(c, short))
const rosterFor = (c, short = c.team) => (c.roster?.team === short ? c.roster : rosterOf(c, short))
// The real men in a Key Moment: both teams' starters by group, each with his number, skin, last name and
// speed (-1 to 1 around a B). Whoever isn't in the data (a drafted name years on) gets a steady made-up look.
const CAST_NUM = { qb: [3, 19], rb: [20, 39], wr: [10, 19], te: [80, 89], ol: [60, 79], db: [20, 39], dl: [50, 99], lb: [40, 59], guard: [0, 30], big: [10, 55], st: [7, 29] }
const CAST_SKIN = ['#8d5a3b', '#5e3c22', '#7a5030', '#c09060', '#f0c4a0', '#9a6840']
const castData = {}
// (every room in the data, the hidden modes' too: a linebacker stands in the games before LB is a build)
const castIndex = S => (castData[S.id] ??= new Map(Object.keys(S.pool).flatMap(g => (S.pool[g] ?? []).map(p => [p.name, p]))))
// the data's men first, then the career's own draftees: a game never shows a made-up name while a real one is left
const realFirst = (S, list) => { const ix = S.x?.castIndex ?? castIndex(S); return [...list].sort((a, b) => (ix.has(b.name) - ix.has(a.name)) || byOvr(a, b)) }
const hashOf = t => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h) }
function castMan(S, g, p) {
  const raw = (S.x?.castIndex ?? castIndex(S)).get(p.name), h = hashOf(p.name), [lo, hi] = CAST_NUM[g] ?? [10, 99]
  // his last name: the data's short name if it is one (St. Brown), never a nickname (LUKA)
  const short = (raw?.short ?? '').replace(/^[A-Z]\.\s*/, '')
  const words = p.name.replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').split(' ')
  const last = short && p.name.replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').endsWith(short) ? short : words[words.length - 1]
  return {
    name: last.toUpperCase(), number: raw?.number ?? lo + h % (hi - lo + 1), skin: raw?.skin ?? CAST_SKIN[h % CAST_SKIN.length],
    speed: Math.max(-1, Math.min(1, ((raw?.attrs?.speed ?? raw?.attrs?.pace ?? 6) - 6) / 5)),
    // (a ballplayer: his side of the plate, his arm, his grades and his spot, so the at-bat faces his real arsenal and
    // the pitcher works a real hitter's zones: lib/mg/atbat.js, pitch.js)
    ...(raw?.throws ? { bats: raw.bats, throws: raw.throws, attrs: raw.attrs, role: raw.role } : null),
  }
}
function castTeam(c, S, short) {
  const ro = rosterFor(c, short), out = {}
  for (const g of S.groups) out[g] = realFirst(S, (ro?.[g] ?? []).filter(p => p.name !== c.name)).slice(0, (S.starters[g] ?? 1) + 2).map(p => castMan(S, g, p))
  // (soccer: the men around the No. 9 too, the club's wingers and midfielders: real ones, from the data)
  if (S.x?.castMates) out.mates = S.x.castMates(short).map(p => ({ ...castMan(S, 'st', p), role: p.role ?? null }))
  // the line stands in its real order, left tackle to right tackle: the games read it by spot
  if (S.slots?.ol && ro?.ol) {
    const left = realFirst(S, ro.ol.filter(p => p.name !== c.name))
    const raw = n => castIndex(S).get(n)
    const line = S.slots.ol.map(slot => {
      const i = left.findIndex(p => (p.slot ?? raw(p.name)?.pos ?? raw(p.name)?.subpos) === slot)
      return i >= 0 ? left.splice(i, 1)[0] : null
    })
    out.ol = line.map(p => p ?? left.shift()).filter(Boolean).map(p => castMan(S, 'ol', p))
  }
  // (football, any league with a line: the eleven a side)
  if (S.slots?.ol) out.xi = castXI(c, S, short, ro, out)
  return out
}
// The football games' full eleven a side (xi), every man real: the QB, the back, the receivers, the tight ends and
// the line left to right; the ends, the tackles, the backers, the corners and the safeties, a man or two deep at each
// so a game can show its nickel or a third safety. LB and OL are hidden modes, but their men stand on the field.
// A room run short takes the next man up from the room beside it (a safety plays the corner), only once every
// room's own starters are placed; a spot with nobody left stays empty, never a made-up name.
// Each man: { name (his last name, the tag), last, short (J. ALLEN), number, skin, look: { number, skin } }.
const XI_START = { qb: 1, rb: 1, wr: 3, te: 1, edge: 2, dt: 2, lb: 3, cb: 2, s: 2 }
const XI_DEEP = { qb: 2, rb: 2, wr: 5, te: 2, edge: 3, dt: 3, lb: 4, cb: 3, s: 3 }
const XI_NEXT = { qb: [], rb: ['wr'], wr: ['te', 'rb'], te: ['wr'], edge: ['dt', 'lb'], dt: ['edge'], lb: ['edge', 's'], cb: ['s'], s: ['cb', 'lb'] }
const XI_GROUP = { edge: 'dl', dt: 'dl', cb: 'db', s: 'db' }
const xiMan = (S, g, p) => {
  const m = castMan(S, g, p), first = String(p.name ?? '').trim()[0]
  return { name: m.name, last: m.name, short: first ? `${first.toUpperCase()}. ${m.name}` : m.name, number: m.number, skin: m.skin, look: { number: m.number, skin: m.skin } }
}
function castXI(c, S, short, ro, out) {
  const room = list => realFirst(S, (list ?? []).filter(p => p.name !== c.name))
  const dbs = room(ro?.db), dls = room(ro?.dl)
  const gone = ro?.lb ? [] : outOf(c, short)
  const all = {
    qb: room(ro?.qb), rb: room(ro?.rb), wr: room(ro?.wr), te: room(ro?.te),
    edge: dls.filter(p => dlSpotOf(p) === 'edge'), dt: dls.filter(p => dlSpotOf(p) === 'dt'),
    // (LB still hidden: the team's room straight from the data, in the owner's order)
    lb: ro?.lb ? room(ro.lb) : (S.pool.lb ?? []).filter(p => p.team === short && p.name !== c.name && !gone.includes(p.name)),
    cb: dbs.filter(p => spotOf(p) === 'cb'), s: dbs.filter(p => spotOf(p) === 's'),
  }
  // the real men (the data's) first, everywhere; a man the career drafted only for a starting spot no real man can fill
  const ix = castIndex(S), real = Object.fromEntries(Object.entries(all).map(([k, l]) => [k, l.filter(p => ix.has(p.name))]))
  // (once on each side of the ball: a two-way man, Travis Hunter, can line up at receiver and at corner)
  const seen = { o: new Set(), d: new Set() }, unit = k => (['qb', 'rb', 'wr', 'te'].includes(k) ? 'o' : 'd')
  const xi = Object.fromEntries(Object.keys(all).map(k => [k, []]))
  const fill = (rooms, k, n, from) => { const sn = seen[unit(k)]; for (const p of rooms[from]) { if (xi[k].length >= n) return; if (!sn.has(p.name)) { sn.add(p.name); xi[k].push({ p, g: XI_GROUP[from] ?? from }) } } }
  for (const k in all) fill(real, k, XI_START[k], k)
  for (const k in all) for (const n of XI_NEXT[k]) fill(real, k, XI_START[k], n)
  for (const k in all) fill(real, k, XI_DEEP[k], k)
  for (const k in all) for (const n of XI_NEXT[k]) fill(real, k, XI_DEEP[k], n)
  for (const k in all) fill(all, k, XI_START[k], k)
  for (const k in xi) xi[k] = xi[k].map(({ p, g }) => xiMan(S, g, p))
  xi.ol = (out.ol ?? []).map(m => ({ ...m, last: m.name, short: m.name, look: { number: m.number, skin: m.skin } }))
  return xi
}
// the shapes the games read: the front four left end to right end; the corners, the safeties, then a nickel and a
// third safety; and the eleven on the field, offense or defense
function xiShape(xi) {
  const at = (k, i) => xi[k]?.[i] ?? null
  xi.dl = [at('edge', 0), at('dt', 0), at('dt', 1), at('edge', 1)]
  // (few teams carry a third safety: the bomb's comes off the bench, a backer or a spare lineman)
  xi.db = [at('cb', 0), at('cb', 1), at('s', 0), at('s', 1), ...[at('cb', 2), at('s', 2), at('lb', 3), at('edge', 2), at('dt', 2)].filter(Boolean).concat(null, null).slice(0, 2)]
  xi.off = [at('qb', 0), at('rb', 0), at('wr', 0), at('wr', 1), at('wr', 2), at('te', 0), ...[0, 1, 2, 3, 4].map(i => at('ol', i))]
  xi.def = [...xi.dl, at('lb', 0), at('lb', 1), at('lb', 2), ...xi.db.slice(0, 4)]
  return xi
}
// the build at his own spot in the eleven: a corner or a safety, an end or a tackle, the line at his slot.
// (two men in one uniform can't wear one number: his is already clear of the real men's (jerseyOf), so a
// made-up teammate on it takes the next free one)
function xiWithMe(c, xi, me) {
  const spot = c.pos === 'db' ? dbSpot(c) : c.pos === 'dl' ? dlSpot(c) : c.pos
  if (!xi[spot]) return xi
  const n = me.number, used = new Set([...Object.values(xi).flat().filter(Boolean).map(m => String(m.number)), String(n)])
  for (const k in xi) xi[k] = yieldNumber(xi[k], n, used)
  const m = { ...me, number: n, last: me.name, short: me.name, look: { number: n, skin: me.skin } }
  if (spot === 'ol') { const at = Math.max(0, OL_SPOTS.indexOf(olSpot(c))), line = [...xi.ol]; line[at] = m; xi.ol = line }
  else xi[spot] = [m, ...xi[spot]]
  return xi
}
// (opp: the other team's short name; a camp plays against its own)
// which rating gives a position its face (the same as its figure)
export const FACE_RATING = { qb: 'processing', rb: 'vision', wr: 'awareness', te: 'awareness', db: 'zoneIQ', dl: 'playRecognition', lb: 'playRecognition', ol: 'blitzPickup', guard: 'basketballIQ', big: 'basketballIQ', st: 'heading' }
export function gameCast(c, opp = null) {
  const S = sportOf(c)
  const us = castTeam(c, S, c.team), them = castTeam(c, S, opp ?? c.team)
  const last = String(c.name ?? 'Guest').trim().split(/\s+/).slice(-1)[0].toUpperCase()
  const me = { name: last, number: jerseyOf(c), skin: c.skin ?? c.build?.[FACE_RATING[c.pos]]?.skinColor ?? c.build?.skin ?? CAST_SKIN[0], speed: Math.max(-1, Math.min(1, ((c.build?.speed?.val ?? c.build?.legs?.val ?? c.build?.pace?.val ?? 6) - 6) / 5)), me: true }
  const used = new Set([...Object.values(us).filter(Array.isArray).flat().filter(Boolean).map(m => String(m.number)), String(me.number)])
  for (const g in us) if (Array.isArray(us[g])) us[g] = yieldNumber(us[g], me.number, used)
  us[c.pos] = [me, ...(us[c.pos] ?? [])]
  if (us.xi) { us.xi = xiShape(xiWithMe(c, us.xi, me)); them.xi = xiShape(them.xi) }
  return { us, them, me }
}
// a teammate wearing his number (a made-up one: the real men's are taken in the picker) moves to the next free one
const yieldNumber = (men, n, used) => men.map(o => {
  if (!o || o.me || String(o.number) !== String(n)) return o
  let x = (Number(o.number) || 0) + 1
  while (used.has(String(x % 100))) x++
  x %= 100; used.add(String(x))
  return { ...o, number: x, ...(o.look ? { look: { ...o.look, number: x } } : null) }
})

// ── The jersey number (c.number): picked after the draft or the signing, and changed in any offseason (the PLAYER
// tab). The league's rules by spot; a number a real teammate wears is his. A career saved before the pick (no
// c.number) wears the one the cast always gave him, moved onto a legal one. After a move his pick goes with him
// while it's free there; if a man on the new team has it he wears the next free one until he picks again
const NFL_NUMS = { qb: [[0, 49], [80, 89]], rb: [[0, 49], [80, 89]], wr: [[0, 49], [80, 89]], te: [[0, 49], [80, 89]], db: [[0, 49]], lb: [[0, 59], [90, 99]], ol: [[50, 79]], dl: [[50, 79], [90, 99]], edge: [[0, 79], [90, 99]] }
const numSpan = ([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
export function numberRule(c) {
  const S = sportOf(c)
  if (S.isBucket) return { nums: [0, '00', ...numSpan([1, 99])], text: '0 to 99, and 00' }
  if (S.isSoccer) return { nums: numSpan([1, 99]), text: '1 to 99' }
  if (S.isBaseball || !NFL_NUMS[c.pos]) return { nums: numSpan([0, 99]), text: '0 to 99' }
  const r = NFL_NUMS[c.pos === 'dl' && dlSpot(c) === 'edge' ? 'edge' : c.pos]
  return { nums: r.flatMap(numSpan), text: r.map(([a, b]) => `${a} to ${b}`).join(' or ') }
}
// the numbers the real men on a team wear (the data's own): number → his name
export function takenNumbers(c, short = c.team) {
  const out = new Map()
  if (!short) return out
  const S = sportOf(c), ix = S.x?.castIndex ?? castIndex(S), ro = rosterFor(c, short) ?? {}
  const add = p => { const n = ix.get(p?.name)?.number; if (p?.name && p.name !== c.name && n != null && !out.has(String(n))) out.set(String(n), p.name) }
  for (const g of S.groups) (ro[g] ?? []).forEach(add)
  // (LB still hidden: the team's backers straight from the data; soccer: the wingers and midfielders around the No. 9)
  if (S.slots?.ol && !ro.lb) { const gone = outOf(c, short); (S.pool.lb ?? []).filter(p => p.team === short && !gone.includes(p.name)).forEach(add) }
  if (S.x?.castMates) S.x.castMates(short).forEach(add)
  return out
}
// the number he wears: his pick while it's legal and free, else the next free legal one
export function jerseyOf(c, taken = takenNumbers(c)) {
  const { nums } = numberRule(c)
  const want = c.number ?? castMan(sportOf(c), c.pos, { name: c.name ?? 'Guest' }).number
  let i = nums.findIndex(n => String(n) === String(want))
  if (i < 0) i = Math.max(0, nums.findIndex(n => Number(n) >= Number(want)))
  for (let k = 0; k < nums.length; k++) { const n = nums[(i + k) % nums.length]; if (!taken.has(String(n))) return n }
  return nums[i]
}
// his pick, taken on the team he's joined: the teammate who wears it (a quiet line asks him to pick again)
export const numberClash = c => (c.number != null && c.team ? takenNumbers(c).get(String(c.number)) ?? null : null)
// after the draft or the signing, and in the offseason: never mid-season
export const canChangeNumber = c => !!c?.team && (c.phase === 'preseason' || c.phase === 'offseason')
export const setNumber = (c, n) => ({ ...c, number: n })
// Where you stand at your spot: the group best-first with you in it. Last
// year's starter keeps the job in a tie (+2), a starter guarantee keeps it.
// A DB's spot: a corner or a safety (his build says which); the depth chart is that spot's
export const dbSpot = c => (c.build?.size?.subpos === 's' ? 's' : 'cb')
// (a corner or a safety: on the player, else from the DB data by name, for rosters saved before it was kept)
const DB_SPOT = Object.fromEntries(DBS.map(p => [p.name, p.subpos === 's' ? 's' : 'cb']))
const spotOf = p => (p.slot === 's' || p.slot === 'cb' ? p.slot : DB_SPOT[p.name] ?? 'cb')
// A lineman's spot: an edge or a tackle (his build's Size chip says which, like a DB's); two of each start
export const dlSpot = c => dlBuildSpot(c.build)
export const dlSpotLabel = sp => (sp === 'dt' ? 'DT' : 'EDGE')
// (on the player, from the data's EDGE / DT or a pick's edge / dt; else from the DL data by name)
const DL_SPOT = Object.fromEntries(DLS.map(p => [p.name, p.subpos === 'dt' ? 'dt' : 'edge']))
function dlSpotOf(p) { const s = String(p.slot ?? '').toLowerCase(); return s === 'edge' || s === 'dt' ? s : DL_SPOT[p.name] ?? 'edge' }
// the starting line from a room: two ends and two tackles. With his spot, the three beside him
// (a spot with nobody left borrows the next best man, so a line is never short)
function dlFront(room, spot = null) {
  const sorted = [...room].sort(byOvr)
  const take = (sp, n) => sorted.filter(p => dlSpotOf(p) === sp).slice(0, n)
  const men = [...take('edge', spot === 'edge' ? 1 : 2), ...take('dt', spot === 'dt' ? 1 : 2)]
  const want = spot ? 3 : 4
  for (const p of sorted) if (men.length < want && !men.includes(p)) men.push(p)
  return men
}
export function depthChart(c, roster = c.roster ?? (c.team ? rosterOf(c, c.team) : null)) {
  const S = sportOf(c)
  // DBs: only the players at his spot (corners with corners, safeties with safeties), two start; a line the same (edges, tackles)
  const db = c.pos === 'db', dl = c.pos === 'dl', ol = c.pos === 'ol'
  // (a registered sport's own room: baseball's pitchers, a starter with the rotation and a reliever with the bullpen)
  const own = S.x?.depth?.(c) ?? null
  const group = (roster?.[c.pos] ?? []).filter(p => p.name !== c.name && (own ? own.same(p) : db ? spotOf(p) === dbSpot(c) : ol ? olSlotOf(p) === olSpot(c) : !dl || dlSpotOf(p) === dlSpot(c)))
  const me = { name: c.name, pos: c.pos, ovr: c.ovr, age: c.age, you: true }
  // last year's starter keeps it in a tie; the coaches trust a good name (+1) and doubt a bad one (−1)
  const trust = (c.rep ?? 5) >= 8 ? 1 : (c.rep ?? 5) <= 3 ? -1 : 0
  const edge = p => p.ovr + (p.you ? (c.contract?.starter ? 99 : (c.lastRole === 'Starter' ? 2 : 0) + trust) : 0)
  let all = [...group, me].sort((a, b) => edge(b) - edge(a))
  const b = c.phase === 'season' && c.active?.benched
  if (b && !b.bench && b.weeks < 99 && (c.active.k ?? 0) > b.weeks) {
    const w = b.why
    const back = w?.kind === 'hurt' && w.wks && c.active.k > b.weeks + w.wks   // healthy again: your backup now
    const note = !w || back ? null : w.kind === 'hurt' ? (w.wks ? `INJURED · OUT ${w.wks} WKS` : 'INJURED · OUT FOR THE SEASON') : w.kind === 'traded' ? 'TRADED' : 'BENCHED'
    const him = all.find(p => p.name === b.behind)
    all = all.filter(p => !p.you && !(w?.kind === 'traded' && p === him))
    const at = Math.max(0, him ? all.indexOf(him) : 0)
    if (him && note) all[all.indexOf(him)] = { ...him, out: note }
    all.splice(him && w?.kind !== 'traded' ? at : Math.min(at, all.length), 0, me)
  }
  const idx = all.findIndex(p => p.you)
  const starters = own ? own.starters : db || dl ? 2 : ol ? 1 : S.starters[c.pos]
  return { all, idx, starters, starter: idx < starters, ahead: all.slice(0, idx), label: own ? own.label(idx + 1) : ol ? `${olSpot(c)}${idx + 1}` : dl ? `${dlSpotLabel(dlSpot(c))}${idx + 1}` : db ? `${dbSpot(c) === 's' ? 'S' : 'CB'}${idx + 1}` : S.depthLabel(c.pos, idx + 1) }
}
// The starters, you in your spot if you've won it
export function lineup(c, roster = c.roster ?? (c.team ? rosterOf(c, c.team) : null)) {
  const S = sportOf(c)
  const dc = depthChart(c, roster)
  const out = {}
  for (const g of S.groups) out[g] = g === c.pos ? dc.all.slice(0, dc.starters) : (roster?.[g] ?? []).slice(0, S.starters[g])
  // DBs: his spot's two starters (him among them if he's won it) and the other spot's two
  // (four different players always: a spot with nobody left at it borrows the next best DB,
  // and a name already shown isn't shown again; older saves can have both)
  if (c.pos === 'db') {
    const mine = dbSpot(c), other = mine === 's' ? 'cb' : 's'
    const seen = new Set()
    const shown = dc.all.filter(p => !seen.has(p.name) && (seen.add(p.name), true)).slice(0, 2).map(p => ({ ...p, slot: p.you ? mine : spotOf(p) }))
    seen.clear(); shown.forEach(p => seen.add(p.name))
    const rest = (roster?.db ?? []).filter(p => p.name !== c.name && !seen.has(p.name) && (seen.add(p.name), true))
    const them = rest.filter(p => spotOf(p) === other).slice(0, 2)
    for (const p of rest) if (them.length < 2 && !them.includes(p)) them.push(p)
    out.db = [...shown, ...them.slice(0, 2).map(p => ({ ...p, slot: other }))]
  }
  // a line: his spot's two starters (him among them if he's won it) and the other spot's two
  if (c.pos === 'dl') {
    const mine = dlSpot(c), other = mine === 'dt' ? 'edge' : 'dt'
    const seen = new Set()
    const shown = dc.all.filter(p => !seen.has(p.name) && (seen.add(p.name), true)).slice(0, 2).map(p => ({ ...p, slot: p.you ? mine : dlSpotOf(p) }))
    seen.clear(); shown.forEach(p => seen.add(p.name))
    const rest = (roster?.dl ?? []).filter(p => p.name !== c.name && !seen.has(p.name) && (seen.add(p.name), true))
    const them = rest.filter(p => dlSpotOf(p) === other).sort(byOvr).slice(0, 2)
    for (const p of rest) if (them.length < 2 && !them.includes(p)) them.push(p)
    out.dl = [...shown, ...them.slice(0, 2).map(p => ({ ...p, slot: other }))]
  }
  // the other unit of a defense, for the full formation: its best two at each spot
  const twoEach = (list, spot, a, b) => {
    const best = (list ?? []).filter(p => p.name !== c.name).sort(byOvr)
    const A = best.filter(p => spot(p) === a).slice(0, 2), B = best.filter(p => spot(p) === b).slice(0, 2)
    for (const p of best) { if (A.includes(p) || B.includes(p)) continue; if (A.length < 2) A.push(p); else if (B.length < 2) B.push(p) }
    return [...A.map(p => ({ ...p, slot: a })), ...B.map(p => ({ ...p, slot: b }))]
  }
  if (c.pos === 'db') out.dl = twoEach(roster?.dl, dlSpotOf, 'edge', 'dt')
  if (c.pos === 'dl') out.db = twoEach(roster?.db, spotOf, 'cb', 's')
  if (c.pos === 'lb') { out.dl = twoEach(roster?.dl, dlSpotOf, 'edge', 'dt'); out.db = twoEach(roster?.db, spotOf, 'cb', 's') }
  if (c.pos === 'ol') {
    const mine = olSpot(c), rest = (roster?.ol ?? []).filter(p => p.name !== c.name && olSlotOf(p) !== mine)
    const left = [...rest].sort(byOvr)
    const line = OL_SPOTS.map(sl => (sl === mine ? (dc.all[0] ? { ...dc.all[0], slot: mine } : null) : (() => { const i = left.findIndex(p => olSlotOf(p) === sl); return i >= 0 ? { ...left.splice(i, 1)[0], slot: sl } : null })()))
    out.ol = line.map((p, i) => p ?? (left.length ? { ...left.shift(), slot: OL_SPOTS[i] } : null)).filter(Boolean)
  }
  // everyone not starting, all positions, best first (basketball's bench)
  const reserves = S.groups.flatMap(g => (g === c.pos ? dc.all : roster?.[g] ?? []).slice(S.starters[g])).sort((a, b) => b.ovr - a.ovr)
  return { ...out, bench: dc.all.slice(dc.starters), reserves, depth: dc }
}
// Grades (0–11) for the pieces of the team around you, from the roster you'd play with
export function teamFit(short, pos, { roster = null, league = null, name = null, sport = 'nfl', yrs = 0, gone = [], spot = null } = {}) {
  const S = SPORT[sport] ?? SPORT.nfl
  const t = S.teamOf(short)
  const ro = roster?.team === short ? roster : makeRoster(short, sport, yrs, gone)
  const f = S.fit(ro, pos, p => p.name !== name, spot, short, yrs)
  const drift = league?.[short] ?? { off: 0, def: 0 }
  const off = clamp(r10(t.off + drift.off), 1, 10), def = clamp(r10(t.def + drift.def), 1, 10)
  return {
    short, name: t.name, color: t.color, color2: t.color2, off, def, conf: t.conf, div: t.div, status: S.status((off + def) / 2),
    ...f, adj: clamp(Math.round(f.adj * 2) / 2, -1.5, 1.5),
  }
}
const lineSpot = c => (c.pos === 'dl' ? dlSpot(c) : c.pos === 'ol' ? olSpot(c) : null)
const fitFor = (c, short = c.team) => teamFit(short, c.pos, { roster: c.roster, league: c.league, name: c.name, sport: c.sport, yrs: rosterYrs(c), gone: outOf(c, short), spot: lineSpot(c) })
function simTeam(c, fit) { const S = sportOf(c); return S.simTeam(S.teamOf(c.team), fit, c.nextMods ?? {}, c) }
// ── The front office deals for a player (the trade deadline) ─────────────────
// He joins the roster for real: in his own spot (a lineman) or by his overall,
// and whoever falls off the end goes the other way. The team is graded again
// from the new roster with the same teamFit every season uses; the change the
// sim feels is the change in the team that grading produces.
function rosterWith(c, p, g) {
  const S = sportOf(c)
  const ro = { ...(c.roster ?? rosterOf(c, c.team)) }
  const add = man(S, g, p, rosterYrs(c))
  const slots = S.slots[g]
  let list = (ro[g] ?? []).filter(x => x.name !== p.name)
  if (slots && slots.includes(add.slot)) list = list.map(x => (x.slot === add.slot ? { ...x, slot: null } : x))
  else if (slots) add.slot = null
  list = [...list, add]
  ro[g] = g === 'dl' ? keepLine(list, S.keep[g]) : slots ? slots.map(sl => list.find(x => x.slot === sl)).filter(Boolean).concat(list.filter(x => !slots.includes(x.slot)).sort(byOvr)).slice(0, S.keep[g]) : list.sort(byOvr).slice(0, S.keep[g])
  return ro
}
// the team the sim plays, and its grades, with a given roster
const teamWith = (c, roster) => { const cc = { ...c, roster }; const fit = fitFor(cc); return { fit, t: simTeam({ ...cc, benchRole: !depthChart(cc).starter }, fit) } }
// What Career hands the deadline cards (scenarios.js): who can come, and what he does to the team
function dealsFor(c) {
  const S = sportOf(c)
  const ro = c.roster ?? rosterOf(c, c.team)
  const mine = new Set(S.groups.flatMap(g => (ro[g] ?? []).map(p => p.name)))
  const out = new Set(outOf(c))
  const startsNow = depthChart({ ...c, roster: ro }).starter
  const before = teamWith(c, ro)
  const was = Object.fromEntries((before.fit.groups ?? []).map(x => [x.k, x.v]))
  // the team graded again with him on it: the change to its offense / defense, and every grade that moved
  const fx = (p, g) => {
    const after = teamWith(c, rosterWith({ ...c, roster: ro }, p, g))
    const grades = (after.fit.groups ?? []).filter(x => was[x.k] != null && gradeOf(x.v) !== gradeOf(was[x.k])).map(x => ({ k: x.k, from: gradeOf(was[x.k]), to: gradeOf(x.v) }))
    return { off: r10(after.t.off - before.t.off), def: r10(after.t.def - before.t.def), grades }
  }
  return {
    ovr: (g, p) => S.realOvr(g, p),
    // not already here, not retired, an upgrade where he'd play that moves a grade or the team,
    // and never one who takes the career's own starting job
    ok: (p, g) => {
      if (!S.groups.includes(g) || mine.has(p.name) || out.has(p.name) || p.name === c.name) return false
      // (the same line a free-agent signing has: years on, the real players age out of the deadline too)
      if (pastCap(S.id, g, p.name, rosterYrs(c), 1)) return false
      const o = S.realOvr(g, p), list = ro[g] ?? []
      const vs = g === 'dl' ? list.filter(x => dlSpotOf(x) === dlSpotOf(p)).sort(byOvr)[1] : S.slots[g] ? list.find(x => x.slot === (p.pos ?? p.subpos)) : list[Math.min(list.length, S.starters[g]) - 1]
      if (vs && o <= vs.ovr) return false
      if (g === c.pos && startsNow && !depthChart({ ...c, roster: rosterWith({ ...c, roster: ro }, p, g) }).starter) return false
      const f = fx(p, g)
      return f.off >= 0 && f.def >= 0 && (f.off > 0 || f.def > 0 || f.grades.length > 0)
    },
    fx,
  }
}
// The deal is done: he's on the roster (and off his old team's), the team regraded
function signDeal(c, tr) {
  const S = sportOf(c)
  const p = (S.pool[tr.group] ?? []).find(x => x.name === tr.name)
  // (a card an older save still has open can name someone past his cap: no deal)
  if (!p || pastCap(S.id, tr.group, p.name, rosterYrs(c))) return c
  const ro = c.roster ?? rosterOf(c, c.team)
  const roster = rosterWith({ ...c, roster: ro }, p, tr.group)
  const left = (ro[tr.group] ?? []).filter(x => !roster[tr.group].some(y => y.name === x.name)).map(x => x.name)
  const next = { ...c, roster, dealt: { ...(c.dealt ?? {}), [p.name]: c.team } }
  const text = `The ${nickOf(S, c.team)} trade for ${p.name} from the ${nickOf(S, p.team)}${left.length ? `. ${left.join(' and ')} ${left.length > 1 ? 'go' : 'goes'} the other way` : ''}.`
  return { ...next, fit: fitFor(next), events: [...c.events, { year: c.year + 1, text }] }
}
// Every offseason the league moves. Each side of the ball keeps PARITY_KEEP of where it stands against the
// league's middle and takes a fresh swing sized so the league stays as spread out as it is today: a bottom
// team can be a contender in a few years, and a top one doesn't stay there for good. Year one is the real league.
// (2026-11-08: before, the drift was tied to today's grades and a team's own level never moved: in 200 runs of
// 30 seasons a bottom-five team never once reached the top five, and strength carried over 0.9 year to year)
// Soccer keeps the old drift (oldDrift below): the big clubs' money keeps them on top, and with parity a
// career at a top club went from about 4.4 trophies to 0.9
const PARITY_KEEP = { nfl: 0.55, bucket: 0.7, baseball: 0.65 }
const leagueShape = {}
function shapeOf(S) {
  if (leagueShape[S.id ?? 'nfl']) return leagueShape[S.id ?? 'nfl']
  const ts = S.teams.map(x => S.teamOf(x.short))
  const side = k => { const v = ts.map(t => t[k]), m = v.reduce((a, b) => a + b, 0) / v.length; return { m, sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1 } }
  return (leagueShape[S.id ?? 'nfl'] = { off: side('off'), def: side('def') })
}
// good teams slip, bad ones climb a little, some lurch, around today's grades (soccer)
function oldDrift(c, r) {
  const S = sportOf(c)
  const league = {}
  for (const x of S.teams) {
    const t = S.teamOf(x.short)
    const d = c.league?.[t.short] ?? { off: 0, def: 0 }
    const step = () => (r() - 0.5) * 2.2 + (r() < 0.12 ? (r() < 0.5 ? -1.5 : 1.5) : 0)
    league[t.short] = { off: clamp(r10(d.off * 0.55 + step() - (t.off - 6) * 0.12), -3, 3), def: clamp(r10(d.def * 0.55 + step() - (t.def - 6) * 0.12), -3, 3) }
  }
  return league
}
function driftLeague(c, r) {
  const S = sportOf(c)
  if (PARITY_KEEP[S.id ?? 'nfl'] == null) return oldDrift(c, r)
  const shape = shapeOf(S)
  const keep = PARITY_KEEP[S.id ?? 'nfl'], swing = Math.sqrt(1 - keep * keep)
  const gauss = () => (r() + r() + r() + r() - 2) * Math.sqrt(3)   // (about a bell curve, spread 1)
  const league = {}
  for (const x of S.teams) {
    const t = S.teamOf(x.short)
    const d = c.league?.[t.short] ?? { off: 0, def: 0 }
    // (most of a team's swing is the whole team, a new coach or a new quarterback: both sides together)
    const g0 = gauss()
    const move = k => { const { m, sd } = shape[k], now = t[k] + (d[k] ?? 0), g = 0.75 * g0 + 0.66 * gauss(); return r10(clamp(m + (now - m) * keep + g * sd * swing, 1.5, 9.8) - t[k]) }
    league[t.short] = { off: move('off'), def: move('def') }
  }
  return league
}
const FIRSTS = ['Jaylen', 'Marcus', 'Tre', 'Deon', 'Cole', 'Isaiah', 'Brock', 'Malik', 'Owen', 'Darius', 'Kade', 'Xavier', 'Jordan', 'Bryce', 'Quentin', 'Tyson', 'Elijah', 'Grant', 'Rashad', 'Mason']
const LASTS = ['Whitfield', 'Okafor', 'Banks', 'Delaney', 'Price', 'Henley', 'Mayfield', 'Corbin', 'Osei', 'Tatum', 'Rhodes', 'Vickers', 'Lyle', 'Stroud', 'Barlow', 'Kemp', 'Navarro', 'Sutton', 'Fofana', 'Hale']
const rookieName = r => `${FIRSTS[Math.floor(r() * FIRSTS.length)]} ${LASTS[Math.floor(r() * LASTS.length)]}`
const nickOf = (S, short) => S.teamOf(short).nick ?? nick(S.teamOf(short).name)   // (a team's own nickname when it has one: the Red Sox, the Blue Jays)
// The offseason on your team: everyone a year older, some better, some done;
// players leave, retire, get signed and drafted. Returns the new roster and
// the moves, in the order they'd hit the news.
function rosterMoves(c, r) {
  const S = sportOf(c)
  const old = rosterFor(c)
  const ro = { team: old.team, sport: c.sport }
  const moves = []
  // (the line rolls its own dice and keeps its own names, so everyone else's moves come out as they did before it)
  const taken0 = new Set(S.groups.filter(g => g !== 'dl' && g !== 'lb').flatMap(g => (old[g] ?? []).map(p => p.name)))
  const takenDL = new Set((old.dl ?? []).map(p => p.name))
  const rDL = seeded(`${c.seed}-off-dl-${c.year}`)
  const takenLB = new Set((old.lb ?? []).map(p => p.name))
  const rLB = seeded(`${c.seed}-off-lb-${c.year}`)
  const r0 = r
  const gl = (g, p = null) => (S.groupLabel ? S.groupLabel(g, p) : S.isBucket ? (g === 'guard' ? 'G' : 'F/C') : g === 'dl' && p ? dlSpotLabel(dlSpotOf(p)) : g.toUpperCase())
  for (const g of S.groups) {
    const r = g === 'dl' ? rDL : g === 'lb' ? rLB : r0, taken = g === 'dl' ? takenDL : g === 'lb' ? takenLB : taken0
    const grow = age => ageStep(age, r())   // the same curve as the rest of the league (makeRoster)
    const kept = []
    for (const p0 of old[g] ?? []) {
      const p = { ...p0, age: p0.age + 1, ovr: clamp(grownOvr(p0, grow(p0.age + 1)), 55, 99) }
      if (p.age >= RETIRE_AT[g] || (p.age >= RETIRE_AT[g] - 2 && r() < 0.35)) { moves.push({ kind: 'retire', pos: g, label: gl(g, p), text: S.isSoccer ? `${p.name} hangs up his boots at ${p.age}.` : `${p.name} retires after ${p.age - 22} seasons.`, p }); continue }
      if (p.age > 25 && r() < 0.11) {   // the young ones are still on rookie deals
        const to = S.teams[Math.floor(r() * S.teams.length)].short
        if (to !== ro.team) { moves.push({ kind: 'leave', pos: g, label: gl(g, p), text: S.isSoccer ? `${p.name} is sold to ${S.teamOf(to).name}.` : `${p.name} leaves in free agency for the ${nickOf(S, to)}.`, p }); continue }
      }
      kept.push(p)
    }
    // refill: a free agent from around the league, or a rookie
    const slots = S.slots[g]
    const allSpots = c.pos === 'ol' && g === 'ol' && slots
    while (kept.length < S.keep[g] || (allSpots && slots.some(sl => !kept.some(p => p.slot === sl)))) {
      const need = slots ? (slots.find(s => !kept.some(p => p.slot === s)) ?? null) : null
      // (a line signs and drafts at the spot it's short of)
      const lineNeed = g === 'dl' ? shortLine(kept) : null
      if (r() < 0.55) {
        const pool = S.pool[g].filter(p => p.team !== ro.team && !taken.has(p.name) && !outOf(c).includes(p.name) && (!need || p.pos === need) && (!lineNeed || p.subpos === lineNeed))
        const pick = pool[Math.floor(r() * pool.length)]
        if (pick) {
          const p = { ...man(S, g, pick, rosterYrs(c)), slot: need ?? pick.pos ?? null }
          if (p.age >= RETIRE_AT[g] - 1) continue
          taken.add(p.name); kept.push(p)
          moves.push({ kind: 'sign', pos: g, label: gl(g, p), text: S.isSoccer ? `Signed ${p.name} from ${S.teamOf(pick.team).name}.` : `Signed ${gl(g, p)} ${p.name} from the ${nickOf(S, pick.team)}.`, p })
          continue
        }
      }
      const rd = 1 + Math.floor(r() * S.draft.rounds)
      // (at a one-starter position, your pick comes in behind you: a backup, not a new star)
      const pickOvr = clamp(Math.round(79 - rd * (S.isBucket ? 3 : 1.5) + (r() + r() - 1) * 8), 60, 88)
      const p0 = { name: freshName(r, new Set([...taken, ...kept.map(x => x.name)]), g), pos: g, ovr: g === c.pos && S.starters[g] === 1 ? Math.max(60, Math.min(pickOvr, c.ovr - 8)) : pickOvr, age: S.isSoccer ? 19 : 22, photo: null, slot: need ?? lineNeed ?? (g === 'db' ? shortSpot(kept) : null), rookie: true }
      const p = withBody(p0)
      kept.push(p)
      moves.push({ kind: 'draft', pos: g, label: gl(g, p), text: S.isSoccer ? `${p.name} comes up from the academy.` : `Drafted ${gl(g, p)} ${p.name} in round ${rd}.`, p })
    }
    ro[g] = g === 'dl' ? keepLine(kept, Math.max(S.keep[g], kept.length)) : slots ? slots.map(s => kept.find(p => p.slot === s)).filter(Boolean).concat(kept.filter(p => !slots.includes(p.slot))).slice(0, S.keep[g]) : kept.sort(byOvr)
  }
  // sometimes they bring in competition at your spot. Where only one starts (QB, RB, TE): never
  // at a star's (88+), rarely at a good starter's (80+), and not while the last young one's around.
  // Where several start, he's a teammate as much as a rival.
  const oneJob = S.starters[c.pos] === 1 || c.pos === 'ol'   // (a lineman's spot is one job)
  const rivalOdds = c.ovr >= 88 ? (oneJob ? 0 : 0.1) : c.ovr >= 80 && oneJob ? 0.1 : 0.22
  if (r() < rivalOdds && !(oneJob && (ro[c.pos] ?? []).some(p => p.rookie && p.age <= 24 && (c.pos !== 'ol' || olSlotOf(p) === olSpot(c))))) {
    const rd = 1 + Math.floor(r() * 2)
    // (at your own spot: a safety's rival is a safety)
    const p = withBody({ name: freshName(r, new Set((ro[c.pos] ?? []).map(x => x.name)), c.pos), pos: c.pos, ovr: clamp(Math.round(c.ovr - 6 + r() * 8), 64, 84), age: S.isSoccer ? 20 : 22, photo: null, rookie: true, ...(c.pos === 'db' ? { slot: dbSpot(c) } : c.pos === 'dl' ? { slot: dlSpot(c) } : c.pos === 'ol' ? { slot: olSpot(c) } : {}) })
    ro[c.pos] = c.pos === 'dl' ? keepLine([...ro.dl, p], S.keep.dl) : c.pos === 'ol' ? [...ro.ol, p] : [...(ro[c.pos] ?? []), p].sort(byOvr).slice(0, S.keep[c.pos])
    moves.push({ kind: 'rival', pos: c.pos, label: c.pos === 'ol' ? p.slot : gl(c.pos, p), text: S.isSoccer ? `${S.teamOf(ro.team).name} sign a young striker, ${p.name}. Competition for the shirt.` : `The ${nickOf(S, ro.team)} draft ${c.pos === 'dl' ? gl('dl', p) : c.pos === 'ol' ? p.slot : S.groupLabel ? gl(c.pos, p) : S.label[c.pos]} ${p.name} in round ${rd}. Competition for ${c.name}'s ${S.snaps}.`, p })
  }
  return { roster: ro, moves }
}

// ── A new career: the draft ───────────────────────────────────────────────────
// Interviews: teams picking around your projected slot sit you down. Who asks
// is the team's GM, head coach, coordinator or owner; the answer moves your
// stock with everyone, and that team's interest most of all.
export const INTERVIEWS = {
  nfl: [
    { who: 'General manager', q: 'We have a veteran at the position. A year of sitting and learning: is that a problem?', a: [
      { t: 'Whatever helps the team. I\'ll be ready when you need me.', stock: 1, persona: 'grinder' },
      { t: 'I\'ll compete for the job from the first practice.', stock: 2, persona: 'confident' },
      { t: 'I didn\'t come here to hold a clipboard.', stock: -1, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'We won four games last year. Why come here?', a: [
      { t: 'Somebody has to turn it around. I want to be the reason.', stock: 2, persona: 'grinder' },
      { t: 'You\'re a couple of players away. I\'m one of them.', stock: 1, persona: 'confident' },
      { t: 'Honestly, I\'d rather go to a winner.', stock: -2, persona: 'cocky' } ] },
    { who: 'Offensive coordinator', q: 'On this clip the safety rotates down at the snap. Where does the ball go?', a: [
      { t: 'He vacated the deep middle. Post, over the top.', stock: 2, persona: 'confident' },
      { t: 'Check it to the run. Seven in the box isn\'t eight.', stock: 1, persona: 'grinder' },
      { t: 'Wherever I see it. I just make plays.', stock: -1, persona: 'cocky' } ] },
    { who: 'Owner', q: 'The first real contract. Where does that money go?', a: [
      { t: 'Take care of my family. Then get back to work.', stock: 1, persona: 'grinder' },
      { t: 'Nothing changes. The next one\'s bigger.', stock: 1, persona: 'confident' },
      { t: 'Cars. I\'m not going to lie to you.', stock: -1, persona: 'cocky' } ] },
    { who: 'General manager', q: 'Our doctors flagged an old ankle sprain. Be straight with us.', a: [
      { t: 'Fully healed. Here are my rehab notes, read them.', stock: 2, persona: 'grinder' },
      { t: 'Never missed a game because of it.', stock: 1, persona: 'confident' },
      { t: 'Doctors worry too much.', stock: -2, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'The last benching. Tell me about it.', a: [
      { t: 'Junior year, I fumbled twice. I fixed it, and I earned it back.', stock: 2, persona: 'grinder' },
      { t: 'I haven\'t been benched since high school.', stock: 0, persona: 'confident' },
      { t: 'It was the coach\'s fault, honestly.', stock: -2, persona: 'cocky' } ] },
    { who: 'Offensive coordinator', q: 'We run a lot of wide-zone and play-action. Ever played in it?', a: [
      { t: 'Not much, but I\'ve been studying your tape all spring.', stock: 2, persona: 'grinder' },
      { t: 'I\'ll learn any system in a week.', stock: 1, persona: 'confident' },
      { t: 'Systems don\'t matter. Talent does.', stock: -1, persona: 'cocky' } ] },
    { who: 'General manager', q: 'A teammate trashes the new guy in the press. What happens next?', a: [
      { t: 'Talk to him face to face. Keep it in the building.', stock: 2, persona: 'grinder' },
      { t: 'Let my play answer it on Sunday.', stock: 1, persona: 'confident' },
      { t: 'Fire back online. People should know.', stock: -2, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'Who\'s the best player in this draft?', a: [
      { t: 'There are a lot of good ones. I\'ll let you decide.', stock: 1, persona: 'grinder' },
      { t: 'You\'re looking at him.', stock: 1, persona: 'confident' },
      { t: 'Not even close. Me, then everyone else.', stock: -1, persona: 'cocky' } ] },
  ],
  bucket: [
    { who: 'General manager', q: 'We have an All-Star at the position. A year off the bench: is that a problem?', a: [
      { t: 'Whatever the team needs. I\'ll earn the minutes.', stock: 1, persona: 'grinder' },
      { t: 'I\'ll compete for the job from the first practice.', stock: 2, persona: 'confident' },
      { t: 'I didn\'t come here to sit.', stock: -1, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'We won twenty games last year. Why come here?', a: [
      { t: 'Somebody has to turn it around. I want to be the reason.', stock: 2, persona: 'grinder' },
      { t: 'You\'re a piece or two away. I\'m one of them.', stock: 1, persona: 'confident' },
      { t: 'Honestly, I\'d rather go to a winner.', stock: -2, persona: 'cocky' } ] },
    { who: 'Assistant coach', q: 'On this clip the help defender steps up on the drive. What\'s the read?', a: [
      { t: 'The corner is open. Kick it out before the rotation gets there.', stock: 2, persona: 'confident' },
      { t: 'Hit the roll man. He\'s got the lane.', stock: 1, persona: 'grinder' },
      { t: 'Finish through it. I don\'t pass out of that.', stock: -1, persona: 'cocky' } ] },
    { who: 'Owner', q: 'The first real contract. Where does that money go?', a: [
      { t: 'Take care of my family. Then get back in the gym.', stock: 1, persona: 'grinder' },
      { t: 'Nothing changes. The next one\'s bigger.', stock: 1, persona: 'confident' },
      { t: 'Cars. I\'m not going to lie to you.', stock: -1, persona: 'cocky' } ] },
    { who: 'General manager', q: 'Our doctors flagged an old knee issue. Be straight with us.', a: [
      { t: 'Fully healed. Here are my rehab notes, read them.', stock: 2, persona: 'grinder' },
      { t: 'Never missed a game because of it.', stock: 1, persona: 'confident' },
      { t: 'Doctors worry too much.', stock: -2, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'The last time a coach pulled the plug mid-game. Tell me about it.', a: [
      { t: 'Sophomore year, four turnovers in a half. I fixed it, and I earned it back.', stock: 2, persona: 'grinder' },
      { t: 'I haven\'t been pulled since high school.', stock: 0, persona: 'confident' },
      { t: 'It was the coach\'s fault, honestly.', stock: -2, persona: 'cocky' } ] },
    { who: 'Player development coach', q: 'We switch everything on defense. One through five, every night. Ready for that?', a: [
      { t: 'I\'ll guard whoever you put in front of me. Show me the film.', stock: 2, persona: 'grinder' },
      { t: 'I\'ll lock up anyone.', stock: 1, persona: 'confident' },
      { t: 'Defense is for the guys who can\'t score.', stock: -2, persona: 'cocky' } ] },
    { who: 'General manager', q: 'A teammate calls out the new guy on a podcast. What happens next?', a: [
      { t: 'Talk to him face to face. Keep it in the building.', stock: 2, persona: 'grinder' },
      { t: 'Let my game answer it on the floor.', stock: 1, persona: 'confident' },
      { t: 'Fire back online. People should know.', stock: -2, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'Who\'s the best player in this draft?', a: [
      { t: 'There are a lot of good ones. I\'ll let you decide.', stock: 1, persona: 'grinder' },
      { t: 'You\'re looking at him.', stock: 1, persona: 'confident' },
      { t: 'Not even close. Me, then everyone else.', stock: -1, persona: 'cocky' } ] },
  ],
}
// A lineman's room: nobody asks him where the ball goes. The offensive questions swap for these
const DL_INTERVIEWS = [
  { who: 'Defensive line coach', q: 'The tackle sets vertical and jumps out fast. What\'s the counter?', a: [
    { t: 'Long arm right into his chest. If he\'s jumping out, he\'s already off balance.', stock: 2, persona: 'confident' },
    { t: 'Inside move off the first step. Make him pay for overplaying the edge.', stock: 1, persona: 'grinder' },
    { t: 'Doesn\'t matter. I just run past him.', stock: -1, persona: 'cocky' } ] },
  { who: 'Defensive coordinator', q: 'Third and two, they\'re in shotgun, and the guard\'s weight is back. What\'s the read?', a: [
    { t: 'Pass. Get off on the ball and win the gap, but finish the rush lane.', stock: 2, persona: 'grinder' },
    { t: 'He\'s tipping it. I\'ll be in the backfield before he sets.', stock: 1, persona: 'confident' },
    { t: 'I don\'t read guards. I rush the passer.', stock: -1, persona: 'cocky' } ] },
  { who: 'Defensive coordinator', q: 'We two-gap on early downs. Fewer sacks, more dirty work. Problem?', a: [
    { t: 'No. If the run stops, I get the third downs I want.', stock: 2, persona: 'grinder' },
    { t: 'I\'ll do it, and I\'ll still get mine on third down.', stock: 1, persona: 'confident' },
    { t: 'You\'re not paying me to take on doubles.', stock: -2, persona: 'cocky' } ] },
  { who: 'Head coach', q: 'The last benching. Tell me about it.', a: [
    { t: 'Junior year, three offsides in a half. I fixed it, and I earned it back.', stock: 2, persona: 'grinder' },
    { t: 'I haven\'t been benched since high school.', stock: 0, persona: 'confident' },
    { t: 'It was the coach\'s fault, honestly.', stock: -2, persona: 'cocky' } ] },
]
// A linebacker's room: the same swap, and his own questions
const LB_INTERVIEWS = [
  { who: 'Linebackers coach', q: 'They motion the tight end across and the back flips to the strong side. Who has the run fit?', a: [
    { t: 'I do. I check the front, I fit the new strength side, and I trust the safety over the top.', stock: 2, persona: 'grinder' },
    { t: 'I see it before the ball\'s snapped. I\'m there before the back is.', stock: 1, persona: 'confident' },
    { t: 'I just find the ball. Somebody else can sort out the gaps.', stock: -1, persona: 'cocky' } ] },
  { who: 'Defensive coordinator', q: 'Third and seven, the hook zone in a cover 3, and the slot runs the shallow cross. What\'s the play?', a: [
    { t: 'Wall him off, carry him to the next man, and keep my eyes on the quarterback.', stock: 2, persona: 'grinder' },
    { t: 'Sit on it. If he throws it, it\'s mine.', stock: 1, persona: 'confident' },
    { t: 'I\'d rather be blitzing, honestly.', stock: -1, persona: 'cocky' } ] },
  { who: 'Head coach', q: 'The green dot: every call goes through the middle linebacker\'s helmet. Ready for that?', a: [
    { t: 'Yes. I\'ll know the call sheet better than anyone in the room by August.', stock: 2, persona: 'grinder' },
    { t: 'I\'ve run defenses since high school. Give it to me.', stock: 1, persona: 'confident' },
    { t: 'Sure, as long as the calls are my calls.', stock: -2, persona: 'cocky' } ] },
]
// An offensive lineman's room: the same swap (nobody asks him where the ball goes), and the line's own questions
const OL_INTERVIEWS = [
  { who: 'Offensive line coach', q: 'The end widens out and the linebacker creeps up into the gap. What\'s the set?', a: [
    { t: 'Short set, eyes inside. If the linebacker comes, he is mine first, and the end has a long way to go.', stock: 2, persona: 'grinder' },
    { t: 'Jump the end at the line. I win before the linebacker gets there.', stock: 1, persona: 'confident' },
    { t: 'I just block whoever is in front of me.', stock: -1, persona: 'cocky' } ] },
  { who: 'Offensive coordinator', q: 'We run wide zone. The man across slants inside at the snap. What now?', a: [
    { t: 'Stay on my track, get my head across, and let the back cut it back.', stock: 2, persona: 'grinder' },
    { t: 'Ride him down inside. The back will find the crease behind me.', stock: 1, persona: 'confident' },
    { t: 'I would rather run power. I like moving people.', stock: -1, persona: 'cocky' } ] },
  { who: 'Head coach', q: 'The last benching. Tell me about it.', a: [
    { t: 'Junior year, three false starts in one half. I fixed my get-off, and I earned it back.', stock: 2, persona: 'grinder' },
    { t: 'I haven\'t been benched since high school.', stock: 0, persona: 'confident' },
    { t: 'It was the coach\'s fault, honestly.', stock: -2, persona: 'cocky' } ] },
  { who: 'General manager', q: 'The quarterback gets sacked and the fans blame the line. How does that get handled?', a: [
    { t: 'I watch the tape. If it was mine, I say so in the room and I fix it.', stock: 2, persona: 'grinder' },
    { t: 'Then I make sure it is never mine.', stock: 1, persona: 'confident' },
    { t: 'Half of those are the quarterback holding the ball.', stock: -2, persona: 'cocky' } ] },
]
const DL_SWAPS = q => q.who !== 'Offensive coordinator' && !/benched/.test(q.q)
// The combine: three quick drills (components/app/MiniGame.jsx). A counted drill
// (reps, catches, nets, shots) shows exactly what was done in it: the trait already
// sets how hard the drill plays. A measured one (40, cone, velocity, vertical)
// starts from the trait's real-world range, and the run moves it inside that.
// pct (about -1 to 1) is where it lands against a typical prospect, for the scouts.
export const COMBINE_DRILLS = { ...SPORT.nfl.combine, ...SPORT.bucket.combine }
const drillValue = (id, v, score, raw, pos) => {
  const t = clamp(v, 0, 11) / 11, run = score - 0.6               // run: a decent go is about 0
  const cnt = (of, lo = 0) => (raw?.made != null ? raw.made : Math.round(lo + score * (of - lo)))
  const pc = x => clamp(x, -1, 1)
  switch (id) {
    case 'forty': { const s = raw?.secs ?? dashTarget(id, pos, v) + 0.1 - run * 0.2; return { text: `${s.toFixed(2)}s`, pct: pc((dashTypical(id, pos) - s) / 0.22) } }
    case 'sprint': { const s = raw?.secs ?? dashTarget(id, pos, v) + 0.08 - run * 0.14; return { text: `${s.toFixed(2)}s`, pct: pc((dashTypical(id, pos) - s) / 0.15) } }
    // real combine throws run about 50-62 mph (Josh Allen's 62 among the best)
    case 'velo': { const m = raw?.mph ?? Math.round(48 + t * 12 + run * 6); return { text: `${m} mph`, pct: pc((m - 55) / 5) } }
    case 'vert': { const i = raw?.inches ?? r10(26 + t * 16 + run * 7); return { text: `${i}" vertical`, pct: pc((i - 33) / 6) } }
    case 'cone': {
      // (raw.secs is the drill's clock, which already runs on the player's own scale)
      const shift = coneShift(pos)
      const of = raw?.of ?? 6, slips = of - cnt(of, 2); const s = raw?.secs ?? 7.45 + shift - t * 0.75 + slips * 0.07 - run * 0.08
      return { text: `${s.toFixed(2)}s`, pct: pc((7.05 + shift - s) / 0.3) }
    }
    case 'lane': { const of = raw?.of ?? 6, slips = of - cnt(of, 2); const s = raw?.secs ?? 11.9 - t * 1.4 + slips * 0.12 - run * 0.15; return { text: `${s.toFixed(2)}s`, pct: pc((11.2 - s) / 0.6) } }
    case 'acc': { const of = raw?.of ?? 4, m = cnt(of); return { text: `${m} of ${of} completed`, pct: pc((m / of - 0.55) * 2.2) } }
    case 'spot': { const of = raw?.of ?? 4, m = cnt(of); return { text: `${m} of ${of} made`, pct: pc((m / of - 0.5) * 2.2) } }
    case 'gauntlet': { const of = raw?.of ?? 7, m = cnt(of, 2); return { text: `${m} of ${of} caught`, pct: pc((m / of - 0.7) * 3.3) } }
    case 'bench': { const typ = benchTypical(id, pos), n = raw?.reps ?? Math.round(typ * (0.45 + score * 1.1)); return { text: `${n} reps`, pct: pc((n - typ) / 8) } }
    case 'nbench': { const typ = benchTypical(id, pos), n = raw?.reps ?? Math.round(typ * (0.45 + score * 1.1)); return { text: `${n} reps`, pct: pc((n - typ) / 6) } }
    // soccer's academy trial: 30 metres from a standing start, the slalom's clean touches, five shots at the corners
    case 'sprint30': { const s = raw?.secs ?? dashTarget(id, pos, v) + 0.06 - run * 0.12; return { text: `${s.toFixed(2)}s`, pct: pc((dashTypical(id, pos) - s) / 0.14) } }
    // (a clean run at a B is about 5.8 seconds; every heavy touch or clipped pole costs time)
    case 'slalom': { const of = raw?.of ?? 6, m = cnt(of, 2), s = raw?.secs ?? 7.2 - t * 2.4 + (of - m) * 0.35 - run * 0.25; return { text: `${s.toFixed(2)}s · ${m}/${of} clean`, pct: pc((6.1 - s) / 0.6) } }
    case 'finishing': { const of = raw?.of ?? 5, m = cnt(of); return { text: `${m} of ${of} on target`, pct: pc((m / of - 0.55) * 2.4) } }
    // (keep-ups, then the coach's driven balls killed dead: a point a keep-up, three a ball, 15 a pass, 21 the most)
    case 'first-touch': { const of = raw?.of ?? 3, m = cnt(of), u = raw?.ups ?? Math.round(clamp(2 + t * 8 + run * 8, 0, 12)); return { text: `${u} keep-ups · ${m}/${of} controlled`, pct: pc((u + m * 3 - 14) / 6) } }
    // (a registered sport's own drills: baseball's showcase, lib/careerBaseball.js)
    default: return DRILLS_X[id] ? DRILLS_X[id](v, score, raw, pos) : { text: '—', pct: 0 }
  }
}
const DRILLS_X = {}
export const registerDrills = fns => { Object.assign(DRILLS_X, fns) }
// who the combine's norms read: a lineman runs by his spot (a tackle isn't timed like an edge)
export const combinePos = c => (c.pos === 'dl' ? dlSpot(c) : c.pos)
// Skipping the rest of the workout: scouts write down a poor one, whatever the trait
export function skipCombine(c) {
  const combine = c.draft.combine.map(d => (d.score != null ? d : { ...d, score: 0.3, ...drillValue(d.id, Math.min(c.build[d.trait]?.val ?? 5, 3), 0.3, null, combinePos(c)) }))
  return { ...c, draft: { ...c.draft, combine } }
}
export function recordCombine(c, id, score, raw = null) {
  const combine = c.draft.combine.map(d => (d.id === id ? { ...d, score, ...drillValue(id, c.build[d.trait]?.val ?? 5, score, raw, combinePos(c)) } : d))
  return { ...c, draft: { ...c.draft, combine } }
}
const maxPick = S => S.teams.length * S.draft.rounds
export const pickLabel = (overall, sport = 'nfl') => { const n = (SPORT[sport] ?? SPORT.nfl).teams.length; const round = Math.ceil(overall / n); return { round, slot: overall - (round - 1) * n } }
export function stockOf(c) {
  const S = sportOf(c), d = c.draft
  const [lo0, hi0] = S.draft.stock(c.ovr, c.pos, c)
  // the combine moves the window, the interviews too (less, in a two-round draft).
  // A combine barely moves a top pick (the tape already decided it) and can be
  // worth a round or more to a mid-rounder
  const mid = (lo0 + hi0) / 2
  const span = S.isBucket ? 0.5 + mid * 0.08 : 4 + mid * 0.4   // (the NBA combine barely matters)
  const played = d.combine.filter(x => x.pct != null)
  const comb = played.length ? played.reduce((s, x) => s + x.pct, 0) / played.length : 0
  const inter = (d.interviews ?? []).reduce((s, x) => s + (x.answer != null ? x.a[x.answer].stock : 0), 0)
  // (a college résumé, START IN COLLEGE: c.college.stock picks earlier, or later, a nudge of at most seven)
  const shift = Math.round(-comb * span - inter * (S.isBucket ? 0.6 : 2) - (c.college?.stock ?? 0))     // a good answer: about two picks earlier
  // football: the top two picks are a quarterback's. Anyone else goes 3rd at
  // best (2nd for a 95+ who forces it), never 1st
  const top = S.isBucket || c.pos === 'qb' ? 1 : c.ovr >= 95 ? 2 : 3
  const lo = clamp(lo0 + shift, top, maxPick(S)), hi = clamp(hi0 + shift, lo, maxPick(S))
  return { lo, hi, loP: pickLabel(lo, c.sport), hiP: pickLabel(hi, c.sport), shift }
}
// The range in draft-room terms: "Late 1st – mid 2nd round"
const ordinal = n => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
const band = (o, sport) => { const n = (SPORT[sport] ?? SPORT.nfl).teams.length, { round, slot } = pickLabel(o, sport); return { round, part: slot <= Math.ceil(n / 3) ? 'Early' : slot <= Math.ceil(n * 2 / 3) ? 'Mid' : 'Late' } }
export function stockText(c) {
  if (sportOf(c).x?.academyText) return sportOf(c).x.academyText(c)
  const { lo, hi } = stockOf(c)
  const a = band(lo, c.sport), b = band(hi, c.sport)
  if (a.round === b.round) return a.part === b.part ? `${a.part} ${ordinal(a.round)} round` : `${a.part}–${b.part.toLowerCase()} ${ordinal(a.round)} round`
  return `${a.part} ${ordinal(a.round)} – ${b.part.toLowerCase()} ${ordinal(b.round)} round`
}
export const pickText = (o, sport) => { const { round, slot } = pickLabel(o, sport); return `Round ${round}, Pick ${slot}` }
// The pick a team holds nearest your projected range (every round runs in the same order)
export function teamPick(c, team) {
  const order = draftOrder(c), N = order.length, S = sportOf(c)
  const { lo, hi } = stockOf(c), mid = (lo + hi) / 2
  const slot = order.indexOf(team) + 1
  let best = slot
  for (let o = slot; o <= maxPick(S); o += N) if (Math.abs(o - mid) < Math.abs(best - mid)) best = o
  return best
}
// How a room took an answer
export const REACTION = st => (st >= 2 ? 'Loved it' : st >= 1 ? 'Liked it' : st === 0 ? 'No change' : st >= -1 ? 'Not a fan' : 'Turned off')
// How much this team wants this position at this round, from its roster (basketball: need alone)
function wantFor(c, short, round) {
  const want = sportOf(c).draft.want
  return want ? want(makeRoster(short, c.sport), c.pos, round) : 1
}
// The order: worst teams first, with some noise
function draftOrder(c) {
  const S = sportOf(c)
  const r = seeded(`draft-${c.seed}`)
  return S.teams.map(t => S.teamOf(t.short)).sort((a, b) => (a.off + a.def + r() * 3) - (b.off + b.def + r() * 3)).map(t => t.short)
}
// After the combine: four teams from around your projected slot sit you down
// One real team from your division (the same one all offseason)
function divRival(c) {
  if (c.sport === 'bucket' || !c.team) return null
  const S = sportOf(c), me = S.teamOf(c.team)
  if (!me.div) return null
  const mates = S.teams.map(t => S.teamOf(t.short)).filter(t => t.div === me.div && t.short !== me.short)
  if (!mates.length) return null
  const t = mates[Math.floor(seeded(`${c.seed}-div-${c.year}`)() * mates.length)]
  return { ...t, nick: nick(t.name), div: me.div }
}
export function setupInterviews(c) {
  if (sportOf(c).x?.interviews) return sportOf(c).x.interviews(c)
  const S = sportOf(c)
  const r = seeded(`int-${c.seed}`)
  const order = draftOrder(c), N = order.length
  const { lo, hi } = stockOf(c)
  const near = []
  for (let o = Math.max(1, lo - 6); o <= Math.min(maxPick(S), hi + 6) && near.length < N; o++) { const t = order[(o - 1) % N]; if (!near.includes(t)) near.push(t) }
  // (the rooms that actually want the position; a random order among them)
  const wantOf = t => wantFor(c, t, Math.ceil(order.indexOf(t) < 0 ? 1 : pickLabel(clamp(teamPick(c, t), 1, maxPick(S)), c.sport).round))
  const teams = near.map(t => ({ t, k: Math.pow(r(), 1 / Math.max(0.001, wantOf(t))) })).sort((a, b) => b.k - a.k).slice(0, 4).map(x => x.t)
  const qs = [...(c.pos === 'dl' ? [...INTERVIEWS.nfl.filter(DL_SWAPS), ...DL_INTERVIEWS] : c.pos === 'lb' ? [...INTERVIEWS.nfl.filter(DL_SWAPS), ...LB_INTERVIEWS] : c.pos === 'ol' ? [...INTERVIEWS.nfl.filter(DL_SWAPS), ...OL_INTERVIEWS] : INTERVIEWS[c.sport] ?? INTERVIEWS.nfl)].sort(() => r() - 0.5).slice(0, teams.length)
  return { ...c, draft: { ...c.draft, interviews: qs.map((q, i) => ({ ...q, a: [...q.a].sort(() => r() - 0.5), team: teams[i], answer: null })) } }   // (the answers in a random order: the best one isn't always first)
}
// The career's mini games, picked on the New Career screen: 'simple' (the original quick games,
// MiniGameSimple), 'advanced' (the canvas games, MiniGame) or 'off' (simulated from the grades).
// A save from before the choice had the on/off switch (simGames): on was the canvas games.
export const GAMES_MODES = [['advanced', 'ADVANCED'], ['simple', 'SIMPLE'], ['off', 'NONE']]
export const gamesMode = c => (['simple', 'advanced', 'off'].includes(c?.games) ? c.games : c?.simGames ? 'off' : 'advanced')
export const setGamesMode = (c, mode) => ({ ...c, games: mode, simGames: mode === 'off' })
// ── The body: the real man behind the build's Size chip, his height and weight ──
// (the chip carries them when the builder put them there: DL, LB, OL, basketball, College Football;
// otherwise from his position's pools by name, today's and all-time. Quarterbacks, and the all-time
// backs and receivers, keep theirs in a list of their own.) Soccer and baseball: the durability trait's chip.
const BIO_LISTS = { qb: [QB_PHYSICALS, QB_LEGEND_PHYSICALS], rb: [RB_LEGEND_PHYSICALS], wr: [WR_LEGEND_PHYSICALS] }
const okBio = p => p?.height > 0 && p?.weight > 0
const bodyTrait = (S, pos) => S.durTraitOf?.[pos] ?? S.durTrait ?? 'size'
const dlSub = p => (p.subpos === 'dt' ? 'dt' : 'edge')
export function bodyOf(build, pos, sport = 'nfl') {
  const S = SPORT[sport] ?? SPORT.nfl
  const ch = build?.[bodyTrait(S, pos)]
  if (!ch) return null
  const sub = p => (pos === 'dl' ? dlSub(p) : pos === 'db' ? p.subpos ?? null : null)
  const name = ch.qbFull
  let hit = null
  if (name) for (const list of [S.pool?.[pos] ?? [], ALL_TIME_POOL[pos] ?? []]) {
    for (const p of list) if (p.name === name && (okBio(p) || okBio(ch))) { if (!ch.team || p.team === ch.team) { hit = p; break } hit ??= p }
    if (hit) break
  }
  const spot = ch.subpos ? sub(ch) : hit ? sub(hit) : null
  if (okBio(ch)) return { height: ch.height, weight: ch.weight, sub: spot }
  if (okBio(hit)) return { height: hit.height, weight: hit.weight, sub: spot }
  for (const m of name ? BIO_LISTS[pos] ?? [] : []) if (okBio(m[name])) return { height: m[name].height, weight: m[name].weight, sub: null }
  return null
}
// the build's body, as a broadcast reads it: 6'2" · 215 (null: no bio)
export const careerBody = c => c?.body ?? bodyOf(c?.build, c?.pos, c?.sport)
export const bodyText = (b, sep = ' · ') => (b ? `${Math.floor(b.height / 12)}'${b.height % 12}"${sep}${b.weight}` : null)
// Weight on height at his position: a straight line through the position's real players (today's and
// all-time, an edge against edges and a tackle against tackles, a corner against corners and a safety
// against safeties), and how far off it a man usually sits (sd)
const FRAME_FIT = {}
function frameFit(sport, pos, sub) {
  const k = `${sport}|${pos}|${sub ?? ''}`
  if (FRAME_FIT[k]) return FRAME_FIT[k]
  const S = SPORT[sport] ?? SPORT.nfl
  const seen = new Set(), xs = []
  const add = (name, p, psub) => { if (!okBio(p) || seen.has(name) || (sub && psub !== sub)) return; seen.add(name); xs.push([p.height, p.weight]) }
  for (const p of [...(S.pool?.[pos] ?? []), ...(ALL_TIME_POOL[pos] ?? [])]) add(p.name, p, pos === 'dl' ? dlSub(p) : p.subpos)
  for (const m of BIO_LISTS[pos] ?? []) for (const [name, p] of Object.entries(m)) add(name, p, null)
  if (xs.length < 20) return sub ? frameFit(sport, pos, null) : null
  const n = xs.length, mx = xs.reduce((a, x) => a + x[0], 0) / n, my = xs.reduce((a, x) => a + x[1], 0) / n
  const b = xs.reduce((a, x) => a + (x[0] - mx) * (x[1] - my), 0) / Math.max(1, xs.reduce((a, x) => a + (x[0] - mx) ** 2, 0))
  const sd = Math.max(8, Math.sqrt(xs.reduce((a, x) => a + (x[1] - (my + b * (x[0] - mx))) ** 2, 0) / (n - 2)))
  return (FRAME_FIT[k] = { at: h => my + b * (h - mx), sd })
}
// The frame, football and basketball: his weight against what his position carries at his height, in sds (z).
// Heavy for his height holds up better, light for it ("a thin frame") breaks down more. Far past the
// position's norm stops helping and costs a little (heavy backs and linemen wear their knees and ankles out).
// grade: what it adds to the starting grade, about one either way for a clearly thick or thin frame:
//   z −1.6 and under −1.3 · z 0 → 0 · z +1.25 → +1 (the best of it) · z +2.5 → about 0 · z +3 and up −0.4
// (2026-11-08) WR 6'0" 210: z +1.4, +0.9 · WR 6'4" 210: z −0.5, −0.4 · big 6'10" 240: z +0.1, +0.1 · RB 5'9" 215: z +0.75, +0.6
export function frameOf(c) {
  const S = sportOf(c)
  if (S.isSoccer || S.isBaseball || S.durTrait || S.durTraitOf) return null
  const b = bodyOf(c.build, c.pos, c.sport)
  const fit = b && frameFit(c.sport, c.pos, c.pos === 'dl' || c.pos === 'db' ? b.sub : null)
  if (!fit) return null
  const exp = fit.at(b.height), z = clamp((b.weight - exp) / fit.sd, -4, 5)
  const grade = z <= 1.25 ? Math.max(-1.3, 0.8 * z) : Math.max(-0.4, 1 - 0.7 * (z - 1.25))
  return { z: r10(z), exp: Math.round(exp), grade: r10(grade), height: b.height, weight: b.weight }
}
// college: where a College Football build came from ({ school, schoolName, line }), when he entered the draft from there
// start 'college' (football QB, WR, RB): the career opens in college (phase 'college', components/cfb/CareerCollege.jsx),
// a year younger, and goes to the combine from there
export function newCareer({ sport = 'nfl', uid = null, pos, build, name = 'Guest', slot = 0, owner = null, games = 'advanced', nation = null, college = null, start = 'draft' }) {
  const S = SPORT[sport] ?? SPORT.nfl
  const seed = Math.random().toString(36).slice(2, 10)
  const r = seeded(`career-${seed}`)
  const types = S.types[pos]
  const ovr = S.ovr(pos, build)
  const drills = S.combine[pos].map(([id, label, trait]) => ({ id, label, trait, score: null, text: null, pct: null }))
  // Starting durability. Football and basketball (2026-11-08): from the real body behind the Size chip, his
  // frame (frameOf: heavy or light for his height at his position). A normal frame starts around C+/B-, a
  // clearly thick one about a grade higher, a thin one about a grade lower, then give or take a grade of luck:
  // correlated, not decided, and never above B+ (no rookie starts at S). A Size chip with no bio, soccer
  // (a striker's strength) and baseball (a hitter's speed, a pitcher's stamina) keep the size formula from
  // before: F size starts around C-, A+ around B+, give or take a grade. Body work and how the career goes
  // move it from there
  const body = bodyOf(build, pos, sport)
  const frame = frameOf({ sport, pos, build })
  const luck = seeded(`dur-${seed}`)() * 2 - 1
  const sizeV = build[bodyTrait(S, pos)]?.val ?? 5
  const dur = (frame ? clamp(4.5 + frame.grade + luck, 1.5, 7.4) : 2 + 0.5 * clamp(sizeV, 0, 11) + luck) / 1.1
  return {
    v: CAREER_V, sport, uid, slot, owner, seed, pos, types, name, build, base: build, ovr, ...(body ? { body: { height: body.height, weight: body.weight } } : {}),
    age: (S.isSoccer ? 17 : S.isBucket ? 19 : 21) + Math.floor(r() * 2), year: 0, season: FIRST_SEASON,
    ...(S.x?.newCareer?.(nation) ?? {}),
    phase: start === 'college' ? 'college' : 'draft', step: 'combine',
    draft: { combine: drills, interviews: [], picks: null, pick: null, persona: null },
    team: null, fit: null, contract: null, role: 'Starter', lastRole: null, roster: null, league: null, off: null,
    dev: { points: 0, spent: 0 }, durability: r10(clamp(dur, 1, 10)), durBase: r10(clamp(dur, 1, 10)), rep: 5,
    injuries: [], seasons: [], events: [], decisions: [], nextMods: null, goals: [],
    active: null, offers: null, tradeAsked: false, hof: null, retired: false, logged: false,
    earnings: 0,
    games: ['simple', 'advanced', 'off'].includes(games) ? games : 'advanced', simGames: games === 'off',
    ...(college ? { college } : start === 'college' ? { college: { stage: 'recruit', seasons: [] } } : {}),
    ...(start === 'college' ? { age: (S.isSoccer ? 17 : S.isBucket ? 19 : 21) + Math.floor(r() * 2) - 1 } : {}),
  }
}
export function answerInterview(c, i, choice) {
  const inter = c.draft.interviews.map((x, k) => (k === i ? { ...x, answer: choice } : x))
  const done = inter.every(x => x.answer != null)
  const persona = done ? ['grinder', 'confident', 'cocky'].sort((a, b) => inter.filter(x => x.a[x.answer].persona === b).length - inter.filter(x => x.a[x.answer].persona === a).length)[0] : c.draft.persona
  return { ...c, draft: { ...c.draft, interviews: inter, persona } }
}
// Draft day: your pick inside the window, at the team that needs you most and
// liked you most in the room
export function runDraft(c) {
  if (sportOf(c).x?.offers) return sportOf(c).x.offers(c)
  const S = sportOf(c)
  const r = seeded(`draft2-${c.seed}`)
  const order = draftOrder(c), N = order.length
  const { lo, hi } = stockOf(c)
  const picks = []
  const interest = {}
  for (const x of c.draft.interviews ?? []) if (x.answer != null) interest[x.team] = (interest[x.team] ?? 0) + x.a[x.answer].stock
  const need = short => teamFit(short, c.pos, { sport: c.sport, spot: lineSpot(c) }).need
  const weigh = (team, round) => {
    const want = wantFor(c, team, round)
    return { want, w: (need(team) ** 2 + 1 + Math.max(0, interest[team] ?? 0) * 8) * want }
  }
  let cands = []
  for (let o = lo; o <= hi; o++) { const team = order[(o - 1) % N]; cands.push({ o, team, ...weigh(team, pickLabel(o, c.sport).round) }) }
  // nobody on the clock has a use for him: a team that does trades up to his slot
  if (Math.max(...cands.map(x => x.want)) < 0.3) {
    const round = pickLabel(lo, c.sport).round
    cands = order.map(team => ({ o: lo, team, trade: true, ...weigh(team, round) })).filter(x => x.want >= 1)
    if (!cands.length) cands = [{ o: lo, team: order[(lo - 1) % N], w: 1 }]
  }
  const total = cands.reduce((s, x) => s + x.w, 0)
  let roll = r() * total, mine = cands[0]
  for (const x of cands) { roll -= x.w; if (roll <= 0) { mine = x; break } }
  // the picks before yours, shown as a ticker
  const names = ['Caleb Rowe', 'D.J. Harrow', 'Malik Sterling', 'Tyrese Oduya', 'Brock Wendell', 'Jalen Pike', 'Mason Trask', 'Kyren Bello', 'Luther Vance', 'Nico Amari', 'Trey Holcomb', 'Zion Marsh', 'Cole Brandt', 'Elijah Rook', 'Dante Ferris', 'Ty Castellano']
  const posList = S.draft.posList
  const from = Math.max(1, mine.o - 6)
  // (the picks before yours make sense too: no quarterback for a team that has one)
  const tickerPos = (o, team) => {
    const p = posList[(o * 5) % posList.length], g = { QB: 'qb', RB: 'rb' }[p]
    return g && S.draft.want?.(makeRoster(team, c.sport), g, pickLabel(o, c.sport).round) < 0.3 ? ['OT', 'EDGE', 'CB', 'WR'][o % 4] : p
  }
  for (let o = from; o < mine.o; o++) { const team = order[(o - 1) % N]; picks.push({ o, ...pickLabel(o, c.sport), team, player: names[(o * 7) % names.length], pos: tickerPos(o, team) }) }
  picks.push({ o: mine.o, ...pickLabel(mine.o, c.sport), team: mine.team, you: true, trade: !!mine.trade })
  const roster = makeRoster(mine.team, c.sport)
  const fit = teamFit(mine.team, c.pos, { roster, name: c.name, sport: c.sport, spot: lineSpot(c) })
  const contract = S.draft.rookie(mine.o)
  const met = (c.draft.interviews ?? []).some(x => x.team === mine.team)
  const lbl = pickLabel(mine.o, c.sport)
  return { ...c, phase: 'draft', step: 'day', draft: { ...c.draft, picks, pick: picks[picks.length - 1] }, team: mine.team, roster, fit, contract, decisions: [...c.decisions, { year: 1, text: `${mine.trade ? 'Traded up and drafted' : 'Drafted'} in round ${lbl.round}, pick ${lbl.slot} (No. ${mine.o} overall) by the ${fit.name}${met ? ' (they interviewed him)' : ''}` }] }
}

// ── Goals for a season ───────────────────────────────────────────────────────
// The year's goals, from the role. A starter gets the full-season numbers.
// Off the bench (basketball): the same goals, sized for fewer minutes.
// A backup (football): judged on the games he does start, per start, and
// winning those starts.
const r1 = x => Math.round(x * 10) / 10
export const goalsFor = c => {
  const S = sportOf(c)
  const raw = S.goals[c.pos](c.ovr, c)
  // (a ceiling goal, `low`: a lineman's sacks allowed)
  const full = raw.map(([k, verb, n, unit, low]) => ({ k, label: `${verb} ${n.toLocaleString()} ${unit}`, n, ...(low ? { low: true } : {}) }))
  const dc = c.team ? depthChart(c) : null
  if (!dc || dc.starter) return full
  if (S.x?.goals) return S.x.goals(c, raw, full, dc)   // (a registered sport sizes its own: baseball's bench bat or long man)
  // (soccer, out of the starting eleven: the same goals, sized for the minutes a rotation player or a sub gets)
  if (S.isSoccer) { const m = S.x.role(c) === 'Rotation' ? 0.6 : 0.3; return raw.map(([k, verb, n, unit]) => (k === 'avgRating' ? full.find(g => g.k === k) : { k, label: `${verb} ${Math.max(1, Math.round(n * m))} ${unit}`, n: Math.max(1, Math.round(n * m)) })) }
  // football backup in the rotation (not a QB): the season's goals at his share of the work
  const u = !S.isBucket ? backupShare(c.pos, dc.idx - dc.starters) : 0
  if (u > 0) return raw.map(([k, verb, n, unit, low]) => { if (k === 'wins' || low) return full.find(g => g.k === k); const m = Math.max(1, Math.round(n * u / (n >= 100 ? 25 : 1)) * (n >= 100 ? 25 : 1)); return { k, label: `${verb} ${m.toLocaleString()} ${m === 1 ? unit.replace(/(e)?s$/, '') : unit}`, n: m } })
  if (S.isBucket) return raw.map(([k, verb, n, unit]) => k === 'wins' ? full.find(g => g.k === k) : { k, label: `${verb} ${r1(n * 0.6)} ${unit} off the bench`, n: r1(n * 0.6) })
  const per = raw.filter(([k, , n, , low]) => k !== 'wins' && !low && k !== 'grade' && n / 17 >= 1).slice(0, 2).map(([k, verb, n, unit]) => { const m = n / 17 >= 10 ? Math.round(n / 17) : r1(n / 17); return { k, per: 'start', label: `${verb} ${m.toLocaleString()} ${unit} a start`, n: m } })
  return [...per, { k: 'startWins', label: 'Win half the games he starts', n: 0.5 }]
}
// s: { stats, wins, starts, startWins }
const goalMet = (g, s) => g.k === 'startWins' ? s.starts > 0 && s.startWins / s.starts >= g.n
  : g.per === 'start' ? s.starts > 0 && (s.stats[g.k] ?? 0) / s.starts >= g.n
  : g.low ? s.stats[g.k] != null && s.stats[g.k] <= g.n
  : (s.stats[g.k] ?? (g.k === 'wins' ? s.wins : 0)) >= g.n

// ── The season: the director plays it, we steer and keep score ───────────────
export const seasonStats = (pos, f) => sportForPos(pos).seasonStats(pos, f)
// A backup still plays (except a backup quarterback): RB2 splits the carries,
// a fourth receiver or second tight end gets packages, the fifth DB plays
// nickel. Share of a starter's workload, by how far down the depth chart.
// (a line rotates more than any room on the team: the third end plays half the snaps)
const SHARE = { rb: [0.45, 0.18], wr: [0.35, 0.15], te: [0.35, 0.12], db: [0.5, 0.25], dl: [0.55, 0.25], lb: [0.5, 0.2] }
export const backupShare = (pos, beyond) => (SHARE[pos] ? SHARE[pos][beyond] ?? 0.1 : 0)
const NOT_COUNTS = new Set(['wk', 'g', 'mySc', 'oppSc', 'won', 'long', 'rating', 'compPct', 'ypc', 'ypr', 'catchRate', 'q'])
const unit = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 }
// my stat line in a game at a share of the snaps (counts scale; a fraction of a
// touchdown rounds up or down by a fixed coin, so they don't all vanish)
function shareGame(g, u, key) {
  const out = { ...g }
  for (const [k, v] of Object.entries(g)) if (typeof v === 'number' && !NOT_COUNTS.has(k)) out[k] = Math.floor(v * u + unit(`${key}-${k}`))
  if (typeof g.long === 'number') out.long = Math.min(g.long, Math.max(out.rushYds ?? 0, out.recYds ?? 0, out.passYds ?? 0, out.long > 0 ? 1 : 0))
  return out
}
// the sim, with my games at a share until I'm the starter (week `weeks` on)
const shareSim = (sim, u, weeks) => (b, t, seed) => { const r = sim(b, t, seed); return { ...r, games: r.games.map((g, i) => (i < weeks ? shareGame(g, u, `${seed}-${i}`) : g)) } }
const simFor = c => (c.active?.share ? shareSim(sportOf(c).sim(c.pos), c.active.share.u, c.active.share.weeks) : sportOf(c).sim(c.pos))
// a career injury's odds a game (×S.injScale), and how much durability moves them: advanceWeek
const INJ_RATE = 0.019, INJ_PULL = 0.15
// the injury cards a season can deal (sit or play hurt): one at most, more likely on a fragile body.
// ~35% a season at durability 2, ~21% at 6, ~7% at 10; the playoffs, half that
const injuryOdds = c => { const d = clamp(c.durability ?? 5, 1, 10), season = clamp(0.42 - 0.035 * d, 0.07, 0.4) * (c.age >= 31 ? 1.2 : 1); return { season, playoffs: season / 2 } }
const director = (c, team, base, seed, simFn = simFor(c)) => createDirector({ sport: c.sport, pos: c.pos, build: c.build, team, simFn, base, seed, name: c.name, attrMap: POS_ATTR[c.pos], types: c.types, always: true, injuryOdds: injuryOdds(c), recordBook: c.recordBook ?? null, deals: () => dealsFor(c), made: sportOf(c).made, ...(sportOf(c).x?.onFinal ? { onFinal: sportOf(c).x.onFinal } : {}) })
export function startSeason(c) {
  const S = sportOf(c)
  const roster = c.roster ?? rosterOf(c, c.team)
  const cc = { ...c, roster }
  const fit = fitFor(cc)
  const dc = depthChart(cc)
  const team = simTeam({ ...cc, benchRole: !dc.starter }, fit)
  const seed = `${c.seed}-y${c.year + 1}`
  // Football, not the starter: how many weeks until the job comes your way
  const plain = S.sim(c.pos)
  let weeks = 0, share = null
  if (!dc.starter && !S.isBucket && !S.isSoccer && !S.x?.start) {
    const rr = seeded(`${c.seed}-bench-${c.year}`)
    const ahead = dc.ahead[dc.ahead.length - 1]
    const gap = ahead.ovr - c.ovr
    const T = plain(c.build, team).games.length
    const frac = gap <= 2 ? 0.18 + rr() * 0.22 : gap <= 6 ? (rr() < 0.5 ? 0.4 + rr() * 0.35 : 1) : (rr() < 0.45 ? 0.35 + rr() * 0.45 : 1)
    // (the job goes to the next man up: with a backup still ahead of you, it isn't coming)
    weeks = dc.idx > dc.starters ? T : Math.max(1, Math.min(T, Math.round(frac * T)))
    // everyone but a quarterback still plays until then, at a share of the snaps
    const u = backupShare(c.pos, dc.idx - dc.starters)
    if (u > 0) share = { u, weeks }
  }
  const simFn = share ? shareSim(plain, share.u, share.weeks) : plain
  const base = simFn(c.build, team)
  const D = director(cc, team, base, seed, simFn)
  seasonSwing(cc, D)
  // (a registered sport opens its own season: baseball's minors stint and the call-up, the lineup or the rotation)
  const own = S.x?.start ? S.x.start(cc, D, dc, team) : null
  // not the starter. Basketball: off the bench all year, a smaller role.
  // Football: the season opens on the bench, until the job comes your way.
  let benched = own ? own.benched ?? null : null
  if (own) { /* (its own) */ } else if (!dc.starter && (S.isBucket || S.isSoccer)) {
    benched = { weeks: D.total, behind: dc.ahead[dc.ahead.length - 1].name, label: dc.label, bench: true, ...(S.isSoccer ? { role: S.x.role(cc) } : {}) }
  } else if (!dc.starter) {
    // a backup quarterback sits; everyone else is in the rotation
    if (!share) D.sidelined(0, weeks)
    // (the man whose job it is: the last starter ahead of you, not just the next man up)
    benched = { weeks, behind: dc.ahead[Math.min(dc.starters, dc.ahead.length) - 1].name, label: dc.label, rotation: !!share }
    // why the job comes your way (when it does): he gets hurt, he plays his way out, or he's dealt
    if (weeks < D.total) {
      const rw = seeded(`${c.seed}-why-${c.year}`)
      const x = rw(), left = D.total - weeks
      const HURT = [['tears his ACL', 0], ['breaks his leg', 0], ['ruptures his Achilles', 0], ['breaks his collarbone', 8], ['sprains his knee (MCL)', 5], ['has a high ankle sprain', 4], ['tears his hamstring', 6], ['breaks his hand', 4]]
      if (x < 0.6) {
        const [what, wks0] = HURT[Math.floor(rw() * HURT.length)]
        const wks = wks0 && wks0 < left ? wks0 : 0
        benched.why = { kind: 'hurt', what, wks }
      } else if (x < 0.88) benched.why = { kind: 'benched' }
      else benched.why = { kind: 'traded', to: S.teams.filter(t => t.short !== c.team)[Math.floor(rw() * (S.teams.length - 1))].short }
    }
  }
  const feed = own ? own.feed ?? [] : benched ? [{ k: 0, note: S.isSoccer ? `${benched.behind} leads the line. ${c.name} starts the season ${benched.role === 'Rotation' ? 'in the rotation: some starts, minutes off the bench' : 'on the bench: a sub’s minutes, the odd start in the cup'}.` : benched.bench ? `${benched.behind} starts. ${c.name} comes off the bench this season: fewer minutes, a smaller role.` : `${benched.behind} is the starter. ${c.name} opens the season as ${benched.label}${benched.rotation ? ', in the rotation' : ''}.`, noteKind: S.isSoccer ? 'SQUAD ROLE' : benched.bench ? 'ROTATION' : 'DEPTH CHART' }] : []
  const next = { ...cc, phase: 'season', fit, role: own ? own.role : S.isSoccer ? S.x.role(cc) : dc.starter ? 'Starter' : 'Backup', simTeam: team, goals: goalsFor(cc), active: { k: 0, base, snap: D.snapshot(), seed, moment: null, feed, injury: null, benched, share, ...(own?.active ?? {}) } }
  return [next, D]
}
// The unpredictable part of a year. Never shown, only felt:
// - form: about one season in eight the player is quietly better than the
//   ratings (a breakout), one in eight quietly worse (a bust). A contract year
//   leans toward a breakout; the thirties lean toward a bust.
// - a streak: some seasons have one short stretch running a little hot or cold.
function seasonSwing(c, D) {
  const r = seeded(`${c.seed}-swing-${c.year}`)
  const all = d => ({ attr: Object.fromEntries(c.types.map(t => [t, d])) })
  const contractYear = c.contract?.left === 1
  const up = 0.12 + (contractYear ? 0.06 : 0) + (c.age <= 24 ? 0.03 : 0)
  const down = 0.12 + (c.age >= 32 ? 0.06 : 0) - (contractYear ? 0.03 : 0)
  const roll = r()
  if (roll < up) D.nudge(all(1), 0, D.total, null, true)
  else if (roll < up + down) D.nudge(all(-1), 0, D.total, null, true)
  // a streak: 35% of seasons, three games (football) or six (basketball), one grade either way
  if (r() < 0.35) {
    const len = sportOf(c).isBucket ? 6 : 3
    const from = 2 + Math.floor(r() * Math.max(1, D.total - len - 3))
    const hot = r() < 0.55
    D.nudge(all(hot ? 1 : -1), from, from + len, hot ? 'HOT STREAK' : 'COLD STRETCH')
  }
}
// Picks a saved season back up: the director rebuilt from its own data
export function resumeSeason(c) {
  const D = director(c, c.simTeam, c.active.base, c.active.seed)
  D.restore(c.active.snap)
  return D
}
const withSnap = (c, D, more = {}) => ({ ...c, active: { ...c.active, ...more, snap: D.snapshot() } })
// Advance: one week of football, or a run of games in basketball. Stops at a
// moment to decide, an injury to deal with, or the end of the regular season.
// Returns what happened for the screen (sounds, haptics).
export function advanceWeek(c, D) {
  const S = sportOf(c)
  const a = c.active
  if (a.moment || a.injury) return [c, null]
  if (a.k >= D.total) return [c, null]
  const feed = [...a.feed]
  const chunk = { k0: a.k + 1, games: [], hits: [], headline: [] }
  let k = a.k, injury = null, moment = null, last = null
  // (a registered sport's own story beats: baseball's call-up, the All-Star break, a milestone; `stop` ends the run there)
  const beats = {}, told = []
  let halt = false
  const inj = S.x?.injuries?.(c) ?? null, INJ = inj?.list ?? S.injuries, ENDERS = inj?.enders ?? S.seasonEnders
  for (let n = 0; n < S.step && k < D.total && !injury && !moment && !halt; n++) {
    k++
    const hits = D.observe(k)
    const g = D.games[k - 1]
    const headline = D.headlines.filter(h => h.at === k).map(h => h.text)
    if (a.benched && a.benched.weeks < D.total && k === a.benched.weeks + 1) {
      const b = a.benched, w = b.why
      const note = !w ? `${c.name} is named the starter. ${b.behind} goes to the bench.`
        : w.kind === 'hurt' ? `${b.behind} ${w.what}: ${w.wks ? `out ${w.wks} weeks` : 'out for the season'}. ${c.name} is the starter${w.wks ? `, and if he plays well the job stays his when ${b.behind.split(' ').filter(w => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w)).pop()} is back` : ''}.`
        : w.kind === 'traded' ? `The ${nickOf(S, c.team)} trade ${b.behind} to the ${nickOf(S, w.to)}. ${c.name} is the starter.`
        : `${b.behind} is benched after a rough stretch. ${c.name} is the starter.`
      feed.push({ k, note, noteKind: w?.kind === 'hurt' ? 'INJURY · DEPTH CHART' : 'DEPTH CHART' })
    }
    const bt = S.x?.beat ? S.x.beat({ ...c, active: { ...a, ...beats } }, D, k) : null
    if (bt) { for (const x of bt.notes ?? []) told.push({ k, ...x }); Object.assign(beats, bt.set ?? {}); if (bt.stop) halt = true }
    if (S.step === 1) feed.push({ k, g, hits, headline })
    else { chunk.games.push(g); chunk.hits.push(...hits); chunk.headline.push(...headline) }
    last = { g, hits }
    // an injury: the body, the age and a little luck
    const r = seeded(`${c.seed}-inj-${c.year}-${k}`)
    // mostly luck, and the body (durability: from his frame, raised with body work) moves it.
    // (2026-11-08: 0.019 a game, the body's pull 0.15 a step, was 0.013 and 0.1: a thin frame gets hurt
    // a little more often than a thick one now, and a football season loses about a game and a half,
    // not under one.) Football: about one season in three has an injury at a C+, one in four at a B+,
    // one in eight at 10; one in about twelve of them ends the season (S.injSerious)
    // (soccer and baseball keep the odds from before: S.oldInjuries)
    const perGame = S.oldInjuries ? 0.013 * (1 + clamp(5.5 - c.durability, -5.5, 5.5) * 0.1) : INJ_RATE * clamp(1 + (5.5 - c.durability) * INJ_PULL, 0.3, 1.8)
    const risk = perGame * (c.age >= 31 ? 1.25 : 1) * (g?.sat ? 0 : 1) * S.injScale
    if (k < D.total && r() < risk && !c.injuries.some(i => i.year === c.year + 1 && i.at > k - 4 / S.injScale)) {
      // what it is (the common ones more often), and how long; one in about twenty is a season-ender (an ACL, an Achilles)
      const tot = INJ.reduce((a, x) => a + (x[3] ?? 1), 0)
      let roll = r() * tot, pick = INJ[0]
      for (const x of INJ) { roll -= x[3] ?? 1; if (roll <= 0) { pick = x; break } }
      const [kind0, lo, hi] = pick
      let games = lo + Math.floor(r() * (hi - lo + 1))
      const serious = r() < (S.injSerious ?? (S.oldInjuries ? 0.05 : 0.08))
      const kind = serious ? ENDERS[Math.floor(r() * ENDERS.length)] : kind0
      if (!serious) games = Math.min(games, D.total - k)   // (a long one late in the year: out the rest of it, but not a season-ender)
      injury = { kind, games: serious ? D.total - k : games, serious, at: k }
      break
    }
    // no decisions while you're sitting out (hurt, or not yet the starter): the
    // next game goes on without you, and a season-ending injury ends them all
    const stop = D.stops.find(s => s.at === k || (s.kind === 'playoffs' && k === D.total && s.at === D.total))
    const sitting = a.out || (k < D.total ? D.sat.includes(k) : D.sat.includes(D.total - 1))
    if (stop && !sitting) moment = D.open(stop)
  }
  if (S.step > 1 && chunk.games.length) feed.push({ k, chunk: true, ...chunk, k1: k })
  feed.push(...told)   // (after the run of games they happened in: the newest is on top)
  let next = withSnap(c, D, { k, feed, ...beats })
  if (injury) { next = withSnap(next, D, { injury }); return [next, { injury, game: last?.g, hits: last?.hits }] }
  if (moment) next = withSnap(next, D, { moment })
  return [next, { game: last?.g, hits: last?.hits, moment, done: k >= D.total && !moment }]
}
export function chooseMoment(c, D, option) {
  const m = c.active.moment
  const outcome = D.choose(m, option)
  const feed = [...c.active.feed, { k: c.active.k, moment: m, option, outcome }]
  // a lasting change to the body (durability), beyond this season
  const e = option.effect ?? {}
  const dur = (e.gamble ? (outcome?.hit ? e.gamble.hit : e.gamble.miss) : e)?.dur ?? 0
  let cc = dur ? { ...c, durability: r10(clamp(c.durability + dur, 1, 10)) } : c
  // a deadline deal: the player joins the roster (the team's grades follow from it)
  if (e.trade) { cc = signDeal(cc, e.trade); D.deals = () => dealsFor(cc) }
  return [withSnap(cc, D, { moment: null, feed }), outcome]
}
// ── Career boosts (lib/progress.js BOOSTS; the hub spends them) ──
// Hot Hand: two grades up in every trait for the next 3 games (6 in basketball), twice
// a hot streak's lift. Not while hurt, out, sitting the next game (a backup),
// at a decision, or once it's running.
export const hotGames = c => (sportOf(c).isBucket ? 6 : 3)
export const hotHandOn = c => !!c.active?.hot && c.active.k < c.active.hot.to
export const canHotHand = (c, D) => {
  const a = c.active
  return !!a && !!D && !a.moment && !a.injury && !a.po && !a.out && a.k < D.total && !(D.sat ?? []).includes(a.k) && !hotHandOn(c)
}
export function hotHand(c, D) {
  const a = c.active
  if (!canHotHand(c, D)) return c
  const from = a.k, to = Math.min(D.total, a.k + hotGames(c)), n = to - from
  D.nudge({ attr: Object.fromEntries(c.types.map(t => [t, 2])) }, from, to, 'HOT HAND')
  const S = sportOf(c)
  const feed = [...a.feed, { k: a.k, note: `${c.name} is feeling it: two grades up in every trait for the next ${n} ${n === 1 ? S.gameWord.toLowerCase() : `${S.gameWord.toLowerCase()}s`}.`, noteKind: 'HOT HAND' }]
  return withSnap(c, D, { hot: { from, to }, feed })
}

// Injury: sit it out, or play through (traits down for longer, and it can get worse).
// heal (Quick Heal): sit out half as long
export function resolveInjury(c, D, play, heal = false) {
  const S = sportOf(c)
  const inj = c.active.injury, at = c.active.k
  const r = seeded(`${c.seed}-injres-${c.year}-${at}`)
  // wear: off his durability now (the knocks heal over the offseason: healDurability); lasting: off the body's
  // own level too (durBase), for good. A season-ender lasts, so does playing on one until it gives out
  let text, wear = inj.serious ? 0.6 : 0.2, lasting = inj.serious ? 0.4 : inj.games >= S.bigInjury ? 0.15 : 0
  if (play && !inj.serious) {
    const worse = r() < 0.35
    wear += worse ? 0.5 : 0.3   // (playing on it costs the body more, and more again when it gives out)
    lasting += worse ? 0.15 : 0.05
    const attr = Object.fromEntries(S.physical[c.pos].slice(0, 2).map(t => [t, -1]))
    D.choose({ id: 'injury', stop: { at, kind: 'season' }, title: inj.kind }, { label: 'play through it', effect: { window: inj.games + 2, attr } })
    if (worse) { D.sidelined(at + 1, inj.games); text = `Played through the ${inj.kind}, then it got worse. Out ${inj.games} games.` }
    else text = `Playing through the ${inj.kind}. Not himself for ${inj.games + 2} games.`
  } else if (heal && !inj.serious) {
    const games = Math.max(1, Math.ceil(inj.games / 2))
    D.sidelined(at, games)
    text = `Quick Heal: out ${games} ${games === 1 ? 'game' : 'games'} with the ${inj.kind}, not ${inj.games}.`
  } else {
    D.sidelined(at, inj.games)
    text = inj.serious ? `${inj.kind}: season over.` : `Out ${inj.games} games with the ${inj.kind}.`
  }
  const injuries = [...c.injuries, { year: c.year + 1, at, kind: inj.kind, games: inj.games, played: !!play, serious: !!inj.serious }]
  const feed = [...c.active.feed, { k: at, injuryText: text }]
  // each injury wears the body a little (0.2: at 0.4 a few early ones spiralled into a fragile career); playing through it, more
  return [withSnap({ ...c, injuries, durability: r10(Math.max(1, c.durability - wear)), ...(lasting ? { durBase: r10(Math.max(1, durBaseOf(c) - lasting)) } : {}) }, D, { injury: null, feed, ...(inj.serious ? { out: true } : {}) }), text]
}
// The regular season's over: book it, or go into the playoffs (a bracket of
// our own, one skill moment a round, played on the hub)
export function finishRegular(c, D) {
  const f = D.finalize()
  if (sportOf(c).x?.finishLeague) return sportOf(c).x.finishLeague(c, f)
  if (!sportOf(c).made(f)) return bookSeason({ ...c, active: { ...c.active, final: f, po: null } })
  // out for the season: the team plays the playoffs without you, no moments
  if (c.active.out) return bookSeason({ ...c, active: { ...c.active, final: f, po: watchBracket(c, buildBracket(c, f)) } })
  return { ...c, active: { ...c.active, final: f, po: buildBracket(c, f) } }
}
const strength = t => ((t.off ?? 5) + (t.def ?? 5)) / 2
// How often a playoff game comes down to the end: about half of them, fewer the more lopsided it is
export const closeChance = p => clamp(0.62 - Math.abs(p - 0.5) * 0.8, 0.35, 0.62)
// best of seven: the chance to take four games first, at g a game
export const bestOf7 = g => [0, 1, 2, 3].reduce((s, k) => s + [1, 4, 10, 20][k] * g ** 4 * (1 - g) ** k, 0)
// Basketball's round: the matchup (the same scale as football's game) as one game of it, about half
// as far from even (one NBA game swings less than one NFL playoff game), 22-78%; a series, best of seven (4-95%)
const bucketRoundOdds = (base, series) => { const g = clamp(0.5 + (base - 0.5) * 0.5, 0.22, 0.78); return Math.round((series ? bestOf7(g) : g) * 100) / 100 }
// Any length of series (baseball plays best of 3, 5 and 7): n games, the first to need = (n + 1) / 2 wins it.
// A round's length is rd.bestOf (seven when it has none: basketball's, which runs on the best-of-seven lines as they were)
export const seriesLen = rd => rd?.bestOf ?? 7
const choose = (n, k) => { let x = 1; for (let i = 1; i <= k; i++) x = x * (n - k + i) / i; return x }
// best of n: the chance to take need games first, at g a game
export const bestOf = (n, g) => { if (n === 7) return bestOf7(g); const need = (n + 1) / 2; let s = 0; for (let k = 0; k < need; k++) s += choose(need - 1 + k, k) * g ** need * (1 - g) ** k; return s }
// the game rate a series' odds come from (bestOf turned around)
export const gameOf = (p, n = 7) => { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (bestOf(n, m) > p) hi = m; else lo = m } return (lo + hi) / 2 }
// a series from a-b on, at g a game: the chance to get to need (four in a best of seven) first
export const seriesFrom = (g, a, b, need = 4) => (a >= need ? 1 : b >= need ? 0 : g * seriesFrom(g, a + 1, b, need) + (1 - g) * seriesFrom(g, a, b + 1, need))
// A last-play moment in a series decides one game of it, the need-th (game 4 of seven, 3 of five, 2 of three):
// the ones before it played at the series' own game rate (seeded, so the screen and the result agree on the score going in)
export function seriesState(c, idx, rd) {
  const n = seriesLen(rd), need = (n + 1) / 2
  const g = gameOf(rd.p, n), r = seeded(`${c.seed}-${c.year}-${idx}-series`)
  let a = 0
  for (let i = 0; i < need - 1; i++) if (r() < g) a++
  return { a, b: need - 1 - a, g, need }
}
// that game by his moment, then the rest of the series at g: { won, my, opp } (the series score)
export function seriesPlay(c, idx, rd, LAST, hit, h) {
  const { a, b, g, need } = seriesState(c, idx, rd), r = seeded(`${c.seed}-${c.year}-${idx}-series-rest`)
  let x = a, y = b
  if (hit || (LAST === 'hit' && r() < clamp((g - h) / (1 - h), 0.03, 0.97))) x++; else y++
  while (x < need && y < need) { if (r() < g) x++; else y++ }
  return { won: x === need, my: x, opp: y }
}
function buildBracket(c, f) {
  const S = sportOf(c)
  const r = seeded(`${c.seed}-po-${c.year}`)
  const mine = S.teamOf(c.team)
  const lg = t => ({ ...t, off: t.off + (c.league?.[t.short]?.off ?? 0), def: t.def + (c.league?.[t.short]?.def ?? 0) })
  const pool = conf => S.teams.map(t => S.teamOf(t.short)).filter(t => t.conf === conf && t.short !== c.team).map(lg).sort((a, b) => (strength(b) + r() * 1.5) - (strength(a) + r() * 1.5))
  const confs = [...new Set(S.teams.map(t => S.teamOf(t.short).conf))]
  const same = pool(mine.conf), other = pool(confs.find(x => x !== mine.conf) ?? mine.conf)
  const myStr = strength(c.simTeam ?? mine)
  const seed = f.seed ?? 4
  const names = S.isBucket ? (seed >= 7 ? ['Play-In', ...S.rounds] : S.rounds) : (f.hasBye ? S.rounds.slice(1) : S.rounds)
  const rounds = names.map((name, i) => {
    const fin = name === S.final, playIn = name === 'Play-In'
    const ri = S.isBucket ? (playIn ? -1 : i - (seed >= 7 ? 1 : 0)) : i   // the round inside the main bracket
    const opp = fin ? other[Math.floor(r() * 3)] : playIn ? same[Math.min(same.length - 1, 6 + Math.floor(r() * 3))] : same[Math.min(same.length - 1, (S.isBucket ? Math.max(0, 3 - ri) : (f.hasBye ? ri : ri + 1)) * 2 + Math.floor(r() * 2))]
    const home = fin ? null : S.isBucket ? (playIn ? seed <= 8 : ri === 0 ? seed <= 4 : seed <= 2) : f.hasBye ? i === 0 : i === 0 && f.wins >= 11
    // (a true star tilts a series or a playoff game more: up to +0.07 more at 99)
    const base = 0.5 + (myStr - strength(opp)) * 0.08 + (home ? 0.06 : home === false ? -0.03 : 0) + ((c.ovr - 76) / 100) * 0.35 + Math.max(0, c.ovr - 95) * 0.018
    // p is the chance to win the round, the one the card shows and playoffRound uses. Football: the game.
    // Basketball: the series, from the chance to win one game of it (a best of seven turns a 65% team
    // into an 80% one; the best teams there are, the '96 Bulls or the '17 Warriors, about 95%)
    const p = S.isBucket ? bucketRoundOdds(base, !playIn) : clamp(Math.round(base * 100) / 100, 0.18, 0.84)
    // close: the game comes down to the end. Every round has its moment; in football only a close one can
    // deal a last-play moment (playoffGame). Basketball rolls it too (the draw stays the same) and ignores it
    const close = r() < closeChance(p)
    // (pw: the same round with the team playing it without him, for a season he finishes hurt)
    return { name, opp: opp.short, oppName: opp.name, home, p, played: false, series: S.series && !playIn, close: S.isBucket || close, ...(S.isBucket ? { pw: bucketRoundOdds(base - 0.12, !playIn) } : {}) }
  })
  return { idx: 0, rounds, line: [], used: [], stage: 'round', won: false, out: false }
}
// The bracket played out from the sideline: each round on the team's odds, no stat line
function watchBracket(c, po) {
  const S = sportOf(c)
  const r = seeded(`${c.seed}-pow-${c.year}`)
  const line = []
  for (const rd of po.rounds) {
    const won = r() < (rd.pw ?? clamp(rd.p - 0.12, 0.08, 0.9))
    let mySc, oppSc
    if (rd.series) { const o = [0, 1, 1, 2, 2, 3][Math.floor(r() * 6)]; mySc = won ? 4 : o; oppSc = won ? o : 4 }
    else if (S.isBucket) { mySc = 98 + Math.floor(r() * 18); oppSc = won ? mySc - 1 - Math.floor(r() * 12) : mySc + 1 + Math.floor(r() * 12) }
    else { mySc = 14 + Math.floor(r() * 18); oppSc = won ? Math.max(3, mySc - 1 - Math.floor(r() * 12)) : mySc + 1 + Math.floor(r() * 12) }
    line.push({ ...rd, played: true, won, mySc, oppSc, sat: true })
    if (!won) break
  }
  const last = line[line.length - 1]
  const won = !!last?.won && last.name === S.final
  return { ...po, rounds: po.rounds.map((x, i) => line[i] ?? x), line, idx: line.length - 1, stage: 'done', won, out: !won }
}
// The round turns on its moment, and the chance the card shows is the chance it is: land it and the
// odds go up, miss it and they go down, by as much either way that across his usual hits and misses the
// round is still won p of the time. A miss hurts most when it was likely to go in: a 95% team that misses
// is still about 70% to win its series, a 60% one about 20%; a hit takes a 20% underdog to about 30%.
// the moments that are the game's last play (lib/situations.js has their clocks): see playoffRound
// (soccer's: a late chance from the 82nd minute on, level or a goal up: his goal wins it, a miss leaves it to the odds)
const LAST_PLAY = { 'clutch-shot': 'both', 'two-minute': 'both', 'goal-line': 'both', 'free-throws': 'hit', lockdown: 'hit', 'rim-protect': 'hit', penalty: 'hit', 'one-on-one': 'hit', header: 'hit', volley: 'hit', 'free-kick': 'hit', 'two-on-one': 'hit' }
const logit = x => Math.log(x / (1 - x)), sigmoid = x => 1 / (1 + Math.exp(-x))
const MOMENT_SWING = 1.3   // a hit or a miss, in log-odds off the round's own (the shift below keeps the average at p)
// how often the moment's game goes in: the rate the Career sim lands it at for his grade (MiniGame's sim, 45% at a 1, 92% at an 11)
export const momentHitRate = (c, game) => clamp(0.45 + 0.47 * (traitValue(game, c?.build) - 1) / 10, 0.45, 0.92)
// p: the round. h: how often he lands it. score and round are no longer used (a round's difficulty is its opponent, in p)
export const momentOdds = (p, hit, score = 0.75, round = 0, h = 0.7) => {
  const q = clamp(p, 0.02, 0.98), L = logit(q)
  let lo = -8, hi = 8
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (h * sigmoid(L + m + MOMENT_SWING) + (1 - h) * sigmoid(L + m - MOMENT_SWING) > q) hi = m; else lo = m }
  return sigmoid(L + (lo + hi) / 2 + (hit ? MOMENT_SWING : -MOMENT_SWING))
}
// The round as it will be played: all (the chance to win it, the one the card shows), hit and miss (the
// odds after landing or missing the moment). A last-play moment decides it (see LAST_PLAY), so there the
// chance is his own: 'both' is how often he lands it; 'hit', that or the odds after a miss, set so the
// round stays at p when it can (when he lands it more often than p, he's better than p there).
// game null with off: no moment (Career's mini games set to None), the round on its odds
// A basketball series: the last play decides game 4 only (seriesState), the rest is played at the series'
// game rate g. Won game 4, the series is his three of the other six (W1); lost it, four of six (W0).
// idx (the round's): adds state, the score going into game 4 and the series odds after a hit or a miss
export function roundOdds(c, rd, game = null, off = false, idx = null) {
  const p = rd.p
  if (off) return { all: p, hit: p, miss: p }
  const h = momentHitRate(c, game), LAST = lastPlayOf(c, rd, game)
  if (LAST && rd.series) {
    // (any length: won the deciding-moment game, he needs need - 1 of the other n - 1 (W1); lost it, need of them (W0))
    const n = seriesLen(rd), need = (n + 1) / 2, m = n - 1
    const g = gameOf(p, n), q = LAST === 'both' ? 0 : clamp((g - h) / (1 - h), 0.03, 0.97)
    const tail = from => { let s = 0; for (let k = from; k <= m; k++) s += choose(m, k) * g ** k * (1 - g) ** (m - k); return s }
    const W1 = n === 7 ? [3, 4, 5, 6].reduce((s, k) => s + [20, 15, 6, 1][k - 3] * g ** k * (1 - g) ** (6 - k), 0) : tail(need - 1)
    const W0 = n === 7 ? [4, 5, 6].reduce((s, k) => s + [15, 6, 1][k - 4] * g ** k * (1 - g) ** (6 - k), 0) : tail(need)
    const G = h + (1 - h) * q, out = { all: G * W1 + (1 - G) * W0, hit: W1, miss: q * W1 + (1 - q) * W0, game: q }
    if (idx == null) return out
    const { a, b } = seriesState(c, idx, rd), win = seriesFrom(g, a + 1, b, need), lose = seriesFrom(g, a, b + 1, need)
    return { ...out, state: { a, b, need, win, lose, miss: q * win + (1 - q) * lose } }
  }
  if (LAST === 'both') return { all: h, hit: 1, miss: 0 }
  if (LAST === 'hit') { const miss = clamp((p - h) / (1 - h), 0.03, 0.97); return { all: h + (1 - h) * miss, hit: 1, miss } }
  return { all: p, hit: momentOdds(p, true, 0.75, 0, h), miss: momentOdds(p, false, 0.75, 0, h) }
}
// the round's last-play rule for this game, or null: football only plays one in a game that's close at
// the end (rd.close, closeChance); basketball always (a series' game 4, or the play-in)
export const lastPlayOf = (c, rd, game) => (LAST_PLAY[game] && (sportOf(c).isBucket || rd?.close !== false) ? LAST_PLAY[game] : null)
// The round's moment game (the hub deals it, the result is played on it). A football game that isn't
// close at the end deals a regular moment, not a last play (every position has one).
// allow: Simple mode's own filter
export function playoffGame(c, po, allow = null) {
  // (a sport can rule a moment out for this game: baseball deals a walk-off only when his club bats last)
  const own = sportOf(c).x?.allowGame?.(c, po)
  if (own) { const ask = allow; allow = g => own(g) && (!ask || ask(g)) }
  const rd = po.rounds[po.idx], seed = `${c.seed}-${c.year}-${po.idx}`, used = po.line.map(x => x.game).filter(Boolean)
  const open = rd && !sportOf(c).isBucket && !sportOf(c).isSoccer && rd.close === false
  return (open && pickMomentGame(c.pos, seed, used, g => !LAST_PLAY[g] && (!allow || allow(g)))) || pickMomentGame(c.pos, seed, used, allow)
}
// The chance the round card shows. Football: blended by how often a game is close at the end
// (closeChance): close, the moment it deals (a last play or not); not close, a regular one, at p
export function cardOdds(c, po, allow = null, off = false) {
  const rd = po.rounds[po.idx], S = sportOf(c)
  if (off) return rd.p
  if (S.isBucket || S.isSoccer || S.isBaseball) return roundOdds(c, rd, playoffGame(c, po, allow), false, po.idx).all
  const cc = closeChance(rd.p), closeRd = { ...rd, close: true }
  return cc * roundOdds(c, closeRd, playoffGame(c, { ...po, rounds: po.rounds.map((x, i) => (i === po.idx ? closeRd : x)) }, allow)).all + (1 - cc) * rd.p
}
// how deep a round is, counted back from the final (3): the same with a bye or a play-in
export const momentRound = po => Math.max(0, 3 - (po.rounds.length - 1 - po.idx))
// A round with no moment: the matchup's own odds (round is no longer used)
export const blowoutOdds = (p, round = 0) => p
// This round's moment is in: the result, with a stat line sized to the season
// hit: the drill's own verdict (MiniGame), the same one it showed the player
export function playoffRound(c, score, game = null, hit = score >= 0.5, pts = null) {
  const S = sportOf(c)
  if (S.x?.round) return S.x.round(c, score, game, hit, pts)
  const a = c.active, po = a.po, f = a.final
  const rd = po.rounds[po.idx]
  const r = seeded(`${c.seed}-por-${c.year}-${po.idx}`)
  // auto (score null): no moment, Career's mini games are set to None; the round on its own odds
  const auto = score == null
  const odds = roundOdds(c, rd, game, auto)
  let won = r() < (auto ? odds.all : hit ? odds.hit : odds.miss)
  // the last play of the game: what he did decides it, nobody gets the ball back after a buzzer-beater or a walk-off.
  // both: land it and win, miss it and lose. hit: a stop or the free throws at the end win it; a miss leaves it to the odds
  const LAST = lastPlayOf(c, rd, game)
  // (a basketball series: it decides game 4, and the series plays on from there)
  const ser = !auto && LAST && rd.series ? seriesPlay(c, po.idx, rd, LAST, hit, momentHitRate(c, game)) : null
  if (ser) won = ser.won
  else if (!auto && LAST) { if (hit) won = true; else if (LAST === 'both') won = false }
  if (auto) score = won ? 0.8 : 0.25
  const k = 0.82 + score * 0.5 + (r() - 0.5) * 0.2             // the moment sets the day: 0.6–1.4× a normal game
  let mySc, oppSc, line
  if (S.isBucket) {
    // a series the winner was expected to take goes four or five; an even one, six or seven
    if (rd.series) { const fav = won ? rd.p : 1 - rd.p, len = fav >= 0.8 ? [0, 0, 1, 1] : fav >= 0.55 ? [1, 2, 2, 3] : [2, 3, 3], other = len[Math.floor(r() * len.length)]; mySc = ser ? ser.my : won ? 4 : other; oppSc = ser ? ser.opp : won ? other : 4 }
    else { const gap = auto ? 15 + Math.floor(r() * 16) : 1 + Math.floor(r() * 8); if (won) { mySc = Math.round(100 + score * 12 + r() * 10); oppSc = Math.max(80, mySc - gap) } else { oppSc = Math.round(104 + r() * 16); mySc = Math.max(80, oppSc - gap) } }
    const st = seasonStats(c.pos, f)
    // a series is four to seven games: the average barely moves off the season's (0.85–1.15×), never past a real ceiling
    const kb = clamp(0.9 + score * 0.18 + (r() - 0.5) * 0.08 + (won ? 0.02 : -0.03), 0.84, 1.15)
    line = { pts: r10(Math.min(st.ppg * kb, 42)), reb: r10(Math.min(st.rpg * kb, 17)), ast: r10(Math.min(st.apg * kb, 13)), perGame: true }
  } else {
    const g = f.wins + f.losses || 17
    const n = (sum, mult = 1) => Math.max(0, Math.round(((sum ?? 0) / g) * k * mult))
    // close: one score. Not close: two scores or more
    const gap = auto ? 14 + Math.floor(r() * 15) : 1 + Math.floor(r() * 8)
    // (the winner's score is a real one, and the loser's comes off it: a loss used to stack the gap on top
    // of his team's own points, so the other team kept putting up 50 and 60)
    if (won) { mySc = Math.round(17 + (c.simTeam?.off ?? 5) * 1.2 + score * 8 + r() * 6); oppSc = Math.max(3, mySc - gap) }
    else { oppSc = Math.round(24 + r() * 14); mySc = Math.max(3, oppSc - gap) }
    line = c.pos === 'qb' ? { passYds: n(f.seasonPassYds), tds: n(f.seasonTDs, won ? 1.1 : 0.8), ints: Math.round((1 - score) * 2 * r()), rushYds: n(f.seasonRushYds) }
      : c.pos === 'db' ? { tackles: n(f.seasonTackles), ints: n(f.seasonINTs, won ? 1.4 : 0.6), pbus: n(f.seasonPBUs) }
      // (sacks come in ones: a rate rounds to the same number every game, so it's a roll around his rate)
      : c.pos === 'dl' ? (() => { const roll = (sum, mult = 1) => Math.floor(((sum ?? 0) / g) * k * mult + r()); const sacks = roll(f.seasonSacks, won ? 1.25 : 0.75); return { sacks, tfl: sacks + roll(Math.max(0, (f.seasonTFL ?? 0) - (f.seasonSacks ?? 0))), tackles: Math.max(sacks, n(f.seasonTackles)), qbHits: sacks + roll(Math.max(0, (f.seasonQBHits ?? 0) - (f.seasonSacks ?? 0))), ff: roll(f.seasonFF), fr: 0, pbus: roll(f.seasonPBUs), safeties: 0 } })()
      : c.pos === 'lb' ? (() => { const roll = (sum, mult = 1) => Math.floor(((sum ?? 0) / g) * k * mult + r()); const sacks = roll(f.seasonSacks, won ? 1.2 : 0.8), ints = roll(f.seasonINTs, won ? 1.4 : 0.6); return { tackles: Math.max(sacks, n(f.seasonTackles)), tfl: sacks + roll(Math.max(0, (f.seasonTFL ?? 0) - (f.seasonSacks ?? 0))), sacks, qbHits: sacks + roll(Math.max(0, (f.seasonQBHits ?? 0) - (f.seasonSacks ?? 0))), pds: ints + roll(Math.max(0, (f.seasonPDs ?? 0) - (f.seasonINTs ?? 0))), ints, pickSixes: 0, ff: roll(f.seasonFF), fr: 0, missed: 0 } })()
      : c.pos === 'ol' ? (() => { const st = seasonStats('ol', f), roll = (sum, mult = 1) => Math.max(0, Math.floor(((sum ?? 0) / g) * mult + r())); return { pancakes: roll(st.pancakes, k), prs: roll(st.prs, (won ? 0.85 : 1.25) / k), sacksA: roll(st.sacksA, (won ? 0.6 : 1.5) / k), pen: roll(st.pen) } })()
      : c.pos === 'rb' ? { rushYds: n(f.seasonRushYds), rushTDs: n(f.seasonRushTDs, won ? 1.2 : 0.7), recTDs: 0, recYds: n(f.seasonRecYds), carries: n(f.seasonCarries) }
      : { rec: n(f.seasonRecs), recYds: n(f.seasonRecYds), recTDs: n(f.seasonRecTDs, won ? 1.3 : 0.6) }
  }
  // a one-game moment: the final grows out of the score it was played at (the odds above decided who won)
  let swing = null
  if (!auto && !rd.series && game) {
    const seed = `${c.seed}-${c.year}-${po.idx}`
    const end = finalScore(momentSituation(game, seed, { us: c.team, them: rd.opp }), game, won, hit, seed, pts)
    mySc = end.mine; oppSc = end.opp; swing = end.note
    // (he can't score the touchdown that won it and have none in the box score)
    if (hit && (game === 'two-minute' || game === 'goal-line')) {
      const key = c.pos === 'qb' ? 'tds' : c.pos === 'rb' ? 'rushTDs' : 'recTDs'
      if (line[key] != null) line[key] = Math.max(1, line[key])
    }
  }
  // (his touchdowns are on the board: a team can't score fewer points than the touchdowns he had in the box score,
  // and a loss stays a loss)
  if (!S.isBucket && line) {
    const tds = (line.tds ?? 0) + (line.rushTDs ?? 0) + (line.recTDs ?? 0)
    if (tds && mySc < 6 * tds) {
      mySc = 7 * tds
      if (!won && oppSc <= mySc) oppSc = mySc + 1 + Math.floor(r() * 7)
      if (won && oppSc >= mySc) mySc = oppSc + 3
    }
  }
  // (a football final is a real football score: the loser's points came off the winner's by a gap, and a
  // 24-point game minus a 20-point gap was a team that scored 4. Field goals and touchdowns only, the
  // result kept: 2026-11-08)
  if (!S.isBucket && !S.isSoccer && !S.isBaseball && !rd.series) {
    mySc = snapNFL(mySc); oppSc = snapNFL(oppSc)
    if (won && mySc <= oppSc) mySc = snapNFL(oppSc + 3)
    if (!won && oppSc <= mySc) oppSc = snapNFL(mySc + 3)
  }
  const entry = { ...rd, played: true, won, mySc, oppSc, score, hit, auto, swing, game: auto ? null : game, ...line }
  const rounds = po.rounds.map((x, i) => (i === po.idx ? entry : x))
  const fin = rd.name === S.final
  const done = !won || fin
  return { ...c, active: { ...a, po: { ...po, rounds, line: [...po.line, entry], idx: done ? po.idx : po.idx + 1, stage: done ? 'done' : 'round', won: won && fin, out: !won } } }
}
// Playoffs over (or none): the season is booked, then the offseason
export function bookSeason(c) {
  const S = sportOf(c)
  const f = c.active.final, po = c.active.po
  // the award needs a season that would really win it: the voters' pick and the numbers
  const started = (f.games ?? []).filter(g => !g.sat)     // the games he played (a backup's starts)
  // and he has to have played enough of the season to be in the conversation
  const share = started.length / Math.max(1, (f.games ?? []).length)
  const can = k => share >= S.minGames[k] - 1e-9
  const benched = c.active.benched?.weeks ?? 0
  // (soccer books its own season: the league, the cup, Europe, the World Cup and the Ballon d'Or)
  const s = S.x?.season ? S.x.season(c, f, po) : (() => {
  const stats = seasonStats(c.pos, f)
  const award = can('award') && S.award(c, f, stats)
  const allPro = can('first') && S.allPro[c.pos](stats, c)
  const missed = (f.story?.sat ?? 0)
  const rounds = (po?.line ?? []).map(x => ({ round: x.name, opponent: x.oppName, won: x.won, mySc: x.mySc, oppSc: x.oppSc, series: !!x.series }))
  const fin = rounds.find(x => x.round === S.final)
  return {
    year: c.year + 1, season: c.season, age: c.age, team: c.team, teamName: c.fit.name, ovr: c.ovr, role: c.role, ...(c.pos === 'dl' ? { spot: dlSpot(c) } : c.pos === 'ol' ? { spot: olSpot(c) } : {}),
    wins: f.wins, losses: f.losses, playoffs: S.made(f) && !(po?.line?.[0]?.name === 'Play-In' && !po.line[0].won), champion: !!po?.won, rounds, sb: fin ? { won: fin.won, mySc: fin.mySc, oppSc: fin.oppSc, series: fin.series } : null,
    stats, adv: seasonRaw(c.pos, f, started), award, awardName: S.awardName[c.pos], proBowl: (can('honor') && S.proBowl[c.pos](stats, c)) || award || allPro, allPro: allPro || (award && S.allProNear[c.pos](stats, c)),
    missed, benched, records: (f.story?.records ?? []).map(x => x.label ?? x.id), milestones: (f.story?.milestones ?? []).filter(m => m.big).map(m => m.label),
    goals: started.length || c.role !== 'Backup' ? c.goals.map(g => ({ ...g, met: goalMet(g, { stats, wins: f.wins, starts: started.length, startWins: started.filter(x => x.won).length }) })) : [], xp: f.story?.xp ?? 0, bestGame: f.bestGame ?? null,
    poStats: po && po.line.some(x => !x.sat) ? po.line.filter(x => !x.sat).reduce((acc, x) => { for (const k of S.lineKeys) if (x[k] != null) acc[k] = (acc[k] ?? 0) + x[k]; return acc }, { games: po.line.filter(x => !x.sat).length }) : null,
  }
  })()
  // the career records (a lineman's: Pro Bowls, All-Pros, starts): set the season he passes the mark
  const careerRecs = (RECORDS[c.sport]?.[c.pos] ?? []).filter(x => x.career)
  if (careerRecs.length) {
    const tt = careerTotals({ ...c, seasons: [...c.seasons, s] })
    for (const x of careerRecs) if ((x.career(tt) ?? 0) > x.value && !c.seasons.some(p => (p.records ?? []).includes(x.label))) s.records = [...s.records, x.label]
  }
  // records this career set: next season's bar is its own number, not the league's
  const recordBook = { ...(c.recordBook ?? {}) }
  for (const x of f.story?.records ?? []) if (x.id && typeof x.raw === 'number' && x.raw > (recordBook[x.id]?.value ?? -Infinity)) recordBook[x.id] = { value: x.raw, holder: `${c.name}, ${c.season}` }
  const contract = { ...c.contract, left: Math.max(0, c.contract.left - 1) }
  const perf = seasonScore(c.pos, s)
  // the smaller honors: best rookie, and the MVP of the final (the quarterback's unless he sat)
  if (!S.isSoccer && !S.isBaseball) s.roy = c.seasons.length === 0 && can('honor') && perf >= 0.55   // (baseball votes its own: lib/careerBaseball.js)
  const finLine = po?.line?.find(x => x.name === S.final)
  if (!S.isSoccer && !S.isBaseball) s.fmvp = !!po?.won && !!finLine && !finLine.sat && seeded(`${c.seed}-fmvp-${c.year}`)() < (c.role === 'Backup' ? 0.05 : c.pos === 'qb' ? 0.85 : perf >= 0.7 ? 0.8 : perf >= 0.45 ? 0.45 : 0.1)
  // a development point a year; one more for an award (MVP, OPOY, DPOY, Rookie of the Year), one more for All-Pro / All-NBA
  // offseason work: 2 points while young, 1 through the prime, none once the body
  // turns (honors still earn theirs, and so does camp)
  const S0 = sportOf(c)
  const base = (c.age <= S0.devYoung(c.pos) ? 2 : c.age < S0.devPrime(c.pos) ? 1 : 0)
  // (soccer: a Golden Boot is the striker's yearly honor, not a rare one, so it earns no point of its own)
  const dev = { ...c.dev, points: c.dev.points + base + (s.award || s.roy ? 1 : 0) + (s.allPro && !S.isSoccer ? 1 : 0) }
  const rep = clamp(c.rep + (s.goals.filter(g => g.met).length >= 2 ? 1 : 0) + (s.champion ? 1 : 0) - (perf < 0.25 ? 1 : 0), 1, 10)
  const lastRole = S.isSoccer ? ((s.stats.starts ?? 0) >= (f.games?.length ?? 38) / 2 ? 'Starter' : 'Backup') : benched < (f.wins + f.losses || 17) / 2 ? 'Starter' : 'Backup'
  let next = { ...c, recordBook, phase: 'offseason', seasons: [...c.seasons, s], contract, dev, rep, lastRole, active: null, simTeam: null, goals: [], earnings: r10(c.earnings + c.contract.perYear + (c.shoe?.perYear ?? 0)), nextMods: null, talks: null, tradeAsked: false, ...healDurability(c) }
  if (S.x?.afterSeason) next = S.x.afterSeason(next, s)
  // the offseason: the league moves, your team's roster turns over, the news
  const b = c.active.benched
  if (b?.why?.kind === 'traded') {
    const ro = next.roster ?? rosterOf(next, next.team)
    next = { ...next, roster: Object.fromEntries(Object.entries(ro).map(([k, v]) => [k, Array.isArray(v) ? v.filter(p => p.name !== b.behind) : v])), dealt: { ...(next.dealt ?? {}), [b.behind]: b.why.to } }
  }
  const r = seeded(`${c.seed}-off-${c.year}`)
  const league = driftLeague(next, r)
  const { roster, moves } = rosterMoves(next, r)
  // the retired stay retired: never signed again, never on another team's roster
  const gone = [...new Set([...(next.gone ?? []), ...moves.filter(m => m.kind === 'retire').map(m => m.p.name)])]
  next = { ...next, league, roster, gone }
  const news = leagueNews(c, league)
  next = offseasonEvents(next)
  next = maybeShoeDeal(next)
  next = maybeTraded(next, r)
  const offers = contractSituation(next)
  next = { ...next, fit: fitFor(next), offers, off: { step: 'recap', moves: next.traded ? [] : moves, news, camp: null, contract: Array.isArray(offers) } }
  return next
}
// A shoe deal: a big name with a big season gets one; a superstar gets his own
// signature line. Money every year, and a mark on the legacy.
// (the legacy is kept small: the greats' resumes have nothing like it, and at 4 / 8 it lifted plain careers up the list)
export const SHOE = { deal: { legacy: 2, perYear: 2 }, signature: { legacy: 4, perYear: 6 } }
function maybeShoeDeal(c) {
  const S = sportOf(c)
  const r = seeded(`${c.seed}-shoe-${c.year}`)
  const recent = c.seasons.slice(-2)
  const last = recent[recent.length - 1]
  const star = recent.some(s => s.award || s.allPro)
  const tier = c.shoe?.tier
  let next = null
  if (!tier && (c.rep ?? 5) >= 7 && last && (seasonScore(c.pos, last) >= 0.6 || star) && r() < 0.35) next = 'deal'
  else if (tier === 'deal' && (c.rep ?? 5) >= 9 && star && r() < 0.3) next = 'signature'
  if (!next) return c
  const what = S.isSoccer ? (next === 'signature' ? 'his own signature boot' : 'a boot deal with a global brand') : next === 'signature' ? (S.isBucket ? 'his own signature shoe' : 'his own signature cleat') : (S.isBucket ? 'a national shoe deal' : 'a national shoe and apparel deal')
  const bump = SHOE[next].legacy
  return {
    ...c, shoe: { tier: next, year: c.year + 1, perYear: SHOE[next].perYear },
    legacyBonus: (c.legacyBonus ?? 0) + bump,
    events: [...c.events, { year: c.year + 1, text: `${c.name} signs ${what}. ${next === 'signature' ? (S.isSoccer ? 'A face of the game now.' : 'A face of the league now.') : 'The name travels now.'} +${bump} legacy.` }],
    decisions: [...c.decisions, { year: c.year + 1, text: `Signed ${what} (${S.isSoccer ? '€' : '$'}${SHOE[next].perYear}M a year)` }],
  }
}
// the biggest movers around the league this offseason
function leagueNews(c, league) {
  const S = sportOf(c)
  const was = s => { const d = c.league?.[s] ?? { off: 0, def: 0 }; return d.off + d.def }
  const now = s => league[s].off + league[s].def
  if (S.x?.news) return S.x.news(league, was, now)
  return S.teams.map(t => ({ t, d: now(t.short) - was(t.short) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3)
    .map(({ t, d }) => `The ${nick(t.name)} ${d > 0 ? (d > 2 ? 'reload: one of the big winners of the offseason' : 'get better on paper') : (d < -2 ? 'lose a lot of talent. A long year ahead' : 'take a step back')}.`)
}
// Behind someone, or the team wants a reset: you can get moved. A quarterback
// only moves if he asks to, and nobody's dealt off a good year or a ring.
function maybeTraded(c, r) {
  const S = sportOf(c)
  if (S.isSoccer) return c   // (a footballer moves in the transfer window: the contract step)
  if (c.contract.left <= 0 || c.contract.noTrade || c.pos === 'qb') return c
  const latest = c.seasons[c.seasons.length - 1]
  if (c.lastRole !== 'Backup' && (latest?.champion || seasonScore(c.pos, latest) >= 0.5)) return c
  const before = c.seasons[c.seasons.length - 2]
  // (a backup is moved now and then, not most years: 0.45 / 0.8 had careers on five teams)
  const p = c.lastRole !== 'Backup' ? 0.04 : before && before.benched >= (before.wins + before.losses) / 2 ? 0.3 : 0.18
  if (r() >= p) return c
  // a team where you'd start
  // (by the depth chart at his own spot: a DB is weighed against that team's corners, or its safeties)
  const contract = { ...c.contract, starter: false }
  const fits = S.teams.filter(t => t.short !== c.team).map(t => ({ t, ro: rosterOf(c, t.short) }))
    .filter(x => depthChart({ ...c, team: x.t.short, roster: x.ro, contract, lastRole: null }, x.ro).starter)
  const pick = fits.length ? fits[Math.floor(r() * fits.length)] : null
  if (!pick) return c
  return {
    ...c, team: pick.t.short, roster: pick.ro, kept: keepRoster(c), traded: true, tradeAsked: false,
    contract,   // a starter guarantee was the old team's promise
    events: [...c.events, { year: c.year + 1, text: `Traded to the ${pick.t.name}. A fresh start, and a starting job.` }],
    decisions: [...c.decisions, { year: c.year + 1, text: `Traded to the ${nick(pick.t.name)}` }],
  }
}
// 0–1: how good a season was for the position
export function seasonScore(pos, s) {
  const S = sportForPos(pos)
  return clamp(S.seasonScore(pos, s) + (s.award ? .15 : 0) + (s.champion ? .1 : 0), 0, 1.2)
}

// ── Offseason: the recap, the roster moves, camp, the contract ───────────────
export const OFF_STEPS = [['recap', 'RECAP'], ['contract', 'CONTRACT'], ['moves', 'MOVES'], ['camp', 'CAMP']]
export const offStep = (c, step) => ({ ...c, off: { ...(c.off ?? {}), step } })
// Training camp: one hard drill. Win it for legacy points (the coaches remember)
// and a chance at a development point: better the more cleanly it's won.
// (1 a win: at 3, fifteen camps were worth more than a DPOY, and the greats get no camp points)
export const CAMP_LEGACY = 1
// hit: the drill's own verdict (MiniGame), the same one it showed the player
export function campDrill(c, score, game, hit = score >= 0.75) {
  const won = !!hit
  const chance = won ? clamp(0.25 + (score - 0.5), 0.25, 0.75) : 0
  const bonus = won && seeded(`${c.seed}-campdev-${c.year}`)() < chance ? 1 : 0
  const legacy = won ? CAMP_LEGACY : 0
  return { ...c, legacyBonus: (c.legacyBonus ?? 0) + legacy, legacyCamp: (c.legacyCamp ?? 0) + legacy, dev: { ...c.dev, points: c.dev.points + bonus }, off: { ...c.off, camp: { score, won, bonus, legacy, chance, game } } }
}
const traitName = (c, t) => POS_ATTR[c.pos][t]?.label ?? t
// A trait is maxed once it shows S (grades are rounded: 10.5 and up is S)
// How far offseason work can take a trait: you can't train much height. Size
// moves twice in a career, the explosive traits (speed, bounce, a get-off, bend) three times.
export const UPGRADE_CAP = { size: 2, heightLength: 2, speed: 3, bounce: 3, getOff: 3, bend: 3 }
// at the top of the scale, or out of upgrades for that trait
export const maxedTrait = (v, ch = null, type = null) => Math.round(v ?? 0) >= 11 || (type != null && UPGRADE_CAP[type] != null && (ch?.upgraded ?? 0) >= UPGRADE_CAP[type])
// The last step costs more: A+ to S takes 2 points, everything else 1; past a trait's
// full years (the age ladder, lib/ageLadder.js) it takes double that
export const upgradeCost = (v, c = null, type = null) => (Math.round(v ?? 0) >= 10 ? 2 : 1) * (c && type && trainWindow(c, type)?.late ? 2 : 1)
// The age ladder (lib/ageLadder.js): the physical traits train while young, the technique
// into the early thirties, the mental side for good. { tier, open, late (double cost),
// left (offseasons incl. this one), until (the last age), full } or null (no window)
export function trainWindow(c, type) {
  const S = sportOf(c), sp = S.id ?? 'nfl', phys = S.physical[c.pos] ?? []
  const w = ladderWindow(sp, c.pos, c.age, type, phys, S.trainUntil(c.pos))
  // nothing left upstairs (the mental side all maxed): the technique stays open at double the
  // work, so a veteran's points always have somewhere to go
  if (w?.tier === 'tech' && !w.open && mindTraits(sp, c.pos, c.types ?? [], phys).every(t => maxedTrait(c.build[t]?.val, c.build[t], t))) return { ...w, open: true, late: true, left: 2, valve: true }
  return w
}
// The line over the traits while there's a point to spend: what's still open, and until when
export function ladderNote(c) {
  const S = sportOf(c), sp = S.id ?? 'nfl'
  const label = t => lowLabel(traitName(c, t))
  const live = t => !maxedTrait(c.build[t]?.val, c.build[t], t)
  const ws = c.types.filter(live).map(t => [t, trainWindow(c, t)]).filter(([, w]) => w)
  const of = tier => ws.filter(([, w]) => w.tier === tier)
  const list = xs => andList(xs.map(([t]) => label(t)))
  const phys = of('phys'), tech = of('tech'), mind = andList(mindTraits(sp, c.pos, c.types, S.physical[c.pos] ?? []).filter(live).map(label))
  const p = phys[0]?.[1], t = tech[0]?.[1]
  const up = s => s.charAt(0).toUpperCase() + s.slice(1)
  if (!LADDER[sp]?.[c.pos]) return p ? { last: p.open && p.left <= 1, text: !p.open ? `${up(list(phys))} can't be trained any more (past ${p.until}). Skills and reads still can.` : p.left <= 1 ? `Last offseason to train ${list(phys)}: the window shuts after ${p.until}.` : `${up(list(phys))} can be trained until ${p.until}: ${p.left} offseasons left. Skills and reads, any time. A+ to S costs 2 points.` } : null
  const anyAge = mind ? ` ${up(mind)} at any age.` : ''
  const techTo = t ? ` ${up(list(tech))} through ${t.until}.` : ''
  if (p?.open) return p.late ? { last: true, text: `Last offseason to train ${list(phys)}, at double cost.${techTo}${anyAge}` }
    : { last: false, text: `${up(list(phys))} can be trained through age ${p.until}, the last year at double cost.${techTo}${anyAge}` }
  if (t?.valve) return { last: false, text: `With ${andList(mindTraits(sp, c.pos, c.types, S.physical[c.pos] ?? []).map(label))} maxed, ${list(tech)} stay open at double cost.` }
  if (t?.open) return t.late ? { last: t.left <= 1, text: `${up(list(tech))}: double cost now, closed after age ${t.until}.${anyAge}` }
    : { last: false, text: `${up(list(tech))} can be trained through age ${t.until}, the last two years at double cost.${anyAge}` }
  return mind ? { last: false, text: `At ${c.age}, only ${mind} can still be trained.` } : null
}
export function canUpgrade(c, type) {
  const ch = c.build[type]
  if ((c.pos === 'dl' || c.pos === 'lb') && type === 'size') return false   // a lineman's (or a linebacker's) size is his body, not something to train
  if (c.pos === 'ol' && (type === 'size' || type === 'length')) return false   // (an offensive lineman's arms too: length is arm length)
  if (!ch || maxedTrait(ch.val, ch, type)) return false
  const w = trainWindow(c, type)
  if (w && !w.open) return false
  return c.dev.points >= upgradeCost(ch.val, c, type)
}
// Why a trait can't go up right now, in a line (null: it can). type '__body' is body work (durability)
export function upgradeBlock(c, type) {
  const pts = c.dev?.points ?? 0
  const lack = cost => `That costs ${cost} points. ${pts} left.`
  if (type === '__body') {
    if ((c.durability ?? 5) >= BODY_MAX) return 'Durability is maxed out.'
    if (c.phase === 'season') return 'Body work happens in the offseason.'
    if (!pts) return 'No development points. Young players earn them every season, and awards, All-Pro and camp wins add more.'
    return pts < bodyCost(c) ? lack(bodyCost(c)) : null
  }
  const ch = c.build[type]
  if (!ch) return null
  const name = traitName(c, type)
  if ((c.pos === 'dl' || c.pos === 'lb') && type === 'size') return 'Size is his frame. It can\u2019t be trained.'
  if (c.pos === 'ol' && type === 'size') return 'Size is his frame. It can\u2019t be trained.'
  if (c.pos === 'ol' && type === 'length') return 'Arm length can\u2019t be trained.'
  if (Math.round(ch.val ?? 0) >= 11) return `${name} is already an S. That\u2019s as high as it goes.`
  if (maxedTrait(ch.val, ch, type)) return `${name} has been raised ${UPGRADE_CAP[type]} times, the most it can be.`
  const w = trainWindow(c, type)
  const S = sportOf(c)
  if (w && !w.open) return LADDER[S.id ?? 'nfl']?.[c.pos] ? closedLine(S.id ?? 'nfl', c.age, w.tier, name, andList(mindTraits(S.id ?? 'nfl', c.pos, c.types, S.physical[c.pos] ?? []).filter(t => !maxedTrait(c.build[t]?.val, c.build[t], t)).map(t => lowLabel(traitName(c, t)))), w.until) : `${name} can only be trained until age ${w.until}. He\u2019s ${c.age} now.`
  if (c.phase === 'season') return 'Development points are spent in the offseason.'
  if (!pts) return 'No development points. Young players earn them every season, and awards, All-Pro and camp wins add more.'
  const cost = upgradeCost(ch.val, c, type)
  if (pts < cost && w?.late) return lateLine(c.age, name, cost, pts)
  return pts < cost ? `A+ to S costs ${cost} points. ${pts} left.` : null
}
export function spendDev(c, type) {
  if (!canUpgrade(c, type)) return c
  const cost = upgradeCost(c.build[type].val, c, type)
  const from = c.build[type].val
  // one grade up, exactly: a 9.6 (A) becomes an A+, not a 10.6 that also reads S
  const build = { ...c.build, [type]: { ...c.build[type], val: Math.min(11, Math.round(from) + 1), upgraded: (c.build[type].upgraded ?? 0) + 1 } }
  return { ...c, build, ovr: ovrOf(c.pos, build, c.sport), dev: { points: c.dev.points - cost, spent: c.dev.spent + cost }, decisions: [...c.decisions, { year: c.year + 1, text: `Offseason work: ${traitName(c, type)} ${valToGrade(from)} → ${valToGrade(from + 1)}` }] }
}
// Body work: a development point into durability (fewer injuries, and a longer career).
// One step a point, two points from 8 up, to 10
export const BODY_MAX = 10
// The body's own level (durBase): where durability settles once the knocks heal. It starts where durability
// starts, and moves only for good: body work and a new strength staff raise it, a season-ender, a long
// stretch out, playing on an injury and the years past the position's prime take it down. Everything else
// (a sat-out injury, a camp tweak, a meaningless game played hurt) comes off durability alone, and heals.
// (A save from before: its durability then)
export const durBaseOf = c => c.durBase ?? c.durability ?? 5
// The season's booked: the knocks heal, most of the way back to the body's own level (less of it once the
// body is past its prime). Never above it: only body work and a strength staff take him past his frame
// (2026-11-08: before this every knock lasted, so a career that never did body work lost a grade or two by
// its prime and body work became a chore every offseason)
export const fadeAt = c => Math.max(29, sportOf(c).declineAt(c.pos))
function healDurability(c) {
  const base = durBaseOf(c), d = c.durability ?? base
  return d >= base ? { durBase: base } : { durBase: base, durability: r10(d + (base - d) * (c.age >= fadeAt(c) ? 0.4 : 0.65)) }
}
export const bodyCost = c => ((c.durability ?? 5) >= 8 ? 2 : 1)
export const canBodyWork = c => (c.durability ?? 5) < BODY_MAX && (c.dev?.points ?? 0) >= bodyCost(c)
export function bodyWork(c) {
  if (!canBodyWork(c)) return c
  const cost = bodyCost(c), from = c.durability ?? 5, to = r10(Math.min(BODY_MAX, Math.floor(from) + 1))
  return { ...c, durability: to, durBase: Math.max(durBaseOf(c), to), dev: { points: c.dev.points - cost, spent: c.dev.spent + cost }, bodyWork: (c.bodyWork ?? 0) + 1, decisions: [...c.decisions, { year: c.year + 1, text: `Offseason work: durability ${gradeOf(from * 1.1)} → ${gradeOf(to * 1.1)}` }] }
}
const EVENTS = {
  nfl: [
    { id: 'new-oc', w: 3, text: t => `The ${t} hire a new offensive coordinator. New scheme, new reps to learn.`, apply: () => ({ nextMods: { off: -0.5 } }) },
    { id: 'coach-fired', w: 2, when: c => c.seasons[c.seasons.length - 1]?.wins <= 6, text: t => `The ${t} fire the head coach after a lost season. A reset is coming.`, apply: () => ({ nextMods: { off: -0.5, def: -0.5 } }) },
    { id: 'defense-up', w: 2, text: t => `The ${t} spend big on defense. Fewer shootouts, more wins.`, apply: () => ({ nextMods: { def: 1 } }) },
    { id: 'trainer', w: 2, text: () => `A new strength staff and a full offseason in the building. The body feels bulletproof.`, apply: c => ({ durability: r10(Math.min(10, c.durability + 0.6)), durBase: r10(Math.min(10, durBaseOf(c) + 0.3)) }) },
    { id: 'holdout', w: 1, when: c => c.contract.kind === 'rookie' && c.contract.left === 1 && c.rep >= 6, text: () => `The agent wants an extension now. Talks stall into camp.`, apply: c => ({ nextMods: { off: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
    { id: 'captain', w: 2, when: c => c.rep >= 7, text: t => `The ${t} vote him a team captain. The locker room is his.`, apply: c => ({ rep: Math.min(10, c.rep + 1) }) },
    { id: 'scheme-fit', w: 2, text: (t, c) => (c?.pos === 'dl' ? `The ${t} redesign the front around their best players. More one-on-ones are coming.` : c?.pos === 'ol' ? `The ${t} rebuild the run game around their line. More runs are coming his way.` : `The ${t} redesign the playbook around their best players. More touches are coming.`), apply: c => ({ nextMods: c?.pos === 'dl' ? { def: 0.5 } : { off: 0.5 } }) },
    { id: 'mentor', w: 2, good: true, when: c => c.age <= 25, text: (t, c) => `A ten-year veteran on the ${t} takes ${c.name} under his wing. Film every morning, extra reps every night.`, apply: c => ({ dev: { ...c.dev, points: c.dev.points + 1 } }) },
    { id: 'built-around', w: 2, good: true, when: c => c.rep >= 6, text: (t, c) => (c.pos === 'dl' ? `The ${t} coaching staff builds the front around ${c.name}. More stunts, more one-on-ones.` : c.pos === 'ol' ? `The ${t} coaching staff builds the run game around ${c.name}. The big runs go behind him.` : `The ${t} coaching staff builds the game plan around ${c.name}. More touches are coming.`), apply: c => ({ nextMods: c?.pos === 'dl' ? { def: 0.75 } : { off: 0.75 } }) },
    { id: 'rift', w: 2, bad: true, when: c => c.rep <= 4, text: t => `Teammates haven't forgotten last year. The ${t} locker room is split, and the coaches notice.`, apply: c => ({ nextMods: { off: -0.5, def: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
    { id: 'camp-tweak', w: 2, bad: true, text: () => `A hamstring tweak in OTAs. Nothing serious, but it lingers into the season.`, apply: c => ({ durability: r10(Math.max(1, c.durability - 0.4)) }) },
    { id: 'line-rebuilt', w: 2, text: t => `The ${t} lose two starting linemen in free agency. The rebuild up front starts now.`, apply: () => ({ nextMods: { off: -0.75 } }) },
    { id: 'division-loads', w: 2, when: c => !!divRival(c), text: (t, c) => { const d = divRival(c); return `The ${d.nick} go all in: two stars signed in a week. The ${d.div} got harder, and so did the road to January for the ${t}.` }, apply: () => ({ nextMods: { def: -0.5 } }) },
    { id: 'quiet', w: 3, text: () => `A quiet offseason at the facility. Camp opens, and the grind begins.`, apply: () => ({}) },
  ],
  bucket: [
    { id: 'new-coach', w: 3, text: t => `The ${t} hire a new head coach. New sets, new rotations to learn.`, apply: () => ({ nextMods: { off: -0.5 } }) },
    { id: 'star-trade', w: 2, text: t => `The ${t} trade for an All-Star. The floor just opened up.`, apply: () => ({ nextMods: { off: 1 } }) },
    { id: 'coach-fired', w: 2, when: c => c.seasons[c.seasons.length - 1]?.wins <= 30, text: t => `The ${t} fire the head coach after a lost season. A reset is coming.`, apply: () => ({ nextMods: { off: -0.5, def: -0.5 } }) },
    { id: 'defense-up', w: 2, text: t => `The ${t} bring in two defenders and a rim protector. Grind-it-out wins are coming.`, apply: () => ({ nextMods: { def: 1 } }) },
    { id: 'trainer', w: 2, text: () => `A new performance staff and a full summer in the gym. The body feels bulletproof.`, apply: c => ({ durability: r10(Math.min(10, c.durability + 0.6)), durBase: r10(Math.min(10, durBaseOf(c) + 0.3)) }) },
    { id: 'extension', w: 1, when: c => c.contract.kind === 'rookie' && c.contract.left === 1 && c.rep >= 6, text: () => `The agent wants the extension done now. Talks stall into training camp.`, apply: c => ({ nextMods: { off: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
    { id: 'captain', w: 2, when: c => c.rep >= 7, text: t => `The ${t} name him a captain. The locker room is his.`, apply: c => ({ rep: Math.min(10, c.rep + 1) }) },
    { id: 'system', w: 2, text: t => `The ${t} rebuild the offense around their best players. More touches are coming.`, apply: () => ({ nextMods: { off: 0.5 } }) },
    { id: 'mentor', w: 2, good: true, when: c => c.age <= 25, text: (t, c) => `A fifteen-year veteran on the ${t} takes ${c.name} under his wing. Film every morning, extra shots every night.`, apply: c => ({ dev: { ...c.dev, points: c.dev.points + 1 } }) },
    { id: 'built-around', w: 2, good: true, when: c => c.rep >= 6, text: (t, c) => `The ${t} put the ball in ${c.name}'s hands. More sets, more touches.`, apply: () => ({ nextMods: { off: 0.75 } }) },
    { id: 'rift', w: 2, bad: true, when: c => c.rep <= 4, text: t => `The ${t} locker room hasn't gotten over last year. Nobody's passing to anybody.`, apply: c => ({ nextMods: { off: -0.5, def: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
    { id: 'camp-tweak', w: 2, bad: true, text: () => `A sprained ankle in a summer run. Nothing serious, but it lingers into the season.`, apply: c => ({ durability: r10(Math.max(1, c.durability - 0.4)) }) },
    { id: 'shooters-gone', w: 2, text: t => `The ${t} lose two shooters in free agency. The floor gets smaller.`, apply: () => ({ nextMods: { off: -0.75 } }) },
    { id: 'quiet', w: 3, text: () => `A quiet summer at the facility. Camp opens, and the grind begins.`, apply: () => ({}) },
  ],
}
function offseasonEvents(c) {
  const S = sportOf(c)
  const r = seeded(`${c.seed}-ev-${c.year}`)
  // reputation tilts the summer: a good name draws the good breaks, a bad one the bad
  const rep = c.rep ?? 5
  const wOf = e => e.w * (e.good ? (rep >= 7 ? 1.6 : rep <= 3 ? 0.5 : 1) : e.bad ? (rep <= 3 ? 1.8 : rep >= 7 ? 0.6 : 1) : 1)
  const fits = (EVENTS[c.sport] ?? EVENTS.nfl).filter(e => !e.when || e.when(c))
  const total = fits.reduce((s, e) => s + wOf(e), 0)
  let roll = r() * total, ev = fits[0]
  for (const e of fits) { roll -= wOf(e); if (roll <= 0) { ev = e; break } }
  const text = ev.text(S.isSoccer ? S.teamOf(c.team).name : nickOf(S, c.team), c)
  const fx = ev.apply(c)
  return { ...c, ...fx, nextMods: fx.nextMods ? { ...(c.nextMods ?? {}), ...fx.nextMods } : c.nextMods, events: [...c.events, { year: c.year + 1, text }] }
}
function marketValue(c) {
  const S = sportOf(c)
  const last = c.seasons.slice(-2)
  const perf = last.length ? last.reduce((s, x) => s + seasonScore(c.pos, x), 0) / last.length : 0.3
  const ageCut = c.age >= 33 ? 0.6 : c.age >= 30 ? 0.8 : 1
  const [lo, hi] = S.moneyOf(c)
  // reputation moves the number a little: a good name is worth up to +10%, a bad one −8%
  const repCut = 0.9 + (c.rep ?? 5) * 0.02
  return r10((lo + (hi - lo) * clamp(perf, 0, 1) * ageCut) * repCut)
}
// Contract's up: the team's offer and two from the market; none at all when
// nobody's calling (that's the end of the road)
// fresh: the day a comeback is announced (every phone rings, and every deal is for one year)
function contractSituation(c, fresh = false) {
  const S = sportOf(c)
  if (S.x?.window && c.contract.left > 0) return fresh ? null : S.x.window(c)
  if (c.contract.left > 0) return null
  // the career's over anyway (age, the most seasons, or a comeback that's run its course): no free agency to sign into
  const left = comebackLeft(c)
  if (left != null ? left <= 0 : c.age >= retireAge(c) || c.seasons.length >= MAX_SEASONS) return null
  if (S.x?.market) return S.x.market(c, fresh, left)   // (a registered sport's own free agency: baseball's years and AAV)
  const r = seeded(`${c.seed}-fa-${c.year}${fresh ? '-back' : ''}`)
  const value = marketValue(c)
  const last = c.seasons[c.seasons.length - 1]
  const perf = seasonScore(c.pos, last)
  // past his prime and a bad year: nobody calls (an RB sooner than a QB)
  if (!fresh && c.age >= sportOf(c).declineAt(c.pos) + 3 && perf < 0.35) return []
  // teams commit longer to a good name (+1 year at 8+), shorter to a bad one (−1 at 3 or less)
  const repYrs = (c.rep ?? 5) >= 8 ? 1 : (c.rep ?? 5) <= 3 ? -1 : 0
  // a comeback's deals never run past its last season
  const cap = y => (fresh ? 1 : left != null ? Math.min(y, left) : y)
  const years = clamp((c.age >= 32 ? 1 + Math.floor(r() * 2) : c.age >= 29 ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3)) + repYrs, 1, 6)
  const fitAt = short => teamFit(short, c.pos, { roster: c.roster, league: c.league, name: c.name, sport: c.sport, yrs: rosterYrs(c), gone: outOf(c, short), spot: lineSpot(c) })
  const others = S.teams.filter(t => t.short !== c.team).sort(() => r() - .5).map(t => fitAt(t.short))
  const good = 7, bad = 6
  const contender = others.find(f => (f.off + f.def) / 2 >= good) ?? others[0]
  const payer = others.find(f => f.short !== contender.short && (f.off + f.def) / 2 < bad) ?? others[1]
  // where you'd stand on each team's depth chart
  const standAt = short => { const dc = depthChart({ ...c, contract: {}, lastRole: short === c.team ? c.lastRole : null }, short === c.team ? c.roster : rosterOf(c, short)); return { starter: dc.starter, behind: dc.ahead[dc.ahead.length - 1]?.name ?? null, label: dc.label } }
  // (never past the position's money range: a payer's premium tops out at the max)
  const mk = (fit, perYear, yrs, pitch, kind) => ({ team: fit.short, fit, perYear: r10(clamp(perYear, S.moneyOf(c)[0], S.moneyOf(c)[1])), years: yrs, pitch, kind, stand: standAt(fit.short) })
  return [
    mk(fitAt(c.team), value * (0.92 + r() * .1), cap(years), fresh ? 'Back where he left off. One more run here.' : 'Stay, and finish what he started here.', 'stay'),
    mk(contender, value * (0.68 + r() * .12), cap(Math.max(1, years - 1)), fresh ? (S.isSoccer ? 'A year at a big club. One more shot at a trophy.' : 'A year on a contender. One more shot at a ring.') : S.isSoccer ? 'Lower wages. A real shot at the title.' : 'Less money. A real shot at a ring.', 'contender'),
    mk(payer, value * (1.12 + r() * .2), cap(years + (c.age < 29 ? 1 : 0)), fresh ? 'Top dollar for the comeback. They want the name.' : S.isSoccer ? 'The top wages on offer. A club that wants a big name up front.' : 'Top of the market. A rebuild wants a face.', 'payer'),
  ].filter(o => !(S.isSoccer && c.relegated && o.kind === 'stay'))   // (soccer: a relegated club can't keep him in the top flight)
}
export function signOffer(c, o) {
  if (sportOf(c).x?.sign) return sportOf(c).x.sign(c, o)
  const change = o.team !== c.team
  const extras = [o.noTrade ? 'no-trade clause' : null, o.starter ? 'starter guarantee' : null].filter(Boolean)
  const roster = change ? rosterOf(c, o.team) : c.roster
  return {
    ...c, team: o.team, roster, ...(change ? { kept: keepRoster(c) } : {}), fit: teamFit(o.team, c.pos, { roster, league: c.league, name: c.name, sport: c.sport, spot: lineSpot(c) }), offers: null, talks: null, tradeAsked: false, lastRole: change ? null : c.lastRole, ...(change && c.off ? { off: { ...c.off, moves: [] } } : {}),
    contract: { kind: change ? 'fa' : 'ext', years: o.years, left: o.years, perYear: o.perYear, noTrade: !!o.noTrade, starter: !!o.starter },
    decisions: [...c.decisions, { year: c.year + 1, text: `${change ? 'Signed with' : 'Re-signed with'} the ${o.fit.name}: ${o.years} yrs, $${o.perYear}M a year${extras.length ? ` (${extras.join(', ')})` : ''}` }],
  }
}
// ── Talks: sit down with one team and push. Leverage (the last two seasons,
// reputation, age) is how far they'll bend before they walk. ──
// Each ask costs a little patience or a lot: `cost` is the range, `hi` the
// base chance it's the high end (leverage lowers it; pushing money again raises it).
export const ASKS = {
  money:   { label: 'MORE MONEY', sub: '+8% a year', cost: [1, 2], hi: 0.3 },
  years:   { label: 'ANOTHER YEAR', sub: '+1 year, same money', cost: [1, 2], hi: 0.35 },
  notrade: { label: 'NO-TRADE CLAUSE', sub: 'They can\'t move him', cost: [2, 3], hi: 0.4 },
  starter: { label: 'STARTER GUARANTEE', sub: 'The job is yours in writing', cost: [1, 2], hi: 0.3 },
}
// { lo, hi, p }: the cost range and the chance it's the high end, for this ask now
export function askOdds(c, kind) {
  const a = ASKS[kind], t = c.talks
  const again = kind === 'money' ? (t?.asked ?? []).filter(k => k === 'money').length : 0
  const p = clamp(a.hi + again * 0.2 - leverageOf(c) * 0.05, 0.1, 0.9)
  return { lo: a.cost[0], hi: a.cost[1], p: Math.round(p * 100) / 100 }
}
export function leverageOf(c) {
  const last = c.seasons.slice(-2)
  const perf = last.length ? last.reduce((s, x) => s + seasonScore(c.pos, x), 0) / last.length : 0.3
  return clamp(Math.round(perf * 3 + (c.rep >= 7 ? 1 : 0) - (c.age >= 32 ? 1 : 0) - (c.rep <= 3 ? 1 : 0)), 0, 4)
}
export function openTalks(c, offer) {
  const lev = leverageOf(c)
  return { ...c, talks: { ...offer, base: offer.perYear, patience: 1 + lev, max: 1 + lev, asked: [], noTrade: false, starter: false, walked: false, lines: [] } }
}
export function ask(c, kind) {
  const t = c.talks; if (!t || t.walked) return c
  const a = ASKS[kind]; if (!a || (kind !== 'money' && t.asked.includes(kind)) || (kind === 'money' && t.asked.filter(k => k === 'money').length >= 3)) return c
  const r = seeded(`${c.seed}-ask-${c.year}-${t.asked.length}-${kind}`)
  const odds = askOdds(c, kind)
  const big = r() < odds.p
  const patience = t.patience - (big ? odds.hi : odds.lo)
  if (patience < 0) {
    // they're done: the offer's gone
    const offers = (c.offers ?? []).filter(o => o.team !== t.team)
    const fallback = offers.length ? offers : [{ ...t, perYear: r10(t.base * 0.85), years: Math.max(1, t.years - 1), kind: 'late', pitch: 'Late in free agency. The market moved on; this is what\'s left.', noTrade: false, starter: false }]
    return { ...c, offers: fallback, talks: { ...t, walked: true, patience: 0, lines: [...t.lines, 'The GM closes the folder. "We\'re done here."'] }, events: [...c.events, { year: c.year + 1, text: `Talks with the ${t.fit.name} collapsed over a ${a.label.toLowerCase()}.` }] }
  }
  const pushed = kind === 'money' ? r10(Math.min(t.perYear * 1.08, sportOf(c).moneyOf(c)[1])) : t.perYear
  const years = kind === 'years' ? t.years + 1 : t.years
  const tone = (big ? 'That one stung. ' : '') + (patience >= 2 ? 'A nod. "We can do that."' : patience === 1 ? '"…Fine. But that\'s about it."' : 'A long pause. "Last one."')
  return { ...c, talks: { ...t, patience, perYear: pushed, years, noTrade: t.noTrade || kind === 'notrade', starter: t.starter || kind === 'starter', asked: [...t.asked, kind], lines: [...t.lines, tone] } }
}
export const closeTalks = c => ({ ...c, talks: null })
export const acceptTalks = c => (c.talks && !c.talks.walked ? signOffer(c, c.talks) : c)
// Mid-contract: ask out. Costs reputation; the team doesn't have to say yes.
export function demandTrade(c) {
  const S = sportOf(c)
  if (c.tradeAsked) return c
  if (S.x?.transferRequest) return S.x.transferRequest(c)
  const r = seeded(`${c.seed}-trade-${c.year}`)
  const granted = r() < 0.7
  const rep = Math.max(1, c.rep - 2)
  if (!granted) return { ...c, rep, tradeAsked: true, nextMods: { ...(c.nextMods ?? {}), off: ((c.nextMods?.off) ?? 0) - 0.5 }, events: [...c.events, { year: c.year + 1, text: `${c.name} asked for a trade. The team said no, and the locker room heard about it.` }] }
  // any team in the stronger half (it was the top six: the same two or three every time)
  const pool = S.teams.map(t => S.teamOf(t.short)).filter(t => t.short !== c.team).sort((a, b) => (b.off + b.def) - (a.off + a.def))
  const dest = pool[Math.floor(r() * Math.ceil(pool.length / 2))]
  const roster = rosterOf(c, dest.short)
  const fit = teamFit(dest.short, c.pos, { roster, league: c.league, name: c.name, sport: c.sport, spot: lineSpot(c) })
  // a starter guarantee was the old team's promise: it stays with them
  return { ...c, rep, tradeAsked: true, team: dest.short, roster, kept: keepRoster(c), fit, lastRole: null, contract: { ...c.contract, starter: false }, off: { ...(c.off ?? {}), moves: [] }, events: [...c.events, { year: c.year + 1, text: `Trade request granted: a ${nick(fit.name)} now.` }], decisions: [...c.decisions, { year: c.year + 1, text: `Demanded a trade, dealt to the ${fit.name}` }] }
}
// Into the next season: a year older, the body moves with it
export function nextSeason(c) {
  const S = sportOf(c)
  if (c.contract.left <= 0) return c      // sign first (no deal, no season)
  const r = seeded(`${c.seed}-age-${c.year}`)
  const age = c.age + 1
  let build = { ...c.build }
  const notes = []
  const move = (t, d, why) => {
    // one visible grade at a time (grades are rounded), never past S or under D
    const ch = build[t]; if (!ch) return
    const to = Math.round(ch.val) + d
    if (to > 11 || to < 1) return
    build[t] = { ...ch, val: to, ...(d > 0 ? { grew: (ch.grew ?? 0) + 1 } : { faded: (ch.faded ?? 0) + 1 }) }
    notes.push(`${why}: ${traitName(c, t)} ${valToGrade(ch.val)} → ${valToGrade(to)}`)
  }
  const grows = c.pos === 'dl' || c.pos === 'lb' ? c.types.filter(t => t !== 'size') : c.pos === 'ol' ? c.types.filter(t => t !== 'size' && t !== 'length') : c.types
  // (a footballer comes in at 17: he grows until 22, not 24)
  if (age <= (S.isSoccer ? 22 : 24) && r() < 0.45) move(grows[Math.floor(r() * grows.length)], 1, 'Still growing')
  else if (age <= 28 && r() < 0.2) move(grows[Math.floor(r() * grows.length)], 1, 'A step forward')
  const phys = S.physical[c.pos]
  const pickPhys = () => phys[Math.floor(r() * phys.length)]
  // the body fades from the position's age (an RB first, a QB last)
  const from = S.declineAt(c.pos)
  if (age >= from) {
    // the physical traits: a grade a year at first (sometimes two), then two a year,
    // then two or three
    const yrs = age - from
    const hits = yrs >= 4 ? 2 + (r() < 0.5 ? 1 : 0) : yrs >= 2 ? 2 : 1 + (r() < 0.3 ? 1 : 0)
    for (let h = 0; h < hits; h++) move(pickPhys(), -1, 'Father Time')
    // the rest slips too, less: hands, ball security (size never moves, and neither do
    // the shot, the passing or the reads: age doesn't take those)
    const rest = c.types.filter(t => !phys.includes(t) && t !== 'size' && t !== 'heightLength' && !(c.pos === 'ol' && t === 'length') && !S.ageless.includes(t))
    const q = yrs >= 4 ? 0.9 : yrs >= 2 ? 0.65 : 0.4
    if (rest.length && r() < q) move(rest[Math.floor(r() * rest.length)], -1, 'Father Time')
    if (rest.length && yrs >= 4 && r() < 0.4) move(rest[Math.floor(r() * rest.length)], -1, 'Father Time')
  }
  // a big injury last season (season-ending, or a long stretch out) can take something with it
  for (const inj of c.injuries.filter(x => x.year === c.year + 1 && (x.serious || x.games >= S.bigInjury))) {
    if (r() < 0.6) move(pickPhys(), -1, `The ${inj.kind}`)
  }
  // a body that keeps breaking down wears down
  // (2026-11-08: from C down, not B-: a normal frame now starts around C+, and that's not a body breaking down)
  if (age >= 26 && c.durability <= 3 && r() < (c.durability <= 2.2 ? 0.4 : 0.25)) move(pickPhys(), -1, 'Wear and tear')
  // the years past his prime (from 29, or the position's own fade if later): the body's own level slips,
  // a little a year, more from three years past it
  const past = age - fadeAt(c)
  const aged = past >= 0 ? (past >= 3 ? 0.2 : 0.1) : 0
  const dura = aged ? { durability: r10(Math.max(1, c.durability - aged)), durBase: r10(Math.max(1, durBaseOf(c) - aged)) } : {}
  // (a registered sport's own aging: baseball's bat speed and a pitcher's stuff in his mid-thirties)
  if (S.x?.age) S.x.age(c, age, move, r)
  const ovr = ovrOf(c.pos, build, c.sport)
  const n = { ...c, ...dura, age, year: c.year + 1, season: c.season + 1, build, ovr, phase: 'preseason', offers: null, aging: notes, off: null, traded: false }
  return { ...n, fit: fitFor(n) }
}
export const canRetire = c => c.age >= 29 || c.seasons.length >= 8
// The end of the road: the body (40, quarterbacks 42), the most seasons a career
// can run, or a free agency where nobody calls
// The age a career ends, by position; elite (90+) and durable (7+) buys two more years
export const retireAge = c => {
  const S = sportOf(c)
  if (S.isSoccer) return 34 + ((c.durability ?? 5) >= 6 ? 1 : 0) + ((c.ovr ?? 0) >= 88 ? 1 : 0) + ((c.durability ?? 5) >= 8.5 ? 1 : 0)   // (34-37: the body and the level)
  if (S.x?.retireAge) return S.x.retireAge(c)
  const base = S.isBucket ? 38 : ({ qb: 42, rb: 33, wr: 36, te: 36, db: 35, dl: 37, lb: 36, ol: 37 })[c.pos] ?? 36
  return base + ((c.ovr ?? 0) >= 90 && (c.durability ?? 5) >= 7 ? 2 : 0)
}
export function retireReason(c) {
  // a comeback: the age and the season cap don't apply until its seasons are played
  const left = comebackLeft(c)
  if (left != null && left <= 0) return 'comeback'
  if (left == null && c.age >= retireAge(c)) return 'age'
  if (left == null && c.seasons.length >= MAX_SEASONS) return 'seasons'
  if (Array.isArray(c.offers) && c.offers.length === 0) return 'nocalls'
  // told to hang it up with the deal done, then a camp point lifted the overall past the age limit:
  // there are no offers to sign, so it still stands (he played on with no contract, and showed -1 years)
  if (c.phase === 'offseason' && !c.talks && c.contract?.left <= 0 && !c.offers) return c.seasons.length >= MAX_SEASONS ? 'seasons' : 'age'
  return null
}
export const mustRetire = c => !!retireReason(c)
export function retire(c) {
  const L = legacyOf(c)
  const hof = hofVote(c, L)
  const text = `Retired${c.unretired ? ' for good' : ''} at ${c.age} after ${c.seasons.length} seasons`
  return logCareer({ ...c, phase: 'retired', retired: true, hof, offers: null, talks: null, active: null, decisions: [...c.decisions, { year: c.year + 1, text }] })
}

// ── The comeback (BAP Pro): a retired career comes back once ─────────────────
// Back into the offseason he retired in: his deal if it still runs, else free
// agency (one-year offers, and the phone always rings the day he announces it).
// He plays the next season a year older and Father Time keeps working; the age
// and the season cap are off for up to COMEBACK_SEASONS more seasons, then he
// retires for good. The legacy and the Hall of Fame vote are redone then, and
// the past-careers line from the first retirement is replaced, not doubled.
// c.unretired = { year (the first comeback season), until (the last), age, season, logAt }
export const COMEBACK_SEASONS = 3
// seasons left in a comeback (null: never came back)
const comebackLeft = c => (c?.unretired ? c.unretired.until - c.seasons.length : null)
export const canUnretire = c => c?.phase === 'retired' && !c.unretired && (c.seasons?.length ?? 0) > 0
export function unretire(c) {
  if (!canUnretire(c)) return c
  const n = c.seasons.length
  const back = {
    ...c, phase: 'offseason', retired: false, hof: null, logged: false, talks: null, active: null,
    unretired: { year: n + 1, until: n + COMEBACK_SEASONS, age: c.age, season: c.season + 1, logAt: loggedLine(c)?.at ?? null },
    contract: c.contract?.left > 0 ? { ...c.contract, left: Math.min(c.contract.left, COMEBACK_SEASONS) } : c.contract,
    events: [...c.events, { year: c.year + 1, text: `${c.name} comes out of retirement at ${c.age}. Up to ${COMEBACK_SEASONS} more seasons.` }],
    decisions: [...c.decisions, { year: c.year + 1, text: `Came out of retirement (up to ${COMEBACK_SEASONS} more seasons)` }],
  }
  const offers = contractSituation(back, true)
  // his deal still runs: back to his team on it. Else the contract step, with the offers
  return { ...back, offers, fit: fitFor(back), off: { ...(c.off ?? {}), step: offers ? 'contract' : (c.off?.step ?? 'camp'), contract: !!offers || !!c.off?.contract, moves: c.off?.moves ?? [], news: c.off?.news ?? [] } }
}
// where a comeback stands, for the screens: { n, of, done } (n: the season being
// played or coming up; done: its seasons are all played), or null
export function comebackYear(c) {
  if (!c?.unretired) return null
  const played = c.seasons.length - c.unretired.year + 1
  const done = played >= COMEBACK_SEASONS
  return { n: Math.min(COMEBACK_SEASONS, played + (c.phase === 'retired' ? 0 : 1)), played, of: COMEBACK_SEASONS, done }
}

// ── Legacy ───────────────────────────────────────────────────────────────────
export function careerTotals(c) {
  const S = sportOf(c)
  const Ss = c.seasons
  const stats = {}
  for (const s of Ss) for (const [k, v] of Object.entries(s.stats)) { if (S.rateKeys.includes(k) || k === 'gp') continue; stats[k] = (stats[k] ?? 0) + (v ?? 0) }
  const games = Ss.reduce((a, s) => a + (s.stats.gp ?? (s.wins + s.losses - (s.missed ?? 0))), 0)
  if (S.averages) for (const [avg, tot] of Object.entries(S.averages)) stats[avg] = games ? r10((stats[tot] ?? 0) / games) : 0
  // a DB's rating allowed over the career, from the throws at him (the seasons that kept them)
  if (Ss.some(s => s.stats.grade != null)) { const g = Ss.filter(s => s.stats.grade != null), w = g.reduce((a, s) => a + (s.stats.snaps || 1), 0); for (const k of ['grade', 'passGrade', 'runGrade']) stats[k] = r10(g.reduce((a, s) => a + (s.stats[k] ?? 0) * (s.stats.snaps || 1), 0) / w) }
  // (soccer: the match rating over the career, by appearances; the caps and the goals for his country)
  if (S.isSoccer) { const apps = Ss.reduce((a, s) => a + (s.stats.apps ?? 0), 0); stats.avgRating = apps ? Math.round(Ss.reduce((a, s) => a + (s.stats.avgRating ?? 0) * (s.stats.apps ?? 0), 0) / apps * 100) / 100 : 0; stats.xg = r10(stats.xg ?? 0) }
  if (stats.tgtA) stats.rtgA = ratingAllowed(Ss.filter(s => s.stats.tgtA).reduce((a, s) => ({ tgtA: a.tgtA + s.stats.tgtA, cmpA: a.cmpA + (s.stats.cmpA ?? 0), ydsA: a.ydsA + (s.stats.ydsA ?? 0), tdA: a.tdA + (s.stats.tdA ?? 0), ints: a.ints + (s.stats.ints ?? 0) }), { tgtA: 0, cmpA: 0, ydsA: 0, tdA: 0, ints: 0 }))
  return {
    seasons: Ss.length, games, wins: Ss.reduce((a, s) => a + s.wins, 0), losses: Ss.reduce((a, s) => a + s.losses, 0),
    playoffs: Ss.filter(s => s.playoffs).length, rings: Ss.filter(s => s.champion).length, awards: Ss.filter(s => s.award).length, fmvps: Ss.filter(s => s.fmvp).length, roy: Ss.some(s => s.roy),
    // records: the all-time records he holds (one each, however many times he raised his own)
    proBowls: Ss.filter(s => s.proBowl).length, allPros: Ss.filter(s => s.allPro).length, records: new Set(Ss.flatMap(s => s.records ?? [])).size,
    teams: [...new Set(Ss.map(s => s.team))], stats, earnings: c.earnings,
    ...(S.x?.totals ? S.x.totals(c) : {}),
  }
}
// One formula for every career, played or real. A resume: seasons, honors (Pro
// Bowls / All-Stars), firsts (All-Pro / All-NBA), awards (the position's award,
// one a season), rings, playoff years, the all-time records held, and the
// career's totals (production, by position: S.legacyProd). The greats' resumes
// are their real ones (data/legacy-resumes.js); a career's is booked season by
// season. Same weights for both.
export const LEGACY_W = { seasons: 2, honors: 6, firsts: 10, awards: 18, rings: 20, playoffs: 3, records: 8 }
// The big awards outweigh piling up: Pro Bowls / All-Stars past the 8th count
// half (twenty Pro Bowls is not Aaron Donald's ten with eight All-Pros and three
// DPOYs), and every award after the first is worth AWARD_REPEAT more (three
// DPOYs say more than three times one)
export const HONOR_KNEE = 8, AWARD_REPEAT = 10
export const countedHonors = n => Math.min(n, HONOR_KNEE) + Math.max(0, n - HONOR_KNEE) / 2
export function legacyScore(S, pos, r) {
  if (S.x?.legacy) return S.x.legacy(r)
  const k = { ...r, honors: countedHonors(r.honors ?? 0) }
  return Math.round(Object.entries(LEGACY_W).reduce((sum, [key, w]) => sum + (k[key] ?? 0) * w, 0) + Math.max(0, (r.awards ?? 0) - 1) * (S.awardRepeat ?? AWARD_REPEAT) + S.legacyProd(pos, r.stats ?? {}) + (pos === 'ol' ? (r.firsts ?? 0) * OL_FIRST_BONUS : 0) + (r.bonus ?? 0))
}
// Money earned is worth a little legacy too: a point every $25M of career
// earnings (contracts and shoe money), never more than 5
export const EARN_LEGACY = { per: 25, max: 5 }
export const earnLegacy = c => Math.min(EARN_LEGACY.max, Math.floor((c.earnings ?? 0) / EARN_LEGACY.per))
// the small extras on top of the resume: camp wins, shoe deals and earnings
export const legacyExtras = c => ({ camp: c.legacyCamp ?? 0, shoe: (c.legacyBonus ?? 0) - (c.legacyCamp ?? 0), earnings: earnLegacy(c) })
// a career's resume, from its booked seasons (bonus: camp wins, shoe deals and
// earnings, the legacy points with no real-career counterpart; all kept minor)
export function resumeOf(c) {
  const t = careerTotals(c)
  if (sportOf(c).x?.resume) return sportOf(c).x.resume(c, t)
  return { seasons: t.seasons, honors: t.proBowls, firsts: t.allPros, awards: t.awards, rings: t.rings, playoffs: t.playoffs, records: t.records, stats: t.stats, bonus: (c.legacyBonus ?? 0) + earnLegacy(c) }
}
export const LEGACY_TIERS = [[0, 'Starter'], [80, 'Star'], [170, 'Superstar'], [280, 'All-Time Great']]
export function legacyOf(c) {
  const S = sportOf(c)
  const score = legacyScore(S, c.pos, resumeOf(c))
  const tiers = legacyTiers(c)
  const tier = [...tiers].reverse().find(([min]) => score >= min)[1]
  const next = tiers.find(([min]) => score < min)
  const list = ALL_TIME[c.pos]
  const rank = list.filter(x => x.score > score).length + 1
  return { score, tier, ranked: rank <= list.length, next: next ? { at: next[0], name: next[1] } : null, rank, of: list.length, above: list.filter(x => x.score > score).slice(-1)[0] ?? null, below: list.find(x => x.score <= score) ?? null }
}
// The legacy that gets a career voted in (hofVote: 80% of the vote, give or take a few points)
export const HOF_LEGACY = 209
// How far along the road to the Hall a career is: Home's HOF banner
export const hofProgress = c => (c?.sport && !sportReady(c.sport) ? (ensureSport(c.sport), 0) : c?.hof?.in ? 100 : Math.max(0, Math.min(99, Math.floor((legacyOf(c).score / HOF_LEGACY) * 100))))
function hofVote(c, L) {
  if (sportOf(c).x?.icon) return sportOf(c).x.icon(c, L)
  const r = seeded(`${c.seed}-hof`)
  const pct = clamp(Math.round(20 + (L.score - 100) * 0.55 + (r() - .5) * 8), 2, 99)
  const inn = pct >= 80
  return { in: inn, pct, ballot: inn ? (pct >= 93 ? 'First ballot' : pct >= 86 ? 'Second ballot' : 'Inducted in year 4') : L.score >= 140 ? 'Finalist, not inducted' : 'Not on the ballot' }
}
// The greats, scored from their real resumes (data/legacy-resumes.js) with the
// same legacyScore a career gets: where a career lands among them. Records: the
// ones in the game's own record book (seasonFacts.js) that name him as holder.
const words = s => s.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean)
const heldBy = (sport, pos, name) => (RECORDS[sport]?.[pos] ?? []).filter(x => { const h = new Set(words(x.holder)); return words(name).every(w => h.has(w)) }).length
const scored = (sport, pos) => RESUMES[pos].map(r => ({ name: r.name, score: legacyScore(SPORT[sport], pos, { ...r, records: heldBy(sport, pos, r.name) }) }))
const greats = list => list.sort((a, b) => b.score - a.score).map((x, i) => ({ ...x, rank: i + 1 }))
// basketball: one list, the 25 greatest careers at any position
const NBA_GREATS = greats([...scored('bucket', 'guard'), ...scored('bucket', 'big')]).slice(0, 25)
export const ALL_TIME = {
  qb: greats(scored('nfl', 'qb')), rb: greats(scored('nfl', 'rb')), wr: greats(scored('nfl', 'wr')), te: greats(scored('nfl', 'te')), db: greats(scored('nfl', 'db')), dl: greats(scored('nfl', 'dl')), lb: greats(scored('nfl', 'lb')), ol: greats(scored('nfl', 'ol')),
  guard: NBA_GREATS,
  big: NBA_GREATS,
}

// The player comp: the real players (today's and all-time) whose grades sit
// closest to this build's, trait by trait. A player listed for several teams counts once.
// (soccer: both pools, every attacker and midfielder in them: Top Divisions is today's, the World Cup's the same men)
const ALL_TIME_POOL = { qb: LEGENDS, rb: RB_LEGENDS, wr: WR_LEGENDS, te: TE_LEGENDS, db: DB_LEGENDS, dl: DL_LEGENDS, lb: LB_LEGENDS, ol: OL_LEGENDS, guard: NBA_ALLTIME_GUARD_PLAYERS, big: NBA_ALLTIME_BIG_PLAYERS }
// prime: as he was before age and injuries took their grades (the career summary: no one's "built like" his 38-year-old legs)
export function compsFor(c, n = 5, prime = false) {
  const S = sportOf(c)
  const best = new Map()
  const valOf = t => { const ch = c.build[t]; return Math.min(11, (ch?.val ?? 5) + (prime ? ch?.faded ?? 0 : 0)) }
  const consider = (p, era) => {
    if (!p?.attrs || !p.name) return
    // (an edge plays like edges, a tackle like tackles)
    if (c.pos === 'dl' && p.subpos !== dlSpot(c)) return
    if (c.pos === 'ol' && olGroup(p.pos ?? p.subpos) !== olGroup(olSpot(c))) return   // (a tackle like tackles, a guard like guards)
    let d = 0, k = 0
    for (const t of c.types) { const v = p.attrs[t]; if (v == null) continue; d += Math.abs(valOf(t) - v); k++ }
    if (k < c.types.length - 1) return
    const dist = d / k
    const prev = best.get(p.name)
    if (!prev || dist < prev.dist || (dist === prev.dist && era === 'current')) best.set(p.name, { name: p.name, team: p.team, years: p.years ?? null, era, dist, attrs: p.attrs, photo: p.headshot ? nflHeadshot(p.headshot) : S.photo(p.name) })
  }
  for (const p of (S.x?.compPool ?? S.pool[c.pos]) ?? []) consider(p, 'current')
  for (const p of ALL_TIME_POOL[c.pos] ?? []) consider(p, S.x?.compPool ? 'current' : 'all-time')
  return [...best.values()].sort((a, b) => a.dist - b.dist).slice(0, n).map(x => ({ ...x, match: Math.max(0, Math.round(100 - x.dist * 9)) }))
}

// The card: everything a share needs
export function careerCard(c) {
  const S = sportOf(c)
  const t = careerTotals(c), L = legacyOf(c)
  const head = HEADLINE_STATS[c.pos].map(k => [STAT_LABEL[k], fmtStat(t.stats[k])])
  return { name: c.name, pos: S.isSoccer ? 'STRIKER' : S.isBucket ? (c.pos === 'guard' ? 'GUARD' : 'BIG') : POS_LABEL[c.pos], years: c.seasons.length ? `${c.seasons[0].season}–${c.seasons[c.seasons.length - 1].season}` : '', teams: t.teams, head, rings: t.rings, awards: c.pos === 'ol' ? t.allPros : t.awards, awardName: AWARD_NAME[c.pos], proBowls: t.proBowls, honorName: S.honors, allPros: t.allPros, legacy: L, hof: c.hof, draft: c.draft.pick, earnings: t.earnings, site: S.site ?? (S.isSoccer ? 'build-a-player.com/soccer' : S.isBucket ? 'build-a-player.com/bucket' : 'build-a-player.com') }
}

// ── Sports that load on their own (soccer: lib/careerSoccer.js) ──────────────
// A football or basketball career never downloads them: soccer's rules, data and engine arrive with
// ensureSport('soccer') (the soccer app, the Career screens and Home's career card ask for it), and the
// module registers itself here: SPORT.soccer, its lookups, its greats, its offseason and interview banks.
const NAMERS = {}
const LOADERS = { soccer: () => import('./careerSoccer.js'), baseball: () => import('./careerBaseball.js') }
const loading = {}
export const sportReady = id => !!SPORT[id] || !LOADERS[id]
export const ensureSport = id => (sportReady(id) ? Promise.resolve(SPORT[id] ?? null) : (loading[id] ??= LOADERS[id]().then(() => SPORT[id])))
export const legacyTiers = c => sportOf(c).tiers ?? LEGACY_TIERS
export function registerSport(id, S, { resumes = {}, events = null, interviews = null, comps = {}, namers = {} } = {}) {
  SPORT[id] = S
  for (const [obj, k] of [[POS_LABEL, 'label'], [POS_NAME, 'posName'], [POS_TYPES, 'types'], [POS_ATTR, 'attr'], [AWARD_NAME, 'awardName'], [STARTERS, 'starters'], [HEADLINE_STATS, 'headline'], [EXTRA_STATS, 'extra']]) Object.assign(obj, S[k] ?? {})
  Object.assign(RESUMES, resumes)
  for (const pos of Object.keys(resumes)) ALL_TIME[pos] = greats(scored(id, pos))
  Object.assign(ALL_TIME_POOL, comps)
  Object.assign(NAMERS, namers)
  if (events) EVENTS[id] = events
  if (interviews) INTERVIEWS[id] = interviews
  // (a registered sport's own ages at the end, shirt numbers and face rating: baseball's, lib/careerBaseball.js)
  Object.assign(RETIRE_AT, S.retireAt ?? {}); Object.assign(CAST_NUM, S.castNum ?? {}); Object.assign(FACE_RATING, S.face ?? {}); Object.assign(STAT_LABEL, S.statLabel ?? {})
}
// the engine's pieces a registered sport builds on
export const CAREER_X = { rosterOf, keepRoster, rosterYrs, outOf, marketValue, LAST_PLAY, strength, goalMet, buildOf, avgOvr, byOvr, clamp, r10, FIRST_SEASON, fitFor, nickOf, hashN, rosterFor, ageOf }
