const STEPS = [
  { text: <>Hit <strong>Spin the Wheel</strong> — a random NFL team and their starting QB are revealed.</> },
  { text: <><strong>Drag</strong> an attribute chip (ARM, LEGS, CORE, IQ, COMPOSURE, ACCURACY) from the left panel and <strong>drop it</strong> onto the matching zone on the silhouette.</> },
  { text: <>The body part <strong>lights up in that team's color</strong>. Spin again to find a different QB for your next slot.</> },
  { text: <>Once all 6 slots are filled, hit <strong>Simulate Season</strong> to run a full NFL season with your Frankenstein QB.</> },
]

export default function HowToPlay({ open, onClose }) {
  return (
    <div
      className={`htp-overlay ${open ? 'open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="htp-card">
        <div className="htp-title">How to Play</div>
        <div className="htp-sub">Build the perfect QB from every corner of the NFL</div>

        {STEPS.map((s, i) => (
          <div key={i} className="htp-step">
            <div className="htp-num">{i + 1}</div>
            <div className="htp-text">{s.text}</div>
          </div>
        ))}

        <div className="htp-tip">
          <strong>Balance Bonus:</strong> A tight stat spread earns an OVR bonus. Mahomes' IQ + Allen's arm is tempting — but can you balance it with strong legs and composure too?
        </div>

        <button className="mbtn mbtn-primary mbtn-full" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
