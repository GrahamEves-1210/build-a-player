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
