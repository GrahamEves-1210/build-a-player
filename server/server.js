import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'

// The site's API (Railway). The website and the app call it through VITE_API_URL:
// Pro checkout + billing portal, coin packs, account deletion, and Stripe's webhook.

const app = express()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const SITE = 'https://build-a-player.com'
const ALLOWED_ORIGINS = [
  SITE,
  'https://www.build-a-player.com',
  'capacitor://localhost',          // the iOS app
  'https://localhost',              // the Android app
  ...(process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim()) : []),
]
// Cloudflare Pages previews (https://<id>.build-a-player.pages.dev) and the branch sites
const PREVIEW = /^https:\/\/([a-z0-9-]+\.)?build-a-player\.pages\.dev$/
const allowed = origin => !origin || ALLOWED_ORIGINS.includes(origin) || PREVIEW.test(origin)
app.use(cors({ origin: (origin, cb) => cb(null, allowed(origin)) }))

// Where a checkout sends the buyer back: the page they came from on the web; the
// website for the app (capacitor:// can't be a Stripe return URL)
const returnBase = (req, app) => {
  const o = req.headers.origin || ''
  return !app && o.startsWith('http') && allowed(o) ? o : SITE
}

// Coin packs: prices live here so the browser can't change them. Keep in step with src/lib/coins.js
const PACKS = {
  bap_coins_500:  { coins: 800,   cents: 99 },
  bap_coins_1200: { coins: 2000,  cents: 199 },
  bap_coins_3200: { coins: 5500,  cents: 499 },
  bap_coins_7000: { coins: 12500, cents: 999 },
}

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
  const { userId, email, app: fromApp } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const origin = returnBase(req, fromApp)

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

// A coin pack: one-time Stripe Checkout; the webhook records it, the game collects it
app.post('/api/create-coins-checkout', async (req, res) => {
  const { userId, email, pack, app: fromApp } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const p = PACKS[pack]
  if (!p) return res.status(400).json({ error: 'unknown pack' })
  const origin = returnBase(req, fromApp)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: p.cents,
          // optional: STRIPE_COINS_PRODUCT groups every pack under one product in Stripe's reports
          ...(process.env.STRIPE_COINS_PRODUCT
            ? { product: process.env.STRIPE_COINS_PRODUCT }
            : { product_data: { name: `${p.coins.toLocaleString('en-US')} BAP Coins` } }),
        },
      }],
      customer_email: email || undefined,
      metadata: { userId, kind: 'coins', pack, coins: String(p.coins) },
      payment_intent_data: { metadata: { userId, kind: 'coins', pack } },
      success_url: `${origin}/?coins=1`,
      cancel_url: `${origin}/`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[coins checkout]', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/create-portal', async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const origin = returnBase(req, false)

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

// Delete the signed-in account (the App Store requires it in the app): cancel any
// Pro subscription, remove the user's rows, then the auth user. Whose account it
// is comes from the verified session token, never the request body.
const USER_ROWS = [
  ['simulations', 'user_id'], ['vs_results', 'user_id'], ['salary_cap_plays', 'user_id'],
  ['salary_infinite_plays', 'user_id'], ['depth_chart_streaks', 'user_id'], ['analytics_events', 'user_id'],
  ['careers', 'user_id'], ['coin_purchases', 'user_id'],
  ['friend_requests', 'from_id'], ['friend_requests', 'to_id'],
  ['vs_invites', 'from_id'], ['vs_invites', 'to_id'],
  ['accounts', 'id'],
]
app.post('/api/delete-account', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Not signed in' })
  const { data: { user } = {}, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Your session expired. Sign in again, then retry.' })

  try {
    const { data: account } = await supabase.from('accounts').select('subscription_id').eq('id', user.id).maybeSingle()
    if (account?.subscription_id) {
      try { await stripe.subscriptions.cancel(account.subscription_id) }
      catch (e) { if (e?.code !== 'resource_missing') throw e }   // already gone in Stripe
    }
    for (const [table, col] of USER_ROWS) {
      const { error } = await supabase.from(table).delete().eq(col, user.id)
      if (error) console.error(`[delete-account] ${table}.${col}: ${error.message}`)
    }
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id)
    if (delErr) throw delErr
    res.json({ deleted: true })
  } catch (err) {
    console.error('[delete-account]', err)
    res.status(500).json({ error: 'Could not delete your account. Try again, or email us.' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`BAP API running on port ${PORT}`))
