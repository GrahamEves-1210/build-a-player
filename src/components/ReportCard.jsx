import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ATTR, TYPES, QB_PHYSICALS } from '../data/qbs'
import { calcOVR, getArchetype, calcBalance, valToGrade } from '../utils/simulation'
import { buildShareUrl } from '../utils/shareUrl'
import QBAvatar from './QBAvatar'

function fmtHeight(inches) { return `${Math.floor(inches / 12)}'${inches % 12}"` }

const RING_R    = 62
const RING_SIZE = 144
const RING_CX   = RING_SIZE / 2
const RING_CY   = RING_SIZE / 2
const RING_CIRC = 2 * Math.PI * RING_R

function ovrColor(ovr) {
  if (!ovr) return 'rgba(149,213,178,0.12)'
  if (ovr >= 95) return '#fbbf24'
  if (ovr >= 85) return '#95D5B2'
  if (ovr >= 75) return '#60a5fa'
  if (ovr >= 65) return '#fb923c'
  return '#f87171'
}

function OvrRing({ ovr }) {
  const pct    = ovr ? Math.min(99, ovr) / 99 : 0
  const offset = RING_CIRC * (1 - pct)
  const color  = ovrColor(ovr)
  return (
    <svg
      className="ovr-ring-svg"
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
    >
      <circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke="rgba(149,213,178,0.18)" strokeWidth="6" />
      <circle
        cx={RING_CX} cy={RING_CY} r={RING_R}
        fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={RING_CIRC} strokeDashoffset={offset}
        style={{
          transform: `rotate(-90deg)`,
          transformOrigin: `${RING_CX}px ${RING_CY}px`,
          transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease',
          filter: ovr ? `drop-shadow(0 0 5px ${color}88)` : 'none',
        }}
      />
    </svg>
  )
}

function BuildSlot({ type, data }) {
  const meta = ATTR[type]
  const filled = !!data

  if (!filled) {
    return (
      <div className={`build-slot sl-${type} empty`}>
        <span className="sl-dot" style={{ background: meta.col, opacity: 0.2 }} />
        <div className="sl-text">
          <div className="sl-type">{meta.label}</div>
          <div className="sl-empty-hint">–</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`simp-attr-row simp-row-visible sl-${type}`}>
      <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={44} />
      <div className="simp-attr-info">
        <span className="simp-attr-name">{meta.label}</span>
        <span className="simp-attr-qb">{data.qbFull}</span>
      </div>
      <span className="simp-grade-circle" style={{ background: meta.hex, color: '#07120a' }}>
        {valToGrade(data.val)}
      </span>
    </div>
  )
}

// ── Share Modal ───────────────────────────────────────────────────────────────

export function ShareModal({ ovr, arch, build, types, onClose }) {
  const [copied, setCopied] = useState(false)

  const shareText = `I made a ${ovr} overall ${arch} quarterback, think you can do better?`
  const shareUrl  = buildShareUrl(build, types)

  const tweetUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
  const fbUrl     = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`

  const handleCopy = () => {
    const text = shareUrl
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text))
    } else {
      legacyCopy(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function legacyCopy(text) {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(el)
  }

  // Close on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>

        <button className="share-modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="share-modal-title">Share Your Build</div>

        <div className="share-preview-text">"{shareText}"</div>

        {/* OG link card */}
        <div className="share-og-card">
          <div className="share-og-img-wrap">
            <img src="/logo.png" alt="" className="share-og-img" />
          </div>
          <div className="share-og-body">
            <div className="share-og-domain">build-a-player.com</div>
            <div className="share-og-title">{ovr} OVR · {arch}</div>
            <div className="share-og-desc">{shareText}</div>
          </div>
        </div>

        {/* 2×2 share grid */}
        <div className="share-icons-grid">
          <a className="share-icon-btn" href={tweetUrl} target="_blank" rel="noopener noreferrer">
            <div className="share-icon-circle share-icon-x">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.213 5.567 5.951-5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <span className="share-icon-label">X</span>
          </a>

          <a className="share-icon-btn" href={fbUrl} target="_blank" rel="noopener noreferrer">
            <div className="share-icon-circle share-icon-fb">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <span className="share-icon-label">Facebook</span>
          </a>

          <a className="share-icon-btn" href={redditUrl} target="_blank" rel="noopener noreferrer">
            <div className="share-icon-circle share-icon-reddit">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
              </svg>
            </div>
            <span className="share-icon-label">Reddit</span>
          </a>

          <button className="share-icon-btn" onClick={handleCopy}>
            <div className={`share-icon-circle share-icon-copy${copied ? ' share-icon-copied' : ''}`}>
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              )}
            </div>
            <span className="share-icon-label">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

      </div>
    </div>
  )
}

// ── ReportCard ────────────────────────────────────────────────────────────────

export default function ReportCard({ build, onSimulate, onReset, types = TYPES, hasResult = false }) {
  const filled = types.filter(t => build[t])
  const ovr = calcOVR(build, types)
  const arch = getArchetype(ovr, build, types)
  const balance = calcBalance(build, types)
  const complete = filled.length === types.length
  const [showChevron, setShowChevron] = useState(true)
  const [showShare, setShowShare]     = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const hide = () => setShowChevron(false)
    el.addEventListener('scroll', hide, { passive: true, once: true })
    return () => el.removeEventListener('scroll', hide)
  }, [])

  const bodyPhys = build['size'] ? QB_PHYSICALS[build['size'].qbFull] : null
  const legsPhys = build['legs'] ? QB_PHYSICALS[build['legs'].qbFull] : null
  const hwBoth   = bodyPhys && legsPhys
  const heightStr = hwBoth ? fmtHeight(Math.round(0.65 * legsPhys.height + 0.35 * bodyPhys.height)) : null
  const weightLbs = hwBoth ? Math.round(0.65 * bodyPhys.weight + 0.35 * legsPhys.weight) : null

  return (
    <aside className="panel-right" ref={panelRef}>
      <div className="ovr-block">
        <div className="ovr-ring-row">
          <div className="ovr-hw-mobile">
            <div className="ohm-stat">
              <span className="ohm-val">{heightStr ?? '--'}</span>
              <span className="ohm-lbl">HT</span>
            </div>
            <div className="ohm-stat">
              <span className="ohm-val">{weightLbs ?? '--'}</span>
              <span className="ohm-lbl">WT</span>
            </div>
          </div>
          <div className="ovr-ring-wrap">
            <OvrRing ovr={ovr} />
            <div className="ovr-ring-inner">
              <div className="ovr-ring-label">OVR</div>
              <div className={`ovr-number ${ovr ? 'lit' : ''}`} style={ovr ? { color: ovrColor(ovr), textShadow: `0 0 32px ${ovrColor(ovr)}55` } : undefined}>
                {ovr ?? '--'}
              </div>
            </div>
          </div>
          {showChevron && (
            <div className="scroll-chevron" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}
        </div>

        <div className="ovr-arch-row">
          <div className={`ovr-arch${!filled.length ? ' ovr-arch-idle' : ''}`}>{arch}</div>
        </div>

        {complete && (
          <button className="share-build-btn" onClick={() => setShowShare(true)}>
            Share Build
          </button>
        )}

        <button
          className={`sim-btn${complete ? '' : ' sim-btn-locked'}`}
          onClick={complete ? onSimulate : undefined}
          disabled={!complete}
        >
          {!complete ? `${types.length - filled.length} slots remaining` : hasResult ? 'View Results' : 'Simulate Season'}
        </button>
      </div>

      <div className="build-slots">
        {types.map(t => (
          <BuildSlot key={t} type={t} data={build[t]} />
        ))}
      </div>

      <div className="panel-footer">
        <button className="reset-btn" onClick={onReset}>Reset Build</button>
      </div>

      {showShare && createPortal(
        <ShareModal ovr={ovr} arch={arch} build={build} types={types} onClose={() => setShowShare(false)} />,
        document.body
      )}
    </aside>
  )
}
