// Blacktop games anyone can watch: the Blacktop menu lists them under each mode
// (1v1, 2v2, 3v3). Only games between real players, once they've tipped off, and
// only ones where every seat is locked to its own phone (index.js Room.watchable);
// a practice run against CPUs is never listed. Each Room posts its game here at the
// tip-off and at every check-up (the score its players see, how many are watching),
// and takes it down when it's over or everyone in it has gone.
//
// The menu keeps a socket open here and gets the whole list whenever it changes.
// The sockets hibernate (a menu left open costs nothing while nothing happens), so
// the list lives in storage too, for when this wakes back up.

import { send, str } from './queue.js'

const STALE_MS = 2 * 60 * 1000     // a game that hasn't checked in for two minutes is gone
const PER_SIZE = 12                // the most one mode lists
const MAX_GAMES = 120

const sizeOf = v => (v === 1 || v === 2 ? v : 3)
const scoreOf = s => (Array.isArray(s) && s.length === 2 && s.every(n => Number.isInteger(n) && n >= 0 && n <= 99) ? [s[0], s[1]] : null)
const cosOf = c => (c && typeof c === 'object' ? Object.fromEntries(['avatar', 'nameColor', 'nameFx', 'plate'].filter(k => typeof c[k] === 'string').map(k => [k, c[k].slice(0, 40)])) : null)

export class Games {
  constructor(state) {
    this.state = state
    this.games = new Map()          // code → { code, size, players, score, pn, started, watchers, ts }
    state.blockConcurrencyWhile(async () => {
      const rows = await state.storage.list({ prefix: 'g:' })
      for (const g of rows.values()) if (g?.code) this.games.set(g.code, g)
    })
  }
  async fetch(req) {
    const url = new URL(req.url)
    // a Room, about its game (only ever from inside: the Worker sends the public here as sockets)
    if (url.pathname === '/update' && req.method === 'POST') {
      const b = await req.json().catch(() => null)
      if (b && typeof b.code === 'string') await this.update(b)
      return new Response('ok')
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('watch list', { status: 426 })
    const [client, server] = Object.values(new WebSocketPair())
    this.state.acceptWebSocket(server)
    await this.prune()
    send(server, this.list())
    return new Response(null, { status: 101, webSocket: client })
  }
  // the menu only listens; anything it says is ignored
  webSocketMessage() {}
  webSocketClose(ws) { try { ws.close() } catch {} }
  webSocketError(ws) { try { ws.close() } catch {} }
  async update(b) {
    const code = str(b.code, 8)
    if (b.over) {
      if (!this.games.delete(code)) return
      await this.state.storage.delete(`g:${code}`)
    } else {
      if (!this.games.has(code) && this.games.size >= MAX_GAMES) return
      const g = {
        code, size: sizeOf(b.size), started: Number(b.started) || Date.now(), score: scoreOf(b.score), pn: Math.max(0, b.pn | 0),
        watchers: Math.max(0, b.watchers | 0), ts: Date.now(),
        players: (Array.isArray(b.players) ? b.players : []).slice(0, 6).map(p => ({
          name: str(p?.name, 24) || 'Guest', uid: str(p?.uid, 64) || null, cos: cosOf(p?.cos),
          team: p?.team === 1 ? 1 : 0, pos: p?.pos === 'big' ? 'big' : 'guard', cpu: !!p?.cpu,
        })),
      }
      this.games.set(code, g)
      await this.state.storage.put(`g:${code}`, g)
    }
    await this.prune()
    this.broadcast()
  }
  async prune() {
    const now = Date.now()
    const old = [...this.games.values()].filter(g => now - g.ts > STALE_MS).map(g => g.code)
    if (!old.length) return
    for (const code of old) this.games.delete(code)
    await this.state.storage.delete(old.map(code => `g:${code}`))
  }
  // newest first in each mode; ts (the last check-in) lets the menu drop one that goes quiet
  list() {
    const all = [...this.games.values()].sort((a, b) => b.started - a.started)
    const games = [1, 2, 3].flatMap(size => all.filter(g => g.size === size).slice(0, PER_SIZE))
    return { t: 'games', now: Date.now(), games }
  }
  broadcast() {
    const msg = this.list()
    for (const ws of this.state.getWebSockets()) send(ws, msg)
  }
}
