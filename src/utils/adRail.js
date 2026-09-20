// Keeps the --ad-h CSS variable in sync with the Playwire bottom-rail ad so
// the mobile spin / build buttons sit just above it, and drop back down when
// the ad is closed. The value is always written explicitly (never left to the
// CSS :has() fallback) once an ad has been seen, because a closed ad can leave
// its container in the DOM and keep matching that fallback.

const RAIL_SELECTOR = '[id^="pw-oop"][data-pw-status="loaded"]'
const GAP_PX = 2          // clearance above the ad: a 50px ad -> 52px lift
const MAX_PX = 400

// True only if the node can actually be seen and tapped where it sits. A closed
// ad often keeps its iframe at full size inside a collapsed / clipped / faded
// wrapper, so size alone isn't enough: check every ancestor's display,
// visibility and opacity, then hit-test the node's centre (which respects
// overflow clipping and off-screen transforms).
function isShown(node, root) {
  const r = node.getBoundingClientRect()
  if (r.width < 4 || r.height < 4) return false
  for (let n = node; n && n !== document.documentElement; n = n.parentElement) {
    const cs = window.getComputedStyle(n)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false
  }
  const vh = window.innerHeight, vw = window.innerWidth
  const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2))
  const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2))
  if (cy < r.top || cy > r.bottom || cx < r.left || cx > r.right) return false  // off-screen
  const hit = document.elementFromPoint(cx, cy)
  return !!hit && (hit === node || node.contains(hit) || root.contains(hit))
}

// Top edge (viewport y) of the ad's visible, clickable content, or null when
// there is none. Closing the ad can leave the container behind with nothing
// inside it, so the container's own size is not trusted.
function contentTop(el) {
  let top = null
  for (const node of el.querySelectorAll('iframe, img, video, canvas, svg, ins')) {
    if (!isShown(node, el)) continue
    const r = node.getBoundingClientRect()
    if (r.bottom < window.innerHeight - 200) continue   // not part of a bottom rail
    top = top === null ? r.top : Math.min(top, r.top)
  }
  return top
}

// Height of the visible, clickable ad from the bottom of the viewport (+ gap):
// 0 when the ad is hidden/closed/gone, null when the container exists but has
// no visible content yet.
function measureRail(el) {
  if (!el) return 0
  const cs = window.getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden' || el.getClientRects().length === 0) return 0
  const top = contentTop(el)
  if (top === null) return null
  const occupied = window.innerHeight - top
  return Math.min(MAX_PX, Math.max(0, Math.ceil(occupied + GAP_PX)))
}

export function watchAdRail() {
  const root = document.documentElement
  let seenVisible = false
  let last = null

  // ?adebug in the URL shows a small readout (no dev tools needed on a phone)
  let dbg = null
  if (new URLSearchParams(window.location.search).has('adebug')) {
    dbg = document.createElement('div')
    dbg.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;background:rgba(0,0,0,.8);color:#0f0;font:11px monospace;padding:3px 6px;pointer-events:none;white-space:pre'
    document.body.appendChild(dbg)
  }
  const report = (el, h) => {
    if (!dbg) return
    const frames = el ? [...el.querySelectorAll('iframe, img, video, canvas, svg, ins')] : []
    const shown = frames.filter(n => isShown(n, el)).length
    dbg.textContent = `ad el: ${el ? el.id.slice(0, 24) : 'none'}
media: ${frames.length} shown: ${shown}
ad-h: ${h === null ? 'fallback' : h + 'px'} seen: ${seenVisible}`
  }

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
      report(el, null)
      return
    }
    // Visible ad -> rise exactly as much as needed; hidden, collapsed or removed
    // -> force 0 so the CSS :has() fallback can't keep the buttons raised.
    if (el) seenVisible = true
    apply(`${h}px`)
    report(el, h)
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
    dbg?.remove()
  }
}
