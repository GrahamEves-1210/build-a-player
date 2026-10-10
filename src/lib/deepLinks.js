// Deep links into the app (app only): the custom scheme buildaplayer://... and
// universal links / app links on https://build-a-player.com/...
//
//   /?b=<code> or /share/<code>   a shared build (App.jsx reads ?b= at load, so
//                                  the app reloads itself onto /?b=<code>)
//   /join/<CODE> or ?join=<CODE>   a 1v1 / Blacktop invite code: Build-A-Bucket's
//                                  Blacktop, then 'bap:join' { code }
//   /career                        Career (football)
//   /daily, /shop, /profile, /bucket
//
// buildaplayer://career is read like /career (the host is the first segment).
// Discord / Apple sign-in links (com.buildaplayer.app://auth) belong to
// lib/appAuth.js and are left alone.
//
// Native setup (Info.plist URL type, Associated Domains, Android intent filters,
// public/.well-known files) is described in public/.well-known and the infra notes.

import { IS_APP } from './platform'

const PENDING_KEY = 'bap_pending_nav'
const SITE_HOST = /(^|\.)build-a-player\.com$/i
const isBucketPage = () => window.location.pathname.startsWith('/bucket')

// Runs fn once the app's page is mounted (App/BucketApp publish window.__bapPage
// from their first effect), so 'bap:nav' has someone listening.
export function whenReady(fn, extraMs = 250) {
  if (window.__bapPage) { setTimeout(fn, extraMs); return }
  let done = false
  const go = () => { if (done) return; done = true; window.removeEventListener('bap:page', go); setTimeout(fn, extraMs) }
  window.addEventListener('bap:page', go)
  setTimeout(go, 6000)
}

const dispatchNav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function dispatchJoin(code) {
  window.__bapPendingJoin = code   // for a lobby that mounts after the event
  dispatchNav('blacktop')
  setTimeout(() => window.dispatchEvent(new CustomEvent('bap:join', { detail: { code, kind: 'h2h' } })), 300)
}

// Goes to a screen. sport: 'nfl' | 'bucket' | null (either). When the screen
// lives in the other sport's page, the target is parked in sessionStorage and
// the page switches; initDeepLinks() picks it up after the reload.
export function goNav(to, { sport = null, join = null } = {}) {
  const wrongSide = (sport === 'bucket' && !isBucketPage()) || (sport === 'nfl' && isBucketPage())
  if (wrongSide) {
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ to, join, at: Date.now() })) } catch {}
    window.location.href = sport === 'bucket' ? '/bucket' : '/'
    return
  }
  whenReady(() => (join ? dispatchJoin(join) : dispatchNav(to)))
}

function consumePending() {
  let p = null
  try { p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); sessionStorage.removeItem(PENDING_KEY) } catch {}
  if (!p || Date.now() - (p.at ?? 0) > 60000) return
  whenReady(() => (p.join ? dispatchJoin(p.join) : dispatchNav(p.to)), 500)
}

const cleanCode = s => (String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || null)

// Returns true if the link was understood.
export function routeUrl(url) {
  if (!url || url.startsWith('com.buildaplayer.app:')) return false
  let u
  try { u = new URL(url) } catch { return false }
  let path
  if (u.protocol === 'buildaplayer:') path = `/${u.host}${u.pathname}`
  else if ((u.protocol === 'https:' || u.protocol === 'http:') && SITE_HOST.test(u.hostname)) path = u.pathname
  else return false
  path = path.replace(/\/+$/, '') || '/'
  const q = u.searchParams

  // a shared build
  const share = q.get('b') || (path.match(/^\/share\/([^/]+)/)?.[1] ?? null)
  if (share) { window.location.href = `/?b=${encodeURIComponent(decodeURIComponent(share))}`; return true }

  // an invite code
  const code = cleanCode(q.get('join') || path.match(/^\/join\/([^/]+)/)?.[1])
  if (code) { goNav('blacktop', { sport: 'bucket', join: code }); return true }

  if (path === '/career') { goNav('career', { sport: 'nfl' }); return true }
  if (path === '/daily' || q.has('daily')) { goNav('daily'); return true }
  if (path === '/shop') { goNav('shop'); return true }
  if (path === '/profile') { goNav('profile'); return true }
  if (path.startsWith('/bucket')) { if (!isBucketPage()) window.location.href = '/bucket'; return true }
  if (path === '/' || path === '') { if (isBucketPage()) window.location.href = '/'; return true }
  return false
}

let started = false
export function initDeepLinks() {
  if (started) return
  started = true
  consumePending()
  if (!IS_APP) return
  let last = '', lastAt = 0
  import('@capacitor/app').then(({ App }) => {
    // Capacitor keeps the launch link until a listener is added, so a cold start
    // from a link arrives here too.
    App.addListener('appUrlOpen', ({ url }) => {
      if (url === last && Date.now() - lastAt < 2000) return
      last = url; lastAt = Date.now()
      try { routeUrl(url) } catch (e) { console.warn('[deepLinks]', e) }
    })
  }).catch(() => {})
}
