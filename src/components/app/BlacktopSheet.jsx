import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { EASE_DRAWER } from '../../lib/motion'
import { useSheetDrag } from './Sheet'
import { IconClose } from './icons'

// Blacktop's sheet: a solid panel that slides up from the bottom edge like a native one, and goes
// back down when it's closed (the X, a tap outside, or dragging the grabber or the header down).
// Chat, the 1v1 matchup, "leave the 1v1?" and "match over" are all this panel (blacktop-lobby.css).
//   onClose   null: a sheet that has to be answered (no X, no drag, a tap outside does nothing)
//   corner    desktop: a panel docked in the corner (chat) instead of a centred dialog
// The overlay keeps the bt-sheet-overlay class: lib/juice.js plays the sheet's sound off it.
export default function BlacktopSheet({ label, title, onClose = null, closeLabel = 'Close', corner = false, className = '', children }) {
  const [closing, setClosing] = useState(false)
  const close = () => { if (!onClose || closing) return; setClosing(true); setTimeout(onClose, 240) }
  const { startDrag, dragProps, tap } = useSheetDrag('bottom', close)
  const grip = onClose ? { onPointerDown: startDrag } : {}
  return createPortal(
    <motion.div className={`bt-sheet-overlay btl-overlay${corner ? ' btl-overlay--corner' : ''}`}
      initial={{ opacity: 0 }} animate={{ opacity: closing ? 0 : 1 }} transition={{ duration: closing ? 0.24 : 0.2 }}
      onClick={e => e.target === e.currentTarget && close()}>
      <motion.div className={`btl-sheet${className ? ` ${className}` : ''}`} role="dialog" aria-label={label}
        initial={{ y: '100%' }} animate={{ y: closing ? '105%' : 0 }} transition={{ duration: closing ? 0.24 : 0.38, ease: EASE_DRAWER }}
        {...(onClose ? dragProps : {})}>
        <div className="btl-sheet-grab" {...grip} onClick={onClose ? tap(close) : undefined} />
        <div className="btl-sheet-head" {...grip}>
          <h2 className="btl-sheet-title">{title}</h2>
          {onClose && <button className="ag-round-btn btl-x" onClick={close} aria-label={closeLabel}><IconClose size={16} /></button>}
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
