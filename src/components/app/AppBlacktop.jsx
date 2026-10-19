import { useEffect, useMemo, useRef, useState } from 'react'
import { useRailOn } from '../../lib/ads'
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
import { IconClose, IconArrow, IconChat, IconStar, IconSend, IconBasketball, IconVersus } from './icons'
import { NameTag, AvatarBadge } from './NameTag'
import OnlineRecord, { RatingLine, LinkPill, ModeStats, TierChip } from './OnlineRecord'
import { useProgress } from '../../lib/progress'
import { makeMimics } from '../../lib/mimic'
import { getUsername } from '../../lib/discord'

// BLACKTOP screens. The match itself lives in lib/blacktop.js (useBlacktop);
// these only draw it: the lobby (pick a spot on a squad), the slim HUD over the
// build, team chat, and the game on the court.

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
// A player's name with their look (plate: the full nameplate where there's room)
const Who = ({ p, meVid, plate = false, short = false }) => (asBot(p)
  ? <>{short ? firstName(p.name) : p.name}</>
  : <NameTag name={short ? firstName(p.name) : p.name} cos={p.cos} self={(p.vid ?? p.id) === meVid} plate={plate} />
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

// ── Hub: 1v1 (pickup or a friend), then the 2v2 and 3v3 lobbies, with stats ──
export function OneOnOneOptions({ onPickup, onFriend, onJoinCode, error = '' }) {
  const [code, setCode] = useState('')
  return (
    <div className="v1-opts">
      {onPickup && <button className="bt-opt" onClick={() => { sfx('tap'); onPickup() }}>
        <span className="bt-opt-ico"><IconBasketball size={20} /></span>
        <span className="bt-opt-txt"><b>PICKUP</b><small>Search for a game</small></span>
        <IconArrow size={14} />
      </button>}
      <button className="bt-opt" onClick={() => { sfx('tap'); onFriend() }}>
        <span className="bt-opt-ico"><IconVersus size={20} /></span>
        <span className="bt-opt-txt"><b>PLAY A FRIEND</b><small>Get a code and send it to them</small></span>
        <IconArrow size={14} />
      </button>
      <form className="v1-join" onSubmit={e => { e.preventDefault(); if (code.length >= 4) onJoinCode(code) }}>
        <input value={code} maxLength={8} placeholder="GOT A FRIEND'S CODE?" aria-label="Friend's code" autoComplete="off"
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        <button className="ag-btn" type="submit" disabled={code.length < 4}>JOIN</button>
      </form>
      {error && <div className="v1-error">{error}</div>}
    </div>
  )
}

export function BlacktopHub({ onJoin3v3, onJoin2v2 = null, onJoin1v1 = null, onPickup, onFriend, onJoinCode, onBack, notice = null, onNotice = null, onPractice = null }) {
  const o = useProgress().stats?.online ?? { rating: 800 }
  return (
    <div className="ag-screen ag-screen--bucket bt-hub">
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">ONLINE · LIVE GAMES · FIRST TO 11</span>
          <h1 className="ag-h1">Blacktop</h1>
        </div>
        <button className="ag-round-btn" onClick={onBack} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <button className="bt-hub-rating ag-pop" onClick={() => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'online' }))}>
          <span className="ag-eyebrow">ONLINE RATING</span><TierChip rating={o.rating} /><b>{o.rating}</b><IconArrow size={13} />
        </button>
        {notice && <button className="bt-notice ag-pop" onClick={onNotice}>{notice}<small>TAP TO DISMISS</small></button>}
        <section className="bt-mode ag-pop" style={{ '--d': '60ms' }}>
          <div className="bt-mode-head">
            <span className="bt-mode-tag">1V1</span>
            <span className="bt-mode-txt"><b>1v1</b><small>One on one. Take a spot as a guard or a big, build, run it.</small></span>
          </div>
          {onJoin1v1 ? <>
            <button className="ag-btn bt-mode-go" onClick={() => { sfx('tap'); onJoin1v1() }}>JOIN LOBBY <IconArrow size={16} /></button>
            {onPractice && <button className="ag-btn ag-btn--ghost bt-practice" onClick={() => { sfx('tap'); onPractice(1) }}>PRACTICE · YOU + 1 CPU</button>}
            <OneOnOneOptions onFriend={onFriend} onJoinCode={onJoinCode} />
            <ModeStats mode="bt1" />
          </> : <>
            <OneOnOneOptions onPickup={onPickup} onFriend={onFriend} onJoinCode={onJoinCode} />
            <ModeStats mode="h2hB" />
          </>}
        </section>
        {onJoin2v2 && (
          <section className="bt-mode ag-pop" style={{ '--d': '100ms' }}>
            <div className="bt-mode-head">
              <span className="bt-mode-tag">2V2</span>
              <span className="bt-mode-txt"><b>2v2</b><small>A guard and a big a side. Take a spot, build your role, run it.</small></span>
            </div>
            <button className="ag-btn bt-mode-go" onClick={() => { sfx('tap'); onJoin2v2() }}>JOIN LOBBY <IconArrow size={16} /></button>
            {onPractice && <button className="ag-btn ag-btn--ghost bt-practice" onClick={() => { sfx('tap'); onPractice(2) }}>PRACTICE · YOU + 3 CPUS</button>}
            <ModeStats mode="bt2" />
          </section>
        )}
        <section className="bt-mode ag-pop" style={{ '--d': '140ms' }}>
          <div className="bt-mode-head">
            <span className="bt-mode-tag">3V3</span>
            <span className="bt-mode-txt"><b>Squads</b><small>Two guards and a big a side. Take a spot, build your role, run it.</small></span>
          </div>
          <button className="ag-btn bt-mode-go" onClick={() => { sfx('tap'); onJoin3v3() }}>JOIN LOBBY <IconArrow size={16} /></button>
          {onPractice && <button className="ag-btn ag-btn--ghost bt-practice" onClick={() => { sfx('tap'); onPractice(3) }}>PRACTICE · YOU + 5 CPUS</button>}
          <ModeStats mode="bt" />
        </section>
        <CourtPicker />
        <details className="bt-rules ag-pop" style={{ '--d': '180ms' }}>
          <summary className="ag-eyebrow">HOUSE RULES</summary>
          <ul>
            <li>Real players only. A 1v1 starts when both spots are taken, a 2v2 when all four are, a 3v3 when all six are. Practice puts you against CPUs right away.</li>
            <li>In a 1v1 you take your spot as a guard or a big. A 2v2 squad is a guard and a big; a 3v3 squad is two guards and a big. The spot you take is the build you make.</li>
            <li>3:00 to build. Leave or go quiet and the blacktop builds for you, with the ratings off.</li>
            <li>First to <b>11</b>, 1s and 2s, win by 2. Make it, take it.</li>
            <li>Chat is filtered, and anyone can be reported.</li>
          </ul>
        </details>
      </div>
    </div>
  )
}

// The court your games are played on: the ones you own, the rest in the shop
function CourtPicker() {
  const court = useCourt()
  const mine = COURTS.filter(c => owns(c.id))
  return (
    <section className="bt-courts ag-pop" style={{ '--d': '150ms' }}>
      <div className="bt-courts-head"><span className="ag-eyebrow">COURT</span><button className="ag-chip" onClick={() => { sfx('tap'); window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'shop:court' })) }}>{COURTS.length - mine.length} MORE IN THE SHOP</button></div>
      <div className="bt-courts-row" role="radiogroup" aria-label="Court">
        {mine.map(c => (
          <button key={c.id} role="radio" aria-checked={court.id === c.id} className={`bt-court-opt${court.id === c.id ? ' is-on' : ''}`} onClick={() => { setCourtId(c.id); sfx('tap') }}>
            <img src={c.thumb} alt="" loading="lazy" draggable={false} />
            <span>{c.name.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ── Lobby: two squads, tap an open spot ──────────────────────────────────────
// The lobby's TEST fill: who sees it (the demo account, and local dev builds)
const TESTERS = new Set(['GOATmaker'])

export function BlacktopQueue({ bt, user, onBack }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [seenChat, setSeenChat] = useState(0)
  const SLOTS = bt.slots ?? ALL_SLOTS
  const ROOM_SIZE = bt.roomSize ?? ALL_SIZE
  const size = bt.size ?? 3
  // TEST: made-up players (lib/mimic.js) take the open spots one by one, as if a real
  // lobby were filling, then the run starts: a practice game whose CPUs wear them
  const tester = import.meta.env.DEV || TESTERS.has(getUsername(user))
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
  const posLine = pos => (pos === 'big' ? 'BIG · PF · C' : 'GUARD · PG · SG · SF')
  const waiting = bt.queue.filter(p => !p.slot || bt.held[p.slot]?.vid !== p.vid).length
  const unread = Math.max(0, bt.chat.length - seenChat)
  return (
    <div className="ag-screen ag-screen--bucket bt-lobby">
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">BLACKTOP · LIVE · FIRST TO 11</span>
          <h1 className="ag-h1">{size}v{size} lobby</h1>
        </div>
        <button className="ag-round-btn" onClick={() => { (bt.leaveLobby ?? bt.leave)(); onBack() }} aria-label="Leave the lobby"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <div className="bt-run ag-pop">
          <div className="bt-run-head">
            <span className="bt-run-count"><b>{Math.min(ROOM_SIZE, bt.seated + Object.keys(fill).length)}</b>/{ROOM_SIZE} <small>SPOTS TAKEN</small></span>
            <span className="bt-run-timer">{fmt(bt.waited)}</span>
          </div>
          <div className="bt-run-link"><LinkPill link={bt.link} onRetry={bt.retry} /></div>
          <div className="bt-court-lines" aria-hidden="true" />
          <div className="bt-squads">
            {[0, 1].map(t => (
              <div key={t} className={`bt-squad-col bt-t${t}${SLOTS.some(sl => sl.team === t && bt.mySlot === sl.id) ? ' is-mine' : ''}`}>
                <span className="bt-squad-title">{squadName(t)}</span>
                {SLOTS.filter(sl => sl.team === t).map((sl, i) => {
                  const h = heldAt(sl.id)
                  const me = h?.vid === bt.me.vid
                  // a 1v1 spot: open, you take it as a guard or a big
                  if (sl.pos === 'any' && !h) return (
                    <div key={sl.id} className="bt-spot is-open bt-spot--pick" style={{ '--d': `${80 + (t * 3 + i) * 50}ms` }}>
                      <button className="bt-spot-half" onClick={() => tap(sl, 'guard')}><span className="bt-spot-plus">+</span><span className="bt-spot-txt"><span className="bt-spot-name">GUARD</span><span className="bt-spot-role">PG · SG · SF</span></span></button>
                      <button className="bt-spot-half is-big" onClick={() => tap(sl, 'big')}><span className="bt-spot-plus">+</span><span className="bt-spot-txt"><span className="bt-spot-name">BIG</span><span className="bt-spot-role">PF · C</span></span></button>
                    </div>
                  )
                  const pos = sl.pos === 'any' ? h?.pos : sl.pos
                  return (
                    <button key={sl.id} className={`bt-spot${h ? ' is-taken' : ' is-open'}${me ? ' is-me' : ''}${pos === 'big' ? ' is-big' : ''}`} style={{ '--d': `${80 + (t * 3 + i) * 50}ms` }} onClick={() => tap(sl)}>
                      {h ? <Av name={h.name} team={t} size={34} cos={h.cos} self={me} /> : <span className="bt-spot-plus">+</span>}
                      <span className="bt-spot-txt">
                        <span className="bt-spot-name">{h ? <NameTag name={h.name} cos={h.cos} self={me} /> : `JOIN AS ${pos === 'big' ? 'BIG' : 'GUARD'}`}</span>
                        <span className="bt-spot-role">{posLine(pos)}{me ? ' · TAP TO LEAVE' : ''}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            <span className="bt-squads-vs">VS</span>
          </div>
          {bt.bumped && <div className="bt-bumped ag-pop">Someone grabbed that spot first. Pick another.</div>}
          {tester && <button className="ag-btn ag-btn--ghost bt-test-fill" onClick={testFill} disabled={filling.current}>TEST · FILL WITH PLAYERS</button>}
          <div className="bt-run-foot">
            {!bt.mySlot
              ? <span className="bt-run-hint">Tap an open spot to join that squad.{waiting > 0 ? ` ${waiting} watching.` : ''}</span>
              : <span className="bt-run-hint">{bt.seated === ROOM_SIZE ? 'Full run. Lacing up…' : `Starts when ${size === 1 ? 'both' : `all ${size === 2 ? 'four' : 'six'}`} spots are taken · ${ROOM_SIZE - bt.seated} to go. Real players only.`}</span>}
          </div>
        </div>

        <button className="bt-lobby-chat ag-pop" style={{ '--d': '160ms' }} onClick={() => { setChatOpen(true); setSeenChat(bt.chat.length) }}>
          <IconChat size={18} />
          <span className="bt-lobby-chat-txt">{bt.chat.length ? <><b><NameTag name={bt.chat[bt.chat.length - 1].name} self={bt.chat[bt.chat.length - 1].from === bt.me.vid} cos={bt.chat[bt.chat.length - 1].cos || null} />:</b> {bt.chat[bt.chat.length - 1].text}</> : 'Lobby chat. Call your spot, find a squad.'}</span>
          {unread > 0 && <span className="ag-tab-badge">{unread}</span>}
        </button>

        <OnlineRecord modes={[size === 1 ? 'bt1' : size === 2 ? 'bt2' : 'bt']} title={`YOUR ${size}V${size}`} />

      </div>
      {chatOpen && <BlacktopChat bt={bt} user={user} title="LOBBY CHAT" mode="blacktop-lobby" onClose={() => { setChatOpen(false); setSeenChat(bt.chat.length) }} />}
    </div>
  )
}

// ── HUD over the build: one slim bar, tap to open the squads ────────────────
export function BlacktopHud({ bt, onOpenChat, unread }) {
  const [open, setOpen] = useState(false)
  const squads = [0, 1].map(t => bt.match.players.filter(p => p.team === t))
  const ready = t => squads[t].filter(p => p.bot || bt.builds[p.vid]?.done).length
  const urgent = bt.clock <= 20
  return (
    <div className={`bt-hud has-leave${urgent ? ' is-urgent' : ''}${open ? ' is-open' : ''}`}>
      <button className="bt-hud-bar" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="bt-hud-clock">{fmt(bt.clock)}</span>
        <span className="bt-hud-mini">
          <span className="bt-t0"><b>{teamName(bt.match, 0)}</b> {ready(0)}/{bt.size ?? 3}</span>
          <i>vs</i>
          <span className="bt-t1"><b>{teamName(bt.match, 1)}</b> {ready(1)}/{bt.size ?? 3}</span>
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
                      <span className="bt-hud-p-n">{asBot(p) ? 'CPU' : !here ? 'AFK' : ovr != null ? <><b>{ovr}</b> OVR</> : b?.done ? '✓' : `${b?.filled ?? 0}/8`}</span>
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

// ── Chat: a sheet that slides up; bubbles, typing, your squad's overalls ─────
export function BlacktopChat({ bt, user, onClose, mode = 'blacktop', title = 'TEAM CHAT' }) {
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(null)      // message with the report/block menu open
  const [note, setNote] = useState('')
  const [closing, setClosing] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    const el = listRef.current; if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [bt.chat.length])
  const close = () => { setClosing(true); setTimeout(onClose, 180) }
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
  return createPortal(
    <div className={`bt-sheet-overlay${closing ? ' is-closing' : ''}`} onClick={e => e.target === e.currentTarget && close()}>
      <div className="bt-sheet" role="dialog" aria-label={title}>
        <div className="bt-sheet-grab" onClick={close} />
        <div className="bt-sheet-head">
          <h2 className="bt-sheet-title">{title}</h2>
          <button className="ag-round-btn" onClick={close} aria-label="Close"><IconClose size={16} /></button>
        </div>
        {squad && (
          <div className="bt-squad-strip">
            {squad.map(p => {
              const ovr = liveOvr(bt.builds[p.vid])
              return (
                <span key={p.vid} className={`bt-sq${p.vid === bt.me.vid ? ' is-me' : ''}`}>
                  <Av name={p.name} bot={asBot(p)} team={bt.myTeam} size={30} cos={p.cos} self={p.vid === bt.me.vid} />
                  <span className="bt-sq-txt"><b><Who p={p} meVid={bt.me.vid} short /></b><small>{p.pos === 'big' ? 'BIG' : 'GUARD'}</small></span>
                  <span className="bt-sq-ovr">{asBot(p) ? 'CPU' : ovr ?? '—'}<small>{asBot(p) || ovr == null ? '' : 'OVR'}</small></span>
                </span>
              )
            })}
          </div>
        )}
        <div className="bt-chat-list" ref={listRef}>
          {bt.chat.length === 0 && <div className="bt-chat-empty"><IconBasketball size={26} /><span>{mode === 'blacktop-lobby' ? 'Say what\'s up to the lobby.' : 'Say what\'s up to your squad.'}</span></div>}
          {bt.chat.map((m, i) => {
            const mine = m.from === bt.me.vid
            const prev = bt.chat[i - 1]
            const grouped = prev && prev.from === m.from && m.ts - prev.ts < 60000
            return (
              <div key={m.id} className={`bt-msg${mine ? ' is-me' : ''}${grouped ? ' is-grouped' : ''}`} onContextMenu={e => { e.preventDefault(); if (!mine) setMenu(m) }}>
                {!grouped && !mine && <span className="bt-msg-name" onClick={() => setMenu(m)}><NameTag name={m.name} cos={m.cos} />{m.all && mode !== 'blacktop-lobby' && <i> · ALL</i>}</span>}
                <span className="bt-msg-text">{m.text}</span>
              </div>
            )
          })}
          {typers.length > 0 && <div className="bt-typing"><span className="bt-dots"><i /><i /><i /></span>{typers.slice(0, 2).join(', ')} {typers.length > 1 ? 'are' : 'is'} typing</div>}
        </div>
        {note && <div className="bt-chat-note">{note}</div>}
        {menu && (
          <div className="bt-msg-menu">
            <span><NameTag name={menu.name} cos={menu.cos || null} uid={menu.uid || null} /></span>
            <button onClick={() => act('report')}>REPORT</button>
            <button onClick={() => act('block')}>BLOCK</button>
            <button onClick={() => setMenu(null)}>CANCEL</button>
          </div>
        )}
        {/* guests chat too (as "Guest"); the filter, report and block cover everyone */}
        {!rulesOk ? (
          <div className="bt-rules" role="region" aria-label="Chat rules">
            <b>BEFORE YOU CHAT</b>
            <ul>
              <li>Keep it about the game. No hate, bullying or threats.</li>
              <li>Never share your real name, school, address, phone or socials.</li>
              <li>No links. Messages are filtered.</li>
              <li>Press and hold (or right-click) a message to report or block someone.</li>
            </ul>
            <p>Breaking the rules gets you muted or banned. <a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('bap:menu'))}>Contact us</button></p>
            <button className="ag-btn ag-cta" onClick={agree}>I AGREE · LET ME CHAT</button>
          </div>
        ) : <>
        <div className="bt-quick">{QUICK.map(q => <button key={q} className="ag-chip" onClick={() => send(q)}>{q}</button>)}</div>
        <form className="bt-chat-form" onSubmit={e => { e.preventDefault(); send(text) }}>
          <input ref={inputRef} value={text} onChange={e => { setText(e.target.value); bt.typing?.() }} maxLength={120} placeholder={mode === 'blacktop-lobby' ? 'Message the lobby…' : mode === 'takeover' ? 'Message your partner…' : 'Message your squad…'} enterKeyHint="send" autoComplete="off" />
          <button className="bt-send" type="submit" disabled={!text.trim()} aria-label="Send"><IconSend size={20} /></button>
        </form>
        </>}
      </div>
    </div>,
    document.body,
  )
}

// Every player's build in the game, grade by grade (a sheet over the court)
function SquadBuilds({ game, names, meVid, onClose }) {
  return (
    <div className="lc-builds ag-pop" role="dialog" aria-label="Builds">
      <div className="lc-builds-head"><span className="ag-eyebrow">THE BUILDS</span><button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={14} /></button></div>
      {[0, 1].map(t => (
        <div key={t} className={`lc-builds-team bt-t${t}`}>
          <span className="lc-builds-name">{names[t]}</span>
          {game.teams[t].map(p => {
            const types = p.pos === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
            const ovr = liveOvr(p)
            return (
              <div key={p.id} className={`lc-builds-p${p.id === meVid ? ' is-me' : ''}`}>
                <span className="lc-builds-who">
                  <span className="lc-builds-id"><b>{asBot(p) ? p.name : <NameTag name={p.name} cos={p.cos} self={p.id === meVid} />}</b>{archOf(p) && <em className="bt-arch">{archOf(p)}</em>}<small>{p.pos === 'big' ? 'BIG' : 'GUARD'}</small></span>
                  <span className="lc-builds-ovr"><b>{ovr ?? '–'}</b><small>OVR</small></span>
                </span>
                {/* each trait's grade in its color, so a build reads at a glance */}
                <span className="lc-builds-grades">
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

// ── Game: reveal → live → result ────────────────────────────────────────────
export function BlacktopGame({ bt, user, photoFor, onOpenChat, unread }) {
  const { game, match } = bt
  const [stage, setStage] = useState('reveal')
  const [idx, setIdx] = useState(0)
  const speed = 0.85                         // online: everyone sees it at the same pace (a touch slower than real time, so the moves are easy to follow)
  const fired = useRef(false)
  const plays = game?.plays ?? []
  const play = plays[idx]
  const mine = match.players.find(p => p.vid === bt.me.vid)
  const myTeam = mine?.team ?? 0
  const colorFor = t => TEAM_COLORS[t]
  const names = useMemo(() => [teamName(match, 0), teamName(match, 1)], [match])
  useRailOn(`${stage}|${idx >= plays.length - 1}`)   // tip-off and the final buzzer bring the bottom rail back

  useEffect(() => { const t = setTimeout(() => setStage('live'), 4200); return () => clearTimeout(t) }, [])
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
      // on the server: say I'm here, and the server's lock moves us on
      if (bt.server) { bt.arrive(play.pn, play.team); return }
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
  const [showBuilds, setShowBuilds] = useState(false)
  if (!game) return null

  // this possession's calls: the open check-up, and what was called on the one being played
  const calling = stage === 'live' && play?.type === 'check' && !bt.locks?.[play.pn] ? play : null
  const lastCheck = [...plays.slice(0, idx + 1)].reverse().find(p => p.type === 'check')
  const locked = lastCheck ? bt.locks?.[lastCheck.pn] : null
  const humansOn = t => match.players.some(p => p.team === t && !p.bot)
  const score = play?.score ?? [0, 0]
  const feed = plays.slice(0, idx + 1).filter(p => p.type !== 'check').slice(-4).reverse()
  const squads = [0, 1].map(t => game.teams[t])
  // only the calls that fit this game: a 1v1 has no pass and no help (a CPU's call included)
  const size = game.teams[myTeam]?.length ?? 1
  const fitOff = v => (typeof v === 'string' && v.startsWith('pass:') ? (size > 1 ? v : null) : offCallsFor(size).includes(v) ? v : null)
  const fitDef = v => (defCallsFor(size).includes(v) ? v : null)

  if (stage === 'reveal') {
    return (
      <div className="ag-screen ag-screen--bucket bt-game">
        <div className="bt-reveal">
          <span className="ag-eyebrow">BLACKTOP · FIRST TO 11</span>
          <div className="bt-reveal-grid">
            {squads.map((sq, t) => (
              <div key={t} className={`bt-squad bt-t${t} ag-pop`} style={{ '--d': `${t * 160}ms` }}>
                <span className="bt-squad-name">{names[t]}</span>
                {sq.map(p => (
                  <div key={p.id} className="bt-squad-p">
                    <Av name={p.name} bot={asBot(p)} team={t} size={34} cos={p.cos} self={p.id === bt.me.vid} />
                    <span className="bt-squad-p-txt"><b><Who p={p} meVid={bt.me.vid} plate />{captainOf(match, t)?.vid === p.id ? ' · C' : ''}</b>{archOf(p) && <em className="bt-arch">{archOf(p)}</em>}<small>{p.pos === 'big' ? 'BIG' : 'GUARD'} · {liveOvr(p) ?? '–'} OVR</small></span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="bt-vs">VS</div>
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
    return (
      <div className="ag-screen ag-screen--bucket bt-game">
        <div className="ag-screen-body">
          <div className={`bt-result-hero ${won ? 'is-win' : 'is-loss'} ag-pop`}>
            <span className="ag-eyebrow">{won ? 'BLACKTOP · W' : 'BLACKTOP · L'}</span>
            <h1 className="ag-h1">{won ? 'Your squad took it' : 'They took it'}</h1>
            <div className="bt-final"><b className="bt-t0">{game.score[0]}</b><span>–</span><b className="bt-t1">{game.score[1]}</b></div>
            <div className="bt-final-teams"><span className="bt-t0">{names[0]}</span><span className="bt-t1">{names[1]}</span></div>
            {mvp && <div className="bt-mvp"><IconStar size={14} /> MVP · <Who p={mvp} meVid={bt.me.vid} plate /></div>}
            <RatingLine mode="bt" />
          </div>
          {[game.winner, 1 - game.winner].map(t => (
            <div key={t} className={`ag-card bt-box bt-t${t} ag-pop`} style={{ '--d': `${120 + t * 80}ms` }}>
              <div className="bt-box-head"><span>{names[t]}</span><span>PTS</span><span>FG</span><span>AST</span><span>REB</span><span>STL</span><span>BLK</span></div>
              {game.teams[t].map(p => { const s = game.stats[p.id]; return (
                <div key={p.id} className={`bt-box-row${p.id === bt.me.vid ? ' is-me' : ''}${p.id === game.mvp ? ' is-mvp' : ''}`}>
                  <span className="bt-box-name"><Who p={p} meVid={bt.me.vid} /></span>
                  <span><b>{s.pts}</b></span><span>{s.fgm}/{s.fga}</span><span>{s.ast}</span><span>{s.reb}</span><span>{s.stl}</span><span>{s.blk}</span>
                </div>
              ) })}
            </div>
          ))}
          <div className="bt-result-actions ag-pop" style={{ '--d': '300ms' }}>
            {(bt.server || humans > 1) && (
              <button className="ag-btn" onClick={() => { bt.voteRematch(); sfx('tap') }} disabled={bt.rematchVotes.has(bt.me.vid)}>
                {bt.rematchVotes.has(bt.me.vid) ? `WAITING FOR ${bt.server ? 'YOUR SQUAD' : 'SQUADS'} · ${votes}/${humans}` : `RUN IT BACK${humans > 1 && votes ? ` · ${votes}/${humans}` : ''}`}
              </button>
            )}
            <button className="ag-btn ag-btn--ghost" onClick={bt.exit}>LEAVE THE BLACKTOP</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ag-screen ag-screen--bucket bt-game bt-live">
      <div className="bt-board">
        <div className={`bt-board-side bt-t0${score[0] > score[1] ? ' is-lead' : ''}`}><span className="bt-board-name">{names[0]}{myTeam === 0 ? ' ★' : ''}</span><b>{score[0]}</b></div>
        <div className="bt-board-mid"><span className="ag-eyebrow">FIRST TO 11</span><span className="bt-board-btns"><button className={`ag-chip${showBuilds ? ' is-on' : ''}`} onClick={() => setShowBuilds(v => !v)}>BUILDS</button></span></div>
        <div className={`bt-board-side bt-t1${score[1] > score[0] ? ' is-lead' : ''}`}><span className="bt-board-name">{names[1]}{myTeam === 1 ? ' ★' : ''}</span><b>{score[1]}</b></div>
      </div>
      {/* each player on court is their profile picture and username (the CPU fill-ins say CPU) */}
      {showBuilds && <SquadBuilds game={game} names={names} meVid={bt.me.vid} onClose={() => setShowBuilds(false)} />}
      <div className="lc-court">
        <BlacktopCourt game={game} play={play} meId={bt.me.vid} colorFor={colorFor} speed={speed}
          ovrFor={p => liveOvr(p)} bubbles={bubbles}
          avatarFor={p => <Av name={p.name} bot={asBot(p)} team={p.team} size={28} cos={p.cos} self={p.id === bt.me.vid} />} />
        {locked && lastCheck && !calling && <CallReveal key={lastCheck.pn} off={fitOff(locked[lastCheck.team])} def={fitDef(locked[1 - lastCheck.team])} offense={lastCheck.team === myTeam} nameOf={id => firstName(game.teams.flat().find(p => p.id === id)?.name)} />}
        {/* the calls: under the court on phones, over its lower edge on desktop (court and buttons in one view) */}
        <div className="lc-calls">
          {calling && (() => {
            // the ball decides who calls: the handler calls the play, the man on him the defense
            const all = game.teams.flat(), nm = id => all.find(p => p.id === id)?.name ?? ''
            const h = calling.handler, dfd = calling.defender
            const pick = v => bt.call(calling.pn, v)
            if (h === bt.me.vid) {
              const mates = game.teams[myTeam].filter(p => p.id !== h)
              // a pass says what the teammate does with it (the engine plays exactly that): a shooter catches and shoots
              const opts = [...offCallsFor(size).filter(c => c !== 'pass'), ...mates.map(p => ({ v: `pass:${p.id}`, label: 'PASS →', sub: firstName(p.name) }))]   // what he does with it, the play decides
              return <CallBar key={calling.pn} offense head="BALL IN HAND · CALL IT" options={opts} picked={bt.myCalls?.[calling.pn] ?? null} onPick={pick} />
            }
            if (dfd === bt.me.vid) return <CallBar key={calling.pn} offense={false} head={`GUARDING ${firstName(nm(h))} · CALL IT`} options={defCallsFor(size)} picked={bt.myCalls?.[calling.pn] ?? null} onPick={pick} />
            return <div className="lc-wait">{firstName(nm(h))} HAS THE BALL · {firstName(nm(dfd))} IS ON HIM</div>
          })()}
        </div>
      </div>
      <EmoteBar emotes={EMOTES} onEmote={bt.emote} />
      <div className="bt-feed">
        {feed.map((p, i) => <div key={p.id} className={`bt-feed-line bt-t${p.team}${i === 0 ? ' is-now' : ''}${p.big ? ' is-big' : ''}${p.type === 'milestone' ? ' is-ms' : ''}`}>{p.text}</div>)}
      </div>
      {onOpenChat && <button className="bt-live-chat" onClick={onOpenChat}><IconChat size={18} />{unread > 0 && <span className="ag-tab-badge">{unread}</span>}</button>}
    </div>
  )
}
