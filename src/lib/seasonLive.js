// A football season in progress, kept on the device so a reload (or iOS Safari dropping the tab) picks it back up
// where it was: the build, the season as first simulated, the director's seed and its saved state at the last stop,
// how far the reveal got, the screen, and once booked the booked season itself (owner 11-14).
//
// Honest by construction:
//  - the season is simulated once; a reload restores it, it never rolls a new one (App's handleTeamPicked resumes
//    a season in progress for the same build instead of simulating again)
//  - a moment's outcome is saved the moment it's chosen, so reloading can't re-roll it
//  - booked once: a booked season comes back as the booked season (no director, nothing to book again)
//  - a season left behind for a new build counts as played, as a reload always made it
const KEY = 'bap_season_live'
const POS = 'bap_season_live_pos'   // the reveal's place and the screen: small, written often

export function readLive() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    if (!v || v.v !== 1 || !v.sig || !v.base) return null
    let p = null
    try { p = JSON.parse(localStorage.getItem(POS)) } catch {}
    return p && p.id === v.id ? { ...v, k: p.k ?? v.k ?? 0, screen: p.screen ?? v.screen ?? 0 } : v
  } catch { return null }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...v, v: 1 })); return true } catch { return false }
}
export function startLive(rec) {
  const id = Math.random().toString(36).slice(2, 10)
  try { localStorage.removeItem(POS) } catch {}
  return write({ ...rec, id, k: 0, screen: 0, stopIdx: 0, snap: null, snapK: 0, moment: null, booked: false, final: null }) ? id : null
}
// the director's state at a stop (a moment opened or chosen): the whole record, written at once
export function saveStop(id, patch) {
  const v = readLive()
  if (!v || v.id !== id || v.booked) return false
  return write({ ...v, ...patch })
}
export function savePos(id, patch) {
  try {
    let p = null
    try { p = JSON.parse(localStorage.getItem(POS)) } catch {}
    localStorage.setItem(POS, JSON.stringify({ ...(p && p.id === id ? p : {}), id, ...patch }))
  } catch {}
}
export function bookLive(id, final) {
  const v = readLive()
  if (!v || v.id !== id) return false
  return write({ ...v, booked: true, final, snap: null, moment: null })
}
export function clearLive() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(POS) } catch {}
}
