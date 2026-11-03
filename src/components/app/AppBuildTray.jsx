import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgress } from '../../lib/progress'
import { getUsername } from '../../lib/discord'
// the player is their username (Guest when signed out), never "you"
const useName = () => (getUsername(useProgress().user) || 'Guest').toUpperCase()
import { whenStill } from '../../lib/userScroll'
import { valToGrade } from '../../utils/simulation'
import { IconArrow } from './icons'
import { IS_APP } from '../../lib/platform'
import { useCountUp as countUp } from '../../lib/useCountUp'
import { Scramble } from './MotionText'

// App: Spin and Build are one continuous field. The spin wheel sits on top and
// your player stands right below it (the head peeks up under the SPIN button);
// scroll down to the build, up to spin. Native scrolling, snapping to either.
//   <StackEdge>     the sticky header: your build slot by slot on the spin side,
//                   folding into a "back to spin" bar as you scroll down to the player
//   <StackSeam>     the seam between the two: "your player" under the wheel, pulses on a pick
//   useFlip         scroll position → which side you're on (+ --stack-p for the header);
//                   flip(to) glides there
//   <FlipEdge>      the old card edge (kept for the website's layout)
//   <BuildComplete> the moment the last slot fills: OVR counts up, then the build side

const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }   // rounded like the letter (valToGrade)
const FLIPS_KEY = 'ag_flips'
const flipCount = () => { try { return +localStorage.getItem(FLIPS_KEY) || 0 } catch { return 0 } }

export function FlipEdge({ side, build, types, attrMap, onFlip, waiting = null, complete = false }) {
  const name = useName()
  const filled = types.filter(t => build[t]).length
  const prev = useRef(new Set(types.filter(t => build[t])))
  const [fresh, setFresh] = useState(null)       // the slot that just filled pops
  useEffect(() => {
    const now = types.filter(t => build[t])
    const added = now.find(t => !prev.current.has(t))
    prev.current = new Set(now)
    if (!added) return
    setFresh(added)
    const id = setTimeout(() => setFresh(null), 700)
    return () => clearTimeout(id)
  }, [build, types])
  const [flips, setFlips] = useState(flipCount)
  useEffect(() => { const on = () => setFlips(flipCount()); window.addEventListener('ag:flip', on); return () => window.removeEventListener('ag:flip', on) }, [])
  const hint = flips < 3                          // the edge lifts now and then until the card has been turned a few times
  const coach = side === 'spin' && flips < 1 && filled > 0

  if (side === 'build') {
    return (
      <button className={`ag-edge ag-edge--build${hint ? ' is-hint' : ''}`} onClick={() => onFlip('spin')} aria-label="Flip the card back to the spin side">
        <span className="ag-edge-grip" />
        <span className="ag-edge-row">
          <span className="ag-edge-go"><IconArrow size={14} style={{ transform: 'rotate(180deg)' }} /> SPIN</span>
          <span className="ag-edge-status">{complete ? 'Build complete — simulate below' : waiting ? `${waiting} is waiting — pick a trait` : 'Spin for the next trait'}</span>
          <span className="ag-edge-count"><b>{filled}</b>/{types.length}</span>
        </span>
      </button>
    )
  }
  return (
    <button className={`ag-edge ag-edge--spin${hint ? ' is-hint' : ''}`} onClick={() => onFlip('build')} aria-label={`The build, ${filled} of ${types.length} slots filled. Flip the card to the build side`}>
      <span className="ag-edge-grip" />
      <span className="ag-edge-row">
        <span className="ag-edge-title un-keep">{name}</span>
        <span className="ag-edge-count"><b>{filled}</b>/{types.length}</span>
        <span className="ag-edge-go">BUILD <IconArrow size={14} /></span>
      </span>
      <span className="ag-edge-slots" style={{ gridTemplateColumns: `repeat(${types.length}, 1fr)` }}>
        {types.map(t => {
          const chip = build[t]
          const meta = attrMap?.[t]
          return (
            <span key={t} className={`ag-slot${chip ? ' is-filled' : ''}${fresh === t ? ' is-fresh' : ''}`} style={chip ? { '--g': gradeColor(chip.val) } : undefined}>
              <span className="ag-slot-lbl">{meta?.shortLabel ?? t.slice(0, 3).toUpperCase()}</span>
              <span className="ag-slot-val">{chip ? valToGrade(chip.val) : ''}</span>
            </span>
          )
        })}
      </span>
      {coach && (
        <span className="ag-coach">
          <span className="ag-coach-hand" />
          Swipe left, or tap this edge, to turn the card over and see your build
        </span>
      )}
    </button>
  )
}

// The field: where the player starts, measured from the scroll container's top,
// less the sticky header, so "build" lands with the player right under it
const stackEls = () => {
  const sc = document.querySelector('.game-page-scroll')
  const field = sc?.querySelector('.game-layout.ag-stack .ag-seam') ?? sc?.querySelector('.game-layout.ag-stack .field-center')
  const edge = sc?.querySelector('.ag-sedge')
  return { sc, field, edgeH: edge?.offsetHeight ?? 0 }
}
const fieldTop = ({ sc, field, edgeH }) => (sc && field ? field.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - edgeH - 8 : 0)

// Which side you're on comes from where you've scrolled: past halfway to the
// player is the build side. --stack-p (0 spin → 1 build) drives the header.
// flip(to) glides there; a reset elsewhere (setView('spin')) scrolls back up.
export function useFlip(enabled, view, setView) {
  const viewRef = useRef(view); viewRef.current = view
  const fromScroll = useRef(false)
  const flip = useCallback(to => {
    if (!enabled) { setView(to); return }
    const el = stackEls()
    if (!el.sc) { setView(to); return }
    el.sc.scrollTo({ top: to === 'build' ? fieldTop(el) : 0, behavior: 'smooth' })
    if (to !== viewRef.current) {
      try { localStorage.setItem(FLIPS_KEY, String(flipCount() + 1)) } catch {}
      window.dispatchEvent(new CustomEvent('ag:flip'))
    }
  }, [enabled, setView])

  useEffect(() => {
    if (!enabled) return
    let raf = 0, sc = null
    const html = document.documentElement
    const measure = () => {
      raf = 0
      const el = stackEls(); if (!el.sc) return
      const top = Math.max(1, fieldTop(el))
      const p = Math.max(0, Math.min(1, el.sc.scrollTop / top))
      html.style.setProperty('--stack-p', p.toFixed(3))
      // the spin side fills the screen above the player, less the peek
      html.style.setProperty('--stack-h', `${el.sc.clientHeight - el.edgeH}px`)
      html.style.setProperty('--stack-edge-h', `${el.edgeH + 8}px`)
      const next = p > 0.5 ? 'build' : 'spin'
      if (html.dataset.stack !== next) html.dataset.stack = next
      if (next !== viewRef.current) { fromScroll.current = true; viewRef.current = next; setView(next) }
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(measure) }
    const attach = () => {
      const s = document.querySelector('.game-page-scroll')
      if (s === sc) return
      sc?.removeEventListener('scroll', on); sc = s
      sc?.addEventListener('scroll', on, { passive: true })
      on()
    }
    attach()
    const mo = new MutationObserver(attach)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', on)
    return () => { sc?.removeEventListener('scroll', on); mo.disconnect(); window.removeEventListener('resize', on); cancelAnimationFrame(raf); html.style.removeProperty('--stack-p'); delete html.dataset.stack }
  }, [enabled, setView])

  // set from outside (a reset, a new build): go there
  useEffect(() => {
    if (!enabled) return
    if (fromScroll.current) { fromScroll.current = false; return }
    const el = stackEls(); if (!el.sc) return
    const atBuild = el.sc.scrollTop > fieldTop(el) / 2
    if ((view === 'build') === atBuild) return
    // never under a finger: wait until the page is still, then go
    return whenStill(() => { const e2 = stackEls(); if (e2.sc && (view === 'build') !== (e2.sc.scrollTop > fieldTop(e2) / 2)) e2.sc.scrollTo({ top: view === 'build' ? fieldTop(e2) : 0, behavior: view === 'build' ? 'smooth' : 'instant' }) })
  }, [view, enabled])

  return flip
}

// The sticky header of the stack: on the spin side your build slot by slot,
// on the build side a "back to spin" bar. One height, the two crossfade with
// the scroll (--stack-p), so nothing below it jumps.
export function StackEdge({ view, build, types, attrMap, onFlip, waiting = null, complete = false }) {
  const name = useName()
  const filled = types.filter(t => build[t]).length
  const prev = useRef(new Set(types.filter(t => build[t])))
  const [fresh, setFresh] = useState(null)
  useEffect(() => {
    const now = types.filter(t => build[t])
    const added = now.find(t => !prev.current.has(t))
    prev.current = new Set(now)
    if (!added) return
    setFresh(added)
    const id = setTimeout(() => setFresh(null), 700)
    return () => clearTimeout(id)
  }, [build, types])
  const [flips, setFlips] = useState(flipCount)
  useEffect(() => { const on = () => setFlips(flipCount()); window.addEventListener('ag:flip', on); return () => window.removeEventListener('ag:flip', on) }, [])
  const coach = view === 'spin' && flips < 1 && filled > 0
  const onBuild = view === 'build'
  return (
    <button className={`ag-edge ag-sedge${onBuild ? ' is-build' : ''}`} onClick={() => onFlip(onBuild ? 'spin' : 'build')}
      aria-label={onBuild ? 'Scroll back up to the spin' : `Your build, ${filled} of ${types.length} slots filled. Scroll down to your player`}>
      <span className="ag-edge-row">
        <span className="ag-sedge-title">
          <span className="ag-sedge-a un-keep">{name}</span>
          <span className="ag-sedge-b">{complete ? 'Build complete: simulate below' : waiting ? `${waiting} is waiting: pick a trait` : 'Spin for the next trait'}</span>
        </span>
        <span className="ag-edge-count"><b>{filled}</b>/{types.length}</span>
        <span className="ag-edge-go ag-sedge-go">
          <span className="ag-sedge-a">PLAYER <IconArrow size={13} style={{ transform: 'rotate(90deg)' }} /></span>
          <span className="ag-sedge-b"><IconArrow size={13} style={{ transform: 'rotate(-90deg)' }} /> SPIN</span>
        </span>
      </span>
      <span className="ag-edge-slots" style={{ gridTemplateColumns: `repeat(${types.length}, 1fr)` }}>
        {types.map(t => {
          const chip = build[t]
          const meta = attrMap?.[t]
          return (
            <span key={t} className={`ag-slot${chip ? ' is-filled' : ''}${fresh === t ? ' is-fresh' : ''}`} style={chip ? { '--g': gradeColor(chip.val) } : undefined}>
              <span className="ag-slot-lbl">{meta?.shortLabel ?? t.slice(0, 3).toUpperCase()}</span>
              <span className="ag-slot-val">{chip ? valToGrade(chip.val) : ''}</span>
            </span>
          )
        })}
      </span>
      {coach && <span className="ag-coach ag-coach--down"><span className="ag-coach-hand" />Your player is right below. Scroll down, or tap here</span>}
    </button>
  )
}

// ── Phones: the player is the screen ─────────────────────────────────────────
// On the app and on the website at phone width, the build screen is your player.
// SPIN drops the wheel down from the top, you pick a trait from a compact grid,
// and the sheet slides back up as the trait lands on the player: no flipping
// between sides, no scrolling.
const PHONE_Q = '(max-width: 768px)'
export function useDropMode(on) {
  const [phone, setPhone] = useState(() => IS_APP || (typeof window !== 'undefined' && window.matchMedia(PHONE_Q).matches))
  useEffect(() => {
    if (IS_APP) return
    const mq = window.matchMedia(PHONE_Q)
    const f = () => setPhone(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return !!on && phone
}
// open / closed
export function useDropSheet(enabled, build, types, resetKey) {
  const [open, setOpen] = useState(false)
  // it stays where you put it: a pick never closes it (the spin's own reset after
  // each pick isn't a reset of the build); clearing the build does
  const filled = types.filter(t => build[t]).length
  const prevFilled = useRef(filled)
  useEffect(() => { if (filled < prevFilled.current) setOpen(false); prevFilled.current = filled }, [filled])
  // the build is complete: nothing left to pick, and SIMULATE is underneath
  const complete = types.length > 0 && types.every(t => build[t])
  useEffect(() => { if (enabled && complete) setOpen(false) }, [complete, enabled])
  return [open, setOpen]
}
// Dragging the panel: it follows the finger the whole way, from the bar or the
// grip, up or down. Let go and it settles where you were heading (a flick wins,
// otherwise 30% of the way is enough). A tap toggles it.
const sheetEl = () => document.querySelector('.drop-sheet')
// Native touch listeners (touchmove can stop the page from scrolling, which
// pointer events can't count on in an iPhone web view), and the mouse for desktop.
// drag(onTap, body) gives a ref for the element: body = the panel itself (anything
// on it drags it; a tap still picks), else a handle (the bar, the grip).
function useDrag(open, setOpen) {
  const live = useRef({}); live.current = { open, setOpen }
  const st = useRef(null)
  const place = p => { const el = sheetEl(); if (el) { el.style.transition = 'none'; el.style.transform = `translate3d(0, ${(p - 1) * 101}%, 0)` } }
  const release = () => { const el = sheetEl(); if (el) { el.style.transition = ''; el.style.transform = '' } }
  const begin = (y, body) => {
    const el = sheetEl(), o = live.current.open
    st.current = { y, ly: y, p0: o ? 1 : 0, p: o ? 1 : 0, h: Math.max(1, el?.offsetHeight ?? 400), moved: false, vy: 0, t: performance.now(), body, off: 0 }
  }
  // returns true once it's a drag (the caller stops the page scrolling)
  const move = y => {
    const d = st.current; if (!d) return false
    const step = y - d.ly
    if (!d.moved && Math.abs(y - d.y) > 6) d.moved = true
    const now = performance.now()
    d.vy = step / Math.max(1, now - d.t); d.t = now; d.ly = y
    if (!d.moved) return false
    const el = sheetEl()
    // taller than the room: the panel's own content scrolls first, then the panel moves
    if (d.body && el && d.p === 1 && el.scrollHeight > el.clientHeight + 1) {
      const before = el.scrollTop
      el.scrollTop = before - step
      if (el.scrollTop !== before) { d.off += step; return true }
    }
    d.p = Math.max(0, Math.min(1, d.p0 + (y - d.y - d.off) / d.h))
    place(d.p)
    return true
  }
  // let go: it settles where you were heading (a flick wins, otherwise past halfway)
  const end = () => {
    const d = st.current; st.current = null
    release()
    if (!d || !d.moved) return false
    if (d.body && d.p === 1 && d.p0 === 1) return true
    live.current.setOpen(d.vy > 0.3 ? true : d.vy < -0.3 ? false : d.p > 0.5)
    return true
  }
  return (onTap, body = false) => node => {
    if (!node) return
    node.__onTap = onTap             // (the latest one: it closes over this render's state)
    if (node.__dragged) return
    node.__dragged = true
    let dragged = false
    node.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; if (!body) e.stopPropagation(); begin(e.touches[0].clientY, body) }, { passive: true })
    node.addEventListener('touchmove', e => { if (!st.current || (st.current.body !== body)) return; if (move(e.touches[0].clientY) && e.cancelable) e.preventDefault() }, { passive: false })
    node.addEventListener('touchend', e => { if (!st.current || st.current.body !== body) return; if (end()) { dragged = true; e.cancelable && e.preventDefault() } }, { passive: false })
    node.addEventListener('touchcancel', () => { st.current = null; release() })
    // the mouse: drag with the button down anywhere on the page
    node.addEventListener('mousedown', e => {
      if (e.button !== 0) return
      if (!body) e.stopPropagation()
      begin(e.clientY, body)
      const mm = ev => move(ev.clientY)
      const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); if (end()) dragged = true }
      window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu)
    })
    // a tap (not the end of a drag)
    node.addEventListener('click', e => { if (dragged) { dragged = false; if (!body) e.stopPropagation(); return } if (!body) node.__onTap?.() })
  }
}
// The bar at the top: the build slot by slot. Tap it, or pull it down, and the
// spin panel drops out from under it; SPIN is in the panel.
export function DropBar({ open, setOpen, build, types, attrMap, waiting = null, complete = false }) {
  const filled = types.filter(t => build[t]).length
  const prev = useRef(new Set(types.filter(t => build[t])))
  const [fresh, setFresh] = useState(null)
  const bar = useRef(null)
  useEffect(() => {
    const now = types.filter(t => build[t])
    const added = now.find(t => !prev.current.has(t))
    prev.current = new Set(now)
    if (!added) return
    setFresh(added)
    const id = setTimeout(() => setFresh(null), 700)
    return () => clearTimeout(id)
  }, [build, types])
  // where the panel hangs from: the bar's bottom edge. A live game's status bar
  // (3v3 squads, 1v1, Compete) is pinned to the top too: sit just under it, never on it.
  useEffect(() => {
    const el = bar.current; if (!el) return
    const html = document.documentElement
    let raf = 0
    const hudOf = () => el.parentElement?.querySelector(':scope > .bt-hud > .bt-hud-bar, :scope > .cp-hud')
    const put = () => {
      raf = 0
      const hud = hudOf()
      el.style.top = hud ? `${Math.round(hud.getBoundingClientRect().height + (hud.classList.contains('bt-hud-bar') ? 12 : 4))}px` : ''
      html.style.setProperty('--drop-top', `${Math.round(el.getBoundingClientRect().bottom)}px`)
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(put) }
    put()
    const ro = new ResizeObserver(on); ro.observe(el)
    const hud0 = hudOf(); if (hud0) ro.observe(hud0)
    window.addEventListener('scroll', on, true); window.addEventListener('resize', on)
    return () => { ro.disconnect(); window.removeEventListener('scroll', on, true); window.removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])
  const drag = useDrag(open, setOpen)
  const toggle = () => { if (complete && !open) return; setOpen(!open) }
  const barRef = el => { bar.current = el; drag(toggle)(el) }
  return (
    <div ref={barRef} className={`drop-bar${open ? ' is-open' : ''}`} role="button" tabIndex={0} aria-expanded={open} aria-label={open ? 'Hide the spin' : 'Show the spin'}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}>
      <span className="ag-edge-slots drop-slots" style={{ gridTemplateColumns: `repeat(${types.length}, 1fr)` }}>
        {types.map(t => {
          const chip = build[t]
          return (
            <span key={t} className={`ag-slot${chip ? ' is-filled' : ''}${fresh === t ? ' is-fresh' : ''}`} style={chip ? { '--g': gradeColor(chip.val) } : undefined}>
              <span className="ag-slot-lbl">{attrMap?.[t]?.shortLabel ?? t.slice(0, 3).toUpperCase()}</span>
              <span className="ag-slot-val">{chip ? valToGrade(chip.val) : ''}</span>
            </span>
          )
        })}
      </span>
      {!complete && (
        // open or shut, the button stays the same: only its arrow turns
        <span className={`drop-bar-spin${waiting ? ' is-pick' : ''}`} aria-hidden="true">
          {waiting ? 'PICK' : 'SPIN'} <IconArrow size={13} style={{ transform: `rotate(${open ? -90 : 90}deg)`, transition: 'transform .22s ease' }} />
        </span>
      )}
      {complete && <span className="drop-bar-done"><b>{filled}</b>/{types.length}</span>}
      <span className="drop-bar-grab" aria-hidden="true" />
    </div>
  )
}
// The panel the spin lives in: tucked up under the bar, or dropped down over
// the top of the player. The page behind it stays live (no overlay).
export function DropSheet({ open, setOpen, children }) {
  const drag = useDrag(open, setOpen)
  const sheetRef = drag(null, true)
  const gripRef = drag(() => setOpen(false))
  // a tap anywhere outside the panel (and its bar) puts it away (the GRADES ON/OFF
  // switch up in the bar doesn't: you flip it to see the open spin with or without)
  useEffect(() => {
    if (!open) return
    // (the tutorial's tips sit over the sheet: tapping them isn't tapping away)
    const on = e => { if (!e.target.closest?.('.drop-sheet, .drop-bar, .grade-toggle-btn, .nav-grades, .tut-coach')) setOpen(false) }
    const id = setTimeout(() => document.addEventListener('pointerdown', on, true), 0)
    return () => { clearTimeout(id); document.removeEventListener('pointerdown', on, true) }
  }, [open, setOpen])
  return (
    <div className="drop-clip">
      <div className={`drop-sheet${open ? ' is-open' : ''}`} aria-hidden={!open} ref={sheetRef}>
        {children}
        <div className="drop-sheet-grip" role="button" aria-label="Hide the spin" ref={gripRef}><span /></div>
      </div>
    </div>
  )
}

// The seam between the wheel and the player: a lip you can pull on. It names
// the player, counts the slots, and pulses when a pick lands in the build.
export function StackSeam({ build, types, onFlip }) {
  const name = useName()
  const filled = types.filter(t => build[t]).length
  const [pulse, setPulse] = useState(0)
  const last = useRef(filled)
  useEffect(() => { if (filled > last.current) setPulse(p => p + 1); last.current = filled }, [filled])
  return (
    <button className="ag-seam" onClick={() => onFlip('build')} aria-label="Scroll down to your player">
      <span key={pulse} className={`ag-seam-line${pulse ? ' is-pulse' : ''}`} />
      <span className="ag-seam-chip">
        <span className="ag-seam-chev" aria-hidden="true" />
        <span><span className="un-keep">{name}</span> · <b>{filled}</b>/{types.length}</span>
      </span>
    </button>
  )
}

// the shared count-up (lib/useCountUp.js), back to 0 whenever it's hidden
const useCountUp = (target, run, ms = 1100) => countUp(target, { run, ms, reset: true })

// The build-complete moment: the grades pop into the card one by one while the
// OVR ring fills, then the tier stamps down on the impact of the stinger.
const TIERS = [
  { min: 92, name: 'LEGENDARY', tier: 4, color: '#f2c94c' },
  { min: 87, name: 'ELITE',     tier: 3, color: '#b678ff' },
  { min: 82, name: 'PRO BOWL',  tier: 2, color: '#4ea8ff' },
  { min: 76, name: 'STARTER',   tier: 1, color: '#34d399' },
  { min: 0,  name: 'DEVELOPING', tier: 0, color: '#9fb3a8' },
]
export const tierFor = ovr => TIERS.find(t => ovr >= t.min)
export function BuildComplete({ complete, ovr, name = null, label = 'OVR', build = null, types = [], attrMap = null }) {
  const was = useRef(complete)
  const [show, setShow] = useState(false)
  const [stage, setStage] = useState(0)          // 0 in → 1 landed
  const timers = useRef([])
  const tier = tierFor(ovr || 0)
  const chips = types.filter(t => build?.[t])
  useEffect(() => {
    if (complete && !was.current) {
      was.current = complete
      setShow(true); setStage(0)
      window.dispatchEvent(new CustomEvent('bap:build-complete', { detail: { ovr } }))
      import('../../lib/juice').then(({ sfx, haptic }) => {
        sfx('complete', tier.tier)
        chips.forEach((t, i) => timers.current.push(setTimeout(() => sfx('gradepop', build[t].val), 180 + i * 75)))
        timers.current.push(setTimeout(() => { haptic('heavy') }, 1000))
      }).catch(() => {})
      timers.current.push(setTimeout(() => setStage(1), 1000))
      timers.current.push(setTimeout(() => setShow(false), 3600))
      return
    }
    was.current = complete
  }, [complete]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const n = useCountUp(ovr, show, 950)
  if (!show) return null
  const R = 54, C = 2 * Math.PI * R
  const pct = Math.min(1, (n || 0) / 99)
  return (
    <div className={`ag-bc${stage ? ' is-landed' : ''}`} style={{ '--tier': tier.color }} onClick={() => setShow(false)}>
      <div className="ag-bc-rays" aria-hidden="true" />
      <div className="ag-bc-card">
        <span className="ag-eyebrow ag-bc-eyebrow">BUILD COMPLETE</span>
        <div className="ag-bc-ring">
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle cx="64" cy="64" r={R} className="ag-bc-track" />
            <circle cx="64" cy="64" r={R} className="ag-bc-fill" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
          </svg>
          <span className="ag-bc-num">{n}</span>
          <span className="ag-bc-lbl">{label}</span>
        </div>
        {/* the build's own name (Boom or Bust, Gunslinger…), colored by its tier */}
        <div className={`ag-bc-tier${String(name ?? '').length > 14 ? ' is-long' : ''}`}><Scramble text={name ?? tier.name} delay={250} /></div>
        {chips.length > 0 && (
          // full trait names (no abbreviations), two to a row; an odd count (football's 9) as one list
          <div className={`ag-bc-grades${chips.length % 2 ? ' is-list' : ''}`}>
            {chips.map((t, i) => (
              <span key={t} className="ag-bc-g" style={{ '--g': gradeColor(build[t].val), '--d': `${180 + i * 75}ms` }}>
                <small>{attrMap?.[t]?.label ?? t}</small>
                <b>{valToGrade(build[t].val)}</b>
              </span>
            ))}
          </div>
        )}
        <span className="ag-bc-tap">TAP TO CONTINUE</span>
      </div>
    </div>
  )
}
