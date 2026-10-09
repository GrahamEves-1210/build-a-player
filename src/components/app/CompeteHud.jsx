import { useEffect, useState } from 'react'
import { useProgress } from '../../lib/progress'

// COMPETE: the bar on the build page — the pool, the clock, who's locked in
export default function CompeteHud({ cp }) {
  const [now, setNow] = useState(Date.now())
  const c = useProgress().stats?.compete
  const myAvg = c?.played ? Math.round(c.ovrSum / c.played) : null
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  if (!cp.match) return null
  const inNow = p => { const r = cp.results[p.vid]; return !!r && (!p.bot || r.at <= now) }
  const done = cp.match.players.filter(inNow).length
  const m = Math.floor(cp.clock / 60), s = String(cp.clock % 60).padStart(2, '0')
  return (
    <div className="cp-hud" role="status">
      <span><small>COMPETE · POOL {cp.match.code}</small></span>
      <b>{m}:{s}</b>
      <span className="cp-hud-dots" aria-label={`${done} of ${cp.match.players.length} locked in`}>
        {cp.match.players.map(p => <i key={p.vid} className={inNow(p) ? 'is-in' : ''} />)}
      </span>
      <small>{done}/{cp.match.players.length} IN{myAvg ? ` · YOUR AVG ${myAvg}` : ''}</small>
    </div>
  )
}
