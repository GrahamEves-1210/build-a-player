// Keeps the --ad-h CSS variable in sync with the Playwire bottom-rail ad so
// the mobile spin / build buttons sit just above it, and drop back down when
// the ad is closed. The value is always written explicitly (never left to the
// CSS :has() fallback) once an ad has been seen, because a closed ad can leave
// its container in the DOM and keep matching that fallback.

const RAIL_SELECTOR = '[id^="pw-oop"][data-pw-status="loaded"]'
const GAP_PX = 4          // clearance between the buttons and the top of the ad
const MAX_PX = 400

// Tab bar sits this far above the bottom when no ad is showing
// (see .mobile-tab-bar in index.css; the X in-app browser adds 20px)
// The safe-area inset is measured once, before the observers below are attached,
// because adding the probe element would otherwise retrigger them.
let insetPx = null
function measureInset() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  insetPx = probe.getBoundingClientRect().height
  probe.remove()
}
function baseOffsetPx() {
  return (document.documentElement.classList.contains('is-x-browser') ? 74 : 54) + (insetPx ?? 0)
}

function isShown(node) {
  const cs = window.getComputedStyle(node)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
  const r = node.getBoundingClientRect()
  return r.width >= 4 && r.height >= 4
}

// Top edge (viewport y) of the ad's visible, clickable content, or null when
// there is none. Closing the ad can leave the container behind with nothing
// inside it, so the container's own size is not trusted.
function contentTop(el) {
  let top = null
  for (const node of el.querySelectorAll('iframe, img, video, canvas, svg, ins')) {
    if (!isShown(node)) continue
    const r = node.getBoundingClientRect()
    if (r.bottom < window.innerHeight - 200) continue   // not part of a bottom rail
    top = top === null ? r.top : Math.min(top, r.top)
  }
  return top
}

// Extra px the buttons must rise above their normal position to clear the ad:
// 0 when the ad is hidden/closed/gone (or short enough not to need it), null
// when the container exists but has no visible content yet.
function measureRail(el) {
  if (!el) return 0
  const cs = window.getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden' || el.getClientRects().length === 0) return 0
  const top = contentTop(el)
  if (top === null) return null
  const occupied = window.innerHeight - top
  return Math.min(MAX_PX, Math.max(0, Math.ceil(occupied - baseOffsetPx() + GAP_PX)))
}

export function watchAdRail() {
  const root = document.documentElement
  let seenVisible = false
  let last = null

  const apply = value => {
    if (value === last) return
    last = value
    if (value === null) root.style.removeProperty('--ad-h')
    else root.style.setProperty('--ad-h', value)
  }

  function measure() {
    const el = document.querySelector(RAIL_SELECTOR)
    const h = measureRail(el)
    if (h === null) {
      // Empty container: still loading, or the ad was closed and left it behind
      apply(seenVisible ? '0px' : null)
      return
    }
    // Visible ad -> rise exactly as much as needed; hidden, collapsed or removed
    // -> force 0 so the CSS :has() fallback can't keep the buttons raised.
    if (el) seenVisible = true
    apply(`${h}px`)
  }

  let resizeObs = null
  let observed = null
  function attachResizeObs() {
    const el = document.querySelector(RAIL_SELECTOR)
    if (el === observed) return
    resizeObs?.disconnect()
    observed = el
    if (el && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(measure)
      resizeObs.observe(el)
    }
  }

  const run = () => { attachResizeObs(); measure() }
  // Coalesce bursts (spin animations mutate styles constantly) into one
  // measurement per ~150ms so this never competes with rendering
  let timer = null
  const tick = () => {
    if (timer) return
    timer = setTimeout(() => { timer = null; run() }, 150)
  }
  measureInset()
  run()
  const bodyObs = new MutationObserver(tick)
  bodyObs.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-pw-status', 'style', 'class'],
  })
  window.addEventListener('resize', tick)
  window.addEventListener('orientationchange', tick)
  // Safety net: some ad close paths change nothing we can observe
  const interval = setInterval(tick, 750)

  return () => {
    bodyObs.disconnect()
    resizeObs?.disconnect()
    window.removeEventListener('resize', tick)
    window.removeEventListener('orientationchange', tick)
    clearInterval(interval)
    clearTimeout(timer)
  }
}
