import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { liveLock, onLiveLock, guardLeave, forfeitAndGo } from '../../lib/liveLock'
import { sfx, haptic } from '../../lib/juice'
import { IconClose } from './icons'

// The "you're leaving a live game" sheet, and the guards that make every way
// out pass through it (lib/liveLock.js). Mounted once, app-wide (AppTabBar).

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

export function useLiveLock() {
  const [l, set] = useState(liveLock)
  useEffect(() => onLiveLock(set), [])
  return l
}

export default function LiveLeave() {
  const lock = useLiveLock()
  const [ask, setAsk] = useState(null)        // { go } while the sheet is up
  useEffect(() => {
    const on = e => { setAsk({ go: e.detail?.go ?? null }); haptic('medium') }
    window.addEventListener('bap:live-leave', on)
    return () => window.removeEventListener('bap:live-leave', on)
  }, [])
  // Back button: stay on the page, ask instead. Reload / close: the browser asks.
  useEffect(() => {
    if (!lock) { setAsk(null); return }
    const onUnload = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onUnload)
    if (lock.ownBack) return () => window.removeEventListener('beforeunload', onUnload)   // the mode traps Back itself
    window.history.pushState({ live: true }, '', window.location.href)
    const onPop = () => { window.history.pushState({ live: true }, '', window.location.href); guardLeave(() => nav('home')) }
    window.addEventListener('popstate', onPop)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('beforeunload', onUnload) }
  }, [lock])
  if (!ask || !lock) return null
  const stay = () => { setAsk(null); sfx('tap') }
  const leave = () => { const go = ask.go; setAsk(null); sfx('deny'); haptic('heavy'); forfeitAndGo(go) }
  return createPortal(
    <div className="ll-overlay" onClick={e => e.target === e.currentTarget && stay()}>
      <div className="ll-sheet" role="alertdialog" aria-modal="true" aria-labelledby="ll-title" aria-describedby="ll-body">
        <div className="ll-head">
          <span className="ag-eyebrow">LIVE GAME</span>
          <button className="ag-round-btn" onClick={stay} aria-label="Stay in the game"><IconClose size={15} /></button>
        </div>
        <h2 className="ll-title" id="ll-title">{lock.title ?? 'Leave the game?'}</h2>
        <p className="ll-body" id="ll-body">{lock.body ?? 'Leaving now counts as a loss.'}</p>
        <div className="ll-actions">
          <button className="ag-btn ag-cta" onClick={stay} autoFocus>STAY IN THE GAME</button>
          <button className="ll-leave" onClick={leave}>LEAVE &amp; TAKE THE LOSS</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// The way out on a locked page (the navbar is gone): asks first, like everything else
export function LiveLeaveButton({ className = '' }) {
  return <button className={`ll-btn${className ? ` ${className}` : ''}`} onClick={() => guardLeave(() => nav('home'))} aria-label="Leave the game">LEAVE</button>
}
