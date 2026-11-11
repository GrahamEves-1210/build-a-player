import { useState } from 'react'
import { LiveLeaveButton } from './LiveLeave'
import { NameTag, AvatarBadge } from './NameTag'
import { liveOvr } from './AppBlacktop'
import BlacktopSheet from './BlacktopSheet'
import { sfx, haptic } from '../../lib/juice'
import { IconCheck } from './icons'
import './blacktop-theme.css'
import './blacktop-lobby.css'
import './blacktop-1v1.css'

// BLACKTOP 1V1, drawn like the 3v3: each player is their profile picture and
// username (with their equipped look), never "you" or a player headshot. Me on
// the left in the first team's blue, the opponent on the right in red.

// A signed-in player's 1v1 id is "<account id>-<session id>"; a guest's is just the session id
export const uidFromVsId = id => (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i.test(id) ? id.slice(0, 36) : null)
export const firstName = n => (n || '').trim().split(/\s+/)[0].toUpperCase().slice(0, 10)
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const posLabel = pos => (pos === 'big' ? 'BIG' : pos === 'guard' ? 'GUARD' : '')
const recordLabel = r => (r ? `${r.wins ?? 0}W – ${r.losses ?? 0}L` : null)

// who: { name, self?, cos?, uid? } — mine (self) or theirs (shared look, else by account)
export function WhoAv({ who, team = 0, size = 34 }) {
  return <AvatarBadge name={who.name} self={!!who.self} cos={who.self ? null : who.cos || null} uid={who.self ? null : who.uid || null} size={size} className={`bt-avb bt-av--t${team}`} />
}
export function WhoName({ who, plate = true, short = false }) {
  return <NameTag name={short ? firstName(who.name) : who.name} self={!!who.self} cos={who.self ? null : who.cos || null} uid={who.self ? null : who.uid || null} plate={plate} />
}

// One player's spot: the lobby's plate (picture, name, a line under it)
export function VersusSpot({ who, team = 0, sub = '' }) {
  return (
    <div className={`btl-seat is-taken${who.self ? ' is-me' : ''}`}>
      <WhoAv who={who} team={team} size={40} />
      <span className="btl-seat-txt">
        <span className="btl-seat-name"><WhoName who={who} /></span>
        {sub && <span className="btl-seat-role">{sub}</span>}
      </span>
    </div>
  )
}
// The empty side while we wait for the opponent: a light runs the slot while we look
export function OpenSpot({ title, sub = '' }) {
  return (
    <div className="btl-seat is-open is-search">
      <span className="btl-scan ip-fx" aria-hidden="true" />
      <span className="btl-seat-plus">?</span>
      <span className="btl-seat-txt">
        <span className="btl-seat-name">{title}</span>
        {sub && <span className="btl-seat-role">{sub}</span>}
      </span>
    </div>
  )
}

// ── The 1v1 lobby's board (VersusLobby): me, and the opponent's side (open until found) ──
// left / right: a VersusSpot or an OpenSpot; code: a friend game's code to send; timer: the search clock
export function VersusBoard({ found = false, timer = null, code = null, onCopy = null, left, right, hint = null }) {
  return (
    <section className={`btl-board btl-board--v1${found ? ' is-full' : ''}`}>
      <div className="btl-board-lines" aria-hidden="true" />
      <div className="btl-board-head">
        <span className="btl-count"><b>{found ? 2 : 1}</b><i>/2</i><small>{found ? <>GAME<br />ON</> : <>SPOTS<br />TAKEN</>}</small></span>
        <span className="btl-pips" aria-hidden="true"><i className="bt-t0 is-on" /><i className="is-gap" /><i className={`bt-t1${found ? ' is-on' : ''}`} /></span>
        <span className="btl-board-meta">{timer && <span className="btl-timer">{timer}</span>}</span>
      </div>
      {code && (
        <div className="btl-codecard">
          <small>SEND THIS CODE TO A FRIEND</small>
          <b>{code}</b>
          <button className="ag-btn btl-btn btl-btn--line" onClick={onCopy}>COPY CODE</button>
        </div>
      )}
      <div className="btl-teams">
        <div className="btl-team bt-t0 is-mine">{left}</div>
        <div className="btl-team bt-t1">{right}</div>
        <span className="btl-vs" aria-hidden="true">VS</span>
      </div>
      <div className="btl-board-foot" role="status">
        {found
          ? <span className="btl-tip"><b>GAME ON</b>{hint && <small>{hint}</small>}</span>
          : <span className="btl-wait"><span className="btl-dots"><i /><i /><i /></span>{hint}</span>}
      </div>
    </section>
  )
}

// ── Build HUD: the 3v3's slim bar over the build, tap for both players ──────
// me / opp: { name, self?, cos?, uid?, build, types, pos }
// (devOpen: the DEV look page opens the panel; it does nothing in a build that ships)
export function VersusHud({ me, opp, clock = null, devOpen = false }) {
  const [open, setOpen] = useState(import.meta.env.DEV && devOpen)
  const filled = s => s.types.filter(t => s.build?.[t]).length
  const sides = [me, opp]
  const urgent = clock != null && clock <= 20
  const bothReady = sides.every(s => s.pos && filled(s) === s.types.length)
  return (
    <div className={`bt-hud v1g-hud has-leave${urgent ? ' is-urgent' : ''}${open ? ' is-open' : ''}`}>
      <button className="bt-hud-bar" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="bt-hud-clock">{clock != null ? fmt(clock) : '1V1'}</span>
        <span className="bt-hud-mini">
          {sides.map((s, t) => (
            <span key={t} className={`bt-t${t} v1g-hud-who`}>
              <b><WhoName who={s} short plate={false} /></b> {filled(s)}/{s.types.length}
            </span>
          ))}
        </span>
        {bothReady ? <span className="v1g-hud-go">TIP-OFF</span> : <span className={`bt-hud-caret${open ? ' is-open' : ''}`}>▾</span>}
      </button>
      <LiveLeaveButton />
      {open && (
        <div className="bt-hud-panel">
          <div className="bt-hud-teams">
            {sides.map((s, t) => {
              const n = filled(s)
              const ovr = s.self ? liveOvr({ build: s.build, pos: s.pos }) : null
              const done = n === s.types.length
              return (
                <div key={t} className={`bt-hud-team bt-t${t}${s.self ? ' is-mine' : ''}`}>
                  <span className="bt-hud-team-name">{s.pos ? posLabel(s.pos) : 'PICKING A SPOT'}</span>
                  <span className={`bt-hud-p${done ? ' is-done' : ''}`} title={s.name}>
                    <WhoAv who={s} team={t} size={24} />
                    <span className="bt-hud-p-name"><WhoName who={s} /></span>
                    <span className="bt-hud-p-bar"><span style={{ width: `${Math.min(100, (n / s.types.length) * 100)}%` }} /></span>
                    <span className="bt-hud-p-n">{ovr != null ? <><b>{ovr}</b> OVR</> : done ? <IconCheck size={13} /> : `${n}/${s.types.length}`}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <div className="v1g-hud-note">{bothReady ? 'Both builds in. Tip-off…' : 'Tips off when both builds are in. First to 11.'}</div>
        </div>
      )}
    </div>
  )
}

// ── Matchup: who you drew, face to face, then take a spot (guard or big) ────
// me / opp: { name, self?, cos?, uid?, record }
export function VersusMatchup({ me, opp, oppPos = null, onPick }) {
  const side = (who, t, pos) => (
    <div className={`btl-face bt-t${t}`}>
      <WhoAv who={who} team={t} size={64} />
      <span className="btl-face-name"><WhoName who={who} /></span>
      <span className="btl-face-sub">{recordLabel(who.record) ?? '1V1'}{pos && <small>{posLabel(pos)}</small>}</span>
    </div>
  )
  return (
    <BlacktopSheet label="1v1 matchup" title="1V1 · FIRST TO 11">
      <div className="btl-faceoff">
        {side(me, 0, null)}
        {side(opp, 1, oppPos)}
        <span className="btl-faceoff-vs" aria-hidden="true">VS</span>
      </div>
      <div className="btl-sec"><span className="btl-sec-title">TAKE A SPOT</span></div>
      <div className="btl-picks">
        {['guard', 'big'].map(pos => (
          <button key={pos} className="btl-pick" onClick={() => { sfx('slot'); haptic('medium'); onPick(pos) }} aria-label={`Join as ${pos === 'big' ? 'big' : 'guard'}`}>
            <b>{pos === 'big' ? 'BIG' : 'GUARD'}</b>
            <small>{pos === 'big' ? 'PF · C' : 'PG · SG · SF'}</small>
          </button>
        ))}
      </div>
    </BlacktopSheet>
  )
}

// ── Leave mid-game? With who you'd be walking out on ────────────────────────
// opp: { name, cos?, uid? } (null if we never learned who)
export function VersusLeaveSheet({ opp, onStay, onLeave }) {
  const who = opp ?? { name: 'Guest' }
  return (
    <BlacktopSheet label="Leave the 1v1?" title="LEAVE THE 1V1?" onClose={onStay} closeLabel="Stay in the game">
      <div className="bt-t1"><VersusSpot who={who} team={1} sub="STILL ON THE COURT" /></div>
      <p className="btl-sheet-note">Leaving mid-game counts as a loss on your record, and <WhoName who={who} plate={false} /> takes the W.</p>
      <div className="btl-sheet-acts">
        <button className="ag-btn btl-btn" onClick={() => { sfx('tap'); onStay() }}>STAY IN THE GAME</button>
        <button className="ag-btn btl-btn btl-btn--line btl-btn--warn" onClick={() => { sfx('tap'); onLeave() }}>LEAVE &amp; TAKE THE L</button>
      </div>
    </BlacktopSheet>
  )
}

// ── The opponent walked off during the build: they left, the W goes to me ──
// opp: { name, cos?, uid? }; me: { name, self: true }
export function VersusOppLeftSheet({ opp, me, onDone }) {
  const who = opp ?? { name: 'Guest' }
  return (
    <BlacktopSheet label="Match over" title="MATCH OVER">
      <div className="btl-over">
        <div className="btl-over-row is-gone bt-t1">
          <WhoAv who={who} team={1} size={44} />
          <span className="btl-over-who"><WhoName who={who} /><small>LEFT THE BLACKTOP</small></span>
        </div>
        <div className="btl-over-row is-w bt-t0">
          <WhoAv who={me} team={0} size={44} />
          <span className="btl-over-who"><WhoName who={me} /><small>TAKES THE WIN</small></span>
          <span className="btl-over-w" aria-label="Win">W</span>
        </div>
      </div>
      <div className="btl-sheet-acts">
        <button className="ag-btn btl-btn" onClick={() => { sfx('tap'); onDone() }}>DONE</button>
      </div>
    </BlacktopSheet>
  )
}
