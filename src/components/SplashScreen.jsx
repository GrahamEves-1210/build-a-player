import { useEffect, useState, useMemo } from 'react'

const ATTRS = [
  { label: 'Arm',                   col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Legs',                  col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Build',                  col: '#fb923c', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Processing',            col: '#a78bfa', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Accuracy/Touch',        col: '#34d399', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Leadership',            col: '#e879f9', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30 },
  { label: 'Playmaking/Creativity', col: '#fbbf24', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Pocket Presence',       col: '#2dd4bf', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'Vision',                col: '#38bdf8', angle:   80, dist: 1.31, mx: 58, my: 44, dox: 90 },
]

function FloatingChip({ label, col, angle, dist, visible, mx, my, isMobile, dox = 0, doy = 0 }) {
  const x = isMobile ? mx : 50 + dist * 34 * Math.cos((angle * Math.PI) / 180)
  const y = isMobile ? my : 48 + dist * 30 * Math.sin((angle * Math.PI) / 180)
  const ox = isMobile ? 0 : dox
  const oy = isMobile ? 0 : doy

  return (
    <div
      className="splash-chip"
      style={{
        left: ox ? `calc(${x}% + ${ox}px)` : `${x}%`,
        top:  oy ? `calc(${y}% + ${oy}px)` : `${y}%`,
        borderColor: col,
        color: col,
        opacity: visible ? 1 : 0,
        transform: visible
          ? (isMobile ? 'translate(0,-50%) scale(1)' : 'translate(-50%,-50%) scale(1)')
          : (isMobile ? 'translate(0,-50%) scale(0.6)' : 'translate(-50%,-50%) scale(0.6)'),
        transitionDelay: visible ? `${300 + Math.abs(angle) % 400}ms` : '0ms',
      }}
    >
      <span className="splash-chip-dot" style={{ background: col }} />
      {label}
    </div>
  )
}

export default function SplashScreen({ onStart }) {
  const [phase, setPhase] = useState(0)
  const isMobile = useMemo(() => window.innerWidth <= 768, [])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80)
    const t2 = setTimeout(() => setPhase(2), 420)
    const t3 = setTimeout(() => setPhase(3), 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div className={`splash-screen ${phase >= 1 ? 'splash-in' : ''}`}>

      <div className="splash-glow" style={{ opacity: phase >= 2 ? 1 : 0 }} />

      {ATTRS.map((a) => (
        <FloatingChip key={a.label} {...a} visible={phase >= 3} isMobile={isMobile} />
      ))}

      <div className="splash-header" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(-28px)' }}>
        <div className="splash-title">
          BUILD<em>-A-</em>PLAYER
        </div>
      </div>

      <div className="splash-figure-wrap" style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(40px) scale(0.92)' }}>
        <img src="/qb-silhouette.png" className="splash-figure" alt="" draggable={false} />
        <div className="splash-figure-glow" />
      </div>

      <div className="splash-footer" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'none' : 'translateY(16px)' }}>
        <div className="splash-tagline">Spin the wheel · Build your QB</div>

        <div className="splash-modes">
          <button className="splash-mode-classic" onClick={() => onStart('classic')}>
            <div className="smode-title">Classic</div>
            <div className="smode-badge">Current QBs</div>
            <div className="smode-cta">
              START DRAFTING
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          <button className="splash-mode-alltime" onClick={() => onStart('all-time')}>
            <span className="smode-new-badge">NEW</span>
            <div className="smode-title smode-title--alltime">All-Time</div>
            <div className="smode-badge smode-badge--alltime">Draft the Greats</div>
            <div className="smode-cta smode-cta--alltime">
              START DRAFTING
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>
        </div>

        <div className="splash-disclaimer">Fan-made · Not affiliated with the NFL</div>
      </div>

      <div className="splash-field-lines">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="splash-yard-line" style={{ opacity: phase >= 2 ? 1 : 0, transitionDelay: `${600 + i * 60}ms` }} />
        ))}
      </div>
    </div>
  )
}
