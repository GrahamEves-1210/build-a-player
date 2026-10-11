import Stripe from 'stripe'

// Website coin packs → a one-time Stripe Checkout. No Stripe products to set up:
// each pack's price is made right here (prices live on the server, so the
// browser can't change them). The webhook (stripe-webhook.js) records the
// purchase in coin_purchases; the game collects it (claim_coin_purchases).
// Keep in step with src/lib/coins.js.
const PACKS = {
  bap_coins_1200:  { coins: 3000,  cents: 199 },
  bap_coins_3200:  { coins: 8500,  cents: 499 },
  bap_coins_7000:  { coins: 18000, cents: 999 },
  bap_coins_15000: { coins: 38000, cents: 1999 },
}

export async function onRequestPost(context) {
  try {
    const stripe = new Stripe(context.env.STRIPE_SECRET_KEY)
    const { userId, email, pack, app } = await context.request.json()
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })
    const p = PACKS[pack]
    if (!p) return Response.json({ error: 'unknown pack' }, { status: 400 })

    // the app (capacitor://) checks out in the phone's browser: it comes back to the website
    const hdr = context.request.headers.get('origin') || ''
    const origin = !app && hdr.startsWith('http') ? hdr : 'https://build-a-player.com'
    const back = (!app && context.request.headers.get('referer')) || `${origin}/`
    const returnTo = back.startsWith(origin) ? back.split('#')[0] : `${origin}/`
    const sep = returnTo.includes('?') ? '&' : '?'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: p.cents,
          // optional: STRIPE_COINS_PRODUCT groups every pack under one product in Stripe's reports
          ...(context.env.STRIPE_COINS_PRODUCT
            ? { product: context.env.STRIPE_COINS_PRODUCT }
            : { product_data: { name: `${p.coins.toLocaleString('en-US')} BAP Coins` } }),
        },
      }],
      customer_email: email || undefined,
      metadata: { userId, kind: 'coins', pack, coins: String(p.coins) },
      payment_intent_data: { metadata: { userId, kind: 'coins', pack } },
      success_url: `${returnTo}${sep}coins=1`,
      cancel_url: returnTo,
    })
    return Response.json({ url: session.url })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
