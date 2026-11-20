// NBA FRANCHISE: the draft. A made-up class each year (about 80 men: freshmen at 19, seniors at 22, international men
// from the pro leagues), scouted through the season; the lottery with the 2019 odds; two rounds, 60 picks.
// Every team's picks for the next seven drafts are in F.picks (B's trades move them): { y, r, o, t, pr, sw, n }.
import { SHORTS, TEAM, attrsFor, ovrOfAttrs, groupOfSpot, leagueNames, realNames, manOf, nick, ROSTER_MAX } from './league'
import { records, pct, leagueOrder } from './season'
import { addNews } from './news'
import { nameFor } from '../names'
import { rngOf, clamp } from '../rng'
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
    // talent by where he'd go: a few franchise prospects, a deep middle, a long tail of second-rounders
    const t = k / CLASS_N
    const pk = clamp(62, 97, Math.round(96 - 30 * Math.pow(t + 0.01, 0.6) + R.n() * 2.4))
    const intl = R.chance(0.24)
    const ag = intl ? R.int(19, 21) : R.wpick([46, 22, 16, 16]) + 19
    const spot = SPOT_W[R.wpick(SPOT_W.map(x => x[1]))][0]
    // now: the gap to his ceiling by age (a 19-year-old is furthest off it)
    const gap = clamp(4, 24, Math.round((23 - ag) * 3.2 + 6 + R.n() * 3))
    const o = clamp(55, 82, pk - gap)
    const a = attrsFor(R, spot, o)
    const g = groupOfSpot(spot)
    let n, c
    if (intl) {
      const [cty, club] = R.pick(ABROAD)
      for (let i = 0; i < 20; i++) { n = `${R.pick(INTL_FIRST[cty])} ${R.pick(INTL_LAST[cty])}`; if (!taken.has(n)) break }
      c = `${club} (${cty})`
    } else { n = nameFor(R, 'nba', { taken, real: realNames() }); c = R.pick(COLLEGES) }
    taken.add(n)
    const p = { i: F.nid++, n, p: spot, g, o: ovrOfAttrs(g, a), a, ag, pk, ht: R.int(...HT[spot]), wt: R.int(...WT[spot]), c, yr: ag - 18 }
    // his true ceiling sits somewhere in what the scouts first see; GEM: he'll beat it, BUST: he won't get near it
    p.tg = R.chance(0.12) ? 'GEM' : R.chance(0.14) ? 'BUST' : 'SOLID'
    if (p.tg === 'GEM') p.pk = clamp(64, 99, p.pk + R.int(4, 8))
    if (p.tg === 'BUST') p.pk = Math.max(p.o + 2, p.pk - R.int(5, 10))
    p.seen = clamp(60, 99, Math.round(pk + R.n() * 4))   // the consensus read of his ceiling (what the board ranks by)
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
export const ODDS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]
// the draft order for F.year + 1: { order: [team for slot 1..30], lottery: [{ s, from, to, odds }], r2: [...] }
export function runLottery(F) {
  const R = records(F)
  const Ro = rngOf(`${F.seed}-lottery-${F.year + 1}`)
  const playoff = new Set(Object.values(F.po?.final ?? {}).flat())
  // worst first; a tie broken by a drawing (the league's coin flip)
  const flip = Object.fromEntries(SHORTS.map(s => [s, Ro.u()]))
  const worst = SHORTS.slice().sort((a, b) => pct(R[a]) - pct(R[b]) || flip[a] - flip[b])
  const lot = worst.filter(s => !playoff.has(s)).slice(0, 14)
  const left = lot.slice(), won = []
  for (let k = 0; k < 4; k++) {
    const w = left.map(s => ODDS[lot.indexOf(s)])
    const j = Ro.wpick(w)
    won.push(left[j]); left.splice(j, 1)
  }
  const top14 = [...won, ...left]
  const rest = worst.filter(s => playoff.has(s))   // the playoff teams, worst record first
  const order = [...top14, ...rest]
  const r2 = worst.slice()
  const lottery = top14.map((s, k) => ({ s, from: lot.indexOf(s) + 1, to: k + 1, odds: ODDS[lot.indexOf(s)] / 10 }))
  F.lot = { y: F.year + 1, order, r2, lottery }
  // the picks: a number on each, protections settled
  const y = F.year + 1
  for (const p of F.picks.filter(p => p.y === y)) {
    const slot = (p.r === 1 ? order : r2).indexOf(p.o) + 1
    p.n = p.r === 1 ? slot : 30 + slot
    if (p.r === 1 && p.pr && slot <= p.pr.top && p.t !== p.o) {
      // protected: it stays home; the debt rolls to next year's first, same protection, until it conveys
      const owed = p.t
      p.t = p.o
      const nx = F.picks.find(q => q.y === y + 1 && q.r === 1 && q.o === p.o)
      if (nx && nx.t === p.o) { nx.t = owed; nx.pr = { top: p.pr.top } }
      addNews(F, { k: 'pick', tag: 'PROTECTED', s: p.o, text: `The ${nick(p.o)} keep the No. ${slot} pick; it was top-${p.pr.top} protected. The ${nick(owed)} are owed their ${y + 1} first` })
      p.pr = null
    }
    // a swap: the owner takes the better of the two
    if (p.sw) {
      const q = F.picks.find(x => x.y === y && x.r === p.r && x.o === p.sw.with)
      if (q && q.n < p.n && q.t === p.sw.with) { const t = p.t; p.t = q.t; q.t = t }
      delete p.sw
    }
  }
  return F.lot
}
export const draftOrder = F => F.picks.filter(p => p.y === F.year + 1).sort((a, b) => a.n - b.n)

// ── Draft night ──────────────────────────────────────────────────────────────
// F.dn: { at: index of the pick on the clock (0..59), made: [{ n, r, t, i }] }
export function openDraft(F) { F.dn = { at: 0, made: [] }; return F.dn }
export const onClock = F => (F.dn && F.dn.at < 60 ? draftOrder(F)[F.dn.at] : null)
export const available = F => (F.dc ?? []).filter(p => !p.dt)
// the CPU's pick: the best man on its board (its own read of each, the consensus plus its scouts' noise), a little
// toward the spots it's short at
function cpuPick(F, s) {
  const R = rngOf(`${F.seed}-dn-${F.year}-${s}-${F.dn.at}`)
  const have = F.teams[s].r
  const need = sp => Math.max(0, 3 - have.filter(p => p.p === sp).length)
  let best = null, bv = -1e9
  for (const p of available(F).slice(0, 30)) {
    const v = (p.seen * 0.75 + p.pk * 0.25) + p.o * 0.25 + need(p.p) * 0.6 + R.n() * 1.6
    if (v > bv) { bv = v; best = p }
  }
  return best
}
export function makePick(F, id) {
  const pk = onClock(F)
  if (!pk) return null
  const p = id != null ? available(F).find(x => x.i === id) : cpuPick(F, pk.t)
  if (!p) return null
  p.dt = pk.t
  p.dr = [pk.y, pk.r, pk.n, pk.t]
  p.rk = F.year + 1
  F.dn.made.push({ n: pk.n, r: pk.r, t: pk.t, i: p.i, o: pk.o })
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
// the draft done: the men to their teams on rookie deals (firsts the scale; a second-rounder signs if there's room
// or goes two-way, else his rights are held and he stays unsigned: off the roster)
export function closeDraft(F) {
  const made = F.dn?.made ?? []
  for (const m of made) {
    const p = F.dc.find(x => x.i === m.i)
    if (!p) continue
    const t = F.teams[m.t]
    const keep = { ...p }
    for (const k of ['seen', 'w', 'sc', 'rank', 'dt', 'tg', 'yr']) delete keep[k]
    keep.ys = 0
    keep.ag = p.ag - 1   // (his age on draft night; the summer's ageLeague makes it his rookie-season age)
    if (m.r === 2 && t.r.filter(x => !x.tw).length >= ROSTER_MAX + 3 && t.r.filter(x => x.tw).length < 3) { keep.tw = 1; keep.$ = 0.6; keep.y = 2 }
    else X.rookieDeal(F, keep, { n: m.n, r: m.r })
    t.r.push(keep)
  }
  F.drafts = { ...(F.drafts ?? {}), [F.year + 1]: made.map(m => ({ ...m, n2: F.dc.find(x => x.i === m.i)?.n })) }
  const top = made.slice(0, 3).map(m => `${m.n}. ${nick(m.t)}: ${F.dc.find(x => x.i === m.i)?.n}`)
  addNews(F, { k: 'draft', tag: 'DRAFT', text: `The ${F.year + 1} draft: ${top.join(', ')}` })
  F.dc = []
  F.dn = null
}
export const lotteryText = L => L.lottery.filter(x => x.to < x.from).map(x => `${x.s} jumps from ${x.from} to ${x.to}`)
export { leagueOrder }
