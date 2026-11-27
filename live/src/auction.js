// TRAIT AUCTION on the live server: the server is the auctioneer.
//   AuctionQueue (one per sport + position)  who's waiting; three start it at once,
//                 two start when the countdown (restarted by every join) runs out,
//                 or when one of them asks
//   AuctionRoom   (one per auction)          picks every lot, takes the bids (each
//                 one checked against the wallets and the rules), runs the going
//                 once / going twice clock (called at once when nobody left can
//                 bid), sells, puts unsold cards back in the deck face up, deals the
//                 draw when somebody fills his build first, and ranks the builds
// Football, basketball and soccer (the striker, its kit from src/lib/soccerAuction.js).
// The rules are the app's own (src/lib/auctionCore.js), so the phones show exactly
// what the server enforces. Phones only send: hello, bid, pass, quit.

import {
  AUCTION_SIZE, AUCTION_MIN, AUCTION_FILL_SECS, BID_SECS, RESET_SECS, SOLD_MS, DRAW_MS, DRAW_STEP_MS, GRACE_MS,
  AUCTION_POS, AUCTION_ANY, auctionPosFor, auctionCoreKit, freshLedger, canTop, minNext, maxBid, auctionOver, pickLot, takeLot, returnLot,
  finishedEarly, markCloser, stillBuilding, drawFor, applyDraw, rankAuction, lotEnd, spinOf,
} from '../../src/lib/auctionCore.js'
import '../../src/lib/soccerAuction.js'
import '../../src/lib/collegeAuction.js'   // college football and basketball's kits ('cfb', 'cbb')   // soccer's kit (the striker): added to the rules above
import { BaseQueue, str, send, parse, accept, key, keyOk, reject } from './queue.js'
import { competeDelta } from '../../src/lib/rating.js'
import { bookRatings } from './rating.js'

const WAIT_MS = 2400            // the room opens, then the first card is pulled
const EMPTY_MS = 90000          // everyone gone this long: the auction is called off

// one queue a sport ('any': the room draws the position from its seed), or a position's own queue (a phone from before)
export const validSportPos = (sport, pos) => !!AUCTION_POS[sport] && (pos === AUCTION_ANY || AUCTION_POS[sport].includes(pos))

// ── The queue ─────────────────────────────────────────────────────────────────
export class AuctionQueue extends BaseQueue {
  constructor(state, env) { super(state, env, { size: AUCTION_SIZE, min: AUCTION_MIN, fillSecs: AUCTION_FILL_SECS, room: 'AUCTION_ROOM', kind: 'au' }) }
}

// ── The room: one auction ─────────────────────────────────────────────────────
export class AuctionRoom {
  constructor(state, env) {
    this.env = env
    this.conns = new Map()      // ws → vid
    this.m = null               // { code, seed, created, sport, pos, types, bidSecs, reset, players }
    this.st = null              // { n, stage: wait|lot|sold|draw|done, lot, t0, last, high, passed, sold, soldAt, draw, L }
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
      const players = (Array.isArray(b.players) ? b.players : []).slice(0, AUCTION_SIZE)
      if (players.length < AUCTION_MIN) return new Response('bad', { status: 400 })
      const seed = `au-${b.code}`
      // the sport's queue: the position is drawn from the room's seed, the same for every seat (lib/auctionCore posOk)
      const anyPos = b.pos === AUCTION_ANY
      this.kit = auctionCoreKit(b.sport, anyPos ? auctionPosFor(b.sport, seed) : b.pos)
      this.m = { code: b.code, seed, created: Date.now(), sport: this.kit.sport, pos: this.kit.pos, ...(anyPos ? { anyPos: true } : {}), types: this.kit.types, bidSecs: BID_SECS, reset: RESET_SECS, players }
      this.keys = b.keys || {}
      this.st = { n: 0, stage: 'wait', lot: null, t0: Date.now(), last: 0, high: null, passed: [], sold: null, soldAt: 0, draw: null, L: freshLedger(players) }
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
    // a new card's grade stays with the server while it's being bid on (the phones show it
    // face down, so a look at the page or the connection can't give it away). Sold or not,
    // it turns over at the gavel; a card back from the deck was already turned over
    const lot = s.lot && s.stage === 'lot' && !s.lot.known ? { ...s.lot, val: undefined, vals: undefined, extra: undefined } : s.lot
    return {
      t: 'state', m: this.m, here: this.here(), ranked: this.ranked,
      st: { n: s.n, stage: s.stage, lot, high: s.high, passed: s.passed, sold: s.sold, draw: s.draw, L: s.L, el: now - s.t0, sinceLast: s.last ? now - s.last : null, sinceSold: s.soldAt ? now - s.soldAt : null },
    }
  }
  broadcast() { const v = this.view(); for (const ws of this.conns.keys()) send(ws, v) }

  nextLot() {
    const { m, st, kit } = this
    if (auctionOver(st.L, m, st.n)) return this.finish()
    const lot = pickLot(m, st.L, kit, st.n + 1)
    if (!lot) return this.finish()
    Object.assign(st, { n: lot.n, stage: 'lot', lot, t0: Date.now(), last: 0, high: null, passed: [], sold: null, L: takeLot(st.L, lot) })
    this.broadcast()
    this.arm()
  }
  // the clock: at the end of the spin (somebody may already be the only one who could
  // bid, or nobody), then when the hammer falls
  arm() {
    const { m, st } = this
    if (st.stage !== 'lot') return
    const open = st.t0 + spinOf(st.lot)
    if (Date.now() < open) this.at(open - Date.now(), () => { this.maybeSettle(); this.arm() })
    else this.at(lotEnd(st, m) - Date.now(), () => this.close())
  }
  // who could still bid on this lot: here, the slot open, the money to top the high
  // bid, not already high and not out on it
  could() {
    const { m, st } = this
    const here = new Set(this.here())
    return m.players.filter(p => here.has(p.vid) && canTop(st.L, p.vid, m.types, st.lot.trait, st.high) && !st.passed.includes(p.vid))
  }
  // nobody left who can bid: the clock doesn't run down for nothing, it's called now
  maybeSettle() {
    const st = this.st
    if (st.stage !== 'lot' || Date.now() < st.t0 + spinOf(st.lot)) return
    if (this.could().length === 0) this.close()
  }
  close() {
    const { m, st, kit } = this
    if (st.stage !== 'lot') return
    // a bid that came in at the buzzer: honoured if it's inside the grace
    if (Date.now() < lotEnd(st, m) - 50 && this.could().length > 0) { this.arm(); return }
    let L = { ...st.L, wallets: { ...st.L.wallets }, won: { ...st.L.won }, log: [...st.L.log] }
    let sold = null
    if (st.high) {
      const { vid, amount } = st.high
      L.wallets[vid] -= amount
      L.won[vid] = { ...L.won[vid], [st.lot.trait]: { val: st.lot.val, vals: st.lot.vals, extra: st.lot.extra, name: st.lot.name, team: st.lot.team, price: amount } }
      sold = { vid, amount }
    } else L = returnLot(L, st.lot, m)
    if (sold) L = markCloser(L, m, sold.vid)
    L.log = [{ n: st.n, trait: st.lot.trait, name: st.lot.name, val: st.lot.val, vid: sold?.vid ?? null, amount: sold?.amount ?? 0 }, ...L.log].slice(0, 30)
    Object.assign(st, { stage: 'sold', sold, soldAt: Date.now(), high: null, L })
    this.broadcast()
    // he's filled his build: the rest of the room's open slots go to the draw
    if (sold && finishedEarly(L, m, sold.vid)) return this.at(SOLD_MS, () => this.draw(sold.vid))
    this.at(SOLD_MS, () => this.nextLot())
  }
  // the draw: every other bidder's open slots, one random card each (seeded: lib/auctionCore drawFor)
  draw(by) {
    const { m, st, kit } = this
    if (st.stage === 'done' || st.stage === 'draw') return
    const cards = drawFor(m, st.L, kit)
    const count = Object.values(cards).reduce((n, c) => n + Object.keys(c).length, 0)
    Object.assign(st, { stage: 'draw', draw: { by, cards }, t0: Date.now(), L: applyDraw(st.L, cards, by) })
    this.broadcast()
    this.at(DRAW_MS + count * DRAW_STEP_MS, () => this.finish())
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
    if (now < st.t0 + spinOf(st.lot) - 300 || now > lotEnd(st, m) + GRACE_MS) return
    if (!canTop(st.L, vid, m.types, st.lot.trait, st.high)) return
    if (amount < minNext(st.high) || amount > maxBid(st.L, vid, m.types)) return
    st.high = { vid, amount }; st.last = now
    st.passed = st.passed.filter(v => v !== vid)
    this.broadcast()
    // nobody left who can top it: sold now, no clock to sit through
    if (now >= st.t0 + spinOf(st.lot) && this.could().length === 0) return this.close()
    this.arm()
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
      // the last bidder left in the room: the auction's his, now (owner 11-27: an auto win). The ones who quit are
      // forfeits, ranked under him whatever their builds
      if (this.m.players.filter(p => !st.L.out.includes(p.vid)).length <= 1) return this.finish()
      // one left building and someone done: he's bidding against nobody, so his open slots go to the draw
      if (st.L.closer && stillBuilding(st.L, this.m).length === 1 && (st.stage === 'lot' || st.stage === 'sold')) {
        st.high = null; this.broadcast(); return this.at(300, () => this.draw(st.L.closer))
      }
      this.broadcast(); this.maybeSettle()
      if (st.stage === 'draw') return
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
