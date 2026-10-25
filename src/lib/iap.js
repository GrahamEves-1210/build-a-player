// Android: coins, BAP Pro and the Builder Pass are bought through Google Play Billing (by way
// of RevenueCat, which checks every purchase with Google). The iPhone app and the website
// keep the Stripe checkout (lib/webCheckout.js decides).
//
// What a purchase pays for is never decided here: RevenueCat tells our server
// (functions/api/revenuecat-webhook.js), which records it exactly like a Stripe payment
// (coin_purchases, pass_owners, accounts.subscription_status), and the game collects it
// the same way. The purchase is made under the player's account id (logIn), so the server
// knows whose it is.
//
// Google Play products (Play Console → Monetize), ids exactly as here:
//   coins  one-time products, consumable:  bap_coins_1200, bap_coins_3200, bap_coins_7000, bap_coins_15000
//   pass   one-time product per season:    bap_pass_s1
//   Pro    one subscription bap_pro with two base plans: monthly, yearly
// RevenueCat's public Android key goes in .env.app as VITE_RC_ANDROID_KEY (lib/platform.js
// PLAY_BILLING); until it's there, Android doesn't sell.
import { useEffect, useState } from 'react'
import { PLAY_BILLING } from './platform'
import { COIN_PACKS } from './coins'

export const PRO_PLAN_ID = { month: 'bap_pro:monthly', year: 'bap_pro:yearly' }
export const passProductId = season => `bap_pass_${season}`
const ONE_TIME = [...COIN_PACKS.map(p => p.id), passProductId('s1')]

let P = null
let ready = null
function init() {
  if (!PLAY_BILLING) return Promise.resolve(null)
  ready ??= import('@revenuecat/purchases-capacitor').then(async m => {
    P = m.Purchases
    await P.configure({ apiKey: import.meta.env.VITE_RC_ANDROID_KEY })
    return P
  }).catch(e => { console.warn('[iap] unavailable:', e?.message); ready = null; return null })
  return ready
}

async function product(p, id) {
  const sub = id.startsWith('bap_pro')
  const { products } = await p.getProducts({ productIdentifiers: [sub ? 'bap_pro' : id], type: sub ? 'SUBSCRIPTION' : 'NON_SUBSCRIPTION' })
  // a subscription comes back once per base plan: bap_pro:monthly, bap_pro:yearly
  return (products ?? []).find(x => x.identifier === id) ?? null
}

// kind 'coins' (extra.pack) | 'pro' (extra.plan) | 'pass' (extra.season), bought by uid.
// Resolves 'ok' | 'cancelled' | 'unavailable' | 'error'
export async function playBuy(kind, extra, uid) {
  const p = await init(); if (!p) return 'unavailable'
  const id = kind === 'pro' ? PRO_PLAN_ID[extra.plan === 'month' ? 'month' : 'year'] : kind === 'pass' ? passProductId(extra.season) : extra.pack
  try {
    await p.logIn({ appUserID: uid })
    const item = await product(p, id)
    if (!item) return 'unavailable'
    await p.purchaseStoreProduct({ product: item })
    return 'ok'
  } catch (e) {
    if (e?.userCancelled || e?.code === '1' || /cancel/i.test(e?.message ?? '')) return 'cancelled'
    console.warn('[iap] purchase failed:', e?.message)
    return 'error'
  }
}

// Google Play's own prices (the player's currency), by product id; {} until they load
let prices = null
const listeners = new Set()
async function loadPrices() {
  const p = await init(); if (!p) return
  try {
    const [one, subs] = await Promise.all([
      p.getProducts({ productIdentifiers: ONE_TIME, type: 'NON_SUBSCRIPTION' }),
      p.getProducts({ productIdentifiers: ['bap_pro'], type: 'SUBSCRIPTION' }),
    ])
    prices = Object.fromEntries([...(one.products ?? []), ...(subs.products ?? [])].map(x => [x.identifier, x.priceString]))
    listeners.forEach(fn => fn())
  } catch (e) { console.warn('[iap] prices:', e?.message) }
}

export function useStorePrices() {
  const [, bump] = useState(0)
  useEffect(() => {
    if (!PLAY_BILLING) return
    const fn = () => bump(n => n + 1)
    listeners.add(fn)
    if (!prices) loadPrices()
    return () => listeners.delete(fn)
  }, [])
  return prices ?? {}
}
