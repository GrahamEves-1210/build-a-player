import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TEAM, resignOne, optionAsk, optionDue, canSign, tagAsk, canTag, openFA, openTalks, offerTalks, acceptTalks, talkFacts,
  worthOf, fitsDeal, capRoom, SAY, startsFor, teamView, rivalsFor, standingOf, fitOf, setOffer, pullOffer, offersOut, committed,
  floorOf, nextFADay, FA_DAYS, openDraft, marketDeals, POS_LABEL, coachGrade, groupOf, GROUP, minimumFor,
  walkingStarters, optionTier, OPTION_TIER_TEXT,
} from '../../lib/franchise2'
import { letterColor } from '../../lib/gradeColors'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, BigNum, Stamp, Meter, Go, KLogo, fkVars, BackBar, ActionBar, Fact, Tag } from './kit'
import { Man, PlayerPage } from './dparts'
import { ScoutNote, LastLine, Terms, CapLine, money } from './dealbits'
import './deals.css'
import { spotOf } from '../../lib/franchise2/news'

// RE-SIGN and FREE AGENCY (the offseason's second and third stops). The engine: lib/franchise2/deals.js (the talks,
// what a deal is worth to a man), market.js (the market, the offers, the day's end), contracts.js (the cap).
const yrs = y => `${y} ${y === 1 ? 'YR' : 'YRS'}`
const r1 = v => Math.round(v * 10) / 10
const nick = s => TEAM[s]?.nick?.toUpperCase() ?? ''
// (the hub scrolls in its own box: a new view starts at its top)
const box = () => { try { return document.querySelector('.fh-scroll') } catch { return null } }
const toTop = (y = 0) => { const b = box(); if (b) requestAnimationFrame(() => b.scrollTo({ top: y })) }
const useWide = () => {
  const q = '(min-width: 900px)'
  const [w, setW] = useState(() => { try { return window.matchMedia(q).matches } catch { return false } })
  useEffect(() => { let m; try { m = window.matchMedia(q) } catch { return } const f = () => setW(m.matches); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f) }, [])
  return w
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. RE-SIGN: the men whose deals are up, then the talks with each one
// ═════════════════════════════════════════════════════════════════════════════
const DONE_TEXT = { kept: 'RE-SIGNED', option: 'OPTION PICKED UP', decline: 'OPTION DECLINED', tag: 'FRANCHISE TAG', gone: 'LET GO', tested: 'TESTING FREE AGENCY' }
export function Resign({ F, act, owner }) {
  const [id, setId] = useState(null)
  const [page, setPage] = useState(null)
  const [sure, setSure] = useState(false)
  const t = F.teams[F.team]
  if (id != null) return <Talks F={F} act={act} owner={owner} id={id} onBack={() => { setId(null); sfx('back'); toTop() }} />
  const open = (F.rs ?? []).map(i => t.r.find(x => x.i === i)).filter(Boolean)
  const done = F.rsd ?? []
  // (starters still unsigned: the GM is asked first, and told who they are)
  const walking = walkingStarters(F)
  const next = () => {
    if (walking.length && !sure) { setSure(true); sfx('deny'); haptic('medium'); return }
    act(X => { for (const i of [...(X.rs ?? [])]) { const p = X.teams[X.team].r.find(x => x.i === i); if (p) resignOne(X, i, optionDue(p) ? 'decline' : false) } openFA(X) })
    sfx('whistle')
  }
  return (
    <>
      <Chyron team={F.team} title="RE-SIGN" tag={F.year + 1} sub={open.length ? `${open.length} ${open.length === 1 ? 'DEAL' : 'DEALS'} UP · TAP A PLAYER TO NEGOTIATE` : 'EVERY DEAL IS DONE'} />
      {open.map((p, j) => {
        const tk = F.talks?.[p.i]
        const opt = optionDue(p)
        const line = opt ? `AGE ${p.ag} · FIFTH-YEAR OPTION` : tk?.n ? `AGE ${p.ag} · ${tk.st === 3 ? 'FINAL' : 'COUNTER'} ${money(tk.c.$)} · ${yrs(tk.c.y)}` : `AGE ${p.ag} · ${startsFor(F, p) ? 'STARTER' : 'BACKUP'}`
        return <Man key={p.i} F={F} p={p} s={F.team} owner={owner} size="m" delay={j * 30} line={line} onClick={() => { setId(p.i); sfx('tap'); toTop() }} />
      })}
      {done.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="DONE" right={done.length} />
          {done.map(([i, k, n]) => {
            const p = t.r.find(x => x.i === i)
            const what = DONE_TEXT[k] ?? k
            const terms = p && (k === 'kept' || k === 'tag' || k === 'option') ? ` · ${money(k === 'option' ? p.ox ?? p.$ : p.$)} · ${yrs(k === 'option' ? 1 : p.y)}` : ''
            return p
              ? <Man key={i} F={F} p={p} s={F.team} owner={owner} size="s" line={`${what}${terms}`} onClick={() => setPage(p.i)} />
              : <div key={i} className="dl-gone"><b>{n}</b><Tag tone={k === 'tested' ? 'l' : 'ink'}>{what}</Tag></div>
          })}
        </>
      )}
      <CampReport F={F} owner={owner} onMan={setPage} />
      {sure && walking.length > 0 ? (
        <ActionBar className="dl-walk">
          <div className="dl-walk-t" role="alert">
            <b>{walking.length === 1 ? 'A STARTER WILL WALK' : `${walking.length} STARTERS WILL WALK`}</b>
            <span>{walking.map(p => `${p.n} (${p.p === 'ol' && p.s ? p.s : GROUP[groupOf(p)]?.label ?? POS_LABEL[p.p]})`).join(', ')} {walking.length === 1 ? 'becomes a free agent' : 'become free agents'}. The {TEAM[F.team].nick} can still bid in free agency, against everyone else.</span>
          </div>
          <div className="fd-two"><Go onClick={next}>Let them go</Go><Go ghost onClick={() => { setSure(false); sfx('back') }}>Keep negotiating</Go></div>
        </ActionBar>
      ) : <ActionBar><Go onClick={next} sub={open.length ? `${open.length} ${open.length === 1 ? 'BECOMES A FREE AGENT' : 'BECOME FREE AGENTS'}${walking.length ? ` · ${walking.length} ${walking.length === 1 ? 'STARTER' : 'STARTERS'}` : ''}` : null}>Next: Free agency</Go></ActionBar>}
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
}

// The talks: his number, his agent's patience, the factors, the offer; or the fifth-year option
function Talks({ F, act, owner, id, onBack }) {
  const [page, setPage] = useState(null)
  const p = F.teams[F.team].r.find(x => x.i === id)
  const opt = p && optionDue(p) && !(F.rsd ?? []).some(d => d[0] === id)
  useEffect(() => { if (p && !opt && !F.talks?.[id]) act(X => { openTalks(X, id) }) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const t = F.talks?.[id]
  const [o, setO] = useState(null)
  useEffect(() => { if (t && !o) setO({ $: r1(Math.max(minimumFor(p?.ag ?? 25, F.year + 1), t.c.$ * 0.93)), y: t.c.y, b: 0 }) }, [t, o]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = (F.rsd ?? []).find(d => d[0] === id)
  if (!p && !done) return <BackBar label="Re-sign" onBack={onBack} />
  if (opt) return <OptionCall F={F} act={act} owner={owner} p={p} onBack={onBack} />
  const who = p ?? (F.fa ?? []).find(x => x.i === id)
  const room = capRoom(F)
  const facts = p ? talkFacts(F, id) : []
  const over = t && (t.st === 1 || t.st === 2 || done)
  const stake = o && p ? worthOf(p, o) : 0
  const ok = o && p && fitsDeal(F, p, o)
  const make = () => {
    const r = act(X => offerTalks(X, id, o))
    if (!r?.ok) { sfx('deny'); return }
    if (r.say === 'yes') { sfx('claim'); haptic('success') } else if (r.say === 'walk') { sfx('deny'); haptic('medium') } else sfx('flip')
  }
  const take = () => { if (act(X => acceptTalks(X, id))) { sfx('claim'); haptic('success') } else sfx('deny') }
  const letGo = () => { act(X => resignOne(X, id, false)); sfx('swap'); onBack() }
  const tag = () => { act(X => resignOne(X, id, 'tag')); sfx('claim'); haptic('success') }
  const tg = p && canTag(F) && p.o >= 84 && !over ? tagAsk(p, F) : null
  return (
    <>
      <BackBar label="Re-sign" title="Contract talks" onBack={onBack} />
      {who && <Man F={F} p={who} s={F.team} owner={owner} size="l" line={`AGE ${who.ag}`} onClick={() => setPage(who.i)} />}
      {who && <div className="dl-about"><ScoutNote p={who} own /><LastLine F={F} p={who} /></div>}
      {t && (
        <section className="dl-table">
          <div className="dl-num">
            <span className="dl-num-h">{t.n ? (t.st === 3 ? 'HIS FINAL NUMBER' : 'HIS COUNTER') : 'HIS ASK'}</span>
            <BigNum v={money(t.c.$)} count={false} label="A YEAR" size={50} />
            <BigNum v={t.c.y} count={false} label={t.c.y === 1 ? 'YEAR' : 'YEARS'} size={50} />
            <BigNum v={money(t.c.$ * t.c.y)} count={false} label="TOTAL" size={28} />
          </div>
          <div className="dl-pat" aria-label={`Patience ${t.pat} of ${t.max}`}>
            <small>HIS AGENT'S PATIENCE</small>
            <span>{Array.from({ length: t.max }, (_, i) => <i key={i} className={i < t.pat ? 'is-on' : ''} />)}</span>
          </div>
          <p className={`dl-say is-${t.say}`}>{SAY[t.say]}</p>
        </section>
      )}
      {!over && facts.length > 0 && (
        <div className="dl-facts">
          {facts.map(f => <Fact key={f.k} v={f.money ? money(f.v) : f.v} label={f.label} tone={f.up > 0 ? 'w' : f.up < 0 ? 'l' : undefined} size={26} />)}
        </div>
      )}
      {over ? (
        <section className="dl-over">
          <Stamp kind={t?.st === 2 || done?.[1] === 'tested' || done?.[1] === 'gone' ? 'l' : 'w'} big>{t?.st === 2 || done?.[1] === 'tested' || done?.[1] === 'gone' ? 'GONE' : 'SIGNED'}</Stamp>
          <b>{t?.st === 2 || done?.[1] === 'tested' ? `${who?.n ?? 'He'} will test free agency` : done?.[1] === 'gone' ? `${who?.n ?? 'He'} is a free agent` : `${who.n}: ${who.y} ${who.y === 1 ? 'year' : 'years'}, ${money(who.$ * who.y)}`}</b>
          {t?.st === 2 && <small>{`THE ${nick(F.team)} CAN STILL BID ON HIM IN FREE AGENCY`}</small>}
          <ActionBar><Go onClick={onBack}>Back to re-sign</Go></ActionBar>
        </section>
      ) : t && o ? (
        <>
          {t.st !== 3 && (
            <>
              <Chyron tone="ink" size="s" title={`THE ${nick(F.team)} OFFER`} />
              <Terms o={o} set={setO} lo={minimumFor(p.ag, F.year + 1)} hi={r1(Math.max(t.c.$ * 1.25, t.d * 1.25))} />
              <CapLine room={room} take={o.$} />
              <p className="dl-meet">{stake >= t.d * 0.995 ? 'AT HIS NUMBER: HE SIGNS' : stake >= t.d * 0.95 ? 'CLOSE TO HIS NUMBER' : 'UNDER HIS NUMBER'}</p>
            </>
          )}
          <ActionBar>
            {t.st === 3
              ? <Go onClick={take} disabled={!fitsDeal(F, p, t.c)} sub={`${yrs(t.c.y)} · ${money(t.c.$ * t.c.y)}`}>Sign at his number</Go>
              : <Go onClick={make} disabled={!ok} sub={ok ? `${yrs(o.y)} · ${money(o.$ * o.y)}` : 'NOT ENOUGH CAP ROOM'}>Make the offer</Go>}
          </ActionBar>
          <div className="dl-alt">
            {t.st !== 3 && <Go ghost onClick={take} disabled={!fitsDeal(F, p, t.c)} sub={`${money(t.c.$)} · ${yrs(t.c.y)}`}>Sign at his number</Go>}
            <Go ghost onClick={letGo}>Let him go</Go>
            {tg != null && <Go ghost onClick={tag} disabled={!canSign(F, tg)} sub={`1 YEAR · ${money(tg)}`}>Franchise tag</Go>}
          </div>
        </>
      ) : null}
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
}
// a first-rounder's fifth-year option: pick it up or decline it (no talks: the price is set by the CBA)
function OptionCall({ F, act, owner, p, onBack }) {
  const price = optionAsk(p, F)
  const fits = canSign(F, price - p.$)
  const call = how => { act(X => resignOne(X, p.i, how)); sfx(how === 'decline' ? 'swap' : 'claim'); haptic(how === 'decline' ? 'light' : 'success'); onBack() }
  return (
    <>
      <BackBar label="Re-sign" title="Fifth-year option" onBack={onBack} />
      <Man F={F} p={p} s={F.team} owner={owner} size="l" line={`AGE ${p.ag}`} />
      <div className="dl-about"><ScoutNote p={p} own /><LastLine F={F} p={p} /></div>
      <div className="dl-num">
        <span className="dl-num-h">THE OPTION</span>
        <BigNum v={money(price)} count={false} label={`${F.year + 2} SEASON`} size={50} />
      </div>
      <p className="dl-meet">{OPTION_TIER_TEXT[optionTier(p, startsFor(F, p))]} · THEN A NEW DEAL OR FREE AGENCY</p>
      <ActionBar>
        <Go disabled={!fits} onClick={() => call('option')} sub={fits ? null : 'NOT ENOUGH CAP ROOM'}>Pick it up</Go>
        <Go ghost onClick={() => call('decline')}>Decline</Go>
      </ActionBar>
    </>
  )
}
// the camp report: who got better, who slipped, who retired; the head coach's own year
export function CampReport({ F, owner, onMan }) {
  const ch = (F.aging ?? []).filter(c => c.k === 'coach' || c.b != null || c.k === 'ret' || Math.abs((c.to ?? 0) - (c.from ?? 0)) >= 3)
  if (!ch.length) return null
  const t = F.teams[F.team]
  const CL = { talentDev: 'TALENT DEVELOPMENT', offPlaycalling: 'OFFENSIVE PLAYCALLING', defPlaycalling: 'DEFENSIVE PLAYCALLING', culture: 'CULTURE BUILDING', situational: 'SITUATIONAL AWARENESS' }
  const L = ['F', 'D-', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'S']
  return (
    <>
      <Chyron team={F.team} size="s" title="CAMP REPORT" right={F.year + 1} />
      {ch.filter(c => c.k === 'coach').map(c => (
        <div key={c.t} className="dl-coachup">
          <span><small>HEAD COACH · {F.coach?.name?.toUpperCase()}</small><b>{CL[c.t]}</b></span>
          <em className={c.to > c.from ? 'is-up' : 'is-down'}>{L[c.from]} → {L[c.to]}</em>
        </div>
      ))}
      {ch.filter(c => c.k !== 'coach').slice(0, 12).map(c => {
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

// ═════════════════════════════════════════════════════════════════════════════
// 3. FREE AGENCY: three days. The whole market, filtered and sorted; offers out until the day ends.
// ═════════════════════════════════════════════════════════════════════════════
const FILTERS = [['all', 'ALL'], ['qb', 'QB'], ['rb', 'RB'], ['wr', 'WR'], ['te', 'TE'], ['ol', 'OL'], ['edge', 'EDGE'], ['dt', 'DT'], ['lb', 'LB'], ['cb', 'CB'], ['s', 'S'], ['k', 'K']]
const SORTS = [['ovr', 'OVR'], ['age', 'AGE'], ['price', 'PRICE'], ['fit', 'FIT']]
const PAGE = 15
const FIT_TEXT = { hole: 'FILLS A HOLE', start: 'WOULD START', depth: 'DEPTH' }
export function FreeAgency({ F, act, owner }) {
  const wide = useWide()
  const [sel, setSel] = useState(null)
  const [f, setF] = useState('all')
  const [sort, setSort] = useState('ovr')
  const [n, setN] = useState(PAGE)
  const [page, setPage] = useState(null)
  const [wire, setWire] = useState(null)
  const at = useRef(0)   // (where the list was when a phone opened a man: back puts it there again)
  const done = !F.fad
  const key = `${F.fad}|${(F.fa ?? []).length}|${(F.fas ?? []).length}|${F.teams[F.team].r.length}`
  const V = useMemo(() => (done ? null : teamView(F)), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const out = offersOut(F)
  const nOut = Object.keys(out).length
  const list = useMemo(() => {
    if (done) return []
    const all = (F.fa ?? []).filter(p => !p.fl && (f === 'all' || groupOf(p) === f))
    const fit = new Map(all.map(p => [p.i, fitOf(F, p, V)]))
    const by = { ovr: (a, b) => b.o - a.o, age: (a, b) => a.ag - b.ag || b.o - a.o, price: (a, b) => a.$ - b.$ || b.o - a.o, fit: (a, b) => fit.get(b.i).v - fit.get(a.i).v || b.o - a.o }
    return all.sort(by[sort]).map(p => ({ p, fit: fit.get(p.i) }))
  }, [key, f, sort, nOut]) // eslint-disable-line react-hooks/exhaustive-deps
  const deals = marketDeals(F)
  const pick = id => { if (!wide) at.current = box()?.scrollTop ?? 0; setSel(id); sfx('tap'); if (!wide) toTop() }
  const endDay = () => {
    const before = deals.length
    const r = act(X => nextFADay(X))
    const mine = new Set((F.far?.list ?? []).map(x => x.i))
    const list2 = marketDeals(F).slice(before).filter(d => d.s !== F.team && !mine.has(d.i)).sort((a, b) => b.$ - a.$)
    setWire({ n: F.fad ? F.fad - 1 : FA_DAYS, list: list2 }); setSel(null); toTop()
    sfx(r?.done ? 'whistle' : 'flip')
  }
  const p = sel != null ? (F.fa ?? []).find(x => x.i === sel) : null
  // a phone: the offer is its own screen; a wide screen: beside the market
  if (p && !wide) return (
    <>
      <OfferPanel F={F} act={act} owner={owner} p={p} V={V} onBack={() => { setSel(null); sfx('back'); toTop(at.current) }} setPage={setPage} />
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
  const myDeals = deals.filter(d => d.s === F.team)
  return (
    <>
      <Chyron team={F.team} title="FREE AGENCY" tag={done ? 'CLOSED' : `DAY ${F.fad} OF ${FA_DAYS}`} sub={done ? 'THE MARKET IS CLOSED' : `${(F.fa ?? []).length} ON THE MARKET · OFFERS ARE ANSWERED WHEN THE DAY ENDS`} />
      {F.far?.list?.length > 0 && <DayResults F={F} r={F.far} />}
      {wire && wire.list.length > 0 && (
        <section className="fd-day">
          <Chyron tone="ink" size="s" title={`DAY ${wire.n} AROUND THE LEAGUE`} right={wire.list.length} />
          {wire.list.slice(0, 6).map(d => <WireDeal key={d.i} F={F} d={d} />)}
        </section>
      )}
      {!done && (
        <div className={`dl-fa${wide ? ' is-wide' : ''}`}>
          <div className="dl-fa-list">
            <CapLine room={capRoom(F)} out={committed(F)} />
            <div className="dl-filter" role="radiogroup" aria-label="Position">
              {FILTERS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={f === k} className={f === k ? 'is-on' : ''} onClick={() => { setF(k); setN(PAGE); sfx('tap') }}>{l}</button>)}
            </div>
            <div className="dl-sort" role="radiogroup" aria-label="Sort">
              <span>SORT</span>
              {SORTS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={sort === k} className={sort === k ? 'is-on' : ''} onClick={() => { setSort(k); setN(PAGE); sfx('tap') }}>{l}</button>)}
            </div>
            {list.length === 0 && <div className="fd-none">NOBODY LEFT AT {FILTERS.find(x => x[0] === f)?.[1]}</div>}
            {list.slice(0, n).map(({ p: x, fit }, j) => <FACard key={x.i} F={F} p={x} fit={fit} V={V} owner={owner} on={sel === x.i} delay={Math.min(j, 8) * 25} onClick={() => pick(x.i)} />)}
            {list.length > n && <button type="button" className="dl-more" onClick={() => { setN(v => v + PAGE); sfx('tap') }}>SHOW {Math.min(PAGE, list.length - n)} MORE · {list.length - n} LEFT</button>}
          </div>
          {wide && (
            <div className="dl-fa-side">
              {p ? <OfferPanel F={F} act={act} owner={owner} p={p} V={V} side onBack={() => setSel(null)} setPage={setPage} />
                : <div className="dl-pick"><b>PICK A PLAYER</b><small>TAP ONE TO MAKE AN OFFER</small></div>}
            </div>
          )}
        </div>
      )}
      {myDeals.length > 0 && (
        <>
          <Chyron team={F.team} size="s" title="SIGNED" right={myDeals.length} />
          {myDeals.map(d => { const x = F.teams[F.team].r.find(q => q.i === d.i); return x ? <Man key={d.i} F={F} p={x} s={F.team} owner={owner} size="s" line={`${money(d.$)} · ${yrs(d.y)}`} onClick={() => setPage(x.i)} /> : null })}
        </>
      )}
      <ActionBar>
        {!done && <Go onClick={endDay} sub={F.fad === FA_DAYS ? 'THE MARKET CLOSES' : nOut ? `${nOut} ${nOut === 1 ? 'OFFER' : 'OFFERS'} OUT` : 'NO OFFERS OUT'}>End day {F.fad}</Go>}
        {done && <Go onClick={() => { act(X => openDraft(X)); sfx('whistle') }}>Next: The draft</Go>}
      </ActionBar>
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </>
  )
}
const WireDeal = ({ F, d }) => (
  <div className="fd-wire-deal" style={fkVars(d.s)}>
    <KLogo s={d.s} size={24} />
    <span><b>{d.n}</b><small>{nick(d.s)} · {spotOf(F, d)} · {yrs(d.y)}, {money(d.$ * d.y)}</small></span>
  </div>
)
// where an offer stands, in plain words
const STAND = {
  short: () => ['UNDER HIS NUMBER', 'l'],
  alone: () => ['ONLY OFFER', 'w'],
  lead: F => [`${nick(F.team)} LEAD`, 'w'],
  close: () => ['TOO CLOSE TO CALL', 'n'],
  behind: (F, s) => [`${nick(s.lead)} LEAD`, 'l'],
}
// One man on the market: who he is, his ask, his season, the scouts' read, who's bidding, how he fits, the offer out
function FACard({ F, p, fit, V, owner, on, delay, onClick }) {
  const rivals = rivalsFor(F, p, V)
  const mine = offersOut(F)[p.i]
  const st = mine ? standingOf(F, p, mine, V) : null
  const [word, tone] = st ? STAND[st.k](F, st) : []
  return (
    <div className={`dl-card${on ? ' is-on' : ''}`} style={{ '--d': `${delay}ms` }}>
      <Man F={F} p={p} s={F.team} owner={owner} size="m" line={`AGE ${p.ag}`} onClick={onClick} />
      <button type="button" className="dl-card-info" onClick={onClick} aria-label={`Make ${p.n} an offer`}>
        <span className="dl-card-top">
          <span className="dl-ask"><small>ASKS</small><b>{money(p.$)}</b><em>{yrs(p.y)}</em></span>
          <span className={`dl-fit is-${fit.k}`}>{fit.k === 'depth' && p.p === 'k' ? 'CAMP BATTLE' : FIT_TEXT[fit.k]}{fit.k === 'start' ? ` +${fit.d}` : ''}</span>
        </span>
        <LastLine F={F} p={p} />
        <ScoutNote p={p} />
        <span className="dl-bid">
          <span className="dl-bid-teams">{rivals.length ? <>{rivals.map(r => <KLogo key={r.s} s={r.s} size={22} />)}<small>ALSO BIDDING</small></> : <small>NO OTHER BIDS YET</small>}</span>
          {mine && <span className={`dl-stand is-${tone}`}>{money(mine.$)} · {word}</span>}
        </span>
      </button>
    </div>
  )
}

// The offer: his ask, who's in, what he wants, where the offer stands, the terms, the cap; make, raise or pull it
const WANTS = [['money', 'MONEY'], ['winning', 'WINNING'], ['role', 'PLAYING TIME'], ['coach', 'HEAD COACH']]
function OfferPanel({ F, act, owner, p, V, side = false, onBack, setPage }) {
  const out = offersOut(F)[p.i]
  const [o, setO] = useState(() => out ?? { $: p.$, y: p.y, b: 0 })
  useEffect(() => { setO(offersOut(F)[p.i] ?? { $: p.$, y: p.y, b: 0 }) }, [p.i]) // eslint-disable-line react-hooks/exhaustive-deps
  const st = standingOf(F, p, o, V)
  const pitch = st.mine
  const [word, tone] = STAND[st.k](F, st)
  const room = capRoom(F), elsewhere = committed(F, p.i)
  const fits = room - elsewhere >= o.$ - 1e-9
  const same = out && out.$ === o.$ && out.y === o.y && out.b === o.b
  const lo = minimumFor(p.ag, F.year + 1), hi = r1(Math.max(p.$ * 1.5, lo + 1))
  const make = () => { if (act(X => setOffer(X, p.i, o))) { sfx('claim'); haptic('medium') } else sfx('deny') }
  const pull = () => { act(X => pullOffer(X, p.i)); sfx('swap') }
  const c = F.coach?.r
  return (
    <section className={`dl-offer${side ? ' is-side' : ''}`}>
      {side ? <Chyron tone="ink" size="s" title="MAKE AN OFFER" right={<button type="button" className="fk-x dl-x" onClick={onBack} aria-label="Close">✕</button>} /> : <BackBar label="Free agency" title="Make an offer" onBack={onBack} />}
      <Man F={F} p={p} s={F.team} owner={owner} size={side ? 'm' : 'l'} line={`AGE ${p.ag}`} onClick={() => setPage?.(p.i)} />
      <div className="dl-about"><ScoutNote p={p} /><LastLine F={F} p={p} /></div>
      <div className="dl-facts">
        <Fact v={money(p.$)} label="HIS ASK" size={26} />
        <Fact v={p.y} label={p.y === 1 ? 'YEAR' : 'YEARS'} size={26} />
        <Fact v={money(floorOf(F, p))} label="WILL TAKE TODAY" size={26} />
      </div>
      <div className="fd-in">
        <small>{st.rivals.length ? 'ALSO BIDDING' : 'NO OTHER BIDS YET'}</small>
        <span>{st.rivals.map(r => <span key={r.s} className="fd-in-team" style={fkVars(r.s)}><KLogo s={r.s} size={28} /></span>)}</span>
      </div>
      <div className={`dl-standing is-${tone}`} role="status"><small>{`WHERE THE ${nick(F.team)} STAND · ${st.day > F.fad ? `DECIDES DAY ${st.day}` : 'DECIDES TODAY'}`}</small><b>{word}</b></div>
      <Chyron tone="ink" size="s" title="WHAT HE WANTS" right={nick(F.team)} />
      <div className="fd-wants">
        {WANTS.map(([k, label]) => <Meter key={k} label={label} v={Math.round(pitch[k] * 100)} team={F.team} show={k === 'role' ? (pitch.starts ? 'STARTER' : 'BACKUP') : k === 'money' ? money(worthOf(p, o)) : k === 'coach' ? coachGrade(c) ?? '-' : undefined} color={k === 'coach' ? letterColor(coachGrade(c)) : undefined} />)}
      </div>
      <Chyron tone="ink" size="s" title={`THE ${nick(F.team)} OFFER`} right={out ? 'OUT' : null} />
      <Terms o={o} set={setO} lo={lo} hi={hi} />
      <CapLine room={room} out={elsewhere} take={o.$} />
      {same && <p className="dl-outnote"><Tag tone="new">OFFER OUT</Tag><span>{yrs(out.y)} · {money(out.$ * out.y)} · {st.day > F.fad ? `HE ANSWERS ON DAY ${st.day}` : 'HE ANSWERS WHEN THE DAY ENDS'}</span></p>}
      {side ? (
        <div className="dl-side-go">
          {!same && <Go onClick={make} disabled={!fits} sub={fits ? `${yrs(o.y)} · ${money(o.$ * o.y)}` : 'NOT ENOUGH CAP ROOM'}>{out ? 'Change the offer' : 'Make the offer'}</Go>}
          {out && <Go ghost onClick={pull}>Pull the offer</Go>}
        </div>
      ) : (
        <ActionBar>
          {same ? <Go onClick={onBack}>Back to the market</Go>
            : <Go onClick={make} disabled={!fits} sub={fits ? `${yrs(o.y)} · ${money(o.$ * o.y)}` : 'NOT ENOUGH CAP ROOM'}>{out ? 'Change the offer' : 'Make the offer'}</Go>}
          {out && <Go ghost onClick={pull}>Pull it</Go>}
        </ActionBar>
      )}
    </section>
  )
}

// why he took less than the most money on the table, the way a beat writer would put it
const WHY = { deal: 'more years and more of it guaranteed', role: 'a starting job', win: 'a contender', coach: 'the head coach' }
const whyText = x => `Took ${money(x.why.less)} a year less than the ${TEAM[x.why.vs]?.nick ?? x.why.vs} offered, for ${WHY[x.why.k] ?? 'the better fit'}${x.why.k === 'win' || x.why.k === 'role' || x.why.k === 'coach' ? ` with the ${TEAM[x.to]?.nick ?? x.to}` : ''}`
// The day's answers to the player's offers: each man's offers turned over, then where he signed
export function DayResults({ F, r, title = null }) {
  return (
    <section className="dl-results">
      <Chyron team={F.team} size="s" title={title ?? `DAY ${r.d} · THE ${nick(F.team)} OFFERS`} right={r.list.length} />
      {r.list.map((x, j) => {
        const won = x.k === 'won', later = x.k === 'later', board = [...(x.board ?? [])].sort((a, b) => b.v - a.v)
        return (
          <div key={x.i} className="dl-res" style={{ '--d': `${j * 160}ms` }}>
            <div className="dl-res-h">
              <b>{x.n}</b>
              <small>{GROUP[groupOf(x)]?.label ?? POS_LABEL[x.p]}</small>
              <Stamp kind={won ? 'w' : later ? 'ink' : 'l'} delay={j * 160 + 300}>{won ? 'SIGNED' : x.k === 'lost' ? 'GONE' : later ? 'DECIDING' : x.k === 'short' || x.k === 'wait' ? 'NO DEAL' : 'NO ROOM'}</Stamp>
            </div>
            {board.length > 0 && !later && (
              <div className="fd-reveal">
                {board.map((b, i) => (
                  <div key={b.s} className={`fd-offer is-open${(won && b.s === F.team) || (x.to === b.s) ? ' is-win' : ''}`} style={{ ...fkVars(b.s), animationDelay: `${j * 160 + i * 90}ms` }}>
                    <KLogo s={b.s} size={30} />
                    <b>{nick(b.s)}</b>
                    <span className="fd-offer-v">{money(b.offer)}</span>
                    <small>{b.v < 0 ? 'TOO LOW' : `${yrs(b.y)}${b.starts ? ' · STARTS' : ''}`}</small>
                  </div>
                ))}
              </div>
            )}
            <p className="dl-res-t">{won ? `Signs with the ${TEAM[F.team].nick}: ${yrs(x.y)}, ${money(x.$ * x.y)}` : x.k === 'lost' ? `Signs with the ${TEAM[x.to].nick}: ${yrs(x.y)}, ${money(x.$ * x.y)}` : later ? `Still hearing offers. He decides on day ${x.day}, and the offer stays out until then` : x.k === 'short' || x.k === 'wait' ? 'Turned it down as too low. Still on the market' : 'Not enough cap room when the day ended'}</p>
            {x.why && <p className="dl-res-why">{whyText(x)}</p>}
          </div>
        )
      })}
    </section>
  )
}
