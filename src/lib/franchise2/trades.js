// FRANCHISE: trades (owner, 2026-11-19: "offers and requests but balanced and realistic. Draft picks can be included
// in most to aid in balance").
//
// THE WINDOW: the new league year (from re-signing on) through the draft, then the regular season up to the deadline
// after Week 9 (TRADE_DEADLINE: open until Week 10 is played). Never on draft night (the board has its own trades),
// never in the playoffs, never between the deadline and the new league year.
//
// WHAT A MAN IS WORTH (valueOf, in the trade value chart's points: No. 1 overall is 3,000, a late first about 600, a
// late second 270, a fourth about 60): his OVR on a curve that climbs fast at the top (a backup is worth next to
// nothing, a star a first-rounder or more), his spot (a quarterback 1.7, a pass rusher 1.15, a back 0.5), the prime he
// has left (a 24-year-old 1.15, a 30-year-old 0.65; quarterbacks four years later, backs two years sooner), a young
// man's upside, and his deal: the market's price against his cap hit over the years he's signed (a rookie deal is
// worth more, an overpaid veteran less; an expiring deal in the season is a rental).
// WHAT A PICK IS WORTH: the chart (draft.js pickValue) at the slot it should land: the real slot once the order is
// set, the standings and the team's strength before; next year's picks are drawn to the middle of the round and
// count 85%.
//
// WHAT A TEAM SEES (teamSide): the same values moved by its situation (sitOf: contending, in the mix, rebuilding) and
// its roster. A rebuilding club wants picks and youth and pays little for veterans; a contender pays for a veteran who
// starts and holds its own starters tight. A man who wouldn't start for it is worth a fraction (a backup 45%, a
// third-stringer 25%). A package of players counts the best one whole and the rest less (70%, 50%, 35%...): three
// backups never add up to a star. Every man over the roster's limit is a man it has to release.
//
// A DEAL (decide): a team takes it when what it gets beats what it gives by its margin (7%, at least the value of a
// fourth-round pick), more with every deal it's already made with the player's team this league year; it turns down
// what doesn't fit its cap (after the trade's dead money: the giving team's remaining signing bonus accelerates, as in
// the NFL), its starting quarterback without one coming back, a man it traded away this league year coming back, a man
// it just traded for going back out, and it stops taking calls after a few turned-down offers in a week.
// Short of its margin by a reachable amount, it counters: it asks for a pick, asks for a player it wants, or takes
// something off its side.
//
// OFFERS (tradeWeek, tradesAtDraft): the league's teams call now and then, more often in the three weeks before the
// deadline and when the draft opens: a team that needs one of the player's men offers picks for him, a rebuilding team
// shops a veteran who'd start for him. Every offer is one its team would accept (decide) and close to even on the
// gauge. A few trades a season between league teams (a rebuilding team's veteran to a contender for picks) go on the
// wire.
//
// State (all optional: a save from before trades loads with none):
//   F.tpk  { 'year-round-team': owner } a future pick that's changed hands (the draft's own order, F.dr.own, once it's set)
//   F.tro  [offer]  the offers to the player's team: { id, s, give: { pl, pk } (the player's side), get, k, w, exp }
//   F.trl  [deal]   the league year's trades: { ly, wk, ph, a, b, ag, bg (names), u (the player's team in it) }
//   F.trc  { team: [weekKey, turned down] } the calls a team has taken this week
//   p.tx   [team he was traded from, league year]
import { TEAM, SHORTS, MAX, foOf, strength } from './league'
import { TRADE_DEADLINE } from './season'
import { pickValue, draftOrder, draftDone } from './draft'
import { marketValue, marketLines, marketKey, capSheet, capYear, restOf53, minimumFor, cutMan } from './contracts'
import { committed } from './market'
import { depthChart, groupOf, GROUP, fixNumbers, startersOf } from './roster'
import { records, standings, pct } from './standings'
import { addNews } from './news'
import { rngOf, clamp, r1 } from './rng'

const REG = 18
export const TRADE_MAX = 5            // (assets a side)
const CALLS = 6                       // (turned-down proposals a team hears from the player's team in a week)
const DEALS_WITH = 3                  // (trades with the player's team a league year, a team)
const ROUND_WORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']
const nick = s => TEAM[s]?.nick ?? s

// ── The window ───────────────────────────────────────────────────────────────
// { open, why: what the screen says when it's shut, left: weeks to the deadline (the season) }
export function tradeWindow(F) {
  if (!F?.teams) return { open: false, why: '' }
  if (F.phase === 'season') {
    if (F.pend) return { open: false, why: 'Game in progress' }
    if (F.wk > TRADE_DEADLINE) return { open: false, why: 'The trade deadline has passed. Trades open again with the new league year.' }
    return { open: true, left: TRADE_DEADLINE - F.wk, season: true }
  }
  if (F.phase === 'off') {
    if (F.stage === 'coaches' || F.stage === 'awards') return { open: false, why: 'Trades open with the new league year, after the awards.' }
    if (F.dr && F.dr.ph === 'night' && !draftDone(F)) return { open: false, why: 'Draft night: trade up or down from the draft board.' }
    return { open: true, off: true }
  }
  if (F.phase === 'playoffs') return { open: false, why: 'No trades during the playoffs.' }
  return { open: false, why: 'Trades open again with the new league year.' }
}
// the league year a trade is filed in (the offseason is already next year's, as the cap is)
const lyOf = F => capYear(F)
// a window's key: the season's or the offseason's, so an offer never outlives the window it was made in
const winKey = F => `${F.phase === 'off' ? 'o' : 's'}${F.year}`

// ── Picks ────────────────────────────────────────────────────────────────────
// a pick's key: 'year-round-team' (the team it started with)
export const pickKey = (y, r, o) => `${y}-${r}-${o}`
export const parsePick = k => { const [y, r, o] = String(k).split('-'); return { y: +y, r: +r, o } }
// the two drafts whose picks can be traded: the next one and the one after (once this spring's draft is done, the
// two after it)
export function tradeYears(F) {
  const d = F.phase === 'off' && F.dr && draftDone(F) ? F.year + 2 : F.year + 1
  return [d, d + 1]
}
// the draft being run now (its order set, F.dr): this pick's slot in it
const liveSlot = (F, y, r, o) => (F.dr && y === F.year + 1 ? (r - 1) * 32 + F.dr.order.indexOf(o) : null)
export function ownerOf(F, key) {
  const { y, r, o } = parsePick(key)
  const k = liveSlot(F, y, r, o)
  if (k != null) return k < F.dr.at ? null : F.dr.own[k]
  return F.tpk?.[key] ?? o
}
function setOwner(F, key, s) {
  const { y, r, o } = parsePick(key)
  const k = liveSlot(F, y, r, o)
  if (k != null) { F.dr.own[k] = s; return }
  F.tpk ??= {}
  if (s === o) delete F.tpk[key]
  else F.tpk[key] = s
}
// (old keys go once their draft is past)
function prunePicks(F) {
  if (!F.tpk) return
  for (const k of Object.keys(F.tpk)) if (parsePick(k).y < F.year + 1 || (F.dr && parsePick(k).y === F.year + 1)) delete F.tpk[k]
}
// the draft opens (draft.js openDraft): the picks traded for it move to its order
export function applyPickTrades(F) {
  if (!F.dr || !F.tpk) return
  const y = F.year + 1
  for (const [key, s] of Object.entries(F.tpk)) {
    const p = parsePick(key)
    if (p.y !== y) continue
    const k = (p.r - 1) * 32 + F.dr.order.indexOf(p.o)
    if (k >= 0 && k < F.dr.own.length) F.dr.own[k] = s
    delete F.tpk[key]
  }
}
// every pick in the two tradeable drafts, by its owner now: { team: [key] }
export function picksBy(F) {
  const out = Object.fromEntries(SHORTS.map(s => [s, []]))
  for (const y of tradeYears(F)) for (let r = 1; r <= 7; r++) for (const o of SHORTS) {
    const key = pickKey(y, r, o), s = ownerOf(F, key)
    if (s) out[s].push(key)
  }
  return out
}
// where a team's pick should land in its round (0 the first pick): the order once it's known, the standings and the
// team's strength while the season's on
const ORDER = new WeakMap()
function projOrder(F) {
  const key = `${F.year}|${F.phase}|${F.wk}|${F.stage ?? ''}|${F.po?.rd ?? ''}`
  const c = ORDER.get(F)
  if (c?.key === key) return c.o
  let o
  if (F.phase !== 'season') o = draftOrder(F)
  else {
    const R = records(F)
    const ovr = Object.fromEntries(SHORTS.map(s => [s, strength(F, s).ovr]))
    const mean = SHORTS.reduce((a, s) => a + ovr[s], 0) / 32
    const proj = s => { const r = R[s], g = r.w + r.l + r.t, ex = clamp(0.15, 0.85, 0.5 + (ovr[s] - mean) * 0.035); return (r.w + r.t / 2 + ex * (17 - g)) / 17 }
    o = [...SHORTS].sort((a, b) => proj(a) - proj(b))
  }
  const idx = Object.fromEntries(o.map((s, i) => [s, i]))
  ORDER.set(F, { key, o: idx })
  return idx
}
export function pickSlot(F, key) {
  const { y, r, o } = parsePick(key)
  const live = liveSlot(F, y, r, o)
  if (live != null) return live
  const at = projOrder(F)[o] ?? 15.5
  const near = F.year + 1
  return (r - 1) * 32 + (y <= near ? at : 0.35 * at + 0.65 * 15.5)
}
export function pickWorth(F, key) {
  const { y } = parsePick(key)
  const near = F.dr && !draftDone(F) ? F.year + 1 : tradeYears(F)[0]
  return pickValue(pickSlot(F, key)) * (y > near ? 0.85 : 1)
}
// "2027 2nd round" · "2027 2nd round (LAR)" when it started with another team
export function pickText(F, key, owner = null) {
  const { y, r, o } = parsePick(key)
  const live = liveSlot(F, y, r, o)
  return `${y} ${['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][r - 1]} round${live != null ? ` · No. ${live + 1}` : ''}${owner && owner !== o ? ` (${o})` : ''}`
}
const pickWords = (key, giver) => { const { y, r, o } = parsePick(key); return o === giver ? `a ${y} ${ROUND_WORD[r - 1]}-round pick` : `the ${nick(o)}' ${y} ${ROUND_WORD[r - 1]}-round pick` }

// ── What a man is worth ──────────────────────────────────────────────────────
const POS_W = { qb: 1.7, edge: 1.15, ot: 1.05, wr: 1, cb: 0.95, dt: 0.85, te: 0.7, lb: 0.6, s: 0.6, og: 0.6, c: 0.55, rb: 0.5, k: 0.12 }
const AGE_F = [[23, 1.15], [24, 1.12], [25, 1.08], [26, 1.04], [27, 1], [28, 0.9], [29, 0.78], [30, 0.65], [31, 0.52], [32, 0.4], [33, 0.3]]
const AGE_SHIFT = { qb: 4, k: 6, rb: -2 }
function talent(o) {
  if (o <= 88) return Math.max(0, 10.7 * Math.exp((o - 70) / 3.9) - 12)
  // (past 88 the curve flattens: a 99 is worth about two late firsts more than an 88, not ten)
  return (10.7 * Math.exp(18 / 3.9) - 12) * Math.exp((o - 88) / 13.8)
}
function ageF(p) {
  let a = p.ag - (AGE_SHIFT[p.p] ?? 0)
  // (a man still at the top of his spot ages slower: two years)
  if (p.o >= 90 && a >= 28) a = Math.max(27, a - 2)
  return a <= 23 ? 1.15 : (AGE_F.find(([x]) => x === a)?.[1] ?? 0.2)
}
// years left on his deal for the league year being traded in (a man whose deal is up isn't tradeable)
const yearsOf = p => p.y ?? 0
function dealF(F, p) {
  const y = yearsOf(p)
  if (y <= 0) return 0
  const mv = marketValue(p, capYear(F), marketLines(F))
  const ratio = (mv - (p.$ ?? 0)) / Math.max(3, mv)
  let f = clamp(0.5, 1.3, 1 + ratio * 0.4 * Math.min(3, y) / 2)
  // (a deal that ends with this season: the rest of a season, then he's a free agent)
  if (y === 1) f *= F.phase === 'season' ? 0.5 + 0.5 * (REG - F.wk) / REG : 0.9
  return f
}
// his value on the chart's scale, to any team (the gauge's number)
export function valueOf(F, p) {
  if (!p) return 0
  const up = p.ag <= 24 ? clamp(0, 4, ((p.pk ?? p.o) - (p.hb ?? 0) - p.o) * 0.3) : 0
  return talent(p.o + up) * (POS_W[marketKey(p)] ?? 0.6) * ageF(p) * dealF(F, p)
}

// ── A team's situation ───────────────────────────────────────────────────────
// 'win' contending · 'mid' in the mix · 'reb' rebuilding: the season's record once it's four weeks old (with how
// good the roster is), the roster and last season's finish before that
const SIT = new WeakMap()
export function sitOf(F, s) {
  const key = `${F.year}|${F.phase}|${F.wk}|${F.stage ?? ''}`
  let c = SIT.get(F)
  if (c?.key !== key) {
    const ovr = SHORTS.map(x => [x, strength(F, x).ovr]).sort((a, b) => b[1] - a[1])
    const rank = Object.fromEntries(ovr.map(([x], i) => [x, i + 1]))
    const R = F.sched ? standings(F).R : null
    const m = {}
    for (const x of SHORTS) {
      const r = R?.[x], g = r ? r.w + r.l + r.t : 0
      const wp = g ? pct(r) : 0.5
      const live = F.phase === 'season' && g >= 4
      const sc = (live ? (wp - 0.5) * 2.2 : F.phase === 'off' && g ? (wp - 0.5) * 0.9 : 0) + (16.5 - rank[x]) / 16
      m[x] = sc >= 0.55 ? 'win' : sc <= -0.5 ? 'reb' : 'mid'
    }
    c = { key, m }
    SIT.set(F, c)
  }
  return c.m[s] ?? 'mid'
}
export const SIT_TEXT = { win: 'CONTENDING', mid: 'IN THE MIX', reb: 'REBUILDING' }

// ── Who can be traded ────────────────────────────────────────────────────────
// (a build is the player's own man and never on the table; a filler backup isn't a real asset; a man hurt for more
// than a week, a man whose deal is up, and a man on the re-sign list can't be moved)
export function tradeable(F, s, p) {
  if (!p || p.b != null || p.fl) return 'no'
  if (yearsOf(p) <= 0 || (s === F.team && (F.rs ?? []).includes(p.i))) return 'deal'
  if ((p.in ?? 0) > 1) return 'hurt'
  return null
}
const menOf = (F, s) => F.teams[s].r
const findMan = (F, s, id) => menOf(F, s).find(p => p.i === id)

// ── A team's side of a deal ──────────────────────────────────────────────────
// inn / out: { pl: [men], pk: [keys] } coming to / leaving team s. Returns { in, out, cost, gain, why (its biggest
// objection, for the screen) }
const PKG = [1, 0.7, 0.5, 0.35, 0.25]
function roomOf(F, s, g, gone) {
  return depthChart(F, s)[g].filter(x => !x.fl && !x.in && !gone.has(x.i)).map(x => x.o)
}
const recentTx = (F, p) => p.tx?.[2] === winKey(F) && (F.phase !== 'season' || F.wk - (p.tx[3] ?? 0) < 6)
function inValue(F, s, p, gone, sit) {
  const g = groupOf(p), n = GROUP[g].n
  const room = roomOf(F, s, g, gone)
  const ahead = room.filter(o => o > p.o).length
  const worst = room[n - 1] ?? 60
  let role = ahead < n ? 1 + clamp(0, 0.1, (p.o - worst) / 30) : ahead === n ? (g === 'qb' ? 0.3 : 0.45) : 0.25
  if (g === 'k') role = ahead < 1 ? 1 : 0.1
  let m = 1
  if (sit === 'reb') m = p.ag >= 29 ? 0.55 : p.ag >= 27 ? 0.8 : p.ag <= 25 ? 1.15 : 1
  else if (sit === 'win') m = p.ag >= 26 && ahead < n ? 1.1 : 1
  let v = valueOf(F, p) * role * m
  // (a man the player's team just traded for: the league knows what he cost, and nobody pays more than that for him
  // until the next window, or six weeks on in the season)
  if (p.tx?.[4] != null && s !== F.team && recentTx(F, p)) v = Math.min(v, p.tx[4] * 0.95)
  return { v, role, m }
}
function outValue(F, s, p, sit) {
  const g = groupOf(p), n = GROUP[g].n
  const room = depthChart(F, s)[g].filter(x => !x.fl && !x.in)
  const at = room.indexOf(p)
  const starts = at >= 0 && at < n
  const next = room[n]?.o ?? 60
  let m = 1
  if (sit === 'reb') m = p.ag >= 29 ? 0.65 : p.ag <= 25 ? 1.15 : 1
  else if (sit === 'win') m = starts ? 1.15 : 1
  if (starts && p.o - next >= 5 && s !== F.team) m *= 1.1
  if (p.o >= 90 && p.ag <= 27) m *= 1.3   // (a cornerstone)
  return valueOf(F, p) * m * (starts || s === F.team ? 1 : 0.85)
}
const pickMod = sit => (sit === 'reb' ? 1.12 : sit === 'win' ? 0.95 : 1)
export function teamSide(F, s, inn, out) {
  const sit = s === F.team ? 'mid' : sitOf(F, s)
  const gone = new Set(out.pl.map(p => p.i))
  const ins = inn.pl.map(p => ({ p, ...inValue(F, s, p, gone, sit) })).sort((a, b) => b.v - a.v)
  const vIn = ins.reduce((a, x, j) => a + x.v * (PKG[j] ?? 0.2), 0) + inn.pk.reduce((a, k) => a + pickWorth(F, k) * pickMod(sit), 0)
  const vOut = out.pl.reduce((a, p) => a + outValue(F, s, p, sit), 0) + out.pk.reduce((a, k) => a + pickWorth(F, k) * pickMod(sit), 0)
  // the roster: every man over the limit at a spot is a man released (his value and a little more)
  // (in the season: the offseason's camp rosters are cut down before Week 1, offseason.js newSeason)
  let cost = 0
  if (F.phase === 'season') for (const pos of new Set(inn.pl.map(p => p.p))) {
    const have = menOf(F, s).filter(p => p.p === pos && !p.fl && !gone.has(p.i)).length + inn.pl.filter(p => p.p === pos).length
    const over = have - Math.max(MAX[pos], menOf(F, s).filter(p => p.p === pos && !p.fl).length)
    if (over > 0) {
      const low = menOf(F, s).filter(p => p.p === pos && !p.fl && p.b == null && !gone.has(p.i)).sort((a, b) => a.o - b.o).slice(0, over)
      cost += low.reduce((a, p) => a + valueOf(F, p) * 0.5 + 10, 0)
    }
  }
  cost += Math.max(0, inn.pl.length - out.pl.length) * 8
  // its biggest objection to what's coming: a backup for it, a veteran for a rebuilding club
  const why = ins.length && ins[0].role < 0.5 ? 'set' : sit === 'reb' && ins.some(x => x.m < 0.7) ? 'reb' : null
  return { in: vIn, out: vOut, cost, gain: vIn - vOut - cost, sit, why, ins }
}

// ── The cap after a trade ────────────────────────────────────────────────────
// the giver's remaining signing bonus on his deal accelerates onto its cap (dead money); the new team carries the
// rest of his cap hit
const deadOn = p => r1((p.g ?? 0) * Math.max(1, yearsOf(p)))
const hitAfter = p => r1(Math.max(minimumFor(p.ag, 2026), (p.$ ?? 0) - (p.g ?? 0)))
// (a filler in an incoming man's room leaves the roster as he arrives, moveMan: his deal off, his spot filled)
function fillersOut(F, s, inMen) {
  const out = []
  for (const p of inMen) { const fl = menOf(F, s).find(x => x.fl && x.p === p.p && groupOf(x) === groupOf(p) && !out.includes(x)); if (fl) out.push(fl) }
  return out
}
export function capAfter(F, s, outMen, inMen, cut = []) {
  const c = capSheet(F, s)
  // (NO SALARY CAP, rules.js: the player's team has no room to count)
  if (c.nocap) return { before: 0, after: 0, nocap: true }
  const fl = fillersOut(F, s, inMen).filter(p => p.y > 0)
  const pay = c.pay - [...outMen, ...cut, ...fl].reduce((a, p) => a + (p.$ ?? 0), 0) + inMen.reduce((a, p) => a + hitAfter(p), 0)
  // (the bonus left on every man who goes, traded or released: the screen shows it, each man's and the total)
  const deadBy = [...outMen, ...cut].map(p => ({ p, d: deadOn(p) })).filter(x => x.d > 0)
  const dead = c.dead + deadBy.reduce((a, x) => a + x.d, 0)
  const n = menOf(F, s).filter(p => p.y > 0).length - outMen.length - cut.length - fl.length + inMen.length
  const rest = restOf53(n, c.year)
  const extra = s === F.team && F.phase === 'off' && F.stage === 'fa' ? committed(F) : 0
  return { before: r1(c.room - extra), after: r1(c.cap - pay - dead - rest - extra), dead: r1(dead - c.dead), deadBy }
}
const capOk = x => x.after >= 0 || x.after >= x.before - 1e-9

// ── A deal: is it legal, and does the other team take it ─────────────────────
// give: what the player's team sends { pl: [ids], pk: [keys] }; get: what team s sends
function resolve(F, s, give, get) {
  const gm = (give.pl ?? []).map(id => findMan(F, F.team, id)), tm = (get.pl ?? []).map(id => findMan(F, s, id))
  return { gm, tm, gk: [...(give.pk ?? [])], tk: [...(get.pk ?? [])] }
}
// the player's side first: { ok, why, text }
export function checkTrade(F, s, give, get) {
  const W = tradeWindow(F)
  if (!W.open) return { ok: false, why: 'shut', text: W.why }
  if (!s || s === F.team || !TEAM[s]) return { ok: false, why: 'team', text: 'Pick a team' }
  const { gm, tm, gk, tk } = resolve(F, s, give, get)
  if (gm.length + gk.length + tm.length + tk.length === 0) return { ok: false, why: 'empty', text: 'Add players or picks' }
  if (gm.length + gk.length > TRADE_MAX || tm.length + tk.length > TRADE_MAX) return { ok: false, why: 'many', text: `${TRADE_MAX} players and picks a side at most` }
  if (gm.some(p => !p || tradeable(F, F.team, p)) || tm.some(p => !p || tradeable(F, s, p))) return { ok: false, why: 'gone', text: 'A player in the deal can\'t be traded now' }
  if (gk.some(k => ownerOf(F, k) !== F.team) || tk.some(k => ownerOf(F, k) !== s)) return { ok: false, why: 'gone', text: 'A pick in the deal has changed hands' }
  if (new Set(gk).size !== gk.length || new Set(tk).size !== tk.length) return { ok: false, why: 'gone', text: 'A pick is in the deal twice' }
  // the player's roster in the season: a spot past its limit releases its lowest-rated man (the screen names him; a
  // build is never the one)
  const cut = releasesFor(F, F.team, gm, tm)
  if (cut == null) return { ok: false, why: 'roster', text: `No room on the ${nick(F.team)} roster at that spot` }
  const cap = capAfter(F, F.team, gm, tm, cut)
  if (!F.noCap && !capOk(cap)) return { ok: false, why: 'ucap', text: `The ${nick(F.team)} would be $${r1(-cap.after)}M over the cap`, cap, cut }
  return { ok: true, cap, cut }
}
// what the trades this league year say about the player's team and team s
const dealsWith = (F, s) => (F.trl ?? []).filter(d => d.ly === lyOf(F) && d.u && (d.a === s || d.b === s)).length
const dealsAll = F => (F.trl ?? []).filter(d => d.ly === lyOf(F) && d.u).length
const weekKey = F => `${winKey(F)}-${F.phase === 'off' ? F.stage : F.wk}`
const callsLeft = (F, s) => { const c = F.trc?.[s]; return c && c[0] === weekKey(F) ? CALLS - c[1] : CALLS }
// the margin team s wants on a deal with the player's team
// (7% of what it gives; on a small deal a few points more, never more than a quarter of what it gives: a sixth for a
// sixth and a seventh is a deal, not a 25-point ask)
function marginOf(F, s, out) {
  return Math.max(Math.min(25, 4 + out * 0.25), out * 0.07) * (1 + 0.6 * dealsWith(F, s) + 0.1 * dealsAll(F))
}
// what the player's team sends, the league's way (the gauge), with a man it just traded for counted at what he cost
// (the flip pricing, as inValue has it)
function fairIn(F, s, gm, gk) {
  const v = gm.map(p => { const x = valueOf(F, p); return p.tx?.[4] != null && recentTx(F, p) ? Math.min(x, p.tx[4] * 0.95) : x })
  return pkgOf(v) + gk.reduce((a, k) => a + pickWorth(F, k), 0)
}
// team s on the deal: { ok, why, short (the value it's missing), side (teamSide) }
export function decide(F, s, give, get, { user = true } = {}) {
  const { gm, tm, gk, tk } = resolve(F, s, give, get)
  const ly = lyOf(F)
  if (user && dealsWith(F, s) >= DEALS_WITH) return { ok: false, why: 'done' }
  if (gm.some(p => p.tx?.[0] === s && p.tx[1] === ly)) return { ok: false, why: 'back', who: gm.find(p => p.tx?.[0] === s && p.tx[1] === ly) }
  if (tm.some(p => p.tx && p.tx[1] === ly)) return { ok: false, why: 'new', who: tm.find(p => p.tx && p.tx[1] === ly) }
  // its starting quarterback goes only for a quarterback back, or out of a rebuild once he's 30
  const qb1 = startersOf(F, s).qb1
  if (qb1 && tm.includes(qb1) && !gm.some(p => p.p === 'qb' && p.o >= qb1.o - 3) && !(sitOf(F, s) === 'reb' && qb1.ag >= 30)) return { ok: false, why: 'qb', who: qb1 }
  const cut = releasesFor(F, s, tm, gm)
  if (cut == null) return { ok: false, why: 'cap' }
  // (NO SALARY CAP: a deal with the player's team isn't stopped by money, either side's; the league's own trades are)
  const cap = capAfter(F, s, tm, gm, cut)
  if (!(user && F.noCap) && !capOk(cap)) return { ok: false, why: 'cap' }
  const side = teamSide(F, s, { pl: gm, pk: gk }, { pl: tm, pk: tk })
  if (side.in <= 1) return { ok: false, why: 'nothing', side, short: Infinity }
  // a front-line player goes only for a real piece back: one player or pick worth at least half of him, never a pile
  // of backups (the best of what comes back, as this team sees it)
  if (user) {
    const sit = side.sit, top = Math.max(0, ...tm.map(p => outValue(F, s, p, sit)))
    const best = Math.max(0, ...side.ins.map(x => x.v), ...gk.map(k => pickWorth(F, k) * pickMod(sit)))
    if (top >= 120 && best < top * 0.5) return { ok: false, why: 'star', side, short: Infinity, who: tm.sort((a, b) => b.o - a.o)[0] }
  }
  const need = user ? marginOf(F, s, side.out) : Math.max(10, side.out * 0.03)
  let short = need - side.gain
  // what the player's team sends already worth more than what it asks for, by the league's values: the team takes it,
  // or asks for a little more (5% of what it gives), whatever its own needs say (a backup for it, a veteran for a
  // rebuild): a club trades a fourth for a man it can use, it doesn't ask for a third on top
  const fair = user ? { in: fairIn(F, s, gm, gk), out: gauge(F, s, give, get).get } : null
  if (fair && fair.in >= fair.out && short > 0) short = Math.min(short, fair.out + Math.max(2, fair.out * 0.05) - fair.in)
  return { ok: short <= 0, why: short <= 0 ? 'yes' : side.why ?? 'short', short, side, need, fair }
}
// what team s says, the way a front office puts it to a beat writer
export function sayOf(F, s, d, counter = false) {
  const N = nick(s), me = nick(F.team), who = d.who?.n
  if (d.ok) return `The ${N} accept. The deal is done.`
  if (counter) return `The ${N} came back with a counter.`
  switch (d.why) {
    case 'done': return `The ${N} are done dealing with the ${me} this year.`
    case 'back': return `The ${N} traded ${who} away this year. They won't take him back.`
    case 'new': return `The ${N} just traded for ${who}. He isn't going anywhere.`
    case 'qb': return `The ${N} aren't moving their starting quarterback.`
    case 'cap': return `The ${N} can't fit the money under the cap.`
    case 'calls': return `The ${N} have stopped taking calls this week.`
    case 'nothing': return `The ${N} want something back.`
    case 'star': return `The ${N} want a front-line player or a high pick for ${who}, not depth.`
    case 'set': return `The ${N} are set at that spot. Not enough value coming back.`
    case 'reb': return `The ${N} are rebuilding. They want picks and young players, not veterans.`
    default: return d.short <= (d.need ?? 30) * 1.5 ? `The ${N} want a little more.` : `The ${N} say the offer isn't close.`
  }
}

// ── A counter ────────────────────────────────────────────────────────────────
// within reach: one of the player's picks added (the cheapest that covers it), one of his picks moved up for a later
// one, one of his men the team wants, one of its picks swapped for a later one of its own (it trades down), or
// something taken off its own side. The one that moves the gauge least for the player, and never more than it
// takes: what it costs him (the gauge) closes the gap (the team's shortfall, with room for the step between picks)
// and nothing more, is never more than what he asked for is worth, adds no pick higher than the best one he's
// getting, and when his side was already worth more by the league's values it's a small add at most.
export const COUNTER_SMALL = 20       // (about a sixth-round pick: the most a counter adds on a deal he already wins)
export function counterLimit(d, base) {
  const short = Math.max(0, d.short)
  let lim = Math.min(base.get, short * 1.25 + COUNTER_SMALL)
  if (base.give >= base.get) lim = Math.min(lim, COUNTER_SMALL)
  return lim
}
export function counterOf(F, s, give, get, d) {
  if (!d.side || !(d.short > 0) || d.short > Math.max(400, d.side.out * 0.8)) return null
  if (d.why !== 'short' && d.why !== 'set' && d.why !== 'reb') return null
  const base = gauge(F, s, give, get)
  const lim = counterLimit(d, base)
  if (!(lim > 0)) return null
  const tries = []
  const gp = give.pk ?? [], gl = give.pl ?? [], tp = get.pk ?? [], tl = get.pl ?? []
  const n = gl.length + gp.length
  // (the best round coming back: no pick added or moved up past it)
  const top = Math.min(8, ...tp.map(k => parsePick(k).r))
  const mine = picksBy(F)[F.team].filter(k => !gp.includes(k) && parsePick(k).r >= (tp.length ? top : 1))
  const w = k => pickWorth(F, k)
  if (n < TRADE_MAX) {
    for (const k of mine) if (w(k) <= lim) tries.push({ give: { pl: [...gl], pk: [...gp, k] }, get })
    const gone = new Set(gl)
    const men = menOf(F, F.team).filter(p => !gone.has(p.i) && !tradeable(F, F.team, p) && p.o >= 72 && valueOf(F, p) <= lim).sort((a, b) => valueOf(F, a) - valueOf(F, b)).slice(0, 14)
    for (const p of men) tries.push({ give: { pl: [...gl, p.i], pk: [...gp] }, get })
  }
  // one of his picks for a better one of his
  for (const k of gp) for (const k2 of mine) if (w(k2) > w(k) && w(k2) - w(k) <= lim) tries.push({ give: { pl: [...gl], pk: gp.map(x => (x === k ? k2 : x)) }, get })
  // one of its picks for a later one of its own
  const theirs = picksBy(F)[s].filter(k => !tp.includes(k))
  for (const k of tp) for (const k2 of theirs) if (w(k2) < w(k) && w(k) - w(k2) <= lim) tries.push({ give, get: { pl: [...tl], pk: tp.map(x => (x === k ? k2 : x)) } })
  if (tl.length + tp.length >= 2) {
    for (const id of tl) tries.push({ give, get: { pl: tl.filter(x => x !== id), pk: [...tp] } })
    for (const k of tp) tries.push({ give, get: { pl: [...tl], pk: tp.filter(x => x !== k) } })
  }
  // (a counter never leaves him sending a higher pick than the best he gets back, when he didn't ask for that)
  const upside = x => { const a = Math.min(8, ...(x.give.pk ?? []).map(k => parsePick(k).r)), b = Math.min(8, ...(x.get.pk ?? []).map(k => parsePick(k).r)); return (x.get.pk ?? []).length > 0 && a < b }
  const was = upside({ give, get })
  let best = null
  for (const t of tries) {
    if (!was && upside(t)) continue
    const g = gauge(F, s, t.give, t.get)
    const moved = (g.give - base.give) + (base.get - g.get)
    if (moved > lim + 1e-9 || (best && moved >= best.moved)) continue
    if (!checkTrade(F, s, t.give, t.get).ok || !decide(F, s, t.give, t.get).ok) continue
    best = { ...t, moved }
  }
  return best ? { give: best.give, get: best.get } : null
}

// ── The gauge ────────────────────────────────────────────────────────────────
// the value each side sends, the league's way (no team's needs in it): a package counted as a team would
// { give, get, lean: -1 (the player's team gives far more) .. 1 (it gets far more) }
const pkgOf = vals => [...vals].sort((a, b) => b - a).reduce((a, v, j) => a + v * (PKG[j] ?? 0.2), 0)
export function gauge(F, s, give, get) {
  const { gm, tm, gk, tk } = resolve(F, s, give, get)
  const g = pkgOf(gm.filter(Boolean).map(p => valueOf(F, p))) + gk.reduce((a, k) => a + pickWorth(F, k), 0)
  const t = pkgOf(tm.filter(Boolean).map(p => valueOf(F, p))) + tk.reduce((a, k) => a + pickWorth(F, k), 0)
  const lean = g + t > 0 ? clamp(-1, 1, (t - g) / Math.max(g, t, 40)) : 0
  return { give: g, get: t, lean }
}
export const leanText = (F, s, lean) => (Math.abs(lean) < 0.08 ? 'EVEN' : `${lean > 0 ? nick(F.team) : nick(s)} ${Math.abs(lean) >= 0.35 ? 'WIN BIG' : 'COME OUT AHEAD'}`.toUpperCase())

// ── Making a trade ───────────────────────────────────────────────────────────
function moveMan(F, from, to, p, ly, paid = null) {
  const t = F.teams[from], u = F.teams[to]
  const dead = deadOn(p)
  t.r = t.r.filter(x => x !== p)
  if (dead > 0) (t.dead ??= []).push([p.n, dead])
  // (the new team carries his salary; the bonus was the old team's)
  const g = p.g ?? 0
  if (g > 0) {
    p.$ = hitAfter(p)
    if (Array.isArray(p.sc)) p.sc = p.sc.map(v => r1(Math.max(minimumFor(p.ag, 2026), v - g)))
    p.g = 0
  }
  p.tx = [from, ly, winKey(F), F.wk ?? 0, ...(paid != null ? [Math.round(paid)] : [])]
  // (a filler in his room goes: he's the backup now)
  const fl = u.r.find(x => x.fl && x.p === p.p && groupOf(x) === groupOf(p))
  if (fl) u.r = u.r.filter(x => x !== fl)
  u.r.push(p)
}
// In the season, a spot past its limit after a trade releases its lowest-rated men there (never a build, never a
// man in the trade); only the spots the trade adds to, and never below what the team carried before it. The
// offseason's camp rosters are cut down before Week 1 (offseason.js newSeason). Returns the men, or null when a
// spot can't be brought back under (only builds left to release).
export function releasesFor(F, s, outMen, inMen) {
  if (F.phase !== 'season') return []
  const gone = new Set(outMen.map(p => p.i)), out = []
  for (const pos of new Set(inMen.map(p => p.p))) {
    const now = menOf(F, s).filter(p => p.p === pos && !p.fl).length
    const stay = menOf(F, s).filter(p => p.p === pos && !p.fl && !gone.has(p.i))
    const over = stay.length + inMen.filter(p => p.p === pos).length - Math.max(MAX[pos], now)
    if (over <= 0) continue
    const low = stay.filter(p => p.b == null).sort((a, b) => a.o - b.o).slice(0, over)
    if (low.length < over) return null
    out.push(...low)
  }
  return out
}
// a list the way the wire writes it: "WR Garrett Wilson, a 2027 second-round pick and a 2028 fifth-round pick"
const POS_TXT = p => (p.p === 'ol' ? (p.s ?? 'OL') : p.p === 'dl' || p.p === 'db' ? GROUP[groupOf(p)].label : p.p.toUpperCase())
const andList = a => (a.length <= 1 ? a[0] ?? '' : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)
export function tradeLine(F, a, b, aMen, aPk, bMen, bPk) {
  const got = andList([...bMen.map(p => `${POS_TXT(p)} ${p.n}`), ...bPk.map(k => pickWords(k, b))])
  const gave = andList([...aMen.map(p => `${POS_TXT(p)} ${p.n}`), ...aPk.map(k => pickWords(k, a))])
  if (!gave) return `${nick(a)} acquire ${got} from the ${nick(b)}`
  if (!got) return `${nick(a)} send ${gave} to the ${nick(b)}`
  return `${nick(a)} acquire ${got} from the ${nick(b)} for ${gave}`
}
// the trade itself: team a sends aGive, team b sends bGive ({ pl: men, pk: keys })
function execute(F, a, b, aMen, aPk, bMen, bPk, user) {
  const ly = lyOf(F)
  const line = tradeLine(F, a, b, aMen, aPk, bMen, bPk)
  // (what each side sent, the league's way, as it stood: the headless checks read it)
  const gv = [aMen, bMen].map((m, j) => Math.round(pkgOf(m.map(p => valueOf(F, p))) + (j ? bPk : aPk).reduce((x, k) => x + pickWorth(F, k), 0)))
  const cutA = releasesFor(F, a, aMen, bMen) ?? [], cutB = releasesFor(F, b, bMen, aMen) ?? []
  // (what the player's team paid for each man it gets: its side's value, shared by what each man is worth)
  const paidFor = (men, pk, sent) => { const vals = men.map(p => valueOf(F, p)), tot = vals.reduce((x, v) => x + v, 0) + pk.reduce((x, k) => x + pickWorth(F, k), 0); return vals.map(v => (tot > 0 ? sent * v / tot : 0)) }
  const paidB = b === F.team ? paidFor(aMen, aPk, gv[1]) : [], paidA = a === F.team ? paidFor(bMen, bPk, gv[0]) : []
  aMen.forEach((p, j) => moveMan(F, a, b, p, ly, paidB[j] ?? null))
  bMen.forEach((p, j) => moveMan(F, b, a, p, ly, paidA[j] ?? null))
  for (const k of aPk) setOwner(F, k, b)
  for (const k of bPk) setOwner(F, k, a)
  // (the men released to make room: on the street, where any team can sign them)
  for (const [s, men] of [[a, cutA], [b, cutB]]) for (const p of men) { const c = cutMan(F, p.i, s); if (c && F.phase !== 'off') (F.fa ??= []).push(p) }
  for (const s of [a, b]) { try { fixNumbers(F, s) } catch { /* (a number is cosmetic) */ } }
  F.trl = [...(F.trl ?? []).filter(d => d.ly >= ly - 1), { ly, y: F.year, wk: F.wk, ph: F.phase, a, b, ag: aMen.map(p => p.n), bg: bMen.map(p => p.n), ak: aPk, bk: bPk, gv, t: line, ...(user && { u: 1 }) }]
  const big = [...aMen, ...bMen].some(p => p.o >= 88) || [...aPk, ...bPk].some(k => parsePick(k).r === 1)
  addNews(F, { k: 'trade', tag: 'TRADE', s: a, text: line, ...((big || user) && { big: true }) })
  // (the offers that leaned on any of it are off the table)
  prunePicks(F)
  F.tro = (F.tro ?? []).filter(o => offerValid(F, o))
  return line
}

// ── The player proposes ──────────────────────────────────────────────────────
// { ok (the trade is done), say ('yes' | 'no' | 'counter' | 'bad'), text, counter: { give, get } }
export function proposeTrade(F, s, give, get) {
  const c = checkTrade(F, s, give, get)
  if (!c.ok) return { ok: false, say: 'bad', text: c.text }
  if (callsLeft(F, s) <= 0) return { ok: false, say: 'no', text: sayOf(F, s, { why: 'calls' }) }
  const d = decide(F, s, give, get)
  if (d.ok) {
    const { gm, tm, gk, tk } = resolve(F, s, give, get)
    const line = execute(F, F.team, s, gm, gk, tm, tk, true)
    return { ok: true, say: 'yes', text: sayOf(F, s, d), line }
  }
  // (a turned-down call counts against the week's)
  const wk = weekKey(F), was = F.trc?.[s]
  F.trc = { ...(F.trc ?? {}), [s]: [wk, was && was[0] === wk ? was[1] + 1 : 1] }
  const ct = counterOf(F, s, give, get, d)
  if (ct) return { ok: false, say: 'counter', text: sayOf(F, s, d, true), counter: ct, why: d.why }
  return { ok: false, say: 'no', text: sayOf(F, s, d), why: d.why }
}
// The week's trade call (season.js tradeEvent: a starter of theirs for one of the player's at his spot): one man for
// one, legal for both books (the player's cap and roster, the other team's cap) and made the way any trade is (dead
// money, the wire, the league year's count). eventTradeOk: can it be made now; eventTrade: make it (the line, or null)
function eventSides(F, s, giveId, getId) {
  const give = { pl: [giveId], pk: [] }, get = { pl: [getId], pk: [] }
  if (!checkTrade(F, s, give, get).ok) return null
  const { gm, tm } = resolve(F, s, give, get)
  const cut = releasesFor(F, s, tm, gm)
  if (cut == null || (!F.noCap && !capOk(capAfter(F, s, tm, gm, cut)))) return null
  return { gm, tm }
}
export const eventTradeOk = (F, s, giveId, getId) => !!eventSides(F, s, giveId, getId)
export function eventTrade(F, s, giveId, getId) {
  const x = eventSides(F, s, giveId, getId)
  return x ? execute(F, F.team, s, x.gm, [], x.tm, [], true) : null
}
// the player takes the team's counter (or an offer): made if it still stands
export function acceptDeal(F, s, give, get) {
  const c = checkTrade(F, s, give, get)
  if (!c.ok) return { ok: false, text: c.text }
  const d = decide(F, s, give, get)
  if (!d.ok) return { ok: false, text: sayOf(F, s, d) }
  const { gm, tm, gk, tk } = resolve(F, s, give, get)
  return { ok: true, line: execute(F, F.team, s, gm, gk, tm, tk, true) }
}

// ── Offers from the league ───────────────────────────────────────────────────
function offerValid(F, o) {
  if (!o || o.w !== winKey(F) || !tradeWindow(F).open) return false
  if (F.phase === 'season' && o.exp != null && F.wk >= o.exp) return false
  return checkTrade(F, o.s, o.give, o.get).ok && decide(F, o.s, o.give, o.get).ok
}
export function tradeOffers(F) {
  const all = F.tro ?? []
  const ok = all.filter(o => offerValid(F, o))
  if (ok.length !== all.length) F.tro = ok
  return ok
}
export function answerOffer(F, id, yes) {
  const o = (F.tro ?? []).find(x => x.id === id)
  F.tro = (F.tro ?? []).filter(x => x.id !== id)
  if (!o || !yes) return { ok: !yes }
  return acceptDeal(F, o.s, o.give, o.get)
}
// the best few picks of a team that add up to about `want` (its own value of them), never more than three
function picksFor(F, s, want, sit, avoid = []) {
  const pk = picksBy(F)[s].filter(k => !avoid.includes(k)).map(k => [k, pickWorth(F, k) * pickMod(sit)]).sort((a, b) => b[1] - a[1])
  let best = null
  const consider = ks => { const v = ks.reduce((a, k) => a + pk.find(x => x[0] === k)[1], 0); if (v <= want && (!best || v > best.v)) best = { ks, v } }
  const top = pk.slice(0, 12)
  for (let i = 0; i < top.length; i++) {
    consider([top[i][0]])
    for (let j = i + 1; j < top.length; j++) {
      consider([top[i][0], top[j][0]])
      for (let k = j + 1; k < Math.min(top.length, j + 5); k++) consider([top[i][0], top[j][0], top[k][0]])
    }
  }
  return best
}
// the fewest picks of a team that cover `want` (the ones worth least, past it)
function picksCover(F, s, want, valueTo) {
  const pk = picksBy(F)[s].map(k => [k, valueTo(k)]).sort((a, b) => a[1] - b[1])
  let best = null
  const consider = ks => { const v = ks.reduce((a, k) => a + pk.find(x => x[0] === k)[1], 0); if (v >= want && (!best || v < best.v)) best = { ks, v } }
  const top = pk.slice(-12)
  for (let i = 0; i < top.length; i++) {
    consider([top[i][0]])
    for (let j = i + 1; j < top.length; j++) { consider([top[i][0], top[j][0]]); for (let k = j + 1; k < top.length; k++) consider([top[i][0], top[j][0], top[k][0]]) }
  }
  return best
}
// one offer from team s to the player's team (or null): it wants one of his men (buy), or shops a veteran (sell)
function makeOffer(F, s, R) {
  const sit = sitOf(F, s)
  const mine = menOf(F, F.team).filter(p => !tradeable(F, F.team, p) && p.o >= 77)
  if (sit !== 'reb' && R.u() < 0.65) {
    // BUY: the man who'd help it most, for picks it values at what he's worth to it, less its margin
    const opts = mine.map(p => ({ p, d: inValue(F, s, p, new Set(), sit) })).filter(x => x.d.role >= 1 && x.d.v >= 50).sort((a, b) => b.d.v - a.d.v).slice(0, 4)
    for (const { p } of R.shuffle(opts)) {
      const give = { pl: [p.i], pk: [] }
      const side0 = teamSide(F, s, { pl: [p], pk: [] }, { pl: [], pk: [] })
      const want = side0.gain - marginOf(F, s, side0.in * 0.9) * 1.05
      const got = picksFor(F, s, want, sit)
      if (!got) continue
      const get = { pl: [], pk: got.ks }
      if (!checkTrade(F, s, give, get).ok || !decide(F, s, give, get).ok) continue
      const g = gauge(F, s, give, get)
      if (g.get < g.give * 0.8) continue
      return { k: 'buy', give, get, pid: p.i }
    }
    return null
  }
  // SELL: a veteran who'd start for the player's team, for picks
  const C = depthChart(F, F.team)
  const theirs = menOf(F, s).filter(p => !tradeable(F, s, p) && p.o >= 79 && p.ag >= 27 && p.p !== 'k' && !(p.tx && p.tx[1] === lyOf(F)))
    .filter(p => { const g = groupOf(p), n = GROUP[g].n, room = C[g].filter(x => !x.fl && !x.in); return (room[n - 1]?.o ?? 60) <= p.o - 2 })
    .sort((a, b) => b.o - a.o).slice(0, 4)
  for (const p of R.shuffle(theirs)) {
    const get = { pl: [p.i], pk: [] }
    const side0 = teamSide(F, s, { pl: [], pk: [] }, { pl: [p], pk: [] })
    const need = -side0.gain + marginOf(F, s, side0.out) * 1.05
    const cov = picksCover(F, F.team, need, k => pickWorth(F, k) * pickMod(sit))
    if (!cov) continue
    const give = { pl: [], pk: cov.ks }
    if (!checkTrade(F, s, give, get).ok || !decide(F, s, give, get).ok) continue
    const g = gauge(F, s, give, get)
    if (g.give > g.get * 1.3) continue
    return { k: 'sell', give, get, pid: p.i }
  }
  return null
}
function addOffer(F, R, n = 1) {
  const cur = tradeOffers(F)
  let made = 0
  const teams = R.shuffle(SHORTS.filter(s => s !== F.team && !cur.some(o => o.s === s) && dealsWith(F, s) < DEALS_WITH))
  for (const s of teams.slice(0, 8)) {
    if (cur.length + made >= 3 || made >= n) break
    const o = makeOffer(F, s, R)
    // (one call about a man at a time)
    if (!o || [...cur, ...(F.tro ?? [])].some(x => x.pid === o.pid)) continue
    F.nto = (F.nto ?? 0) + 1
    // (in the season an offer stands two weeks, or to the deadline; LIGHT plays weeks six at a time: to the deadline)
    const exp = F.phase === 'season' ? (F.pace === 'light' ? TRADE_DEADLINE + 1 : Math.min(TRADE_DEADLINE + 1, F.wk + 2)) : null
    F.tro = [...(F.tro ?? []), { id: F.nto, s, ...o, w: winKey(F), ...(exp != null && { exp }), wk: F.wk }]
    made++
  }
  return made
}

// ── Trades between league teams ──────────────────────────────────────────────
// a rebuilding club's veteran to a contender that needs him, for picks (both sides by their own book)
export function leagueTrade(F, R) {
  const sellers = R.shuffle(SHORTS.filter(s => s !== F.team && sitOf(F, s) === 'reb'))
  const buyers = SHORTS.filter(s => s !== F.team && sitOf(F, s) === 'win')
  for (const a of sellers.slice(0, 6)) {
    const vets = menOf(F, a).filter(p => !tradeable(F, a, p) && p.o >= 79 && p.ag >= 28 && p.p !== 'k' && !(p.tx && p.tx[1] === lyOf(F)) && startersOf(F, a).qb1 !== p)
    for (const p of R.shuffle(vets).slice(0, 3)) {
      for (const b of R.shuffle(buyers).slice(0, 6)) {
        const sideB = teamSide(F, b, { pl: [p], pk: [] }, { pl: [], pk: [] })
        if (sideB.ins[0]?.role < 1) continue
        const cut = releasesFor(F, b, [], [p])
        if (cut == null || !capOk(capAfter(F, b, [], [p], cut)) || !capOk(capAfter(F, a, [p], []))) continue
        const sideA = teamSide(F, a, { pl: [], pk: [] }, { pl: [p], pk: [] })
        const cov = picksCover(F, b, -sideA.gain + Math.max(15, sideA.out * 0.05), k => pickWorth(F, k) * pickMod('reb'))
        if (!cov) continue
        const dB = teamSide(F, b, { pl: [p], pk: [] }, { pl: [], pk: cov.ks })
        if (dB.gain < Math.max(10, dB.out * 0.03)) continue
        // (never a give-away the league would laugh at, either way)
        const vp = valueOf(F, p), vk = cov.ks.reduce((x, k) => x + pickWorth(F, k), 0)
        if (vk < vp * 0.7 || vp < vk * 0.7) continue
        execute(F, b, a, [], cov.ks, [p], [], false)
        return true
      }
    }
  }
  return false
}

// ── The hooks ────────────────────────────────────────────────────────────────
// a week of the regular season is done (season.js endWeek, F.wk the weeks played): the calls and the league's deals,
// more of both as the deadline nears
export function tradeWeek(F) {
  if (F.phase !== 'season') return
  prunePicks(F)
  tradeOffers(F)
  if (F.wk > TRADE_DEADLINE || F.wk < 1) return
  const R = rngOf(`${F.seed}-${F.year}-trades-${F.wk}`)
  const late = F.wk >= TRADE_DEADLINE - 2
  if (R.u() < (late ? 0.5 : 0.18)) addOffer(F, R, late && R.u() < 0.4 ? 2 : 1)
  if (R.u() < (late ? 0.5 : 0.18)) leagueTrade(F, R)
}
// the draft opens (draft.js openDraft): the traded picks into its order, then the calls a draft brings
export function tradesAtDraft(F) {
  applyPickTrades(F)
  prunePicks(F)
  F.tro = []
  const R = rngOf(`${F.seed}-${F.year}-trades-draft`)
  addOffer(F, R, R.u() < 0.6 ? 2 : 1)
  if (R.u() < 0.8) leagueTrade(F, R)
  if (R.u() < 0.4) leagueTrade(F, R)
}
// the screen's list of teams: { s, sit, rec, room }
export function tradeTeams(F) {
  const R = F.sched ? records(F) : null
  return SHORTS.filter(s => s !== F.team).map(s => ({ s, sit: sitOf(F, s), rec: R?.[s] ?? null, room: capSheet(F, s).room, fo: foOf(F, s) }))
}
// a team's assets for the screen: its men (best first, with why one can't be traded) and its picks (best first)
export function tradeAssets(F, s) {
  const men = [...menOf(F, s)].filter(p => !p.fl).sort((a, b) => b.o - a.o).map(p => ({ p, why: tradeable(F, s, p), v: valueOf(F, p) }))
  const picks = picksBy(F)[s].map(k => ({ k, ...parsePick(k), v: pickWorth(F, k), text: pickText(F, k, s) })).sort((a, b) => a.y - b.y || a.r - b.r || b.v - a.v)
  return { men, picks }
}
export const tradesThisYear = F => (F.trl ?? []).filter(d => d.ly === lyOf(F))
