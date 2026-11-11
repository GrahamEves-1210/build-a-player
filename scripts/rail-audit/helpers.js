// Page-side helpers for the scenarios (after rail-sim.js): find and press things, name a screen, the crawler's view.
(() => {
  if (window.top !== window || !window.__RA?._ || window.__RA.find) return
  const RA = window.__RA
  const { inRail, interactive, hasHandler, shown, label } = RA._
  const realTimeout = RA.realTimeout
  const isLocal = RA.isLocal

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
    for (const [sel, lab] of markers) {
      // ['@struct', selector]: the kinds of block inside that container (what tells one step of a flow from the next)
      if (sel === '@struct') {
        const box = [...document.querySelectorAll(lab)].filter(visible).pop()
        if (box) out.push('{' + [...new Set([...box.children].filter(visible).map(first))].slice(0, 7).join(' ') + '}')
        continue
      }
      const el = [...document.querySelectorAll(sel)].find(visible)
      if (el) out.push(typeof lab === 'string' ? lab : sel)
    }
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
