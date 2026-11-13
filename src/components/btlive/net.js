// BLACKTOP LIVE online, the device's line to the referee (live/src/btlive.js): a WebSocket, with a lag harness for
// testing (it holds every message 150-400 ms each way, with jitter, and drops some), pings for the round trip, and
// the snapshots handed to the engine as they arrive. DEV only: nothing reaches a real game or queue.
//   ?btserver=ws://localhost:8787   the referee (wrangler dev); never the deployed worker from here
//   &btroom=TEST01                  the room code
//   &btlag=150-400&btjit=60&btdrop=0.05   the harness (one way, each direction)
export function openNet({ server, room, hello, lag = null, onMsg, onState }) {
  const L = lag || { lo: 0, hi: 0, jit: 0, drop: 0 }
  const delay = () => (L.hi > 0 ? L.lo + Math.random() * (L.hi - L.lo) + (Math.random() - 0.5) * 2 * L.jit : 0)
  let ws = null, dead = false, tries = 0, timer = 0, hold = 0, heard = 0
  const stats = { sent: 0, got: 0, dropped: 0, rtt: 0, open: false }
  const net = { stats, send, close, hello }
  // a message only gets dropped if it can be: inputs and snapshots carry everything since the last one; a hello can't
  const droppable = t => t === 'in' || t === 's'
  function connect() {
    if (dead) return
    const me = ws = new WebSocket(`${server.replace(/\/$/, '')}/btlive/room/${room}`)
    me.onopen = () => { if (ws !== me) return; tries = 0; heard = performance.now(); stats.open = true; onState?.('open'); raw({ t: 'hello', ...net.hello }) }
    me.onmessage = e => {
      if (ws !== me) return
      heard = performance.now()
      let m; try { m = JSON.parse(e.data) } catch { return }
      if (droppable(m.t) && L.drop && Math.random() < L.drop) { stats.dropped++; return }
      const d = delay()
      if (d > 0) setTimeout(() => { if (!dead) { stats.got++; onMsg(m) } }, d); else { stats.got++; onMsg(m) }
    }
    me.onclose = () => { if (ws === me) lost() }
    me.onerror = () => {}
  }
  // the line is gone (closed, or silent): drop this socket without waiting for its goodbye, and dial again
  function lost() {
    const old = ws; ws = null
    if (old) { old.onopen = old.onmessage = old.onclose = null; try { old.close() } catch {} }
    stats.open = false; onState?.('closed')
    clearTimeout(timer)
    if (!dead) { timer = setTimeout(connect, hold || Math.min(4000, 400 * 2 ** tries++)); hold = 0 }
  }
  function raw(m) { try { if (ws?.readyState === 1) { ws.send(JSON.stringify(m)); stats.sent++ } } catch {} }
  function send(m) {
    if (droppable(m.t) && L.drop && Math.random() < L.drop) { stats.dropped++; return }
    const d = delay()
    if (d > 0) setTimeout(() => raw(m), d); else raw(m)
  }
  function close() { dead = true; clearTimeout(timer); const old = ws; ws = null; if (old) { old.onclose = null; try { old.close(1000, 'bye') } catch {} } }
  // the round trip, every 2 s (the referee answers at once)
  // ...and a socket that has said nothing for 3 s is taken for dead (a phone's line can die without closing)
  const ping = setInterval(() => { send({ t: 'ping', c: performance.now() }); if (ws && stats.open && performance.now() - heard > 3000) lost() }, 1000)
  const stop = net.close
  net.close = () => { clearInterval(ping); stop() }
  net.pong = m => { stats.rtt = Math.round(performance.now() - m.c) }
  // DEV: the line goes down (as a phone losing signal would) and comes back after ms
  net.drop = (ms = 0) => { hold = ms; lost() }
  connect()
  return net
}

// the harness and the server from the address (dev server only)
export function netFromUrl(q) {
  if (!import.meta.env.DEV) return null
  const server = q.get('btserver'), room = (q.get('btroom') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  if (!server || !/^wss?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/.test(server) || room.length !== 6) return null
  const [lo, hi] = (q.get('btlag') || '0-0').split('-').map(Number)
  return { server, room, lag: { lo: lo || 0, hi: hi || lo || 0, jit: Number(q.get('btjit')) || 0, drop: Math.min(0.5, Number(q.get('btdrop')) || 0) } }
}
