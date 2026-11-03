// Results for the boards go through the live server, which checks them before they're
// saved (live/src/submit.js, src/lib/verifyCore.js). Until that server is set up (its
// service key; GO-LIVE.md) it answers "not set up" and the result is saved the old way;
// once the boards are locked (supabase/launch_lockdown.sql) the old way is closed.
import { supabase } from './supabase'
import { LIVE_HTTP as HTTP } from './liveUrl'

// → { ok, code } from the server, { rejected, error } if it refused the result,
//   or null when it can't take results yet (the caller saves the old way)
async function viaServer(kind, payload) {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession().catch(() => ({ data: null }))
  const token = data?.session?.access_token
  if (!token) return null
  try {
    const r = await fetch(`${HTTP}/api/submit/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    // an older server (426), or one without its service key (503): the old way
    if ([404, 405, 426, 503].includes(r.status)) return null
    const j = await r.json().catch(() => ({}))
    if (r.status === 422) return { rejected: true, error: j.error ?? 'not accepted' }
    return { ok: !!j.ok, code: j.code ?? null, error: j.ok ? null : (j.message ?? j.error ?? `error ${r.status}`) }
  } catch { return null }
}

// The answer in the shape a Supabase insert gives ({ error }), so callers keep their handling
const asInsert = r => ({ error: r.ok ? null : r.code === '23505' ? { code: '23505' } : { code: r.rejected ? 'rejected' : r.code, message: r.error } })

export async function saveSeason(sport, pos, mode, row) {
  const r = await viaServer('season', { sport, pos, mode, row })
  if (r) return asInsert(r)
  return supabase.from('simulations').insert(row)
}

// Salary Cap: the server checks the picks against the day's board (or an Infinite board's
// prices) and works out the score itself
export async function saveSalary({ sport, infinite, date, picks, pos, sent }, row, table) {
  const r = await viaServer('salary', { sport, infinite: !!infinite, date, picks, pos, sent })
  if (r) return asInsert(r)
  return supabase.from(table).insert(row)
}

export async function saveDaily(row) {
  const r = await viaServer('daily', { day: row.day, build: row.build })
  if (r) return asInsert(r)
  return supabase.from('daily_challenge_results').insert(row)
}
