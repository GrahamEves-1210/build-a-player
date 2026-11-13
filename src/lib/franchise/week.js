// FRANCHISE: a week of games. Every game of the week is played (the CPU's straight through, the user's live or
// simmed), then booked: stat lines into every player's season and career, the score into the schedule, team
// totals, workload, injuries, XP, the players of the week.
import { REG_WEEKS, DEV_RATE, clamp, r1, slotOf } from './consts'
import { rngOf, roll } from './rng'
import { TEAM_SHORTS, addNews, addTx, nick, teamName } from './core'
import { buildProfile } from './profile'
import { newGame, playGame, leagueMeans, LG0 } from './game'
import { addStats, passerRating } from './stats'
import { lastName } from './players'
import { playcall } from './rows'

// ── Before the games ─────────────────────────────────────────────────────────
// The CPU's gameplan against this opponent: attack what is weak, cover what is strong
function cpuPlan(T, opp, LG, R) {
  const off = opp.cover < LG.cover - 0.03 ? (R.chance(0.5) ? 'air' : 'shots') : opp.runD < LG.runD - 0.03 ? 'ground' : opp.passRush > LG.passRush + 0.04 ? 'quick' : 'balanced'
  const def = opp.rbs[0] && opp.rbs[0].s.run > LG.rbRun + 0.1 && opp.qb.s.comp < LG.qbComp ? 'stopRun' : opp.qb.s.comp > LG.qbComp + 0.1 ? 'cover' : opp.olPass < LG.olPass - 0.04 ? 'rush' : opp.qb.s.intAvoid < LG.qbInt - 0.08 ? 'ball' : 'balanced'
  return { off: R.chance(0.75) ? off : 'balanced', def: R.chance(0.75) ? def : 'balanced' }
}
// how well an offense's plan fits the defense across from it: a little either way, never decisive
function fitPlan(O, D, LG) {
  const plan = O.plan?.off
  O.fit = 0; O.fitRun = 0
  if (plan === 'air') O.fit = D.cover < LG.cover - 0.015 ? 0.014 : D.cover > LG.cover + 0.03 ? -0.008 : 0.003
  if (plan === 'shots') O.fit = D.cover < LG.cover - 0.015 ? 0.01 : -0.006
  if (plan === 'ground') O.fitRun = D.runD < LG.runD - 0.015 ? 0.32 : D.runD > LG.runD + 0.03 ? -0.15 : 0.08
  if (plan === 'quick') O.fit = D.passRush > LG.passRush + 0.03 ? 0.01 : -0.004
}
// Every team's profile for the week and the league averages the sim is centred on
export function prepWeek(F) {
  const P = {}
  for (const s of TEAM_SHORTS) P[s] = buildProfile(F, s, s === F.team)
  F.lg = leagueMeans(Object.values(P))
  for (const k in F.lg) F.lg[k] = Math.round(F.lg[k] * 1e4) / 1e4
  return P
}
export function gameProfiles(F, G, P = null) {
  const R = rngOf(`${F.seed}-${F.year}-plan-${G.id}`)
  const H = P?.[G.h] ?? buildProfile(F, G.h, G.h === F.team), A = P?.[G.a] ?? buildProfile(F, G.a, G.a === F.team), LG = F.lg ?? LG0
  if (G.h !== F.team) { H.plan = cpuPlan(H, A, LG, R); F.teams[G.h].plan = H.plan }
  if (G.a !== F.team) { A.plan = cpuPlan(A, H, LG, R); F.teams[G.a].plan = A.plan }
  fitPlan(H, A, LG); fitPlan(A, H, LG)
  Object.defineProperty(G, '_T', { value: [H, A], enumerable: false, writable: true, configurable: true })
  return G._T
}
export const gameSeed = F => `${F.seed}-${F.year}`
export function makeGame(F, week, i, keep = false, P = null) {
  const g = F.sched.weeks[week - 1][i]
  const G = newGame(F, { id: `w${week}g${i}`, week, h: g.h, a: g.a, seed: gameSeed(F), playoff: g.rd ?? null, neutral: !!g.neutral, keep })
  gameProfiles(F, G, P)
  return G
}

// ── After a game ─────────────────────────────────────────────────────────────
// how much of the game a man plays, by where he sits on the depth chart
const SHARE = { QB: [1], RB: [0.64, 0.3, 0.08], WR: [1, 0.95, 0.8, 0.25, 0.1], TE: [0.85, 0.35], OL: [1, 1, 1, 1, 1], EDGE: [0.86, 0.8, 0.42], DT: [0.84, 0.76, 0.42], LB: [1, 0.92, 0.6, 0.14], CB: [1, 1, 0.62], S: [1, 1, 0.22], K: [0.12] }
const STARTS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, EDGE: 2, DT: 2, LB: 3, CB: 2, S: 2, K: 1 }
export function dressed(T) {
  const out = [], L = T.L
  for (const slot of ['QB', 'RB', 'WR', 'TE', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K']) L[slot].slice(0, SHARE[slot].length).forEach((p, i) => out.push({ p, share: SHARE[slot][i], start: i < STARTS[slot] }))
  L.OL.forEach(o => o.p && out.push({ p: o.p, share: 1, start: true }))
  return out
}
// one number for a man's day (the game ball, the players of the week, XP)
export function gameScore(pos, s) {
  const n = k => s[k] ?? 0
  if (pos === 'qb') return n('py') / 22 + n('ptd') * 4.5 - n('pi') * 3.5 + n('ry') / 9 + n('rtd') * 6 - n('fum') * 3 + (n('pa') >= 15 ? (passerRating(s) - 88) / 9 : 0)
  if (pos === 'k') return n('fgm') * 3.2 + n('f5m') * 2 - (n('fga') - n('fgm')) * 3.5 + n('xpm') * 0.4 - (n('xpa') - n('xpm')) * 2
  if (pos === 'ol') return 6 + n('pk') * 2 - n('sal') * 4
  if (pos === 'rb' || pos === 'wr' || pos === 'te') return (n('ry') + n('cy')) / 9 + (n('rtd') + n('ctd') + n('krtd')) * 6 + n('rc') * 0.5 - n('fum') * 3
  return n('tk') * 1 + n('sa') * 5 + n('tfl') * 1.5 + n('di') * 7 + n('pd') * 1.6 + n('ff') * 3.5 + n('fr') * 2 + n('dtd') * 7
}
export function lineText(pos, s) {
  const n = k => s[k] ?? 0
  if (pos === 'qb') return `${n('pc')}/${n('pa')}, ${n('py')} yds, ${n('ptd')} TD${n('pi') ? `, ${n('pi')} INT` : ''}${n('ry') >= 30 ? `, ${n('ry')} rush` : ''}`
  if (pos === 'rb') return `${n('ra')} car, ${n('ry')} yds${n('rtd') ? `, ${n('rtd')} TD` : ''}${n('rc') >= 3 ? `, ${n('rc')} rec ${n('cy')} yds` : ''}`
  if (pos === 'wr' || pos === 'te') return `${n('rc')} rec, ${n('cy')} yds${n('ctd') ? `, ${n('ctd')} TD` : ''}`
  if (pos === 'k') return `${n('fgm')}/${n('fga')} FG${n('fgl') ? `, long ${n('fgl')}` : ''}, ${n('xpm')}/${n('xpa')} XP`
  if (pos === 'ol') return `${n('pk')} pancakes, ${n('sal')} sacks allowed`
  const parts = [`${n('tk')} tkl`]
  if (n('sa')) parts.push(`${n('sa')} sack${n('sa') > 1 ? 's' : ''}`)
  if (n('di')) parts.push(`${n('di')} INT`)
  if (n('ff')) parts.push(`${n('ff')} FF`)
  if (n('pd') && parts.length < 3) parts.push(`${n('pd')} PD`)
  if (n('dtd')) parts.push('TD')
  return parts.join(', ')
}

// ── Injuries ─────────────────────────────────────────────────────────────────
const INJ_RATE = { qb: 0.019, rb: 0.03, wr: 0.022, te: 0.021, ol: 0.017, dl: 0.02, lb: 0.022, db: 0.02, k: 0.0015 }
const INJ_KINDS = [
  [1, ['Bruised shoulder', 'Sprained ankle', 'Tight hamstring', 'Stinger', 'Hip pointer', 'Jammed thumb']],
  [2, ['Sprained ankle', 'Hamstring strain', 'Concussion', 'Calf strain', 'Groin strain', 'Bruised ribs']],
  [4, ['High-ankle sprain', 'MCL sprain', 'Hamstring tear', 'Broken hand', 'Shoulder sprain', 'Sprained foot']],
  [8, ['Broken collarbone', 'Torn meniscus', 'Fractured forearm', 'Severe high-ankle sprain', 'Torn pectoral']],
  [99, ['Torn ACL', 'Torn Achilles', 'Broken leg', 'Dislocated knee', 'Ruptured patellar tendon']],
]
// an injury inside a sentence: lower case, unless it starts with initials (MCL sprain)
export const injWords = what => (/^[A-Z]{2}/.test(what) ? what : what[0].toLowerCase() + what.slice(1))
const DUR = new WeakMap()
export function durability(p) { let d = DUR.get(p); if (d === undefined) { d = 0.7 + roll(`dur-${p.name}-${p.id}`) * 0.7; DUR.set(p, d) } return d }
export function rollInjury(F, R, p, share, mult = 1) {
  const rate = (INJ_RATE[p.pos] ?? 0.02) * share * (1 + (p.wear ?? 0) / 85) * durability(p) * mult * (p.age >= 31 ? 1.15 : 1)
  if (!R.chance(rate)) return null
  const u = R.u()
  const wk = u < 0.3 ? 1 : u < 0.53 ? 2 : u < 0.75 ? R.int(3, 4) : u < 0.9 ? R.int(5, 8) : R.int(9, 30)
  const kind = INJ_KINDS.find(([max]) => wk <= max) ?? INJ_KINDS[INJ_KINDS.length - 1]
  return { wk, what: R.pick(kind[1]) }
}

// ── XP ───────────────────────────────────────────────────────────────────────
// how fast a man of this age still learns
const XP_AGE = { qb: 1, k: 2 }
// how much of the XP a position turns into growth (set so the league's talent at each position holds over 20 years:
// scripts/franchise/drift.mjs). Quarterbacks, linemen and kickers last longest, so they have to grow slowest.
const XP_POS = { qb: 0.62, k: 0.22, ol: 0.8, rb: 1.14, lb: 1.14, dl: 1.06, te: 1.04 }
export function xpAge(p) {
  const a = p.age - (XP_AGE[p.pos] ?? 0)
  return a <= 22 ? 1.2 : a === 23 ? 1.05 : a === 24 ? 0.85 : a === 25 ? 0.62 : a === 26 ? 0.42 : a === 27 ? 0.28 : a <= 29 ? 0.16 : 0.07
}
export const XP_PER_POINT = 640
export function giveXp(F, p, raw, devCoach = 5.5) {
  const tree = p.team === F.team ? 1 + (F.gm.tree?.practice ?? 0) * 0.04 : 1
  const xp = raw * DEV_RATE[p.dev ?? 0] * xpAge(p) * (XP_POS[p.pos] ?? 1) * (1 + (devCoach - 5.5) * 0.04) * tree
  p.xp = (p.xp ?? 0) + xp
  let got = 0
  while (p.xp >= XP_PER_POINT) { p.xp -= XP_PER_POINT; p.pts = (p.pts ?? 0) + 1; got++ }
  return { xp: Math.round(xp), pts: got }
}

// ── Booking ──────────────────────────────────────────────────────────────────
const newSt = () => ({ g: 0, pf: 0, pa: 0, yds: 0, py: 0, ry: 0, ydsA: 0, pyA: 0, ryA: 0, to: 0, tk: 0, sk: 0, skA: 0, fd: 0, d3a: 0, d3c: 0, pen: 0 })
export function bookGame(F, G, week, i) {
  const g = F.sched.weeks[week - 1][i], T = G._T, reg = week <= REG_WEEKS
  g.hs = G.sc[0]; g.as = G.sc[1]
  if (G.ot) g.ot = 1
  const R = rngOf(`${F.seed}-${F.year}-book-${G.id}`)
  const out = { injuries: [], xp: [], best: [] }
  const top = []
  for (let side = 0; side < 2; side++) {
    const short = side === 0 ? G.h : G.a, t = F.teams[short], tot = G.tot[side], opp = G.tot[1 - side]
    if (reg) {
      const s = (t.st ??= newSt())
      s.g++; s.pf += G.sc[side]; s.pa += G.sc[1 - side]; s.yds += tot.yds; s.py += tot.py; s.ry += tot.ry; s.ydsA += opp.yds; s.pyA += opp.py; s.ryA += opp.ry
      s.to += tot.to; s.tk += opp.to; s.sk += tot.sk; s.skA += opp.sk; s.fd += tot.fd; s.d3a += tot.d3a; s.d3c += tot.d3c; s.pen += tot.pen
    }
    const won = G.sc[side] > G.sc[1 - side], box = G.box[side], dev = playcall(F, t).dev
    const user = short === F.team
    for (const { p, share, start } of dressed(T[side])) {
      const line = (box[p.id] ??= {})
      line.g = 1
      if (start) line.gs = 1
      const sc = gameScore(p.pos, line)
      if (reg) { addStats(p.s, line); addStats(p.car, line) } else { p.po = (p.po ?? 0) + 1 }
      if (!p.devKnown && share >= 0.2) p.devGames = (p.devGames ?? 0) + 1
      // workload
      p.wear = clamp((p.wear ?? 0) + share * (p.pos === 'rb' ? 5.4 : p.pos === 'qb' ? 2 : p.pos === 'k' ? 0.5 : 3.6) + ((line.ra ?? 0) > 18 ? 2.5 : 0), 0, 100)
      // XP: playing time, production, winning
      // (production counts the same for every position: a quarterback's big numbers are not worth more XP than a guard's good day)
      const got = giveXp(F, p, 26 * share + Math.min(13, Math.max(0, sc * (p.pos === 'qb' ? 0.5 : 1))) * 1.9 + (won ? 7 : 0) + (reg ? 0 : 10), dev)
      if (user) out.xp.push({ id: p.id, name: p.name, slot: slotOf(p), built: !!p.built, xp: got.xp, pts: got.pts })
      if (sc > 6) top.push({ p, side, sc: sc * (won ? 1.15 : 1), line })
      if (p.inj?.nag) { const what = p.inj.what; p.inj = null; if (R.chance(0.25)) out.injuries.push({ p, wk: 3, what }) }
      else if (F.settings.injuries) {
        const inj = rollInjury(F, R, p, share, user ? 1 - (F.gm.tree?.medical ?? 0) * 0.05 : 1)
        if (inj) out.injuries.push({ p, ...inj })
      }
    }
  }
  top.sort((a, b) => b.sc - a.sc)
  out.best = top
  out.potg = top.find(x => (G.sc[x.side] >= G.sc[1 - x.side])) ?? top[0] ?? null
  // three lines for the scoreboard: the best passer, runner and receiver of the game
  const bestOf = (k, pos) => top.filter(x => pos.includes(x.p.pos) && (x.line[k] ?? 0) > 0).sort((a, b) => (b.line[k] ?? 0) - (a.line[k] ?? 0))[0]
  g.top = [bestOf('py', ['qb']), bestOf('ry', ['rb', 'qb']), bestOf('cy', ['wr', 'te', 'rb'])].filter(Boolean).map(x => `${lastName(x.p.name)} (${x.side === 0 ? G.h : G.a}) ${lineText(x.p.pos === 'qb' && x !== bestOf('py', ['qb']) ? 'rb' : x.p.pos, x.line)}`)
  return out
}
// the box score as it is kept (boxScore() in views.js turns it into rows)
export function keepBox(F, G) {
  (F.boxes ??= {})[G.id] = { id: G.id, week: G.week, h: G.h, a: G.a, sc: [...G.sc], qs: G.qs.map(q => [...q]), ot: G.ot ? 1 : 0, tot: G.tot, box: G.box, scoring: G.scoring ?? [] }
}

// Apply a game's injuries: weeks out, injured reserve for the long ones, the news
export function applyInjuries(F, list, week) {
  const out = []
  for (const { p, wk, what } of list) {
    if (!p.team || (p.inj && p.inj.wk > 0)) continue
    const left = week <= REG_WEEKS ? REG_WEEKS - week : 22 - week
    p.inj = { wk, what, ir: false, fresh: true }
    if (wk > left + 4) p.inj.season = true
    const t = F.teams[p.team]
    const star = p.ovr >= 86
    out.push({ id: p.id, name: p.name, team: p.team, slot: slotOf(p), what, wk, user: p.team === F.team, ovr: p.ovr })
    if (star) addNews(F, 'injury', p.inj.season ? `${p.name} is out for the season (${injWords(what)})` : `${nick(p.team)} lose ${p.name} for ${wk === 1 ? 'a week' : `${wk} weeks`} (${injWords(what)})`, { team: p.team, pid: p.id })
    if (wk >= 4 && (p.team !== F.team || F.settings.autoRoster)) { p.inj.ir = true; addTx(F, 'ir', p.team, `${teamName(p.team)} placed ${slotOf(p)} ${p.name} on injured reserve (${injWords(what)}).`, p.id) }
    void t
  }
  return out
}
export { r1 }
