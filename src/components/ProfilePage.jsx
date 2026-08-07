import { useState, useEffect, useRef } from 'react'

function PrfSpinner() {
  return (
    <div className="lb-spinner-wrap">
      <svg className="lb-spinner" viewBox="0 0 36 36">
        <circle className="lb-spinner-track" cx="18" cy="18" r="14" fill="none" strokeWidth="3" />
        <circle className="lb-spinner-arc" cx="18" cy="18" r="14" fill="none" strokeWidth="3" />
      </svg>
    </div>
  )
}

function FootballIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="12" rx="5" ry="9.5" transform="rotate(-45 12 12)" />
      <line x1="9.2" y1="14.8" x2="14.8" y2="9.2" />
      <line x1="9" y1="12" x2="10.8" y2="10.2" />
      <line x1="13.2" y1="13.8" x2="15" y2="12" />
    </svg>
  )
}
function BballIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3a11 11 0 0 1 0 18M12 3a11 11 0 0 0 0 18" />
    </svg>
  )
}
function HoopU() {
  return (
    <svg className="prf-hoop-u" viewBox="0 0 68 90" fill="none" aria-hidden="true">
      <circle cx="34" cy="14" r="14.4" fill="#f97316"/>
      <path d="M8 24 L18 88 L50 88 L60 24" stroke="white" strokeWidth="6" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}
function MiniPlayerLogo() {
  return (
    <span className="prf-mini-logo logo-text">
      Buil<span className="logo-d">d</span><em>-<span className="logo-a">A</span>-</em>Player
    </span>
  )
}
function MiniBucketLogo() {
  return (
    <span className="prf-mini-logo logo-text">
      Buil<span className="logo-d">d</span><em style={{ color: '#f97316', WebkitTextFillColor: '#f97316' }}>-<span className="logo-a">A</span>-</em>B<HoopU />cket
    </span>
  )
}
import { ATTR, TYPES } from '../data/qbs'
import { BUCKET_ATTR, NBA_TEAMS } from '../data/nba-players'
import { NBA_SKIN_COLORS } from '../data/nba-skin-colors'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
import { NBA_FACE_CENTERS } from '../data/nba-face-centers'
import BucketFigureOverlay from './BucketFigureOverlay'
import { BucketModelFigure } from './BucketSimPage'

const NBA_TEAM_MAP = Object.fromEntries(NBA_TEAMS.map(t => [t.short, t]))

function enrichBucketBuild(savedBuild) {
  if (!savedBuild) return {}
  return Object.fromEntries(
    Object.entries(savedBuild).map(([slot, d]) => {
      const teamInfo   = NBA_TEAM_MAP[d.team] ?? {}
      const hsId       = NBA_HEADSHOTS[d.qb]
      return [slot, {
        ...d,
        teamColor:   teamInfo.color  ?? '#ffffff',
        teamColor2:  teamInfo.color2 ?? '#888888',
        skinColor:   NBA_SKIN_COLORS[d.qb] ?? '#c8956c',
        number:      d.number ?? null,
        photo:       hsId ? `/headshots/nba/${hsId}.webp` : null,
        faceCenter:  NBA_FACE_CENTERS[d.qb] ?? null,
      }]
    })
  )
}
function computeBucketGoatRank(s) {
  const { ovr = 0, ppg = 0, rpg = 0, apg = 0, spg = 0, bpg = 0, champion = false, mvp = false, dpoy = false } = s
  if (ovr < 92) return null
  const baseRank  = Math.round(75 - ((ovr - 92) / 7) * 63)
  const statScore = Math.max(0, ppg - 28) * 0.5 + Math.max(0, rpg - 10) * 0.4 + Math.max(0, apg - 8) * 0.4 + Math.max(0, spg - 2.2) * 0.8 + Math.max(0, bpg - 2.2) * 0.8
  const statBoost = Math.min(4, Math.round(statScore))
  let rank = baseRank - statBoost - (champion ? 3 : 0) - (mvp ? 3 : 0) - (dpoy ? 2 : 0)
  if (!champion) rank = Math.max(rank, 11)
  if (!mvp || !champion) rank = Math.max(rank, 8)
  if (rank <= 3 && !(mvp && champion && ovr >= 97)) rank = 4
  if (rank <= 1 && !(mvp && dpoy && champion && ovr >= 99 && ppg >= 28 && (rpg >= 9 || apg >= 8))) rank = 2
  return Math.max(1, Math.min(75, rank))
}

import { calcOVR, calcOVRRB, calcOVRWR, getArchetype, getArchetypeRB, getArchetypeWR, valToGrade } from '../utils/simulation'
import QBAvatar from './QBAvatar'
import { supabase } from '../lib/supabase'
import { RB_TYPES } from '../data/rbs'
import { WR_TYPES } from '../data/wrs'

function useCountUp(target, duration = 900, enabled = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!enabled || !target) return
    const start = Date.now()
    let raf
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])
  return val
}

function getInitials(user) {
  const name = user.user_metadata?.username || user.email || ''
  const parts = name.split(/[\s@_.-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function StatBar({ label, value, grade, max, color }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / max) * 100), 100)
    return () => clearTimeout(t)
  }, [value, max])
  return (
    <div className="prf-stat-bar-row">
      <span className="prf-stat-bar-lbl">{label}</span>
      <div className="prf-stat-bar-track">
        <div className="prf-stat-bar-fill" style={{ width: `${width}%`, background: color, transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
      <span className="prf-stat-bar-val">{grade}</span>
    </div>
  )
}

const THEMES = [
  { id: 'default', label: 'Green',  dots: ['#74C69D','#52B788','#2D6A4F'] },
  { id: 'blue',    label: 'Blue',   dots: ['#93c5fd','#3b82f6','#1d4ed8'] },
  { id: 'purple',  label: 'Purple', dots: ['#e9d5ff','#c084fc','#9333ea'] },
  { id: 'orange',  label: 'Orange', dots: ['#fed7aa','#fb923c','#ea580c'] },
  { id: 'red',     label: 'Red',    dots: ['#ffbbbb','#f45252','#cc1010'] },
  { id: 'teal',    label: 'Teal',   dots: ['#a5f3fc','#22d3ee','#0891b2'] },
  { id: 'gold',    label: 'Gold',   dots: ['#fde68a','#fbbf24','#d97706'] },
  { id: 'rose',    label: 'Rose',   dots: ['#fbcfe8','#f472b6','#db2777'] },
]

const PROFILE_ICONS = [
  { id: 'trophy',   e: '🏆' }, { id: 'star',   e: '⭐' }, { id: 'football', e: '🏈' },
  { id: 'bolt',     e: '⚡' }, { id: 'crown',  e: '👑' }, { id: 'fire',     e: '🔥' },
  { id: 'gem',      e: '💎' }, { id: 'rocket', e: '🚀' }, { id: 'muscle',   e: '💪' },
  { id: 'skull',    e: '💀' }, { id: 'goat',   e: '🐐' },
]

export default function ProfilePage({ user, build, simResult, types = TYPES, isRB = false, isWR = false, isPlus = false, isBucket = false, currentPool = [], isCustomMode = false, onCustomModeChange, onCustomRatingsChange, onThemeChange, onBack, onSignOut, onAdsDisabled, onOpenCustomModal, isBucketCustomMode = false, onBucketCustomModeChange, onOpenBucketCustomModal }) {
  const [show, setShow]           = useState(false)
  const [career, setCareer]       = useState(null)
  const [careerLoad, setCareerLoad] = useState(true)
  const [rbCareer, setRbCareer]   = useState(null)
  const [rbCareerLoad, setRbCareerLoad] = useState(true)
  const [wrCareer, setWrCareer]   = useState(null)
  const [wrCareerLoad, setWrCareerLoad] = useState(true)
  const [legendCareer, setLegendCareer] = useState(null)
  const [legendCareerLoad, setLegendCareerLoad] = useState(true)
  const [rbLegendCareer, setRbLegendCareer] = useState(null)
  const [rbLegendCareerLoad, setRbLegendCareerLoad] = useState(true)
  const [bucketCareer, setBucketCareer] = useState(null)
  const [bucketCareerLoad, setBucketCareerLoad] = useState(true)
  const [bucketRingSeasons, setBucketRingSeasons] = useState([])
  const [bucketAlltimeCareer, setBucketAlltimeCareer] = useState(null)
  const [bucketAlltimeCareerLoad, setBucketAlltimeCareerLoad] = useState(true)
  const [bucketAlltimeRingSeasons, setBucketAlltimeRingSeasons] = useState([])
  const [bucketCareerMode, setBucketCareerMode] = useState('classic')
  const [showRings, setShowRings] = useState(false)
  const [salaryCareer, setSalaryCareer] = useState(null)
  const [salaryCareerLoad, setSalaryCareerLoad] = useState(true)
  const [gameSection, setGameSection] = useState('nfl')
  const [careerGame, setCareerGame] = useState(isWR ? 'wr' : isRB ? 'rb' : 'qb')
  const [adsDisabled, setAdsDisabled] = useState(false)
  const [adsLifetime, setAdsLifetime] = useState(false)
  const [adFreeLoading, setAdFreeLoading] = useState(false)
  const [activeTheme, setActiveTheme] = useState(() => {
    try { return localStorage.getItem('bap_theme') || 'default' } catch { return 'default' }
  })
  const [profileIcon, setProfileIcon] = useState(() => {
    try { return localStorage.getItem('bap_profile_icon') || null } catch { return null }
  })
  const [plusOpen, setPlusOpen] = useState(false)
  const [showSandboxWarning, setShowSandboxWarning] = useState(false)
  const plusRef = useRef(null)
  const [showPwForm, setShowPwForm] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    if (!plusOpen) return
    const close = (e) => { if (plusRef.current && !plusRef.current.contains(e.target)) setPlusOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [plusOpen])

  useEffect(() => { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t) }, [])

  const [mvpCounts, setMvpCounts] = useState({ classic: 0, alltime: 0, classicOpoy: 0, alltimeOpoy: 0 })

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('accounts').select('ads_disabled,subscription_status,classic_mvps,alltime_mvps,classic_opoys,alltime_opoys').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.ads_disabled) { setAdsDisabled(true); setAdsLifetime(true) }
        else if (data?.subscription_status === 'active') setAdsDisabled(true)
        setMvpCounts({
          classic:     data?.classic_mvps  ?? 0,
          alltime:     data?.alltime_mvps  ?? 0,
          classicOpoy: data?.classic_opoys ?? 0,
          alltimeOpoy: data?.alltime_opoys ?? 0,
        })
      })
  }, [user])

  // Check for successful Stripe return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('ad_free') === '1') {
      setAdsDisabled(true)
      onAdsDisabled?.()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleManageSubscription = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/create-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {}
  }

  const handleAdFree = async () => {
    if (adFreeLoading || adsDisabled || !user) return
    setAdFreeLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setAdFreeLoading(false)
    }
  }

  useEffect(() => {
    if (!supabase || !user) { setCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,season_pass_yds,season_tds,season_ints,season_rating,playoffs,champion,ovr,archetype,build,created_at,game_mode')
      .eq('user_id', user.id)
      .not('game_mode', 'in', '("all-time","legends")')
      .not('game_mode', 'ilike', 'rb-%')
      .not('game_mode', 'ilike', 'wr-%')
      .not('game_mode', 'ilike', 'bucket-%')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setCareer(null); setCareerLoad(false); return }
        const totalWins   = data.reduce((s, r) => s + (r.wins  ?? 0), 0)
        const totalLosses = data.reduce((s, r) => s + (r.losses ?? 0), 0)
        const totalTDs    = data.reduce((s, r) => s + (r.season_tds ?? 0), 0)
        const totalYds    = data.reduce((s, r) => s + (r.season_pass_yds ?? 0), 0)
        const totalINTs   = data.reduce((s, r) => s + (r.season_ints ?? 0), 0)
        const rings       = data.filter(r => r.champion).length
        const playoffApps = data.filter(r => r.playoffs).length
        const totalGames  = totalWins + totalLosses
        const winPct      = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
        const avgOVR      = (data.reduce((s, r) => s + (r.ovr ?? 0), 0) / data.length).toFixed(1)
        const best        = data.reduce((b, r) => (r.wins ?? 0) > (b.wins ?? 0) ? r : b, data[0])
        const withBuilds  = data.filter(r => r.build && r.ovr)
        const bestBuild   = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) > (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        const worstBuild  = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) < (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        setCareer({ count: data.length, totalWins, totalLosses, totalTDs, totalYds, totalINTs, rings, playoffApps, winPct, avgOVR, best, bestBuild, worstBuild })
        setCareerLoad(false)
      })
  }, [user])

  useEffect(() => {
    if (!supabase || !user) { setWrCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,season_pass_yds,season_tds,season_ints,season_comp_pct,playoffs,champion,ovr,archetype,build,created_at')
      .eq('user_id', user.id)
      .ilike('game_mode', 'wr-%')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setWrCareer(null); setWrCareerLoad(false); return }
        const totalWins    = data.reduce((s, r) => s + (r.wins     ?? 0), 0)
        const totalLosses  = data.reduce((s, r) => s + (r.losses   ?? 0), 0)
        const totalTDs     = data.reduce((s, r) => s + (r.season_tds      ?? 0), 0)
        const totalRecYds  = data.reduce((s, r) => s + (r.season_pass_yds ?? 0), 0)
        const totalRecs    = data.reduce((s, r) => s + (r.season_ints     ?? 0), 0)
        const totalTargets = data.reduce((s, r) => s + (r.season_comp_pct ?? 0), 0)
        const rings        = data.filter(r => r.champion).length
        const playoffApps  = data.filter(r => r.playoffs).length
        const totalGames   = totalWins + totalLosses
        const winPct       = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
        const avgOVR       = (data.reduce((s, r) => s + (r.ovr ?? 0), 0) / data.length).toFixed(1)
        const best         = data.reduce((b, r) => (r.wins ?? 0) > (b.wins ?? 0) ? r : b, data[0])
        const withBuilds   = data.filter(r => r.build && r.ovr)
        const bestBuild    = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) > (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        const worstBuild   = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) < (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        setWrCareer({ count: data.length, totalWins, totalLosses, totalTDs, totalRecYds, totalRecs, totalTargets, rings, playoffApps, winPct, avgOVR, best, bestBuild, worstBuild })
        setWrCareerLoad(false)
      })
  }, [user])

  useEffect(() => {
    if (!supabase || !user) { setRbCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,season_pass_yds,season_tds,playoffs,champion,ovr,archetype,build,created_at')
      .eq('user_id', user.id)
      .eq('game_mode', 'rb-classic')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setRbCareer(null); setRbCareerLoad(false); return }
        const totalWins   = data.reduce((s, r) => s + (r.wins   ?? 0), 0)
        const totalLosses = data.reduce((s, r) => s + (r.losses ?? 0), 0)
        const totalTDs    = data.reduce((s, r) => s + (r.season_tds     ?? 0), 0)
        const totalRushYds= data.reduce((s, r) => s + (r.season_pass_yds ?? 0), 0)
        const rings       = data.filter(r => r.champion).length
        const playoffApps = data.filter(r => r.playoffs).length
        const totalGames  = totalWins + totalLosses
        const winPct      = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
        const avgOVR      = (data.reduce((s, r) => s + (r.ovr ?? 0), 0) / data.length).toFixed(1)
        const best        = data.reduce((b, r) => (r.wins ?? 0) > (b.wins ?? 0) ? r : b, data[0])
        const withBuilds  = data.filter(r => r.build && r.ovr)
        const bestBuild   = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) > (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        const worstBuild  = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) < (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        setRbCareer({ count: data.length, totalWins, totalLosses, totalTDs, totalRushYds, rings, playoffApps, winPct, avgOVR, best, bestBuild, worstBuild })
        setRbCareerLoad(false)
      })
  }, [user])

  useEffect(() => {
    if (!supabase || !user) { setLegendCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,season_pass_yds,season_tds,season_ints,season_rating,playoffs,champion,ovr,created_at')
      .eq('user_id', user.id)
      .in('game_mode', ['all-time', 'legends'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setLegendCareer(null); setLegendCareerLoad(false); return }
        const totalWins   = data.reduce((s, r) => s + (r.wins  ?? 0), 0)
        const totalLosses = data.reduce((s, r) => s + (r.losses ?? 0), 0)
        const totalTDs    = data.reduce((s, r) => s + (r.season_tds ?? 0), 0)
        const totalYds    = data.reduce((s, r) => s + (r.season_pass_yds ?? 0), 0)
        const rings       = data.filter(r => r.champion).length
        const playoffApps = data.filter(r => r.playoffs).length
        const totalGames  = totalWins + totalLosses
        const winPct      = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
        const avgOVR      = (data.reduce((s, r) => s + (r.ovr ?? 0), 0) / data.length).toFixed(1)
        const best        = data.reduce((b, r) => (r.wins ?? 0) > (b.wins ?? 0) ? r : b, data[0])
        setLegendCareer({ count: data.length, totalWins, totalLosses, totalTDs, totalYds, rings, playoffApps, winPct, avgOVR, best })
        setLegendCareerLoad(false)
      })
  }, [user])

  useEffect(() => {
    if (!supabase || !user) { setRbLegendCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,season_pass_yds,season_tds,playoffs,champion,ovr,created_at')
      .eq('user_id', user.id)
      .in('game_mode', ['rb-all-time', 'rb-legends'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setRbLegendCareer(null); setRbLegendCareerLoad(false); return }
        const totalWins   = data.reduce((s, r) => s + (r.wins  ?? 0), 0)
        const totalLosses = data.reduce((s, r) => s + (r.losses ?? 0), 0)
        const totalTDs    = data.reduce((s, r) => s + (r.season_tds ?? 0), 0)
        const totalRushYds= data.reduce((s, r) => s + (r.season_pass_yds ?? 0), 0)
        const rings       = data.filter(r => r.champion).length
        const playoffApps = data.filter(r => r.playoffs).length
        const totalGames  = totalWins + totalLosses
        const winPct      = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
        const avgOVR      = (data.reduce((s, r) => s + (r.ovr ?? 0), 0) / data.length).toFixed(1)
        const best        = data.reduce((b, r) => (r.wins ?? 0) > (b.wins ?? 0) ? r : b, data[0])
        setRbLegendCareer({ count: data.length, totalWins, totalLosses, totalTDs, totalRushYds, rings, playoffApps, winPct, avgOVR, best })
        setRbLegendCareerLoad(false)
      })
  }, [user])

  useEffect(() => {
    if (!supabase || !user) { setBucketCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,champion,mvp,dpoy,ovr,ppg,rpg,apg,spg,bpg,archetype,team_short,build,created_at')
      .eq('user_id', user.id)
      .eq('game_mode', 'bucket-classic')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setBucketCareer(null); setBucketCareerLoad(false); return }
        const totalWins   = data.reduce((s, r) => s + (r.wins  ?? 0), 0)
        const totalLosses = data.reduce((s, r) => s + (r.losses ?? 0), 0)
        const rings       = data.filter(r => r.champion).length
        const mvps        = data.filter(r => r.mvp).length
        const dpoys       = data.filter(r => r.dpoy).length
        const totalGames  = totalWins + totalLosses
        const winPct      = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
        const avgOVR      = (data.reduce((s, r) => s + (r.ovr ?? 0), 0) / data.length).toFixed(1)
        const avgPPG      = (data.reduce((s, r) => s + (r.ppg ?? 0), 0) / data.length).toFixed(1)
        const best        = data.reduce((b, r) => (r.wins ?? 0) > (b.wins ?? 0) ? r : b, data[0])
        const withBuilds  = data.filter(r => r.build && r.ovr)
        const bestBuild   = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) > (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        const worstBuild  = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) < (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        const ringSeasons  = data.filter(r => r.champion)
        const goatEntries  = data.map(r => ({ rank: computeBucketGoatRank(r), season: r })).filter(e => e.rank !== null)
        const bestGoatEntry = goatEntries.length ? goatEntries.reduce((a, b) => a.rank <= b.rank ? a : b) : null
        setBucketRingSeasons(ringSeasons)
        setBucketCareer({ count: data.length, totalWins, totalLosses, rings, mvps, dpoys, winPct, avgOVR, avgPPG, best, bestBuild, worstBuild, bestGoatRank: bestGoatEntry?.rank ?? null, bestGoatSeason: bestGoatEntry?.season ?? null })
        setBucketCareerLoad(false)
      })
  }, [user])

  useEffect(() => {
    if (!supabase || !user) { setBucketAlltimeCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,champion,mvp,dpoy,ovr,ppg,rpg,apg,spg,bpg,archetype,team_short,build,created_at')
      .eq('user_id', user.id)
      .eq('game_mode', 'bucket-all-time')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setBucketAlltimeCareer(null); setBucketAlltimeCareerLoad(false); return }
        const totalWins   = data.reduce((s, r) => s + (r.wins  ?? 0), 0)
        const totalLosses = data.reduce((s, r) => s + (r.losses ?? 0), 0)
        const rings       = data.filter(r => r.champion).length
        const mvps        = data.filter(r => r.mvp).length
        const dpoys       = data.filter(r => r.dpoy).length
        const totalGames  = totalWins + totalLosses
        const winPct      = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
        const avgOVR      = (data.reduce((s, r) => s + (r.ovr ?? 0), 0) / data.length).toFixed(1)
        const avgPPG      = (data.reduce((s, r) => s + (r.ppg ?? 0), 0) / data.length).toFixed(1)
        const best        = data.reduce((b, r) => (r.wins ?? 0) > (b.wins ?? 0) ? r : b, data[0])
        const withBuilds  = data.filter(r => r.build && r.ovr)
        const bestBuild   = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) > (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        const worstBuild  = withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr ?? 0) < (b.ovr ?? 0) ? r : b, withBuilds[0]) : null
        const ringSeasons = data.filter(r => r.champion)
        const goatEntries = data.map(r => ({ rank: computeBucketGoatRank(r), season: r })).filter(e => e.rank !== null)
        const bestGoatEntry = goatEntries.length ? goatEntries.reduce((a, b) => a.rank <= b.rank ? a : b) : null
        setBucketAlltimeRingSeasons(ringSeasons)
        setBucketAlltimeCareer({ count: data.length, totalWins, totalLosses, rings, mvps, dpoys, winPct, avgOVR, avgPPG, best, bestBuild, worstBuild, bestGoatRank: bestGoatEntry?.rank ?? null, bestGoatSeason: bestGoatEntry?.season ?? null })
        setBucketAlltimeCareerLoad(false)
      })
  }, [user])

  useEffect(() => {
    if (!supabase || !user) { setSalaryCareerLoad(false); return }
    supabase
      .from('salary_cap_plays')
      .select('date_str,overall_score,ppg,apg,rpg,budget_used,picks')
      .eq('user_id', user.id)
      .order('date_str', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setSalaryCareer(null); setSalaryCareerLoad(false); return }
        const count    = data.length
        const best     = data.reduce((b, r) => (r.overall_score ?? 0) > (b.overall_score ?? 0) ? r : b, data[0])
        const avgScore = (data.reduce((s, r) => s + (r.overall_score ?? 0), 0) / count).toFixed(1)
        const avgPPG   = (data.reduce((s, r) => s + (r.ppg ?? 0), 0) / count).toFixed(1)
        const avgAPG   = (data.reduce((s, r) => s + (r.apg ?? 0), 0) / count).toFixed(1)
        const avgRPG   = (data.reduce((s, r) => s + (r.rpg ?? 0), 0) / count).toFixed(1)
        setSalaryCareer({ count, best, avgScore, avgPPG, avgAPG, avgRPG })
        setSalaryCareerLoad(false)
      })
  }, [user])

  const filled   = types.filter(t => build?.[t])
  const ovr      = isWR ? calcOVRWR(build || {}, types) : isRB ? calcOVRRB(build || {}, types) : calcOVR(build || {}, types)
  const arch     = (ovr && filled.length === types.length) ? (isWR ? getArchetypeWR(ovr, build, types) : isRB ? getArchetypeRB(ovr, build, types) : getArchetype(ovr, build, types)) : null
  const complete = filled.length === types.length

  const ovrDisplay  = useCountUp(ovr, 1000, show && !!ovr)
  const winsDisplay = useCountUp(simResult?.wins, 800, show && !!simResult)
  const ydsDisplay  = useCountUp(simResult?.seasonPassYds, 1200, show && !!simResult)
  const tdsDisplay  = useCountUp(simResult?.seasonTDs, 900, show && !!simResult)
  const careerYds       = useCountUp(career?.totalYds, 1400, show && !!career)
  const careerTDs       = useCountUp(career?.totalTDs, 1000, show && !!career)
  const rbCareerYds     = useCountUp(rbCareer?.totalRushYds, 1400, show && !!rbCareer)
  const rbCareerTDs     = useCountUp(rbCareer?.totalTDs, 1000, show && !!rbCareer)
  const legendCareerYds     = useCountUp(legendCareer?.totalYds, 1400, show && !!legendCareer)
  const legendCareerTDs     = useCountUp(legendCareer?.totalTDs, 1000, show && !!legendCareer)
  const rbLegendCareerYds   = useCountUp(rbLegendCareer?.totalRushYds, 1400, show && !!rbLegendCareer)
  const rbLegendCareerTDs   = useCountUp(rbLegendCareer?.totalTDs, 1000, show && !!rbLegendCareer)
  const wrCareerRecYds      = useCountUp(wrCareer?.totalRecYds, 1400, show && !!wrCareer)
  const wrCareerTDs         = useCountUp(wrCareer?.totalTDs, 1000, show && !!wrCareer)
  const wrCareerRecs        = useCountUp(wrCareer?.totalRecs, 1200, show && !!wrCareer)

  const displayName = user.user_metadata?.username || user.email?.split('@')[0] || 'Player'
  const initials    = getInitials(user)
  const since       = formatDate(user.created_at)

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    onSignOut?.()
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwError(null)
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setNewPw('')
    setConfirmPw('')
    setTimeout(() => { setPwSuccess(false); setShowPwForm(false) }, 2500)
  }

  return (
    <div className="prf-page">
      {!isBucket && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: '-20px', backgroundImage: "url('/footballbackground.webp')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(4px) brightness(0.12)' }} />
        </div>
      )}
      <div className="prf-col" style={!isBucket ? { position: 'relative', zIndex: 1 } : undefined}>

        {/* ── Top nav ── */}
        <div className="prf-top-nav">
          <button className="prf-top-back" onClick={onBack}>← Back to Build</button>
          <div className="prf-plus-wrap" ref={plusRef}>
            <button
              className={`prf-top-adfree${isPlus ? ' prf-top-adfree--on' : ''}`}
              onClick={isPlus ? undefined : () => setPlusOpen(o => !o)}
              style={isPlus ? { cursor: 'default' } : undefined}
            >
              {isPlus ? '✦ PLUS Active' : '✦ Build-A-Player Plus'}
            </button>
            {!isPlus && plusOpen && (
              <div className="prf-plus-dropdown">
                <div className="wm-plus-body">
                  {[
                    'No ads',
                    'Custom color themes',
                    'Custom profile icons',
                    'PLUS badge on leaderboard',
                  ].map(label => (
                    <div key={label} className="wm-plus-perk">
                      <span className="wm-plus-check">✓</span>
                      <span>{label}</span>
                    </div>
                  ))}
                  {!isPlus ? (
                    <button
                      className="plus-subscribe-btn wm-plus-subscribe"
                      disabled={adFreeLoading}
                      onClick={() => { setPlusOpen(false); handleAdFree() }}
                    >
                      {adFreeLoading ? 'Redirecting…' : 'Subscribe — $4.99/mo'}
                    </button>
                  ) : (
                    <button
                      className="wm-plus-edit-btn"
                      onClick={() => { setPlusOpen(false); onOpenCustomModal?.() }}
                    >
                      <span>⚙️</span>
                      <span>Edit Custom Ratings</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Hero header ── */}
        <div className={`prf-hero ${show ? 'prf-hero-in' : ''}`}>
          <div className="prf-avatar-wrap">
            <div className="prf-avatar">
              {(isPlus && profileIcon)
                ? <span className="prf-avatar-emoji">{PROFILE_ICONS.find(i => i.id === profileIcon)?.e ?? initials}</span>
                : initials}
            </div>
            <div className="prf-avatar-ring" />
          </div>
          <div className="prf-identity">
            <div className="prf-name">{displayName}</div>
            {since && <div className="prf-since">Joined {since}</div>}
          </div>
        </div>

        {/* ── Build-A-Player Plus ── */}
        {isPlus && (
        <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.1s' }}>
          <div className="prf-card-hd">
            <span className="prf-card-title">Build-A-Player Plus</span>
            <span className="plus-status-badge plus-status-badge--on">Active</span>
          </div>

          <div className="plus-content">

              <div className="plus-adfree-row">
                <span className="plus-adfree-check">✓</span>
                <span className="plus-adfree-label">Ad-Free</span>
              </div>

              <div className="plus-section">
                <span className="plus-section-label">Color Theme</span>
                {isBucket ? (
                  <span className="plus-coming-soon">Not available for Build-A-Bucket yet</span>
                ) : (
                  <div className="plus-theme-row">
                    {THEMES.map(t => (
                      <button
                        key={t.id}
                        className={`plus-theme-swatch${activeTheme === t.id ? ' plus-theme-swatch--on' : ''}`}
                        onClick={() => {
                          setActiveTheme(t.id)
                          try { localStorage.setItem('bap_theme', t.id) } catch {}
                          onThemeChange?.(t.id)
                        }}
                      >
                        <div
                          className="plus-theme-bar"
                          style={{ background: `linear-gradient(135deg, ${t.dots[0]}, ${t.dots[2]})` }}
                        />
                        <span className="plus-theme-name">{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="plus-section">
                <span className="plus-section-label">Profile Icon</span>
                <div className="plus-icon-grid">
                  <button
                    className={`plus-icon-btn${!profileIcon ? ' plus-icon-btn--on' : ''}`}
                    onClick={() => { setProfileIcon(null); try { localStorage.removeItem('bap_profile_icon') } catch {} }}
                  >
                    <span className="plus-icon-initials">{initials}</span>
                  </button>
                  {PROFILE_ICONS.map(icon => (
                    <button
                      key={icon.id}
                      className={`plus-icon-btn${profileIcon === icon.id ? ' plus-icon-btn--on' : ''}`}
                      onClick={() => { setProfileIcon(icon.id); try { localStorage.setItem('bap_profile_icon', icon.id) } catch {} }}
                    >
                      {icon.e}
                    </button>
                  ))}
                </div>
              </div>



              <button className="plus-manage-btn" onClick={handleManageSubscription}>
                Manage Subscription
              </button>

            </div>
        </div>
        )}

        {/* ── Career ── */}
        {(() => {
          const allReady = !careerLoad && !rbCareerLoad && !wrCareerLoad && !rbLegendCareerLoad && !bucketCareerLoad && !bucketAlltimeCareerLoad && !legendCareerLoad && !salaryCareerLoad
          const hasNFL    = career || rbCareer || legendCareer || rbLegendCareer
          const hasBucket = !!bucketCareer || !!bucketAlltimeCareer
          const hasSalary = !!salaryCareer

          if (!allReady) return (
            <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.25s' }}>
              <div className="prf-card-hd"><span className="prf-card-title">Career</span></div>
              <PrfSpinner />
            </div>
          )

          if (!hasNFL && !hasBucket && !hasSalary) return null

          // Show toggle whenever there's NFL data (bucket section shows empty state if no data yet)
          const showToggle = !!hasNFL
          const section = showToggle ? gameSection : (hasBucket ? 'bucket' : hasSalary ? 'salary' : 'nfl')

          // NFL sub-tabs
          const NFL_TABS = [
            career         ? { id: 'qb',         label: 'QB',          star: false } : null,
            rbCareer       ? { id: 'rb',         label: 'RB',          star: false } : null,
            wrCareer       ? { id: 'wr',         label: 'WR',          star: false } : null,
            legendCareer   ? { id: 'alltime-qb', label: 'All-Time QB', star: true  } : null,
            rbLegendCareer ? { id: 'alltime-rb', label: 'All-Time RB', star: true  } : null,
          ].filter(Boolean)

          const activeNFL  = NFL_TABS.find(t => t.id === careerGame)?.id ?? NFL_TABS[0]?.id
          const dataMap    = { qb: career, rb: rbCareer, wr: wrCareer, 'alltime-qb': legendCareer, 'alltime-rb': rbLegendCareer }
          const nflData    = dataMap[activeNFL]
          const isAlltimeView = activeNFL === 'alltime-qb' || activeNFL === 'alltime-rb'
          const isRBView      = activeNFL === 'rb' || activeNFL === 'alltime-rb'
          const isWRView      = activeNFL === 'wr'

          return (
            <>
              {/* Top-level game switch */}
              {showToggle && (
                <div className={`prf-game-switch ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.2s' }}>
                  <button className={`prf-game-switch-btn${section === 'nfl' ? ' active' : ''}`} onClick={() => setGameSection('nfl')}>
                    <MiniPlayerLogo />
                  </button>
                  <button className={`prf-game-switch-btn${section === 'bucket' ? ' active' : ''}`} onClick={() => setGameSection('bucket')}>
                    <MiniBucketLogo />
                  </button>
                </div>
              )}

              {section === 'nfl' && nflData && (
                <>
                  {NFL_TABS.length > 1 && (
                    <div className={`prf-cgame-toggle ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.25s' }}>
                      {NFL_TABS.map(({ id, label, star }) => (
                        <button
                          key={id}
                          className={`prf-cgame-btn${activeNFL === id ? ' active' : ''}`}
                          onClick={() => setCareerGame(id)}
                        >
                          <div className="prf-cgame-icon-wrap">
                            <FootballIcon />
                            {star && <span className="prf-cgame-star">★</span>}
                          </div>
                          <span className="prf-cgame-label">{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={`prf-card${isAlltimeView ? ' prf-card-legend' : ''} ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.3s' }}>
                    <div className="prf-card-hd">
                      <span className={`prf-card-title${isAlltimeView ? ' prf-card-title-legend' : ''}`}>{isAlltimeView ? '★ ' : ''}Career</span>
                      <span className="prf-career-count">{nflData.count} season{nflData.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="prf-career-record">
                      <span className="pcr-w">{nflData.totalWins}</span>
                      <span className="pcr-sep">–</span>
                      <span className="pcr-l">{nflData.totalLosses}</span>
                      <span className="pcr-label">{isAlltimeView ? 'All-Time Record' : 'Career Record'}</span>
                    </div>
                    <div className="prf-career-grid">
                      {isWRView ? (
                        <>
                          <div className="pcg-cell">
                            <div className="pcg-val">{show ? wrCareerRecs.toLocaleString() : '–'}</div>
                            <div className="pcg-lbl">Career Recs</div>
                          </div>
                          <div className="pcg-cell">
                            <div className="pcg-val">{nflData.playoffApps}</div>
                            <div className="pcg-lbl">Playoff Apps</div>
                          </div>
                          <div className="pcg-cell">
                            <div className="pcg-val">{nflData.winPct}%</div>
                            <div className="pcg-lbl">Win %</div>
                          </div>
                          <div className="pcg-cell">
                            <div className="pcg-val">{show ? wrCareerRecYds.toLocaleString() : '–'}</div>
                            <div className="pcg-lbl">Rec Yards</div>
                          </div>
                          <div className="pcg-cell">
                            <div className="pcg-val">{show ? wrCareerTDs : '–'}</div>
                            <div className="pcg-lbl">Rec TDs</div>
                          </div>
                          <div className="pcg-cell">
                            <div className="pcg-val">{nflData.avgOVR}</div>
                            <div className="pcg-lbl">Avg OVR</div>
                          </div>
                          <div className="pcg-cell pcg-cell-rings">
                            <div className="pcg-val pcg-val-rings">{nflData.rings}</div>
                            <div className="pcg-lbl pcg-lbl-rings">Rings</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`pcg-cell${isAlltimeView ? ' pcg-cell-legend' : ''}`}>
                            <div className="pcg-val">{isRBView ? (isAlltimeView ? mvpCounts.alltimeOpoy : mvpCounts.classicOpoy) : isAlltimeView ? mvpCounts.alltime : mvpCounts.classic}</div>
                            <div className="pcg-lbl">{isRBView ? 'OPOYs' : 'MVPs'}</div>
                          </div>
                          <div className={`pcg-cell${isAlltimeView ? ' pcg-cell-legend' : ''}`}>
                            <div className="pcg-val">{nflData.playoffApps}</div>
                            <div className="pcg-lbl">Playoff Apps</div>
                          </div>
                          <div className={`pcg-cell${isAlltimeView ? ' pcg-cell-legend' : ''}`}>
                            <div className="pcg-val">{nflData.winPct}%</div>
                            <div className="pcg-lbl">Win %</div>
                          </div>
                          <div className={`pcg-cell${isAlltimeView ? ' pcg-cell-legend' : ''}`}>
                            <div className="pcg-val">
                              {show ? (activeNFL === 'rb' ? rbCareerYds.toLocaleString() : activeNFL === 'alltime-qb' ? legendCareerYds.toLocaleString() : activeNFL === 'alltime-rb' ? rbLegendCareerYds.toLocaleString() : careerYds.toLocaleString()) : '–'}
                            </div>
                            <div className="pcg-lbl">{isRBView ? 'Rush Yards' : 'Career Yards'}</div>
                          </div>
                          <div className={`pcg-cell${isAlltimeView ? ' pcg-cell-legend' : ''}`}>
                            <div className="pcg-val">{show ? (activeNFL === 'rb' ? rbCareerTDs : activeNFL === 'alltime-qb' ? legendCareerTDs : activeNFL === 'alltime-rb' ? rbLegendCareerTDs : careerTDs) : '–'}</div>
                            <div className="pcg-lbl">Career TDs</div>
                          </div>
                          <div className={`pcg-cell${isAlltimeView ? ' pcg-cell-legend' : ''}`}>
                            <div className="pcg-val">{nflData.avgOVR}</div>
                            <div className="pcg-lbl">Avg OVR</div>
                          </div>
                          <div className={`pcg-cell pcg-cell-rings${isAlltimeView ? ' pcg-cell-rings--legend' : ''}`}>
                            <div className="pcg-val pcg-val-rings">{nflData.rings}</div>
                            <div className="pcg-lbl pcg-lbl-rings">Rings</div>
                          </div>
                        </>
                      )}
                    </div>
                    {nflData.best && (
                      <div className="prf-best-season">
                        <span className="pbs-lbl">{isAlltimeView ? 'Best All-Time Season' : 'Best Season'}</span>
                        <span className="pbs-val">
                          {nflData.best.wins}–{nflData.best.losses} · {nflData.best.season_tds} TD ·{' '}
                          {isWRView
                            ? `${(nflData.best.season_pass_yds ?? 0).toLocaleString()} rec yds${nflData.best.season_ints ? ` · ${nflData.best.season_ints} rec` : ''}`
                            : `${(nflData.best.season_pass_yds ?? 0).toLocaleString()} ${isRBView ? 'rush yds' : 'yds'}`
                          }
                        </span>
                      </div>
                    )}
                    {!isAlltimeView && (nflData.bestBuild || nflData.worstBuild) && (
                      <div className="prf-build-extremes">
                        {[
                          nflData.bestBuild && { data: nflData.bestBuild, type: 'best', label: 'Best Build' },
                          nflData.worstBuild && nflData.worstBuild.ovr !== nflData.bestBuild?.ovr && { data: nflData.worstBuild, type: 'worst', label: 'Worst Build' },
                        ].filter(Boolean).map(({ data: bd, type, label }) => (
                          <div key={type} className={`prf-build-extreme prf-build-extreme--${type}`}>
                            <div className="pbe-header">
                              <span className="pbe-label">{label}</span>
                              <span className="pbe-ovr">{bd.ovr} OVR</span>
                              {bd.archetype && <span className="pbe-arch">{bd.archetype}</span>}
                            </div>
                            <div className="pbe-slots">
                              {Object.entries(bd.build).map(([slot, d]) => (
                                <div key={slot} className="pbe-slot-row">
                                  <span className="pbe-slot-attr">{ATTR[slot]?.shortLabel ?? slot}</span>
                                  <span className="pbe-slot-qb">{d.qb}</span>
                                  <span className="pbe-slot-grade" style={{ background: ATTR[slot]?.hex ?? '#95d5b2', color: '#111111' }}>{valToGrade(d.val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {section === 'bucket' && (() => {
                const isAlltimeBucket   = bucketCareerMode === 'alltime'
                const activeBucketCareer = isAlltimeBucket ? bucketAlltimeCareer : bucketCareer
                const activeRingSeasons  = isAlltimeBucket ? bucketAlltimeRingSeasons : bucketRingSeasons
                return (
                  <>
                    {/* Classic / All-Time sub-toggle */}
                    {(bucketCareer || bucketAlltimeCareer) && (
                      <div className={`prf-cgame-toggle ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.25s' }}>
                        <button
                          className={`prf-cgame-btn${!isAlltimeBucket ? ' active' : ''}`}
                          onClick={() => { setBucketCareerMode('classic'); setShowRings(false) }}
                        >
                          <div className="prf-cgame-icon-wrap"><BballIcon /></div>
                          <span className="prf-cgame-label">Classic</span>
                        </button>
                        <button
                          className={`prf-cgame-btn${isAlltimeBucket ? ' active' : ''}`}
                          onClick={() => { setBucketCareerMode('alltime'); setShowRings(false) }}
                        >
                          <div className="prf-cgame-icon-wrap">
                            <BballIcon />
                            <span className="prf-cgame-star">★</span>
                          </div>
                          <span className="prf-cgame-label">All-Time</span>
                        </button>
                      </div>
                    )}

                    {/* Empty state */}
                    {!activeBucketCareer && (
                      <div className={`prf-card prf-card-empty ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.3s' }}>
                        <div className="prf-card-hd"><span className="prf-card-title">Career</span></div>
                        <div className="prf-empty-msg">No {isAlltimeBucket ? 'All-Time' : 'Classic'} Build-A-Bucket seasons yet.</div>
                      </div>
                    )}

                    {/* Career card */}
                    {activeBucketCareer && (
                      <div className={`prf-card${isAlltimeBucket ? ' prf-card-legend' : ''} ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.3s' }}>
                        <div className="prf-card-hd">
                          <span className={`prf-card-title${isAlltimeBucket ? ' prf-card-title-legend' : ''}`}>{isAlltimeBucket ? '★ ' : ''}Career</span>
                          <span className="prf-career-count">{activeBucketCareer.count} season{activeBucketCareer.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="prf-career-record">
                          <span className="pcr-w">{activeBucketCareer.totalWins}</span>
                          <span className="pcr-sep">–</span>
                          <span className="pcr-l">{activeBucketCareer.totalLosses}</span>
                          <span className="pcr-label">{isAlltimeBucket ? 'All-Time Record' : 'Career Record'}</span>
                        </div>
                        <div className="prf-career-grid">
                          <div className={`pcg-cell pcg-cell-rings${showRings ? ' open' : ''}`}>
                            <button
                              className={`pcg-cell-rings-btn${showRings ? ' open' : ''}`}
                              onClick={() => setShowRings(v => !v)}
                              disabled={activeBucketCareer.rings === 0}
                            >
                              <div className="pcg-val pcg-val-rings">{activeBucketCareer.rings}</div>
                              <div className="pcg-lbl pcg-lbl-rings">
                                Rings
                                {activeBucketCareer.rings > 0 && (
                                  <span className="pcg-rings-view-row">
                                    <span className="pcg-rings-view-lbl">VIEW</span>
                                    <svg className="pcg-rings-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                  </span>
                                )}
                              </div>
                            </button>
                            {showRings && activeRingSeasons.length > 0 && (
                              <div className="prf-ring-dropdown">
                                {activeRingSeasons.map((s, i) => {
                                  const enriched = enrichBucketBuild(s.build)
                                  const ringTeam = NBA_TEAM_MAP[s.team_short] ?? null
                                  return (
                                    <div key={i} className="prf-ring-season">
                                      <BucketModelFigure build={enriched} team={ringTeam} className="prs-figure-model" headYOffset={5} />
                                      <div className="prs-info">
                                        <div className="prs-header">
                                          <span className="prs-ring">🏆</span>
                                          {ringTeam && <img src={`/logos/nba/${ringTeam.short}.png`} alt={ringTeam.short} className="prs-team-logo" />}
                                          <span className="prs-arch">{s.archetype ?? 'Champion'}</span>
                                          <span className="prs-ovr">{s.ovr} OVR</span>
                                        </div>
                                        {s.finals_opp && s.finals_series ? (
                                          <div className="prs-finals-row">
                                            <img src={`/logos/nba/${s.finals_opp}.png`} alt={s.finals_opp} className="prs-finals-logo" />
                                            <span className="prs-finals-score">{s.finals_series}</span>
                                            <img src={`/logos/nba/${s.team_short}.png`} alt={s.team_short} className="prs-finals-logo" />
                                          </div>
                                        ) : (
                                          <div className="prs-record">{s.wins}–{s.losses}</div>
                                        )}
                                        <div className="prs-stats">
                                          {s.ppg != null && <span>{(+s.ppg).toFixed(1)} PPG</span>}
                                          {s.rpg != null && <span>{(+s.rpg).toFixed(1)} RPG</span>}
                                          {s.apg != null && <span>{(+s.apg).toFixed(1)} APG</span>}
                                          {s.spg != null && <span>{(+s.spg).toFixed(1)} SPG</span>}
                                          {s.bpg != null && <span>{(+s.bpg).toFixed(1)} BPG</span>}
                                        </div>
                                        {(s.mvp === true || s.dpoy === true) && (
                                          <div className="prs-awards">
                                            {s.mvp  === true && <span className="prs-award prs-award--mvp">MVP</span>}
                                            {s.dpoy === true && <span className="prs-award prs-award--dpoy">DPOY</span>}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <div className="pcg-cell"><div className="pcg-val">{activeBucketCareer.mvps}</div><div className="pcg-lbl">MVPs</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{activeBucketCareer.dpoys}</div><div className="pcg-lbl">DPOYs</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{activeBucketCareer.winPct}%</div><div className="pcg-lbl">Win %</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{activeBucketCareer.avgPPG}</div><div className="pcg-lbl">Avg PPG</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{activeBucketCareer.avgOVR}</div><div className="pcg-lbl">Avg OVR</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{activeBucketCareer.count}</div><div className="pcg-lbl">Seasons</div></div>
                        </div>

                        {activeBucketCareer.bestGoatRank && activeBucketCareer.bestGoatSeason && (() => {
                          const s = activeBucketCareer.bestGoatSeason
                          const rank = activeBucketCareer.bestGoatRank
                          return (
                            <div className={`prf-goat-entry${rank <= 10 ? ' pge--elite' : rank <= 25 ? ' pge--great' : ''}`}>
                              <div className="pge-left">
                                <div className="pge-rank">#{rank}</div>
                                <div className="pge-sublbl">Best GOAT Rank</div>
                              </div>
                              <div className="pge-right">
                                <div className="pge-season-line">
                                  <span className="pge-record">{s.wins}–{s.losses}</span>
                                  {s.ovr && <span className="pge-ovr">{s.ovr} OVR</span>}
                                </div>
                                <div className="pge-accolades">
                                  {s.champion && <span className="pge-badge pge-badge--ring">🏆 Champion</span>}
                                  {s.mvp === true && <span className="pge-badge pge-badge--mvp">MVP</span>}
                                  {s.dpoy === true && <span className="pge-badge pge-badge--dpoy">DPOY</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })()}

                        {activeBucketCareer.best && (
                          <div className="prf-best-season">
                            <span className="pbs-lbl">{isAlltimeBucket ? 'Best All-Time Season' : 'Best Season'}</span>
                            <span className="pbs-val">{activeBucketCareer.best.wins}–{activeBucketCareer.best.losses}{activeBucketCareer.best.ppg ? ` · ${activeBucketCareer.best.ppg.toFixed(1)} PPG` : ''}</span>
                          </div>
                        )}
                        {(activeBucketCareer.bestBuild || activeBucketCareer.worstBuild) && (
                          <div className="prf-build-extremes">
                            {[
                              activeBucketCareer.bestBuild  && { data: activeBucketCareer.bestBuild,  type: 'best',  label: 'Best Build' },
                              activeBucketCareer.worstBuild && activeBucketCareer.worstBuild.ovr !== activeBucketCareer.bestBuild?.ovr && { data: activeBucketCareer.worstBuild, type: 'worst', label: 'Worst Build' },
                            ].filter(Boolean).map(({ data: bd, type, label }) => (
                              <div key={type} className={`prf-build-extreme prf-build-extreme--${type}`}>
                                <div className="pbe-header">
                                  <span className="pbe-label">{label}</span>
                                  <span className="pbe-ovr">{bd.ovr} OVR</span>
                                  {bd.archetype && <span className="pbe-arch">{bd.archetype}</span>}
                                </div>
                                <div className="pbe-slots">
                                  {Object.entries(bd.build).map(([slot, d]) => {
                                    const meta = BUCKET_ATTR[slot]
                                    return (
                                      <div key={slot} className="pbe-slot-row">
                                        <span className="pbe-slot-attr">{meta?.shortLabel ?? slot}</span>
                                        <span className="pbe-slot-qb">{d.qb}</span>
                                        <span className="pbe-slot-grade" style={{ background: meta?.hex ?? '#95d5b2', color: '#111111' }}>{valToGrade(d.val)}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Salary career — classic only */}
                    {!isAlltimeBucket && !salaryCareer && hasSalary && (
                      <div className={`prf-card prf-card-empty ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.35s' }}>
                        <div className="prf-card-hd"><span className="prf-card-title">Salary Career</span></div>
                        <div className="prf-empty-msg">No Salary Cap plays yet. Head over and start playing.</div>
                      </div>
                    )}
                    {!isAlltimeBucket && salaryCareer && (
                      <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.35s' }}>
                        <div className="prf-card-hd">
                          <span className="prf-card-title">Salary Career</span>
                          <span className="prf-career-count">{salaryCareer.count} play{salaryCareer.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="prf-career-grid">
                          <div className="pcg-cell"><div className="pcg-val">{salaryCareer.best.overall_score ?? '–'}</div><div className="pcg-lbl">Best Score</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{salaryCareer.avgScore}</div><div className="pcg-lbl">Avg Score</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{salaryCareer.avgPPG}</div><div className="pcg-lbl">Avg PPG</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{salaryCareer.avgRPG}</div><div className="pcg-lbl">Avg RPG</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{salaryCareer.avgAPG}</div><div className="pcg-lbl">Avg APG</div></div>
                          <div className="pcg-cell"><div className="pcg-val">{salaryCareer.count}</div><div className="pcg-lbl">Days Played</div></div>
                        </div>
                        {salaryCareer.best && (
                          <div className="prf-best-season">
                            <span className="pbs-lbl">Best Day</span>
                            <span className="pbs-val">
                              {salaryCareer.best.date_str}
                              {salaryCareer.best.overall_score != null && ` · ${salaryCareer.best.overall_score} pts`}
                              {salaryCareer.best.ppg != null && ` · ${(+salaryCareer.best.ppg).toFixed(1)} PPG`}
                              {salaryCareer.best.budget_used != null && ` · $${salaryCareer.best.budget_used}M used`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )
        })()}

        {/* ── Actions ── */}
        <div className={`prf-actions ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.5s' }}>
          {!showPwForm ? (
            <button className="prf-changepw-btn" onClick={() => { setShowPwForm(true); setPwError(null); setPwSuccess(false) }}>Change Password</button>
          ) : (
            <form className="prf-changepw-form" onSubmit={handleChangePassword}>
              <input
                className="auth-input"
                type="password"
                placeholder="New password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
              />
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm new password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
              />
              {pwError && <div className="auth-error">{pwError}</div>}
              {pwSuccess && <div className="prf-pw-success">Password updated.</div>}
              <div className="prf-changepw-btns">
                <button type="submit" className="prf-changepw-btn" disabled={pwLoading}>{pwLoading ? 'Saving…' : 'Save Password'}</button>
                <button type="button" className="prf-changepw-cancel" onClick={() => { setShowPwForm(false); setPwError(null); setNewPw(''); setConfirmPw('') }}>Cancel</button>
              </div>
            </form>
          )}
          <button className="prf-signout-btn" onClick={handleSignOut}>Sign Out</button>
        </div>

      </div>

      {showSandboxWarning && (
        <div className="sandbox-warning-overlay" onClick={() => setShowSandboxWarning(false)}>
          <div className="sandbox-warning-modal" onClick={e => e.stopPropagation()}>
            <div className="sandbox-warning-title">⚠ Sandbox Mode</div>
            <div className="sandbox-warning-body">Sandbox mode builds will not be saved to your profile or leaderboard. Are you sure you want to continue?</div>
            <div className="sandbox-warning-btns">
              <button className="sandbox-warning-cancel" onClick={() => setShowSandboxWarning(false)}>Cancel</button>
              <button className="sandbox-warning-confirm" onClick={() => { onCustomModeChange?.(true); setShowSandboxWarning(false) }}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
