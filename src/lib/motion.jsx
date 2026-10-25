import { useSyncExternalStore } from 'react'
import { MotionConfig } from 'motion/react'

// The motion library (motion.dev) for what CSS can't do neatly: things animating
// out (AnimatePresence), things gliding to a new place (layout), drags that follow
// the finger. Everything else stays in the CSS files.
//
// Reduce Motion: the app's switch and the phone's setting both put
// `bap-reduce-motion` on <html> (lib/settings.js). The library only reads the
// phone's setting, so the root follows the class instead: with it on, movement
// becomes a cut (opacity still fades).

const reducedNow = () => typeof document !== 'undefined' && document.documentElement.classList.contains('bap-reduce-motion')
function subscribe(fn) {
  const mo = new MutationObserver(fn)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}
export const useReducedMotionApp = () => useSyncExternalStore(subscribe, reducedNow, () => false)

export function AppMotion({ children }) {
  const reduce = useReducedMotionApp()
  return <MotionConfig reducedMotion={reduce ? 'always' : 'never'}>{children}</MotionConfig>
}

// Shared feel: a strong ease-out (fast start, long settle), the drawer curve, and springs
export const EASE_OUT = [0.16, 1, 0.3, 1]
export const EASE_DRAWER = [0.32, 0.72, 0, 1]
export const SPRING_LAYOUT = { type: 'spring', stiffness: 360, damping: 32, mass: 0.6 }   // pills and rows gliding to a new place
export const SPRING_PANEL = { type: 'spring', stiffness: 420, damping: 40, mass: 0.5 }    // sheets and panels
