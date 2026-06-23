import { ATTR, TYPES, QB_PHYSICALS } from '../data/qbs'
import { calcOVR, getArchetype, calcBalance, valToGrade } from '../utils/simulation'
import QBAvatar from './QBAvatar'

function fmtHeight(inches) { return `${Math.floor(inches / 12)}'${inches % 12}"` }

const RING_R    = 62
const RING_SIZE = 144
const RING_CX   = RING_SIZE / 2
const RING_CY   = RING_SIZE / 2
const RING_CIRC = 2 * Math.PI * RING_R

function ovrColor(ovr) {
  if (!ovr) return 'rgba(149,213,178,0.12)'
  if (ovr >= 95) return '#fbbf24'
  if (ovr >= 85) return '#95D5B2'
  if (ovr >= 75) return '#60a5fa'
  if (ovr >= 65) return '#fb923c'
  return '#f87171'
}

function OvrRing({ ovr }) {
  const pct    = ovr ? Math.min(99, ovr) / 99 : 0
  const offset = RING_CIRC * (1 - pct)
  const color  = ovrColor(ovr)
  return (
    <svg
      className="ovr-ring-svg"
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={RING_CX} cy={RING_CY} r={RING_R}
        fill="none"
        stroke="rgba(149,213,178,0.18)"
        strokeWidth="6"
      />
      {/* Progress */}
      <circle
        cx={RING_CX} cy={RING_CY} r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={RING_CIRC}
        strokeDashoffset={offset}
        style={{
          transform: `rotate(-90deg)`,
          transformOrigin: `${RING_CX}px ${RING_CY}px`,
          transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease',
          filter: ovr ? `drop-shadow(0 0 5px ${color}88)` : 'none',
        }}
      />
    </svg>
  )
}

function BuildSlot({ type, data }) {
  const meta = ATTR[type]
  const filled = !!data

  if (!filled) {
    return (
      <div className={`build-slot sl-${type} empty`}>
        <span className="sl-dot" style={{ background: meta.col, opacity: 0.2 }} />
        <div className="sl-text">
          <div className="sl-type">{meta.label}</div>
          <div className="sl-empty-hint">–</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`simp-attr-row simp-row-visible sl-${type}`}>
      <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={44} />
      <div className="simp-attr-info">
        <span className="simp-attr-name">{meta.label}</span>
        <span className="simp-attr-qb">{data.qbFull}</span>
      </div>
      <span className="simp-grade-circle" style={{ background: meta.hex, color: '#07120a' }}>
        {valToGrade(data.val)}
      </span>
    </div>
  )
}

export default function ReportCard({ build, onSimulate, onReset, types = TYPES, hasResult = false }) {
  const filled = types.filter(t => build[t])
  const ovr = calcOVR(build, types)
  const arch = getArchetype(ovr, build, types)
  const balance = calcBalance(build, types)
  const complete = filled.length === types.length

  const bodyPhys = build['size'] ? QB_PHYSICALS[build['size'].qbFull] : null
  const legsPhys = build['legs'] ? QB_PHYSICALS[build['legs'].qbFull] : null
  const hwBoth   = bodyPhys && legsPhys
  const heightStr = hwBoth ? fmtHeight(Math.round(0.65 * legsPhys.height + 0.35 * bodyPhys.height)) : null
  const weightLbs = hwBoth ? Math.round(0.65 * bodyPhys.weight + 0.35 * legsPhys.weight) : null

  return (
    <aside className="panel-right">
      <div className="ovr-block">
        <div className="ovr-ring-row">
          <div className="ovr-hw-mobile">
            <div className="ohm-stat">
              <span className="ohm-val">{heightStr ?? '--'}</span>
              <span className="ohm-lbl">HT</span>
            </div>
            <div className="ohm-stat">
              <span className="ohm-val">{weightLbs ?? '--'}</span>
              <span className="ohm-lbl">WT</span>
            </div>
          </div>
          <div className="ovr-ring-wrap">
            <OvrRing ovr={ovr} />
            <div className="ovr-ring-inner">
              <div className="ovr-ring-label">OVR</div>
              <div className={`ovr-number ${ovr ? 'lit' : ''}`} style={ovr ? { color: ovrColor(ovr), textShadow: `0 0 32px ${ovrColor(ovr)}55` } : undefined}>
                {ovr ?? '--'}
              </div>
            </div>
          </div>
        </div>
        <div className="ovr-arch">{arch}</div>
        <div className="ovr-sep" />
        <button
          className={`sim-btn${complete ? '' : ' sim-btn-locked'}`}
          onClick={complete ? onSimulate : undefined}
          disabled={!complete}
        >
          {!complete ? `${types.length - filled.length} slots remaining` : hasResult ? 'View Results' : 'Simulate Season'}
        </button>
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
