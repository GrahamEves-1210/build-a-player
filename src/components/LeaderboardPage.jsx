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
  const [loading, setLoading]         = useState(true)
  const [metric, setMetric]           = useState('rings')
  const [view, setView]               = useState('profiles')
  const [buildsTab, setBuildsTab]     = useState('best')
  const [expandedIdx, setExpandedIdx] = useState(null)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase
      .from('simulations')
      .select('user_id, username, wins, losses, season_pass_yds, season_tds, champion, ovr, build, game_mode')
      .then(({ data, error }) => {
        if (!data || error) { setLoading(false); return }

        const byUser = {}
        data.forEach(r => {
          const uid = r.user_id
          if (!byUser[uid]) byUser[uid] = { uid, username: r.username || `Player_${uid.slice(0,5)}`, wins: 0, losses: 0, yds: 0, tds: 0, rings: 0, ovrSum: 0, count: 0 }
          const u = byUser[uid]
          if (r.username) u.username = r.username
          u.wins   += r.wins ?? 0
          u.losses += r.losses ?? 0
          u.yds    += r.season_pass_yds ?? 0
          u.tds    += r.season_tds ?? 0
          u.rings  += r.champion ? 1 : 0
          u.ovrSum += r.ovr ?? 0
          u.count  += 1
        })

        const compiled = Object.values(byUser).map(u => {
          const games = u.wins + u.losses
          return {
            ...u,
            winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
            avgOvr: u.count > 0 ? +(u.ovrSum / u.count).toFixed(1) : 0,
          }
        })
        setRows(compiled)

        const classicOnly = data.filter(r => r.game_mode !== 'lite')

        setBestBuilds(
          [...classicOnly]
            .filter(r => (r.ovr ?? 0) >= 80)
            .sort((a, b) => (b.ovr - a.ovr) || (b.wins - a.wins))
            .slice(0, 10)
        )
        setWorstBuilds(
          [...classicOnly]
            .filter(r => (r.ovr ?? 0) <= 80)
            .sort((a, b) => (a.ovr - b.ovr) || (a.wins - b.wins))
            .slice(0, 10)
        )

        setLoading(false)
      })
  }, [])

  const switchBuildsTab = (tab) => { setBuildsTab(tab); setExpandedIdx(null) }
  const toggleExpand = (i) => setExpandedIdx(prev => prev === i ? null : i)

  const activeMetric = METRICS.find(m => m.key === metric)
  const sorted = [...rows].sort((a, b) => b[metric] - a[metric])
  const profileSlots = Array.from({ length: 10 }, (_, i) => sorted[i] ?? null)

  const buildsList = buildsTab === 'best' ? bestBuilds : worstBuilds
  const buildSlots = Array.from({ length: 10 }, (_, i) => buildsList[i] ?? null)

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
            onClick={() => setView('builds')}
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

            {loading ? (
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
