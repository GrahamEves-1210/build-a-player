// The checks' own little league (part C): the real NBA rosters as Franchise men (nba/STATE.md's shape), an 82-game
// schedule with back-to-backs. Core's league.js, schedule.js and season.js are the real thing; this is just enough of
// one to run the court's pieces (game, rotation, injuries, aging, awards) over many seasons, headless.
import { NBA_GUARD_PLAYERS as G } from '../../../src/data/nba-guards'
import { NBA_BIG_PLAYERS as B } from '../../../src/data/nba-bigs'
import { NBA_TEAMS } from '../../../src/data/nba-teams'
import { BIRTH_NBA } from '../../../src/data/player-ages'
import { ovrOf, groupOfPos } from '../../../src/lib/franchise2/nba/skills'
import { prospect, seedPotential, attrsFor } from '../../../src/lib/franchise2/nba/aging'
import { rngOf } from '../../../src/lib/franchise2/rng'

export const SHORTS = NBA_TEAMS.map(t => t.short).sort()
export const EAST = new Set(['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS'])
export const FIRST = 2026

export function makeLeague(seed = 'c') {
  const R = rngOf(`lg-${seed}`)
  // every real man once: a man in both files keeps the list that goes with his listed spot (core's rule)
  const by = new Map()
  for (const [g, list] of [['guard', G], ['big', B]]) for (const r of list) {
    if (!r.attrs || !r.team) continue
    const fits = groupOfPos(r.position) === g
    const was = by.get(r.name)
    if (!was || (fits && !was.fits)) by.set(r.name, { r, g, fits })
  }
  const F = { seed, year: FIRST, nid: 1, teams: {}, fa: [], ss: {}, ps: {}, retired: [], hist: [] }
  for (const s of SHORTS) F.teams[s] = { s, r: [] }
  for (const { r, g } of by.values()) {
    const p = { i: F.nid++, n: r.name, p: r.position, g, a: { ...r.attrs }, ht: r.height, wt: r.weight, ag: FIRST - (BIRTH_NBA[r.name] ?? 1999) }
    p.o = ovrOf(p); p.ys = Math.max(0, p.ag - 20)
    seedPotential(p, R)
    F.teams[r.team].r.push(p)
  }
  // thin rosters (the files carry 9 to 16): end-of-bench men to 14
  for (const s of SHORTS) while (F.teams[s].r.length < 14) F.teams[s].r.push(filler(F, R))
  return F
}
export function filler(F, R, o = null) {
  const x = prospect(R, { rank: 55 })
  const p = { ...x, i: F.nid++, n: `Filler ${F.nid}`, ag: 23 + R.int(0, 6) }
  p.a = attrsFor(p.p, o ?? 68 + R.int(0, 5), R); p.o = ovrOf(p); p.pk = p.o
  p.ys = p.ag - 21
  return p
}

// 82 games: rounds of a random pairing; a round is a day, about three in ten follow the day before (a back-to-back
// for every team in it). Home and away come out near 41-41.
export function schedule(seed, year) {
  const R = rngOf(`sch-${seed}-${year}`)
  const games = [], last = {}, home = Object.fromEntries(SHORTS.map(s => [s, 0]))
  let day = 0
  for (let r = 0; r < 82; r++) {
    day += R.u() < 0.3 ? 1 : 2
    const order = R.shuffle(SHORTS)
    for (let j = 0; j < 30; j += 2) {
      let [x, y] = [order[j], order[j + 1]]
      if (home[x] > home[y] || (home[x] === home[y] && R.u() < 0.5)) [x, y] = [y, x]
      home[x]++
      games.push({ d: day, h: x, a: y, b2b: { h: last[x] === day - 1, a: last[y] === day - 1 } })
      last[x] = day; last[y] = day
    }
  }
  return games
}
