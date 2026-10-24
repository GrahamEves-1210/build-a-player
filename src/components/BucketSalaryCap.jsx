import React, { useState, useMemo, useEffect } from 'react'
import { NameTag } from './app/NameTag'
import { NBA_GUARD_PLAYERS } from '../data/nba-guards'
import { NBA_BIG_PLAYERS } from '../data/nba-bigs'
import { NBA_TEAMS } from '../data/nba-teams'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
import { salaryKit } from '../lib/salaryCore'
import { supabase } from '../lib/supabase'
import { valToGrade, HEADSHOT_BASE } from '../utils/simulation'
import { getUsername } from '../lib/discord'

/*
  Supabase tables required:

  CREATE TABLE salary_cap_plays (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date_str      text NOT NULL,
    user_id       uuid REFERENCES auth.users(id),
    username      text,
    picks         jsonb NOT NULL,
    overall_score int  NOT NULL,
    ppg           numeric(4,1),
    apg           numeric(3,1),
    rpg           numeric(3,1),
    budget_used   int,
    created_at    timestamptz DEFAULT now()
  );

  CREATE TABLE salary_cap_grids (
    date_str      text PRIMARY KEY,
    grid          jsonb NOT NULL,
    created_at    timestamptz DEFAULT now()
  );

  CREATE TABLE salary_infinite_plays (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid REFERENCES auth.users(id),
    username      text,
    picks         jsonb NOT NULL,
    overall_score int  NOT NULL,
    ppg           numeric(4,1),
    apg           numeric(3,1),
    rpg           numeric(3,1),
    budget_used   int,
    created_at    timestamptz DEFAULT now()
  );
*/

import { BUCKET_SAL_POOL as ALL_PLAYERS, GOAT_SALARY_PLAYERS, SAL_COLS, playerPosGroup, salTypesFor as typesFor } from '../data/nba-salary'
export { SAL_COLS }

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
  if (dateStr === '2026-07-15') return 140
  if (dateStr === '2026-07-16') return 150
  if (dateStr === '2026-07-17') return 140
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

// One representative type per category (for ReportCard / SimPage display)
export const SAL_REP_TYPES = ['finishing', 'jumpShot', 'perimeterDefense', 'passing', 'size']

export const SAL_ATTR_MAP = {
  finishing:        { label: 'FINISHING',          col: '#fb923c', hex: '#fb923c' },
  jumpShot:         { label: 'SHOOTING',           col: '#34d399', hex: '#34d399' },
  perimeterDefense: { label: 'DEFENSE',            col: '#38bdf8', hex: '#38bdf8' },
  passing:          { label: 'PLAYMAKING',         col: '#60a5fa', hex: '#60a5fa' },
  size:             { label: 'SIZE & ATHLETICISM', col: '#a78bfa', hex: '#a78bfa' },
}

const TEAM_META = Object.fromEntries(NBA_TEAMS.map(t => [t.short, t]))

// ─── Hardcoded grids for Jul 15-17 (locked forever) ──────────────────────────
const _playerMap = new Map(
  [...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS, ...GOAT_SALARY_PLAYERS]
    .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)
    .map(p => [p.name, p])
)
function buildHardcodedGrid(nameGrid) {
  return SAL_COLS.map((col, ci) =>
    TIERS.map((price, ti) => {
      const p = _playerMap.get(nameGrid[ci][ti]) ?? { name: nameGrid[ci][ti], team: 'FA', attrs: {} }
      const attrs = {}
      typesFor(p, col).forEach(t => { attrs[t] = p.attrs?.[t] ?? 5 })
      const hsId = NBA_HEADSHOTS[p.name]
      return {
        ...p, price, attrs,
        teamColor:  TEAM_META[p.team]?.color  ?? '#444',
        teamColor2: TEAM_META[p.team]?.color2 ?? '#222',
        photo:  hsId ? null : null,   // app-clean: no photos (the card shows the team badge)
        number: p.number ?? null,
        id:     `${col.key}-${price}-${p.name}`,
      }
    })
  )
}
const HARDCODED_GRIDS = {
  20260715: buildHardcodedGrid([
    ['Aaron Gordon','Chris Paul','Donovan Mitchell','Dyson Daniels','Amen Thompson'],
    ['Devin Vassell','Michael Porter Jr.','Immanuel Quickley','Paul George','Josh Giddey'],
    ['Alex Caruso','Kyle Kuzma','Pascal Siakam','Miles Bridges','Tyrese Haliburton'],
    ['Jrue Holiday','Paolo Banchero','Ausar Thompson','Wilt Chamberlain','Julius Randle'],
    ['LeBron James','Andrew Nembhard','Luguentz Dort','LaMelo Ball','Josh Hart'],
  ]),
  20260716: buildHardcodedGrid([
    ['Franz Wagner','Steve Nash','LeBron James','Amen Thompson','Dylan Harper'],
    ['Tyrese Maxey','Cade Cunningham','Donovan Mitchell','Aaron Gordon','Paolo Banchero'],
    ['Charles Barkley','Paul George','Kyrie Irving','Kyle Kuzma','Tyler Herro'],
    ['Desmond Bane','Matas Buzelis','Luguentz Dort','Shai Gilgeous-Alexander','Jayson Tatum'],
    ['Jaylen Brown','Cooper Flagg','Tyrese Haliburton',"De'Aaron Fox",'Keyonte George'],
  ]),
  20260717: buildHardcodedGrid([
    ['Kareem Abdul-Jabbar','Andrew Nembhard','Shai Gilgeous-Alexander','Jimmy Butler III','Jaren Jackson Jr.'],
    ['Austin Reaves','Alex Caruso','Cooper Flagg','Deni Avdija','LeBron James'],
    ['Bill Russell','Mikal Bridges',"De'Aaron Fox",'Paolo Banchero','Tyrese Maxey'],
    ['Jalen Brunson','Miles Bridges','Kawhi Leonard','Shaedon Sharpe','Josh Hart'],
    ['John Collins','Pascal Siakam','Jaden McDaniels','Josh Giddey','RJ Barrett'],
  ]),
  20260718: buildHardcodedGrid([
    ['Michael Jordan','Michael Porter Jr.','Nickeil Alexander-Walker','Terance Mann','Toumani Camara'],
    ['Dirk Nowitzki','Tristan da Silva','Jase Richardson','Sion James','Julius Randle'],
    ['Walker Kessler','Peyton Watson','Aaron Gordon','Jamal Murray','Ace Bailey'],
    ['Nikola Jokic','AJ Dybantsa','OG Anunoby','Jaden McDaniels','Koa Peat'],
    ['Russell Westbrook','Tyrese Maxey','Luke Kornet','Kingston Flemings','Jabari Smith Jr.'],
  ]),
}

// Category accent colors — one per column key
const COL_COLORS = {
  finishing:  '#fb923c',
  shooting:   '#34d399',
  defense:    '#38bdf8',
  playmaking: '#60a5fa',
  size:       '#a78bfa',
}

// ─── Score calculation ─────────────────────────────────────────────────────────
// Uses peak attr per column — gives fair credit to specialists and matches intuition
function calcStats(sel) {
  const scoreFor = (ci) => {
    const p = sel[ci]
    if (!p?.attrs) return 5
    const vals = Object.values(p.attrs)
    return vals.length ? Math.max(...vals) : 5
  }
  const fScore  = scoreFor(0)
  const sScore  = scoreFor(1)
  const dScore  = scoreFor(2)
  const pScore  = scoreFor(3)
  const szScore = scoreFor(4)
  const overall = Math.round(fScore + sScore + dScore + pScore + szScore)
  const ppg     = +((fScore + sScore) / 2 * 2.6 + 1.8).toFixed(1)
  const apg     = +(pScore * 0.8 + 0.5).toFixed(1)
  const rpg     = +(szScore * 1.0 + 1.2).toFixed(1)
  return { overall, ppg, apg, rpg }
}

const PLAYED_KEY     = (str, uid) => uid ? `sal_play_${uid}_${str}`     : `sal_play_${str}`
const SHUFFLED_KEY   = (str, uid) => uid ? `sal_shuffled_${uid}_${str}` : `sal_shuffled_${str}`
// A day's shuffle as saved: a column ({ ci, players }) or a row ({ ti, row })
const parseShuffle = saved => {
  try { const v = JSON.parse(saved); return { col: v?.players ? { [v.ci]: v.players } : {}, row: v?.row ? { [v.ti]: v.row } : {} } } catch { return { col: {}, row: {} } }
}
const SCOUTED_KEY    = (str, uid) => uid ? `sal_scouted_${uid}_${str}`  : `sal_scouted_${str}`
const POWER_SEEN_KEY = 'sal_power_seen'

// ─── Grid generation ──────────────────────────────────────────────────────────
// Returns the set of player names that would be picked for a given seed (used to
// detect back-to-back appearances and apply a penalty the following day).
// Compute the correct salary tier for a legend in a given column by ranking
// their catScore against the regular player pool (no rand needed — deterministic).
// the board itself: lib/salaryCore.js (the live server checks plays against the same board)
const { legendTierFor, pickLegendSlots, getPickedNamesForSeed, generateGrid } = salaryKit({ typesFor, look: p => { const hsId = NBA_HEADSHOTS[p.name]; return { teamColor: TEAM_META[p.team]?.color ?? '#444', teamColor2: TEAM_META[p.team]?.color2 ?? '#222', photo: hsId ? null : null } } })

// Pick 2 deterministic legend slots — cycles through all legends before repeating.
// rand() still used for column and tier nudge so placement varies day-to-day.



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
        <img src={`/logos/nba/${player.team}.svg`} alt="" aria-hidden="true" className="sc-card-logo-bg"
          onError={e => { e.currentTarget.style.display = 'none' }} />
        {player.photo
          ? <img src={player.photo} alt={player.name} className="sc-card-headshot" />
          : <div className="sc-card-no-photo">
              <img src={`/logos/nba/${player.team}.svg`} alt={player.team} style={{ width: '55%', opacity: 0.7 }} />
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

// ─── InfiniteLeaderboard ─────────────────────────────────────────────────────
function InfiniteLeaderboard({ onClose }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!supabase) { setRows([]); return }
    supabase
      .from('salary_infinite_plays')
      .select('username, user_id, picks, overall_score, ppg, apg, rpg')
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
              <span className="sc-lb-name">{r.username ? <NameTag name={r.username} uid={r.user_id ?? null} /> : 'Anonymous'}</span>
              <span className="sc-lb-ovr">{r.overall_score} OVR</span>
            </div>
            {r.picks && (
              <div className="sc-lb-picks">
                {r.picks.map((p, pi) => (
                  <div key={pi} className="sc-lb-pick" title={p.name} style={{ '--tc': p.teamColor || '#444' }}>
                    {p.photo
                      ? <img src={p.photo} alt={p.name} />
                      : <img src={`/logos/nba/${p.team}.svg`} alt={p.team} style={{ padding: '4px', opacity: 0.7 }} />
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
      .from('salary_cap_plays')
      .select('username, user_id, picks, overall_score, ppg, apg, rpg, budget_used')
      .eq('date_str', dateStr)
      .order('overall_score', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const sorted = (data || []).sort((a, b) => {
          if (b.overall_score !== a.overall_score) return b.overall_score - a.overall_score
          return (b.ppg + b.apg + b.rpg) - (a.ppg + a.apg + a.rpg)
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
              <span className="sc-lb-name">{r.username ? <NameTag name={r.username} uid={r.user_id ?? null} /> : 'Anonymous'}</span>
              <span className="sc-lb-ovr">{r.overall_score} OVR</span>
              {r.budget_used != null && budget - r.budget_used > 0 && (
                <span className="sc-lb-spare">+${budget - r.budget_used}M</span>
              )}
            </div>
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
                      : <img src={`/logos/nba/${p.team}.svg`} alt={p.team} style={{ padding: '4px', opacity: 0.7 }} />
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

// ─── BucketSalaryCap ──────────────────────────────────────────────────────────
export default function BucketSalaryCap({ onConfirm, onBack, user, initialDateStr, position = 'guard' }) {
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
    return saved ? parseShuffle(saved).col : {}
  })
  const [shufflingCol,    setShufflingCol]    = useState(null)
  const [shufflingRow,    setShufflingRow]    = useState(null)
  const [rowOverrides,    setRowOverrides]    = useState(() => {
    const saved = localStorage.getItem(SHUFFLED_KEY(getESTDate(0).str, user?.id))
    return saved ? parseShuffle(saved).row : {}
  })
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
  // (in salary_cap_grids), so a day's board can never quietly drift out from
  // under players who already submitted picks for it — regenerating on the
  // fly (the old behavior) breaks the moment the underlying roster data
  // changes, since the same seed then picks different actual players.
  // A stored board is only as good as whoever wrote it (any signed-in player can), so it's
  // taken only if it's a real one: every price its tier's, every player real at their real
  // ratings, and most cells the same as the board this phone makes from the day's seed.
  // Photos are always our own. Anything else: the phone's own board.
  const trustedFrozen = (frozen) => {
    if (!Array.isArray(frozen) || frozen.length !== SAL_COLS.length || !frozen.every(col => Array.isArray(col) && col.length === TIERS.length)) return null
    // the generator's own ranking (yesterday's players marked down the same way), so a
    // re-rate since the freeze still passes but a star dropped into a cheap tier doesn't
    const recent = recentFor(activeDate)
    const regulars = ALL_PLAYERS.filter(p => !p.legend)
    let legends = 0
    for (let ci = 0; ci < frozen.length; ci++) {
      const col = SAL_COLS[ci]
      const score = p => { const ts = typesFor(p, col); return ts.reduce((s, x) => s + (p.attrs?.[x] ?? 5), 0) / ts.length - (recent.has(p.name) ? 3.5 : 0) }
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
    return frozen.map(col => col.map(cell => { const hs = NBA_HEADSHOTS[cell.name]; return { ...cell, photo: hs ? null : null } }))
  }
  const recentFor = (date) => {
    const yesterday = new Date(date.y, date.m - 1, date.day - 1)
    const yy = yesterday.getFullYear(), ym = yesterday.getMonth() + 1, yd = yesterday.getDate()
    return getPickedNamesForSeed(yy * 10000 + ym * 100 + yd, SAL_COLS, ALL_PLAYERS)
  }
  const localGenerateGrid = (date) => {
    const rand = seededRandom(date.seed)
    const yesterday = new Date(date.y, date.m - 1, date.day - 1)
    const yy = yesterday.getFullYear(), ym = yesterday.getMonth() + 1, yd = yesterday.getDate()
    const recentlyUsed = getPickedNamesForSeed(yy * 10000 + ym * 100 + yd, SAL_COLS, ALL_PLAYERS)
    return generateGrid(SAL_COLS, ALL_PLAYERS, rand, recentlyUsed, date.seed)
  }
  const computeGridSync = (date, currentMode, seed) => {
    if (currentMode === 'infinite') {
      const rand = seededRandom(seed)
      return generateGrid(SAL_COLS, ALL_PLAYERS, rand, new Set(), seed)
    }
    if (HARDCODED_GRIDS[date.seed]) return HARDCODED_GRIDS[date.seed]
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
    if (mode === 'infinite' || HARDCODED_GRIDS[activeDate.seed] || !supabase) return
    let cancelled = false
    const localGuess = localGenerateGrid(activeDate)

    // Always check for an already-frozen copy first, even for today — an
    // earlier visitor today may have already locked one in using whatever
    // roster data was live at that moment. Skipping this check for "today"
    // (the old behavior) let a later visitor's local regeneration diverge
    // from the actually-frozen board whenever roster data changed mid-day,
    // so their picker wouldn't show players the leaderboard already had
    // real picks of (e.g. a player who'd since been re-rated or moved).
    supabase.from('salary_cap_grids')
      .select('grid')
      .eq('date_str', activeDate.str)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('[salary-cap] grid fetch failed:', error); return }
        const frozen = data?.grid ? trustedFrozen(data.grid) : null
        if (data?.grid && !frozen) { console.warn(`[${'salary-cap'}] the stored board for ${activeDate.str} didn't check out; using this phone's own`); return }
        if (frozen) {
          setGrid(frozen) // swap to the historically-accurate frozen board
        } else {
          // No frozen record yet (first visitor of the day, or a past date
          // from before this fix shipped) — lock in our local regeneration
          // now so it's the stable, shared board from here on.
          supabase.from('salary_cap_grids')
            .upsert({ date_str: activeDate.str, grid: localGuess }, { onConflict: 'date_str', ignoreDuplicates: true })
            .then(({ error }) => { if (error) console.error('[salary-cap] grid save failed:', error) })
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
    if (activeDate.str === '2026-07-15') return 140
    if (activeDate.str === '2026-07-16') return 150
    if (activeDate.str === '2026-07-17') return 140
    const r = seededRandom(activeDate.seed ^ 0xB0B0B0)
    return BUDGET_OPTIONS[Math.floor(r() * BUDGET_OPTIONS.length)]
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
        const col = SAL_COLS[ci]
        const srcAttrs = _playerMap.get(p.name)?.attrs ?? p.attrs ?? {}
        const attrs = {}
        typesFor({ ...p, attrs: srcAttrs }, col).forEach(t => { attrs[t] = srcAttrs[t] ?? 5 })
        newMap[ci] = { ...p, price, attrs, id: `${col.key}-${price}-${p.name}-r` }
      })
      setRowOverrides(prev => ({ ...prev, [ti]: newMap }))
      setSel(prev => {
        const next = { ...prev }
        SAL_COLS.forEach((_, ci) => {
          if (next[ci] && original[ci]?.name === next[ci]?.name) delete next[ci]
        })
        return next
      })
      if (mode === 'infinite') { setInfShufflesLeft(0) }
      else {
        localStorage.setItem(SHUFFLED_KEY(activeDate.str, user?.id), JSON.stringify({ ti, row: newMap }))
        setShufflesLeft(0)
      }
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
    // the day's shuffle comes back with it (column or row), so a played board
    // shows the picks where they were made
    const restored = savedShuffle ? parseShuffle(savedShuffle) : { col: {}, row: {} }
    setShuffleOverride(restored.col)
    setRowOverrides(restored.row)
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
      .from('salary_cap_plays')
      .select('picks, overall_score, ppg, apg, rpg')
      .eq('user_id', user.id)
      .eq('date_str', activeDate.str)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data) return
        const play = {
          picks:   data.picks,
          overall: data.overall_score,
          ppg:     data.ppg,
          apg:     data.apg,
          rpg:     data.rpg,
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
  const pickedAll       = Object.keys(sel).length === SAL_COLS.length
  const overBudget      = totalCost > dailyBudget
  const effectivePosition = sel[4] ? (playerPosGroup(sel[4]) === 'big' ? 'big' : 'guard') : position

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

  const buildFromSel = () => {
    const build = {}
    SAL_COLS.forEach((col, ci) => {
      const p = sel[ci]
      // Always use guard-key names as canonical keys so the build is consistent
      // regardless of which position mode the user started in. Values fall back
      // to the big-type attr when a player doesn't have the guard-type attr.
      col.guardTypes.forEach(type => {
        const val = p.attrs[type] ?? col.bigTypes.map(t => p.attrs[t]).find(v => v != null) ?? 5
        build[type] = {
          type, val,
          qb: p.short ?? p.name, qbFull: p.name,
          teamColor: p.teamColor, teamColor2: p.teamColor2,
          team: p.team, captain: p.captain ?? false,
          photo: p.photo, skinColor: p.skin ?? null,
          number: p.number ?? null, height: p.height ?? null, weight: p.weight ?? null,
        }
      })
    })
    // basketballIQ and clutch aren't their own draftable category (and
    // basketballIQ alone is a full 0.14 of a guard's OVR — tied for the
    // single heaviest weight of any attribute), so approximate them from
    // the real picked players' actual stats instead of an unrelated proxy.
    // Anchored visually on the Size pick (sel[4]) to match the existing
    // "size player = model figure" convention used elsewhere.
    const anchor = sel[4]
    const selVals     = Object.values(sel)
    const iqVals     = selVals.map(p => p.fullAttrs?.basketballIQ).filter(v => v != null)
    const clutchVals = selVals.map(p => p.fullAttrs?.clutch).filter(v => v != null)
    // rebounding is big-only and, like basketballIQ, has no SAL_COLS column of
    // its own — it was previously hardcoded to a flat 6 regardless of who was
    // picked, even though it's tied for the single heaviest weight for bigs
    // (0.15). Guards never read this field, so a missing/default average here
    // is harmless for them.
    const rebVals    = selVals.map(p => p.fullAttrs?.rebounding).filter(v => v != null)
    const avg = vals => vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 5
    const anchorFields = {
      qb: anchor.short ?? anchor.name, qbFull: anchor.name,
      teamColor: anchor.teamColor, teamColor2: anchor.teamColor2,
      team: anchor.team, captain: anchor.captain ?? false,
      photo: anchor.photo, skinColor: anchor.skin ?? null,
      number: anchor.number ?? null, height: anchor.height ?? null, weight: anchor.weight ?? null,
    }
    build['basketballIQ'] = { type: 'basketballIQ', val: avg(iqVals), ...anchorFields }
    build['clutch']       = { type: 'clutch',       val: avg(clutchVals), ...anchorFields }
    build['rebounding']   = { type: 'rebounding',   val: avg(rebVals), ...anchorFields }
    return build
  }

  const confirm = () => {
    if (!pickedAll) return

    if (mode === 'infinite') {
      if (overBudget) return
      const build = buildFromSel()
      const stats = calcStats(sel)
      const picks = SAL_COLS.map((col, ci) => {
        const p = sel[ci]
        return { name: p.name, team: p.team, price: p.price, photo: p.photo, teamColor: p.teamColor, number: p.number }
      })
      const saveData = {
        picks, ppg: stats.ppg, apg: stats.apg, rpg: stats.rpg,
        userId: user?.id ?? null, username: getUsername(user) || null,
        totalCost, infinite: true,
      }
      onConfirm(build, false, null, saveData, effectivePosition)
      return
    }

    if (alreadyPlayed) {
      onConfirm(buildFromSel(), true, activeDate.str, null, effectivePosition)
      return
    }

    if (overBudget) return

    const build = buildFromSel()
    const stats = calcStats(sel)
    const picks = SAL_COLS.map((col, ci) => {
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
    const playData = { picks, overall: stats.overall, ppg: stats.ppg, apg: stats.apg, rpg: stats.rpg }

    // the day's board was already played on this device by someone else (a guest, another
    // account): they've seen every pick on the board, so this play doesn't post
    const devKey = `sal_dev_${activeDate.str}`, me = user?.id || 'guest'
    let scouted = false
    if (mode !== 'infinite') { try { const by = localStorage.getItem(devKey); if (by && by !== me) scouted = true; else if (!by) localStorage.setItem(devKey, me) } catch {} }
    localStorage.setItem(PLAYED_KEY(activeDate.str, user?.id), JSON.stringify(playData))
    setAlreadyPlayed(playData)

    // Pass save data to BucketApp so it can insert after the sim with the real OVR
    const saveData = {
      picks,
      ppg:      stats.ppg,
      apg:      stats.apg,
      rpg:      stats.rpg,
      userId:   user?.id ?? null,
      noPost:   scouted,
      username: getUsername(user) || null,
      totalCost,
    }

    onConfirm(build, false, activeDate.str, saveData, effectivePosition)
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
