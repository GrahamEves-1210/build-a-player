import { useEffect, useRef, useState } from 'react'
import { sfx, haptic } from '../../lib/juice'

// Live streetball, played: at every check-up the team with the ball calls the
// play and the other team calls the defense, about two seconds to tap. No tap,
// the game plays it as it would have. Plus quick reactions on the court.

export const CALL_LABEL = {
  drive: ['DRIVE', 'Attack the rim'], pullup: ['PULL UP', 'Shoot it'], post: ['POST', 'Back him down'], pass: ['PASS', 'Find the open man'],
  press: ['PRESS', 'Jump the drive'], sag: ['SAG OFF', 'Give him room'], help: ['HELP', 'Protect the rim'],
}
export const CALL_MS = 3200

// The call buttons, with a bar running down the time
// options: call ids ('drive'), or { v, label, sub } (a pass to a named teammate)
export function CallBar({ offense, options, picked = null, onPick, ms = CALL_MS, helpLabel = null, head = null }) {
  const [left, setLeft] = useState(1)
  const t0 = useRef(performance.now())
  useEffect(() => {
    t0.current = performance.now()
    let raf
    const tick = () => { const p = 1 - (performance.now() - t0.current) / ms; setLeft(Math.max(0, p)); if (p > 0) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ms])
  return (
    <div className={`lc-bar ${offense ? 'is-off' : 'is-def'}`} role="group" aria-label={offense ? 'Call the play' : 'Call the defense'}>
      <span className="lc-head">{head ?? (offense ? 'YOUR BALL · CALL IT' : 'ON D · CALL IT')}<i className="lc-time" style={{ transform: `scaleX(${left})` }} /></span>
      <div className="lc-opts" style={{ gridTemplateColumns: `repeat(${options.length > 4 ? 3 : options.length}, minmax(0, 1fr))` }}>
        {options.map(opt => {
          const o = typeof opt === 'string' ? opt : opt.v
          const [label, sub] = typeof opt === 'string' ? CALL_LABEL[o] : [opt.label, opt.sub]
          return (
            <button key={o} className={`lc-opt${picked === o ? ' is-on' : ''}${picked && picked !== o ? ' is-dim' : ''}`} disabled={!!picked || left <= 0}
              onClick={() => { onPick(o); sfx('tap'); haptic('light') }}>
              <b>{label}</b><small>{o === 'help' && helpLabel ? helpLabel : sub}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// What both sides called, shown for a moment as the possession plays
export function CallReveal({ off, def, offense, nameOf = null }) {
  if (!off && !def) return null
  const offLabel = off?.startsWith?.('pass:') ? `PASS → ${(nameOf?.(off.slice(5)) ?? '').toUpperCase()}` : off ? CALL_LABEL[off]?.[0] : null
  return (
    <div className="lc-reveal" aria-live="polite">
      <span className={offense ? 'is-mine' : ''}>{offLabel ?? 'FREESTYLE'}</span>
      <i>vs</i>
      <span className={offense ? '' : 'is-mine'}>{def ? CALL_LABEL[def][0] : 'STRAIGHT UP'}</span>
    </div>
  )
}

// Quick reactions: small round buttons along the edge, never over the court
export function EmoteBar({ emotes, onEmote }) {
  const last = useRef(0)
  return (
    <div className="lc-emotes" role="group" aria-label="Quick reactions">
      {emotes.map(e => (
        <button key={e} className="lc-emote" onClick={() => { const now = Date.now(); if (now - last.current < 1200) return; last.current = now; onEmote(e); haptic('light') }} aria-label={`React ${e}`}>{e}</button>
      ))}
    </div>
  )
}

// The newest reaction per player, for two seconds: { [playerId]: emoji }
export function useBubbles(list) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (!list.length) return; const id = setInterval(() => setNow(Date.now()), 400); return () => clearInterval(id) }, [list.length])
  const out = {}
  for (const x of list) if (now - x.ts < 2200) out[x.from] = x.e
  return out
}
