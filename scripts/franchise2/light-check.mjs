// Franchise LIGHT, headless (owner, 2026-11-17): LIGHT seasons played the way its screens play them (light.js), and
// the same franchise run FULL beside it.
//   bash scripts/franchise2/run.sh scripts/franchise2/light-check.mjs [seasons=3] [team=DEN]
// (2026-11-17: LIGHT never goes into a game: the stretches and the playoff rounds are simmed, none is left on screen)
// Checks: every week of every season played (17 games a team, each stretch's games in its recap); no front-office
// call mid-stretch, at most one a stretch; the stats, awards, records, contracts and the cap as sane as FULL's (the
// league leaders' ranges, the awards and All-Pros there, the franchise records, every man under contract at a new
// season, the league under the cap); the draft done (224 picks, every team its own, the player's seven); no stage
// stuck (each step moves the save on; the save read back at every stop shows the same screen); a save read back at
// those stops plays on exactly as one that never was; the save no bigger than FULL's.
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'
import { seeded } from '../../src/lib/rng'

const N = Number(process.argv[2] ?? 3), team = process.argv[3] ?? 'DEN'
FR.useContracts(CONTRACTS)
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua') ?? WRS.find(p => p.attrs)
const make = (team_ = team) => {
  const F = FR.createFranchise({ seed: 'light-' + team_, team: team_, owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }, { pos: 'wr', build: asBuild(wr), name: 'Tre Holloway', num: 81 }], coach: { name: 'Isaiah Vance', style: 'developer', r: { talentDev: 7, offPlaycalling: 8, defPlaycalling: 5, culture: 6, situational: 6 }, ovr: 78 } })
  F.games = 'advanced'
  return F
}
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const pack = F => { const at = F.at; F.at = 0; const s = FR.packFranchise(F); F.at = at; return s }
const reread = F => FR.depthOnLoad(FR.upgradeSave(FR.unpackFranchise(pack(F))))
// the state itself, keys in order (a save read back can hold the same fields in another order)
const canon = v => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v))
const stateOf = F => canon(JSON.parse(pack(F)))
// what the screen shows at a stop (FranchiseMode/Hub read nothing else to decide it)
const screen = F => JSON.stringify({ ph: F.phase, wk: F.wk, st: F.stage ?? null, lt: F.lt?.ph ?? null, k: F.lt?.k ?? null, big: F.lt?.big ?? null, ev: F.ev?.id ?? null, pend: !!F.pend, fad: F.fad ?? null, rs: (F.rs ?? []).length, dr: F.dr ? [F.dr.ph, F.dr.at, !!F.dr.over] : null, po: F.po ? [F.po.rd, F.po.champ ?? null] : null })
const stops = { n: 0, same: 0, norm: new Set(), lt: 0 }
// At a stop: the save read back must show the same screen. With `swap` (or swap(tag) true), play on from the
// read-back copy; `exactOnly`: only where reading it back changes nothing at all (FULL's own loader adds a kicker to a
// team without one, index.js kickersOnLoad, which it does during re-sign and free agency: FULL's behavior, kept)
function stop(F, swap, tag, exactOnly = false) {
  const G = reread(F)
  stops.n++
  if (screen(G) === screen(F)) stops.same++
  else bad(`${tag}: read back shows ${screen(G)}, was ${screen(F)}`)
  const exact = stateOf(G) === stateOf(F)
  if (!exact) stops.norm.add(tag.replace(/^\d+ /, ''))
  stops.lt = Math.max(stops.lt, JSON.stringify(F.lt ?? null).length + JSON.stringify(F.pace ?? null).length)
  const want = typeof swap === 'function' ? swap(tag) : swap
  return want && (exact || !exactOnly) ? G : F
}
const r1 = v => Math.round(v * 10) / 10
const C_parts = []
// where a save's bytes go: its top-level parts, and the men's careers and rows
function partsOf(F) {
  const P = JSON.parse(pack(F)), out = {}
  for (const [k, v] of Object.entries(P)) out[k] = JSON.stringify(v ?? null).length
  out._careers = FR.SHORTS.reduce((a, s) => a + F.teams[s].r.filter(p => p.cr).reduce((b, p) => b + JSON.stringify(p.cr).length, 0), 0)
  out._men = FR.SHORTS.reduce((a, s) => a + F.teams[s].r.length, 0)
  return out
}

// ── One LIGHT franchise, the screens' calls ──────────────────────────────────
function playLight({ swap = false, log = false, exactOnly = false }) {
  let F = make()
  FR.lightInit(F)
  const H = seeded('light-calls')
  const out = { seasons: [], evs: 0, midEv: 0, stretches: 0, bigLive: 0, moments: 0, sizes: [] }
  for (let y = 0; y < N; y++) {
    const yr = F.year, S0 = { evs: 0 }
    // ── the season: three stretches (the second season sims to the playoffs after its first stretch: SIM TO THE PLAYOFFS)
    for (let g = 0; g < 12 && F.phase === 'season'; g++) {
      const L = F.lt
      if (!FR.stretchOk(F)) { bad(`${yr} wk ${F.wk}: no stretch open (${JSON.stringify(L)})`); FR.openStretch(F) }
      if (F.lt.ph !== 'card') { bad(`${yr}: the season card on ${F.lt.ph}`); break }
      F = stop(F, swap, `${yr} stretch ${F.lt.k} card`, exactOnly)
      if (y === 1 && F.lt.k === 1) { FR.lightSimAll(F); break }
      if (F.ev) { S0.evs++; out.evs++; FR.chooseEvent(F, H() < 0.5 ? 0 : 1) }
      const { k, w0, w1 } = F.lt
      // (LIGHT never goes into a game: the stretch is simmed to its recap in one call, no moment, no Gameday)
      const r = FR.lightPlay(F)
      if (!r) { bad(`${yr} stretch ${k}: lightPlay did nothing`); break }
      if (r.pending || r.row || F.pend) { out.bigLive++; bad(`${yr} stretch ${k}: a game left on screen`) }
      if (F.lt.ph !== 'recap') { bad(`${yr} stretch ${k}: no recap (${F.lt.ph})`); break }
      if (F.ev) { out.midEv++; bad(`${yr} stretch ${k}: a front-office call left at the recap`) }
      if (Math.min(F.wk, 18) !== w1) bad(`${yr} stretch ${k}: ended on week ${F.wk}, not ${w1}`)
      const X = FR.stretchRecap(F)
      const games = F.sched.weeks.slice(w0, w1).filter(wk => wk.some(x => x.h === team || x.a === team)).length
      if (X.rows.length !== games || X.w + X.l + X.t !== games) bad(`${yr} stretch ${k}: ${X.rows.length} results for ${games} games`)
      if (X.rows.some(row => !row.bx)) bad(`${yr} stretch ${k}: a game without its box score`)
      if (X.builds.some(b => b.gp && !b.line)) bad(`${yr} stretch ${k}: a build's line missing`)
      if (log) console.log(`   ${yr} ${FR.stretchText(k)}: ${X.w}-${X.l}${X.t ? `-${X.t}` : ''} · ${X.hurt.length} hurt · ${X.wire.length} wire · ${X.place} in the ${FR.DIV_OF[team]} · builds ${X.builds.map(b => b.line).join(' / ')}`)
      out.stretches++
      F = stop(F, swap, `${yr} stretch ${k} recap`, exactOnly)
      FR.lightNext(F)
    }
    if (F.phase === 'post') { if (!FR.intoPlayoffs(F)) FR.simPlayoffs(F) }
    if (S0.evs > 3) bad(`${yr}: ${S0.evs} front-office calls in a season of three stretches`)
    // every week played
    const recs = FR.records(F)
    for (const s of FR.SHORTS) { const x = recs[s]; if (x.w + x.l + x.t !== 17) bad(`${yr} ${s} played ${x.w + x.l + x.t}`) }
    if (F.log.filter(row => row.wk != null).length !== 17) bad(`${yr}: ${F.log.length} rows in the log`)
    // ── the playoffs, a round a tap (lightRound: simmed, the player's game with its box score)
    for (let g = 0; g < 6 && F.phase === 'playoffs'; g++) {
      F = stop(F, swap, `${yr} playoffs`, exactOnly)
      const rd = F.po.rd, alive = FR.userAlive(F)
      const r = FR.lightRound(F)
      if (!r || r.pending || F.pend) { out.bigLive++; bad(`${yr} playoffs: round ${rd} left a game on screen`) }
      if (alive && !r?.out && !FR.userBye(F) && r?.row && !r.row.bx) bad(`${yr} playoffs: round ${rd} without its box score`)
      out.rounds = (out.rounds ?? 0) + 1
    }
    if (F.phase !== 'done') bad(`${yr}: the playoffs ended on ${F.phase}`)
    const lead = leaders(F)
    FR.closeSeason(F)
    // ── offseason 1: staff & awards
    F = stop(F, swap, `${yr} staff & awards`, exactOnly)
    if (FR.lightStep(F) !== 0) bad(`${yr}: offseason opens on step ${FR.lightStep(F)}`)
    const aw = F.aw
    if (!aw?.mvp || !aw.opoy || !aw.dpoy || !aw.oroy || !aw.droy || (aw.ap ?? []).length < 20) bad(`${yr}: awards missing ${JSON.stringify(Object.keys(aw ?? {}))} ap ${aw?.ap?.length}`)
    const fire = { oc: H() < 0.4, dc: H() < 0.4 }
    const was = FR.staffMen(F, team)
    if (!FR.lightStaff(F, fire)) bad(`${yr}: lightStaff did nothing`)
    const M = FR.staffMen(F, team)
    if (!M.oc || !M.dc) bad(`${yr}: a coordinator job left open`)
    for (const k of ['oc', 'dc']) if (fire[k] && was[k] && M[k]?.i === was[k].i) bad(`${yr}: fired ${k} still on the staff`)
    if (!F.car?.done) bad(`${yr}: the carousel never closed`)
    for (const s of FR.SHORTS) { const T = FR.staffMen(F, s); if (!T.hc || !T.oc || !T.dc) bad(`${yr} ${s}: a staff not full after the carousel`) }
    if (F.stage !== 'fa' || !F.fad) bad(`${yr}: roster step on ${F.stage}/${F.fad}`)
    // ── offseason 2: the roster (the pre-set calls, one flipped now and then; offers on the best fits that fit)
    F = stop(F, swap, `${yr} roster`, exactOnly)
    const calls = { ...F.lt.rs }
    const ids = Object.keys(calls)
    // (a team already over the cap before any call, e.g. Denver's real contracts: the pre-set calls must not make it
    // worse; keeping a minimum-salary man can even help, he fills one of the 53's minimum spots)
    if (FR.lightRoom(F).left < -1e-9 && FR.lightRoom(F).spend > 0 && FR.lightRoom(F).left < FR.lightRoom(F, {}, {}).left - 1e-9) bad(`${yr}: the pre-set calls are over the cap (${FR.lightRoom(F).left})`)
    // (the screen's toggle: a Keep only when it fits, canKeep)
    if (ids.length && H() < 0.5) { const id = ids[Math.floor(H() * ids.length)]; const p = F.teams[team].r.find(x => x.i === +id); if (p && p.b == null) { const c = calls[id], to = c === true ? false : c === false ? true : c === 'option' ? 'decline' : 'option'; if (!(to === true || to === 'option') || FR.canKeep(F, p, to)) F.lt.rs[id] = to } }
    const V = FR.lightView(F)
    const fits = FR.marketFits(F, V)
    if (fits.length < 6) bad(`${yr}: ${fits.length} free agents on the market's list`)
    for (const x of fits.slice(0, 4)) { const fo = FR.fairOffer(F, x.p, V); if (FR.canOffer(F, x.p, fo.o)) F.lt.off[x.p.i] = fo.o }
    const nOff = Object.keys(F.lt.off).length, rs = (F.rs ?? []).length
    const before = new Set(F.teams[team].r.map(p => p.i))
    const kept = Object.entries(F.lt.rs).filter(([, c]) => c === true || c === 'option').map(([i]) => +i)
    FR.lightFA(F)
    if (F.fad || F.stage !== 'fa') bad(`${yr}: free agency still open`)
    if ((F.rs ?? []).length) bad(`${yr}: ${F.rs.length} deals still up after the roster step`)
    if ((F.lt.far ?? []).length !== nOff) bad(`${yr}: ${nOff} offers, ${(F.lt.far ?? []).length} answers`)
    // (nobody signed or cut that the player didn't choose, beyond FULL's own engine: the men he kept are there)
    for (const id of kept) if (!F.teams[team].r.some(p => p.i === id)) bad(`${yr}: kept man ${id} gone`)
    const signed = F.teams[team].r.filter(p => !before.has(p.i))
    const offered = new Set(Object.keys(F.lt.off).map(Number))
    for (const p of signed) if (!offered.has(p.i)) bad(`${yr}: ${p.n} signed without an offer`)
    const capNow = FR.capRoom(F, team)
    if (log) console.log(`   ${yr} offseason: room ${capNow} · fired ${Object.keys(fire).filter(k => fire[k]).join('+') || 'nobody'} · ${rs} deals up, kept ${kept.length} · ${nOff} offers: ${(F.lt.far ?? []).map(x => `${x.n} ${x.k}${x.to ? ` ${x.to}` : ''}`).join(', ')}`)
    F = stop(F, swap, `${yr} free agency done`, exactOnly)
    // ── offseason 3: the draft
    if (!FR.lightOpenDraft(F)) bad(`${yr}: lightOpenDraft did nothing`)
    if (F.stage !== 'draft' || !F.sc?.cmb) bad(`${yr}: the draft opened without the combine`)
    if ((F.sc?.ivd?.length ?? 0) < 20) bad(`${yr}: ${F.sc?.ivd?.length} top-30 visits`)
    F = stop(F, swap, `${yr} draft week`, exactOnly)
    FR.startNight(F)
    for (let g = 0; g < 400 && !FR.draftDone(F); g++) {
      FR.cpuPicks(F)
      if (FR.draftDone(F)) break
      if (FR.roundOf(F.dr.at) <= 3) {
        if (FR.roundOf(F.dr.at) === 2) F = stop(F, swap, `${yr} draft night`, exactOnly)
        if (H() < 0.5) FR.autoPick(F)
        else { const best = [...F.dc].sort((a, b) => FR.viewOf(F, b).my - FR.viewOf(F, a).my)[0]; FR.userPick(F, best.i) }
      } else FR.simRest(F)
    }
    if (!FR.draftDone(F)) bad(`${yr}: the draft never finished`)
    const picks = F.dr.picks
    if (picks.length !== FR.PICKS_N || new Set(picks.map(p => p.pid)).size !== FR.PICKS_N) bad(`${yr}: ${picks.length} picks`)
    const mine = picks.filter(p => p.s === team)
    if (mine.length !== 7) bad(`${yr}: the ${team} made ${mine.length} picks`)
    if (F.dr.tr.some(t => t.mine)) bad(`${yr}: a draft trade by the player`)
    for (const s of FR.SHORTS) { const own = F.dr.own.filter(x => x === s).length, made = picks.filter(p => p.s === s).length; if (own !== made) bad(`${yr} ${s}: owned ${own} picks, made ${made}`) }
    const cpuTrades = F.dr.tr.length
    F.dr.over = 1
    F = stop(F, swap, `${yr} draft class`, exactOnly)
    FR.lightNewSeason(F)
    if (F.phase !== 'season' || F.lt?.ph !== 'card' || F.lt.k !== 0 || F.nextEv < 18) bad(`${yr + 1}: the new season didn't open its first stretch`)
    // contracts and the cap at a new season
    for (const s of FR.SHORTS) {
      for (const p of F.teams[s].r) if (!(p.y > 0) || !(p.$ > 0)) { bad(`${F.year} ${s}: ${p.n} with no deal (${p.$} x ${p.y})`); break }
      const room = FR.capRoom(F, s)
      if (room < (s === team ? -25 : 0)) bad(`${F.year} ${s} ${-room}M over the cap`)
    }
    const frec = F.frec ?? {}
    if (!frec.py?.[0] || !frec.ry?.[0] || !frec.sck?.[0]) bad(`${F.year}: franchise records missing ${JSON.stringify(frec)}`)
    out.sizes.push(pack(F).length); (out.parts ??= []).push(partsOf(F))
    out.seasons.push({ y: yr, rec: F.hist[F.hist.length - 1], lead, aw: { mvp: aw.mvp?.n, mvpP: aw.mvp?.p, opoy: aw.opoy?.n }, picks: mine.map(p => `${p.p}${FR.roundOf(p.at)}`).join(' '), cpuTrades })
  }
  return { F, out }
}
// the league's leaders and its points (realism.mjs's numbers)
function leaders(F) {
  const tot = FR.leagueStats(F)
  const top = (k, f = () => true) => Math.max(0, ...Object.entries(tot).filter(([id]) => f(id)).map(([, t]) => t[k] ?? 0))
  const qbs = new Set(FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.p === 'qb').map(p => String(p.i))))
  let pts = 0, gms = 0
  for (const wk of F.sched.weeks) for (const g of wk) if (g.hs != null) { pts += g.hs + g.as; gms += 2 }
  return { py: top('py', id => qbs.has(id)), ptd: top('ptd', id => qbs.has(id)), ry: top('ry'), ryd: top('ryd'), sck: top('sck'), dint: top('dint'), fgm: top('fgm'), ppg: r1(pts / gms) }
}
const RANGE = { py: [3600, 5700], ptd: [25, 56], ry: [1100, 2300], ryd: [1200, 2250], sck: [10, 25], dint: [4, 13], fgm: [26, 50], ppg: [19, 26] }

// ── The same franchise, FULL: sim.mjs's calls ────────────────────────────────
function playFull() {
  const F = make()
  const H = seeded('hits')
  const seasons = [], sizes = []
  for (let y = 0; y < N; y++) {
    while (F.phase === 'season') { const r = FR.playWeek(F, { moments: true }); if (r.pending) while (F.pend) FR.finishMoment(F, null); if (F.ev) FR.chooseEvent(F, H() < 0.5 ? 0 : 1) }
    FR.intoPlayoffs(F)
    while (F.phase === 'playoffs') { const r = FR.playWeek(F, { moments: true }); if (r.pending) while (F.pend) FR.finishMoment(F, null) }
    const lead = leaders(F)
    FR.closeSeason(F); FR.closeCarousel(F); FR.ageLeague(F); FR.openResign(F)
    for (const id of [...F.rs]) { const p = F.teams[team].r.find(x => x.i === id); if (FR.optionDue(p)) { FR.resignOne(F, id, p.o >= 80 ? 'option' : 'decline'); continue } FR.resignOne(F, id, p.b != null || (p.o >= 76 && FR.canSign(F, FR.resignAsk(p, F).$))) }
    FR.openFA(F)
    while (F.fad) { const p = FR.faBoard(F, 8).find(x => FR.canSign(F, x.$) && x.o >= 78); if (p) FR.placeBid(F, p.i, p.$); FR.nextFADay(F) }
    FR.openDraft(F)
    for (const x of FR.consensus(F).slice(0, 5)) { FR.interview(F, x.i); FR.film(F, x.i); FR.star(F, x.i) }
    FR.startNight(F)
    while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
    FR.closeDraft(F); FR.newSeason(F)
    sizes.push(pack(F).length); C_parts.push(partsOf(F))
    seasons.push({ lead })
  }
  return { F, seasons, sizes }
}

const t0 = performance.now()
const A = playLight({ log: true })
const t1 = performance.now()
console.log(`LIGHT: ${N} seasons in ${((t1 - t0) / 1000).toFixed(1)} s · ${A.out.stretches} stretches · ${A.out.evs} front-office calls (${A.out.midEv} mid-stretch) · ${A.out.rounds ?? 0} playoff taps · ${A.out.bigLive} games left on screen (0 wanted)`)
for (const s of A.out.seasons) {
  console.log(`   ${s.y}: ${s.rec.w}-${s.rec.l}${s.rec.t ? `-${s.rec.t}` : ''} ${s.rec.fin} · MVP ${s.aw.mvp} (${s.aw.mvpP}) · OPOY ${s.aw.opoy} · drafted ${s.picks} · CPU draft trades ${s.cpuTrades}`)
  console.log(`      leaders: ${Object.entries(s.lead).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  for (const [k, [lo, hi]] of Object.entries(RANGE)) if (s.lead[k] < lo || s.lead[k] > hi) bad(`${s.y}: the ${k} leader at ${s.lead[k]} (FULL's range ${lo}-${hi})`)
}
// a save read back at every stop plays on exactly the same (every stop where reading it back changes nothing); and
// read back at every stop at all, it plays every season through with the same screens
const B = playLight({ swap: true, exactOnly: true })
const same = stateOf(A.F) === stateOf(B.F)
if (!same && process.env.LT_BISECT) {
  for (const key of ['card', 'recap', 'playoffs', 'staff', 'roster', 'free agency done', 'draft week', 'draft night', 'draft class']) {
    const Z = playLight({ swap: tag => tag.endsWith(key) || tag.includes(key + ' '), exactOnly: true })
    console.log(`   reading back only at "${key}": ${stateOf(Z.F) === stateOf(A.F) ? 'same' : 'DIFFERENT'}`)
  }
}
const before = problems.length
const Z = playLight({ swap: true })
const allDone = Z.F.year === A.F.year && Z.F.phase === 'season' && problems.length === before
console.log(`read back at every stop: ${stops.same}/${stops.n} stops showed the same screen · played on from the read-back saves: ${same ? 'the same franchise, field for field' : 'DIFFERENT'} · read back at every stop including ${[...stops.norm].join(', ') || 'none'} (FULL's loader adds kickers there): ${allDone ? `all ${N} seasons played through` : 'STUCK'}`)
if (!same) bad('a LIGHT save read back mid-season, mid-offseason or mid-draft played on differently')
if (!allDone) bad('a LIGHT save read back at every stop did not play through')
console.log(`LIGHT's own fields in the save (F.lt, F.pace): ${stops.lt} bytes at most`)
// FULL beside it
const C = playFull()
console.log('FULL, the same franchise:')
for (const [i, s] of C.seasons.entries()) console.log(`   ${A.out.seasons[i].y}: leaders ${Object.entries(s.lead).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log(`save size at each new season (KB): LIGHT ${A.out.sizes.map(v => (v / 1024).toFixed(1)).join(' ')} · FULL ${C.sizes.map(v => (v / 1024).toFixed(1)).join(' ')}`)
for (let i = 0; i < N; i++) {
  const a = A.out.parts[i], c = C_parts[i]
  const d = Object.keys({ ...a, ...c }).map(k => [k, (a[k] ?? 0) - (c[k] ?? 0)]).filter(([, v]) => Math.abs(v) >= 300).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
  console.log(`   season ${i + 1}: LIGHT - FULL by part: ${d.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' · ')}`)
}
// (the two leagues play out differently, so a season's save can be a little bigger either way: more coaching moves,
// more careers; the check is LIGHT's own fields and the saves over all the seasons)
const sum = a => a.reduce((x, y) => x + y, 0)
if (sum(A.out.sizes) > sum(C.sizes) * 1.01) bad(`the LIGHT saves ${sum(A.out.sizes)} bytes over ${N} seasons, FULL's ${sum(C.sizes)}`)
if (stops.lt > 2048) bad(`LIGHT's own fields ${stops.lt} bytes`)
// a save from before LIGHT stopped going into games: on its big game, a moment waiting (lightSettle sims it on)
{
  const F = make(); FR.lightInit(F)
  let pend = false
  for (let g = 0; g < 6 && !pend; g++) { const r = FR.playWeek(F, { moments: true }); pend = !!r.pending }
  F.lt.ph = 'big'; F.lt.big = F.wk
  FR.lightSettle(F)
  const ok = !F.pend && F.lt.ph === 'recap' && !('big' in F.lt) && Math.min(F.wk, 18) === F.lt.w1
  console.log(`an old save on its big game${pend ? ', a moment waiting' : ''}: ${ok ? 'simmed on to the recap' : `STUCK (${F.lt.ph}, week ${F.wk + 1})`}`)
  if (!ok) bad('an old LIGHT save on its big game did not sim on to the recap')
}
// THE TERMS (owner 11-18): a man kept at 5% or 10% under his ask, over other years; an offer Strong over other years.
// A discount taken signs at that price; one turned down sends him to the market (his ask, his day), where the player
// can still make him an offer; years move the price the market's way; the same save gives the same answers.
// (New England: a team with the room to make real offers; the check's own Denver starts over the cap)
{
  const team = 'NE'
  const F = make(team); FR.lightInit(F); F.ev = null
  FR.lightSimAll(F); FR.intoPlayoffs(F); FR.simPlayoffs(F)
  FR.closeSeason(F); FR.lightStaff(F, {})
  const t = F.teams[team]
  // (the yes rate over the whole league at each step under his ask: about 70% and 35%)
  const all = FR.SHORTS.flatMap(s => F.teams[s].r).filter(p => p.b == null)
  const rate = d => all.filter(p => FR.takesIt(F, p, d)).length / all.length
  const r5 = rate(1), r10 = rate(2)
  console.log(`terms: he takes 5% under ${(r5 * 100).toFixed(0)}% of the time, 10% under ${(r10 * 100).toFixed(0)}% (${all.length} men)`)
  if (r5 < 0.6 || r5 > 0.8 || r10 < 0.25 || r10 > 0.45) bad(`terms: yes rates ${r5.toFixed(2)} / ${r10.toFixed(2)}`)
  // every man up for a deal kept (a build's price can't drop), so there's a man to say yes and one to say no
  const men = (F.rs ?? []).map(i => t.r.find(x => x.i === i)).filter(p => p && p.b == null && !FR.optionDue(p))
  for (const p of men) F.lt.rs[p.i] = true
  let yes = null, no = null
  for (const d of [1, 2]) for (const p of men) {
    if (!yes && FR.takesIt(F, p, d)) yes = [p, d]
    else if (!no && p !== yes?.[0] && !FR.takesIt(F, p, d)) no = [p, d]
  }
  const yrsMan = men.find(p => p !== yes?.[0] && p !== no?.[0])
  // (the rest let go, so the offers have room to be real ones)
  for (const p of men) if (p !== yes?.[0] && p !== no?.[0] && p !== yrsMan) F.lt.rs[p.i] = false
  if (!yes || !no || !yrsMan) bad(`terms: ${men.length} men up, no yes/no/years man to test`)
  else {
    const room0 = FR.lightRoom(F).left
    const askY = FR.keepTerms(F, yes[0]).ask
    F.lt.tm = { [yes[0].i]: { d: yes[1], y: askY.y } }
    const kY = FR.keepTerms(F, yes[0])
    if (!(Math.abs(kY.$ - Math.max(FR.minimumFor(yes[0].ag, F.year + 1), r1(askY.$ * (1 - [0, 0.05, 0.1][yes[1]])))) < 0.051)) bad(`terms: ${yes[0].n} at ${kY.$}, ask ${askY.$}, ${yes[1]} steps under`)
    if (!(FR.lightRoom(F).left > room0 - 1e-9)) bad('terms: the cap line did not use the lower price')
    F.lt.tm[no[0].i] = { d: no[1] }
    const kN = FR.keepTerms(F, no[0])
    const ask3 = FR.resignAsk(yrsMan, F), y3 = ask3.y >= 5 ? ask3.y - 1 : ask3.y + 1
    F.lt.tm[yrsMan.i] = { d: 0, y: y3 }
    const k3 = FR.keepTerms(F, yrsMan)
    if (k3.y !== y3 || Math.abs(FR.worthOf(yrsMan, { $: k3.$, y: y3 }) - FR.worthOf(yrsMan, { $: ask3.$, y: ask3.y })) > 0.06 * ask3.$) bad(`terms: ${yrsMan.n} over ${y3} years at ${k3.$} is not the same deal as ${ask3.$} x ${ask3.y}`)
    if (!FR.canKeep(F, yrsMan, true)) console.log('   (the years man no longer fits: the room is short)')
    // a Strong offer on the best fit, over a year more
    const V = FR.lightView(F), fits0 = FR.marketFits(F, V), x = fits0.find(z => FR.canOffer(F, z.p, FR.offerFor(F, z.p, FR.fairOffer(F, z.p, V).o, { s: 1, y: Math.min(5, z.p.y + 1) }))) ?? fits0[0]
    const fair = FR.fairOffer(F, x.p, V)
    const strong = FR.offerFor(F, x.p, fair.o, { s: 1, y: fair.o.y })
    const strong2 = FR.offerFor(F, x.p, fair.o, { s: 1, y: Math.min(5, fair.o.y + 1) })
    if (Math.abs(strong.$ - r1(fair.o.$ * 1.1)) > 0.051 || strong.y !== fair.o.y) bad(`terms: Strong ${strong.$} vs Fair ${fair.o.$}`)
    if (FR.offerFor(F, x.p, fair.o, { s: 0, y: fair.o.y }) !== fair.o) bad('terms: Fair at his years is not the market\'s own offer')
    const st0 = FR.standingOf(F, x.p, fair.o, V), st1 = FR.standingOf(F, x.p, strong, V)
    if (!(st1.mine.v > st0.mine.v)) bad('terms: a Strong offer did not stand better than Fair')
    F.lt.fc = { [x.p.i]: { s: 1, y: strong2.y } }
    F.lt.off = { [x.p.i]: strong2 }
    const G = reread(F), G2 = reread(F)
    const run = H => {
      const r = FR.lightFA(H)
      const L = H.lt
      return { r, L }
    }
    const a = run(F)
    if (a.r !== null) bad('terms: a man turned it down, but the market ran without a stop')
    const py = t.r.find(p => p.i === yes[0].i), p3 = t.r.find(p => p.i === yrsMan.i)
    if (!py || py.$ !== kY.$ || py.y !== kY.y) bad(`terms: ${yes[0].n} signed at ${py?.$} x ${py?.y}, not ${kY.$} x ${kY.y}`)
    if (!p3 || p3.$ !== k3.$ || p3.y !== y3) bad(`terms: ${yrsMan.n} signed at ${p3?.$} x ${p3?.y}, not ${k3.$} x ${y3}`)
    const pn = (F.fa ?? []).find(p => p.i === no[0].i)
    if (!pn || t.r.some(p => p.i === no[0].i) || !F.fdd?.[no[0].i]) bad(`terms: ${no[0].n} turned it down but isn't on the market`)
    else if (Math.abs(pn.$ - FR.resignAsk(pn, F).$) > 0.051) bad(`terms: ${no[0].n} on the market at ${pn.$}, not his ask`)
    if (a.L.rsx?.[yes[0].i]?.[0] !== 1 || a.L.rsx?.[no[0].i]?.[0] !== 0) bad(`terms: the answers ${JSON.stringify(a.L.rsx)}`)
    // the player can still bid on him there; the next tap runs the market
    const fo = FR.fairOffer(F, pn ?? no[0])
    F.lt.off = { ...F.lt.off, [no[0].i]: fo.o }
    const far = FR.lightFA(F)
    if (F.fad || !far) bad('terms: the market did not run on the second tap')
    const ans = (far ?? []).find(z => z.i === no[0].i)
    if (!ans) bad(`terms: no answer to the offer on ${no[0].n} on the market`)
    const strongAns = (far ?? []).find(z => z.i === x.p.i)
    if (!strongAns) bad('terms: no answer to the Strong offer')
    console.log(`terms: ${yes[0].n} took ${[0, 5, 10][yes[1]]}% under (${kY.$} x ${kY.y}, ask ${askY.$}) · ${no[0].n} turned down ${kN.$} (${[0, 5, 10][no[1]]}% under), on the market, the player's offer ${ans?.k}${ans?.to ? ` ${ans.to}` : ''} · ${yrsMan.n} over ${y3} years at ${k3.$} (ask ${ask3.$} x ${ask3.y}) · Strong on ${x.p.n} ${strong2.$} x ${strong2.y} (Fair ${fair.o.$} x ${fair.o.y}, ${st0.k} → ${st1.k}): ${strongAns?.k}`)
    // the same save, the same answers
    // (two copies read back from the same save play field for field the same; F itself, never read back, gives the same
    // answers and the same signings: FULL's loader can add a kicker on reading, which moves the market's scores a hair)
    for (const H of [G, G2]) { run(H); H.lt.off = { ...H.lt.off, [no[0].i]: fo.o }; FR.lightFA(H) }
    const same = stateOf(G) === stateOf(G2) && JSON.stringify(G.lt.rsx) === JSON.stringify(F.lt.rsx) && JSON.stringify(G.lt.far.map(z => [z.i, z.k, z.to])) === JSON.stringify(F.lt.far.map(z => [z.i, z.k, z.to]))
    console.log(`terms: the same save read back plays the same: ${same ? 'yes' : `DIFFERENT (copies ${stateOf(G) === stateOf(G2)}, answers ${JSON.stringify(G.lt.rsx) === JSON.stringify(F.lt.rsx)}, market ${JSON.stringify(G.lt.far.map(z => [z.i, z.k, z.to])) === JSON.stringify(F.lt.far.map(z => [z.i, z.k, z.to]))})`}`)
    if (!same) bad('terms: the same save gave different answers')
  }
}
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
