// BASKETBALL FRANCHISE LIGHT (owner, 2026-11-24: "you also need the lite/full mode for bb"): football's LIGHT
// (lib/franchise2/light.js) on the NBA's calendar. The same league on the same engine: every game is played by
// playDay with its box score, the injuries, the All-Star Game, the league's deadline deals, the awards, the lottery,
// the aging, the contracts and the cap, the market and the wire. Only the GM's part is shorter, and LIGHT never goes
// into a game (no moments). The choice is made when the franchise is created and kept for the save: F.pace = 'light'
// (a save without it is FULL, and nothing here runs for it). Light and Full save the same league: hist, awards,
// records and the retired list are written by the same closeSeason / nextStep / newSeason.
//
// THE SEASON in three stretches, by the NBA's own landmarks:
//   1 OPENING NIGHT TO CHRISTMAS   through the Christmas Day games
//   2 TO THE TRADE DEADLINE        the night before deadline day (the GM can still deal on deadline day itself)
//   3 THE STRETCH RUN              deadline day, the All-Star break, the finish
// Each stretch is simmed night by night (no moments), then the recap: every result (the boxes the save keeps), the
// builds' lines, the conference, who got hurt, the wire. The postseason sims a round a tap (the play-in its two
// nights in one), the GM's series with each game's final; a team that's out watches the rest.
//   F.lt in the season: { y, k (0-2), d0, d1 (its days, [d0, d1)), ph: 'card' | 'recap' | 'done', b0 (the builds'
//   season lines when it opened: { id: [gp, min, pts, reb, ast, stl, blk, fgm, fga, tpm, tpa] }), hs ({ id: games
//   out } before the night being played), inj ([[id, name, games, what, season?, day]]: the men hurt in the stretch) }
//   in the postseason: { y, po: { ph ('playin' | 'playoffs' | 'rest': simmed to the champion while still in it |
//   'out'), rd, from (F.log's length before the round), c (the GM's conference) } }
//
// THE OFFSEASON in three steps (FULL has six stops; the same stops run, the GM sees three):
//   1 THE DRAFT       the awards (and his team options, the front office's call pre-set), then the lottery and the
//                     spring's scouting done by the scouts (lightScout), then draft night: he picks at his picks
//   2 FREE AGENCY     the league a year older, his free agents' calls pre-set to the front office's (resignCalls:
//                     keep at his ask with his rights, tender the QO, let him go); then the market's best fits for
//                     his team, each with one offer at his ask (Fair) or 10% over it (Strong), over 1 to 4 years;
//                     FINISH FREE AGENCY places them and plays the market's six days with the league bidding as in FULL
//   3 CAMP            the roster to 15 standard and 3 two-way deals (FULL's camp), then a new season
//   F.lt in the offseason: { y, ph: 'rs' | 'fa', rs: { id: 'keep' | 'qo' | 'go' }, rsr: [[id, 'kept' | 'qo' | 'gone',
//   why?]], off: { id: { $, y, r } }, fc: { id: { s, y } } (an offer's price, Fair 0 or Strong 1, and its years),
//   far: [{ i, n, s (where he signed, null: unsigned), $, y, k: 'won' | 'lost' | 'open' | 'cap' }], done }
import { CONF_OF, DIV_OF, manOf, teamOfMan } from './league'
import { records, confOrder, divOrder, playDay, simTo, startPostseason, playPoNight, simPostseason, finishMoment, alive, callWatch, callCheck } from './season'
import { dateText } from './schedule'
import { nextStep, resignMine, tenderQO, faNext, campCheck } from './offseason'
import { draftOrder, available, scout } from './draft'
import * as X from './seams'
import { keeperOf, roleOn } from './market'
import { marketValue } from './contracts'
import { clamp, r1 } from '../rng'

export const isLight = F => F?.pace === 'light'
export const PACES = ['full', 'light']
const DAY = 86400000

// ── The season ───────────────────────────────────────────────────────────────
// the stretches' days: [[d0, d1], ...] (the deadline day goes with the stretch run: trades still go through that day)
export function stretchDays(F) {
  const n = F.days ?? 170
  const xmas = F.cal0 != null ? Math.round((Date.UTC(F.year, 11, 25) - F.cal0) / DAY) : Math.round(n * 0.38)
  const a = clamp(1, n - 2, xmas + 1)
  const b = clamp(a + 1, n - 1, F.ddl ?? Math.round(n * 0.65))
  return [[0, a], [a, b], [b, n]]
}
export const stretchOf = (F, d = F.day ?? 0) => { const S = stretchDays(F); return d < S[0][1] ? 0 : d < S[1][1] ? 1 : 2 }
export const STRETCH_NAME = ['Opening night to Christmas', 'To the trade deadline', 'The stretch run']
// the stretch's dates: "OCT 20 – DEC 25" (its first and last nights with a game for the GM's team)
export function stretchDates(F, k) {
  const [d0, d1] = stretchDays(F)[k]
  const mine = F.sched.filter(g => g.d >= d0 && g.d < d1 && (g.h === F.team || g.a === F.team))
  if (!mine.length) return ''
  return `${dateText(F, mine[0].d)} – ${dateText(F, mine[mine.length - 1].d)}`
}
// the GM's games in a stretch
export const stretchGames = (F, k) => { const [d0, d1] = stretchDays(F)[k]; return F.sched.filter(g => g.d >= d0 && g.d < d1 && (g.h === F.team || g.a === F.team)) }

// A new LIGHT franchise (createNbaFranchise): the first stretch open
export function lightInit(F) {
  F.pace = 'light'
  if (F.phase === 'season') openStretch(F, stretchOf(F))
  return F
}
const LINE_K = ['gp', 'min', 'pts', 'reb', 'ast', 'stl', 'blk', 'fgm', 'fga', 'tpm', 'tpa']
const buildLines = F => Object.fromEntries(F.teams[F.team].r.filter(p => p.b != null).map(p => [p.i, LINE_K.map(k => Math.round(F.ss?.[p.i]?.[k] ?? 0))]))
const hurtNow = F => Object.fromEntries(F.teams[F.team].r.filter(p => p.inj?.g > 0).map(p => [p.i, p.inj.g]))
// A stretch opens: its days, the builds' lines and the men hurt as it starts
export function openStretch(F, k = stretchOf(F)) {
  const [d0, d1] = stretchDays(F)[k]
  F.lt = { y: F.year, k, d0, d1, ph: 'card', b0: buildLines(F), hs: hurtNow(F), inj: [] }
  return F.lt
}
// the stretch the season card shows: open, the right year, the stretch it's in (a save that lost its stretch, or a
// FULL save made LIGHT, gets the one it's in: the hub opens it)
export const stretchOk = F => !!F.lt && F.lt.y === F.year && F.lt.k != null && F.lt.d0 != null && F.phase === 'season' && (F.lt.ph !== 'card' || (F.day >= F.lt.d0 && F.day < F.lt.d1))
// the men hurt on the night just played: anyone out more games than he was before it (a new injury, or a worse one)
function noteHurt(F) {
  const L = F.lt
  if (!L) return
  const was = L.hs ?? {}
  for (const p of F.teams[F.team].r) {
    const g = p.inj?.g ?? 0
    if (g > 0 && g > (was[p.i] ?? 0)) (L.inj ??= []).push([p.i, p.n, g, p.inj.k ?? null, p.inj.se ? 1 : 0, F.day - 1])
  }
  L.hs = hurtNow(F)
}
// a game waiting on its moment (a FULL save made LIGHT, or one from before): simmed to its final, the way the sim
// plays a skipped moment
export function lightSettle(F) {
  if (!F.pend) return false
  for (let g = 0; g < 10 && F.pend; g++) finishMoment(F, null)
  return true
}
// PLAY THE STRETCH: its nights simmed (every game, no moments), then the recap
// (opts.calls: the stretch stops for a trade call, season.js callCheck: the card stays up with the nights left)
export function lightPlay(F, opts = {}) {
  const L = F.lt
  if (!L || L.ph !== 'card' || F.phase !== 'season') return null
  lightSettle(F)
  L.hs ??= hurtNow(F)
  const w = opts.calls ? callWatch(F) : null
  for (let g = 0; g < 400 && F.phase === 'season' && F.day < L.d1; g++) {
    playDay(F); noteHurt(F)
    // (a call partway through: the stretch waits on its card; one on its last night shows over the recap)
    const c = w && F.day < L.d1 && F.phase === 'season' ? callCheck(F, w) : null
    if (c) return { call: c }
  }
  L.ph = 'recap'
  delete L.hs
  return { recap: true }
}
// The recap's button: the next stretch, or (after the last night) the postseason
export function lightNext(F) {
  const L = F.lt
  if (!L || L.ph !== 'recap') return null
  if (F.phase === 'season' && L.k < 2) return { stretch: openStretch(F, L.k + 1) }
  // (the last stretch ends with the last night: if a night is somehow left, it's played)
  if (F.phase === 'season') simTo(F, F.days)
  L.ph = 'done'
  if (F.phase === 'post') startPostseason(F)
  return { postseason: true }
}
// SIM TO THE POSTSEASON: every night left, no moments (the hub's Season Over card starts the postseason)
// (opts.calls: the run stops for a trade call, season.js callCheck: the stretch it's in, open on its card)
export function lightSimAll(F, opts = {}) {
  if (F.phase !== 'season') return
  lightSettle(F)
  if (!F.lt || F.lt.y !== F.year || F.lt.k == null) openStretch(F)
  const L = F.lt
  L.hs ??= hurtNow(F)
  const w = opts.calls ? callWatch(F) : null
  for (let g = 0; g < 400 && F.phase === 'season'; g++) {
    playDay(F); noteHurt(F)
    const c = w && F.phase === 'season' ? callCheck(F, w) : null
    if (c) {
      if (L.k !== stretchOf(F)) openStretch(F, stretchOf(F))
      F.lt.ph = 'card'
      return { call: c }
    }
  }
  L.ph = 'done'
  delete L.hs
}

// THE POSTSEASON, a round a tap: the play-in's two nights, or a round of the playoffs, simmed to its end (the GM's
// series and every other one). A team out of it sims the rest to the champion.
//   { rows (the GM's games in it, the log's rows) } | { out: true }
export function lightRound(F) {
  if (F.phase !== 'playin' && F.phase !== 'playoffs') return null
  lightSettle(F)
  if (!alive(F)) return lightRest(F)
  const ph = F.phase, rd = F.po.rd, from = F.log.length
  for (let n = 0; n < 12 && F.phase === ph && F.po.rd === rd && F.po.stage !== 'done'; n++) playPoNight(F)
  F.lt = { y: F.year, po: { ph, rd, from, c: CONF_OF[F.team] } }
  return { rows: F.log.slice(from) }
}
// SIM THE REST OF THE POSTSEASON, to the champion. A team still in it keeps how its own run ended for the champion's
// page (F.lt.po.ph 'rest': roundResult reads its last series, or its play-in games); a team already out has nothing
// new to show ('out').
export function lightRest(F) {
  if (F.phase !== 'playin' && F.phase !== 'playoffs') return null
  lightSettle(F)
  const was = alive(F), from = F.log.length
  simPostseason(F)
  F.lt = { y: F.year, po: was ? { ph: 'rest', from, c: CONF_OF[F.team] } : { ph: 'out', from: F.log.length } }
  return { out: !was }
}
// the round just simmed, for the screen: { ph, rd, rows, S (the GM's series in it), won, out (his season over) }
// (after SIM THE REST: the GM's last series, the round his postseason ended in or the Finals he won)
export function roundResult(F) {
  const R = F.lt?.y === F.year ? F.lt.po : null
  if (!R || R.ph === 'out' || !F.po) return null
  const rows = (F.log ?? []).slice(R.from).filter(r => r.po)
  const playin = () => {
    if (!rows.length) return null   // (a top-six seed watched it)
    const x = F.po.pi?.[R.c] ?? {}
    const seed = (F.po.final?.[R.c] ?? []).indexOf(F.team) + 1 || null
    return { ph: 'playin', rows, seed, x, out: !seed }
  }
  if (R.ph === 'playin') return playin()
  const mineIn = rd => (F.po.all?.[rd] ?? []).find(s => s.hi === F.team || s.lo === F.team) ?? null
  if (R.ph === 'rest') {
    let rd = (F.po.all ?? []).length - 1
    while (rd >= 0 && !mineIn(rd)) rd--
    // (out in the play-in: its games; otherwise the last series, its games the last of the rows)
    if (rd < 0) return playin()
    const S = mineIn(rd)
    return { ph: 'playoffs', rd, rows: rows.slice(-S.g.length), S, won: S.done === F.team, out: S.done !== F.team }
  }
  const S = mineIn(R.rd)
  return { ph: 'playoffs', rd: R.rd, rows, S, won: S?.done === F.team, out: !!S && S.done !== F.team }
}

// ── The stretch's recap ──────────────────────────────────────────────────────
// { rows (the GM's games), w, l, rec, conf (the conference in order), seed, div, place, builds: [{ p, gp, t (the
//   stretch's totals) }], hurt: [{ id, n, g, what, se, d }] (five games or more or his season, a man once), minor: [names], wire: [news], as: [ids] (the GM's All-Stars, when the
//   All-Star teams were named in the stretch) }
export function stretchRecap(F, L = F.lt) {
  if (!L || L.d0 == null) return null
  const rows = (F.log ?? []).filter(r => !r.po && r.d >= L.d0 && r.d < L.d1)
  const w = rows.filter(r => r.w).length, l = rows.length - w
  const R = records(F)
  const c = CONF_OF[F.team], conf = confOrder(F, c, R), div = divOrder(F, DIV_OF[F.team], R)
  const builds = []
  for (const p of F.teams[F.team].r) {
    if (p.b == null) continue
    const now = LINE_K.map(k => F.ss?.[p.i]?.[k] ?? 0), was = L.b0?.[p.i] ?? LINE_K.map(() => 0)
    const t = Object.fromEntries(LINE_K.map((k, j) => [k, Math.max(0, now[j] - (was[j] ?? 0))]))
    builds.push({ p, gp: t.gp, t })
  }
  // (the injuries that cost a man five games or more, or his season; the shorter ones are the day-to-day line. A man
  // hurt twice in the stretch, or whose injury got worse, is one line: his longest)
  const worst = new Map()
  for (const [id, n, g, what, se, d] of L.inj ?? []) {
    const x = { id, n, g, what, se: !!se, d }, was = worst.get(id)
    if (!was || (x.se && !was.se) || (x.se === was.se && x.g > was.g)) worst.set(id, x)
  }
  const all = [...worst.values()]
  const hurt = all.filter(x => x.g >= 5 || x.se).sort((a, b) => b.se - a.se || b.g - a.g)
  const minor = all.filter(x => !hurt.includes(x)).map(x => x.n)
  const seen = new Set()
  const W = { trade: 7, record: 6, asg: 5, as: 5, ddl: 1, inj: 3, award: 4, tax: 2 }
  const wire = (F.news ?? []).filter(x => x.y === F.year && x.d != null && x.d >= L.d0 && x.d < L.d1 && x.k !== 'sign' && x.k !== 'final' && x.k !== 'season' && x.k !== 'gm' && !(x.k === 'inj' && x.s === F.team))
    .map((x, i) => ({ x, v: (W[x.k] ?? 1) + (x.s === F.team ? 3 : 0) - i * 0.001 }))
    .sort((a, b) => b.v - a.v).map(e => e.x).filter(x => !seen.has(x.text) && seen.add(x.text)).slice(0, 4)
  const asIn = F.asb && F.asb[0] >= L.d0 && F.asb[0] < L.d1 + 1 && F.as
  const as = asIn ? ['E', 'W'].flatMap(k => [...(F.as[k]?.st ?? []), ...(F.as[k]?.res ?? [])]).filter(i => teamOfMan(F, i) === F.team) : []
  return { rows, w, l, rec: R[F.team], conf, seed: conf.indexOf(F.team) + 1, div, place: div.indexOf(F.team) + 1, builds, hurt, minor, wire, as, asg: asIn ? F.as.g ?? null : null }
}
// the box score the save keeps for a row of the log (the last games: season.js logMine), or null
export const boxOf = (F, r) => (F.box ?? []).find(b => b.d === r.d && (b.h === F.team || b.a === F.team) && (b.h === r.opp || b.a === r.opp)) ?? null

// ── The offseason ────────────────────────────────────────────────────────────
// the step the summer is on: 0 the draft (awards, lottery, draft), 1 free agency (re-sign, the market), 2 camp
export const LIGHT_STEPS = ['The draft', 'Free agency', 'Camp']
export const lightStep = F => { const s = F.off?.step ?? 'awards'; return s === 'camp' ? 2 : s === 'resign' || s === 'fa' ? 1 : 0 }
// 1. THE DRAFT: the awards read (his team options set), on to draft night: the lottery drawn, the scouts' spring
// spent on the men who could be there at his first pick (lightScout), the draft opened
export function lightToDraft(F) {
  if (F.phase !== 'off' || !F.off) return false
  if (F.off.step === 'awards') nextStep(F)
  if (F.off.step === 'lottery') { lightScout(F); nextStep(F) }
  return F.off.step === 'draft'
}
// the scouts' spring: every report left, on the men the consensus has near his first pick (a few above it, more
// below), the best first; a second report on the man who'd be there
export function lightScout(F) {
  const mine = draftOrder(F).find(p => p.t === F.team)
  if (!mine) return 0
  const at = mine.n
  const pool = available(F).filter(p => p.rank >= Math.max(1, at - 3) && p.rank <= at + 8).sort((a, b) => a.rank - b.rank)
  let n = 0
  for (const pass of [0, 1]) for (const p of pool) { if ((F.sp ?? 0) <= 0) return n; if ((p.sc ?? 0) <= pass && scout(F, p.i)) n++ }
  return n
}
// 2. FREE AGENCY opens: draft night over, the league a year older (the re-sign stop's ageLeague and
// seasonEndDeals), his free agents' calls pre-set
export function lightOpenFA(F) {
  if (F.phase !== 'off' || F.off?.step !== 'draft') return false
  nextStep(F)
  F.lt = { y: F.year, ph: 'rs', rs: resignCalls(F) }
  return true
}
// his free agents (the re-sign stop's list), each with what the call needs: { p, d (his ask, or null: he wants the
// market), c (canSign on it), rfa, qo }
export function resignList(F) {
  return (F.off?.mine ?? []).map(i => (F.fa ?? []).find(p => p.i === i)).filter(Boolean).map(p => {
    const d = X.resignOffer(F, p)
    return { p, d, c: d ? X.canSign(F, F.team, p, { ...d, bird: true }) : null, rfa: !!p.rfa && !!(p.qo || p.qtw) }
  })
}
// The front office's call on each: a build is kept; a keeper (one of the league's best, or one of the team's two
// best) kept; a rotation man 31 or younger kept when his ask is near what he's worth; each only when the deal can be
// signed (canSign: his rights, the aprons, the ownership's spending line); a young restricted man who'd play and
// can't be kept now gets his qualifying offer; the rest let go. (The calls are made in order, the builds and the
// best first: a keep the ownership's line no longer allows by its turn is let go then, and the screen says so.)
export function resignCalls(F) {
  const out = {}
  const list = resignList(F).sort((a, b) => (b.p.b != null) - (a.p.b != null) || (b.p.o ?? 0) - (a.p.o ?? 0))
  for (const { p, d, c, rfa } of list) {
    const keeper = p.b != null || keeperOf(F, F.team, p)
    const role = (p.ag ?? 27) <= 31 && roleOn(F, F.team, p) >= 0.5 && !!d && d.$ <= marketValue(F, p) * 1.25 + 0.5
    if (d && c?.ok && (keeper || role)) { out[p.i] = 'keep'; continue }
    out[p.i] = rfa && (p.ag ?? 27) <= 26 && (p.o ?? 0) >= 66 ? 'qo' : 'go'
  }
  return out
}
export const callOf = (F, p) => F.lt?.rs?.[p.i] ?? 'go'
// THE CALLS MADE: each man kept (at his ask, with his rights), tendered, or let go; then on to the market
// (leaving the re-sign stop renounces anyone undecided)
export function lightResign(F) {
  if (F.phase !== 'off' || F.off?.step !== 'resign') return null
  const out = []
  for (const id of [...(F.off.mine ?? [])]) {
    const p = (F.fa ?? []).find(x => x.i === id)
    if (!p) continue
    const c = callOf(F, p)
    if (c === 'keep') {
      const r = resignMine(F, id, true)
      if (r.ok) out.push([id, 'kept'])
      else { resignMine(F, id, false); out.push([id, 'gone', r.why ?? null]) }
    } else if (c === 'qo' && p.rfa && (p.qo || p.qtw)) { tenderQO(F, id, true); out.push([id, 'qo']) }
    else { resignMine(F, id, false); out.push([id, 'gone']) }
  }
  nextStep(F)
  F.lt = { y: F.year, ph: 'fa', rsr: out, off: {}, fc: {} }
  return out
}

// THE MARKET'S BEST FITS: the free agents who'd start or play in his rotation and whom his team can offer at least
// most of his ask (his own restricted men aside: they're his to match), the best first, three at most at a spot;
// a short list topped up with the best of the rest who fit. [{ p, ask, room, role }]
export function marketFits(F, n = 10) {
  const out = [], at = {}
  const men = (F.fa ?? []).filter(p => !p.fl && !(p.fr === F.team && !p.rn && p.rfa)).sort((a, b) => (b.o ?? 0) - (a.o ?? 0)).slice(0, 80)
  const look = p => {
    const ask = X.askOf(F, p)
    const room = X.offerRoom(F, p.i)
    if (!room || room.$ < ask.$ * 0.85) return null
    return { p, ask, room, role: roleOn(F, F.team, p) }
  }
  const later = []
  for (const p of men) {
    const x = look(p)
    if (!x) continue
    if (x.role < 0.5) { later.push(x); continue }
    if ((at[p.p] ?? 0) >= 3) continue
    at[p.p] = (at[p.p] ?? 0) + 1
    out.push(x)
    if (out.length >= n) break
  }
  for (const x of later) { if (out.length >= Math.min(n, 8)) break; if ((at[x.p.p] ?? 0) < 3) { out.push(x); at[x.p.p] = (at[x.p.p] ?? 0) + 1 } }
  return out
}
export const STRONG = 1.1
// the offer on the screen: Fair (his ask) or Strong (10% over it), over 1 to 4 years (5 with his Bird rights), never
// past what his team can offer him (offerRoom); c: F.lt.fc's { s, y }
export function offerFor(F, x, c = F.lt?.fc?.[x.p.i]) {
  const maxY = x.room?.y ?? 4
  const y = clamp(1, maxY, c?.y ?? Math.min(x.ask.y, maxY))
  const want = x.ask.$ * (c?.s ? STRONG : 1)
  const $ = r1(Math.min(x.room?.$ ?? want, want))
  return { $, y, r: x.ask.r ?? ($ >= 15 ? 0.05 : 0) }
}
// how it reads to him: 'likely' | 'close' | 'unlikely' (market.js offerLook: the league's offers aren't known)
export const offerChance = (F, id, d) => X.offerLook(F, id, d)?.chance ?? 'unlikely'
// FINISH FREE AGENCY: the offers placed (each one he answers when the day is played, against the league's), the
// market's six days played, the wire kept day by day (F.off.wire: [day, id, team, $, years], the full mode's), and
// what came of each offer (F.lt.far)
export function lightFA(F) {
  if (F.phase !== 'off' || F.off?.step !== 'fa') return null
  const L = F.lt?.y === F.year && F.lt.ph === 'fa' ? F.lt : (F.lt = { y: F.year, ph: 'fa', off: {}, fc: {} })
  const far = {}
  for (const [id, o] of Object.entries(L.off ?? {})) {
    const p = (F.fa ?? []).find(x => x.i === +id)
    if (!p) continue
    const r = X.placeOffer(F, p.i, o)
    far[p.i] = { i: p.i, n: p.n, o, ...(r.ok ? {} : { k: 'cap', why: r.why ?? null }) }
  }
  for (let g = 0; g < 8 && !X.faDone(F); g++) faDayLogged(F)
  for (const x of Object.values(far)) {
    if (x.k === 'cap') continue
    const s = teamOfMan(F, x.i), p = manOf(F, x.i)
    Object.assign(x, { s, k: s === F.team ? 'won' : s ? 'lost' : 'open', ...(s && p && { $: p.$, y: p.y }) })
  }
  // (an offer still out when the days are done comes off the table)
  F.fao = {}
  L.far = Object.values(far)
  L.done = 1
  return L.far
}
// a day of the market, the full mode's way (NbaOffseason nextDay): who signed where
function faDayLogged(F) {
  const before = new Set((F.fa ?? []).map(p => p.i))
  faNext(F)
  const d = F.off.day
  const left = new Set((F.fa ?? []).map(p => p.i))
  const signed = [...before].filter(i => !left.has(i)).map(i => { const p = manOf(F, i); return [d, i, teamOfMan(F, i), p?.$ ?? 0, p?.y ?? 0] }).filter(x => x[2])
  F.off.wire = [...(F.off.wire ?? []), ...signed]
}
// the summer's biggest deals around the league (the wire's), the GM's own aside: [{ p, s, $, y }]
export function bigDeals(F, n = 5) {
  return (F.off?.wire ?? []).filter(x => x[2] !== F.team).map(x => ({ p: manOf(F, x[1]), s: x[2], $: x[3], y: x[4] })).filter(x => x.p && teamOfMan(F, x.p.i) === x.s).sort((a, b) => b.$ * b.y - a.$ * a.y).slice(0, n)
}
// the GM's restricted free agents' offer sheets this summer and how they ended (the market matched them when it could)
export const sheetNews = F => (F.news ?? []).filter(x => x.y === F.year && x.d == null && (x.tag === 'MATCHED' || x.tag === 'OFFER SHEET') && x.s === F.team).slice(0, 4)
// on to camp: the league's teams' summer (cpuOffseason: the late signings, the trades, camp bodies)
export function lightCamp(F) {
  if (F.phase !== 'off' || F.off?.step !== 'fa') return false
  if (!X.faDone(F)) lightFA(F)
  nextStep(F)
  return F.off?.step === 'camp'
}
// the front office's cuts at camp: the men past 15 standard deals, the ones the team loses least by waiving: the
// lowest rated, his dead money counted against him (a point a $1M), a first-rounder just drafted kept (teams don't
// waive their own pick in camp), young men given a little more rope; never a build. [ids]
export function campCuts(F) {
  const T = F.teams[F.team]
  const std = T.r.filter(p => !p.tw)
  const over = std.length - 15
  if (over <= 0) return []
  const keep = p => (p.o ?? 0) + (X.cutCost(F, p)?.total ?? 0) + (p.dr?.[0] === F.year + 1 && p.dr[1] === 1 ? 12 : 0) + Math.max(0, 25 - (p.ag ?? 27))
  return std.filter(p => p.b == null).map(p => ({ p, v: keep(p) })).sort((a, b) => a.v - b.v).slice(0, over).map(x => x.p.i)
}
// 3. CAMP done: a new season, its first stretch open
export function lightNewSeason(F) {
  if (F.phase !== 'off' || F.off?.step !== 'camp') return false
  if (!campCheck(F).ok) return false   // (offseason.js: legal, or a hard-capped roster that can't add its 14th)
  nextStep(F)
  if (F.phase === 'season') openStretch(F, 0)
  return true
}
// a man's per-game line over a stretch's totals: "24.1 PTS · 6.2 REB · 5.0 AST · 47% FG"
export function perLine(t) {
  if (!t?.gp) return null
  const g = t.gp, f = v => (v / g).toFixed(1)
  return `${f(t.pts)} PTS · ${f(t.reb)} REB · ${f(t.ast)} AST${t.fga ? ` · ${Math.round((t.fgm / t.fga) * 100)}% FG` : ''}`
}
