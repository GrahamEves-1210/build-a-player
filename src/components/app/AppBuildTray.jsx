import { useCallback, useEffect, useRef, useState } from 'react'
import { valToGrade } from '../../utils/simulation'
import { IconArrow } from './icons'

// App: Spin and Build are two sides of one card. The card's edge sits at the
// top of whichever side is showing — tap it, or swipe, and the card turns over.
//   <FlipEdge>      the edge: on the spin side it carries your build slot by slot,
//                   on the build side what's waiting back on the spin side
//   useFlip         the turn itself (swing out → switch → swing in) + the swipe
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

// Turns the card: the showing side swings away to its edge (data-flip="left"/
// "right"), the view switches, the other side swings in ("in-left"/"in-right").
// Also the swipe: a short horizontal drag anywhere on the game turns it.
export function useFlip(enabled, view, setView) {
  const viewRef = useRef(view); viewRef.current = view
  const busy = useRef(false)
  const flip = useCallback(to => {
    if (to === viewRef.current || busy.current) return
    if (!enabled) { setView(to); return }
    busy.current = true
    const html = document.documentElement
    const dir = to === 'build' ? 'left' : 'right'
    html.setAttribute('data-flip', dir)
    setTimeout(() => {
      setView(to)
      document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
      html.setAttribute('data-flip', `in-${dir}`)
      setTimeout(() => { if (html.getAttribute('data-flip') === `in-${dir}`) html.removeAttribute('data-flip'); busy.current = false }, 480)
    }, 240)
    try { localStorage.setItem(FLIPS_KEY, String(flipCount() + 1)) } catch {}
    window.dispatchEvent(new CustomEvent('ag:flip'))
  }, [enabled, setView])

  useEffect(() => {
    if (!enabled) return
    let sx = 0, sy = 0, st = 0, ok = false
    const down = e => {
      const t = e.touches[0]
      // not from things that scroll sideways or take drags themselves
      ok = !!e.target.closest?.('.game-page-scroll') && !e.target.closest?.('.cat-pills, .ag-positions, input, textarea')
      sx = t.clientX; sy = t.clientY; st = Date.now()
    }
    const up = e => {
      if (!ok) return
      const t = e.changedTouches[0]
      const dx = t.clientX - sx, dy = t.clientY - sy
      if (Date.now() - st > 900 || Math.abs(dx) < 36 || Math.abs(dy) > Math.abs(dx) * 0.8) return
      flip(dx < 0 ? 'build' : 'spin')
    }
    document.addEventListener('touchstart', down, { passive: true })
    document.addEventListener('touchend', up, { passive: true })
    return () => {
      document.removeEventListener('touchstart', down); document.removeEventListener('touchend', up)
      document.documentElement.removeAttribute('data-flip')
    }
  }, [enabled, flip])

  return flip
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
          <div className="ag-bc-grades" style={{ gridTemplateColumns: `repeat(${Math.min(5, chips.length)}, 1fr)` }}>
            {chips.map((t, i) => (
              <span key={t} className="ag-bc-g" style={{ '--g': gradeColor(build[t].val), '--d': `${180 + i * 75}ms` }}>
                <b>{valToGrade(build[t].val)}</b>
                <small>{attrMap?.[t]?.shortLabel ?? t.slice(0, 3).toUpperCase()}</small>
              </span>
            ))}
          </div>
        )}
        <span className="ag-bc-tap">TAP TO CONTINUE</span>
      </div>
    </div>
  )
}
