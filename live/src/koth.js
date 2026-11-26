// BLACKTOP · KING OF THE HILL online: the queue (one, shared). Three people, every man for himself, on Blacktop Live
// (the real-time game: src/lib/btlive). Each one comes in with the real player he picked (the Blacktop Live practice
// list); his build is that player's own ratings, read here from the rosters, never what a phone says. Like the 1v1
// and 2v2 lobbies it's real players only, no CPUs filling in: it starts the moment the third man is in. The game is
// played in a BtLiveRoom (btlive.js), the referee, which books the result (rating, the record) when it's over.
//
//   /btlive/koth   (a WebSocket)  hello { vid, key, token, dev, pick: { name, pos } }
//                                 → queue { list: [{ vid, name, uid, cos, pick }], size: 3 }  → match { code, players }
import { BaseQueue, accept, pub, str, send, countPoster, code6, key, reject } from './queue.js'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards.js'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs.js'
import { geoOf, hintFor } from './place.js'

export const KOTH_SEATS = 3
// what a man is called in the game: his account's username, or (no account) Guest and his place in the queue, so three
// guests read Guest 1, Guest 2, Guest 3 in the queue, on the scoreboard and on the final (the queue's order is the
// seat order, so his number stays the same from the queue to the final)
const named = (p, i) => ({ ...pub(p), name: p.uid ? pub(p).name : `Guest ${i + 1}` })
// a pick: a real player at his position, by name (the rosters say who's real); anything else is turned away
export function kothPick(p) {
  const pos = p?.pos === 'big' ? 'big' : 'guard'
  const name = str(p?.name, 60)
  const real = (pos === 'big' ? NBA_BIG_PLAYERS : NBA_GUARD_PLAYERS).find(x => x.name === name)
  return real ? { name: real.name, pos } : null
}

export class KothQueue extends BaseQueue {
  constructor(state, env) {
    // (min = size: never fewer than three; fillSecs only matters below the full count, so it never runs)
    super(state, env, { size: KOTH_SEATS, min: KOTH_SEATS, fillSecs: 3600, room: 'BTLIVE_ROOM' })
    this.picks = new Map()      // vid → his pick (set before the hello is taken, so the third man's hello can start it)
    this.busy = new Set()       // vids being put in a room right now (the room's /init is out): in nobody else's match
  }
  async fetch(req) {
    // the menu's "2 SEARCHING" (games.js): bt:koth, next to the lobbies' bt:1 and bt:2
    this.count ??= countPoster(this.env, 'bt:koth')
    // (where his line came in from, index.js withGeo: the room is made near the three of them, place.js)
    return accept(this, req ? geoOf(req) : null)
  }
  waiting() { return super.waiting().filter(p => !this.busy.has(p.vid)) }
  // who's waiting, with the player each one picked (everyone sees the picks: nothing is hidden in this game)
  state() {
    const list = this.waiting().map((p, i) => ({ ...named(p, i), pick: this.picks.get(p.vid) ?? null }))
    return { t: 'queue', list, startsIn: null, size: KOTH_SEATS }
  }
  async onMessage(ws, data) {
    let m; try { m = JSON.parse(data) } catch { return }
    if (m?.t === 'hello') {
      const pick = kothPick(m.pick)
      if (!pick) { send(ws, { t: 'bad', why: 'pick' }); try { ws.close(1000, 'bad pick') } catch {} return }
      const vid = str(m.vid)
      if (!vid) return
      // (a hello for someone else's seat, without his key, never touches his pick)
      if ([...this.conns.values()].some(q => q.vid === vid && q.key && q.key !== key(m))) return reject(ws)
      this.picks.set(vid, pick)
      return super.onMessage(ws, data)
    }
    // (nothing else does anything here: no early start, it's always three)
  }
  onClose(ws) {
    const p = this.conns.get(ws)
    super.onClose(ws)
    if (p && ![...this.conns.values()].some(q => q.vid === p.vid)) this.picks.delete(p.vid)
  }
  // three in: the room (the referee) gets the seats, the keys and the picks, then each one is sent there
  async makeMatch() {
    const list = this.waiting().slice(0, KOTH_SEATS)
    if (list.length < KOTH_SEATS || list.some(p => !this.picks.get(p.vid))) return this.broadcast()
    const code = code6()
    const players = list.map((p, i) => ({ ...named(p, i), pick: this.picks.get(p.vid) }))
    const keys = Object.fromEntries(list.map(p => [p.vid, p.key || null]))
    const vids = new Set(players.map(p => p.vid))
    // the room, made near them: the hint counts only now, as /init makes it (place.js). While it's out, these three
    // are in no other match (a fourth man's hello can't start a second room with them) and the queue goes on
    const geos = players.map(p => [...this.conns].find(([, q]) => q.vid === p.vid)?.[0]?.geo ?? null)
    const hint = hintFor(geos)
    const ns = this.env.BTLIVE_ROOM
    for (const v of vids) this.busy.add(v)
    let made = false
    try {
      const r = await ns.get(ns.idFromName(code), hint ? { locationHint: hint } : undefined).fetch('https://btlive/init', { method: 'POST', body: JSON.stringify({ code, mode: 'koth', players, keys, hint }) })
      made = !!r?.ok
    } catch {}
    for (const v of vids) this.busy.delete(v)
    // (the room couldn't be made: they wait on, and it tries again in a second)
    if (!made) { this.retry ??= setTimeout(() => { this.retry = null; this.makeMatch() }, 1000); return this.broadcast() }
    for (const [w, p] of this.conns) if (vids.has(p.vid)) { send(w, { t: 'match', code, players }); this.conns.delete(w); try { w.close(1000, 'matched') } catch {} }
    for (const v of vids) this.picks.delete(v)
    this.broadcast()
  }
}
