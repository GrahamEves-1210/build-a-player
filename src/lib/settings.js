// Player settings that change the whole page (applied on load)
const MOTION_KEY = 'bap_reduce_motion'
export const reduceMotion = () => { try { return localStorage.getItem(MOTION_KEY) === '1' } catch { return false } }
// the phone's own Reduce Motion setting does everything the in-app switch does (and follows it live)
const systemReduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const applyMotion = () => { if (typeof document !== 'undefined') document.documentElement.classList.toggle('bap-reduce-motion', reduceMotion() || systemReduced()) }
export function setReduceMotion(on) {
  try { on ? localStorage.setItem(MOTION_KEY, '1') : localStorage.removeItem(MOTION_KEY) } catch {}
  applyMotion()
}
export const motionReduced = () => reduceMotion() || systemReduced()
applyMotion()
try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotion) } catch {}
// The bottom nav (the dock) can be switched off; the menu button on Home and the top bar still get you everywhere
const DOCK_KEY = 'bap_hide_dock'
export const dockHidden = () => { try { return localStorage.getItem(DOCK_KEY) === '1' } catch { return false } }
export function setDockHidden(on) {
  try { on ? localStorage.setItem(DOCK_KEY, '1') : localStorage.removeItem(DOCK_KEY) } catch {}
  document.documentElement.classList.toggle('no-dock', !!on)
}
if (typeof document !== 'undefined' && dockHidden()) document.documentElement.classList.add('no-dock')
