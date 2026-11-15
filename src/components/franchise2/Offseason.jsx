import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TEAM, FINISH_TEXT, ageLeague, openResign, resignOne, resignAsk, optionAsk, optionDue, canSign, tagAsk, canTag, openFA, faBoard, bidView, pitchOf, placeBid,
  OFFERS, offerOf, nextFADay, FA_DAYS, openDraft, marketDeals, POS_LABEL, coachGrade,
} from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, BigRec, BigNum, Stamp, Meter, Go, Flip, KLogo, fkVars, reduced } from './kit'
import { Man, CapBar, PlayerPage, money, posText } from './dparts'
import { DraftDay } from './Draft'
import { Carousel } from './Staff'
import './fd.css'

// THE OFFSEASON: five stops, one screen each. COACHES (the carousel, the NFL's Black Monday: Staff.jsx) → AWARDS →
// RE-SIGN → FREE AGENCY → THE DRAFT, then a new season.
const STOPS = [['coaches', 'COACHES'], ['awards', 'AWARDS'], ['resign', 'RE-SIGN'], ['fa', 'FREE AGENCY'], ['draft', 'DRAFT']]

export default function Offseason({ F, act, owner, onBuild }) {
  const i = STOPS.findIndex(([k]) => k === F.stage)
  return (
    <div className="fd fk">
      <div className="fd-stops" aria-label="Offseason">
        {STOPS.map(([k, n], j) => <span key={k} className={`fd-stop${j === i ? ' is-on' : j < i ? ' is-done' : ''}`}><i>{j + 1}</i><span>{n}</span></span>)}
      </div>
      {F.stage === 'coaches' && <Carousel F={F} act={act} owner={owner} />}
      {F.stage === 'awards' && <Awards F={F} act={act} owner={owner} />}
      {F.stage === 'resign' && <Resign F={F} act={act} owner={owner} />}
      {F.stage === 'fa' && <FreeAgency F={F} act={act} owner={owner} />}
      {F.stage === 'draft' && <DraftDay F={F} act={act} owner={owner} onBuild={onBuild} />}
    </div>
  )
}

// ── 1. AWARDS ────────────────────────────────────────────────────────────────
// the season in one card, then the league's awards turned over one at a time, then the All-Pros
const AW = [['mvp', 'MOST VALUABLE PLAYER'], ['opoy', 'OFFENSIVE PLAYER OF THE YEAR'], ['dpoy', 'DEFENSIVE PLAYER OF THE YEAR'], ['oroy', 'OFFENSIVE ROOKIE OF THE YEAR'], ['droy', 'DEFENSIVE ROOKIE OF THE YEAR']]
const SPOT_LABEL = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', ot: 'OT', og: 'OG', c: 'C', edge: 'EDGE', dt: 'DT', lb: 'LB', cb: 'CB', s: 'S' }
function findMan(F, w) { const p = w && F.teams[w.t]?.r.find(x => x.i === w.i); return p ?? (w ? { i: w.i, n: w.n, p: w.p, o: 0, b: w.b } : null) }
function Awards({ F, act, owner }) {
  const h = F.hist[F.hist.length - 1], aw = F.aw
  const list = AW.filter(([k]) => aw?.[k])
  const [n, setN] = useState(() => (reduced() ? list.length : 0))
  const [page, setPage] = useState(null)
  const [all, setAll] = useState(false)
  useEffect(() => { if (n >= list.length) return; const t = setTimeout(() => setN(x => x + 1), n === 0 ? 500 : 650); return () => clearTimeout(t) }, [n, list.length])
  const champ = h.fin === 'champ'
  const ours = (aw?.ap ?? []).filter(x => x.t === F.team)
  const pb = Object.entries(aw?.hon ?? {}).filter(([id, v]) => v === 'PB' && F.teams[F.team].r.some(p => String(p.i) === id)).length
  return (
    <>
      <section className="fd-recap" style={fkVars(F.team)}>
        <Chyron team={F.team} tone={champ ? 'gold' : 'team'} title={champ ? 'SUPER BOWL CHAMPIONS' : `${h.y} SEASON`} tag={h.y} sub={FINISH_TEXT[h.fin] ?? ''} />
        <div className="fd-recap-row">
          <BigRec w={h.w} l={h.l} t={h.t} size={72} />
          <span className="fd-recap-facts">
            <BigNum v={h.pf} label="POINTS" size={30} /><BigNum v={h.pa} label="ALLOWED" size={30} />
            {ours.length > 0 && <BigNum v={ours.length} label="ALL-PROS" size={30} />}
            {pb > 0 && <BigNum v={pb} label="PRO BOWLS" size={30} />}
          </span>
        </div>
      </section>
      <div className="fd-awards" onClick={() => setN(list.length)}>
        {list.map(([k, title], j) => {
          const w = aw[k], p = findMan(F, w)
          return (
            <Flip key={k} open={j < n} className="fd-award"
              back={<div className="fd-award-back"><small>{F.year}</small><b>{title}</b></div>}
              front={<div className="fd-award-face"><small>{title}</small><Man F={F} p={p} s={w.t} owner={owner} size={k === 'mvp' ? 'l' : 'm'} line={TEAM[w.t].nick.toUpperCase()} onClick={p?.o ? () => setPage(p.i) : undefined} /><span className="fd-award-line" style={fkVars(w.t)}>{w.line}</span>{w.t === F.team && j < n && <Stamp kind="gold" delay={200}>{k.toUpperCase()}</Stamp>}</div>} />
          )
        })}
      </div>
      {aw?.coy && n >= list.length && (
        <div className="fd-coy" style={fkVars(aw.coy.t)}>
          <KLogo s={aw.coy.t} size={40} />
          <span><small>COACH OF THE YEAR</small><b>{aw.coy.n}</b><em>{aw.coy.was} WINS TO {aw.coy.w}</em></span>
        </div>
      )}
      {n >= list.length && (
        <>
          <Chyron tone="ink" size="s" title="ALL-PRO FIRST TEAM" right={<button className="fd-link" onClick={() => { setAll(x => !x); sfx('tap') }}>{all ? TEAM[F.team].nick.toUpperCase() : `ALL ${aw.ap.length}`}</button>} />
          {(all ? aw.ap : ours).map((x, j) => (
            <div key={`${x.spot}-${x.i}`} className={`fd-ap${x.t === F.team ? ' is-me' : ''}`} style={{ ...fkVars(x.t), '--d': `${j * 25}ms` }}>
              <i>{SPOT_LABEL[x.spot]}</i><KLogo s={x.t} size={22} /><b>{x.n}</b><small>{x.line}</small>
            </div>
          ))}
          {!all && !ours.length && <div className="fd-none">NONE FROM THE {TEAM[F.team].nick.toUpperCase()}</div>}
        </>
      )}
      <Go onClick={() => { act(X => { ageLeague(X); openResign(X) }); sfx('whistle') }}>RE-SIGNING</Go>
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
}

// ── 2. RE-SIGN: one man at a time ────────────────────────────────────────────
function Resign({ F, act, owner }) {
  const [page, setPage] = useState(null)
  const total = useRef(F.rs?.length ?? 0)
  const id = F.rs?.[0]
  const p = id != null ? F.teams[F.team].r.find(x => x.i === id) : null
  const left = F.rs?.length ?? 0
  const opt = p && optionDue(p)
  const ask = p && !opt ? resignAsk(p, F) : null
  const oPrice = opt ? optionAsk(p, F) : null
  const fits = p ? canSign(F, opt ? oPrice - p.$ : ask.$) : true
  const keep = how => { act(X => resignOne(X, p.i, how)); sfx(how === false || how === 'decline' ? 'swap' : 'claim'); haptic(how === false ? 'light' : 'success') }
  return (
    <>
      <CapBar F={F} />
      {p ? (
        <section key={p.i} className="fd-deal">
          <Chyron tone="ink" title={opt ? 'FIFTH-YEAR OPTION' : 'DEAL UP'} right={`${total.current - left + 1} OF ${total.current}`} />
          <Man F={F} p={p} s={F.team} owner={owner} size="l" line={`AGE ${p.ag} · ${posText(p)}`} onClick={() => setPage(p.i)} />
          <div className="fd-ask">
            {opt
              ? <><BigNum v={money(oPrice)} count={false} label={`${F.year + 2} SEASON`} size={56} /><small className="fd-ask-note">THEN A NEW DEAL OR FREE AGENCY</small></>
              : <><BigNum v={money(ask.$)} count={false} label="A YEAR" size={56} /><BigNum v={ask.y} label={ask.y === 1 ? 'YEAR' : 'YEARS'} size={56} /><BigNum v={money(ask.$ * ask.y)} count={false} label="TOTAL" size={30} /></>}
          </div>
          <div className="fd-two">
            {opt ? (
              <>
                <Go disabled={!fits} onClick={() => keep('option')}>{fits ? 'PICK IT UP' : 'NO CAP ROOM'}</Go>
                <Go ghost onClick={() => keep('decline')}>DECLINE</Go>
              </>
            ) : (
              <>
                {/* (the player's own builds can always be kept: the team is then over the cap and can't sign anyone until it's under) */}
                <Go disabled={!fits && p.b == null} onClick={() => keep(true)} sub={!fits && p.b != null ? 'OVER THE CAP' : null}>{!fits && p.b == null ? 'NO CAP ROOM' : 'RE-SIGN'}</Go>
                <Go ghost onClick={() => keep(false)}>LET HIM GO</Go>
              </>
            )}
          </div>
          {!opt && canTag(F) && p.o >= 84 && (() => { const tg = tagAsk(p, F), ok = canSign(F, tg); return <Go ghost disabled={!ok} onClick={() => keep('tag')} sub={`1 YEAR · ${money(tg)}`}>FRANCHISE TAG</Go> })()}
        </section>
      ) : (
        <>
          <CampReport F={F} owner={owner} onMan={setPage} />
          <Go onClick={() => { act(X => openFA(X)); sfx('whistle') }}>FREE AGENCY</Go>
        </>
      )}
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
}
// the camp report: who got better, who slipped, who retired
function CampReport({ F, owner, onMan }) {
  const ch = (F.aging ?? []).filter(c => c.b != null || c.k === 'ret' || Math.abs((c.to ?? 0) - (c.from ?? 0)) >= 3)
  if (!ch.length) return null
  const t = F.teams[F.team]
  return (
    <>
      <Chyron team={F.team} size="s" title="CAMP REPORT" right={F.year + 1} />
      {ch.slice(0, 12).map(c => {
        const p = t.r.find(x => x.i === c.pid)
        return (
          <div key={c.pid} className="fd-camp">
            {p ? <Man F={F} p={p} s={F.team} owner={owner} size="s" onClick={() => onMan(p.i)} line={c.k === 'ret' ? 'RETIRED' : null} /> : <div className="fd-line"><b>{c.n}</b><span>RETIRED</span></div>}
            {c.k !== 'ret' && <span className={`fd-delta ${c.k === 'up' ? 'is-up' : 'is-down'}`}>{c.to > c.from ? '+' : ''}{c.to - c.from}</span>}
          </div>
        )
      })}
    </>
  )
}

// ── 3. FREE AGENCY: three days of bidding ────────────────────────────────────
function FreeAgency({ F, act, owner }) {
  const [bid, setBid] = useState(null)
  const [page, setPage] = useState(null)
  const [day, setDay] = useState(null)   // the day that just ended: the league's signings
  const done = !F.fad
  if (bid != null) return <Bid F={F} act={act} owner={owner} id={bid} onBack={() => { setBid(null); sfx('back') }} />
  const board = done ? [] : faBoard(F, 8)
  const deals = marketDeals(F)
  return (
    <>
      <Chyron team={F.team} title="FREE AGENCY" tag={done ? 'CLOSED' : `DAY ${F.fad}`} sub={done ? 'THE MARKET IS CLOSED' : `${F.fa.length} ON THE MARKET · DAY ${F.fad} OF ${FA_DAYS}`} />
      <CapBar F={F} />
      {day && (
        <section className="fd-day">
          <Chyron tone="ink" size="s" title={`DAY ${day.n} SIGNINGS`} right={day.list.length} />
          {day.list.slice(0, 6).map(d => <WireDeal key={d.i} d={d} F={F} />)}
        </section>
      )}
      {!done && (
        <>
          <Chyron tone="ink" size="s" title="BEST AVAILABLE" />
          {board.map((p, j) => (
            <Man key={p.i} F={F} p={p} s={F.team} owner={owner} size="m" delay={j * 40} stat={{ v: money(p.$), label: `${p.y} ${p.y === 1 ? 'YR' : 'YRS'}` }} line={canSign(F, p.$ * OFFERS[0][1]) ? `AGE ${p.ag}` : `AGE ${p.ag} · NO ROOM`} onClick={() => { setBid(p.i); setDay(null); sfx('tap') }} />
          ))}
          <Go onClick={() => { const before = deals.length; const r = act(X => nextFADay(X)); const list = marketDeals(F).slice(before).filter(d => d.s !== F.team).sort((a, b) => b.$ - a.$); setDay({ n: F.fad ? F.fad - 1 : FA_DAYS, list }); sfx(r?.done ? 'whistle' : 'flip') }} sub={F.fad === FA_DAYS ? 'THE MARKET CLOSES' : null}>END DAY {F.fad}</Go>
        </>
      )}
      {done && <Go onClick={() => { act(X => openDraft(X)); sfx('whistle') }}>THE DRAFT</Go>}
      {deals.some(d => d.s === F.team) && (
        <>
          <Chyron team={F.team} size="s" title="SIGNED" />
          {deals.filter(d => d.s === F.team).map(d => { const p = F.teams[F.team].r.find(x => x.i === d.i); return p ? <Man key={d.i} F={F} p={p} s={F.team} owner={owner} size="s" stat={{ v: money(d.$), label: `${d.y} YRS` }} onClick={() => setPage(p.i)} /> : null })}
        </>
      )}
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </>
  )
}
const WireDeal = ({ d }) => (
  <div className="fd-wire-deal" style={fkVars(d.s)}>
    <KLogo s={d.s} size={24} />
    <span><b>{d.n}</b><small>{TEAM[d.s].nick.toUpperCase()} · {POS_LABEL[d.p]} · {d.y} {d.y === 1 ? 'YR' : 'YRS'}, {money(d.$ * d.y)}</small></span>
  </div>
)

// The bid: his ask, who else is in, what he's weighing (the money, a winner, a starting job, the coach), three
// offers; then the teams' offers turn over and he picks
const WANTS = [['money', 'MONEY'], ['winning', 'WINNING'], ['role', 'PLAYING TIME'], ['coach', 'HEAD COACH']]
function Bid({ F, act, owner, id, onBack }) {
  const V = useMemo(() => bidView(F, id), [F, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [tier, setTier] = useState('ASK')
  const [res, setRes] = useState(null)
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!res) return
    if (shown > res.board.length) return
    const t = setTimeout(() => { setShown(x => x + 1); if (shown < res.board.length) sfx('flip') }, reduced() ? 0 : shown === 0 ? 250 : 420)
    return () => clearTimeout(t)
  }, [res, shown])
  if (!V && !res) return <><Go ghost onClick={onBack}>BACK TO THE MARKET</Go></>
  const p = res?.p ?? V.p
  const offer = offerOf(p, tier)
  const pitch = !res ? pitchOf(F, F.team, p, offer) : null
  const go = () => {
    const r = act(X => placeBid(X, id, offer))
    if (!r) { sfx('deny'); return }
    setRes(r); setShown(0); haptic('medium')
  }
  const won = res && res.to === F.team
  const all = res ? [...res.board].sort((a, b) => b.v - a.v) : []
  return (
    <>
      <button className="fd-back" onClick={onBack}>‹ THE MARKET</button>
      <Man F={F} p={p} s={res ? res.to : F.team} owner={owner} size="m" line={`AGE ${p.ag} · ASKS ${money(V?.ask ?? p.$)}`} />
      {!res ? (
        <>
          <div className="fd-in">
            <small>{V.rivals.length ? 'ALSO IN ON HIM' : 'NO OTHER OFFERS'}</small>
            <span>{V.rivals.map(r => <span key={r.s} className="fd-in-team" style={fkVars(r.s)}><KLogo s={r.s} size={30} /><b>?</b></span>)}</span>
          </div>
          <Chyron tone="ink" size="s" title="WHAT HE WANTS" right={TEAM[F.team].nick.toUpperCase()} />
          <div className="fd-wants">
            {WANTS.map(([k, label]) => <Meter key={k} label={label} v={Math.round(pitch[k] * 100)} team={F.team} show={k === 'role' ? (pitch.starts ? 'STARTER' : 'BACKUP') : k === 'money' ? money(offer) : k === 'coach' ? coachGrade(F.coach?.r) ?? '-' : undefined} />)}
          </div>
          <div className="fd-offers" role="radiogroup" aria-label="Offer">
            {OFFERS.map(([k]) => {
              const v = offerOf(p, k), ok = canSign(F, v)
              return <button key={k} role="radio" aria-checked={tier === k} className={tier === k ? 'is-on' : ''} disabled={!ok} onClick={() => { setTier(k); sfx('tap') }}><small>{k === 'ASK' ? 'HIS ASK' : k}</small><b>{money(v)}</b></button>
            })}
          </div>
          <Go onClick={go} disabled={!canSign(F, offer)} sub={`${p.y} ${p.y === 1 ? 'YEAR' : 'YEARS'} · ${money(offer * p.y)}`}>{canSign(F, offer) ? 'MAKE THE OFFER' : 'NO CAP ROOM'}</Go>
        </>
      ) : (
        <>
          <Chyron tone="ink" size="s" title="THE OFFERS" right={all.length} />
          <div className="fd-reveal">
            {all.map((b, j) => (
              <div key={b.s} className={`fd-offer${j < shown ? ' is-open' : ''}${shown > all.length - 1 && b.s === res.to ? ' is-win' : ''}`} style={fkVars(b.s)}>
                <KLogo s={b.s} size={34} />
                <b>{TEAM[b.s].nick.toUpperCase()}</b>
                <span className="fd-offer-v">{j < shown ? money(b.offer) : '—'}</span>
                <small>{j < shown ? (b.starts ? 'STARTS' : 'BACKUP') : ''}</small>
              </div>
            ))}
          </div>
          {shown > all.length && (
            <div className="fd-verdict">
              <Stamp kind={won ? 'w' : 'l'} big>{won ? 'SIGNED' : 'GONE'}</Stamp>
              <b>{won ? `${p.n} signs with the ${TEAM[F.team].nick}` : `${p.n} signs with the ${TEAM[res.to].nick}`}</b>
              <small>{res.years} {res.years === 1 ? 'YEAR' : 'YEARS'}, {money(res.offer * res.years)}</small>
            </div>
          )}
          {shown > all.length && <Go onClick={onBack}>BACK TO THE MARKET</Go>}
        </>
      )}
    </>
  )
}

