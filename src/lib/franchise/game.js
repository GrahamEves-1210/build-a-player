// FRANCHISE: one football game, play by play.
//
// Every snap is rolled from the men on the field (profile.js): who the ball goes to, what the rush and the
// coverage do to it, how far it goes, who makes the tackle. So real situations exist (down, distance, spot,
// clock, score) for the moments to stop on, and the box score adds up by itself: a passer's yards are his
// receivers' yards, every touchdown belongs to a man, the points are the touchdowns, kicks and safeties.
//
// A game is plain data (G) with its generator's state in it (G.rs), so the user's game can stop on a play, be
// saved, and carry on. The CPU's games run the same code straight through with no log.
//
// The numbers in TUNE are set against real NFL seasons by scripts/franchise/check.mjs (the realism table).
import { kickP, xpP, kickTry, kickEnv, onsideP } from '../kicks'
import { rngAt, hashStr } from './rng'
import { clamp } from './consts'
import { buildProfile } from './profile'
import { lastName } from './players'
import { nick } from './core'

export const TUNE = {
  sack: 0.066, sackRush: 3.1, sackQb: 1.5,
  comp: [0.748, 0.578, 0.38],            // short, intermediate, deep
  compQb: 0.19, compRec: 0.13, compCov: 0.56, compCall: 0.014, pressureComp: 0.13,
  int: [0.0115, 0.025, 0.047], intK: 1.8,
  runBase: 3.8, runLine: 5.5, runBack: 3.5, runCall: 0.22, stuff: 0.185, breakaway: 0.024,
  fumRun: 0.013, fumRec: 0.0105, fumSack: 0.1, fumLost: 0.55,
  pen: 0.05, home: 0.014,
  passRate: 0.552,
}

// ── A game ───────────────────────────────────────────────────────────────────
const newTot = () => ({ plays: 0, yds: 0, py: 0, ry: 0, fd: 0, d3a: 0, d3c: 0, d4a: 0, d4c: 0, to: 0, sk: 0, pen: 0, peny: 0, top: 0, td: 0, fg: 0, xp: 0, two: 0, saf: 0, pa: 0, ra: 0, pu: 0 })
export function newGame(F, { id, week, h, a, seed, playoff = null, neutral = false, keep = false }) {
  const R = rngAt(hashStr(`${seed}-${id}`))
  const G = {
    id, week, h, a, playoff, neutral, keep,
    user: h === F.team ? 0 : a === F.team ? 1 : -1,
    rs: 0, q: 1, clock: 900, poss: 0, yl: 25, down: 1, dist: 10, sc: [0, 0], qs: [[0, 0, 0, 0], [0, 0, 0, 0]], to: [3, 3],
    kick: null, recv2: 0, drive: 0, dPlays: 0, dYds: 0, dTime: 0, dStart: 0,
    box: [{}, {}], tot: [newTot(), newTot()], log: [], drives: [], scoring: [],
    over: false, ot: 0, otp: [0, 0], n: 0, tmw: [false, false],
    env: kickEnv(neutral ? 'ARI' : h, week, () => R.u()),
    stops: [], calls: [], used: [], pend: null, dec: null, sinceStop: 9,
  }
  const first = R.chance(0.5) ? 0 : 1       // who receives the opening kick
  G.recv2 = 1 - first
  G.kick = { type: 'kickoff', team: 1 - first }
  G.rs = R.s
  return G
}
// the two teams' game-day profiles: never saved (they hold the players themselves), rebuilt on demand
export function profilesOf(F, G) {
  if (!G._T) Object.defineProperty(G, '_T', { value: [buildProfile(F, G.h, G.user === 0), buildProfile(F, G.a, G.user === 1)], enumerable: false, writable: true, configurable: true })
  return G._T
}
// league averages the sim is centred on, so the league's numbers hold as rosters change (week.js sets F.lg)
export const LG0 = { passRush: 0.62, olPass: 0.6, cover: 0.6, runD: 0.6, olRun: 0.6, qbComp: 0.6, qbInt: 0.6, qbSack: 0.55, qbDeep: 0.6, rbRun: 0.62, catch: 0.62 }
export function leagueMeans(profiles) {
  const n = profiles.length, m = k => profiles.reduce((s, T) => s + k(T), 0) / n
  return {
    passRush: m(T => T.passRush), olPass: m(T => T.olPass), cover: m(T => T.cover), runD: m(T => T.runD), olRun: m(T => T.olRun),
    qbComp: m(T => T.qb?.s.comp ?? 0.5), qbInt: m(T => T.qb?.s.intAvoid ?? 0.5), qbSack: m(T => T.qb?.s.sackAvoid ?? 0.5), qbDeep: m(T => T.qb?.s.deep ?? 0.5),
    rbRun: m(T => T.rbs[0]?.s.run ?? 0.5), catch: m(T => (T.recv.slice(0, 4).reduce((s, r) => s + (r.s.catch ?? 0.5), 0) / Math.max(1, Math.min(4, T.recv.length)))),
  }
}

// ── Small helpers ────────────────────────────────────────────────────────────
// the game's generator for this step (G.R: never saved; its state goes back into G.rs when the step ends)
export function useRng(G) {
  if (!Object.prototype.hasOwnProperty.call(G, 'R')) Object.defineProperty(G, 'R', { value: null, writable: true, enumerable: false, configurable: true })
  return (G.R = rngAt(G.rs))
}
const st = (G, side, id) => (G.box[side][id] ??= {})
const add = (o, k, v = 1) => { o[k] = (o[k] ?? 0) + v }
const long = (o, k, v) => { if (!(o[k] >= v)) o[k] = v }
export const secsLeft = G => (G.q <= 4 ? (4 - G.q) * 900 + G.clock : G.clock)
export const halfLeft = G => (G.q <= 2 ? (2 - G.q) * 900 + G.clock : G.q <= 4 ? (4 - G.q) * 900 + G.clock : G.clock)
const clockText = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`
export const spotText = (G, side, yl) => (yl === 50 ? 'the 50' : yl < 50 ? `${side === 0 ? G.h : G.a} ${yl}` : `${side === 0 ? G.a : G.h} ${100 - yl}`)
const short = side => G => (side === 0 ? G.h : G.a)
const nm = m => m?.ln ?? lastName(m?.p?.name ?? 'the back')
const ordinalDown = ['', '1st', '2nd', '3rd', '4th']

function say(G, kind, text, extra = {}) {
  if (!G.keep) return
  G.log.push({ i: G.log.length, q: G.q, clock: G.clock, team: G.poss === 0 ? G.h : G.a, down: G.down, dist: G.dist, spot: G.yl, kind, text, yds: 0, pts: 0, by: null, drive: G.drive, driveStart: G.dPlays === 0, moment: null, call: false, score: [G.sc[0], G.sc[1]], ...extra })
}
function points(G, side, pts, text) {
  G.sc[side] += pts
  G.qs[side][Math.min(G.q, 5) - 1] = (G.qs[side][Math.min(G.q, 5) - 1] ?? 0) + pts
  if (G.keep) {
    const last = G.log[G.log.length - 1]
    if (last) { last.pts = pts; last.by = side === 0 ? G.h : G.a; last.score = [G.sc[0], G.sc[1]] }
    G.scoring.push({ q: G.q, clock: clockText(G.clock), team: side === 0 ? G.h : G.a, text: text ?? last?.text ?? '', hs: G.sc[0], as: G.sc[1] })
  }
}
// time off the clock for a play. mode: 'run' (the clock keeps going), 'stop' (incomplete, out of bounds, a score)
function tick(G, mode, o) {
  const R = G.R, d = 1 - o
  let t
  if (mode === 'stop') t = R.int(5, 9)
  else {
    const lead = G.sc[o] - G.sc[d], late = G.q === 4 || G.q === 2
    const hurry = (G.q === 4 && lead < 0 && G.clock <= 300) || (G.q === 2 && G.clock <= 120) || (G.q >= 5 && (lead < 0 || (lead === 0 && G.clock <= 240)))
    const milk = G.q === 4 && lead > 0 && G.clock <= 420
    t = hurry ? R.int(13, 22) : milk ? R.int(42, 46) : R.int(35, 44)
    // timeouts: the offense in a hurry stops it; a defense that needs the ball back stops it late
    if (late && G.clock - t > 0) {
      if (hurry && G.clock <= 110 && G.to[o] > 0 && R.chance(0.7)) { G.to[o]--; t = R.int(5, 8) }
      else if (G.q === 4 && lead > 0 && lead <= 16 && G.clock <= 150 && G.to[d] > 0) { G.to[d]--; t = R.int(5, 8) }
    }
    // the two-minute warning
    if (late && !G.tmw[G.q === 2 ? 0 : 1] && G.clock > 120 && G.clock - t < 120) { G.tmw[G.q === 2 ? 0 : 1] = true; t = G.clock - 120 }
  }
  t = Math.min(t, Math.max(0, G.clock))
  G.clock -= t; G.tot[o].top += t; G.dTime += t
}

// ── Drives ───────────────────────────────────────────────────────────────────
function startDrive(G, side, yl) {
  G.poss = side; G.yl = clamp(Math.round(yl), 1, 99); G.down = 1; G.dist = Math.min(10, 100 - G.yl)
  G.drive++; G.dPlays = 0; G.dYds = 0; G.dTime = 0; G.dStart = G.yl
}
function endDrive(G, result) {
  if (G.keep) G.drives.push({ n: G.drive, team: G.poss === 0 ? G.h : G.a, startText: spotText(G, G.poss, G.dStart), plays: G.dPlays, yds: G.dYds, time: clockText(G.dTime), result })
  if (G.q >= 5) G.otp[G.poss]++
}
function firstDown(G) { G.down = 1; G.dist = Math.min(10, 100 - G.yl) }
// yards gained on a scrimmage play that did not end the drive: move the chains
function advance(G, o, yds) {
  G.yl += yds; G.dYds += yds; G.dPlays++
  if (yds >= G.dist) { G.tot[o].fd++; if (G.down === 3) G.tot[o].d3c++; if (G.down === 4) G.tot[o].d4c++; firstDown(G); return 'first' }
  G.dist -= yds; G.down++
  if (G.down > 4) { endDrive(G, 'DOWNS'); startDrive(G, 1 - o, 100 - G.yl); return 'downs' }
  return 'ok'
}
function touchdown(G, side, text) {
  G.tot[side].td++
  points(G, side, 6, text)
  G.kick = { type: 'try', team: side }
}
function turnover(G, o, spotForDefense, result) {
  G.tot[o].to++
  endDrive(G, result)
  startDrive(G, 1 - o, spotForDefense)
}
function safety(G, o) {
  const d = 1 - o
  G.tot[d].saf++
  G.keep && say(G, 'safety', `Tackled in the end zone. Safety, ${nick(d === 0 ? G.h : G.a)}.`)
  points(G, d, 2)
  if (G.q >= 5) G.otDef = true
  endDrive(G, 'SAFETY')
  G.kick = { type: 'kickoff', team: o, free: true }
}

// ── Picking men ──────────────────────────────────────────────────────────────
const pickDef = (G, D, w) => { const i = G.R.wpick(w); return i >= 0 ? D.def[i] : null }
function tackle(G, d, D, pass, yds) {
  const m = pickDef(G, D, pass ? D.wTklPass : D.wTklRun)
  if (m) add(st(G, d, m.id), 'tk')
  return m
}
export function pickTarget(G, O, ctx) {
  const R = G.R
  const r = O.recv[Math.max(0, R.wpick(O.wTgt[(ctx.rz ? 1 : 0) + (ctx.long ? 2 : 0)]))]
  // how far downfield: 0 short, 1 intermediate, 2 deep
  const plan = O.plan?.off
  let ws = r.kind === 'rb' ? [1, 0, 0] : r.kind === 'te' ? [0.62, 0.3, 0.08] : [0.53, 0.32, 0.15 * (0.55 + (r.s.deep ?? 0.5) * 0.9)]
  if (r.kind !== 'rb') {
    if (plan === 'shots') ws = [ws[0] * 0.85, ws[1], ws[2] * 1.6]
    if (plan === 'quick') ws = [ws[0] * 1.2, ws[1] * 0.9, ws[2] * 0.5]
    if (ctx.long) ws = [ws[0] * 0.55, ws[1] * 1.25, ws[2] * 1.15]
    if (ctx.yl >= 88) ws = [1, 0, 0]
    else if (ctx.yl >= 78) ws = [ws[0], ws[1], 0]
  }
  return { r, depth: Math.max(0, R.wpick(ws)) }
}

// ── The plays ────────────────────────────────────────────────────────────────
// Each roll* decides what happens; each apply* books it (stats, the chains, the clock, the log). A moment builds
// the result itself and hands it to apply*.
export function passOdds(G, O, D, LG, ctx) {
  const o = G.poss, homeO = !G.neutral && o === 0 ? 1 : !G.neutral ? -1 : 0
  const plan = O.plan?.off, dplan = D.plan?.def
  let sack = TUNE.sack * Math.exp(TUNE.sackRush * ((D.passRush - LG.passRush) - (O.olPass - LG.olPass))) * Math.exp(-TUNE.sackQb * (O.qb.s.sackAvoid - LG.qbSack))
  sack *= (ctx.down === 3 && ctx.dist >= 6 ? 1.3 : ctx.down === 1 ? 0.82 : 1) * (plan === 'quick' ? 0.74 : plan === 'shots' ? 1.12 : 1) * (dplan === 'rush' ? 1.24 : dplan === 'cover' ? 0.85 : 1) * (1 - homeO * 0.03)
  if (ctx.prevent) sack *= 1.15
  sack = clamp(sack, 0.012, 0.3)
  const clutch = ctx.close ? (O.sit - D.sit) * 0.012 + ((O.qb.s.clutch ?? 0.5) - 0.55) * 0.03 : 0
  const edge = TUNE.compQb * (O.qb.s.comp - LG.qbComp) - TUNE.compCov * (D.cover - LG.cover) + TUNE.compCall * (O.offCall - D.defCall) + homeO * TUNE.home + clutch
    + (dplan === 'cover' ? -0.022 : dplan === 'stopRun' ? 0.016 : dplan === 'rush' ? 0.008 : 0) + (O.fit ?? 0)
  const intMul = Math.exp(TUNE.intK * ((D.cover - LG.cover) - (O.qb.s.intAvoid - LG.qbInt))) * (dplan === 'ball' ? 1.25 : 1) * (plan === 'shots' ? 1.08 : 1) * (ctx.desperate ? 1.5 : ctx.prevent ? 1.3 : 1)
  return { sack, edge, intMul }
}
export function rollPass(G, O, D, LG, ctx) {
  const R = G.R, P = passOdds(G, O, D, LG, ctx)
  if (R.chance(P.sack)) return { type: 'sack', yds: -(3 + R.int(0, 7)), fum: R.chance(TUNE.fumSack) }
  const pressured = R.chance(P.sack * 2.6)
  // he takes off
  const legs = O.qb.s.legs ?? 0.3
  if (R.chance((pressured ? 0.11 : 0.012) + Math.max(0, legs - 0.45) * (pressured ? 0.5 : 0.07))) return { type: 'scramble', yds: Math.min(100 - G.yl, Math.round(1 + -Math.log(1 - R.u() * 0.999) * (4.2 + legs * 4.5))) }
  const { r, depth } = pickTarget(G, O, ctx)
  const pInt = TUNE.int[depth] * P.intMul * (pressured ? 1.45 : 1)
  if (R.chance(clamp(pInt, 0.002, 0.2))) return { type: 'int', r, depth }
  let pc = TUNE.comp[depth] + P.edge + TUNE.compRec * ((r.s.catch ?? 0.5) - LG.catch) - (pressured ? TUNE.pressureComp : 0) + (depth === 2 ? (O.qb.s.deep - LG.qbDeep) * 0.15 : 0)
  if (r.kind === 'rb') pc += 0.05
  if (G.yl >= 88) pc -= 0.045
  if (ctx.down === 3) pc += 0.012
  if (ctx.prevent) pc += depth === 0 ? 0.03 : -0.05
  if (!R.chance(clamp(pc, 0.08, 0.95))) return { type: 'inc', r, depth, pd: R.chance(0.24) }
  // air yards and what he adds after the catch
  const ypr = r.s.ypr ?? 0.5
  const air = r.kind === 'rb' ? R.int(-3, 3) : depth === 0 ? 1 + Math.round(7.5 * Math.pow(R.u(), 1.25)) : depth === 1 ? R.int(10, 19) : 20 + Math.round(30 * Math.pow(R.u(), 1.7))
  let yac = Math.exp((r.kind === 'rb' ? 1.32 : depth === 0 ? 0.7 : depth === 1 ? 0.43 : 0.3) + R.n() * 0.8) * (0.72 + ypr * 0.5)
  if (R.chance(0.012 + ypr * 0.016)) yac += 12 + -Math.log(1 - R.u() * 0.999) * 16
  const yds = Math.min(100 - G.yl, Math.max(-4, Math.round(air + yac)))
  return { type: 'comp', r, depth, yds, fum: R.chance(TUNE.fumRec) && yds < 100 - G.yl }
}
export function applyPass(G, T, res, opts = {}) {
  const R = G.R, o = G.poss, d = 1 - o, O = T[o], D = T[d], qb = O.qb, Q = st(G, o, qb.id), tot = G.tot[o]
  const q = nm(qb), where = () => spotText(G, o, G.yl)
  tot.plays++; tot.pa++
  if (G.down === 3) tot.d3a++
  if (G.down === 4) tot.d4a++
  if (res.type === 'sack') {
    const m = res.by ?? pickDef(G, D, D.wSack)
    add(Q, 'sk'); add(Q, 'sky', -res.yds); G.tot[d].sk++
    if (m) { const S = st(G, d, m.id); add(S, 'sa'); add(S, 'tfl'); add(S, 'tk') }
    const ol = O.ol[Math.max(0, R.wpick(O.wOlSack))]
    if (ol) add(st(G, o, ol.id), 'sal')
    tot.py += res.yds; tot.yds += res.yds
    if (res.fum && R.chance(0.55)) {
      if (m) add(st(G, d, m.id), 'ff')
      const rec = pickDef(G, D, D.wTklRun); if (rec) add(st(G, d, rec.id), 'fr')
      add(Q, 'fum')
      G.keep && say(G, 'fumble', `${q} is hit by ${nm(m)} and the ball is out. ${nick(d === 0 ? G.h : G.a)} recover.`, { yds: res.yds })
      tick(G, 'stop', o); G.dPlays++
      return turnover(G, o, clamp(100 - (G.yl + res.yds), 1, 99), 'FUMBLE')
    }
    G.keep && say(G, 'sack', opts.text ?? `${q} is sacked by ${nm(m)} for a loss of ${-res.yds}.`, { yds: res.yds })
    if (G.yl + res.yds <= 0) { if (R.chance(0.5)) { tick(G, 'stop', o); return safety(G, o) } res.yds = 1 - G.yl }
    tick(G, 'run', o)
    return advance(G, o, res.yds)
  }
  if (res.type === 'scramble') {
    add(Q, 'ra'); add(Q, 'ry', res.yds); long(Q, 'rl', res.yds)
    tot.ra++; tot.pa--; tot.ry += res.yds; tot.yds += res.yds
    if (G.yl + res.yds >= 100) {
      add(Q, 'rtd'); G.dPlays++; G.dYds += res.yds
      G.keep && say(G, 'td', opts.text ?? `${q} escapes the pocket and runs it in from ${res.yds} yards out. Touchdown.`, { yds: res.yds })
      tick(G, 'stop', o); endDrive(G, 'TOUCHDOWN'); return touchdown(G, o)
    }
    tackle(G, d, D, false)
    G.keep && say(G, 'scramble', opts.text ?? `${q} scrambles for ${res.yds}${res.yds >= G.dist ? ' and the first down' : ''}.`, { yds: res.yds })
    tick(G, R.chance(0.3) ? 'stop' : 'run', o)
    return advance(G, o, res.yds)
  }
  const r = res.r, C = st(G, o, r.id), who = nm(r)
  add(Q, 'pa'); add(C, 'tg')
  if (res.type === 'int') {
    const m = res.by ?? pickDef(G, D, D.wInt)
    add(Q, 'pi')
    let ret = 0, td = false
    if (m) { const S = st(G, d, m.id); add(S, 'di'); add(S, 'pd') }
    const at = clamp(G.yl + (res.depth === 0 ? R.int(2, 9) : res.depth === 1 ? R.int(10, 19) : R.int(20, 38)), 2, 99)
    if (opts.pick6 ?? R.chance(0.085)) { td = true } else ret = Math.round(-Math.log(1 - R.u() * 0.999) * 9)
    G.keep && say(G, 'int', opts.text ?? `${q} is intercepted by ${nm(m)}${td ? ', and he takes it all the way back. Touchdown.' : ` at ${spotText(G, o, at)}.`}`)
    tick(G, 'stop', o); G.dPlays++
    G.tot[o].to++
    endDrive(G, 'INTERCEPTION')
    if (td) { if (m) add(st(G, d, m.id), 'dtd'); G.poss = d; G.q >= 5 && (G.otDef = true); return touchdown(G, d) }
    return startDrive(G, d, clamp(100 - at + ret, 1, 99))
  }
  if (res.type === 'inc') {
    if (res.pd) { const m = res.by ?? pickDef(G, D, D.wPd); if (m) add(st(G, d, m.id), 'pd'); G.keep && say(G, 'incomplete', opts.text ?? `${q} throws for ${who}, broken up by ${nm(m)}.`) }
    else G.keep && say(G, 'incomplete', opts.text ?? `${q} throws ${res.depth === 2 ? 'deep ' : ''}for ${who}, incomplete.`)
    tick(G, 'stop', o)
    return advance(G, o, 0)
  }
  // complete
  const yds = res.yds
  add(Q, 'pc'); add(Q, 'py', yds); add(C, 'rc'); add(C, 'cy', yds); long(C, 'cl', yds)
  tot.py += yds; tot.yds += yds
  if (G.yl + yds >= 100) {
    add(Q, 'ptd'); add(C, 'ctd'); G.dPlays++; G.dYds += yds
    G.keep && say(G, 'td', opts.text ?? (yds >= 30 ? `${q} goes deep for ${who}. Caught, and he is gone. ${yds}-yard touchdown.` : `${q} finds ${who} ${yds <= 5 ? 'in the end zone' : `for ${yds} yards and the score`}. Touchdown.`), { yds })
    tick(G, 'stop', o); endDrive(G, 'TOUCHDOWN'); return touchdown(G, o)
  }
  const tk = tackle(G, d, D, true)
  if (res.fum && R.chance(TUNE.fumLost)) {
    add(C, 'fum'); if (tk) add(st(G, d, tk.id), 'ff')
    const rec = pickDef(G, D, D.wTklPass); if (rec) add(st(G, d, rec.id), 'fr')
    G.keep && say(G, 'fumble', `${q} to ${who} for ${yds}, and he is stripped. ${nick(d === 0 ? G.h : G.a)} ball.`, { yds })
    tick(G, 'stop', o); G.dPlays++; G.dYds += yds
    return turnover(G, o, clamp(100 - (G.yl + yds), 1, 99), 'FUMBLE')
  }
  if (yds <= -1) add(st(G, d, (tk ?? D.def[0]).id), 'tfl')
  G.keep && say(G, 'pass', opts.text ?? `${q} to ${who} for ${yds}${yds >= G.dist ? (yds >= 20 ? '. A big gain and a first down' : ' and a first down') : ''}.`, { yds })
  tick(G, R.chance(0.16) ? 'stop' : 'run', o)
  return advance(G, o, yds)
}

export function rollRun(G, O, D, LG, ctx) {
  const R = G.R
  // who carries it: the backs, a quarterback who runs, the sneak on short yardage
  const legs = O.qb.s.legs ?? 0.3
  let m, qbRun = false
  if (ctx.dist <= 1 && R.chance(0.3 + (O.qb.s.sneak ?? 0.4) * 0.25)) { m = O.qb; qbRun = true }
  else if (R.chance(0.018 + Math.max(0, legs - 0.5) * 0.26)) { m = O.qb; qbRun = true }
  else m = O.rbs[Math.max(0, R.wpick(O.carry))]
  const dplan = D.plan?.def, plan = O.plan?.off
  const run = qbRun ? 0.45 + legs * 0.4 : (m.s.run ?? 0.4)
  const shift = TUNE.runLine * ((O.olRun - LG.olRun) - (D.runD - LG.runD)) + TUNE.runBack * (run - LG.rbRun) + TUNE.runCall * (O.offCall - D.defCall)
    + (dplan === 'stopRun' ? -0.45 : dplan === 'cover' ? 0.3 : 0) + (plan === 'ground' ? 0.12 : 0) + (qbRun && ctx.dist > 1 ? 1.4 : 0) + (O.fitRun ?? 0)
    + (ctx.close ? (O.sit - D.sit) * 0.12 : 0) + (!G.neutral ? (G.poss === 0 ? 0.1 : -0.1) : 0)
  const goal = G.yl >= 95, shortYd = ctx.dist <= 1
  let yds
  if (R.chance(clamp(TUNE.stuff - shift * 0.035 + (goal ? 0.07 : G.yl >= 90 ? 0.03 : 0) + (shortYd && !qbRun ? 0.03 : 0), 0.06, 0.42))) yds = -[0, 0, 0, 1, 1, 2, 3][R.int(0, 6)]
  else {
    yds = 1 + Math.round(-Math.log(1 - R.u() * 0.999) * Math.max(1.1, (goal ? 2.1 : shortYd ? 2.5 : TUNE.runBase) + shift))
    if (!goal && R.chance(TUNE.breakaway + Math.max(0, (m.s.brk ?? legs) - 0.5) * 0.07)) yds += 8 + Math.round(-Math.log(1 - R.u() * 0.999) * 17)
  }
  yds = Math.min(100 - G.yl, yds)
  return { type: 'run', m, qbRun, yds, fum: R.chance(TUNE.fumRun * (1.6 - (m.s.hold ?? 0.6))) && yds < 100 - G.yl }
}
export function applyRun(G, T, res, opts = {}) {
  const R = G.R, o = G.poss, d = 1 - o, O = T[o], D = T[d], m = res.m, S = st(G, o, m.id), tot = G.tot[o], who = nm(m), yds = res.yds
  tot.plays++; tot.ra++
  if (G.down === 3) tot.d3a++
  if (G.down === 4) tot.d4a++
  add(S, 'ra'); add(S, 'ry', yds); long(S, 'rl', yds)
  tot.ry += yds; tot.yds += yds
  if (yds >= 8 && O.ol.length) { const ol = O.ol[Math.max(0, R.wpick(O.wOlPnk))]; if (R.chance(0.3 + ol.s.pnk * 0.35)) add(st(G, o, ol.id), 'pk') }
  if (G.yl + yds >= 100) {
    add(S, 'rtd'); G.dPlays++; G.dYds += yds
    G.keep && say(G, 'td', opts.text ?? (yds >= 20 ? `${who} breaks into the open field and nobody is catching him. ${yds}-yard touchdown.` : res.qbRun ? `${who} keeps it and gets in. Touchdown.` : `${who} ${yds <= 2 ? 'punches it in' : `takes it in from ${yds} yards out`}. Touchdown.`), { yds })
    tick(G, 'stop', o); endDrive(G, 'TOUCHDOWN'); return touchdown(G, o)
  }
  const tk = res.by ?? tackle(G, d, D, false)
  if (res.by) add(st(G, d, res.by.id), 'tk')
  if (yds < 0 && tk) add(st(G, d, tk.id), 'tfl')
  if (res.fum && R.chance(TUNE.fumLost)) {
    add(S, 'fum'); if (tk) add(st(G, d, tk.id), 'ff')
    const rec = pickDef(G, D, D.wTklRun); if (rec) add(st(G, d, rec.id), 'fr')
    G.keep && say(G, 'fumble', opts.text ?? `${who} is stripped by ${nm(tk)}. ${nick(d === 0 ? G.h : G.a)} recover.`, { yds })
    tick(G, 'stop', o); G.dPlays++; G.dYds += yds
    return turnover(G, o, clamp(100 - (G.yl + yds), 1, 99), 'FUMBLE')
  }
  if (G.yl + yds <= 0 && R.chance(0.45)) { G.keep && say(G, 'run', `${who} is swallowed up in his own end zone.`, { yds }); tick(G, 'stop', o); return safety(G, o) }
  const gap = ['up the middle', 'off left tackle', 'off right tackle', 'around the left end', 'around the right end'][R.int(0, 4)]
  G.keep && say(G, 'run', opts.text ?? (res.qbRun && G.dist <= 1 ? `${who} sneaks it for ${yds}${yds >= G.dist ? ' and the first down' : ''}.`
    : yds <= 0 ? `${who} ${gap}, stopped ${yds === 0 ? 'for no gain' : `for a loss of ${-yds}`} by ${nm(tk)}.`
    : yds >= 15 ? `${who} ${gap}, breaks a tackle and rips off ${yds}.` : `${who} ${gap} for ${yds}${yds >= G.dist ? ' and a first down' : ''}.`), { yds })
  tick(G, 'run', o)
  return advance(G, o, yds)
}

// a penalty before or during the snap (the down is replayed; a defensive foul can move the chains)
function penalty(G, T) {
  const R = G.R, o = G.poss, d = 1 - o
  if (R.chance(0.54 - (T[o].olDisc - 0.5) * 0.25)) {
    const fs = R.chance(0.45), y = Math.min(fs ? 5 : 10, Math.floor(G.yl / 2))
    if (y <= 0) return false
    G.tot[o].pen++; G.tot[o].peny += y
    G.keep && say(G, 'penalty', fs ? `False start, ${nick(o === 0 ? G.h : G.a)}. Five yards.` : `Holding, ${nick(o === 0 ? G.h : G.a)}. Ten yards, replay the down.`, { yds: -y })
    G.yl -= y; G.dist = Math.min(G.dist + y, 100 - G.yl)
    if (!fs) tick(G, 'stop', o)
  } else {
    const k = R.u(), auto = k >= 0.38
    const y0 = k < 0.38 ? 5 : k < 0.58 ? 5 : k < 0.82 ? Math.round(9 + -Math.log(1 - R.u() * 0.999) * 10) : 15
    const y = Math.min(y0, Math.floor((100 - G.yl) / 2) || 1)
    G.tot[d].pen++; G.tot[d].peny += y
    G.keep && say(G, 'penalty', k < 0.38 ? `Offside, ${nick(d === 0 ? G.h : G.a)}. Five yards.` : k < 0.58 ? `Defensive holding. Five yards and an automatic first down.` : k < 0.82 ? `Pass interference, ${nick(d === 0 ? G.h : G.a)}. ${y} yards and a first down.` : `Roughing the passer. Fifteen yards and a first down.`, { yds: y })
    G.yl += y
    if (auto || y >= G.dist) { G.tot[o].fd++; firstDown(G) } else G.dist -= y
    if (k >= 0.58) tick(G, 'stop', o)
  }
  return true
}

// ── Kicks ────────────────────────────────────────────────────────────────────
export const fgDist = yl => 100 - yl + 17
export function applyFieldGoal(G, T, good, opts = {}) {
  const o = G.poss, O = T[o], k = O.k, dist = fgDist(G.yl), K = k.id != null ? st(G, o, k.id) : {}
  add(K, 'fga'); if (dist >= 50) add(K, 'f5a')
  G.dPlays++
  const name = k.p ? lastName(k.p.name) : 'The kicker'
  if (good) {
    add(K, 'fgm'); long(K, 'fgl', dist); if (dist >= 50) add(K, 'f5m')
    G.tot[o].fg++
    G.keep && say(G, 'fg', opts.text ?? `${name}'s ${dist}-yard field goal is good.`)
    tick(G, 'stop', o)
    points(G, o, 3)
    endDrive(G, 'FIELD GOAL')
    G.kick = { type: 'kickoff', team: o }
  } else {
    G.keep && say(G, 'fgmiss', opts.text ?? `${name}'s ${dist}-yard field goal is no good${dist >= 50 ? ', short' : ', wide'}.`)
    tick(G, 'stop', o)
    endDrive(G, 'MISSED FG')
    startDrive(G, 1 - o, clamp(100 - (G.yl - 7), 20, 99))
  }
}
export const fgOdds = (G, T, o, pressure = 0) => kickP(fgDist(G.yl), T[o].k.v, { yards: G.env.yards, pressure })
function punt(G, T) {
  const R = G.R, o = G.poss, d = 1 - o
  G.dPlays++; G.tot[o].pu++
  const gross = clamp(Math.round(46.5 + R.n() * 6.5), 28, 68)
  let land = G.yl + gross, text
  if (land >= 100) {
    if (R.chance(0.5)) { land = 80; text = `The punt goes into the end zone. Touchback.` } else { land = 100 - R.int(3, 12); text = `The punt is downed at the ${100 - land}.` }
  } else if (R.chance(0.44)) text = `A ${gross}-yard punt, fair catch at ${spotText(G, o, land)}.`
  else {
    const ret = Math.max(0, Math.round(-Math.log(1 - R.u() * 0.999) * 8.5 - 1))
    if (R.chance(0.006)) {
      const kr = T[d].kr
      G.keep && say(G, 'td', `The punt is fielded${kr ? ` by ${nm(kr)}` : ''} and he takes it the distance. Touchdown.`)
      if (kr) { add(st(G, d, kr.id), 'krtd') }
      tick(G, 'stop', o); endDrive(G, 'PUNT'); G.poss = d
      return touchdown(G, d)
    }
    land -= ret
    text = `A ${gross}-yard punt, returned ${ret} to ${spotText(G, o, clamp(land, 1, 99))}.`
  }
  G.keep && say(G, 'punt', text)
  tick(G, 'stop', o)
  endDrive(G, 'PUNT')
  startDrive(G, d, clamp(100 - land, 1, 99))
}
export function rollKickoff(G, T) {
  const R = G.R, k = G.kick.team, r = 1 - k, kr = T[r].kr
  if (G.kick.free) return { yl: clamp(R.int(22, 40), 1, 99), ret: null }
  if (R.chance(0.3)) return { tb: true, yl: 35 }
  const skill = kr?.ret ?? 0.5
  if (R.chance(0.004 + skill * 0.006)) return { td: true, ret: 100 }
  let yl = Math.round(17 + -Math.log(1 - R.u() * 0.999) * (7.5 + skill * 6))
  if (R.chance(0.03)) yl += R.int(15, 40)
  return { yl: clamp(yl, 8, 85), ret: yl }
}
export function applyKickoff(G, T, res, opts = {}) {
  const k = G.kick.team, r = 1 - k, kr = T[r].kr
  G.kick = null
  G.poss = r
  if (res.td) {
    if (kr) { const S = st(G, r, kr.id); add(S, 'kr'); add(S, 'kry', 100); add(S, 'krtd') }
    G.yl = 1; G.down = 1; G.dist = 10; G.drive++; G.dPlays = 0; G.dYds = 0; G.dTime = 0; G.dStart = 1
    G.keep && say(G, 'td', opts.text ?? `${kr ? nm(kr) : 'The returner'} takes the kickoff, finds a seam and goes the distance. Touchdown.`)
    tick(G, 'stop', r)
    endDrive(G, 'TOUCHDOWN')
    return touchdown(G, r)
  }
  if (kr && res.ret != null) { const S = st(G, r, kr.id); add(S, 'kr'); add(S, 'kry', Math.max(0, res.yl - 5)) }
  startDrive(G, r, res.yl)
  G.dPlays = 0
  G.keep && say(G, 'kickoff', opts.text ?? (res.tb ? `The kickoff is a touchback. ${nick(r === 0 ? G.h : G.a)} start at their 35.` : `${kr ? nm(kr) : 'The returner'} brings the kickoff out to ${spotText(G, r, res.yl)}.`))
  if (!res.tb) { G.clock = Math.max(0, G.clock - G.R.int(4, 8)) }
}
export function applyOnside(G, T, recovered, opts = {}) {
  const k = G.kick.team, r = 1 - k
  G.kick = null
  if (recovered) {
    startDrive(G, k, 46)
    G.keep && say(G, 'kickoff', opts.text ?? `Onside kick. It takes a high hop and ${nick(k === 0 ? G.h : G.a)} recover it.`)
  } else {
    startDrive(G, r, 100 - 45)
    G.keep && say(G, 'kickoff', opts.text ?? `Onside kick. ${nick(r === 0 ? G.h : G.a)} fall on it.`)
  }
  G.clock = Math.max(0, G.clock - G.R.int(2, 4))
}
// after a touchdown: kick it or go for two
export function twoOdds(G, T, o, LG) {
  const O = T[o], D = T[1 - o]
  return clamp(0.475 + ((O.olRun - LG.olRun) - (D.runD - LG.runD)) * 0.5 + (O.qb.s.comp - LG.qbComp) * 0.25 - (D.cover - LG.cover) * 0.25 + (O.sit - D.sit) * 0.03 + (O.offCall - D.defCall) * 0.015, 0.25, 0.7)
}
export function wantsTwo(G, o, sit = 0) {
  const lead = G.sc[o] - G.sc[1 - o], late = G.q >= 4, half2 = G.q >= 3
  if (G.q >= 5) return false
  if (lead === -2 && (half2 || sit > 0.2)) return true
  if (half2 && lead === -8 && sit > 0.3) return true
  if (late && (lead === -5 || lead === 1 || lead === 5 || lead === -10 || lead === 12)) return true
  if (late && lead === -8 && sit > 0.25 && G.clock < 600) return true
  if (late && (lead === -9 || lead === -16 || lead === -13)) return true
  if (late && G.clock <= 240 && lead === -1) return sit > 0.6
  if (G.q >= 2 && (lead === -8 || lead === -5 || lead === 1 || lead === 5 || lead === -15) && G.R.chance(0.3 + sit * 0.3)) return true
  return false
}
export function applyTry(G, T, kind, good, opts = {}) {
  const o = G.kick.team, O = T[o], k = O.k
  const save = G.poss
  G.poss = o
  if (kind === 'two') {
    G.tot[o].two += good ? 1 : 0
    G.keep && say(G, 'two', opts.text ?? (good ? `The two-point try is good.` : `The two-point try fails.`))
    if (good) points(G, o, 2)
  } else {
    const K = k.id != null ? st(G, o, k.id) : {}
    add(K, 'xpa')
    if (good) { add(K, 'xpm'); G.tot[o].xp++ }
    G.keep && say(G, good ? 'xp' : 'xpmiss', opts.text ?? (good ? `The extra point is good.` : `The extra point is no good.`))
    if (good) points(G, o, 1)
  }
  G.poss = save
  G.kick = { type: 'kickoff', team: o }
}

// ── The decisions ────────────────────────────────────────────────────────────
// What the staff does on fourth down: 'go' | 'fg' | 'punt'. sit: the head coach's feel for it (-1 … +1).
export function fourthCall(G, T, o) {
  const O = T[o], d = 1 - o, lead = G.sc[o] - G.sc[d], toGoal = 100 - G.yl, togo = G.dist, R = G.R
  const must = (G.q === 4 || G.q >= 5) && G.sc[o] - G.sc[1 - o] <= 0 && secsLeft(G) <= 150
  const reach = kickTry(O.k.v.power) + (G.env.yards > 0 ? 1 : 0), fd = fgDist(G.yl)
  const range = must ? fd <= reach : fd <= reach - 4 || (fd <= reach && R.chance(0.45))
  const left = secsLeft(G), q4 = G.q === 4, ot = G.q >= 5
  // the game is on the line
  if (q4 || ot) {
    if (lead < 0) {
      const fgHelps = range && (lead >= -3 || (lead >= -11 && lead <= -9 && left > 150) || (left > 420 && lead >= -6))
      if (left <= 150 && !fgHelps) return 'go'
      if (left <= 150 && fgHelps) return togo <= 1 && lead < -3 ? 'go' : 'fg'
      if (left <= 360 && lead <= -9 && !range) return 'go'
      if (left <= 300 && G.yl >= 45 && !range) return 'go'
    }
    if (lead === 0 && range && (left <= 120 || ot)) return 'fg'
    if (ot && lead <= 0 && left <= 200) return range ? 'fg' : 'go'
  }
  if (G.q === 2 && G.clock <= 30) return range ? 'fg' : G.yl >= 55 ? 'go' : 'punt'
  // the bold ones: a coach who knows the numbers goes more often
  const bold = 1.35 + O.sit * 0.4
  if (toGoal <= 2 && togo <= 2) return R.chance(0.6 + O.sit * 0.2) ? 'go' : 'fg'
  if (range) {
    if (togo <= 1 && toGoal <= 38 && toGoal > 10 && R.chance(bold * 0.62)) return 'go'
    if (togo <= 3 && toGoal >= 25 && R.chance(bold * (togo <= 2 ? 0.45 : 0.24))) return 'go'
    if (togo <= 1 && toGoal <= 10 && R.chance(bold * 0.42)) return 'go'
    return 'fg'
  }
  if (togo <= 1 && G.yl >= 42 && R.chance(bold * 1.1)) return 'go'
  if (togo <= 1 && G.yl >= 30 && R.chance(bold * 0.35)) return 'go'
  if (togo <= 3 && G.yl >= 54 && R.chance(bold * 0.72)) return 'go'
  if (togo <= 6 && G.yl >= 58 && R.chance(bold * 0.3)) return 'go'
  return 'punt'
}
// run or pass. Returns the chance of a pass.
export function passRate(G, O, o) {
  const d = 1 - o, lead = G.sc[o] - G.sc[d], dn = G.down, dist = G.dist
  let p = dn === 1 ? 0.49 : dn === 2 ? (dist >= 8 ? 0.64 : dist >= 4 ? 0.53 : 0.38) : dn === 3 ? (dist >= 7 ? 0.92 : dist >= 4 ? 0.84 : dist >= 2 ? 0.6 : 0.27) : (dist >= 4 ? 0.9 : dist >= 2 ? 0.58 : 0.25)
  p += TUNE.passRate - 0.565
  const plan = O.plan?.off
  if (plan === 'air' || plan === 'shots') p += 0.06
  if (plan === 'ground') p -= 0.075
  if (G.yl >= 97) p -= 0.14
  // the score and the clock
  if (G.q === 4) {
    if (lead < 0) p += G.clock <= 300 ? 0.3 : lead <= -9 ? 0.16 : 0.06
    else if (lead > 0) p -= G.clock <= 360 ? 0.3 : lead >= 9 ? 0.14 : 0.05
  } else if (G.q === 3 && Math.abs(lead) >= 17) p += lead < 0 ? 0.14 : -0.14
  if (G.q === 2 && G.clock <= 120) p += 0.24
  // lean on what the team is good at
  p += ((O.qb.s.comp ?? 0.5) - 0.6) * 0.07 - ((O.rbs[0]?.s.run ?? 0.5) - 0.62) * 0.08
  return clamp(p, 0.04, 0.985)
}

// ── One step ─────────────────────────────────────────────────────────────────
// Advances the game by one play (a snap, a kick, a try). hooks (the user's game only) may stop it first:
//   hooks.kickoff(G, T)  hooks.try(G, T, wants)  hooks.fourth(G, T, call)  hooks.snap(G, T, ctx)  hooks.fieldGoal(G, T, ctx)
// each returns true when it raised a stop (G.pend is set and nothing else happens this step).
export function step(F, G, hooks = null) {
  if (G.over || G.pend) return
  const T = profilesOf(F, G), LG = F.lg ?? LG0
  const R = useRng(G)
  G.n++; G.sinceStop++
  if (G.kick) {
    if (G.kick.type === 'try') {
      const o = G.kick.team
      let kind = G.dec?.at === 'try' ? G.dec.choice : null
      G.dec = null
      if (!kind) {
        const wants = wantsTwo(G, o, T[o].sit)
        if (hooks?.try?.(G, T, wants)) { G.n--; G.rs = R.s; return }
        kind = wants ? 'two' : 'one'
      }
      if (kind === 'two') applyTry(G, T, 'two', R.chance(twoOdds(G, T, o, LG)))
      else applyTry(G, T, 'one', R.chance(xpP(T[o].k.v, { yards: G.env.yards })))
    } else {
      // a kickoff (an onside kick when the game is nearly gone)
      const k = G.kick.team, lead = G.sc[k] - G.sc[1 - k]
      if (hooks?.kickoff?.(G, T)) { G.n--; G.rs = R.s; return }
      const need = G.q === 4 && lead < 0 && !G.kick.free && ((G.clock <= 130 && lead >= -16) || (G.clock <= 300 && lead <= -17 && lead >= -24))
      if (need && (G.to[k] < 2 || G.clock <= 75)) applyOnside(G, T, R.chance(onsideP(T[k].k.v)))
      else applyKickoff(G, T, rollKickoff(G, T))
    }
    return after(G, R)
  }
  const o = G.poss, d = 1 - o, O = T[o], D = T[d], lead = G.sc[o] - G.sc[d]
  const close = G.q >= 4 && Math.abs(lead) <= 8
  const ctx = { down: G.down, dist: G.dist, yl: G.yl, rz: G.yl >= 80, long: G.down >= 3 && G.dist >= 7, close, desperate: G.q === 4 && lead < 0 && G.clock <= 40 && G.yl < 60, prevent: G.q === 4 && lead < 0 && G.clock <= 130 }
  // run it out
  if (G.q === 4 && lead > 0 && G.clock <= (4 - G.down) * 40 - G.to[d] * 38) {
    G.tot[o].plays++; G.tot[o].ra++
    const Q = st(G, o, O.qb.id); add(Q, 'ra'); add(Q, 'ry', -1); G.tot[o].ry--; G.tot[o].yds--
    G.keep && say(G, 'kneel', `${nm(O.qb)} takes a knee.`, { yds: -1 })
    tick(G, 'run', o)
    G.yl = Math.max(1, G.yl - 1); G.dist++; G.down++; G.dPlays++
    if (G.down > 4) { endDrive(G, 'DOWNS'); startDrive(G, d, 100 - G.yl) }
    return after(G, R)
  }
  // out of time before the half or at the end: kick it if they can
  const kickNow = ((G.q === 2 || (G.q >= 4 && lead <= 0 && lead >= -3)) && G.down < 4 && fgDist(G.yl) <= kickTry(O.k.v.power) + 2 && (G.clock <= 9 || (G.clock <= 24 && G.to[o] === 0)))
    || (G.q >= 5 && lead === 0 && G.otp[0] >= 1 && G.otp[1] >= 1 && G.down >= 2 && fgDist(G.yl) <= 41)
  const botched = kickNow && G.user !== o && G.q <= 4 && G.down < 4 && R.chance(clamp(0.14 - O.sit * 0.1, 0.03, 0.26))
  if (G.down === 4 || (kickNow && !botched)) {
    let call = G.dec?.at === 'fourth' ? G.dec.choice : null
    G.dec = null
    if (!call) {
      call = kickNow ? 'fg' : fourthCall(G, T, o)
      if (!kickNow && hooks?.fourth?.(G, T, call)) { G.n--; G.rs = R.s; return }
    }
    if (call === 'fg') {
      const pressure = G.q >= 4 && lead <= 0 && lead >= -3 && G.clock <= 120 ? 1 : G.q >= 5 ? 1 : G.q === 4 && Math.abs(lead) <= 3 ? 0.5 : 0
      if (hooks?.fieldGoal?.(G, T, { pressure })) { G.n--; G.rs = R.s; return }
      applyFieldGoal(G, T, R.chance(fgOdds(G, T, o, pressure)))
      return after(G, R)
    }
    if (call === 'punt') { punt(G, T); return after(G, R) }
  }
  if (hooks?.snap?.(G, T, ctx)) { G.n--; G.rs = R.s; return }
  if (R.chance(TUNE.pen) && penalty(G, T)) return after(G, R)
  if (R.chance(passRate(G, O, o))) applyPass(G, T, rollPass(G, O, D, LG, ctx))
  else applyRun(G, T, rollRun(G, O, D, LG, ctx))
  return after(G, R)
}

// the clock, the quarters, overtime, the end
export function after(G, R) {
  G.rs = R.s
  if (G.q >= 5) {
    // overtime: both teams get the ball; after that the next score wins. A defensive score ends it at once.
    if (G.sc[0] !== G.sc[1] && G.kick?.type !== 'try' && (G.otDef || (G.otp[0] >= 1 && G.otp[1] >= 1))) return finish(G)
  }
  if (G.clock > 0) return
  if (G.kick?.type === 'try') return          // the try is untimed
  if (G.q === 1 || G.q === 3) { G.q++; G.clock = 900; return }
  if (G.q === 2) {
    if (G.dPlays > 0 || !G.kick) endDriveQuiet(G, 'END OF HALF')
    G.q = 3; G.clock = 900; G.to = [3, 3]
    G.kick = { type: 'kickoff', team: 1 - G.recv2 }
    return
  }
  if (G.q === 4) {
    if (G.sc[0] !== G.sc[1]) return finish(G)
    if (G.dPlays > 0 || !G.kick) endDriveQuiet(G, 'END OF REGULATION')
    G.q = 5; G.ot = 1; G.clock = G.playoff ? 900 : 600; G.to = [2, 2]; G.otp = [0, 0]
    G.kick = { type: 'kickoff', team: R.chance(0.5) ? 0 : 1 }
    G.rs = R.s
    return
  }
  // an overtime period ran out
  if (!G.playoff || G.sc[0] !== G.sc[1]) return finish(G)
  G.q++; G.ot++; G.clock = 900
}
function endDriveQuiet(G, result) {
  if (G.keep && G.dPlays > 0) G.drives.push({ n: G.drive, team: G.poss === 0 ? G.h : G.a, startText: spotText(G, G.poss, G.dStart), plays: G.dPlays, yds: G.dYds, time: clockText(G.dTime), result })
}
function finish(G) {
  if (G.keep && G.dPlays > 0 && !G.kick) endDriveQuiet(G, 'END OF GAME')
  G.over = true; G.kick = null; G.pend = null
}

// A whole game with nobody watching
export function playGame(F, G) {
  let guard = 0
  while (!G.over && guard++ < 1200) step(F, G, null)
  if (!G.over) finish(G)
  return G
}
export { clockText, ordinalDown, nm, st, add, short }
