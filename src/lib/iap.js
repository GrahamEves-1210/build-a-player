// App purchases (coins) through RevenueCat, which talks to the App Store and
// Google Play and checks every receipt. Coins are consumables: a finished
// purchase adds the pack's coins to the wallet on the spot.
//
// Setup outside the code:
//   1. App Store Connect + Google Play: a consumable in-app product per pack,
//      ids exactly as in lib/coins.js (bap_coins_1200, …), with their prices.
//   2. RevenueCat (free tier): a project with the iOS and Android apps, the
//      products imported; its public SDK keys go in .env.app as
//      VITE_RC_IOS_KEY and VITE_RC_ANDROID_KEY.
//   3. App Store Connect → Agreements: the Paid Apps agreement signed.
import { Capacitor } from '@capacitor/core'
import { IS_APP } from './platform'
import { COIN_PACKS } from './coins'

let P = null
let ready = null
const key = () => (Capacitor.getPlatform() === 'ios' ? import.meta.env.VITE_RC_IOS_KEY : import.meta.env.VITE_RC_ANDROID_KEY)

function init() {
  if (!IS_APP || !key()) return Promise.resolve(null)
  ready ??= import('@revenuecat/purchases-capacitor').then(async m => {
    P = m.Purchases
    await P.configure({ apiKey: key() })
    return P
  }).catch(e => { console.warn('[iap] unavailable:', e?.message); ready = null; return null })
  return ready
}

// Purchases follow the account (restores, support) once signed in
export async function iapUser(uid) {
  const p = await init(); if (!p) return
  try { if (uid) await p.logIn({ appUserID: uid }); else await p.logOut() } catch {}
}

// The store's own prices (local currency), by pack id
export async function storePrices() {
  const p = await init(); if (!p) return {}
  try {
    const { products } = await p.getProducts({ productIdentifiers: COIN_PACKS.map(x => x.id), type: 'NON_SUBSCRIPTION' })
    return Object.fromEntries((products ?? []).map(x => [x.identifier, x.priceString]))
  } catch { return {} }
}

// 'ok' | 'cancelled' | 'unavailable' | 'error'
export async function buyPack(pack) {
  const p = await init(); if (!p) return 'unavailable'
  try {
    const { products } = await p.getProducts({ productIdentifiers: [pack.id], type: 'NON_SUBSCRIPTION' })
    const product = products?.[0]
    if (!product) return 'unavailable'
    await p.purchaseStoreProduct({ product })
    return 'ok'
  } catch (e) {
    if (e?.userCancelled || e?.code === '1' || /cancel/i.test(e?.message ?? '')) return 'cancelled'
    console.warn('[iap] purchase failed:', e?.message)
    return 'error'
  }
}
