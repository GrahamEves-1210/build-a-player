// CAREER, SOCCER: the striker's career, its own module. lib/career.js runs every sport on one engine; soccer's
// rules, its data and its engine live here, so a football or basketball career never downloads them. career.js
// loads this with ensureSport('soccer') and this file registers SPORT.soccer (registerSport) when it runs.
// The academy (trials, the scouts and coaches, the first contract), the club season (the league through the season
// director, then the big nights), the transfer window, international duty and the World Cup, the awards and legacy.
// Since 2026-11-24: all five leagues; the clubs' money by what they earn and a player's by what he's worth; a window
// with every big club in it, release and relegation clauses, a January window; a league table through the season and
// each league's real European places (the Conference League among them); relegation into a second tier he can stay
// in; national teams that age, qualify and play the continental championships (lib/soccerIntl.js).
import {
  SPORT, registerSport, depthChart, teamFit, makeRoster, seasonScore, bookSeason, closeChance, playoffPlan,
  countedHonors, earnLegacy, HOF_LEGACY, CAREER_X,
} from './career'
import { seeded } from './rng'
import { momentFacts } from './situations'
import { playMoment } from './inGame.js'
import { RECORDS } from './seasonFacts'
import { seasonRaw } from './careerStats'
import { HEADSHOT_BASE } from '../utils/simulation'
import { runSoccerSimulation, calcSoccerOVR, soccerTeam10, soccerLeagueInfo, soccerEuropePlaces, soccerTableAt } from '../utils/soccerSimulation'
// (Career plays all five leagues since 2026-11-24: its clubs are SOCCER_CAREER_CLUBS, the 96, each with its revenue;
// Squad Builder's SOCCER_CLUBS stays the three)
import { SOCCER_CAREER_CLUBS as SOCCER_CLUBS } from '../data/soccer-clubs'
// (Career's national teams are the real ones, not WORLD CUP mode's legends: the 48 of 2026 and the countries that
// stayed at home, CAREER_NATIONS; years on they're read through lib/soccerIntl.js)
import { CAREER_NATIONS } from '../data/soccer-nations'
import { SOCCER_ALL_STRIKERS, WC2026_STRIKERS as WC_STRIKERS, ST_TYPES } from '../data/soccer-strikers'
import { worldCupOf, continentalOf, continentalField, peckingOrder, intlNation } from './soccerIntl'
import { SOCCER_ATTR } from '../data/soccer-attrs'
import SOCCER_HEADSHOTS from '../data/soccer-headshots.json'
import { SOCCER_RESUMES } from '../data/legacy-resumes-soccer'
import './soccerFacts'       // the records and milestones (lib/seasonFacts.js RECORDS.soccer)
import './soccerSeason'      // the season's story cards and the in-match moments (scenarios.js, gameMoments.js)
import { soccerFinal } from './soccerDirector'
import { registerStats } from './careerStats'
import { SOCCER_DEFS } from './soccerStats'

const { rosterOf, keepRoster, rosterYrs, outOf, LAST_PLAY, strength, goalMet, buildOf, avgOvr, byOvr, clamp, r10, FIRST_SEASON } = CAREER_X
// the players of Career's clubs (every league it plays)
const CAREER_SHORTS = new Set(SOCCER_CLUBS.map(c => c.short))
const SOCCER_STRIKERS = SOCCER_ALL_STRIKERS.filter(p => CAREER_SHORTS.has(p.team))
const WC_NATIONS = CAREER_NATIONS

// ── Soccer: a striker at a club in Europe's top five leagues (the rest of the soccer career is below, "Soccer") ──
// The club season is the soccer engine's (league, cup, Europe); Career plays the league match by match through the
// season director, then the big nights (the cup final, the European knockouts) one at a time like a bracket.
const SOCCER = {
  id: 'soccer', league: 'TOP DIVISIONS', isBucket: false, isSoccer: true, screen: 'ag-screen--soccer',
  teams: SOCCER_CLUBS, logo: s => `/logos/soccer/${s}.png`,
  teamOf: short => soccerClub(short),
  status: core => (core >= 7.6 ? 'Title contender' : core >= 6.4 ? 'Chasing Europe' : core >= 5 ? 'Mid-table' : 'Relegation fight'),
  positions: ['st'], soon: [['gk', 'GK']],
  side: { st: 'off' },
  label: { st: 'ST' }, posName: { st: 'Striker' },
  types: { st: ST_TYPES }, attr: { st: SOCCER_ATTR },
  // the club's forwards: the men a No. 9 competes with for the shirt (a winger or a midfielder on the list doesn't)
  pool: { st: SOCCER_STRIKERS.filter(isNine) },
  groups: ['st'], starters: { st: 1 }, keep: { st: 4 }, slots: {},
  depthLabel: (pos, i) => (i === 1 ? 'FIRST CHOICE' : i === 2 ? 'ROTATION' : 'BENCH'),
  ovr: (pos, b) => calcSoccerOVR(b, ST_TYPES),
  realOvr: (pos, p) => Math.round(p.ovr ?? calcSoccerOVR(buildOf(ST_TYPES, p), ST_TYPES)),
  photo: name => soccerPhoto(SOCCER_BY_NAME.get(name)),
  sim: () => (b, t, seed) => trimSoccer(runSoccerSimulation(b, ST_TYPES, t, 'current', seed ?? null)),
  // what the engine plays: the club on Career's 1-10 scale, his share of the chances from his role
  simTeam: (t, fit, m, c) => {
    const role = soccerRole(c)
    // (a great one gets the chances, but past 92 the engine's line runs far beyond any real No. 9's: he's marked
    // out of games, he shares the penalties and the box. A teenager gets fewer; the thirties take some away)
    const o = c.ovr ?? 80, age = c.age ?? 25
    const usage = clamp(0.9 + (Math.min(o, 92) - 85) * 0.01 - Math.max(0, o - 92) * USAGE_TOP, 0.75, 1) * (age <= 19 ? 0.86 : age <= 21 ? 0.94 : age >= 31 ? 1 - (age - 30) * 0.03 : 1) * (role === 'Starter' ? 1 : role === 'Rotation' ? 0.8 : 0.9)
    // (a relegated club he stayed with plays the second tier, and nothing in Europe: c.down)
    const down = c.down?.team === t.short
    return { short: t.short, name: t.name, league: t.league, career: true, sched: `${c.seed}-y${(c.year ?? 0) + 1}`, yrs: Math.max(0, (c.season ?? FIRST_SEASON) - FIRST_SEASON), world: c.seed, off: clamp(fit.off + (m.off ?? 0), 1, 10), def: clamp(fit.def + (m.def ?? 0), 1, 10), usage, bench: role === 'Bench', rotation: role === 'Rotation', age: c.age, ...(down ? { tier2: true, europe: null } : c.europeFor && c.europeFor === t.short ? { europe: c.europe ?? null } : {}) }   // (last season's place in Europe, when it was this club's)
  },
  // the attack around him: the forwards beside him (wingers and a No. 10 count) and the club itself
  // (years on, the real ones age: past 30 they fade, at 35 they're gone)
  fit: (ro, pos, notMe, spot, short, yrs = 0) => {
    const mates = SOCCER_STRIKERS.filter(p => p.team === short && !isNine(p) && (p.age ?? 26) + yrs < 35).map(p => ({ name: p.name, ovr: SPORT.soccer.realOvr('st', p) - Math.max(0, (p.age ?? 26) + yrs - 30) * 2 }))
    const nines = (ro.st ?? []).filter(notMe)
    const vs = (list, med, per, none = 4) => (list.length ? r10(clamp(6 + (avgOvr(list) - med) * per, 1, 11)) : none)
    const supply = vs([...mates].sort(byOvr).slice(0, 3), 80, 0.45, 6)   // (nobody left from today's squad: an honest supply line)
    const room = vs([...nines].sort(byOvr).slice(0, 2), 80, 0.45)
    return { groups: [{ k: 'SUPPLY', v: supply, names: [...mates].sort(byOvr).slice(0, 3).map(p => p.name) }, { k: 'STRIKERS', v: room, names: [...nines].sort(byOvr).slice(0, 2).map(p => p.name) }], adj: 0, need: 11 - room, supply, room }
  },
  fitNote: f => (f.supply >= 8 ? 'Real creators behind him. The chances will come: he has to put them away.' : f.supply < 5 ? 'Not much service from wide or from midfield. He has to make his own.' : 'Honest service from the wide men and the midfield.'),
  // (Size is his frame, from his height and weight: it's never trained and never fades, lib/ageLadder.js)
  physical: { st: ['pace'] },
  // composure and passing only get better with the years (the movement goes with the legs)
  ageless: ['composure', 'passing'],
  finalsAward: 'MAN OF THE MATCH IN THE FINAL',
  ageShift: () => 0,
  trainUntil: () => 26, declineAt: () => 30,
  // (two seasons more than basketball's draftees, so about the same development in all)
  devYoung: () => 18, devPrime: () => 24,
  durTrait: 'size',
  bigInjury: 8,
  draft: { rounds: 1, stock: () => [1, 1], rookie: () => ({ kind: 'rookie', years: 3, left: 3, perYear: 0.5 }), posList: ['ST'] },
  combine: { st: [['sprint30', '30m sprint', 'pace'], ['slalom', 'Dribble slalom', 'dribbling'], ['finishing', 'Finishing drill', 'finishing'], ['first-touch', 'First touch', 'dribbling']] },
  goals: {
    st: ovr => [['lgGoals', 'Score', ovr >= 92 ? 25 : ovr >= 86 ? 18 : ovr >= 80 ? 12 : 8, 'league goals'], ['assists', 'Make', ovr >= 92 ? 9 : ovr >= 86 ? 6 : 4, 'assists'], ['avgRating', 'Average a', ovr >= 92 ? 7.4 : ovr >= 86 ? 7.1 : 6.8, 'match rating']],
  },
  seasonStats: (pos, f) => soccerStats(f),
  rateKeys: ['avgRating'],
  averages: null,
  headline: { st: ['goals', 'assists', 'apps'] },
  awardName: { st: "BALLON D'OR" },
  honor: 'Team of the Season', honors: 'TEAM OF THE SEASON', first: 'Golden Boot',
  minGames: { award: 0, first: 0, honor: 0 },
  proBowl: { st: () => false }, allPro: { st: () => false }, allProNear: { st: () => false },
  award: () => false,
  // (a striker's season: the goals, the assists and where the club finished)
  // (a season in the second tier is worth about half of one in the top flight)
  seasonScore: (pos, s) => { const st = s.stats; const size = s.size ?? 20; return clamp((st.goals ?? 0) / 38 * 0.45 + (st.assists ?? 0) / 14 * 0.15 + clamp(((st.avgRating ?? 6.8) - 6.5) / 1.2, 0, 1) * 0.1 + (size - (s.pos ?? size)) / Math.max(1, size - 1) * 0.3, 0, 1.1) * (s.tier === 2 ? 0.55 : 1) },
  legacyProd: (pos, st) => (st.goals ?? 0) / 15 + (st.assists ?? 0) / 50,
  made: f => soccerMade(f),
  rounds: [], final: 'Final', series: false,
  lineKeys: ['goals', 'assists', 'shots', 'xg'],
  step: 4, gameWord: 'MATCH', snaps: 'minutes', injScale: 17 / 38, oldInjuries: true, moneyWord: 'goals',
  // [what, matches out (low, high), how often]. Only the season-enders list ends a season
  injuries: [['hamstring strain', 2, 5, 6], ['ankle sprain', 1, 4, 5], ['groin strain', 2, 4, 3], ['calf strain', 2, 5, 3], ['knock to the knee', 1, 3, 4], ['thigh strain', 2, 4, 3], ['concussion', 1, 2, 1], ['knee ligament sprain', 4, 8, 1], ['broken metatarsal', 6, 10, 0.6], ['torn hamstring', 6, 10, 0.8]],
  seasonEnders: ['torn ACL', 'ruptured Achilles', 'broken leg'],
  // wages, in millions a year (the best paid No. 9s about €25-33M a year in 2026; an academy graduate's first deal under €1M)
  money: { st: [0.4, 34] },
  moneyOf: () => [0.4, 34],
  // (the nine traits since 2026-11-16: lib/ageLadder.js soccer, physical pace, Size fixed, composure and passing ageless)
  primeNote: () => 'Pace can be trained until 27 (the last year at double the cost) and starts to fade at 30. Size is his frame: it never changes. Shot power, heading and dribbling until 32; finishing, positioning, passing and composure for good, and passing and composure never fade. Big injuries and a fragile body can cost him a grade.',
}

// soccer: the academy's scouts and coaches, and the first-team staff watching
const INTERVIEWS_SOCCER = [
  { who: 'Chief scout', q: 'There\'s a senior striker ahead in the queue here. A year with the under-21s first: happy with that?', a: [
    { t: 'Whatever it takes. I\'ll earn my chance in training.', stock: 1, persona: 'grinder' },
    { t: 'I\'ll push him every day until the manager has to pick me.', stock: 2, persona: 'confident' },
    { t: 'I didn\'t come here to play youth football.', stock: -1, persona: 'cocky' } ] },
  { who: 'Academy director', q: 'The academy coaches say the No. 9 drifts out of games. Fair?', a: [
    { t: 'They\'re right. I\'m working on my movement off the ball.', stock: 2, persona: 'grinder' },
    { t: 'Strikers are judged on goals. I score them.', stock: 1, persona: 'confident' },
    { t: 'Give me the ball more and I won\'t drift.', stock: -2, persona: 'cocky' } ] },
  { who: 'First-team manager', q: 'We press from the front. No running, no playing. Is that the player we\'re signing?', a: [
    { t: 'I\'ll be the first one closing down their centre-backs.', stock: 2, persona: 'grinder' },
    { t: 'I\'ll press, and I\'ll finish the chances it makes.', stock: 1, persona: 'confident' },
    { t: 'My job is to score, not to chase.', stock: -1, persona: 'cocky' } ] },
  { who: 'Sporting director', q: 'Bigger clubs will come calling after a good season here. What do they get told?', a: [
    { t: 'I\'m here to develop. My focus is this club.', stock: 1, persona: 'grinder' },
    { t: 'My football decides where I end up.', stock: 1, persona: 'confident' },
    { t: 'I\'ll go wherever pays the most.', stock: -2, persona: 'cocky' } ] },
  { who: 'Chief scout', q: 'On this clip their full-back pushes up. Where\'s the run?', a: [
    { t: 'In behind him, into the channel, before the centre-back can cover.', stock: 2, persona: 'confident' },
    { t: 'Short, to feet, and bring the winger into the game.', stock: 1, persona: 'grinder' },
    { t: 'I stay in the middle and wait for the cross.', stock: -1, persona: 'cocky' } ] },
  { who: 'Head of medical', q: 'Our physios flagged a tight hamstring in the screening. Be straight with us.', a: [
    { t: 'It\'s fine. Here are my rehab notes, read them.', stock: 2, persona: 'grinder' },
    { t: 'I\'ve never missed a game with it.', stock: 1, persona: 'confident' },
    { t: 'Physios worry too much.', stock: -2, persona: 'cocky' } ] },
  { who: 'First-team manager', q: 'A penalty missed in a cup tie. We get another one. Who takes it?', a: [
    { t: 'I do. I\'ve practised them every day since the last one.', stock: 2, persona: 'grinder' },
    { t: 'Me. I don\'t miss twice.', stock: 1, persona: 'confident' },
    { t: 'Somebody else, unless nobody wants it.', stock: -1, persona: 'cocky' } ] },
  { who: 'Academy director', q: 'A teammate has a go at the new signing in the papers. What happens next?', a: [
    { t: 'Talk to him face to face. Keep it in the dressing room.', stock: 2, persona: 'grinder' },
    { t: 'Let my football answer it on Saturday.', stock: 1, persona: 'confident' },
    { t: 'Hit back on social media. People should know.', stock: -2, persona: 'cocky' } ] },
]

// soccer: the summer at the club (t is the club's full name)
// soccer: the summer at the club (t is the club's full name)
const EVENTS_SOCCER = [
  { id: 'new-manager', w: 3, text: t => `${t} appoint a new manager. A new system, new patterns to learn in pre-season.`, apply: () => ({ nextMods: { off: -0.5 } }) },
  { id: 'manager-sacked', w: 2, when: c => (c.seasons[c.seasons.length - 1]?.pos ?? 1) >= 14, text: t => `${t} sack the manager after a season down the table. The board wants a fresh start.`, apply: () => ({ nextMods: { off: -0.5, def: -0.5 } }) },
  { id: 'big-signing', w: 2, text: t => `${t} break the bank for a creative midfielder. The service is about to get better.`, apply: () => ({ nextMods: { off: 1 } }) },
  { id: 'defence', w: 2, text: t => `${t} rebuild the back line: two centre-backs and a goalkeeper in one window.`, apply: () => ({ nextMods: { def: 1 } }) },
  { id: 'sports-science', w: 2, text: () => `A new sports science team and a full pre-season. The body feels ready for fifty games.`, apply: c => ({ durability: r10(Math.min(10, c.durability + 0.6)) }) },
  { id: 'contract-talks', w: 1, when: c => c.contract.kind === 'rookie' && c.contract.left === 1 && c.rep >= 6, text: () => `His agent wants a new deal before the season starts. The talks drag on into August.`, apply: c => ({ nextMods: { off: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
  { id: 'armband', w: 2, when: c => c.rep >= 7 && c.age >= 24, text: (t, c) => `${t} give ${c.name} the armband. The dressing room is his.`, apply: c => ({ rep: Math.min(10, c.rep + 1) }) },
  { id: 'system', w: 2, text: t => `${t} switch to two up front. More crosses into the box, more chances for the No. 9.`, apply: () => ({ nextMods: { off: 0.5 } }) },
  { id: 'mentor', w: 2, good: true, when: c => c.age <= 22, text: (t, c) => `A veteran striker at ${t} takes ${c.name} under his wing. Finishing after training every day, clips every night.`, apply: c => ({ dev: { ...c.dev, points: c.dev.points + 1 } }) },
  { id: 'built-around', w: 2, good: true, when: c => c.rep >= 6, text: (t, c) => `${t} build the team around ${c.name}. Everything goes through the No. 9 now.`, apply: () => ({ nextMods: { off: 0.75 } }) },
  { id: 'rift', w: 2, bad: true, when: c => c.rep <= 4, text: t => `The ${t} dressing room hasn't moved on from last season. Players are talking to the press.`, apply: c => ({ nextMods: { off: -0.5, def: -0.5 }, rep: Math.max(1, c.rep - 1) }) },
  { id: 'preseason-knock', w: 2, bad: true, text: () => `A knock on the pre-season tour. Nothing serious, but it lingers into August.`, apply: c => ({ durability: r10(Math.max(1, c.durability - 0.4)) }) },
  { id: 'winger-sold', w: 2, text: t => `${t} sell their best winger. Fewer balls into the box this season.`, apply: () => ({ nextMods: { off: -0.75 } }) },
  { id: 'quiet', w: 3, text: () => `A quiet summer. Pre-season starts, and the work begins.`, apply: () => ({}) },
]

// ═════════════════════════════════════════════════════════════════════════════
// SOCCER: a striker's career at a club in Europe's top five leagues
// ═════════════════════════════════════════════════════════════════════════════
// The academy (trials, then the scouts and coaches, then a first contract from the clubs that want him),
// the club season (the league match by match through the season director; then the big nights: the cup
// final and the European knockouts, one moment each when it's close), every summer the transfer window,
// international duty and a World Cup every four years (2030, 2034...), and the awards: the Golden Boot,
// Player of the Season, Team of the Season, the Golden Shoe, the Ballon d'Or.
// His room at a club is its forwards (a No. 9 or a second striker): a winger or a midfielder on the list isn't
// competing for his shirt. (A row with no `role` is a striker: the data's older shape.)
// (a function, not a set: SPORT reads it before this part of the file has run)
function isNine(p) { return !p?.role || p.role === 'ST' || p.role === 'SS' }
const SOCCER_BY_NAME = new Map([...WC_STRIKERS, ...SOCCER_STRIKERS].map(p => [p.name, p]))
// real ages: the data's age is this season's
const SOCCER_BORN = new Map([...WC_STRIKERS, ...SOCCER_STRIKERS].filter(p => typeof p.age === 'number').map(p => [p.name, FIRST_SEASON - p.age]))
// a photo only where the data has one (ESPN, data/soccer-headshots.json); everyone else shows initials
const soccerPhoto = p => { const v = p?.espn != null ? SOCCER_HEADSHOTS[String(p.espn)] : null; return v ? `${HEADSHOT_BASE}/${String(v).replace(/\.webp$/, '')}.webp` : null }
const CLUB_BY = new Map(SOCCER_CLUBS.map(c => [c.short, c]))
const NATION_BY = new Map(WC_NATIONS.map(n => [n.short, n]))
const clubMemo = new Map()
function soccerClub(short) {
  if (clubMemo.has(short)) return clubMemo.get(short)
  const t = CLUB_BY.get(short) ?? SOCCER_CLUBS[0]
  const r = soccerTeam10(t, 'current')
  const out = { short: t.short, name: t.name, color: t.color, color2: t.color2, off: r.off, def: r.def, conf: soccerLeagueInfo(t.league)?.name ?? '', div: null, league: t.league }
  clubMemo.set(short, out)
  return out
}
// The clubs, biggest first: half how good the team is (Opta's club rating), half how big the club is (its revenue).
// Where a prospect's offers and a transfer's bids come from. (Before 2026-11-24 the order was the rating alone, so
// Brighton and Bournemouth stood above Liverpool and paid like it.)
const zOf = (list, f) => { const v = list.map(f), m = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return x => (f(x) - m) / sd }
const zRate = zOf(SOCCER_CLUBS, c => c.ovr ?? (c.att + c.def) / 2), zRev = zOf(SOCCER_CLUBS, c => Math.log(c.rev ?? 60))
const STATURE = new Map(SOCCER_CLUBS.map(c => [c.short, (zRate(c) + zRev(c)) / 2]))
const CLUB_RANK = [...SOCCER_CLUBS].sort((a, b) => STATURE.get(b.short) - STATURE.get(a.short) || (a.short < b.short ? -1 : 1)).map(c => c.short)
// where a club stands among them, 0 (the biggest) to 1
const RANK_AT = new Map(CLUB_RANK.map((s, i) => [s, i / Math.max(1, CLUB_RANK.length - 1)]))
const standing = short => RANK_AT.get(short) ?? 0.6
// money: pounds at a Premier League club, euros everywhere else. Wages the way football says them: a week
export const soccerCur = short => (CLUB_BY.get(short)?.league === 'eng.1' ? '£' : '€')
// (the money is kept in euros; a Premier League club's shown in pounds at the rate: before 2026-11-24 only the sign
// changed, so £575k a week at City was the same number as €575k at Bayern)
const GBP = 0.85
const inCur = (eur, short) => (soccerCur(short) === '£' ? eur * GBP : eur)
export const wageText = (perYear, short) => {
  const k = inCur(perYear ?? 0, short) * 1000 / 52
  const n = k >= 1000 ? `${(k / 1000).toFixed(2).replace(/0$/, '')}M` : `${k >= 100 ? Math.round(k / 5) * 5 : Math.max(1, Math.round(k))}k`
  return `${soccerCur(short)}${n} a week`
}
export const feeText = (fee, short) => { const v = inCur(fee, short); return `${soccerCur(short)}${v >= 10 ? Math.round(v) : r10(v)}M` }
// What a club can spend, from what it earns (data/soccer-clubs.js `rev`, € millions a year): the most it pays a player
// a year and the biggest fee it pays. Real Madrid about €33M a year (€635k a week) and €209M; Manchester City £425k a
// week and €201M; Arsenal and Liverpool about £360k and €172M; Brighton £125k and €62M; Ipswich £75k and €38M;
// Elversberg €15k a week and €6M. (Before 2026-11-24 the purse followed the Opta rating: Brighton paid £400k a week.)
const clubPurse = short => {
  const rev = CLUB_BY.get(short)?.rev ?? 60
  // (a Premier League club puts more of what it earns into fees: Chelsea, Newcastle and Brighton outbid richer clubs abroad)
  return { wage: r10(clamp(0.0223 * Math.pow(rev, 1.05), 0.5, 34)), fee: Math.max(2, Math.round(rev * (CLUB_BY.get(short)?.league === 'eng.1' ? 0.24 : 0.2))) }
}
// ── What he's worth ──
// his last league season against what a striker of his level scores, and how much of it he played
function formOf(c) {
  const last = c.seasons?.[c.seasons.length - 1]
  if (!last) return { ratio: 1, share: 0.5, none: true }
  const st = last.stats ?? {}, games = Math.max(1, 2 * ((last.size ?? 20) - 1))
  const mins = st.mins ?? (st.lgApps ?? st.apps ?? 0) * 70, share = clamp(mins / (games * 90), 0, 1)
  const want = clamp(0.2 + ((last.ovr ?? c.ovr ?? 75) - 75) * 0.025, 0.12, 0.85) * (last.tier === 2 ? 1.5 : 1)
  const g90 = mins >= 270 ? (st.lgGoals ?? st.goals ?? 0) / (mins / 90) : want * 0.7
  return { ratio: clamp(g90 / want, 0, 2), share }
}
const minutesCut = share => (share >= 0.6 ? 1 : share >= 0.35 ? 0.85 : share >= 0.15 ? 0.65 : 0.5)
// His value, € millions (Transfermarkt's shape): the level, the age (a teenager's potential, the thirties' discount),
// the goals he scored for it, the minutes he played, the years left on the deal. A bench player is worth half a
// regular; a deal in its last year is worth little more than half. The best young No. 9 in the world: about €190M.
export function soccerValue(c) {
  const age = c.age ?? 25, f = formOf(c)
  const ageM = age <= 21 ? 1.35 : age <= 24 ? 1.2 : age <= 27 ? 1 : age <= 29 ? 0.75 : age <= 31 ? 0.45 : age <= 33 ? 0.22 : 0.1
  const left = c.contract?.left ?? 2
  const v = Math.max(0, (c.ovr ?? 70) - 66) ** 2 * 0.13 * ageM * clamp(0.6 + 0.4 * f.ratio, 0.7, 1.25) * (f.none ? 0.8 : minutesCut(f.share)) * (left <= 1 ? 0.55 : left === 2 ? 0.85 : left >= 4 ? 1.1 : 1)
  return Math.max(0.3, v >= 10 ? Math.round(v) : r10(v))
}
export const soccerFee = soccerValue   // (its name before 2026-11-24)
// What he can ask a year, € millions: his level first (a 99 about €34M, a 90 about €10M, an 85 about €5M, an 80
// under €3M), a teenager a fraction of it, then the season he's had and his name
function soccerWage(c) {
  const age = c.age ?? 25, f = formOf(c)
  const ageM = age <= 18 ? 0.35 : age === 19 ? 0.5 : age === 20 ? 0.65 : age <= 22 ? 0.85 : age <= 30 ? 1 : age <= 32 ? 0.9 : age <= 34 ? 0.7 : 0.5
  return 0.4 * Math.exp(((c.ovr ?? 70) - 66) * 0.135) * ageM * clamp(0.7 + 0.3 * f.ratio, 0.8, 1.2) * Math.sqrt(f.none ? 0.8 : minutesCut(f.share)) * (0.9 + (c.rep ?? 5) * 0.02)
}
// What this club offers him: his worth, a little more at a big club than at a small one for the same player, never
// past the top of its wage bill. A move comes with a rise on what he's on (when the club can pay it).
function wageAt(c, short, r, { rise = false, k = 1 } = {}) {
  const purse = clubPurse(short)
  const pay = soccerWage(c) * Math.pow(purse.wage / 34, 0.25) * k * (1.05 + r() * 0.2)
  return r10(clamp(Math.max(pay, rise ? (c.contract?.perYear ?? 0) * 1.1 : 0), 0.3, purse.wage))
}
// The release clause, € millions: half as much again as his value when he asked for one in the talks; in Spain
// every contract carries one by law, set out of reach unless he negotiated it down (Barcelona's and Real Madrid's
// run to €1bn). The relegation clause: a small club's star can go for about half his value if it goes down.
const inSpain = short => CLUB_BY.get(short)?.league === 'esp.1'
function clausesFor(c, o, value) {
  const asked = !!o.noTrade
  const release = asked ? Math.max(5, Math.round(value * 1.5)) : inSpain(o.team) ? Math.max(20, Math.round(value * (standing(o.team) < 0.1 ? 6 : 3))) : null
  // (a star at a small club: a club in the lower half of its league, and a player past the level it usually signs.
  // Nobody at Real Madrid or Chelsea has one)
  const rel = leaguePlace(o.team) >= 0.5 && (c.ovr ?? 70) >= clubNeed(o.team) + 2
  return { release, relClause: rel && o.kind !== 'loan' }
}
// the fee in his release clause (null: none). A deal signed before 2026-11-24 with one has no figure: it's read now
export const releaseFee = c => (!c?.contract || c.loan ? null : c.contract.release ?? (c.contract.noTrade ? Math.max(5, Math.round(soccerValue(c) * 1.5)) : null))
// what the clause would be in the deal on the table (the talks screen: with and without asking for one)
export const talksRelease = (c, t = c.talks, asked = t?.noTrade) => (t ? clausesFor(c, { ...t, noTrade: asked }, soccerValue({ ...c, contract: { left: t.years } })).release : null)
// the level a club signs: Real Madrid, City, Bayern about 90; a mid-table club about 81; the smallest about 74
const clubNeed = short => 90 - 16 * Math.pow(standing(short), 0.8)
// where a club stands in its own league, 0 (the biggest) to 1
const leaguePlace = short => { const lg = CLUB_BY.get(short)?.league, list = CLUB_RANK.filter(t => CLUB_BY.get(t)?.league === lg); return list.indexOf(short) / Math.max(1, list.length - 1) }
const FB_FIRST = ['Lucas', 'Mateo', 'Luca', 'Noah', 'Rafael', 'João', 'Kai', 'Leon', 'Théo', 'Marco', 'Diego', 'Youssef', 'Ibrahim', 'Bruno', 'Emil', 'Nico', 'Hugo', 'Adam', 'Tomás', 'Rayan', 'Jonas', 'Samuel', 'Elias', 'Enzo']
const FB_LAST = ['Moreau', 'Brandt', 'Ferreira', 'Okoro', 'Lindqvist', 'Varga', 'Mensah', 'Herrera', 'Dubois', 'Jansen', 'Romano', 'Novak', 'Haddad', 'Petersen', 'Costa', 'Lopes', 'Keller', 'Diallo', 'Sorensen', 'Navas', 'Marchetti', 'Achterberg', 'Ibarra', 'Kourouma']
const soccerName = r => `${FB_FIRST[Math.floor(r() * FB_FIRST.length)]} ${FB_LAST[Math.floor(r() * FB_LAST.length)]}`
// his country: the one picked on the New Career screen (the last one picked, else England)
const NATION_KEY = 'bap_soccer_nation'
export const lastNation = () => { try { const n = localStorage.getItem(NATION_KEY); return NATION_BY.has(n) ? n : null } catch { return null } }
export const rememberNation = n => { try { if (NATION_BY.has(n)) localStorage.setItem(NATION_KEY, n) } catch {} }
const soccerNationOf = n => (NATION_BY.has(n) ? n : lastNation() ?? 'ENG')
// (the countries a career can be started with: the 48 of the 2026 World Cup and the ones that stayed at home, Italy,
// Denmark, Poland, Nigeria, Wales, Ireland, Serbia...; the rest of CAREER_NATIONS are opponents)
export const SOCCER_NATIONS = WC_NATIONS.filter(n => n.pick).sort((a, b) => a.name.localeCompare(b.name)).map(n => ({ short: n.short, name: n.name, conf: n.conf ?? null }))
export const nationName = short => NATION_BY.get(short)?.name ?? short
export const nationFlag = short => `/logos/nations/${short}.png`

// His place at the club: first choice, in the rotation (close behind, or a teenager they want to play), or on the bench
export function soccerRole(c) {
  if (!c?.team) return 'Starter'
  const dc = depthChart(c)
  if (dc.starter) return 'Starter'
  const gap = (dc.ahead[0]?.ovr ?? 0) - (c.ovr ?? 0)
  return dc.idx === 1 && (gap <= 6 || (c.age <= 20 && gap <= 10)) ? 'Rotation' : 'Bench'
}

// ── The academy: trials, the scouts and coaches, the offers ──
// The scouts' read: the build, plus the trials (about ±3) and the interviews (about ±3)
function academyScore(c) {
  const d = c.draft
  const played = (d?.combine ?? []).filter(x => x.pct != null)
  const comb = played.length ? played.reduce((s, x) => s + x.pct, 0) / played.length : 0
  const inter = (d?.interviews ?? []).reduce((s, x) => s + (x.answer != null ? x.a[x.answer].stock : 0), 0)
  return (c.ovr ?? 75) + comb * 3 + inter * 0.6
}
// [the scouts' score, what the scouts call him, the clubs that come (by rank, best first), his first wage, € M a year]
const ACADEMY = [[93, 'Wonderkid', 0, 10, 1.6], [88, 'Top prospect', 5, 26, 1.0], [83, 'First-team prospect', 16, 50, 0.6], [77, 'Academy regular', 38, 74, 0.45], [-99, 'Late bloomer', 62, 96, 0.35]]
// (the ranges are set on a 96-club ladder and scaled to the clubs there are, at least four in a range: with 58 clubs
// the Late bloomer's 62-96 was empty, no club came to the trials and Career stopped on a blank screen)
const academyTier = c => {
  const x = academyScore(c), t = ACADEMY.find(([min]) => x >= min)
  const n = CLUB_RANK.length, k = n / 96
  const hi = Math.min(n, Math.max(4, Math.round(t[3] * k))), lo = Math.min(Math.round(t[2] * k), hi - 4)
  return [t[0], t[1], Math.max(0, lo), hi, t[4]]
}
export const academyText = c => academyTier(c)[1]
const ACADEMY_ROLE = { Starter: 'A first-team place from day one.', Rotation: 'A squad number and minutes in the cup. The first team is close.', Bench: 'The biggest stage. A long way to the first team.' }
export function soccerInterviews(c) {
  const r = seeded(`int-${c.seed}`)
  const [, , lo, hi] = academyTier(c)
  const clubs = CLUB_RANK.slice(lo, Math.min(CLUB_RANK.length, hi)).map(t => ({ t, k: r() })).sort((a, b) => a.k - b.k).slice(0, 4).map(x => x.t)
  const qs = [...INTERVIEWS_SOCCER].sort(() => r() - 0.5).slice(0, clubs.length)
  return { ...c, draft: { ...c.draft, interviews: qs.map((q, i) => ({ ...q, a: [...q.a].sort(() => r() - 0.5), team: clubs[i], answer: null })) } }
}
// Where he'd stand at a club: first choice, rotation or bench, and who's ahead
function standAt(c, short) {
  const ro = short === c.team && c.roster ? c.roster : rosterOf(c, short)
  const cc = { ...c, team: short, roster: ro, contract: {}, lastRole: short === c.team ? c.lastRole : null }
  const dc = depthChart(cc, ro)
  return { starter: dc.starter, role: soccerRole(cc), behind: dc.ahead[dc.ahead.length - 1]?.name ?? null, label: dc.label }
}
// The offers: three clubs from his level (a club whose people liked him in the room is likelier to call)
export function soccerOffers(c) {
  const r = seeded(`draft2-${c.seed}`)
  const [, tierName, lo, hi, wage] = academyTier(c)
  const interest = {}
  for (const x of c.draft.interviews ?? []) if (x.answer != null) interest[x.team] = (interest[x.team] ?? 0) + x.a[x.answer].stock
  const pool = CLUB_RANK.slice(lo, Math.min(CLUB_RANK.length, hi)).map(t => ({ t, k: Math.pow(r(), 1 / (1 + Math.max(0, interest[t] ?? 0) * 1.5)) * (interest[t] < 0 ? 0.5 : 1) }))
  const picks = pool.sort((a, b) => b.k - a.k).slice(0, 3).map(x => x.t).sort((a, b) => CLUB_RANK.indexOf(a) - CLUB_RANK.indexOf(b))
  const offers = picks.map((t, i) => {
    const fit = teamFit(t, c.pos, { name: c.name, sport: 'soccer' })
    const stand = standAt(c, t)
    const years = 3 + (i === 0 && tierName !== 'Late bloomer' ? 2 : r() < 0.5 ? 1 : 0)
    return { team: t, fit, stand, years, perYear: r10(wage * (1.25 - i * 0.15) * (0.9 + r() * 0.2)), pitch: ACADEMY_ROLE[stand.role], met: (c.draft.interviews ?? []).some(x => x.team === t), kind: 'academy' }
  })
  return { ...c, phase: 'draft', step: 'offers', draft: { ...c.draft, offers, tier: tierName } }
}
// He signs his first professional contract
export function signAcademy(c, o) {
  const roster = makeRoster(o.team, 'soccer')
  const fit = teamFit(o.team, c.pos, { roster, name: c.name, sport: 'soccer' })
  return {
    ...c, phase: 'preseason', step: null, team: o.team, roster, fit, europeFor: null,
    contract: { kind: 'rookie', years: o.years, left: o.years, perYear: o.perYear, ...clausesFor(c, { team: o.team, kind: 'academy' }, soccerValue({ ...c, contract: { left: o.years } })) },
    draft: { ...c.draft, pick: { team: o.team, tier: c.draft.tier ?? academyText(c) } },
    decisions: [...c.decisions, { year: 1, text: `Signed a first professional contract with ${fit.name}${o.met ? ' (they interviewed him)' : ''}: ${o.years} yrs, ${wageText(o.perYear, o.team)}` }],
  }
}

// ── The season ──
// what Career keeps of a season the engine plays (a club season is ~80 KB; the director keeps a few): the
// calendar of every competition, the other leagues and the award races go
function trimSoccer(r) {
  if (!r || r.mode !== 'current') return r
  const leg = g => ({ comp: g.comp, round: g.round, leg: g.leg, wk: g.wk, home: g.home, neutral: g.neutral, opponent: g.opponent, oppName: g.oppName, oppExtra: g.oppExtra, mySc: g.mySc, oppSc: g.oppSc, won: g.won, drawn: g.drawn, through: g.through, et: g.et, shootout: g.shootout, app: g.app, gs: g.gs, mins: g.mins, goals: g.goals, assists: g.assists, shots: g.shots, sot: g.sot, xg: g.xg, rating: g.rating, motm: g.motm })
  const tie = t => ({ name: t.name, comp: t.comp, opponent: t.opponent, won: t.won, agg: t.agg, final: t.final, legs: t.legs.map(leg) })
  const { fixtures, otherLeagues, playoffRounds, gameLog, allComps, ...rest } = r
  const E = r.europe
  const noRace = x => (x ? (({ race, ...k }) => k)(x) : x)
  // (a league match keeps what Career reads: the score, the result, his line)
  const lgGame = ({ npxg, pensTaken, headers, outside, start, through, et, shootout, comp, round, leg, neutral, lost, ...g }) => g
  return {
    ...rest,
    games: (r.games ?? []).map(lgGame), bestGame: r.bestGame ? lgGame(r.bestGame) : null,
    cup: r.cup ? { ...r.cup, rounds: (r.cup.rounds ?? []).map(tie) } : r.cup,
    europe: E ? { comp: E.comp, name: E.name, position: E.position, result: E.result, champion: E.champion, winner: E.winner, games: (E.games ?? []).map(leg), rounds: (E.rounds ?? []).map(tie) } : null,
    goldenBoot: noRace(r.goldenBoot), goldenShoe: noRace(r.goldenShoe),
  }
}
// the season played: his league line, from the director's games (the matches he sat out don't count)
function soccerStats(f) {
  const played = (f.games ?? []).filter(g => !g.sat && g.app)
  const sum = k => played.reduce((s, g) => s + (g[k] ?? 0), 0)
  const rated = played.filter(g => g.rating != null)
  return {
    apps: played.length, starts: sum('gs'), mins: sum('mins'), goals: sum('goals'), assists: sum('assists'), lgGoals: sum('goals'),
    xg: r10(sum('xg')), shots: sum('shots'), sot: sum('sot'), bcm: sum('bcm'),
    avgRating: rated.length ? Math.round(rated.reduce((s, g) => s + g.rating, 0) / rated.length * 100) / 100 : 0,
    hatTricks: played.filter(g => g.goals >= 3).length, motm: played.filter(g => g.motm).length,
  }
}
// (soccerFinal, the league table again from the season as played: lib/soccerDirector.js, shared with the one-off season page)
// the big nights are on: a European knockout round reached, or the cup final
function soccerMade(f) {
  const E = f?.europe
  return !!(E && ((E.position ?? 99) <= 24 || ['Knockout play-offs', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Runners-up', 'Winners'].includes(E.result))) || ['Winners', 'Runners-up'].includes(f?.cup?.result)
}
const KO = ['Knockout play-off', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final']
const KO_DEPTH = { 'Knockout play-off': 0, 'Round of 16': 0, 'Quarter-final': 1, 'Semi-final': 2, Final: 3 }
const KO_PLURAL = { 'Knockout play-off': 'Knockout play-offs', 'Round of 16': 'Round of 16', 'Quarter-final': 'Quarter-finals', 'Semi-final': 'Semi-finals', Final: 'Runners-up' }
// an opponent the season's own draw didn't get to: Europe's best by the round (the Champions League's best of all)
function euroOpp(r, comp, stage, used, c) {
  const span = comp === 'ucl' ? { 'Knockout play-off': [10, 40], 'Round of 16': [4, 26], 'Quarter-final': [0, 16], 'Semi-final': [0, 10], Final: [0, 8] }
    : comp === 'uecl' ? { 'Knockout play-off': [44, 90], 'Round of 16': [36, 80], 'Quarter-final': [30, 70], 'Semi-final': [24, 60], Final: [20, 50] }
    : { 'Knockout play-off': [30, 80], 'Round of 16': [22, 66], 'Quarter-final': [16, 54], 'Semi-final': [12, 44], Final: [8, 34] }
  const [lo, hi] = span[stage] ?? [0, 20]
  const mine = CLUB_BY.get(c.team)?.league
  const list = CLUB_RANK.slice(lo, hi).filter(t => !used.has(t) && (KO_DEPTH[stage] >= 1 || CLUB_BY.get(t)?.league !== mine))
  const t = list[Math.floor(r() * list.length)] ?? CLUB_RANK.find(x => !used.has(x))
  return { short: t, name: CLUB_BY.get(t)?.name ?? t }
}
// The big nights, in order: the European knockouts from where the league phase put him, the cup final when the
// cup run got there. Each one a round like a playoff game: close ones turn on a key moment, a final always does.
function soccerBracket(c, f) {
  const r = seeded(`${c.seed}-po-${c.year}`)
  const lgS = short => { const t = soccerClub(short), d = c.league?.[short] ?? { off: 0, def: 0 }; return (t.off + d.off + t.def + d.def) / 2 }
  const myStr = strength(c.simTeam ?? soccerClub(c.team))
  const oppStr = o => (CLUB_BY.has(o.short) ? lgS(o.short) : 5.4)
  const pOf = o => { const base = 0.5 + (myStr - oppStr(o)) * 0.07 + ((c.ovr - 78) / 100) * 0.3 + Math.max(0, c.ovr - 95) * 0.015; return clamp(Math.round((0.5 + (base - 0.5) * 0.85) * 100) / 100, 0.18, 0.82) }
  const rounds = []
  const E = f.europe
  if (E && soccerMade({ europe: E })) {
    const names = (E.position ?? 99) <= 8 ? KO.slice(1) : KO
    const ties = E.rounds ?? []
    const used = new Set([c.team])
    names.forEach((n, i) => {
      const t = ties[i]
      const opp = t?.opponent && !used.has(t.opponent.short) ? t.opponent : euroOpp(r, E.comp, n, used, c)
      used.add(opp.short)
      const fin = n === 'Final', p = pOf(opp)
      rounds.push({ track: 'europe', comp: E.comp, compName: E.name, stage: n, name: `${E.name} ${n}`, opp: opp.short, oppName: opp.name, extra: !CLUB_BY.has(opp.short), legs: fin ? 1 : 2, home: fin ? null : r() < 0.5, final: fin, p, played: false, close: fin || r() < closeChance(p) })
    })
  }
  if (['Winners', 'Runners-up'].includes(f.cup?.result)) {
    const fin = (f.cup.rounds ?? []).find(t => t.final) ?? f.cup.rounds?.[f.cup.rounds.length - 1]
    const opp = fin?.opponent ?? { short: CLUB_RANK[0], name: CLUB_BY.get(CLUB_RANK[0])?.name }
    const rd = { track: 'cup', comp: 'cup', compName: f.cup.name, stage: 'Final', name: `${f.cup.name} Final`, opp: opp.short, oppName: opp.name, extra: !CLUB_BY.has(opp.short), legs: 1, home: null, final: true, p: pOf(opp), played: false, close: true }
    const at = rounds.findIndex(x => x.final)
    if (at >= 0) rounds.splice(at, 0, rd); else rounds.push(rd)
  }
  return { idx: 0, rounds, line: [], used: [], stage: 'round', won: false, out: false, trophies: [] }
}
export function soccerFinishLeague(c, f) {
  const po = soccerBracket(c, f)
  if (!po.rounds.length) return bookSeason({ ...c, active: { ...c.active, final: f, po: null } })
  if (c.active.out) return bookSeason({ ...c, active: { ...c.active, final: f, po: soccerWatch(c, po) } })
  return { ...c, active: { ...c.active, final: f, po } }
}
// A tie nobody needed a moment for. The scores come from the sides' strength (p: his club's chance of going through):
// goals drawn for each side at its rate, the tie kept when it has the result that was decided, and an upset is a narrow
// one. (Before 2026-11-24 the scores came off a fixed list whatever the sides: City, with a 99 striker, out 1-4 at home.)
const pois = (r, lam) => { const L = Math.exp(-lam); let k = 0, x = 1; do { k++; x *= r() } while (x > L); return k - 1 }
function autoLegs(r, two, won, p = 0.5) {
  const q = clamp(p, 0.1, 0.9), d = Math.log(q / (1 - q)) * 0.2
  const mine = 1.3 * Math.exp(d), theirs = 1.3 * Math.exp(-d)
  const edge = two ? 2 : 1
  for (let i = 0; i < 120; i++) {
    const legs = (two ? [0, 1] : [0]).map(() => [pois(r, mine), pois(r, theirs)])
    const my = legs.reduce((a, l) => a + l[0], 0), opp = legs.reduce((a, l) => a + l[1], 0)
    if (my === opp || (my > opp) !== won) continue
    if (!won && q >= 0.5 && opp - my > edge) continue      // (the better side isn't taken apart)
    if (won && q < 0.45 && my - opp > edge) continue
    // (a rout is rare: four clear over two legs, three in one match, about one tie in twenty-five)
    if (Math.abs(my - opp) > (two ? 3 : 2) && r() < 0.85) continue
    if (legs.some(l => l[0] > 4 || l[1] > 4)) continue
    return legs
  }
  const legs = two ? [[1, 0], [1, 1]] : [[1, 0]]
  return won ? legs : legs.map(([a, b]) => [b, a])
}
// The round's moment is in. The deciding match is the one played (a final, or the second leg with the first one level)
// pts: the game's own report (MiniGame's raw) or the old number of goals. raw.assist: the 2-on-1 squared for the
// tap-in, the goal is on the board and it's a teammate's: his line gets the assist, not the goal
export function soccerRound(c, score, game = null, hit = score >= 0.5, pts = null) {
  const setUp = !!(pts && typeof pts === 'object' && pts.assist)
  const a = c.active, po = a.po, f = a.final
  const rd = po.rounds[po.idx]
  const r = seeded(`${c.seed}-por-${c.year}-${po.idx}`)
  const auto = rd.close === false || score == null
  let legs, note = null, won, pens = null, at = -1
  if (auto) { won = r() < rd.p; score = won ? 0.8 : 0.25; legs = autoLegs(r, rd.legs === 2, won, rd.p) }
  else {
    // the tie his chance was in (lib/inGame.js): either leg of two, the goal on the board when it went in, the rest played
    const { plan } = playoffPlan(c, po, undefined, game)
    const res = playMoment(plan, hit, momentFacts(game, pts, hit), pts)
    won = res.won; legs = res.legs; note = res.note; pens = res.pens
    at = plan.b.leg === 1 && legs.length === 2 ? 0 : legs.length - 1
  }
  const mySc = legs.reduce((s, l) => s + l[0], 0), oppSc = legs.reduce((s, l) => s + l[1], 0)
  if (mySc === oppSc && !pens) pens = won ? 'won' : 'lost'
  // his line: the moment's goal when he scored it, and his usual share of the rest
  const lg = soccerStats(f)
  const rate = lg.apps ? lg.goals / lg.apps : 0.3, arate = lg.apps ? lg.assists / lg.apps : 0.1
  let goals = 0, assists = 0
  legs.forEach((l, i) => {
    const moment = i === at
    let g = Math.min(l[0], Math.floor(rate * (0.8 + score * 0.4) + r()))
    if (moment) g = setUp && hit ? Math.min(g, Math.max(0, l[0] - 1)) : Math.min(l[0], Math.max(hit ? 1 : 0, hit ? g : Math.min(g, Math.max(0, l[0] - 1))))
    goals += g
    assists += Math.min(l[0] - g, Math.max(moment && setUp && hit ? 1 : 0, Math.floor(arate + r() * 0.8)))
  })
  const entry = { ...rd, played: true, won, legs, mySc, oppSc, pens, score, hit, auto, swing: note, game: auto ? null : game, goals, assists, apps: legs.length, xg: r10(goals * 0.75 + legs.length * 0.25) }
  const rounds = po.rounds.map((x, i) => (i === po.idx ? entry : !won && i > po.idx && x.track === rd.track ? { ...x, skip: true } : x))
  const nextIdx = rounds.findIndex((x, i) => i > po.idx && !x.played && !x.skip)
  const done = nextIdx < 0
  const trophies = won && rd.final ? [...(po.trophies ?? []), rd.compName] : po.trophies ?? []
  return { ...c, active: { ...a, po: { ...po, rounds, line: [...po.line, entry], idx: done ? po.idx : nextIdx, stage: done ? 'done' : 'round', won: (po.won || (won && rd.final)), out: done && !trophies.length, trophies } } }
}
// out for the season: the club plays the big nights without him
function soccerWatch(c, po) {
  const r = seeded(`${c.seed}-pow-${c.year}`)
  let rounds = po.rounds.map(x => ({ ...x }))
  const line = [], trophies = []
  for (let i = 0; i < rounds.length; i++) {
    const rd = rounds[i]
    if (rd.skip) continue
    const won = r() < clamp(rd.p - 0.12, 0.08, 0.9)
    const legs = autoLegs(r, rd.legs === 2, won, clamp(rd.p - 0.12, 0.08, 0.9))
    const entry = { ...rd, played: true, won, legs, mySc: legs.reduce((s, l) => s + l[0], 0), oppSc: legs.reduce((s, l) => s + l[1], 0), sat: true, goals: 0, assists: 0, apps: 0 }
    rounds[i] = entry; line.push(entry)
    if (won && rd.final) trophies.push(rd.compName)
    if (!won) rounds = rounds.map((x, k) => (k > i && x.track === rd.track ? { ...x, skip: true } : x))
  }
  return { ...po, rounds, line, idx: Math.max(0, rounds.length - 1), stage: 'done', won: trophies.length > 0, out: !trophies.length, trophies }
}

// ── International duty: the call-up, the caps, a World Cup every four years, the continental championships ──
// the World Cup is the summer a season ends in: 2030, 2034 (the 2029-30 season, the 2033-34...)
export const wcSummer = c => (c.season + 1) % 4 === 2
const intlYear = c => (c.season ?? FIRST_SEASON) + 1
// his league season, for the selectors: the one just played (lg), else his last
const seasonLine = (c, lg) => { if (lg) return { goals: lg.goals ?? 0, mins: lg.mins ?? 0, tier: c.down?.team === c.team ? 2 : 1 }; const s = c.seasons?.[c.seasons.length - 1]; return s ? { goals: s.stats?.lgGoals ?? 0, mins: s.stats?.mins ?? 0, tier: s.tier ?? 1 } : null }
// Called up: the manager picks three strikers. His level and the season he's had (the goals for the minutes, and the
// minutes: a man who isn't playing for his club isn't picked) against his country's pecking order that year: the real
// strikers, aged, and the ones who came through behind them (lib/soccerIntl.js). First in it starts, second is in the
// rotation, third travels. (Before 2026-11-24 the call was his rating alone: a 19-year-old with five league goals
// for a side in 16th was capped by England, a Brazil striker with none off a bench went to a World Cup.)
// → { called, role, rank, score, order: [{ name, ovr, age, me }] } (order: the first four up front, him among them)
export function soccerCallUp(c, lg = null) {
  const nat = NATION_BY.get(c.nation)
  if (!nat) return { called: false, role: null, rank: null, order: [] }
  const line = seasonLine(c, lg)
  const mins = line ? line.mins : null
  const g90 = mins != null && mins >= 450 ? line.goals / (mins / 90) * (line.tier === 2 ? 0.6 : 1) : null
  // (his goals against what a striker of his level scores: half of it costs him six points with the selectors)
  const want = clamp(0.2 + ((c.ovr ?? 75) - 75) * 0.025, 0.12, 0.85)
  const form = g90 == null ? 0 : clamp((g90 / want - 1) * 10, -8, 5)
  const play = mins == null ? 0 : mins < 450 ? -8 : mins < 900 ? -5 : mins < 1500 ? -2 : 0
  const score = (c.ovr ?? 70) + form + play - (line?.tier === 2 ? 3 : 0)
  const rivals = peckingOrder(c.nation, intlYear(c), c.seed).filter(p => p.name !== c.name)
  const rank = 1 + rivals.filter(p => p.score > score).length
  // (never a weaker bar than the level his country's football says)
  const floor = 62 + (nat.ovr - 67) * 0.5
  const called = (c.age >= 19 || c.ovr >= 88) && rank <= 3 && score >= floor
  const me = { name: c.name, ovr: c.ovr, age: c.age, me: true }
  const order = [...rivals.slice(0, rank - 1), me, ...rivals.slice(rank - 1)].slice(0, Math.max(4, Math.min(rank, 6))).map(p => ({ name: p.name, ovr: Math.round(p.ovr), age: p.age, me: !!p.me }))
  return { called, role: !called ? null : rank === 1 ? 'Starter' : rank === 2 ? 'Rotation' : 'Bench', rank, score: r10(score), order }
}
// one tournament with his country, played through the engine on its field for that year
function playTournament(c, call, field, tag) {
  const r = runSoccerSimulation(c.build, ST_TYPES, { short: c.nation, field, usage: call.role === 'Starter' ? 1 : 0.8, bench: call.role === 'Bench', age: c.age }, 'alltime', `${c.seed}-${tag}-${c.year}`)
  return {
    role: call.role, finish: r.finish, champion: !!r.champion, goals: r.goals ?? 0, assists: r.assists ?? 0, apps: r.apps ?? 0,
    games: (r.games ?? []).map(g => ({ stage: g.stage, round: g.round, opp: g.opponent, oppName: g.oppName, mySc: g.mySc, oppSc: g.oppSc, goals: g.goals, app: g.app, won: g.won, drawn: g.drawn, pens: g.shootout ? [g.shootout.my, g.shootout.opp] : null })),
    boot: { won: !!r.goldenBoot?.won, rank: r.goldenBoot?.rank ?? null, winner: r.goldenBoot?.winner?.isPlayer ? null : r.goldenBoot?.winner?.name ?? null, goals: r.goldenBoot?.winner?.goals ?? null },
    ball: r.goldenBall?.medal ?? null, young: !!r.bestYoungPlayer?.won,
    winner: r.worldChampion ?? null, winnerName: r.worldChampion ? nationName(r.worldChampion) : null,
  }
}
// The World Cup: his nation's tournament. The field is that year's: 48 nations through qualifying (his has to get
// there: a great No. 9 helps it), the squads aged, the retired gone (lib/soccerIntl.js worldCupOf)
function soccerWorldCup(c, lg = null) {
  const call = soccerCallUp(c, lg)
  const year = c.season + 1
  const W = worldCupOf(year, c.seed, call.called ? { short: c.nation, ovr: c.ovr, role: call.role } : { short: c.nation })
  if (!W.in) return { year, nation: c.nation, called: false, qualified: false, hosts: W.hosts }
  if (!call.called) return { year, nation: c.nation, called: false, qualified: true, hosts: W.hosts }
  return { year, nation: c.nation, called: true, qualified: true, hosts: W.hosts, ...playTournament(c, call, W.field, 'wc') }
}
// The continental championship, the summers it's on (the Euros, the Copa América, AFCON, the Asian Cup, the Gold Cup:
// data/soccer-nations.js CONTINENTALS). major: the Euros, the Copa América and AFCON weigh a whole title, the Asian
// Cup and the Gold Cup half of one (the legacy, the Ballon d'Or)
const CONT_MAJOR = { euro: 1, copa: 1, afcon: 1, asian: 0.5, gold: 0.5 }
function soccerContinental(c, lg = null) {
  const year = c.season + 1
  const def = continentalOf(c.nation, year)
  if (!def) return null
  const call = soccerCallUp(c, lg)
  const T = continentalField(def, year, c.seed, call.called ? { short: c.nation, ovr: c.ovr, role: call.role } : { short: c.nation })
  const base = { id: def.id, name: def.name, short: def.short, year, nation: c.nation, major: CONT_MAJOR[def.id] ?? 0.5, hosts: T.hosts }
  if (!T.in) return { ...base, called: false, qualified: false }
  if (!call.called) return { ...base, called: false, qualified: true }
  return { ...base, called: true, qualified: true, ...playTournament(c, call, T.field, def.id) }
}
// the tournaments a season ends with (the screens' calendar): { wc: year | null, cont: { id, name, short, year } | null }
export const soccerSummer = c => { const d = continentalOf(c.nation, intlYear(c)); return { wc: wcSummer(c) ? intlYear(c) : null, cont: d ? { id: d.id, name: d.name, short: d.short, year: intlYear(c) } : null } }
// a season's caps and international goals: the windows (about nine matches a year for a regular), and the summer's
// tournament
function intlSeason(c, lg, tours = []) {
  const call = soccerCallUp(c, lg)
  const played = tours.filter(t => t?.called)
  if (!call.called) return { caps: played.reduce((a, t) => a + (t.apps ?? 0), 0), intlGoals: played.reduce((a, t) => a + (t.goals ?? 0), 0), role: null, rank: call.rank, order: call.order }
  const r = seeded(`${c.seed}-intl-${c.year}`)
  const caps = (call.role === 'Starter' ? 8 : call.role === 'Rotation' ? 6 : 3) + Math.floor(r() * 3) - 1
  const rate = clamp((lg.apps ? lg.goals / lg.apps : 0.25) * 0.85 * (call.role === 'Starter' ? 1 : 0.5), 0, 1.1)
  let goals = 0
  for (let i = 0; i < caps; i++) goals += Math.floor(rate + r())
  return { caps: caps + played.reduce((a, t) => a + (t.apps ?? 0), 0), intlGoals: Math.max(0, goals) + played.reduce((a, t) => a + (t.goals ?? 0), 0), role: call.role, rank: call.rank, order: call.order }
}

// ── Booking a soccer season ──
// Ballon d'Or: the engine's field (the season's best players, their goals and trophies), against his whole year:
// goals and half the assists in every competition and for his country, the trophies he won (a big part of them
// the more he scored) and the World Cup in a World Cup year. (bdoCase in utils/soccerSimulation.js, the same weights)
const BDO_EURO = { ucl: { Winners: 14, 'Runners-up': 6, 'Semi-finals': 3, 'Quarter-finals': 1 }, uel: { Winners: 5, 'Runners-up': 2, 'Semi-finals': 1 }, uecl: { Winners: 2 } }
const BDO_WC = { Winners: 12, 'Runners-up': 5, 'Third place': 2, 'Fourth place': 2, 'Quarter-finals': 1 }
// (a continental title: the Euros or the Copa América about two thirds of a World Cup, as the voters have had it:
// Messi's 2021, Rodri's 2024; times the tournament's weight, CONT_MAJOR)
const BDO_CONT = { Winners: 8, 'Runners-up': 3, 'Semi-finals': 1 }
// The year's best rival for the Ballon d'Or, as a case on this scale (goals, half the assists, the trophies he was a
// big part of). Real years, 2008-2025, the best case that wasn't Messi's or Ronaldo's own (the careers a build like
// his stands in for): about 45 (Rodri 2024, van Dijk 2019, Modrić 2018) to 84 (Haaland's 52-goal treble, 2023), most
// years 55-70 (Lewandowski 2021 about 62, Benzema 2022 about 75, Dembélé 2025 about 70): a median near 61.
// The rival is the best man in the engine's field that season, brought onto that scale (shift: the field runs high,
// the best of five hundred cases each with a voter's swing: about 71 in a median year), and never less than a
// seeded floor (mid, spread: a logistic) so a thin year still has a winner's case in it.
// (Before 2026-11-24: the field as it came and a floor of 66, together about 73 in a median year: a 45-goal season
// with the league or the Champions League won it 14 times in 22, a 99 striker's career about twice.)
export const BDO_RIVAL = { mid: 55, spread: 6, shift: 10 }
// what usually wins a league's Golden Boot (Transfermarkt, 2015-16 to 2024-25; see utils/soccerSimulation.js)
const BOOT_TOP = { 'eng.1': 26, 'esp.1': 27, 'ita.1': 26, 'ger.1': 27, 'fra.1': 25 }
// how much of his share of the chances a striker past 92 gives back, a point at a time (tuned: an elite career
// averages about 25-32 league goals a season, peaking 35-40)
const USAGE_TOP = 0.012
const bdoCase = (goals, assists, trophies) => { const own = goals + 0.5 * assists; return own + trophies * clamp((own - 10) / 25, 0.2, 1) }
function soccerSeason(c, f, po) {
  const S = SPORT.soccer
  const lg = soccerStats(f)
  const line = po?.line ?? []
  const played = line.filter(x => !x.sat)
  const cupPo = (po?.rounds ?? []).some(x => x.track === 'cup')
  // the cup and the league phase in Europe, as the engine played them (the knockouts and the cup final are Career's),
  // only the weeks he wasn't out (a cup tie lands in the league's calendar about where its matchweek is)
  const sat = new Set((f.games ?? []).filter(g => g.sat).map(g => g.wk))
  const out = c.active?.out ? Math.min(...(f.games ?? []).filter(g => g.sat).map(g => g.wk), 99) : 99
  // (a January move: the new club's cup ties and European nights from before he came aren't his; the old club's
  // were, and are kept on the move: active.moved.before)
  const mv = c.active?.moved ?? null, pre = mv?.before ?? null
  const avail = g => { const wk = Math.max(1, Math.round((g.wk ?? 0) * 38 / 39)); return wk < out && !sat.has(wk) && (!mv || (g.wk ?? 0) > (mv.wk ?? 0)) }
  const cupLegs = (f.cup?.rounds ?? []).filter(t => !(cupPo && t.final)).flatMap(t => t.legs ?? []).filter(avail)
  const euroLegs = (f.europe?.games ?? []).filter(avail)
  const sum = (list, k) => list.reduce((s, g) => s + (g[k] ?? 0), 0)
  const poCup = played.filter(x => x.track === 'cup'), poEuro = played.filter(x => x.track === 'europe')
  const cupGoals = sum(cupLegs, 'goals') + sum(poCup, 'goals') + (pre?.cupGoals ?? 0), euroGoals = sum(euroLegs, 'goals') + sum(poEuro, 'goals') + (pre?.euroGoals ?? 0)
  const apps = lg.apps + sum(cupLegs, 'app') + sum(euroLegs, 'app') + sum(played, 'apps') + (pre?.apps ?? 0)
  const goals = lg.goals + cupGoals + euroGoals
  const assists = lg.assists + sum(cupLegs, 'assists') + sum(euroLegs, 'assists') + sum(played, 'assists') + (pre?.assists ?? 0)
  const stats = { ...lg, apps, goals, assists, cupGoals, euroGoals, lgAssists: lg.assists, lgApps: lg.apps }
  // the trophies: the league from the table, the cup final and the European final from the big nights
  // (a season in the second tier: no title in it counts as a league title, no place in it is a European one)
  const tier2 = f.league?.tier === 2
  const pos = f.seed ?? 20, size = f.standings?.length ?? 20
  const cupRd = line.find(x => x.track === 'cup')
  const cupWon = cupRd ? cupRd.won : !!f.cup?.champion
  const cupResult = cupRd ? (cupRd.won ? 'Winners' : 'Runners-up') : f.cup?.result ?? null
  const euroLine = line.filter(x => x.track === 'europe')
  const euroLast = euroLine[euroLine.length - 1]
  const comp = f.europe?.comp ?? null
  // (out in the league phase: the engine's word; through it, the round Career's knockouts got to)
  const euroResult = !f.europe ? null : euroLast ? (euroLast.won && euroLast.final ? 'Winners' : KO_PLURAL[euroLast.stage]) : f.europe.result
  const euroWon = euroResult === 'Winners'
  const champion = !!f.champion && !tier2
  const trophies = [...(champion ? [f.league?.name ?? 'League'] : []), ...(cupWon ? [f.cup?.name ?? 'Cup'] : []), ...(euroWon ? [f.europe.name] : [])]
  // next season in Europe: the league place and the cup (each league's real places, the Conference League among
  // them: the engine's soccerEuropePlaces), a European title (the Champions League for the Champions League's and
  // the Europa League's winners, the Europa League for the Conference League's)
  const cupWinner = cupRd ? (cupRd.won ? c.team : cupRd.opp) : f.cup?.winner ?? null
  const places = tier2 ? {} : soccerEuropePlaces(f.league?.id, f.standings ?? [], cupWinner)
  let qualified = places[c.team] ?? null
  if (cupWon && qualified !== 'ucl') qualified = 'uel'
  if (euroWon) qualified = comp === 'uecl' ? (qualified === 'ucl' ? 'ucl' : 'uel') : 'ucl'
  // international duty: the World Cup in a World Cup summer, the continental championship in its own
  const wc = wcSummer(c) ? soccerWorldCup(c, lg) : null
  const cont = soccerContinental(c, lg)
  const intl = intlSeason(c, lg, [wc, cont])
  // the league's awards (the engine's, on his real league totals: lib/seasonDirector.js soccerFinal)
  // the Golden Boot and the Golden Shoe: the engine's field, and the year's best rival in his league (a top scorer
  // most years near the league's usual winning total, now and then a 30-plus season), so a great striker wins it
  // in his best years, not every year (Messi's 8 Pichichis are the most in a top league)
  const rr = seeded(`${c.seed}-boot-${c.year}`), lu = () => { const u = clamp(rr(), 0.001, 0.999); return Math.log(u / (1 - u)) }
  const bootRival = (BOOT_TOP[f.league?.id] ?? 26) + 3.2 * lu(), shoeRival = 31 + 3 * lu()
  const boot = !!f.goldenBoot?.won && lg.goals >= bootRival, poty = !!f.playerOfSeason?.won, tots = !!f.teamOfSeason || poty, shoe = !!f.goldenShoe?.won && boot && lg.goals >= shoeRival
  // the Ballon d'Or
  const tp = (champion ? 8 : 0) + (comp ? BDO_EURO[comp]?.[euroResult] ?? 0 : 0) + (cupWon ? 3 : 0) + (wc?.called ? (BDO_WC[wc.finish] ?? 0) + (wc.ball === 'Golden Ball' ? 3 : 0) : 0)
    + (cont?.called ? ((BDO_CONT[cont.finish] ?? 0) + (cont.ball === 'Golden Ball' ? 2 : 0)) * (cont.major ?? 0.5) : 0)
  // (goals in the second tier count for half with the voters)
  const k2 = tier2 ? 0.5 : 1
  const mine = r10(bdoCase(goals * k2 + (wc?.goals ?? 0) + (cont?.goals ?? 0), assists * k2 + (wc?.assists ?? 0) + (cont?.assists ?? 0), tp) + (boot && !tier2 ? 2 : 0))
  // (and the year's best rival: most years a ~66 case, a 50-goal treble now and then, so it isn't his every year
  // he scores 40; the best man in the engine's field has that season)
  const field = (f.book?.bdo ?? f.ballonDor?.top ?? []).filter(x => !x.isPlayer).map(x => ({ ...x, score: r10(x.score - BDO_RIVAL.shift) })).sort((a, b) => b.score - a.score)
  const ru = clamp(seeded(`${c.seed}-bdo-${c.year}`)(), 0.001, 0.999), rival = BDO_RIVAL.mid + BDO_RIVAL.spread * Math.log(ru / (1 - ru))
  if (field[0] && field[0].score < rival) field[0].score = r10(rival)
  const rank = 1 + field.filter(x => x.score > mine).length
  const winner = rank === 1 ? null : field[0] ?? null
  // (rival: the best other case that year, and whose it was, so the screens can say who he beat or lost to)
  const bdo = { rank, finish: rank === 1 ? 'winner' : rank <= 3 ? 'top3' : rank <= 10 ? 'top10' : rank <= 30 ? 'nominated' : null, score: mine, winner: winner ? { name: winner.name, team: winner.team } : null, rival: field[0] ? { name: field[0].name, team: field[0].team, score: field[0].score } : null }
  const award = rank === 1
  const s = {
    year: c.year + 1, season: c.season, age: c.age, team: c.team, teamName: c.fit.name, ovr: c.ovr, role: c.role,
    league: f.league?.name ?? null, leagueId: f.league?.id ?? null, pos, size,
    // (the second tier: s.tier 2, promoted or not; a January move: where he came from, s.moved)
    ...(tier2 ? { tier: 2, promoted: !!f.promoted, promotedHow: f.promotedHow ?? null } : {}),
    ...(c.active?.moved ? { moved: c.active.moved } : {}),
    // (the final table, short: [short, W, D, L, GF, GA] in order; tableOf(s) reads it back with the names and the zones)
    table: (f.standings ?? []).map(x => [x.short, x.wins, x.draws, x.losses, x.gf, x.ga, ...(CLUB_BY.has(x.short) ? [] : [x.name])]), cupWinner,
    wins: f.wins, draws: f.draws ?? 0, losses: f.losses, points: f.points ?? (f.wins * 3 + (f.draws ?? 0)),
    // (soccer's "playoffs" for the legacy: a Champions League season)
    playoffs: comp === 'ucl', champion, trophies, cupName: f.cup?.name ?? null, cupResult, cupWon,
    europe: comp ? { comp, name: f.europe.name, result: euroResult } : null, uclWon: euroWon && comp === 'ucl', uelWon: euroWon && comp === 'uel', ueclWon: euroWon && comp === 'uecl',
    rounds: line.map(x => ({ round: x.name, opponent: x.oppName, won: x.won, mySc: x.mySc, oppSc: x.oppSc, legs: x.legs, pens: x.pens, track: x.track, sat: !!x.sat, ...(x.auto ? { auto: true } : {}) })),
    sb: null, stats, adv: seasonRaw('st', f, (f.games ?? []).filter(g => !g.sat && g.app)),
    award, awardName: S.awardName.st, bdo,
    proBowl: tots && !tier2, allPro: boot && !tier2, poty: poty && !tier2, shoe: shoe && !tier2, potyName: f.playerOfSeason?.name ?? null, bootName: f.goldenBoot?.name ?? 'Golden Boot',
    relegated: !!f.relegated && !tier2, qualified,
    // (his country: the World Cup, the continental championship, and where he stood in the pecking order up front)
    wc, cont, caps: intl.caps, intlGoals: intl.intlGoals, intlRole: intl.role, intlRank: intl.rank ?? null, intlOrder: intl.order ?? [], nation: c.nation,
    missed: f.story?.sat ?? 0, benched: c.active?.benched?.weeks ?? 0,
    records: (f.story?.records ?? []).map(x => x.label ?? x.id), milestones: (f.story?.milestones ?? []).filter(m => m.big).map(m => m.label),
    xp: f.story?.xp ?? 0, bestGame: f.bestGame ?? null,
    poStats: played.length ? { games: played.length, goals: sum(played, 'goals'), assists: sum(played, 'assists') } : null,
  }
  s.goals = c.goals.map(g => ({ ...g, met: goalMet(g, { stats, wins: f.wins, starts: lg.starts, startWins: 0 }) }))
  // the smaller honors: the Kopa Trophy (the best player 21 or under), man of the match in a final he won
  s.roy = c.age <= 21 && rank <= 12
  s.fmvp = played.some(x => x.final && x.won && x.hit && (x.score ?? 0) >= 0.7)
  // the records only a whole season shows: all competitions, the Champions League, a calendar year
  const prev = c.seasons[c.seasons.length - 1]
  const half = (list, h1) => list.filter(g => (h1 ? (g.wk ?? 0) <= 19 : (g.wk ?? 0) > 19)).reduce((a, g) => a + (g.goals ?? 0), 0)
  const lgGames = (f.games ?? []).filter(g => !g.sat)
  s.h1 = half(lgGames.map(g => ({ ...g, wk: g.wk * 39 / 38 })), true) + half([...cupLegs, ...euroLegs], true)
  s.h2 = goals - s.h1
  const calendar = (prev?.h2 ?? 0) + s.h1 + Math.round(((prev?.intlGoals ?? 0) + s.intlGoals) / 2)
  const booked = { allGoals: goals, uclGoals: comp === 'ucl' ? euroGoals : 0, calendar }
  for (const x of RECORDS.soccer?.st ?? []) if (x.booked && (booked[x.booked] ?? 0) > x.value) s.records = [...s.records, x.label]
  return s
}
// the second tiers' names (the engine's own, for the words here)
const TIER2_NAME = { 'eng.1': 'the Championship', 'esp.1': 'the Segunda División', 'ita.1': 'Serie B', 'ger.1': 'the 2. Bundesliga', 'fra.1': 'Ligue 2' }
const topFlight = short => soccerLeagueInfo(CLUB_BY.get(short)?.league)?.name ?? 'the top flight'
// after the season: next year's Europe, the caps, relegation and promotion, a loan that's over
function soccerAfterSeason(n, s) {
  let next = { ...n, europe: s.qualified ?? null, europeFor: s.team, caps: (n.caps ?? 0) + (s.caps ?? 0), intlGoals: (n.intlGoals ?? 0) + (s.intlGoals ?? 0) }
  next = { ...next, relegated: !!s.relegated }
  const ev = text => { next = { ...next, events: [...next.events, { year: s.year, text }] } }
  // Relegated. A relegation release clause in his contract (a star at a small club usually has one) lets a top-flight
  // club take him for a set fee; without one the club decides: it sells to balance the books, loans him out, or he
  // stays and plays the second tier (c.down, until the club is back up or he leaves). (Before 2026-11-24 every
  // relegation made him a free agent, whatever his deal said.)
  if (s.relegated && !next.loan) {
    const clause = !!next.contract?.relClause
    const fee = clause ? Math.max(1, Math.round(soccerValue(next) * 0.5)) : null
    next = { ...next, down: { team: s.team, year: s.year, clause, fee } }
    ev(clause ? `${s.teamName} go down. The relegation clause in ${next.name}'s contract is live: a top-flight club can sign him for ${feeText(fee, s.team)}.` : `${s.teamName} go down to ${TIER2_NAME[CLUB_BY.get(s.team)?.league] ?? 'the second tier'}. ${next.name}'s contract has no relegation clause: the club decides whether he is sold.`)
  }
  // a season in the second tier: promoted (back in the top flight), or another year down there
  if (s.tier === 2 && next.down?.team === s.team && !next.loan) {
    if (s.promoted) { next = { ...next, down: null }; ev(`${s.teamName} are promoted${s.promotedHow === 'playoff' ? ' through the play-offs' : s.pos === 1 ? ' as champions' : ''}. Back in ${topFlight(s.team)}.`) }
    else ev(`${s.teamName} finish ${ordinal(s.pos)} and miss out on promotion. Another season in ${TIER2_NAME[CLUB_BY.get(s.team)?.league] ?? 'the second tier'}.`)
  }
  if (next.loan && s.year >= next.loan.until) {
    const from = next.loan.from, back = soccerClub(from)
    const pc = next.loan.contract
    // (his own club went down while he was away: about half come straight back up)
    let down = next.loan.down ?? null
    if (down && seeded(`${n.seed}-loanup-${s.year}`)() < 0.5) { down = null }
    next = { ...next, team: from, roster: rosterOf({ ...next, team: from }, from), europe: null, europeFor: null, lastRole: null, loan: null, down, contract: { ...pc, left: Math.max(0, (pc.left ?? 1) - 1) }, events: [...next.events, { year: s.year, text: `Back at ${back.name} after ${next.loan.half ? 'half a season' : 'a season'} on loan at ${s.teamName}${next.loan.down ? (down ? `. ${back.name} are still in ${TIER2_NAME[back.league] ?? 'the second tier'}` : `. ${back.name} came straight back up`) : ''}.` }] }
  }
  return next
}
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
// the summer's biggest movers around Europe
function soccerNews(league, was, now) {
  return SOCCER_CLUBS.map(t => ({ t, d: now(t.short) - was(t.short) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3)
    // (the words by the club's size: a giant spends big and rebuilds when it loses players; a smaller club has a busy
    // window and sells its best ones. 'Málaga spend big all summer' and 'Manchester City sell their best players' read wrong)
    .map(({ t, d }) => {
      const big = CLUB_RANK.indexOf(t.short) < 16
      const what = d > 0 ? (d > 2 ? (big ? 'spend big all summer: the winners of the window' : 'have the busiest window in their history: a stronger squad on paper') : (big ? 'strengthen in the window' : 'bring in a few smart signings'))
        : d < -2 ? (big ? 'lose key players over the summer: a squad in transition' : 'sell their best players. A long season ahead') : (big ? 'look short of a striker after the window' : 'take a step back')
      return `${t.name} ${what}.`
    })
}

// ── The transfer window ──
// The clubs that would sign him, each with how keen it is. A club signs a player good enough for it (clubNeed: a
// giant the best, or a teenager who will be; a small club a player who'd start for it), whose fee and wages it can
// pay (clubPurse), and mostly from clubs below it or beside it: a step up is the usual move, a step down for a man
// who isn't playing (anyStep) or is out of contract (free).
// (Before 2026-11-24 the bidders were the clubs rated above his own: for a star, Arsenal, City and Bayern, every year.)
const seasonsHere = c => { let k = 0; for (let i = c.seasons.length - 1; i >= 0 && c.seasons[i].team === c.team; i--) k++; return k }
function suitors(c, { fee = 0, free = false, anyStep = false } = {}) {
  const worth = soccerWage(c), here = standing(c.team), lg = CLUB_BY.get(c.team)?.league
  const out = []
  for (const t of CLUB_RANK) {
    if (t === c.team || t === c.loan?.from) continue
    const purse = clubPurse(t)
    if (!free && purse.fee < fee * 0.85) continue
    if (purse.wage < worth * 0.45) continue
    if ((c.ovr ?? 70) < clubNeed(t) - ((c.age ?? 25) <= 21 ? 7 : 2)) continue
    const st = standAt(c, t), step = here - standing(t)
    let w = step > 0.05 ? 1.6 : step > -0.05 ? 0.7 : anyStep || free ? 0.6 : 0.15
    w *= st.starter ? 1.3 : st.role === 'Rotation' ? 0.7 : 0.2
    // (a bigger club in his own league knows him best; a rival his own club's size rarely gets him)
    if (CLUB_BY.get(t)?.league === lg) w *= step > 0.05 ? 1.25 : 0.6
    out.push({ t, w, st, purse, step })
  }
  return out
}
// n of them, the keener the likelier, no club twice
const pickSome = (r, list, n) => list.map(x => ({ x, k: Math.pow(r(), 1 / Math.max(0.01, x.w)) })).sort((a, b) => b.k - a.k).slice(0, n).map(y => y.x)
const dealYears = c => (c.age <= 26 ? 5 : c.age <= 29 ? 4 : c.age <= 31 ? 3 : 2)
const bidPitch = (stand, bigger) => (stand.starter ? (bigger ? 'A bigger club, and the No. 9 shirt is his.' : 'They want him to lead the line. Starts every week.') : bigger ? 'A bigger stage and the trophies that come with it, but a fight for the shirt.' : 'More money, and a fight for a place in the team.')
const fitAtFor = c => short => teamFit(short, c.pos, { roster: short === c.team ? c.roster : null, league: c.league, name: c.name, sport: 'soccer', yrs: rosterYrs(c), gone: outOf(c, short) })
const WINDOWS = new Map()
// The summer window, mid-contract. → { offers, rejected: [{ team, name, fee }] }
// Bids come when he's earned them and the timing is right: a big season, not the summer after he signed (a club
// that has just paid for him isn't selling, and nobody asks), fewer with four years left on his deal, fewer for a
// player already at one of the biggest clubs. His own club can turn a bid down; a bid at his release clause it can't.
function windowState(c) {
  const id = `${c.seed}|${c.year}|${c.team}|${c.ovr}|${c.contract?.left}|${c.contract?.perYear}|${c.lastRole}|${c.down?.team ?? ''}`
  if (WINDOWS.has(id)) return WINDOWS.get(id)
  const r = seeded(`${c.seed}-tw-${c.year}`)
  const last = c.seasons[c.seasons.length - 1]
  const perf = last ? seasonScore('st', last) : 0.3
  const value = soccerValue(c), clause = releaseFee(c)
  const fitAt = fitAtFor(c)
  const myStr = strength(soccerClub(c.team)), here = seasonsHere(c)
  const offers = [], rejected = []
  const bid = (x, fee, more = {}) => ({ kind: 'bid', team: x.t, fit: fitAt(x.t), stand: x.st, years: dealYears(c), perYear: wageAt(c, x.t, r, { rise: true }), fee, pitch: bidPitch(x.st, x.step > 0.05), ...more })
  const downNow = c.down?.team === c.team && c.down.year === last?.year
  if (downNow) {
    // relegated this summer
    if (c.down.clause) {
      const n = 1 + (r() < 0.7 ? 1 : 0) + (r() < 0.4 ? 1 : 0)
      for (const x of pickSome(r, suitors(c, { fee: c.down.fee, anyStep: true }), n)) offers.push(bid(x, c.down.fee, { clause: 'relegation', pitch: x.st.starter ? 'They have triggered his relegation clause. Top-flight football, and the No. 9 shirt.' : 'They have triggered his relegation clause. Top-flight football, and a fight for the shirt.' }))
    } else {
      // (the club cuts its wage bill: a player worth real money, or paid more than the second tier can carry, is for sale
      // under his value; some go on loan for the year instead)
      const sell = value >= 6 || c.contract.perYear > clubPurse(c.team).wage * 0.5
      const n = sell ? (r() < 0.75 ? 1 : 0) + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 1 : 0) : 0
      const pool = suitors(c, { fee: value * 0.7, anyStep: true })
      const got = pickSome(r, pool, n)
      for (const x of got) offers.push(bid(x, Math.max(1, Math.round(Math.min(value * (0.6 + r() * 0.2), x.purse.fee))), { pitch: x.st.starter ? 'A fee is agreed with the club. Top-flight football, and the No. 9 shirt.' : 'A fee is agreed with the club. Top-flight football, and a fight for the shirt.' }))
      if (r() < 0.5) {
        const x = pickSome(r, pool.filter(y => y.st.starter && !got.includes(y)), 1)[0]
        if (x) offers.push({ kind: 'loan', team: x.t, fit: fitAt(x.t), stand: x.st, years: 1, perYear: c.contract.perYear, pitch: `A season on loan in the top flight while ${soccerClub(c.team).name} are down.` })
      }
    }
    const out = { offers, rejected }
    WINDOWS.set(id, out)
    return out
  }
  // a young player who barely played: a loan where he'd start, and back after a season
  if (c.lastRole === 'Backup' && c.age <= 23 && !c.loan && r() < 0.8) {
    const list = CLUB_RANK.filter(t => t !== c.team && strength(soccerClub(t)) < myStr - 0.5).map(t => ({ t, k: r() })).sort((a, b) => a.k - b.k).slice(0, 8).map(x => x.t).find(t => standAt(c, t).starter)
    if (list) offers.push({ kind: 'loan', team: list, fit: fitAt(list), stand: standAt(c, list), years: 1, perYear: c.contract.perYear, pitch: 'A season on loan: a starter every week, then back.' })
  }
  // bids
  const backup = c.lastRole === 'Backup'
  let heat = clamp(0.12 + perf * 0.65 - (c.age >= 30 ? 0.2 : 0) - (c.age >= 33 ? 0.2 : 0), 0.03, 0.75)
  // (the summers after a club paid for him: it isn't selling, and nobody asks. A player who came through the academy
  // has no such year: a breakout season brings the bids at once)
  const bought = c.contract.kind === 'transfer' || c.contract.kind === 'fa' || c.seasons.some(x => x.team !== c.team)
  heat *= bought ? (here <= 1 ? 0.12 : here === 2 ? 0.5 : 1) : 1
  heat *= c.contract.left >= 4 ? 0.6 : c.contract.left <= 2 ? 1.2 : 1
  if (standing(c.team) < 0.08) heat *= 0.5
  if (clause != null && clause <= value * 1.15) heat = Math.min(0.9, heat * 1.6)   // (a clause at his value or under it: clubs line up to trigger it)
  if (backup && !c.loan) heat = Math.max(heat, 0.45)                                // (not playing: a club that would play him asks)
  if (c.loan) heat = 0
  let n = r() < heat ? 1 : 0
  if (n) n += (r() < heat * 0.6 ? 1 : 0) + (r() < heat * 0.3 ? 1 : 0)
  if (n) {
    const pool = suitors(c, { fee: Math.min(value, clause ?? Infinity), anyStep: backup }).filter(x => !backup || x.st.role !== 'Bench')
    for (const x of pickSome(r, pool, n)) {
      let fee = Math.max(1, Math.round(Math.min(value * (0.9 + r() * 0.35), x.purse.fee)))
      // (a bid that reaches his release clause triggers it: the fee is the clause, and his club can't refuse)
      const meets = clause != null && x.purse.fee >= clause && fee >= clause * 0.92
      if (meets) fee = clause
      const no = meets ? 0 : clamp((x.step > 0.05 ? 0.15 : 0.55) + (c.contract.left >= 4 ? 0.15 : 0) + (bought && here <= 1 ? 0.2 : 0) - (backup ? 0.4 : 0) - (c.contract.left <= 1 ? 0.3 : 0), 0, 0.85)
      if (r() < no) { rejected.push({ team: x.t, name: soccerClub(x.t).name, fee }); continue }
      offers.push(bid(x, fee, meets ? { clause: 'release', pitch: x.st.starter ? 'They have met his release clause. The No. 9 shirt is his if he wants it.' : 'They have met his release clause. A fight for the shirt, if he wants the move.' } : {}))
    }
  }
  // his own club: a new deal with two years left or less, after a good season
  // (a new deal shortens with age: one year at a time from 34; the long run is for a young man. Past 32 the wage is
  // what he's worth now, which can be less than he's on)
  const renewYrs = clamp(c.contract.left + 2 + (c.age <= 27 ? 1 : 0), 1, c.age >= 34 ? 1 : c.age >= 32 ? 2 : c.age >= 30 ? 3 : 5)
  if (c.contract.left <= 2 && perf >= 0.35 && !c.loan) {
    const pay = wageAt(c, c.team, r)
    offers.unshift({ kind: 'renew', team: c.team, fit: fitAt(c.team), stand: standAt(c, c.team), years: renewYrs, perYear: r10(c.age >= 32 ? Math.max(pay, c.contract.perYear * 0.6) : Math.max(pay, c.contract.perYear)), pitch: c.age >= 32 ? (renewYrs === 1 ? 'A one-year extension. They want him for another season.' : 'A new deal to see out the end of his career here.') : c.age >= 29 ? 'A new deal. They want him for the next few seasons.' : 'A new deal. They want him for the long run.' })
  }
  const out = { offers, rejected }
  if (WINDOWS.size > 60) WINDOWS.clear()
  WINDOWS.set(id, out)
  return out
}
function soccerWindow(c) {
  const { offers } = windowState(c)
  return offers.length ? offers : null
}
// the bids his club turned down this summer, told (bookSeason calls it once the window's offers are in)
function soccerWindowNews(c) {
  if (!((c.contract?.left ?? 0) > 0)) return c
  const { rejected } = windowState(c)
  if (!rejected.length) return c
  const club = soccerClub(c.team).name
  return { ...c, off: { ...(c.off ?? {}), rejected }, events: [...c.events, ...rejected.map(x => ({ year: c.year + 1, text: `${club} turn down a ${feeText(x.fee, c.team)} bid from ${x.name} for ${c.name}.` }))] }
}
// Out of contract: the clubs that want him on a free. His own (a new deal, when it wants him), the biggest club
// that would take him (lower wages, the trophies), and the one that pays the most to make him its No. 9.
function soccerMarket(c, fresh = false, left = null) {
  const r = seeded(`${c.seed}-fa-${c.year}${fresh ? '-back' : ''}`)
  const last = c.seasons[c.seasons.length - 1]
  const perf = last ? seasonScore('st', last) : 0.3
  // past his prime and a bad year: nobody calls
  if (!fresh && c.age >= 33 && perf < 0.3) return []
  const cap = y => (fresh ? 1 : left != null ? Math.min(y, left) : y)
  const years = c.age >= 33 ? 1 : c.age >= 31 ? 1 + Math.floor(r() * 2) : c.age >= 29 ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3)
  const fitAt = fitAtFor(c)
  const mk = (t, k, yrs, pitch, kind) => ({ team: t, fit: fitAt(t), perYear: wageAt(c, t, r, { k }), years: cap(Math.max(1, yrs)), pitch, kind, stand: standAt(c, t) })
  const pool = suitors(c, { free: true })
  const list = []
  const mine = standAt(c, c.team)
  if (!c.loan && (perf >= 0.25 || mine.starter)) list.push(mk(c.team, 0.95, years, fresh ? 'Back where he left off. One more season here.' : 'A new contract. They want him to stay.', 'stay'))
  // two clubs that would sign him: the bigger of them is the step up (lower wages, the trophies), the other pays the
  // most it can to make him its No. 9
  const first = pickSome(r, pool.filter(x => x.st.role !== 'Bench'), 1)[0] ?? pickSome(r, pool, 1)[0] ?? null
  const second = first ? pickSome(r, pool.filter(x => x.t !== first.t && x.st.starter), 1)[0] ?? pickSome(r, pool.filter(x => x.t !== first.t), 1)[0] ?? null : null
  const two = [first, second].filter(Boolean).sort((a, b) => standing(a.t) - standing(b.t))
  const contender = two.length === 2 || (two[0] && two[0].step > 0) ? two[0] : null
  const payer = two.length === 2 ? two[1] : contender ? null : two[0] ?? null
  if (contender) list.push(mk(contender.t, 0.85, years - 1, fresh ? 'A year at a big club. One more shot at a trophy.' : contender.st.starter ? 'Lower wages. A real shot at the title.' : 'Lower wages, a place in the squad, a real shot at the title.', 'contender'))
  if (payer) list.push(mk(payer.t, 1.15, years + (c.age < 29 ? 1 : 0), fresh ? 'The best money on the table for one more season.' : 'The top wages on offer. A club that wants a big name up front.', 'payer'))
  return list
}
// turn them all down: he stays on the deal he has
export function stayPut(c) {
  const bids = (c.offers ?? []).filter(o => o.team !== c.team)
  const down = c.down?.team === c.team
  const where = down ? `${c.fit.name} in ${TIER2_NAME[CLUB_BY.get(c.team)?.league] ?? 'the second tier'}` : c.fit.name
  const text = bids.length ? `Turned down ${bids.map(o => (o.kind === 'loan' ? `a loan to ${o.fit.name}` : o.fit.name)).join(', ')}. Staying at ${where}.` : `Staying at ${where}.`
  return { ...c, offers: null, talks: null, decisions: [...c.decisions, { year: c.year + 1, text }] }
}
function soccerSign(c, o) {
  const change = o.team !== c.team
  const club = soccerClub(o.team)
  if (o.kind === 'loan') {
    const roster = rosterOf(c, o.team)
    // (a January loan runs to the end of this season: o.half)
    return { ...c, team: o.team, roster, kept: keepRoster(c), fit: teamFit(o.team, c.pos, { roster, league: c.league, name: c.name, sport: 'soccer' }), offers: null, talks: null, tradeAsked: false, lastRole: null, down: null, loan: { from: c.team, until: o.half ? c.year + 1 : c.year + 2, contract: c.contract, ...(o.half ? { half: true } : {}), ...(c.down?.team === c.team ? { down: c.down } : {}) }, contract: { kind: 'loan', years: 1, left: 1, perYear: c.contract.perYear }, off: c.off ? { ...c.off, moves: [] } : c.off,
      decisions: [...c.decisions, { year: c.year + 1, text: o.half ? `Joined ${club.name} on loan from ${soccerClub(c.team).name} until the end of the season` : `Joined ${club.name} on a season-long loan from ${soccerClub(c.team).name}` }] }
  }
  const roster = change ? rosterOf(c, o.team) : c.roster
  // (the clauses: a release clause when he asked for one, and always in Spain; a relegation clause for a small club's star)
  const cl = clausesFor(c, o, soccerValue({ ...c, contract: { left: o.years } }))
  const extras = [o.noTrade ? `a ${feeText(cl.release, o.team)} release clause` : null, o.starter ? 'a first-team promise' : null].filter(Boolean)
  const how = !change ? `Signed a new deal at ${club.name}` : o.kind === 'bid' ? `Joined ${club.name} for ${feeText(o.fee ?? soccerValue(c), c.team)}${o.clause === 'release' ? ' (his release clause)' : o.clause === 'relegation' ? ' (his relegation clause)' : ''}` : `Signed for ${club.name} on a free transfer`
  return {
    ...c, team: o.team, roster, ...(change ? { kept: keepRoster(c), europe: null, europeFor: null, down: null } : {}), fit: teamFit(o.team, c.pos, { roster, league: c.league, name: c.name, sport: 'soccer' }), offers: null, talks: null, tradeAsked: false, lastRole: change ? null : c.lastRole, loan: null, ...(change && c.off ? { off: { ...c.off, moves: [] } } : {}),
    contract: { kind: change ? (o.kind === 'bid' ? 'transfer' : 'fa') : 'ext', years: o.years, left: o.years, perYear: o.perYear, noTrade: !!o.noTrade, starter: !!o.starter, release: cl.release, relClause: cl.relClause },
    decisions: [...c.decisions, { year: c.year + 1, text: `${how}: ${o.years} ${o.years === 1 ? 'yr' : 'yrs'}, ${wageText(o.perYear, o.team)}${extras.length ? ` (${extras.join(', ')})` : ''}` }],
  }
}
// A transfer request: the club can say no (a release clause in his deal means it can't); granted, he's sold: to a
// club whose bid it turned down this summer when there was one, else to one that wants him and would play him
function soccerTransferRequest(c) {
  const r = seeded(`${c.seed}-trade-${c.year}`)
  const granted = !!c.contract.noTrade || r() < 0.7
  const rep = Math.max(1, c.rep - 2)
  const from = soccerClub(c.team)
  if (!granted) return { ...c, rep, tradeAsked: true, nextMods: { ...(c.nextMods ?? {}), off: ((c.nextMods?.off) ?? 0) - 0.5 }, events: [...c.events, { year: c.year + 1, text: `${c.name} handed in a transfer request. ${from.name} turned it down, and the dressing room heard about it.` }] }
  const value = soccerValue(c), clause = releaseFee(c)
  const turned = (c.off?.rejected ?? []).filter(x => x.team !== c.team && CLUB_BY.has(x.team))
  const pool = suitors(c, { fee: Math.min(value, clause ?? Infinity) * 0.8, anyStep: true })
  const starts = pool.filter(x => x.st.starter)
  const dest = turned[0]?.team ?? pickSome(r, starts.length ? starts : pool, 1)[0]?.t ?? CLUB_RANK.filter(t => t !== c.team).find(t => standAt(c, t).starter) ?? CLUB_RANK.find(t => t !== c.team)
  const roster = rosterOf(c, dest)
  const fit = teamFit(dest, c.pos, { roster, league: c.league, name: c.name, sport: 'soccer' })
  const fee = Math.max(1, Math.round(Math.min(turned[0]?.fee ?? value, clause ?? Infinity, Math.max(clubPurse(dest).fee, 1))))
  const years = Math.max(c.contract.left, 3)
  const cl = clausesFor(c, { team: dest, kind: 'bid' }, soccerValue({ ...c, contract: { left: years } }))
  return { ...c, rep, tradeAsked: true, team: dest, roster, kept: keepRoster(c), fit, lastRole: null, europe: null, europeFor: null, down: null, contract: { kind: 'transfer', years, left: years, perYear: wageAt(c, dest, r, { rise: !c.down }), noTrade: false, starter: false, release: cl.release, relClause: cl.relClause }, off: { ...(c.off ?? {}), moves: [] },
    events: [...c.events, { year: c.year + 1, text: `Transfer request granted: ${from.name} sell ${c.name} to ${fit.name} for ${feeText(fee, from.short)}.` }],
    decisions: [...c.decisions, { year: c.year + 1, text: `Handed in a transfer request, sold to ${fit.name} for ${feeText(fee, from.short)}` }] }
}

// ── The January window, and the international break ──
// Two stops in the season (the engine's own beats, lib/career.js advanceWeek): the November international break (the
// bye week's choice: extra work on the training ground, or rest) and the January window (bids, a loan for a young
// player who isn't playing; taken, he finishes the season at the new club: lib/career.js januaryMove).
const breakAt = total => Math.round(total * 12 / 38), janAt = total => Math.round(total * 21 / 38)
function januaryOffers(c, D, k) {
  if (c.loan || (c.contract?.left ?? 0) <= 0) return []
  const r = seeded(`${c.seed}-jan-${c.year}`)
  const games = D.games.slice(0, k).filter(g => !g.sat && g.app)
  const goals = games.reduce((a, g) => a + (g.goals ?? 0), 0), mins = games.reduce((a, g) => a + (g.mins ?? 0), 0)
  // (the half-season as the clubs see it: his goals for the minutes, on the season's scale)
  const want = clamp(0.2 + ((c.ovr ?? 75) - 75) * 0.025, 0.12, 0.85), g90 = mins >= 270 ? goals / (mins / 90) : 0
  const hot = clamp(g90 / want, 0, 2), share = clamp(mins / Math.max(1, k * 90), 0, 1)
  const here = seasonsHere(c), role = soccerRole(c)
  const fitAt = fitAtFor(c)
  const offers = []
  // a young player who isn't getting on the pitch: a loan to the end of the season
  if (share < 0.3 && c.age <= 23 && r() < 0.7) {
    const myStr = strength(soccerClub(c.team))
    const t = CLUB_RANK.filter(x => x !== c.team && strength(soccerClub(x)) < myStr - 0.3).map(x => ({ x, k: r() })).sort((a, b) => a.k - b.k).slice(0, 8).map(y => y.x).find(x => standAt(c, x).starter)
    if (t) offers.push({ kind: 'loan', half: true, team: t, fit: fitAt(t), stand: standAt(c, t), years: 1, perYear: c.contract.perYear, pitch: 'A loan until the end of the season: a starter every week, then back.' })
  }
  // bids: January business is rarer and dearer (a club doesn't sell its No. 9 in mid-season without a premium)
  const value = soccerValue(c), clause = releaseFee(c)
  let heat = clamp(0.05 + hot * 0.14, 0.03, 0.32) * (here < 1 ? 0.15 : 1) * (standing(c.team) < 0.08 ? 0.5 : 1)
  if (share < 0.3) heat = Math.max(heat, 0.3)
  if (clause != null && clause <= value * 1.15) heat = Math.min(0.6, heat * 1.6)
  const n = (r() < heat ? 1 : 0) + (r() < heat * 0.35 ? 1 : 0)
  if (n) {
    const pool = suitors(c, { fee: Math.min(value * 1.1, clause ?? Infinity), anyStep: share < 0.3 }).filter(x => share >= 0.3 || x.st.role !== 'Bench')
    for (const x of pickSome(r, pool, n)) {
      let fee = Math.max(1, Math.round(Math.min(value * (1.05 + r() * 0.3), x.purse.fee)))
      const meets = clause != null && x.purse.fee >= clause && fee >= clause * 0.92
      if (meets) fee = clause
      offers.push({ kind: 'bid', january: true, team: x.t, fit: fitAt(x.t), stand: x.st, years: dealYears(c), perYear: wageAt(c, x.t, r, { rise: true }), fee, ...(meets ? { clause: 'release' } : {}), pitch: meets ? 'They have met his release clause in the January window.' : x.st.starter ? 'A January move. They need a No. 9 now.' : 'A January move, and a fight for the shirt.' })
    }
  }
  return offers
}
// a January move: the calendar week it happened in, and his cup and European line for the club he left
function soccerMovedLine(c, k, D) {
  const f = c.active?.base, total = D?.total ?? f?.games?.length ?? 38
  const wk = k * 38 / Math.max(1, total)
  const sat = new Set((D?.games ?? []).slice(0, k).filter(g => g.sat).map(g => g.wk))
  const mine = g => (g.wk ?? 0) <= wk && !sat.has(Math.max(1, Math.round((g.wk ?? 0) * 38 / 39)))
  const cup = (f?.cup?.rounds ?? []).flatMap(t => t.legs ?? []).filter(mine), euro = [...(f?.europe?.games ?? []), ...(f?.europe?.rounds ?? []).flatMap(t => t.legs ?? [])].filter(mine)
  const sum = (list, key) => list.reduce((a, g) => a + (g[key] ?? 0), 0)
  return { wk, before: { cupGoals: sum(cup, 'goals'), euroGoals: sum(euro, 'goals'), assists: sum(cup, 'assists') + sum(euro, 'assists'), apps: sum(cup, 'app') + sum(euro, 'app') } }
}
function soccerBeat(c, D, k) {
  const a = c.active, total = D.total
  if (total < 20 || a.out) return null
  if (k === breakAt(total) && !a.brk) {
    const call = soccerCallUp(c, null)
    return { stop: true, set: { brk: { k, called: !!call.called, nation: c.nation } }, notes: [{ note: call.called ? `The November international break. ${c.name} is away with ${nationName(c.nation)}.` : `The November international break. ${c.name} stays at the training ground with the players who weren't called up.`, noteKind: 'INTERNATIONAL BREAK' }] }
  }
  if (k === janAt(total) && !a.jan) {
    const offers = januaryOffers(c, D, k)
    const bids = offers.filter(o => o.kind === 'bid'), loans = offers.filter(o => o.kind === 'loan')
    const names = list => list.map(o => o.fit.name).join(' and ')
    return { stop: true, set: { jan: { k, offers } }, notes: offers.length ? [{ note: bids.length ? `The January window. ${names(bids)} ${bids.length === 1 ? 'has' : 'have'} made ${bids.length === 1 ? 'a bid' : 'bids'} for ${c.name}.` : `The January window. ${names(loans)} ${loans.length === 1 ? 'wants' : 'want'} ${c.name} on loan until the end of the season.`, noteKind: 'JANUARY WINDOW' }] : [] }
  }
  return null
}

// ── The league table ──
// zones: where a place leads (the screens colour the table by it)
function zonesFor(leagueId, rows, cupWinner = null, final = false) {
  const info = soccerLeagueInfo(leagueId)
  const tier2 = /\.2$/.test(String(leagueId ?? ''))
  const size = rows.length
  if (tier2) return rows.map(x => ({ ...x, zone: x.pos <= 2 ? 'up' : x.pos <= (info?.playoffTo ?? 6) ? 'playoff' : null }))
  const places = soccerEuropePlaces(leagueId, rows, final ? cupWinner : null)
  return rows.map(x => ({ ...x, zone: places[x.short] ?? (x.pos > size - (info?.down ?? 3) ? 'down' : info?.playoff && x.pos === size - (info.down ?? 2) ? 'playoff' : null) }))
}
// The table as it stands, mid-season: every club's W-D-L, goals, points and place after the matches played so far
// (his own club's from the matches as they were really played). → [{ short, name, played, wins, draws, losses, gf, ga,
// gd, points, pos, isUs, zone }] or null (a season started before 2026-11-24 has none until it's over)
export function soccerTable(c, D = null) {
  const a = c?.active
  if (!a) return null
  if (a.final?.standings) return zonesFor(a.final.league?.id, a.final.standings, null, true)
  const form = a.base?.form
  if (!form) return null
  const games = (D?.games ?? a.snap?.games ?? []).slice(0, a.k)
  const from = a.moved?.k ?? 0
  const rows = soccerTableAt(form, a.k, { short: c.team, games: games.map((g, i) => (i < from ? null : g)) })
  return zonesFor(a.base.league?.id, rows)
}
// a booked season's final table, read back from the short form it's kept in (null for a season from before the table)
export function tableOf(s) {
  if (!Array.isArray(s?.table) || !s.table.length) return null
  const rows = s.table.map(([short, wins, draws, losses, gf, ga, name], i) => ({ short, name: name ?? CLUB_BY.get(short)?.name ?? short, extra: !CLUB_BY.has(short), played: wins + draws + losses, wins, draws, losses, gf, ga, gd: gf - ga, points: wins * 3 + draws, pos: i + 1, isUs: short === s.team }))
  return zonesFor(s.leagueId, rows, s.cupWinner ?? null, true)
}

// ── Legacy, in football's terms ──
// The resume: seasons, Team of the Season (soccer's Pro Bowl: past 8 they count half), Golden Boots, Player of the
// Season awards, Ballon d'Ors (and top-three finishes), the European Golden Shoe, league titles, cups, the Champions
// League, the Europa League, the World Cup, a continental title with his country, the records, and the goals and
// assists (club and country). The Ballon d'Or, the Champions League and the World Cup weigh the most, the way MVPs and
// rings do in the other sports. The greats (data/legacy-resumes.js RESUMES.st) are scored the same way.
export const SOCCER_LW = { seasons: 2, tots: 4, boots: 6, poty: 7, bdo: 25, bdoPod: 6, shoe: 4, leagues: 7, cups: 2, ucl: 15, uel: 4, uecl: 2, wc: 30, cont: 8, records: 6 }
export const SOCCER_BDO_REPEAT = 6
function soccerLegacy(r) {
  const k = { ...r, tots: countedHonors(r.tots ?? 0) }
  return Math.round(Object.entries(SOCCER_LW).reduce((s, [key, w]) => s + (k[key] ?? 0) * w, 0) + Math.max(0, (r.bdo ?? 0) - 1) * SOCCER_BDO_REPEAT + (r.stats?.goals ?? 0) / 15 + (r.stats?.assists ?? 0) / 50 + (r.bonus ?? 0))
}
function soccerTotals(c) {
  const Ss = c.seasons, n = k => Ss.filter(s => s[k]).length
  return {
    draws: Ss.reduce((a, s) => a + (s.draws ?? 0), 0), leagueTitles: n('champion'), cups: n('cupWon'), ucl: n('uclWon'), uel: n('uelWon'), uecl: n('ueclWon'), wc: Ss.filter(s => s.wc?.champion).length,
    // (his country's continental titles: `cont` weighs them for the legacy, a Euros or a Copa América whole, an Asian
    // Cup or a Gold Cup half; contTitles lists them by name)
    cont: Ss.reduce((a, s) => a + (s.cont?.champion ? s.cont.major ?? 0.5 : 0), 0), contTitles: Ss.filter(s => s.cont?.champion).map(s => ({ year: s.cont.year, name: s.cont.name, short: s.cont.short })), continentals: Ss.filter(s => s.cont?.called).length,
    bdo: n('award'), bdoPod: Ss.filter(s => !s.award && (s.bdo?.rank ?? 99) <= 3).length, boots: n('allPro'), tots: n('proBowl'), poty: n('poty'), shoes: n('shoe'), kopa: n('roy'),
    trophies: Ss.reduce((a, s) => a + (s.trophies?.length ?? 0) + (s.wc?.champion ? 1 : 0) + (s.cont?.champion ? 1 : 0), 0),
    caps: Ss.reduce((a, s) => a + (s.caps ?? 0), 0), intlGoals: Ss.reduce((a, s) => a + (s.intlGoals ?? 0), 0),
    wcGoals: Ss.reduce((a, s) => a + (s.wc?.goals ?? 0), 0), worldCups: Ss.filter(s => s.wc?.called).length,
  }
}
function soccerResume(c, t) {
  return { seasons: t.seasons, tots: t.tots, boots: t.boots, poty: t.poty, bdo: t.bdo, bdoPod: t.bdoPod, shoe: t.shoes, leagues: t.leagueTitles, cups: t.cups, ucl: t.ucl, uel: t.uel, uecl: t.uecl ?? 0, wc: t.wc, cont: t.cont ?? 0, records: t.records, stats: { goals: (t.stats.goals ?? 0) + (t.intlGoals ?? 0), assists: t.stats.assists ?? 0 }, bonus: (c.legacyBonus ?? 0) + earnLegacy(c) }
}
// the tiers, in football's words (no Hall of Fame: the icon call at the end)
export const SOCCER_TIERS = [[0, 'Squad Player'], [80, 'Star'], [170, 'World Class'], [280, 'Legend']]
// The verdict when he retires: an icon of the game, a legend at the club he gave the most years to, or neither
function soccerIcon(c, L) {
  const by = {}
  for (const s of c.seasons) by[s.team] = (by[s.team] ?? 0) + 1
  const home = Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] ?? c.team
  const club = soccerClub(home).name
  const icon = L.score >= 330, legend = L.score >= HOF_LEGACY
  return { in: legend, icon, club: home, pct: null, ballot: icon ? 'An icon of the game' : legend ? `${/^[AEIOU]/i.test(club) ? 'An' : 'A'} ${club} legend` : L.score >= 140 ? `Remembered at ${club}` : 'A career in the game' }
}

// ── Registered ───────────────────────────────────────────────────────────────
SOCCER.tiers = SOCCER_TIERS
// the Career screens' words for soccer (components/app/AppCareer.jsx reads S.ui)
SOCCER.ui = {
  introSteps: [
    ['Build', 'Name your striker, pick his country and build him from traits, the same spins as a normal game.'],
    ['The academy', 'Trials in front of the scouts, then sit-downs with the coaches. Do well and the big clubs offer a first contract. Pick one.'],
    ['The career', 'Season after season: the league, the cup, Europe and the big nights. A place in the team to win, injuries, a transfer window every summer, a World Cup every four years.'],
    ['Legacy', 'Golden Boots, the Ballon d\u2019Or, the Champions League, the World Cup. Where the career ranks among the greatest attackers ever.'],
  ],
  award: "Ballon d'Or",
  legacyHow: "Points come from seasons played, Team of the Season places, Golden Boots, Player of the Season awards, the Ballon d'Or (the most of all), league titles, cups, the Champions League, the World Cup, records, and every goal and assist: the same formula that scores the greatest attackers' real careers.",
  devNote: 'Every summer brings a development point while he\u2019s young; a Ballon d\u2019Or or the Kopa Trophy brings one more.',
}
SOCCER.extra = { st: ['xg', 'avgRating'] }
SOCCER.x = {
  role: soccerRole, academyText, interviews: soccerInterviews, offers: soccerOffers,
  newCareer: nation => ({ nation: soccerNationOf(nation), caps: 0, intlGoals: 0, europe: null }),
  onFinal: soccerFinal, finishLeague: soccerFinishLeague, round: soccerRound, season: soccerSeason, afterSeason: soccerAfterSeason,
  news: soccerNews, window: soccerWindow, windowNews: soccerWindowNews, market: soccerMarket, sign: soccerSign, transferRequest: soccerTransferRequest, wageCap: short => clubPurse(short).wage,
  beat: soccerBeat, january: true, movedLine: soccerMovedLine,
  totals: soccerTotals, legacy: soccerLegacy, resume: soccerResume, icon: soccerIcon,
  born: name => SOCCER_BORN.get(name), castIndex: SOCCER_BY_NAME, castMates: short => SOCCER_STRIKERS.filter(p => p.team === short && !isNine(p)).slice(0, 4),
  // (a striker is compared with strikers: before 2026-11-24 the pool was every attacker and midfielder)
  compPool: SOCCER_STRIKERS.filter(isNine),
  // (for the screens: money, the country, the window)
  wageText, feeText, soccerCur, nationName, nationFlag, SOCCER_NATIONS, rememberNation, lastNation, signAcademy, stayPut,
  // (2026-11-24, for the screens)
  // money: what he's worth (€M), what his club can pay; the clause in his deal and in the deal on the table
  value: soccerValue, purse: clubPurse, releaseFee, talksRelease, releaseText: c => { const f = releaseFee(c); return f == null ? null : `${feeText(f, c.team)} release clause` },
  // the table: as it stands (table(c, D)), a booked season's (tableOf(s)); a row's zone: 'ucl' | 'uel' | 'uecl' | 'down' | 'playoff' | 'up' | null
  table: soccerTable, tableOf,
  // his country: the call-up and the pecking order (callUp(c)), the summer's tournaments (summer(c)), every nation's name
  callUp: soccerCallUp, summer: soccerSummer, nationOf: short => intlNation(short),
  // the second tier's name for a club's league ('the Championship')
  tier2Name: short => TIER2_NAME[CLUB_BY.get(short)?.league] ?? 'the second tier', isDown: c => c?.down?.team === c?.team,
}
registerStats('st', SOCCER_DEFS)
registerSport('soccer', SOCCER, { resumes: { st: SOCCER_RESUMES }, events: EVENTS_SOCCER, interviews: INTERVIEWS_SOCCER, comps: { st: WC_STRIKERS.filter(isNine) }, namers: { st: soccerName } })
