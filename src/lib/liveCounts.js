// How many are waiting in each live queue right now, for the menus' "3 searching"
// over each Compete position and each Blacktop mode (live/src/games.js: the queues
// and lobbies post their own numbers there, and it pushes them out every few seconds
// at most). Numbers only, never who.
//
// One socket for the whole page, open while any menu that shows them is. A server
// that doesn't have the counts yet never answers: nothing shows (null), not a 0.

import { useEffect, useSyncExternalStore } from 'react'
import { LIVE_URL } from './liveUrl'

let counts = null              // { 'cp:nfl-qb': 2, 'au:bucket-big': 1, 'bt:3': 4 } once the server answers
const listeners = new Set()
let users = 0, ws = null, timer = null, tries = 0, opened = false, dead = false

const tell = () => listeners.forEach(fn => fn())

function open() {
  if (!users || dead || !LIVE_URL) return
  let me
  try { me = ws = new WebSocket(`${LIVE_URL}/counts`) } catch { return }
  ws.onopen = () => { tries = 0; opened = true }
  ws.onmessage = e => {
    if (ws !== me) return
    try {
      const m = JSON.parse(e.data)
      if (m?.t !== 'counts' || !m.counts || typeof m.counts !== 'object') return
      counts = Object.fromEntries(Object.entries(m.counts).filter(([, n]) => Number.isInteger(n) && n > 0))
      tell()
    } catch {}
  }
  ws.onclose = () => {
    if (ws !== me) return          // an old one, closed when the last menu went
    ws = null
    if (!users) return
    // never opened (a server without /counts): stop after a few goes, and show nothing
    if (!opened && tries >= 3) { dead = true; counts = null; tell(); return }
    timer = setTimeout(open, Math.min(30000, 1000 * 2 ** tries++))
  }
  ws.onerror = () => { try { me.close() } catch {} }
}

function hold() {
  if (users++ === 0) open()
  return () => {
    if (--users > 0) return
    clearTimeout(timer); timer = null
    try { ws?.close(1000, 'bye') } catch {}
    ws = null; opened = false; tries = 0; counts = null
  }
}

// the counts while `on` (null until the server answers)
export function useLiveCounts(on = true) {
  useEffect(() => (on ? hold() : undefined), [on])
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => (on ? counts : null), () => null)
}

// a queue's number: null when there's nothing to show (no counts yet, or nobody there)
export const searching = (all, key) => (all && all[key] > 0 ? all[key] : null)
