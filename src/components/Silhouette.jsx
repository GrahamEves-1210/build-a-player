import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { ATTR, TYPES, CATEGORIES, QB_PHYSICALS } from '../data/qbs'

function fmtHeight(in_) { return `${Math.floor(in_ / 12)}'${in_ % 12}"` }
import QBFigureOverlay from './QBFigureOverlay'

// Figure coordinate space (matches SVG viewBox 0 0 622 844)
const FIG_W = 622
const FIG_H = 844
const CARD_W = 150  // must match .cz-card width in CSS

// Anchor positions in figure coordinate space
// ax: 0=left edge of figure, 622=right edge
// ay: 0=top of figure, 844=bottom
const ZONES = [
  { type: 'football-iq',  ax: 308, ay:  42, side: 'right' },  // helmet center
  { type: 'arm-strength', ax: 171, ay: 175, side: 'left'  },  // throwing shoulder
  { type: 'accuracy',     ax:  90, ay: 230, side: 'left'  },  // right (throwing) hand
  { type: 'composure',    ax: 300, ay: 270, side: 'left'  },  // heart / upper chest
  { type: 'strength',     ax: 310, ay: 310, side: 'right' },  // torso center
  { type: 'mobility',     ax: 217, ay: 525, side: 'left'  },  // upper legs — right thigh
]

function useFigureBounds(ref) {
  const [bounds, setBounds] = useState(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const compute = () => {
      const { width: W, height: H } = ref.current.getBoundingClientRect()
      if (!W || !H) return
      const scale = Math.min(W / FIG_W, H / FIG_H)
      setBounds({
        W, H, scale,
        fx: (W - FIG_W * scale) / 2,  // left offset of figure in sil-wrap
        fy: (H - FIG_H * scale) / 2,  // top offset
      })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return bounds
}

function CZCard({ zone, dotY, build, activeDrag, onDrop, hidden }) {
  const [over, setOver] = useState(false)
  const meta   = ATTR[zone.type]
  const data   = build[zone.type]
  const filled  = !!data
  const canDrop = activeDrag?.type === zone.type && !filled

  return (
    <div
      className={[
        'cz-card', `cz-${zone.side}`,
        filled   && 'cz-filled',
        canDrop  && 'cz-can-drop',
        over && canDrop && 'cz-drag-over',
        hidden   && 'cz-hidden',
      ].filter(Boolean).join(' ')}
      style={{ top: `${dotY ?? 50}%` }}
      onDragEnter={e => { e.preventDefault(); if (canDrop) setOver(true) }}
      onDragOver={e => { e.preventDefault(); if (canDrop) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); if (canDrop) onDrop(zone.type) }}
    >
      <div className="cz-tag">{meta.label}</div>
      {filled && (
        <div className="cz-player-drop">
          {data.photo && (
            <img
              className="cz-headshot"
              src={data.photo}
              alt={data.qbFull}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <span className="cz-qb-name">{data.qbFull}</span>
        </div>
      )}
      {!filled && (
        <div className="cz-drop-hint" />
      )}
    </div>
  )
}

function HWTracker({ build }) {
  const bodyPhys = build['strength'] ? QB_PHYSICALS[build['strength'].qbFull] : null
  const legsPhys = build['mobility'] ? QB_PHYSICALS[build['mobility'].qbFull] : null
  const both = bodyPhys && legsPhys
  const ht = both ? fmtHeight(Math.round(0.65 * legsPhys.height + 0.35 * bodyPhys.height)) : null
  const wt = both ? Math.round(0.65 * bodyPhys.weight + 0.35 * legsPhys.weight) : null
  return (
    <div className="hw-tracker hw-tracker-pills">
      <div className="hw-stat">
        <span className="hw-label">HT</span>
        <span className={`hw-value${!ht ? ' hw-empty' : ''}`}>{ht ?? '--'}</span>
      </div>
      <div className="hw-divider" />
      <div className="hw-stat">
        <span className="hw-label">WT</span>
        <span className={`hw-value${!wt ? ' hw-empty' : ''}`}>
          {wt ? <>{wt} <span className="hw-unit">lbs</span></> : '--'}
        </span>
      </div>
    </div>
  )
}

export default function Silhouette({ build, activeDrag, onDrop, activeCategory, onCategoryChange }) {
  const silRef = useRef(null)
  const bounds = useFigureBounds(silRef)
  const activeDragRef = useRef(activeDrag)
  const onDropRef = useRef(onDrop)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])
  useLayoutEffect(() => { onDropRef.current = onDrop }, [onDrop])

  // Native DOM drag listeners — React synthetic drag events are unreliable
  useEffect(() => {
    const el = silRef.current
    if (!el) return
    const onDragOver = (e) => e.preventDefault()
    const onDropNative = (e) => {
      e.preventDefault()
      const ad = activeDragRef.current
      if (ad) onDropRef.current(ad.type)
    }
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDropNative)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDropNative)
    }
  }, [])

  const categoryTypes = activeCategory
    ? (CATEGORIES.find(c => c.id === activeCategory)?.types ?? [])
    : null

  // Convert figure-space (ax, ay) → sil-wrap percentage coords
  const pos = (zone) => {
    if (!bounds) return null
    const { W, H, fx, fy, scale } = bounds
    const dotX = (fx + zone.ax * scale) / W * 100
    const dotY = (fy + zone.ay * scale) / H * 100
    // line endpoint x: right edge of left card, or left edge of right card
    const lineX = zone.side === 'left'
      ? (CARD_W / W) * 100
      : ((W - CARD_W) / W) * 100
    return { dotX, dotY, lineX }
  }

  return (
    <section className="field-center">
      <div className="category-pills">
        <HWTracker build={build} />
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="sil-wrap" ref={silRef}>
        <img src="/qb-silhouette.png" alt="" className="sil-img" draggable={false} />
        <QBFigureOverlay build={build} className="player-qbfig" />

        {/* Lines — stretch to fill sil-wrap via preserveAspectRatio="none" */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="cz-lines-svg"
          aria-hidden="true"
        >
          {ZONES.map(zone => {
            const hidden = !!categoryTypes && !categoryTypes.includes(zone.type) && !build[zone.type] && activeDrag?.type !== zone.type
            if (hidden || !bounds) return null
            const p = pos(zone)
            if (!p) return null
            return (
              <line
                key={zone.type}
                x1={p.dotX} y1={p.dotY}
                x2={p.lineX} y2={p.dotY}
                stroke="#e8192c"
                strokeWidth="0.3"
              />
            )
          })}
        </svg>

        {/* Dots + cards */}
        <div className="cz-layer" style={{ zIndex: 10 }}>
          {ZONES.map(zone => {
            const isDragTarget = activeDrag?.type === zone.type
            const hidden = !!categoryTypes && !categoryTypes.includes(zone.type) && !build[zone.type] && !isDragTarget
            const p = pos(zone)
            return (
              <div key={zone.type}>
                {p && (
                  <div
                    className={['cz-dot', hidden && 'cz-hidden'].filter(Boolean).join(' ')}
                    style={{ left: `${p.dotX}%`, top: `${p.dotY}%` }}
                  />
                )}
                <CZCard
                  zone={zone}
                  dotY={p?.dotY}
                  build={build}
                  activeDrag={activeDrag}
                  onDrop={onDrop}
                  hidden={hidden || !p}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="progress-strip">
        {TYPES.map(t => (
          <div
            key={t}
            className={`p-seg ${build[t] ? 'on' : ''}`}
            style={build[t] ? { background: ATTR[t].col } : undefined}
            title={ATTR[t].label}
          />
        ))}
      </div>
    </section>
  )
}
