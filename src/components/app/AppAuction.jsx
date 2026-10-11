import { useEffect, useMemo, useRef, useState } from 'react'
import { AUCTION_SIZE, AUCTION_MIN, AUCTION_FILL_SECS, BUDGET, SPIN_MS, openSlots, maxBid, minNext, canBidOn, maxLots } from '../../lib/auction'
import { COMPETE_REWARDS } from '../../lib/progress'
import { valToGrade } from '../../utils/simulation'
import { seededShuffle } from '../../lib/rng'
import { sfx, haptic, victory } from '../../lib/juice'
import { IconTrophy } from './icons'
import { LinkPill } from './OnlineRecord'
import { NameTag, AvatarBadge } from './NameTag'
import { LiveLeaveButton } from './LiveLeave'

// TRAIT AUCTION (lib/auction.js): the queue, the floor, the results.
// The floor: who's bidding and what they've got left, the spinner landing on
// a player and one of their traits, the bidding window, your four slots.

const ord = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`
const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')
const Pic = ({ p, me, size = 34 }) => <AvatarBadge name={p.name} cos={p.cos} self={p.vid === me} size={size} className="cp-avb" />
const Name = ({ p, me }) => <NameTag name={p.name} cos={p.cos} self={p.vid === me} plate={false} />

function Headshot({ kit, name, className = '' }) {
  const [bad, setBad] = useState(false)
  const src = kit.photo(name)
  return src && !bad
    ? <img className={`au-shot ${className}`} src={src} alt="" draggable={false} onError={() => setBad(true)} />
    : <span className={`au-shot au-shot--none ${className}`}>{name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
}

// The bidding window, draining: the time left is read once, then CSS runs it
function Drain({ end, total }) {
  const [ms] = useState(() => Math.max(0, end - Date.now()))
  return <i className="is-run" style={{ '--ms': `${ms}ms`, '--from': Math.min(1, ms / total) }} />
}

// The reel: a strip of real players that lands on the lot's
function Reel({ kit, lot, seed }) {
  const strip = useMemo(() => {
    const others = seededShuffle(kit.pool.filter(p => p.name !== lot.name), `${seed}:reel:${lot.n}`).slice(0, 13)
    return [...others, { name: lot.name, team: lot.team }]
  }, [kit, lot.n, lot.name, lot.team, seed])
  return (
    <div className="au-reel" aria-hidden="true">
      <div className="au-reel-strip" style={{ '--n': strip.length - 1, '--ms': `${SPIN_MS - 250}ms` }}>
        {strip.map((p, i) => (
          <div key={i} className="au-reel-row">
            <Headshot kit={kit} name={p.name} />
            <span>{p.name}</span>
            <img className="au-reel-logo" src={kit.logo(p.team)} alt="" />
          </div>
        ))}
      </div>
      <div className="au-reel-window" />
    </div>
  )
}

export default function AppAuction({ au, posName, onHome, onPlayAgain }) {
  const { kit, match: m, st, me } = au
  const mine = me.vid
  const cheered = useRef(null)

  // the gavel: a sound when a lot sells, a cheer at the end
  const lastSold = useRef(0)
  useEffect(() => {
    if (st?.stage !== 'sold' || lastSold.current === st.n) return
    lastSold.current = st.n
    if (st.sold?.vid === mine) { sfx('stamp'); haptic('heavy') } else sfx(st.sold ? 'tap' : 'deny')
  }, [st?.stage, st?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (au.phase !== 'result' || !m || cheered.current === m.code || !au.ranked.length) return
    cheered.current = m.code
    const top = au.ranked[0]
    setTimeout(() => (top.vid === mine ? victory() : victory({ of: top.cos ?? {} })), 500)
  }, [au.phase, m?.code, au.ranked]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── the queue ──
  if (au.phase === 'queue') {
    const seats = Array.from({ length: AUCTION_SIZE }, (_, i) => [...au.queue].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))[i] ?? null)
    return (
      <>
        <div className="cp-finding ag-pop">
          <span className="cp-pulse" />
          <span className="ag-eyebrow">FINDING AN AUCTION · {posName}</span>
          <b className="cp-count">{Math.min(au.queue.length, AUCTION_SIZE)}<i>/{AUCTION_SIZE}</i></b>
          <span className="cp-sub">{au.queue.length < AUCTION_MIN ? 'Waiting for another player. Auctions are real players only.' : au.waited < AUCTION_FILL_SECS ? `Starts at ${AUCTION_SIZE}, or with ${au.queue.length} in ${AUCTION_FILL_SECS - au.waited}s` : 'Starting…'}</span>
          <LinkPill link={au.link} onRetry={au.retry} room={`${kit.sport === 'bucket' ? 'BASKETBALL' : 'FOOTBALL'} ${posName} AUCTION`} />
        </div>
        <div className="cp-seats">
          {seats.map((p, i) => (
            <div key={i} className={`cp-seat${p ? '' : ' is-open'}${p?.vid === mine ? ' is-me' : ''}`} style={{ '--d': `${i * 50}ms` }}>
              {p ? <Pic p={p} me={mine} /> : <span className="cp-av">?</span>}
              <span className="cp-seat-name">{p ? <Name p={p} me={mine} /> : 'Open seat'}</span>
            </div>
          ))}
        </div>
        <div className="cp-actions">
          {au.waited >= 6 && au.queue.length >= AUCTION_MIN && au.queue.length < AUCTION_SIZE && <button className="ag-btn cp-fill" onClick={au.fillNow}>START NOW · {au.queue.length} PLAYERS</button>}
          <button className="ag-btn ag-btn--ghost" onClick={() => au.leave()}>CANCEL</button>
        </div>
      </>
    )
  }
  if (!m || !st) return null

  // ── the results ──
  if (au.phase === 'result') {
    const meR = au.ranked.find(p => p.vid === mine)
    const [xp, coins] = COMPETE_REWARDS[meR?.place] ?? COMPETE_REWARDS[5]
    return (
      <>
        <div className={`cp-podium ag-pop${meR?.place === 1 ? ' is-win' : ''}`}>
          <span className="ag-eyebrow">AUCTION {m.code} · FINAL</span>
          <b className="cp-place">{meR ? ord(meR.place) : '—'}</b>
          <span className="cp-sub">{meR ? (meR.place === 1 ? `Best build in the room · ${meR.ovr} OVR` : `of ${au.ranked.length} · ${meR.ovr} OVR · $${meR.left} left`) : ''}</span>
          {meR && <span className="cp-reward">+{xp} XP · +{coins} COINS</span>}
        </div>
        <div className="au-final">
          {au.ranked.map((p, i) => (
            <div key={p.vid} className={`au-final-row ag-pop${p.vid === mine ? ' is-me' : ''}${p.place === 1 ? ' is-first' : ''}`} style={{ '--d': `${i * 60}ms` }}>
              <span className="cp-rank">{p.place === 1 ? <IconTrophy size={16} /> : p.place}</span>
              <Pic p={p} me={mine} />
              <span className="au-final-who">
                <span className="cp-row-name"><Name p={p} me={mine} /></span>
                <span className="au-final-traits">
                  {m.types.map(t => <i key={t} style={{ '--g': gradeColor(p.slots[t].val) }} title={`${kit.attrLabel(t)}: ${p.slots[t].name}`}>{kit.attrLabel(t)} <b>{valToGrade(p.slots[t].val)}</b></i>)}
                </span>
              </span>
              <span className="cp-row-ovr">{p.forfeit ? 'LEFT' : <><b>{p.ovr}</b> OVR<small>${p.left} left</small></>}</span>
            </div>
          ))}
        </div>
        <div className="cp-actions">
          <button className="ag-btn" onClick={() => { sfx('tap'); onPlayAgain() }}>PLAY AGAIN</button>
          <button className="ag-btn ag-btn--ghost" onClick={() => { au.leave(); onHome() }}>HOME</button>
        </div>
      </>
    )
  }

  // ── the floor ──
  const L = st.L
  const lot = st.lot
  const bidEnd = st.t0 + SPIN_MS + m.bidSecs * 1000
  const spinning = st.stage === 'lot' && au.now < st.t0 + SPIN_MS
  const bidding = st.stage === 'lot' && !spinning
  const secs = bidding ? Math.max(0, Math.ceil((bidEnd - au.now) / 1000)) : m.bidSecs
  const high = st.high
  const highP = high && m.players.find(p => p.vid === high.vid)
  const myMax = maxBid(L, mine, m.types)
  const mayBid = lot && canBidOn(L, mine, m.types, lot.trait)
  const passed = st.passed.includes(mine)
  const floorBid = minNext(high)
  const offers = [...new Set([floorBid, (high?.amount ?? 0) + 5, (high?.amount ?? 0) + 10].filter(a => a >= floorBid && a <= myMax))]
  const myBuild = m.types.map(t => [t, L.won[mine]?.[t]])
  const here = new Set(au.present.map(p => p.vid))
  const soldTo = st.sold && m.players.find(p => p.vid === st.sold.vid)

  let controls
  if (!lot || st.stage === 'wait') controls = <p className="au-note">The auctioneer's spinning up the first lot…</p>
  else if (st.stage === 'sold') controls = <p className="au-note">{L.won[mine] && openSlots(L, mine, m.types).length === 0 ? 'Your build is done. Watching the rest of the room.' : 'Next lot coming up…'}</p>
  else if (!mayBid) controls = <p className="au-note">{L.won[mine]?.[lot.trait] ? `Your ${kit.attrLabel(lot.trait)} slot is filled. Watching this one.` : 'Out of money for this one.'}</p>
  else if (spinning) controls = <p className="au-note">Bidding opens when the spinner stops.</p>
  else if (high?.vid === mine) controls = <p className="au-note au-note--lead">You're the high bidder at ${high.amount}.</p>
  else if (passed) controls = <p className="au-note">You passed on this one.</p>
  else controls = (
    <div className="au-bids">
      {offers.map(a => (
        <button key={a} className="au-bid" onClick={() => { if (au.bid(a)) { sfx('tap'); haptic('light') } }}>
          <small>{a === floorBid ? (high ? 'RAISE' : 'OPEN') : `+${a - (high?.amount ?? 0)}`}</small><b>${a}</b>
        </button>
      ))}
      {myMax > (offers.at(-1) ?? 0) && myMax >= floorBid && (
        <button className="au-bid au-bid--max" onClick={() => { if (au.bid(myMax)) { sfx('tap'); haptic('medium') } }}><small>ALL IN</small><b>${myMax}</b></button>
      )}
      <button className="au-pass" onClick={() => { au.pass(); sfx('tap') }}>PASS</button>
    </div>
  )

  return (
    <>
      <div className="au-top">
        <span className="ag-eyebrow">AUCTION {m.code} · LOT {st.n || 1} OF {maxLots(m)}</span>
        <LiveLeaveButton />
      </div>

      <div className="au-room" role="list" aria-label="Bidders">
        {m.players.map(p => {
          const out = L.out.includes(p.vid)
          return (
            <div key={p.vid} role="listitem" className={`au-bidder${p.vid === mine ? ' is-me' : ''}${high?.vid === p.vid ? ' is-high' : ''}${out || !here.has(p.vid) && p.vid !== mine ? ' is-away' : ''}`}>
              <Pic p={p} me={mine} size={30} />
              <span className="au-bidder-name"><Name p={p} me={mine} /></span>
              <b className="au-cash">${L.wallets[p.vid]}</b>
              <span className="au-dots">{m.types.map(t => <i key={t} className={L.won[p.vid]?.[t] ? 'is-in' : ''} style={L.won[p.vid]?.[t] ? { '--g': gradeColor(L.won[p.vid][t].val) } : undefined} />)}</span>
              {out ? <em>LEFT</em> : st.stage === 'lot' && st.passed.includes(p.vid) ? <em>PASS</em> : null}
            </div>
          )
        })}
      </div>

      <div className={`au-stage${st.stage === 'sold' ? (st.sold ? ' is-sold' : ' is-pass') : ''}${bidding && secs <= 3 ? ' is-urgent' : ''}`}>
        {lot && spinning ? (
          <Reel kit={kit} lot={lot} seed={m.seed} />
        ) : lot ? (
          <div className="au-lot" key={lot.n}>
            <Headshot kit={kit} name={lot.name} className="au-lot-shot" />
            <div className="au-lot-info">
              <span className="au-lot-who"><img src={kit.logo(lot.team)} alt="" /> {lot.name}</span>
              <span className="au-lot-trait">{kit.attrLabel(lot.trait)}</span>
              <b className="au-lot-grade" style={{ '--g': gradeColor(lot.val) }}>{valToGrade(lot.val)}</b>
              {kit.slotTraits(lot.trait).length > 1 && <span className="au-lot-covers">{kit.slotTraits(lot.trait).map((t, i) => <i key={t}>{t} <b>{valToGrade(Object.values(lot.vals ?? {})[i] ?? lot.val)}</b></i>)}</span>}
            </div>
          </div>
        ) : (
          <div className="au-lot au-lot--wait"><span className="cp-pulse" /><span className="cp-sub">Everyone has ${BUDGET}. {m.types.length} slots each.</span></div>
        )}
        {st.stage === 'lot' && (
          <div className="au-clock">
            <div className="au-bar">{bidding ? <Drain key={st.n} end={bidEnd} total={m.bidSecs * 1000} /> : <i />}</div>
            <span className="au-high">{high ? <>HIGH <b>${high.amount}</b> · {highP ? <Name p={highP} me={mine} /> : '—'}</> : bidding ? <>OPENING BID <b>$1</b></> : 'SPINNING…'}</span>
            <b className="au-secs">{bidding ? secs : ''}</b>
          </div>
        )}
        {st.stage === 'sold' && (
          <div className="au-gavel ag-pop">{st.sold ? <>SOLD · {soldTo ? <Name p={soldTo} me={mine} /> : '—'} · <b>${st.sold.amount}</b></> : 'NO BIDS · NEXT LOT'}</div>
        )}
      </div>

      {controls}

      <div className="au-mine">
        <div className="au-mine-head"><span className="ag-eyebrow">YOUR BUILD</span><b className="au-cash">${L.wallets[mine]} <small>left · max bid ${myMax}</small></b></div>
        <div className="au-slots">
          {myBuild.map(([t, w]) => (
            <div key={t} className={`au-slot${w ? ' is-in' : ''}${lot?.trait === t && st.stage === 'lot' ? ' is-up' : ''}`} style={w ? { '--g': gradeColor(w.val) } : undefined}>
              <span className="au-slot-t">{kit.attrLabel(t)}</span>
              {w ? <><b>{valToGrade(w.val)}</b><small>{w.name} · ${w.price}</small></> : <small>empty</small>}
            </div>
          ))}
        </div>
      </div>

      {L.log.length > 0 && (
        <div className="au-log" aria-label="Recent lots">
          {L.log.slice(0, 4).map(e => {
            const who = e.vid && m.players.find(p => p.vid === e.vid)
            return <span key={e.n}>{kit.attrLabel(e.trait)} {valToGrade(e.val)} · {e.name} → {who ? <><Name p={who} me={mine} /> ${e.amount}</> : 'no bids'}</span>
          })}
        </div>
      )}
    </>
  )
}
