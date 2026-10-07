import { useEffect, useMemo, useState } from 'react'
import { QBS, ATTR, TYPES } from '../data/qbs'
import { RBS, RB_ATTR, RB_TYPES } from '../data/rbs'
import { WRS, WR_ATTR, WR_TYPES } from '../data/wrs'
import { TES, TE_ATTR, TE_TYPES } from '../data/tes'
import { DBS, DB_ATTR, DB_TYPES } from '../data/dbs'
import { LEGENDS, LEGEND_TYPES } from '../data/qb-legends'
import { RB_LEGENDS, RB_LEGEND_TYPES } from '../data/rb-legends'
import { WR_LEGENDS, WR_LEGEND_TYPES } from '../data/wr-legends'
import { TE_LEGENDS, TE_LEGEND_TYPES } from '../data/te-legends'
import { DB_LEGENDS, DB_LEGEND_TYPES } from '../data/db-legends'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs'
import { NBA_ALLTIME_GUARD_PLAYERS } from '../data/nba-guard-legends'
import { NBA_ALLTIME_BIG_PLAYERS } from '../data/nba-big-legends'
import { BUCKET_ATTR } from '../data/nba-attrs'
import { valToGrade } from '../utils/simulation'

// Every rating in the game, straight from the roster files the spins draw
// from, so the table changes whenever the data does. The "as of" dates come
// from git at build time (vite.config.js) — the last commit that touched each
// pool. Ratings only: no derived overall, which the per-attribute grades were
// never tuned to produce.

const DATES = typeof __RATINGS_DATES__ !== 'undefined' ? __RATINGS_DATES__ : {}
export const RATINGS_DATES = DATES
export const RATINGS_AS_OF = DATES.all ?? null
export const fmtDate = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'the latest update')

export const POOLS = [
  { id: 'qb',    sport: 'nfl', label: 'QB',     plural: 'quarterbacks',    players: QBS, legends: LEGENDS,    types: TYPES,    legendTypes: LEGEND_TYPES,    attr: ATTR },
  { id: 'rb',    sport: 'nfl', label: 'RB',     plural: 'running backs',   players: RBS, legends: RB_LEGENDS, types: RB_TYPES, legendTypes: RB_LEGEND_TYPES, attr: RB_ATTR },
  { id: 'wr',    sport: 'nfl', label: 'WR',     plural: 'wide receivers',  players: WRS, legends: WR_LEGENDS, types: WR_TYPES, legendTypes: WR_LEGEND_TYPES, attr: WR_ATTR },
  { id: 'te',    sport: 'nfl', label: 'TE',     plural: 'tight ends',      players: TES, legends: TE_LEGENDS, types: TE_TYPES, legendTypes: TE_LEGEND_TYPES, attr: TE_ATTR },
  { id: 'db',    sport: 'nfl', label: 'DB',     plural: 'defensive backs', players: DBS, legends: DB_LEGENDS, types: DB_TYPES, legendTypes: DB_LEGEND_TYPES, attr: DB_ATTR },
  { id: 'guard', sport: 'nba', label: 'Guards', plural: 'guards',          players: NBA_GUARD_PLAYERS, legends: NBA_ALLTIME_GUARD_PLAYERS, types: GUARD_TYPES, legendTypes: GUARD_TYPES, attr: BUCKET_ATTR },
  { id: 'big',   sport: 'nba', label: 'Bigs',   plural: 'bigs',            players: NBA_BIG_PLAYERS,   legends: NBA_ALLTIME_BIG_PLAYERS,   types: BIG_TYPES,   legendTypes: BIG_TYPES,   attr: BUCKET_ATTR },
]
export const poolCounts = () => POOLS.map(p => ({ id: p.id, sport: p.sport, label: p.label, plural: p.plural, current: p.players.length, legends: p.legends.length, updated: DATES[p.id] ?? null }))

export const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')
const short = (attr, t) => attr[t]?.shortLabel ?? t.slice(0, 3).toUpperCase()
const long = (attr, t) => attr[t]?.label ?? t

export default function RatingsTable({ initialQuery = '', initialPool = 'qb' }) {
  const [poolId, setPoolId] = useState(POOLS.some(p => p.id === initialPool) ? initialPool : 'qb')
  const [era, setEra] = useState('current')          // current | legends
  const [q, setQ] = useState(initialQuery)
  const [team, setTeam] = useState('all')
  const [sort, setSort] = useState({ key: 'avg', dir: -1 })
  useEffect(() => { setQ(initialQuery) }, [initialQuery])
  useEffect(() => { if (POOLS.some(p => p.id === initialPool)) setPoolId(initialPool) }, [initialPool])

  const pool = POOLS.find(p => p.id === poolId) ?? POOLS[0]
  const types = era === 'legends' ? pool.legendTypes : pool.types
  const source = era === 'legends' ? pool.legends : pool.players

  const avgOf = p => types.reduce((s, t) => s + (p.attrs[t] ?? 0), 0) / types.length
  const rows = useMemo(() => {
    const list = source.filter(p => p && p.attrs)
    const val = p => (sort.key === 'name' ? p.name : sort.key === 'avg' ? avgOf(p) : (p.attrs[sort.key] ?? -1))
    return [...list].sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir })
  }, [source, types, sort]) // eslint-disable-line
  const teams = useMemo(() => [...new Set(source.map(p => p.team).filter(Boolean))].sort(), [source])
  const needle = q.trim().toLowerCase()
  const shown = rows.filter(p => (team === 'all' || p.team === team) && (!needle || `${p.name} ${p.team ?? ''} ${p.teamName ?? ''}`.toLowerCase().includes(needle)))

  const pick = id => { setPoolId(id); setTeam('all') }
  const header = (key, label, title) => (
    <th key={key} className={`wk-rt-th${sort.key === key ? ' is-sorted' : ''}`} title={title} onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))} scope="col">
      {label}{sort.key === key && <span className="wk-rt-sort">{sort.dir < 0 ? ' ▾' : ' ▴'}</span>}
    </th>
  )

  return (
    <div className="wk-rt">
      <div className="wk-rt-controls">
        <div className="wk-rt-pills" role="tablist" aria-label="Position">
          {POOLS.filter(p => p.sport === 'nfl').map(p => <button key={p.id} role="tab" aria-selected={poolId === p.id} className={`wk-pill${poolId === p.id ? ' is-on' : ''}`} onClick={() => pick(p.id)}>{p.label}</button>)}
          <span className="wk-pill-sep" aria-hidden="true" />
          {POOLS.filter(p => p.sport === 'nba').map(p => <button key={p.id} role="tab" aria-selected={poolId === p.id} className={`wk-pill wk-pill--nba${poolId === p.id ? ' is-on' : ''}`} onClick={() => pick(p.id)}>{p.label}</button>)}
          <span className="wk-pill-sep" aria-hidden="true" />
          <button className={`wk-pill${era === 'current' ? ' is-on' : ''}`} onClick={() => { setEra('current'); setTeam('all') }}>Current</button>
          <button className={`wk-pill wk-pill--gold${era === 'legends' ? ' is-on' : ''}`} onClick={() => { setEra('legends'); setTeam('all') }}>All-Time</button>
        </div>
        <div className="wk-rt-filters">
          <input className="wk-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by player or team" aria-label="Filter players" />
          <select className="wk-select" value={team} onChange={e => setTeam(e.target.value)} aria-label="Team">
            <option value="all">All teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <p className="wk-rt-meta">
        <span><b>{shown.length}</b> {era === 'legends' ? 'all-time' : 'current'} {pool.plural} · ratings updated <b>{fmtDate(DATES[pool.id])}</b></span>
        <span className="wk-rt-legend">{[['S', 11], ['A', 9], ['B', 6], ['C', 3], ['D', 1], ['F', 0]].map(([g, v]) => <i key={g} style={{ '--g': gradeColor(v) }}>{g}</i>)} scale 0–11, F to S</span>
      </p>
      <div className="wk-rt-scroll">
        <table className="wikitable wk-rt-table">
          <thead>
            <tr>
              {header('name', 'Player', 'Sort by name')}
              {types.map(t => header(t, short(pool.attr, t), long(pool.attr, t)))}
              {header('avg', 'Avg', 'Plain average of the ratings')}
            </tr>
          </thead>
          <tbody>
            {shown.map(p => (
              <tr key={`${p.name}-${p.team}`}>
                <th scope="row" className="wk-rt-player">
                  <span className="wk-rt-name">{p.name}</span>
                  <span className="wk-rt-team">{p.team}{p.number != null ? ` · #${p.number}` : ''}{p.position ? ` · ${p.position}` : ''}{p.years ? ` · ${p.years}` : ''}</span>
                </th>
                {types.map(t => { const v = p.attrs[t]; return <td key={t} className="wk-rt-cell"><span className="wk-grade" style={{ '--g': gradeColor(v ?? 0) }} title={`${long(pool.attr, t)}: ${v ?? '—'} of 11`}>{v == null ? '—' : valToGrade(v)}</span></td> })}
                <td className="wk-rt-cell wk-rt-avg">{avgOf(p).toFixed(1)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td className="wk-rt-empty" colSpan={types.length + 2}>No players match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
