// Ad rail preview: a placeholder the size of a real bottom ad, so the new UI
// can be checked with it on screen. Website: 100px on phones (320×100), 90px
// on desktop (728×90). App: a 320×50 banner above the home bar, where the
// Playwire SDK's PWBannerView would sit. Switched in More → Ad rail preview,
// or on the website with ?rail (?rail=0 turns it off). It only shows a box —
// no ads load. With it on, html.fake-rail sets --web-rail, which the dock,
// sheets and screens keep clear of (app-game.css "Ad rail preview").
// On by default (switch it off in More). On the website it steps aside while a
// real Playwire rail is on the page, so it never covers an actual ad.

import { IS_APP } from './platform'

const KEY = 'bap_rail_preview'
const read = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
const realRail = () => !IS_APP && !!document.querySelector('[id^="pw-oop-bottom_rail"][data-pw-status="loaded"]')
export const railPreviewOn = read

function apply(want) {
  const on = want && !realRail()
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
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch {}
  apply(on)
}

export function initRailPreview() {
  const q = new URLSearchParams(window.location.search)
  if (q.has('rail')) setRailPreview(q.get('rail') !== '0')
  else apply(read())
  // a real rail can load (or go) later: keep stepping aside for it
  if (!IS_APP) setInterval(() => apply(read()), 2000)
}
