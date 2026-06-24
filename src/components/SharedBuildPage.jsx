import { useState, useEffect } from 'react'
import { ATTR, QB_PHYSICALS } from '../data/qbs'
import { calcOVR, getArchetype, valToGrade } from '../utils/simulation'
import QBAvatar from './QBAvatar'

function fmtHeight(inches) { return `${Math.floor(inches / 12)}'${inches % 12}"` }

function ovrColor(ovr) {
  if (!ovr) return 'rgba(149,213,178,0.12)'
  if (ovr >= 95) return '#fbbf24'
  if (ovr >= 85) return '#95D5B2'
  if (ovr >= 75) return '#60a5fa'
  if (ovr >= 65) return '#fb923c'
  return '#f87171'
}

export default function SharedBuildPage({ build, types, onPlay }) {
  const [rowsVisible, setRowsVisible] = useState(0)

  const filled = types.filter(t => build[t])
  const ovr    = calcOVR(build, types)
  const arch   = getArchetype(ovr, build, types)
  const color  = ovrColor(ovr)

  const bodyPhys  = build['size'] ? QB_PHYSICALS[build['size'].qbFull] : null
  const legsPhys  = build['legs'] ? QB_PHYSICALS[build['legs'].qbFull] : null
  const hwBoth    = bodyPhys && legsPhys
  const heightStr = hwBoth ? fmtHeight(Math.round(0.65 * legsPhys.height + 0.35 * bodyPhys.height)) : null
  const weightLbs = hwBoth ? Math.round(0.65 * bodyPhys.weight + 0.35 * legsPhys.weight) : null

  useEffect(() => {
    let i = 0
    const tick = () => {
      if (i >= filled.length) return
      i++
      setRowsVisible(i)
      setTimeout(tick, 70)
    }
    const t = setTimeout(tick, 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="about-page" style={{ padding: '20px 20px 40px' }}>
      <div className="about-inner" style={{ gap: '14px' }}>

        {/* OVR hero */}
        <div className="shv-hero">
          <div className="shv-ovr-num" style={{ color, textShadow: `0 0 40px ${color}44` }}>
            {ovr ?? '--'}
          </div>
          <div className="shv-ovr-lbl">OVR</div>
          <div className="shv-arch">{arch}</div>
        </div>

        {/* Quick stat pills */}
        {hwBoth && (
          <div className="shv-pills">
            <div className="shv-pill"><span className="shv-pill-val">{heightStr}</span><span className="shv-pill-lbl">Height</span></div>
            <div className="shv-pill"><span className="shv-pill-val">{weightLbs} lbs</span><span className="shv-pill-lbl">Weight</span></div>
          </div>
        )}

        <div className="about-header-line" style={{ margin: '-10px 0 -10px' }} />

        {/* Attribute list */}
        <div className="simp-attr-table">
          {filled.map((t, i) => {
            const meta = ATTR[t]
            const data = build[t]
            return (
              <div
                key={t}
                className={`simp-attr-row${i < rowsVisible ? ' simp-row-visible' : ''}`}
              >
                <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={46} />
                <div className="simp-attr-info">
                  <span className="simp-attr-name">{meta.label}</span>
                  <span className="simp-attr-qb">{data.qbFull}</span>
                </div>
                <span className="simp-grade-circle" style={{ background: meta.hex, color: '#07120a' }}>
                  {valToGrade(data.val)}
                </span>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="shv-cta-block">
          <div className="shv-cta-label">Think you can do better?</div>
          <button className="sim-btn" onClick={onPlay} style={{ marginTop: 0 }}>
            Build Your Own →
          </button>
        </div>

      </div>
    </div>
  )
}
