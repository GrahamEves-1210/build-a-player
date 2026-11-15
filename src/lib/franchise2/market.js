// FRANCHISE: re-signing and free agency, under the cap (lib/franchise2/contracts.js).
//
// RE-SIGN  The deals that are up. The league's teams keep the men worth keeping when they have the room; the rest
//          hit the market. The player's men wait for his call, one at a time: KEEP at what the market pays him,
//          or LET HIM GO. A first-rounder going into his fourth year comes up for his fifth-year option.
// FREE AGENCY  Three days. Each day the best men left are on the board; the player bids on the ones he wants.
//          Other teams with the room and the need bid too, and the man picks the team the way a player does: the
//          money first, then a winner, a starting job at his spot, and the head coach. Between days the league
//          signs the best of the rest. After the third day the league fills its holes, and it's the draft.
import { SHORTS, POS, MIN, lineup, makeGen, fillUp } from './league'
import { depthChart, groupOf, GROUP } from './roster'
import { askOf, marketValue, signDeal, capRoom, canSign, optionDue, pickUpOption, declineOption, optionPrice, termFor, tagPrice } from './contracts'
import { coachOf, recruits } from './coach'
import { standings } from './standings'
import { rngOf, clamp, r1 } from './rng'

// ── 2. Re-sign ───────────────────────────────────────────────────────────────
// (called once the league has aged: a deal with no years left is up)
export function openResign(F) {
  const R = rngOf(`${F.seed}-${F.year}-resign`)
  F.fa = []
  F.ext = []      // the league's re-signings that make the wire
  for (const s of SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s]
    // the best first: the room goes to the men who matter
    const up = t.r.filter(p => p.y === 0).sort((a, b) => b.o - a.o)
    for (const p of up) {
      const ask = askOf(p, F.year + 1)
      const want = p.ag <= 33 && R.u() < (p.o >= 88 ? 0.95 : p.o >= 82 ? 0.8 : p.o >= 75 ? 0.5 : 0.15)
      if (want && canSign(F, ask.$, s)) { signDeal(p, ask); if (p.o >= 85) F.ext.push([p.i, p.n, p.p, s, p.$, p.y, p.o]) }
      else { t.r = t.r.filter(x => x !== p); F.fa.push(p) }
    }
    // the league's first-rounders: the option picked up on the good ones
    for (const p of t.r) if (optionDue(p)) { if (p.o >= 80) pickUpOption(F, p); else declineOption(p) }
  }
  const mine = F.teams[F.team].r
  F.rs = [...mine.filter(p => p.y === 0), ...mine.filter(p => optionDue(p))].sort((a, b) => b.o - a.o).map(p => p.i)
  F.stage = 'resign'
}
export const resignAsk = (p, F) => askOf(p, (F?.year ?? 2026) + 1)
export const optionAsk = (p, F) => optionPrice(p, F.year + 1)
export const tagAsk = (p, F) => tagPrice(p, F.year + 1)
export const canTag = F => F.tagged !== F.year + 1
// keep: true (re-sign at his ask) · false (let him go) · 'option' (pick up the fifth-year option) · 'decline' ·
// 'tag' (the franchise tag: one year at the top five's average, once a year)
export function resignOne(F, id, keep) {
  const t = F.teams[F.team], p = t.r.find(x => x.i === id)
  F.rs = (F.rs ?? []).filter(x => x !== id)
  if (!p) return null
  if (keep === 'option') { pickUpOption(F, p); return 'option' }
  if (keep === 'decline') { declineOption(p); return 'decline' }
  if (keep === 'tag') { const $ = tagAsk(p, F); signDeal(p, { $, y: 1, g: $ }); F.tagged = F.year + 1; return 'tag' }
  if (keep) { signDeal(p, resignAsk(p, F)); return 'kept' }
  t.r = t.r.filter(x => x !== p)
  if (p.b == null) F.fa.push(p)
  else { F.builds[p.b].done = F.year; F.builds[p.b].left = 1 }
  return 'gone'
}

// ── 3. Free agency ───────────────────────────────────────────────────────────
export const FA_DAYS = 3
export function openFA(F) {
  const R = rngOf(`${F.seed}-${F.year}-fa`)
  // the market: the men nobody kept, and the veterans cut loose around the league (generated, a few good ones)
  for (let i = 0; i < 16; i++) { const pos = R.pick(POS); F.fa.push(makeGen(F, pos, R, { o: clamp(64, 86, Math.round(74 + R.n() * 4.5)), ag: R.int(26, 32) })) }
  for (const p of F.fa) { const a = askOf(p, F.year + 1); p.$ = a.$; p.y = a.y; delete p.rc; delete p.op }
  F.fa.sort((a, b) => b.o - a.o)
  F.fad = 1
  F.fas = []      // the market's signings, in order: [id, name, pos, team, $, y, ovr]
  F.stage = 'fa'
}
// the day's board: the best men left
export const faBoard = (F, n = 8) => [...(F.fa ?? [])].sort((a, b) => b.o - a.o).slice(0, n)

// What a man weighs, 0-1 each, for one team: the money (against his ask), a winner (its record last season and
// how good it is now), a starting job at his spot, the head coach
function lastRecord(F, s) {
  const r = standings(F).R[s]
  return (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t)
}
export function pitchOf(F, s, p, offer) {
  const ask = p.$
  const money = clamp(0, 1, 0.5 + (offer / ask - 1) * 2.2)
  const st = lineup(F.teams[s])
  const ovr = Object.values(st).reduce((a, x) => a + x.o, 0) / Math.max(1, Object.values(st).length)
  const winning = clamp(0, 1, lastRecord(F, s) * 0.65 + clamp(0, 1, (ovr - 76) / 12) * 0.35)
  // the job: would he start (better than the man there now at his spot), or sit behind him
  const g = groupOf(p), C = depthChart(F, s), n = GROUP[g].n
  const room = C[g].filter(x => !x.in)
  const ahead = room.filter(x => x.o > p.o).length
  const role = ahead < n ? 1 : ahead === n ? 0.45 : 0.15
  const c = coachOf(F, s)
  const coach = clamp(0, 1, ((c.ovr ?? (s === F.team ? F.coach?.ovr : null) ?? 72) - 60) / 32)
  // (a Recruiter's pitch: the player's team gets a closer look)
  const lift = s === F.team && recruits(F) ? 0.04 : 0
  return { money, winning, role, coach, starts: ahead < n, v: money * 0.45 + winning * 0.2 + role * 0.22 + coach * 0.13 + lift }
}
// The teams that bid on him (besides the player's): the ones with the room and a hole at his spot
export function rivalsFor(F, p) {
  const R = rngOf(`${F.seed}-${F.year}-fa-${p.i}`)
  const g = groupOf(p)
  const out = []
  for (const s of R.shuffle(SHORTS.filter(x => x !== F.team))) {
    const room = capRoom(F, s)
    if (room < p.$ * 0.9) continue
    const at = depthChart(F, s)[g].filter(x => !x.in)
    const need = at.length < GROUP[g].n + 1 || (at[GROUP[g].n - 1]?.o ?? 0) < p.o - 2
    if (!need) continue
    const offer = r1(Math.min(room, p.$ * (0.92 + R.u() * 0.22)))
    out.push({ s, offer })
    if (out.length >= 3) break
  }
  return out
}
// the bid screen: his ask, the teams in on him, how the player's team looks to him
export function bidView(F, id) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return null
  return { p, ask: p.$, y: p.y, room: capRoom(F), rivals: rivalsFor(F, p), mine: pitchOf(F, F.team, p, p.$) }
}
// the three offers the player can make (money a year): under his ask, his ask, over it
export const OFFERS = [['UNDER', 0.9], ['ASK', 1], ['OVER', 1.15]]
export const offerOf = (p, k) => r1(p.$ * (OFFERS.find(o => o[0] === k)?.[1] ?? 1))
// The player's bid: he weighs every offer and signs where it adds up best. Returns
// { to: team, offer, years, board: [{ s, offer, v, money, winning, role, coach }] (the player's team first) }
export function placeBid(F, id, offer) {
  const p = F.fa.find(x => x.i === id)
  if (!p || !canSign(F, offer)) return null
  const R = rngOf(`${F.seed}-${F.year}-bid-${p.i}-${Math.round(offer * 10)}`)
  const rivals = rivalsFor(F, p)
  const board = [{ s: F.team, offer, ...pitchOf(F, F.team, p, offer) }, ...rivals.map(r => ({ ...r, ...pitchOf(F, r.s, p, r.offer) }))]
  for (const b of board) b.v = r1((b.v + R.n() * 0.03) * 100) / 100
  const win = [...board].sort((a, b) => b.v - a.v)[0]
  F.fa = F.fa.filter(x => x !== p)
  signDeal(p, { $: win.offer, y: termFor(p) })
  F.teams[win.s].r.push(p)
  F.fas.push([p.i, p.n, p.p, win.s, p.$, p.y, p.o])
  return { to: win.s, offer: win.offer, years: p.y, board, p }
}
// a man nobody else wants: signed at his ask, straight away (the end of the market, a depth signing)
export function signFA(F, id) {
  const p = F.fa.find(x => x.i === id)
  if (!p || !canSign(F, p.$)) return false
  F.fa = F.fa.filter(x => x !== p)
  F.teams[F.team].r.push(p)
  F.fas.push([p.i, p.n, p.p, F.team, p.$, p.y, p.o])
  return true
}
// The day ends: the league signs the best of what's left (a team with the room and the need takes a man)
export function nextFADay(F) {
  const R = rngOf(`${F.seed}-${F.year}-faday-${F.fad}`)
  const signed = []
  const take = Math.round(F.fa.length * (F.fad === 1 ? 0.3 : 0.4))
  for (const p of faBoard(F, take)) {
    const rivals = rivalsFor(F, p)
    if (!rivals.length) continue
    const best = rivals.map(r => ({ ...r, v: pitchOf(F, r.s, p, r.offer).v + R.n() * 0.03 })).sort((a, b) => b.v - a.v)[0]
    F.fa = F.fa.filter(x => x !== p)
    signDeal(p, { $: best.offer, y: termFor(p) })
    F.teams[best.s].r.push(p)
    F.fas.push([p.i, p.n, p.p, best.s, p.$, p.y, p.o])
    signed.push(p.i)
  }
  F.fad++
  if (F.fad > FA_DAYS) { cpuFill(F); F.fad = null; return { done: true, signed } }
  return { done: false, signed }
}
// the market closes: the league's teams fill their holes from what's left at the minimum it'll take
function cpuFill(F) {
  const R = rngOf(`${F.seed}-${F.year}-cpufa`)
  for (const s of R.shuffle(SHORTS)) {
    if (s === F.team) continue
    const t = F.teams[s]
    for (const pos of POS) {
      while (t.r.filter(p => p.p === pos).length < MIN[pos]) {
        const i = F.fa.findIndex(p => p.p === pos)
        if (i < 0) break
        const p = F.fa.splice(i, 1)[0]
        signDeal(p, { $: Math.min(p.$, marketValue(p, F.year + 1)), y: 1 })
        t.r.push(p)
      }
    }
    fillUp(F, t.r, R)
  }
  F.fa = []
}
// how the market went: the biggest deals, and the player's team's own (the wire reads it)
export const marketDeals = F => (F.fas ?? []).map(([i, n, p, s, $, y, o]) => ({ i, n, p, s, $, y, o }))
