export default function AboutPage({ onBack }) {
  return (
    <div className="about-page">
      <div className="about-inner">

        <div className="about-header">
          <div className="about-title">Build<em>-A-</em>Player</div>
        </div>

        <section className="about-section">
          <h2 className="about-section-title">What is this?</h2>
          <p className="about-body">
            Build-A-Player is an independent fan-made game that lets you construct the ultimate NFL quarterback by combining attributes from players across the league. Spin the wheel to land on a random team and QB, drag their stat onto your silhouette, and repeat until all 8 attribute slots are filled. Then simulate a full season to see how your Frankenstein QB stacks up.
          </p>
          <p className="about-body">
            Each attribute — Arm, Legs, Size, Decision Making, Leadership, Accuracy, Playmaking, and Pocket Presence — comes from a different QB. You get one respin per game. Use it wisely.
          </p>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Legal</h2>
          <p className="about-disclaimer">
            Build-A-Player is an independent fan-made project and is not affiliated with, endorsed by, or sponsored by the National Football League (NFL), NFL Properties LLC, or any of its 32 member clubs. NFL team names, logos, colors, and player likenesses are the intellectual property of the NFL and their respective owners. All player statistics and data are used solely for entertainment and fan engagement purposes.
          </p>
        </section>

        <button className="about-back-btn" onClick={onBack}>
          ← Back to Game
        </button>

      </div>
    </div>
  )
}
