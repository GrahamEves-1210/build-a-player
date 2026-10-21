import { IS_APP } from './platform'
import { supabase } from './supabase'
import { claimCoinPurchases, refreshPass } from './progress'
import { track } from './track'

// Coins, BAP Pro (monthly or yearly: extra { plan: 'year' }) and the Builder Pass
// (extra { season }) are bought on the web through Stripe Checkout, in the app
// too: the app opens the checkout in the phone's browser sheet and collects
// what was bought when the sheet closes. Resolves 'opened' | 'signin' | 'error'.
const API = import.meta.env.VITE_API_URL || ''
// What BAP Pro costs (the prices themselves live in Stripe: STRIPE_PRICE_ID, STRIPE_PRICE_ID_YEARLY)
export const PRO_PRICE = { month: '$4.99', year: '$34.99', save: '42%' }
const ENDPOINT = { pro: 'create-checkout', pass: 'create-pass-checkout', coins: 'create-coins-checkout' }

export async function openCheckout(kind, extra = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const user = data?.session?.user
  if (!user) { window.dispatchEvent(new CustomEvent('bap:auth')); return 'signin' }
  track('checkout_open', { userId: user.id, meta: { kind, ...extra, app: IS_APP } })
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
