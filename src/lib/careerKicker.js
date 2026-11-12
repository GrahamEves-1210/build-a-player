// A kicker's Career: the parts that are his alone. The engine is lib/career.js (one engine, the SPORT table); this
// file holds what the table can't say in a line: his stat line, the honors' bars, the building he kicks in, the
// records he chases (the league's and each franchise's own, from data/k-legends.js), his streak of makes, the summer
// he gets cut, the franchise tag, his interviews and his offseasons. Pure: nothing here imports career.js.
//
//   - He is never hurt (SPORT.nfl.noInjury; his own scenario bank in lib/scenarios.js).
//   - He goes late in the draft or not at all (SPORT.nfl.draft.stock, runDraft's udfa), and a veteran ahead of him
//     keeps the job until he misses his way out of it.
//   - Careers run long: the leg fades from 37, slowly; he can kick until 43 (45 if he's still good), 24 seasons at most.
//   - No MVP for a kicker: the Pro Bowl and the All-Pro team are the top of it, and the Hall takes almost nobody.
import { seeded } from './rng'
import { K_DOMES, K_WINDY, K_COLD } from './kicks'
import { K_LEGENDS } from '../data/k-legends'
import { KS } from '../data/ks'

const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const r10 = x => Math.round(x * 10) / 10
export const kValsOf = b => ({ power: b?.power?.val ?? 5, accuracy: b?.accuracy?.val ?? 5, clutch: b?.clutch?.val ?? 5 })

// ── The season line ─────────────────────────────────────────────────────────
// (fgPct and long are rates: never summed into a career; careerTotals works them out again)
export const kSeasonStats = f => ({
  fgm: f.seasonFGM ?? 0, fga: f.seasonFGA ?? 0, fgPct: f.seasonFGPct ?? 0, long: f.seasonLong ?? 0,
  m50: f.season50M ?? 0, a50: f.season50A ?? 0, xpm: f.seasonXPM ?? 0, xpa: f.seasonXPA ?? 0,
  points: f.seasonPoints ?? 0, gw: f.seasonGW ?? 0, cost: f.seasonCostly ?? 0,
})
// What gets a kicker there. One Pro Bowl kicker a conference, one First-Team All-Pro in the league: Vinatieri made
// three of each in 24 seasons, Andersen seven Pro Bowls in 25, Tucker seven and five. The season sim kicks on the
// league's real scale (lib/kicks.js: a median starter is 86% on 33 tries, a tenth of starters are over 93%), so the
// bars are real ones: a Pro Bowl year is 93% with six from 50 and out (or 90% with ten, or 96% on 28 tries),
// All-Pro 95% with seven (or 91% with twelve, or 97.5% with five), on at least 28 tries. And then the field: there
// is one spot, and most years somebody else kicked like that too. A year at the bar gets a 99 overall kicker there
// about one time in three (the Pro Bowl) or six (All-Pro), a year clear of it about twice as often, and a lesser leg
// less often (legTilt). Seeded by the career and the year, so a season's honors are the same every time it's read.
// (2026-11-12: for a day the bars sat at 97.5% and 98.5%, set against a sim that ran at 96% on 40 tries; before
// that at 91% and 94% against the same sim, which nearly every season cleared.)
const enough = s => (s.fga ?? 0) >= 20
const field = (c, tag) => seeded(`${c?.seed ?? 'k'}-${tag}-${c?.year ?? 0}`)()
// (the voters know the leg: the same line from a 99 overall kicker gets the nod over a 93's. 99: in full, 97: about half, 95: a sixth, 93 and under: one in twenty)
const legTilt = c => Math.max(0.05, Math.min(1, ((c?.ovr ?? 99) - 90) / 9) ** 3)
const pbBar = s => enough(s) && ((s.fgPct >= 93 && (s.m50 ?? 0) >= 6) || (s.fgPct >= 90 && (s.m50 ?? 0) >= 10) || (s.fgPct >= 96 && (s.fga ?? 0) >= 28))
const pbClear = s => (s.fgPct >= 96 && (s.m50 ?? 0) >= 8) || (s.fgPct >= 93 && (s.m50 ?? 0) >= 12)
const apBar = s => (s.fga ?? 0) >= 28 && ((s.fgPct >= 95 && (s.m50 ?? 0) >= 7) || (s.fgPct >= 91 && (s.m50 ?? 0) >= 12) || (s.fgPct >= 97.5 && (s.m50 ?? 0) >= 5))
const apClear = s => (s.fgPct >= 97 && (s.m50 ?? 0) >= 9) || (s.fgPct >= 93 && (s.m50 ?? 0) >= 13)
export const K_BARS = {
  proBowl: (s, c) => pbBar(s) && field(c, 'kpb') < (pbClear(s) ? 0.55 : 0.32) * legTilt(c),
  allPro: (s, c) => apBar(s) && field(c, 'kap') < (apClear(s) ? 0.33 : 0.16) * legTilt(c),
  near: s => enough(s) && s.fgPct >= 94 && (s.m50 ?? 0) >= 7,
}
// A kicker's legacy, weighed for a kicker (lib/career.js legacyScore reads these for him and for the real kickers on
// the list alike). He plays 24 seasons and is never hurt, and his team's playoff trips and rings say less about him
// than a quarterback's do: a season counts 0.5 (not 2), a playoff year 1 (not 3), a ring 8 (not 20). One record
// counts at most (the season and career marks all fall to anyone who kicks long enough here), and the points are
// worth one legacy point per 300 with 0.15 a game-winner. Honors count in full: they are what sets a kicker apart.
export const K_LEGACY = { seasons: 0.5, playoffs: 1, rings: 8, recordsMax: 1, perPoints: 300, gw: 0.15 }
// how good a year it was, 0 to about 1.1: the percentage first, then the long ball, the kicks that won games, the team
export const kSeasonScore = s => {
  const st = s.stats ?? {}
  if (!(st.fga > 0)) return 0
  return clamp((st.fgPct - 70) / 25, 0, 1.1) * 0.5 + Math.min(1.2, (st.m50 ?? 0) / 9) * 0.14 + clamp(((st.gw ?? 0) - (st.cost ?? 0)) / 4, -0.5, 1) * 0.1 + (s.wins ?? 0) / 15 * 0.26
}

// ── The building ────────────────────────────────────────────────────────────
export function kHome(short) {
  if (K_DOMES.has(short)) return { tag: 'dome', v: 9, word: 'Indoors' }
  if (short === 'DEN') return { tag: 'altitude', v: 10, word: 'A mile high' }
  if (K_WINDY.has(short)) return { tag: 'wind', v: 3, word: 'Open air, cold and wind' }
  if (K_COLD.has(short)) return { tag: 'cold', v: 4, word: 'Open air, cold Decembers' }
  return { tag: 'clear', v: 6, word: 'Open air, mild' }
}
export const kFitNote = f => (f.home === 'dome' ? 'Half his games are indoors: no wind, a dry ball. The best home a kicker can have.'
  : f.home === 'altitude' ? 'A mile above sea level. The ball carries: his range is about three yards longer at home.'
  : f.home === 'wind' ? 'Open air, and the wind swirls here from November on. December kicks in this building are earned.'
  : f.home === 'cold' ? 'Open air and cold Decembers. The ball gets hard and the long ones come up short.'
  : f.offense >= 8 ? 'An offense that lives in his range. Plenty of tries, most of them makeable.'
  : f.offense < 5 ? 'An offense that stalls early. Fewer tries, and more of them from deep.'
  : 'Open air and mild weather. An honest place to kick.')

// ── The franchise's own records (data/k-legends.js: each franchise's best kickers, with their longest and their points) ──
const FR = {}
for (const p of K_LEGENDS) {
  const f = (FR[p.team] ??= { long: 0, longBy: '', points: 0, pointsBy: '' })
  if ((p.long ?? 0) > f.long) { f.long = p.long; f.longBy = p.name }
  if ((p.points ?? 0) > f.points) { f.points = p.points; f.pointsBy = p.name }
}
// (today's kicker may have gone past the old long since)
for (const p of KS) { const f = (FR[p.team] ??= { long: 0, longBy: '', points: 0, pointsBy: '' }); if ((p.long ?? 0) > f.long) { f.long = p.long; f.longBy = p.name } }
export const kFranchise = short => FR[short] ?? { long: 0, longBy: '', points: 0, pointsBy: '' }
// The league's career marks a kicker chases (the season director calls the single-season and single-game ones)
export const K_CAREER_MARKS = [
  { id: 'kc-points', label: 'Career points', get: t => t.stats?.points, value: 2673, holder: 'Adam Vinatieri, 1996-2019' },
  { id: 'kc-fgm', label: 'Career field goals', get: t => t.stats?.fgm, value: 599, holder: 'Adam Vinatieri, 1996-2019' },
  { id: 'kc-streak', label: 'Consecutive field goals made', get: (t, k) => k?.bestStreak, value: 44, holder: 'Adam Vinatieri, 2015-16' },
]

// ── After a season: the streak, the records, the job ────────────────────────
// c: the career with the season booked (c.seasons ends with s). f: the season as it was played (its games carry
// every kick). Returns the career with c.k moved on and the season's own notes added (s.kick, s.milestones, s.records).
export function kAfterSeason(c, s, f, { nick = 'team', totals = null } = {}) {
  const k0 = c.k ?? {}
  // the streak of makes, kick by kick, regular season then playoffs, carried from last year
  let streak = k0.streak ?? 0, best = k0.bestStreak ?? 0
  const games = [...(f.games ?? []).filter(g => !g.sat), ...(f.playoffRounds ?? [])]
  for (const g of games) for (const x of g.kicks ?? []) { if (x.good) { streak++; if (streak > best) best = streak } else streak = 0 }
  const st = s.stats ?? {}
  const notes = [], records = []
  // franchise records: his longest for this team, and his points for it
  const fr = kFranchise(s.team)
  const teamLong = { ...(k0.teamLong ?? {}) }, teamPts = { ...(k0.teamPts ?? {}) }
  const hadLong = Math.max(teamLong[s.team] ?? 0, fr.long)
  if ((st.long ?? 0) > hadLong && st.long >= 50) notes.push(`${nick} record: a ${st.long}-yard field goal${fr.longBy && !(teamLong[s.team] > fr.long) ? ` (was ${fr.long}, ${fr.longBy})` : ''}`)
  teamLong[s.team] = Math.max(teamLong[s.team] ?? 0, st.long ?? 0)
  const before = teamPts[s.team] ?? 0
  teamPts[s.team] = before + (st.points ?? 0)
  if (fr.points && before <= fr.points && teamPts[s.team] > fr.points) notes.push(`${nick} all-time leading scorer: ${teamPts[s.team].toLocaleString()} points (was ${fr.points.toLocaleString()}, ${fr.pointsBy})`)
  if (best >= 20 && best > (k0.bestStreak ?? 0) && best % 5 === 0) notes.push(`${best} field goals in a row`)
  // the league's career marks: the season he goes past one
  if (totals) for (const m of K_CAREER_MARKS) {
    const v = m.get(totals, { bestStreak: best }) ?? 0
    if (v > m.value && !(k0.marks ?? []).includes(m.id)) records.push(m)
  }
  // the job: a bad year puts him on notice, and a second one (or a truly bad one) gets him released.
  // Released: his deal is torn up, his own team doesn't call, and what's out there is a one-year deal and a camp battle
  const bad = (st.fga ?? 0) >= 15 && (st.fgPct < 76 || (st.cost ?? 0) >= 3 && st.fgPct < 82)
  const awful = (st.fga ?? 0) >= 15 && st.fgPct < 70
  const hot = bad ? (k0.hot ?? 0) + 1 : Math.max(0, (k0.hot ?? 0) - 1)
  const r = seeded(`${c.seed}-kcut-${c.year}`)
  // (a rookie deal buys a little patience; so does a name)
  const patience = (c.contract?.kind === 'rookie' ? 0.25 : 0) + ((c.rep ?? 5) >= 8 ? 0.2 : 0)
  // (a veteran who never got on the field all year isn't kept around to hold a clipboard: a kicker who loses the job is released)
  const sat = (st.fga ?? 0) === 0 && c.seasons.length > 1
  const cut = sat || c.role !== 'Backup' && (awful ? r() < 0.85 - patience : bad && hot >= 2 ? r() < 0.75 - patience : bad ? r() < 0.3 - patience : false)
  const k = { ...k0, streak, bestStreak: best, teamLong, teamPts, hot: cut ? 0 : hot, marks: [...(k0.marks ?? []), ...records.map(m => m.id)], cut: cut ? { from: s.team, year: s.year, pct: st.fgPct } : null, cuts: (k0.cuts ?? 0) + (cut ? 1 : 0), tagged: k0.tagged ?? 0 }
  const s2 = { ...s, kick: { streak, best, hot: bad }, milestones: [...(s.milestones ?? []), ...notes], records: [...(s.records ?? []), ...records.map(m => m.label)], ...(cut ? { released: true } : {}) }
  const seasons = c.seasons.map(x => (x === s ? s2 : x))
  let next = { ...c, k, seasons }
  if (cut) {
    next = { ...next, contract: { ...next.contract, left: 0 }, rep: Math.max(1, (next.rep ?? 5) - 1),
      events: [...(next.events ?? []), { year: s.year, text: sat ? `The ${nick} release ${c.name} after a season on the bench. He is a free agent.` : `The ${nick} release ${c.name} after a ${st.fgPct}% season. He is a free agent.` }] }
  }
  return next
}

// ── Free agency, a kicker's way ─────────────────────────────────────────────
// list: the engine's three offers (stay, contender, payer). mk / fitAt / value / top / r: its own tools.
//   released   his old team doesn't call; what's left is one year, cheap, and a job he has to win in camp
//   the tag    a good kicker in his prime doesn't reach the market: the franchise tag (one year at the top of the
//              kicker market), or the long-term deal the tag is there to force. At most twice in a career.
export function kMarket(c, list, { mk, fitAt, value, top, r }) {
  const k = c.k ?? {}
  if (k.cut) {
    const lo = Math.max(0.9, value * 0.5)
    return list.filter(o => o.kind !== 'stay').map((o, i) => ({ ...o, kind: 'camp', years: 1, perYear: r10(Math.max(0.9, Math.min(o.perYear, lo * (i ? 1.15 : 1)))), pitch: i ? 'One year, a little more money, and a rookie in camp to beat out.' : 'One year at the minimum and a camp competition. Win the job and it is his.' }))
  }
  const last = c.seasons[c.seasons.length - 1]
  const good = last && kSeasonScore(last) >= 0.6 && (last.stats?.fgPct ?? 0) >= 86
  if (good && c.age <= 35 && (k.tagged ?? 0) < 2 && r() < 0.5) {
    const stay = list.find(o => o.kind === 'stay')
    return [
      { ...mk(fitAt(c.team), top * 0.9, 1, 'The franchise tag: one year at the top of the kicker market. He can sign it, or sign the long-term deal.', 'tag'), tag: true },
      ...(stay ? [{ ...stay, years: Math.max(3, stay.years), perYear: r10(Math.max(stay.perYear, value)), pitch: 'The long-term deal. Less a year than the tag, and four years of knowing where he kicks.' }] : []),
    ]
  }
  return list
}
// signing: the tag is counted, and a release is behind him
export const kSigned = (c, o) => (c.pos !== 'k' ? c : { ...c, k: { ...(c.k ?? {}), cut: null, tagged: (c.k?.tagged ?? 0) + (o?.tag ? 1 : 0), camp: o?.kind === 'camp' ? { year: c.year + 1 } : null } })

// ── The playoffs ────────────────────────────────────────────────────────────
// Which moment a round deals a kicker. A game that isn't close: the long field goal. A close one: the kick to win
// it, or, when the team was behind at the end (its own roll, about a round in nine), the onside kick.
export function kPlayoffGame(c, po, allow = null) {
  const rd = po.rounds[po.idx]
  const ok = g => !allow || allow(g)
  if (rd?.close === false) return ok('deep-kick') ? 'deep-kick' : 'game-winner'
  const u = seeded(`${c.seed}-kon-${c.year}-${po.idx}`)
  const behind = u() >= (rd?.p ?? 0.5)
  if (behind && u() < 0.45 && ok('onside')) return 'onside'
  return ok('game-winner') ? 'game-winner' : 'deep-kick'
}
// His line in a playoff game, read off the final score: field goals and extra points that add up to what his team
// scored. hit / game: the round's moment (a made game-winner is on the board).
export function kPlayoffLine(mySc, { hit = false, game = null, acc = 5, u = 0.5 } = {}) {
  const want = Math.min(4, Math.round(1 + u * 2.4))
  let best = null
  for (let fg = 0; fg <= 5; fg++) {
    const rem = mySc - 3 * fg
    if (rem < 0) break
    const left = rem % 7, miss = Math.abs(fg - want) + (left === 0 ? 0 : left === 6 ? 1.5 : 6) + (hit && game === 'game-winner' && fg === 0 ? 9 : 0)
    if (!best || miss < best.miss) best = { fg, td: Math.floor(rem / 7) + (left === 6 ? 1 : 0), left, miss }
  }
  const fgm = best?.fg ?? 0, tds = best?.td ?? 0
  const missedLast = !hit && (game === 'game-winner' || game === 'deep-kick') ? 1 : 0
  const other = u < (11 - acc) * 0.035 ? 1 : 0
  const xpm = best?.left === 6 ? Math.max(0, tds - 1) : tds
  return { fgm, fga: fgm + missedLast + other, xpm, xpa: tds, points: fgm * 3 + xpm, ...(hit && game === 'game-winner' ? { gw: 1 } : {}) }
}

// ── The draft rooms ─────────────────────────────────────────────────────────
export const K_INTERVIEWS = [
  { who: 'Special teams coordinator', q: 'Fourth quarter, down two, 54 yards, wind in your face. I look at you. What do you tell me?', a: [
    { t: 'What my number was in warmups. If it was 52 into that wind, I say punt it.', stock: 2, persona: 'grinder' },
    { t: 'Send me out. I make that kick.', stock: 1, persona: 'confident' },
    { t: 'I don\'t miss from 54.', stock: -1, persona: 'cocky' } ] },
  { who: 'General manager', q: 'We have a veteran who has been here nine years. You\'d be in camp to compete with him. Thoughts?', a: [
    { t: 'Chart every kick in camp and keep the better man. That\'s all I\'m asking for.', stock: 2, persona: 'confident' },
    { t: 'I\'ll learn everything I can from him, and I\'ll be ready.', stock: 1, persona: 'grinder' },
    { t: 'With respect, he\'s kicking on borrowed time.', stock: -2, persona: 'cocky' } ] },
  { who: 'Head coach', q: 'You missed two in your bowl game. Walk me through the week after.', a: [
    { t: 'Watched both on film Monday. One was a plant foot, one was the wind. Then I kicked Tuesday like nothing happened.', stock: 2, persona: 'grinder' },
    { t: 'I didn\'t change a thing. The next kick is the only one that counts.', stock: 1, persona: 'confident' },
    { t: 'The hold was bad on both of them.', stock: -2, persona: 'cocky' } ] },
  { who: 'Area scout', q: 'Nobody drafts kickers high. Does it bother you to be here on the third day, or not picked at all?', a: [
    { t: 'Half the kickers in this league weren\'t drafted. I just need a camp.', stock: 2, persona: 'grinder' },
    { t: 'Whoever picks me gets fifteen years out of it. That\'s worth a pick.', stock: 1, persona: 'confident' },
    { t: 'A team that waits is going to watch me beat them.', stock: -1, persona: 'cocky' } ] },
  { who: 'Special teams coordinator', q: 'Kickoffs. We want it on the ground inside the 5, to the corner, every time. Can you place it?', a: [
    { t: 'That\'s most of what I worked on this spring. I\'ll show you on the field.', stock: 2, persona: 'grinder' },
    { t: 'Corner, hash, wherever you want it.', stock: 1, persona: 'confident' },
    { t: 'I\'d rather just put it through the end zone.', stock: -1, persona: 'cocky' } ] },
]

// ── His offseasons ──────────────────────────────────────────────────────────
// (the engine's own list is for men who get hit and get the ball: none of it is a kicker's summer)
export const K_EVENTS = [
  { id: 'k-stc', w: 3, text: t => `The ${t} hire a new special teams coordinator. A new voice on the sideline when the game is on his foot.`, apply: () => ({}) },
  { id: 'k-holder', w: 2, text: t => `The ${t} draft a punter. A new holder: the snap, the spot and the laces start over in camp.`, apply: () => ({}) },
  { id: 'k-snapper', w: 2, good: true, text: t => `The ${t} re-sign the long snapper. Snap, hold, kick: the operation stays together.`, apply: c => ({ rep: Math.min(10, (c.rep ?? 5) + 0) }) },
  { id: 'k-offense', w: 2, text: t => `The ${t} add a quarterback and two receivers. More drives are going to end in his range.`, apply: () => ({ nextMods: { off: 1 } }) },
  { id: 'coach-fired', w: 2, when: c => c.seasons[c.seasons.length - 1]?.wins <= 6, text: t => `The ${t} fire the head coach after a lost season. A new staff decides who kicks.`, apply: () => ({ nextMods: { off: -0.5, def: -0.5 } }) },
  { id: 'defense-up', w: 2, text: t => `The ${t} spend big on defense. More close games, and more of them decided by three.`, apply: () => ({ nextMods: { def: 1 } }) },
  { id: 'k-coach', w: 2, good: true, when: c => c.age <= 31, text: (t, c) => `${c.name} spends the spring with a private kicking coach. Shorter steps, the same plant every time.`, apply: c => ({ dev: { ...c.dev, points: c.dev.points + 1 } }) },
  { id: 'k-camp-leg', w: 3, bad: true, when: c => (c.seasons[c.seasons.length - 1]?.stats?.fgPct ?? 100) < 82, text: t => `The ${t} bring a rookie kicker to camp. A competition, the coach says.`, apply: c => ({ rep: Math.max(1, (c.rep ?? 5) - 1) }) },
  { id: 'k-turf', w: 1, text: t => `New turf goes in at the ${t}' stadium. The footing on the hashes is firm again.`, apply: () => ({}) },
  { id: 'captain', w: 2, when: c => c.rep >= 8, text: t => `The ${t} vote him a special teams captain.`, apply: c => ({ rep: Math.min(10, c.rep + 1) }) },
  { id: 'quiet', w: 3, text: () => `A quiet offseason. Three hundred balls a week on an empty field, and camp opens.`, apply: () => ({}) },
]

// ── The combine: a kicker's workout, as the scouts write it down ────────────
export const K_DRILLS = {
  'deep-kick': (v, score, raw) => { const of = raw?.of ?? 4, m = raw?.made ?? Math.round(clamp(score, 0, 1) * of); return { text: `${m} of ${of} from 50 and out`, pct: clamp((m / of - 0.45) * 2.2, -1, 1) } },
  'game-winner': (v, score, raw) => { const made = raw?.made != null ? raw.made > 0 : score >= 0.5; return { text: raw?.dist ? `${made ? 'Good' : 'No good'} from ${raw.dist}, the scouts on the sideline` : made ? 'Made the pressure kick' : 'Missed the pressure kick', pct: made ? 0.6 : -0.7 } },
}
