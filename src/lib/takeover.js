// TAKEOVER — the road mode. Build once, then take every city: at each stop you
// face that team's best player at your position; win and you upgrade a trait
// or steal one of theirs. Three lives. Cities come in rising order of strength,
// and each ten stops the stars play a little harder. One engine for both games:
// basketball duels use the streetball sim (1v1 to 11; Duo is 2v2), football
// duels are one game against that city's defense.

import { seeded } from './rng'
import { simStreetball, buildFromPlayer } from './hoops'

export const LIVES = 3
export const XP_CITY = 15
export const XP_RUN = 250

// ── Cities ────────────────────────────────────────────────────────────────────
export function cityList(sport, teams, ratings) {
  const list = teams.map(t => {
    const r = ratings?.[t.short]
    const strength = sport === 'bucket' ? ((r?.off ?? 70) + (r?.def ?? 70)) / 2 : ((t.off ?? 5) + (t.def ?? 5)) * 10
    return { short: t.short, name: t.name, city: t.name.split(' ').slice(0, -1).join(' '), nick: t.name.split(' ').slice(-1)[0], color: t.color, color2: t.color2, logo: sport === 'bucket' ? `/logos/nba/${t.short}.png` : t.logo, strength, def: t.def, off: t.off }
  })
  return list.sort((a, b) => a.strength - b.strength || a.short.localeCompare(b.short)).map((c, i) => ({ ...c, idx: i, tier: Math.floor(i / 10) }))
}

const avgAttr = p => { const v = Object.values(p.attrs || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }

// The city's best player at this position, a little better each tier.
// `exclude` skips a name already on the floor (Duo: the partner's opponent).
export function starOf(city, pool, types, photoFor, exclude = null) {
  const onTeam = pool.filter(p => p.team === city.short && p.attrs && p.name !== exclude)
  const src = onTeam.length ? onTeam : pool.filter(p => p.attrs && p.name !== exclude)
  const best = [...src].sort((a, b) => avgAttr(b) - avgAttr(a))[0]
  if (!best) return null
  const boosted = { ...best, attrs: Object.fromEntries(Object.entries(best.attrs).map(([k, v]) => [k, Math.min(11, v + city.tier)])) }
  return { player: boosted, build: buildFromPlayer(boosted, types, photoFor?.(best) ?? null), boost: city.tier }
}

// ── Run state ─────────────────────────────────────────────────────────────────
const key = (sport, uid) => `bap_takeover_${sport}_${uid || 'guest'}`
export function loadRun(sport, uid) { try { return JSON.parse(localStorage.getItem(key(sport, uid))) } catch { return null } }
export function saveRun(run) { try { if (run) localStorage.setItem(key(run.sport, run.uid), JSON.stringify(run)); } catch {} }
export function clearRun(sport, uid) { try { localStorage.removeItem(key(sport, uid)) } catch {} }

export function newRun({ sport, uid, pos, mode = 'solo', build, types, code = null }) {
  return { v: 1, sport, uid, pos, mode, code, build, types, idx: 0, taken: [], lives: LIVES, log: [], seed: Math.random().toString(36).slice(2, 10), started: Date.now(), over: false, won: false, attempt: 0 }
}

// ── Duels ────────────────────────────────────────────────────────────────────
export function hoopsDuel({ run, city, star, me, partner = null, partnerStar = null }) {
  const seed = `${run.seed}-${city.short}-${run.attempt}`
  const mine = { id: 'me', name: me.name, pos: run.pos, build: run.build }
  const theirs = { id: 'star', name: star.player.name, pos: run.pos, build: star.build, role: city.tier >= 2 ? 'score' : 'balanced' }
  if (partner) {
    const p2 = { id: 'partner', name: partner.name, pos: partner.pos, build: partner.build }
    const s2 = { id: 'star2', name: partnerStar.player.name, pos: partner.pos, build: partnerStar.build }
    return simStreetball({ teams: [[mine, p2], [theirs, s2]], seed, goal: 15, winBy: 2, cap: 19 })
  }
  return simStreetball({ teams: [[mine], [theirs]], seed, goal: 11, winBy: 1, cap: 11 })
}

// Football: one game vs the city. Your build's OVR against the city's defense
// (and its star's level) sets the odds; the rest is a drive-by-drive story
// with a stat line in your position's language.
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
  const r = seeded(`${run.seed}-${city.short}-${run.attempt}`)
  // what a build "should" be to beat this city: rises from ~74 to ~95 across the road
  const bar = 72 + city.idx * 0.72 + city.tier * 1.5
  const q = Math.max(0, Math.min(1, (myOvr - bar + 10) / 20))       // 0 → 1 quality of your day
  const pWin = 1 / (1 + Math.exp(-(myOvr - bar) / 5.5))
  const win = r() < pWin
  const my = Math.round(13 + q * 22 + r() * 10), opp = Math.round(13 + (1 - q) * 18 + r() * 10)
  const score = win ? [Math.max(my, opp + 3 + Math.round(r() * 7)), opp] : [my, Math.max(opp, my + 3 + Math.round(r() * 7))]
  const line = POS_LINE[run.pos]?.(r, win, q) ?? POS_LINE.qb(r, win, q)
  // drives: alternate, weighted by who's winning
  const plays = []
  let s = [0, 0], id = 0
  const quarters = ['Q1', 'Q1', 'Q2', 'Q2', 'Q2', 'Q3', 'Q3', 'Q4', 'Q4', 'Q4']
  for (let i = 0; i < quarters.length; i++) {
    const mine = i % 2 === 0
    const t = mine ? 'YOU' : city.short
    const lead = mine ? score[0] : score[1]
    const share = lead / Math.max(1, score[0] + score[1])
    const roll = r()
    const kind = roll < share * .75 ? 'td' : roll < share * .75 + .18 ? 'fg' : roll < .9 ? 'punt' : 'to'
    const pts = kind === 'td' ? 7 : kind === 'fg' ? 3 : 0
    if (mine) s = [s[0] + pts, s[1]]; else s = [s[0], s[1] + pts]
    plays.push({ id: id++, q: quarters[i], team: mine ? 0 : 1, kind, pts, text: pick(r, DRIVES[kind]).replace('{t}', mine ? `${myTeamShort}` : city.nick.toUpperCase()).replace('{y}', 8 + Math.round(r() * 60)), score: [...s] })
  }
  // settle to the final
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

export function afterDuel(run, city, won) {
  const log = [...run.log, { city: city.short, won, at: Date.now() }]
  if (won) {
    const taken = [...run.taken, city.short]
    const idx = run.idx + 1
    const done = idx >= run.total
    return { ...run, log, taken, idx, attempt: 0, over: done, won: done }
  }
  const lives = run.lives - 1
  return { ...run, log, lives, attempt: run.attempt + 1, over: lives <= 0 }
}
