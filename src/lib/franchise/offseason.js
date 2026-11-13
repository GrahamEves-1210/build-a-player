// FRANCHISE: the offseason, in stages (consts.STAGES), each one played or handed to the staff:
//   review  awards, All-Pro and the Pro Bowl, retirements, the owner's verdict, the Hall of Fame
//   staff   the head coach, the coordinators, the scouting director, the GM's own tree
//   resign  expiring contracts: the PATIENCE / INTEREST negotiation, the franchise tag, fifth-year options
//   fa      free agency in three rounds; the best fit wins, not only the most money
//   draft   seven rounds (draft.js)
//   udfa    undrafted free agents
//   camp    three position drills (the combine mini games), holdouts
//   cuts    down to 46; then the league turns over: ages, progression and regression, the new schedule and goals
// The new league year (the cap, dead money, a year off every contract) starts when the review ends.
import { GAMES, COMBINE_GAMES, traitValue } from '../minigames'
import {
  STAGES, ROSTER_MAX, CAMP_MAX, REG_WEEKS, FIRST_YEAR, DEV, clamp, r2, slotOf, groupOf, ovrGrade, gradeOf, MIN_SALARY, VET_MIN, TARGET_AT, MIN_AT, GROUPS, TOP_SHARE,
} from './consts'
import { rngOf, roll } from './rng'
import {
  TEAM_SHORTS, touch, fail, ok, addNews, addTx, teamName, nick, teamRating, ranks, pct, toFreeAgency, joinTeam, activeCount, groupCounts, depthAfterMove, leaveTeam,
} from './core'
import { capFor, marketValue, marketYears, marketGuar, newContract, optionSalary, payroll, burnGuarantee, moneyText, cutCost } from './money'
import { standing, finishText } from './standings'
import { DIVISIONS, makeSchedule } from './schedule'
import { seasonAwards, setExpectations, AWARD_NAME } from './awards'
import { ownerVerdict, jobOffersFor, startOwner } from './owner'
import { histLine, statLine, LEADER_CATS } from './stats'
import { teamRef, playerRow, coachRow, depthMap, coachOvr } from './rows'
import { addCoach, coachAsk, builtCoachRow, topUpFreeAgents, drivesFor } from './league'
import { genName, asBuild, lastName, initials, traitLabel, reOvr } from './players'
import { ageOne, spendPoints, slipText } from './dev'
import { giveXp, prepWeek } from './week'
import { release, sign, upkeep, minDeal, fitUnderCap, capFix } from './roster'
import { autoDepth, lineupOf, startersOf } from './depth'
import { newDraftClass, startDraft, autoDraft, needsOf, udfaList, signUdfaTo, cpuUdfa, draftView, draftBoard, applyScoutSpec, prospectRow, draftOrder } from './draft'
import { rookieDeal } from './money'
import { powerRankings, moodOf } from './season'
import { playerValue } from './trades'
import { computeStates, stanceOf, teamState } from './state'
import { makeOffice } from './office'
import { staff as staffView, schedule as scheduleView } from './select'
import { askOf, ownerView, coachInterest } from './views'
import { COACH_TYPES } from './coachData'

const stageIdx = id => STAGES.findIndex(s => s.id === id)
const mine = F => F.teams[F.team].roster.map(id => F.players[id]).filter(Boolean)

// ══ The season ends ═══════════════════════════════════════════════════════════
const RETIRE_AT = { qb: 38, k: 40, rb: 31, ol: 34 }
function recordBook(F) {
  const book = (F.hist.records.season ??= {})
  const keys = { passYds: 'py', passTD: 'ptd', rushYds: 'ry', rushTD: 'rtd', rec: 'rc', recYds: 'cy', recTD: 'ctd', sacks: 'sa', ints: 'di', tackles: 'tk', fgm: 'fgm' }
  for (const id in F.players) {
    const p = F.players[id]
    if (!(p.s.g > 0)) continue
    for (const k in keys) { const v = p.s[keys[k]] ?? 0; if (v > (book[k]?.val ?? 0)) book[k] = { label: LEADER_CATS[k].label, val: v, name: p.name, team: p.team ?? '', year: F.year } }
  }
  const tb = (F.hist.records.team ??= {})
  for (const s of TEAM_SHORTS) {
    const r = F.teams[s].rec
    if (!r) continue
    if (r.w > (tb.wins?.val ?? 0)) tb.wins = { label: 'WINS', val: r.w, name: teamName(s), team: s, year: F.year }
    if (r.pf > (tb.points?.val ?? 0)) tb.points = { label: 'POINTS SCORED', val: r.pf, name: teamName(s), team: s, year: F.year }
    if (!(tb.allowed) || r.pa < tb.allowed.val) tb.allowed = { label: 'FEWEST POINTS ALLOWED', val: r.pa, name: teamName(s), team: s, year: F.year }
  }
}
function hallCase(p) {
  const c = code => (p.aw ?? []).filter(a => a[1] === code).length
  return c('MVP') * 5 + c('OPOY') * 3 + c('DPOY') * 3 + c('AP') * 2.2 + c('PB') * 0.8 + c('PROT') * 2 + (p.peak >= 97 ? 5 : p.peak >= 94 ? 3 : p.peak >= 91 ? 1 : 0) + (p.rings ?? 0) * 1
}
export function startOffseason(F) {
  const po = F.playoffs, y = F.year, user = F.team, S = standing(F)
  const R = rngOf(`${F.seed}-${y}-offseason`)
  // honors
  const honors = seasonAwards(F)
  recordBook(F)
  const champ = po?.champion ?? null
  if (champ) for (const id of F.teams[champ].roster) { const p = F.players[id]; if (p) { p.rings = (p.rings ?? 0) + 1; p.aw.push([y, 'SB']) } }
  // the GM's year, the coaches' year
  const rec = S.R[user], seedOf = s => { const c = po ? (po.seeds.AFC.includes(s) ? po.seeds.AFC : po.seeds.NFC) : []; return c.indexOf(s) + 1 }
  let pw = 0, pl = 0
  for (let w = REG_WEEKS; w < F.sched.weeks.length; w++) for (const g of F.sched.weeks[w] ?? []) if (g.hs != null && (g.h === user || g.a === user)) { const won = (g.h === user) === (g.hs > g.as); if (won) pw++; else pl++ }
  const gm = F.gm
  gm.w += rec.w; gm.l += rec.l; gm.t += rec.t; gm.pw = (gm.pw ?? 0) + pw; gm.pl = (gm.pl ?? 0) + pl
  if (champ === user) gm.rings = (gm.rings ?? 0) + 1
  gm.seasons.push({ year: y, team: user, w: rec.w, l: rec.l, t: rec.t, seed: seedOf(user) || 0, finish: finishText(F, user), champ: champ === user })
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s], r = S.R[s], hc = F.coaches[t.staff.hc]
    if (hc) { hc.w += r.w; hc.l += r.l }
    for (const k of ['hc', 'oc', 'dc']) { const c = F.coaches[t.staff[k]]; if (c) { (c.hist ??= []).push([y, s, k.toUpperCase(), r.w, r.l, champ === s ? 'Won the Super Bowl' : seedOf(s) ? 'Playoffs' : null]); if (c.hist.length > 12) c.hist.shift() } }
    t.hist.push([y, r.w, r.l, r.t, seedOf(s) || 0, champ === s ? 1 : 0])
    if (t.hist.length > 25) t.hist.shift()
    t.last = { w: r.w, l: r.l, t: r.t, seed: seedOf(s) || 0, out: po?.out?.[s] ?? null, champ: champ === s }
  }
  const verdict = ownerVerdict(F)
  // the league's history
  const who = x => (x ? { name: x.name, team: x.team, line: x.line, ...(x.pos && { pos: x.pos }) } : null)
  F.hist.seasons.push({ year: y, champ, runner: po?.runnerUp ?? null, score: po?.score ?? '', awards: Object.fromEntries(Object.entries(honors.awards).map(([k, v]) => [k, who(v)])),
    allPro: honors.allPro.map(x => ({ slot: x.slot, name: x.p.name, team: x.p.team })), user: { team: user, record: `${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}`, finish: finishText(F, user), seed: seedOf(user) || null } })
  if (F.hist.seasons.length > 40) F.hist.seasons.shift()
  if (champ) addNews(F, 'league', `${teamName(champ)} are Super Bowl champions`, { team: champ })
  if (honors.awards.MVP) addNews(F, 'award', `${honors.awards.MVP.name} is the league's Most Valuable Player`, { team: honors.awards.MVP.team, pid: honors.awards.MVP.id, body: honors.awards.MVP.line })
  // retirements
  const retire = [], hall = []
  for (const id in F.players) {
    const p = F.players[id]
    const at = RETIRE_AT[p.pos] ?? 33
    let chance = 0
    if (p.age >= at) chance = 0.22 + (p.age - at) * 0.2 + (p.ovr < 76 ? 0.3 : 0) - (p.ovr >= 86 ? 0.22 : 0)
    else if (p.age >= at - 3 && p.ovr < 70) chance = 0.3
    if (!p.team) chance = p.age >= 30 ? 0.7 : p.age >= 27 && p.ovr < 68 ? 0.45 : chance
    if (p.built && p.age < at + 2) chance = 0
    if (chance > 0 && R.chance(clamp(chance, 0, 0.97))) retire.push(p)
  }
  const out = []
  for (const p of retire) {
    const hc = hallCase(p), was = p.team
    const row = { name: p.name, pos: slotOf(p), age: p.age, team: was, line: careerLine(p), mine: was === user || p.built, ovr: p.ovr }
    if (was || p.peak >= 85) out.push(row)
    if (hc >= 9) { const h = { name: p.name, pos: slotOf(p), years: `${y - p.exp}-${y}`, line: careerLine(p), team: was ?? '', year: y, mine: row.mine }; F.hist.hall.push(h); hall.push(h) }
    if (was) { addTx(F, 'retire', was, `${slotOf(p)} ${p.name} retired after ${p.exp + 1} season${p.exp ? 's' : ''}.`); if (p.peak >= 90) addNews(F, 'league', `${p.name} retires`, { team: was, body: careerLine(p) }) }
    leaveTeam(F, p)
    F.fa = F.fa.filter(x => x !== p.id)
    delete F.players[p.id]
  }
  if (F.hist.hall.length > 60) F.hist.hall = F.hist.hall.slice(-60)
  out.sort((a, b) => b.ovr - a.ovr)
  F.phase = 'offseason'; F.stage = 'review'; F.game = null; F.office = []; F.offers = []
  F.off = {
    year: y, stage: 'review', fired: verdict.fired,
    review: { champ, awards: honors.awards, allPro: honors.allPro.map(x => ({ slot: x.slot, id: x.p.id })), proBowl: { AFC: honors.proBowl.AFC.map(x => ({ slot: x.slot, id: x.p.id })), NFC: honors.proBowl.NFC.map(x => ({ slot: x.slot, id: x.p.id })) }, retirements: out.slice(0, 40), hall, record: `${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}`, finish: finishText(F, user), seed: seedOf(user) || null },
    resign: null, fa: null, camp: null, changes: null,
  }
  for (const s of TEAM_SHORTS) autoDepth(F, F.teams[s])
}
function careerLine(p) {
  const aw = code => (p.aw ?? []).filter(a => a[1] === code).length
  const bits = []
  if (aw('MVP')) bits.push(`${aw('MVP')}x MVP`)
  if (aw('AP')) bits.push(`${aw('AP')}x All-Pro`)
  if (aw('PB')) bits.push(`${aw('PB')}x Pro Bowl`)
  if (p.rings) bits.push(`${p.rings} ring${p.rings > 1 ? 's' : ''}`)
  // (his whole career is only in the books when it started in this league; a veteran who came in with one is read by his years)
  const whole = !p.real || p.draft
  const line = whole ? statLine(p.pos, { ...p.car, g: p.car.g || 1 }) : `${p.exp + 1} seasons in the league`
  return [line, ...bits].filter(Boolean).join(' · ')
}

// ══ Stage views ═══════════════════════════════════════════════════════════════
export function seasonReview(F) {
  const o = F.off
  if (!o) return null
  const rv = o.review, row = id => (F.players[id] ? playerRow(F, F.players[id]) : null)
  const aw = Object.fromEntries(Object.entries(rv.awards).map(([k, v]) => [k, v ? { player: v.id != null ? row(v.id) : null, coach: v.coach != null && F.coaches[v.coach] ? coachRow(F, F.coaches[v.coach], 'HC') : null, name: v.name, team: teamRef(v.team), line: v.line } : null]))
  const ap = rv.allPro.map(x => ({ slot: x.slot, player: row(x.id), team: F.players[x.id]?.team ? teamRef(F.players[x.id].team) : null })).filter(x => x.player)
  const pb = c => rv.proBowl[c].map(x => ({ slot: x.slot, player: row(x.id) })).filter(x => x.player)
  const v = F.owner?.verdict
  return { year: o.year, champion: rv.champ ? teamRef(rv.champ) : null, user: { record: rv.record, finish: rv.finish, seed: rv.seed }, awards: aw, allPro: ap, proBowl: { AFC: pb('AFC'), NFC: pb('NFC') },
    mine: { allPro: ap.filter(x => x.player.team === F.team), proBowl: [...pb('AFC'), ...pb('NFC')].filter(x => x.player.team === F.team) }, retirements: rv.retirements, hall: rv.hall,
    owner: { verdict: v?.text ?? '', goals: v?.goals ?? [], security: Math.round(F.gm.security), delta: v?.delta ?? 0, fired: !!o.fired }, gm: { pts: v?.pts ?? 0, total: F.gm.pts ?? 0 } }
}
export function offseason(F) {
  if (F.phase !== 'offseason' || !F.off) return null
  const i = stageIdx(F.off.stage), st = STAGES[i]
  const view = { review: seasonReview, staff: staffStage, resign: expiring, fa: freeAgency, draft: draftView, udfa: udfaPool, camp: campView, cuts: cutsView }[st.id]
  return { year: F.off.year, stage: { id: st.id, name: st.name, n: i + 1, of: STAGES.length }, stages: STAGES.map((s, k) => ({ ...s, done: k < i, current: k === i })), fired: !!F.off.fired, direction: teamState(F), view: view(F) }
}
const staffStage = F => ({ staff: staffView(F), market: coachMarket(F), scouts: scoutPool(F), tree: gmTree(F) })

// ══ Fired ═════════════════════════════════════════════════════════════════════
export function jobOffers(F) {
  if (!F.off?.fired) return []
  return jobOffersFor(F).map(o => ({ team: teamRef(o.short), record: F.teams[o.short].last ? `${F.teams[o.short].last.w}-${F.teams[o.short].last.l}` : '', roster: { ovr: o.ovr, rank: o.rank }, capSpace: r2(F.cap - payroll(F, F.teams[o.short])), pitch: o.pitch }))
}
export function takeJob(F, short) {
  if (!F.off?.fired) return fail(F, 'job', 'There is no offer to take.')
  if (!jobOffersFor(F).some(o => o.short === short)) return fail(F, 'job', 'That team has not made an offer.')
  F.gm.fired = (F.gm.fired ?? 0) + 1
  F.team = short; F.gm.team = short; F.gm.security = 58; F.off.fired = false; F.gm.dir = null; F.gm.dirAt = null
  F.settings.autoDepth = true
  F.owner = null; startOwner(F)
  addNews(F, 'owner', `${teamName(short)} hire ${F.gm.name} as general manager`, { team: short })
  return ok(F, `${F.gm.name} is the new general manager of the ${teamName(short)}.`)
}

// ══ The new league year (when the review ends) ════════════════════════════════
function newLeagueYear(F) {
  const R = rngOf(`${F.seed}-${F.off.year}-leagueyear`)
  F.cap = capFor(F.off.year + 1, F.cap, R.u())
  for (const s of TEAM_SHORTS) { const t = F.teams[s]; t.dead = r2(t.deadNext ?? 0); t.deadNext = 0; t.staffDead = 0 }
  for (const id in F.players) {
    const p = F.players[id]
    if (!p.con) continue
    burnGuarantee(p.con)
    p.con.yrs -= 1
    if (p.con.tag) p.con.tag = false
    if (p.ext && p.con.yrs <= 0) { p.con = p.ext; delete p.ext }
  }
  // coaches: a year off every deal
  for (const id in F.coaches) { const c = F.coaches[id]; c.age++; if (c.con) c.con.yrs -= 1 }
}

// ══ Staff ═════════════════════════════════════════════════════════════════════
const STAFF_KEYS = ['hc', 'oc', 'dc']
const roleOf = k => k.toUpperCase()
function genAssistant(F, R, role) {
  const taken = new Set([...Object.values(F.coaches).map(c => c.name), ...Object.values(F.players).map(p => p.name)])
  const g = (m, sd = 1.4) => clamp(Math.round(m + R.n() * sd), 1, 9)
  const main = g(5.2, 1.6)
  return addCoach(F, { name: genName(R, taken), role, gen: true, age: R.int(34, 52), attrs: { talentDev: g(5), offPlaycalling: role === 'OC' ? main : role === 'DC' ? g(2.5, 1) : g(4.5), defPlaycalling: role === 'DC' ? main : role === 'OC' ? g(2.5, 1) : g(4.5), culture: g(4.8), situational: g(4.8) } }, R)
}
const onMarket = F => Object.values(F.coaches).filter(c => !c.team)
function hire(F, t, key, c, years = null) {
  const old = F.coaches[t.staff[key]]
  if (old && old.id !== c.id) { old.team = null; old.con = null }
  if (c.team && c.team !== t.short) { const from = F.teams[c.team]; for (const k of STAFF_KEYS) if (from.staff[k] === c.id) from.staff[k] = null }
  c.team = t.short; c.role = roleOf(key)
  if (key === 'hc') { if (c.calls !== 'off' && c.calls !== 'def') c.calls = c.a.offPlaycalling >= 8 && c.a.offPlaycalling >= c.a.defPlaycalling ? 'off' : c.a.defPlaycalling >= 8 ? 'def' : null } else c.calls = true
  delete c.interim
  c.con = { yrs: years ?? (c.age >= 62 ? 2 : key === 'hc' ? 4 : 3), sal: coachAsk(c, roleOf(key)) }
  t.staff[key] = c.id
}
// the CPU's coaching carousel: bad years cost head coaches their jobs, winning gets coordinators hired away,
// every opening is filled from the market (or a new face when the market is thin)
function coachCarousel(F) {
  const R = rngOf(`${F.seed}-${F.off.year}-carousel`), poached = []
  // deals that ran out: most are renewed; the user's are his to decide (the staff renews what he leaves)
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s], last = t.last ?? { w: 8, l: 9 }
    for (const k of STAFF_KEYS) {
      const c = F.coaches[t.staff[k]]
      if (!c) continue
      if (c.age >= 71 && R.chance(0.5)) { t.staff[k] = null; delete F.coaches[c.id]; addNews(F, 'staff', `${c.name} retires from coaching`, { team: s }); continue }
      if (s === F.team) continue
      const bad = pct(last.w, last.l, last.t ?? 0)
      if (k === 'hc') {
        const losing = (c.hist ?? []).slice(-3).filter(h => h[1] === s && h[3] < h[4]).length
        const fireP = c.built ? 0 : bad < 0.3 ? 0.42 + losing * 0.12 : bad < 0.42 && losing >= 3 ? 0.4 : 0
        if (R.chance(fireP)) { c.team = null; c.con = null; t.staff.hc = null; addTx(F, 'fire', s, `${teamName(s)} fired head coach ${c.name}.`); addNews(F, 'staff', `${nick(s)} fire head coach ${c.name}`, { team: s }); continue }
      } else if (bad < 0.36 && R.chance(0.3)) { c.team = null; c.con = null; t.staff[k] = null; continue }
      if (c.con && c.con.yrs <= 0) c.con = { yrs: k === 'hc' ? 4 : 3, sal: coachAsk(c, roleOf(k)) }
    }
  }
  // head coach openings first: the best man for the job, on the market or calling plays for a winner
  for (const s of R.shuffle(TEAM_SHORTS)) {
    const t = F.teams[s]
    if (s === F.team || t.staff.hc != null) continue
    const coords = []
    for (const o of TEAM_SHORTS) { if (o === s) continue; const ot = F.teams[o], good = (ot.last?.seed ?? 0) > 0; if (!good) continue; for (const k of ['oc', 'dc']) { const c = F.coaches[ot.staff[k]]; if (c && coachOvr(c, 'HC') >= 78) coords.push(c) } }
    const pool = [...onMarket(F), ...coords].map(c => ({ c, v: coachOvr(c, 'HC') + R.n() * 3 + (c.team ? 1.5 : 0) })).sort((a, b) => b.v - a.v)
    const pick = pool[0]?.c ?? genAssistant(F, R, 'HC')
    if (pick.team) { poached.push({ coach: pick.id, name: pick.name, from: pick.team, to: s, role: 'HC' }); addNews(F, 'staff', `${nick(s)} hire ${nick(pick.team)} coordinator ${pick.name} as head coach`, { team: s }) }
    else addNews(F, 'staff', `${nick(s)} name ${pick.name} head coach`, { team: s })
    hire(F, t, 'hc', pick)
    addTx(F, 'hire', s, `${teamName(s)} hired ${pick.name} as head coach.`)
  }
  // then the coordinators
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s]
    if (s === F.team) continue
    for (const k of ['oc', 'dc']) {
      if (t.staff[k] != null) continue
      const key = k === 'oc' ? 'offPlaycalling' : 'defPlaycalling'
      const pool = onMarket(F).filter(c => c.a[key] >= 4).sort((a, b) => b.a[key] - a.a[key])
      hire(F, t, k, pool[R.int(0, Math.min(2, pool.length - 1))] ?? genAssistant(F, R, roleOf(k)))
    }
  }
  // a market with enough names on it
  for (let n = onMarket(F).length; n < 10; n++) genAssistant(F, R, ['HC', 'OC', 'DC'][n % 3])
  F.off.poached = poached
  // the user's own: a coordinator who was hired away is gone; an expired deal waits for him
  const mineT = F.teams[F.team]
  for (const k of STAFF_KEYS) { const c = F.coaches[mineT.staff[k]]; if (c && c.con && c.con.yrs <= 0) c.expired = true }
}
export function coachMarket(F) {
  const t = F.teams[F.team]
  const rows = onMarket(F).map(c => {
    const best = ['HC', 'OC', 'DC'].map(r => [r, coachOvr(c, r)]).sort((a, b) => b[1] - a[1])[0][0]
    return { ...coachRow(F, c, c.role), ask: { years: c.age >= 62 ? 2 : c.role === 'HC' ? 4 : 3, salary: coachAsk(c, c.role), asHC: coachAsk(c, 'HC'), asOC: coachAsk(c, 'OC'), asDC: coachAsk(c, 'DC') }, interest: coachInterest(F, c), wants: c.role === 'HC' && coachOvr(c, 'HC') >= 80 ? 'HC' : 'any', best, ovrAs: { HC: coachOvr(c, 'HC'), OC: coachOvr(c, 'OC'), DC: coachOvr(c, 'DC') } }
  }).sort((a, b) => Math.max(b.ovrAs.HC, b.ovrAs.OC, b.ovrAs.DC) - Math.max(a.ovrAs.HC, a.ovrAs.OC, a.ovrAs.DC))
  const openings = STAFF_KEYS.filter(k => t.staff[k] == null || F.coaches[t.staff[k]]?.expired).map(k => ({ team: teamRef(F.team), role: roleOf(k), expired: t.staff[k] != null }))
  return { coaches: rows, openings, poached: (F.off?.poached ?? []).map(x => ({ coach: F.coaches[x.coach] ? coachRow(F, F.coaches[x.coach], 'HC') : { name: x.name }, from: teamRef(x.from), to: teamRef(x.to), role: x.role, mine: x.from === F.team })) }
}
const staffBudget = (F, t) => t.staffBudget ?? 32
function staffSpend(F, t, except = null) { let s = t.staffDead ?? 0; for (const k of STAFF_KEYS) { const c = F.coaches[t.staff[k]]; if (c && k !== except) s += c.con?.sal ?? 0 } return r2(s) }
export function hireCoach(F, role, coachId, { years = null } = {}) {
  const key = String(role).toLowerCase(), t = F.teams[F.team], c = F.coaches[coachId]
  if (!STAFF_KEYS.includes(key)) return fail(F, 'role', 'There is no such job.')
  if (!c) return fail(F, 'coach', 'He is not available.')
  const cur = F.coaches[t.staff[key]]
  if (cur && cur.id === c.id) { c.con = { yrs: years ?? (key === 'hc' ? 4 : 3), sal: coachAsk(c, roleOf(key)) }; delete c.expired; return ok(F, `${c.name} has a new deal.`) }
  if (c.team) return fail(F, 'coach', `${c.name} is under contract with the ${nick(c.team)}.`)
  if (c.role === 'HC' && key !== 'hc' && coachOvr(c, 'HC') >= 82) return fail(F, 'coach', `${c.name} is only taking head coaching jobs.`)
  if (coachInterest(F, c) < 25) return fail(F, 'coach', `${c.name} is not interested in this job.`)
  const ask = coachAsk(c, roleOf(key))
  if (staffSpend(F, t, key) + ask > staffBudget(F, t) + 0.001) return fail(F, 'budget', `Ownership's coaching budget is ${moneyText(staffBudget(F, t))}. ${c.name} asks ${moneyText(ask)} a year.`)
  if (cur) { const owed = (cur.con?.sal ?? 0) * Math.max(0, (cur.con?.yrs ?? 0) - 0) * 0.5; if (!cur.expired && owed > 0) { t.staffDead = r2((t.staffDead ?? 0) + Math.min(owed, cur.con.sal)); F.gm.security = clamp(F.gm.security - 2, 0, 100) } delete cur.expired; addTx(F, 'fire', F.team, `${teamName(F.team)} let ${ROLE[key]} ${cur.name} go.`) }
  hire(F, t, key, c, years)
  delete c.expired
  addTx(F, 'hire', F.team, `${teamName(F.team)} hired ${c.name} as ${ROLE[key]}.`)
  addNews(F, 'staff', `${nick(F.team)} hire ${c.name} as ${ROLE[key]}`, { team: F.team })
  return ok(F, `${c.name} is the new ${ROLE[key]}.`)
}
const ROLE = { hc: 'head coach', oc: 'offensive coordinator', dc: 'defensive coordinator' }
export function fireCoach(F, role) {
  const key = String(role).toLowerCase(), t = F.teams[F.team], c = F.coaches[t.staff[key]]
  if (!c) return fail(F, 'coach', 'That job is already open.')
  if (!c.expired && c.con) { t.staffDead = r2((t.staffDead ?? 0) + c.con.sal * Math.min(1, c.con.yrs) * 0.5); F.gm.security = clamp(F.gm.security - (key === 'hc' ? 3 : 1), 0, 100) }
  c.team = null; c.con = null; delete c.expired
  if (c.built) c.role = 'HC'
  t.staff[key] = null
  addTx(F, 'fire', F.team, `${teamName(F.team)} fired ${ROLE[key]} ${c.name}.`)
  addNews(F, 'staff', `${nick(F.team)} fire ${ROLE[key]} ${c.name}`, { team: F.team })
  return ok(F, `${c.name} is out.`)
}
export function hireBuiltCoach(F, coach) {
  if (!coach?.build) return fail(F, 'coach', 'There is no coach to hire.')
  const t = F.teams[F.team], R = rngOf(`${F.seed}-built-coach-${F.nextCoachId}`)
  const cur = F.coaches[t.staff.hc]
  const c = addCoach(F, builtCoachRow(coach), R)
  c.age = 44; c.calls = c.a.offPlaycalling >= c.a.defPlaycalling ? (c.a.offPlaycalling >= 7 ? 'off' : null) : (c.a.defPlaycalling >= 7 ? 'def' : null)
  if (cur) { cur.team = null; cur.con = null; delete cur.expired; addTx(F, 'fire', F.team, `${teamName(F.team)} let head coach ${cur.name} go.`) }
  c.team = F.team; c.con = { yrs: 4, sal: coachAsk(c, 'HC') }
  t.staff.hc = c.id
  addTx(F, 'hire', F.team, `${teamName(F.team)} hired ${c.name} as head coach.`)
  addNews(F, 'staff', `${nick(F.team)} name ${c.name} head coach`, { team: F.team })
  return ok(F, `${c.name} is the new head coach.`)
}
// the scouting director: a small pool each offseason, each with what he is good at
const SCOUT_SPECS = [
  ['skill', 'SKILL POSITIONS', 'Quarterbacks, backs, receivers and tight ends start the year a level better scouted.'],
  ['trenches', 'THE TRENCHES', 'Offensive and defensive linemen start the year a level better scouted.'],
  ['back', 'THE BACK SEVEN', 'Linebackers and defensive backs start the year a level better scouted.'],
  ['sleepers', 'SLEEPERS', 'Prospects the league has outside the first three rounds start a level better scouted.'],
  ['top', 'THE TOP OF THE BOARD', 'The consensus first-round prospects start a level better scouted.'],
  ['combine', 'THE NUMBERS', 'Combine numbers for every prospect are in hand all season.'],
]
export function scoutPool(F) {
  const R = rngOf(`${F.seed}-${F.off?.year ?? F.year}-scouts`), taken = new Set(Object.values(F.players).map(p => p.name))
  const cur = F.teams[F.team].staff.scout
  const pool = R.shuffle(SCOUT_SPECS).slice(0, 4).map(([spec, name, text], i) => ({ id: `s${(F.off?.year ?? F.year)}-${i}`, name: genName(R, taken), spec, specialty: name, text, pts: i === 0 ? 2 : i === 1 ? 1 : 0, salary: r2(0.6 + (i === 0 ? 0.9 : i === 1 ? 0.5 : 0.2)) }))
  return pool.map(s => ({ ...s, text: `${s.text}${s.pts ? ` ${s.pts} more scouting point${s.pts > 1 ? 's' : ''} a week.` : ''}`, hired: cur?.id === s.id })).concat(cur && !pool.some(s => s.id === cur.id) ? [{ ...cur, hired: true }] : [])
}
export function hireScout(F, id) {
  const s = scoutPool(F).find(x => x.id === id)
  if (!s) return fail(F, 'scout', 'He is not available.')
  F.teams[F.team].staff.scout = { id: s.id, name: s.name, spec: s.spec, specialty: s.specialty, text: s.text, pts: s.pts, salary: s.salary }
  if (F.draft && !F.draft.done) applyScoutSpec(F, s.spec)
  return ok(F, `${s.name} is the new scouting director.`)
}
// the GM's own tree, bought with points earned from the owner's goals
const TREE = [
  ['practice', 'PRACTICE', 'Players earn 4% more XP a level.'],
  ['negotiating', 'NEGOTIATING', 'Players ask 2% less and lose patience more slowly, a level.'],
  ['scouting', 'SCOUTING', 'One more scouting point a week, a level.'],
  ['trading', 'TRADING', 'Other teams ask 2% less in a trade, a level.'],
  ['medical', 'MEDICAL', '5% fewer injuries a level.'],
  ['gameday', 'GAME DAY', 'The staff\'s feel for fourth downs, the clock and close games goes up a notch a level.'],
]
const treeCost = lvl => 2 + lvl
export function gmTree(F) {
  const tr = F.gm.tree ?? {}
  return { pts: F.gm.pts ?? 0, branches: TREE.map(([id, name, text]) => ({ id, name, text, level: tr[id] ?? 0, max: 3, cost: (tr[id] ?? 0) >= 3 ? null : treeCost(tr[id] ?? 0), effect: text })) }
}
export function buyPerk(F, id) {
  const b = TREE.find(x => x[0] === id), lvl = F.gm.tree?.[id] ?? 0
  if (!b) return fail(F, 'tree', 'There is no such branch.')
  if (lvl >= 3) return fail(F, 'tree', 'That branch is complete.')
  if ((F.gm.pts ?? 0) < treeCost(lvl)) return fail(F, 'tree', `That costs ${treeCost(lvl)} points.`)
  F.gm.pts -= treeCost(lvl); (F.gm.tree ??= {})[id] = lvl + 1
  return touch(F)
}
// a coaching job the GM left open is filled by the staff: the best man on the market the budget allows
// (in season too: a week is never played without a head coach and both coordinators)
export function fillStaff(F) {
  const t = F.teams[F.team], R = rngOf(`${F.seed}-${F.year}-${F.week}-staff-auto`)
  for (const k of STAFF_KEYS) {
    const c = F.coaches[t.staff[k]]
    if (c?.expired) { c.con = { yrs: k === 'hc' ? 4 : 3, sal: coachAsk(c, roleOf(k)) }; delete c.expired; continue }
    if (c) continue
    const key = k === 'oc' ? 'offPlaycalling' : k === 'dc' ? 'defPlaycalling' : null
    const room = staffBudget(F, t) - staffSpend(F, t, k)
    const pool = onMarket(F).filter(x => coachAsk(x, roleOf(k)) <= room && coachInterest(F, x) >= 25 && !(x.role === 'HC' && k !== 'hc' && coachOvr(x, 'HC') >= 82)).sort((a, b) => (key ? b.a[key] - a.a[key] : coachOvr(b, 'HC') - coachOvr(a, 'HC')))
    const pick = pool[0] ?? genAssistant(F, R, roleOf(k))
    hire(F, t, k, pick)
    addTx(F, 'hire', F.team, `${teamName(F.team)} hired ${pick.name} as ${ROLE[k]}.`)
  }
}
function delegateStaff(F) {
  const t = F.teams[F.team]
  fillStaff(F)
  if (!t.staff.scout) { const s = scoutPool(F)[0]; if (s) t.staff.scout = { id: s.id, name: s.name, spec: s.spec, specialty: s.specialty, text: s.text, pts: s.pts, salary: s.salary } }
  // the tree: the cheapest branch first, in the order above
  for (let guard = 0; guard < 12; guard++) { const b = TREE.map(x => x[0]).filter(id => (F.gm.tree?.[id] ?? 0) < 3).sort((a, b2) => (F.gm.tree?.[a] ?? 0) - (F.gm.tree?.[b2] ?? 0))[0]; if (!b || (F.gm.pts ?? 0) < treeCost(F.gm.tree?.[b] ?? 0)) break; F.gm.pts -= treeCost(F.gm.tree?.[b] ?? 0); (F.gm.tree ??= {})[b] = (F.gm.tree[b] ?? 0) + 1 }
}

// ══ Re-signing ════════════════════════════════════════════════════════════════
const expiringOf = (F, short) => F.teams[short].roster.map(id => F.players[id]).filter(p => p && p.con && p.con.yrs <= 0)
// the franchise tag: the average of the five biggest salaries at his spot (never less than 120% of his own)
export function tagCost(F, p) {
  const slot = slotOf(p)
  const top = Object.values(F.players).filter(x => x.team && x.con && slotOf(x) === slot).map(x => x.con.sal).sort((a, b) => b - a).slice(0, 5)
  const avg = top.length ? top.reduce((a, b) => a + b, 0) / top.length : (TOP_SHARE[slot] ?? 0.06) * F.cap * 0.8
  return r2(Math.max(avg, (p.con?.sal ?? 0) * 1.2, VET_MIN))
}
function myAsk(F, p) {
  const a = askOf(F, p), k = 1 - (F.gm.tree?.negotiating ?? 0) * 0.02
  return { years: a.years, perYear: r2(a.perYear * k * (p.cold === F.off?.year ? 1.08 : 1)), guaranteed: a.guaranteed }
}
function startResign(F) {
  const list = expiringOf(F, F.team)
  F.off.resign = { talks: {}, tagUsed: false, decided: {}, list: list.map(p => p.id) }
  // the first-round picks whose option year is up for a decision: the last year of the rookie deal is coming
  for (const p of mine(F)) if (p.con?.rookie && p.con.opt === 1 && p.con.yrs === 1) F.off.resign.list.push(p.id)
}
export function expiring(F) {
  const rs = F.off?.resign
  if (!rs) return []
  const dm = depthMap(F, F.teams[F.team])
  return rs.list.map(id => F.players[id]).filter(Boolean).map(p => {
    const opt = p.con?.rookie && p.con.opt === 1 && p.con.yrs === 1
    return { ...playerRow(F, p, dm), ask: myAsk(F, p), market: marketValue(p, F.cap), canTag: !opt && !rs.tagUsed && !rs.decided[p.id], tagCost: tagCost(F, p), option: opt ? { cost: optionSalary(p, F.cap) } : null, talks: rs.talks[p.id] ?? null, decided: rs.decided[p.id] ?? null, optionOnly: !!opt }
  }).sort((a, b) => b.ovr - a.ovr)
}
// How an offer sits with him: 0 an insult … 1 everything he asked for (and past it)
function offerFit(F, p, ask, o) {
  const D = new Set(p.drives ?? [])
  const money = o.perYear / ask.perYear
  const g = clamp((o.guaranteed ?? ask.guaranteed) / Math.max(0.05, ask.guaranteed), 0, 1.6)
  const yrs = 1 - Math.abs((o.years ?? ask.years) - ask.years) * (p.age >= 30 ? 0.03 : 0.05)
  let fit = money * (D.has('MONEY') ? 0.82 : 0.74) + g * (D.has('MONEY') ? 0.12 : 0.16) + yrs * 0.1 - 0.06
  // what the team is: a winner for a man who wants a ring, a starting job for one who wants the ball, home for a loyal one
  const t = F.teams[F.team], last = t.last ?? { w: 8, l: 9 }
  if (D.has('RING')) fit += (pct(last.w, last.l, 0) - 0.5) * 0.16 + ((last.seed ?? 0) > 0 ? 0.03 : -0.02)
  if (D.has('LOYAL')) fit += 0.05
  if (D.has('ROLE')) fit += startersOf(F, t).has(p.id) ? 0.04 : -0.05
  if (D.has('COMPETITOR')) fit += (pct(last.w, last.l, 0) - 0.5) * 0.08
  fit += ((F.coaches[t.staff.hc]?.a.culture ?? 5.5) - 5.5) * 0.008
  return fit
}
export function openTalks(F, pid) {
  const rs = F.off?.resign, p = F.players[pid]
  if (!rs || !p || p.team !== F.team || !rs.list.includes(pid)) return fail(F, 'talks', 'He is not up for a new deal.')
  if (rs.decided[pid]) return fail(F, 'talks', 'That is already settled.')
  if (!rs.talks[pid]) rs.talks[pid] = { pid, patience: clamp(Math.round(70 + (p.mood - 55) * 0.5 + (F.gm.tree?.negotiating ?? 0) * 6 + (p.drives?.includes('LOYAL') ? 12 : 0) - (p.cold === F.off.year ? 25 : 0)), 25, 100), interest: clamp(Math.round(34 + (p.mood - 55) * 0.4 + (p.drives?.includes('LOYAL') ? 12 : 0)), 8, 70), ask: myAsk(F, p), last: null, rounds: 0, done: null }
  return touch(F, { ok: true, talks: rs.talks[pid] })
}
const REACT = [[1.0, 'Deal'], [0.93, 'Close'], [0.82, 'Getting there'], [0.66, 'Not close'], [0, 'Insulted']]
export function makeOffer(F, pid, offer) {
  const rs = F.off?.resign, p = F.players[pid]
  if (!rs || !p || !rs.list.includes(pid)) return fail(F, 'talks', 'He is not up for a new deal.')
  if (!rs.talks[pid]) openTalks(F, pid)
  const T = rs.talks[pid]
  if (!T || T.done) return fail(F, 'talks', T?.done === 'signed' ? 'He has signed.' : 'He has ended the talks.')
  const o = { years: clamp(Math.round(offer?.years ?? T.ask.years), 1, 6), perYear: r2(Math.max(MIN_SALARY, offer?.perYear ?? T.ask.perYear)), guaranteed: clamp(offer?.guaranteed ?? T.ask.guaranteed, 0, 1) }
  const t = F.teams[F.team]
  if (F.settings.cap && payroll(F, t) + o.perYear > F.cap + 0.001) return fail(F, 'cap', `That offer puts the ${nick(F.team)} ${moneyText(r2(payroll(F, t) + o.perYear - F.cap))} over the cap.`)
  const fit = offerFit(F, p, T.ask, o)
  const react = REACT.find(([lo]) => fit >= lo)[1]
  T.rounds++
  // interest moves by how the offer fits; every offer costs patience, a bad one a lot of it
  T.interest = clamp(Math.round(T.interest + (fit - 0.8) * 150 + (fit >= 0.93 ? 12 : 0)), 0, 100)
  T.patience = clamp(Math.round(T.patience - (fit >= 0.93 ? 8 : fit >= 0.82 ? 14 : fit >= 0.66 ? 24 : 40) * (1 - (F.gm.tree?.negotiating ?? 0) * 0.08)), 0, 100)
  const word = lastName(p.name)
  T.last = { offer: o, reaction: react, text: react === 'Deal' ? `${word} takes it.` : react === 'Close' ? `${word}'s agent says they are close.` : react === 'Getting there' ? `${word}'s agent wants more, but he is still listening.` : react === 'Not close' ? `${word}'s agent says that is not close.` : `${word} is insulted by the number.` }
  if (fit >= 1 || T.interest >= 100) {
    p.con = newContract(p, { yrs: o.years, sal: o.perYear, guarShare: o.guaranteed })
    p.mood = clamp(p.mood + 10, 3, 97); T.done = 'signed'; rs.decided[pid] = 'signed'; T.last.reaction = 'Deal'; T.last.text = `${word} signs.`
    addTx(F, 'extend', F.team, `${teamName(F.team)} re-signed ${slotOf(p)} ${p.name} (${o.years} year${o.years > 1 ? 's' : ''}, ${moneyText(o.perYear)} a year).`, p.id)
    if (p.ovr >= 84) addNews(F, 'signing', `${p.name} re-signs with the ${nick(F.team)}`, { team: F.team, pid: p.id })
  } else if (T.patience <= 0) { T.done = 'walked'; rs.decided[pid] = 'walk'; T.last.text = `${word} has heard enough. He will test the market.`; p.mood = clamp(p.mood - 8, 3, 97) }
  return touch(F, { ok: true, talks: T, msg: T.last.text })
}
export function tagPlayer(F, pid) {
  const rs = F.off?.resign, p = F.players[pid]
  if (!rs || !p || !rs.list.includes(pid) || rs.decided[pid]) return fail(F, 'tag', 'He cannot be tagged.')
  if (p.con?.rookie && p.con.opt === 1 && p.con.yrs === 1) return fail(F, 'tag', 'He is still under contract.')
  if (rs.tagUsed) return fail(F, 'tag', 'The franchise tag has been used this year.')
  const cost = tagCost(F, p), t = F.teams[F.team]
  if (F.settings.cap && payroll(F, t) + cost > F.cap + 0.001) return fail(F, 'cap', `The tag is ${moneyText(cost)}. That is ${moneyText(r2(payroll(F, t) + cost - F.cap))} over the cap.`)
  p.con = { yrs: 1, sal: cost, guar: cost, rookie: 0, rd: null, opt: 0, tag: true }
  p.mood = clamp(p.mood - (p.drives?.includes('MONEY') ? 2 : 6), 3, 97)
  rs.tagUsed = true; rs.decided[pid] = 'tagged'
  addTx(F, 'tag', F.team, `${teamName(F.team)} placed the franchise tag on ${slotOf(p)} ${p.name} (${moneyText(cost)}).`, p.id)
  addNews(F, 'signing', `${nick(F.team)} tag ${p.name}`, { team: F.team, pid: p.id })
  return ok(F, `${p.name} is tagged for one year at ${moneyText(cost)}.`)
}
export function exerciseOption(F, pid) {
  const rs = F.off?.resign, p = F.players[pid]
  if (!rs || !p || p.team !== F.team || !(p.con?.rookie && p.con.opt === 1)) return fail(F, 'option', 'He has no option to exercise.')
  p.con.opt = 2; p.con.yrs += 1; p.opt5 = optionSalary(p, F.cap)
  rs.decided[pid] = 'option'
  addTx(F, 'extend', F.team, `${teamName(F.team)} exercised the fifth-year option on ${slotOf(p)} ${p.name}.`, p.id)
  return ok(F, `${p.name}'s fifth year is locked in at ${moneyText(p.opt5)}.`)
}
export function letWalk(F, pid) {
  const rs = F.off?.resign
  if (!rs || !rs.list.includes(pid) || rs.decided[pid]) return fail(F, 'talks', 'That is already settled.')
  rs.decided[pid] = 'walk'
  return touch(F)
}
// the staff's re-signing: the men worth keeping at what they ask, best value first, while the money holds
function delegateResign(F) {
  const rs = F.off.resign, t = F.teams[F.team], starts = startersOf(F, t)
  const list = rs.list.map(id => F.players[id]).filter(p => p && !rs.decided[p.id])
  for (const p of list.filter(x => x.con?.rookie && x.con.opt === 1 && x.con.yrs === 1)) { if (p.ovr >= 78) exerciseOption(F, p.id); else rs.decided[p.id] = 'walk' }
  const buffer = F.cap * 0.035
  for (const p of list.filter(x => x.con && x.con.yrs <= 0).sort((a, b) => playerValue(F, b) - playerValue(F, a))) {
    if (rs.decided[p.id]) continue
    const ask = myAsk(F, p), keep = (p.ovr >= 77 || starts.has(p.id) || p.built) && !(p.age >= 33 && p.ovr < 84 && p.pos !== 'qb' && p.pos !== 'k')
    if (keep && (!F.settings.cap || payroll(F, t) + ask.perYear <= F.cap - buffer)) {
      p.con = newContract(p, { yrs: ask.years, sal: ask.perYear, guarShare: ask.guaranteed }); rs.decided[p.id] = 'signed'
      addTx(F, 'extend', F.team, `${teamName(F.team)} re-signed ${slotOf(p)} ${p.name} (${ask.years} year${ask.years > 1 ? 's' : ''}, ${moneyText(ask.perYear)} a year).`, p.id)
    } else rs.decided[p.id] = 'walk'
  }
}
// what a team has to keep back for its draft class (each pick's slotted deal, less the minimum-salary man it replaces)
function rookieReserve(F) {
  const order = draftOrder(F), slot = Object.fromEntries(order.map((s, i) => [s, i + 1])), out = {}
  for (const s of TEAM_SHORTS) { let sum = 0; for (const pk of F.teams[s].picks) if (pk.y === F.off.year + 1) sum += Math.max(0, rookieDeal((pk.r - 1) * 32 + slot[pk.o], F.cap).sal - MIN_SALARY); out[s] = r2(sum + 1.5) }
  return out
}
// every other team's expiring players: most of the good ones stay, the rest reach the market
function cpuResign(F) {
  const R = rngOf(`${F.seed}-${F.off.year}-cpu-resign`), reserve = (F.off.reserve = rookieReserve(F))
  for (const s of TEAM_SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s], starts = startersOf(F, t)
    for (const p of t.roster.map(id => F.players[id]).filter(Boolean)) {
      if (p.con?.rookie && p.con.opt === 1 && p.con.yrs === 1 && p.ovr >= 79) { p.con.opt = 2; p.con.yrs += 1; p.opt5 = optionSalary(p, F.cap) }
      if (!p.con || p.con.yrs > 0) continue
      const mv = marketValue(p, F.cap), keepP = p.ovr >= 88 ? 0.86 : p.ovr >= 80 ? 0.7 : starts.has(p.id) ? 0.55 : p.ovr >= 72 ? 0.35 : 0.2
      const old = p.age >= (p.pos === 'qb' ? 37 : p.pos === 'k' ? 39 : 32)
      // a franchise quarterback, or one of the best players in the league, is not allowed to leave: the money is found
      const must = !old && ((p.pos === 'qb' && p.ovr >= 84) || p.ovr >= 93)
      if (must || (R.chance(keepP * (old ? 0.6 : 1) + (p.drives?.includes('LOYAL') ? 0.1 : 0)) && payroll(F, t) + mv + reserve[s] <= F.cap * 0.985)) p.con = newContract(p, { yrs: marketYears(p), sal: r2(mv * (0.92 + R.u() * 0.1)) })
    }
  }
}

// ══ Free agency ═══════════════════════════════════════════════════════════════
const FA_ROUND = ['Day 1', 'Day 2', 'Week 2']
const faAsk = (F, p, round) => { const a = askOf(F, p), k = [1, 0.9, 0.78][round - 1] ?? 0.7; return { years: round >= 3 ? Math.min(2, a.years) : a.years, perYear: r2(Math.max(p.exp >= 3 ? VET_MIN : MIN_SALARY, a.perYear * k)), guaranteed: r2(a.guaranteed * (round >= 3 ? 0.6 : 1)) } }
function startFA(F) {
  // everyone whose deal ran out and was not kept is on the market
  for (const s of TEAM_SHORTS) for (const p of expiringOf(F, s)) {
    if (s === F.team && F.off.resign?.decided[p.id] && F.off.resign.decided[p.id] !== 'walk') continue
    if (p.ovr >= 80) addNews(F, 'signing', `${p.name} will hit free agency`, { pid: p.id })
    toFreeAgency(F, p)
    p.from = s
  }
  F.off.fa = { round: 1, bids: {}, signed: [], suitors: {} }
  setSuitors(F)
}
// how a team fits a free agent's drives (1 = nothing either way)
function teamFit(F, short, p) {
  const t = F.teams[short], D = new Set(p.drives ?? []), last = t.last ?? { w: 8, l: 9, seed: 0 }
  let f = 1 + ((F.coaches[t.staff.hc]?.a.culture ?? 5.5) - 5.5) * 0.012
  const stance = stanceOf(F, short)
  if (D.has('RING')) f += (pct(last.w, last.l, 0) - 0.5) * 0.3 + (last.seed ? 0.04 : 0) + (stance === 'contend' ? 0.1 : stance === 'rebuild' ? -0.14 : 0)
  if (D.has('COMPETITOR')) f += (pct(last.w, last.l, 0) - 0.5) * 0.14 + (stance === 'rebuild' ? -0.05 : 0)
  if (stance === 'rebuild' && (D.has('ROLE') || D.has('MONEY')) && p.age <= 28) f += 0.05
  if (stance === 'rebuild' && p.age >= 30) f -= 0.06
  if (D.has('LOYAL') && p.from === short) f += 0.14
  if (D.has('ROLE')) { const L = lineupOf(F, t), slot = slotOf(p), cur = p.pos === 'ol' ? L.OL.find(o => o.spot === p.sub)?.p : (L[slot] ?? [])[slot === 'WR' ? 2 : slot === 'LB' ? 2 : ['EDGE', 'DT', 'CB', 'S'].includes(slot) ? 1 : 0]; f += !cur || p.ovr >= cur.ovr ? 0.12 : -0.1 }
  if (D.has('MENTOR') && t.roster.some(id => F.players[id]?.pos === p.pos && F.players[id].age <= 23)) f += 0.04
  return f
}
const offerWorth = (o, D) => o.perYear * (1 + (o.guaranteed - 0.4) * (D.has('MONEY') ? 0.35 : 0.25)) * (1 + (o.years - 2) * 0.02)
// which CPU teams are in on each real free agent this round (need, money, and a little chance)
function setSuitors(F) {
  const fa = F.off.fa, R = rngOf(`${F.seed}-${F.off.year}-fa-${fa.round}`)
  fa.suitors = {}; fa.cpu = {}
  const pool = F.fa.map(id => F.players[id]).filter(p => p && p.ovr >= 70).sort((a, b) => b.ovr - a.ovr)
  const reserve = F.off.reserve ?? {}
  const space = Object.fromEntries(TEAM_SHORTS.map(s => [s, F.cap - payroll(F, F.teams[s]) - (reserve[s] ?? 0)]))
  const needs = Object.fromEntries(TEAM_SHORTS.map(s => [s, Object.fromEntries(needsOf(F, s).map(n => [n.group, n]))]))
  for (const p of pool) {
    const ask = faAsk(F, p, fa.round), g = groupOf(p)
    const want = TEAM_SHORTS.filter(s => s !== F.team && space[s] >= ask.perYear * 1.05 + 3 && (needs[s][g].need >= 0.25 || p.ovr >= needs[s][g].starter + 2) && !(F.teams[s].state === 'rebuild' && p.age >= 29))
      .map(s => ({ s, k: needs[s][g].need + (p.ovr - needs[s][g].starter) * 0.03 + R.u() * 0.4 + (F.teams[s].state === 'contend' ? 0.15 : F.teams[s].state === 'rebuild' && p.age <= 26 ? 0.1 : 0) })).sort((a, b) => b.k - a.k).slice(0, p.ovr >= 85 ? 4 : p.ovr >= 78 ? 3 : 2)
    if (!want.length) continue
    fa.suitors[p.id] = want.map(x => x.s)
    fa.cpu[p.id] = want.map(x => ({ s: x.s, o: { years: ask.years, perYear: r2(ask.perYear * (0.97 + R.u() * (p.ovr >= 85 ? 0.2 : 0.12))), guaranteed: ask.guaranteed } }))
    // a team only chases so many at once
    for (const x of want) space[x.s] -= ask.perYear * 0.5
  }
}
export function freeAgency(F) {
  const fa = F.off?.fa
  if (!fa) return { round: 1, roundName: FA_ROUND[0], players: [], capSpace: r2(F.cap - payroll(F, F.teams[F.team])), signed: [] }
  const players = F.fa.map(id => F.players[id]).filter(p => p && (p.ovr >= 68 || fa.bids[p.id])).sort((a, b) => b.ovr - a.ovr).slice(0, 120).map(p => {
    const ask = faAsk(F, p, fa.round), fit = teamFit(F, F.team, p), bid = fa.bids[p.id] ?? null, D = new Set(p.drives ?? [])
    const bestCpu = Math.max(0, ...(fa.cpu[p.id] ?? []).map(x => offerWorth(x.o, D) * teamFit(F, x.s, p)))
    return { ...playerRow(F, p), ask, suitors: (fa.suitors[p.id] ?? []).length, fit: clamp(Math.round(50 + (fit - 1) * 160), 1, 99), bid, leader: !!bid && offerWorth(bid, D) * fit >= bestCpu && offerWorth(bid, D) >= offerWorth(ask, D) * 0.95, from: p.from ? teamRef(p.from) : null }
  })
  return { round: fa.round, roundName: FA_ROUND[fa.round - 1], players, capSpace: r2(F.cap - payroll(F, F.teams[F.team])), signed: fa.signed.slice(-40).reverse(), rosterCount: activeCount(F, F.teams[F.team]), rosterLimit: CAMP_MAX }
}
export function bidFreeAgent(F, pid, terms = null) {
  const fa = F.off?.fa, p = F.players[pid]
  if (!fa || !p || p.team || !F.fa.includes(pid)) return fail(F, 'fa', 'He is not on the market.')
  const ask = faAsk(F, p, fa.round)
  const o = { years: clamp(Math.round(terms?.years ?? ask.years), 1, 6), perYear: r2(Math.max(MIN_SALARY, terms?.perYear ?? ask.perYear)), guaranteed: clamp(terms?.guaranteed ?? ask.guaranteed, 0, 1) }
  const t = F.teams[F.team], others = Object.entries(fa.bids).filter(([id]) => +id !== pid).reduce((s, [, b]) => s + b.perYear, 0)
  if (F.settings.cap && payroll(F, t) + others + o.perYear > F.cap + 0.001) return fail(F, 'cap', `With the other offers out, that is ${moneyText(r2(payroll(F, t) + others + o.perYear - F.cap))} more than the ${nick(F.team)} have.`)
  if (activeCount(F, t) + Object.keys(fa.bids).length >= CAMP_MAX && !fa.bids[pid]) return fail(F, 'roster', 'There is no room on the roster for another signing.')
  fa.bids[pid] = o
  return touch(F)
}
export function withdrawBid(F, pid) { if (F.off?.fa?.bids[pid]) delete F.off.fa.bids[pid]; return touch(F) }
function resolveFA(F) {
  const fa = F.off.fa, R = rngOf(`${F.seed}-${F.off.year}-fa-resolve-${fa.round}`)
  const pool = F.fa.map(id => F.players[id]).filter(p => p && (fa.cpu[p.id] || fa.bids[p.id])).sort((a, b) => b.ovr - a.ovr)
  for (const p of pool) {
    const D = new Set(p.drives ?? []), ask = faAsk(F, p, fa.round), floor = offerWorth(ask, D) * 0.95
    const offers = (fa.cpu[p.id] ?? []).map(x => ({ s: x.s, o: x.o, v: offerWorth(x.o, D) * teamFit(F, x.s, p) }))
    if (fa.bids[p.id]) offers.push({ s: F.team, o: fa.bids[p.id], v: offerWorth(fa.bids[p.id], D) * teamFit(F, F.team, p), raw: offerWorth(fa.bids[p.id], D) })
    const ok2 = offers.filter(x => (x.s === F.team ? x.raw >= floor * (teamFit(F, F.team, p) >= 1.1 ? 0.93 : 1) : true) && F.cap - payroll(F, F.teams[x.s]) - (x.s === F.team ? 0 : F.off.reserve?.[x.s] ?? 0) >= x.o.perYear - 0.001 && activeCount(F, F.teams[x.s]) < CAMP_MAX).sort((a, b) => b.v - a.v)
    const win = ok2[0]
    // some wait for the next round to see what else comes
    if (!win || (win.s !== F.team && fa.round < 3 && R.chance(p.ovr >= 84 ? 0.1 : 0.3))) continue
    sign(F, p, win.s, newContract(p, { yrs: win.o.years, sal: win.o.perYear, guarShare: win.o.guaranteed }), { quiet: p.ovr < 74 && win.s !== F.team })
    p.yrsHere = 0; p.mood = clamp(62 + Math.round((teamFit(F, win.s, p) - 1) * 40), 30, 90); delete p.from
    fa.signed.push({ player: { id: p.id, name: p.name, slot: slotOf(p), ovr: p.ovr }, team: teamRef(win.s), deal: { years: win.o.years, perYear: win.o.perYear }, mine: win.s === F.team })
    if (p.ovr >= 82 || win.s === F.team) addNews(F, 'signing', `${p.name} signs with the ${nick(win.s)}`, { team: win.s, pid: p.id, body: `${win.o.years} year${win.o.years > 1 ? 's' : ''}, ${moneyText(win.o.perYear)} a year.` })
  }
  fa.bids = {}
}
export function advanceFA(F) {
  const fa = F.off?.fa
  if (!fa || F.off.stage !== 'fa') return fail(F, 'fa', 'Free agency is not open.')
  resolveFA(F)
  if (fa.round >= 3) { fa.round = 4; return advanceStage(F) }
  fa.round++
  setSuitors(F)
  return touch(F)
}
// the staff's free agency: an offer at the asking price to the best man at each of the two biggest needs
function delegateFA(F) {
  const fa = F.off.fa, t = F.teams[F.team]
  const needs = needsOf(F, F.team).filter(n => n.need >= 0.3).slice(0, 3)
  let room = F.cap - payroll(F, t) - F.cap * 0.03
  for (const n of needs) {
    const best = F.fa.map(id => F.players[id]).filter(p => p && groupOf(p) === n.group && p.ovr >= n.starter + 1 && !fa.bids[p.id] && p.age <= 31).sort((a, b) => b.ovr - a.ovr)
      .find(p => faAsk(F, p, fa.round).perYear * 1.03 <= room)
    if (!best) continue
    const ask = faAsk(F, best, fa.round)
    fa.bids[best.id] = { years: ask.years, perYear: r2(ask.perYear * 1.03), guaranteed: ask.guaranteed }
    room -= ask.perYear * 1.03
  }
}

// ══ Undrafted free agents ═════════════════════════════════════════════════════
export function udfaPool(F) {
  if (!F.draft) return []
  const all = udfaList(F), rank = new Map(all.map((p, i) => [p.id, 225 + i]))
  return all.map(p => ({ ...prospectRow(F, p, rank.get(p.id)), signed: false }))
}
export function signUdfa(F, id) {
  const pr = F.draft?.prospects.find(x => x.id === id)
  if (F.off?.stage !== 'udfa' || !pr || pr.gone) return fail(F, 'udfa', 'He is not available.')
  const t = F.teams[F.team]
  if (activeCount(F, t) >= CAMP_MAX) return fail(F, 'roster', `The camp roster is full (${CAMP_MAX}).`)
  const p = signUdfaTo(F, pr, F.team)
  return touch(F, { ok: true, msg: `${p.name} signed.`, pid: p.id })
}
function delegateUdfa(F) {
  const t = F.teams[F.team]
  for (let k = 0; k < 3 && activeCount(F, t) < CAMP_MAX - 1; k++) {
    const needs = needsOf(F, F.team).slice(0, 5).map(n => n.group)
    const pr = udfaList(F).find(p => needs.includes(groupOf(p)))
    if (!pr) break
    signUdfaTo(F, pr, F.team)
  }
}

// ══ Training camp ═════════════════════════════════════════════════════════════
const CAMP_GROUPS = [
  ['QB', 'QUARTERBACKS', ['qb']], ['RB', 'RUNNING BACKS', ['rb']], ['WR', 'RECEIVERS', ['wr']], ['TE', 'TIGHT ENDS', ['te']], ['OL', 'OFFENSIVE LINE', ['ol']],
  ['DL', 'DEFENSIVE LINE', ['dl']], ['LB', 'LINEBACKERS', ['lb']], ['DB', 'SECONDARY', ['db']], ['K', 'KICKERS', ['k']],
]
const DRILL_GAMES = { ...COMBINE_GAMES, db: ['forty', 'cone', 'gauntlet'] }
function startCamp(F) {
  const R = rngOf(`${F.seed}-${F.off.year}-camp`), P = mine(F)
  // three groups: the ones with a build in them first, never the same drill twice
  const groups = R.shuffle(CAMP_GROUPS).sort((a, b) => (P.some(p => p.built && b[2].includes(p.pos)) ? 1 : 0) - (P.some(p => p.built && a[2].includes(p.pos)) ? 1 : 0)).filter(g => g[0] !== 'K' || P.some(p => p.built && p.pos === 'k'))
  const used = new Set(), drills = []
  for (const [id, title, pos] of groups) {
    if (drills.length >= 3) break
    const man = P.filter(p => pos.includes(p.pos) && !(p.inj && p.inj.wk > 0)).sort((a, b) => (b.built ? 1 : 0) - (a.built ? 1 : 0) || b.ovr - a.ovr)[0]
    const game = R.shuffle(DRILL_GAMES[pos[0]] ?? []).find(g => !used.has(g) && GAMES[g])
    if (!man || !game) continue
    used.add(game)
    drills.push({ id: `d${drills.length + 1}`, group: id, title, pos: pos[0], game, pid: man.id, done: null })
  }
  // holdouts: a star who is unhappy and underpaid does not report
  const holdouts = []
  const cul = F.coaches[F.teams[F.team].staff.hc]?.a.culture ?? 5.5
  for (const p of P) {
    if (!p.con || p.con.rookie && p.exp < 3 || p.ovr < 82 || p.con.tag) continue
    const mv = marketValue(p, F.cap)
    if (p.con.sal < mv * 0.72 && p.mood < 42 + (5.5 - cul) * 2 && R.chance(0.6 - (cul - 5.5) * 0.05)) { p.hold = 1; holdouts.push(p.id) }
  }
  F.off.camp = { drills, holdouts }
  for (const id of holdouts) addNews(F, 'signing', `${F.players[id].name} is holding out of ${nick(F.team)} camp`, { team: F.team, pid: id })
}
function drillPlayer(F, d) {
  const p = F.players[d.pid]
  if (!p) return null
  const build = asBuild(p), g = GAMES[d.game], keys = (g?.traits ?? []).filter(t => build[t])
  return { id: p.id, name: p.name, short: lastName(p.name), num: p.num ?? null, pos: p.pos, slot: slotOf(p), team: p.team, photo: p.photo ?? null, initials: initials(p.name), skin: p.skin ?? '#7a5030', built: !!p.built, ovr: p.ovr, grade: ovrGrade(p.ovr),
    v: Math.round(traitValue(d.game, build) * 100) / 100, traits: keys.map(t => ({ key: t, ...traitLabel(p.pos, t), val: p.a[t], grade: gradeOf(p.a[t]) })), build,
    kick: p.pos === 'k' ? { power: p.a.power ?? 5, accuracy: p.a.accuracy ?? 5, clutch: p.a.clutch ?? 5 } : null, dist: null, arm: p.pos === 'qb' ? p.a.arm ?? 5 : 5 }
}
export function campView(F) {
  const c = F.off?.camp
  if (!c) return { drills: [], holdouts: [], camp: { count: activeCount(F, F.teams[F.team]), limit: CAMP_MAX } }
  const dm = depthMap(F, F.teams[F.team])
  return {
    drills: c.drills.map(d => { const pl = drillPlayer(F, d); return { id: d.id, group: d.group, title: d.title, game: d.game, gameTitle: GAMES[d.game]?.title ?? d.game, player: pl, done: d.done,
      mg: pl ? { game: d.game, v: pl.v, arm: pl.arm, kick: pl.kick, seed: `${F.seed}-${F.off.year}-camp-${d.id}`, sport: 'nfl', pos: pl.pos, team: { short: F.team, color: teamRef(F.team).color, color2: teamRef(F.team).color2 }, opp: null, home: 'team', superBowl: null, situation: null, weather: null, cast: null } : null,
      medals: { gold: 'Every player in the group earns 600 XP.', silver: '380 XP for the group.', bronze: '200 XP for the group.' } } }),
    holdouts: c.holdouts.map(id => F.players[id]).filter(p => p && p.hold).map(p => { const ask = askOf(F, p); return { ...playerRow(F, p, dm), wants: { perYear: ask.perYear, years: ask.years }, options: [
      { id: 'pay', label: 'PAY HIM', text: `A new deal: ${ask.years} year${ask.years > 1 ? 's' : ''} at ${moneyText(ask.perYear)} a year. He reports today.` },
      { id: 'firm', label: 'HOLD FIRM', text: 'He is under contract. Most report before Week 1, unhappy; some sit out the first weeks of the season.' },
      { id: 'trade', label: 'SHOP HIM', text: 'He goes on the trade block and reports while the phones ring.' }], delegate: 'firm' } }),
    camp: { count: activeCount(F, F.teams[F.team]), limit: CAMP_MAX },
  }
}
export function resolveDrill(F, drillId, result = 'sim') {
  const c = F.off?.camp, d = c?.drills.find(x => x.id === drillId)
  if (!d) return fail(F, 'drill', 'There is no such drill.')
  if (d.done) return fail(F, 'drill', 'That drill has been run.')
  const pl = drillPlayer(F, d), R = rngOf(`${F.seed}-${F.off.year}-drill-${d.id}`)
  const score = result === 'sim' || result == null ? clamp(0.3 + (pl?.v ?? 5) * 0.05 + R.n() * 0.14, 0, 1) : clamp(Number(result.score ?? 0), 0, 1)
  const medal = score >= 0.85 ? 'gold' : score >= 0.65 ? 'silver' : score >= 0.45 ? 'bronze' : null
  const xp = medal === 'gold' ? 600 : medal === 'silver' ? 380 : medal === 'bronze' ? 200 : 80
  const dev = F.coaches[F.teams[F.team].staff.hc]?.a.talentDev ?? 5.5
  let n = 0
  for (const p of mine(F)) if (p.pos === d.pos) { giveXp(F, p, xp, dev); n++ }
  d.done = { medal, xp, score: Math.round(score * 100) / 100, text: medal ? `${medal[0].toUpperCase()}${medal.slice(1)}. ${n} ${d.title.toLowerCase()} earn ${xp} XP.` : `No medal. ${n} ${d.title.toLowerCase()} earn ${xp} XP for the work.` }
  return touch(F, { ok: true, msg: d.done.text, medal })
}
export function resolveHoldout(F, pid, optionId = 'delegate') {
  const c = F.off?.camp, p = F.players[pid]
  if (!c || !p || !p.hold) return fail(F, 'holdout', 'He is not holding out.')
  const opt = optionId === 'delegate' ? 'firm' : optionId, t = F.teams[F.team]
  const R = rngOf(`${F.seed}-${F.off.year}-holdout-${pid}`)
  if (opt === 'pay') {
    const ask = askOf(F, p)
    if (F.settings.cap && payroll(F, t) - p.con.sal + ask.perYear > F.cap + 0.001) return fail(F, 'cap', `His number does not fit: ${moneyText(r2(payroll(F, t) - p.con.sal + ask.perYear - F.cap))} over the cap.`)
    p.con = newContract(p, { yrs: ask.years, sal: ask.perYear, guarShare: ask.guaranteed }); p.hold = undefined; p.mood = clamp(p.mood + 25, 3, 97)
    addTx(F, 'extend', F.team, `${teamName(F.team)} gave ${slotOf(p)} ${p.name} a new deal (${ask.years} year${ask.years > 1 ? 's' : ''}, ${moneyText(ask.perYear)} a year) to end his holdout.`, p.id)
    return ok(F, `${p.name} signs and reports.`)
  }
  if (opt === 'trade') { p.hold = undefined; p.block = true; p.want = true; p.mood = clamp(p.mood - 4, 3, 97); return ok(F, `${p.name} reports. He is on the block.`) }
  // hold firm: most come in; some sit
  if (R.chance(0.62 + ((F.coaches[t.staff.hc]?.a.culture ?? 5.5) - 5.5) * 0.04)) { p.hold = undefined; p.mood = clamp(p.mood - 6, 3, 97); return ok(F, `${p.name} reports to camp, unhappy.`) }
  p.hold = undefined; p.inj = { wk: R.int(1, 3), what: 'Contract holdout', ir: false, fresh: false }; p.mood = clamp(p.mood - 12, 3, 97)
  return ok(F, `${p.name} is staying away. He will miss the start of the season.`)
}

// ══ Final cuts ════════════════════════════════════════════════════════════════
// who the staff would let go to reach the limit: the worst at each group beyond what it carries
export function cutList(F, short) {
  const t = F.teams[short], P = t.roster.map(id => F.players[id]).filter(p => p && !p.inj?.ir)
  const over = P.length - ROSTER_MAX
  if (over <= 0) return []
  const keep = new Set(), by = {}
  for (const p of P) (by[groupOf(p)] ??= []).push(p)
  // (teams keep their young players and their picks: a rookie a point or two behind a 30-year-old stays)
  const worth = p => p.ovr + (p.dev ?? 0) * 2.5 + (p.age <= 23 ? 5 : p.age <= 25 ? 2.5 : p.age >= 32 ? -8 : p.age >= 30 ? -4 : p.age >= 28 ? -1.5 : 0) + (p.built ? 100 : 0) + ((p.con?.guar ?? 0) > 3 ? 4 : 0) + (p.rk && p.draft ? (p.draft[1] <= 2 ? 12 : p.draft[1] <= 4 ? 7 : 3) : 0)
  for (const g of GROUPS) { const list = (by[g] ?? []).sort((a, b) => worth(b) - worth(a)); list.slice(0, MIN_AT[g]).forEach(p => keep.add(p.id)) }
  const rest = P.filter(p => !keep.has(p.id)).sort((a, b) => (worth(a) + Math.max(0, TARGET_AT[groupOf(a)] - by[groupOf(a)].length) * 3) - (worth(b) + Math.max(0, TARGET_AT[groupOf(b)] - by[groupOf(b)].length) * 3))
  // drop the worst, one at a time, never taking a group under its target while another is over
  const count = Object.fromEntries(GROUPS.map(g => [g, (by[g] ?? []).length])), out = []
  while (out.length < over) {
    const p = rest.find(x => !out.includes(x) && count[groupOf(x)] > TARGET_AT[groupOf(x)]) ?? rest.find(x => !out.includes(x) && count[groupOf(x)] > MIN_AT[groupOf(x)])
    if (!p) break
    out.push(p); count[groupOf(p)]--
  }
  return out
}
export function cutsView(F) {
  const t = F.teams[F.team], dm = depthMap(F, t), count = activeCount(F, t)
  const prob = []
  const c = groupCounts(F, t)
  for (const g of GROUPS) if (c[g] < MIN_AT[g]) prob.push(`Short at ${g}: ${c[g]} of the ${MIN_AT[g]} needed`)
  if (F.settings.cap && payroll(F, t) > F.cap + 0.001) prob.push(`${moneyText(r2(payroll(F, t) - F.cap))} over the cap`)
  return { count, limit: ROSTER_MAX, over: Math.max(0, count - ROSTER_MAX), roster: t.roster.map(id => F.players[id]).filter(Boolean).map(p => ({ ...playerRow(F, p, dm), cut: cutCost(p) })).sort((a, b) => a.ovr - b.ovr), suggested: cutList(F, F.team).map(p => p.id), problems: prob }
}
export function autoCut(F) {
  for (const p of cutList(F, F.team)) release(F, p)
  return ok(F, 'The roster is at the limit.')
}

// ══ Moving through the stages ═════════════════════════════════════════════════
function enter(F, id) {
  F.off.stage = id; F.stage = id
  if (id === 'staff') { newLeagueYear(F); coachCarousel(F) }
  if (id === 'resign') startResign(F)
  if (id === 'fa') { cpuResign(F); startFA(F) }
  if (id === 'draft') startDraft(F)
  if (id === 'udfa') { /* the board is what is left */ }
  if (id === 'camp') { cpuUdfa(F); startCamp(F) }
  if (id === 'cuts') { /* the user's to do */ }
  // every CPU team ends a stage under the cap (the user's own is his to manage; the staff does it on the autopilot)
  for (const s of TEAM_SHORTS) if (s !== F.team || F.off.auto) capFix(F, F.teams[s])
}
function leave(F, id) {
  if (id === 'review' && F.off.fired) { const o = jobOffersFor(F)[0]; if (o) takeJob(F, o.short); else F.off.fired = false }
  if (id === 'staff') delegateStaff(F)
  if (id === 'resign') delegateResign(F)
  if (id === 'fa') { while (F.off.fa.round <= 3) { if (!Object.keys(F.off.fa.bids).length && F.off.auto) delegateFA(F); resolveFA(F); F.off.fa.round++; if (F.off.fa.round <= 3) setSuitors(F) } cpuFill(F) }
  if (id === 'draft' && !F.draft.done) autoDraft(F)
  if (id === 'udfa' && F.off.auto) delegateUdfa(F)
  if (id === 'camp') { for (const d of F.off.camp.drills) if (!d.done) resolveDrill(F, d.id, 'sim'); for (const pid of F.off.camp.holdouts) if (F.players[pid]?.hold) resolveHoldout(F, pid, 'delegate') }
  if (id === 'cuts') { for (const p of cutList(F, F.team)) release(F, p) }
}
// after free agency every CPU team fills what it is still short of from the men left
function cpuFill(F) {
  const R = rngOf(`${F.seed}-${F.off.year}-fill`)
  topUpFreeAgents(F, R, 90)
  for (const s of TEAM_SHORTS) if (s !== F.team) upkeep(F, F.teams[s], R)
}
export function advanceStage(F, { auto = false } = {}) {
  if (F.phase !== 'offseason' || !F.off) return fail(F, 'offseason', 'The season is on.')
  const i = stageIdx(F.off.stage)
  F.off.auto = auto || !!F.off.auto
  if (F.off.stage === 'review' && F.off.fired && !auto) { /* the staff takes the best offer when the GM does not choose */ }
  leave(F, F.off.stage)
  if (i >= STAGES.length - 1) { rollOver(F); return touch(F) }
  enter(F, STAGES[i + 1].id)
  return touch(F)
}

// ══ The league turns over ═════════════════════════════════════════════════════
function rollOver(F) {
  const y = F.off.year, R = rngOf(`${F.seed}-${y}-rollover`)
  // every CPU team down to the limit and legal
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s]
    if (s !== F.team) for (const p of cutList(F, s)) release(F, p, { quiet: true })
    capFix(F, t)
  }
  const before = Object.fromEntries(mine(F).map(p => [p.id, p.ovr]))
  const changes = []
  for (const id in F.players) {
    const p = F.players[id]
    // the season goes into his history
    if ((p.s.g ?? 0) > 0) { p.hist.push(histLine(p, y, p.team ?? '')); if (p.hist.length > 22) p.hist.shift() }
    p.s = {}
    p.age++; p.exp++; delete p.rk; delete p.potw; delete p.asked; delete p.promise; delete p.first; delete p.from; delete p.brk
    if (p.team) p.yrsHere = (p.yrsHere ?? 0) + 1
    if (p.con?.opt === 2 && p.opt5 && p.con.yrs === 1) { p.con.sal = p.opt5; p.con.guar = p.opt5; p.con.rookie = 0; delete p.opt5 }
    // the offseason program: young men grow, the staff spends what they earned
    if (p.team) { giveXp(F, p, 320, F.coaches[F.teams[p.team].staff.hc]?.a.talentDev ?? 5.5); if (p.team !== F.team || F.settings.autoUpgrade) spendPoints(p) }
    // and age takes its share
    const slipped = ageOne(F, p)
    if (p.team === F.team && slipped.length) changes.push({ id: p.id, d: 0, text: `Lost a step: ${slipText(p, slipped)}` })
    p.wear = 0
    p.inj = p.inj && p.inj.what === 'Contract holdout' ? p.inj : null
    p.hold = undefined
    p.mood = clamp(Math.round(p.mood + (60 - p.mood) * 0.35), 3, 97)
    if (!p.devKnown && p.exp >= 1) p.devKnown = true
  }
  // free agents nobody signed drift out of the league; the street is restocked
  const keepFa = new Set([...F.fa].map(id => F.players[id]).filter(Boolean).sort((a, b) => (b.ovr - b.age * 0.6) - (a.ovr - a.age * 0.6)).slice(0, 90).map(p => p.id))
  for (const id of [...F.fa]) { const p = F.players[id]; if (!p || !keepFa.has(id) || p.age >= 31 || (p.exp >= 3 && p.ovr < 66) || R.chance(0.2)) { delete F.players[id] } else p.con = null }
  F.fa = F.fa.filter(id => F.players[id])
  topUpFreeAgents(F, R, 70)
  for (const p of mine(F)) { const d = p.ovr - (before[p.id] ?? p.ovr); const had = changes.find(c => c.id === p.id); if (had) had.d = d; else if (d) changes.push({ id: p.id, d, text: d > 0 ? 'Developed over the offseason' : 'Slipped' }) }
  // the new season
  const S = standing(F), order = {}
  for (const d of DIVISIONS) order[d.name] = S.divisions[d.name]
  F.year = y + 1; F.week = 1; F.phase = 'regular'; F.stage = null
  F.sched = makeSchedule(F.seed, F.year, order); F.order = order
  F.playoffs = null; F.boxes = {}; F.weekly = []; F.game = null; F.last = null; F.offers = []; F.office = []; F.done = {}; F.plan = { off: 'balanced', def: 'balanced' }
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s]
    t.rec = null; t.st = null
    t.picks = t.picks.filter(pk => pk.y > y + 1)
    for (let r = 1; r <= 7; r++) t.picks.push({ y: F.year + 3, r, o: s })
    for (const pk of t.picks) delete pk.slot
    upkeep(F, t, R)
    capFix(F, t)
    autoDepth(F, t)
  }
  const rookies = mine(F).filter(p => p.exp === 0 || (p.draft && p.draft[0] === F.year)).map(p => p.id)
  F.newSeason = { year: F.year, changes: changes.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 30), rookies }
  F.draft = { keep: 0 }
  newDraftClass(F)
  prepWeek(F)
  powerRankings(F)
  setExpectations(F, s => teamRating(F, F.teams[s]).ovr)
  // every team's state is read again; the GM's direction stands unless he changed it (the staff follows the roster)
  const auto = !!F.off.auto
  computeStates(F)
  if (auto || !F.gm.dir) F.gm.dir = F.teams[F.team].state
  F.gm.dirAt = null
  F.owner = null; startOwner(F)
  F.off = null
  makeOffice(F, R)
  addNews(F, 'league', `The ${F.year} season is here`)
}
export function newSeason(F) {
  const n = F.newSeason
  if (!n) return { year: F.year, goals: ownerView(F).goals, changes: [], schedule: scheduleView(F), rookies: [] }
  return { year: n.year, goals: ownerView(F).goals, changes: n.changes.map(c => (F.players[c.id] ? { player: playerRow(F, F.players[c.id]), d: c.d, text: c.text } : null)).filter(Boolean), schedule: scheduleView(F), rookies: n.rookies.map(id => F.players[id]).filter(Boolean).map(p => playerRow(F, p)) }
}
export { AWARD_NAME, DEV, COACH_TYPES, minDeal, joinTeam, draftBoard, roll, ranks, reOvr, moodOf, drivesFor }
