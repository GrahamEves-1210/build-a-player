import { lazy, Suspense } from 'react'
import { usePresence, fmtCount } from '../../lib/presence'
import { useLiveCounts, searching } from '../../lib/liveCounts'
import { XpIco } from './GainIcons'
import { COMPETE_REWARDS, useProgress } from '../../lib/progress'
import { IconClose, IconArrow } from './icons'
import { Form, TierChip } from './OnlineRecord'
import { AUCTION_SIZE, BUDGET, auctionKit } from '../../lib/auction'
import { guardLeave } from '../../lib/liveLock'
const AppAuction = lazy(() => import('./AppAuction'))

// TRAIT AUCTION, the mode's own screen (Compete's old place, owner 11-26): the lobby
// (how it works, the position, your record, find an auction), then the queue, the
// floor and the results (AppAuction). Football QB, RB or WR; basketball guard or big; soccer the striker.

const ord = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`

// the gavel, raised over its block (public/fx: the hammer and the block, cut from one picture). Its box is the
// whole swing (-12° back to 45° down, measured off the picture's own pixels): the art sits 27% in and 8% down, so the
// hammer never leaves the box at any point of the swing
export const GavelMark = ({ className = '' }) => (
  <span className={`gv-swing ${className}`} aria-hidden="true">
    <img className="gv-block" src="/fx/gavel-block.webp" alt="" draggable={false} />
    <img className="gv-head" src="/fx/gavel-hammer.webp" alt="" draggable={false} />
  </span>
)

// the auction record, one flat line: played, wins, average place, the last few places
function AuctionRecord() {
  const c = useProgress().stats?.compete ?? {}
  const avg = c.played ? (c.placeSum / c.played).toFixed(1) : '–'
  return (
    <div className="au-rec">
      <span className="au-rec-n"><b>{c.played ?? 0}</b><small>PLAYED</small></span>
      <span className="au-rec-n"><b>{c.wins ?? 0}</b><small>WINS</small></span>
      <span className="au-rec-n"><b>{avg}</b><small>AVG PLACE</small></span>
      <span className="au-rec-form"><Form items={c.recent ?? []} mode="compete" /></span>
    </div>
  )
}

export default function AppTraitAuction({ au, sport, position, positions, onPosition, onHome }) {
  const live = au.phase !== 'idle'
  const here = usePresence()?.areas?.auction ?? 0
  // how many are waiting in each position's queue (lib/liveCounts.js), while the lobby's up
  const waiting = useLiveCounts(!live)
  const isBucket = sport === 'bucket'
  const sportKey = isBucket ? 'bucket' : sport === 'soccer' ? 'soccer' : 'nfl'
  const sportName = { bucket: 'BASKETBALL', soccer: 'SOCCER', nfl: 'FOOTBALL' }[sportKey]
  const posName = positions.find(o => o.pos === position)?.label ?? position.toUpperCase()
  const prog = useProgress()

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
    body = null
  }
  const rating = prog.stats?.online?.rating ?? 800

  // the lobby: Blacktop's hub (AppBlacktop BlacktopHubView): the name big on a full-bleed header, the positions as
  // one list, one button, the record on one line, the prizes and the rules under it
  if (!live && au.phase !== 'busy') {
    return (
      <div className={`ag-screen cp au-screen au-hub cp--${sportKey}`}>
        <header className="au-hub-stage">
          <div className="au-hub-in">
            <div className="au-hub-top">
              <span className="au-hub-eyebrow">{sportName} · ONLINE · 2–3 PLAYERS</span>
              <button className="ag-round-btn au-hub-x" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
            </div>
            <h1 className="au-hub-title">Trait{' '}<br />Auction</h1>
            <div className="au-hub-foot">
              {here > 0 && <span className="au-hub-on"><i aria-hidden="true" /><b>{fmtCount(here)}</b>PLAYING</span>}
              <button className="au-hub-rating" onClick={() => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'online' }))}>
                <small>ONLINE RATING</small><TierChip rating={rating} /><b>{rating}</b><IconArrow size={13} />
              </button>
            </div>
          </div>
          <GavelMark className="au-hub-gavel" />
        </header>
        <div className="au-hub-body">
          <div className="au-hub-main">
            {positions.length > 1 ? (
              <div className="au-hub-pos" role="radiogroup" aria-label="Position">
                {positions.map(o => {
                  const on = o.pos === position
                  const n = searching(waiting, `au:${sportKey}-${o.pos}`)
                  const k = auctionKit(sportKey, o.pos)
                  return (
                    <button key={o.pos} role="radio" aria-checked={on} className={`au-hub-row${on ? ' is-on' : ''}`} onClick={() => onPosition(o.pos)}>
                      <b className="au-hub-tag">{o.label}</b>
                      <span className="au-hub-line">{k.types.map(t => k.attrLabel(t)).join(' · ')}{n && <em><i aria-hidden="true" />{n} SEARCHING</em>}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="au-hub-pos"><div className="au-hub-row is-on is-only"><b className="au-hub-tag">{posName}</b><span className="au-hub-line">{au.kit.types.map(t => au.kit.attrLabel(t)).join(' · ')}</span></div></div>
            )}
            <button className="ag-btn au-hub-go" onClick={() => au.join()}>FIND AN AUCTION <IconArrow size={18} /></button>
            <AuctionRecord />
          </div>
          <div className="au-hub-side">
            <div className="au-hub-sec"><span>PRIZES</span></div>
            <div className="au-prizes">
              {Array.from({ length: AUCTION_SIZE }, (_, i) => i + 1).map(n => (
                <span key={n} className="au-prize"><b>{ord(n)}</b><span className="gain"><XpIco /> +{COMPETE_REWARDS[n][0]}</span><span className="gain"><span className="coin-ico coin-ico--sm" /> +{COMPETE_REWARDS[n][1]}</span></span>
              ))}
            </div>
            <div className="au-hub-sec"><span>HOW IT WORKS</span></div>
            <ol className="au-how">
              <li><b>1</b>5 slots · ${BUDGET} to fill them</li>
              <li><b>2</b>Highest bid wins the card</li>
              <li><b>3</b>Fill first, the rest get random cards</li>
            </ol>
          </div>
        </div>
      </div>
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
