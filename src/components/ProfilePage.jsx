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

export default function ProfilePage({ user, build, simResult, types = TYPES, onBack, onSignOut }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t) }, [])

  const filled   = types.filter(t => build?.[t])
  const ovr      = calcOVR(build || {}, types)
  const arch     = (ovr && filled.length === types.length) ? getArchetype(ovr, build, types) : null
  const complete = filled.length === types.length

  const ovrDisplay  = useCountUp(ovr, 1000, show && !!ovr)
  const winsDisplay = useCountUp(simResult?.wins, 800, show && !!simResult)
  const ydsDisplay  = useCountUp(simResult?.seasonPassYds, 1200, show && !!simResult)
  const tdsDisplay  = useCountUp(simResult?.seasonTDs, 900, show && !!simResult)

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
        <button className="prf-top-back" onClick={onBack}>← Back to Build</button>

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
        {simResult ? (
          <div className={`prf-card ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.2s' }}>
            <div className="prf-card-hd">
              <span className="prf-card-title">Last Season</span>
              <span className={`prf-outcome-badge ${simResult.sbResult?.won ? 'pob-champ' : simResult.playoffs ? 'pob-playoffs' : 'pob-miss'}`}>
                {simResult.sbResult?.won ? 'Super Bowl Champion' : simResult.playoffs ? 'Playoff Bound' : 'Missed Playoffs'}
              </span>
            </div>

            <div className="prf-record-hero">
              <span className="prh-w">{show ? winsDisplay : '–'}</span>
              <span className="prh-sep">–</span>
              <span className="prh-l">{simResult.losses}</span>
            </div>

            <div className="prf-season-grid">
              <div className="psg-cell">
                <div className="psg-val">{show ? ydsDisplay.toLocaleString() : '–'}</div>
                <div className="psg-lbl">Pass Yards</div>
              </div>
              <div className="psg-cell">
                <div className="psg-val">{show ? tdsDisplay : '–'}</div>
                <div className="psg-lbl">Touchdowns</div>
              </div>
              <div className="psg-cell">
                <div className="psg-val">{simResult.seasonINTs}</div>
                <div className="psg-lbl">Interceptions</div>
              </div>
              <div className="psg-cell">
                <div className="psg-val">{simResult.seasonRating}</div>
                <div className="psg-lbl">QB Rating</div>
              </div>
            </div>

            {simResult.bestGame && (
              <div className="prf-best-game">
                <span className="pbg-lbl">Best Game</span>
                <span className="pbg-body">
                  Wk {simResult.bestGame.wk} vs {simResult.bestGame.opponent} — {simResult.bestGame.passYds} yds · {simResult.bestGame.tds} TD · {simResult.bestGame.rating} RTG
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className={`prf-card prf-card-empty ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.2s' }}>
            <div className="prf-card-hd"><span className="prf-card-title">Last Season</span></div>
            <div className="prf-empty-msg">No season simulated yet. Complete your build and hit Simulate.</div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className={`prf-actions ${show ? 'prf-card-in' : ''}`} style={{ animationDelay: '0.3s' }}>
          <button className="prf-signout-btn" onClick={handleSignOut}>Sign Out</button>
        </div>

      </div>
    </div>
  )
}
