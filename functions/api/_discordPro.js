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
// Returns { ok, pro, linked, given, notInServer, problem } (problem: a setup mistake, in words, or null).
export async function syncProRoles(env, supabase) {
  if (!proRoleReady(env)) return { ok: false, problem: 'DISCORD_BOT_TOKEN, DISCORD_GUILD_ID or DISCORD_PRO_ROLE_ID is not set in Cloudflare' }
  // the Pro accounts
  const pro = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('accounts').select('id').eq('subscription_status', 'active').range(from, from + 999)
    if (error) return { ok: false, problem: `accounts read: ${error.message}` }
    data.forEach(r => pro.add(r.id))
    if (data.length < 1000) break
  }
  // their Discord ids (the sign-in list, a thousand at a time: one call for many accounts)
  const linked = []
  for (let page = 1; pro.size && linked.length < pro.size; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return { ok: false, problem: `users read: ${error.message}` }
    for (const u of data.users) if (pro.has(u.id)) { const d = discordIdOf(u); if (d) linked.push(d) }
    if (data.users.length < 1000) break
  }
  let given = 0, notInServer = 0, problem = null
  for (const d of linked) {
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
  return { ok: !problem, pro: pro.size, linked: linked.length, given, notInServer, problem }
}
