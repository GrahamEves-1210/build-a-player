import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function onRequestPost(context) {
  try {
    const stripe = new Stripe(context.env.STRIPE_SECRET_KEY)
    const { userId } = await context.request.json()
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

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
