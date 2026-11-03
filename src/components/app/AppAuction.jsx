import { useEffect, useMemo, useRef, useState } from 'react'
import { XpIco } from './GainIcons'
import { useRailOn } from '../../lib/ads'
import { AUCTION_SIZE, AUCTION_MIN, AUCTION_FILL_SECS, BUDGET, SPIN_MS, RESET_SECS, openSlots, maxBid, minNext, canBidOn, lotEnd, callOf } from '../../lib/auction'
import { COMPETE_REWARDS } from '../../lib/progress'
import { valToGrade } from '../../utils/simulation'
import { seededShuffle } from '../../lib/rng'
import { sfx, haptic, victory } from '../../lib/juice'
import { IconTrophy } from './icons'
import { LinkPill } from './OnlineRecord'
import { NameTag, AvatarBadge } from './NameTag'
import { LiveLeaveButton } from './LiveLeave'
import { RollingNumber } from './MotionText'

// TRAIT AUCTION (lib/auction.js): the queue, the floor, the results.
// The floor: who's bidding and what they've got left, the deck shuffling and its
// top card turning over on a player (for one of the slots), the grade face down
// until the gavel, going once / going twice, your five slots.

const ord = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`
const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }   // rounded like the letter (valToGrade)
const Pic = ({ p, me, size = 34 }) => <AvatarBadge name={p.name} cos={p.cos} self={p.vid === me} size={size} className="cp-avb" />
const Name = ({ p, me }) => <NameTag name={p.name} cos={p.cos} self={p.vid === me} />

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

// A lot's card, face up: the player's headshot over his team's logo, his name
// along the bottom. No photo: his initials, the same size, never stretched
const PlayerFace = ({ kit, lot }) => (
  <div className="au-pcard">
    <div className="au-pcard-pic">
      <img className="au-pcard-logo" src={kit.logo(lot.team)} alt="" draggable={false} />
      <Headshot kit={kit} name={lot.name} className="au-pcard-shot" />
    </div>
    <span className="au-pcard-name">{lot.name}</span>
  </div>
)

// The deck: the cards shuffle, then the top one is pulled and turns over on the lot's player
const DECK_MS = 1500
function Deck({ kit, lot, seed }) {
  const backs = useMemo(() => seededShuffle([0, 1, 2, 3], `${seed}:deck:${lot.n}`), [lot.n, seed])
  return (
    <div className="au-deck" aria-hidden="true" style={{ '--deck': `${DECK_MS}ms` }}>
      {backs.map((k, i) => (
        <div key={k} className="au-card" style={{ '--i': i, '--s': i % 2 ? 1 : -1 }}>
          <div className="au-card-in"><div className="au-card-back"><span>BAP</span></div></div>
        </div>
      ))}
      <div className="au-card is-pull" style={{ '--i': backs.length, '--s': 1 }}>
        <div className="au-card-in">
          <div className="au-card-back"><span>BAP</span></div>
          <div className="au-card-face"><PlayerFace kit={kit} lot={lot} /></div>
        </div>
      </div>
    </div>
  )
}

// The gavel (public/fx: the hammer and its block, cut from one picture so they line up):
// it winds back, comes down on the block, bounces, and lifts away again
function Gavel() {
  return (
    <span className="au-hammer" aria-hidden="true">
      <img className="au-hammer-block" src="/fx/gavel-block.webp" alt="" draggable={false} />
      <img className="au-hammer-head" src="/fx/gavel-hammer.webp" alt="" draggable={false} />
      <i className="au-hammer-hit" />
    </span>
  )
}

export default function AppAuction({ au, posName, onHome, onPlayAgain }) {
  const { kit, match: m, st, me } = au
  const mine = me.vid
  const cheered = useRef(null)
  useRailOn(st?.n ?? 0)   // each lot brings the bottom rail back

  // the gavel: a sound when a lot sells, a cheer at the end
  const lastSold = useRef(0)
  useEffect(() => {
    if (st?.stage !== 'sold' || lastSold.current === st.n) return
    lastSold.current = st.n
    // a sale: the sound lands with the gavel's hit (0.44s into its swing)
    const t = setTimeout(() => { if (st.sold?.vid === mine) { sfx('stamp'); haptic('heavy') } else sfx(st.sold ? 'tap' : 'deny') }, st.sold ? 440 : 0)
    return () => clearTimeout(t)
  }, [st?.stage, st?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  // the deck: a shuffle, then the pulled card flips; the auctioneer's calls tick
  const lotN = st?.stage === 'lot' ? st.n : 0
  useEffect(() => {
    if (!lotN) return
    sfx('swap')
    const t = setTimeout(() => sfx('flip'), 1500)
    return () => clearTimeout(t)
  }, [lotN])
  const nowCall = st?.stage === 'lot' && m && au.now >= st.t0 + SPIN_MS ? callOf(Math.max(0, lotEnd(st, m) - au.now)) : null
  useEffect(() => { if (nowCall) { sfx('tick'); haptic('light') } }, [nowCall])
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
          <span className="cp-sub">{au.queue.length >= AUCTION_SIZE ? 'Starting…' : au.queue.length < AUCTION_MIN ? 'Waiting for another player. Auctions are real players only.' : `Starts in ${Math.max(0, AUCTION_FILL_SECS - au.waited)}s with ${au.queue.length}, or as soon as ${AUCTION_SIZE} are in. Every join resets the clock.`}</span>
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
          {meR && <span className="cp-reward gain"><XpIco /> +{xp} · <span className="coin-ico coin-ico--sm" /> +{coins}</span>}
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
  const bidEnd = lotEnd(st, m)
  const spinning = st.stage === 'lot' && au.now < st.t0 + SPIN_MS
  const bidding = st.stage === 'lot' && !spinning
  const left = bidding ? Math.max(0, bidEnd - au.now) : 0
  const call = bidding ? callOf(left) : null
  const high = st.high
  const highP = high && m.players.find(p => p.vid === high.vid)
  const myMax = maxBid(L, mine, m.types)
  const mayBid = lot && canBidOn(L, mine, m.types, lot.trait)
  const passed = st.passed.includes(mine)
  const nextBid = minNext(high)
  // a bigger step when you want it: three over the high bid, if you can afford it
  const jumpBid = (high?.amount ?? 0) + 3 <= myMax ? (high?.amount ?? 0) + 3 : null
  const myBuild = m.types.map(t => [t, L.won[mine]?.[t]])
  const here = new Set(au.present.map(p => p.vid))
  const soldTo = st.sold && m.players.find(p => p.vid === st.sold.vid)
  const sold = st.stage === 'sold'
  const shown = sold && st.sold   // the grade turns over at the gavel

  let controls
  if (!lot || st.stage === 'wait') controls = <p className="au-note">The auctioneer's shuffling the deck…</p>
  else if (sold) controls = <p className="au-note">{L.won[mine] && openSlots(L, mine, m.types).length === 0 ? 'Your build is done. Watching the rest of the room.' : 'Shuffling the next card…'}</p>
  else if (!mayBid) controls = <p className="au-note">{L.won[mine]?.[lot.trait] ? `Your ${kit.attrLabel(lot.trait)} slot is filled. Watching this one.` : 'Out of money for this one.'}</p>
  else if (spinning) controls = <p className="au-note">Bidding opens when the card turns over.</p>
  else if (high?.vid === mine) controls = <p className="au-note au-note--lead">You're high at ${high.amount}. Hold on…</p>
  else if (passed) controls = <p className="au-note">You're out on this one.</p>
  else controls = (
    <div className={`au-bids${jumpBid ? ' has-jump' : ''}`}>
      <button className="au-bid" disabled={nextBid > myMax} onClick={() => { if (au.bid(nextBid)) { sfx('tap'); haptic('light') } }}>
        <small>{high ? 'BID +1' : 'OPEN AT'}</small><b>${nextBid}</b>
      </button>
      {jumpBid && (
        <button className="au-bid au-bid--jump" onClick={() => { if (au.bid(jumpBid)) { sfx('tap'); haptic('medium') } }}>
          <small>+3</small><b>${jumpBid}</b>
        </button>
      )}
      <button className="au-pass" onClick={() => { au.pass(); sfx('tap') }}>I'M OUT</button>
    </div>
  )

  return (
    <>
      <div className="au-top">
        <span className="ag-eyebrow">AUCTION {m.code} · LOT {st.n || 1}</span>
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
              <span className="au-dots">{m.types.map(t => <i key={t} className={L.won[p.vid]?.[t] ? 'is-in' : ''} />)}</span>
              {out ? <em>LEFT</em> : st.stage === 'lot' && st.passed.includes(p.vid) ? <em>OUT</em> : null}
            </div>
          )
        })}
      </div>

      <div className={`au-stage${sold ? (st.sold ? ' is-sold' : ' is-pass') : ''}${call ? ` is-${call}` : ''}`}>
        {lot ? (
          // the card turns over on the player; what he's up for reads beside it once it has
          <div className={`au-lot${spinning ? ' is-pulling' : ''}`} key={lot.n} style={{ '--deck': `${DECK_MS}ms` }}>
            {spinning
              ? <Deck kit={kit} lot={lot} seed={m.seed} />
              : <div className="au-card au-card--lot"><div className="au-card-face"><PlayerFace kit={kit} lot={lot} /></div></div>}
            <div className="au-lot-info">
              <span className="au-lot-for">UP FOR</span>
              <b className="au-lot-trait">{kit.attrLabel(lot.trait)}</b>
              {kit.slotTraits(lot.trait).length > 1 && <span className="au-lot-covers">{kit.slotTraits(lot.trait).join(' · ')}</span>}
              <span className="au-lot-team"><img src={kit.logo(lot.team)} alt="" /> {lot.team}</span>
            </div>
            <div className={`au-grade${shown ? ' is-open' : ''}`} aria-label={shown ? `Grade ${valToGrade(lot.val)}` : 'Grade hidden'}>
              <div className="au-grade-in">
                <span className="au-grade-back">?</span>
                {shown && <b className="au-grade-face" style={{ '--g': gradeColor(lot.val) }}>{valToGrade(lot.val)}</b>}
              </div>
            </div>
          </div>
        ) : (
          <div className="au-lot au-lot--wait"><span className="cp-pulse" /><span className="cp-sub">Everyone has ${BUDGET} and {m.types.length} slots. Grades stay face down until the gavel.</span></div>
        )}
        {st.stage === 'lot' && (
          <div className="au-clock">
            <div className="au-bar">{bidding ? <Drain key={`${st.n}:${st.last}`} end={bidEnd} total={(st.last ? RESET_SECS : m.bidSecs) * 1000} /> : <i />}</div>
            <span className="au-high">{high ? <>HIGH <b>$<RollingNumber value={high.amount} /></b> · {highP ? <Name p={highP} me={mine} /> : '—'}</> : bidding ? <>OPENING BID <b>$1</b></> : au.now >= st.t0 + DECK_MS ? 'BIDDING OPENS…' : 'SHUFFLING…'}</span>
            <b className={`au-call${call ? ' is-on' : ''}`} key={call ?? 'tick'}>{call === 'once' ? 'GOING ONCE' : call === 'twice' ? 'GOING TWICE' : bidding ? Math.ceil(left / 1000) : ''}</b>
          </div>
        )}
        {sold && (
          <div className="au-gavel">{st.sold
            ? <><Gavel key={st.n} /><span className="au-gavel-txt" key={`t${st.n}`}>SOLD · {soldTo ? <Name p={soldTo} me={mine} /> : '—'} · <b>${st.sold.amount}</b></span></>
            : 'NO BIDS · BACK IN THE DECK'}</div>
        )}
      </div>

      {controls}

      <div className="au-mine">
        <div className="au-mine-head"><span className="ag-eyebrow"><NameTag name={me.name} self /></span><b className="au-cash">${L.wallets[mine]} <small>left · max bid ${myMax}</small></b></div>
        <div className="au-slots">
          {myBuild.map(([t, w]) => (
            <div key={t} className={`au-slot${w ? ' is-in' : ''}${lot?.trait === t && st.stage === 'lot' ? ' is-up' : ''}`} style={w ? { '--g': gradeColor(w.val) } : undefined}>
              <span className="au-slot-t">{kit.attrLabel(t)}</span>
              {w ? <><b>{valToGrade(w.val)}</b><small>{w.name} · ${w.price}</small></> : <small>{lot?.trait === t && st.stage === 'lot' ? 'Up now' : 'Open'}</small>}
            </div>
          ))}
        </div>
      </div>

      {L.log.length > 0 && (
        <div className="au-log" aria-label="Recent lots">
          {L.log.slice(0, 4).map(e => {
            const who = e.vid && m.players.find(p => p.vid === e.vid)
            return <span key={e.n}>{kit.attrLabel(e.trait)}{e.vid ? ` ${valToGrade(e.val)}` : ''} · {e.name} → {who ? <><Name p={who} me={mine} /> ${e.amount}</> : 'no bids'}</span>
          })}
        </div>
      )}
    </>
  )
}
