// Ad rail preview: a placeholder the size of a real bottom ad, so the new UI
// can be checked with it on screen. Website: 100px on phones (320×100), 90px
// on desktop (728×90). App: a 320×50 banner above the home bar, where the
// Playwire SDK's PWBannerView would sit. Switched in More → Ad rail preview,
// or on the website with ?rail (?rail=0 turns it off). It only shows a box —
// no ads load. With it on, html.fake-rail sets --web-rail, which the dock,
// sheets and screens keep clear of (app-game.css "Ad rail preview").

const KEY = 'bap_rail_preview'
const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
export const railPreviewOn = read

function apply(on) {
  const root = document.documentElement
  root.classList.toggle('fake-rail', on)
  let el = document.getElementById('bap-rail-preview')
  if (on && !el) {
    el = document.createElement('div')
    el.id = 'bap-rail-preview'
    el.setAttribute('aria-hidden', 'true')
    el.innerHTML = '<span><b>AD</b><i>bottom rail preview</i></span>'
    document.body.appendChild(el)
  } else if (!on && el) el.remove()
}

export function setRailPreview(on) {
  try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch {}
  apply(on)
}

export function initRailPreview() {
  const q = new URLSearchParams(window.location.search)
  if (q.has('rail')) setRailPreview(q.get('rail') !== '0')
  else apply(read())
}
