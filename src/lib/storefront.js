import { IS_APP, APP_PLATFORM, PLAY_BILLING } from './platform'

// Where the app may sell. On iPhone, coins and BAP Pro are bought through our own checkout
// (Stripe on the web), and Apple allows a link out to that only on the US App Store; everywhere
// else a digital purchase has to be Apple's in-app purchase. So on iPhone, the buy buttons and
// the Pro Vault show only in the US. Android buys through Google Play everywhere (lib/iap.js).
// The website sells everywhere.
//
// Which country (iPhone): the account's App Store from StoreKit (through RevenueCat, once its
// iOS key is in .env.app as VITE_RC_IOS_KEY). Until then the phone's own settings stand in: an
// American English language and a US time zone. Only "US" sells.

const US_ZONES = /^(America\/(New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Metlakatla|Nome|Yakutat|Adak|Boise|Detroit|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu)$/

function fromSettings() {
  try {
    const lang = (navigator.languages?.[0] || navigator.language || '').toLowerCase()
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    return lang.endsWith('-us') && US_ZONES.test(zone) ? 'US' : 'XX'
  } catch { return 'XX' }
}

let country = null                       // the App Store's country (ISO 3166 alpha-2), once known
const listeners = new Set()

// Ask StoreKit once, at launch (a no-op on the website, on Android and without the RevenueCat key)
export async function loadStorefront() {
  const key = import.meta.env.VITE_RC_IOS_KEY
  if (APP_PLATFORM !== 'ios' || !key) return
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    await Purchases.configure({ apiKey: key })
    const sf = await Purchases.getStorefront()
    const code = String(sf?.countryCode ?? '').toUpperCase()
    if (code) { country = code === 'USA' ? 'US' : code.length === 2 ? code : 'XX'; listeners.forEach(fn => fn()) }
  } catch { /* the phone's settings stand in */ }
}

// Android sells everywhere through Google Play Billing (lib/iap.js), and only that way
export const sellsHere = () => !IS_APP || (APP_PLATFORM === 'android' ? PLAY_BILLING : (country ?? fromSettings()) === 'US')
export const onStorefront = fn => { listeners.add(fn); return () => listeners.delete(fn) }
