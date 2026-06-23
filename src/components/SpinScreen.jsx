import { useRef, useEffect, useLayoutEffect, useMemo, useCallback, useState } from 'react'
import { QBS, TEAMS, ATTR, TYPES, CATEGORIES, QB_PHYSICALS, LITE_TYPES } from '../data/qbs'
import { valToGrade } from '../utils/simulation'
import HEADSHOTS from '../data/headshots.json'
import QBAvatar from './QBAvatar'

function fmtHeight(inches) {
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

const ITEM_H  = 44
const CENTER  = 2
const IDLE_MS = 1200
const FAST_MS = 32   // ms per item at peak speed — defines MAX_VEL

// ─── Slot Reel ───────────────────────────────────────────────────────────────
function SlotReel({ label, items, spinning, idle, locked, getDisplay, getSub, onStop, blurred, fast, durationMs = 1400, jitterMs = 500 }) {
  const COPIES = useMemo(() => {
    const loopH  = items.length * ITEM_H
    const needed = Math.ceil(14000 / Math.max(loopH, 1))
    return Math.max(3, Math.min(needed, Math.ceil(99 / Math.max(items.length, 1))))
  }, [items])
  const allItems = useMemo(
    () => Array.from({ length: COPIES }, () => items).flat(),
    [items, COPIES]
  )
  const initOffset = useMemo(
    () => Math.floor(COPIES / 2) * items.length * ITEM_H + CENTER * ITEM_H,
    [COPIES, items]
  )

  const posRef       = useRef(initOffset)
  const trackRef     = useRef(null)
  const rafRef       = useRef(null)
  const stopRef      = useRef(null)
  const prevItemsRef = useRef(items)
  const onStopRef    = useRef(onStop)
  onStopRef.current  = onStop

  // After every React render, sync the DOM transform to posRef so React can
  // never overwrite our direct DOM updates with a stale value.
  useLayoutEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
    }
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

    // One full cycle of items in pixels — subtracting this is visually invisible
    const loopH = items.length * ITEM_H

    const wrap = () => {
      if (posRef.current >= initOffset + loopH) posRef.current -= loopH
    }

    if (spinning) {
      const duration = fast
        ? 900 + Math.random() * 200
        : durationMs + Math.random() * jitterMs
      const startTime = performance.now()
      const MAX_VEL   = ITEM_H / FAST_MS   // px per ms at peak speed
      let lastFrame   = startTime

      // Set transition once — not every frame
      if (trackRef.current) trackRef.current.style.transition = 'none'

      const frame = (now) => {
        const elapsed = now - startTime
        const t       = Math.min(elapsed / duration, 1.0)

        // Full speed until KICK, then smoothstep S-curve to zero
        const KICK  = 0.45
        const t2    = t < KICK ? 0 : (t - KICK) / (1 - KICK)
        const eased = t2 * t2 * (3 - 2 * t2)

        const vel = MAX_VEL * (1 - eased)               // px/ms, peaks then tapers to 0
        const dt  = Math.min(now - lastFrame, 50)        // cap delta to guard against tab-switch jank
        lastFrame = now

        posRef.current += vel * dt
        wrap()

        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
        }

        if (t >= 1.0) {
          // Short ease-out snap to nearest item boundary
          const snapped      = Math.round(posRef.current / ITEM_H) * ITEM_H
          posRef.current     = snapped
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
      const VEL     = ITEM_H / IDLE_MS   // px/ms at idle speed
      let lastFrame = performance.now()

      if (trackRef.current) trackRef.current.style.transition = 'none'

      const frame = (now) => {
        const dt  = Math.min(now - lastFrame, 50)
        lastFrame = now
        posRef.current += VEL * dt
        wrap()
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(0,${-(posRef.current - CENTER * ITEM_H)}px,0)`
        }
        rafRef.current = requestAnimationFrame(frame)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(stopRef.current)
    }
  }, [spinning, idle, items, initOffset, fast])

  return (
    <div className={`reel-outer${locked ? ' reel-locked' : ''}${blurred ? ' reel-blurred' : ''}`}>
      <div className="reel-label">{label}</div>
      <div className="reel-window">
        <div className="reel-selector" />
        <div ref={trackRef} className="reel-track" style={{ willChange: 'transform' }}>
          {allItems.map((item, i) => (
            <div key={i} className="reel-row" style={{ height: ITEM_H }}>
              <div className="reel-primary">{getDisplay(item)}</div>
              {getSub && <div className="reel-secondary">{getSub(item)}</div>}
            </div>
          ))}
        </div>
      </div>
      {locked && <div className="reel-locked-pip" />}
    </div>
  )
}

// ─── Chip ────────────────────────────────────────────────────────────────────
function Chip({ type, meta, val, selectedQB, draggingType, onChipTap, onDragStart, onDragEnd, setDraggingType }) {
  const photo = HEADSHOTS[selectedQB.name] ? `/headshots/${HEADSHOTS[selectedQB.name]}.jpg` : null
  const chipData = {
    type, val,
    qb: selectedQB.short, qbFull: selectedQB.name,
    teamColor: selectedQB.color, teamColor2: selectedQB.color2,
    skinColor: selectedQB.skin, number: selectedQB.number,
    team: selectedQB.team, captain: selectedQB.captain ?? false, photo,
  }
  return (
    <div
      className={`attr-chip attr-chip-${type}${draggingType === type ? ' chip-dragging' : ''}`}
      style={{ '--chip-col': meta.col }}
      draggable
      onClick={() => onChipTap && onChipTap(chipData)}
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', type)
        const ghost = document.createElement('div')
        ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:150px;border-radius:5px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,0.55);pointer-events:none;font-family:Outfit,sans-serif;'
        ghost.innerHTML = `<div style="display:flex;align-items:stretch;background:#fff;">${photo ? `<img src="${photo}" style="width:42px;height:42px;object-fit:cover;object-position:top center;flex-shrink:0;display:block;" />` : ''}<span style="font-size:11px;font-weight:900;color:#e8192c;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;display:flex;align-items:center;padding:0 7px;line-height:1.2;">${selectedQB.name}</span></div>`
        document.body.appendChild(ghost)
        e.dataTransfer.setDragImage(ghost, 75, 21)
        requestAnimationFrame(() => document.body.removeChild(ghost))
        onDragStart(chipData)
      }}
      onDragEnd={onDragEnd}
    >
      <div className="chip-text">
        <span className="chip-name">{meta.label}</span>
        <span className="chip-qb">{selectedQB.name}</span>
      </div>
      <span className="chip-val">{valToGrade(val)}</span>
      <span className="chip-hint">drag</span>
    </div>
  )
}

// ─── SpinScreen ──────────────────────────────────────────────────────────────
export default function SpinScreen({ build, activeDrag, onDragStart, onDragEnd, activeCategory, resetKey, onChipTap, types = TYPES, isLite = false, savedResult = null, onSaveResult }) {
  const [phase, setPhase]               = useState(() => savedResult?.selectedQB ? 'done' : 'idle')
  const [selectedTeam, setSelectedTeam] = useState(() => savedResult?.selectedTeam ?? null)
  const [selectedQB,   setSelectedQB]   = useState(() => savedResult?.selectedQB ?? null)
  const [qbRespinUsed, setQbRespinUsed] = useState(() => savedResult?.qbRespinUsed ?? false)
  const [excludedQB,   setExcludedQB]   = useState(null)
  const [draggingType, setDraggingType] = useState(null)
  const [spinCount, setSpinCount]       = useState(0)
  const pauseRef = useRef(null)

  const complete = types.every(t => build[t])

  const clearAll = () => clearTimeout(pauseRef.current)

  useEffect(() => {
    if (resetKey === 0) return
    clearAll()
    setPhase('idle')
    setSelectedTeam(null)
    setSelectedQB(null)
    setExcludedQB(null)
    setDraggingType(null)
    const panel = document.querySelector('.spin-panel')
    if (panel) panel.scrollTop = 0
  }, [resetKey])

  useEffect(() => () => clearAll(), [])

  useEffect(() => {
    if (!onSaveResult) return
    if (phase === 'done' && selectedQB) onSaveResult({ selectedTeam, selectedQB, qbRespinUsed })
    else if (phase === 'idle') onSaveResult(null)
  }, [phase, selectedTeam, selectedQB, qbRespinUsed])

  // Team reel calls this when it naturally halts
  const handleTeamStop = useCallback((team) => {
    setSelectedTeam(team)
    setPhase('team-done')
    pauseRef.current = setTimeout(() => setPhase('qb'), 300)
  }, [])

  // QB reel calls this when it naturally halts
  const handleQBStop = useCallback((qb) => {
    setSelectedQB(qb)
    setPhase('done')
  }, [])

  const handleSpin = useCallback(() => {
    clearAll()
    setSelectedTeam(null)
    setSelectedQB(null)
    setExcludedQB(null)
    setSpinCount(c => c + 1)
    onSaveResult?.(null)
    setPhase('team')
  }, [onSaveResult])

  const handleQBRespin = useCallback(() => {
    setExcludedQB(selectedQB)
    setQbRespinUsed(true)
    setSelectedQB(null)
    setPhase('qb')
  }, [selectedQB])

  const isSpinningTeam = phase === 'team'
  const isSpinningQB   = phase === 'qb'
  const isSpinning     = isSpinningTeam || phase === 'team-done' || isSpinningQB
  const isDone         = phase === 'done'

  const teamReelItems = useMemo(() => {
    const arr = [...TEAMS]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [spinCount])

  // Stable QB items — minimal placeholder until team is selected (QB reel is blurred/hidden)
  const qbReelItems = useMemo(() => {
    if (!selectedTeam) return QBS.slice(0, 3)
    const base = QBS.filter(q => q.team === selectedTeam.short)
    const filtered = excludedQB ? base.filter(q => q !== excludedQB) : base
    return [...filtered].sort(() => Math.random() - 0.5)
  }, [selectedTeam, excludedQB])

  const visibleCategories = CATEGORIES
  const hasAvailableChips = isDone && selectedQB && CATEGORIES.some(cat =>
    cat.types.some(type => types.includes(type) && !build[type])
  )

  return (
    <aside className="spin-panel">
      {isSpinning && <div className="spin-blocker" />}
      <div className="spin-panel-body">
        <div className="reels-wrap">
          <div className="reel-tri reel-tri-l" />
          <div className="reels-row">
            <SlotReel
              label="TEAM"
              items={teamReelItems}
              spinning={isSpinningTeam}
              idle={!isSpinning && !selectedTeam}
              locked={!!selectedTeam}
              getDisplay={t => t.short}
              getSub={t => t.name.split(' ').slice(-1)[0]}
              onStop={handleTeamStop}
              durationMs={1000}
              jitterMs={1000}
            />
            <SlotReel
              label="QB"
              items={qbReelItems}
              spinning={isSpinningQB}
              idle={!isSpinning && !selectedQB}
              locked={!!selectedQB && phase === 'done'}
              getDisplay={q => q.name.split(' ')[0]}
              getSub={q => q.name.split(' ').slice(1).join(' ')}
              onStop={handleQBStop}
              blurred={phase === 'team' || phase === 'team-done'}
              fast={qbRespinUsed}
            />
          </div>
          <div className="reel-tri reel-tri-r" />
        </div>

        {(() => {
          const canRespin = isDone && !qbRespinUsed && !complete
          return (
            <button
              className={`spin-btn${isDone && !canRespin ? ' spin-btn-wait' : ''}`}
              onClick={canRespin ? handleQBRespin : handleSpin}
              disabled={isSpinning || complete || (isDone && !canRespin)}
            >
              {canRespin ? <>QB RESPIN? <span className="spin-btn-badge">1</span></> : 'SPIN'}
            </button>
          )
        })()}

        {isDone && selectedQB && (
          <>
            <div className="qb-reveal-card" style={{ '--qb-color': selectedQB.color }}>
              <div className="qb-reveal-hero">
                <QBAvatar
                  photo={HEADSHOTS[selectedQB.name] ? `/headshots/${HEADSHOTS[selectedQB.name]}.jpg` : null}
                  team={selectedQB.team}
                  color={selectedQB.color}
                  size={88}
                />
              </div>
              <div className="qb-reveal-text">
                <div className="qb-reveal-name">{selectedQB.name}</div>
                <div className="qb-reveal-meta">{selectedQB.teamName}{selectedQB.starter ? '' : ' · Backup'}</div>
              </div>
            </div>

            {hasAvailableChips ? (
              <>
                {(isLite || types.length <= 4)
                  ? types.filter(t => !build[t]).map(t => {
                      const meta = ATTR[t]
                      const val  = selectedQB.attrs[t]
                      return <Chip key={t} type={t} meta={meta} val={val} selectedQB={selectedQB} draggingType={draggingType} onChipTap={onChipTap} onDragStart={onDragStart} onDragEnd={onDragEnd} setDraggingType={setDraggingType} />
                    })
                  : visibleCategories.map(cat => {
                      const available = cat.types.filter(type => types.includes(type) && !build[type])
                      if (!available.length) return null
                      return (
                        <div key={cat.id} className="attr-category-section">
                          <div className="attr-category-hd">
                            <div className="attr-category-line" />
                            <span className="attr-category-lbl">{cat.label}</span>
                            <div className="attr-category-line" />
                          </div>
                          {available.map(type => {
                            const meta = ATTR[type]
                            const val  = selectedQB.attrs[type]
                            return <Chip key={type} type={type} meta={meta} val={val} selectedQB={selectedQB} draggingType={draggingType} onChipTap={onChipTap} onDragStart={onDragStart} onDragEnd={onDragEnd} setDraggingType={setDraggingType} />
                          })}
                        </div>
                      )
                    })
                }
              </>
            ) : (
              <div className="spin-hint-text">
                {complete ? 'All slots filled' : 'All available slots filled for this QB'}
              </div>
            )}
          </>
        )}

{!isDone && (
          <div className="spin-hint-text">
            Spin to reveal a QB.<span className="hint-mobile-assign"><br />Select an attribute for your build.</span>
          </div>
        )}

        {complete && (
          <div className="spin-hint-text" style={{ color: 'var(--accent)', paddingTop: 4 }}>
            All 9 slots filled — simulate your season
          </div>
        )}
      </div>
    </aside>
  )
}
