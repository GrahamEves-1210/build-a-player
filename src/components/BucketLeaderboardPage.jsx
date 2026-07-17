import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { BUCKET_ATTR, GUARD_TYPES, BIG_TYPES, NBA_TEAMS } from '../data/nba-players'
import { valToGrade } from '../utils/simulation'
import NBA_HEADSHOTS from '../data/nba-headshots.json'

const TEAM_COLOR = Object.fromEntries(NBA_TEAMS.map(t => [t.short, t.color]))
const SLOTS = 20

// Approximate GOAT rank from stored simulation columns (no mvp/dpoy stored, so approximation)
function approxGoatRank({ ovr, champion, ppg = 0 }) {
  if (ovr < 92) return null
  const baseRank  = Math.round(75 - ((ovr - 92) / 7) * 68)
  const champBoost = champion ? 4 : 0
  const statBoost  = Math.min(3, Math.round(Math.max(0, ppg - 28) * 0.5))
  let rank = baseRank - statBoost - champBoost
  if (!champion) rank = Math.max(rank, 11)
  return Math.max(1, Math.min(75, rank))
}

function goatTierLabel(rank) {
  if (rank <= 5)  return 'LEGEND'
  if (rank <= 15) return 'ELITE'
  if (rank <= 35) return 'GREAT'
  return 'QUALIFIED'
}

// ─── Metric configs ───────────────────────────────────────────────────────────
const PROFILE_METRICS = [
  { key: 'rings',     label: 'Rings',   fmt: v => v },
  { key: 'winPct',    label: 'Win %',   fmt: v => `${v}%` },
  { key: 'totalWins', label: 'Wins',    fmt: v => v.toLocaleString() },
  { key: 'totalPts',  label: 'Tot Pts', fmt: v => v.toLocaleString() },
  { key: 'avgOvr',    label: 'Avg OVR', fmt: v => v },
  { key: 'avgPpg',    label: 'Avg PPG', fmt: v => `${v}` },
  { key: 'count',     label: 'Seasons', fmt: v => v },
]
const BUILD_METRICS = [
  { key: 'ovr',    label: 'OVR',     fmt: v => v },
  { key: 'lowOvr', label: 'Lowest OVR', fmt: v => v },
  { key: 'ppg',    label: 'PPG',     fmt: v => `${v}` },
]
const DAILY_METRICS = [
  { key: 'rings', label: 'Rings', fmt: v => v },
  { key: 'wins',  label: 'Wins',  fmt: v => v },
  { key: 'ppg',   label: 'PPG',   fmt: v => `${v}` },
]

// ─── Small helpers ────────────────────────────────────────────────────────────
function RankBadge({ rank }) {
  return <div className={`lb-rank-badge lb-rank-${rank <= 3 ? rank : 'n'}`}>{rank}</div>
}

function LBSpinner() {
  return (
    <div className="lb-spinner-wrap">
      <svg className="lb-spinner" viewBox="0 0 36 36">
        <circle className="lb-spinner-track" cx="18" cy="18" r="14" fill="none" strokeWidth="3" />
        <circle className="lb-spinner-arc"   cx="18" cy="18" r="14" fill="none" strokeWidth="3" />
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

function PosBadge({ position }) {
  return (
    <span className="lb-bucket-pos-badge" data-pos={position ?? 'guard'}>
      {position === 'big' ? 'C' : 'G'}
    </span>
  )
}

// ─── Build expand ─────────────────────────────────────────────────────────────
function BucketBuildExpand({ build, position, row }) {
  const types = position === 'big' ? BIG_TYPES : GUARD_TYPES
  const slots = types.filter(k => build?.[k])
  if (!slots.length) return <div className="lb-expand-empty">Build data unavailable</div>

  const { ppg, rpg, apg, fg_pct, three_pct, wins, losses, champion, archetype, team_short } = row
  const teamColor = TEAM_COLOR[team_short] ?? '#888'

  return (
    <div className="lb-bucket-expand">
      <div className="lb-bucket-expand-meta">
        {archetype && <span className="lb-bucket-archetype">{archetype}</span>}
        <span className="lb-bucket-team" style={{ color: teamColor }}>{team_short}</span>
        {champion && <span className="lb-bucket-champ">🏆</span>}
      </div>
      <div className="lb-bucket-stat-line">
        <span>{ppg} PPG</span>
        <span className="lb-stat-dot">·</span>
        <span>{rpg} RPG</span>
        <span className="lb-stat-dot">·</span>
        <span>{apg} APG</span>
        <span className="lb-stat-dot">·</span>
        <span>{fg_pct}% FG</span>
        <span className="lb-stat-dot">·</span>
        <span>{three_pct}% 3P</span>
        <span className="lb-stat-dot">·</span>
        <span>{wins}W {losses}L</span>
      </div>
      <div className="simp-attr-table lb-attr-table">
        {slots.map(k => {
          const slot  = build[k]
          const meta  = BUCKET_ATTR[k]
          const photo = NBA_HEADSHOTS[slot.qb] ? `/headshots/nba/${NBA_HEADSHOTS[slot.qb]}.jpg` : null
          const tc    = TEAM_COLOR[slot.team] ?? '#555'
          return (
            <div key={k} className="simp-attr-row simp-row-visible">
              <div className="simp-qb-avatar" style={{ background: tc, overflow: 'hidden', borderRadius: '50%', width: 42, height: 42, flexShrink: 0 }}>
                {photo && <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />}
              </div>
              <div className="simp-attr-info">
                <span className="simp-attr-name">{meta?.label ?? k}</span>
                <span className="simp-attr-qb">{slot.qb}</span>
              </div>
              <span className="simp-grade-circle" style={{ background: meta?.hex ?? '#888', color: '#111' }}>
                {valToGrade(slot.val)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BucketLeaderboardPage({ onBack, currentUser, adsDisabled = false }) {
  const [view,      setView]      = useState('profiles')
  const [posFilter, setPosFilter] = useState('guard')
  const [sortKey,   setSortKey]   = useState('rings')
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(null)
  const [plusSet,   setPlusSet]   = useState(new Set())

  const metrics = view === 'profiles' ? PROFILE_METRICS
                : view === 'daily'    ? DAILY_METRICS
                :                       BUILD_METRICS

  function switchView(v) {
    setView(v)
    setSortKey(v === 'builds' ? 'ovr' : 'rings')
    setRows([])
    setExpanded(null)
  }

  useEffect(() => {
    if (adsDisabled || window.innerWidth <= 768) return
    window.ramp?.que?.push(() => {
      window.ramp.spaNewPage()
      window.ramp.spaAddAds([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-lb-desktop' }])
    })
  }, [])

  useEffect(() => {
    if (adsDisabled || window.innerWidth > 768) return
    window.ramp?.que?.push(() => {
      window.ramp.spaAddAds([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-lb-mob-top' }])
    })
  }, [])

  useEffect(() => {
    if (adsDisabled || window.innerWidth > 768 || !rows.length) return
    const count = view === 'goat' ? rows.length : SLOTS
    const ads = []
    for (let i = 10; i <= count; i += 10) {
      ads.push({ type: 'standard_iab_cntr1', selectorId: `ramp-cntr1-lb-mob-${i}` })
    }
    if (ads.length) window.ramp?.que?.push(() => window.ramp.spaAddAds(ads))
  }, [rows])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    setRows([])
    setExpanded(null)

    if (view === 'profiles')    fetchProfiles()
    else if (view === 'builds') fetchBuilds()
    else if (view === 'goat')   fetchGoat()
    else                        fetchDaily()
  }, [view, posFilter, sortKey])

  async function fetchProfiles() {
    const { data, error } = await supabase.rpc('get_bucket_leaderboard', { pos_filter: null })
    if (error || !data) { setLoading(false); return }

    let processed = data.map(r => {
      const wins   = Number(r.wins)
      const losses = Number(r.losses)
      const count  = Number(r.count)
      const avgPpg = Number(r.avg_ppg ?? 0)
      return {
        uid:       r.uid,
        username:  r.username,
        wins,
        losses,
        rings:     Number(r.rings),
        count,
        avgOvr:    r.total_ovr && count ? Math.round(Number(r.total_ovr) / count) : 0,
        avgPpg,
        playoffs:  Number(r.playoffs ?? 0),
        totalWins: wins,
        totalPts:  Math.round(avgPpg * count * 82),
        winPct:    wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      }
    })

    // win% requires min 5 seasons to qualify
    const eligible = sortKey === 'winPct' ? processed.filter(r => r.count >= 5) : processed

    eligible.sort((a, b) => {
      if (sortKey === 'winPct')    return b.winPct    - a.winPct
      if (sortKey === 'avgOvr')    return b.avgOvr    - a.avgOvr
      if (sortKey === 'avgPpg')    return b.avgPpg    - a.avgPpg
      if (sortKey === 'count')     return b.count     - a.count
      if (sortKey === 'totalWins') return b.totalWins - a.totalWins
      if (sortKey === 'totalPts')  return b.totalPts  - a.totalPts
      return b.rings - a.rings
    })

    setRows(eligible)

    const uids = eligible.map(r => r.uid).filter(Boolean)
    if (uids.length) {
      const { data: accs } = await supabase
        .from('accounts')
        .select('id, ads_disabled, subscription_status')
        .in('id', uids)
      if (accs) {
        setPlusSet(new Set(accs
          .filter(a => a.ads_disabled || a.subscription_status === 'active')
          .map(a => a.id)))
      }
    }

    setLoading(false)
  }

  async function fetchBuilds(isDaily = false) {
    // lowOvr sorts ovr ascending (worst OVR that still wins); rings maps to champion bool
    const colMap = { rings: 'champion', lowOvr: 'ovr' }
    const col = colMap[sortKey] ?? sortKey
    const asc = sortKey === 'lowOvr'

    let q = supabase
      .from('simulations')
      .select('id, user_id, username, ovr, archetype, position, wins, losses, champion, ppg, rpg, apg, fg_pct, three_pct, team_short, build, created_at')
      .eq('game_mode', 'bucket-classic')
      .not('build', 'is', null)
      .order(col, { ascending: asc })
      .limit(100)

    if (!isDaily) q = q.eq('position', posFilter)

    if (isDaily) {
      const now     = new Date()
      const estOff  = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
      const estDate = new Date(estOff)
      estDate.setHours(0, 0, 0, 0)
      const midnight = new Date(estDate.getTime() + (now.getTime() - new Date(estOff).getTime()))
      q = q.gte('created_at', midnight.toISOString())
    }

    const { data, error } = await q
    if (error || !data) { setLoading(false); return }

    // normalize: expose champion as rings (0/1) for display
    setRows(data.map(r => ({ ...r, rings: r.champion ? 1 : 0 })))
    setLoading(false)
  }

  async function fetchDaily() { fetchBuilds(true) }

  async function fetchGoat() {
    const { data, error } = await supabase
      .from('simulations')
      .select('id, user_id, username, ovr, archetype, position, wins, losses, champion, ppg, rpg, apg, fg_pct, three_pct, team_short, build, created_at')
      .eq('game_mode', 'bucket-classic')
      .gte('ovr', 92)
      .not('build', 'is', null)
      .order('ovr', { ascending: false })
      .limit(300)
    if (error || !data) { setLoading(false); return }
    const ranked = data
      .map(r => ({ ...r, goatRank: approxGoatRank(r) }))
      .filter(r => r.goatRank !== null)
      .sort((a, b) => a.goatRank - b.goatRank)
      .slice(0, 50)
    setRows(ranked)
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded(prev => prev === id ? null : id)
  }

  const meId    = currentUser?.id
  const display = view === 'goat'
    ? rows
    : Array.from({ length: SLOTS }, (_, i) => rows[i] ?? null)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="lb-page" data-sport="bucket">
      <div className="lb-col">

        {/* Header */}
        <div className="lb-hd">
          <button className="lb-back-btn" onClick={onBack}>← Back</button>
          <h2 className="lb-title">Leaderboard</h2>
        </div>

        {/* Mobile ad under title */}
        {!adsDisabled && <div id="ramp-cntr1-lb-mob-top" className="ad-cntr1-mobile" style={{ margin: '4px 0' }} />}

        {/* View tabs */}
        <div className="lb-view-tabs">
          {['profiles', 'builds', 'goat', 'daily'].map(v => (
            <button
              key={v}
              className={`lb-view-tab ${view === v ? 'lb-view-tab-active' : ''}`}
              onClick={() => switchView(v)}
            >
              {v === 'profiles' ? 'Profiles' : v === 'builds' ? 'Builds' : v === 'goat' ? 'GOAT' : 'Daily'}
            </button>
          ))}
        </div>

        {/* Position filter — builds only */}
        {(view === 'builds') && (
          <div className="lb-pos-filter">
            {['guard', 'big'].map(p => (
              <button
                key={p}
                className={`lb-pos-btn ${posFilter === p ? 'lb-pos-btn-active' : ''}`}
                onClick={() => { setPosFilter(p); setRows([]); setLoading(true) }}
              >
                {p === 'guard' ? 'Guards' : 'Bigs'}
              </button>
            ))}
          </div>
        )}

        {/* Sort metric tabs — hidden on GOAT view */}
        {view !== 'goat' && <div className="lb-metrics-row">
          {metrics.map(m => (
            <button
              key={m.key}
              className={`lb-metric-tab ${sortKey === m.key ? 'lb-metric-tab-active' : ''}`}
              onClick={() => { setSortKey(m.key); setRows([]); setLoading(true) }}
            >
              {m.label}
            </button>
          ))}
        </div>}

        {/* Win% qualifier note */}
        {view === 'profiles' && sortKey === 'winPct' && (
          <div className="lb-winpct-note">* Min. 5 seasons to qualify</div>
        )}

        {/* GOAT view description */}
        {view === 'goat' && (
          <div className="lb-winpct-note" style={{ marginBottom: 4 }}>
            Best GOAT rankings ever achieved
          </div>
        )}

        {/* Desktop ad — hidden on mobile */}
        {!adsDisabled && <div id="ramp-cntr1-lb-desktop" className="ad-cntr1-desktop" />}

        {/* List */}
        {loading ? <LBSpinner /> : (
          <div className="lb-list">
            {display.flatMap((row, i) => {
              const delay  = { animationDelay: `${i * 30}ms` }
              const topCls = i < 3 ? ` lb-row-top${i + 1}` : ''
              const metric = metrics.find(m => m.key === sortKey)
              const adAfter = !adsDisabled && (i + 1) % 10 === 0
              const adEl = adAfter
                ? <div key={`lb-mob-ad-${i+1}`} id={`ramp-cntr1-lb-mob-${i+1}`} className="ad-cntr1-mobile lb-list-ad" />
                : null

              let rowEl

              // ── Empty slot ──────────────────────────────────────────────────
              if (!row) {
                rowEl = (
                  <div key={`empty-${i}`} className={`lb-row lb-row-empty${topCls}`} style={delay}>
                    <div className="lb-rank-badge lb-rank-n">{i + 1}</div>
                    <div className="lb-row-info">
                      <div className="lb-row-name-line">
                        <span className="lb-username lb-empty-name">——</span>
                      </div>
                    </div>
                    <span className="lb-row-val lb-empty-val">—</span>
                  </div>
                )

              // ── Profiles ────────────────────────────────────────────────────
              } else if (view === 'profiles') {
                const val    = metric?.fmt(row[sortKey] ?? 0) ?? row[sortKey]
                const isYou  = row.uid === meId
                const isPlus = plusSet.has(row.uid)
                rowEl = (
                  <div key={row.uid} className={`lb-row${topCls}${isYou ? ' lb-row-you' : ''}`} style={delay}>
                    <RankBadge rank={i + 1} />
                    <div className="lb-row-info">
                      <div className="lb-row-name-line">
                        <span className="lb-username">{row.username ?? 'Anonymous'}</span>
                        {isPlus && <span className="lb-plus-badge">+</span>}
                        {isYou  && <span className="lb-you">you</span>}
                      </div>
                      <div className="lb-row-sub">
                        {row.wins}W · {row.losses}L · {row.rings} ring{row.rings !== 1 ? 's' : ''}
                        · {row.playoffs} playoff{row.playoffs !== 1 ? 's' : ''}
                        · {row.count} season{row.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <span className="lb-row-val">{val}</span>
                  </div>
                )

              // ── GOAT ────────────────────────────────────────────────────────
              } else if (view === 'goat') {
                const isYou     = row.user_id === meId
                const tc        = TEAM_COLOR[row.team_short] ?? '#888'
                const tier      = goatTierLabel(row.goatRank)
                const tierColor = row.goatRank <= 5 ? '#f59e0b' : row.goatRank <= 15 ? '#a855f7' : row.goatRank <= 35 ? '#3b82f6' : '#22c55e'
                const isExpanded = expanded === row.id
                rowEl = (
                  <div key={row.id} className={`lb-row lb-row-expandable${topCls}${isYou ? ' lb-row-you' : ''}`} style={delay}>
                    <div className="lb-row-main" onClick={() => row.build && toggleExpand(row.id)}>
                      <div className="lb-rank-badge lb-rank-n" style={{ background: tierColor, color: '#111', fontWeight: 900, fontSize: 13 }}>
                        #{row.goatRank}
                      </div>
                      <div className="lb-row-info">
                        <div className="lb-row-name-line">
                          <span className="lb-username">{row.username ?? 'Anonymous'}</span>
                          <PosBadge position={row.position} />
                          {row.champion && <span className="lb-champ-icon">🏆</span>}
                          {isYou && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          <span style={{ color: tc, fontWeight: 700 }}>{row.team_short}</span>
                          {row.archetype && <> · <span>{row.archetype}</span></>}
                          {' · OVR '}{row.ovr}
                        </div>
                      </div>
                      <div className="lb-row-right">
                        <span style={{ fontSize: 11, fontWeight: 700, color: tierColor, letterSpacing: '0.05em' }}>{tier}</span>
                        {row.build && <ChevronIcon open={isExpanded} />}
                      </div>
                    </div>
                    {isExpanded && row.build && (
                      <BucketBuildExpand build={row.build} position={row.position} row={row} />
                    )}
                  </div>
                )

              // ── Builds + Daily (expandable) ─────────────────────────────────
              } else {
                const dataVal    = sortKey === 'lowOvr' ? row.ovr : row[sortKey]
                const val        = metric?.fmt(dataVal ?? 0) ?? dataVal
                const isYou      = row.user_id === meId
                const tc         = TEAM_COLOR[row.team_short] ?? '#888'
                const isExpanded = expanded === row.id
                rowEl = (
                  <div key={row.id} className={`lb-row lb-row-expandable${topCls}${isYou ? ' lb-row-you' : ''}`} style={delay}>
                    <div className="lb-row-main" onClick={() => row.build && toggleExpand(row.id)}>
                      <RankBadge rank={i + 1} />
                      <div className="lb-row-info">
                        <div className="lb-row-name-line">
                          <span className="lb-username">{row.username ?? 'Anonymous'}</span>
                          <PosBadge position={row.position} />
                          {row.champion && <span className="lb-champ-icon">🏆</span>}
                          {isYou && <span className="lb-you">you</span>}
                        </div>
                        <div className="lb-row-sub">
                          <span style={{ color: tc, fontWeight: 700 }}>{row.team_short}</span>
                          {row.archetype && <> · <span>{row.archetype}</span></>}
                          {' · '}{row.wins}W {row.losses}L
                        </div>
                      </div>
                      <div className="lb-row-right">
                        <span className="lb-row-val">{val}</span>
                        {row.build && <ChevronIcon open={isExpanded} />}
                      </div>
                    </div>
                    {isExpanded && row.build && (
                      <BucketBuildExpand build={row.build} position={row.position} row={row} />
                    )}
                  </div>
                )
              }

              return adEl ? [rowEl, adEl] : [rowEl]
            })}
          </div>
        )}

      </div>
    </div>
  )
}
