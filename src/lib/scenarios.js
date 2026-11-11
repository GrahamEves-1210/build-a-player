// Season scenarios: the decisions a season pauses on (app).
//
// Most of them happen INSIDE the next game (lib/gameMoments.js): the last
// drive, their final possession, a blowout's garbage time. The choice decides
// that game, its score and your line in it. The rest, here, are the ones that
// really span weeks: an injury (sit or play hurt), the concussion protocol,
// wear and tear late in the year, the trade deadline, a fired coordinator,
// resting once you've clinched, being benched.
//
// A bank of
// situations, each gated on where the season actually is, so a scenario only
// fires when it makes sense:
//   at     which stretch of the season it can appear: early · mid · late · stretch · playoffs
//   when   a test on the season so far (record, streaks, playoff picture, last game)
//   needs  roles the build must have for the card to mean anything (see ROLE)
//   w      how strongly it wants to be picked when it fits (situational > generic)
//   make   the card: kicker, title, body and 2–3 options
// Every option's fine print is written from its effect (describe), so the text
// can never promise something different from what the option does.
//
// What an effect touches has to make sense: an injury hits the body part it
// is (a hamstring is speed, a throwing shoulder is arm), fatigue hits the legs,
// film hits the head, and nothing in a season changes how big you are. The
// numbers are sized to show up in the games: a stretch is ±2–3 on the traits
// it's about, a permanent change is ±1, a missed game is a game the team plays
// without you.
//
// Effects (applied by seasonDirector.js):
//   attr {trait: ±n}      rest of the season, or `window` games
//   team {off, def}       the team around you
//   sit n                 you miss the next n games
//   then {…}              what happens after the first part runs out (attr/team/sit)
//   gamble {p, hit, miss} each side its own effect plus a `line` for the reveal
//   tag                   the name the affected games carry in the schedule
//   xp                    bonus XP
//
// Career has a second bank on top of this one, the LIFE bank further down: the cards about the career
// and the team (a rookie's wall, a contract year, a backup pushing for the job, a corner travelling with
// their best receiver). See its own header.

import { seeded } from './rng'
import { gameMoment, odds, sub as oddsSub } from './gameMoments'
import { NBA_GUARD_PLAYERS } from '../data/nba-guards'
import { NBA_BIG_PLAYERS } from '../data/nba-bigs'
import { DLS, passRush } from '../data/dls'
import { LBS } from '../data/lbs'
import { WRS } from '../data/wrs'
import { TES } from '../data/tes'
import { OLS, olOVR } from '../data/ols'
import { DBS } from '../data/dbs'
import { GUARD_TYPES } from '../data/nba-guards'
import { BIG_TYPES } from '../data/nba-bigs'
import { calcBucketOVR } from '../utils/bucketSimulation'
import { K_COLD, K_DOMES } from './kicks'

// The trade deadline: a real player from another team. A scorer (the best
// offensive players around the league) or a stopper (the best defenders).
// Every player carries his group (where he'd go on a Career roster) and overall.
const nbaOvr = (p, g) => { const types = g === 'big' ? BIG_TYPES : GUARD_TYPES; return Math.round(p.ovr ?? calcBucketOVR(Object.fromEntries(types.map(t => [t, { val: p.attrs?.[t] ?? 5 }])), types, g)) }
const nbaSeen = new Set()
const NBA_POOL = [...NBA_GUARD_PLAYERS.map(p => [p, 'guard']), ...NBA_BIG_PLAYERS.map(p => [p, 'big'])]
  .filter(([p]) => !nbaSeen.has(p.name) && nbaSeen.add(p.name)).map(([p, g]) => ({ ...p, group: g, ovr: nbaOvr(p, g) }))
const sumOf = (p, keys) => keys.reduce((s, k) => s + (p.attrs?.[k] ?? 0), 0)
const OFF_KEYS = ['jumpShot', 'finishing', 'handles', 'playmaking', 'clutch']
const DEF_KEYS = ['perimeterDefense', 'interiorDefense']
const NBA_SCORERS = [...NBA_POOL].sort((a, b) => sumOf(b, OFF_KEYS) - sumOf(a, OFF_KEYS)).slice(0, 80)
const NBA_STOPPERS = [...NBA_POOL].sort((a, b) => sumOf(b, DEF_KEYS) - sumOf(a, DEF_KEYS)).slice(0, 60)
// Football deadline targets: a real pass rusher, a real weapon (from another team);
// in a Career, a weapon and a lineman (offense), a corner and a safety (a DB) or an edge and a tackle (a DL):
// the groups a Career roster keeps, so the man traded for is really on it
const NFL_RUSHERS = [...DLS].sort((a, b) => passRush(b) - passRush(a))
const NFL_WEAPONS = [...WRS.map(p => ({ ...p, group: 'wr', role: 'receiver' })), ...TES.map(p => ({ ...p, group: 'te', role: 'tight end' }))].sort((a, b) => b.ovr - a.ovr)
const NFL_LINE = OLS.map(p => ({ ...p, group: 'ol', role: 'lineman', ovr: Math.round(olOVR(p.attrs) ?? 72) })).sort((a, b) => b.ovr - a.ovr)
// the pass rushers have no overall: usually one past the elite tier, an elite one only rarely (6%)
const nflTarget = (r, list, mine, elite, top) => {
  const pool = list.filter(p => p.team !== mine)
  const from = r() < 0.06 ? pool.slice(0, elite) : pool.slice(elite, top)
  return from[Math.floor(r() * from.length)] ?? null
}
// Who's on the table: a good player (80-89) most of the time; a superstar (90+)
// only 1 call in 20 (stars rarely move at the deadline). In a Career, `ok` keeps
// out anyone who can't come (already here, retired, no upgrade, or he'd take the job).
const STAR = 90
function dealTarget(r, list, mine, { lo = 80, ok = null, not = null } = {}) {
  const pool = list.filter(p => p.team !== mine && p.name !== not && (!ok || ok(p, p.group)))
  const stars = pool.filter(p => p.ovr >= STAR), good = pool.filter(p => p.ovr >= lo && p.ovr < STAR)
  // (no good player who'd help: no call, rather than a star by default)
  const from = r() < 0.05 && stars.length ? stars : good
  return from[Math.floor(r() * from.length)] ?? null
}
// A deal's effect. Career: the player joins the roster and the team is graded again
// from it (what that does to the team, and which grades move). Elsewhere: a set bump.
const dealFx = (d, p, flat) => {
  if (!d) return { team: flat }
  const fx = d.fx(p, p.group)
  return { team: { off: fx.off, def: fx.def }, trade: { name: p.name, group: p.group, from: p.team, grades: fx.grades } }
}
const last = n => n.split(' ').filter(w => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w)).pop()

// ── What each kind of event touches, per position ───────────────────────────
//   legs   conditioning: fatigue, rest, fresh legs
//   feel   the touch of the position's main skill: hot and cold stretches
//   mind   reading the game: film, new schemes, distractions
//   nerve  composure: big stages, pressure, mistakes in your head
//   power  the physical part of the craft (strength at contact, arm)
//   make   creating: the plays you make yourself
const ROLE = {
  qb:    { legs: ['legs'], feel: ['accuracy'], mind: ['processing', 'vision'], nerve: ['pocket-presence', 'leadership'], power: ['arm'], make: ['playmaking'] },
  rb:    { legs: ['burst', 'speed'], feel: ['vision', 'elusiveness'], mind: ['vision'], nerve: ['carrying'], power: ['strength', 'balance'], make: ['elusiveness'] },
  wr:    { legs: ['speed', 'release'], feel: ['routeRunning', 'hands'], mind: ['awareness'], nerve: ['hands'], power: ['bodyControl', 'vertical'], make: ['afterCatch'] },
  te:    { legs: ['speed'], feel: ['routeRunning', 'hands'], mind: ['awareness'], nerve: ['hands'], power: ['blocking', 'strength'], make: ['afterCatch'] },
  db:    { legs: ['speed', 'fluidity'], feel: ['manCoverage'], mind: ['zoneIQ', 'playRecognition'], nerve: ['playRecognition'], power: ['runSupport', 'press'], make: ['hands'] },
  dl:    { legs: ['getOff', 'speed', 'bend'], feel: ['finesseMoves', 'powerMoves'], mind: ['playRecognition'], nerve: ['playRecognition'], power: ['strength', 'blockShed'], make: ['bend', 'finesseMoves', 'powerMoves'] },
  lb:    { legs: ['range'], feel: ['zoneInstincts', 'tackling'], mind: ['playRecognition'], nerve: ['leadership'], power: ['power', 'blockShed'], make: ['passRush', 'zoneInstincts'] },
  ol:    { legs: ['mobility'], feel: ['passPro'], mind: ['blitzPickup', 'discipline'], nerve: ['discipline'], power: ['anchor', 'runBlock'], make: ['pancake'] },
  k:     { legs: ['power'], feel: ['accuracy'], mind: [], nerve: ['clutch'], power: ['power'], make: ['accuracy'] },
  guard: { legs: ['speed', 'bounce'], feel: ['jumpShot'], mind: ['basketballIQ'], nerve: ['clutch'], power: ['finishing'], make: ['handles', 'passing'] },
  big:   { legs: ['bounce', 'speed'], feel: ['finishing'], mind: ['basketballIQ'], nerve: ['clutch'], power: ['rebounding', 'interiorDefense'], make: ['playmaking'] },
}
// What a season can't change: you don't get taller, longer or bigger mid-year
const FIXED = new Set(['size', 'length'])

// ── Injuries: the body part decides the traits and the timeline ─────────────
//   hit   what playing on it costs   out   games to heal if you sit (football: weeks)
//   hurt  how long it nags if you play on it
const INJURIES = {
  qb: [
    { name: 'Hamstring strain', hit: { legs: -3, playmaking: -2 }, out: 2, hurt: 4 },
    { name: 'High ankle sprain', hit: { legs: -3, 'pocket-presence': -2 }, out: 3, hurt: 4 },
    { name: 'Sore throwing shoulder', hit: { arm: -3, accuracy: -1 }, out: 2, hurt: 4 },
    { name: 'Bruised ribs', hit: { arm: -2, 'pocket-presence': -2 }, out: 1, hurt: 3 },
    { name: 'Sprained thumb on the throwing hand', hit: { accuracy: -3, arm: -1 }, out: 1, hurt: 3 },
  ],
  rb: [
    { name: 'Hamstring strain', hit: { speed: -3, burst: -2 }, out: 2, hurt: 4 },
    { name: 'High ankle sprain', hit: { elusiveness: -3, burst: -2, balance: -1 }, out: 3, hurt: 4 },
    { name: 'Turf toe', hit: { burst: -3, elusiveness: -2 }, out: 2, hurt: 5 },
    { name: 'Sprained shoulder', hit: { strength: -3, carrying: -1 }, out: 2, hurt: 4 },
    { name: 'Broken finger', hit: { hands: -3, carrying: -2 }, out: 1, hurt: 4 },
  ],
  wr: [
    { name: 'Hamstring strain', hit: { speed: -3, release: -2 }, out: 2, hurt: 4 },
    { name: 'Ankle sprain', hit: { routeRunning: -3, bodyControl: -2 }, out: 2, hurt: 3 },
    { name: 'Groin strain', hit: { speed: -2, routeRunning: -2 }, out: 2, hurt: 4 },
    { name: 'Broken finger', hit: { hands: -3 }, out: 1, hurt: 4 },
    { name: 'Separated shoulder', hit: { vertical: -2, bodyControl: -2, hands: -1 }, out: 3, hurt: 4 },
  ],
  te: [
    { name: 'Hamstring strain', hit: { speed: -3, routeRunning: -1 }, out: 2, hurt: 4 },
    { name: 'Sprained shoulder', hit: { blocking: -3, strength: -2 }, out: 2, hurt: 4 },
    { name: 'Ankle sprain', hit: { routeRunning: -2, afterCatch: -2 }, out: 2, hurt: 3 },
    { name: 'Broken finger', hit: { hands: -3 }, out: 1, hurt: 4 },
  ],
  db: [
    { name: 'Hamstring strain', hit: { speed: -3, fluidity: -1 }, out: 2, hurt: 4 },
    { name: 'Groin strain', hit: { fluidity: -3, manCoverage: -2 }, out: 2, hurt: 4 },
    { name: 'Ankle sprain', hit: { fluidity: -2, manCoverage: -2 }, out: 2, hurt: 3 },
    { name: 'Stinger', hit: { runSupport: -3, press: -2 }, out: 1, hurt: 3 },
    { name: 'Broken hand', hit: { hands: -3, press: -1 }, out: 2, hurt: 4 },
  ],
  // (the snap-to-contact position: hands, shoulders and knees, more than a hamstring)
  dl: [
    { name: 'Hamstring strain', hit: { getOff: -3, speed: -2 }, out: 2, hurt: 4 },
    { name: 'High ankle sprain', hit: { bend: -3, getOff: -2, speed: -1 }, out: 3, hurt: 4 },
    { name: 'MCL sprain', hit: { bend: -3, getOff: -2, strength: -1 }, out: 3, hurt: 5 },
    { name: 'Sprained shoulder', hit: { strength: -3, powerMoves: -2, blockShed: -1 }, out: 2, hurt: 4 },
    { name: 'Broken hand, playing in a club', hit: { finesseMoves: -3, blockShed: -2 }, out: 2, hurt: 5 },
    { name: 'Turf toe', hit: { getOff: -3, bend: -2 }, out: 2, hurt: 4 },
    { name: 'Back spasms', hit: { strength: -2, powerMoves: -2 }, out: 1, hurt: 3 },
  ],
  lb: [
    { name: 'Hamstring strain', hit: { range: -3, passRush: -1 }, out: 2, hurt: 4 },
    { name: 'High ankle sprain', hit: { range: -3, tackling: -1 }, out: 3, hurt: 4 },
    { name: 'Stinger', hit: { power: -2, tackling: -2, blockShed: -1 }, out: 1, hurt: 3 },
    { name: 'Sprained shoulder', hit: { tackling: -3, blockShed: -2 }, out: 2, hurt: 4 },
    { name: 'MCL sprain', hit: { range: -3, power: -1 }, out: 3, hurt: 5 },
  ],
  ol: [
    { name: 'Knee sprain', hit: { mobility: -3, anchor: -2 }, out: 3, hurt: 4 },
    { name: 'Back spasms', hit: { anchor: -3, passPro: -1 }, out: 1, hurt: 3 },
    { name: 'Ankle sprain', hit: { mobility: -3, runBlock: -1 }, out: 2, hurt: 3 },
    { name: 'Hyperextended elbow', hit: { runBlock: -2, pancake: -2, passPro: -1 }, out: 2, hurt: 4 },
  ],
  guard: [
    { name: 'Sprained ankle', hit: { speed: -2, handles: -2, bounce: -1 }, out: 5, hurt: 12 },
    { name: 'Hamstring strain', hit: { speed: -3, bounce: -2 }, out: 7, hurt: 14 },
    { name: 'Sprained shooting wrist', hit: { jumpShot: -3, finishing: -1 }, out: 4, hurt: 15 },
    { name: 'Jammed finger', hit: { handles: -2, jumpShot: -1 }, out: 2, hurt: 8 },
    { name: 'Sore knee', hit: { bounce: -3, finishing: -2 }, out: 6, hurt: 15 },
  ],
  big: [
    { name: 'Sprained ankle', hit: { bounce: -2, interiorDefense: -2 }, out: 5, hurt: 12 },
    { name: 'Sore knee', hit: { bounce: -3, rebounding: -2 }, out: 7, hurt: 15 },
    { name: 'Back spasms', hit: { finishing: -2, rebounding: -2 }, out: 4, hurt: 10 },
    { name: 'Dislocated finger', hit: { jumpShot: -2, finishing: -1 }, out: 2, hurt: 8 },
    { name: 'Plantar fasciitis', hit: { speed: -2, bounce: -2 }, out: 6, hurt: 15 },
  ],
}

// ── Effect → fine print ──────────────────────────────────────────────────────
const sign = n => (n > 0 ? `+${n}` : `−${Math.abs(n)}`)
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)
export function describe(e, c, scope = '') {
  if (!e || !Object.keys(e).filter(k => k !== 'line' && k !== 'tag').length) return 'Nothing changes.'
  if (e.gamble) {
    const p = Math.round(e.gamble.p * 100)
    return `${p}%: ${lc(describe(e.gamble.hit, c, scope))} · ${100 - p}%: ${lc(describe(e.gamble.miss, c, scope))}`
  }
  const parts = []
  // a Career deal: the team's grades, recalculated with him on the roster
  if (e.trade) for (const g of e.trade.grades ?? []) parts.push(`${g.k.toLowerCase()} ${g.from} → ${g.to}`)
  for (const [t, d] of Object.entries(e.attr || {})) if (d) parts.push(`${sign(d)} ${c.L(t)}`)
  if (e.team?.off) parts.push(`team offense ${sign(e.team.off)}`)
  if (e.team?.def) parts.push(`team defense ${sign(e.team.def)}`)
  let s = parts.join(', ')
  if (e.trade && !s) s = 'joins the roster; the team grades hold'
  if (s && e.window) s += ` for ${e.window} ${e.window === 1 ? 'game' : 'games'}`
  else if (s && !scope) s += ' for the rest of the season'
  if (s && scope) s += ` ${scope}`
  if (e.sit) s += `${s ? '; ' : ''}miss ${e.sit === 1 ? 'the next game' : `the next ${e.sit} games`}`
  if (e.then) s += `${s ? ', then ' : ''}${lc(describe(e.then, c))}`
  if (e.dur) s += `${s ? ' · ' : ''}${sign(e.dur)} durability (for good)`
  if (e.xp) s += `${s ? ' · ' : ''}+${e.xp} XP`
  return cap(s || 'Nothing changes.')
}
const isEmpty = e => !e || !Object.keys(e).filter(k => k !== 'tag').length
const lc = s => (s ? s[0].toLowerCase() + s.slice(1) : s).replace(/\.$/, '')

// ── Context ──────────────────────────────────────────────────────────────────
export function phaseOf(stop) {
  if (stop.kind === 'playoffs') return 'playoffs'
  const f = stop.at / stop.total
  return f < 0.3 ? 'early' : f < 0.55 ? 'mid' : f < 0.8 ? 'late' : 'stretch'
}

function context({ sport, pos, stop, ctx, build, types, attrMap, teamNick, name, seed, team, lastBig, lastBust, deals = null, career = null, next = null }) {
  const isBucket = sport === 'bucket'
  // soccer: a draw is a point, the table is points a game (2+ a title race, about 1 a relegation scrap)
  const isSoccer = sport === 'soccer'
  const onDef = pos === 'db' || pos === 'dl' || pos === 'lb'
  const k = ctx.games.length, total = stop.total, left = total - k
  const { wins, losses, streak, skid } = ctx
  const pace = k ? (wins / k) * total : 0
  const needIn = isBucket ? 42 : 9           // a realistic playoff line
  const lock = isBucket ? 50 : 10
  const has = new Set(types)
  const val = t => build?.[t]?.val ?? 5
  const L = t => attrMap?.[t]?.label ?? t
  const trainable = types.filter(t => has.has(t) && !FIXED.has(t))
  const sorted = (list, dir) => [...list].sort((a, b) => dir * (val(b) - val(a)))
  const roles = ROLE[pos] ?? {}
  // the traits of a role this build has (best first), and an effect on them
  const traitsOf = role => sorted((roles[role] ?? []).filter(t => has.has(t)), 1)
  const R = (role, n, k2 = 2) => Object.fromEntries(traitsOf(role).slice(0, k2).map(t => [t, n]))
  const R1 = (role, n) => R(role, n, 1)
  const T = {
    best: not => sorted(trainable, 1).find(t => t !== not) ?? trainable[0],
    worst: not => sorted(trainable, -1).find(t => t !== not) ?? trainable[0],
    has: t => has.has(t),
    one: (...cands) => cands.find(t => has.has(t)) ?? null,
  }
  const r = seeded(`scn-${seed}-${stop.at}`)
  const draws = ctx.draws ?? 0, ppg = k ? (wins * 3 + draws) / k : 0
  // (for the Career cards: the games he played, and how many in a row carry a hot or a cold streak's name)
  const played = ctx.games.filter(g => !g.sat)
  const tagRun = t => { let n = 0; for (let i = ctx.games.length - 1; i >= 0 && (ctx.games[i].tags ?? []).includes(t); i--) n++; return n }
  const soccer = isSoccer ? { alive: true, clinched: false, eliminated: false, bubble: false, contender: k >= 5 && ppg >= 2.05, struggling: k >= 5 && ppg <= 1.05, rec: `${wins}–${draws}–${losses}`, g: n => n, unitWord: 'matches', bench: !!team?.bench, draws, ppg } : {}
  return {
    team: team?.short ?? null,
    deals,                       // Career: () => who the front office can trade for (see career.js dealsFor)
    // Career: where the career stands (career.js lifeView), the game coming up, and his last few games
    cr: career, next, played, sumLast: (key, n) => played.slice(-n).reduce((s, g) => s + (g[key] ?? 0), 0),
    hotRun: tagRun('HOT STREAK'), coldRun: tagRun('COLD STRETCH'), hotNext: (next?.tags ?? []).includes('HOT STREAK'),
    sport, pos, isBucket, isDef: onDef, isOL: pos === 'ol', spot: pos === 'dl' ? (build?.size?.subpos === 'dt' ? 'dt' : 'edge') : null, stop, k, total, left, wins, losses, streak, skid, pace,
    rec: `${wins}–${losses}`, nick: teamNick, name, T, R, R1, roleHas: role => traitsOf(role).length > 0, L, val, r,
    alive: wins + left >= needIn, clinched: wins >= lock, eliminated: wins + left < needIn,
    bubble: wins + left >= needIn && wins < lock && pace >= needIn - (isBucket ? 8 : 2.5) && pace <= lock + (isBucket ? 4 : 1),
    contender: pace >= (isBucket ? 54 : 11.5), struggling: k >= 3 && pace <= (isBucket ? 33 : 6.5),
    last: ctx.last, lastWon: !!ctx.last?.won, lastBig, lastBust,
    opp: (ctx.last?.opponent || 'them').split(' ').slice(-1)[0],
    side: onDef ? 'defense' : 'offense', other: onDef ? 'offense' : 'defense',
    sideKey: onDef ? 'def' : 'off', otherKey: onDef ? 'off' : 'def',
    g: n => (isBucket ? Math.max(2, Math.round(n * 4)) : n),        // a football "week" in basketball games
    unitWord: isBucket ? 'games' : 'weeks',
    teamOff: team?.off, teamDef: team?.def,
    // an injury that fits this build: the body part, and only traits the build has
    // (its own seed, so asking twice gives the same injury)
    injury: () => {
      const list = (INJURIES[pos] ?? []).map(i => ({ ...i, hit: Object.fromEntries(Object.entries(i.hit).filter(([t]) => has.has(t))) })).filter(i => Object.keys(i.hit).length)
      return list.length ? list[Math.floor(seeded(`inj-${seed}-${stop.at}`)() * list.length)] : null
    },
    isSoccer, ...soccer,
    // (a sport that loads on its own reads the season its own way: baseball's playoff line, his slump or his streak)
    ...(CTX[sport] ? CTX[sport]({ k, total, left, wins, losses, streak, skid, pace, ctx, team, pos, build }) : {}),
  }
}

// option builder: label + effect (+ an optional flavor line before the fine print)
export const o = (id, label, effect, flavor) => ({ id, label, effect, flavor })
export const gam = (p, hit, hitLine, miss, missLine) => ({ gamble: { p, hit: { ...hit, line: hitLine }, miss: { ...miss, line: missLine } } })
// several trait changes in one: the numbers add up per trait
export const mix = (...parts) => parts.reduce((acc, p) => { for (const [t, d] of Object.entries(p || {})) acc[t] = (acc[t] || 0) + d; return acc }, {})
const half = hit => Object.fromEntries(Object.entries(hit).map(([t, d]) => [t, Math.round(d / 2) || -1]))

// ═════════════════════════════════════════════════════════════════════════════
// INJURIES — both sports (the body part decides everything)
// ═════════════════════════════════════════════════════════════════════════════
// the cards that stop a season over an injury (the director rations them: lib/seasonDirector.js)
export const INJURY_CARDS = new Set(['injury', 'concussion', 'po-hurt'])
export const INJURY = [
  { id: 'injury', at: ['early', 'mid', 'late', 'stretch'], w: 3, when: c => !!c.injury(),
    make: c => {
      const inj = c.injury()
      const tag = inj.name.toUpperCase()
      const out = inj.out, hurt = Math.min(inj.hurt, Math.max(1, c.left))
      return {
        kicker: 'INJURY REPORT', title: inj.name,
        body: `The ${c.isSoccer ? 'physios' : 'trainers'} say ${c.isBucket || c.isSoccer ? `${out} ${c.isSoccer ? 'matches' : 'games'}` : out === 1 ? 'a week' : `${out} weeks`} and it heals clean. ${c.name} can play on it, but it won't be right, and it could get worse.`,
        options: [
          o('sit', 'Sit until it heals', { sit: out, tag }, `The ${c.nick} play without him.`),
          o('play', 'Play through it', gam(0.65, { attr: inj.hit, window: hurt, tag: `PLAYING HURT`, dur: -0.3 }, `It held. Not right, but he played every ${c.isBucket || c.isSoccer ? 'minute' : 'snap'}.`,
            { attr: inj.hit, window: 1, tag: 'PLAYING HURT', dur: -0.6, then: { sit: out + (c.isBucket ? 3 : 1), tag } }, 'It gave out. Now he\'s out longer than if he\'d sat.')),
        ],
      }
    } },
  { id: 'concussion', at: ['early', 'mid', 'late'], w: 1, when: c => !c.isBucket,
    make: c => ({ kicker: 'INJURY REPORT', title: 'In the concussion protocol',
      body: `A helmet-to-helmet hit on Sunday. ${c.name} cleared the first tests. The doctors can sign off this week, or hold him one more.`,
      options: [
        o('clear', 'Clear it and play', gam(0.8, { sit: 1, tag: 'PROTOCOL' }, 'One week out, then back to normal.', { sit: 3, tag: 'PROTOCOL' }, 'The symptoms come back in practice. Three weeks out.')),
        o('wait', 'Take the extra week', { sit: 2, tag: 'PROTOCOL' }, 'Two weeks out. He comes back clear.'),
      ] }) },
  { id: 'wear', at: ['late', 'stretch'], w: 2, when: c => c.alive && c.roleHas('legs'),
    make: c => ({ kicker: 'STRETCH RUN', title: 'The body is wearing down',
      body: `${c.isSoccer ? 'Thirty matches' : c.isBucket ? 'Sixty games' : 'Thirteen weeks'} of hits. Nothing's torn, everything hurts. Manage it week to week, or rest now and be right for the playoffs.`,
      options: [
        o('manage', 'Manage it, keep playing', { attr: c.R('legs', -2), tag: 'WORN DOWN' }, 'Slower the rest of the way, playoffs included.'),
        o('rest', 'Rest now', { sit: c.g(1), tag: 'RESTED', then: { attr: c.R('legs', 1) } }, 'A week off, then the legs come back.'),
      ] }) },
]
export const PO_INJURY = [
  { id: 'po-hurt', at: ['playoffs'], w: 3, when: c => !!c.injury(),
    make: c => {
      const inj = c.injury()
      return { kicker: 'PLAYOFF INJURY REPORT', title: inj.name,
        body: `Nobody sits in the playoffs. The question is how ${c.name} plays on it.`,
        options: [
          o('straight', 'Play on it, no shortcuts', { attr: half(inj.hit) }, 'Not right, but nothing gets worse.'),
          o('shot', 'Take the shot and go', gam(0.6, {}, 'He felt nothing until Monday.', { attr: inj.hit }, 'It wore off by halftime.')),
        ] }
    } },
]

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL — every position
// ═════════════════════════════════════════════════════════════════════════════
const NFL_ALL = [
  { id: 'clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched && c.left >= 2,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest or keep playing?',
      body: `${c.nick} are in. ${c.left} games left that don't decide much, and every snap is a chance to get hurt before January.`,
      options: [
        o('rest', 'Sit a week, heal up', { sit: 1, tag: 'RESTED', then: { attr: c.R('legs', 1) } }, 'Fresh legs for January.'),
        o('play', 'Keep playing', gam(0.82, {}, 'Played it out, healthy.', { attr: c.R('legs', -2), tag: 'BANGED UP' }, 'Took a hit in a game that didn\'t matter, and he carries it into January.')),
      ] }) },
  { id: 'eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated && c.left >= 2,
    make: c => ({ kicker: 'ELIMINATED', title: 'What the last games are for',
      body: `${c.nick} are out. ${c.left} games left. Play them out for the numbers, or shut it down and get healthy.`,
      options: [
        o('play', 'Play it out', gam(0.85, { xp: 25 }, 'Played out the string without getting hurt. The stats count.', { sit: c.left, dur: -1, tag: 'INJURED' }, 'Hurt in a game that meant nothing. Done for the year, and it follows him into next season.')),
        o('shut', 'Shut it down', { sit: c.left, dur: 0.5, tag: 'SHUT DOWN' }, 'No more games, no more risk. A full offseason to heal.'),
      ] }) },
  { id: 'deadline-buy', at: ['mid'], w: 4, when: c => c.alive && !c.struggling,
    make: c => {
      const d = c.deals?.()
      if (d) return careerDeadline(c, d)
      // two real players on the table: an edge rusher and a weapon, from other teams
      const rush = nflTarget(c.r, NFL_RUSHERS, c.team, 10, 36)
      const gun = dealTarget(c.r, NFL_WEAPONS, c.team)
      if (!rush || !gun) return null
      return { kicker: 'TRADE DEADLINE', title: 'The GM has one pick to spend',
        body: `${c.nick} are buying, and there's one pick to spend. Two calls are live: ${rush.name} from the ${rush.teamName} or ${gun.name} from the ${gun.teamName}. The GM asks the leaders.`,
        options: [
          o('rusher', `Trade for ${rush.name}`, { team: { def: 1.5 } }, `${last(rush.name)} (${rush.pos}) lines up off the edge the rest of the way. Quarterbacks feel him.`),
          o('help', `Trade for ${gun.name}`, { team: { off: 1.5 } }, `${last(gun.name)} is a new target at ${gun.role} the rest of the way. The offense opens up.`),
          o('stand', 'Keep the pick, keep the chemistry', { team: { off: 0.5, def: 0.5 } }, 'No new faces. Everyone knows their job.'),
        ] }
    } },
  { id: 'deadline-sell', at: ['mid'], w: 5, when: c => c.struggling,
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'The sell-off',
      body: `${c.nick} are moving veterans for picks. The team gets worse now. Ride it out, or ask to be moved too?`,
      options: [
        o('ride', 'Ride it out', { team: { off: -1.5, def: -1.5 } }, 'A thinner roster the rest of the way.'),
        o('out', 'Ask to be moved too', gam(0.4, { team: { off: -1.5, def: -1.5 }, xp: 40 }, 'They say no, but the front office respects it.', { team: { off: -2, def: -2 }, tag: 'ROOM TURNED' }, 'It leaked. The locker room turns on him.')),
      ] }) },
  { id: 'oc-fired', at: ['mid', 'late'], w: 3, when: c => c.struggling && !c.isDef,
    make: () => ({ kicker: 'STAFF CHANGE', title: 'The coordinator is gone',
      body: 'The play caller was fired on Monday. A new voice, a new install, and no time to learn it.',
      options: [
        o('buy', 'Buy in fast', gam(0.55, { team: { off: 1.5 } }, 'It clicks. The offense looks new.', { team: { off: -1.5 }, window: 3, tag: 'NEW SCHEME', then: { team: { off: 1 } } }, 'Three busted weeks, then it starts to work.')),
        o('keep', 'Lobby to keep the old plays', gam(0.5, { team: { off: 0.5 } }, 'They keep what works. Steadier.', { team: { off: -0.5 } }, 'Half old, half new: nobody knows the plays.')),
      ] }) },
]
const QB = [
  { id: 'qb-benched', at: ['mid', 'late'], w: 5, when: c => c.lastBust && c.skid >= 2,
    make: () => ({ kicker: 'BENCHED', title: 'The coach goes to the backup',
      body: `Picks and losses. ${c.name} is sitting this week. Take the message, or fight for the job in practice?`,
      options: [
        o('accept', 'Take the week', { sit: 1, tag: 'BENCHED' }, 'One week on the sideline, then the job is yours again.'),
        o('fight', 'Fight for the job in practice', gam(0.5, {}, 'He wins the room back. He starts Sunday.', { sit: 3, tag: 'BENCHED' }, 'The coach doesn\'t budge. Three weeks on the bench.')),
      ] }) },
]
const RB = [], WR = [], TE = [], DB = [], OL = [], LB = []
// The line's own season. Real choices up front: a slide coming your way, a snap count on film,
// an early-down job that costs sacks, your weight in December, a coordinator on the way out.
const DL = [
  { id: 'dl-slide', at: ['early', 'mid', 'late'], w: 3, when: c => c.k >= 3 && c.roleHas('make'),
    make: c => ({ kicker: 'GAME PLAN', title: 'The slide is coming his way',
      body: `The tape got around. Teams are sliding the protection toward ${c.name} and chipping him with a back on every dropback. The line coach has two answers.`,
      options: [
        o('fight', 'Stay put and beat it', { attr: mix(c.R('power', 2), c.R1('make', -1)), window: 3, tag: 'SEEING DOUBLES' }, 'Heavy hands through two blockers. Fewer clean shots, but they pay for sending two.'),
        o('move', 'Move all over the front', { attr: c.R1('make', 2), team: { def: -0.5 }, window: 3, tag: 'MOVED AROUND' }, c.spot === 'dt' ? 'Over the center, then a three-technique, then standing up on the edge. The run fits get loose.' : 'Left end, right end, inside on third down. The run fits get loose.'),
      ] }) },
  { id: 'dl-snap-count', at: ['early', 'mid'], w: 2, when: c => c.T.has('getOff'),
    make: c => ({ kicker: 'FILM ROOM', title: 'A tell in the snap count',
      body: `Late night in the film room: next week's center dips his head before the ball moves. Or ${c.name} thinks he does. Anticipate it, or trust his eyes?`,
      options: [
        o('jump', 'Sit on the tell', gam(0.6, { attr: { getOff: 2 }, window: 3, tag: 'ON THE SNAP' }, 'He\'s in the backfield before the guard stands up.', { attr: { getOff: -2 }, window: 2, tag: 'OFFSIDES' }, 'They saw him coming and drew him offsides twice. Now he\'s a beat late.')),
        o('eyes', 'Play the ball, not the guess', { attr: c.R1('mind', 1), window: 3, tag: 'DIALED IN' }, 'No free yards. A cleaner read on the run.'),
      ] }) },
  { id: 'dl-two-gap', at: ['mid', 'late'], w: 3, when: c => c.roleHas('make'),
    make: c => ({ kicker: 'DEFENSIVE STAFF', title: 'They want him two-gapping',
      body: `The run defense is leaking, and the coordinator wants ${c.name} reading on early downs instead of getting up the field. Better for the team, and it costs him rushes.`,
      options: [
        o('two', 'Do the dirty work', { attr: c.R1('make', -1), team: { def: 1 }, tag: 'TWO-GAPPING' }, 'The run dries up. His sack numbers pay for it.'),
        o('one', 'Keep getting up the field', { attr: c.R1('make', 1), team: { def: -0.5 } }, `The sacks keep coming, and backs keep running through where he was.`),
      ] }) },
  { id: 'dl-weight', at: ['late', 'stretch'], w: 2, when: c => c.alive && c.T.has('strength') && c.roleHas('legs'),
    make: c => ({ kicker: 'STRETCH RUN', title: c.spot === 'dt' ? 'Playing at 320 in December' : 'Heavy legs in December',
      body: c.spot === 'dt' ? `The strength staff wants ten pounds off ${c.name} for the stretch: quicker off the ball, easier to move. He has held his spot at this weight all year.` : `Hands and legs are going. The strength staff wants ten pounds off ${c.name} so he can still turn the corner, or he can keep the weight and the anchor.`,
      options: [
        o('cut', 'Drop the weight', { attr: mix(c.R1('legs', 2), { strength: -2 }), tag: 'LIGHTER' }, 'A step quicker, a little easier to wash out.'),
        o('keep', 'Keep it on', { attr: mix({ strength: 1 }, c.R1('legs', -1)), tag: 'HEAVY' }, 'Nobody moves him. Nobody is outrunning anybody either.'),
      ] }) },
  { id: 'dc-fired', at: ['mid', 'late'], w: 3, when: c => c.struggling,
    make: () => ({ kicker: 'STAFF CHANGE', title: 'The coordinator is gone',
      body: 'The defensive coordinator was fired on Monday. The line coach takes over the calls with a new front and no time to learn it.',
      options: [
        o('buy', 'Buy in fast', gam(0.55, { team: { def: 1.5 } }, 'It clicks. The front looks new.', { team: { def: -1.5 }, window: 3, tag: 'NEW FRONT', then: { team: { def: 1 } } }, 'Three busted weeks, then it starts to work.')),
        o('keep', 'Lobby to keep the old calls', gam(0.5, { team: { def: 0.5 } }, 'They keep what works. Steadier.', { team: { def: -0.5 } }, 'Half old, half new: nobody knows their gap.')),
      ] }) },
]
// A Career's deadline (football): two real players who'd start, from other teams,
// a weapon and a lineman for an offense, a corner and a safety for a DB. The one
// picked joins the roster (career.js), and the fine print is what that does to the team.
const LB_TARGETS = d => LBS.map(p => ({ ...p, group: 'lb', role: 'linebacker', ovr: d.ovr('lb', p) })).sort((a, b) => b.ovr - a.ovr)
function careerDeadline(c, d) {
  const lists = c.pos === 'lb'
    ? [LB_TARGETS(d), DLS.filter(p => p.subpos !== 'dt').map(p => ({ ...p, group: 'dl', role: 'edge rusher', ovr: d.ovr('dl', p) })).sort((a, b) => b.ovr - a.ovr)]
    : c.pos === 'dl'
    ? ['edge', 'dt'].map(sp => DLS.filter(p => p.subpos === sp).map(p => ({ ...p, group: 'dl', role: sp === 'dt' ? 'defensive tackle' : 'edge rusher', ovr: d.ovr('dl', p) })).sort((a, b) => b.ovr - a.ovr))
    : c.isDef
    ? ['cb', 's'].map(sp => DBS.filter(p => (p.subpos === 's' ? 's' : 'cb') === sp).map(p => ({ ...p, group: 'db', role: sp === 's' ? 'safety' : 'corner', ovr: d.ovr('db', p) })).sort((a, b) => b.ovr - a.ovr))
    : [NFL_WEAPONS, NFL_LINE]
  const a = dealTarget(c.r, lists[0], c.team, { ok: d.ok })
  const b = dealTarget(c.r, lists[1], c.team, { ok: d.ok, not: a?.name })
  if (!a || !b) return null
  const from = p => p.teamName ?? p.team
  const joins = p => (p.group === 'ol' ? `${last(p.name)} takes over at ${p.pos} the rest of the way.` : p.group === 'db' || p.group === 'dl' || p.group === 'lb' ? `${last(p.name)} lines up at ${p.role} the rest of the way.` : `${last(p.name)} is a new target at ${p.role} the rest of the way.`)
  return { kicker: 'TRADE DEADLINE', title: 'The GM has one pick to spend',
    body: `${c.nick} are buying, and there's one pick to spend. Two calls are live: ${a.name} from the ${from(a)} or ${b.name} from the ${from(b)}. The GM asks the leaders.`,
    options: [
      o('deal-a', `Trade for ${a.name}`, dealFx(d, a), joins(a)),
      o('deal-b', `Trade for ${b.name}`, dealFx(d, b), joins(b)),
      o('stand', 'Keep the pick, keep the chemistry', { team: { off: 0.5, def: 0.5 } }, 'No new faces. Everyone knows their job.'),
    ] }
}

// ═════════════════════════════════════════════════════════════════════════════
// FOOTBALL — playoffs (only when you're in)
// ═════════════════════════════════════════════════════════════════════════════
const NFL_PLAYOFFS = [
  { id: 'po-plan', at: ['playoffs'], w: 5, when: () => true,
    make: c => ({ kicker: 'PLAYOFF WEEK', title: 'How do they win it?',
      body: `One-and-done football. The staff asks whether the postseason runs through ${c.name}, or through the whole roster.`,
      options: [
        o('me', 'Through me', { attr: mix(c.R('make', 2), c.R1('feel', 1)), team: { [c.otherKey]: -1 } }, 'His best football. The other side of the ball is exposed.'),
        o('control', 'Ball control, field position', { team: { def: 1.5 }, attr: c.R('make', -2) }, 'Fewer chances, fewer mistakes.'),
        o('all', 'Everyone, all in', { team: { off: 1, def: 1 }, xp: 25 }, 'Balanced. Boring. Dangerous.'),
      ] }) },
]

// ═════════════════════════════════════════════════════════════════════════════
// BASKETBALL
// ═════════════════════════════════════════════════════════════════════════════
const NBA_ALL = [
  { id: 'nba-deadline', at: ['mid', 'late'], w: 3, when: c => c.alive,
    make: c => {
      const d = c.deals?.()
      const star = dealTarget(c.r, NBA_SCORERS, c.team, { ok: d?.ok })
      const stop = dealTarget(c.r, NBA_STOPPERS, c.team, { lo: 76, ok: d?.ok, not: star?.name })
      if (!star || !stop) return null
      return { kicker: 'TRADE DEADLINE', title: 'The front office calls',
        body: `Two deals on the table. ${star.name} from ${star.team} for next year's picks, or ${stop.name} from ${stop.team} for the bench. Or stand pat.`,
        options: [
          o('rental', `Trade for ${star.name}`, dealFx(d, star, { off: 2 }), `${star.name} is a second scorer the rest of the way.`),
          o('depth', `Trade for ${stop.name}`, dealFx(d, stop, { def: 1.5 }), `${stop.name} takes the other team's best player in the fourth quarter.`),
          o('pat', 'Stand pat', { team: { off: 0.5, def: 0.5 } }, 'Chemistry intact.'),
        ] }
    } },
  { id: 'nba-clinched', at: ['late', 'stretch'], w: 5, when: c => c.clinched && c.left >= 5,
    make: c => ({ kicker: 'CLINCHED', title: 'Rest for the playoffs?', body: `${c.nick} have a playoff spot. ${c.left} games left.`,
      options: [
        o('rest', 'Load management', { sit: 4, tag: 'LOAD MANAGEMENT', then: { attr: c.R('legs', 1) } }, 'Four nights off. Fresh for the playoffs.'),
        o('seed', 'Chase the top seed', gam(0.8, {}, 'Played every night, healthy.', { attr: c.R('legs', -2), tag: 'BANGED UP' }, 'Banged up in a game that didn\'t matter. He carries it into the playoffs.')),
      ] }) },
  { id: 'nba-eliminated', at: ['late', 'stretch'], w: 6, when: c => c.eliminated && c.left >= 4,
    make: c => ({ kicker: 'OUT OF IT', title: 'Season\'s over', body: `${c.nick} won't make the playoffs. ${c.left} games left. Keep playing, or rest up for next year?`,
      options: [
        o('play', 'Play it out', gam(0.85, { xp: 25 }, 'Finished the season healthy. The numbers count.', { sit: c.left, dur: -1, tag: 'INJURED' }, 'Hurt in a meaningless game. Done for the year, and it follows him into next season.')),
        o('shut', 'Shut it down', { sit: c.left, dur: 0.5, tag: 'SHUT DOWN' }, 'Healthy into the summer. A full offseason to heal.'),
      ] }) },
]
const GUARD = [], BIG = []
const NBA_PLAYOFFS = [
  { id: 'nbapo-takeover', at: ['playoffs'], w: 2, when: () => true,
    make: c => ({ kicker: 'BEFORE THE PLAYOFFS', title: 'The second season', body: `The stage gets bigger. How does ${c.name} want to play the postseason?`,
      options: [
        o('takeover', 'Take over', { attr: mix(c.R('make', 2), c.R1('feel', 1)), team: { def: -1 } }, 'His usage through the roof; the defense pays.'),
        o('steady', 'Trust the system', { team: { off: 1, def: 1 } }, 'Five guys, one plan.'),
      ] }) },
  { id: 'nbapo-minutes', at: ['playoffs'], w: 2, when: c => c.roleHas('legs'),
    make: c => ({ kicker: 'PLAYOFF MINUTES', title: '44 minutes a night?', body: `The coach asks if ${c.name} can handle more minutes.`,
      options: [
        o('more', 'Play me 44', { attr: mix(c.R1('make', 2), c.R('legs', -2)) }, 'More of him, on tired legs.'),
        o('normal', 'Normal minutes', { team: { off: 1 } }, 'The bench keeps him fresh.'),
      ] }) },
]

// ── The kicker: his own bank ────────────────────────────────────────────────
// A kicker is never hurt, isn't asked about trades and doesn't have a scheme, so none of the cards above are his.
// Most of his decisions are kicks inside a game (lib/gameMoments.js NFL.k); these are the ones that span weeks.
const kOdds = (c, t, base) => Math.max(0.25, Math.min(0.9, base + c.val(t) * 0.045))
const K = [
  { id: 'k-holder', at: ['early', 'mid'], w: 3, when: c => c.k >= 2,
    make: c => ({ kicker: 'SPECIAL TEAMS', title: 'A new holder',
      body: `The punter who holds for ${c.name} is out for a month. The backup quarterback takes the snaps on field goals starting Sunday.`,
      options: [
        o('reps', 'Stay after practice with him all week', gam(0.7, { attr: { accuracy: 1 }, window: 4, tag: 'NEW HOLDER' }, 'The operation is clean by Sunday: snap, spot, laces out.', { attr: { accuracy: -1 }, window: 2, tag: 'NEW HOLDER' }, 'Still a beat slow on Sunday. A couple of kicks come off the laces.')),
        o('trust', 'Keep the routine, trust the hold', { attr: { accuracy: -1 }, window: 3, tag: 'NEW HOLDER' }, 'A few weeks of holds that aren\u2019t quite where he wants them.'),
      ] }) },
  { id: 'k-workout', at: ['mid', 'late', 'stretch'], w: 5, when: c => c.lastBust,
    make: c => ({ kicker: 'ON NOTICE', title: 'Kickers in for a workout',
      body: `After Sunday, the ${c.nick} brought three kickers in on Tuesday. The job is still ${c.name}\u2019s, and everyone in the building knows why they were there.`,
      options: [
        o('kick', 'Say nothing, go kick', gam(kOdds(c, 'clutch', 0.35), { attr: { clutch: 1, accuracy: 1 }, window: 4, tag: 'ANSWERED' }, 'Perfect on Sunday. The workout list goes in a drawer.', { attr: { accuracy: -2 }, window: 2, tag: 'PRESSING' }, 'He\u2019s aiming the ball instead of kicking it.')),
        o('film', 'Break the swing down with the coach', { attr: { accuracy: 1, power: -1 }, window: 3, tag: 'SHORTER SWING' }, 'A shorter, safer swing for a few weeks: straighter, not as long.'),
      ] }) },
  { id: 'k-range', at: ['early', 'mid'], w: 2, when: c => c.k >= 1,
    make: c => ({ kicker: 'PREGAME', title: 'The coach wants his number',
      body: `Every week the special teams coach asks ${c.name} for a line: the yard line where a field goal is in range. The coach calls the game off that number.`,
      options: [
        o('honest', 'Give him the honest number', { attr: { accuracy: 1 }, window: 4, tag: 'INSIDE HIS RANGE' }, 'Fewer long tries, better looks.'),
        o('long', 'Add five yards to it', gam(kOdds(c, 'power', 0.28), { attr: { power: 1 }, window: 4, tag: 'GREEN LIGHT' }, 'He backed it up. The coach starts sending him out from anywhere.', { attr: { accuracy: -1, clutch: -1 }, window: 3, tag: 'OUT OF RANGE' }, 'Two misses from too far out, and now the coach doesn\u2019t believe the number.')),
      ] }) },
  { id: 'k-cold', at: ['late', 'stretch'], w: 3, when: c => K_COLD.has(c.team) && !K_DOMES.has(c.team),
    make: c => ({ kicker: 'DECEMBER', title: 'The ball is a rock',
      body: `The rest of the home schedule is outdoors in the cold. A cold ball doesn\u2019t compress and it doesn\u2019t carry, and the wind at this end of the stadium moves it a full upright.`,
      options: [
        o('drive', 'Drive it lower and hold the line', { attr: { accuracy: 1, power: -1 } }, 'A flatter ball that holds its line in the wind and comes up shorter.'),
        o('swing', 'Same swing, read the flags', gam(0.5, { attr: { power: 1 }, window: 3, tag: 'DIALED IN' }, 'He found the wind in warmups every week.', { attr: { accuracy: -1 }, window: 3, tag: 'FIGHTING THE WIND' }, 'The wind won more than he did.')),
      ] }) },
]
const K_PLAYOFFS = [
  { id: 'k-po-week', at: ['playoffs'], w: 5, when: () => true,
    make: c => ({ kicker: 'PLAYOFF WEEK', title: 'January kicking',
      body: `One-score games, bad weather and no next week. The special teams coach asks ${c.name} how he wants to spend the practice week.`,
      options: [
        o('live', 'Live reps with the rush coming', { attr: { clutch: 1 } }, 'Every kick this week has a hand in his face.'),
        o('range', 'Stretch the range', { attr: { power: 1, accuracy: -1 } }, 'Long ones all week. The short ones get less work.'),
        o('rest', 'A light week, save the leg', { attr: { accuracy: 1 } }, 'A fresh leg and the same swing.'),
      ] }) },
]

// ═════════════════════════════════════════════════════════════════════════════
// CAREER — the cards about the career and the team (the LIFE bank)
// ═════════════════════════════════════════════════════════════════════════════
// Career only, football and basketball. The director hands these the career's view (c.cr: lib/career.js
// lifeView) and every card's `when` reads it, so a card only comes up where it is true: a rookie card needs
// a rookie, a contract-year card a deal that is up, a card that names a teammate or an opponent a real man
// at that spot on that roster. They are dealt at the season's own LIFE stops (seasonDirector.js) and at a
// decision week where nothing above fits; the cards above are dealt exactly as they were. Two kinds:
//   a stretch   the usual effects (traits for a few games, the team, a game sat, XP), the fine print written
//               from the effect. These never name the next opponent: a choice re-simulates the games after it.
//   inGame      about the next game and a man in it (a corner travelling with their best receiver). The choice
//               adds to his line in that game, the way an in-game moment does, and that game is kept as it is.
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen']
const num = n => NUM[n] ?? String(n)
const Num = n => cap(num(n))
const NTH = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th']
const nth = n => NTH[n - 1] ?? `${n}th`
const ANY = ['early', 'mid', 'late', 'stretch']
// his role this week: a starter, in the rotation (football), off the bench (basketball), or waiting (a backup who doesn't play)
const starts = c => c.cr.role === 'starter'
const plays = c => c.cr.role !== 'waiting'
// the odds of a gamble from the traits it rides on (a C+ is the base; shown as a clean 5%)
const pOf = (c, base, traits, per = 0.05) => {
  const ts = traits.filter(t => c.T.has(t))
  const avg = ts.length ? ts.reduce((s, t) => s + c.val(t), 0) / ts.length : 6
  return Math.round(Math.max(0.25, Math.min(0.8, base + (avg - 6) * per)) * 20) / 20
}
const top = list => [...list].sort((a, b) => b.ovr - a.ovr)[0] ?? null
const at = (list, ...slots) => list.filter(p => slots.includes(String(p.slot ?? '').toUpperCase()))
// the oldest man in his position group (30 or older), and the best young one at his own spot (24 or younger)
const vetOf = c => [...c.cr.men(c.pos)].filter(p => p.age >= 30).sort((a, b) => b.age - a.age)[0] ?? null
const kidOf = c => top(c.cr.room.filter(p => p.age <= 24))
// what sets the price at each position, and how a hot or a cold run reads there
const PAID = { qb: 'Touchdown passes', rb: 'Rushing yards', wr: 'Catches and yards', te: 'Catches and yards', ol: 'Clean sheets in pass protection', dl: 'Sacks', lb: 'Tackles and sacks', db: 'Interceptions', guard: 'Points', big: 'Points and rebounds' }
const HOT = { qb: 'the ball is coming out on time', rb: 'the holes look a yard wider', wr: 'he is open before the ball is thrown', te: 'he is winning every matchup', ol: 'nobody is getting past him', dl: 'tackles can\'t stay in front of him', lb: 'he is at the ball before the blockers are', db: 'quarterbacks have stopped looking his way', guard: 'every shot looks good off his hand', big: 'everything around the rim is going in' }
const COLD = { qb: 'The ball is sailing on him.', rb: 'The holes close before he gets there.', wr: 'The ball isn\'t finding him.', te: 'The ball isn\'t finding him.', ol: 'He is a half-step late off the snap.', dl: 'He hasn\'t gotten home in weeks.', lb: 'He is a step late to the ball.', db: 'Quarterbacks are completing passes on him.', guard: 'The shot is flat and short.', big: 'He is missing the ones he always makes.' }
const BUST = {
  qb: g => `${g.passYds} yards${g.ints ? ` and ${num(g.ints)} interception${g.ints === 1 ? '' : 's'}` : ''}`, rb: g => `${g.rushYds} rushing yards`, wr: g => `${g.recYds} receiving yards`, te: g => `${g.recYds} receiving yards`,
  dl: () => 'Not a sack, not a hit on the quarterback', lb: g => `${Num(g.missed ?? 0)} missed tackles`, ol: g => `${Num(g.sacks ?? 0)} sacks allowed`, guard: g => `${g.pts} points`, big: g => `${g.pts} points`,
}
const OL_NAME = { LT: 'left tackle', LG: 'left guard', C: 'center', RG: 'right guard', RT: 'right tackle' }
const OL_NEXT = { LT: ['LG'], LG: ['LT', 'C'], C: ['LG', 'RG'], RG: ['C', 'RT'], RT: ['RG'] }
// a stretch in games: football's, basketball's
const G = (c, nfl, nba) => (c.isBucket ? nba : nfl)
const shareWord = u => (u >= 0.5 ? 'half the snaps' : u >= 0.4 ? 'almost half the snaps' : u >= 0.3 ? 'about a third of the snaps' : 'a handful of snaps a game')

// ── Both sports ──────────────────────────────────────────────────────────────
const LIFE_ANY = [
  { id: 'ct-year', at: ['mid', 'late'], w: 3, when: c => c.cr.contractYear && starts(c) && c.left >= 3 && c.roleHas('make') && c.roleHas('feel'),
    make: c => ({ kicker: 'CONTRACT YEAR', title: 'Playing for the next deal',
      body: `${c.name}'s contract is up after the season. ${PAID[c.pos]} set the price, the ${c.nick} are ${c.rec}, and the game plan doesn't always run through him.`,
      options: [
        o('mine', c.pos === 'ol' ? 'Hunt the highlight blocks' : 'Hunt the numbers', { attr: c.isBucket ? mix(c.R1('feel', 1), c.R1('power', 1)) : c.R('make', 1), team: { [c.sideKey]: -0.5 } }, `More plays made outside the plan. The ${c.side} pays for it.`),
        o('team', 'Play the plan', { attr: c.R1(c.isBucket ? 'feel' : 'make', -1), team: { [c.sideKey]: 0.5 } }, 'The tape shows a winner. The stat line is thinner.'),
      ] }) },
  { id: 'trade-rumor', at: ['mid'], w: 3, when: c => !c.cr.rookie && plays(c) && c.pos !== 'qb' && (c.struggling || !starts(c) || (c.cr.contractYear && !c.contender)) && c.roleHas('nerve'),
    make: c => ({ kicker: 'TRADE DEADLINE', title: 'His name is in the rumors',
      body: !starts(c) ? `${c.name} isn't starting, and a report says two teams have called the ${c.nick} about him before the deadline.`
        : c.struggling ? `The ${c.nick} are ${c.rec}, and a report says they are taking calls on ${c.name} before the deadline.`
        : `${c.name}'s contract is up after the season, and a report says the ${c.nick} are listening to offers before the deadline.`,
      options: [
        o('ask', 'Ask the GM straight', gam(0.55, { attr: c.R1('nerve', 1), window: G(c, 4, 14), tag: 'STAYING PUT' }, 'The GM tells him he is not going anywhere. He plays loose again.',
          { attr: c.R1('nerve', -2), window: G(c, 3, 10), tag: 'TRADE RUMORS' }, 'No straight answer. He plays with a bag half packed until the deadline passes.')),
        o('quiet', 'Keep his head down', { attr: c.R1('nerve', -1), window: G(c, 2, 6), tag: 'TRADE RUMORS' }, 'The deadline passes. So does the noise.'),
      ] }) },
  { id: 'skid-meeting', at: ANY, w: 4, when: c => c.skid >= (c.isBucket ? 5 : 3) && plays(c) && c.left >= (c.isBucket ? 12 : 3) && c.roleHas('nerve') && c.roleHas('mind'),
    make: c => {
      const lead = c.cr.year >= 5 || (c.cr.year >= 3 && (c.cr.captain || c.cr.rep >= 6)), W = c.isBucket ? 8 : 3
      return lead ? { kicker: 'LOCKER ROOM', title: 'Players-only meeting',
        body: `${Num(c.skid)} straight losses, and the ${c.nick} are ${c.rec}. The veterans close the doors, and the room waits for ${c.name} to talk.`,
        options: [
          o('speak', 'Say what nobody wants to hear', gam(0.55, { team: { off: 1, def: 1 }, window: W, tag: 'AIRED OUT' }, 'It needed saying. Practice is different the next day.',
            { team: { off: -0.5, def: -0.5 }, window: W, tag: 'ROOM DIVIDED' }, 'He named names. Half the room stopped listening.')),
          o('work', 'Keep it short, go back to work', { team: { [c.sideKey]: 0.5 }, window: W }, `No speech. He is the first one back on the practice ${c.isBucket ? 'floor' : 'field'}, and they follow.`),
        ] } : { kicker: 'LOCKER ROOM', title: 'Players-only meeting',
        body: `${Num(c.skid)} straight losses, and the ${c.nick} are ${c.rec}. The veterans close the doors. ${c.name} is ${c.cr.rookie ? 'a rookie' : `in his ${nth(c.cr.year)} year`}, and he has something to say.`,
        options: [
          o('speak', 'Stand up and say it', gam(0.35, { team: { off: 1, def: 1 }, window: W, tag: 'AIRED OUT' }, 'The room goes quiet. Then a captain backs him up.',
            { attr: c.R1('nerve', -1), window: W, tag: 'OUT OF TURN' }, 'A veteran tells him to sit down. He hears about it all week.')),
          o('listen', 'Listen, then get to work', { attr: c.R1('mind', 1), window: W }, 'He says nothing and stays late that night.'),
        ] }
    } },
  { id: 'streak-media', at: ['mid', 'late', 'stretch'], w: 3, when: c => c.streak >= (c.isBucket ? 6 : 4) && starts(c) && c.roleHas('mind'),
    make: c => ({ kicker: 'THE SPOTLIGHT', title: 'Everybody wants a piece',
      body: `${Num(c.streak)} straight wins, and every show wants ${c.name} this week: two national radio spots, a sit-down for the ${c.isBucket ? 'national broadcast' : 'pregame show'}, a photo shoot on his day off.`,
      options: [
        o('yes', 'Say yes to all of it', { xp: 30, attr: c.R1('mind', -1), window: G(c, 2, 6), tag: 'EVERYWHERE' }, 'His face is on every show. His week of prep is shorter.'),
        o('no', 'Turn it all down', { attr: c.R1('mind', 1), window: G(c, 2, 6), tag: 'LOCKED IN' }, 'The PR staff says no for him. He stays on his schedule.'),
      ] }) },
  { id: 'hot-run', at: ANY, w: 4, when: c => c.hotRun >= 2 && c.hotNext && starts(c) && c.roleHas('make') && c.roleHas('legs') && c.roleHas('nerve'),
    make: c => ({ kicker: 'HOT STREAK', title: 'Ride it',
      body: `${c.name} has had ${num(c.hotRun)} big games in a row, and ${HOT[c.pos]}. The ${c.isBucket ? 'coach' : 'coordinator'} asks if he wants more on his plate while it lasts.`,
      options: [
        o('more', 'Ask for more', { attr: mix(c.R1('make', 1), c.R1('legs', -1)), window: G(c, 3, 6), tag: 'FEATURED' }, `More of the ${c.side} runs through him. His legs pay for it.`),
        o('same', 'Change nothing', { attr: c.R1('nerve', 1), window: G(c, 2, 5) }, 'Same routine, same seat on the bus.'),
      ] }) },
  { id: 'cold-run', at: ANY, w: 4, when: c => c.coldRun >= 2 && starts(c) && c.roleHas('feel') && c.roleHas('legs') && c.roleHas('nerve'),
    make: c => ({ kicker: 'SLUMP', title: 'Nothing is falling his way',
      body: `${Num(c.coldRun)} quiet games in a row. ${COLD[c.pos]} Nobody on the staff is worried yet. ${c.name} is.`,
      options: [
        o('work', 'Stay late every day', gam(0.55, { attr: c.R('feel', 1), window: G(c, 3, 8), tag: 'EXTRA WORK' }, 'Something clicks late in the week. It carries over.',
          { attr: c.R1('legs', -1), window: G(c, 2, 5), tag: 'OVERWORKED' }, 'More reps, the same result, and now he is tired.')),
        o('reset', 'Take a day away from the building', { attr: c.R1('nerve', 1), window: G(c, 3, 8), tag: 'CLEAR HEAD' }, 'One day with the phone off. He comes back lighter.'),
      ] }) },
  { id: 'podium', at: ANY, w: 3, when: c => c.lastBust && !c.lastWon && starts(c) && c.cr.year >= 2 && !!BUST[c.pos] && c.roleHas('nerve') && c.roleHas('make'),
    make: c => ({ kicker: 'AT THE PODIUM', title: 'A column says he is the problem',
      body: `${BUST[c.pos](c.last)} in a loss${c.isBucket ? '' : ` to the ${c.opp}`}, and a columnist writes that the ${c.nick} can't win with ${c.name}. The reporters are waiting at his locker.`,
      options: [
        o('own', 'Own it', { attr: c.R1('nerve', 1), window: G(c, 2, 6), tag: 'ACCOUNTABLE' }, 'Every question answered. The locker room notices.'),
        o('fire', 'Fire back', gam(0.4, { attr: c.R('make', 1), window: G(c, 2, 6), tag: 'CHIP ON HIS SHOULDER' }, 'He plays angry, and it works.',
          { attr: c.R1('nerve', -2), window: G(c, 2, 6), tag: 'DISTRACTION' }, 'The quote leads every show all week. He presses.')),
      ] }) },
  { id: 'new-team', at: ['early'], w: 4, when: c => c.cr.newTeam && plays(c) && c.k >= 2 && c.roleHas('mind'),
    make: c => ({ kicker: 'NEW TEAM', title: 'Still learning the language',
      body: `New city, new ${c.isBucket ? 'system' : 'playbook'}, new locker room. ${Num(c.k)} games in with the ${c.nick}, ${c.name} still hears a call and thinks of what it meant on his old team.`,
      options: [
        o('book', 'Live in the playbook', { attr: c.R1('mind', 1), window: G(c, 4, 12), tag: 'SETTLING IN' }, 'Flash cards on the plane. The calls start to slow down.'),
        o('room', c.isBucket ? 'Have the team over every week' : 'Have the whole unit over every week', { team: { [c.sideKey]: 0.5 } }, `Dinner at his place, his bill. ${c.isBucket ? 'A team' : c.sideKey === 'off' ? 'An offense' : 'A defense'} that knows each other.`),
      ] }) },
  { id: 'new-staff', at: ['early'], w: 5, when: c => !c.cr.newTeam && !c.cr.rookie && plays(c) && c.k >= 2 && c.cr.news.some(n => n === 'coach-fired' || n === 'new-coach' || (n === 'new-oc' && !c.isDef && c.pos !== 'qb')) && c.roleHas('mind'),
    make: c => ({ kicker: 'NEW STAFF', title: 'A new way of doing things',
      body: `The ${c.nick} ${c.cr.news.some(n => n === 'coach-fired' || n === 'new-coach') ? 'changed head coaches' : 'hired a new offensive coordinator'} in the offseason, and the new staff does everything its own way. ${Num(c.k)} games in, ${c.name} is still thinking about the ${c.isBucket ? 'sets' : 'calls'} instead of playing.`,
      options: [
        o('extra', 'Ask the coaches for extra meetings', { attr: c.R1('mind', 1), window: G(c, 4, 12), tag: 'EXTRA MEETINGS' }, 'An hour with the staff after everyone else has gone home.'),
        o('lead', 'Run walkthroughs without the coaches', gam(0.5, { team: { [c.sideKey]: 1 }, window: G(c, 4, 12), tag: 'PLAYERS BOUGHT IN' }, `The whole ${c.isBucket ? 'team' : c.side} shows up. It shows on game day.`,
          { team: { [c.sideKey]: -0.5 }, window: G(c, 2, 6) }, `Half the ${c.isBucket ? 'team' : 'unit'} shows up. The other half hears about it.`)),
      ] }) },
]

// ── Football: every position ─────────────────────────────────────────────────
// A play made, or given up, inside a game (the inGame cards): what it adds to his line and how it reads
const EDGE = {
  qb: { up: { passYds: 41 }, upTxt: 'a 41-yard strike down the sideline', dn: { ints: 1 }, dnTxt: 'an interception' },
  rb: { up: { carries: 4, rushYds: 33 }, upTxt: 'four more carries for 33 yards', dn: { carries: 1, fumbles: 1 }, dnTxt: 'a fumble' },
  wr: { up: { targets: 2, rec: 2, recYds: 34 }, upTxt: 'two more catches for 34 yards', dn: { targets: 1, drops: 1 }, dnTxt: 'a drop on third down' },
  te: { up: { targets: 2, rec: 2, recYds: 23 }, upTxt: 'two more catches for 23 yards', dn: { targets: 1, drops: 1 }, dnTxt: 'a drop on third down' },
  ol: { up: { pancakes: 2 }, upTxt: 'two more pancakes', dn: { penalties: 1 }, dnTxt: 'a holding flag' },
  dl: { up: { sacks: 1, qbHits: 1, tackles: 1 }, upTxt: 'a sack', dn: {}, dnTxt: 'an offsides flag that kept a drive alive' },
  lb: { up: { tackles: 3, tfl: 1 }, upTxt: 'three more tackles, one for a loss', dn: { missed: 2 }, dnTxt: 'two missed tackles' },
  db: { up: { tgtA: 1, pbus: 1 }, upTxt: 'a pass broken up on third down', dn: { tgtA: 2, cmpA: 2, ydsA: 46 }, dnTxt: 'two catches for 46 yards given up' },
}
// an inGame card: the kicker names the game; a risk (the traits set the odds) and a safe choice that changes nothing
const gameKicker = (c, flavor) => [flavor, `WEEK ${c.next.wk} · ${c.next.home ? 'VS' : 'AT'} ${c.cr.opp.nick.toUpperCase()}`].filter(Boolean).join(' · ')
const risk = (id, label, od, good, bad, goodSub, badSub) => ({ id, label, sub: oddsSub(od, goodSub, badSub), effect: { outcomes: [{ p: od.p, good: true, ...good }, { p: 1 - od.p, good: false, ...bad }] } })
const safe = (id, label, line, text) => ({ id, label, sub: text, effect: { outcomes: [{ p: 1, good: true, line, game: { add: {} } }] } })
const upcoming = c => !!c.next && !c.next.sat && !!c.cr.opp
// December in a cold, open stadium (the home team's): where a late-season game can turn on the weather
const COLD_HOME = { BUF: 'Orchard Park', GB: 'Green Bay', CHI: 'Chicago', CLE: 'Cleveland', PIT: 'Pittsburgh', NE: 'Foxborough', DEN: 'Denver', KC: 'Kansas City', CIN: 'Cincinnati', NYJ: 'East Rutherford', NYG: 'East Rutherford', PHI: 'Philadelphia', BAL: 'Baltimore', WAS: 'Landover' }
const coldCity = c => (upcoming(c) && c.next.wk >= 14 ? COLD_HOME[c.next.home ? c.team : c.cr.opp.short] ?? null : null)

const LIFE_NFL = [
  { id: 'rk-wall', at: ['late', 'stretch'], w: 4, when: c => c.cr.rookie && plays(c) && c.k >= 12 && c.left >= 2 && c.roleHas('legs') && c.roleHas('mind'),
    make: c => ({ kicker: 'ROOKIE YEAR', title: 'The rookie wall',
      body: `${Num(c.k)} games in. A college season is over by now, and this one has ${num(c.left)} left. ${c.name}'s legs have never been asked for this much.`,
      options: [
        o('ease', 'Take the veteran days off', { attr: mix(c.R1('legs', 1), c.R1('mind', -1)) }, 'Fresher on Sunday. A little behind on the game plan.'),
        o('push', 'Keep taking every rep', gam(0.5, { xp: 20 }, 'He ran through the wall. The coaches noticed.', { attr: c.R('legs', -1), tag: 'ROOKIE WALL' }, 'It caught up with him. Heavy legs the rest of the way.')),
      ] }) },
  { id: 'rk-mentor', at: ['early', 'mid'], w: 3, when: c => c.cr.year <= 2 && plays(c) && !!vetOf(c) && c.roleHas('mind') && c.roleHas('legs') && c.roleHas('feel'),
    make: c => { const v = vetOf(c); return { kicker: c.cr.rookie ? 'ROOKIE YEAR' : 'SECOND YEAR', title: 'Film at six in the morning',
      body: `${v.name} is ${v.age} and still the first car in the lot. He watches tape at six every morning, and he tells ${c.name} there is a seat open.`,
      options: [
        o('in', 'Be there at six', { attr: c.R1('legs', -1), window: 3, tag: 'EARLY MORNINGS', then: { attr: c.R1('mind', 1) } }, `Short on sleep for a few weeks. Then he starts seeing what ${last(v.name)} sees.`),
        o('own', 'Keep his own routine', { attr: c.R1('feel', 1), window: 3 }, 'His sleep, and his extra reps after practice.'),
      ] } } },
  { id: 'vet-days', at: ['early', 'mid'], w: 2, when: c => c.cr.vet && starts(c) && c.cr.year >= 4 && c.roleHas('legs') && c.roleHas('mind'),
    make: c => ({ kicker: 'VETERAN', title: 'The veteran schedule',
      body: `${c.name} is ${c.cr.age} and in his ${nth(c.cr.year)} season. The staff offers him the veteran schedule: Wednesdays off, limited on Thursday.`,
      options: [
        o('rest', 'Take the days off', { attr: mix(c.R('legs', 1), c.R1('mind', -1)) }, 'Fresher on Sunday. Fewer practice reps on the game plan.'),
        o('work', 'Practice like he always has', gam(0.5, { attr: c.R1('mind', 1) }, 'Every rep, every week, and the body holds.', { attr: c.R('legs', -1), tag: 'WORN DOWN' }, 'The practice reps add up. His legs are gone by the fourth quarter.')),
      ] }) },
  { id: 'vet-teach', at: ['mid', 'late', 'stretch'], w: 4, when: c => c.cr.vet && c.struggling && starts(c) && ['rb', 'wr', 'te', 'dl', 'lb', 'db'].includes(c.pos) && !!kidOf(c) && c.left >= 3 && c.roleHas('make') && c.roleHas('legs'),
    make: c => { const kid = kidOf(c); return { kicker: 'VETERAN', title: 'Playing the kids',
      body: `The ${c.nick} are ${c.rec} and looking at next year. The staff wants ${kid.name}, ${kid.age}, on the field more, and those snaps come out of ${c.name}'s.`,
      options: [
        o('teach', 'Give him the snaps', { attr: mix(c.R1('make', -1), c.R('legs', 1)) }, `Fewer plays, fresher legs, and ${last(kid.name)} learns on the field.`),
        o('play', 'Stay on the field', gam(0.65, { xp: 20 }, 'He played every snap and held up.', { attr: c.R('legs', -2), tag: 'WORN DOWN' }, 'Too many snaps in a lost season. Heavy legs the rest of the way.')),
      ] } } },
  { id: 'push-job', at: ANY, w: 4, when: c => starts(c) && ['rb', 'wr', 'te', 'dl', 'lb', 'db'].includes(c.pos) && !!c.cr.push && c.cr.push.ovr >= c.cr.ovr - 3 && c.k >= 3 && (c.lastBust || c.skid >= 2 || c.coldRun >= 1) && c.roleHas('make') && c.roleHas('legs') && c.roleHas('feel'),
    make: c => { const p = c.cr.push; return { kicker: 'DEPTH CHART', title: `${last(p.name)} wants the job`,
      body: `${p.name} has had two good weeks of practice, and the coaches have started giving him snaps with the first team. They come out of ${c.name}'s.`,
      options: [
        o('fight', 'Take the job back in practice', gam(0.55, { attr: c.R1('feel', 1), window: 3, tag: 'JOB SECURE' }, `He wins every rep on Wednesday. ${last(p.name)} goes back to the second team.`,
          { attr: c.R1('make', -1), window: 3, tag: 'SPLITTING SNAPS' }, `${last(p.name)} keeps making plays. The coaches split the snaps for three weeks.`)),
        o('share', 'Split the snaps for now', { attr: mix(c.R1('make', -1), c.R('legs', 1)), window: 3, tag: 'SPLITTING SNAPS' }, 'Fewer plays, fresher legs.'),
      ] } } },
  { id: 'rotation', at: ANY, w: 3, when: c => c.cr.role === 'rotation' && !!c.cr.ahead && c.k >= 1 && c.roleHas('make') && c.roleHas('mind') && c.roleHas('nerve'),
    make: c => ({ kicker: 'DEPTH CHART', title: 'Waiting his turn',
      body: `${c.cr.ahead.name} starts. ${c.name} gets ${shareWord(c.cr.share ?? 0)}, and he wants more.`,
      options: [
        o('ask', 'Ask for a package of his own', gam(0.45, { attr: c.R('make', 1), window: 4, tag: 'OWN PACKAGE' }, 'The coordinator draws up a handful of snaps a game just for him.',
          { attr: c.R1('nerve', -1), window: 2 }, 'The answer is to earn it on Wednesdays first. It stings.')),
        o('scout', 'Give the starters a great look in practice', { attr: c.R1('mind', 1) }, 'Scout-team reps against the first unit, every day.'),
      ] }) },
  { id: 'took-over', at: ANY, w: 6, when: c => !!c.cr.took && c.cr.took.since <= 3 && c.left >= 3 && c.roleHas('nerve') && c.roleHas('make'),
    make: c => { const t = c.cr.took; return { kicker: 'DEPTH CHART', title: 'The job is his',
      body: `${t.why === 'hurt' ? `${t.from} is out${t.wks ? '' : ' for the season'}` : t.why === 'traded' ? `${t.from} was traded` : `${t.from} was benched`}, and ${c.name} is the starter now. The staff can cut the game plan down for him, or hand him all of it.`,
      options: [
        o('small', 'Cut it down', { attr: mix(c.R1('nerve', 1), c.R1('make', -1)), window: 3, tag: 'KEEPING IT SIMPLE' }, 'Fewer calls, played fast.'),
        o('all', 'Take all of it', gam(0.5, { attr: c.R('make', 1), window: 3, tag: 'READY FOR IT' }, 'Nothing was too big for him.', { attr: c.R1('nerve', -2), window: 2, tag: 'PRESSING' }, 'Too much, too soon. He presses for two weeks.')),
      ] } } },
  { id: 'short-week', at: ['early', 'mid', 'late'], w: 1, when: c => plays(c) && c.k >= 1 && !c.cr.afterBye && c.roleHas('legs') && c.roleHas('mind'),
    make: c => ({ kicker: 'SHORT WEEK', title: 'Sunday to Thursday',
      body: `Four days to get a body right and learn a game plan. There isn't time for both, and the staff leaves it to ${c.name}.`,
      options: [
        o('body', 'Get in the cold tub and sleep', { attr: mix(c.R('legs', 1), c.R1('mind', -1)), window: 1, tag: 'THURSDAY NIGHT' }, 'His legs are back by kickoff. He is light on the plan.'),
        o('film', 'Stay late on the game plan', { attr: mix(c.R1('mind', 2), c.R('legs', -1)), window: 1, tag: 'THURSDAY NIGHT' }, 'He knows every call. His legs are still Sunday\'s.'),
      ] }) },
  { id: 'prime-time', at: ['mid', 'late', 'stretch'], w: 1, when: c => (c.contender || c.bubble) && c.k >= 4 && starts(c) && c.roleHas('mind') && c.roleHas('nerve'),
    make: c => ({ kicker: 'PRIME TIME', title: 'Flexed to Sunday night',
      body: `The ${c.nick} are ${c.rec}, and the league moves their game to Sunday night. The network wants ${c.name} for its sit-down on Saturday.`,
      options: [
        o('sit', 'Do the interview', { xp: 25, attr: c.R1('mind', -1), window: 1, tag: 'SUNDAY NIGHT' }, 'Twenty minutes on national TV before kickoff. An hour out of his Saturday.'),
        o('skip', 'Stay in his routine', { attr: c.R1('nerve', 1), window: 1, tag: 'SUNDAY NIGHT' }, 'The PR staff sends a teammate. He sleeps.'),
      ] }) },
  // inGame: a division opponent, the second time around the league's calendar
  { id: 'rival-week', at: ['mid', 'late', 'stretch'], w: 3, when: c => upcoming(c) && c.cr.opp.div && starts(c) && c.alive && c.k >= 6 && !!EDGE[c.pos] && c.roleHas('nerve'),
    make: c => {
      const e = EDGE[c.pos], od = odds(c, 0.5, ROLE[c.pos].nerve), them = c.cr.opp.nick
      return { inGame: true, kicker: gameKicker(c, 'DIVISION GAME'), title: `${them} week`,
        body: `A division game, ${c.next.home ? 'at home' : 'on the road'}, and the ${c.nick} are ${c.rec}. On Wednesday a reporter asks ${c.name} what he thinks of the ${them} ${c.other}.`,
        options: [
          risk('talk', 'Give them a headline', od, { line: `He said it, then backed it up: ${e.upTxt}.`, tag: 'BACKED IT UP', game: { add: e.up } }, { line: `The ${them} had the quote on their wall all week. ${cap(e.dnTxt)}.`, tag: 'BULLETIN BOARD', game: { add: e.dn } }, `he backs it up with ${e.upTxt}`, `it costs him ${e.dnTxt}`),
          safe('quiet', 'Say the right things', 'Nothing for the bulletin board. An ordinary Sunday.', 'Nothing changes: his game stays as it was going to be.'),
        ] }
    } },
  // inGame: December, a cold open stadium. The ball carriers and the men who throw and catch it
  { id: 'cold-game', at: ['stretch'], w: 4, when: c => ['qb', 'rb', 'wr', 'te'].includes(c.pos) && starts(c) && !!coldCity(c),
    make: c => {
      const city = coldCity(c), temp = 9 + Math.floor(c.r() * 14), wind = 18 + Math.floor(c.r() * 12), e = EDGE[c.pos]
      const body = `${city} in ${c.next.wk >= 18 ? 'January' : 'December'}: ${temp} degrees at kickoff, wind gusting to ${wind}. `
      const card = c.pos === 'qb' ? (() => { const od = odds(c, 0.5, ['arm', 'accuracy']); return { body: `${body}The coordinator asks ${c.name} how much of the passing game he wants.`, options: [
        risk('throw', 'Throw it through the wind', od, { line: 'He cut it through the wind all day. 44 more yards.', tag: 'COLD-WEATHER GAME', game: { add: { passYds: 44 } } }, { line: 'One hung up in the wind and was picked off.', tag: 'COLD-WEATHER GAME', game: { add: { ints: 1 } } }, '44 more passing yards', 'an interception'),
        safe('short', 'Keep it short and on the ground', 'Checkdowns and handoffs. Nothing given away.', 'Nothing changes: no shots downfield, no risk.') ] } })()
        : c.pos === 'rb' ? (() => { const od = odds(c, 0.6, ['carrying', 'strength', 'balance']); return { body: `${body}Nobody is throwing it much today. The coordinator asks ${c.name} if he wants thirty carries.`, options: [
          risk('load', 'Ask for the ball', od, { line: 'Thirty carries in the cold. He wore them down.', tag: 'COLD-WEATHER GAME', game: { add: { carries: 8, rushYds: 37 } } }, { line: 'The ball was a brick, and one came out.', tag: 'COLD-WEATHER GAME', game: { add: { carries: 8, rushYds: 24, fumbles: 1 } } }, 'eight more carries for 37 yards', 'eight more carries for 24 and a fumble'),
          safe('norm', 'Take his normal load', 'His usual share of the carries. Nothing given away.', 'Nothing changes: his game stays as it was going to be.') ] } })()
          : (() => { const od = odds(c, 0.45, ['hands', 'bodyControl', 'strength']); return { body: `${body}The ball is a brick. ${c.name} can tell the quarterback he wants it anyway, or spend the day blocking.`, options: [
            risk('want', 'Tell him to throw it', od, { line: `Cold hands, and he caught everything: ${e.upTxt}.`, tag: 'COLD-WEATHER GAME', game: { add: e.up } }, { line: 'It went through his hands on third down.', tag: 'COLD-WEATHER GAME', game: { add: e.dn } }, e.upTxt, e.dnTxt),
            safe('block', 'Block and take what comes', 'A day of run blocking. Nothing given away.', 'Nothing changes: his game stays as it was going to be.') ] } })()
      return { inGame: true, kicker: gameKicker(c, 'COLD-WEATHER GAME'), title: `${temp} degrees in ${city}`, ...card }
    } },
]

// ── Football: by position ────────────────────────────────────────────────────
const LIFE_QB = [
  { id: 'qb-keys', at: ['early', 'mid'], w: 3, when: c => starts(c) && !c.cr.rookie && c.k >= 3 && c.T.has('processing') && c.T.has('accuracy'),
    make: c => ({ kicker: 'AT THE LINE', title: 'The keys to the offense',
      body: `The coordinator has seen enough. He offers ${c.name} full control at the line: any play, any protection, changed on his call.`,
      options: [
        o('take', 'Take the keys', gam(pOf(c, 0.5, ['processing'], 0.06), { team: { off: 1 }, tag: 'CHECK WITH ME' }, 'He gets them out of bad plays all day. The offense jumps.',
          { attr: { processing: -1 }, team: { off: -0.5 }, window: 3, tag: 'TOO MUCH AT THE LINE' }, 'Burned timeouts and delay flags for three weeks.')),
        o('run', 'Run what is called', { attr: { accuracy: 1 }, window: 3 }, 'One job: throw it. He plays fast.'),
      ] }) },
  { id: 'qb-wristband', at: ['early', 'mid', 'late'], w: 4, when: c => starts(c) && c.cr.rookie && c.T.has('processing') && c.T.has('pocket-presence') && c.T.has('playmaking'),
    make: c => ({ kicker: 'ROOKIE YEAR', title: 'The wristband',
      body: `The full call sheet runs to 160 plays. For a rookie quarterback, the staff can cut it to the 40 on ${c.name}'s wristband.`,
      options: [
        o('cut', 'Wear the short list', { attr: { 'pocket-presence': 1, playmaking: -1 }, window: 4, tag: 'SHORT MENU' }, 'Plays he knows cold. Not many of them.'),
        o('full', 'Ask for the whole sheet', gam(pOf(c, 0.45, ['processing'], 0.06), { team: { off: 1 }, window: 4, tag: 'FULL PLAYBOOK' }, 'He handles all of it. Defenses can\'t sit on anything.',
          { attr: { processing: -2 }, window: 3, tag: 'SWIMMING' }, 'Too many calls in his head. He is late on everything for three weeks.')),
      ] }) },
  { id: 'qb-sacks', at: ANY, w: 4, when: c => starts(c) && c.played.length >= 3 && c.sumLast('sacks', 3) >= 8 && c.T.has('pocket-presence') && c.T.has('playmaking') && c.roleHas('legs'),
    make: c => ({ kicker: 'PROTECTION', title: `${Num(c.sumLast('sacks', 3))} sacks in three games`,
      body: `${c.name} has been hit all month, and some of it is on him: he is holding the ball for the deep one. The coordinator can call the quick game.`,
      options: [
        o('quick', 'Get it out on the third step', { attr: { 'pocket-presence': 2, playmaking: -1 }, window: 3, tag: 'QUICK GAME' }, 'Fewer hits, shorter throws.'),
        o('hold', 'Stand in and take the shots', gam(0.5, { attr: { playmaking: 1 }, window: 3 }, 'He hangs in, and the deep ones hit.',
          { attr: mix({ 'pocket-presence': -1 }, c.R1('legs', -1)), window: 3, tag: 'BANGED UP' }, 'More hits. He starts hearing footsteps.')),
      ] }) },
  { id: 'qb-new-oc', at: ['early'], w: 5, when: c => starts(c) && !c.cr.newTeam && !c.cr.rookie && c.k >= 2 && c.cr.news.includes('new-oc') && c.T.has('processing') && c.T.has('accuracy'),
    make: c => ({ kicker: 'NEW PLAY-CALLER', title: 'The new offense',
      body: `${Num(c.k)} games into the new coordinator's offense. He calls it fast, and ${c.name} is getting the play with fifteen seconds on the clock.`,
      options: [
        o('his', 'Run it his way', gam(0.5, { team: { off: 1 }, tag: 'NEW OFFENSE' }, 'It speeds up for him week by week. The offense finds a rhythm.',
          { attr: { processing: -1 }, window: 3, tag: 'LEARNING IT', then: { team: { off: 0.5 } } }, 'Three weeks of late snaps and wrong reads before it settles.')),
        o('mine', 'Ask for the concepts he knows', { attr: { accuracy: 1 }, team: { off: -0.5 } }, 'Comfortable throws. A smaller playbook for everyone else.'),
      ] }) },
  { id: 'qb-extra-throws', at: ['mid', 'late'], w: 2, when: c => starts(c) && !!top(c.cr.men('wr')) && c.T.has('arm') && c.T.has('accuracy'),
    make: c => { const wr = top(c.cr.men('wr')); return { kicker: 'AFTER PRACTICE', title: 'Extra throws',
      body: `${wr.name} wants to stay after practice and throw: the back-shoulder ball, the deep out. The trainers keep a count on ${c.name}'s arm, and it is already high.`,
      options: [
        o('throw', 'Stay and throw', { attr: { accuracy: 1, arm: -1 }, window: 3, tag: 'EXTRA THROWS' }, 'Timing with his top target. A tired arm on Sunday.'),
        o('count', 'Stick to the count', { attr: { arm: 1 }, window: 2 }, 'A live arm. The timing stays where it is.'),
      ] } } },
  { id: 'qb-reps', at: ANY, w: 5, when: c => starts(c) && !!c.cr.push && c.cr.push.ovr >= c.cr.ovr - 5 && c.k >= 3 && (c.lastBust || c.skid >= 2) && c.T.has('accuracy') && c.T.has('pocket-presence') && c.roleHas('nerve'),
    make: c => { const p = c.cr.push; return { kicker: 'DEPTH CHART', title: 'No starter named',
      body: `${c.skid >= 2 ? `${Num(c.skid)} straight losses` : 'A bad Sunday'}, and the coach won't name a starter for this week. ${p.name} takes half of ${c.name}'s first-team snaps on Wednesday.`,
      options: [
        o('win', 'Win the week of practice', gam(0.55, { attr: { accuracy: 1 }, window: 3, tag: 'KEPT THE JOB' }, 'He is sharp all week. The coach names him on Friday.',
          { attr: { 'pocket-presence': -2 }, window: 2, tag: 'LOOKING OVER HIS SHOULDER' }, `He starts, with ${last(p.name)} warming up behind him.`)),
        o('talk', 'Go and see the coach', { attr: c.R1('nerve', -1), window: 1, then: { attr: c.R1('nerve', 1), window: 3 } }, 'An honest meeting. One rough week, then a settled one.'),
      ] } } },
  { id: 'qb-slide', at: ['early', 'mid', 'late'], w: 2, when: c => starts(c) && c.k >= 3 && c.T.has('legs') && c.val('legs') >= 7 && c.T.has('playmaking'),
    make: c => ({ kicker: 'COACH\'S OFFICE', title: 'Get down',
      body: `${c.name} keeps finishing his runs like a running back. The coach calls him in: slide, get out of bounds, live for the next down.`,
      options: [
        o('slide', 'Slide and get out of bounds', { attr: { playmaking: -1 }, dur: 0.3 }, 'A few yards left on the field. A lot fewer hits.'),
        o('fight', 'Keep fighting for the yard', gam(0.7, { attr: { playmaking: 1 } }, 'He keeps moving the chains with his legs, and gets up every time.',
          { attr: c.R('legs', -2), window: 3, dur: -0.3, tag: 'BANGED UP' }, 'A linebacker catches him at the sticks. Sore for three weeks.')),
      ] }) },
  { id: 'wait-qb', at: ANY, w: 5, waiting: true, when: c => c.cr.role === 'waiting' && !!c.cr.ahead && c.roleHas('mind') && c.roleHas('feel'),
    make: c => ({ kicker: 'SECOND STRING', title: 'Holding the clipboard',
      body: `${c.cr.ahead.name} takes every snap. ${c.name} runs the scout team during the week and charts plays on Sunday.`,
      options: [
        o('shadow', 'Sit in on the starter\'s meetings', { attr: c.R1('mind', 1) }, `How ${last(c.cr.ahead.name)} gets ready, from the next chair.`),
        o('throw', 'Throw after practice every day', { attr: c.R1('feel', 1) }, 'An hour with the practice-squad receivers.'),
      ] }) },
  // inGame: one of the best edge rushers in football on the other side
  { id: 'qb-rusher', at: ANY, w: 3, when: c => upcoming(c) && starts(c) && (top(at(c.cr.opp.men('dl'), 'EDGE'))?.ovr ?? 0) >= 90,
    make: c => {
      const p = top(at(c.cr.opp.men('dl'), 'EDGE')), od = odds(c, 0.45, ['pocket-presence', 'arm'])
      return { inGame: true, kicker: gameKicker(c), title: `${last(p.name)} is coming`,
        body: `${p.name} is one of the best pass rushers in football, and he is on the other side this week. The coordinator gives ${c.name} the choice: get the ball out, or hold it and take the shots.`,
        options: [
          risk('hold', 'Hold it and throw deep', od, { line: `Two deep balls were gone before ${last(p.name)} got home. 52 more yards.`, tag: 'BEAT THE RUSH', game: { add: { passYds: 52 } } }, { line: `${last(p.name)} got home twice. Two more sacks.`, tag: 'UNDER PRESSURE', game: { add: { sacks: 2 } } }, '52 more passing yards', 'two more sacks'),
          safe('quick', 'Three steps and throw', `The ball was gone before the rush arrived. A quiet day for ${last(p.name)}.`, 'Nothing changes: no deep shots, no extra hits.'),
        ] }
    } },
]
const LIFE_RB = [
  { id: 'rb-workload', at: ANY, w: 4, when: c => starts(c) && c.played.length >= 3 && c.sumLast('carries', 3) >= 60 && !!c.cr.men('rb')[0] && c.T.has('vision') && c.roleHas('legs') && c.roleHas('power'),
    make: c => { const rb2 = c.cr.men('rb')[0]; return { kicker: 'WORKLOAD', title: `${c.sumLast('carries', 3)} carries in three games`,
      body: `${c.name} is carrying the offense, and the staff is counting. They can give ${rb2.name} a series a half, or keep handing it to him.`,
      options: [
        o('split', 'Give up a series a half', { attr: mix(c.R('legs', 1), { vision: -1 }), window: 3, tag: 'SHARING CARRIES' }, 'Fresh legs in the fourth quarter. Less feel for how the game is being blocked.'),
        o('feed', 'Stay on the field', gam(0.6, { attr: c.R1('power', 1), window: 3, tag: 'BELL COW' }, 'He gets stronger as the game goes on.', { attr: c.R('legs', -2), window: 3, tag: 'HEAVY LEGS' }, 'The carries catch up with him.')),
      ] } } },
  { id: 'rb-third-down', at: ['early', 'mid'], w: 3, when: c => starts(c) && c.cr.year <= 3 && c.k >= 2 && !!c.cr.men('rb')[0] && c.T.has('hands') && c.roleHas('power'),
    make: c => { const rb2 = c.cr.men('rb')[0]; return { kicker: 'THIRD DOWN', title: 'Off the field on third down',
      body: `On passing downs the staff sends in ${rb2.name}. They don't trust ${c.name} to pick up a blitz yet, and a back who can't protect doesn't run routes.`,
      options: [
        o('earn', 'Win the job in blitz drills', gam(0.5, { attr: { hands: 1 }, tag: 'THREE-DOWN BACK' }, 'He stones a blitzer in practice. More routes, more catches.', { attr: { hands: -1 }, window: 2 }, `Not yet. ${last(rb2.name)} keeps the third downs.`)),
        o('early', 'Own first and second down', { attr: c.R1('power', 1), window: 4 }, 'Fresh on early downs, and running angry.'),
      ] } } },
  { id: 'rb-ball', at: ANY, w: 5, when: c => plays(c) && c.played.length >= 4 && c.sumLast('fumbles', 4) >= 2 && c.T.has('carrying') && c.T.has('elusiveness'),
    make: c => ({ kicker: 'BALL SECURITY', title: `${Num(c.sumLast('fumbles', 4))} fumbles in four games`,
      body: `The running backs coach hands ${c.name} a football on Monday. He carries it everywhere in the building all week, and every teammate is allowed to try to punch it out.`,
      options: [
        o('tight', 'Carry it high and tight', { attr: { carrying: 2, elusiveness: -1 }, window: 4, tag: 'HIGH AND TIGHT' }, 'The ball stays put. He gives up some of his moves.'),
        o('loose', 'Keep running his way', gam(0.5, { attr: { elusiveness: 1 }, window: 3 }, 'He runs free and holds on to it.', { attr: { carrying: -2 }, window: 3, tag: 'ON THE GROUND' }, 'It comes out again. Now it is in his head.')),
      ] }) },
]
const DROPS = { id: 'drops', at: ANY, w: 5, when: c => plays(c) && c.played.length >= 3 && c.sumLast('drops', 3) >= 2 && c.T.has('hands') && c.roleHas('legs'),
  make: c => ({ kicker: 'THE DROPS', title: `${Num(c.sumLast('drops', 3))} drops in three games`,
    body: `${c.name} is fighting the ball. The position coach wants him on the JUGS machine after practice. He thinks the answer is to stop thinking about it.`,
    options: [
      o('jugs', 'Catch two hundred balls a day', { attr: mix({ hands: 2 }, c.R1('legs', -1)), window: 3, tag: 'EXTRA WORK' }, 'Sore fingers, tired legs, and the ball starts sticking.'),
      o('forget', 'Forget about it', gam(0.5, { attr: { hands: 1 }, window: 3 }, 'He lets it go. The next one sticks.', { attr: { hands: -2 }, window: 2, tag: 'IN HIS HEAD' }, 'He hears footsteps on the next one, too.')),
    ] }) }
const LIFE_WR = [
  { id: 'wr-targets', at: ANY, w: 4, when: c => starts(c) && c.played.length >= 3 && c.sumLast('targets', 3) <= 10 && !!c.cr.men('qb')[0] && c.T.has('routeRunning'),
    make: c => { const qb = c.cr.men('qb')[0]; return { kicker: 'TARGET SHARE', title: `${Num(c.sumLast('targets', 3))} targets in three games`,
      body: `The ball isn't coming ${c.name}'s way. He can take it up with ${qb.name}, or keep his mouth shut and block.`,
      options: [
        o('talk', 'Go to the quarterback', gam(0.5, { attr: { routeRunning: 1 }, window: 3, tag: 'ON THE SAME PAGE' }, `He and ${last(qb.name)} stay after practice all week. The timing shows.`,
          { team: { off: -0.5 }, window: 2, tag: 'FRICTION' }, `${last(qb.name)} hears it as a complaint. So does the rest of the huddle.`)),
        o('block', 'Do the dirty work', { team: { off: 0.5 }, window: 3 }, 'He blocks downfield and clears out coverage for everyone else.'),
      ] } } },
  { id: 'wr-contested', at: ANY, w: 3, when: c => starts(c) && c.k >= 3 && c.T.has('bodyControl') && c.T.has('routeRunning') && Math.max(c.val('bodyControl'), c.T.has('vertical') ? c.val('vertical') : 0) >= 8 && c.roleHas('legs'),
    make: c => ({ kicker: 'REPUTATION', title: 'Fifty-fifty balls',
      body: `The quarterback trusts ${c.name} in traffic, so that is where the ball goes. Corners have started playing through his hands, and the officials are letting them.`,
      options: [
        o('fight', 'Keep going up for it', { attr: mix({ bodyControl: 1 }, c.R1('legs', -1)), window: 3, tag: 'PHYSICAL' }, 'He wins the ball in the air and pays for it on the ground.'),
        o('early', 'Win earlier in the route', { attr: { routeRunning: 1, bodyControl: -1 }, window: 3 }, 'More separation at the break. Fewer jump balls.'),
      ] }) },
  { id: 'wr-slot', at: ['early', 'mid', 'late'], w: 2, when: c => starts(c) && c.k >= 2 && c.T.has('afterCatch') && c.T.has('speed') && c.T.has('release'),
    make: c => ({ kicker: 'GAME PLAN', title: 'A few weeks in the slot',
      body: `The coordinator wants ${c.name} inside for a stretch: option routes against nickel corners and linebackers. Shorter throws, more of them, and no deep ball.`,
      options: [
        o('in', 'Move inside', { attr: { afterCatch: 2, speed: -1 }, window: 3, tag: 'IN THE SLOT' }, 'Catch and run. The deep shots go to someone else.'),
        o('out', 'Stay outside', { attr: { release: 1 }, window: 3 }, 'His spot, his releases, his deep balls.'),
      ] }) },
  DROPS,
  // inGame: a corner who travels with the other team's best receiver
  { id: 'wr-shadowed', at: ANY, w: 4, when: c => upcoming(c) && starts(c) && c.cr.ovr >= 80 && c.cr.ovr >= (top(c.cr.men('wr'))?.ovr ?? 0) && (top(at(c.cr.opp.men('db'), 'CB'))?.ovr ?? 0) >= 88,
    make: c => {
      const p = top(at(c.cr.opp.men('db'), 'CB')), od = odds(c, 0.42, ['release', 'routeRunning', 'bodyControl'])
      return { inGame: true, kicker: gameKicker(c), title: `${last(p.name)} travels`,
        body: `${p.name} follows the other team's best receiver wherever he lines up, and this week that is ${c.name}. The coordinator can move him inside, away from the matchup.`,
        options: [
          risk('win', 'Line up across from him', od, { line: `He beat ${last(p.name)} three times. 47 more yards.`, tag: 'WON THE MATCHUP', game: { add: { targets: 3, rec: 3, recYds: 47 } } }, { line: `${last(p.name)} was in his pocket all day. Two more targets, and a drop.`, tag: 'LOCKED UP', game: { add: { targets: 2, drops: 1 } } }, 'three more catches for 47 yards', 'two more targets with nothing to show, and a drop'),
          safe('move', 'Move inside, away from him', `He works the slot. ${last(p.name)} never leaves the outside.`, 'Nothing changes: his game stays as it was going to be.'),
        ] }
    } },
]
const LIFE_TE = [
  { id: 'te-block', at: ANY, w: 3, when: c => starts(c) && c.k >= 2 && (c.teamOff ?? 5) <= 6.5 && c.T.has('blocking') && c.T.has('routeRunning'),
    make: c => ({ kicker: 'GAME PLAN', title: 'A sixth blocker',
      body: `The run game is stuck, and the coordinator's answer is ${c.name} staying in: on the end of the line on first and second down, a hand in the dirt.`,
      options: [
        o('stay', 'Stay in and block', { attr: { blocking: 1, routeRunning: -1 }, team: { off: 0.5 }, tag: 'IN-LINE' }, 'The backs find room. He runs fewer routes.'),
        o('route', 'Ask to stay in the pattern', { attr: { routeRunning: 1 }, team: { off: -0.5 } }, 'His catches keep coming. The run game stays stuck.'),
      ] }) },
  { id: 'te-flex', at: ['early', 'mid'], w: 3, when: c => starts(c) && !!c.cr.men('te')[0] && c.T.has('routeRunning') && c.T.has('blocking') && c.T.has('strength'),
    make: c => { const te2 = c.cr.men('te')[0]; return { kicker: 'TWO TIGHT ENDS', title: 'In line, or split out',
      body: `The offense is going to two tight ends: ${c.name} and ${te2.name}. One lines up next to the tackle. The other moves around the formation.`,
      options: [
        o('move', 'Take the move job', { attr: { routeRunning: 1, blocking: -1 }, window: 4, tag: 'FLEXED OUT' }, `Slot, wing, out wide. ${last(te2.name)} does the heavy lifting.`),
        o('line', 'Take the in-line job', { attr: { blocking: 1, strength: 1, routeRunning: -1 }, window: 4, tag: 'IN-LINE' }, `A hand in the dirt. ${last(te2.name)} gets the matchups.`),
      ] } } },
  { id: 'te-weight', at: ['early', 'mid'], w: 2, when: c => starts(c) && c.T.has('blocking') && c.val('blocking') <= 6 && c.T.has('speed') && c.T.has('strength'),
    make: c => ({ kicker: 'STRENGTH STAFF', title: 'Eight more pounds',
      body: `Defensive ends are moving ${c.name} off the ball in the run game. The strength staff wants eight pounds on him. He likes how he runs at this weight.`,
      options: [
        o('add', 'Put the weight on', { attr: { blocking: 1, strength: 1, speed: -1 }, tag: 'HEAVIER' }, 'He holds the edge. He is a step slower up the seam.'),
        o('light', 'Stay at his weight', { attr: { speed: 1, blocking: -1 }, tag: 'LIGHTER' }, 'He runs away from linebackers. Ends still move him.'),
      ] }) },
  DROPS,
]
const LIFE_OL = [
  { id: 'ol-cross', at: ['early', 'mid'], w: 2, when: c => starts(c) && !!OL_NAME[c.cr.spot] && c.T.has('passPro') && c.T.has('discipline') && c.T.has('blitzPickup'),
    make: c => { const other = OL_NAME[c.cr.spot === 'C' ? 'RG' : c.cr.spot === 'LT' ? 'RT' : c.cr.spot === 'RT' ? 'LT' : 'C']; return { kicker: 'THE LINE', title: `Reps at ${other}`,
      body: `The line is one injury from trouble, so the coach wants ${c.name} taking practice snaps at ${other} as well as ${OL_NAME[c.cr.spot]}. A different stance, different footwork, half the reps at his own spot.`,
      options: [
        o('both', 'Learn both', { attr: { discipline: -1 }, window: 3, tag: 'CROSS-TRAINING', then: { attr: { blitzPickup: 1 } } }, 'A few weeks of thinking about his feet. Then he sees the whole protection.'),
        o('stay', 'Keep every rep at his spot', { attr: { passPro: 1 }, window: 3 }, 'One stance, one set, repeated.'),
      ] } } },
  { id: 'ol-kid', at: ['early', 'mid'], w: 4, when: c => starts(c) && !!OL_NEXT[c.cr.spot] && !!top(at(c.cr.men('ol'), ...OL_NEXT[c.cr.spot]).filter(p => p.age <= 23)) && c.T.has('blitzPickup') && c.T.has('pancake'),
    make: c => { const kid = top(at(c.cr.men('ol'), ...OL_NEXT[c.cr.spot]).filter(p => p.age <= 23)); return { kicker: 'THE LINE', title: `${kid.kid ? 'A rookie' : 'A young lineman'} on his shoulder`,
      body: `${kid.name}, ${kid.age}, starts at ${OL_NAME[String(kid.slot).toUpperCase()]} next to ${c.name}. On every twist the two of them have to pass off rushers without a word.`,
      options: [
        o('calls', 'Make the calls for both of them', { attr: { blitzPickup: 1, pancake: -1 }, team: { off: 0.5 }, tag: 'TALKING HIM THROUGH IT' }, `He points out every stunt before the snap. Less time to finish his own blocks.`),
        o('learn', 'Let him learn it on the field', gam(0.5, { attr: { pancake: 1 } }, `${last(kid.name)} figures it out. He goes back to burying people.`,
          { team: { off: -0.5 }, window: 3, tag: 'FREE RUSHERS' }, `${last(kid.name)} misses two stunts. The quarterback pays for it.`)),
      ] } } },
  { id: 'ol-flags', at: ANY, w: 5, when: c => starts(c) && c.played.length >= 3 && c.sumLast('penalties', 3) >= 2 && c.T.has('discipline') && c.T.has('pancake'),
    make: c => ({ kicker: 'FLAGS', title: `${Num(c.sumLast('penalties', 3))} flags in three games`,
      body: `${c.name} is playing on the edge, and the officials have noticed: the flags are killing drives. The line coach wants him patient.`,
      options: [
        o('clean', 'Clean it up', { attr: { discipline: 2, pancake: -1 }, window: 3, tag: 'CLEANED UP' }, 'Hands inside, feet first. Fewer finishes.'),
        o('nasty', 'Keep finishing blocks', gam(0.5, { attr: { pancake: 1 }, window: 3 }, 'He stays nasty, and the flags stop.', { attr: { discipline: -2 }, window: 2, tag: 'FLAGGED' }, 'Two more drives killed by yellow.')),
      ] }) },
  { id: 'ol-run', at: ANY, w: 3, when: c => starts(c) && c.k >= 2 && !!c.cr.men('rb')[0] && c.T.has('runBlock') && c.T.has('pancake') && c.T.has('mobility') && c.T.has('passPro'),
    make: c => { const rb = c.cr.men('rb')[0]; return { kicker: 'GAME PLAN', title: 'Run it behind him',
      body: `${rb.name} tells the staff he wants every short-yardage call behind ${c.name}. The coordinator is ready to lean that way.`,
      options: [
        o('run', 'Take the calls', { attr: { runBlock: 1, pancake: 1, mobility: -1 }, window: 3, tag: 'DOWNHILL' }, 'He moves the pile all day. His legs are heavy by the fourth quarter.'),
        o('even', 'Keep it balanced', { attr: { passPro: 1 }, window: 3 }, 'His legs stay fresh for pass protection.'),
      ] } } },
  { id: 'wait-ol', at: ANY, w: 5, waiting: true, when: c => c.cr.role === 'waiting' && !!c.cr.ahead && !!OL_NAME[c.cr.spot] && c.T.has('passPro') && c.roleHas('mind'),
    make: c => ({ kicker: 'SECOND STRING', title: 'Next man in',
      body: `${c.cr.ahead.name} starts at ${OL_NAME[c.cr.spot]}. ${c.name} dresses on Sunday, plays on the field-goal unit, and is one snap away.`,
      options: [
        o('all', 'Learn every spot on the line', { attr: c.R1('mind', 1) }, 'Guard on Wednesday, tackle on Thursday. He sees the whole protection.'),
        o('pass', 'Stay for one-on-ones after practice', { attr: { passPro: 1 } }, 'Pass-rush drills against the starters until the lights go off.'),
      ] }) },
  // inGame: one of the best rushers in football over his spot
  { id: 'ol-rusher', at: ANY, w: 4, when: c => upcoming(c) && starts(c) && !!OL_NAME[c.cr.spot] && (top(at(c.cr.opp.men('dl'), c.cr.spot === 'LT' || c.cr.spot === 'RT' ? 'EDGE' : 'DT'))?.ovr ?? 0) >= 90,
    make: c => {
      const p = top(at(c.cr.opp.men('dl'), c.cr.spot === 'LT' || c.cr.spot === 'RT' ? 'EDGE' : 'DT')), od = odds(c, 0.45, ['passPro', 'anchor'])
      return { inGame: true, kicker: gameKicker(c), title: `${last(p.name)}, one on one`,
        body: `${p.name} lines up over ${c.name} this week. The line coach can slide the protection and chip with a back, or leave him alone and send the back out for passes.`,
        options: [
          risk('solo', 'Block him alone', od, { line: `He stoned ${last(p.name)} alone all day, and put him on his back once.`, tag: 'WON THE MATCHUP', game: { add: { pancakes: 1 } } }, { line: `${last(p.name)} beat him for a sack and three pressures.`, tag: 'BEATEN', game: { add: { sacks: 1, pressures: 3 } } }, 'a clean day and one more pancake', 'a sack and three pressures allowed'),
          safe('help', 'Take the help', `A chip and a slide on every dropback. ${last(p.name)} never got a clean rush.`, 'Nothing changes: his game stays as it was going to be.'),
        ] }
    } },
  // inGame: a road game, a silent count
  { id: 'ol-noise', at: ANY, w: 2, when: c => upcoming(c) && starts(c) && !c.next.home && c.T.has('discipline'),
    make: c => {
      const od = odds(c, 0.5, ['discipline', 'mobility'])
      return { inGame: true, kicker: gameKicker(c, 'ROAD GAME'), title: 'Silent count',
        body: `On the road against the ${c.cr.opp.nick}, the line won't hear the cadence. The offense goes to a silent count. ${c.name} can watch the ball, or try to time the snap.`,
        options: [
          risk('time', 'Time the snap', od, { line: 'First off the ball all day. Two more pancakes.', tag: 'SILENT COUNT', game: { add: { pancakes: 2 } } }, { line: 'He left early once. A flag on third down.', tag: 'SILENT COUNT', game: { add: { penalties: 1 } } }, 'two more pancakes', 'a flag for leaving early'),
          safe('watch', 'Watch the ball', 'A beat late off the ball, and no flags.', 'Nothing changes: his game stays as it was going to be.'),
        ] }
    } },
]
const LIFE_DL = [
  { id: 'dl-pitch', at: ['mid', 'late', 'stretch'], w: 3, when: c => starts(c) && c.k >= 4 && c.T.has('getOff') && c.T.has('blockShed') && c.roleHas('legs'),
    make: c => ({ kicker: 'ROTATION', title: 'A pitch count',
      body: `The line coach wants to hold ${c.name} to 45 snaps a game: off the field for a series a half, fresh on third down. He has never liked coming out.`,
      options: [
        o('rotate', 'Take the rotation', { attr: { getOff: 1, blockShed: -1 }, window: 4, tag: 'PITCH COUNT' }, 'A fresh first step on passing downs. Fewer snaps against the run.'),
        o('stay', 'Stay on the field', gam(0.6, { attr: { blockShed: 1 }, window: 4, tag: 'EVERY SNAP' }, 'He wears the guards down instead.', { attr: c.R('legs', -1), window: 4, tag: 'GASSED' }, 'By the fourth quarter he has nothing left.')),
      ] }) },
  { id: 'dl-counter', at: ANY, w: 3, when: c => starts(c) && c.k >= 4 && c.T.has('finesseMoves') && c.T.has('powerMoves') && Math.abs(c.val('finesseMoves') - c.val('powerMoves')) >= 2,
    make: c => {
      const fin = c.val('finesseMoves') > c.val('powerMoves'), best = fin ? 'finesseMoves' : 'powerMoves', weak = fin ? 'powerMoves' : 'finesseMoves'
      return { kicker: 'FILM ROOM', title: 'They are sitting on his move',
        body: `Every tackle on the schedule has ${c.name}'s ${fin ? 'spin' : 'bull rush'} on tape, and they are setting for it. The line coach wants a counter off it: ${fin ? 'speed to power' : 'a rip to the outside'}.`,
        options: [
          o('counter', 'Work the counter', gam(0.5, { attr: { [weak]: 2 }, window: 4, tag: 'NEW COUNTER' }, 'Tackles don\'t know which one is coming.', { attr: { [best]: -1 }, window: 3, tag: 'THINKING' }, 'He is thinking instead of rushing.')),
          o('best', 'Keep throwing his best pitch', { attr: { [best]: 1, [weak]: -1 }, window: 3 }, 'They know it is coming. He bets they still can\'t stop it.'),
        ] }
    } },
]
const LIFE_LB = [
  { id: 'lb-dot', at: ['early', 'mid'], w: 4, when: c => starts(c) && c.cr.year >= 2 && c.k >= 2 && !!top(c.cr.room) && c.T.has('playRecognition') && c.T.has('tackling'),
    make: c => { const lb = top(c.cr.room); return { kicker: 'THE GREEN DOT', title: 'The radio helmet',
      body: `The green dot is on ${lb.name}'s helmet this season: he gets the call from the sideline and sets the defense. The coordinator wants to move it to ${c.name}.`,
      options: [
        o('take', 'Take the green dot', gam(pOf(c, 0.5, ['playRecognition', 'leadership'], 0.06), { team: { def: 1 }, tag: 'GREEN DOT' }, 'The defense lines up right and plays fast.',
          { attr: { playRecognition: -1 }, team: { def: -0.5 }, window: 3, tag: 'GREEN DOT' }, 'Late checks, eleven men looking at him. Three rough weeks.')),
        o('leave', 'Leave it where it is', { attr: { tackling: 1 }, window: 3 }, `${last(lb.name)} talks. He hits.`),
      ] } } },
  { id: 'lb-role', at: ANY, w: 3, when: c => starts(c) && c.k >= 2 && c.T.has('passRush') && c.T.has('zoneInstincts'),
    make: c => ({ kicker: 'ROLE', title: 'Send him, or drop him',
      body: `The coordinator is building the third-down package and asks ${c.name} where he wants to be when the ball is snapped: coming off the edge, or reading the quarterback's eyes in the middle of the field.`,
      options: [
        o('rush', 'Rush the quarterback', { attr: { passRush: 1, zoneInstincts: -1 }, window: 4, tag: 'BLITZING' }, 'More shots at the quarterback. Less of him in the passing lanes.'),
        o('drop', 'Drop into coverage', { attr: { zoneInstincts: 1, passRush: -1 }, window: 4, tag: 'IN COVERAGE' }, 'More hands on the ball. Fewer hits on the quarterback.'),
      ] }) },
  { id: 'lb-missed', at: ANY, w: 5, when: c => plays(c) && c.played.length >= 3 && c.sumLast('missed', 3) >= 4 && c.T.has('tackling') && c.T.has('power'),
    make: c => ({ kicker: 'TACKLING', title: `${Num(c.sumLast('missed', 3))} missed tackles in three games`,
      body: `${c.name} keeps going for the big hit and coming up with air. The linebackers coach wants him to come to balance and wrap up.`,
      options: [
        o('wrap', 'Break down and wrap up', { attr: { tackling: 2, power: -1 }, window: 3, tag: 'SURE TACKLER' }, 'The ball carrier goes down. The highlight hits go away.'),
        o('hit', 'Keep hitting', gam(0.5, { attr: { power: 1 }, window: 3 }, 'He runs through people, and they stay down.', { attr: { tackling: -2 }, window: 2, tag: 'WHIFFING' }, 'Two more backs bounce off him.')),
      ] }) },
  // inGame: a quarterback who runs (the data's own Legs grade)
  { id: 'lb-spy', at: ANY, w: 4, when: c => upcoming(c) && starts(c) && (() => { const q = c.cr.opp.men('qb')[0]; return !!q && (c.cr.raw('qb', q.name)?.legs ?? 0) >= 9 })(),
    make: c => {
      const q = c.cr.opp.men('qb')[0], od = odds(c, 0.5, ['range', 'tackling', 'playRecognition'])
      return { inGame: true, kicker: gameKicker(c), title: `Spy ${last(q.name)}`,
        body: `${q.name} hurts teams with his legs. The coordinator can take ${c.name} out of the coverage and give him one job: mirror the quarterback, and get him on the ground when he runs.`,
        options: [
          risk('spy', 'Take the job', od, { line: `${last(q.name)} never got loose. Three more tackles and a sack.`, tag: 'SPY', game: { add: { tackles: 3, sacks: 1 } } }, { line: `${last(q.name)} made him miss in the open field twice.`, tag: 'SPY', game: { add: { missed: 2 } } }, 'three more tackles and a sack', 'two missed tackles in the open field'),
          safe('zone', 'Stay in the coverage', 'He plays his zone and rallies to the ball.', 'Nothing changes: his game stays as it was going to be.'),
        ] }
    } },
]
const isCB = c => c.cr.spot === 'cb'
const LIFE_DB = [
  // inGame: travel with their best receiver
  { id: 'db-shadow', at: ANY, w: 5, when: c => upcoming(c) && starts(c) && isCB(c) && (top(c.cr.opp.men('wr'))?.ovr ?? 0) >= 88,
    make: c => {
      const p = top(c.cr.opp.men('wr')), od = odds(c, 0.48, ['manCoverage', 'press', 'speed'])
      return { inGame: true, kicker: gameKicker(c), title: `Travel with ${last(p.name)}`,
        body: `${p.name} is the best receiver the ${c.cr.opp.nick} have. The coordinator will let ${c.name} follow him all day: left side, right side, in the slot.`,
        options: [
          risk('travel', 'Follow him everywhere', od, { line: `He held ${last(p.name)} to two catches and broke up two more.`, tag: 'SHADOW', game: { add: { tgtA: 5, cmpA: 2, ydsA: 21, pbus: 2 } } }, { line: `${last(p.name)} got him for six catches and 104 yards.`, tag: 'SHADOW', game: { add: { tgtA: 7, cmpA: 6, ydsA: 104 } } }, 'two passes broken up, two short catches allowed', 'six catches for 104 yards allowed'),
          safe('side', 'Stay on his side', 'He plays his side of the field. A normal day.', 'Nothing changes: his game stays as it was going to be.'),
        ] }
    } },
  { id: 'db-press', at: ANY, w: 3, when: c => starts(c) && isCB(c) && c.k >= 2 && c.T.has('press') && c.T.has('manCoverage') && c.T.has('zoneIQ'),
    make: c => ({ kicker: 'TECHNIQUE', title: 'Press, or play off',
      body: `Receivers have been getting free releases on ${c.name}'s side. The secondary coach offers him the line of scrimmage: hands on them at the snap, no help over the top.`,
      options: [
        o('press', 'Get in their face', gam(pOf(c, 0.5, ['press', 'speed']), { attr: { press: 2 }, window: 3, tag: 'PRESS' }, 'Routes die at the line. Quarterbacks look the other way.', { attr: { manCoverage: -2 }, window: 2, tag: 'BEAT DEEP' }, 'One miss at the line, and the receiver is gone.')),
        o('off', 'Play off and keep it in front', { attr: { zoneIQ: 1, press: -1 }, window: 3 }, 'Nothing behind him. The short ones are there.'),
      ] }) },
  { id: 'db-bait', at: ['mid', 'late', 'stretch'], w: 4, when: c => starts(c) && isCB(c) && c.cr.ovr >= 84 && c.played.length >= 3 && c.sumLast('tgtA', 3) > 0 && c.sumLast('tgtA', 3) <= 12 && c.T.has('hands') && c.T.has('manCoverage'),
    make: c => ({ kicker: 'REPUTATION', title: 'Nobody throws his way',
      body: `${Num(c.sumLast('tgtA', 3))} targets in three games. Quarterbacks have taken ${c.name}'s side of the field out of the game plan, which is the job, and it leaves him no chances at the ball.`,
      options: [
        o('bait', 'Give a cushion and bait the throw', gam(pOf(c, 0.5, ['hands', 'playRecognition']), { attr: { hands: 2 }, window: 3, tag: 'BAITING' }, 'They take the bait. He is sitting on it.', { attr: { manCoverage: -1 }, window: 3, tag: 'FREE YARDS' }, 'They take the free yards and never throw the one he wants.')),
        o('lock', 'Keep the side closed', { team: { def: 0.5 }, window: 3 }, 'No stats in it. Half the field stays shut.'),
      ] }) },
  { id: 'db-box', at: ANY, w: 3, when: c => starts(c) && !isCB(c) && c.k >= 2 && (c.teamDef ?? 5) <= 6.5 && c.T.has('runSupport') && c.T.has('hands'),
    make: c => ({ kicker: 'ROLE', title: 'Down in the box',
      body: `The run defense is leaking, and the coordinator wants ${c.name} down as the eighth man on early downs. It takes him out of the deep middle, where the interceptions are.`,
      options: [
        o('box', 'Play in the box', { attr: { runSupport: 1, hands: -1 }, team: { def: 0.5 }, tag: 'IN THE BOX' }, 'More tackles near the line. Fewer chances at the ball.'),
        o('deep', 'Stay deep', { attr: { hands: 1 }, team: { def: -0.5 } }, 'He keeps reading the quarterback. Backs keep reaching the second level.'),
      ] }) },
  { id: 'db-checks', at: ['early', 'mid'], w: 3, when: c => starts(c) && !isCB(c) && c.cr.year >= 2 && c.k >= 2 && (c.teamDef ?? 5) <= 7.5 && c.T.has('zoneIQ') && c.T.has('playRecognition') && c.T.has('runSupport'),
    make: c => ({ kicker: 'COMMUNICATION', title: 'Making the checks',
      body: `Two busted coverages in a month. The coordinator wants one voice in the secondary before the snap, and he wants it to be ${c.name}.`,
      options: [
        o('take', 'Make the checks', gam(pOf(c, 0.5, ['zoneIQ', 'playRecognition'], 0.06), { team: { def: 1 }, tag: 'ONE VOICE' }, 'Everyone is on the same call. The busts stop.',
          { attr: { zoneIQ: -1 }, team: { def: -0.5 }, window: 3, tag: 'LATE CHECKS' }, 'He is still talking when the ball is snapped. Three rough weeks.')),
        o('play', 'Just play his position', { attr: { runSupport: 1 }, window: 3 }, 'Someone else talks. He plays fast.'),
      ] }) },
]

// ── Basketball ───────────────────────────────────────────────────────────────
const LIFE_NBA = [
  { id: 'nba-rk-wall', at: ['late', 'stretch'], w: 4, when: c => c.cr.rookie && c.k >= 45 && c.left >= 10 && c.roleHas('legs'),
    make: c => ({ kicker: 'ROOKIE YEAR', title: 'The rookie wall',
      body: `${c.k} games in. A college season is 35 at the most, and there are ${c.left} still to play. ${c.name}'s legs feel every one of them.`,
      options: [
        o('rest', 'Sit a couple of nights', { sit: 2, tag: 'REST', then: { attr: c.R('legs', 1), window: 10 } }, 'Two games in a suit. Then his legs are back.'),
        o('push', 'Play through it', gam(0.5, { xp: 20 }, 'He played through it. The coaches noticed.', { attr: c.R('legs', -1), window: 15, tag: 'ROOKIE WALL' }, 'It caught up with him. Heavy legs for weeks.')),
      ] }) },
  { id: 'nba-road-trip', at: ANY, w: 2, when: c => c.k >= 8 && c.left >= 10 && c.roleHas('legs'),
    make: c => ({ kicker: 'SCHEDULE', title: 'Five games in seven nights',
      body: `A road trip with two back-to-backs. The training staff wants ${c.name} to sit one of the five.`,
      options: [
        o('sit', 'Sit one night', { sit: 1, tag: 'REST', then: { attr: c.R1('legs', 1), window: 5 } }, 'One game in a suit. Fresh for the other four.'),
        o('play', 'Play all five', gam(0.6, { xp: 15 }, 'All five, and no drop-off.', { attr: c.R('legs', -2), window: 6, tag: 'HEAVY LEGS' }, 'By the fifth game his legs are gone.')),
      ] }) },
  { id: 'nba-break', at: ['late'], w: 5, when: c => c.k >= 50 && c.k <= 58 && c.roleHas('legs') && c.roleHas('feel'),
    make: c => ({ kicker: 'ALL-STAR BREAK', title: 'A week with no games',
      body: `The schedule stops for a week. ${c.name} has ${c.k} games on his legs and ${c.left} to go.`,
      options: [
        o('rest', 'Get away and rest', { attr: c.R('legs', 1), window: 10, tag: 'RESTED' }, 'A week off his feet.'),
        o('gym', 'Stay in the gym', { attr: mix(c.R1('feel', 1), c.R1('legs', -1)), window: 10, tag: 'STAYED IN THE GYM' }, 'Two workouts a day while everyone else is on a beach.'),
      ] }) },
  { id: 'nba-sixth', at: ANY, w: 4, when: c => c.cr.role === 'bench' && c.cr.depth <= 1 && !!c.cr.ahead && c.k >= 5 && c.roleHas('feel') && c.roleHas('make'),
    make: c => ({ kicker: 'SECOND UNIT', title: 'First off the bench',
      body: `${c.cr.ahead.name} starts. ${c.name} checks in midway through the first quarter, and the second unit is his.`,
      options: [
        o('score', 'Look for his own shot', { attr: mix(c.R1('feel', 1), c.R1('make', -1)), window: 12, tag: 'INSTANT OFFENSE' }, 'Shots go up the minute he checks in.'),
        o('run', 'Get the second unit going', { attr: mix(c.R1('make', 1), c.R1('feel', -1)), window: 12, tag: 'RUNNING THE SECOND UNIT' }, 'Everyone else eats first.'),
      ] }) },
  { id: 'nba-vet-minutes', at: ['early', 'mid'], w: 3, when: c => c.cr.vet && starts(c) && c.roleHas('legs') && c.roleHas('make'),
    make: c => ({ kicker: 'VETERAN', title: 'A minutes limit',
      body: `${c.name} is ${c.cr.age} and in his ${nth(c.cr.year)} season. The staff wants to hold him to 30 minutes a night and sit him on back-to-backs.`,
      options: [
        o('limit', 'Take the limit', { attr: mix(c.R('legs', 1), c.R1('make', -1)) }, 'Fresher legs all year. Fewer minutes to do his work.'),
        o('full', 'Play his usual minutes', gam(0.5, { xp: 20 }, 'Thirty-six a night, and he held up.', { attr: c.R('legs', -1), tag: 'WORN DOWN' }, 'The minutes add up. He drags through the second half of the season.')),
      ] }) },
  { id: 'nba-closing', at: ANY, w: 4, when: c => starts(c) && !!c.cr.push && c.cr.push.ovr >= c.cr.ovr - 2 && c.k >= 10 && (c.lastBust || c.skid >= 2 || c.coldRun >= 1) && c.roleHas('nerve') && c.roleHas('feel') && c.T.has(c.pos === 'big' ? 'interiorDefense' : 'perimeterDefense'),
    make: c => { const p = c.cr.push; return { kicker: 'CLOSING LINEUP', title: 'On the bench late',
      body: `The coach has started finishing games with ${p.name} on the floor and ${c.name} watching from the bench.`,
      options: [
        o('ask', 'Tell the coach he wants those minutes', gam(0.5, { attr: c.R1('nerve', 1), window: 10, tag: 'CLOSING' }, 'He is back on the floor at the end, and he delivers.',
          { attr: c.R1('nerve', -2), window: 6, tag: 'WATCHING THE FOURTH' }, `The coach sticks with ${last(p.name)}. It sits with him.`)),
        o('defend', 'Earn them back on defense', { attr: mix({ [c.pos === 'big' ? 'interiorDefense' : 'perimeterDefense']: 1 }, c.R1('feel', -1)), window: 10, tag: 'DIRTY WORK' }, 'Deflections, charges, loose balls. Fewer shots.'),
      ] } } },
]
const LIFE_GUARD = [
  { id: 'g-shots', at: ANY, w: 3, when: c => plays(c) && c.k >= 8 && c.T.has('jumpShot') && c.T.has('finishing'),
    make: c => ({ kicker: 'SHOT CHART', title: 'Too many long twos',
      body: `The coaches put ${c.name}'s shot chart on the screen: a cluster of pull-ups a step inside the line. They want those to become threes or layups.`,
      options: [
        o('three', 'Step back behind the line', { attr: { jumpShot: 1, finishing: -1 }, window: 12, tag: 'LETTING IT FLY' }, 'More threes. Fewer trips to the rim.'),
        o('rim', 'Get all the way to the rim', { attr: { finishing: 1, jumpShot: -1 }, window: 12, tag: 'DOWNHILL' }, 'More layups and free throws. Fewer jumpers.'),
      ] }) },
  { id: 'g-late-clock', at: ANY, w: 3, when: c => starts(c) && c.k >= 8 && c.T.has('handles') && c.val('handles') >= 7 && c.T.has('clutch') && c.T.has('jumpShot') && c.T.has('passing'),
    make: c => ({ kicker: 'LATE CLOCK', title: 'Five on the shot clock',
      body: `When a possession breaks down, the ball finds ${c.name} with five seconds left. He can take the tough one himself, or swing it and live with what comes.`,
      options: [
        o('take', 'Take the tough ones', gam(pOf(c, 0.5, ['clutch', 'jumpShot']), { attr: { clutch: 1 }, team: { off: 0.5 }, window: 10, tag: 'BAIL-OUT BUCKETS' }, 'He makes enough of them to save bad possessions.',
          { attr: { jumpShot: -1 }, window: 8, tag: 'FORCING IT' }, 'Contested twos at the buzzer. The percentages sink.')),
        o('swing', 'Swing it', { attr: { passing: 1 }, window: 10 }, 'The open man shoots it, whoever he is.'),
      ] }) },
  { id: 'g-pressure', at: ANY, w: 2, when: c => plays(c) && c.k >= 8 && c.T.has('perimeterDefense') && c.roleHas('legs') && c.roleHas('feel'),
    make: c => ({ kicker: 'DEFENSE', title: 'Pick him up full court',
      body: `The coach wants ball pressure for 94 feet, and he wants it from ${c.name}: turn the other team's guard twice before half court, every trip.`,
      options: [
        o('press', 'Pick up full court', { attr: mix({ perimeterDefense: 1 }, c.R1('legs', -1)), team: { def: 0.5 }, window: 10, tag: 'BALL PRESSURE' }, 'Their offense starts late. His legs are gone by the fourth.'),
        o('save', 'Save his legs for offense', { attr: c.R1('feel', 1), team: { def: -0.5 }, window: 10 }, 'He picks up at the three-point line. His shot stays fresh.'),
      ] }) },
  { id: 'g-lob', at: ANY, w: 3, when: c => starts(c) && c.k >= 8 && !!top(c.cr.men('big')) && c.T.has('passing') && c.T.has('finishing'),
    make: c => { const big = top(c.cr.men('big')); return { kicker: 'TWO-MAN GAME', title: 'The big man wants the ball',
      body: `${big.name} sets the screen, rolls, and watches ${c.name} take it all the way himself. He has said so, in the huddle.`,
      options: [
        o('feed', 'Throw him the pocket pass', { attr: { passing: 1, finishing: -1 }, team: { off: 0.5 }, window: 12, tag: 'PICK AND ROLL' }, `${last(big.name)} rolls hard when he knows the ball is coming.`),
        o('keep', 'Keep attacking', { attr: { finishing: 1 }, team: { off: -0.5 }, window: 12 }, `His points keep coming. ${last(big.name)} stops rolling hard.`),
      ] } } },
  { id: 'g-trapped', at: ANY, w: 4, when: c => starts(c) && c.cr.ovr >= 88 && c.k >= 8 && c.T.has('handles') && c.T.has('finishing') && c.roleHas('feel'),
    make: c => ({ kicker: 'GAME PLAN', title: 'Two on the ball',
      body: `The scouting report on the ${c.nick} is one line now: get the ball out of ${c.name}'s hands. Teams are trapping him off every screen.`,
      options: [
        o('pass', 'Give it up early', { attr: c.R1('feel', -1), team: { off: 1 }, window: 10, tag: 'SEEING DOUBLES' }, 'Four on three behind the trap. Fewer shots for him.'),
        o('split', 'Split the trap', gam(pOf(c, 0.5, ['handles', 'speed']), { attr: { handles: 1, finishing: 1 }, window: 10, tag: 'SPLITTING TRAPS' }, 'He gets through it, and nobody is left at the rim.', { team: { off: -0.5 }, window: 8, tag: 'TRAPPED' }, 'Deflections and backcourt violations.')),
      ] }) },
]
const LIFE_BIG = [
  { id: 'b-fouls', at: ANY, w: 3, when: c => plays(c) && c.k >= 8 && c.T.has('interiorDefense') && c.T.has('rebounding') && c.T.has('finishing'),
    make: c => ({ kicker: 'FOUL TROUBLE', title: 'Two quick ones',
      body: `Officials have been quick with the whistle on ${c.name}, and he has spent too many first halves on the bench with two fouls. The coach wants his hands straight up and no reaching.`,
      options: [
        o('careful', 'Play it straight up', { attr: { interiorDefense: -1, rebounding: 1 }, window: 10, tag: 'PLAYING CAREFUL' }, 'He stays on the floor. He gives up a few at the rim.'),
        o('contest', 'Keep going after every shot', gam(0.5, { attr: { interiorDefense: 1 }, window: 10, tag: 'RIM PROTECTOR' }, 'Clean blocks, and the whistle stays quiet.', { attr: { finishing: -1, rebounding: -1 }, window: 8, tag: 'FOUL TROUBLE' }, 'Two fouls in the first six minutes, again. He never finds a rhythm.')),
      ] }) },
  { id: 'b-switch', at: ANY, w: 3, when: c => starts(c) && c.k >= 8 && c.T.has('rebounding') && c.T.has('speed'),
    make: c => ({ kicker: 'SCHEME', title: 'Switch everything',
      body: `The coach wants to switch every screen. That leaves ${c.name} on a guard 25 feet from the basket, with nobody behind him at the rim.`,
      options: [
        o('switch', 'Switch out on guards', gam(pOf(c, 0.5, ['speed'], 0.07), { team: { def: 1 }, attr: { rebounding: -1 }, window: 12, tag: 'SWITCHING' }, 'He stays in front of them. The defense has no weak spot.', { team: { def: -0.5 }, attr: { rebounding: -1 }, window: 8, tag: 'HUNTED' }, 'Guards call for the screen every trip and go at him.')),
        o('drop', 'Stay back in the paint', { attr: { rebounding: 1 }, team: { def: -0.5 }, window: 12, tag: 'DROP COVERAGE' }, 'He owns the glass. Shooters get clean looks off the screen.'),
      ] }) },
  { id: 'b-pop', at: ANY, w: 2, when: c => plays(c) && c.k >= 8 && c.T.has('jumpShot') && c.val('jumpShot') >= 6 && c.T.has('finishing') && c.T.has('rebounding'),
    make: c => ({ kicker: 'OFFENSE', title: 'Pop, or roll',
      body: `After the screen ${c.name} can dive to the rim or step out to the line. The coach wants him to pick one and do it every time.`,
      options: [
        o('pop', 'Pop out to the line', { attr: { jumpShot: 1, rebounding: -1 }, window: 12, tag: 'STRETCH BIG' }, 'The lane opens for everyone. He is a long way from the glass.'),
        o('roll', 'Roll hard to the rim', { attr: { finishing: 1, jumpShot: -1 }, window: 12, tag: 'ROLLING' }, 'Lobs and dunks. His jumper stays in the gym.'),
      ] }) },
  { id: 'b-touches', at: ANY, w: 3, when: c => starts(c) && c.k >= 8 && (top(c.cr.men('guard'))?.ovr ?? 0) >= c.cr.ovr && c.T.has('finishing') && c.T.has('rebounding') && c.T.has('playmaking'),
    make: c => { const g = top(c.cr.men('guard')); return { kicker: 'TOUCHES', title: 'No post touches',
      body: `The offense starts and ends with ${g.name}. ${c.name} sets screens, runs the floor, and can go three trips without touching the ball.`,
      options: [
        o('ask', 'Ask the coach for the ball in the post', gam(0.5, { attr: { finishing: 1, playmaking: 1 }, window: 10, tag: 'INSIDE-OUT' }, 'Two sets a quarter run through him. The offense has another look.',
          { team: { off: -0.5 }, window: 6, tag: 'FRICTION' }, `The touches come, and ${last(g.name)} stands and watches. The ball stops moving.`)),
        o('glass', 'Get them off the glass', { attr: { rebounding: 1 }, window: 10 }, 'Nobody has to pass him an offensive rebound.'),
      ] } } },
  { id: 'b-hack', at: ['mid', 'late', 'stretch'], w: 3, when: c => starts(c) && c.T.has('jumpShot') && c.val('jumpShot') <= 4 && c.T.has('clutch') && c.roleHas('legs'),
    make: c => ({ kicker: 'AT THE LINE', title: 'They are fouling him on purpose',
      body: `Late in close games, teams grab ${c.name} away from the ball and send him to the line. It is working. The coach can take him out for the last three minutes.`,
      options: [
        o('shoot', 'Shoot two hundred free throws a day', { attr: mix({ jumpShot: 1 }, c.R1('legs', -1)), window: 10, tag: 'EXTRA WORK' }, 'An hour after every practice. The stroke gets a little better.'),
        o('sit', 'Come out late in close games', { attr: { clutch: -1 }, team: { off: 0.5 }, window: 10, tag: 'OFF THE FLOOR LATE' }, 'The offense keeps its possessions. He watches the endings.'),
      ] }) },
]
const LIFE = {
  nfl: { all: [...LIFE_ANY, ...LIFE_NFL], qb: LIFE_QB, rb: LIFE_RB, wr: LIFE_WR, te: LIFE_TE, ol: LIFE_OL, dl: LIFE_DL, lb: LIFE_LB, db: LIFE_DB },
  bucket: { all: [...LIFE_ANY, ...LIFE_NBA], guard: LIFE_GUARD, big: LIFE_BIG },
}
// (the sports whose Career has these cards; the director gives their seasons the LIFE stops)
export const hasLife = sport => !!LIFE[sport]
// every card a position can draw from it (for the record, and the checks)
export const lifeIds = (sport, pos) => [...(LIFE[sport]?.all ?? []), ...(LIFE[sport]?.[pos] ?? [])].map(s => s.id)

const BANK = {
  nfl: { own: { k: { season: K, playoffs: K_PLAYOFFS } }, all: [...NFL_ALL, ...INJURY], qb: QB, rb: RB, wr: WR, te: TE, db: DB, dl: DL, lb: LB, ol: OL, playoffs: [...NFL_PLAYOFFS, ...PO_INJURY] },
  bucket: { all: [...NBA_ALL, ...INJURY.filter(s => s.id !== 'concussion')], guard: GUARD, big: BIG, playoffs: [...NBA_PLAYOFFS, ...PO_INJURY] },
}
// A sport that loads on its own (soccer: lib/soccerSeason.js) brings its bank, its roles and its injuries
const CTX = {}
export function registerScenarios(sport, { bank, role = {}, injuries = {}, ctx = null }) { BANK[sport] = bank; Object.assign(ROLE, role); Object.assign(INJURIES, injuries); if (ctx) CTX[sport] = ctx }
// How many scenarios each position can draw from (for the record)
export const bankSize = (sport, pos) => (BANK[sport]?.all.length ?? 0) + (BANK[sport]?.[pos]?.length ?? 0) + (BANK[sport]?.playoffs.length ?? 0)

// Recently seen scenarios rotate to the back so seasons don't repeat
const RECENT_KEY = 'bap_scn_recent'
const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
const remember = id => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent().filter(x => x !== id)].slice(0, 30))) } catch {} }

// An option that does nothing for this build (its traits aren't in it) says so
const hollow = e => {
  if (!e) return true
  if (e.outcomes) return false
  if (e.gamble) return hollow(e.gamble.hit) && hollow(e.gamble.miss)
  return !e.trade && !Object.values(e.attr || {}).some(Boolean) && !e.team?.off && !e.team?.def && !e.sit && !e.xp && !e.dur && hollow(e.then)
}

// Picks the scenario for a stop (or null). `used` = ids already shown this season.
export function pickScenario(args) {
  const { sport, pos, stop, used = new Set(), next = null, noInjury = false } = args
  const c = context(args)
  const ph = phaseOf(stop)
  const bank = BANK[sport]
  if (!bank) return null
  // the next game turns on a moment: most of the time, that's the decision
  if (ph !== 'playoffs' && next && !stop.life) {
    const gm = gameMoment(c, next)
    if (gm && c.r() < 0.8) return { id: gm.id, inGame: true, kicker: gm.kicker, title: gm.title, body: gm.body, options: gm.options }
  }
  const seen = recent()
  const scope = ph === 'playoffs' ? 'for the playoffs' : ''
  const weight = s => (s.w ?? 1) * (seen.includes(s.id) ? 0.25 + 0.75 * (seen.indexOf(s.id) / 30) : 1)
  // a card is only worth showing if at least two of its choices actually do something
  const real = s => { try { return s.make(c).options.filter(op => !hollow(op.effect) || op.id === 'cover' || op.id === 'no').length >= 2 } catch { return false } }
  // (a name that ends in a period, at the end of a sentence: one period)
  const tidy = t => String(t).replace(/\b(Jr|Sr)\.\./g, '$1.')
  const draw = pool => {
    const fits = pool.filter(s => s.at.includes(ph) && !used.has(s.id) && !(noInjury && INJURY_CARDS.has(s.id)) && (() => { try { return s.when(c) } catch { return false } })())
    if (!fits.length) return null
    const usable = fits.filter(real)
    if (!usable.length) return null
    const total = usable.reduce((a, s) => a + weight(s), 0)
    let roll = c.r() * total, pick = usable[0]
    for (const s of usable) { roll -= weight(s); if (roll <= 0) { pick = s; break } }
    let card
    try { card = pick.make(c) } catch { return null }
    if (!card) return null
    remember(pick.id)
    return {
      id: pick.id, ...(card.inGame ? { inGame: true } : {}), kicker: card.kicker, title: card.title, body: tidy(card.body),
      options: card.options.map(op => ({ id: op.id, label: op.label, sub: op.sub ?? (isEmpty(op.effect) ? (op.flavor || 'Nothing changes.') : [op.flavor, describe(op.effect, c, scope)].filter(Boolean).join(' ')), effect: op.effect })),
    }
  }
  // Career's own cards (the LIFE bank): at the season's LIFE stops, and at a decision week where nothing in the
  // bank fits. A backup who is waiting on the depth chart only gets the ones written for him.
  const lifeCards = () => {
    const L = c.cr && ph !== 'playoffs' ? LIFE[sport] : null
    if (!L) return null
    const waiting = c.cr.role === 'waiting'
    return draw([...L.all, ...(L[pos] ?? [])].filter(s => !!s.waiting === waiting))
  }
  // (own: a position that brings its whole bank, the kicker's. None of Career's LIFE cards are his: they are written
  // for men who take snaps, so his LIFE stops pass without a card)
  const own = bank.own?.[pos]
  if (own) return stop.life ? null : draw(ph === 'playoffs' ? own.playoffs : own.season)
  if (stop.life) return lifeCards()
  return draw(ph === 'playoffs' ? bank.playoffs : [...bank.all, ...(bank[pos] ?? [])]) ?? lifeCards()
}
