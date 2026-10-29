import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Once a day (a free scheduler such as cron-job.org opens /api/daily-check?key=CHECK_KEY):
// every paid thing in Stripe is checked against the game, anything missing is put right
// (Pro on the account, coin packs and Builder Passes from the last two days), and one
// message goes to the alerts channel: all good, or what was fixed and what needs a look.
// Cloudflare settings: ALERT_DISCORD_WEBHOOK (a Discord channel's webhook URL), CHECK_KEY.

// A message to the alerts channel (no ALERT_DISCORD_WEBHOOK set: skipped)
export async function alert(env, text) {
  if (!env.ALERT_DISCORD_WEBHOOK) return
  try {
    await fetch(env.ALERT_DISCORD_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: String(text).slice(0, 1900) }),
    })
  } catch (e) { console.error('[alert]', e?.message) }
}

// The Builder Pass seasons on sale (keep in step with stripe-webhook.js)
const PASS_SEASONS = new Set(['s1'])

export async function onRequestGet(context) {
  const { env } = context
  const key = new URL(context.request.url).searchParams.get('key')
  if (!env.CHECK_KEY || key !== env.CHECK_KEY) return new Response('Not found', { status: 404 })

  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const fixed = [], look = []
  try {
    // ── BAP Pro: every live Stripe subscription has Pro on its account ──
    const subs = {}   // account id → its subscriptions, newest first
    for (const status of ['active', 'trialing']) {
      for await (const s of stripe.subscriptions.list({ status, limit: 100 })) {
        const uid = s.metadata?.userId
        if (!uid) { look.push(`Pro subscription with no account: ${s.id}`); continue }
        ;(subs[uid] ??= []).push(s)
      }
    }
    const ids = Object.keys(subs)
    const on = new Set()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('accounts').select('id').eq('subscription_status', 'active').in('id', ids.slice(i, i + 200))
      if (error) throw new Error(`accounts read: ${error.message}`)
      data.forEach(r => on.add(r.id))
    }
    for (const uid of ids) {
      const list = subs[uid].sort((a, b) => b.created - a.created)
      if (list.length > 1) look.push(`Paying for Pro ${list.length} times: account ${uid} (${list.map(s => s.id).join(', ')})`)
      if (on.has(uid)) continue
      const { error } = await supabase.from('accounts').upsert({ id: uid, subscription_status: 'active', subscription_id: list[0].id }, { onConflict: 'id' })
      if (error) look.push(`Couldn't turn Pro on for ${uid}: ${error.message}`)
      else fixed.push(`Pro turned on for ${uid} (${list[0].id})`)
    }

    // ── Coin packs and Builder Passes paid in the last two days are in the game ──
    const since = Math.floor(Date.now() / 1000) - 2 * 86400
    for await (const s of stripe.checkout.sessions.list({ created: { gte: since }, status: 'complete', limit: 100 })) {
      const uid = s.metadata?.userId, kind = s.metadata?.kind
      if (!uid || s.payment_status !== 'paid' || (kind !== 'coins' && kind !== 'pass')) continue
      // a pass is one per account and season, whichever payment it came from
      const q = kind === 'coins'
        ? supabase.from('coin_purchases').select('ref').eq('ref', s.id)
        : supabase.from('pass_owners').select('ref').eq('user_id', uid).eq('season', s.metadata.season ?? '')
      const { data: rows, error } = await q.limit(1)
      if (error) throw new Error(`${kind} read: ${error.message}`)
      if (rows.length) continue
      let res
      if (kind === 'coins') {
        const coins = parseInt(s.metadata.coins, 10) || 0
        if (coins <= 0) { look.push(`Coin pack with no coins: ${s.id}`); continue }
        res = await supabase.from('coin_purchases').upsert({ user_id: uid, coins, source: 'stripe', pack: s.metadata.pack ?? null, ref: s.id }, { onConflict: 'ref', ignoreDuplicates: true })
      } else {
        if (!PASS_SEASONS.has(s.metadata.season)) continue
        res = await supabase.from('pass_owners').upsert({ user_id: uid, season: s.metadata.season, ref: s.id }, { onConflict: 'user_id,season', ignoreDuplicates: true })
      }
      if (res.error) look.push(`Couldn't add ${kind} for ${uid} (${s.id}): ${res.error.message}`)
      else fixed.push(`${kind === 'coins' ? 'Coin pack' : 'Builder Pass'} added for ${uid} (${s.id})`)
    }

    const head = fixed.length || look.length ? '⚠️ **Daily payments check**' : `✅ Daily payments check: all good (${ids.length} Pro accounts)`
    const body = [
      fixed.length ? `**Fixed (${fixed.length}):**\n${fixed.join('\n')}` : '',
      look.length ? `**Needs a look (${look.length}):**\n${look.join('\n')}` : '',
    ].filter(Boolean).join('\n')
    await alert(env, body ? `${head}\n${body}` : head)
    return Response.json({ ok: true, pro: ids.length, fixed: fixed.length, look: look.length })
  } catch (err) {
    await alert(env, `🚨 **Daily payments check failed:** ${err.message}`)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
