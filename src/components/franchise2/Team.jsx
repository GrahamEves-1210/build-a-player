import { useState } from 'react'
import { createPortal } from 'react-dom'
import { SLOTS, lineup, payroll, POS_LABEL, gradeOf } from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconSwap } from '../app/icons'
import { Face, Ovr, nameOn, Count } from './bits'

// TEAM: who starts. One row a man: his spot, his face, his name, one big OVR. Tap a starter to put someone else
// in (the men at his position on the bench); the budget on top.
const UNITS = [['OFFENSE', SLOTS.filter(([, pos]) => ['qb', 'rb', 'wr', 'te', 'ol'].includes(pos))], ['DEFENSE', SLOTS.filter(([, pos]) => ['dl', 'lb', 'db'].includes(pos))]]
const slotTag = (k, p) => (k.startsWith('ol') ? (p?.s && p.s.length <= 2 ? p.s : 'OL') : k.replace(/\d$/, '').toUpperCase())

export default function TeamTab({ F, act, owner }) {
  const t = F.teams[F.team]
  const L = lineup(t)
  const [swap, setSwap] = useState(null)
  const pay = payroll(t.r)
  const room = Math.round((F.budget - pay) * 10) / 10
  const bench = t.r.filter(p => !Object.values(L).includes(p))
  return (
    <>
      <section className="f2-budget ag-pop">
        <span className="f2-budget-top"><small>BUDGET</small><b>${Math.round(pay)}M <i>/ ${Math.round(F.budget)}M</i></b></span>
        <span className="f2-budget-bar"><i style={{ transform: `scaleX(${Math.min(1, pay / F.budget)})` }} className={room < 0 ? 'is-over' : ''} /></span>
        <small className={`f2-budget-room${room < 0 ? ' is-over' : ''}`}>{room < 0 ? `$${-room}M OVER` : `$${room}M ROOM`}</small>
      </section>
      {UNITS.map(([unit, slots], u) => (
        <section key={unit} className="f2-unit ag-pop" style={{ '--d': `${40 + u * 50}ms` }}>
          <span className="ag-eyebrow">{unit}</span>
          {slots.map(([k, pos]) => {
            const p = L[k]
            return (
              <button key={k} className={`f2-row${p?.b != null ? ' is-mine' : ''}`} onClick={() => { setSwap({ k, pos }); sfx('tap') }} disabled={!p}>
                <span className="f2-row-slot">{slotTag(k, p)}</span>
                {p ? <Face F={F} p={p} size={40} /> : <span className="f2-face is-empty" style={{ width: 40, height: 40 }} />}
                <span className="f2-row-name"><b>{p ? nameOn(p) : 'OPEN'}{p?.b != null && <i className="f2-star">★</i>}</b><small>{p ? `${p.b != null ? owner.toUpperCase() : `AGE ${p.ag}`}${p.rk === F.year ? ' · ROOKIE' : ''}` : ''}</small></span>
                {p && <Ovr o={p.o} size="s" />}
              </button>
            )
          })}
        </section>
      ))}
      <section className="f2-unit ag-pop" style={{ '--d': '140ms' }}>
        <span className="ag-eyebrow">BENCH · {bench.length}</span>
        <div className="f2-bench">
          {bench.sort((a, b) => b.o - a.o).map(p => (
            <span key={p.i} className={`f2-bench-man${p.in ? ' is-hurt' : ''}`}>
              <Face F={F} p={p} size={34} />
              <b>{p.o}</b>
              <small>{POS_LABEL[p.p]}{p.in ? ' · OUT' : ''}</small>
            </span>
          ))}
        </div>
      </section>
      {swap && <SwapSheet F={F} act={act} slot={swap} L={L} onClose={() => setSwap(null)} />}
    </>
  )
}

function SwapSheet({ F, act, slot, L, onClose }) {
  const t = F.teams[F.team]
  const cur = L[slot.k]
  const options = t.r.filter(p => p.p === slot.pos && p !== cur && !p.in).sort((a, b) => b.o - a.o)
  const pick = p => {
    act(X => {
      const T = X.teams[X.team]
      T.lk = { ...(T.lk ?? {}) }
      // (if he started somewhere else, the man he replaces takes that spot)
      const was = Object.entries(L).find(([, q]) => q === p)?.[0]
      T.lk[slot.k] = p.i
      if (was && cur) T.lk[was] = cur.i
    })
    sfx('swap'); haptic('light'); onClose()
  }
  return createPortal(
    <div className="f2-sheet-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="f2-sheet ag-pop" role="dialog" aria-modal="true">
        <div className="f2-sheet-head"><span className="ag-eyebrow">{slot.k.replace(/\d$/, '').toUpperCase()} · SWAP</span><button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={14} /></button></div>
        {cur && <div className="f2-row is-cur"><span className="f2-row-slot">NOW</span><Face F={F} p={cur} size={40} /><span className="f2-row-name"><b>{nameOn(cur)}</b><small>{gradeOf(cur.o)}</small></span><Ovr o={cur.o} size="s" /></div>}
        {options.length ? options.map(p => (
          <button key={p.i} className="f2-row" onClick={() => pick(p)}>
            <IconSwap size={14} className="f2-row-slot" />
            <Face F={F} p={p} size={40} />
            <span className="f2-row-name"><b>{nameOn(p)}</b><small>{Object.values(L).includes(p) ? 'STARTS ELSEWHERE' : `AGE ${p.ag}`}</small></span>
            <Ovr o={p.o} size="s" />
          </button>
        )) : <p className="f2-hint">NOBODY ELSE AT THIS SPOT</p>}
      </div>
    </div>,
    document.body,
  )
}
export { Count }
