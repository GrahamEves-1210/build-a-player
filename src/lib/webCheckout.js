import { IS_APP } from './platform'
import { supabase } from './supabase'
import { claimCoinPurchases } from './progress'

// Coins and BAP Pro are bought on the web through Stripe Checkout, in the app
// too: the app opens the checkout in the phone's browser sheet and collects
// what was bought when the sheet closes. Resolves 'opened' | 'signin' | 'error'.
const API = import.meta.env.VITE_API_URL || ''

export async function openCheckout(kind, extra = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const user = data?.session?.user
  if (!user) { window.dispatchEvent(new CustomEvent('bap:auth')); return 'signin' }
  try {
    const res = await fetch(`${API}/api/${kind === 'pro' ? 'create-checkout' : 'create-coins-checkout'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, email: user.email ?? null, app: IS_APP, ...extra }),
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
        try { localStorage.setItem('bap_subscribed', '1') } catch {}
        window.dispatchEvent(new CustomEvent('bap:pro'))
        return
      }
    } else if ((await claimCoinPurchases()) > 0) return
    if (++tries < 8) setTimeout(tick, 2500)
  }
  setTimeout(tick, 800)
}
