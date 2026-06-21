import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { ATTR, TYPES, CATEGORIES, QB_PHYSICALS } from '../data/qbs'

function fmtHeight(in_) { return `${Math.floor(in_ / 12)}'${in_ % 12}"` }
import QBFigureOverlay from './QBFigureOverlay'

// Figure coordinate space (matches SVG viewBox 0 0 622 844)
const FIG_W = 622
const FIG_H = 844
const CARD_W = 207  // must match .cz-card width in CSS

// Anchor positions in figure coordinate space
// ax: 0=left edge of figure, 622=right edge
// ay: 0=top of figure, 844=bottom
// cy: fixed card Y position as fraction of sil-wrap height (cards don't track the dot)
const ZONES = [
  { type: 'football-iq',     ax: 275, ay:  42, side: 'left',  cy: 0.114 },
  { type: 'leadership',      ax: 330, ay: 120, side: 'right', cy: 0.114 },
  { type: 'arm-strength',    ax: 171, ay: 175, side: 'left',  cy: 0.314 },
  { type: 'strength',        ax: 340, ay: 310, side: 'right', cy: 0.514 },
  { type: 'accuracy',        ax: 110, ay: 216, side: 'left',  cy: 0.514 },
  { type: 'composure',       ax: 350, ay: 240, side: 'right', cy: 0.314 },
  { type: 'mobility',        ax: 207, ay: 525, side: 'left',  cy: 0.714 },
  { type: 'pocket-presence', ax: 465, ay: 520, side: 'right', cy: 0.714 },
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

function CZCard({ zone, cardY, build, activeDrag, hidden, invisible }) {
  const meta  = ATTR[zone.type]
  const data  = build[zone.type]
  const filled = !!data

  return (
    <div
      className={[
        'cz-card', `cz-${zone.side}`,
        filled    && 'cz-filled',
        hidden    && 'cz-hidden',
        invisible && 'cz-invisible',
      ].filter(Boolean).join(' ')}
      style={{ top: `${cardY ?? 50}%` }}
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
          <span className="cz-qb-name">
              <span>{data.qbFull.split(' ')[0]}</span>
              <span>{data.qbFull.split(' ').slice(1).join(' ')}</span>
            </span>
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

const MOBILE_CARD_W = 18   // card CSS width (82px) minus card offset (64px each side)

export default function Silhouette({ build, activeDrag, onDrop, activeCategory, onCategoryChange, types = TYPES, isLite = false }) {
  const silRef = useRef(null)
  const bounds = useFigureBounds(silRef)
  const boundsRef = useRef(bounds)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  )
  const activeDragRef = useRef(activeDrag)
  const onDropRef = useRef(onDrop)
  useLayoutEffect(() => { boundsRef.current = bounds }, [bounds])
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])
  useLayoutEffect(() => { onDropRef.current = onDrop }, [onDrop])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Native drop — only registers within ~80 figure-units of the zone dot
  useEffect(() => {
    const el = silRef.current
    if (!el) return
    const onDragOver = (e) => e.preventDefault()
    const onDropNative = (e) => {
      e.preventDefault()
      const ad = activeDragRef.current
      if (!ad) return
      const b = boundsRef.current
      if (!b) return
      const rect = el.getBoundingClientRect()
      const { W, H, fx, fy, scale } = b
      const figX = ((e.clientX - rect.left) / rect.width  * W - fx) / scale
      const figY = ((e.clientY - rect.top)  / rect.height * H - fy) / scale
      const zone = ZONES.find(z => z.type === ad.type)
      if (!zone) return
      const dist = Math.sqrt((figX - zone.ax) ** 2 + (figY - zone.ay) ** 2)
      if (dist <= 80) onDropRef.current(ad.type)
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
  const complete = types.every(t => build[t])

  // Convert figure-space (ax, ay) → sil-wrap percentage coords
  const pos = (zone) => {
    if (!bounds) return null
    const { W, H, fx, fy, scale } = bounds
    const effectiveCardW = isMobile ? MOBILE_CARD_W : CARD_W
    const dotX  = (fx + zone.ax * scale) / W * 100
    const dotY  = (fy + zone.ay * scale) / H * 100
    const cardY = zone.cy * 100
    const lineX = zone.side === 'left'
      ? (effectiveCardW / W) * 100
      : ((W - effectiveCardW) / W) * 100
    const stubPx = isMobile ? 12 : 125
    const stub   = stubPx / W * 100
    const stubX  = zone.side === 'left' ? lineX + stub : lineX - stub
    return { dotX, dotY, cardY, lineX, stubX }
  }

  return (
    <section className="field-center">
      <div className="category-pills">
        <HWTracker build={build} />
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
            style={isLite ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
            onClick={() => onCategoryChange(activeCategory === cat.id ? null : cat.id)}
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
          {ZONES.filter(z => types.includes(z.type)).map(zone => {
            const hidden = !isLite && !complete && (!activeCategory || !categoryTypes?.includes(zone.type))
            const p = pos(zone)
            if (!p) return null
            return (
              <path
                key={zone.type}
                d={`M ${p.lineX} ${p.cardY} L ${p.stubX} ${p.cardY} L ${p.dotX} ${p.dotY}`}
                stroke="#e8192c"
                strokeWidth="0.3"
                fill="none"
                style={{ opacity: hidden ? 0 : 1 }}
              />
            )
          })}
        </svg>

        {/* Dots + cards */}
        <div className="cz-layer" style={{ zIndex: 10 }}>
          {ZONES.filter(z => types.includes(z.type)).map(zone => {
            const hiddenFromTab = !isLite && !complete && (!activeCategory || !categoryTypes?.includes(zone.type))
            const p = pos(zone)
            return (
              <div key={zone.type}>
                {p && (
                  <div
                    className={['cz-dot', hiddenFromTab && 'cz-hidden'].filter(Boolean).join(' ')}
                    style={{ left: `${p.dotX}%`, top: `${p.dotY}%` }}
                  />
                )}
                {p && !hiddenFromTab && activeDrag?.type === zone.type && !build[zone.type] && (
                  <div className="cz-drop-zone" style={{ left: `${p.dotX}%`, top: `${p.dotY}%` }} />
                )}
                <CZCard
                  zone={zone}
                  cardY={p?.cardY}
                  build={build}
                  activeDrag={activeDrag}
                  hidden={!p}
                  invisible={hiddenFromTab && !!p}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="progress-strip">
        {types.map(t => (
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
