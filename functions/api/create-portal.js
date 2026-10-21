import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Who's asking, from their Supabase session token (never from an id in the body)
async function sessionUser(request, env) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: { user } = {}, error } = await sb.auth.getUser(token)
  return error ? null : user ?? null
}

export async function onRequestPost(context) {
  try {
    const stripe = new Stripe(context.env.STRIPE_SECRET_KEY)
    // the billing portal shows the customer's email, card and invoices and can cancel
    // the subscription: only the signed-in player, for their own account
    const me = await sessionUser(context.request, context.env)
    if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 })
    const userId = me.id

    const supabase = createClient(context.env.VITE_SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: account } = await supabase
      .from('accounts')
      .select('subscription_id')
      .eq('id', userId)
      .single()

    if (!account?.subscription_id) {
      return Response.json({ error: 'No subscription found' }, { status: 404 })
    }

    const sub = await stripe.subscriptions.retrieve(account.subscription_id)
    const origin = context.request.headers.get('origin') || 'https://build-a-player.com'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.customer,
      return_url: origin,
    })

    return Response.json({ url: portalSession.url })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
