import { createClient } from '@supabase/supabase-js'

// Runs right after a Discord sign-in (or "Connect Discord" on the profile):
//  1. adds the player to the Build-A-Player Discord server, using the one-time
//     Discord token from that sign-in (they granted `guilds.join`) and our bot
//     (DISCORD_BOT_TOKEN, a member of DISCORD_GUILD_ID with Create Invite);
//  2. gives accounts created through Discord a unique, valid username — the
//     email sign-up makes usernames unique by turning them into a login email,
//     Discord accounts skip that step.
// Who the player is comes from their verified Supabase session, never the body.

const DISCORD_API = 'https://discord.com/api/v10'

// Discord display name → our username rules (letters, numbers, _ and -, max 20)
const cleanName = s => (s || '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const { providerToken } = await request.json().catch(() => ({}))

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: { user } = {}, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return Response.json({ error: 'Your session expired. Sign in again.' }, { status: 401 })

  const identity = user.identities?.find(i => i.provider === 'discord')
  if (!identity) return Response.json({ error: 'No Discord account linked' }, { status: 400 })
  const discordId = identity.identity_data?.provider_id ?? identity.id

  // ── 1. Join the server ──────────────────────────────────────────────────────
  let joined = null
  if (providerToken && env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID) {
    // The token must belong to this same Discord account
    const me = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${providerToken}` } })
    const meBody = me.ok ? await me.json() : null
    if (meBody?.id === discordId) {
      const res = await fetch(`${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members/${discordId}`, {
        method: 'PUT',
        headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: providerToken }),
      })
      // 201 = added, 204 = already a member
      joined = res.status === 201 ? 'added' : res.status === 204 ? 'already' : null
      if (!joined) console.error('[discord-join] guild add failed', res.status, await res.text())
    }
  }

  // ── 2. Username for accounts created through Discord ────────────────────────
  let username = user.user_metadata?.username ?? null
  if (!username) {
    const d = identity.identity_data ?? {}
    const base = cleanName(d.custom_claims?.global_name) || cleanName(d.full_name) || cleanName(d.name) || 'player'
    const taken = async name => {
      // case-insensitive exact match; `_` is a LIKE wildcard, so escape it
      const { data } = await supabase.from('accounts').select('id').ilike('username', name.replace(/[\\%_]/g, '\\$&')).neq('id', user.id).limit(1)
      return !!data?.length
    }
    let candidate = base.length >= 3 ? base : `${base}player`.slice(0, 20)
    for (let i = 0; i < 8 && await taken(candidate); i++) {
      candidate = `${base.slice(0, 15)}${Math.floor(100 + Math.random() * 9900)}`
    }
    username = candidate
    await supabase.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, username } })
    const { error: accErr } = await supabase.from('accounts').upsert({ id: user.id, username }, { onConflict: 'id' })
    if (accErr) console.error('[discord-join] accounts username', accErr)
  }

  return Response.json({ joined, username })
}
