// FRANCHISE: the standings and the playoff field.
// Records come from the schedule's scores, so they can't drift. Ties in the standings go the NFL's way, kept
// simple: head to head, the division record (inside a division), the conference record, point difference, a coin.
// Seven a conference: the four division winners seeded 1–4 by record, then the three best of the rest.
import { SHORTS } from './league'
import { DIVISIONS, DIV_OF, CONF_OF, CONFS } from './schedule'
import { roll } from './rng'

const blank = () => ({ w: 0, l: 0, t: 0, pf: 0, pa: 0, dw: 0, dl: 0, dt: 0, cw: 0, cl: 0, ct: 0, vs: {}, strk: 0 })
export const pct = r => (r.w + r.l + r.t ? (r.w + r.t / 2) / (r.w + r.l + r.t) : 0)
export const recText = r => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`
export function records(F) {
  const R = Object.fromEntries(SHORTS.map(s => [s, blank()]))
  for (const games of F.sched.weeks) for (const g of games) {
    if (g.hs == null) continue
    const div = DIV_OF[g.h] === DIV_OF[g.a], conf = CONF_OF[g.h] === CONF_OF[g.a]
    const put = (s, o, f, a) => {
      const X = R[s], k = f > a ? 'w' : f < a ? 'l' : 't'
      X[k]++; X.pf += f; X.pa += a
      if (div) X[`d${k}`]++
      if (conf) X[`c${k}`]++
      const v = (X.vs[o] ??= [0, 0]); if (k === 'w') v[0]++; else if (k === 'l') v[1]++
      X.strk = k === 'w' ? Math.max(0, X.strk) + 1 : k === 'l' ? Math.min(0, X.strk) - 1 : 0
    }
    put(g.h, g.a, g.hs, g.as); put(g.a, g.h, g.as, g.hs)
  }
  return R
}
function h2h(R, group, s) {
  let w = 0, l = 0
  for (const o of group) if (o !== s && R[s].vs[o]) { w += R[s].vs[o][0]; l += R[s].vs[o][1] }
  return w + l ? w / (w + l) : 0.5
}
function breakTie(R, seed, group, sameDiv) {
  if (group.length <= 1) return group
  const steps = [
    s => h2h(R, group, s),
    ...(sameDiv ? [s => pct({ w: R[s].dw, l: R[s].dl, t: R[s].dt })] : []),
    s => pct({ w: R[s].cw, l: R[s].cl, t: R[s].ct }),
    s => R[s].pf - R[s].pa,
    s => roll(`${seed}-coin-${s}`),
  ]
  for (const f of steps) {
    const v = Object.fromEntries(group.map(s => [s, f(s)]))
    const best = Math.max(...group.map(s => v[s]))
    const top = group.filter(s => v[s] === best)
    if (top.length < group.length) return [...breakTie(R, seed, top, sameDiv), ...breakTie(R, seed, group.filter(s => !top.includes(s)), sameDiv)]
  }
  return group
}
function order(R, seed, list, sameDiv) {
  const by = [...list].sort((a, b) => pct(R[b]) - pct(R[a]))
  const out = []
  for (let i = 0; i < by.length;) {
    let j = i
    while (j < by.length && Math.abs(pct(R[by[j]]) - pct(R[by[i]])) < 1e-9) j++
    out.push(...breakTie(R, seed, by.slice(i, j), sameDiv))
    i = j
  }
  return out
}
// { div: { name: [4 in order] }, seeds: { AFC: [7], NFC: [7] }, conf: { AFC: [16], NFC: [16] }, R }
export function standings(F) {
  const R = records(F), seed = `${F.seed}-${F.year}`
  const div = {}, seeds = {}, conf = {}
  for (const d of DIVISIONS) div[d.name] = order(R, seed, d.teams, true)
  for (const c of CONFS) {
    const winners = order(R, seed, DIVISIONS.filter(d => d.conf === c).map(d => div[d.name][0]), false)
    const rest = order(R, seed, SHORTS.filter(s => CONF_OF[s] === c && !winners.includes(s)), false)
    seeds[c] = [...winners, ...rest.slice(0, 3)]
    conf[c] = [...winners, ...rest]
  }
  return { div, seeds, conf, R }
}

// ── The playoffs ─────────────────────────────────────────────────────────────
// F.po = { seeds: { AFC, NFC }, alive: { AFC, NFC }, rd: 0..3, rounds: [[{ h, a, hs, as, ot, c }]], champ, out: { short: round } }
export const ROUNDS = ['WILD CARD', 'DIVISIONAL', 'CONFERENCE', 'SUPER BOWL']
export const ROUND_NAME = ['Wild Card', 'Divisional Round', 'Conference Championship', 'Super Bowl']
export function startPlayoffs(F) {
  const S = standings(F)
  F.po = { seeds: { AFC: [...S.seeds.AFC], NFC: [...S.seeds.NFC] }, alive: { AFC: [...S.seeds.AFC], NFC: [...S.seeds.NFC] }, rd: 0, rounds: [], champ: null, out: {} }
  setRound(F)
}
// The round's games: the 1 seed sits out the Wild Card (2 v 7, 3 v 6, 4 v 5); after it the top seed left plays the
// lowest left (re-seeding), the better seed at home; the Super Bowl at a neutral site
export function setRound(F) {
  const po = F.po, games = []
  const seedOf = (c, s) => po.seeds[c].indexOf(s)
  if (po.rd === 3) games.push({ h: po.alive.AFC[0], a: po.alive.NFC[0], c: 'SB', n: 1 })
  else for (const c of CONFS) {
    const alive = [...po.alive[c]].sort((x, y) => seedOf(c, x) - seedOf(c, y))
    const play = po.rd === 0 ? alive.slice(1) : alive
    for (let i = 0; i < play.length / 2; i++) games.push({ h: play[i], a: play[play.length - 1 - i], c })
  }
  po.rounds[po.rd] = games
}
export function endRound(F) {
  const po = F.po
  for (const g of po.rounds[po.rd]) {
    const win = g.hs > g.as ? g.h : g.a, lose = win === g.h ? g.a : g.h
    po.out[lose] = po.rd
    for (const c of CONFS) po.alive[c] = po.alive[c].filter(s => s !== lose)
    if (po.rd === 3) { po.champ = win; po.runner = lose; po.score = `${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}` }
  }
  if (po.rd < 3) { po.rd++; setRound(F) }
}
// how a team's year ended: 'champ', 'sb', 'conf', 'div', 'wc' (lost in that round), 'out' (missed)
export function finishOf(F, s) {
  const po = F.po
  if (!po) return 'out'
  if (po.champ === s) return 'champ'
  if (po.out[s] == null) return po.seeds.AFC.includes(s) || po.seeds.NFC.includes(s) ? 'alive' : 'out'
  return ['wc', 'div', 'conf', 'sb'][po.out[s]]
}
export const FINISH_TEXT = { champ: 'SUPER BOWL CHAMPIONS', sb: 'LOST THE SUPER BOWL', conf: 'LOST THE CONFERENCE TITLE', div: 'LOST IN THE DIVISIONAL', wc: 'LOST IN THE WILD CARD', out: 'MISSED THE PLAYOFFS', alive: 'IN THE PLAYOFFS' }
