import { createClient } from '@supabase/supabase-js'

// Google Play purchases from the Android app (src/lib/iap.js), reported by RevenueCat after it
// has checked them with Google. Records them exactly like stripe-webhook.js records a Stripe
// payment, and the game collects them the same way:
//   coins → coin_purchases (claim_coin_purchases), the Pass → pass_owners,
//   BAP Pro → accounts.subscription_status, with subscription_id 'play:<order>'
// RevenueCat → Project settings → Integrations → Webhooks: URL https://build-a-player.com/api/revenuecat-webhook,
// Authorization header = the REVENUECAT_WEBHOOK_AUTH variable in Cloudflare.

// What each Google Play product pays (never taken from the phone; keep in step with src/lib/coins.js)
const COINS = { bap_coins_1200: 3000, bap_coins_3200: 8500, bap_coins_7000: 18000, bap_coins_15000: 38000 }
// The Builder Pass seasons on sale (keep in step with src/lib/pass.js and stripe-webhook.js)
const PASS = { bap_pass_s1: 's1' }
const isPro = id => /^bap_pro(:|$)/.test(id || '')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// BAP Pro's Discord role (the same as stripe-webhook.js): on while Pro is on
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

export async function onRequestPost(context) {
  const { env, request } = context
  if (!env.REVENUECAT_WEBHOOK_AUTH || request.headers.get('authorization') !== env.REVENUECAT_WEBHOOK_AUTH) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { event } = await request.json().catch(() => ({}))
  if (!event?.type) return Response.json({ error: 'no event' }, { status: 400 })
  if (event.type === 'TEST') return Response.json({ received: true })

  // the app buys under the player's account id (Purchases.logIn), so it's the app user id or one of its aliases
  const userId = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].find(id => UUID.test(id ?? ''))
  if (!userId) return Response.json({ received: true, skipped: 'no account' })

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const product = event.product_id ?? ''
  const ref = `play:${event.transaction_id ?? event.id}`
  const subRef = `play:${event.original_transaction_id ?? event.transaction_id ?? event.id}`
  const refund = event.type === 'CANCELLATION' && event.cancel_reason === 'CUSTOMER_SUPPORT'

  // ── coins and the Pass: one-time purchases ──
  if (COINS[product] || PASS[product]) {
    if (event.type === 'NON_RENEWING_PURCHASE' || event.type === 'INITIAL_PURCHASE') {
      if (COINS[product]) {
        // record it once (ref is unique); the game collects it (claim_coin_purchases)
        const { error } = await supabase.from('coin_purchases')
          .upsert({ user_id: userId, coins: COINS[product], source: 'google_play', pack: product, ref }, { onConflict: 'ref', ignoreDuplicates: true })
        if (error) console.error('[rc webhook] coin purchase insert failed:', error)
      } else {
        const { error } = await supabase.from('pass_owners')
          .upsert({ user_id: userId, season: PASS[product], ref }, { onConflict: 'user_id,season', ignoreDuplicates: true })
        if (error) console.error('[rc webhook] pass insert failed:', error)
      }
    } else if (refund && COINS[product]) {
      // a refund takes the coins back (the same as a Stripe refund: stripe-webhook.js)
      const { data: row } = await supabase.from('coin_purchases').select('id, coins, claimed_at, refunded_at').eq('ref', ref).maybeSingle()
      if (row && !row.refunded_at) {
        await supabase.from('coin_purchases').update({ refunded_at: new Date().toISOString(), claimed_at: row.claimed_at ?? new Date().toISOString() }).eq('id', row.id)
        if (row.claimed_at) {
          const { data: acc } = await supabase.from('accounts').select('app_profile, coin_guard').eq('id', userId).maybeSingle()
          const wallet = acc?.app_profile && typeof acc.app_profile === 'object' ? acc.app_profile : null
          if (wallet) {
            const coins = Math.max(0, (Number(wallet.coins) || 0) - row.coins)
            const guard = { ...(acc.coin_guard || {}), t: Date.now() / 1000, b: -row.coins }
            const { error } = await supabase.from('accounts').update({ app_profile: { ...wallet, coins, at: Date.now() }, coin_guard: guard }).eq('id', userId)
            if (error) console.error('[rc webhook] coin refund failed:', error)
          }
        }
      }
    } else if (refund) {
      const { error } = await supabase.from('pass_owners').delete().eq('ref', ref)
      if (error) console.error('[rc webhook] pass refund failed:', error)
    }
    return Response.json({ received: true })
  }

  // ── BAP Pro: the bap_pro subscription (base plans monthly, yearly) ──
  if (isPro(product)) {
    const { data: acc } = await supabase.from('accounts').select('subscription_status, subscription_id').eq('id', userId).maybeSingle()
    // a Pro paid through Stripe is Stripe's to change (stripe-webhook.js); Google Play only touches its own
    const stripeOn = acc?.subscription_status === 'active' && acc?.subscription_id && !String(acc.subscription_id).startsWith('play:')
    const on = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'].includes(event.type)
    // CANCELLATION alone only turns auto-renew off: Pro stays until EXPIRATION (or a refund ends it now)
    const off = event.type === 'EXPIRATION' || refund
    if (on && !stripeOn) {
      const { error } = await supabase.from('accounts')
        .update({ subscription_status: 'active', subscription_id: subRef }).eq('id', userId)
      if (error) console.error('[rc webhook] subscription update failed:', error)
      await setProRole(supabase, env, userId, true)
    } else if (off && !stripeOn && String(acc?.subscription_id ?? '').startsWith('play:')) {
      const { error } = await supabase.from('accounts')
        .update({ subscription_status: null, subscription_id: null }).eq('id', userId)
      if (error) console.error('[rc webhook] subscription end failed:', error)
      await setProRole(supabase, env, userId, false)
    }
  }

  return Response.json({ received: true })
}
