// Runs inside the page (injected before any of the site's code by rail-audit.mjs). Three jobs:
//   1. nothing leaves the machine that could write anywhere: analytics and every non-GET request to another host are
//      answered locally, and sockets to other hosts never open (no presence, no queue, no room)
//   2. a simulated bottom rail: the same id, position and z-index Playwire's has, at any height, with its close tab
//   3. the audit itself: scroll every scroller to its end and list what is still under the rail
(() => {
  if (window.__RA) return
  const RA = (window.__RA = {})
  const isLocal = u => { try { const h = new URL(String(u?.url ?? u), location.href).hostname; return h === location.hostname || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' } catch { return true } }

  // ── 1. no writes, no sockets ────────────────────────────────────────────────
  const realFetch = window.fetch
  window.fetch = (u, o) => {
    const url = String(u?.url ?? u), method = String(o?.method ?? u?.method ?? 'GET').toUpperCase()
    if (url.includes('analytics_events')) return Promise.resolve(new Response('[]', { status: 201 }))
    if (!isLocal(url) && method !== 'GET' && method !== 'HEAD') return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }))
    return realFetch(u, o)
  }
  try { navigator.sendBeacon = () => true } catch {}
  const RealWS = window.WebSocket
  class DeadSocket extends EventTarget {
    constructor(url) {
      super(); this.url = String(url); this.readyState = 0; this.bufferedAmount = 0; this.binaryType = 'blob'; this.protocol = ''; this.extensions = ''
      setTimeout(() => { this.readyState = 3; for (const e of [new Event('error'), new CloseEvent('close', { code: 1006 })]) { try { this['on' + e.type]?.(e) } catch {} this.dispatchEvent(e) } }, 60)
    }
    send() {} close() { this.readyState = 3 }
  }
  function AuditWebSocket(url, protocols) { return isLocal(url) ? new RealWS(url, protocols) : new DeadSocket(url) }
  for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) AuditWebSocket[k] = RealWS[k]
  AuditWebSocket.prototype = RealWS.prototype
  window.WebSocket = AuditWebSocket
  RA.errors = []
  window.addEventListener('error', e => RA.errors.push(String(e.message).slice(0, 200)))

  // ── 2. the simulated rail ───────────────────────────────────────────────────
  // kind 'rail': Playwire's own element (#pw-oop-bottom_rail, data-pw-status=loaded, fixed to the bottom, z-index 199
  // forced inline), the creative in an iframe, the close tab standing above the box.
  // kind 'sticky': the taller unit that is sometimes stacked at the bottom instead: no pw-oop id at all (the site only
  // knows it as a third-party element fixed to the bottom edge).
  const AD = '#ff00ff', TAB = 16
  RA.rail = null
  RA.setRail = (h, kind = 'rail') => {
    RA.rail = h ? { h, kind } : null
    if (!document.body) return 'later'
    document.querySelectorAll('[data-rail-audit]').forEach(e => { if (!h || e.dataset.railAudit !== kind) e.remove() })
    if (!h) return 0
    let el = document.querySelector('[data-rail-audit]')
    if (!el) {
      el = document.createElement('div')
      if (kind === 'rail') { el.id = 'pw-oop-bottom_rail'; el.setAttribute('data-pw-status', 'loaded') } else el.className = 'st-adunit-ad'
      el.setAttribute('data-rail-audit', kind)
      el.innerHTML = '<div data-ra-wrap><button type="button" class="pw-rail-close" aria-label="Close ad" data-ra-close></button><iframe data-ra-ad title="ad" scrolling="no" frameborder="0"></iframe></div>'
      document.body.appendChild(el)
    }
    const w = Math.min(window.innerWidth, window.innerWidth >= 768 ? 728 : 320)
    el.style.cssText = `position:fixed;left:0;right:0;bottom:0;margin:0;padding:6px 0 0;box-sizing:border-box;height:${h}px;text-align:center;line-height:0;z-index:199 !important;`
    el.firstChild.style.cssText = 'position:relative;display:inline-block;line-height:0;'
    el.querySelector('[data-ra-ad]').style.cssText = `display:block;width:${w}px;height:${h - 6}px;border:0;margin:0;background:${AD};`
    el.querySelector('[data-ra-close]').style.cssText = `position:absolute;right:0;top:${-6 - TAB}px;width:28px;height:${TAB}px;padding:0;margin:0;border:0;border-radius:0;min-height:0;background:#00ffff;`
    return h + TAB
  }
  const whenBody = () => { if (RA.rail && document.body) RA.setRail(RA.rail.h, RA.rail.kind) }
  if (!document.body) { const mo = new MutationObserver(() => { if (document.body) { mo.disconnect(); whenBody() } }); mo.observe(document, { childList: true, subtree: true }) }

  const railEl = () => document.querySelector('[data-rail-audit]')
  const inRail = el => !!el?.closest?.('[data-rail-audit]')
  // the rail's band: from the top of its close tab to the bottom of the window, the full width
  RA.band = () => {
    const el = railEl()
    if (!el) return null
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return { hidden: true }
    const ad = el.querySelector('[data-ra-ad]').getBoundingClientRect(), close = el.querySelector('[data-ra-close]').getBoundingClientRect()
    const top = Math.min(el.getBoundingClientRect().top, ad.top, close.top)
    const R = r => ({ x: r.left, y: r.top, width: r.width, height: r.height })
    return { top, bottom: window.innerHeight, height: window.innerHeight - top, ad: R(ad), close: R(close), z: cs.zIndex,
      measured: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--web-rail')) || 0,
      adH: getComputedStyle(document.documentElement).getPropertyValue('--ad-h').trim() }
  }

  // ── 3. the audit ────────────────────────────────────────────────────────────
  const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, label[for], [onclick], [contenteditable=""], [contenteditable=true], [tabindex]:not([tabindex="-1"]), [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [role=radio], [role=menuitem], [role=option], [role=slider]'
  const HANDLERS = ['onClick', 'onPointerDown', 'onPointerUp', 'onMouseDown', 'onMouseUp', 'onTouchStart', 'onTouchEnd', 'onDoubleClick']
  const hasHandler = el => { for (const k of Object.keys(el)) if (k.startsWith('__reactProps$')) { const p = el[k]; return !!p && HANDLERS.some(h => typeof p[h] === 'function') } return false }
  const interactive = el => el.matches(SEL) || hasHandler(el)
  const shown = el => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || +cs.opacity < 0.02) return false
      if (e === el && cs.pointerEvents === 'none') return false
    }
    return true
  }
  const pinned = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return p } return '' }
  const label = el => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : ''
    const txt = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 36)
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }
  const home = el => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const c = typeof e.className === 'string' && e.className.trim().split(/\s+/)[0]; if (c && (getComputedStyle(e).position === 'fixed' || /screen|page|sheet|overlay|modal|layout|home|stage/.test(c))) return '.' + c } return '' }

  // every interactive element of ours that the rail's band still touches and that would take a tap there without the rail
  function under(band, onlyPinned) {
    const out = [], vw = window.innerWidth, vh = window.innerHeight
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2 || r.bottom <= band.top + 1 || r.top >= vh || r.right <= 0 || r.left >= vw) continue
      if (inRail(el) || !interactive(el) || !shown(el)) continue
      const pin = pinned(el)
      if (onlyPinned && !pin) continue
      // a full-screen layer (a backdrop that closes on a tap, a canvas stage) is not a button: it is listed as a layer
      const big = r.width * r.height >= vw * vh * 0.5
      const top = Math.max(r.top, band.top), bottom = Math.min(r.bottom, vh), left = Math.max(r.left, 0), right = Math.min(r.right, vw)
      if (bottom - top < 1 || right - left < 1) continue
      const pts = [[(left + right) / 2, (top + bottom) / 2], [(left + right) / 2, top + Math.min(2, (bottom - top) / 2)], [left + (right - left) * .2, (top + bottom) / 2], [left + (right - left) * .8, (top + bottom) / 2]]
      let hit = false
      for (const [x, y] of pts) {
        const first = document.elementsFromPoint(Math.min(vw - 1, Math.max(0, x)), Math.min(vh - 1, Math.max(0, y))).find(e => !inRail(e))
        if (first && (first === el || el.contains(first))) { hit = true; break }
      }
      if (!hit) continue
      out.push({ el, big, pin, what: label(el), in: home(el), into: Math.round(Math.min(r.bottom, vh) - band.top), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] })
    }
    // an element is reported once: the innermost one (a row and the button inside it are one finding)
    return out.filter(a => !out.some(b => b !== a && a.el.contains(b.el) && !b.big))
  }

  const scrollers = () => {
    const set = new Set()
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollHeight - el.clientHeight > 1 && el.clientHeight > 0) { const oy = getComputedStyle(el).overflowY; if (oy === 'auto' || oy === 'scroll') set.add(el) }
    }
    const se = document.scrollingElement
    if (se && se.scrollHeight - window.innerHeight > 1) {
      const a = getComputedStyle(document.documentElement).overflowY, b = getComputedStyle(document.body).overflowY
      const locked = /hidden|clip/.test(a) || (a === 'visible' && /hidden|clip/.test(b))
      if (!locked) set.add(se)
    }
    return [...set]
  }
  const frames = n => new Promise(r => { const step = () => (n-- > 0 ? requestAnimationFrame(step) : r()); step() })
  const strip = list => list.map(({ el, ...f }) => f)   // (el is kept on the page side only)

  let saved = null, seen = null
  // step 1: what is pinned under the rail as the screen stands; then every scroller goes to its end
  RA.auditStart = async () => {
    const band = RA.band()
    if (!band || band.hidden) return { band }
    const pinnedNow = under(band, true)
    seen = new Set(pinnedNow.map(f => f.el))
    saved = []
    for (let round = 0; round < 3; round++) {
      for (const s of scrollers()) {
        if (!saved.some(x => x[0] === s)) saved.push([s, s.scrollTop])
        s.scrollTo({ top: s.scrollHeight, behavior: 'instant' })
      }
      await frames(2)
    }
    await new Promise(r => setTimeout(r, 80))
    return { band, pinned: strip(pinnedNow), scrollers: saved.length }
  }
  // step 2: what is still under the rail with everything scrolled to its end; the scroll positions go back
  RA.auditEnd = async () => {
    const band = RA.band()
    if (!band || band.hidden) return { band }
    const atEnd = under(band, false).filter(f => !seen?.has(f.el))
    for (const [s, top] of saved ?? []) s.scrollTo({ top, behavior: 'instant' })
    saved = null
    await frames(2)
    return { band, atEnd: strip(atEnd) }
  }
  // which of our elements are stacked over the ad (asked when the screenshot shows the ad is not fully visible):
  // pointer-events are forced on for the look, so layers that let taps through are found too
  RA.whoCovers = () => {
    const band = RA.band()
    if (!band || band.hidden) return []
    const st = document.createElement('style'); st.textContent = '*{pointer-events:auto !important}'; document.head.appendChild(st)
    const names = new Set()
    const { x, y, width, height } = band.ad
    for (const [px, py] of [[x + width / 2, y + height / 2], [x + 4, y + 4], [x + width - 4, y + height - 4], [x + width / 2, y + 3], [x + width / 2, y + height - 3]]) {
      for (const e of document.elementsFromPoint(px, py)) {
        if (inRail(e)) break
        const cs = getComputedStyle(e)
        names.add(`${label(e).slice(0, 60)} [z ${cs.zIndex}, ${cs.position}]`)
      }
    }
    st.remove()
    return [...names].slice(0, 6)
  }

  // ── helpers for the scenarios ───────────────────────────────────────────────
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && shown(el) }
  // the first visible element matching a selector, or (text) the smallest visible clickable whose text matches
  RA.find = (q, { all = false } = {}) => {
    let list
    if (q instanceof RegExp || (typeof q === 'object' && q.text)) {
      const re = q instanceof RegExp ? q : q.text
      list = [...document.querySelectorAll(q.within ? q.within + ' *' : 'button, a, [role=button], [role=tab], label, summary, li, div, span')]
        .filter(e => !inRail(e) && (e.matches('button, a, [role=button], [role=tab], summary') || hasHandler(e)) && re.test((e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()) && visible(e))
        .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)
    } else list = [...document.querySelectorAll(q)].filter(e => !inRail(e) && visible(e))
    return all ? list : list[0] ?? null
  }
  RA.click = q => { const el = RA.find(q); if (!el) return false; el.click(); return label(el) }
  RA.point = q => { const el = RA.find(q); if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }
  RA.has = q => !!RA.find(q)
  // what the screen is, in a line: the page's outer containers and its headline (used to tell screens apart)
  RA.sig = () => {
    const tops = [...document.querySelectorAll('#root > *, body > *:not(#root):not(script):not(style):not([data-rail-audit])')].filter(visible)
    const names = tops.map(e => (typeof e.className === 'string' && e.className.trim().split(/\s+/).slice(0, 2).join('.')) || e.tagName.toLowerCase())
    const h = [...document.querySelectorAll('h1, h2, .ag-screen-title, [class*="title"]')].filter(visible).map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 2).join(' / ')
    return names.join(' + ') + (h ? ' :: ' + h.slice(0, 70) : '')
  }
  RA.buttons = () => [...document.querySelectorAll('button, a[href], [role=button], [role=tab]')].filter(e => !inRail(e) && visible(e)).map(e => label(e).slice(0, 70))
  RA.clickables = () => [...document.body.querySelectorAll('*')].filter(e => !inRail(e) && interactive(e) && visible(e)).map(e => label(e).slice(0, 80))
})()
