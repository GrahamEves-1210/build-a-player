import { useMemo } from 'react'
import { TEAM, CAP_SIM, pickText, addNews } from '../../../lib/franchise2/nba'
import { shopOffers, findDeals, FIND_POS, FIND_CAP, TRADE_MAX_SIDE } from '../../../lib/franchise2/nba/finder'
import { picksOf as tradePicks } from '../../../lib/franchise2/nba/trades'
import { hitOf } from '../../../lib/franchise2/nba/cap'
import { teamWords } from '../../../lib/franchise2/nba/news'
import { sfx, haptic } from '../../../lib/juice'
import { fkVars, KLogo, LowerThird, Chyron, Go, Fold, ActionBar, Stamp } from '../kit'
import { manPhoto } from './NbaBuilds'
import { money } from './NbaHub'
import '../trades.css'

// THE TRADE FINDER (lib/franchise2/nba/finder.js), inside the trade screen (NbaTeam.jsx Trades holds its state, so a
// deal opened from here comes back here). Two ways in:
//   SHOP A PLAYER  pick the GM's men and picks; every team's best offer, the most value back first
//   FIND A PLAYER  pick a position (and, if he likes, a rating, an age, a salary); who can be had and what he costs
// Everything listed is a deal the other team takes, legal under the salary-matching rules: ACCEPT makes it, EDIT opens
// it in the trade screen.
const PAGE = 5
export const newFinder = tab => ({ tab, ga: [], pa: [], pick: false, kind: 'all', q: { pos: null, o: 0, a: 0, m: 0 }, n: PAGE, done: null })
const OVRS = [[0, 'ANY'], [75, '75+'], [80, '80+'], [85, '85+'], [90, '90+']]
const AGES = [[0, 'ANY'], [1, '25 & UNDER'], [2, '26-29'], [3, '30+']]
const PAYS = [[0, 'ANY'], [10, 'UNDER $10M'], [20, 'UNDER $20M'], [35, 'UNDER $35M']]
const AGE_Q = { 1: { ageMax: 25 }, 2: { ageMin: 26, ageMax: 29 }, 3: { ageMin: 30 } }
const POS_NAME = { PG: 'point guard', SG: 'shooting guard', SF: 'small forward', PF: 'power forward', C: 'center' }
const queryOf = q => ({ pos: q.pos, ...(q.o && { minO: q.o }), ...(AGE_Q[q.a] ?? null), ...(q.m && { max$: q.m }) })
const nick = s => TEAM[s]?.nick ?? s
const pkI = e => (typeof e === 'number' ? e : e?.i ?? null)
const entryText = (F, e) => { const k = F.picks?.[pkI(e)]; return k ? pickText(F, e?.top ? { ...k, pr: { top: e.top } } : k) : '' }
const dealLine = p => (p.y > 0 ? `${money(p.$)} · ${p.y} ${p.y === 1 ? 'YR' : 'YRS'}` : 'DEAL UP')
// (why a man can't go, short enough for his bar)
const lockLine = w => { const d = w.match(/until (\w+) (\d+)/); return d ? `NOT TRADABLE UNTIL ${d[1].slice(0, 3).toUpperCase()} ${d[2]}` : /no-trade/.test(w) ? 'NO-TRADE CLAUSE' : /own build/.test(w) ? 'FRANCHISE BUILD' : 'NOT TRADABLE NOW' }
const toTop = () => { try { const b = document.querySelector('.fh-scroll'); if (b) requestAnimationFrame(() => b.scrollTo({ top: 0 })) } catch { /* (no scroll box) */ } }
const leanShort = (F, s, lean) => (Math.abs(lean) < 0.08 ? 'EVEN' : `${TEAM[lean > 0 ? F.team : s].short} ${Math.abs(lean) >= 0.35 ? 'WIN BIG' : 'AHEAD'}`)

export default function NbaFinder({ F, act, st, set, onOpen, onMan }) {
  const up = x => set(s => ({ ...s, ...x }))
  // a deal made from the list: the wire's line on top, the list read again from the roster as it is now
  const make = d => {
    const r = act(X => CAP_SIM.proposeTrade(X, d))
    for (const x of r?.news ?? []) addNews(F, x)
    up({ done: r?.ok ? { ok: 1, text: `The ${nick(d.b)} accept. The deal is done.`, line: r.line } : { ok: 0, text: r?.text ?? 'The deal is off the table.' }, ...(r?.ok && st.tab === 'shop' && { ga: [], pa: [], pick: false }), n: PAGE })
    sfx(r?.ok ? 'claim' : 'deny'); haptic(r?.ok ? 'success' : 'medium'); toTop()
  }
  return (
    <>
      <div className="nb-by nb-tf-seg" role="tablist">
        {[['shop', 'Shop a player'], ['find', 'Find a player']].map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={st.tab === k} className={st.tab === k ? 'is-on' : ''} onClick={() => { up({ tab: k, n: PAGE, done: null }); sfx('tap') }}>{label}</button>)}
      </div>
      {st.done && (
        <div className={`tr-said${st.done.ok ? ' is-yes' : ' is-no'}`} role="status">
          <Stamp kind={st.done.ok ? 'w' : 'l'}>{st.done.ok ? 'DONE' : 'NO DEAL'}</Stamp>
          <span><b>{teamWords(st.done.text)}</b>{st.done.line && <small>{teamWords(st.done.line)}</small>}</span>
        </div>
      )}
      {st.tab === 'shop' ? <Shop F={F} st={st} up={up} make={make} onOpen={onOpen} onMan={onMan} /> : <Find F={F} st={st} up={up} make={make} onOpen={onOpen} onMan={onMan} />}
    </>
  )
}

// ── SHOP A PLAYER ────────────────────────────────────────────────────────────
function Shop({ F, st, up, make, onOpen, onMan }) {
  const year = CAP_SIM.capYear(F)
  const men = F.teams[F.team].r.filter(p => p.b == null).sort((x, y) => (x.tw ? 1 : 0) - (y.tw ? 1 : 0) || y.o - x.o)
  const picks = tradePicks(F, F.team)
  // (a man who's gone since he was picked comes off the block)
  const ga = st.ga.filter(id => men.some(p => p.i === id)), pa = st.pa.filter(i => picks.some(k => k.i === i))
  const n = ga.length + pa.length
  const key = `${ga.join(',')}|${pa.join(',')}`
  const R = useMemo(() => (n ? shopOffers(F, { ga, pa }) : null), [F, key]) // eslint-disable-line react-hooks/exhaustive-deps
  const picking = st.pick || !n
  const tap = (k, v) => {
    const arr = k === 'ga' ? ga : pa, on = arr.includes(v)
    if (!on && n >= TRADE_MAX_SIDE) { sfx('deny'); return }
    up({ [k]: on ? arr.filter(x => x !== v) : [...arr, v], done: null, n: PAGE }); sfx('tap'); if (!st.pick) toTop()
  }
  const kinds = R ? new Set(R.list.map(o => o.k)) : new Set()
  const list = R ? R.list.filter(o => st.kind === 'all' || o.k === st.kind) : []
  return (
    <>
      <section className="tf-block" style={fkVars(F.team)}>
        <h3 className="tf-h"><b>On the block</b>{n > 0 && <button type="button" className="fd-link" onClick={() => { up({ pick: !st.pick }); sfx('tap'); toTop() }}>{picking ? 'Done' : 'Add or change'}</button>}</h3>
        {!n && <p className="tr-hint">Pick a player or a pick to shop.</p>}
        {ga.map(id => { const p = men.find(x => x.i === id); return <span key={id} className="tr-a"><i>{p.p}</i><b>{p.n}</b><em>{p.o}</em><button type="button" aria-label={`Take ${p.n} off the block`} onClick={() => tap('ga', id)}>×</button></span> })}
        {pa.map(i => <span key={i} className="tr-a is-pk"><i>PICK</i><b>{entryText(F, i)}</b><button type="button" aria-label="Take the pick off the block" onClick={() => tap('pa', i)}>×</button></span>)}
      </section>
      {picking ? (
        <>
          <h3 className="tr-list-h">Players</h3>
          <div className="tr-list">
            {men.filter(p => !p.tw).map(p => {
              const on = ga.includes(p.i), why = CAP_SIM.whyNot(F, F.team, p)
              return (
                <div key={p.i} className={`tr-pick-man${on ? ' is-on' : ''}${why ? ' is-off' : ''}`}>
                  <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" line={why ? lockLine(why) : `AGE ${p.ag} · ${dealLine(p)}`} onClick={why ? undefined : () => tap('ga', p.i)} />
                  {on && <span className="tr-check" aria-label="On the block">✓</span>}
                </div>
              )
            })}
          </div>
          <h3 className="tr-list-h">Draft picks</h3>
          <div className="tr-picks">
            {picks.map(k => (
              <button key={k.i} type="button" className={`tr-pk${pa.includes(k.i) ? ' is-on' : ''}`} onClick={() => tap('pa', k.i)} aria-pressed={pa.includes(k.i)}>
                <b>{k.y} · RD {k.r}</b><small>{k.o !== F.team ? `FROM ${k.o}` : k.n ? `NO. ${k.n}` : 'OWN PICK'}</small>
              </button>
            ))}
            {!picks.length && <p className="tr-hint">No picks left to trade</p>}
          </div>
          {n > 0 && <ActionBar><Go onClick={() => { up({ pick: false }); sfx('tap'); toTop() }} sub={`${n} ON THE BLOCK`}>See the offers</Go></ActionBar>}
        </>
      ) : R && !R.open ? <p className="tr-shut">{teamWords(R.why)}</p> : R && (
        <>
          <Chyron tone="ink" size="s" title="OFFERS" right={R.list.length ? `${R.list.length}` : null} />
          {kinds.size > 1 && (
            <div className="tf-opt" role="radiogroup" aria-label="What comes back">
              <span>GET</span>
              {[['all', 'ANY'], ['picks', 'PICKS'], ['player', 'PLAYERS']].map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={st.kind === k} className={st.kind === k ? 'is-on' : ''} onClick={() => { up({ kind: k, n: PAGE }); sfx('tap') }}>{l}</button>)}
            </div>
          )}
          {R.line && <p className="tr-shut">{teamWords(R.line)}</p>}
          {list.slice(0, st.n).map(o => <Found key={`${o.s}-${o.k}`} F={F} d={o.deal} g={o.g} sit={o.sit} make={make} onOpen={onOpen} onMan={onMan} year={year} />)}
          {list.length > st.n && <More left={list.length - st.n} onClick={() => up({ n: st.n + PAGE })} />}
        </>
      )}
    </>
  )
}

// ── FIND A PLAYER ────────────────────────────────────────────────────────────
function Find({ F, st, up, make, onOpen, onMan }) {
  const q = st.q, year = CAP_SIM.capYear(F)
  const R = useMemo(() => (q.pos ? findDeals(F, queryOf(q)) : null), [F, q.pos, q.o, q.a, q.m]) // eslint-disable-line react-hooks/exhaustive-deps
  const setQ = x => { up({ q: { ...q, ...x }, n: PAGE, done: null }); sfx('tap') }
  const filters = [q.o ? `${q.o}+` : null, q.a ? AGES[q.a][1] : null, q.m ? PAYS.find(x => x[0] === q.m)[1] : null].filter(Boolean)
  const row = (name, opts, k) => (
    <div className="tf-opt" role="radiogroup" aria-label={name}>
      <span>{name}</span>
      {opts.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={q[k] === v} className={q[k] === v ? 'is-on' : ''} onClick={() => setQ({ [k]: v })}>{l}</button>)}
    </div>
  )
  return (
    <>
      <div className="tf-opt nb-tf-pos" role="radiogroup" aria-label="Position">
        {FIND_POS.map(p => <button key={p} type="button" role="radio" aria-checked={q.pos === p} className={q.pos === p ? 'is-on' : ''} onClick={() => setQ({ pos: p })}>{p}</button>)}
      </div>
      <Fold title="Filters" right={filters.length ? filters.join(' · ') : 'ANY RATING, AGE, SALARY'} className="tf-fold">
        {row('OVR', OVRS, 'o')}
        {row('AGE', AGES, 'a')}
        {row('SALARY', PAYS, 'm')}
      </Fold>
      {!q.pos && <p className="tr-shut">Pick a position.</p>}
      {R && !R.open && <p className="tr-shut">{teamWords(R.why)}</p>}
      {R && R.open && (
        <>
          <Chyron tone="ink" size="s" title="AVAILABLE" right={R.list.length || null} />
          {!R.list.length && <p className="tr-shut">{R.total ? `No ${POS_NAME[q.pos]} who fits can be had right now.` : `No ${POS_NAME[q.pos]} around the league fits those filters.`}</p>}
          {R.list.slice(0, st.n).map(r => <Found key={r.p.i} F={F} d={r.deal} g={r.g} sit={r.sit} man={r.p} make={make} onOpen={onOpen} onMan={onMan} year={year} />)}
          {R.list.length > st.n && <More left={R.list.length - st.n} onClick={() => up({ n: st.n + PAGE })} />}
          {R.no.length > 0 && (
            <Fold key={`${q.pos}-${R.list.length ? 1 : 0}`} title="Not available" right={R.no.length} open={!R.list.length} className="tf-fold">
              {R.no.slice(0, 8).map(r => (
                <div key={r.p.i} className="tf-no" style={fkVars(r.s)}>
                  <LowerThird name={r.p.n} pos={r.p.p} num={r.p.num} ovr={r.p.o} photo={manPhoto(F, r.p)} team={r.s} size="s" line={`${nick(r.s).toUpperCase()} · AGE ${r.p.ag}`} onClick={() => onMan(r.p.i)} />
                  <p>{teamWords(r.text)}</p>
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

function More({ left, onClick }) {
  return <div className="nb-by nb-tf-more"><button type="button" onClick={() => { onClick(); sfx('tap') }}>{`Show ${Math.min(PAGE, left)} more · ${left} left`}</button></div>
}

// ── One deal the finder found ────────────────────────────────────────────────
// man: FIND's row (the man and what he costs); else SHOP's (the team and what it sends back)
function Found({ F, d, g, sit, man = null, make, onOpen, onMan, year }) {
  const s = d.b
  const theirs = d.gb.map(id => F.teams[s].r.find(p => p.i === id)).filter(Boolean)
  const mine = d.ga.map(id => F.teams[F.team].r.find(p => p.i === id)).filter(Boolean)
  const pk = list => list.length > 0 && <div className="tf-pks">{list.map(e => <span key={JSON.stringify(e)} className="tf-pk"><b>{entryText(F, e)}</b></span>)}</div>
  const hit = p => hitOf(p, year, year)
  const pay = CAP_SIM.capSheet(F, F.team).pay - mine.reduce((a, p) => a + hit(p), 0) + theirs.reduce((a, p) => a + hit(p), 0)
  const cut = CAP_SIM.checkTrade(F, d).cut ?? []
  return (
    <section className="tf-deal" style={fkVars(s)}>
      <header className="tr-offer-h">
        <KLogo s={s} size={36} />
        <span><small>{CAP_SIM.SIT_TEXT[sit]}</small><b>{TEAM[s].name}</b></span>
        {man && <em className="tf-deal-r">{dealLine(man)}</em>}
      </header>
      {man ? (
        <>
          <LowerThird name={man.n} pos={man.p} num={man.num} ovr={man.o} photo={manPhoto(F, man)} team={s} line={`AGE ${man.ag}`} onClick={() => onMan(man.i)} />
          <div className="tf-cost">
            <small>THE {nick(F.team).toUpperCase()} SEND</small>
            {mine.map(p => <span key={p.i} className="tr-a"><i>{p.p}</i><b>{p.n}</b><em>{p.o}</em></span>)}
            {pk(d.pa)}
          </div>
        </>
      ) : (
        <div className="tf-cost">
          {theirs.map(p => <LowerThird key={p.i} name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={s} size="s" line={`AGE ${p.ag} · ${dealLine(p)}`} onClick={() => onMan(p.i)} />)}
          {pk(d.pb)}
        </div>
      )}
      {/* the deal in numbers: who wins it by the league's values, the GM's payroll after it, a waiver it forces */}
      <div className="tf-nums">
        <span className={Math.abs(g.lean) < 0.08 ? 'is-even' : ''}><small>VALUE</small><b>{leanShort(F, s, g.lean)}</b></span>
        {!F.noCap && <span><small>PAYROLL AFTER</small><b>{money(pay)}</b></span>}
        {cut.length > 0 && <span className="tf-cut"><small>ROSTER SPOT</small><b>{cut.map(x => `${nick(x.s)} waive ${x.n}`).join(' · ')}</b></span>}
      </div>
      <div className="tr-acts tr-acts--2">
        <Go onClick={() => make(d)}>{man ? 'Make the trade' : 'Accept'}</Go>
        <Go ghost onClick={() => onOpen(d)}>Edit</Go>
      </div>
    </section>
  )
}
