// Keeps the --ad-h CSS variable in sync with the Playwire bottom-rail ad so
// the mobile spin / build buttons sit just above it, and drop back down when
// the ad is closed. The value is always written explicitly (never left to the
// CSS :has() fallback) once an ad has been seen, because a closed ad can leave
// its container in the DOM and keep matching that fallback.

const RAIL_SELECTOR = '[id^="pw-oop"][data-pw-status="loaded"]'
const GAP_PX = 2          // clearance above the ad (52px for a standard 50px rail)
const MAX_PX = 400

function isShown(node) {
  const cs = window.getComputedStyle(node)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
  const r = node.getBoundingClientRect()
  return r.width >= 4 && r.height >= 4
}

// True while the container holds actual visible ad content. Closing the ad can
// leave the (still full-height) container behind with nothing inside it.
function hasVisibleContent(el) {
  for (const node of el.querySelectorAll('iframe, img, video, canvas, svg, ins')) {
    if (isShown(node)) return true
  }
  return false
}

// Returns the px the ad occupies from the bottom of the viewport, 0 when it is
// hidden / closed / gone, or null when it exists but has nothing to measure yet.
function measureRail(el) {
  if (!el) return 0
  const cs = window.getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden' || el.getClientRects().length === 0) return 0
  if (!hasVisibleContent(el)) return null

  let rect = el.getBoundingClientRect()
  if (rect.height < 4) {
    let best = null
    for (const child of el.querySelectorAll('iframe, div')) {
      const r = child.getBoundingClientRect()
      if (r.height >= 4 && (!best || r.height > best.height)) best = r
    }
    if (!best) return null
    rect = best
  }
  const vh = window.innerHeight
  // Use the ad's real top edge so any offset from the bottom is included
  const occupied = rect.bottom >= vh - 200 ? vh - rect.top : rect.height
  return Math.min(MAX_PX, Math.max(0, Math.ceil(occupied)))
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
    if (h > 4) { seenVisible = true; apply(`${h + GAP_PX}px`); return }
    // Hidden, collapsed or removed: once an ad was showing, force back to 0 so
    // the CSS :has() fallback can't keep the buttons raised.
    apply(seenVisible || el ? '0px' : null)
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

  const tick = () => { attachResizeObs(); measure() }
  tick()
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
  }
}
