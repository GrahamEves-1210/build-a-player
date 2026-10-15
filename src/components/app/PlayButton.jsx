import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { guardLeave } from '../../lib/liveLock'
import { sfx, haptic } from '../../lib/juice'
import { switchSport } from './AppHome'
import { IconPlay, IconHome, IconBolt, IconCrown, IconTrophy, IconTarget, IconCalendar, IconHoop, IconFootball, IconBasketball } from './icons'

// The dock's centre button.
//   Home (and the profile, leaderboards): PLAY. On Home a tap opens the modes (it
//     never drops you straight into a game); elsewhere it takes you Home.
//   Inside a game mode: HOME, and a tap takes you there (the build waits).
//   Hold it anywhere: the modes fan out above it (and the other sport); tap one,
//     or slide onto one and let go. A live game still asks before it lets you out.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
// the pages that aren't a game mode
const NOT_A_MODE = new Set(['splash', 'profile', 'leaderboard', 'pvp-leaderboard', 'about', 'wiki'])
const HOLD_MS = 380

const fanFor = sport => [
  { id: 'current', label: 'CURRENT', Icon: IconBolt, go: () => nav('mode:classic') },
  { id: 'alltime', label: 'ALL-TIME', Icon: IconCrown, go: () => nav('mode:all-time') },
  { id: 'career', label: 'CAREER', Icon: IconTrophy, go: () => nav('career') },
  sport === 'bucket'
    ? { id: 'blacktop', label: 'BLACKTOP', Icon: IconHoop, go: () => nav('blacktop') }
    : { id: 'takeover', label: 'TAKEOVER', Icon: IconTarget, go: () => nav('takeover') },
  { id: 'daily', label: 'DAILY', Icon: IconCalendar, go: () => nav('daily') },
  sport === 'bucket'
    ? { id: 'sport', label: 'FOOTBALL', Icon: IconFootball, sport: true, go: () => switchSport('nfl') }
    : { id: 'sport', label: 'BASKETBALL', Icon: IconBasketball, sport: true, go: () => switchSport('bucket') },
]

export default function PlayButton({ page, sport, onTap, lit, tapOpensFan = false }) {
  const inMode = !NOT_A_MODE.has(page)
  const [fan, setFan] = useState(false)
  const [hot, setHot] = useState(null)
  const timer = useRef(0)
  const opened = useRef(false)
  const items = fanFor(sport)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { setFan(false) }, [page, sport])
  // while it's open the dock sits above the dimmed page (the button stays in reach)
  useEffect(() => { document.documentElement.classList.toggle('ag-fan-open', fan) }, [fan])

  const pick = item => {
    setFan(false); setHot(null)
    sfx(item.sport ? 'swap' : 'tap'); haptic('light')
    if (item.sport) item.go()            // switching sports is fine mid-game: the build waits
    else guardLeave(() => item.go())
  }
  // which mode is under the finger (the fan items sit above everything while it's open)
  const itemAt = (x, y) => document.elementsFromPoint(x, y).find(el => el.closest?.('.ag-fan-item'))?.closest('.ag-fan-item').dataset.id ?? null

  const down = e => {
    if (e.button > 0) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}   // a mouse keeps reporting to the button while it slides
    opened.current = false
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { opened.current = true; setFan(true); haptic('medium'); sfx('tap') }, HOLD_MS)
  }
  const move = e => { if (opened.current) setHot(itemAt(e.clientX, e.clientY)) }
  const up = e => {
    clearTimeout(timer.current)
    if (opened.current) {
      // slid onto a mode and let go: that's the pick; let go on the button: the fan stays open
      const id = itemAt(e.clientX, e.clientY)
      const item = id && items.find(i => i.id === id)
      if (item) pick(item)
      setHot(null)
      return
    }
    if (fan) { setFan(false); return }
    if (tapOpensFan) { setFan(true); haptic('light'); sfx('tap'); return }
    onTap(inMode)
  }
  const cancel = () => { clearTimeout(timer.current) }

  return (
    <>
      {fan && createPortal(<div className="ag-fan-back" onPointerDown={() => setFan(false)} />, document.body)}
      {fan && createPortal(
        <div className="ag-fan" role="menu" aria-label="Modes">
          {items.map((it, i) => (
            <button key={it.id} data-id={it.id} role="menuitem" className={`ag-fan-item${hot === it.id ? ' is-hot' : ''}${it.sport ? ' is-sport' : ''}`}
              style={{ '--i': i, '--n': items.length }} onClick={() => pick(it)}>
              <span className="ag-fan-dot"><it.Icon size={22} /></span>
              <span className="ag-fan-lbl">{it.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
      <button className={`ag-play${lit ? ' ag-play--on' : ''}${inMode ? ' is-home' : ''}${fan ? ' is-fan' : ''}`}
        aria-label={inMode ? 'Home (hold for modes)' : 'Play (hold for modes)'} aria-haspopup="menu" aria-expanded={fan}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onPointerLeave={e => { if (!opened.current && e.pointerType === 'mouse') cancel() }}
        onContextMenu={e => { e.preventDefault(); if (!fan) { opened.current = true; setFan(true) } }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (tapOpensFan) setFan(true); else onTap(inMode) } else if (e.key === 'ArrowUp') { e.preventDefault(); setFan(true) } else if (e.key === 'Escape') setFan(false) }}>
        <span className="ag-play-core">
          <span className="ag-play-glyph is-play"><IconPlay size={26} /></span>
          <span className="ag-play-glyph is-home"><IconHome size={24} /></span>
        </span>
        <span className="ag-play-label">{inMode ? 'HOME' : 'PLAY'}</span>
      </button>
    </>
  )
}
