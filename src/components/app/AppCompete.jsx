import { useEffect, useState } from 'react'
import { useProgress, COMPETE_REWARDS } from '../../lib/progress'
import { POOL_SIZE, FILL_AFTER_SECS } from '../../lib/compete'
import { IconClose, IconArrow, IconTrophy } from './icons'
import OnlineRecord, { RatingLine } from './OnlineRecord'
import { sfx } from '../../lib/juice'

// COMPETE screen: the lobby (your stats, pick a position, find a pool), the
// queue, the wait for the rest of the pool, and the final ranking. The build
// itself happens on the game page (App / BucketApp wire the pool's seed in).

const ord = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const initials = name => (name || '?').trim().slice(0, 2).toUpperCase()


function Seat({ p, i, me, status }) {
  return (
    <div className={`cp-seat${p ? '' : ' is-open'}${p?.vid === me ? ' is-me' : ''}`} style={{ '--d': `${i * 50}ms` }}>
      <span className="cp-av">{p ? initials(p.name) : '?'}</span>
      <span className="cp-seat-name">{p ? p.name : 'Open seat'}</span>
      {status && <span className="cp-seat-status">{status}</span>}
    </div>
  )
}

export default function AppCompete({ cp, sport, position, positions, onPosition, onHome, onResumeBuild, onPlayAgain }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const isBucket = sport === 'bucket'
  const posName = positions.find(o => o.pos === position)?.label ?? position.toUpperCase()

  let body
  if (cp.phase === 'queue') {
    const seats = Array.from({ length: POOL_SIZE }, (_, i) => [...cp.queue].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))[i] ?? null)
    body = (
      <>
        <div className="cp-finding ag-pop">
          <span className="cp-pulse" />
          <span className="ag-eyebrow">FINDING A POOL · {posName}</span>
          <b className="cp-count">{Math.min(cp.queue.length, POOL_SIZE)}<i>/{POOL_SIZE}</i></b>
          <span className="cp-sub">Bots take the empty seats in {Math.max(0, FILL_AFTER_SECS - cp.waited)}s</span>
        </div>
        <div className="cp-seats">{seats.map((p, i) => <Seat key={i} p={p} i={i} me={cp.me.vid} />)}</div>
        <div className="cp-actions">
          {cp.waited >= 6 && <button className="ag-btn cp-fill" onClick={cp.fillNow}>START WITH BOTS</button>}
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
                <span className="cp-av">{initials(p.name)}</span>
                <span className="cp-row-name">{p.name}</span>
                <span className="cp-row-ovr">{final ? (r ? <><b>{r.ovr}</b> OVR</> : 'DNF') : show ? (p.vid === cp.me.vid ? <><b>{r.ovr}</b> OVR</> : 'LOCKED IN') : <i>building…</i>}</span>
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
        <div className="cp-hero ag-pop">
          <span className="ag-eyebrow">ONLINE · {POOL_SIZE}-PLAYER POOLS</span>
          <p className="cp-how">You and four other players get <b>the same spins</b>. Respins are your own. Everyone builds, and the <b>highest OVR</b> takes the pool. No sandbox.</p>
        </div>
        <OnlineRecord mode="compete" title="YOUR COMPETE" />
        <div className="cp-pos ag-pop" style={{ '--d': '120ms' }} role="tablist" aria-label="Position">
          {positions.filter(o => !o.disabled).map(o => (
            <button key={o.pos} role="tab" aria-selected={o.pos === position} className={`ag-pos${o.pos === position ? ' ag-pos--on' : ''}`} onClick={() => onPosition(o.pos)}>
              <span className="ag-pos-label">{o.label}</span>
            </button>
          ))}
        </div>
        <button className="ag-btn cp-go ag-pop" style={{ '--d': '160ms' }} onClick={cp.join}>FIND A POOL <IconArrow size={16} /></button>
        <div className="cp-rewards ag-pop" style={{ '--d': '200ms' }}>
          {[1, 2, 3, 4, 5].map(n => <span key={n}><b>{ord(n)}</b>+{COMPETE_REWARDS[n][0]} XP · +{COMPETE_REWARDS[n][1]}c</span>)}
        </div>
      </>
    )
  }

  return (
    <div className={`ag-screen cp cp--${isBucket ? 'bucket' : 'nfl'}`}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{isBucket ? 'BASKETBALL' : 'FOOTBALL'} · {posName}</span><h1 className="ag-h1">Compete</h1></div>
        <button className="ag-round-btn" onClick={() => { if (cp.phase === 'queue') cp.leave(); onHome() }} aria-label="Home"><IconClose size={16} /></button>
      </div>
      {body}
    </div>
  )
}
