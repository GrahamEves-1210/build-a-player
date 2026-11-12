// The simulated bottom rail and the check itself. Two users: the audit (scripts/rail-audit.mjs injects this file
// into the page) and the dev server's rail preview (src/lib/railGuard.js loads the same file, so what the audit
// fails is what the preview outlines).
//   1. a simulated rail: the same id, position and z-index Playwire's has, at any height, with its close tab
//   2. the check: what interactive element is under the rail's band, pinned there or at the end of its scroller
(() => {
  if (window.top !== window) return   // (never inside a frame: the simulated ad is one)
  const RA = (window.__RA ??= {})
  if (RA.setRail) return
  const realTimeout = RA.realTimeout ?? window.setTimeout.bind(window), realRaf = RA.realRaf ?? window.requestAnimationFrame.bind(window)

  // ── 1. the simulated rail ───────────────────────────────────────────────────
  // kind 'rail': Playwire's own element (#pw-oop-bottom_rail, data-pw-status=loaded, fixed to the bottom, z-index 199
  // forced inline), the creative in an iframe, the close tab standing above the box.
  // kind 'sticky': the taller unit that is sometimes stacked at the bottom instead, on the very top layer: no id and no
  // class at all (the site can only know it as a third-party box, fixed to the bottom edge, with an ad's iframe in it).
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
      // (the unnamed unit has no id and no class the site could know it by: only what it is)
      if (kind === 'rail') { el.id = 'pw-oop-bottom_rail'; el.setAttribute('data-pw-status', 'loaded') }
      el.setAttribute('data-rail-audit', kind)
      el.innerHTML = '<div data-ra-wrap><button type="button" class="pw-rail-close" aria-label="Close ad" data-ra-close></button><iframe data-ra-ad title="ad" scrolling="no" frameborder="0"></iframe></div>'
      document.body.appendChild(el)
    }
    const w = Math.min(window.innerWidth, window.innerWidth >= 768 ? 728 : 320)
    // (a rail that is already there keeps the layer the site has given it: only a new one arrives with Playwire's own
    // z-index, forced inline, for the site to correct)
    if (!el.style.position) el.style.cssText = `position:fixed;left:0;right:0;bottom:0;margin:0;padding:6px 0 0;box-sizing:border-box;text-align:center;line-height:0;z-index:${kind === 'rail' ? 199 : 2147483000} !important;`
    el.style.height = `${h}px`
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
    // (while the site has its ads off, a mini game or an ad-free player, it takes the real units down: no rail)
    if (cs.display === 'none' || cs.visibility === 'hidden' || document.documentElement.classList.contains('ads-hidden')) return { hidden: true }
    const ad = el.querySelector('[data-ra-ad]').getBoundingClientRect(), close = el.querySelector('[data-ra-close]').getBoundingClientRect()
    if (ad.height < 1) return { hidden: true }
    const top = Math.min(el.getBoundingClientRect().top, ad.top, close.height ? close.top : ad.top)
    const R = r => ({ x: r.left, y: r.top, width: r.width, height: r.height })
    return { top, bottom: window.innerHeight, height: window.innerHeight - top, ad: R(ad), close: R(close), z: cs.zIndex, sx: window.scrollX, sy: window.scrollY,
      measured: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--web-rail')) || 0,
      adH: getComputedStyle(document.documentElement).getPropertyValue('--ad-h').trim() }
  }

  // ── 2. the check ────────────────────────────────────────────────────────────
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
    // (a screen that grew or scrolled itself back since: every scroller is put at its end again before the look)
    for (let k = 0; k < 3; k++) {
      let moved = false
      for (const s of scrollers()) {
        const room = s === document.scrollingElement ? window.innerHeight : s.clientHeight
        if (s.scrollTop + room < s.scrollHeight - 1) { if (!(saved ??= []).some(x => x[0] === s)) saved.push([s, s.scrollTop]); s.scrollTo({ top: s.scrollHeight, behavior: 'instant' }); moved = true }
      }
      if (!moved) break
      await frames(2)
    }
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

  // as the page stands (the dev preview asks this as you move around): what is under the rail and cannot be scrolled
  // clear of it, because it is pinned there or every scroller around it is already at its end
  const atEnd = s => s.scrollTop + (s === document.scrollingElement ? window.innerHeight : s.clientHeight) >= s.scrollHeight - 2
  const stuck = el => {
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) if (e !== document.body && scrolls(e) && !atEnd(e)) return false
    const se = document.scrollingElement
    return !(scrollers().includes(se) && !atEnd(se))
  }
  RA.scan = () => { const band = RA.band(); return !band || band.hidden ? [] : under(band, false).filter(f => !f.big && (f.pin || stuck(f.el))) }

  // (for helpers.js and the dev preview)
  RA._ = { inRail, interactive, hasHandler, shown, label, pinned, scrolls, under, frames }
})()
