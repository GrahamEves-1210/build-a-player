import { useMemo, useState } from 'react'
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
import { valToGrade, calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB } from '../utils/simulation'
import { calcBucketOVR } from '../utils/bucketSimulation'

// Every rating in the game, straight from the roster files the spins draw
// from. "As a build" is the overall a player would score if you took every
// one of his chips — the same formula your builds are scored with.

export const RATINGS_AS_OF = 'October 7, 2026'

const asBuild = (p, types) => Object.fromEntries(types.map(t => [t, { val: p.attrs?.[t] ?? 0 }]))
export const POOLS = [
  { id: 'qb',    sport: 'nfl', label: 'QB',     players: QBS, legends: LEGENDS,    types: TYPES,    legendTypes: LEGEND_TYPES,    attr: ATTR,    ovr: (p, t) => calcOVR(asBuild(p, t), t) },
  { id: 'rb',    sport: 'nfl', label: 'RB',     players: RBS, legends: RB_LEGENDS, types: RB_TYPES, legendTypes: RB_LEGEND_TYPES, attr: RB_ATTR, ovr: (p, t) => calcOVRRB(asBuild(p, t), t) },
  { id: 'wr',    sport: 'nfl', label: 'WR',     players: WRS, legends: WR_LEGENDS, types: WR_TYPES, legendTypes: WR_LEGEND_TYPES, attr: WR_ATTR, ovr: (p, t) => calcOVRWR(asBuild(p, t), t) },
  { id: 'te',    sport: 'nfl', label: 'TE',     players: TES, legends: TE_LEGENDS, types: TE_TYPES, legendTypes: TE_LEGEND_TYPES, attr: TE_ATTR, ovr: (p, t) => calcOVRTE(asBuild(p, t), t) },
  { id: 'db',    sport: 'nfl', label: 'DB',     players: DBS, legends: DB_LEGENDS, types: DB_TYPES, legendTypes: DB_LEGEND_TYPES, attr: DB_ATTR, ovr: (p, t) => calcOVRDB(asBuild(p, t), t) },
  { id: 'guard', sport: 'nba', label: 'Guards', players: NBA_GUARD_PLAYERS, legends: NBA_ALLTIME_GUARD_PLAYERS, types: GUARD_TYPES, legendTypes: GUARD_TYPES, attr: BUCKET_ATTR, ovr: (p, t) => calcBucketOVR(asBuild(p, t), t, 'guard') },
  { id: 'big',   sport: 'nba', label: 'Bigs',   players: NBA_BIG_PLAYERS,   legends: NBA_ALLTIME_BIG_PLAYERS,   types: BIG_TYPES,   legendTypes: BIG_TYPES,   attr: BUCKET_ATTR, ovr: (p, t) => calcBucketOVR(asBuild(p, t), t, 'big') },
]
export const poolCounts = () => POOLS.map(p => ({ id: p.id, sport: p.sport, label: p.label, current: p.players.length, legends: p.legends.length }))

const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')
const short = (attr, t) => attr[t]?.shortLabel ?? t.slice(0, 3).toUpperCase()
const long = (attr, t) => attr[t]?.label ?? t

export default function RatingsTable() {
  const [sport, setSport] = useState('nfl')
  const [poolId, setPoolId] = useState('qb')
  const [era, setEra] = useState('current')          // current | legends
  const [q, setQ] = useState('')
  const [team, setTeam] = useState('all')
  const [sort, setSort] = useState({ key: 'ovr', dir: -1 })

  const pool = POOLS.find(p => p.id === poolId) ?? POOLS[0]
  const types = era === 'legends' ? pool.legendTypes : pool.types
  const source = era === 'legends' ? pool.legends : pool.players

  const rows = useMemo(() => {
    const list = source.filter(p => p && p.attrs).map(p => ({ p, ovr: pool.ovr(p, types) ?? 0 }))
    const avg = r => types.reduce((s, t) => s + (r.p.attrs[t] ?? 0), 0) / types.length
    const val = r => (sort.key === 'ovr' ? r.ovr : sort.key === 'name' ? r.p.name : sort.key === 'avg' ? avg(r) : (r.p.attrs[sort.key] ?? -1))
    return list.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir })
  }, [source, types, sort, pool])
  const teams = useMemo(() => [...new Set(source.map(p => p.team).filter(Boolean))].sort(), [source])
  const shown = rows.filter(r => (team === 'all' || r.p.team === team) && (!q || `${r.p.name} ${r.p.team ?? ''} ${r.p.teamName ?? ''}`.toLowerCase().includes(q.toLowerCase())))

  const pick = (s, id) => { setSport(s); setPoolId(id); setTeam('all'); setQ('') }
  const header = (key, label, title) => (
    <th key={key} className={`rt-th${sort.key === key ? ' is-sorted' : ''}`} title={title} onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))}>
      {label}{sort.key === key && <span className="rt-sort">{sort.dir < 0 ? '▾' : '▴'}</span>}
    </th>
  )

  return (
    <div className="rt">
      <div className="rt-controls">
        <div className="rt-pills">
          {POOLS.filter(p => p.sport === 'nfl').map(p => <button key={p.id} className={`rt-pill${poolId === p.id ? ' is-on' : ''}`} onClick={() => pick('nfl', p.id)}>{p.label}</button>)}
          <span className="rt-pill-sep" />
          {POOLS.filter(p => p.sport === 'nba').map(p => <button key={p.id} className={`rt-pill rt-pill--nba${poolId === p.id ? ' is-on' : ''}`} onClick={() => pick('nba', p.id)}>{p.label}</button>)}
        </div>
        <div className="rt-pills">
          <button className={`rt-pill${era === 'current' ? ' is-on' : ''}`} onClick={() => { setEra('current'); setTeam('all') }}>Current</button>
          <button className={`rt-pill rt-pill--gold${era === 'legends' ? ' is-on' : ''}`} onClick={() => { setEra('legends'); setTeam('all') }}>All-Time</button>
        </div>
        <div className="rt-filters">
          <input className="rt-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a player or team…" aria-label="Search players" />
          <select className="rt-select" value={team} onChange={e => setTeam(e.target.value)} aria-label="Team">
            <option value="all">All teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="rt-meta">
        <span><b>{shown.length}</b> {era === 'legends' ? 'all-time' : 'current'} {pool.label === 'Guards' || pool.label === 'Bigs' ? pool.label.toLowerCase() : `${pool.label}s`} · ratings as of <b>{RATINGS_AS_OF}</b></span>
        <span className="rt-legend">{[['S', 11], ['A', 9], ['B', 6], ['C', 3], ['D', 1], ['F', 0]].map(([g, v]) => <i key={g} style={{ '--g': gradeColor(v) }}>{g}</i>)} 1–11 scale, F to S</span>
      </div>
      <div className="rt-scroll">
        <table className="rt-table">
          <thead>
            <tr>
              {header('name', 'Player', 'Sort by name')}
              {types.map(t => header(t, short(pool.attr, t), long(pool.attr, t)))}
              {header('avg', 'AVG', 'Average rating')}
              {header('ovr', 'OVR', 'Overall as a full build of this player')}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ p, ovr }) => (
              <tr key={`${p.name}-${p.team}`}>
                <td className="rt-player">
                  <span className="rt-name">{p.name}</span>
                  <span className="rt-team">{p.team}{p.number != null ? ` · #${p.number}` : ''}{p.position ? ` · ${p.position}` : ''}{p.years ? ` · ${p.years}` : ''}</span>
                </td>
                {types.map(t => { const v = p.attrs[t]; return <td key={t} className="rt-cell"><span className="rt-grade" style={{ '--g': gradeColor(v ?? 0) }} title={`${long(pool.attr, t)}: ${v ?? '—'}/11`}>{v == null ? '—' : valToGrade(v)}</span></td> })}
                <td className="rt-cell rt-avg">{(types.reduce((s, t) => s + (p.attrs[t] ?? 0), 0) / types.length).toFixed(1)}</td>
                <td className="rt-cell rt-ovr"><b>{ovr}</b></td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td className="rt-empty" colSpan={types.length + 3}>No players match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
