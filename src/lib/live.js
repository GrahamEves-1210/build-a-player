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
      handlers[d.event].forEach(fn => { try { fn({ from: d.p.vid, ...d.payload }) } catch {} })
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
function rtRoom(name, me, onFallback) {
  const ch = rt.channel(`bap-live-${name}`, { config: { presence: { key: me.vid }, broadcast: { self: false } } })
  const handlers = {}
  const presenceFns = new Set()
  const statusFns = new Set()
  let status = 'connecting'
  const setStatus = s => { status = s; statusFns.forEach(fn => { try { fn(s) } catch {} }) }
  let mine = { ...me }
  let fell = false, ready = false
  const queued = []
  const list = () => {
    const st = ch.presenceState()
    const others = Object.values(st).flat().filter(p => p.vid && p.vid !== mine.vid)
    // one entry per vid (a reconnect can briefly show two)
    const seen = new Set()
    return [mine, ...others.filter(p => (seen.has(p.vid) ? false : (seen.add(p.vid), true)))]
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
      const msg = { type: 'broadcast', event, payload: { from: mine.vid, ...payload } }
      if (!ready) { queued.push(msg); return Promise.resolve() }
      return ch.send(msg).catch(() => {})
    },
    onPresence(fn) { presenceFns.add(fn); fn(list()); return () => presenceFns.delete(fn) },
    presence: list,
    track(fields) { mine = { ...mine, ...fields }; if (ready) ch.track(mine).catch(() => {}); emitPresence() },
    onStatus(fn) { statusFns.add(fn); try { fn(status) } catch {}; return () => statusFns.delete(fn) },
    leave() { clearTimeout(timeout); try { rt.removeChannel(ch) } catch {} },
  }
  // Falling back to the same-device channel is a last resort: nobody on
  // another device can be seen there. Retry the subscription a few times first
  // and give a slow connection 20s before giving up.
  const fallBack = why => {
    if (fell) return
    fell = true; clearTimeout(timeout)
    console.warn(`[live] ${name}: no live connection (${why}) — this device only`)
    try { rt.removeChannel(ch) } catch {}
    onFallback(handlers, presenceFns, statusFns, mine)
  }
  let retries = 0
  const timeout = setTimeout(() => { if (!ready) fallBack('timeout') }, 20000)
  ch.subscribe(s => {
    if (s === 'SUBSCRIBED') {
      clearTimeout(timeout); ready = true; retries = 0
      ch.track(mine).catch(() => {})
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
