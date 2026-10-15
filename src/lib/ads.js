import { useEffect, useRef } from 'react'

// Playwire (Ramp) ads for the single-page site.
//
// Every page change goes through rampPage(): destroy every unit ('all'), wait
// for that to finish, then add exactly the units that page runs with one
// spaAds call (it also counts the pageview and sets the path explicitly, since
// the URL sync effects run after the page change). In-page units (rampAdd) wait
// for the same destroy, so a page change can't wipe a unit the new page just
// asked for. destroyUnits takes 'all' or slot names (e.g. pw-oop-left_rail),
// not unit types — rampDestroyType() maps a type to the slots that use it.

const queue = fn => {
  window.ramp = window.ramp || {}
  window.ramp.que = window.ramp.que || []
  window.ramp.que.push(fn)
}

// The latest page change's destroy + re-add; in-page units wait on it
let ready = Promise.resolve()

const OOP = type => ({ type })
// Off-page units by page kind. The left rail only runs on the simulate pages,
// Salary Cap and the Depth Chart.
export const RAIL_UNITS = [OOP('corner_ad_video'), OOP('bottom_rail')]
export const RAIL_UNITS_WITH_LEFT = [OOP('corner_ad_video'), OOP('left_rail'), OOP('bottom_rail')]

// The bottom rail's slots, by name. A rail the player closed isn't always
// cleared by destroyUnits('all'), and then it's never requested again: it's
// removed by name too, so every request brings it back
const railSlots = () => Object.entries(window.ramp?.settings?.slots ?? {})
  .filter(([, s]) => s?.type === 'bottom_rail')
  .map(([name]) => name)
// Requests of the rail are kept at least this far apart (refreshing faster is
// what ad networks police)
export const RAIL_GAP_MS = 30000
let lastRail = 0

// Phones skip the corner video: there it sat on top of half the bottom rail (an
// ad covering an ad), so a phone runs the rail alone. Desktop keeps it.
const onPhone = () => !!window.matchMedia?.('(max-width: 768px)').matches
const forScreen = ads => (onPhone() ? ads.filter(a => a.type !== 'corner_ad_video') : ads)

// ads: units to add after the destroy ([] = none, e.g. the splash page)
export function rampPage({ ads: wanted = [], path } = {}) {
  const ads = forScreen(wanted)
  ready = new Promise(resolve => {
    queue(() => {
      let destroyed
      try { destroyed = window.ramp.destroyUnits('all') } catch { destroyed = null }
      Promise.resolve(destroyed)
        .catch(() => {})
        .then(() => { const left = railSlots(); return left.length ? window.ramp.destroyUnits(left) : null })
        .catch(() => {})
        .then(() => {
          if (!ads.length) return
          if (ads.some(a => a.type === 'bottom_rail')) lastRail = Date.now()
          return window.ramp.spaAds({ ads, countPageview: true, ...(path ? { path } : {}) })
        })
        .catch(() => {})
        .finally(resolve)
    })
  })
  return ready
}

// In-page units (e.g. { type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-sim' })
export function rampAdd(ads) {
  // read `ready` after the current render's effects, so a page change in the
  // same commit is waited for too
  Promise.resolve()
    .then(() => ready)
    .then(() => queue(() => { try { window.ramp.spaAddAds(ads) } catch {} }))
}

// Destroy every slot of one unit type (destroyUnits wants slot names)
// (after any page change in progress, which may already have removed them)
export function rampDestroyType(type) {
  Promise.resolve()
    .then(() => ready)
    .then(() => queue(() => {
      const slots = Object.entries(window.ramp?.settings?.slots ?? {})
        .filter(([, s]) => s?.type === type)
        .map(([name]) => name)
      if (slots.length) { try { window.ramp.destroyUnits(slots) } catch {} }
    }))
}

// The bottom rail on its own, between page changes (a tab in the nav, a spin):
// its slots removed, then requested again, closed or not. At most once every
// RAIL_GAP_MS; never for ad-free players
export function rampRail() {
  if (Date.now() - lastRail < RAIL_GAP_MS) return
  if (document.documentElement.classList.contains('ads-hidden')) return
  lastRail = Date.now()
  Promise.resolve()
    .then(() => ready)
    .then(() => queue(() => {
      const slots = railSlots()
      let gone
      try { gone = slots.length ? window.ramp.destroyUnits(slots) : null } catch { gone = null }
      Promise.resolve(gone).catch(() => {}).then(() => { try { window.ramp.spaAddAds([{ type: 'bottom_rail' }]) } catch {} })
    }))
}

// The rail again when a mode moves on without a page change (the next screen of
// a season, a Career game, a Takeover city, a Blacktop game, an auction lot):
// whenever `key` changes after the first render. rampRail keeps it to once
// every RAIL_GAP_MS, so a fast-changing key costs nothing extra.
export function useRailOn(key) {
  const seen = useRef(key)
  useEffect(() => {
    if (seen.current === key) return
    seen.current = key
    rampRail()
  }, [key])
}
