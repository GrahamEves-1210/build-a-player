import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ROOM_SIZE, FILL_AFTER_SECS, TEAM_NAMES, ROLES } from '../../lib/blacktop'
import { playDelay } from '../../lib/hoops'
import { QUICK, block, report } from '../../lib/chat'
import { sfx, haptic, confetti } from '../../lib/juice'
import { IconClose, IconArrow, IconChat, IconProfile, IconStar } from './icons'

// BLACKTOP screens. The match itself lives in lib/blacktop.js (useBlacktop);
// these only draw it: the queue, the HUD over the build, team chat, the game.

const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const Av = ({ name, bot, team, size = 36 }) => (
  <span className={`bt-av${bot ? ' is-bot' : ''} bt-av--t${team ?? 0}`} style={{ width: size, height: size, fontSize: size * .46 }}>{bot ? 'CPU' : (name || '?').slice(0, 1).toUpperCase()}</span>
)

// ── Queue ────────────────────────────────────────────────────────────────────
export function BlacktopQueue({ bt, onBack }) {
  const slots = Array.from({ length: ROOM_SIZE }, (_, i) => bt.queue[i] ?? null)
  const others = Math.max(0, bt.queue.length - 1)
  return (
    <div className="ag-screen ag-screen--bucket bt-queue">
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">LIVE · 3V3</span>
          <h1 className="ag-h1">Blacktop</h1>
        </div>
        <button className="ag-round-btn" onClick={() => { bt.leave(); onBack() }} aria-label="Leave queue"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <div className="bt-court-bg ag-pop">
          <span className="ag-eyebrow">FINDING A RUN</span>
          <div className="bt-queue-count"><b>{bt.queue.length}</b><small>/{ROOM_SIZE}</small></div>
          <div className="bt-queue-sub">{others === 0 ? 'You\'re first on the court. Others will show up here.' : `${others} other${others > 1 ? 's' : ''} waiting · game starts at ${ROOM_SIZE}`}</div>
          <div className="bt-slots">
            {slots.map((p, i) => (
              <div key={p?.vid ?? `empty-${i}`} className={`bt-slot${p ? ' is-on' : ''}${p?.vid === bt.me.vid ? ' is-me' : ''}`} style={{ '--d': `${i * 60}ms` }}>
                {p ? <Av name={p.name} size={44} /> : <span className="bt-slot-empty"><IconProfile size={20} /></span>}
                <span className="bt-slot-name">{p ? (p.vid === bt.me.vid ? 'YOU' : p.name) : 'OPEN'}</span>
                <span className="bt-slot-pos">{p ? (p.pos === 'big' ? 'BIG' : 'GUARD') : '—'}</span>
              </div>
            ))}
          </div>
          <div className="bt-queue-timer">{fmt(bt.waited)}</div>
        </div>
        {bt.canFill ? (
          <button className="ag-btn bt-fill ag-pop" onClick={bt.fill}>FILL WITH BOTS <IconArrow size={16} /></button>
        ) : (
          <div className="bt-fill-note">{bt.waited < FILL_AFTER_SECS ? `Bots can fill the run in ${FILL_AFTER_SECS - bt.waited}s` : 'Full squad — dealing teams…'}</div>
        )}
        <div className="bt-rules ag-pop" style={{ '--d': '120ms' }}>
          <div className="ag-eyebrow">HOUSE RULES</div>
          <ul>
            <li>Two squads of three, <b>SHIRTS</b> vs <b>SKINS</b>. Teams are dealt — a big on each side when there is one.</li>
            <li>3:00 to build. Leave or go quiet and the blacktop builds for you — with the ratings off.</li>
            <li>First to <b>21</b>, 1s and 2s, win by 2. Make it, take it.</li>
            <li>Team chat is for your squad. Keep it clean — it's filtered, and anyone can be reported.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── HUD over the build (sticky under the top bar) ────────────────────────────
export function BlacktopHud({ bt, onOpenChat, unread }) {
  const squads = [0, 1].map(t => bt.match.players.filter(p => p.team === t))
  const urgent = bt.clock <= 20
  return (
    <div className={`bt-hud${urgent ? ' is-urgent' : ''}`}>
      <div className="bt-hud-top">
        <span className="bt-hud-clock">{fmt(bt.clock)}</span>
        <span className="bt-hud-title">BLACKTOP · YOU'RE <b className={`bt-t${bt.myTeam}`}>{TEAM_NAMES[bt.myTeam]}</b></span>
        <button className="bt-hud-chat" onClick={onOpenChat} aria-label="Team chat"><IconChat size={18} />{unread > 0 && <span className="ag-tab-badge">{unread}</span>}</button>
      </div>
      <div className="bt-hud-teams">
        {squads.map((sq, t) => (
          <div key={t} className={`bt-hud-team bt-t${t}${t === bt.myTeam ? ' is-mine' : ''}`}>
            <span className="bt-hud-team-name">{TEAM_NAMES[t]}</span>
            {sq.map(p => {
              const b = bt.builds[p.vid]
              const here = p.bot || bt.present.some(q => q.vid === p.vid)
              const total = p.pos === 'big' ? 8 : 8
              return (
                <span key={p.vid} className={`bt-hud-p${!here ? ' is-gone' : ''}${b?.done ? ' is-done' : ''}`} title={p.name}>
                  <Av name={p.name} bot={p.bot} team={t} size={24} />
                  <span className="bt-hud-p-name">{p.vid === bt.me.vid ? 'YOU' : p.name}</span>
                  <span className="bt-hud-p-bar"><span style={{ width: `${Math.min(100, ((b?.filled ?? 0) / total) * 100)}%` }} /></span>
                  <span className="bt-hud-p-n">{p.bot ? 'CPU' : !here ? 'AFK' : b?.done ? '✓' : `${b?.filled ?? 0}/${total}`}</span>
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div className="bt-roles">
        {ROLES.map(r => <button key={r.id} className={`ag-chip${bt.role === r.id ? ' is-on' : ''}`} onClick={() => bt.setRole(r.id)} title={r.sub}>{r.name}</button>)}
      </div>
    </div>
  )
}

// ── Team chat sheet ──────────────────────────────────────────────────────────
export function BlacktopChat({ bt, user, onClose, mode = 'blacktop', title = 'TEAM CHAT' }) {
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(null)      // message with the report/block menu open
  const [note, setNote] = useState('')
  const listRef = useRef(null)
  useEffect(() => { listRef.current?.scrollTo({ top: 1e6 }) }, [bt.chat.length])
  const send = t => { if (bt.sendChat(t)) { setText(''); sfx('tap') } }
  const act = async kind => {
    const m = menu; setMenu(null)
    if (!m) return
    if (kind === 'block') { block(m.uid); setNote(`${m.name} blocked — you won't see their messages.`) }
    else { const ok = await report({ room: bt.match?.code, mode, offender: { name: m.name, uid: m.uid, vid: m.from }, text: m.text, user }); setNote(ok ? 'Reported. Thanks — we review every report.' : 'Could not send the report. Try again.') }
    setTimeout(() => setNote(''), 3000)
  }
  return createPortal(
    <div className="ag-menu-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ag-menu bt-chat" role="dialog" aria-label="Team chat">
        <div className="ag-menu-head">
          <span />
          <h2 className="ag-menu-title">{title}</h2>
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
        <div className="bt-chat-list" ref={listRef}>
          {bt.chat.length === 0 && <div className="ag-board-empty">Say what's up to your squad.</div>}
          {bt.chat.map(m => (
            <div key={m.id} className={`bt-msg${m.from === bt.me.vid ? ' is-me' : ''}`} onContextMenu={e => { e.preventDefault(); if (m.from !== bt.me.vid) setMenu(m) }}>
              <span className="bt-msg-name" onClick={() => m.from !== bt.me.vid && setMenu(m)}>{m.from === bt.me.vid ? 'YOU' : m.name}{m.all && <i> · ALL</i>}</span>
              <span className="bt-msg-text">{m.text}</span>
            </div>
          ))}
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
              <input value={text} onChange={e => setText(e.target.value)} maxLength={120} placeholder="Message your squad…" />
              <button className="ag-btn" type="submit" disabled={!text.trim()}>SEND</button>
            </form>
          </>
        ) : (
          <div className="bt-chat-signin">Sign in to chat with your squad. <button onClick={() => window.dispatchEvent(new CustomEvent('bap:auth'))}>Sign in</button></div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ── Court: 3 on 3, the ball with its handler ────────────────────────────────
const SPOTS = [[[22, 72], [50, 58], [78, 72]], [[30, 84], [50, 72], [70, 84]]]   // offense, defense (percent of court box)
function Court({ game, play, poss, photoFor }) {
  const off = game.teams[poss], def = game.teams[1 - poss]
  const ballOn = play?.pid && (play.type === 'score' || play.type === 'miss') ? play.pid : play?.pid2 && play.type === 'steal' ? null : play?.pid
  const rimShot = play?.type === 'score' || play?.type === 'miss' || play?.type === 'block'
  return (
    <div className={`bt-court bt-court--poss${poss}`}>
      <div className="bt-court-key" /><div className="bt-court-arc" /><div className="bt-rim" />
      {off.map((p, i) => <Chip key={p.id} p={p} team={poss} pos={SPOTS[0][i] ?? SPOTS[0][0]} ball={ballOn === p.id} photoFor={photoFor} shooting={rimShot && play.pid === p.id} />)}
      {def.map((p, i) => <Chip key={p.id} p={p} team={1 - poss} pos={SPOTS[1][i] ?? SPOTS[1][0]} photoFor={photoFor} act={play?.type === 'block' || play?.type === 'steal' ? play.pid === p.id : false} />)}
      {rimShot && <span key={play.id} className={`bt-ball-fly${play.type === 'score' ? ' is-in' : ' is-out'}`} />}
      {play?.type === 'score' && <span key={`f${play.id}`} className={`bt-rim-flash${play.pts === 2 ? ' is-two' : ''}`}>{play.pts === 2 ? '+2' : '+1'}</span>}
    </div>
  )
}
function Chip({ p, team, pos, ball, shooting, act, photoFor }) {
  const photo = photoFor?.(p)
  return (
    <span className={`bt-chip bt-t${team}${ball ? ' has-ball' : ''}${shooting ? ' is-shooting' : ''}${act ? ' is-act' : ''}`} style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}>
      <span className="bt-chip-av">{photo ? <img src={photo} alt="" /> : (p.name || '?').slice(0, 1)}</span>
      <span className="bt-chip-name">{p.name.split(' ')[0]}</span>
      {ball && <span className="bt-chip-ball" />}
    </span>
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

  useEffect(() => { const t = setTimeout(() => setStage('live'), 4200); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (stage !== 'live' || !game) return
    if (idx >= plays.length - 1) {
      if (!fired.current) {
        fired.current = true
        const won = game.winner === myTeam
        setTimeout(() => { if (won) { sfx('award'); haptic('success'); confetti(160) } else sfx('pop'); setStage('result'); bt.finish() }, 1800)
      }
      return
    }
    const t = setTimeout(() => setIdx(i => i + 1), playDelay(play, idx === 0) / speed)
    return () => clearTimeout(t)
  }, [stage, idx, speed, game, plays.length]) // eslint-disable-line
  useEffect(() => {
    if (!play) return
    if (play.type === 'score') { sfx(play.pts === 2 ? 'lock' : 'tap'); if (play.team === myTeam) haptic('light') }
    else if (play.type === 'block' || play.type === 'steal') sfx('pop')
  }, [idx]) // eslint-disable-line
  if (!game) return null

  const score = play?.score ?? [0, 0]
  const feed = plays.slice(0, idx + 1).filter(p => p.type !== 'check').slice(-4).reverse()
  const squads = [0, 1].map(t => game.teams[t])
  const nameOf = id => match.players.find(p => p.vid === id)?.name ?? '?'

  if (stage === 'reveal') {
    return (
      <div className="ag-screen ag-screen--bucket bt-game">
        <div className="bt-reveal">
          <span className="ag-eyebrow">BLACKTOP · FIRST TO 21</span>
          <div className="bt-reveal-grid">
            {squads.map((sq, t) => (
              <div key={t} className={`bt-squad bt-t${t} ag-pop`} style={{ '--d': `${t * 160}ms` }}>
                <span className="bt-squad-name">{TEAM_NAMES[t]}</span>
                {sq.map(p => (
                  <div key={p.id} className="bt-squad-p">
                    <Av name={p.name} bot={p.bot} team={t} size={34} />
                    <span className="bt-squad-p-txt"><b>{p.id === bt.me.vid ? 'YOU' : p.name}</b><small>{p.pos === 'big' ? 'BIG' : 'GUARD'} · {ROLES.find(r => r.id === p.role)?.name ?? 'BALANCED'}</small></span>
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
            <div className="bt-final-teams"><span className="bt-t0">{TEAM_NAMES[0]}</span><span className="bt-t1">{TEAM_NAMES[1]}</span></div>
            {mvp && <div className="bt-mvp"><IconStar size={14} /> MVP · {mvp.vid === bt.me.vid ? 'YOU' : mvp.name}</div>}
          </div>
          {[game.winner, 1 - game.winner].map(t => (
            <div key={t} className={`ag-card bt-box bt-t${t} ag-pop`} style={{ '--d': `${120 + t * 80}ms` }}>
              <div className="bt-box-head"><span>{TEAM_NAMES[t]}</span><span>PTS</span><span>FG</span><span>AST</span><span>REB</span><span>STL</span><span>BLK</span></div>
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
        <div className={`bt-board-side bt-t0${score[0] > score[1] ? ' is-lead' : ''}`}><span className="bt-board-name">{TEAM_NAMES[0]}{myTeam === 0 ? ' · YOU' : ''}</span><b>{score[0]}</b></div>
        <div className="bt-board-mid"><span className="ag-eyebrow">FIRST TO 21</span><button className={`ag-chip${speed === 2 ? ' is-on' : ''}`} onClick={() => setSpeed(s => (s === 1 ? 2 : 1))}>{speed}×</button></div>
        <div className={`bt-board-side bt-t1${score[1] > score[0] ? ' is-lead' : ''}`}><span className="bt-board-name">{TEAM_NAMES[1]}{myTeam === 1 ? ' · YOU' : ''}</span><b>{score[1]}</b></div>
      </div>
      <Court game={game} play={play} poss={play?.poss ?? 0} photoFor={photoFor} />
      <div className="bt-feed">
        {feed.map((p, i) => <div key={p.id} className={`bt-feed-line bt-t${p.team}${i === 0 ? ' is-now' : ''}${p.big ? ' is-big' : ''}${p.type === 'milestone' ? ' is-ms' : ''}`}>{p.text}</div>)}
      </div>
      {onOpenChat && <button className="bt-live-chat" onClick={onOpenChat}><IconChat size={18} />{unread > 0 && <span className="ag-tab-badge">{unread}</span>}</button>}
      <span hidden>{nameOf('')}</span>
    </div>
  )
}
