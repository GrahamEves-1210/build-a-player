// A season in progress, kept on the device so a reload (or iOS Safari dropping the tab) picks it back up where it was:
// the build, the season as first simulated, the director's seed and its saved state at the last stop, how far the
// reveal got, the screen, and once booked the booked season itself (owner 11-14). One per sport: football, basketball
// ('bucket'), baseball, soccer.
//
// Honest by construction:
//  - the season is simulated once; a reload restores it, it never rolls a new one (each app's handleTeamPicked resumes
//    a season in progress for the same build instead of simulating again)
//  - a moment's outcome is saved the moment it's chosen, so reloading can't re-roll it
//  - booked once: a booked season comes back as the booked season (no director, nothing to book again)
//  - a season left behind for a new build counts as played, as a reload always made it
const keyOf = sport => (!sport || sport === 'nfl' ? 'bap_season_live' : `bap_season_live_${sport}`)
const posOf = sport => `${keyOf(sport)}_pos`   // the reveal's place and the screen: small, written often

export function readLive(sport = 'nfl') {
  try {
    const v = JSON.parse(localStorage.getItem(keyOf(sport)))
    if (!v || v.v !== 1 || !v.sig || !v.base) return null
    let p = null
    try { p = JSON.parse(localStorage.getItem(posOf(sport))) } catch {}
    return { ...v, sport, ...(p && p.id === v.id ? { k: p.k ?? v.k ?? 0, screen: p.screen ?? v.screen ?? 0 } : {}) }
  } catch { return null }
}
function write(sport, v) {
  try { localStorage.setItem(keyOf(sport), JSON.stringify({ ...v, v: 1 })); return true } catch { return false }
}
export function startLive(rec, sport = 'nfl') {
  const id = Math.random().toString(36).slice(2, 10)
  try { localStorage.removeItem(posOf(sport)) } catch {}
  return write(sport, { ...rec, sport, id, k: 0, screen: 0, stopIdx: 0, snap: null, snapK: 0, moment: null, booked: false, final: null }) ? id : null
}
// the director's state at a stop (a moment opened or chosen): the whole record, written at once
export function saveStop(live, patch) {
  const v = readLive(live.sport)
  if (!v || v.id !== live.id || v.booked) return false
  return write(live.sport, { ...v, ...patch })
}
export function savePos(live, patch) {
  try {
    let p = null
    try { p = JSON.parse(localStorage.getItem(posOf(live.sport))) } catch {}
    localStorage.setItem(posOf(live.sport), JSON.stringify({ ...(p && p.id === live.id ? p : {}), id: live.id, ...patch }))
  } catch {}
}
export function bookLive(live, final) {
  const v = readLive(live.sport)
  if (!v || v.id !== live.id) return false
  return write(live.sport, { ...v, booked: true, final, snap: null, moment: null })
}
export function clearLive(sport = 'nfl') {
  try { localStorage.removeItem(keyOf(sport)); localStorage.removeItem(posOf(sport)) } catch {}
}
// A new build (or Start Over): a season in progress left behind counts as played, as a reload always made it
export function leaveLive(sport, markPlayed) {
  const v = readLive(sport)
  if (!v) return
  if (!v.booked) markPlayed(v.sig)
  clearLive(sport)
}
