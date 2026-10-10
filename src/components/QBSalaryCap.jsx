import React, { useState, useMemo, useEffect } from 'react'
import { QBS, ATTR, TYPES } from '../data/qbs'
import { LEGENDS } from '../data/qb-legends'
import { TEAMS } from '../data/nfl-teams'
import HEADSHOTS from '../data/headshots.json'
import { supabase } from '../lib/supabase'
import { valToGrade, nflHeadshot } from '../utils/simulation'
import { getUsername } from '../lib/discord'

/*
  Supabase tables required (see supabase/qb_salary_cap.sql):

  CREATE TABLE qb_salary_cap_plays (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    date_str      text NOT NULL,
    user_id       uuid REFERENCES auth.users(id),
    username      text,
    picks         jsonb NOT NULL,
    overall_score int  NOT NULL,
    pass_yds      int,
    pass_tds      int,
    ints          int,
    budget_used   int,
    created_at    timestamptz DEFAULT now()
  );

  CREATE TABLE qb_salary_cap_grids (
    date_str      text PRIMARY KEY,
    grid          jsonb NOT NULL,
    created_at    timestamptz DEFAULT now()
  );

  CREATE TABLE qb_salary_infinite_plays (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       uuid REFERENCES auth.users(id),
    username      text,
    picks         jsonb NOT NULL,
    overall_score int  NOT NULL,
    pass_yds      int,
    pass_tds      int,
    ints          int,
    budget_used   int,
    created_at    timestamptz DEFAULT now()
  );

  This component only READS the plays tables (leaderboards + already-played
  check); the app inserts play rows after the sim. It reads and inserts grids.
*/

// ─── All-time legends (retired greats not on a current roster) ───────────────
// Deterministic: strongest ~18 by average attribute, ties broken by name.
const LEGEND_COUNT = 18
const _avgAttr = p => {
  const vals = Object.values(p.attrs ?? {})
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}
const _currentNames = new Set(QBS.map(p => p.name))
const GOAT_SALARY_PLAYERS = LEGENDS
  .filter(p => p.attrs && !_currentNames.has(p.name))
  .sort((a, b) => (_avgAttr(b) - _avgAttr(a)) || a.name.localeCompare(b.name))
  // multi-team legends appear once per franchise — keep their strongest entry
  .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)
  .slice(0, LEGEND_COUNT)
  .map(p => ({ ...p, legend: true }))

// ─── Player pool (daily + infinite) ──────────────────────────────────────────
const ALL_PLAYERS = [...QBS, ...GOAT_SALARY_PLAYERS]
  .filter(p => {
    if (!p.attrs) return false
    const vals = Object.values(p.attrs)
    return vals.reduce((s, v) => s + v, 0) / vals.length >= 3.0
  })
  .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)

// ─── Seeded RNG (mulberry32 variant) ──────────────────────────────────────────
function seededRandom(seed) {
  let h = seed | 0
  return () => {
    h ^= h >>> 16
    h = Math.imul(h, 0x45d9f3b) | 0
    h ^= h >>> 16
    h = Math.imul(h, 0x119de1f3) | 0
    h ^= h >>> 16
    return (h >>> 0) / 0x100000000
  }
}

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

// ─── Constants ────────────────────────────────────────────────────────────────
const BUDGET_OPTIONS = [130, 140, 150, 160, 170]

function budgetForDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const seed = y * 10000 + m * 100 + d
  const r = seededRandom(seed ^ 0xB0B0B0)
  return BUDGET_OPTIONS[Math.floor(r() * BUDGET_OPTIONS.length)]
}
const TIERS  = [50, 40, 30, 20, 10]

// Non-overlapping quantile slices — tier N's whole pool always outranks
// tier N+1's whole pool, so price strictly tracks rating with no overlap
// zone where a cheaper tier could out-score a pricier one.
const TIER_BANDS = [
  [0.00, 0.20],
  [0.20, 0.40],
  [0.40, 0.60],
  [0.60, 0.80],
  [0.80, 1.00],
]

// One pick per column; together the 5 columns cover all 9 QB attributes.
export const QB_SAL_COLS = [
  { key: 'arm',      label: 'ARM',                 types: ['arm'] },
  { key: 'accuracy', label: 'ACCURACY',            types: ['accuracy'] },
  { key: 'mind',     label: 'PRE & POST-SNAP',     types: ['processing', 'vision'] },
  { key: 'pocket',   label: 'POCKET & LEADERSHIP', types: ['pocket-presence', 'leadership'] },
  { key: 'athlete',  label: 'LEGS & SIZE',         types: ['legs', 'size', 'playmaking'] },
]

function typesFor(player, col) {
  return col.types
}

// Category accent colors — one per column key (match the QB attribute hues)
const COL_COLORS = {
  arm:      ATTR['arm']?.hex             ?? '#f87171',
  accuracy: ATTR['accuracy']?.hex        ?? '#34d399',
  mind:     ATTR['processing']?.hex      ?? '#e879f9',
  pocket:   ATTR['pocket-presence']?.hex ?? '#2dd4bf',
  athlete:  ATTR['legs']?.hex            ?? '#60a5fa',
}

// One representative type per category (for ReportCard / SimPage display)
export const QB_SAL_REP_TYPES = ['arm', 'accuracy', 'processing', 'pocket-presence', 'legs']

export const QB_SAL_ATTR_MAP = {
  'arm':             { label: 'ARM',                 col: COL_COLORS.arm,      hex: COL_COLORS.arm },
  'accuracy':        { label: 'ACCURACY',            col: COL_COLORS.accuracy, hex: COL_COLORS.accuracy },
  'processing':      { label: 'PRE/POST-SNAP',       col: COL_COLORS.mind,     hex: COL_COLORS.mind },
  'pocket-presence': { label: 'POCKET & LEADERSHIP', col: COL_COLORS.pocket,   hex: COL_COLORS.pocket },
  'legs':            { label: 'LEGS & SIZE',         col: COL_COLORS.athlete,  hex: COL_COLORS.athlete },
}

const TEAM_META = Object.fromEntries(TEAMS.map(t => [t.short, t]))

// Full-attribute lookup (row shuffle re-slices a card's attrs for its new column)
const _playerMap = new Map(ALL_PLAYERS.map(p => [p.name, p]))

const photoFor = name => nflHeadshot(HEADSHOTS[name])
const teamColorOf  = p => TEAM_META[p.team]?.color  ?? p.color  ?? '#444'
const teamColor2Of = p => TEAM_META[p.team]?.color2 ?? p.color2 ?? '#222'

// ─── Score calculation ─────────────────────────────────────────────────────────
// Uses peak attr per column — gives fair credit to specialists and matches intuition
function calcStats(sel) {
  const scoreFor = (ci) => {
    const p = sel[ci]
    if (!p?.attrs) return 5
    const vals = Object.values(p.attrs)
    return vals.length ? Math.max(...vals) : 5
  }
  const armScore    = scoreFor(0)
  const accScore    = scoreFor(1)
  const mindScore   = scoreFor(2)
  const pocketScore = scoreFor(3)
  const athScore    = scoreFor(4)
  const overall = Math.round(armScore + accScore + mindScore + pocketScore + athScore)
  // Season passing line: arm + accuracy drive volume, reads (pre/post-snap)
  // drive scoring and protect the ball, pocket feel trims the turnovers.
  const passYds = Math.round(2400 + armScore * 130 + accScore * 110 + mindScore * 40)
  const passTds = Math.round(12 + armScore * 1.1 + accScore * 0.9 + mindScore * 1.0)
  const ints    = Math.max(2, Math.round(20 - accScore * 0.7 - mindScore * 0.8 - pocketScore * 0.3))
  return { overall, passYds, passTds, ints }
}

const PLAYED_KEY     = (str, uid) => uid ? `qbsal_play_${uid}_${str}`     : `qbsal_play_${str}`
const SHUFFLED_KEY   = (str, uid) => uid ? `qbsal_shuffled_${uid}_${str}` : `qbsal_shuffled_${str}`
const SCOUTED_KEY    = (str, uid) => uid ? `qbsal_scouted_${uid}_${str}`  : `qbsal_scouted_${str}`
const POWER_SEEN_KEY = 'qbsal_power_seen'

// ─── Grid generation ──────────────────────────────────────────────────────────
// Returns the set of player names that would be picked for a given seed (used to
// detect back-to-back appearances and apply a penalty the following day).
// Compute the correct salary tier for a legend in a given column by ranking
// their catScore against the regular player pool (no rand needed — deterministic).
function legendTierFor(legend, col, regulars) {
  const legTypes  = typesFor(legend, col)
  const legScore  = legTypes.reduce((s, t) => s + (legend.attrs?.[t] ?? 5), 0) / legTypes.length
  const sorted    = regulars
    .map(p => { const ts = typesFor(p, col); return ts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / ts.length })
    .sort((a, b) => b - a)
  const rank = sorted.findIndex(s => s <= legScore)
  // rank === -1 means no player scored as low as the legend → legend is the worst → pct = 1.0
  const pct  = rank === -1 ? 1.0 : rank / sorted.length
  if (pct < 0.20) return 0  // $50
  if (pct < 0.40) return 1  // $40
  if (pct < 0.60) return 2  // $30
  if (pct < 0.80) return 3  // $20
  return 4                   // $10
}

// Pick 2 deterministic legend slots — cycles through all legends before repeating.
// rand() still used for column and tier nudge so placement varies day-to-day.
function pickLegendSlots(rand, cols, legends, regulars, seed) {
  // Compute sequential day index from seed (yyyymmdd format)
  const y   = Math.floor(seed / 10000)
  const m   = Math.floor((seed % 10000) / 100)
  const day = seed % 100
  const epochMs = new Date(2026, 0, 1).getTime()
  const dayIdx  = Math.round((new Date(y, m - 1, day).getTime() - epochMs) / 86400000)

  // Fixed shuffle of legend list so pair order isn't biased toward list order
  const fixedR = seededRandom(0xBADC0FFE)
  const shuffled = [...legends]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(fixedR() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // Pick pair based on day index — all legends appear before any repeats
  const n = shuffled.length
  const leg0 = shuffled[((dayIdx * 2)     % n + n) % n]
  const leg1 = shuffled[((dayIdx * 2 + 1) % n + n) % n]

  const usedLegends = new Set()
  if (leg0) usedLegends.add(leg0.name)
  if (leg1) usedLegends.add(leg1.name)

  // Column placement still uses daily rand() for variation; tier is the
  // legend's actual rank-based tier — no randomized nudge off of it.
  const li0c = Math.floor(rand() * cols.length)
  const li1c = Math.floor(rand() * cols.length)

  let li0t = leg0 ? legendTierFor(leg0, cols[li0c], regulars) : 0
  let li1t = leg1 ? legendTierFor(leg1, cols[li1c], regulars) : 1
  // If both land in the same (col, tier) slot, shift whichever one actually
  // scores lower to the adjacent tier — toward cheaper, unless it's already
  // at the cheapest tier (then toward the next-cheapest instead of wrapping
  // around to the most expensive, which could put the weaker legend at $50).
  if (leg0 && leg1 && li1c === li0c && li1t === li0t) {
    const scoreOf = leg => {
      const ts = typesFor(leg, cols[li0c])
      return ts.reduce((s, t) => s + (leg.attrs?.[t] ?? 5), 0) / ts.length
    }
    const shift = t => t < TIERS.length - 1 ? t + 1 : t - 1
    if (scoreOf(leg0) <= scoreOf(leg1)) li0t = shift(li0t)
    else li1t = shift(li1t)
  }

  const map = new Map()
  if (leg0) map.set(`${li0c}-${li0t}`, leg0)
  if (leg1) map.set(`${li1c}-${li1t}`, leg1)
  return { map, usedLegends }
}

function getPickedNamesForSeed(seed, cols, players) {
  const rand     = seededRandom(seed)
  const legends  = players.filter(p => p.legend)
  const regulars = players.filter(p => !p.legend)
  const { map: legendMap, usedLegends } = pickLegendSlots(rand, cols, legends, regulars, seed)

  const used = new Set([...usedLegends])

  for (const [key] of legendMap) used.add(legendMap.get(key).name)

  cols.forEach((col, ci) => {
    const scored = regulars
      .map(p => ({
        name: p.name,
        catScore: (() => { const ts = typesFor(p, col); return ts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / ts.length })(),
      }))
      .sort((a, b) => b.catScore - a.catScore)
    const n = scored.length
    for (let ti = 0; ti < TIERS.length; ti++) {
      if (legendMap.has(`${ci}-${ti}`)) continue
      const [lo, hi] = TIER_BANDS[ti]
      let pool = scored
        .slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.floor(hi * n)))
        .filter(p => !used.has(p.name))
      if (!pool.length) pool = scored.filter(p => !used.has(p.name))
      if (!pool.length) pool = scored
      const player = pool[Math.floor(rand() * pool.length)]
      used.add(player.name)
    }
  })
  return used
}

function generateGrid(cols, players, rand, recentlyUsed = new Set(), seed = 0) {
  const RECENT_PENALTY = 3.5
  const legends  = players.filter(p => p.legend)
  const regulars = players.filter(p => !p.legend)

  // 2 rand() calls to place exactly 2 legends — same for all users on the same day
  const { map: legendMap, usedLegends } = pickLegendSlots(rand, cols, legends, regulars, seed)

  function buildCard(p, col, price) {
    const attrs = {}
    const pts = typesFor(p, col)
    pts.forEach(t => { attrs[t] = p.attrs?.[t] ?? 5 })
    return {
      ...p,
      price, attrs, fullAttrs: p.attrs,
      catScore: pts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / pts.length,
      teamColor:  teamColorOf(p),
      teamColor2: teamColor2Of(p),
      photo:  photoFor(p.name),
      number: p.number ?? null,
      id:     `${col.key}-${price}-${p.name}`,
    }
  }

  const used = new Set([...usedLegends])

  return cols.map((col, ci) => {
    const scored = regulars
      .map(p => ({
        ...p,
        teamColor:  teamColorOf(p),
        teamColor2: teamColor2Of(p),
        catScore: (() => { const ts = typesFor(p, col); return ts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / ts.length })()
                  - (recentlyUsed.has(p.name) ? RECENT_PENALTY : 0),
      }))
      .sort((a, b) => b.catScore - a.catScore)
    const n = scored.length
    return TIERS.map((price, ti) => {
      const legKey = `${ci}-${ti}`
      if (legendMap.has(legKey)) return buildCard(legendMap.get(legKey), col, price)

      const [lo, hi] = TIER_BANDS[ti]
      let pool = scored
        .slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.floor(hi * n)))
        .filter(p => !used.has(p.name))
      if (!pool.length) pool = scored.filter(p => !used.has(p.name))
      if (!pool.length) pool = scored
      const player = pool[Math.floor(rand() * pool.length)]
      used.add(player.name)
      const attrs = {}
      typesFor(player, col).forEach(t => { attrs[t] = player.attrs?.[t] ?? 5 })
      return {
        ...player,
        price, attrs, fullAttrs: player.attrs,
        catScore: player.catScore,
        photo:  photoFor(player.name),
        number: player.number ?? null,
        id:     `${col.key}-${price}-${player.name}`,
      }
    })
  })
}

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

// ─── Grade helpers ────────────────────────────────────────────────────────────
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

// ─── PlayerCard ───────────────────────────────────────────────────────────────
function PlayerCard({ player, isSelected, colHasSelection, onClick, viewOnly, shufflePhase, shuffleDelay = 0, scoutGrade = null, scoutMode = false, shuffleHighlight = null }) {
  const dimmed = colHasSelection && !isSelected
  const [first, ...rest] = player.name.split(' ')
  const last = rest.join(' ')
  const animClass = shufflePhase === 'out' ? ' sc-card--flip-out' : shufflePhase === 'in' ? ' sc-card--flip-in' : ''
  const hlClass = shuffleHighlight === 'col' ? ' sc-card--hl-col' : shuffleHighlight === 'row' ? ' sc-card--hl-row' : ''
  return (
    <button
      onClick={viewOnly ? undefined : onClick}
      className={`sc-card${isSelected ? ' sc-card--sel' : ''}${dimmed ? ' sc-card--dim' : ''}${viewOnly ? ' sc-card--view' : ''}${animClass}${hlClass}`}
      style={{ '--tc': player.teamColor, '--sel': isNearBlack(player.teamColor) ? '#888' : player.teamColor, '--sd': `${shuffleDelay}ms` }}
    >
      <div className="sc-card-visual" data-team={player.team}>
        <img src={`/logos/${player.team}.png`} alt="" aria-hidden="true" className="sc-card-logo-bg"
          onError={e => { e.currentTarget.style.display = 'none' }} />
        {player.photo
          ? <img src={player.photo} alt={player.name} className="sc-card-headshot" />
          : <div className="sc-card-no-photo">
              <img src={`/logos/${player.team}.png`} alt={player.team} style={{ width: '55%', opacity: 0.7 }} />
            </div>
        }
      </div>
      <div className="sc-card-name-wrap">
        <span className="sc-card-first">{first}</span>
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
        <span style={{ color: over ? '#ef4444' : exact ? '#a855f7' : '#fff', fontWeight: 900 }}>${spent}M</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}> / ${total}M</span>
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

// ─── Leaderboard stat line (football numbers) ────────────────────────────────
function LbStatLine({ row }) {
  if (row.pass_yds == null && row.pass_tds == null) return null
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.45)', margin: '2px 0 4px 26px' }}>
      {(row.pass_yds ?? 0).toLocaleString()} YDS · {row.pass_tds ?? 0} TD{row.ints != null ? ` · ${row.ints} INT` : ''}
    </div>
  )
}

// ─── InfiniteLeaderboard ─────────────────────────────────────────────────────
function InfiniteLeaderboard({ onClose }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!supabase) { setRows([]); return }
    supabase
      .from('qb_salary_infinite_plays')
      .select('username, picks, overall_score, pass_yds, pass_tds, ints')
      .order('overall_score', { ascending: false })
      .limit(10)
      .then(({ data }) => setRows((data || []).slice(0, 10)))
      .catch(() => setRows([]))
  }, [])
  return (
    <>
      <div className="sc-lb-backdrop" onClick={onClose} />
      <div className="sc-lb-dropdown">
        <div className="sc-lb-header">
          <span className="sc-lb-title">ALL-TIME TOP BUILDS</span>
        </div>
        {rows === null && <div className="sc-lb-empty">Loading…</div>}
        {rows !== null && rows.length === 0 && <div className="sc-lb-empty">No builds yet — be the first!</div>}
        {rows !== null && rows.map((r, i) => (
          <div key={i} className={`sc-lb-row${i === 0 ? ' sc-lb-row--top' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
            <div className="sc-lb-row-main">
              <span className="sc-lb-rank">{i + 1}</span>
              <span className="sc-lb-name">{r.username || 'Anonymous'}</span>
              <span className="sc-lb-ovr">{r.overall_score} OVR</span>
            </div>
            <LbStatLine row={r} />
            {r.picks && (
              <div className="sc-lb-picks">
                {r.picks.map((p, pi) => (
                  <div key={pi} className="sc-lb-pick" title={p.name} style={{ '--tc': p.teamColor || '#444' }}>
                    {p.photo
                      ? <img src={p.photo} alt={p.name} />
                      : <img src={`/logos/${p.team}.png`} alt={p.team} style={{ padding: '4px', opacity: 0.7 }} />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── SalaryLeaderboard ────────────────────────────────────────────────────────
function SalaryLeaderboard({ dateStr, dateLabel, onClose }) {
  const [rows, setRows] = useState(null)
  const budget = budgetForDateStr(dateStr)

  useEffect(() => {
    if (!supabase) { setRows([]); return }
    supabase
      .from('qb_salary_cap_plays')
      .select('username, picks, overall_score, pass_yds, pass_tds, ints, budget_used')
      .eq('date_str', dateStr)
      .order('overall_score', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const sorted = (data || []).sort((a, b) => {
          if (b.overall_score !== a.overall_score) return b.overall_score - a.overall_score
          const tdDiff = ((b.pass_tds ?? 0) - (b.ints ?? 0)) - ((a.pass_tds ?? 0) - (a.ints ?? 0))
          if (tdDiff !== 0) return tdDiff
          return (b.pass_yds ?? 0) - (a.pass_yds ?? 0)
        })
        setRows(sorted.slice(0, 10))
      })
      .catch(() => setRows([]))
  }, [dateStr])

  return (
    <>
      <div className="sc-lb-backdrop" onClick={onClose} />
      <div className="sc-lb-dropdown">
        <div className="sc-lb-header">
          <span className="sc-lb-title">{dateLabel?.toUpperCase() ?? 'TODAY'}'S TOP BUILDS</span>
        </div>
        {rows === null && <div className="sc-lb-empty">Loading…</div>}
        {rows !== null && rows.length === 0 && (
          <div className="sc-lb-empty">No builds yet — be the first!</div>
        )}
        {rows !== null && rows.map((r, i) => (
          <div
            key={i}
            className={`sc-lb-row${i === 0 ? ' sc-lb-row--top' : ''}`}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className="sc-lb-row-main">
              <span className="sc-lb-rank">{i + 1}</span>
              <span className="sc-lb-name">{r.username || 'Anonymous'}</span>
              <span className="sc-lb-ovr">{r.overall_score} OVR</span>
              {r.budget_used != null && budget - r.budget_used > 0 && (
                <span className="sc-lb-spare">+${budget - r.budget_used}M</span>
              )}
            </div>
            <LbStatLine row={r} />
            {r.picks && (
              <div className="sc-lb-picks">
                {r.picks.map((p, pi) => (
                  <div
                    key={pi}
                    className="sc-lb-pick"
                    title={p.name}
                    style={{ '--tc': p.teamColor || '#444' }}
                  >
                    {p.photo
                      ? <img src={p.photo} alt={p.name} />
                      : <img src={`/logos/${p.team}.png`} alt={p.team} style={{ padding: '4px', opacity: 0.7 }} />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── QBSalaryCap ──────────────────────────────────────────────────────────────
export default function QBSalaryCap({ onConfirm, onBack, user, initialDateStr }) {
  const dates      = useMemo(() => Array.from({ length: 10 }, (_, i) => getESTDate(-i)), [])
  const [activeDate,    setActiveDate]    = useState(() => {
    if (initialDateStr) {
      const allDates = Array.from({ length: 10 }, (_, i) => getESTDate(-i))
      const match = allDates.find(d => d.str === initialDateStr)
      if (match) return match
    }
    return getESTDate(0)
  })
  const [sel,           setSel]           = useState({})
  const [alreadyPlayed, setAlreadyPlayed] = useState(null)
  const [showLB,        setShowLB]        = useState(false)
  const [showLBPrompt,  setShowLBPrompt]  = useState(false)
  const [shufflesLeft,    setShufflesLeft]    = useState(() => localStorage.getItem(SHUFFLED_KEY(getESTDate(0).str, user?.id)) ? 0 : 1)
  const [shuffleOverride, setShuffleOverride] = useState(() => {
    const saved = localStorage.getItem(SHUFFLED_KEY(getESTDate(0).str, user?.id))
    if (!saved) return {}
    try { const { ci, players } = JSON.parse(saved); return { [ci]: players } } catch { return {} }
  })
  const [shufflingCol,    setShufflingCol]    = useState(null)
  const [shufflingRow,    setShufflingRow]    = useState(null)
  const [rowOverrides,    setRowOverrides]    = useState({})
  const [shufflePhase,    setShufflePhase]    = useState(null)
  const [shuffleMode,     setShuffleMode]     = useState(false)
  const [hoveredShuffle,  setHoveredShuffle]  = useState(null)
  const [scoutsLeft,      setScoutsLeft]      = useState(() => localStorage.getItem(SCOUTED_KEY(getESTDate(0).str, user?.id)) ? 0 : 1)
  const [scoutMode,       setScoutMode]       = useState(false)
  const [scoutedGrades,   setScoutedGrades]   = useState({})
  const [powerMenuOpen,   setPowerMenuOpen]   = useState(false)
  const [powerSeen,       setPowerSeen]       = useState(() => !!localStorage.getItem(POWER_SEEN_KEY))
  const [mode,            setMode]            = useState('daily')
  const [infiniteSeed,    setInfiniteSeed]    = useState(() => Math.random() * 0x7FFFFFFF | 0)
  const [infShufflesLeft, setInfShufflesLeft] = useState(1)
  const [infScoutsLeft,   setInfScoutsLeft]   = useState(1)

  // Daily grids are frozen server-side the first time each date is generated
  // (in qb_salary_cap_grids), so a day's board can never quietly drift out from
  // under players who already submitted picks for it — regenerating on the
  // fly (the old behavior) breaks the moment the underlying roster data
  // changes, since the same seed then picks different actual players.
  const localGenerateGrid = (date) => {
    const rand = seededRandom(date.seed)
    const yesterday = new Date(date.y, date.m - 1, date.day - 1)
    const yy = yesterday.getFullYear(), ym = yesterday.getMonth() + 1, yd = yesterday.getDate()
    const recentlyUsed = getPickedNamesForSeed(yy * 10000 + ym * 100 + yd, QB_SAL_COLS, ALL_PLAYERS)
    return generateGrid(QB_SAL_COLS, ALL_PLAYERS, rand, recentlyUsed, date.seed)
  }
  const computeGridSync = (date, currentMode, seed) => {
    if (currentMode === 'infinite') {
      const rand = seededRandom(seed)
      return generateGrid(QB_SAL_COLS, ALL_PLAYERS, rand, new Set(), seed)
    }
    return localGenerateGrid(date)
  }

  // Always render instantly from a local (possibly stale, for old dates)
  // computation — never a loading spinner — then quietly swap in the frozen
  // server copy in the background below if it turns out to be different.
  const [grid, setGrid] = useState(() => computeGridSync(activeDate, mode, infiniteSeed))

  useEffect(() => {
    setGrid(computeGridSync(activeDate, mode, infiniteSeed))
  }, [mode, infiniteSeed, activeDate.seed, activeDate.y, activeDate.m, activeDate.day])

  useEffect(() => {
    if (mode === 'infinite' || !supabase) return
    let cancelled = false
    const localGuess = localGenerateGrid(activeDate)

    // Always check for an already-frozen copy first, even for today — an
    // earlier visitor today may have already locked one in using whatever
    // roster data was live at that moment. Skipping this check for "today"
    // (the old behavior) let a later visitor's local regeneration diverge
    // from the actually-frozen board whenever roster data changed mid-day,
    // so their picker wouldn't show players the leaderboard already had
    // real picks of (e.g. a player who'd since been re-rated or moved).
    supabase.from('qb_salary_cap_grids')
      .select('grid')
      .eq('date_str', activeDate.str)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        // Table missing / network error → keep the locally generated board.
        if (error) { console.warn('[qb-salary-cap] grid fetch failed, using local grid:', error); return }
        const frozen = data?.grid
        const validFrozen = Array.isArray(frozen) && frozen.length === QB_SAL_COLS.length
          && frozen.every(col => Array.isArray(col) && col.length === TIERS.length)
        if (validFrozen) {
          setGrid(frozen) // swap to the historically-accurate frozen board
        } else {
          // No frozen record yet (first visitor of the day, or a past date
          // from before this fix shipped) — lock in our local regeneration
          // now so it's the stable, shared board from here on.
          supabase.from('qb_salary_cap_grids')
            .upsert({ date_str: activeDate.str, grid: localGuess }, { onConflict: 'date_str', ignoreDuplicates: true })
            .then(({ error }) => { if (error) console.error('[qb-salary-cap] grid save failed:', error) })
        }
      })

    return () => { cancelled = true }
  }, [mode, activeDate.seed, activeDate.str, activeDate.y, activeDate.m, activeDate.day])

  // Preload all headshots for the current day's grid so cards render instantly
  useEffect(() => {
    if (!grid) return
    const urls = grid.flat().map(p => p.photo).filter(Boolean)
    const imgs = urls.map(url => { const i = new Image(); i.src = url; return i })
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

  // Daily budget varies ±20 from 150 in steps of 10, seeded by date
  const dailyBudget = useMemo(() => {
    if (mode === 'infinite') {
      const r = seededRandom(infiniteSeed ^ 0xB0B0B0)
      return BUDGET_OPTIONS[Math.floor(r() * BUDGET_OPTIONS.length)]
    }
    return budgetForDateStr(activeDate.str)
  }, [mode, infiniteSeed, activeDate.seed, activeDate.str])

  const executeShuffleCol = (ci) => {
    const effectiveShuffle = mode === 'infinite' ? infShufflesLeft : shufflesLeft
    if (effectiveShuffle === 0 || shufflingCol !== null || (mode === 'daily' && alreadyPlayed)) return
    setShuffleMode(false)
    setShufflingCol(ci)
    setShufflePhase('out')
    setTimeout(() => {
      // Derangement: shuffle until no player stays in their original position
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
      setSel(prev => {
        const { [ci]: _, ...rest } = prev
        return rest
      })
      if (mode === 'infinite') {
        setInfShufflesLeft(0)
      } else {
        localStorage.setItem(SHUFFLED_KEY(activeDate.str, user?.id), JSON.stringify({ ci, players: newPlayers }))
        setShufflesLeft(0)
      }
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
        const col = QB_SAL_COLS[ci]
        const srcAttrs = _playerMap.get(p.name)?.attrs ?? p.fullAttrs ?? p.attrs ?? {}
        const attrs = {}
        typesFor({ ...p, attrs: srcAttrs }, col).forEach(t => { attrs[t] = srcAttrs[t] ?? 5 })
        newMap[ci] = { ...p, price, attrs, id: `${col.key}-${price}-${p.name}-r` }
      })
      setRowOverrides(prev => ({ ...prev, [ti]: newMap }))
      setSel(prev => {
        const next = { ...prev }
        QB_SAL_COLS.forEach((_, ci) => {
          if (next[ci] && original[ci]?.name === next[ci]?.name) delete next[ci]
        })
        return next
      })
      if (mode === 'infinite') { setInfShufflesLeft(0) }
      else { setShufflesLeft(0) }
      setShufflePhase('in')
      setTimeout(() => { setShufflingRow(null); setShufflePhase(null) }, 500)
    }, 380)
  }

  const executeScout = (player) => {
    const effectiveScout = mode === 'infinite' ? infScoutsLeft : scoutsLeft
    if (effectiveScout === 0 || (mode === 'daily' && alreadyPlayed)) return
    const grade = calcGrade(player)
    const newGrades = { ...scoutedGrades, [player.name]: grade }
    setScoutedGrades(newGrades)
    if (mode === 'infinite') {
      setInfScoutsLeft(0)
    } else {
      localStorage.setItem(SCOUTED_KEY(activeDate.str, user?.id), JSON.stringify(newGrades))
      setScoutsLeft(0)
    }
    setScoutMode(false)
  }

  // Check localStorage on date/account change; clear sel for unplayed dates
  useEffect(() => {
    const uid = user?.id
    const savedShuffle = localStorage.getItem(SHUFFLED_KEY(activeDate.str, uid))
    setShufflesLeft(savedShuffle ? 0 : 1)
    if (savedShuffle) {
      try {
        const { ci, players } = JSON.parse(savedShuffle)
        setShuffleOverride({ [ci]: players })
      } catch { setShuffleOverride({}) }
    } else {
      setShuffleOverride({})
    }
    setShuffleMode(false)
    const savedScouted = localStorage.getItem(SCOUTED_KEY(activeDate.str, uid))
    setScoutsLeft(savedScouted ? 0 : 1)
    setScoutedGrades(savedScouted ? JSON.parse(savedScouted) : {})
    setScoutMode(false)
    setPowerMenuOpen(false)
    try {
      const s = localStorage.getItem(PLAYED_KEY(activeDate.str, uid))
      if (s) {
        setAlreadyPlayed(JSON.parse(s))
        return
      }
    } catch {}
    setAlreadyPlayed(null)
    setSel({})
  }, [activeDate.str, user?.id])

  // For logged-in users: cross-device check via Supabase
  useEffect(() => {
    if (!user || !supabase) return
    if (localStorage.getItem(PLAYED_KEY(activeDate.str, user.id))) return
    supabase
      .from('qb_salary_cap_plays')
      .select('picks, overall_score, pass_yds, pass_tds, ints')
      .eq('user_id', user.id)
      .eq('date_str', activeDate.str)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const play = {
          picks:   data.picks,
          overall: data.overall_score,
          passYds: data.pass_yds,
          passTds: data.pass_tds,
          ints:    data.ints,
        }
        setAlreadyPlayed(play)
        localStorage.setItem(PLAYED_KEY(activeDate.str, user.id), JSON.stringify(play))
      })
      .catch(() => {})
  }, [user, activeDate.str])

  // Re-populate sel from saved picks so the grid shows their previous selections
  useEffect(() => {
    if (!alreadyPlayed?.picks || !effectiveGrid) return
    const newSel = {}
    alreadyPlayed.picks.forEach((savedPlayer, ci) => {
      if (!savedPlayer) return
      // Search effectiveGrid (includes shuffle overrides) first, fall back to base grid
      const found = effectiveGrid[ci]?.find(p => p.name === savedPlayer.name)
               ?? grid?.[ci]?.find(p => p.name === savedPlayer.name)
      if (found) newSel[ci] = found
    })
    setSel(newSel)
  }, [alreadyPlayed, effectiveGrid])

  const totalCost       = Object.values(sel).reduce((s, p) => s + p.price, 0)
  const pickedAll       = Object.keys(sel).length === QB_SAL_COLS.length
  const overBudget      = totalCost > dailyBudget

  const pick = (ci, player) => {
    if (alreadyPlayed) return
    if (scoutMode) { executeScout(player); return }
    setSel(prev =>
      prev[ci]?.id === player.id
        ? (({ [ci]: _, ...rest }) => rest)(prev)
        : { ...prev, [ci]: player }
    )
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

  // Build keyed by all 9 QB types; each pick fills its column's types with
  // a chip shaped like the main game's spin chips.
  const buildFromSel = () => {
    const build = {}
    QB_SAL_COLS.forEach((col, ci) => {
      const p = sel[ci]
      if (!p) return
      col.types.forEach(type => {
        build[type] = {
          type,
          val:        p.fullAttrs?.[type] ?? p.attrs?.[type] ?? 5,
          qb:         p.short || p.name,
          qbFull:     p.name,
          team:       p.team,
          teamColor:  p.color  ?? p.teamColor  ?? '#444',
          teamColor2: p.color2 ?? p.teamColor2 ?? '#222',
          skinColor:  p.skin ?? null,
          number:     p.number ?? null,
          captain:    !!p.captain,
          photo:      p.photo ?? null,
        }
      })
    })
    // Safety net: every QB type should already be covered by a column.
    const anchor = sel[0]
    TYPES.forEach(type => {
      if (build[type] || !anchor) return
      build[type] = { ...build[QB_SAL_COLS[0].types[0]], type, val: anchor.fullAttrs?.[type] ?? 5 }
    })
    return build
  }

  const confirm = () => {
    if (!pickedAll) return

    if (mode === 'infinite') {
      if (overBudget) return
      const build = buildFromSel()
      const stats = calcStats(sel)
      const picks = QB_SAL_COLS.map((col, ci) => {
        const p = sel[ci]
        return { name: p.name, team: p.team, price: p.price, photo: p.photo, teamColor: p.teamColor, number: p.number }
      })
      const saveData = {
        picks, passYds: stats.passYds, passTds: stats.passTds, ints: stats.ints,
        userId: user?.id ?? null, username: getUsername(user) || null,
        totalCost, infinite: true,
      }
      onConfirm(build, false, null, saveData)
      return
    }

    if (alreadyPlayed) {
      onConfirm(buildFromSel(), true, activeDate.str, null)
      return
    }

    if (overBudget) return

    const build = buildFromSel()
    const stats = calcStats(sel)
    const picks = QB_SAL_COLS.map((col, ci) => {
      const p = sel[ci]
      return {
        name:      p.name,
        team:      p.team,
        price:     p.price,
        photo:     p.photo,
        teamColor: p.teamColor,
        number:    p.number,
      }
    })
    const playData = { picks, overall: stats.overall, passYds: stats.passYds, passTds: stats.passTds, ints: stats.ints }

    localStorage.setItem(PLAYED_KEY(activeDate.str, user?.id), JSON.stringify(playData))
    setAlreadyPlayed(playData)

    // Pass save data to the app so it can insert after the sim with the real OVR
    const saveData = {
      picks,
      passYds:  stats.passYds,
      passTds:  stats.passTds,
      ints:     stats.ints,
      userId:   user?.id ?? null,
      username: getUsername(user) || null,
      totalCost,
    }

    onConfirm(build, false, activeDate.str, saveData)
  }

  const effectiveShufflesLeft = mode === 'infinite' ? infShufflesLeft : shufflesLeft
  const effectiveScoutsLeft   = mode === 'infinite' ? infScoutsLeft   : scoutsLeft
  const missing   = QB_SAL_COLS.length - Object.keys(sel).length
  const viewReady = mode === 'daily' && alreadyPlayed && pickedAll
  const disabled  = viewReady ? false : (!pickedAll || overBudget)
  const ctaLabel  = mode === 'daily' && alreadyPlayed
    ? (pickedAll ? 'View Results →' : '…')
    : !pickedAll
    ? `Pick ${missing} more`
    : overBudget
    ? `$${totalCost - dailyBudget}M over budget`
    : 'Lock In Build →'

  return (
    <div className="sc-screen">
      <div className="sc-header">
        <div className="sc-title">BUILD<span style={{ color: '#a855f7' }}>-A-</span>PLAYER <span style={{ color: '#a855f7' }}>SALARY</span></div>
        <div className="sc-footer-icons">
          {(effectiveShufflesLeft > 0 || effectiveScoutsLeft > 0) && (mode === 'infinite' || !alreadyPlayed) && (
            <div className="sc-power-wrap">
              <button
                className={`sc-lb-btn${powerMenuOpen ? ' sc-lb-btn--open' : ''}${!powerSeen && !powerMenuOpen ? ' sc-lb-btn--pulse' : ''}`}
                onClick={() => {
                  if (!powerSeen) { setPowerSeen(true); localStorage.setItem(POWER_SEEN_KEY, '1') }
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
                if (mode === 'infinite' || alreadyPlayed) {
                  setShowLB(v => !v)
                } else {
                  setShowLBPrompt(true)
                  setTimeout(() => setShowLBPrompt(false), 2800)
                }
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
            {showLBPrompt && (
              <div className="sc-lb-prompt">Play today's game to unlock</div>
            )}
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
          Today's build is locked — come back tomorrow for a new lineup or play a previous date
        </div>
      )}

      <div className="sc-grid-wrap">
        <div className={`sc-grid${shuffleMode ? ' sc-grid--shuffle-mode' : ''}${scoutMode ? ' sc-grid--scout-mode' : ''}`} style={{ gridTemplateColumns: `var(--price-col, 40px) repeat(${QB_SAL_COLS.length}, 1fr)` }}>
          <div />
          {QB_SAL_COLS.map((col, ci) => (
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
                <span className="sc-price-text">${tier}M</span>
                {shuffleMode && (
                  <button className="sc-shuffle-row-target"
                    onClick={() => executeShuffleRow(ti)}
                    onMouseEnter={() => setHoveredShuffle({ type: 'row', idx: ti })}
                    onMouseLeave={() => setHoveredShuffle(null)}>
                    <span className="sc-shuffle-dir-arrow">⇄</span>
                  </button>
                )}
              </div>
              {QB_SAL_COLS.map((col, ci) => (
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
                  scoutMode={scoutMode}
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
        {scoutMode && (
          <div className="sc-shuffle-hint sc-scout-hint">Choose a player to scout</div>
        )}
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
