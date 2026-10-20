// A queue for a live mode (live/src/auction.js, live/src/compete.js): who's waiting,
// oldest first. Full starts it at once; two or more start when the countdown
// (back to the full count with every join) runs out, or when anyone asks.

export const code6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 32]).join('')
export const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '')
export const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)) } catch {} }
export const parse = data => { try { const m = JSON.parse(data); return m && typeof m === 'object' ? m : null } catch { return null } }
export const pub = h => ({ vid: str(h.vid), name: str(h.name, 24) || 'Guest', uid: str(h.uid, 64) || null, cos: h.cos && typeof h.cos === 'object' ? h.cos : null })
// A seat's key: a secret only the device holding the seat knows (src/lib/blacktopServer.js
// liveSocket sends it with every hello). Seat ids (vids) are shown to everyone, so without it
// anyone could say hello as you, push you out of your seat and quit for you. A seat taken
// without a key (an older app) has none to check.
export const key = m => str(m?.key, 64) || null
export const keyOk = (keys, vid, k) => !keys?.[vid] || keys[vid] === k
export const reject = (ws, why = 'seat') => { send(ws, { t: 'taken', why }); try { ws.close(1000, 'seat taken') } catch {} }
export const accept = (self) => {
  const [client, server] = Object.values(new WebSocketPair())
  server.accept()
  server.addEventListener('message', e => self.onMessage(server, e.data))
  const bye = () => self.onClose(server)
  server.addEventListener('close', bye); server.addEventListener('error', bye)
  return new Response(null, { status: 101, webSocket: client })
}
// one seat a device (and one an account): a second tab or an alt on the same phone can't
// fill a pool to farm it (src/lib/live.js liveElsewhere does the same on the device)
export const ONE_PER_DEVICE = true

// cfg: { size, min, fillSecs, room: env binding name of the room class }
export class BaseQueue {
  constructor(state, env, cfg) {
    this.env = env; this.cfg = cfg
    this.conns = new Map()      // ws → { ...pub, dev, ts }
    this.sport = null; this.pos = null
    this.timer = null; this.startsAt = null
  }
  async fetch(req) {
    const url = new URL(req.url)
    this.sport ??= url.searchParams.get('sport'); this.pos ??= url.searchParams.get('pos')
    return accept(this)
  }
  waiting() {
    const seen = new Set()
    return [...this.conns.values()].sort((a, b) => a.ts - b.ts).filter(p => {
      const keys = [p.uid && `u:${p.uid}`, ONE_PER_DEVICE && p.dev && `d:${p.dev}`].filter(Boolean)
      if (keys.some(k => seen.has(k))) return false
      keys.forEach(k => seen.add(k)); return true
    })
  }
  state() { return { t: 'queue', list: this.waiting().map(pub), startsIn: this.startsAt ? Math.max(0, this.startsAt - Date.now()) : null, size: this.cfg.size } }
  broadcast() { const s = this.state(); for (const ws of this.conns.keys()) send(ws, s) }
  rearm(joined) {
    const n = this.waiting().length
    if (n < this.cfg.min) { clearTimeout(this.timer); this.timer = null; this.startsAt = null; return }
    if (joined || !this.timer) {
      clearTimeout(this.timer)
      this.startsAt = Date.now() + this.cfg.fillSecs * 1000
      this.timer = setTimeout(() => this.makeMatch(), this.cfg.fillSecs * 1000)
    }
  }
  async onMessage(ws, data) {
    const m = parse(data); if (!m) return
    if (m.t === 'hello') {
      const p = { ...pub(m), dev: str(m.dev, 64), key: key(m), ts: Date.now() }
      if (!p.vid) return
      // a reconnect replaces the old connection, but only with the same key
      for (const [w, q] of this.conns) if (q.vid === p.vid && w !== ws && q.key && q.key !== p.key) return reject(ws)
      for (const [w, q] of this.conns) if (q.vid === p.vid && w !== ws) { p.ts = q.ts; this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, p)
      if (this.waiting().length >= this.cfg.size) return this.makeMatch()
      this.rearm(true); this.broadcast()
      return
    }
    if (m.t === 'fill' && this.conns.has(ws) && this.waiting().length >= this.cfg.min) return this.makeMatch()
  }
  async makeMatch() {
    clearTimeout(this.timer); this.timer = null; this.startsAt = null
    const list = this.waiting().slice(0, this.cfg.size)
    if (list.length < this.cfg.min) return this.broadcast()
    const code = code6()
    const players = list.map(pub)
    const keys = Object.fromEntries(list.map(p => [p.vid, p.key || null]))
    const ns = this.env[this.cfg.room]
    await ns.get(ns.idFromName(code)).fetch('https://live/init', { method: 'POST', body: JSON.stringify({ code, sport: this.sport, pos: this.pos, players, keys }) })
    const vids = new Set(players.map(p => p.vid))
    for (const [ws, p] of this.conns) if (vids.has(p.vid)) { send(ws, { t: 'match', code, players }); this.conns.delete(ws); try { ws.close(1000, 'matched') } catch {} }
    this.rearm(false); this.broadcast()
  }
  onClose(ws) {
    if (!this.conns.delete(ws)) return
    this.rearm(false); this.broadcast()
  }
}
