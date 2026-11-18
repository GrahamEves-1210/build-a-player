import { useMemo } from 'react'
import { playArt } from '../../lib/franchise2/playArt'

// A call drawn the way a coach draws it on the board (lib/franchise2/playArt.js: the engine's own line-up for this
// snap): the line of scrimmage, the line to gain and the goal line where they fall, the offense in Os and the defense
// in Xs, the routes, the blocks (a bar at the end) and the ball carrier's path in the team's colour. The man the player
// runs is filled in. Loaded with the moment's picker (Week.jsx), not with the franchise.
const clipTop = (pts, top) => {
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
    if (by <= top) { out.push(pts[i]); continue }
    const t = ay >= top ? 0 : (top - ay) / (by - ay)
    if (t > 0) out.push([ax + (bx - ax) * t, top])
    break
  }
  return out
}
export default function PlayArt({ v, id, className = '' }) {
  const A = useMemo(() => { try { return playArt(v, id) } catch { return null } }, [v?.seed, id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!A) return <span className={`gd-art is-none ${className}`} aria-hidden="true" />
  const [x0, x1, y0, y1] = A.view
  const r = (x1 - x0) / 54, sw = r * 0.42
  const Y = y => -y
  const top = y1 - r * 1.6
  const line = pts => pts.map(([x, y]) => `${x.toFixed(2)},${Y(y).toFixed(2)}`).join(' ')
  const head = (pts, size) => {
    const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1]
    const ang = Math.atan2(Y(by) - Y(ay), bx - ax), px = bx, py = Y(by)
    const p = (a, d) => `${(px + Math.cos(a) * d).toFixed(2)},${(py + Math.sin(a) * d).toFixed(2)}`
    return `${p(ang, size * 0.35)} ${p(ang + 2.5, size)} ${p(ang - 2.5, size)}`
  }
  const tee = pts => {
    const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1]
    const ang = Math.atan2(Y(by) - Y(ay), bx - ax) + Math.PI / 2, d = r * 0.9
    return [[bx + Math.cos(ang) * d, Y(by) + Math.sin(ang) * d], [bx - Math.cos(ang) * d, Y(by) - Math.sin(ang) * d]]
  }
  const goalIn = A.goal != null && A.goal < y1
  return (
    <svg className={`gd-art ${className}`} viewBox={`${x0} ${-y1} ${x1 - x0} ${y1 - y0}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <rect x={x0} y={-y1} width={x1 - x0} height={y1 - y0} className="gd-art-bg" />
      {goalIn && <rect x={x0} y={-y1} width={x1 - x0} height={y1 - A.goal} className="gd-art-ez" />}
      {goalIn && <line x1={x0} x2={x1} y1={-A.goal} y2={-A.goal} className="gd-art-goal" strokeWidth={sw * 1.2} />}
      <line x1={x0} x2={x1} y1={0} y2={0} className="gd-art-los" strokeWidth={sw * 1.3} />
      {A.ltg != null && A.ltg < y1 && (!goalIn || A.ltg < A.goal) && <line x1={x0} x2={x1} y1={-A.ltg} y2={-A.ltg} className="gd-art-ltg" strokeWidth={sw * 1.1} strokeDasharray={`${r * 1.4} ${r}`} />}
      {A.paths.map((p, i) => {
        const pts = clipTop(p.pts, top)
        if (pts.length < 2) return null
        const cls = `gd-art-p is-${p.k}`
        return (
          <g key={i} className={cls}>
            <polyline points={line(pts)} fill="none" strokeWidth={p.k === 'carry' ? sw * 1.5 : sw} strokeDasharray={p.k === 'read' ? `${r * 0.9} ${r * 0.7}` : undefined} strokeLinejoin="round" strokeLinecap="round" />
            {p.k === 'block'
              ? <line x1={tee(pts)[0][0]} y1={tee(pts)[0][1]} x2={tee(pts)[1][0]} y2={tee(pts)[1][1]} strokeWidth={sw} strokeLinecap="round" />
              : <polygon points={head(pts, p.k === 'carry' ? r * 1.7 : r * 1.35)} stroke="none" />}
          </g>
        )
      })}
      {A.men.map((m, i) => (m.k === 'd'
        ? <g key={i} className={`gd-art-x${m.me ? ' is-me' : ''}`} strokeWidth={m.me ? sw * 1.6 : sw * 1.1} strokeLinecap="round">
            <line x1={m.x - r * 0.8} y1={Y(m.y) - r * 0.8} x2={m.x + r * 0.8} y2={Y(m.y) + r * 0.8} />
            <line x1={m.x - r * 0.8} y1={Y(m.y) + r * 0.8} x2={m.x + r * 0.8} y2={Y(m.y) - r * 0.8} />
          </g>
        : <circle key={i} cx={m.x} cy={Y(m.y)} r={r} className={`gd-art-o${m.me ? ' is-me' : ''}`} strokeWidth={sw} />))}
      {A.labels.map((l, i) => <text key={i} x={l.x} y={Y(l.y) + r * 0.5} className="gd-art-lbl" fontSize={r * 1.5} textAnchor="middle">{l.t}</text>)}
    </svg>
  )
}
