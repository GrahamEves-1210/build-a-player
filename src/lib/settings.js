// Player settings that change the whole page (applied on load)
const MOTION_KEY = 'bap_reduce_motion'
export const reduceMotion = () => { try { return localStorage.getItem(MOTION_KEY) === '1' } catch { return false } }
export function setReduceMotion(on) {
  try { on ? localStorage.setItem(MOTION_KEY, '1') : localStorage.removeItem(MOTION_KEY) } catch {}
  document.documentElement.classList.toggle('bap-reduce-motion', !!on)
}
// the phone's own "reduce motion" setting counts too (CSS handles that one)
export const motionReduced = () => reduceMotion() || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
if (typeof document !== 'undefined' && reduceMotion()) document.documentElement.classList.add('bap-reduce-motion')
// The bottom nav (the dock) can be switched off; the menu button on Home and the top bar still get you everywhere
const DOCK_KEY = 'bap_hide_dock'
export const dockHidden = () => { try { return localStorage.getItem(DOCK_KEY) === '1' } catch { return false } }
export function setDockHidden(on) {
  try { on ? localStorage.setItem(DOCK_KEY, '1') : localStorage.removeItem(DOCK_KEY) } catch {}
  document.documentElement.classList.toggle('no-dock', !!on)
}
if (typeof document !== 'undefined' && dockHidden()) document.documentElement.classList.add('no-dock')
