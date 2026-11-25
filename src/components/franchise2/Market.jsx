import { useEffect, useMemo, useRef, useState } from 'react'
import { TEAM, marketRead, marketRow, marketWindow, marketMen, signStreet, groupOf, capYear, FA_DAYS } from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, Go, BackBar, ActionBar, Fact, Stamp, fkVars } from './kit'
import { Man, PlayerPage, posText } from './dparts'
import { ScoutNote, LastLine, money, yrs } from './dealbits'
import { revOf } from './perf'
import './deals.css'
import './trades.css'

// FREE AGENTS (lib/franchise2/street.js): who's available, all year. In the season and after the market's three days
// it's the street: the men still unsigned, each one a one-year deal away (signStreet). While the deals that are up
// are being settled it's a look at the market to come. Free agency's own three days are Deals.jsx (the strip goes
// there). One entry on the Team tab and one on the Season tab (MarketStrip); filter by position, sort, tap a man.
export const FA_FILTERS = [['all', 'ALL'], ['qb', 'QB'], ['rb', 'RB'], ['wr', 'WR'], ['te', 'TE'], ['ol', 'OL'], ['edge', 'EDGE'], ['dt', 'DT'], ['lb', 'LB'], ['cb', 'CB'], ['s', 'S'], ['k', 'K']]
export const FA_SORTS = [['ovr', 'OVR'], ['age', 'AGE'], ['price', 'PRICE'], ['fit', 'FIT']]
export const FIT_TEXT = { hole: 'FILLS A HOLE', start: 'WOULD START', depth: 'DEPTH' }
export const fitText = (p, fit) => `${fit.k === 'depth' && p.p === 'k' ? 'CAMP BATTLE' : FIT_TEXT[fit.k]}${fit.k === 'start' ? ` +${fit.d}` : ''}`
const PAGE = 15
const nick = s => TEAM[s]?.nick ?? s
const box = () => { try { return document.querySelector('.fh-scroll') } catch { return null } }
const toTop = (y = 0) => { const b = box(); if (b) requestAnimationFrame(() => b.scrollTo({ top: y })) }
const useWide = () => {
  const q = '(min-width: 900px)'
  const [w, setW] = useState(() => { try { return window.matchMedia(q).matches } catch { return false } })
  useEffect(() => { let m; try { m = window.matchMedia(q) } catch { return } const f = () => setW(m.matches); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f) }, [])
  return w
}

// ── The entry: a row on the Team tab and the Season tab ──────────────────────
export function MarketStrip({ F, onOpen }) {
  const W = marketWindow(F), men = W.k === 'shut' ? [] : marketMen(F)
  const best = men.reduce((a, p) => (!a || p.o > a.o ? p : a), null)
  const head = W.k === 'market' ? `Free agency · day ${F.fad} of ${FA_DAYS}` : W.k === 'next' ? `${men.length} headed for the market` : W.k === 'shut' ? 'Market closed' : men.length ? `${men.length} on the street` : 'Nobody on the street'
  const line = W.k === 'market' ? `${men.length} on the market` : W.k !== 'street' || !W.open ? W.why : best ? `Best available: ${posText(best)} ${best.n} · ${best.o}` : 'One-year deals, any week'
  return (
    <button type="button" className="fh-row tr-strip mk-strip" style={fkVars(F.team)} onClick={onOpen}>
      <span><small>Free agents</small><b>{head}</b><em>{line}</em></span>
      <i className="fh-row-go" aria-hidden="true">›</i>
    </button>
  )
}

// ── The screen ───────────────────────────────────────────────────────────────
// onMarket: free agency's three days are on (the Offseason tab has them)
export default function MarketScreen({ F, act, owner, onBack, back = 'Depth chart', onMarket }) {
  const wide = useWide()
  const rev = revOf(F)
  const [f, setF] = useState('all')
  const [sort, setSort] = useState('ovr')
  const [n, setN] = useState(PAGE)
  const [sel, setSel] = useState(null)
  const [page, setPage] = useState(null)
  const [done, setDone] = useState(null)   // the last signing: { text }
  const at = useRef(0)
  const M = useMemo(() => marketRead(F), [F, rev]) // eslint-disable-line react-hooks/exhaustive-deps
  const { W, V, men } = M
  const rows = useMemo(() => {
    const all = men.filter(p => f === 'all' || groupOf(p) === f).map(p => marketRow(F, p, V, W))
    const by = { ovr: (a, b) => b.p.o - a.p.o, age: (a, b) => a.p.ag - b.p.ag || b.p.o - a.p.o, price: (a, b) => a.ask.$ - b.ask.$ || b.p.o - a.p.o, fit: (a, b) => b.fit.v - a.fit.v || b.p.o - a.p.o }
    return all.sort(by[sort])
  }, [M, f, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const street = W.k === 'street'
  const row = sel != null ? rows.find(r => r.p.i === sel) ?? null : null
  const pick = id => { if (!street) { setPage(id); sfx('tap'); return } if (!wide) at.current = box()?.scrollTop ?? 0; setSel(id); setDone(null); sfx('tap'); if (!wide) toTop() }
  const sign = r => {
    const out = act(X => signStreet(X, r.p.i))
    if (out?.ok) { setDone({ text: out.text, cut: out.cut ?? [] }); setSel(null); sfx('claim'); haptic('success'); toTop() } else { sfx('deny'); haptic('medium') }
  }
  const year = capYear(F)
  const sub = W.k === 'shut' ? 'CLOSED' : W.k === 'next' ? `${men.length} HEADED FOR THE MARKET` : W.k === 'market' ? `DAY ${F.fad} OF ${FA_DAYS} · ${men.length} ON THE MARKET` : men.length ? `${men.length} UNSIGNED · ONE-YEAR DEALS` : 'NOBODY IS UNSIGNED'
  // a phone: the signing is its own screen; a wide screen: beside the list
  if (row && !wide) return (
    <div className="fd fk fd-narrow mk">
      <SignPanel F={F} owner={owner} row={row} onBack={() => { setSel(null); sfx('back'); toTop(at.current) }} sign={sign} setPage={setPage} />
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </div>
  )
  return (
    <div className={`fd fk mk${wide && street ? '' : ' fd-narrow'}`}>
      <BackBar label={back} title="Free agents" onBack={onBack} />
      <Chyron team={F.team} title="FREE AGENTS" tag={year} sub={sub} />
      {W.why && <p className="tr-shut">{W.why}</p>}
      {W.k === 'market' && <ActionBar><Go onClick={onMarket}>Go to free agency</Go></ActionBar>}
      {done && (
        <div className="tr-said is-yes" role="status">
          <Stamp kind="w">SIGNED</Stamp>
          <span><b>{done.text}</b>{done.cut.length > 0 && <small>{done.cut.map(p => `${posText(p)} ${p.n} released`).join(' · ')}</small>}</span>
        </div>
      )}
      {W.k !== 'shut' && W.k !== 'market' && (
        <div className={`dl-fa${wide && street ? ' is-wide' : ''}`}>
          <div className="dl-fa-list">
            <div className="dl-filter" role="radiogroup" aria-label="Position">
              {FA_FILTERS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={f === k} className={f === k ? 'is-on' : ''} onClick={() => { setF(k); setN(PAGE); sfx('tap') }}>{l}</button>)}
            </div>
            <div className="dl-sort" role="radiogroup" aria-label="Sort">
              <span>SORT</span>
              {FA_SORTS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={sort === k} className={sort === k ? 'is-on' : ''} onClick={() => { setSort(k); setN(PAGE); sfx('tap') }}>{l}</button>)}
            </div>
            {rows.length === 0 && <div className="fd-none">{men.length ? `NOBODY AT ${FA_FILTERS.find(x => x[0] === f)?.[1]}` : 'NOBODY IS UNSIGNED'}</div>}
            {rows.slice(0, n).map((r, j) => <MarketCard key={r.p.i} F={F} r={r} W={W} owner={owner} on={sel === r.p.i} delay={Math.min(j, 8) * 25} onClick={() => pick(r.p.i)} />)}
            {rows.length > n && <button type="button" className="dl-more" onClick={() => { setN(v => v + PAGE); sfx('tap') }}>SHOW {Math.min(PAGE, rows.length - n)} MORE · {rows.length - n} LEFT</button>}
          </div>
          {wide && street && (
            <div className="dl-fa-side">
              {row ? <SignPanel F={F} owner={owner} row={row} side onBack={() => setSel(null)} sign={sign} setPage={setPage} />
                : <div className="dl-pick"><b>PICK A PLAYER</b><small>{W.open ? 'TAP ONE TO SIGN HIM' : 'SIGNINGS ARE ON HOLD'}</small></div>}
            </div>
          )}
        </div>
      )}
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </div>
  )
}

// One man on the list: who he is, his price, how he fits, whether the money fits
function MarketCard({ F, r, W, owner, on, delay, onClick }) {
  const p = r.p, street = W.k === 'street'
  return (
    <div className={`dl-card${on ? ' is-on' : ''}`} style={{ '--d': `${delay}ms` }}>
      <Man F={F} p={p} s={F.team} owner={owner} size="m" line={`AGE ${p.ag}`} onClick={onClick} />
      <button type="button" className="dl-card-info" onClick={onClick} aria-label={street ? `Sign ${p.n}` : p.n}>
        <span className="dl-card-top">
          <span className="dl-ask"><small>{street ? 'SIGNS FOR' : 'WILL ASK'}</small><b>{money(r.ask.$)}</b><em>{yrs(r.ask.y)}</em></span>
          <span className={`dl-fit is-${r.fit.k}`}>{fitText(p, r.fit)}</span>
        </span>
        <LastLine F={F} p={p} />
        <span className="dl-bid">
          <span className={`mk-can${r.can ? '' : ' is-no'}`}>{r.can ? 'FITS UNDER THE CAP' : 'NOT ENOUGH CAP ROOM'}</span>
          {street && r.cut.length > 0 && <small className="mk-cut">RELEASES {String(r.cut[0].n).split(' ').slice(-1)[0].toUpperCase()}</small>}
          {street && r.why === 'roster' && <small className="mk-cut">NO ROSTER SPOT</small>}
        </span>
      </button>
    </div>
  )
}

// The signing: his price, the cap after it, the roster spot it takes; one button
function SignPanel({ F, owner, row, side = false, onBack, sign, setPage }) {
  const p = row.p, c = row.cap
  const lastName = String(p.n).split(' ').slice(-1)[0]
  return (
    <section className={`dl-offer${side ? ' is-side' : ''}`}>
      {side ? <Chyron tone="ink" size="s" title="SIGN HIM" right={<button type="button" className="fk-x dl-x" onClick={onBack} aria-label="Close">✕</button>} /> : <BackBar label="Free agents" title="Sign a free agent" onBack={onBack} />}
      <Man F={F} p={p} s={F.team} owner={owner} size={side ? 'm' : 'l'} line={`AGE ${p.ag}`} onClick={() => setPage(p.i)} />
      <div className="dl-about"><ScoutNote p={p} /><LastLine F={F} p={p} /></div>
      <div className="dl-facts">
        <Fact v={money(row.ask.$)} label="HIS PRICE" size={26} />
        <Fact v="1" label="YEAR" size={26} />
        <Fact v={fitText(p, row.fit)} label={`ON THE ${nick(F.team).toUpperCase()}`} size={26} />
      </div>
      {c && (
        <div className={`dl-cap${!c.nocap && c.after < 0 ? ' is-over' : ''}`}>
          {c.nocap ? <span><small>SALARY CAP</small><b>OFF</b></span> : (
            <>
              <span><small>CAP ROOM</small><b>{c.before < 0 ? `-${money(-c.before)}` : money(c.before)}</b></span>
              {c.dead > 0 && <span><small>DEAD MONEY</small><b>{money(c.dead)}</b></span>}
              <span><small>AFTER HE SIGNS</small><b>{c.after < 0 ? `-${money(-c.after)}` : money(c.after)}</b></span>
            </>
          )}
        </div>
      )}
      {row.cut.length > 0 && <p className="mk-note">{row.cut.map(x => `${posText(x)} ${x.n} (${x.o})`).join(' and ')} {row.cut.length === 1 ? 'is' : 'are'} released to make the roster spot.</p>}
      {!row.sign && <p className="mk-note is-no">{row.text}</p>}
      {side ? <div className="dl-side-go"><Go onClick={() => sign(row)} disabled={!row.sign} sub={`1 YEAR · ${money(row.ask.$)}`}>Sign {lastName}</Go></div>
        : <ActionBar><Go onClick={() => sign(row)} disabled={!row.sign} sub={`1 YEAR · ${money(row.ask.$)}`}>Sign {lastName}</Go></ActionBar>}
    </section>
  )
}
