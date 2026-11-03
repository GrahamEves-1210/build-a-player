// Other players' looks (avatar, name color/effect, nameplate, victory), by
// account id: read from accounts.cos, the public copy each player's game
// writes of what they have equipped (lib/progress.js). Batched and cached, so a
// leaderboard of 200 names is one or two requests. Live rooms hand their
// players' looks over directly (seedCos), so those never wait on a request.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const cache = new Map()          // uid → cos | null (asked, nothing there)
const queue = new Set()
const subs = new Set()
let timer = null

function flush() {
  timer = null
  const ids = [...queue].filter(id => !cache.has(id))
  queue.clear()
  if (!supabase || !ids.length) return
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    chunk.forEach(id => cache.set(id, null))
    supabase.from('accounts').select('id, cos').in('id', chunk).then(({ data }) => {
      for (const r of data ?? []) if (r.cos) cache.set(r.id, r.cos)
      subs.forEach(fn => fn())
    }, () => {})
  }
}

export function cosFor(uid) {
  if (!uid || typeof uid !== 'string') return null
  if (!cache.has(uid)) { queue.add(uid); if (!timer) timer = setTimeout(flush, 40) }
  return cache.get(uid) ?? null
}
export function seedCos(uid, cos) { if (uid && cos) { cache.set(uid, cos); subs.forEach(fn => fn()) } }

// A component's view of one player's look (re-renders when it arrives)
export function useCosOf(uid) {
  const [, bump] = useState(0)
  useEffect(() => {
    if (!uid) return
    const fn = () => bump(v => v + 1)
    subs.add(fn)
    return () => subs.delete(fn)
  }, [uid])
  return cosFor(uid)
}
