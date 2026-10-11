import { useCallback, useEffect, useRef, useState } from 'react'
import { valToGrade } from '../../utils/simulation'
import { IconArrow } from './icons'

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

const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')
const FLIPS_KEY = 'ag_flips'
const flipCount = () => { try { return +localStorage.getItem(FLIPS_KEY) || 0 } catch { return 0 } }

export function FlipEdge({ side, build, types, attrMap, onFlip, waiting = null, complete = false }) {
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
    <button className={`ag-edge ag-edge--spin${hint ? ' is-hint' : ''}`} onClick={() => onFlip('build')} aria-label={`Your build, ${filled} of ${types.length} slots filled. Flip the card to the build side`}>
      <span className="ag-edge-grip" />
      <span className="ag-edge-row">
        <span className="ag-edge-title">YOUR BUILD</span>
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
    if ((view === 'build') !== atBuild) el.sc.scrollTo({ top: view === 'build' ? fieldTop(el) : 0, behavior: view === 'build' ? 'smooth' : 'instant' })
  }, [view, enabled])

  return flip
}

// The sticky header of the stack: on the spin side your build slot by slot,
// on the build side a "back to spin" bar. One height, the two crossfade with
// the scroll (--stack-p), so nothing below it jumps.
export function StackEdge({ view, build, types, attrMap, onFlip, waiting = null, complete = false }) {
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
          <span className="ag-sedge-a">YOUR BUILD</span>
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

// The seam between the wheel and the player: a lip you can pull on. It names
// the player, counts the slots, and pulses when a pick lands in the build.
export function StackSeam({ build, types, onFlip }) {
  const filled = types.filter(t => build[t]).length
  const [pulse, setPulse] = useState(0)
  const last = useRef(filled)
  useEffect(() => { if (filled > last.current) setPulse(p => p + 1); last.current = filled }, [filled])
  return (
    <button className="ag-seam" onClick={() => onFlip('build')} aria-label="Scroll down to your player">
      <span key={pulse} className={`ag-seam-line${pulse ? ' is-pulse' : ''}`} />
      <span className="ag-seam-chip">
        <span className="ag-seam-chev" aria-hidden="true" />
        <span>YOUR PLAYER · <b>{filled}</b>/{types.length}</span>
      </span>
    </button>
  )
}

function useCountUp(target, run, ms = 1100) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) { setV(0); return }
    let raf, start
    const step = now => {
      start ??= now
      const t = Math.min(1, (now - start) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return v
}

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
export function BuildComplete({ complete, ovr, label = 'OVR', build = null, types = [], attrMap = null }) {
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
        <div className="ag-bc-tier">{tier.name}</div>
        {chips.length > 0 && (
          // full trait names (no abbreviations), two to a row
          <div className="ag-bc-grades">
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
