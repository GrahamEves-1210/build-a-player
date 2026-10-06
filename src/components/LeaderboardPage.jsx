import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ATTR, TYPES } from '../data/qbs'
import { TEAMS } from '../data/nfl-teams'
import { RB_TYPES, RB_ATTR } from '../data/rbs'
import { WR_TYPES, WR_ATTR } from '../data/wrs'
import { TE_TYPES, TE_ATTR } from '../data/tes'
import { DB_TYPES, DB_ATTR } from '../data/dbs'
import { OL_TYPES, OL_ATTR } from '../data/ols'
import { valToGrade, nflHeadshot } from '../utils/simulation'
import QBAvatar from './QBAvatar'
import HEADSHOTS from '../data/headshots.json'

// S grade = val 11 (see GRADES in utils/simulation.js). Best Builds ranks by
// how many maxed-out slots a build has, not raw OVR, so a build with more S's
// outranks a slightly-higher-OVR build with fewer of them.
function countSRatings(build) {
  return Object.values(build || {}).filter(slot => Math.round(slot?.val) >= 11).length
}
function sortBySRatings(rows) {
  return [...(rows ?? [])].sort((a, b) =>
    countSRatings(b.build) - countSRatings(a.build) || (b.ovr - a.ovr) || (b.wins - a.wins))
}

// A single `.in('id', uids)` with hundreds+ of UUIDs blows past Supabase's URL
// length limit and 400s — chunk into batches that stay safely under it.
async function fetchPlusUidsChunked(uids) {
  const chunks = []
  for (let i = 0; i < uids.length; i += 150) chunks.push(uids.slice(i, i + 150))
  const results = await Promise.all(chunks.map(chunk => supabase
    .from('accounts')
    .select('id')
    .in('id', chunk)
    .or('ads_disabled.eq.true,subscription_status.eq.active')))
  return results.flatMap(r => r.data ?? []).map(a => a.id)
}

// A query against `simulations` occasionally hits a cold-start statement
// timeout (Postgres 57014) — retrying almost always succeeds within a second.
async function queryWithRetry(buildQuery, retries = 2, delayMs = 700) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await buildQuery()
    if (!error && data) return { data, error: null }
    lastError = error
    if (attempt < retries) await new Promise(r => setTimeout(r, delayMs))
  }
  return { data: null, error: lastError }
}

// Pre-aggregated per-(game_mode, user_id) snapshot of `simulations`, refreshed
// hourly by a Postgres cron job — reading this instead of paginating/summing
// the full (100k+ row) simulations table client-side turns a ~45s leaderboard
// load into a near-instant one. See leaderboard_user_stats in the DB.
async function fetchLeaderboardStats(gameMode) {
  const { data, error } = await queryWithRetry(() => supabase
    .from('leaderboard_user_stats')
    .select('user_id, username, wins, losses, rings, playoff_apps, sims_count, total_ovr, total_pass_yds, total_tds, total_ints')
    .eq('game_mode', gameMode))
  if (error) { console.error('[leaderboard] stats fetch failed:', error); return [] }
  return data ?? []
}

const QB_METRICS = [
  { key: 'rings',   label: 'Rings',    fmt: v => v },
  { key: 'mvps',   label: 'MVPs',     fmt: v => v, awards: true },
  { key: 'avgOvr',  label: 'Avg OVR',  fmt: v => v },
  { key: 'wins',    label: 'Wins',     fmt: v => v },
  { key: 'winPct',  label: 'Win %',    fmt: v => `${v}%` },
  { key: 'yds',     label: 'Pass Yds', fmt: v => v.toLocaleString() },
  { key: 'tds',     label: 'Pass TDs', fmt: v => v },
]

const RB_METRICS = [
  { key: 'rings',   label: 'Rings',     fmt: v => v },
  { key: 'opoys',  label: 'OPOYs',     fmt: v => v, awards: true },
  { key: 'avgOvr',  label: 'Avg OVR',   fmt: v => v },
  { key: 'wins',    label: 'Wins',      fmt: v => v },
  { key: 'winPct',  label: 'Win %',     fmt: v => `${v}%` },
  { key: 'yds',     label: 'Rush Yds',  fmt: v => v.toLocaleString() },
  { key: 'tds',     label: 'TDs',       fmt: v => v },
]

const WR_METRICS = [
  { key: 'rings',   label: 'Rings',    fmt: v => v },
  { key: 'avgOvr',  label: 'Avg OVR',  fmt: v => v },
  { key: 'wins',    label: 'Wins',     fmt: v => v },
  { key: 'winPct',  label: 'Win %',    fmt: v => `${v}%` },
  { key: 'recYds',  label: 'Rec Yds',  fmt: v => v.toLocaleString() },
  { key: 'tds',     label: 'Rec TDs',  fmt: v => v },
  { key: 'recs',    label: 'Recs',     fmt: v => v },
]

const TE_METRICS = [
  { key: 'rings',   label: 'Rings',    fmt: v => v },
  { key: 'avgOvr',  label: 'Avg OVR',  fmt: v => v },
  { key: 'wins',    label: 'Wins',     fmt: v => v },
  { key: 'winPct',  label: 'Win %',    fmt: v => `${v}%` },
  { key: 'recYds',  label: 'Rec Yds',  fmt: v => v.toLocaleString() },
  { key: 'tds',     label: 'Rec TDs',  fmt: v => v },
  { key: 'recs',    label: 'Recs',     fmt: v => v },
]

const DB_METRICS = [
  { key: 'rings',   label: 'Rings',    fmt: v => v },
  { key: 'dpoys',   label: 'DPOYs',    fmt: v => v, awards: true },
  { key: 'avgOvr',  label: 'Avg OVR',  fmt: v => v },
  { key: 'wins',    label: 'Wins',     fmt: v => v },
  { key: 'winPct',  label: 'Win %',    fmt: v => `${v}%` },
  { key: 'tackles', label: 'Tackles',  fmt: v => v.toLocaleString() },
  { key: 'ints',    label: 'INTs',     fmt: v => v },
  { key: 'pbus',    label: 'PBUs',     fmt: v => v },
]

// OL rows store pancakes in total_pass_yds (see the simulations insert in App)
const OL_METRICS = [
  { key: 'rings',    label: 'Rings',    fmt: v => v },
  { key: 'allpros',  label: 'All-Pros', fmt: v => v, awards: true },
  { key: 'avgOvr',   label: 'Avg OVR',  fmt: v => v },
  { key: 'wins',     label: 'Wins',     fmt: v => v },
  { key: 'winPct',   label: 'Win %',    fmt: v => `${v}%` },
  { key: 'pancakes', label: 'Pancakes', fmt: v => v.toLocaleString() },
]

const ALL_MODES = ['classic', 'rb-classic', 'wr-classic', 'te-classic', 'db-classic', 'ol-classic']

const ALL_METRICS = [
  { key: 'rings',  label: 'Rings',    fmt: v => v },
  { key: 'mvps',   label: 'MVPs/POYs', fmt: v => v, awards: true },
  { key: 'avgOvr', label: 'Avg OVR',  fmt: v => v },
  { key: 'count',  label: 'Seasons',  fmt: v => v },
]

const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, t.color]))
const QB_PHOTO   = (name) => nflHeadshot(HEADSHOTS[name])

function ovrColor(ovr) {
  if (ovr >= 95) return '#74C69D'
  if (ovr >= 88) return '#95D5B2'
  if (ovr >= 80) return 'var(--text-2)'
  if (ovr >= 72) return 'var(--text-3)'
  return '#f87171'
}

function RankBadge({ rank }) {
  return <div className={`lb-rank-badge lb-rank-${rank <= 3 ? rank : 'n'}`}>{rank}</div>
}

function LBSpinner() {
  return (
    <div className="lb-spinner-wrap">
      <svg className="lb-spinner" viewBox="0 0 36 36">
        <circle className="lb-spinner-track" cx="18" cy="18" r="14" fill="none" strokeWidth="3" />
        <circle className="lb-spinner-arc" cx="18" cy="18" r="14" fill="none" strokeWidth="3" />
      </svg>
    </div>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`lb-chevron ${open ? 'lb-chevron-open' : ''}`}
      width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function BuildExpand({ build, types = TYPES, attrMap = ATTR }) {
  const slots = types.filter(k => build[k])
  if (slots.length === 0) return <div className="lb-expand-empty">Build data unavailable</div>
  return (
    <div className="simp-attr-table lb-attr-table">
      {slots.map(k => {
        const data = build[k]
        const meta = attrMap[k]
        const teamColor = TEAM_COLOR[data.team]
        return (
          <div key={k} className="simp-attr-row simp-row-visible">
            <QBAvatar photo={QB_PHOTO(data.qb)} team={data.team} color={teamColor} size={42} />
            <div className="simp-attr-info">
              <span className="simp-attr-name">{meta?.label || k}</span>
              <span className="simp-attr-qb">{data.qb}</span>
            </div>
            <span className="simp-grade-circle" style={{ background: meta?.hex, color: '#111111' }}>
              {valToGrade(data.val)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function LeaderboardPage({ onBack, currentUser, adsDisabled = false, isRB = false, isWR = false, isTE = false, isDB = false, isOL = false, onPositionChange }) {
  // ── QB state ────────────────────────────────────────────────────────────────
  const [rows, setRows]               = useState([])
  const [bestBuilds, setBestBuilds]   = useState([])
  const [worstBuilds, setWorstBuilds] = useState([])
  const [legendRows, setLegendRows]   = useState([])
  const [buildsLoaded, setBuildsLoaded]   = useState(false)
  const [legendLoaded, setLegendLoaded]   = useState(false)
  const [loading, setLoading]             = useState(true)
  const [buildsLoading, setBuildsLoading] = useState(false)
  const [legendLoading, setLegendLoading] = useState(false)
  const [metric, setMetric]           = useState('rings')
  const [legendMetric, setLegendMetric] = useState('rings')

  // ── RB state ────────────────────────────────────────────────────────────────
  const [rbRows, setRbRows]                 = useState([])
  const [rbBestBuilds, setRbBestBuilds]     = useState([])
  const [rbWorstBuilds, setRbWorstBuilds]   = useState([])
  const [rbLoaded, setRbLoaded]             = useState(false)
  const [rbBuildsLoaded, setRbBuildsLoaded] = useState(false)
  const [rbLoading, setRbLoading]           = useState(false)
  const [rbBuildsLoading, setRbBuildsLoading] = useState(false)
  const [rbMetric, setRbMetric]             = useState('rings')

  // ── RB All-Time state ────────────────────────────────────────────────────────
  const [rbLegendRows, setRbLegendRows]         = useState([])
  const [rbLegendLoaded, setRbLegendLoaded]     = useState(false)
  const [rbLegendLoading, setRbLegendLoading]   = useState(false)
  const [rbLegendMetric, setRbLegendMetric]     = useState('rings')

  // ── WR All-Time state ────────────────────────────────────────────────────────
  const [wrLegendRows, setWrLegendRows]         = useState([])
  const [wrLegendLoaded, setWrLegendLoaded]     = useState(false)
  const [wrLegendLoading, setWrLegendLoading]   = useState(false)
  const [wrLegendMetric, setWrLegendMetric]     = useState('rings')

  // ── TE All-Time state ────────────────────────────────────────────────────────
  const [teLegendRows, setTeLegendRows]         = useState([])
  const [teLegendLoaded, setTeLegendLoaded]     = useState(false)
  const [teLegendLoading, setTeLegendLoading]   = useState(false)
  const [teLegendMetric, setTeLegendMetric]     = useState('rings')

  // ── DB All-Time state ────────────────────────────────────────────────────────
  const [dbLegendRows, setDbLegendRows]         = useState([])
  const [dbLegendLoaded, setDbLegendLoaded]     = useState(false)
  const [dbLegendLoading, setDbLegendLoading]   = useState(false)
  const [dbLegendMetric, setDbLegendMetric]     = useState('rings')

  // ── WR state ─────────────────────────────────────────────────────────────────
  const [wrRows, setWrRows]                 = useState([])
  const [wrBestBuilds, setWrBestBuilds]     = useState([])
  const [wrWorstBuilds, setWrWorstBuilds]   = useState([])
  const [wrLoaded, setWrLoaded]             = useState(false)
  const [wrBuildsLoaded, setWrBuildsLoaded] = useState(false)
  const [wrLoading, setWrLoading]           = useState(false)
  const [wrBuildsLoading, setWrBuildsLoading] = useState(false)
  const [wrMetric, setWrMetric]             = useState('rings')

  // ── TE state ──────────────────────────────────────────────────────────────────
  const [teRows, setTeRows]                 = useState([])
  const [teBestBuilds, setTeBestBuilds]     = useState([])
  const [teWorstBuilds, setTeWorstBuilds]   = useState([])
  const [teLoaded, setTeLoaded]             = useState(false)
  const [teBuildsLoaded, setTeBuildsLoaded] = useState(false)
  const [teLoading, setTeLoading]           = useState(false)
  const [teBuildsLoading, setTeBuildsLoading] = useState(false)
  const [teMetric, setTeMetric]             = useState('rings')

  // ── DB state ──────────────────────────────────────────────────────────────────
  const [dbRows, setDbRows]                 = useState([])
  const [dbBestBuilds, setDbBestBuilds]     = useState([])
  const [dbWorstBuilds, setDbWorstBuilds]   = useState([])
  const [dbLoaded, setDbLoaded]             = useState(false)
  const [dbBuildsLoaded, setDbBuildsLoaded] = useState(false)
  const [dbLoading, setDbLoading]           = useState(false)
  const [dbBuildsLoading, setDbBuildsLoading] = useState(false)
  const [dbMetric, setDbMetric]             = useState('rings')

  // ── OL state ──────────────────────────────────────────────────────────────────
  const [olRows, setOlRows]                 = useState([])
  const [olBestBuilds, setOlBestBuilds]     = useState([])
  const [olWorstBuilds, setOlWorstBuilds]   = useState([])
  const [olLoaded, setOlLoaded]             = useState(false)
  const [olBuildsLoaded, setOlBuildsLoaded] = useState(false)
  const [olLoading, setOlLoading]           = useState(false)
  const [olBuildsLoading, setOlBuildsLoading] = useState(false)
  const [olMetric, setOlMetric]             = useState('rings')

  const [plusUids, setPlusUids] = useState(new Set())

  // ── Daily state ──────────────────────────────────────────────────────────────
  const [dailyRows, setDailyRows]       = useState([])
  const [dailyLoaded, setDailyLoaded]   = useState(false)
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyMetric, setDailyMetric]   = useState('rings')

  // ── Awards state ─────────────────────────────────────────────────────────────
  const [awardsRows, setAwardsRows]                   = useState([])
  const [alltimeAwardsRows, setAlltimeAwardsRows]     = useState([])
  const [awardsLoadedFor, setAwardsLoadedFor]         = useState(null) // 'rb' | 'qb' | null
  const [awardsLoading, setAwardsLoading]             = useState(false)
  const [awardsMode, setAwardsMode]                   = useState('classic')

  // ── ALL (combined across QB/RB/WR/TE/DB) state ───────────────────────────────
  const [isAllView, setIsAllView]         = useState(false)
  const [allRows, setAllRows]             = useState([])
  const [allLoading, setAllLoading]       = useState(true)
  const [allMetric, setAllMetric]         = useState('rings')
  const [allAwardsRows, setAllAwardsRows] = useState([])
  const [allAwardsLoaded, setAllAwardsLoaded]   = useState(false)
  const [allAwardsLoading, setAllAwardsLoading] = useState(false)
  const [allDailyRows, setAllDailyRows]       = useState([])
  const [allDailyLoaded, setAllDailyLoaded]   = useState(false)
  const [allDailyLoading, setAllDailyLoading] = useState(false)
  const [allDailyMetric, setAllDailyMetric]   = useState('rings')

  // ── Shared UI state ──────────────────────────────────────────────────────────
  const [view, setView]           = useState('profiles')
  const [buildsTab, setBuildsTab] = useState('best')
  const [expandedIdx, setExpandedIdx] = useState(null)
  // ── QB profiles (classic) ────────────────────────────────────────────────────
  useEffect(() => {
    if (isRB || !supabase) { setLoading(false); return }
    ;(async () => {
      const data = await fetchLeaderboardStats('classic')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins,
          losses: u.losses,
          rings: u.rings,
          count: u.sims_count,
          totalOvr: u.total_ovr,
          yds: u.total_pass_yds,
          tds: u.total_tds,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
          winPctWeighted: games > 0 ? (u.wins + 17) / (games + 34) * 100 : 0,
        }
      })
      setRows(compiled)
      setLoading(false)
      const uids = compiled.map(r => r.uid)
      fetchPlusUidsChunked(uids).then(ids => setPlusUids(prev => new Set([...prev, ...ids])))
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ALL profiles (sums QB/RB/WR/TE/DB classic stats per user — build-a-player
  // only, bucket is tracked entirely separately) ───────────────────────────────
  useEffect(() => {
    if (!supabase) { setAllLoading(false); return }
    ;(async () => {
      const results = await Promise.all(ALL_MODES.map(m => fetchLeaderboardStats(m)))
      const byUid = new Map()
      for (const data of results) {
        for (const u of data) {
          if (!byUid.has(u.user_id)) {
            byUid.set(u.user_id, { uid: u.user_id, username: u.username || `Player_${u.user_id.slice(0, 5)}`, wins: 0, losses: 0, rings: 0, count: 0, totalOvr: 0 })
          }
          const r = byUid.get(u.user_id)
          r.wins     += u.wins ?? 0
          r.losses   += u.losses ?? 0
          r.rings    += u.rings ?? 0
          r.count    += u.sims_count ?? 0
          r.totalOvr += u.total_ovr ?? 0
          if (u.username) r.username = u.username
        }
      }
      const compiled = Array.from(byUid.values()).map(r => {
        const games = r.wins + r.losses
        return {
          ...r,
          avgOvr: r.count > 0 ? +(r.totalOvr / r.count).toFixed(1) : 0,
          winPct: games > 0 ? +((r.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setAllRows(compiled)
      setAllLoading(false)
      fetchPlusUidsChunked(compiled.map(r => r.uid)).then(ids => setPlusUids(prev => new Set([...prev, ...ids])))
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── QB builds ───────────────────────────────────────────────────────────────
  const loadBuilds = () => {
    if (buildsLoaded || !supabase) return
    setBuildsLoading(true)
    const bestQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'classic')
      .not('build', 'is', null)
      .gte('ovr', 80)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(200)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'classic')
      .not('build', 'is', null)
      .lt('ovr', 80)
      .order('ovr', { ascending: true })
      .order('wins', { ascending: true })
      .limit(20)
    Promise.all([bestQ, worstQ]).then(([best, worst]) => {
      if (best.data)  setBestBuilds(sortBySRatings(best.data))
      if (worst.data) setWorstBuilds(worst.data)
      setBuildsLoaded(true)
      setBuildsLoading(false)
    })
  }

  // ── QB all-time ──────────────────────────────────────────────────────────────
  useEffect(() => { if (!isRB) loadLegends() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadLegends = () => {
    if (legendLoaded || !supabase) return
    setLegendLoading(true)
    ;(async () => {
      const data = await fetchLeaderboardStats('all-time')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, yds: u.total_pass_yds, tds: u.total_tds,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
          winPctWeighted: games > 0 ? (u.wins + 17) / (games + 34) * 100 : 0,
        }
      })
      setLegendRows(compiled)
      setLegendLoaded(true)
      setLegendLoading(false)
    })()
  }

  useEffect(() => { setDailyLoaded(false); setDailyRows([]); if (view === 'daily' || view === 'wr-legends' || view === 'te-legends' || view === 'rb-legends' || view === 'db-legends') setView('profiles') }, [isRB, isWR, isTE, isDB, isOL]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── RB profiles ──────────────────────────────────────────────────────────────
  useEffect(() => { if (isRB) loadRB() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRB = () => {
    if (rbLoaded || !supabase) return
    setRbLoading(true)
    ;(async () => {
      const data = await fetchLeaderboardStats('rb-classic')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, yds: u.total_pass_yds, tds: u.total_tds,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setRbRows(compiled)
      setRbLoaded(true)
      setRbLoading(false)
    })()
  }

  // ── RB builds ────────────────────────────────────────────────────────────────
  const loadRBBuilds = () => {
    if (rbBuildsLoaded || !supabase) return
    setRbBuildsLoading(true)
    const bestQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'rb-classic')
      .not('build', 'is', null)
      .gte('ovr', 75)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(200)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'rb-classic')
      .not('build', 'is', null)
      .lt('ovr', 75)
      .order('ovr', { ascending: true })
      .order('wins', { ascending: true })
      .limit(20)
    Promise.all([bestQ, worstQ]).then(([best, worst]) => {
      if (best.data)  setRbBestBuilds(sortBySRatings(best.data))
      if (worst.data) setRbWorstBuilds(worst.data)
      setRbBuildsLoaded(true)
      setRbBuildsLoading(false)
    })
  }

  // ── RB all-time ──────────────────────────────────────────────────────────────
  const loadRBLegends = () => {
    if (rbLegendLoaded || !supabase) return
    setRbLegendLoading(true)
    ;(async () => {
      const data = await fetchLeaderboardStats('rb-all-time')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, yds: u.total_pass_yds, tds: u.total_tds,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
          winPctWeighted: games > 0 ? (u.wins + 17) / (games + 34) * 100 : 0,
        }
      })
      setRbLegendRows(compiled)
      setRbLegendLoaded(true)
      setRbLegendLoading(false)
    })()
  }

  // ── WR All-Time ──────────────────────────────────────────────────────────────
  const loadWRLegends = () => {
    if (wrLegendLoaded || !supabase) return
    setWrLegendLoading(true)
    ;(async () => {
      const data = await fetchLeaderboardStats('wr-all-time')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, recYds: u.total_pass_yds, tds: u.total_tds, recs: u.total_ints,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setWrLegendRows(compiled)
      setWrLegendLoaded(true)
      setWrLegendLoading(false)
    })()
  }

  // ── TE All-Time ──────────────────────────────────────────────────────────────
  const loadTELegends = () => {
    if (teLegendLoaded || !supabase) return
    setTeLegendLoading(true)
    ;(async () => {
      const data = await fetchLeaderboardStats('te-all-time')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, recYds: u.total_pass_yds, tds: u.total_tds, recs: u.total_ints,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setTeLegendRows(compiled)
      setTeLegendLoaded(true)
      setTeLegendLoading(false)
    })()
  }

  // ── DB All-Time ──────────────────────────────────────────────────────────────
  const loadDBLegends = () => {
    if (dbLegendLoaded || !supabase) return
    setDbLegendLoading(true)
    ;(async () => {
      const data = await fetchLeaderboardStats('db-all-time')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, tackles: u.total_pass_yds, ints: u.total_tds, pbus: u.total_ints,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setDbLegendRows(compiled)
      setDbLegendLoaded(true)
      setDbLegendLoading(false)
    })()
  }

  // ── WR profiles ──────────────────────────────────────────────────────────────
  useEffect(() => { if (isWR) loadWR() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadWR = () => {
    if (wrLoaded || !supabase) return
    setWrLoading(true)
    ;(async () => { try {
      const data = await fetchLeaderboardStats('wr-classic')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, recYds: u.total_pass_yds, tds: u.total_tds, recs: u.total_ints,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setWrRows(compiled)
      setWrLoaded(true)
      setWrLoading(false)
      const uids = compiled.map(r => r.uid)
      fetchPlusUidsChunked(uids).then(ids => setPlusUids(prev => new Set([...prev, ...ids])))
    } catch (e) { console.error('loadWR error', e); setWrLoading(false) } })()
  }

  // ── WR builds ────────────────────────────────────────────────────────────────
  const loadWRBuilds = () => {
    if (wrBuildsLoaded || !supabase) return
    setWrBuildsLoading(true)
    const bestQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'wr-classic')
      .not('build', 'is', null)
      .gte('ovr', 75)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(200)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'wr-classic')
      .not('build', 'is', null)
      .lt('ovr', 75)
      .order('ovr', { ascending: true })
      .order('wins', { ascending: true })
      .limit(20)
    Promise.all([bestQ, worstQ]).then(([best, worst]) => {
      if (best.data)  setWrBestBuilds(sortBySRatings(best.data))
      if (worst.data) setWrWorstBuilds(worst.data)
      setWrBuildsLoaded(true)
      setWrBuildsLoading(false)
    })
  }

  // ── TE profiles ───────────────────────────────────────────────────────────────
  useEffect(() => { if (isTE) loadTE() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTE = () => {
    if (teLoaded || !supabase) return
    setTeLoading(true)
    ;(async () => { try {
      const data = await fetchLeaderboardStats('te-classic')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, recYds: u.total_pass_yds, tds: u.total_tds, recs: u.total_ints,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setTeRows(compiled)
      setTeLoaded(true)
      setTeLoading(false)
      const uids = compiled.map(r => r.uid)
      fetchPlusUidsChunked(uids).then(ids => setPlusUids(prev => new Set([...prev, ...ids])))
    } catch (e) { console.error('loadTE error', e); setTeLoading(false) } })()
  }

  // ── TE builds ────────────────────────────────────────────────────────────────
  const loadTEBuilds = () => {
    if (teBuildsLoaded || !supabase) return
    setTeBuildsLoading(true)
    const bestQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'te-classic')
      .not('build', 'is', null)
      .gte('ovr', 75)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(200)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'te-classic')
      .not('build', 'is', null)
      .lt('ovr', 75)
      .order('ovr', { ascending: true })
      .order('wins', { ascending: true })
      .limit(20)
    Promise.all([bestQ, worstQ]).then(([best, worst]) => {
      if (best.data)  setTeBestBuilds(sortBySRatings(best.data))
      if (worst.data) setTeWorstBuilds(worst.data)
      setTeBuildsLoaded(true)
      setTeBuildsLoading(false)
    })
  }

  // ── DB profiles ───────────────────────────────────────────────────────────────
  useEffect(() => { if (isDB) loadDB() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDB = () => {
    if (dbLoaded || !supabase) return
    setDbLoading(true)
    ;(async () => { try {
      const data = await fetchLeaderboardStats('db-classic')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, tackles: u.total_pass_yds, ints: u.total_tds, pbus: u.total_ints,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setDbRows(compiled)
      setDbLoaded(true)
      setDbLoading(false)
      const uids = compiled.map(r => r.uid)
      fetchPlusUidsChunked(uids).then(ids => setPlusUids(prev => new Set([...prev, ...ids])))
    } catch (e) { console.error('loadDB error', e); setDbLoading(false) } })()
  }

  // ── DB builds ─────────────────────────────────────────────────────────────────
  const loadDBBuilds = () => {
    if (dbBuildsLoaded || !supabase) return
    setDbBuildsLoading(true)
    const bestQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'db-classic')
      .not('build', 'is', null)
      .gte('ovr', 75)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(200)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'db-classic')
      .not('build', 'is', null)
      .lt('ovr', 75)
      .order('ovr', { ascending: true })
      .order('wins', { ascending: true })
      .limit(20)
    Promise.all([bestQ, worstQ]).then(([best, worst]) => {
      if (best.data)  setDbBestBuilds(sortBySRatings(best.data))
      if (worst.data) setDbWorstBuilds(worst.data)
      setDbBuildsLoaded(true)
      setDbBuildsLoading(false)
    })
  }

  // ── OL profiles ───────────────────────────────────────────────────────────────
  useEffect(() => { if (isOL) loadOL() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadOL = () => {
    if (olLoaded || !supabase) return
    setOlLoading(true)
    ;(async () => { try {
      const data = await fetchLeaderboardStats('ol-classic')
      const compiled = data.map(u => {
        const games = u.wins + u.losses
        return {
          uid: u.user_id,
          username: u.username || `Player_${u.user_id.slice(0, 5)}`,
          wins: u.wins, losses: u.losses, rings: u.rings, playoffApps: u.playoff_apps,
          count: u.sims_count, totalOvr: u.total_ovr, pancakes: u.total_pass_yds, sacks: u.total_tds, pressures: u.total_ints,
          avgOvr: u.sims_count > 0 ? +(u.total_ovr / u.sims_count).toFixed(1) : 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setOlRows(compiled)
      setOlLoaded(true)
      setOlLoading(false)
      const uids = compiled.map(r => r.uid)
      fetchPlusUidsChunked(uids).then(ids => setPlusUids(prev => new Set([...prev, ...ids])))
    } catch (e) { console.error('loadOL error', e); setOlLoading(false) } })()
  }

  // ── OL builds ─────────────────────────────────────────────────────────────────
  const loadOLBuilds = () => {
    if (olBuildsLoaded || !supabase) return
    setOlBuildsLoading(true)
    const bestQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'ol-classic')
      .not('build', 'is', null)
      .gte('ovr', 75)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(200)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .eq('game_mode', 'ol-classic')
      .not('build', 'is', null)
      .lt('ovr', 75)
      .order('ovr', { ascending: true })
      .order('wins', { ascending: true })
      .limit(20)
    Promise.all([bestQ, worstQ]).then(([best, worst]) => {
      if (best.data)  setOlBestBuilds(sortBySRatings(best.data))
      if (worst.data) setOlWorstBuilds(worst.data)
      setOlBuildsLoaded(true)
      setOlBuildsLoading(false)
    })
  }

  // ── Awards leaderboard ───────────────────────────────────────────────────────
  const loadAwards = () => {
    const modeKey = isOL ? 'ol' : isDB ? 'db' : isRB ? 'rb' : 'qb'
    if (awardsLoadedFor === modeKey || !supabase) return
    setAwardsLoading(true)
    // OL All-Pros have no counter on `accounts` — each one is a season_award
    // tag on a saved OL season, so count those per player.
    if (isOL) {
      supabase
        .from('simulations')
        .select('user_id, username')
        .eq('game_mode', 'ol-classic')
        .eq('season_award', 'allpro')
        .limit(5000)
        .then(({ data, error }) => {
          if (error) { console.error('[awards] all-pro query error:', error); setAwardsLoading(false); return }
          const byUid = new Map()
          for (const r of data ?? []) {
            if (!r.user_id) continue
            const u = byUid.get(r.user_id) ?? { uid: r.user_id, username: r.username || `Player_${r.user_id.slice(0, 5)}`, count: 0 }
            u.count++
            byUid.set(r.user_id, u)
          }
          setAwardsRows([...byUid.values()].sort((a, b) => b.count - a.count).slice(0, 50))
          setAlltimeAwardsRows([])
          setAwardsLoadedFor(modeKey)
          setAwardsLoading(false)
        })
      return
    }
    const classicCol = isDB ? 'classic_dpoys' : isRB ? 'classic_opoys' : 'classic_mvps'
    const alltimeCol = isDB ? 'alltime_dpoys' : isRB ? 'alltime_opoys' : 'alltime_mvps'
    const toRow = (r, col) => ({ uid: r.id, username: r.username || `Player_${r.id.slice(0, 5)}`, count: r[col] ?? 0 })
    const classicQ = supabase
      .from('accounts')
      .select(`id, username, ${classicCol}`)
      .gt(classicCol, 0)
      .order(classicCol, { ascending: false })
      .limit(50)
    const alltimeQ = supabase
      .from('accounts')
      .select(`id, username, ${alltimeCol}`)
      .gt(alltimeCol, 0)
      .order(alltimeCol, { ascending: false })
      .limit(50)
    Promise.all([classicQ, alltimeQ]).then(([classicRes, alltimeRes]) => {
      if (classicRes.error) { console.error('[awards] classic query error:', classicRes.error); setAwardsLoading(false); return }
      setAwardsRows((classicRes.data ?? []).map(r => toRow(r, classicCol)))
      if (alltimeRes.error) { console.error('[awards] alltime query error:', alltimeRes.error) }
      else setAlltimeAwardsRows((alltimeRes.data ?? []).map(r => toRow(r, alltimeCol)))
      setAwardsLoadedFor(modeKey)
      setAwardsLoading(false)
    })
  }

  const loadDaily = () => {
    if (dailyLoaded || !supabase) return
    setDailyLoading(true)
    const now = new Date()
    const etDate = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const isDST = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).format(now).includes('EDT')
    const todayStartISO = `${etDate}T${isDST ? '04' : '05'}:00:00.000Z`
    const classicMode = isOL ? 'ol-classic' : isDB ? 'db-classic' : isTE ? 'te-classic' : isWR ? 'wr-classic' : isRB ? 'rb-classic' : 'classic'
    ;(async () => {
      const { data } = await supabase
        .from('simulations')
        .select('user_id, username, wins, losses, champion')
        .gte('created_at', todayStartISO)
        .eq('game_mode', classicMode)
        .limit(2000)
      const byUid = new Map()
      for (const row of data ?? []) {
        if (!row.user_id) continue
        if (!byUid.has(row.user_id)) {
          byUid.set(row.user_id, {
            uid: row.user_id,
            username: row.username || `Player_${row.user_id.slice(0, 5)}`,
            wins: 0, losses: 0, rings: 0, count: 0,
          })
        }
        const u = byUid.get(row.user_id)
        u.wins += row.wins ?? 0
        u.losses += row.losses ?? 0
        if (row.champion) u.rings++
        u.count++
      }
      setDailyRows(Array.from(byUid.values()))
      setDailyLoaded(true)
      setDailyLoading(false)
    })()
  }

  const loadAllAwards = () => {
    if (allAwardsLoaded || !supabase) return
    setAllAwardsLoading(true)
    supabase
      .from('accounts')
      .select('id, username, classic_mvps, classic_opoys, classic_dpoys')
      .or('classic_mvps.gt.0,classic_opoys.gt.0,classic_dpoys.gt.0')
      .then(({ data, error }) => {
        if (error) { console.error('[all-awards] query error:', error); setAllAwardsLoading(false); return }
        const rows = (data ?? [])
          .map(r => ({ uid: r.id, username: r.username || `Player_${r.id.slice(0, 5)}`, count: (r.classic_mvps ?? 0) + (r.classic_opoys ?? 0) + (r.classic_dpoys ?? 0) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50)
        setAllAwardsRows(rows)
        setAllAwardsLoaded(true)
        setAllAwardsLoading(false)
      })
  }

  const loadAllDaily = () => {
    if (allDailyLoaded || !supabase) return
    setAllDailyLoading(true)
    const now = new Date()
    const etDate = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const isDST = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).format(now).includes('EDT')
    const todayStartISO = `${etDate}T${isDST ? '04' : '05'}:00:00.000Z`
    ;(async () => {
      const results = await Promise.all(ALL_MODES.map(mode => supabase
        .from('simulations')
        .select('user_id, username, wins, losses, champion, season_award')
        .gte('created_at', todayStartISO)
        .eq('game_mode', mode)
        .limit(2000)))
      const byUid = new Map()
      for (const { data } of results) {
        for (const row of data ?? []) {
          if (!row.user_id) continue
          if (!byUid.has(row.user_id)) {
            byUid.set(row.user_id, {
              uid: row.user_id,
              username: row.username || `Player_${row.user_id.slice(0, 5)}`,
              wins: 0, losses: 0, rings: 0, count: 0, mvps: 0,
            })
          }
          const u = byUid.get(row.user_id)
          u.wins += row.wins ?? 0
          u.losses += row.losses ?? 0
          if (row.champion) u.rings++
          // All-Pro is an honor, not a Player-of-the-Year award — kept out of
          // MVPs/POYs here the same way it's kept out of the lifetime total
          if (row.season_award && row.season_award !== 'allpro') u.mvps++
          u.count++
        }
      }
      setAllDailyRows(Array.from(byUid.values()))
      setAllDailyLoaded(true)
      setAllDailyLoading(false)
    })()
  }

  const isAwardsMetric = (isWR || isTE) ? false : isOL ? olMetric === 'allpros' : isDB ? dbMetric === 'dpoys' : isRB ? rbMetric === 'opoys' : metric === 'mvps'

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const switchBuildsTab = (tab) => { setBuildsTab(tab); setExpandedIdx(null) }
  const toggleExpand    = (i)   => setExpandedIdx(prev => prev === i ? null : i)

  // ── Derived QB lists ─────────────────────────────────────────────────────────
  const activeQBMetric = QB_METRICS.find(m => m.key === metric)
  const filteredQBRows = metric === 'avgOvr' || metric === 'winPct'
    ? rows.filter(r => r.count >= 10)
    : rows
  const sortedQB       = [...filteredQBRows].sort((a, b) => (b[metric] - a[metric]) || (b.wins - a.wins))
  const qbProfileSlots = Array.from({ length: 20 }, (_, i) => sortedQB[i] ?? null)

  const activeLegendMetric  = QB_METRICS.find(m => m.key === legendMetric)
  const filteredLegendRows  = legendMetric === 'avgOvr' || legendMetric === 'winPct'
    ? legendRows.filter(r => r.count >= 10)
    : legendRows
  const sortedLegend        = [...filteredLegendRows].sort((a, b) => (b[legendMetric] - a[legendMetric]) || (b.wins - a.wins))
  const legendSlots         = Array.from({ length: 20 }, (_, i) => sortedLegend[i] ?? null)

  const qbBuildsList  = buildsTab === 'best' ? bestBuilds : worstBuilds
  const qbBuildSlots  = Array.from({ length: buildsTab === 'best' ? 200 : 20 }, (_, i) => qbBuildsList[i] ?? null)

  // ── Derived RB lists ─────────────────────────────────────────────────────────
  const activeRBMetric  = RB_METRICS.find(m => m.key === rbMetric)
  const filteredRBRows  = rbMetric === 'avgOvr' || rbMetric === 'winPct'
    ? rbRows.filter(r => r.count >= 10)
    : rbRows
  const sortedRB        = [...filteredRBRows].sort((a, b) => (b[rbMetric] - a[rbMetric]) || (b.wins - a.wins))
  const rbProfileSlots  = Array.from({ length: 20 }, (_, i) => sortedRB[i] ?? null)

  const rbBuildsList  = buildsTab === 'best' ? rbBestBuilds : rbWorstBuilds
  const rbBuildSlots  = Array.from({ length: buildsTab === 'best' ? 200 : 20 }, (_, i) => rbBuildsList[i] ?? null)

  const filteredRBLegendRows = rbLegendMetric === 'avgOvr' || rbLegendMetric === 'winPct'
    ? rbLegendRows.filter(r => r.count >= 10)
    : rbLegendRows
  const sortedRBLegend   = [...filteredRBLegendRows].sort((a, b) => (b[rbLegendMetric] - a[rbLegendMetric]) || (b.wins - a.wins))
  const rbLegendSlots    = Array.from({ length: 20 }, (_, i) => sortedRBLegend[i] ?? null)

  const filteredWRLegendRows = wrLegendMetric === 'avgOvr' || wrLegendMetric === 'winPct'
    ? wrLegendRows.filter(r => r.count >= 10)
    : wrLegendRows
  const sortedWRLegend   = [...filteredWRLegendRows].sort((a, b) => (b[wrLegendMetric] - a[wrLegendMetric]) || (b.wins - a.wins))
  const wrLegendSlots    = Array.from({ length: 20 }, (_, i) => sortedWRLegend[i] ?? null)
  const filteredTELegendRows = teLegendMetric === 'avgOvr' || teLegendMetric === 'winPct'
    ? teLegendRows.filter(r => r.count >= 10)
    : teLegendRows
  const sortedTELegend   = [...filteredTELegendRows].sort((a, b) => (b[teLegendMetric] - a[teLegendMetric]) || (b.wins - a.wins))
  const teLegendSlots    = Array.from({ length: 20 }, (_, i) => sortedTELegend[i] ?? null)
  const filteredDBLegendRows = dbLegendMetric === 'avgOvr' || dbLegendMetric === 'winPct'
    ? dbLegendRows.filter(r => r.count >= 10)
    : dbLegendRows
  const sortedDBLegend   = [...filteredDBLegendRows].sort((a, b) => (b[dbLegendMetric] - a[dbLegendMetric]) || (b.wins - a.wins))
  const dbLegendSlots    = Array.from({ length: 20 }, (_, i) => sortedDBLegend[i] ?? null)

  // ── Derived ALL lists ────────────────────────────────────────────────────────
  const activeAllMetric = ALL_METRICS.find(m => m.key === allMetric)
  const filteredAllRows = allMetric === 'avgOvr'
    ? allRows.filter(r => r.count >= 20)
    : allRows
  const sortedAll       = [...filteredAllRows].sort((a, b) => (b[allMetric] - a[allMetric]) || (b.wins - a.wins))
  const allProfileSlots = Array.from({ length: 20 }, (_, i) => sortedAll[i] ?? null)
  const myAllEntry      = currentUser ? filteredAllRows.find(r => r.uid === currentUser.id) : null
  const myAllRank       = myAllEntry ? sortedAll.findIndex(r => r.uid === currentUser.id) + 1 : 0
  const myAllInTop20    = allProfileSlots.some(r => r?.uid === currentUser?.id)
  const isAllAwardsMetric = allMetric === 'mvps'

  // ── Derived WR lists ─────────────────────────────────────────────────────────
  const activeWRMetric  = WR_METRICS.find(m => m.key === wrMetric)
  const filteredWRRows  = wrMetric === 'avgOvr' || wrMetric === 'winPct'
    ? wrRows.filter(r => r.count >= 10)
    : wrRows
  const sortedWR        = [...filteredWRRows].sort((a, b) => (b[wrMetric] - a[wrMetric]) || (b.wins - a.wins))
  const wrProfileSlots  = Array.from({ length: 20 }, (_, i) => sortedWR[i] ?? null)

  const myWREntry   = currentUser ? filteredWRRows.find(r => r.uid === currentUser.id) : null
  const myWRRank    = myWREntry ? sortedWR.findIndex(r => r.uid === currentUser.id) + 1 : 0
  const myWRInTop20 = wrProfileSlots.some(r => r?.uid === currentUser?.id)

  const wrBuildsList  = buildsTab === 'best' ? wrBestBuilds : wrWorstBuilds
  const wrBuildSlots  = Array.from({ length: buildsTab === 'best' ? 200 : 20 }, (_, i) => wrBuildsList[i] ?? null)

  // ── Derived TE lists ──────────────────────────────────────────────────────────
  const activeTEMetric  = TE_METRICS.find(m => m.key === teMetric)
  const filteredTERows  = teMetric === 'avgOvr' || teMetric === 'winPct'
    ? teRows.filter(r => r.count >= 10)
    : teRows
  const sortedTE        = [...filteredTERows].sort((a, b) => (b[teMetric] - a[teMetric]) || (b.wins - a.wins))
  const teProfileSlots  = Array.from({ length: 20 }, (_, i) => sortedTE[i] ?? null)

  const myTEEntry   = currentUser ? filteredTERows.find(r => r.uid === currentUser.id) : null
  const myTERank    = myTEEntry ? sortedTE.findIndex(r => r.uid === currentUser.id) + 1 : 0
  const myTEInTop20 = teProfileSlots.some(r => r?.uid === currentUser?.id)

  const teBuildsList  = buildsTab === 'best' ? teBestBuilds : teWorstBuilds
  const teBuildSlots  = Array.from({ length: buildsTab === 'best' ? 200 : 20 }, (_, i) => teBuildsList[i] ?? null)

  // ── Derived DB lists ──────────────────────────────────────────────────────────
  const activeDBMetric  = DB_METRICS.find(m => m.key === dbMetric)
  const filteredDBRows  = dbMetric === 'avgOvr' || dbMetric === 'winPct'
    ? dbRows.filter(r => r.count >= 10)
    : dbRows
  const sortedDB        = [...filteredDBRows].sort((a, b) => (b[dbMetric] - a[dbMetric]) || (b.wins - a.wins))
  const dbProfileSlots  = Array.from({ length: 20 }, (_, i) => sortedDB[i] ?? null)

  const myDBEntry   = currentUser ? filteredDBRows.find(r => r.uid === currentUser.id) : null
  const myDBRank    = myDBEntry ? sortedDB.findIndex(r => r.uid === currentUser.id) + 1 : 0
  const myDBInTop20 = dbProfileSlots.some(r => r?.uid === currentUser?.id)

  const dbBuildsList  = buildsTab === 'best' ? dbBestBuilds : dbWorstBuilds
  const dbBuildSlots  = Array.from({ length: buildsTab === 'best' ? 200 : 20 }, (_, i) => dbBuildsList[i] ?? null)

  // ── Derived OL lists ──────────────────────────────────────────────────────────
  const activeOLMetric  = OL_METRICS.find(m => m.key === olMetric)
  const filteredOLRows  = olMetric === 'avgOvr' || olMetric === 'winPct'
    ? olRows.filter(r => r.count >= 10)
    : olRows
  const sortedOL        = [...filteredOLRows].sort((a, b) => (b[olMetric] - a[olMetric]) || (b.wins - a.wins))
  const olProfileSlots  = Array.from({ length: 20 }, (_, i) => sortedOL[i] ?? null)

  const myOLEntry   = currentUser ? filteredOLRows.find(r => r.uid === currentUser.id) : null
  const myOLRank    = myOLEntry ? sortedOL.findIndex(r => r.uid === currentUser.id) + 1 : 0
  const myOLInTop20 = olProfileSlots.some(r => r?.uid === currentUser?.id)

  const olBuildsList  = buildsTab === 'best' ? olBestBuilds : olWorstBuilds
  const olBuildSlots  = Array.from({ length: buildsTab === 'best' ? 200 : 20 }, (_, i) => olBuildsList[i] ?? null)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="lb-page">
      <div className="lb-col">

        <div className="lb-top-nav">
          <button className="prf-top-back" onClick={onBack}>← Back to Build</button>
        </div>

        {onPositionChange && (
          <div className="lb-main-seg lb-pos-switcher">
            <button
              className={`lb-main-seg-btn ${isAllView ? 'lb-main-seg-active' : ''}`}
              onClick={() => { if (!isAllView) { setIsAllView(true); setView('profiles') } }}
            >
              All
            </button>
            {[
              { pos: 'qb', label: 'QB', active: !isAllView && !isRB && !isWR && !isTE && !isDB && !isOL },
              { pos: 'rb', label: 'RB', active: !isAllView && isRB },
              { pos: 'wr', label: 'WR', active: !isAllView && isWR },
              { pos: 'te', label: 'TE', active: !isAllView && isTE },
              { pos: 'db', label: 'DB', active: !isAllView && isDB },
            ].map(({ pos, label, active }) => (
              <button
                key={pos}
                className={`lb-main-seg-btn ${active ? 'lb-main-seg-active' : ''}`}
                onClick={() => { setIsAllView(false); setView('profiles'); if (!active) onPositionChange(pos) }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isAllView ? (
          <div className="lb-main-seg">
            <button
              className={`lb-main-seg-btn ${view === 'profiles' ? 'lb-main-seg-active' : ''}`}
              onClick={() => { setView('profiles'); setExpandedIdx(null) }}
            >
              Profiles
            </button>
            <button
              className={`lb-main-seg-btn lb-main-seg-btn-daily ${view === 'daily' ? 'lb-main-seg-active-daily' : ''}`}
              onClick={() => { setView('daily'); loadAllDaily() }}
            >
              Daily
            </button>
          </div>
        ) : (
        <div className="lb-main-seg">
          <button
            className={`lb-main-seg-btn ${view === 'profiles' ? 'lb-main-seg-active' : ''}`}
            onClick={() => { setView('profiles'); setExpandedIdx(null) }}
          >
            Profiles
          </button>
          <button
            className={`lb-main-seg-btn ${view === 'builds' ? 'lb-main-seg-active' : ''}`}
            onClick={() => {
              setView('builds')
              setExpandedIdx(null)
              if (isOL) loadOLBuilds()
              else if (isDB) loadDBBuilds()
              else if (isTE) loadTEBuilds()
              else if (isWR) loadWRBuilds()
              else if (isRB) loadRBBuilds()
              else loadBuilds()
            }}
          >
            Builds
          </button>
          {!isRB && !isWR && !isTE && !isDB && !isOL && (
            <button
              className={`lb-main-seg-btn lb-main-seg-btn-legends ${view === 'legends' ? 'lb-main-seg-active-gold' : ''}`}
              onClick={() => { setView('legends'); loadLegends() }}
            >
              All-Time
            </button>
          )}
          {isRB && (
            <button
              className={`lb-main-seg-btn lb-main-seg-btn-legends ${view === 'rb-legends' ? 'lb-main-seg-active-gold' : ''}`}
              onClick={() => { setView('rb-legends'); loadRBLegends() }}
            >
              All-Time
            </button>
          )}
          {isWR && (
            <button
              className={`lb-main-seg-btn lb-main-seg-btn-legends ${view === 'wr-legends' ? 'lb-main-seg-active-gold' : ''}`}
              onClick={() => { setView('wr-legends'); loadWRLegends() }}
            >
              All-Time
            </button>
          )}
          {isTE && (
            <button
              className={`lb-main-seg-btn lb-main-seg-btn-legends ${view === 'te-legends' ? 'lb-main-seg-active-gold' : ''}`}
              onClick={() => { setView('te-legends'); loadTELegends() }}
            >
              All-Time
            </button>
          )}
          {isDB && (
            <button
              className={`lb-main-seg-btn lb-main-seg-btn-legends ${view === 'db-legends' ? 'lb-main-seg-active-gold' : ''}`}
              onClick={() => { setView('db-legends'); loadDBLegends() }}
            >
              All-Time
            </button>
          )}
          <button
            className={`lb-main-seg-btn lb-main-seg-btn-daily ${view === 'daily' ? 'lb-main-seg-active-daily' : ''}`}
            onClick={() => { setView('daily'); loadDaily() }}
          >
            Daily
          </button>
        </div>
        )}

        {/* ── ALL DAILY TAB ──────────────────────────────────────────────────── */}
        {isAllView && view === 'daily' && (() => {
          const DAILY_METRICS = [
            { key: 'rings', label: 'Rings' },
            { key: 'mvps',  label: 'MVPs/POYs' },
            { key: 'count', label: 'Seasons' },
          ]
          const sorted = [...allDailyRows].sort((a, b) => (b[allDailyMetric] - a[allDailyMetric]) || (b.wins - a.wins))
          const slots  = Array.from({ length: 20 }, (_, i) => sorted[i] ?? null)
          return (
            <>
              <div className="lb-header">
                <div className="lb-title lb-title-daily">Daily Leaderboard</div>
                <div className="lb-subtitle">All modes combined · resets midnight EST</div>
                <div className="lb-header-line lb-header-line-daily" />
              </div>
              <div className="lb-tabs-scroll">
                {DAILY_METRICS.map(m => (
                  <button
                    key={m.key}
                    className={`lb-tab lb-tab-daily ${allDailyMetric === m.key ? 'lb-tab-active lb-tab-active-daily' : ''}`}
                    onClick={() => setAllDailyMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {allDailyLoading ? (
                <LBSpinner />
              ) : allDailyRows.length === 0 ? (
                <div className="lb-loading lb-legends-empty">No sims today yet — be the first!</div>
              ) : (
                <div className="lb-list" key={allDailyMetric}>
                  {slots.map((row, i) =>
                    row ? (
                      <div
                        key={row.uid}
                        className={`lb-row lb-row-daily ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                        style={{ animationDelay: `${i * 35}ms` }}
                      >
                        <RankBadge rank={i + 1} />
                        <div className="lb-row-info">
                          <div className="lb-row-name">
                            {row.username}
                            {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                            {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                          </div>
                          <div className="lb-row-sub">
                            {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} sim{row.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="lb-row-val">{row[allDailyMetric]}</div>
                      </div>
                    ) : (
                      <div key={`empty-${i}`} className="lb-row lb-row-empty lb-row-daily" style={{ animationDelay: `${i * 35}ms` }}>
                        <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                        <div className="lb-row-info"><div className="lb-row-name lb-empty-name">——</div></div>
                        <div className="lb-row-val lb-empty-val">—</div>
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )
        })()}

        {/* ── DAILY TAB ──────────────────────────────────────────────────────── */}
        {!isAllView && view === 'daily' && (() => {
          const DAILY_METRICS = [
            { key: 'rings', label: 'Rings' },
            { key: 'wins',  label: 'Wins' },
          ]
          const sorted = [...dailyRows].sort((a, b) => (b[dailyMetric] - a[dailyMetric]) || (b.wins - a.wins))
          const slots  = Array.from({ length: 20 }, (_, i) => sorted[i] ?? null)
          return (
            <>
              <div className="lb-header">
                <div className="lb-title lb-title-daily">Daily Leaderboard</div>
                <div className="lb-subtitle">{isOL ? 'OL current · resets midnight EST' : isDB ? 'DB current · resets midnight EST' : isTE ? 'TE current · resets midnight EST' : isWR ? 'WR current · resets midnight EST' : isRB ? 'RB current · resets midnight EST' : 'QB current · resets midnight EST'}</div>
                <div className="lb-header-line lb-header-line-daily" />
              </div>
              <div className="lb-tabs-scroll">
                {DAILY_METRICS.map(m => (
                  <button
                    key={m.key}
                    className={`lb-tab lb-tab-daily ${dailyMetric === m.key ? 'lb-tab-active lb-tab-active-daily' : ''}`}
                    onClick={() => setDailyMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {dailyLoading ? (
                <LBSpinner />
              ) : dailyRows.length === 0 ? (
                <div className="lb-loading lb-legends-empty">No sims today yet — be the first!</div>
              ) : (
                <div className="lb-list" key={dailyMetric}>
                  {slots.map((row, i) =>
                    row ? (
                      <div
                        key={row.uid}
                        className={`lb-row lb-row-daily ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                        style={{ animationDelay: `${i * 35}ms` }}
                      >
                        <RankBadge rank={i + 1} />
                        <div className="lb-row-info">
                          <div className="lb-row-name">
                            {row.username}
                            {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                            {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                          </div>
                          <div className="lb-row-sub">
                            {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} sim{row.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="lb-row-val">{row[dailyMetric]}</div>
                      </div>
                    ) : (
                      <div key={`empty-${i}`} className="lb-row lb-row-empty lb-row-daily" style={{ animationDelay: `${i * 35}ms` }}>
                        <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                        <div className="lb-row-info"><div className="lb-row-name lb-empty-name">——</div></div>
                        <div className="lb-row-val lb-empty-val">—</div>
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )
        })()}

        {/* ── PROFILES ────────────────────────────────────────────────────────── */}
        {isAllView && view === 'profiles' && (
          <>
            <div className="lb-header">
              <div className="lb-title">All-Mode Leaderboard</div>
              <div className="lb-subtitle">QB + RB + WR + TE + DB + OL combined · career stats · all players ranked</div>
              <div className="lb-header-line" />
            </div>

            <div className="lb-tabs-scroll">
              {ALL_METRICS.map(m => (
                <button
                  key={m.key}
                  className={`lb-tab ${allMetric === m.key ? 'lb-tab-active' : ''}`}
                  onClick={() => { setAllMetric(m.key); if (m.awards) loadAllAwards() }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {allMetric === 'avgOvr' && (
              <div className="lb-winpct-note">Min. 20 seasons required</div>
            )}

            {isAllAwardsMetric ? (
              allAwardsLoading ? (
                <LBSpinner />
              ) : allAwardsRows.length === 0 ? (
                <div className="lb-loading lb-legends-empty">No MVP/OPOY/DPOY awards yet.</div>
              ) : (
                <div className="lb-list" key="all-mvps">
                  {allAwardsRows.map((row, i) => {
                    // accounts.username is stored lowercase (a Supabase-side trigger
                    // issue) — leaderboard_user_stats keeps the real casing, so prefer
                    // that whenever this user has a matching row there.
                    const c = allRows.find(r => r.uid === row.uid)
                    return (
                    <div
                      key={row.uid}
                      className={`lb-row ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                      style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}
                    >
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {c?.username || row.username}
                          {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        {c ? <div className="lb-row-sub">{c.wins}W · {c.losses}L · {c.rings} ring{c.rings !== 1 ? 's' : ''} · {c.count} season{c.count !== 1 ? 's' : ''}</div> : null}
                      </div>
                      <div className="lb-row-val">{row.count}</div>
                    </div>
                    )
                  })}
                </div>
              )
            ) : allLoading ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={allMetric}>
                {allProfileSlots.map((row, i) =>
                  row ? (
                    <div
                      key={row.uid}
                      className={`lb-row ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {row.username}
                          {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} season{row.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">
                        {activeAllMetric.fmt(row[allMetric])}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="lb-row lb-row-empty" style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name lb-empty-name">——</div>
                      </div>
                      <div className="lb-row-val lb-empty-val">—</div>
                    </div>
                  )
                )}
                {myAllEntry && !myAllInTop20 && (
                  <>
                    <div className="lb-you-sep">YOUR RANK · #{myAllRank}</div>
                    <div className="lb-row lb-row-me">
                      <RankBadge rank={myAllRank} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {myAllEntry.username}
                          {plusUids.has(myAllEntry.uid) && <span className="lb-plus-badge">+</span>}
                          <span className="lb-you">you</span>
                        </div>
                        <div className="lb-row-sub">
                          {myAllEntry.wins}W · {myAllEntry.losses}L · {myAllEntry.rings} ring{myAllEntry.rings !== 1 ? 's' : ''} · {myAllEntry.count} season{myAllEntry.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">{activeAllMetric.fmt(myAllEntry[allMetric])}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {!isAllView && view === 'profiles' && (
          <>
            <div className="lb-header">
              <div className="lb-title">{isOL ? 'OL Leaderboard' : isDB ? 'DB Leaderboard' : isTE ? 'TE Leaderboard' : isWR ? 'WR Leaderboard' : isRB ? 'RB Leaderboard' : 'Leaderboard'}</div>
              <div className="lb-subtitle">
                {isOL ? 'OL mode · career stats · all players ranked' : isDB ? 'DB mode · career stats · all players ranked' : isTE ? 'TE mode · career stats · all players ranked' : isWR ? 'WR mode · career stats · all players ranked' : isRB ? 'RB mode · career stats · all players ranked' : 'Career stats · all players ranked'}
              </div>
              <div className={`lb-header-line${(isDB || isOL) ? ' lb-header-line-wr' : isTE ? ' lb-header-line-wr' : isWR ? ' lb-header-line-wr' : isRB ? ' lb-header-line-rb' : ''}`} />
            </div>

            <div className="lb-tabs-scroll">
              {(isOL ? OL_METRICS : isDB ? DB_METRICS : isTE ? TE_METRICS : isWR ? WR_METRICS : isRB ? RB_METRICS : QB_METRICS).map(m => (
                <button
                  key={m.key}
                  className={`lb-tab${(isWR || isTE || isDB || isOL) ? ' lb-tab-wr' : isRB ? ' lb-tab-rb' : ''} ${(isOL ? olMetric : isDB ? dbMetric : isTE ? teMetric : isWR ? wrMetric : isRB ? rbMetric : metric) === m.key ? `lb-tab-active${(isWR || isTE || isDB || isOL) ? ' lb-tab-active-wr' : isRB ? ' lb-tab-active-rb' : ''}` : ''}`}
                  onClick={() => { if (isOL) setOlMetric(m.key); else if (isDB) setDbMetric(m.key); else if (isTE) setTeMetric(m.key); else if (isWR) setWrMetric(m.key); else if (isRB) setRbMetric(m.key); else setMetric(m.key); if (m.awards) loadAwards() }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {(['winPct', 'avgOvr'].includes(isOL ? olMetric : isDB ? dbMetric : isTE ? teMetric : isWR ? wrMetric : isRB ? rbMetric : metric)) && (
              <div className="lb-winpct-note">Min. 10 seasons required</div>
            )}

            {isAwardsMetric ? (
              awardsLoading ? (
                <LBSpinner />
              ) : awardsRows.length === 0 ? (
              <div className="lb-loading lb-legends-empty">No {isOL ? 'All-Pro' : isDB ? 'DPOY' : isRB ? 'OPOY' : 'MVP'} awards yet.</div>
            ) : (
              <div className="lb-list" key={isOL ? 'allpros' : isDB ? 'dpoys' : isRB ? 'opoys' : 'mvps'}>
                {awardsRows.map((row, i) => {
                  // accounts.username is stored lowercase (a Supabase-side trigger
                  // issue) — leaderboard_user_stats keeps the real casing, so prefer
                  // that whenever this user has a matching row there.
                  const c = (isOL ? olRows : isDB ? dbRows : isRB ? rbRows : rows).find(r => r.uid === row.uid)
                  return (
                  <div
                    key={row.uid}
                    className={`lb-row${(isDB || isOL) ? ' lb-row-wr' : isRB ? ' lb-row-rb' : ''} ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                    style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}
                  >
                    <RankBadge rank={i + 1} />
                    <div className="lb-row-info">
                      <div className="lb-row-name">
                        {c?.username || row.username}
                        {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                        {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                      </div>
                      {c ? <div className="lb-row-sub">{c.wins}W · {c.losses}L · {c.rings} ring{c.rings !== 1 ? 's' : ''} · {c.count} season{c.count !== 1 ? 's' : ''}</div> : null}
                    </div>
                    <div className="lb-row-val">{row.count}</div>
                  </div>
                  )
                })}
              </div>
            )
            ) : (isOL ? olLoading : isDB ? dbLoading : isTE ? teLoading : isWR ? wrLoading : isRB ? rbLoading : loading) ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={isOL ? olMetric : isDB ? dbMetric : isTE ? teMetric : isWR ? wrMetric : isRB ? rbMetric : metric}>
                {(isOL ? olProfileSlots : isDB ? dbProfileSlots : isTE ? teProfileSlots : isWR ? wrProfileSlots : isRB ? rbProfileSlots : qbProfileSlots).map((row, i) =>
                  row ? (
                    <div
                      key={row.uid}
                      className={`lb-row${(isWR || isTE || isDB || isOL) ? ' lb-row-wr' : isRB ? ' lb-row-rb' : ''} ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {row.username}
                          {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} season{row.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">
                        {isOL ? activeOLMetric.fmt(row[olMetric]) : isDB ? activeDBMetric.fmt(row[dbMetric]) : isTE ? activeTEMetric.fmt(row[teMetric]) : isWR ? activeWRMetric.fmt(row[wrMetric]) : isRB ? activeRBMetric.fmt(row[rbMetric]) : activeQBMetric.fmt(row[metric])}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className={`lb-row lb-row-empty${(isWR || isTE || isDB || isOL) ? ' lb-row-wr' : isRB ? ' lb-row-rb' : ''}`} style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name lb-empty-name">——</div>
                      </div>
                      <div className="lb-row-val lb-empty-val">—</div>
                    </div>
                  )
                )}
                {isWR && myWREntry && !myWRInTop20 && (
                  <>
                    <div className="lb-you-sep">YOUR RANK · #{myWRRank}</div>
                    <div className="lb-row lb-row-wr lb-row-me">
                      <RankBadge rank={myWRRank} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {myWREntry.username}
                          {plusUids.has(myWREntry.uid) && <span className="lb-plus-badge">+</span>}
                          <span className="lb-you">you</span>
                        </div>
                        <div className="lb-row-sub">
                          {myWREntry.wins}W · {myWREntry.losses}L · {myWREntry.rings} ring{myWREntry.rings !== 1 ? 's' : ''} · {myWREntry.count} season{myWREntry.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">{activeWRMetric.fmt(myWREntry[wrMetric])}</div>
                    </div>
                  </>
                )}
                {isTE && myTEEntry && !myTEInTop20 && (
                  <>
                    <div className="lb-you-sep">YOUR RANK · #{myTERank}</div>
                    <div className="lb-row lb-row-wr lb-row-me">
                      <RankBadge rank={myTERank} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {myTEEntry.username}
                          {plusUids.has(myTEEntry.uid) && <span className="lb-plus-badge">+</span>}
                          <span className="lb-you">you</span>
                        </div>
                        <div className="lb-row-sub">
                          {myTEEntry.wins}W · {myTEEntry.losses}L · {myTEEntry.rings} ring{myTEEntry.rings !== 1 ? 's' : ''} · {myTEEntry.count} season{myTEEntry.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">{activeTEMetric.fmt(myTEEntry[teMetric])}</div>
                    </div>
                  </>
                )}
                {isDB && myDBEntry && !myDBInTop20 && (
                  <>
                    <div className="lb-you-sep">YOUR RANK · #{myDBRank}</div>
                    <div className="lb-row lb-row-wr lb-row-me">
                      <RankBadge rank={myDBRank} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {myDBEntry.username}
                          {plusUids.has(myDBEntry.uid) && <span className="lb-plus-badge">+</span>}
                          <span className="lb-you">you</span>
                        </div>
                        <div className="lb-row-sub">
                          {myDBEntry.wins}W · {myDBEntry.losses}L · {myDBEntry.rings} ring{myDBEntry.rings !== 1 ? 's' : ''} · {myDBEntry.count} season{myDBEntry.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">{activeDBMetric.fmt(myDBEntry[dbMetric])}</div>
                    </div>
                  </>
                )}
                {isOL && myOLEntry && !myOLInTop20 && (
                  <>
                    <div className="lb-you-sep">YOUR RANK · #{myOLRank}</div>
                    <div className="lb-row lb-row-wr lb-row-me">
                      <RankBadge rank={myOLRank} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {myOLEntry.username}
                          {plusUids.has(myOLEntry.uid) && <span className="lb-plus-badge">+</span>}
                          <span className="lb-you">you</span>
                        </div>
                        <div className="lb-row-sub">
                          {myOLEntry.wins}W · {myOLEntry.losses}L · {myOLEntry.rings} ring{myOLEntry.rings !== 1 ? 's' : ''} · {myOLEntry.count} season{myOLEntry.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">{activeOLMetric.fmt(myOLEntry[olMetric])}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── BUILDS ──────────────────────────────────────────────────────────── */}
        {view === 'builds' && (
          <>
            <div className="lb-header">
              <div className="lb-title">{isOL ? 'OL Builds' : isDB ? 'DB Builds' : isTE ? 'TE Builds' : isWR ? 'WR Builds' : isRB ? 'RB Builds' : 'Builds'}</div>
              <div className="lb-subtitle">{isOL ? 'OL mode · best and worst builds' : isDB ? 'DB mode · best and worst builds' : isTE ? 'TE mode · best and worst builds' : isWR ? 'WR mode · best and worst builds' : isRB ? 'RB mode · best and worst builds' : 'Best and worst builds'}</div>
              <div className={`lb-header-line${(isWR || isTE || isDB || isOL) ? ' lb-header-line-wr' : isRB ? ' lb-header-line-rb' : ''}`} />
            </div>

            <div className="lb-tabs-scroll">
              <button
                className={`lb-tab${(isWR || isTE || isDB || isOL) ? ' lb-tab-wr' : isRB ? ' lb-tab-rb' : ''} ${buildsTab === 'best' ? `lb-tab-active${(isWR || isTE || isDB || isOL) ? ' lb-tab-active-wr' : isRB ? ' lb-tab-active-rb' : ''}` : ''}`}
                onClick={() => switchBuildsTab('best')}
              >
                Best
              </button>
              <button
                className={`lb-tab${(isWR || isTE || isDB || isOL) ? ' lb-tab-wr' : isRB ? ' lb-tab-rb' : ''} ${buildsTab === 'worst' ? `lb-tab-active${(isWR || isTE || isDB || isOL) ? ' lb-tab-active-wr' : isRB ? ' lb-tab-active-rb' : ''}` : ''}`}
                onClick={() => switchBuildsTab('worst')}
              >
                Worst
              </button>
            </div>

            {(isOL ? olBuildsLoading : isDB ? dbBuildsLoading : isTE ? teBuildsLoading : isWR ? wrBuildsLoading : isRB ? rbBuildsLoading : buildsLoading) ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={`${isOL ? 'ol-' : isDB ? 'db-' : isTE ? 'te-' : isWR ? 'wr-' : isRB ? 'rb-' : ''}builds-${buildsTab}`}>
                {(isOL ? olBuildSlots : isDB ? dbBuildSlots : isTE ? teBuildSlots : isWR ? wrBuildSlots : isRB ? rbBuildSlots : qbBuildSlots).map((row, i) =>
                  row ? (
                    <div key={i} className="lb-expand-wrap" style={{ animationDelay: `${i * 35}ms` }}>
                      <div
                        className={`lb-row lb-row-clickable ${expandedIdx === i ? 'lb-row-expanded' : ''}`}
                        onClick={() => toggleExpand(i)}
                      >
                        <RankBadge rank={i + 1} />
                        <div className="lb-row-info">
                          <div className="lb-row-name">{row.username || '—'}</div>
                          <div className="lb-row-sub">{row.wins}W · {row.losses}L</div>
                        </div>
                        <div className="lb-row-ovr">
                          <span className="lb-ovr-lbl">OVR</span>
                          <span className="lb-row-val" style={{ color: ovrColor(row.ovr) }}>{row.ovr}</span>
                        </div>
                        <ChevronIcon open={expandedIdx === i} />
                      </div>
                      {expandedIdx === i && (
                        <div className="lb-build-expand">
                          <BuildExpand
                            build={row.build || {}}
                            types={isOL ? OL_TYPES : isDB ? DB_TYPES : isTE ? TE_TYPES : isWR ? WR_TYPES : isRB ? RB_TYPES : TYPES}
                            attrMap={isOL ? OL_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : ATTR}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="lb-row lb-row-empty" style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name lb-empty-name">——</div>
                      </div>
                      <div className="lb-row-val lb-empty-val">—</div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}

        {/* ── ALL-TIME (QB only) ───────────────────────────────────────────────── */}
        {!isRB && view === 'legends' && (
          <>
            <div className="lb-header">
              <div className="lb-title lb-title-legends">All-Time Leaderboard</div>
              <div className="lb-subtitle">All-Time mode · career stats · all players ranked</div>
              <div className="lb-header-line lb-header-line-legends" />
            </div>

            <div className="lb-tabs-scroll">
              {QB_METRICS.map(m => (
                <button
                  key={m.key}
                  className={`lb-tab lb-tab-legends ${legendMetric === m.key ? 'lb-tab-active lb-tab-active-legends' : ''}`}
                  onClick={() => { setLegendMetric(m.key); if (m.awards) loadAwards() }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {['winPct', 'avgOvr'].includes(legendMetric) && (
              <div className="lb-winpct-note">Min. 10 seasons required</div>
            )}

            {legendMetric === 'mvps' ? (
              awardsLoading ? <LBSpinner /> :
              alltimeAwardsRows.length === 0 ? (
                <div className="lb-loading lb-legends-empty">No All-Time MVP awards yet.</div>
              ) : (
                <div className="lb-list" key="legend-mvps">
                  {alltimeAwardsRows.map((row, i) => {
                    const career = legendRows.find(r => r.uid === row.uid)
                    return (
                      <div
                        key={row.uid}
                        className={`lb-row lb-row-legends ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                        style={{ animationDelay: `${i * 35}ms` }}
                      >
                        <RankBadge rank={i + 1} />
                        <div className="lb-row-info">
                          <div className="lb-row-name">
                            {career?.username || row.username}
                            {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                          </div>
                          {career && (
                            <div className="lb-row-sub">
                              {career.wins}W · {career.losses}L · {career.rings} ring{career.rings !== 1 ? 's' : ''} · {career.count} season{career.count !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        <div className="lb-row-val">{row.count}</div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : legendLoading ? (
              <LBSpinner />
            ) : legendRows.length === 0 ? (
              <div className="lb-loading lb-legends-empty">No All-Time games played yet.</div>
            ) : (
              <div className="lb-list" key={legendMetric}>
                {legendSlots.map((row, i) =>
                  row ? (
                    <div
                      key={row.uid}
                      className={`lb-row lb-row-legends ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {row.username}
                          {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} season{row.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">{activeLegendMetric.fmt(row[legendMetric])}</div>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="lb-row lb-row-empty lb-row-legends" style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name lb-empty-name">——</div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}

        {/* ── ALL-TIME RB ──────────────────────────────────────────────────────── */}
        {isWR && view === 'wr-legends' && (
          <>
            <div className="lb-header">
              <div className="lb-title lb-title-wr">WR All-Time Leaderboard</div>
              <div className="lb-subtitle">All-Time WR mode · career stats · all players ranked</div>
              <div className="lb-header-line lb-header-line-wr" />
            </div>

            <div className="lb-tabs-scroll">
              {WR_METRICS.map(m => (
                <button
                  key={m.key}
                  className={`lb-tab lb-tab-wr lb-tab-legends ${wrLegendMetric === m.key ? 'lb-tab-active lb-tab-active-wr' : ''}`}
                  onClick={() => setWrLegendMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {['winPct', 'avgOvr'].includes(wrLegendMetric) && (
              <div className="lb-winpct-note">Min. 10 seasons required</div>
            )}

            {wrLegendLoading ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={wrLegendMetric}>
                {wrLegendSlots.map((row, i) =>
                  row ? (
                    <div
                      key={row.uid}
                      className={`lb-row lb-row-wr lb-row-legends ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {row.username}
                          {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} season{row.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">
                        {WR_METRICS.find(m => m.key === wrLegendMetric)?.fmt(row[wrLegendMetric]) ?? row[wrLegendMetric]}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="lb-row lb-row-empty lb-row-wr" style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name lb-empty-name">——</div>
                      </div>
                      <div className="lb-row-val lb-empty-val">—</div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}

        {/* ── ALL-TIME TE ──────────────────────────────────────────────────────── */}
        {isTE && view === 'te-legends' && (
          <>
            <div className="lb-header">
              <div className="lb-title lb-title-wr">TE All-Time Leaderboard</div>
              <div className="lb-subtitle">All-Time TE mode · career stats · all players ranked</div>
              <div className="lb-header-line lb-header-line-wr" />
            </div>

            <div className="lb-tabs-scroll">
              {TE_METRICS.map(m => (
                <button
                  key={m.key}
                  className={`lb-tab lb-tab-wr lb-tab-legends ${teLegendMetric === m.key ? 'lb-tab-active lb-tab-active-wr' : ''}`}
                  onClick={() => setTeLegendMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {['winPct', 'avgOvr'].includes(teLegendMetric) && (
              <div className="lb-winpct-note">Min. 10 seasons required</div>
            )}

            {teLegendLoading ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={teLegendMetric}>
                {teLegendSlots.map((row, i) =>
                  row ? (
                    <div
                      key={row.uid}
                      className={`lb-row lb-row-wr lb-row-legends ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {row.username}
                          {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} season{row.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">
                        {TE_METRICS.find(m => m.key === teLegendMetric)?.fmt(row[teLegendMetric]) ?? row[teLegendMetric]}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="lb-row lb-row-empty lb-row-wr" style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name lb-empty-name">——</div>
                      </div>
                      <div className="lb-row-val lb-empty-val">—</div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}

        {isDB && view === 'db-legends' && (
          <>
            <div className="lb-header">
              <div className="lb-title lb-title-wr">DB All-Time Leaderboard</div>
              <div className="lb-subtitle">All-Time DB mode · career stats · all players ranked</div>
              <div className="lb-header-line lb-header-line-wr" />
            </div>

            <div className="lb-tabs-scroll">
              {DB_METRICS.map(m => (
                <button
                  key={m.key}
                  className={`lb-tab lb-tab-wr lb-tab-legends ${dbLegendMetric === m.key ? 'lb-tab-active lb-tab-active-wr' : ''}`}
                  onClick={() => setDbLegendMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {['winPct', 'avgOvr'].includes(dbLegendMetric) && (
              <div className="lb-winpct-note">Min. 10 seasons required</div>
            )}

            {dbLegendLoading ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={dbLegendMetric}>
                {dbLegendSlots.map((row, i) =>
                  row ? (
                    <div
                      key={row.uid}
                      className={`lb-row lb-row-wr lb-row-legends ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {row.username}
                          {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} season{row.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">
                        {DB_METRICS.find(m => m.key === dbLegendMetric)?.fmt(row[dbLegendMetric]) ?? row[dbLegendMetric]}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="lb-row lb-row-empty lb-row-wr" style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name lb-empty-name">——</div>
                      </div>
                      <div className="lb-row-val lb-empty-val">—</div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}

        {isRB && view === 'rb-legends' && (
          <>
            <div className="lb-header">
              <div className="lb-title lb-title-legends">RB All-Time Leaderboard</div>
              <div className="lb-subtitle">All-Time RB mode · career stats · all players ranked</div>
              <div className="lb-header-line lb-header-line-rb" />
            </div>

            <div className="lb-tabs-scroll">
              {RB_METRICS.map(m => (
                <button
                  key={m.key}
                  className={`lb-tab lb-tab-rb lb-tab-legends ${rbLegendMetric === m.key ? 'lb-tab-active lb-tab-active-rb' : ''}`}
                  onClick={() => { setRbLegendMetric(m.key); if (m.awards) loadAwards() }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {['winPct', 'avgOvr'].includes(rbLegendMetric) && (
              <div className="lb-winpct-note">Min. 10 seasons required</div>
            )}

            {rbLegendMetric === 'opoys' ? (
              awardsLoading ? <LBSpinner /> : (
                <div className="lb-list" key="rb-legend-opoys">
                  {Array.from({ length: 20 }, (_, i) => alltimeAwardsRows[i] ?? null).map((row, i) =>
                    row ? (() => {
                      const career = rbLegendRows.find(r => r.uid === row.uid)
                      return (
                        <div
                          key={row.uid}
                          className={`lb-row lb-row-rb lb-row-legends ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                          style={{ animationDelay: `${i * 35}ms` }}
                        >
                          <RankBadge rank={i + 1} />
                          <div className="lb-row-info">
                            <div className="lb-row-name">
                              {career?.username || row.username}
                              {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                            </div>
                            {career && (
                              <div className="lb-row-sub">
                                {career.wins}W · {career.losses}L · {career.rings} ring{career.rings !== 1 ? 's' : ''} · {career.count} season{career.count !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <div className="lb-row-val">{row.count}</div>
                        </div>
                      )
                    })() : (
                      <div key={`empty-${i}`} className="lb-row lb-row-empty lb-row-rb lb-row-legends" style={{ animationDelay: `${i * 35}ms` }}>
                        <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                        <div className="lb-row-info"><div className="lb-row-name lb-empty-name">——</div></div>
                        <div className="lb-row-val lb-empty-val">—</div>
                      </div>
                    )
                  )}
                </div>
              )
            ) : rbLegendLoading ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={rbLegendMetric}>
                {rbLegendSlots.map((row, i) =>
                  row ? (
                    <div
                      key={row.uid}
                      className={`lb-row lb-row-rb lb-row-legends ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {row.username}
                          {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} season{row.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">
                        {RB_METRICS.find(m => m.key === rbLegendMetric)?.fmt(row[rbLegendMetric]) ?? row[rbLegendMetric]}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="lb-row lb-row-empty lb-row-rb" style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name lb-empty-name">——</div>
                      </div>
                      <div className="lb-row-val lb-empty-val">—</div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}


      </div>
    </div>
  )
}
