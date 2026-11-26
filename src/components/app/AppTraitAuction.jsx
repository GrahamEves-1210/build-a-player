import { lazy, Suspense } from 'react'
import { usePresence, fmtCount } from '../../lib/presence'
import { useLiveCounts, searching } from '../../lib/liveCounts'
import { XpIco } from './GainIcons'
import { COMPETE_REWARDS } from '../../lib/progress'
import { IconClose, IconArrow } from './icons'
import OnlineRecord from './OnlineRecord'
import { AUCTION_SIZE, BUDGET, RESET_SECS } from '../../lib/auction'
import { guardLeave } from '../../lib/liveLock'
const AppAuction = lazy(() => import('./AppAuction'))

// TRAIT AUCTION, the mode's own screen (Compete's old place, owner 11-26): the lobby
// (how it works, the position, your record, find an auction), then the queue, the
// floor and the results (AppAuction). Football QB, RB or WR; basketball guard or big; soccer the striker.

const ord = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`

// the gavel, raised over its block (public/fx: the hammer and the block, cut from one picture)
export const GavelMark = ({ className = '' }) => (
  <span className={`au-mark ${className}`} aria-hidden="true">
    <img className="au-mark-block" src="/fx/gavel-block.webp" alt="" draggable={false} />
    <img className="au-mark-head" src="/fx/gavel-hammer.webp" alt="" draggable={false} />
  </span>
)

export default function AppTraitAuction({ au, sport, position, positions, onPosition, onHome }) {
  const live = au.phase !== 'idle'
  const here = usePresence()?.areas?.auction ?? 0
  // how many are waiting in each position's queue (lib/liveCounts.js), while the lobby's up
  const waiting = useLiveCounts(!live)
  const isBucket = sport === 'bucket'
  const sportKey = isBucket ? 'bucket' : sport === 'soccer' ? 'soccer' : 'nfl'
  const sportName = { bucket: 'BASKETBALL', soccer: 'SOCCER', nfl: 'FOOTBALL' }[sportKey]
  const posName = positions.find(o => o.pos === position)?.label ?? position.toUpperCase()

  let body
  if (au.phase === 'busy') {
    // one live game per device: another tab or window already has one going
    body = (
      <div className="cp-finding ag-pop">
        <span className="ag-eyebrow">ALREADY IN A GAME</span>
        <span className="cp-sub">You're in a live game in another tab or window. Finish it there first: one game at a time.</span>
        <button className="ag-btn ag-btn--ghost" onClick={() => au.leave()}>OK</button>
      </div>
    )
  } else if (live) {
    body = <Suspense fallback={null}><AppAuction au={au} posName={posName} onHome={onHome} onPlayAgain={() => au.join()} /></Suspense>
  } else {
    body = (
      <>
        <div className="au-intro ag-pop">
          <GavelMark />
          <div className="au-intro-txt">
            <div className="au-intro-head">
              <b>Conditions of sale</b>
              <span>ONLINE · 2–3 BIDDERS · ${BUDGET} EACH</span>
              {here > 0 && <span className="ag-live-badge ag-live-badge--inline"><i aria-hidden="true" />{fmtCount(here)}<small>PLAYING</small></span>}
            </div>
            <ol className="au-rules">
              <li><b>Five slots, ${BUDGET} to fill them.</b> A card is pulled for one slot and lands on a real player. His grade stays face down until the gavel.</li>
              <li><b>Bid $1 at a time.</b> Every bid puts the clock back to {RESET_SECS} seconds. Nobody bids, it goes back in the deck face up.</li>
              <li><b>Fill your build first.</b> Everyone else's open slots go to the draw. Best OVR wins the room.</li>
            </ol>
          </div>
        </div>
        {positions.length > 1 && <div className="cp-pos ag-pop" style={{ '--d': '80ms' }} role="tablist" aria-label="Position">
          {positions.map(o => {
            const n = searching(waiting, `au:${sportKey}-${o.pos}`)
            return (
              <button key={o.pos} role="tab" aria-selected={o.pos === position} className={`ag-pos${o.pos === position ? ' ag-pos--on' : ''}`} onClick={() => onPosition(o.pos)}>
                {n && <span className="cp-pos-n">{n} SEARCHING</span>}
                <span className="ag-pos-label">{o.label}</span>
              </button>
            )
          })}
        </div>}
        <button className="ag-btn cp-go ag-pop" style={{ '--d': '120ms' }} onClick={() => au.join()}>FIND AN AUCTION <IconArrow size={16} /></button>
        <OnlineRecord mode="compete" title="AUCTION RECORD" />
        <div className="cp-rewards ag-pop" style={{ '--d': '200ms' }}>
          {Array.from({ length: AUCTION_SIZE }, (_, i) => i + 1).map(n => <span key={n}><b>{ord(n)}</b><span className="gain"><XpIco /> +{COMPETE_REWARDS[n][0]}</span><span className="gain"><span className="coin-ico coin-ico--sm" /> +{COMPETE_REWARDS[n][1]}</span></span>)}
        </div>
      </>
    )
  }

  return (
    <div className={`ag-screen cp au-screen cp--${sportKey}${au.phase === 'auction' || au.phase === 'result' ? ' is-live' : ''}`}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{sportName} · {posName}</span><h1 className="ag-h1">Trait Auction</h1></div>
        <button className="ag-round-btn" onClick={() => guardLeave(() => { if (au.phase === 'queue') au.leave(); onHome() })} aria-label="Home"><IconClose size={16} /></button>
      </div>
      {body}
    </div>
  )
}
