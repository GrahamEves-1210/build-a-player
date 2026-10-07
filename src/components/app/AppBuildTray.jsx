import { useEffect, useRef, useState } from 'react'
import { valToGrade } from '../../utils/simulation'

// App: the Spin and Build views as two sides of one card.
//   <BuildTray>     — your build, slot by slot, pinned above the reels; tap to flip
//   <BuildComplete> — the moment the last slot fills: OVR counts up, then the build side
//   useSwipeViews   — swipe left/right on the game to flip between the sides

const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')

export function BuildTray({ build, types, attrMap, onOpen }) {
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

  return (
    <button className="ag-tray" onClick={onOpen} aria-label={`Your build, ${filled} of ${types.length} slots filled. Open build view`}>
      <span className="ag-tray-head">
        <span className="ag-tray-title">YOUR BUILD</span>
        <span className="ag-tray-count"><b>{filled}</b>/{types.length}</span>
        <span className="ag-tray-go">FLIP ›</span>
      </span>
      <span className="ag-tray-slots" style={{ gridTemplateColumns: `repeat(${types.length}, 1fr)` }}>
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

// Horizontal swipe on the game area flips Spin ⇄ Build. Ignores gestures that
// start on things that scroll sideways or take drags.
export function useSwipeViews(enabled, view, setView) {
  const viewRef = useRef(view)
  viewRef.current = view
  useEffect(() => {
    if (!enabled) return
    let sx = 0, sy = 0, st = 0, ok = false
    const down = e => {
      const t = e.touches[0]
      ok = !!e.target.closest?.('.game-layout') && !e.target.closest?.('.cat-pills, .attr-chip, input, [draggable="true"], .ag-tray')
      sx = t.clientX; sy = t.clientY; st = Date.now()
    }
    const up = e => {
      if (!ok) return
      const t = e.changedTouches[0]
      const dx = t.clientX - sx, dy = t.clientY - sy
      if (Date.now() - st > 650 || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return
      if (dx < 0 && viewRef.current === 'spin') setView('build')
      else if (dx > 0 && viewRef.current === 'build') setView('spin')
    }
    document.addEventListener('touchstart', down, { passive: true })
    document.addEventListener('touchend', up, { passive: true })
    return () => { document.removeEventListener('touchstart', down); document.removeEventListener('touchend', up) }
  }, [enabled, setView])
}
