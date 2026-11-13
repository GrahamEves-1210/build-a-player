// DEV ONLY. A stand-in game for building the Game Day screens before the engine's own game functions exist:
// a small seeded drive sim in the view model bridge.js hands the screens (the same shapes, so the screens never
// know which one they are showing). Loaded only on the dev server, only by dev.jsx. Not the real football model.
import { QBS } from '../../../data/qbs'
import { RBS } from '../../../data/rbs'
import { WRS } from '../../../data/wrs'
import { TES } from '../../../data/tes'
import { DLS } from '../../../data/dls'
import { LBS } from '../../../data/lbs'
import { DBS } from '../../../data/dbs'
import { KS } from '../../../data/ks'
import HEADSHOTS from '../../../data/headshots.json'
import { seeded } from '../../../lib/rng'
import { GAMES } from '../../../lib/minigames'
import { TEAMS } from '../../../data/nfl-teams'

const POOLS = { qb: QBS, rb: RBS, wr: WRS, te: TES, dl: DLS, lb: LBS, db: DBS, k: KS }
const man = (p, pos, built = false) => p && ({ img: (p.headshot ?? HEADSHOTS[p.name]) ? `/headshots/${p.headshot ?? HEADSHOTS[p.name]}.webp` : null, id: `${pos}:${p.name}`, name: p.name, last: p.name.split(' ').slice(1).join(' ') || p.name, pos: (p.pos ?? pos).toUpperCase(), num: p.number ?? null, team: p.team, head: p.headshot ?? HEADSHOTS[p.name] ?? null, built, attrs: p.attrs ?? {} })
const room = (team, pos) => POOLS[pos].filter(p => p.team === team && p.attrs).sort((a, b) => (b.starter ? 1 : 0) - (a.starter ? 1 : 0))
function teamMen(short, builtPos = []) {
  const o = {}
  for (const pos of Object.keys(POOLS)) o[pos] = room(short, pos).map(p => man(p, pos))
  for (const pos of builtPos) if (o[pos]?.[0]) o[pos][0] = { ...o[pos][0], id: `built:${pos}`, name: pos === 'qb' ? 'Marcus Vale' : 'Dre Holloway', last: pos === 'qb' ? 'Vale' : 'Holloway', head: null, img: null, built: true }
  return o
}
const UNIT = [['PASS', 'pass'], ['RUSH', 'rush']]

export function devFranchise({ user = 'KC', opp = 'BUF', home = true, superBowl = false, moments = true, seed = 'dev1', win = false } = {}) {
  return { __dev: true, win, seed, user, opp, home, superBowl, moments, week: superBowl ? 22 : 5 }
}

export function pregame(fr) {
  const r = seeded(`pre-${fr.seed}`)
  const rank = () => 1 + Math.floor(r() * 32)
  const val = (k, rk, def) => (k === 'pass' ? (def ? 190 + rk * 2.1 : 270 - rk * 2.6) : (def ? 88 + rk * 1.5 : 150 - rk * 1.9)).toFixed(1)
  const side = (off, def) => ({ when: off, rows: UNIT.map(([label, k]) => { const a = rank(), b = rank(); return { label, off: { team: off, rank: a, val: val(k, a, false) }, def: { team: def, rank: b, val: val(k, b, true) } } }) })
  const us = teamMen(fr.user), them = teamMen(fr.opp)
  return {
    year: 2026, week: fr.week, label: fr.superBowl ? 'SUPER BOWL LXI' : `WEEK ${fr.week}`, kind: fr.superBowl ? 'superbowl' : 'regular',
    title: fr.superBowl ? 'SUPER BOWL LXI' : null,
    venue: fr.superBowl ? 'SoFi Stadium, Inglewood' : fr.home ? 'GEHA Field at Arrowhead Stadium' : 'Highmark Stadium',
    weather: fr.superBowl ? null : { kind: 'snow', text: '28° · SNOW · WIND 14 MPH' },
    home: fr.home ? fr.user : fr.opp, away: fr.home ? fr.opp : fr.user, user: fr.user,
    records: { [fr.user]: fr.superBowl ? '13-4' : '3-1', [fr.opp]: fr.superBowl ? '14-3' : '4-0' },
    units: [side(fr.user, fr.opp), side(fr.opp, fr.user)],
    injuries: [
      { team: fr.user, name: us.wr[1]?.name, pos: 'WR', status: 'OUT', note: 'Hamstring · 2 weeks' },
      { team: fr.user, name: us.lb[1]?.name, pos: 'LB', status: 'QUESTIONABLE', note: 'Ankle' },
      { team: fr.opp, name: them.db[1]?.name, pos: 'CB', status: 'OUT', note: 'Knee · 4 weeks' },
    ].filter(x => x.name),
    plan: { off: 'ATTACK DEEP', def: 'STOP THE RUN' },
    momentsOn: fr.moments,
  }
}
export const setMoments = (fr, on) => ({ ...fr, moments: on })

const other = (g, t) => (t === g.home ? g.away : g.home)
const LABEL = { arm: 'ARM', accuracy: 'ACCURACY', processing: 'PROCESSING', vision: 'VISION', legs: 'LEGS', size: 'SIZE', leadership: 'LEADERSHIP', hands: 'HANDS', routeRunning: 'ROUTE RUNNING', getOff: 'GET OFF', finesseMoves: 'FINESSE MOVES', powerMoves: 'POWER MOVES', playRecognition: 'PLAY RECOGNITION', zoneIQ: 'ZONE IQ', range: 'RANGE', tackling: 'TACKLING', power: 'POWER', clutch: 'CLUTCH', blockShed: 'BLOCK SHED', strength: 'STRENGTH', elusiveness: 'ELUSIVENESS', speed: 'SPEED', burst: 'BURST', balance: 'BALANCE' }

function _start(fr, mode) {
  const p = pregame(fr)
  const g = {
    id: `${fr.seed}-g`, seed: `${fr.seed}-g`, n: 0, mode, home: p.home, away: p.away, user: fr.user, title: p.title, venue: p.venue, weather: p.weather,
    score: { [p.home]: 0, [p.away]: 0 }, q: 1, clock: 900, poss: null, down: 1, dist: 10, spot: 25, to: { [p.home]: 3, [p.away]: 3 },
    plays: [], pending: null, done: false, drive: 0, driveStart: null, kick: p.away, used: [], nMoments: 0, nCalls: 0,
    men: { [fr.user]: teamMen(fr.user, ['qb', 'wr']), [fr.opp]: teamMen(fr.opp) },
    box: {}, ot: false,
  }
  if (fr.superBowl) g.q = 4, g.clock = fr.win ? 20 : 420, g.score = fr.win ? { [fr.user]: 34, [fr.opp]: 20 } : { [p.home]: 20, [p.away]: 23 }
  return g
}
const rnd = g => seeded(`${g.seed}-${g.n++}`)()
const spotText = (g, spot, off) => (spot === 50 ? 'the 50' : spot < 50 ? `the ${off} ${spot}` : `the ${other(g, off)} ${100 - spot}`)
const stat = (g, m, k, v = 1) => { if (!m) return; const b = (g.box[m.id] ??= { man: m }); b[k] = (b[k] ?? 0) + v }
const add = (g, play) => {
  g.plays.push({ id: g.plays.length, q: g.q, clock: g.clock, team: g.poss, down: g.down, dist: g.dist, spot: g.spot, drive: g.drive, score: { ...g.score }, ...play })
}
function tick(g, secs) {
  g.clock -= secs
  if (g.clock <= 0) {
    if (g.q === 2) { g.q = 3; g.clock = 900; g.plays.push({ id: g.plays.length, q: 2, clock: 0, kind: 'break', text: 'HALFTIME', score: { ...g.score } }); g.kick = g.home; g.poss = null; return }
    if (g.q >= 4) {
      if (g.score[g.home] !== g.score[g.away]) { g.clock = 0; g.done = true; return }
      g.q = 5; g.clock = 600; g.ot = true; g.plays.push({ id: g.plays.length, q: 4, clock: 0, kind: 'break', text: 'END OF REGULATION', score: { ...g.score } }); g.kick = g.away; g.poss = null; return
    }
    g.q += 1; g.clock = 900
  }
}
function score(g, team, pts) { g.score[team] += pts; if (g.q === 5) g.done = true }
function newDrive(g, team, spot) { g.poss = team; g.spot = Math.max(1, Math.min(99, spot)); g.down = 1; g.dist = Math.min(10, 100 - g.spot); g.drive += 1 }
function turnover(g, spot) { newDrive(g, other(g, g.poss), 100 - spot) }
function gain(g, y) {
  g.spot += y
  if (g.spot >= 100) return 'td'
  if (y >= g.dist) { g.down = 1; g.dist = Math.min(10, 100 - g.spot); return 'first' }
  g.down += 1; g.dist -= y
  return null
}
function touchdown(g, text, who) {
  const t = g.poss
  score(g, t, 6)
  add(g, { kind: 'td', text, pts: 6, scorer: t, score: { ...g.score }, big: true })
  if (g.done) return
  const k = g.men[t].k[0]
  const good = rnd(g) < 0.95
  if (good) { score(g, t, 1); stat(g, k, 'xpm') }
  stat(g, k, 'xpa')
  add(g, { kind: 'xp', text: `${k?.last ?? 'The kicker'} extra point ${good ? 'is good' : 'is no good, wide left'}.`, pts: good ? 1 : 0, scorer: t, score: { ...g.score } })
  g.kick = t; g.poss = null
}
// the moment a situation calls for (the user's side only), one of each game at most
function momentFor(g) {
  if (g.mode !== 'moments' || g.nMoments >= 5) return null
  const mine = g.poss === g.user, behind = g.score[other(g, g.user)] - g.score[g.user]
  let game = null
  if (mine) {
    if (g.down === 3 && g.dist >= 7) game = 'third-long'
    else if (g.spot >= 90 && g.down >= 3) game = 'goal-line'
    else if (g.down === 4 && g.dist <= 1) game = 'sneak'
    else if (g.q === 4 && g.clock < 130 && behind > 3 && behind <= 8 && g.down === 1) game = 'two-minute'
    else if (g.down === 1 && g.spot > 35 && g.spot < 60 && rnd(g) < 0.25) game = 'bomb'
    else if (g.down === 2 && g.spot >= 80 && rnd(g) < 0.5) game = 'catch'
  } else if (g.down === 3 && g.dist >= 4) game = ['pass-rush', 'jump-route', 'zone-drop'].find(x => !g.used.includes(x)) ?? null
  else if (g.spot >= 95 && g.down <= 2) game = 'run-stuff'
  if (!game || g.used.includes(game)) return null
  const U = g.men[g.user]
  const who = { 'third-long': U.qb[0], bomb: U.qb[0], sneak: U.qb[0], 'two-minute': U.qb[0], 'goal-line': U.wr[0], catch: U.wr[0], 'pass-rush': U.dl[0], 'run-stuff': U.dl[1] ?? U.dl[0], 'jump-route': U.db[0], 'zone-drop': U.lb[0] }[game]
  if (!who) return null
  const traits = GAMES[game].traits.filter(t => who.attrs[t] != null).slice(0, 4)
  const v = traits.length ? traits.reduce((s, t) => s + who.attrs[t], 0) / traits.length : 6
  const opp = other(g, g.user), q = ['1st', '2nd', '3rd', '4th', 'overtime'][g.q - 1]
  const where = spotText(g, g.spot, g.poss), ord = ['1st', '2nd', '3rd', '4th'][g.down - 1]
  const scoreLine = behind > 0 ? `${g.user} trails ${g.score[opp]}-${g.score[g.user]}` : behind < 0 ? `${g.user} leads ${g.score[g.user]}-${g.score[opp]}` : `Tied at ${g.score[g.user]}`
  const stakes = { 'third-long': 'Move the chains and the drive stays alive. Miss and the punt team comes on.', bomb: 'A shot play. Hit it and the offense is in scoring range.', sneak: 'Inches to go. Get it and the drive goes on; get stuffed and it is their ball.', 'two-minute': 'The game is on this drive. It has to end in the end zone.', 'goal-line': 'Six points or nothing.', catch: 'A contested ball in the end zone.', 'pass-rush': 'Get home and they punt. Give him time and they move the chains.', 'jump-route': 'Read it right and the ball is his. Guess wrong and it is a first down.', 'zone-drop': 'Take away the middle and the drive ends here.', 'run-stuff': 'A stop here holds them to three.' }[game]
  g.nMoments += 1; g.used.push(game)
  return {
    type: 'moment', id: `m${g.nMoments}`, game, title: GAMES[game].title, n: g.nMoments,
    player: who, ratings: traits.map(t => ({ key: t, label: LABEL[t] ?? t.toUpperCase(), val: who.attrs[t] })), v, arm: who.attrs.arm ?? null, kick: null,
    side: mine ? 'off' : 'def',
    setup: `${ord} and ${g.dist >= 100 - g.spot ? 'goal' : g.dist} at ${where}. ${Math.floor(g.clock / 60)}:${String(g.clock % 60).padStart(2, '0')} left in ${g.q === 5 ? 'overtime' : `the ${q}`}. ${scoreLine}.`,
    stakes, odds: Math.max(0.2, Math.min(0.85, 0.3 + v * 0.045)),
    mg: { game, v, arm: who.attrs.arm ?? v, kick: null, seed: `${g.seed}-${g.nMoments}`, sport: 'nfl', pos: { QB: 'qb', WR: 'wr', DT: 'dl', DE: 'dl', EDGE: 'dl', LB: 'lb', CB: 'db', S: 'db' }[who.pos] ?? 'qb', team: TEAMS.find(t => t.short === g.user), opp: TEAMS.find(t => t.short === opp), home: g.user === g.home ? 'team' : 'opp', superBowl: g.title ? 'LXI' : null,
      situation: { us: g.user, them: opp, mine: g.score[g.user], opp: g.score[opp], clock: g.clock, clockText: `${Math.floor(g.clock / 60)}:${String(g.clock % 60).padStart(2, '0')}`, period: ['1ST', '2ND', '3RD', '4TH', 'OT'][g.q - 1], line: '', tail: '' }, weather: g.weather?.kind ?? null, cast: null },
  }
}
function _resolveMoment(fr, g0, res) {
  const g = { ...g0, plays: [...g0.plays], score: { ...g0.score } }
  const m = g.pending; g.pending = null
  const hit = res ? !!res.hit : rnd(g) < m.odds
  const who = m.player.last, O = g.men[other(g, g.user)], U = g.men[g.user]
  const mark = { moment: m.id, hit, played: !!res }
  if (m.side === 'off') {
    if (m.game === 'goal-line' || m.game === 'catch') {
      if (hit) { stat(g, U.qb[0], 'ptd'); stat(g, m.player, 'rtd'); touchdown(g, `${U.qb[0].last} fires to the back corner, ${who} goes up over ${O.db[0].last} and comes down with it. TOUCHDOWN ${g.user}.`); g.plays[g.plays.length - 2].mark = mark }
      else { add(g, { kind: 'inc', text: `${U.qb[0].last} looks for ${who} in the end zone, broken up by ${O.db[0].last}. Incomplete.`, mark, big: true }); if (g.down === 4) turnover(g, g.spot); else { g.down += 1 } }
    } else if (m.game === 'sneak') {
      if (hit) { add(g, { kind: 'run', text: `${who} takes the snap and pushes behind the center for 2. First down ${g.user}.`, mark, big: true, yards: 2 }); gain(g, 2) }
      else { add(g, { kind: 'run', text: `${who} is met at the line by ${O.dl[0].last} and ${O.lb[0].last}. No gain. Turnover on downs.`, mark, big: true, yards: 0 }); turnover(g, g.spot) }
    } else if (m.game === 'two-minute') {
      if (hit) { g.spot = 100; g.clock = Math.max(11, g.clock - 96); stat(g, U.qb[0], 'ptd'); stat(g, U.wr[0], 'rtd'); touchdown(g, `${who} takes them the length of the field in the two-minute drill and finds ${U.wr[0].last} from 8 yards out. TOUCHDOWN ${g.user}.`); g.plays[g.plays.length - 2].mark = mark }
      else { g.clock = Math.max(4, g.clock - 100); add(g, { kind: 'inc', text: `${who} runs out of downs at midfield. The drive stalls and ${other(g, g.user)} takes over.`, mark, big: true }); turnover(g, 55) }
    } else {
      const y = m.game === 'bomb' ? 38 : g.dist + 4
      if (hit) { stat(g, m.player, 'pyd', y); stat(g, m.player, 'cmp'); stat(g, m.player, 'att'); stat(g, U.wr[1] ?? U.wr[0], 'ryd', y); stat(g, U.wr[1] ?? U.wr[0], 'rec')
        add(g, { kind: 'pass', text: m.game === 'bomb' ? `${who} steps up and lets it go deep down the right sideline, ${(U.wr[1] ?? U.wr[0]).last} runs under it for ${y}.` : `${who} stands in against the rush and hits ${(U.wr[1] ?? U.wr[0]).last} on the dig for ${y}. First down ${g.user}.`, mark, big: true, yards: y })
        if (gain(g, y) === 'td') touchdown(g, `${(U.wr[1] ?? U.wr[0]).last} walks in. TOUCHDOWN ${g.user}.`)
      } else { stat(g, m.player, 'att'); add(g, { kind: 'inc', text: m.game === 'bomb' ? `${who} goes deep for ${(U.wr[1] ?? U.wr[0]).last}, overthrown. ${O.db[0].last} had him covered. Incomplete.` : `${who} throws behind ${(U.wr[1] ?? U.wr[0]).last} over the middle. Incomplete.`, mark, big: true }); g.down += 1 }
    }
  } else {
    const q = O.qb[0]?.last ?? 'the quarterback'
    if (hit) {
      if (m.game === 'pass-rush') { stat(g, m.player, 'sack'); stat(g, m.player, 'tkl'); add(g, { kind: 'sack', text: `${who} wins inside and drops ${q} for a loss of 8. SACK.`, mark, big: true, yards: -8 }); g.spot -= 8; g.dist += 8; g.down += 1 }
      else if (m.game === 'jump-route') { stat(g, m.player, 'int'); add(g, { kind: 'int', text: `${q} throws the out, ${who} jumps it. INTERCEPTED at ${spotText(g, g.spot + 6, g.poss)}.`, mark, big: true }); turnover(g, g.spot + 6) }
      else if (m.game === 'run-stuff') { stat(g, m.player, 'tkl'); add(g, { kind: 'run', text: `${O.rb[0]?.last ?? 'The back'} tries the middle, ${who} sheds the block and stops him for no gain.`, mark, big: true, yards: 0 }); g.down += 1 }
      else { stat(g, m.player, 'tkl'); add(g, { kind: 'inc', text: `${q} looks for the crosser, ${who} sinks under it and knocks it away. Incomplete.`, mark, big: true }); g.down += 1 }
    } else {
      const y = g.dist + 3
      add(g, { kind: 'pass', text: `${q} has time and finds ${O.wr[0]?.last ?? 'his receiver'} past the sticks for ${y}. First down ${g.poss}.`, mark, big: true, yards: y })
      if (gain(g, y) === 'td') touchdown(g, `TOUCHDOWN ${g.poss}.`)
    }
  }
  tick(g, 20)
  return g
}
function _resolveCall(fr, g0, id) {
  const g = { ...g0, plays: [...g0.plays], score: { ...g0.score } }
  const c = g.pending; g.pending = null
  const o = c.options.find(x => x.id === id), mark = { call: id }
  const U = g.men[g.poss], k = U.k[0]
  if (id === 'go') {
    if (rnd(g) < o.odds) { add(g, { kind: 'run', text: `${g.poss} goes for it. ${U.rb[0].last} off left tackle for ${g.dist + 1}. First down.`, mark, big: true, yards: g.dist + 1 }); gain(g, g.dist + 1) }
    else { add(g, { kind: 'run', text: `${g.poss} goes for it. ${U.rb[0].last} is stopped short. Turnover on downs.`, mark, big: true, yards: 0 }); turnover(g, g.spot) }
  } else if (id === 'fg') {
    const d = 100 - g.spot + 17, good = rnd(g) < o.odds
    stat(g, k, 'fga'); if (good) { stat(g, k, 'fgm'); score(g, g.poss, 3) }
    add(g, { kind: 'fg', text: `${k.last} ${d}-yard field goal ${good ? 'is GOOD' : 'is no good, wide right'}.`, pts: good ? 3 : 0, scorer: g.poss, score: { ...g.score }, mark, big: true })
    if (good) { g.kick = g.poss; g.poss = null } else turnover(g, g.spot - 7)
  } else { const y = Math.min(42, 99 - g.spot); add(g, { kind: 'punt', text: `${g.poss} punts ${y} yards. Fair catch at ${spotText(g, g.spot + y, g.poss)}.`, mark }); turnover(g, g.spot + y) }
  tick(g, 12)
  return g
}
function _step(fr, g0) {
  if (g0.done || g0.pending) return g0
  const g = { ...g0, plays: [...g0.plays], score: { ...g0.score }, used: [...g0.used] }
  if (!g.poss) {
    const rec = other(g, g.kick), to = 22 + Math.floor(rnd(g) * 12)
    g.poss = g.kick; g.spot = 35; g.down = 0; g.dist = 0
    add(g, { kind: 'kickoff', text: `${g.men[g.kick].k[0]?.last ?? g.kick} kicks off. ${g.men[rec].wr[2]?.last ?? g.men[rec].rb[0].last} returns it to ${spotText(g, to, rec)}.` })
    newDrive(g, rec, to); tick(g, 6)
    return g
  }
  const O = g.men[g.poss], D = g.men[other(g, g.poss)], qb = O.qb[0], rb = O.rb[0]
  if (g.down === 4) {
    const d = 100 - g.spot + 17, k = O.k[0]
    if (g.poss === g.user && g.mode === 'moments' && g.nCalls < 2 && g.spot > 50 && g.spot < 75) {
      g.nCalls += 1
      g.pending = { type: 'call', id: `c${g.nCalls}`, kind: 'fourth-down', setup: `4th and ${g.dist} at ${spotText(g, g.spot, g.poss)}. ${Math.floor(g.clock / 60)}:${String(g.clock % 60).padStart(2, '0')} left in the ${['1st', '2nd', '3rd', '4th'][g.q - 1] ?? 'OT'}.`,
        options: [{ id: 'go', label: 'GO FOR IT', odds: Math.max(0.2, 0.62 - g.dist * 0.05), note: `4th and ${g.dist}` }, { id: 'fg', label: 'FIELD GOAL', odds: Math.max(0.1, 0.98 - (d - 30) * 0.02), note: `${d} yards` }, { id: 'punt', label: 'PUNT', odds: null, note: 'Pin them deep' }] }
      return g
    }
    if (g.spot >= 62) {
      const good = rnd(g) < 0.98 - Math.max(0, d - 30) * 0.02
      stat(g, k, 'fga'); if (good) { stat(g, k, 'fgm'); score(g, g.poss, 3) }
      add(g, { kind: 'fg', text: `${k?.last ?? 'The kicker'} ${d}-yard field goal ${good ? 'is GOOD' : 'is no good, wide left'}.`, pts: good ? 3 : 0, scorer: g.poss, score: { ...g.score }, big: good })
      if (good) { g.kick = g.poss; g.poss = null } else turnover(g, g.spot - 7)
    } else { const y = Math.min(38 + Math.floor(rnd(g) * 14), 95 - g.spot); add(g, { kind: 'punt', text: `${g.poss} punts ${y} yards. ${D.wr[2]?.last ?? 'The returner'} calls for the fair catch at ${spotText(g, g.spot + y, g.poss)}.` }); turnover(g, g.spot + y) }
    tick(g, 10)
    return g
  }
  const mo = momentFor(g)
  if (mo) { g.pending = mo; return g }
  const r = rnd(g), wr = O.wr[Math.floor(rnd(g) * Math.min(3, O.wr.length))] ?? O.te[0]
  if (r < 0.42) {
    const y = Math.max(-2, Math.round(rnd(g) * rnd(g) * 16 - 1)), tk = D.lb[Math.floor(rnd(g) * Math.min(2, D.lb.length))] ?? D.dl[0]
    stat(g, rb, 'car'); stat(g, rb, 'ruyd', Math.min(y, 100 - g.spot)); stat(g, tk, 'tkl')
    add(g, { kind: 'run', text: `${rb.last} ${['up the middle', 'off right tackle', 'around the left end', 'off left guard'][Math.floor(rnd(g) * 4)]} for ${y <= 0 ? (y === 0 ? 'no gain' : `a loss of ${-y}`) : y}${y > 0 && y >= g.dist && g.spot + y < 100 ? '. First down' : ''}. Tackle by ${tk.last}.`, yards: y })
    if (gain(g, y) === 'td') { stat(g, rb, 'rutd'); touchdown(g, `${rb.last} finds the end zone. TOUCHDOWN ${g.poss}.`) }
    tick(g, 34)
  } else if (r < 0.48) {
    const s = D.dl[Math.floor(rnd(g) * Math.min(3, D.dl.length))]
    stat(g, s, 'sack'); stat(g, s, 'tkl')
    add(g, { kind: 'sack', text: `${qb.last} is sacked by ${s.last} for a loss of 7.`, yards: -7 }); g.spot = Math.max(1, g.spot - 7); g.dist += 7; g.down += 1; tick(g, 30)
  } else if (r < 0.505) {
    const d = D.db[Math.floor(rnd(g) * Math.min(3, D.db.length))]
    stat(g, qb, 'att'); stat(g, qb, 'pint'); stat(g, d, 'int')
    add(g, { kind: 'int', text: `${qb.last} throws over the middle, INTERCEPTED by ${d.last} at ${spotText(g, Math.min(98, g.spot + 12), g.poss)}.`, big: true }); turnover(g, Math.min(98, g.spot + 12)); tick(g, 9)
  } else if (r < 0.71) {
    stat(g, qb, 'att')
    add(g, { kind: 'inc', text: `${qb.last} incomplete, intended for ${wr.last}.` }); g.down += 1; tick(g, 6)
  } else {
    const y = Math.max(1, Math.round(4 + rnd(g) * rnd(g) * 34))
    const got = Math.min(y, 100 - g.spot)
    stat(g, qb, 'att'); stat(g, qb, 'cmp'); stat(g, qb, 'pyd', got); stat(g, wr, 'rec'); stat(g, wr, 'ryd', got)
    add(g, { kind: 'pass', text: `${qb.last} ${y > 18 ? 'deep' : 'short'} ${['left', 'right', 'middle'][Math.floor(rnd(g) * 3)]} to ${wr.last} for ${got}${y >= g.dist && g.spot + y < 100 ? '. First down' : ''}.`, yards: got, big: y >= 25 })
    if (gain(g, y) === 'td') { stat(g, qb, 'ptd'); stat(g, wr, 'rtd'); touchdown(g, `${wr.last} takes it in. TOUCHDOWN ${g.poss}.`) }
    tick(g, 28)
  }
  return g
}
function _skip(fr, g0) {
  let g = g0, n = 0
  while (!g.done && n++ < 600) { g = g.pending ? (g.pending.type === 'call' ? _resolveCall(fr, g, g.pending.options[0].id) : _resolveMoment(fr, g, null)) : _step(fr, g) }
  return g
}
function _finish(fr, g) {
  const rows = t => Object.values(g.box).filter(b => b.man.team === t || (b.man.built && t === g.user))
  const table = (t, keys, sortKey) => rows(t).filter(b => keys.some(k => b[k])).sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0))
  const fmt = t => ({
    passing: table(t, ['att'], 'pyd').map(b => ({ man: b.man, cells: [`${b.cmp ?? 0}/${b.att ?? 0}`, b.pyd ?? 0, b.ptd ?? 0, b.pint ?? 0] })),
    rushing: table(t, ['car'], 'ruyd').map(b => ({ man: b.man, cells: [b.car, b.ruyd ?? 0, b.rutd ?? 0] })),
    receiving: table(t, ['rec'], 'ryd').slice(0, 5).map(b => ({ man: b.man, cells: [b.rec, b.ryd ?? 0, b.rtd ?? 0] })),
    defense: table(t, ['tkl', 'sack', 'int'], 'tkl').slice(0, 6).map(b => ({ man: b.man, cells: [b.tkl ?? 0, b.sack ?? 0, b.int ?? 0, 0] })),
    kicking: table(t, ['fga', 'xpa'], 'fgm').map(b => ({ man: b.man, cells: [`${b.fgm ?? 0}/${b.fga ?? 0}`, b.fgm ? 47 : '-', `${b.xpm ?? 0}/${b.xpa ?? 0}`] })),
  })
  const opp = other(g, g.user), won = g.score[g.user] > g.score[opp]
  const star = (won ? rows(g.user) : rows(opp)).sort((a, b) => (b.pyd ?? 0) / 25 + (b.ruyd ?? 0) / 10 + (b.ryd ?? 0) / 10 - ((a.pyd ?? 0) / 25 + (a.ruyd ?? 0) / 10 + (a.ryd ?? 0) / 10))[0]
  const U = g.men[g.user]
  const shorts = ['PHI', 'DAL', 'SF', 'SEA', 'DET', 'GB', 'BAL', 'PIT', 'CIN', 'CLE', 'MIA', 'NYJ', 'NE', 'HOU', 'IND', 'JAX', 'TEN', 'DEN', 'LV', 'LAC', 'LAR', 'ARI', 'MIN', 'CHI', 'TB', 'NO', 'ATL', 'CAR', 'NYG', 'WAS']
  const r = seeded(`${g.seed}-league`), pts = () => [3, 6, 10, 13, 16, 17, 20, 23, 24, 27, 30, 31, 34][Math.floor(r() * 13)]
  const league = []
  for (let i = 0; i + 1 < shorts.length; i += 2) { let a = pts(), b = pts(); if (a === b) a += 3; league.push({ away: shorts[i], home: shorts[i + 1], a, h: b, ot: r() < 0.08 }) }
  const result = {
    home: g.home, away: g.away, user: g.user, score: g.score, ot: g.ot, won, title: g.title,
    box: { [g.home]: fmt(g.home), [g.away]: fmt(g.away) },
    totals: [['TOTAL YARDS', 348, 312], ['FIRST DOWNS', 21, 19], ['THIRD DOWNS', '6/13', '5/12'], ['TURNOVERS', 1, 2], ['POSSESSION', '31:12', '28:48']].map(([label, a, b]) => ({ label, [g.user]: a, [opp]: b })),
    potg: star ? { man: star.man, line: star.pyd ? `${star.cmp}/${star.att}, ${star.pyd} YDS, ${star.ptd ?? 0} TD` : star.ruyd ? `${star.car} CAR, ${star.ruyd} YDS` : `${star.rec ?? 0} REC, ${star.ryd ?? 0} YDS` } : null,
    xp: [{ man: U.qb[0], xp: 420 }, { man: U.wr[0], xp: 310 }, { man: U.rb[0], xp: 180 }, { man: U.dl[0], xp: 150 }], xpTeam: 2140,
    injuries: [{ man: U.lb[0], what: 'High ankle sprain', weeks: 3 }],
    league, superBowl: !!g.title,
  }
  return { franchise: { ...fr, week: fr.week + 1 }, result }
}

// ── the driver, in bridge.js's own shape: the game rides in the franchise (F.game), as the engine's does ──
export const live = F => !!F.game
export const start = (F, mode) => ({ ...F, game: _start(F, mode) })
export const view = F => F.game ?? null
export const step = F => ({ ...F, game: _step(F, F.game) })
export const skip = F => ({ ...F, game: _skip(F, F.game) })
export const resolveMoment = (F, res) => ({ ...F, game: _resolveMoment(F, F.game, res) })
export const resolveCall = (F, id) => ({ ...F, game: _resolveCall(F, F.game, id) })
export const finish = F => { const out = _finish(F, F.game); return { F: { ...out.franchise, game: null }, result: { ...out.result, quarters: { [F.game.home]: [7, 3, 0, 6], [F.game.away]: [0, 10, 7, 3] }, headlines: ['Chiefs fall to 3-2 as Bills stay unbeaten', 'Allen throws for 301 in Kansas City'], xp: out.result.xp.map(x => ({ ...x, pts: 0 })) } } }
export const flash = () => null

