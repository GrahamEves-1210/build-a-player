import { ATTR, TYPES } from '../data/qbs'
import { calcOVR, getArchetype, calcBalance, valToGrade } from '../utils/simulation'

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
      {filled && <div className="sl-val">{valToGrade(data.val)}</div>}
    </div>
  )
}

export default function ReportCard({ build, onSimulate, onReset, types = TYPES }) {
  const filled = types.filter(t => build[t])
  const ovr = calcOVR(build, types)
  const arch = getArchetype(ovr, build, types)
  const balance = calcBalance(build, types)
  const complete = filled.length === types.length

  return (
    <aside className="panel-right">
      <div className="ovr-block">
        <div className="ovr-label">Overall Rating</div>
        <div className={`ovr-number ${ovr ? 'lit' : ''}`}>{ovr ? valToGrade(ovr) : '--'}</div>
        <div className="ovr-arch">{arch}</div>
      </div>

      <div className="build-slots">
        {types.map(t => (
          <BuildSlot key={t} type={t} data={build[t]} />
        ))}
      </div>

      <div className="panel-footer">
        <button className="reset-btn" onClick={onReset}>Reset Build</button>
      </div>
    </aside>
  )
}
