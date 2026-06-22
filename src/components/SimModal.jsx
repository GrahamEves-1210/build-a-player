import { ATTR, TYPES } from '../data/qbs'
import { valToGrade } from '../utils/simulation'

// Which side each attribute callout appears on, and its body zone label
const CALLOUT_CONFIG = {
  'processing':      { side: 'left',  partLabel: 'Processing' },
  'playmaking':      { side: 'left',  partLabel: 'Playmaking' },
  'accuracy':        { side: 'left',  partLabel: 'Accuracy'   },
  'vision':          { side: 'right', partLabel: 'Vision'     },
  'arm':             { side: 'right', partLabel: 'Arm'        },
  'size':            { side: 'right', partLabel: 'Torso'      },
  'legs':            { side: 'right', partLabel: 'Legs'       },
}

function Callout({ type, data }) {
  if (!data) return null
  const meta = ATTR[type]
  const cfg = CALLOUT_CONFIG[type]
  return (
    <div
      className="sim-callout"
      style={{
        '--callout-col': meta.col,
        textAlign: cfg.side === 'left' ? 'right' : 'left',
      }}
    >
      <div className="callout-part">{cfg.partLabel}</div>
      <div className="callout-name">{data.qbFull}</div>
      <div className="callout-val">{valToGrade(data.val)}</div>
    </div>
  )
}

function SuperBowlResult({ playoffs, sbResult, wins }) {
  if (!playoffs) {
    return (
      <div className="sb-result" style={{
        borderColor: 'rgba(248,113,113,0.22)',
        background: 'linear-gradient(135deg,rgba(248,113,113,0.05),transparent)',
      }}>
        <div className="sb-result-title">Missed the Playoffs</div>
        <div className="sb-result-sub">{wins} wins wasn't enough. Rebuild and try again.</div>
      </div>
    )
  }
  if (!sbResult?.won) {
    return (
      <div className="sb-result" style={{
        borderColor: 'rgba(251,191,36,0.22)',
        background: 'linear-gradient(135deg,rgba(251,191,36,0.05),transparent)',
      }}>
        <div className="sb-result-title">Eliminated — {sbResult?.round}</div>
        <div className="sb-result-sub">
          {sbResult?.pwins} playoff win{sbResult?.pwins !== 1 ? 's' : ''}. A balanced build goes further.
        </div>
      </div>
    )
  }
  return (
    <div className="sb-result">
      <div className="sb-result-title">Super Bowl Champion</div>
      <div className="sb-result-sub">Your Frankenstein QB went all the way.</div>
      <div className="sb-stats">
        <div className="sb-stat">
          <div className="sb-stat-val">{sbResult.passYds}</div>
          <div className="sb-stat-lbl">Pass Yards</div>
        </div>
        <div className="sb-stat">
          <div className="sb-stat-val">{sbResult.tds}</div>
          <div className="sb-stat-lbl">Touchdowns</div>
        </div>
        <div className="sb-stat">
          <div className="sb-stat-val">{sbResult.rating}</div>
          <div className="sb-stat-lbl">QB Rating</div>
        </div>
      </div>
    </div>
  )
}

export default function SimModal({ open, result, build, onClose, onReset }) {
  if (!result) return null
  const { ovr, wins, losses, highlights, playoffs, sbResult } = result

  const leftTypes  = TYPES.filter(t => CALLOUT_CONFIG[t].side === 'left')
  const rightTypes = TYPES.filter(t => CALLOUT_CONFIG[t].side === 'right')

  return (
    <div
      className={`modal-overlay ${open ? 'open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal">
        <div className="modal-header">
          <div className="modal-eyebrow">Season Report</div>
          <div className="modal-title">{wins}–{losses}</div>
          <div className="modal-sub">
            {playoffs
              ? `Made the playoffs with an OVR ${ovr} QB`
              : `Fell short with ${losses} losses`}
          </div>
        </div>

        {/* Player diagram with callouts */}
        <div className="sim-diagram">
          <div className="sim-callouts-left">
            {leftTypes.map(t => (
              <Callout key={t} type={t} data={build[t]} />
            ))}
          </div>

          <div className="sim-player-fig">
            <img src="/silhouette.png" alt="QB" draggable={false} />
          </div>

          <div className="sim-callouts-right">
            {rightTypes.map(t => (
              <Callout key={t} type={t} data={build[t]} />
            ))}
          </div>
        </div>

        {/* OVR summary band */}
        <div className="sim-summary-band">
          <div className="sim-ovr-badge">
            <div className="sob-num">{ovr}</div>
            <div className="sob-lbl">OVR</div>
          </div>
          <div className="sim-tag-list">
            {TYPES.filter(t => build[t]).map(t => {
              const meta = ATTR[t]
              const data = build[t]
              return (
                <span key={t} className="sim-tag">
                  <span className="sim-tag-dot" style={{ background: meta.col }} />
                  {meta.shortLabel} · {data.qb} · {valToGrade(data.val)}
                </span>
              )
            })}
          </div>
        </div>

        {/* Season highlights */}
        <div className="season-section">
          <div className="section-lbl">Season Highlights ({wins}–{losses})</div>
          {highlights.map((h, i) => (
            <div
              key={h.wk}
              className="tl-row"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="tl-wk">Wk {h.wk}</span>
              <span className={`tl-vs ${h.won ? 'tl-w' : 'tl-l'}`}>
                {h.won ? '●' : '○'} vs {h.opponent}
              </span>
              <span className="tl-sc">{h.mySc}–{h.oppSc}</span>
            </div>
          ))}
        </div>

        <SuperBowlResult playoffs={playoffs} sbResult={sbResult} wins={wins} />

        <div className="modal-actions">
          <button className="mbtn mbtn-primary" onClick={onReset}>New Build</button>
          <button className="mbtn mbtn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
