// NBA FRANCHISE: key moments. The GM's game stops at a whistle in the last 24 seconds of the fourth (or of an
// overtime) when the game is there to be won (season.js momentStart / momentSpot: the sim's own ball, score and clock
// at that point, C's game seam). The moment is that possession, a real play: one of the basketball mini games, played
// by the man the coach would draw it up for, with both teams' real men on the floor. His team's ball, level or behind:
// the last possession, held for the last shot. Their ball: the stop. Ahead with the ball: fouled, two free throws.
// What the play does goes on the board at the real clock (possession), then the seconds after it (momentEnd: a landed
// moment that leaves his team ahead is the game), then the sim plays out anything left (finishGame).
// Never a win-odds boost: the score is the score.
import { NBA_GUARD_PLAYERS } from '../../../data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../../data/nba-bigs'
import { momentFacts } from '../../situations'
import { TEAM, manOf } from './league'
import { finishMoment, momentSpot, ROUND_NAME } from './season'
import { rngOf } from '../rng'

const RAW = new Map([...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS].map(r => [r.name, r]))
const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac', '#6b4423']
const hashOf = t => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h) }
const SUFFIX = /\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i
const lastOf = n => String(n).replace(SUFFIX, '').split(' ').slice(-1)[0].toUpperCase()
// a man's name in a game's lines: his last name, with a first initial when another man in the game shares it
// ("D. White gets the stop on C. White")
export const lastName = n => String(n ?? '').replace(SUFFIX, '').trim().split(/\s+/).slice(-1)[0] ?? ''
export function nameIn(p, men) {
  const l = lastName(p.n)
  return (men ?? []).some(x => x && x.i !== p.i && lastName(x.n) === l) ? `${String(p.n).trim()[0]}. ${l}` : l
}
export const asBuild = a => Object.fromEntries(Object.entries(a ?? {}).map(([k, v]) => [k, { val: v }]))
export function castMan(p, me = false) {
  const r = RAW.get(p.n)
  return { name: lastOf(p.n), number: p.num ?? r?.number ?? (hashOf(p.n) % 45), skin: r?.skin ?? SKIN[hashOf(p.n) % SKIN.length], speed: Math.max(-1, Math.min(1, ((p.a?.speed ?? 6) - 6) / 5)), ...(me && { me: true }) }
}
// the games' shape for five men: three on the perimeter and two bigs, { guard: [...3], big: [...2] } (lib/mg/read.js
// castMen; a group short of men repeats one, so a five with three bigs sends its forward out to the wing). lead: the
// man the play is about, first in his group (his own; on their side the man on him goes in the same slot). me: the
// lead is his man (the games know him by being the same object as cast.me)
const SPOT = { PG: 0, SG: 1, G: 1, SF: 2, F: 3, PF: 3, C: 4 }
function castOf(men, lead = null, group = 'guard', me = false) {
  const at = p => SPOT[p.p] ?? (p.g === 'guard' ? 1 : 3.5)
  const rest = men.filter(p => p !== lead).sort((a, b) => at(a) - at(b))
  const g = lead ? group : null, nG = g === 'guard' ? 2 : 3
  const first = lead ? castMan(lead, me) : null
  return { guard: [...(g === 'guard' ? [first] : []), ...rest.slice(0, nG).map(p => castMan(p))], big: [...(g === 'big' ? [first] : []), ...rest.slice(nG).map(p => castMan(p))], first }
}
// the last possession: one trip, one shot (the pick and roll and the rim are several trips a drill: not a last play)
const OFF = { guard: ['iso', 'half-court', 'clutch-shot'], big: ['post-up', 'clutch-shot'] }
const WORD = ['', 'one', 'two', 'three', 'four']
const periodName = per => (per <= 4 ? 'the fourth' : per === 5 ? 'overtime' : `the ${['second', 'third', 'fourth', 'fifth'][per - 6] ?? `${per - 4}th`} overtime`)
export const periodTag = per => (per <= 4 ? '4TH' : per === 5 ? 'OT' : `${per - 4}OT`)
export const secs = t => (t <= 0.05 ? '0.0' : t.toFixed(1))
// a man's tonight: in uniform, under six fouls
const okMan = (G, T, id) => (G.box[id]?.pf ?? 0) < 6 && !(T.out ?? []).includes(id)
// the playoff game's place in its series, the way the broadcast puts it: "Conference semifinals, Game 6. Celtics lead 3-2."
function seriesLine(F, P) {
  if (P.po == null) return null
  const g = F.po?.cur?.find(x => x.h === P.h && x.a === P.a && x.n === P.n)
  const S = g?.ser
  if (!S) return g?.k === '78' ? 'Play-In: the winner is the No. 7 seed.' : g?.k === 'last' ? 'Play-In: the winner is the No. 8 seed, the loser goes home.' : g?.k === '910' ? 'Play-In: the loser goes home.' : null
  const w = S.hi === F.team ? S.wh : S.wl, l = S.hi === F.team ? S.wl : S.wh
  const N = TEAM[F.team].nick
  // (Game 1: the series hasn't started, nobody calls it tied 0-0)
  const where = w === 0 && l === 0 ? '' : w === l ? `Series tied ${w}-${l}` : w > l ? `${N} lead ${w}-${l}` : `${N} trail ${w}-${l}`
  const stakes = w === 3 && l === 3 ? ' Winner moves on.' : w === 3 ? ' A win closes it out.' : l === 3 ? ' A loss ends the season.' : ''
  const rd = { 'FIRST ROUND': 'First round', 'CONFERENCE SEMIFINALS': 'Conference semifinals', 'CONFERENCE FINALS': 'Conference finals', 'NBA FINALS': 'NBA Finals' }[ROUND_NAME[F.po?.rd]]
  return `${rd ? `${rd}, ` : ''}Game ${g.n}.${where ? ` ${where}.` : ''}${stakes}`
}

// The play: the ball, the score and the clock where the sim stopped (F.pend.G), the man the coach draws it up for
// (the GM's build when he's out there or can come in, else the best scorer or the best stopper of the five on the
// floor, never a man with six fouls), the two fives as they are on the floor
export function momentPlan(F) {
  const P = F.pend
  if (!P?.G) return null
  const G = P.G
  const R = rngOf(`${F.seed}-mplan-${F.year}-${P.d}-${P.h}-${P.n ?? 0}`)
  const opp = P.h === F.team ? P.a : P.h
  const k = G.h.short === F.team ? 'h' : 'a', ko = k === 'h' ? 'a' : 'h'
  const T = G[k], O = G[ko]
  const mine = G.sc[k], theirs = G.sc[ko], m = mine - theirs
  const c = G.clock
  // (an old save's moment: the spot the score says)
  const spot = P.spot ?? momentSpot(G, F.team) ?? (m > 0 ? 'def' : 'off')
  const def = spot === 'def'
  const score = p => (def ? (p.a.perimeterDefense ?? 5) * 2 + (p.a.basketballIQ ?? 5) * 0.3 + p.o / 10 : spot === 'ft' ? (p.a.jumpShot ?? 5) + (p.a.clutch ?? 5) * 0.5 + p.o / 20 : p.o + (p.a.clutch ?? 5) * 0.8)
  const best = list => list.slice().sort((a, b) => score(b) - score(a))[0]
  const floorMen = T.floor.filter(id => okMan(G, T, id)).map(id => manOf(F, id)).filter(Boolean)
  const builds = T.men.filter(p => okMan(G, T, p.i)).map(p => manOf(F, p.i)).filter(p => p?.b != null)
  // (fouled, the man at the line is one of the five out there; anything else, his build can come in for it)
  const man = (spot === 'ft' ? best(floorMen.filter(p => p.b != null)) : best(builds)) ?? best(floorMen)
  if (!man) return null
  let five = floorMen
  if (!five.includes(man)) {
    const out = five.slice().sort((x, y) => (T.rot?.min?.[x.i] ?? 0) - (T.rot?.min?.[y.i] ?? 0))[0]
    five = five.map(p => (p === out ? man : p))
  }
  const theirFive = O.floor.map(id => manOf(F, id)).filter(Boolean)
  // the man on the other side: on defense the one he guards (their go-to scorer), on offense the one guarding him
  const go = p => p.o + (p.a.clutch ?? 5) * 0.8
  const vs = theirFive.slice().sort((a, b) => (def ? go(b) - go(a) : (b.g === man.g) - (a.g === man.g) || (b.a.perimeterDefense ?? 5) - (a.a.perimeterDefense ?? 5)))[0]
  const game = spot === 'ft' ? 'free-throws' : def ? 'lockdown' : m <= -3 || c < 5 ? 'clutch-shot' : R.pick(OFF[man.g])
  const N = s => TEAM[s].nick
  const where = m < 0 ? `${N(F.team)} trail the ${N(opp)} ${theirs}-${mine}` : m > 0 ? `${N(F.team)} lead the ${N(opp)} ${mine}-${theirs}` : `${N(F.team)} and ${N(opp)} tied at ${mine}`
  const clockText = secs(c)
  const state = m === 0 ? 'tied' : m < 0 ? `down ${WORD[-m] ?? -m}` : `up ${WORD[m] ?? m}`
  // down three with time on the clock: a team gets its three up early (a miss still leaves time to foul and get the
  // ball back); level or down one or two, it holds for the last shot
  const early = spot === 'off' && m <= -3 && c > EARLY_AT
  const tail = spot === 'ft' ? `The ${N(opp)} have to foul. ${man.n} to the line for two, ${N(F.team)} ${state}.`
    : def ? `${N(opp)} ball, ${m ? `${N(F.team)} ${state}` : 'tied'}. ${m > 0 ? 'A stop wins it.' : 'A stop gets it to overtime, at least.'}`
    : early ? `${N(F.team)} ball, ${state}. They need a three, and there's time to get a good look.`
    : `${N(F.team)} ball, ${state}. ${c > 8 ? 'They hold for the last shot.' : 'Time for one shot.'}${m <= -3 ? ' They need a three.' : ''}`
  const situation = {
    us: TEAM[F.team].short, them: TEAM[opp].short, mine, opp: theirs, hoops: true, clock: c, clockText, period: periodTag(G.per),
    line: `${where}, ${clockText} seconds left in ${periodName(G.per)}.`, tail, series: seriesLine(F, P),
  }
  const us5 = castOf(five, man, man.g, true), them5 = castOf(theirFive, vs, man.g)
  const cast = { us: { guard: us5.guard, big: us5.big }, them: { guard: them5.guard, big: them5.big }, me: us5.first }
  return {
    game, spot, man: man.i, name: man.n, g: man.g, vs: vs?.i ?? null, build: asBuild(man.a), situation, cast, def, ball: def ? ko : k, ...(early && { early: true }),
    seed: `${F.seed}-m-${F.year}-${P.d}-${P.h}-${P.n ?? 0}`, team: { short: F.team, color: TEAM[F.team].color, color2: TEAM[F.team].color2 }, opp: { short: opp, color: TEAM[opp].color, color2: TEAM[opp].color2 },
  }
}
// the play's result on the board, at the real clock: his team holds for the last shot (it goes up with one to three
// seconds left; the clutch shot is the one at the horn), and on defense so do they; fouled, they foul at once.
// Stripped, picked off or the shot clock gone: a turnover, no shot. Then the seconds left and the sim.
const TOV_NOTE = /^(Stripped|Picked off|Shot clock)/
export const EARLY_AT = 8   // down three with more than this on the clock: the three goes up with time left
export function momentDone(F, plan, r) {
  const G = F.pend?.G
  if (!G) return { out: null, res: finishMoment(F, null) }
  const facts = momentFacts(plan.game, r?.raw ?? null, !!r?.hit) ?? {}
  const R = rngOf(`${plan.seed}-t`)
  const c = G.clock, m = plan.situation.mine - plan.situation.opp
  const hold = () => (c < 3 ? c : c <= 6 ? c - 1 - R.u() * 0.8 : c - 1 - R.u() * 2.5)
  // (down three with time: the shot is up four to nine seconds in, three seconds or more still on the clock)
  const early = plan.spot === 'off' && m <= -3 && c > EARLY_AT
  const quick = () => Math.min(c - 3, 4 + R.u() * 5)
  const hit = !!r?.hit
  let out
  if (plan.spot === 'ft') {
    const made = facts.pts ?? (hit ? 2 : R.u() < 0.7 ? 1 : 0)
    out = { side: 'ft', hit: made >= 2, by: plan.man, pts: made, t: Math.min(c - 1, 0.6 + R.u() * 2) }
  } else if (plan.def) {
    const them = hit ? 0 : facts.allowed ?? 2
    out = { side: 'def', hit: them === 0, by: plan.man, vs: plan.vs, them, kind: them ? 'rim' : 'iso', t: hold() }
  } else {
    // (tov: 'lost', the ball gone, or 'clock', no shot before the shot clock ran out)
    const tov = !hit && plan.game !== 'clutch-shot' && (plan.game === 'iso' ? !!r?.out : TOV_NOTE.test(r?.note ?? '')) ? (/^Shot clock/.test(r?.note ?? '') ? 'clock' : 'lost') : null
    const pts = tov ? 0 : facts.pts ?? (hit ? (plan.game === 'clutch-shot' && m <= -3 ? 3 : 2) : 0)
    out = { side: 'off', hit: pts > 0, by: plan.man, pts, kind: plan.game, ...(tov && { tov }), t: tov === 'clock' ? c : early ? quick() : tov ? Math.max(1, c - 4 - R.u() * 3) : plan.game === 'clutch-shot' ? c : hold() }
  }
  const res = finishMoment(F, out)
  return { out, res }
}
// moments off (or skipped): the possession simmed, the trait decides about as an average player would
export function momentSim(F, plan) {
  const R = rngOf(`${plan.seed}-sim`)
  const v = plan.def ? (plan.g === 'guard' ? plan.build.perimeterDefense?.val : plan.build.interiorDefense?.val) ?? 5 : (plan.build.jumpShot?.val ?? 5) * 0.5 + (plan.build.clutch?.val ?? 5) * 0.5
  const hit = R.u() < (plan.spot === 'ft' ? 0.45 + v * 0.03 : 0.3 + v * 0.03)
  return momentDone(F, plan, { hit, raw: null })
}

// The final's line: what the moment did and how the game ended, from the log row (row.mo, season.js finishMoment)
//   "Reed hits the jumper with 2.1 seconds left to put the Celtics ahead. Brunson's heave is off."
export function momentText(F, row) {
  const mo = row?.mo
  if (!mo) return null
  const last = id => { const p = id != null ? manOf(F, id) : null; return p ? nameIn(p, [...(F.teams[F.team]?.r ?? []), ...(F.teams[row.opp]?.r ?? [])]) : null }
  const us = TEAM[F.team]?.nick ?? '', opp = TEAM[row.opp]?.nick ?? ''
  const me = last(mo.by) ?? `The ${us}`, him = last(mo.vs)
  const when = t => (t <= 0.05 ? 'at the buzzer' : `with ${secs(t)} seconds left`)
  // the play
  let a
  if (mo.side === 'ft') a = `${me} ${mo.pts >= 2 ? 'makes both free throws' : mo.pts === 1 ? 'splits the free throws' : 'misses both free throws'} ${when(mo.left)}`
  else if (mo.side === 'def') a = mo.them ? `${him ?? `The ${opp}`} scores on ${me} ${when(mo.left)}` : `${me} gets the stop${him ? ` on ${him}` : ''} ${when(mo.left)}`
  else if (mo.tov) a = mo.tov === 'clock' ? `${me} can't get a shot off` : `${me} loses the ball ${when(mo.left)}`
  else if (mo.pts) {
    const shot = mo.pts >= 3 ? 'hits the three' : mo.kind === 'iso' ? 'gets to the rim and scores' : mo.kind === 'post-up' ? 'scores on the block' : 'hits the jumper'
    a = `${me} ${shot} ${when(mo.left)}${mo.lead > 0 ? (mo.left <= 0.05 ? ' to win it' : ` to put the ${us} ahead`) : mo.lead === 0 ? ' to tie it' : ''}`
  } else a = `${me} misses ${when(mo.left)}`
  // what came after it: the other end's last look, overtime, or the sim's last seconds
  const ot = (row.ot || 0) > Math.max(0, (mo.per ?? 4) - 4)
  const t = mo.trip
  let b = ''
  if (t) {
    const who = last(t.by) ?? `The ${t.us ? us : opp}`
    b = t.made ? `${who} ${t.us && row.w ? 'wins it' : 'answers'} ${t.t < 1.5 ? 'with a heave' : 'at the horn'}` : `${who}${/s$/.test(who) ? "'" : "'s"} ${t.t < 1.5 ? 'heave' : 'last shot'} is off`
  }
  const ots = row.ot || 0
  const end = ot ? `The ${row.w ? us : opp} win it in ${ots === 2 ? 'double overtime' : ots === 3 ? 'triple overtime' : ots > 3 ? `${ots} overtimes` : 'overtime'}`
    : t || mo.left <= 0.05 || (mo.sealed && mo.side === 'off') ? ''
    : row.w ? `The ${us} ${mo.lead > 0 ? 'hold on' : 'win it'}` : `The ${opp} win it`
  return [a, b, end].filter(Boolean).join('. ') + '.'
}
