import { QBS, ATTR } from '../data/qbs'
import { valToGrade } from '../utils/simulation'

function AttributeChip({ qb, attr, used, onDragStart, onDragEnd }) {
  const meta = ATTR[attr.type]
  const dragData = { type: attr.type, val: attr.val, qb: qb.short, qbFull: qb.name, photo: qb.photo, teamColor: qb.color, teamColor2: qb.color2, skinColor: qb.skin, number: qb.number, team: qb.team, captain: qb.captain ?? false }

  return (
    <div
      className={`attr-chip chip-${attr.type} ${used ? 'used' : ''}`}
      draggable={!used}
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(dragData)
      }}
      onDragEnd={onDragEnd}
    >
      <span className="chip-dot" style={{ background: meta.col }} />
      <div className="chip-label">{meta.label}</div>
      <div className="chip-value">{valToGrade(attr.val)}</div>
      <div className="chip-grip">⠿</div>
    </div>
  )
}

function QBCard({ qb, build, onDragStart, onDragEnd }) {
  return (
    <div className="qb-card">
      <div className="qb-card-hd">
        <span className="qb-dot" style={{ background: qb.color }} />
        <div className="qb-info">
          <div className="qb-name">{qb.name}</div>
          <div className="qb-meta-row">
            <span className={`qb-era era-${qb.era.toLowerCase()}`}>{qb.era}</span>
            <span className="qb-team">{qb.team}</span>
          </div>
        </div>
      </div>
      <div className="attr-chips">
        {qb.attrs.map(attr => (
          <AttributeChip
            key={attr.type}
            qb={qb}
            attr={attr}
            used={build[attr.type] !== null}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  )
}

export default function DraftPool({ build, onDragStart, onDragEnd }) {
  return (
    <aside className="panel-left">
      <div className="panel-hd">
        <div className="panel-eyebrow">Draft Pool</div>
        <div className="panel-title-lg">QB Attribute Library</div>
      </div>
      <div className="qb-roster">
        {QBS.map(qb => (
          <QBCard
            key={qb.name}
            qb={qb}
            build={build}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </aside>
  )
}
