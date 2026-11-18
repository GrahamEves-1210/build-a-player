// FRANCHISE: the wire. What a beat writer files: the scores, the big games, injuries, signings, streaks, records,
// clinches, awards, retirements. Facts, few words, the way a league's wire reads ("Bills 27, Jets 20"; "Chiefs place
// WR Rashee Rice on injured reserve (knee)"; "Bijan Robinson: 187 yards, 2 TD in a 31-17 win over the Saints").
//
//   wire(F, { n })    the latest items, newest first: { k, tag, s (team), text, wk, y, big (a headline) }
//   tickerItems(F)    the hub's ticker: the week's other scores and what's new on the wire (lib Ticker's items)
//   addNews(F, item)  anything that happens, filed as it happens: kept in F.news (this league year and the last)
//   logWeek(F)        a week's (or a playoff round's) news, filed when it's played (season.js playWeek): the big
//                     days, the marks passed, records, streaks, clinches, the notable men put on IR or lost for the
//                     season, the playoff results; so the wire keeps the whole season, not just last week
//
// The offseason's moves are read off the offseason as it stands: the carousel, the market's signings (market.js
// F.fas), extensions, retirements (aging.js F.gone), the awards, the draft (filed at closeDraft: draft.js). Releases
// and trades are filed when they happen. The league's history (awards.js F.lh) gives "first since" and "most since".
import { TEAM, SHORTS, POS_LABEL, strength } from './league'
import { DIVISIONS } from './schedule'
import { standings, records, recText } from './standings'
import { groupOf, GROUP } from './roster'
import { gameLines, leagueStats, whoIs } from './stats'
import { lastSeason } from './lastSeason'
import { marketDeals } from './market'
import { lhRow, coyLine } from './awards'
import { coachWire } from './carousel'

const nick = s => TEAM[s]?.nick ?? s
const num = v => Math.round(v ?? 0).toLocaleString('en-US')
const posOf = p => (p.p === 'ol' ? (p.s ?? 'OL') : p.p === 'dl' || p.p === 'db' ? GROUP[groupOf(p)].label : POS_LABEL[p.p])
// a market deal's man by his spot (an EDGE is an EDGE on every screen, never DL here and EDGE there)
export const spotOf = (F, d) => { const p = d.i != null ? F.teams[d.s]?.r.find(x => x.i === d.i) : null; return p ? posOf(p) : POS_LABEL[d.p] }
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
// (filed with the league year, the week and the stage it happened in; a year-old item ages out, and the log keeps
// the newest 90)
export const NEWS_MAX = 90
export function addNews(F, item) {
  const ph = F.phase === 'off' || F.phase === 'done' ? 'off' : F.phase === 'playoffs' ? 'po' : undefined
  F.news = [...(F.news ?? []).filter(x => (x.y ?? F.year) >= F.year - 1), { y: F.year, wk: F.wk, ...(ph && { ph }), ...item }].slice(-NEWS_MAX)
}

// ── The real league's single-season records (through 2024) ─────────────────
const NFL_RECORD = {
  py: [5477, 'Peyton Manning', 2013, 'passing yards'], ptd: [55, 'Peyton Manning', 2013, 'touchdown passes'],
  ry: [2105, 'Eric Dickerson', 1984, 'rushing yards'], rtd: [28, 'LaDainian Tomlinson', 2006, 'rushing touchdowns'],
  ryd: [1964, 'Calvin Johnson', 2012, 'receiving yards'], rc: [149, 'Michael Thomas', 2019, 'catches'],
  rctd: [23, 'Randy Moss', 2007, 'touchdown catches'], dint: [14, 'Night Train Lane', 1952, 'interceptions'],
}
// the round numbers a season is measured by
const MARKS = { py: [4000, 5000], ptd: [30, 40, 50], ry: [1000, 1500, 2000], ryd: [1000, 1500], rc: [100, 125], sck: [10, 15, 20], dint: [8, 10] }
const MARK_TEXT = { py: 'passing yards', ptd: 'touchdown passes', ry: 'rushing yards', ryd: 'receiving yards', rc: 'catches', sck: 'sacks', dint: 'interceptions' }

// an injury the way a team reports it: his own (injury.js sets p.ij), else (a man limited in practice) a minor one
// from the man and the season (the same every time it's read)
const PARTS = ['ankle', 'hamstring', 'knee', 'shoulder', 'groin', 'calf', 'foot', 'ribs', 'hand', 'back', 'quad']
export const injuryOf = (F, p) => p.ij?.l ?? PARTS[hash(`${p.i}-${F.year}-${Math.floor((F.wk ?? 0) / 4)}`) % PARTS.length]
export function injuryText(F, p, s) {
  const part = injuryOf(F, p), who = `${posOf(p)} ${p.n}`
  if (p.ij?.se) return `${nick(s)} lose ${who} for the season (${part})`
  if (p.ij?.pup) return `${nick(s)} place ${who} on the PUP list (${part})`
  if (p.in >= 4) return `${nick(s)} place ${who} on injured reserve (${part})`
  return `${nick(s)} ${who} out ${p.in === 1 ? 'this week' : `${p.in} weeks`} (${part})`
}
// a game's line: "Broncos 24, Raiders 17" (the winner first)
export const scoreText = g => (g.hs >= g.as ? `${nick(g.h)} ${g.hs}, ${nick(g.a)} ${g.as}` : `${nick(g.a)} ${g.as}, ${nick(g.h)} ${g.hs}`) + (g.ot ? ' (OT)' : '')

// ── A man's big day ──────────────────────────────────────────────────────────
// the line that made the game: 300 passing yards, 3 TD; 150 rushing; 150 receiving; 3 sacks; 2 picks
function bigDay(p, x) {
  const g = k => x?.[k] ?? 0
  if (p.p === 'qb' && (g('py') >= 330 || g('ptd') >= 4)) return { v: g('py') / 10 + g('ptd') * 6, text: `${num(g('py'))} yards, ${g('ptd')} TD${g('int') ? `, ${g('int')} INT` : ''}` }
  if ((p.p === 'rb') && g('ry') >= 140) return { v: g('ry') / 10 + (g('rtd') + g('rctd')) * 6, text: `${g('ry')} rushing yards${g('rtd') ? `, ${g('rtd')} TD` : ''}` }
  if ((p.p === 'wr' || p.p === 'te') && (g('ryd') >= 140 || g('rctd') >= 3)) return { v: g('ryd') / 10 + g('rctd') * 6, text: `${g('rc')} catches, ${g('ryd')} yards${g('rctd') ? `, ${g('rctd')} TD` : ''}` }
  if (g('sck') >= 3) return { v: g('sck') * 9, text: `${g('sck')} sacks` }
  if (g('dint') >= 2) return { v: g('dint') * 11, text: `${g('dint')} interceptions` }
  return null
}

// ── The wire ─────────────────────────────────────────────────────────────────
export function wire(F, { n = 30 } = {}) {
  const out = []
  // (what's read off the league as it stands now: now, for the ticker)
  const put = (k, tag, s, text, extra = {}) => out.push({ k, tag, s, text, y: F.year, now: 1, ...extra })
  const season = F.phase === 'season' || F.phase === 'post'
  const lastWk = season ? F.wk - 1 : F.sched.weeks.length - 1
  // the season's log (this league year; in the first weeks, the offseason before it too), newest first
  const log = (F.news ?? []).filter(x => x.y === F.year || (x.y === F.year - 1 && x.ph === 'off' && season && F.wk <= 2)).reverse()
  // the offseason's own news first, the latest stop first: what was filed this offseason (the draft, releases,
  // trades), the market, the re-signings and retirements, the awards, the carousel, the Super Bowl
  if (F.phase === 'off') {
    for (const x of log.filter(x => x.ph === 'off')) out.push(x)
    // (the coaching carousel: carousel.js, the head coaches first)
    for (const x of coachWire(F).sort((a, b) => (b.big ? 1 : 0) - (a.big ? 1 : 0)).slice(0, 24)) put(x.k, x.tag, x.s, x.text, { big: x.big })
    for (const d of marketDeals(F).filter(d => d.o >= 80 || d.s === F.team).slice(-14).reverse()) put('sign', 'SIGNED', d.s, `${nick(d.s)} sign ${spotOf(F, d)} ${d.n}: ${d.y} ${d.y === 1 ? 'year' : 'years'}, $${num(d.$ * d.y)} million`, { big: d.$ >= 25 })
    // (market.js openResign: e[7] 'ext' an extension a year early, 'tag' the franchise tag, else a re-signing)
    for (const e of (F.ext ?? []).slice(0, 10)) {
      const sp = spotOf(F, { i: e[0], s: e[3], p: e[2] })
      if (e[7] === 'tag') put('sign', 'FRANCHISE TAG', e[3], `${nick(e[3])} use the franchise tag on ${sp} ${e[1]}: one year, $${num(e[4])} million`, { big: e[6] >= 90 })
      else if (e[7] === 'ext') put('sign', 'EXTENDED', e[3], `${nick(e[3])} sign ${sp} ${e[1]} to a ${e[5]}-year, $${num(e[4] * e[5])} million extension`, { big: e[4] >= 30 })
      else put('sign', 'RE-SIGNED', e[3], `${nick(e[3])} re-sign ${sp} ${e[1]}: ${e[5]} ${e[5] === 1 ? 'year' : 'years'}, $${num(e[4] * e[5])} million`)
    }
    for (const g of (F.gone ?? []).slice().sort((a, b) => b.o - a.o).slice(0, 8)) put('ret', 'RETIRED', g.s, `${nick(g.s)} ${g.p ? `${POS_LABEL[g.p]} ` : ''}${g.n} retires at ${g.ag}${g.cr ? ` after ${g.cr} seasons` : ''}`, { big: g.o >= 90 })
    const aw = F.aw
    if (aw?.mvp) put('award', 'MVP', aw.mvp.t, `${aw.mvp.n} named MVP: ${aw.mvp.line.toLowerCase().replace(/ · /g, ', ')}`, { big: true })
    for (const [k, label] of [['opoy', 'Offensive Player of the Year'], ['dpoy', 'Defensive Player of the Year'], ['oroy', 'Offensive Rookie of the Year'], ['droy', 'Defensive Rookie of the Year']]) if (aw?.[k]) put('award', 'AWARD', aw[k].t, `${aw[k].n} is the ${label}`)
    if (aw?.coy) put('award', 'AWARD', aw.coy.t, `Coach of the Year: ${coyLine(aw.coy)}`)
    // (the coaching carousel: carousel.js, the head coaches first)
    for (const x of coachWire(F).sort((a, b) => (b.big ? 1 : 0) - (a.big ? 1 : 0)).slice(0, 24)) put(x.k, x.tag, x.s, x.text, { big: x.big })
    const lh = F.lh?.[F.lh.length - 1]
    if (lh?.champ && !log.some(x => x.tag === 'SUPER BOWL')) put('final', 'SUPER BOWL', lh.champ, `${nick(lh.champ)} beat the ${nick(lh.runner)} ${lh.score} to win the Super Bowl`, { big: true })
  }
  // the men out hurt now (the league's starters and the player's own)
  if (season || F.phase === 'playoffs') {
    const hurt = []
    for (const s of SHORTS) for (const p of F.teams[s].r) if (p.in && (p.o >= 82 || s === F.team)) hurt.push({ p, s })
    hurt.sort((a, b) => (b.s === F.team) - (a.s === F.team) || b.p.o - a.p.o).slice(0, 8).forEach(({ p, s }) => put('inj', 'INJURY', s, injuryText(F, p, s), { pid: p.i }))
  }
  // before Week 1 (owner 11-18: the ticker was all the player's own team from the start): the league going in, the
  // way the previews have it
  if (season && F.wk === 0) for (const x of preseason(F)) put('pre', x.tag, x.s, x.text, x.big ? { big: true } : {})
  // last week: the big games, the big days, the streaks, the clinches, the marks passed (filed as the week was
  // played, logWeek; a save from before that has last week read live)
  if (season && lastWk >= 0 && !(F.news ?? []).some(x => x.y === F.year && x.wk === lastWk && x.lw)) for (const x of weekItems(F, lastWk)) put(x.k, x.tag, x.s, x.text, x.big ? { big: true } : {})
  for (const x of log) if (!(F.phase === 'off' && x.ph === 'off')) out.push(x)
  // (each week's own items were filed headlines first: the wire reads newest first, in the order things happened)
  return out.slice(0, n)
}
// a week's news (the regular season's week wk, just played): the big days, the streaks, the clinches, the marks
// the league before its first game: the champion's title defence (last season's, or this league's), the best
// rosters, Week 1's best games, and each division's favourite (by the team ratings on screen)
function preseason(F) {
  const out = []
  const ovr = Object.fromEntries(SHORTS.map(s => [s, strength(F, s).ovr]))
  const lh = F.lh?.[F.lh.length - 1]
  const champ = lh?.champ ?? SHORTS.find(s => lastSeason(s)?.champ)
  if (champ) out.push({ tag: 'CHAMPIONS', s: champ, text: `${nick(champ)} open the defense of their Super Bowl title`, big: true })
  const top = [...SHORTS].sort((a, b) => ovr[b] - ovr[a])
  out.push({ tag: 'PRESEASON', s: top[0], text: `${nick(top[0])}, ${nick(top[1])} and ${nick(top[2])} start ${F.year} with the league's best rosters` })
  const wk1 = (F.sched.weeks[0] ?? []).map(g => ({ g, v: ovr[g.a] + ovr[g.h] - Math.abs(ovr[g.a] - ovr[g.h]) })).sort((a, b) => b.v - a.v).slice(0, 3)
  for (const { g } of wk1) {
    const fav = ovr[g.h] + 1 >= ovr[g.a] ? g.h : g.a
    out.push({ tag: 'WEEK 1', s: g.h, text: `${nick(g.a)} at ${nick(g.h)}: the ${nick(fav)} are favored` })
  }
  for (const d of DIVISIONS) {
    const f = [...d.teams].sort((a, b) => ovr[b] - ovr[a])[0]
    out.push({ tag: d.name, s: f, text: `${nick(f)} are favored to win the ${d.name}` })
  }
  return out
}
function weekItems(F, lastWk) {
  const out = []
  const put = (k, tag, s, text, extra = {}) => out.push({ k, tag, s, text, ...extra })
  const S = standings(F)
  {
    const games = F.sched.weeks[lastWk] ?? []
    const lines = gameLines(F, lastWk), who = whoIs(F)
    const days = []
    for (const g of games) for (const s of [g.h, g.a]) {
      const L = lines[s] ?? {}
      for (const [id, x] of Object.entries(L)) {
        const w = who.get(id); if (!w) continue
        const d = bigDay(w.p, x); if (!d) continue
        const us = s === g.h ? g.hs : g.as, them = s === g.h ? g.as : g.hs, opp = s === g.h ? g.a : g.h
        days.push({ ...d, s, text: `${w.p.n}: ${d.text} in a ${Math.max(us, them)}-${Math.min(us, them)} ${us > them ? 'win over' : us < them ? 'loss to' : 'tie with'} the ${nick(opp)}`, pid: w.p.i })
      }
    }
    days.sort((a, b) => b.v - a.v).slice(0, 4).forEach(d => put('day', 'WEEK ' + (lastWk + 1), d.s, d.text, { pid: d.pid }))
    const R = records(F)
    for (const s of SHORTS) {
      if (!games.some(g => (g.h === s || g.a === s) && g.hs != null)) continue   // (a team on its bye: nothing new)
      const r = R[s], k = r.strk
      // (a run is news when it gets there, not every week it goes on: 5, 7, 10 straight and on)
      if (k >= 5 && (k === 5 || k === 7 || k >= 10)) put('streak', 'STREAK', s, `${nick(s)} win ${ORD(k)} straight, ${recText(r)}`)
      else if (k <= -5 && (k === -5 || k === -8 || k <= -10)) put('streak', 'STREAK', s, `${nick(s)} have lost ${-k} in a row, ${recText(r)}`)
      else if (r.w === 1 && k === 1 && r.l >= 3) put('streak', 'FIRST WIN', s, `${nick(s)} get their first win, ${recText(r)}`)
      if (r.w >= 8 && r.l === 0 && r.t === 0 && r.w % 2 === 0) put('streak', 'UNBEATEN', s, `${nick(s)} are ${recText(r)}`, { big: true })
    }
    // division titles clinched last week (nobody in the division can catch them now, someone could before)
    const playedWk = (x, wk) => F.sched.weeks[wk]?.some(g => (g.h === x || g.a === x) && g.hs != null) ? 1 : 0
    const at = (x, back) => { const r = R[x], gp = r.w + r.l + r.t; return back ? { w: r.w - (lastWon(F, x, lastWk) ? 1 : 0), gp: gp - playedWk(x, lastWk) } : { w: r.w, gp } }
    const locked = (a, rest, back) => { const A = at(a, back); return rest.every(x => { const X = at(x, back); return X.w + (17 - X.gp) < A.w }) }
    for (const d of DIVISIONS) {
      const [a, ...rest] = S.div[d.name]
      if (locked(a, rest, false) && !locked(a, rest, true)) put('clinch', 'CLINCHED', a, `${nick(a)} clinch the ${d.name}${sinceText(F, a, 'div')}`, { big: a === F.team })
    }
    // the marks a man passed last week, and the records
    const tot = leagueStats(F)
    for (const [id, t] of Object.entries(tot)) {
      const w = who.get(id); if (!w) continue
      const wkLine = w.s === F.team ? null : lines[w.s]?.[id]
      if (!wkLine) continue
      for (const [k, marks] of Object.entries(MARKS)) {
        const now = t[k] ?? 0, before = now - (wkLine[k] ?? 0)
        const m = [...marks].reverse().find(v => before < v && now >= v)
        if (m) put('mark', 'MILESTONE', w.s, `${w.p.n} passes ${num(m)} ${MARK_TEXT[k]} for the season`, { pid: w.p.i })
        const rec = NFL_RECORD[k]
        if (rec && before <= rec[0] && now > rec[0]) put('record', 'RECORD', w.s, `${w.p.n} breaks the NFL record for ${rec[3]} in a season: ${num(now)} (${rec[1]}, ${num(rec[0])}, ${rec[2]})`, { big: true, pid: w.p.i })
      }
    }
    for (const g of games) if (g.hs != null && (g.h === F.team || g.a === F.team || Math.abs(g.hs - g.as) <= 3)) put('final', 'FINAL', g.hs >= g.as ? g.h : g.a, scoreText(g))
  }
  return out.sort((a, b) => (b.big ? 1 : 0) - (a.big ? 1 : 0) || (b.s === F.team) - (a.s === F.team))
}
// File a week's news as it's played (season.js playWeek, after the week's games and injuries; before F.wk moves on).
// The men hurt this week (endWeek's F.wire: the league's starters and the player's own): a notable one put on IR or
// lost for the season. A playoff round: its results.
const ROUND_TEXT = ['wild-card round', 'divisional round', 'conference championship', 'Super Bowl']
export function logWeek(F) {
  const po = F.phase === 'playoffs'
  for (const [s, n, w, l] of F.wire ?? []) {
    const p = F.teams[s]?.r.find(x => x.n === n)
    if (!p || !(p.o >= 80 || s === F.team)) continue
    if (p.ij?.se) addNews(F, { k: 'inj', tag: 'INJURY', s, text: `${nick(s)} lose ${posOf(p)} ${p.n} for the season (${l})`, pid: p.i, lw: 1, ...(p.o >= 88 && { big: true }) })
    else if (w >= 4) addNews(F, { k: 'inj', tag: 'IR', s, text: `${nick(s)} place ${posOf(p)} ${p.n} on injured reserve (${l})`, pid: p.i, lw: 1 })
  }
  if (po) {
    const rd = F.po?.rd ?? 0, games = F.po?.rounds?.[rd] ?? []
    for (const g of games) {
      if (g.hs == null) continue
      const [w, l] = g.hs >= g.as ? [g.h, g.a] : [g.a, g.h], sc = `${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}${g.ot ? ' in overtime' : ''}`
      const last = rd === 3
      addNews(F, { k: 'final', tag: last ? 'SUPER BOWL' : 'PLAYOFFS', s: w, text: last ? `${nick(w)} beat the ${nick(l)} ${sc} to win the Super Bowl` : `${nick(w)} beat the ${nick(l)} ${sc} in the ${ROUND_TEXT[rd]}`, lw: 1, ...((last || w === F.team || l === F.team) && { big: true }) })
    }
    return
  }
  for (const x of weekItems(F, F.wk).filter(x => x.k !== 'final' || x.s === F.team).slice(0, 10)) addNews(F, { ...x, lw: 1 })
}
function lastWon(F, s, wk) {
  const g = F.sched.weeks[wk]?.find(x => x.h === s || x.a === s)
  return !!g && (g.h === s ? g.hs > g.as : g.as > g.hs)
}
// " for the first time since 2027" / " for the second straight year" (from the league's history in this save,
// and the real 2025 season before it); nothing when the history doesn't say
export function sinceText(F, s, kind) {
  const hist = [...(F.lh ?? []).map(h => ({ y: h.y, div: isDivWinner(h, s), po: (lhRow(h, s)?.[3] ?? 0) >= 2 })), { y: 2025, div: !!lastSeason(s)?.div, po: lastSeason(s)?.end !== 'MISSED PLAYOFFS' }]
  hist.sort((a, b) => b.y - a.y)
  if (!hist.length) return ''
  let run = 0
  for (const h of hist) { if (h[kind]) run++; else break }
  if (run >= 1) return run === 1 ? ' for the second straight year' : ` for the ${ORD(run + 1)} straight year`
  const last = hist.find(h => h[kind])
  return last ? ` for the first time since ${last.y}` : ''
}
const isDivWinner = (h, s) => {
  if (h.dw) return h.dw.includes(s)
  const d = DIVISIONS.find(x => x.teams.includes(s))
  return [...d.teams].sort((a, b) => (lhRow(h, b)?.[0] ?? 0) - (lhRow(h, a)?.[0] ?? 0))[0] === s
}
// the hub's ticker: the other games this week, the top of the wire
// (what's new only: in the season the last two weeks' news and the men out now; in the playoffs the playoffs'; in
// the offseason the offseason's. A practice-squad signing stays on the wire, off the ticker)
export function tickerItems(F) {
  const wk = F.phase === 'season' ? F.wk - 1 : null
  const items = []
  if (wk != null && wk >= 0) for (const g of F.sched.weeks[wk] ?? []) if (g.hs != null) items.push({ k: 'score', a: g.a, as: g.as, h: g.h, hs: g.hs, tag: g.ot ? 'F/OT' : 'FINAL' })
  const fresh = x => x.now || (F.phase === 'season' || F.phase === 'post'
    ? (x.y === F.year && !x.ph && (x.wk ?? 0) >= F.wk - 2) || (F.wk <= 1 && x.y === F.year - 1 && x.ph === 'off')
    : F.phase === 'playoffs' || F.phase === 'done' ? x.y === F.year && x.ph === 'po'
      : x.y === F.year && x.ph === 'off')
  // (the men out hurt now are on the wire; the ticker has only the injuries filed in the last two weeks)
  // (the player's own team: three items at most, so the ticker is the league's, owner 11-18)
  let mine = 0
  const keep = x => x.s !== F.team || ++mine <= 3
  for (const x of wire(F, { n: 40 }).filter(x => x.k !== 'final' || x.ph === 'po').filter(x => !(x.now && x.k === 'inj')).filter(fresh).filter(x => !/practice squad/i.test(x.text)).filter(keep).slice(0, 12)) items.push({ k: 'news', tag: x.tag, s: x.s, text: x.text })
  return items
}
