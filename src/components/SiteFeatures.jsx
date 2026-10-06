export default function SiteFeatures({ sport = 'nfl', className = '' }) {
  const isBucket = sport === 'bucket'

  return (
    <section className={`splash-features ${className}`}>
      <div className="splash-feature">
        <div className="splash-feature-icon splash-feature-icon--dual">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <div className="splash-feature-title">Spin &amp; Build</div>
        <div className="splash-feature-desc">
          {isBucket
            ? 'Spin the wheel of real NBA players and take one part of each player’s game until you’ve built your own basketball player.'
            : 'Spin the wheel of real players, and select an aspect of their game until you have a complete custom player.'}
        </div>
      </div>
      {isBucket ? (
        <div className="splash-feature">
          <div className="splash-feature-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="splash-feature-title">Head-to-Head</div>
          <div className="splash-feature-desc">Challenge a friend to a live 1v1 build-off, or get matched with a random opponent.</div>
        </div>
      ) : (
        <div className="splash-feature">
          <div className="splash-feature-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M7 4h10l-1 9a4 4 0 0 1-8 0L7 4z"/>
              <path d="M5 4h2v4a3 3 0 0 1-3-3V4zM19 4h-2v4a3 3 0 0 0 3-3V4z"/>
            </svg>
          </div>
          <div className="splash-feature-title">Simulate the Season</div>
          <div className="splash-feature-desc">Watch your build play out across a full NFL season, from kickoff to the playoffs.</div>
        </div>
      )}
      <div className="splash-feature">
        <div className="splash-feature-icon">
          <svg width="22" height="22" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="7" width="3" height="5" rx="0.5"/>
            <rect x="5" y="4" width="3" height="8" rx="0.5"/>
            <rect x="9" y="1" width="3" height="11" rx="0.5"/>
          </svg>
        </div>
        <div className="splash-feature-title">Climb the Leaderboard</div>
        <div className="splash-feature-desc">Save your best builds and compete against everyone else for the highest OVR and career stats.</div>
      </div>
    </section>
  )
}
