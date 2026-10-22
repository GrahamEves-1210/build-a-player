// Trophy Case (Profile): a player's hardware and their best saved seasons.
// Only what's already public (the leaderboards and award boards read the same):
//   simulations  champion, wins / losses, ovr, build, game_mode, position,
//                season_award ('mvp' | 'opoy' | 'dpoy' | 'allpro': football, current-mode
//                seasons only), mvp / dpoy (basketball)
//   accounts     classic_ / alltime_ mvps, opoys, dpoys (football award counters)
// Never the wallet (app_profile). The live-mode trophies (online tier, Compete,
// Takeover, Blacktop) are the player's own stats (lib/progress.js), so a friend's
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
//   allpro    OL current-mode seasons tagged 'allpro' (no counter exists)
//   perfect   seasons with no losses and at least one win
//   ovr90     seasons played with a 90+ build (95+ is counted inside it, not twice)
import { supabase } from './supabase'

const countOf = q => q.then(r => (r.error ? null : r.count ?? 0), () => null)
const BUCKET = 'bucket-%'

// The saved seasons behind each piece of hardware (a filter on a simulations query)
export const HARDWARE_ROWS = {
  rings:   q => q.eq('champion', true),
  mvp:     q => q.or('season_award.eq.mvp,mvp.is.true'),
  opoy:    q => q.eq('season_award', 'opoy'),
  dpoy:    q => q.or('season_award.eq.dpoy,dpoy.is.true'),
  allpro:  q => q.eq('season_award', 'allpro'),
  perfect: q => q.eq('losses', 0).gt('wins', 0),
  ovr90:   q => q.gte('ovr', 90),
}

// Counts for the shelf (sources above). null: nothing could be read (offline, no database)
export async function loadHardware(uid) {
  if (!supabase || !uid) return null
  const base = () => supabase.from('simulations').select('id', { count: 'exact', head: true }).eq('user_id', uid)
  const [acct, rings, bRings, perfect, ovr90, ovr95, allpro, fMvp, fOpoy, fDpoy, bMvp, bDpoy] = await Promise.all([
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
    countOf(base().like('game_mode', BUCKET).eq('mvp', true)),
    countOf(base().like('game_mode', BUCKET).eq('dpoy', true)),
  ])
  if (rings == null && ovr90 == null) return null
  const n = k => (Number.isFinite(acct[k]) ? acct[k] : 0)
  // unlisted: counted, but with no tagged season to show (All-Time, or from before tagging)
  const award = (cur, at, tagged, bucket) => {
    const fb = Math.max(n(cur), tagged ?? 0) + n(at)
    const b = bucket ?? 0
    return { football: fb, bucket: b, total: fb + b, unlisted: Math.max(0, fb - (tagged ?? 0)) }
  }
  const r = rings ?? 0, br = Math.min(bRings ?? 0, r)
  return {
    rings: { total: r, football: r - br, bucket: br },
    perfect: perfect ?? 0, ovr90: ovr90 ?? 0, ovr95: Math.min(ovr95 ?? 0, ovr90 ?? 0), allpro: allpro ?? 0,
    mvp: award('classic_mvps', 'alltime_mvps', fMvp, bMvp),
    opoy: award('classic_opoys', 'alltime_opoys', fOpoy, 0),
    dpoy: award('classic_dpoys', 'alltime_dpoys', fDpoy, bDpoy),
  }
}

// Positions a saved season can be. Football rows have no position column: the mode says
// it ('rb-classic' …). A QB season's mode is the bare mode ('classic', 'all-time', 'lite',
// 'legends' …), so QB is every row without a position prefix (or with no mode at all).
const NOT_QB = ['bucket', 'rb', 'wr', 'te', 'db', 'ol'].map(p => `game_mode.not.like.${p}-*`).join(',')
export const POSITIONS = [
  { key: 'qb',    label: 'QB',    sport: 'nfl',    where: q => q.or(`game_mode.is.null,and(${NOT_QB})`) },
  { key: 'rb',    label: 'RB',    sport: 'nfl',    where: q => q.like('game_mode', 'rb-%') },
  { key: 'wr',    label: 'WR',    sport: 'nfl',    where: q => q.like('game_mode', 'wr-%') },
  { key: 'te',    label: 'TE',    sport: 'nfl',    where: q => q.like('game_mode', 'te-%') },
  { key: 'db',    label: 'DB',    sport: 'nfl',    where: q => q.like('game_mode', 'db-%') },
  { key: 'ol',    label: 'OL',    sport: 'nfl',    where: q => q.like('game_mode', 'ol-%') },
  { key: 'guard', label: 'GUARD', sport: 'bucket', where: q => q.like('game_mode', 'bucket-%').eq('position', 'guard') },
  { key: 'big',   label: 'BIG',   sport: 'bucket', where: q => q.like('game_mode', 'bucket-%').eq('position', 'big') },
]
const POS_BY_KEY = Object.fromEntries(POSITIONS.map(p => [p.key, p]))

export function seasonPos(row) {
  const gm = String(row?.game_mode || 'classic')
  if (gm.startsWith('bucket-')) return POS_BY_KEY[row?.position === 'big' ? 'big' : 'guard']
  return POS_BY_KEY[gm.split('-')[0]] || POS_BY_KEY.qb
}
export const isAllTime = row => /all-time|legends/.test(String(row?.game_mode || ''))
export const modeName = row => (isAllTime(row) ? 'ALL-TIME' : 'CURRENT')

// The awards a season won ('MVP', 'OPOY', 'DPOY', 'ALL-PRO')
export function seasonAwards(row) {
  if (!row) return []
  if (String(row.game_mode || '').startsWith('bucket-')) return [row.mvp && 'MVP', row.dpoy && 'DPOY'].filter(Boolean)
  return row.season_award ? [row.season_award === 'allpro' ? 'ALL-PRO' : row.season_award.toUpperCase()] : []
}

export const seasonDate = iso => {
  const d = iso ? new Date(iso) : null
  return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

const BUILD_COLS = 'game_mode, position, ovr, archetype, wins, losses, champion, playoffs, season_award, mvp, dpoy, build, created_at'

// The best saved season at each position (highest OVR, then wins): one row per position
export async function loadBestBuilds(uid) {
  if (!supabase || !uid) return null
  const rows = await Promise.all(POSITIONS.map(p =>
    p.where(supabase.from('simulations').select(BUILD_COLS).eq('user_id', uid).not('build', 'is', null).not('ovr', 'is', null))
      .order('ovr', { ascending: false }).order('wins', { ascending: false }).limit(1)
      .then(r => (r.error ? undefined : r.data?.[0] ? { ...r.data[0], pos: p } : null), () => undefined)))
  if (rows.every(r => r === undefined)) return null
  return rows.filter(Boolean).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || (b.wins ?? 0) - (a.wins ?? 0))
}

const LITE_COLS = 'game_mode, position, ovr, archetype, wins, losses, champion, season_award, mvp, dpoy, created_at'

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
