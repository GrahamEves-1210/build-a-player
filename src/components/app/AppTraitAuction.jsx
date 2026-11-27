import { lazy, Suspense } from 'react'
import { usePresence, fmtCount } from '../../lib/presence'
import { useLiveCounts, searching } from '../../lib/liveCounts'
import { XpIco } from './GainIcons'
import { COMPETE_REWARDS, useProgress } from '../../lib/progress'
import { IconClose, IconArrow } from './icons'
import { Form, TierChip } from './OnlineRecord'
import { AUCTION_SIZE, AUCTION_MIN, AUCTION_FILL_SECS, BUDGET, AUCTION_ANY, auctionKit, POS_INFO, posInfo } from '../../lib/auction'
import { sfx } from '../../lib/juice'
import { LinkPill } from './OnlineRecord'
import { NameTag, AvatarBadge, Entrance } from './NameTag'
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

// Finding an auction, under the lobby's header: one status line, the seats as plain rows, START WITH 2 when it
// can, LEAVE. (Real players only: two start when the countdown runs out or either asks, three at once)
const Pic = ({ p, me }) => <AvatarBadge name={p.name} cos={p.cos} self={p.vid === me} size={30} className="cp-avb" />
function QueueBody({ au, sportName }) {
  const mine = au.me.vid
  const list = [...au.queue].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
  const seats = Array.from({ length: AUCTION_SIZE }, (_, i) => list[i] ?? null)
  const n = Math.max(1, Math.min(list.length, AUCTION_SIZE))
  const line = n >= AUCTION_SIZE ? 'Starting' : n < AUCTION_MIN ? 'Real players only · waiting for another bidder' : `Starts in ${Math.max(0, AUCTION_FILL_SECS - au.waited)}s with ${n} · or as soon as a third is in`
  return (
    <div className="au-hub-body au-q">
      <div className="au-q-status">
        <b>FINDING BIDDERS · {n} OF {AUCTION_SIZE}</b>
        <span>{line}</span>
        <LinkPill link={au.link} onRetry={au.retry} room={`${sportName} AUCTION`} />
      </div>
      <div className="au-q-seats" role="list" aria-label="Bidders">
        {seats.map((p, i) => (
          <div key={i} role="listitem" className={`au-q-seat ent-host${p ? '' : ' is-open'}${p?.vid === mine ? ' is-me' : ''}`}>
            {p && <Entrance key={p.vid} cos={p.cos} />}
            {p ? <Pic p={p} me={mine} /> : <span className="au-q-av" aria-hidden="true" />}
            <span className="au-q-name">{p ? <NameTag name={p.name} cos={p.cos} self={p.vid === mine} /> : 'OPEN SEAT'}</span>
            {p && <small>{p.vid === mine ? 'READY' : 'IN'}</small>}
          </div>
        ))}
      </div>
      <div className="au-q-acts">
        {n >= AUCTION_MIN && n < AUCTION_SIZE && <button className="ag-btn au-hub-go" onClick={() => { sfx('tap'); au.fillNow() }}>START WITH {n}</button>}
        <button className="ag-btn ag-btn--ghost au-q-leave" onClick={() => au.leave()}>LEAVE</button>
      </div>
    </div>
  )
}

export default function AppTraitAuction({ au, sport, onHome }) {
  const live = au.phase !== 'idle'
  const here = usePresence()?.areas?.auction ?? 0
  // how many are waiting in the sport's queue (lib/liveCounts.js), while the lobby's up
  const waiting = useLiveCounts(!live)
  const isBucket = sport === 'bucket'
  const sportKey = isBucket ? 'bucket' : sport === 'soccer' ? 'soccer' : 'nfl'
  const sportName = { bucket: 'BASKETBALL', soccer: 'SOCCER', nfl: 'FOOTBALL' }[sportKey]
  // one queue a sport: the room draws the position (lib/auctionCore auctionPosFor); known once the room's open
  const positions = POS_INFO[sportKey]
  // (shown once the first card's up: before that the room is drawing it, AppAuction PosReveal)
  const roomPos = au.match?.pos && au.st?.n > 0 ? posInfo(sportKey, au.match.pos) : null
  const posName = roomPos?.tag ?? ''
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

  // the lobby: Blacktop's hub (AppBlacktop BlacktopHubView): the name big on a full-bleed header, the positions the
  // room can draw, one button, the record on one line, the prizes and the rules under it. Finding an auction keeps the
  // same header; the body is the room filling (QueueBody)
  const inQueue = au.phase === 'queue'
  const nSearching = searching(waiting, `au:${sportKey}-${AUCTION_ANY}`)
  if ((!live || inQueue) && au.phase !== 'busy') {
    return (
      <div className={`ag-screen cp au-screen au-hub cp--${sportKey}${inQueue ? ' is-queue' : ''}`}>
        <header className="au-hub-stage">
          <div className="au-hub-in">
            <div className="au-hub-top">
              <span className="au-hub-eyebrow">{sportName} · ONLINE · 2–3 PLAYERS</span>
              <button className="ag-round-btn au-hub-x" onClick={() => { if (inQueue) au.leave(); onHome() }} aria-label="Home"><IconClose size={16} /></button>
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
        {inQueue ? <QueueBody au={au} sportName={sportName} /> : <div className="au-hub-body">
          <div className="au-hub-main">
            {/* what the auction is: every position the room can draw, with its five slots (nobody picks: one queue a sport) */}
            <div className="au-hub-sec"><span>{positions.length > 1 ? 'POSITION · DRAWN WHEN THE ROOM FILLS' : 'POSITION'}</span></div>
            <div className="au-hub-pos is-list">
              {positions.map(o => {
                const k = auctionKit(sportKey, o.pos)
                return (
                  <div key={o.pos} className="au-hub-row">
                    <b className="au-hub-tag">{o.tag}</b>
                    <span className="au-hub-line">{o.name.toUpperCase() !== o.tag && <small>{o.name}</small>}{k.types.map(t => k.attrLabel(t)).join(' · ')}</span>
                  </div>
                )
              })}
            </div>
            {/* how many are in the sport's queue right now, as Blacktop's hub shows it over each mode (hidden at none) */}
            {nSearching && <span className="au-hub-n"><i aria-hidden="true" />{nSearching} SEARCHING</span>}
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
              <li><b>1</b>{positions.length > 1 ? 'The room draws the position' : `5 slots · $${BUDGET} to fill them`}</li>
              {positions.length > 1 && <li><b>2</b>5 slots · ${BUDGET} to fill them</li>}
              <li><b>{positions.length > 1 ? 3 : 2}</b>Highest bid wins the card</li>
              <li><b>{positions.length > 1 ? 4 : 3}</b>Fill first, the rest get random cards</li>
            </ol>
          </div>
        </div>}
      </div>
    )
  }

  return (
    <div className={`ag-screen cp au-screen cp--${sportKey}${au.phase === 'auction' || au.phase === 'result' ? ' is-live' : ''}`}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{sportName}{roomPos ? ` · ${roomPos.tag}` : ''}</span><h1 className="ag-h1">Trait Auction</h1></div>
        <button className="ag-round-btn" onClick={() => guardLeave(() => { if (au.phase === 'queue') au.leave(); onHome() })} aria-label="Home"><IconClose size={16} /></button>
      </div>
      {body}
    </div>
  )
}
