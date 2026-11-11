// Runs inside the page, injected before any of the site's code by rail-audit.mjs (then rail-sim.js, then helpers.js).
// Nothing leaves the machine that could write anywhere: analytics and every non-GET request to another host are
// answered locally, and sockets to other hosts never open (no presence, no queue, no room). And the site's clock can
// be run fast.
(() => {
  if (window.__RA || window.top !== window) return   // (never inside a frame: the simulated ad is one)
  const RA = (window.__RA = {})
  // the site's clock can run fast (window.__RA_SPEED, set by the runner), so a season's live games and timed reveals
  // don't take the audit minutes each. The audit's own waits use the real timers
  const realTimeout = window.setTimeout.bind(window), realRaf = window.requestAnimationFrame.bind(window)
  const SPEED = +window.__RA_SPEED || 1
  if (SPEED > 1) {
    const realInterval = window.setInterval.bind(window), now = performance.now.bind(performance), t0 = now()
    window.setTimeout = (f, d, ...a) => realTimeout(f, d > 30 ? d / SPEED : d, ...a)
    window.setInterval = (f, d, ...a) => realInterval(f, d > 30 ? d / SPEED : d, ...a)
    performance.now = () => t0 + (now() - t0) * SPEED
    window.requestAnimationFrame = cb => realRaf(t => cb(t0 + (t - t0) * SPEED))
  }
  const isLocal = u => { try { const h = new URL(String(u?.url ?? u), location.href).hostname; return h === location.hostname || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' } catch { return true } }

  // ── 1. no writes, no sockets ────────────────────────────────────────────────
  const realFetch = window.fetch
  window.fetch = (u, o) => {
    const url = String(u?.url ?? u), method = String(o?.method ?? u?.method ?? 'GET').toUpperCase()
    if (url.includes('analytics_events')) return Promise.resolve(new Response('[]', { status: 201 }))
    if (!isLocal(url) && method !== 'GET' && method !== 'HEAD') return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }))
    return realFetch(u, o)
  }
  try { navigator.sendBeacon = () => true } catch {}
  const RealWS = window.WebSocket
  class DeadSocket extends EventTarget {
    constructor(url) {
      super(); this.url = String(url); this.readyState = 0; this.bufferedAmount = 0; this.binaryType = 'blob'; this.protocol = ''; this.extensions = ''
      realTimeout(() => { this.readyState = 3; for (const e of [new Event('error'), new CloseEvent('close', { code: 1006 })]) { try { this['on' + e.type]?.(e) } catch {} this.dispatchEvent(e) } }, 60)
    }
    send() {} close() { this.readyState = 3 }
  }
  function AuditWebSocket(url, protocols) { return isLocal(url) ? new RealWS(url, protocols) : new DeadSocket(url) }
  for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) AuditWebSocket[k] = RealWS[k]
  AuditWebSocket.prototype = RealWS.prototype
  window.WebSocket = AuditWebSocket
  RA.errors = []
  window.addEventListener('error', e => RA.errors.push(String(e.message).slice(0, 200)))
  RA.realTimeout = realTimeout; RA.realRaf = realRaf; RA.isLocal = isLocal
})()
