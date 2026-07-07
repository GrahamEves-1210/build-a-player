import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'

const app = express()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const ALLOWED_ORIGINS = [
  'https://build-a-player.com',
  'https://www.build-a-player.com',
  ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : []),
]

app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)) }))

// Webhook must use raw body — register before express.json()
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
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
          .upsert({ id: userId, subscription_status: 'active', subscription_id: session.subscription }, { onConflict: 'id' })
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
        .update({ subscription_status: null, subscription_id: null })
        .eq('id', userId)
      if (error) console.error('[webhook] subscription cancel failed:', error)
    }
  }

  res.json({ received: true })
})

app.use(express.json())

app.post('/api/create-checkout', async (req, res) => {
  const { userId, email } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const origin = req.headers.origin || ALLOWED_ORIGIN

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email || undefined,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      success_url: `${origin}/?ad_free=1`,
      cancel_url: `${origin}/`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[checkout]', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/create-portal', async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const origin = req.headers.origin || ALLOWED_ORIGIN

  try {
    const { data } = await supabase.from('accounts').select('subscription_id').eq('id', userId).single()
    if (!data?.subscription_id) return res.status(400).json({ error: 'No active subscription found' })

    const sub = await stripe.subscriptions.retrieve(data.subscription_id)
    const customerId = sub.customer

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[portal]', err)
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`BAP API running on port ${PORT}`))
