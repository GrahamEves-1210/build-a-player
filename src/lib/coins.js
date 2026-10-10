// Coin packs: what real money buys. One list for everyone:
//   website → Stripe Checkout (functions/api/create-coins-checkout.js keeps its
//             own copy of the prices, so the browser can't change them)
//   app     → Apple / Google in-app purchase through RevenueCat (lib/iap.js);
//             each id is the consumable product's id in App Store Connect and
//             Google Play
export const COIN_PACKS = [
  { id: 'bap_coins_500',  coins: 500,  usd: 0.99 },
  { id: 'bap_coins_1200', coins: 1200, usd: 1.99, tag: 'POPULAR' },
  { id: 'bap_coins_3200', coins: 3200, usd: 4.99 },
  { id: 'bap_coins_7000', coins: 7000, usd: 9.99, tag: 'BEST VALUE' },
]
export const packById = id => COIN_PACKS.find(p => p.id === id) ?? null
