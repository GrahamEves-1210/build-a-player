import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ATTR, TEAMS, TYPES } from '../data/qbs'
import { RB_TYPES } from '../data/rbs'
import { valToGrade } from '../utils/simulation'
import QBAvatar from './QBAvatar'
import HEADSHOTS from '../data/headshots.json'

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

const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, t.color]))
const QB_PHOTO   = (name) => HEADSHOTS[name] ? `/headshots/${HEADSHOTS[name]}.jpg` : null

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

function BuildExpand({ build, types = TYPES }) {
  const slots = types.filter(k => build[k])
  if (slots.length === 0) return <div className="lb-expand-empty">Build data unavailable</div>
  return (
    <div className="simp-attr-table lb-attr-table">
      {slots.map(k => {
        const data = build[k]
        const meta = ATTR[k]
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

export default function LeaderboardPage({ onBack, currentUser, adsDisabled = false, isRB = false }) {
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

  const [plusUids, setPlusUids] = useState(new Set())

  // ── Daily state ──────────────────────────────────────────────────────────────
  const [showDaily, setShowDaily]       = useState(false)
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

  // ── Shared UI state ──────────────────────────────────────────────────────────
  const [view, setView]           = useState('profiles')
  const [buildsTab, setBuildsTab] = useState('best')
  const [expandedIdx, setExpandedIdx] = useState(null)
  const adInvokedRef = useRef(false)

  useEffect(() => {
    if (adInvokedRef.current || adsDisabled) return
    adInvokedRef.current = true
    window.ramp?.que?.push(() => {
      window.ramp.spaAddAds([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-lb' }])
    })
  }, [])

  // ── QB profiles (classic) ────────────────────────────────────────────────────
  useEffect(() => {
    if (isRB || !supabase) { setLoading(false); return }
    ;(async () => {
      const { data } = await supabase.rpc('get_qb_leaderboard')
      const compiled = (data ?? []).map(u => {
        const wins = Number(u.wins)
        const losses = Number(u.losses)
        const count = Number(u.count)
        const totalOvr = Number(u.total_ovr)
        const games = wins + losses
        return {
          uid: u.uid,
          username: u.username || `Player_${u.uid.slice(0, 5)}`,
          wins,
          losses,
          rings: Number(u.rings),
          count,
          totalOvr,
          yds: Number(u.yds),
          tds: Number(u.tds),
          avgOvr: count > 0 ? +(totalOvr / count).toFixed(1) : 0,
          winPct: games > 0 ? +((wins / games) * 100).toFixed(1) : 0,
          winPctWeighted: games > 0 ? (wins + 17) / (games + 34) * 100 : 0,
        }
      })
      setRows(compiled)
      setLoading(false)
      const uids = compiled.map(r => r.uid)
      supabase.from('accounts').select('id').in('id', uids)
        .or('ads_disabled.eq.true,subscription_status.eq.active')
        .then(({ data: pd }) => { if (pd) setPlusUids(prev => new Set([...prev, ...pd.map(a => a.id)])) })
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── QB builds ───────────────────────────────────────────────────────────────
  const loadBuilds = () => {
    if (buildsLoaded || !supabase) return
    setBuildsLoading(true)
    const bestQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .not('game_mode', 'in', '("all-time","lite","legends")')
      .not('build', 'is', null)
      .gte('ovr', 80)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(200)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .not('game_mode', 'in', '("all-time","lite","legends")')
      .not('build', 'is', null)
      .lt('ovr', 80)
      .order('ovr', { ascending: true })
      .order('wins', { ascending: true })
      .limit(20)
    Promise.all([bestQ, worstQ]).then(([best, worst]) => {
      if (best.data)  setBestBuilds(best.data)
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
    const PAGE = 1000
    ;(async () => {
      const { count } = await supabase.from('simulations')
        .select('*', { count: 'exact', head: true })
        .or('game_mode.eq.all-time,game_mode.eq.legends')
      const pages = Math.ceil((count ?? PAGE) / PAGE)
      const mkQ = () => supabase.from('simulations')
        .select('user_id, username, wins, losses, champion, playoffs, ovr, season_pass_yds, season_tds')
        .or('game_mode.eq.all-time,game_mode.eq.legends')
        .order('id', { ascending: true })
      const results = await Promise.all(
        Array.from({ length: pages }, (_, i) =>
          mkQ().range(i * PAGE, i * PAGE + PAGE - 1).then(r => r.data ?? [])
        )
      )
      const byUid = new Map()
      for (const row of results.flat()) {
        if (!row.user_id) continue
        if (!byUid.has(row.user_id)) {
          byUid.set(row.user_id, {
            uid: row.user_id,
            username: row.username || `Player_${row.user_id.slice(0, 5)}`,
            wins: 0, losses: 0, rings: 0, playoffApps: 0, count: 0, totalOvr: 0, yds: 0, tds: 0,
          })
        }
        const u = byUid.get(row.user_id)
        u.wins    += row.wins ?? 0
        u.losses  += row.losses ?? 0
        u.yds     += row.season_pass_yds ?? 0
        u.tds     += row.season_tds ?? 0
        if (row.champion) u.rings++
        if (row.playoffs) u.playoffApps++
        u.count++
        u.totalOvr += row.ovr ?? 0
        if (!u.username && row.username) u.username = row.username
      }
      const compiled = Array.from(byUid.values()).map(u => ({
        ...u,
        avgOvr: u.count > 0 ? +(u.totalOvr / u.count).toFixed(1) : 0,
        winPct: (u.wins + u.losses) > 0 ? +((u.wins / (u.wins + u.losses)) * 100).toFixed(1) : 0,
        winPctWeighted: (u.wins + u.losses) > 0 ? (u.wins + 17) / (u.wins + u.losses + 34) * 100 : 0,
      }))
      setLegendRows(compiled)
      setLegendLoaded(true)
      setLegendLoading(false)
    })()
  }

  // ── RB profiles ──────────────────────────────────────────────────────────────
  useEffect(() => { if (isRB) loadRB() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRB = () => {
    if (rbLoaded || !supabase) return
    setRbLoading(true)
    const PAGE = 1000
    ;(async () => {
      const { count } = await supabase.from('simulations')
        .select('*', { count: 'exact', head: true })
        .ilike('game_mode', 'rb-%')
      const pages = Math.ceil((count ?? PAGE) / PAGE)
      const mkQ = () => supabase.from('simulations')
        .select('user_id, username, wins, losses, champion, playoffs, ovr, season_pass_yds, season_tds')
        .ilike('game_mode', 'rb-%')
        .order('id', { ascending: true })
      const results = await Promise.all(
        Array.from({ length: pages }, (_, i) =>
          mkQ().range(i * PAGE, i * PAGE + PAGE - 1).then(r => r.data ?? [])
        )
      )
      const byUid = new Map()
      for (const row of results.flat()) {
        if (!row.user_id) continue
        if (!byUid.has(row.user_id)) {
          byUid.set(row.user_id, {
            uid: row.user_id,
            username: row.username || `Player_${row.user_id.slice(0, 5)}`,
            wins: 0, losses: 0, rings: 0, playoffApps: 0, count: 0, totalOvr: 0, yds: 0, tds: 0,
          })
        }
        const u = byUid.get(row.user_id)
        u.wins    += row.wins ?? 0
        u.losses  += row.losses ?? 0
        u.yds     += row.season_pass_yds ?? 0
        u.tds     += row.season_tds ?? 0
        if (row.champion) u.rings++
        if (row.playoffs) u.playoffApps++
        u.count++
        u.totalOvr += row.ovr ?? 0
        if (!u.username && row.username) u.username = row.username
      }
      const compiled = Array.from(byUid.values()).map(u => ({
        ...u,
        avgOvr: u.count > 0 ? +(u.totalOvr / u.count).toFixed(1) : 0,
        winPct: (u.wins + u.losses) > 0 ? +((u.wins / (u.wins + u.losses)) * 100).toFixed(1) : 0,
      }))
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
      .ilike('game_mode', 'rb-%')
      .not('build', 'is', null)
      .gte('ovr', 75)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(200)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .ilike('game_mode', 'rb-%')
      .not('build', 'is', null)
      .lt('ovr', 75)
      .order('ovr', { ascending: true })
      .order('wins', { ascending: true })
      .limit(20)
    Promise.all([bestQ, worstQ]).then(([best, worst]) => {
      if (best.data)  setRbBestBuilds(best.data)
      if (worst.data) setRbWorstBuilds(worst.data)
      setRbBuildsLoaded(true)
      setRbBuildsLoading(false)
    })
  }

  // ── RB all-time ──────────────────────────────────────────────────────────────
  const loadRBLegends = () => {
    if (rbLegendLoaded || !supabase) return
    setRbLegendLoading(true)
    const PAGE = 1000
    ;(async () => {
      const { count } = await supabase.from('simulations')
        .select('*', { count: 'exact', head: true })
        .eq('game_mode', 'rb-all-time')
      const pages = Math.ceil((count ?? PAGE) / PAGE)
      const mkQ = () => supabase.from('simulations')
        .select('user_id, username, wins, losses, champion, playoffs, ovr, season_pass_yds, season_tds')
        .eq('game_mode', 'rb-all-time')
        .order('id', { ascending: true })
      const results = await Promise.all(
        Array.from({ length: pages }, (_, i) =>
          mkQ().range(i * PAGE, i * PAGE + PAGE - 1).then(r => r.data ?? [])
        )
      )
      const byUid = new Map()
      for (const row of results.flat()) {
        if (!row.user_id) continue
        if (!byUid.has(row.user_id)) {
          byUid.set(row.user_id, {
            uid: row.user_id,
            username: row.username || `Player_${row.user_id.slice(0, 5)}`,
            wins: 0, losses: 0, rings: 0, playoffApps: 0, count: 0, totalOvr: 0, yds: 0, tds: 0,
          })
        }
        const u = byUid.get(row.user_id)
        u.wins    += row.wins ?? 0
        u.losses  += row.losses ?? 0
        u.yds     += row.season_pass_yds ?? 0
        u.tds     += row.season_tds ?? 0
        if (row.champion) u.rings++
        if (row.playoffs) u.playoffApps++
        u.count++
        u.totalOvr += row.ovr ?? 0
        if (!u.username && row.username) u.username = row.username
      }
      const compiled = Array.from(byUid.values()).map(u => ({
        ...u,
        avgOvr: u.count > 0 ? +(u.totalOvr / u.count).toFixed(1) : 0,
        winPct: (u.wins + u.losses) > 0 ? +((u.wins / (u.wins + u.losses)) * 100).toFixed(1) : 0,
        winPctWeighted: (u.wins + u.losses) > 0 ? (u.wins + 17) / (u.wins + u.losses + 34) * 100 : 0,
      }))
      setRbLegendRows(compiled)
      setRbLegendLoaded(true)
      setRbLegendLoading(false)
    })()
  }

  // ── Awards leaderboard ───────────────────────────────────────────────────────
  const loadAwards = () => {
    const modeKey = isRB ? 'rb' : 'qb'
    if (awardsLoadedFor === modeKey || !supabase) return
    setAwardsLoading(true)
    const classicCol = isRB ? 'classic_opoys' : 'classic_mvps'
    const alltimeCol = isRB ? 'alltime_opoys' : 'alltime_mvps'
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
    const classicMode = isRB ? 'rb-classic' : 'classic'
    const awardCol = isRB ? 'classic_opoys' : 'classic_mvps'
    ;(async () => {
      const { data } = await supabase
        .from('simulations')
        .select('user_id, username, wins, losses, champion, ovr')
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
            wins: 0, losses: 0, rings: 0, count: 0, mvps: 0,
          })
        }
        const u = byUid.get(row.user_id)
        u.wins += row.wins ?? 0
        u.losses += row.losses ?? 0
        if (row.champion) u.rings++
        u.count++
      }
      const uids = Array.from(byUid.keys())
      if (uids.length > 0) {
        const { data: accs } = await supabase
          .from('accounts')
          .select(`id, ${awardCol}`)
          .in('id', uids)
        for (const acc of accs ?? []) {
          if (byUid.has(acc.id)) byUid.get(acc.id).mvps = acc[awardCol] ?? 0
        }
      }
      setDailyRows(Array.from(byUid.values()))
      setDailyLoaded(true)
      setDailyLoading(false)
    })()
  }

  const isAwardsMetric = isRB ? rbMetric === 'opoys' : metric === 'mvps'

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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="lb-page">
      <div className="lb-col">

        <div className="lb-top-nav">
          <button className="prf-top-back" onClick={showDaily ? () => setShowDaily(false) : onBack}>
            {showDaily ? '← Back' : '← Back to Build'}
          </button>
          {!showDaily && (
            <button className="lb-daily-nav-btn" onClick={() => { setShowDaily(true); loadDaily() }}>
              Daily →
            </button>
          )}
        </div>

        {/* Tab bar — hidden on daily page */}
        {!showDaily && (
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
              if (isRB) loadRBBuilds()
              else loadBuilds()
            }}
          >
            Builds
          </button>
          {!isRB && (
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
        </div>
        )}

        {/* ── DAILY PAGE ──────────────────────────────────────────────────────── */}
        {showDaily && (() => {
          const awardLabel = isRB ? 'OPOYs' : 'MVPs'
          const DAILY_METRICS = [
            { key: 'rings', label: 'Rings' },
            { key: 'wins',  label: 'Wins' },
            { key: 'mvps',  label: awardLabel },
          ]
          const sorted = [...dailyRows].sort((a, b) => (b[dailyMetric] - a[dailyMetric]) || (b.wins - a.wins))
          const slots  = Array.from({ length: 20 }, (_, i) => sorted[i] ?? null)
          return (
            <>
              <div className="lb-header">
                <div className="lb-title lb-title-daily">Daily Leaderboard</div>
                <div className="lb-subtitle">{isRB ? 'RB classic · resets midnight EST' : 'QB classic · resets midnight EST'}</div>
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

        {!showDaily && <div id="ramp-cntr1-lb" className="ad-cntr1-lb" />}

        {/* ── PROFILES ────────────────────────────────────────────────────────── */}
        {!showDaily && view === 'profiles' && (
          <>
            <div className="lb-header">
              <div className="lb-title">{isRB ? 'RB Leaderboard' : 'Leaderboard'}</div>
              <div className="lb-subtitle">
                {isRB ? 'RB mode · career stats · all players ranked' : 'Career stats · all players ranked'}
              </div>
              <div className={`lb-header-line${isRB ? ' lb-header-line-rb' : ''}`} />
            </div>

            <div className="lb-tabs-scroll">
              {(isRB ? RB_METRICS : QB_METRICS).map(m => (
                <button
                  key={m.key}
                  className={`lb-tab${isRB ? ' lb-tab-rb' : ''} ${(isRB ? rbMetric : metric) === m.key ? `lb-tab-active${isRB ? ' lb-tab-active-rb' : ''}` : ''}`}
                  onClick={() => { if (isRB) setRbMetric(m.key); else setMetric(m.key); if (m.awards) loadAwards() }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {(['winPct', 'avgOvr'].includes(isRB ? rbMetric : metric)) && (
              <div className="lb-winpct-note">Min. 10 seasons required</div>
            )}

            {isAwardsMetric ? (
              awardsLoading ? (
                <LBSpinner />
              ) : awardsRows.length === 0 ? (
              <div className="lb-loading lb-legends-empty">No {isRB ? 'OPOY' : 'MVP'} awards yet.</div>
            ) : (
              <div className="lb-list" key={isRB ? 'opoys' : 'mvps'}>
                {awardsRows.map((row, i) =>
                  <div
                    key={row.uid}
                    className={`lb-row${isRB ? ' lb-row-rb' : ''} ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                    style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}
                  >
                    <RankBadge rank={i + 1} />
                    <div className="lb-row-info">
                      <div className="lb-row-name">
                        {row.username}
                        {plusUids.has(row.uid) && <span className="lb-plus-badge">+</span>}
                        {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                      </div>
                      {(() => { const c = (isRB ? rbRows : rows).find(r => r.uid === row.uid); return c ? <div className="lb-row-sub">{c.wins}W · {c.losses}L · {c.rings} ring{c.rings !== 1 ? 's' : ''} · {c.count} season{c.count !== 1 ? 's' : ''}</div> : null })()}
                    </div>
                    <div className="lb-row-val">{row.count}</div>
                  </div>
                )}
              </div>
            )
            ) : (isRB ? rbLoading : loading) ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={isRB ? rbMetric : metric}>
                {(isRB ? rbProfileSlots : qbProfileSlots).map((row, i) =>
                  row ? (
                    <div
                      key={row.uid}
                      className={`lb-row${isRB ? ' lb-row-rb' : ''} ${currentUser && row.uid === currentUser.id ? 'lb-row-me' : ''} ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
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
                        {isRB ? activeRBMetric.fmt(row[rbMetric]) : activeQBMetric.fmt(row[metric])}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className={`lb-row lb-row-empty${isRB ? ' lb-row-rb' : ''}`} style={{ animationDelay: `${i * 35}ms` }}>
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

        {/* ── BUILDS ──────────────────────────────────────────────────────────── */}
        {!showDaily && view === 'builds' && (
          <>
            <div className="lb-header">
              <div className="lb-title">{isRB ? 'RB Builds' : 'Builds'}</div>
              <div className="lb-subtitle">{isRB ? 'RB mode · best and worst builds' : 'Best and worst builds'}</div>
              <div className={`lb-header-line${isRB ? ' lb-header-line-rb' : ''}`} />
            </div>

            <div className="lb-tabs-scroll">
              <button
                className={`lb-tab${isRB ? ' lb-tab-rb' : ''} ${buildsTab === 'best' ? `lb-tab-active${isRB ? ' lb-tab-active-rb' : ''}` : ''}`}
                onClick={() => switchBuildsTab('best')}
              >
                Best
              </button>
              <button
                className={`lb-tab${isRB ? ' lb-tab-rb' : ''} ${buildsTab === 'worst' ? `lb-tab-active${isRB ? ' lb-tab-active-rb' : ''}` : ''}`}
                onClick={() => switchBuildsTab('worst')}
              >
                Worst
              </button>
            </div>

            {(isRB ? rbBuildsLoading : buildsLoading) ? (
              <LBSpinner />
            ) : (
              <div className="lb-list" key={`${isRB ? 'rb-' : ''}builds-${buildsTab}`}>
                {(isRB ? rbBuildSlots : qbBuildSlots).map((row, i) =>
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
                          <BuildExpand build={row.build || {}} types={isRB ? RB_TYPES : TYPES} />
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
        {!showDaily && !isRB && view === 'legends' && (
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
                            {row.username}
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
        {!showDaily && isRB && view === 'rb-legends' && (
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
                              {row.username}
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
