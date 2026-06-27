import { useState, useEffect } from 'react'
import { ATTR, TYPES } from '../data/qbs'
import { calcOVR, getArchetype, valToGrade } from '../utils/simulation'
import QBAvatar from './QBAvatar'
import { supabase } from '../lib/supabase'

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

export default function ProfilePage({ user, build, simResult, types = TYPES, onBack, onSignOut, onAdsDisabled }) {
  const [show, setShow]           = useState(false)
  const [career, setCareer]       = useState(null)
  const [careerLoad, setCareerLoad] = useState(true)
  const [legendCareer, setLegendCareer] = useState(null)
  const [legendCareerLoad, setLegendCareerLoad] = useState(true)
  const [adsDisabled, setAdsDisabled] = useState(false)
  const [adFreeLoading, setAdFreeLoading] = useState(false)

  useEffect(() => { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t) }, [])

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('accounts').select('ads_disabled').eq('id', user.id).single()
      .then(({ data }) => { if (data?.ads_disabled) setAdsDisabled(true) })
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

  const handleAdFree = async () => {
    if (adFreeLoading || adsDisabled || !user) return
    setAdFreeLoading(true)
    try {
      const res = await fetch('/api/create-checkout', {
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
      .select('wins,losses,season_pass_yds,season_tds,season_ints,season_rating,playoffs,champion,ovr,created_at')
      .eq('user_id', user.id)
      .neq('game_mode', 'all-time')
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
        setCareer({ count: data.length, totalWins, totalLosses, totalTDs, totalYds, totalINTs, rings, playoffApps, winPct, avgOVR, best })
        setCareerLoad(false)
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
  const ovr      = calcOVR(build || {}, types)
  const arch     = (ovr && filled.length === types.length) ? getArchetype(ovr, build, types) : null
  const complete = filled.length === types.length

  const ovrDisplay  = useCountUp(ovr, 1000, show && !!ovr)
  const winsDisplay = useCountUp(simResult?.wins, 800, show && !!simResult)
  const ydsDisplay  = useCountUp(simResult?.seasonPassYds, 1200, show && !!simResult)
  const tdsDisplay  = useCountUp(simResult?.seasonTDs, 900, show && !!simResult)
  const careerYds       = useCountUp(career?.totalYds, 1400, show && !!career)
  const careerTDs       = useCountUp(career?.totalTDs, 1000, show && !!career)
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
          {!adsDisabled ? (
            <button className="prf-top-adfree" onClick={handleAdFree} disabled={adFreeLoading}>
              {adFreeLoading ? '...' : '✦ Go Ad-Free · $1.99'}
            </button>
          ) : (
            <span className="prf-top-adfree prf-top-adfree--on">✦ Ad-Free</span>
          )}
        </div>

        {/* ── Hero header ── */}
        <div className={`prf-hero ${show ? 'prf-hero-in' : ''}`}>
          <div className="prf-avatar-wrap">
            <div className="prf-avatar">{initials}</div>
            <div className="prf-avatar-ring" />
          </div>
          <div className="prf-identity">
            <div className="prf-name">{displayName}</div>
            {since && <div className="prf-since">Joined {since}</div>}
          </div>
        </div>

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
                    <span className="prf-grade" style={{ background: meta.hex, color: '#07120a' }}>
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

        {/* ── Last season ── */}
        {/* ── Career stats ── */}
        {!careerLoad && career && (
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
                <div className="pcg-val">{career.rings}</div>
                <div className="pcg-lbl">Rings</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{career.playoffApps}</div>
                <div className="pcg-lbl">Playoff Apps</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{career.winPct}%</div>
                <div className="pcg-lbl">Win %</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{show ? careerYds.toLocaleString() : '–'}</div>
                <div className="pcg-lbl">Career Yards</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{show ? careerTDs : '–'}</div>
                <div className="pcg-lbl">Career TDs</div>
              </div>
              <div className="pcg-cell">
                <div className="pcg-val">{career.avgOVR}</div>
                <div className="pcg-lbl">Avg OVR</div>
              </div>
            </div>

            {career.best && (
              <div className="prf-best-season">
                <span className="pbs-lbl">Best Season</span>
                <span className="pbs-val">{career.best.wins}–{career.best.losses} · {career.best.season_tds} TD · {(career.best.season_pass_yds ?? 0).toLocaleString()} yds</span>
              </div>
            )}
          </div>
        )}

        {/* ── Legends career stats ── */}
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
                <div className="pcg-val pcg-val-legend">{legendCareer.rings}</div>
                <div className="pcg-lbl">Rings</div>
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
