import { useMemo, useState } from 'react'
import {
  TEAM, GROUP, SIT_TEXT, FIND_GROUPS, FIND_CAP, TRADE_MAX, shopOffers, findDeals, tradeAssets, acceptDeal, parsePick, capSheet,
} from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, Go, KLogo, fkVars, Fold, ActionBar } from './kit'
import { Man, PlayerPage, posText, dealText, money } from './dparts'
import { revOf } from './perf'
import { Said, nick, NONE, has, flip, toTop } from './tradebits'
import './trades.css'

// THE TRADE FINDER (lib/franchise2/finder.js), inside the trade screen (Trades.jsx holds its state, so a deal opened
// from here comes back here). Two ways in:
//   SHOP A PLAYER  pick the GM's men and picks; every team's best offer, the most value back first
//   FIND A PLAYER  pick a position (and, if he likes, a rating, an age, a salary); who can be had and what he costs
// Everything listed is a deal the other team takes: ACCEPT makes it, EDIT opens it in the trade screen.
const PAGE = 5
export const newFinder = (tab = 'shop', shop = null) => ({ tab, give: shop != null ? { pl: [shop], pk: [] } : NONE, pick: false, kind: 'all', q: { g: null, o: 0, a: 0, m: 0 }, n: PAGE, done: null })
const OVRS = [[0, 'ANY'], [75, '75+'], [80, '80+'], [85, '85+'], [90, '90+']]
const AGES = [[0, 'ANY'], [1, '25 & UNDER'], [2, '26-29'], [3, '30+']]
const PAYS = [[0, 'ANY'], [5, 'UNDER $5M'], [10, 'UNDER $10M'], [20, 'UNDER $20M']]
const AGE_Q = { 1: { ageMax: 25 }, 2: { ageMin: 26, ageMax: 29 }, 3: { ageMin: 30 } }
const queryOf = q => ({ g: q.g, ...(q.o && { minO: q.o }), ...(AGE_Q[q.a] ?? null), ...(q.m && { max$: q.m }) })
const pickLabel = (k, team) => { const { y, r, o } = parsePick(k); return [`${y} · RD ${r}`, o !== team ? `FROM ${o}` : null] }

export default function Finder({ F, act, owner, st, set, onOpen }) {
  const [page, setPage] = useState(null)
  const up = x => set(s => ({ ...s, ...x }))
  // a deal made from the list: the wire's line on top, the list read again from the roster as it is now
  const make = o => {
    const r = act(X => acceptDeal(X, o.s, o.give, o.get))
    up({ done: r?.ok ? { ok: 1, s: o.s, text: `The ${nick(o.s)} accept. The deal is done.`, line: r.line } : { ok: 0, s: o.s, text: r?.text ?? 'The deal is off the table.' }, ...(r?.ok && st.tab === 'shop' && { give: NONE, pick: false }), n: PAGE })
    sfx(r?.ok ? 'claim' : 'deny'); haptic(r?.ok ? 'success' : 'medium'); toTop()
  }
  return (
    <>
      <div className="fd-seg" role="tablist">
        {[['shop', 'Shop a player'], ['find', 'Find a player']].map(([k, label]) => <button key={k} role="tab" aria-selected={st.tab === k} className={st.tab === k ? 'is-on' : ''} onClick={() => { up({ tab: k, n: PAGE, done: null }); sfx('tap') }}>{label}</button>)}
      </div>
      {st.done && <Said ok={!!st.done.ok} text={st.done.text} line={st.done.line} />}
      {st.tab === 'shop'
        ? <Shop F={F} owner={owner} st={st} up={up} make={make} onOpen={onOpen} onMan={setPage} />
        : <Find F={F} owner={owner} st={st} up={up} make={make} onOpen={onOpen} onMan={setPage} />}
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
}

// ── SHOP A PLAYER ────────────────────────────────────────────────────────────
function Shop({ F, owner, st, up, make, onOpen, onMan }) {
  const rev = revOf(F)
  const A = useMemo(() => tradeAssets(F, F.team), [F, rev]) // eslint-disable-line react-hooks/exhaustive-deps
  // (a man who's gone since he was picked comes off the block)
  const give = useMemo(() => ({ pl: st.give.pl.filter(id => A.men.some(x => x.p.i === id)), pk: st.give.pk.filter(k => A.picks.some(x => x.k === k)) }), [st.give, A])
  const n = give.pl.length + give.pk.length
  const key = `${give.pl.join(',')}|${give.pk.join(',')}`
  const R = useMemo(() => (n ? shopOffers(F, give) : null), [F, rev, key]) // eslint-disable-line react-hooks/exhaustive-deps
  const picking = st.pick || !n
  const tap = (k, v) => {
    if (!has(give, k, v) && n >= TRADE_MAX) { sfx('deny'); return }
    up({ give: flip(give, k, v), done: null, n: PAGE }); sfx('tap'); if (!st.pick) toTop()
  }
  const men = give.pl.map(id => A.men.find(x => x.p.i === id)?.p).filter(Boolean)
  const kinds = R ? new Set(R.list.map(o => o.k)) : new Set()
  const list = R ? R.list.filter(o => st.kind === 'all' || o.k === st.kind) : []
  return (
    <>
      <section className="tf-block" style={fkVars(F.team)}>
        <h3 className="tf-h"><b>On the block</b>{n > 0 && <button type="button" className="fd-link" onClick={() => { up({ pick: !st.pick }); sfx('tap'); toTop() }}>{picking ? 'Done' : 'Add or change'}</button>}</h3>
        {!n && <p className="tr-hint">Pick a player or a pick to shop.</p>}
        {men.map(p => <span key={p.i} className="tr-a"><i>{posText(p)}</i><b>{p.n}</b><em>{p.o}</em><button type="button" aria-label={`Take ${p.n} off the block`} onClick={() => tap('pl', p.i)}>×</button></span>)}
        {give.pk.map(k => <span key={k} className="tr-a is-pk"><i>PICK</i><b>{A.picks.find(x => x.k === k)?.text ?? k}</b><button type="button" aria-label="Take the pick off the block" onClick={() => tap('pk', k)}>×</button></span>)}
      </section>
      {picking ? (
        <>
          <h3 className="tr-list-h">Players</h3>
          <div className="tr-list">
            {A.men.filter(x => x.p.b == null).map(x => {
              const on = has(give, 'pl', x.p.i)
              const why = x.why === 'hurt' ? 'INJURED' : x.why === 'deal' ? 'DEAL UP' : null
              return (
                <div key={x.p.i} className={`tr-pick-man${on ? ' is-on' : ''}${why ? ' is-off' : ''}`}>
                  <Man F={F} p={x.p} s={F.team} owner={owner} size="s" line={why ?? `AGE ${x.p.ag} · ${dealText(x.p)}`} onClick={why ? undefined : () => tap('pl', x.p.i)} />
                  {on && <span className="tr-check" aria-label="On the block">✓</span>}
                </div>
              )
            })}
          </div>
          <h3 className="tr-list-h">Draft picks</h3>
          <div className="tr-picks">
            {A.picks.map(x => (
              <button key={x.k} type="button" className={`tr-pk${has(give, 'pk', x.k) ? ' is-on' : ''}`} onClick={() => tap('pk', x.k)} aria-pressed={has(give, 'pk', x.k)}>
                <b>{x.y} · RD {x.r}</b><small>{x.o !== F.team ? `FROM ${x.o}` : x.text.includes('No.') ? x.text.split('· ')[1].toUpperCase() : 'OWN PICK'}</small>
              </button>
            ))}
            {!A.picks.length && <p className="tr-hint">No picks left to trade</p>}
          </div>
          {n > 0 && <ActionBar><Go onClick={() => { up({ pick: false }); sfx('tap'); toTop() }} sub={`${n} ON THE BLOCK`}>See the offers</Go></ActionBar>}
        </>
      ) : R && !R.open ? <p className="tr-shut">{R.why}</p> : R && (
        <>
          <Chyron tone="ink" size="s" title="OFFERS" right={R.teams ? `${R.teams} ${R.teams === 1 ? 'TEAM' : 'TEAMS'}` : null} />
          {kinds.size > 1 && (
            <div className="tf-opt" role="radiogroup" aria-label="What comes back">
              <span>GET</span>
              {[['all', 'ANY'], ['picks', 'PICKS'], ['player', 'PLAYERS']].map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={st.kind === k} className={st.kind === k ? 'is-on' : ''} onClick={() => { up({ kind: k, n: PAGE }); sfx('tap') }}>{l}</button>)}
            </div>
          )}
          {R.line && <p className="tr-shut">{R.line}</p>}
          {list.length > 0 && <RoomNow F={F} />}
          {list.slice(0, st.n).map(o => <Found key={`${o.s}-${o.k}`} F={F} owner={owner} o={o} make={make} onOpen={onOpen} onMan={onMan} />)}
          {R.dumps.map(o => <Found key={`${o.s}-dump`} F={F} owner={owner} o={o} make={make} onOpen={onOpen} onMan={onMan} />)}
          {list.length > st.n && <button type="button" className="dl-more" onClick={() => { up({ n: st.n + PAGE }); sfx('tap') }}>SHOW {Math.min(PAGE, list.length - st.n)} MORE · {list.length - st.n} LEFT</button>}
        </>
      )}
    </>
  )
}

// ── FIND A PLAYER ────────────────────────────────────────────────────────────
function Find({ F, owner, st, up, make, onOpen, onMan }) {
  const rev = revOf(F), q = st.q
  const R = useMemo(() => (q.g ? findDeals(F, queryOf(q)) : null), [F, rev, q.g, q.o, q.a, q.m]) // eslint-disable-line react-hooks/exhaustive-deps
  const setQ = x => { up({ q: { ...q, ...x }, n: PAGE, done: null }); sfx('tap') }
  const label = q.g ? GROUP[q.g].label : ''
  const filters = [q.o ? `${q.o}+` : null, q.a ? AGES[q.a][1] : null, q.m ? PAYS.find(x => x[0] === q.m)[1] : null].filter(Boolean)
  const row = (name, opts, k) => (
    <div className="tf-opt" role="radiogroup" aria-label={name}>
      <span>{name}</span>
      {opts.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={q[k] === v} className={q[k] === v ? 'is-on' : ''} onClick={() => setQ({ [k]: v })}>{l}</button>)}
    </div>
  )
  return (
    <>
      <div className="dl-filter tf-pos" role="radiogroup" aria-label="Position">
        {FIND_GROUPS.map(g => <button key={g} type="button" role="radio" aria-checked={q.g === g} className={q.g === g ? 'is-on' : ''} onClick={() => setQ({ g })}>{GROUP[g].label}</button>)}
      </div>
      <Fold title="Filters" right={filters.length ? filters.join(' · ') : 'ANY RATING, AGE, SALARY'} className="tf-fold">
        {row('OVR', OVRS, 'o')}
        {row('AGE', AGES, 'a')}
        {row('SALARY', PAYS, 'm')}
      </Fold>
      {!q.g && <div className="fd-none">PICK A POSITION</div>}
      {R && !R.open && <p className="tr-shut">{R.why}</p>}
      {R && R.open && (
        <>
          <Chyron tone="ink" size="s" title="AVAILABLE" right={R.list.length || null} />
          {!R.list.length && <p className="tr-shut">{R.total ? `No ${label} who fits can be had right now.` : `No ${label} around the league fits those filters.`}</p>}
          {R.list.length > 0 && <RoomNow F={F} />}
          {R.list.slice(0, st.n).map(r => <Found key={r.p.i} F={F} owner={owner} o={r} man make={make} onOpen={onOpen} onMan={onMan} />)}
          {R.list.length > st.n && <button type="button" className="dl-more" onClick={() => { up({ n: st.n + PAGE }); sfx('tap') }}>SHOW {Math.min(PAGE, R.list.length - st.n)} MORE · {R.list.length - st.n} LEFT</button>}
          {R.no.length > 0 && (
            <Fold key={`${q.g}-${R.list.length ? 1 : 0}`} title="Not available" right={R.no.length} open={!R.list.length} className="tf-fold">
              {R.no.slice(0, 8).map(r => (
                <div key={r.p.i} className="tf-no" style={fkVars(r.s)}>
                  <Man F={F} p={r.p} s={r.s} owner={owner} size="s" line={`${nick(r.s).toUpperCase()} · AGE ${r.p.ag}`} onClick={() => onMan(r.p.i)} />
                  <p>{r.text}</p>
                </div>
              ))}
            </Fold>
          )}
          {R.total > R.priced && <p className="tr-hint">{`The best ${FIND_CAP} of ${R.total} are priced. Narrow the filters for the rest.`}</p>}
        </>
      )}
    </>
  )
}

// the room before any of it (every deal below shows the room after)
function RoomNow({ F }) {
  const c = capSheet(F)
  if (c.nocap) return null
  return <p className="tf-now">{`${nick(F.team)} cap room now `}<b>{c.room < 0 ? `-${money(-c.room)}` : money(c.room)}</b></p>
}

// ── One deal the finder found ────────────────────────────────────────────────
// man: FIND's row (the man and what he costs); else SHOP's (the team and what it sends back)
const leanShort = (F, s, lean) => (Math.abs(lean) < 0.08 ? 'EVEN' : `${TEAM[lean > 0 ? F.team : s].short} ${Math.abs(lean) >= 0.35 ? 'WIN BIG' : 'AHEAD'}`)
function Found({ F, owner, o, man = false, make, onOpen, onMan }) {
  const theirs = o.get.pl.map(id => F.teams[o.s].r.find(p => p.i === id)).filter(Boolean)
  const mine = o.give.pl.map(id => F.teams[F.team].r.find(p => p.i === id)).filter(Boolean)
  const pk = (k, team) => { const [a, b] = pickLabel(k, team); return <span key={k} className="tf-pk"><b>{a}</b>{b && <small>{b}</small>}</span> }
  const dump = o.k === 'dump', c = o.cap
  return (
    <section className="tf-deal" style={fkVars(o.s)}>
      <header className="tr-offer-h">
        <KLogo s={o.s} size={36} />
        <span><small>{SIT_TEXT[o.sit]}{!man && o.starts ? ' · HE STARTS THERE' : ''}</small><b>{TEAM[o.s].nick}</b></span>
        {man && <em className="tf-deal-r">{dealText(o.p)}</em>}
      </header>
      {man ? (
        <>
          <Man F={F} p={o.p} s={o.s} owner={owner} size="m" line={`AGE ${o.p.ag}`} onClick={() => onMan(o.p.i)} />
          <div className="tf-cost">
            <small>THE {nick(F.team).toUpperCase()} SEND</small>
            {mine.map(p => <span key={p.i} className="tr-a"><i>{posText(p)}</i><b>{p.n}</b><em>{p.o}</em></span>)}
            {o.give.pk.length > 0 && <div className="tf-pks">{o.give.pk.map(k => pk(k, F.team))}</div>}
          </div>
        </>
      ) : dump ? <p className="tr-hint">{`The ${nick(o.s)} take the contract and send nothing back.`}</p> : (
        <div className="tf-cost">
          {theirs.map(p => <Man key={p.i} F={F} p={p} s={o.s} owner={owner} size="s" line={`AGE ${p.ag} · ${dealText(p)}`} onClick={() => onMan(p.i)} />)}
          {o.get.pk.length > 0 && <div className="tf-pks">{o.get.pk.map(k => pk(k, o.s))}</div>}
        </div>
      )}
      {/* the deal in three numbers: who wins it by the league's values, the room after it, the bonus left on the men who go */}
      <div className={`tf-nums${!c.nocap && c.after < 0 ? ' is-over' : ''}`}>
        {!dump && <span className={Math.abs(o.g.lean) < 0.08 ? 'is-even' : ''}><small>VALUE</small><b>{leanShort(F, o.s, o.g.lean)}</b></span>}
        {c.nocap ? <span><small>SALARY CAP</small><b>OFF</b></span> : <span className="tf-room"><small>CAP ROOM AFTER</small><b>{c.after < 0 ? `-${money(-c.after)}` : money(c.after)}</b></span>}
        {!c.nocap && c.dead > 0 && <span><small>DEAD MONEY</small><b>{money(c.dead)}</b></span>}
        {o.cut?.length > 0 && <span className="tf-cut"><small>ROSTER SPOT</small><b>{o.cut.map(p => `${posText(p)} ${p.n} released`).join(' · ')}</b></span>}
      </div>
      <div className="tr-acts tr-acts--2">
        <Go onClick={() => make(o)}>{man ? 'Make the trade' : 'Accept'}</Go>
        <Go ghost onClick={() => onOpen(o.s, o.give, o.get)}>Edit</Go>
      </div>
    </section>
  )
}
