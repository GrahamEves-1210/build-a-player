// FRANCHISE: PLAY THE MOMENTS. The user's game is the same play-by-play sim as every other game; this file is
// what makes it stop. Before a snap, a kick or a try the sim asks (game.js step → hooks): is this one of the
// plays the game hangs on, and is there a mini game that really is this play? If so the game stops with a
// moment; the mini game's result (or a roll from the same odds: SIM THIS ONE) becomes the play's result and
// the sim carries on from there.
//
// The rules (DESIGN section 5): 4 to 6 moments a game, never the same mini game twice in a game, variety from
// week to week (F.mom remembers when each was last used), the man who takes it is the one at that spot on the
// depth chart, and nothing is offered that the situation doesn't call for. Coach's calls (fourth downs, two-
// point tries) are separate: at most two a game, with the real odds on each choice.
import { GAMES, traitValue } from '../minigames'
import { xpP, onsideP } from '../kicks'
import { clamp, slotOf, ovrGrade, gradeOf } from './consts'
import { nick, TEAM_INFO } from './core'
import { asBuild, lastName, initials, traitLabel } from './players'
import {
  TUNE, LG0, secsLeft, spotText, clockText, ordinalDown, useRng, after, passOdds, pickTarget, applyPass, applyRun, applyFieldGoal, applyKickoff, applyOnside, applyTry,
  fgDist, fgOdds, twoOdds, rollKickoff,
} from './game'
import { rngOf } from './rng'

// which mini game fits which situation (also exported for the screens: API.md MOMENT_FITS)
export const MOMENT_FITS = {
  'third-long': 'Third and 7 or more: the quarterback has to find it past the sticks.',
  'pass-pro': 'Third and long: the line has to hold up.',
  release: 'Third down against press coverage: the receiver has to get off the line.',
  'hot-read': 'Third and medium against a blitz: the quarterback throws hot.',
  audible: 'A look at the line the quarterback can check out of.',
  catch: 'A contested ball on third down or in the red zone.',
  escape: 'A long-yardage dropback with the rush coming.',
  bomb: 'First or second down near midfield: a shot play.',
  sneak: 'Fourth (or third) and one.',
  gap: 'Short yardage: the back has to find the crease.',
  seal: 'Short yardage or the goal line: the edge has to be sealed.',
  'goal-line': 'Fourth and goal.',
  juke: 'First or second down: the back has one man to beat.',
  'juke-wr': 'A catch in space with one man to beat.',
  'juke-te': 'A catch in space with one man to beat.',
  'two-minute': 'Behind by a score inside two minutes, ball in hand.',
  'pass-rush': 'Their third and long: get home.',
  'jump-route': 'Their third down throw: jump it.',
  'zone-drop': 'Their third and medium: the hook zone.',
  'run-stuff': 'Their short yardage or the goal line.',
  'hit-stick': 'Their short yardage or the goal line.',
  'tackle-angle': 'Their back gets to the second level.',
  'kick-return': 'A kickoff in a one-score game, or to open the second half.',
  'game-winner': 'A field goal to tie or win it late.',
  onside: 'Behind late with no way to stop the clock.',
}

// ── How much hangs on it ─────────────────────────────────────────────────────
const elapsed = G => clamp(1 - secsLeft(G) / 3600, 0, 1) + (G.q >= 5 ? 1 : 0)
export function winProb(G, u) {
  const lead = G.sc[u] - G.sc[1 - u], t = G.q >= 5 ? 0.02 : secsLeft(G) / 3600
  const has = G.kick ? (G.kick.type === 'kickoff' ? (G.kick.team === u ? -1 : 1) : 0) : G.poss === u ? 1 : -1
  const field = has * (G.kick ? 0.8 : 1.1 + (G.yl - 45) * 0.05)
  const z = (lead + field) / (13.2 * Math.sqrt(Math.max(t, 0.003)) + 0.5)
  return 1 / (1 + Math.exp(-1.7 * z))
}
function leverage(G, u, w) {
  const wp = winProb(G, u), close = 4 * wp * (1 - wp), t = Math.min(1, elapsed(G))
  return clamp(0.12 + close * w * (0.52 + 0.48 * t), 0.12, 1)
}
// is this the play to stop on? L: its leverage. The pace keeps a game at 4 to 6.
function takeIt(G, L) {
  const n = G.stops.length, target = G.momTarget ?? 5, t = Math.min(1, elapsed(G))
  if (n >= 6) return false
  const finish = (G.q === 4 && G.clock <= 300) || G.q >= 5
  if (!finish && n >= 4) return false
  if (finish && n >= target && L < 0.85) return false
  if (n < Math.floor(4.6 * Math.pow(t, 0.9))) return true        // behind the pace: the next play that fits
  if (G.sinceStop < 4 && L < 0.85) return false
  if (L >= 0.88) return true
  return L >= clamp(0.62 - (target * Math.pow(t, 1.1) - n) * 0.45, 0.22, 0.86)
}

// ── Who takes it ─────────────────────────────────────────────────────────────
const built = m => (m?.p?.built ? 2.2 : 1)
function pickMan(R, list, w = () => 1) {
  const L = list.filter(m => m && m.p)
  if (!L.length) return null
  return L[Math.max(0, R.wpick(L.map(m => w(m) * built(m))))]
}
function whoFor(game, U, R) {
  switch (game) {
    case 'third-long': case 'hot-read': case 'audible': case 'escape': case 'bomb': case 'sneak': case 'two-minute': return U.qb
    case 'gap': case 'juke': return U.rbs[0]
    case 'release': case 'juke-wr': return pickMan(R, U.wr.slice(0, 3), m => m.s.tgt ?? 0.5)
    case 'catch': return pickMan(R, [...U.wr.slice(0, 3), U.te[0]], m => (m.s.rz ?? 0.5) + (m.s.tgt ?? 0.5))
    case 'juke-te': return U.te[0]
    case 'seal': { const ol = U.ol.find(o => o.p.built); return ol ? { p: ol.p, id: ol.id, s: ol.s } : U.te[0] ?? (U.ol[0] ? { p: U.ol[0].p, id: U.ol[0].id, s: U.ol[0].s } : null) }
    case 'pass-pro': { const ol = U.ol.find(o => o.p.built) ?? U.ol.find(o => o.spot === 'LT') ?? U.ol[0]; return ol ? { p: ol.p, id: ol.id, s: ol.s } : null }
    case 'goal-line': return pickMan(R, [U.qb, ...U.wr.slice(0, 2), U.te[0], U.rbs[0]].filter(m => m && (m === U.qb || m.p.built))) ?? U.qb
    case 'pass-rush': return pickMan(R, U.def.filter(m => m.role === 'EDGE' || m.role === 'DT' || (m.role === 'LB' && m.p.built)).slice(0, 6), m => Math.pow(m.s.rush ?? 0.3, 3) * m.snap)
    case 'run-stuff': return pickMan(R, U.def.filter(m => m.role === 'DT' || m.role === 'EDGE' || (m.role === 'LB' && m.p.built)), m => Math.pow(m.s.run ?? 0.3, 2) * m.snap * (m.role === 'DT' ? 1.5 : 1))
    case 'zone-drop': case 'hit-stick': return pickMan(R, U.def.filter(m => m.role === 'LB').slice(0, 3), m => m.snap)
    case 'jump-route': return pickMan(R, U.def.filter(m => m.role === 'CB' || m.role === 'S'), m => (m.s.int ?? 0.3) * m.snap)
    case 'tackle-angle': return pickMan(R, U.def.filter(m => m.role === 'S' || m.role === 'CB'), m => (m.s.run ?? 0.3) * m.snap * (m.role === 'S' ? 1.6 : 1))
    case 'kick-return': return U.kr ? { p: U.kr.p, id: U.kr.id, s: { ret: U.kr.ret } } : null
    case 'game-winner': case 'onside': return U.k.p ? { p: U.k.p, id: U.k.id, s: {} } : null
    default: return null
  }
}
// a position plays only the games that are its own (lib/minigames.js PLAYOFF_GAMES and what it borrows)
const PLAYS = {
  qb: ['third-long', 'hot-read', 'audible', 'escape', 'bomb', 'sneak', 'two-minute', 'goal-line'], rb: ['gap', 'juke', 'goal-line', 'kick-return'], wr: ['catch', 'juke-wr', 'release', 'goal-line', 'kick-return'],
  te: ['catch', 'seal', 'juke-te', 'goal-line', 'release'], ol: ['pass-pro', 'seal'], dl: ['pass-rush', 'run-stuff', 'tackle-angle'], lb: ['zone-drop', 'hit-stick', 'run-stuff', 'pass-rush', 'tackle-angle'],
  db: ['jump-route', 'tackle-angle', 'kick-return'], k: ['game-winner', 'onside'],
}

// ── The situations ───────────────────────────────────────────────────────────
// what the offense converts on a down, by yards to go (league rates; the matchup moves it)
const CONV = [0.68, 0.66, 0.57, 0.5, 0.46, 0.42, 0.39, 0.36, 0.33, 0.3, 0.27, 0.24, 0.22, 0.2, 0.17, 0.15]
const conv = d => CONV[clamp(d, 0, CONV.length - 1)]
function offenseEdge(G, T, o, LG, ctx) {
  const O = T[o], D = T[1 - o], P = passOdds(G, O, D, LG, ctx)
  return { pass: P.edge * 1.15 - (P.sack - 0.07) * 0.6, run: ((O.olRun - LG.olRun) - (D.runD - LG.runD)) * 0.5 + ((O.rbs[0]?.s.run ?? 0.5) - LG.rbRun) * 0.25, sack: P.sack }
}
// games that fit this snap: [game, how well it fits (0-1.2), odds of the good result]
function snapFits(G, T, u, LG, ctx) {
  const o = G.poss, onOff = o === u, E = offenseEdge(G, T, o, LG, ctx), dn = G.down, dist = G.dist, toGoal = 100 - G.yl
  const lead = G.sc[u] - G.sc[1 - u], out = []
  const money = dn >= 3
  if (onOff) {
    const pc = clamp(conv(dist) + E.pass, 0.08, 0.85), rc = clamp(conv(dist) + E.run, 0.1, 0.9)
    if (G.q === 4 && G.clock <= 135 && G.clock >= 40 && lead < 0 && lead >= -8 && dn === 1 && G.dPlays <= 1 && G.yl <= 72) {
      const needTd = lead < -3
      out.push(['two-minute', 1.3, clamp((needTd ? 0.22 : 0.4) + (T[o].qb.s.comp - LG.qbComp) * 0.4 + (G.yl - 25) * 0.004 + (G.clock - 90) / 90 * 0.06 + G.to[o] * 0.02, 0.08, 0.7), 1.2])
    }
    if (money && dist >= 7) { out.push(['third-long', 1, pc, 1], ['pass-pro', 0.75, clamp(1 - E.sack * 2.6 - (1 - pc) * 0.55, 0.2, 0.9), 1], ['release', 0.6, pc, 1], ['escape', 0.45, clamp(pc * 0.9, 0.08, 0.8), 1]) }
    else if (money && dist >= 3) { out.push(['hot-read', 0.9, pc, 1], ['audible', 0.6, pc, 1], ['catch', 0.75, pc, 1], ['release', 0.55, pc, 1]) }
    else if (money && dist <= 2) {
      if (dn === 4 && toGoal <= 8 && dist === toGoal) out.push(['goal-line', 1.2, clamp(0.52 - (toGoal - 1) * 0.05 + E.pass * 0.6, 0.15, 0.75), 1.15])
      if (dist <= 1) out.push(['sneak', dn === 4 ? 1.1 : 0.8, clamp(rc + 0.06, 0.2, 0.92), dn === 4 ? 1.1 : 1])
      out.push(['gap', 0.85, rc, 1], ['seal', 0.6, rc, 1])
    }
    if (dn === 4 && toGoal <= 8 && dist === toGoal && dist > 2) out.push(['goal-line', 1.2, clamp(0.5 - (toGoal - 1) * 0.045 + E.pass * 0.6, 0.12, 0.7), 1.15])
    if (toGoal <= 20 && dn >= 2 && dist >= 3 && !(dn === 4)) out.push(['catch', 0.8, clamp(0.4 + E.pass, 0.1, 0.75), 0.9])
    if (dn <= 2 && G.yl >= 30 && G.yl <= 62) out.push(['bomb', 0.8, clamp(TUNE.comp[2] + E.pass + (T[o].qb.s.deep - LG.qbDeep) * 0.15 - 0.03, 0.12, 0.62), 0.9])
    if (dn <= 2 && dist >= 5 && G.yl <= 80) out.push(['juke', 0.55, 0.22, 0.8], ['juke-wr', 0.55, 0.26, 0.8], ['juke-te', 0.5, 0.24, 0.8], ['audible', 0.45, 0.42, 0.75])
  } else {
    const stop = clamp(1 - conv(dist) + (E.pass < 0 ? -E.pass : -E.pass), 0.12, 0.92), stopRun = clamp(1 - conv(dist) - E.run, 0.1, 0.9)
    if (money && dist >= 5) out.push(['pass-rush', 1, stop, 1], ['jump-route', 0.9, stop, 1], ['zone-drop', dist <= 9 ? 0.85 : 0.55, stop, 1])
    else if (money && dist >= 3) out.push(['zone-drop', 0.9, stop, 1], ['jump-route', 0.8, stop, 1], ['pass-rush', 0.7, stop, 1])
    else if (money || (toGoal <= 3 && dn >= 2)) out.push(['run-stuff', 1, stopRun, toGoal <= 3 ? 1.1 : 1], ['hit-stick', 1, stopRun, toGoal <= 3 ? 1.1 : 1])
    if (dn <= 2 && dist >= 5 && G.yl >= 20 && G.yl <= 75) out.push(['tackle-angle', 0.6, 0.74, 0.8])
    if (toGoal <= 20 && dn >= 2 && dist >= 3 && !money) out.push(['jump-route', 0.6, clamp(0.6 - E.pass, 0.2, 0.9), 0.85])
  }
  return out
}

// ── Building a stop ──────────────────────────────────────────────────────────
function situationOf(G, u) {
  const us = G.sc[u], them = G.sc[1 - u], usS = u === 0 ? G.h : G.a, themS = u === 0 ? G.a : G.h
  const qn = G.q >= 5 ? 'overtime' : ['first', 'second', 'third', 'fourth'][G.q - 1]
  const where = us > them ? `${nick(usS)} lead ${us}-${them}` : us < them ? `${nick(usS)} trail ${them}-${us}` : `${nick(usS)} and ${nick(themS)} are tied at ${us}`
  const ct = clockText(G.clock), spot = G.kick ? null : spotText(G, G.poss, G.yl)
  const goal = !G.kick && G.dist >= 100 - G.yl
  const dd = G.kick ? '' : `${ordinalDown[G.down]} and ${goal ? 'goal' : G.dist <= 1 && G.yl < 99 ? (G.down === 4 ? 'inches' : '1') : G.dist}`
  return {
    q: G.q, clock: G.clock, clockText: ct, down: G.kick ? 0 : G.down, dist: G.kick ? 0 : G.dist, spot: G.kick ? null : G.yl, spotText: spot, us, them, usShort: usS, themShort: themS, poss: G.kick ? null : (G.poss === 0 ? G.h : G.a),
    text: `${where}, ${ct} left in ${G.q >= 5 ? 'overtime' : `the ${qn}`}.${G.kick ? '' : ` ${dd[0].toUpperCase()}${dd.slice(1)} at the ${spot.replace(/^the /, '')}.`}`,
    short: `${G.q >= 5 ? 'OT' : `Q${G.q}`} ${ct}${G.kick ? '' : ` · ${dd.toUpperCase().replace(' AND ', ' & ')} · ${spot.replace(/^the /, '').toUpperCase()}`}`,
  }
}
const mgSituation = (G, u, sit, tail, extra = {}) => ({ us: sit.usShort, them: sit.themShort, mine: sit.us, opp: sit.them, hoops: false, clock: G.clock, clockText: sit.clockText, period: G.q >= 5 ? 'OT' : ['1ST', '2ND', '3RD', '4TH'][G.q - 1], line: sit.text, tail, ...extra })

// the words for each game: [setup, stakes, win, loss]. n: the player's last name, d: yards to go.
const WORDS = {
  'third-long': (n, d) => [`${n} drops back needing ${d}.`, 'Convert and the drive lives.', 'A strike past the sticks: first down.', 'Incomplete. The drive is over.'],
  'pass-pro': (n, d) => [`${n} has the best rusher on the field across from him and the offense needs ${d}.`, 'Give the quarterback time and the throw is there.', 'A clean pocket, and the throw moves the chains.', 'The rusher gets home: sack.'],
  release: (n, d) => [`${n} is pressed at the line with ${d} to go.`, 'Win at the line and the ball is his.', 'Beats the jam, makes the catch: first down.', 'Jammed at the line. The throw falls incomplete.'],
  'hot-read': (n) => [`They are bringing the house. ${n} has to throw hot.`, 'Find the open man before the blitz gets there.', 'Finds the hot receiver: first down.', 'Throws it into coverage: incomplete, or worse.'],
  audible: (n) => [`${n} walks to the line and does not like the look.`, 'Check into the right play.', 'The right check against that look: a big gain.', 'The wrong read: stopped behind the line.'],
  catch: (n) => [`The ball is going up for ${n} in a crowd.`, 'Come down with it.', 'Goes up and takes it away from the defender.', 'Knocked away. Incomplete.'],
  escape: (n, d) => [`The pocket is collapsing around ${n} with ${d} to go.`, 'Get out and get the first down.', 'Slips the rush and runs for the first down.', 'Wrapped up for a sack.'],
  bomb: (n) => [`${n} has a receiver running free down the sideline.`, 'A shot play: hit it and the field flips.', 'Drops it in the bucket for a huge gain.', 'Overthrown. Incomplete.'],
  sneak: (n) => [`${n} is under center with a yard to get.`, 'A yard for the first down.', 'Gets the push and the first down.', 'Stood up short of the line.'],
  gap: (n) => [`${n} takes the handoff needing a crease.`, 'Find the hole and move the chains.', 'Hits the right gap and moves the chains.', 'Met in the hole for no gain.'],
  seal: (n) => [`The run is coming around ${n}'s side.`, 'Seal the edge and the back is gone.', 'The edge is sealed and the back turns the corner for a big gain.', 'The edge is lost and the run is strung out for a loss.'],
  'goal-line': (n) => [`Fourth and goal. The ball is going to ${n}.`, 'Six points, or nothing.', 'Touchdown.', 'Stopped. They take over on downs.'],
  juke: (n) => [`${n} breaks into the second level with one man to beat.`, 'Make him miss and it is a big one.', 'Makes the safety miss and is gone for a big gain.', 'Brought down after a short gain.'],
  'juke-wr': (n) => [`${n} catches it in space with one man to beat.`, 'Make him miss and it is a big one.', 'Makes the first man miss and turns it into a big gain.', 'Tackled where he caught it.'],
  'juke-te': (n) => [`${n} catches it over the middle with one man to beat.`, 'Make him miss and it is a big one.', 'Runs through the tackle for a big gain.', 'Tackled where he caught it.'],
  'two-minute': (n) => [`${n} has the ball and the clock against him.`, 'Drive the field or go home.', 'Marches them down the field.', 'The drive stalls and the ball goes over on downs.'],
  'pass-rush': (n, d) => [`${n} pins his ears back. They need ${d}.`, 'Get to the quarterback and get off the field.', 'Gets home. Sack, and the defense is off the field.', 'The quarterback has time and finds his man for the first down.'],
  'jump-route': (n, d) => [`${n} is reading the quarterback's eyes. They need ${d}.`, 'Jump the route and take it away.', 'Reads it all the way and takes it away.', 'Bites, and the throw goes over him for the first down.'],
  'zone-drop': (n, d) => [`${n} drops into the hook zone. They need ${d}.`, 'Get to the throw.', 'Breaks on the throw and knocks it down.', 'A step late: the catch is made in front of him for the first down.'],
  'run-stuff': (n) => [`They are running it right at ${n}.`, 'Hold the line.', 'Sheds the block and stuffs it.', 'Moved off the ball: they get it.'],
  'hit-stick': (n) => [`${n} fills the hole against the run.`, 'Meet him in the hole.', 'Meets the back in the hole and drops him.', 'A step slow to the hole: they get it.'],
  'tackle-angle': (n) => [`Their back is through the line and ${n} is the last man.`, 'Take the right angle and get him down.', 'Takes the right angle and gets him on the ground.', 'Takes a bad angle and the back is gone.'],
  'kick-return': (n) => [`${n} is deep to receive.`, 'A big return sets up the offense.', 'Finds a seam and brings it out past midfield.', 'Dropped inside the 20.'],
  'game-winner': (n, d) => [`${n} lines up from ${d} yards.`, 'The game is on his foot.', `Good from ${d}.`, `No good from ${d}.`],
  onside: (n) => [`${n} lines up for the onside kick.`, 'They need the ball back.', 'Recovered. The offense is back on the field.', 'The hands team falls on it.'],
}
function playerOf(m, game, G, u) {
  const p = m.p, build = asBuild(p), g = GAMES[game]
  const keys = (g?.traits ?? []).filter(t => build[t])
  const isK = p.pos === 'k'
  return {
    id: p.id, name: p.name, short: lastName(p.name), num: p.num ?? null, pos: p.pos, slot: slotOf(p), team: p.team, photo: p.photo ?? null, initials: initials(p.name), skin: p.skin ?? '#7a5030', built: !!p.built, ovr: p.ovr, grade: ovrGrade(p.ovr),
    v: Math.round(traitValue(game, build) * 100) / 100,
    traits: keys.map(t => ({ key: t, ...traitLabel(p.pos, t), val: p.a[t], grade: gradeOf(p.a[t]) })),
    build, kick: isK ? { power: p.a.power ?? 5, accuracy: p.a.accuracy ?? 5, clutch: p.a.clutch ?? 5 } : null, dist: null, arm: p.pos === 'qb' ? p.a.arm ?? 5 : 5,
  }
}
function raise(F, G, T, u, game, m, odds, L, extra = {}) {
  const sit = situationOf(G, u), d = extra.dist ?? G.dist
  const n = G.stops.length + 1, pl = playerOf(m, game, G, u)
  if (extra.kickDist) pl.dist = extra.kickDist
  let [setup, stakes, win, loss] = WORDS[game](pl.short, extra.kickDist ?? d)
  if (game === 'two-minute') win = G.sc[u] - G.sc[1 - u] < -3 ? 'Drives the length of the field for the touchdown.' : 'Drives into field goal range with seconds left.'
  const us = u === 0 ? G.h : G.a, them = u === 0 ? G.a : G.h
  const side = ['game-winner', 'onside', 'kick-return'].includes(game) ? 'st' : (G.kick ? 'st' : G.poss === u ? 'off' : 'def')
  G.pend = {
    kind: 'moment', id: `${G.id}-m${n}`, n, game, title: GAMES[game]?.title ?? game.toUpperCase(), side, player: pl,
    situation: { ...sit, text: `${sit.text} ${setup}` }, stakes, win: extra.win ?? win, loss: extra.loss ?? loss,
    odds: Math.round(clamp(odds, 0.03, 0.97) * 100) / 100, leverage: Math.round(L * 100) / 100,
    mg: { game, v: pl.v, arm: pl.arm, kick: pl.kick, seed: `${F.seed}-${F.year}-${G.id}-m${n}`, sport: 'nfl', pos: pl.pos, team: kit(us), opp: kit(them), home: G.neutral ? 'team' : u === 0 ? 'team' : 'opp', superBowl: G.playoff === 'sb' ? F.year : null,
      situation: mgSituation(G, u, sit, stakes, extra.kickDist ? { dist: extra.kickDist } : {}), weather: G.env?.tag === 'snow' || G.env?.tag === 'rain' ? G.env.tag : null, cast: null },
    ...(extra.data && { data: extra.data }),
  }
  G.sinceStop = 0
  return true
}
const kit = short => ({ short, color: TEAM_INFO[short]?.color ?? '#333333', color2: TEAM_INFO[short]?.color2 ?? '#ffffff' })
// one of the games that fit, never one already used today, the least recently used across the season first
function choose(F, G, T, u, fits, R) {
  const U = T[u], week = F.year * 100 + F.week
  const ok = fits.filter(([game]) => !G.used.includes(game) && GAMES[game]).map(f => ({ f, m: whoFor(f[0], U, R) })).filter(x => x.m && x.m.p && (PLAYS[x.m.p.pos] ?? []).includes(x.f[0]))
  if (!ok.length) return null
  const FRESH = [0.12, 0.4, 0.85, 1.3, 1.8, 2.3, 2.8]
  const w = ok.map(({ f, m }) => f[1] * FRESH[clamp(week - (F.mom?.[f[0]] ?? 0) - 1, 0, 6)] * (m.p.built ? 1.8 : 1))
  return ok[Math.max(0, R.wpick(w))]
}

// ── The hooks game.js calls ──────────────────────────────────────────────────
export function makeHooks(F, { moments = true, calls = true } = {}) {
  const LGof = () => F.lg ?? LG0
  return {
    snap(G, T, ctx) {
      const u = G.user
      if (!moments || u < 0) return false
      const R = rngOf(`${F.seed}-${G.id}-snap-${G.n}`)
      const fits = snapFits(G, T, u, LGof(), ctx)
      if (!fits.length) return false
      const best = Math.max(...fits.map(f => f[3] ?? 1))
      const late = G.q >= 4 && Math.abs(G.sc[0] - G.sc[1]) <= 8 && (G.clock <= 240 || G.q >= 5)
      // the two-minute drill is the game: it is always offered when it comes up
      const drill = fits.find(f => f[0] === 'two-minute' && !G.used.includes('two-minute'))
      const L = drill ? Math.max(0.92, leverage(G, u, 1.5)) : leverage(G, u, (G.down >= 3 ? 1 : 0.8) * best * (late ? 1.25 : 1))
      // (there are more ways to play offense than defense: an ordinary defensive snap is passed over now and then so the
      // same three third-down games do not come up every week)
      if (!drill && G.poss !== u && L < 0.85 && R.chance(0.42)) return false
      if (!takeIt(G, L)) return false
      if (drill) return raise(F, G, T, u, 'two-minute', whoFor('two-minute', T[u], R), drill[2], L)
      const pick = choose(F, G, T, u, L >= 0.88 || G.down >= 3 ? fits.filter(f => (f[3] ?? 1) >= 0.85).length ? fits.filter(f => (f[3] ?? 1) >= 0.85) : fits : fits, R)
      if (!pick) return false
      return raise(F, G, T, u, pick.f[0], pick.m, pick.f[2], L)
    },
    kickoff(G, T) {
      const u = G.user
      if (!moments || u < 0 || G.kick.free) return false
      const R = rngOf(`${F.seed}-${G.id}-ko-${G.n}`), k = G.kick.team, lead = G.sc[u] - G.sc[1 - u]
      if (k === u) {
        // behind late: the onside kick
        const need = G.q === 4 && lead < 0 && lead >= -16 && G.clock <= 130 && (G.to[u] < 2 || G.clock <= 75)
        if (!need || G.used.includes('onside') || G.stops.length >= 6 || !T[u].k.p) return false
        return raise(F, G, T, u, 'onside', whoFor('onside', T[u], R), onsideP(T[u].k.v), 0.95)
      }
      if (G.used.includes('kick-return') || !T[u].kr) return false
      const opening = G.q === 3 && G.clock === 900
      if (!opening && Math.abs(lead) > 8) return false
      const L = leverage(G, u, opening ? 0.75 : 0.85)
      if (!takeIt(G, L)) return false
      const m = whoFor('kick-return', T[u], R)
      if (!m || !(PLAYS[m.p.pos] ?? []).includes('kick-return')) return false
      return raise(F, G, T, u, 'kick-return', m, clamp(0.13 + (T[u].kr.ret ?? 0.5) * 0.12, 0.08, 0.3), L)
    },
    fieldGoal(G, T, { pressure }) {
      const u = G.user
      if (!moments || u < 0 || G.poss !== u || !T[u].k.p || T[u].k.p.pos !== 'k' || G.used.includes('game-winner')) return false
      const lead = G.sc[u] - G.sc[1 - u]
      const late = (G.q === 4 && G.clock <= 150) || G.q >= 5
      if (!(late && lead <= 0 && lead >= -3) || G.stops.length >= 6) return false
      const R = rngOf(`${F.seed}-${G.id}-fg-${G.n}`), dist = fgDist(G.yl)
      return raise(F, G, T, u, 'game-winner', whoFor('game-winner', T[u], R), fgOdds(G, T, u, 1), 1, { kickDist: dist, win: lead < 0 ? `Good from ${dist}. Tied.` : `Good from ${dist}. ${nick(u === 0 ? G.h : G.a)} lead.`, data: { pressure } })
    },
    fourth(G, T, call) {
      const u = G.user
      if (!calls || u < 0 || G.poss !== u || G.calls.length >= 2) return false
      const LG = LGof(), E = offenseEdge(G, T, u, LG, { down: 4, dist: G.dist, yl: G.yl })
      const lead = G.sc[u] - G.sc[1 - u], dist = fgDist(G.yl), reach = 52 + (T[u].k.v.power ?? 5) * 1.4
      const wp = winProb(G, u), close = 4 * wp * (1 - wp)
      const real = close >= 0.12 && ((G.dist <= 3 && G.yl >= 40) || (dist <= reach && G.dist <= 4) || (G.q === 4 && lead < 0 && G.clock <= 420 && G.dist <= 10))
      if (!real) return false
      const go = clamp(conv(G.dist) + (G.dist <= 2 ? E.run : E.pass) + T[u].sit * 0.02, 0.05, 0.9)
      const sit = situationOf(G, u), options = []
      options.push({ id: 'go', label: 'GO FOR IT', odds: Math.round(go * 100) / 100, oddsText: `${Math.round(go * 100)}%`, note: G.dist >= 100 - G.yl ? 'A touchdown if it works. Their ball at the spot if it fails.' : 'A first down if it works. Their ball at the spot if it fails.', staff: call === 'go' })
      if (dist <= reach + 4) { const p = fgOdds(G, T, u, G.q >= 4 && lead <= 0 && lead >= -3 ? 1 : 0); options.push({ id: 'fg', label: `KICK THE ${dist}-YARD FIELD GOAL`, odds: Math.round(p * 100) / 100, oddsText: `${Math.round(p * 100)}%`, note: `Three points${lead + 3 === 0 ? ' ties it' : lead + 3 > 0 && lead <= 0 ? ' and the lead' : ''}. A miss gives them the ball at the spot of the kick.`, staff: call === 'fg' }) }
      if (G.yl <= 68) options.push({ id: 'punt', label: 'PUNT', odds: null, oddsText: 'NET 41', note: `Pins them near their ${clamp(100 - G.yl - 41, 8, 45)}.`, staff: call === 'punt' })
      if (options.length < 2) return false
      if (!options.some(o => o.staff)) options[0].staff = true
      G.pend = { kind: 'call', id: `${G.id}-c${G.calls.length + 1}`, n: G.calls.length + 1, type: 'fourth-down', situation: sit, setup: `${sit.text} What is the call?`, options }
      return true
    },
    try(G, T, wants) {
      const u = G.user
      if (!calls || u < 0 || G.kick.team !== u || G.calls.length >= 2 || G.q >= 5) return false
      const lead = G.sc[u] - G.sc[1 - u]
      const real = wants || (G.q >= 3 && [-2, -5, -8, -9, -10, 1, 5, -1, -15, -16].includes(lead)) || (G.q === 4 && G.clock <= 300 && [-1, 0, 4, -4].includes(lead))
      const wp = winProb(G, u)
      if (!real || 4 * wp * (1 - wp) < 0.12) return false
      const two = twoOdds(G, T, u, LGof()), one = xpP(T[u].k.v, { yards: G.env.yards })
      const sit = situationOf(G, u)
      const after2 = lead + 2, after1 = lead + 1
      const word = m => (m === 0 ? 'ties it' : m > 0 ? `makes it a ${m}-point lead` : `cuts it to ${-m}`)
      G.pend = { kind: 'call', id: `${G.id}-c${G.calls.length + 1}`, n: G.calls.length + 1, type: 'two-point', situation: sit, setup: `Touchdown, ${nick(u === 0 ? G.h : G.a)}. ${sit.us > sit.them ? `They lead ${sit.us}-${sit.them}` : sit.us < sit.them ? `They trail ${sit.them}-${sit.us}` : `It is tied at ${sit.us}`} before the try.`,
        options: [
          { id: 'two', label: 'GO FOR TWO', odds: Math.round(two * 100) / 100, oddsText: `${Math.round(two * 100)}%`, note: `Two points ${word(after2)}.`, staff: !!wants },
          { id: 'one', label: 'KICK THE EXTRA POINT', odds: Math.round(one * 100) / 100, oddsText: `${Math.round(one * 100)}%`, note: `One point ${word(after1)}.`, staff: !wants },
        ] }
      return true
    },
  }
}

// ── Resolving ────────────────────────────────────────────────────────────────
const gain = (R, lo, hi) => R.int(lo, hi)
// the yards that fit the field: never past the goal line by accident, a touchdown when it gets there
const cap = (G, y) => Math.min(100 - G.yl, y)
function target(G, T, o, m, kind = null) {
  // the receiver for a forced throw: the moment's own man when he catches passes, else by the usual weights
  const O = T[o]
  const mine = O.recv.find(r => r.id === m?.id)
  if (mine) return mine
  const { r } = pickTarget(G, O, { yl: G.yl, long: G.dist >= 7, rz: G.yl >= 80 })
  return kind ? O.recv.find(x => x.kind === kind) ?? r : r
}
const defMan = (T, d, m) => T[d].def.find(x => x.id === m?.id) ?? null

// A call: remember the choice; the next step plays it
export function resolveCall(F, G, choice) {
  const p = G.pend
  const opt = p.options.find(o => o.id === choice) ?? p.options.find(o => o.staff) ?? p.options[0]
  G.dec = { at: p.type === 'two-point' ? 'try' : 'fourth', choice: opt.id }
  G.calls.push({ type: p.type, choice: opt.id, label: opt.label, odds: opt.odds, worked: null, text: null, q: G.q, clock: G.clock, mark: G.keep ? G.log.length : 0, sc: G.sc[G.user] })
  G.pend = null
}
// after the play a call led to: did it work
export function settleCall(G) {
  const c = G.calls[G.calls.length - 1]
  if (!c || c.worked != null || G.dec) return
  const u = G.user, last = G.keep ? G.log.slice(c.mark) : []
  if (last[0] && c.choice !== 'go') last[0].call = true
  if (c.choice === 'two' || c.choice === 'one') { c.worked = G.sc[u] > c.sc; c.text = last[0]?.text ?? null; return }
  if (c.choice === 'fg') { c.worked = G.sc[u] >= c.sc + 3; c.text = last[0]?.text ?? null; return }
  if (c.choice === 'punt') { c.worked = true; c.text = last[0]?.text ?? null; return }
  c.worked = G.sc[u] > c.sc || (G.poss === u && !G.kick && G.down === 1)
  c.text = last[last.length - 1]?.text ?? null
  if (last[0]) last[0].call = true
}

// A moment: win or lose it, with the mini game's score (0-1) for how well
export function resolveMoment(F, G, T, result) {
  const p = G.pend, game = p.game, u = G.user, LG = F.lg ?? LG0
  const R = useRng(G)
  let win, score
  if (result === 'sim' || result == null) { win = R.chance(p.odds); score = win ? 0.55 : 0.2; }
  else { win = !!(result.win ?? result.hit); score = clamp(Number(result.score ?? (win ? 0.75 : 0.25)), 0, 1) }
  const simmed = result === 'sim' || result == null
  // what the throwing games showed (lib/mg/throw.js: the yards he got, past the sticks, a touchdown): the play is that
  const raw = !simmed && result.raw && Number.isFinite(result.raw.gain) ? result.raw : null
  const o = G.poss, d = 1 - o, O = T[o], D = T[d]
  const me = { p: F.players[p.player.id], id: p.player.id }
  const name = p.player.short, dist = G.dist, toGoal = 100 - G.yl
  const mark = G.keep ? G.log.length : 0
  G.n++
  G.used.push(game)
  ;(F.mom ??= {})[game] = F.year * 100 + F.week
  const big = score >= 0.9
  switch (game) {
    case 'third-long': case 'release': case 'hot-read': case 'catch': case 'pass-pro': {
      const r = target(G, T, o, me)
      if (win) {
        const td = game === 'catch' && toGoal <= 20
        const y = td || (raw && game === 'third-long' && raw.pts) ? toGoal : raw && game === 'third-long' ? cap(G, Math.max(dist, 1) + (raw.past ?? 0)) : cap(G, Math.max(dist, 1) + gain(R, 0, 6) + (big ? gain(R, 5, 16) : 0))
        applyPass(G, T, { type: 'comp', r, depth: y >= 20 ? 2 : y >= 10 ? 1 : 0, yds: y }, {
          text: game === 'catch' ? `${nm(O.qb)} puts it up for ${nm(r)} and he comes down with it${G.yl + y >= 100 ? ' in the end zone. Touchdown.' : ` for ${y} and the first down.`}`
            : game === 'pass-pro' ? `${name} stones his man. ${nm(O.qb)} has all day and hits ${nm(r)} for ${y}${G.yl + y >= 100 ? '. Touchdown.' : ' and the first down.'}`
            : game === 'release' ? `${nm(r)} wins off the line and ${nm(O.qb)} hits him for ${y}${G.yl + y >= 100 ? '. Touchdown.' : ' and the first down.'}`
            : `${nm(O.qb)} ${game === 'hot-read' ? 'beats the blitz and finds' : 'stands in and fires to'} ${nm(r)} for ${y}${G.yl + y >= 100 ? '. Touchdown.' : ' and the first down.'}` })
      } else if (game === 'pass-pro') applyPass(G, T, { type: 'sack', yds: -gain(R, 5, 9), fum: false }, { text: `${name} is beaten around the edge and ${nm(O.qb)} goes down for a sack.` })
      else if (raw && game === 'third-long') { const y = cap(G, clamp(raw.gain, 0, Math.max(0, dist - 1))); applyPass(G, T, { type: 'comp', r, depth: y >= 10 ? 1 : 0, yds: y }, { text: `${nm(O.qb)} finds ${nm(r)} for ${y}, short of the sticks.` }) }   // (caught short, as shown)
      else if (game === 'hot-read' && !simmed && score <= 0.25 && R.chance(0.5)) applyPass(G, T, { type: 'int', r, depth: 1 }, { pick6: false })
      else applyPass(G, T, { type: 'inc', r, depth: 1, pd: game === 'catch' || game === 'release' }, { text: game === 'release' ? `${nm(r)} is jammed at the line and the throw from ${nm(O.qb)} sails incomplete.` : undefined })
      break
    }
    case 'escape':
      if (win) applyPass(G, T, { type: 'scramble', yds: cap(G, Math.max(dist, 1) + gain(R, 1, 7) + (big ? gain(R, 4, 14) : 0)) })
      else applyPass(G, T, { type: 'sack', yds: -gain(R, 5, 9), fum: false })
      break
    case 'bomb': {
      const r = O.recv.filter(x => x.kind === 'wr').sort((a, b) => (b.s.deep ?? 0) - (a.s.deep ?? 0))[0] ?? target(G, T, o, null)
      if (win) { const y = raw?.pts ? toGoal : raw ? cap(G, Math.max(raw.gain, 15)) : cap(G, gain(R, 34, 52) + (big ? 12 : 0)); applyPass(G, T, { type: 'comp', r, depth: 2, yds: y }, { text: `${name} lets it fly for ${nm(r)}, and it drops right in the bucket${G.yl + y >= 100 ? `. ${y}-yard touchdown.` : ` for ${y}.`}` }) }
      else if (raw) { const c = target(G, T, o, null), y = cap(G, raw.gain); applyPass(G, T, { type: 'comp', r: c, depth: 0, yds: y }, { text: `${name} looks deep, has nothing and checks it down to ${nm(c)} for ${y}.` }) }   // (the checkdown he threw)
      else applyPass(G, T, { type: 'inc', r, depth: 2, pd: false }, { text: `${name} goes deep for ${nm(r)} and it is overthrown. Incomplete.` })
      break
    }
    case 'audible': {
      if (win) { const r = target(G, T, o, null); const y = cap(G, Math.max(dist, gain(R, 12, 22)) + (big ? gain(R, 4, 12) : 0)); applyPass(G, T, { type: 'comp', r, depth: 1, yds: y }, { text: `${name} checks out of it at the line and hits ${nm(r)} for ${y}${G.yl + y >= 100 ? '. Touchdown.' : '.'}` }) }
      else applyRun(G, T, { type: 'run', m: O.rbs[0], qbRun: false, yds: -gain(R, 1, 3), fum: false }, { text: `${name} stays with the call and ${nm(O.rbs[0])} is buried in the backfield.` })
      break
    }
    case 'sneak':
      if (win) applyRun(G, T, { type: 'run', m: O.qb, qbRun: true, yds: cap(G, Math.max(dist, 1) + gain(R, 0, 1)), fum: false })
      else applyRun(G, T, { type: 'run', m: O.qb, qbRun: true, yds: 0, fum: false }, { text: `${name} tries to sneak it and is stood up short.` })
      break
    case 'gap': case 'juke': case 'seal': {
      const rb = O.rbs[0]
      if (win) {
        const y = game === 'gap' ? cap(G, Math.max(dist, 1) + gain(R, 2, 7) + (big ? gain(R, 5, 14) : 0)) : cap(G, gain(R, 14, 28) + (big ? gain(R, 6, 18) : 0))
        applyRun(G, T, { type: 'run', m: rb, qbRun: false, yds: y, fum: false }, game === 'seal' ? { text: `${name} seals the edge and ${nm(rb)} turns the corner for ${y}${G.yl + y >= 100 ? '. Touchdown.' : '.'}` } : game === 'juke' ? { text: `${nm(rb)} puts a move on the safety and is gone for ${y}${G.yl + y >= 100 ? '. Touchdown.' : '.'}` } : {})
      } else applyRun(G, T, { type: 'run', m: rb, qbRun: false, yds: game === 'seal' ? -gain(R, 1, 3) : game === 'juke' ? gain(R, 1, 3) : 0, fum: false }, game === 'seal' ? { text: `${name} loses the edge and ${nm(rb)} is strung out for a loss.` } : {})
      break
    }
    case 'juke-wr': case 'juke-te': {
      const r = target(G, T, o, me, game === 'juke-te' ? 'te' : 'wr')
      const y = win ? cap(G, gain(R, 18, 32) + (big ? gain(R, 6, 20) : 0)) : cap(G, gain(R, 3, 6))
      applyPass(G, T, { type: 'comp', r, depth: 0, yds: y }, { text: win ? `${nm(O.qb)} hits ${nm(r)} in stride, he makes a man miss and takes it ${y}${G.yl + y >= 100 ? ' to the house. Touchdown.' : '.'}` : `${nm(O.qb)} to ${nm(r)}, tackled right there for ${y}.` })
      break
    }
    case 'goal-line': {
      const r = me.p.pos === 'qb' ? target(G, T, o, null) : target(G, T, o, me)
      if (me.p.pos === 'rb' && win) applyRun(G, T, { type: 'run', m: O.rbs.find(x => x.id === me.id) ?? O.rbs[0], qbRun: false, yds: toGoal, fum: false })
      else if (win) applyPass(G, T, { type: 'comp', r, depth: 0, yds: toGoal }, { text: `Fourth and goal. ${nm(O.qb)} fires to ${nm(r)}. Touchdown.` })
      else applyPass(G, T, { type: 'inc', r, depth: 0, pd: true }, { text: `Fourth and goal. ${nm(O.qb)} looks for ${nm(r)} and it is knocked away. Turnover on downs.` })
      break
    }
    case 'two-minute': twoMinute(G, T, o, win, score, R); break
    case 'pass-rush': {
      const by = defMan(T, d, me)
      if (win && (!simmed || R.chance(0.3))) applyPass(G, T, { type: 'sack', yds: -gain(R, 5, 9), fum: big && R.chance(0.5), by }, { text: `${name} beats his man clean and drops ${nm(O.qb)} for a sack.` })
      else if (win) applyPass(G, T, { type: 'inc', r: target(G, T, o, null), depth: 1, pd: false }, { text: `${name} is in ${nm(O.qb)}'s face and the throw is rushed. Incomplete.` })
      else { const r = target(G, T, o, null); const y = cap(G, dist + gain(R, 0, 8)); applyPass(G, T, { type: 'comp', r, depth: 1, yds: y }, { text: `${nm(O.qb)} has time, steps up and finds ${nm(r)} for ${y} and the first down.` }) }
      break
    }
    case 'jump-route': case 'zone-drop': {
      const by = defMan(T, d, me), r = target(G, T, o, null)
      if (win && !simmed && score >= (game === 'jump-route' ? 0.72 : 0.86)) applyPass(G, T, { type: 'int', r, depth: 1, by }, { pick6: big && R.chance(0.35), text: undefined })
      else if (win) applyPass(G, T, { type: 'inc', r, depth: 1, pd: true, by }, { text: `${nm(O.qb)} throws for ${nm(r)} and ${name} gets a hand on it. Incomplete.` })
      else { const y = cap(G, dist + gain(R, 0, 9)); applyPass(G, T, { type: 'comp', r, depth: 1, yds: y }, { text: `${nm(O.qb)} finds ${nm(r)} ${game === 'zone-drop' ? 'in front of the linebackers' : 'on the double move'} for ${y} and the first down.` }) }
      break
    }
    case 'run-stuff': case 'hit-stick': {
      const by = defMan(T, d, me), rb = O.rbs[0]
      if (win) applyRun(G, T, { type: 'run', m: rb, qbRun: false, yds: game === 'run-stuff' ? -gain(R, 0, 2) : 0, fum: game === 'hit-stick' && big && !simmed && R.chance(0.5), by }, { text: game === 'hit-stick' ? `${name} meets ${nm(rb)} in the hole and drops him where he stands.` : `${name} sheds the block and stuffs ${nm(rb)} at the line.` })
      else applyRun(G, T, { type: 'run', m: rb, qbRun: false, yds: cap(G, Math.max(dist, 1) + gain(R, 0, 3)), fum: false })
      break
    }
    case 'tackle-angle': {
      const by = defMan(T, d, me), rb = O.rbs[0]
      if (win) applyRun(G, T, { type: 'run', m: rb, qbRun: false, yds: cap(G, gain(R, 6, 10)), fum: false, by }, { text: `${nm(rb)} is through the line, but ${name} takes the right angle and gets him down after a gain.` })
      else { const y = cap(G, gain(R, 28, 55)); applyRun(G, T, { type: 'run', m: rb, qbRun: false, yds: y, fum: false }, { text: `${nm(rb)} is through the line, ${name} takes a bad angle, and he is gone for ${y}${G.yl + y >= 100 ? '. Touchdown.' : '.'}` }) }
      break
    }
    case 'kick-return': {
      if (win && big && R.chance(0.45)) applyKickoff(G, T, { td: true })
      else if (win) { const yl = gain(R, 52, 72); applyKickoff(G, T, { yl, ret: yl }, { text: `${name} finds a seam and brings it all the way out to ${spotText(G, 1 - G.kick.team, yl)}.` }) }
      else applyKickoff(G, T, { yl: gain(R, 13, 20), ret: 15 }, { text: `${name} is swarmed inside the 20.` })
      break
    }
    case 'game-winner': applyFieldGoal(G, T, win); break
    case 'onside': applyOnside(G, T, win); break
    default: break
  }
  if (G.keep) for (let i = mark; i < G.log.length; i++) G.log[i].moment = simmed ? 'sim' : 'played'
  const text = G.keep && G.log.length > mark ? G.log[G.log.length - 1].text : (win ? p.win : p.loss)
  G.stops.push({ n: p.n, game, title: p.title, player: { id: p.player.id, name: p.player.name }, win, sim: simmed, score: Math.round(score * 100) / 100, text, q: p.situation.q, clockText: p.situation.clockText })
  G.pend = null
  after(G, R)
}
const nm = m => lastName(m?.p?.name ?? 'the back')

// The two-minute drill is a whole drive: won, it ends in the end zone (or in close field goal range when three
// is enough); lost, it dies on downs with the clock nearly gone.
function twoMinute(G, T, o, win, score, R) {
  const lead = G.sc[o] - G.sc[1 - o], needTd = lead < -3, c0 = G.clock
  const endAt = needTd ? R.int(14, 34) : R.int(4, 8)
  const goalYl = needTd ? 100 : R.int(84, 92)
  const O = T[o]
  if (win) {
    const plays = clamp(Math.round((goalYl - G.yl) / 13), 3, 8)
    for (let i = 0; i < plays && !G.kick && G.poss === o; i++) {
      const left = goalYl - G.yl, last = i === plays - 1
      const y = last ? left : clamp(Math.round(left / (plays - i) + R.int(-3, 4)), 4, Math.max(4, left - 1))
      const { r } = pickTarget(G, O, { yl: G.yl, long: true, rz: G.yl >= 80 })
      applyPass(G, T, { type: 'comp', r, depth: y >= 20 ? 2 : y >= 10 ? 1 : 0, yds: Math.min(100 - G.yl, y) })
      G.clock = Math.max(endAt, Math.round(c0 - (i + 1) * (c0 - endAt) / plays))
    }
    if (!needTd && G.poss === o && !G.kick) { G.to[o] = Math.max(0, G.to[o] - 1) }
  } else {
    const shorts = score >= 0.4 ? 2 : 1
    for (let i = 0; i < shorts && G.poss === o && !G.kick && G.yl < 88; i++) {
      const { r } = pickTarget(G, O, { yl: G.yl, long: false, rz: false })
      applyPass(G, T, { type: 'comp', r, depth: 0, yds: Math.min(100 - G.yl - 1, R.int(5, 11)) })
      G.clock = Math.max(12, c0 - (i + 1) * 22)
    }
    let guard = 0
    while (G.poss === o && !G.kick && guard++ < 6) {
      const { r } = pickTarget(G, O, { yl: G.yl, long: true, rz: false })
      applyPass(G, T, { type: 'inc', r, depth: 1, pd: R.chance(0.4) })
      G.clock = Math.max(6, Math.min(G.clock, c0 - 60 - guard * 6))
    }
  }
}
