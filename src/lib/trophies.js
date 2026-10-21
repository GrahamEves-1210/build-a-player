// Trophy Case (Profile): a player's hardware and their best saved seasons.
// Only what's already public (the leaderboards and award boards read the same):
//   simulations  champion, wins / losses, ovr, build, season_award ('mvp' | 'opoy' |
//                'dpoy' | 'allpro': current-mode football), mvp / dpoy (basketball)
//   accounts     classic_ / alltime_ mvps, opoys, dpoys (football award counters)
// Never the wallet (app_profile). The live-mode trophies (online tier, Compete,
// Takeover, Blacktop) are the player's own stats (lib/progress.js), so a friend's
// profile only shows the shelf these rows make.
import { supabase } from './supabase'

const countOf = q => q.then(r => (r.error ? null : r.count ?? 0), () => null)

// The saved seasons behind each piece of hardware (a filter on a simulations query)
export const HARDWARE_ROWS = {
  rings:   q => q.eq('champion', true),
  mvp:     q => q.or('season_award.eq.mvp,mvp.is.true'),
  opoy:    q => q.eq('season_award', 'opoy'),
  dpoy:    q => q.or('season_award.eq.dpoy,dpoy.is.true'),
  allpro:  q => q.eq('season_award', 'allpro'),
  perfect: q => q.eq('losses', 0).gt('wins', 0),
  ovr90:   q => q.gte('ovr', 90),
  ovr95:   q => q.gte('ovr', 95),
}

// Counts for the shelf. Football awards come off the account's counters (All-Time
// awards aren't tagged on their seasons); basketball's off its seasons.
// null: nothing could be read (offline, no database)
export async function loadHardware(uid) {
  if (!supabase || !uid) return null
  const base = () => supabase.from('simulations').select('id', { count: 'exact', head: true }).eq('user_id', uid)
  const [acct, rings, perfect, ovr90, ovr95, allpro, bMvp, bDpoy] = await Promise.all([
    supabase.from('accounts').select('classic_mvps, alltime_mvps, classic_opoys, alltime_opoys, classic_dpoys, alltime_dpoys').eq('id', uid).maybeSingle()
      .then(r => r.data ?? {}, () => ({})),
    countOf(HARDWARE_ROWS.rings(base())),
    countOf(HARDWARE_ROWS.perfect(base())),
    countOf(HARDWARE_ROWS.ovr90(base())),
    countOf(HARDWARE_ROWS.ovr95(base())),
    countOf(HARDWARE_ROWS.allpro(base())),
    countOf(base().eq('mvp', true)),
    countOf(base().eq('dpoy', true)),
  ])
  if (rings == null && ovr90 == null) return null
  const n = k => (Number.isFinite(acct[k]) ? acct[k] : 0)
  const award = (cur, at, bucket = 0) => ({ current: n(cur), allTime: n(at), bucket: bucket ?? 0, total: n(cur) + n(at) + (bucket ?? 0) })
  return {
    rings: rings ?? 0, perfect: perfect ?? 0, ovr90: ovr90 ?? 0, ovr95: ovr95 ?? 0, allpro: allpro ?? 0,
    mvp: award('classic_mvps', 'alltime_mvps', bMvp),
    opoy: award('classic_opoys', 'alltime_opoys'),
    dpoy: award('classic_dpoys', 'alltime_dpoys', bDpoy),
  }
}

// Positions a saved season can be (football rows have no position column: the mode says it)
export const POSITIONS = [
  { key: 'qb',    label: 'QB',    sport: 'nfl',    where: q => q.in('game_mode', ['classic', 'lite', 'all-time', 'legends']) },
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
// (the three best for the OVR clubs) and the first one
export async function loadTrophySeasons(uid, id) {
  const f = HARDWARE_ROWS[id]
  if (!supabase || !uid || !f) return null
  const q = () => f(supabase.from('simulations').select(LITE_COLS).eq('user_id', uid))
  const byOvr = id === 'ovr90' || id === 'ovr95'
  const [list, first] = await Promise.all([
    (byOvr ? q().order('ovr', { ascending: false }).order('created_at', { ascending: false }) : q().order('created_at', { ascending: false }))
      .limit(3).then(r => (r.error ? null : r.data ?? []), () => null),
    q().order('created_at', { ascending: true }).limit(1).then(r => r.data?.[0] ?? null, () => null),
  ])
  return list ? { list, first } : null
}
