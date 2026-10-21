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

  // A refund or a chargeback takes back what it paid for: a coin pack's coins (the
  // wallet's coin budget goes negative by the same amount, so an old copy of the
  // wallet on a phone can't write them back), or the ad-free purchase
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const obj = event.data.object
    const pi = typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id
    if (pi) {
      const { data: [session] = [] } = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 })
      const userId = session?.metadata?.userId
      if (session && userId && session.metadata?.kind === 'coins') {
        const { data: row } = await supabase.from('coin_purchases').select('id, coins, claimed_at, refunded_at').eq('ref', session.id).maybeSingle()
        if (row && !row.refunded_at) {
          // unclaimed: it can never be collected now; claimed: take the coins back
          await supabase.from('coin_purchases').update({ refunded_at: new Date().toISOString(), claimed_at: row.claimed_at ?? new Date().toISOString() }).eq('id', row.id)
          if (row.claimed_at) {
            const { data: acc } = await supabase.from('accounts').select('app_profile, coin_guard').eq('id', userId).maybeSingle()
            const wallet = acc?.app_profile && typeof acc.app_profile === 'object' ? acc.app_profile : null
            if (wallet) {
              const coins = Math.max(0, (Number(wallet.coins) || 0) - row.coins)
              const guard = { ...(acc.coin_guard || {}), t: Date.now() / 1000, b: -row.coins }
              const { error } = await supabase.from('accounts').update({ app_profile: { ...wallet, coins, at: Date.now() }, coin_guard: guard }).eq('id', userId)
              if (error) console.error('[webhook] coin refund failed:', error)
            }
          }
        }
      } else if (session && userId && session.mode === 'payment') {
        const { error } = await supabase.from('accounts').update({ ads_disabled: false }).eq('id', userId)
        if (error) console.error('[webhook] ad-free refund failed:', error)
      }
    }
  }

  // A renewal that fails (past_due, unpaid) ends Pro until it's paid; paying turns it back on
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    const userId = sub.metadata?.userId
    if (userId) {
      const live = sub.status === 'active' || sub.status === 'trialing'
      const { error } = await supabase.from('accounts')
        .update({ subscription_status: live ? 'active' : sub.status, subscription_id: sub.id, is_plus: live })
        .eq('id', userId)
      if (error) console.error('[webhook] subscription update failed:', error)
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
