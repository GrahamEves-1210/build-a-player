import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']
  const rawBody = await getRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

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
        // Legacy one-time purchase — keep ads_disabled for existing buyers
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

  res.json({ received: true })
}
