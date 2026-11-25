// ─── A soccer match, minute by minute (the season page's live match: components/SoccerMatchDay.jsx) ───────────
// The engine (utils/soccerSimulation.js) decides every match: the score, extra time, the shootout's score, his
// minutes, goals (penalties, headers, from outside the box), assists, shots, shots on target, big chances missed and
// his rating. This file only tells that match in order, the way a broadcast would: when the goals went in and who
// scored the others, his misses and saves, the cards, half time, extra time and the shootout kick by kick. It never
// changes a number the engine gave, and it's seeded from the match, so the same match always tells the same way.
//
//   matchStory(m, ctx) → { beats, events, len, shootout, box, line }
//     m: an engine match (the result contract's `match`); ctx: { key, userName, pool, us, them, usName, themName,
//     usRate, themRate ({ att, def }), before ([his side, theirs]: a second leg's first-leg goals), cap (a moment's
//     minute: every goal before it, the rest held back) }
//     beats: the clock, one a minute: { lbl: "45+2'", m, x, p (period 1-4) }; events: [{ b (beat), kind, side, his,
//     text, my, opp (the score after it) }] in beat order.
//   extendStory(story, from, to, ctx) → the same story with what a moment changed (to's extra goals) after its minute
//   wcTableAt(groupGames, standings, md) / uclMatchdays(leaguePhase) / uclTableAt(…) → a table part way through
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
import { seeded } from './rng'
import { SOCCER_ALL_STRIKERS, WC_STRIKERS } from '../data/soccer-strikers'

// each role's share of a side's goals and assists (the engine's ROLE table, utils/soccerSimulation.js)
const RG = { ST: 1, SS: 0.85, LW: 0.62, RW: 0.62, AM: 0.5, CM: 0.25, DM: 0.1 }
const RA = { ST: 1, SS: 1.3, LW: 1.6, RW: 1.6, AM: 1.9, CM: 1.4, DM: 0.8 }
const ORDER = { ST: 0, SS: 1, LW: 2, RW: 2, AM: 3, CM: 4, DM: 5 }
let BY = null
const byTeam = list => {
  const m = new Map()
  for (const p of list ?? []) { const r = RG[p.role] ? p.role : 'ST'; if (!m.has(p.team)) m.set(p.team, []); m.get(p.team).push({ n: p.short || p.name, role: r, starter: !!p.starter }) }
  for (const arr of m.values()) arr.sort((a, b) => ORDER[a.role] - ORDER[b.role])
  return m
}
// a side's men up front and in midfield (the data's: up to eight a club, five a nation); `mine`: the build's side, the
// No. 9 he plays in place of left out (the side's `starter`, or its first striker: the engine's choice)
export function squadOf(short, pool, mine = false) {
  BY ??= { current: byTeam(SOCCER_ALL_STRIKERS), alltime: byTeam(WC_STRIKERS) }
  const all = BY[pool === 'alltime' ? 'alltime' : 'current'].get(short) ?? []
  if (!mine) return all
  const main = all.find(p => p.starter) ?? all.find(p => p.role === 'ST') ?? all[0]
  return all.filter(p => p !== main)
}

const lastOf = n => String(n ?? '')
const pickW = (rand, list, w) => {
  const tot = list.reduce((s, x) => s + w(x), 0)
  if (!list.length || tot <= 0) return null
  let u = rand() * tot
  for (const x of list) { u -= w(x); if (u <= 0) return x }
  return list[list.length - 1]
}
const intIn = (rand, lo, hi) => (hi < lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)))
const one = (rand, arr) => arr[Math.floor(rand() * arr.length)]

// ── The clock ─────────────────────────────────────────────────────────────────
// a beat a minute; each period's stoppage time after its last minute (45+1, 45+2 …)
function beatsOf(len, st) {
  const out = []
  const per = (p, a, b, s) => { for (let m = a; m <= b; m++) out.push({ m, x: 0, p, lbl: `${m}'` }); for (let x = 1; x <= s; x++) out.push({ m: b, x, p, lbl: `${b}+${x}'` }) }
  per(1, 1, 45, st[0]); per(2, 46, 90, st[1])
  if (len > 90) { per(3, 91, 105, st[2]); per(4, 106, 120, st[3]) }
  return out
}
const PERIOD_END = { 1: 45, 2: 90, 3: 105, 4: 120 }
const periodOf = m => (m <= 45 ? 1 : m <= 90 ? 2 : m <= 105 ? 3 : 4)

// ── The story ─────────────────────────────────────────────────────────────────
export function matchStory(m, ctx) {
  const { key = 'm', userName = 'Guest', pool = 'current', us, them, usName = us, themName = them, before = null, cap = null } = ctx
  const rand = seeded(`soccer-match|${key}|${us}|${them}|${m.g ?? ''}|${m.mySc}-${m.oppSc}|${m.goals ?? 0}`)
  const len = m.et ? 120 : 90
  const st = [intIn(rand, 1, 3), intIn(rand, 2, 6), 1, intIn(rand, 1, 2)]
  const beats = beatsOf(len, st)
  const beatAt = (mm, x = 0) => { const i = beats.findIndex(b => b.m === mm && b.x === x); return i < 0 ? beats.findIndex(b => b.m === mm) : i }
  const mates = squadOf(us, pool, true)
  const foes = squadOf(them, pool)
  const N = userName || 'Guest'
  const capHi = cap ? Math.max(2, cap - 1) : 90

  // the score after 90: level (on aggregate in a second leg) when it went to extra time
  const mySc = m.mySc ?? 0, opSc = m.oppSc ?? 0
  let my90 = mySc, op90 = opSc
  if (m.et && !m.shootout) {
    const d = (before ? before[0] - before[1] : 0) + mySc - opSc
    if (d > 0 && mySc - d >= 0) my90 = mySc - d
    else if (d < 0 && opSc + d >= 0) op90 = opSc + d
  }
  // his time on the pitch: a starter from the first whistle to his minutes; a substitute on for the last of them
  let on = null, off = null
  if (m.app) {
    const plan = m.et && !m.start ? Math.max(1, (m.mins ?? 0) - 30) : (m.mins ?? 90)
    on = m.start ? 0 : Math.min(88, Math.max(46, 90 - plan))
    off = m.start ? ((m.mins ?? 90) >= 90 ? len : Math.max(46, m.mins)) : len
    if (cap && off < cap) off = len      // (a moment puts the ball at his feet: he's still on)
    if (cap && on >= cap) on = cap - 12
  }
  const inWin = (lo, hi) => [Math.max(lo, (on ?? 0) + 1), Math.min(hi, off ?? 0)]
  // a minute in [lo, hi]; the last minute of a half often runs into its stoppage time
  const minuteIn = (lo, hi) => {
    const mm = intIn(rand, lo, hi)
    if ((mm === 45 && st[0]) || mm === 90 || (mm === 120 && st[3])) {
      const s = mm === 45 ? st[0] : mm === 90 ? st[1] : st[3]
      if (rand() < 0.6) return [mm, intIn(rand, 1, s)]
    }
    return [mm, 0]
  }

  // his goals first (inside his minutes), then the others; `assists` of his side's other goals come while he's on
  let R = my90, E = mySc - my90
  const mine = []
  const nG = Math.min(m.goals ?? 0, mySc)
  for (let i = 0; i < nG; i++) {
    const etOk = E > 0 && (off ?? 0) > 90
    const inET = etOk && (R === 0 || rand() < E / (R + E))
    const [lo, hi] = inET ? inWin(91, 120) : inWin(1, Math.min(90, capHi))
    const [mm, x] = minuteIn(lo, Math.max(lo, hi))
    if (inET) E--; else R--
    mine.push({ mm, x, his: true })
  }
  const kinds = []
  for (let i = 0; i < (m.pens ?? 0); i++) kinds.push('pen')
  for (let i = 0; i < (m.headers ?? 0); i++) kinds.push('head')
  for (let i = 0; i < (m.outside ?? 0); i++) kinds.push('out')
  mine.sort(() => rand() - 0.5).forEach((g, i) => { g.kind = kinds[i] ?? 'box' })
  let ast = Math.min(m.assists ?? 0, R + E)
  const others = []
  while (R + E > 0) {
    const inET = E > 0 && (R === 0 || rand() < E / (R + E))
    let lo = inET ? 91 : 1, hi = inET ? 120 : Math.min(90, capHi)
    const byHim = ast > 0 && on != null
    if (byHim) [lo, hi] = inET ? inWin(91, 120) : inWin(1, Math.min(90, capHi))
    const [mm, x] = minuteIn(lo, Math.max(lo, hi))
    if (inET) E--; else R--
    if (byHim) ast--
    others.push({ mm, x, his: false, byHim, kind: rand() < 0.22 ? 'head' : rand() < 0.1 ? 'out' : 'box' })
  }
  const theirs = []
  for (let i = 0; i < op90; i++) { const [mm, x] = minuteIn(1, Math.min(90, capHi)); theirs.push({ mm, x, kind: rand() < 0.2 ? 'head' : rand() < 0.12 ? 'pen' : 'box' }) }
  for (let i = op90; i < opSc; i++) { const [mm, x] = minuteIn(91, 120); theirs.push({ mm, x, kind: rand() < 0.2 ? 'head' : 'box' }) }

  const ev = []
  const push = (mm, x, e) => ev.push({ mm, x, ...e })
  const scorerFrom = (list, w) => pickW(rand, list, w)
  for (const g of mine) {
    const a = g.kind === 'pen' ? null : rand() < (g.kind === 'out' ? 0.3 : 0.75) ? scorerFrom(mates, p => RA[p.role]) : null
    push(g.mm, g.x, { kind: 'goal', side: 'me', his: true, who: N, ast: a?.n ?? null, gk: g.kind })
  }
  for (const g of others) {
    const s = scorerFrom(mates, p => RG[p.role])
    push(g.mm, g.x, { kind: 'goal', side: 'me', his: false, who: s?.n ?? null, ast: g.byHim ? N : (rand() < 0.6 ? scorerFrom(mates.filter(p => p !== s), p => RA[p.role])?.n ?? null : null), byHim: g.byHim, gk: g.byHim && g.kind === 'pen' ? 'box' : g.kind })
  }
  for (const g of theirs) {
    const s = scorerFrom(foes, p => RG[p.role])
    push(g.mm, g.x, { kind: 'goal', side: 'opp', who: s?.n ?? null, ast: rand() < 0.55 ? scorerFrom(foes.filter(p => p !== s), p => RA[p.role])?.n ?? null : null, gk: g.kind })
  }
  // his shots that didn't go in, a missed penalty, the chances he made
  if (m.app) {
    const npg = (m.goals ?? 0) - (m.pens ?? 0)
    const missed = Math.max(0, (m.shots ?? 0) - npg)
    const penMiss = Math.max(0, (m.pensTaken ?? 0) - (m.pens ?? 0))
    let onT = Math.max(0, (m.sot ?? 0) - npg)
    let big = Math.max(0, (m.bcm ?? 0) - penMiss)
    const head = rand() < 0.5
    for (let i = 0; i < missed; i++) {
      const [lo, hi] = rand() < 0.15 && (off ?? 0) > 90 ? inWin(91, 120) : inWin(1, Math.min(90, cap ? capHi : 90))
      const [mm, x] = minuteIn(lo, Math.max(lo, hi))
      const isBig = big > 0 && rand() < 0.7; if (isBig) big--
      const tgt = onT > 0 && (isBig ? rand() < 0.6 : rand() < 0.5); if (tgt) onT--
      push(mm, x, { kind: 'shot', side: 'me', his: true, who: N, saved: tgt, big: isBig, head: head && rand() < 0.4 })
    }
    for (let i = 0; i < penMiss; i++) { const [lo, hi] = inWin(1, Math.min(90, capHi)); const [mm, x] = minuteIn(lo, Math.max(lo, hi)); push(mm, x, { kind: 'penmiss', side: 'me', his: true, who: N }) }
    const kp = intIn(rand, 0, 2)
    for (let i = 0; i < kp; i++) {
      const [lo, hi] = inWin(1, Math.min(90, capHi)); const [mm, x] = minuteIn(lo, Math.max(lo, hi))
      push(mm, x, { kind: 'kp', side: 'me', his: true, who: N, mate: scorerFrom(mates, p => RG[p.role])?.n ?? null })
    }
    if (!m.start) push(on, 0, { kind: 'subon', side: 'me', his: true, who: N })
    else if (off < 90) push(off, 0, { kind: 'suboff', side: 'me', his: true, who: N, scored: (m.goals ?? 0) > 0 })
  }
  // the rest of the match: chances at both ends, the cards
  const chances = intIn(rand, 1, 3) + intIn(rand, 0, 2)
  for (let i = 0; i < chances; i++) {
    const side = rand() < 0.5 ? 'me' : 'opp'
    const [mm, x] = minuteIn(2, Math.min(len === 120 ? 118 : 89, cap ? capHi : 120))
    const list = side === 'me' ? mates : foes
    push(mm, x, { kind: 'chance', side, who: scorerFrom(list, p => RG[p.role])?.n ?? null, post: rand() < 0.2 })
  }
  for (const side of ['me', 'opp']) {
    const n = rand() < 0.2 ? 0 : rand() < 0.55 ? 1 : rand() < 0.75 ? 2 : 3
    const list = (side === 'me' ? mates : foes).filter(p => p.role === 'CM' || p.role === 'DM' || p.role === 'AM')
    for (let i = 0; i < n; i++) {
      const [mm, x] = minuteIn(12, Math.min(len === 120 ? 119 : 90, cap ? capHi : 120))
      push(mm, x, { kind: 'yellow', side, who: list.length && rand() < 0.55 ? one(rand, list).n : null })
    }
  }
  // the whistles
  push(45, st[0], { kind: 'ht' })
  if (len > 90) { push(90, st[1], { kind: 'ft90' }); push(105, st[2], { kind: 'etht' }) }
  push(len, st[len > 90 ? 3 : 1], { kind: 'ft' })

  // in clock order (at the same minute: a goal last, the whistle after everything)
  const rank = e => (e.kind === 'ht' || e.kind === 'ft' || e.kind === 'ft90' || e.kind === 'etht' ? 3 : e.kind === 'goal' ? 2 : e.kind === 'subon' ? 0 : 1)
  ev.sort((a, b) => a.mm - b.mm || a.x - b.x || rank(a) - rank(b))
  const events = []
  let my = 0, op = 0
  for (const e of ev) {
    if (e.kind === 'goal') { if (e.side === 'me') my++; else op++ }
    events.push({ ...e, b: Math.max(0, beatAt(e.mm, e.x)), my, opp: op })
  }
  for (const e of events) e.text = say(e, { N, usName, themName, rand, events, before })
  const shootout = m.shootout ? shootoutOf(m.shootout, { rand, mates, foes, N, usName, themName }) : null
  const box = boxOf(m, ctx, rand, events)
  return { beats, events, len, st, shootout, box, cap: cap ? beatAt(cap) : null, on, off }
}

// what the broadcast says
function say(e, { N, usName, themName, rand }) {
  const team = e.side === 'me' ? usName : themName
  const who = e.who
  const lead = e.side === 'me' ? e.my - e.opp : e.opp - e.my
  if (e.kind === 'goal') {
    const state = lead === 0 ? 'level' : lead === 1 ? 'front' : lead > 1 ? 'more' : 'back'
    if (e.his) {
      const from = e.ast ? one(rand, [`, set up by ${e.ast}`, ` from ${e.ast}'s pass`, ` after ${e.ast}'s through ball`]) : ''
      if (e.gk === 'pen') return `${N} sends the keeper the wrong way from the spot.`
      if (e.gk === 'head') return `${N} heads it in${e.ast ? ` from ${e.ast}'s cross` : ' from a corner'}.`
      if (e.gk === 'out') return `${N} from 25 yards. Into the top corner.`
      return one(rand, [`${N} finishes low into the far corner${from}.`, `${N} takes a touch and beats the keeper${from}.`, `${N} turns his marker and finishes${from}.`, `${N} is first to the rebound and taps in.`, `${N} gets across his man at the near post${from}.`])
    }
    if (e.side === 'me') {
      if (e.byHim) return who ? `${who} scores. ${N} with the assist.` : `${usName} score. ${N} with the assist.`
      if (!who) return `${usName} score${state === 'level' ? ' to level it' : ''}. A header from a corner.`
      return e.gk === 'head' ? `${who} heads in${e.ast ? ` from ${e.ast}'s cross` : ' from a corner'}.` : e.gk === 'out' ? `${who} from distance. Unstoppable.` : one(rand, [`${who} scores for ${usName}.`, `${who} finishes${e.ast ? `, set up by ${e.ast}` : ''}.`])
    }
    const s = who ?? themName
    if (e.gk === 'pen') return `Penalty to ${themName}. ${who ?? 'Their taker'} scores.`
    if (state === 'level') return `${themName} level through ${s}.`
    if (state === 'front' && e.opp === 1 && e.my === 0) return `${s} puts ${themName} in front.`
    return e.gk === 'head' ? `${s} heads one in for ${themName}.` : `${s} scores for ${themName}.`
  }
  if (e.kind === 'shot') {
    if (e.big && e.saved) return `Big chance. ${N} is through on goal, and the keeper saves with his legs.`
    if (e.big) return `${N} should score. He drags it wide from eight yards.`
    if (e.head) return e.saved ? `${N}'s header is tipped over.` : `${N} gets his head to it. Just wide.`
    return e.saved ? one(rand, [`${N} forces a save from the keeper.`, `${N} tests the keeper from the edge of the box.`]) : one(rand, [`${N} fires over.`, `${N} shoots wide.`, `${N}'s shot is blocked.`])
  }
  if (e.kind === 'penmiss') return `Penalty to ${usName}. ${N}'s spot kick is saved.`
  if (e.kind === 'kp') return e.mate ? `${N} picks out ${e.mate}, who can't keep it down.` : `${N} lays it back. The shot is blocked.`
  if (e.kind === 'subon') return `Substitution: ${N} comes on for ${usName}.`
  if (e.kind === 'suboff') return e.scored ? `${N} makes way. A standing ovation.` : `${N} makes way.`
  if (e.kind === 'chance') {
    if (e.side === 'me') return e.post ? `${who ?? usName} hits the post.` : `${who ? `${who} goes close` : `${usName} go close`}. Wide.`
    return e.post ? `${who ?? themName} hits the post.` : `${themName} go close${who ? `: ${who}'s shot is saved` : ''}.`
  }
  if (e.kind === 'yellow') return who ? `Yellow card: ${who} (${team}).` : `Yellow card for ${team}.`
  if (e.kind === 'ht') return `Half time. ${usName} ${e.my}–${e.opp} ${themName}.`
  if (e.kind === 'ft90') return `Ninety minutes up: ${e.my}–${e.opp}. Extra time.`
  if (e.kind === 'etht') return `Half time in extra time: ${e.my}–${e.opp}.`
  if (e.kind === 'ft') return `Full time. ${usName} ${e.my}–${e.opp} ${themName}.`
  return ''
}

// The shootout, kick by kick, to the engine's score: five each, then sudden death, it stops when it's settled.
// He takes his side's first kick when the engine says he took one (kick 'scored' | 'missed'), else he's off by then.
function shootoutOf(sh, { rand, mates, foes, N, usName, themName }) {
  const target = [sh.my, sh.opp]
  const meFirst = rand() < 0.5
  const tryOnce = () => {
    const ks = [[], []]
    let a = 0, b = 0
    const kick = (side, i) => (side === 0 && i === 0 && sh.kick ? sh.kick === 'scored' : rand() < 0.75)
    const sides = meFirst ? [0, 1] : [1, 0]
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 2; j++) {
        const s = sides[j]
        const ok = kick(s, i); ks[s].push(ok); if (ok) { if (s === 0) a++; else b++ }
        const left = [5 - ks[0].length, 5 - ks[1].length]
        if (a > b + left[1] || b > a + left[0]) return { ks, a, b }
      }
    }
    for (let i = 5; a === b && i < 14; i++) for (let j = 0; j < 2; j++) { const s = sides[j]; const ok = rand() < 0.72; ks[s].push(ok); if (ok) { if (s === 0) a++; else b++ } }
    return { ks, a, b }
  }
  let got = null
  for (let t = 0; t < 20000 && !got; t++) { const x = tryOnce(); if (x.a === target[0] && x.b === target[1]) got = x }
  // (a score the shootout rules can't reach, never from the engine: kick it to the score as it stands)
  if (!got) {
    const mk = (n, len) => Array.from({ length: len }, (_, i) => i < n)
    const L = Math.max(5, target[0], target[1]) + (target[0] === target[1] ? 1 : 0)
    got = { ks: [mk(target[0], L), mk(target[1], L)], a: target[0], b: target[1] }
  }
  const takers = side => {
    const own = side === 0 ? [...(sh.kick ? [N] : []), ...mates.map(p => p.n)] : foes.map(p => p.n)
    return i => own[i] ?? null
  }
  const T = [takers(0), takers(1)]
  const order = []
  const n = Math.max(got.ks[0].length, got.ks[1].length)
  const sides = meFirst ? [0, 1] : [1, 0]
  for (let i = 0; i < n; i++) for (const s of sides) if (i < got.ks[s].length) order.push({ side: s === 0 ? 'me' : 'opp', i, who: T[s](i), scored: got.ks[s][i], his: s === 0 && i === 0 && !!sh.kick })
  let a = 0, b = 0
  for (const k of order) {
    if (k.scored) { if (k.side === 'me') a++; else b++ }
    k.my = a; k.opp = b
    const team = k.side === 'me' ? usName : themName
    const who = k.who ?? `${team}'s ${['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][k.i] ?? 'next'} taker`
    k.text = k.scored ? `${who} scores.` : one(rand, [`${who}: saved.`, `${who} puts it over the bar.`, `${who} hits the post.`])
  }
  return { first: meFirst ? 'me' : 'opp', kicks: order, my: sh.my, opp: sh.opp, won: !!sh.won }
}

// The box score: the engine's numbers for him; the team lines drawn around the score (possession from the two
// sides' ratings and where it was played)
function boxOf(m, ctx, rand, events) {
  const u = ctx.usRate ?? {}, t = ctx.themRate ?? {}
  const edge = ((u.att ?? 80) + (u.def ?? 80) - (t.att ?? 80) - (t.def ?? 80)) * 0.4 + (m.neutral ? 0 : m.home ? 3 : -3)
  const poss = Math.round(Math.max(30, Math.min(70, 50 + edge + (rand() * 8 - 4))))
  const mySc = m.mySc ?? 0, opSc = m.oppSc ?? 0
  const theirsOn = Math.max(0, mySc - (m.goals ?? 0))
  const f = (poss - 50) / 50
  const myShots = (m.shots ?? 0) + theirsOn * 2 + Math.max(2, Math.round(4 + f * 6 + rand() * 5))
  const opShots = opSc * 2 + Math.max(2, Math.round(5 - f * 6 + rand() * 5))
  const mySot = Math.min(myShots, (m.sot ?? 0) + theirsOn + intIn(rand, 1, 3))
  const opSot = Math.min(opShots, opSc + intIn(rand, 1, 3))
  const myXg = (m.xg ?? 0) + theirsOn * 0.42 + 0.25 + rand() * 0.6 + Math.max(0, f) * 0.5
  const opXg = opSc * 0.55 + 0.3 + rand() * 0.7 + Math.max(0, -f) * 0.5
  const yel = side => events.filter(e => e.kind === 'yellow' && e.side === side).length
  const corners = [Math.max(0, Math.round(4 + f * 4 + rand() * 4)), Math.max(0, Math.round(4 - f * 4 + rand() * 4))]
  const fouls = [intIn(rand, 7, 15), intIn(rand, 7, 15)]
  return {
    rows: [
      ['Possession', `${poss}%`, `${100 - poss}%`], ['Shots', myShots, opShots], ['Shots on target', mySot, opSot],
      ['Expected goals', Math.round(myXg * 10) / 10, Math.round(opXg * 10) / 10], ['Corners', corners[0], corners[1]],
      ['Fouls', fouls[0], fouls[1]], ['Yellow cards', yel('me'), yel('opp')],
    ],
  }
}

// What a moment changed (the director rewrote the match: lib/seasonDirector.js choose): the goals it added go in
// after the moment's minute, the outcome's line at the minute itself
export function extendStory(story, from, to, ctx, line = null) {
  if (!story) return story
  const { userName = 'Guest', usName, themName } = ctx
  const N = userName || 'Guest'
  const rand = seeded(`soccer-moment|${ctx.key}|${to.mySc}-${to.oppSc}|${to.goals ?? 0}`)
  const b0 = story.cap ?? story.beats.findIndex(b => b.m === 84)
  const last = story.beats.findIndex(b => b.m === 90 && b.x === (story.st?.[1] ?? 0))
  const keep = story.events.filter(e => e.b <= b0 && e.kind !== 'ft')
  let my = keep.length ? keep[keep.length - 1].my : 0, op = keep.length ? keep[keep.length - 1].opp : 0
  // (the score at the moment: every goal before it)
  my = story.events.filter(e => e.kind === 'goal' && e.side === 'me').length
  op = story.events.filter(e => e.kind === 'goal' && e.side === 'opp').length
  const add = []
  if (line) add.push({ b: b0, kind: 'moment', side: 'me', his: true, text: line })
  const dMy = Math.max(0, (to.mySc ?? 0) - my), dOp = Math.max(0, (to.oppSc ?? 0) - op)
  let hisNew = Math.max(0, (to.goals ?? 0) - (from.goals ?? 0))
  const span = Math.max(1, last - b0 - 1)
  const at = () => Math.min(last - 1, b0 + 1 + Math.floor(rand() * span))
  for (let i = 0; i < dMy; i++) {
    const his = hisNew > 0; if (his) hisNew--
    add.push({ b: at(), kind: 'goal', side: 'me', his, who: his ? N : null, gk: 'box' })
  }
  for (let i = 0; i < dOp; i++) add.push({ b: at(), kind: 'goal', side: 'opp', who: null, gk: 'box' })
  const tail = story.events.filter(e => e.b > b0 && e.kind !== 'goal')
  const evs = [...story.events.filter(e => e.b <= b0), ...add, ...tail].sort((a, b) => a.b - b.b || (a.kind === 'ft' ? 1 : 0) - (b.kind === 'ft' ? 1 : 0))
  let a = 0, c = 0
  for (const e of evs) {
    if (e.kind === 'goal') { if (e.side === 'me') a++; else c++ }
    e.my = a; e.opp = c
    if (!e.text || e.kind === 'goal' || e.kind === 'ft') {
      if (e.kind === 'goal' && !e.text) e.text = e.side === 'me' ? (e.his ? `${N} scores. The ground goes up.` : `${usName} score.`) : `${themName} score.`
      if (e.kind === 'ft') e.text = `Full time. ${usName} ${a}–${c} ${themName}.`
    }
  }
  return { ...story, events: evs, cap: null }
}

// ── The tables part way through ───────────────────────────────────────────────
const sortRows = rows => rows.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || y.wins - x.wins || String(x.name).localeCompare(String(y.name)))
const blank = r => ({ ...r, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 })
function addTo(by, h, a, hs, as) {
  const H = by.get(h), A = by.get(a)
  if (!H || !A) return
  H.played++; A.played++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs
  if (hs > as) { H.wins++; A.losses++; H.points += 3 } else if (hs < as) { A.wins++; H.losses++; A.points += 3 } else { H.draws++; A.draws++; H.points++; A.points++ }
}
// A World Cup group after `md` matchdays (the group's own matches; his from `mine`, the matches as played). After the
// third it's the result's table (FIFA's tiebreaks).
export function wcTableAt(groupGames, standings, md, mine = null, us = null) {
  if (!groupGames?.length || !standings?.length) return md >= 3 ? standings : null
  if (md >= 3) return standings
  const by = new Map(standings.map(r => [r.short, blank(r)]))
  for (const [d, h, a, hs, as] of groupGames) {
    if (d > md) continue
    if (mine && us && (h === us || a === us)) continue
    addTo(by, h, a, hs, as)
  }
  if (mine && us) for (const g of mine.slice(0, md)) { if (g.home === false && !g.neutral) addTo(by, g.opponent, us, g.oppSc, g.mySc); else addTo(by, us, g.opponent, g.mySc, g.oppSc) }
  const rows = sortRows([...by.values()].map(r => ({ ...r, gd: r.gf - r.ga })))
  return rows.map((r, i) => ({ ...r, pos: i + 1 }))
}
// the other match in his group on matchday `md`
export function wcOtherGame(groupGames, md, us) {
  return (groupGames ?? []).find(([d, h, a]) => d === md && h !== us && a !== us) ?? null
}

// The Champions League's league phase in matchdays: his eight are the first eight of `leaguePhase` (matchday order,
// utils/soccerSimulation.js uclWorld), the rest are spread over the eight matchdays so every club plays once a
// matchday (a seeded search; a club that can't fit goes where it clashes least). Returns each match's matchday.
export function uclMatchdays(leaguePhase, us) {
  const L = leaguePhase ?? []
  if (!L.length) return []
  const md = L.map((_, i) => (i < 8 ? i + 1 : 0))
  const busy0 = new Map()
  const take = (map, c, d) => { if (!map.has(c)) map.set(c, new Set()); map.get(c).add(d) }
  for (let i = 0; i < 8 && i < L.length; i++) { take(busy0, L[i][0], i + 1); take(busy0, L[i][1], i + 1) }
  const rest = L.map((x, i) => i).slice(8)
  const rand = seeded(`ucl-md|${us}|${L.length}`)
  // most-constrained match first, backtracking (an edge colouring of the draw: it nearly always closes in a few
  // thousand steps); the step limit falls back to the fewest clashes
  const busy = new Map([...busy0].map(([k, v]) => [k, new Set(v)]))
  const has = (c, d) => busy.get(c)?.has(d)
  const freeOf = i => { const [h, a] = L[i]; const f = []; for (let d = 1; d <= 8; d++) if (!has(h, d) && !has(a, d)) f.push(d); return f }
  const out = md.slice()
  let steps = 0
  const open = new Set(rest)
  const solve = () => {
    if (!open.size) return true
    if (++steps > 40000) return false
    let pick = -1, pf = null
    for (const i of open) { const f = freeOf(i); if (!pf || f.length < pf.length) { pick = i; pf = f; if (f.length <= 1) break } }
    if (!pf.length) return false
    const [h, a] = L[pick]
    open.delete(pick)
    for (const d of pf.sort(() => rand() - 0.5)) {
      take(busy, h, d); take(busy, a, d); out[pick] = d
      if (solve()) return true
      busy.get(h).delete(d); busy.get(a).delete(d)
      if (steps > 40000) break
    }
    open.add(pick); out[pick] = 0
    return false
  }
  if (solve()) return out
  // (no clean split: whatever fits, the rest where they clash least)
  for (const i of rest) if (!out[i]) { const f = freeOf(i); const d = f[0] ?? 1 + Math.floor(rand() * 8); out[i] = d; take(busy, L[i][0], d); take(busy, L[i][1], d) }
  return out
}
// the league phase table after `k` matchdays (his own matches as played: `mine`); after the eighth, the result's
export function uclTableAt(leaguePhase, mds, k, standings, mine = null, us = null) {
  if (k >= 8 || !leaguePhase?.length) return standings
  const by = new Map((standings ?? []).map(r => [r.short, blank(r)]))
  leaguePhase.forEach(([h, a, hs, as], i) => {
    if ((mds[i] ?? 9) > k) return
    if (mine && us && i < 8) return
    addTo(by, h, a, hs, as)
  })
  if (mine && us) for (const g of mine.slice(0, k)) { if (g.home) addTo(by, us, g.opponent, g.mySc, g.oppSc); else addTo(by, g.opponent, us, g.oppSc, g.mySc) }
  const rows = sortRows([...by.values()].map(r => ({ ...r, gd: r.gf - r.ga })))
  return rows.map((r, i) => ({ ...r, pos: i + 1 }))
}
// matchday k's other results, the big clubs' first (pot 1, then 2)
export function uclRoundOf(leaguePhase, mds, k, standings, n = 4) {
  const pot = new Map((standings ?? []).map(r => [r.short, r.pot ?? 4]))
  return (leaguePhase ?? []).map((x, i) => ({ x, i })).filter(({ x, i }) => i >= 8 && mds[i] === k)
    .sort((p, q) => Math.min(pot.get(p.x[0]) ?? 4, pot.get(p.x[1]) ?? 4) - Math.min(pot.get(q.x[0]) ?? 4, pot.get(q.x[1]) ?? 4))
    .slice(0, n).map(({ x }) => x)
}
