import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { BUCKET_ATTR, NBA_TEAMS } from '../data/nba-players'
import { calcBucketOVR, getBucketGuardArchetype, getBucketBigArchetype } from '../utils/bucketSimulation'
import { valToGrade } from '../utils/simulation'

function gradeColor(val) {
  if (val >= 11) return '#a855f7'
  if (val >= 8)  return '#3b82f6'
  if (val >= 5)  return '#22c55e'
  if (val >= 2)  return '#eab308'
  if (val >= 1)  return '#f97316'
  return '#ef4444'
}
import NBA_HEADSHOTS from '../data/nba-headshots.json'

// ─── Shared helpers (mirrors ProfilePage) ────────────────────────────────────
function PrfSpinner() {
  return (
    <div className="lb-spinner-wrap">
      <svg className="lb-spinner" viewBox="0 0 36 36">
        <circle className="lb-spinner-track" cx="18" cy="18" r="14" fill="none" strokeWidth="3" />
        <circle className="lb-spinner-arc"   cx="18" cy="18" r="14" fill="none" strokeWidth="3" />
      </svg>
    </div>
  )
}

function useCountUp(target, duration = 900, enabled = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!enabled || !target) return
    const start = Date.now()
    let raf
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
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

const TEAM_COLOR = Object.fromEntries(NBA_TEAMS.map(t => [t.short, t.color]))

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
  { id: 'trophy',     e: '🏆' }, { id: 'star',   e: '⭐' }, { id: 'basketball', e: '🏀' },
  { id: 'bolt',       e: '⚡' }, { id: 'crown',  e: '👑' }, { id: 'fire',       e: '🔥' },
  { id: 'gem',        e: '💎' }, { id: 'rocket', e: '🚀' }, { id: 'muscle',     e: '💪' },
  { id: 'skull',      e: '💀' }, { id: 'goat',   e: '🐐' },
]

// ─── Main component ───────────────────────────────────────────────────────────
export default function BucketProfilePage({
  user, build, types, position = 'guard', isPlus = false,
  onBack, onSignOut, onAdsDisabled, onThemeChange,
}) {
  const [show,         setShow]         = useState(false)
  const [career,       setCareer]       = useState(null)
  const [careerLoad,   setCareerLoad]   = useState(true)
  const [adFreeLoading, setAdFreeLoading] = useState(false)
  const [activeTheme,  setActiveTheme]  = useState(() => {
    try { return localStorage.getItem('bap_theme') || 'default' } catch { return 'default' }
  })
  const [profileIcon, setProfileIcon] = useState(() => {
    try { return localStorage.getItem('bap_profile_icon') || null } catch { return null }
  })
  const [plusOpen, setPlusOpen] = useState(false)
  const plusRef = useRef(null)

  useEffect(() => {
    if (!plusOpen) return
    const close = e => { if (plusRef.current && !plusRef.current.contains(e.target)) setPlusOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [plusOpen])

  useEffect(() => { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t) }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('ad_free') === '1') {
      onAdsDisabled?.()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // ── Career fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase || !user) { setCareerLoad(false); return }
    supabase
      .from('simulations')
      .select('wins,losses,ppg,rpg,apg,playoffs,champion,ovr,archetype,build,position,created_at')
      .eq('user_id', user.id)
      .eq('game_mode', 'bucket-classic')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) { setCareer(null); setCareerLoad(false); return }
        const totalWins   = data.reduce((s, r) => s + (r.wins  ?? 0), 0)
        const totalLosses = data.reduce((s, r) => s + (r.losses ?? 0), 0)
        const rings       = data.filter(r => r.champion).length
        const playoffApps = data.filter(r => r.playoffs).length
        const totalGames  = totalWins + totalLosses
        const winPct      = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
        const avgOVR      = (data.reduce((s, r) => s + (r.ovr ?? 0), 0) / data.length).toFixed(1)
        const avgPpg      = (data.reduce((s, r) => s + (r.ppg ?? 0), 0) / data.length).toFixed(1)
        const avgRpg      = (data.reduce((s, r) => s + (r.rpg ?? 0), 0) / data.length).toFixed(1)
        const best        = data.reduce((b, r) => (r.wins ?? 0) > (b.wins ?? 0) ? r : b, data[0])
        const withBuilds  = data.filter(r => r.build && r.ovr)
        const bestBuild   = withBuilds.length ? withBuilds.reduce((b, r) => r.ovr > b.ovr ? r : b, withBuilds[0]) : null
        const worstBuild  = withBuilds.length ? withBuilds.reduce((b, r) => r.ovr < b.ovr ? r : b, withBuilds[0]) : null
        setCareer({ count: data.length, totalWins, totalLosses, rings, playoffApps, winPct, avgOVR, avgPpg, avgRpg, best, bestBuild, worstBuild })
        setCareerLoad(false)
      })
  }, [user])

  const handleManageSubscription = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/create-portal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {}
  }

  const handleAdFree = async () => {
    if (adFreeLoading || !user) return
    setAdFreeLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/create-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch { setAdFreeLoading(false) }
  }

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    onSignOut?.()
  }

  const filled   = types.filter(t => build?.[t])
  const ovr      = calcBucketOVR(build || {}, types, position)
  const arch     = (ovr && filled.length === types.length)
    ? (position === 'big' ? getBucketBigArchetype(ovr, build, types) : getBucketGuardArchetype(ovr, build, types))
    : null
  const complete = filled.length === types.length

  const displayName = user.user_metadata?.username || user.email?.split('@')[0] || 'Player'
  const initials    = getInitials(user)
  const since       = formatDate(user.created_at)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="prf-page">
      <div className="prf-col">

        {/* Top nav */}
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
                  {['No ads', 'Custom color themes', 'Custom profile icons', 'PLUS badge on leaderboard'].map(label => (
                    <div key={label} className="wm-plus-perk">
                      <span className="wm-plus-check">✓</span>
                      <span>{label}</span>
                    </div>
                  ))}
                  <button
                    className="plus-subscribe-btn wm-plus-subscribe"
                    disabled={adFreeLoading}
                    onClick={() => { setPlusOpen(false); handleAdFree() }}
                  >
                    {adFreeLoading ? 'Redirecting…' : 'Subscribe — $4.99/mo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hero */}
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

        {/* Plus settings */}
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
                <span className="plus-coming-soon">Not available for Build-A-Bucket yet</span>
              </div>
              <div className="plus-section plus-section--last">
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
                      onClick={() => {
                        setProfileIcon(icon.id)
                        try { localStorage.setItem('bap_profile_icon', icon.id) } catch {}
                      }}
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

        {/* Current Build */}
        {complete && ovr ? (
          <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.2s' }}>
            <div className="prf-card-hd">
              <span className="prf-card-title">Current Build</span>
              {arch && <span className="prf-arch-badge">{arch}</span>}
            </div>
            <div className="prf-ovr-row">
              <div className="prf-ovr-block">
                <div className="prf-ovr-num">{ovr}</div>
                <div className="prf-ovr-lbl">Overall</div>
              </div>
              <div className="prf-attr-bars">
                {filled.map(t => {
                  const meta = BUCKET_ATTR[t]
                  const slot = build[t]
                  return (
                    <StatBar
                      key={t}
                      label={meta?.shortLabel ?? t.slice(0, 3).toUpperCase()}
                      value={slot.val}
                      grade={valToGrade(slot.val)}
                      max={11}
                      color={meta?.hex ?? '#F97316'}
                    />
                  )
                })}
              </div>
            </div>
            <div className="prf-attr-list">
              {filled.map(t => {
                const meta  = BUCKET_ATTR[t]
                const slot  = build[t]
                const photo = slot.photo || (NBA_HEADSHOTS[slot.qbFull] ? `/headshots/nba/${NBA_HEADSHOTS[slot.qbFull]}.jpg` : null)
                const tc    = slot.teamColor || TEAM_COLOR[slot.team] || '#333'
                return (
                  <div key={t} className="prf-attr-row">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: tc, overflow: 'hidden', flexShrink: 0 }}>
                      {photo && <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />}
                    </div>
                    <div className="prf-attr-info">
                      <span className="prf-attr-name">{meta?.label ?? t}</span>
                      <span className="prf-attr-qb">{slot.qbFull ?? slot.qb}</span>
                    </div>
                    <span className="prf-grade" style={{ background: meta?.hex ?? '#F97316', color: '#111' }}>
                      {valToGrade(slot.val)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className={`prf-card prf-card-empty ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.2s' }}>
            <div className="prf-card-hd"><span className="prf-card-title">Current Build</span></div>
            <div className="prf-empty-msg">No build in progress. Head back and start spinning.</div>
          </div>
        )}

        {/* Career Stats */}
        {careerLoad ? (
          <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.3s' }}>
            <div className="prf-card-hd"><span className="prf-card-title">Career</span></div>
            <PrfSpinner />
          </div>
        ) : career ? (
          <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.3s' }}>
            <div className="prf-card-hd">
              <span className="prf-card-title">Career</span>
              <span className="prf-career-count">{career.count} season{career.count !== 1 ? 's' : ''}</span>
            </div>
            <div className="prf-career-record">
              <span className="pcr-w">{career.totalWins}</span>
              <span className="pcr-sep">–</span>
              <span className="pcr-l">{career.totalLosses}</span>
              <span className="pcr-label">Career Record</span>
            </div>
            <div className="prf-career-grid">
              <div className="pcg-cell">
                <div className="pcg-val">{career.playoffApps}</div>
                <div className="pcg-lbl">Playoffs</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{career.winPct}%</div>
                <div className="pcg-lbl">Win %</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{career.avgPpg}</div>
                <div className="pcg-lbl">Avg PPG</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{career.avgRpg}</div>
                <div className="pcg-lbl">Avg RPG</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{career.avgOVR}</div>
                <div className="pcg-lbl">Avg OVR</div>
              </div>
              <div className="pcg-cell pcg-cell-rings">
                <div className="pcg-val pcg-val-rings">{career.rings}</div>
                <div className="pcg-lbl pcg-lbl-rings">Rings</div>
              </div>
            </div>
            {career.best && (
              <div className="prf-best-season">
                <span className="pbs-lbl">Best Season</span>
                <span className="pbs-val">
                  {career.best.wins}–{career.best.losses} · {career.best.ppg} PPG · {career.best.rpg} RPG
                </span>
              </div>
            )}
            {(career.bestBuild || career.worstBuild) && (
              <div className="prf-build-extremes">
                {[
                  career.bestBuild && { data: career.bestBuild, type: 'best', label: 'Best Build' },
                  career.worstBuild && career.worstBuild.ovr !== career.bestBuild?.ovr && { data: career.worstBuild, type: 'worst', label: 'Worst Build' },
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
                          <span className="pbe-slot-attr">{BUCKET_ATTR[slot]?.shortLabel ?? slot}</span>
                          <span className="pbe-slot-qb">{d.qb}</span>
                          <span className="pbe-slot-grade" style={{ background: gradeColor(d.val), color: '#111' }}>
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
        ) : null}

        {/* Sign out */}
        <div className={`prf-actions ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.4s' }}>
          <button className="prf-signout-btn" onClick={handleSignOut}>Sign Out</button>
        </div>

      </div>
    </div>
  )
}
