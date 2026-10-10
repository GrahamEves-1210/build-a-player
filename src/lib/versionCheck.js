// Minimum / latest version check (app only). Reads the Supabase table
// app_config (supabase/app_config.sql; key → value, public read):
//
//   min_version            below this the app is blocked: "Update required"
//   latest_version         below this a dismissible "update available" card,
//                          once per version
//   min_version_ios / min_version_android / latest_version_ios /
//   latest_version_android  optional per-platform overrides
//   ios_store_url / android_store_url   where the Update button goes
//
// The app's own version comes from @capacitor/app getInfo() (Xcode's
// MARKETING_VERSION / Gradle's versionName). The last config is cached so a
// forced update still holds offline. Shown by components/app/UpdateGate.jsx.

import { IS_APP, APP_PLATFORM } from './platform'
import { supabase } from './supabase'

const CACHE_KEY = 'bap_app_config'
const DISMISS_KEY = 'bap_update_dismissed'
const RECHECK = 6 * 3600000
const STORE_DEFAULT = {
  ios: 'https://apps.apple.com/app/build-a-player/id0000000000',
  android: 'https://play.google.com/store/apps/details?id=com.buildaplayer.app',
}

// 'ok' | 'soft' | 'hard'
let state = { status: 'ok', current: null, latest: null, min: null, url: null }
const listeners = new Set()
const set = s => { state = s; listeners.forEach(fn => fn()) }
export const getUpdateState = () => state
export function subscribeUpdate(fn) { listeners.add(fn); return () => listeners.delete(fn) }

// -1 / 0 / 1, numeric parts ("1.10.0" > "1.9.3"; missing parts are 0)
export function compareVersions(a, b) {
  const pa = String(a || '0').split(/[.+-]/).map(n => parseInt(n, 10) || 0)
  const pb = String(b || '0').split(/[.+-]/).map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

async function fetchConfig() {
  if (!supabase) throw new Error('no supabase')
  const { data, error } = await supabase.from('app_config').select('key,value')
  if (error) throw error
  const cfg = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)) } catch {}
  return cfg
}
function cachedConfig() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null } }

let current = null
let lastCheck = 0
export async function checkVersion() {
  if (!IS_APP) return state
  lastCheck = Date.now()
  try {
    if (!current) current = (await (await import('@capacitor/app')).App.getInfo()).version
  } catch { return state }
  let cfg
  try { cfg = await fetchConfig() } catch { cfg = cachedConfig() }
  if (!cfg) return state
  const p = APP_PLATFORM
  const min = cfg[`min_version_${p}`] || cfg.min_version || null
  const latest = cfg[`latest_version_${p}`] || cfg.latest_version || null
  const url = cfg[`${p}_store_url`] || STORE_DEFAULT[p] || null
  let status = 'ok'
  if (min && compareVersions(current, min) < 0) status = 'hard'
  else if (latest && compareVersions(current, latest) < 0) {
    let dismissed = null
    try { dismissed = localStorage.getItem(DISMISS_KEY) } catch {}
    if (dismissed !== latest) status = 'soft'
  }
  set({ status, current, latest, min, url })
  return state
}

export function dismissUpdate() {
  try { if (state.latest) localStorage.setItem(DISMISS_KEY, state.latest) } catch {}
  set({ ...state, status: state.status === 'soft' ? 'ok' : state.status })
}

// The store page opens outside the app (Capacitor hands links to other hosts
// to the system: the App Store / Play Store app)
export function openStore() {
  const url = state.url
  if (!url) return
  window.location.href = url
}

let started = false
export function initVersionCheck() {
  if (!IS_APP || started) return
  started = true
  setTimeout(checkVersion, 1500)
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => { if (isActive && Date.now() - lastCheck > RECHECK) checkVersion() })
  }).catch(() => {})
}
