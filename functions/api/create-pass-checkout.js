import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// The email Stripe pre-fills: the contact email the player saved in their profile, else the
// sign-in email, never the hidden name@buildaplayer.app one username accounts sign in with
const payEmail = u => { const e = (u?.user_metadata?.contact_email || '').trim() || u?.email || ''; return e && !/@buildaplayer\.app$/i.test(e) ? e : null }

// The Builder Pass: a one-time Stripe Checkout for a season's premium track ($8.99).
// No Stripe product to set up: the price is made here. The webhook (stripe-webhook.js)
// records it in pass_owners; the game reads that. A season sells until it ends.
// Keep in step with src/lib/pass.js (SEASONS) and server/server.js.
const PASS_SEASONS = {
  s1: { name: 'Builder Pass · Season 1', cents: 899, end: '2026-12-21' },
}
const nyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())

export async function onRequestPost({ request, env }) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return Response.json({ error: 'Sign in again.' }, { status: 401 })
    const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    const { data: { user: me } = {}, error } = await supabase.auth.getUser(token)
    if (error || !me) return Response.json({ error: 'Sign in again.' }, { status: 401 })

    const { season, app } = await request.json().catch(() => ({}))
    const p = PASS_SEASONS[season]
    if (!p || nyDay() >= p.end) return Response.json({ error: 'That season is over' }, { status: 400 })
    const { data: owned } = await supabase.from('pass_owners').select('season').eq('user_id', me.id).eq('season', season).maybeSingle()
    if (owned) return Response.json({ error: 'You already have this pass' }, { status: 400 })

    // the app (capacitor://) checks out in the phone's browser: it comes back to the website
    const hdr = request.headers.get('origin') || ''
    const origin = !app && hdr.startsWith('http') ? hdr : 'https://build-a-player.com'
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: p.cents, product_data: { name: p.name } } }],
      customer_email: payEmail(me) || undefined,
      metadata: { userId: me.id, kind: 'pass', season },
      payment_intent_data: { metadata: { userId: me.id, kind: 'pass', season } },
      success_url: `${origin}/?pass=1`,
      cancel_url: `${origin}/`,
    })
    return Response.json({ url: session.url })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
