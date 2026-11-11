// Runs inside the page (injected before any of the site's code by rail-audit.mjs). Three jobs:
//   1. nothing leaves the machine that could write anywhere: analytics and every non-GET request to another host are
//      answered locally, and sockets to other hosts never open (no presence, no queue, no room)
//   2. a simulated bottom rail: the same id, position and z-index Playwire's has, at any height, with its close tab
//   3. the audit itself: scroll every scroller to its end and list what is still under the rail
(() => {
  if (window.__RA || window.top !== window) return   // (never inside a frame: the simulated ad is one)
  const RA = (window.__RA = {})
  // the site's clock can run fast (window.__RA_SPEED, set by the runner), so a season's live games and timed reveals
  // don't take the audit minutes each. The audit's own waits use the real timers
  const realTimeout = window.setTimeout.bind(window), realRaf = window.requestAnimationFrame.bind(window)
  const SPEED = +window.__RA_SPEED || 1
  if (SPEED > 1) {
    const realInterval = window.setInterval.bind(window), now = performance.now.bind(performance), t0 = now()
    window.setTimeout = (f, d, ...a) => realTimeout(f, d > 30 ? d / SPEED : d, ...a)
    window.setInterval = (f, d, ...a) => realInterval(f, d > 30 ? d / SPEED : d, ...a)
    performance.now = () => t0 + (now() - t0) * SPEED
    window.requestAnimationFrame = cb => realRaf(t => cb(t0 + (t - t0) * SPEED))
  }
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
      realTimeout(() => { this.readyState = 3; for (const e of [new Event('error'), new CloseEvent('close', { code: 1006 })]) { try { this['on' + e.type]?.(e) } catch {} this.dispatchEvent(e) } }, 60)
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
    return { top, bottom: window.innerHeight, height: window.innerHeight - top, ad: R(ad), close: R(close), z: cs.zIndex, sx: window.scrollX, sy: window.scrollY,
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
  // pinned: fixed or sticky itself, or inside something that is, before the nearest box that scrolls (what sits inside
  // a fixed scroller moves with its scroll, so it is judged with the scroller at its end instead)
  const scrolls = e => { if (e.scrollHeight - e.clientHeight <= 1) return false; const oy = getComputedStyle(e).overflowY; return oy === 'auto' || oy === 'scroll' }
  const pinned = el => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const p = getComputedStyle(e).position
      if (e !== el && scrolls(e)) return ''
      if (p === 'fixed' || p === 'sticky') return p
    }
    return ''
  }
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
  const frames = n => new Promise(r => { const step = () => (n-- > 0 ? realRaf(step) : r()); step() })
  const strip = list => list.map(({ el, ...f }) => f)   // (el is kept on the page side only)

  // entrance animations are over (a sheet still sliding up would be judged where it is not): wait for every finite
  // animation, a couple of seconds at most
  RA.settled = async (ms = 2500) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const busy = document.getAnimations().some(a => { if (a.playState !== 'running') return false; const t = a.effect?.getComputedTiming?.(); return t && Number.isFinite(t.endTime) && t.endTime < 20000 && !inRail(a.effect?.target) })
      if (!busy) break
      await new Promise(r => realTimeout(r, 100))
    }
    await frames(2)
    return Date.now() - t0
  }

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
    await new Promise(r => realTimeout(r, 80))
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
  RA.whoCovers = (px, py) => {
    const band = RA.band()
    if (!band || band.hidden) return []
    const st = document.createElement('style'); st.textContent = '*{pointer-events:auto !important}'; document.head.appendChild(st)
    const names = []
    for (const e of document.elementsFromPoint(px, py)) {
      if (inRail(e)) break
      const cs = getComputedStyle(e)
      names.push(`${label(e).slice(0, 60)} [z ${cs.zIndex}, ${cs.position}]`)
    }
    st.remove()
    return names.slice(0, 5)
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
  // a short, stable name for the screen as it stands: the scenario's own markers that are present ([selector, label]),
  // and any large fixed layer of ours on top (a sheet, a modal) by its class
  const BASE = /^(ag-home|ag-screen|ag-bg|ag-dock|ag-dock-floor|navbar|game-page-scroll|simp-page|bsim-page|mobile-tab-bar|ag-hud|drop-clip|splash-screen|versus-lobby|mg-stage)$/
  RA.name = (markers = []) => {
    const out = []
    for (const [sel, lab] of markers) { const el = [...document.querySelectorAll(sel)].find(visible); if (el) out.push(typeof lab === 'string' ? lab : sel) }
    const vw = window.innerWidth, vh = window.innerHeight
    for (const e of document.body.querySelectorAll('*')) {
      if (inRail(e)) continue
      const cs = getComputedStyle(e)
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.02) continue
      const r = e.getBoundingClientRect()
      if (r.width * r.height < vw * vh * 0.15) continue
      const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/)[0] : ''
      if (!c || BASE.test(c) || out.includes('[' + c + ']')) continue
      out.push('[' + c + ']')
    }
    return out.join(' + ') || 'base'
  }
  // ── the crawler's view of the page (scenarios.mjs crawl) ─────────────────────
  // the large fixed layers of ours that are showing, in document order (pages, screens, sheets, modals)
  const first = e => (typeof e.className === 'string' && e.className.trim() ? e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase())
  const bigFixed = () => {
    const vw = window.innerWidth, vh = window.innerHeight, out = []
    for (const e of document.body.querySelectorAll('*')) {
      if (inRail(e)) continue
      const cs = getComputedStyle(e)
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.02 || cs.pointerEvents === 'none') continue
      const r = e.getBoundingClientRect()
      if (r.width * r.height >= vw * vh * 0.15) out.push(e)
    }
    return out
  }
  // the layer a tap in the middle of the screen would land in (the open sheet, else the page)
  RA.topLayer = () => {
    const layers = bigFixed()
    for (const [fx, fy] of [[.5, .5], [.5, .3], [.5, .72], [.2, .5]]) {
      const t = document.elementsFromPoint(window.innerWidth * fx, window.innerHeight * fy).find(e => !inRail(e))
      const l = t && layers.filter(x => x.contains(t)).pop()
      if (l) return l
    }
    return null
  }
  RA.state = () => `${location.pathname}|${[...document.querySelectorAll('#root > *')].filter(visible).map(first).join(',')}|${bigFixed().map(first).join(',')}`
  const keyOf = e => `${first(e)}|${(e.getAttribute('aria-label') || e.innerText || e.value || e.getAttribute('placeholder') || '').replace(/[\d,.:%$+−-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 42)}`
  const scopeItems = () => {
    const scope = RA.topLayer() ?? document.body
    return [...scope.querySelectorAll('*')].filter(e => interactive(e) && visible(e) && !inRail(e) && !e.disabled && !e.matches('input, textarea, select, label, [contenteditable]'))
      // (a row and the button inside it: the inner one)
      .filter((e, _, all) => !all.some(o => o !== e && e.contains(o)))
  }
  // what can be pressed in the top layer: [{ key, text, cls, tab, ext }]
  RA.items = () => scopeItems().map(e => ({ key: keyOf(e), cls: first(e), text: keyOf(e).split('|')[1],
    tab: e.matches('[role=tab], [aria-selected], [aria-pressed]') || /tab|pill|seg|chip|toggle|switch|filter|mode\b|pos\b|sort/i.test(typeof e.className === 'string' ? e.className : ''),
    ext: e.matches('a[href]') && (e.target === '_blank' || !isLocal(e.href) || /^(mailto|tel):/.test(e.getAttribute('href'))) }))
  RA.clickKey = key => { const el = scopeItems().find(e => keyOf(e) === key); if (!el) return false; el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.click(); return true }
  RA.content = () => { const s = RA.topLayer() ?? document.body; return `${(s.innerText || '').replace(/[\d\s]+/g, '').length}:${s.querySelectorAll('*').length}` }
  // close the top layer the way a player would: its close/back button, else Escape
  RA.closeTop = () => {
    const l = RA.topLayer()
    const b = l && [...l.querySelectorAll('button, [role=button], a')].find(e => visible(e) && /close|back|dismiss|done|cancel|got it|not now|skip/i.test(`${e.getAttribute('aria-label') || ''} ${typeof e.className === 'string' ? e.className : ''} ${(e.innerText || '').trim().slice(0, 14)}`))
    if (b) { b.click(); return 'button' }
    for (const t of [document.activeElement, document.body, document, window]) t?.dispatchEvent?.(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }))
    return 'esc'
  }

  // a small pop-up that is not a full layer (a drop-down menu): something absolutely/fixed positioned, on top, with
  // menu items in it. Closed by a press outside it
  RA.popupOpen = () => !!document.querySelector('[role=menu], [role=listbox], [class*="dropdown"]:not([hidden]), [class*="-menu"][class*="open"], .pos-menu, .tab-menu')
  RA.tapOutside = () => {
    const x = 3, y = Math.round(window.innerHeight * 0.5), t = document.elementFromPoint(x, y) ?? document.body
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) t.dispatchEvent(new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }))
    return label(t)
  }

  // the screen in a few lines, for writing scenarios: its signature and the clickable things in view
  RA.brief = (max = 30) => {
    const vh = window.innerHeight
    const list = [...document.body.querySelectorAll('*')].filter(e => { if (inRail(e) || !interactive(e)) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && !e.matches('.ps-tile, .splash-site-footer-link, .ntag-link') && shown(e) })
    const hit = list.filter(e => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2))); return t && (e === t || e.contains(t) || inRail(t)) })
    return [RA.sig(), ...hit.slice(0, max).map(e => '  ' + label(e).slice(0, 78)), ...(hit.length > max ? [`  (+${hit.length - max} more)`] : [])].join('\n')
  }
  RA.buttons = () => [...document.querySelectorAll('button, a[href], [role=button], [role=tab]')].filter(e => !inRail(e) && visible(e)).map(e => label(e).slice(0, 70))
  RA.clickables = () => [...document.body.querySelectorAll('*')].filter(e => !inRail(e) && interactive(e) && visible(e)).map(e => label(e).slice(0, 80))
})()
