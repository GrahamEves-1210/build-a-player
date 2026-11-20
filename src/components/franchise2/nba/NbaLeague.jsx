import { useState } from 'react'
import { TEAM, CONF_NAME, records, recText, confOrder, gamesBack, streakText, manOf, teamOfMan, photoOf, CAP_SIM, seasonText, DIVS, CONF_DIVS, divOrder } from '../../../lib/franchise2/nba'
import { sfx } from '../../../lib/juice'
import { fkVars, KLogo, Chyron, LowerThird } from '../kit'

// THE LEAGUE: the standings (each conference, the six in and the play-in four marked), the league leaders and the wire
const VIEWS = [['stand', 'Standings'], ['lead', 'Leaders'], ['wire', 'Wire']]
const STATS = [['pts', 'POINTS'], ['reb', 'REBOUNDS'], ['ast', 'ASSISTS'], ['stl', 'STEALS'], ['blk', 'BLOCKS']]
export default function NbaLeague({ F }) {
  const [v, setV] = useState('stand')
  const [by, setBy] = useState('conf')
  return (
    <div className="nb-league">
      <div className="fh-seg nb-seg" role="tablist" style={{ '--n': VIEWS.length }}>
        {VIEWS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={v === k} className={v === k ? 'is-on' : ''} onClick={() => { setV(k); sfx('tap') }}>{l}</button>)}
      </div>
      {v === 'stand' && (
        <>
          <div className="nb-by"><button type="button" className={by === 'conf' ? 'is-on' : ''} onClick={() => setBy('conf')}>Conference</button><button type="button" className={by === 'div' ? 'is-on' : ''} onClick={() => setBy('div')}>Division</button></div>
          {by === 'conf' ? ['E', 'W'].map(c => <Conf key={c} F={F} c={c} />) : Object.values(CONF_DIVS).flat().map(d => <Div key={d} F={F} d={d} />)}
        </>
      )}
      {v === 'lead' && <Leaders F={F} />}
      {v === 'wire' && <Wire F={F} />}
    </div>
  )
}
function Conf({ F, c }) {
  const R = records(F)
  const L = confOrder(F, c, R)
  return (
    <section className="nb-stand">
      <Chyron tone="ink" size="s" title={`${CONF_NAME[c]} Conference`} />
      <div className="nb-st-head"><span /><span>W-L</span><span>GB</span><span>L10</span><span>STRK</span></div>
      {L.map((s, k) => (
        <div key={s} className={`nb-st-row${s === F.team ? ' is-me' : ''}${k === 5 || k === 9 ? ' is-cut' : ''}`} style={fkVars(s)}>
          <span className="nb-st-t"><i>{k + 1}</i><KLogo s={s} size={22} /><b>{TEAM[s].nick}</b></span>
          <span>{recText(R[s])}</span><span>{k ? (gamesBack(R, L[0], s) ? gamesBack(R, L[0], s).toFixed(1).replace('.0', '') : '-') : '-'}</span>
          <span>{R[s].l10.reduce((a, b) => a + b, 0)}-{R[s].l10.length - R[s].l10.reduce((a, b) => a + b, 0)}</span><span>{streakText(R[s])}</span>
        </div>
      ))}
    </section>
  )
}
function Div({ F, d }) {
  const R = records(F)
  const L = divOrder(F, d, R)
  return (
    <section className="nb-stand">
      <Chyron tone="ink" size="s" title={d} />
      {L.map((s, k) => (
        <div key={s} className={`nb-st-row${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}>
          <span className="nb-st-t"><i>{k + 1}</i><KLogo s={s} size={22} /><b>{TEAM[s].nick}</b></span>
          <span>{recText(R[s])}</span><span>{k ? (gamesBack(R, L[0], s) ? gamesBack(R, L[0], s).toFixed(1).replace('.0', '') : '-') : '-'}</span><span /><span>{streakText(R[s])}</span>
        </div>
      ))}
    </section>
  )
}
function Leaders({ F }) {
  const [st, setSt] = useState('pts')
  const L = CAP_SIM.leaders(F, st, 10) ?? []
  return (
    <section className="nb-lead">
      <div className="nb-by">{STATS.map(([k, l]) => <button key={k} type="button" className={st === k ? 'is-on' : ''} onClick={() => { setSt(k); sfx('tap') }}>{l}</button>)}</div>
      {!L.length && <p className="fh-next-note">No games played yet.</p>}
      {L.map((x, k) => {
        const p = manOf(F, x.i), s = teamOfMan(F, x.i) ?? x.s
        return p ? <LowerThird key={x.i} name={p.n} pos={p.p} num={p.num} photo={p.h ? photoOf(p.n) : null} team={s} size="s" stat={{ v: Number(x.v).toFixed(1), label: STATS.find(z => z[0] === st)[1].slice(0, 3) }} line={`${k + 1}. ${TEAM[s]?.nick?.toUpperCase() ?? ''}`} delay={k * 30} /> : null
      })}
    </section>
  )
}
function Wire({ F }) {
  const N = F.news ?? []
  return (
    <section className="nb-wire">
      {N.map((n, k) => (
        <div key={k} className="nb-wire-row" style={n.s ? fkVars(n.s) : undefined}>
          <span className="nb-wire-tag">{n.tag}</span>{n.s && <KLogo s={n.s} size={20} />}<p>{n.text}</p><small>{seasonText(n.y)}</small>
        </div>
      ))}
    </section>
  )
}
