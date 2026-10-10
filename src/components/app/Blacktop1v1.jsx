import { useState } from 'react'
import { NameTag, AvatarBadge } from './NameTag'
import { liveOvr } from './AppBlacktop'
import { sfx, haptic } from '../../lib/juice'
import { IconClose } from './icons'
import './blacktop-1v1.css'

// BLACKTOP 1V1, drawn like the 3v3: each player is their profile picture and
// username (with their equipped look), never "you" or a player headshot. Me on
// the left in the 3v3's first-team white, the opponent on the right in orange.

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

// One player's spot, the 3v3 lobby's spot card
export function VersusSpot({ who, team = 0, sub = '', d = 0 }) {
  return (
    <div className={`bt-spot is-taken${who.self ? ' is-me' : ''}`} style={{ '--d': `${d}ms` }}>
      <WhoAv who={who} team={team} size={34} />
      <span className="bt-spot-txt">
        <span className="bt-spot-name"><WhoName who={who} /></span>
        {sub && <span className="bt-spot-role">{sub}</span>}
      </span>
    </div>
  )
}
// The empty side while we wait for the opponent
export function OpenSpot({ title, sub = '' }) {
  return (
    <div className="bt-spot is-open v1g-open">
      <span className="bt-spot-plus">+</span>
      <span className="bt-spot-txt">
        <span className="bt-spot-name">{title}</span>
        {sub && <span className="bt-spot-role">{sub}</span>}
      </span>
    </div>
  )
}

// ── Build HUD: the 3v3's slim bar over the build, tap for both players ──────
// me / opp: { name, self?, cos?, uid?, build, types, pos }
export function VersusHud({ me, opp, clock = null }) {
  const [open, setOpen] = useState(false)
  const filled = s => s.types.filter(t => s.build?.[t]).length
  const sides = [me, opp]
  const urgent = clock != null && clock <= 20
  const bothReady = sides.every(s => s.pos && filled(s) === s.types.length)
  return (
    <div className={`bt-hud v1g-hud${urgent ? ' is-urgent' : ''}${open ? ' is-open' : ''}`}>
      <button className="bt-hud-bar" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="bt-hud-clock">{clock != null ? fmt(clock) : '1V1'}</span>
        <span className="bt-hud-mini">
          {sides.map((s, t) => (
            <span key={t} className={`bt-t${t} v1g-hud-who`}>
              <WhoAv who={s} team={t} size={20} />
              <b><WhoName who={s} plate={false} short /></b> {filled(s)}/{s.types.length}
              {t === 0 && <i>vs</i>}
            </span>
          ))}
        </span>
        {bothReady ? <span className="v1g-hud-go">TIP-OFF</span> : <span className={`bt-hud-caret${open ? ' is-open' : ''}`}>▾</span>}
      </button>
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
                    <span className="bt-hud-p-name"><WhoName who={s} plate={false} /></span>
                    <span className="bt-hud-p-bar"><span style={{ width: `${Math.min(100, (n / s.types.length) * 100)}%` }} /></span>
                    <span className="bt-hud-p-n">{ovr != null ? <><b>{ovr}</b> OVR</> : done ? '✓' : `${n}/${s.types.length}`}</span>
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

// ── Matchup: who you drew, then take a spot (guard or big) ──────────────────
// me / opp: { name, self?, cos?, uid?, record }
export function VersusMatchup({ me, opp, oppPos = null, onPick }) {
  return (
    <div className="bt-sheet-overlay v1g-sheet-overlay">
      <div className="bt-sheet v1g-sheet" role="dialog" aria-label="1v1 matchup">
        <div className="bt-sheet-grab" />
        <div className="bt-sheet-head">
          <h2 className="bt-sheet-title">1V1 · FIRST TO 11</h2>
        </div>
        <div className="bt-squads v1g-squads">
          <div className="bt-squad-col bt-t0 is-mine"><VersusSpot who={me} team={0} sub={recordLabel(me.record) ?? ''} d={60} /></div>
          <div className="bt-squad-col bt-t1"><VersusSpot who={opp} team={1} sub={[recordLabel(opp.record), oppPos ? posLabel(oppPos) : ''].filter(Boolean).join(' · ') || '1V1'} d={120} /></div>
          <span className="bt-squads-vs">VS</span>
        </div>
        <span className="ag-eyebrow v1g-pick-lbl">TAKE A SPOT</span>
        <div className="v1g-pick bt-t0">
          {['guard', 'big'].map((pos, i) => (
            <button key={pos} className={`bt-spot is-open${pos === 'big' ? ' is-big' : ''}`} style={{ '--d': `${180 + i * 60}ms` }}
              onClick={() => { sfx('slot'); haptic('medium'); onPick(pos) }}>
              <span className="bt-spot-plus">+</span>
              <span className="bt-spot-txt">
                <span className="bt-spot-name">JOIN AS {pos === 'big' ? 'BIG' : 'GUARD'}</span>
                <span className="bt-spot-role">{pos === 'big' ? 'BIG · PF · C' : 'GUARD · PG · SG · SF'}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Leave mid-game? The 3v3's sheet, with who you'd be walking out on ────────
// opp: { name, cos?, uid? } (null if we never learned who)
export function VersusLeaveSheet({ opp, onStay, onLeave }) {
  const who = opp ?? { name: 'Guest' }
  return (
    <div className="bt-sheet-overlay v1g-sheet-overlay" onClick={e => e.target === e.currentTarget && onStay()}>
      <div className="bt-sheet v1g-sheet" role="dialog" aria-label="Leave the 1v1?">
        <div className="bt-sheet-grab" onClick={onStay} />
        <div className="bt-sheet-head">
          <h2 className="bt-sheet-title">LEAVE THE 1V1?</h2>
          <button className="ag-round-btn" onClick={onStay} aria-label="Stay in the game"><IconClose size={16} /></button>
        </div>
        <div className="bt-t1 v1g-solo"><VersusSpot who={who} team={1} sub="STILL ON THE COURT" /></div>
        <p className="v1g-sheet-note">Leaving mid-game counts as a loss on your record, and <WhoName who={who} plate={false} /> takes the W.</p>
        <div className="bt-result-actions v1g-sheet-actions">
          <button className="ag-btn" onClick={() => { sfx('tap'); onStay() }}>STAY IN THE GAME</button>
          <button className="ag-btn ag-btn--ghost v1g-leave" onClick={() => { sfx('tap'); onLeave() }}>LEAVE &amp; TAKE THE L</button>
        </div>
      </div>
    </div>
  )
}

// ── The opponent walked off during the build: they left, the W goes to me ──
// opp: { name, cos?, uid? }; me: { name, self: true }
export function VersusOppLeftSheet({ opp, me, onDone }) {
  const who = opp ?? { name: 'Guest' }
  return (
    <div className="bt-sheet-overlay v1g-sheet-overlay">
      <div className="bt-sheet v1g-sheet" role="dialog" aria-label="Match over">
        <div className="bt-sheet-grab" />
        <div className="bt-sheet-head">
          <h2 className="bt-sheet-title">MATCH OVER</h2>
        </div>
        <div className="v1g-gone bt-t1">
          <WhoAv who={who} team={1} size={56} />
          <span className="v1g-gone-name"><WhoName who={who} /></span>
          <span className="v1g-took">LEFT THE BLACKTOP</span>
        </div>
        <div className="v1g-w bt-t0">
          <span className="ag-eyebrow">BLACKTOP · 1V1 · W</span>
          <span className="v1g-w-who"><WhoAv who={me} team={0} size={28} /><WhoName who={me} /><span className="v1g-w-txt">TAKES THE WIN</span></span>
        </div>
        <div className="bt-result-actions v1g-sheet-actions">
          <button className="ag-btn" onClick={() => { sfx('tap'); onDone() }}>DONE</button>
        </div>
      </div>
    </div>
  )
}
