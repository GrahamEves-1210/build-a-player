// Coin packs: what real money buys. One list for everyone:
//   website → Stripe Checkout (functions/api/create-coins-checkout.js keeps its
//             own copy of the prices, so the browser can't change them)
//   app     → the same Stripe Checkout, opened in the phone's browser
//             (lib/webCheckout.js). Ids are kept as they are (the store products
//             in lib/iap.js use them, should in-app purchase come back)
export const COIN_PACKS = [
  { id: 'bap_coins_1200',  coins: 2500,  usd: 1.99 },
  { id: 'bap_coins_3200',  coins: 7000,  usd: 4.99, tag: 'POPULAR' },
  { id: 'bap_coins_7000',  coins: 15000, usd: 9.99 },
  { id: 'bap_coins_15000', coins: 32000, usd: 19.99, tag: 'BEST VALUE' },
]
export const packById = id => COIN_PACKS.find(p => p.id === id) ?? null
