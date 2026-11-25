// ALL-STAR SATURDAY (basketball Career, 2026-11-24): the 3-Point Contest and the Slam Dunk Contest at the All-Star
// break. Invitations go by his grades as Career has grown them: Jump Shot A or better for the 3-Point Contest, Finishing
// plus Bounce 18 or more (0-11 each) for the Dunk Contest. Being an All-Star has nothing to do with it: the league asks
// contestants on their own. Everything here is pure and seeded: the field, every rival's round and dunk, the judges.
// His own rounds come in from the screen (lib/mg/threecontest.js, lib/mg/dunkcontest.js, or simulated from his grades
// with Mini Games OFF) and are kept on the season (c.active.asw), so a reload picks the night back up where it was.
// The hooks in lib/career.js: advanceWeek deals the night at the break (allStarBeat) and moves past a night left open
// (allStarSkip, the checks' path; the screen never leaves one open); bookSeason keeps the results (allStarSeason).
// A title is a legacy point (ASW_LEGACY: the owner, 2026-11-24), counted off the booked season (lib/career.js aswLegacy).
import { seeded } from './rng.js'
import { NBA_GUARD_PLAYERS, GUARD_TYPES } from '../data/nba-guards.js'
import { NBA_BIG_PLAYERS, BIG_TYPES } from '../data/nba-bigs.js'
import { calcBucketOVR } from '../utils/bucketSimulation.js'
import { BIRTH_NBA } from '../data/player-ages.js'
import { DUNKS, JUDGE_RANGE } from './mg/dunkcontest.js'
import { aswOpen, ASW_LEGACY } from './allStarBreak.js'
export * from './allStarBreak.js'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const gauss = r => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()) }
const gradeVal = (c, t) => Math.round(c.build?.[t]?.val ?? 0)
const last = n => { const w = String(n ?? '').split(' '); return w.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.slice(-2).join(' ') : w[w.length - 1] }

// A man in a field by his last name; two in one field with the same last name go by first initial too ("A. Thompson")
export function shortNamer(field) {
  const n = new Map()
  for (const s of field ?? []) { const l = last(s.name); n.set(l, (n.get(l) ?? 0) + 1) }
  return name => { const l = last(name); return (n.get(l) ?? 0) > 1 ? `${String(name ?? '').trim()[0]}. ${l}` : l }
}

export const THREE_FIELD = 8, THREE_FINAL = 3
export const DUNK_FIELD = 4, DUNK_FINAL = 2, DUNKS_A_ROUND = 2, DUNK_TRIES = 3
export const RACKS = ['LEFT CORNER', 'LEFT WING', 'TOP OF THE KEY', 'RIGHT WING', 'RIGHT CORNER']
export const RACK_WORD = ['the left corner', 'the left wing', 'the top of the key', 'the right wing', 'the right corner']
export const ROUND_NAME = { r1: 'FIRST ROUND', final: 'FINAL' }

// ── The league's men: one list (a man in both pools once), his age that season, retired men out ──
let POOL = null
const pool = () => {
  if (POOL) return POOL
  const seen = new Map()
  for (const p of [...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS]) if (p.attrs && !seen.has(p.name)) seen.set(p.name, p)
  return (POOL = [...seen.values()])
}
const ageIn = (name, season) => (BIRTH_NBA[name] ? season - BIRTH_NBA[name] : 27)
// his overall, as the league's ratings have it (career.js realOvr: the data's own, or worked out from his grades)
const OVR = new Map()
const ovrOf = p => {
  if (!OVR.has(p.name)) {
    const big = NBA_BIG_PLAYERS.includes(p) && !NBA_GUARD_PLAYERS.some(g => g.name === p.name), types = big ? BIG_TYPES : GUARD_TYPES
    let o = p.ovr
    if (o == null) { try { o = calcBucketOVR(Object.fromEntries(types.map(t => [t, { val: p.attrs?.[t] ?? 5 }])), types, big ? 'big' : 'guard') } catch { o = 80 } }
    OVR.set(p.name, Math.round(o ?? 80))
  }
  return OVR.get(p.name)
}
const teamOf = (c, p) => c.dealt?.[p.name] ?? p.team
const mates = c => new Set([...(c.roster?.guard ?? []), ...(c.roster?.big ?? [])].map(p => p.name))
// a seeded draw without replacement, weighted
function draw(list, n, w, r, ok = () => true) {
  const out = [], left = [...list]
  while (out.length < n && left.length) {
    const can = left.filter(x => ok(x, out))
    if (!can.length) break
    let roll = r() * can.reduce((s, x) => s + w(x), 0), pick = can[can.length - 1]
    for (const x of can) { roll -= w(x); if (roll <= 0) { pick = x; break } }
    out.push(pick); left.splice(left.indexOf(pick), 1)
  }
  return out
}
// (his own teammates: one at most, so the night isn't his locker room)
const oneMate = (c, M) => (x, out) => !M.has(x.name) || !out.some(o => M.has(o.name))
const meRow = (c, extra) => ({ name: c.name, team: c.team, me: true, ...extra })

// The 3-Point Contest's field: the best shooters in the league that season (Jump Shot A and up first), the stars and the
// specialists the way the real one mixes them, shooting order drawn. He's somewhere in it.
export function threeField(c) {
  const r = seeded(`${c.seed}-asw3-field-${c.year}`)
  const M = mates(c), gone = new Set(c.gone ?? [])
  let cands = []
  for (const [js, age] of [[9, 37], [8, 37], [7, 40], [0, 99]]) {
    cands = pool().filter(p => p.attrs.jumpShot >= js && !gone.has(p.name) && p.name !== c.name && ageIn(p.name, c.season) <= age)
    if (cands.length >= 12) break
  }
  const picks = draw(cands, THREE_FIELD - 1, p => (p.attrs.jumpShot - 7.5) ** 2, r, oneMate(c, M))
  const rows = picks.map(p => ({ name: p.name, team: teamOf(c, p), js: p.attrs.jumpShot, me: false }))
  const at = Math.floor(r() * THREE_FIELD)
  rows.splice(at, 0, meRow(c, { js: gradeVal(c, 'jumpShot') }))
  return rows
}
// The Dunk Contest's: the way the real one fills up, young high-flyers, role players and dunk specialists (a Derrick
// Jones Jr., an Obi Toppin, a Matas Buzelis), now and then a star. Bounce first, then Finishing; the younger the more
// likely; the league's top players rarely (an overall in the high 80s or more counts against him, hard). Only men in
// the league that season: never one retired (c.gone) or past his years (under 34), on the team he's on (traded: his
// new one; a man who has left the player's own team isn't on it). Drawn fresh every season.
const DUNK_AGE = [[24, 1.5], [27, 1.1], [30, 0.8], [33, 0.25]]
const DUNK_STAR = [[90, 0.05], [87, 0.15], [84, 0.45], [81, 0.85], [0, 1.15]]
export const dunkWeight = (p, age) => {
  const hops = Math.min(4.5, Math.max(0.35, p.attrs.bounce * 1.5 + p.attrs.finishing - 19))
  const young = DUNK_AGE.find(([a]) => age <= a)?.[1] ?? 0
  const o = ovrOf(p), star = DUNK_STAR.find(([v]) => o >= v)?.[1] ?? 1
  return hops ** 1.3 * young * star
}
export function dunkField(c) {
  const r = seeded(`${c.seed}-aswd-field-${c.year}`)
  const M = mates(c), gone = new Set(c.gone ?? [])
  const mine = c.roster ? c.team : null
  const season = c.season ?? 2026
  const cands = pool().filter(p => {
    const { bounce: b, finishing: f } = p.attrs
    if (!(b >= 8 || (b >= 7 && f >= 8)) || b + f < 13) return false
    if (gone.has(p.name) || p.name === c.name || ageIn(p.name, season) > 33) return false
    // (his own team's man only while he's still on its roster)
    if (mine && teamOf(c, p) === mine && !M.has(p.name)) return false
    return true
  })
  const picks = draw(cands, DUNK_FIELD - 1, p => dunkWeight(p, ageIn(p.name, season)), r, oneMate(c, M))
  const rows = picks.map(p => ({ name: p.name, team: teamOf(c, p), v: (p.attrs.bounce + p.attrs.finishing) / 2, bounce: p.attrs.bounce, fin: p.attrs.finishing, me: false }))
  const at = Math.floor(r() * DUNK_FIELD)
  rows.splice(at, 0, meRow(c, { v: dunkV(c), bounce: gradeVal(c, 'bounce'), fin: gradeVal(c, 'finishing') }))
  return rows
}
// the grade his games play at
export const threeV = c => c.build?.jumpShot?.val ?? 5
export const dunkV = c => ((c.build?.finishing?.val ?? 5) + (c.build?.bounce?.val ?? 5)) / 2

// ── A round of the 3-Point Contest, simulated ──
// Five racks of five (four balls a point, the fifth a two-point money ball; one rack the shooter picks is all money
// balls) and two deep shots worth three, 27 balls, 40 points, 70 seconds. A make is 51% at an A (Jump Shot 9), three
// and a half points more each grade, give or take the night (form); the deep shots are harder. Most rounds come in at 16-26,
// a hot one at 28-31. The order: rack 1, rack 2, the first deep shot, rack 3, the second, racks 4 and 5.
export const ORDER = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], ['d', 0], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], ['d', 1], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]]
export const makeRate = v => 0.51 + (v - 9) * 0.035
export function simThree(v, r, { rack = Math.floor(r() * 5), balls = ORDER, clock = 70 } = {}) {
  const form = gauss(r) * 0.03, pace = 1 + gauss(r) * 0.045
  const p = clamp(makeRate(v) + form, 0.15, 0.8), pd = clamp(p - 0.13, 0.05, 0.7)
  let t = 0, points = 0, made = 0, prevRack = null
  const seq = [], racks = [0, 0, 0, 0, 0], rackPts = [0, 0, 0, 0, 0], deep = []
  for (const [rk, i] of balls) {
    const isDeep = rk === 'd'
    if (rk !== prevRack) { if (prevRack !== null) t += 1.6 * pace; prevRack = rk }
    t += (isDeep ? 2.6 : 2.05) * pace
    if (t > clock) break
    const val = isDeep ? 3 : rk === rack || i === 4 ? 2 : 1
    const hit = r() < (isDeep ? pd : p)
    seq.push(hit)
    if (hit) { points += val; made++; if (isDeep) deep.push(true); else { racks[rk]++; rackPts[rk] += val } } else if (isDeep) deep.push(false)
  }
  return { points, made, of: balls.length, shot: seq.length, racks, rackPts, deep: deep.filter(Boolean).length, seq, rack, timeLeft: Math.max(0, Math.round((clock - t) * 10) / 10) }
}
// the 30-second shoot-off: one rack from the corner, a rack of money balls, a deep shot (19 points at most)
const SHOOTOFF = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], ['d', 0], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]]
const simShootoff = (v, r) => simThree(v, r, { rack: 4, balls: SHOOTOFF, clock: 30 })

// ── The Dunk Contest: a dunk's attempts and the five judges ──
// A rival dunks the way an average thumb plays the engine at his grade (scripts/mg/dunks.mjs, measured 11-25 once the
// dunks were made easier): a try lands 97% (easy), 88% (medium), 71% (hard) at an A (v 9), 97 / 94 / 82% at an S (11),
// 96 / 82 / 60% at 7; landed, it's about as clean as that thumb gets it (QUAL, the mean of its steps' timing, give or
// take 0.11)
export const LAND = { easy: [0.97, 0.005], medium: [0.88, 0.03], hard: [0.71, 0.055] }
export const landRate = (tier, v) => clamp(LAND[tier][0] + (v - 9) * LAND[tier][1], 0.25, 0.97)
const QUAL = { easy: 0.86, medium: 0.81, hard: 0.78 }
// what five judges give a dunk landed on the first try, placed in the range by how clean it was (the dunks' own table,
// lib/mg/dunkcontest.js: the board on the court shows it)
export const RANGE = JUDGE_RANGE
export const tierOf = d => String(d?.tier ?? 'medium').toLowerCase()
export const dunkById = id => DUNKS.find(d => d.id === id) ?? null
// one dunk simulated: up to three tries, stopping at the first one down
export function simDunk(tier, v, r) {
  const tries = []
  for (let i = 0; i < DUNK_TRIES; i++) {
    const landed = r() < landRate(tier, v)
    const q = clamp((QUAL[tier] ?? QUAL.medium) + (v - 9) * 0.01 + gauss(r) * 0.11, 0.05, 1)
    tries.push({ landed, quality: Math.round((landed ? q : q * 0.6) * 100) / 100 })
    if (landed) break
  }
  return tries
}
// The scorecard. Landed on the first try: the tier's range by quality. Each miss before it about a point a judge.
// Nothing down in three: 30-34, off the best try. Five judges, each 6-10, a little apart from each other; a 50 only for a
// hard dunk on the first try at about 0.9 quality or better.
export function judge(tier, tries, r) {
  const at = tries.findIndex(t => t.landed)
  const [lo, hi] = RANGE[tier] ?? RANGE.medium
  const best = Math.max(0, ...tries.map(t => t.quality ?? 0))
  const q = at >= 0 ? tries[at].quality ?? 0.5 : best
  const raw = at >= 0 ? lo + clamp(q, 0, 1) * (hi - lo) - 5 * at : 30 + clamp(best, 0, 1) * 4
  let sum = clamp(Math.round(raw + gauss(r) * 0.6), 30, 50)
  const perfect = tier === 'hard' && at === 0 && q >= 0.88
  if (sum >= 50 && !perfect) sum = 49
  if (perfect && raw >= 49.4) sum = 50
  // spread it over five judges, then a few of them a point apart either way (the total stays)
  const base = Math.floor(sum / 5), extra = sum - base * 5
  const cards = Array.from({ length: 5 }, (_, i) => base + (i < extra ? 1 : 0))
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]] }
  for (let n = 0; n < 2; n++) {
    if (r() < 0.55) {
      const a = Math.floor(r() * 5), b = Math.floor(r() * 5)
      if (a !== b && cards[a] < 10 && cards[b] > 6 && cards[a] + 1 - (cards[b] - 1) <= 2) { cards[a]++; cards[b]-- }
    }
  }
  return { cards: cards.map(x => clamp(x, 6, 10)), total: cards.reduce((s, x) => s + clamp(x, 6, 10), 0), at, landed: at >= 0, perfect: sum === 50 }
}

// ── The night, as it goes: every event in order, up to his next turn ──
// threePlan / dunkPlan read his results so far (asw.three.mine / asw.dunk.mine) and play everyone else around them.
// The screen reveals the events one by one; `need` is his turn, when it's his.
const rankBy = (rows, key) => [...rows].sort((a, b) => b[key] - a[key])
// the top n go through; a tie on the line goes to a shoot-off (sim: one more round for the tied men, as often as it takes)
function cutTies(rows, n, key, tie) {
  const sorted = rankBy(rows, key)
  if (sorted.length <= n) return { through: sorted, tie: null }
  const line = sorted[n - 1][key]
  const above = sorted.filter(x => x[key] > line), at = sorted.filter(x => x[key] === line)
  if (above.length + at.length <= n) return { through: [...above, ...at], tie: null }
  const won = tie(at, n - above.length)
  return { through: [...above, ...won.through], tie: won }
}

export function threePlan(c) {
  const T = c.active?.asw?.three ?? {}, mine = T.mine ?? []
  const field = threeField(c)
  const ev = [], R = tag => seeded(`${c.seed}-asw3-${c.year}-${tag}`)
  let mi = 0, need = null
  const mineV = threeV(c)
  const shoot = (s, round) => (s.me ? mine[mi++] : simThree(s.js, R(`${round}-${s.name}`)))
  const turnFor = (round, board, slots) => {
    const top = rankBy(board, 'pts')
    const toBeat = round === 'final' ? (top[0]?.pts ?? null) : top.length >= slots ? top[slots - 1].pts : null
    need = { round, toBeat, label: ROUND_NAME[round] }
    ev.push({ kind: 'turn', round, toBeat })
  }
  // shoot-offs, simulated for everyone (him from his grade): the tied men again until the spots are settled (five
  // times at most, then the most balls made)
  const shootoff = tag => (tied, spots) => {
    const rounds = [], through = []
    let left = tied
    for (let n = 0; n < 5 && spots > 0; n++) {
      if (left.length <= spots) { through.push(...left); spots = 0; break }
      const res = left.map(s => ({ s, so: simShootoff(s.me ? mineV : s.js, R(`${tag}-so${n}-${s.name}`)) })).sort((x, y) => y.so.points - x.so.points || y.so.made - x.so.made)
      rounds.push(res.map(x => ({ name: x.s.name, me: !!x.s.me, pts: x.so.points, made: x.so.made })))
      const line = res[spots - 1].so.points
      const over = res.filter(x => x.so.points > line).map(x => x.s), at = res.filter(x => x.so.points === line).map(x => x.s)
      through.push(...over); spots -= over.length
      if (at.length <= spots || n === 4) { through.push(...at.slice(0, spots)); spots = 0; break }
      left = at
    }
    return { through, rounds }
  }
  ev.push({ kind: 'round', round: 'r1' })
  const r1 = []
  for (const s of field) {
    if (s.me && !mine[mi]) { turnFor('r1', r1, THREE_FINAL); return { field, ev, need, r1, stage: 'r1' } }
    const res = shoot(s, 'r1')
    r1.push({ ...s, res, pts: res.points })
    ev.push({ kind: 'shoot', round: 'r1', who: s, res, me: !!s.me })
  }
  const cut = cutTies(r1, THREE_FINAL, 'pts', shootoff('r1'))
  const finalists = cut.through
  ev.push({ kind: 'cut', round: 'r1', through: finalists.map(x => x.name), tie: cut.tie, board: rankBy(r1, 'pts') })
  const meIn = finalists.some(x => x.me)
  // the final: the lowest first-round score shoots first
  ev.push({ kind: 'round', round: 'final' })
  const order = [...finalists].sort((a, b) => a.pts - b.pts || (a.me ? 1 : -1))
  const fin = []
  for (const s of order) {
    if (s.me && !mine[mi]) { turnFor('final', fin, 1); return { field, ev, need, r1, finalists, meIn, fin, stage: 'final' } }
    const res = shoot(s, 'final')
    fin.push({ ...s, res, pts: res.points })
    ev.push({ kind: 'shoot', round: 'final', who: s, res, me: !!s.me })
  }
  const title = cutTies(fin, 1, 'pts', shootoff('final'))
  const champ = title.through[0]
  ev.push({ kind: 'champ', round: 'final', who: champ, res: champ.res, tie: title.tie, board: rankBy(fin, 'pts') })
  const standings = standingsOf(r1, fin, champ, 'pts')
  return { field, ev, need: null, r1, finalists, meIn, fin, champ, stage: 'done', standings, place: standings.find(x => x.me)?.place ?? null }
}
// ── The final standings, the way the league lists them: the champion, the rest of the final by their final score, then
// everyone else by his first-round score. Equal scores share a place (a tie on the cut line or for the title went to a
// shoot-off or a dunk-off, and the winner of it is listed first). The boards and his place both read this one list.
// rows: { name, team, me, place, tied, r1, final, champ, through }
function standingsOf(r1, fin, champ, key) {
  const inFinal = new Set(fin.map(x => x.name)), first = new Map(r1.map(x => [x.name, x[key]]))
  const finRows = [...fin].sort((a, b) => (b.name === champ.name) - (a.name === champ.name) || b[key] - a[key])
  const out = r1.filter(x => !inFinal.has(x.name)).sort((a, b) => b[key] - a[key])
  const rows = [
    ...finRows.map((x, i) => ({ name: x.name, team: x.team, me: !!x.me, r1: first.get(x.name) ?? null, final: x[key], champ: i === 0, through: true, place: i === 0 ? 1 : 1 + finRows.filter(y => y.name !== x.name && (y.name === champ.name || y[key] > x[key])).length })),
    ...out.map(x => ({ name: x.name, team: x.team, me: !!x.me, r1: x[key], final: null, champ: false, through: false, place: fin.length + 1 + out.filter(y => y[key] > x[key]).length })),
  ]
  for (const r of rows) r.tied = rows.some(y => y !== r && y.place === r.place)
  return rows
}

// A rival's dunk: the tier by how high he gets and where he stands (the final, or a deficit, brings out the hard ones),
// the dunk itself from the list, never one he already landed tonight
function rivalPick(s, round, behind, used, r) {
  const v = s.v
  const pHard = clamp(0.4 + (v - 9) * 0.12 + (round === 'final' ? 0.15 : 0) + (behind > 4 ? 0.2 : 0) + (round.includes('off') ? 0.1 : 0), 0.05, 0.88)
  const pEasy = clamp(0.1 - (v - 9) * 0.04 - (round === 'final' ? 0.06 : 0), 0.02, 0.3)
  const x = r(), tier = x < pHard ? 'hard' : x < pHard + pEasy ? 'easy' : 'medium'
  const open = DUNKS.filter(d => tierOf(d) === tier && !used.has(d.id))
  const list = open.length ? open : DUNKS.filter(d => !used.has(d.id))
  const d = list[Math.floor(r() * list.length)] ?? DUNKS[0]
  return d
}
const P_DUNKS = (ev, name, round) => ev.filter(e => e.kind === 'dunk' && e.who.name === name && e.round === round).map(e => e.total)
export function dunkPlan(c) {
  const Dk = c.active?.asw?.dunk ?? {}, mine = Dk.mine ?? []
  const field = dunkField(c)
  const ev = [], R = tag => seeded(`${c.seed}-aswd-${c.year}-${tag}`)
  let mi = 0
  const used = new Map(field.map(s => [s.name, new Set()]))
  const myUsed = () => [...used.get(c.name)]
  // one dunk: his from his results (null: it's his turn), a rival's simulated
  const dunk = (s, round, n, behind) => {
    if (s.me) {
      const m = mine[mi]
      if (!m) return null
      mi++
      const d = dunkById(m.dunk) ?? { id: m.dunk, name: m.name ?? 'Dunk', tier: m.tier ?? 'medium' }
      const tier = tierOf(d)
      const j = judge(tier, m.tries, R(`judge-${round}-${n}-me`))
      if (j.landed) used.get(s.name).add(d.id)
      return { dunk: d, tier, tries: m.tries, ...j, sim: !!m.sim }
    }
    const r = R(`${round}-${n}-${s.name}`)
    const d = rivalPick(s, round, behind, used.get(s.name), r)
    const tier = tierOf(d)
    const tries = simDunk(tier, s.v, r)
    const j = judge(tier, tries, r)
    if (j.landed) used.get(s.name).add(d.id)
    return { dunk: d, tier, tries, ...j }
  }
  const turn = (round, n, toBeat) => ({ field, ev: [...ev, { kind: 'turn', round, n, toBeat }], need: { round, n, toBeat, used: myUsed(), label: ROUND_NAME[round] ?? 'DUNK-OFF' } })
  // a round of n dunks each, in order; board: each man's total so far this round
  const play = (round, men, n0, per, target) => {
    const tot = new Map(men.map(s => [s.name, 0]))
    for (let n = n0; n < n0 + per; n++) {
      for (const s of men) {
        const lead = Math.max(...men.filter(x => x.name !== s.name).map(x => tot.get(x.name)))
        const behind = lead - tot.get(s.name)
        if (s.me && !mine[mi]) return { stop: turn(round, n + 1, target(tot, s)) }
        const x = dunk(s, round, n + 1, behind)
        tot.set(s.name, tot.get(s.name) + x.total)
        ev.push({ kind: 'dunk', round, n: n + 1, who: s, me: !!s.me, ...x, sum: tot.get(s.name) })
      }
    }
    return { tot }
  }
  // what his next dunk needs: to pass the man in the last spot through (the final: the leader), with what's left
  const need = (slots) => (tot, s) => {
    const others = [...tot.entries()].filter(([k]) => k !== s.name).map(([, v]) => v).sort((a, b) => b - a)
    const line = others[slots - 1] ?? 0
    return Math.max(0, line - tot.get(s.name) + 1)
  }
  // a dunk-off for a tie: one more dunk each, again if they tie again (three times, then the order they dunked in)
  const dunkoff = round => (tied, spots) => {
    const through = []
    let left = tied
    for (let k = 0; k < 3 && spots > 0; k++) {
      if (left.length <= spots) { through.push(...left); spots = 0; break }
      const name = `${round}-off${k ? k + 1 : ''}`
      ev.push({ kind: 'round', round: name, tie: left.map(x => x.name) })
      const p = play(name, left, 0, 1, need(spots))
      if (p.stop) return { stop: p.stop }
      const rows = rankBy(left.map(s => ({ ...s, off: p.tot.get(s.name) })), 'off'), line = rows[spots - 1].off
      const over = rows.filter(x => x.off > line), at = rows.filter(x => x.off === line)
      through.push(...over); spots -= over.length
      if (at.length <= spots || k === 2) { through.push(...at.slice(0, spots)); spots = 0; break }
      left = at
    }
    return { through }
  }
  const cut = (rows, n, round) => {
    const sorted = rankBy(rows, 'sum'), line = sorted[n - 1].sum
    const above = sorted.filter(x => x.sum > line), at = sorted.filter(x => x.sum === line)
    if (above.length + at.length <= n) return { through: [...above, ...at] }
    const off = dunkoff(round)(at, n - above.length)
    if (off.stop) return off
    return { through: [...above, ...off.through] }
  }
  ev.push({ kind: 'round', round: 'r1' })
  const p1 = play('r1', field, 0, DUNKS_A_ROUND, need(DUNK_FINAL))
  if (p1.stop) return { ...p1.stop, stage: 'r1' }
  const r1 = field.map(s => ({ ...s, sum: p1.tot.get(s.name) }))
  const c1 = cut(r1, DUNK_FINAL, 'r1')
  if (c1.stop) return { ...c1.stop, stage: 'r1' }
  const finalists = c1.through
  ev.push({ kind: 'cut', round: 'r1', through: finalists.map(x => x.name), board: rankBy(r1, 'sum') })
  // the final: the lower first-round total dunks first, everyone starts at zero
  ev.push({ kind: 'round', round: 'final' })
  const order = [...finalists].sort((a, b) => a.sum - b.sum || (a.me ? 1 : -1))
  const p2 = play('final', order, 0, DUNKS_A_ROUND, need(1))
  if (p2.stop) return { ...p2.stop, stage: 'final' }
  const fin = order.map(s => ({ ...s, sum: p2.tot.get(s.name) }))
  const c2 = cut(fin, 1, 'final')
  if (c2.stop) return { ...c2.stop, stage: 'final' }
  const champ = c2.through[0]
  ev.push({ kind: 'champ', round: 'final', who: champ, board: rankBy(fin, 'sum') })
  const meIn = finalists.some(x => x.me)
  const standings = standingsOf(r1, fin, champ, 'sum')
  // (each man's dunks, the judges' totals in the order he took them: the first round's two, the final's two)
  const totals = (name, round) => P_DUNKS(ev, name, round)
  for (const r of standings) { r.r1Dunks = totals(r.name, 'r1'); r.finalDunks = r.through ? totals(r.name, 'final') : null }
  return { field, ev, need: null, r1, finalists, meIn, fin, champ, stage: 'done', standings, place: standings.find(x => x.me)?.place ?? null }
}

// ── His rounds, kept on the season ──
const withAsw = (c, f) => ({ ...c, active: { ...c.active, asw: f(c.active.asw) } })
// The answer to the invitations: which he takes ({ three, dunk })
export function answerAllStar(c, pick) {
  if (!aswOpen(c)) return c
  const inv = c.active.asw.inv
  const take = { three: !!(inv.three && pick.three), dunk: !!(inv.dunk && pick.dunk) }
  const n = withAsw(c, w => ({ ...w, pick: take, three: take.three ? { mine: [] } : null, dunk: take.dunk ? { mine: [] } : null }))
  return take.three || take.dunk ? n : finishAllStar(n)
}
// hurt at the break (the screen checks the training room): out of both, a line in the feed
export function withdrawAllStar(c, injury = 'injury') {
  if (!aswOpen(c)) return c
  return finishAllStar(withAsw(c, w => ({ ...w, pick: {}, withdrew: injury })))
}
// a round of the 3-Point Contest (raw: the engine's, or simThree's): points, made, the rack he picked
// (the engine's racks come as five lists of makes and its deep shots as two: the shots in the order he took them)
const seqOf = raw => (Array.isArray(raw?.seq) ? raw.seq.map(Boolean) : Array.isArray(raw?.racks) && Array.isArray(raw.racks[0]) && Array.isArray(raw.deep)
  ? [...raw.racks[0], ...raw.racks[1], raw.deep[0], ...raw.racks[2], raw.deep[1], ...raw.racks[3], ...raw.racks[4]].map(Boolean) : null)
// (shot: the balls off his hand before the horn, so the call can say he ran out of clock; the shots he never got off
// aren't misses in his sequence)
export function recordThree(c, raw, rack, sim = false) {
  const shot = typeof raw?.shot === 'number' ? raw.shot : null
  const seq0 = seqOf(raw), seq = seq0 && shot != null ? seq0.slice(0, shot) : seq0
  const keep = { points: raw?.points ?? 0, made: raw?.made ?? 0, of: raw?.of ?? 27, ...(shot != null ? { shot } : {}), rack, deep: typeof raw?.deep === 'number' ? raw.deep : Array.isArray(raw?.deep) ? raw.deep.filter(Boolean).length : 0, timeLeft: raw?.timeLeft ?? null, ...(seq ? { seq } : {}), ...(Array.isArray(raw?.racks) ? { racks: raw.racks.map(x => (Array.isArray(x) ? x.filter(Boolean).length : typeof x === 'number' ? x : 0)) } : {}), ...(sim ? { sim: true } : {}) }
  return withAsw(c, w => ({ ...w, three: { ...w.three, mine: [...(w.three?.mine ?? []), keep], live: null } }))
}
export const simThreeFor = (c, rack, tag) => simThree(threeV(c), seeded(`${c.seed}-asw3-me-${c.year}-${tag}`), { rack })
// one attempt at a dunk (raw: the engine's): kept as it comes, the dunk booked once it's down or the third is gone
export function recordAttempt(c, dunkId, raw, sim = false) {
  const w0 = c.active.asw.dunk ?? { mine: [] }
  const cur = w0.cur && w0.cur.dunk === dunkId ? w0.cur : { dunk: dunkId, tries: [] }
  const tries = [...cur.tries, { landed: !!raw?.landed, quality: Math.round(clamp(raw?.quality ?? (raw?.landed ? 0.5 : 0.2), 0, 1) * 100) / 100 }]
  const over = tries.some(t => t.landed) || tries.length >= DUNK_TRIES
  return withAsw(c, w => ({ ...w, dunk: { ...w.dunk, live: null, cur: over ? null : { dunk: dunkId, tries }, mine: over ? [...(w.dunk?.mine ?? []), { dunk: dunkId, tries, ...(sim ? { sim: true } : {}) }] : w.dunk?.mine ?? [] } }))
}
// a dunk simulated from his grades (Mini Games OFF): all its tries at once
export function simDunkFor(c, dunkId, tag) {
  const d = dunkById(dunkId)
  // (a dunk he's already missed and then skips: the misses stand, the tries left are simulated)
  const had = c.active?.asw?.dunk?.cur?.dunk === dunkId ? c.active.asw.dunk.cur.tries ?? [] : []
  const tries = [...had, ...simDunk(tierOf(d), dunkV(c), seeded(`${c.seed}-aswd-me-${c.year}-${tag}-${had.length}`))].slice(0, DUNK_TRIES)
  return withAsw(c, w => ({ ...w, dunk: { ...w.dunk, cur: null, mine: [...(w.dunk?.mine ?? []), { dunk: dunkId, tries, sim: true }] } }))
}
// a game left before it finished (a reload, a closed app): the Career rule, it counts as a miss. A 3-Point round is
// shot cold (his grade, two lower); a dunk attempt is a miss
export function markLive(c, kind, live) { return withAsw(c, w => ({ ...w, [kind]: { ...w[kind], live } })) }
export function settleLive(c) {
  const w = c.active?.asw
  if (!w) return c
  let n = c
  if (w.three?.live) { const L = w.three.live; n = recordThree(n, simThree(threeV(c) - 2, seeded(`${c.seed}-asw3-left-${c.year}-${L.round}`), { rack: L.rack }), L.rack, true) }
  // (left before he'd called the dunk, on the board in the game: nothing's been tried yet)
  if (w.dunk?.live) { const L = w.dunk.live; n = withAsw(n, x => ({ ...x, dunk: { ...x.dunk, live: null } })); if (L.dunk) n = recordAttempt(n, L.dunk, { landed: false, quality: 0.2 }) }
  return n
}

// ── The lines: the way the broadcast calls it ──
// (short: his name as the field shows it, shortNamer; his last name without one)
export function threeLine(res, name, round = 'r1', short = null) {
  const who = short ?? last(name)
  const seq = res.seq ?? null
  const pts = res.points, rk = res.rack
  if (seq && seq.length >= 15) {
    const tail = seq.slice(-15).filter(Boolean).length
    if (tail >= 13) return `${who} hits ${tail} of his last 15 to close out ${round === 'final' ? 'the final' : 'the round'}: ${pts}.`
    const head = seq.slice(0, 10).filter(Boolean).length
    if (head <= 3 && pts >= 19) return `Starts ${head} for 10, then can't miss. ${who} finishes with ${pts}.`
  }
  const money = rk != null && res.racks ? res.racks[rk] : null
  if (money === 5) return `${who} goes 5 for 5 on the money rack from ${RACK_WORD[rk]}: ${pts}.`
  if (res.deep === 2 && pts >= 20) return `Both deep shots go down. ${who} posts ${pts}.`
  if (res.shot != null && res.shot < (res.of ?? 27)) return `${who} runs out of clock with ${(res.of ?? 27) - res.shot} balls on the rack: ${pts}.`
  if (pts >= 28) return `${who} catches fire: ${res.made} of ${res.of ?? 27}, ${pts} points.`
  if (pts <= 14) return `${who} never finds a rhythm. ${res.made} of ${res.of ?? 27}, ${pts} points.`
  return `${who} puts up ${pts}, ${res.made} of ${res.of ?? 27}.`
}
export function dunkLine(x, name, short = null) {
  const who = short ?? last(name), tries = x.tries?.length ?? 1
  if (x.perfect) return `${who} throws down the ${x.dunk.name}. A 50 from all five judges.`
  if (!x.landed) return `${who} can't get the ${x.dunk.name} down in three tries. The judges give him ${x.total}.`
  if (tries === 1) return x.total >= 47 ? `${who} nails the ${x.dunk.name} on the first try: ${x.total}.` : `${who} lands the ${x.dunk.name} on the first try: ${x.total}.`
  return `${who} misses ${tries === 2 ? 'once' : 'twice'}, then gets the ${x.dunk.name} down on the ${tries === 2 ? 'second' : 'third'} try: ${x.total}.`
}

// ── Done: the results on the season, the feed and the story ──
export function finishAllStar(c) {
  const w = c.active?.asw
  if (!w || w.done) return c
  const k = w.at ?? c.active.k, yr = c.year + 1
  const notes = [], events = []
  const res = {}
  const p = w.pick ?? {}
  if (w.withdrew) notes.push({ k, note: `${c.name} withdraws from ${w.inv?.three && w.inv?.dunk ? 'the 3-Point Contest and the Slam Dunk Contest' : w.inv?.three ? 'the 3-Point Contest' : 'the Slam Dunk Contest'} with the ${w.withdrew}. The league names a replacement.`, noteKind: 'ALL-STAR SATURDAY' })
  else if (w.inv?.three && !p.three) notes.push({ k, note: `${c.name} turns down an invitation to the 3-Point Contest.`, noteKind: '3-POINT CONTEST' })
  if (!w.withdrew && w.inv?.dunk && !p.dunk) notes.push({ k, note: `${c.name} passes on the Slam Dunk Contest.`, noteKind: 'SLAM DUNK CONTEST' })
  if (p.three && w.three) {
    const P = threePlan(c)
    if (P.stage === 'done') {
      const me = P.r1.find(x => x.me), f = P.fin?.find(x => x.me)
      const runner = P.fin.filter(x => x.name !== P.champ.name).sort((a, b) => b.pts - a.pts)[0]
      res.three = { won: !!P.champ.me, place: P.place, r1: me?.pts ?? 0, final: f?.pts ?? null, champ: P.champ.name, champPts: P.champ.pts }
      const text = P.champ.me ? `3-Point Contest champion. ${c.name} puts up ${P.champ.pts} in the final${runner ? ` to beat ${runner.name} (${runner.pts})` : ''}.`
        : f ? `${c.name} reaches the final of the 3-Point Contest with ${me.pts}, then scores ${f.pts}. ${P.champ.name} wins it with ${P.champ.pts}.`
        : `${c.name} scores ${me?.pts ?? 0} in the first round of the 3-Point Contest and misses the final. ${P.champ.name} wins it with ${P.champ.pts}.`
      notes.push({ k, note: text, noteKind: '3-POINT CONTEST' })
      events.push({ year: yr, season: true, text: P.champ.me ? `Won the 3-Point Contest at All-Star Saturday: ${P.champ.pts} in the final. +${ASW_LEGACY} legacy.` : `In the 3-Point Contest at All-Star Saturday: ${f ? 'reached the final' : `${me?.pts ?? 0} in the first round`}.` })
    }
  }
  if (p.dunk && w.dunk) {
    const P = dunkPlan(c)
    if (P.stage === 'done') {
      const mine = P.ev.filter(e => e.kind === 'dunk' && e.me)
      const best = [...mine].sort((a, b) => b.total - a.total)[0]
      const f = P.fin.find(x => x.me), me = P.r1.find(x => x.me)
      const runner = P.fin.find(x => x.name !== P.champ.name)
      res.dunk = { won: !!P.champ.me, place: P.place, r1: me?.sum ?? 0, final: f?.sum ?? null, champ: P.champ.name, champPts: P.champ.sum, best: best ? { name: best.dunk.name, tier: best.tier, total: best.total } : null, fifties: mine.filter(x => x.perfect).length }
      const text = P.champ.me ? `Slam Dunk champion. ${c.name} scores ${P.champ.sum} in the final${runner ? `, ${runner.sum} for ${runner.name}` : ''}${best ? `, and his ${best.dunk.name} gets a ${best.total}` : ''}.`
        : f ? `${c.name} makes the Slam Dunk final and scores ${f.sum}. ${P.champ.name} takes the title with ${P.champ.sum}.`
        : `${c.name} scores ${me?.sum ?? 0} in the first round of the Slam Dunk Contest and doesn't make the final. ${P.champ.name} wins it.`
      notes.push({ k, note: text, noteKind: 'SLAM DUNK CONTEST' })
      events.push({ year: yr, season: true, text: P.champ.me ? `Won the Slam Dunk Contest at All-Star Saturday${best ? `: his ${best.dunk.name} scored ${best.total}` : ''}. +${ASW_LEGACY} legacy.` : `In the Slam Dunk Contest at All-Star Saturday: ${f ? 'reached the final' : `${me?.sum ?? 0} in the first round`}.` })
    }
  }
  return { ...c, events: [...(c.events ?? []), ...events], active: { ...c.active, asw: { ...w, done: true, res }, feed: [...c.active.feed, ...notes] } }
}

// ── Balance (scripts/moments/allstar-check.mjs): a dunk's expected total by tier, for a dunker at grade v ──
// landing rates: the engine's, measured (LAND: easy 97%, medium 88%, hard 71% a try at v 9); quality as simDunk draws it
export function dunkBalance(v = 9, n = 20000, seed = 'bal') {
  const out = {}
  for (const tier of ['easy', 'medium', 'hard']) {
    const r = seeded(`${seed}-${tier}-${v}`)
    let sum = 0, blank = 0, first = 0, best = 0
    for (let i = 0; i < n; i++) { const t = simDunk(tier, v, r); const j = judge(tier, t, r); sum += j.total; if (!j.landed) blank++; if (t[0].landed) first++; if (j.total >= 47) best++ }
    const pct = x => Math.round((x / n) * 1000) / 10
    out[tier] = { mean: Math.round((sum / n) * 10) / 10, first: pct(first), blank: pct(blank), big: pct(best) }
  }
  return out
}
