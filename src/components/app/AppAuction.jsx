import { useEffect, useMemo, useRef, useState } from 'react'
import { XpIco } from './GainIcons'
import { AUCTION_SIZE, AUCTION_MIN, AUCTION_FILL_SECS, BUDGET, RESET_SECS, DRAW_STEP_MS, openSlots, maxBid, minNext, canBidOn, lotEnd, spinOf, callOf } from '../../lib/auction'
import { COMPETE_REWARDS } from '../../lib/progress'
import { valToGrade } from '../../utils/simulation'
import { seededShuffle } from '../../lib/rng'
import { sfx, haptic, victory } from '../../lib/juice'
import { IconTrophy } from './icons'
import { LinkPill } from './OnlineRecord'
import { NameTag, AvatarBadge, Entrance } from './NameTag'
import { LiveLeaveButton } from './LiveLeave'
import { RollingNumber } from './MotionText'
import { spectrumColor } from '../../lib/gradeColors'

// TRAIT AUCTION (lib/auction.js): the queue, the floor, the draw, the results.
// The floor: who's bidding and what they've got left, the deck shuffling and its
// top card turning over on a player (for one of the slots), the grade face down
// until the gavel (sold or not: an unsold card turns over and goes back in the deck,
// and comes back up face up), going once / going twice, your five slots. When one
// bidder fills his build, the rest of the room's open slots are dealt from the deck.

const ord = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th'}`
const gradeColor = spectrumColor   // one shade a step (lib/gradeColors.js)   // rounded like the letter (valToGrade)
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
    const t = setTimeout(() => sfx('flip'), st?.lot?.known ? 300 : 1500)
    return () => clearTimeout(t)
  }, [lotN]) // eslint-disable-line react-hooks/exhaustive-deps
  const nowCall = st?.stage === 'lot' && m && au.now >= st.t0 + spinOf(st.lot) ? callOf(Math.max(0, lotEnd(st, m) - au.now)) : null
  // the draw: a card turning over for each open slot, then the cheer for whoever's build it was
  const drawN = st?.stage === 'draw' ? st.n : 0
  useEffect(() => {
    if (!drawN) return
    const n = Object.values(st.draw?.cards ?? {}).reduce((k, c) => k + Object.keys(c).length, 0)
    sfx('swap')
    const ts = Array.from({ length: n }, (_, i) => setTimeout(() => sfx('flip'), 700 + i * DRAW_STEP_MS))
    return () => ts.forEach(clearTimeout)
  }, [drawN]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (nowCall) { sfx('tick'); haptic('light') } }, [nowCall])
  useEffect(() => {
    if (au.phase !== 'result' || !m || cheered.current === m.code || !au.ranked.length) return
    cheered.current = m.code
    const top = au.ranked[0]
    setTimeout(() => (top.vid === mine ? victory() : victory({ of: top.cos ?? {} })), 500)
  }, [au.phase, m?.code, au.ranked]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── the queue ──
  if (au.phase === 'queue') {
    const list = [...au.queue].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
    const seats = Array.from({ length: AUCTION_SIZE }, (_, i) => list[i] ?? null)
    const n = Math.min(list.length, AUCTION_SIZE)
    return (
      <>
        <div className="cp-finding ag-pop">
          <span className="cp-pulse" />
          <span className="ag-eyebrow">FINDING AN AUCTION · {posName}</span>
          <b className="cp-count">{n}<i>/{AUCTION_SIZE}</i></b>
          <span className="cp-sub">{n >= AUCTION_SIZE ? 'Starting…' : n < AUCTION_MIN ? 'Waiting for another bidder. Auctions are real players only.' : `Starts in ${Math.max(0, AUCTION_FILL_SECS - au.waited)}s with ${n}, or as soon as a third is in.`}</span>
          <LinkPill link={au.link} onRetry={au.retry} room={`${kit.sport === 'bucket' ? 'BASKETBALL' : 'FOOTBALL'} ${posName} AUCTION`} />
          <span className="cp-sub cp-sub--room">Friends find you by picking the same sport and position.</span>
        </div>
        <div className="cp-seats au-seats">
          {seats.map((p, i) => (
            <div key={i} className={`cp-seat ent-host${p ? '' : ' is-open'}${p?.vid === mine ? ' is-me' : ''}`} style={{ '--d': `${i * 50}ms` }}>
              {p && <Entrance key={p.vid} cos={p.cos} />}
              {p ? <Pic p={p} me={mine} /> : <span className="cp-av">?</span>}
              <span className="cp-seat-name">{p ? <Name p={p} me={mine} /> : 'Open seat'}</span>
            </div>
          ))}
        </div>
        <div className="cp-actions">
          {n >= AUCTION_MIN && n < AUCTION_SIZE && <button className="ag-btn" onClick={() => { sfx('tap'); au.fillNow() }}>START WITH {n}</button>}
          <button className="ag-btn ag-btn--ghost" onClick={() => au.leave()}>CANCEL</button>
        </div>
      </>
    )
  }
  if (!m || !st) return null
  const nameOf = vid => m.players.find(p => p.vid === vid)

  // ── the results ──
  if (au.phase === 'result') {
    const meR = au.ranked.find(p => p.vid === mine)
    const [xp, coins] = COMPETE_REWARDS[meR?.place] ?? COMPETE_REWARDS[5]
    const closer = au.ranked.find(p => p.closer)
    return (
      <>
        <div className={`cp-podium ag-pop${meR?.place === 1 ? ' is-win' : ''}`}>
          <span className="ag-eyebrow">AUCTION {m.code} · FINAL</span>
          <b className="cp-place">{meR ? ord(meR.place) : '—'}</b>
          <span className="cp-sub">{meR ? (meR.place === 1 ? `Best build in the room · ${meR.ovr} OVR` : `of ${au.ranked.length} · ${meR.ovr} OVR · $${meR.left} left`) : ''}</span>
          {meR && <span className="cp-reward gain"><XpIco /> +{xp} · <span className="coin-ico coin-ico--sm" /> +{coins}</span>}
          {closer && <span className="au-final-note"><Name p={closer} me={mine} /> filled his build first. The rest went to the draw.</span>}
        </div>
        <div className="au-final">
          {au.ranked.map((p, i) => (
            <div key={p.vid} className={`au-final-row ag-pop${p.vid === mine ? ' is-me' : ''}${p.place === 1 ? ' is-first' : ''}`} style={{ '--d': `${i * 60}ms` }}>
              <span className="cp-rank">{p.place === 1 ? <IconTrophy size={16} /> : p.place}</span>
              <Pic p={p} me={mine} />
              <span className="au-final-who">
                <span className="cp-row-name"><Name p={p} me={mine} />{p.closer && <i className="au-tag">FILLED FIRST</i>}</span>
                <span className="au-final-traits">
                  {m.types.map(t => <i key={t} className={p.slots[t].drawn ? 'is-drawn' : undefined} style={{ '--g': gradeColor(p.slots[t].val) }} title={`${kit.attrLabel(t)}: ${p.slots[t].name}${p.slots[t].drawn ? ' (the draw)' : ''}`}>{kit.attrLabel(t)} <b>{valToGrade(p.slots[t].val)}</b></i>)}
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

  const L = st.L
  const myBuild = m.types.map(t => [t, L.won[mine]?.[t]])
  const mySlots = (
    <div className="au-mine">
      <div className="au-mine-head"><span className="ag-eyebrow"><NameTag name={me.name} self /></span><b className="au-cash">${L.wallets[mine]} <small>left · {openSlots(L, mine, m.types).length ? `max bid $${maxBid(L, mine, m.types)}` : 'build done'}</small></b></div>
      <div className="au-slots">
        {myBuild.map(([t, w]) => (
          <div key={t} className={`au-slot${w ? ' is-in' : ''}${w?.drawn ? ' is-drawn' : ''}${st.lot?.trait === t && st.stage === 'lot' ? ' is-up' : ''}`} style={w ? { '--g': gradeColor(w.val) } : undefined}>
            <span className="au-slot-t">{kit.attrLabel(t)}</span>
            {w ? <><b>{valToGrade(w.val)}</b><small>{w.name} · {w.drawn ? 'draw' : `$${w.price}`}</small></> : <small>{st.lot?.trait === t && st.stage === 'lot' ? 'Up now' : 'Open'}</small>}
          </div>
        ))}
      </div>
    </div>
  )

  // ── the draw: one bidder filled his build, the rest of the room's open slots are dealt ──
  if (st.stage === 'draw' && st.draw) {
    const by = nameOf(st.draw.by)
    let k = 0
    return (
      <>
        <div className="au-top">
          <span className="ag-eyebrow">AUCTION {m.code} · THE DRAW</span>
        </div>
        <div className="au-draw ag-pop">
          <span className="au-draw-head">{by ? <Name p={by} me={mine} /> : 'A bidder'} filled his build</span>
          <span className="au-draw-sub">The rest go to the draw · one random card a slot</span>
          <div className="au-draw-rows">
            {m.players.filter(p => st.draw.cards[p.vid]).map(p => (
              <div key={p.vid} className={`au-draw-row${p.vid === mine ? ' is-me' : ''}`}>
                <span className="au-draw-who"><Pic p={p} me={mine} size={26} /><Name p={p} me={mine} /></span>
                <span className="au-draw-cards">
                  {Object.entries(st.draw.cards[p.vid]).map(([t, c]) => {
                    const at = 700 + (k++) * DRAW_STEP_MS
                    return (
                      <span key={t} className="au-dcard" style={{ '--at': `${at}ms`, '--g': gradeColor(c.val) }}>
                        <span className="au-dcard-in">
                          <span className="au-dcard-back">?</span>
                          <span className="au-dcard-face"><small>{kit.attrLabel(t)}</small><b>{valToGrade(c.val)}</b><i>{c.name}</i></span>
                        </span>
                      </span>
                    )
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
        {mySlots}
      </>
    )
  }

  // ── the floor ──
  const lot = st.lot
  const bidEnd = lotEnd(st, m)
  const spinning = st.stage === 'lot' && au.now < st.t0 + spinOf(lot)
  const bidding = st.stage === 'lot' && !spinning
  const left = bidding ? Math.max(0, bidEnd - au.now) : 0
  const call = bidding ? callOf(left) : null
  const high = st.high
  const highP = high && nameOf(high.vid)
  const myMax = maxBid(L, mine, m.types)
  const mayBid = lot && canBidOn(L, mine, m.types, lot.trait)
  const passed = st.passed.includes(mine)
  const nextBid = minNext(high)
  // a bigger step when you want it: three over the high bid, if you can afford it
  const jumpBid = (high?.amount ?? 0) + 3 <= myMax ? (high?.amount ?? 0) + 3 : null
  const here = new Set(au.present.map(p => p.vid))
  const soldTo = st.sold && nameOf(st.sold.vid)
  const sold = st.stage === 'sold'
  // the grade turns over at the gavel, sold or not; a card back from the deck is already face up
  const shown = !!lot && (sold || lot.known) && lot.val != null
  const myDone = openSlots(L, mine, m.types).length === 0
  // the cards that went back in the deck unsold, face up: what could still come back
  const back = (L.back ?? []).filter(c => !(st.stage === 'lot' && lot?.known && c.trait === lot.trait && c.name === lot.name))

  let controls
  if (!lot || st.stage === 'wait') controls = <p className="au-note">The auctioneer's shuffling the deck…</p>
  else if (sold) controls = <p className="au-note">{myDone ? 'Your build is done.' : st.sold ? 'Next card coming up…' : 'Back in the deck. Next card coming up…'}</p>
  else if (!mayBid) controls = <p className="au-note">{L.won[mine]?.[lot.trait] ? `Your ${kit.attrLabel(lot.trait)} slot is filled. Watching this one.` : 'Out of money for this one.'}</p>
  else if (spinning) controls = <p className="au-note">{lot.known ? 'Back up, grade showing. Bidding opens in a moment.' : 'Bidding opens when the card turns over.'}</p>
  else if (high?.vid === mine) controls = <p className="au-note au-note--lead">High bid ${high.amount}. Hold on…</p>
  else if (passed) controls = <p className="au-note">Out on this one.</p>
  else if (nextBid > myMax) controls = <p className="au-note">Can't top ${high?.amount}: max bid ${myMax}.</p>
  else controls = (
    <div className={`au-bids${jumpBid ? ' has-jump' : ''}`}>
      <button className="au-bid" onClick={() => { if (au.bid(nextBid)) { sfx('tap'); haptic('light') } }}>
        <small>{high ? 'BID +1' : 'OPEN AT'}</small><b>${nextBid}</b>
      </button>
      {jumpBid && (
        <button className="au-bid au-bid--jump" onClick={() => { if (au.bid(jumpBid)) { sfx('tap'); haptic('medium') } }}>
          <small>+3</small><b>${jumpBid}</b>
        </button>
      )}
      <button className="au-pass" onClick={() => { au.pass(); sfx('tap') }}>PASS</button>
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
          const full = openSlots(L, p.vid, m.types).length === 0
          return (
            <div key={p.vid} role="listitem" className={`au-bidder${p.vid === mine ? ' is-me' : ''}${high?.vid === p.vid ? ' is-high' : ''}${out || !here.has(p.vid) && p.vid !== mine ? ' is-away' : ''}`}>
              <Pic p={p} me={mine} size={30} />
              <span className="au-bidder-name"><Name p={p} me={mine} /></span>
              <b className="au-cash">${L.wallets[p.vid]}</b>
              <span className="au-dots">{m.types.map(t => <i key={t} className={L.won[p.vid]?.[t] ? 'is-in' : ''} />)}</span>
              {out ? <em>LEFT</em> : full ? <em>DONE</em> : st.stage === 'lot' && st.passed.includes(p.vid) ? <em>PASS</em> : st.stage === 'lot' && lot && L.won[p.vid]?.[lot.trait] ? <em>FILLED</em> : null}
            </div>
          )
        })}
      </div>

      <div className={`au-stage${sold ? (st.sold ? ' is-sold' : ' is-pass') : ''}${call ? ` is-${call}` : ''}`}>
        {lot ? (
          // the card turns over on the player; what he's up for reads beside it once it has
          <div className={`au-lot${spinning && !lot.known ? ' is-pulling' : ''}`} key={lot.n} style={{ '--deck': `${DECK_MS}ms` }}>
            {spinning && !lot.known
              ? <Deck kit={kit} lot={lot} seed={m.seed} />
              : <div className="au-card au-card--lot"><div className="au-card-face"><PlayerFace kit={kit} lot={lot} /></div></div>}
            <div className="au-lot-info">
              <span className="au-lot-for">{lot.known && st.stage === 'lot' ? 'BACK FROM THE DECK' : 'UP FOR'}</span>
              <b className="au-lot-trait">{kit.attrLabel(lot.trait)}</b>
              {kit.slotTraits(lot.trait).length > 1 && <span className="au-lot-covers">{kit.slotTraits(lot.trait).join(' · ')}</span>}
              <span className="au-lot-team"><img src={kit.logo(lot.team)} alt="" /> {lot.team}</span>
            </div>
            <div className={`au-grade${shown ? ' is-open' : ''}${lot.known ? ' is-known' : ''}`} aria-label={shown ? `Grade ${valToGrade(lot.val)}` : 'Grade hidden'}>
              <div className="au-grade-in">
                <span className="au-grade-back">?</span>
                {shown && <b className="au-grade-face" style={{ '--g': gradeColor(lot.val) }}>{valToGrade(lot.val)}</b>}
              </div>
            </div>
          </div>
        ) : (
          <div className="au-lot au-lot--wait"><span className="cp-pulse" /><span className="cp-sub">Everyone has ${BUDGET} and {m.types.length} slots. New cards come up face down; the grade turns over at the gavel.</span></div>
        )}
        {st.stage === 'lot' && (
          <div className="au-clock">
            <div className="au-bar">{bidding ? <Drain key={`${st.n}:${st.last}`} end={bidEnd} total={(st.last ? RESET_SECS : m.bidSecs) * 1000} /> : <i />}</div>
            <span className="au-high">{high ? <>HIGH <b>$<RollingNumber value={high.amount} /></b> · {highP ? <Name p={highP} me={mine} /> : '—'}</> : bidding ? <>OPENING BID <b>$1</b></> : lot?.known || au.now >= st.t0 + DECK_MS ? 'BIDDING OPENS…' : 'SHUFFLING…'}</span>
            <b className={`au-call${call ? ' is-on' : ''}`} key={call ?? 'tick'}>{call === 'once' ? 'GOING ONCE' : call === 'twice' ? 'GOING TWICE' : bidding ? Math.ceil(left / 1000) : ''}</b>
          </div>
        )}
        {sold && (
          <div className="au-gavel">{st.sold
            ? <><Gavel key={st.n} /><span className="au-gavel-txt" key={`t${st.n}`}>SOLD · {soldTo ? <Name p={soldTo} me={mine} /> : '—'} · <b>${st.sold.amount}</b></span></>
            : <>NO BIDS · BACK IN THE DECK · <b style={{ color: gradeColor(lot.val) }}>{valToGrade(lot.val)}</b></>}</div>
        )}
      </div>

      {controls}

      {back.length > 0 && (
        <div className="au-back" aria-label="Back in the deck">
          <span className="ag-eyebrow">BACK IN THE DECK · FACE UP</span>
          <div className="au-back-cards">
            {back.map(c => (
              <span key={`${c.trait}:${c.name}`} className="au-back-card" style={{ '--g': gradeColor(c.val) }}>
                <b>{valToGrade(c.val)}</b><small>{kit.attrLabel(c.trait)}</small><i>{c.name}</i>
              </span>
            ))}
          </div>
        </div>
      )}

      {mySlots}

      {L.log.length > 0 && (
        <div className="au-log" aria-label="Recent lots">
          {L.log.slice(0, 4).map(e => {
            const who = e.vid && nameOf(e.vid)
            return <span key={e.n}>{kit.attrLabel(e.trait)} {valToGrade(e.val)} · {e.name} → {who ? <><Name p={who} me={mine} /> ${e.amount}</> : 'no bids'}</span>
          })}
        </div>
      )}
    </>
  )
}
