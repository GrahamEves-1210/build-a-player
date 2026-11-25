import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, SHORTS, depthOrder, photoOf, dateText, CAP_SIM, nick, picksOf, pickText, seasonText, teamOvr, ROSTER_MAX, addNews, CONF_OF } from '../../../lib/franchise2/nba'
import { manPhoto } from './NbaBuilds'
import { sfx, haptic } from '../../../lib/juice'
import { teamWords } from '../../../lib/franchise2/nba/news'
import { fkVars, KLogo, LowerThird, Chyron, Go, BackBar, Tag, Fold, ActionBar, Stamp, reduced } from '../kit'
import { money } from './NbaHub'
import { picksOf as tradePicks, tpesOf, availOf } from '../../../lib/franchise2/nba/trades'
import { hitOf } from '../../../lib/franchise2/nba/cap'
import '../trades.css'
import { Rotation, PlayerSheet } from './NbaRoster'
import NbaStaffScreen, { NbaStaffStrip } from './NbaStaff'

// THE TEAM: the rotation (the order the coach plays them in: the first five start), the cap, the two-way men,
// a man's page (his deal, his career, move him in the rotation, waive him) and trades.
const ppg = (F, p, all = false) => { const x = F.ss?.[p.i]; if (!x?.gp) return null; const f = k => (x[k] / x.gp).toFixed(1); return all ? `${f('pts')} PPG · ${f('reb')} RPG · ${f('ast')} APG` : `${f('pts')} PPG · ${p.g === 'big' ? `${f('reb')} RPG` : `${f('ast')} APG`}` }
export const dealText = p => (p.tw ? 'TWO-WAY' : p.y > 0 ? `${money(p.$)} · ${p.y} ${p.y === 1 ? 'YR' : 'YRS'}${p.opt ? ` · ${p.opt.k === 'P' ? 'PLAYER' : 'TEAM'} OPTION` : ''}` : 'DEAL UP')

export default function NbaTeam({ F, act, owner, view, setView }) {
  const [man, setMan] = useState(null)
  if (view === 'trades') return <Trades F={F} act={act} onBack={() => setView(null)} />
  if (view === 'staff') return <NbaStaffScreen F={F} act={act} owner={owner} onBack={() => setView(null)} />
  const t = F.teams[F.team]
  const tw = t.r.filter(p => p.tw)
  const canTrade = F.phase === 'off' || (F.phase === 'season' && F.day <= F.ddl)
  return (
    <div className="nb-team">
      <CapBar F={F} />
      {canTrade ? <button type="button" className="fh-row" onClick={() => { setView('trades'); sfx('tap') }}><span><small>Trades</small><b>{F.phase === 'season' ? `Deadline ${F.ddl - F.day <= 0 ? 'today' : `in ${F.ddl - F.day} days`}` : 'Open for the summer'}</b></span><i className="fh-row-go" aria-hidden="true">›</i></button>
        : <div className="fh-row nb-trade-shut"><span><small>Trades</small><b>{F.phase === 'season' || F.phase === 'post' ? `Trade deadline passed (${dateText(F, F.ddl)})` : 'Trades open after the Finals'}</b></span></div>}
      {/* (the coaching staff: NbaStaff.jsx) */}
      <NbaStaffStrip F={F} onOpen={() => { setView('staff'); sfx('tap') }} />
      {/* (the rotation, its edit and a man's page: NbaRoster.jsx) */}
      <Rotation F={F} act={act} owner={owner} onMan={setMan} />
      {tw.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="Two-way contracts" sub={`${tw.length} OF 3`} />
          <div className="nb-rot">{tw.map(p => <LowerThird key={p.i} name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" line={`AGE ${p.ag} · TWO-WAY`} onClick={() => setMan(p.i)} />)}</div>
        </>
      )}
      <Fold title="Draft picks" right={`${picksOf(F, F.team).filter(p => p.r === 1).length} firsts`}>
        <ul className="nb-picks">{picksOf(F, F.team).map(p => <li key={`${p.y}${p.r}${p.o}`}>{pickText(F, p)}</li>)}</ul>
      </Fold>
      {man != null && <PlayerSheet F={F} act={act} id={man} owner={owner} onClose={() => setMan(null)} />}
    </div>
  )
}

export function CapBar({ F, s = F.team }) {
  const c = CAP_SIM.capSheet(F, s)
  // (the payroll is salaries; the summer's cap holds count against cap room only, never the tax or the aprons)
  const holds = F.phase === 'off' && !(F.noCap && s === F.team) ? c.hold ?? 0 : 0
  const top = Math.max(c.a2 * 1.06, c.pay * 1.03)
  const at = v => `${Math.min(100, (v / top) * 100)}%`
  const OVER = { under: `${money(c.room)} in cap room`, cap: 'Over the cap', tax: `In the tax · ${money(c.bill)} luxury tax`, a1: `Over the first apron · ${money(c.bill)} luxury tax`, a2: `Over the second apron · ${money(c.bill)} luxury tax` }
  return (
    <section className={`nb-cap is-${c.over}`}>
      <div className="nb-cap-h"><b>{money(c.pay)}</b><span>{F.noCap && s === F.team ? 'No salary cap' : OVER[c.over]}</span></div>
      {holds > 0.05 && <small className="nb-cap-holds">Plus {money(holds)} in cap holds for unsigned free agents: they count against cap room only, not the tax or the aprons</small>}
      <div className="nb-cap-bar" aria-hidden="true">
        <i className="nb-cap-fill" style={{ width: at(c.pay) }} />
        {[['CAP', c.cap], ['TAX', c.tax], ['', c.a1], ['', c.a2]].map(([k, v], i) => <em key={i} style={{ left: at(v) }}>{k && <small>{k}</small>}</em>)}
      </div>
      <div className="nb-cap-k"><span>Cap {money(c.cap)}</span><span>Tax {money(c.tax)}</span><span>Aprons {money(c.a1)} / {money(c.a2)}</span></div>
    </section>
  )
}

// ── TRADES ───────────────────────────────────────────────────────────────────
// pick a team; the deal on top (what each side sends, its cap hits), the value bar, the other GM's answer, then one
// side's men and picks at a time; the league office checks it (salary matching, the aprons, the Stepien rule:
// trades.js), then the other GM answers (yes, no, or a counter to take or work from)
function Trades({ F, act, onBack }) {
  const [them, setThem] = useState(null)
  const [side, setSide] = useState(0)
  const [ga, setGa] = useState([]), [gb, setGb] = useState([]), [pa, setPa] = useState([]), [pb, setPb] = useState([])
  const [ans, setAns] = useState(null)
  // (the deal just done: each side's names, kept on the board after the selections clear)
  const [sent, setSent] = useState(null)
  // (the answer comes up where the GM is looking: on the deal board, which stays in view; a counter's terms and its
  // buttons sit under the board, brought into view when they come)
  const said = useRef(null)
  useEffect(() => { if (ans?.counter) said.current?.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }) }, [ans])
  const deal = them ? { a: F.team, b: them, ga, gb, pa, pb } : null
  const any = ga.length + gb.length + pa.length + pb.length > 0
  const chk = useMemo(() => (deal && any ? CAP_SIM.checkTrade(F, deal) : null), [F, them, ga, gb, pa, pb]) // eslint-disable-line react-hooks/exhaustive-deps
  const tog = (arr, set, v) => { set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]); setAns(null); setSent(null); sfx('tap') }
  const reset = () => { setGa([]); setGb([]); setPa([]); setPb([]); setAns(null); setSent(null) }
  if (!them) {
    return (
      <div className="nb-trades">
        <BackBar label="Team" title="Trades" onBack={onBack} />
        <Chyron tone="ink" size="s" title="Pick a trade partner" />
        <div className="nb-wall">
          {SHORTS.filter(s => s !== F.team).map(s => <button key={s} type="button" className="fsu-tm" style={fkVars(s)} onClick={() => { setThem(s); setSide(1); sfx('tap') }} aria-label={TEAM[s].name}><KLogo s={s} size={40} /><small>{s}</small></button>)}
        </div>
      </div>
    )
  }
  const year = CAP_SIM.capYear(F)
  // (everyone under contract, two-way men too: the standard deals by rating, then the two-ways)
  const men = s => F.teams[s].r.slice().sort((x, y) => (x.tw ? 1 : 0) - (y.tw ? 1 : 0) || y.o - x.o)
  const manIn = (s, i) => F.teams[s].r.find(p => p.i === i)
  // (the picks still to be made: a draft that's done is off the list)
  const pickList = s => tradePicks(F, s)
  const hit = p => (p ? hitOf(p, year, year) : 0)
  const sum = (s, ids) => ids.reduce((x, i) => x + hit(manIn(s, i)), 0)
  const S = [[F.team, ga, setGa, pa, setPa], [them, gb, setGb, pb, setPb]]
  const [s0, sel, set, psel, pset] = S[side]
  const list = (s, ids, pids) => [...ids.map(i => manIn(s, i)?.n), ...pids.map(i => pickText(F, F.picks[i]))].filter(Boolean)
  const done = (r, names) => { for (const x of r?.news ?? []) addNews(F, x); setSent(names); setGa([]); setGb([]); setPa([]); setPb([]); sfx('claim'); haptic('success') }
  const namesOf = d => [list(d.a, d.ga ?? [], d.pa ?? []), list(d.b, d.gb ?? [], d.pb ?? [])]
  const ask = () => {
    const names = namesOf(deal)
    const r = act(X => CAP_SIM.proposeTrade(X, deal))
    setAns(r)
    if (r?.ok) done(r, names); else sfx(r?.say === 'counter' ? 'flip' : 'deny')
  }
  const takeCounter = () => {
    const c = ans?.counter
    if (!c || !CAP_SIM.checkTrade(F, c).ok) return
    const names = namesOf(c)
    const r = act(X => CAP_SIM.doTrade(X, c))
    setAns({ ok: true, say: 'yes', text: `Deal done on the ${TEAM[them].nick}' terms`, line: r?.line })
    done(r, names)
  }
  const workFrom = () => { const c = ans?.counter; if (!c) return; setGa(c.ga ?? []); setGb(c.gb ?? []); setPa(c.pa ?? []); setPb(c.pb ?? []); setAns(null); sfx('tap') }
  const g = any && chk?.ok ? CAP_SIM.gauge(F, deal) : null
  const cs = CAP_SIM.capSheet(F, them)
  const sit = CAP_SIM.situationOf(F, them)
  const tpe = tpesOf(F, F.team)
  // (the GM's own line: his payroll, ownership's ceiling, and where this deal leaves him; a deal that adds salary
  // can't pass the ceiling: trades.js checkTrade)
  const own = CAP_SIM.ownerCap(F)
  const myPay = CAP_SIM.capSheet(F, F.team).pay
  const myAfter = myPay - sum(F.team, ga) + sum(them, gb)
  return (
    <div className="nb-trades">
      <BackBar label="Teams" title={`Trade with the ${TEAM[them].nick}`} onBack={() => { setThem(null); reset() }} />
      <div className="nb-twith" style={fkVars(them)}>
        <KLogo s={them} size={36} />
        <span><small>{CAP_SIM.SIT_TEXT[sit]} · {CAP_SIM.OVER_TEXT[cs.over]}</small><b>{TEAM[them].name}</b><em>Payroll {money(cs.pay)}{cs.room > 0 ? ` · ${money(cs.room)} in cap room` : cs.over === 'cap' ? ` · ${money(cs.toTax)} under the tax` : cs.over === 'tax' ? ` · ${money(cs.toA1)} under the first apron` : cs.over === 'a1' ? ` · ${money(cs.toA2)} under the second apron` : ''}</em></span>
      </div>
      {Number.isFinite(own.$) && (
        <p className={`nb-tnote nb-towner${(ga.length || gb.length) && myAfter > own.$ + 0.01 && myAfter > myPay + 0.01 ? ' is-over' : ''}`}>
          {`${TEAM[F.team].nick} payroll ${money(myPay)}${ga.length || gb.length ? `, ${money(myAfter)} after this deal` : ''}. Ownership's limit: ${money(own.$)}, ${CAP_SIM.OWNER_LINE_TEXT[own.k] ?? 'its line'}.`}
        </p>
      )}
      {/* (the deal stays in view while the lists scroll: each side, then what blocks it or the answer to it) */}
      <section className="nb-deal">
        {S.map(([s, ids, , pids], k) => (
          <div key={s} className="nb-deal-side" style={fkVars(s)}>
            <span className="nb-deal-h"><KLogo s={s} size={22} /><b>{TEAM[s].nick} {!any && sent ? 'sent' : 'send'}</b></span>
            <p>{(!any && sent ? sent[k] : list(s, ids, pids)).join(', ') || 'Nothing yet'}</p>
            {ids.length > 0 && <small className="nb-deal-cap">{money(sum(s, ids))} in cap hits</small>}
          </div>
        ))}
        {chk && !chk.ok && <p className="nb-why nb-deal-why">{teamWords(chk.why)}</p>}
        {ans && <TradeSaid ok={ans.ok} counter={!!ans.counter} text={teamWords(ans.text ?? `The ${TEAM[them].nick} pass`)} line={ans.ok ? teamWords(ans.line ?? '') : ''} />}
      </section>
      {g && <TradeGauge F={F} them={them} g={g} />}
      {ans?.counter && (
        <div ref={said} className="tr-counter nb-tcounter-box">
          <p className="nb-tcounter">{counterText(F, ans.counter)}</p>
          <div className="tr-acts tr-acts--2"><Go onClick={takeCounter}>Accept the counter</Go><Go ghost onClick={workFrom}>Work from it</Go></div>
        </div>
      )}
      {tpe.length > 0 && <p className="nb-tnote">{TEAM[F.team].nick} trade exception{tpe.length > 1 ? 's' : ''}: {tpe.map(x => `${money(x.$)} (${x.n})`).join(', ')}. One can take in a player's salary with nothing going back.</p>}
      <div className="nb-by" role="tablist">
        {S.map(([s], k) => <button key={s} type="button" role="tab" aria-selected={side === k} className={side === k ? 'is-on' : ''} onClick={() => { setSide(k); sfx('tap') }}>{TEAM[s].nick} send</button>)}
      </div>
      <section className="nb-tside">
        {men(s0).map(p => {
          const no = CAP_SIM.whyNot(F, s0, p)
          const av = p.inj?.g > 0 ? availOf(F, p, s0) : null
          return (
            <button key={p.i} type="button" disabled={!!no} className={`nb-tman${sel.includes(p.i) ? ' is-on' : ''}`} onClick={() => tog(sel, set, p.i)} aria-pressed={sel.includes(p.i)}>
              <b>{p.n}</b><span>{p.p} · {p.o} OVR · AGE {p.ag}</span>
              <em>{no ? teamWords(no) : `${dealText(p)}${!p.tw && p.y > 0 ? ` · CAP HIT ${money(hit(p))}` : ''}`}</em>
              {av && <em className="is-inj">{av.season ? 'OUT FOR THE SEASON' : CAP_SIM.outText(p)} · {String(p.inj.k).toUpperCase()}</em>}
            </button>
          )
        })}
        <Fold title="Draft picks" right={`${psel.length || ''}`}>{pickList(s0).map(k => <button key={k.i} type="button" className={`nb-tman${psel.includes(k.i) ? ' is-on' : ''}`} onClick={() => tog(psel, pset, k.i)} aria-pressed={psel.includes(k.i)}><b>{pickText(F, k)}</b>{k.sw && <em>{k.sw.with ? `May swap with the ${TEAM[k.sw.with]?.nick}` : `The ${TEAM[k.sw.by]?.nick} may swap for it`}</em>}</button>)}</Fold>
      </section>
      <ActionBar className="nb-tact">
        <Go disabled={!chk?.ok || !!ans?.counter} onClick={ask}>Propose the trade</Go>
      </ActionBar>
    </div>
  )
}

// the value bar: what each side sends, the way the league values it (the other GM's own read can differ: a
// contender pays for this season, a rebuilder for youth and picks)
function TradeGauge({ F, them, g }) {
  const a = Math.max(0, g.a), b = Math.max(0, g.b), tot = a + b
  const mine = tot > 0 ? (a / tot) * 100 : 50
  const even = Math.abs(g.lean) < 0.08
  const lean = even ? 'Even' : `${TEAM[g.lean > 0 ? F.team : them].nick} ${Math.abs(g.lean) >= 0.35 ? 'win big' : 'come out ahead'}`
  return (
    <div className={`tr-gauge${even ? ' is-even' : ''}`} aria-label={`By the league's values: ${lean}`}>
      <div className="tr-gauge-h"><span>{TEAM[F.team].nick}</span><b>{lean}</b><span>{TEAM[them].nick}</span></div>
      <div className="tr-gauge-bar" aria-hidden="true">
        {/* (the GM's side white, theirs in their colour: two teams in the same colour still read apart) */}
        <i style={{ width: `${mine}%`, background: '#f4f5f7' }} />
        <i style={{ ...fkVars(them), width: `${100 - mine}%` }} />
        <em />
      </div>
      <div className="tr-gauge-f"><small>VALUE SENT {Math.round(mine)}%</small><small>VALUE SENT {100 - Math.round(mine)}%</small></div>
    </div>
  )
}
// the other GM's answer (a counter isn't a refusal: it reads as one more offer)
function TradeSaid({ ok, counter, text, line }) {
  return (
    <div className={`tr-said${ok ? ' is-yes' : counter ? ' is-counter' : ' is-no'}`} role="status">
      <Stamp kind={ok ? 'w' : counter ? 'ink' : 'l'}>{ok ? 'DONE' : counter ? 'COUNTER' : 'NO DEAL'}</Stamp>
      <span><b>{text}</b>{line && <small>{line}</small>}</span>
    </div>
  )
}

// a counter, the way the other GM says it: what they'd send and what they want back
function counterText(F, c) {
  const nm = (s, ids) => ids.map(i => F.teams[s].r.find(p => p.i === i)?.n).filter(Boolean)
  const pk = list => (list ?? []).map(e => (typeof e === 'number' ? F.picks[e] : F.picks[e?.i])).filter(Boolean).map(p => pickText(F, p))
  const they = [...nm(c.b, c.gb), ...pk(c.pb)], you = [...nm(c.a, c.ga), ...pk(c.pa)]
  return `The ${TEAM[c.b].nick} send ${they.join(', ') || 'nothing'} for ${you.join(', ') || 'nothing'}`
}
