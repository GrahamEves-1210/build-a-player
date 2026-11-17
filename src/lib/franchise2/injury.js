// FRANCHISE: injuries, from the NFL's own numbers, a fifth gentler (owner 2026-11-15: "toned down for QoL").
// One model for every man in the league, the player's builds included (no cap on a build: he can lose a season).
//
// What it's built on:
// - Rate by position (ProFootballLogic's count of every 2015 injury that cost a game, 21,493 player-games): of the
//   men who play a game, 4.1% miss the next one or more. QB 2.5%, RB 5.2, WR 4.5, TE 4.9, OL 3.4, edge 3.9, DT 4.3,
//   LB 4.3, CB 4.4, S 4.7. A starter plays about twice the snaps of the average man who plays, so he gets hurt more
//   (here 1.4 times the room's rate; the men who rotate in less; the rest of the roster, special teams and practice,
//   0.15). At the NFL's rate that is about 23 starters hurt a team-season and 65 starter-games lost, the real league's
//   adjusted games lost (65-80), and about 27 injuries a team with the backups (the count: ~29).
// - Length: 3.1 games on average, 64% two games or fewer (the same count); a running back's last longest (3.9), a
//   tight end's shortest (2.6). Each injury is a real one with its own usual time: a concussion one or two weeks
//   (the protocol), a hamstring one to four, an MCL two to eight, a high ankle sprain three to eight, a fracture or a
//   knee scope a stay on injured reserve.
// - Season-enders, about 8% of injuries: torn ACLs (the league's 40-50 a year with camp and practice), torn Achilles
//   (10-15), torn pectorals (linemen and linebackers), broken legs, Lisfranc. A torn ACL takes 9-11 months, so one
//   torn in November runs into next September and one torn in December into next October: he starts on PUP.
// - Injured reserve: out four games or more (the NFL's rule since 2022), as the wire says it.
// The tone-down (QOL): the rate is 80% of the NFL's, for every man. The lengths keep the NFL's shape; in the season
// they come to about 2.7 games an injury (the count's 3.1), so a team loses about 30% fewer games than a real one:
// ~21 injuries a team-season, ~47 starter-games (sim.mjs prints it all).
//
//   rollInjuries(F, short, R)   after a team's game: who got hurt (sets p.in weeks out, p.ij { l, w, se?, nx? })
//   hurt(F, p, R, { minor })    one man hurt now (the practice-report event uses it)
//   outText(p)                  his status in a few words: OUT 2 WEEKS · IR · 6 WEEKS · OUT FOR SEASON
import { depthChart, startersOf, groupOf, GROUPS } from './roster'

// (headless checks count every injury here: scripts/franchise2/sim.mjs, gameday.mjs)
export const TALLY = { on: false, rows: [] }
export const QOL = 0.8                 // the NFL's rate times this, for every man (owner: a bit gentler than real)
const RATE = { qb: 0.025, rb: 0.052, wr: 0.045, te: 0.049, ol: 0.034, edge: 0.039, dt: 0.043, lb: 0.043, cb: 0.044, s: 0.047, k: 0.006 }
const EXPOSE = { start: 1.4, rest: 0.15 }
// The starting quarterback (owner, 2026-11-17: "every starting QB plays all 17"): the count's 2.5% is every QB who
// took a snap, garbage time and the backups' series included; the men who start take far more hits. In 2022-24 only
// 10 to 14 of the 32 Week 1 starters started all 17 games. This puts a starter at about 5% a game (the tone-down in).
const QB_START = 2.4
// the men behind the starters who play: how many in each room, and how much (a backup QB or guard hardly plays; the
// second running back, the third and fourth receivers, the line's rotation, the nickel corner do)
const NEXT = { qb: [1, 0.2], rb: [1, 0.85], wr: [2, 0.85], te: [1, 0.85], ol: [2, 0.35], edge: [2, 0.85], dt: [2, 0.85], lb: [1, 0.6], cb: [1, 0.85], s: [1, 0.6], k: [0, 0] }
const SEASON = 60                       // weeks out for a season-ender (cleared at the end of the season)

// the injuries, each as a team reports it, how common (share of all missed-game injuries, %), its time out, and where
// it's more common. w: [min, max] weeks, or a list of weights for 1, 2, 3 … weeks. se: ends the season; rec: weeks
// to come back (calendar), for the ones that can run into next season.
const KINDS = [
  { l: 'ankle', p: 15, w: [64, 24, 4, 3, 2, 3] },
  { l: 'high ankle sprain', p: 6, w: [0, 0, 8, 18, 24, 20, 14, 10, 6] },
  { l: 'hamstring', p: 13, w: [52, 28, 6, 5, 4, 3, 2], at: { wr: 1.5, cb: 1.5, s: 1.3, rb: 1.3, ol: 0.5, dt: 0.5, qb: 0.6 } },
  { l: 'knee', p: 9, w: [52, 24, 4, 5, 5, 4, 3, 3] },
  { l: 'MCL sprain', p: 6, w: [0, 8, 12, 16, 18, 16, 12, 10, 8] },
  { l: 'concussion', p: 9, w: [66, 24, 6, 4], at: { cb: 1.4, s: 1.4, wr: 1.3, te: 1.2, ol: 0.7, dt: 0.8 } },
  { l: 'shoulder', p: 7, w: [56, 26, 4, 5, 4, 3, 2], at: { ol: 1.3, dt: 1.3, edge: 1.2, lb: 1.2, qb: 1.1 } },
  { l: 'groin', p: 4, w: [58, 32, 6, 4] },
  { l: 'calf', p: 4, w: [54, 30, 8, 5, 3] },
  { l: 'quad', p: 3, w: [60, 30, 10] },
  { l: 'foot', p: 3, w: [40, 26, 6, 8, 8, 6, 6] },
  { l: 'toe', p: 2, w: [32, 26, 10, 12, 10, 10], at: { ol: 1.4, dt: 1.4, rb: 1.3 } },
  { l: 'ribs', p: 3, w: [56, 32, 12], at: { qb: 1.5 } },
  { l: 'hand', p: 3, w: [52, 24, 6, 8, 6, 4], at: { ol: 1.4, dt: 1.4, qb: 1.2 } },
  { l: 'back', p: 3, w: [64, 28, 8] },
  { l: 'hip', p: 1.5, w: [46, 30, 10, 8, 6] },
  { l: 'neck', p: 1.5, w: [46, 30, 14, 10], at: { cb: 1.5, s: 1.5 } },
  { l: 'elbow', p: 1.5, w: [46, 30, 14, 10] },
  { l: 'illness', p: 2, w: [100] },
  // (the long ones that don't end a season: a fracture, a knee scope, a core muscle repair; most go on injured
  // reserve and come back designated to return)
  { l: 'fractured forearm', p: 3, w: [0, 0, 0, 0, 4, 10, 16, 20, 18, 14, 10, 8] },
  { l: 'broken ankle', p: 2, w: [0, 0, 0, 0, 0, 8, 14, 18, 18, 16, 14, 12] },
  { l: 'knee surgery', p: 3, w: [0, 0, 0, 6, 10, 16, 18, 16, 14, 10, 10] },
  { l: 'core muscle surgery', p: 1.8, w: [0, 0, 0, 8, 18, 24, 22, 16, 12] },
  // season-enders
  { l: 'torn ACL', p: 4.2, se: 1, rec: [40, 48], at: { wr: 1.3, rb: 1.2, cb: 1.2, ol: 0.8, qb: 0.7 } },
  { l: 'torn Achilles', p: 1.4, se: 1, rec: [40, 52], at: { lb: 1.3, edge: 1.2, dt: 1.2 } },
  { l: 'torn pectoral', p: 0.8, se: 1, rec: [18, 24], at: { ol: 2.2, dt: 2.2, edge: 1.8, lb: 1.8, wr: 0.3, cb: 0.3, s: 0.4, rb: 0.5 } },
  { l: 'broken leg', p: 0.8, se: 1, rec: [14, 22] },
  { l: 'Lisfranc injury', p: 0.5, se: 1, rec: [20, 30] },
  { l: 'shoulder surgery', p: 0.4, se: 1, rec: [18, 26], at: { qb: 1.4, ol: 1.3, dt: 1.3 } },
]
const MINOR = KINDS.filter(k => !k.se && k.w.length <= 6 && k.w[0] > 0 && k.l !== 'illness')
const pickKind = (R, g, list = KINDS) => {
  const w = list.map(k => k.p * (k.at?.[g] ?? 1))
  let u = R.u() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) { u -= w[i]; if (u < 0) return list[i] }
  return list[list.length - 1]
}
const pickWeeks = (R, w) => { let u = R.u() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { u -= w[i]; if (u < 0) return i + 1 } return w.length }
// (a running back's injuries run a little long, a tight end's a little short, as the count has them)
const LONG = { rb: 1.25, te: 0.85, ol: 1.05 }

// (a year of weeks from one season's first Sunday to the next's: the week he's hurt in, counted from week 1)
const NFL_WEEKS_TO_NEXT = 52
export function hurt(F, p, R, { minor = false } = {}) {
  const g = groupOf(p)
  const k = pickKind(R, g, minor ? MINOR : KINDS)
  if (k.se) {
    const wk = F.phase === 'playoffs' ? 18 + (F.po?.rd ?? 0) : F.wk ?? 0
    const back = R.int(k.rec[0], k.rec[1])
    const nx = Math.max(0, back - (NFL_WEEKS_TO_NEXT - wk))
    p.in = SEASON
    p.ij = { l: k.l, w: SEASON, se: 1, ...(nx > 0 && { nx }) }
    return p.ij
  }
  let w = pickWeeks(R, k.w)
  if (LONG[g] && w > 1 && R.u() < Math.abs(LONG[g] - 1) * 2) w += LONG[g] > 1 ? 1 : -1
  p.in = w
  p.ij = { l: k.l, w }
  return p.ij
}

// a man's chance to be hurt in a game: his room's rate, how much he plays (start | next | rest), the tone-down
export const injuryRate = (g, role = 'start') => RATE[g] * (role === 'start' ? EXPOSE.start * (g === 'qb' ? QB_START : 1) : role === 'next' ? NEXT[g][1] : EXPOSE.rest) * QOL

// after a team's game: every man who played (and the rest of the roster, a little) may have been hurt in it
export function rollInjuries(F, short, R) {
  const C = depthChart(F, short, { healthy: true }), L = startersOf(F, short)
  const on = new Set(Object.values(L).map(p => p.i))
  const out = []
  const seen = new Set()
  for (const [k] of GROUPS) {
    const room = C[k] ?? []
    let nextUp = 0
    for (const p of room) {
      if (seen.has(p.i)) continue
      seen.add(p.i)
      const ex = on.has(p.i) ? EXPOSE.start * (k === 'qb' ? QB_START : 1) : nextUp++ < NEXT[k][0] ? NEXT[k][1] : EXPOSE.rest
      if (R.u() < RATE[k] * ex * QOL) {
        const ij = hurt(F, p, R, { minor: k === 'k' })
        out.push([p, ij, on.has(p.i)])
        if (TALLY.on) TALLY.rows.push({ y: F.year, wk: F.phase === 'playoffs' ? 18 + F.po.rd : F.wk, s: short, g: k, st: on.has(p.i), b: p.b != null, i: p.i, w: ij.w, se: !!ij.se, l: ij.l, nx: ij.nx ?? 0 })
      }
    }
  }
  return out
}

// his status in a few words (the depth chart, his page)
export function outText(p) {
  if (!p?.in) return ''
  if (p.ij?.se) return 'OUT FOR SEASON'
  if (p.ij?.pup) return `PUP · ${p.in} ${p.in === 1 ? 'WEEK' : 'WEEKS'}`
  return p.in >= 4 ? `IR · ${p.in} WEEKS` : `OUT ${p.in} ${p.in === 1 ? 'WEEK' : 'WEEKS'}`
}
// the new season: a man whose torn ACL or Achilles runs past the summer starts it on PUP for what's left
export function carryInjury(p) {
  const nx = p.ij?.nx, l = p.ij?.l
  delete p.in
  delete p.ij
  if (nx > 0) { p.in = nx; p.ij = { l, w: nx, pup: 1 } }
}
