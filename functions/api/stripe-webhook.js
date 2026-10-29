import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { alert } from './daily-check'

// BAP Pro's Discord role: given while Pro is on, taken off when it ends (the bot needs
// Manage Roles, its role above the Pro role; DISCORD_PRO_ROLE_ID). No Discord linked: skipped.
async function setProRole(supabase, env, userId, on) {
  const { DISCORD_BOT_TOKEN: bot, DISCORD_GUILD_ID: guild, DISCORD_PRO_ROLE_ID: role } = env
  if (!bot || !guild || !role || !userId) return
  try {
    const { data: { user } = {} } = await supabase.auth.admin.getUserById(userId)
    const identity = user?.identities?.find(i => i.provider === 'discord')
    const discordId = identity?.identity_data?.provider_id ?? identity?.id
    if (!discordId) return
    const r = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${discordId}/roles/${role}`, {
      method: on ? 'PUT' : 'DELETE', headers: { Authorization: `Bot ${bot}`, 'X-Audit-Log-Reason': on ? 'BAP Pro' : 'BAP Pro ended' },
    })
    if (!r.ok && r.status !== 404) console.error('[discord role]', r.status, await r.text().catch(() => ''))
  } catch (e) { console.error('[discord role]', e?.message) }
}

// The Builder Pass seasons on sale (keep in step with src/lib/pass.js and create-pass-checkout.js)
const PASS_SEASONS = new Set(['s1'])

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
  // A write that didn't land answers 500, so Stripe sends the event again (every write here
  // is safe to repeat); answering 200 anyway lost a paid Pro for good
  let failed = false
  // The Discord role runs after the answer: a slow Discord or Supabase call made Stripe time out
  const proRole = (userId, on) => context.waitUntil(setProRole(supabase, context.env, userId, on))
  // Pro as Stripe has it now, not as the event had it: a retried event can arrive hours late,
  // after a renewal, a failed payment or a cancel
  const putPro = async (userId, subId) => {
    const sub = await stripe.subscriptions.retrieve(subId).catch(e => { console.error('[webhook] subscription read failed:', e?.message); return null })
    if (!sub) { failed = true; return }
    const live = sub.status === 'active' || sub.status === 'trialing'
    const { error } = await supabase.from('accounts')
      .upsert({ id: userId, subscription_status: live ? 'active' : sub.status, subscription_id: sub.id }, { onConflict: 'id' })
    if (error) { console.error('[webhook] subscription write failed:', error); failed = true }
    proRole(userId, live)
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
        if (error) { console.error('[webhook] coin purchase insert failed:', error); failed = true }
      }
    } else if (userId && session.metadata?.kind === 'pass') {
      // Builder Pass: the season's premium track (supabase/builder_pass.sql); the game reads it
      const season = session.metadata.season
      if (PASS_SEASONS.has(season) && session.payment_status === 'paid') {
        const { error } = await supabase.from('pass_owners')
          .upsert({ user_id: userId, season, ref: session.id }, { onConflict: 'user_id,season', ignoreDuplicates: true })
        if (error) { console.error('[webhook] pass insert failed:', error); failed = true }
      }
    } else if (userId) {
      if (session.mode === 'subscription') {
        await putPro(userId, session.subscription)
      } else {
        const { error } = await supabase
          .from('accounts')
          .upsert({ id: userId, ads_disabled: true }, { onConflict: 'id' })
        if (error) { console.error('[webhook] ads_disabled upsert failed:', error); failed = true }
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
      } else if (session && userId && session.metadata?.kind === 'pass') {
        const { error } = await supabase.from('pass_owners').delete().eq('ref', session.id)
        if (error) console.error('[webhook] pass refund failed:', error)
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
    if (userId) await putPro(userId, sub.id)
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const userId = sub.metadata?.userId
    if (userId) {
      const { error } = await supabase
        .from('accounts')
        .update({ subscription_status: null, subscription_id: null })
        .eq('id', userId).eq('subscription_id', sub.id)   // not a newer subscription bought since
      if (error) { console.error('[webhook] subscription cancel failed:', error); failed = true }
      proRole(userId, false)
    }
  }

  if (failed) {
    const o = event.data.object
    context.waitUntil(alert(context.env, `🚨 **A payment didn't reach the game** (Stripe will retry; the daily check fixes it if not)\n${event.type} · ${event.id} · account ${o.metadata?.userId ?? '?'} · ${o.amount_total != null ? `$${(o.amount_total / 100).toFixed(2)}` : ''}\nCloudflare logs: "[webhook]"`))
    return Response.json({ error: 'database write failed' }, { status: 500 })
  }
  return Response.json({ received: true })
}
