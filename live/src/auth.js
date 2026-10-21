// Who's saying hello, from their Supabase session (the phone sends its token with every
// hello; lib/blacktopServer.js liveSocket). The name shown in lobbies and chat is the
// account's own username (accounts.username: unique and clean, supabase/account_guards.sql),
// never one the phone typed; no session, or one that doesn't check out: a Guest.
// Answers are kept for a few minutes so a reconnect doesn't ask again.

const cache = new Map()   // token → { uid, name, until }
const TTL = 5 * 60 * 1000

export async function whoIs(token, env) {
  if (!token || typeof token !== 'string' || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return { uid: null, name: 'Guest' }
  const hit = cache.get(token)
  if (hit && hit.until > Date.now()) return hit
  let who = { uid: null, name: 'Guest' }
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } })
    const u = r.ok ? await r.json() : null
    if (u?.id) {
      const a = await fetch(`${env.SUPABASE_URL}/rest/v1/accounts?id=eq.${u.id}&select=username`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } })
      const row = a.ok ? (await a.json())?.[0] : null
      who = { uid: u.id, name: String(row?.username || u.user_metadata?.username || 'Player').slice(0, 24) }
    }
  } catch {}
  if (cache.size > 2000) cache.clear()
  cache.set(token, { ...who, until: Date.now() + TTL })
  return who
}
