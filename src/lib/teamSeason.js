// SQUAD BUILDER: the team season engine (lib/squadSeason.js builds its inputs and keeps its results).
//
// One season played as ONE team: the squad's builds at their spots and the team's real players
// everywhere else, the depth that plays included (RB2, WR3, TE2, the line's rotation, the nickel;
// basketball's bench). Every game gets a box score for every man in the rotation, and the box score
// adds up to the game:
//   • football: the score is split into touchdowns and field goals; team yards follow the points;
//     the QB's passing is the team's passing is every catch added up, carries and rushing yards are
//     split between the backs and the QB's scrambles, and every touchdown goes to a catch or a carry
//     (a pick-six to the defender who made it). The defense splits sacks, picks, breakups, tackles
//     and TFL by role and rating, at realistic team totals for a game.
//   • basketball: the minutes come to 240 (265 with an overtime), every made shot belongs to a man
//     so the points add up to the score, and the rebounds, assists, steals and blocks are split by
//     role, minutes and ratings.
// A player's share comes from his ratings (the same 0–11 traits for a build and a real player) and his
// role; the team's volume comes from the score. So a 99 WR draws the most targets, a weak QB still
// caps what there is to catch, and a great QB lifts everyone's line.
//
// Pure and seeded: the same roster snapshot, schedule and seed always give the same season, so a
// result keeps only season totals and any game's box score is played again on demand (seasonBox).
// No Math.random here.

import { seeded } from './rng'

// The engine's version: a stored season is played back for its box scores only by the same engine
export const EV = 1

// Every rating a position has, in a fixed order (a snapshot keeps them as an array in this order)
export const KEYS = {
  qb: ['arm', 'legs', 'size', 'processing', 'leadership', 'vision', 'playmaking', 'accuracy', 'pocket-presence'],
  rb: ['speed', 'burst', 'strength', 'size', 'balance', 'elusiveness', 'vision', 'hands', 'carrying'],
  wr: ['speed', 'bodyControl', 'vertical', 'routeRunning', 'release', 'hands', 'awareness', 'size', 'afterCatch'],
  te: ['speed', 'blocking', 'vertical', 'routeRunning', 'strength', 'hands', 'awareness', 'size', 'afterCatch'],
  db: ['speed', 'size', 'fluidity', 'press', 'hands', 'zoneIQ', 'manCoverage', 'playRecognition', 'runSupport'],
  dl: ['getOff', 'speed', 'size', 'powerMoves', 'finesseMoves', 'strength', 'playRecognition', 'bend', 'blockShed'],
  lb: ['range', 'size', 'power', 'tackling', 'blockShed', 'zoneInstincts', 'passRush', 'playRecognition', 'leadership'],
  ol: ['size', 'length', 'anchor', 'passPro', 'runBlock', 'mobility', 'blitzPickup', 'discipline', 'pancake'],
  guard: ['jumpShot', 'finishing', 'passing', 'handles', 'perimeterDefense', 'speed', 'bounce', 'size', 'basketballIQ', 'clutch'],
  big: ['jumpShot', 'finishing', 'rebounding', 'playmaking', 'interiorDefense', 'speed', 'bounce', 'size', 'basketballIQ', 'clutch'],
}
// a snapshot's ratings back to { trait: value } (a rating it doesn't have reads as 5, as in the sims)
const attrsOf = p => Object.fromEntries((KEYS[p.pos] ?? []).map((k, i) => [k, p.a?.[i] ?? 5]))

// ── Seeded randomness ────────────────────────────────────────────────────────
function rngOf(str) {
  const u = seeded(str)
  const n = () => { let a = u(); if (a < 1e-12) a = 1e-12; return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u()) }
  const ln = s => Math.exp(s * n() - (s * s) / 2)                     // mean 1
  const poi = lam => {
    if (!(lam > 0)) return 0
    if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * n()))
    const L = Math.exp(-lam); let k = 0, p = 1
    do { k++; p *= u() } while (p > L)
    return k - 1
  }
  const bin = (m, p) => { let c = 0; for (let i = 0; i < m; i++) if (u() < p) c++; return c }
  const pick = w => {
    let tot = 0
    for (const x of w) tot += x > 0 ? x : 0
    if (!(tot > 0)) return -1
    let r = u() * tot
    for (let i = 0; i < w.length; i++) { const x = w[i] > 0 ? w[i] : 0; if (r < x) return i; r -= x }
    for (let i = w.length - 1; i >= 0; i--) if (w[i] > 0) return i
    return -1
  }
  return { u, n, ln, poi, bin, pick }
}
const clamp = (lo, hi, v) => Math.min(hi, Math.max(lo, v))
const sum = a => a.reduce((x, y) => x + y, 0)
// `total` split into whole numbers in proportion to `w` (largest remainder, ties to the first)
function apportion(total, w) {
  const W = sum(w.map(x => (x > 0 ? x : 0)))
  const out = w.map(() => 0)
  if (!(W > 0) || !total) return out
  const raw = w.map(x => ((x > 0 ? x : 0) / W) * total)
  const fl = raw.map(Math.floor)
  let left = total - sum(fl)
  const order = raw.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (let j = 0; left > 0 && j < order.length; j++, left--) fl[order[j][1]]++
  return fl
}
// n items, each to one of the weighted slots, a slot taking no more than its cap
function deal(R, n, w, cap = null) {
  const got = w.map(() => 0)
  for (let k = 0; k < n; k++) {
    const i = R.pick(w.map((x, j) => (cap && got[j] >= cap[j] ? 0 : x)))
    if (i < 0) break
    got[i]++
  }
  return got
}
const add = (o, k, v) => { if (v) o[k] = (o[k] ?? 0) + v }

// ══════════════════════════════════════════════════════════════════════════════
// FOOTBALL
// ══════════════════════════════════════════════════════════════════════════════
// What each man is good at, 0–1, from his ratings (the same blends the position sims use)
function fbSkills(p) {
  const A = attrsOf(p), N = k => clamp(0, 1.1, (A[k] ?? 5) / 11)
  if (p.pos === 'qb') {
    const arm = N('arm'), legs = N('legs'), sz = N('size'), proc = N('processing'), vis = N('vision'), play = N('playmaking'), acc = N('accuracy'), pock = N('pocket-presence')
    return {
      ypa: arm * 0.32 + acc * 0.30 + vis * 0.18 + pock * 0.10 + proc * 0.10,
      comp: acc * 0.52 + vis * 0.18 + proc * 0.16 + pock * 0.14,
      td: acc * 0.30 + vis * 0.25 + proc * 0.25 + arm * 0.10 + play * 0.10,
      intAvoid: proc * 0.45 + acc * 0.28 + pock * 0.15 + vis * 0.12,
      sackAvoid: pock * 0.55 + legs * 0.30 + proc * 0.15,
      legs: legs * 0.75 + play * 0.15 + sz * 0.10,
      sneak: legs * 0.4 + sz * 0.6,
    }
  }
  if (p.pos === 'rb') {
    const spd = N('speed'), bur = N('burst'), str = N('strength'), sz = N('size'), bal = N('balance'), elu = N('elusiveness'), vis = N('vision'), hnd = N('hands'), car = N('carrying')
    return {
      run: vis * 0.20 + bur * 0.17 + elu * 0.17 + spd * 0.14 + bal * 0.14 + str * 0.10 + sz * 0.08,
      tgt: hnd * 0.60 + elu * 0.20 + spd * 0.20,
      catch: hnd * 0.75 + vis * 0.25,
      ypr: spd * 0.35 + elu * 0.35 + bur * 0.30,
      rz: hnd * 0.5 + sz * 0.25 + str * 0.25,
      gl: str * 0.35 + sz * 0.30 + bal * 0.15 + vis * 0.10 + car * 0.10,
    }
  }
  if (p.pos === 'wr') {
    const spd = N('speed'), bod = N('bodyControl'), vrt = N('vertical'), rte = N('routeRunning'), rel = N('release'), hnd = N('hands'), awr = N('awareness'), sz = N('size'), yac = N('afterCatch')
    return {
      tgt: rte * 0.30 + rel * 0.17 + hnd * 0.17 + awr * 0.12 + bod * 0.10 + yac * 0.08 + spd * 0.06,
      catch: hnd * 0.55 + rte * 0.20 + awr * 0.15 + bod * 0.10,
      ypr: clamp(0, 1.1, spd * 0.40 + yac * 0.25 + vrt * 0.15 + bod * 0.10 + rte * 0.10 - (sz - 0.5) * 0.10),
      rz: sz * 0.35 + vrt * 0.30 + hnd * 0.20 + rte * 0.15,
    }
  }
  if (p.pos === 'te') {
    const spd = N('speed'), blk = N('blocking'), vrt = N('vertical'), rte = N('routeRunning'), str = N('strength'), hnd = N('hands'), awr = N('awareness'), sz = N('size'), yac = N('afterCatch')
    return {
      tgt: clamp(0, 1.1, rte * 0.32 + hnd * 0.24 + awr * 0.16 + spd * 0.14 + yac * 0.08 + sz * 0.06 - (blk - 0.5) * 0.06),
      catch: hnd * 0.55 + rte * 0.20 + awr * 0.15 + sz * 0.10,
      ypr: spd * 0.35 + yac * 0.30 + vrt * 0.15 + rte * 0.20,
      rz: sz * 0.30 + hnd * 0.25 + vrt * 0.20 + rte * 0.15 + str * 0.10,
      block: blk * 0.7 + str * 0.3,
    }
  }
  if (p.pos === 'dl') {
    const get = N('getOff'), spd = N('speed'), sz = N('size'), pwr = N('powerMoves'), fin = N('finesseMoves'), str = N('strength'), rec = N('playRecognition'), bnd = N('bend'), shd = N('blockShed')
    const edge = p.sub !== 'dt'
    return {
      rush: edge ? get * 0.26 + bnd * 0.22 + fin * 0.18 + pwr * 0.12 + spd * 0.12 + shd * 0.05 + rec * 0.03 + str * 0.02
        : pwr * 0.26 + get * 0.24 + fin * 0.14 + str * 0.10 + sz * 0.04 + shd * 0.10 + bnd * 0.06 + rec * 0.04 + spd * 0.02,
      tkl: edge ? shd * 0.28 + rec * 0.22 + spd * 0.18 + str * 0.10 + sz * 0.04 + get * 0.08 + bnd * 0.04 + pwr * 0.04 + fin * 0.02
        : shd * 0.30 + str * 0.18 + sz * 0.08 + rec * 0.22 + get * 0.08 + pwr * 0.08 + spd * 0.04 + bnd * 0.01 + fin * 0.01,
      tfl: get * 0.28 + shd * 0.24 + rec * 0.18 + pwr * 0.10 + str * 0.05 + sz * 0.03 + fin * 0.05 + spd * 0.04 + bnd * 0.03,
      ff: fin * 0.25 + get * 0.20 + spd * 0.20 + shd * 0.15 + bnd * 0.08 + rec * 0.05 + pwr * 0.05 + str * 0.02,
      pbu: rec * 0.36 + shd * 0.16 + get * 0.14 + str * 0.10 + pwr * 0.08 + fin * 0.06 + bnd * 0.05 + spd * 0.05,
      int: rec * 0.2, cov: rec * 0.2, p6: 0.04,
    }
  }
  if (p.pos === 'lb') {
    const rng = N('range'), sz = N('size'), pwr = N('power'), tkl = N('tackling'), shd = N('blockShed'), zon = N('zoneInstincts'), rsh = N('passRush'), rec = N('playRecognition'), ldr = N('leadership')
    return {
      tkl: rng * 0.30 + tkl * 0.30 + rec * 0.14 + shd * 0.12 + pwr * 0.05 + sz * 0.05 + zon * 0.04,
      rush: rsh * 0.55 + rng * 0.12 + pwr * 0.12 + rec * 0.11 + shd * 0.10,
      tfl: shd * 0.30 + pwr * 0.22 + rec * 0.18 + rng * 0.12 + tkl * 0.10 + sz * 0.08,
      cov: zon * 0.48 + rng * 0.26 + rec * 0.20 + sz * 0.03 + ldr * 0.03,
      int: zon * 0.52 + rec * 0.26 + rng * 0.16 + ldr * 0.06,
      ff: tkl * 0.28 + pwr * 0.30 + rsh * 0.14 + rng * 0.14 + rec * 0.10 + sz * 0.04,
      pbu: zon * 0.48 + rng * 0.26 + rec * 0.26,
      p6: 0.08 + rng * 0.05,
    }
  }
  if (p.pos === 'ol') {
    const sz = N('size'), len = N('length'), anc = N('anchor'), pp = N('passPro'), rb = N('runBlock'), mob = N('mobility'), blz = N('blitzPickup'), dis = N('discipline'), pnk = N('pancake')
    return {
      pass: pp * 0.38 + anc * 0.18 + len * 0.14 + blz * 0.12 + mob * 0.10 + sz * 0.08,
      run: rb * 0.40 + pnk * 0.18 + sz * 0.14 + anc * 0.12 + mob * 0.10 + len * 0.06,
      pnk: pnk * 0.60 + rb * 0.25 + sz * 0.15,
      disc: dis,
    }
  }
  if (p.pos === 'db') {
    const spd = N('speed'), sz = N('size'), flu = N('fluidity'), prs = N('press'), hnd = N('hands'), ziq = N('zoneIQ'), man = N('manCoverage'), prk = N('playRecognition'), rus = N('runSupport')
    return {
      int: hnd * 0.30 + ziq * 0.25 + prk * 0.20 + man * 0.12 + flu * 0.08 + prs * 0.03 + spd * 0.02,
      pbu: flu * 0.28 + man * 0.25 + prs * 0.18 + hnd * 0.12 + ziq * 0.10 + spd * 0.05 + prk * 0.02,
      tkl: rus * 0.36 + prk * 0.18 + spd * 0.16 + sz * 0.10 + ziq * 0.09 + flu * 0.05 + prs * 0.03 + man * 0.03,
      tfl: rus * 0.35 + sz * 0.25 + prk * 0.25 + spd * 0.10 + prs * 0.05,
      ff: rus * 0.30 + hnd * 0.20 + prk * 0.15 + sz * 0.15 + spd * 0.10 + prs * 0.10,
      cov: man * 0.35 + flu * 0.25 + ziq * 0.25 + spd * 0.15,
      rush: spd * 0.4 + rus * 0.3 + sz * 0.3,
      p6: Math.min(0.2, 0.02 + spd * 0.08 + prk * 0.06),
    }
  }
  return {}
}

// The rotation by role. A snapshot man carries `st` (1 starts) and `d` (his order at the position).
const byPos = (P, pos) => P.filter(p => p.pos === pos).sort((a, b) => a.d - b.d)
// how much of each thing comes a man's way for his job (before his ratings)
function fbRoles(P) {
  const role = new Map()
  const set = (p, r) => role.set(p.k, { ...{ tgt: 0, car: 0, sack: 0, int: 0, pbu: 0, tfl: 0, tkl: 0 }, ...r })
  byPos(P, 'qb').forEach(p => set(p, {}))
  byPos(P, 'rb').forEach((p, i) => set(p, { car: [0.58, 0.36, 0.08][i] ?? 0.03, tgt: [0.40, 0.20, 0.05][i] ?? 0.02 }))
  const wr = byPos(P, 'wr'), nWr = wr.filter(p => p.st).length
  wr.forEach((p, i) => set(p, { tgt: p.st ? ([1, 0.86, 0.68][i] ?? 0.6) : ([0.22, 0.09][i - nWr] ?? 0.03) }))
  byPos(P, 'te').forEach((p, i) => set(p, { tgt: [0.70, 0.22, 0.06][i] ?? 0.03 }))
  byPos(P, 'dl').forEach(p => {
    const edge = p.sub !== 'dt'
    set(p, p.st
      ? { sack: edge ? 0.85 : 0.62, tfl: edge ? 1 : 1.05, tkl: edge ? 1.6 : 1.5, pbu: edge ? 0.12 : 0.14, int: 0.02 }
      : { sack: edge ? 0.7 : 0.45, tfl: 0.45, tkl: 0.95, pbu: 0.05, int: 0.01 })
  })
  byPos(P, 'lb').forEach((p, i) => set(p, p.st
    ? { sack: [0.28, 0.20, 0.16][i] ?? 0.12, tfl: [0.95, 0.80, 0.70][i] ?? 0.6, tkl: [5.8, 5.0, 3.4][i] ?? 3, int: [0.42, 0.32, 0.25][i] ?? 0.2, pbu: [0.30, 0.25, 0.20][i] ?? 0.15 }
    : { sack: 0.05, tfl: 0.2, tkl: 0.8, int: 0.06, pbu: 0.05 }))
  const db = byPos(P, 'db')
  let res = 0
  db.forEach(p => {
    const s = p.sub === 's'
    if (p.st) set(p, s ? { int: 1.15, pbu: 0.65, tfl: 0.30, tkl: 4.8, sack: 0.08 } : { int: 1.0, pbu: 1.0, tfl: 0.12, tkl: 3.2, sack: 0.04 })
    else { set(p, res === 0 ? { int: 0.55, pbu: 0.65, tfl: 0.15, tkl: 2.8, sack: 0.06 } : { int: 0.2, pbu: 0.2, tfl: 0.05, tkl: 0.9, sack: 0.01 }); res++ }
  })
  return role
}

// A score as touchdowns (with the kick), field goals, the odd two-point try and safety
export function splitScore(pts) {
  let best = null
  for (let td = Math.floor(pts / 6); td >= 0; td--) {
    for (let e = 0; e <= 2 * td; e++) {
      const left = pts - 6 * td - e
      if (left < 0) continue
      for (let sf = 0; sf <= 1; sf++) {
        const r = left - 2 * sf
        if (r < 0 || r % 3) continue
        const fg = r / 3
        if (fg > 7) continue
        // e extra points over td touchdowns: kicks, and past one a touchdown two-point tries
        const two = Math.max(0, e - td), xp = e - 2 * two, missed = td - xp - two
        if (xp < 0 || missed < 0) continue
        const odd = missed * 2 + two * 1.5 + sf * 3 + Math.max(0, fg - 4) - td * 0.01
        if (!best || odd < best.odd) best = { td, xp, two, fg, sf, odd }
      }
    }
  }
  return best ?? { td: 0, xp: 0, two: 0, fg: 0, sf: 0 }
}

function fbGame(P, role, luck, g, ctx) {
  const R = rngOf(`${ctx.seed}:fb:${ctx.po ? 'p' : 'g'}${ctx.i}`)
  const S = g.mySc ?? 0, A = g.oppSc ?? 0
  const off = ctx.off, def = ctx.def
  const s = Object.fromEntries(P.map(p => [p.k, {}]))
  const us = { pts: S }, them = { pts: A }
  const mine = splitScore(S), theirs = splitScore(A)
  us.td = mine.td; us.fg = mine.fg; them.td = theirs.td; them.fg = theirs.fg
  if (mine.sf) us.sf = mine.sf

  const qb = byPos(P, 'qb')[0]
  const rbs = byPos(P, 'rb'), rec = P.filter(p => (p.pos === 'wr' || p.pos === 'te' || p.pos === 'rb'))
  const dfn = P.filter(p => p.pos === 'dl' || p.pos === 'lb' || p.pos === 'db')
  const sk = p => p.sk
  const r = p => role.get(p.k)
  const L = p => luck.get(p.k) ?? 1

  // ── The defense first (a pick-six is one of the touchdowns) ──
  const lead = S - A
  const oppYds = Math.round(clamp(110, 640, 160 + 7.8 * A + R.n() * 38))
  const oppPs = clamp(0.4, 0.82, 0.62 + 0.004 * lead + R.n() * 0.04)
  const oppPass = Math.round(oppYds * oppPs), oppRush = oppYds - oppPass
  const oppAtt = Math.round(clamp(14, 62, oppPass / clamp(4.5, 10, 6.7 + R.n() * 0.7)))
  const cov = ctx.cov, rushIdx = ctx.rushIdx
  const oppCmp = Math.min(oppAtt - 1, Math.round(oppAtt * clamp(0.45, 0.82, 0.645 - 0.07 * (cov - 0.55) + R.n() * 0.05)))
  const oppCar = Math.round(clamp(10, 45, oppRush / clamp(2.6, 6.5, 4.3 + R.n() * 0.5)))
  const passMore = clamp(0.75, 1.35, 1 + 0.012 * lead)
  let sacks = Math.min(10, R.poi(clamp(0.6, 4.4, ctx.sackLam * passMore)))
  let ints = Math.min(6, R.poi(clamp(0.15, 2.4, ctx.intLam * clamp(0.55, 1.45, 1.38 - 0.018 * A) * passMore)))
  ints = Math.min(ints, Math.max(0, oppAtt - oppCmp))
  const pbus = Math.min(Math.max(0, oppAtt - oppCmp - ints), R.poi(ctx.pbuLam * (oppAtt / 34)))
  const hits = R.poi(clamp(1, 7, 1.6 + 2.6 * rushIdx) * passMore)
  const runTfl = R.poi(ctx.tflLam * (oppCar / 26))
  // who got them
  const heat = p => (p.pos === 'dl' ? 1 / (1 + 0.22 * Math.max(0, (ctx.run.sacks.get(p.k) ?? 0) - (p.sub === 'dt' ? 11 : 13))) : 1)
  const wSack = dfn.map(p => r(p).sack * Math.pow(sk(p).rush ?? 0.3, 1.6) * L(p) * heat(p))
  const wInt = dfn.map(p => r(p).int * Math.pow(sk(p).int ?? 0.3, 2) * L(p))
  const wPbu = dfn.map(p => r(p).pbu * Math.pow(sk(p).pbu ?? 0.3, 1.6) * L(p))
  const wTfl = dfn.map(p => r(p).tfl * Math.pow(sk(p).tfl ?? 0.3, 1.5))
  const sackBy = deal(R, sacks, wSack), intBy = deal(R, ints, wInt), pbuBy = deal(R, pbus, wPbu)
  const hitBy = deal(R, hits, wSack), tflBy = deal(R, runTfl, wTfl)
  const tklVol = (oppCar + oppCmp) / 46
  let p6 = 0, ff = 0, fr = 0
  dfn.forEach((p, i) => {
    const o = s[p.k], x = sk(p)
    let sackTfl = 0, strips = 0
    for (let k = 0; k < sackBy[i]; k++) { if (R.u() < 0.85) sackTfl++; if (R.u() < Math.min(0.24, 0.06 + (x.ff ?? 0.3) * 0.12)) strips++ }
    for (let k = 0; k < intBy[i]; k++) if (p6 < mine.td && R.u() < (x.p6 ?? 0.04) * 0.8) { p6++; add(o, 'p6', 1) }
    const other = R.poi(r(p).tkl * (0.65 + 0.7 * (x.tkl ?? 0.4)) * tklVol)
    const strip = strips + R.poi(0.045 * (r(p).tkl / 4) * (0.5 + (x.ff ?? 0.3)))
    add(o, 'tk', other + sackBy[i] + tflBy[i])
    add(o, 'sck', sackBy[i]); add(o, 'tfl', sackTfl + tflBy[i]); add(o, 'qbh', sackBy[i] + hitBy[i])
    add(o, 'dint', intBy[i]); add(o, 'pbu', pbuBy[i]); add(o, 'ff', strip)
    ff += strip
  })
  // a loose ball: about half come back to the defense, to whoever is there
  for (let k = 0; k < ff; k++) if (R.u() < 0.5) { const i = R.pick(dfn.map(p => r(p).tkl + 0.3)); if (i >= 0) { add(s[dfn[i].k], 'fr', 1); fr++ } }
  sacks = sum(sackBy)
  dfn.forEach(p => { const n = s[p.k].sck ?? 0; if (n) ctx.run.sacks.set(p.k, (ctx.run.sacks.get(p.k) ?? 0) + n) })
  Object.assign(them, { yds: oppYds, py: oppPass, ry: oppRush, pa: oppAtt, pc: oppCmp, ra: oppCar, sk: sacks, int: ints, fum: fr, to: ints + fr })
  if (p6) us.dtd = p6

  // ── The offense ──
  const q = qb ? sk(qb) : { ypa: 0.45, comp: 0.45, td: 0.45, intAvoid: 0.45, sackAvoid: 0.45, legs: 0.3, sneak: 0.4 }
  // the volume comes from the game: a team behind throws, a team ahead runs; a better passer
  // throws a bit more and a better back gets a bit more of the ball
  const att = Math.round(clamp(16, 58, 33.5 - 0.2 * lead + 6 * (q.ypa - ctx.qbMid) - 4 * (ctx.runQ - 0.55) + R.n() * 4.2))
  const rbCarT = rbs.length ? Math.round(clamp(8, 42, 24.5 + 0.18 * lead + 6 * (ctx.runQ - 0.55) - 3 * (q.ypa - ctx.qbMid) + R.n() * 3.5)) : 0
  // …and the yards from how good they are at it (and how well the day went: points and yards go together)
  // (the line: olPass / olRun are the squad's line against the team's real one, 0 without an OL build)
  const ypa = clamp(3.5, 12, ctx.ypaBase + 2.6 * (q.ypa - ctx.qbMid) + 0.8 * (ctx.recQ - 0.55) + 0.09 * (S - 23) + R.n() * 0.75 + 1.2 * ctx.olPass)
  let passYds = Math.round(att * ypa)
  const cmpPct = clamp(0.38, 0.86, ctx.compBase + 0.22 * (q.comp - ctx.qbMid) + 0.06 * (ctx.catchQ - 0.55) + R.n() * 0.05 + 0.04 * ctx.olPass)
  let cmp = Math.max(1, Math.round(att * cmpPct))
  const sacked = Math.min(10, R.poi(clamp(0.5, 5, 3.3 - 2.0 * q.sackAvoid - 0.16 * (off - 6) - 3.0 * ctx.olPass)))
  const intT = Math.min(5, R.poi(att * Math.max(0.008, 0.036 - 0.024 * q.intAvoid) * (1 + 0.03 * Math.max(0, -lead) / 7)))
  const fum = R.poi(0.42)
  // the QB's scrambles, then the backs' carries
  const qbCar = qb ? R.poi(0.8 + 7.5 * Math.pow(q.legs, 2.6)) : 0
  const qbRy = qbCar ? Math.round(clamp(-2 * qbCar, 170, qbCar * (2.2 + 4.8 * q.legs) * R.ln(0.35))) : 0
  const ypc = clamp(2.0, 7.5, 3.2 + 1.9 * ctx.runQ + 0.10 * (off - 6) + 0.25 * (ctx.teBlock - 0.5) + 0.04 * (S - 23) + R.n() * 0.5 + 1.6 * ctx.olRun)
  const pool = Math.round(rbCarT * ypc)
  const carBy = deal(R, rbCarT, rbs.map(p => r(p).car * Math.pow(0.35 + sk(p).run, 1.6) * L(p)))
  const rawRy = rbs.map((p, i) => carBy[i] * (2.4 + 2.6 * sk(p).run) * R.ln(0.3))
  const ryBy = rbs.length ? apportion(Math.max(0, pool), rawRy) : []
  const rushYds = pool + qbRy
  // the targets, then which of them were caught (exactly the completions)
  // (one receiver only draws so much of it: past 27% of the targets, each extra share counts for less)
  const wRaw = rec.map(p => r(p).tgt * Math.pow(0.35 + sk(p).tgt, 1.15) * L(p)), wSum = sum(wRaw) || 1
  const wTgt = softCap(wRaw.map(x => x / wSum), 0.27, 0.3)
  const tgtBy = deal(R, att, wTgt)
  const tickets = []
  rec.forEach((p, i) => { const pc = clamp(0.3, 0.93, cmpPct * (0.80 + 0.5 * (sk(p).catch - 0.55)) * (p.pos === 'rb' ? 1.12 : p.pos === 'te' ? 1.05 : 0.96)); for (let k = 0; k < tgtBy[i]; k++) tickets.push([i, pc]) })
  cmp = Math.min(cmp, tickets.length)
  const recBy = rec.map(() => 0)
  for (let k = 0; k < cmp; k++) {
    const j = R.pick(tickets.map(t => t[1]))
    if (j < 0) break
    recBy[tickets[j][0]]++; tickets.splice(j, 1)
  }
  const yBase = { wr: 13.0, te: 10.8, rb: 7.6 }
  const rawYd = rec.map((p, i) => recBy[i] * yBase[p.pos] * (0.75 + 0.55 * sk(p).ypr) * R.ln(0.35))
  if (cmp === 0) passYds = 0
  const recYd = apportion(passYds, rawYd)
  // touchdowns: the defense's first, then catches and carries
  const offTd = mine.td - p6
  const pShare = clamp(0.35, 0.84, 0.64 + 0.30 * (q.td - ctx.qbMid) - 0.18 * (ctx.glQ - 0.5))
  const tdCatch = rec.map(() => 0), tdRun = rbs.map(() => 0)
  let qbRtd = 0, ptd = 0
  const carriers = [...rbs.map((p, i) => carBy[i]), qbCar]
  for (let k = 0; k < offTd; k++) {
    const canPass = sum(recBy) > ptd, canRun = sum(carriers) > sum(tdRun) + qbRtd
    const pass = canPass && (!canRun || R.u() < pShare)
    if (pass) {
      const i = R.pick(rec.map((p, j) => (tdCatch[j] < recBy[j] ? recBy[j] * (p.pos === 'te' ? 1.25 : p.pos === 'rb' ? 0.55 : 1) * (0.45 + sk(p).rz) : 0)))
      if (i >= 0) { tdCatch[i]++; ptd++ }
    } else if (canRun) {
      const w = [...rbs.map((p, j) => (tdRun[j] < carBy[j] ? carBy[j] * (0.5 + sk(p).gl) : 0)), qbRtd < qbCar ? qbCar * (0.25 + 0.5 * q.sneak) : 0]
      const i = R.pick(w)
      if (i === rbs.length) qbRtd++
      else if (i >= 0) tdRun[i]++
    }
  }
  if (qb) {
    const o = s[qb.k]
    add(o, 'pa', att); add(o, 'pc', cmp); add(o, 'py', passYds); add(o, 'ptd', ptd); add(o, 'int', intT); add(o, 'sk', sacked)
    add(o, 'ra', qbCar); add(o, 'ry', qbRy); add(o, 'rtd', qbRtd)
  }
  rbs.forEach((p, i) => { const o = s[p.k]; add(o, 'ra', carBy[i]); add(o, 'ry', ryBy[i]); add(o, 'rtd', tdRun[i]) })
  rec.forEach((p, i) => { const o = s[p.k]; add(o, 'tg', tgtBy[i]); add(o, 'rc', recBy[i]); add(o, 'ryd', recYd[i]); add(o, 'rctd', tdCatch[i]) })
  // what the touchdowns came to (a touchdown that had no catch or carry left to be is a return)
  const rtd = qbRtd + sum(tdRun)
  const ret = offTd - ptd - rtd
  Object.assign(us, { yds: passYds + rushYds, py: passYds, ry: rushYds, pa: att, pc: cmp, ra: qbCar + sum(carBy), ptd, rtd, int: intT, fum, to: intT + fum, sk: sacked })
  if (ret > 0) us.rettd = ret
  olGame(P, s, ctx, { att, sacked, runs: qbCar + sum(carBy) })
  return { s, us, them }
}

// The line's game, on its own seeded stream (so a squad without the line plays exactly as before):
// every snap, the sacks the team gave up (most on a lineman, the rest on a back, a tight end or the
// QB holding it), the pressures and hits behind them, pancakes on the runs, holds and false starts.
//   sn snaps · pbs pass-block snaps · rbs run-block snaps · sa sacks allowed · prs pressures (sacks
//   included) · qbha QB hits allowed · pnk pancakes · hold · fst false starts · pen penalties
const OL_SPOT_W = { LT: 1.25, RT: 1.15, LG: 0.95, RG: 0.95, C: 0.8 }
function olGame(P, s, ctx, { att, sacked, runs }) {
  const line = P.filter(p => p.pos === 'ol')
  if (!line.length) return
  const R = rngOf(`${ctx.seed}:fb:ol:${ctx.po ? 'p' : 'g'}${ctx.i}`)
  const pbs = att + sacked, rbs = runs, sn = pbs + rbs + R.poi(2.5)   // (and the kneels, spikes and the penalties that wiped a play out)
  const weak = line.map(p => Math.pow(clamp(0.05, 1.1, 1.08 - p.sk.pass), 1.7) * (OL_SPOT_W[p.sub] ?? 1))
  const lineQ = sum(line.map(p => p.sk.pass)) / line.length
  // about seven in ten sacks are on the line; the rest go to the "other" slot (index line.length)
  const lineShare = clamp(0.45, 0.85, 0.72 - 0.25 * (lineQ - 0.55)) * (line.length / 5)
  const other = (sum(weak) * (1 - lineShare)) / Math.max(0.05, lineShare)
  const saBy = deal(R, sacked, [...weak, other]).slice(0, line.length)
  // pressures: a share of the dropbacks, more against a weaker line
  const prsT = R.poi(pbs * clamp(0.12, 0.42, 0.27 - 0.30 * (lineQ - 0.55)) * (line.length / 5))
  const prsBy = deal(R, prsT, weak)
  line.forEach((p, i) => {
    const o = s[p.k], x = p.sk
    const prs = prsBy[i] + saBy[i]
    const hits = Math.min(Math.max(0, prs - saBy[i]), R.poi(prsBy[i] * 0.22))
    const pnk = R.poi((rbs / 26) * (0.4 + 2.2 * Math.pow(x.pnk, 1.6)) * (0.8 + 0.4 * (OL_SPOT_W[p.sub] ?? 1) / 1.25))
    const hold = R.poi((sn / 65) * clamp(0.04, 0.5, 0.34 - 0.27 * x.disc))
    const fst = R.poi((sn / 65) * clamp(0.02, 0.35, (p.sub === 'LT' || p.sub === 'RT' ? 0.22 : 0.13) - (p.sub === 'LT' || p.sub === 'RT' ? 0.17 : 0.10) * x.disc))
    add(o, 'sn', sn); add(o, 'pbs', pbs); add(o, 'rbs', rbs)
    add(o, 'sa', saBy[i]); add(o, 'prs', prs); add(o, 'qbha', hits + saBy[i]); add(o, 'pnk', pnk)
    add(o, 'hold', hold); add(o, 'fst', fst); add(o, 'pen', hold + fst)
  })
}
// A lineman's season grade, PFF style (0–100): pass blocking from his pressure and sack rate, run
// blocking from his pancakes a run, less a little for every flag
export function olGrades(t = {}) {
  const g = k => t[k] ?? 0
  const pbs = Math.max(1, g('pbs')), rbs = Math.max(1, g('rbs'))
  const pass = clamp(30, 99, 96 - (g('prs') / pbs - 0.025) * 620 - (g('sa') / pbs) * 900)
  const run = clamp(30, 99, 42 + (g('pnk') / rbs) * 430)
  const all = clamp(30, 99, pass * 0.6 + run * 0.4 - Math.max(0, g('pen') - 3) * 0.9)
  return { pass: Math.round(pass * 10) / 10, run: Math.round(run * 10) / 10, all: Math.round(all * 10) / 10 }
}
// How good a line is at each job, 0–1 (snapshots, the way the engine reads them; the LT counts most)
export function olLineQ(men) {
  const line = (men ?? []).filter(p => p.pos === 'ol').map(p => ({ ...p, sk: fbSkills(p) }))
  if (!line.length) return null
  const w = p => OL_SPOT_W[p.sub] ?? 1, W = sum(line.map(w))
  return { pass: sum(line.map(p => w(p) * p.sk.pass)) / W, run: sum(line.map(p => w(p) * p.sk.run)) / W }
}

function fbTeamCtx(P, role, strength) {
  const pick = (pos, f) => byPos(P, pos).map(f)
  const wavg = (ps, w, f) => { const W = sum(ps.map(w)); return W > 0 ? sum(ps.map(p => w(p) * f(p))) / W : 0.5 }
  const rbs = byPos(P, 'rb'), rec = P.filter(p => p.pos === 'wr' || p.pos === 'te' || p.pos === 'rb')
  const dfn = P.filter(p => p.pos === 'dl' || p.pos === 'lb' || p.pos === 'db')
  const rl = p => role.get(p.k)
  const runQ = rbs.length ? wavg(rbs, p => rl(p).car, p => p.sk.run) : 0.4
  const glQ = rbs.length ? wavg(rbs, p => rl(p).car, p => p.sk.gl) : 0.4
  const recQ = rec.length ? wavg(rec, p => rl(p).tgt, p => (p.sk.tgt + p.sk.ypr) / 2) : 0.5
  const catchQ = rec.length ? wavg(rec, p => rl(p).tgt, p => p.sk.catch) : 0.5
  const teBlock = (pick('te', p => p.sk.block)[0]) ?? 0.5
  // the front and the back against an average team's (a rating of 0.55 at every job)
  const rushIdx = clamp(0, 1.6, sum(dfn.map(p => rl(p).sack * Math.pow(p.sk.rush ?? 0.3, 1.5))) / Math.max(0.5, sum(dfn.map(p => rl(p).sack * Math.pow(0.55, 1.5)))) * 0.55)
  const covIdx = clamp(0, 1.6, sum(dfn.map(p => rl(p).int * Math.pow(p.sk.int ?? 0.3, 1.5))) / Math.max(0.5, sum(dfn.map(p => rl(p).int * Math.pow(0.55, 1.5)))) * 0.55)
  const pbuIdx = clamp(0, 1.6, sum(dfn.map(p => rl(p).pbu * Math.pow(p.sk.pbu ?? 0.3, 1.5))) / Math.max(0.5, sum(dfn.map(p => rl(p).pbu * Math.pow(0.55, 1.5)))) * 0.55)
  const tflIdx = clamp(0, 1.6, sum(dfn.map(p => rl(p).tfl * Math.pow(p.sk.tfl ?? 0.3, 1.5))) / Math.max(0.5, sum(dfn.map(p => rl(p).tfl * Math.pow(0.55, 1.5)))) * 0.55)
  // without the linebackers on the field (LB is hidden), the line and the secondary keep their own share only
  const lbs = byPos(P, 'lb').length
  // the line against the team's real one (strength.olBase, kept only when the squad has an OL build):
  // the real line is already in the team's numbers, so it moves nothing; a better one moves the offense
  const olQ = strength?.olBase ? olLineQ(P) : null
  const olPass = olQ ? clamp(-0.5, 0.5, olQ.pass - strength.olBase.pass) : 0
  const olRun = olQ ? clamp(-0.5, 0.5, olQ.run - strength.olBase.run) : 0
  return {
    off: strength?.off ?? 6, def: strength?.def ?? 6, olPass, olRun,
    runQ, glQ, recQ, catchQ, teBlock, rushIdx, cov: covIdx,
    qbMid: 0.62, ypaBase: 6.8, compBase: 0.652,
    sackLam: (1.1 + 2.2 * rushIdx) * (lbs ? 1 : 0.92),
    intLam: (0.22 + 1.0 * covIdx) * (lbs ? 1 : 0.94),
    pbuLam: 1.2 + 2.6 * pbuIdx,
    tflLam: (1.2 + 2.6 * tflIdx) * (lbs ? 1 : 0.6),
  }
}

export function playFootballSeason({ roster, games = [], rounds = [], strength = null, seed = 'x' }) {
  const P = roster.map(p => ({ ...p, sk: fbSkills(p) }))
  const role = fbRoles(P)
  const LR = rngOf(`${seed}:fb:luck`)
  const luck = new Map(P.map(p => [p.k, clamp(0.88, 1.12, 1 + LR.n() * 0.06)]))
  const ctx = { ...fbTeamCtx(P, role, strength), seed, run: { sacks: new Map() } }
  const reg = games.map((g, i) => fbGame(P, role, luck, g, { ...ctx, i, po: false }))
  const po = rounds.map((g, i) => fbGame(P, role, luck, g, { ...ctx, i, po: true }))
  return { reg, po, tot: totalsOf(P, reg), poTot: totalsOf(P, po), team: teamTotals(reg) }
}

// ══════════════════════════════════════════════════════════════════════════════
// BASKETBALL
// ══════════════════════════════════════════════════════════════════════════════
function bkSkills(p) {
  const A = attrsOf(p), g = k => A[k] ?? 5
  const big = p.pos === 'big'
  const js = g('jumpShot'), fin = g('finishing'), pm = g('playmaking'), hnd = g('handles'), pas = g('passing'), id = g('interiorDefense')
  const reb = g('rebounding'), pd = g('perimeterDefense'), spd = g('speed'), bnc = g('bounce'), sz = g('size'), iq = g('basketballIQ'), clt = g('clutch')
  // the blends runBucketSimulation reads a build with
  const scoring = big ? fin * 0.50 + js * 0.25 + pm * 0.15 + clt * 0.10 : js * 0.32 + fin * 0.24 + spd * 0.18 + sz * 0.12 + hnd * 0.08 + clt * 0.06
  const rebRaw = big ? reb * 0.55 + sz * 0.30 + bnc * 0.10 + iq * 0.05 : sz * 0.60 + bnc * 0.40
  const astRaw = big ? pm * 0.50 + iq * 0.35 + pas * 0.15 : pas * 0.50 + iq * 0.35 + hnd * 0.15
  const blkRaw = big ? sz * 0.55 + id * 0.28 + bnc * 0.10 + iq * 0.07 : sz * 0.45 + pd * 0.35 + bnc * 0.12 + iq * 0.08
  const stlRaw = big ? pd * 0.35 + iq * 0.35 + spd * 0.30 : pd * 0.55 + iq * 0.35 + spd * 0.10
  const fg = clamp(big ? 42 : 38, big ? 63 : 53, (big ? 42 : 38) + (big ? fin * 0.95 + js * 0.33 + sz * 0.24 + iq * 0.16 : js * 0.45 + fin * 0.38 + hnd * 0.18 + iq * 0.13)) / 100
  const p3 = js === 0 ? 0 : clamp(0, big ? 41 : 45, (big ? 12 : 15) + js * 2.25 + (js >= 2 ? 3 : 0) + iq * 0.25 + spd * 0.15 + sz * 0.10) / 100
  const ft = clamp(52, 99, 52 + js * 2.8 + iq * 1.2 + (big ? 0 : hnd * 0.5)) / 100
  const ts = js === 0 ? 0 : Math.min(0.68, big ? 0.08 + js * 0.035 : 0.24 + js * 0.035)
  const fr = (big ? 0.2 : 0.14) + fin * 0.015
  const p2 = clamp(0.36, 0.72, (fg - ts * p3) / Math.max(0.2, 1 - ts))
  const solo = Math.max(big ? 5 : 4, (big ? -2 : -3.5) + scoring * (big ? 3.5 : 4.0))
  const apg = Math.max(big ? 0.5 : 1, big ? (astRaw >= 8 ? Math.max(0.5, 0.125 * astRaw * astRaw - 0.375 * astRaw) : (3.8 * astRaw + 4.6) / 7) : -1 + astRaw * 1.1)
  const rpg = Math.max(big ? 5 : 1.5, (big ? 4 : 0.5) + rebRaw * (big ? 0.82 : 0.75))
  const sec = big ? (pm + iq) / 2 : (hnd + pas + iq) / 3
  return { use: solo, p2, p3, ft, ts, fr, reb: Math.pow(rpg, 1.25) * (big ? 1.1 : 1), oreb: Math.pow(rpg, 1.5) * (big ? 1.4 : 0.8), ast: Math.pow(apg, 1.5), stl: Math.pow(Math.max(0.2, stlRaw * 0.21), 1.2), blk: Math.pow(Math.max(0.05, (big ? 0.2 : 0) + blkRaw * (big ? 0.27 : 0.13)), 1.8), to: (13 - sec) / 8, solo, astRaw, rebRaw }
}
// How many minutes a man plays on a normal night: a starter's by how good he is, the bench by its order
const q01 = o => clamp(0, 1, ((o ?? 70) - 72) / 27)
export function minutesPlan(roster) {
  const P = roster.filter(p => p.pos === 'guard' || p.pos === 'big')
  const bench = P.filter(p => p.spot == null).sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
  const base = P.map(p => (p.spot != null ? 28 + 6 * q01(p.o) : ([22, 18.5, 15, 10, 5][bench.indexOf(p)] ?? 2) * (0.7 + 0.6 * q01(p.o))))
  const mins = apportion(240, base)
  return Object.fromEntries(P.map((p, i) => [p.k, mins[i]]))
}

// shares that add to 1, with anything over `c` cut back to c + (over × k) and the rest spread to the others
function softCap(share, c, k) {
  const over = share.map(x => (x > c ? c + (x - c) * k : x))
  const cut = sum(share) - sum(over)
  const room = sum(over.map((x, i) => (share[i] > c ? 0 : x)))
  return over.map((x, i) => (share[i] > c || !(room > 0) ? x : x + (cut * x) / room))
}

// A score as threes, free throws and twos, near the threes and free throws expected
function shotSplit(S, e3, eft) {
  let t3 = Math.max(0, Math.round(e3)), ft = Math.max(0, Math.round(eft))
  while (3 * t3 + ft > Math.max(0, S - 16) && (t3 > 0 || ft > 0)) { if (t3 > 0 && 3 * t3 >= ft) t3--; else ft-- }
  if ((S - 3 * t3 - ft) % 2) { if (ft > 0) ft--; else if (t3 > 0) t3--; else ft++ }
  return [t3, ft, Math.max(0, (S - 3 * t3 - ft) / 2)]
}

function bkGame(P, luck, g, ctx) {
  const R = rngOf(`${ctx.seed}:bk:${ctx.po ? 'p' : 'g'}${ctx.i}`)
  const S = g.my, A = g.op, ot = g.ot ?? 0
  const s = Object.fromEntries(P.map(p => [p.k, {}]))
  // minutes
  const blow = Math.abs(S - A) >= 20
  const bench = ctx.bench
  const base = P.map(p => {
    const b = p.spot != null ? 28 + 6 * q01(p.o) : ([22, 18.5, 15, 10, 5][bench.indexOf(p)] ?? 2) * (0.7 + 0.6 * q01(p.o))
    return Math.max(0.5, b * (blow ? (p.spot != null ? 0.86 : 1.3) : 1) + R.n() * 2.4)
  })
  const M = 240 + 25 * ot
  let mins = apportion(M, base)
  // nobody plays more than the game allows
  const cap = 44 + 5 * ot
  for (let t = 0; t < 4; t++) {
    let over = 0
    mins = mins.map(m => { if (m > cap) { over += m - cap; return cap } return m })
    if (!over) break
    const extra = apportion(over, mins.map(m => (m < cap ? m : 0)))
    mins = mins.map((m, i) => m + extra[i])
  }
  // shots: each man's share of the offense tonight, then who made what (exactly the score)
  const hot = P.map(() => R.ln(0.3))
  const sh = P.map((p, i) => mins[i] * p.sk.use * hot[i] * (luck.get(p.k) ?? 1))
  const SH = sum(sh)
  const FGA = Math.round(88.5 + R.n() * 3.5 + 12 * ot)
  // (one man can only take so many of the shots: past 26% of them, each extra share counts for less)
  const efga = softCap(sh.map(x => x / SH), 0.26, 0.35).map(x => x * FGA)
  const E3 = sum(P.map((p, i) => efga[i] * p.sk.ts * p.sk.p3)), E2 = sum(P.map((p, i) => efga[i] * (1 - p.sk.ts) * p.sk.p2)), EF = sum(P.map((p, i) => efga[i] * p.sk.fr * p.sk.ft))
  const f = S / Math.max(1, 3 * E3 + 2 * E2 + EF)
  const [t3, ftm, t2] = shotSplit(S, E3 * f + R.n() * 2.2, EF * Math.sqrt(f) + R.n() * 3)
  const m3 = deal(R, t3, P.map((p, i) => efga[i] * p.sk.ts * p.sk.p3))
  const m2 = deal(R, t2, P.map((p, i) => efga[i] * (1 - p.sk.ts) * p.sk.p2))
  const mf = deal(R, ftm, P.map((p, i) => efga[i] * p.sk.fr * p.sk.ft))
  const miss = clamp(0.6, 1.6, 1 / f)
  P.forEach((p, i) => {
    const o = s[p.k]
    const a3 = m3[i] + R.poi(efga[i] * p.sk.ts * (1 - p.sk.p3) * miss)
    const a2 = m2[i] + R.poi(efga[i] * (1 - p.sk.ts) * (1 - p.sk.p2) * miss)
    const af = mf[i] + R.poi(efga[i] * p.sk.fr * (1 - p.sk.ft))
    o.mn = mins[i]
    add(o, 'pts', 3 * m3[i] + 2 * m2[i] + mf[i])
    add(o, 'fgm', m3[i] + m2[i]); add(o, 'fga', a3 + a2); add(o, 'tpm', m3[i]); add(o, 'tpa', a3); add(o, 'ftm', mf[i]); add(o, 'fta', af)
  })
  const fgm = sum(P.map(p => s[p.k].fgm ?? 0)), fga = sum(P.map(p => s[p.k].fga ?? 0))
  // their shooting, from their score
  let oFga = Math.round(88.5 + R.n() * 3.5 + 12 * ot)
  const [o3, oFt, o2] = shotSplit(A, 12.8 + R.n() * 2.4, 17 + R.n() * 3.6)
  const oFgm = o2 + o3
  if (oFgm > 0.56 * oFga) oFga = Math.ceil(oFgm / 0.53)
  const o3a = Math.max(o3, Math.min(oFga - o2, Math.round(o3 / clamp(0.25, 0.48, 0.36 + R.n() * 0.035))))
  const oFta = Math.max(oFt, Math.round(oFt / clamp(0.65, 0.9, 0.78 + R.n() * 0.04)))
  // the boards
  const ourMiss = Math.max(0, fga - fgm), oppMiss = Math.max(0, oFga - oFgm)
  const orb = R.bin(ourMiss, clamp(0.16, 0.34, 0.235 + 0.06 * (ctx.reb - 0.5))), drb = R.bin(oppMiss, clamp(0.62, 0.8, 0.71 + 0.05 * (ctx.reb - 0.5)))
  const orbBy = deal(R, orb, P.map((p, i) => mins[i] * p.sk.oreb)), drbBy = deal(R, drb, P.map((p, i) => mins[i] * p.sk.reb))
  // assists: a made shot, then who set it up (never the man who made it)
  const astBy = P.map(() => 0)
  const astP = clamp(0.5, 1.12, 1 + 0.3 * (ctx.pass - 0.5))
  P.forEach((p, i) => {
    const made = [...Array(m3[i]).fill(3), ...Array(m2[i]).fill(2)]
    for (const v of made) {
      if (R.u() < (v === 3 ? 0.84 : 0.54) * astP) { const j = R.pick(P.map((q, k) => (k === i ? 0 : mins[k] * q.sk.ast))); if (j >= 0) astBy[j]++ }
    }
  })
  const stl = Math.min(18, R.poi(7.6 * clamp(0.6, 1.5, 0.7 + 0.6 * ctx.stl)))
  const blk = Math.min(oppMiss, R.poi(4.8 * clamp(0.5, 1.6, 0.6 + 0.8 * ctx.blk)))
  const to = R.poi(13.8 * clamp(0.75, 1.3, 1.2 - 0.4 * ctx.iq))
  const stlBy = deal(R, stl, P.map((p, i) => mins[i] * p.sk.stl)), blkBy = deal(R, blk, P.map((p, i) => mins[i] * p.sk.blk))
  const toBy = deal(R, to, P.map((p, i) => mins[i] * p.sk.use * p.sk.to))
  P.forEach((p, i) => { const o = s[p.k]; add(o, 'orb', orbBy[i]); add(o, 'reb', orbBy[i] + drbBy[i]); add(o, 'ast', astBy[i]); add(o, 'stl', stlBy[i]); add(o, 'blk', blkBy[i]); add(o, 'to', toBy[i]) })
  // (theirs: the boards left over, less the ones that go out of bounds as team rebounds)
  const us = { pts: S, fgm, fga, tpm: t3, tpa: sum(P.map(p => s[p.k].tpa ?? 0)), ftm, fta: sum(P.map(p => s[p.k].fta ?? 0)), reb: orb + drb, orb, ast: sum(astBy), stl, blk, to }
  const them = { pts: A, fgm: oFgm, fga: oFga, tpm: o3, tpa: o3a, ftm: oFt, fta: oFta, reb: Math.round(0.93 * ((oppMiss - drb) + (ourMiss - orb))), orb: Math.round(0.93 * (oppMiss - drb)), ast: R.bin(oFgm, 0.6), stl: R.bin(to, 0.55), blk: Math.min(ourMiss, R.poi(4.6)), to: stl + R.poi(6.2) }
  if (ot) { us.ot = ot; them.ot = ot }
  return { s, us, them }
}

// the team's rebounding, passing and defense against an average roster's (0.5)
function bkTeamCtx(P) {
  const plan = minutesPlan(P)
  const W = sum(P.map(p => plan[p.k]))
  const team = f => sum(P.map(p => plan[p.k] * f(p))) / Math.max(1, W)
  const mid = (v, avg, span) => clamp(0, 1.2, 0.5 + (v - avg) / span)
  const raw = { reb: team(p => p.sk.rebRaw), pass: team(p => p.sk.astRaw), stl: team(p => p.sk.stl), blk: team(p => p.sk.blk), iq: team(p => attrsOf(p).basketballIQ ?? 5) }
  return {
    // (an average roster: 6.3 boards, 5.3 passing, 1.24 steals, 1.69 blocks, 5.6 IQ)
    raw, reb: mid(raw.reb, 6.34, 3), pass: mid(raw.pass, 5.3, 3), stl: mid(raw.stl, 1.24, 1.2), blk: mid(raw.blk, 1.69, 2), iq: mid(raw.iq, 5.63, 4),
  }
}

export function playBucketSeason({ roster, sched = [], playoffs = [], seed = 'x' }) {
  const P = roster.filter(p => p.pos === 'guard' || p.pos === 'big').map(p => ({ ...p, sk: bkSkills(p) }))
    .sort((a, b) => (a.spot ?? 9) - (b.spot ?? 9) || (a.d ?? 0) - (b.d ?? 0))
  const LR = rngOf(`${seed}:bk:luck`)
  const luck = new Map(P.map(p => [p.k, clamp(0.85, 1.15, 1 + LR.n() * 0.07)]))
  const ctx = { ...bkTeamCtx(P), seed, bench: P.filter(p => p.spot == null) }
  const reg = sched.map((g, i) => bkGame(P, luck, g, { ...ctx, i, po: false }))
  const po = playoffs.map((g, i) => bkGame(P, luck, g, { ...ctx, i, po: true }))
  return { reg, po, tot: totalsOf(P, reg, true), poTot: totalsOf(P, po, true), team: teamTotals(reg) }
}

// ── Totals ───────────────────────────────────────────────────────────────────
function totalsOf(P, games, minutes = false) {
  const out = Object.fromEntries(P.map(p => [p.k, { gp: 0 }]))
  for (const g of games) for (const p of P) {
    const o = out[p.k], x = g.s[p.k]
    if (!x || (minutes && !x.mn)) continue
    o.gp++
    for (const [k, v] of Object.entries(x)) add(o, k, v)
  }
  return out
}
function teamTotals(games) {
  const us = {}, them = {}
  for (const g of games) { for (const [k, v] of Object.entries(g.us)) add(us, k, v); for (const [k, v] of Object.entries(g.them)) add(them, k, v) }
  return { us, them, gp: games.length }
}

// ══════════════════════════════════════════════════════════════════════════════
// HONORS: Pro Bowl / All-Pro, All-Star / All-NBA, from the season the man actually had
// ══════════════════════════════════════════════════════════════════════════════
// A season's case at his position, on one scale per position (the Pro Bowl line and the All-Pro line)
export function fbCase(p, t, wins = 9) {
  const g = k => t?.[k] ?? 0
  const team = wins >= 12 ? 10 : wins >= 10 ? 5 : wins <= 5 ? -10 : 0
  switch (p.pos) {
    case 'qb': return { v: g('py') / 25 + g('ptd') * 4 - g('int') * 3 + g('ry') / 10 + g('rtd') * 6 + team, pb: 255, ap: 335 }
    case 'rb': return { v: (g('ry') + g('ryd')) / 10 + (g('rtd') + g('rctd')) * 6 + team, pb: 185, ap: 245 }
    case 'wr': return { v: g('ryd') / 10 + g('rctd') * 6 + g('rc') * 0.5 + team, pb: 195, ap: 262 }
    case 'te': return { v: g('ryd') / 10 + g('rctd') * 6 + g('rc') * 0.5 + team, pb: 138, ap: 195 }
    case 'dl': return p.sub === 'dt'
      ? { v: g('sck') * 10 + g('tfl') * 2 + g('ff') * 6 + g('qbh') + team, pb: 118, ap: 172 }
      : { v: g('sck') * 10 + g('tfl') * 2 + g('ff') * 6 + g('qbh') + team, pb: 148, ap: 208 }
    case 'lb': return { v: g('tk') + g('sck') * 6 + g('dint') * 10 + g('tfl') * 2 + g('pbu') * 2 + g('ff') * 6 + team, pb: 172, ap: 218 }
    case 'db': return { v: g('dint') * 14 + g('pbu') * 3 + g('tk') * 0.45 + g('p6') * 12 + g('ff') * 6 + g('tfl') * 2 + team, pb: 118, ap: 162 }
    // a lineman's case is his grade (and a winner's line gets noticed); he has to have played the season
    case 'ol': return { v: g('sn') ? olGrades(t).all + team * 0.3 : 0, pb: 86, ap: 92.5 }
    default: return { v: 0, pb: 1, ap: 1 }
  }
}
export function bkCase(t, gp, wins = 41) {
  const per = k => (gp ? (t?.[k] ?? 0) / gp : 0)
  return per('pts') + 1.2 * per('reb') + 1.5 * per('ast') + 2 * (per('stl') + per('blk')) + (wins - 41) * 0.08
}
// Every man's honor for the season: 'AP' All-Pro (also a Pro Bowl), 'PB' Pro Bowl; 'AN1'..'AN3' All-NBA, 'AS' All-Star
export function honorsOf(sport, roster, tot, { wins = 0, gp = 0 } = {}) {
  const out = {}
  if (sport === 'bucket') {
    // (a team gets two All-NBA men at most and four All-Stars: the best cases keep them)
    const ranked = roster.map(p => ({ p, c: bkCase(tot[p.k], tot[p.k]?.gp || gp, wins) })).sort((a, b) => b.c - a.c)
    let an = 0, as = 0
    for (const { p, c } of ranked) {
      let h = c >= 50 ? 'AN1' : c >= 45 ? 'AN2' : c >= 41 ? 'AN3' : c >= 35 ? 'AS' : null
      if (h?.startsWith('AN') && an >= 2) h = 'AS'
      if (h && as >= 4) h = null
      if (h) { out[p.k] = h; as++; if (h.startsWith('AN')) an++ }
    }
    return out
  }
  for (const p of roster) {
    const c = fbCase(p, tot[p.k], wins)
    if (c.v >= c.ap) out[p.k] = 'AP'
    else if (c.v >= c.pb) out[p.k] = 'PB'
  }
  return out
}
export const HONOR_NAME = { AP: 'ALL-PRO', PB: 'PRO BOWL', AN1: 'ALL-NBA 1ST', AN2: 'ALL-NBA 2ND', AN3: 'ALL-NBA 3RD', AS: 'ALL-STAR' }

// ── Team leaders ─────────────────────────────────────────────────────────────
const FB_LEADS = [
  ['PASSING', 'py', 'YDS'], ['RUSHING', 'ry', 'YDS'], ['RECEIVING', 'ryd', 'YDS'], ['TACKLES', 'tk', 'TKL'], ['SACKS', 'sck', 'SCK'], ['INTERCEPTIONS', 'dint', 'INT'],
]
const BK_LEADS = [['POINTS', 'pts', 'PPG'], ['REBOUNDS', 'reb', 'RPG'], ['ASSISTS', 'ast', 'APG'], ['STEALS', 'stl', 'SPG'], ['BLOCKS', 'blk', 'BPG']]
export function leadersOf(sport, roster, tot) {
  const list = sport === 'bucket' ? BK_LEADS : FB_LEADS
  const out = []
  for (const [label, key, unit] of list) {
    let best = null
    for (const p of roster) {
      const t = tot[p.k], v = t?.[key] ?? 0
      if (!v) continue
      const val = sport === 'bucket' ? v / Math.max(1, t.gp) : v
      if (!best || val > best.val || (val === best.val && p.s && !best.p.s)) best = { p, val }
    }
    if (best) out.push({ label, key, unit, k: best.p.k, val: sport === 'bucket' ? Math.round(best.val * 10) / 10 : best.val })
  }
  return out
}

// (the checks read the blends and the team numbers directly)
export const __test = {
  fbSkills, bkSkills,
  fbCtx: R => { const P = R.map(p => ({ ...p, sk: fbSkills(p) })); return fbTeamCtx(P, fbRoles(P), null) },
  bkCtx: R => bkTeamCtx(R.filter(p => p.pos === 'guard' || p.pos === 'big').map(p => ({ ...p, sk: bkSkills(p) }))),
}
