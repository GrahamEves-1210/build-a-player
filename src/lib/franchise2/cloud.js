// FRANCHISE CLOUD SAVE (2026-11-23, a player: "Franchise almost never saves progress when signing out and back in").
// A franchise lived only in this browser's storage: Safari empties a site's storage after a week away, and a new
// device starts with nothing. A signed-in player's saved franchise (football's and basketball's, every slot) now goes
// to the account too, in Career's table (careers: one row per user + key, supabase/careers.sql), as the same packed
// text the device keeps. The device copy stays the source of truth while it's there:
//   push: a few seconds after a save (a burst of saves is one upsert), and when the page is hidden
//   pull: the slot screen asks for the account's copies; one lands only where the slot is empty, or where it's this
//         account's own save and the cloud copy is newer (another device played on). Someone else's save on a shared
//         device is never written over.
// Every failure is silent: signed out, offline, or no table just means the device copy carries on alone.
import { supabase } from '../supabase'

const DEBOUNCE_MS = 4000
const TIMEOUT_MS = 3000
const ROW = key => `fr:${key}`                 // careers.sport: 'fr:bap_fr2_slot_0', 'fr:bap_frnba_slot_2'
const MINE = 'bap_fr_cloud_owner'               // { [storage key]: the account id that last saved it here }
const pending = new Map()                      // storage key → timer

const owners = () => { try { return JSON.parse(localStorage.getItem(MINE)) ?? {} } catch { return {} } }
const setOwner = (key, uid) => { try { const o = owners(); if (uid) o[key] = uid; else delete o[key]; localStorage.setItem(MINE, JSON.stringify(o)) } catch { /* */ } }
const atOf = raw => { try { const x = JSON.parse(raw); return x?.setup ? null : Number(x?.at) || 0 } catch { return null } }
async function uidNow() {
  if (!supabase) return null
  try { const { data } = await supabase.auth.getSession(); return data?.session?.user?.id ?? null } catch { return null }
}

async function push(key) {
  const uid = await uidNow()
  if (!uid) return
  let raw = null
  try { raw = localStorage.getItem(key) } catch { /* */ }
  const at = raw ? atOf(raw) : null
  if (!raw || !at) return                      // (a setup in progress isn't sent: only a franchise that's begun)
  const own = owners()[key]
  if (own && own !== uid) return               // (another account's save on this device stays out of this one's)
  setOwner(key, uid)
  try {
    const { error } = await supabase.from('careers').upsert({ user_id: uid, sport: ROW(key), data: { raw, at }, updated_at: new Date(at).toISOString() }, { onConflict: 'user_id,sport' })
    if (error) console.warn('[franchise cloud] save failed:', error.code, error.message)
  } catch { /* */ }
}

// after a save (saveFranchise, saveNba): send it a few seconds later
export function queueFranchiseCloud(key) {
  if (!supabase || typeof window === 'undefined') return
  clearTimeout(pending.get(key))
  pending.set(key, setTimeout(() => { pending.delete(key); push(key) }, DEBOUNCE_MS))
}
export function flushFranchiseCloud() {
  for (const [key, t] of pending) { clearTimeout(t); pending.delete(key); push(key) }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushFranchiseCloud)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushFranchiseCloud() })
}

// a deleted save: off the account too, so the slot screen can't bring it back
export async function dropFranchiseCloud(key) {
  clearTimeout(pending.get(key)); pending.delete(key)
  const own = owners()[key]
  setOwner(key, null)
  const uid = await uidNow()
  if (!uid || (own && own !== uid)) return
  try { await supabase.from('careers').delete().eq('user_id', uid).eq('sport', ROW(key)) } catch { /* */ }
}

// The slot screen: the account's copies of these storage keys onto the device where they belong.
// Resolves true when any slot changed (the screen draws again).
export async function pullFranchiseCloud(keys) {
  const uid = await uidNow()
  if (!uid) return false
  try {
    const q = supabase.from('careers').select('sport,data').eq('user_id', uid).in('sport', keys.map(ROW))
      .then(({ data, error }) => (error ? null : data ?? []))
    const rows = await Promise.race([q, new Promise(res => setTimeout(() => res(null), TIMEOUT_MS))])
    if (!rows) return false
    let changed = false
    const own = owners()
    for (const r of rows) {
      const key = String(r.sport).slice(3), cloud = r.data
      if (!cloud?.raw || !cloud.at) continue
      let raw = null
      try { raw = localStorage.getItem(key) } catch { /* */ }
      const empty = !raw, mine = own[key] === uid, newer = cloud.at > (atOf(raw ?? '') ?? Infinity)
      if (empty || (mine && newer)) {
        try { localStorage.setItem(key, cloud.raw); setOwner(key, uid); changed = true } catch { /* */ }
      }
    }
    return changed
  } catch { return false }
}
