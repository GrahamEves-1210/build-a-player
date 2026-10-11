// Is the player scrolling right now? A finger on the screen, or a touch/wheel
// scroll in the last moment. Screens that move themselves (follow the newest
// game, bring a card into view, glide to a side) wait until this is false, so
// the page never jumps under a finger.
let touching = 0
let lastInput = 0
const QUIET_MS = 700
if (typeof window !== 'undefined') {
  const now = () => { lastInput = performance.now() }
  window.addEventListener('touchstart', () => { touching++; now() }, { passive: true, capture: true })
  window.addEventListener('touchmove', now, { passive: true, capture: true })
  const end = () => { touching = Math.max(0, touching - 1); now() }
  window.addEventListener('touchend', end, { passive: true, capture: true })
  window.addEventListener('touchcancel', end, { passive: true, capture: true })
  window.addEventListener('wheel', now, { passive: true, capture: true })
}
export const userScrolling = () => touching > 0 || performance.now() - lastInput < QUIET_MS
// run fn once the player has stopped scrolling (checks every 150 ms, gives up after `maxMs`)
export function whenStill(fn, maxMs = 4000) {
  const t0 = performance.now()
  let id = 0
  const tick = () => { if (!userScrolling() || performance.now() - t0 > maxMs) fn(); else id = setTimeout(tick, 150) }
  tick()
  return () => clearTimeout(id)
}
