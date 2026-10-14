// Playwire's bottom rail sets its own layering inline (forced), which beats any
// stylesheet, so the bottom nav ended up under the ad and so did the rail's own
// close button. This sets them in code, where an inline style can be overridden:
// the rail one layer under the nav (the tab bar is 200), its close button on top.
// Nothing moves. Re-applied every couple of seconds and whenever the page's
// elements change, since Playwire redraws the rail.
import { rampRail } from './ads'

const RAIL = '[id^="pw-oop-bottom_rail"], [id^="pw-oop"][style*="bottom"]'
// a second, taller ad Playwire stacks at the bottom (116px, the very top layer): under the nav too
const STICKY = '.st-adunit-ad'
const CLOSE = '[id*="close" i], [class*="close" i], [aria-label*="close" i], button'
const isClose = el => /close/i.test(`${el.id} ${el.className} ${el.getAttribute?.('aria-label') ?? ''}`)
const force = (el, z) => { if (el.style.getPropertyValue('z-index') !== String(z) || el.style.getPropertyPriority('z-index') !== 'important') el.style.setProperty('z-index', String(z), 'important') }

function apply() {
  for (const el of document.querySelectorAll(RAIL)) {
    if (isClose(el)) { force(el, 2147483647); continue }
    force(el, 199)
    for (const c of el.querySelectorAll(CLOSE)) force(c, 2147483647)
  }
  for (const el of document.querySelectorAll(STICKY)) {
    force(el, 199)
    for (const c of el.querySelectorAll(CLOSE)) force(c, 2147483647)
  }
  // a close button Playwire put next to the rail rather than inside it
  for (const c of document.querySelectorAll('[id^="pw-"][id*="close" i], [class*="pw-"][class*="close" i]')) force(c, 2147483647)
}

let started = false
export function startRailLayer() {
  if (started || typeof document === 'undefined') return
  started = true
  apply()
  new MutationObserver(apply).observe(document.body, { childList: true })
  setInterval(apply, 1500)
  // a tap in the nav (the bottom tabs, the new UI's dock, the top bar) is a
  // navigation even when the page doesn't change: the rail is requested again
  // (closed or not; lib/ads.js keeps it to once every 30 s)
  document.addEventListener('click', e => {
    if (e.target?.closest?.('.mobile-tab-bar, .ag-dock, .navbar, .ag-hud')) rampRail()
  }, true)
}
