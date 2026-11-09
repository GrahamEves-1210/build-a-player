// The game as it stands when a playoff moment starts: the score, the clock, who has to do what.
// A pure function of the round's seed and the game, so a reload gets the same one and an old save
// needs nothing new. The final score then has to grow out of it (finalScore): the win odds are
// career.js's, this only decides what the board says.
import { seeded } from './rng.js'

// (scores a football game really reaches, and adding a field goal or a touchdown stays real)
const FOOTBALL = [13, 14, 16, 17, 20, 21, 23, 24, 27, 28, 30, 31, 34, 35]
// margin: how far behind (negative: ahead, 0: tied). clock: seconds, a list or a [lo, hi] span.
const DRIVE = { margin: [4, 5, 6, 6, 7, 7], list: [92, 86, 80] }           // only a touchdown does it: down three or less he'd kick
const PASS = { margin: [7, 6, 4, 3, 3, 1, 0], span: [40, 170] }
const RUN = { margin: [3, 2, 1, 0, -1, -3], span: [90, 280] }              // running late is what a team that's close does
const STOP = { margin: [-1, -3, -3, -4, -6, 0], span: [35, 150], stop: true }
const HOOP = { margin: [2, 1, 0, -1], span: [8, 40], hoops: true }
const SOCCER = { margin: [0, 0, 0, -1], minute: [82, 95], soccer: true }
const SPOTS = {
  'two-minute': { ...DRIVE, tail: 'Needs a touchdown.' },
  'goal-line': { margin: DRIVE.margin, span: [4, 38], tail: 'Fourth and goal at the five.' },   // (at the five, down three or tied, he'd kick)
  sneak: { ...RUN, tail: 'Fourth and inches.' },
  gap: RUN, juke: RUN, seal: RUN,
  'third-long': { ...PASS, tail: 'Third and long.' },
  bomb: { ...PASS, tail: 'Time for a deep shot.' },
  'jump-route': STOP, 'zone-drop': STOP, 'tackle-angle': STOP, 'pass-rush': STOP, 'run-stuff': STOP,
  'clutch-shot': { margin: [1, 1, 2], fixed: 2.8, hoops: true, tail: 'One shot left.' },         // (2.8: the shot's own clock in lib/mg/meter.js)
  'free-throws': { margin: [1, 1, 0], tenths: [0.8, 5.5], hoops: true, tail: 'Two shots at the line.' },
  iso: HOOP, pnr: HOOP, 'post-up': HOOP, board: { ...HOOP, tail: 'The shot goes up.' },
  'rim-protect': { margin: [-1, -2, -2], span: [6, 30], hoops: true, stop: true },
  lockdown: { margin: [-1, -2, -2], span: [6, 24], hoops: true, stop: true },
  'fast-break': { ...HOOP, tail: 'A steal, and they\u2019re running.' }, 'alley-oop': HOOP,
  'half-court': { ...HOOP, tail: 'One possession. Get a bucket.' },
  // soccer: every striker moment is a late chance, level or a goal up, so a goal wins it (or puts it away).
  // (minute: 82nd to five minutes into stoppage time. career.js's LAST_PLAY has them as 'hit')
  penalty: { ...SOCCER, tail: 'Penalty.' },
  'one-on-one': { ...SOCCER, tail: 'Through on goal.' },
  header: { ...SOCCER, tail: 'A cross coming in.' },
  volley: { ...SOCCER, tail: 'It drops in the box.' },
  'free-kick': { ...SOCCER, tail: 'Free kick on the edge of the area.' },
  'two-on-one': { ...SOCCER, tail: 'Two on one on the break.' },
  // baseball: late and close, in the broadcast's words: the inning, the outs, who's on, the score (and the count when
  // it starts deep in one). margin: runs behind (negative: ahead). def: he's on the mound, they're batting.
  // (career.js's LAST_PLAY has the walk-off as 'hit')
  'at-bat': { baseball: true, inning: [7, 8, 8, 9, 9], margin: [1, 1, 0, 0, -1, 2], outs: [0, 1, 1, 2, 2], on: [[0, 1, 0], [1, 0, 0], [0, 0, 1], [1, 1, 0], [0, 1, 1], [0, 0, 0], [1, 0, 1]], tail: 'A big at-bat.' },
  'walk-off': { baseball: true, inning: [9, 9, 9, 10], half: 'B', margin: [0, 0, 0, 1], outs: [1, 1, 1, 2], on: [[0, 0, 1], [0, 1, 1], [0, 0, 1], [1, 0, 1]], count: [[1, 2], [2, 2], [1, 2], [2, 2]], tail: 'Two strikes. The winning run is on.' },
  'steal-second': { baseball: true, inning: [7, 8, 9], margin: [1, 1, 0], outs: [0, 1, 1, 2], on: [[1, 0, 0]], tail: 'He’s on first. Get into scoring position.' },
  'strike-out': { baseball: true, def: true, inning: [8, 9, 9], margin: [-1, -1, 0, -2], outs: [1, 1, 0], on: [[0, 0, 1], [0, 1, 1], [1, 0, 1]], tail: 'A runner on third: he needs a strikeout.' },
  'escape-jam': { baseball: true, def: true, inning: [7, 8, 9], margin: [-1, -1, -2, 0], outs: [1], on: [[1, 1, 1]], tail: 'Bases loaded, one out. A strikeout or a ground ball.' },
}
// A sport that loads on its own brings its own scoreboard (baseball's: lib/baseballSeason.js): its moments' spots, the
// situation (the inning, the outs, the runners) and the final that grows out of it
const KINDS = {}
export function registerSituations(kind, { spots = {}, situation, final }) { KINDS[kind] = { situation, final }; for (const [g, sp] of Object.entries(spots)) SPOTS[g] = { ...sp, kind } }
// these end in the end zone, whatever else he's short of
const TD_GAMES = new Set(['two-minute', 'goal-line'])
const clockOf = (s, hoops) => (hoops && s < 10 ? s.toFixed(1) : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`)

export function momentSituation(game, seed = 'x', { us = 'HOME', them = 'AWAY' } = {}) {
  const r = seeded(`sit-${seed}-${game}`)
  const spot = SPOTS[game] ?? PASS
  const pick = a => a[Math.floor(r() * a.length)]
  if (spot.soccer) return soccerSituation(spot, r, pick, us, them)
  if (spot.baseball) return baseballSituation(spot, r, pick, us, them)
  if (spot.kind && KINDS[spot.kind]) return { ...KINDS[spot.kind].situation(spot, r, pick, us, them, game), kind: spot.kind }
  const m = pick(spot.margin), hoops = !!spot.hoops, gap = Math.abs(m)
  const low = hoops ? 92 + Math.floor(r() * 21) : pick(FOOTBALL.filter(x => FOOTBALL.includes(x + gap)))
  const mine = m >= 0 ? low : low + gap, opp = m >= 0 ? low + gap : low
  const clock = spot.fixed ?? (spot.list ? pick(spot.list)
    : spot.tenths ? Math.round((spot.tenths[0] + r() * (spot.tenths[1] - spot.tenths[0])) * 10) / 10
    : spot.span[0] + Math.floor(r() * (spot.span[1] - spot.span[0] + 1)))
  const clockText = clockOf(clock, hoops)
  const where = m > 0 ? `${us} down ${mine}-${opp} to ${them}` : m < 0 ? `${us} up ${mine}-${opp} on ${them}` : `${us} and ${them} tied at ${mine}`
  const tail = spot.stop ? `${them} has the ball. ${us} needs a stop.` : spot.tail ?? ''
  return { us, them, mine, opp, hoops, clock, clockText, period: '4TH', line: `${where}, ${clockText} left in the 4th.`, tail }
}

// Soccer: the score (goals: a level game is 0-0 to 2-2, one up is 1-0 to 3-2) and the minute, in the broadcast's words:
// "ARS and CHE level at 1-1, 88th minute." Past 90 it's stoppage time ("three minutes into stoppage time", 90+3 on the board).
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
function soccerSituation(spot, r, pick, us, them) {
  const m = pick(spot.margin), gap = Math.abs(m)
  const low = pick([0, 1, 1, 1, 2, 2])
  const mine = m >= 0 ? low : low + gap, opp = m >= 0 ? low + gap : low
  const minute = spot.minute[0] + Math.floor(r() * (spot.minute[1] - spot.minute[0] + 1))
  const extra = minute - 90
  const clockText = extra > 0 ? `90+${extra}'` : `${minute}'`
  const when = extra > 0 ? `${extra === 1 ? 'a minute' : `${WORDS[extra]} minutes`} into stoppage time` : `${ordinal(minute)} minute`
  const where = m === 0 ? `${us} and ${them} level at ${mine}-${opp}` : m < 0 ? `${us} lead ${them} ${mine}-${opp}` : `${us} trail ${them} ${mine}-${opp}`
  return { us, them, mine, opp, hoops: false, soccer: true, clock: minute, minute, clockText, period: '2ND', line: `${where}, ${when}.`, tail: spot.tail ?? '' }
}
// A soccer final, from the minute it was played at. His goal is one; level after it all, a knockout's settled on
// penalties. won and hit can disagree (he scores and they still go out, he misses and a teammate wins it late)
function soccerFinal(sit, won, hit, r, pts) {
  const { them } = sit, need = sit.opp - sit.mine
  let mine = sit.mine, opp = sit.opp, note = null
  const goal = pts != null ? pts : 1
  if (won) {
    if (hit) mine += goal
    else if (need >= 0) { if (r() < 0.5) { mine += need + 1; note = 'A teammate won it in stoppage time.' } else { mine += need; note = 'Won it on penalties.' } }
    else note = `${them} couldn't find an equalizer.`
    if (mine < opp) { mine = opp; note = 'Won it on penalties.' }
    else if (mine === opp && !note) note = 'Won it on penalties.'
  } else if (hit) {
    mine += goal
    if (mine > opp) { opp = mine; note = `${them} equalized and won it on penalties.` }
    else if (mine === opp) note = 'Lost on penalties.'
  } else if (need >= 0) { if (r() < 0.55) opp += 1; else note = 'Lost on penalties.' }
  else { opp += 1; if (r() < 0.5) opp += 1; else note = 'Lost on penalties.' }
  return { mine, opp, note }
}
// Baseball: the score (a late game: 1-1 to 6-5), the inning and the half, the outs, the men on and the count, in a
// broadcaster's line: "Bottom of the 9th, two out, a runner on second. NYY down 4-3 to BOS."
const OUTS_W = ['nobody out', 'one out', 'two out']
const ON_W = { '000': 'bases empty', '100': 'a runner on first', '010': 'a runner on second', '001': 'a runner on third', '110': 'runners on first and second', '101': 'runners on the corners', '011': 'runners on second and third', '111': 'bases loaded' }
function baseballSituation(spot, r, pick, us, them) {
  const m = pick(spot.margin), gap = Math.abs(m)
  const low = pick([1, 2, 2, 3, 3, 4, 5])
  const mine = m >= 0 ? low : low + gap, opp = m >= 0 ? low + gap : low
  const inning = pick(spot.inning), outs = pick(spot.outs), on = pick(spot.on).map(Boolean)
  // (on the mound, they're batting: the top if he's the home side, the bottom if he's on the road. A pick either way)
  const half = spot.half ?? (r() < 0.5 ? 'T' : 'B')
  const [balls, strikes] = spot.count ? pick(spot.count) : [0, 0]
  const clockText = `${half === 'B' ? 'BOT' : 'TOP'} ${inning}`
  const where = m > 0 ? `${us} down ${mine}-${opp} to ${them}` : m < 0 ? `${us} up ${mine}-${opp} on ${them}` : `${us} and ${them} tied at ${mine}`
  const count = spot.count ? `, ${balls}-${strikes} count` : ''
  const line = `${half === 'B' ? 'Bottom' : 'Top'} of the ${ordinal(inning)}, ${OUTS_W[outs]}, ${ON_W[on.map(Number).join('')]}${count}. ${where}.`
  return { us, them, mine, opp, hoops: false, baseball: true, def: !!spot.def, inning, half, outs, on, balls, strikes, clock: inning, clockText, period: ordinal(inning).toUpperCase(), line, tail: spot.tail ?? '' }
}
// A baseball final, from the inning it was played in. pts: the runs the moment itself put on the board (his RBIs at
// the plate; on the mound, the runs he let in). Nobody ties: a game level after it all is settled in extras
function baseballFinal(sit, won, hit, r, pts) {
  const { them } = sit
  let mine = sit.mine, opp = sit.opp, note = null
  if (sit.def) {
    opp += pts != null ? pts : hit ? 0 : 1
    if (won && mine <= opp) { mine = opp + 1; note = hit ? 'The offense added on late.' : 'Came back to win it late.' }
    else if (!won && mine >= opp) { opp = mine + 1; note = hit ? `${them} got to the bullpen later.` : `${them} took the lead and held it.` }
  } else {
    const runs = pts != null ? pts : hit ? 1 : 0
    mine += runs
    // (a walk-off ends it when the winning run touches the plate: only a home run counts every run)
    if (won && hit && sit.half === 'B' && sit.inning >= 9 && mine > opp + 1 && runs < 4 && r() < 0.6) mine = opp + 1
    if (won && mine <= opp) { mine = opp + 1; note = hit ? 'Scored again before it was over.' : 'A teammate came through late.' }
    else if (!won && mine >= opp) { opp = mine + 1; note = mine === sit.mine ? `${them} held on.` : `${them} answered.` }
  }
  if (mine === opp) { if (won) mine += 1; else opp += 1; note = note ?? (won ? 'Won it in extra innings.' : 'Lost it in extra innings.') }
  return { mine, opp, note }
}
// what it takes to go from n behind to in front
const over = (n, hoops) => (hoops ? (n <= 1 ? 2 : n + 1) : n < 3 ? 3 : n <= 6 ? 7 : n === 7 ? 8 : n + 3)

// The final, from that score. won and hit are already decided; they can disagree (he lands it and
// they still lose, he misses and they still win), so note says how: { mine, opp, note }.
export function finalScore(sit, game, won, hit, seed = 'x', pts = null) {
  const r = seeded(`sitf-${seed}-${game}`)
  if (sit.soccer) return soccerFinal(sit, won, hit, r, pts)
  if (sit.baseball) return baseballFinal(sit, won, hit, r, pts)
  if (sit.kind && KINDS[sit.kind]) return KINDS[sit.kind].final(sit, game, won, hit, r, pts)
  const { hoops, them } = sit
  const need = sit.opp - sit.mine
  let mine = sit.mine, opp = sit.opp, note = null
  // what landing it put on the board
  // (what the moment itself put on the board when it says so: the clutch shot's 2 or 3, a fast break's makes. A touchdown
  // is a touchdown, the same as the drive's own scoreboard: 7, or enough to go ahead with the two-point try)
  const play = pts != null ? pts : game === 'clutch-shot' ? 3 : game === 'free-throws' ? 2 : TD_GAMES.has(game) ? Math.max(7, need + 1) : need < 0 ? 0 : over(need, hoops)
  if (won) {
    if (hit) { mine += play; if (mine <= opp) mine = opp + (hoops ? 2 : 3) }   // (short of it on the play: they closed it out after)
    else if (need < 0) { if (hoops ? -need >= 2 : -need > 3) opp += hoops ? 1 : 3; note = `${them} couldn't finish it.` }
    else { mine += over(need, hoops); note = hoops ? 'Got one more chance and made it count.' : 'Got the ball back and won it late.' }
  } else if (hit) {
    mine += play
    if (mine >= opp) opp += over(mine - opp, hoops)
    note = `${them} answered and took it back.`
  } else if (need <= 0) opp += over(-need, hoops)
  else if (hoops ? r() < 0.5 : need <= 5 && r() < 0.3) opp += hoops ? 2 : 3
  return { mine, opp, note }
}
