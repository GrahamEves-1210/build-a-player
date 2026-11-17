// CAREER (football): the season's award races and the vote. MVP, Offensive and Defensive Player of the Year, the way
// the AP votes them, on the same scale Franchise votes them (lib/franchise2/awards.js): every man's season is read as
// a case at his position (lib/teamSeason.js fbCase: 1.0 is an All-Pro year there), and each ballot leans the way the
// voters have always leaned:
//   MVP   a quarterback on a winner nearly every year (since 2000, all but three; a back each of those). A back with
//         2,000 yards has won it about half the times there was one (Simpson, Davis, Peterson; Sanders shared it). A
//         receiver never has, a defender twice in the award's history (Page '71, Taylor '86, 20.5 sacks). Here a
//         historic season (a 2,000-yard back, a receiver past the record, a 20-sack edge) carries the voters' extra
//         notice, and only a season like that gets a non-quarterback near the top.
//   OPOY  backs and receivers most years, a quarterback now and then (usually the MVP: a man who won the MVP isn't on
//         this ballot first), never a lineman. A tight end's year is read on the receivers' scale, and still trails.
//         A receiver with 2,100 yards is past the record by a long way: the voters' notice puts him on top unless
//         somebody else had a season as historic.
//   DPOY  an edge rusher or an interior lineman with the sacks, a linebacker, a defensive back about one year in six.
// The league around him: every team's starters (lib/career.js leagueField), each with a season drawn from how good he
// is and how good his team is (seeded, the same for the whole season); the same men week by week, on their pace.
// The ballot: 50 voters, 10-5-4-3-1 (the AP's since 2022), each with his own read of the cases.
import { seeded } from './rng.js'
import { fbCase } from './teamSeason.js'

const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const gauss = r => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
const n0 = v => Math.round(v ?? 0).toLocaleString('en-US')
export const RACE_AWARDS = ['MVP', 'OPOY', 'DPOY']
export const RACE_NAME = { MVP: 'MVP', OPOY: 'OFFENSIVE PLAYER OF THE YEAR', DPOY: 'DEFENSIVE PLAYER OF THE YEAR', CPOY: 'COMEBACK PLAYER OF THE YEAR', SMOY: 'SIXTH MAN OF THE YEAR' }
export const RACE_SHORT = { MVP: 'MVP RACE', OPOY: 'OPOY RACE', DPOY: 'DPOY RACE' }
const OFFENSE = new Set(['qb', 'rb', 'wr', 'te']), DEFENSE = new Set(['edge', 'dt', 'lb', 'cb', 's'])
// the single-season records the voters notice (the NFL's, 2026)
export const RACE_RECORDS = { rushYds: 2105, recYds: 1964, sacks: 22.5, passTDs: 55, passYds: 5477, ints: 14 }

// ── A season's line, the way the broadcast reads it ──
export function raceLine(g, t) {
  const v = k => t?.[k] ?? 0
  switch (g) {
    case 'qb': return `${n0(v('py'))} YDS · ${v('ptd') + v('rtd')} TD · ${v('int')} INT`
    case 'rb': return `${n0(v('ry'))} RUSH YDS · ${v('rtd') + v('rctd')} TD`
    case 'wr': case 'te': return `${v('rc')} REC · ${n0(v('ryd'))} YDS · ${v('rctd')} TD`
    case 'edge': case 'dt': return `${Math.round(v('sck') * 2) / 2} SACKS · ${v('tfl')} TFL${v('ff') ? ` · ${v('ff')} FF` : ''}`
    case 'lb': return `${v('tk')} TKL · ${Math.round(v('sck') * 2) / 2} SACKS${v('dint') ? ` · ${v('dint')} INT` : ''}`
    default: return `${v('dint')} INT · ${v('pbu')} PD · ${v('tk')} TKL`
  }
}
// his Career line on the case's keys (lib/career.js seasonStats names)
export function caseKeys(pos, s = {}) {
  const v = k => s[k] ?? 0
  switch (pos) {
    case 'qb': return { py: v('passYds'), ptd: v('tds'), int: v('ints'), ry: v('rushYds'), rtd: v('rushTDs') }
    case 'rb': return { ry: v('rushYds'), ryd: v('recYds'), rtd: v('rushTDs') || Math.max(0, v('tds') - v('recTDs')), rctd: v('recTDs'), rc: v('recs') }
    case 'wr': case 'te': return { rc: v('recs') || v('rec'), ryd: v('recYds'), rctd: v('tds') || v('recTDs') }
    case 'dl': return { sck: v('sacks'), tfl: v('tfl'), ff: v('ff'), qbh: v('qbHits'), tk: v('tackles') }
    case 'lb': return { tk: v('tackles'), sck: v('sacks'), dint: v('ints'), tfl: v('tfl'), pbu: v('pds'), ff: v('ff') }
    case 'db': return { dint: v('ints'), pbu: v('pbus'), tk: v('tackles'), p6: v('pickSixes'), ff: v('ff'), tfl: v('tfl') }
    default: return {}
  }
}
const casePos = g => (g === 'edge' || g === 'dt' ? 'dl' : g === 'cb' || g === 's' ? 'db' : g)
// a season's case: 1.0 an All-Pro year at his spot (a tight end's on the receivers' scale, a step behind)
// (the Career engine's backs against the league's: an All-Pro back's case on the engine's scale, scripts/moments/awards-check.mjs)
const RB_SCALE = 1.4
function caseOf(g, t, wins, ovr = 85) {
  if (g === 'rb') { const c = fbCase({ pos: 'rb' }, t, wins); return c.v / (c.ap * RB_SCALE) + (ovr - 85) * 0.006 }
  if (g === 'te') { const c = fbCase({ pos: 'wr' }, t, wins); return c.v / c.ap + (ovr - 85) * 0.006 - 0.3 }
  const c = fbCase({ pos: casePos(g), sub: g === 'dt' ? 'dt' : undefined }, t, wins)
  return c.v / c.ap + (ovr - 85) * 0.006
}
// the voters' extra notice for a historic season (a record, or a number only a few have reached)
function historic(g, t) {
  const v = k => t?.[k] ?? 0
  if (g === 'rb') return (v('ry') >= 2000 ? 0.32 : v('ry') >= 1850 ? 0.12 : 0) + (v('ry') > RACE_RECORDS.rushYds ? 0.18 : 0) + (v('rtd') + v('rctd') > 28 ? 0.15 : 0)
  if (g === 'wr' || g === 'te') return (v('ryd') >= 1850 ? 0.18 : 0) + (v('ryd') > RACE_RECORDS.recYds ? 0.27 : 0) + (v('rctd') >= 20 ? 0.12 : 0)
  if (g === 'edge' || g === 'dt' || g === 'lb') return (v('sck') >= 20 ? 0.3 : v('sck') >= 18 ? 0.12 : 0) + (v('sck') > RACE_RECORDS.sacks ? 0.3 : 0)
  if (g === 'cb' || g === 's') return (v('dint') >= 11 ? 0.08 : 0) + (v('dint') > RACE_RECORDS.ints ? 0.3 : 0)
  if (g === 'qb') return (v('ptd') > RACE_RECORDS.passTDs ? 0.2 : 0) + (v('py') > RACE_RECORDS.passYds ? 0.1 : 0)
  return 0
}
// (each spot's ratings sit a little differently: a linebacker room grades higher than a secondary)
const CENTER = { qb: 84, rb: 84, wr: 86, te: 85, edge: 86.5, dt: 84.5, lb: 89.5, cb: 84, s: 84.5 }
const MVP_LEAN = { qb: 0.45, rb: 0.26, wr: -0.24, te: -0.5, edge: -0.75, dt: -0.75, lb: -0.85, cb: -0.95, s: -1 }
const OFF_LEAN = { rb: 0.02, wr: 0.08, te: 0, qb: -0.08 }
const DEF_LEAN = { edge: 0.08, dt: 0.08, lb: -0.06, cb: -0.1, s: -0.12 }
export const awardValue = {
  // (a back gets the voters' look only with a historic year: without one he's a step behind the quarterbacks)
  MVP: x => x.c + (x.w - 10) * 0.05 + (x.g === 'rb' && !x.h ? -0.05 : MVP_LEAN[x.g] ?? -1) + x.h * (x.g === 'qb' || x.g === 'rb' ? 1 : 0.7),
  OPOY: x => (OFFENSE.has(x.g) ? x.c + (OFF_LEAN[x.g] ?? 0) + x.h : null),
  DPOY: x => (DEFENSE.has(x.g) ? x.c + (DEF_LEAN[x.g] ?? 0) + x.h * 0.6 : null),
}

// ── The league's seasons ──
// field: [{ name, team, g (qb rb wr te edge dt lb cb s), ovr, legs (a quarterback's legs, 0-11), off, def (his team's
// rating, 1-10), str (his team: off + def) }]. Each man's whole season, healthy or not, his team's wins.
export function leagueSeasons(field, seed) {
  const r = seeded(`race-${seed}`)
  const meanStr = field.reduce((s, x) => s + x.str, 0) / Math.max(1, field.length)
  const winsOf = {}
  for (const x of field) if (winsOf[x.team] == null) winsOf[x.team] = clamp(Math.round(8.5 + (x.str - meanStr) * 0.9 + gauss(r) * 2.1), 2, 15)
  return field.map(x => {
    // (a starter's ovr, 70-99: the league's best at a spot are about two steps up. The lines are set so the league's
    // leaders look like the NFL's: about 1,750 receiving yards, 1,650 rushing, 40 touchdown passes, 18 sacks, 8 picks)
    const z = clamp((x.ovr - (CENTER[x.g] ?? 84)) / 7, -2.5, 2.3), n = () => gauss(r), off = 1 + ((x.off ?? 5.5) - 5.5) * 0.04
    // (one season in six he misses a stretch: three to eight games)
    const gp = r() < 0.16 ? 17 - (3 + Math.floor(r() * 6)) : 17, f = gp / 17
    const t = {}
    switch (x.g) {
      case 'qb': {
        const legs = clamp(((x.legs ?? 5) - 5) / 5, 0, 1.2)
        t.py = Math.round(f * off * (3650 + 380 * z + 330 * n() - 450 * legs)); t.ptd = Math.max(4, Math.round(f * off * (23.5 + 4.2 * z + 3.6 * n())))
        t.int = Math.max(2, Math.round(f * (11 - 1.4 * z + 2.6 * n()))); t.ry = Math.max(0, Math.round(f * (120 + 600 * legs + 100 * n()))); t.rtd = Math.max(0, Math.round(f * (1 + 5 * legs + 1.3 * n())))
        break
      }
      // (a back: the Career engine's own backs run bigger than the league's, 1,450 yards and 17 touchdowns at a 91, so the
      // league's backs here are on the engine's scale, and the ballot reads a back's case on that scale: RB_SCALE)
      case 'rb': { const td = Math.max(1, f * off * (13.9 + 3.5 * z + 3 * n())); t.ry = Math.round(f * off * (1155 + 300 * z + 180 * n())); t.ryd = Math.max(60, Math.round(f * (430 + 105 * z + 115 * n()))); t.rtd = Math.round(td * 0.85); t.rctd = Math.round(td * 0.15); t.rc = Math.round(t.ryd / 8.5); break }
      case 'wr': t.rc = Math.max(20, Math.round(f * off * (80 + 9 * z + 9 * n()))); t.ryd = Math.round(f * off * (1050 + 170 * z + 160 * n())); t.rctd = Math.max(1, Math.round(f * off * (7 + 2 * z + 2.3 * n()))); break
      case 'te': t.rc = Math.max(15, Math.round(f * off * (62 + 8 * z + 8 * n()))); t.ryd = Math.round(f * off * (700 + 140 * z + 130 * n())); t.rctd = Math.max(0, Math.round(f * off * (5 + 1.8 * z + 2 * n()))); break
      case 'edge': t.sck = Math.max(1, Math.round(2 * f * (8.7 + 2.5 * z + 2.4 * n())) / 2); t.tfl = Math.max(2, Math.round(f * (11.5 + 2.5 * z + 2.8 * n()))); t.ff = Math.max(0, Math.round(f * (1.8 + 1.1 * n()))); t.qbh = Math.round(f * (18 + 4.5 * z + 4.5 * n())); t.tk = Math.round(f * (45 + 8 * n())); break
      case 'dt': t.sck = Math.max(0, Math.round(2 * f * (5 + 1.8 * z + 2 * n())) / 2); t.tfl = Math.max(1, Math.round(f * (9.5 + 2.2 * z + 2.4 * n()))); t.ff = Math.max(0, Math.round(f * (1.1 + n()))); t.qbh = Math.round(f * (14 + 3.5 * z + 4 * n())); t.tk = Math.round(f * (45 + 8 * n())); break
      case 'lb': t.tk = Math.round(f * (105 + 12 * z + 13 * n())); t.sck = Math.max(0, Math.round(2 * f * (2.5 + 1.2 * z + 1.8 * n())) / 2); t.dint = Math.max(0, Math.round(f * (0.9 + 0.4 * z + 1 * n()))); t.tfl = Math.max(1, Math.round(f * (8 + 1.8 * z + 2.4 * n()))); t.pbu = Math.max(0, Math.round(f * (4.5 + 1.3 * z + 1.8 * n()))); t.ff = Math.max(0, Math.round(f * (1.1 + n()))); break
      default: t.dint = Math.max(0, Math.round(f * (2.9 + 1.05 * z + 1.4 * n()))); t.pbu = Math.max(2, Math.round(f * (11.5 + 2.6 * z + 2.8 * n()))); t.tk = Math.round(f * (62 + 10 * n())); t.p6 = r() < 0.1 + 0.04 * z ? 1 : 0; t.ff = Math.max(0, Math.round(f * (0.8 + 0.8 * n()))); t.tfl = Math.max(0, Math.round(f * (2.5 + 1.2 * n()))); break
    }
    // (his weekly pace: a season isn't a straight line, the leaders trade places)
    const wob = Array.from({ length: 17 }, () => 0.75 + 0.5 * r())
    // (back: he missed most of last season hurt, nine games or more: about one starter in sixteen, the Comeback ballot's men)
    const back = r() < 0.06
    return { ...x, t, gp, w: winsOf[x.team], wob, back }
  })
}
// a man's line through k of 17 games (his own pace, the season's total at the end)
function lineAt(x, k) {
  if (k >= 17) return x.t
  const done = x.wob.slice(0, k).reduce((s, v) => s + v, 0), all = x.wob.reduce((s, v) => s + v, 0)
  const share = done / all, out = {}
  for (const [key, v] of Object.entries(x.t)) out[key] = key === 'sck' ? Math.round(v * share * 2) / 2 : Math.round(v * share)
  return out
}
const proj = (t, k) => { if (k >= 17 || k <= 0) return t; const m = 17 / k, out = {}; for (const [key, v] of Object.entries(t)) out[key] = v * m; return out }
const case17 = (g, t, k, w, ovr) => { const p = proj(t, k); return { c: caseOf(g, p, w, ovr), h: historic(g, p) } }

// The races through k games: { MVP: [rows], OPOY, DPOY } each ranked by the pace each man is on, his place in each.
// me: { name, team, g, ovr, t (his line so far, case keys), k (his games so far), w (team wins on pace), share (the
// share of the games he played: the voters want twelve of seventeen), gate / lock ({ MVP, OPOY }: the owner's rules,
// lib/career.js raceMe: false, a season that can't win it; true, one nobody out-votes) }
export function racesAt(seasons, me, k, opts = {}) {
  const total = opts.total ?? 17
  const kk = Math.max(1, Math.min(total, k))
  const rows = seasons.map(x => {
    // (on the pace of his team's games: the ones he missed count against it; at the end, what he put up, and the voters
    // want twelve games of it)
    const t = lineAt(x, kk)
    const { c, h } = case17(x.g, t, kk, x.w, x.ovr)
    return { name: x.name, team: x.team, g: x.g, t, c: c * (kk >= total ? Math.min(1, x.gp / 12) : 1), h, w: x.w, line: raceLine(x.g, t) }
  })
  const mine = me ? (() => { const { c, h } = case17(me.g, me.t, Math.max(1, me.k), me.w, me.ovr); return { name: me.name, team: me.team, g: me.g, t: me.t, c: c * (me.share ?? 1), h, w: me.w, line: raceLine(me.g, me.t), me: true } })() : null
  const out = {}
  for (const A of RACE_AWARDS) {
    const list = [...rows, ...(mine ? [mine] : [])].map(x => ({ ...x, v: awardValue[A](x) })).filter(x => x.v != null)
    list.sort((a, b) => b.v - a.v)
    // (the owner's rules on top: a season short of the bar can't be first, the best rival's case is ahead of his
    // (gate[A] false: a quarterback's MVP bar, lib/career.js); one that clears a lock can't be out-voted)
    if (mine && me.gate?.[A] === false && list[0]?.me && list.length > 1) { const m = list.shift(); list.splice(1, 0, { ...m, v: list[0].v - 0.001 }) }
    if (mine && me.lock?.[A] && !list[0]?.me) { const i = list.findIndex(x => x.me); if (i > 0) { const m = list.splice(i, 1)[0]; list.unshift({ ...m, v: (list[0]?.v ?? 0) + 0.001 }) } }
    out[A] = list
  }
  // (the OPOY's first: the MVP's winner is on that ballot too, the voters just rarely give a man both)
  return out
}
// The vote, at the end of the regular season: 50 ballots, each man's case through each voter's own eyes, 10-5-4-3-1.
// Returns { [award]: { rows: [{ name, team, g, line, pts, first, me }] (the top ten), place (his), pts } }
export function seasonVote(seasons, me, seed) {
  const R = racesAt(seasons, me, 17)
  const r = seeded(`vote-${seed}`)
  const out = {}
  for (const A of RACE_AWARDS) {
    const list = R[A].slice(0, 14)
    const pts = list.map(() => 0), first = list.map(() => 0)
    const spread = A === 'MVP' ? 0.07 : 0.09
    for (let v = 0; v < 50; v++) {
      const ballot = list.map((x, i) => [i, x.v + spread * gauss(r)]).sort((a, b) => b[1] - a[1]).slice(0, 5)
      ballot.forEach(([i], j) => { pts[i] += [10, 5, 4, 3, 1][j]; if (j === 0) first[i]++ })
    }
    let rows = list.map((x, i) => ({ name: x.name, team: x.team, g: x.g, line: x.line, pts: pts[i], first: first[i], me: !!x.me, v: x.v }))
    rows.sort((a, b) => b.pts - a.pts || b.v - a.v)
    // (the owner's rules hold on the ballot too: a season short of the bar isn't first, a locked one is)
    if (me) {
      const i = rows.findIndex(x => x.me)
      if (i === 0 && me.gate?.[A] === false && rows.length > 1) { const a = rows[0], b = rows[1]; rows[0] = { ...b, pts: Math.max(a.pts, b.pts), first: Math.max(a.first, b.first) }; rows[1] = { ...a, pts: Math.min(a.pts, b.pts), first: Math.min(a.first, b.first) } }
      if (i > 0 && me.lock?.[A]) { const m = rows.splice(i, 1)[0], top = rows[0]; rows.unshift({ ...m, pts: Math.max(m.pts, top.pts + 3), first: Math.max(m.first, top.first + 1) }) }
    }
    const place = rows.findIndex(x => x.me) + 1
    out[A] = { rows: rows.slice(0, 10).map(({ v, ...x }) => { void v; return x }), place: place || null, pts: place ? rows[place - 1].pts : 0 }
  }
  // (one man, two awards: the MVP winner is rarely the OPOY too. Only a season far past the field's keeps both)
  const m = out.MVP.rows[0], o = out.OPOY.rows[0]
  if (m && o && m.name === o.name && m.team === o.team && out.OPOY.rows[1]) {
    const gap = (R.OPOY[0]?.v ?? 0) - (R.OPOY[1]?.v ?? 0)
    if (gap < 0.35 && !(o.me && me?.lock?.OPOY)) {
      const [a, b] = out.OPOY.rows
      out.OPOY.rows[0] = { ...b, pts: a.pts, first: a.first }; out.OPOY.rows[1] = { ...a, pts: b.pts, first: b.first }
      const at = out.OPOY.rows.findIndex(x => x.me)
      if (at >= 0) { out.OPOY.place = at + 1; out.OPOY.pts = out.OPOY.rows[at].pts }
    }
  }
  return out
}

// ── Comeback Player of the Year (football) ──
// The owner (2026-11-16): a great year after a year that injuries took most of, never a bad one and never a comeback from
// retirement. On the ballot only a man who missed nine games or more last season through injury (me.back, lib/career.js;
// the league's men: back), with a season at least CPOY_BAR on the case scale (a Pro Bowl year is about 0.76, an All-Pro
// one 1.0). The best case wins it; with nobody there, nobody does, the way some years go. Returns null (nobody on the
// ballot) or { rows (the top five), place, pts }.
export const CPOY_BAR = 0.75
export function comebackVote(seasons, me, seed) {
  const R = racesAt(seasons, me, 17)
  const pool = R.MVP.concat(R.OPOY ?? [], R.DPOY ?? [])
  const seen = new Set(), list = []
  for (const x of pool) { const k = `${x.name}|${x.team}`; if (seen.has(k)) continue; seen.add(k); const back = x.me ? !!me?.back : !!seasons.find(y => y.name === x.name && y.team === x.team)?.back; if (back && x.c >= CPOY_BAR) list.push({ ...x, v: x.c + (x.w - 9) * 0.02 }) }
  if (!list.length) return null
  list.sort((a, b) => b.v - a.v)
  return ballot(list, seed, 0.06, 5)
}
// 50 ballots, 10-5-4-3-1, each voter with his own read of the cases (spread)
function ballot(list0, seed, spread, keep = 10) {
  const r = seeded(`vote-${seed}`), list = list0.slice(0, 14)
  const pts = list.map(() => 0), first = list.map(() => 0)
  for (let v = 0; v < 50; v++) list.map((x, i) => [i, x.v + spread * gauss(r)]).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([i], j) => { pts[i] += [10, 5, 4, 3, 1][j]; if (j === 0) first[i]++ })
  const rows = list.map((x, i) => ({ name: x.name, team: x.team, g: x.g, line: x.line, pts: pts[i], first: first[i], me: !!x.me, v: x.v })).sort((a, b) => b.pts - a.pts || b.v - a.v)
  const place = rows.findIndex(x => x.me) + 1
  return { rows: rows.slice(0, keep).map(({ v, ...x }) => { void v; return x }), place: place || null, pts: place ? rows[place - 1].pts : 0 }
}

// ── Sixth Man of the Year (basketball) ──
// The best season off the bench: more games coming off it than starting, 65 games at least. Points first, then the rest of
// the line and the team (real winners since 2010: about 17 a game, 13 to 23; a 13-15 scorer on a playoff team takes it in a
// thin year, a 20-a-night bench scorer nearly always). The league's reserves: every team's best man off the bench
// (lib/career.js), each with a season drawn from how good he is, so the player is never handed it.
export const smoyScore = x => x.ppg + 0.3 * x.rpg + 0.45 * x.apg + 0.5 * ((x.spg ?? 0.8) + (x.bpg ?? 0.4)) + (x.w - 41) * 0.05
export function reserveSeasons(field, seed) {
  const r = seeded(`bench-${seed}`)
  const mid = field.reduce((s, x) => s + x.ovr, 0) / Math.max(1, field.length)
  return field.map(x => {
    const n = () => gauss(r), big = x.g === 'big', d = (x.ovr - mid) / 4
    const ppg = Math.max(4, 10.2 + 1.7 * d + 3.2 * n()), rpg = Math.max(1, (big ? 6 : 3.2) + 0.6 * d + 1.2 * n()), apg = Math.max(0.4, (big ? 1.6 : 3) + 0.4 * d + 1 * n())
    const gp = r() < 0.22 ? 82 - (8 + Math.floor(r() * 30)) : 78 + Math.floor(r() * 5)
    const w = Math.max(15, Math.min(66, Math.round(41 + (x.str - 11) * 4.5 + 7 * n())))
    const t = { ppg: Math.round(ppg * 10) / 10, rpg: Math.round(rpg * 10) / 10, apg: Math.round(apg * 10) / 10, spg: Math.round(Math.max(0.2, 0.8 + 0.3 * n()) * 10) / 10, bpg: Math.round(Math.max(0, (big ? 0.8 : 0.3) + 0.3 * n()) * 10) / 10 }
    return { ...x, ...t, gp, w }
  })
}
export const benchLine = x => `${x.ppg} PPG · ${x.rpg} RPG · ${x.apg} APG`
// me: { name, team, g, ppg, rpg, apg, spg, bpg, w, gp, starts } (on the ballot only off the bench, 65 games or more)
export function sixthVote(seasons, me, seed) {
  const ok = x => (x.gp ?? 0) >= 65 && (x.starts ?? 0) * 2 < (x.gp ?? 0)
  const list = [...seasons.filter(ok).map(x => ({ ...x, starts: 0 })), ...(me && ok(me) ? [{ ...me, me: true }] : [])].map(x => ({ ...x, line: benchLine(x), v: smoyScore(x) })).sort((a, b) => b.v - a.v)
  return list.length ? ballot(list, seed, 0.9, 10) : null
}
