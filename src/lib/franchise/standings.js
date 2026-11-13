// FRANCHISE: standings, the tiebreak basics, the seven seeds and the playoff bracket.
//
// Records are read from the schedule itself (272 games), so they can never drift from the scores. Ties in the
// standings are broken the NFL's way, the basics of it: head to head, division record (in a division), conference
// record, strength of victory, point difference, then a seeded coin.
import { REG_WEEKS, PLAYOFF_ROUNDS } from './consts'
import { DIVISIONS, DIV_OF, CONF_OF, CONFS } from './schedule'
import { TEAM_SHORTS, pct } from './core'
import { roll } from './rng'

const blank = () => ({ w: 0, l: 0, t: 0, pf: 0, pa: 0, dw: 0, dl: 0, dt: 0, cw: 0, cl: 0, ct: 0, hw: 0, hl: 0, ht: 0, aw: 0, al: 0, at: 0, strk: 0, l5: '', beat: [], lost: [], tied: [], vs: {} })
// every team's regular-season record from the games played so far
export function records(F) {
  const R = Object.fromEntries(TEAM_SHORTS.map(s => [s, blank()]))
  for (let w = 0; w < Math.min(REG_WEEKS, F.sched.weeks.length); w++) for (const g of F.sched.weeks[w]) {
    if (g.hs == null) continue
    const H = R[g.h], A = R[g.a], div = DIV_OF[g.h] === DIV_OF[g.a], conf = CONF_OF[g.h] === CONF_OF[g.a]
    H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs
    const res = g.hs > g.as ? 1 : g.hs < g.as ? -1 : 0
    const put = (X, r, home, opp) => {
      const k = r > 0 ? 'w' : r < 0 ? 'l' : 't'
      X[k]++
      if (div) X[`d${k}`]++
      if (conf) X[`c${k}`]++
      X[`${home ? 'h' : 'a'}${k}`]++
      X.strk = r > 0 ? (X.strk > 0 ? X.strk + 1 : 1) : r < 0 ? (X.strk < 0 ? X.strk - 1 : -1) : 0
      X.l5 = (X.l5 + (r > 0 ? 'W' : r < 0 ? 'L' : 'T')).slice(-5)
      ;(r > 0 ? X.beat : r < 0 ? X.lost : X.tied).push(opp)
      const v = (X.vs[opp] ??= [0, 0, 0]); v[r > 0 ? 0 : r < 0 ? 1 : 2]++
    }
    put(H, res, true, g.a); put(A, -res, false, g.h)
  }
  return R
}
const P = r => pct(r.w, r.l, r.t)
// strength of victory: the combined record of the teams he beat
function sov(R, s) { let w = 0, l = 0, t = 0; for (const o of R[s].beat) { w += R[o].w; l += R[o].l; t += R[o].t } return pct(w, l, t) }
// head to head among a group: each team's record against the others in it (null when they haven't all met)
function h2h(R, group, s) {
  let w = 0, l = 0, t = 0
  for (const o of group) { if (o === s) continue; const v = R[s].vs[o]; if (v) { w += v[0]; l += v[1]; t += v[2] } }
  return w + l + t ? pct(w, l, t) : null
}
// Order a group of teams with the same record. sameDiv: all from one division.
function breakTie(R, seed, group, sameDiv) {
  if (group.length <= 1) return group
  const steps = [
    s => { const v = h2h(R, group, s); return v == null ? 0.5 : v },
    ...(sameDiv ? [s => pct(R[s].dw, R[s].dl, R[s].dt)] : []),
    s => pct(R[s].cw, R[s].cl, R[s].ct),
    s => sov(R, s),
    s => (R[s].pf - R[s].pa) / 1000,
    s => roll(`${seed}-coin-${s}`),
  ]
  for (const f of steps) {
    const vals = Object.fromEntries(group.map(s => [s, f(s)]))
    const best = Math.max(...group.map(s => vals[s]))
    const top = group.filter(s => vals[s] === best)
    if (top.length < group.length) {
      // the winner (or winners) come first; start over among what's left
      const rest = group.filter(s => !top.includes(s))
      return [...breakTie(R, seed, top, sameDiv), ...breakTie(R, seed, rest, sameDiv)]
    }
  }
  return group
}
function order(R, seed, list, sameDiv) {
  const by = [...list].sort((a, b) => P(R[b]) - P(R[a]))
  const out = []
  for (let i = 0; i < by.length;) {
    let j = i
    while (j < by.length && Math.abs(P(R[by[j]]) - P(R[by[i]])) < 1e-9) j++
    out.push(...breakTie(R, seed, by.slice(i, j), sameDiv))
    i = j
  }
  return out
}
// { divisions: { name: [short…] in order }, seeds: { AFC: [7], NFC: [7] }, conf: { AFC: [16 in order], … }, R }
export function standing(F) {
  const R = records(F), seed = `${F.seed}-${F.year}`
  const divisions = {}, seeds = {}, conf = {}
  for (const d of DIVISIONS) divisions[d.name] = order(R, seed, d.teams, true)
  for (const c of CONFS) {
    const winners = order(R, seed, DIVISIONS.filter(d => d.conf === c).map(d => divisions[d.name][0]), false)
    const rest = order(R, seed, TEAM_SHORTS.filter(s => CONF_OF[s] === c && !winners.includes(s)), false)
    seeds[c] = [...winners, ...rest.slice(0, 3)]
    conf[c] = [...winners, ...rest]
  }
  return { divisions, seeds, conf, R }
}
// What is already decided: 'z' the first seed, 'y' the division, 'x' a playoff spot, 'e' out. A light version of
// the real maths: a team is in when the first team out can't catch it, out when it can't catch the last team in.
export function clinches(F, S = standing(F)) {
  const out = {}, left = s => 17 - (S.R[s].w + S.R[s].l + S.R[s].t)
  const best = s => S.R[s].w + S.R[s].t / 2 + left(s), now = s => S.R[s].w + S.R[s].t / 2
  for (const c of CONFS) {
    const order16 = S.conf[c], seven = S.seeds[c], eighth = order16.filter(s => !seven.includes(s))
    const chase = Math.max(0, ...eighth.map(best))
    for (const s of order16) {
      const div = S.divisions[DIV_OF[s]]
      if (seven.includes(s)) {
        if (div[0] === s && div.slice(1).every(o => best(o) < now(s))) out[s] = seven[0] === s && order16.slice(1).every(o => best(o) < now(s)) ? 'z' : 'y'
        else if (now(s) > chase) out[s] = 'x'
      } else if (best(s) < now(seven[6])) out[s] = 'e'
    }
  }
  if (F.phase !== 'regular') for (const c of CONFS) for (const s of S.conf[c]) { const i = S.seeds[c].indexOf(s); out[s] = i === 0 ? 'z' : i > 0 && i < 4 ? 'y' : i >= 4 ? 'x' : 'e' }
  return out
}

// ── The playoffs ─────────────────────────────────────────────────────────────
// F.playoffs = { seeds: { AFC: [7], NFC: [7] }, alive: { AFC: [...], NFC: [...] }, rounds: [{ id, games: [{ h, a, hs, as, ot, conf }] }], champion }
export function startPlayoffs(F) {
  const S = standing(F)
  F.playoffs = { seeds: { AFC: [...S.seeds.AFC], NFC: [...S.seeds.NFC] }, alive: { AFC: [...S.seeds.AFC], NFC: [...S.seeds.NFC] }, champion: null, out: {} }
  setRound(F, 0)
}
// the games of a playoff round, into the schedule (weeks 19 to 22). The better seed is at home; the Super Bowl is neutral.
export function setRound(F, idx) {
  const po = F.playoffs, round = PLAYOFF_ROUNDS[idx], games = []
  const seedOf = (c, s) => po.seeds[c].indexOf(s) + 1
  if (round.id === 'sb') {
    const a = po.alive.AFC[0], n = po.alive.NFC[0]
    games.push(F.year % 2 === 0 ? { h: a, a: n, rd: 'sb', neutral: true } : { h: n, a, rd: 'sb', neutral: true })
  } else for (const c of CONFS) {
    const alive = [...po.alive[c]].sort((x, y) => seedOf(c, x) - seedOf(c, y))
    const play = round.id === 'wc' ? alive.slice(1) : alive
    for (let i = 0; i < play.length / 2; i++) games.push({ h: play[i], a: play[play.length - 1 - i], rd: round.id, conf: c })
  }
  F.sched.weeks[round.week - 1] = games
}
// after a playoff week: losers out, the next round set (or the champion crowned)
export function advancePlayoffs(F) {
  const po = F.playoffs, idx = PLAYOFF_ROUNDS.findIndex(r => r.week === F.week), round = PLAYOFF_ROUNDS[idx]
  for (const g of F.sched.weeks[round.week - 1]) {
    const loser = g.hs > g.as ? g.a : g.h, winner = g.hs > g.as ? g.h : g.a
    po.out[loser] = round.id
    for (const c of CONFS) po.alive[c] = po.alive[c].filter(s => s !== loser)
    if (round.id === 'sb') { po.champion = winner; po.runnerUp = loser; po.score = `${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}` }
  }
  if (round.id !== 'sb') setRound(F, idx + 1)
  return po.champion
}
export const playoffRoundOf = week => PLAYOFF_ROUNDS.find(r => r.week === week) ?? null
// how a team's season ended, in words
export function finishText(F, short) {
  const po = F.playoffs
  if (!po) return ''
  if (po.champion === short) return 'Won the Super Bowl'
  const out = po.out?.[short]
  if (out === 'sb') return 'Lost the Super Bowl'
  if (out === 'conf') return 'Lost the Conference Championship'
  if (out === 'div') return 'Lost the Divisional Round'
  if (out === 'wc') return 'Lost the Wild Card Round'
  return 'Missed the playoffs'
}
