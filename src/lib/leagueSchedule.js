// A Career season's schedule, the way the leagues draw it. One pure function of the season (seeded), so every
// re-run of the season (the director re-simulates the games after each decision, lib/seasonDirector.js) plays the
// same opponents in the same order: the sims read it off the team (team.schedule: utils/simulation.js buildSchedule,
// utils/bucketSimulation.js), never draw their own.
//
// NFL (the formula since 2021): 17 games.
//   6  the three division rivals, home and away
//   4  every team of one other division in the conference (a three-year rotation)
//   4  every team of one division in the other conference (a four-year rotation)
//   2  the teams that finished in the same place last season in the two other divisions of the conference
//   1  the team that finished in the same place in a division of the other conference (not the one above; a
//      four-year rotation of its own), at home for the AFC in even years
// Nobody but a division rival twice; nine home games or eight. The last game is a division game (the NFL's Week 18),
// and a rematch never comes within three weeks of the first meeting. "Same place": last season's finish, read here
// off a ranking the caller passes (team strength), with a seeded shuffle of the close ones.
//
// NBA (the format since 2023-24): 82 games. 4 against each division rival (16), 4 against six of the ten other
// conference teams and 3 against the other four (36), 2 against every team in the other conference (30). 41 at home.
import { seeded } from './rng.js'
import { NFL_TEAMS } from '../data/nfl-teams.js'

const NFL_DIVS = ['East', 'North', 'South', 'West']
const nflDiv = (conf, i) => NFL_TEAMS.filter(t => t.div === `${conf} ${NFL_DIVS[i]}`).map(t => t.short)
// the in-conference rotation: which division a division plays all four of, year by year (three years, every pair once)
const MATCH = [[1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0]]
const SCHED = new Map()
const keep = (id, v) => { if (SCHED.size > 64) SCHED.delete(SCHED.keys().next().value); SCHED.set(id, v); return v }

// place: (short) => a number, higher finishes higher (last season's finish). The same function for every team.
export function nflSchedule(short, season, place = () => 0) {
  const me = NFL_TEAMS.find(t => t.short === short)
  if (!me) return null
  const id = `nfl|${short}|${season}`
  if (SCHED.has(id)) return SCHED.get(id).map(g => ({ ...g }))
  const s = Number(season) || 0
  const conf = me.conf, other = conf === 'AFC' ? 'NFC' : 'AFC'
  const di = NFL_DIVS.findIndex(d => me.div === `${conf} ${d}`)
  // a division's finishing order last season: the ranking, with a seeded nudge (a close race goes either way)
  const rn = seeded(`nfl-places-${s}`)
  const jit = Object.fromEntries(NFL_TEAMS.map(t => [t.short, rn() * 0.8]))
  const order = list => [...list].sort((a, b) => (place(b) + jit[b]) - (place(a) + jit[a]))
  const placeOf = (list, x) => order(list).indexOf(x)
  const mine = nflDiv(conf, di), p = placeOf(mine, short), idx = mine.indexOf(short)
  const games = []
  const add = (opp, home, kind) => games.push({ short: opp, home, kind })
  // the division: home and away
  for (const o of mine) if (o !== short) { add(o, true, 'div'); add(o, false, 'div') }
  // one division of four games: two at home, two away (team i hosts j when i + j + the season is even)
  const all4 = (list, myI, flip) => list.forEach((o, j) => add(o, ((myI + j + s) % 2 === 0) !== flip, 'rot'))
  const m = MATCH[((s % 3) + 3) % 3][di]
  // (the division listed first in the pair keeps the rule as it is, the other one reads it the other way round)
  all4(nflDiv(conf, m), idx, di > m)
  // the other conference: AFC division i plays NFC division (i + s) % 4; read the other way from the NFC
  const k4 = conf === 'AFC' ? (di + s) % 4 : (((di - s) % 4) + 4) % 4
  all4(nflDiv(other, k4), idx, conf === 'NFC')
  // the two same-place games in the conference: the other two divisions, around a cycle (one hosts the next)
  const rest = [0, 1, 2, 3].filter(x => x !== di && x !== m)
  // (one cycle for the whole conference this season: the East, the East's rotation partner and the other two)
  const MS = MATCH[((s % 3) + 3) % 3], a = 0, b = MS[0]
  const [c1, c2] = [0, 1, 2, 3].filter(x => x !== a && x !== b)
  // the cycle a -> c1 -> b -> c2 -> a (flipped every other season): a division hosts the one after it
  const cyc = s % 2 === 0 ? [a, c1, b, c2] : [a, c2, b, c1]
  const nextOf = x => cyc[(cyc.indexOf(x) + 1) % 4]
  for (const d of rest) {
    const list = nflDiv(conf, d)
    add(order(list)[p], nextOf(di) === d, 'place')
  }
  // the 17th game: a same-place team from the other conference, two divisions on from the four-game one
  const k17 = conf === 'AFC' ? (di + s + 2) % 4 : (((di - s - 2) % 4) + 4) % 4
  add(order(nflDiv(other, k17))[p], (conf === 'AFC') === (s % 2 === 0), 'x17')
  // the weeks: a seeded order with the last game in the division, no rematch within three weeks, no four on the road
  const r = seeded(`nfl-weeks-${short}-${s}`)
  let best = null
  for (let tries = 0; tries < 400 && !best; tries++) {
    const g = [...games]
    for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [g[i], g[j]] = [g[j], g[i]] }
    const li = g.map((x, i) => [x, i]).filter(([x]) => x.kind === 'div').map(([, i]) => i)
    const lastDiv = li[Math.floor(r() * li.length)]
    ;[g[lastDiv], g[g.length - 1]] = [g[g.length - 1], g[lastDiv]]
    let ok = true
    for (let i = 0; i < g.length && ok; i++) {
      for (let j = Math.max(0, i - 3); j < i; j++) if (g[j].short === g[i].short) ok = false
      if (i >= 3 && !g[i].home && !g[i - 1].home && !g[i - 2].home && !g[i - 3].home) ok = false
      if (i >= 3 && g[i].home && g[i - 1].home && g[i - 2].home && g[i - 3].home) ok = false
    }
    if (ok) best = g
  }
  best ??= games
  const name = x => NFL_TEAMS.find(t => t.short === x)?.name ?? x
  return keep(id, best.map(x => ({ opponent: name(x.short), short: x.short, home: x.home, kind: x.kind }))).map(g => ({ ...g }))
}

// conf: 'East' | 'West'; teams: [{ short, conf, div }] (the NBA's)
export function nbaSchedule(short, season, teams) {
  const me = teams.find(t => t.short === short)
  if (!me) return null
  const id = `nba|${short}|${season}`
  if (SCHED.has(id)) return SCHED.get(id).map(g => ({ ...g }))
  const r = seeded(`nba-sched-${short}-${season}`)
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
  const games = []
  const add = (o, home) => games.push({ short: o, home })
  const div = teams.filter(t => t.short !== short && t.div && t.div === me.div)
  const conf = teams.filter(t => t.short !== short && t.conf === me.conf && t.div !== me.div)
  const away = teams.filter(t => t.conf !== me.conf)
  for (const t of div) { add(t.short, true); add(t.short, true); add(t.short, false); add(t.short, false) }
  // of the ten other conference teams, four are played three times (two of them twice at home)
  const three = shuffle([...conf]).slice(0, 4).map(t => t.short)
  three.forEach((o, i) => { add(o, true); add(o, false); add(o, i < 2) })
  for (const t of conf) if (!three.includes(t.short)) { add(t.short, true); add(t.short, true); add(t.short, false); add(t.short, false) }
  for (const t of away) { add(t.short, true); add(t.short, false) }
  // the order: no opponent two games running
  let best = null
  for (let tries = 0; tries < 200 && !best; tries++) {
    const g = shuffle([...games])
    // (a repeat next to itself: swapped with a game further on)
    for (let i = 1; i < g.length; i++) if (g[i].short === g[i - 1].short) { const j = g.findIndex((x, k) => k > i + 1 && x.short !== g[i].short && x.short !== g[i - 1].short && (k + 1 >= g.length || g[k + 1].short !== g[i].short) && g[k - 1].short !== g[i].short); if (j > 0) [g[i], g[j]] = [g[j], g[i]] }
    if (g.every((x, i) => i === 0 || x.short !== g[i - 1].short)) best = g
  }
  best ??= games
  return keep(id, best.map(x => ({ opponent: x.short, home: x.home }))).map(g => ({ ...g }))
}
