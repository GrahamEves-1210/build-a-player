import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, POS, POS_LABEL, GRADES, gradeIdx, rangeOf, rangeText, tagText, noteOf, scout, star, cpuPicks, userPick, autoPick, pickTeam, draftDone, newSeason, ROUNDS_N } from '../../lib/franchise2'
import { CFB_TEAM_BY_SHORT } from '../../data/cfb-teams'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconArrow, IconStar } from '../app/icons'
import { Face, Logo, Stamp, teamVars } from './bits'

// THE DRAFT: a class of made-up college players. Every man shows the scouts' grade RANGE; a scout point narrows
// it, a second shows his true grade and what he is (GEM, BUST RISK, SOLID). Star the ones to watch. On draft day
// the league picks off the board, worst record first; on the player's pick, take someone (or AUTO).
const mid = x => { const [a, b] = rangeOf(x); return (a + b) / 2 }
const height = h => `${Math.floor(h / 12)}'${h % 12}"`
const sandboxOn = () => { try { return localStorage.getItem('bap_custom_mode') === '1' } catch { return false } }

function useBoard(F, filter) {
  return useMemo(() => {
    let list = [...F.dc].sort((a, b) => (F.board.includes(b.i) - F.board.includes(a.i)) || mid(b) - mid(a) || b.i - a.i)
    if (filter === 'star') list = list.filter(x => F.board.includes(x.i))
    else if (filter !== 'all') list = list.filter(x => x.p === filter)
    return list.slice(0, 80)
  }, [F, F.dc.length, F.board.length, F.sp, filter]) // eslint-disable-line react-hooks/exhaustive-deps
}
function Filters({ filter, setFilter }) {
  return (
    <div className="f2-filters" role="tablist">
      {[['all', 'ALL'], ['star', '★'], ...POS.map(p => [p, POS_LABEL[p]])].map(([k, n]) => (
        <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => { setFilter(k); sfx('tap') }}>{n}</button>
      ))}
    </div>
  )
}
// One prospect: his face (his college's logo), name, spot, the range; tap for the rest
function Prospect({ F, act, x, open, onOpen, onPick }) {
  const starred = F.board.includes(x.i)
  const [a, b] = rangeOf(x)
  const col = CFB_TEAM_BY_SHORT[x.col]
  return (
    <div className={`f2-pros${open ? ' is-open' : ''}${x.sc >= 2 ? ` is-${x.tag}` : ''}`}>
      <button className="f2-pros-row" onClick={() => { onOpen(open ? null : x.i); sfx('tap') }}>
        <Face name={x.n} col={x.col} size={38} />
        <span className="f2-row-name"><b>{x.n}</b><small>{POS_LABEL[x.p]}{x.s && x.s.length > 2 ? '' : x.s ? ` · ${x.s.toUpperCase()}` : ''} · {col?.school?.toUpperCase() ?? (x.b != null ? 'SANDBOX' : '')}</small></span>
        <span className={`f2-range${a === b ? ' is-known' : ''}`}>{a === b ? GRADES[a] : <>{GRADES[a]}<i>–</i>{GRADES[b]}</>}</span>
      </button>
      <button className={`f2-pros-star${starred ? ' is-on' : ''}`} onClick={() => { act(X => star(X, x.i)); sfx('slot') }} aria-label={starred ? 'Off the board' : 'On the board'}><IconStar size={16} /></button>
      {open && (
        <div className="f2-pros-more">
          <span className="f2-pros-facts"><b>{height(x.ht)}</b><small>HT</small></span>
          <span className="f2-pros-facts"><b>{x.wt}</b><small>LBS</small></span>
          <span className="f2-pros-facts"><b>{x.ft.toFixed(2)}</b><small>40</small></span>
          <p className="f2-pros-note">{noteOf(x)}</p>
          {x.sc >= 2 ? <Stamp kind={x.tag === 'G' ? 'gem' : x.tag === 'B' ? 'bust' : 'solid'}>{tagText[x.tag]}</Stamp>
            : <button className="ag-btn ag-btn--ghost f2-scout-btn" disabled={F.sp < 1} onClick={() => { act(X => scout(X, x.i)); sfx('flip'); haptic('light') }}>{x.sc ? 'SCOUT AGAIN · REVEAL' : 'SCOUT HIM'} · 1 PT</button>}
          {onPick && <button className="ag-btn ag-btn--gold f2-pick-btn" onClick={() => onPick(x)}>DRAFT HIM <IconArrow size={14} /></button>}
        </div>
      )}
    </div>
  )
}

// The board, during the season (a sheet over the hub)
export default function DraftBoard({ F, act, onClose }) {
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const list = useBoard(F, filter)
  return createPortal(
    <div className="ag-screen cr--team f2 f2-boardscreen" style={teamVars(F.team)}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{F.year + 1} DRAFT CLASS</span><h1 className="ag-h1">BIG BOARD</h1></div>
        <span className="f2-scout-pts is-head"><b>{F.sp}</b><small>SCOUT PTS</small></span>
        <button className="ag-round-btn" onClick={() => { onClose(); sfx('tap') }} aria-label="Close"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <Filters filter={filter} setFilter={setFilter} />
        <section className="f2-board">
          {list.map(x => <Prospect key={x.i} F={F} act={act} x={x} open={open === x.i} onOpen={setOpen} />)}
          {!list.length && <p className="f2-hint">{filter === 'star' ? 'STAR A PROSPECT TO TRACK HIM' : 'NOBODY HERE'}</p>}
        </section>
      </div>
    </div>,
    document.body,
  )
}

// ── Draft day ────────────────────────────────────────────────────────────────
export function DraftDay({ F, act, owner, onBuild }) {
  // the league's picks since the player's last one, shown one at a time (read from the draft itself)
  const lastMine = F.dr.picks.map(p => p.s).lastIndexOf(F.team)
  const ticker = F.dr.picks.slice(lastMine + 1)
  const [shownN, setShownN] = useState(0)
  const [reveal, setReveal] = useState(null)   // the player's pick, its card
  const [pickF, setFilter] = useState('star')
  // (the board's starred men all gone: the whole class)
  const filter = pickF === 'star' && !F.board.some(id => F.dc.some(x => x.i === id)) ? 'all' : pickF
  const [open, setOpen] = useState(null)
  const [addPos, setAddPos] = useState(false)
  const list = useBoard(F, filter)
  const done = draftDone(F)
  const myTurn = !done && pickTeam(F) === F.team
  const ticking = shownN < ticker.length
  const T = useRef(0)
  useEffect(() => {
    if (!ticking) return
    T.current = setTimeout(() => { setShownN(n => n + 1); sfx('tick') }, shownN === 0 ? 150 : 110)
    return () => clearTimeout(T.current)
  }, [ticking, shownN])
  const simToMe = () => { act(X => cpuPicks(X)); setShownN(0); setReveal(null); sfx('flip') }
  const take = x => { const pk = act(X => userPick(X, x.i)); if (pk) { setReveal(pk); setOpen(null); sfx('card', 2); haptic('success') } }
  const auto = () => { const pk = act(X => autoPick(X)); if (pk) { setReveal(pk); sfx('card', 2) } }
  const mine = F.dr.picks.filter(p => p.s === F.team)
  const no = F.dr.at + 1, round = Math.floor(F.dr.at / 32) + 1
  // (the draft opens straight onto the league's picks before the player's first)
  useEffect(() => { if (!done && !myTurn) simToMe() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (done && !reveal && !ticking) return (
    <>
      <section className="f2-unit ag-pop">
        <span className="ag-eyebrow">{owner.toUpperCase()}'S CLASS</span>
        {mine.map((p, i) => <ClassCard key={p.pid} F={F} p={p} delay={i * 450} />)}
        {!mine.length && <p className="f2-hint">NO PICKS THIS YEAR</p>}
      </section>
      <button className="ag-btn ag-btn--gold f2-go" onClick={() => { act(X => newSeason(X)); sfx('whistle'); haptic('medium') }}>START {F.year + 1} <IconArrow size={16} /></button>
    </>
  )
  return (
    <>
      {(ticking || ticker.length > 0) && !reveal && (
        <section className="f2-ticker ag-pop">
          <span className="ag-eyebrow">THE PICKS</span>
          {ticker.slice(Math.max(0, shownN - 5), shownN).reverse().map(p => (
            <div key={p.at} className="f2-tick" style={teamVars(p.s)}>
              <i>{p.at + 1}</i><Logo s={p.s} size={26} /><b>{p.n}</b><small>{POS_LABEL[p.p]}</small><span className="f2-range is-sm">{GRADES[p.c] ?? ''}</span>
            </div>
          ))}
          {ticking && <button className="f2-ghost" onClick={() => setShownN(ticker.length)}>SKIP</button>}
        </section>
      )}
      {reveal && <RevealCard F={F} p={reveal} onNext={() => { setReveal(null); if (!draftDone(F)) simToMe() }} />}
      {!reveal && !ticking && myTurn && (
        <>
          <section className="f2-clock ag-pop" style={teamVars(F.team)}>
            <span className="ag-eyebrow">ON THE CLOCK</span>
            <b>ROUND {round} · PICK {no}</b>
            <div className="f2-two">
              <button className="ag-btn ag-btn--ghost" onClick={auto}>AUTO PICK</button>
              {sandboxOn() && <button className="ag-btn ag-btn--ghost" onClick={() => { setAddPos(!addPos); sfx('tap') }}>ADD A PROSPECT</button>}
            </div>
            {addPos && <div className="f2-filters">{POS.map(p => <button key={p} onClick={() => onBuild({ id: 'prospect', pos: p, n: 1, of: 1 })}>{POS_LABEL[p]}</button>)}</div>}
          </section>
          <Filters filter={filter} setFilter={setFilter} />
          <section className="f2-board">
            {list.map(x => <Prospect key={x.i} F={F} act={act} x={x} open={open === x.i} onOpen={setOpen} onPick={take} />)}
            {!list.length && <p className="f2-hint">{filter === 'star' ? 'NOBODY STARRED IS LEFT' : 'NOBODY HERE'}</p>}
          </section>
        </>
      )}
      {!reveal && !ticking && !myTurn && !done && <button className="ag-btn ag-btn--gold f2-go" onClick={simToMe}>TO THE NEXT PICK <IconArrow size={16} /></button>}
    </>
  )
}
// the player's pick, turned over: the true grade and what he really is
function RevealCard({ F, p, onNext }) {
  const [flip, setFlip] = useState(false)
  useEffect(() => { const t = setTimeout(() => { setFlip(true); sfx('flip') }, 500); return () => clearTimeout(t) }, [])
  return (
    <section className={`f2-reveal ag-pop${flip ? ' is-flip' : ''}`} style={teamVars(F.team)}>
      <span className="ag-eyebrow">ROUND {Math.floor(p.at / 32) + 1} · PICK {p.at + 1}</span>
      <Face name={p.n} col={p.col} size={84} />
      <b className="f2-reveal-name">{p.n}</b>
      <small>{POS_LABEL[p.p]} · {CFB_TEAM_BY_SHORT[p.col]?.school?.toUpperCase() ?? ''}</small>
      {flip && <><small className="f2-reveal-was">SCOUTS SAID {GRADES[Math.max(0, p.c - (p.sc ? 0 : 1))]} – {GRADES[Math.min(GRADES.length - 1, p.c + 1)]}</small><b className="f2-reveal-grade ag-pop">{GRADES[gradeIdx(p.pk)]}</b><Stamp kind={p.tag === 'G' ? 'gem' : p.tag === 'B' ? 'bust' : 'solid'} big delay={200}>{tagText[p.tag]}</Stamp></>}
      <button className="ag-btn ag-btn--gold f2-go" onClick={onNext}>{draftDoneLabel(F)} <IconArrow size={16} /></button>
    </section>
  )
}
const draftDoneLabel = F => (draftDone(F) ? 'SEE THE CLASS' : 'NEXT PICK')
function ClassCard({ F, p, delay }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), delay); return () => clearTimeout(t) }, [delay])
  if (!on) return <div className="f2-row is-static is-wait" />
  return (
    <div className="f2-row is-static ag-pop">
      <span className="f2-row-slot">R{Math.floor(p.at / 32) + 1}</span>
      <Face name={p.n} col={p.col} size={40} />
      <span className="f2-row-name"><b>{p.n}</b><small>{POS_LABEL[p.p]} · PICK {p.at + 1}</small></span>
      <span className="f2-range is-known">{GRADES[gradeIdx(p.pk)]}</span>
      <Stamp kind={p.tag === 'G' ? 'gem' : p.tag === 'B' ? 'bust' : 'solid'}>{p.tag === 'G' ? 'GEM' : p.tag === 'B' ? 'BUST' : 'SOLID'}</Stamp>
    </div>
  )
}
export { TEAM, ROUNDS_N }
