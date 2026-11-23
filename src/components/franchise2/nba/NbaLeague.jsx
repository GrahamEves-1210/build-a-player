import { useState } from 'react'
import { TEAM, CONF_NAME, records, recText, confOrder, gamesBack, streakText, manOf, teamOfMan, CAP_SIM, CONF_DIVS, divOrder, wireDate, wireKind, WIRE_FILTERS } from '../../../lib/franchise2/nba'
import { PlayerSheet, TeamPage, TeamsList } from './NbaRoster'
import { manPhoto } from './NbaBuilds'
import { sfx } from '../../../lib/juice'
import { fkVars, KLogo, Chyron, LowerThird } from '../kit'

// THE LEAGUE: the standings (each conference, the six in and the play-in four marked; or by division), the league
// leaders, the teams (any team's roster, any man's page) and the wire
const VIEWS = [['stand', 'Standings'], ['lead', 'Leaders'], ['teams', 'Teams'], ['wire', 'Wire']]
const STATS = [['pts', 'POINTS', 'PPG'], ['reb', 'REBOUNDS', 'RPG'], ['ast', 'ASSISTS', 'APG'], ['stl', 'STEALS', 'SPG'], ['blk', 'BLOCKS', 'BPG']]
export default function NbaLeague({ F, act, owner }) {
  const [v, setV] = useState('stand')
  const [by, setBy] = useState('conf')
  const [team, setTeam] = useState(null)
  const [man, setMan] = useState(null)
  const sheet = man != null && <PlayerSheet F={F} act={act} id={man} owner={owner} onClose={() => setMan(null)} />
  if (team) return <div className="nb-league"><TeamPage F={F} s={team} backLabel={VIEWS.find(x => x[0] === v)?.[1] ?? 'League'} onBack={() => { setTeam(null); sfx('back') }} onMan={setMan} />{sheet}</div>
  return (
    <div className="nb-league">
      <div className="fh-seg nb-seg" role="tablist" style={{ '--n': VIEWS.length }}>
        {VIEWS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={v === k} className={v === k ? 'is-on' : ''} onClick={() => { setV(k); sfx('tap') }}>{l}</button>)}
      </div>
      {v === 'stand' && (
        <>
          <div className="nb-by"><button type="button" className={by === 'conf' ? 'is-on' : ''} onClick={() => setBy('conf')}>Conference</button><button type="button" className={by === 'div' ? 'is-on' : ''} onClick={() => setBy('div')}>Division</button></div>
          {by === 'conf' ? ['E', 'W'].map(c => <Conf key={c} F={F} c={c} onTeam={setTeam} />) : Object.values(CONF_DIVS).flat().map(d => <Div key={d} F={F} d={d} onTeam={setTeam} />)}
        </>
      )}
      {v === 'lead' && <Leaders F={F} onMan={setMan} />}
      {v === 'teams' && <TeamsList F={F} onTeam={setTeam} />}
      {v === 'wire' && <Wire F={F} />}
      {sheet}
    </div>
  )
}
const gb = (R, lead, s) => { const x = gamesBack(R, lead, s); return x ? x.toFixed(1).replace('.0', '') : '-' }
const l10 = r => { const w = r.l10.reduce((a, b) => a + b, 0); return r.l10.length ? `${w}-${r.l10.length - w}` : '-' }
const Head = () => <div className="nb-st-head"><span /><span>W-L</span><span>GB</span><span>L10</span><span>STRK</span></div>
const long = n => (n.length > 11 ? ' is-xlong' : n.length > 8 ? ' is-long' : '')
function Row({ F, R, s, k, lead, cut, onTeam }) {
  return (
    <button type="button" className={`nb-st-row${s === F.team ? ' is-me' : ''}${cut ? ' is-cut' : ''}`} style={fkVars(s)} onClick={() => { onTeam(s); sfx('tap') }} aria-label={`${TEAM[s].name}: ${recText(R[s])}`}>
      <span className="nb-st-t"><i>{k + 1}</i><KLogo s={s} size={22} /><b className={long(TEAM[s].nick)}>{TEAM[s].nick}</b></span>
      <span>{recText(R[s])}</span><span>{k ? gb(R, lead, s) : '-'}</span><span>{l10(R[s])}</span><span>{streakText(R[s]) || '-'}</span>
    </button>
  )
}
function Conf({ F, c, onTeam }) {
  const R = records(F)
  const L = confOrder(F, c, R)
  return (
    <section className="nb-stand">
      <Chyron tone="ink" size="s" title={`${CONF_NAME[c]} Conference`} />
      <Head />
      {L.map((s, k) => <Row key={s} F={F} R={R} s={s} k={k} lead={L[0]} cut={k === 5 || k === 9} onTeam={onTeam} />)}
    </section>
  )
}
function Div({ F, d, onTeam }) {
  const R = records(F)
  const L = divOrder(F, d, R)
  return (
    <section className="nb-stand">
      <Chyron tone="ink" size="s" title={d} />
      <Head />
      {L.map((s, k) => <Row key={s} F={F} R={R} s={s} k={k} lead={L[0]} onTeam={onTeam} />)}
    </section>
  )
}
function Leaders({ F, onMan }) {
  const [st, setSt] = useState('pts')
  const L = CAP_SIM.leaders(F, st, 10) ?? []
  return (
    <section className="nb-lead">
      <div className="nb-by">{STATS.map(([k, l]) => <button key={k} type="button" className={st === k ? 'is-on' : ''} onClick={() => { setSt(k); sfx('tap') }}>{l}</button>)}</div>
      {!L.length && <p className="fh-next-note">No games played yet.</p>}
      {L.map((x, k) => {
        const p = manOf(F, x.i), s = teamOfMan(F, x.i) ?? x.s
        return p ? <LowerThird key={x.i} name={p.n} pos={p.p} num={p.num} photo={manPhoto(F, p)} team={s} size="s" stat={{ v: Number(x.v).toFixed(1), label: STATS.find(z => z[0] === st)[2] }} line={`${k + 1}. ${TEAM[s]?.nick?.toUpperCase() ?? ''}`} delay={k * 30} onClick={() => { onMan(x.i); sfx('tap') }} /> : null
      })}
    </section>
  )
}
// the wire: everything, or one kind of story (news.js WIRE_FILTERS); each item dated the day it happened
function Wire({ F }) {
  const [f, setF] = useState('all')
  const N = (F.news ?? []).filter(n => f === 'all' || wireKind(n) === f)
  return (
    <section className="nb-wire">
      <div className="nb-by nb-by--tight" role="tablist" aria-label="The wire">{WIRE_FILTERS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? 'is-on' : ''} onClick={() => { setF(k); sfx('tap') }}>{l}</button>)}</div>
      {!N.length && <p className="fh-next-note">Nothing on the wire yet.</p>}
      {N.map((n, k) => (
        <div key={k} className="nb-wire-row" style={n.s ? fkVars(n.s) : undefined}>
          <span className="nb-wire-tag">{n.tag}</span>{n.s ? <KLogo s={n.s} size={20} /> : <span />}<p>{n.text}</p><small>{wireDate(F, n)}</small>
        </div>
      ))}
    </section>
  )
}
