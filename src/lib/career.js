// CAREER: one player, a whole career. Build → the draft → seasons played game
// by game (the season director runs each one, so the moments and decisions of
// a normal season are all here) → the offseason (growth, a development point,
// contracts, free agency, surprises) → legacy. Plain data, saved on every
// change (localStorage, per account), so a career can be left and picked up
// mid-season. Football and basketball run on the same engine: everything that
// differs lives in SPORT below. Screens: components/app/AppCareer.jsx.

import { seeded } from './rng'
import { queueCloudSave, fetchCloudCareer, deleteCloudCareer } from './careerCloud'
import { createDirector } from './seasonDirector'
import {
  runSimulation, runRBSimulation, runWRSimulation, runTESimulation, runDBSimulation,
  calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB,
  calcMVPResult, calcOPOYResult, calcWROPOYResult, calcTEOPOYResult, calcDBDpoyResult, valToGrade, nflHeadshot, HEADSHOT_BASE,
} from '../utils/simulation'
import { runBucketSimulation, calcBucketOVR, TEAM_RATINGS as NBA_RATINGS } from '../utils/bucketSimulation'
import { TYPES, ATTR, QBS } from '../data/qbs'
import { RB_TYPES, RB_ATTR, RBS } from '../data/rbs'
import { WR_TYPES, WR_ATTR, WRS } from '../data/wrs'
import { TE_TYPES, TE_ATTR, TES } from '../data/tes'
import { DB_TYPES, DB_ATTR, DBS } from '../data/dbs'
import { OLS, OL_ATTR_WEIGHT, olOVR } from '../data/ols'
import HEADSHOTS from '../data/headshots.json'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
import { NFL_TEAMS } from '../data/nfl-teams'
import { NBA_TEAMS } from '../data/nba-teams'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs'
import { BUCKET_ATTR } from '../data/nba-attrs'
import { BIRTH } from '../data/player-ages'
import { LEGENDS } from '../data/qb-legends'
import { RB_LEGENDS } from '../data/rb-legends'
import { WR_LEGENDS } from '../data/wr-legends'
import { TE_LEGENDS } from '../data/te-legends'
import { DB_LEGENDS } from '../data/db-legends'
import { NBA_ALLTIME_GUARD_PLAYERS } from '../data/nba-guard-legends'
import { NBA_ALLTIME_BIG_PLAYERS } from '../data/nba-big-legends'

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
const NFL_POS_TYPES = { qb: TYPES, rb: RB_TYPES, wr: WR_TYPES, te: TE_TYPES, db: DB_TYPES }
const NFL_OVR = { qb: b => calcOVR(b, TYPES), rb: b => calcOVRRB(b, RB_TYPES), wr: b => calcOVRWR(b, WR_TYPES), te: b => calcOVRTE(b, TE_TYPES), db: b => calcOVRDB(b, DB_TYPES) }
const NFL_AWARD = { qb: calcMVPResult, rb: calcOPOYResult, wr: calcWROPOYResult, te: calcTEOPOYResult, db: calcDBDpoyResult }
const olScore = p => Object.entries(OL_ATTR_WEIGHT).reduce((s, [k, w]) => s + (p.attrs?.[k] ?? 5) * w, 0) / Object.values(OL_ATTR_WEIGHT).reduce((a, b) => a + b, 0)

export const SPORT = {
  nfl: {
    id: 'nfl', league: 'NFL', isBucket: false, screen: 'ag-screen--nfl',
    teams: NFL_TEAMS, logo: s => `/logos/${s}.png`,
    // a team as the career sees it: off / def on a 1–10 scale
    teamOf: short => { const t = NFL_TEAMS.find(x => x.short === short) ?? NFL_TEAMS[0]; return { short: t.short, name: t.name, color: t.color, color2: t.color2, off: t.off, def: t.def, conf: t.conf, div: t.div } },
    status: core => (core >= 7 ? 'Contender' : core >= 5.5 ? 'In the mix' : 'Rebuilding'),
    // the career positions, and which side of the ball each plays (DL and LB join the defense later)
    positions: ['qb', 'rb', 'wr', 'te', 'db'],
    side: { qb: 'off', rb: 'off', wr: 'off', te: 'off', db: 'def' },
    label: { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB' }, posName: { qb: 'Quarterback', rb: 'Running back', wr: 'Wide receiver', te: 'Tight end', db: 'Defensive back' },
    types: NFL_POS_TYPES, attr: { qb: ATTR, rb: RB_ATTR, wr: WR_ATTR, te: TE_ATTR, db: DB_ATTR },
    pool: { qb: QBS, rb: RBS, wr: WRS, te: TES, ol: OLS, db: DBS },
    // every roster group a team keeps: the offense, then the defense (dl, lb go here when their data lands)
    groups: ['qb', 'rb', 'wr', 'te', 'ol', 'db'], starters: { qb: 1, rb: 1, wr: 3, te: 1, ol: 5, db: 4 }, keep: { qb: 2, rb: 2, wr: 4, te: 2, ol: 5, db: 5 },
    slots: { ol: ['LT', 'LG', 'C', 'RG', 'RT'] },
    depthLabel: (pos, i) => `${({ qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB' })[pos]}${i}`,
    ovr: (pos, b) => NFL_OVR[pos]?.(b) ?? 0,
    realOvr: (pos, p) => Math.round(pos === 'ol' ? (olOVR(p.attrs) ?? 72) : (p.ovr ?? NFL_OVR[pos](buildOf(NFL_POS_TYPES[pos], p)))),
    photo: name => (HEADSHOTS[name] ? nflHeadshot(HEADSHOTS[name]) : null),
    sim: pos => ({ qb: (b, t) => runSimulation(b, TYPES, t, false), rb: (b, t) => runRBSimulation(b, RB_TYPES, t, false), wr: (b, t) => runWRSimulation(b, WR_TYPES, t, false), te: (b, t) => runTESimulation(b, TE_TYPES, t, false), db: (b, t) => runDBSimulation(b, t, false) })[pos],
    // what the sim plays against: the team, its offense moved by the fit and the year's events
    // the pieces around you move your side of the ball: the offense for a skill player, the defense for a DB
    simTeam: (t, fit, m, c) => {
      const def = SPORT.nfl.side[c?.pos] === 'def'
      return { ...t, off: clamp(fit.off + (def ? 0 : fit.adj) + (m.off ?? 0), 1, 10), def: clamp(fit.def + (def ? fit.adj : 0) + (m.def ?? 0), 1, 10) }
    },
    // the pieces of the offense around you, graded 0–11
    fit: (ro, pos, notMe) => {
      if (SPORT.nfl.side[pos] === 'def') {
        // a DB's world: the rest of the secondary (the pass rush and linebackers join when they're in the game)
        const mates = (ro.db ?? []).filter(notMe).sort((a, b) => b.ovr - a.ovr).slice(0, 3)
        const secG = r10(ovrGradeVal(avgOvr(mates)))
        const front = ['dl', 'lb'].filter(g => ro[g]?.length).map(g => ({ k: g === 'dl' ? 'PASS RUSH' : 'LINEBACKERS', v: r10(ovrGradeVal(avgOvr(ro[g].slice(0, g === 'dl' ? 4 : 3)))), names: ro[g].slice(0, 4).map(p => p.name) }))
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
    fitNote: (f, pos) => (pos === 'db' ? 'The secondary around him decides how often he is left on an island.' : pos === 'qb'
      ? (f.ol < 4.5 ? 'A bad line hurts a quarterback: sacks, hits, hurried throws.' : f.weapons >= 8 ? 'Elite weapons make a quarterback\'s numbers.' : 'A workable line and honest weapons. The quarterback decides it.')
      : (f.qb >= 8 ? 'A real quarterback feeds his weapons: targets, yards, touchdowns.' : f.qb < 5 ? 'A weak quarterback caps a skill player. Fewer good balls.' : 'A middling quarterback. The plays have to be made after the catch.')),
    physical: { qb: ['legs', 'arm'], rb: ['speed', 'burst', 'elusiveness'], wr: ['speed', 'vertical', 'afterCatch'], te: ['speed', 'vertical', 'strength'], db: ['speed', 'fluidity'] },
    durable: { qb: ['size', 'pocket-presence'], rb: ['strength', 'size', 'balance'], wr: ['size', 'bodyControl'], te: ['strength', 'size'], db: ['size', 'runSupport'] },
    ageShift: pos => (pos === 'qb' ? 2 : 0),
    // the physical traits train until this age (then the window shuts); the body fades from declineAt
    trainUntil: pos => ({ qb: 31, rb: 27, wr: 29, te: 29, db: 29 })[pos] ?? 29,
    declineAt: pos => ({ qb: 33, rb: 28, wr: 30, te: 30, db: 30 })[pos] ?? 31,
    bigInjury: 6,
    draft: {
      rounds: 7,
      stock: ovr => (ovr >= 95 ? [1, 5] : ovr >= 90 ? [3, 12] : ovr >= 86 ? [8, 24] : ovr >= 82 ? [18, 45] : ovr >= 78 ? [36, 80] : ovr >= 74 ? [70, 130] : ovr >= 70 ? [110, 180] : [160, 224]),
      rookie: o => ({ kind: 'rookie', years: 4, left: 4, perYear: o <= 5 ? 9.5 : o <= 10 ? 6.5 : o <= 16 ? 4.5 : o <= 32 ? 3.2 : o <= 64 ? 1.8 : o <= 100 ? 1.3 : 1.0, option: o <= 32 }),
      posList: ['EDGE', 'OT', 'CB', 'WR', 'QB', 'LB', 'DT', 'S', 'RB', 'TE', 'G', 'C'],
    },
    combine: {
      qb: [['forty', '40-yard dash', 'legs'], ['velo', 'Throwing velocity', 'arm'], ['acc', 'Accuracy drill', 'accuracy']],
      rb: [['forty', '40-yard dash', 'speed'], ['cone', '3-cone drill', 'elusiveness'], ['bench', 'Bench press', 'strength']],
      wr: [['forty', '40-yard dash', 'speed'], ['cone', '3-cone drill', 'routeRunning'], ['gauntlet', 'Gauntlet drill', 'hands']],
      te: [['forty', '40-yard dash', 'speed'], ['bench', 'Bench press', 'strength'], ['gauntlet', 'Gauntlet drill', 'hands']],
      db: [['forty', '40-yard dash', 'speed'], ['cone', '3-cone drill', 'fluidity'], ['gauntlet', 'Ball skills drill', 'hands']],
    },
    goals: {
      qb: ovr => [['passYds', 'Throw for', ovr >= 90 ? 4000 : ovr >= 82 ? 3500 : 3000, 'yards'], ['tds', 'Throw', ovr >= 90 ? 30 : ovr >= 82 ? 24 : 18, 'TDs'], ['wins', 'Win', ovr >= 90 ? 11 : ovr >= 82 ? 9 : 7, 'games']],
      rb: ovr => [['rushYds', 'Rush for', ovr >= 90 ? 1300 : ovr >= 82 ? 1000 : 750, 'yards'], ['tds', 'Score', ovr >= 90 ? 13 : ovr >= 82 ? 9 : 6, 'TDs'], ['wins', 'Win', ovr >= 90 ? 10 : 8, 'games']],
      wr: ovr => [['recYds', 'Catch', ovr >= 90 ? 1300 : ovr >= 82 ? 1000 : 750, 'yards'], ['tds', 'Score', ovr >= 90 ? 11 : ovr >= 82 ? 8 : 5, 'TDs'], ['recs', 'Make', ovr >= 90 ? 95 : ovr >= 82 ? 75 : 55, 'catches']],
      db: ovr => [['ints', 'Pick off', ovr >= 90 ? 6 : ovr >= 82 ? 4 : 2, 'passes'], ['pbus', 'Defend', ovr >= 90 ? 18 : ovr >= 82 ? 13 : 9, 'passes'], ['tackles', 'Make', ovr >= 90 ? 75 : ovr >= 82 ? 62 : 50, 'tackles']],
      te: ovr => [['recYds', 'Catch', ovr >= 90 ? 1000 : ovr >= 82 ? 750 : 550, 'yards'], ['tds', 'Score', ovr >= 90 ? 9 : ovr >= 82 ? 6 : 4, 'TDs'], ['recs', 'Make', ovr >= 90 ? 80 : ovr >= 82 ? 60 : 45, 'catches']],
    },
    seasonStats: (pos, f) => pos === 'qb'
      ? { passYds: f.seasonPassYds, tds: f.seasonTDs, ints: f.seasonINTs, rating: f.seasonRating, rushYds: f.seasonRushYds, compPct: f.seasonCompPct }
      : pos === 'db' ? { ints: f.seasonINTs, pbus: f.seasonPBUs, tackles: f.seasonTackles, tfl: f.seasonTFL, ff: f.seasonFF, pickSixes: f.seasonPickSixes }
      : pos === 'rb' ? { rushYds: f.seasonRushYds, tds: (f.seasonRushTDs ?? 0) + (f.seasonRecTDs ?? 0), recYds: f.seasonRecYds, ypc: f.seasonYPC, fumbles: f.seasonFumbles }
      : { recs: f.seasonRecs, recYds: f.seasonRecYds, tds: f.seasonRecTDs, ypr: f.seasonYPR },
    rateKeys: ['rating', 'compPct', 'ypc', 'ypr'],     // per-game rates: never summed into career totals
    averages: null,
    headline: { qb: ['passYds', 'tds', 'ints'], rb: ['rushYds', 'tds', 'recYds'], wr: ['recs', 'recYds', 'tds'], te: ['recs', 'recYds', 'tds'], db: ['ints', 'pbus', 'tackles'] },
    awardName: { qb: 'MVP', rb: 'OPOY', wr: 'OPOY', te: 'OPOY', db: 'DPOY' },
    honor: 'Pro Bowl', honors: 'PRO BOWLS', first: 'All-Pro',
    // the numbers that get a player there
    proBowl: { qb: s => s.tds >= 30 || s.passYds >= 4300, rb: s => s.rushYds >= 1200 || s.tds >= 12, wr: s => s.recYds >= 1200 || s.tds >= 10, te: s => s.recYds >= 850 || s.tds >= 8, db: s => s.ints >= 5 || (s.ints >= 3 && s.pbus >= 15) },
    allPro: { db: s => s.ints >= 7 || (s.ints >= 5 && s.pbus >= 18), qb: s => s.tds >= 38 || (s.tds >= 34 && s.passYds >= 4600), rb: s => s.rushYds >= 1550 || (s.rushYds >= 1350 && s.tds >= 14), wr: s => s.recYds >= 1500 || (s.recYds >= 1350 && s.tds >= 12), te: s => s.recYds >= 1150 || (s.recYds >= 1000 && s.tds >= 10) },
    allProNear: { qb: s => s.tds >= 32, rb: s => s.rushYds >= 1300, wr: s => s.recYds >= 1300, te: s => s.recYds >= 950, db: s => s.ints >= 6 },
    award: (c, f, s) => {
      const bar = { db: () => s.ints >= 7 || (s.ints >= 6 && (s.pickSixes ?? 0) >= 1), qb: () => (s.tds ?? 0) + (f.seasonRushTDs ?? 0) >= 36 && s.passYds >= 4400 && f.wins >= 11, rb: () => s.rushYds >= 1700 || (s.rushYds >= 1500 && s.tds >= 16), wr: () => s.recYds >= 1600 && s.tds >= 11, te: () => s.recYds >= 1300 && s.tds >= 10 }
      return !!NFL_AWARD[c.pos](f, false, c.team).userWins && bar[c.pos]()
    },
    seasonScore: (pos, s) => { const st = s.stats; return pos === 'db' ? (st.ints ?? 0) / 7 * .45 + (st.pbus ?? 0) / 20 * .25 + s.wins / 15 * .3 : pos === 'qb' ? st.tds / 40 * .4 + st.passYds / 5000 * .3 + s.wins / 15 * .3 : pos === 'rb' ? st.rushYds / 1700 * .5 + st.tds / 18 * .3 + s.wins / 15 * .2 : st.recYds / 1600 * .5 + st.tds / 14 * .3 + s.wins / 15 * .2 },
    // a DB's production: picks and the ones taken back (the greats are scored the same way)
    legacyProd: (pos, st) => (pos === 'db' ? (st.ints ?? 0) * 1.3 + (st.pickSixes ?? 0) * 2 : pos === 'qb' ? (st.tds ?? 0) / 10 + (st.passYds ?? 0) / 1000 : pos === 'rb' ? (st.tds ?? 0) / 4 + (st.rushYds ?? 0) / 500 : (st.tds ?? 0) / 4 + (st.recYds ?? 0) / 500),
    made: f => !!f.playoffs,
    rounds: ['Wild Card', 'Divisional', 'Conference Championship', 'Super Bowl'], final: 'Super Bowl', series: false,
    lineKeys: ['passYds', 'tds', 'ints', 'rushYds', 'rushTDs', 'recYds', 'rec', 'recTDs', 'tackles', 'pbus'],
    step: 1, gameWord: 'WEEK', snaps: 'snaps', injScale: 1, moneyWord: 'yards',
    injuries: [['hamstring strain', 2, 3], ['high ankle sprain', 3, 5], ['rib cartilage', 1, 2], ['concussion', 1, 2], ['MCL sprain', 4, 6], ['shoulder (AC joint)', 2, 4], ['turf toe', 2, 3]],
    money: { qb: [8, 58], rb: [2, 18], wr: [4, 34], te: [2, 19], db: [2, 22] },
    primeNote: pos => { const S = SPORT.nfl; return `Physical traits can be trained until ${S.trainUntil(pos)} and start to fade at ${S.declineAt(pos)}; skills and reads can be trained any time. Big injuries and a fragile body can cost you a grade.` },
  },
  bucket: {
    id: 'bucket', league: 'NBA', isBucket: true, screen: 'ag-screen--bucket',
    teams: NBA_TEAMS, logo: s => `/logos/nba/${s}.png`,
    // NBA ratings (about 60–85) mapped onto football's 1–10 scale, so the league's moves have the same weight
    teamOf: short => { const t = NBA_TEAMS.find(x => x.short === short) ?? NBA_TEAMS[0]; const R = NBA_RATINGS[t.short] ?? { off: 68, def: 65 }; return { short: t.short, name: t.name, color: t.color, color2: t.color2, off: clamp(r10((R.off - 55) / 3.3), 1, 10), def: clamp(r10((R.def - 55) / 3.3), 1, 10), conf: NBA_EAST.has(t.short) ? 'East' : 'West', div: NBA_EAST.has(t.short) ? 'Eastern Conference' : 'Western Conference' } },
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
      const usage = clamp((0.45 + (c.ovr - 70) * 0.017 - (best > c.ovr ? 0.06 : 0)) * (c.benchRole ? 0.62 : 1), 0.3, 0.95)
      return { ...t, off: clamp(fit.off + fit.adj + (m.off ?? 0), 1, 10), def: clamp(fit.def + (m.def ?? 0), 1, 10), career: true, usage }
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
    durable: { guard: ['size', 'basketballIQ'], big: ['size', 'basketballIQ'] },
    ageShift: () => 0,
    trainUntil: () => 29,
    declineAt: () => 31,
    bigInjury: 20,
    draft: {
      rounds: 2,
      stock: ovr => (ovr >= 95 ? [1, 3] : ovr >= 90 ? [2, 8] : ovr >= 86 ? [5, 15] : ovr >= 82 ? [10, 25] : ovr >= 78 ? [18, 35] : ovr >= 74 ? [28, 48] : ovr >= 70 ? [40, 58] : [48, 60]),
      rookie: o => ({ kind: 'rookie', years: o <= 30 ? 4 : 2, left: o <= 30 ? 4 : 2, perYear: o <= 1 ? 12.5 : o <= 5 ? 9.5 : o <= 10 ? 6.5 : o <= 14 ? 5 : o <= 30 ? 2.8 : 1.9, option: o <= 30 }),
      posList: ['G', 'F', 'C', 'G/F', 'F/C', 'PG', 'SG', 'SF', 'PF', 'C'],
    },
    combine: {
      guard: [['sprint', '3/4-court sprint', 'speed'], ['lane', 'Lane agility', 'perimeterDefense'], ['spot', 'Spot-up shooting', 'jumpShot']],
      big: [['vert', 'Max vertical', 'bounce'], ['nbench', 'Bench press', 'size'], ['spot', 'Spot-up shooting', 'jumpShot']],
    },
    goals: {
      guard: ovr => [['ppg', 'Average', ovr >= 90 ? 26 : ovr >= 82 ? 21 : 16, 'points'], ['apg', 'Average', ovr >= 90 ? 8 : ovr >= 82 ? 6 : 4, 'assists'], ['wins', 'Win', ovr >= 90 ? 55 : ovr >= 82 ? 48 : 40, 'games']],
      big: ovr => [['ppg', 'Average', ovr >= 90 ? 25 : ovr >= 82 ? 20 : 15, 'points'], ['rpg', 'Average', ovr >= 90 ? 12 : ovr >= 82 ? 10 : 7, 'rebounds'], ['wins', 'Win', ovr >= 90 ? 55 : ovr >= 82 ? 48 : 40, 'games']],
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
    proBowl: { guard: s => s.ppg >= 21 || (s.ppg >= 17 && s.apg >= 7), big: s => s.ppg >= 20 || (s.ppg >= 16 && s.rpg >= 10) },
    allPro: { guard: s => s.ppg >= 25 || (s.ppg >= 22 && s.apg >= 8), big: s => s.ppg >= 24 || (s.ppg >= 20 && s.rpg >= 11) },
    allProNear: { guard: s => s.ppg >= 22, big: s => s.ppg >= 20 },
    // the MVP vote: points, plus playmaking or the glass, on a winner (the bar moves a little each year)
    award: (c, f, s) => {
      const r = seeded(`${c.seed}-mvp-${c.year}`)
      const score = s.ppg + s.apg * 1.5 + s.rpg * 0.75
      return f.wins >= 52 && s.ppg >= 25 && score >= 40 + r() * 5
    },
    seasonScore: (pos, s) => { const st = s.stats; return pos === 'guard' ? st.ppg / 30 * .45 + st.apg / 10 * .25 + s.wins / 60 * .3 : st.ppg / 28 * .45 + st.rpg / 13 * .25 + s.wins / 60 * .3 },
    legacyProd: (pos, st) => (st.pts ?? 0) / 600 + ((st.reb ?? 0) + (st.ast ?? 0)) / 700,
    made: f => (f.playoffRounds?.length ?? 0) > 0,
    rounds: ['First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals'], final: 'NBA Finals', series: true,
    lineKeys: ['pts', 'reb', 'ast'],
    step: 10, gameWord: 'GAME', snaps: 'minutes', injScale: 17 / 82, moneyWord: 'points',
    injuries: [['ankle sprain', 3, 8], ['knee soreness', 4, 10], ['hamstring strain', 6, 14], ['concussion', 2, 5], ['back spasms', 3, 7], ['wrist sprain', 5, 12], ['calf strain', 8, 16]],
    money: { guard: [2, 55], big: [2, 52] },
    primeNote: () => 'Speed and bounce can be trained until 29 and start to fade at 31; skills can be trained any time. Big injuries and a fragile body can cost you a grade.',
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
export const STAT_LABEL = { passYds: 'PASS YDS', tds: 'TD', ints: 'INT', rating: 'RTG', rushYds: 'RUSH YDS', compPct: 'CMP%', recYds: 'REC YDS', ypc: 'YPC', fumbles: 'FUM', recs: 'REC', ypr: 'YPR', pbus: 'PD', tackles: 'TKL', pickSixes: 'PICK-6', ppg: 'PPG', rpg: 'RPG', apg: 'APG', spg: 'SPG', bpg: 'BPG', pts: 'PTS', reb: 'REB', ast: 'AST' }
export const HEADLINE_STATS = { ...SPORT.nfl.headline, ...SPORT.bucket.headline }
export const ovrOf = (pos, build, sport = null) => (sport ? SPORT[sport] : SPORT.bucket.positions.includes(pos) ? SPORT.bucket : SPORT.nfl).ovr(pos, build) ?? 0
const sportForPos = pos => (SPORT.bucket.positions.includes(pos) ? SPORT.bucket : SPORT.nfl)
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
  const entry = { at: Date.now(), pos: c.pos, name: c.name, seasons: c.seasons.length, score: L.score, tier: L.tier, rank: L.rank, ranked: L.ranked, hof: c.hof?.in ?? false, rings: t.rings, awards: t.awards, team: c.team, sandbox: !!c.sandbox }
  try { localStorage.setItem(histKey(c.sport), JSON.stringify([entry, ...pastCareers(c.sport)].slice(0, 20))) } catch {}
  return { ...c, logged: true }
}

// ── Teams: the real roster around you, and how it moves year to year ─────────
// OVR → the 0–11 grade scale (F … S) the rest of the game uses
export const ovrGradeVal = ovr => clamp((ovr - 60) / 3.5, 0, 11)
export const gradeOfOvr = ovr => valToGrade(ovrGradeVal(ovr))
export const gradeOf = v => valToGrade(clamp(v, 0, 11))
const hashN = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) }
// Real ages: the birth year against the season (yrs = seasons past the first)
const born = (sport, name) => BIRTH[sport === 'bucket' ? 'bucket' : 'nfl'][name]
const ageOf = (sport, name, yrs = 0) => (born(sport, name) ? FIRST_SEASON - born(sport, name) : 23 + (hashN(name) % 6)) + yrs
// how long a position lasts: gone at the cap, maybe gone in the two years before it
const RETIRE_AT = { qb: 41, rb: 33, wr: 35, te: 35, ol: 36, db: 35, dl: 35, lb: 35, guard: 38, big: 38 }
// how many seasons past the first a roster is for (in the offseason, the one coming up)
const rosterYrs = c => Math.max(0, (c.season ?? FIRST_SEASON) + (c.phase === 'offseason' ? 1 : 0) - FIRST_SEASON)
const man = (S, pos, p, yrs = 0) => ({ name: p.name, pos, ovr: S.realOvr(pos, p), age: ageOf(S.id, p.name, yrs), photo: S.photo(p.name), slot: p.pos ?? p.subpos ?? null, from: p.team })
const byOvr = (a, b) => b.ovr - a.ovr
const avgOvr = list => (list.length ? list.reduce((s, p) => s + p.ovr, 0) / list.length : 72)
// A team's real roster (the depth the lineup needs, the five starting linemen in football)
// A career saved before real ages: the real players on the roster get theirs
function realAges(c) {
  if (!c?.roster) return c
  const yrs = rosterYrs(c)
  const ro = { ...c.roster }
  const S = sportOf(c)
  for (const g of S.groups) if (Array.isArray(ro[g])) ro[g] = ro[g].map(p => (born(c.sport, p.name) && !p.rookie ? { ...p, age: ageOf(c.sport, p.name, yrs) } : p))
  // a starting spot left empty by an older save (a veteran dropped too early): a rookie fills it
  const r = seeded(`${c.seed}-fill-${c.year}`)
  for (const g of S.groups) {
    const slots = S.slots[g]; if (!slots || !Array.isArray(ro[g])) continue
    const missing = slots.filter(sl => !ro[g].some(p => p.slot === sl))
    if (!missing.length) continue
    const add = missing.map(sl => ({ name: rookieName(r), pos: g, ovr: clamp(Math.round(74 + (r() - 0.5) * 10), 64, 84), age: 22 + Math.floor(r() * 4), photo: null, slot: sl, rookie: true }))
    const all = [...ro[g], ...add]
    ro[g] = slots.map(sl => all.find(p => p.slot === sl)).filter(Boolean).concat(all.filter(p => !slots.includes(p.slot))).slice(0, S.keep[g])
  }
  return { ...c, roster: ro }
}
// Years into a career, the team's real players are that much older; the ones
// who'd have retired are gone, their spots filled by draft picks.
export function makeRoster(short, sport = 'nfl', yrs = 0, gone = []) {
  const S = SPORT[sport] ?? SPORT.nfl
  const ro = { team: short, sport }
  const r = seeded(`${short}-${sport}-${yrs}-fill`)
  for (const g of S.groups) {
    // year one is today's league as it is (a 36-year-old guard still starts); from then on, age catches up
    const list = S.pool[g].filter(p => p.team === short && !gone.includes(p.name)).map(p => man(S, g, p, yrs)).filter(p => yrs === 0 || p.age < RETIRE_AT[g])
    const slots = S.slots[g]
    // an empty starting spot always gets filled (a rookie), so a lineup never has a hole
    {
      for (const sl of slots ?? []) if (!list.some(p => p.slot === sl)) list.push({ name: rookieName(r), pos: g, ovr: clamp(Math.round(74 + (r() - 0.5) * 10), 64, 84), age: 22 + Math.floor(r() * 4), photo: null, slot: sl, rookie: true })
      while (list.length < S.keep[g]) list.push({ name: rookieName(r), pos: g, ovr: clamp(Math.round(74 + (r() - 0.5) * 10), 64, 84), age: 22 + Math.floor(r() * 4), photo: null, slot: null, rookie: true })
    }
    ro[g] = slots ? slots.map(s => list.find(p => p.slot === s)).filter(Boolean).concat(list.filter(p => !slots.includes(p.slot))).slice(0, S.keep[g]) : list.sort(byOvr).slice(0, S.keep[g])
  }
  return ro
}
// a team's roster as this career sees it: years older, and without anyone who's retired
const rosterOf = (c, short) => makeRoster(short, c.sport, rosterYrs(c), c.gone ?? [])
const rosterFor = (c, short = c.team) => (c.roster?.team === short ? c.roster : rosterOf(c, short))
// Where you stand at your spot: the group best-first with you in it. Last
// year's starter keeps the job in a tie (+2), a starter guarantee keeps it.
// A DB's spot: a corner or a safety (his build says which); the depth chart is that spot's
export const dbSpot = c => (c.build?.size?.subpos === 's' ? 's' : 'cb')
// (a corner or a safety: on the player, else from the DB data by name, for rosters saved before it was kept)
const DB_SPOT = Object.fromEntries(DBS.map(p => [p.name, p.subpos === 's' ? 's' : 'cb']))
const spotOf = p => (p.slot === 's' || p.slot === 'cb' ? p.slot : DB_SPOT[p.name] ?? 'cb')
export function depthChart(c, roster = c.roster ?? (c.team ? rosterOf(c, c.team) : null)) {
  const S = sportOf(c)
  // DBs: only the players at his spot (corners with corners, safeties with safeties), two start
  const db = c.pos === 'db'
  const group = (roster?.[c.pos] ?? []).filter(p => p.name !== c.name && (!db || spotOf(p) === dbSpot(c)))
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
  const starters = db ? 2 : S.starters[c.pos]
  return { all, idx, starters, starter: idx < starters, ahead: all.slice(0, idx), label: db ? `${dbSpot(c) === 's' ? 'S' : 'CB'}${idx + 1}` : S.depthLabel(c.pos, idx + 1) }
}
// The starters, you in your spot if you've won it
export function lineup(c, roster = c.roster ?? (c.team ? rosterOf(c, c.team) : null)) {
  const S = sportOf(c)
  const dc = depthChart(c, roster)
  const out = {}
  for (const g of S.groups) out[g] = g === c.pos ? dc.all.slice(0, dc.starters) : (roster?.[g] ?? []).slice(0, S.starters[g])
  // DBs: his spot's two starters (him among them if he's won it) and the other spot's two
  if (c.pos === 'db') out.db = [...dc.all.slice(0, 2).map(p => ({ ...p, slot: p.you ? dbSpot(c) : spotOf(p) })), ...(roster?.db ?? []).filter(p => p.name !== c.name && spotOf(p) !== dbSpot(c)).slice(0, 2).map(p => ({ ...p, slot: spotOf(p) }))]
  // everyone not starting, all positions, best first (basketball's bench)
  const reserves = S.groups.flatMap(g => (g === c.pos ? dc.all : roster?.[g] ?? []).slice(S.starters[g])).sort((a, b) => b.ovr - a.ovr)
  return { ...out, bench: dc.all.slice(dc.starters), reserves, depth: dc }
}
// Grades (0–11) for the pieces of the team around you, from the roster you'd play with
export function teamFit(short, pos, { roster = null, league = null, name = null, sport = 'nfl', yrs = 0, gone = [] } = {}) {
  const S = SPORT[sport] ?? SPORT.nfl
  const t = S.teamOf(short)
  const ro = roster?.team === short ? roster : makeRoster(short, sport, yrs, gone)
  const f = S.fit(ro, pos, p => p.name !== name)
  const drift = league?.[short] ?? { off: 0, def: 0 }
  const off = clamp(r10(t.off + drift.off), 1, 10), def = clamp(r10(t.def + drift.def), 1, 10)
  return {
    short, name: t.name, color: t.color, color2: t.color2, off, def, conf: t.conf, div: t.div, status: S.status((off + def) / 2),
    ...f, adj: clamp(Math.round(f.adj * 2) / 2, -1.5, 1.5),
  }
}
const fitFor = (c, short = c.team) => teamFit(short, c.pos, { roster: c.roster, league: c.league, name: c.name, sport: c.sport, yrs: rosterYrs(c), gone: c.gone ?? [] })
function simTeam(c, fit) { const S = sportOf(c); return S.simTeam(S.teamOf(c.team), fit, c.nextMods ?? {}, c) }
// Every offseason the league moves: good teams slip, bad ones climb, some lurch
function driftLeague(c, r) {
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
const FIRSTS = ['Jaylen', 'Marcus', 'Tre', 'Deon', 'Cole', 'Isaiah', 'Brock', 'Malik', 'Owen', 'Darius', 'Kade', 'Xavier', 'Jordan', 'Bryce', 'Quentin', 'Tyson', 'Elijah', 'Grant', 'Rashad', 'Mason']
const LASTS = ['Whitfield', 'Okafor', 'Banks', 'Delaney', 'Price', 'Henley', 'Mayfield', 'Corbin', 'Osei', 'Tatum', 'Rhodes', 'Vickers', 'Lyle', 'Stroud', 'Barlow', 'Kemp', 'Navarro', 'Sutton', 'Fofana', 'Hale']
const rookieName = r => `${FIRSTS[Math.floor(r() * FIRSTS.length)]} ${LASTS[Math.floor(r() * LASTS.length)]}`
const nickOf = (S, short) => nick(S.teamOf(short).name)
// The offseason on your team: everyone a year older, some better, some done;
// players leave, retire, get signed and drafted. Returns the new roster and
// the moves, in the order they'd hit the news.
function rosterMoves(c, r) {
  const S = sportOf(c)
  const old = rosterFor(c)
  const ro = { team: old.team, sport: c.sport }
  const moves = []
  const taken = new Set(S.groups.flatMap(g => old[g].map(p => p.name)))
  const grow = age => age <= 24 ? 1 + Math.floor(r() * 4) : age <= 28 ? Math.floor(r() * 4) - 1 : age <= 31 ? Math.floor(r() * 4) - 3 : -1 - Math.floor(r() * 5)
  const gl = g => (S.isBucket ? (g === 'guard' ? 'G' : 'F/C') : g.toUpperCase())
  for (const g of S.groups) {
    const kept = []
    for (const p0 of old[g]) {
      const p = { ...p0, age: p0.age + 1, ovr: clamp(p0.ovr + grow(p0.age + 1), 55, 99) }
      if (p.age >= RETIRE_AT[g] || (p.age >= RETIRE_AT[g] - 2 && r() < 0.35)) { moves.push({ kind: 'retire', pos: g, text: `${p.name} retires after ${p.age - 22} seasons.`, p }); continue }
      if (p.age > 25 && r() < 0.11) {   // the young ones are still on rookie deals
        const to = S.teams[Math.floor(r() * S.teams.length)].short
        if (to !== ro.team) { moves.push({ kind: 'leave', pos: g, text: `${p.name} leaves in free agency for the ${nickOf(S, to)}.`, p }); continue }
      }
      kept.push(p)
    }
    // refill: a free agent from around the league, or a rookie
    const slots = S.slots[g]
    while (kept.length < S.keep[g]) {
      const need = slots ? (slots.find(s => !kept.some(p => p.slot === s)) ?? null) : null
      if (r() < 0.55) {
        const pool = S.pool[g].filter(p => p.team !== ro.team && !taken.has(p.name) && !(c.gone ?? []).includes(p.name) && (!need || p.pos === need))
        const pick = pool[Math.floor(r() * pool.length)]
        if (pick) {
          const p = { ...man(S, g, pick, rosterYrs(c)), slot: need ?? pick.pos ?? null }
          if (p.age >= RETIRE_AT[g] - 1) continue
          taken.add(p.name); kept.push(p)
          moves.push({ kind: 'sign', pos: g, text: `Signed ${gl(g)} ${p.name} from the ${nickOf(S, pick.team)}.`, p })
          continue
        }
      }
      const rd = 1 + Math.floor(r() * S.draft.rounds)
      const p = { name: rookieName(r), pos: g, ovr: clamp(Math.round(80 - rd * (S.isBucket ? 5 : 2.5) + (r() - 0.5) * 8), 62, 86), age: 22, photo: null, slot: need, rookie: true }
      kept.push(p)
      moves.push({ kind: 'draft', pos: g, text: `Drafted ${gl(g)} ${p.name} in round ${rd}.`, p })
    }
    ro[g] = slots ? slots.map(s => kept.find(p => p.slot === s)).filter(Boolean).concat(kept.filter(p => !slots.includes(p.slot))).slice(0, S.keep[g]) : kept.sort(byOvr)
  }
  // sometimes they bring in competition at your spot
  if (r() < 0.22) {
    const rd = 1 + Math.floor(r() * 2)
    const p = { name: rookieName(r), pos: c.pos, ovr: clamp(Math.round(c.ovr - 6 + r() * 8), 64, 92), age: 22, photo: null, rookie: true }
    ro[c.pos] = [...ro[c.pos], p].sort(byOvr).slice(0, S.keep[c.pos])
    moves.push({ kind: 'rival', pos: c.pos, text: `The ${nickOf(S, ro.team)} draft ${S.label[c.pos]} ${p.name} in round ${rd}. Competition for your ${S.snaps}.`, p })
  }
  return { roster: ro, moves }
}

// ── A new career: the draft ───────────────────────────────────────────────────
// Interviews: teams picking around your projected slot sit you down. Who asks
// is the team's GM, head coach, coordinator or owner; the answer moves your
// stock with everyone, and that team's interest most of all.
export const INTERVIEWS = {
  nfl: [
    { who: 'General manager', q: 'We have a veteran at your spot. Could you sit and learn for a year?', a: [
      { t: 'Whatever helps the team. I\'ll be ready when you need me.', stock: 1, persona: 'grinder' },
      { t: 'I\'ll compete for the job from the first practice.', stock: 2, persona: 'confident' },
      { t: 'I didn\'t come here to hold a clipboard.', stock: -1, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'We won four games last year. Why would you want to come here?', a: [
      { t: 'Somebody has to turn it around. I want to be the reason.', stock: 2, persona: 'grinder' },
      { t: 'You\'re a couple of players away. I\'m one of them.', stock: 1, persona: 'confident' },
      { t: 'Honestly, I\'d rather go to a winner.', stock: -2, persona: 'cocky' } ] },
    { who: 'Offensive coordinator', q: 'On this clip the safety rotates down at the snap. Where does the ball go?', a: [
      { t: 'He vacated the deep middle. Post, over the top.', stock: 2, persona: 'confident' },
      { t: 'Check it to the run. Seven in the box isn\'t eight.', stock: 1, persona: 'grinder' },
      { t: 'Wherever I see it. I just make plays.', stock: -1, persona: 'cocky' } ] },
    { who: 'Owner', q: 'What would you do with your first real contract?', a: [
      { t: 'Take care of my family. Then get back to work.', stock: 1, persona: 'grinder' },
      { t: 'Nothing changes. The next one\'s bigger.', stock: 1, persona: 'confident' },
      { t: 'Cars. I\'m not going to lie to you.', stock: -1, persona: 'cocky' } ] },
    { who: 'General manager', q: 'Our doctors flagged an old ankle sprain. Be straight with us.', a: [
      { t: 'Fully healed. Here are my rehab notes, read them.', stock: 2, persona: 'grinder' },
      { t: 'Never missed a game because of it.', stock: 1, persona: 'confident' },
      { t: 'Doctors worry too much.', stock: -2, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'Tell me about the last time you got benched.', a: [
      { t: 'Junior year, I fumbled twice. I fixed it, and I earned it back.', stock: 2, persona: 'grinder' },
      { t: 'I haven\'t been benched since high school.', stock: 0, persona: 'confident' },
      { t: 'It was the coach\'s fault, honestly.', stock: -2, persona: 'cocky' } ] },
    { who: 'Offensive coordinator', q: 'We run a lot of wide-zone and play-action. Ever played in it?', a: [
      { t: 'Not much, but I\'ve been studying your tape all spring.', stock: 2, persona: 'grinder' },
      { t: 'I\'ll learn any system in a week.', stock: 1, persona: 'confident' },
      { t: 'Systems don\'t matter. Talent does.', stock: -1, persona: 'cocky' } ] },
    { who: 'General manager', q: 'A teammate trashes you in the press. What do you do?', a: [
      { t: 'Talk to him face to face. Keep it in the building.', stock: 2, persona: 'grinder' },
      { t: 'Let my play answer it on Sunday.', stock: 1, persona: 'confident' },
      { t: 'Fire back online. People should know.', stock: -2, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'Who\'s the best player in this draft?', a: [
      { t: 'There are a lot of good ones. I\'ll let you decide.', stock: 1, persona: 'grinder' },
      { t: 'You\'re looking at him.', stock: 1, persona: 'confident' },
      { t: 'Not even close. Me, then everyone else.', stock: -1, persona: 'cocky' } ] },
  ],
  bucket: [
    { who: 'General manager', q: 'We have an All-Star at your spot. Could you come off the bench for a year?', a: [
      { t: 'Whatever the team needs. I\'ll earn the minutes.', stock: 1, persona: 'grinder' },
      { t: 'I\'ll compete for the job from the first practice.', stock: 2, persona: 'confident' },
      { t: 'I didn\'t come here to sit.', stock: -1, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'We won twenty games last year. Why would you want to come here?', a: [
      { t: 'Somebody has to turn it around. I want to be the reason.', stock: 2, persona: 'grinder' },
      { t: 'You\'re a piece or two away. I\'m one of them.', stock: 1, persona: 'confident' },
      { t: 'Honestly, I\'d rather go to a winner.', stock: -2, persona: 'cocky' } ] },
    { who: 'Assistant coach', q: 'On this clip the help defender steps up on the drive. What\'s the read?', a: [
      { t: 'The corner is open. Kick it out before the rotation gets there.', stock: 2, persona: 'confident' },
      { t: 'Hit the roll man. He\'s got the lane.', stock: 1, persona: 'grinder' },
      { t: 'Finish through it. I don\'t pass out of that.', stock: -1, persona: 'cocky' } ] },
    { who: 'Owner', q: 'What would you do with your first real contract?', a: [
      { t: 'Take care of my family. Then get back in the gym.', stock: 1, persona: 'grinder' },
      { t: 'Nothing changes. The next one\'s bigger.', stock: 1, persona: 'confident' },
      { t: 'Cars. I\'m not going to lie to you.', stock: -1, persona: 'cocky' } ] },
    { who: 'General manager', q: 'Our doctors flagged an old knee issue. Be straight with us.', a: [
      { t: 'Fully healed. Here are my rehab notes, read them.', stock: 2, persona: 'grinder' },
      { t: 'Never missed a game because of it.', stock: 1, persona: 'confident' },
      { t: 'Doctors worry too much.', stock: -2, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'Tell me about the last time you got pulled from a game.', a: [
      { t: 'Sophomore year, four turnovers in a half. I fixed it, and I earned it back.', stock: 2, persona: 'grinder' },
      { t: 'I haven\'t been pulled since high school.', stock: 0, persona: 'confident' },
      { t: 'It was the coach\'s fault, honestly.', stock: -2, persona: 'cocky' } ] },
    { who: 'Player development coach', q: 'We switch everything on defense. Can you guard one through five?', a: [
      { t: 'I\'ll guard whoever you put in front of me. Show me the film.', stock: 2, persona: 'grinder' },
      { t: 'I\'ll lock up anyone.', stock: 1, persona: 'confident' },
      { t: 'Defense is for the guys who can\'t score.', stock: -2, persona: 'cocky' } ] },
    { who: 'General manager', q: 'A teammate calls you out on a podcast. What do you do?', a: [
      { t: 'Talk to him face to face. Keep it in the building.', stock: 2, persona: 'grinder' },
      { t: 'Let my game answer it on the floor.', stock: 1, persona: 'confident' },
      { t: 'Fire back online. People should know.', stock: -2, persona: 'cocky' } ] },
    { who: 'Head coach', q: 'Who\'s the best player in this draft?', a: [
      { t: 'There are a lot of good ones. I\'ll let you decide.', stock: 1, persona: 'grinder' },
      { t: 'You\'re looking at him.', stock: 1, persona: 'confident' },
      { t: 'Not even close. Me, then everyone else.', stock: -1, persona: 'cocky' } ] },
  ],
}
// The combine: three quick drills (components/app/MiniGame.jsx). A counted drill
// (reps, catches, nets, shots) shows exactly what was done in it: the trait already
// sets how hard the drill plays. A measured one (40, cone, velocity, vertical)
// starts from the trait's real-world range, and the run moves it inside that.
// pct (about -1 to 1) is where it lands against a typical prospect, for the scouts.
export const COMBINE_DRILLS = { ...SPORT.nfl.combine, ...SPORT.bucket.combine }
const drillValue = (id, v, score, raw) => {
  const t = clamp(v, 0, 11) / 11, run = score - 0.6               // run: a decent go is about 0
  const cnt = (of, lo = 0) => (raw?.made != null ? raw.made : Math.round(lo + score * (of - lo)))
  const pc = x => clamp(x, -1, 1)
  switch (id) {
    case 'forty': { const s = 4.95 - t * 0.6 - run * 0.2; return { text: `${s.toFixed(2)}s`, pct: pc((4.62 - s) / 0.22) } }
    case 'sprint': { const s = 3.55 - t * 0.4 - run * 0.14; return { text: `${s.toFixed(2)}s`, pct: pc((3.33 - s) / 0.15) } }
    case 'velo': { const m = Math.round(49 + t * 14 + run * 7); return { text: `${m} mph`, pct: pc((m - 56) / 6) } }
    case 'vert': { const i = r10(26 + t * 16 + run * 7); return { text: `${i}" vertical`, pct: pc((i - 33) / 6) } }
    case 'cone': { const of = raw?.of ?? 6, slips = of - cnt(of, 2); const s = 7.45 - t * 0.75 + slips * 0.07 - run * 0.08; return { text: `${s.toFixed(2)}s`, pct: pc((7.05 - s) / 0.3) } }
    case 'lane': { const of = raw?.of ?? 6, slips = of - cnt(of, 2); const s = 11.9 - t * 1.4 + slips * 0.12 - run * 0.15; return { text: `${s.toFixed(2)}s`, pct: pc((11.2 - s) / 0.6) } }
    case 'acc': { const of = raw?.of ?? 4, m = cnt(of); return { text: `${m} of ${of} completed`, pct: pc((m / of - 0.55) * 2.2) } }
    case 'spot': { const of = raw?.of ?? 4, m = cnt(of); return { text: `${m} of ${of} made`, pct: pc((m / of - 0.5) * 2.2) } }
    case 'gauntlet': { const of = raw?.of ?? 7, m = cnt(of, 2); return { text: `${m} of ${of} caught`, pct: pc((m / of - 0.7) * 3.3) } }
    case 'bench': { const n = raw?.reps ?? Math.round(8 + score * 22); return { text: `${n} reps`, pct: pc((n - 18) / 8) } }
    case 'nbench': { const n = raw?.reps ?? Math.round(4 + score * 16); return { text: `${n} reps`, pct: pc((n - 10) / 6) } }
    default: return { text: '—', pct: 0 }
  }
}
export function recordCombine(c, id, score, raw = null) {
  const combine = c.draft.combine.map(d => (d.id === id ? { ...d, score, ...drillValue(id, c.build[d.trait]?.val ?? 5, score, raw) } : d))
  return { ...c, draft: { ...c.draft, combine } }
}
const maxPick = S => S.teams.length * S.draft.rounds
export const pickLabel = (overall, sport = 'nfl') => { const n = (SPORT[sport] ?? SPORT.nfl).teams.length; const round = Math.ceil(overall / n); return { round, slot: overall - (round - 1) * n } }
export function stockOf(c) {
  const S = sportOf(c), d = c.draft
  const [lo0, hi0] = S.draft.stock(c.ovr)
  // the combine moves the window, the interviews too (less, in a two-round draft)
  const span = S.isBucket ? 3 : 9
  const played = d.combine.filter(x => x.pct != null)
  const comb = played.length ? played.reduce((s, x) => s + x.pct, 0) / played.length : 0
  const inter = (d.interviews ?? []).reduce((s, x) => s + (x.answer != null ? x.a[x.answer].stock : 0), 0)
  const shift = Math.round(-comb * span - inter * (S.isBucket ? 0.6 : 2))     // a good answer: about two picks earlier
  const lo = clamp(lo0 + shift, 1, maxPick(S)), hi = clamp(hi0 + shift, lo, maxPick(S))
  return { lo, hi, loP: pickLabel(lo, c.sport), hiP: pickLabel(hi, c.sport), shift }
}
// The range in draft-room terms: "Late 1st – mid 2nd round"
const ordinal = n => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
const band = (o, sport) => { const n = (SPORT[sport] ?? SPORT.nfl).teams.length, { round, slot } = pickLabel(o, sport); return { round, part: slot <= Math.ceil(n / 3) ? 'Early' : slot <= Math.ceil(n * 2 / 3) ? 'Mid' : 'Late' } }
export function stockText(c) {
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
  const S = sportOf(c)
  const r = seeded(`int-${c.seed}`)
  const order = draftOrder(c), N = order.length
  const { lo, hi } = stockOf(c)
  const near = []
  for (let o = Math.max(1, lo - 6); o <= Math.min(maxPick(S), hi + 6) && near.length < N; o++) { const t = order[(o - 1) % N]; if (!near.includes(t)) near.push(t) }
  const teams = near.sort(() => r() - 0.5).slice(0, 4)
  const qs = [...(INTERVIEWS[c.sport] ?? INTERVIEWS.nfl)].sort(() => r() - 0.5).slice(0, teams.length)
  return { ...c, draft: { ...c.draft, interviews: qs.map((q, i) => ({ ...q, a: [...q.a].sort(() => r() - 0.5), team: teams[i], answer: null })) } }   // (the answers in a random order: the best one isn't always first)
}
export function newCareer({ sport = 'nfl', uid = null, pos, build, name = 'Guest', slot = 0, owner = null }) {
  const S = SPORT[sport] ?? SPORT.nfl
  const seed = Math.random().toString(36).slice(2, 10)
  const r = seeded(`career-${seed}`)
  const types = S.types[pos]
  const ovr = S.ovr(pos, build)
  const drills = S.combine[pos].map(([id, label, trait]) => ({ id, label, trait, score: null, text: null, pct: null }))
  const dur = S.durable[pos].reduce((s, t) => s + (build[t]?.val ?? 5), 0) / S.durable[pos].length
  return {
    v: CAREER_V, sport, uid, slot, owner, seed, pos, types, name, build, base: build, ovr,
    age: (S.isBucket ? 19 : 21) + Math.floor(r() * 2), year: 0, season: FIRST_SEASON,
    phase: 'draft', step: 'combine',
    draft: { combine: drills, interviews: [], picks: null, pick: null, persona: null },
    team: null, fit: null, contract: null, role: 'Starter', lastRole: null, roster: null, league: null, off: null,
    dev: { points: 0, spent: 0 }, durability: r10(clamp(dur, 1, 10)), rep: 5,
    injuries: [], seasons: [], events: [], decisions: [], nextMods: null, goals: [],
    active: null, offers: null, tradeAsked: false, hof: null, retired: false, logged: false,
    earnings: 0,
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
  const S = sportOf(c)
  const r = seeded(`draft2-${c.seed}`)
  const order = draftOrder(c), N = order.length
  const { lo, hi } = stockOf(c)
  const picks = []
  const interest = {}
  for (const x of c.draft.interviews ?? []) if (x.answer != null) interest[x.team] = (interest[x.team] ?? 0) + x.a[x.answer].stock
  const need = short => teamFit(short, c.pos, { sport: c.sport }).need
  const cands = []
  for (let o = lo; o <= hi; o++) { const team = order[(o - 1) % N]; cands.push({ o, team, w: need(team) ** 2 + 1 + Math.max(0, interest[team] ?? 0) * 8 }) }
  const total = cands.reduce((s, x) => s + x.w, 0)
  let roll = r() * total, mine = cands[0]
  for (const x of cands) { roll -= x.w; if (roll <= 0) { mine = x; break } }
  // the picks before yours, shown as a ticker
  const names = ['Caleb Rowe', 'D.J. Harrow', 'Malik Sterling', 'Tyrese Oduya', 'Brock Wendell', 'Jalen Pike', 'Mason Trask', 'Kyren Bello', 'Luther Vance', 'Nico Amari', 'Trey Holcomb', 'Zion Marsh', 'Cole Brandt', 'Elijah Rook', 'Dante Ferris', 'Ty Castellano']
  const posList = S.draft.posList
  const from = Math.max(1, mine.o - 6)
  for (let o = from; o < mine.o; o++) picks.push({ o, ...pickLabel(o, c.sport), team: order[(o - 1) % N], player: names[(o * 7) % names.length], pos: posList[(o * 5) % posList.length] })
  picks.push({ o: mine.o, ...pickLabel(mine.o, c.sport), team: mine.team, you: true })
  const roster = makeRoster(mine.team, c.sport)
  const fit = teamFit(mine.team, c.pos, { roster, name: c.name, sport: c.sport })
  const contract = S.draft.rookie(mine.o)
  const met = (c.draft.interviews ?? []).some(x => x.team === mine.team)
  const lbl = pickLabel(mine.o, c.sport)
  return { ...c, phase: 'draft', step: 'day', draft: { ...c.draft, picks, pick: picks[picks.length - 1] }, team: mine.team, roster, fit, contract, decisions: [...c.decisions, { year: 1, text: `Drafted in round ${lbl.round}, pick ${lbl.slot} (No. ${mine.o} overall) by the ${fit.name}${met ? ' (they interviewed you)' : ''}` }] }
}

// ── Goals for a season ───────────────────────────────────────────────────────
// The year's goals, from the role. A starter gets the full-season numbers.
// Off the bench (basketball): the same goals, sized for fewer minutes.
// A backup (football): judged on the games he does start, per start, and
// winning those starts.
const r1 = x => Math.round(x * 10) / 10
export const goalsFor = c => {
  const S = sportOf(c)
  const raw = S.goals[c.pos](c.ovr)
  const full = raw.map(([k, verb, n, unit]) => ({ k, label: `${verb} ${n.toLocaleString()} ${unit}`, n }))
  const dc = c.team ? depthChart(c) : null
  if (!dc || dc.starter) return full
  // football backup in the rotation (not a QB): the season's goals at his share of the work
  const u = !S.isBucket ? backupShare(c.pos, dc.idx - dc.starters) : 0
  if (u > 0) return raw.map(([k, verb, n, unit]) => { if (k === 'wins') return full.find(g => g.k === k); const m = Math.max(1, Math.round(n * u / (n >= 100 ? 25 : 1)) * (n >= 100 ? 25 : 1)); return { k, label: `${verb} ${m.toLocaleString()} ${m === 1 ? unit.replace(/(e)?s$/, '') : unit}`, n: m } })
  if (S.isBucket) return raw.map(([k, verb, n, unit]) => k === 'wins' ? full.find(g => g.k === k) : { k, label: `${verb} ${r1(n * 0.6)} ${unit} off the bench`, n: r1(n * 0.6) })
  const per = raw.filter(([k, , n]) => k !== 'wins' && n / 17 >= 1).slice(0, 2).map(([k, verb, n, unit]) => { const m = n / 17 >= 10 ? Math.round(n / 17) : r1(n / 17); return { k, per: 'start', label: `${verb} ${m.toLocaleString()} ${unit} a start`, n: m } })
  return [...per, { k: 'startWins', label: 'Win half the games you start', n: 0.5 }]
}
// s: { stats, wins, starts, startWins }
const goalMet = (g, s) => g.k === 'startWins' ? s.starts > 0 && s.startWins / s.starts >= g.n
  : g.per === 'start' ? s.starts > 0 && (s.stats[g.k] ?? 0) / s.starts >= g.n
  : (s.stats[g.k] ?? (g.k === 'wins' ? s.wins : 0)) >= g.n

// ── The season: the director plays it, we steer and keep score ───────────────
export const seasonStats = (pos, f) => sportForPos(pos).seasonStats(pos, f)
// A backup still plays (except a backup quarterback): RB2 splits the carries,
// a fourth receiver or second tight end gets packages, the fifth DB plays
// nickel. Share of a starter's workload, by how far down the depth chart.
const SHARE = { rb: [0.45, 0.18], wr: [0.35, 0.15], te: [0.35, 0.12], db: [0.5, 0.25] }
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
const director = (c, team, base, seed, simFn = simFor(c)) => createDirector({ sport: c.sport, pos: c.pos, build: c.build, team, simFn, base, seed, name: c.name, attrMap: POS_ATTR[c.pos], types: c.types, always: true, recordBook: c.recordBook ?? null })
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
  if (!dc.starter && !S.isBucket) {
    const rr = seeded(`${c.seed}-bench-${c.year}`)
    const ahead = dc.ahead[dc.ahead.length - 1]
    const gap = ahead.ovr - c.ovr
    const T = plain(c.build, team).games.length
    const frac = gap <= 2 ? 0.18 + rr() * 0.22 : gap <= 6 ? (rr() < 0.5 ? 0.4 + rr() * 0.35 : 1) : (rr() < 0.45 ? 0.35 + rr() * 0.45 : 1)
    weeks = Math.max(1, Math.min(T, Math.round(frac * T)))
    // everyone but a quarterback still plays until then, at a share of the snaps
    const u = backupShare(c.pos, dc.idx - dc.starters)
    if (u > 0) share = { u, weeks }
  }
  const simFn = share ? shareSim(plain, share.u, share.weeks) : plain
  const base = simFn(c.build, team)
  const D = director(cc, team, base, seed, simFn)
  seasonSwing(cc, D)
  // not the starter. Basketball: off the bench all year, a smaller role.
  // Football: the season opens on the bench, until the job comes your way.
  let benched = null
  if (!dc.starter && S.isBucket) {
    benched = { weeks: D.total, behind: dc.ahead[dc.ahead.length - 1].name, label: dc.label, bench: true }
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
  const feed = benched ? [{ k: 0, note: benched.bench ? `${benched.behind} starts. ${c.name} comes off the bench this season: fewer minutes, a smaller role.` : `${benched.behind} is the starter. ${c.name} opens the season as ${benched.label}${benched.rotation ? ', in the rotation' : ''}.`, noteKind: benched.bench ? 'ROTATION' : 'DEPTH CHART' }] : []
  const next = { ...cc, phase: 'season', fit, role: dc.starter ? 'Starter' : 'Backup', simTeam: team, goals: goalsFor(cc), active: { k: 0, base, snap: D.snapshot(), seed, moment: null, feed, injury: null, benched, share } }
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
  for (let n = 0; n < S.step && k < D.total && !injury && !moment; n++) {
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
    if (S.step === 1) feed.push({ k, g, hits, headline })
    else { chunk.games.push(g); chunk.hits.push(...hits); chunk.headline.push(...headline) }
    last = { g, hits }
    // an injury: the body, the age and a little luck
    const r = seeded(`${c.seed}-inj-${c.year}-${k}`)
    const risk = (0.028 * (11 - c.durability) / 6) * (c.age >= 31 ? 1.5 : 1) * (g?.sat ? 0 : 1) * S.injScale
    if (k < D.total && r() < risk && !c.injuries.some(i => i.year === c.year + 1 && i.at > k - 4 / S.injScale)) {
      const [kind, lo, hi] = S.injuries[Math.floor(r() * S.injuries.length)]
      const games = lo + Math.floor(r() * (hi - lo + 1))
      const serious = r() < 0.06
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
  let next = withSnap(c, D, { k, feed })
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
  const cc = dur ? { ...c, durability: r10(clamp(c.durability + dur, 1, 10)) } : c
  return [withSnap(cc, D, { moment: null, feed }), outcome]
}
// Injury: sit it out, or play through (traits down for longer, and it can get worse)
export function resolveInjury(c, D, play) {
  const S = sportOf(c)
  const inj = c.active.injury, at = c.active.k
  const r = seeded(`${c.seed}-injres-${c.year}-${at}`)
  let text
  if (play && !inj.serious) {
    const worse = r() < 0.35
    const attr = Object.fromEntries(S.physical[c.pos].slice(0, 2).map(t => [t, -1]))
    D.choose({ id: 'injury', stop: { at, kind: 'season' }, title: inj.kind }, { label: 'play through it', effect: { window: inj.games + 2, attr } })
    if (worse) { D.sidelined(at + 1, inj.games); text = `Played through the ${inj.kind}, then it got worse. Out ${inj.games} games.` }
    else text = `Playing through the ${inj.kind}. Not yourself for ${inj.games + 2} games.`
  } else {
    D.sidelined(at, inj.games)
    text = inj.serious ? `${inj.kind}: season over.` : `Out ${inj.games} games with the ${inj.kind}.`
  }
  const injuries = [...c.injuries, { year: c.year + 1, at, kind: inj.kind, games: inj.games, played: !!play, serious: !!inj.serious }]
  const feed = [...c.active.feed, { k: at, injuryText: text }]
  return [withSnap({ ...c, injuries, durability: r10(Math.max(1, c.durability - 0.4)) }, D, { injury: null, feed, ...(inj.serious ? { out: true } : {}) }), text]
}
// The regular season's over: book it, or go into the playoffs (a bracket of
// our own, one skill moment a round, played on the hub)
export function finishRegular(c, D) {
  const f = D.finalize()
  if (!sportOf(c).made(f)) return bookSeason({ ...c, active: { ...c.active, final: f, po: null } })
  // out for the season: the team plays the playoffs without you, no moments
  if (c.active.out) return bookSeason({ ...c, active: { ...c.active, final: f, po: watchBracket(c, buildBracket(c, f)) } })
  return { ...c, active: { ...c.active, final: f, po: buildBracket(c, f) } }
}
const strength = t => ((t.off ?? 5) + (t.def ?? 5)) / 2
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
    const base = 0.5 + (myStr - strength(opp)) * 0.08 + (home ? 0.06 : home === false ? -0.03 : 0) + ((c.ovr - 76) / 100) * 0.35
    return { name, opp: opp.short, oppName: opp.name, home, p: clamp(Math.round(base * 100) / 100, 0.18, 0.84), played: false, series: S.series && !playIn }
  })
  return { idx: 0, rounds, line: [], used: [], stage: 'round', won: false, out: false }
}
// The bracket played out from the sideline: each round on the team's odds, no stat line
function watchBracket(c, po) {
  const S = sportOf(c)
  const r = seeded(`${c.seed}-pow-${c.year}`)
  const line = []
  for (const rd of po.rounds) {
    const won = r() < clamp(rd.p - 0.12, 0.08, 0.9)
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
// This round's moment is in: the result, with a stat line sized to the season
export function playoffRound(c, score, game = null) {
  const S = sportOf(c)
  const a = c.active, po = a.po, f = a.final
  const rd = po.rounds[po.idx]
  const r = seeded(`${c.seed}-por-${c.year}-${po.idx}`)
  const p = clamp(rd.p + (score - 0.5) * 0.36, 0.08, 0.92)
  const won = r() < p
  const k = 0.82 + score * 0.5 + (r() - 0.5) * 0.2             // the moment sets the day: 0.6–1.4× a normal game
  let mySc, oppSc, line
  if (S.isBucket) {
    if (rd.series) { const other = won ? [0, 1, 1, 2, 2, 3][Math.floor(r() * 6)] : [0, 1, 1, 2, 2, 3][Math.floor(r() * 6)]; mySc = won ? 4 : other; oppSc = won ? other : 4 }
    else { mySc = Math.round(100 + score * 12 + r() * 10); oppSc = won ? Math.max(85, mySc - 2 - Math.floor(r() * 14)) : mySc + 1 + Math.floor(r() * 12) }
    const st = seasonStats(c.pos, f)
    // a series is four to seven games: the average barely moves off the season's (0.85–1.15×), never past a real ceiling
    const kb = clamp(0.9 + score * 0.18 + (r() - 0.5) * 0.08 + (won ? 0.02 : -0.03), 0.84, 1.15)
    line = { pts: r10(Math.min(st.ppg * kb, 42)), reb: r10(Math.min(st.rpg * kb, 17)), ast: r10(Math.min(st.apg * kb, 13)), perGame: true }
  } else {
    const g = f.wins + f.losses || 17
    const n = (sum, mult = 1) => Math.max(0, Math.round(((sum ?? 0) / g) * k * mult))
    mySc = Math.round(17 + (c.simTeam?.off ?? 5) * 1.2 + score * 8 + r() * 6); oppSc = won ? Math.max(3, mySc - 3 - Math.floor(r() * 14)) : mySc + 1 + Math.floor(r() * 12)
    line = c.pos === 'qb' ? { passYds: n(f.seasonPassYds), tds: n(f.seasonTDs, won ? 1.1 : 0.8), ints: Math.round((1 - score) * 2 * r()), rushYds: n(f.seasonRushYds) }
      : c.pos === 'db' ? { tackles: n(f.seasonTackles), ints: n(f.seasonINTs, won ? 1.4 : 0.6), pbus: n(f.seasonPBUs) }
      : c.pos === 'rb' ? { rushYds: n(f.seasonRushYds), rushTDs: n(f.seasonRushTDs, won ? 1.2 : 0.7), recTDs: 0, recYds: n(f.seasonRecYds), carries: n(f.seasonCarries) }
      : { rec: n(f.seasonRecs), recYds: n(f.seasonRecYds), recTDs: n(f.seasonRecTDs, won ? 1.3 : 0.6) }
  }
  const entry = { ...rd, played: true, won, mySc, oppSc, score, game, ...line }
  const rounds = po.rounds.map((x, i) => (i === po.idx ? entry : x))
  const fin = rd.name === S.final
  const done = !won || fin
  return { ...c, active: { ...a, po: { ...po, rounds, line: [...po.line, entry], idx: done ? po.idx : po.idx + 1, stage: done ? 'done' : 'round', won: won && fin, out: !won } } }
}
// Playoffs over (or none): the season is booked, then the offseason
export function bookSeason(c) {
  const S = sportOf(c)
  const f = c.active.final, po = c.active.po
  const stats = seasonStats(c.pos, f)
  // the award needs a season that would really win it: the voters' pick and the numbers
  const award = S.award(c, f, stats)
  const allPro = S.allPro[c.pos](stats)
  const missed = (f.story?.sat ?? 0)
  const benched = c.active.benched?.weeks ?? 0
  const started = (f.games ?? []).filter(g => !g.sat)     // the games he played (a backup's starts)
  const rounds = (po?.line ?? []).map(x => ({ round: x.name, opponent: x.oppName, won: x.won, mySc: x.mySc, oppSc: x.oppSc, series: !!x.series }))
  const fin = rounds.find(x => x.round === S.final)
  const s = {
    year: c.year + 1, season: c.season, age: c.age, team: c.team, teamName: c.fit.name, ovr: c.ovr, role: c.role,
    wins: f.wins, losses: f.losses, playoffs: S.made(f), champion: !!po?.won, rounds, sb: fin ? { won: fin.won, mySc: fin.mySc, oppSc: fin.oppSc, series: fin.series } : null,
    stats, award, awardName: S.awardName[c.pos], proBowl: S.proBowl[c.pos](stats) || award || allPro, allPro: allPro || (award && S.allProNear[c.pos](stats)),
    missed, benched, records: (f.story?.records ?? []).map(x => x.label ?? x.id), milestones: (f.story?.milestones ?? []).filter(m => m.big).map(m => m.label),
    goals: started.length || c.role !== 'Backup' ? c.goals.map(g => ({ ...g, met: goalMet(g, { stats, wins: f.wins, starts: started.length, startWins: started.filter(x => x.won).length }) })) : [], xp: f.story?.xp ?? 0, bestGame: f.bestGame ?? null,
    poStats: po && po.line.some(x => !x.sat) ? po.line.filter(x => !x.sat).reduce((acc, x) => { for (const k of S.lineKeys) if (x[k] != null) acc[k] = (acc[k] ?? 0) + x[k]; return acc }, { games: po.line.filter(x => !x.sat).length }) : null,
  }
  // records this career set: next season's bar is its own number, not the league's
  const recordBook = { ...(c.recordBook ?? {}) }
  for (const x of f.story?.records ?? []) if (x.id && typeof x.raw === 'number' && x.raw > (recordBook[x.id]?.value ?? -Infinity)) recordBook[x.id] = { value: x.raw, holder: `${c.name}, ${c.season}` }
  const contract = { ...c.contract, left: c.contract.left - 1 }
  const perf = seasonScore(c.pos, s)
  // a development point a year; a second for an award or All-Pro / All-NBA season
  const dev = { ...c.dev, points: c.dev.points + 1 + (s.award || s.allPro ? 1 : 0) }
  const rep = clamp(c.rep + (s.goals.filter(g => g.met).length >= 2 ? 1 : 0) + (s.champion ? 1 : 0) - (perf < 0.25 ? 1 : 0), 1, 10)
  const lastRole = benched < (f.wins + f.losses || 17) / 2 ? 'Starter' : 'Backup'
  let next = { ...c, recordBook, phase: 'offseason', seasons: [...c.seasons, s], contract, dev, rep, lastRole, active: null, simTeam: null, goals: [], earnings: r10(c.earnings + c.contract.perYear + (c.shoe?.perYear ?? 0)), nextMods: null, talks: null, tradeAsked: false }
  // the offseason: the league moves, your team's roster turns over, the news
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
export const SHOE = { deal: { legacy: 4, perYear: 2 }, signature: { legacy: 8, perYear: 6 } }
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
  const what = next === 'signature' ? (S.isBucket ? 'his own signature shoe' : 'his own signature cleat') : (S.isBucket ? 'a national shoe deal' : 'a national shoe and apparel deal')
  const bump = SHOE[next].legacy
  return {
    ...c, shoe: { tier: next, year: c.year + 1, perYear: SHOE[next].perYear },
    legacyBonus: (c.legacyBonus ?? 0) + bump,
    events: [...c.events, { year: c.year + 1, text: `${c.name} signs ${what}. ${next === 'signature' ? 'A face of the league now.' : 'The name travels now.'} +${bump} legacy.` }],
    decisions: [...c.decisions, { year: c.year + 1, text: `Signed ${what} ($${SHOE[next].perYear}M a year)` }],
  }
}
// the biggest movers around the league this offseason
function leagueNews(c, league) {
  const S = sportOf(c)
  const was = s => { const d = c.league?.[s] ?? { off: 0, def: 0 }; return d.off + d.def }
  const now = s => league[s].off + league[s].def
  return S.teams.map(t => ({ t, d: now(t.short) - was(t.short) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3)
    .map(({ t, d }) => `The ${nick(t.name)} ${d > 0 ? (d > 2 ? 'reload: one of the big winners of the offseason' : 'get better on paper') : (d < -2 ? 'lose a lot of talent. A long year ahead' : 'take a step back')}.`)
}
// Behind someone, or the team wants a reset: you can get moved
function maybeTraded(c, r) {
  const S = sportOf(c)
  if (c.contract.left <= 0 || c.contract.noTrade) return c
  const before = c.seasons[c.seasons.length - 2]
  const p = c.lastRole !== 'Backup' ? 0.04 : before && before.benched >= (before.wins + before.losses) / 2 ? 0.8 : 0.45
  if (r() >= p) return c
  // a team where you'd start
  const fits = S.teams.filter(t => t.short !== c.team).map(t => ({ t, ro: rosterOf(c, t.short) }))
    .filter(x => (x.ro[c.pos][S.starters[c.pos] - 1]?.ovr ?? 0) < c.ovr)
  const pick = fits.length ? fits[Math.floor(r() * fits.length)] : null
  if (!pick) return c
  return {
    ...c, team: pick.t.short, roster: pick.ro, traded: true, tradeAsked: false,
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
export const CAMP_LEGACY = 3
export function campDrill(c, score, game) {
  const won = score >= 0.75
  const chance = won ? clamp(0.25 + (score - 0.75) * 2, 0.25, 0.75) : 0
  const bonus = won && seeded(`${c.seed}-campdev-${c.year}`)() < chance ? 1 : 0
  const legacy = won ? CAMP_LEGACY : 0
  return { ...c, legacyBonus: (c.legacyBonus ?? 0) + legacy, dev: { ...c.dev, points: c.dev.points + bonus }, off: { ...c.off, camp: { score, won, bonus, legacy, chance, game } } }
}
const traitName = (c, t) => POS_ATTR[c.pos][t]?.label ?? t
// A trait is maxed once it shows S (grades are rounded: 10.5 and up is S)
// How far offseason work can take a trait: you can't train much height. Size
// moves twice in a career, the explosive traits (speed, bounce) three times.
export const UPGRADE_CAP = { size: 2, heightLength: 2, speed: 3, bounce: 3 }
// at the top of the scale, or out of upgrades for that trait
export const maxedTrait = (v, ch = null, type = null) => Math.round(v ?? 0) >= 11 || (type != null && UPGRADE_CAP[type] != null && (ch?.upgraded ?? 0) >= UPGRADE_CAP[type])
// The last step costs more: A+ to S takes 2 points, everything else 1
export const upgradeCost = v => (Math.round(v ?? 0) >= 10 ? 2 : 1)
// Physical traits can only be trained while young (the position's window); skill
// and mental traits any time. { open, left (offseasons incl. this one), until } or null (no window)
export function trainWindow(c, type) {
  const S = sportOf(c)
  if (!S.physical[c.pos]?.includes(type)) return null
  const until = S.trainUntil(c.pos)
  return { open: c.age <= until, left: Math.max(0, until - c.age + 1), until }
}
export function canUpgrade(c, type) {
  const ch = c.build[type]
  if (!ch || maxedTrait(ch.val, ch, type)) return false
  const w = trainWindow(c, type)
  if (w && !w.open) return false
  return c.dev.points >= upgradeCost(ch.val)
}
export function spendDev(c, type) {
  if (!canUpgrade(c, type)) return c
  const cost = upgradeCost(c.build[type].val)
  const from = c.build[type].val
  // one grade up, exactly: a 9.6 (A) becomes an A+, not a 10.6 that also reads S
  const build = { ...c.build, [type]: { ...c.build[type], val: Math.min(11, Math.round(from) + 1), upgraded: (c.build[type].upgraded ?? 0) + 1 } }
  return { ...c, build, ovr: ovrOf(c.pos, build, c.sport), dev: { points: c.dev.points - cost, spent: c.dev.spent + cost }, decisions: [...c.decisions, { year: c.year + 1, text: `Offseason work: ${traitName(c, type)} ${valToGrade(from)} → ${valToGrade(from + 1)}` }] }
}
const EVENTS = {
  nfl: [
    { id: 'new-oc', w: 3, text: t => `The ${t} hire a new offensive coordinator. New scheme, new reps to learn.`, apply: () => ({ nextMods: { off: -0.5 } }) },
    { id: 'coach-fired', w: 2, when: c => c.seasons[c.seasons.length - 1]?.wins <= 6, text: t => `The ${t} fire the head coach after a lost season. A reset is coming.`, apply: () => ({ nextMods: { off: -0.5, def: -0.5 } }) },
    { id: 'defense-up', w: 2, text: t => `The ${t} spend big on defense. Fewer shootouts, more wins.`, apply: () => ({ nextMods: { def: 1 } }) },
    { id: 'trainer', w: 2, text: () => `A new strength staff and a full offseason in the building. The body feels bulletproof.`, apply: c => ({ durability: r10(Math.min(10, c.durability + 0.6)) }) },
    { id: 'holdout', w: 1, when: c => c.contract.kind === 'rookie' && c.contract.left === 1 && c.rep >= 6, text: () => `The agent wants an extension now. Talks stall into camp.`, apply: c => ({ nextMods: { off: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
    { id: 'captain', w: 2, when: c => c.rep >= 7, text: t => `The ${t} vote you a team captain. The locker room is yours.`, apply: c => ({ rep: Math.min(10, c.rep + 1) }) },
    { id: 'scheme-fit', w: 2, text: t => `The ${t} redesign the playbook around their best players. More touches are coming.`, apply: () => ({ nextMods: { off: 0.5 } }) },
    { id: 'mentor', w: 2, good: true, when: c => c.age <= 25, text: (t, c) => `A ten-year veteran on the ${t} takes ${c.name} under his wing. Film every morning, extra reps every night.`, apply: c => ({ dev: { ...c.dev, points: c.dev.points + 1 } }) },
    { id: 'built-around', w: 2, good: true, when: c => c.rep >= 6, text: (t, c) => `The ${t} coaching staff builds the game plan around ${c.name}. More touches are coming.`, apply: () => ({ nextMods: { off: 0.75 } }) },
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
    { id: 'trainer', w: 2, text: () => `A new performance staff and a full summer in the gym. The body feels bulletproof.`, apply: c => ({ durability: r10(Math.min(10, c.durability + 0.6)) }) },
    { id: 'extension', w: 1, when: c => c.contract.kind === 'rookie' && c.contract.left === 1 && c.rep >= 6, text: () => `The agent wants the extension done now. Talks stall into training camp.`, apply: c => ({ nextMods: { off: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
    { id: 'captain', w: 2, when: c => c.rep >= 7, text: t => `The ${t} name you a captain. The locker room is yours.`, apply: c => ({ rep: Math.min(10, c.rep + 1) }) },
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
  const text = ev.text(nickOf(S, c.team), c)
  const fx = ev.apply(c)
  return { ...c, ...fx, nextMods: fx.nextMods ? { ...(c.nextMods ?? {}), ...fx.nextMods } : c.nextMods, events: [...c.events, { year: c.year + 1, text }] }
}
function marketValue(c) {
  const S = sportOf(c)
  const last = c.seasons.slice(-2)
  const perf = last.length ? last.reduce((s, x) => s + seasonScore(c.pos, x), 0) / last.length : 0.3
  const ageCut = c.age >= 33 ? 0.6 : c.age >= 30 ? 0.8 : 1
  const [lo, hi] = S.money[c.pos]
  // reputation moves the number a little: a good name is worth up to +10%, a bad one −8%
  const repCut = 0.9 + (c.rep ?? 5) * 0.02
  return r10((lo + (hi - lo) * clamp(perf, 0, 1) * ageCut) * repCut)
}
// Contract's up: the team's offer and two from the market; none at all when
// nobody's calling (that's the end of the road)
function contractSituation(c) {
  const S = sportOf(c)
  if (c.contract.left > 0) return null
  // the career's over anyway (age, or the most seasons): no free agency to sign into
  if (c.age >= retireAge(c) || c.seasons.length >= MAX_SEASONS) return null
  const r = seeded(`${c.seed}-fa-${c.year}`)
  const value = marketValue(c)
  const last = c.seasons[c.seasons.length - 1]
  const perf = seasonScore(c.pos, last)
  if (c.age >= 34 && perf < 0.35) return []
  // teams commit longer to a good name (+1 year at 8+), shorter to a bad one (−1 at 3 or less)
  const repYrs = (c.rep ?? 5) >= 8 ? 1 : (c.rep ?? 5) <= 3 ? -1 : 0
  const years = clamp((c.age >= 32 ? 1 + Math.floor(r() * 2) : c.age >= 29 ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3)) + repYrs, 1, 6)
  const fitAt = short => teamFit(short, c.pos, { roster: c.roster, league: c.league, name: c.name, sport: c.sport, yrs: rosterYrs(c), gone: c.gone ?? [] })
  const others = S.teams.filter(t => t.short !== c.team).sort(() => r() - .5).map(t => fitAt(t.short))
  const good = 7, bad = 6
  const contender = others.find(f => (f.off + f.def) / 2 >= good) ?? others[0]
  const payer = others.find(f => f.short !== contender.short && (f.off + f.def) / 2 < bad) ?? others[1]
  // where you'd stand on each team's depth chart
  const standAt = short => { const dc = depthChart({ ...c, contract: {}, lastRole: short === c.team ? c.lastRole : null }, short === c.team ? c.roster : rosterOf(c, short)); return { starter: dc.starter, behind: dc.ahead[dc.ahead.length - 1]?.name ?? null, label: dc.label } }
  const mk = (fit, perYear, yrs, pitch, kind) => ({ team: fit.short, fit, perYear: r10(perYear), years: yrs, pitch, kind, stand: standAt(fit.short) })
  return [
    mk(fitAt(c.team), value * (0.92 + r() * .1), years, 'Stay. Finish what you started here.', 'stay'),
    mk(contender, value * (0.68 + r() * .12), Math.max(1, years - 1), 'Less money. A real shot at a ring.', 'contender'),
    mk(payer, value * (1.12 + r() * .2), years + (c.age < 29 ? 1 : 0), 'Top of the market. A rebuild wants a face.', 'payer'),
  ]
}
export function signOffer(c, o) {
  const change = o.team !== c.team
  const extras = [o.noTrade ? 'no-trade clause' : null, o.starter ? 'starter guarantee' : null].filter(Boolean)
  const roster = change ? rosterOf(c, o.team) : c.roster
  return {
    ...c, team: o.team, roster, fit: teamFit(o.team, c.pos, { roster, league: c.league, name: c.name, sport: c.sport }), offers: null, talks: null, tradeAsked: false, lastRole: change ? null : c.lastRole, ...(change && c.off ? { off: { ...c.off, moves: [] } } : {}),
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
  notrade: { label: 'NO-TRADE CLAUSE', sub: 'They can\'t move you', cost: [2, 3], hi: 0.4 },
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
  const pushed = kind === 'money' ? r10(t.perYear * 1.08) : t.perYear
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
  const r = seeded(`${c.seed}-trade-${c.year}`)
  const granted = r() < 0.7
  const rep = Math.max(1, c.rep - 2)
  if (!granted) return { ...c, rep, tradeAsked: true, nextMods: { ...(c.nextMods ?? {}), off: ((c.nextMods?.off) ?? 0) - 0.5 }, events: [...c.events, { year: c.year + 1, text: `${c.name} asked for a trade. The team said no, and the locker room heard about it.` }] }
  const dest = S.teams.map(t => S.teamOf(t.short)).filter(t => t.short !== c.team).sort(() => r() - .5).sort((a, b) => (b.off + b.def) - (a.off + a.def))[Math.floor(r() * 6)]
  const roster = rosterOf(c, dest.short)
  const fit = teamFit(dest.short, c.pos, { roster, league: c.league, name: c.name, sport: c.sport })
  return { ...c, rep, tradeAsked: true, team: dest.short, roster, fit, lastRole: null, off: { ...(c.off ?? {}), moves: [] }, events: [...c.events, { year: c.year + 1, text: `Trade request granted: a ${nick(fit.name)} now.` }], decisions: [...c.decisions, { year: c.year + 1, text: `Demanded a trade, dealt to the ${fit.name}` }] }
}
// Into the next season: a year older, the body moves with it
export function nextSeason(c) {
  const S = sportOf(c)
  if (c.offers && c.offers.length && !c.contract.left) return c      // sign first
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
  if (age <= 24 && r() < 0.45) move(c.types[Math.floor(r() * c.types.length)], 1, 'Still growing')
  else if (age <= 28 && r() < 0.2) move(c.types[Math.floor(r() * c.types.length)], 1, 'A step forward')
  const phys = S.physical[c.pos]
  const pickPhys = () => phys[Math.floor(r() * phys.length)]
  // the body fades from the position's age (an RB first, a QB last)
  const from = S.declineAt(c.pos)
  if (age >= from) {
    const p = age >= from + 4 ? 1 : age >= from + 2 ? 0.8 : 0.5
    if (r() < p) move(pickPhys(), -1, 'Father Time')
    if (age >= from + 4 && r() < 0.4) move(pickPhys(), -1, 'Father Time')
  }
  // a big injury last season (season-ending, or a long stretch out) can take something with it
  for (const inj of c.injuries.filter(x => x.year === c.year + 1 && (x.serious || x.games >= S.bigInjury))) {
    if (r() < 0.6) move(pickPhys(), -1, `The ${inj.kind}`)
  }
  // a body that keeps breaking down wears down
  if (age >= 26 && c.durability <= 4 && r() < (c.durability <= 3 ? 0.4 : 0.25)) move(pickPhys(), -1, 'Wear and tear')
  const ovr = ovrOf(c.pos, build, c.sport)
  const n = { ...c, age, year: c.year + 1, season: c.season + 1, build, ovr, phase: 'preseason', offers: null, aging: notes, off: null, traded: false }
  return { ...n, fit: fitFor(n) }
}
export const canRetire = c => c.age >= 29 || c.seasons.length >= 8
// The end of the road: the body (40, quarterbacks 42), the most seasons a career
// can run, or a free agency where nobody calls
export const retireAge = c => 40 + (sportOf(c).ageShift?.(c.pos) ?? 0)
export function retireReason(c) {
  if (c.age >= retireAge(c)) return 'age'
  if (c.seasons.length >= MAX_SEASONS) return 'seasons'
  if (Array.isArray(c.offers) && c.offers.length === 0) return 'nocalls'
  return null
}
export const mustRetire = c => !!retireReason(c)
export function retire(c) {
  const L = legacyOf(c)
  const hof = hofVote(c, L)
  return logCareer({ ...c, phase: 'retired', retired: true, hof, offers: null, active: null, decisions: [...c.decisions, { year: c.year + 1, text: `Retired at ${c.age} after ${c.seasons.length} seasons` }] })
}

// ── Legacy ───────────────────────────────────────────────────────────────────
export function careerTotals(c) {
  const S = sportOf(c)
  const Ss = c.seasons
  const stats = {}
  for (const s of Ss) for (const [k, v] of Object.entries(s.stats)) { if (S.rateKeys.includes(k) || k === 'gp') continue; stats[k] = (stats[k] ?? 0) + (v ?? 0) }
  const games = Ss.reduce((a, s) => a + (s.stats.gp ?? (s.wins + s.losses - (s.missed ?? 0))), 0)
  if (S.averages) for (const [avg, tot] of Object.entries(S.averages)) stats[avg] = games ? r10((stats[tot] ?? 0) / games) : 0
  return {
    seasons: Ss.length, games, wins: Ss.reduce((a, s) => a + s.wins, 0), losses: Ss.reduce((a, s) => a + s.losses, 0),
    playoffs: Ss.filter(s => s.playoffs).length, rings: Ss.filter(s => s.champion).length, awards: Ss.filter(s => s.award).length,
    proBowls: Ss.filter(s => s.proBowl).length, allPros: Ss.filter(s => s.allPro).length, records: Ss.reduce((a, s) => a + (s.records?.length ?? 0), 0),
    teams: [...new Set(Ss.map(s => s.team))], stats, earnings: c.earnings,
  }
}
export const LEGACY_TIERS = [[0, 'Starter'], [80, 'Star'], [170, 'Superstar'], [280, 'All-Time Great']]
export function legacyOf(c) {
  const S = sportOf(c)
  const t = careerTotals(c)
  const prod = S.legacyProd(c.pos, t.stats)
  const score = Math.round(t.seasons * 2 + t.proBowls * 6 + t.allPros * 10 + t.awards * 18 + t.rings * 20 + t.playoffs * 3 + prod + t.records * 8 + (c.legacyBonus ?? 0))
  const tier = [...LEGACY_TIERS].reverse().find(([min]) => score >= min)[1]
  const next = LEGACY_TIERS.find(([min]) => score < min)
  const list = ALL_TIME[c.pos]
  const rank = list.filter(x => x.score > score).length + 1
  return { score, tier, ranked: rank <= list.length, next: next ? { at: next[0], name: next[1] } : null, rank, of: list.length, above: list.filter(x => x.score > score).slice(-1)[0] ?? null, below: list.find(x => x.score <= score) ?? null }
}
function hofVote(c, L) {
  const r = seeded(`${c.seed}-hof`)
  const pct = clamp(Math.round(20 + (L.score - 100) * 0.55 + (r() - .5) * 8), 2, 99)
  const inn = pct >= 80
  return { in: inn, pct, ballot: inn ? (pct >= 93 ? 'First ballot' : pct >= 86 ? 'Second ballot' : 'Inducted in year 4') : L.score >= 140 ? 'Finalist, not inducted' : 'Not on the ballot' }
}
// The greats, scored from their real resumes with this same formula (seasons,
// Pro Bowls / All-Stars, All-Pro / All-NBA, MVPs, rings, playoff years, production):
// where a career lands among them
const greats = list => list.map(([name, score], i) => ({ name, score, rank: i + 1 }))
const NBA_GREATS = greats([
  ...[['LeBron James', 690], ['Michael Jordan', 544], ['Kobe Bryant', 536], ['Julius Erving', 500], ['Magic Johnson', 444], ['Stephen Curry', 413], ['Larry Bird', 405], ['Kevin Durant', 399], ['Scottie Pippen', 365], ['Jerry West', 350], ['Oscar Robertson', 348], ['Dwyane Wade', 343], ['Chris Paul', 331], ['John Stockton', 326], ['James Harden', 309], ['Russell Westbrook', 309], ['Jason Kidd', 288], ['Steve Nash', 275], ['Isiah Thomas', 264], ['Clyde Drexler', 260], ['Allen Iverson', 259], ['Ray Allen', 253], ['Kawhi Leonard', 225], ['Reggie Miller', 195], ['Luka Doncic', 141]],
  ...[['Kareem Abdul-Jabbar', 683], ['Bill Russell', 618], ['Tim Duncan', 543], ['Shaquille O\'Neal', 491], ['Wilt Chamberlain', 450], ['Karl Malone', 445], ['Dirk Nowitzki', 403], ['Hakeem Olajuwon', 400], ['Moses Malone', 397], ['Kevin Garnett', 377], ['Bob Pettit', 341], ['David Robinson', 338], ['Charles Barkley', 329], ['Giannis Antetokounmpo', 305], ['Dwight Howard', 279], ['Nikola Jokic', 273], ['Patrick Ewing', 270], ['Pau Gasol', 248], ['Dennis Rodman', 230], ['Kevin McHale', 218], ['Anthony Davis', 214], ['Dikembe Mutombo', 192], ['Chris Webber', 185], ['Joel Embiid', 179], ['Yao Ming', 149]],
].sort((x, y) => y[1] - x[1]).slice(0, 25))
export const ALL_TIME = {
  qb: greats([['Tom Brady', 574], ['Peyton Manning', 489], ['Otto Graham', 421], ['Aaron Rodgers', 392], ['Johnny Unitas', 370], ['Brett Favre', 369], ['Joe Montana', 328], ['Drew Brees', 315], ['Steve Young', 287], ['Dan Marino', 269], ['Patrick Mahomes', 263], ['John Elway', 255], ['Ben Roethlisberger', 254], ['Terry Bradshaw', 233], ['Russell Wilson', 217], ['Fran Tarkenton', 217], ['Philip Rivers', 214], ['Eli Manning', 208], ['Matt Ryan', 201], ['Kurt Warner', 195], ['Troy Aikman', 193], ['Warren Moon', 190], ['Roger Staubach', 166], ['Donovan McNabb', 147], ['Jim Kelly', 145]]),
  rb: greats([['Emmitt Smith', 300], ['Jim Brown', 294], ['Walter Payton', 269], ['Marshall Faulk', 268], ['Barry Sanders', 267], ['Marcus Allen', 234], ['Adrian Peterson', 227], ['O.J. Simpson', 206], ['LaDainian Tomlinson', 204], ['Terrell Davis', 196], ['Earl Campbell', 194], ['Eric Dickerson', 192], ['Thurman Thomas', 188], ['Jerome Bettis', 171], ['Derrick Henry', 151], ['Tony Dorsett', 150], ['Shaun Alexander', 144], ['Curtis Martin', 133], ['Frank Gore', 128], ['Edgerrin James', 124]]),
  wr: greats([['Jerry Rice', 457], ['Lance Alworth', 221], ['Marvin Harrison', 215], ['Terrell Owens', 210], ['Antonio Brown', 198], ['Randy Moss', 195], ['Cris Carter', 190], ['Michael Irvin', 188], ['Larry Fitzgerald', 187], ['Reggie Wayne', 179], ['Davante Adams', 178], ['Tim Brown', 161], ['Torry Holt', 154], ['DeAndre Hopkins', 153], ['Julio Jones', 151], ['Steve Smith Sr.', 147], ['Isaac Bruce', 144], ['Steve Largent', 143], ['Andre Johnson', 142], ['Calvin Johnson', 134]]),
  te: greats([['Travis Kelce', 266], ['Tony Gonzalez', 254], ['Rob Gronkowski', 247], ['Shannon Sharpe', 236], ['Jason Witten', 186], ['Antonio Gates', 184], ['Dave Casper', 153], ['Mike Ditka', 151], ['Jimmy Graham', 128], ['George Kittle', 119], ['Kellen Winslow', 115], ['Dallas Clark', 107], ['Ozzie Newsome', 103], ['Vernon Davis', 103], ['Greg Olsen', 96]]),
  db: greats([['Ronnie Lott', 350], ['Rod Woodson', 346], ['Herb Adderley', 314], ['Charles Woodson', 302], ['Deion Sanders', 298], ['Emlen Tunnell', 291], ['Ed Reed', 288], ['Mel Blount', 284], ['Willie Brown', 260], ['Paul Krause', 251], ['Troy Polamalu', 243], ['Ty Law', 241], ['Darrell Green', 238], ['Night Train Lane', 231], ['Champ Bailey', 226], ['Ken Houston', 219], ['Aeneas Williams', 214], ['Larry Wilson', 212], ['Brian Dawkins', 207], ['Mike Haynes', 204], ['Steve Atwater', 181], ['Darrelle Revis', 180], ['Richard Sherman', 177], ['Lem Barney', 174], ['Jalen Ramsey', 166]]),
  // basketball: one list, the 25 greatest careers at any position
  guard: NBA_GREATS,
  big: NBA_GREATS,
}

// The player comp: the real players (today's and all-time) whose grades sit
// closest to this build's, trait by trait. A player listed for several teams counts once.
const ALL_TIME_POOL = { qb: LEGENDS, rb: RB_LEGENDS, wr: WR_LEGENDS, te: TE_LEGENDS, db: DB_LEGENDS, guard: NBA_ALLTIME_GUARD_PLAYERS, big: NBA_ALLTIME_BIG_PLAYERS }
export function compsFor(c, n = 5) {
  const S = sportOf(c)
  const best = new Map()
  const consider = (p, era) => {
    if (!p?.attrs || !p.name) return
    let d = 0, k = 0
    for (const t of c.types) { const v = p.attrs[t]; if (v == null) continue; d += Math.abs((c.build[t]?.val ?? 5) - v); k++ }
    if (k < c.types.length - 1) return
    const dist = d / k
    const prev = best.get(p.name)
    if (!prev || dist < prev.dist || (dist === prev.dist && era === 'current')) best.set(p.name, { name: p.name, team: p.team, years: p.years ?? null, era, dist, attrs: p.attrs, photo: S.photo(p.name) })
  }
  for (const p of S.pool[c.pos] ?? []) consider(p, 'current')
  for (const p of ALL_TIME_POOL[c.pos] ?? []) consider(p, 'all-time')
  return [...best.values()].sort((a, b) => a.dist - b.dist).slice(0, n).map(x => ({ ...x, match: Math.max(0, Math.round(100 - x.dist * 9)) }))
}

// The card: everything a share needs
export function careerCard(c) {
  const S = sportOf(c)
  const t = careerTotals(c), L = legacyOf(c)
  const head = HEADLINE_STATS[c.pos].map(k => [STAT_LABEL[k], fmtStat(t.stats[k])])
  return { name: c.name, pos: S.isBucket ? (c.pos === 'guard' ? 'GUARD' : 'BIG') : POS_LABEL[c.pos], years: c.seasons.length ? `${c.seasons[0].season}–${c.seasons[c.seasons.length - 1].season}` : '', teams: t.teams, head, rings: t.rings, awards: t.awards, awardName: AWARD_NAME[c.pos], proBowls: t.proBowls, honorName: S.honors, allPros: t.allPros, legacy: L, hof: c.hof, draft: c.draft.pick, earnings: t.earnings, site: S.isBucket ? 'build-a-player.com/bucket' : 'build-a-player.com' }
}
