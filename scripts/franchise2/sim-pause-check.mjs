// A sim run stops for a trade call (owner 11-28), headless, both sports, FULL and LIGHT:
//   football  simWeeks / lightPlay / lightSimAll with { calls: true } (trades.js callWatch, callCheck)
//   NBA       simTo(F, day, watch) / lightPlay / lightSimAll with { calls: true } (nba/season.js callWatch, callCheck)
// Checks: a 'call' stop lands the week (night) the offer came in; the GM leaves a call alone and the next run stops
// again on its last week (day) to answer ('answer'); a FULL run replayed a week (night) at a time on a twin of the
// save never went past a call or an offer's last week before the one it stopped on; LIGHT stops on its card; and the
// plain sims (no calls: the checks' and the engine's own) still never stop.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/sim-pause-check.mjs [seeds=3]
import * as FR from '../../src/lib/franchise2/index'
import * as N from '../../src/lib/franchise2/nba/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'

const SEEDS = +(process.argv[2] ?? 3)
let bad = 0
const fail = (...m) => { bad++; console.log('  FAIL', ...m) }
FR.useContracts(CONTRACTS)
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua') ?? WRS.find(p => p.attrs)
const makeFb = (seed, team) => {
  const F = FR.createFranchise({ seed, team, owner: 'G', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }, { pos: 'wr', build: asBuild(wr), name: 'Tre Holloway', num: 81 }], coach: { name: 'Isaiah Vance', style: 'developer', r: { talentDev: 7, offPlaycalling: 8, defPlaycalling: 5, culture: 6, situational: 6 }, ovr: 78 } })
  F.games = 'off'
  return F
}

// ── Football ────────────────────────────────────────────────────────────────
// A FULL run checked against a twin of the save played a week (night) at a time from where the run started: on no
// week before the one the run stopped on did a new call come in, or an offer it started with reach its last week to
// answer (the run never went past one); and the twin ends where the run did, with the same offers.
function fbTwin(T, F, tag) {
  const ids0 = new Set(FR.tradeOffers(T).map(o => o.id))
  const last0 = new Set(FR.tradeOffers(T).filter(o => o.exp != null && T.wk >= o.exp - 1).map(o => o.id))
  const n = F.wk - T.wk
  for (let j = 1; j <= n; j++) {
    FR.playWeek(T, { moments: false }); T.ev = null
    if (j === n || T.phase !== 'season') break
    for (const o of FR.tradeOffers(T)) {
      if (!ids0.has(o.id)) fail(`football ${tag}: the run went past the ${o.s}' call at week ${T.wk} (stopped at ${F.wk})`)
      else if (o.exp != null && T.wk >= o.exp - 1 && !last0.has(o.id)) fail(`football ${tag}: the run went past the ${o.s}' last week to answer (week ${T.wk}, stopped at ${F.wk})`)
    }
  }
  const a = FR.tradeOffers(T).map(o => o.id).join(), b = FR.tradeOffers(F).map(o => o.id).join()
  if (T.wk !== F.wk || a !== b) fail(`football ${tag}: the twin ended at week ${T.wk} [${a}], the run at ${F.wk} [${b}]`)
}
function fbSeason(F, light) {
  const tag = `${light ? 'LIGHT' : 'FULL'} ${F.seed}`
  const seen = new Set()
  let stops = 0, calls = 0, answers = 0, guard = 0
  while (F.phase === 'season' && guard++ < 60) {
    if (F.ev) F.ev = null
    const wk0 = F.wk
    let c = null
    if (light) {
      if (F.lt?.ph === 'recap') { FR.lightNext(F); if (F.ev) F.ev = null; continue }
      if (F.lt?.ph !== 'card' || !FR.stretchOk(F)) FR.openStretch(F)
      if (F.ev) F.ev = null
      // (one run in three is the sim to the playoffs, the rest the stretch)
      const r = guard % 3 === 0 ? FR.lightSimAll(F, { calls: true }) : FR.lightPlay(F, { calls: true })
      c = r?.call ?? null
    } else {
      const T = structuredClone(F)
      c = FR.simWeeks(F, { calls: true }).call ?? null
      fbTwin(T, F, tag)
    }
    for (const o of FR.tradeOffers(F)) seen.add(o.id)
    if (!c) continue
    stops++
    const o = FR.tradeOffers(F).find(x => x.id === c.id)
    if (!o) { fail(`${tag}: stopped for an offer that isn't on the table`); continue }
    if (F.wk === wk0) fail(`${tag}: a run that played no week`)
    if (c.why === 'call') {
      calls++
      if (o.wk !== F.wk) fail(`${tag}: stopped at week ${F.wk} for a call made at week ${o.wk}`)
      if (light && F.lt?.ph !== 'card') fail(`${tag}: LIGHT stopped off its card`)
    } else {
      answers++
      if (F.wk !== o.exp - 1) fail(`${tag}: an answer stop at week ${F.wk}, the offer's last week is ${o.exp - 1}`)
      // (the GM turns it down; a new call is left alone, so the next run has to come back to it)
      FR.answerOffer(F, o.id, false)
    }
  }
  if (F.phase === 'season') fail(`${tag}: the season never finished`)
  console.log(`  football ${tag}: ${stops} stops (${calls} calls, ${answers} last-week answers), ${seen.size} offers`)
  return stops
}

// ── NBA ─────────────────────────────────────────────────────────────────────
const keyOf = o => `${o.s}-${o.d}-${o.y}-${o.deal.ga[0]}`
const lastOf = (F, o) => Math.min(o.until, F.ddl ?? o.until)
function nbTwin(T, F, tag) {
  const o0 = N.CAP_SIM.offerNow(T)
  const k0 = o0 ? keyOf(o0) : null, last0 = !!o0 && T.day >= lastOf(T, o0)
  const n = F.day - T.day
  for (let j = 1; j <= n; j++) {
    N.playDay(T)
    if (j === n || T.phase !== 'season') break
    const o = N.CAP_SIM.offerNow(T)
    if (!o) continue
    if (keyOf(o) !== k0) fail(`NBA ${tag}: the run went past the ${o.s} call on day ${T.day} (stopped on ${F.day})`)
    else if (T.day >= lastOf(T, o) && !last0) fail(`NBA ${tag}: the run went past the ${o.s} offer's last day (day ${T.day}, stopped on ${F.day})`)
  }
  const a = N.CAP_SIM.offerNow(T), b = N.CAP_SIM.offerNow(F)
  if (T.day !== F.day || (a && keyOf(a)) !== (b && keyOf(b))) fail(`NBA ${tag}: the twin ended on day ${T.day}, the run on ${F.day}`)
}
function nbSeason(F, light) {
  const tag = `${light ? 'LIGHT' : 'FULL'} ${F.seed}`
  let stops = 0, calls = 0, answers = 0, guard = 0
  const seen = new Set()
  while (F.phase === 'season' && guard++ < 400) {
    const d0 = F.day
    let c = null
    if (light) {
      if (F.lt?.ph === 'recap') { N.lightNext(F); continue }
      if (F.lt?.ph !== 'card' || !N.stretchOk(F)) N.openStretch(F, N.stretchOf(F))
      const r = guard % 3 === 0 ? N.lightSimAll(F, { calls: true }) : N.lightPlay(F, { calls: true })
      c = r?.call ?? null
    } else {
      // (the hub's runs: a week, to the deadline, to the end)
      const to = guard % 3 === 0 ? F.day + 7 : guard % 3 === 1 && F.day < F.ddl ? F.ddl : F.days
      const T = structuredClone(F)
      const w = N.callWatch(F)
      // (the hub runs it two nights a step: SimRun)
      while (F.phase === 'season' && F.day < to && !w.stop) N.simTo(F, Math.min(to, F.day + 2), w)
      c = w.stop
      nbTwin(T, F, tag)
    }
    const o = N.CAP_SIM.offerNow(F)
    if (o) seen.add(keyOf(o))
    if (!c) continue
    stops++
    if (!o || o.s !== c.s) { fail(`NBA ${tag}: stopped for a call that isn't up`); continue }
    if (F.day === d0) fail(`NBA ${tag}: a run that played no night`)
    if (c.why === 'call') {
      calls++
      if (F.day !== o.d + 1) fail(`NBA ${tag}: stopped on day ${F.day} for a call made the night of day ${o.d}`)
    } else {
      answers++
      if (F.day !== lastOf(F, o)) fail(`NBA ${tag}: an answer stop on day ${F.day}, the offer's last day is ${lastOf(F, o)}`)
      N.CAP_SIM.answerOffer(F, false)
    }
  }
  if (F.phase === 'season') fail(`NBA ${tag}: the season never finished`)
  console.log(`  NBA ${tag}: ${stops} stops (${calls} calls, ${answers} last-day answers), ${seen.size} offers`)
  return stops
}

let fbStops = 0, nbStops = 0
const FB_TEAMS = ['DEN', 'KC', 'DET', 'NYJ', 'SF'], NB_TEAMS = ['BOS', 'CHA', 'DEN', 'LAL', 'OKC']
for (let i = 0; i < SEEDS; i++) {
  fbStops += fbSeason(makeFb(`pause-f${i}`, FB_TEAMS[i % 5]), false)
  const L = makeFb(`pause-l${i}`, FB_TEAMS[(i + 2) % 5]); FR.lightInit(L); L.ev = null
  fbStops += fbSeason(L, true)
  nbStops += nbSeason(N.createNbaFranchise({ seed: `pause-n${i}`, team: NB_TEAMS[i % 5], owner: 'G' }), false)
  nbStops += nbSeason(N.createNbaFranchise({ seed: `pause-m${i}`, team: NB_TEAMS[(i + 2) % 5], owner: 'G', pace: 'light' }), true)
}
// the plain sims (the checks' and the engine's own) never stop
{
  const F = makeFb('pause-plain', 'DEN'); FR.simWeeks(F)
  if (F.phase === 'season') fail('football: a plain simWeeks stopped short')
  const B = N.createNbaFranchise({ seed: 'pause-plain', team: 'BOS', owner: 'G' }); N.simTo(B, B.days)
  if (B.phase === 'season') fail('NBA: a plain simTo stopped short')
}
if (!fbStops) fail('football: no run ever stopped for a call (nothing was tested)')
if (!nbStops) fail('NBA: no run ever stopped for a call (nothing was tested)')
console.log(bad ? `\n${bad} FAILED` : `\nall good (${fbStops} football stops, ${nbStops} NBA stops)`)
process.exit(bad ? 1 : 0)
