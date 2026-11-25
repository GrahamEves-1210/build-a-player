import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// The email Stripe pre-fills: the contact email the player saved in their profile, else the
// sign-in email, never the hidden name@buildaplayer.app one username accounts sign in with
const payEmail = u => { const e = (u?.user_metadata?.contact_email || '').trim() || u?.email || ''; return e && !/@buildaplayer\.app$/i.test(e) ? e : null }

// Who's asking, from their Supabase session token (never from an id in the body)
async function sessionUser(request, env) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: { user } = {}, error } = await sb.auth.getUser(token)
  return error ? null : user ?? null
}

// Black Friday (the pass sale's days, src/lib/pass.js PASS_SALE): MONTHLY Pro's first month half price, then $4.99 as
// usual. A Stripe coupon that applies once (made the first time it's needed); yearly is never discounted
const PRO_SALE = { coupon: 'BF2026-PRO-MONTH1', name: 'Black Friday: first month 50% off', start: '2026-11-25', end: '2026-12-01' }
const proNyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
async function proSaleDiscount(stripe, plan) {
  const d = proNyDay()
  if (plan === 'year' || d < PRO_SALE.start || d >= PRO_SALE.end) return undefined
  try { await stripe.coupons.retrieve(PRO_SALE.coupon) } catch (e) {
    if (e?.statusCode !== 404 && e?.code !== 'resource_missing') throw e
    await stripe.coupons.create({ id: PRO_SALE.coupon, percent_off: 50, duration: 'once', name: PRO_SALE.name })
  }
  return [{ coupon: PRO_SALE.coupon }]
}

export async function onRequestPost(context) {
  try {
    const stripe = new Stripe(context.env.STRIPE_SECRET_KEY)
    const body = await context.request.json()
    const { app, plan } = body
    // BAP Pro: monthly (STRIPE_PRICE_ID) or yearly (STRIPE_PRICE_ID_YEARLY, same product in Stripe)
    const price = plan === 'year' ? context.env.STRIPE_PRICE_ID_YEARLY : context.env.STRIPE_PRICE_ID
    if (!price) return Response.json({ error: 'That plan is not available yet' }, { status: 400 })
    // the session decides whose purchase it is; older app builds without one still send their id
    const me = await sessionUser(context.request, context.env)
    const userId = me?.id ?? body.userId, email = payEmail(me) ?? payEmail({ email: body.email })   // never the hidden @buildaplayer.app one: Checkout asks instead
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

    // the app (capacitor://) checks out in the phone's browser: it comes back to the website
    const hdr = context.request.headers.get('origin') || ''
    const origin = !app && hdr.startsWith('http') ? hdr : 'https://build-a-player.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price, quantity: 1 }],
      discounts: await proSaleDiscount(stripe, plan),
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
