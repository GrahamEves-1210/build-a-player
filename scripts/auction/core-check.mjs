// Trait Auction rules check (lib/auctionCore.js), no server: plays seeded auctions for every sport and
// position with 2 and 3 bidders through the same helpers the live worker uses, and checks the rules hold.
//   bash scripts/auction/run.sh
import {
  AUCTION_POS, auctionCoreKit, freshLedger, pickLot, takeLot, returnLot, finishedEarly, drawFor, applyDraw,
  rankAuction, ledgerOk, canTop, maxBid, minNext, openSlots, auctionOver, BUDGET,
  auctionPosFor, posOk, drawCard, setGradeTilt, GRADE_TILT,
} from '../../src/lib/auctionCore.js'
import '../../src/lib/soccerAuction.js'   // (soccer's kit: the striker)
import { seeded } from '../../src/lib/rng.js'

let fails = 0
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg) } }
const stats = { auctions: 0, backUp: 0, returned: 0, draws: 0, drawnCards: 0, skips: 0 }

for (const [sport, list] of Object.entries(AUCTION_POS)) for (const pos of list) for (const n of [2, 3]) for (let g = 0; g < 40; g++) {
  const kit = auctionCoreKit(sport, pos)
  ok(kit.pos === pos, `${sport} ${pos}: kit is ${kit.pos}`)
  const players = Array.from({ length: n }, (_, i) => ({ vid: `v${i}`, name: `P${i}` }))
  const m = { code: `T${g}`, seed: `au-test-${sport}-${pos}-${n}-${g}`, players, types: kit.types }
  let L = freshLedger(players), k = 0, done = false
  const r = seeded(`${m.seed}:bots`)
  while (!done) {
    if (auctionOver(L, m, k)) break
    const lot = pickLot(m, L, kit, k + 1)
    if (!lot) break
    k = lot.n
    if (lot.known) { stats.backUp++; ok(L.back.some(c => c.trait === lot.trait && c.name === lot.name), 'a card back up was in the deck') }
    L = takeLot(L, lot)
    // bids: each bidder who can top it bids with a chance, up to a random limit
    let high = null
    for (let round = 0; round < 12; round++) {
      const can = players.filter(p => canTop(L, p.vid, m.types, lot.trait, high))
      if (!can.length) { stats.skips++; break }   // the clock is called at once
      const p = can[Math.floor(r() * can.length)]
      if (r() < 0.45) break
      const amt = Math.min(maxBid(L, p.vid, m.types), minNext(high) + Math.floor(r() * 3))
      ok(amt >= minNext(high), 'bid at least the next step')
      high = { vid: p.vid, amount: amt }
    }
    const prev = L
    L = { ...L, wallets: { ...L.wallets }, won: { ...L.won } }
    if (high) {
      L.wallets[high.vid] -= high.amount
      L.won[high.vid] = { ...L.won[high.vid], [lot.trait]: { val: lot.val, vals: lot.vals, extra: lot.extra, name: lot.name, team: lot.team, price: high.amount } }
    } else { L = returnLot(L, lot, m); stats.returned++ }
    ok(ledgerOk(prev, L, m, kit), `${sport} ${pos} lot ${k}: ledger`)
    for (const p of players) ok(L.wallets[p.vid] >= openSlots(L, p.vid, m.types).length, 'always $1 for every open slot')
    if (high && finishedEarly(L, m, high.vid)) {
      const cards = drawFor(m, L, kit)
      const before = L
      L = applyDraw(L, cards, high.vid)
      ok(ledgerOk(before, L, m, kit), 'the draw passes the ledger check')
      ok(players.every(p => openSlots(L, p.vid, m.types).length === 0), 'the draw fills every open slot')
      stats.draws++; stats.drawnCards += Object.values(cards).reduce((a, c) => a + Object.keys(c).length, 0)
      // a forged draw card is caught
      const other = players.find(p => cards[p.vid])
      if (other) {
        const t = Object.keys(cards[other.vid])[0], fake = kit.pool.find(x => x.name !== cards[other.vid][t].name)
        const forged = { ...L, won: { ...L.won, [other.vid]: { ...L.won[other.vid], [t]: { ...kit.lotOf(fake, t), price: 0, drawn: true } } } }
        ok(!ledgerOk(before, forged, m, kit), 'a forged draw card fails the ledger check')
      }
      done = true
    }
  }
  const ranked = rankAuction(m, L, kit)
  ok(ranked.length === n && ranked.every((p, i) => p.place === i + 1), 'ranked')
  ok(ranked.every(p => p.ovr > 0 && p.ovr <= 99), `${sport} ${pos}: OVRs ${ranked.map(p => p.ovr)}`)
  ok(players.every(p => BUDGET - L.wallets[p.vid] === Object.values(L.won[p.vid]).reduce((a, w) => a + (w.price || 0), 0)), 'wallets match')
  stats.auctions++
}
// One queue a sport: the room's seed draws the position. Every seat works it out the same (the server's m.pos is what
// they all get, and each can check it: posOk), it spreads evenly over the sport's positions, and a room claiming a
// position its seed didn't draw fails the ledger check
{
  const spread = {}
  for (const [sport, list] of Object.entries(AUCTION_POS)) {
    const count = Object.fromEntries(list.map(p => [p, 0]))
    const N = 6000
    for (let g = 0; g < N; g++) {
      const seed = `au-T${g}${sport}`
      const seats = [0, 1, 2].map(() => auctionPosFor(sport, seed))
      ok(seats.every(p => p === seats[0]) && list.includes(seats[0]), `${sport}: every seat gets the same position`)
      count[seats[0]]++
      const m = { sport, seed, pos: seats[0], anyPos: true }
      ok(posOk(m), `${sport}: the drawn position passes`)
      if (list.length > 1 && g < 300) {
        const other = list.find(p => p !== seats[0])
        ok(!posOk({ ...m, pos: other }), `${sport}: a position the seed didn't draw fails`)
        const kit = auctionCoreKit(sport, other), players = [{ vid: 'a' }, { vid: 'b' }]
        const L = freshLedger(players)
        ok(!ledgerOk(L, L, { ...m, pos: other, players, types: kit.types }, kit), `${sport}: the ledger check catches a wrong position`)
      }
    }
    for (const p of list) ok(Math.abs(count[p] / N - 1 / list.length) < 0.03, `${sport}: ${p} drawn ${(count[p] / N * 100).toFixed(1)}%, not about ${(100 / list.length).toFixed(0)}%`)
    spread[sport] = Object.fromEntries(list.map(p => [p, `${(count[p] / N * 100).toFixed(1)}%`]))
  }
  stats.positions = spread
}

// The odds lean toward better cards (GRADE_TILT): the average card, a lot and a draw, against an even draw. About a grade
// higher in every sport and position; S and A more often, C and below still there
{
  const G = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A', 'S']
  const real = GRADE_TILT
  const measure = () => {
    const out = {}
    for (const [sport, list] of Object.entries(AUCTION_POS)) for (const pos of list) {
      const kit = auctionCoreKit(sport, pos), players = [{ vid: 'a' }, { vid: 'b' }]
      let lot = 0, draw = 0, top = 0, low = 0
      const N = 3000
      for (let g = 0; g < N; g++) {
        const m = { seed: `tilt-${sport}-${pos}-${g}`, players, types: kit.types }
        const v = Math.max(0, Math.min(11, Math.round(pickLot(m, freshLedger(players), kit, 1).val)))
        lot += v; if (v >= 10) top++; if (v <= 6) low++
        draw += Math.max(0, Math.min(11, Math.round(drawCard(m, kit, 'a', kit.types[g % kit.types.length]).val)))
      }
      out[`${sport}-${pos}`] = { lot: lot / N, draw: draw / N, top: top / N, low: low / N }
    }
    return out
  }
  setGradeTilt(0); const even = measure()
  setGradeTilt(real); const tilt = measure()
  const lines = []
  for (const k of Object.keys(even)) {
    const a = even[k], b = tilt[k]
    ok(b.lot - a.lot > 0.8 && b.lot - a.lot < 1.6, `${k}: lots ${(b.lot - a.lot).toFixed(2)} grades better, not about one`)
    ok(b.draw - a.draw > 0.8 && b.draw - a.draw < 1.6, `${k}: the draw ${(b.draw - a.draw).toFixed(2)} grades better, not about one`)
    ok(b.top > a.top && b.low > 0.1, `${k}: S/A more often, C and below still there`)
    const f = x => `${x.toFixed(2)} ${G[Math.round(x)]}`
    lines.push(`  ${k.padEnd(13)} lot ${f(a.lot)} → ${f(b.lot)} · draw ${f(a.draw)} → ${f(b.draw)} · A/S ${Math.round(a.top * 100)}% → ${Math.round(b.top * 100)}% · C+ and below ${Math.round(a.low * 100)}% → ${Math.round(b.low * 100)}%`)
  }
  console.log(`grade spread, even draw → GRADE_TILT ${real}:\n${lines.join('\n')}`)
}

// soccer: the striker's slots are Salary Cap's five soccer columns, and the OVR is the striker's (calcSoccerOVR):
// the pool's best card at every slot makes an elite No. 9, its worst a poor one
{
  const kit = auctionCoreKit('soccer', 'st')
  ok(kit.sport === 'soccer' && kit.types.length === 5, 'soccer kit: five slots')
  const pick = better => Object.fromEntries(kit.types.map(t => {
    const cards = kit.pool.map(p => kit.lotOf(p, t)).sort((a, b) => (better ? b.val - a.val : a.val - b.val))
    return [t, { ...cards[0], price: 1 }]
  }))
  const hi = kit.calcOvr(kit.buildOf(pick(true))), lo = kit.calcOvr(kit.buildOf(pick(false)))
  ok(hi >= 93 && hi <= 99, `soccer: the best build is elite (${hi})`)
  ok(lo < 80, `soccer: the worst build is poor (${lo})`)
  stats.soccerRange = [lo, hi]
}
console.log(JSON.stringify(stats))
console.log(fails ? `${fails} FAILED` : 'all auction checks pass')
process.exit(fails ? 1 : 0)
