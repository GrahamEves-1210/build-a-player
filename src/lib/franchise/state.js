// FRANCHISE: where a team is. Every team has a STATE, worked out from what is true about it:
//   contend   built to win now          retool   a good core with holes, a year away          rebuild   tearing down, playing the kids
// It comes from the roster's strength, the quarterback, how old the core is and how long it is signed, cap
// room, the picks it holds, and its record (more of the record as the season goes). It is set again every
// offseason and can flip in the middle of a season: a contender that starts 2-7 turns seller, a retooling team
// at 7-2 turns buyer. A flip is news; for the user's own team it is also a front office item.
//
// The general manager declares a DIRECTION (the same three words) each offseason and may change it once in
// season, up to the trade deadline. It, not the engine's read, is what the owner judges him by (owner.js),
// and what players and other teams see.
import { NFL_TEAMS } from '../../data/nfl-teams'
import { REG_WEEKS, TRADE_DEADLINE, SLOTS, clamp, r2, slotOf, ovrGrade, gradeOf } from './consts'
import { TEAM_SHORTS, teamRating, ranks, pct, addNews, nick, teamName, touch, fail, ok } from './core'
import { lineupOf } from './depth'
import { payroll } from './money'
import { pickValue, playerValue } from './trades'
import { teamRef, coachRow } from './rows'
import { lastName } from './players'
import { buildLeague } from './league'

export const STATES = ['contend', 'retool', 'rebuild']
export const STATE_LABEL = { contend: 'CONTENDING', retool: 'RETOOLING', rebuild: 'REBUILDING' }
export const STATE_TEXT = { contend: 'Built to win now.', retool: 'A good core with holes to fix. A year away.', rebuild: 'Tearing it down, playing the young players, stockpiling picks.' }
// when a position's prime ends
const PRIME_END = { qb: 36, rb: 28, wr: 30, te: 31, ol: 33, dl: 31, lb: 30, db: 30, k: 39 }

// The facts a state is read from
export function teamFacts(F, short, rk = null) {
  const t = F.teams[short], P = t.roster.map(id => F.players[id]).filter(Boolean)
  const rate = teamRating(F, t)
  const L = lineupOf(F, t), qb = L.QB[0] ?? null
  const core = [...P].filter(p => p.pos !== 'k').sort((a, b) => b.ovr * (b.pos === 'qb' ? 1.06 : 1) - a.ovr * (a.pos === 'qb' ? 1.06 : 1)).slice(0, 10)
  const coreAge = core.reduce((s, p) => s + p.age, 0) / Math.max(1, core.length)
  const left = core.map(p => Math.max(0, PRIME_END[p.pos] - p.age)).sort((a, b) => a - b)
  const coreLeft = left.length ? (left[Math.floor(left.length / 2)] + left[Math.floor((left.length - 1) / 2)]) / 2 : 0
  const signed = core.reduce((s, p) => s + Math.min(4, p.con?.yrs ?? 0), 0) / Math.max(1, core.length)
  const old = core.filter(p => p.age >= (p.pos === 'qb' ? 35 : 30)).length
  const walk = P.filter(p => p.con && p.con.yrs <= 1 && p.ovr >= 82).length
  const young = P.filter(p => p.age <= 24 && p.ovr >= 76).length
  const draftY = F.draft?.year ?? F.year + 1
  const next = t.picks.filter(pk => pk.y === draftY)
  const r = t.rec ?? { w: 0, l: 0, t: 0 }, g = r.w + r.l + r.t
  return { short, rate, rank: rk, qb, coreAge, coreLeft, signed, old, walk, young, capRoom: r2(F.cap - payroll(F, t)), picks: next.length, firsts: next.filter(pk => pk.r === 1).length, pickValue: next.reduce((s, pk) => s + pickValue(F, pk), 0), g, wp: g ? pct(r.w, r.l, r.t) : null, last: t.last ?? null }
}
// 0-100: how good the team is right now (the roster, then more and more the record)
function nowScore(f) {
  const roster = (33 - f.rank) / 32 * 100
  if (f.g >= 3) { const k = Math.min(0.6, f.g / 17 * 0.9), rec = clamp(50 + (f.wp - 0.5) * 150, 0, 100); return roster * (1 - k) + rec * k }
  if (f.last) { const rec = clamp(50 + (pct(f.last.w, f.last.l, f.last.t ?? 0) - 0.5) * 130, 0, 100); return roster * 0.8 + rec * 0.2 }
  return roster
}
function readState(f, was = null) {
  const s = nowScore(f), q = f.qb?.ovr ?? 60
  // (a team that has to cross a line to change state has to cross it clearly)
  const up = was === 'retool' ? 67 : was === 'rebuild' ? 70 : 63, down = was === 'retool' ? 31 : was === 'contend' ? 28 : 35
  let st = s >= up ? 'contend' : s <= down ? 'rebuild' : 'retool'
  if (was === 'contend' && s >= 58) st = 'contend'
  if (was === 'rebuild' && s <= 39) st = 'rebuild'
  // no quarterback, no window, unless everything around him is elite
  if (st === 'contend' && q < 76 && f.rank > 5) st = 'retool'
  // old and average is the worst place to be: it is a rebuild whether they say so or not
  if (st === 'retool' && f.coreAge >= 30 && s < 48) st = 'rebuild'
  // young and already competitive is a retool on the way up, not a teardown
  if (st === 'rebuild' && f.coreAge <= 25.6 && s >= 30 && q >= 78) st = 'retool'
  // nobody tears down around a young quarterback who is already good
  if (st === 'rebuild' && f.qb && f.qb.age <= 25 && q >= 82 && s >= 26) st = 'retool'
  return { state: st, score: Math.round(s) }
}
// the record that turns a team: a contender well under .500, a rebuilder well over it, and the like
function recordSays(f, was, to) {
  if (f.wp == null) return false
  const up = STATES.indexOf(to) < STATES.indexOf(was)
  return up ? f.wp >= (to === 'contend' ? 0.66 : 0.55) : f.wp <= (to === 'rebuild' ? 0.3 : 0.4)
}
function windowOf(f, state) {
  if (state === 'contend') { const y = clamp(Math.round(Math.min(f.coreLeft, f.signed + 1.5, f.qb ? Math.max(1, PRIME_END.qb + 2 - f.qb.age) : 1)), 1, 5); return { years: y, text: y <= 1 ? 'The window is closing: this is the year.' : `The window is open for about ${y} more seasons.` } }
  if (state === 'retool') return { years: 1, text: f.coreAge <= 27 ? 'A young core. A piece or two from the playoffs.' : 'A year away, if the holes get filled.' }
  const y = f.young >= 4 && f.qb && f.qb.ovr >= 76 ? 2 : 3
  return { years: y, text: `${y === 2 ? 'Two' : 'Three'} years from contending, if the picks hit.` }
}

// Every team's state, from what is true right now. Returns the teams whose state changed.
export function computeStates(F, { quiet = false, season = false } = {}) {
  const val = Object.fromEntries(TEAM_SHORTS.map(s => [s, teamRating(F, F.teams[s]).ovr]))
  const rk = ranks(val), flips = []
  for (const s of TEAM_SHORTS) {
    const t = F.teams[s], f = teamFacts(F, s, rk[s]), was = t.state ?? null
    let { state, score } = readState(f, was)
    // in season a team changes course once, and only on the evidence of its record
    if (season && was && state !== was && (t.flipY === F.year || f.g < 6 || !recordSays(f, was, state))) state = was
    if (season && was && state !== was) t.flipY = F.year
    t.now = score
    const w = windowOf(f, state)
    t.win = w.years
    if (state !== was) { t.state = state; if (was) flips.push({ short: s, from: was, to: state }) }
  }
  if (!quiet) for (const x of flips) flipNews(F, x)
  return flips
}
function flipNews(F, x) {
  const n = nick(x.short), r = F.teams[x.short].rec, rec = r ? `${r.w}-${r.l}` : null
  const inSeason = F.phase === 'regular', dl = inSeason && F.week <= TRADE_DEADLINE
  const head = x.to === 'rebuild' ? (dl ? `The ${n} are open for business` : `The ${n} are starting over`)
    : x.to === 'contend' ? (dl ? `The ${n} are buyers` : `The ${n} are all in`)
    : x.from === 'contend' ? (dl ? `The ${n}${rec ? `, ${rec},` : ''} are listening on their veterans` : `The ${n} take a step back to retool`) : `The ${n} are a team on the way up`
  addNews(F, 'league', head, { team: x.short, body: `${teamName(x.short)}: ${STATE_LABEL[x.from]} to ${STATE_LABEL[x.to]}${rec && inSeason ? ` at ${rec}` : ''}.` })
}
// in season: read the states again; the user's own flip is a question from the owner
export function stateWeek(F) {
  // the checkpoints: the weeks into the deadline, and the stretch run
  if (F.phase !== 'regular' || ![6, 7, 8, TRADE_DEADLINE, 13].includes(F.week)) return []
  const flips = computeStates(F, { season: true })
  const mine = flips.find(x => x.short === F.team)
  if (mine && !F.office.some(o => o.kind === 'direction')) {
    const r = F.teams[F.team].rec ?? { w: 0, l: 0 }, open = F.week <= TRADE_DEADLINE && F.gm.dirAt !== F.year
    const sell = mine.to === 'rebuild' || (mine.from === 'contend' && mine.to === 'retool')
    F.office.push({ id: `o${(F.officeId = (F.officeId ?? 0) + 1)}`, week: F.week, kind: 'direction', title: sell ? 'THE OWNER CALLS: SELL OR HOLD?' : 'THE OWNER CALLS: PUSH?',
      body: sell ? `At ${r.w}-${r.l}, ownership sees a season slipping away and wants to know the plan: move veterans for picks, hold what is here, or push anyway.` : `At ${r.w}-${r.l}, ownership sees a team that can win now and wants to know if ${F.gm.name} is going for it.`,
      data: { from: mine.from, to: mine.to },
      options: open ? [
        { id: 'rebuild', label: 'SELL', text: 'Declare a rebuild. Veterans go on the block, other teams call with picks, the season is judged on the young players.' },
        { id: 'retool', label: 'HOLD', text: 'Keep the core, fix what can be fixed. Judged on a winning record and a step forward.' },
        { id: 'contend', label: 'PUSH', text: 'Go for it. Rebuilding teams call with veterans. Judged on the playoffs and a run in them.' },
      ] : [{ id: 'keep', label: 'STAY THE COURSE', text: `The direction for the year is set: ${STATE_LABEL[F.gm.dir ?? 'retool']}.` }],
      delegate: open ? (sell ? (mine.to === 'rebuild' ? 'rebuild' : 'retool') : 'contend') : 'keep' })
  }
  return flips
}

// ── The GM's direction ───────────────────────────────────────────────────────
export const directionOf = F => F.gm.dir ?? F.teams[F.team].state ?? 'retool'
// what the owner says about a direction against what the roster is
export function directionRead(F, dir = directionOf(F)) {
  const st = F.teams[F.team].state ?? 'retool', n = F.gm.name
  if (dir === st) return { agree: true, text: dir === 'contend' ? `Ownership agrees: this roster is built to win now.` : dir === 'rebuild' ? `Ownership agrees: it is time to build this the right way.` : `Ownership agrees: a good core, and holes to fix.` }
  if (dir === 'rebuild') return { agree: false, text: st === 'contend' ? `Ownership will give ${n} the time, but a rebuild on a roster this good will not sit well in the locker room or the stands.` : `Ownership will be patient. The veterans who came here to win will not be.` }
  if (dir === 'contend') return { agree: false, text: st === 'rebuild' ? `Ownership likes the ambition. This roster is a long way from it, and ${n} will be judged as a contender.` : `Ownership likes the ambition. The bar is the playoffs now.` }
  return { agree: false, text: st === 'contend' ? `Ownership expected more than a retool from this roster.` : `Ownership can live with a retool, as long as the team takes a step.` }
}
export function applyDirection(F, dir, { season = false } = {}) {
  const was = F.gm.dir ?? null, st = F.teams[F.team].state ?? 'retool'
  F.gm.dir = dir
  if (was === dir) return
  const P = F.teams[F.team].roster.map(id => F.players[id]).filter(Boolean)
  // the locker room hears it
  for (const p of P) {
    const ring = p.drives?.includes('RING') || p.drives?.includes('COMPETITOR')
    if (dir === 'rebuild') p.mood = clamp(p.mood + (p.age <= 24 ? 4 : p.age >= 28 && ring ? -10 : p.age >= 28 ? -3 : 0) - (st === 'contend' ? 3 : 0), 3, 97)
    if (dir === 'contend') p.mood = clamp(p.mood + (ring ? 5 : 1), 3, 97)
  }
  if (dir === 'rebuild' && st === 'contend') F.gm.security = clamp(F.gm.security + 3, 0, 100)
  if (season) F.gm.dirAt = F.year
  if (dir === 'rebuild') for (const p of P) if (p.age >= 29 && p.ovr >= 78 && p.con && p.con.yrs <= 2 && !p.built) p.block = true
  if (dir === 'contend') for (const p of P) p.block = undefined
  addNews(F, 'owner', dir === 'rebuild' ? `${nick(F.team)} general manager ${F.gm.name} commits to a rebuild` : dir === 'contend' ? `${F.gm.name}: the ${nick(F.team)} are going for it` : `${F.gm.name}: the ${nick(F.team)} will retool, not rebuild`, { team: F.team })
}
export function setDirection(F, dir) {
  if (!STATES.includes(dir)) return fail(F, 'direction', 'There is no such direction.')
  if (F.phase === 'offseason') { applyDirection(F, dir); F.gm.dirBy = 'gm'; F.owner = null; return ok(F, directionRead(F, dir).text, { agree: directionRead(F, dir).agree }) }
  if (F.phase !== 'regular' || F.week > TRADE_DEADLINE) return fail(F, 'direction', 'The direction for the year is set once the trade deadline passes.')
  if (F.gm.dirAt === F.year && F.gm.dir !== dir) return fail(F, 'direction', 'The direction can be changed once in a season.')
  const first = F.week === 1 && !(F.teams[F.team].rec?.w + F.teams[F.team].rec?.l > 0)
  applyDirection(F, dir, { season: !first })
  F.gm.dirBy = 'gm'
  F.owner = null
  F.office = F.office.filter(o => o.kind !== 'direction')
  return ok(F, directionRead(F, dir).text, { agree: directionRead(F, dir).agree })
}
// what a team is doing, for everything that asks (the user's team is what its GM says it is)
export const stanceOf = (F, short) => (short === F.team ? directionOf(F) : F.teams[short].state ?? 'retool')

// ── What the screens read ────────────────────────────────────────────────────
function qbText(q) {
  if (!q) return { name: null, text: 'Nobody under center.' }
  const g = ovrGrade(q.ovr), n = q.name
  const text = q.ovr >= 88 ? (q.age >= 35 ? `${n}, ${q.age}: still one of the best, on the back nine` : q.age >= 32 ? `${n}, ${q.age}: a franchise quarterback with good years left` : `${n}, ${q.age}: a franchise quarterback in his prime`)
    : q.ovr >= 82 ? (q.age <= 25 ? `${n}, ${q.age}: a young quarterback who is already good` : q.age >= 35 ? `${n}, ${q.age}: a good veteran with a year or two left` : `${n}, ${q.age}: a good starter`)
    : q.ovr >= 76 ? (q.age <= 24 ? `${n}, ${q.age}: a young quarterback still finding it` : `${n}, ${q.age}: a starter the team can win with, not because of`)
    : q.age <= 24 ? `${n}, ${q.age}: a young quarterback with a long way to go` : `No long-term answer: ${n} starts for now`
  return { id: q.id, name: n, age: q.age, ovr: q.ovr, grade: g, yrs: q.con?.yrs ?? 0, rookie: !!q.con?.rookie, text }
}
const UNIT_GROUPS = [['QB', ['QB'], 1], ['RB', ['RB'], 1], ['WR', ['WR'], 3], ['TE', ['TE'], 1], ['OL', ['OL'], 5], ['DL', ['EDGE', 'DT'], 2], ['LB', ['LB'], 3], ['DB', ['CB', 'S'], 2], ['K', ['K'], 1]]
function unitGroups(F, short) {
  const L = lineupOf(F, F.teams[short])
  return UNIT_GROUPS.map(([slot, from, n]) => {
    const men = from.flatMap(k => (k === 'OL' ? L.OL.map(o => o.p).filter(Boolean) : (L[k] ?? []).slice(0, n)))
    const ovr = men.length ? Math.round(men.reduce((s, p) => s + p.ovr, 0) / men.length) : 60
    const best = [...men].sort((a, b) => b.ovr - a.ovr)[0]
    return { slot, ovr, grade: ovrGrade(ovr), starter: best?.name ?? null }
  })
}
function hardest(F, f, state, groups, grpRank) {
  const bad = [], good = []
  const q = f.qb?.ovr ?? 60
  if (q < 76) bad.push([3, f.qb && f.qb.age <= 24 ? 'a raw young quarterback' : 'no answer at quarterback'])
  else if (f.qb && f.qb.age <= 24 && q < 84) good.push([2, 'a young quarterback on a rookie deal'])
  else if (q >= 88 && f.qb.age <= 32) good.push([3, 'a franchise quarterback'])
  if (f.old >= 5 || (f.old >= 4 && f.coreAge >= 28.8)) bad.push([2.5, `an aging core (${numWord(f.old)} of the ten best players are 30 or older)`])
  const names = { OL: 'offensive line', DL: 'pass rush', DB: 'secondary', WR: 'receiving corps', LB: 'linebacker group', RB: 'backfield', TE: 'tight end room' }
  for (const g of groups) { const r = grpRank[g.slot]?.[f.short]; if (names[g.slot] && r >= 27) bad.push([2 + (r - 27) * 0.1 + (g.slot === 'OL' || g.slot === 'DL' || g.slot === 'DB' ? 0.3 : 0), `${g.slot === 'OL' ? 'an' : 'a'} ${names[g.slot]} ranked ${ord(r)}`]); else if (names[g.slot] && r <= 3) good.push([1.5, `a top-three ${names[g.slot]}`]) }
  if (f.capRoom < 8) bad.push([2.2, `${f.capRoom < 2 ? 'no' : 'little'} cap room`]); else if (f.capRoom >= 60) good.push([2, 'cap room to spend'])
  if (f.walk >= 4) bad.push([1.5, `${numWord(f.walk)} starters in the last year of their deals`])
  if (f.firsts === 0) bad.push([2.4, 'no first-round pick']); else if (f.firsts >= 2) good.push([2.5, `${f.firsts === 2 ? 'two' : 'three'} first-round picks`])
  if (f.young >= 5) good.push([1.6, 'a young core that is already playing'])
  if (state === 'contend' && bad.length < 2) bad.push([1, 'an owner who expects a deep playoff run now'])
  if (state === 'rebuild' && bad.length < 2) bad.push([1, 'a long way back'])
  bad.sort((a, b) => b[0] - a[0]); good.sort((a, b) => b[0] - a[0])
  const cap = s => s[0].toUpperCase() + s.slice(1)
  const join = l => (l.length > 1 ? `${l[0][1]} and ${l[1][1]}` : l[0]?.[1] ?? '')
  return { hardest: bad.length ? `${cap(join(bad.slice(0, 2)))}.` : 'No real weakness: the pressure is the hard part.', upside: good.length ? `${cap(join(good.slice(0, 2)))}.` : 'Not much to build on yet.' }
}
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
function difficulty(f, state) {
  const q = f.qb?.ovr ?? 60
  const d = (f.rank - 1) / 31 * 0.5 + (q < 76 ? 0.2 : q < 82 ? 0.08 : 0) + (f.capRoom < 8 ? 0.12 : 0) + (f.coreAge >= 29.5 ? 0.1 : 0) + (state === 'contend' ? 0.06 : 0) + (f.firsts === 0 ? 0.06 : 0)
  const level = d < 0.24 ? 1 : d < 0.42 ? 2 : d < 0.6 ? 3 : d < 0.76 ? 4 : 5
  return { level, word: ['', 'FAVORABLE', 'FAIR', 'DEMANDING', 'HARD', 'VERY HARD'][level], text: ['', 'A roster that should win. The job is not wasting it.', 'Good pieces and room to work.', 'Real holes and real expectations.', 'A lot has to go right.', 'The longest road in the league.'][level] }
}
// the whole league's facts once (group ranks need every team)
function leagueRead(F) {
  const val = Object.fromEntries(TEAM_SHORTS.map(s => [s, teamRating(F, F.teams[s])]))
  const rk = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, val[s].ovr]))), offR = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, val[s].off]))), defR = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, val[s].def])))
  const groups = Object.fromEntries(TEAM_SHORTS.map(s => [s, unitGroups(F, s)]))
  const grpRank = {}
  for (const [slot] of UNIT_GROUPS) grpRank[slot] = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, groups[s].find(g => g.slot === slot).ovr])))
  return { val, rk, offR, defR, groups, grpRank }
}
function stateRow(F, short, LR) {
  const t = F.teams[short], f = teamFacts(F, short, LR.rk[short]), state = t.state ?? readState(f).state, w = windowOf(f, state)
  const h = hardest(F, f, state, LR.groups[short], LR.grpRank)
  const next = f.picks, capital = f.firsts >= 2 ? `${f.firsts === 2 ? 'Two' : 'Three'} first-round picks in the next draft` : f.firsts === 0 ? 'No first-round pick in the next draft' : next >= 9 ? `${next} picks in the next draft` : next <= 5 ? `Only ${next} picks in the next draft` : 'All its own picks'
  const c = id => F.coaches[id]
  return {
    ...teamRef(short), state, label: STATE_LABEL[state], stateText: STATE_TEXT[state], window: w, score: t.now ?? null,
    ratings: { ...LR.val[short], rank: LR.rk[short], offRank: LR.offR[short], defRank: LR.defR[short] }, groups: LR.groups[short],
    capSpace: f.capRoom, capText: f.capRoom >= 50 ? 'Plenty of cap room' : f.capRoom >= 20 ? 'Room to work with' : f.capRoom >= 8 ? 'Tight against the cap' : 'Up against the cap',
    draft: { picks: next, firsts: f.firsts, value: Math.round(f.pickValue), text: capital }, qb: qbText(f.qb), coreAge: Math.round(f.coreAge * 10) / 10,
    hardest: h.hardest, upside: h.upside, difficulty: difficulty(f, state),
    staff: { hc: coachRow(F, c(t.staff.hc), 'HC'), oc: coachRow(F, c(t.staff.oc), 'OC'), dc: coachRow(F, c(t.staff.dc), 'DC') },
    record: t.rec ? `${t.rec.w}-${t.rec.l}${t.rec.t ? `-${t.rec.t}` : ''}` : '0-0', user: short === F.team,
  }
}
export function teamState(F, short = F.team) {
  if (!F.teams[short]) return null
  const row = stateRow(F, short, leagueRead(F))
  if (short !== F.team) return row
  const dir = directionOf(F), read = directionRead(F, dir)
  return { ...row, direction: dir, directionLabel: STATE_LABEL[dir], agree: read.agree, ownerSays: read.text, canChange: F.phase === 'offseason' || (F.phase === 'regular' && F.week <= TRADE_DEADLINE && (F.gm.dirAt !== F.year)), advice: advice(F) }
}
export function leagueStates(F) {
  const LR = leagueRead(F)
  const rows = TEAM_SHORTS.map(s => stateRow(F, s, LR))
  const by = st => rows.filter(r => r.state === st).sort((a, b) => a.ratings.rank - b.ratings.rank)
  return { contend: by('contend'), retool: by('retool'), rebuild: by('rebuild'), all: rows }
}
// the staff's advice for the direction the GM has declared (the THIS WEEK list shows the first line)
export function advice(F) {
  const dir = directionOf(F), t = F.teams[F.team], P = t.roster.map(id => F.players[id]).filter(Boolean), out = []
  const dl = F.phase === 'regular' && F.week <= TRADE_DEADLINE
  if (dir === 'rebuild') {
    const vets = P.filter(p => p.age >= 28 && p.ovr >= 78 && p.con && p.con.yrs <= 2 && !p.built).sort((a, b) => playerValue(F, b) - playerValue(F, a))
    if (vets.length && (dl || F.phase === 'offseason')) out.push(vets.length === 1 ? `${vets[0].name} would fetch picks${dl ? ' before the deadline' : ''}.` : `${numWord(vets.length)} veterans on short deals would fetch picks${dl ? ' before the deadline' : ''}: ${vets.slice(0, 3).map(p => lastName(p.name)).join(', ')}.`)
    const kids = P.filter(p => p.age <= 23 && p.ovr >= 70)
    if (kids.length) out.push(`${numWord(kids.length)} player${kids.length > 1 ? 's' : ''} 23 or younger should be getting snaps.`)
  } else if (dir === 'contend') {
    const L = lineupOf(F, t), holes = SLOTS.filter(s => s.pos && s.slot !== 'K').map(s => ({ slot: s.slot, p: s.pos === 'ol' ? L.OL.find(o => o.spot === s.slot)?.p : (L[s.slot] ?? [])[s.n - 1] })).filter(x => !x.p || x.p.ovr < 76).sort((a, b) => (a.p?.ovr ?? 0) - (b.p?.ovr ?? 0))
    if (holes.length) out.push(`${holes[0].slot} is the weak spot (${holes[0].p ? `${holes[0].p.name}, ${gradeOf((holes[0].p.ovr - 60) / 3.5)}` : 'nobody'})${dl ? ': rebuilding teams are selling' : ''}.`)
    const walk = P.filter(p => p.con && p.con.yrs <= 1 && p.ovr >= 82 && !p.ext)
    if (walk.length) out.push(`${walk.length === 1 ? `${walk[0].name} is` : `${numWord(walk.length)} starters are`} in the last year of a deal.`)
  } else {
    const walk = P.filter(p => p.con && p.con.yrs <= 1 && p.ovr >= 80 && !p.ext)
    if (walk.length) out.push(`Decide on ${walk.slice(0, 3).map(p => lastName(p.name)).join(', ')} before the deals run out.`)
    out.push(t.picks.length >= 21 ? 'Keep the picks: the core needs cheap help around it.' : 'The picks are thin: a veteran or two could bring some back.')
  }
  return out.map(s => s[0].toUpperCase() + s.slice(1))
}
const numWord = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'][n] ?? 'more than twenty'

// ── Team select, before a franchise exists ───────────────────────────────────
// The same numbers a league created with this seed will show (a league is built without anyone's builds and
// read off). One call when the screen opens; the last seed's answer is kept.
let PREVIEW = null
export function teamPreviews(seed = 'franchise') {
  const key = String(seed ?? 'franchise')
  if (PREVIEW?.key === key) return PREVIEW.rows
  const F = buildLeague({ team: NFL_TEAMS[0].short, builds: [], seed: key })
  computeStates(F, { quiet: true })
  const LR = leagueRead(F)
  const rows = TEAM_SHORTS.map(s => { const r = stateRow(F, s, LR); delete r.user; delete r.record; return r })
  PREVIEW = { key, rows }
  return rows
}
export { REG_WEEKS, touch }
