// NBA FRANCHISE: the draft. A made-up class each year (about 80 men: freshmen at 19, seniors at 22, international men
// from the pro leagues), scouted through the season; the lottery with the 2019 odds; two rounds, 60 picks.
// Every team's picks for the next seven drafts are in F.picks (B's trades move them): { y, r, o, t, pr, sw, n }.
import { SHORTS, TEAM, attrsFor, ovrOfAttrs, groupOfSpot, leagueNames, realNames, manOf, nick, ROSTER_MAX } from './league'
import { records, pct, leagueOrder } from './season'
import { addNews } from './news'
import { nameFor } from '../names'
import { rngOf, clamp } from '../rng'
import { fixNumbers } from './numbers'
import * as X from './seams'

export const DRAFT_YEARS = 7
// ── The picks ────────────────────────────────────────────────────────────────
export function makePicks(F) {
  F.picks = F.picks ?? []
  for (let y = F.year + 1; y <= F.year + DRAFT_YEARS; y++) for (const r of [1, 2]) for (const s of SHORTS) {
    if (!F.picks.some(p => p.y === y && p.r === r && p.o === s)) F.picks.push({ y, r, o: s, t: s, pr: null })
  }
  return F.picks
}
export const picksOf = (F, s) => (F.picks ?? []).filter(p => p.t === s).sort((a, b) => a.y - b.y || a.r - b.r)
export const pickText = (F, p) => `${p.y} ${p.r === 1 ? '1st' : '2nd'}${p.o !== p.t ? ` (${TEAM[p.o].short})` : ''}${p.pr ? ` top-${p.pr.top} protected` : ''}${p.n ? ` · No. ${p.n}` : ''}`

// ── The class ────────────────────────────────────────────────────────────────
const COLLEGES = ['Duke', 'Kentucky', 'Kansas', 'North Carolina', 'UCLA', 'Arizona', 'Gonzaga', 'Michigan State', 'Villanova', 'Baylor', 'Houston',
  'UConn', 'Auburn', 'Alabama', 'Tennessee', 'Arkansas', 'Texas', 'Indiana', 'Purdue', 'Illinois', 'Michigan', 'Ohio State', 'Louisville',
  'Florida', 'LSU', 'USC', 'Oregon', 'Virginia', 'Syracuse', 'Creighton', 'Marquette', 'Iowa State', 'Texas Tech', 'Miami', 'Memphis',
  'San Diego State', 'Saint Mary\'s', 'Wake Forest', 'Georgetown', 'St. John\'s', 'Xavier', 'Maryland', 'Wisconsin', 'Iowa', 'BYU', 'Utah',
  'Washington', 'Colorado', 'Ole Miss', 'Mississippi State', 'Georgia', 'Clemson', 'NC State', 'Pittsburgh', 'Seton Hall', 'Dayton', 'VCU', 'Davidson']
const ABROAD = [['France', 'Paris Basketball'], ['France', 'ASVEL'], ['Spain', 'Real Madrid'], ['Spain', 'Barcelona'], ['Serbia', 'Mega Basket'], ['Serbia', 'Partizan'],
  ['Germany', 'Ratiopharm Ulm'], ['Australia', 'NBL Next Stars'], ['Lithuania', 'Zalgiris'], ['Turkey', 'Anadolu Efes'], ['Greece', 'Olympiacos'],
  ['Italy', 'Olimpia Milano'], ['Slovenia', 'Cedevita Olimpija'], ['Israel', 'Maccabi Tel Aviv'], ['Canada', 'G League Ignite'], ['Brazil', 'Flamengo']]
const INTL_FIRST = { France: ['Mathis', 'Noah', 'Theo', 'Hugo', 'Ilan', 'Bastien', 'Rayan', 'Yanis', 'Killian', 'Mael'], Spain: ['Pablo', 'Hugo', 'Izan', 'Mario', 'Alvaro', 'Unai'],
  Serbia: ['Nikola', 'Stefan', 'Lazar', 'Uros', 'Vuk', 'Ognjen'], Germany: ['Jonas', 'Lukas', 'Moritz', 'Elias', 'Malik'], Australia: ['Jack', 'Lachlan', 'Riley', 'Mitchell', 'Kai'],
  Lithuania: ['Matas', 'Domas', 'Arnas', 'Rokas', 'Kajus'], Turkey: ['Emir', 'Alperen', 'Kerem', 'Yigit'], Greece: ['Giorgos', 'Nikos', 'Kostas', 'Dimitris'],
  Italy: ['Matteo', 'Luca', 'Leonardo', 'Gabriele'], Slovenia: ['Jaka', 'Luka', 'Zan', 'Gasper'], Israel: ['Yam', 'Noam', 'Ido', 'Omer'], Canada: ['Liam', 'Ethan', 'Owen', 'Jaylen'], Brazil: ['Gabriel', 'Lucas', 'Mateus', 'Davi'] }
const INTL_LAST = { France: ['Moreau', 'Lefevre', 'Diallo', 'Traore', 'Camara', 'Girard', 'Mendy', 'Ndiaye'], Spain: ['Garcia', 'Navarro', 'Ortega', 'Romero', 'Iglesias'],
  Serbia: ['Petrovic', 'Jankovic', 'Milosevic', 'Stojanovic', 'Markovic', 'Lazic'], Germany: ['Becker', 'Hoffmann', 'Schulz', 'Krause', 'Okafor'], Australia: ['Harris', 'Kennedy', 'Walsh', 'Baker'],
  Lithuania: ['Kazlauskas', 'Petrauskas', 'Jankunas', 'Vaitkus'], Turkey: ['Yilmaz', 'Demir', 'Sahin', 'Aydin'], Greece: ['Papadopoulos', 'Nikolaou', 'Georgiou'],
  Italy: ['Rossi', 'Ferrari', 'Esposito', 'Ricci'], Slovenia: ['Kovac', 'Novak', 'Horvat', 'Krajnc'], Israel: ['Cohen', 'Levi', 'Mizrahi', 'Peretz'], Canada: ['Tremblay', 'Gagnon', 'Roy', 'Clarke'], Brazil: ['Silva', 'Santos', 'Oliveira', 'Souza'] }
const SPOT_W = [['PG', 15], ['SG', 21], ['SF', 22], ['PF', 21], ['C', 21]]
const HT = { PG: [72, 77], SG: [75, 79], SF: [77, 81], PF: [79, 83], C: [81, 87] }
const WT = { PG: [175, 200], SG: [185, 210], SF: [200, 225], PF: [215, 240], C: [225, 265] }
export const CLASS_N = 80

export function makeClass(F) {
  const R = rngOf(`${F.seed}-class-${F.year + 1}`)
  const taken = new Set([...leagueNames(F), ...realNames()])
  const out = []
  for (let k = 0; k < CLASS_N; k++) {
    // the man (aging.js prospect: his ceiling by where he'd go, a few far better than their slot; his age, body and
    // ratings now); the international men are a little younger
    const intl = R.chance(0.24)
    const x = X.prospect(R, { rank: k + 1, ...(intl && { ag: R.int(19, 21) }) })
    const { p: spot, g, a, ag, pk } = x
    let n, c
    if (intl) {
      const [cty, club] = R.pick(ABROAD)
      for (let i = 0; i < 20; i++) { n = `${R.pick(INTL_FIRST[cty])} ${R.pick(INTL_LAST[cty])}`; if (!taken.has(n)) break }
      c = `${club} (${cty})`
    } else { n = nameFor(R, 'nba', { taken, real: realNames() }); c = R.pick(COLLEGES) }
    taken.add(n)
    const p = { i: F.nid++, n, p: spot, g, o: ovrOfAttrs(g, a), a, ag, pk,   // (pk under o: a bust)
      ht: x.ht, wt: x.wt, c, yr: ag - 18 }
    // what the scouts see is his ceiling give or take; GEM: he's well past that read, BUST: well short of it
    // (the scouts read the ceiling he shows, not what's hidden: the late bloomer's jump, the top pick who won't
    // develop; aging.js prospect's hid)
    p.seen = clamp(55, 99, Math.round(p.pk - (x.hid ?? 0) + R.n() * 3.5))   // the consensus read of his ceiling (what the board ranks by)
    p.tg = p.pk >= p.seen + 4 ? 'GEM' : p.pk <= p.seen - 4 ? 'BUST' : 'SOLID'
    p.w = R.int(3, 6)                                     // how wide his range shows before he's scouted
    p.sc = 0
    out.push(p)
  }
  // the consensus board: the read of his ceiling, a little of what he is now
  out.sort((a, b) => (b.seen + b.o * 0.25) - (a.seen + a.o * 0.25))
  out.forEach((p, k) => { p.rank = k + 1 })
  F.dc = out
  F.sp = F.sp ?? 0
  return out
}
// the grade he shows: a letter for the ceiling, a range until he's scouted
const LETTERS = [[94, 'A+'], [90, 'A'], [87, 'A-'], [84, 'B+'], [81, 'B'], [78, 'B-'], [75, 'C+'], [72, 'C'], [69, 'C-'], [65, 'D+'], [0, 'D']]
export const gradeOf = v => LETTERS.find(([lo]) => v >= lo)[1]
export function rangeOf(p) {
  if (p.sc >= 2) return { lo: p.pk, hi: p.pk, text: gradeOf(p.pk), tag: p.tg }
  const w = p.sc === 1 ? 2 : p.w
  const mid = p.sc === 1 ? Math.round((p.seen + p.pk) / 2) : p.seen
  const lo = mid - w, hi = mid + w
  const a = gradeOf(lo), b = gradeOf(hi)
  return { lo, hi, text: a === b ? a : `${a} to ${b}` }
}
// scouting: a point narrows his range, a second shows his true ceiling and his tag
export function scout(F, id) {
  const p = (F.dc ?? []).find(x => x.i === id)
  if (!p || p.sc >= 2 || (F.sp ?? 0) <= 0) return false
  F.sp--; p.sc++
  return true
}
// scouting points: two a month through the season (handed out as the days pass), three more in the spring
export function scoutTick(F, was, now) { const m = d => Math.floor(d / 30); if (m(now) > m(was)) F.sp = (F.sp ?? 0) + 2 }
export const scoutSpring = F => { F.sp = (F.sp ?? 0) + 3 }
export const starProspect = (F, id) => { F.board = (F.board ?? []).includes(id) ? F.board.filter(x => x !== id) : [...(F.board ?? []), id] }

// ── The lottery ──────────────────────────────────────────────────────────────
// The 2019 system (through the 2026 draft): the 14 teams out of the playoffs, 1,000 combinations from 140 down to 5,
// four picks drawn, the rest by record. A tie in the standings is broken by a drawing, and the tied teams split
// their combinations evenly (the drawing's winner takes the odd one).
export const ODDS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]
// The 3-2-1 lottery (the Board of Governors, May 28, 2026; the 2027, 2028 and 2029 drafts, and here every draft
// after until the league says otherwise): 16 teams and 37 balls. The ten teams that missed the play-in get three
// balls each, except the three worst records, "draft relegated" to two; the No. 9 and No. 10 play-in seeds two
// each; the losers of the 7-8 games one each (even the one who then wins the No. 8 seed). All 16 picks are drawn;
// a relegated team falls no further than No. 12. No team's own pick goes first in two straight drafts, or top five
// in three straight. A tie at the relegation line is broken by a drawing.
export const LOT321_FROM = 2027
export const BALLS = { out: 3, rel: 2, pi910: 2, pi78: 1 }
// the draft order for F.year + 1: { y, sys, order: [team for slot 1..30], lottery: [{ s, from, to, odds, balls?, rel? }], r2: [...],
//   balls (the 3-2-1's balls in the drum; the 2019 system's 1,000 combinations), drawn (the picks drawn: 16 or 4) }
export function runLottery(F) {
  const R = records(F)
  const y = F.year + 1
  const Ro = rngOf(`${F.seed}-lottery-${y}`)
  // worst first; a tie broken by a drawing (the league's coin flip)
  const flip = Object.fromEntries(SHORTS.map(s => [s, Ro.u()]))
  const worst = SHORTS.slice().sort((a, b) => pct(R[a]) - pct(R[b]) || flip[a] - flip[b])
  const hist = (F.lotH ??= {})
  const last = (s, k) => (hist[s] ?? []).filter(([yy]) => yy >= y - k && yy < y)
  let order, lottery
  if (y >= LOT321_FROM && F.po?.pi && F.po?.seeds) {
    const P = F.po, ball = {}, rel = new Set()
    const top6 = new Set(['E', 'W'].flatMap(c => P.seeds[c].slice(0, 6)))
    const w78 = new Set(['E', 'W'].map(c => P.pi[c]?.w78))
    const pi910 = new Set(['E', 'W'].flatMap(c => P.seeds[c].slice(8, 10)))
    const l78 = new Set(['E', 'W'].map(c => P.pi[c]?.l78))
    const out = worst.filter(s => !top6.has(s) && !w78.has(s) && !pi910.has(s) && !l78.has(s))
    for (const s of out) ball[s] = BALLS.out
    for (const s of out.slice(0, 3)) { ball[s] = BALLS.rel; rel.add(s) }
    for (const s of pi910) ball[s] = BALLS.pi910
    for (const s of l78) ball[s] = BALLS.pi78
    const lot = worst.filter(s => ball[s] != null)
    const total = lot.reduce((a, s) => a + ball[s], 0)
    // the draw: one pick at a time from the balls left; a relegated team still out when the picks to 12 run short
    // of them is drawn among themselves; a team barred from a pick (two straight No. 1s, three straight top fives)
    // sits that draw out
    const left = lot.slice(), won = []
    const barred = (s, n) => (n === 1 && last(s, 1).some(([, k]) => k === 1)) || (n <= 5 && last(s, 2).filter(([, k]) => k <= 5).length >= 2)
    for (let n = 1; n <= lot.length; n++) {
      const relLeft = left.filter(s => rel.has(s))
      let pool = n <= 12 && relLeft.length >= 13 - n ? relLeft : left
      const ok = pool.filter(s => !barred(s, n))
      if (ok.length) pool = ok
      const j = Ro.wpick(pool.map(s => ball[s]))
      const s = pool[j]
      won.push(s); left.splice(left.indexOf(s), 1)
    }
    const rest = worst.filter(s => ball[s] == null)
    order = [...won, ...rest]
    lottery = won.map((s, k) => ({ s, from: lot.indexOf(s) + 1, to: k + 1, odds: Math.round(ball[s] / total * 1000) / 10, balls: ball[s], ...(rel.has(s) && { rel: 1 }) }))
    F.lot = { y, sys: '321', order, r2: worst.slice(), lottery, balls: total, drawn: lottery.length }
  } else {
    const playoff = new Set(Object.values(F.po?.final ?? {}).flat())
    const lot = worst.filter(s => !playoff.has(s)).slice(0, 14)
    // tied records split their slots' combinations evenly; the drawing's winner (flip order) takes the odd one
    const odds = lot.map((s, k) => ODDS[k])
    for (let k = 0; k < lot.length;) {
      let j = k
      while (j + 1 < lot.length && pct(R[lot[j + 1]]) === pct(R[lot[k]])) j++
      if (j > k) {
        const sum = odds.slice(k, j + 1).reduce((a, b) => a + b, 0), n = j - k + 1, each = Math.floor(sum / n)
        for (let m = k; m <= j; m++) odds[m] = each + (m - k < sum - each * n ? 1 : 0)
      }
      k = j + 1
    }
    const left = lot.slice(), won = []
    for (let k = 0; k < 4; k++) {
      const j = Ro.wpick(left.map(s => odds[lot.indexOf(s)]))
      won.push(left[j]); left.splice(j, 1)
    }
    const top14 = [...won, ...left]
    order = [...top14, ...worst.filter(s => playoff.has(s))]
    lottery = top14.map((s, k) => ({ s, from: lot.indexOf(s) + 1, to: k + 1, odds: odds[lot.indexOf(s)] / 10 }))
    F.lot = { y, sys: '2019', order, r2: worst.slice(), lottery, balls: 1000, drawn: 4 }
  }
  const r2 = F.lot.r2
  // each team's own pick's slot, for the rules on straight top picks (the last three drafts)
  for (const x of lottery) hist[x.s] = [...(hist[x.s] ?? []).filter(([yy]) => yy > y - 3), [y, x.to]]
  for (const s of Object.keys(hist)) if (!lottery.some(x => x.s === s)) hist[s] = hist[s].filter(([yy]) => yy > y - 3)
  // the picks: a number on each, protections settled
  const mine = F.picks.filter(p => p.y === y)
  for (const p of mine) {
    const slot = (p.r === 1 ? order : r2).indexOf(p.o) + 1
    p.n = p.r === 1 ? slot : 30 + slot
  }
  for (const p of mine) {
    const slot = p.r === 1 ? p.n : p.n - 30
    if (p.r === 1 && p.pr && slot <= p.pr.top && p.t !== p.o) {
      // protected: it stays home; the debt rolls to the original team's next first it owns, one step looser (the
      // protection halved the first time it rolls, gone the second: top-10, then top-5, then unprotected)
      const owed = p.t, top = p.pr.top
      p.t = p.o
      const nx = F.picks.filter(q => q.y > y && q.r === 1 && q.o === p.o && q.t === p.o).sort((a, b) => a.y - b.y)[0]
      const nTop = p.pr.rl ? 0 : Math.floor(top / 2)
      let owe = ''
      if (nx) {
        nx.t = owed
        nx.pr = nTop >= 1 ? { top: nTop, rl: 1 } : null
        owe = `The ${nick(owed)} are owed their ${nx.y} first, ${nTop >= 1 ? `top-${nTop} protected` : 'unprotected'}`
      } else {
        // (no first of its own left to send: the debt becomes its next two seconds, as the league's deals write it)
        const sec = F.picks.filter(q => q.y > y && q.r === 2 && q.o === p.o && q.t === p.o).sort((a, b) => a.y - b.y).slice(0, 2)
        for (const q of sec) q.t = owed
        owe = sec.length ? `The ${nick(owed)} get their ${sec.map(q => q.y).join(' and ')} second-round picks instead` : ''
      }
      addNews(F, { k: 'pick', tag: 'PROTECTED', s: p.o, text: `The ${nick(p.o)} keep the No. ${slot} pick; it was top-${top} protected.${owe ? ` ${owe}` : ''}` })
      p.pr = null
    }
  }
  // a swap: the holder of the right (its pick carries sw.with) takes the better of the two, whoever owns the other
  // pick now (the swap goes with it when it's traded)
  for (const p of mine) {
    if (p.sw?.with) {
      const q = mine.find(x => x.r === p.r && x.o === p.sw.with)
      if (q && q.n < p.n) { const t = p.t; p.t = q.t; q.t = t }
    }
  }
  for (const p of mine) delete p.sw
  return F.lot
}
export const draftOrder = F => F.picks.filter(p => p.y === F.year + 1).sort((a, b) => a.n - b.n)

// ── Draft night ──────────────────────────────────────────────────────────────
// F.dn: { at: index of the pick on the clock (0..59), made: [{ n, r, t, i }] }
export function openDraft(F) { F.dn = { at: 0, made: [] }; return F.dn }
export const onClock = F => (F.dn && F.dn.at < 60 ? draftOrder(F)[F.dn.at] : null)
export const available = F => (F.dc ?? []).filter(p => !p.dt)
// the CPU's pick: the best man on its board (its own read of each, the consensus plus its scouts' noise), leaning
// toward what the roster lacks: a spot with fewer than two or three men, a frontcourt or backcourt already full (a
// team with seven bigs doesn't take another big unless he's clearly the best man left). The lean is a few points of
// board value: it decides between men close together, never passes a far better prospect.
function cpuPick(F, s) {
  const R = rngOf(`${F.seed}-dn-${F.year}-${s}-${F.dn.at}`)
  const have = F.teams[s].r.filter(p => !p.tw)
  const bigs = have.filter(p => p.g === 'big').length, n = Math.max(1, have.length)
  const need = sp => {
    const at = have.filter(p => p.p === sp).length
    const big = sp === 'PF' || sp === 'C'
    // (a roster's frontcourt is about six of fifteen)
    const share = big ? bigs / n - 6 / 15 : (n - bigs) / n - 9 / 15
    return 1.6 * Math.max(0, 2.5 - at) - 1.2 * Math.max(0, at - 3) - 9 * Math.max(0, share)
  }
  let best = null, bv = -1e9
  for (const p of available(F).slice(0, 30)) {
    // (its scouts know a little more than the consensus, not what nobody can see: a bust looks like a top pick)
    const v = (p.seen * 0.9 + p.pk * 0.1) + p.o * 0.25 + need(p.p) + R.n() * 1.6
    if (v > bv) { bv = v; best = p }
  }
  return best
}
// a second-rounder's deal: about two in three go two-way (the late picks, and the reaches in the 30s); an early
// second-rounder the board rated a first-round talent gets a standard deal (the cap engine's rookieDeal decides
// the money and whether the roster has room)
export const twoWayPick = (n, p) => n > 30 && (n > 41 || (p?.rank ?? 99) > 40)
export function makePick(F, id) {
  const pk = onClock(F)
  if (!pk) return null
  const p = id != null ? available(F).find(x => x.i === id) : cpuPick(F, pk.t)
  if (!p) return null
  p.dt = pk.t
  p.dr = [pk.y, pk.r, pk.n, pk.t]
  p.rk = F.year + 1
  F.dn.made.push({ n: pk.n, r: pk.r, t: pk.t, i: p.i, o: pk.o, ...(twoWayPick(pk.n, p) && { tw: 1 }) })
  F.dn.at++
  return { pick: pk, man: p }
}
// sim to the GM's next pick (or the end); returns the picks made
export function draftTo(F, { stopMine = true } = {}) {
  const made = []
  while (onClock(F)) {
    const pk = onClock(F)
    if (stopMine && pk.t === F.team) break
    made.push(makePick(F))
  }
  return made
}
// the draft done: the men to their teams on rookie deals (firsts the scale; a second-rounder a standard deal or
// two-way), the undrafted onto the street
export function closeDraft(F) {
  const made = F.dn?.made ?? []
  for (const m of made) {
    const p = F.dc.find(x => x.i === m.i)
    if (!p) continue
    const t = F.teams[m.t]
    const keep = rookieOf(p)
    t.r.push(keep)
    // (his deal: the scale for a first-rounder; a second-rounder a standard deal or two-way, the cap engine's call;
    // m.tw says the team means to sign him two-way, and a second-rounder without it gets a standard deal if there's room)
    X.rookieDeal(F, keep, { n: m.n, r: m.r, ...(m.r === 2 && { tw: !!m.tw }) })
  }
  // (a number on every draftee's back: one free on his team)
  for (const s of new Set(made.map(m => m.t))) fixNumbers(F, s)
  F.drafts = { ...(F.drafts ?? {}), [F.year + 1]: made.map(m => ({ ...m, n2: F.dc.find(x => x.i === m.i)?.n })) }
  const top = made.slice(0, 3).map(m => `${m.n}. ${nick(m.t)}: ${F.dc.find(x => x.i === m.i)?.n}`)
  addNews(F, { k: 'draft', tag: 'DRAFT', text: `The ${F.year + 1} draft: ${top.join(', ')}` })
  // the undrafted: onto the street as free agents (summer league, Exhibit 10s, two-way deals: ud = the draft he
  // went undrafted in). The best of them get looks; the rest leave with the street's cut at camp.
  const taken = new Set(made.map(m => m.i))
  const und = F.dc.filter(p => !taken.has(p.i)).map(p => ({ ...rookieOf(p), ys: -1, ud: F.year + 1 }))   // (ys -1: the summer's year brings him to 0, a rookie)
  F.fa = [...(F.fa ?? []), ...und]
  F.dc = []
  F.dn = null
}
// a prospect as a man: the board's fields off, a year younger (the summer's ageLeague makes it his rookie-season age)
function rookieOf(p) {
  const keep = { ...p }
  for (const k of ['seen', 'w', 'sc', 'rank', 'dt', 'tg', 'yr']) delete keep[k]
  keep.ys = 0
  keep.ag = p.ag - 1
  return keep
}
// the drafts kept: the last three in full; older ones as [pick, team, id, name] rows (the history page's): the first
// round, and the second-rounders who made something of it (80+ now, or a career the retired list keeps)
export function pruneDrafts(F) {
  const good = new Set([...Object.values(F.teams).flatMap(T => T.r), ...(F.fa ?? [])].filter(p => p.o >= 80).map(p => p.i))
  for (const r of F.retired ?? []) if (r.k || (r.o ?? 0) >= 80) good.add(r.i)
  F.drafts = Object.fromEntries(Object.entries(F.drafts ?? {}).map(([y, L]) => [y, +y > F.year - 3 ? L
    : L.filter(m => (Array.isArray(m) ? m[0] : m.n) <= 30 || good.has(Array.isArray(m) ? m[2] : m.i)).map(m => (Array.isArray(m) ? m : [m.n, m.t, m.i, m.n2 ?? null]))]))
}
export const lotteryText = L => L.lottery.filter(x => x.to < x.from).map(x => `${x.s} jumps from ${x.from} to ${x.to}`)
export { leagueOrder }
