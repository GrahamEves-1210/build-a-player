// FRANCHISE: re-signing and free agency, under the cap (lib/franchise2/contracts.js).
//
// RE-SIGN  The deals that are up. The league's teams keep the men worth keeping when they have the room; the rest
//          hit the market. The player's men wait for his call: he negotiates with each one (deals.js: years, money,
//          a bonus; the agent counters; patience), tags one, or lets him go. A first-rounder going into his fourth
//          year comes up for his fifth-year option. Filler depth (fl) is never a decision: it re-ups at the minimum.
// FREE AGENCY  Three days. The whole market is on the board; the player makes offers on the ones he wants (years,
//          money a year, a bonus: deals.js worthOf), raises or pulls them until the day ends; his offers out count
//          against his cap room. Other teams with the room and the need bid too, and when the day ends each man
//          picks the team the way a player does: the money first, then a winner, a starting job at his spot, and
//          the head coach; an offer under what he'll take that day (his ask, less as the market dries up) he turns
//          down. Then the league signs the best of the rest. After the third day the league fills its holes.
import { SHORTS, POS, MIN, lineup, makeGen, fillUp, foOf } from './league'
import { depthChart, groupOf, GROUP } from './roster'
import { askOf, marketValue, signDeal, capRoom, canSign, optionDue, pickUpOption, declineOption, optionPrice, termFor, tagPrice, minimumFor, capComply } from './contracts'
import { coachOf, recruits } from './coach'
import { worthOf, signTerms } from './deals'
import { standings } from './standings'
import { rngOf, clamp, r1 } from './rng'

// ── 2. Re-sign ───────────────────────────────────────────────────────────────
// (called once the league has aged: a deal with no years left is up)
export function openResign(F) {
  const R = rngOf(`${F.seed}-${F.year}-resign`)
  F.fa = []
  F.ext = []      // the league's re-signings that make the wire
  F.talks = {}; F.rsd = []
  // (a filler backup's year is up: he goes quietly, every team's, the player's too; the new season signs another
  // where a room still needs one: league.js fillUp)
  for (const s of SHORTS) F.teams[s].r = F.teams[s].r.filter(p => !(p.fl && p.y <= 0))
  for (const s of SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s]
    // the best first: the room goes to the men who matter
    const up = t.r.filter(p => p.y === 0).sort((a, b) => b.o - a.o)
    for (const p of up) {
      const ask = askOf(p, F.year + 1)
      // (a well-run club keeps its core and lets the aging ones go a year early; a badly run one lets good men walk)
      const fo = foOf(F, s)
      const want = p.ag <= 33 - (fo >= 0.65 && p.o < 88 ? 2 : 0) && R.u() < (p.o >= 88 ? 0.95 : p.o >= 82 ? 0.8 : p.o >= 75 ? 0.5 : 0.15) * (0.75 + fo * 0.5)
      if (want && canSign(F, ask.$, s)) { signDeal(p, ask); if (p.o >= 85) F.ext.push([p.i, p.n, p.p, s, p.$, p.y, p.o]) }
      else { t.r = t.r.filter(x => x !== p); F.fa.push(p) }
    }
    // the league's first-rounders: the option picked up on the good ones
    for (const p of t.r) if (optionDue(p)) { if (p.o >= 80) pickUpOption(F, p); else declineOption(p) }
  }
  const mine = F.teams[F.team].r
  F.rs = [...mine.filter(p => p.y === 0), ...mine.filter(p => optionDue(p))].filter(p => !p.fl).sort((a, b) => b.o - a.o).map(p => p.i)
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
  const done = k => { (F.rsd ??= []).push([id, k, p.n, p.p, p.o]); if (F.talks?.[id]) F.talks[id].st = k === 'gone' ? 2 : 1; return k }
  if (keep === 'option') { pickUpOption(F, p); return done('option') }
  if (keep === 'decline') { declineOption(p); return done('decline') }
  if (keep === 'tag') { const $ = tagAsk(p, F); signDeal(p, { $, y: 1, g: $ }); F.tagged = F.year + 1; return done('tag') }
  if (keep) { signDeal(p, resignAsk(p, F)); return done('kept') }
  done('gone')
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
  // (a quarterback cut loose is a backup or a bridge starter at best: the good ones never reach the street)
  // (a veteran cut loose: his last team, for the market's card; his ceiling is where he is, near enough)
  for (let i = 0; i < 16; i++) {
    const pos = R.pick(POS)
    const p = makeGen(F, pos, R, { o: clamp(64, pos === 'qb' ? 77 : 86, Math.round(74 + R.n() * 4.5)), ag: R.int(26, 32) })
    p.pk = Math.min(p.pk ?? p.o, p.o + (p.ag <= 27 ? 2 : 0)); p.ls = [R.pick(SHORTS.filter(s => s !== F.team)), 0]; delete p.fl
    F.fa.push(p)
  }
  F.fa = F.fa.filter(p => !p.fl)
  for (const p of F.fa) { const a = askOf(p, F.year + 1); p.$ = a.$; p.y = a.y; delete p.rc; delete p.op }
  F.talks = null; F.fao = {}; F.far = null
  F.fa.sort((a, b) => b.o - a.o)
  F.fad = 1
  F.fas = []      // the market's signings, in order: [id, name, pos, team, $, y, ovr]
  F.stage = 'fa'
}
// the day's board: the best men left
export const faBoard = (F, n = 8) => [...(F.fa ?? [])].filter(p => !p.fl).sort((a, b) => b.o - a.o).slice(0, n)

// What a man weighs, 0-1 each, for one team: the money (against his ask), a winner (its record last season and
// how good it is now), a starting job at his spot, the head coach
function lastRecord(F, s) {
  const r = standings(F).R[s]
  return (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t)
}
// offer: the money a year (his term, the usual bonus), or an offer's terms { $, y, b } (deals.js worthOf)
// V: the league's teams read once (teamView), for a screen that asks about many men
export function pitchOf(F, s, p, offer, V = null) {
  const ask = p.$
  const eff = typeof offer === 'number' ? offer : worthOf(p, offer)
  const money = clamp(0, 1, 0.5 + (eff / ask - 1) * 2.2)
  const T = V?.[s] ?? teamRead(F, s)
  const winning = clamp(0, 1, T.wp * 0.65 + clamp(0, 1, (T.ovr - 76) / 12) * 0.35)
  // the job: would he start (better than the man there now at his spot), or sit behind him
  const g = groupOf(p), n = GROUP[g].n
  const ahead = T.rooms[g].filter(o => o > p.o).length
  const role = ahead < n ? 1 : ahead === n ? 0.45 : 0.15
  const coach = clamp(0, 1, ((T.covr ?? (s === F.team ? F.coach?.ovr : null) ?? 72) - 60) / 32)
  // (a Recruiter's pitch: the player's team gets a closer look)
  const lift = s === F.team && recruits(F) ? 0.04 : 0
  return { money, winning, role, coach, starts: ahead < n, v: money * 0.45 + winning * 0.2 + role * 0.22 + coach * 0.13 + lift }
}
// A team as a free agent reads it: its record, its starters' OVR, the OVRs in each room (healthy, best first), its
// head coach, its cap room. teamView(F): every team at once (a screen that asks about many men reads it once).
export function teamRead(F, s) {
  const st = Object.values(lineup(F.teams[s]))
  const C = depthChart(F, s)
  return {
    wp: lastRecord(F, s), ovr: st.reduce((a, x) => a + x.o, 0) / Math.max(1, st.length),
    rooms: Object.fromEntries(Object.keys(GROUP).map(g => [g, (C[g] ?? []).filter(x => !x.in).map(x => x.o)])),
    covr: coachOf(F, s).ovr, room: capRoom(F, s),
  }
}
export const teamView = F => Object.fromEntries(SHORTS.map(s => [s, teamRead(F, s)]))
// The teams that bid on him (besides the player's): the ones with the room and a hole at his spot
export function rivalsFor(F, p, V = null) {
  const R = rngOf(`${F.seed}-${F.year}-fa-${p.i}`)
  const g = groupOf(p)
  const out = []
  // (the best-run clubs are first to the phone: league.js foOf)
  const order = SHORTS.filter(x => x !== F.team).map(s => [s, foOf(F, s) + R.u() * 0.6]).sort((a, b) => b[1] - a[1]).map(x => x[0])
  for (const s of order) {
    const T = V?.[s]
    const room = T ? T.room : capRoom(F, s)
    if (room < p.$ * 0.9) continue
    const at = T ? T.rooms[g] : depthChart(F, s)[g].filter(x => !x.in).map(x => x.o)
    const need = at.length < GROUP[g].n + 1 || (at[GROUP[g].n - 1] ?? 0) < p.o - 2
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
// ── The player's offers ──────────────────────────────────────────────────────
// F.fao: { [id]: { $, y, b } } his offers out until the day ends; their first-year cap hits count against his room
export const offersOut = F => F.fao ?? {}
export const committed = (F, but = null) => Object.entries(F.fao ?? {}).reduce((a, [id, o]) => a + (+id === but ? 0 : o.$), 0)
export const roomLeft = (F, but = null) => r1(capRoom(F) - committed(F, but))
export function setOffer(F, id, o) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p || !F.fad) return false
  o = { $: r1(Math.max(minimumFor(p.ag, F.year + 1), o.$)), y: clamp(1, 5, Math.round(o.y)), b: clamp(0, 2, o.b ?? 0) }
  if (roomLeft(F, id) < o.$ - 1e-9) return false
  F.fao = { ...(F.fao ?? {}), [id]: o }
  return true
}
export function pullOffer(F, id) { if (F.fao?.[id]) { const n = { ...F.fao }; delete n[id]; F.fao = n } }
// what he'll take on a day of the market: his ask on day one, less as the days go and the money dries up
export const FLOOR_DAY = [0.97, 0.9, 0.82]
export const floorOf = (F, p) => r1(p.$ * FLOOR_DAY[clamp(1, FA_DAYS, F.fad ?? FA_DAYS) - 1])
// Where an offer stands now, in plain words: { k: 'short' | 'alone' | 'lead' | 'close' | 'behind', lead (the team
// ahead when he's behind), mine (the pitch), rivals }
export function standingOf(F, p, o, V = null) {
  const rivals = rivalsFor(F, p, V)
  const mine = pitchOf(F, F.team, p, o, V)
  if (worthOf(p, o) < floorOf(F, p) - 1e-9) return { k: 'short', mine, rivals }
  if (!rivals.length) return { k: 'alone', mine, rivals }
  const best = rivals.map(r => ({ ...r, v: pitchOf(F, r.s, p, r.offer, V).v })).sort((a, b) => b.v - a.v)[0]
  const gap = mine.v - best.v
  return { k: gap >= 0.04 ? 'lead' : gap > -0.04 ? 'close' : 'behind', lead: best.s, mine, rivals }
}
// How a man fits the player's roster: { k: 'hole' | 'start' | 'depth', d (OVR over the man he'd replace), v (a sort
// key: bigger is a better fit) }
export function fitOf(F, p, V = null) {
  const g = groupOf(p), n = GROUP[g].n
  const at = (V?.[F.team] ?? teamRead(F, F.team)).rooms[g]
  if (at.length < n) return { k: 'hole', d: null, v: 100 + p.o }
  const last = at[n - 1]
  if (p.o > last) return { k: 'start', d: p.o - last, v: 50 + p.o - last }
  return { k: 'depth', d: p.o - last, v: p.o - last }
}
// the day's end for the player's offers: each man weighs every offer and signs where it adds up best; an offer
// under what he'll take today he turns down (he stays on the market). F.far: what happened, for the screen.
function settleOffers(F) {
  const out = []
  const list = Object.entries(F.fao ?? {}).map(([id, o]) => [(F.fa ?? []).find(x => x.i === +id), o]).filter(x => x[0]).sort((a, b) => b[0].o - a[0].o)
  for (const [p, o] of list) {
    const R = rngOf(`${F.seed}-${F.year}-fad-${F.fad}-${p.i}`)
    if (!canSign(F, o.$)) { out.push({ i: p.i, n: p.n, p: p.p, s: p.s, k: 'cap', o }); continue }
    const rivals = rivalsFor(F, p)
    const short = worthOf(p, o) < floorOf(F, p) - 1e-9
    const board = [{ s: F.team, offer: o.$, y: o.y, ...pitchOf(F, F.team, p, o) }, ...rivals.map(r => ({ ...r, y: termFor(p), ...pitchOf(F, r.s, p, r.offer) }))]
    for (const b of board) b.v = r1((b.v + R.n() * 0.03) * 100) / 100
    if (short) board[0].v = -1
    const win = [...board].sort((a, b) => b.v - a.v)[0]
    const shown = board.map(b => ({ s: b.s, offer: b.offer, y: b.y, starts: b.starts, v: b.v }))
    if (win.v < 0) { out.push({ i: p.i, n: p.n, p: p.p, s: p.s, k: 'wait', o, board: shown }); continue }
    F.fa = F.fa.filter(x => x !== p)
    if (win.s === F.team) signTerms(p, o)
    else signDeal(p, { $: win.offer, y: termFor(p) })
    F.teams[win.s].r.push(p)
    F.fas.push([p.i, p.n, p.p, win.s, p.$, p.y, p.o])
    out.push({ i: p.i, n: p.n, p: p.p, s: p.s, k: win.s === F.team ? 'won' : 'lost', to: win.s, o, $: p.$, y: p.y, board: shown })
  }
  F.fao = {}
  F.far = { d: F.fad, list: out }
  return out
}

// The day ends: the player's offers are answered, then the league signs the best of what's left (a team with the
// room and the need takes a man)
export function nextFADay(F) {
  settleOffers(F)
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
        // (a hole filled late in the market: his price if it fits, else a one-year minimum deal)
        const $ = Math.min(p.$, marketValue(p, F.year + 1))
        signDeal(p, { $: canSign(F, $, s) ? $ : minimumFor(p.ag, F.year + 1), y: 1 })
        t.r.push(p)
      }
    }
    fillUp(F, t.r, R)
  }
  leagueUnderCap(F)
  F.fa = []
}
// every league team under the cap before the new league year (restructures, then releases; the holes refilled at
// the minimum). The draft's rookies are signed after this; draft.js calls it again when the draft closes.
export function leagueUnderCap(F) {
  const R = rngOf(`${F.seed}-${F.year}-capfix`)
  for (const s of SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s]
    if (capRoom(F, s) >= 0) continue
    const on = new Set(Object.values(lineup(t)).map(p => p.i))
    capComply(F, s, on)
    const before = t.r.length
    fillUp(F, t.r, R)
    for (const p of t.r.slice(before)) { p.$ = minimumFor(p.ag, F.year + 1); p.y = 1; p.g = 0 }
    if (capRoom(F, s) < 0) capComply(F, s, on)
  }
}
// how the market went: the biggest deals, and the player's team's own (the wire reads it)
export const marketDeals = F => (F.fas ?? []).map(([i, n, p, s, $, y, o]) => ({ i, n, p, s, $, y, o }))
