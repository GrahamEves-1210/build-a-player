import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { ATTR, TYPES, CATEGORIES, QB_PHYSICALS } from '../data/qbs'
import { RB_CATEGORIES, RB_PHYSICALS } from '../data/rbs'
import { QB_LEGEND_PHYSICALS } from '../data/legends'
import { RB_LEGEND_PHYSICALS } from '../data/rb-legends'
const ALL_QB_PHYS = { ...QB_LEGEND_PHYSICALS, ...QB_PHYSICALS }
const ALL_RB_PHYS = { ...RB_LEGEND_PHYSICALS, ...RB_PHYSICALS }
import QBAvatar from './QBAvatar'

function fmtHeight(in_) { return `${Math.floor(in_ / 12)}'${in_ % 12}"` }
import QBFigureOverlay from './QBFigureOverlay'
import RBFigureOverlay from './RBFigureOverlay'

// Figure coordinate space (matches QB silhouette dimensions)
const FIG_W = 622
const FIG_H = 844
const CARD_W = 211  // must match .cz-card width in CSS

// RB silhouette coordinate space
const RB_FIG_W = 574
const RB_FIG_H = 865

// CSS scale applied to the RB figure image + overlay
const RB_FIGURE_SCALE = 0.90

// QB anchor positions
const ZONES = [
  { type: 'vision',          ax: 375, ay:  75, side: 'right', cy: 0.09  },
  { type: 'processing',      ax: 275, ay:  42, side: 'left',  cy: 0.14  },
  { type: 'leadership',      ax: 330, ay: 120, side: 'right', cy: 0.277 },
  { type: 'arm',             ax: 171, ay: 175, side: 'left',  cy: 0.504 },
  { type: 'playmaking',      ax: 350, ay: 240, side: 'right', cy: 0.464 },
  { type: 'accuracy',        ax: 110, ay: 216, side: 'left',  cy: 0.322 },
  { type: 'size',            ax: 380, ay: 250, side: 'right', cy: 0.651 },
  { type: 'legs',            ax: 207, ay: 525, side: 'left',  cy: 0.686 },
  { type: 'pocket-presence', ax: 465, ay: 520, side: 'right', cy: 0.838 },
]

// RB anchor positions — calibrated to the running pose (head upper-right,
// stiff arm / ball arm right, free arm left, lead leg lower-right)
// cy values evenly spaced (0.06→0.94, step 0.11) alternating sides
const RB_ZONES = [
  { type: 'vision',      ax: 273, ay: 100, side: 'right', cy: 0.06 },  // helmet
  { type: 'burst',       ax: 144, ay: 620, side: 'left',  cy: 0.83 },  // left foot
  { type: 'hands',       ax: 175, ay: 473, side: 'left',  cy: 0.61 },  // right foot
  { type: 'strength',    ax:  84, ay: 286, side: 'left',  cy: 0.17 },  // left arm
  { type: 'carrying',    ax: 455, ay: 355, side: 'right', cy: 0.50 },  // right glove
  { type: 'balance',     ax: 245, ay: 359, side: 'left',  cy: 0.39 },  // waist/core
  { type: 'size',        ax: 315, ay: 245, side: 'right', cy: 0.28 },  // jersey
  { type: 'elusiveness', ax: 495, ay: 830, side: 'right', cy: 0.94 },  // left glove
  { type: 'speed',       ax: 300, ay: 510, side: 'right', cy: 0.72 },  // thighs
]

function useFigureBounds(ref, figW, figH) {
  const [bounds, setBounds] = useState(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const compute = () => {
      const W = ref.current.offsetWidth
      const H = ref.current.offsetHeight
      if (!W || !H) return
      const scale = Math.min(W / figW, H / figH)
      setBounds({
        W, H, scale,
        fx: (W - figW * scale) / 2,
        fy: (H - figH * scale) / 2,
      })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref, figW, figH])
  return bounds
}

function CZCard({ zone, cardY, build, activeDrag, hidden, invisible, isMobile }) {
  const meta  = ATTR[zone.type]
  const data  = build[zone.type]
  const filled = !!data

  return (
    <div
      className={[
        'cz-card', `cz-${zone.side}`, `cz-type-${zone.type}`,
        filled    && 'cz-filled',
        hidden    && 'cz-hidden',
        invisible && 'cz-invisible',
      ].filter(Boolean).join(' ')}
      style={{ top: `${cardY ?? 50}%` }}
    >
      <div className="cz-tag">{meta.label}</div>
      {filled && (
        <div className="cz-player-drop">
          <QBAvatar
            photo={data.photo}
            team={data.team}
            size={isMobile ? 26 : 53}
          />
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

function HWTracker({ build, isRB = false }) {
  let ht, wt
  if (isRB) {
    const rbPhys = build['size'] ? ALL_RB_PHYS[build['size'].qbFull] : null
    ht = rbPhys ? fmtHeight(rbPhys.height) : null
    wt = rbPhys ? rbPhys.weight : null
  } else {
    const bodyPhys = build['size'] ? ALL_QB_PHYS[build['size'].qbFull] : null
    const legsPhys = build['legs'] ? ALL_QB_PHYS[build['legs'].qbFull] : null
    const both = bodyPhys && legsPhys
    ht = both ? fmtHeight(Math.round(0.65 * legsPhys.height + 0.35 * bodyPhys.height)) : null
    wt = both ? Math.round(0.65 * bodyPhys.weight + 0.35 * legsPhys.weight) : null
  }
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

const MOBILE_CARD_W = 22   // card CSS width (86px) minus card offset (64px each side)

export default function Silhouette({ build, activeDrag, onDrop, activeCategory, onCategoryChange, types = TYPES, isLite = false, onReset, isRB = false, isPlus = false, isCustomMode = false, onOpenCustomModal }) {
  const figW   = isRB ? RB_FIG_W : FIG_W
  const figH   = isRB ? RB_FIG_H : FIG_H
  const zones  = isRB ? RB_ZONES : ZONES
  const silRef = useRef(null)
  const bounds = useFigureBounds(silRef, figW, figH)
  const boundsRef = useRef(bounds)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  )
  const activeDragRef = useRef(activeDrag)
  const onDropRef = useRef(onDrop)
  const zonesRef = useRef(zones)
  useLayoutEffect(() => { boundsRef.current = bounds }, [bounds])
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])
  useLayoutEffect(() => { onDropRef.current = onDrop }, [onDrop])
  useLayoutEffect(() => { zonesRef.current = zones }, [zones])

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
      const zone = zonesRef.current.find(z => z.type === ad.type)
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

  const cats = isRB ? RB_CATEGORIES : CATEGORIES
  const categoryTypes = activeCategory
    ? (cats.find(c => c.id === activeCategory)?.types ?? [])
    : null
  const complete = types.every(t => build[t])

  // Convert figure-space (ax, ay) → sil-wrap percentage coords
  const pos = (zone) => {
    if (!bounds) return null
    const { W, H, fx, fy, scale } = bounds
    const cardEdgePx = isMobile
      ? MOBILE_CARD_W + (86 / 2) * 0.15
      : CARD_W * 1.075
    let dotX  = (fx + zone.ax * scale) / W * 100
    let dotY  = (fy + zone.ay * scale) / H * 100
    // Compensate for CSS scale on RB figure — scale dot positions inward from center
    if (isRB) {
      dotX = (dotX - 50) * RB_FIGURE_SCALE + 50
      dotY = (dotY - 50) * RB_FIGURE_SCALE + 50
    }
    const cardY = isMobile
      ? ((zone.cy - 0.5) * 0.85 + 0.5) * 100
      : zone.cy * 100
    const lineX = zone.side === 'left'
      ? (cardEdgePx / W) * 100
      : ((W - cardEdgePx) / W) * 100
    const stubPx = isMobile ? 12 : 125
    const stub   = stubPx / W * 100
    const stubX  = zone.side === 'left' ? lineX + stub : lineX - stub
    return { dotX, dotY, cardY, lineX, stubX }
  }

  return (
    <section className="field-center">
      <div className="category-pills">
        <HWTracker build={build} isRB={isRB} />
        {cats.map(cat => (
          <button
            key={cat.id}
            className={`cat-pill ${(complete || activeCategory === cat.id) ? 'active' : ''}`}
            style={isLite ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
            onClick={() => !complete && activeCategory !== cat.id && onCategoryChange(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className={`sil-wrap${isRB ? ' sil-wrap--rb' : ''}`} ref={silRef}>
        <img
          src={isRB ? '/rbsilhouette.png' : '/qb-silhouette.png'}
          alt=""
          className={`sil-img${isRB ? ' sil-img--rb' : ''}`}
          draggable={false}
          style={isRB ? { transform: `scale(${RB_FIGURE_SCALE})`, transformOrigin: 'center center' } : undefined}
        />
        {!isRB && <QBFigureOverlay build={build} className="player-qbfig" />}
        {isRB && (
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${RB_FIGURE_SCALE})`, transformOrigin: 'center center' }}>
            <RBFigureOverlay build={build} />
          </div>
        )}

        {/* Lines — stretch to fill sil-wrap via preserveAspectRatio="none" */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="cz-lines-svg"
          aria-hidden="true"
        >
          {zones.filter(z => types.includes(z.type)).map(zone => {
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

        {onReset && (
          <button className="sil-reset-btn" onClick={onReset}>Reset Build</button>
        )}
        {isPlus && (
          <button
            className={`sil-custom-ratings-btn${!isCustomMode ? ' sil-custom-ratings-btn--off' : ''}`}
            onClick={isCustomMode ? onOpenCustomModal : undefined}
            disabled={!isCustomMode}
          >Custom Build</button>
        )}

        {/* Dots + cards */}
        <div className="cz-layer" style={{ zIndex: 10 }}>
          {zones.filter(z => types.includes(z.type)).map(zone => {
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
                  isMobile={isMobile}
                />
              </div>
            )
          })}
        </div>
      </div>


    </section>
  )
}
