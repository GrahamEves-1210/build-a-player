// BAP Pro's Discord role, shared by discord-join.js, discord-pro-sync.js and daily-check.js. (A file starting with _ is
// not a route.) Pro is accounts.subscription_status 'active' (Stripe, or Google Play's 'play:' ids). The bot needs
// Manage Roles and its own role above BAP Pro; Cloudflare settings DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
// DISCORD_PRO_ROLE_ID.
const API = 'https://discord.com/api/v10'
const sleep = ms => new Promise(r => setTimeout(r, ms))

export const proRoleReady = env => !!(env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID && env.DISCORD_PRO_ROLE_ID)
export const discordIdOf = user => {
  const i = user?.identities?.find(x => x.provider === 'discord')
  return i ? String(i.identity_data?.provider_id ?? i.id) : null
}
export const isPro = acc => acc?.subscription_status === 'active'

// One member: 'given' | 'removed' | 'not_in_server' | 'bad_role' | 'no_permission' | 'error <status>'
export async function setProRole(env, discordId, on) {
  for (let tries = 0; tries < 3; tries++) {
    const r = await fetch(`${API}/guilds/${env.DISCORD_GUILD_ID}/members/${discordId}/roles/${env.DISCORD_PRO_ROLE_ID}`, {
      method: on ? 'PUT' : 'DELETE',
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'X-Audit-Log-Reason': on ? 'BAP Pro' : 'BAP Pro ended' },
    })
    if (r.ok) return on ? 'given' : 'removed'
    const body = await r.json().catch(() => ({}))
    if (r.status === 429) { await sleep(Math.min(5, body.retry_after ?? 1) * 1000 + 100); continue }
    // (Discord's codes: 10007 unknown member, 10011 unknown role, 50013 missing permissions)
    if (r.status === 404) return body.code === 10011 ? 'bad_role' : 'not_in_server'
    if (r.status === 403) return 'no_permission'
    return `error ${r.status}`
  }
  return 'error 429'
}

// Every Pro account with Discord linked gets the role (giving it twice is harmless). It never takes the role off
// anyone: the payment webhooks do that when Pro ends, and someone given it by hand keeps it.
// Who: supabase/discord_pro.sql's pro_discord_members() (the sign-in links themselves; the admin user list leaves them
// out). A batch at a time (from, n): Cloudflare allows a request only so many outside calls, so the caller asks for
// the next batch (discord-pro-sync.js) until done.
// Returns { ok, pro, linked, from, next (null: done), given, notInServer, problem } (problem: a setup mistake, in
// words, or null).
export const BATCH = 25
export async function syncProRoles(env, supabase, from = 0, n = BATCH) {
  if (!proRoleReady(env)) return { ok: false, problem: 'DISCORD_BOT_TOKEN, DISCORD_GUILD_ID or DISCORD_PRO_ROLE_ID is not set in Cloudflare' }
  const { count: pro, error: cErr } = await supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active')
  if (cErr) return { ok: false, problem: `accounts read: ${cErr.message}` }
  const { data: rows, error } = await supabase.rpc('pro_discord_members')
  if (error) return { ok: false, pro, problem: /pro_discord_members/.test(error.message) ? 'run supabase/discord_pro.sql in the Supabase SQL Editor first' : `Discord links read: ${error.message}` }
  const ids = [...new Set((rows ?? []).map(r => r.discord_id).filter(Boolean))]
  let given = 0, notInServer = 0, problem = null
  for (const d of ids.slice(from, from + n)) {
    const res = await setProRole(env, d, true)
    if (res === 'given') given++
    else if (res === 'not_in_server') notInServer++
    else {
      problem = res === 'no_permission' ? "the bot can't give the role: it needs Manage Roles, and its role must sit above BAP Pro in Server Settings → Roles"
        : res === 'bad_role' ? 'DISCORD_PRO_ROLE_ID is not a role in the server (copy the BAP Pro role id again)'
        : `Discord answered ${res}`
      break
    }
  }
  const next = !problem && from + n < ids.length ? from + n : null
  return { ok: !problem, pro, linked: ids.length, from, next, given, notInServer, problem }
}
