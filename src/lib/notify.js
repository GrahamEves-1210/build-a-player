// Local notifications (app only; every call is a no-op on the website).
//
//   streak   "Streak on the line": 7pm local on the day the login streak would
//            break (only for a streak of 2+ days, and never after the reset)
//   daily    "Daily drop ready": the shop's free coins, at the daily reset
//            (America/New_York midnight), moved to 9am local if that's at night
//   career   "Career season waiting": 5pm tomorrow while a football career is
//            in progress (bap_career_nfl_* in localStorage)
//   friends  can't be scheduled on the device; the pref only gates the in-app
//            toasts for friend requests and invites (notifOn('friends'))
//
// Everything is cancelled and rebuilt by scheduleAll(), which runs at launch, on
// every trip to the background and back, and whenever a pref changes. The
// permission prompt waits until after the player's second season
// (maybeAskNotifs), not the first launch.
//
// Settings: NOTIF_KINDS, notifPrefs(), setNotifPref(id, on), notifOn(kind).

import { IS_APP } from './platform'

export const NOTIF_KINDS = [
  { id: 'streak', label: 'Streak ending tonight' },
  { id: 'daily', label: 'Daily drop ready' },
  { id: 'career', label: 'Career season waiting' },
  { id: 'friends', label: 'Friend requests & invites' },
]

const PREF_KEY = 'bap_notif_prefs'
const ASK_KEY = 'bap_notif_ask'          // { seasons, asked }
const IDS = { streak: 4101, daily: 4102, career: 4103 }
const DAY = 86400000
const MIN = 60000

const DEFAULTS = Object.fromEntries(NOTIF_KINDS.map(k => [k.id, true]))

export function notifPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}')
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === 'boolean') out[k] = saved[k]
    return out
  } catch { return { ...DEFAULTS } }
}

// In-app use (friend request / invite toasts): is this kind switched on?
export const notifOn = kind => !!notifPrefs()[kind]

// wrapped: a promise must never resolve to a plugin proxy (it'd call .then on the native plugin)
const LN = () => import('@capacitor/local-notifications').then(m => ({ L: m.LocalNotifications }))

async function permission() {
  try { return (await (await LN()).L.checkPermissions()).display } catch { return 'denied' }
}
async function requestPermission() {
  markAsked()
  try { return (await (await LN()).L.requestPermissions()).display } catch { return 'denied' }
}

// Saves the switch; turning one on asks for permission the first time (if the
// phone hasn't been asked yet). Resolves the permission state
// ('granted' | 'denied' | 'prompt' | 'web').
export async function setNotifPref(id, on) {
  const prefs = { ...notifPrefs(), [id]: !!on }
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch {}
  window.dispatchEvent(new CustomEvent('bap:notif-prefs', { detail: prefs }))
  if (!IS_APP) return 'web'
  let perm = await permission()
  if (on && id !== 'friends' && String(perm).startsWith('prompt')) perm = await requestPermission()
  await scheduleAll()
  return perm
}

// ── Times ────────────────────────────────────────────────────────────────────
const atLocal = (t, h, m = 0) => { const d = new Date(t); d.setHours(h, m, 0, 0); return d.getTime() }

// the latest 7pm local that's at least 90 minutes before the deadline
function streakTime(deadline) {
  let at = atLocal(deadline, 19)
  if (at > deadline - 90 * MIN) at = atLocal(deadline - DAY, 19)
  return at
}
// t, or 9am local if t is at night (9pm–9am)
function daytime(t) {
  const h = new Date(t).getHours()
  if (h >= 9 && h < 21) return t
  return h >= 21 ? atLocal(t + DAY, 9) : atLocal(t, 9)
}

function careerInProgress() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('bap_career_nfl_')) continue
      const c = JSON.parse(localStorage.getItem(k) || 'null')
      if (!c || !c.pos || c.retired || c.phase === 'retired' || c.phase === 'done') continue
      return c
    }
  } catch {}
  return null
}

function careerCopy(c) {
  if (c.phase === 'season') return 'Your season is paused mid-schedule. The team is waiting on you.'
  if (c.phase === 'offseason') return 'The offseason is over. Next season is ready to kick off.'
  if (c.phase === 'draft') return 'Draft day is still on the clock. Go get picked.'
  return 'Your career is waiting. Next snap is yours.'
}

// ── Scheduling ───────────────────────────────────────────────────────────────
let chain = Promise.resolve()
export function scheduleAll() {
  if (!IS_APP) return Promise.resolve()
  chain = chain.then(run, run)
  return chain
}

async function run() {
  try {
    const { L } = await LN()
    try { await L.cancel({ notifications: Object.values(IDS).map(id => ({ id })) }) } catch {}
    if ((await permission()) !== 'granted') return
    const prefs = notifPrefs()
    const now = Date.now()
    const P = await import('./progress')
    const list = []

    if (prefs.streak) {
      const st = P.getProgress()?.streak
      const today = P.dayKey()
      let deadline = null
      if (st?.last === today) deadline = now + P.msToReset() + DAY        // kept today: tomorrow night
      else if (st?.last === P.dayKey(-1)) deadline = now + P.msToReset()  // not kept yet: tonight
      if (deadline && (st?.count ?? 0) >= 2) {
        const at = streakTime(deadline)
        if (at > now + 10 * MIN) list.push({
          id: IDS.streak, title: 'Streak on the line',
          body: `Your ${st.count}-day streak ends tonight. One quick visit keeps it alive.`,
          at, extra: { nav: 'home' },
        })
      }
    }

    if (prefs.daily) {
      const at = daytime(now + P.msToReset() + 30000)
      list.push({ id: IDS.daily, title: 'Daily drop ready', body: 'Free coins just landed in the shop. Grab them before they reset.', at, extra: { nav: 'shop' } })
    }

    if (prefs.career) {
      const c = careerInProgress()
      if (c) list.push({ id: IDS.career, title: 'Career season waiting', body: careerCopy(c), at: atLocal(now + DAY, 17), extra: { nav: 'career', sport: 'nfl' } })
    }

    if (!list.length) return
    await L.schedule({
      notifications: list.map(n => ({
        id: n.id, title: n.title, body: n.body,
        schedule: { at: new Date(n.at), allowWhileIdle: false },
        extra: n.extra,
      })),
    })
  } catch (e) {
    console.warn('[notify] schedule failed', e)
  }
}

// ── Asking for permission: after the second season, once ─────────────────────
function askState() { try { return { seasons: 0, asked: false, ...JSON.parse(localStorage.getItem(ASK_KEY) || '{}') } } catch { return { seasons: 0, asked: false } } }
function saveAsk(s) { try { localStorage.setItem(ASK_KEY, JSON.stringify(s)) } catch {} }
function markAsked() { saveAsk({ ...askState(), asked: true }) }

let askBusy = false
async function askNow() {
  if (askBusy || askState().asked) return
  askBusy = true
  try {
    const prefs = notifPrefs()
    if (!prefs.streak && !prefs.daily && !prefs.career) { markAsked(); return }
    const perm = await permission()
    if (perm === 'granted' || perm === 'denied') { markAsked(); if (perm === 'granted') scheduleAll(); return }
    if ((await requestPermission()) === 'granted') scheduleAll()
  } finally { askBusy = false }
}

// Counts finished seasons; after the second one the permission prompt shows the
// next time the player lands on Home (or at the next launch), so it never cuts
// into a season reveal.
let askStarted = false
export function maybeAskNotifs() {
  if (!IS_APP || askStarted) return
  askStarted = true
  if (askState().asked) return
  const armed = () => askState().seasons >= 2 && !askState().asked
  window.addEventListener('bap:season', e => {
    if (e.detail?.sandbox) return
    const s = askState()
    if (s.asked) return
    saveAsk({ ...s, seasons: (s.seasons ?? 0) + 1 })
  })
  window.addEventListener('bap:page', e => {
    if (e.detail?.page === 'splash' && armed()) setTimeout(askNow, 900)
  })
  if (armed()) setTimeout(() => { if (window.__bapPage?.page === 'splash') askNow() }, 4000)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
let started = false
export function initNotifications() {
  if (!IS_APP || started) return
  started = true
  // first schedule once the progress store has loaded the player's streak
  let first = false
  const firstRun = () => { if (first) return; first = true; window.removeEventListener('bap:progress', onFirst); setTimeout(scheduleAll, 1500) }
  const onFirst = () => firstRun()
  window.addEventListener('bap:progress', onFirst)
  setTimeout(firstRun, 6000)
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', () => { if (first) scheduleAll() })   // to the background and back
  }).catch(() => {})
  // a tap on a notification opens its screen
  LN().then(({ L }) => L.addListener('localNotificationActionPerformed', a => {
    const x = a?.notification?.extra || {}
    if (!x.nav || x.nav === 'home') return
    import('./deepLinks').then(m => m.goNav(x.nav, { sport: x.sport ?? null })).catch(() => {})
  })).catch(() => {})
  maybeAskNotifs()
}
