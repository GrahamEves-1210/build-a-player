import { createClient } from '@supabase/supabase-js'

const raw = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const url = raw ? raw.replace(/\/(rest|auth|storage|realtime)(\/.*)?$/, '').replace(/\/$/, '') : raw

const valid = url && key && url.startsWith('https://')

// Main client — used for auth, REST queries, everything except Realtime channels.
export const supabase = valid ? createClient(url, key) : null

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

// Headers for our own /api endpoints: the server reads who the player is from
// their session token, never from an id in the body
export async function apiHeaders() {
  const h = { 'Content-Type': 'application/json' }
  try {
    const { data } = supabase ? await supabase.auth.getSession() : { data: null }
    if (data?.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`
  } catch {}
  return h
}

// Back from a Pro checkout and the webhook never landed: the server finds the payment in
// Stripe and puts it on the account (functions/api/restore-pro.js); reload to read it
export async function restorePro() {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/restore-pro`, { method: 'POST', headers: await apiHeaders() })
    const { status } = res.ok ? await res.json() : {}
    if (status === 'active') { try { localStorage.setItem('bap_subscribed', '1') } catch {}; window.location.reload() }
  } catch {}
}
