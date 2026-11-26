import { useEffect, useMemo, useRef, useState } from 'react'
import { XpIco } from './GainIcons'
import { POS_INFO, posInfo, AUCTION_SIZE, AUCTION_MIN, AUCTION_FILL_SECS, BUDGET, RESET_SECS, DRAW_STEP_MS, openSlots, maxBid, minNext, canBidOn, lotEnd, spinOf, callOf } from '../../lib/auction'
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

// a slot's name, short enough for the build strip (PACE & SIZE → PACE/SIZE, SIZE & ATHLETICISM → SIZE)
const shortLabel = l => String(l)   // (every slot by its full name, owner 11-26: no ELUSIVE, no PACE/SIZE)
const ovr1 = o => (Number.isFinite(o) ? o.toFixed(1) : '–')   // one decimal: 87.4
const lastName = n => { const w = String(n || '').split(' '); return w.length > 1 ? w.slice(1).join(' ') : w[0] }

// The lot: a real player card, the way Salary Cap draws one (his team's colour, the logo faded behind him, the ESPN
// headshot; no photo, the logo), his name along the bottom
function LotCard({ kit, lot, className = '' }) {
  const [bad, setBad] = useState(false)
  const src = kit.photo(lot.name, lot.team)
  const [first, ...rest] = lot.name.split(' ')
  const logo = kit.crest ? kit.crest(lot.name, lot.team) : kit.logo(lot.team)
  return (
    <div className={`sc-card sc-card--view au-lc ${className}`} style={{ '--tc': kit.teamColor(lot.team, lot.name) }}>
      <div className="sc-card-visual" data-team={lot.team}>
        <img src={logo} alt="" aria-hidden="true" className="sc-card-logo-bg" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />
        {src && !bad
          ? <img src={src} alt={lot.name} className="sc-card-headshot" draggable={false} onError={() => setBad(true)} />
          : <div className="sc-card-no-photo"><img src={logo} alt={lot.team} draggable={false} /></div>}
      </div>
      <div className="sc-card-name-wrap">
        <span className="sc-card-first">{rest.length ? first : lot.team}</span>
        <span className="sc-card-last">{rest.length ? rest.join(' ') : first}</span>
      </div>
    </div>
  )
}

// The bidding window, draining: the time left is read once, then CSS runs it
function Drain({ end, total }) {
  const [ms] = useState(() => Math.max(0, end - Date.now()))
  return <i className="is-run" style={{ '--ms': `${ms}ms`, '--from': Math.min(1, ms / total) }} />
}

// The deck: the cards shuffle, then the top one is pulled and turns over on the lot's player
const DECK_MS = 1500
function Deck({ kit, lot, seed }) {
  const backs = useMemo(() => seededShuffle([0, 1, 2, 3], `${seed}:deck:${lot.n}`), [lot.n, seed])
  return (
    <div className="au-deck" aria-hidden="true" style={{ '--deck': `${DECK_MS}ms` }}>
      {backs.map((k, i) => (
        <div key={k} className="au-card" style={{ '--i': i, '--s': i % 2 ? 1 : -1 }}>
          <div className="au-card-in"><CardBack /></div>
        </div>
      ))}
      <div className="au-card is-pull" style={{ '--i': backs.length, '--s': 1 }}>
        <div className="au-card-in">
          <CardBack />
          <div className="au-card-face"><LotCard kit={kit} lot={lot} /></div>
        </div>
      </div>
    </div>
  )
}
const CardBack = () => <div className="au-card-back"><span>BAP</span></div>

// The room's position, drawn from its seed (lib/auctionCore auctionPosFor): before the first card the sport's
// positions run past and land on it, big, with its name under it. About 1.5s; Reduce Motion lands at once, and so
// does a phone that comes in after it's landed. One position (soccer): it just shows
const STEPS = [60, 60, 65, 70, 80, 95, 115, 140, 175, 220]
const reduced = () => { try { return document.documentElement.classList.contains('bap-reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
function PosReveal({ sport, pos, since }) {
  const list = POS_INFO[sport] ?? []
  const target = Math.max(0, list.findIndex(o => o.pos === pos))
  const instant = list.length < 2 || since > 1200 || reduced()
  const start = ((target - STEPS.length) % list.length + list.length) % list.length || 0
  const [i, setI] = useState(instant ? target : start)
  const [landed, setLanded] = useState(instant)
  useEffect(() => {
    if (instant) return
    let k = 0, cur = start, t
    const step = () => {
      if (k >= STEPS.length) { setLanded(true); sfx('flip'); haptic('medium'); return }
      t = setTimeout(() => { cur = (cur + 1) % list.length; setI(cur); sfx('tick'); k++; step() }, STEPS[k])
    }
    step()
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const o = list[i] ?? posInfo(sport, pos)
  return (
    <div className={`au-reveal${landed ? ' is-landed' : ''}`} aria-live="polite" aria-label={landed ? `Position: ${o?.name}` : 'Drawing the position'}>
      <span className="au-lbl">{landed ? 'POSITION' : 'DRAWING THE POSITION'}</span>
      <b className="au-reveal-tag" key={landed ? 'landed' : i}>{o?.tag}</b>
      <small className="au-reveal-name">{landed && o?.name.toUpperCase() !== o?.tag ? o?.name : '\u00a0'}</small>
      {list.length > 1 && <span className="au-reveal-row" aria-hidden="true">{list.map((x, j) => <i key={x.pos} className={j === i ? 'is-on' : ''}>{x.tag}</i>)}</span>}
    </div>
  )
}

// The gavel (public/fx: the hammer and its block, cut from one picture so they line up):
// it winds back, comes down on the block, bounces, and lifts away again
function Gavel() {
  return (
    <span className="gv-swing au-hammer is-hit" aria-hidden="true">
      <img className="gv-block" src="/fx/gavel-block.webp" alt="" draggable={false} />
      <img className="gv-head" src="/fx/gavel-hammer.webp" alt="" draggable={false} />
    </span>
  )
}

export default function AppAuction({ au, posName, onHome, onPlayAgain }) {
  const { kit, match: m, st, me } = au
  const mine = me.vid
  const cheered = useRef(null)
  const [openVid, setOpenVid] = useState(null)

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
          <LinkPill link={au.link} onRetry={au.retry} room={`${{ bucket: 'BASKETBALL', soccer: 'SOCCER' }[kit.sport] ?? 'FOOTBALL'} AUCTION`} />
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
        <div className={`au-podium ag-pop${meR?.place === 1 ? ' is-win' : ''}`}>
          <span className="au-lbl">FINAL · ROOM {m.code}</span>
          <div className="au-podium-row">
            <b className="au-podium-place">{meR ? ord(meR.place) : '—'}</b>
            <span className="au-podium-who">
              <span className="au-podium-name"><NameTag name={me.name} self /></span>
              {meR && <span className="au-podium-ovr"><b>{ovr1(meR.ovr)}</b> OVR · ${meR.left} LEFT{meR.place === 1 ? ' · BEST BUILD IN THE ROOM' : ` · OF ${au.ranked.length}`}</span>}
            </span>
          </div>
          {meR && <span className="au-podium-pay gain"><XpIco /> +{xp} <span className="coin-ico coin-ico--sm" /> +{coins}</span>}
        </div>
        <div className="au-final">
          {au.ranked.map((p, i) => (
            <div key={p.vid} className={`au-final-row ag-pop${p.vid === mine ? ' is-me' : ''}${p.place === 1 ? ' is-first' : ''}`} style={{ '--d': `${120 + i * 70}ms` }}>
              <span className="au-final-rank">{p.place === 1 ? <IconTrophy size={18} /> : p.place}</span>
              <Pic p={p} me={mine} size={32} />
              <span className="au-final-who">
                <span className="au-final-name"><Name p={p} me={mine} />{p.closer && <i className="au-tag">FILLED FIRST</i>}</span>
                <span className="au-final-traits">
                  {m.types.map(t => <i key={t} className={p.slots[t].drawn ? 'is-drawn' : undefined} style={{ '--g': gradeColor(p.slots[t].val) }} title={`${kit.attrLabel(t)}: ${p.slots[t].name}${p.slots[t].drawn ? ' (the draw)' : ''}`}>{shortLabel(kit.attrLabel(t))} <b>{valToGrade(p.slots[t].val)}</b></i>)}
                </span>
              </span>
              <span className="au-final-ovr">{p.forfeit ? <b className="is-left">LEFT</b> : <><b>{ovr1(p.ovr)}</b><small>OVR · ${p.left}</small></>}</span>
            </div>
          ))}
        </div>
        {closer && <span className="au-fine"><Name p={closer} me={mine} /> filled his build first. Every other open slot went to the draw.</span>}
        <div className="cp-actions au-actions">
          <button className="ag-btn" onClick={() => { sfx('tap'); onPlayAgain() }}>PLAY AGAIN</button>
          <button className="ag-btn ag-btn--ghost" onClick={() => { au.leave(); onHome() }}>HOME</button>
        </div>
      </>
    )
  }

  const L = st.L
  const lot = st.lot
  const onBlock = st.stage === 'lot' && lot
  const myOpen = openSlots(L, mine, m.types).length
  const here = new Set(au.present.map(p => p.vid))
  const high = st.stage === 'draw' ? null : st.high

  // the paddles: every bidder in the room, his money and how much of his build is in
  // the paddles: every bidder, his money, and his build as it stands (a grade a slot, the slot on the block ringed),
  // so it's plain who still needs what. Tap another bidder for his five slots in full
  const room = (
    <div className="au-roomwrap">
      <div className="au-room" role="list" aria-label="Bidders">
        {m.players.map(p => {
          const out = L.out.includes(p.vid)
          const full = openSlots(L, p.vid, m.types).length === 0
          const tag = out ? 'LEFT' : full ? 'DONE' : onBlock && st.passed.includes(p.vid) ? 'PASS' : null
          const other = p.vid !== mine
          const Tag = other ? 'button' : 'div'
          return (
            <Tag key={p.vid} role="listitem" {...(other ? { type: 'button', 'aria-expanded': openVid === p.vid, onClick: () => { setOpenVid(v => (v === p.vid ? null : p.vid)); sfx('tap') } } : {})}
              className={`au-paddle${p.vid === mine ? ' is-me' : ''}${high?.vid === p.vid && st.stage !== 'sold' ? ' is-high' : ''}${out || (!here.has(p.vid) && p.vid !== mine) ? ' is-away' : ''}${openVid === p.vid ? ' is-open' : ''}`}>
              <span className="au-paddle-top">
                <Pic p={p} me={mine} size={22} />
                <span className="au-paddle-name"><Name p={p} me={mine} /></span>
                <b className="au-paddle-cash">${L.wallets[p.vid]}</b>
              </span>
              <span className="au-grades" aria-label="Build">
                {m.types.map(t => {
                  const w = L.won[p.vid]?.[t]
                  return <i key={t} className={`${w ? 'is-in' : ''}${onBlock && lot.trait === t ? ' is-up' : ''}`} style={w ? { '--g': gradeColor(w.val) } : undefined} title={kit.attrLabel(t)}>{w ? valToGrade(w.val) : '·'}</i>
                })}
                {tag && <em>{tag}</em>}
              </span>
            </Tag>
          )
        })}
      </div>
      {openVid && nameOf(openVid) && (
        <div className="au-peek" aria-label="His build">
          {m.types.map(t => {
            const w = L.won[openVid]?.[t]
            return (
              <span key={t} className={`au-peek-cell${w ? ' is-in' : ''}${onBlock && lot.trait === t ? ' is-up' : ''}`} style={w ? { '--g': gradeColor(w.val) } : undefined}>
                <small>{kit.attrLabel(t)}</small><b>{w ? valToGrade(w.val) : '—'}</b><i>{w ? lastName(w.name) : 'OPEN'}</i>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )

  // the build strip: the five slots, what's in them and what it cost
  const mySlots = (
    <div className="au-mine">
      <div className="au-mine-head">
        <span className="au-mine-who"><NameTag name={me.name} self /></span>
        <span className="au-mine-cash"><b>${L.wallets[mine]}</b> LEFT{myOpen ? <> · MAX BID <b>${maxBid(L, mine, m.types)}</b></> : ' · BUILD DONE'}</span>
      </div>
      <div className="au-strip">
        {m.types.map(t => {
          const w = L.won[mine]?.[t]
          const up = !w && onBlock && lot.trait === t
          return (
            <div key={t} className={`au-cell${w ? ' is-in' : ''}${w?.drawn ? ' is-drawn' : ''}${up ? ' is-up' : ''}`} style={w ? { '--g': gradeColor(w.val) } : undefined} title={w ? `${kit.attrLabel(t)}: ${w.name}` : kit.attrLabel(t)}>
              <span className="au-cell-t">{shortLabel(kit.attrLabel(t))}</span>
              <b className="au-cell-g">{w ? valToGrade(w.val) : '—'}</b>
              <span className="au-cell-n">{w ? lastName(w.name) : up ? 'UP NOW' : 'OPEN'}</span>
              <span className="au-cell-p">{w ? (w.drawn ? 'DRAW' : `$${w.price}`) : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  const top = (label) => (
    <div className="au-top">
      <span className="au-lbl">{label}</span>
      <LiveLeaveButton />
    </div>
  )

  // ── the draw: one bidder filled his build; every other bidder's open slots get a random card each. His build
  // small up top; the rest of the room's builds are the show, their bought cards face up and the draw turning over ──
  if (st.stage === 'draw' && st.draw) {
    const by = nameOf(st.draw.by)
    const face = (t, c, extra) => {
      const src = kit.photo(c.name, c.team)
      return (
        <span className="au-dcard-face">
          <small>{shortLabel(kit.attrLabel(t))}</small>
          <span className="au-dcard-pic">{src ? <img src={src} alt="" draggable={false} /> : <img className="is-logo" src={kit.crest ? kit.crest(c.name, c.team) : kit.logo(c.team)} alt="" draggable={false} />}</span>
          <b>{valToGrade(c.val)}</b>
          <i>{lastName(c.name)}</i>
          {extra}
        </span>
      )
    }
    let k = 0
    const rest = m.players.filter(p => p.vid !== st.draw.by && !L.out.includes(p.vid))
    return (
      <div className="au-floor is-draw">
        {top(`ROOM ${m.code} · THE DRAW`)}
        <div className="au-draw ag-pop">
          <div className="au-draw-top">
            <span className="au-draw-head">{by ? <Name p={by} me={mine} /> : 'A bidder'} filled his build</span>
            <span className="au-draw-chips" aria-label="His build">
              {m.types.map(t => { const w = L.won[st.draw.by]?.[t]; return <i key={t} style={{ '--g': gradeColor(w?.val ?? 0) }}>{shortLabel(kit.attrLabel(t))} <b>{w ? valToGrade(w.val) : '–'}</b></i> })}
            </span>
          </div>
          <span className="au-draw-sub">{rest.length > 1 ? 'Everyone else' : 'The rest of the room'}: every open slot gets a random card</span>
          <div className="au-draw-rows">
            {rest.map(p => {
              const got = st.draw.cards[p.vid] ?? {}
              const n = Object.keys(got).length
              return (
                <div key={p.vid} className={`au-draw-row${p.vid === mine ? ' is-me' : ''}`}>
                  <span className="au-draw-who"><Pic p={p} me={mine} size={24} /><Name p={p} me={mine} /><small>{n ? `${n} FROM THE DRAW` : 'BUILD FULL'} · ${L.wallets[p.vid]} LEFT</small></span>
                  <span className="au-draw-cards">
                    {m.types.map(t => {
                      const c = got[t]
                      const w = L.won[p.vid]?.[t]
                      if (c) {
                        const at = 700 + (k++) * DRAW_STEP_MS
                        return (
                          <span key={t} className="au-dcard is-dealt" style={{ '--at': `${at}ms`, '--g': gradeColor(c.val), '--tc': kit.teamColor(c.team, c.name) }}>
                            <span className="au-dcard-in"><span className="au-dcard-back"><span>?</span></span>{face(t, c, <em>DRAW</em>)}</span>
                          </span>
                        )
                      }
                      return w ? (
                        <span key={t} className="au-dcard is-bought" style={{ '--g': gradeColor(w.val), '--tc': kit.teamColor(w.team, w.name) }}>
                          <span className="au-dcard-in">{face(t, w, <em>${w.price}</em>)}</span>
                        </span>
                      ) : <span key={t} className="au-dcard is-empty" />
                    })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── the floor ──
  const bidEnd = lotEnd(st, m)
  const spinning = st.stage === 'lot' && au.now < st.t0 + spinOf(lot)
  const bidding = st.stage === 'lot' && !spinning
  const left = bidding ? Math.max(0, bidEnd - au.now) : 0
  const call = bidding ? callOf(left) : null
  const total = (st.last ? (m.reset ?? RESET_SECS) : m.bidSecs) * 1000
  const highP = high && nameOf(high.vid)
  const myMax = maxBid(L, mine, m.types)
  const mayBid = lot && canBidOn(L, mine, m.types, lot.trait)
  const passed = st.passed.includes(mine)
  const nextBid = minNext(high)
  // a bigger step when you want it: three over the high bid, if you can afford it
  const jumpBid = (high?.amount ?? 0) + 3 <= myMax ? (high?.amount ?? 0) + 3 : null
  const soldTo = st.sold && nameOf(st.sold.vid)
  const sold = st.stage === 'sold'
  // the grade turns over at the gavel, sold or not; a card back from the deck is already face up
  const shown = !!lot && (sold || lot.known) && lot.val != null
  const myDone = myOpen === 0
  // the cards that went back in the deck unsold, face up: what could still come back
  const state = sold ? (st.sold ? 'sold' : 'pass') : call ?? (bidding ? 'open' : 'wait')

  let act
  const note = (txt, cls = '') => <div className={`au-act au-act--note${cls}`}><span>{txt}</span></div>
  if (!lot || st.stage === 'wait') act = note(`Everyone has $${BUDGET} · ${m.types.length} slots to fill`)
  else if (sold) act = note(myDone ? 'Build done' : st.sold ? 'Next card coming up' : 'Back in the deck · next card coming up')
  else if (!mayBid) act = note(L.won[mine]?.[lot.trait] ? `${kit.attrLabel(lot.trait)} filled · watching this one` : 'Out of money for this one')
  else if (spinning) act = note(lot.known ? 'Back up, grade showing · bidding opens' : 'Bidding opens when the card turns')
  else if (high?.vid === mine) act = note(`Holding at $${high.amount}`, ' is-lead')
  else if (passed) act = note('Out on this one')
  else if (nextBid > myMax) act = note(`Can't top $${high?.amount} · max bid $${myMax}`)
  else act = (
    <div className={`au-act au-bids${jumpBid ? ' has-jump' : ''}`}>
      <button className="au-pass" onClick={() => { au.pass(); sfx('tap') }}>PASS</button>
      <button className="au-bid" onClick={() => { if (au.bid(nextBid)) { sfx('tap'); haptic('light') } }}>
        <small>{high ? 'BID' : 'OPEN AT'}</small><b>${nextBid}</b>
      </button>
      {jumpBid && (
        <button className="au-bid au-bid--jump" onClick={() => { if (au.bid(jumpBid)) { sfx('tap'); haptic('medium') } }}>
          <small>JUMP +3</small><b>${jumpBid}</b>
        </button>
      )}
    </div>
  )

  return (
    <div className={`au-floor is-${state}`} data-lot={st.n || 0}>
      {top('')}
      <div className="au-main">
        <div className={`au-block is-${state}`}>
          {lot ? (
            <div className={`au-lot${spinning && !lot.known ? ' is-pulling' : ''}`} key={lot.n} style={{ '--deck': `${DECK_MS}ms` }}>
              <div className="au-lot-card">
                <span className="au-lot-n">CARD {st.n || 1}</span>
                {spinning && !lot.known
                  ? <Deck kit={kit} lot={lot} seed={m.seed} />
                  : <div className="au-card au-card--lot"><div className="au-card-face"><LotCard kit={kit} lot={lot} /></div></div>}
                {sold && <span className={`au-stamp${st.sold ? '' : ' is-pass'}`} key={`s${st.n}`}>{st.sold ? 'SOLD' : 'NO BIDS'}</span>}
              </div>
              <div className="au-lot-info">
                {lot.known && st.stage === 'lot' && <span className="au-lbl">BACK FROM THE DECK</span>}
                <b className="au-lot-trait">{kit.attrLabel(lot.trait)}</b>
                {kit.slotTraits(lot.trait).length > 1 && <span className="au-lot-covers">{kit.slotTraits(lot.trait).join(' · ')}</span>}
                <div className="au-lot-foot">
                  <span className="au-lot-team"><img src={kit.crest ? kit.crest(lot.name, lot.team) : kit.logo(lot.team)} alt="" />{lot.team}</span>
                  <div className={`au-grade${shown ? ' is-open' : ''}${lot.known ? ' is-known' : ''}`} aria-label={shown ? `Grade ${valToGrade(lot.val)}` : 'Grade hidden'}>
                    <div className="au-grade-in">
                      <span className="au-grade-back"><small>GRADE</small>?</span>
                      {shown && <span className="au-grade-face" style={{ '--g': gradeColor(lot.val) }}><small>GRADE</small>{valToGrade(lot.val)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PosReveal sport={kit.sport} pos={m.pos} since={au.now - st.t0} />
          )}
          {(st.stage === 'lot' || sold) && (
            <div className="au-board">
              <div className="au-board-bid">
                <span className="au-lbl">{sold ? (st.sold ? 'SOLD FOR' : 'NO BIDS') : high ? 'HIGH BID' : 'OPENING BID'}</span>
                <b className={`au-amt${sold && !st.sold ? ' is-none' : ''}`}>{sold && !st.sold ? '—' : <>${sold ? <RollingNumber value={st.sold.amount} /> : high ? <RollingNumber value={high.amount} /> : 1}</>}</b>
                <span className="au-holder">{sold
                  ? (st.sold ? (soldTo ? <><Pic p={soldTo} me={mine} size={20} /><Name p={soldTo} me={mine} /></> : '—') : 'Back in the deck')
                  : highP ? <><Pic p={highP} me={mine} size={20} /><Name p={highP} me={mine} /></> : 'No bids yet'}</span>
              </div>
              <div className="au-board-clock" key={sold ? `g${st.n}` : call ?? 'clock'}>
                {sold
                  ? (st.sold ? <Gavel key={st.n} /> : null)
                  : call
                    ? <><span className="au-lbl">GOING</span><b className={`au-call is-${call}`}>{call === 'once' ? 'ONCE' : 'TWICE'}</b></>
                    : <><span className="au-lbl">CLOCK</span><b className={`au-call${bidding ? '' : ' is-idle'}`}>{bidding ? Math.ceil(left / 1000) : m.bidSecs}</b></>}
              </div>
              <div className="au-bar" style={{ '--once': `${Math.min(100, 4000 / total * 100)}%`, '--twice': `${Math.min(100, 2000 / total * 100)}%` }}>
                {bidding ? <Drain key={`${st.n}:${st.last}`} end={bidEnd} total={total} /> : <i className={sold ? 'is-out' : ''} />}
              </div>
            </div>
          )}
        </div>
        {act}
      </div>

      <div className="au-side">
        {room}
        {/* (not while the position's being drawn: its five slots would give it away) */}
        {lot || st.n > 0 ? mySlots : null}
      </div>
    </div>
  )
}
