// DEV SERVER ONLY (main.jsx loads it under import.meta.env.DEV, so it is not in a production build).
// The bottom ad rail preview and its guard: add ?rail to any address on the dev server (?rail=106 for a height,
// ?rail=150s for the taller unit that has no Playwire id, ?rail=0 to turn it off; it stays on for the tab).
// It puts a simulated rail on the page, the one the audit uses (scripts/rail-audit/rail-sim.js: the same id,
// position and z-index as Playwire's, with its close tab), and as you move through the site anything interactive
// that ends up under it is outlined in red and listed in the console. No ad is requested.
// The full check is `node scripts/rail-audit.mjs` (scripts/rail-audit/README.md).
import sim from '../../scripts/rail-audit/rail-sim.js?raw'

const KEY = 'bap_rail_preview'
export function startRailGuard() {
  let want = null
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.has('rail')) { const v = q.get('rail'); if (v === '0') sessionStorage.removeItem(KEY); else sessionStorage.setItem(KEY, v || '106') }
    want = sessionStorage.getItem(KEY)
  } catch {}
  if (!want || window.__RA?.setRail) return   // (off, or the audit is driving this page with its own rail)
  new Function(sim)()
  const RA = window.__RA
  const h = Math.max(20, Math.min(320, parseInt(want, 10) || 106)), kind = /s$/.test(want) ? 'sticky' : 'rail'
  RA.setRail(h, kind)
  const style = document.createElement('style')
  style.textContent = '[data-rail-covered] { outline: 3px solid #ff2d55 !important; outline-offset: -3px !important; }'
  document.head.appendChild(style)
  const told = new Set()
  setInterval(() => {
    if (!document.querySelector('[data-rail-audit]')) RA.setRail(h, kind)   // (still there after a page change)
    const hits = RA.scan()
    const now = new Set(hits.map(f => f.el))
    for (const el of document.querySelectorAll('[data-rail-covered]')) if (!now.has(el)) el.removeAttribute('data-rail-covered')
    for (const f of hits) {
      f.el.setAttribute('data-rail-covered', '')
      const line = `${f.what}${f.in ? ' in ' + f.in : ''}`
      if (told.has(line)) continue
      told.add(line)
      console.warn(`[rail] under the bottom ad rail by ${f.into}px (${f.pin ? 'pinned there' : 'at the end of its scroller'}): ${line}`, f.el)
    }
  }, 1000)
  console.info(`[rail] bottom ad rail preview on (${h}px${kind === 'sticky' ? ', the unnamed unit' : ''}). ?rail=0 turns it off.`)
}
