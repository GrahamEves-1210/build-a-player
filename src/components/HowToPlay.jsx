const STEPS = [
  { text: <>Hit <strong>SPIN</strong> — the wheel randomly lands on an NFL team, then pulls a QB from their roster.</> },
  { text: <>You get <strong>8 attribute slots</strong> to fill: Arm, Legs, Size, Decision Making, Leadership, Accuracy, Playmaking, and Pocket Presence — each from a different QB.</> },
  { text: <><strong>Drag</strong> one of the QB's stat chips from the right panel and <strong>drop it</strong> onto the matching zone on the silhouette. The body part lights up in that team's colors.</> },
  { text: <>You get <strong>one QB Respin per game</strong> — use it to swap your QB before locking in a stat.</> },
  { text: <>Spin until all 8 slots are filled, then hit <strong>Simulate Season</strong> to see how your Frankenstein QB performs.</> },
]

export default function HowToPlay({ open, onClose }) {
  return (
    <div
      className={`htp-overlay ${open ? 'open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="htp-card">
        <div className="htp-title">How to Play</div>
        <div className="htp-sub">Build the ultimate QB from every corner of the NFL</div>

        {STEPS.map((s, i) => (
          <div key={i} className="htp-step">
            <div className="htp-num">{i + 1}</div>
            <div className="htp-text">{s.text}</div>
          </div>
        ))}

        <div className="htp-tip">
          <strong>Strategy tip:</strong> A balanced stat spread earns an OVR bonus. Mahomes' IQ + Allen's arm is tempting — but neglect mobility and pocket presence at your own risk.
        </div>

        <button className="mbtn mbtn-primary mbtn-full" onClick={onClose}>
          Let's Build
        </button>
      </div>
    </div>
  )
}
