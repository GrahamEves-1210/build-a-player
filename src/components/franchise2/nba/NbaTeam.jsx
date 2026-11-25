import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, SHORTS, depthOrder, photoOf, dateText, CAP_SIM, nick, picksOf, pickText, seasonText, teamOvr, ROSTER_MAX, addNews, CONF_OF } from '../../../lib/franchise2/nba'
import { manPhoto } from './NbaBuilds'
import { sfx, haptic } from '../../../lib/juice'
import { teamWords } from '../../../lib/franchise2/nba/news'
import { fkVars, KLogo, LowerThird, Chyron, Go, BackBar, Tag, Fold, ActionBar, Stamp, reduced } from '../kit'
import { money } from './NbaHub'
import { picksOf as tradePicks, tpesOf, availOf, swapYears, canProtect, PROTECTIONS } from '../../../lib/franchise2/nba/trades'
import { hitOf } from '../../../lib/franchise2/nba/cap'
import '../trades.css'
import { Rotation, PlayerSheet } from './NbaRoster'
import NbaStaffScreen, { NbaStaffStrip } from './NbaStaff'

// THE TEAM: the rotation (the order the coach plays them in: the first five start), the cap, the two-way men,
// a man's page (his deal, his career, move him in the rotation, waive him) and trades.
const ppg = (F, p, all = false) => { const x = F.ss?.[p.i]; if (!x?.gp) return null; const f = k => (x[k] / x.gp).toFixed(1); return all ? `${f('pts')} PPG · ${f('reb')} RPG · ${f('ast')} APG` : `${f('pts')} PPG · ${p.g === 'big' ? `${f('reb')} RPG` : `${f('ast')} APG`}` }
export const dealText = p => (p.tw ? 'TWO-WAY' : p.y > 0 ? `${money(p.$)} · ${p.y}\u00a0${p.y === 1 ? 'YR' : 'YRS'}${p.opt ? ` · ${p.opt.k === 'P' ? 'PLAYER' : 'TEAM'} OPTION` : ''}` : 'DEAL UP')

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
        <ul className="nb-picks">{picksOf(F, F.team).map(p => <li key={`${p.y}${p.r}${p.o}`}>{pickText(F, p)}{p.sw ? ` · ${swapNote(p)}` : ''}</li>)}</ul>
      </Fold>
      {man != null && <PlayerSheet F={F} act={act} id={man} owner={owner} onClose={() => setMan(null)} />}
    </div>
  )
}

export function CapBar({ F, s = F.team }) {
  const c = CAP_SIM.capSheet(F, s)
  // (the payroll is salaries; the summer's cap holds count against cap room only, never the tax or the aprons)
  const holds = F.phase === 'off' && !(F.noCap && s === F.team) ? (c.holds ?? []).reduce((a, h) => a + h.$, 0) : 0
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
// pick a team; the deal on top (what each side sends, its cap hits, the value bar, what blocks it or the other GM's
// answer: all of it stays in view while the lists scroll), then one side's men and picks at a time; the league
// office checks it (salary matching, the aprons, the Stepien rule: trades.js), then the other GM answers (yes, no,
// or a counter to take or work from)
// A pick in the deal is an entry (trades.js): its index in F.picks (as it is), { i, top } (a protection put on a
// team's own first as it's traded) or { swap: year } (the right to swap firsts that year)
const pkI = e => (typeof e === 'number' ? e : e?.i ?? null)
const swapNote = k => (k.sw?.with ? `may swap with the ${TEAM[k.sw.with]?.nick}` : `the ${TEAM[k.sw?.by]?.nick} may swap for it`)
const entryText = (F, e) => {
  if (e?.swap != null) return `${e.swap} 1st swap rights`
  const k = F.picks?.[pkI(e)]
  return k ? pickText(F, e?.top ? { ...k, pr: { top: e.top } } : k) : null
}
// what a protected first that stays home turns into (draft.js runLottery: the next first, the protection halved)
const rollText = top => (Math.floor(top / 2) >= 1 ? `top-${Math.floor(top / 2)} protected` : 'unprotected')
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
  const list = (s, ids, pids) => [...ids.map(i => manIn(s, i)?.n), ...pids.map(e => entryText(F, e))].filter(Boolean)
  // (a first in the list: how it's in the deal now: null (not in it), 'plain', a protection's top N, or 'swap')
  const other = s0 === F.team ? them : F.team
  const swapOk = swapYears(F, s0, other)
  const ownFirst = k => k.r === 1 && k.o === s0
  const pickState = k => {
    const e = psel.find(x => x?.swap == null && pkI(x) === k.i)
    if (e != null) return e?.top ?? 'plain'
    return ownFirst(k) && psel.some(x => x?.swap === k.y) ? 'swap' : null
  }
  const setPick = (k, how) => {
    const rest = psel.filter(x => (x?.swap != null ? !(ownFirst(k) && x.swap === k.y) : pkI(x) !== k.i))
    pset(how == null ? rest : [...rest, how === 'plain' ? k.i : how === 'swap' ? { swap: k.y } : { i: k.i, top: how }])
    setAns(null); setSent(null); sfx('tap')
  }
  // (the league team's waivers to make room, as a sentence)
  const cutText = (cut, did) => { const by = {}; for (const x of cut ?? []) (by[x.s] ??= []).push(x.n); return Object.entries(by).map(([s, n]) => `The ${TEAM[s].nick} ${did ? 'waived' : 'would waive'} ${n.join(' and ')} to make room.`).join(' ') }
  const done = (r, names, gv) => { for (const x of r?.news ?? []) addNews(F, x); setSent({ names, g: gv }); setGa([]); setGb([]); setPa([]); setPb([]); sfx('claim'); haptic('success') }
  const namesOf = d => [list(d.a, d.ga ?? [], d.pa ?? []), list(d.b, d.gb ?? [], d.pb ?? [])]
  const lineOf = r => (r?.cut?.length ? `${r.line}. ${cutText(r.cut, true)}` : r?.line ?? '')
  const ask = () => {
    const names = namesOf(deal), gv = CAP_SIM.gauge(F, deal)
    const r = act(X => CAP_SIM.proposeTrade(X, deal))
    setAns(r?.ok ? { ...r, line: lineOf(r) } : r)
    if (r?.ok) done(r, names, gv); else sfx(r?.say === 'counter' ? 'flip' : 'deny')
  }
  const takeCounter = () => {
    const c = ans?.counter
    if (!c || !CAP_SIM.checkTrade(F, c).ok) return
    const names = namesOf(c), gv = CAP_SIM.gauge(F, c)
    const r = act(X => CAP_SIM.doTrade(X, c))
    setAns({ ok: true, say: 'yes', text: `Deal done on the ${TEAM[them].nick}' terms`, line: lineOf(r) })
    done(r, names, gv)
  }
  const workFrom = () => { const c = ans?.counter; if (!c) return; setGa(c.ga ?? []); setGb(c.gb ?? []); setPa(c.pa ?? []); setPb(c.pb ?? []); setAns(null); sfx('tap') }
  // (the value bar: up from the first man or pick chosen, legal deal or not, and kept on the board once it's done)
  const g = any ? CAP_SIM.gauge(F, deal) : sent?.g ?? null
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
            <p>{(!any && sent ? sent.names[k] : list(s, ids, pids)).join(', ') || 'Nothing yet'}</p>
            {ids.length > 0 && <small className="nb-deal-cap">{money(sum(s, ids))} in cap hits</small>}
          </div>
        ))}
        {g && <TradeGauge F={F} them={them} g={g} />}
        {chk && !chk.ok && <p className="nb-why nb-deal-why">{teamWords(chk.why)}</p>}
        {chk?.ok && chk.cut && !ans && <p className="nb-deal-note">{cutText(chk.cut, false)}</p>}
        {ans && <TradeSaid ok={ans.ok} counter={!!ans.counter} text={teamWords(ans.text ?? `The ${TEAM[them].nick} pass`)} line={ans.ok ? teamWords(ans.line ?? '') : ''} />}
      </section>
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
              {/* (a veteran on a one-year minimum counts at the two-year veteran's minimum: the row says why the two differ) */}
              <em>{no ? teamWords(no) : `${dealText(p)}${!p.tw && p.y > 0 ? ` · CAP HIT ${money(hit(p))}${hit(p) < (p.$ ?? 0) - 0.04 ? ' (VETERAN MINIMUM)' : ''}` : ''}`}</em>
              {av && <em className="is-inj">{av.season ? 'OUT FOR THE SEASON' : CAP_SIM.outText(p)} · {String(p.inj.k).toUpperCase()}</em>}
            </button>
          )
        })}
        {/* (a pick goes in as it is; a team's own first can then be protected, or kept and offered as a swap) */}
        <Fold title="Draft picks" right={`${psel.length || ''}`}>
          {pickList(s0).map(k => {
            const how = pickState(k)
            const prot = canProtect(F, s0, k), swap = ownFirst(k) && swapOk.includes(k.y)
            const giver = TEAM[s0].nick, taker = TEAM[other].nick
            return (
              <div key={k.i} className="nb-tpick">
                <button type="button" className={`nb-tman${how ? ' is-on' : ''}`} onClick={() => setPick(k, how ? null : 'plain')} aria-pressed={!!how}>
                  <b>{pickText(F, k)}</b>
                  {k.sw && <em>{k.sw.with ? `May swap with the ${TEAM[k.sw.with]?.nick}` : `The ${TEAM[k.sw.by]?.nick} may swap for it`}</em>}
                </button>
                {how && (prot || swap) && (
                  <div className="nb-tprot">
                    <div className="nb-tprot-o" role="radiogroup" aria-label={`How the ${k.y} first is offered`}>
                      <button type="button" role="radio" aria-checked={how === 'plain'} className={how === 'plain' ? 'is-on' : ''} onClick={() => setPick(k, 'plain')}>Unprotected</button>
                      {prot && PROTECTIONS.map(n => <button key={n} type="button" role="radio" aria-checked={how === n} className={how === n ? 'is-on' : ''} onClick={() => setPick(k, n)}>Top {n}</button>)}
                      {swap && <button type="button" role="radio" aria-checked={how === 'swap'} className={how === 'swap' ? 'is-on' : ''} onClick={() => setPick(k, 'swap')}>Swap rights</button>}
                    </div>
                    <p className="nb-tnote">
                      {how === 'swap' ? `The ${taker} may swap their own ${k.y} first for the ${/s$/.test(giver) ? `${giver}'` : `${giver}'s`} if it lands higher. The ${giver} keep a first either way.`
                        : how === 'plain' ? `The ${taker} get the pick wherever it lands.`
                          : `If it lands in the top ${how}, the ${giver} keep it and the ${taker} get their next first instead, ${rollText(how)}.`}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </Fold>
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
  // (on the deal board, which stays in view: the verdict, the bar, each side's share under its own column)
  return (
    <div className={`tr-gauge nb-deal-gauge${even ? ' is-even' : ''}`} aria-label={`By the league's values: ${lean}`}>
      <div className="tr-gauge-h"><b>{lean}</b></div>
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
  const pk = list => (list ?? []).map(e => entryText(F, e)).filter(Boolean)
  const they = [...nm(c.b, c.gb), ...pk(c.pb)], you = [...nm(c.a, c.ga), ...pk(c.pa)]
  return `The ${TEAM[c.b].nick} send ${they.join(', ') || 'nothing'} for ${you.join(', ') || 'nothing'}`
}
