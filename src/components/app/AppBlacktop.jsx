import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { usePresence, fmtCount } from '../../lib/presence'
import { useLiveCounts, searching } from '../../lib/liveCounts'
import { LiveLeaveButton } from './LiveLeave'
import { createPortal } from 'react-dom'
import { ROOM_SIZE as ALL_SIZE, ROLES, SLOTS as ALL_SLOTS, teamName, captainOf, EMOTES } from '../../lib/blacktop'
import { CallBar, CallReveal, EmoteBar, useBubbles, CALL_MS } from './LiveCalls'
import { BUCKET_ATTR } from '../../data/nba-attrs'
import { valToGrade } from '../../utils/simulation'
import { playDelay, offCallsFor, defCallsFor } from '../../lib/hoops'
import { QUICK, block, report } from '../../lib/chat'
import { sfx, haptic, victory } from '../../lib/juice'
import { calcBucketOVR, getBucketGuardArchetype, getBucketBigArchetype } from '../../utils/bucketSimulation'
import { VERSUS_GUARD_TYPES } from '../../data/nba-guards'
import { VERSUS_BIG_TYPES } from '../../data/nba-bigs'
import BlacktopCourt, { COURTS, useCourt, setCourtId } from './BlacktopCourt'
import { owns } from '../../lib/progress'
import { IconClose, IconArrow, IconChat, IconStar, IconSend, IconBasketball, IconVersus, IconEye, IconCheck } from './icons'
import { NameTag, AvatarBadge, Entrance } from './NameTag'
import OnlineRecord, { RatingLine, LinkPill, ModeStats, TierChip } from './OnlineRecord'
import { useProgress } from '../../lib/progress'
import { makeMimics, isTester } from '../../lib/mimic'
import { useLiveGames, useBlacktopWatch } from '../../lib/blacktopWatch'
import { RollingNumber } from './MotionText'
import { motion } from 'motion/react'
import { SPRING_LAYOUT } from '../../lib/motion'
import BlacktopSheet from './BlacktopSheet'
import './blacktop-theme.css'
import './blacktop-lobby.css'

// BLACKTOP screens. The match itself lives in lib/blacktop.js (useBlacktop);
// these only draw it: the lobby (pick a spot on a squad), the slim HUD over the
// build, team chat, and the game on the court. The menu also lists the games being
// played, and the same game screen shows one from the stands (lib/blacktopWatch.js).

const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const TEAM_COLORS = ['#4da3ff', '#ff4d5e']   // blue vs red
// A player's picture: their equipped avatar (mine live), or CPU for an auto-build
const Av = ({ name, bot, team, size = 36, cos = null, self = false }) => (bot
  ? <span className={`bt-av is-bot bt-av--t${team ?? 0}`} style={{ width: size, height: size, fontSize: size * .46 }}>CPU</span>
  : <AvatarBadge name={name} cos={cos} self={self} size={size} className={`bt-avb bt-av--t${team ?? 0}`} />
)
// A TEST fill's CPUs wear made-up players (lib/mimic.js): they show as players, not CPUs
const asBot = p => !!p.bot && !p.mimic
// ...and look like they're building: a trait every 4-7 s (each at its own pace) from the start
const fakeBuild = (p, created) => {
  const spt = 4 + ([...String(p.vid)].reduce((a, c) => a + c.charCodeAt(0), 0) % 4)
  const filled = Math.max(0, Math.min(8, Math.floor((Date.now() - (created ?? Date.now())) / 1000 / spt)))
  return { filled, done: filled >= 8 }
}
// A player's name with their look (plate: the full nameplate where there's room;
// link: a tap opens their profile, where nothing else is going on: a spectator's final)
const Who = ({ p, meVid, plate = false, short = false, link = false }) => (asBot(p)
  ? <>{short ? firstName(p.name) : p.name}</>
  : <NameTag name={short ? firstName(p.name) : p.name} cos={p.cos} uid={link ? p.uid ?? null : null} self={(p.vid ?? p.id) === meVid} plate={plate} />
)
// The winning team's star (MVP if they're on it, else their top scorer): whose
// victory everyone else sees
function starOf(game, team) {
  const side = game.teams[team] ?? []
  const mvp = side.find(p => p.id === game.mvp)
  return mvp ?? [...side].sort((a, b) => (game.stats[b.id]?.pts ?? 0) - (game.stats[a.id]?.pts ?? 0))[0] ?? null
}
// A live build's overall (partial builds count what's filled)
export const liveOvr = b => {
  if (!b?.build) return null
  const types = b.pos === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
  return types.some(t => b.build[t]) ? calcBucketOVR(b.build, types, b.pos) : null
}
// the build's own name (Untouchable Shot Creator, Rim Protector…), once it's complete
export const archOf = b => {
  if (!b?.build) return null
  const types = b.pos === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
  if (!types.every(t => b.build[t])) return null
  const a = (b.pos === 'big' ? getBucketBigArchetype : getBucketGuardArchetype)(liveOvr(b) ?? 0, b.build, types)
  return /remaining|Spin to/.test(a) ? null : a
}
// a CPU's first name, or a username whole: never cut short or capitalized (usernames show as typed)
const firstName = n => (n || '').trim().split(/\s+/)[0]
// a grade's color, rounded like its letter (valToGrade): S purple, A blue, B green, C yellow, D orange, F red
const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }

// ── Hub: the court you walk up to. Pick the game (3v3, 2v2, 1v1), then one way in ──
// 1v1's other ways in: pickup (where there's no live lobby), a friend's game, a friend's code
export function OneOnOneOptions({ onPickup, onFriend, onJoinCode, error = '' }) {
  const [code, setCode] = useState('')
  return (
    <div className="btl-opts">
      {onPickup && <button className="ag-btn btl-btn btl-go" onClick={() => { sfx('tap'); onPickup() }}>PICKUP <IconArrow size={18} /></button>}
      <button className="ag-btn btl-btn btl-btn--line" onClick={() => { sfx('tap'); onFriend() }}>PLAY A FRIEND</button>
      <form className="btl-code" onSubmit={e => { e.preventDefault(); if (code.length >= 4) onJoinCode(code) }}>
        <input value={code} maxLength={8} placeholder="GOT A FRIEND'S CODE?" aria-label="Friend's code" autoComplete="off"
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        <button className="ag-btn btl-btn btl-btn--line" type="submit" disabled={code.length < 4}>JOIN</button>
      </form>
      {error && <div className="btl-error">{error}</div>}
    </div>
  )
}

// DEV only: the lobby half's screens on made-up data (/bucket?btlobby=…: app/BlacktopLobbyLook.jsx).
// Nothing in it reaches the live server, and none of it ships.
const BT_LOBBY_LOOK = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('btlobby') : null
const LobbyLook = import.meta.env.DEV ? lazy(() => import('./BlacktopLobbyLook')) : null
if (import.meta.env.DEV && BT_LOBBY_LOOK) {
  // (the look page lives where the hub does: walk there once the app is up)
  let n = 0
  const id = setInterval(() => { if (document.querySelector('.btl-look') || ++n > 40) { clearInterval(id); return } window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'blacktop' })) }, 400)
}

export function BlacktopHub(props) {
  if (import.meta.env.DEV && BT_LOBBY_LOOK) return <Suspense fallback={null}><LobbyLook look={BT_LOBBY_LOOK} /></Suspense>
  return <HubLive {...props} />
}
// the hub's live numbers: my rating, the games on right now, who's on the Blacktop, who's searching
function HubLive(props) {
  const o = useProgress().stats?.online ?? { rating: 800 }
  // the games being played right now (only with the live server)
  const live = useLiveGames(!!props.onWatch)
  const onCourt = usePresence()?.areas?.blacktop ?? 0   // players on the Blacktop right now
  // the spots taken in each lobby right now (lib/liveCounts.js): nothing until the server says
  const waiting = useLiveCounts(true)
  return <BlacktopHubView {...props} rating={o.rating} live={live} onCourt={onCourt} waiting={waiting} />
}
// the games, biggest first: who's on a side, and who a practice game is played with
const HUB_MODES = [
  { size: 3, line: '2 GUARDS · 1 BIG', cpus: 'WITH 5 CPUS' },
  { size: 2, line: '1 GUARD · 1 BIG', cpus: 'WITH 3 CPUS' },
  { size: 1, line: 'GUARD OR BIG', cpus: 'VS 1 CPU' },
]
const HUB_MODE_KEY = 'bap_bt_mode'   // the game picked last time (this browser only)
export function BlacktopHubView({ onJoin3v3, onJoin2v2 = null, onJoin1v1 = null, onPickup, onFriend, onJoinCode, onBack, notice = null, onNotice = null, onPractice = null, onWatch = null, rating = 800, live = {}, onCourt = 0, waiting = null }) {
  const court = useCourt()
  const join = { 3: onJoin3v3, 2: onJoin2v2, 1: onJoin1v1 }
  const modes = HUB_MODES.filter(m => m.size !== 2 || onJoin2v2)
  const [size, setSize] = useState(() => { let s = 3; try { s = Number(localStorage.getItem(HUB_MODE_KEY)) || 3 } catch {} return modes.some(m => m.size === s) ? s : 3 })
  const pick = s => { if (s === size) return; setSize(s); sfx('tap'); try { localStorage.setItem(HUB_MODE_KEY, String(s)) } catch {} }
  const mode = modes.find(m => m.size === size) ?? modes[0]
  const go = join[mode.size]
  return (
    <div className="ag-screen ag-screen--bucket bt-hub btl btl-hub">
      <header className="btl-stage">
        <div className="btl-stage-floor" aria-hidden="true"><img src={court.src} alt="" draggable={false} /></div>
        <div className="btl-stage-in">
          <div className="btl-stage-top">
            <span className="btl-eyebrow">ONLINE · FIRST TO 11</span>
            <button className="ag-round-btn btl-x" onClick={onBack} aria-label="Home"><IconClose size={16} /></button>
          </div>
          <h1 className="btl-title">Blacktop</h1>
          <div className="btl-stage-foot">
            {onCourt > 0 && <span className="btl-onair"><i className="btl-dot ip-fx" aria-hidden="true" /><b>{fmtCount(onCourt)}</b>PLAYING</span>}
            <button className="btl-rating" onClick={() => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'online' }))}>
              <small>ONLINE RATING</small><TierChip rating={rating} /><b>{rating}</b><IconArrow size={13} />
            </button>
          </div>
        </div>
      </header>
      <div className="btl-body btl-hub-body">
        {notice && <button className="btl-notice" onClick={onNotice}><span>{notice}</span><small>TAP TO DISMISS</small><IconClose size={14} /></button>}
        <div className="btl-hub-main">
          <div className="btl-modes" role="radiogroup" aria-label="Game">
            {modes.map(m => {
              const on = m.size === mode.size
              // the spots taken in that lobby right now (1v1's lobby is only on the live server)
              const n = m.size === 1 && !onJoin1v1 ? null : searching(waiting, `bt:${m.size}`)
              return (
                <button key={m.size} role="radio" aria-checked={on} className={`btl-mode${on ? ' is-on' : ''}`} onClick={() => pick(m.size)}>
                  {on && <motion.span layoutId="btl-mode-lit" className="btl-mode-lit" transition={SPRING_LAYOUT} aria-hidden="true" />}
                  <b className="btl-mode-tag">{m.size}V{m.size}</b>
                  <span className="btl-mode-txt">
                    <span className="btl-mode-line">{m.line}</span>
                    {n ? <span className="btl-mode-n"><i className="btl-dot" aria-hidden="true" />{n} SEARCHING</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="btl-acts">
            {go && <button className="ag-btn btl-btn btl-go" onClick={() => { sfx('tap'); go() }}>JOIN {mode.size}V{mode.size} LOBBY <IconArrow size={18} /></button>}
            {go && onPractice && <button className="ag-btn btl-btn btl-btn--line" onClick={() => { sfx('tap'); onPractice(mode.size) }}>PRACTICE · {mode.cpus}</button>}
            {mode.size === 1 && <OneOnOneOptions onPickup={go ? undefined : onPickup} onFriend={onFriend} onJoinCode={onJoinCode} />}
          </div>
          <div className="btl-record"><ModeStats mode={mode.size === 3 ? 'bt' : mode.size === 2 ? 'bt2' : onJoin1v1 ? 'bt1' : 'h2hB'} /></div>
        </div>
        <div className="btl-hub-side">
          <LiveGames live={live} onWatch={onWatch} />
          <CourtPicker />
          <details className="btl-rules">
            <summary>HOUSE RULES</summary>
            <ol>
              <li><span>Real players only. A 1v1 starts when both spots are taken, a 2v2 when all four are, a 3v3 when all six are. Practice puts you against CPUs right away.</span></li>
              <li><span>In a 1v1 you take your spot as a guard or a big. A 2v2 squad is a guard and a big; a 3v3 squad is two guards and a big. The spot you take is the build you make.</span></li>
              <li><span>3:00 to build. Leave or go quiet and the blacktop builds for you, with the ratings off.</span></li>
              <li><span>First to <b>11</b>, 1s and 2s, win by 2. Make it, take it.</span></li>
              <li><span>Chat is filtered, and anyone can be reported.</span></li>
            </ol>
          </details>
        </div>
      </div>
    </div>
  )
}

// The court your games are played on: the ones you own (each one's own picture), the rest in the shop
function CourtPicker() {
  const court = useCourt()
  const mine = COURTS.filter(c => owns(c.id))
  return (
    <section className="btl-courts">
      <div className="btl-sec">
        <span className="btl-sec-title">COURT</span>
        <button className="btl-link" onClick={() => { sfx('tap'); window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'shop:court' })) }}>{COURTS.length - mine.length} MORE IN THE SHOP <IconArrow size={12} /></button>
      </div>
      <div className="btl-courts-row" role="radiogroup" aria-label="Court">
        {mine.map(c => (
          <button key={c.id} role="radio" aria-checked={court.id === c.id} className={`btl-court${court.id === c.id ? ' is-on' : ''}`} onClick={() => { setCourtId(c.id); sfx('tap') }}>
            <img src={c.thumb} alt="" loading="lazy" draggable={false} />
            <span className="btl-court-name">{c.name.toUpperCase()}{court.id === c.id && <i>ON</i>}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ── Live now: every game on the Blacktop, most watched first; WATCH is a seat in the stands ──
const SHOW_LIVE = 3
function LiveGames({ live, onWatch }) {
  const [all, setAll] = useState(false)
  const [now, setNow] = useState(Date.now())
  const list = useMemo(() => [3, 2, 1].flatMap(s => live?.[s] ?? []).sort((a, b) => (b.watchers ?? 0) - (a.watchers ?? 0) || b.started - a.started), [live])
  const on = !!onWatch && list.length > 0
  useEffect(() => { if (!on) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [on])
  if (!on) return null
  const shown = all ? list : list.slice(0, SHOW_LIVE)
  return (
    <section className="btl-liveboard" role="list" aria-label="Live games">
      <div className="btl-sec"><span className="btl-sec-title"><i className="btl-dot btl-dot--live ip-fx" aria-hidden="true" />LIVE NOW</span><b>{list.length}</b></div>
      {shown.map(g => <LiveRow key={g.code} g={g} now={now} onWatch={onWatch} />)}
      {list.length > SHOW_LIVE && <button className="btl-more" onClick={() => { sfx('tap'); setAll(v => !v) }}>{all ? 'SHOW FEWER' : `${list.length - SHOW_LIVE} MORE LIVE`}</button>}
    </section>
  )
}
// One game, like a score in a ticker: a side a line (its players, its score as of the last
// check-up), then the game it is, how long it's been on, who's watching, and WATCH
function LiveRow({ g, now, onWatch }) {
  const score = g.score ?? [0, 0]
  const on = t => g.players.filter(p => p.team === t)
  const said = t => on(t).map(p => (p.cpu ? 'CPU' : p.name)).join(', ')
  const side = t => (
    <span className={`btl-game-side bt-t${t}${score[t] > score[1 - t] ? ' is-lead' : ''}`}>
      <span className="btl-game-names">{on(t).map((p, i) => <span key={i} className="btl-game-name">{p.cpu ? 'CPU' : <NameTag name={p.name} cos={p.cos} uid={p.uid} plate={false} />}</span>)}</span>
      <b>{score[t]}</b>
    </span>
  )
  return (
    <div className="btl-game" role="listitem">
      <span className="btl-game-sides">{side(0)}{side(1)}</span>
      <span className="btl-game-meta">
        <span className="btl-game-info"><b>{g.size}V{g.size}</b>{fmt(Math.max(0, Math.floor((now - g.started) / 1000)))}{g.watchers > 0 && <span className="btl-game-eyes"><IconEye size={11} />{g.watchers}</span>}</span>
        <button className="btl-watch" onClick={() => { sfx('tap'); onWatch(g) }} aria-label={`Watch ${said(0)} against ${said(1)}`}>WATCH</button>
      </span>
    </div>
  )
}

// ── Lobby: a matchup board filling up. Two squads facing each other, tap an open spot ──
export function BlacktopQueue({ bt, user, onBack }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [seenChat, setSeenChat] = useState(0)
  const SLOTS = bt.slots ?? ALL_SLOTS
  const ROOM_SIZE = bt.roomSize ?? ALL_SIZE
  const size = bt.size ?? 3
  // TEST: made-up players (lib/mimic.js) take the open spots one by one, as if a real
  // lobby were filling, then the run starts: a practice game whose CPUs wear them
  const tester = isTester(user)
  const [fill, setFill] = useState({})            // slot id → a made-up player shown there
  const filling = useRef(false)
  const heldAt = id => bt.held[id] ?? fill[id]
  const testFill = () => {
    if (filling.current || !bt.testFill) return
    filling.current = true; sfx('tap')
    // the server seats you in the first team-A spot for your position and dresses the
    // rest in order: fill the same spots, in the same order, so the names match
    const mine = SLOTS.find(sl => sl.team === 0 && (sl.pos === (bt.me.pos === 'big' ? 'big' : 'guard') || sl.pos === 'any'))
    const others = SLOTS.filter(sl => sl !== mine)
    const people = makeMimics(others.length)
    let wait = 350
    others.forEach((sl, k) => {
      if (bt.held[sl.id]) return               // someone (you) already holds it: leave it showing
      wait += 420 + Math.round(Math.random() * 380)
      setTimeout(() => { setFill(f => ({ ...f, [sl.id]: { vid: `test-${sl.id}`, ...people[k], pos: sl.pos === 'any' ? 'guard' : sl.pos } })); sfx('slot'); haptic('light') }, wait)
    })
    setTimeout(() => bt.testFill(size, people), wait + 700)
  }
  const squadName = t => {
    const first = SLOTS.filter(sl => sl.team === t).map(sl => heldAt(sl.id)).find(Boolean)
    return first ? `TEAM ${firstName(first.name)}` : t === 0 ? 'TEAM A' : 'TEAM B'
  }
  const tap = (sl, pos = null) => {
    const h = bt.held[sl.id]
    if (h && h.vid !== bt.me.vid) { sfx('deny'); haptic('light'); return }
    if (bt.mySlot === sl.id && !pos) { bt.seat(null); sfx('tap'); return }
    bt.seat(sl.id, pos); sfx('slot'); haptic('medium')
  }
  const waiting = bt.queue.filter(p => !p.slot || bt.held[p.slot]?.vid !== p.vid).length
  const unread = Math.max(0, bt.chat.length - seenChat)
  const taken = Math.min(ROOM_SIZE, bt.seated + Object.keys(fill).length)
  const full = bt.seated === ROOM_SIZE
  const last = bt.chat[bt.chat.length - 1]
  return (
    <div className="ag-screen ag-screen--bucket bt-lobby btl btl-lobby">
      <header className="btl-top">
        <div className="btl-top-txt">
          <span className="btl-eyebrow">BLACKTOP · FIRST TO 11</span>
          <h1 className="btl-h1">{size}v{size} lobby</h1>
        </div>
        <button className="ag-round-btn btl-x" onClick={() => { (bt.leaveLobby ?? bt.leave)(); onBack() }} aria-label="Leave the lobby"><IconClose size={16} /></button>
      </header>
      <div className="btl-body">
        <section className={`btl-board${full ? ' is-full' : ''}`}>
          <div className="btl-board-lines" aria-hidden="true" />
          <div className="btl-board-head">
            <span className="btl-count"><b>{taken}</b><i>/{ROOM_SIZE}</i><small>SPOTS<br />TAKEN</small></span>
            {/* a pip a spot: the left side's, then the right side's */}
            <span className="btl-pips" aria-hidden="true">
              {[0, 1].flatMap(t => [
                ...(t === 1 ? [<i key="gap" className="is-gap" />] : []),
                ...SLOTS.filter(sl => sl.team === t).map(sl => <i key={sl.id} className={`bt-t${t}${heldAt(sl.id) ? ' is-on' : ''}`} />),
              ])}
            </span>
            <span className="btl-board-meta"><span className="btl-timer">{fmt(bt.waited)}</span>{bt.link === 'live' && <LinkPill link={bt.link} onRetry={bt.retry} />}</span>
          </div>
          {/* off the live server (or still connecting): said on its own line, with the way to retry */}
          {bt.link !== 'live' && <div className="btl-linkrow"><LinkPill link={bt.link} onRetry={bt.retry} /></div>}
          <div className="btl-teams">
            {[0, 1].map(t => (
              <div key={t} className={`btl-team bt-t${t}${SLOTS.some(sl => sl.team === t && bt.mySlot === sl.id) ? ' is-mine' : ''}`}>
                <span className="btl-team-name">{squadName(t)}</span>
                {SLOTS.filter(sl => sl.team === t).map(sl => {
                  const h = heldAt(sl.id)
                  const me = h?.vid === bt.me.vid
                  // a 1v1 spot: open, you take it as a guard or a big
                  if (sl.pos === 'any' && !h) return (
                    <div key={sl.id} className="btl-seat is-open btl-seat--pick">
                      <button className="btl-seat-half" onClick={() => tap(sl, 'guard')}><span className="btl-seat-plus">+</span><span className="btl-seat-txt"><span className="btl-seat-name">GUARD</span><span className="btl-seat-role">PG · SG · SF</span></span></button>
                      <button className="btl-seat-half is-big" onClick={() => tap(sl, 'big')}><span className="btl-seat-plus">+</span><span className="btl-seat-txt"><span className="btl-seat-name">BIG</span><span className="btl-seat-role">PF · C</span></span></button>
                    </div>
                  )
                  const pos = sl.pos === 'any' ? h?.pos : sl.pos
                  const role = pos === 'big' ? 'BIG' : 'GUARD'
                  // (keyed by who's on it: a new player's plate drops in, and their entrance plays)
                  return (
                    <button key={`${sl.id}:${h?.vid ?? ''}`} className={`btl-seat ent-host${h ? ' is-taken' : ' is-open'}${me ? ' is-me' : ''}${pos === 'big' ? ' is-big' : ''}`} onClick={() => tap(sl)}>
                      {h && <Entrance key={h.vid} cos={h.cos} />}
                      {h ? <Av name={h.name} team={t} size={40} cos={h.cos} self={me} /> : <span className="btl-seat-plus">+</span>}
                      {h && <i className="btl-seat-in" aria-hidden="true" />}
                      <span className="btl-seat-txt">
                        <span className="btl-seat-name">{h ? <NameTag name={h.name} cos={h.cos} uid={h.uid ?? null} self={me} /> : `JOIN AS ${role}`}</span>
                        <span className="btl-seat-role">{h ? role : pos === 'big' ? 'PF · C' : 'PG · SG · SF'}{me && <em>TAP TO LEAVE</em>}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            <span className="btl-vs" aria-hidden="true">VS</span>
          </div>
          {bt.bumped && <div className="btl-bumped">Someone grabbed that spot first. Pick another.</div>}
          {tester && <button className="ag-btn btl-btn btl-test" onClick={testFill} disabled={filling.current}>TEST · FILL WITH PLAYERS</button>}
          <div className="btl-board-foot" role="status">
            {!bt.mySlot
              ? <span className="btl-hint"><b>TAKE AN OPEN SPOT</b>{waiting > 0 && <small>{waiting} WATCHING</small>}</span>
              : full
                ? <span className="btl-tip"><b>TIP-OFF</b><small>LACING UP…</small></span>
                : <span className="btl-hint"><b>{ROOM_SIZE - bt.seated} TO GO</b><small>STARTS AT {ROOM_SIZE}/{ROOM_SIZE} · REAL PLAYERS ONLY</small></span>}
          </div>
        </section>

        <button className="btl-chatbar" onClick={() => { setChatOpen(true); setSeenChat(bt.chat.length) }}>
          <IconChat size={18} />
          <span className="btl-chatbar-txt">{last ? <><b><NameTag name={last.name} self={last.from === bt.me.vid} cos={last.cos || null} plate={false} />:</b> {last.text}</> : 'LOBBY CHAT'}</span>
          {unread > 0 ? <span className="ag-tab-badge">{unread}</span> : <span className="btl-chatbar-open">OPEN</span>}
        </button>

        <OnlineRecord modes={[size === 1 ? 'bt1' : size === 2 ? 'bt2' : 'bt']} title={`${size}V${size} RECORD`} />

      </div>
      {chatOpen && <BlacktopChat bt={bt} user={user} title="LOBBY CHAT" mode="blacktop-lobby" onClose={() => { setChatOpen(false); setSeenChat(bt.chat.length) }} />}
    </div>
  )
}

// ── HUD over the build: one slim bar, tap to open the squads ────────────────
export function BlacktopHud({ bt, onOpenChat, unread, devOpen = false }) {
  const [open, setOpen] = useState(import.meta.env.DEV && devOpen)
  const squads = [0, 1].map(t => bt.match.players.filter(p => p.team === t))
  const ready = t => squads[t].filter(p => p.bot || bt.builds[p.vid]?.done).length
  const urgent = bt.clock <= 20
  return (
    <div className={`bt-hud has-leave${urgent ? ' is-urgent' : ''}${open ? ' is-open' : ''}`}>
      <button className="bt-hud-bar" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="bt-hud-clock">{fmt(bt.clock)}</span>
        <span className="bt-hud-mini">
          <span className="bt-t0"><b>{teamName(bt.match, 0).replace(/^TEAM /, '')}</b> {ready(0)}/{bt.size ?? 3}</span>
          <i>vs</i>
          <span className="bt-t1"><b>{teamName(bt.match, 1).replace(/^TEAM /, '')}</b> {ready(1)}/{bt.size ?? 3}</span>
        </span>
        <span className={`bt-hud-caret${open ? ' is-open' : ''}`}>▾</span>
      </button>
      <button className="bt-hud-chat" onClick={onOpenChat} aria-label="Team chat"><IconChat size={18} />{unread > 0 && <span className="ag-tab-badge">{unread}</span>}</button>
      <LiveLeaveButton />
      {open && (
        <div className="bt-hud-panel">
          <div className="bt-hud-teams">
            {squads.map((sq, t) => (
              <div key={t} className={`bt-hud-team bt-t${t}${t === bt.myTeam ? ' is-mine' : ''}`}>
                <span className="bt-hud-team-name">{teamName(bt.match, t)}</span>
                {sq.map(p => {
                  const b = bt.builds[p.vid] ?? (p.mimic ? fakeBuild(p, bt.match?.created) : undefined)
                  const here = p.bot || bt.present.some(q => q.vid === p.vid)
                  const ovr = t === bt.myTeam ? liveOvr(b) : null
                  return (
                    <span key={p.vid} className={`bt-hud-p${!here ? ' is-gone' : ''}${b?.done ? ' is-done' : ''}`} title={p.name}>
                      <Av name={p.name} bot={asBot(p)} team={t} size={24} cos={p.cos} self={p.vid === bt.me.vid} />
                      <span className="bt-hud-p-name"><Who p={p} meVid={bt.me.vid} /> <small>{p.pos === 'big' ? 'BIG' : 'G'}</small></span>
                      <span className="bt-hud-p-bar"><span style={{ width: `${Math.min(100, ((b?.filled ?? 0) / 8) * 100)}%` }} /></span>
                      <span className="bt-hud-p-n">{asBot(p) ? 'CPU' : !here ? 'AFK' : ovr != null ? <><b>{ovr}</b> OVR</> : b?.done ? <IconCheck size={13} /> : `${b?.filled ?? 0}/8`}</span>
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="bt-roles">
            <span className="bt-roles-lbl">MY ROLE</span>
            {ROLES.map(r => <button key={r.id} className={`ag-chip${bt.role === r.id ? ' is-on' : ''}`} onClick={() => bt.setRole(r.id)} title={r.sub}>{r.name}</button>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chat: a sheet off the bottom edge (BlacktopSheet); messages, typing, your squad's overalls ──
export function BlacktopChat({ bt, user, onClose, mode = 'blacktop', title = 'TEAM CHAT' }) {
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(null)      // message with the report/block menu open
  const [note, setNote] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    const el = listRef.current; if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [bt.chat.length])
  // the chat rules, agreed to once before the first message
  const [rulesOk, setRulesOk] = useState(() => { try { return localStorage.getItem('bap_chat_rules') === '1' } catch { return false } })
  const agree = () => { try { localStorage.setItem('bap_chat_rules', '1') } catch {} setRulesOk(true); setTimeout(() => inputRef.current?.focus(), 50) }
  const send = t => {
    if (bt.sendChat(t)) { setText(''); sfx('send'); haptic('light'); inputRef.current?.focus() }
    else if (t.trim()) { sfx('deny') }
  }
  const act = async kind => {
    const m = menu; setMenu(null)
    if (!m) return
    if (kind === 'block') { block(m.uid); setNote(`${m.name} blocked. You won't see their messages.`) }
    else { const ok = await report({ room: bt.match?.code ?? 'lobby', mode, offender: { name: m.name, uid: m.uid, vid: m.from }, text: m.text, user }); setNote(ok ? 'Reported. Thanks, we review every report.' : 'Could not send the report. Try again.') }
    setTimeout(() => setNote(''), 3000)
  }
  const squad = bt.match && bt.builds ? bt.match.players.filter(p => p.team === bt.myTeam) : null
  const typers = bt.typers ?? []
  return (
    <BlacktopSheet label={title} title={title} onClose={onClose} corner className="btl-sheet--chat">
      {squad && (
        <div className={`btl-squadstrip bt-t${bt.myTeam ?? 0}`}>
          {squad.map(p => {
            const ovr = liveOvr(bt.builds[p.vid])
            return (
              <span key={p.vid} className={`btl-sq${p.vid === bt.me.vid ? ' is-me' : ''}`}>
                <Av name={p.name} bot={asBot(p)} team={bt.myTeam} size={28} cos={p.cos} self={p.vid === bt.me.vid} />
                <span className="btl-sq-txt"><b><Who p={p} meVid={bt.me.vid} short /></b><small>{p.pos === 'big' ? 'BIG' : 'GUARD'}<i className="btl-sq-ovr">{asBot(p) ? 'CPU' : ovr != null ? `${ovr} OVR` : '–'}</i></small></span>
              </span>
            )
          })}
        </div>
      )}
      <div className="btl-chat-list" ref={listRef}>
        {bt.chat.length === 0 && <div className="btl-chat-empty"><IconChat size={24} /><span>{mode === 'blacktop-lobby' ? 'SAY WHAT\'S UP TO THE LOBBY' : 'SAY WHAT\'S UP TO YOUR SQUAD'}</span></div>}
        {bt.chat.map((m, i) => {
          const mine = m.from === bt.me.vid
          const prev = bt.chat[i - 1]
          const grouped = prev && prev.from === m.from && m.ts - prev.ts < 60000
          return (
            <div key={m.id} className={`btl-msg${mine ? ' is-me' : ''}${grouped ? ' is-grouped' : ''}`} onContextMenu={e => { e.preventDefault(); if (!mine) setMenu(m) }}>
              {!grouped && !mine && <span className="btl-msg-name" onClick={() => setMenu(m)}><NameTag name={m.name} cos={m.cos} />{m.all && mode !== 'blacktop-lobby' && <i> · ALL</i>}</span>}
              <span className="btl-msg-text">{m.text}</span>
            </div>
          )
        })}
        {typers.length > 0 && <div className="btl-typing"><span className="btl-dots"><i /><i /><i /></span>{typers.slice(0, 2).join(', ')} {typers.length > 1 ? 'are' : 'is'} typing</div>}
      </div>
      {note && <div className="btl-chat-note">{note}</div>}
      {menu && (
        <div className="btl-msg-menu">
          <span><NameTag name={menu.name} cos={menu.cos || null} uid={menu.uid || null} /></span>
          <button className="is-warn" onClick={() => act('report')}>REPORT</button>
          <button className="is-warn" onClick={() => act('block')}>BLOCK</button>
          <button onClick={() => setMenu(null)}>CANCEL</button>
        </div>
      )}
      {/* guests chat too (as "Guest"); the filter, report and block cover everyone */}
      {!rulesOk ? (
        <div className="btl-chatrules" role="region" aria-label="Chat rules">
          <b>BEFORE YOU CHAT</b>
          <ul>
            <li>Keep it about the game. No hate, bullying or threats.</li>
            <li>Never share your real name, school, address, phone or socials.</li>
            <li>No links. Messages are filtered.</li>
            <li>Press and hold (or right-click) a message to report or block someone.</li>
          </ul>
          <p>Breaking the rules gets you muted or banned. <a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('bap:menu'))}>Contact us</button></p>
          <button className="ag-btn ag-cta btl-btn" onClick={agree}>I AGREE · LET ME CHAT</button>
        </div>
      ) : <>
        <div className="btl-quick">{QUICK.map(q => <button key={q} className="ag-chip" onClick={() => send(q)}>{q}</button>)}</div>
        <form className="btl-chat-form" onSubmit={e => { e.preventDefault(); send(text) }}>
          <input ref={inputRef} value={text} onChange={e => { setText(e.target.value); bt.typing?.() }} maxLength={120} placeholder={mode === 'blacktop-lobby' ? 'Message the lobby…' : 'Message your squad…'} enterKeyHint="send" autoComplete="off" />
          <button className="btl-send" type="submit" disabled={!text.trim()} aria-label="Send"><IconSend size={20} /></button>
        </form>
      </>}
    </BlacktopSheet>
  )
}

// Every player's build in the game, grade by grade, with the points they have so far: on the game screen
// itself, under the play-by-play (line: { [id]: { pts, run } }, as of what's been shown)
function SquadBuilds({ game, names, meVid, line = null }) {
  return (
    <div className="btg-builds" role="region" aria-label="Builds">
      <div className="btg-builds-head">THE BUILDS</div>
      {[0, 1].map(t => (
        <div key={t} className={`bt-t${t}`}>
          <div className="btg-builds-team">{names[t]}</div>
          {game.teams[t].map(p => {
            const types = p.pos === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
            const ovr = liveOvr(p)
            const arch = archOf(p)
            const s = line?.[p.id]
            return (
              <div key={p.id} className={`btg-builds-p${p.id === meVid ? ' is-me' : ''}`}>
                <span className="btg-builds-who">
                  <span className="btg-builds-id"><b>{asBot(p) ? p.name : <NameTag name={p.name} cos={p.cos} self={p.id === meVid} />}</b><small>{arch && <><em>{arch}</em> · </>}{p.pos === 'big' ? 'BIG' : 'GUARD'}</small></span>
                  {line && <span className={`btg-builds-n${(s?.run ?? 0) >= 2 ? ' is-hot' : ''}`}>{s?.pts ?? 0}<small>PTS</small></span>}
                  <span className="btg-builds-n is-ovr">{ovr ?? '–'}<small>OVR</small></span>
                </span>
                {/* each trait's grade in its color, so a build reads at a glance */}
                <span className="btg-builds-grades">
                  {types.map(k => { const val = p.build?.[k]?.val; return <i key={k} title={BUCKET_ATTR[k]?.label} className={val != null ? 'is-g' : ''} style={val != null ? { '--g': gradeColor(val) } : undefined}><small>{BUCKET_ATTR[k]?.shortLabel ?? k.slice(0, 3)}</small>{val != null ? valToGrade(val) : '–'}</i> })}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Watching from the menu: the stands' bar, and the game itself ────────────
// (a spectator plays from the same component as the players, with no seat: bt.watch)
const WATCH_STATE = { joining: 'FINDING A SEAT…', full: 'STANDS FULL', gone: 'NOT LIVE', ended: 'FEED ENDED' }
function WatchBar({ bt }) {
  return (
    <div className="btg-watchbar">
      <span className="btg-watchbar-tag"><i aria-hidden="true" />SPECTATING</span>
      <span className="btg-watchbar-n">{bt.state !== 'live' ? WATCH_STATE[bt.state] ?? '' : bt.link === 'live' ? <><IconEye size={14} />{Math.max(1, bt.watchers ?? 1)} WATCHING</> : 'RECONNECTING…'}</span>
      <button className="ag-round-btn btg-x" onClick={() => { sfx('tap'); bt.exit() }} aria-label="Stop watching"><IconClose size={16} /></button>
    </div>
  )
}
export function BlacktopWatch({ code, pools, types, onClose }) {
  const w = useBlacktopWatch({ code, pools, types })
  const bt = { ...w, exit: onClose }
  if (w.game) return <BlacktopGame bt={bt} onOpenChat={null} unread={0} />
  const why = w.state === 'joining' ? null : w.state === 'full' ? 'The stands are full for this one. Try another game.' : 'This game is over, or it can\'t be watched right now.'
  return (
    <div className="ag-screen ag-screen--bucket bt-game btg btg-wait">
      <WatchBar bt={bt} />
      {why && <div className="btg-watch-none">{why}<button className="ag-btn btl-btn btl-btn--line" onClick={onClose}>BACK TO BLACKTOP</button></div>}
    </div>
  )
}

// ── Game: reveal → live → result ────────────────────────────────────────────
// what the lower third calls a play (the play-by-play line says the rest)
const playTag = p => (p.type === 'score' ? `+${p.pts}` : p.type === 'miss' ? 'MISS' : p.type === 'block' ? 'BLOCK' : p.type === 'steal' ? 'STEAL'
  : p.type === 'oreb' || p.type === 'dreb' ? 'REBOUND' : p.type === 'milestone' ? `${p.score[0]}-${p.score[1]}` : '')
export function BlacktopGame({ bt, user, photoFor, onOpenChat, unread }) {
  const { game, match } = bt
  // watching (the menu's live games): no seat, so no calls, no reactions, no record;
  // joined after the tip-off, it picks up on the last possession called (bt.startAt)
  const watch = !!bt.watch
  // (DEV: the look page starts on a play or on the final: app/BlacktopLook.jsx)
  const joined = watch ? bt.startAt : import.meta.env.DEV ? bt.devStart ?? null : null
  const [stage, setStage] = useState((import.meta.env.DEV && bt.devStage) || (joined != null ? 'live' : 'reveal'))
  const [idx, setIdx] = useState(joined ?? 0)
  const speed = 0.85                         // online: everyone sees it at the same pace (a touch slower than real time, so the moves are easy to follow)
  const fired = useRef(false)
  const plays = game?.plays ?? []
  const play = plays[idx]
  // a play's line in the feed (and its points on the board) show once it happens on the
  // court, not as it starts: the court reports it (onReveal); a timer near the end of the
  // play is the backstop. Everything before the current play is out already.
  const [shown, setShown] = useState((joined ?? 0) - 1)
  useEffect(() => {
    if (!play) return
    const t = setTimeout(() => setShown(s => Math.max(s, idx)), (playDelay(play, idx === 0) * 0.85) / speed)
    return () => clearTimeout(t)
  }, [idx]) // eslint-disable-line
  const onReveal = id => { const i = plays.findIndex(p => p.id === id); if (i >= 0) setShown(s => Math.max(s, i)) }
  const outTo = shown >= idx ? idx : idx - 1
  const mine = match.players.find(p => p.vid === bt.me.vid)
  const myTeam = watch ? -1 : mine?.team ?? 0
  const colorFor = t => TEAM_COLORS[t]
  const names = useMemo(() => [teamName(match, 0), teamName(match, 1)], [match])

  useEffect(() => { const t = setTimeout(() => setStage(s => (s === 'reveal' ? 'live' : s)), 4200); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (stage !== 'live' || !game) return
    if (idx >= plays.length - 1) {
      if (!fired.current) {
        fired.current = true
        const won = game.winner === myTeam
        // the winners see their own victory; everyone else sees the winning star's
        const star = starOf(game, game.winner)
        setTimeout(() => { if (won) victory(); else victory({ of: star?.cos ?? {} }); setStage('result'); bt.finish() }, 2200)
      }
      return
    }
    // a check-up waits for the calls (the leader locks them; anyone else falls back to what they have)
    if (play?.type === 'check' && !bt.locks?.[play.pn]) {
      // on the server: say I'm here (and the score as of now), and the server's lock moves us on
      // (watching: just wait for it)
      if (bt.server) { bt.arrive(play.pn, play.team, play.score); return }
      const t = setTimeout(() => bt.lockCalls(play.pn, bt.isLeader), bt.isLeader ? CALL_MS + 150 : CALL_MS + 2600)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setIdx(i => i + 1), (play?.type === 'check' ? 450 : playDelay(play, idx === 0)) / speed)
    return () => clearTimeout(t)
  }, [stage, idx, speed, game, plays.length, play?.type === 'check' && !!bt.locks?.[play?.pn]]) // eslint-disable-line
  useEffect(() => {
    if (!play) return
    // the make itself is heard on the court (BlacktopCourt); here just the buzz for your side
    if (play.type === 'score') { setTimeout(() => { if (play.team === myTeam) haptic('light') }, 900) }
    else if (play.type === 'block' || play.type === 'steal') setTimeout(() => sfx('pop'), 700)
  }, [idx]) // eslint-disable-line
  const bubbles = useBubbles(bt.emotes ?? [])
  const pipFrom = useRef(null)               // the score when the board first showed (ticks lit after that light up)
  if (!game) return null

  // this possession's calls: the open check-up, and what was called on the one being played
  const calling = stage === 'live' && play?.type === 'check' && !bt.locks?.[play.pn] ? play : null
  const lastCheck = [...plays.slice(0, idx + 1)].reverse().find(p => p.type === 'check')
  const locked = lastCheck ? bt.locks?.[lastCheck.pn] : null
  const score = plays[outTo]?.score ?? [0, 0]
  const feed = plays.slice(0, outTo + 1).filter(p => p.type !== 'check').slice(-8).reverse()
  const squads = [0, 1].map(t => game.teams[t])
  // only the calls that fit this game: a 1v1 has no pass and no help (a CPU's call included)
  const size = game.teams[watch ? 0 : myTeam]?.length ?? 1
  const fitOff = v => (typeof v === 'string' && v.startsWith('pass:') ? (size > 1 ? v : null) : offCallsFor(size).includes(v) ? v : null)
  const fitDef = v => (defCallsFor(size).includes(v) ? v : null)

  if (stage === 'reveal') {
    return (
      <div className="ag-screen ag-screen--bucket bt-game btg btg-reveal">
        {watch && <WatchBar bt={bt} />}
        <div className="btg-rv">
          <div className="btg-rv-top"><b>BLACKTOP · FIRST TO 11</b><span>{size}V{size}</span></div>
          <div className="btg-rv-grid">
            {squads.map((sq, t) => (
              <div key={t} className={`btg-rv-team bt-t${t}`}>
                <div className="btg-rv-head"><span className="btg-rv-name">{names[t]}</span></div>
                {sq.map((p, i) => (
                  <div key={p.id} className="btg-rv-p" style={{ '--i': i }}>
                    <Av name={p.name} bot={asBot(p)} team={t} size={40} cos={p.cos} self={p.id === bt.me.vid} />
                    <span className="btg-rv-txt">
                      <b><Who p={p} meVid={bt.me.vid} plate />{captainOf(match, t)?.vid === p.id && <i>C</i>}</b>
                      <small>{archOf(p) && <><em>{archOf(p)}</em> · </>}{p.pos === 'big' ? 'BIG' : 'GUARD'}</small>
                    </span>
                    <span className="btg-rv-ovr">{liveOvr(p) ?? '–'}<small>OVR</small></span>
                  </div>
                ))}
              </div>
            ))}
            <div className="btg-rv-vs">VS</div>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'result') {
    const won = game.winner === myTeam
    const mvp = match.players.find(p => p.vid === game.mvp)
    // on the live server, running it back is your squad's call (the other team decides for itself)
    const pool = bt.server ? match.players.filter(p => !p.bot && p.team === myTeam) : match.players.filter(p => !p.bot)
    const votes = pool.filter(p => bt.rematchVotes.has(p.vid)).length
    const humans = pool.length
    // a player's night: the portrait, the name in its look, the line
    const star = (p, label, isMvp) => {
      const s = game.stats[p.vid] ?? {}
      return (
        <div className={`btg-star bt-t${p.team}${isMvp ? ' is-mvp' : ''}`}>
          <Av name={p.name} bot={asBot(p)} team={p.team} size={52} cos={p.cos} self={p.vid === bt.me.vid} />
          <div className="btg-star-id">
            <span className="btg-star-lbl">{label}</span>
            <span className="btg-star-name"><Who p={p} meVid={bt.me.vid} plate link={watch} /></span>
            <span className="btg-star-sub">{names[p.team]} · {p.pos === 'big' ? 'BIG' : 'GUARD'}</span>
          </div>
          <div className="btg-stats">
            {[['PTS', s.pts], ['FG', `${s.fgm ?? 0}/${s.fga ?? 0}`], ['AST', s.ast], ['REB', s.reb], ['STL', s.stl], ['BLK', s.blk]].map(([k, v]) => <span key={k} className={v === 0 ? 'is-zero' : ''}>{v ?? 0}<small>{k}</small></span>)}
          </div>
        </div>
      )
    }
    return (
      <div className="ag-screen ag-screen--bucket bt-game btg btg-final">
        {watch && <WatchBar bt={bt} />}
        <div className="btg-fin-cols">
          <div className="btg-fin-main">
            {/* watching: the final, the winners named; nothing of it is anyone's but theirs */}
            <div className={`btg-fin ${won || watch ? 'is-win' : 'is-loss'}`}>
              <div className="btg-fin-top">
                <span className="btg-fin-tag">FINAL</span>
                <span className="btg-fin-sub">BLACKTOP · FIRST TO 11</span>
                {!watch && <span className="btg-fin-wl" aria-label={won ? 'Win' : 'Loss'}>{won ? 'W' : 'L'}</span>}
              </div>
              {[0, 1].map(t => (
                <div key={t} className={`btg-fin-row bt-t${t}${game.winner === t ? ' is-win' : ''}`}>
                  <i aria-hidden="true" />
                  <span className="btg-fin-name">{names[t]}{game.winner === t && <small>TOOK IT</small>}</span>
                  <b className="btg-fin-score"><RollingNumber value={game.score[t]} from={0} /></b>
                </div>
              ))}
            </div>
            {mvp && star(mvp, 'MVP', true)}
            {!watch && mine && mine.vid !== game.mvp && star(mine, 'FINAL LINE', false)}
            {!watch && <RatingLine mode="bt" noMvp={!!mvp} />}
            <div className="btg-fin-actions">
              {watch && <button className="ag-btn btl-btn" onClick={() => { sfx('tap'); bt.exit() }}>BACK TO BLACKTOP</button>}
              {!watch && (bt.server || humans > 1) && (
                <button className="ag-btn btl-btn" onClick={() => { bt.voteRematch(); sfx('tap') }} disabled={bt.rematchVotes.has(bt.me.vid)}>
                  {bt.rematchVotes.has(bt.me.vid) ? `WAITING FOR ${bt.server ? 'THE SQUAD' : 'SQUADS'} · ${votes}/${humans}` : `RUN IT BACK${humans > 1 && votes ? ` · ${votes}/${humans}` : ''}`}
                </button>
              )}
              {!watch && <button className="ag-btn btl-btn btl-btn--line" onClick={bt.exit}>LEAVE THE BLACKTOP</button>}
            </div>
          </div>
          <div className="btg-fin-side">
            {[game.winner, 1 - game.winner].map(t => (
              <div key={t} className={`btg-box bt-t${t}`}>
                <div className="btg-box-head"><span>{names[t]}</span><span>PTS</span><span>FG</span><span>AST</span><span>REB</span><span>STL</span><span>BLK</span></div>
                {game.teams[t].map(p => { const s = game.stats[p.id]; return (
                  <div key={p.id} className={`btg-box-row${p.id === bt.me.vid ? ' is-me' : ''}${p.id === game.mvp ? ' is-mvp' : ''}`}>
                    <span className="btg-box-name"><span><Who p={p} meVid={bt.me.vid} link={watch} /></span>{p.id === game.mvp && <em>MVP</em>}</span>
                    <span><b>{s.pts}</b></span><span>{s.fgm}/{s.fga}</span><span>{s.ast}</span><span>{s.reb}</span><span>{s.stl}</span><span>{s.blk}</span>
                  </div>
                ) })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // the board, as of what's been shown: who has it, a run, game point
  pipFrom.current ??= [...score]
  const over = outTo >= plays.length - 1
  const gamePoint = [0, 1].find(t => score[t] >= 10 && score[t] > score[1 - t])
  const run = (() => {
    let team = null, n = 0
    for (let i = outTo; i >= 0; i--) { const q = plays[i]; if (q.type !== 'score') continue; if (team == null) team = q.team; if (q.team !== team) break; n += q.pts }
    return n >= 5 ? { team, n } : null
  })()
  const state = over ? { cls: ' is-gp', text: 'FINAL' } : gamePoint != null ? { cls: ' is-gp', text: 'GAME POINT' } : run ? { cls: ` is-run bt-t${run.team}`, text: `${run.n}-0 RUN` } : { cls: '', text: 'FIRST TO 11' }
  // everyone's points so far, and who's made two in a row (the builds panel shows them)
  const line = {}
  for (let i = 0; i <= outTo; i++) {
    const q = plays[i], at = id => (line[id] ??= { pts: 0, run: 0 })
    if (q.type === 'score') { const s = at(q.pid); s.pts += q.pts; s.run++ }
    else if (q.type === 'miss') at(q.pid).run = 0
    else if (q.type === 'block') at(q.pid2 ?? q.pid).run = 0
  }
  const now = feed[0]
  // the calls: the ball decides who calls. The handler calls the play, the man on him the defense;
  // everyone else (and the stands) is told who has it and who's on him
  let callBar = null, onBall = null
  if (calling) {
    const all = game.teams.flat(), nm = id => all.find(p => p.id === id)?.name ?? ''
    const h = calling.handler, dfd = calling.defender
    const pick = v => bt.call(calling.pn, v)
    if (h === bt.me.vid) {
      const mates = game.teams[myTeam].filter(p => p.id !== h)
      // a pass says what the teammate does with it (the engine plays exactly that): a shooter catches and shoots
      const opts = [...offCallsFor(size).filter(c => c !== 'pass'), ...mates.map(p => ({ v: `pass:${p.id}`, label: 'PASS →', sub: firstName(p.name) }))]   // what he does with it, the play decides
      callBar = <CallBar key={calling.pn} offense head="BALL IN HAND · CALL IT" options={opts} picked={bt.myCalls?.[calling.pn] ?? null} onPick={pick} />
    } else if (dfd === bt.me.vid) callBar = <CallBar key={calling.pn} offense={false} head={`GUARDING ${firstName(nm(h))} · CALL IT`} options={defCallsFor(size)} picked={bt.myCalls?.[calling.pn] ?? null} onPick={pick} />
    else onBall = `${firstName(nm(h))} HAS THE BALL · ${firstName(nm(dfd))} IS ON HIM`
  }
  const side = t => (
    <div className={`btg-bug-team bt-t${t}${score[t] > score[1 - t] ? ' is-lead' : ''}${!over && play?.poss === t ? ' has-ball' : ''}`}>
      <i className="btg-bug-slab" aria-hidden="true" />
      <div className="btg-bug-id">
        <span className="btg-bug-name"><span>{names[t].startsWith('TEAM ') ? <><span className="btg-bug-pre">TEAM </span>{names[t].slice(5)}</> : names[t]}</span>{myTeam === t ? <IconStar size={11} className="btg-bug-me" /> : null}</span>
        <span className="btg-bug-pips" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} className={i < score[t] ? `is-on${i >= pipFrom.current[t] ? ' is-new' : ''}` : ''} />)}</span>
      </div>
      <b className="btg-bug-score"><RollingNumber value={score[t]} /></b>
    </div>
  )

  return (
    <div className={`ag-screen ag-screen--bucket bt-game btg btg-live${watch ? ' is-watch' : ''}`}>
      {watch && <WatchBar bt={bt} />}
      <div className="btg-cols">
        <div className="btg-main">
          <div className="btg-bug">
            {side(0)}{side(1)}
            <div className="btg-bug-strip">
              <span key={state.text} className={`btg-bug-state${state.cls}`}>{state.text}</span>
              <span className="btg-bug-rule">WIN BY 2</span>
            </div>
          </div>
          <div className="btg-courtbox">
            <div className="btg-frame lc-court">
              {/* each player on court is their profile picture and username (the CPU fill-ins say CPU) */}
              <BlacktopCourt game={game} play={play} meId={bt.me.vid} colorFor={colorFor} speed={speed} onReveal={onReveal}
                ovrFor={p => liveOvr(p)} bubbles={bubbles}
                avatarFor={p => <Av name={p.name} bot={asBot(p)} team={p.team} size={36} cos={p.cos} self={p.id === bt.me.vid} />} />
              {locked && lastCheck && !calling && <CallReveal key={lastCheck.pn} off={fitOff(locked[lastCheck.team])} def={fitDef(locked[1 - lastCheck.team])} offense={watch ? null : lastCheck.team === myTeam} nameOf={id => firstName(game.teams.flat().find(p => p.id === id)?.name)} />}
              {onBall && <div className="btg-onball">{onBall}</div>}
            </div>
            {/* the calls: over the plays before on phones, over the court's lower edge on wide screens (court and buttons in one view) */}
            <div className="lc-calls">{callBar}</div>
          </div>
          {/* the lower third: the play that just happened */}
          {now
            ? <div className={`btg-l3 bt-t${now.team}${now.big ? ' is-big' : ''}${now.type === 'milestone' ? ' is-ms' : ''}`} aria-live="polite"><div key={now.id} className="btg-l3-in" style={{ display: 'contents' }}><span className="btg-l3-tag">{playTag(now)}</span><span className="btg-l3-text">{now.text}</span></div></div>
            : <div className="btg-l3 is-idle"><span /><span className="btg-l3-text">1s AND 2s · MAKE IT, TAKE IT</span></div>}
        </div>
        <div className="btg-side">
          {!watch && <EmoteBar emotes={EMOTES} onEmote={bt.emote} />}
          <div className="btg-log">
            <span className="btg-log-head">PLAY-BY-PLAY</span>
            {feed.slice(1).map(p => <div key={p.id} className={`btg-log-line bt-t${p.team}${p.type === 'milestone' ? ' is-ms' : ''}`}><i aria-hidden="true" /><span>{p.text}</span></div>)}
          </div>
          {/* every build, on the screen itself: under the play-by-play (beside the court on wide screens) */}
          <SquadBuilds game={game} names={names} meVid={bt.me.vid} line={line} />
        </div>
      </div>
      {/* team chat: rides the bottom of the screen as the page scrolls (above the dock and the ad rail) */}
      {onOpenChat && <div className="btg-chat-dock"><button className="btg-chat" onClick={onOpenChat} aria-label="Team chat"><IconChat size={18} />{unread > 0 && <span className="ag-tab-badge">{unread}</span>}</button></div>}
    </div>
  )
}
