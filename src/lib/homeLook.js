import { useSyncExternalStore } from 'react'

// Classic Home: the Home from before the Nov 5 update, beside today's so the two can be
// compared (components/app/AppHomeSwitch.jsx). Per device, saved in localStorage, and it
// switches at once. ?home=classic or ?home=new in the address sets it too, then leaves
// the address clean.
//
// To hide the Settings switch, set this to false: the row goes, the saved choice is
// ignored and everyone gets today's Home (?home=classic still works, for that visit).
export const CLASSIC_HOME_SWITCH = true

const KEY = 'bap_home_classic'
const listeners = new Set()
let saved = false
try { saved = localStorage.getItem(KEY) === '1' } catch {}
let fromUrl = null   // ?home= on this visit

if (typeof window !== 'undefined') {
  try {
    const url = new URL(window.location.href)
    const v = url.searchParams.get('home')
    if (v === 'classic' || v === 'new') {
      fromUrl = v === 'classic'
      saved = fromUrl
      try { fromUrl ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch {}
      url.searchParams.delete('home')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
  } catch {}
}

export function classicHome() {
  if (fromUrl != null) return fromUrl
  return CLASSIC_HOME_SWITCH && saved
}

export function setClassicHome(on) {
  saved = !!on
  fromUrl = null
  try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch {}
  listeners.forEach(f => f())
}

const subscribe = f => { listeners.add(f); return () => listeners.delete(f) }
export const useClassicHome = () => useSyncExternalStore(subscribe, classicHome, classicHome)
