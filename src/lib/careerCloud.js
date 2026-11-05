// CAREER CLOUD SAVE — signed-in players keep their career in Supabase
// (table `careers`, one row per user + sport; supabase/careers.sql) so it
// follows them across devices. localStorage stays the source of truth on the
// device: every save lands there first, and the cloud copy is pushed a few
// seconds later (debounced). Every failure here is silent: offline, signed
// out, or the table missing just means the local copy carries on alone.
// The local/cloud merge (newer `updatedAt` wins) lives in lib/career.js.

import { supabase } from './supabase'

const DEBOUNCE_MS = 3000
const FETCH_TIMEOUT_MS = 2500
const pending = new Map()   // `${uid}:${sport}` → { timer, c }

// a slot is its own row: 'nfl', 'nfl#1', 'nfl#2'
const sportKey = (sport, slot = 0) => (slot ? `${sport}#${slot}` : sport)
// App binaries from before the DL crash on a DL career, and they read only the rows above.
// A DL career saves to its own row, which they never see.
const lineKey = (sport, slot = 0) => `dl:${sportKey(sport, slot)}`
const rowOf = c => ({
  user_id: c.uid,
  sport: c.pos === 'dl' ? lineKey(c.sport, c.slot) : sportKey(c.sport, c.slot),
  data: c,
  updated_at: new Date(c.updatedAt || Date.now()).toISOString(),
})

async function push(c) {
  if (!supabase || !c?.uid) return
  try {
    const { error } = await supabase.from('careers').upsert(rowOf(c), { onConflict: 'user_id,sport' })
    if (error) console.warn('[career cloud] save failed:', error.code, error.message)
  } catch {}
}

// Debounced: a burst of saves (every tap in a season) becomes one upsert
export function queueCloudSave(c) {
  if (!supabase || !c?.uid || !c.sport) return
  const k = `${c.uid}:${sportKey(c.sport, c.slot)}`
  const prev = pending.get(k)
  if (prev) clearTimeout(prev.timer)
  const timer = setTimeout(() => { pending.delete(k); push(c) }, DEBOUNCE_MS)
  pending.set(k, { timer, c })
}

// Send anything still waiting (the page is being hidden or closed)
export function flushCloudSaves() {
  for (const [k, { timer, c }] of pending) { clearTimeout(timer); pending.delete(k); push(c) }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushCloudSaves)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCloudSaves() })
}

// The account's cloud copy: the career object, null when the account has
// none, or undefined when the cloud couldn't be reached (then local wins).
export async function fetchCloudCareer(sport, uid, slot = 0) {
  if (!supabase || !uid) return undefined
  try {
    const q = supabase.from('careers').select('data').eq('user_id', uid).in('sport', [sportKey(sport, slot), lineKey(sport, slot)])
      .then(({ data, error }) => (error ? undefined : (data ?? []).reduce((keep, r) => (!keep || (r.data?.updatedAt ?? 0) > (keep.updatedAt ?? 0) ? r.data : keep), null)))
    const timeout = new Promise(res => setTimeout(() => res(undefined), FETCH_TIMEOUT_MS))
    return await Promise.race([q, timeout])
  } catch { return undefined }
}

// A finished career cleared for a new one: drop the cloud copy too, so it
// can't be pulled back down on the next open
export function deleteCloudCareer(sport, uid, slot = 0) {
  if (!supabase || !uid) return
  const k = `${uid}:${sportKey(sport, slot)}`
  const prev = pending.get(k)
  if (prev) { clearTimeout(prev.timer); pending.delete(k) }
  try {
    supabase.from('careers').delete().eq('user_id', uid).in('sport', [sportKey(sport, slot), lineKey(sport, slot)])
      .then(({ error }) => { if (error) console.warn('[career cloud] delete failed:', error.code, error.message) }, () => {})
  } catch {}
}
