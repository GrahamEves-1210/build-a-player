// FRANCHISE: the draft. A class of about 270 prospects is made when a season starts, so it can be scouted all
// year. The first class uses the game's real college quarterbacks, running backs and receivers by name
// (data/cfb-players.js: seniors, and the best of the juniors and third-year sophomores); everyone else, and
// every later class, is generated (the game's name lists, real colleges).
//
// A prospect's real trait grades and development tier are hidden. What shows is a range ("B to A") that
// narrows as he is scouted: weekly points in season, the combine in the offseason. The CPU's teams draft off
// their own boards (the real grade seen through noise, tilted by need), so there are reaches, steals and busts.
//
// F.draft = { year, pts, prospects: [P], order: [{ o: original team, t: owner }] | null, at: next pick index,
//             picks: [{ n, r, t, pid, name, pos, college }], started, done }
//   P: { id, name, pos, sub, college, age, ht, wt, a (ratings as a base-12 string), ovr, dev, cons (consensus
//        grade), sc (how well the user has scouted him, 0-3), cmb: [forty, bench, cone, vert], real, photo, skin, gone }
import { CFB_QBS, CFB_RBS, CFB_WRS } from '../../data/cfb-players'
import { CFB_TEAM_BY_SHORT } from '../../data/cfb-teams'
import { FIRST_YEAR, OL_SPOTS, CAMP_MAX, clamp, r2, slotOf, ovrGrade, gradeOf, groupOf, TARGET_AT, MIN_SALARY } from './consts'
import { rngOf, roll, hashStr } from './rng'

// a number in [0, 1) from two integers (no strings: the CPU's boards ask for thousands of these)
function mix(a, b) { let t = (a ^ Math.imul(b, 0x9E3779B1)) | 0; t = Math.imul(t ^ (t >>> 15), 0x85EBCA6B); t = Math.imul(t ^ (t >>> 13), 0xC2B2AE35); return ((t ^ (t >>> 16)) >>> 0) / 4294967296 }
import { TYPES_OF, genName, genCollege, genAttrsToOvr, ovrOf, genPlayer, traitLabel, realPool, reOvr } from './players'
import { TEAM_SHORTS, touch, fail, ok, addPlayer, joinTeam, addNews, addTx, teamName, nick, activeCount, groupCounts } from './core'
import { standing } from './standings'
import { rookieDeal, capSpace } from './money'
import { drivesFor } from './league'
import { teamRef } from './rows'
import { lineupOf } from './depth'
import { pickKey, pickPoints, pickValue, judge, execute, offerText, pickOverall, pickWhen, pickText } from './trades'

const D12 = '0123456789ab'
const pack = (pos, a) => TYPES_OF[pos].map(t => D12[clamp(Math.round(a[t] ?? 0), 0, 11)]).join('')
export const unpack = (pos, s) => Object.fromEntries(TYPES_OF[pos].map((t, i) => [t, Math.max(0, D12.indexOf(s[i] ?? '5'))]))

// how many of each a class has
const CLASS = [['qb', null, 16], ['rb', null, 26], ['wr', null, 38], ['te', null, 16], ['ol', 'LT', 10], ['ol', 'RT', 9], ['ol', 'LG', 9], ['ol', 'RG', 8], ['ol', 'C', 9], ['dl', 'edge', 27], ['dl', 'dt', 24], ['lb', null, 26], ['db', 'cb', 30], ['db', 's', 22], ['k', null, 4]]
const CLASS_SIZE = CLASS.reduce((s, c) => s + c[2], 0)
// the rookie OVR a prospect of a given talent rank comes in at (rank 0 is the best in the class)
function ovrForRank(R, i) {
  const base = i < 5 ? 86 - i * 0.7 : i < 32 ? 82.5 - (i - 5) * 0.19 : i < 64 ? 77 - (i - 32) * 0.09 : i < 100 ? 74 - (i - 64) * 0.065 : i < 160 ? 71.6 - (i - 100) * 0.055 : i < 224 ? 68.2 - (i - 160) * 0.04 : 65.6 - (i - 224) * 0.06
  return clamp(Math.round(base + R.n() * 1.5), 60, 87)
}
// (the tiers sit where the talent is: most of a class's future stars are its best prospects, with the odd one hiding late)
const devRoll = (R, ovr) => { const u = R.u(), k = ovr >= 82 ? 7 : ovr >= 79 ? 4.5 : ovr >= 76 ? 2.6 : ovr >= 73 ? 1.2 : ovr >= 70 ? 0.5 : 0.2; return u < 0.008 * k ? 3 : u < 0.038 * k ? 2 : u < Math.min(0.8, 0.14 * k) ? 1 : 0 }
// combine numbers that follow the ratings (a little noise: workouts lie)
function combine(R, pos, a) {
  const spd = a.speed ?? a.legs ?? a.range ?? a.mobility ?? a.getOff ?? 5, str = a.strength ?? a.power ?? a.anchor ?? a.size ?? 5, agi = a.elusiveness ?? a.routeRunning ?? a.fluidity ?? a.bend ?? a.mobility ?? 5, vrt = a.vertical ?? a.bodyControl ?? a.burst ?? spd
  const big = pos === 'ol' ? 0.75 : pos === 'dl' ? 0.42 : pos === 'te' || pos === 'lb' ? 0.2 : pos === 'qb' ? 0.3 : 0
  return [r2(4.26 + big + (11 - spd) * 0.036 + R.n() * 0.03), clamp(Math.round(8 + str * 2.3 + big * 9 + R.n() * 2), 4, 42), r2(6.5 + big * 0.9 + (11 - agi) * 0.06 + R.n() * 0.05), clamp(Math.round(27 + vrt * 1.25 - big * 5 + R.n() * 1.5), 20, 46)]
}
// a real college player on the NFL's scale: college grades are given against college players
function fromCollege(R, row, pos) {
  const a = {}
  for (const t of TYPES_OF[pos]) { const v = row.attrs?.[t] ?? 5; a[t] = clamp(Math.round(t === 'size' ? v * 0.85 : v * 0.7 + 0.2 + R.n() * 0.5), 0, 11) }
  return a
}
// the same man at a given OVR: single grades moved until his overall lands on it
function toOvr(R, pos, a, target) {
  const types = TYPES_OF[pos].filter(t => t !== 'size')
  for (let k = 0; k < 80; k++) {
    const o = ovrOf(pos, a)
    if (o === target) break
    const t = R.pick(types)
    if (o < target && a[t] < 11) a[t]++; else if (o > target && a[t] > 0) a[t]--
  }
  return a
}
const ELIG = new Set(['SR', 'RS-SR', 'JR', 'RS-JR', 'RS-SO'])
const SENIOR = new Set(['SR', 'RS-SR'])

export function newDraftClass(F) {
  const year = F.year + 1, R = rngOf(`${F.seed}-class-${year}`)
  const taken = new Set(Object.values(F.players).map(p => p.name))
  const list = []
  const put = p => { p.id = list.length + 1; list.push(p) }
  const first = F.year === FIRST_YEAR
  if (first) {
    // the real ones: seniors, and the underclassmen good enough to come out
    // (college grades are against college players: the best quarterback in the country is not sixteen first-round
    // picks. Each position's real players are laid over the class's talent order the way the generated men are,
    // best first, and each keeps the shape of his game at the grade that order gives him)
    const take = (rows, pos, n) => rows.filter(r => r.attrs && ELIG.has(r.year) && !realPool().has(r.name) && !taken.has(r.name) && (SENIOR.has(r.year) || (r.ovr ?? 0) >= 86))
      .sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0)).slice(0, n).forEach((r, k, all) => {
        const a = toOvr(R, pos, fromCollege(R, r, pos), ovrForRank(R, Math.floor((k + R.u()) * CLASS_SIZE / all.length)))
        taken.add(r.name)
        put({ name: r.name, pos, sub: null, college: CFB_TEAM_BY_SHORT[r.team]?.school ?? r.teamName ?? null, age: SENIOR.has(r.year) ? (r.year === 'RS-SR' ? 23 : 22) : 21, ht: r.height ?? null, wt: r.weight ?? null, a: pack(pos, a), ovr: ovrOf(pos, a), dev: 0, real: 1, photo: r.headshot ?? null, skin: r.skin ?? null, num: r.number ?? null })
      })
    take(CFB_QBS, 'qb', 16); take(CFB_RBS, 'rb', 26); take(CFB_WRS, 'wr', 38)
  }
  // everyone else: a talent order across the class, then ratings that land on it
  const slots = []
  for (const [pos, sub, n] of CLASS) { const have = first ? list.filter(p => p.pos === pos).length : 0; for (let i = have; i < n; i++) slots.push([pos, sub]) }
  const order = R.shuffle(slots)
  const total = list.length + order.length
  // the real players already hold some of the class's talent ranks: generated men take the rest, spread evenly
  order.forEach(([pos, sub], i) => {
    const rank = Math.floor((i + R.u()) * total / order.length)
    const ovr = pos === 'k' ? clamp(Math.round(74 + R.n() * 4), 66, 84) : ovrForRank(R, rank)
    const a = genAttrsToOvr(R, pos, sub, ovr, 1.5)
    put({ name: genName(R, taken), pos, sub, college: genCollege(R), age: R.u() < 0.35 ? 21 : R.u() < 0.8 ? 22 : 23, ht: null, wt: null, a: pack(pos, a), ovr: ovrOf(pos, a, sub), dev: 0, real: 0, photo: null, skin: null, num: null })
  })
  for (const p of list) {
    p.dev = devRoll(R, p.ovr)
    // what the league thinks he is: the truth through a haze (bigger for the lesser-known)
    p.cons = clamp(Math.round(p.ovr + R.n() * (p.ovr >= 76 ? 2 : 2.8) + (p.pos === 'qb' ? 1.5 : p.pos === 'k' ? -6 : p.pos === 'rb' ? -0.8 : 0)), 58, 90)
    p.sc = 0
    p.cmb = combine(R, p.pos, unpack(p.pos, p.a))
  }
  const sd = F.teams[F.team].staff.scout
  F.draft = { year, pts: F.draft?.keep ?? 0, prospects: list, order: null, at: 0, picks: [], started: false, done: false }
  if (sd?.spec) applyScoutSpec(F, sd.spec)
}
// the scouting director's specialty: his positions start out better known
export function applyScoutSpec(F, spec) {
  const pos = { skill: ['qb', 'rb', 'wr', 'te'], trenches: ['ol', 'dl'], back: ['lb', 'db'] }[spec]
  for (const p of F.draft.prospects) {
    if (pos ? pos.includes(p.pos) : spec === 'sleepers' ? p.cons < 72 : spec === 'top' ? p.cons >= 76 : false) p.sc = Math.max(p.sc, 1)
  }
}
export const scoutPerWeek = F => 3 + (F.gm.tree?.scouting ?? 0) + (F.teams[F.team].staff.scout?.pts ?? 0)
export function scoutingWeek(F) { if (F.draft && !F.draft.done) F.draft.pts = Math.min(40, (F.draft.pts ?? 0) + scoutPerWeek(F)) }
// the combine: everyone is a notch better known, and the numbers are in
export function runCombine(F) {
  if (!F.draft || F.draft.combine) return
  for (const p of F.draft.prospects) { p.c0 = p.sc; p.sc = Math.min(3, p.sc + 1) }
  F.draft.combine = true
}

// ── What the user sees of a prospect ─────────────────────────────────────────
const HALF = [7, 5, 3, 1]
function rangeOf(F, p, sc = p.sc) {
  const w = HALF[sc], off = (roll(`${F.seed}-${F.draft.year}-scout-${p.id}`) * 2 - 1) * w * 0.75
  // unscouted, the middle of the range is the league's consensus, not the truth
  const mid = sc === 0 ? p.cons : p.ovr + off
  const lo = clamp(Math.round(Math.min(mid - w, sc === 0 ? mid - w : p.ovr - 0.4)), 55, 99), hi = clamp(Math.round(Math.max(mid + w, sc === 0 ? mid + w : p.ovr + 0.4)), 55, 99)
  return { lo, hi, loGrade: ovrGrade(lo), hiGrade: ovrGrade(hi), text: ovrGrade(lo) === ovrGrade(hi) ? ovrGrade(lo) : `${ovrGrade(lo)} to ${ovrGrade(hi)}` }
}
const projOf = rank => (rank <= 32 ? 'Round 1' : rank <= 64 ? 'Round 2' : rank <= 100 ? 'Round 3' : rank <= 160 ? 'Rounds 4-5' : rank <= 224 ? 'Rounds 6-7' : 'Undrafted')
function prospectRow(F, p, rank) {
  const a = unpack(p.pos, p.a), slot = slotOf(p)
  const tw = 3 - p.sc
  return {
    id: p.id, name: p.name, pos: p.pos, slot, college: p.college, age: p.age, ht: p.ht, wt: p.wt,
    combine: F.draft.combine || F.teams[F.team].staff.scout?.spec === 'combine' ? { forty: p.cmb[0], bench: p.cmb[1], cone: p.cmb[2], vert: p.cmb[3] } : null,
    range: rangeOf(F, p), scouted: p.sc, rank, proj: projOf(rank),
    traits: p.sc >= 2 ? TYPES_OF[p.pos].map(t => { const j = Math.round((roll(`${F.seed}-tr-${p.id}-${t}`) * 2 - 1) * tw); return { key: t, ...traitLabel(p.pos, t), lo: clamp(a[t] + Math.min(0, j) - (tw > 0 ? 1 : 0), 0, 11), hi: clamp(a[t] + Math.max(0, j) + (tw > 0 ? 1 : 0), 0, 11), loGrade: gradeOf(clamp(a[t] + Math.min(0, j) - (tw > 0 ? 1 : 0), 0, 11)), hiGrade: gradeOf(clamp(a[t] + Math.max(0, j) + (tw > 0 ? 1 : 0), 0, 11)) } }) : null,
    real: !!p.real, photo: p.photo ?? null, gone: !!p.gone, initials: p.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(),
  }
}
// the league's consensus order (what a mock draft would be)
function consensus(F) {
  const posK = p => (p.pos === 'k' ? -12 : 0)
  return [...F.draft.prospects].sort((a, b) => (b.cons + posK(b)) - (a.cons + posK(a)) || a.id - b.id)
}
export function draftBoard(F, { all = false } = {}) {
  if (!F.draft) return { year: F.year + 1, label: 'THE DRAFT CLASS', pts: 0, prospects: [], needs: [] }
  const order = consensus(F), rankOf = new Map(order.map((p, i) => [p.id, i + 1]))
  return { year: F.draft.year, label: 'THE DRAFT CLASS', pts: F.draft.pts ?? 0, combine: !!F.draft.combine,
    prospects: order.filter(p => all || !p.gone).map(p => prospectRow(F, p, rankOf.get(p.id))), needs: needsOf(F, F.team).slice(0, 6) }
}
// What the combine changed: each prospect's range before it and now, and who moved most (the middle of his
// range, up or down). Empty until the combine has been run (when the draft stage opens).
export function combineReport(F) {
  const D = F.draft
  if (!D?.combine) return { done: false, risers: [], fallers: [] }
  const order = consensus(F), rankOf = new Map(order.map((p, i) => [p.id, i + 1]))
  const mid = r => (r.lo + r.hi) / 2
  const rows = order.filter(p => !p.gone).slice(0, 180).map(p => { const before = rangeOf(F, p, p.c0 ?? Math.max(0, p.sc - 1)), after = rangeOf(F, p); return { p, before, after, d: mid(after) - mid(before) } })
  const row = x => ({ ...prospectRow(F, x.p, rankOf.get(x.p.id)), before: x.before, after: x.after, move: Math.round(x.d * 10) / 10 })
  return { done: true, risers: rows.filter(x => x.d >= 1.5).sort((a, b) => b.d - a.d || a.p.id - b.p.id).slice(0, 8).map(row), fallers: rows.filter(x => x.d <= -1.5).sort((a, b) => a.d - b.d || a.p.id - b.p.id).slice(0, 8).map(row) }
}
export function scoutProspect(F, id, points = 1) {
  const p = F.draft?.prospects.find(x => x.id === id)
  if (!p || p.gone) return fail(F, 'prospect', 'He is not on the board.')
  const n = Math.min(points, 3 - p.sc)
  if (n <= 0) return fail(F, 'scouted', `${p.name} is fully scouted.`)
  if ((F.draft.pts ?? 0) < n) return fail(F, 'points', 'No scouting points left this week.')
  F.draft.pts -= n; p.sc += n
  return touch(F)
}

// the staff's scouting: the points go to the best prospects the league has at what the team needs, then the best left
export function autoScout(F) {
  const D = F.draft
  if (!D || D.done || !(D.pts > 0)) return 0
  const needs = new Set(needsOf(F, F.team).slice(0, 4).map(n => n.group))
  const order = consensus(F).filter(p => !p.gone && p.sc < 3).slice(0, 120)
  const list = [...order.filter(p => needs.has(p.pos === 'ol' ? 'OL' : slotOf(p))).slice(0, 12), ...order]
  let n = 0
  for (const p of list) { if (D.pts <= 0) break; if (p.sc < 3) { p.sc++; D.pts--; n++ } }
  return n
}

// ── Needs ────────────────────────────────────────────────────────────────────
// how much a team needs each roster group, 0-1 (the starter's quality and how deep it is behind him)
export function needsOf(F, short) {
  const t = F.teams[short], L = lineupOf(F, t), c = groupCounts(F, t), out = []
  const starter = g => (g === 'OL' ? L.OL.map(o => o.p?.ovr ?? 60).sort((a, b) => a - b)[1] : (L[g]?.[g === 'WR' ? 2 : g === 'EDGE' || g === 'DT' || g === 'CB' || g === 'S' ? 1 : g === 'LB' ? 2 : 0]?.ovr ?? 58))
  for (const g in TARGET_AT) {
    const s = starter(g), age = g === 'OL' ? 0 : Math.max(0, ...(L[g] ?? []).slice(0, 1).map(p => p.age))
    const need = clamp((80 - s) / 14, 0, 1) * 0.75 + clamp((TARGET_AT[g] - c[g]) / 2, 0, 1) * 0.3 + (age >= 31 && g !== 'QB' && g !== 'K' ? 0.15 : age >= 36 ? 0.2 : 0)
    out.push({ group: g, need: Math.round(clamp(g === 'K' ? need * 0.4 : need, 0, 1) * 100) / 100, starter: s })
  }
  return out.sort((a, b) => b.need - a.need)
}

// ── The draft itself ─────────────────────────────────────────────────────────
// the order: the teams that missed the playoffs worst record first, then the playoff teams by how far they went
export function draftOrder(F) {
  const S = standing(F), po = F.playoffs, R = S.R
  const wp = s => (R[s].w + R[s].t / 2) / Math.max(1, R[s].w + R[s].l + R[s].t)
  const stage = s => (!po ? 0 : po.champion === s ? 5 : po.out?.[s] === 'sb' ? 4 : po.out?.[s] === 'conf' ? 3 : po.out?.[s] === 'div' ? 2 : po.out?.[s] === 'wc' ? 1 : 0)
  return [...TEAM_SHORTS].sort((a, b) => stage(a) - stage(b) || wp(a) - wp(b) || (R[a].pf - R[a].pa) - (R[b].pf - R[b].pa) || (a < b ? -1 : 1))
}
export function startDraft(F) {
  const D = F.draft
  if (D.started) return
  runCombine(F)
  const base = draftOrder(F), owner = {}
  for (const s of TEAM_SHORTS) for (const pk of F.teams[s].picks) if (pk.y === D.year) owner[`${pk.r}-${pk.o}`] = s
  D.order = []
  for (let r = 1; r <= 7; r++) base.forEach((o, i) => {
    const t = owner[`${r}-${o}`]
    if (t) D.order.push({ r, o, t })
    const pk = t && F.teams[t].picks.find(x => x.y === D.year && x.r === r && x.o === o)
    if (pk) pk.slot = i + 1
  })
  D.at = 0; D.started = true; D.picks = []
  addNews(F, 'draft', `The draft is here: ${nick(D.order[0].t)} are on the clock`)
}
// a CPU team's board: the real grade through its own scouts' eyes, need, and what the position is worth
function cpuChoice(F, short, R) {
  const needs = Object.fromEntries(needsOf(F, short).map(n => [n.group, n.need])), at = F.draft.at
  const seedN = hashStr(`${F.seed}-${F.draft.year}`), teamN = TEAM_SHORTS.indexOf(short) + 1
  // the quarterback room: a team with no answer wants one; a team whose starter is ordinary or old takes one who
  // grades with him; a team with a good one, or a young one it has just invested in, passes
  const qbs = F.teams[short].roster.map(id => F.players[id]).filter(p => p && p.pos === 'qb').sort((a, b) => b.ovr - a.ovr)
  const qb1 = qbs[0] ?? null, kid = qbs.some(p => p.age <= 24 && (p.ovr >= 76 || (p.rk && p.draft && p.draft[1] <= 2)))
  let best = null, bs = -1e9
  for (const p of F.draft.prospects) {
    if (p.gone) continue
    const g = p.pos === 'ol' ? 'OL' : slotOf(p)
    const noise = (mix(seedN, teamN * 7919 + p.id) * 2 - 1) * 3.2
    let s = p.ovr * 0.62 + p.cons * 0.38 + noise + (needs[g] ?? 0) * 4.5 + p.dev * 0.8
    if (p.pos === 'qb') s += kid ? -3 : (needs.QB ?? 0) >= 0.5 ? 3 : !qb1 || p.cons >= qb1.ovr - 1 || (qb1.age >= 35 && p.cons >= 78) ? 0 : -3
    if (p.pos === 'k') s -= at < 150 ? 12 : 2
    if (p.pos === 'rb' && at < 20) s -= 1.5
    if (s > bs) { bs = s; best = p }
  }
  return best
}
function make(F, pr, short, n) {
  const D = F.draft, spot = D.order[n], R = rngOf(`${F.seed}-${D.year}-pick-${pr.id}`)
  const a = unpack(pr.pos, pr.a)
  const p = genPlayer(R, { pos: pr.pos, sub: pr.sub, a, age: pr.age, exp: 0, team: short, name: pr.name, dev: pr.dev, devKnown: false, college: pr.college, draft: [D.year, spot.r, n + 1, short] })
  if (pr.real) { p.gen = false; p.photo = pr.photo; p.skin = pr.skin ?? p.skin; p.ht = pr.ht ?? p.ht; p.wt = pr.wt ?? p.wt; p.num = pr.num ?? p.num; p.college2 = undefined }
  if (pr.ht) { p.ht = pr.ht; p.wt = pr.wt }
  p.rk = 1                       // a rookie until his first season is in the books
  addPlayer(F, p)
  p.con = rookieDeal(n + 1, F.cap)
  p.drives = drivesFor(R, p)
  p.mood = 66
  joinTeam(F, p, short)
  const t = F.teams[short]
  t.picks = t.picks.filter(x => !(x.y === D.year && x.r === spot.r && x.o === spot.o))
  pr.gone = 1
  D.picks.push({ n: n + 1, r: spot.r, t: short, pid: p.id, name: p.name, pos: slotOf(p), college: p.college, rk: boardRank(F, pr) })
  addTx(F, 'draft', short, `${teamName(short)} drafted ${slotOf(p)} ${p.name} (${p.college ?? 'college'}) in Round ${spot.r}, pick ${n + 1} overall.`, p.id)
  if (n < 10 || short === F.team) addNews(F, 'draft', n === 0 ? `${p.name} goes first overall to the ${nick(short)}` : `${nick(short)} take ${p.name} at No. ${n + 1}`, { team: short, pid: p.id })
  D.at = n + 1
  if (D.at >= D.order.length) { D.done = true; F.offers = [] }
  return p
}
// where the league's consensus had him (1 = the top of the whole class, taken or not)
function boardRank(F, pr) {
  const D = F.draft, k = p => p.cons + (p.pos === 'k' ? -12 : 0), v = k(pr)
  let n = 1
  for (const p of D.prospects) if (p !== pr && (k(p) > v || (k(p) === v && p.id < pr.id))) n++
  return n
}
// a pick against the board: how far before or after his rank he went, in grades (what a draft-night grade is)
const GRADE_PTS = { 'A+': 4.3, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, D: 1 }
const pickSlide = (overall, rank) => (overall - rank) / Math.max(8, overall * 0.3)
export function pickGrade(overall, rank) {
  if (!rank) return null
  const d = pickSlide(overall, rank)
  return d >= 1.2 ? 'A+' : d >= 0.5 ? 'A' : d >= 0.15 ? 'A-' : d >= -0.15 ? 'B+' : d >= -0.4 ? 'B' : d >= -0.7 ? 'B-' : d >= -1.1 ? 'C+' : d >= -1.6 ? 'C' : d >= -2.4 ? 'C-' : 'D'
}
function classGrade(rows) {
  const g = rows.filter(x => x.grade)
  if (!g.length) return null
  // (the early picks count for most of a class)
  let w = 0, sum = 0
  for (const x of g) { const k = pickPoints(x.overall) + 40; w += k; sum += GRADE_PTS[x.grade] * k }
  const avg = sum / w, grade = Object.entries(GRADE_PTS).sort((a, b) => Math.abs(a[1] - avg) - Math.abs(b[1] - avg))[0][0]
  const steal = [...g].sort((a, b) => pickSlide(b.overall, b.rank) - pickSlide(a.overall, a.rank))[0]
  const text = avg >= 3.7 ? 'The league thinks this class was a haul.' : avg >= 3.2 ? 'A solid class by the board.' : avg >= 2.6 ? 'About what the board said, with a reach or two.' : 'The league thinks this class reached.'
  return { grade, text, best: steal && steal.overall - steal.rank >= 6 ? { pid: steal.pid, name: steal.name, text: `${steal.name} was No. ${steal.rank} on the board and went at No. ${steal.overall}.` } : null }
}
const pickRows = (F, short, keys) => (keys ?? []).map(k => F.teams[short]?.picks.find(pk => pickKey(pk) === k)).filter(Boolean).map(pk => ({ key: pickKey(pk), year: pk.y, round: pk.r, orig: pk.o, overall: pickOverall(F, pk), when: pickWhen(F, pk), text: pickText(F, pk, short) }))
const onClock = F => (F.draft?.started && !F.draft.done ? F.draft.order[F.draft.at] : null)
// a rebuilding team near the top trades down now and then: a team behind it that is ready to win pays to move up
function cpuTradeDown(F) {
  const D = F.draft, spot = onClock(F)
  if (!spot || spot.r > 2 || F.teams[spot.t].state !== 'rebuild') return
  if (mix(hashStr(`${F.seed}-${D.year}-down`), D.at) > 0.16) return
  const mine = F.teams[spot.t].picks.find(x => x.y === D.year && x.r === spot.r && x.o === spot.o)
  if (!mine) return
  for (let n = D.at + 3; n < Math.min(D.order.length, D.at + 14); n++) {
    const s = D.order[n]
    if (s.t === F.team || s.t === spot.t || F.teams[s.t].state === 'rebuild') continue
    const T = F.teams[s.t], theirs = T.picks.find(x => x.y === D.year && x.r === s.r && x.o === s.o)
    if (!theirs) continue
    const need = pickValue(F, mine) * 1.04 - pickValue(F, theirs)
    const extra = T.picks.filter(x => x !== theirs).map(x => ({ x, v: pickValue(F, x) })).filter(x => x.v >= need * 0.9 && x.v <= need * 1.45).sort((a, b) => a.v - b.v)[0]
    if (!extra) continue
    execute(F, { from: s.t, to: spot.t, give: { players: [], picks: [pickKey(theirs), pickKey(extra.x)] }, get: { players: [], picks: [pickKey(mine)] } })
    addNews(F, 'draft', `${nick(s.t)} trade up to No. ${D.at + 1}; ${nick(spot.t)} move down and add a pick`, { team: s.t })
    reorder(F)
    return
  }
}
function cpuPick(F) {
  cpuTradeDown(F)
  const spot = onClock(F)
  const pr = cpuChoice(F, spot.t, null)
  if (pr) make(F, pr, spot.t, F.draft.at); else { F.draft.done = true }
}
// offers to move up to the user's pick: a team that likes a man still on the board gives its later pick and more
function draftOffers(F) {
  const D = F.draft, spot = onClock(F)
  F.offers = (F.offers ?? []).filter(o => !o.draft)
  if (!spot || spot.t !== F.team || D.at > 150) return
  const R = rngOf(`${F.seed}-${D.year}-offers-${D.at}`)
  if (!R.chance(D.at < 32 ? 0.55 : 0.3)) return
  const mine = F.teams[F.team].picks.find(x => x.y === D.year && x.r === spot.r && x.o === spot.o)
  if (!mine) return
  const mineV = pickValue(F, mine)
  for (let n = D.at + 2; n < Math.min(D.order.length, D.at + 18) && (F.offers ?? []).filter(o => o.draft).length < 2; n++) {
    const s = D.order[n]
    if (s.t === F.team || !R.chance(0.3)) continue
    const T = F.teams[s.t], theirs = T.picks.find(x => x.y === D.year && x.r === s.r && x.o === s.o)
    if (!theirs) continue
    const need = mineV * (1.02 + R.u() * 0.14) - pickValue(F, theirs)
    const extra = T.picks.filter(x => x !== theirs).map(x => ({ x, v: pickValue(F, x) })).filter(x => x.v >= need * 0.85 && x.v <= need * 1.5).sort((a, b) => a.v - b.v)[0]
    if (!extra) continue
    ;(F.offers ??= []).push({ id: (F.offerId = (F.offerId ?? 0) + 1), draft: true, from: s.t, to: F.team, give: { players: [], picks: [pickKey(theirs), pickKey(extra.x)] }, get: { players: [], picks: [pickKey(mine)] }, week: 0 })
  }
}
// after a pick trade the order's owners are read again from who holds each pick
export function reorder(F) {
  const D = F.draft
  if (!D?.started) return
  const owner = {}
  for (const s of TEAM_SHORTS) for (const pk of F.teams[s].picks) if (pk.y === D.year) owner[`${pk.r}-${pk.o}`] = s
  for (let i = D.at; i < D.order.length; i++) { const t = owner[`${D.order[i].r}-${D.order[i].o}`]; if (t) D.order[i].t = t }
}
function runToUser(F) {
  let guard = 0
  while (onClock(F) && onClock(F).t !== F.team && guard++ < 300) cpuPick(F)
  draftOffers(F)
}
export function simToMyPick(F) {
  if (!F.draft?.started) return fail(F, 'draft', 'The draft has not started.')
  reorder(F)
  runToUser(F)
  return touch(F)
}
export function draftPick(F, id) {
  const spot = onClock(F)
  if (!spot) return fail(F, 'draft', 'The draft is not on.')
  reorder(F)
  if (onClock(F).t !== F.team) return fail(F, 'clock', `${teamName(onClock(F).t)} are on the clock.`)
  const pr = F.draft.prospects.find(x => x.id === id)
  if (!pr || pr.gone) return fail(F, 'prospect', 'He is off the board.')
  const p = make(F, pr, F.team, F.draft.at)
  F.offers = (F.offers ?? []).filter(o => !o.draft)
  runToUser(F)
  return touch(F, { ok: true, msg: `${p.name} is a ${nick(F.team).replace(/s$/, '')}.`, pid: p.id })
}
// the staff's pick for the user: the best man on its own board (what it knows of him), tilted by need
export function staffChoice(F) {
  const needs = Object.fromEntries(needsOf(F, F.team).map(n => [n.group, n.need]))
  let best = null, bs = -1e9
  for (const p of F.draft.prospects) {
    if (p.gone) continue
    const r = rangeOf(F, p), g = p.pos === 'ol' ? 'OL' : slotOf(p)
    let s = (r.lo + r.hi) / 2 + (needs[g] ?? 0) * 4.5
    if (p.pos === 'qb') s += (needs.QB ?? 0) >= 0.5 ? 3 : -3
    if (p.pos === 'k') s -= F.draft.at < 150 ? 12 : 2
    if (s > bs) { bs = s; best = p }
  }
  return best
}
export function autoDraft(F) {
  if (!F.draft?.started) return fail(F, 'draft', 'The draft has not started.')
  reorder(F)
  let guard = 0
  while (onClock(F) && guard++ < 300) {
    if (onClock(F).t === F.team) { const pr = staffChoice(F); if (!pr) break; make(F, pr, F.team, F.draft.at) } else cpuPick(F)
  }
  F.offers = (F.offers ?? []).filter(o => !o.draft)
  return touch(F)
}
export function draftView(F) {
  const D = F.draft
  if (!D) return null
  const spot = onClock(F), board = draftBoard(F)
  const cls = D.picks.filter(x => x.t === F.team).map(x => { const pl = F.players[x.pid]; return { overall: x.n, round: x.r, pick: x.n - (x.r - 1) * 32, name: x.name, pos: x.pos, college: x.college, pid: x.pid, rank: x.rk ?? null, grade: pickGrade(x.n, x.rk), ovr: pl?.ovr ?? null, ovrGrade: pl ? ovrGrade(pl.ovr) : null,
    text: x.rk ? (x.rk < x.n - 5 ? `No. ${x.rk} on the board, still there at No. ${x.n}` : x.rk > x.n + 5 ? `No. ${x.rk} on the board, taken at No. ${x.n}` : `Taken about where the board had him (No. ${x.rk})`) : '' } })
  const order = (D.order ?? []).map((s, i) => { const done = D.picks[i]; return { overall: i + 1, round: s.r, team: teamRef(s.t), done: done ? { name: done.name, pos: done.pos, college: done.college, pid: done.pid } : null, mine: s.t === F.team } })
  return {
    started: !!D.started, done: !!D.done, year: D.year, round: spot?.r ?? 7, pick: spot ? D.at + 1 - (spot.r - 1) * 32 : 0, overall: D.at + 1, onClock: spot ? teamRef(spot.t) : null, mine: !!spot && spot.t === F.team,
    myPicks: (D.order ?? []).map((s, i) => ({ round: s.r, overall: i + 1, used: i < D.at, t: s.t })).filter(x => x.t === F.team).map(({ t, ...x }) => x),
    order, ticker: [...D.picks].reverse().slice(0, 40).map(x => ({ overall: x.n, round: x.r, team: teamRef(x.t), name: x.name, pos: x.pos, college: x.college, pid: x.pid, mine: x.t === F.team, rank: x.rk ?? null, grade: pickGrade(x.n, x.rk) })),
    offers: (F.offers ?? []).filter(o => o.draft).map(o => ({ ...o, text: offerText(F, o), fromTeam: teamRef(o.from), picks: { give: pickRows(F, o.from, o.give?.picks), get: pickRows(F, o.to, o.get?.picks) } })),
    board, staffPick: spot && spot.t === F.team ? staffChoice(F)?.id ?? null : null,
    class: cls, classGrade: classGrade(cls),
  }
}

// ── Undrafted free agents ────────────────────────────────────────────────────
export function udfaList(F) { return consensus(F).filter(p => !p.gone).slice(0, 48) }
export function signUdfaTo(F, pr, short) {
  const R = rngOf(`${F.seed}-${F.draft.year}-udfa-${pr.id}`)
  const p = genPlayer(R, { pos: pr.pos, sub: pr.sub, a: unpack(pr.pos, pr.a), age: pr.age, exp: 0, team: short, name: pr.name, dev: pr.dev, devKnown: false, college: pr.college })
  if (pr.real) { p.gen = false; p.photo = pr.photo; p.skin = pr.skin ?? p.skin; p.num = pr.num ?? p.num }
  if (pr.ht) { p.ht = pr.ht; p.wt = pr.wt }
  p.rk = 1
  addPlayer(F, p)
  p.con = { yrs: 3, sal: MIN_SALARY, guar: 0, rookie: 1, rd: null, opt: 0, tag: false }
  p.drives = drivesFor(R, p); p.mood = 62
  joinTeam(F, p, short)
  pr.gone = 1
  addTx(F, 'sign', short, `${teamName(short)} signed undrafted ${slotOf(p)} ${p.name} (${p.college ?? 'college'}).`, p.id)
  return p
}
// the CPU's teams fill out their camp rosters with the best undrafted men at what they are short of
export function cpuUdfa(F) {
  const R = rngOf(`${F.seed}-${F.draft.year}-cpu-udfa`)
  for (const s of R.shuffle(TEAM_SHORTS)) {
    if (s === F.team) continue
    const t = F.teams[s]
    for (let k = 0; k < 2 && activeCount(F, t) < CAMP_MAX - 2; k++) {
      const needs = needsOf(F, s).slice(0, 4).map(n => n.group)
      const pr = udfaList(F).find(p => needs.includes(groupOf(p)))
      if (!pr) break
      signUdfaTo(F, pr, s)
    }
  }
}
export { prospectRow, rangeOf, onClock, capSpace, reOvr, pickPoints, judge, execute, ok, OL_SPOTS }
