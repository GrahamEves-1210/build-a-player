export default function AboutPage({ onBack, onPrivacy }) {
  return (
    <div className="about-page">
      <div className="about-inner">

        <button className="prf-top-back" onClick={onBack}>← Back to Game</button>

        <div className="about-header about-header--stacked">
          <img src="/bap-mark.webp" alt="Build-A-Player" className="about-logo-mark" />
          <div className="about-title about-title--small">Build<em>-A-</em>Player</div>
        </div>

        <section className="about-section">
          <p className="about-body">
            Build-A-Player is an independent fan-made game that lets you construct the ultimate NFL or NBA player by combining attributes from players across the league. Spin the wheel to land on a random team and player, drag their stat onto your silhouette, and repeat until all attribute slots are filled. Then simulate a full season to see how your Frankenstein player stacks up.
          </p>
        </section>

        <section className="about-section">
          <p className="about-body">
            Want the details? The <a className="about-link" href="/wiki">Build-A-Player Wiki</a> explains every mode and mechanic, from spins and overall ratings to season simulation, Salary Cap and Head-to-Head, and lists every player rating in the game. Its <a className="about-link" href="/wiki/creators">Creators</a> page collects the YouTubers and streamers who have played.
          </p>
        </section>

        <section className="about-section" style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-grid', gridTemplateColumns: '1fr auto', gap: '10px 8px', alignItems: 'center', textAlign: 'left' }}>
            <span className="about-body" style={{ margin: 0 }}>Enjoy Build-A-Player? Check out my college basketball game —{' '}
              <a className="about-link" href="https://32-0game.com" target="_blank" rel="noopener noreferrer">32-0game.com</a>.
            </span>
            <a href="https://32-0game.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <img src="/32-0logocutout.png" alt="32-0" style={{ height: '28px', width: 'auto', background: 'white', borderRadius: '5px', padding: '2px 6px', display: 'block' }} />
            </a>
            <span className="about-body" style={{ margin: 0 }}>If you'd like to support the game,{' '}
              <a className="about-link" href="https://buymeacoffee.com/32and0" target="_blank" rel="noopener noreferrer">leave a tip here.</a>
            </span>
            <a href="https://buymeacoffee.com/32and0" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#FFDD00', borderRadius: '5px', padding: '2px 6px', color: '#1a1200', height: '28px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/>
                <line x1="10" y1="1" x2="10" y2="4"/>
                <line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
            </a>
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Disclaimer</h2>
          <p className="about-disclaimer">
            Build-A-Player is an independent fan project and is not affiliated with, endorsed by, or sponsored by the National Football League, NFL Properties LLC, the NBA, or any of their member teams, players' associations, or players.
          </p>
          <p className="about-disclaimer">
            NFL and NBA team names, logos, player names, images, and all related content are the intellectual property of their respective leagues and owners. No commercial relationship with the NFL, NBA, or their teams is implied or intended.
          </p>
        </section>

        <div className="about-footer-links">
          <a className="about-text-link" href="/wiki">Wiki</a>
          <span style={{ color: 'var(--text-muted, #666)', margin: '0 8px' }}>·</span>
          <a className="about-text-link" href="/privacy">Privacy Policy</a>
          <span style={{ color: 'var(--text-muted, #666)', margin: '0 8px' }}>·</span>
          <a className="about-text-link" href="/terms">Terms</a>
        </div>

        <a href="https://www.playwire.com/contact-direct-sales" rel="noopener" target="_blank" className="splash-site-footer-playwire" style={{ margin: '20px auto 0' }}>
          <img src="https://www.playwire.com/hubfs/Powered-by-Playwire-Badges/Ads-Powered-by-playwire-2021-standalone-small-white-300px.png" alt="Ads Powered by Playwire" width="140" height="39" loading="lazy" />
        </a>

      </div>
    </div>
  )
}
