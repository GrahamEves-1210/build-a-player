import { useRef } from 'react'
import { useDragControls } from 'motion/react'
import { EASE_DRAWER } from '../../lib/motion'

// Sheets that slide in from their edge, slide back out when they close, and can be
// dragged back toward that edge to close (motion; the More menu and the shop's item
// sheet). The parent keeps the sheet inside <AnimatePresence> so it can leave.
//   from   'bottom' (the app's sheets) or 'top' (the website's More sheet drops from the top)
// startDrag goes on the grabber and the header: the rest of the sheet still scrolls.
// tap(fn) wraps a tap-to-close: a press that moved isn't a tap (a mouse fires a click
// where a drag ends; a finger doesn't).

export function useSheetDrag(from, onClose) {
  const controls = useDragControls()
  const down = useRef(null)
  const sign = from === 'top' ? -1 : 1
  const startDrag = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    down.current = { x: e.clientX, y: e.clientY }
    controls.start(e)
  }
  const dragProps = {
    drag: 'y',
    dragListener: false,
    dragControls: controls,
    dragConstraints: { top: 0, bottom: 0 },
    // free toward the edge it came from, a little give the other way
    dragElastic: from === 'top' ? { top: 1, bottom: 0.06 } : { top: 0.06, bottom: 1 },
    dragMomentum: false,
    // far enough, or flicked: it goes
    onDragEnd: (e, info) => { if (info.offset.y * sign > 90 || info.velocity.y * sign > 550) onClose() },
  }
  const tap = fn => e => { const d = down.current; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return; fn(e) }
  return { startDrag, dragProps, tap }
}

export const sheetMotion = from => ({
  initial: { y: from === 'top' ? '-100%' : '100%' },
  animate: { y: 0, transition: { duration: 0.38, ease: EASE_DRAWER } },
  exit: { y: from === 'top' ? '-105%' : '105%', transition: { duration: 0.26, ease: EASE_DRAWER } },
})

export const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.24 } },
}
