// Trophy Case (Profile): a player's hardware and their best saved seasons.
// Only what's already public (the leaderboards and award boards read the same):
//   simulations  champion, wins / losses, ovr, build, game_mode, position,
//                season_award ('mvp' | 'opoy' | 'dpoy' | 'allpro': football, current-mode
//                seasons only), mvp / dpoy (basketball)
//   accounts     classic_ / alltime_ mvps, opoys, dpoys (football award counters)
// Never the wallet (app_profile). The live-mode trophies (online tier, Compete,
// Squad Builder, Blacktop) are the player's own stats (lib/progress.js), so a friend's
// profile only shows the shelf these rows make.
//
// Where each count comes from (no season counted twice):
//   rings     simulations.champion, both sports
//   mvp/dpoy  football: current mode is the counter or the tagged seasons, whichever is
//             more (an old counter holds seasons from before tagging; a bump the account
//             guard dropped leaves it short); All-Time is the counter (those seasons are
//             never tagged). Plus basketball seasons (mvp / dpoy). Basketball never
//             touches the counters and football never sets mvp / dpoy.
//   opoy      football only, as above
//             DL's DPOYs never touch the counters (classic_dpoys is DB's board): every one
//             is a season tagged 'dpoy' on a dl- row, All-Time too, added on top. LB's the same (lb- rows).
//   allpro    OL current-mode seasons tagged 'allpro' (no counter exists)
//   perfect   seasons with no losses and at least one win (not a World Cup's three-game group)
//   ovr90     seasons played with a 90+ build (95+ is counted inside it, not twice)
//   boot      soccer: seasons tagged 'boot' (the league's Golden Boot, or the World Cup's)
//   ballon    soccer: seasons tagged 'bdor' (the Ballon d'Or) or 'gball' (the World Cup's Golden Ball)
//             (soccer's rows and tags: lib/soccerAwards.js; read only once SOCCER_LIVE is on)
import { supabase } from './supabase'
import { LB_LIVE } from './lbLive'
import { OL_LIVE } from './olLive'
import { SOCCER_LIVE } from './soccerLive'
import { BASEBALL_LIVE } from './baseballLive'
import { isSoccerMode, rowSoccerTags, SOCCER_AWARD_SHORT } from './soccerAwards'
import { isBaseballMode, rowBaseballAwards, BASEBALL_AWARD_SHORT } from './baseballAwards'

const countOf = q => q.then(r => (r.error ? null : r.count ?? 0), () => null)
const BUCKET = 'bucket-%'
const SOCCER = 'soccer-%'
const BASEBALL = 'baseball-%'

// The saved seasons behind each piece of hardware (a filter on a simulations query)
export const HARDWARE_ROWS = {
  rings:   q => q.eq('champion', true),
  mvp:     q => q.or('season_award.eq.mvp,mvp.is.true'),
  opoy:    q => q.eq('season_award', 'opoy'),
  dpoy:    q => q.or('season_award.eq.dpoy,dpoy.is.true'),
  allpro:  q => q.eq('season_award', 'allpro'),
  perfect: q => q.eq('losses', 0).gt('wins', 0).or('game_mode.is.null,game_mode.neq.soccer-all-time'),
  ovr90:   q => q.gte('ovr', 90),
  boot:    q => q.like('game_mode', SOCCER).like('season_award', '%boot%'),
  ballon:  q => q.like('game_mode', SOCCER).or('season_award.like.*bdor*,season_award.like.*gball*'),
  // baseball's (lib/baseballAwards.js tags; none of them is a football or basketball award)
  ws:      q => q.like('game_mode', BASEBALL).eq('champion', true),
  bbmvp:   q => q.like('game_mode', BASEBALL).like('season_award', '%bmvp%'),
  cy:      q => q.like('game_mode', BASEBALL).like('season_award', '%cy%'),
  ss:      q => q.like('game_mode', BASEBALL).like('season_award', '%ss%'),
  gg:      q => q.like('game_mode', BASEBALL).like('season_award', '%gg%'),
}

// Counts for the shelf (sources above). null: nothing could be read (offline, no database)
export async function loadHardware(uid) {
  if (!supabase || !uid) return null
  const base = () => supabase.from('simulations').select('id', { count: 'exact', head: true }).eq('user_id', uid)
  const [acct, rings, bRings, perfect, ovr90, ovr95, allpro, fMvp, fOpoy, fDpoy, dlDpoy, bMvp, bDpoy] = await Promise.all([
    supabase.from('accounts').select('classic_mvps, alltime_mvps, classic_opoys, alltime_opoys, classic_dpoys, alltime_dpoys').eq('id', uid).maybeSingle()
      .then(r => r.data ?? {}, () => ({})),
    countOf(HARDWARE_ROWS.rings(base())),
    countOf(HARDWARE_ROWS.rings(base()).like('game_mode', BUCKET)),
    countOf(HARDWARE_ROWS.perfect(base())),
    countOf(HARDWARE_ROWS.ovr90(base())),
    countOf(base().gte('ovr', 95)),
    countOf(HARDWARE_ROWS.allpro(base())),
    countOf(base().eq('season_award', 'mvp')),
    countOf(base().eq('season_award', 'opoy')),
    countOf(base().eq('season_award', 'dpoy')),
    countOf(base().eq('season_award', 'dpoy').or('game_mode.like.dl-*,game_mode.like.lb-*')),
    countOf(base().like('game_mode', BUCKET).eq('mvp', true)),
    countOf(base().like('game_mode', BUCKET).eq('dpoy', true)),
  ])
  // soccer's: its titles, Golden Boots, Ballon d'Ors and Golden Balls (nothing to read until it's live)
  const zero = Promise.resolve(0)
  const [sRings, sBoot, sBootWc, sBdor, sGball] = await Promise.all(SOCCER_LIVE ? [
    countOf(HARDWARE_ROWS.rings(base()).like('game_mode', SOCCER)),
    countOf(base().eq('game_mode', 'soccer-classic').like('season_award', '%boot%')),
    countOf(base().eq('game_mode', 'soccer-all-time').like('season_award', '%boot%')),
    countOf(base().like('game_mode', SOCCER).like('season_award', '%bdor%')),
    countOf(base().like('game_mode', SOCCER).like('season_award', '%gball%')),
  ] : [zero, zero, zero, zero, zero])
  // baseball's: World Series titles (its rings, never football's) by pool, and its awards (lib/baseballAwards.js rows;
  // nothing to read until it's live)
  const [bbRings, bbRingsAt, bbMvp, bbCy, bbSs, bbGg] = await Promise.all(BASEBALL_LIVE ? [
    countOf(HARDWARE_ROWS.ws(base())),
    countOf(HARDWARE_ROWS.ws(base()).eq('game_mode', 'baseball-all-time')),
    countOf(HARDWARE_ROWS.bbmvp(base())),
    countOf(HARDWARE_ROWS.cy(base())),
    countOf(HARDWARE_ROWS.ss(base())),
    countOf(HARDWARE_ROWS.gg(base())),
  ] : [zero, zero, zero, zero, zero, zero])
  if (rings == null && ovr90 == null) return null
  const n = k => (Number.isFinite(acct[k]) ? acct[k] : 0)
  // unlisted: counted, but with no tagged season to show (All-Time, or from before tagging)
  const award = (cur, at, tagged, bucket, tagOnly = 0) => {
    const counted = (tagged ?? 0) - tagOnly   // the tagged seasons the counter also holds
    const fb = Math.max(n(cur), counted) + n(at) + tagOnly
    const b = bucket ?? 0
    return { football: fb, bucket: b, total: fb + b, unlisted: Math.max(0, fb - (tagged ?? 0)) }
  }
  const r = rings ?? 0, br = Math.min(bRings ?? 0, r), sr = Math.min(sRings ?? 0, r - br), bbr = Math.min(bbRings ?? 0, r - br - sr)
  const boot = { current: sBoot ?? 0, alltime: sBootWc ?? 0 }, ballon = { bdor: sBdor ?? 0, gball: sGball ?? 0 }
  return {
    rings: { total: r, football: r - br - sr - bbr, bucket: br, soccer: sr, baseball: bbr },
    boot: { ...boot, total: boot.current + boot.alltime },
    ballon: { ...ballon, total: ballon.bdor + ballon.gball },
    baseball: { ws: bbr, wsAt: Math.min(bbRingsAt ?? 0, bbr), mvp: bbMvp ?? 0, cy: bbCy ?? 0, ss: bbSs ?? 0, gg: bbGg ?? 0 },
    perfect: perfect ?? 0, ovr90: ovr90 ?? 0, ovr95: Math.min(ovr95 ?? 0, ovr90 ?? 0), allpro: allpro ?? 0,
    mvp: award('classic_mvps', 'alltime_mvps', fMvp, bMvp),
    opoy: award('classic_opoys', 'alltime_opoys', fOpoy, 0),
    dpoy: award('classic_dpoys', 'alltime_dpoys', fDpoy, bDpoy, dlDpoy ?? 0),
  }
}

// Positions a saved season can be. Football rows have no position column: the mode says
// it ('rb-classic' …). A QB season's mode is the bare mode ('classic', 'all-time', 'lite',
// 'legends' …), so QB is every row without a position prefix (or with no mode at all).
const NOT_QB = ['bucket', 'soccer', 'baseball', 'rb', 'wr', 'te', 'db', 'dl', 'lb', 'ol'].map(p => `game_mode.not.like.${p}-*`).join(',')
// (OL's row: a filter only once OL is live, but a season saved in the old OL mode still reads as OL)
const OL_ROW = { key: 'ol', label: 'OL', sport: 'nfl', where: q => q.like('game_mode', 'ol-%') }
// (soccer's striker: a row only once SOCCER_LIVE is on, but a soccer season always reads as one)
const ST_ROW = { key: 'st', label: 'ST', sport: 'soccer', where: q => q.like('game_mode', SOCCER) }
// (baseball's batter and pitcher: rows only once BASEBALL_LIVE is on, but a baseball season always reads as one)
const BAT_ROW = { key: 'bat', label: 'BATTER', sport: 'baseball', where: q => q.like('game_mode', BASEBALL).eq('position', 'bat') }
const PIT_ROW = { key: 'pit', label: 'PITCHER', sport: 'baseball', where: q => q.like('game_mode', BASEBALL).eq('position', 'pit') }
export const POSITIONS = [
  { key: 'qb',    label: 'QB',    sport: 'nfl',    where: q => q.or(`game_mode.is.null,and(${NOT_QB})`) },
  { key: 'rb',    label: 'RB',    sport: 'nfl',    where: q => q.like('game_mode', 'rb-%') },
  { key: 'wr',    label: 'WR',    sport: 'nfl',    where: q => q.like('game_mode', 'wr-%') },
  { key: 'te',    label: 'TE',    sport: 'nfl',    where: q => q.like('game_mode', 'te-%') },
  { key: 'db',    label: 'DB',    sport: 'nfl',    where: q => q.like('game_mode', 'db-%') },
  { key: 'dl',    label: 'DL',    sport: 'nfl',    where: q => q.like('game_mode', 'dl-%') },
  ...(LB_LIVE ? [{ key: 'lb',    label: 'LB',    sport: 'nfl',    where: q => q.like('game_mode', 'lb-%') }] : []),
  ...(OL_LIVE ? [OL_ROW] : []),   // OL_LIVE: lib/olLive.js
  { key: 'guard', label: 'GUARD', sport: 'bucket', where: q => q.like('game_mode', 'bucket-%').eq('position', 'guard') },
  { key: 'big',   label: 'BIG',   sport: 'bucket', where: q => q.like('game_mode', 'bucket-%').eq('position', 'big') },
  ...(SOCCER_LIVE ? [ST_ROW] : []),   // SOCCER_LIVE: lib/soccerLive.js
  ...(BASEBALL_LIVE ? [BAT_ROW, PIT_ROW] : []),   // BASEBALL_LIVE: lib/baseballLive.js
]
const POS_BY_KEY = Object.fromEntries([...POSITIONS, OL_ROW, ST_ROW, BAT_ROW, PIT_ROW].map(p => [p.key, p]))

export function seasonPos(row) {
  const gm = String(row?.game_mode || 'classic')
  if (gm.startsWith('bucket-')) return POS_BY_KEY[row?.position === 'big' ? 'big' : 'guard']
  if (isSoccerMode(gm)) return POS_BY_KEY.st
  if (isBaseballMode(gm)) return POS_BY_KEY[row?.position === 'pit' ? 'pit' : 'bat']
  return POS_BY_KEY[gm.split('-')[0]] || POS_BY_KEY.qb
}
export const isAllTime = row => /all-time|legends/.test(String(row?.game_mode || ''))
// (soccer's pools have their own names: TOP DIVISIONS and WORLD CUP)
export const modeName = row => (isSoccerMode(row?.game_mode) ? (isAllTime(row) ? 'WORLD CUP' : 'TOP DIVISIONS') : isAllTime(row) ? 'ALL-TIME' : 'CURRENT')

// The awards a season won ('MVP', 'OPOY', 'DPOY', 'ALL-PRO')
export function seasonAwards(row) {
  if (!row) return []
  if (String(row.game_mode || '').startsWith('bucket-')) return [row.mvp && 'MVP', row.dpoy && 'DPOY'].filter(Boolean)
  if (isSoccerMode(row.game_mode)) return rowSoccerTags(row).map(t => SOCCER_AWARD_SHORT[t])
  // (baseball: the three that matter most; an All-Star nod only when it's all there is)
  if (isBaseballMode(row.game_mode)) { const t = rowBaseballAwards(row); return (t.length > 1 ? t.filter(k => k !== 'asg') : t).slice(0, 3).map(k => BASEBALL_AWARD_SHORT[k]) }
  return row.season_award ? [row.season_award === 'allpro' ? 'ALL-PRO' : row.season_award.toUpperCase()] : []
}

// A season's record: W-L, or a soccer season's W-D-L
export const seasonRecord = row => (row?.wins == null ? null : isSoccerMode(row.game_mode) ? `${row.wins}-${row.season_comp_pct ?? 0}-${row.losses ?? 0}` : `${row.wins}-${row.losses ?? 0}`)

export const seasonDate = iso => {
  const d = iso ? new Date(iso) : null
  return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

// (season_comp_pct: a soccer season's draws, for its W-D-L)
const BUILD_COLS = 'game_mode, position, ovr, archetype, wins, losses, season_comp_pct, champion, playoffs, season_award, mvp, dpoy, build, created_at'

// the same test as isAllTime, for the query (an old QB row has no game_mode: that's current)
export const CURRENT_ONLY = 'game_mode.is.null,and(game_mode.not.ilike.%all-time%,game_mode.not.ilike.%legends%)'
export const ALLTIME_ONLY = 'game_mode.ilike.%all-time%,game_mode.ilike.%legends%'
// The best saved season at each position (highest OVR, then wins), in current and in all-time:
// kept apart, or the all-time one would be the best at every position
export async function loadBestBuilds(uid) {
  if (!supabase || !uid) return null
  const era = async only => {
    const rows = await Promise.all(POSITIONS.map(p =>
      p.where(supabase.from('simulations').select(BUILD_COLS).eq('user_id', uid).not('build', 'is', null).not('ovr', 'is', null)).or(only)
        .order('ovr', { ascending: false }).order('wins', { ascending: false }).limit(1)
        .then(r => (r.error ? undefined : r.data?.[0] ? { ...r.data[0], pos: p } : null), () => undefined)))
    return { failed: rows.every(r => r === undefined), rows: rows.filter(Boolean).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || (b.wins ?? 0) - (a.wins ?? 0)) }
  }
  const [cur, all] = await Promise.all([era(CURRENT_ONLY), era(ALLTIME_ONLY)])
  if (cur.failed && all.failed) return null
  return { current: cur.rows, alltime: all.rows }
}

const LITE_COLS = 'game_mode, position, ovr, archetype, wins, losses, season_comp_pct, champion, season_award, mvp, dpoy, created_at'

// The seasons behind one trophy (asked for when its card opens): the latest three
// (the three best for the 90+ club) and the first one
export async function loadTrophySeasons(uid, id) {
  const f = HARDWARE_ROWS[id]
  if (!supabase || !uid || !f) return null
  const q = () => f(supabase.from('simulations').select(LITE_COLS).eq('user_id', uid))
  const byOvr = id === 'ovr90'
  const [list, first] = await Promise.all([
    (byOvr ? q().order('ovr', { ascending: false }).order('created_at', { ascending: false }) : q().order('created_at', { ascending: false }))
      .limit(3).then(r => (r.error ? null : r.data ?? []), () => null),
    q().order('created_at', { ascending: true }).limit(1).then(r => r.data?.[0] ?? null, () => null),
  ])
  return list ? { list, first } : null
}
