// Weak machines (a lot of the players are on school Chromebooks) get a lighter spin screen:
// no texture filters on the figure, no fades on its colours, no reel drift or drum. How it
// looks elsewhere doesn't change. Two ways in: what the browser says about the machine, and
// what a real spin measures (html.low-power; app-game.css "LOW POWER"). The app judges by
// measuring only, since phones report their cores very differently.
import { IS_APP } from './platform'

const KEY = 'bap_low_power'
const saved = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const weakSpecs = () => {
  if (IS_APP || typeof navigator === 'undefined') return false
  const mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency
  return (mem != null && mem <= 4) || (cores != null && cores <= 4)
}

export const LOW_POWER = saved() || weakSpecs()
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
      try { localStorage.setItem(KEY, '1') } catch {}
      document.documentElement.classList.add('low-power')
    }
  }
  requestAnimationFrame(tick)
}
