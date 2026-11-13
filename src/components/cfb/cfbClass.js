// College Football: class years, shared by the one-off mode (CFBMode.jsx) and Career's Start in College
// (CareerCollege.jsx). A player starts as a freshman, sophomore, junior or senior and plays from that class to the
// draft: a freshman up to four seasons, a senior one. After a freshman or sophomore season the only way on is the
// next season; after his junior season he can enter the NFL Draft or come back; after his senior season he's out
// of eligibility. Each season played earns upgrade points (upgradePoints: one to three, by the season he had),
// spent on his traits before the next one (CFBOffseason.jsx, by Career's own upgrade rules).
// Also here: a season as the backup (an underclassman who signs where the starter grades out better sits behind him).
import { seeded } from '../../lib/rng'

export const CLASSES = ['FR', 'SO', 'JR', 'SR']
export const CLASS_NAME = { FR: 'Freshman', SO: 'Sophomore', JR: 'Junior', SR: 'Senior' }
// his class in season k (0 = his first) of a run that started at class index `start`
export const classAt = (start, k = 0) => CLASSES[Math.max(0, Math.min(3, (start ?? 0) + k))]
export const classIdx = cls => Math.max(0, CLASSES.indexOf(String(cls ?? 'FR').toUpperCase()))
export const seasonsFrom = start => 4 - Math.max(0, Math.min(3, start ?? 0))   // how many seasons a run from that class can last
export const canDeclare = cls => cls === 'JR' || cls === 'SR'    // draft-eligible after his junior season
export const canComeBack = cls => cls !== 'SR'                   // a senior is out of eligibility
export const isUnder = cls => cls === 'FR' || cls === 'SO'       // an underclassman: he has to beat the starter to play
// how old he is: a freshman plays at 18; on draft day a junior is 21 and a senior 22
export const classAge = cls => 18 + classIdx(cls)
export const draftAge = cls => 19 + classIdx(cls)

// ── Upgrade points: what a season earns (1 to 3) ─────────────────────────────
// 3: national honors. He won the Heisman or was a finalist, made an All-America team (first or second), or won his
//    position's national award (Davey O'Brien, Doak Walker, Biletnikoff, Mackey), the Maxwell, the Walter Camp or his
//    conference's Player of the Year.
// 2: a starter's good year. He hit his position's mark (a quarterback 3,500 passing yards or 32 touchdowns passing
//    and rushing, a running back 1,200 rushing yards or 14 touchdowns, a receiver 1,000 receiving yards or 10
//    touchdowns, a tight end 650 receiving yards or 7 touchdowns), or his team won ten games, its conference or a Playoff spot.
// 1: any other season, a year as the backup included.
// r: a season's result (cfbSimulation runCFBSimulation, or a backup year: asBackup below)
const HONORS = ['daveyOBrien', 'doakWalker', 'biletnikoff', 'mackey', 'maxwell', 'walterCamp', 'confPOY']
export const POINT_MARKS = { qb: 'a 3,500-yard or 32-touchdown season', rb: 'a 1,200-yard or 14-touchdown season', wr: 'a 1,000-yard or 10-touchdown season', te: 'a 650-yard or 7-touchdown season' }
export function upgradePoints(r, pos) {
  const c = r?.cfb ?? {}
  const a = c.awards ?? {}
  const t = c.totals?.full ?? {}
  const backup = r?.role === 'backup'
  const wins = +String(c.record?.final ?? `${r?.wins ?? 0}-0`).split('-')[0] || 0
  if (!backup) {
    const won = HONORS.find(k => a[k]?.userWon)
    const honor = a.heisman?.userWon ? 'Heisman Trophy winner' : a.heisman?.userFinalist ? 'Heisman finalist'
      : a.allAmerica?.user === 'first' ? 'First-team All-American' : a.allAmerica?.user === 'second' ? 'Second-team All-American'
      : won ? `${a[won].award ?? 'A national award'} winner` : null
    if (honor) return { pts: 3, why: honor }
    const n = k => t[k] ?? 0
    const mark = pos === 'qb' ? (n('seasonPassYds') >= 3500 ? `${n('seasonPassYds').toLocaleString()} passing yards` : n('seasonTDs') + n('seasonRushTDs') >= 32 ? `${n('seasonTDs') + n('seasonRushTDs')} touchdowns` : null)
      : pos === 'rb' ? (n('seasonRushYds') >= 1200 ? `${n('seasonRushYds').toLocaleString()} rushing yards` : n('seasonRushTDs') + n('seasonRecTDs') >= 14 ? `${n('seasonRushTDs') + n('seasonRecTDs')} touchdowns` : null)
      : pos === 'te' ? (n('seasonRecYds') >= 650 ? `${n('seasonRecYds').toLocaleString()} receiving yards` : n('seasonRecTDs') >= 7 ? `${n('seasonRecTDs')} touchdown catches` : null)
      : (n('seasonRecYds') >= 1000 ? `${n('seasonRecYds').toLocaleString()} receiving yards` : n('seasonRecTDs') >= 10 ? `${n('seasonRecTDs')} touchdown catches` : null)
    const team = r?.champion ? 'National champions' : c.cfpSeed ? 'A Playoff team' : c.confChamp ? 'Conference champions' : wins >= 10 ? `${wins} wins` : null
    if (mark || team) return { pts: 2, why: mark ?? team }
  }
  return { pts: 1, why: backup ? 'A year as the backup' : 'A season as the starter' }
}

// ── A season as the backup: the school plays its real starter, he gets a backup's snaps ──────────
const LINE_KEYS = {
  qb: ['comp', 'att', 'passYds', 'tds', 'ints', 'sacks', 'rushAtt', 'rushYds', 'rushTDs', 'rating', 'eff'],
  rb: ['carries', 'rushYds', 'rushTDs', 'ypc', 'recs', 'recYds', 'recTDs', 'fumbles', 'long'],
  wr: ['targets', 'rec', 'recYds', 'recTDs', 'long'],
  te: ['targets', 'rec', 'recYds', 'recTDs', 'long'],
}
function backupLine(g, pos, rnd) {
  const blow = Math.abs((g.mySc ?? 0) - (g.oppSc ?? 0)) >= 21   // the starters sit in a blowout
  const td = (g.mySc ?? 0) >= 6   // (his touchdown is on the board: none in a game his team never reached the end zone)
  if (pos === 'qb') {
    const att = blow ? 4 + Math.floor(rnd() * 7) : rnd() < 0.12 ? 1 + Math.floor(rnd() * 3) : 0
    const comp = Math.round(att * (0.5 + rnd() * 0.2))
    return { att, comp, passYds: Math.round(comp * (8 + rnd() * 5)), tds: att >= 5 && rnd() < 0.3 && td ? 1 : 0, ints: att && rnd() < 0.07 ? 1 : 0, sacks: 0, rushAtt: att ? Math.floor(rnd() * 3) : 0, rushYds: att ? Math.floor(rnd() * 14) : 0, rushTDs: 0 }
  }
  if (pos === 'rb') {
    const base = g.carries ?? 14
    const carries = Math.max(1, Math.round(base * (0.28 + rnd() * 0.17) + (blow ? 3 : 0)))
    const ypc = (g.carries ? g.rushYds / Math.max(1, g.carries) : 4.5) * (0.82 + rnd() * 0.2)
    const recs = Math.floor(rnd() * 2.4)
    const rushYds = Math.round(carries * ypc)
    return { carries, rushYds, rushTDs: rnd() < 0.2 + (blow ? 0.15 : 0) && td ? 1 : 0, ypc: +(rushYds / carries).toFixed(1), recs, recYds: recs * Math.round(5 + rnd() * 5), recTDs: 0, fumbles: 0, long: Math.max(3, Math.round(Math.max(1, ypc) * (1.6 + rnd() * 2))) }
  }
  const targets = Math.floor(rnd() * 4) + (blow ? 1 : 0)
  const rec = Math.round(targets * (0.5 + rnd() * 0.3))
  return { targets, rec, recYds: rec * Math.round(8 + rnd() * 7), recTDs: rec && rnd() < 0.1 && td ? 1 : 0, long: rec ? Math.round(10 + rnd() * 20) : 0 }
}
function totalsOf(gs, pos) {
  const sum = k => gs.reduce((a, g) => a + (g[k] ?? 0), 0)
  const max = k => gs.reduce((a, g) => Math.max(a, g[k] ?? 0), 0)
  if (pos === 'qb') { const att = sum('att'), comp = sum('comp'); return { seasonPassYds: sum('passYds'), seasonTDs: sum('tds'), seasonINTs: sum('ints'), seasonCompletions: comp, seasonAttempts: att, seasonCompPct: att ? Math.round(comp / att * 1000) / 10 : 0, seasonRushYds: sum('rushYds'), seasonRushTDs: sum('rushTDs'), gp: gs.filter(g => g.att || g.rushAtt).length } }
  if (pos === 'rb') { const car = sum('carries'); return { seasonCarries: car, seasonRushYds: sum('rushYds'), seasonRushTDs: sum('rushTDs'), seasonYPC: car ? Math.round(sum('rushYds') / car * 10) / 10 : 0, seasonRecs: sum('recs'), seasonRecYds: sum('recYds'), seasonRecTDs: sum('recTDs'), seasonLong: max('long'), gp: gs.filter(g => g.carries).length } }
  const rec = sum('rec'); return { seasonTargets: sum('targets'), seasonRecs: rec, seasonRecYds: sum('recYds'), seasonRecTDs: sum('recTDs'), seasonYPR: rec ? Math.round(sum('recYds') / rec * 10) / 10 : 0, seasonLong: max('long'), gp: gs.filter(g => g.targets).length }
}
// the awards were the starter's, under his own name: none of them is the build's
const notUser = x => (Array.isArray(x) ? x.map(notUser) : x && typeof x === 'object'
  ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'isUser' || k === 'userWon' || k === 'userFinalist' ? false : k === 'userPlace' || (k === 'user' && typeof v === 'string') ? null : notUser(v)]))
  : x)
export function asBackup(r, pos, seed, starter, ovr) {
  const rnd = seeded(`cfb-backup-${seed}`)
  const blank = Object.fromEntries(LINE_KEYS[pos].map(k => [k, null]))
  const swap = g => ({ ...g, ...blank, ...backupLine(g, pos, rnd) })
  const games = (r.games ?? []).map(swap)
  const post = (r.cfb?.postseason ?? []).map(swap)
  const ccg = post.filter(g => g.round === 'Conference Championship')
  const c = r.cfb ?? {}
  return {
    ...r, games, role: 'backup', starterName: starter?.name ?? null, ovr: ovr ?? r.ovr,   // (his OVR, not the starter's the engine played)
    bestGame: null,   // (the engine's best game was the starter's)
    cfb: {
      ...c, postseason: post,
      totals: { regular: totalsOf(games, pos), throughCCG: totalsOf([...games, ...ccg], pos), full: totalsOf([...games, ...post], pos) },
      awards: notUser(c.awards ?? {}),
      // (the board the engine made is the starter's: he isn't on it, and the projection isn't his)
      draft: { ...(c.draft ?? {}), declares: false, tier: 'udfa', label: 'Undrafted free agent', round: null, pick: null, overall: null, boardRank: null, board: (c.draft?.board ?? []).map(x => ({ ...x, isUser: false })), note: `A backup year behind ${starter?.name ?? 'the starter'}: the scouts have seen little of him` },
    },
  }
}
// The backup year, played: the engine always plays its build first on the depth chart, so it's handed the school's
// real No. 1 (himself, so the school is the school it really is) and the build sits behind him.
// pools: the season's rosters (cfbShared seasonData); cls: the build's class, for the draft page (null: Career's
// older saves, which keep the starter's year the engine was told)
export function backupSeason(sim, pools, types, team, pos, seed, { ovr, cls = null, build = null, name = null, season = null, usePools = false } = {}) {
  const room = pools[pos].filter(p => p.team === (team?.short ?? team)).sort((a, b) => (a.depth ?? 9) - (b.depth ?? 9))
  const one = room[0]
  const bar = (pos === 'wr' ? room[2] ?? room[room.length - 1] : one) ?? null
  const sb = Object.fromEntries(types.map(t => [t, { type: t, val: one?.attrs?.[t] ?? 5, qbFull: one?.name, team: one?.team }]))
  const r = asBackup(sim.runCFBSimulation(sb, types, team, pos, seed, 'career', null, { name: one?.name ?? 'Starter', year: one?.year ?? 'JR', ...(usePools ? { pools } : {}), ...(season ? { season } : {}) }), pos, seed, bar, ovr)
  if (!cls) return r
  // (the page is about him: his name, his class, his own ratings on the scouting report, and where he stands with the draft)
  const d = r.cfb.draft, eligible = canDeclare(cls)
  const out = 2026   // (always the 2026 draft: the NFL rosters are 2026's. Was base, or base plus the years to go)
  return {
    ...r,
    cfb: {
      ...r.cfb,
      user: { ...(r.cfb.user ?? {}), name: name ?? r.cfb.user?.name, year: cls, ...(build ? { attrs: Object.fromEntries(types.map(t => [t, build[t]?.val ?? null])), types } : {}) },
      draft: { ...d, year: cls, eligible, draftYear: out, ...(eligible ? {} : { label: `Not draft-eligible yet (${cls})`, note: `A backup year behind ${bar?.name ?? 'the starter'}` }) },
    },
  }
}
