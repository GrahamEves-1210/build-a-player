import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useProgress, COMPETE_REWARDS } from '../../lib/progress'
import { POOL_SIZE, FILL_AFTER_SECS, MIN_POOL } from '../../lib/compete'
import { IconClose, IconArrow, IconTrophy } from './icons'
import OnlineRecord, { RatingLine, LinkPill } from './OnlineRecord'
import { sfx, victory } from '../../lib/juice'
import { NameTag, AvatarBadge } from './NameTag'
import { AUCTION_POS, BUDGET, BID_SECS } from '../../lib/auction'
import { guardLeave } from '../../lib/liveLock'
const AppAuction = lazy(() => import('./AppAuction'))

// COMPETE screen: the lobby (your stats, pick a position, find a pool), the
// queue, the wait for the rest of the pool, and the final ranking. The build
// itself happens on the game page (App / BucketApp wire the pool's seed in).

const ord = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const initials = name => (name || '?').trim().slice(0, 2).toUpperCase()
// A player's picture and name with their look (mine live)
const Pic = ({ p, me, size = 34 }) => (p.bot ? <span className="cp-av">{initials(p.name)}</span> : <AvatarBadge name={p.name} cos={p.cos} self={p.vid === me} size={size} className="cp-avb" />)
const Name = ({ p, me }) => (p.bot ? <>{p.name}</> : <NameTag name={p.name} cos={p.cos} self={p.vid === me} plate={false} />)


function Seat({ p, i, me, status }) {
  return (
    <div className={`cp-seat${p ? '' : ' is-open'}${p?.vid === me ? ' is-me' : ''}`} style={{ '--d': `${i * 50}ms` }}>
      {p ? <Pic p={p} me={me} /> : <span className="cp-av">?</span>}
      <span className="cp-seat-name">{p ? <Name p={p} me={me} /> : 'Open seat'}</span>
      {status && <span className="cp-seat-status">{status}</span>}
    </div>
  )
}

export default function AppCompete({ cp, au, sport, position, positions, onPosition, onHome, onResumeBuild, onPlayAgain }) {
  // two modes: the classic pool (same spins, best OVR) and the Trait Auction
  const [mode, setModeRaw] = useState(() => { try { return localStorage.getItem('bap_compete_mode') === 'auction' ? 'auction' : 'pool' } catch { return 'pool' } })
  const setMode = m => { setModeRaw(m); try { localStorage.setItem('bap_compete_mode', m) } catch {} }
  const auctionOn = !!au && au.phase !== 'idle'
  const showAuction = auctionOn || (!!au && mode === 'auction' && cp.phase === 'idle')
  const auPositions = positions.filter(o => (AUCTION_POS[sport === 'bucket' ? 'bucket' : 'nfl'] ?? []).includes(o.pos))
  // the auction has no DB: switching to it moves you to a position it has
  useEffect(() => { if (showAuction && !auctionOn && auPositions.length && !auPositions.some(o => o.pos === position)) onPosition(auPositions[0].pos) }, [showAuction, position]) // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const isBucket = sport === 'bucket'
  // The pool's over: the winner sees their own victory, everyone else sees the winner's
  const cheered = useRef(null)
  useEffect(() => {
    if (cp.phase !== 'result' || !cp.match || cheered.current === cp.match.code || !cp.ranked.length) return
    cheered.current = cp.match.code
    const top = cp.ranked[0]
    if (!top?.res) return
    setTimeout(() => (top.vid === cp.me.vid ? victory() : victory({ of: top.cos ?? {} })), 500)
  }, [cp.phase, cp.match?.code, cp.ranked]) // eslint-disable-line react-hooks/exhaustive-deps
  const posName = positions.find(o => o.pos === position)?.label ?? position.toUpperCase()

  let body
  if (auctionOn) {
    body = <Suspense fallback={null}><AppAuction au={au} posName={posName} onHome={onHome} onPlayAgain={() => au.join()} /></Suspense>
  } else if (cp.phase === 'queue') {
    const seats = Array.from({ length: POOL_SIZE }, (_, i) => [...cp.queue].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))[i] ?? null)
    body = (
      <>
        <div className="cp-finding ag-pop">
          <span className="cp-pulse" />
          <span className="ag-eyebrow">FINDING A POOL · {posName}</span>
          <b className="cp-count">{Math.min(cp.queue.length, POOL_SIZE)}<i>/{POOL_SIZE}</i></b>
          <span className="cp-sub">{cp.queue.length < MIN_POOL ? 'Waiting for another player. Pools are real players only.' : cp.waited < FILL_AFTER_SECS ? `Starts at ${POOL_SIZE}, or with ${cp.queue.length} in ${FILL_AFTER_SECS - cp.waited}s` : 'Starting…'}</span>
          <LinkPill link={cp.link} onRetry={cp.retry} room={`${isBucket ? 'BASKETBALL' : 'FOOTBALL'} ${posName.toUpperCase()} POOL`} />
          <span className="cp-sub cp-sub--room">Friends find you by picking the same sport and position.</span>
        </div>
        <div className="cp-seats">{seats.map((p, i) => <Seat key={i} p={p} i={i} me={cp.me.vid} />)}</div>
        <div className="cp-actions">
          {cp.waited >= 6 && cp.queue.length >= MIN_POOL && cp.queue.length < POOL_SIZE && <button className="ag-btn cp-fill" onClick={cp.fillNow}>START NOW · {cp.queue.length} PLAYERS</button>}
          <button className="ag-btn ag-btn--ghost" onClick={() => { cp.leave() }}>CANCEL</button>
        </div>
      </>
    )
  } else if (cp.phase === 'build' || cp.phase === 'result') {
    const final = cp.phase === 'result'
    const mine = cp.results[cp.me.vid]
    // bots "lock in" over the build window, so the board fills like the humans'
    const shown = vid => final || (cp.results[vid] && (cp.results[vid].at <= now || !vid.startsWith('bot-')))
    const rows = final ? cp.ranked : cp.match.players
    const me = cp.ranked.find(p => p.vid === cp.me.vid)
    body = (
      <>
        {final ? (
          <div className={`cp-podium ag-pop${me?.place === 1 ? ' is-win' : ''}`}>
            <span className="ag-eyebrow">POOL {cp.match.code} · FINAL</span>
            <b className="cp-place">{mine ? ord(me.place) : 'DNF'}</b>
            <span className="cp-sub">{mine ? (me.place === 1 ? 'You took the pool.' : `of ${cp.ranked.length} · ${mine.ovr} OVR`) : 'Time ran out before you locked in.'}</span>
            {mine && <span className="cp-reward">+{(COMPETE_REWARDS[me.place] ?? COMPETE_REWARDS[5])[0]} XP · +{(COMPETE_REWARDS[me.place] ?? COMPETE_REWARDS[5])[1]} COINS{me.place < cp.ranked.length ? ` · beat ${cp.ranked.length - me.place}` : ''}</span>}
            {mine && <RatingLine mode="compete" />}
          </div>
        ) : (
          <div className="cp-finding ag-pop">
            <span className="ag-eyebrow">POOL {cp.match.code} · {mmss(cp.clock)} LEFT</span>
            <b className="cp-count cp-count--sm">{mine ? 'LOCKED IN' : 'BUILDING'}</b>
            <span className="cp-sub">{mine ? `${mine.ovr} OVR · waiting for the rest of the pool` : 'Same spins for everyone. Respins are your own.'}</span>
            {!mine && <button className="ag-btn" onClick={onResumeBuild}>BACK TO MY BUILD <IconArrow size={14} /></button>}
          </div>
        )}
        <div className="cp-board">
          {rows.map((p, i) => {
            const r = cp.results[p.vid]
            const show = shown(p.vid)
            return (
              <div key={p.vid} className={`cp-row ag-pop${p.vid === cp.me.vid ? ' is-me' : ''}${final && p.place === 1 ? ' is-first' : ''}`} style={{ '--d': `${i * 60}ms` }}>
                <span className="cp-rank">{final ? (p.place === 1 ? <IconTrophy size={16} /> : p.place) : ''}</span>
                <Pic p={p} me={cp.me.vid} />
                <span className="cp-row-name"><Name p={p} me={cp.me.vid} /></span>
                <span className="cp-row-ovr">{r?.forfeit ? 'LEFT' : final ? (r ? <><b>{r.ovr}</b> OVR</> : 'DNF') : show ? (p.vid === cp.me.vid ? <><b>{r.ovr}</b> OVR</> : 'LOCKED IN') : <i>building…</i>}</span>
              </div>
            )
          })}
        </div>
        {final && (
          <div className="cp-actions">
            <button className="ag-btn" onClick={() => { sfx('tap'); onPlayAgain() }}>PLAY AGAIN</button>
            <button className="ag-btn ag-btn--ghost" onClick={() => { cp.leave(); onHome() }}>HOME</button>
          </div>
        )}
      </>
    )
  } else {
    body = (
      <>
        {au && (
          <div className="cp-modes ag-pop" role="tablist" aria-label="Compete mode">
            <button role="tab" aria-selected={!showAuction} className={`cp-mode${!showAuction ? ' is-on' : ''}`} onClick={() => setMode('pool')}>CLASSIC POOL</button>
            <button role="tab" aria-selected={showAuction} className={`cp-mode${showAuction ? ' is-on' : ''}`} onClick={() => setMode('auction')}>TRAIT AUCTION</button>
          </div>
        )}
        {showAuction ? (
          <div className="cp-hero ag-pop">
            <span className="ag-eyebrow">ONLINE · UP TO 5 PLAYERS · ${BUDGET} EACH</span>
            <p className="cp-how">Everyone starts with <b>${BUDGET}</b> and Salary Cap's five rating slots, empty. The spinner lands on a real player and one of those ratings, and you get <b>{BID_SECS} seconds</b> to bid. High bid takes it. When every slot is filled, the <b>highest OVR</b> wins.</p>
          </div>
        ) : (
          <div className="cp-hero ag-pop">
            <span className="ag-eyebrow">ONLINE · {POOL_SIZE}-PLAYER POOLS</span>
            <p className="cp-how">You and four other players get <b>the same spins</b>. Respins are your own. Everyone builds, and the <b>highest OVR</b> takes the pool. No sandbox.</p>
          </div>
        )}
        <OnlineRecord mode="compete" title="YOUR COMPETE" />
        <div className="cp-pos ag-pop" style={{ '--d': '120ms' }} role="tablist" aria-label="Position">
          {(showAuction ? auPositions : positions).filter(o => !o.disabled).map(o => (
            <button key={o.pos} role="tab" aria-selected={o.pos === position} className={`ag-pos${o.pos === position ? ' ag-pos--on' : ''}`} onClick={() => onPosition(o.pos)}>
              <span className="ag-pos-label">{o.label}</span>
            </button>
          ))}
        </div>
        <button className="ag-btn cp-go ag-pop" style={{ '--d': '160ms' }} onClick={showAuction ? () => au.join() : cp.join}>{showAuction ? 'FIND AN AUCTION' : 'FIND A POOL'} <IconArrow size={16} /></button>
        <div className="cp-rewards ag-pop" style={{ '--d': '200ms' }}>
          {[1, 2, 3, 4, 5].map(n => <span key={n}><b>{ord(n)}</b>+{COMPETE_REWARDS[n][0]} XP · +{COMPETE_REWARDS[n][1]}c</span>)}
        </div>
      </>
    )
  }

  return (
    <div className={`ag-screen cp cp--${isBucket ? 'bucket' : 'nfl'}`}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{isBucket ? 'BASKETBALL' : 'FOOTBALL'} · {posName}{showAuction ? ' · TRAIT AUCTION' : ''}</span><h1 className="ag-h1">Compete</h1></div>
        <button className="ag-round-btn" onClick={() => guardLeave(() => { if (cp.phase === 'queue') cp.leave(); if (au?.phase === 'queue') au.leave(); onHome() })} aria-label="Home"><IconClose size={16} /></button>
      </div>
      {body}
    </div>
  )
}
