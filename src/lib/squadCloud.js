// SQUAD BUILDER CLOUD SAVE: a signed-in player's squad follows the account, like Career
// (lib/careerCloud.js): the same `careers` table, one row per account under the key
// `squad:<sport>`. The device copy saves first and the cloud copy a few seconds later.
//
// Merging two copies of the account's squad (lib/squad.js):
//   • a different squad (another seed): the one started last wins
//   • the same squad: the copy with more seasons played wins, then the newer save
// so an older copy from another device can't bring back a season that was already played.

import { supabase } from './supabase'

const TABLE = 'careers'
const DEBOUNCE_MS = 3000
const FETCH_TIMEOUT_MS = 2500
const rowKey = sport => `squad:${sport}`
// App binaries from before the DL crash on a DL build, and they read only `squad:<sport>`. A squad
// with a DL saves to its own row, which they never see. Everything else stays where it was.
const lineKey = sport => `squad-dl:${sport}`
// (an LB or OL slot too: the same old binaries can't sim one)
const NEW_POS = new Set(['dl', 'lb', 'ol'])
const hasLine = sq => !!sq?.slots?.some(s => NEW_POS.has(s.pos)) || [...(sq?.seasons ?? []), sq?.last].some(y => y?.lines?.some(l => NEW_POS.has(l.pos)))
let pending = null   // { timer, sq }

async function push(sq) {
  if (!supabase || !sq?.uid) return
  try {
    await supabase.from(TABLE).upsert({ user_id: sq.uid, sport: hasLine(sq) ? lineKey(sq.sport) : rowKey(sq.sport), data: sq, updated_at: new Date(sq.updatedAt || Date.now()).toISOString() }, { onConflict: 'user_id,sport' })
  } catch {}
}
export function queueSquadSave(sq) {
  if (!supabase || !sq?.uid) return
  if (pending) clearTimeout(pending.timer)
  pending = { sq, timer: setTimeout(() => { const s = pending?.sq; pending = null; push(s) }, DEBOUNCE_MS) }
}
function flush() { if (!pending) return; clearTimeout(pending.timer); const s = pending.sq; pending = null; push(s) }
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
}

// A squad started over: drop the cloud copy so it can't come back
export function deleteCloudSquad(sport, uid) {
  if (!supabase || !uid) return
  if (pending?.sq?.sport === sport) { clearTimeout(pending.timer); pending = null }
  try { supabase.from(TABLE).delete().eq('user_id', uid).in('sport', [rowKey(sport), lineKey(sport)]).then(() => {}, () => {}) } catch {}
}

// The account's copy: the squad, null when there's none, undefined when the cloud couldn't be reached
export async function fetchCloudSquad(sport, uid) {
  if (!supabase || !uid) return undefined
  try {
    const q = supabase.from(TABLE).select('data').eq('user_id', uid).in('sport', [rowKey(sport), lineKey(sport)])
      .then(({ data, error }) => (error ? undefined : (data ?? []).reduce((keep, r) => mergeSquads(keep, r.data), null)))
    return await Promise.race([q, new Promise(res => setTimeout(() => res(undefined), FETCH_TIMEOUT_MS))])
  } catch { return undefined }
}

// Two copies of the account's squad → the one to keep (see the top of the file)
export function mergeSquads(a, b) {
  if (!a) return b ?? null
  if (!b) return a
  if (a.seed !== b.seed) return (b.started ?? 0) > (a.started ?? 0) ? b : a
  const played = s => s.seasons?.length ?? 0
  if (played(a) !== played(b)) return played(b) > played(a) ? b : a
  return (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a
}
