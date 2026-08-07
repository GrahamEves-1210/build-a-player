import Stripe from 'stripe'

export async function onRequestPost(context) {
  try {
    const stripe = new Stripe(context.env.STRIPE_SECRET_KEY)
    const { userId, email } = await context.request.json()
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

    const origin = context.request.headers.get('origin') || 'https://build-a-player.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: context.env.STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email || undefined,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      success_url: `${origin}/?ad_free=1`,
      cancel_url: `${origin}/`,
    })

    return Response.json({ url: session.url })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
