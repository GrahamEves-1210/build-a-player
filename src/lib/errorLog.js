// Crash and error reporting. Uncaught errors, unhandled promise rejections and
// React render errors (components/ErrorBoundary.jsx) are written to the
// Supabase table client_errors (supabase/client_errors.sql: anyone can insert,
// nobody can read through the anon key).
//
// Kept quiet on purpose: at most 5 reports a session, the same message once a
// session (and once a day per device), and the usual browser noise (extensions,
// cross-origin "Script error.", ResizeObserver, ad scripts) is skipped.

import { supabase } from './supabase'
import { IS_APP, APP_PLATFORM } from './platform'
import { version as PKG_VERSION } from '../../package.json'

const MAX_PER_SESSION = 5
const STACK_MAX = 4000
const MSG_MAX = 1000
const SEEN_KEY = 'bap_err_seen'       // { hash: reportedAt } across sessions, 24h
const DAY = 86400000

let started = false
let sent = 0
let lastAt = 0
const sessionSeen = new Set()
let appVersion = PKG_VERSION
let buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : ''

// When the last error happened (any error, reported or not), for the rating
// prompt: it never asks within a minute of something breaking.
export const lastErrorAt = () => lastAt

const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection captured/i,
  /chrome-extension:|moz-extension:|safari-extension:|safari-web-extension:/i,
  /ramp\.js|playwire|googlesyndication|doubleclick|googletagmanager|adsbygoogle|pubads|prebid/i,
  /Load failed$|Failed to fetch$|NetworkError when attempting to fetch/i,   // offline: the banner covers it
  /AbortError|The operation was aborted/i,
]
const isNoise = (msg, stack) => NOISE.some(re => re.test(msg) || (stack && re.test(stack)))

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}

function seenRecently(h) {
  try {
    const m = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')
    const now = Date.now()
    for (const k of Object.keys(m)) if (now - m[k] > DAY) delete m[k]
    const hit = !!m[h]
    if (!hit) m[h] = now
    localStorage.setItem(SEEN_KEY, JSON.stringify(m))
    return hit
  } catch { return false }
}

const clip = (s, n) => (s == null ? null : String(s).slice(0, n))

function describe(err) {
  if (err instanceof Error) return { message: err.message || err.name || 'Error', stack: err.stack || '' }
  if (err && typeof err === 'object') {
    const message = err.message || err.reason || (() => { try { return JSON.stringify(err) } catch { return String(err) } })()
    return { message: String(message), stack: err.stack || '' }
  }
  return { message: String(err), stack: '' }
}

// kind: 'error' | 'rejection' | 'react' | 'manual'; extra: { componentStack, ... }
export async function reportError(err, kind = 'manual', extra = null) {
  lastAt = Date.now()
  try {
    const { message, stack } = describe(err)
    const fullStack = [stack, extra?.componentStack ? `\n-- component stack --${extra.componentStack}` : ''].join('')
    if (!message || isNoise(message, stack)) return
    if (sent >= MAX_PER_SESSION) return
    const h = hash(`${kind}|${message}`)
    if (sessionSeen.has(h)) return
    sessionSeen.add(h)
    if (seenRecently(h)) return
    if (!supabase) return
    sent++
    let userId = null
    try { userId = (await supabase.auth.getSession()).data.session?.user?.id ?? null } catch {}
    const row = {
      message: clip(message, MSG_MAX),
      stack: clip(fullStack, STACK_MAX) || null,
      kind,
      page: clip(window.location.pathname + window.location.search, 500),
      platform: APP_PLATFORM,
      app_version: clip(`${appVersion}${buildDate ? ` (${buildDate})` : ''}`, 60),
      user_id: userId,
      user_agent: clip(navigator.userAgent, 400),
    }
    await supabase.from('client_errors').insert(row)
  } catch { /* reporting must never throw */ }
}

export function initErrorLog() {
  if (started) return
  started = true
  // the app's real version (Xcode / Gradle), not package.json's
  if (IS_APP) import('@capacitor/app').then(({ App }) => App.getInfo()).then(i => { if (i?.version) { appVersion = i.version; buildDate = i.build ? `build ${i.build}` : buildDate } }).catch(() => {})
  window.addEventListener('error', e => {
    // resource load errors (an <img> 404) have no message and target an element
    if (!e.message && e.target && e.target !== window) return
    reportError(e.error ?? e.message, 'error', null)
  })
  window.addEventListener('unhandledrejection', e => reportError(e.reason ?? 'Unhandled rejection', 'rejection', null))
}
