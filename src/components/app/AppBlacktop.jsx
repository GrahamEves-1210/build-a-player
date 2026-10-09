import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ROOM_SIZE, FILL_AFTER_SECS, ROLES, SLOTS, teamName, captainOf } from '../../lib/blacktop'
import { playDelay } from '../../lib/hoops'
import { QUICK, block, report } from '../../lib/chat'
import { sfx, haptic, victory } from '../../lib/juice'
import { calcBucketOVR } from '../../utils/bucketSimulation'
import { VERSUS_GUARD_TYPES } from '../../data/nba-guards'
import { VERSUS_BIG_TYPES } from '../../data/nba-bigs'
import BlacktopCourt from './BlacktopCourt'
import { IconClose, IconArrow, IconChat, IconStar, IconSend, IconBasketball } from './icons'
import { NameTag } from './NameTag'
import OnlineRecord, { RatingLine } from './OnlineRecord'

// BLACKTOP screens. The match itself lives in lib/blacktop.js (useBlacktop);
// these only draw it: the lobby (pick a spot on a squad), the slim HUD over the
// build, team chat, and the game on the court.

const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const TEAM_COLORS = ['#e8f0f6', '#ff8a3d']
const Av = ({ name, bot, team, size = 36 }) => (
  <span className={`bt-av${bot ? ' is-bot' : ''} bt-av--t${team ?? 0}`} style={{ width: size, height: size, fontSize: size * .46 }}>{bot ? 'CPU' : (name || '?').slice(0, 1).toUpperCase()}</span>
)
// A live build's overall (partial builds count what's filled)
export const liveOvr = b => {
  if (!b?.build) return null
  const types = b.pos === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES
  return types.some(t => b.build[t]) ? calcBucketOVR(b.build, types, b.pos) : null
}
const firstName = n => (n || '').trim().split(/\s+/)[0].toUpperCase().slice(0, 10)

// ── Lobby: two squads, tap an open spot ──────────────────────────────────────
export function BlacktopQueue({ bt, user, onBack }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [seenChat, setSeenChat] = useState(0)
  const squadName = t => {
    const first = SLOTS.filter(sl => sl.team === t).map(sl => bt.held[sl.id]).find(Boolean)
    return first ? `TEAM ${firstName(first.name)}` : t === 0 ? 'TEAM A' : 'TEAM B'
  }
  const tap = sl => {
    const h = bt.held[sl.id]
    if (h && h.vid !== bt.me.vid) { sfx('deny'); haptic('light'); return }
    if (bt.mySlot === sl.id) { bt.seat(null); sfx('tap'); return }
    bt.seat(sl.id); sfx('slot'); haptic('medium')
  }
  const waiting = bt.queue.filter(p => !p.slot || bt.held[p.slot]?.vid !== p.vid).length
  const unread = Math.max(0, bt.chat.length - seenChat)
  return (
    <div className="ag-screen ag-screen--bucket bt-lobby">
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">LIVE · 3V3 · FIRST TO 21</span>
          <h1 className="ag-h1">Blacktop</h1>
        </div>
        <button className="ag-round-btn" onClick={() => { bt.leave(); onBack() }} aria-label="Leave the lobby"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <div className="bt-run ag-pop">
          <div className="bt-run-head">
            <span className="bt-run-count"><b>{bt.seated}</b>/{ROOM_SIZE} <small>SPOTS TAKEN</small></span>
            <span className="bt-run-timer">{fmt(bt.waited)}</span>
          </div>
          <div className="bt-court-lines" aria-hidden="true" />
          <div className="bt-squads">
            {[0, 1].map(t => (
              <div key={t} className={`bt-squad-col bt-t${t}${SLOTS.some(sl => sl.team === t && bt.mySlot === sl.id) ? ' is-mine' : ''}`}>
                <span className="bt-squad-title">{squadName(t)}</span>
                {SLOTS.filter(sl => sl.team === t).map((sl, i) => {
                  const h = bt.held[sl.id]
                  const me = h?.vid === bt.me.vid
                  return (
                    <button key={sl.id} className={`bt-spot${h ? ' is-taken' : ' is-open'}${me ? ' is-me' : ''}${sl.pos === 'big' ? ' is-big' : ''}`} style={{ '--d': `${80 + (t * 3 + i) * 50}ms` }} onClick={() => tap(sl)}>
                      {h ? <Av name={h.name} team={t} size={34} /> : <span className="bt-spot-plus">+</span>}
                      <span className="bt-spot-txt">
                        <span className="bt-spot-name">{h ? (me ? 'YOU' : <NameTag name={h.name} cos={h.cos} />) : `JOIN AS ${sl.pos === 'big' ? 'BIG' : 'GUARD'}`}</span>
                        <span className="bt-spot-role">{sl.pos === 'big' ? 'BIG · PF · C' : 'GUARD · PG · SG · SF'}{me ? ' · TAP TO LEAVE' : ''}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            <span className="bt-squads-vs">VS</span>
          </div>
          {bt.bumped && <div className="bt-bumped ag-pop">Someone grabbed that spot first. Pick another.</div>}
          <div className="bt-run-foot">
            {!bt.mySlot
              ? <span className="bt-run-hint">Tap an open spot to join that squad.{waiting > 0 ? ` ${waiting} watching.` : ''}</span>
              : bt.canFill
                ? <button className="ag-btn bt-fill" onClick={() => { bt.fill(); sfx('tap') }}>FILL OPEN SPOTS WITH BOTS <IconArrow size={16} /></button>
                : <span className="bt-run-hint">{bt.seated === ROOM_SIZE ? 'Full run. Lacing up…' : `Starts when all six spots are taken. Bots can fill in ${Math.max(0, FILL_AFTER_SECS - bt.waited)}s.`}</span>}
          </div>
        </div>

        <button className="bt-lobby-chat ag-pop" style={{ '--d': '160ms' }} onClick={() => { setChatOpen(true); setSeenChat(bt.chat.length) }}>
          <IconChat size={18} />
          <span className="bt-lobby-chat-txt">{bt.chat.length ? <><b>{bt.chat[bt.chat.length - 1].from === bt.me.vid ? 'You' : bt.chat[bt.chat.length - 1].name}:</b> {bt.chat[bt.chat.length - 1].text}</> : 'Lobby chat. Call your spot, find a squad.'}</span>
          {unread > 0 && <span className="ag-tab-badge">{unread}</span>}
        </button>

        <OnlineRecord mode="bt" title="YOUR BLACKTOP" />

        <details className="bt-rules ag-pop" style={{ '--d': '200ms' }}>
          <summary className="ag-eyebrow">HOUSE RULES</summary>
          <ul>
            <li>Every squad is two guards and a big. The spot you take is the build you make.</li>
            <li>3:00 to build. Leave or go quiet and the blacktop builds for you, with the ratings off.</li>
            <li>First to <b>21</b>, 1s and 2s, win by 2. Make it, take it.</li>
            <li>Chat is filtered, and anyone can be reported.</li>
          </ul>
        </details>
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
    <div className={`bt-hud${urgent ? ' is-urgent' : ''}${open ? ' is-open' : ''}`}>
      <button className="bt-hud-bar" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="bt-hud-clock">{fmt(bt.clock)}</span>
        <span className="bt-hud-mini">
          <span className="bt-t0"><b>{teamName(bt.match, 0)}</b> {ready(0)}/3</span>
          <i>vs</i>
          <span className="bt-t1"><b>{teamName(bt.match, 1)}</b> {ready(1)}/3</span>
        </span>
        <span className={`bt-hud-caret${open ? ' is-open' : ''}`}>▾</span>
      </button>
      <button className="bt-hud-chat" onClick={onOpenChat} aria-label="Team chat"><IconChat size={18} />{unread > 0 && <span className="ag-tab-badge">{unread}</span>}</button>
      {open && (
        <div className="bt-hud-panel">
          <div className="bt-hud-teams">
            {squads.map((sq, t) => (
              <div key={t} className={`bt-hud-team bt-t${t}${t === bt.myTeam ? ' is-mine' : ''}`}>
                <span className="bt-hud-team-name">{teamName(bt.match, t)}</span>
                {sq.map(p => {
                  const b = bt.builds[p.vid]
                  const here = p.bot || bt.present.some(q => q.vid === p.vid)
                  const ovr = t === bt.myTeam ? liveOvr(b) : null
                  return (
                    <span key={p.vid} className={`bt-hud-p${!here ? ' is-gone' : ''}${b?.done ? ' is-done' : ''}`} title={p.name}>
                      <Av name={p.name} bot={p.bot} team={t} size={24} />
                      <span className="bt-hud-p-name">{p.vid === bt.me.vid ? 'YOU' : p.name} <small>{p.pos === 'big' ? 'BIG' : 'G'}</small></span>
                      <span className="bt-hud-p-bar"><span style={{ width: `${Math.min(100, ((b?.filled ?? 0) / 8) * 100)}%` }} /></span>
                      <span className="bt-hud-p-n">{p.bot ? 'CPU' : !here ? 'AFK' : ovr != null ? <><b>{ovr}</b> OVR</> : b?.done ? '✓' : `${b?.filled ?? 0}/8`}</span>
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
                  <Av name={p.name} bot={p.bot} team={bt.myTeam} size={30} />
                  <span className="bt-sq-txt"><b>{p.vid === bt.me.vid ? 'YOU' : firstName(p.name)}</b><small>{p.pos === 'big' ? 'BIG' : 'GUARD'}</small></span>
                  <span className="bt-sq-ovr">{p.bot ? 'CPU' : ovr ?? '—'}<small>{p.bot || ovr == null ? '' : 'OVR'}</small></span>
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
            <span>{menu.name}</span>
            <button onClick={() => act('report')}>REPORT</button>
            <button onClick={() => act('block')}>BLOCK</button>
            <button onClick={() => setMenu(null)}>CANCEL</button>
          </div>
        )}
        {user ? (
          <>
            <div className="bt-quick">{QUICK.map(q => <button key={q} className="ag-chip" onClick={() => send(q)}>{q}</button>)}</div>
            <form className="bt-chat-form" onSubmit={e => { e.preventDefault(); send(text) }}>
              <input ref={inputRef} value={text} onChange={e => { setText(e.target.value); bt.typing?.() }} maxLength={120} placeholder={mode === 'blacktop-lobby' ? 'Message the lobby…' : 'Message your squad…'} enterKeyHint="send" autoComplete="off" />
              <button className="bt-send" type="submit" disabled={!text.trim()} aria-label="Send"><IconSend size={20} /></button>
            </form>
          </>
        ) : (
          <div className="bt-chat-signin">Sign in to chat. <button onClick={() => window.dispatchEvent(new CustomEvent('bap:auth'))}>Sign in</button></div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ── Game: reveal → live → result ────────────────────────────────────────────
export function BlacktopGame({ bt, user, photoFor, onOpenChat, unread }) {
  const { game, match } = bt
  const [stage, setStage] = useState('reveal')
  const [idx, setIdx] = useState(0)
  const [speed, setSpeed] = useState(1)
  const fired = useRef(false)
  const plays = game?.plays ?? []
  const play = plays[idx]
  const mine = match.players.find(p => p.vid === bt.me.vid)
  const myTeam = mine?.team ?? 0
  const colorFor = t => TEAM_COLORS[t]
  const names = useMemo(() => [teamName(match, 0), teamName(match, 1)], [match])

  useEffect(() => { const t = setTimeout(() => setStage('live'), 4200); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (stage !== 'live' || !game) return
    if (idx >= plays.length - 1) {
      if (!fired.current) {
        fired.current = true
        const won = game.winner === myTeam
        setTimeout(() => { if (won) victory(); else sfx('pop'); setStage('result'); bt.finish() }, 2200)
      }
      return
    }
    const t = setTimeout(() => setIdx(i => i + 1), playDelay(play, idx === 0) / speed)
    return () => clearTimeout(t)
  }, [stage, idx, speed, game, plays.length]) // eslint-disable-line
  useEffect(() => {
    if (!play) return
    if (play.type === 'score') { setTimeout(() => { sfx(play.pts === 2 ? 'lock' : 'tap'); if (play.team === myTeam) haptic('light') }, 900) }
    else if (play.type === 'block' || play.type === 'steal') setTimeout(() => sfx('pop'), 700)
  }, [idx]) // eslint-disable-line
  if (!game) return null

  const score = play?.score ?? [0, 0]
  const feed = plays.slice(0, idx + 1).filter(p => p.type !== 'check').slice(-4).reverse()
  const squads = [0, 1].map(t => game.teams[t])

  if (stage === 'reveal') {
    return (
      <div className="ag-screen ag-screen--bucket bt-game">
        <div className="bt-reveal">
          <span className="ag-eyebrow">BLACKTOP · FIRST TO 21</span>
          <div className="bt-reveal-grid">
            {squads.map((sq, t) => (
              <div key={t} className={`bt-squad bt-t${t} ag-pop`} style={{ '--d': `${t * 160}ms` }}>
                <span className="bt-squad-name">{names[t]}</span>
                {sq.map(p => (
                  <div key={p.id} className="bt-squad-p">
                    <Av name={p.name} bot={p.bot} team={t} size={34} />
                    <span className="bt-squad-p-txt"><b>{p.id === bt.me.vid ? 'YOU' : p.name}{captainOf(match, t)?.vid === p.id ? ' · C' : ''}</b><small>{p.pos === 'big' ? 'BIG' : 'GUARD'} · {ROLES.find(r => r.id === p.role)?.name ?? 'BALANCED'}</small></span>
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
    const votes = bt.rematchVotes.size
    const humans = match.players.filter(p => !p.bot).length
    return (
      <div className="ag-screen ag-screen--bucket bt-game">
        <div className="ag-screen-body">
          <div className={`bt-result-hero ${won ? 'is-win' : 'is-loss'} ag-pop`}>
            <span className="ag-eyebrow">{won ? 'BLACKTOP · W' : 'BLACKTOP · L'}</span>
            <h1 className="ag-h1">{won ? 'Your squad took it' : 'They took it'}</h1>
            <div className="bt-final"><b className="bt-t0">{game.score[0]}</b><span>–</span><b className="bt-t1">{game.score[1]}</b></div>
            <div className="bt-final-teams"><span className="bt-t0">{names[0]}</span><span className="bt-t1">{names[1]}</span></div>
            {mvp && <div className="bt-mvp"><IconStar size={14} /> MVP · {mvp.vid === bt.me.vid ? 'YOU' : mvp.name}</div>}
            <RatingLine mode="bt" />
          </div>
          {[game.winner, 1 - game.winner].map(t => (
            <div key={t} className={`ag-card bt-box bt-t${t} ag-pop`} style={{ '--d': `${120 + t * 80}ms` }}>
              <div className="bt-box-head"><span>{names[t]}</span><span>PTS</span><span>FG</span><span>AST</span><span>REB</span><span>STL</span><span>BLK</span></div>
              {game.teams[t].map(p => { const s = game.stats[p.id]; return (
                <div key={p.id} className={`bt-box-row${p.id === bt.me.vid ? ' is-me' : ''}${p.id === game.mvp ? ' is-mvp' : ''}`}>
                  <span className="bt-box-name">{p.id === bt.me.vid ? 'YOU' : p.name}</span>
                  <span><b>{s.pts}</b></span><span>{s.fgm}/{s.fga}</span><span>{s.ast}</span><span>{s.reb}</span><span>{s.stl}</span><span>{s.blk}</span>
                </div>
              ) })}
            </div>
          ))}
          <div className="bt-result-actions ag-pop" style={{ '--d': '300ms' }}>
            {humans > 1 && (
              <button className="ag-btn" onClick={() => { bt.voteRematch(); sfx('tap') }} disabled={bt.rematchVotes.has(bt.me.vid)}>
                {bt.rematchVotes.has(bt.me.vid) ? `WAITING FOR SQUADS · ${votes}/${humans}` : `RUN IT BACK${votes ? ` · ${votes}/${humans}` : ''}`}
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
        <div className={`bt-board-side bt-t0${score[0] > score[1] ? ' is-lead' : ''}`}><span className="bt-board-name">{names[0]}{myTeam === 0 ? ' · YOU' : ''}</span><b>{score[0]}</b></div>
        <div className="bt-board-mid"><span className="ag-eyebrow">FIRST TO 21</span><button className={`ag-chip${speed === 2 ? ' is-on' : ''}`} onClick={() => setSpeed(s => (s === 1 ? 2 : 1))}>{speed}×</button></div>
        <div className={`bt-board-side bt-t1${score[1] > score[0] ? ' is-lead' : ''}`}><span className="bt-board-name">{names[1]}{myTeam === 1 ? ' · YOU' : ''}</span><b>{score[1]}</b></div>
      </div>
      <BlacktopCourt game={game} play={play} meId={bt.me.vid} photoFor={photoFor} colorFor={colorFor} speed={speed} />
      <div className="bt-feed">
        {feed.map((p, i) => <div key={p.id} className={`bt-feed-line bt-t${p.team}${i === 0 ? ' is-now' : ''}${p.big ? ' is-big' : ''}${p.type === 'milestone' ? ' is-ms' : ''}`}>{p.text}</div>)}
      </div>
      {onOpenChat && <button className="bt-live-chat" onClick={onOpenChat}><IconChat size={18} />{unread > 0 && <span className="ag-tab-badge">{unread}</span>}</button>}
    </div>
  )
}
