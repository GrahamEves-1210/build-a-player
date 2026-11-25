import { useMemo, useState } from 'react'
import {
  TEAM, tradeWindow, tradeOffers, answerOffer, tradeTeams, tradeAssets, checkTrade, gauge, leanText, proposeTrade, acceptDeal,
  SIT_TEXT, sitOf, pickText, tradesThisYear, recText, TRADE_MAX, TRADE_DEADLINE, capSheet,
} from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, Go, KLogo, fkVars, BackBar, ActionBar, Tag } from './kit'
import { Man, money, posText, dealText } from './dparts'
import { CapNote, Said, nick, NONE, has, flip, toTop } from './tradebits'
import Finder, { newFinder } from './Finder'
import './trades.css'

// TRADES (lib/franchise2/trades.js): the trade finder (Finder.jsx: shop a player, find a player), the league's
// offers, a trade built with any team (players and picks from both sides, five a side at most), and the year's deals.
// The ways in: the Team tab (TradeStrip), a man on the depth chart (FIND A TRADE), the Season tab's rows. The gauge is
// the only number-free read of a deal's value; the other team's answer is its own (its needs, its cap, its plans).

// the window in a few words, for the strip and the screen's header
function windowLine(F) {
  const W = tradeWindow(F)
  if (!W.open) return W.why
  if (W.season) return W.left === 0 ? 'Deadline day: last chance before Week 10' : `Trade deadline after Week ${TRADE_DEADLINE} · ${W.left} ${W.left === 1 ? 'week' : 'weeks'} left`
  return F.stage === 'draft' ? 'Draft week: picks and players can move' : 'The new league year: trades are open'
}

// ── The Team tab's entry ─────────────────────────────────────────────────────
export function TradeStrip({ F, onOpen }) {
  const n = tradeWindow(F).open ? tradeOffers(F).length : 0
  return (
    <button type="button" className="fh-row tr-strip" style={fkVars(F.team)} onClick={onOpen}>
      <span><small>Trades</small><b>{n ? `${n} ${n === 1 ? 'offer' : 'offers'} on the table` : tradeWindow(F).open ? 'Call a team' : 'Window closed'}</b><em>{windowLine(F)}</em></span>
      {n > 0 && <span className="tr-strip-n">{n}</span>}
      <i className="fh-row-go" aria-hidden="true">›</i>
    </button>
  )
}
// the Season tab's note when the league is calling (it opens the same screen)
export function TradeNotice({ F, onOpen }) {
  const list = tradeWindow(F).open ? tradeOffers(F) : []
  if (!list.length) return null
  const o = list[0]
  return (
    <button type="button" className="fh-row tr-notice" style={fkVars(o.s)} onClick={onOpen}>
      <KLogo s={o.s} size={34} />
      <span><small>Trade offer{list.length > 1 ? ` · ${list.length} on the table` : ''}</small><b>{headOf(F, o)}</b></span>
      <i className="fh-row-go" aria-hidden="true">›</i>
    </button>
  )
}
// an offer's headline, the way a beat writer has it
function headOf(F, o) {
  const who = o.k === 'sell' ? F.teams[o.s]?.r.find(p => p.i === o.pid) : F.teams[F.team]?.r.find(p => p.i === o.pid)
  if (!who) return `The ${nick(o.s)} have an offer`
  return o.k === 'sell' ? `The ${nick(o.s)} are shopping ${who.n}` : `The ${nick(o.s)} want ${who.n}`
}

// ── The screen ───────────────────────────────────────────────────────────────
// open: where the screen starts ({ find: 'shop' | 'find', shop: a man's id }: the trade finder, Finder.jsx)
export default function TradeScreen({ F, act, owner, onBack, open = null, back: from = 'Depth chart' }) {
  const [s, setS] = useState(null)              // the team on the other end
  const [give, setGive] = useState(NONE)        // what the player's team sends
  const [get, setGet] = useState(NONE)          // what it gets
  const [res, setRes] = useState(null)          // the other team's answer: { say, text, counter, line }
  const [fs, setFs] = useState(() => (open?.find ? newFinder(open.find, open.shop) : null))   // the finder, while it's up
  const W = tradeWindow(F)
  const offers = W.open ? tradeOffers(F) : []
  const start = (team, g = NONE, t = NONE) => { setS(team); setGive(g); setGet(t); setRes(null); sfx('tap'); toTop() }
  const find = tab => { setFs(newFinder(tab)); sfx('tap'); toTop() }
  const back = () => { if (s) { setS(null); setRes(null); sfx('back'); toTop() } else if (fs) { setFs(null); sfx('back'); toTop() } else onBack() }
  return (
    <div className="fd fk fd-narrow tr">
      <BackBar label={s ? (fs ? 'Trade finder' : 'Trades') : fs ? 'Trades' : from} title={s ? `Trade with the ${nick(s)}` : fs ? 'Trade finder' : 'Trades'} onBack={back} />
      {!s && fs && <Finder F={F} act={act} owner={owner} st={fs} set={setFs} onOpen={start} />}
      {!s && !fs && (
        <>
          <Chyron team={F.team} title="TRADES" tag={F.phase === 'off' ? F.year + 1 : F.year} sub={windowLine(F)} />
          {!W.open && <p className="tr-shut">{W.why}</p>}
          {W.open && (
            <div className="tr-find" style={fkVars(F.team)}>
              <button type="button" className="fh-row" onClick={() => find('shop')}><span><small>Trade finder</small><b>Shop a player</b></span><i className="fh-row-go" aria-hidden="true">›</i></button>
              <button type="button" className="fh-row" onClick={() => find('find')}><span><small>Trade finder</small><b>Find a player</b></span><i className="fh-row-go" aria-hidden="true">›</i></button>
            </div>
          )}
          {offers.length > 0 && (
            <>
              <Chyron tone="ink" size="s" title="OFFERS" right={offers.length} />
              {offers.map(o => <OfferCard key={o.id} F={F} o={o} owner={owner} act={act} onCounter={() => start(o.s, o.give, o.get)} />)}
            </>
          )}
          {W.open && <TeamList F={F} onPick={t => start(t)} />}
          <YearDeals F={F} />
        </>
      )}
      {s && <Builder F={F} act={act} owner={owner} s={s} give={give} get={get} setGive={setGive} setGet={setGet} res={res} setRes={setRes} doneLabel={fs ? 'Back to the finder' : 'Back to trades'} onDone={() => { setS(null); setGive(NONE); setGet(NONE); toTop() }} />}
    </div>
  )
}

// ── An offer from the league ─────────────────────────────────────────────────
function OfferCard({ F, o, owner, act, onCounter }) {
  const [done, setDone] = useState(null)
  const g = gauge(F, o.s, o.give, o.get)
  const ex = F.phase === 'season' && o.exp != null ? `Answer before Week ${o.exp}` : F.stage === 'draft' ? 'Stands until the draft' : null
  const yes = () => {
    const r = act(X => answerOffer(X, o.id, true))
    setDone(r?.ok ? { ok: 1, text: r.line } : { ok: 0, text: r?.text ?? 'The offer is off the table' })
    sfx(r?.ok ? 'claim' : 'deny'); haptic('medium')
  }
  const no = () => { act(X => answerOffer(X, o.id, false)); sfx('tap') }
  return (
    <section className="tr-offer" style={fkVars(o.s)}>
      <header className="tr-offer-h">
        <KLogo s={o.s} size={36} />
        <span><small>{SIT_TEXT[sitFor(F, o.s)]}{ex ? ` · ${ex}` : ''}</small><b>{headOf(F, o)}</b></span>
      </header>
      <Deal F={F} s={o.s} owner={owner} give={o.give} get={o.get} />
      <Gauge F={F} s={o.s} g={g} />
      {done ? <Said ok={done.ok} text={done.text} /> : (
        <div className="tr-acts">
          <Go onClick={yes}>Accept</Go>
          <Go ghost onClick={onCounter}>Counter</Go>
          <Go ghost onClick={no}>Decline</Go>
        </div>
      )}
    </section>
  )
}
const sitFor = (F, s) => sitOf(F, s)

// ── The teams to call ────────────────────────────────────────────────────────
function TeamList({ F, onPick }) {
  const teams = useMemo(() => tradeTeams(F), [F, F.wk, F.stage, F.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Chyron tone="ink" size="s" title="CALL A TEAM" />
      <p className="tr-hint">Contenders pay for veterans. Rebuilding teams want picks and young players.</p>
      {['win', 'mid', 'reb'].map(k => {
        const list = teams.filter(t => t.sit === k).sort((a, b) => nick(a.s).localeCompare(nick(b.s)))
        if (!list.length) return null
        return (
          <div key={k} className="tr-teams">
            <h3 className="tr-teams-h">{SIT_TEXT[k]}</h3>
            {list.map(t => (
              <button key={t.s} type="button" className="tr-team" style={fkVars(t.s)} onClick={() => onPick(t.s)}>
                <KLogo s={t.s} size={30} />
                <b>{nick(t.s)}</b>
                <span>{t.rec ? recText(t.rec) : ''}</span>
                <small>{t.room < 0 ? `-${money(-t.room)}` : money(t.room)} cap room</small>
                <i aria-hidden="true">›</i>
              </button>
            ))}
          </div>
        )
      })}
    </>
  )
}

// ── Building a trade ─────────────────────────────────────────────────────────
function Builder({ F, act, owner, s, give, get, setGive, setGet, res, setRes, onDone, doneLabel = 'Back to trades' }) {
  const [side, setSide] = useState('them')
  const mineA = useMemo(() => tradeAssets(F, F.team), [F, F.wk, F.stage, F.teams[F.team].r.length, res?.line]) // eslint-disable-line react-hooks/exhaustive-deps
  const theirA = useMemo(() => tradeAssets(F, s), [F, s, F.wk, F.stage, F.teams[s].r.length, res?.line]) // eslint-disable-line react-hooks/exhaustive-deps
  const chk = checkTrade(F, s, give, get)
  const g = gauge(F, s, give, get)
  const n = side === 'them' ? get.pl.length + get.pk.length : give.pl.length + give.pk.length
  const tap = (k, v) => {
    setRes(null)
    if (side === 'them') { if (!has(get, k, v) && n >= TRADE_MAX) { sfx('deny'); return } setGet(flip(get, k, v)) }
    else { if (!has(give, k, v) && n >= TRADE_MAX) { sfx('deny'); return } setGive(flip(give, k, v)) }
    sfx('tap')
  }
  const propose = () => {
    const r = act(X => proposeTrade(X, s, give, get))
    setRes(r)
    sfx(r.ok ? 'claim' : r.say === 'counter' ? 'flip' : 'deny'); haptic(r.ok ? 'success' : 'medium')
  }
  const takeCounter = () => {
    const r = act(X => acceptDeal(X, s, res.counter.give, res.counter.get))
    setRes(r.ok ? { ok: true, say: 'yes', text: `The ${nick(s)} accept. The deal is done.`, line: r.line } : { say: 'no', text: r.text })
    sfx(r.ok ? 'claim' : 'deny'); haptic('success')
  }
  const useCounter = () => { setGive(res.counter.give); setGet(res.counter.get); setRes(null); sfx('tap') }
  const A = side === 'them' ? theirA : mineA, team = side === 'them' ? s : F.team, chosen = side === 'them' ? get : give
  const done = res?.ok
  const c = capSheet(F, s)
  return (
    <>
      <div className="tr-with" style={fkVars(s)}>
        <KLogo s={s} size={44} />
        <span><small>{SIT_TEXT[sitFor(F, s)]}</small><b>{TEAM[s].name}</b><em>{c.room < 0 ? `-${money(-c.room)}` : money(c.room)} in cap room</em></span>
      </div>
      {!done && <Deal F={F} s={s} owner={owner} give={give} get={get} onRemove={(k, v, mine) => { setRes(null); if (mine) setGive(flip(give, k, v)); else setGet(flip(get, k, v)); sfx('tap') }} />}
      {!done && <Gauge F={F} s={s} g={g} />}
      {/* (over the cap too: the room and the dead money say why) */}
      {!done && (chk.ok || chk.why === 'ucap') && <CapNote chk={chk} />}
      {!done && !chk.ok && chk.why !== 'empty' && <p className="tr-bad">{chk.text}</p>}
      {res && <Said ok={res.ok} counter={res.say === 'counter'} text={res.text} line={res.line} />}
      {res?.say === 'counter' && res.counter && (
        <div className="tr-counter">
          <Chyron tone="ink" size="s" title="THEIR COUNTER" />
          <Deal F={F} s={s} owner={owner} give={res.counter.give} get={res.counter.get} was={{ give, get }} />
          <Gauge F={F} s={s} g={gauge(F, s, res.counter.give, res.counter.get)} />
          <div className="tr-acts tr-acts--2"><Go onClick={takeCounter}>Accept the counter</Go><Go ghost onClick={useCounter}>Work from it</Go></div>
        </div>
      )}
      {done ? (
        <ActionBar><Go onClick={onDone}>{doneLabel}</Go></ActionBar>
      ) : (
        <>
          <div className="fd-seg tr-seg" role="tablist">
            {[['them', `${nick(s)} send`], ['us', `${nick(F.team)} send`]].map(([k, label]) => <button key={k} role="tab" aria-selected={side === k} className={side === k ? 'is-on' : ''} onClick={() => { setSide(k); sfx('tap') }}>{label}</button>)}
          </div>
          <p className="tr-hint">Tap players and picks to add them. {TRADE_MAX} a side at most.</p>
          <h3 className="tr-list-h">Players</h3>
          <div className="tr-list">
            {A.men.filter(x => x.p.b == null).map(x => {
              const on = has(chosen, 'pl', x.p.i)
              const why = x.why === 'hurt' ? 'INJURED' : x.why === 'deal' ? 'DEAL UP' : null
              return (
                <div key={x.p.i} className={`tr-pick-man${on ? ' is-on' : ''}${why ? ' is-off' : ''}`}>
                  <Man F={F} p={x.p} s={team} owner={owner} size="s" line={why ?? `AGE ${x.p.ag} · ${dealText(x.p)}`} onClick={why ? undefined : () => tap('pl', x.p.i)} />
                  {on && <span className="tr-check" aria-label="In the trade">✓</span>}
                </div>
              )
            })}
          </div>
          <h3 className="tr-list-h">Draft picks</h3>
          <div className="tr-picks">
            {A.picks.map(x => (
              <button key={x.k} type="button" className={`tr-pk${has(chosen, 'pk', x.k) ? ' is-on' : ''}`} onClick={() => tap('pk', x.k)} aria-pressed={has(chosen, 'pk', x.k)}>
                <b>{x.y} · RD {x.r}</b><small>{x.o !== team ? `FROM ${x.o}` : x.text.includes('No.') ? x.text.split('· ')[1].toUpperCase() : 'OWN PICK'}</small>
              </button>
            ))}
            {!A.picks.length && <p className="tr-hint">No picks left to trade</p>}
          </div>
          <ActionBar><Go onClick={propose} disabled={!chk.ok || res?.say === 'counter'}>Propose the trade</Go></ActionBar>
        </>
      )}
    </>
  )
}

// ── The deal: both sides, what's in it ───────────────────────────────────────
// was: the deal before a counter (what the counter adds is marked)
function Deal({ F, s, owner, give, get, onRemove = null, was = null }) {
  const side = (mine, list, title) => {
    const team = mine ? F.team : s
    const men = list.pl.map(id => F.teams[team].r.find(p => p.i === id)).filter(Boolean)
    const before = was ? (mine ? was.give : was.get) : null
    const isNew = (k, v) => before && !has(before, k, v)
    return (
      <div className="tr-side" style={fkVars(team)}>
        <h4><KLogo s={team} size={20} />{title}</h4>
        {!men.length && !list.pk.length && <span className="tr-empty">Nothing yet</span>}
        {men.map(p => (
          <span key={p.i} className={`tr-a${isNew('pl', p.i) ? ' is-new' : ''}`}>
            <i>{posText(p)}</i><b>{p.n}</b><em>{p.o}</em>
            {onRemove && <button type="button" aria-label={`Take ${p.n} out`} onClick={() => onRemove('pl', p.i, mine)}>×</button>}
          </span>
        ))}
        {list.pk.map(k => (
          <span key={k} className={`tr-a is-pk${isNew('pk', k) ? ' is-new' : ''}`}>
            <i>PICK</i><b>{pickText(F, k, team)}</b>
            {onRemove && <button type="button" aria-label="Take the pick out" onClick={() => onRemove('pk', k, mine)}>×</button>}
          </span>
        ))}
        {was && before && [...before.pl.filter(id => !list.pl.includes(id)).map(id => F.teams[team].r.find(p => p.i === id)?.n), ...before.pk.filter(k => !list.pk.includes(k)).map(k => pickText(F, k, team))].filter(Boolean).map(t => <span key={t} className="tr-a is-gone"><i>OUT</i><b>{t}</b></span>)}
      </div>
    )
  }
  return (
    <div className="tr-deal">
      {side(false, get, `${nick(s)} send`)}
      {side(true, give, `${nick(F.team)} send`)}
    </div>
  )
}

// ── The gauge: what each side sends, as the league values it ─────────────────
function Gauge({ F, s, g }) {
  const tot = g.give + g.get
  const left = tot > 0 ? (g.get / tot) * 100 : 50
  const lean = tot > 0 ? leanText(F, s, g.lean) : 'ADD PLAYERS OR PICKS'
  return (
    <div className={`tr-gauge${Math.abs(g.lean) < 0.08 ? ' is-even' : ''}`}>
      <div className="tr-gauge-h"><span>{nick(s)}</span><b>{lean}</b><span>{nick(F.team)}</span></div>
      <div className="tr-gauge-bar" aria-hidden="true">
        <i style={{ ...fkVars(s), width: `${left}%` }} />
        <i style={{ ...fkVars(F.team), width: `${100 - left}%` }} />
        <em />
      </div>
      <div className="tr-gauge-f"><small>VALUE SENT</small><small>VALUE SENT</small></div>
    </div>
  )
}
// the league year's trades, the way the wire filed them
function YearDeals({ F }) {
  const list = tradesThisYear(F).slice().reverse()
  if (!list.length) return null
  return (
    <>
      <Chyron tone="ink" size="s" title="TRADES THIS YEAR" right={list.length} />
      <div className="tr-year">
        {list.map((d, i) => <div key={i} className={`tr-yr${d.u ? ' is-me' : ''}`} style={fkVars(d.a)}><KLogo s={d.a} size={24} /><span>{d.t}</span>{d.u ? <Tag tone="team">{TEAM[F.team].short}</Tag> : null}</div>)}
      </div>
    </>
  )
}
