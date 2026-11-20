// NBA FRANCHISE: key moments. The GM's game stops with about 24 seconds left when it's within a possession
// (season.js momentStart: the sim's own score at that point, C's game seam). The last possession is a real play:
// one of the basketball mini games, played by the man the coach would draw it up for, with both teams' real men on
// the floor. What the play does goes on the board (possession), then the sim plays out the last seconds
// (finishGame). Never a win-odds boost: the score is the score.
import { NBA_GUARD_PLAYERS } from '../../../data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../../data/nba-bigs'
import { momentFacts } from '../../situations'
import { TEAM, depthOrder, healthy } from './league'
import { finishMoment } from './season'
import { rngOf } from '../rng'

const RAW = new Map([...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS].map(r => [r.name, r]))
const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac', '#6b4423']
const hashOf = t => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h) }
const lastOf = n => String(n).replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').split(' ').slice(-1)[0].toUpperCase()
export const asBuild = a => Object.fromEntries(Object.entries(a ?? {}).map(([k, v]) => [k, { val: v }]))
export function castMan(p, me = false) {
  const r = RAW.get(p.n)
  return { name: lastOf(p.n), number: p.num ?? r?.number ?? (hashOf(p.n) % 45), skin: r?.skin ?? SKIN[hashOf(p.n) % SKIN.length], speed: Math.max(-1, Math.min(1, ((p.a?.speed ?? 6) - 6) / 5)), ...(me && { me: true }) }
}
// the five on the floor, in the games' shape: { guard: [...], big: [...] }
function floor(F, s, not = null) {
  const five = depthOrder(F, s).filter(healthy).filter(p => p !== not).slice(0, not ? 4 : 5)
  return { guard: five.filter(p => p.g === 'guard').map(p => castMan(p)), big: five.filter(p => p.g === 'big').map(p => castMan(p)) }
}
const OFF = { guard: ['clutch-shot', 'iso', 'pnr', 'half-court'], big: ['post-up', 'pnr', 'clutch-shot'] }
const DEF = { guard: ['lockdown'], big: ['rim-protect'] }
// the play: who has the ball (behind or level: the offense draws it up; ahead: a stop)
export function momentPlan(F) {
  const P = F.pend
  if (!P) return null
  const R = rngOf(`${F.seed}-mplan-${F.year}-${P.d}-${P.h}-${P.n ?? 0}`)
  const opp = P.h === F.team ? P.a : P.h
  const m = P.us - P.them
  const def = m > 0
  const men = depthOrder(F, F.team).filter(healthy).slice(0, 5)
  // his build first (the GM made him for this), else the best scorer; on defense the best stopper
  const build = men.find(p => p.b != null)
  const score = p => (def ? (p.g === 'guard' ? p.a.perimeterDefense : p.a.interiorDefense) * 2 + p.o / 10 : p.o + (p.a.clutch ?? 5) * 0.8)
  const man = build ?? men.slice().sort((a, b) => score(b) - score(a))[0]
  let list = (def ? DEF : OFF)[man.g]
  if (!def && m <= -3) list = ['clutch-shot']
  const game = R.pick(list)
  const clock = game === 'clutch-shot' ? 2.8 : def ? 14 + R.int(0, 8) : 16 + R.int(0, 8)
  const us = TEAM[F.team].short, them = TEAM[opp].short
  const where = m < 0 ? `${us} down ${P.them}-${P.us} to ${them}` : m > 0 ? `${us} up ${P.us}-${P.them} on ${them}` : `${us} and ${them} tied at ${P.us}`
  const clockText = clock < 10 ? clock.toFixed(1) : `0:${String(Math.floor(clock)).padStart(2, '0')}`
  const situation = {
    us, them, mine: P.us, opp: P.them, hoops: true, clock, clockText, period: P.ot ? 'OT' : '4TH',
    line: `${where}, ${clockText} left in the 4th.`, tail: def ? `${them} has the ball. ${us} needs a stop.` : m <= -3 ? 'Need a three.' : 'One possession. Get a bucket.',
  }
  const cast = { us: { ...floor(F, F.team, man), [man.g]: [castMan(man, true), ...floor(F, F.team, man)[man.g]] }, them: floor(F, opp), me: castMan(man, true) }
  return { game, man: man.i, name: man.n, g: man.g, build: asBuild(man.a), situation, cast, def, seed: `${F.seed}-m-${F.year}-${P.d}-${P.h}-${P.n ?? 0}`, team: { short: F.team, color: TEAM[F.team].color, color2: TEAM[F.team].color2 }, opp: { short: opp, color: TEAM[opp].color, color2: TEAM[opp].color2 } }
}
// the play's result on the board: his points (or the ones given up), then the sim finishes the game
export function momentDone(F, plan, r) {
  const facts = momentFacts(plan.game, r?.raw ?? null, !!r?.hit) ?? {}
  let out
  if (plan.def) out = { pts: 0, them: facts.allowed ?? (r?.hit ? 0 : 2) }
  else out = { pts: facts.pts ?? (r?.hit ? (plan.game === 'clutch-shot' && plan.situation.mine - plan.situation.opp <= -3 ? 3 : 2) : 0), by: plan.man, kind: plan.game }
  const res = finishMoment(F, out)
  return { out, res }
}
// moments off (or skipped): the possession simmed, the trait decides about as an average player would
export function momentSim(F, plan) {
  const R = rngOf(`${plan.seed}-sim`)
  const v = plan.def ? (plan.g === 'guard' ? plan.build.perimeterDefense?.val : plan.build.interiorDefense?.val) ?? 5 : (plan.build.jumpShot?.val ?? 5) * 0.5 + (plan.build.clutch?.val ?? 5) * 0.5
  const hit = R.u() < 0.3 + v * 0.03
  return momentDone(F, plan, { hit, raw: null })
}
