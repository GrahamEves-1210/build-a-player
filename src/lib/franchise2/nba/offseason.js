// NBA FRANCHISE: the summer, a stop at a time (F.off.step):
//   awards  the season's awards, the year on the wall (hist), every man's season onto his career line
//   lottery the drawing (draft.js), the order for both rounds
//   draft   draft night (draft.js), the rookies signed (B's rookieDeal)
//   resign  the league a year older (C's ageLeague: growth, decline, retirements), deals tick and options are decided
//           (B's seasonEndDeals); the GM's own free agents: re-sign or let go (B's resignOffer)
//   fa      free agency (B: askOf, canSign, signMan, faDay; the other 29 teams at the end, cpuOffseason)
//   camp    the GM's roster down to 15 standard and 3 two-way contracts (B's legalRoster, cutMan), then a new season
import { SHORTS, TEAM, nick, manOf, teamOfMan, fillTeam, ROSTER_MAX, CONF_OF, leagueNames, makeGen, thinSpot } from './league'
import { records, recText, confOrder, pct } from './season'
import { makeSchedule } from './schedule'
import { makeClass, makePicks, runLottery, openDraft, closeDraft, scoutSpring } from './draft'
import { addNews } from './news'
import * as X from './seams'
import { growBuilds } from './builds'
import { rngOf } from '../rng'

export const STEPS = ['awards', 'lottery', 'draft', 'resign', 'fa', 'camp']
export const STEP_NAME = { awards: 'Awards', lottery: 'Lottery', draft: 'Draft', resign: 'Re-sign', fa: 'Free agency', camp: 'Camp' }

// the season's last game played: into the summer
export function closeSeason(F) {
  if (F.phase !== 'done') return
  const R = records(F)
  const aw = X.seasonAwards(F) ?? {}
  const who = i => { const p = manOf(F, i); return p ? { i, n: p.n, s: teamOfMan(F, i) } : null }
  const A = {}
  for (const k of ['MVP', 'ROY', 'DPOY', '6MOY', 'MIP', 'CLUTCH']) if (aw[k] != null) { A[k] = who(aw[k]); const p = manOf(F, aw[k]); if (p) (p.aw ??= []).push({ y: F.year, k }) }
  A.ALL = (aw.ALL ?? []).map((team, k) => team.map(i => { const p = manOf(F, i); if (p) (p.aw ??= []).push({ y: F.year, k: `ALL${k + 1}` }); return who(i) }).filter(Boolean))
  for (const [key, tag] of [['ALLDEF', 'DEF'], ['ROOKIE', 'RK']]) if (aw[key]) A[key] = aw[key].map((t, k) => t.map(i => { const p = manOf(F, i); if (p) (p.aw ??= []).push({ y: F.year, k: `${tag}${k + 1}` }); return who(i) }).filter(Boolean))
  A.FMVP = F.po?.fmvp != null ? who(F.po.fmvp) : null
  // the GM's year
  const me = F.team, r = R[me]
  const finish = finishOf(F, me)
  F.hist = [...(F.hist ?? []), { y: F.year, s: me, w: r.w, l: r.l, seed: seedOf(F, me), finish, champ: F.po?.champ ?? null, aw: A, ru: runnerUp(F) }]
  // every man's season onto his career line (regular season; the playoffs kept beside it)
  for (const s of SHORTS) for (const p of F.teams[s].r) {
    const x = F.ss?.[p.i], y = F.ps?.[p.i]
    if (x?.gp) { (p.car ??= []).push(carRow(F.year, x.s ?? s, x, y)); foldCareer(p) }
  }
  for (const k of ['MVP', 'ROY', 'DPOY', '6MOY', 'MIP']) if (A[k]) addNews(F, { k: 'award', tag: k === '6MOY' ? 'SIXTH MAN' : k, s: A[k].s, text: `${A[k].n} (${nick(A[k].s)}) is the ${AWARD_FULL[k]}` })
  for (const x of X.updateRecords(F) ?? []) addNews(F, { tag: 'RECORD', ...x, k: 'record' })
  F.phase = 'off'
  F.off = { step: 'awards' }
}
// a season on a man's career line: the counting stats only (C's extras, the season highs and the clutch points, stay
// in F.ss for the season), and the playoffs as games, points, rebounds and assists. Kept small: ~500 men carry them.
export const CAR_K = ['gp', 'min', 'pts', 'reb', 'ast', 'stl', 'blk', 'fgm', 'fga', 'tpm']
// a long career keeps its last six seasons as rows; the ones before fold into one line ({ y, y2, s: '' }: the span)
export function foldCareer(p, keep = 6) {
  const c = p.car ?? []
  if (c.length <= keep) return
  const old = c.slice(0, c.length - keep + 1)
  const f = { y: old[0].y, y2: old[old.length - 1].y2 ?? old[old.length - 1].y, s: '' }
  for (const k of CAR_K) f[k] = old.reduce((a, r) => a + (r[k] ?? 0), 0)
  p.car = [f, ...c.slice(c.length - keep + 1)]
}
export function carRow(y, s, x, po = null) {
  const r = { y, s }
  for (const k of CAR_K) r[k] = Math.round(x[k] ?? 0)
  if (po?.gp) r.po = [po.gp, Math.round(po.pts ?? 0), Math.round(po.reb ?? 0), Math.round(po.ast ?? 0)]
  return r
}
export const AWARD_FULL = { CLUTCH: 'Clutch Player of the Year', MVP: 'Most Valuable Player', ROY: 'Rookie of the Year', DPOY: 'Defensive Player of the Year', '6MOY': 'Sixth Man of the Year', MIP: 'Most Improved Player', FMVP: 'Finals MVP' }
function runnerUp(F) { const S = F.po?.all?.[3]?.[0]; return S ? (S.done === S.hi ? S.lo : S.hi) : null }
export function seedOf(F, s) {
  const P = F.po
  if (!P) return null
  const fin = P.final?.[CONF_OF[s]]
  return fin && fin.includes(s) ? fin.indexOf(s) + 1 : null
}
// how a team's season ended: 'champ' | 'finals' | 'cf' | 'r2' | 'r1' | 'playin' | 'lottery'
export function finishOf(F, s) {
  const P = F.po
  if (!P) return null
  if (P.champ === s) return 'champ'
  for (let rd = 3; rd >= 0; rd--) if (P.all?.[rd]?.some(S => S.hi === s || S.lo === s)) return ['r1', 'r2', 'cf', 'finals'][rd]
  if (P.seeds?.[CONF_OF[s]]?.slice(6, 10).includes(s)) return 'playin'
  return 'lottery'
}
export const FINISH_TEXT = { champ: 'NBA champions', finals: 'Lost in the Finals', cf: 'Lost in the conference finals', r2: 'Lost in the second round', r1: 'Lost in the first round', playin: 'Out in the play-in', lottery: 'Missed the postseason' }

// ── The stops ────────────────────────────────────────────────────────────────
export function nextStep(F) {
  const o = F.off
  if (!o) return null
  const at = STEPS.indexOf(o.step)
  leave(F, o.step)
  if (at === STEPS.length - 1) { newSeason(F); return 'season' }
  o.step = STEPS[at + 1]
  enter(F, o.step)
  return o.step
}
function enter(F, step) {
  if (step === 'lottery') { runLottery(F); scoutSpring(F) }
  if (step === 'draft') openDraft(F)
  if (step === 'resign') {
    X.tickInjuries(F, 130)   // (the summer: about four months off)
    const A = X.ageLeague(F) ?? {}
    // (ageLeague files the retired men in F.retired and writes their news; the wall keeps a man's totals, not his rows)
    for (const x of A.news ?? []) addNews(F, { tag: 'RETIRES', ...x })
    for (const g of growBuilds(F)) if (g.to > g.from) addNews(F, { k: 'grow', tag: 'DEVELOPMENT', s: F.team, text: `${g.n} worked his way from a ${g.from} to a ${g.to} this summer` })
    F.retired = (F.retired ?? []).map(retiredRow).slice(-150)
    const gone = X.seasonEndDeals(F) ?? []
    for (const x of gone.news ?? []) addNews(F, x)
    F.off.mine = gone.filter(p => p.was === F.team).map(p => p.i)
    F.off.kept = []
  }
  if (step === 'fa') { F.off.day = 0 }
}
function leave(F, step) {
  if (step === 'draft') { while (F.dn && F.dn.at < 60) { const { makePick } = DRAFT; makePick(F) } closeDraft(F) }
  if (step === 'fa') {
    for (const x of X.cpuOffseason(F, { make: (F2, s) => makeGen(F2, thinSpot(F2.teams[s].r), rngOf(`${F2.seed}-camp-${F2.year}-${s}`)) }) ?? []) addNews(F, x)
  }
}
import * as DRAFT from './draft'
// the GM's own free agent: keep him (his ask) or let him walk
export function resignMine(F, id, yes) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return { ok: false }
  F.off.mine = (F.off.mine ?? []).filter(i => i !== id)
  if (!yes) { X.renounce(F, F.team, id); addNews(F, { k: 'fa', tag: 'FREE AGENT', s: F.team, text: `The ${nick(F.team)} renounce their rights to ${p.n}; he is an unrestricted free agent` }); return { ok: true } }
  const deal = X.resignOffer(F, p)
  if (!deal) return { ok: false, why: 'He wants to test the market' }
  const c = X.canSign(F, F.team, p, { ...deal, bird: true })
  if (!c.ok) { F.off.mine.push(id); return c }
  X.signMan(F, F.team, p, { ...deal, bird: true })
  F.off.kept.push(id)
  addNews(F, { k: 'sign', tag: 'RE-SIGNED', s: F.team, text: `${p.n} re-signs with the ${nick(F.team)}: ${deal.y} ${deal.y === 1 ? 'year' : 'years'}, $${deal.$.toFixed(1)} million a year` })
  return { ok: true }
}
// the GM signs a free agent at his ask
export function signFA(F, id) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return { ok: false }
  const deal = X.askOf(F, p)
  const c = X.canSign(F, F.team, p, deal)
  if (!c.ok) return c
  X.signMan(F, F.team, p, { ...deal, via: c.via })
  addNews(F, { k: 'sign', tag: 'SIGNED', s: F.team, text: `${p.n} agrees to a ${deal.y}-year, $${(deal.$ * deal.y).toFixed(1)} million deal with the ${nick(F.team)}` })
  return { ok: true, deal }
}
export function faNext(F) {
  F.off.day = (F.off.day ?? 0) + 1
  for (const x of X.faDay(F, F.off.day) ?? []) addNews(F, x)
}
// camp: the GM's roster has to be legal before the season (the CPU teams make theirs legal themselves)
export const campCheck = F => X.legalRoster(F, F.team, { season: true })

// a retired man, kept for the history page: his name, team, age, seasons, totals and honours (not every season's row)
export function retiredRow(r) {
  if (!r.car) return r
  const t = { gp: 0, pts: 0, reb: 0, ast: 0 }
  for (const c of r.car) for (const k in t) t[k] += c[k] ?? 0
  const aw = (r.aw ?? []).filter(a => !['AS', 'CHAMP'].includes(a.k)).map(a => `${a.y}${a.k}`)
  const as = (r.aw ?? []).filter(a => a.k === 'AS').length, ch = (r.aw ?? []).filter(a => a.k === 'CHAMP').length
  return { i: r.i, n: r.n, ag: r.ag, s: r.s ?? null, yrs: r.yrs ?? r.car.length, o: r.o, y: r.car.at(-1)?.y ?? null, t: [t.gp, t.pts, t.reb, t.ast], ...(aw.length && { aw }), ...(as && { as }), ...(ch && { ch }), ...(r.b != null && { b: r.b }) }
}
// the street: the best 90 men left unsigned stay on the market; the rest leave the league (made-up men simply go, a
// real one goes onto the retired list)
export function pruneStreet(F) {
  const fa = (F.fa ?? []).slice().sort((a, b) => b.o - a.o)
  for (const p of fa.slice(55)) if (!p.gn) F.retired = [...(F.retired ?? []), retiredRow({ ...p, car: p.car ?? [], yrs: p.ys })]
  F.fa = fa.slice(0, 55)
  F.retired = (F.retired ?? []).slice(-150)
}
export function newSeason(F) {
  // the CPU rosters: legal (cut the lowest men past 15, fill short rosters off the street, then made-up men)
  const R = rngOf(`${F.seed}-camp-${F.year}`)
  const taken = leagueNames(F)
  for (const s of SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s]
    const std = () => t.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)
    while (std().length > ROSTER_MAX) X.cutMan(F, s, std()[0].i)
    while (t.r.filter(p => p.tw).length > 3) X.cutMan(F, s, t.r.filter(p => p.tw).sort((a, b) => a.o - b.o)[0].i)
    fillTeam(F, s, R, taken, { twoWay: 2 })
    for (const p of t.r) if (p.$ == null) X.dealOnLoad(F, p, s)
  }
  pruneStreet(F)
  F.drafts = Object.fromEntries(Object.entries(F.drafts ?? {}).filter(([y]) => +y > F.year - 3))
  F.picks = (F.picks ?? []).filter(p => p.y > F.year + 1)
  F.year++
  F.phase = 'season'
  F.off = null
  F.ss = {}; F.ps = {}; F.po = null; F.log = []; F.box = []; F.asDone = 0; F.as = null; F.pend = null
  for (const s of SHORTS) { F.teams[s].dead = (F.teams[s].dead ?? []).map(d => ({ ...d, y: d.y - 1 })).filter(d => d.y > 0) }
  makeSchedule(F)
  makePicks(F)
  makeClass(F)
  addNews(F, { k: 'season', tag: 'OPENING NIGHT', text: `The ${F.year}-${String((F.year + 1) % 100).padStart(2, '0')} season tips off` })
}
export { recText, pct, confOrder }

// the GM's team options on next season (decided in June, before free agency): pick it up or decline it
export const teamOptions = F => (X.optionsDue(F, F.team) ?? []).filter(x => x.k === 'T')
export function setOption(F, id, keep) {
  const p = F.teams[F.team].r.find(x => x.i === id)
  if (!p) return
  p.optd = keep ? 1 : 0
}
// an offer sheet one of the GM's restricted free agents signed: match it (he stays on those terms) or let him go
export function answerSheet(F, id, yes) {
  const r = X.matchSheet(F, F.team, id, yes)
  for (const x of r?.news ?? []) addNews(F, x)
  return r
}

// the men on the street who'd sign for the minimum (a veteran's minimum by his years in the league): the end of the
// bench any team can add, over the cap or the aprons
const minDeal = (F, p) => ({ $: X.minOf(p.ys ?? 0, X.capYear(F)), y: 1, r: 0 })
export const minPool = (F, n = 12) => (F.fa ?? []).filter(p => (!p.fr || p.fr !== F.team || p.rn) && X.rankOf(F, p) > 60 && p.o < 85).filter(p => (X.askOf(F, p)?.$ ?? 99) <= minDeal(F, p).$ * 1.8).sort((a, b) => b.o - a.o).slice(0, n)
export function signMin(F, id) {
  const p = (F.fa ?? []).find(x => x.i === id)
  if (!p) return { ok: false }
  const d = minDeal(F, p)
  const r = X.signMan(F, F.team, p, d)
  if (r?.ok === false) return r
  addNews(F, { k: 'sign', tag: 'SIGNED', s: F.team, text: `${p.n} signs a one-year minimum deal with the ${nick(F.team)}` })
  return { ok: true }
}
