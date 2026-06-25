import { useState, useRef, useEffect } from 'react'

const STEPS_DESKTOP = [
  { n: '1', title: 'Spin',      body: 'Pull a random NFL team, then a QB from their roster.' },
  { n: '2', title: 'Drag',      body: 'Drop one stat onto the matching zone on the player silhouette.' },
  { n: '3', title: 'Repeat ×9', body: 'Fill all nine attribute slots — one per spin.' },
  { n: '4', title: 'Simulate',  body: 'Hit Simulate to see how your Frankenstein QB performs.' },
]
const STEPS_MOBILE = [
  { n: '1', title: 'Spin',      body: 'Pull a random NFL team, then a QB from their roster.' },
  { n: '2', title: 'Tap',       body: 'Tap a stat chip to instantly assign it to your build.' },
  { n: '3', title: 'Repeat ×9', body: 'Fill all nine attribute slots — one per spin.' },
  { n: '4', title: 'Simulate',  body: 'Hit Simulate to see how your Frankenstein QB performs.' },
]

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
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

function IconUser() {
  return (
    <svg width="15" height="15" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6.5" cy="4.5" r="2.5"/>
      <path d="M1.5 11.5c0-2.76 2.24-5 5-5s5 2.24 5 5"/>
    </svg>
  )
}

function IconLeaderboard() {
  return (
    <svg width="15" height="15" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

function IconX() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.737-8.835L1.254 2.25H8.08l4.265 5.638L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="11" height="8" rx="1"/>
      <path d="M1 3.5l5.5 4 5.5-4"/>
    </svg>
  )
}

function IconCoffee() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 1v7M4 6l2.5 2.5L9 6"/>
      <path d="M2 10h9"/>
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 5.5h7M6 2.5l3 3-3 3"/>
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

export default function Navbar({ onReset, onAbout, onHome, onSignIn, onProfile, onLeaderboard, user }) {
  const [open,         setOpen]        = useState(false)
  const [htpOpen,      setHtpOpen]     = useState(false)
  const [installOpen,  setInstallOpen] = useState(false)
  const ref = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
  const STEPS = isMobile ? STEPS_MOBILE : STEPS_DESKTOP

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleReset       = () => { onReset?.();       setOpen(false) }
  const handleAbout       = () => { onAbout?.();       setOpen(false) }
  const handleSignIn      = () => { onSignIn?.();      setOpen(false) }
  const handleProfile     = () => { onProfile?.();     setOpen(false) }
  const handleLeaderboard = () => { onLeaderboard?.(); setOpen(false) }

  return (
    <header className="navbar">
      <div className="logo" onClick={onHome} style={onHome ? { cursor: 'pointer' } : undefined}>
        <div className="logo-text">
          Build<em>-A-</em>Player
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

            {/* Install App — hidden if already standalone */}
            {!isStandalone && (
              <>
                <button
                  className="wm-row wm-row-accordion"
                  onClick={() => setInstallOpen(o => !o)}
                >
                  <span className="wm-icon"><IconDownload /></span>
                  <span className="wm-label">Install App</span>
                  <span className="wm-chevron"><IconChevron up={installOpen} /></span>
                </button>

                {installOpen && (
                  <div className="wm-htp-body">
                    {isIOS ? (
                      <>
                        <div className="wm-htp-step">
                          <span className="wm-htp-num">1</span>
                          <div>
                            <div className="wm-htp-title">Open in Safari</div>
                            <div className="wm-htp-desc">Make sure you're using Safari, not Chrome or another browser.</div>
                          </div>
                        </div>
                        <div className="wm-htp-step">
                          <span className="wm-htp-num">2</span>
                          <div>
                            <div className="wm-htp-title">Tap Share</div>
                            <div className="wm-htp-desc">Tap the Share button at the bottom of the screen (box with an arrow).</div>
                          </div>
                        </div>
                        <div className="wm-htp-step">
                          <span className="wm-htp-num">3</span>
                          <div>
                            <div className="wm-htp-title">Add to Home Screen</div>
                            <div className="wm-htp-desc">Scroll down and tap "Add to Home Screen", then tap Add.</div>
                          </div>
                        </div>
                      </>
                    ) : isAndroid ? (
                      <>
                        <div className="wm-htp-step">
                          <span className="wm-htp-num">1</span>
                          <div>
                            <div className="wm-htp-title">Open Menu</div>
                            <div className="wm-htp-desc">Tap the three-dot menu in the top right of Chrome.</div>
                          </div>
                        </div>
                        <div className="wm-htp-step">
                          <span className="wm-htp-num">2</span>
                          <div>
                            <div className="wm-htp-title">Install App</div>
                            <div className="wm-htp-desc">Tap "Add to Home Screen" or "Install app" and confirm.</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="wm-htp-step">
                          <span className="wm-htp-num">1</span>
                          <div>
                            <div className="wm-htp-title">Look for the icon</div>
                            <div className="wm-htp-desc">In Chrome, click the install icon on the right side of the address bar.</div>
                          </div>
                        </div>
                        <div className="wm-htp-step">
                          <span className="wm-htp-num">2</span>
                          <div>
                            <div className="wm-htp-title">Click Install</div>
                            <div className="wm-htp-desc">Click "Install" in the prompt and the app will open in its own window.</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* About */}
            <button className="wm-row" onClick={handleAbout}>
              <span className="wm-icon"><IconInfo /></span>
              <span className="wm-label">About</span>
            </button>

            <div className="wm-divider" />

            {/* Social / contact */}
            <div className="wm-social-row">
              <a
                className="wm-social-btn"
                href="https://x.com/Build_A_Player"
                title="Follow on X"
                onClick={e => {
                  e.preventDefault()
                  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
                  if (!isMobile) { window.open('https://x.com/Build_A_Player', '_blank'); return }
                  window.location.href = 'twitter://user?screen_name=Build_A_Player'
                  const t = setTimeout(() => { window.location.href = 'https://x.com/Build_A_Player' }, 1500)
                  document.addEventListener('visibilitychange', function onVis() {
                    if (document.hidden) clearTimeout(t)
                    document.removeEventListener('visibilitychange', onVis)
                  })
                }}
              >
                <IconX />
              </a>
              <a className="wm-social-btn" href="mailto:buildaplayer@outlook.com" title="Email us">
                <IconMail />
              </a>
              <a className="wm-social-btn wm-social-btn-coffee" href="https://buymeacoffee.com/32and0" target="_blank" rel="noopener noreferrer" title="Buy us a coffee" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 4px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.4px', lineHeight: 1 }}>Tip Jar</span>
                <IconCoffee />
              </a>
            </div>

            <div className="wm-divider" />

            {/* Leaderboard */}
            <button className="wm-row wm-row-leaderboard" onClick={handleLeaderboard}>
              <span className="wm-icon"><IconLeaderboard /></span>
              <span className="wm-label">Leaderboard</span>
            </button>

            {/* Sign In / Account */}
            {user ? (
              <button className="wm-row wm-row-user" onClick={handleProfile}>
                <span className="wm-icon"><IconUser /></span>
                <span className="wm-label wm-label-user">{user.user_metadata?.username || user.email}</span>
                <span className="wm-chevron"><IconArrowRight /></span>
              </button>
            ) : (
              <button className="wm-row wm-row-auth" onClick={handleSignIn}>
                <span className="wm-icon"><IconUser /></span>
                <span className="wm-label">Sign In / Create Account</span>
              </button>
            )}

            <a
              className="wm-fanatics-banner"
              href="https://fanatics.93n6tx.net/c/7434845/586570/9663"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/fanatics.webp" alt="Fanatics" className="wm-fanatics-logo" />
              <span className="wm-fanatics-banner-labels">
                <span className="wm-fanatics-banner-text">Official NFL Gear</span>
                <span className="wm-fanatics-banner-cta">Shop Now →</span>
              </span>
            </a>

          </div>
        )}
      </div>
    </header>
  )
}
