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

// ads: units to add after the destroy ([] = none, e.g. the splash page)
export function rampPage({ ads = [], path } = {}) {
  ready = new Promise(resolve => {
    queue(() => {
      let destroyed
      try { destroyed = window.ramp.destroyUnits('all') } catch { destroyed = null }
      Promise.resolve(destroyed)
        .catch(() => {})
        .then(() => {
          if (!ads.length) return
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
