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

export function BuildComplete({ complete, ovr, label = 'OVR' }) {
  const was = useRef(complete)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (complete && !was.current) {
      setShow(true)
      window.dispatchEvent(new CustomEvent('bap:build-complete'))
      const t = setTimeout(() => setShow(false), 2300)
      was.current = complete
      return () => clearTimeout(t)
    }
    was.current = complete
  }, [complete])
  const n = useCountUp(ovr, show)
  if (!show) return null
  return (
    <div className="ag-complete" onClick={() => setShow(false)}>
      <span className="ag-eyebrow">BUILD COMPLETE</span>
      <span className="ag-complete-num">{n}</span>
      <span className="ag-complete-lbl">{label}</span>
    </div>
  )
}
