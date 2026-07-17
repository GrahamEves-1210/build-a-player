import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { ATTR, TYPES, CATEGORIES, QB_PHYSICALS } from '../data/qbs'
import { RB_CATEGORIES, RB_PHYSICALS } from '../data/rbs'
import { QB_LEGEND_PHYSICALS } from '../data/legends'
import { RB_LEGEND_PHYSICALS } from '../data/rb-legends'
import NBA_MEASUREMENTS from '../data/nba-measurements.json'
import { NBA_FACE_ADJUSTMENTS } from '../data/nba-face-adjustments'
const ALL_QB_PHYS = { ...QB_LEGEND_PHYSICALS, ...QB_PHYSICALS }
const ALL_RB_PHYS = { ...RB_LEGEND_PHYSICALS, ...RB_PHYSICALS }
import QBAvatar from './QBAvatar'

function fmtHeight(in_) { return `${Math.floor(in_ / 12)}'${in_ % 12}"` }
function lightenHex(hex, amt) {
  if (!hex || !hex.startsWith('#')) return hex
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + amt)
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + amt)
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + amt)
  return `rgb(${r},${g},${b})`
}
import QBFigureOverlay from './QBFigureOverlay'
import RBFigureOverlay from './RBFigureOverlay'
import BucketFigureOverlay from './BucketFigureOverlay'

// Figure coordinate space (matches QB silhouette dimensions)
const FIG_W = 622
const FIG_H = 844
const CARD_W = 211  // must match .cz-card width in CSS

// RB silhouette coordinate space
const RB_FIG_W = 574
const RB_FIG_H = 865

// CSS scale applied to the RB figure image + overlay
const RB_FIGURE_SCALE = 0.90
const BUCKET_FIGURE_SCALE = 1.10

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

function CZCard({ zone, cardY, build, activeDrag, hidden, invisible, isMobile, attrMap = ATTR, logoDir = '/logos/' }) {
  const meta  = attrMap[zone.type]
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
            logoDir={logoDir}
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

function HWTracker({ build, isRB = false, isBucket = false }) {
  let ht, wt
  if (isBucket) {
    const phys = build['size'] ? NBA_MEASUREMENTS[build['size'].qbFull] : null
    ht = phys ? fmtHeight(phys.height) : null
    wt = phys ? phys.weight : null
  } else if (isRB) {
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

// Basketball silhouette coordinate space (matches PNG pixel dimensions 936×897)
const BUCKET_FIG_W = 936
const BUCKET_FIG_H = 897
// Head center in bucket figure space (calibrated to basketballsilhouetteheadless.png)
const BUCKET_HEAD    = { ax: 468, ay: 74,  r: 54 }
const BUCKET_COLLAR_AY = 140  // SVG y where jersey collar meets shoulder (left stripe ends ~143)

const BUCKET_ZONES = [
  { type: 'basketballIQ',    ax: 415, ay:   -5, side: 'left',  cy: 0.015 },
  { type: 'clutch',          ax: 440, ay:  180, side: 'left',  cy: 0.690 },
  { type: 'jumpShot',        ax: 230, ay:  160, side: 'left',  cy: 0.526 },
  { type: 'finishing',       ax: 670, ay:  135, side: 'right', cy: 0.526 },
  { type: 'handles',         ax: 845, ay:  125, side: 'right', cy: 0.360, lineAnchor: 'top', lineAnchorOffsetX: 50 },
  { type: 'passing',         ax:  90, ay:  155, side: 'left',  cy: 0.360, lineAnchor: 'top' },
  { type: 'size',            ax: 610, ay:  430, side: 'right', cy: 0.044, noDot: true },
  { type: 'perimeterDefense',ax: 550, ay:  115, side: 'right', cy: 0.690 },
  { type: 'speed',           ax: 535, ay:  485, side: 'right', cy: 0.87 },
  { type: 'bounce',          ax: 390, ay:  820, side: 'left',  cy: 0.87 },
]

const BUCKET_BIG_ZONES = [
  { type: 'basketballIQ',   ax: 415, ay:   -5, side: 'left',  cy: 0.015 },
  { type: 'clutch',         ax: 440, ay:  180, side: 'left',  cy: 0.690 },
  { type: 'jumpShot',       ax: 230, ay:  160, side: 'left',  cy: 0.526 },
  { type: 'finishing',      ax: 670, ay:  135, side: 'right', cy: 0.526 },
  { type: 'playmaking',     ax: 845, ay:  125, side: 'right', cy: 0.360, lineAnchor: 'top', lineAnchorOffsetX: 50 },
  { type: 'rebounding',     ax:  90, ay:  155, side: 'left',  cy: 0.360, lineAnchor: 'top' },
  { type: 'size',           ax: 610, ay:  430, side: 'right', cy: 0.044, noDot: true },
  { type: 'interiorDefense',ax: 550, ay:  115, side: 'right', cy: 0.690 },
  { type: 'speed',          ax: 535, ay:  485, side: 'right', cy: 0.87 },
  { type: 'bounce',         ax: 390, ay:  820, side: 'left',  cy: 0.87 },
]

function getDominantPlayer(build) {
  const counts = {}
  Object.values(build).forEach(chip => {
    if (!chip) return
    counts[chip.qbFull] = (counts[chip.qbFull] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? null
}

export default function Silhouette({ build, activeDrag, onDrop, activeCategory, onCategoryChange, types = TYPES, isLite = false, onReset, isRB = false, isBucket = false, isPlus = false, isCustomMode = false, onOpenCustomModal, onSandboxToggle, attrMap = ATTR, categoriesData = CATEGORIES, figureRef }) {
  const figW   = isBucket ? BUCKET_FIG_W : (isRB ? RB_FIG_W : FIG_W)
  const figH   = isBucket ? BUCKET_FIG_H : (isRB ? RB_FIG_H : FIG_H)
  const zones  = isBucket ? (types.includes('interiorDefense') ? BUCKET_BIG_ZONES : BUCKET_ZONES) : isRB ? RB_ZONES : ZONES
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

  const cats = isRB ? RB_CATEGORIES : categoriesData
  const categoryTypes = activeCategory
    ? (cats.find(c => c.id === activeCategory)?.types ?? [])
    : null
  const complete = types.every(t => build[t])

  // Headshot only from basketballIQ slot for bucket builds
  const bucketPhoto = isBucket
    ? (build['basketballIQ']?.photo || null)
    : null

  // Sample bottom color + capture aspect ratio for correct objectPosition centering
  const [hsBottomColor, setHsBottomColor] = useState(null)
  const [hsImgRatio, setHsImgRatio] = useState(1.333)  // h/w, default 3:4 portrait
  useEffect(() => {
    if (!bucketPhoto) { setHsBottomColor(null); setHsImgRatio(1.333); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight
      const R = ih / iw
      setHsImgRatio(R)

      // Sample color at bottom of visible headshot (jersey area)
      const S = 200
      const canvas = document.createElement('canvas')
      canvas.width = S; canvas.height = S
      const ctx = canvas.getContext('2d')
      const sc = Math.max(S / iw, S / ih)
      const sw = iw * sc, sh = ih * sc
      // objectFit:cover + objectPosition:50% 50% draw position
      const ox = (S - sw) / 2, oy = (S - sh) / 2
      ctx.drawImage(img, ox, oy, sw, sh)
      const sampleY = Math.round(S * 0.88)
      const sampleX = Math.round(S / 2)
      const radius = 8
      let r = 0, g = 0, b = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const py = Math.min(S - 1, Math.max(0, sampleY + dy))
          const px = Math.min(S - 1, Math.max(0, sampleX + dx))
          const d = ctx.getImageData(px, py, 1, 1).data
          r += d[0]; g += d[1]; b += d[2]; count++
        }
      }
      setHsBottomColor(`rgb(${Math.round(r/count)},${Math.round(g/count)},${Math.round(b/count)})`)
    }
    img.onerror = () => setHsBottomColor(null)
    img.src = bucketPhoto
  }, [bucketPhoto])

  // Convert figure-space (ax, ay) → sil-wrap percentage coords
  const pos = (zone) => {
    if (!bounds) return null
    const { W, H, fx, fy, scale } = bounds
    const bucketCardScale = 0.88
    const cardEdgePx = isMobile
      ? isBucket
        ? -64 + (86 / 2) * (1 + bucketCardScale)   // -64px offset + scaled half-width × 2
        : MOBILE_CARD_W + (86 / 2) * 0.15           // default scale 1.15
      : isBucket
        ? (CARD_W / 2) + (CARD_W / 2) * bucketCardScale
        : CARD_W * 1.075
    let dotX  = (fx + zone.ax * scale) / W * 100
    let dotY  = (fy + zone.ay * scale) / H * 100 + (!isMobile && zone.type === 'size' ? (isBucket ? 60 : 30) / H * 100 : 0)
    // Compensate for CSS scale on RB/bucket figure — scale dot positions outward/inward from center
    if (isRB) {
      dotX = (dotX - 50) * RB_FIGURE_SCALE + 50
      dotY = (dotY - 50) * RB_FIGURE_SCALE + 50
    }
    if (isBucket) {
      dotX = (dotX - 50) * BUCKET_FIGURE_SCALE + 50
      dotY = (dotY - 50) * BUCKET_FIGURE_SCALE + 50
    }
    const zoneCardYNudgePx = (!isMobile && isBucket)
      ? (zone.type === 'passing' || zone.type === 'rebounding' ? -15 : zone.type === 'speed' ? 25 : zone.type === 'size' ? -100 : zone.type === 'handles' || zone.type === 'playmaking' ? -10 : 0)
      : 0
    const cardY = isMobile
      ? ((zone.cy - 0.5) * 0.92 + 0.5) * 100
      : zone.cy * 100 + (zoneCardYNudgePx / H) * 100
    const lineInsetPx = (!isMobile && isBucket) ? 10 : 0
    // Per-zone desktop line X nudge (positive = inward for both sides)
    const zoneLineNudge = (!isMobile && isBucket)
      ? (zone.type === 'passing' || zone.type === 'rebounding' ? -50 : zone.type === 'handles' || zone.type === 'playmaking' ? -50 : 0)
      : 0
    const lineX = zone.side === 'left'
      ? ((cardEdgePx + lineInsetPx - zoneLineNudge) / W) * 100
      : ((W - cardEdgePx - lineInsetPx + zoneLineNudge) / W) * 100
    const stubPx = isMobile ? 12 : (isBucket ? 88 : 125)
    const stub   = stubPx / W * 100
    const stubX  = zone.side === 'left' ? lineX + stub : lineX - stub
    // Center X of the card face (for top-anchor lines)
    // Left cards: left:0, so center = half card rendered width from left
    // Right cards: right:0, so center = W minus half card rendered width
    const cardScale = isBucket ? 0.88 : 1.15
    const cardHalfW = isMobile
      ? (86 / 2) / W * 100
      : (CARD_W * cardScale / 2) / W * 100
    const cardCenterX = zone.side === 'left'
      ? cardHalfW
      : 100 - cardHalfW
    const cardHalfH = isMobile
      ? (130 * 0.55 / 2) / H * 100
      : (130 * (isBucket ? 0.88 : 1.15) / 2) / H * 100
    // Per-zone desktop anchor nudges for top-anchor lines
    const anchorNudgeX = (!isMobile && isBucket)
      ? (zone.type === 'passing' || zone.type === 'rebounding' ? (295 / W) * 100 : zone.type === 'handles' || zone.type === 'playmaking' ? (-300 / W) * 100 : 0)
      : 0
    const anchorNudgeY = (!isMobile && isBucket)
      ? (zone.type === 'passing' || zone.type === 'rebounding' ? (-70 / H) * 100 : zone.type === 'handles' || zone.type === 'playmaking' ? (-60 / H) * 100 : 0)
      : 0
    return { dotX, dotY, cardY, lineX, stubX, cardCenterX, cardHalfH, anchorNudgeX, anchorNudgeY }
  }

  return (
    <section className="field-center">
      <div className="category-pills">
        <HWTracker build={build} isRB={isRB} isBucket={isBucket} />
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
      {(isBucket || !!onSandboxToggle) && (
        <div className="sil-sandbox-wrap">
          <span className="sil-sandbox-label">Sandbox</span>
          <label className="plus-toggle">
            <input type="checkbox" checked={!!isCustomMode} onChange={e => onSandboxToggle?.(e.target.checked)} />
            <span className="plus-toggle-track" />
          </label>
          <button
            className={`sil-custom-ratings-btn${!isCustomMode ? ' sil-custom-ratings-btn--off' : ''}`}
            onClick={isCustomMode ? onOpenCustomModal : undefined}
            disabled={!isCustomMode}
          >Custom Build</button>
        </div>
      )}

      <div className={`sil-wrap${isRB ? ' sil-wrap--rb' : ''}`} ref={silRef}>
        {isBucket && (
          <div style={{
            position: 'absolute',
            left: '50%', top: 'calc(15% + 42px)',
            transform: 'translate(-50%, -50%)',
            width: '40px', height: '40px',
            background: build?.['clutch']?.teamColor || '#333333',
            zIndex: 2,
            pointerEvents: 'none',
          }} />
        )}

        {/* Measurement outlines — height + wingspan derived from size val */}
        {isBucket && (build?.['size'] || build?.['heightLength']) && (() => {
          const chip = build['size'] || build['heightLength']
          const val  = chip.val ?? 5
          const col  = '#ffffff'
          const phys = NBA_MEASUREMENTS[chip.qbFull]

          const heightIn   = phys ? phys.height   : Math.round(72 + (val - 1) * 16 / 9)
          const wingspanIn = phys ? phys.wingspan  : Math.round(heightIn + 1 + (val - 1) * 8 / 9)

          // Player boundaries in bucket SVG viewBox coords (42.5 -35.2 850.9 815.5)
          const headY  = -85
          const footY  = 818
          const leftX  = -4
          const rightX = 940
          const midX   = 468
          const midY   = (headY + footY) / 2

          // Height bracket — right side
          const hx     = 682
          const tickH  = 10
          // Wingspan bracket — horizontal near feet
          const wy     = -28
          const tickW  = 10

          const lw  = 3.5
          const op  = 0.75
          const op2 = 1.0
          const font = "'Bebas Neue', monospace, sans-serif"

          return (
            <svg
              viewBox="42.5 -35.2 850.9 815.5"
              preserveAspectRatio="xMidYMid meet"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
              aria-hidden="true"
            >
              {/* HEIGHT: right-side vertical bracket */}
              <line x1={hx} y1={headY} x2={hx} y2={footY} stroke={col} strokeWidth={lw} strokeDasharray="7 5" opacity={op} />
              <line x1={hx - tickH} y1={headY} x2={hx + tickH} y2={headY} stroke={col} strokeWidth={lw * 1.3} opacity={op2} />
              <line x1={hx - tickH} y1={footY} x2={hx + tickH} y2={footY} stroke={col} strokeWidth={lw * 1.3} opacity={op2} />
              <text
                x={hx + 12} y={midY + 150}
                textAnchor="middle"
                fontFamily={font}
                fontSize="45"
                fill={col}
                opacity={op2}
                transform={`rotate(90, ${hx + 12}, ${midY + 150})`}
                style={{ userSelect: 'none' }}
              >{fmtHeight(heightIn)}  HEIGHT</text>

              {/* WINGSPAN: horizontal bracket near feet */}
              <line x1={leftX} y1={wy} x2={rightX} y2={wy} stroke={col} strokeWidth={lw} strokeDasharray="7 5" opacity={op} />
              <line x1={leftX} y1={wy - tickW} x2={leftX} y2={wy + tickW} stroke={col} strokeWidth={lw * 1.3} opacity={op2} />
              <line x1={rightX} y1={wy - tickW} x2={rightX} y2={wy + tickW} stroke={col} strokeWidth={lw * 1.3} opacity={op2} />
              <text
                x={midX - 200} y={wy + 36}
                textAnchor="middle"
                fontFamily={font}
                fontSize="41"
                fill={col}
                opacity={op2}
                style={{ userSelect: 'none' }}
              >{fmtHeight(wingspanIn)} WINGSPAN</text>
            </svg>
          )
        })()}

        <div ref={isBucket ? figureRef : undefined} style={{ position: 'absolute', inset: 0, ...(isBucket ? { pointerEvents: 'none' } : {}) }}>
        <img
          src={
            isBucket
              ? (bucketPhoto ? '/basketballsilhouetteheadless.png' : '/basketballsilhouette.png')
              : (isRB ? '/rbsilhouette.png' : '/qb-silhouette.png')
          }
          alt=""
          className={`sil-img${isRB ? ' sil-img--rb' : ''}${isBucket ? ' sil-img--bucket' : ''}`}
          draggable={false}
          style={isBucket ? { transform: `scale(${BUCKET_FIGURE_SCALE})`, transformOrigin: 'center center' } : isRB ? { transform: `scale(${RB_FIGURE_SCALE})`, transformOrigin: 'center center' } : undefined}
        />
        {isBucket && <BucketFigureOverlay build={build} />}
        {isBucket && bucketPhoto && bounds && (() => {
          const { W, H, fx, fy, scale } = bounds
          const hxRaw    = (fx + BUCKET_HEAD.ax    * scale) / W * 100
          const collarYRaw = (fy + BUCKET_COLLAR_AY * scale) / H * 100
          const hx       = 50 + (hxRaw     - 50) * BUCKET_FIGURE_SCALE
          const collarY  = 50 + (collarYRaw - 50) * BUCKET_FIGURE_SCALE
          const faceChip = build['basketballIQ']
          const fc = faceChip?.faceCenter
          const hpx = BUCKET_HEAD.r * 2 * scale * 1.805 * BUCKET_FIGURE_SCALE
          const R = hsImgRatio
          // Target face at ~58% of container: with clip bottom (89%) at collar,
          // this places the face near the silhouette head center
          const objPosY = fc && Math.abs(R - 1) > 0.05
            ? Math.max(0, Math.min(100, 100 * (0.58 - (fc[1] / 100) * R) / (1 - R)))
            : (fc ? fc[1] : 50)
          const objPos = `50% ${objPosY}%`
          const clipY = 45
          const faceScale = fc ? Math.max(0.93, Math.min(1.12, 1 + (42 - fc[1]) * 0.014)) : 1
          const playerName = faceChip?.qbFull || faceChip?.qb || ''
          const adj = NBA_FACE_ADJUSTMENTS[playerName] || { dx: 0, dy: 0, scale: 1 }
          return (
            <div
              key={bucketPhoto}
              style={{
                position: 'absolute',
                left: `${hx}%`,
                top: `${collarY}%`,
                width: `${hpx}px`,
                height: `${hpx}px`,
                transform: `translate(calc(-50% + 0.75px + ${adj.dx}px), calc(-89% + 4px + ${adj.dy}px))`,
                overflow: 'hidden',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 1,
                WebkitMaskImage: `radial-gradient(ellipse 82% 78% at 50% ${clipY}%, black 52%, transparent 84%)`,
                maskImage: `radial-gradient(ellipse 82% 78% at 50% ${clipY}%, black 52%, transparent 84%)`,
              }}
            >
              <img
                src={bucketPhoto}
                alt=""
                draggable={false}
                onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: objPos,
                  transform: `scale(${faceScale * adj.scale})`,
                  transformOrigin: `50% ${objPosY}%`,
                  filter: 'saturate(0.75) contrast(1.05)',
                }}
              />
            </div>
          )
        })()}
        </div>
        {!isRB && !isBucket && <QBFigureOverlay build={build} className="player-qbfig" />}
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
          {zones.filter(z => types.includes(z.type) && !z.noDot).map(zone => {
            const hidden = !isLite && !complete && (!activeCategory || !categoryTypes?.includes(zone.type))
            const p = pos(zone)
            if (!p) return null
            const cardTopY = p.cardY - p.cardHalfH
            const anchorX = p.cardCenterX - 25 + (zone.lineAnchorOffsetX ?? 0) + (p.anchorNudgeX ?? 0)
            const anchorY = cardTopY + 10 + (p.anchorNudgeY ?? 0)
            const d = zone.lineAnchor === 'top'
              ? `M ${anchorX} ${anchorY} L ${anchorX} ${anchorY - 8} L ${p.dotX} ${p.dotY}`
              : `M ${p.lineX} ${p.cardY} L ${p.stubX} ${p.cardY} L ${p.dotX} ${p.dotY}`
            return (
              <path
                key={zone.type}
                d={d}
                stroke={isBucket ? '#f97316' : '#e8192c'}
                strokeWidth="0.3"
                fill="none"
                style={{ opacity: hidden ? 0 : 1 }}
              />
            )
          })}
        </svg>

        {/* Dots + cards */}
        <div className="cz-layer" style={{ zIndex: 10 }}>
          {zones.filter(z => types.includes(z.type)).map(zone => {
            const hiddenFromTab = !isLite && !complete && (!activeCategory || !categoryTypes?.includes(zone.type))
            const p = pos(zone)
            return (
              <div key={zone.type}>
                {p && !zone.noDot && (
                  <div
                    className={['cz-dot', hiddenFromTab && 'cz-hidden'].filter(Boolean).join(' ')}
                    style={{ left: `${p.dotX}%`, top: `${p.dotY}%` }}
                  />
                )}
                {p && !zone.noDot && !hiddenFromTab && activeDrag?.type === zone.type && !build[zone.type] && (
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
                  attrMap={attrMap}
                  logoDir={isBucket ? '/logos/nba/' : '/logos/'}
                />
              </div>
            )
          })}
        </div>

        {onReset && (
          <button className="sil-reset-btn" onClick={onReset}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            <span>Reset</span>
          </button>
        )}
        {!isBucket && !onSandboxToggle && isPlus && (
          <button
            className={`sil-custom-ratings-btn${!isCustomMode ? ' sil-custom-ratings-btn--off' : ''}`}
            onClick={isCustomMode ? onOpenCustomModal : undefined}
            disabled={!isCustomMode}
          >Custom Build</button>
        )}
      </div>


    </section>
  )
}
