import { useEffect, useState } from 'react'
import { TEAM, FINISH_TEXT, POS_LABEL, ageLeague, openResign, resignOne, resignAsk, budgetLeft, openFA, signFA, nextFA, payroll } from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { IconArrow, IconTrophy } from '../app/icons'
import { Face, Ovr, Count, Logo, Stamp, teamVars, nameOn } from './bits'
import { DraftDay } from './Draft'

// THE OFFSEASON: four stops, one screen each. AWARDS → RE-SIGN → FREE AGENCY → THE DRAFT, then a new season.
const STOPS = [['awards', 'AWARDS'], ['resign', 'RE-SIGN'], ['fa', 'FREE AGENCY'], ['draft', 'DRAFT']]

export default function Offseason({ F, act, owner, onBuild }) {
  const i = STOPS.findIndex(([k]) => k === F.stage)
  return (
    <>
      <div className="f2-stops" aria-label="Offseason">
        {STOPS.map(([k, n], j) => <span key={k} className={`f2-stopn${j === i ? ' is-on' : j < i ? ' is-done' : ''}`}><i>{j + 1}</i>{n}</span>)}
      </div>
      {F.stage === 'awards' && <Awards F={F} act={act} owner={owner} />}
      {F.stage === 'resign' && <Resign F={F} act={act} owner={owner} />}
      {F.stage === 'fa' && <FreeAgency F={F} act={act} />}
      {F.stage === 'draft' && <DraftDay F={F} act={act} owner={owner} onBuild={onBuild} />}
    </>
  )
}

// ── 1. AWARDS ────────────────────────────────────────────────────────────────
function Awards({ F, act, owner }) {
  const h = F.hist[F.hist.length - 1]
  const aw = F.aw
  const find = w => w && F.teams[w.t]?.r.find(p => p.i === w.i)
  const mvp = find(aw.mvp)
  return (
    <>
      <section className={`f2-recap ag-pop is-${h.fin}`} style={teamVars(F.team)}>
        <span className="ag-eyebrow">{h.y} SEASON</span>
        <b className="f2-big"><Count v={h.w} />–<Count v={h.l} />{h.t ? `–${h.t}` : ''}</b>
        <b className="f2-recap-fin">{h.fin === 'champ' && <IconTrophy size={18} />} {FINISH_TEXT[h.fin]}</b>
        {h.stars.map(s => <span key={s.aw} className="f2-tag is-gold">{s.aw} · {s.n.toUpperCase()}</span>)}
      </section>
      {aw.mvp && (
        <section className="f2-mvp ag-pop" style={{ '--d': '80ms', ...teamVars(aw.mvp.t) }}>
          <span className="ag-eyebrow">MOST VALUABLE PLAYER</span>
          <div className="f2-mvp-row">
            <Face F={F} p={mvp ?? { n: aw.mvp.n, p: aw.mvp.p, b: aw.mvp.b }} size={84} mine={aw.mvp.b != null && aw.mvp.t === F.team} />
            <span className="f2-mvp-txt"><b>{aw.mvp.n}</b><small><Logo s={aw.mvp.t} size={20} /> {TEAM[aw.mvp.t].nick.toUpperCase()}{aw.mvp.b != null && aw.mvp.t === F.team ? ` · ${owner.toUpperCase()}` : ''}</small></span>
          </div>
        </section>
      )}
      <section className="f2-unit ag-pop" style={{ '--d': '140ms' }}>
        {[['OFFENSIVE PLAYER', aw.opoy], ['DEFENSIVE PLAYER', aw.dpoy], ['ROOKIE OF THE YEAR', aw.roy]].filter(([, w]) => w).map(([label, w]) => (
          <div key={label} className={`f2-award${w.t === F.team ? ' is-me' : ''}`}>
            <Face F={F} p={find(w) ?? { n: w.n, p: w.p }} size={40} />
            <span className="f2-row-name"><small>{label}</small><b>{w.n}</b></span>
            <Logo s={w.t} size={28} />
          </div>
        ))}
      </section>
      <button className="ag-btn ag-btn--gold f2-go" onClick={() => { act(X => { ageLeague(X); openResign(X) }); sfx('whistle') }}>TO THE OFFSEASON <IconArrow size={16} /></button>
    </>
  )
}

// ── 2. RE-SIGN: one man at a time ────────────────────────────────────────────
function CampReport({ F, owner }) {
  const ch = (F.aging ?? []).filter(c => c.b != null || c.k === 'ret')
  if (!ch.length) return null
  return (
    <section className="f2-unit ag-pop">
      <span className="ag-eyebrow">CAMP REPORT</span>
      {ch.map(c => {
        const p = F.teams[F.team].r.find(x => x.i === c.pid)
        return (
          <div key={c.pid} className={`f2-row is-static${c.b != null ? ' is-mine' : ''}`}>
            <Face F={F} p={p ?? { n: c.n, p: c.p, b: c.b }} size={36} />
            <span className="f2-row-name"><b>{c.n}</b><small>{c.k === 'ret' ? 'RETIRED' : c.b != null ? owner.toUpperCase() : POS_LABEL[c.p]}</small></span>
            {c.k !== 'ret' && <span className={`f2-delta ${c.k === 'up' ? 'is-up' : 'is-down'}`}>{c.from} <IconArrow size={11} /> <b><Count v={c.to} /></b></span>}
          </div>
        )
      })}
    </section>
  )
}
function Budget({ F }) {
  const pay = payroll(F.teams[F.team].r), room = budgetLeft(F)
  return (
    <section className="f2-budget">
      <span className="f2-budget-top"><small>BUDGET</small><b>${Math.round(pay)}M <i>/ ${Math.round(F.budget)}M</i></b></span>
      <span className="f2-budget-bar"><i style={{ transform: `scaleX(${Math.min(1, pay / F.budget)})` }} className={room < 0 ? 'is-over' : ''} /></span>
      <small className={`f2-budget-room${room < 0 ? ' is-over' : ''}`}>{room < 0 ? `$${-room}M OVER` : `$${room}M ROOM`}</small>
    </section>
  )
}
function Resign({ F, act, owner }) {
  const id = F.rs?.[0]
  const p = id != null ? F.teams[F.team].r.find(x => x.i === id) : null
  const left = F.rs?.length ?? 0
  const ask = p ? resignAsk(p) : null
  const room = budgetLeft(F) + (p?.$ ?? 0)
  return (
    <>
      {p ? (
        <section key={p.i} className={`f2-deal ag-pop${p.b != null ? ' is-mine' : ''}`}>
          <span className="ag-eyebrow">DEAL'S UP · {left} LEFT</span>
          <Face F={F} p={p} size={72} />
          <b className="f2-deal-name">{p.n}{p.b != null && <i className="f2-star">★</i>}</b>
          <small className="f2-deal-sub">{POS_LABEL[p.p]} · AGE {p.ag}</small>
          <Ovr o={p.o} size="m" count />
          <span className="f2-deal-ask"><b>${ask.$}M</b><small>{ask.y} {ask.y === 1 ? 'YEAR' : 'YEARS'}</small></span>
          <div className="f2-two">
            <button className="ag-btn ag-btn--gold" disabled={ask.$ > room} onClick={() => { act(X => resignOne(X, p.i, true)); sfx('claim'); haptic('success') }}>{ask.$ > room ? 'OVER BUDGET' : 'KEEP'}</button>
            <button className="ag-btn ag-btn--ghost" onClick={() => { act(X => resignOne(X, p.i, false)); sfx('swap') }}>LET GO</button>
          </div>
          <small className={`f2-budget-room${room - ask.$ < 0 ? ' is-over' : ''}`}>${Math.round(budgetLeft(F) * 10) / 10}M ROOM</small>
        </section>
      ) : (
        <button className="ag-btn ag-btn--gold f2-go" onClick={() => { act(X => openFA(X)); sfx('whistle') }}>FREE AGENCY <IconArrow size={16} /></button>
      )}
      <CampReport F={F} owner={owner} />
    </>
  )
}

// ── 3. FREE AGENCY: three rounds of three ────────────────────────────────────
function FreeAgency({ F, act }) {
  const [signed, setSigned] = useState(null)
  const offers = (F.offers ?? []).map(id => F.fa.find(p => p.i === id)).filter(Boolean)
  useEffect(() => { setSigned(null) }, [F.far])
  const sign = p => {
    const ok = act(X => signFA(X, p.i))
    if (!ok) { sfx('deny'); return }
    setSigned(p.i); sfx('claim'); haptic('success')
    setTimeout(() => act(X => nextFA(X)), 900)
  }
  return (
    <>
      <Budget F={F} />
      <section className="f2-fa ag-pop" key={F.far}>
        <div className="f2-h"><span className="ag-eyebrow">ROUND {F.far + 1} OF 3</span><span className="f2-hype">HYPE <b>{F.hype}</b></span></div>
        {offers.map((p, i) => (
          <button key={p.i} className={`f2-fa-man ag-pop${signed === p.i ? ' is-signed' : signed ? ' is-dim' : ''}`} style={{ '--d': `${i * 70}ms` }} onClick={() => !signed && sign(p)} disabled={!!signed || p.$ > budgetLeft(F)}>
            <Face F={F} p={p} size={56} />
            <span className="f2-row-name"><b>{nameOn(p, true)}</b><small>{POS_LABEL[p.p]} · AGE {p.ag} · ${p.$}M</small></span>
            <Ovr o={p.o} size="m" />
            {signed === p.i && <Stamp kind="w">SIGNED</Stamp>}
          </button>
        ))}
        {!signed && <button className="f2-ghost" onClick={() => { act(X => nextFA(X)); sfx('tap') }}>PASS</button>}
      </section>
    </>
  )
}
export { TEAM }
