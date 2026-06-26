import { useRef, useEffect, useLayoutEffect, useMemo, useCallback, useState } from 'react'
import { NFL_TEAMS } from '../data/nfl-teams'

const ITEM_H  = 44
const CENTER  = 2
const IDLE_MS = 1200
const FAST_MS = 36

function SlotReel({ items, spinning, idle, onStop }) {
  const COPIES = useMemo(() => {
    const loopH  = items.length * ITEM_H
    const needed = Math.ceil(14000 / Math.max(loopH, 1))
    return Math.max(3, Math.min(needed, Math.ceil(99 / Math.max(items.length, 1))))
  }, [items])

  const allItems   = useMemo(() => Array.from({ length: COPIES }, () => items).flat(), [items, COPIES])
  const initOffset = useMemo(() => Math.floor(COPIES / 2) * items.length * ITEM_H + CENTER * ITEM_H, [COPIES, items])

  const posRef       = useRef(initOffset)
  const trackRef     = useRef(null)
  const rafRef       = useRef(null)
  const stopRef      = useRef(null)
  const prevItemsRef = useRef(items)
  const onStopRef    = useRef(onStop)
  onStopRef.current  = onStop

  useLayoutEffect(() => {
    if (trackRef.current)
      trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
  })

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    clearTimeout(stopRef.current)

    const itemsChanged = prevItemsRef.current !== items
    prevItemsRef.current = items

    if (itemsChanged) {
      posRef.current = initOffset
      if (trackRef.current) {
        trackRef.current.style.transition = 'none'
        trackRef.current.style.transform  = `translate3d(0,${-(initOffset - CENTER * ITEM_H)}px,0)`
      }
      if (!spinning && !idle) return
    }

    const loopH = items.length * ITEM_H
    const wrap  = () => { if (posRef.current >= initOffset + loopH) posRef.current -= loopH }

    if (spinning) {
      const duration  = 1900 + Math.random() * 400
      const startTime = performance.now()
      const MAX_VEL   = ITEM_H / FAST_MS
      let lastFrame   = startTime

      if (trackRef.current) trackRef.current.style.transition = 'none'

      const frame = (now) => {
        const elapsed = now - startTime
        const t       = Math.min(elapsed / duration, 1.0)
        const KICK    = 0.45
        const t2      = t < KICK ? 0 : (t - KICK) / (1 - KICK)
        const eased   = t2 * t2 * (3 - 2 * t2)
        const vel     = MAX_VEL * (1 - eased)
        const dt      = Math.min(now - lastFrame, 50)
        lastFrame = now
        posRef.current += vel * dt
        wrap()
        if (trackRef.current)
          trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`

        if (t >= 1.0) {
          const snapped  = Math.round(posRef.current / ITEM_H) * ITEM_H
          posRef.current = snapped
          if (trackRef.current) {
            trackRef.current.style.transition = 'transform 140ms cubic-bezier(0.25,0.46,0.45,0.94)'
            trackRef.current.style.transform  = `translate3d(0,${-(snapped - CENTER * ITEM_H)}px,0)`
          }
          stopRef.current = setTimeout(() => {
            if (trackRef.current) trackRef.current.style.transition = 'none'
            const idx    = Math.round(snapped / ITEM_H)
            const winner = items[((idx % items.length) + items.length) % items.length]
            if (onStopRef.current) onStopRef.current(winner)
          }, 150)
        } else {
          rafRef.current = requestAnimationFrame(frame)
        }
      }

      rafRef.current = requestAnimationFrame(frame)

    } else if (idle) {
      const VEL     = ITEM_H / IDLE_MS
      let lastFrame = performance.now()

      const frame = (now) => {
        const dt  = Math.min(now - lastFrame, 50)
        lastFrame = now
        posRef.current += VEL * dt
        wrap()
        if (trackRef.current) {
          trackRef.current.style.transition = 'none'
          trackRef.current.style.transform  = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
        }
        rafRef.current = requestAnimationFrame(frame)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(stopRef.current)
    }
  }, [spinning, idle, items, initOffset])

  return (
    <div className="reel-outer">
      <div className="reel-label">TEAM</div>
      <div className="reel-window">
        <div className="reel-selector" />
        <div ref={trackRef} className="reel-track" style={{ willChange: 'transform' }}>
          {allItems.map((team, i) => (
            <div key={i} className="reel-row" style={{ height: ITEM_H }}>
              <div className="reel-primary">{team.short}</div>
              <div className="reel-secondary">{team.name.split(' ').slice(-1)[0]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TeamPickerModal({ onSelect }) {
  const [phase, setPhase]   = useState('idle')
  const [result, setResult] = useState(null)
  const [spinCount, setSpinCount] = useState(0)

  const items = useMemo(() => [...NFL_TEAMS].sort(() => Math.random() - 0.5), [spinCount])

  const handleSpin = () => {
    if (phase === 'spinning' || phase === 'done') return
    setResult(null)
    setSpinCount(c => c + 1)
    setPhase('spinning')
  }

  const handleStop = useCallback((team) => {
    setResult(team)
    setPhase('done')
    setTimeout(() => onSelect(team), 1500)
  }, [onSelect])

  const cardStyle = result
    ? { '--tpm-color': result.color, borderColor: result.color + '55', boxShadow: `0 0 32px ${result.color}22, 0 32px 80px rgba(0,0,0,0.55)` }
    : undefined

  return (
    <div className="tpm-overlay">
      <div className="tpm-card" style={cardStyle}>
        <div className="tpm-eyebrow">Simulate Season</div>
        <div className="tpm-heading">Spin Your Team</div>

        <div className="reels-wrap tpm-reels">
          <div className="reel-tri reel-tri-l" />
          <div className="reels-row">
            <SlotReel
              items={items}
              spinning={phase === 'spinning'}
              idle={phase === 'idle'}
              onStop={handleStop}
            />
          </div>
          <div className="reel-tri reel-tri-r" />
        </div>

        {result && (
          <div className="tpm-result" style={{ '--tpm-color': result.color }}>
            <div className="tpm-result-bg" />
            <img src={result.logo} alt={result.name} className="tpm-result-logo" />
            <div className="tpm-result-name">{result.name}</div>
            <div className="tpm-result-abbr">{result.short}</div>
          </div>
        )}

        <button
          className="spin-btn"
          onClick={handleSpin}
          disabled={phase === 'spinning' || phase === 'done'}
        >
          SPIN
        </button>
      </div>
    </div>
  )
}
