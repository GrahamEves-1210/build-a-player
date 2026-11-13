import { Logo, Num, barOf, quarterText, clockText, spotText, downText } from './parts'

// The scorebug: both logos, the score, the quarter and the clock, who has the ball, timeouts; under it the down and
// distance, the spot, and the field with the ball on it. Every box is a fixed size: a score going from 7 to 14 moves
// nothing. `final`: the game is over (FINAL in the middle, the loser's score dimmed, no field).
// g: { home, away, score: { [short]: n }, q, clock, poss, down, dist, spot, to: { [short]: 0-3 } | null, ot }
function Side({ short, g, right, final, rec }) {
  const bar = barOf(short), other = short === g.home ? g.away : g.home
  const lost = final && g.score[short] < g.score[other]
  return (
    <div className={`frgd-bug-side${right ? ' is-r' : ''}${!final && g.poss === short ? ' has-ball' : ''}`} style={{ '--bar': bar.color }}>
      <Logo short={short} size={34} />
      <div className="frgd-bug-name">
        <b>{short}</b>
        {final || !g.to ? (rec ? <small className="is-rec">{rec}</small> : <small />) : <small aria-label={`${g.to[short]} timeouts`}>{[0, 1, 2].map(i => <u key={i} className={i < g.to[short] ? 'is-on' : ''} />)}</small>}
      </div>
      <div className={`frgd-bug-score${lost ? ' is-lost' : ''}`}><Num v={g.score[short]} still={final} /></div>
    </div>
  )
}

export default function Scorebug({ g, final = false, title = false, records = null, note = null }) {
  const off = g.poss, def = off === g.home ? g.away : g.home
  // across the field from the away goal line (0) to the home one (100)
  const x = off == null || g.spot == null ? null : off === g.away ? g.spot : 100 - g.spot
  const toGo = x == null || !g.down || g.dist >= 100 - g.spot ? null : off === g.away ? Math.min(100, x + g.dist) : Math.max(0, x - g.dist)
  const a = barOf(g.away), h = barOf(g.home)
  return (
    <div className={`frgd-bug${title ? ' plf-game--title' : ''}`}>
      <div className="frgd-bug-row">
        <Side short={g.away} g={g} final={final} rec={records?.[g.away]} />
        <div className={`frgd-bug-mid${final ? ' is-final' : ''}`}>
          {final ? <b>{g.ot ? 'FINAL/OT' : 'FINAL'}</b> : <><b>{quarterText(g.q)}</b><span>{clockText(g.clock)}</span></>}
        </div>
        <Side short={g.home} g={g} right final={final} rec={records?.[g.home]} />
      </div>
      {!final && <>
        <div className="frgd-sit">
          <b>{off && g.down ? downText(g.down, g.dist, g.spot) : note}</b>
          <span>{g.down && off ? `BALL ON ${spotText(g.spot, off, def)}` : null}</span>
        </div>
        <div className="frgd-field" aria-hidden="true">
          <div className="frgd-field-ez" style={{ '--bar': a.color, '--ink': a.ink }}>{g.away}</div>
          <div className="frgd-field-turf">
            {toGo != null && <div className="frgd-field-line" style={{ transform: `translateX(${toGo}%)` }} />}
            {x != null && <div className="frgd-field-ball" style={{ transform: `translateX(${x}%)` }} />}
          </div>
          <div className="frgd-field-ez" style={{ '--bar': h.color, '--ink': h.ink }}>{g.home}</div>
        </div>
      </>}
    </div>
  )
}
