// COMPETE pools on the live server. Everyone in a pool gets the same spins (the
// seed, from here) and builds on their own phone; the build goes to the server,
// which scores it itself from the real ratings (src/lib/competeCore.js scoreBuild:
// only WHICH player filled each slot is taken from the phone), runs the clock and
// ranks the pool.
//   CompeteQueue (one per sport + position)   up to five, two start on the countdown
//   CompeteRoom  (one per pool)               the clock, the builds, the result

import { POOL_SIZE, MIN_POOL, FILL_AFTER_SECS, BUILD_SECS, COMPETE_POS, scoreBuild } from '../../src/lib/competeCore.js'
import { BaseQueue, str, send, parse, accept, key, keyOk, reject } from './queue.js'

const GRACE_MS = 3000           // a build sent just as the clock hits zero still counts
const EMPTY_MS = 90000          // everyone gone this long: the pool is closed

export const validCompete = (sport, pos) => !!COMPETE_POS[sport]?.includes(pos)

export class CompeteQueue extends BaseQueue {
  constructor(state, env) { super(state, env, { size: POOL_SIZE, min: MIN_POOL, fillSecs: FILL_AFTER_SECS, room: 'COMPETE_ROOM' }) }
}

export class CompeteRoom {
  constructor(state, env) {
    this.env = env
    this.conns = new Map()      // ws → vid
    this.m = null               // { code, seed, created, sport, pos, players }
    this.results = {}           // vid → { ovr, at, build, forfeit }
    this.phase = 'build'        // build | result
    this.timer = null
    this.emptySince = null
  }
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') {
      const b = await req.json()
      if (!validCompete(b.sport, b.pos)) return new Response('bad', { status: 400 })
      this.m = { code: b.code, seed: `cp-${b.code}`, created: Date.now(), sport: b.sport, pos: b.pos, players: b.players.map(p => ({ ...p, bot: false })) }
      this.keys = b.keys || {}
      this.results = {}; this.phase = 'build'
      this.timer = setTimeout(() => this.finish(), BUILD_SECS * 1000 + GRACE_MS)
      return new Response('ok')
    }
    return accept(this)
  }
  here() { return [...new Set(this.conns.values())] }
  view() {
    const m = this.m
    return { t: 'state', m: { ...m, sinceCreated: Date.now() - m.created }, results: this.results, phase: this.phase, here: this.here() }
  }
  broadcast() { const v = this.view(); for (const ws of this.conns.keys()) send(ws, v) }
  maybeDone() { if (this.phase === 'build' && this.m.players.every(p => this.results[p.vid])) this.finish() }
  // the clock's out (or everyone's in): anyone without a build forfeits
  finish() {
    if (this.phase !== 'build') return
    clearTimeout(this.timer)
    for (const p of this.m.players) if (!this.results[p.vid]) this.results[p.vid] = { ovr: -1, at: Date.now(), forfeit: true }
    this.phase = 'result'
    this.broadcast()
  }
  onMessage(ws, data) {
    const msg = parse(data); if (!msg) return
    if (!this.m) { if (msg.t === 'hello') { send(ws, { t: 'gone' }); try { ws.close(1000, 'no pool') } catch {} } return }
    if (msg.t === 'hello') {
      const vid = str(msg.vid)
      if (!this.m.players.some(p => p.vid === vid)) { send(ws, { t: 'gone' }); try { ws.close(1000, 'not in this pool') } catch {} return }
      if (!keyOk(this.keys, vid, key(msg))) return reject(ws)
      for (const [w, v] of this.conns) if (v === vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, vid); this.emptySince = null
      return this.broadcast()
    }
    const vid = this.conns.get(ws); if (!vid || this.phase !== 'build') return
    if (msg.t === 'submit') {
      // the first build in stands; one after the clock (and its grace) doesn't count
      if (this.results[vid] || Date.now() > this.m.created + BUILD_SECS * 1000 + GRACE_MS) return
      // only the players this pool's spins could have dealt count (the seed is the pool's)
      const { ovr, build } = scoreBuild(this.m.sport, this.m.pos, msg.build, this.m.seed, vid)
      this.results[vid] = { ovr, at: Date.now(), build }
      this.broadcast()
      return this.maybeDone()
    }
    if (msg.t === 'quit') {
      if (this.results[vid]) return
      this.results[vid] = { ovr: -1, at: Date.now(), forfeit: true }
      this.broadcast()
      return this.maybeDone()
    }
  }
  onClose(ws) {
    const vid = this.conns.get(ws); this.conns.delete(ws)
    if (!vid || !this.m) return
    this.broadcast()
    if (!this.conns.size) {
      this.emptySince = Date.now()
      setTimeout(() => { if (!this.conns.size && this.emptySince && Date.now() - this.emptySince >= EMPTY_MS && this.phase === 'result') this.m = null }, EMPTY_MS + 100)
    }
  }
}
