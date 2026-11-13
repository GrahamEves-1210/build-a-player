// FRANCHISE: a week of the season, start to finish. The games (week.js), then everything a week changes:
// records, injuries healing, workload, practice, moods, the staff's roster upkeep, upgrades, breakouts, the
// players of the week, headlines, power rankings, the front office's items for next week, the playoffs.
import { REG_WEEKS, PLAYOFF_ROUNDS, TRADE_DEADLINE, weekLabel, clamp, slotOf } from './consts'
import { rngOf } from './rng'
import { TEAM_SHORTS, addNews, nick, teamName, teamRating, ranks, pct, city, depthAfterMove } from './core'
import { prepWeek, makeGame, bookGame, keepBox, applyInjuries, giveXp, lineText, gameScore } from './week'
import { playGame } from './game'
import { records, standing, startPlayoffs, advancePlayoffs, clinches } from './standings'
import { DIV_OF, CONF_OF } from './schedule'
import { upkeep } from './roster'
import { spendPoints, revealTiers, tryBreakout } from './dev'
import { playcall } from './rows'
import { marketValue } from './money'
import { startersOf } from './depth'
import { lastName } from './players'
import { makeOffice, expireOffice, delegateOffice } from './office'
import { cpuTradeWeek } from './trades'
import { ownerWeek } from './owner'
import { startOffseason, fillStaff } from './offseason'
import { scoutingWeek } from './draft'
import { stateWeek, stanceOf } from './state'

export const PRACTICE_XP = { full: 1.5, half: 1, walk: 0.45 }
export const PRACTICE_WEAR = { full: 2.4, half: 0.4, walk: -5 }

// ── Mood ─────────────────────────────────────────────────────────────────────
// Where a man's mood is heading, and why. Returns { target, why: [{ text, d }] }.
export function moodOf(F, p, ctx = null) {
  const t = F.teams[p.team]
  if (!t) return { target: 50, why: [] }
  const why = [], D = new Set(p.drives ?? [])
  let m = 54
  const put = (d, text) => { if (d) { m += d; why.push({ text, d: Math.round(d) }) } }
  const starts = ctx?.starters ?? startersOf(F, t)
  const start = starts.has(p.id)
  if (start) put(D.has('ROLE') ? 11 : 7, 'Starting')
  else if (p.ovr >= 80) put(D.has('ROLE') ? -22 : -14, 'A starter on most teams, sitting here')
  else if (p.ovr >= 75 && D.has('ROLE')) put(-9, 'Wants a bigger role')
  if (p.con && !p.con.rookie) {
    const ratio = p.con.sal / Math.max(0.9, marketValue(p, F.cap)), k = D.has('MONEY') ? 1.6 : 1
    if (ratio < 0.6) put(-13 * k, `Paid well under his value`)
    else if (ratio < 0.85) put(-6 * k, 'Paid a little under his value')
    else if (ratio > 1.2) put(5, 'Paid well')
  } else if (p.con?.rookie && p.ovr >= 86 && p.exp >= 2) put(D.has('MONEY') ? -10 : -4, 'Has outplayed his rookie deal')
  const r = t.rec ?? { w: 0, l: 0, t: 0 }, played = r.w + r.l + r.t
  if (played >= 3) {
    const k = D.has('RING') ? 1.6 : D.has('COMPETITOR') ? 1.4 : 1
    put((pct(r.w, r.l, r.t) - 0.5) * 30 * k, pct(r.w, r.l, r.t) >= 0.5 ? 'The team is winning' : 'The team is losing')
  }
  const cul = ctx?.culture ?? playcall(F, t).culture
  put((cul - 5.5) * 2.1, cul >= 5.5 ? 'A locker room he likes' : 'A locker room that is not right')
  if (D.has('LOYAL') && (p.yrsHere ?? 0) >= 2) put(5, 'This is home')
  const stance = ctx?.stance ?? stanceOf(F, p.team)
  if (stance === 'rebuild') { if (p.age >= 28 && (D.has('RING') || D.has('COMPETITOR'))) put(D.has('RING') ? -11 : -6, 'Did not come here for a rebuild'); else if (p.age <= 24) put(4, 'Getting the snaps in a rebuild') }
  else if (stance === 'contend' && D.has('RING')) put(4, 'A team built to win now')
  if (D.has('MENTOR') && p.age >= 29) put(3, 'Likes bringing the young players along')
  if (p.promise && p.promise >= F.year * 100 + F.week) put(6, 'Was promised a bigger role')
  if (p.hold) put(-12, 'Holding out')
  return { target: clamp(m, 5, 96), why }
}

// ── The week ─────────────────────────────────────────────────────────────────
// Plays every game of F.week. userG: the user's finished live game, or null to sim it.
export function playWeek(F, userG = null) {
  const week = F.week, games = F.sched.weeks[week - 1] ?? [], reg = week <= REG_WEEKS
  const P = prepWeek(F)
  const recap = { week, year: F.year, label: weekLabel(week), user: null, injuries: [], scores: [], awards: null, moves: [] }
  // last week's box scores go, except the user's own games
  if (F.boxes) for (const id in F.boxes) { const b = F.boxes[id]; if (b.h !== F.team && b.a !== F.team) delete F.boxes[id] }
  const best = { off: null, def: null, st: null }
  games.forEach((g, i) => {
    const mine = g.h === F.team || g.a === F.team
    const G = mine && userG ? userG : playGame(F, makeGame(F, week, i, mine, P))
    const out = bookGame(F, G, week, i)
    keepBox(F, G)
    recap.injuries.push(...applyInjuries(F, out.injuries, week))
    for (const x of out.best) {
      const k = x.p.pos === 'k' ? 'st' : ['qb', 'rb', 'wr', 'te', 'ol'].includes(x.p.pos) ? 'off' : 'def'
      if (k === 'off' && x.p.pos === 'ol') continue
      if (!best[k] || x.sc > best[k].sc) best[k] = { ...x, short: x.side === 0 ? G.h : G.a }
    }
    if (mine) {
      const u = g.h === F.team ? 0 : 1
      recap.user = { gameId: G.id, home: u === 0, opp: u === 0 ? g.a : g.h, us: G.sc[u], them: G.sc[1 - u], won: G.sc[u] > G.sc[1 - u], tied: G.sc[u] === G.sc[1 - u], ot: !!G.ot,
        potg: out.potg ? { id: out.potg.p.id, line: lineText(out.potg.p.pos, out.potg.line) } : null, xp: out.xp.filter(x => x.xp > 0).sort((a, b) => b.xp - a.xp), moments: G.stops ?? [], calls: G.calls ?? [] }
    }
    gameNews(F, G, g, out, week)
  })
  if (reg && best.off) {
    const pick = b => (b ? { id: b.p.id, name: b.p.name, team: b.short, slot: slotOf(b.p), line: lineText(b.p.pos, b.line) } : null)
    recap.awards = { off: pick(best.off), def: pick(best.def), st: pick(best.st) }
    F.weekly.push({ week, ...recap.awards })
    for (const b of [best.off, best.def, best.st]) if (b) b.p.potw = (b.p.potw ?? 0) + 1
    addNews(F, 'award', `Players of the week: ${lastName(best.off.p.name)} (${best.off.short})${best.def ? `, ${lastName(best.def.p.name)} (${best.def.short})` : ''}`, { body: `${best.off.p.name}: ${recap.awards.off.line}.${best.def ? ` ${best.def.p.name}: ${recap.awards.def.line}.` : ''}` })
  }
  return recap
}
// one line of news from a game worth a headline
function gameNews(F, G, g, out, week) {
  const hs = G.sc[0], as = G.sc[1], win = hs > as ? g.h : g.a, lose = hs > as ? g.a : g.h, ws = Math.max(hs, as), ls = Math.min(hs, as)
  const mine = g.h === F.team || g.a === F.team
  const po = week > REG_WEEKS
  const star = out.potg
  let head = null
  if (po) head = g.rd === 'sb' ? `${teamName(win)} win the Super Bowl, ${ws}-${ls}` : `${nick(win)} beat ${nick(lose)} ${ws}-${ls} in the ${PLAYOFF_ROUNDS.find(r => r.id === g.rd)?.name ?? 'playoffs'}`
  else if (star && (star.line.py ?? 0) >= 400) head = `${star.p.name} throws for ${star.line.py} as ${nick(win)} beat ${nick(lose)} ${ws}-${ls}`
  else if (star && (star.line.ry ?? 0) >= 180) head = `${star.p.name} runs for ${star.line.ry} in ${nick(win)}' ${ws}-${ls} win`
  else if (star && (star.line.cy ?? 0) >= 180) head = `${star.p.name} goes for ${star.line.cy} receiving yards against ${nick(lose)}`
  else if (star && (star.line.sa ?? 0) >= 3) head = `${star.p.name} sacks the quarterback ${star.line.sa} times in ${nick(win)}' win`
  else if (G.ot && mine) head = `${nick(win)} outlast ${nick(lose)} ${ws}-${ls} in overtime`
  else if (mine && hs !== as) head = `${nick(win)} ${ws - ls >= 17 ? 'roll past' : ws - ls <= 3 ? 'edge' : 'beat'} ${nick(lose)}, ${ws}-${ls}`
  if (head) addNews(F, 'game', head, { team: win, ...(star && { pid: star.p.id, body: `${star.p.name}: ${lineText(star.p.pos, star.line)}.` }) })
}

// Everything after the games. recap: playWeek's. Advances F.week (or the phase).
export function endWeek(F, recap) {
  const week = F.week, reg = week <= REG_WEEKS
  const R = rngOf(`${F.seed}-${F.year}-end-${week}`)
  const user = F.teams[F.team]
  // records
  const RC = records(F)
  for (const s of TEAM_SHORTS) { const r = RC[s]; F.teams[s].rec = { w: r.w, l: r.l, t: r.t, pf: r.pf, pa: r.pa, strk: r.strk } }
  // the front office's open items are settled by the staff; an open coaching job is filled
  delegateOffice(F)
  if (['hc', 'oc', 'dc'].some(k => !F.coaches[user.staff[k]])) fillStaff(F)
  // the user's practice week
  const prac = F.practice?.intensity ?? 'half'
  const playing = new Set()
  for (const g of F.sched.weeks[week - 1] ?? []) { playing.add(g.h); playing.add(g.a) }
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s], mine = s === F.team, intensity = mine ? prac : 'half', pc = playcall(F, t), bye = reg && !playing.has(s)
    const starters = startersOf(F, t), ctx = { starters, culture: pc.culture, stance: stanceOf(F, s) }
    // a lost year: a rebuilding team plays its young players
    const r0 = t.rec ?? { w: 0, l: 0 }
    t.kids = reg && week >= 11 && stanceOf(F, s) === 'rebuild' && r0.w < r0.l ? 1 : undefined
    for (const id of t.roster) {
      const p = F.players[id]
      if (!p) continue
      // injuries heal a week (not the ones from this week's games)
      if (p.inj) {
        if (p.inj.fresh) delete p.inj.fresh
        else if (--p.inj.wk <= 0) { p.inj = null }
      }
      // workload: the week's rest, the bye, how hard they practiced
      p.wear = clamp((p.wear ?? 0) - 2.2 - (bye ? 12 : 0) + PRACTICE_WEAR[intensity], 0, 100)
      // practice XP (the three focus players get the coaches' time)
      if (!(p.inj && p.inj.wk > 0)) giveXp(F, p, 9 * PRACTICE_XP[intensity] + (mine && F.practice?.focus?.includes(id) ? 34 : 0), pc.dev)
      // mood drifts toward where his situation puts it
      const mt = moodOf(F, p, ctx).target
      p.mood = Math.round(clamp(p.mood + (mt - p.mood) * 0.18, 3, 97))
      // the staff spends upgrade points (the CPU always, the user's when asked to)
      if ((p.pts ?? 0) > 0 && (!mine || F.settings.autoUpgrade)) spendPoints(p)
    }
    // full pads cost something now and then
    if (mine && intensity === 'full' && F.settings.injuries && R.chance(0.1)) {
      const pool = t.roster.map(id => F.players[id]).filter(p => p && !p.inj)
      const p = pool[R.int(0, pool.length - 1)]
      if (p) { p.inj = { wk: R.int(1, 3), what: R.pick(['Hamstring strain (practice)', 'Rolled ankle (practice)', 'Groin strain (practice)']), ir: false, fresh: true }; recap.injuries.push({ id: p.id, name: p.name, team: s, slot: slotOf(p), what: p.inj.what, wk: p.inj.wk, user: true, practice: true }) }
    }
  }
  // mark this week's game injuries so next week's healing counts them from now
  for (const x of recap.injuries) { const p = F.players[x.id]; if (p?.inj && !x.practice) { /* healed from next week */ } }
  revealTiers(F)
  if (reg && (week === 6 || week === 11 || week === 16)) breakouts(F)
  // roster upkeep: every CPU team, and the user's when the staff has the roster
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s]
    if (s !== F.team || F.settings.autoRoster) { const did = upkeep(F, t, R); if (s === F.team) recap.moves.push(...did) } else depthAfterMove(F, t)
  }
  if (reg) stateWeek(F)
  if (reg && week <= TRADE_DEADLINE) cpuTradeWeek(F, R)
  if (reg && week === TRADE_DEADLINE) { addNews(F, 'league', 'The trade deadline has passed'); F.offers = [] }
  if (reg) scoutingWeek(F)
  ownerWeek(F, recap)
  // the next week
  recap.standing = null
  if (reg && week < REG_WEEKS) F.week++
  else if (reg) { F.week = REG_WEEKS + 1; F.phase = 'playoffs'; startPlayoffs(F); playoffNews(F) }
  else {
    const champ = advancePlayoffs(F)
    if (champ) { F.last = recap; powerRankings(F); return startOffseason(F) }
    F.week++
  }
  powerRankings(F)
  F.done = {}
  F.plan = { off: 'balanced', def: 'balanced' }
  expireOffice(F)
  makeOffice(F, R)
  F.last = recap
  F.game = null
}
function playoffNews(F) {
  const po = F.playoffs
  addNews(F, 'league', `The playoff field is set: ${nick(po.seeds.AFC[0])} and ${nick(po.seeds.NFC[0])} have the first-round byes`)
  if (po.seeds.AFC.includes(F.team) || po.seeds.NFC.includes(F.team)) addNews(F, 'league', `${teamName(F.team)} are in the playoffs`, { team: F.team })
}
// young players who are producing far above their billing can earn a tier
function breakouts(F) {
  const top = {}
  const rate = p => { const g = Math.max(1, p.s.g ?? 0); return gameScore(p.pos, p.s) / g }
  for (const id in F.players) { const p = F.players[id]; if (!p.team || (p.s.g ?? 0) < 4) continue; const k = slotOf(p), v = rate(p); if (!(top[k] >= v)) top[k] = v }
  // (the best cases first; a handful a checkpoint across the league, and always a look at the user's own)
  const cands = []
  for (const id in F.players) {
    const p = F.players[id]
    if (!p.team || p.age > 25 || p.pos === 'k' || (p.s.gs ?? 0) < 4 || p.dev >= 3 || !p.devKnown) continue
    const best = top[slotOf(p)]
    if (best > 0) cands.push({ p, sc: rate(p) / best })
  }
  cands.sort((a, b) => b.sc - a.sc || a.p.id - b.p.id)
  let n = 0
  for (const { p, sc } of cands) {
    if (n >= 3 && p.team !== F.team) continue
    if (tryBreakout(F, p, sc, playcall(F, F.teams[p.team]).dev)) n++
  }
}

// ── Power rankings ───────────────────────────────────────────────────────────
// What a team has done (record, point difference) and what it is (the roster), more of the first as the season goes
export function powerRankings(F) {
  const val = {}
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s], r = t.rec ?? { w: 0, l: 0, t: 0, pf: 0, pa: 0 }, g = r.w + r.l + r.t, k = Math.min(1, g / 12)
    const roster = (teamRating(F, t).ovr - 82) * 1.6
    const done = g ? (pct(r.w, r.l, r.t) - 0.5) * 22 + ((r.pf - r.pa) / g) * 0.55 : 0
    val[s] = roster * (1 - k * 0.6) + done * (0.4 + k * 0.6)
  }
  const rk = ranks(val)
  const prev = Object.fromEntries((F.power ?? []).map(x => [x.s, x.r]))
  F.power = TEAM_SHORTS.map(s => ({ s, r: rk[s], p: prev[s] ?? rk[s], v: Math.round(val[s] * 10) / 10 })).sort((a, b) => a.r - b.r)
}
export function powerBlurb(F, row) {
  const t = F.teams[row.s], r = t.rec ?? { w: 0, l: 0, t: 0, strk: 0 }, g = r.w + r.l + r.t
  const best = t.roster.map(id => F.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr)[0]
  if (!g) return best ? `${best.name} and a roster ranked ${ordinalWord(row.r)} on paper.` : ''
  if (r.strk >= 4) return `Winners of ${r.strk} straight.`
  if (r.strk <= -4) return `Losers of ${-r.strk} straight.`
  if (row.p - row.r >= 4) return `Up ${row.p - row.r} spots. ${best ? `${lastName(best.name)} is playing like an All-Pro.` : ''}`
  if (row.r - row.p >= 4) return `Down ${row.r - row.p} spots after a bad week.`
  const diff = (r.pf - r.pa) / g
  if (diff >= 8) return `Outscoring teams by ${diff.toFixed(1)} a game.`
  if (diff <= -8) return `Outscored by ${(-diff).toFixed(1)} a game.`
  return r.w > r.l ? `Winning the games they should.` : r.w < r.l ? `Still looking for answers.` : `A .500 team until proven otherwise.`
}
const ordinalWord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

// ── The user's side ──────────────────────────────────────────────────────────
// the user's game this week: { i, g } | null (a bye, or out of the playoffs)
export function userGame(F) {
  if (F.phase === 'offseason') return null
  const games = F.sched.weeks[F.week - 1] ?? []
  const i = games.findIndex(g => g.h === F.team || g.a === F.team)
  return i < 0 ? null : { i, g: games[i] }
}
export function advanceWeek(F, userG = null) {
  if (F.phase === 'offseason') return
  const recap = playWeek(F, userG)
  endWeek(F, recap)
}
export { DIV_OF, CONF_OF, standing, clinches, city }
