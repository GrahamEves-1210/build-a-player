import { IS_APP, PLAY_BILLING } from './platform'
import { supabase } from './supabase'
import { claimCoinPurchases, refreshPass } from './progress'
import { track } from './track'
import { playBuy } from './iap'

// Coins, BAP Pro (monthly or yearly: extra { plan: 'year' }) and the Builder Pass
// (extra { season }) are bought on the web through Stripe Checkout, in the iPhone app
// too: the app opens the checkout in the phone's browser sheet and collects
// what was bought when the sheet closes. Android buys through Google Play instead
// (lib/iap.js) and collects the same way. Resolves 'opened' | 'signin' | 'cancelled' | 'error'.
const API = import.meta.env.VITE_API_URL || ''
// What BAP Pro costs (the prices themselves live in Stripe: STRIPE_PRICE_ID, STRIPE_PRICE_ID_YEARLY)
export const PRO_PRICE = { month: '$4.99', year: '$34.99', save: '42%' }
// The yearly plan as a monthly figure ("$2.92"), rounded up to the cent so it never
// understates. The website leads with it, always beside the yearly total that's
// billed; the apps lead with the billed amount (Apple 3.1.2 / Play: the charge is
// the most prominent price) and show this small.
export const perMonth = yearly => {
  const n = parseFloat(String(yearly).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? `$${(Math.ceil(n / 12 * 100) / 100).toFixed(2)}` : null
}
const ENDPOINT = { pro: 'create-checkout', pass: 'create-pass-checkout', coins: 'create-coins-checkout' }

export async function openCheckout(kind, extra = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const user = data?.session?.user
  if (!user) { window.dispatchEvent(new CustomEvent('bap:auth')); return 'signin' }
  track('checkout_open', { userId: user.id, meta: { kind, ...extra, app: IS_APP, play: PLAY_BILLING } })
  if (PLAY_BILLING) {
    const r = await playBuy(kind, extra, user.id)
    if (r === 'ok') { collect(kind, user.id); return 'opened' }
    return r === 'cancelled' ? 'cancelled' : 'error'
  }
  try {
    const res = await fetch(`${API}/api/${ENDPOINT[kind] ?? ENDPOINT.coins}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      // table 2: today's coin packs (lib/coins.js); the server keeps the live site's old table for requests without it
      body: JSON.stringify({ userId: user.id, email: user.email ?? null, app: IS_APP, ...(kind === 'coins' ? { table: 2 } : {}), ...extra }),
    })
    const { url } = await res.json().catch(() => ({}))
    if (!url) return 'error'
    if (!IS_APP) { window.location.href = url; return 'opened' }
    const { Browser } = await import('@capacitor/browser')
    const done = await Browser.addListener('browserFinished', () => { done.remove(); collect(kind, user.id) })
    await Browser.open({ url, presentationStyle: 'popover' })
    return 'opened'
  } catch { return 'error' }
}

// Google Play's page for the player's subscriptions (a Pro bought on Android is managed there)
const PLAY_SUBS = 'https://play.google.com/store/account/subscriptions?sku=bap_pro&package=com.buildaplayer.app'

// A Pro whose renewal didn't go through (stripe-webhook: Pro is off, Stripe still retries the card):
// not a member, but the subscription is still there to fix or cancel on the billing page
export const BILLING_DUE = ['past_due', 'unpaid', 'paused', 'incomplete']
export async function billingDue() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const user = data?.session?.user
  if (!user) return false
  const { data: acc } = await supabase.from('accounts').select('subscription_status').eq('id', user.id).maybeSingle()
  return BILLING_DUE.includes(acc?.subscription_status)
}

// Paid for Pro but it isn't on (the payment's webhook never landed): the server finds the
// subscription in Stripe and puts it on the account (functions/api/restore-pro.js), then the
// page reloads to read it. Resolves 'active' | 'due' | 'none' | 'signin' | 'error'
export async function restorePro({ reload = true } = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const user = data?.session?.user
  if (!user) { window.dispatchEvent(new CustomEvent('bap:auth')); return 'signin' }
  try {
    const res = await fetch(`${API}/api/restore-pro`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    })
    if (!res.ok) return 'error'
    const { status } = await res.json().catch(() => ({}))
    if (status === 'active') {
      try { localStorage.setItem('bap_subscribed', '1') } catch {}
      if (reload) window.location.reload()
      return 'active'
    }
    return BILLING_DUE.includes(status) ? 'due' : 'none'
  } catch { return 'error' }
}

// BAP Pro members: Stripe's billing page (change plan, card, cancel), or Google Play's for a
// Pro bought there (subscription_id 'play:…'). Resolves 'opened' | 'signin' | 'error'
export async function openBillingPortal() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const user = data?.session?.user
  if (!user) { window.dispatchEvent(new CustomEvent('bap:auth')); return 'signin' }
  const { data: acc } = await supabase.from('accounts').select('subscription_id').eq('id', user.id).maybeSingle()
  if (String(acc?.subscription_id ?? '').startsWith('play:') || (PLAY_BILLING && !acc?.subscription_id)) {
    if (!IS_APP) { window.location.href = PLAY_SUBS; return 'opened' }
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: PLAY_SUBS })
    return 'opened'
  }
  try {
    const res = await fetch(`${API}/api/create-portal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ userId: user.id }),
    })
    const { url } = await res.json().catch(() => ({}))
    if (!url) return 'error'
    if (!IS_APP) { window.location.href = url; return 'opened' }
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url, presentationStyle: 'popover' })
    return 'opened'
  } catch { return 'error' }
}

// Back in the app: the webhook may land a moment after the sheet closes
function collect(kind, uid) {
  let tries = 0
  const tick = async () => {
    if (kind === 'pro') {
      const { data: p } = await supabase.from('accounts').select('subscription_status').eq('id', uid).single()
      if (p?.subscription_status === 'active') {
        track('purchase', { userId: uid, meta: { kind: 'pro' } })
        try { localStorage.setItem('bap_subscribed', '1') } catch {}
        window.dispatchEvent(new CustomEvent('bap:pro'))
        return
      }
    } else if (kind === 'pass') {
      if (await refreshPass()) { track('purchase', { userId: uid, meta: { kind: 'pass' } }); window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'pass' })); return }
    } else if ((await claimCoinPurchases()) > 0) return
    if (++tries < 8) setTimeout(tick, 2500)
  }
  setTimeout(tick, 800)
}
