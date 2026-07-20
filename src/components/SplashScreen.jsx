import { useEffect, useState, useMemo } from 'react'

const HoopU = () => (
  <svg className="hoop-u-svg" viewBox="0 0 68 90" fill="none" aria-hidden="true">
    <circle cx="34" cy="14" r="14.4" fill="#f97316"/>
    <path d="M8 24 L18 88 L50 88 L60 24" stroke="white" strokeWidth="6" strokeLinejoin="round" fill="none"/>
    <line x1="17" y1="25" x2="38" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="27" y1="25" x2="48" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="41" y1="25" x2="20" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="51" y1="25" x2="30" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="5" y1="26" x2="63" y2="26" stroke="white" strokeWidth="5" strokeLinecap="round"/>
  </svg>
)

const QB_ATTRS = [
  { label: 'Arm',                   col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Legs',                  col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Build',                 col: '#fb923c', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Processing',            col: '#a78bfa', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Accuracy/Touch',        col: '#34d399', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Leadership',            col: '#e879f9', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Playmaking/Creativity', col: '#fbbf24', angle:  100, dist: 1.32, mx: 68, my: 34, dox: -240 },
  { label: 'Pocket Presence',       col: '#2dd4bf', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'Vision',                col: '#38bdf8', angle:   80, dist: 1.31, mx: 74, my: 44, dox: 190 },
]

const RB_ATTRS = [
  { label: 'Long Speed',      col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Burst',           col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Strength',        col: '#fbbf24', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Size',            col: '#fb923c', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Contact Balance', col: '#2dd4bf', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Hands',           col: '#34d399', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Vision',          col: '#38bdf8', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Elusiveness',     col: '#a78bfa', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
]

function FloatingChip({ label, col, angle, dist, visible, mx, my, isMobile, orbitScale = 1, dox = 0, doy = 0 }) {
  const x = isMobile ? mx : 50 + dist * 34 * orbitScale * Math.cos((angle * Math.PI) / 180)
  const y = isMobile ? my : 48 + dist * 30 * orbitScale * Math.sin((angle * Math.PI) / 180)
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

export default function SplashScreen({ onStart, onDepthChart }) {
  const [phase, setPhase] = useState(0)
  const [position, setPosition] = useState(() => localStorage.getItem('lastPosition') || 'qb')
  const isMobile  = useMemo(() => window.innerWidth <= 768, [])
  const isDesktop = useMemo(() => window.innerWidth > 768, [])
  const orbitScale = isDesktop ? 0.8 : 1

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80)
    const t2 = setTimeout(() => setPhase(2), 420)
    const t3 = setTimeout(() => setPhase(3), 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const attrs = position === 'rb' ? RB_ATTRS : QB_ATTRS

  return (
    <div className={`splash-screen ${phase >= 1 ? 'splash-in' : ''}`}>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: '-20px', backgroundImage: "url('/footballbackground.webp')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(4px) brightness(0.5)' }} />
      </div>

      <div className="splash-glow" style={{ opacity: phase >= 2 ? 1 : 0 }} />

      {attrs.map((a) => (
        <FloatingChip key={a.label} {...a} visible={phase >= 3} isMobile={isMobile} orbitScale={orbitScale} />
      ))}

      <div className="splash-header" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(-28px)' }}>
        <div className="splash-title">
          BUIL<span className="logo-d">D</span><em>-<span className="logo-a">A</span>-</em>PLAYER
        </div>
        <div className="splash-pos-toggle" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'none' : 'translateY(8px)' }}>
          <button
            className={`splash-pos-btn ${position === 'qb' ? 'splash-pos-btn--active' : ''}`}
            onClick={() => setPosition('qb')}
          >QB</button>
          <button
            className={`splash-pos-btn ${position === 'rb' ? 'splash-pos-btn--active' : ''}`}
            onClick={() => setPosition('rb')}
          >RB</button>
        </div>
      </div>

      <div className="splash-figure-wrap" style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(40px) scale(0.92)' }}>
        <img src="/qb-silhouette.webp" className="splash-figure" alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, opacity: position === 'qb' ? 1 : 0 }} />
        <img src="/rbsilhouette.webp" className="splash-figure" alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, opacity: position === 'rb' ? 1 : 0 }} />
        <div className="splash-figure-glow" />
      </div>

      <button
        className="splash-dc-float"
        onClick={onDepthChart}
        style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'translateY(-50%)' : 'translateY(calc(-50% + 10px)) scale(0.8)' }}
      >
        <div className="splash-dc-float-main">THE DEPTH CHART</div>
        <div className="splash-dc-float-sub">MINI GAME</div>
      </button>

      <div className="splash-footer" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'none' : 'translateY(16px)' }}>

        <div className="splash-tagline">Spin the wheel · Build your {position.toUpperCase()}</div>

        <div className="splash-modes">
          <button className="splash-mode-classic" onClick={() => { localStorage.setItem('lastPosition', position); onStart('classic', position) }}>
            <div className="smode-title">Classic</div>
            <div className="smode-badge">Current {position === 'rb' ? 'RBs' : 'QBs'}</div>
            <div className="smode-cta">
              START DRAFTING
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          <button
            className="splash-mode-alltime"
            onClick={() => { localStorage.setItem('lastPosition', position); onStart('all-time', position) }}
          >
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

        <button className="splash-minigame-btn splash-minigame-btn--bucket" onClick={() => window.location.href = '/bucket'}>
          <div className="splash-xlink-logo">
            BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--bucket">-<span className="splash-xlink-a">A</span>-</em>B<HoopU />CKET
          </div>
          <div className="splash-mg-sub">BASKETBALL BUILDER</div>
        </button>

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
