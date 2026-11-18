// FRANCHISE LIGHT (owner, 2026-11-17): "light same building as full but is a much faster season and off season.
// needs the same detail of simulation and what not but this is more of a 10min playthrough or so".
// The same league on the same engine: every game is played by playWeek with its box score, the injuries, the awards,
// the aging, the contracts and the cap, the coaching carousel, the draft class and the wire. Only the player's part is
// shorter. The choice is made when the franchise is created and kept for the save: F.pace = 'light' (a save without
// it is FULL, and nothing here runs for it).
//
// THE SEASON in three stretches: Weeks 1-6, 7-12 (the trade deadline falls after Week 9, so a trade call can still
// come at its start) and 13-18. Each stretch opens with at most one front-office call (FULL's every-three-weeks
// cadence is off: F.nextEv past the season), its six weeks and its big game (bigGame). Playing it: the weeks before
// the big game simmed (no moments, the path simWeeks takes), the big game on Gameday with its key moments, the weeks
// after it simmed, then the stretch's recap. The scouts work on their own at each stretch's end (draft.js autoScout).
//   F.lt in the season: { y, k (0-2), w0, w1 (its weeks, [w0, w1)), big (the big game's week), ph: 'card' (the
//   stretch to play) | 'big' (the big game on Gameday) | 'recap' | 'done' (the regular season is over),
//   hs (the men hurt before the week being played: [[id, weeks]]), inj (the men hurt in the stretch) }
//
// THE OFFSEASON in three steps (FULL has five):
//   1 STAFF & AWARDS  the awards in one list; keep or fire the two coordinators (lightStaff: a fired or departed man's
//                     replacement hired from the league's short list, the rest of the carousel run as in FULL), then
//                     the league ages and the deals that are up are opened (openResign), and the market (openFA)
//   2 ROSTER          the re-sign calls, pre-set to the team's sensible call (resignCalls), and the market's best fits
//                     at the team's needs, each with one offer at the market's price (fairOffer); FINISH FREE AGENCY
//                     (lightFA) makes the calls and runs the market's three days with the league bidding as in FULL
//   3 THE DRAFT       the spring done by the scouts (lightSpring: the Senior Bowl, the combine, the visits, the film);
//                     the player picks in rounds 1-3, the rest is simmed (draft.js simRest); no draft trades
//   F.lt in the offseason: { y, ph: 'roster', rs: { id: the call }, off: { id: { $, y, b } }, far: the market's
//   answers to his offers, done }
import { strength } from './league'
import { playWeek, makeEvent, intoPlayoffs, simPlayoffs, REG_WEEKS } from './season'
import { records, standings } from './standings'
import { DIV_OF, CONF_OF } from './schedule'
import { rngOf, roll, r1 } from './rng'
import { autoScout, slateOf, attend, runCombine, interview, visitsLeft, consensus, rankMap, needsOf, openDraft, closeDraft, scoutsLeft, draftOrder } from './draft'
import { carouselOn, fireMine, runHires, myOpenings, shortlist, interviewCoach, interviewsLeft, offerCoach, closeCarousel } from './carousel'
import { staffMen, staffOf, coachOvr, rOf } from './coach'
import { ageLeague } from './aging'
import { openResign, resignOne, resignAsk, optionAsk, openFA, setOffer, nextFADay, standingOf, fitOf, teamView, FA_DAYS } from './market'
import { optionDue, minimumFor, capSheet, restOf53 } from './contracts'
import { startsFor } from './deals'
import { groupOf, depthChart, GROUP } from './roster'
import { newSeason } from './offseason'
import { statLine } from './awards'

export const isLight = F => F?.pace === 'light'
export const PACES = ['full', 'light']
// the stretches: [first week, the week after the last] (week indexes, 0 = Week 1)
export const STRETCH = [[0, 6], [6, 12], [12, 18]]
export const stretchOf = wk => (wk < 6 ? 0 : wk < 12 ? 1 : 2)
export const stretchText = k => `Weeks ${STRETCH[k][0] + 1}–${STRETCH[k][1]}`
const NO_EVENTS = 99   // (endWeek's next event week: never, in LIGHT)

// A new LIGHT franchise (FranchiseMode start): the first stretch open
export function lightInit(F) {
  F.pace = 'light'
  openStretch(F, 0)
  return F
}

// ── The season ───────────────────────────────────────────────────────────────
// the men hurt on the team now: [[id, weeks out]]
const hurtNow = F => F.teams[F.team].r.filter(p => p.in).map(p => [p.i, p.in])
// the men hurt in the week just played: anyone out longer than a week on from before it (a week passes for the hurt
// first, then the week's injuries: season.js endWeek)
function noteHurt(F, before) {
  const L = F.lt
  if (!L) return
  const was = new Map(before ?? [])
  for (const p of F.teams[F.team].r) {
    if (!p.in || p.in <= Math.max(0, (was.get(p.i) ?? 0) - 1)) continue
    if ((L.inj ??= []).some(x => x[0] === p.i && x[5] === F.wk)) continue
    L.inj.push([p.i, p.n, p.in, p.ij?.l ?? null, p.ij?.se ? 1 : 0, F.wk])
  }
}
// one week simmed: every game, no moments, no front-office call (simWeeks' own path)
function simWeek(F) {
  if (F.ev) F.ev = null
  const before = F.lt?.hs ?? hurtNow(F)
  const r = playWeek(F, { moments: false })
  F.ev = null
  if (F.lt) { noteHurt(F, before); F.lt.hs = hurtNow(F) }
  return r
}

// THE BIG GAME: the stretch's game with the most at stake. A division game first (the title is won and lost in
// them), then the conference; the better the opponent and his record so far, the bigger; a later week a little bigger
// than an early one. Seeded, so the same stretch always picks the same game.
export function bigGame(F, w0, w1) {
  const R = rngOf(`${F.seed}-${F.year}-lt-big-${w0}`)
  const rec = records(F)
  const ovr = {}
  const ovrOf = s => (ovr[s] ??= strength(F, s).ovr)
  let best = null
  for (let w = w0; w < w1; w++) {
    const g = F.sched.weeks[w]?.find(x => x.h === F.team || x.a === F.team)
    if (!g || g.hs != null) continue
    const opp = g.h === F.team ? g.a : g.h
    const r = rec[opp], gp = r.w + r.l + r.t
    const wp = gp ? (r.w + r.t / 2) / gp : 0.5
    const v = (DIV_OF[opp] === DIV_OF[F.team] ? 3 : CONF_OF[opp] === CONF_OF[F.team] ? 1 : 0)
      + (ovrOf(opp) - ovrOf(F.team)) * 0.25 + (wp - 0.5) * (gp >= 3 ? 3 : 1) + (w - w0) * 0.25 + R.u() * 0.4
    if (!best || v > best.v) best = { w, v }
  }
  return best?.w ?? null
}
// A stretch opens: its weeks, its big game, its front-office call (at most one, made now and answered on the season
// card before a snap is played)
export function openStretch(F, k = stretchOf(F.wk ?? 0)) {
  const [w0, w1] = STRETCH[k]
  F.nextEv = NO_EVENTS
  F.lt = { y: F.year, k, w0, w1, big: bigGame(F, Math.max(w0, F.wk ?? 0), w1), ph: 'card', hs: hurtNow(F), inj: [] }
  if (!F.ev && F.phase === 'season' && F.wk < REG_WEEKS) {
    const ev = makeEvent(F, rngOf(`${F.seed}-${F.year}-lt-ev-${k}`))
    if (ev) F.ev = ev
  }
  return F.lt
}
// the stretch the season card shows: open, the right year (a save that lost its stretch gets the one it's in)
export const stretchOk = F => !!F.lt && F.lt.y === F.year && F.lt.k != null && F.phase === 'season' && F.wk >= F.lt.w0 && (F.wk < F.lt.w1 || F.lt.ph !== 'card')
// PLAY THE STRETCH: the weeks before the big game simmed, then the big game (the hub puts it on Gameday: a moment
// waiting is { pending: true }, a game played through is { row }). No big game (a stretch of byes): straight to the
// recap.
export function lightPlay(F, opts = {}) {
  const L = F.lt
  if (!L || L.ph !== 'card' || F.phase !== 'season') return null
  if (F.ev) return { event: true }
  if (F.pend) return { pending: true }
  const big = L.big != null && L.big >= F.wk ? L.big : null
  for (let g = 0; g < REG_WEEKS && F.phase === 'season' && F.wk < (big ?? L.w1); g++) simWeek(F)
  if (big == null || F.wk !== big || F.phase !== 'season') { finishStretch(F); return { recap: true } }
  L.ph = 'big'
  return playWeek(F, opts)
}
// The big game is over (Gameday's CONTINUE, or a reload after its final): its injuries noted, the rest of the stretch
// simmed, the scouts' days spent, the recap.
export function lightAfter(F) {
  const L = F.lt
  if (!L || L.ph !== 'big' || F.pend) return false
  if (F.phase === 'season' && F.wk <= L.big) return false   // (the big game isn't played yet)
  noteHurt(F, L.hs)
  L.hs = hurtNow(F)
  finishStretch(F)
  return true
}
function finishStretch(F) {
  const L = F.lt
  for (let g = 0; g < REG_WEEKS && F.phase === 'season' && F.wk < L.w1; g++) simWeek(F)
  autoScout(F)
  L.ph = 'recap'
  delete L.hs
}
// The recap's button: the next stretch, or (after Week 18) the bracket; a team that missed it watches the rest.
export function lightNext(F) {
  const L = F.lt
  if (!L || L.ph !== 'recap') return null
  if (F.phase === 'season' && L.k < 2) return { stretch: openStretch(F, L.k + 1) }
  L.ph = 'done'
  if (F.phase !== 'post') return { done: true }
  const inIt = intoPlayoffs(F)
  if (!inIt) simPlayoffs(F)
  return { playoffs: inIt }
}
// SIM TO THE PLAYOFFS: every week left, no moments, no calls (FULL's simWeeks), the scouts' days spent
export function lightSimAll(F) {
  if (F.phase !== 'season') return
  F.ev = null
  if (!F.lt || F.lt.y !== F.year) F.lt = { y: F.year, k: stretchOf(F.wk), inj: [] }
  for (let g = 0; g < REG_WEEKS + 1 && F.phase === 'season'; g++) simWeek(F)
  autoScout(F)
  F.lt.ph = 'done'
  delete F.lt.hs
}

// ── The stretch's recap ──────────────────────────────────────────────────────
// { rows (the team's games, the log's rows), w, l, t (the stretch), rec (the season), builds: [{ p, gp, line }],
//   hurt: [{ id, n, wk, what, se, at }], wire: [news items], div: [teams in order], place, conf (place in the
//   conference), seed (null outside the seven) }
const sumInto = (a, x) => { for (const [k, v] of Object.entries(x ?? {})) if (typeof v === 'number') a[k] = (a[k] ?? 0) + v; return a }
export function stretchRecap(F, L = F.lt) {
  if (!L || L.w0 == null) return null
  const rows = (F.log ?? []).filter(r => r.wk != null && r.wk > L.w0 && r.wk <= L.w1)
  const w = rows.filter(r => r.w).length, t = rows.filter(r => r.t).length, l = rows.length - w - t
  const S = standings(F), R = S.R[F.team]
  const div = S.div[DIV_OF[F.team]], conf = S.conf[CONF_OF[F.team]]
  const seed = S.seeds[CONF_OF[F.team]].indexOf(F.team) + 1 || null
  // the builds' lines over the stretch: their games' box scores added up (a kicker's from the kicking)
  const builds = []
  for (const p of F.teams[F.team].r) {
    if (p.b == null) continue
    const tot = {}
    let gp = 0
    for (const r of rows) {
      const x = r.bx?.s?.[String(p.i)]
      const kick = r.bx?.kid?.[0] === p.i ? r.bx.kk?.[0] : null
      if (x) { sumInto(tot, x); gp++ } else if (kick) gp++
      if (kick) { tot.fga = (tot.fga ?? 0) + (kick[0] ?? 0); tot.fgm = (tot.fgm ?? 0) + (kick[1] ?? 0); tot.lg = Math.max(tot.lg ?? 0, kick[4] ?? 0) }
    }
    tot.gp = gp
    builds.push({ p, gp, line: gp ? statLine(p, tot) : null })
  }
  const hurt = (L.inj ?? []).map(([id, n, wk, what, se, at]) => ({ id, n, wk, what, se: !!se, at }))
  // two or three of the wire's headlines from the stretch's weeks (the team's own finals are the rows above)
  const seen = new Set()
  const wire = (F.news ?? []).filter(x => x.y === F.year && !x.ph && x.wk >= L.w0 && x.wk < L.w1 && x.k !== 'final' && x.k !== 'sign' && !(x.k === 'inj' && x.s === F.team))
    .map((x, i) => ({ x, v: (x.big ? 10 : 0) + ({ record: 6, clinch: 5, streak: 4, day: 3, inj: 2, mark: 2 }[x.k] ?? 1) + x.wk * 0.05 - i * 0.001 }))
    .sort((a, b) => b.v - a.v).map(e => e.x).filter(x => !seen.has(x.text) && seen.add(x.text)).slice(0, 3)
  return { rows, w, l, t, rec: R, builds, hurt, wire, div, place: div.indexOf(F.team) + 1, conf: conf.indexOf(F.team) + 1, seed }
}

// ── The offseason ────────────────────────────────────────────────────────────
// the step the offseason is on: 0 staff & awards, 1 roster, 2 draft
export const lightStep = F => (F.stage === 'draft' ? 2 : F.stage === 'resign' || F.stage === 'fa' ? 1 : 0)
// 1. STAFF & AWARDS done: the player's Monday calls (fire: { oc, dc } true to fire), the head-coach hires around the
// league, his open jobs filled (hireFor), the league's own openings (closeCarousel); then the league ages a year and
// the deals that are up open, with the market beside them.
export function lightStaff(F, fire = {}) {
  if (F.phase !== 'off' || (F.stage !== 'coaches' && F.stage !== 'awards')) return false
  if (carouselOn(F)) {
    for (const k of ['oc', 'dc']) if (fire[k] && staffOf(F, F.team)?.[k]) fireMine(F, k)
    runHires(F)
    for (const k of myOpenings(F)) hireFor(F, k)
  }
  if (F.stage === 'coaches') closeCarousel(F)
  ageLeague(F)
  openResign(F)
  F.lt = { y: F.year, ph: 'roster', rs: resignCalls(F), off: {} }
  openFA(F)
  return true
}
// A coordinator's job filled the way a GM would: the top four on the league's short list interviewed, then the job
// offered to the best of them first (his grade for the job), then the next if he takes another team's offer. Nobody:
// closeCarousel promotes a position coach. The play-calling offered: FULL's interview default.
function hireFor(F, k) {
  const side = k === 'oc' ? 'off' : 'def'
  const own = side === (staffMen(F, F.team).hc?.sd === 'def' ? 'def' : 'off')
  const calls = !own || staffOf(F, F.team)?.call?.[side] !== 'hc'
  // (never the man the team fired this offseason)
  const list = shortlist(F, k, 8).filter(c => !c.home && !(c.fb === F.team && c.fired === F.year))
  for (const c of list) { if (interviewsLeft(F, k) <= 0) break; interviewCoach(F, k, c.i) }
  const iv = F.car?.mine?.[k]?.iv ?? []
  const seen = list.filter(c => iv.includes(c.i)).sort((a, b) => (coachOvr(rOf(b), k) ?? 0) - (coachOvr(rOf(a), k) ?? 0))
  for (const c of seen) {
    if (staffOf(F, F.team)[k]) break
    const res = offerCoach(F, k, c.i, { calls })
    if (res?.to === F.team) return res.c
  }
  return null
}
// the staff's moves this offseason, the player's own: [{ k: 'fire' | 'ret' | 'leave' | 'hire', role, n, was, to }]
export const staffMoves = F => (F.car?.y === F.year ? F.car.ev : []).filter(e => e.s === F.team && e.role !== 'hc')

// 2. ROSTER. The team's sensible call on each deal that's up: the builds kept; starters kept into their early 30s (a
// star older); young men worth the money kept; old backups let go; a first-rounder's option picked up when he's
// good enough. Made in the order a front office takes them (the builds, then the best and youngest), each one only
// if it still fits under the cap (a build's deal always fits: deals.js fitsDeal).
//   { [id]: true (keep) | false (let go) | 'option' | 'decline' }
const keepWorth = (p, starts) => (p.p === 'k' ? starts && p.o >= 74 && p.ag <= 38 : starts ? p.ag <= 32 || p.o >= 85 : p.ag <= 26 && p.o >= 72)
const coreValue = p => p.o - Math.max(0, p.ag - 27) * 1.5
export const callCost = (F, p, c) => (c === 'option' ? Math.max(0, optionAsk(p, F) - (p.$ ?? 0)) : c === true ? resignAsk(p, F).$ : 0)
const defaultCall = p => (optionDue(p) ? 'decline' : false)
// The cap room once the calls and the offers are made, the way the cap sheet will read it (contracts.js capSheet:
// every man kept or signed is one fewer minimum-salary spot in the rest of the 53).
//   { room (now), keep (the deals kept), offers, left, spend (what the player chose to spend: a build's deal aside) }
export function lightRoom(F, calls = F.lt?.rs, off = F.lt?.off) {
  const c = capSheet(F), t = F.teams[F.team]
  let keep = 0, built = 0, nk = 0, offers = 0, no = 0
  for (const i of F.rs ?? []) {
    const p = t.r.find(x => x.i === i)
    if (!p) continue
    const ch = calls?.[i] ?? defaultCall(p), cost = callCost(F, p, ch)
    keep += cost
    if (p.b != null) built += cost
    if (ch === true) nk++
  }
  for (const o of Object.values(off ?? {})) { offers += o.$; no++ }
  const under = t.r.filter(p => p.y > 0).length
  const left = r1(c.cap - c.pay - c.dead - restOf53(under + nk + no, c.year) - keep - offers)
  return { room: c.room, keep: r1(keep), offers: r1(offers), left, spend: r1(keep - built + offers) }
}
// can the team keep him (a build always: deals.js fitsDeal), with the other calls and the offers as they are
export const canKeep = (F, p, c) => p.b != null || lightRoom(F, { ...(F.lt?.rs ?? {}), [p.i]: c }).left >= -1e-9
// can the team make him this offer, with the calls and the other offers as they are
export const canOffer = (F, p, o) => lightRoom(F, F.lt?.rs, { ...(F.lt?.off ?? {}), [p.i]: o }).left >= -1e-9
export function resignCalls(F) {
  const t = F.teams[F.team], out = {}
  const men = (F.rs ?? []).map(i => t.r.find(x => x.i === i)).filter(Boolean)
  for (const p of men) out[p.i] = defaultCall(p)
  men.sort((a, b) => (b.b != null) - (a.b != null) || coreValue(b) - coreValue(a))
  for (const p of men) {
    const opt = optionDue(p), starts = startsFor(F, p)
    const worth = p.b != null || (opt ? p.o >= 80 || (starts && p.o >= 76) : keepWorth(p, starts))
    if (!worth) continue
    const c = opt ? 'option' : true
    if (p.b != null || lightRoom(F, { ...out, [p.i]: c }, {}).left >= -1e-9) out[p.i] = c
  }
  return out
}
// a man's call as it stands (the screen's toggle over the sensible one)
export const callOf = (F, p) => F.lt?.rs?.[p.i] ?? defaultCall(p)
// The market as the team reads it with its own calls made: the rooms on its roster without the men it lets go
export function lightView(F) {
  const V = teamView(F)
  const gone = new Set(Object.entries(F.lt?.rs ?? {}).filter(([, c]) => c === false).map(([i]) => +i))
  if (gone.size) {
    const C = depthChart(F, F.team)
    V[F.team] = { ...V[F.team], rooms: Object.fromEntries(Object.keys(GROUP).map(g => [g, (C[g] ?? []).filter(x => !x.in && !gone.has(x.i)).map(x => x.o)])) }
  }
  return V
}
// One offer at the market's own price: his ask, or a little over it (up to the market's OVER, 15%) when another
// team's offer would beat it; the first price at which the team leads (or is the only offer). { o, st }
export function fairOffer(F, p, V = null) {
  let out = null
  for (const f of [1, 1.05, 1.1, 1.15]) {
    const o = { $: r1(Math.max(minimumFor(p.ag, F.year + 1), p.$ * f)), y: p.y, b: 0 }
    out = { o, st: standingOf(F, p, o, V) }
    if (out.st.k === 'lead' || out.st.k === 'alone') break
  }
  return out
}
// THE MARKET'S BEST FITS: the free agents who'd start or fill a hole at the team's needs, the biggest lift first
// (market.js fitOf), ten of them; a thin list is topped up with the best depth at a need
export function marketFits(F, V = null, n = 10) {
  const need = needsOf(F, F.team)
  const all = (F.fa ?? []).filter(p => !p.fl).map(p => ({ p, fit: fitOf(F, p, V), need: need[groupOf(p)] ?? 0 }))
  const v = x => x.fit.v + x.need * 0.1
  const top = all.filter(x => x.fit.k !== 'depth').sort((a, b) => v(b) - v(a) || b.p.o - a.p.o).slice(0, n)
  if (top.length < 8) top.push(...all.filter(x => x.fit.k === 'depth' && x.need >= 1).sort((a, b) => b.p.o - a.p.o).slice(0, 8 - top.length))
  return top
}
// FINISH FREE AGENCY: the re-sign calls made (a man let go goes to the market with his ask and his day, as openFA
// sets them), the offers made, the market's three days run (market.js nextFADay: the league bidding exactly as in
// FULL). The answers to his offers kept for the screen: F.lt.far [{ i, n, p, s, k: 'won' | 'lost' | 'short' |
// 'cap', to, $, y, why, board }]
export function lightFA(F) {
  if (F.phase !== 'off' || F.stage !== 'fa' || !F.fad) return null
  const L = F.lt ?? (F.lt = { y: F.year, ph: 'roster', rs: resignCalls(F), off: {} })
  const t = F.teams[F.team]
  for (const id of [...(F.rs ?? [])]) {
    const p = t.r.find(x => x.i === id)
    if (!p) continue
    const c = callOf(F, p)
    resignOne(F, id, c)
    if (c === false && p.b == null && F.fa.includes(p)) {
      const a = resignAsk(p, F)
      p.$ = a.$; p.y = a.y; delete p.rc; delete p.op; delete p.sc
      const u = roll(`${F.seed}-${F.year}-lt-fdd-${p.i}`)
      F.fdd[p.i] = p.o >= 90 ? (u < 0.5 ? 2 : 3) : p.o >= 85 ? (u < 0.3 ? 1 : u < 0.8 ? 2 : 3) : (u < 0.55 ? 1 : u < 0.85 ? 2 : 3)
    }
  }
  const out = {}
  for (const [id, o] of Object.entries(L.off ?? {})) {
    const p = (F.fa ?? []).find(x => x.i === +id)
    if (!p) continue
    if (!setOffer(F, p.i, o)) out[p.i] = { i: p.i, n: p.n, p: p.p, s: p.s, o, k: 'cap' }
  }
  for (let g = 0; F.fad && g < FA_DAYS + 2; g++) {
    nextFADay(F)
    for (const x of F.far?.list ?? []) if (x.k !== 'later') out[x.i] = x
  }
  L.far = Object.values(out)
  L.done = 1
  return L.far
}
// the market's three days, done: on to the draft (the spring first: lightSpring)
export function lightOpenDraft(F) {
  if (F.phase !== 'off' || F.stage !== 'fa' || F.fad) return false
  lightSpring(F)
  openDraft(F)
  return true
}
// THE SPRING, the scouts' own: a scout at the Senior Bowl, the combine, the thirty top-30 visits (the men who could be
// there at the team's first three picks, its needs first), then the days left on film (autoScout)
export function lightSpring(F) {
  if (!F.sc || F.dr) return
  const sl = slateOf(F)
  if (sl && !sl.went && sl.games.length && scoutsLeft(F) >= 2) attend(F, 0)
  runCombine(F)
  const at = Math.max(0, draftOrder(F).indexOf(F.team)) + 1
  const rk = rankMap(F), need = needsOf(F, F.team)
  const pool = consensus(F).filter(x => x.b == null && !x.kc && rk.get(x.i) >= Math.max(1, at - 8) && rk.get(x.i) <= at + 96)
  pool.sort((a, b) => ((need[groupOf(b)] ?? 0) >= 1.5) - ((need[groupOf(a)] ?? 0) >= 1.5) || rk.get(a.i) - rk.get(b.i))
  for (const x of pool) { if (visitsLeft(F) < 1) break; interview(F, x.i) }
  autoScout(F)
}
// 3. THE DRAFT is over: the class in the history, a new season, its first stretch open
export function lightNewSeason(F) {
  closeDraft(F)
  newSeason(F)
  openStretch(F, 0)
  return F
}
