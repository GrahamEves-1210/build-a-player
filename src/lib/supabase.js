import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const raw = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const url = raw ? raw.replace(/\/(rest|auth|storage|realtime)(\/.*)?$/, '').replace(/\/$/, '') : raw

const valid = url && key && url.startsWith('https://')

// Main client — used for auth, REST queries, everything except Realtime channels.
// The app signs in with Discord through a one-time code returned to its own
// link (lib/appAuth.js), which needs the PKCE flow; the website keeps the default.
export const supabase = valid ? createClient(url, key, Capacitor.isNativePlatform() ? { auth: { flowType: 'pkce' } } : undefined) : null

// Realtime-only client — auth is disabled so it always connects with the anon
// key. Supabase Realtime returns 403 when the user's auth token is used and no
// Realtime RLS policies exist; this client bypasses that entirely.
export const rtSupabase = valid
  ? createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInStorage: false,
      },
    })
  : null
