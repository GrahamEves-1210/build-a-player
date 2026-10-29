import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// "Paid but Pro isn't on": the payment's webhook never landed. Finds the player's BAP Pro
// subscription in Stripe by the account id it was bought for (create-checkout.js puts it in
// the subscription's metadata) and puts it on the account, as stripe-webhook.js would have.
// Answers { status: 'active' | 'past_due' | … | null }

// Who's asking, from their Supabase session token (never from an id in the body)
async function sessionUser(request, env) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: { user } = {}, error } = await sb.auth.getUser(token)
  return error ? null : user ?? null
}

// The account's subscription: a live one first, then one with a payment to fix, newest first
export async function findSubscription(stripe, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null
  const { data } = await stripe.subscriptions.search({ query: `metadata['userId']:'${userId}'`, limit: 20 })
  const rank = s => (s.status === 'active' || s.status === 'trialing') ? 0 : ['past_due', 'unpaid', 'paused'].includes(s.status) ? 1 : 2
  return data.filter(s => rank(s) < 2).sort((a, b) => rank(a) - rank(b) || b.created - a.created)[0] ?? null
}

export async function onRequestPost(context) {
  try {
    const me = await sessionUser(context.request, context.env)
    if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 })
    const supabase = createClient(context.env.VITE_SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: acc } = await supabase.from('accounts').select('subscription_status, subscription_id').eq('id', me.id).maybeSingle()
    // already on, or bought through Google Play (revenuecat-webhook.js keeps that one)
    if (acc?.subscription_status === 'active' || String(acc?.subscription_id ?? '').startsWith('play:')) {
      return Response.json({ status: acc.subscription_status })
    }
    const stripe = new Stripe(context.env.STRIPE_SECRET_KEY)
    const sub = await findSubscription(stripe, me.id)
    if (!sub) return Response.json({ status: null })
    const live = sub.status === 'active' || sub.status === 'trialing'
    const { error } = await supabase.from('accounts')
      .upsert({ id: me.id, subscription_status: live ? 'active' : sub.status, subscription_id: sub.id, is_plus: live }, { onConflict: 'id' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ status: live ? 'active' : sub.status })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
