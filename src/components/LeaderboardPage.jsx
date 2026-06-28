import { useState, useEffect, useRef } from 'react'
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

export default function LeaderboardPage({ onBack, currentUser, adsDisabled = false }) {
  const [rows, setRows]               = useState([])
  const [bestBuilds, setBestBuilds]   = useState([])
  const [worstBuilds, setWorstBuilds] = useState([])
  const [legendRows, setLegendRows]   = useState([])
  const [buildsLoaded, setBuildsLoaded] = useState(false)
  const [legendLoaded, setLegendLoaded] = useState(false)
  const [loading, setLoading]         = useState(true)
  const [buildsLoading, setBuildsLoading] = useState(false)
  const [legendLoading, setLegendLoading] = useState(false)
  const [metric, setMetric]           = useState('rings')
  const [legendMetric, setLegendMetric] = useState('rings')
  const [view, setView]               = useState('profiles')
  const [buildsTab, setBuildsTab]     = useState('best')
  const [expandedIdx, setExpandedIdx] = useState(null)
  const adInvokedRef = useRef(false)

  useEffect(() => {
    if (adInvokedRef.current || adsDisabled) return
    adInvokedRef.current = true
    window.ramp?.que?.push(() => {
      window.ramp.spaAddAds([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-lb' }])
    })
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    ;(async () => {
      const { data, error } = await supabase.from('leaderboard_profiles')
        .select('user_id, username, wins, losses, yds, tds, rings, count, avg_ovr')
        .limit(10000)
      if (error) console.error('[LB] leaderboard_profiles error:', error)
      const compiled = (data ?? []).filter(r => r.user_id).map(u => {
        const games = u.wins + u.losses
        return {
          uid:    u.user_id,
          username: u.username || `Player_${u.user_id?.slice(0, 5)}`,
          wins:   u.wins   ?? 0,
          losses: u.losses ?? 0,
          yds:    u.yds    ?? 0,
          tds:    u.tds    ?? 0,
          rings:  u.rings  ?? 0,
          count:  u.count  ?? 0,
          avgOvr: u.avg_ovr ?? 0,
          winPct: games > 0 ? +((u.wins / games) * 100).toFixed(1) : 0,
          winPctWeighted: games > 0 ? (u.wins + 17) / (games + 34) * 100 : 0,
        }
      })
      setRows(compiled)
      setLoading(false)
    })()
  }, [])

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

  useEffect(() => { loadLegends() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadLegends = () => {
    if (legendLoaded || !supabase) return
    setLegendLoading(true)
    const PAGE = 1000
    ;(async () => {
      const { count } = await supabase.from('simulations')
        .select('*', { count: 'exact', head: true })
        .or('game_mode.eq.all-time,game_mode.eq.legends')
      const pages = Math.ceil((count ?? PAGE) / PAGE)
      const mkLegendQuery = () => supabase.from('simulations')
        .select('user_id, username, wins, losses, champion, playoffs, ovr, season_pass_yds, season_tds')
        .or('game_mode.eq.all-time,game_mode.eq.legends')
      const results = await Promise.all(
        Array.from({ length: pages }, (_, i) =>
          mkLegendQuery().range(i * PAGE, i * PAGE + PAGE - 1).then(r => r.data ?? [])
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

  const switchBuildsTab = (tab) => { setBuildsTab(tab); setExpandedIdx(null) }
  const toggleExpand = (i) => setExpandedIdx(prev => prev === i ? null : i)

  const activeMetric = METRICS.find(m => m.key === metric)
  const filteredRows = metric === 'avgOvr' ? rows.filter(r => r.count >= 2) : rows
  const sortKey = (r) => metric === 'winPct' ? r.winPctWeighted : r[metric]
  const sorted = [...filteredRows].sort((a, b) => (sortKey(b) - sortKey(a)) || (b.wins - a.wins))
  const profileSlots = Array.from({ length: 20 }, (_, i) => sorted[i] ?? null)

  const buildsList = buildsTab === 'best' ? bestBuilds : worstBuilds
  const buildSlots = Array.from({ length: buildsTab === 'best' ? 200 : 20 }, (_, i) => buildsList[i] ?? null)

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
          <button
            className={`lb-main-seg-btn lb-main-seg-btn-legends ${view === 'legends' ? 'lb-main-seg-active-gold' : ''}`}
            onClick={() => { setView('legends'); loadLegends() }}
          >
            ★ All-Time
          </button>
        </div>

        <div id="ramp-cntr1-lb" className="ad-cntr1-lb" />

        {view === 'legends' ? (
          <>
            <div className="lb-header">
              <div className="lb-title lb-title-legends">★ All-Time Leaderboard</div>
              <div className="lb-subtitle">All-Time mode · career stats · all players ranked</div>
              <div className="lb-header-line lb-header-line-legends" />
            </div>

            <div className="lb-tabs-scroll">
              {METRICS.map(m => (
                <button
                  key={m.key}
                  className={`lb-tab lb-tab-legends ${legendMetric === m.key ? 'lb-tab-active lb-tab-active-legends' : ''}`}
                  onClick={() => setLegendMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {legendLoading ? (
              <div className="lb-loading">Loading...</div>
            ) : legendRows.length === 0 ? (
              <div className="lb-loading lb-legends-empty">No All-Time games played yet.</div>
            ) : (() => {
              const filteredLegend = legendMetric === 'avgOvr' ? legendRows.filter(r => r.count >= 2) : legendRows
              const legendSortKey = (r) => legendMetric === 'winPct' ? r.winPctWeighted : r[legendMetric]
              const sortedLegend = [...filteredLegend].sort((a, b) => (legendSortKey(b) - legendSortKey(a)) || (b.wins - a.wins))
              const activeLegendMetric = METRICS.find(m => m.key === legendMetric)
              return (
                <div className="lb-list" key={legendMetric}>
                  {Array.from({ length: 20 }, (_, i) => sortedLegend[i] ?? null).map((row, i) =>
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
              )
            })()}
          </>
        ) : view === 'profiles' ? (
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
