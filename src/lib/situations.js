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
const SPOTS = {
  'two-minute': { ...DRIVE, tail: 'Needs a touchdown.' },
  'goal-line': { margin: DRIVE.margin, span: [4, 38], tail: 'Fourth and goal at the five.' },   // (at the five, down three or tied, he'd kick)
  sneak: { ...RUN, tail: 'Fourth and inches.' },
  gap: RUN, juke: RUN, seal: RUN,
  'third-long': { ...PASS, tail: 'Third and long.' },
  bomb: { ...PASS, tail: 'Time for a deep shot.' },
  'jump-route': STOP, 'tackle-angle': STOP, 'pass-rush': STOP, 'run-stuff': STOP,
  'clutch-shot': { margin: [1, 1, 2], fixed: 2.8, hoops: true, tail: 'One shot left.' },         // (2.8: the shot's own clock in lib/mg/meter.js)
  'free-throws': { margin: [1, 1, 0], tenths: [0.8, 5.5], hoops: true, tail: 'Two shots at the line.' },
  iso: HOOP, pnr: HOOP, 'post-up': HOOP, board: { ...HOOP, tail: 'The shot goes up.' },
  'rim-protect': { margin: [-1, -2, -2], span: [6, 30], hoops: true, stop: true },
}
// these end in the end zone, whatever else he's short of
const TD_GAMES = new Set(['two-minute', 'goal-line'])
const clockOf = (s, hoops) => (hoops && s < 10 ? s.toFixed(1) : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`)

export function momentSituation(game, seed = 'x', { us = 'HOME', them = 'AWAY' } = {}) {
  const r = seeded(`sit-${seed}-${game}`)
  const spot = SPOTS[game] ?? PASS
  const pick = a => a[Math.floor(r() * a.length)]
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

// what it takes to go from n behind to in front
const over = (n, hoops) => (hoops ? (n <= 1 ? 2 : n + 1) : n < 3 ? 3 : n <= 6 ? 7 : n === 7 ? 8 : n + 3)

// The final, from that score. won and hit are already decided; they can disagree (he lands it and
// they still lose, he misses and they still win), so note says how: { mine, opp, note }.
export function finalScore(sit, game, won, hit, seed = 'x') {
  const r = seeded(`sitf-${seed}-${game}`)
  const { hoops, them } = sit
  const need = sit.opp - sit.mine
  let mine = sit.mine, opp = sit.opp, note = null
  // what landing it put on the board
  const play = game === 'clutch-shot' ? 3 : game === 'free-throws' ? 2 : TD_GAMES.has(game) ? over(need, false) : need < 0 ? 0 : over(need, hoops)
  if (won) {
    if (hit) mine += play
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
