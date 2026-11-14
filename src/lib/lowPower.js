// Weak machines (a lot of the players are on school Chromebooks) get a lighter spin screen:
// no texture filters on the figure, no fades on its colours, no reel drift or drum. How it
// looks elsewhere doesn't change. Two ways in: what the browser says about the machine, and
// what a real spin measures (html.low-power; app-game.css "LOW POWER"). The app judges by
// measuring only, since phones report their cores very differently.
import { IS_APP } from './platform'

const KEY = 'bap_low_power'
// (a slow spin's verdict lasts a week, then the machine is measured again: one bad moment, a busy tab, used to switch
// the light version on for good. The old '1' had no date: it's measured again too)
const WEEK = 7 * 864e5
const saved = () => { try { const v = Number(localStorage.getItem(KEY)); return v > 1 && Date.now() - v < WEEK } catch { return false } }
const weakSpecs = () => {
  if (IS_APP || typeof navigator === 'undefined') return false
  // phones and tablets: judged by measuring only, like the app (they report their memory and cores very differently;
  // most read as weak, and lost the reel drift for nothing)
  try { if (matchMedia('(pointer: coarse)').matches) return false } catch {}
  const mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency
  // (2 or less: 4 caught ordinary computers, the owner's among them, and took the wheels' idle spin and 3D away; anything
  // between is left to the frame check below, which marks a machine that really drops frames)
  return (mem != null && mem <= 2) || (cores != null && cores <= 2)
}

// the machine's own verdict, and the player's: Reduce motion (lib/settings.js) asks for the light version too
export const DEVICE_LOW = saved() || weakSpecs()
const reduceAsked = () => { try { return localStorage.getItem('bap_reduce_motion') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
export const LOW_POWER = DEVICE_LOW || reduceAsked()
if (LOW_POWER && typeof document !== 'undefined') document.documentElement.classList.add('low-power')

// Once a page load, over the first spin: if the page can't keep 25 frames a second, it's weak
// whatever it reported. Saved for next time; the figure lightens right away.
let sampled = LOW_POWER
export function sampleFrames() {
  if (sampled) return
  sampled = true
  const t0 = performance.now()
  let n = 0
  const tick = now => {
    if (document.hidden) return
    n++
    if (now - t0 < 1200) { requestAnimationFrame(tick); return }
    if ((now - t0) / n > 40) {
      try { localStorage.setItem(KEY, String(Date.now())) } catch {}
      document.documentElement.classList.add('low-power')
    }
  }
  requestAnimationFrame(tick)
}
