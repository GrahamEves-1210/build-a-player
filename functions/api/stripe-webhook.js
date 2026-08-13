import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function onRequestPost(context) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY)
  const sig = context.request.headers.get('stripe-signature')
  const rawBody = await context.request.text()

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, context.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return Response.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const supabase = createClient(context.env.VITE_SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.userId
    if (userId) {
      if (session.mode === 'subscription') {
        const { error } = await supabase
          .from('accounts')
          .upsert({ id: userId, subscription_status: 'active', subscription_id: session.subscription, is_plus: true }, { onConflict: 'id' })
        if (error) console.error('[webhook] subscription upsert failed:', error)
      } else {
        const { error } = await supabase
          .from('accounts')
          .upsert({ id: userId, ads_disabled: true }, { onConflict: 'id' })
        if (error) console.error('[webhook] ads_disabled upsert failed:', error)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const userId = sub.metadata?.userId
    if (userId) {
      const { error } = await supabase
        .from('accounts')
        .update({ subscription_status: null, subscription_id: null, is_plus: false })
        .eq('id', userId)
      if (error) console.error('[webhook] subscription cancel failed:', error)
    }
  }

  return Response.json({ received: true })
}
