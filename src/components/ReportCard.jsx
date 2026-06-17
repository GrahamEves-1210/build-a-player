import { ATTR, TYPES } from '../data/qbs'
import { calcOVR, getArchetype, calcBalance } from '../utils/simulation'

function BuildSlot({ type, data }) {
  const meta = ATTR[type]
  const filled = !!data
  return (
    <div className={`build-slot sl-${type} ${filled ? 'filled' : 'empty'}`}>
      <span className="sl-dot" style={{ background: meta.col, opacity: filled ? 1 : 0.2 }} />
      <div className="sl-text">
        <div className="sl-type">{meta.label}</div>
        {filled
          ? <div className="sl-qb-name">{data.qbFull}</div>
          : <div className="sl-empty-hint">Drag to assign</div>}
      </div>
      {filled && <div className="sl-val">{data.val}</div>}
    </div>
  )
}

export default function ReportCard({ build, onSimulate, onReset }) {
  const filled = TYPES.filter(t => build[t])
  const ovr = calcOVR(build)
  const arch = getArchetype(ovr, build)
  const balance = calcBalance(build)
  const complete = filled.length === TYPES.length

  return (
    <aside className="panel-right">
      <div className="ovr-block">
        <div className="ovr-label">Overall Rating</div>
        <div className={`ovr-number ${ovr ? 'lit' : ''}`}>{ovr ?? '--'}</div>
        <div className="ovr-arch">{arch}</div>
      </div>

      <div className="build-slots">
        {TYPES.map(t => (
          <BuildSlot key={t} type={t} data={build[t]} />
        ))}
      </div>

<div className="panel-footer">
        <button
          className="sim-btn"
          disabled={!complete}
          onClick={onSimulate}
        >
          Simulate Season
        </button>

        <button className="reset-btn" onClick={onReset}>Reset Build</button>
      </div>
    </aside>
  )
}
