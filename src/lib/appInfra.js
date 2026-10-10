// Startup for the app's plumbing, called once from main.jsx before the first
// render. Each piece is its own module:
//   lib/errorLog.js     window errors + rejections → Supabase client_errors (app + website)
//   lib/deepLinks.js    buildaplayer:// and https://build-a-player.com links (app)
//   lib/notify.js       local notifications + the permission ask (app)
//   lib/ratePrompt.js   the store rating sheet after big moments (app)
//   lib/versionCheck.js min / latest version from app_config (app)
// The visible parts (offline strip, update gate) are components/app/AppInfra.jsx,
// re-exported here so main.jsx needs a single import.

import { IS_APP } from './platform'
import { initErrorLog } from './errorLog'
import { initDeepLinks } from './deepLinks'

export { default as AppInfra } from '../components/app/AppInfra.jsx'

let started = false
export function initAppInfra() {
  if (started) return
  started = true
  try { initErrorLog() } catch {}
  try { initDeepLinks() } catch {}   // also finishes a hop between football and Build-A-Bucket on the website
  if (!IS_APP) return
  import('./notify').then(m => m.initNotifications()).catch(() => {})
  import('./ratePrompt').then(m => m.initRatePrompt()).catch(() => {})
  import('./versionCheck').then(m => m.initVersionCheck()).catch(() => {})
}
