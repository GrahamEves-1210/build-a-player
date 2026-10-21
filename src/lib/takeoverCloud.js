// TAKEOVER CLOUD SAVE — a signed-in player's solo run follows the account, like Career
// (lib/careerCloud.js): the same `careers` table, one row per account under the key
// `takeover:<sport>`. The device copy saves first and the cloud copy a few seconds later.
// Duo runs stay on the device (they belong to a live room).
//
// Merging never hands back what was already used up (lib/takeover.js run fields):
//   • a different road (another seed): the run started last wins
//   • the same road: the copy further along wins (more games played, then further up the
//     road), and finished / booked / revived stay set whichever copy had them
// so an older copy from another device can't bring back lives, a revive or beaten cities.

import { supabase } from './supabase'

const TABLE = 'careers'
const DEBOUNCE_MS = 3000
const FETCH_TIMEOUT_MS = 2500
const rowKey = sport => `takeover:${sport}`
let pending = null   // { timer, run }

const syncs = run => !!(run?.uid && run.mode !== 'duo')

async function push(run) {
  if (!supabase || !syncs(run)) return
  try {
    await supabase.from(TABLE).upsert({ user_id: run.uid, sport: rowKey(run.sport), data: run, updated_at: new Date(run.updatedAt || Date.now()).toISOString() }, { onConflict: 'user_id,sport' })
  } catch {}
}
export function queueRunSave(run) {
  if (!supabase || !syncs(run)) return
  if (pending) clearTimeout(pending.timer)
  pending = { run, timer: setTimeout(() => { const r = pending?.run; pending = null; push(r) }, DEBOUNCE_MS) }
}
function flush() { if (!pending) return; clearTimeout(pending.timer); const r = pending.run; pending = null; push(r) }
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
}

// A run ended and cleared: drop the cloud copy so it can't come back
export function deleteCloudRun(sport, uid) {
  if (!supabase || !uid) return
  if (pending?.run?.sport === sport) { clearTimeout(pending.timer); pending = null }
  try { supabase.from(TABLE).delete().eq('user_id', uid).eq('sport', rowKey(sport)).then(() => {}, () => {}) } catch {}
}

// The account's copy: the run, null when there's none, undefined when the cloud couldn't be reached
export async function fetchCloudRun(sport, uid) {
  if (!supabase || !uid) return undefined
  try {
    const q = supabase.from(TABLE).select('data').eq('user_id', uid).eq('sport', rowKey(sport)).maybeSingle()
      .then(({ data, error }) => (error ? undefined : (data?.data ?? null)))
    return await Promise.race([q, new Promise(res => setTimeout(() => res(undefined), FETCH_TIMEOUT_MS))])
  } catch { return undefined }
}

// Two copies of the account's run → the one to keep (see the top of the file)
export function mergeRuns(a, b) {
  if (!a) return b ?? null
  if (!b) return a
  if (a.seed !== b.seed) return (b.started ?? 0) > (a.started ?? 0) ? b : a
  const games = r => r.log?.length ?? 0
  const ahead = games(b) !== games(a) ? (games(b) > games(a) ? b : a)
    : (b.idx ?? 0) !== (a.idx ?? 0) ? ((b.idx ?? 0) > (a.idx ?? 0) ? b : a)
    : (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a
  return {
    ...ahead,
    lives: games(a) === games(b) ? Math.min(a.lives ?? 0, b.lives ?? 0) : ahead.lives,
    attempt: Math.max(a.attempt ?? 0, b.attempt ?? 0),
    over: !!(a.over || b.over), logged: !!(a.logged || b.logged), revived: !!(a.revived || b.revived),
  }
}
