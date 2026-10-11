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
  runSimulation, runRBSimulation, runWRSimulation, runTESimulation,
  calcOVR, calcOVRRB, calcOVRWR, calcOVRTE,
  calcMVPResult, calcOPOYResult, calcWROPOYResult, calcTEOPOYResult, valToGrade, nflHeadshot, HEADSHOT_BASE,
} from '../utils/simulation'
import { runBucketSimulation, calcBucketOVR, TEAM_RATINGS as NBA_RATINGS } from '../utils/bucketSimulation'
import { TYPES, ATTR, QBS } from '../data/qbs'
import { RB_TYPES, RB_ATTR, RBS } from '../data/rbs'
import { WR_TYPES, WR_ATTR, WRS } from '../data/wrs'
import { TE_TYPES, TE_ATTR, TES } from '../data/tes'
import { OLS, OL_ATTR_WEIGHT, olOVR } from '../data/ols'
import HEADSHOTS from '../data/headshots.json'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
import { NFL_TEAMS } from '../data/nfl-teams'
import { NBA_TEAMS } from '../data/nba-teams'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs'
import { BUCKET_ATTR } from '../data/nba-attrs'

export const CAREER_V = 1
const FIRST_SEASON = 2026
export const MAX_SEASONS = 18
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const r10 = v => Math.round(v * 10) / 10
const avgAttr = p => { const v = Object.values(p.attrs || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }
const buildOf = (types, p) => Object.fromEntries(types.map(t => [t, { val: p.attrs?.[t] ?? 5 }]))
const nick = name => (name || '').split(' ').slice(-1)[0]

// ── The sports ────────────────────────────────────────────────────────────────
const NBA_EAST = new Set(['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS'])
const NFL_POS_TYPES = { qb: TYPES, rb: RB_TYPES, wr: WR_TYPES, te: TE_TYPES }
const NFL_OVR = { qb: b => calcOVR(b, TYPES), rb: b => calcOVRRB(b, RB_TYPES), wr: b => calcOVRWR(b, WR_TYPES), te: b => calcOVRTE(b, TE_TYPES) }
const NFL_AWARD = { qb: calcMVPResult, rb: calcOPOYResult, wr: calcWROPOYResult, te: calcTEOPOYResult }
const olScore = p => Object.entries(OL_ATTR_WEIGHT).reduce((s, [k, w]) => s + (p.attrs?.[k] ?? 5) * w, 0) / Object.values(OL_ATTR_WEIGHT).reduce((a, b) => a + b, 0)

export const SPORT = {
  nfl: {
    id: 'nfl', league: 'NFL', isBucket: false, screen: 'ag-screen--nfl',
    teams: NFL_TEAMS, logo: s => `/logos/${s}.png`,
    // a team as the career sees it: off / def on a 1–10 scale
    teamOf: short => { const t = NFL_TEAMS.find(x => x.short === short) ?? NFL_TEAMS[0]; return { short: t.short, name: t.name, color: t.color, color2: t.color2, off: t.off, def: t.def, conf: t.conf, div: t.div } },
    status: core => (core >= 7 ? 'Contender' : core >= 5.5 ? 'In the mix' : 'Rebuilding'),
    positions: ['qb', 'rb', 'wr', 'te'],
    label: { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE' }, posName: { qb: 'Quarterback', rb: 'Running back', wr: 'Wide receiver', te: 'Tight end' },
    types: NFL_POS_TYPES, attr: { qb: ATTR, rb: RB_ATTR, wr: WR_ATTR, te: TE_ATTR },
    pool: { qb: QBS, rb: RBS, wr: WRS, te: TES, ol: OLS },
    groups: ['qb', 'rb', 'wr', 'te', 'ol'], starters: { qb: 1, rb: 1, wr: 3, te: 1, ol: 5 }, keep: { qb: 2, rb: 2, wr: 4, te: 2, ol: 5 },
    slots: { ol: ['LT', 'LG', 'C', 'RG', 'RT'] },
    depthLabel: (pos, i) => `${({ qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE' })[pos]}${i}`,
    ovr: (pos, b) => NFL_OVR[pos]?.(b) ?? 0,
    realOvr: (pos, p) => Math.round(pos === 'ol' ? (olOVR(p.attrs) ?? 72) : (p.ovr ?? NFL_OVR[pos](buildOf(NFL_POS_TYPES[pos], p)))),
    photo: name => (HEADSHOTS[name] ? nflHeadshot(HEADSHOTS[name]) : null),
    sim: pos => ({ qb: (b, t) => runSimulation(b, TYPES, t, false), rb: (b, t) => runRBSimulation(b, RB_TYPES, t, false), wr: (b, t) => runWRSimulation(b, WR_TYPES, t, false), te: (b, t) => runTESimulation(b, TE_TYPES, t, false) })[pos],
    // what the sim plays against: the team, its offense moved by the fit and the year's events
    simTeam: (t, fit, m) => ({ ...t, off: clamp(fit.off + fit.adj + (m.off ?? 0), 1, 10), def: clamp(fit.def + (m.def ?? 0), 1, 10) }),
    // the pieces of the offense around you, graded 0–11
    fit: (ro, pos, notMe) => {
      const ol = ro.ol.slice(0, 5)
      const weapons = [...ro.wr, ...ro.te, ...ro.rb].filter(p => p.pos !== pos).filter(notMe).sort((a, b) => b.ovr - a.ovr).slice(0, 3)
      const qb = pos === 'qb' ? null : ro.qb.filter(notMe)[0] ?? null
      const olG = r10(ovrGradeVal(avgOvr(ol))), wpG = r10(ovrGradeVal(avgOvr(weapons))), qbG = qb ? r10(ovrGradeVal(qb.ovr)) : 5
      const groups = [...(pos !== 'qb' ? [{ k: 'QB', v: qbG, names: qb ? [qb.name] : [] }] : []), { k: 'O-LINE', v: olG, names: ol.map(p => p.name) }, { k: 'WEAPONS', v: wpG, names: weapons.map(p => p.name) }]
      const adj = pos === 'qb' ? (olG - 6) * 0.25 + (wpG - 6) * 0.25 : (qbG - 6) * 0.3 + (olG - 6) * 0.15
      const need = pos === 'qb' ? 11 - qbG : 11 - wpG
      return { groups, adj, need, ol: olG, weapons: wpG, qb: qbG }
    },
    fitNote: (f, pos) => (pos === 'qb'
      ? (f.ol < 4.5 ? 'A bad line hurts a quarterback: sacks, hits, hurried throws.' : f.weapons >= 8 ? 'Elite weapons make a quarterback\'s numbers.' : 'A workable line and honest weapons. The quarterback decides it.')
      : (f.qb >= 8 ? 'A real quarterback feeds his weapons: targets, yards, touchdowns.' : f.qb < 5 ? 'A weak quarterback caps a skill player. Fewer good balls.' : 'A middling quarterback. The plays have to be made after the catch.')),
    physical: { qb: ['legs', 'arm'], rb: ['speed', 'burst', 'elusiveness'], wr: ['speed', 'vertical', 'afterCatch'], te: ['speed', 'vertical', 'strength'] },
    durable: { qb: ['size', 'pocket-presence'], rb: ['strength', 'size', 'balance'], wr: ['size', 'bodyControl'], te: ['strength', 'size'] },
    ageShift: pos => (pos === 'qb' ? 2 : 0),
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
    },
    goals: {
      qb: ovr => [['passYds', 'Throw for', ovr >= 90 ? 4000 : ovr >= 82 ? 3500 : 3000, 'yards'], ['tds', 'Throw', ovr >= 90 ? 30 : ovr >= 82 ? 24 : 18, 'TDs'], ['wins', 'Win', ovr >= 90 ? 11 : ovr >= 82 ? 9 : 7, 'games']],
      rb: ovr => [['rushYds', 'Rush for', ovr >= 90 ? 1300 : ovr >= 82 ? 1000 : 750, 'yards'], ['tds', 'Score', ovr >= 90 ? 13 : ovr >= 82 ? 9 : 6, 'TDs'], ['wins', 'Win', ovr >= 90 ? 10 : 8, 'games']],
      wr: ovr => [['recYds', 'Catch', ovr >= 90 ? 1300 : ovr >= 82 ? 1000 : 750, 'yards'], ['tds', 'Score', ovr >= 90 ? 11 : ovr >= 82 ? 8 : 5, 'TDs'], ['recs', 'Make', ovr >= 90 ? 95 : ovr >= 82 ? 75 : 55, 'catches']],
      te: ovr => [['recYds', 'Catch', ovr >= 90 ? 1000 : ovr >= 82 ? 750 : 550, 'yards'], ['tds', 'Score', ovr >= 90 ? 9 : ovr >= 82 ? 6 : 4, 'TDs'], ['recs', 'Make', ovr >= 90 ? 80 : ovr >= 82 ? 60 : 45, 'catches']],
    },
    seasonStats: (pos, f) => pos === 'qb'
      ? { passYds: f.seasonPassYds, tds: f.seasonTDs, ints: f.seasonINTs, rating: f.seasonRating, rushYds: f.seasonRushYds, compPct: f.seasonCompPct }
      : pos === 'rb' ? { rushYds: f.seasonRushYds, tds: (f.seasonRushTDs ?? 0) + (f.seasonRecTDs ?? 0), recYds: f.seasonRecYds, ypc: f.seasonYPC, fumbles: f.seasonFumbles }
      : { recs: f.seasonRecs, recYds: f.seasonRecYds, tds: f.seasonRecTDs, ypr: f.seasonYPR },
    rateKeys: ['rating', 'compPct', 'ypc', 'ypr'],     // per-game rates: never summed into career totals
    averages: null,
    headline: { qb: ['passYds', 'tds', 'ints'], rb: ['rushYds', 'tds', 'recYds'], wr: ['recs', 'recYds', 'tds'], te: ['recs', 'recYds', 'tds'] },
    awardName: { qb: 'MVP', rb: 'OPOY', wr: 'OPOY', te: 'OPOY' },
    honor: 'Pro Bowl', honors: 'PRO BOWLS', first: 'All-Pro',
    // the numbers that get a player there
    proBowl: { qb: s => s.tds >= 30 || s.passYds >= 4300, rb: s => s.rushYds >= 1200 || s.tds >= 12, wr: s => s.recYds >= 1200 || s.tds >= 10, te: s => s.recYds >= 850 || s.tds >= 8 },
    allPro: { qb: s => s.tds >= 38 || (s.tds >= 34 && s.passYds >= 4600), rb: s => s.rushYds >= 1550 || (s.rushYds >= 1350 && s.tds >= 14), wr: s => s.recYds >= 1500 || (s.recYds >= 1350 && s.tds >= 12), te: s => s.recYds >= 1150 || (s.recYds >= 1000 && s.tds >= 10) },
    allProNear: { qb: s => s.tds >= 32, rb: s => s.rushYds >= 1300, wr: s => s.recYds >= 1300, te: s => s.recYds >= 950 },
    award: (c, f, s) => {
      const bar = { qb: () => (s.tds ?? 0) + (f.seasonRushTDs ?? 0) >= 36 && s.passYds >= 4400 && f.wins >= 11, rb: () => s.rushYds >= 1700 || (s.rushYds >= 1500 && s.tds >= 16), wr: () => s.recYds >= 1600 && s.tds >= 11, te: () => s.recYds >= 1300 && s.tds >= 10 }
      return !!NFL_AWARD[c.pos](f, false, c.team).userWins && bar[c.pos]()
    },
    seasonScore: (pos, s) => { const st = s.stats; return pos === 'qb' ? st.tds / 40 * .4 + st.passYds / 5000 * .3 + s.wins / 15 * .3 : pos === 'rb' ? st.rushYds / 1700 * .5 + st.tds / 18 * .3 + s.wins / 15 * .2 : st.recYds / 1600 * .5 + st.tds / 14 * .3 + s.wins / 15 * .2 },
    legacyProd: (pos, st) => (pos === 'qb' ? (st.tds ?? 0) / 10 + (st.passYds ?? 0) / 1000 : pos === 'rb' ? (st.tds ?? 0) / 4 + (st.rushYds ?? 0) / 500 : (st.tds ?? 0) / 4 + (st.recYds ?? 0) / 500),
    made: f => !!f.playoffs,
    rounds: ['Wild Card', 'Divisional', 'Conference Championship', 'Super Bowl'], final: 'Super Bowl', series: false,
    lineKeys: ['passYds', 'tds', 'ints', 'rushYds', 'rushTDs', 'recYds', 'rec', 'recTDs'],
    step: 1, gameWord: 'WEEK', snaps: 'snaps', injScale: 1, moneyWord: 'yards',
    injuries: [['hamstring strain', 2, 3], ['high ankle sprain', 3, 5], ['rib cartilage', 1, 2], ['concussion', 1, 2], ['MCL sprain', 4, 6], ['shoulder (AC joint)', 2, 4], ['turf toe', 2, 3]],
    money: { qb: [8, 58], rb: [2, 18], wr: [4, 34], te: [2, 19] },
    primeNote: pos => `Traits grow until about 25, hold through the prime, then the physical ones fade past ${pos === 'qb' ? '33' : '31'}.`,
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
      const gG = r10(ovrGradeVal(avgOvr(guards))), bG = r10(ovrGradeVal(avgOvr(bigs)))
      const bench = [...ro.guard, ...ro.big].filter(notMe).sort((a, b) => b.ovr - a.ovr).slice(5, 9)
      const benchG = r10(ovrGradeVal(avgOvr(bench)))
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
    draft: {
      rounds: 2,
      stock: ovr => (ovr >= 95 ? [1, 3] : ovr >= 90 ? [2, 8] : ovr >= 86 ? [5, 15] : ovr >= 82 ? [10, 25] : ovr >= 78 ? [18, 35] : ovr >= 74 ? [28, 48] : ovr >= 70 ? [40, 58] : [48, 60]),
      rookie: o => ({ kind: 'rookie', years: o <= 30 ? 4 : 2, left: o <= 30 ? 4 : 2, perYear: o <= 1 ? 12.5 : o <= 5 ? 9.5 : o <= 10 ? 6.5 : o <= 14 ? 5 : o <= 30 ? 2.8 : 1.9, option: o <= 30 }),
      posList: ['G', 'F', 'C', 'G/F', 'F/C', 'PG', 'SG', 'SF', 'PF', 'C'],
    },
    combine: {
      guard: [['sprint', '3/4-court sprint', 'speed'], ['lane', 'Lane agility', 'handles'], ['spot', 'Spot-up shooting', 'jumpShot']],
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
    primeNote: () => 'Traits grow until about 25, hold through the prime, then speed and bounce fade past 31.',
  },
}
export const sportOf = c => SPORT[c?.sport] ?? SPORT.nfl
// merged lookups (position keys never collide between the sports)
export const OFFENSE_POS = SPORT.nfl.positions
export const POS_LABEL = { ...SPORT.nfl.label, ...SPORT.bucket.label }
export const POS_NAME = { ...SPORT.nfl.posName, ...SPORT.bucket.posName }
export const POS_TYPES = { ...SPORT.nfl.types, ...SPORT.bucket.types }
export const POS_ATTR = { ...SPORT.nfl.attr, ...SPORT.bucket.attr }
export const AWARD_NAME = { ...SPORT.nfl.awardName, ...SPORT.bucket.awardName }
export const STARTERS = { ...SPORT.nfl.starters, ...SPORT.bucket.starters }
export const PO_ROUNDS = SPORT.nfl.rounds
export const STAT_LABEL = { passYds: 'PASS YDS', tds: 'TD', ints: 'INT', rating: 'RTG', rushYds: 'RUSH YDS', compPct: 'CMP%', recYds: 'REC YDS', ypc: 'YPC', fumbles: 'FUM', recs: 'REC', ypr: 'YPR', ppg: 'PPG', rpg: 'RPG', apg: 'APG', spg: 'SPG', bpg: 'BPG', pts: 'PTS', reb: 'REB', ast: 'AST' }
export const HEADLINE_STATS = { ...SPORT.nfl.headline, ...SPORT.bucket.headline }
export const ovrOf = (pos, build, sport = null) => (sport ? SPORT[sport] : SPORT.bucket.positions.includes(pos) ? SPORT.bucket : SPORT.nfl).ovr(pos, build) ?? 0
const sportForPos = pos => (SPORT.bucket.positions.includes(pos) ? SPORT.bucket : SPORT.nfl)
const fmtStat = v => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : (v ?? 0).toLocaleString())

// ── Save ──────────────────────────────────────────────────────────────────────
const key = (sport, uid) => `bap_career_${sport}_${uid || 'guest'}`
const histKey = sport => `bap_career_hist_${sport}`
const validCareer = c => !!(c && c.v === CAREER_V && c.pos)
export function loadCareer(sport, uid) {
  try { const c = JSON.parse(localStorage.getItem(key(sport, uid))); return validCareer(c) ? c : null } catch { return null }
}
// Every save stamps `updatedAt` (local and cloud copies are merged by it) and,
// for a signed-in player, queues the cloud copy (lib/careerCloud.js). A save
// that changes nothing (a screen re-saving what it loaded) keeps the old stamp,
// so an untouched copy never looks newer than real progress on another device.
const sameCareer = (a, b) => { try { return JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 }) } catch { return false } }
export function saveCareer(c) {
  if (!c) return
  try {
    const prev = loadCareer(c.sport, c.uid)
    if (prev && prev.updatedAt && sameCareer(prev, c)) return
    const s = { ...c, updatedAt: Date.now() }
    localStorage.setItem(key(c.sport, c.uid), JSON.stringify(s))
    queueCloudSave(s)
  } catch {}
}
export function clearCareer(sport, uid) { try { localStorage.removeItem(key(sport, uid)) } catch {}; deleteCloudCareer(sport, uid) }
// Signed in: pull the account's cloud copy and keep whichever is newer (by
// `updatedAt`). A guest career moves onto the account on first sign-in when
// the account has none. Offline / any failure: the local copy stands.
export async function syncCareerFromCloud(sport, uid) {
  if (!uid) return loadCareer(sport, uid)
  const cloud = await fetchCloudCareer(sport, uid)
  const local = loadCareer(sport, uid)   // read after the fetch: it may have moved on meanwhile
  if (cloud === undefined) return local
  const good = validCareer(cloud) && cloud.sport === sport ? { ...cloud, uid } : null
  if (good && (!local || (good.updatedAt || 0) > (local.updatedAt || 0))) {
    try { localStorage.setItem(key(sport, uid), JSON.stringify(good)) } catch {}
    return good
  }
  if (local) {
    if (!good || (local.updatedAt || 0) > (good.updatedAt || 0)) queueCloudSave(local.updatedAt ? local : { ...local, updatedAt: Date.now() })
    return local
  }
  if (cloud === null) {   // the account has no career anywhere: bring the guest one over
    const guest = loadCareer(sport, null)
    if (guest) {
      const moved = { ...guest, uid, updatedAt: Date.now() }
      try { localStorage.setItem(key(sport, uid), JSON.stringify(moved)); localStorage.removeItem(key(sport, null)) } catch {}
      queueCloudSave(moved)
      return moved
    }
  }
  return null
}
export function pastCareers(sport) { try { const l = JSON.parse(localStorage.getItem(histKey(sport)) || '[]'); return Array.isArray(l) ? l : [] } catch { return [] } }
export function logCareer(c) {
  if (!c || c.logged) return c
  const L = legacyOf(c), t = careerTotals(c)
  const entry = { at: Date.now(), pos: c.pos, name: c.name, seasons: c.seasons.length, score: L.score, tier: L.tier, rank: L.rank, ranked: L.ranked, hof: c.hof?.in ?? false, rings: t.rings, awards: t.awards, team: c.team }
  try { localStorage.setItem(histKey(c.sport), JSON.stringify([entry, ...pastCareers(c.sport)].slice(0, 20))) } catch {}
  return { ...c, logged: true }
}

// ── Teams: the real roster around you, and how it moves year to year ─────────
// OVR → the 0–11 grade scale (F … S) the rest of the game uses
export const ovrGradeVal = ovr => clamp((ovr - 60) / 3.5, 0, 11)
export const gradeOfOvr = ovr => valToGrade(ovrGradeVal(ovr))
export const gradeOf = v => valToGrade(clamp(v, 0, 11))
const hashN = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) }
const man = (S, pos, p) => ({ name: p.name, pos, ovr: S.realOvr(pos, p), age: 23 + (hashN(p.name) % 9), photo: S.photo(p.name), slot: p.pos ?? null, from: p.team })
const byOvr = (a, b) => b.ovr - a.ovr
const avgOvr = list => (list.length ? list.reduce((s, p) => s + p.ovr, 0) / list.length : 72)
// A team's real roster (the depth the lineup needs, the five starting linemen in football)
export function makeRoster(short, sport = 'nfl') {
  const S = SPORT[sport] ?? SPORT.nfl
  const ro = { team: short, sport }
  for (const g of S.groups) {
    const list = S.pool[g].filter(p => p.team === short).map(p => man(S, g, p))
    const slots = S.slots[g]
    ro[g] = slots ? slots.map(s => list.find(p => p.slot === s)).filter(Boolean).concat(list.filter(p => !slots.includes(p.slot))).slice(0, S.keep[g]) : list.sort(byOvr).slice(0, S.keep[g])
  }
  return ro
}
const rosterFor = (c, short = c.team) => (c.roster?.team === short ? c.roster : makeRoster(short, c.sport))
// Where you stand at your spot: the group best-first with you in it. Last
// year's starter keeps the job in a tie (+2), a starter guarantee keeps it.
export function depthChart(c, roster = c.roster ?? (c.team ? makeRoster(c.team, c.sport) : null)) {
  const S = sportOf(c)
  const group = (roster?.[c.pos] ?? []).filter(p => p.name !== c.name)
  const me = { name: c.name, pos: c.pos, ovr: c.ovr, age: c.age, you: true }
  const edge = p => p.ovr + (p.you ? (c.contract?.starter ? 99 : c.lastRole === 'Starter' ? 2 : 0) : 0)
  const all = [...group, me].sort((a, b) => edge(b) - edge(a))
  const idx = all.findIndex(p => p.you)
  return { all, idx, starter: idx < S.starters[c.pos], ahead: all.slice(0, idx), label: S.depthLabel(c.pos, idx + 1) }
}
// The starters, you in your spot if you've won it
export function lineup(c, roster = c.roster ?? (c.team ? makeRoster(c.team, c.sport) : null)) {
  const S = sportOf(c)
  const dc = depthChart(c, roster)
  const out = {}
  for (const g of S.groups) out[g] = g === c.pos ? dc.all.slice(0, S.starters[g]) : (roster?.[g] ?? []).slice(0, S.starters[g])
  return { ...out, bench: dc.all.slice(S.starters[c.pos]), depth: dc }
}
// Grades (0–11) for the pieces of the team around you, from the roster you'd play with
export function teamFit(short, pos, { roster = null, league = null, name = null, sport = 'nfl' } = {}) {
  const S = SPORT[sport] ?? SPORT.nfl
  const t = S.teamOf(short)
  const ro = roster?.team === short ? roster : makeRoster(short, sport)
  const f = S.fit(ro, pos, p => p.name !== name)
  const drift = league?.[short] ?? { off: 0, def: 0 }
  const off = clamp(r10(t.off + drift.off), 1, 10), def = clamp(r10(t.def + drift.def), 1, 10)
  return {
    short, name: t.name, color: t.color, color2: t.color2, off, def, conf: t.conf, div: t.div, status: S.status((off + def) / 2),
    ...f, adj: clamp(Math.round(f.adj * 2) / 2, -1.5, 1.5),
  }
}
const fitFor = (c, short = c.team) => teamFit(short, c.pos, { roster: c.roster, league: c.league, name: c.name, sport: c.sport })
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
      if (p.age >= 35 || (p.age >= 33 && r() < 0.35)) { moves.push({ kind: 'retire', pos: g, text: `${p.name} retires after ${p.age - 22} seasons.`, p }); continue }
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
        const pool = S.pool[g].filter(p => p.team !== ro.team && !taken.has(p.name) && (!need || p.pos === need))
        const pick = pool[Math.floor(r() * pool.length)]
        if (pick) {
          const p = { ...man(S, g, pick), slot: need ?? pick.pos ?? null }
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
// The combine: three quick drills (components/app/MiniGame.jsx). The number
// comes from the trait and how the drill went: a great run takes the top of the
// trait's range, a bad one the bottom. pct is where it lands for the scouts.
export const COMBINE_DRILLS = { ...SPORT.nfl.combine, ...SPORT.bucket.combine }
const drillValue = (id, v, score) => {
  const n = (v - 5) / 6 + (score - 0.5) * 0.5          // the trait, moved by the drill
  switch (id) {
    case 'forty': return { text: `${(4.85 - n * .42).toFixed(2)}s`, pct: n }
    case 'velo': return { text: `${Math.round(52 + n * 9)} mph`, pct: n }
    case 'acc': return { text: `${Math.round(62 + n * 30)}% on target`, pct: n }
    case 'cone': return { text: `${(7.15 - n * .5).toFixed(2)}s`, pct: n }
    case 'bench': return { text: `${Math.round(17 + n * 9)} reps`, pct: n }
    case 'gauntlet': return { text: `${Math.round(78 + n * 20)}% caught`, pct: n }
    case 'sprint': return { text: `${(3.45 - n * .32).toFixed(2)}s`, pct: n }
    case 'lane': return { text: `${(11.7 - n * 1.0).toFixed(2)}s`, pct: n }
    case 'spot': return { text: `${Math.round(58 + n * 30)}% from three`, pct: n }
    case 'vert': return { text: `${Math.round(31 + n * 11)}" vertical`, pct: n }
    case 'nbench': return { text: `${Math.round(9 + n * 9)} reps`, pct: n }
    default: return { text: '—', pct: 0 }
  }
}
export function recordCombine(c, id, score) {
  const combine = c.draft.combine.map(d => (d.id === id ? { ...d, score, ...drillValue(id, c.build[d.trait]?.val ?? 5, score) } : d))
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
  const shift = Math.round(-comb * span - inter * (S.isBucket ? 0.4 : 1))
  const lo = clamp(lo0 + shift, 1, maxPick(S)), hi = clamp(hi0 + shift, lo, maxPick(S))
  return { lo, hi, loP: pickLabel(lo, c.sport), hiP: pickLabel(hi, c.sport), shift }
}
// The order: worst teams first, with some noise
function draftOrder(c) {
  const S = sportOf(c)
  const r = seeded(`draft-${c.seed}`)
  return S.teams.map(t => S.teamOf(t.short)).sort((a, b) => (a.off + a.def + r() * 3) - (b.off + b.def + r() * 3)).map(t => t.short)
}
// After the combine: four teams from around your projected slot sit you down
export function setupInterviews(c) {
  const S = sportOf(c)
  const r = seeded(`int-${c.seed}`)
  const order = draftOrder(c), N = order.length
  const { lo, hi } = stockOf(c)
  const near = []
  for (let o = Math.max(1, lo - 6); o <= Math.min(maxPick(S), hi + 6) && near.length < N; o++) { const t = order[(o - 1) % N]; if (!near.includes(t)) near.push(t) }
  const teams = near.sort(() => r() - 0.5).slice(0, 4)
  const qs = [...(INTERVIEWS[c.sport] ?? INTERVIEWS.nfl)].sort(() => r() - 0.5).slice(0, teams.length)
  return { ...c, draft: { ...c.draft, interviews: qs.map((q, i) => ({ ...q, team: teams[i], answer: null })) } }
}
export function newCareer({ sport = 'nfl', uid = null, pos, build, name = 'Guest' }) {
  const S = SPORT[sport] ?? SPORT.nfl
  const seed = Math.random().toString(36).slice(2, 10)
  const r = seeded(`career-${seed}`)
  const types = S.types[pos]
  const ovr = S.ovr(pos, build)
  const drills = S.combine[pos].map(([id, label, trait]) => ({ id, label, trait, score: null, text: null, pct: null }))
  const dur = S.durable[pos].reduce((s, t) => s + (build[t]?.val ?? 5), 0) / S.durable[pos].length
  return {
    v: CAREER_V, sport, uid, seed, pos, types, name, build, base: build, ovr,
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
  return { ...c, phase: 'draft', step: 'day', draft: { ...c.draft, picks, pick: picks[picks.length - 1] }, team: mine.team, roster, fit, contract, decisions: [...c.decisions, { year: 1, text: `Drafted ${lbl.round === 1 ? `No. ${mine.o} overall` : `in round ${lbl.round}`} by the ${fit.name}${met ? ' (they interviewed you)' : ''}` }] }
}

// ── Goals for a season ───────────────────────────────────────────────────────
export const goalsFor = c => sportOf(c).goals[c.pos](c.ovr).map(([k, verb, n, unit]) => ({ k, label: `${verb} ${n.toLocaleString()} ${unit}`, n }))
const goalMet = (g, s) => (s.stats[g.k] ?? (g.k === 'wins' ? s.wins : 0)) >= g.n

// ── The season: the director plays it, we steer and keep score ───────────────
export const seasonStats = (pos, f) => sportForPos(pos).seasonStats(pos, f)
const director = (c, team, base, seed) => createDirector({ sport: c.sport, pos: c.pos, build: c.build, team, simFn: sportOf(c).sim(c.pos), base, seed, name: c.name, attrMap: POS_ATTR[c.pos], types: c.types, always: true })
export function startSeason(c) {
  const S = sportOf(c)
  const roster = c.roster ?? makeRoster(c.team, c.sport)
  const cc = { ...c, roster }
  const fit = fitFor(cc)
  const dc = depthChart(cc)
  const team = simTeam({ ...cc, benchRole: !dc.starter }, fit)
  const base = S.sim(c.pos)(c.build, team)
  const seed = `${c.seed}-y${c.year + 1}`
  const D = director(cc, team, base, seed)
  // not the starter. Basketball: off the bench all year, a smaller role.
  // Football: the season opens on the bench, until the job comes your way.
  let benched = null
  if (!dc.starter && S.isBucket) {
    benched = { weeks: D.total, behind: dc.ahead[dc.ahead.length - 1].name, label: dc.label, bench: true }
  } else if (!dc.starter) {
    const rr = seeded(`${c.seed}-bench-${c.year}`)
    const ahead = dc.ahead[dc.ahead.length - 1]
    const gap = ahead.ovr - c.ovr
    const T = D.total
    const frac = gap <= 2 ? 0.18 + rr() * 0.22 : gap <= 6 ? (rr() < 0.5 ? 0.4 + rr() * 0.35 : 1) : (rr() < 0.45 ? 0.35 + rr() * 0.45 : 1)
    const weeks = Math.max(1, Math.min(T, Math.round(frac * T)))
    D.sidelined(0, weeks)
    benched = { weeks, behind: ahead.name, label: dc.label }
  }
  const feed = benched ? [{ k: 0, note: benched.bench ? `${benched.behind} starts. ${c.name} comes off the bench this season: fewer minutes, a smaller role.` : `${benched.behind} is the starter. ${c.name} opens the season as ${benched.label}.`, noteKind: benched.bench ? 'ROTATION' : 'DEPTH CHART' }] : []
  const next = { ...cc, phase: 'season', fit, role: dc.starter ? 'Starter' : 'Backup', simTeam: team, goals: goalsFor(c), active: { k: 0, base, snap: D.snapshot(), seed, moment: null, feed, injury: null, benched } }
  return [next, D]
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
    if (a.benched && a.benched.weeks < D.total && k === a.benched.weeks + 1) feed.push({ k, note: `${c.name} is named the starter. ${a.benched.behind} goes to the bench.`, noteKind: 'DEPTH CHART' })
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
    const stop = D.stops.find(s => s.at === k || (s.kind === 'playoffs' && k === D.total && s.at === D.total))
    if (stop) moment = D.open(stop)
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
  return [withSnap(c, D, { moment: null, feed }), outcome]
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
  const injuries = [...c.injuries, { year: c.year + 1, at, kind: inj.kind, games: inj.games, played: !!play }]
  const feed = [...c.active.feed, { k: at, injuryText: text }]
  return [withSnap({ ...c, injuries, durability: r10(Math.max(1, c.durability - 0.4)) }, D, { injury: null, feed }), text]
}
// The regular season's over: book it, or go into the playoffs (a bracket of
// our own, one skill moment a round, played on the hub)
export function finishRegular(c, D) {
  const f = D.finalize()
  if (!sportOf(c).made(f)) return bookSeason({ ...c, active: { ...c.active, final: f, po: null } })
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
    line = { pts: r10(st.ppg * k * (won ? 1.05 : 0.9)), reb: r10(st.rpg * k), ast: r10(st.apg * k), perGame: true }
  } else {
    const g = f.wins + f.losses || 17
    const n = (sum, mult = 1) => Math.max(0, Math.round(((sum ?? 0) / g) * k * mult))
    mySc = Math.round(17 + (c.simTeam?.off ?? 5) * 1.2 + score * 8 + r() * 6); oppSc = won ? Math.max(3, mySc - 3 - Math.floor(r() * 14)) : mySc + 1 + Math.floor(r() * 12)
    line = c.pos === 'qb' ? { passYds: n(f.seasonPassYds), tds: n(f.seasonTDs, won ? 1.1 : 0.8), ints: Math.round((1 - score) * 2 * r()), rushYds: n(f.seasonRushYds) }
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
  const rounds = (po?.line ?? []).map(x => ({ round: x.name, opponent: x.oppName, won: x.won, mySc: x.mySc, oppSc: x.oppSc, series: !!x.series }))
  const fin = rounds.find(x => x.round === S.final)
  const s = {
    year: c.year + 1, season: c.season, age: c.age, team: c.team, teamName: c.fit.name, ovr: c.ovr, role: c.role,
    wins: f.wins, losses: f.losses, playoffs: S.made(f), champion: !!po?.won, rounds, sb: fin ? { won: fin.won, mySc: fin.mySc, oppSc: fin.oppSc, series: fin.series } : null,
    stats, award, awardName: S.awardName[c.pos], proBowl: S.proBowl[c.pos](stats) || award || allPro, allPro: allPro || (award && S.allProNear[c.pos](stats)),
    missed, benched, records: (f.story?.records ?? []).map(x => x.label ?? x.id), milestones: (f.story?.milestones ?? []).filter(m => m.big).map(m => m.label),
    goals: c.goals.map(g => ({ ...g, met: goalMet(g, { stats, wins: f.wins }) })), xp: f.story?.xp ?? 0, bestGame: f.bestGame ?? null,
    poStats: po ? po.line.reduce((acc, x) => { for (const k of S.lineKeys) if (x[k] != null) acc[k] = (acc[k] ?? 0) + x[k]; return acc }, { games: po.line.length }) : null,
  }
  const contract = { ...c.contract, left: c.contract.left - 1 }
  const perf = seasonScore(c.pos, s)
  // a development point a year; a second for an award or All-Pro / All-NBA season
  const dev = { ...c.dev, points: c.dev.points + 1 + (s.award || s.allPro ? 1 : 0) }
  const rep = clamp(c.rep + (s.goals.filter(g => g.met).length >= 2 ? 1 : 0) + (s.champion ? 1 : 0) - (perf < 0.25 ? 1 : 0), 1, 10)
  const lastRole = benched < (f.wins + f.losses || 17) / 2 ? 'Starter' : 'Backup'
  let next = { ...c, phase: 'offseason', seasons: [...c.seasons, s], contract, dev, rep, lastRole, active: null, simTeam: null, goals: [], earnings: r10(c.earnings + c.contract.perYear), nextMods: null, talks: null }
  // the offseason: the league moves, your team's roster turns over, the news
  const r = seeded(`${c.seed}-off-${c.year}`)
  const league = driftLeague(next, r)
  const { roster, moves } = rosterMoves(next, r)
  next = { ...next, league, roster }
  const news = leagueNews(c, league)
  next = offseasonEvents(next)
  next = maybeTraded(next, r)
  const offers = contractSituation(next)
  next = { ...next, fit: fitFor(next), offers, off: { step: 'recap', moves: next.traded ? [] : moves, news, camp: null, contract: Array.isArray(offers) } }
  return next
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
  const fits = S.teams.filter(t => t.short !== c.team).map(t => ({ t, ro: makeRoster(t.short, c.sport) }))
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
export const OFF_STEPS = [['recap', 'RECAP'], ['moves', 'MOVES'], ['camp', 'CAMP'], ['contract', 'CONTRACT']]
export const offStep = (c, step) => ({ ...c, off: { ...(c.off ?? {}), step } })
// Training camp: one drill; win it for a bonus development point
export function campDrill(c, score, game) {
  const bonus = score >= 0.6 ? 1 : 0
  return { ...c, dev: { ...c.dev, points: c.dev.points + bonus }, off: { ...c.off, camp: { score, bonus, game } } }
}
const traitName = (c, t) => POS_ATTR[c.pos][t]?.label ?? t
export function spendDev(c, type) {
  if (c.dev.points <= 0 || !c.build[type] || c.build[type].val >= 11) return c
  const from = c.build[type].val
  const build = { ...c.build, [type]: { ...c.build[type], val: from + 1, upgraded: (c.build[type].upgraded ?? 0) + 1 } }
  return { ...c, build, ovr: ovrOf(c.pos, build, c.sport), dev: { points: c.dev.points - 1, spent: c.dev.spent + 1 }, decisions: [...c.decisions, { year: c.year + 1, text: `Offseason work: ${traitName(c, type)} ${valToGrade(from)} → ${valToGrade(from + 1)}` }] }
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
    { id: 'quiet', w: 3, text: () => `A quiet summer at the facility. Camp opens, and the grind begins.`, apply: () => ({}) },
  ],
}
function offseasonEvents(c) {
  const S = sportOf(c)
  const r = seeded(`${c.seed}-ev-${c.year}`)
  const fits = (EVENTS[c.sport] ?? EVENTS.nfl).filter(e => !e.when || e.when(c))
  const total = fits.reduce((s, e) => s + e.w, 0)
  let roll = r() * total, ev = fits[0]
  for (const e of fits) { roll -= e.w; if (roll <= 0) { ev = e; break } }
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
  return r10(lo + (hi - lo) * clamp(perf, 0, 1) * ageCut)
}
// Contract's up: the team's offer and two from the market; none at all when
// nobody's calling (that's the end of the road)
function contractSituation(c) {
  const S = sportOf(c)
  if (c.contract.left > 0) return null
  const r = seeded(`${c.seed}-fa-${c.year}`)
  const value = marketValue(c)
  const last = c.seasons[c.seasons.length - 1]
  const perf = seasonScore(c.pos, last)
  if (c.age >= 34 && perf < 0.35) return []
  const years = c.age >= 32 ? 1 + Math.floor(r() * 2) : c.age >= 29 ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3)
  const fitAt = short => teamFit(short, c.pos, { roster: c.roster, league: c.league, name: c.name, sport: c.sport })
  const others = S.teams.filter(t => t.short !== c.team).sort(() => r() - .5).map(t => fitAt(t.short))
  const good = 7, bad = 6
  const contender = others.find(f => (f.off + f.def) / 2 >= good) ?? others[0]
  const payer = others.find(f => f.short !== contender.short && (f.off + f.def) / 2 < bad) ?? others[1]
  // where you'd stand on each team's depth chart
  const standAt = short => { const dc = depthChart({ ...c, contract: {}, lastRole: short === c.team ? c.lastRole : null }, short === c.team ? c.roster : makeRoster(short, c.sport)); return { starter: dc.starter, behind: dc.ahead[dc.ahead.length - 1]?.name ?? null, label: dc.label } }
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
  const roster = change ? makeRoster(o.team, c.sport) : c.roster
  return {
    ...c, team: o.team, roster, fit: teamFit(o.team, c.pos, { roster, league: c.league, name: c.name, sport: c.sport }), offers: null, talks: null, tradeAsked: false, lastRole: change ? null : c.lastRole,
    contract: { kind: change ? 'fa' : 'ext', years: o.years, left: o.years, perYear: o.perYear, noTrade: !!o.noTrade, starter: !!o.starter },
    decisions: [...c.decisions, { year: c.year + 1, text: `${change ? 'Signed with' : 'Re-signed with'} the ${o.fit.name}: ${o.years} yrs, $${o.perYear}M a year${extras.length ? ` (${extras.join(', ')})` : ''}` }],
  }
}
// ── Talks: sit down with one team and push. Leverage (the last two seasons,
// reputation, age) is how far they'll bend before they walk. ──
export const ASKS = {
  money:   { label: 'MORE MONEY', sub: '+8% a year', cost: 1 },
  years:   { label: 'ANOTHER YEAR', sub: '+1 year, same money', cost: 1 },
  notrade: { label: 'NO-TRADE CLAUSE', sub: 'They can\'t move you', cost: 2 },
  starter: { label: 'STARTER GUARANTEE', sub: 'The job is yours in writing', cost: 1 },
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
  const patience = t.patience - a.cost
  if (patience < 0) {
    // they're done: the offer's gone
    const offers = (c.offers ?? []).filter(o => o.team !== t.team)
    const fallback = offers.length ? offers : [{ ...t, perYear: r10(t.base * 0.85), years: Math.max(1, t.years - 1), kind: 'late', pitch: 'Late in free agency. The market moved on; this is what\'s left.', noTrade: false, starter: false }]
    return { ...c, offers: fallback, talks: { ...t, walked: true, patience: 0, lines: [...t.lines, 'The GM closes the folder. "We\'re done here."'] }, events: [...c.events, { year: c.year + 1, text: `Talks with the ${t.fit.name} collapsed over a ${a.label.toLowerCase()}.` }] }
  }
  const pushed = kind === 'money' ? r10(t.perYear * 1.08) : t.perYear
  const years = kind === 'years' ? t.years + 1 : t.years
  const tone = patience >= 2 ? 'A nod. "We can do that."' : patience === 1 ? '"…Fine. But that\'s about it."' : 'A long pause. "Last one."'
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
  if (!granted) return { ...c, rep, tradeAsked: true, nextMods: { ...(c.nextMods ?? {}), off: ((c.nextMods?.off) ?? 0) - 0.5 }, events: [...c.events, { year: c.year + 1, text: 'You asked for a trade. The team said no, and the locker room heard about it.' }] }
  const dest = S.teams.map(t => S.teamOf(t.short)).filter(t => t.short !== c.team).sort(() => r() - .5).sort((a, b) => (b.off + b.def) - (a.off + a.def))[Math.floor(r() * 6)]
  const roster = makeRoster(dest.short, c.sport)
  const fit = teamFit(dest.short, c.pos, { roster, league: c.league, name: c.name, sport: c.sport })
  return { ...c, rep, tradeAsked: true, team: dest.short, roster, fit, lastRole: null, events: [...c.events, { year: c.year + 1, text: `Trade request granted: a ${nick(fit.name)} now.` }], decisions: [...c.decisions, { year: c.year + 1, text: `Demanded a trade, dealt to the ${fit.name}` }] }
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
    const ch = build[t]; if (!ch || ch.val + d > 11 || ch.val + d < 1) return
    build[t] = { ...ch, val: ch.val + d, ...(d > 0 ? { grew: (ch.grew ?? 0) + 1 } : { faded: (ch.faded ?? 0) + 1 }) }
    notes.push(`${why}: ${traitName(c, t)} ${valToGrade(ch.val)} → ${valToGrade(ch.val + d)}`)
  }
  const shift = S.ageShift(c.pos)
  if (age <= 24 && r() < 0.45) move(c.types[Math.floor(r() * c.types.length)], 1, 'Still growing')
  else if (age <= 28 && r() < 0.2) move(c.types[Math.floor(r() * c.types.length)], 1, 'A step forward')
  if (age >= 31 + shift) {
    const phys = S.physical[c.pos]
    const p = age >= 35 + shift ? 1 : age >= 33 + shift ? 0.8 : 0.5
    if (r() < p) move(phys[Math.floor(r() * phys.length)], -1, 'Father Time')
    if (age >= 35 + shift && r() < 0.4) move(phys[Math.floor(r() * phys.length)], -1, 'Father Time')
  }
  const ovr = ovrOf(c.pos, build, c.sport)
  const n = { ...c, age, year: c.year + 1, season: c.season + 1, build, ovr, phase: 'preseason', offers: null, aging: notes, off: null, traded: false }
  return { ...n, fit: fitFor(n) }
}
export const canRetire = c => c.age >= 29 || c.seasons.length >= 8
export const mustRetire = c => c.age >= 40 || c.seasons.length >= MAX_SEASONS || (Array.isArray(c.offers) && c.offers.length === 0)
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
  const score = Math.round(t.seasons * 2 + t.proBowls * 6 + t.allPros * 10 + t.awards * 18 + t.rings * 20 + t.playoffs * 3 + prod + t.records * 8)
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
// The greats, by this same score: where a career lands among them
const greats = list => list.map(([name, score], i) => ({ name, score, rank: i + 1 }))
export const ALL_TIME = {
  qb: greats([['Tom Brady', 430], ['Peyton Manning', 382], ['Joe Montana', 352], ['Patrick Mahomes', 344], ['Drew Brees', 318], ['Aaron Rodgers', 312], ['Dan Marino', 296], ['John Elway', 292], ['Brett Favre', 288], ['Johnny Unitas', 276], ['Steve Young', 254], ['Otto Graham', 248], ['Roger Staubach', 232], ['Terry Bradshaw', 224], ['Troy Aikman', 206], ['Ben Roethlisberger', 202], ['Philip Rivers', 184], ['Kurt Warner', 176], ['Jim Kelly', 170], ['Eli Manning', 160], ['Matt Ryan', 152], ['Russell Wilson', 150], ['Warren Moon', 146], ['Fran Tarkenton', 142], ['Donovan McNabb', 126]]),
  rb: greats([['Jim Brown', 400], ['Walter Payton', 372], ['Barry Sanders', 350], ['Emmitt Smith', 346], ['LaDainian Tomlinson', 318], ['Eric Dickerson', 284], ['Adrian Peterson', 282], ['Marshall Faulk', 270], ['Earl Campbell', 236], ['O.J. Simpson', 230], ['Terrell Davis', 212], ['Curtis Martin', 202], ['Marcus Allen', 200], ['Thurman Thomas', 192], ['Derrick Henry', 190], ['Tony Dorsett', 184], ['Frank Gore', 176], ['Jerome Bettis', 160], ['Edgerrin James', 154], ['Shaun Alexander', 140]]),
  wr: greats([['Jerry Rice', 440], ['Randy Moss', 330], ['Larry Fitzgerald', 300], ['Terrell Owens', 296], ['Calvin Johnson', 262], ['Marvin Harrison', 258], ['Cris Carter', 236], ['Steve Largent', 222], ['Julio Jones', 214], ['Michael Irvin', 206], ['Antonio Brown', 200], ['Tim Brown', 196], ['Lance Alworth', 190], ['Andre Johnson', 176], ['Reggie Wayne', 170], ['Davante Adams', 168], ['Isaac Bruce', 162], ['Torry Holt', 156], ['Steve Smith Sr.', 150], ['DeAndre Hopkins', 140]]),
  te: greats([['Rob Gronkowski', 330], ['Tony Gonzalez', 320], ['Travis Kelce', 316], ['Antonio Gates', 262], ['Shannon Sharpe', 240], ['Jason Witten', 228], ['Kellen Winslow', 196], ['Mike Ditka', 190], ['Ozzie Newsome', 176], ['Dave Casper', 160], ['Jimmy Graham', 150], ['George Kittle', 148], ['Greg Olsen', 130], ['Dallas Clark', 110], ['Vernon Davis', 104]]),
  guard: greats([['Michael Jordan', 440], ['LeBron James', 436], ['Magic Johnson', 380], ['Kobe Bryant', 372], ['Stephen Curry', 350], ['Larry Bird', 344], ['Oscar Robertson', 320], ['Jerry West', 300], ['Kevin Durant', 296], ['Dwyane Wade', 270], ['Allen Iverson', 250], ['Isiah Thomas', 244], ['John Stockton', 240], ['Steve Nash', 232], ['James Harden', 228], ['Julius Erving', 226], ['Scottie Pippen', 220], ['Luka Doncic', 200], ['Chris Paul', 198], ['Russell Westbrook', 190], ['Kawhi Leonard', 188], ['Clyde Drexler', 180], ['Jason Kidd', 176], ['Reggie Miller', 160], ['Ray Allen', 156]]),
  big: greats([['Kareem Abdul-Jabbar', 440], ['Bill Russell', 420], ['Wilt Chamberlain', 410], ['Shaquille O\'Neal', 380], ['Tim Duncan', 376], ['Hakeem Olajuwon', 350], ['Nikola Jokic', 330], ['Moses Malone', 320], ['Kevin Garnett', 300], ['Dirk Nowitzki', 296], ['Karl Malone', 290], ['Giannis Antetokounmpo', 286], ['Charles Barkley', 270], ['David Robinson', 262], ['Patrick Ewing', 236], ['Anthony Davis', 210], ['Dennis Rodman', 200], ['Joel Embiid', 196], ['Kevin McHale', 190], ['Dwight Howard', 184], ['Bob Pettit', 180], ['Pau Gasol', 170], ['Chris Webber', 150], ['Yao Ming', 140], ['Dikembe Mutombo', 136]]),
}

// The card: everything a share needs
export function careerCard(c) {
  const S = sportOf(c)
  const t = careerTotals(c), L = legacyOf(c)
  const head = HEADLINE_STATS[c.pos].map(k => [STAT_LABEL[k], fmtStat(t.stats[k])])
  return { name: c.name, pos: S.isBucket ? (c.pos === 'guard' ? 'GUARD' : 'BIG') : POS_LABEL[c.pos], years: c.seasons.length ? `${c.seasons[0].season}–${c.seasons[c.seasons.length - 1].season}` : '', teams: t.teams, head, rings: t.rings, awards: t.awards, awardName: AWARD_NAME[c.pos], proBowls: t.proBowls, honorName: S.honors, allPros: t.allPros, legacy: L, hof: c.hof, draft: c.draft.pick, earnings: t.earnings, site: S.isBucket ? 'build-a-player.com/bucket' : 'build-a-player.com' }
}
