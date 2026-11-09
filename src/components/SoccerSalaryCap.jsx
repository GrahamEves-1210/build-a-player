import React, { useState, useMemo, useEffect } from 'react'
import { NameTag } from './app/NameTag'
import { SOCCER_CLUBS } from '../data/soccer-clubs'
import { WC_NATIONS } from '../data/soccer-nations'
import SOCCER_HEADSHOTS from '../data/soccer-headshots.json'
import { SOCCER_SAL_POOL as ALL_PLAYERS, SOCCER_SAL_COLS as SAL_COLS, soccerSalTypesFor as typesFor, soccerSalBuild, soccerSalStats } from '../data/soccer-salary'
import { salaryKit, seededRandom, TIERS, TIER_BANDS, BUDGET_OPTIONS, RECENT_PENALTY, budgetForDateStr } from '../lib/salaryCore'
import { supabase } from '../lib/supabase'
import { valToGrade, HEADSHOT_BASE } from '../utils/simulation'
import { getUsername } from '../lib/discord'

// ═════════════════════════════════════════════════════════════════════════════
// SALARY CAP (soccer): the parallel of BucketSalaryCap.jsx. A daily board of five columns ×
// five price tiers (lib/salaryCore.js, the same board maker the live server checks against),
// one pick per column inside the day's budget, then a club season (SoccerApp
// handleSalaryCapConfirm). Infinite boards, one shuffle and one scout, the day's frozen board.
//
// Supabase tables (supabase/soccer_salary.sql):
//   soccer_salary_cap_grids      date_str → the day's frozen board
//   soccer_salary_cap_plays      a daily play: picks, overall_score, goals, assists, budget_used
//   soccer_salary_infinite_plays an Infinite play, the same columns minus date_str
// ═════════════════════════════════════════════════════════════════════════════
export { SAL_COLS }
const T = { grids: 'soccer_salary_cap_grids', plays: 'soccer_salary_cap_plays', infinite: 'soccer_salary_infinite_plays' }

// ─── EST date helpers ──────────────────────────────────────────────────────────
function getESTDate(daysOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  const ed  = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const y   = ed.getFullYear()
  const m   = ed.getMonth() + 1
  const day = ed.getDate()
  return {
    str:   `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    seed:  y * 10000 + m * 100 + day,
    label: ed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    day, m, y,
  }
}

// ─── The cards: club crest (or nation flag), club colours, ESPN photo or none ───
const CLUB_META = Object.fromEntries(SOCCER_CLUBS.map(t => [t.short, t]))
const NATION_META = Object.fromEntries(WC_NATIONS.map(t => [t.short, t]))
const metaOf = p => (p.teamKind === 'nation' ? NATION_META : CLUB_META)[p.team]
const logoOf = p => `${p.teamKind === 'nation' ? '/logos/nations/' : '/logos/soccer/'}${p.team}.png`
const photoOf = p => { const f = p?.espn != null ? SOCCER_HEADSHOTS[String(p.espn)] : null; return f ? `${HEADSHOT_BASE}/${String(f).replace(/\.(webp|png|jpe?g)$/i, '')}.webp` : null }
const look = p => { const t = metaOf(p); return { teamColor: t?.color ?? '#444', teamColor2: t?.color2 ?? '#222', photo: photoOf(p) } }
const _playerMap = new Map(ALL_PLAYERS.map(p => [p.name, p]))

// (the five picks fill all ten traits, so the season page shows the striker's own ten:
// no stand-in traits like basketball's SAL_REP_TYPES)

// ─── Score: each column's best card rating (basketball's calcStats) ────────────
function calcStats(sel) {
  const scoreFor = ci => {
    const p = sel[ci]
    if (!p?.attrs) return 5
    const vals = Object.values(p.attrs)
    return vals.length ? Math.max(...vals) : 5
  }
  return soccerSalStats(SAL_COLS.map((_, ci) => scoreFor(ci)))
}

// (soccer's own keys: a basketball board played today is a different board)
const PLAYED_KEY     = (str, uid) => uid ? `soc_sal_play_${uid}_${str}`     : `soc_sal_play_${str}`
const SHUFFLED_KEY   = (str, uid) => uid ? `soc_sal_shuffled_${uid}_${str}` : `soc_sal_shuffled_${str}`
const parseShuffle = saved => {
  try { const v = JSON.parse(saved); return { col: v?.players ? { [v.ci]: v.players } : {}, row: v?.row ? { [v.ti]: v.row } : {} } } catch { return { col: {}, row: {} } }
}
const SCOUTED_KEY    = (str, uid) => uid ? `soc_sal_scouted_${uid}_${str}`  : `soc_sal_scouted_${str}`
const POWER_SEEN_KEY = 'sal_power_seen'
const ls = { get: k => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch {} } }

// the board itself: lib/salaryCore.js (the live server checks plays against the same board)
const { getPickedNamesForSeed, generateGrid } = salaryKit({ typesFor, look })

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isNearBlack(hex) {
  if (!hex) return false
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r + g + b) / 3 < 50
}

function calcGrade(player) {
  const vals = Object.values(player.attrs ?? {})
  if (!vals.length) return 'C'
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  return valToGrade(avg)
}

function gradeColor(g) {
  if (g === 'S')          return '#a855f7'
  if (g.startsWith('A')) return '#22c55e'
  if (g.startsWith('B')) return '#60a5fa'
  if (g.startsWith('C')) return '#f59e0b'
  if (g.startsWith('D')) return '#f97316'
  return '#ef4444'
}

// a one-word name (Rodri, Raphinha) is all surname
const splitName = name => { const [first, ...rest] = String(name).split(' '); return rest.length ? [first, rest.join(' ')] : ['', first] }

// ─── PlayerCard ───────────────────────────────────────────────────────────────
function PlayerCard({ player, isSelected, colHasSelection, onClick, viewOnly, shufflePhase, shuffleDelay = 0, scoutGrade = null, shuffleHighlight = null }) {
  const dimmed = colHasSelection && !isSelected
  const [first, last] = splitName(player.name)
  const animClass = shufflePhase === 'out' ? ' sc-card--flip-out' : shufflePhase === 'in' ? ' sc-card--flip-in' : ''
  const hlClass = shuffleHighlight === 'col' ? ' sc-card--hl-col' : shuffleHighlight === 'row' ? ' sc-card--hl-row' : ''
  const logo = logoOf(player)
  return (
    <button
      onClick={viewOnly ? undefined : onClick}
      className={`sc-card${isSelected ? ' sc-card--sel' : ''}${dimmed ? ' sc-card--dim' : ''}${viewOnly ? ' sc-card--view' : ''}${animClass}${hlClass}`}
      style={{ '--tc': player.teamColor, '--sel': isNearBlack(player.teamColor) ? '#888' : player.teamColor, '--sd': `${shuffleDelay}ms` }}
    >
      <div className="sc-card-visual">
        <img src={logo} alt="" aria-hidden="true" className="sc-card-logo-bg"
          onError={e => { e.currentTarget.style.display = 'none' }} />
        {player.photo
          ? <img src={player.photo} alt={player.name} className="sc-card-headshot" />
          : <div className="sc-card-no-photo">
              <img src={logo} alt={player.team} style={{ width: '55%', opacity: 0.7 }} onError={e => { e.currentTarget.style.display = 'none' }} />
            </div>
        }
      </div>
      <div className="sc-card-name-wrap">
        <span className="sc-card-first">{first || ' '}</span>
        <span className="sc-card-last">{last}</span>
      </div>
      {scoutGrade && (
        <div className="sc-grade-overlay" style={{ '--gc': gradeColor(scoutGrade) }}>
          <span className="sc-grade-letter">{scoutGrade}</span>
        </div>
      )}
    </button>
  )
}

// ─── BudgetBar ────────────────────────────────────────────────────────────────
function BudgetBar({ spent, total, pickedAll }) {
  const pct   = Math.min(1, spent / total) * 100
  const over  = spent > total
  const exact = spent === total && pickedAll
  const col   = over ? '#ef4444' : exact ? '#a855f7' : spent >= total - 10 ? '#f59e0b' : '#34d399'
  return (
    <div className="sc-budget">
      <div className="sc-budget-label">
        <span style={{ color: over ? '#ef4444' : exact ? '#a855f7' : '#fff', fontWeight: 900 }}>€{spent}M</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}> / €{total}M</span>
      </div>
      <div className="sc-budget-track">
        <div className="sc-budget-fill" style={{ width: `${pct}%`, background: col }} />
      </div>
    </div>
  )
}

// ─── DatePicker ───────────────────────────────────────────────────────────────
function DatePicker({ activeDate, dates, onSelect, mode, onInfinite }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sc-date-wrap">
      <button className="sc-date-btn" onClick={() => setOpen(v => !v)}>
        {mode === 'infinite'
          ? <>
              <span className="sc-date-day sc-date-day--inf">∞</span>
              <span className="sc-date-month">INF</span>
            </>
          : <>
              <span className="sc-date-day">{activeDate.day}</span>
              <span className="sc-date-month">{activeDate.label.split(' ')[0].toUpperCase()}</span>
            </>
        }
      </button>
      {open && (
        <>
          <div className="sc-date-backdrop" onClick={() => setOpen(false)} />
          <div className="sc-date-dropdown">
            <button
              className={`sc-date-item sc-date-item--inf${mode === 'infinite' ? ' sc-date-item--active' : ''}`}
              onClick={() => { onInfinite(); setOpen(false) }}
            >
              <span className="sc-date-item-label">∞ Infinite</span>
              {mode === 'infinite' && <span className="sc-date-item-reset">tap to reset</span>}
            </button>
            {dates.map(date => (
              <button
                key={date.str}
                className={`sc-date-item${mode === 'daily' && activeDate.str === date.str ? ' sc-date-item--active' : ''}`}
                onClick={() => { onSelect(date); setOpen(false) }}
              >
                <span className="sc-date-item-label">{date.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── The boards in the corner: a day's top builds, or Infinite's ever ─────────
const byScore = rows => [...(rows || [])].sort((a, b) => (b.overall_score - a.overall_score) || (((b.goals ?? 0) + (b.assists ?? 0)) - ((a.goals ?? 0) + (a.assists ?? 0))))
function PickFaces({ picks }) {
  return (
    <div className="sc-lb-picks">
      {picks.map((p, pi) => {
        const real = _playerMap.get(p.name)
        return (
          <div key={pi} className="sc-lb-pick" title={p.name} style={{ '--tc': p.teamColor || '#444' }}>
            {p.photo
              ? <img src={p.photo} alt={p.name} />
              : <img src={real ? logoOf(real) : `/logos/soccer/${p.team}.png`} alt={p.team} style={{ padding: '4px', opacity: 0.7 }} onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
            }
          </div>
        )
      })}
    </div>
  )
}

function SalaryBoard({ title, rows, budget = null }) {
  return (
    <div className="sc-lb-dropdown">
      <div className="sc-lb-header"><span className="sc-lb-title">{title}</span></div>
      {rows === null && <div className="sc-lb-empty">Loading…</div>}
      {rows !== null && rows.length === 0 && <div className="sc-lb-empty">No builds yet. Be the first!</div>}
      {rows !== null && rows.map((r, i) => (
        <div key={i} className={`sc-lb-row${i === 0 ? ' sc-lb-row--top' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
          <div className="sc-lb-row-main">
            <span className="sc-lb-rank">{i + 1}</span>
            <span className="sc-lb-name">{r.username ? <NameTag name={r.username} uid={r.user_id ?? null} /> : 'Guest'}</span>
            <span className="sc-lb-ovr">{r.overall_score} OVR</span>
            {budget != null && r.budget_used != null && budget - r.budget_used > 0 && (
              <span className="sc-lb-spare">+€{budget - r.budget_used}M</span>
            )}
          </div>
          {r.picks && <PickFaces picks={r.picks} />}
        </div>
      ))}
    </div>
  )
}

function InfiniteLeaderboard({ onClose }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!supabase) { setRows([]); return }
    supabase.from(T.infinite)
      .select('username, user_id, picks, overall_score, goals, assists')
      .order('overall_score', { ascending: false })
      .limit(10)
      .then(({ data }) => setRows(byScore(data).slice(0, 10)), () => setRows([]))
  }, [])
  return (
    <>
      <div className="sc-lb-backdrop" onClick={onClose} />
      <SalaryBoard title="ALL-TIME TOP BUILDS" rows={rows} />
    </>
  )
}

function SalaryLeaderboard({ dateStr, dateLabel, onClose }) {
  const [rows, setRows] = useState(null)
  const budget = budgetForDateStr(dateStr)
  useEffect(() => {
    if (!supabase) { setRows([]); return }
    supabase.from(T.plays)
      .select('username, user_id, picks, overall_score, goals, assists, budget_used')
      .eq('date_str', dateStr)
      .order('overall_score', { ascending: false })
      .limit(200)
      .then(({ data }) => setRows(byScore(data).slice(0, 10)), () => setRows([]))
  }, [dateStr])
  return (
    <>
      <div className="sc-lb-backdrop" onClick={onClose} />
      <SalaryBoard title={`${dateLabel?.toUpperCase() ?? 'TODAY'}'S TOP BUILDS`} rows={rows} budget={budget} />
    </>
  )
}

// ─── SoccerSalaryCap ──────────────────────────────────────────────────────────
export default function SoccerSalaryCap({ onConfirm, onBack, user, initialDateStr }) {
  const dates      = useMemo(() => Array.from({ length: 10 }, (_, i) => getESTDate(-i)), [])
  const [activeDate,    setActiveDate]    = useState(() => (initialDateStr && dates.find(d => d.str === initialDateStr)) || getESTDate(0))
  const [sel,           setSel]           = useState({})
  const [alreadyPlayed, setAlreadyPlayed] = useState(null)
  const [showLB,        setShowLB]        = useState(false)
  const [showLBPrompt,  setShowLBPrompt]  = useState(false)
  const [shufflesLeft,    setShufflesLeft]    = useState(() => ls.get(SHUFFLED_KEY(getESTDate(0).str, user?.id)) ? 0 : 1)
  const [shuffleOverride, setShuffleOverride] = useState(() => {
    const saved = ls.get(SHUFFLED_KEY(getESTDate(0).str, user?.id))
    return saved ? parseShuffle(saved).col : {}
  })
  const [shufflingCol,    setShufflingCol]    = useState(null)
  const [shufflingRow,    setShufflingRow]    = useState(null)
  const [rowOverrides,    setRowOverrides]    = useState(() => {
    const saved = ls.get(SHUFFLED_KEY(getESTDate(0).str, user?.id))
    return saved ? parseShuffle(saved).row : {}
  })
  const [shufflePhase,    setShufflePhase]    = useState(null)
  const [shuffleMode,     setShuffleMode]     = useState(false)
  const [hoveredShuffle,  setHoveredShuffle]  = useState(null)
  const [scoutsLeft,      setScoutsLeft]      = useState(() => ls.get(SCOUTED_KEY(getESTDate(0).str, user?.id)) ? 0 : 1)
  const [scoutMode,       setScoutMode]       = useState(false)
  const [scoutedGrades,   setScoutedGrades]   = useState({})
  const [powerMenuOpen,   setPowerMenuOpen]   = useState(false)
  const [powerSeen,       setPowerSeen]       = useState(() => !!ls.get(POWER_SEEN_KEY))
  const [mode,            setMode]            = useState('daily')
  const [infiniteSeed,    setInfiniteSeed]    = useState(() => Math.random() * 0x7FFFFFFF | 0)
  const [infShufflesLeft, setInfShufflesLeft] = useState(1)
  const [infScoutsLeft,   setInfScoutsLeft]   = useState(1)

  // A day's board is frozen in soccer_salary_cap_grids the first time it's made, so it never
  // drifts out from under players who already played it when the ratings change. A stored
  // board is only as good as whoever wrote it, so it's taken only if it checks out (every
  // price its tier's, real players at real ratings, nobody far cheaper than their rank);
  // photos are always our own. Anything else: this phone's own board.
  const recentFor = (date) => {
    const yesterday = new Date(date.y, date.m - 1, date.day - 1)
    return getPickedNamesForSeed(yesterday.getFullYear() * 10000 + (yesterday.getMonth() + 1) * 100 + yesterday.getDate(), SAL_COLS, ALL_PLAYERS)
  }
  const trustedFrozen = (frozen) => {
    if (!Array.isArray(frozen) || frozen.length !== SAL_COLS.length || !frozen.every(col => Array.isArray(col) && col.length === TIERS.length)) return null
    const recent = recentFor(activeDate)
    const regulars = ALL_PLAYERS.filter(p => !p.legend)
    let legends = 0
    for (let ci = 0; ci < frozen.length; ci++) {
      const col = SAL_COLS[ci]
      const score = p => { const ts = typesFor(p, col); return ts.reduce((s, x) => s + (p.attrs?.[x] ?? 5), 0) / ts.length - (recent.has(p.name) ? RECENT_PENALTY : 0) }
      const ranked = regulars.map(p => [p.name, score(p)]).sort((x, y) => y[1] - x[1]).map(x => x[0])
      for (let ti = 0; ti < TIERS.length; ti++) {
        const cell = frozen[ci][ti]
        if (!cell || cell.price !== TIERS[ti] || typeof cell.name !== 'string') return null
        const real = ALL_PLAYERS.find(p => p.name === cell.name && p.team === cell.team) ?? ALL_PLAYERS.find(p => p.name === cell.name)
        if (!real || Object.entries(cell.attrs || {}).some(([k, v]) => v !== (real.attrs?.[k] ?? 5))) return null
        if (real.legend) { if (++legends > 2) return null; continue }
        const at = ranked.indexOf(real.name) / Math.max(1, ranked.length)
        if (at < TIER_BANDS[ti][0] - 0.2) return null
      }
    }
    return frozen.map(col => col.map(cell => { const real = _playerMap.get(cell.name); return { ...cell, ...(real ? { teamKind: real.teamKind, espn: real.espn, fullAttrs: real.attrs } : {}), photo: real ? photoOf(real) : null } }))
  }
  const localGenerateGrid = (date) => generateGrid(SAL_COLS, ALL_PLAYERS, seededRandom(date.seed), recentFor(date), date.seed)
  const computeGridSync = (date, currentMode, seed) => (currentMode === 'infinite'
    ? generateGrid(SAL_COLS, ALL_PLAYERS, seededRandom(seed), new Set(), seed)
    : localGenerateGrid(date))

  // Always draw at once from this phone's own board, then quietly swap in the frozen
  // copy below if it turns out to be different
  const [grid, setGrid] = useState(() => computeGridSync(activeDate, mode, infiniteSeed))

  useEffect(() => {
    setGrid(computeGridSync(activeDate, mode, infiniteSeed))
  }, [mode, infiniteSeed, activeDate.seed, activeDate.y, activeDate.m, activeDate.day]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === 'infinite' || !supabase) return
    let cancelled = false
    const localGuess = localGenerateGrid(activeDate)
    supabase.from(T.grids)
      .select('grid')
      .eq('date_str', activeDate.str)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('[soccer-salary] grid fetch failed:', error); return }
        const frozen = data?.grid ? trustedFrozen(data.grid) : null
        if (data?.grid && !frozen) { console.warn(`[soccer-salary] the stored board for ${activeDate.str} didn't check out; using this phone's own`); return }
        if (frozen) setGrid(frozen)
        else {
          // no frozen copy yet (the day's first visitor): this board becomes the day's
          const slim = localGuess.map(col => col.map(({ fullAttrs, photo, catScore, ...cell }) => cell))   // eslint-disable-line no-unused-vars
          supabase.from(T.grids)
            .upsert({ date_str: activeDate.str, grid: slim }, { onConflict: 'date_str', ignoreDuplicates: true })
            .then(({ error }) => { if (error) console.error('[soccer-salary] grid save failed:', error) })
        }
      }, () => {})
    return () => { cancelled = true }
  }, [mode, activeDate.seed, activeDate.str, activeDate.y, activeDate.m, activeDate.day]) // eslint-disable-line react-hooks/exhaustive-deps

  // the board's photos ready before they're needed
  useEffect(() => {
    if (!grid) return
    const imgs = grid.flat().map(p => p.photo).filter(Boolean).map(url => { const i = new Image(); i.src = url; return i })
    return () => imgs.forEach(i => { i.src = '' })
  }, [grid])

  useEffect(() => { if (!shuffleMode) setHoveredShuffle(null) }, [shuffleMode])

  const effectiveGrid = useMemo(() => {
    if (!grid) return null
    return grid.map((col, ci) => {
      const base = shuffleOverride[ci] ?? col
      return base.map((player, ti) => rowOverrides[ti]?.[ci] ?? player)
    })
  }, [grid, shuffleOverride, rowOverrides])

  // the day's budget: €130M to €170M in steps of 10, from the date (basketball's)
  const dailyBudget = useMemo(() => {
    if (mode === 'infinite') {
      const r = seededRandom(infiniteSeed ^ 0xB0B0B0)
      return BUDGET_OPTIONS[Math.floor(r() * BUDGET_OPTIONS.length)]
    }
    return budgetForDateStr(activeDate.str)
  }, [mode, infiniteSeed, activeDate.str])

  const executeShuffleCol = (ci) => {
    const effectiveShuffle = mode === 'infinite' ? infShufflesLeft : shufflesLeft
    if (effectiveShuffle === 0 || shufflingCol !== null || (mode === 'daily' && alreadyPlayed)) return
    setShuffleMode(false)
    setShufflingCol(ci)
    setShufflePhase('out')
    setTimeout(() => {
      // nobody stays at his price
      const original = effectiveGrid[ci]
      let current
      do {
        current = [...original]
        for (let i = current.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [current[i], current[j]] = [current[j], current[i]]
        }
      } while (current.some((p, i) => p.name === original[i].name))
      const newPlayers = current.map((p, ti) => ({ ...p, price: TIERS[ti], id: `${p.name}-s-${ti}` }))
      setShuffleOverride(prev => ({ ...prev, [ci]: newPlayers }))
      setSel(prev => { const { [ci]: _, ...rest } = prev; return rest })
      if (mode === 'infinite') setInfShufflesLeft(0)
      else { ls.set(SHUFFLED_KEY(activeDate.str, user?.id), JSON.stringify({ ci, players: newPlayers })); setShufflesLeft(0) }
      setShufflePhase('in')
      setTimeout(() => { setShufflingCol(null); setShufflePhase(null) }, 500)
    }, 380)
  }

  const executeShuffleRow = (ti) => {
    const effectiveShuffle = mode === 'infinite' ? infShufflesLeft : shufflesLeft
    if (effectiveShuffle === 0 || shufflingCol !== null || shufflingRow !== null || (mode === 'daily' && alreadyPlayed)) return
    setShuffleMode(false)
    setShufflingRow(ti)
    setShufflePhase('out')
    setTimeout(() => {
      const original = effectiveGrid.map(col => col[ti])
      let current
      do {
        current = [...original]
        for (let i = current.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[current[i], current[j]] = [current[j], current[i]]
        }
      } while (current.some((p, i) => p.name === original[i].name))
      const price = TIERS[ti]
      const newMap = {}
      current.forEach((p, ci) => {
        const col = SAL_COLS[ci]
        const srcAttrs = _playerMap.get(p.name)?.attrs ?? p.fullAttrs ?? p.attrs ?? {}
        const attrs = {}
        typesFor(p, col).forEach(t => { attrs[t] = srcAttrs[t] ?? 5 })
        newMap[ci] = { ...p, price, attrs, id: `${col.key}-${price}-${p.name}-r` }
      })
      setRowOverrides(prev => ({ ...prev, [ti]: newMap }))
      setSel(prev => {
        const next = { ...prev }
        SAL_COLS.forEach((_, ci) => { if (next[ci] && original[ci]?.name === next[ci]?.name) delete next[ci] })
        return next
      })
      if (mode === 'infinite') setInfShufflesLeft(0)
      else { ls.set(SHUFFLED_KEY(activeDate.str, user?.id), JSON.stringify({ ti, row: newMap })); setShufflesLeft(0) }
      setShufflePhase('in')
      setTimeout(() => { setShufflingRow(null); setShufflePhase(null) }, 500)
    }, 380)
  }

  const executeScout = (player) => {
    const effectiveScout = mode === 'infinite' ? infScoutsLeft : scoutsLeft
    if (effectiveScout === 0 || (mode === 'daily' && alreadyPlayed)) return
    const newGrades = { ...scoutedGrades, [player.name]: calcGrade(player) }
    setScoutedGrades(newGrades)
    if (mode === 'infinite') setInfScoutsLeft(0)
    else { ls.set(SCOUTED_KEY(activeDate.str, user?.id), JSON.stringify(newGrades)); setScoutsLeft(0) }
    setScoutMode(false)
  }

  // the date's or the account's power-ups and play, from this device
  useEffect(() => {
    const uid = user?.id
    const savedShuffle = ls.get(SHUFFLED_KEY(activeDate.str, uid))
    setShufflesLeft(savedShuffle ? 0 : 1)
    const restored = savedShuffle ? parseShuffle(savedShuffle) : { col: {}, row: {} }
    setShuffleOverride(restored.col)
    setRowOverrides(restored.row)
    setShuffleMode(false)
    const savedScouted = ls.get(SCOUTED_KEY(activeDate.str, uid))
    setScoutsLeft(savedScouted ? 0 : 1)
    let grades = {}
    try { grades = savedScouted ? JSON.parse(savedScouted) : {} } catch {}
    setScoutedGrades(grades)
    setScoutMode(false)
    setPowerMenuOpen(false)
    try {
      const s = ls.get(PLAYED_KEY(activeDate.str, uid))
      if (s) { setAlreadyPlayed(JSON.parse(s)); return }
    } catch {}
    setAlreadyPlayed(null)
    setSel({})
  }, [activeDate.str, user?.id])

  // signed in: a play from another device counts too
  useEffect(() => {
    if (!user || !supabase) return
    if (ls.get(PLAYED_KEY(activeDate.str, user.id))) return
    supabase.from(T.plays)
      .select('picks, overall_score, goals, assists')
      .eq('user_id', user.id)
      .eq('date_str', activeDate.str)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const play = { picks: data.picks, overall: data.overall_score, goals: data.goals, assists: data.assists }
        setAlreadyPlayed(play)
        ls.set(PLAYED_KEY(activeDate.str, user.id), JSON.stringify(play))
      }, () => {})
  }, [user, activeDate.str])

  // a played board shows its picks where they were made
  useEffect(() => {
    if (!alreadyPlayed?.picks || !effectiveGrid) return
    const newSel = {}
    alreadyPlayed.picks.forEach((savedPlayer, ci) => {
      if (!savedPlayer) return
      const found = effectiveGrid[ci]?.find(p => p.name === savedPlayer.name) ?? grid?.[ci]?.find(p => p.name === savedPlayer.name)
      if (found) newSel[ci] = found
    })
    setSel(newSel)
  }, [alreadyPlayed, effectiveGrid]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalCost  = Object.values(sel).reduce((s, p) => s + p.price, 0)
  const pickedAll  = Object.keys(sel).length === SAL_COLS.length
  const overBudget = totalCost > dailyBudget

  const pick = (ci, player) => {
    if (alreadyPlayed) return
    if (scoutMode) { executeScout(player); return }
    setSel(prev => (prev[ci]?.id === player.id ? (({ [ci]: _, ...rest }) => rest)(prev) : { ...prev, [ci]: player }))
  }

  const handleSelectDate = date => {
    if (date.str === activeDate.str) return
    setActiveDate(date)
    setAlreadyPlayed(null)
    setSel({})
    setShowLB(false)
    setShufflingCol(null)
    setShufflingRow(null)
    setRowOverrides({})
    setShufflePhase(null)
  }

  const handleInfinite = () => {
    setMode('infinite')
    setAlreadyPlayed(null)
    setInfiniteSeed(Math.random() * 0x7FFFFFFF | 0)
    setSel({})
    setShuffleOverride({})
    setRowOverrides({})
    setInfShufflesLeft(1)
    setInfScoutsLeft(1)
    setShufflingCol(null)
    setShufflingRow(null)
    setShufflePhase(null)
    setScoutedGrades({})
    setShuffleMode(false)
    setScoutMode(false)
    setPowerMenuOpen(false)
    setShowLB(false)
    setShowLBPrompt(false)
  }

  // the striker the picks make: each column's two traits at that player's real ratings,
  // with his card (face, shirt, colours, size) on each trait he gave
  const buildFromSel = () => soccerSalBuild(SAL_COLS.map((_, ci) => sel[ci]), p => {
    const real = _playerMap.get(p.name) ?? p
    return {
      teamColor: p.teamColor, teamColor2: p.teamColor2, captain: false,
      photo: p.photo ?? null, skinColor: real.skin ?? null, faceCenter: real.faceCenter ?? null,
      number: real.number ?? null, height: real.height ?? null, weight: real.weight ?? null,
      attrs: real.attrs ?? p.fullAttrs ?? null, nation: real.nation ?? null,
      ...(real.role ? { role: real.role } : {}),
    }
  })

  const pickRows = () => SAL_COLS.map((col, ci) => {
    const p = sel[ci]
    return { name: p.name, team: p.team, price: p.price, photo: p.photo, teamColor: p.teamColor, number: p.number ?? null }
  })

  const confirm = () => {
    if (!pickedAll) return

    if (mode === 'infinite') {
      if (overBudget) return
      const stats = calcStats(sel)
      onConfirm(buildFromSel(), false, null, {
        picks: pickRows(), goals: stats.goals, assists: stats.assists,
        userId: user?.id ?? null, username: getUsername(user) || null, totalCost, infinite: true,
      })
      return
    }

    if (alreadyPlayed) { onConfirm(buildFromSel(), true, activeDate.str, null); return }
    if (overBudget) return

    const stats = calcStats(sel)
    const picks = pickRows()
    const playData = { picks, overall: stats.overall, goals: stats.goals, assists: stats.assists }

    // the day's board was already played on this device by someone else (a guest, another
    // account): they've seen every pick on it, so this play doesn't post
    const devKey = `soc_sal_dev_${activeDate.str}`, me = user?.id || 'guest'
    let scouted = false
    const by = ls.get(devKey)
    if (by && by !== me) scouted = true
    else if (!by) ls.set(devKey, me)
    ls.set(PLAYED_KEY(activeDate.str, user?.id), JSON.stringify(playData))
    setAlreadyPlayed(playData)

    // SoccerApp saves it after the season, with the season's OVR
    onConfirm(buildFromSel(), false, activeDate.str, {
      picks, goals: stats.goals, assists: stats.assists,
      userId: user?.id ?? null, noPost: scouted, username: getUsername(user) || null, totalCost,
    })
  }

  const effectiveShufflesLeft = mode === 'infinite' ? infShufflesLeft : shufflesLeft
  const effectiveScoutsLeft   = mode === 'infinite' ? infScoutsLeft   : scoutsLeft
  const missing   = SAL_COLS.length - Object.keys(sel).length
  const viewReady = mode === 'daily' && alreadyPlayed && pickedAll
  const disabled  = viewReady ? false : (!pickedAll || overBudget)
  const ctaLabel  = mode === 'daily' && alreadyPlayed
    ? (pickedAll ? 'View Results →' : '…')
    : !pickedAll
    ? `Pick ${missing} more`
    : overBudget
    ? `€${totalCost - dailyBudget}M over budget`
    : 'Lock In Build →'

  return (
    <div className="sc-screen sc-screen--soccer">
      <div className="sc-header">
        <div className="sc-title">BUILD<span style={{ color: '#a855f7' }}>-A-</span>PLAYER <span style={{ color: '#a855f7' }}>SALARY</span></div>
        <div className="sc-footer-icons">
          {(effectiveShufflesLeft > 0 || effectiveScoutsLeft > 0) && (mode === 'infinite' || !alreadyPlayed) && (
            <div className="sc-power-wrap">
              <button
                className={`sc-lb-btn${powerMenuOpen ? ' sc-lb-btn--open' : ''}${!powerSeen && !powerMenuOpen ? ' sc-lb-btn--pulse' : ''}`}
                onClick={() => {
                  if (!powerSeen) { setPowerSeen(true); ls.set(POWER_SEEN_KEY, '1') }
                  setPowerMenuOpen(v => !v)
                  setShuffleMode(false)
                  setScoutMode(false)
                }}
                title="Power-ups"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="4"/>
                  <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>
                  <circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none"/>
                  <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>
                  <circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none"/>
                  <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none"/>
                </svg>
              </button>
              {powerMenuOpen && (
                <>
                  <div className="sc-power-backdrop" onClick={() => setPowerMenuOpen(false)} />
                  <div className="sc-power-menu">
                    <div className="sc-power-item">
                      <button
                        className={`sc-power-circle${shuffleMode ? ' sc-power-circle--active' : ''}${effectiveShufflesLeft === 0 ? ' sc-power-circle--used' : ''}`}
                        disabled={effectiveShufflesLeft === 0}
                        onClick={() => {
                          if (effectiveShufflesLeft === 0) return
                          setPowerMenuOpen(false)
                          setShuffleMode(v => !v)
                          setScoutMode(false)
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
                        </svg>
                        <span className="sc-power-badge">{effectiveShufflesLeft}</span>
                      </button>
                      <span className="sc-power-label">SHUFFLE</span>
                    </div>
                    <div className="sc-power-item">
                      <button
                        className={`sc-power-circle${scoutMode ? ' sc-power-circle--active' : ''}${effectiveScoutsLeft === 0 ? ' sc-power-circle--used' : ''}`}
                        disabled={effectiveScoutsLeft === 0}
                        onClick={() => {
                          if (effectiveScoutsLeft === 0) return
                          setPowerMenuOpen(false)
                          setScoutMode(v => !v)
                          setShuffleMode(false)
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="m21 21-4.35-4.35"/>
                        </svg>
                        <span className="sc-power-badge">{effectiveScoutsLeft}</span>
                      </button>
                      <span className="sc-power-label">SCOUT</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="sc-lb-wrap">
            <button
              className={`sc-lb-btn${showLB ? ' sc-lb-btn--open' : ''}`}
              onClick={e => {
                e.currentTarget.blur()
                if (mode === 'infinite' || alreadyPlayed) setShowLB(v => !v)
                else { setShowLBPrompt(true); setTimeout(() => setShowLBPrompt(false), 2800) }
              }}
              aria-label="Today's top builds"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
              </svg>
            </button>
            {showLBPrompt && <div className="sc-lb-prompt">Play today's board to unlock</div>}
            {showLB && mode === 'infinite' && <InfiniteLeaderboard onClose={() => setShowLB(false)} />}
            {showLB && mode === 'daily' && <SalaryLeaderboard dateStr={activeDate.str} dateLabel={activeDate.label} onClose={() => setShowLB(false)} />}
          </div>
        </div>
        <DatePicker
          activeDate={activeDate}
          dates={dates}
          onSelect={date => { setMode('daily'); setSel({}); handleSelectDate(date) }}
          mode={mode}
          onInfinite={handleInfinite}
        />
      </div>

      {mode === 'daily' && alreadyPlayed && (
        <div className="sc-played-banner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Today's build is locked. Come back tomorrow for a new board, or play an earlier date
        </div>
      )}

      <div className="sc-grid-wrap">
        <div className={`sc-grid${shuffleMode ? ' sc-grid--shuffle-mode' : ''}${scoutMode ? ' sc-grid--scout-mode' : ''}`} style={{ gridTemplateColumns: `var(--price-col, 40px) repeat(${SAL_COLS.length}, 1fr)` }}>
          <div />
          {SAL_COLS.map((col, ci) => (
            <div key={col.key} className="sc-col-header">
              <span className="sc-col-label">{col.label}</span>
              {shuffleMode && (
                <button className="sc-shuffle-col-target"
                  onClick={() => executeShuffleCol(ci)}
                  onMouseEnter={() => setHoveredShuffle({ type: 'col', idx: ci })}
                  onMouseLeave={() => setHoveredShuffle(null)}>
                  <span className="sc-shuffle-dir-arrow">⇅</span>
                </button>
              )}
            </div>
          ))}
          {TIERS.map((tier, ti) => (
            <React.Fragment key={tier}>
              <div className="sc-price-label">
                <span className="sc-price-text">€{tier}M</span>
                {shuffleMode && (
                  <button className="sc-shuffle-row-target"
                    onClick={() => executeShuffleRow(ti)}
                    onMouseEnter={() => setHoveredShuffle({ type: 'row', idx: ti })}
                    onMouseLeave={() => setHoveredShuffle(null)}>
                    <span className="sc-shuffle-dir-arrow">⇄</span>
                  </button>
                )}
              </div>
              {SAL_COLS.map((col, ci) => (
                <PlayerCard
                  key={effectiveGrid[ci][ti].id}
                  player={effectiveGrid[ci][ti]}
                  isSelected={sel[ci]?.id === effectiveGrid[ci][ti].id}
                  colHasSelection={!!sel[ci]}
                  onClick={() => pick(ci, effectiveGrid[ci][ti])}
                  viewOnly={!!alreadyPlayed}
                  shufflePhase={(shufflingCol === ci || shufflingRow === ti) ? shufflePhase : null}
                  shuffleDelay={shufflingRow === ti ? ci * 45 : ti * 45}
                  scoutGrade={scoutedGrades[effectiveGrid[ci][ti].name] ?? null}
                  shuffleHighlight={
                    hoveredShuffle?.type === 'col' && hoveredShuffle.idx === ci ? 'col' :
                    hoveredShuffle?.type === 'row' && hoveredShuffle.idx === ti ? 'row' :
                    null
                  }
                />
              ))}
            </React.Fragment>
          ))}
        </div>
        {shuffleMode && (
          <>
            <div className="sc-shuffle-backdrop" onClick={() => setShuffleMode(false)} />
            <div className="sc-shuffle-hint">⇅ column &nbsp;·&nbsp; ⇄ row</div>
          </>
        )}
        {scoutMode && <div className="sc-shuffle-hint sc-scout-hint">Choose a player to scout</div>}
      </div>

      <div className="sc-footer">
        <div className="sc-footer-btns">
          <button className="sc-back-btn" onClick={onBack}>← Back</button>
          <button
            className={`sc-confirm-btn${disabled ? ' sc-confirm-btn--disabled' : ''}${viewReady ? ' sc-confirm-btn--view' : ''}`}
            onClick={confirm}
            disabled={disabled}
          >
            {ctaLabel}
          </button>
        </div>
        <BudgetBar spent={totalCost} total={dailyBudget} pickedAll={pickedAll} />
      </div>
    </div>
  )
}
