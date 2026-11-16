// FRANCHISE: the season's honors, the NFL's own, voted on the season each man had (his real box-score totals,
// lib/franchise2/stats.js) and how his team did.
//   MVP · Offensive / Defensive Player of the Year · Offensive / Defensive Rookie of the Year · Coach of the Year
//   AP All-Pro (the first team, the best at each spot league-wide) · the Pro Bowl (each conference's best)
// closeSeason(F) keeps the season: the wall's banner, the league's history (every team's record, the awards),
// the builds' careers, and a career line for every man who's on the player's team or earned a mention.
import { TEAM, SHORTS, OFFENSE, lineup, strength } from './league'
import { DIVISIONS, CONF_OF } from './schedule'
import { standings, finishOf } from './standings'
import { groupOf } from './roster'
import { leagueStats, whoIs } from './stats'
import { coachOf } from './coach'
import { openCarousel } from './carousel'
import { lastSeason } from './lastSeason'
import { fbCase } from '../teamSeason'
import { rngOf } from './rng'

export const AWARD_NAME = { MVP: 'MOST VALUABLE PLAYER', OPOY: 'OFFENSIVE PLAYER OF THE YEAR', DPOY: 'DEFENSIVE PLAYER OF THE YEAR', OROY: 'OFFENSIVE ROOKIE OF THE YEAR', DROY: 'DEFENSIVE ROOKIE OF THE YEAR', COY: 'COACH OF THE YEAR' }
export const AWARD_SHORT = { MVP: 'MVP', OPOY: 'OFF. PLAYER OF THE YEAR', DPOY: 'DEF. PLAYER OF THE YEAR', OROY: 'OFF. ROOKIE OF THE YEAR', DROY: 'DEF. ROOKIE OF THE YEAR', COY: 'COACH OF THE YEAR' }

// ── A season's line, the way the broadcast reads it ──────────────────────────
const n = v => Math.round(v ?? 0).toLocaleString('en-US')
export function statLine(p, t = {}) {
  const g = k => t?.[k] ?? 0
  switch (p.p) {
    case 'qb': return `${n(g('py'))} YDS · ${g('ptd')} TD · ${g('int')} INT`
    case 'rb': return `${n(g('ry'))} YDS · ${g('rtd') + g('rctd')} TD${g('rc') >= 30 ? ` · ${g('rc')} REC` : ''}`
    case 'wr': case 'te': return `${g('rc')} REC · ${n(g('ryd'))} YDS · ${g('rctd')} TD`
    case 'dl': return `${g('sck')} SACKS · ${g('tfl')} TFL`
    case 'lb': return `${g('tk')} TKL · ${g('sck')} SACKS${g('dint') ? ` · ${g('dint')} INT` : ''}`
    case 'db': return `${g('dint')} INT · ${g('pbu')} PD · ${g('tk')} TKL`
    case 'ol': return `${g('gp')} STARTS · ${g('sa')} SACKS ALLOWED`
    default: return ''
  }
}
// the three numbers a career line keeps, by position
export const CAREER_KEYS = { qb: ['py', 'ptd', 'int'], rb: ['ry', 'rtd', 'ryd'], wr: ['rc', 'ryd', 'rctd'], te: ['rc', 'ryd', 'rctd'], ol: ['sa', 'pnk', 'sn'], dl: ['sck', 'tfl', 'tk'], lb: ['tk', 'sck', 'dint'], db: ['dint', 'pbu', 'tk'] }
export const CAREER_LABEL = { py: 'YDS', ptd: 'TD', int: 'INT', ry: 'YDS', rtd: 'TD', ryd: 'REC YDS', rc: 'REC', rctd: 'TD', sa: 'SACKS ALLOWED', pnk: 'PANCAKES', sn: 'SNAPS', sck: 'SACKS', tfl: 'TFL', tk: 'TKL', dint: 'INT', pbu: 'PD' }

// ── The voting ───────────────────────────────────────────────────────────────
// his case, on one scale for every spot: 1.0 is an All-Pro season at his position (lib/teamSeason fbCase)
function caseOf(p, t, wins) {
  if (!t?.gp) return 0
  const c = fbCase({ pos: p.p, sub: groupOf(p) === 'dt' ? 'dt' : undefined }, t, wins)
  return c.v / c.ap + (p.o - 85) * 0.006
}
// the All-Pro team's spots (the AP's first team) and each conference's Pro Bowl roster
const SPOTS = [['qb', 1, 3], ['rb', 1, 3], ['wr', 3, 4], ['te', 1, 2], ['ot', 2, 3], ['og', 2, 3], ['c', 1, 2], ['edge', 2, 3], ['dt', 2, 3], ['lb', 2, 3], ['cb', 2, 4], ['s', 2, 3]]
const spotOf = p => (p.p === 'ol' ? (p.s === 'C' ? 'c' : p.s === 'LG' || p.s === 'RG' ? 'og' : 'ot') : groupOf(p))

export function seasonAwards(F) {
  const S = standings(F), R = rngOf(`${F.seed}-${F.year}-awards`)
  const tot = leagueStats(F), who = whoIs(F)
  const wins = s => S.R[s].w
  const men = []
  for (const s of SHORTS) for (const p of F.teams[s].r) {
    const t = tot[String(p.i)]
    if (!t?.gp || t.gp < 8 || p.fl) continue   // (a filler backup is never on a ballot)
    men.push({ p, s, t, c: caseOf(p, t, wins(s)) + R.n() * 0.03 })
  }
  const pick = x => x && { i: x.p.i, n: x.p.n, t: x.s, p: x.p.p, b: x.p.b ?? null, line: statLine(x.p, x.t) }
  const best = (list, v = x => x.c) => list.map(x => [x, v(x)]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  // the MVP: a quarterback on a winner nearly every year, unless someone else's season was bigger
  // (since 2000 the voters have picked a quarterback all but three times, a back each of those; a defender once
  // in the award's history: a defender here needs a season far past an All-Pro's)
  const mvp = best(men.filter(x => (OFFENSE.includes(x.p.p) && x.p.p !== 'ol') || x.c > 2.2), x => x.c + (wins(x.s) - 10) * 0.05 + (x.p.p === 'qb' ? 0.45 : x.p.p === 'rb' ? 0 : OFFENSE.includes(x.p.p) ? -0.15 : -0.9))
  const opoy = best(men.filter(x => OFFENSE.includes(x.p.p) && x.p.p !== 'ol' && x.p.i !== mvp?.p.i), x => x.c - (x.p.p === 'qb' ? 0.2 : 0))
  const dpoy = best(men.filter(x => !OFFENSE.includes(x.p.p)), x => x.c + (x.p.p === 'dl' ? 0.05 : 0))
  const rookie = x => x.p.rk === F.year
  const oroy = best(men.filter(x => rookie(x) && OFFENSE.includes(x.p.p) && x.p.p !== 'ol'))
  const droy = best(men.filter(x => rookie(x) && !OFFENSE.includes(x.p.p)))
  // the coach: the biggest turnaround, among the winners
  const before = s => F.lh?.length ? lhRow(F.lh[F.lh.length - 1], s)?.[0] ?? 8 : lastSeason(s)?.w ?? 8
  const coy = [...SHORTS].filter(s => wins(s) >= 10).sort((a, b) => (wins(b) - before(b)) * 1 + wins(b) * 0.5 - ((wins(a) - before(a)) + wins(a) * 0.5))[0] ?? null
  // All-Pro and the Pro Bowl
  const hon = {}, ap = []
  for (const [spot, nAP, nPB] of SPOTS) {
    const at = men.filter(x => spotOf(x.p) === spot).sort((a, b) => b.c - a.c)
    at.slice(0, nAP).forEach(x => { hon[x.p.i] = 'AP'; ap.push({ spot, ...pick(x) }) })
    for (const c of ['AFC', 'NFC']) at.filter(x => CONF_OF[x.s] === c).slice(0, nPB).forEach(x => { hon[x.p.i] ??= 'PB' })
  }
  void who
  return {
    y: F.year, mvp: pick(mvp), opoy: pick(opoy), dpoy: pick(dpoy), oroy: pick(oroy), droy: pick(droy),
    coy: coy && { t: coy, n: coachOf(F, coy).name ?? `${TEAM[coy].nick} coach`, w: wins(coy), was: before(coy), mine: coy === F.team },
    hon, ap,
  }
}
export const AWARD_KEYS = ['mvp', 'opoy', 'dpoy', 'oroy', 'droy']
export function lhRow(h, s) {
  if (!h?.r) return null
  if (typeof h.r === 'object') return h.r[s] ?? null
  const i = SHORTS.indexOf(s), part = h.r.split(' ')[i]
  return part ? part.split('-').map(Number) : null
}
const CODE = { mvp: 'MVP', opoy: 'OPOY', dpoy: 'DPOY', oroy: 'OROY', droy: 'DROY' }

// ── The season, kept ─────────────────────────────────────────────────────────
// F.lh: the league's seasons [{ y, r: 'w-l-t-finish' for each team in SHORTS order, one string, champ, runner, score,
//   dw: the division winners, aw: { MVP: [name, team, pos, line] … } }]; lhRow(h, s) reads a team's [w, l, t, finish]
// p.cr: a man's career [[year, team, games, a, b, c (CAREER_KEYS), honor (1 Pro Bowl, 2 All-Pro), award codes]]
export function closeSeason(F) {
  const S = standings(F), r = S.R[F.team]
  const aw = seasonAwards(F)
  F.aw = aw
  const fin = finishOf(F, F.team)
  const seedOf = s => (F.po.seeds.AFC.indexOf(s) + 1 || F.po.seeds.NFC.indexOf(s) + 1 || null)
  const t = F.teams[F.team]
  const divName = DIVISIONS.find(d => d.teams.includes(F.team)).name
  const banner = { y: F.year, w: r.w, l: r.l, t: r.t, pf: r.pf, pa: r.pa, fin, seed: seedOf(F.team), ovr: strength(F, F.team).ovr, champ: F.po.champ, mvp: aw.mvp && { n: aw.mvp.n, t: aw.mvp.t }, div: S.div[divName][0] === F.team ? 1 : 0, stars: [] }
  const awardOf = id => AWARD_KEYS.filter(k => aw[k]?.i === id).map(k => CODE[k])
  for (const k of AWARD_KEYS) if (aw[k]?.t === F.team) banner.stars.push({ aw: CODE[k], n: aw[k].n, b: aw[k].b })
  if (aw.coy?.mine) banner.stars.push({ aw: 'COY', n: aw.coy.n })
  banner.ap = Object.entries(aw.hon).filter(([id, h]) => h === 'AP' && t.r.some(p => String(p.i) === id)).length
  // the league's history: every team's year in a line
  const fcode = s => ({ champ: 6, sb: 5, conf: 4, div: 3, wc: 2 }[finishOf(F, s)] ?? (S.div[DIVISIONS.find(d => d.teams.includes(s)).name][0] === s ? 1 : 0))
  F.lh = [...(F.lh ?? []), {
    y: F.year, r: SHORTS.map(s => `${S.R[s].w}-${S.R[s].l}-${S.R[s].t}-${fcode(s)}`).join(' '), champ: F.po.champ, runner: F.po.runner, score: F.po.score,
    dw: DIVISIONS.map(d => S.div[d.name][0]),
    aw: Object.fromEntries([...AWARD_KEYS.filter(k => aw[k]).map(k => [CODE[k], [aw[k].n, aw[k].t, aw[k].p, aw[k].line]]), ...(aw.coy ? [['COY', [aw.coy.n, aw.coy.t]]] : [])]),
  }]
  // careers: the player's team's men, and anyone the league noticed (an award, an honor, a top-ten season)
  const tot = leagueStats(F)
  const top = new Set()
  for (const k of ['py', 'ptd', 'ry', 'ryd', 'rc', 'sck', 'dint', 'tk']) Object.entries(tot).filter(([, x]) => x[k]).sort((a, b) => b[1][k] - a[1][k]).slice(0, 3).forEach(([id]) => top.add(id))
  for (const s of SHORTS) for (const p of F.teams[s].r) {
    const id = String(p.i), st = tot[id]
    if (!st?.gp) continue
    if (!(s === F.team || aw.hon[p.i] === 'AP' || awardOf(p.i).length || top.has(id) || p.cr)) continue
    const keys = CAREER_KEYS[p.p] ?? []
    const row = [F.year, s, st.gp, ...keys.map(k => st[k] ?? 0), aw.hon[p.i] === 'AP' ? 2 : aw.hon[p.i] === 'PB' ? 1 : 0]
    const a = awardOf(p.i)
    if (a.length) row.push(a.join(','))
    p.cr = [...(p.cr ?? []), row].slice(-10)
  }
  // the franchise's one-season records (kept here: a man's career lines go when he retires)
  F.frec = F.frec ?? {}
  for (const k of ['py', 'ptd', 'ry', 'ryd', 'rc', 'sck', 'dint', 'tk']) for (const p of t.r) {
    const v = tot[String(p.i)]?.[k] ?? 0
    if (v > 0 && v > (F.frec[k]?.[0] ?? 0)) F.frec[k] = [v, p.n, F.year]
  }
  // each build's season on his career
  for (const p of t.r) if (p.b != null) {
    const B = F.builds[p.b], st = tot[String(p.i)] ?? {}
    B.car.push({ y: F.year, o: p.o, gp: st.gp ?? 0, st: Object.fromEntries((CAREER_KEYS[p.p] ?? []).concat(p.p === 'qb' ? ['ry', 'rtd'] : p.p === 'rb' ? ['rc', 'rctd'] : []).filter(k => st[k]).map(k => [k, st[k]])), aw: awardOf(p.i)[0] ?? null, hon: aw.hon[p.i] ?? null, ring: F.po.champ === F.team ? 1 : 0 })
  }
  F.hist.push(banner)
  if (F.po.champ === F.team) F.rings = (F.rings ?? 0) + 1
  // (the offseason opens with the coaching carousel, the NFL's Black Monday: carousel.js; then the awards)
  F.phase = 'off'; F.stage = 'awards'
  openCarousel(F)
  void lineup
  return banner
}
