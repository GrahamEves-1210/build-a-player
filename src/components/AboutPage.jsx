export default function AboutPage({ onBack }) {
  return (
    <div className="about-page">
      <div className="about-inner">

        <div className="about-header">
          <div className="about-title">Build<em>-A-</em>Player</div>
        </div>

        <section className="about-section">
          <p className="about-body">
            Build-A-Player is an independent fan-made game that lets you construct the ultimate NFL quarterback by combining attributes from players across the league. Spin the wheel to land on a random team and QB, drag their stat onto your silhouette, and repeat until all 9 attribute slots are filled. Then simulate a full season to see how your Frankenstein QB stacks up.
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

        <button className="about-back-btn" onClick={onBack}>
          ← Back to Game
        </button>

      </div>
    </div>
  )
}
