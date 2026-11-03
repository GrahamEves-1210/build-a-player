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
// The bottom nav (the dock) is always there. It used to have an off switch in Settings:
// anyone who switched it off gets it back
try { localStorage.removeItem('bap_hide_dock') } catch {}
