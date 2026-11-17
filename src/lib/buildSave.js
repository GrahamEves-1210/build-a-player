// A build in progress survives a reload or a killed tab. iPhone Safari throws a tab away when the phone runs short
// of memory and loads it again when the player comes back to it, so a reload in the middle of a build is common there.
//
// Each game saves the build itself after every placement (App.jsx bap_progress, BucketApp.jsx bab_progress) and its
// spin (bap_spin_result / bab_spin_result: the build's own seed and the spin to deal next, so a reload can't reroll).
// This file remembers, for this tab only (sessionStorage), which build page the player was on when the tab went, so the
// reload lands straight back on it. A fresh visit (a new tab, the app opened again) still starts on Home, where the
// saved build waits on its CONTINUE card.

const KEY = 'bap_build_at'

// read once, as the page loads: { sport, page } or null
const atLoad = (() => {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return v && typeof v.page === 'string' ? v : null } catch { return null }
})()

// the build page this tab was on when it was reloaded (null: it wasn't on one, or it was another sport's)
export const buildPageAtLoad = sport => (atLoad?.sport === sport ? atLoad.page : null)

// on a build page: remember it; anywhere else (null): forget it, so a reload from Home stays on Home
export function markBuildPage(sport, page) {
  try {
    if (page) sessionStorage.setItem(KEY, JSON.stringify({ sport, page }))
    else sessionStorage.removeItem(KEY)
  } catch {}
}
