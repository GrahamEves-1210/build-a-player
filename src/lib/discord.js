import { supabase } from './supabase'
import { IS_APP } from './platform'

// Discord sign-in. `guilds.join` lets functions/api/discord-join.js add the
// player to the Build-A-Player server right after they sign in.
const SCOPES = 'identify email guilds.join'
const returnTo = () => window.location.origin + window.location.pathname

// Sign in / create an account with Discord (leaves the page, comes back signed in)
export function signInWithDiscord() {
  if (IS_APP) return import('./appAuth').then(m => m.appDiscord('signin'))   // in-app browser, back to the app
  return supabase.auth.signInWithOAuth({ provider: 'discord', options: { scopes: SCOPES, redirectTo: returnTo() } })
}

// Add Discord to an existing username/password account (profile page)
export function connectDiscord() {
  if (IS_APP) return import('./appAuth').then(m => m.appDiscord('link'))
  return supabase.auth.linkIdentity({ provider: 'discord', options: { scopes: SCOPES, redirectTo: returnTo() } })
}

export const hasDiscord = user => !!user?.identities?.some(i => i.provider === 'discord')

// The name to show / save for a player — never their real email. Username
// accounts sign in with a hidden `name@buildaplayer.app` email, so its first
// part is their username; Discord accounts fall back to their Discord name
// until discord-join gives them a username. Returns null when there's nothing.
export function getUsername(user) {
  if (!user) return null
  const m = user.user_metadata ?? {}
  if (m.username) return m.username
  if (user.email?.endsWith('@buildaplayer.app')) return user.email.split('@')[0]
  const discordName = m.custom_claims?.global_name || m.full_name || m.name
  return discordName ? String(discordName).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || null : null
}

// Call from onAuthStateChange. Discord's token is only on the session right
// after the redirect back, so this runs once per sign-in. Resolves the
// refreshed user when the server gave a Discord account its username, else null.
let usernameRetried = false
export async function finishDiscordSignIn(session) {
  if (!session?.user || !hasDiscord(session.user)) return null
  const providerToken = session.provider_token
  if (providerToken) {
    const key = `bap_discord_done_${providerToken.slice(-12)}`
    try { if (sessionStorage.getItem(key)) return null; sessionStorage.setItem(key, '1') } catch {}
  } else {
    // No fresh Discord token (a normal page load): only worth calling if a
    // Discord account still has no username — e.g. the first call failed.
    if (session.user.user_metadata?.username || usernameRetried) return null
    usernameRetried = true
  }

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/discord-join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerToken }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { console.error('[discord] join failed:', body.error); return null }
    if (body.username && body.username !== session.user.user_metadata?.username) {
      const { data } = await supabase.auth.refreshSession()   // pick up the new username
      return data?.user ?? null
    }
  } catch (e) {
    console.error('[discord] join failed:', e)
  }
  return null
}
