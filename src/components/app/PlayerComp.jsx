import { useMemo } from 'react'
import { playerBadge } from '../../lib/playerTeams'
import { compsFor, POS_ATTR } from '../../lib/career'
import { valToGrade, nflHeadshot } from '../../utils/simulation'

// The player comp: who a build plays like, the closest real players at the position
// (today's and the all-time greats), trait by trait. Career shows it for your player;
// the build screen's report card shows it once a build is complete.
//   c    { sport: 'nfl' | 'bucket', pos, types, build }
//   who  whose build it is (the heading)   col  the left column's label (default: who's last name)

const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }   // rounded like the letter (valToGrade)
const photoSrc = (p, bucket) => (!p ? null : String(p.photo ?? '').startsWith('/logos/') ? p.photo : playerBadge(bucket ? 'bucket' : 'nfl', p.name, p.team ?? null))   // app-clean: the team badge
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('')
// a last name (Jr., III and the like skipped)
const lastName = n => { const w = String(n || '').trim().split(/\s+/).filter(x => !/^(jr|sr|ii|iii|iv|v)\.?$/i.test(x)); return w[w.length - 1] || n || '' }

export default function PlayerComp({ c, who, col = null, list = false, className = '' }) {
  const attr = POS_ATTR[c.pos] ?? {}
  const comps = useMemo(() => compsFor(c, 5), [c.build, c.pos, c.sport, c.types]) // eslint-disable-line react-hooks/exhaustive-deps
  const top = comps[0]
  if (!top) return null
  const era = x => (x.era === 'current' ? `TODAY · ${x.team}` : `ALL-TIME${x.years ? ` · ${x.years}` : ''}`)
  const mine = col ?? lastName(who).toUpperCase()
  const his = lastName(top.name).toUpperCase()
  // a long last name (Gilgeous-Alexander, Antetokounmpo) needs the one-column table with wide columns
  const wide = mine.length > 9 || his.length > 9
  const oneCol = list || c.types.length % 2 || wide
  return (
    <div className={`ag-card cr-comp ag-pop${className ? ` ${className}` : ''}`}>
      <div className="ag-card-head"><span className="ag-eyebrow">PLAYER COMP{who ? <> · <span className="un-keep">{who}</span></> : null}</span><span className="cr-comp-pct">{top.match}% MATCH</span></div>
      <div className="cr-comp-top">
        <span className="crl-face">{photoSrc(top, c.sport === 'bucket') ? <img src={photoSrc(top, c.sport === 'bucket')} alt="" loading="lazy" /> : <span className="crl-init">{initials(top.name)}</span>}</span>
        <span className="cr-comp-name"><b>{top.name}</b><small>{era(top)}</small></span>
      </div>
      <div className={`cr-comp-grid${oneCol ? ' is-list' : ''}${wide ? ' is-wide' : ''}`}>
        {(oneCol ? [0] : [0, 1]).map(i => <span key={`h${i}`} className="cr-comp-row cr-comp-row--head"><small /><em className={`is-you un-keep${mine.length > 6 ? ' is-long' : ''}`}>{mine}</em><em className={his.length > 6 ? 'is-long' : ''}>{his}</em></span>)}
        {c.types.map(t => {
          const v = c.build[t]?.val ?? 0, p = top.attrs[t]
          return (
            <span key={t} className="cr-comp-row">
              <small>{attr[t]?.label ?? t}</small>
              <b style={{ background: gradeColor(v) }}>{valToGrade(v)}</b>
              <b style={{ background: p == null ? 'rgba(255,255,255,.1)' : gradeColor(p) }}>{p == null ? '—' : valToGrade(p)}</b>
            </span>
          )
        })}
      </div>
      {comps.length > 1 && <div className="cr-comp-more"><span className="ag-eyebrow">ALSO PLAYS LIKE</span>{comps.slice(1).map(x => <span key={x.name} className="cr-comp-chip"><b>{x.name}</b><small>{x.era === 'current' ? x.team : 'ALL-TIME'} · {x.match}%</small></span>)}</div>}
    </div>
  )
}
