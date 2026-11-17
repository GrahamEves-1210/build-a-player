// FRANCHISE: re-signing and free agency, under the cap (lib/franchise2/contracts.js).
//
// RE-SIGN  The deals that are up. The league's teams extend their young core a year early, keep the men worth
//          keeping (making the room for a star with restructures), tag the best man they can't fit (once a year),
//          and let the rest hit the market. The player's men wait for his call: he negotiates with each one
//          (deals.js: years, money, a bonus; the agent counters; patience), tags one, or lets him go. A first-rounder
//          going into his fourth year comes up for his fifth-year option. Filler depth (fl) is never a decision: it
//          re-ups at the minimum.
// FREE AGENCY  Three days. The whole market is on the board; the player makes offers on the ones he wants (years,
//          money a year, a bonus: deals.js worthOf), raises or pulls them; his offers out count against his cap
//          room. Other teams with the room and the need bid too. Each man decides on his own day (F.fdd): most of
//          the market on the first day or two, the best taking a few days to hear every offer. When he decides he
//          takes the best total offer: the money as he values it (a year's pay, moved by the years and the
//          guarantee), then a little for a winner, a starting job and the head coach. A lower offer wins only when
//          one of those outweighs the money, and the result says which. An offer under what he'll take that day (his
//          ask, less as the market dries up) he turns down. After the third day the league fills its holes.
import { SHORTS, POS, MIN, TEAM, lineup, makeGen, fillUp, foOf } from './league'
import { depthChart, groupOf, GROUP, backupsOf } from './roster'
import { askOf, marketValue, signDeal, extendDeal, capRoom, canSign, optionDue, pickUpOption, declineOption, optionPrice, termFor, tagPrice, minimumFor, capComply, makeRoom, roomAhead, marketLines } from './contracts'
import { coachOf, recruits } from './coach'
import { worthOf, signTerms, startsFor } from './deals'
import { standings } from './standings'
import { rngOf, clamp, r1 } from './rng'
import { W_OFF, W_DEF } from './ratings'

// ── 2. Re-sign ───────────────────────────────────────────────────────────────
// a man's place in his team's room, injuries aside (the chart's order: the player's own, the league's by rating)
const startsOn = (F, s, p) => { const g = groupOf(p), at = (depthChart(F, s)[g] ?? []).filter(x => !x.fl).findIndex(x => x.i === p.i); return at >= 0 && at < GROUP[g].n }
// the order a front office takes its decisions in: the best and youngest first
const coreFirst = (a, b) => (b.o - Math.max(0, b.ag - 27) * 1.5) - (a.o - Math.max(0, a.ag - 27) * 1.5)
// (called once the league has aged: a deal with no years left is up)
export function openResign(F) {
  const R = rngOf(`${F.seed}-${F.year}-resign`)
  // (the lines before anyone leaves a roster: the league as it ended the season)
  const L = marketLines(F), yr = F.year + 1
  F.fa = []
  F.ext = []      // the league's extensions, re-signings and tags that make the wire: [id, name, pos, team, $, y, ovr, kind]
  F.talks = {}; F.rsd = []
  // (a filler backup's year is up: he goes quietly, every team's, the player's too; the new season signs another
  // where a room still needs one: league.js fillUp)
  for (const s of SHORTS) F.teams[s].r = F.teams[s].r.filter(p => !(p.fl && p.y <= 0))
  for (const s of SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s], fo = foOf(F, s)
    // the league's first-rounders: the option picked up on the good ones
    for (const p of t.r) if (optionDue(p)) { if (p.o >= 80) pickUpOption(F, p, startsOn(F, s, p)); else declineOption(p) }
    // 1. the young core extended a year early, the way real clubs keep their stars off the market (a man going into
    // the last year of his deal, his option year included): when the room next year allows it
    for (const p of t.r.filter(x => x.y === 1 && !x.fl && x.b == null && x.p !== 'k' && x.ag <= 28 && x.o >= 84 && startsOn(F, s, x)).sort(coreFirst)) {
      if (R.u() >= (p.o >= 88 ? 0.75 : 0.5) * (0.75 + fo * 0.5)) continue
      const ask = askOf({ ...p, ag: p.ag + 1 }, yr + 1, L)
      if (roomAhead(F, s, 1) < ask.$) continue
      extendDeal(p, { $: ask.$, y: clamp(3, 5, ask.y) })
      F.ext.push([p.i, p.n, p.p, s, ask.$, p.y - 1, p.o, 'ext'])
    }
    // 2. the deals that are up, the core first
    const on = new Set(t.r.filter(x => x.y > 0 && startsOn(F, s, x)).map(x => x.i))
    for (const p of t.r.filter(x => x.y === 0).sort(coreFirst)) {
      const ask = askOf(p, yr, L)
      const starts = startsOn(F, s, p)
      // (a kicker who still makes his kicks is kept into his late 30s: a team has one; a young star almost always
      // stays, whatever the front office; a well-run club lets the aging ones go a year early, a badly run one lets
      // good men walk; a man who doesn't start for them is kept less often)
      const young = p.ag <= 27 && p.o >= 85
      const want = p.p === 'k' ? p.ag <= 39 && R.u() < (p.o >= 76 ? 0.9 : 0.35) * (0.75 + fo * 0.5)
        : young ? R.u() < 0.97
        : p.ag <= 33 - (fo >= 0.65 && p.o < 88 ? 2 : 0) && R.u() < (p.o >= 88 ? 0.95 : p.o >= 82 ? 0.8 : p.o >= 75 ? 0.5 : 0.15) * (0.75 + fo * 0.5) * (starts ? 1 : 0.6)
      if (want) {
        // the franchise tag, one a year: a star the club can't carry on a long deal in the years ahead, or one it
        // wants another year of before it pays him (a QB's tag is cheaper than his ask), at no more than his ask
        // plus half (the tag is the top five's average: a club pays over his number for the year it buys)
        const tg = p.o >= 85 && p.ag <= 30 && p.p !== 'k' && t.tag !== yr ? tagPrice(p, yr) : null
        const tagIt = tg != null && tg <= ask.$ * 1.5 && (roomAhead(F, s, 1) < ask.$ || R.u() < 0.3)
        // (a man worth keeping: the room made by restructures if it isn't there; a young star's, by releases too)
        const cost = tagIt ? tg : ask.$
        if (!canSign(F, cost, s) && p.o >= 82 && starts) { if (young) capComply(F, s, on, cost); else makeRoom(F, s, cost) }
        if (tagIt && canSign(F, tg, s)) { signDeal(p, { $: tg, y: 1, g: tg }); t.tag = yr; F.ext.push([p.i, p.n, p.p, s, tg, 1, p.o, 'tag']); continue }
        if (canSign(F, ask.$, s)) { signDeal(p, ask); if (p.o >= 85) F.ext.push([p.i, p.n, p.p, s, p.$, p.y, p.o, 'rs']); continue }
        // (the deal won't fit: the tag, if it will)
        if (tg != null && !tagIt) {
          if (!canSign(F, tg, s) && young) capComply(F, s, on, tg)
          if (canSign(F, tg, s)) { signDeal(p, { $: tg, y: 1, g: tg }); t.tag = yr; F.ext.push([p.i, p.n, p.p, s, tg, 1, p.o, 'tag']); continue }
        }
      }
      t.r = t.r.filter(x => x !== p); F.fa.push(p)
    }
  }
  // the player's team, over the cap as the new league year starts: the front office restructures the big deals to get
  // under it, the way NFL clubs do by March (no releases: who goes is the GM's call), and the wire reports each one
  if (capRoom(F, F.team) < 0) {
    for (const m of makeRoom(F, F.team, 0)) F.news = [...(F.news ?? []), { k: 'sign', tag: 'RESTRUCTURED', s: F.team, text: `${TEAM[F.team]?.nick ?? F.team} restructure ${m.n}${/s$/.test(m.n) ? "'" : "'s"} contract, clearing $${m.saves.toFixed(1)} million in cap space`, y: F.year, wk: F.wk }].slice(-40)
  }
  const mine = F.teams[F.team].r
  F.rs = [...mine.filter(p => p.y === 0), ...mine.filter(p => optionDue(p))].filter(p => !p.fl).sort((a, b) => b.o - a.o).map(p => p.i)
  F.stage = 'resign'
}
export const resignAsk = (p, F) => askOf(p, (F?.year ?? 2026) + 1, F?.teams ? marketLines(F) : null)
export const optionAsk = (p, F) => optionPrice(p, F.year + 1, startsFor(F, p))
export const tagAsk = (p, F) => tagPrice(p, F.year + 1)
export const canTag = F => F.tagged !== F.year + 1
// keep: true (re-sign at his ask) · false (let him go) · 'option' (pick up the fifth-year option) · 'decline' ·
// 'tag' (the franchise tag: one year at the top five's average, once a year)
export function resignOne(F, id, keep) {
  const t = F.teams[F.team], p = t.r.find(x => x.i === id)
  F.rs = (F.rs ?? []).filter(x => x !== id)
  if (!p) return null
  const done = k => { (F.rsd ??= []).push([id, k, p.n, p.p, p.o]); if (F.talks?.[id]) F.talks[id].st = k === 'gone' ? 2 : 1; return k }
  if (keep === 'option') { pickUpOption(F, p, startsFor(F, p)); return done('option') }
  if (keep === 'decline') { declineOption(p); return done('decline') }
  if (keep === 'tag') { const $ = tagAsk(p, F); signDeal(p, { $, y: 1, g: $ }); F.tagged = F.year + 1; return done('tag') }
  if (keep) { signDeal(p, resignAsk(p, F)); return done('kept') }
  done('gone')
  t.r = t.r.filter(x => x !== p)
  if (p.b == null) F.fa.push(p)
  else { F.builds[p.b].done = F.year; F.builds[p.b].left = 1 }
  return 'gone'
}
// the starters whose deals are up and who'd walk if the player moved on now (the re-sign screen asks first)
export const walkingStarters = F => (F.rs ?? []).map(i => F.teams[F.team].r.find(x => x.i === i)).filter(p => p && !optionDue(p) && startsFor(F, p))

// ── 3. Free agency ───────────────────────────────────────────────────────────
export const FA_DAYS = 3
export function openFA(F) {
  const R = rngOf(`${F.seed}-${F.year}-fa`)
  // the market: the men nobody kept, and the veterans cut loose around the league (generated, a few good ones)
  // (a quarterback cut loose is a backup or a bridge starter at best: the good ones never reach the street)
  // (a veteran cut loose: his last team, for the market's card; his ceiling is where he is, near enough)
  for (let i = 0; i < 16; i++) {
    const pos = R.pick(POS)
    const p = makeGen(F, pos, R, { o: pos === 'k' ? clamp(70, 86, Math.round(77 + R.n() * 4)) : clamp(64, pos === 'qb' ? 77 : 86, Math.round(74 + R.n() * 4.5)), ag: pos === 'k' ? R.int(27, 36) : R.int(26, 32) })
    p.pk = Math.min(p.pk ?? p.o, p.o + (p.ag <= 27 ? 2 : 0)); p.ls = [R.pick(SHORTS.filter(s => s !== F.team)), 0]; delete p.fl
    F.fa.push(p)
  }
  F.fa = F.fa.filter(p => !p.fl)
  const L = marketLines(F)
  for (const p of F.fa) { const a = askOf(p, F.year + 1, L); p.$ = a.$; p.y = a.y; delete p.rc; delete p.op; delete p.sc }
  F.talks = null; F.fao = {}; F.far = null
  F.fa.sort((a, b) => b.o - a.o)
  // the day each man decides: the best take two or three days to hear every offer; the rest of the market goes
  // mostly in the first day or two, the way the real one does (a hundred deals in its first 48 hours)
  F.fdd = {}
  for (const p of F.fa) { const u = R.u(); F.fdd[p.i] = p.o >= 90 ? (u < 0.5 ? 2 : 3) : p.o >= 85 ? (u < 0.3 ? 1 : u < 0.8 ? 2 : 3) : (u < 0.55 ? 1 : u < 0.85 ? 2 : 3) }
  F.fad = 1
  F.fas = []      // the market's signings, in order: [id, name, pos, team, $, y, ovr]
  F.stage = 'fa'
}
// the day he decides (an old save's market: the first)
export const decideDay = (F, p) => clamp(1, FA_DAYS, F.fdd?.[p.i] ?? 1)
// the day's board: the best men left
export const faBoard = (F, n = 8) => [...(F.fa ?? [])].filter(p => !p.fl).sort((a, b) => b.o - a.o).slice(0, n)

// What a man weighs, for one team's offer. The money as he values it (deals.js worthOf: a year's pay, moved by the
// years and the guarantee), against his ask; then, as a share of that money, the rest: a winner (its record last
// season and how good it is now) up to +6%, a starting job at his spot +6% (a backup's chair -3%, third string -8%),
// the head coach up to +3%. So money decides most signings, and the rest decides close ones.
//   returns { money, winning, role, coach (0-1 each, the screen's meters), starts, w (the money as he values it),
//   x: { win, role, coach } (what the rest adds), v (the whole offer, 1 = his ask with nothing else) }
function lastRecord(F, s) {
  const r = standings(F).R[s]
  return (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t)
}
// offer: the money a year (his years, the usual bonus), or an offer's terms { $, y, b } (deals.js worthOf)
// V: the league's teams read once (teamView), for a screen that asks about many men
export function pitchOf(F, s, p, offer, V = null) {
  const ask = p.$
  const o = typeof offer === 'number' ? { $: offer, y: p.y ?? termFor(p), b: 0 } : offer
  const w = worthOf(p, o)
  const m = w / Math.max(0.1, ask)
  const T = V?.[s] ?? teamRead(F, s)
  const winning = clamp(0, 1, T.wp * 0.65 + clamp(0, 1, (T.ovr - 76) / 12) * 0.35)
  // the job: would he start (better than the man there now at his spot), or sit behind him
  const g = groupOf(p), n = GROUP[g].n
  const ahead = T.rooms[g].filter(o2 => o2 > p.o).length
  const role = ahead < n ? 1 : ahead === n ? 0.45 : 0.15
  const coach = clamp(0, 1, ((T.covr ?? (s === F.team ? F.coach?.ovr : null) ?? 72) - 60) / 32)
  // (a Recruiter's pitch: the player's team gets a closer look)
  const lift = s === F.team && recruits(F) ? 0.02 : 0
  const x = { win: (winning - 0.5) * 0.12, role: role === 1 ? 0.06 : role === 0.45 ? -0.03 : -0.08, coach: (coach - 0.5) * 0.06 + lift }
  return { money: clamp(0, 1, 0.5 + (m - 1) * 2.2), winning, role, coach, starts: ahead < n, w, x, v: m * (1 + x.win + x.role + x.coach) }
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
// The teams that bid on him (besides the player's): the ones with the room and a hole at his spot. Each offers
// his years at about his ask (92% to 114% of it)
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
    const need = at.length < GROUP[g].n + backupsOf(g) || (at[GROUP[g].n - 1] ?? 0) < p.o - 2
    if (!need) continue
    const offer = r1(Math.min(room, p.$ * (0.92 + R.u() * 0.22)))
    out.push({ s, offer, y: p.y ?? termFor(p) })
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

// ── A man's decision ─────────────────────────────────────────────────────────
// The offers on the table (the player's first when he made one) weighed: { board: [{ s, offer, y, b, v, w, starts,
// x, mine }], win, why }. An offer under what he'll take today scores -1 (TOO LOW); the player's when it no longer
// fits his cap, the same. why: when he took less a year than the best offer on the table, the reason that outweighed
// the money ({ k: 'deal' | 'role' | 'win' | 'coach', vs: the team that offered more, less: $M a year less }).
export function weigh(F, p, mine, rivals, V, R, floor = floorOf(F, p)) {
  const board = [...(mine ? [{ s: F.team, offer: mine.$, y: mine.y, b: mine.b ?? 0, mine: 1 }] : []), ...rivals.map(r => ({ s: r.s, offer: r.offer, y: r.y ?? p.y, b: 0 }))]
  for (const b of board) {
    const pt = pitchOf(F, b.s, p, { $: b.offer, y: b.y, b: b.b }, V)
    Object.assign(b, { v: r1((pt.v + (R ? R.n() * 0.004 : 0)) * 1000) / 1000, w: pt.w, starts: pt.starts, x: pt.x })
    if (pt.w < floor - 1e-9 || (b.mine && !canSign(F, b.offer))) b.v = -1
  }
  const ok = board.filter(b => b.v >= 0)
  const win = ok.length ? [...ok].sort((a, b) => b.v - a.v)[0] : null
  return { board, win, why: win ? whyOf(ok, win) : null }
}
export function whyOf(ok, win) {
  const hi = [...ok].sort((a, b) => b.offer - a.offer)[0]
  if (!hi || hi === win || win.offer >= hi.offer - 0.05) return null
  const d = { deal: win.w / win.offer - hi.w / hi.offer, role: win.x.role - hi.x.role, win: win.x.win - hi.x.win, coach: win.x.coach - hi.x.coach }
  const k = Object.keys(d).sort((a, b) => d[b] - d[a])[0]
  return { k, vs: hi.s, less: r1(hi.offer - win.offer) }
}
// he signs where he chose
function signWith(F, p, b) {
  F.fa = F.fa.filter(x => x !== p)
  if (F.fdd) delete F.fdd[p.i]
  if (b.mine) signTerms(p, { $: b.offer, y: b.y, b: b.b })
  else signDeal(p, { $: b.offer, y: b.y ?? termFor(p) })
  F.teams[b.s].r.push(p)
  F.fas.push([p.i, p.n, p.p, b.s, p.$, p.y, p.o])
}

// The player's bid, answered on the spot (the headless sims' shortcut): he weighs every offer and signs where it adds
// up best. Returns { to: team, offer, years, board, why } or null (no deal)
export function placeBid(F, id, offer) {
  const p = F.fa.find(x => x.i === id)
  if (!p || !canSign(F, offer)) return null
  const R = rngOf(`${F.seed}-${F.year}-bid-${p.i}-${Math.round(offer * 10)}`)
  const { board, win, why } = weigh(F, p, { $: offer, y: p.y, b: 0 }, rivalsFor(F, p), null, R, 0)
  if (!win) return null
  signWith(F, p, win)
  return { to: win.s, offer: win.offer, years: p.y, board, why, p }
}
// a man nobody else wants: signed at his ask, straight away (the end of the market, a depth signing)
export function signFA(F, id) {
  const p = F.fa.find(x => x.i === id)
  if (!p || !canSign(F, p.$)) return false
  F.fa = F.fa.filter(x => x !== p)
  if (F.fdd) delete F.fdd[p.i]
  F.teams[F.team].r.push(p)
  F.fas.push([p.i, p.n, p.p, F.team, p.$, p.y, p.o])
  return true
}
// ── The player's offers ──────────────────────────────────────────────────────
// F.fao: { [id]: { $, y, b } } his offers out until the man decides; their first-year cap hits count against his room
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
// an offer so far over his ask and every other bid that he takes it before his day (and before anyone can match)
const EARLY = 1.12
// Where an offer stands now, in plain words: { k: 'short' | 'alone' | 'lead' | 'close' | 'behind', lead (the team
// ahead when he's behind), mine (the pitch), rivals, day (the day he decides) }
export function standingOf(F, p, o, V = null) {
  const rivals = rivalsFor(F, p, V)
  const mine = pitchOf(F, F.team, p, o, V)
  const day = decideDay(F, p)
  if (mine.w < floorOf(F, p) - 1e-9) return { k: 'short', mine, rivals, day }
  if (!rivals.length) return { k: 'alone', mine, rivals, day }
  const best = rivals.map(r => ({ ...r, v: pitchOf(F, r.s, p, { $: r.offer, y: r.y, b: 0 }, V).v })).sort((a, b) => b.v - a.v)[0]
  const gap = mine.v - best.v
  return { k: gap >= 0.03 ? 'lead' : gap > -0.03 ? 'close' : 'behind', lead: best.s, mine, rivals, day }
}
// How a man fits the player's roster, by what he adds to the starting lineup: the rating points he'd add to the
// lineup's slots at his spot (him in, everyone below a slot down; a slot nobody fills is a man off the street),
// weighted the way the team's rating weighs each slot (ratings.js: a QB's slot is worth nine safeties'). k: 'hole' (a
// starting slot is empty) | 'start' (he'd start) | 'depth'; d: OVR over the man he'd replace (over the street for a
// hole); v: the impact, the sort key (bigger is a better fit)
const SLOT_W = { ...W_OFF, ...W_DEF, k1: 0.03 }
const STREET = 60
export function fitOf(F, p, V = null) {
  const g = groupOf(p), n = GROUP[g].n
  const at = (V?.[F.team] ?? teamRead(F, F.team)).rooms[g]
  const w = Object.entries(SLOT_W).filter(([k]) => k.replace(/\d+$/, '') === g).map(([, x]) => x).sort((a, b) => b - a)
  const before = [...at].sort((a, b) => b - a), after = [...before, p.o].sort((a, b) => b - a)
  const v = w.reduce((a, x, j) => a + x * ((after[j] ?? STREET) - (before[j] ?? STREET)), 0)
  if (at.length < n) return { k: 'hole', d: p.o - STREET, v: r1(v * 100) / 100 }
  const last = before[n - 1]
  return p.o > last ? { k: 'start', d: p.o - last, v: r1(v * 100) / 100 } : { k: 'depth', d: p.o - last, v: r1(v * 100) / 100 }
}

// The day ends. Every man whose day it is decides (the best men first): the player's offer and every other bid
// weighed, and he signs with the best of them, or waits if none is at what he'll take today. A man still deciding
// keeps the player's offer out, unless it's so far over everything else that he takes it now. F.far: what happened
// to the player's offers, for the screen.
function settleDay(F) {
  const d = F.fad
  const R = rngOf(`${F.seed}-${F.year}-faday-${d}`)
  const V = teamView(F)
  const fao = F.fao ?? {}, keep = {}, out = []
  const last = d >= FA_DAYS
  for (const p of [...(F.fa ?? [])].filter(x => !x.fl).sort((a, b) => b.o - a.o)) {
    const o = fao[p.i]
    const line = x => ({ i: p.i, n: p.n, p: p.p, s: p.s, o, ...x })
    const day = decideDay(F, p)
    const rivals = rivalsFor(F, p, V)
    const { board, win, why } = weigh(F, p, o, rivals, V, R)
    const shown = () => board.map(b => ({ s: b.s, offer: b.offer, y: b.y, starts: b.starts, v: b.v, w: r1(b.w) }))
    if (day > d && !last) {
      const mineB = board.find(b => b.mine)
      const early = mineB && win === mineB && mineB.v >= EARLY && board.every(b => b === mineB || b.v * 1.08 <= mineB.v)
      if (!early) { if (o) { keep[p.i] = o; out.push(line({ k: 'later', day, board: shown() })) } continue }
    }
    if (!win) {
      if (o) out.push(line({ k: canSign(F, o.$) ? 'short' : 'cap', board: shown() }))
      continue
    }
    signWith(F, p, win)
    V[win.s] = teamRead(F, win.s)
    if (o) out.push(line({ k: win.mine ? 'won' : 'lost', to: win.s, $: p.$, y: p.y, board: shown(), ...(why && { why }) }))
  }
  F.fao = keep
  F.far = { d, list: out }
  return out
}
// The day ends: the decisions (settleDay); after the last day the league fills its holes
export function nextFADay(F) {
  const before = (F.fas ?? []).length
  settleDay(F)
  const signed = (F.fas ?? []).slice(before).map(x => x[0])
  F.fad++
  if (F.fad > FA_DAYS) { cpuFill(F); F.fad = null; F.fdd = null; F.fao = {}; return { done: true, signed } }
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
        const $ = Math.min(p.$, marketValue(p, F.year + 1, marketLines(F)))
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
