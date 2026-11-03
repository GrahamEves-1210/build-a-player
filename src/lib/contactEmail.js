import { supabase } from './supabase'

// The email a player gets password resets at (live/src/reset.js). It lives in the account's
// own sign-in data (user_metadata.contact_email): only the player and the server can read
// it, unlike the accounts row, which leaderboards and profiles read.
// (Accounts from before this kept it on accounts.email: supabase/private_email.sql moves it.)

export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim())
export const contactEmailOf = u => (u?.user_metadata?.contact_email || '').trim() || null
// "gr***@outlook.com": enough to recognize it
export const maskEmail = e => { const [a, d] = String(e || '').split('@'); return d ? `${a.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(4, a.length - 2)))}@${d}` : '' }

// Saves it on the account. Returns null, or what went wrong
export async function saveContactEmail(email) {
  const e = (email || '').trim()
  if (!validEmail(e)) return 'Enter a valid email address.'
  if (!supabase) return 'Not connected. Try again in a moment.'
  const { error } = await supabase.auth.updateUser({ data: { contact_email: e } })
  return error ? error.message : null
}
