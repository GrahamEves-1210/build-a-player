import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId, email } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const origin = req.headers.origin || 'https://build-a-player.com'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Build-A-Player · Ad-Free', description: 'Remove all ads forever' },
        unit_amount: 199,
      },
      quantity: 1,
    }],
    customer_email: email || undefined,
    metadata: { userId },
    success_url: `${origin}/?ad_free=1`,
    cancel_url: `${origin}/`,
  })

  res.json({ url: session.url })
}
