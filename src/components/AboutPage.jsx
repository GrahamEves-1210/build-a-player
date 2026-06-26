export default function AboutPage({ onBack, onPrivacy }) {
  return (
    <div className="about-page">
      <div className="about-inner">

        <button className="prf-top-back" onClick={onBack}>← Back to Game</button>

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <a href="https://www.playwire.com/contact-direct-sales" rel="noopener" target="_blank">
            <img src="https://www.playwire.com/hubfs/Powered-by-Playwire-Badges/Ads-Powered-by-playwire-2021-standalone-small-white-300px.png" alt="Ads Powered by Playwire" width="200" height="56" loading="lazy" style={{ width: '200px', height: 'auto', maxWidth: '100%', display: 'block', margin: '0 auto' }} />
          </a>
          <a href="https://www.playwire.com/contact-direct-sales" rel="noopener" target="_blank" className="about-link" style={{ display: 'block', marginTop: '8px' }}>Advertise on this site.</a>
        </div>

        <div className="about-header">
          <div className="about-title">Build<em>-A-</em>Player</div>
        </div>

        <section className="about-section">
          <p className="about-body">
            Build-A-Player is an independent fan-made game that lets you construct the ultimate NFL player by combining attributes from players across the league. Spin the wheel to land on a random team and player, drag their stat onto your silhouette, and repeat until all 9 attribute slots are filled. Then simulate a full season to see how your Frankenstein player stacks up.
          </p>
          <p className="about-body">
            Each attribute — Arm, Legs, Build, Processing, Leadership, Vision, Accuracy, Playmaking, and Pocket Presence — is pulled from a different QB. You get one respin per game. Use it wisely.
          </p>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Disclaimer</h2>
          <p className="about-disclaimer">
            Build-A-Player is an independent fan project and is not affiliated with, endorsed by, or sponsored by the National Football League, NFL Properties LLC, or any of its member teams.
          </p>
          <p className="about-disclaimer">
            NFL team names, logos, player names, images, and all related content are the intellectual property of the NFL and their respective owners. No commercial relationship with the NFL or its teams is implied or intended.
          </p>
        </section>

        <div className="about-footer-links">
          <a className="about-text-link" href="/privacy">Privacy Policy</a>
        </div>


      </div>
    </div>
  )
}
