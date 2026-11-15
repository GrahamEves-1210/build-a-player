import { useState } from 'react'
import { TEAM, POS_LABEL } from '../../lib/franchise2'
import { ovrOf, faceOf, nameOf } from '../../lib/squadSeason'
import { sfx } from '../../lib/juice'
import { IconRing } from '../app/icons'
import { Face, Count, teamVars } from './bits'

// HISTORY: the dynasty wall. A banner for every season (the record and how it ended), the rings, the numbers
// hung up for the player's builds, the franchise's records, and each build's career.
const FIN = { champ: 'CHAMPS', sb: 'SUPER BOWL', conf: 'CONF. FINAL', div: 'DIVISIONAL', wc: 'WILD CARD', out: '' }
const STAT = { py: 'PASS YDS', ptd: 'PASS TD', ry: 'RUSH YDS', rtd: 'RUSH TD', rc: 'REC', ryd: 'REC YDS', rctd: 'REC TD', sck: 'SACKS', tk: 'TACKLES', dint: 'INT', tfl: 'TFL', pbu: 'PD', sn: 'SNAPS', pnk: 'PANCAKES', sa: 'SACKS ALLOWED' }
const MAIN = { qb: ['py', 'ptd'], rb: ['ry', 'rtd'], wr: ['ryd', 'rctd'], te: ['ryd', 'rctd'], ol: ['sn', 'pnk'], dl: ['sck', 'tk'], lb: ['tk', 'sck'], db: ['dint', 'tk'] }

export default function HistoryTab({ F, owner, onSlots, onDelete }) {
  const [sure, setSure] = useState(false)
  const H = F.hist ?? []
  const w = H.reduce((a, h) => a + h.w, 0), l = H.reduce((a, h) => a + h.l, 0)
  const best = (k, dir = 1) => H.length ? [...H].sort((a, b) => dir * (b[k] - a[k]))[0] : null
  const recs = H.length ? [['MOST WINS', best('w'), x => x.w], ['MOST POINTS', best('pf'), x => x.pf], ['FEWEST ALLOWED', best('pa', -1), x => x.pa], ['BEST TEAM OVR', best('ovr'), x => x.ovr]] : []
  return (
    <>
      <section className="f2-wallhead ag-pop">
        <span className="f2-wallhead-n"><b><Count v={F.rings ?? 0} /></b><small><IconRing size={13} /> RINGS</small></span>
        <span className="f2-wallhead-n"><b><Count v={H.length} /></b><small>SEASONS</small></span>
        <span className="f2-wallhead-n"><b>{w}–{l}</b><small>ALL-TIME</small></span>
      </section>
      <section className="f2-rafters ag-pop" style={{ '--d': '50ms', ...teamVars(F.team) }}>
        <span className="ag-eyebrow">THE RAFTERS</span>
        {H.length ? (
          <div className="f2-banners">
            {H.map(h => (
              <span key={h.y} className={`f2-banner is-${h.fin}`}>
                <small>{h.y}</small>
                <b>{h.w}-{h.l}{h.t ? `-${h.t}` : ''}</b>
                <i>{h.fin === 'champ' ? 'CHAMPS' : FIN[h.fin] || (h.div ? 'DIVISION' : '—')}</i>
              </span>
            ))}
          </div>
        ) : <p className="f2-hint">THE FIRST BANNER GOES UP AFTER THIS SEASON</p>}
      </section>
      {F.retired?.length > 0 && (
        <section className="f2-unit ag-pop" style={{ '--d': '80ms', ...teamVars(F.team) }}>
          <span className="ag-eyebrow">RETIRED NUMBERS</span>
          <div className="f2-retired">{F.retired.map(r => <span key={`${r.b}-${r.num}`} className="f2-jersey"><b>{r.num}</b><small>{r.n.split(' ').slice(-1)[0].toUpperCase()}</small></span>)}</div>
        </section>
      )}
      {recs.length > 0 && (
        <section className="f2-unit ag-pop" style={{ '--d': '100ms' }}>
          <span className="ag-eyebrow">FRANCHISE RECORDS</span>
          {recs.map(([label, h, v]) => <div key={label} className="f2-record"><small>{label}</small><b>{v(h)}</b><i>{h.y}</i></div>)}
        </section>
      )}
      <section className="f2-unit ag-pop" style={{ '--d': '120ms' }}>
        <span className="ag-eyebrow">{owner.toUpperCase()}'S BUILDS</span>
        {F.builds.filter(B => !B.prospect || B.pid != null).map((B, i) => {
          const tot = {}
          for (const c of B.car) for (const [k, v] of Object.entries(c.st ?? {})) tot[k] = (tot[k] ?? 0) + v
          if (!B.done && B.pid != null && F.phase !== 'off') for (const [k, v] of Object.entries(F.ss?.[B.pid] ?? {})) if (k !== 'gp') tot[k] = (tot[k] ?? 0) + v
          const awards = B.car.filter(c => c.aw).map(c => c.aw)
          const counts = Object.entries(awards.reduce((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {}))
          const pros = B.car.filter(c => c.hon === 'AP').length
          return (
            <div key={i} className="f2-career">
              <Face src={faceOf(B.build)} name={POS_LABEL[B.pos]} size={44} mine />
              <span className="f2-career-txt">
                <b>{nameOf(B.pos, B.build)} <i>#{B.num}</i></b>
                <small>{POS_LABEL[B.pos]} · {B.car.length} {B.car.length === 1 ? 'SEASON' : 'SEASONS'}{B.done ? ' · RETIRED' : ''}{counts.map(([k, n]) => ` · ${n > 1 ? `${n}x ` : ''}${k}`).join('')}{pros ? ` · ${pros}x ALL-PRO` : ''}</small>
                <small className="f2-career-st">{(MAIN[B.pos] ?? []).map(k => `${(tot[k] ?? 0).toLocaleString()} ${STAT[k]}`).join(' · ')}</small>
              </span>
              <span className="f2-ovr f2-ovr--s"><b>{ovrOf(B.pos, B.build)}</b><small>NOW</small></span>
            </div>
          )
        })}
      </section>
      <div className="f2-manage">
        <button className="f2-ghost" onClick={() => { sfx('tap'); onSlots() }}>SAVE SLOTS</button>
        {sure ? <button className="f2-ghost is-danger" onClick={onDelete}>DELETE FOR GOOD</button> : <button className="f2-ghost" onClick={() => { setSure(true); sfx('deny') }}>DELETE FRANCHISE</button>}
      </div>
    </>
  )
}
export { TEAM }
