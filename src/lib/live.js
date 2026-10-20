// Live rooms: who's here (presence) + messages (broadcast) over Supabase
// Realtime, with a same-device BroadcastChannel fallback (two tabs, headless
// tests, or when Realtime can't connect). Used by Blacktop (3v3), Takeover Duo
// and the queue screens. One small API so screens never touch the transport:
//
//   const room = joinRoom('bab-blacktop-q', { vid, name, pos })
//   room.on('chat', ({ from, ...payload }) => …)      // from = sender's vid
//   room.send('chat', { text })                        // everyone, including me? no — others only
//   room.onPresence(list => …)                         // [{ vid, name, pos, … }] everyone, me included
//   room.track({ ready: true })                        // update my presence fields
//   room.onStatus(s => …)                              // 'connecting' | 'live' (Supabase) | 'local' (this device only)
//   room.leave()

import { rtSupabase, supabase } from './supabase'

const rt = rtSupabase || supabase
const FORCE_BC = () => { try { return localStorage.getItem('bap_live_bc') === '1' } catch { return false } }

export const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

let _vid = null
export function myVid() {
  if (_vid) return _vid
  try {
    _vid = sessionStorage.getItem('bap_vs_id')
    if (!_vid) {
      _vid = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('bap_vs_id', _vid)
    }
  } catch { _vid = Math.random().toString(36).slice(2) }
  return _vid
}

// The vid's secret: everyone sees a seat's vid, only this tab knows its key. The live
// server takes a seat back (a reconnect, a reload) only with the key it was taken with.
let _vkey = null
export function myVidKey() {
  if (_vkey) return _vkey
  try {
    _vkey = sessionStorage.getItem('bap_vs_key')
    if (!_vkey) {
      _vkey = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('bap_vs_key', _vkey)
    }
  } catch { _vkey = Math.random().toString(36).slice(2) }
  return _vkey
}

// This device (shared by every tab, unlike the vid): pools drop a second seat
// from the same device or the same account
export function myDevice() {
  try {
    let d = localStorage.getItem('bap_dev_id')
    if (!d) { d = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bap_dev_id', d) }
    return d
  } catch { return null }
}

// One live game per device: a tab claims it while it's in a pool, an auction or
// a Blacktop game (a heartbeat in localStorage); another tab can't join until it
// lets go or goes quiet. Stops one player filling a pool with their own tabs.
const TAB = Math.random().toString(36).slice(2) + Date.now().toString(36)   // this tab (a duplicated tab gets its own)
const LIVE_KEY = 'bap_live_tab'
let liveBeat = 0
const readLive = () => { try { return JSON.parse(localStorage.getItem(LIVE_KEY) || 'null') } catch { return null } }
export function liveElsewhere() {
  const c = readLive()
  return !!c && c.tab !== TAB && Date.now() - (c.at ?? 0) < 6000
}
export function claimLive(kind) {
  if (liveElsewhere()) return false
  const put = () => { try { localStorage.setItem(LIVE_KEY, JSON.stringify({ tab: TAB, kind, at: Date.now() })) } catch {} }
  put(); clearInterval(liveBeat); liveBeat = setInterval(put, 2000)
  return true
}
export function releaseLive() {
  clearInterval(liveBeat); liveBeat = 0
  const c = readLive()
  if (c?.tab === TAB) { try { localStorage.removeItem(LIVE_KEY) } catch {} }
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', releaseLive)

// A live game this device entered and hasn't booked yet: if the page reloads or
// the app is killed mid-game, the next load books it as a forfeit (see each mode)
const ENTERED_KEY = 'bap_live_entered'
export function markEntered(info) { try { localStorage.setItem(ENTERED_KEY, JSON.stringify({ ...info, at: Date.now() })) } catch {} }
export function clearEntered(code) { try { const e = JSON.parse(localStorage.getItem(ENTERED_KEY) || 'null'); if (!code || e?.code === code) localStorage.removeItem(ENTERED_KEY) } catch {} }
export function takeEntered(kind) {
  try {
    const e = JSON.parse(localStorage.getItem(ENTERED_KEY) || 'null')
    if (!e || e.kind !== kind) return null
    localStorage.removeItem(ENTERED_KEY)
    return Date.now() - (e.at ?? 0) < 45 * 60 * 1000 ? e : null     // stale (days old): just drop it
  } catch { return null }
}

// ── BroadcastChannel transport (same origin, same device) ────────────────────
function bcRoom(name, me) {
  const bc = new BroadcastChannel(`bap-live-${name}`)
  const handlers = {}
  const peers = new Map()           // vid → { ...fields, ts }
  const presenceFns = new Set()
  let mine = { ...me }
  let alive = true
  const list = () => [mine, ...[...peers.values()].map(({ ts, ...p }) => p)]
  const emitPresence = () => presenceFns.forEach(fn => { try { fn(list()) } catch {} })
  const beat = () => { if (alive) bc.postMessage({ k: 'hb', p: mine }) }
  bc.onmessage = e => {
    const d = e.data || {}
    if (!d.p?.vid || d.p.vid === mine.vid) return
    if (d.k === 'hb') {
      const fresh = !peers.has(d.p.vid)
      peers.set(d.p.vid, { ...d.p, ts: Date.now() })
      if (fresh) { beat(); emitPresence() } else if (d.changed) emitPresence()
    } else if (d.k === 'bye') {
      if (peers.delete(d.p.vid)) emitPresence()
    } else if (d.k === 'msg' && handlers[d.event]) {
      handlers[d.event].forEach(fn => { try { fn({ ...d.payload, from: d.p.vid }) } catch {} })   // (from last: a payload can't claim to be someone else)
    }
  }
  const hb = setInterval(() => {
    beat()
    const cut = Date.now() - 6000
    let gone = false
    for (const [vid, p] of peers) if (p.ts < cut) { peers.delete(vid); gone = true }
    if (gone) emitPresence()
  }, 1500)
  beat()
  setTimeout(emitPresence, 50)
  return {
    _bc: true,
    me: () => mine,
    onStatus(fn) { try { fn('local') } catch {}; return () => {} },
    on(event, fn) { (handlers[event] ??= []).push(fn); return this },
    send(event, payload = {}) { try { bc.postMessage({ k: 'msg', event, payload, p: mine }) } catch {}; return Promise.resolve() },
    onPresence(fn) { presenceFns.add(fn); fn(list()); return () => presenceFns.delete(fn) },
    presence: list,
    track(fields) { mine = { ...mine, ...fields }; try { bc.postMessage({ k: 'hb', p: mine, changed: true }) } catch {}; emitPresence() },
    leave() { alive = false; clearInterval(hb); try { bc.postMessage({ k: 'bye', p: mine }) } catch {}; try { bc.close() } catch {} },
  }
}

// ── Supabase Realtime transport ──────────────────────────────────────────────
// supabase-js 2.108's presence adapter rewrites the presence objects it hands to
// its join/leave events in place, and those are the same objects it keeps as
// state: each entry loses the ref a later leave needs to find it. So a player's
// update (a new lobby spot) piles on top of the old one, and someone who leaves
// never goes. Hand it copies instead. A no-op if the internals ever change.
function shieldPresence(ch) {
  try {
    const P = ch.presence?.presenceAdapter?.presence
    const { onJoin, onLeave } = P?.caller ?? {}
    if (typeof P?.onJoin !== 'function' || !onJoin || !onLeave) return
    const copy = o => (o ? JSON.parse(JSON.stringify(o)) : o)
    P.onJoin((key, cur, joined) => onJoin(key, copy(cur), copy(joined)))
    P.onLeave((key, cur, left) => onLeave(key, copy(cur), copy(left)))
  } catch {}
}

function rtRoom(name, me, onFallback) {
  const ch = rt.channel(`bap-live-${name}`, { config: { presence: { key: me.vid }, broadcast: { self: false } } })
  shieldPresence(ch)
  const handlers = {}
  const presenceFns = new Set()
  const statusFns = new Set()
  let status = 'connecting'
  const setStatus = s => { status = s; statusFns.forEach(fn => { try { fn(s) } catch {} }) }
  let mine = { ...me, _t: Date.now() }
  let fell = false, ready = false
  const queued = []
  // Sending my presence. ch.track() resolves 'ok' / 'timed out' / 'error' (it
  // doesn't throw), and a dropped one leaves everyone else on my old state: a
  // lobby spot I'm sitting in shows empty to them. So: bursts merge into one
  // send, a send that isn't 'ok' is retried, and the state goes out again every
  // 20s so anyone who missed an update catches up.
  let pushT = null, retryT = null
  const pushNow = (n = 0) => {
    clearTimeout(retryT)
    if (!ready || fell) return
    const again = () => { if (n < 6) retryT = setTimeout(() => pushNow(n + 1), 300 * (n + 1)) }
    ch.track(mine).then(r => { if (r !== 'ok') again() }, again)
  }
  const push = () => { clearTimeout(pushT); pushT = setTimeout(() => pushNow(0), 60) }
  const beat = setInterval(() => pushNow(0), 20000)
  const list = () => {
    const st = ch.presenceState()
    // one entry per player, their newest (a re-track or reconnect can briefly show two)
    const newest = new Map()
    for (const p of Object.values(st).flat()) {
      if (!p.vid || p.vid === mine.vid) continue
      const had = newest.get(p.vid)
      if (!had || (p._t ?? 0) >= (had._t ?? 0)) newest.set(p.vid, p)
    }
    return [mine, ...newest.values()]
  }
  const emitPresence = () => presenceFns.forEach(fn => { try { fn(list()) } catch {} })
  ch.on('presence', { event: 'sync' }, emitPresence)
  ch.on('presence', { event: 'join' }, emitPresence)
  ch.on('presence', { event: 'leave' }, emitPresence)
  ch.on('broadcast', { event: '*' }, ({ event, payload }) => {
    if (!handlers[event]) return
    handlers[event].forEach(fn => { try { fn(payload) } catch {} })
  })
  const room = {
    _bc: false,
    me: () => mine,
    on(event, fn) { (handlers[event] ??= []).push(fn); return this },
    send(event, payload = {}) {
      const msg = { type: 'broadcast', event, payload: { ...payload, from: mine.vid } }   // (from last: never overridden by the payload)
      if (!ready) { queued.push(msg); return Promise.resolve() }
      return ch.send(msg).catch(() => {})
    },
    onPresence(fn) { presenceFns.add(fn); fn(list()); return () => presenceFns.delete(fn) },
    presence: list,
    track(fields) { mine = { ...mine, ...fields, _t: Date.now() }; push(); emitPresence() },
    onStatus(fn) { statusFns.add(fn); try { fn(status) } catch {}; return () => statusFns.delete(fn) },
    leave() { clearTimeout(timeout); clearTimeout(pushT); clearTimeout(retryT); clearInterval(beat); try { rt.removeChannel(ch) } catch {} },
  }
  // Falling back to the same-device channel is a last resort: nobody on
  // another device can be seen there. Retry the subscription a few times first
  // and give a slow connection 20s before giving up.
  const fallBack = why => {
    if (fell) return
    fell = true; clearTimeout(timeout); clearTimeout(pushT); clearTimeout(retryT); clearInterval(beat)
    console.warn(`[live] ${name}: no live connection (${why}) — this device only`)
    try { rt.removeChannel(ch) } catch {}
    onFallback(handlers, presenceFns, statusFns, mine)
  }
  let retries = 0
  const timeout = setTimeout(() => { if (!ready) fallBack('timeout') }, 20000)
  ch.subscribe(s => {
    if (s === 'SUBSCRIBED') {
      clearTimeout(timeout); ready = true; retries = 0
      pushNow(0)
      queued.splice(0).forEach(m => ch.send(m).catch(() => {}))
      setStatus('live')
    } else if (s === 'TIMED_OUT' || s === 'CHANNEL_ERROR') {
      ready = false
      if (retries < 4) { retries++; setStatus('connecting'); setTimeout(() => { if (!fell) { try { ch.subscribe() } catch {} } }, 800 * retries) }
      else fallBack(s)
    } else if (s === 'CLOSED' && !fell) {
      setStatus('connecting')
    }
  })
  return room
}

// Joins a room. The returned object keeps working if the transport falls back
// mid-way: handlers registered on it carry over.
export function joinRoom(name, me) {
  const base = { vid: myVid(), ...me }
  if (!rt || FORCE_BC()) return bcRoom(name, base)
  let inner = null
  const facade = {
    get _bc() { return inner?._bc ?? false },
    me: () => inner.me(),
    on(event, fn) { inner.on(event, fn); return facade },
    send: (event, payload) => inner.send(event, payload),
    onPresence: fn => inner.onPresence(fn),
    onStatus: fn => inner.onStatus(fn),
    presence: () => inner.presence(),
    track: fields => inner.track(fields),
    leave: () => inner.leave(),
  }
  inner = rtRoom(name, base, (handlers, presenceFns, statusFns, mine) => {
    const bc = bcRoom(name, mine)
    for (const [event, fns] of Object.entries(handlers)) fns.forEach(fn => bc.on(event, fn))
    presenceFns.forEach(fn => bc.onPresence(fn))
    statusFns.forEach(fn => bc.onStatus(fn))
    inner = bc
  })
  return facade
}
