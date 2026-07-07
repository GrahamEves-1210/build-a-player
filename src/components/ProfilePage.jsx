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
import { ATTR, TYPES } from '../data/qbs'
import { calcOVR, calcOVRRB, getArchetype, getArchetypeRB, valToGrade } from '../utils/simulation'
import QBAvatar from './QBAvatar'
import { supabase } from '../lib/supabase'
import { RB_TYPES } from '../data/rbs'

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

export default function ProfilePage({ user, build, simResult, types = TYPES, isRB = false, isPlus = false, currentPool = [], isCustomMode = false, onCustomModeChange, onCustomRatingsChange, onThemeChange, onBack, onSignOut, onAdsDisabled, onOpenCustomModal }) {
  const [show, setShow]           = useState(false)
  const [career, setCareer]       = useState(null)
  const [careerLoad, setCareerLoad] = useState(true)
  const [rbCareer, setRbCareer]   = useState(null)
  const [rbCareerLoad, setRbCareerLoad] = useState(true)
  const [legendCareer, setLegendCareer] = useState(null)
  const [legendCareerLoad, setLegendCareerLoad] = useState(true)
  const [careerMode, setCareerMode] = useState(isRB ? 'rb' : 'qb')
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
  const plusRef = useRef(null)

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
    if (!supabase || !user) { setRbCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,season_pass_yds,season_tds,playoffs,champion,ovr,archetype,build,created_at')
      .eq('user_id', user.id)
      .ilike('game_mode', 'rb-%')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setRbCareer(null); setRbCareerLoad(false); return }
        const totalWins   = data.reduce((s, r) => s + (r.wins   ?? 0), 0)
        const totalLosses = data.reduce((s, r) => s + (r.losses ?? 0), 0)
        const totalTDs    = data.reduce((s, r) => s + (r.season_tds     ?? 0), 0)
        const totalRushYds= data.reduce((s, r) => s + (r.season_pass_yds ?? 0), 0) // stored in season_pass_yds
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
      .eq('game_mode', 'all-time')
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

  const filled   = types.filter(t => build?.[t])
  const ovr      = isRB ? calcOVRRB(build || {}, types) : calcOVR(build || {}, types)
  const arch     = (ovr && filled.length === types.length) ? (isRB ? getArchetypeRB(ovr, build, types) : getArchetype(ovr, build, types)) : null
  const complete = filled.length === types.length

  const ovrDisplay  = useCountUp(ovr, 1000, show && !!ovr)
  const winsDisplay = useCountUp(simResult?.wins, 800, show && !!simResult)
  const ydsDisplay  = useCountUp(simResult?.seasonPassYds, 1200, show && !!simResult)
  const tdsDisplay  = useCountUp(simResult?.seasonTDs, 900, show && !!simResult)
  const careerYds       = useCountUp(career?.totalYds, 1400, show && !!career)
  const careerTDs       = useCountUp(career?.totalTDs, 1000, show && !!career)
  const rbCareerYds     = useCountUp(rbCareer?.totalRushYds, 1400, show && !!rbCareer)
  const rbCareerTDs     = useCountUp(rbCareer?.totalTDs, 1000, show && !!rbCareer)
  const legendCareerYds = useCountUp(legendCareer?.totalYds, 1400, show && !!legendCareer)
  const legendCareerTDs = useCountUp(legendCareer?.totalTDs, 1000, show && !!legendCareer)

  const displayName = user.user_metadata?.username || user.email?.split('@')[0] || 'Player'
  const initials    = getInitials(user)
  const since       = formatDate(user.created_at)

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    onSignOut?.()
  }

  return (
    <div className="prf-page">
      <div className="prf-col">

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
                    'Custom player ratings',
                    'Manually add players to your build',
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

              <div className="plus-section plus-section--last">
                <div className="plus-ratings-hd">
                  <span className="plus-section-label">Custom Ratings</span>
                  <label className="plus-toggle">
                    <input
                      type="checkbox"
                      checked={isCustomMode}
                      onChange={e => onCustomModeChange?.(e.target.checked)}
                    />
                    <span className="plus-toggle-track" />
                  </label>
                </div>
                <span className="plus-ratings-warn" style={{ visibility: isCustomMode ? 'visible' : 'hidden' }}>Builds won't save</span>
                <button
                  className={`plus-edit-ratings-btn${!isCustomMode ? ' plus-edit-ratings-btn--off' : ''}`}
                  onClick={isCustomMode ? () => onOpenCustomModal?.() : undefined}
                  disabled={!isCustomMode}
                >
                  Edit ratings
                </button>
              </div>

              <button className="plus-manage-btn" onClick={handleManageSubscription}>
                Manage Subscription
              </button>

            </div>
        </div>
        )}

        {/* ── Current build ── */}
        {complete && ovr ? (
          <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.1s' }}>
            <div className="prf-card-hd">
              <span className="prf-card-title">Current Build</span>
              {arch && <span className="prf-arch-badge">{arch}</span>}
            </div>

            <div className="prf-ovr-row">
              <div className="prf-ovr-block">
                <div className="prf-ovr-num">{show ? ovrDisplay || '–' : '–'}</div>
                <div className="prf-ovr-lbl">Overall</div>
              </div>
              <div className="prf-attr-bars">
                {filled.map(t => {
                  const meta = ATTR[t]
                  const data = build[t]
                  return (
                    <StatBar
                      key={t}
                      label={meta.shortLabel}
                      value={data.val}
                      grade={valToGrade(data.val)}
                      max={11}
                      color={meta.hex}
                    />
                  )
                })}
              </div>
            </div>

            <div className="prf-attr-list">
              {filled.map(t => {
                const meta = ATTR[t]
                const data = build[t]
                return (
                  <div key={t} className="prf-attr-row">
                    <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={36} />
                    <div className="prf-attr-info">
                      <span className="prf-attr-name">{meta.label}</span>
                      <span className="prf-attr-qb">{data.qbFull}</span>
                    </div>
                    <span className="prf-grade" style={{ background: meta.hex, color: '#111111' }}>
                      {valToGrade(data.val)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className={`prf-card prf-card-empty ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.1s' }}>
            <div className="prf-card-hd"><span className="prf-card-title">Current Build</span></div>
            <div className="prf-empty-msg">No build in progress. Head back and start spinning.</div>
          </div>
        )}

        {/* ── Career stats — QB / RB toggle ── */}
        {(() => {
          const qbReady = !careerLoad
          const rbReady = !rbCareerLoad
          if (!qbReady || !rbReady) return (
            <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.3s' }}>
              <div className="prf-card-hd"><span className="prf-card-title">Career</span></div>
              <PrfSpinner />
            </div>
          )
          if (!career && !rbCareer) return null

          const showToggle = career && rbCareer
          const active = careerMode === 'rb' && rbCareer ? rbCareer : career
          const isRBView = careerMode === 'rb' && !!rbCareer

          if (!active) return null

          return (
            <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.3s' }}>
              <div className="prf-card-hd">
                <span className="prf-card-title">Career</span>
                <span className="prf-career-count">{active.count} season{active.count !== 1 ? 's' : ''}</span>
              </div>

              {showToggle && (
                <div className="lb-main-seg prf-career-seg">
                  <button
                    className={`lb-main-seg-btn ${careerMode === 'qb' ? 'lb-main-seg-active' : ''}`}
                    onClick={() => setCareerMode('qb')}
                  >
                    QB
                  </button>
                  <button
                    className={`lb-main-seg-btn ${careerMode === 'rb' ? 'lb-main-seg-active' : ''}`}
                    onClick={() => setCareerMode('rb')}
                  >
                    RB
                  </button>
                </div>
              )}

              <div className="prf-career-record">
                <span className="pcr-w">{active.totalWins}</span>
                <span className="pcr-sep">–</span>
                <span className="pcr-l">{active.totalLosses}</span>
                <span className="pcr-label">Career Record</span>
              </div>

              <div className="prf-career-grid">
                <div className="pcg-cell">
                  <div className="pcg-val">{isRBView ? mvpCounts.classicOpoy : mvpCounts.classic}</div>
                  <div className="pcg-lbl">{isRBView ? 'OPOYs' : 'MVPs'}</div>
                </div>
                <div className="pcg-cell">
                  <div className="pcg-val">{active.playoffApps}</div>
                  <div className="pcg-lbl">Playoff Apps</div>
                </div>
                <div className="pcg-cell">
                  <div className="pcg-val">{active.winPct}%</div>
                  <div className="pcg-lbl">Win %</div>
                </div>
                <div className="pcg-cell">
                  <div className="pcg-val">
                    {show ? (isRBView ? rbCareerYds.toLocaleString() : careerYds.toLocaleString()) : '–'}
                  </div>
                  <div className="pcg-lbl">{isRBView ? 'Rush Yards' : 'Career Yards'}</div>
                </div>
                <div className="pcg-cell">
                  <div className="pcg-val">{show ? (isRBView ? rbCareerTDs : careerTDs) : '–'}</div>
                  <div className="pcg-lbl">Career TDs</div>
                </div>
                <div className="pcg-cell">
                  <div className="pcg-val">{active.avgOVR}</div>
                  <div className="pcg-lbl">Avg OVR</div>
                </div>
                <div className="pcg-cell pcg-cell-rings">
                  <div className="pcg-val pcg-val-rings">{active.rings}</div>
                  <div className="pcg-lbl pcg-lbl-rings">Rings</div>
                </div>
              </div>

              {active.best && (
                <div className="prf-best-season">
                  <span className="pbs-lbl">Best Season</span>
                  <span className="pbs-val">
                    {active.best.wins}–{active.best.losses} · {active.best.season_tds} TD · {(active.best.season_pass_yds ?? 0).toLocaleString()} {isRBView ? 'rush yds' : 'yds'}
                  </span>
                </div>
              )}

              {(active.bestBuild || active.worstBuild) && (
                <div className="prf-build-extremes">
                  {[
                    active.bestBuild && { data: active.bestBuild, type: 'best', label: 'Best Build' },
                    active.worstBuild && active.worstBuild.ovr !== active.bestBuild?.ovr && { data: active.worstBuild, type: 'worst', label: 'Worst Build' },
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
                            <span className="pbe-slot-grade" style={{ background: ATTR[slot]?.hex ?? '#95d5b2', color: '#111111' }}>
                              {valToGrade(d.val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Legends career stats ── */}
        {legendCareerLoad && (
          <div className={`prf-card prf-card-legend ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.4s' }}>
            <div className="prf-card-hd"><span className="prf-card-title prf-card-title-legend">★ All-Time Career</span></div>
            <PrfSpinner />
          </div>
        )}
        {!legendCareerLoad && legendCareer && (
          <div className={`prf-card prf-card-legend ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.4s' }}>
            <div className="prf-card-hd">
              <span className="prf-card-title prf-card-title-legend">★ All-Time Career</span>
              <span className="prf-career-count">{legendCareer.count} season{legendCareer.count !== 1 ? 's' : ''}</span>
            </div>

            <div className="prf-career-record">
              <span className="pcr-w">{legendCareer.totalWins}</span>
              <span className="pcr-sep">–</span>
              <span className="pcr-l">{legendCareer.totalLosses}</span>
              <span className="pcr-label">All-Time Record</span>
            </div>

            <div className="prf-career-grid">
              <div className="pcg-cell pcg-cell-legend">
                <div className="pcg-val">{mvpCounts.alltime}</div>
                <div className="pcg-lbl">MVPs</div>
              </div>
              <div className="pcg-cell pcg-cell-legend">
                <div className="pcg-val">{legendCareer.playoffApps}</div>
                <div className="pcg-lbl">Playoffs</div>
              </div>
              <div className="pcg-cell pcg-cell-legend">
                <div className="pcg-val">{legendCareer.winPct}%</div>
                <div className="pcg-lbl">Win %</div>
              </div>
              <div className="pcg-cell pcg-cell-legend">
                <div className="pcg-val">{show ? legendCareerYds.toLocaleString() : '–'}</div>
                <div className="pcg-lbl">Career Yds</div>
              </div>
              <div className="pcg-cell pcg-cell-legend">
                <div className="pcg-val">{show ? legendCareerTDs : '–'}</div>
                <div className="pcg-lbl">Career TDs</div>
              </div>
              <div className="pcg-cell pcg-cell-legend">
                <div className="pcg-val">{legendCareer.avgOVR}</div>
                <div className="pcg-lbl">Avg OVR</div>
              </div>
              <div className="pcg-cell pcg-cell-rings pcg-cell-rings--legend">
                <div className="pcg-val pcg-val-rings">{legendCareer.rings}</div>
                <div className="pcg-lbl pcg-lbl-rings">Rings</div>
              </div>
            </div>

            {legendCareer.best && (
              <div className="prf-best-season">
                <span className="pbs-lbl">Best All-Time Season</span>
                <span className="pbs-val">{legendCareer.best.wins}–{legendCareer.best.losses} · {legendCareer.best.season_tds} TD · {(legendCareer.best.season_pass_yds ?? 0).toLocaleString()} yds</span>
              </div>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div className={`prf-actions ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.5s' }}>
          <button className="prf-signout-btn" onClick={handleSignOut}>Sign Out</button>
        </div>

      </div>
    </div>
  )
}
