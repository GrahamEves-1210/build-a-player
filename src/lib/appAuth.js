// App-only OAuth (Discord, Apple). The website sends you to Discord and back to its
// own URL; the app can't, so it opens Discord in an in-app browser and has
// Supabase return to the app's own link (com.buildaplayer.app://auth). The
// app catches that link, closes the browser and trades the one-time code for a
// session (PKCE). onAuthStateChange then runs the same finishing steps as the
// website (joining the Discord server, picking up the username).
//
// Setup outside the code: Supabase → Authentication → URL Configuration →
// Redirect URLs must include  com.buildaplayer.app://auth
// The scheme is registered in ios/App/App/Info.plist and AndroidManifest.xml.

import { Browser } from '@capacitor/browser'
import { App as CapApp } from '@capacitor/app'
import { supabase } from './supabase'

export const APP_REDIRECT = 'com.buildaplayer.app://auth'
const SCOPES = 'identify email guilds.join'

// kind: 'signin' (sign in / create an account) or 'link' (add Discord to this account)
export const appDiscord = (kind = 'signin') => appOAuth('discord', kind)

// Sign in with Apple (app only: the App Store asks for it alongside other
// sign-ins). Same in-app browser round trip as Discord.
// Setup outside the code: Apple Developer → an App ID with "Sign in with Apple",
// a Services ID (its return URL = https://<project>.supabase.co/auth/v1/callback)
// and a Sign in with Apple key; Supabase → Authentication → Providers → Apple:
// on, with the Services ID, Team ID, Key ID and the key.
export const appApple = () => appOAuth('apple', 'signin')

async function appOAuth(provider, kind = 'signin') {
  if (!supabase) return { error: new Error('Offline') }
  const opts = { provider, options: { ...(provider === 'discord' ? { scopes: SCOPES } : { scopes: 'name email' }), redirectTo: APP_REDIRECT, skipBrowserRedirect: true } }
  const { data, error } = kind === 'link' ? await supabase.auth.linkIdentity(opts) : await supabase.auth.signInWithOAuth(opts)
  if (error || !data?.url) return { error: error ?? new Error('No sign-in link') }
  await Browser.open({ url: data.url, presentationStyle: 'popover' })
  return { error: null }
}

let started = false
export function initAppAuth() {
  if (started || !supabase) return
  started = true
  // closed the browser without finishing: let the sign-in sheet try again
  Browser.addListener('browserFinished', () => window.dispatchEvent(new CustomEvent('bap:oauth-closed')))
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.startsWith(APP_REDIRECT)) return
    try { await Browser.close() } catch {}
    try {
      const u = new URL(url)
      const q = u.searchParams
      const h = new URLSearchParams((u.hash || '').replace(/^#/, ''))
      const err = q.get('error_description') || h.get('error_description')
      if (err) { window.dispatchEvent(new CustomEvent('bap:toast-error', { detail: err })); return }
      const code = q.get('code')
      if (code) await supabase.auth.exchangeCodeForSession(code)
      else if (h.get('access_token') && h.get('refresh_token')) await supabase.auth.setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') })
      else return
      // signed in: land on the profile, like the website does after Discord
      setTimeout(() => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'profile' })), 400)
    } catch (e) {
      console.error('[discord] app sign-in failed:', e)
    }
  })
}
