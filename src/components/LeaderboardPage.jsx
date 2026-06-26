import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ATTR, TEAMS, TYPES } from '../data/qbs'
import { valToGrade } from '../utils/simulation'
import QBAvatar from './QBAvatar'
import HEADSHOTS from '../data/headshots.json'

const METRICS = [
  { key: 'rings',   label: 'Rings',    fmt: v => v },
  { key: 'avgOvr',  label: 'Avg OVR',  fmt: v => v },
  { key: 'wins',    label: 'Wins',     fmt: v => v },
  { key: 'winPct',  label: 'Win %',    fmt: v => `${v}%` },
  { key: 'yds',     label: 'Pass Yds', fmt: v => v.toLocaleString() },
  { key: 'tds',     label: 'Pass TDs', fmt: v => v },
]

// team short → primary color
const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, t.color]))

// qb full name → photo URL (derived at runtime, no DB column needed)
const QB_PHOTO = (name) => HEADSHOTS[name] ? `/headshots/${HEADSHOTS[name]}.jpg` : null

function ovrColor(ovr) {
  if (ovr >= 95) return '#74C69D'
  if (ovr >= 88) return '#95D5B2'
  if (ovr >= 80) return 'var(--text-2)'
  if (ovr >= 72) return 'var(--text-3)'
  return '#f87171'
}

function RankBadge({ rank }) {
  return (
    <div className={`lb-rank-badge lb-rank-${rank <= 3 ? rank : 'n'}`}>{rank}</div>
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

function BuildExpand({ build }) {
  const slots = TYPES.filter(k => build[k])
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
            <span className="simp-grade-circle" style={{ background: meta?.hex, color: '#07120a' }}>
              {valToGrade(data.val)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function LeaderboardPage({ onBack, currentUser }) {
  const [rows, setRows]               = useState([])
  const [bestBuilds, setBestBuilds]   = useState([])
  const [worstBuilds, setWorstBuilds] = useState([])
  const [buildsLoaded, setBuildsLoaded] = useState(false)
  const [loading, setLoading]         = useState(true)
  const [buildsLoading, setBuildsLoading] = useState(false)
  const [metric, setMetric]           = useState('rings')
  const [view, setView]               = useState('profiles')
  const [buildsTab, setBuildsTab]     = useState('best')
  const [expandedIdx, setExpandedIdx] = useState(null)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    // Fetch top 20 for each metric separately with server-side ordering so we
    // always get the true global top regardless of Supabase's default row limit.
    // win% is computed client-side so we fetch top 100 by wins as a superset.
    const q = (col, limit = 20) =>
      supabase.from('leaderboard_profiles').select('*').order(col, { ascending: false }).limit(limit)
    Promise.all([
      q('rings'),
      q('avg_ovr'),
      q('wins'),
      q('wins', 100), // superset for win% (computed client-side)
      q('yds'),
      q('tds'),
    ]).then(results => {
      const err = results.find(r => r.error)
      if (err) console.error('[build-a-player] leaderboard_profiles query failed:', err.error)

      // Merge all result rows into one deduplicated map keyed by user_id.
      // Each metric query returns the true top for that column so the union
      // covers the true top 20 for every displayable metric.
      const byUid = new Map()
      const allRows = results.flatMap(r => r.data ?? [])
      for (const u of allRows) {
        const uid = u.user_id
        if (!uid) continue
        if (!byUid.has(uid)) {
          byUid.set(uid, {
            user_id: uid,
            username: u.username || null,
            wins:    u.wins    ?? 0,
            losses:  u.losses  ?? 0,
            yds:     u.yds     ?? 0,
            tds:     u.tds     ?? 0,
            rings:   u.rings   ?? 0,
            count:   u.count   ?? 0,
            avg_ovr: u.avg_ovr ?? 0,
          })
        } else {
          // Same user appeared in multiple metric queries — take max per column
          // (the view already aggregates per user so values should be identical;
          //  taking max is safe and handles any view-grouping duplicates)
          const acc = byUid.get(uid)
          acc.wins    = Math.max(acc.wins,    u.wins    ?? 0)
          acc.losses  = Math.max(acc.losses,  u.losses  ?? 0)
          acc.yds     = Math.max(acc.yds,     u.yds     ?? 0)
          acc.tds     = Math.max(acc.tds,     u.tds     ?? 0)
          acc.rings   = Math.max(acc.rings,   u.rings   ?? 0)
          acc.count   = Math.max(acc.count,   u.count   ?? 0)
          acc.avg_ovr = Math.max(acc.avg_ovr, u.avg_ovr ?? 0)
          if (!acc.username && u.username) acc.username = u.username
        }
      }
      const compiled = Array.from(byUid.values()).map(u => {
        const games = u.wins + u.losses
        return {
          uid:    u.user_id,
          username: u.username || `Player_${u.user_id?.slice(0, 5)}`,
          wins:   u.wins,
          losses: u.losses,
          yds:    u.yds,
          tds:    u.tds,
          rings:  u.rings,
          count:  u.count,
          avgOvr: +(u.avg_ovr).toFixed(1),
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
        }
      })
      setRows(compiled)
      setLoading(false)
    })
  }, [])

  const loadBuilds = () => {
    if (buildsLoaded || !supabase) return
    setBuildsLoading(true)
    const bestQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .neq('game_mode', 'lite')
      .not('build', 'is', null)
      .gte('ovr', 80)
      .order('ovr', { ascending: false })
      .order('wins', { ascending: false })
      .limit(50)
    const worstQ = supabase
      .from('simulations')
      .select('user_id, username, wins, losses, ovr, build, game_mode')
      .neq('game_mode', 'lite')
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

  const switchBuildsTab = (tab) => { setBuildsTab(tab); setExpandedIdx(null) }
  const toggleExpand = (i) => setExpandedIdx(prev => prev === i ? null : i)

  const activeMetric = METRICS.find(m => m.key === metric)
  const sorted = [...rows].sort((a, b) => (b[metric] - a[metric]) || (b.wins - a.wins))
  const profileSlots = Array.from({ length: 20 }, (_, i) => sorted[i] ?? null)

  const buildsList = buildsTab === 'best' ? bestBuilds : worstBuilds
  const buildSlots = Array.from({ length: buildsTab === 'best' ? 50 : 20 }, (_, i) => buildsList[i] ?? null)

  return (
    <div className="lb-page">
      <div className="lb-col">

        <button className="prf-top-back" onClick={onBack}>← Back to Build</button>

        {/* Main toggle pill */}
        <div className="lb-main-seg">
          <button
            className={`lb-main-seg-btn ${view === 'profiles' ? 'lb-main-seg-active' : ''}`}
            onClick={() => setView('profiles')}
          >
            Profiles
          </button>
          <button
            className={`lb-main-seg-btn ${view === 'builds' ? 'lb-main-seg-active' : ''}`}
            onClick={() => { setView('builds'); loadBuilds() }}
          >
            Builds
          </button>
        </div>

        {view === 'profiles' ? (
          <>
            <div className="lb-header">
              <div className="lb-title">Leaderboard</div>
              <div className="lb-subtitle">Career stats · all players ranked</div>
              <div className="lb-header-line" />
            </div>

            <div className="lb-tabs-scroll">
              {METRICS.map(m => (
                <button
                  key={m.key}
                  className={`lb-tab ${metric === m.key ? 'lb-tab-active' : ''}`}
                  onClick={() => setMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="lb-loading">Loading...</div>
            ) : (
              <div className="lb-list" key={metric}>
                {profileSlots.map((row, i) =>
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
                          {currentUser && row.uid === currentUser.id && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''} · {row.count} season{row.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="lb-row-val">{activeMetric.fmt(row[metric])}</div>
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
        ) : (
          <>
            <div className="lb-header">
              <div className="lb-title">Builds</div>
              <div className="lb-subtitle">Best and worst builds</div>
              <div className="lb-header-line" />
            </div>

            <div className="lb-tabs-scroll">
              <button
                className={`lb-tab ${buildsTab === 'best' ? 'lb-tab-active' : ''}`}
                onClick={() => switchBuildsTab('best')}
              >
                Best
              </button>
              <button
                className={`lb-tab ${buildsTab === 'worst' ? 'lb-tab-active' : ''}`}
                onClick={() => switchBuildsTab('worst')}
              >
                Worst
              </button>
            </div>

            {buildsLoading ? (
              <div className="lb-loading">Loading...</div>
            ) : (
              <div className="lb-list" key={buildsTab}>
                {buildSlots.map((row, i) =>
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
                          <BuildExpand build={row.build || {}} />
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

      </div>
    </div>
  )
}
