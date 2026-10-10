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
    if (userId && session.metadata?.kind === 'coins') {
      // Coin pack: record it once (ref is unique); the game collects it (claim_coin_purchases)
      const coins = parseInt(session.metadata.coins, 10) || 0
      if (coins > 0 && session.payment_status === 'paid') {
        const { error } = await supabase.from('coin_purchases')
          .upsert({ user_id: userId, coins, source: 'stripe', pack: session.metadata.pack ?? null, ref: session.id }, { onConflict: 'ref', ignoreDuplicates: true })
        if (error) console.error('[webhook] coin purchase insert failed:', error)
      }
    } else if (userId) {
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
