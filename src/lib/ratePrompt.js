// The store rating prompt (app only): the native in-app review sheet
// (@capacitor-community/in-app-review), asked only right after a big moment.
//
// Moments:
//   - a title or a season award: 'bap:season' { champion | award } arms it and
//     the prompt waits for the result to be on screen (.plf-champ-label /
//     .mvp-winner-tag--you, the same nodes juice.js celebrates); Career seasons
//     are booked as they're shown, so those go straight away
//   - 'bap:victory' { big: true }, for anything that announces a big win
//   - a level-up, once its level-up screen has been seen (seenLevel catches up)
// Rules: 5+ sessions, 3+ days since install, never in the first session, never
// within 60s of an error, at most once every 120 days and 3 times ever, once a
// session, and 2.5s after the moment so the celebration plays first.
// Counters live in localStorage (bap_rate).

import { IS_APP } from './platform'
import { lastErrorAt } from './errorLog'

const KEY = 'bap_rate'
const DAY = 86400000
const MIN_SESSIONS = 5
const MIN_DAYS = 3
const GAP_DAYS = 120
const MAX_ASKS = 3
const DELAY = 2500
const SESSION_GAP = 30 * 60000      // back from 30+ minutes away = a new session

function load() {
  try { return { installAt: 0, sessions: 0, asks: 0, lastAskAt: 0, bgAt: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { installAt: 0, sessions: 0, asks: 0, lastAskAt: 0, bgAt: 0 } }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }

let firstSession = false
let askedThisSession = false
let pending = null

function eligible() {
  const s = load(), now = Date.now()
  if (firstSession || askedThisSession) return false
  if (s.sessions < MIN_SESSIONS) return false
  if (!s.installAt || now - s.installAt < MIN_DAYS * DAY) return false
  if (s.asks >= MAX_ASKS) return false
  if (s.lastAskAt && now - s.lastAskAt < GAP_DAYS * DAY) return false
  if (now - lastErrorAt() < 60000) return false
  if (document.hidden) return false
  return true
}

async function ask() {
  if (!eligible()) return
  askedThisSession = true
  const s = load()
  save({ ...s, asks: s.asks + 1, lastAskAt: Date.now() })
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()
  } catch (e) { console.warn('[rate] review sheet failed', e) }
}

// A big moment just happened (or is on screen now)
export function bigMoment() {
  if (!IS_APP || !eligible()) return
  clearTimeout(pending)
  pending = setTimeout(ask, DELAY)
}

// Waits (up to 3 minutes) for one of the result nodes to appear, then fires.
let watcher = null
function armForReveal() {
  if (!eligible()) return
  watcher?.stop()
  const sel = '.plf-champ-label, .mvp-winner-tag--you'
  if (document.querySelector(sel)) { bigMoment(); return }
  const mo = new MutationObserver(() => { if (document.querySelector(sel)) { stop(); bigMoment() } })
  const t = setTimeout(() => stop(), 180000)
  const stop = () => { mo.disconnect(); clearTimeout(t); watcher = null }
  mo.observe(document.body, { childList: true, subtree: true })
  watcher = { stop }
}

let started = false
export function initRatePrompt() {
  if (!IS_APP || started) return
  started = true
  const s = load()
  if (!s.installAt) { firstSession = true; s.installAt = Date.now() }
  s.sessions += 1
  save(s)

  window.addEventListener('bap:season', e => {
    const d = e.detail || {}
    if (d.sandbox || !(d.champion || d.award)) return
    if (d.mode === 'career') bigMoment()
    else armForReveal()
  })
  window.addEventListener('bap:victory', e => { if (e.detail?.big) bigMoment() })

  // a level-up: the level screen sets seenLevel to the level once it's shown
  let lvl = null, seen = null
  const onProgress = () => {
    import('./progress').then(P => {
      const p = P.getProgress()
      const L = p?.lvl?.level ?? null
      if (!p?.signedIn || L == null) { lvl = null; seen = null; return }
      // the level was already reached with its screen pending, and now it's been seen
      // (an account sync raises level and seenLevel together: no prompt for that)
      if (lvl === L && seen != null && seen < L && p.seenLevel >= L) bigMoment()
      lvl = L; seen = p.seenLevel
    }).catch(() => {})
  }
  window.addEventListener('bap:progress', onProgress)

  // sessions: coming back after 30+ minutes away counts as a new one
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => {
      const cur = load()
      if (!isActive) { save({ ...cur, bgAt: Date.now() }); clearTimeout(pending); watcher?.stop(); return }
      if (cur.bgAt && Date.now() - cur.bgAt > SESSION_GAP) {
        save({ ...cur, sessions: cur.sessions + 1, bgAt: 0 })
        firstSession = false
        askedThisSession = false
      }
    })
  }).catch(() => {})
}
