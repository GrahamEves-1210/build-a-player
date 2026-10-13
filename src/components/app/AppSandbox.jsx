import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IconFlask, IconSliders, IconArrow, IconClose } from './icons'
import { useProgress, buy, owns, priceOf } from '../../lib/progress'
import { itemById } from '../../lib/cosmetics'
import { sfx, haptic, victory } from '../../lib/juice'

// App: Sandbox on the build side — one game-style card in place of the
// website's pill + "?" tooltip. Tap the card to switch it; when it's on, the
// ratings editor is one tap away.
// compact: the small version that sits in the silhouette's corner on desktop
// the build page sets which unlock its switch needs (Career / Takeover builds), null elsewhere
let gate = null
export const setSandboxGate = id => { gate = id }
export default function AppSandbox({ on, onToggle: toggle, onCustomize, compact = false }) {
  useProgress()                       // (re-render when the unlock is bought)
  const [ask, setAsk] = useState(null)
  const locked = !!gate && !owns(gate)
  const onToggle = v => { if (v && locked) { setAsk(gate); sfx('tap'); return } toggle?.(v) }
  const mode = gate ? itemById(gate)?.mode : null
  return (<>
    {ask && <SandboxBuy item={ask} onClose={() => setAsk(null)} onUnlocked={() => { setAsk(null); toggle?.(true) }} />}
    <div className={`ag-sandbox${on ? ' is-on' : ''}${compact ? ' ag-sandbox--compact' : ''}`}>
      <button className="ag-sandbox-main" role="switch" aria-checked={on} onClick={e => { const card = e.currentTarget.parentElement; onToggle?.(!on); if (!on) setTimeout(() => card.querySelector('.ag-sandbox-edit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60) }}>
        <span className="ag-sandbox-icon"><IconFlask size={22} /></span>
        <span className="ag-sandbox-txt">
          <span className="ag-sandbox-title">SANDBOX{on && <i>ON</i>}{locked && <i className="sb-lock">{priceOf(gate).toLocaleString()} COINS</i>}</span>
          <span className="ag-sandbox-sub">{mode
            ? (on ? `Your ratings, your rules. This ${mode.toLowerCase()} is marked SANDBOX: no XP or coins.` : locked ? `Unlock it for ${mode} and build whoever you want.` : `Edit any player's ratings. Sandbox ${mode === 'Career' ? 'careers' : 'runs'} earn no XP or coins.`)
            : (on ? 'Your ratings, your rules. This season won\'t save.' : 'Edit any player\'s ratings. Sandbox seasons don\'t save.')}</span>
        </span>
        <span className={`ag-switch${on ? ' is-on' : ''}`} aria-hidden="true"><span /></span>
      </button>
      {on && (
        <button className="ag-sandbox-edit" onClick={onCustomize} aria-label="Edit ratings and build">
          <IconSliders size={17} /> EDIT RATINGS &amp; BUILD <IconArrow size={14} />
        </button>
      )}
    </div>
  </>)
}

// Sandbox in Career and Takeover is bought, one mode at a time: turning the
// switch on there opens this. Bought: the switch goes on (onUnlocked).
export const sandboxItemFor = page => (page === 'career-build' ? 'sandbox-career' : page === 'takeover-build' ? 'sandbox-takeover' : null)
export const sandboxLocked = page => { const id = sandboxItemFor(page); return !!id && !owns(id) }
export function SandboxBuy({ item, onClose, onUnlocked }) {
  const p = useProgress()
  const [err, setErr] = useState('')
  const i = itemById(item)
  if (!i) return null
  const price = priceOf(item), coins = p.coins ?? 0, short = Math.max(0, price - coins)
  const go = () => {
    const r = buy(item)
    if (!r.ok) { setErr(r.reason); sfx('deny'); haptic('light'); return }
    victory({ big: false }); onUnlocked?.()
  }
  return createPortal(
    <div className="ll-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ll-sheet sb-buy" role="dialog" aria-modal="true" aria-labelledby="sb-buy-title">
        <div className="ll-head"><span className="ag-eyebrow">UNLOCK · {i.mode.toUpperCase()}</span><button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={15} /></button></div>
        <h2 className="ll-title" id="sb-buy-title"><IconFlask size={22} /> Sandbox in {i.mode}</h2>
        <p className="ll-body">Edit any player's ratings and build whoever you want, in every {i.mode} from now on. Sandbox {i.mode === 'Career' ? 'careers' : 'runs'} are just for fun: no XP or coins, and they're marked SANDBOX.</p>
        <div className="sb-buy-price"><span className="sb-coin">BAP</span><b>{price.toLocaleString()}</b><small>You have {coins.toLocaleString()}</small></div>
        {err && <p className="sb-buy-err">{err}</p>}
        <div className="ll-actions">
          {short > 0
            ? <button className="ag-btn ag-cta" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'shop:coins' })) }}>GET {short.toLocaleString()} MORE COINS</button>
            : <button className="ag-btn ag-cta" onClick={go}>UNLOCK FOR {price.toLocaleString()}</button>}
          <button className="ag-btn ag-btn--ghost" onClick={onClose}>NOT NOW</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
