// Every page has its own address (owner, 2026-11-26), and the ads follow it (lib/ads.js).
//
// Football has no prefix; basketball is under /bucket, soccer /soccer, baseball /baseball (main.jsx picks the game
// by the prefix). Each game reports its page here (routePage, from a layout effect); the dock (AppTabBar) reports
// the screen it has open over the page (Daily, Shop, Cards…: routeScreen). From the two this works out the address:
//   - the ads for it, at once (rampPage with that path, before the new page's own in-page units ask)
//   - the address itself a moment later (setTimeout 0, so a Back that changes the page and closes a screen in two
//     renders settles first): pushed when it's a new page, replaced when it's a Back/Forward landing somewhere the
//     game can't show (a sim result gone after a reload) or the first address of a visit ('/' → '/home')
// A refresh opens the page its address names (pageAtLoad), or that game's Home when the page needs what a reload
// lost; Back/Forward call each game's own resolver (onRoutePop), which does the same.

import { IS_APP, APP_LOOK } from './platform'
import { rampPage, rampLiveGame, DOCK_UNITS, RAIL_UNITS } from './ads'

export const PREFIX = { nfl: '', bucket: '/bucket', soccer: '/soccer', baseball: '/baseball' }
export const sportOfPath = p => (/^\/bucket(\/|$)/.test(p) ? 'bucket' : /^\/soccer(\/|$)/.test(p) ? 'soccer' : /^\/baseball(\/|$)/.test(p) ? 'baseball' : 'nfl')

// page → address under the game's prefix
const SLUG = {
  splash: 'home', leaderboard: 'ranks', profile: 'profile',
  game: 'build', sim: 'simulate', salarycap: 'salary-cap', 'soon-salary': 'salary-cap', 'depth-chart': 'depth-chart',
  squad: 'squad', 'squad-build': 'squad/spin',
  career: 'career', 'career-intro': 'career/saves', 'career-build': 'career/spin',
  franchise: 'franchise', 'franchise-build': 'franchise/spin', nbafranchise: 'franchise', 'nbafranchise-build': 'franchise/spin',
  cfb: 'college', cbb: 'college', auction: 'auction',
  blacktop: 'blacktop', 'blacktop-build': 'blacktop/spin', 'blacktop-game': 'blacktop/game', 'pvp-leaderboard': 'blacktop/ranks',
  'versus-lobby': 'versus', 'versus-game': 'versus/game', 'versus-result': 'versus/result',
  about: 'about', privacy: 'privacy', terms: 'terms', wiki: 'wiki',
  // Blacktop Live (?btlive=1): its menu, King of the Hill online, and a game being played (holdLiveGame)
  btlive: 'blacktop/practice', koth: 'blacktop/koth', 'btlive-play': 'blacktop/play',
}
// the dock's screens over the page (AppTabBar): their own addresses
const SCREEN_SLUG = { daily: 'daily', shop: 'shop', cards: 'cards', achievements: 'achievements', locker: 'locker', pass: 'pass', online: 'online' }
// address → page, per game (the slugs two pages share: basketball's Franchise and College are its own)
const SPORT_PAGE = {
  bucket: { franchise: 'nbafranchise', 'franchise/spin': 'nbafranchise-build', college: 'cbb' },
  nfl: { college: 'cfb' },
}
// the addresses from before (and the plain ones people type)
const ALIAS = { '': 'splash', leaderboard: 'leaderboard', simulate: 'sim', salary: 'salarycap', 'squad-build': 'squad-build', 'career-build': 'career-build' }

// The five dock pages, Depth Chart and Career (its hub and saves, not its spin: the rail would sit on the spin) run
// the left rail (lib/ads.js DOCK_UNITS); every other page runs the corner video and the bottom rail
const LEFT_RAIL = new Set(['splash', 'leaderboard', 'profile', 'depth-chart', 'career', 'career-intro'])
const LEFT_SCREENS = new Set(['daily', 'shop'])
// the dock's pages: moving among them never reloads the rails (rampPage soft)
const SOFT = new Set(['splash', 'leaderboard', 'profile'])

const PAGE_OF_SLUG = Object.fromEntries(Object.entries(SLUG).filter(([p]) => !['soon-salary', 'nbafranchise', 'nbafranchise-build', 'cbb', 'cfb'].includes(p)).map(([p, s]) => [s, p]))

// What an address names: { sport, page, screen } (page null on a screen's address; both null when it's unknown)
export function parsePath(pathname = window.location.pathname, search = window.location.search) {
  const sport = sportOfPath(pathname)
  let rest = pathname.slice(PREFIX[sport].length).replace(/^\/+|\/+$/g, '')
  if (sport === 'nfl' && rest.startsWith('wiki')) return { sport, page: 'wiki', screen: null }
  if (sport === 'nfl' && !rest && new URLSearchParams(search).has('about')) return { sport, page: 'about', screen: null }
  const screen = Object.keys(SCREEN_SLUG).find(k => SCREEN_SLUG[k] === rest) ?? null
  if (screen) return { sport, page: null, screen }
  const page = SPORT_PAGE[sport]?.[rest] ?? PAGE_OF_SLUG[rest] ?? ALIAS[rest] ?? null
  return { sport, page, screen: null }
}

export function pathFor(sport, page, screen = null) {
  const pre = PREFIX[sport] ?? ''
  if (screen && SCREEN_SLUG[screen]) return `${pre}/${SCREEN_SLUG[screen]}`
  if (page === 'wiki') { const here = window.location.pathname; return here.startsWith('/wiki') ? here : '/wiki' }
  const slug = SLUG[page]
  return slug ? `${pre}/${slug}` : null
}

// the game's bare address ('/', '/bucket'): a refresh there may pick up the build the tab was on (lib/buildSave.js);
// any other address opens what it names
export const atRoot = sport => window.location.pathname.replace(/\/+$/, '') === PREFIX[sport] && !new URLSearchParams(window.location.search).has('about')
// the page this address opens on a refresh (the games decide whether they can show it)
export const pageAtLoad = sport => { const r = parsePath(); return r.sport === sport ? r.page : null }

// ── where things are now ───────────────────────────────────────────────────────────────────────
const at = (() => {
  const r = typeof window === 'undefined' ? { page: null, screen: null } : parsePath()
  // (a dock screen opens only where the dock is: the classic look has none, so /daily there is Home)
  return { sport: null, page: null, screen: (IS_APP || APP_LOOK) ? r.screen : null, live: 0 }
})()
const APP_PUSH = new Set(['sim', 'leaderboard', 'depth-chart', 'wiki', 'salarycap', 'profile'])
let replaceNext = false
let popped = false, first = true, timer = 0, lastAdPath = null

// the query a page change keeps: the dev switches and Playwire's review flag (a shared build, ?daily, ?join… are
// one-time); and the #google_sample_tag hash Ramp's review reads
const STICKY = ['soccer', 'baseball', 'franchise', 'nbafranchise', 'btlive', 'koth', 'cfb', 'cbb', 'lb', 'ol', 'k', 'clean', 'appsim', 'passsale', 'rail', 'btlook', 'rewarded-test']
function keptQuery() {
  const q = new URLSearchParams(window.location.search)
  const out = new URLSearchParams()
  for (const [k, v] of q) if (STICKY.includes(k)) out.append(k, v)
  const s = out.toString().replace(/=(?=&|$)/g, '')
  return (s ? `?${s}` : '') + (window.location.hash === '#google_sample_tag' ? window.location.hash : '')
}

function oneTimeOff() {
  const q = new URLSearchParams(window.location.search)
  if (!q.has('about') && !q.has('bthub')) return window.location.search
  q.delete('about'); q.delete('bthub')
  const s = q.toString().replace(/=(?=&|$)/g, '')
  return s ? `?${s}` : ''
}

export const currentPath = () => (!at.sport ? null : at.live ? `${PREFIX[at.sport]}/blacktop/play` : pathFor(at.sport, at.page, at.screen))

function applyAds() {
  const path = currentPath()
  if (!path || path === lastAdPath) return
  lastAdPath = path
  if (at.live) { rampPage({ ads: RAIL_UNITS, path }); return }   // (the rails are held off: the corner video only, lib/ads.js)
  const left = at.screen ? LEFT_SCREENS.has(at.screen) : LEFT_RAIL.has(at.page)
  const soft = at.screen ? LEFT_SCREENS.has(at.screen) : SOFT.has(at.page)
  rampPage({ ads: left ? DOCK_UNITS : RAIL_UNITS, path, soft })
}

function sync() {
  timer = 0
  const target = currentPath()
  const replace = popped || first || replaceNext
  popped = false
  replaceNext = false
  if (!target) return                                     // (a shared build keeps its ?b= address)
  if (window.location.pathname === '/minigame') return    // (lib/ads.js puts the address back when the game closes)
  first = false
  if (window.location.pathname === target) return
  // (a replace keeps the query, less the one-time ?about and ?bthub, which the address now says; a new page keeps only
  // the sticky switches)
  const url = target + (replace ? oneTimeOff() + window.location.hash : keptQuery())
  // (the app has no address bar: only the pages that had an entry of their own before do, so Android's Back works as it did)
  if (replace || (IS_APP && (at.screen || !APP_PUSH.has(at.page)))) window.history.replaceState(window.history.state, '', url)
  else window.history.pushState({}, '', url)
}
const later = () => { if (!timer) timer = setTimeout(sync, 0) }

// ads: false for a page that asks for none (Blacktop Live on a phone)
export function routePage(sport, page, { ads = true } = {}) {
  // (any page change closes the dock's screen: AppTabBar's bap:page listener; the first report keeps the one the
  // address opened)
  if (at.page !== null && page !== at.page) at.screen = null
  at.sport = sport
  at.page = page
  if (ads) applyAds()
  later()
}

export function routeScreen(screen) {
  const s = SCREEN_SLUG[screen] ? screen : null
  if (s === at.screen) return
  at.screen = s
  if (at.sport) { applyAds(); later() }
}
// A live Blacktop game being played: its own address (/bucket/blacktop/play, in place of the page's: no history entry,
// so Back leaves the game as it always did) and the corner video only. Returns the release, which puts the page's
// address and units back (its final screen follows the normal rule)
export function holdLiveGame() {
  const release = rampLiveGame()
  at.live++
  lastAdPath = null; replaceNext = true
  applyAds(); later()
  let done = false
  return () => {
    if (done) return
    done = true
    release()
    at.live--
    lastAdPath = null; replaceNext = true
    applyAds(); later()
  }
}

// the screen a visit opens with (AppTabBar's first state)
export const screenAtLoad = () => at.screen

// Back/Forward: fn({ page, screen }) with what the address names, for the game to land on (or on Home)
export function onRoutePop(sport, fn) {
  const on = () => { const r = parsePath(); if (r.sport === sport) fn(r) }
  window.addEventListener('popstate', on)
  return () => window.removeEventListener('popstate', on)
}

if (typeof window !== 'undefined') {
  // (first, before the games' own listeners: their page changes from a Back settle the address by replacing it)
  window.addEventListener('popstate', () => { popped = true; later() })
  // a mini game closed (lib/ads.js put its address back): the page may have moved on under it
  window.addEventListener('bap:minigame-closed', () => { popped = true; later() })
}
