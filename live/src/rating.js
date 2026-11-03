// Booking results the live server decided: each player's online rating (supabase
// online_rating.sql bump_rating, which only the service key can call; the amounts in
// src/lib/rating.js) and a Blacktop game on the 1v1 record (vs_results, saved as the
// player: result_guards.sql reads the x-bap-user header). Without the service key it
// books nothing and the phones keep their own count, as before.

const svc = env => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' })
export const canBook = env => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)

// [{ vid, uid, delta }] → { vid: { rating, delta } } for the ones booked
export async function bookRatings(env, list) {
  const out = {}
  if (!canBook(env)) return out
  await Promise.all(list.filter(x => x.uid && Math.round(x.delta)).map(async x => {
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/bump_rating`, { method: 'POST', headers: svc(env), body: JSON.stringify({ p_user: x.uid, p_delta: Math.round(x.delta) }) })
      const j = r.ok ? await r.json().catch(() => null) : null
      const row = Array.isArray(j) ? j[0] : j
      if (row && Number.isFinite(row.rating)) out[x.vid] = { rating: row.rating, delta: Math.round(x.delta) }
    } catch {}
  }))
  return out
}

// [{ uid, result: 'win' | 'loss' | 'forfeit', position, match_type }]
export async function bookVs(env, rows) {
  if (!canBook(env)) return
  await Promise.all(rows.filter(r => r.uid).map(r => fetch(`${env.SUPABASE_URL}/rest/v1/vs_results`, {
    method: 'POST', headers: { ...svc(env), Prefer: 'return=minimal', 'x-bap-user': r.uid },
    body: JSON.stringify({ user_id: r.uid, result: r.result, ovr: null, position: r.position ?? null, match_type: r.match_type }),
  }).catch(() => null)))
}
