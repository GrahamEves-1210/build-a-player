// TAKEOVER — the road. Build once, then cross the country: twelve cities drawn
// across the map, each with a real player at your position who is a little
// better than the last — the road opens around 70 OVR and ends at the best in
// the league. Win and you upgrade a trait or steal one of theirs; lose and it
// costs a life (three). Take all twelve and the road goes endless: random
// greats, anywhere, for as long as the build holds. The run is plain data
// saved on the device, so Home never loses it. One engine for both games:
// basketball duels are the streetball sim (1v1 to 11; Duo is 2v2 vs the star
// and the city's next best), football duels are one game vs the city.

import { seeded } from './rng'
import { simStreetball, buildFromPlayer } from './hoops'
import { GEO, project } from './usMap'

export const LIVES = 3
export const STOPS = 12
export const XP_CITY = 15
export const XP_RUN = 250
export const XP_ENDLESS = 30
export const COINS_CITY = 8
export const COINS_RUN = 75
const RUN_V = 2

// ── Cities ────────────────────────────────────────────────────────────────────
export function cityList(sport, teams) {
  const geo = GEO[sport === 'bucket' ? 'nba' : 'nfl']
  return teams.map(t => {
    const g = geo[t.short]
    const pt = g ? project(g.lon, g.lat) : { x: 50, y: 50 }
    return {
      short: t.short, name: t.name, nick: t.name.split(' ').slice(-1)[0],
      city: g?.city ?? t.name.split(' ').slice(0, -1).join(' '),
      color: t.color, color2: t.color2, logo: sport === 'bucket' ? `/logos/nba/${t.short}.png` : t.logo,
      lat: g?.lat ?? 39, lon: g?.lon ?? -96, x: pt.x, y: pt.y,
    }
  })
}

const avgAttr = p => { const v = Object.values(p.attrs || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }

// Every rated player at this position, with the OVR his real ratings make as a build
export function ratedPool(pool, types, calcOvr, cities) {
  const on = new Set(cities.map(c => c.short))
  return pool.filter(p => p.attrs && on.has(p.team)).map(p => ({ name: p.name, team: p.team, ovr: Math.round(calcOvr(buildFromPlayer(p, types))) }))
}

// The road: 12 stops. Each is a little better than the last (never worse), in
// a city near the one you're in — with a little randomness among the best fits.
export function planRoute({ rated, cities, seed, stops = STOPS }) {
  const r = seeded(`${seed}-route`)
  const byShort = Object.fromEntries(cities.map(c => [c.short, c]))
  const ovrs = rated.map(p => p.ovr).sort((a, b) => a - b)
  const start = cities[Math.floor(r() * cities.length)]
  if (!ovrs.length) return { route: [], start: start?.short ?? null, lo: 70, hi: 99 }
  const hi = ovrs[ovrs.length - 1]
  let lo = Math.max(ovrs[0], Math.min(70, hi - 18))
  // the floor needs twelve cities above it (not counting where you start)
  const citiesAbove = floor => new Set(rated.filter(p => p.ovr >= floor && p.team !== start.short).map(p => p.team)).size
  while (lo > ovrs[0] && citiesAbove(lo) < stops) lo -= 1
  // one player per rung of the ladder, each from a new city, leaning toward
  // the city drawn before it — with a little randomness among the best fits
  const picks = []
  const used = new Set(), visited = new Set([start.short])
  let here = start
  for (let k = 0; k < stops; k++) {
    const target = lo + (hi - lo) * (k / (stops - 1))
    let cands = rated.filter(p => !used.has(p.name) && !visited.has(p.team) && p.ovr >= lo - 2)
    if (!cands.length) cands = rated.filter(p => !used.has(p.name) && !visited.has(p.team))
    if (!cands.length) cands = rated.filter(p => !used.has(p.name))
    if (!cands.length) break
    const scored = cands
      .map(p => { const c = byShort[p.team]; const d = Math.hypot(c.x - here.x, c.y - here.y); return { p, c, s: Math.abs(p.ovr - target) + d * .05 } })
      .sort((a, b) => a.s - b.s)
    const top = scored.slice(0, Math.min(3, scored.length))
    const { p, c } = top[Math.floor(r() * top.length)]
    picks.push({ short: c.short, name: p.name, ovr: p.ovr, k })
    used.add(p.name); visited.add(c.short); here = c
  }
  // the road only climbs: play them in rating order
  const route = picks.sort((a, b) => a.ovr - b.ovr || a.k - b.k).map(({ k, ...s }) => s)
  return { route, start: start.short, lo, hi }
}

// After the twelfth: a random great, anywhere, playing a little harder the longer you last
export function endlessStop(run, rated) {
  const n = run.endless.length
  const r = seeded(`${run.seed}-endless-${n}`)
  const recent = new Set([...run.route, ...run.endless].slice(-6).map(s => s.name))
  const hi = run.hi ?? Math.max(...rated.map(p => p.ovr))
  let greats = rated.filter(p => p.ovr >= hi - 7 && !recent.has(p.name))
  if (greats.length < 3) greats = rated.filter(p => p.ovr >= hi - 12 && !recent.has(p.name))
  if (!greats.length) greats = rated
  const p = greats[Math.floor(r() * greats.length)]
  return { short: p.team, name: p.name, ovr: p.ovr, boost: Math.min(3, Math.floor(run.endlessWins / 3)) }
}

export const isEndless = run => run.idx >= run.route.length
export const stopAt = run => (isEndless(run) ? run.endless[run.idx - run.route.length] ?? null : run.route[run.idx])
/** In endless, draws the next stop if it isn't there yet */
export function ensureStop(run, rated) {
  if (!isEndless(run) || stopAt(run) || !rated.length) return run
  return { ...run, endless: [...run.endless, endlessStop(run, rated)] }
}
/** Where you are: the last city you took, else where the road began */
export const whereAmI = run => [...run.log].reverse().find(l => l.won)?.city ?? run.start

// The stop's player as a build (endless form adds a little to every rating).
// `nextBestOf` is the Duo partner's man: the best on that roster not already on the floor.
export function opponentOf(stop, city, pool, types, photoFor) {
  const p = pool.find(x => x.name === stop.name && x.attrs) ?? bestOn(city, pool)
  if (!p) return null
  const boost = stop.boost ?? 0
  const boosted = boost ? { ...p, attrs: Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, Math.min(11, v + boost)])) } : p
  return { player: boosted, build: buildFromPlayer(boosted, types, photoFor?.(p) ?? null), ovr: stop.ovr, boost }
}
const bestOn = (city, pool, exclude = null) => {
  const on = pool.filter(p => p.team === city.short && p.attrs && p.name !== exclude)
  const src = on.length ? on : pool.filter(p => p.attrs && p.name !== exclude)
  return [...src].sort((a, b) => avgAttr(b) - avgAttr(a))[0] ?? null
}
export function nextBestOf(city, pool, types, photoFor, exclude) {
  const p = bestOn(city, pool, exclude)
  return p ? { player: p, build: buildFromPlayer(p, types, photoFor?.(p) ?? null), ovr: null, boost: 0 } : null
}

// ── Run state ─────────────────────────────────────────────────────────────────
const key = (sport, uid) => `bap_takeover_${sport}_${uid || 'guest'}`
export function loadRun(sport, uid) {
  try { const run = JSON.parse(localStorage.getItem(key(sport, uid))); return run && run.v === RUN_V && Array.isArray(run.route) ? run : null } catch { return null }
}
export function saveRun(run) { try { if (run) localStorage.setItem(key(run.sport, run.uid), JSON.stringify(run)) } catch {} }
export function clearRun(sport, uid) { try { localStorage.removeItem(key(sport, uid)) } catch {} }

// ── Past runs (the Takeover intro lists them) ────────────────────────────────
const histKey = sport => `bap_takeover_hist_${sport}`
export function pastRuns(sport) {
  try { const l = JSON.parse(localStorage.getItem(histKey(sport)) || '[]'); return Array.isArray(l) ? l : [] } catch { return [] }
}
// Book a finished run once (out of lives, or ended by hand); returns it marked
export function logRun(run, ovr = null) {
  if (!run || run.logged || !run.log?.length) return run
  const entry = {
    at: Date.now(), pos: run.pos, mode: run.mode, taken: run.taken.length, stops: run.route.length,
    endless: run.endlessWins, won: !!run.won, ovr, games: run.log.length, wins: run.log.filter(l => l.won).length,
    last: run.log[run.log.length - 1]?.city ?? null,
  }
  try { localStorage.setItem(histKey(run.sport), JSON.stringify([entry, ...pastRuns(run.sport)].slice(0, 20))) } catch {}
  return { ...run, logged: true }
}

export function newRun({ sport, uid, pos, mode = 'solo', build, types, rated, cities }) {
  const seed = Math.random().toString(36).slice(2, 10)
  const { route, start, lo, hi } = planRoute({ rated, cities, seed })
  return {
    v: RUN_V, sport, uid, pos, mode, code: null, build, types, seed, route, start, lo, hi,
    idx: 0, taken: [], endless: [], endlessWins: 0, lives: LIVES, log: [], started: Date.now(), over: false, won: false, justWon: false, attempt: 0,
  }
}

// ── Duels ────────────────────────────────────────────────────────────────────
export function hoopsDuel({ run, city, star, me, partner = null, partnerStar = null }) {
  const seed = `${run.seed}-${city.short}-${run.idx}-${run.attempt}`
  const last = n => n.split(' ').slice(-1)[0].toUpperCase()
  const mine = { id: 'me', name: me.name, pos: run.pos, build: run.build }
  const theirs = { id: 'star', name: star.player.name, pos: run.pos, build: star.build, role: star.boost ? 'score' : 'balanced' }
  if (partner && partnerStar) {
    const p2 = { id: 'partner', name: partner.name, pos: partner.pos, build: partner.build }
    const s2 = { id: 'star2', name: partnerStar.player.name, pos: partner.pos, build: partnerStar.build }
    return simStreetball({ teams: [[mine, p2], [theirs, s2]], seed, goal: 15, winBy: 2, cap: 19, names: ['YOU TWO', city.nick.toUpperCase()] })
  }
  return simStreetball({ teams: [[mine], [theirs]], seed, goal: 11, winBy: 1, cap: 11, names: ['YOU', last(star.player.name)] })
}

// Football: one game vs the city. Your build's OVR against the star's sets the
// odds; the rest is a drive-by-drive story with a stat line in your position's language.
const POS_LINE = {
  qb: (r, win, q) => ({ keys: ['YDS', 'TD', 'INT'], vals: [Math.round(190 + q * 170 + r() * 60), Math.round((win ? 1.6 : .8) + q * 2.2 + r()), Math.round((win ? 0 : .9) + (1 - q) * 1.2 + r() * .8)] }),
  rb: (r, win, q) => ({ keys: ['RUSH', 'TD', 'YPC'], vals: [Math.round(45 + q * 110 + r() * 40), Math.round((win ? .9 : .3) + q * 1.6 + r() * .8), (3.1 + q * 2.4 + r() * .8).toFixed(1)] }),
  wr: (r, win, q) => ({ keys: ['REC', 'YDS', 'TD'], vals: [Math.round(3 + q * 6 + r() * 2), Math.round(35 + q * 110 + r() * 40), Math.round((win ? .7 : .2) + q * 1.4 + r() * .8)] }),
  te: (r, win, q) => ({ keys: ['REC', 'YDS', 'TD'], vals: [Math.round(2 + q * 5 + r() * 2), Math.round(25 + q * 80 + r() * 30), Math.round((win ? .6 : .2) + q * 1.1 + r() * .7)] }),
  db: (r, win, q) => ({ keys: ['TKL', 'PBU', 'INT'], vals: [Math.round(3 + q * 5 + r() * 3), Math.round(q * 3 + r() * 1.5), Math.round((win ? .6 : .1) + q * 1.1 + r() * .7)] }),
}
const DRIVES = {
  td: ['{t} go {y} yards — TOUCHDOWN.', '{t} finish the drive — {y}-yard TD.', '{t} punch it in from the {y}.', '{t} strike — {y} yards, six.'],
  fg: ['{t} settle for three.', '{t} stall — field goal.', '{t} chip-shot field goal.'],
  punt: ['{t} three-and-out.', '{t} punt it away.', '{t} drive fizzles.'],
  to: ['{t} TURN IT OVER!', '{t} cough it up!', 'INTERCEPTED — {t} drive dies.'],
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)]

export function footballDuel({ run, city, star, myOvr, myTeamShort = 'YOU' }) {
  const r = seeded(`${run.seed}-${city.short}-${run.idx}-${run.attempt}`)
  const bar = (star.ovr ?? 80) + (star.boost ?? 0) * 2 - 1          // what a build should be to beat this player's city
  const q = Math.max(0, Math.min(1, (myOvr - bar + 10) / 20))         // 0 → 1 quality of your day
  const pWin = 1 / (1 + Math.exp(-(myOvr - bar) / 5.5))
  const win = r() < pWin
  const my = Math.round(13 + q * 22 + r() * 10), opp = Math.round(13 + (1 - q) * 18 + r() * 10)
  const score = win ? [Math.max(my, opp + 3 + Math.round(r() * 7)), opp] : [my, Math.max(opp, my + 3 + Math.round(r() * 7))]
  const line = POS_LINE[run.pos]?.(r, win, q) ?? POS_LINE.qb(r, win, q)
  const plays = []
  let s = [0, 0], id = 0
  const quarters = ['Q1', 'Q1', 'Q2', 'Q2', 'Q2', 'Q3', 'Q3', 'Q4', 'Q4', 'Q4']
  for (let i = 0; i < quarters.length; i++) {
    const mine = i % 2 === 0
    const lead = mine ? score[0] : score[1]
    const share = lead / Math.max(1, score[0] + score[1])
    const roll = r()
    const kind = roll < share * .75 ? 'td' : roll < share * .75 + .18 ? 'fg' : roll < .9 ? 'punt' : 'to'
    const pts = kind === 'td' ? 7 : kind === 'fg' ? 3 : 0
    s = mine ? [s[0] + pts, s[1]] : [s[0], s[1] + pts]
    plays.push({ id: id++, q: quarters[i], team: mine ? 0 : 1, kind, pts, text: pick(r, DRIVES[kind]).replace('{t}', mine ? `${myTeamShort}` : city.nick.toUpperCase()).replace('{y}', 8 + Math.round(r() * 60)), score: [...s] })
  }
  plays.push({ id: id++, q: 'FINAL', team: win ? 0 : 1, kind: 'final', pts: 0, text: win ? `FINAL — you take ${city.city}.` : `FINAL — ${city.nick} hold serve.`, score: [...score] })
  return { win, score, line, plays, pWin: +pWin.toFixed(2), star }
}

// ── Rewards ──────────────────────────────────────────────────────────────────
export function stealOptions(run, star) {
  return run.types.filter(t => (star.build[t]?.val ?? 0) > (run.build[t]?.val ?? 0)).map(t => ({ type: t, from: run.build[t]?.val ?? 0, to: star.build[t].val }))
}
export function upgradeOptions(run) {
  return run.types.filter(t => (run.build[t]?.val ?? 0) < 11).map(t => ({ type: t, from: run.build[t]?.val ?? 0, to: (run.build[t]?.val ?? 0) + 1 }))
}
export function applyReward(run, reward, star) {
  const build = { ...run.build }
  if (reward.kind === 'steal') build[reward.type] = { ...star.build[reward.type], stolen: true }
  else build[reward.type] = { ...(build[reward.type] || { type: reward.type }), val: Math.min(11, (build[reward.type]?.val ?? 0) + 1), upgraded: (build[reward.type]?.upgraded ?? 0) + 1 }
  return { ...run, build }
}

// A win moves you on (the city is yours, the road's lives refill when the
// twelfth falls); a loss costs a life and you run that stop back.
export function afterDuel(run, city, won) {
  const log = [...run.log, { city: city.short, won, at: Date.now(), idx: run.idx }]
  if (won) {
    const endless = isEndless(run)
    const idx = run.idx + 1
    const justWon = !run.won && idx >= run.route.length
    return {
      ...run, log, idx, attempt: 0, justWon,
      taken: endless ? run.taken : [...run.taken, city.short],
      won: run.won || justWon, lives: justWon ? LIVES : run.lives,
      endlessWins: endless ? run.endlessWins + 1 : run.endlessWins,
    }
  }
  const lives = run.lives - 1
  return { ...run, log, lives, attempt: run.attempt + 1, over: lives <= 0, justWon: false }
}
