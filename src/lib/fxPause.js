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
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) play(e.target)
      else { clearTimeout(timers.get(e.target)); rest(e.target) }
    }
  }, { rootMargin: '60px 0px' })
  const each = (node, fn) => {
    if (node.nodeType !== 1) return
    if (node.matches(SEL)) fn(node)
    node.querySelectorAll(SEL).forEach(fn)
  }
  each(document.body, el => io.observe(el))
  new MutationObserver(list => {
    for (const m of list) {
      m.removedNodes.forEach(n => each(n, el => { io.unobserve(el); clearTimeout(timers.get(el)) }))
      m.addedNodes.forEach(n => each(n, el => io.observe(el)))
    }
  }).observe(document.body, { childList: true, subtree: true })
  // a tap on a name, an avatar or a preview plays it again (and whatever effects sit inside it)
  document.addEventListener('pointerdown', e => {
    const hit = e.target instanceof Element ? e.target.closest(SEL) : null
    if (hit) each(hit, play)
  }, { passive: true, capture: true })
}
