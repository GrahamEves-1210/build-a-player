import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId, email } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const origin = req.headers.origin || 'https://build-a-player.com'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: process.env.STRIPE_PRICE_ID,
      quantity: 1,
    }],
    customer_email: email || undefined,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    success_url: `${origin}/?ad_free=1`,
    cancel_url: `${origin}/`,
  })

  res.json({ url: session.url })
}
