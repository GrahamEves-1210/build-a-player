// Cosmetic effects (name colors and FX, avatars, nameplates, reel skins, the
// shop's previews) loop forever, and most of them repaint every frame: text gradients,
// glows and filters. A few on screen kept a phone repainting with nothing moving, and
// stuttered scrolling and sheets. So each effect plays while it's on screen for REST_MS,
// then rests on its still look ([data-fx-off]: app-game.css "FX PAUSE"). Scrolling it
// back into view or tapping it plays it again. The shop's item sheet, where you look at
// an item, loops as long as it's open.
// (entrances play once and stop on their own: not here)
const SEL = '.nt, .avb, .ntag, .ip-reel, .ip-fx'
const LOOP = '.sh-sheet'
const REST_MS = 5000

export function initFxPause() {
  if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return
  const timers = new WeakMap()
  const rest = el => el.setAttribute('data-fx-off', '')
  const play = el => {
    clearTimeout(timers.get(el))
    el.removeAttribute('data-fx-off')
    if (!el.closest(LOOP)) timers.set(el, setTimeout(() => rest(el), REST_MS))
  }
  // (each one's last answer: a skill game drops the watch while it's up, and picking it up again only acts on a change)
  const was = new WeakMap()
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (was.get(e.target) === e.isIntersecting) continue
      was.set(e.target, e.isIntersecting)
      if (e.isIntersecting) play(e.target)
      else { clearTimeout(timers.get(e.target)); rest(e.target) }
    }
  }, { rootMargin: '60px 0px' })
  const each = (node, fn) => {
    if (node.nodeType !== 1) return
    if (node.matches(SEL)) fn(node)
    node.querySelectorAll(SEL).forEach(fn)
  }
  // A skill game covers the page (html.mg-live) and nothing under it moves, but the watch is worked out again every
  // frame the game draws: it's dropped while the game's up, and picked up again as it closes. (Anything on the game's
  // own stage is still watched: that's on screen.)
  let paused = false
  const STAGE = '.mg-stage'
  // While a Blacktop court is live (html.fx-manual) there is no IntersectionObserver watch at all: with any watched
  // target in the document, Chrome ran a whole main-thread frame (style, paint, the watch) on every frame of the
  // court's compositor transitions (the six players and the ball glide all game), about twice the work. So the same
  // watch is worked out by hand, from where each one is on the screen, once a frame only while something scrolls or
  // the window resizes (and as each one appears). Same margin as the watch.
  let manual = false
  const tracked = new Set()
  // (on screen: it has a box, inside the window (the watch's 60px above and below), and inside every box that clips it)
  const clips = new WeakMap()
  const clipsOf = el => {
    let c = clips.get(el)
    if (!c) {
      c = []
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const st = getComputedStyle(a); if (st.overflowX !== 'visible' || st.overflowY !== 'visible') c.push(a) }
      clips.set(el, c)
    }
    return c
  }
  const inView = el => {
    if (!el.getClientRects().length) return false
    const r = el.getBoundingClientRect()
    if (r.bottom < -60 || r.top > innerHeight + 60 || r.right < 0 || r.left > innerWidth) return false
    for (const a of clipsOf(el)) { const q = a.getBoundingClientRect(); if (r.bottom < q.top || r.top > q.bottom || r.right < q.left || r.left > q.right) return false }
    return true
  }
  const check = el => {
    const v = inView(el)
    if (was.get(el) === v) return
    was.set(el, v)
    if (v) play(el)
    else { clearTimeout(timers.get(el)); rest(el) }
  }
  let raf = 0
  const sweep = () => { raf = 0; if (manual) tracked.forEach(check) }
  const soon = () => { if (manual && !raf) raf = requestAnimationFrame(sweep) }
  // (something new may still be sliding in, a sheet or a panel: looked at again once it has settled)
  let late = []
  const added = () => { soon(); late.forEach(clearTimeout); late = [setTimeout(soon, 450), setTimeout(soon, 1100)] }
  addEventListener('scroll', soon, { passive: true, capture: true })
  addEventListener('resize', soon, { passive: true })
  const watch = el => {
    if (manual) { tracked.add(el); added() }
    else if (!paused || el.closest(STAGE)) io.observe(el)
  }
  each(document.body, watch)
  new MutationObserver(list => {
    for (const m of list) {
      m.removedNodes.forEach(n => each(n, el => { io.unobserve(el); tracked.delete(el); clips.delete(el); clearTimeout(timers.get(el)); was.delete(el) }))
      m.addedNodes.forEach(n => each(n, watch))
    }
  }).observe(document.body, { childList: true, subtree: true })
  const root = document.documentElement
  new MutationObserver(() => {
    const m = root.classList.contains('fx-manual')
    if (m !== manual) {
      manual = m
      if (m) { io.disconnect(); each(document.body, el => tracked.add(el)); added() }
      else { tracked.clear(); paused = root.classList.contains('mg-live'); if (paused) document.querySelectorAll(STAGE).forEach(s => each(s, el => io.observe(el))); else each(document.body, el => io.observe(el)) }
      return
    }
    if (manual) return
    const live = root.classList.contains('mg-live')
    if (live === paused) return
    paused = live
    if (live) { io.disconnect(); document.querySelectorAll(STAGE).forEach(s => each(s, el => io.observe(el))) }
    else each(document.body, el => io.observe(el))
  }).observe(root, { attributes: true, attributeFilter: ['class'] })
  // a tap on a name, an avatar or a preview plays it again (and whatever effects sit inside it)
  document.addEventListener('pointerdown', e => {
    const hit = e.target instanceof Element ? e.target.closest(SEL) : null
    if (hit) each(hit, play)
  }, { passive: true, capture: true })
}
