import { useState, useRef, useEffect } from 'react'

const STEPS = [
  { n: '1', title: 'Spin',      body: 'Pull a random NFL team, then a QB from their roster.' },
  { n: '2', title: 'Drag',      body: 'Drop one stat onto the matching zone on the player silhouette.' },
  { n: '3', title: 'Repeat ×8', body: 'Fill all eight attribute slots — one per spin.' },
  { n: '4', title: 'Simulate',  body: 'Hit Simulate to see how your Frankenstein QB performs.' },
]

function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
      <rect x="0"  y="0"  width="4" height="4" rx="1"/>
      <rect x="5.5" y="0"  width="4" height="4" rx="1"/>
      <rect x="11" y="0"  width="4" height="4" rx="1"/>
      <rect x="0"  y="5.5" width="4" height="4" rx="1"/>
      <rect x="5.5" y="5.5" width="4" height="4" rx="1"/>
      <rect x="11" y="5.5" width="4" height="4" rx="1"/>
      <rect x="0"  y="11" width="4" height="4" rx="1"/>
      <rect x="5.5" y="11" width="4" height="4" rx="1"/>
      <rect x="11" y="11" width="4" height="4" rx="1"/>
    </svg>
  )
}

function IconReset() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6.5a4.5 4.5 0 1 0 1-2.8"/>
      <path d="M2 2.5v2.2h2.2"/>
    </svg>
  )
}

function IconLeaderboard() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="7" width="3" height="5" rx="0.5"/>
      <rect x="5" y="4" width="3" height="8" rx="0.5"/>
      <rect x="9" y="1" width="3" height="11" rx="0.5"/>
    </svg>
  )
}

function IconHelp() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.5"/>
      <path d="M5 5a1.6 1.6 0 0 1 3.1.5c0 1.1-1.5 1.5-1.5 2.5"/>
      <circle cx="6.6" cy="9.5" r="0.4" fill="currentColor"/>
    </svg>
  )
}

function IconInfo() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.5"/>
      <line x1="6.5" y1="6" x2="6.5" y2="9.5"/>
      <circle cx="6.5" cy="3.8" r="0.4" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function IconChevron({ up }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 11 11"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
      aria-hidden="true"
    >
      <path d="M2 4l3.5 3.5L9 4"/>
    </svg>
  )
}

export default function Navbar({ onReset }) {
  const [open,      setOpen]      = useState(false)
  const [htpOpen,   setHtpOpen]   = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleReset = () => { onReset?.(); setOpen(false) }

  return (
    <header className="navbar">
      <div className="logo">
        <div className="logo-text">
          Build<em>-A-</em>Player <span className="logo-workshop">Workshop</span>
        </div>
      </div>

      <button className="tab-pill active tab-pill-qb">Build-A-QB</button>

      <div className="nav-pills-soon">
        <div className="tab-soon-wrap">
          <span className="tab-soon-label">Coming Soon</span>
          <button className="tab-pill soon-1">Build-A-RB</button>
        </div>
        <div className="tab-soon-wrap">
          <span className="tab-soon-label">Coming Soon</span>
          <button className="tab-pill soon-2">Build-A-WR</button>
        </div>
      </div>

      <div className="nav-right" ref={ref}>
        <button
          className={`waffle-btn${open ? ' waffle-open' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Menu"
        >
          <IconGrid />
        </button>

        {open && (
          <div className="waffle-dropdown">
            {/* How to Play — accordion */}
            <button
              className="wm-row wm-row-accordion"
              onClick={() => setHtpOpen(o => !o)}
            >
              <span className="wm-icon"><IconHelp /></span>
              <span className="wm-label">How to Play</span>
              <span className="wm-chevron"><IconChevron up={htpOpen} /></span>
            </button>

            {htpOpen && (
              <div className="wm-htp-body">
                {STEPS.map(s => (
                  <div key={s.n} className="wm-htp-step">
                    <span className="wm-htp-num">{s.n}</span>
                    <div>
                      <div className="wm-htp-title">{s.title}</div>
                      <div className="wm-htp-desc">{s.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* About — accordion */}
            <button
              className="wm-row wm-row-accordion"
              onClick={() => setAboutOpen(o => !o)}
            >
              <span className="wm-icon"><IconInfo /></span>
              <span className="wm-label">About</span>
              <span className="wm-chevron"><IconChevron up={aboutOpen} /></span>
            </button>

            {aboutOpen && (
              <div className="wm-about-body">
                <p className="wm-about-text">
                  <strong>Build-A-Player Workshop</strong> is an independent fan-made game. Spin the wheel to pull random NFL QBs, mix and match their real attributes, and simulate a full season with your Frankenstein quarterback.
                </p>
                <p className="wm-about-text">
                  More positions coming soon — Build-A-RB, Build-A-WR, and beyond.
                </p>
                <p className="wm-about-disclaimer">
                  Not affiliated with, endorsed by, or sponsored by the NFL or any of its member clubs. NFL team names, logos, colors, and player likenesses are the intellectual property of their respective owners and are used here solely for entertainment and fan purposes.
                </p>
              </div>
            )}

            {/* Leaderboard — coming soon */}
            <div className="wm-row wm-row-soon">
              <span className="wm-icon"><IconLeaderboard /></span>
              <span className="wm-label">Leaderboard</span>
              <span className="wm-soon-badge">Soon</span>
            </div>

            <div className="wm-divider" />

            {/* Reset Build */}
            <button className="wm-row wm-row-danger" onClick={handleReset}>
              <span className="wm-icon"><IconReset /></span>
              <span className="wm-label">Reset Build</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
