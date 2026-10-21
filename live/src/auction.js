// TRAIT AUCTION on the live server: the server is the auctioneer.
//   AuctionQueue (one per sport + position)  who's waiting; three starts it at once,
//                 two start when the countdown (restarted by every join) runs out
//   AuctionRoom   (one per auction)          picks every lot, takes the bids (each
//                 one checked against the wallets and the rules), runs the going
//                 once / going twice clock, sells, and ranks the builds at the end
// The rules are the app's own (src/lib/auctionCore.js), so the phones show exactly
// what the server enforces. Phones only send: hello, bid, pass, quit.

import {
  AUCTION_SIZE, AUCTION_MIN, AUCTION_FILL_SECS, BID_SECS, RESET_SECS, SPIN_MS, SOLD_MS, GRACE_MS,
  AUCTION_POS, auctionCoreKit, freshLedger, canBidOn, minNext, maxBid, auctionOver, pickLot, rankAuction, lotEnd,
} from '../../src/lib/auctionCore.js'
import { BaseQueue, str, send, parse, accept, key, keyOk, reject } from './queue.js'
import { competeDelta } from '../../src/lib/rating.js'
import { bookRatings } from './rating.js'

const WAIT_MS = 2400            // the room opens, then the first card is pulled
const EMPTY_MS = 90000          // everyone gone this long: the auction is called off

export const validSportPos = (sport, pos) => !!AUCTION_POS[sport]?.includes(pos)

// ── The queue ─────────────────────────────────────────────────────────────────
export class AuctionQueue extends BaseQueue {
  constructor(state, env) { super(state, env, { size: AUCTION_SIZE, min: AUCTION_MIN, fillSecs: AUCTION_FILL_SECS, room: 'AUCTION_ROOM' }) }
}

// ── The room: one auction ─────────────────────────────────────────────────────
export class AuctionRoom {
  constructor(state, env) {
    this.env = env
    this.conns = new Map()      // ws → vid
    this.m = null               // { code, seed, created, sport, pos, types, bidSecs, reset, players }
    this.st = null              // { n, stage: wait|lot|sold|done, lot, t0, last, high, passed, sold, soldAt, L }
    this.kit = null
    this.timer = null
    this.ranked = null
    this.emptySince = null
  }
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') {
      const b = await req.json()
      if (!validSportPos(b.sport, b.pos)) return new Response('bad', { status: 400 })
      this.kit = auctionCoreKit(b.sport, b.pos)
      this.m = { code: b.code, seed: `au-${b.code}`, created: Date.now(), sport: this.kit.sport, pos: this.kit.pos, types: this.kit.types, bidSecs: BID_SECS, reset: RESET_SECS, players: b.players }
      this.keys = b.keys || {}
      this.st = { n: 0, stage: 'wait', lot: null, t0: Date.now(), last: 0, high: null, passed: [], sold: null, soldAt: 0, L: freshLedger(b.players) }
      this.at(WAIT_MS, () => this.nextLot())
      return new Response('ok')
    }
    return accept(this)
  }
  at(ms, fn) { clearTimeout(this.timer); this.timer = setTimeout(fn, Math.max(0, ms)) }
  here() { return [...new Set(this.conns.values())] }
  // what a phone needs: the times as "how long ago", so its own clock lines them up
  view() {
    const s = this.st, now = Date.now()
    return {
      t: 'state', m: this.m, here: this.here(), ranked: this.ranked,
      st: { n: s.n, stage: s.stage, lot: s.lot, high: s.high, passed: s.passed, sold: s.sold, L: s.L, el: now - s.t0, sinceLast: s.last ? now - s.last : null, sinceSold: s.soldAt ? now - s.soldAt : null },
    }
  }
  broadcast() { const v = this.view(); for (const ws of this.conns.keys()) send(ws, v) }

  nextLot() {
    const { m, st, kit } = this
    if (auctionOver(st.L, m, st.n)) return this.finish()
    const lot = pickLot(m, st.L, kit, st.n + 1)
    if (!lot) return this.finish()
    Object.assign(st, { n: lot.n, stage: 'lot', lot, t0: Date.now(), last: 0, high: null, passed: [], sold: null })
    this.broadcast()
    this.at(lotEnd(st, m) - Date.now(), () => this.close())
  }
  // who could still bid on this lot (here, the slot open, money left, not already high)
  could() {
    const { m, st } = this
    const here = new Set(this.here())
    return m.players.filter(p => here.has(p.vid) && canBidOn(st.L, p.vid, m.types, st.lot.trait) && p.vid !== st.high?.vid)
  }
  maybeSettle() {
    const st = this.st
    if (st.stage !== 'lot' || Date.now() < st.t0 + SPIN_MS) return
    const could = this.could()
    // everyone who could raise has passed (or nobody can): call it now
    if (could.every(p => st.passed.includes(p.vid)) && (st.high || could.length > 0 || Date.now() > st.t0 + SPIN_MS + 1200)) this.close()
  }
  close() {
    const { m, st } = this
    if (st.stage !== 'lot') return
    // a bid that came in at the buzzer: honoured if it's inside the grace
    if (Date.now() < lotEnd(st, m) - 50 && !(this.could().every(p => st.passed.includes(p.vid)))) { this.at(lotEnd(st, m) - Date.now(), () => this.close()); return }
    const L = { ...st.L, wallets: { ...st.L.wallets }, won: { ...st.L.won }, log: [...st.L.log] }
    let sold = null
    if (st.high) {
      const { vid, amount } = st.high
      L.wallets[vid] -= amount
      L.won[vid] = { ...L.won[vid], [st.lot.trait]: { val: st.lot.val, vals: st.lot.vals, extra: st.lot.extra, name: st.lot.name, team: st.lot.team, price: amount } }
      sold = { vid, amount }
    }
    L.log = [{ n: st.n, trait: st.lot.trait, name: st.lot.name, val: st.lot.val, vid: sold?.vid ?? null, amount: sold?.amount ?? 0 }, ...L.log].slice(0, 30)
    Object.assign(st, { stage: 'sold', sold, soldAt: Date.now(), high: null, L })
    this.broadcast()
    this.at(SOLD_MS, () => this.nextLot())
  }
  finish() {
    clearTimeout(this.timer)
    this.st.stage = 'done'
    this.ranked = rankAuction(this.m, this.st.L, this.kit)
    this.broadcast()
    this.rate()
  }
  // the ratings, as a pool's: by place (an auction is real players only)
  async rate() {
    if (this.rated || !Array.isArray(this.ranked)) return
    this.rated = true
    const humans = this.m.players.length
    const uidOf = vid => this.m.players.find(p => p.vid === vid)?.uid ?? null
    const ratings = await bookRatings(this.env, this.ranked.map(p => ({ vid: p.vid, uid: p.uid ?? uidOf(p.vid), delta: competeDelta({ place: p.place, humans, forfeit: !!p.forfeit }) })))
    if (Object.keys(ratings).length) for (const ws of this.conns.keys()) send(ws, { t: 'rated', ratings })
  }
  bid(vid, n, amount) {
    const { m, st } = this
    const now = Date.now()
    if (st.stage !== 'lot' || n !== st.n || !Number.isInteger(amount)) return
    if (now < st.t0 + SPIN_MS - 300 || now > lotEnd(st, m) + GRACE_MS) return
    if (!canBidOn(st.L, vid, m.types, st.lot.trait) || st.high?.vid === vid) return
    if (amount < minNext(st.high) || amount > maxBid(st.L, vid, m.types)) return
    st.high = { vid, amount }; st.last = now
    st.passed = st.passed.filter(v => v !== vid)
    this.broadcast()
    this.at(lotEnd(st, m) - now, () => this.close())
  }
  onMessage(ws, data) {
    const msg = parse(data); if (!msg) return
    if (!this.m) { if (msg.t === 'hello') { send(ws, { t: 'gone' }); try { ws.close(1000, 'no auction') } catch {} } return }
    if (msg.t === 'hello') {
      const vid = str(msg.vid)
      if (!this.m.players.some(p => p.vid === vid)) { send(ws, { t: 'gone' }); try { ws.close(1000, 'not in this auction') } catch {} return }
      if (!keyOk(this.keys, vid, key(msg))) return reject(ws)
      for (const [w, v] of this.conns) if (v === vid && w !== ws) { this.conns.delete(w); try { w.close(1000, 'replaced') } catch {} }
      this.conns.set(ws, vid); this.emptySince = null
      return this.broadcast()
    }
    const vid = this.conns.get(ws); if (!vid) return
    const st = this.st
    if (msg.t === 'bid') return this.bid(vid, msg.n, msg.amount)
    if (msg.t === 'pass') {
      if (st.stage !== 'lot' || msg.n !== st.n || st.passed.includes(vid)) return
      st.passed = [...st.passed, vid]; this.broadcast(); return this.maybeSettle()
    }
    if (msg.t === 'quit') {
      if (st.L.out.includes(vid) || st.stage === 'done') return
      st.L = { ...st.L, out: [...st.L.out, vid] }
      if (st.high?.vid === vid) st.high = null
      this.broadcast(); this.maybeSettle()
      if (auctionOver(st.L, this.m, st.n) && st.stage !== 'lot') this.finish()
    }
  }
  onClose(ws) {
    const vid = this.conns.get(ws); this.conns.delete(ws)
    if (!vid || !this.m) return
    this.broadcast()
    this.maybeSettle()
    // everyone gone: called off after a while (a reconnect inside it carries on)
    if (!this.conns.size) {
      this.emptySince = Date.now()
      setTimeout(() => { if (!this.conns.size && this.emptySince && Date.now() - this.emptySince >= EMPTY_MS) { clearTimeout(this.timer); this.m = null } }, EMPTY_MS + 100)
    }
  }
}
