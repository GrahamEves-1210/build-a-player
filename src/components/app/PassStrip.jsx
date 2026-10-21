import { useEffect, useRef } from 'react'
import { useProgress, claimPass } from '../../lib/progress'
import { TIERS, TIER_XP } from '../../lib/pass'
import { getUsername } from '../../lib/discord'
import { sfx, haptic } from '../../lib/juice'
import { RewardArt, rewardLabel } from './AppPass'
import { IconCheck, IconLock, IconCrown, IconArrow } from './icons'
import './pass.css'

// Profile: the Builder Pass as a strip that scrolls sideways, opened on the tier the
// player is on. A reward that's ready claims right here; anything else opens the pass.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

export default function PassStrip() {
  const p = useProgress()
  const bp = p.bp
  const rowRef = useRef(null)
  const name = getUsername(p.user) || 'Guest'
  useEffect(() => {
    const row = rowRef.current, el = row?.querySelector(`[data-tier="${Math.max(1, (bp?.tier ?? 1) - 1)}"]`)
    if (row && el) row.scrollLeft = el.offsetLeft - row.offsetLeft - 8
  }, [!!bp]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!bp) return null
  const s = bp.season
  const live = p.signedIn && bp.started
  const tap = (track, t, ready) => {
    if (!ready) { nav('pass'); return }
    if (claimPass(track, t)) { sfx('coins'); haptic('success') }
  }
  const tile = (track, t) => {
    const r = (track === 'p' ? s.premium : s.free)[t]
    if (!r) return <span className="ps-tile is-empty" aria-hidden="true" />
    const claimed = !!bp.claimed[track][t], locked = track === 'p' && !bp.owned
    const ready = live && t <= bp.tier && !claimed && !locked
    return (
      <button className={`ps-tile ps-tile--${track}${ready ? ' is-ready' : claimed ? ' is-claimed' : locked ? ' is-locked' : ''}`} onClick={() => tap(track, t, ready)}
        aria-label={`Tier ${t} ${track === 'p' ? 'premium' : 'free'}: ${rewardLabel(r)}${claimed ? ', claimed' : ready ? ', claim' : ''}`}>
        <RewardArt r={r} name={name} />
        <span className="ps-tile-name">{rewardLabel(r)}</span>
        {claimed ? <span className="ps-tile-mark"><IconCheck size={11} /></span> : locked ? <span className="ps-tile-mark"><IconLock size={10} /></span> : ready ? <span className="ps-tile-claim">CLAIM</span> : null}
      </button>
    )
  }
  return (
    <section className="ps ag-pop" aria-label="Builder Pass">
      <button className="ps-head" onClick={() => nav('pass')}>
        <span className="ps-head-txt">
          <span className="ag-eyebrow">BUILDER PASS · {s.name.toUpperCase()}</span>
          <b>TIER {bp.tier}<small> / {TIERS}</small>{bp.owned && <i><IconCrown size={11} /> PREMIUM</i>}</b>
        </span>
        <span className="ps-head-go">{bp.ready > 0 ? `${bp.ready} TO CLAIM` : 'OPEN'} <IconArrow size={12} /></span>
      </button>
      <span className="bp-bar ps-bar" aria-hidden="true"><span style={{ width: `${bp.tier >= TIERS ? 100 : Math.min(100, (bp.into / TIER_XP) * 100)}%` }} /></span>
      <div className="ps-row" ref={rowRef}>
        {Array.from({ length: TIERS }, (_, k) => k + 1).map(t => (
          <div key={t} data-tier={t} className={`ps-col${live && t <= bp.tier ? ' is-reached' : ''}${t === bp.tier ? ' is-now' : ''}`}>
            <span className="ps-num">{t}</span>
            {tile('f', t)}
            {tile('p', t)}
          </div>
        ))}
      </div>
    </section>
  )
}
