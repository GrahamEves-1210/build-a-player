// The website's bottom ad rail, measured into --web-rail: how far up from the bottom edge of the window the ad
// stands, its close tab included (0 when there is none: ad-free players, a mini game, the rail closed). Every
// layout that reaches the bottom of the screen keeps clear of that variable (app-game.css, "the bottom ad rail").
//
// What counts as the rail is what is really there, not one unit's name:
//   - Playwire's bottom rail (#pw-oop-bottom_rail…) and the taller unit it sometimes stacks there (.st-adunit-ad)
//   - anything else that is not ours and looks like one: a fixed box outside #root that holds an ad (an iframe,
//     an <ins>, an embed), sits on the bottom edge of the window and is centred or most of its width (a corner
//     video and a side rail are neither, so they are never taken for it; our own sheets hold no such thing)
// It is measured the moment it changes (a ResizeObserver on each one found, the page's top-level elements watched,
// the window's own resizes) and once a second as a backstop: an ad's inside changes without telling anyone.
const NAMED = '[id^="pw-oop-bottom_rail"], .st-adunit-ad'
const CAP = 320           // never more room than this, whatever an ad does
const shown = el => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01 }
const fixedBox = el => { for (let e = el; e && e !== document.body && e.nodeType === 1; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return e; return null }

// the boxes on the page that are a bottom rail right now
export function findRails() {
  const vw = window.innerWidth, vh = window.innerHeight, root = document.getElementById('root'), out = new Set()
  for (const el of document.querySelectorAll(NAMED)) out.add(el)
  for (const frame of document.querySelectorAll('iframe, ins, object, embed')) {
    if (root?.contains(frame)) continue
    const box = fixedBox(frame)
    if (!box || out.has(box) || box.closest(NAMED)) continue
    const r = box.getBoundingClientRect()
    if (r.height < 20 || r.bottom < vh - 3 || r.top < vh * 0.4) continue                       // on the bottom edge, and not a takeover
    const centred = Math.abs((r.left + r.right) / 2 - vw / 2) < vw * 0.06 && r.width >= Math.min(300, vw * 0.7)
    if (r.width < vw * 0.5 && !centred) continue                                              // (a corner video, a side rail)
    out.add(box)
  }
  return [...out].filter(el => el.isConnected && shown(el))
}

// A rail's extent: from the bottom of the window up to its highest part that is showing (its close tab stands above
// it), up to the top of its own box, and its left and right sides: { h, box, l, r }, or null when it is not there
function reach(el) {
  const vw = window.innerWidth, vh = window.innerHeight, r = el.getBoundingClientRect()
  if (r.height <= 0 || r.width <= 0 || r.bottom < vh - 3) return null
  let top = r.top, l = Infinity, right = -Infinity
  for (const c of el.querySelectorAll('iframe, div, button, span, a, img')) {
    const b = c.getBoundingClientRect()
    if (b.height <= 0 || b.width <= 0 || b.bottom <= vh * 0.4) continue
    top = Math.min(top, b.top)
    // (its sides are the sides of what it shows: the ad and its close tab, not the full-width box they sit in)
    if (c.matches('iframe, img, button, a')) { l = Math.min(l, b.left); right = Math.max(right, b.right) }
  }
  // a box that paints itself (a bar behind the ad) is as wide as it is
  const cs = getComputedStyle(el)
  if (l > right || cs.backgroundImage !== 'none' || !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(cs.backgroundColor)) { l = r.left; right = r.right }
  const h = vh - top
  if (h > vh * 0.6) return null      // (something that tall is not a rail)
  return { h, box: Math.min(h, vh - r.top), l: Math.max(0, Math.floor(l)), r: Math.min(vw, Math.ceil(right)) }
}

let started = false
export function startRailWatch() {
  if (started || typeof document === 'undefined') return
  started = true
  const root = document.documentElement
  let last = -1, lastBox = '', watched = new Set(), queued = 0
  const ro = window.ResizeObserver ? new ResizeObserver(() => measure()) : null
  const measure = () => {
    let h = 0, box = 0, l = window.innerWidth, r = 0
    const rails = root.classList.contains('ads-hidden') ? [] : findRails()
    for (const el of rails) { const x = reach(el); if (!x) continue; h = Math.max(h, x.h); box = Math.max(box, x.box); l = Math.min(l, x.l); r = Math.max(r, x.r) }
    h = Math.ceil(Math.min(CAP, Math.max(0, h)))
    box = Math.floor(Math.min(h, Math.max(0, box)))
    if (!h || l >= r) { l = 0; r = window.innerWidth }
    // each rail and the ad inside it is watched for its own changes of size
    if (ro) {
      const now = new Set(rails.flatMap(el => [el, ...el.querySelectorAll('iframe')]))
      for (const el of watched) if (!now.has(el)) ro.unobserve(el)
      for (const el of now) if (!watched.has(el)) ro.observe(el)
      watched = now
    }
    // --web-rail-box: the ad's own box, without the close tab above it (the dock's floor runs down to it).
    // --web-rail-l / --web-rail-r: the ad's left and right sides, so an overlay can leave exactly the ad uncovered
    // and still dim the page beside it (a 728 ad in a 1280 window)
    const sides = `${box}|${l}|${r}`
    if (sides !== lastBox) {
      lastBox = sides
      root.style.setProperty('--web-rail-box', `${box}px`)
      root.style.setProperty('--web-rail-l', `${l}px`)
      root.style.setProperty('--web-rail-r', `${r}px`)
    }
    if (h !== last) {
      last = h
      root.style.setProperty('--web-rail', `${h}px`)
      root.classList.toggle('has-rail', h > 0)   // (for the few rules that only make sense with a rail there)
      window.dispatchEvent(new CustomEvent('bap:rail', { detail: h }))
    }
  }
  // (several changes in one frame are one measure)
  const soon = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; measure() }) }
  measure()
  // ad scripts put their boxes straight under <body>, and switch them on by attribute: both are seen at once
  new MutationObserver(soon).observe(document.body, { childList: true, attributes: true, attributeFilter: ['style', 'class'] })
  new MutationObserver(soon).observe(root, { attributes: true, attributeFilter: ['class'] })   // ads-hidden on and off
  window.addEventListener('resize', soon)
  window.addEventListener('orientationchange', soon)
  window.visualViewport?.addEventListener('resize', soon)
  setInterval(measure, 1000)
}
