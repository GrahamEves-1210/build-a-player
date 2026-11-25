import { useEffect, useRef } from 'react'
import { TEAM } from '../../lib/franchise2'
import { Stamp } from './kit'
import { money, posText } from './dparts'
import './trades.css'

// The parts the trade screen (Trades.jsx) and the trade finder (Finder.jsx) share.
export const nick = s => TEAM[s]?.nick ?? s
export const NONE = { pl: [], pk: [] }
export const has = (side, k, v) => (k === 'pl' ? side.pl.includes(v) : side.pk.includes(v))
export const flip = (side, k, v) => ({ ...side, [k]: has(side, k, v) ? side[k].filter(x => x !== v) : [...side[k], v] })
export const toTop = () => { try { const b = document.querySelector('.fh-scroll'); if (b) requestAnimationFrame(() => b.scrollTo({ top: 0 })) } catch { /* (no scroll box) */ } }

// the cap after it, and anyone it puts on the street
export function CapNote({ chk }) {
  const c = chk.cap
  return (
    <div className={`tr-cap${!c.nocap && c.after < 0 ? ' is-over' : ''}`}>
      {c.nocap ? <span><small>SALARY CAP</small><b>OFF</b></span> : (
        <>
          <span><small>CAP ROOM NOW</small><b>{c.before < 0 ? `-${money(-c.before)}` : money(c.before)}</b></span>
          <span><small>AFTER THE TRADE</small><b>{c.after < 0 ? `-${money(-c.after)}` : money(c.after)}</b></span>
          {c.dead > 0 && <span><small>DEAD MONEY</small><b>{money(c.dead)}</b></span>}
        </>
      )}
      {/* (the bonus left on each man who goes lands on this year's cap: why sending a big deal can cost room) */}
      {!c.nocap && c.deadBy?.length > 1 && <span className="tr-cap-cut"><small>BONUS LEFT, ON THIS YEAR'S CAP</small><b>{c.deadBy.map(x => `${String(x.p.n).split(' ').slice(-1)[0]} ${money(x.d)}`).join(' · ')}</b></span>}
      {chk.cut?.length > 0 && <span className="tr-cap-cut"><small>ROSTER SPOT</small><b>{chk.cut.map(p => `${posText(p)} ${p.n} released`).join(' · ')}</b></span>}
    </div>
  )
}
// the other team's answer
export function Said({ ok, counter = false, text, line }) {
  // (the answer comes in above the lists: on a phone the player's thumb is down at the Propose button, so the
  // screen goes up to it)
  const el = useRef(null)
  useEffect(() => { try { el.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) } catch { /* */ } }, [text])
  return (
    <div ref={el} className={`tr-said${ok ? ' is-yes' : counter ? ' is-counter' : ' is-no'}`} role="status">
      <Stamp kind={ok ? 'w' : counter ? 'ink' : 'l'}>{ok ? 'DONE' : counter ? 'COUNTER' : 'NO DEAL'}</Stamp>
      <span><b>{text}</b>{line && <small>{line}</small>}</span>
    </div>
  )
}
