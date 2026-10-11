// A live game in progress (Compete, the Trait Auction, a Blacktop or 1v1
// build): you're locked in. Every way out — the dock, the More sheet, the
// browser's back button, a reload — asks first, and leaving forfeits the game.
//
//   setLiveLock({ title, body, forfeit })   while the game is live (null to clear)
//   guardLeave(go)                          run `go` now, or (locked) ask first:
//                                           confirming forfeits, then goes
// A mode with its own leave sheet passes { ask: go => … } instead, and
// { ownBack: true } when it already traps the back button.

let lock = null
const subs = new Set()
export function setLiveLock(l) { lock = l; subs.forEach(f => { try { f(lock) } catch {} }) }
export const liveLock = () => lock
export const onLiveLock = f => { subs.add(f); return () => subs.delete(f) }
export function guardLeave(go) {
  if (!lock) { go?.(); return true }
  if (lock.ask) { lock.ask(go); return false }
  window.dispatchEvent(new CustomEvent('bap:live-leave', { detail: { go } }))
  return false
}
// Confirmed: the game is forfeited, the lock comes off, then away we go
export function forfeitAndGo(go) {
  const l = lock
  setLiveLock(null)
  try { l?.forfeit?.() } catch {}
  go?.()
}
