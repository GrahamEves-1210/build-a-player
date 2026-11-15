// FRANCHISE: the offseason, four quick stops, then a new season.
//   1 AWARDS   the league's awards, the player's season on the dynasty wall; then the league ages a year
//              (young men grow toward what they're headed for, veterans slip, some retire)
//   2 RE-SIGN  the player's men whose deals are up, one at a time: keep (at his new salary) or let go
//   3 FREE AGENCY  three rounds of three men who want to come (better ones the higher the hype)
//   4 THE DRAFT    a generated class; the scouting game during the season; three rounds, worst record first
// The draft class is made when the season starts so it can be scouted while it's played.
import { TEAM, SHORTS, POS, OFFENSE, MIN, POS_LABEL, lineup, strength, worth, yearsFor, payroll, trim, fillUp, makeGen, fakeName, gradeIdx, GRADES, gradeFloor, FIRST_YEAR } from './league'
import { makeSchedule, DIVISIONS } from './schedule'
import { standings, finishOf } from './standings'
import { rngOf, clamp, r1 } from './rng'
import { fbCase, honorsOf } from '../teamSeason'
import { ovrOf, TYPES_OF } from '../squadSeason'
import { CFB_TEAMS } from '../../data/cfb-teams'

// ── 1. Awards and the season on the wall ─────────────────────────────────────
const statOf = (F, p) => F.ss?.[p.i] ?? {}
export function seasonAwards(F) {
  const S = standings(F), R = rngOf(`${F.seed}-${F.year}-awards`)
  const wins = s => S.R[s].w
  const all = SHORTS.flatMap(s => Object.values(lineup(F.teams[s])).map(p => ({ p, s })))
  // the player's men are voted on what they did (their season's numbers); the league's on how good they are and won
  const caseOf = ({ p, s }) => {
    let v = p.o + wins(s) * 0.9 + R.n() * 2
    if (s === F.team) { const c = fbCase({ pos: p.p, sub: p.s }, statOf(F, p), wins(s)); v += clamp(-6, 8, (c.v / c.ap - 0.85) * 14) }
    return v
  }
  const best = (list, extra = () => 0) => list.map(x => ({ ...x, v: caseOf(x) + extra(x) })).sort((a, b) => b.v - a.v)[0]
  const pick = x => x && { i: x.p.i, n: x.p.n, t: x.s, p: x.p.p, b: x.p.b ?? null }
  const mvp = best(all.filter(x => wins(x.s) >= 10), x => (x.p.p === 'qb' ? 9 : x.p.p === 'rb' || x.p.p === 'wr' ? 0 : -8))
  const opoy = best(all.filter(x => OFFENSE.includes(x.p.p) && x.p.p !== 'qb' && x.p.p !== 'ol' && x.p.i !== mvp?.p.i))
  const dpoy = best(all.filter(x => !OFFENSE.includes(x.p.p)), x => (x.p.p === 'dl' ? 2 : 0))
  const roy = best(all.filter(x => x.p.rk === F.year))
  // the player's team: honors from the season it had (the Pro Bowl, All-Pro)
  const mine = Object.values(lineup(F.teams[F.team]))
  const roster = mine.map(p => ({ k: String(p.i), pos: p.p, sub: p.s }))
  const tot = Object.fromEntries(mine.map(p => [String(p.i), statOf(F, p)]))
  const hon = honorsOf('nfl', roster, tot, { wins: wins(F.team) })
  return { y: F.year, mvp: pick(mvp), opoy: pick(opoy), dpoy: pick(dpoy), roy: pick(roy), hon }
}
// the season, kept: the wall's banner, the builds' careers
export function closeSeason(F) {
  const S = standings(F), r = S.R[F.team]
  const aw = seasonAwards(F)
  F.aw = aw
  const fin = finishOf(F, F.team)
  const seed = [...F.po.seeds.AFC, ...F.po.seeds.NFC].includes(F.team) ? (F.po.seeds.AFC.indexOf(F.team) + 1 || F.po.seeds.NFC.indexOf(F.team) + 1) : null
  const t = F.teams[F.team]
  const banner = { y: F.year, w: r.w, l: r.l, t: r.t, pf: r.pf, pa: r.pa, fin, seed, ovr: strength(F, F.team).ovr, champ: F.po.champ, mvp: aw.mvp && { n: aw.mvp.n, t: aw.mvp.t }, div: S.div[DIVISIONS.find(d => d.teams.includes(F.team)).name][0] === F.team ? 1 : 0, stars: [] }
  for (const [k, who] of Object.entries({ MVP: aw.mvp, OPOY: aw.opoy, DPOY: aw.dpoy, ROY: aw.roy })) if (who?.t === F.team) banner.stars.push({ aw: k, n: who.n, b: who.b })
  // each build's season on his career
  for (const p of t.r) if (p.b != null) {
    const B = F.builds[p.b], st = statOf(F, p)
    const award = Object.entries({ MVP: aw.mvp, OPOY: aw.opoy, DPOY: aw.dpoy, ROY: aw.roy }).find(([, w]) => w?.i === p.i)?.[0] ?? null
    B.car.push({ y: F.year, o: p.o, gp: st.gp ?? 0, st: pickStats(p.p, st), aw: award, hon: aw.hon[String(p.i)] ?? null, ring: F.po.champ === F.team ? 1 : 0 })
  }
  F.hist.push(banner)
  if (F.po.champ === F.team) F.rings = (F.rings ?? 0) + 1
  F.phase = 'off'; F.stage = 'awards'
  return banner
}
const KEEP = { qb: ['py', 'ptd', 'int', 'ry', 'rtd'], rb: ['ry', 'rtd', 'rc', 'ryd', 'rctd'], wr: ['rc', 'ryd', 'rctd'], te: ['rc', 'ryd', 'rctd'], ol: ['sn', 'sa', 'pnk'], dl: ['sck', 'tfl', 'tk'], lb: ['tk', 'sck', 'dint'], db: ['tk', 'dint', 'pbu'] }
const pickStats = (pos, st) => Object.fromEntries(KEEP[pos].filter(k => st[k]).map(k => [k, st[k]]))

// ── The league ages a year ───────────────────────────────────────────────────
const declineAt = pos => (pos === 'qb' ? 33 : pos === 'rb' ? 29 : pos === 'ol' ? 31 : 30)
export function growth(F, p, R, starter = false) {
  let d
  const dev = p.b != null || F.teams[F.team].r.includes(p) ? (F.coach?.style === 'developer' && p.ag <= 25 ? 1 : 0) : 0
  if (p.ag <= 26) d = Math.max(0, (p.pk - p.o) / Math.max(1, 27 - p.ag)) * (0.7 + 0.6 * R.u()) + dev + (starter && p.ag <= 25 ? 0.5 : 0)
  else if (p.ag < declineAt(p.p)) d = R.n() * 1.1 - 0.2
  else d = -(1 + (p.ag - declineAt(p.p)) * 0.8) * (0.6 + 0.8 * R.u())
  return Math.round(d)
}
// A build grows a step at a time: a trait up a grade until his OVR has moved by d (or down, the same way)
export function growBuild(B, d) {
  const types = TYPES_OF[B.pos]
  const start = ovrOf(B.pos, B.build)
  const goal = clamp(40, 99, start + d)
  for (let guard = 0; guard < 40 && ovrOf(B.pos, B.build) !== goal; guard++) {
    const up = goal > ovrOf(B.pos, B.build)
    const ts = types.filter(t => B.build[t] && (up ? B.build[t].val < 11 : B.build[t].val > 1)).sort((a, b) => (up ? B.build[a].val - B.build[b].val : B.build[b].val - B.build[a].val))
    if (!ts.length) break
    const t = ts[0]
    const before = ovrOf(B.pos, B.build)
    B.build = { ...B.build, [t]: { ...B.build[t], val: B.build[t].val + (up ? 1 : -1) } }
    const after = ovrOf(B.pos, B.build)
    if (up ? after > goal + 1 : after < goal - 1) { B.build = { ...B.build, [t]: { ...B.build[t], val: B.build[t].val + (up ? -1 : 1) } }; break }
    void before
  }
  B.ups = (B.ups ?? 0) + (ovrOf(B.pos, B.build) - start)
  return ovrOf(B.pos, B.build) - start
}
const retireChance = p => (p.ag >= 40 ? 1 : p.ag < 30 ? 0 : clamp(0, 1, (p.ag - (p.p === 'qb' ? 36 : declineAt(p.p) + 3)) * 0.2 + (78 - p.o) * 0.03))
export function ageLeague(F) {
  const R = rngOf(`${F.seed}-${F.year}-age`)
  const changes = []
  const starters = new Set(SHORTS.flatMap(s => Object.values(lineup(F.teams[s])).map(p => p.i)))
  for (const s of SHORTS) {
    const t = F.teams[s]
    const keep = []
    for (const p of t.r) {
      p.ag++
      delete p.in
      const was = p.o
      const d = growth(F, p, R, starters.has(p.i))
      if (p.b != null) { p.o = was + growBuild(F.builds[p.b], d); F.builds[p.b].age = p.ag }
      else p.o = clamp(40, 99, p.o + d)
      if (p.o > p.pk) p.pk = p.o
      const out = R.u() < retireChance(p) * (p.b != null ? 0.6 : 1)
      if (out) {
        if (p.b != null) retireBuild(F, p)
        if (s === F.team) changes.push({ k: 'ret', pid: p.i, n: p.n, p: p.p, b: p.b ?? null })
        continue
      }
      p.y = Math.max(0, p.y - 1)
      if (s === F.team && p.o !== was) changes.push({ k: p.o > was ? 'up' : 'down', pid: p.i, n: p.n, p: p.p, b: p.b ?? null, from: was, to: p.o })
      keep.push(p)
    }
    t.r = keep
  }
  F.aging = changes
  return changes
}
function retireBuild(F, p) {
  const B = F.builds[p.b]
  B.done = F.year
  const seasons = B.car.length
  if (seasons >= 4 || B.car.some(c => c.aw || c.ring)) F.retired.push({ num: B.num, n: p.n, p: p.p, b: p.b, y: F.year, seasons })
}

// ── 2. Re-sign ───────────────────────────────────────────────────────────────
// the deals that are up: the player's men wait for the player's call; the league's teams decide theirs
export function openResign(F) {
  const R = rngOf(`${F.seed}-${F.year}-resign`)
  F.fa = []
  for (const s of SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s]
    t.r = t.r.filter(p => {
      if (p.y > 0) return true
      if (p.ag <= 33 && R.u() < (p.o >= 85 ? 0.97 : p.o >= 78 ? 0.85 : p.o >= 70 ? 0.6 : 0.2)) { p.$ = worth(p); p.y = yearsFor(p); return true }
      F.fa.push(p); return false
    })
  }
  F.rs = F.teams[F.team].r.filter(p => p.y === 0).sort((a, b) => b.o - a.o).map(p => p.i)
  F.stage = 'resign'
}
export const resignAsk = p => ({ $: worth(p), y: yearsFor(p) })
export function resignOne(F, id, keep) {
  const t = F.teams[F.team], p = t.r.find(x => x.i === id)
  F.rs = F.rs.filter(x => x !== id)
  if (!p) return
  if (keep) { const a = resignAsk(p); p.$ = a.$; p.y = a.y }
  else { t.r = t.r.filter(x => x !== p); delete t.lk; t.lk = {}; if (p.b == null) F.fa.push(p); else { F.builds[p.b].done = F.year; F.builds[p.b].left = 1 } }
}
export const budgetLeft = F => r1(F.budget - payroll(F.teams[F.team].r))

// ── 3. Free agency ───────────────────────────────────────────────────────────
// Three rounds; each puts three men in front of the player. Who wants to come is the hype: a hot team gets the
// best of the market, a cold one what's left. (A Recruiter coach counts as fifteen more hype.)
export function openFA(F) {
  const R = rngOf(`${F.seed}-${F.year}-fa`)
  for (let i = 0; i < 14; i++) { const pos = R.pick(POS); F.fa.push(makeGen(F, pos, R, { o: clamp(64, 84, Math.round(73 + R.n() * 4)), ag: R.int(26, 32) })) }
  for (const p of F.fa) { p.$ = worth(p); p.y = yearsFor(p) }
  F.fa.sort((a, b) => b.o - a.o)
  F.far = 0
  F.offers = faOffers(F)
  F.stage = 'fa'
}
export function faOffers(F) {
  const R = rngOf(`${F.seed}-${F.year}-fa-${F.far}`)
  const hype = clamp(0, 100, F.hype + (F.coach?.style === 'recruiter' ? 15 : 0))
  const start = Math.round((100 - hype) / 100 * 22)
  const window = F.fa.slice(start, start + 10)
  const pool = window.length >= 3 ? window : F.fa.slice(0, 10)
  return R.shuffle(pool).slice(0, 3).sort((a, b) => b.o - a.o).map(p => p.i)
}
export function signFA(F, id) {
  const p = F.fa.find(x => x.i === id)
  if (!p || p.$ > budgetLeft(F)) return false
  F.fa = F.fa.filter(x => x !== p)
  F.teams[F.team].r.push(p)
  return true
}
export function nextFA(F) {
  F.far++
  if (F.far >= 3) { cpuFA(F); openDraft(F); return }
  F.offers = faOffers(F)
}
// the league's teams fill their holes from what's left
function cpuFA(F) {
  const R = rngOf(`${F.seed}-${F.year}-cpufa`)
  for (const s of R.shuffle(SHORTS)) {
    if (s === F.team) continue
    const t = F.teams[s]
    for (const pos of POS) {
      while (t.r.filter(p => p.p === pos).length < MIN[pos]) {
        const i = F.fa.findIndex(p => p.p === pos)
        if (i < 0) break
        t.r.push(F.fa.splice(i, 1)[0])
      }
    }
  }
  F.fa = []
}

// ── The draft class ──────────────────────────────────────────────────────────
// ~220 men a year. Each has a true grade (the OVR he's headed for) and the range the scouts give him; a GEM is
// better than his range, a BUST RISK worse. Spending a scout point narrows the range; a second shows the truth.
const CLASS_MIX = { qb: 14, rb: 22, wr: 34, te: 16, ol: 40, dl: 38, lb: 24, db: 32 }
const BODY = { qb: [74, 220, 4.75], rb: [70, 212, 4.48], wr: [72, 195, 4.45], te: [76, 250, 4.7], ol: [77, 312, 5.2], dl: [76, 285, 4.85], lb: [74, 238, 4.6], db: [71, 195, 4.45] }
const NOTES = {
  qb: ['Live arm, needs to speed up his eyes', 'Throws with anticipation', 'Extends plays with his legs', 'Smart, short-area passer', 'Big frame, big arm, raw'],
  rb: ['Hits the hole hard', 'One cut and gone', 'Catches it like a receiver', 'Runs through contact', 'Patient behind his blocks'],
  wr: ['Separates at the top of routes', 'Wins the 50-50 ball', 'Takes the top off a defense', 'Yards after the catch', 'Plays bigger than his size'],
  te: ['Mismatch in the seam', 'Blocks like a sixth lineman', 'Reliable hands in traffic', 'Moves well for his size'],
  ol: ['Plays with a mean streak', 'Quick feet in pass pro', 'Moves people in the run game', 'Long arms, needs strength', 'Smart, steady technician'],
  dl: ['Explosive first step', 'Bends the edge', 'Anchors against the run', 'Violent hands', 'Motor never stops'],
  lb: ['Sideline to sideline', 'Downhill thumper', 'Drops into coverage well', 'Green-dot leader'],
  db: ['Sticky in man coverage', 'Ball hawk', 'Physical in the run game', 'Top-end speed to carry vertical', 'Instinctive in zone'],
}
const SPOT = { dl: ['edge', 'dt'], db: ['cb', 's'], ol: ['LT', 'LG', 'C', 'RG', 'RT'] }
export function makeClass(F) {
  const R = rngOf(`${F.seed}-${F.year}-class`)
  const out = []
  let id = 1
  for (const [pos, n] of Object.entries(CLASS_MIX)) for (let k = 0; k < n; k++) {
    const pk = clamp(56, 97, Math.round(76 + R.n() * 7.5 + (R.u() < 0.06 ? 6 : 0)))
    const ag = R.int(21, 23)
    const o = clamp(48, 82, Math.round(pk - (27 - ag) * (2.0 + R.u() * 0.6)))
    const t = gradeIdx(pk)
    const u = R.u()
    const tag = u < 0.18 ? 'G' : u < 0.36 ? 'B' : 'S'
    const c = clamp(1, GRADES.length - 2, t + (tag === 'G' ? -2 : tag === 'B' ? 2 : R.int(-1, 1)))
    const [h, w, f] = BODY[pos]
    const col = CFB_TEAMS[Math.floor(R.u() * CFB_TEAMS.length)]
    out.push({
      i: id++, n: fakeName(R), p: pos, ...(SPOT[pos] && { s: R.pick(SPOT[pos]) }), ag, o, pk, tag, c, sc: 0,
      ht: h + R.int(-2, 3), wt: w + R.int(-15, 20), ft: Math.round((f + R.n() * 0.08 - (pk - 76) * 0.004) * 100) / 100, nt: R.int(0, NOTES[pos].length - 1), col: col?.short ?? null,
    })
  }
  F.dc = out
}
// what the scouts say: the range (grade indexes) for what's known of him
export function rangeOf(x) {
  if (x.sc >= 2) { const t = gradeIdx(x.pk); return [t, t] }
  if (x.sc === 1) return [x.c, Math.min(GRADES.length - 1, x.c + 1)]
  return [Math.max(0, x.c - 1), Math.min(GRADES.length - 1, x.c + 1)]
}
export const rangeText = x => { const [a, b] = rangeOf(x); return a === b ? GRADES[a] : `${GRADES[a]} – ${GRADES[b]}` }
export const noteOf = x => (x.b != null ? 'Built in the Sandbox' : NOTES[x.p]?.[x.nt] ?? '')
export const tagText = { G: 'GEM', B: 'BUST RISK', S: 'SOLID' }
export function scout(F, id) {
  const x = F.dc.find(p => p.i === id)
  if (!x || x.sc >= 2 || F.sp < 1) return false
  F.sp--; x.sc++
  return true
}
export function star(F, id) { F.board = F.board.includes(id) ? F.board.filter(x => x !== id) : [...F.board, id] }
// Sandbox: a build of the player's into this year's class (its grade known: the player built him)
export function addProspect(F, b) {
  const B = F.builds[b]
  const o = ovrOf(B.pos, B.build)
  const x = { i: Math.max(0, ...F.dc.map(p => p.i)) + 1, n: B.name ?? 'Prospect', p: B.pos, ag: 21, o: Math.min(o, 84), pk: Math.max(o, 80), tag: 'S', c: gradeIdx(o), sc: 2, ht: BODY[B.pos][0], wt: BODY[B.pos][1], ft: BODY[B.pos][2], nt: 0, col: null, b }
  F.dc.push(x)
  F.board = [...F.board, x.i]
  return x
}

// ── 4. The draft ─────────────────────────────────────────────────────────────
// The order: the teams that missed the playoffs, worst first, then the playoff teams by how far they went
// (the Super Bowl's loser 31st, its winner 32nd). Three rounds, the same order each.
export function draftOrder(F) {
  const S = standings(F), pctOf = s => { const r = S.R[s]; return (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t) }
  const depth = s => { const f = finishOf(F, s); return { out: 0, wc: 1, div: 2, conf: 3, sb: 4, champ: 5 }[f] ?? 0 }
  return [...SHORTS].sort((a, b) => depth(a) - depth(b) || pctOf(a) - pctOf(b) || (S.R[a].pf - S.R[a].pa) - (S.R[b].pf - S.R[b].pa))
}
export function openDraft(F) {
  const order = draftOrder(F)
  F.dr = { order, at: 0, picks: [] }
  F.stage = 'draft'
}
export const ROUNDS_N = 3
export const pickTeam = (F, at = F.dr.at) => F.dr.order[at % 32]
export const draftDone = F => F.dr.at >= 32 * ROUNDS_N
// how the league's teams rank a man: his grade as they've seen it, and what they need
function cpuValue(F, s, x, R) {
  const t = F.teams[s]
  const at = t.r.filter(p => p.p === x.p).sort((a, b) => b.o - a.o)
  const need = (at[0]?.o ?? 60) < 76 ? 4 : at.length < MIN[x.p] ? 3 : 0
  const posW = x.p === 'qb' ? 2 : x.p === 'rb' || x.p === 'te' ? -2 : 0
  // (the league's scouts are fooled too, about half as much: a GEM goes later than he should, a BUST RISK earlier)
  const seen = (gradeFloor(x.c) + gradeFloor(Math.min(GRADES.length - 1, x.c + 1))) / 2
  return x.pk * 0.55 + seen * 0.45 + R.n() * 3 + need + posW
}
function take(F, s, x) {
  F.dc = F.dc.filter(p => p !== x)
  const round = Math.floor(F.dr.at / 32) + 1, no = F.dr.at + 1
  const p = { i: F.nid++, n: x.n, p: x.p, ...(x.s && { s: x.s }), o: x.o, ag: x.ag, pk: x.pk, $: r1(round === 1 ? 0.9 + (32 - (no - 1)) * 0.28 : round === 2 ? 1.3 : 1), y: 4, rk: F.year + 1, c: x.col, dr: [round, no], ...(x.b != null && { b: x.b }) }
  if (x.b != null) { F.builds[x.b].pid = p.i; F.builds[x.b].age = x.ag }
  F.teams[s].r.push(p)
  const pick = { at: F.dr.at, s, pid: p.i, n: x.n, p: x.p, tag: x.tag, pk: x.pk, c: x.c, sc: x.sc, col: x.col }
  F.dr.picks.push(pick)
  F.dr.at++
  return pick
}
// the league's teams pick until it's the player's turn (or the draft is over)
export function cpuPicks(F) {
  const made = []
  while (!draftDone(F) && pickTeam(F) !== F.team) {
    const s = pickTeam(F), R = rngOf(`${F.seed}-${F.year}-dr-${F.dr.at}`)
    let best = null, bv = -1e9
    for (const x of F.dc) { if (x.b != null) continue; const v = cpuValue(F, s, x, R); if (v > bv) { bv = v; best = x } }
    // (a Recruiter's board: the best man on it leans toward the player's team, now and then another team passes)
    const top = F.board.map(id => F.dc.find(p => p.i === id)).filter(Boolean)[0]
    if (best && top === best && F.coach?.style === 'recruiter' && R.u() < 0.3) {
      const alt = F.dc.filter(x => x !== best && x.b == null).sort((a, b) => cpuValue(F, s, b, R) - cpuValue(F, s, a, R))[0]
      if (alt) best = alt
    }
    if (!best) break
    made.push(take(F, s, best))
  }
  return made
}
export function userPick(F, id) {
  if (pickTeam(F) !== F.team) return null
  const x = F.dc.find(p => p.i === id)
  return x ? take(F, F.team, x) : null
}
// AUTO: the best on the player's board, or the best grade the scouts show
export function autoPick(F) {
  const board = F.board.map(id => F.dc.find(p => p.i === id)).filter(Boolean)
  const mid = x => (x.sc >= 2 ? gradeIdx(x.pk) + (x.tag === 'B' ? -0.5 : 0) : (rangeOf(x)[0] + rangeOf(x)[1]) / 2 - (x.sc ? 0 : 0.4))
  const x = board[0] ?? [...F.dc].sort((a, b) => mid(b) - mid(a))[0]
  return x ? userPick(F, x.i) : null
}

// ── A new season ─────────────────────────────────────────────────────────────
export function newSeason(F) {
  const R = rngOf(`${F.seed}-${F.year}-newyear`)
  const before = new Set(F.lastStarters ?? [])
  F.dc = []; F.dr = null; F.offers = null; F.rs = null; F.fa = []
  for (const s of SHORTS) {
    const t = F.teams[s]
    const { roster } = trim(t.r)
    t.r = fillUp(F, roster, R)
    for (const p of t.r) { if (p.y <= 0) { p.$ = worth(p); p.y = yearsFor(p) } }
    t.res = (t.res ?? [0, 0]).map(v => r1(v * 0.6))
    if (s !== F.team) t.lk = {}
  }
  // the schedule follows last season's finish in each division
  const S = standings(F)
  F.year++
  F.sched = makeSchedule(F.seed, F.year, S.div)
  F.wk = 0; F.log = []; F.ss = {}; F.po = null; F.moments = 0; F.streak = 0; F.nx = 0; F.ev = null; F.nextEv = 3; F.evSeen = []
  F.phase = 'season'; F.stage = null; F.aging = null
  // chemistry: a core that stays together grows; many new starters set it back. Hype cools toward the middle.
  const now = Object.values(lineup(F.teams[F.team])).map(p => p.i)
  const changed = now.filter(i => !before.has(i)).length
  F.chem = clamp(5, 100, Math.round(F.chem * 0.8 + 18 - changed * 1.6))
  F.hype = clamp(0, 100, Math.round(F.hype * 0.75 + 12.5))
  F.lastStarters = now
  F.budget = r1(F.budget * 1.04)
  F.sp = 3
  F.board = []
  makeClass(F)
}
export { POS_LABEL, FIRST_YEAR }
