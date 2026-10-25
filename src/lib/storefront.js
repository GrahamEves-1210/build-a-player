import { IS_APP, APP_PLATFORM } from './platform'

// Where the app may sell. Coins and BAP Pro are bought through our own checkout (Stripe on
// the web), and Apple and Google allow a link out to that only in the US; everywhere else a
// digital purchase has to be the store's own in-app purchase. So in the app, the buy buttons
// and the Pro Vault show only in the US. The website sells everywhere.
//
// Which country: on iPhone, the account's App Store from StoreKit (through RevenueCat, once its
// iOS key is in .env.app as VITE_RC_IOS_KEY). Otherwise (and on Android) the phone's own
// settings stand in: an American English language and a US time zone. Only "US" sells.

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

export const sellsHere = () => !IS_APP || (country ?? fromSettings()) === 'US'
export const onStorefront = fn => { listeners.add(fn); return () => listeners.delete(fn) }
