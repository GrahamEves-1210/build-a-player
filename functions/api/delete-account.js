import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Deletes the signed-in user's account: cancels any Stripe subscription,
// removes their rows, then deletes the auth user. The App Store requires apps
// that let people create accounts to let them delete them in the app.
// Called from the website (same origin) and from the iOS/Android app, whose
// pages are served from capacitor://localhost (iOS) / https://localhost
// (Android) — so it answers CORS preflights for those two origins.

const APP_ORIGINS = ['capacitor://localhost', 'https://localhost']

function cors(request) {
  const origin = request.headers.get('origin') || ''
  return APP_ORIGINS.includes(origin) ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  } : {}
}

// Every table that stores something tied to a user, and the column that points at them
const USER_ROWS = [
  ['simulations', 'user_id'], ['vs_results', 'user_id'], ['salary_cap_plays', 'user_id'],
  ['salary_infinite_plays', 'user_id'], ['depth_chart_streaks', 'user_id'], ['analytics_events', 'user_id'],
  ['friend_requests', 'from_id'], ['friend_requests', 'to_id'],
  ['vs_invites', 'from_id'], ['vs_invites', 'to_id'],
  ['accounts', 'id'],
]

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request) })

export async function onRequestPost({ request, env }) {
  const headers = cors(request)
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401, headers })

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  // Whose account this is comes from the verified session token, never the request body
  const { data: { user } = {}, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return Response.json({ error: 'Your session expired. Sign in again, then retry.' }, { status: 401, headers })

  try {
    const { data: account } = await supabase.from('accounts').select('subscription_id').eq('id', user.id).maybeSingle()
    if (account?.subscription_id) {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY)
      try { await stripe.subscriptions.cancel(account.subscription_id) }
      catch (e) { if (e?.code !== 'resource_missing') throw e }   // already gone in Stripe
    }
    for (const [table, col] of USER_ROWS) {
      const { error } = await supabase.from(table).delete().eq(col, user.id)
      if (error) console.error(`[delete-account] ${table}.${col}: ${error.message}`)
    }
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id)
    if (delErr) throw delErr
    return Response.json({ deleted: true }, { headers })
  } catch (err) {
    console.error('[delete-account]', err)
    return Response.json({ error: 'Could not delete your account. Try again, or email us.' }, { status: 500, headers })
  }
}
