// CAREER, SOCCER: the striker's career, its own module. lib/career.js runs every sport on one engine; soccer's
// rules, its data and its engine live here, so a football or basketball career never downloads them. career.js
// loads this with ensureSport('soccer') and this file registers SPORT.soccer (registerSport) when it runs.
// The academy (trials, the scouts and coaches, the first contract), the club season (the league through the season
// director, then the big nights), the transfer window, international duty and the World Cup, the awards and legacy.
import {
  SPORT, registerSport, depthChart, teamFit, makeRoster, seasonScore, bookSeason, closeChance, blowoutOdds, momentOdds,
  countedHonors, earnLegacy, HOF_LEGACY, CAREER_X,
} from './career'
import { seeded } from './rng'
import { momentSituation, finalScore } from './situations'
import { RECORDS } from './seasonFacts'
import { seasonRaw } from './careerStats'
import { HEADSHOT_BASE } from '../utils/simulation'
import { runSoccerSimulation, calcSoccerOVR, soccerTeam10, soccerLeagueInfo } from '../utils/soccerSimulation'
import { SOCCER_CLUBS } from '../data/soccer-clubs'
import { WC_NATIONS } from '../data/soccer-nations'
import { SOCCER_STRIKERS, WC_STRIKERS, ST_TYPES } from '../data/soccer-strikers'
import { SOCCER_ATTR } from '../data/soccer-attrs'
import SOCCER_HEADSHOTS from '../data/soccer-headshots.json'
import { SOCCER_RESUMES } from '../data/legacy-resumes-soccer'
import './soccerFacts'       // the records and milestones (lib/seasonFacts.js RECORDS.soccer)
import './soccerSeason'      // the season's story cards and the in-match moments (scenarios.js, gameMoments.js)
import { soccerFinal } from './soccerDirector'
import { registerStats } from './careerStats'
import { SOCCER_DEFS } from './soccerStats'

const { rosterOf, keepRoster, rosterYrs, outOf, marketValue, LAST_PLAY, strength, goalMet, buildOf, avgOvr, byOvr, clamp, r10, FIRST_SEASON } = CAREER_X

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
    return { short: t.short, name: t.name, league: t.league, career: true, off: clamp(fit.off + (m.off ?? 0), 1, 10), def: clamp(fit.def + (m.def ?? 0), 1, 10), usage, bench: role === 'Bench', rotation: role === 'Rotation', age: c.age, ...(c.europeFor && c.europeFor === t.short ? { europe: c.europe ?? null } : {}) }   // (last season's place in Europe, when it was this club's)
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
  physical: { st: ['pace', 'strength'] },
  // composure and link-up only get better with the years (the movement goes with the legs)
  ageless: ['composure', 'linkUp'],
  finalsAward: 'MAN OF THE MATCH IN THE FINAL',
  ageShift: () => 0,
  trainUntil: () => 26, declineAt: () => 30,
  // (two seasons more than basketball's draftees, so about the same development in all)
  devYoung: () => 18, devPrime: () => 24,
  durTrait: 'strength',
  bigInjury: 8,
  draft: { rounds: 1, stock: () => [1, 1], rookie: () => ({ kind: 'rookie', years: 3, left: 3, perYear: 0.5 }), posList: ['ST'] },
  combine: { st: [['sprint30', '30m sprint', 'pace'], ['slalom', 'Dribble slalom', 'dribbling'], ['finishing', 'Finishing drill', 'finishing'], ['first-touch', 'First touch', 'firstTouch']] },
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
  seasonScore: (pos, s) => { const st = s.stats; const size = s.size ?? 20; return clamp((st.goals ?? 0) / 38 * 0.45 + (st.assists ?? 0) / 14 * 0.15 + clamp(((st.avgRating ?? 6.8) - 6.5) / 1.2, 0, 1) * 0.1 + (size - (s.pos ?? size)) / Math.max(1, size - 1) * 0.3, 0, 1.1) },
  legacyProd: (pos, st) => (st.goals ?? 0) / 15 + (st.assists ?? 0) / 50,
  made: f => soccerMade(f),
  rounds: [], final: 'Final', series: false,
  lineKeys: ['goals', 'assists', 'shots', 'xg'],
  step: 4, gameWord: 'MATCH', snaps: 'minutes', injScale: 17 / 38, oldInjuries: true, moneyWord: 'goals',
  // [what, matches out (low, high), how often]. Only the season-enders list ends a season
  injuries: [['hamstring strain', 2, 5, 6], ['ankle sprain', 1, 4, 5], ['groin strain', 2, 4, 3], ['calf strain', 2, 5, 3], ['knock to the knee', 1, 3, 4], ['thigh strain', 2, 4, 3], ['concussion', 1, 2, 1], ['knee ligament sprain', 4, 8, 1], ['broken metatarsal', 6, 10, 0.6], ['torn hamstring', 6, 10, 0.8]],
  seasonEnders: ['torn ACL', 'ruptured Achilles', 'broken leg'],
  // wages, in millions a year (a top No. 9 about €25-30M a year in 2026; an academy graduate's first deal under €1M)
  money: { st: [0.4, 30] },
  moneyOf: () => [0.4, 30],
  primeNote: () => 'Pace and strength can be trained until 27 (the last year at double the cost) and start to fade at 30; shot power, heading, dribbling and first touch until 32; finishing, the runs, link-up play and composure for good. Composure and link-up play never fade. Big injuries and a fragile body can cost him a grade.',
}

// soccer: the academy's scouts and coaches, and the first-team staff watching
const INTERVIEWS_SOCCER = [
  { who: 'Chief scout', q: 'There\'s a senior striker ahead in the queue here. A year in the under-21s: happy with that?', a: [
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
    { t: 'Yes. I\'ve practised them every day since the last one.', stock: 2, persona: 'grinder' },
    { t: 'Of course. I don\'t miss twice.', stock: 1, persona: 'confident' },
    { t: 'Only if nobody else wants it.', stock: -1, persona: 'cocky' } ] },
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
// the clubs, best first (Opta's club rating): where a prospect's offers and a transfer's bids come from
const CLUB_RANK = [...SOCCER_CLUBS].sort((a, b) => (b.ovr ?? (b.att + b.def) / 2) - (a.ovr ?? (a.att + a.def) / 2)).map(c => c.short)
// money: pounds at a Premier League club, euros everywhere else. Wages the way football says them: a week
export const soccerCur = short => (CLUB_BY.get(short)?.league === 'eng.1' ? '£' : '€')
export const wageText = (perYear, short) => {
  const k = (perYear ?? 0) * 1000 / 52
  const n = k >= 1000 ? `${(k / 1000).toFixed(2).replace(/0$/, '')}M` : `${k >= 100 ? Math.round(k / 5) * 5 : Math.max(1, Math.round(k))}k`
  return `${soccerCur(short)}${n} a week`
}
export const feeText = (fee, short) => `${soccerCur(short)}${fee >= 10 ? Math.round(fee) : r10(fee)}M`
// what a club pays for him (Transfermarkt's rough shape: the level, the age, the years left on the deal), € millions
export const soccerFee = c => {
  const age = c.age ?? 25, m = age <= 21 ? 1.35 : age <= 24 ? 1.2 : age <= 27 ? 1 : age <= 29 ? 0.75 : age <= 31 ? 0.45 : 0.2
  return Math.max(0.5, Math.round(Math.max(0, (c.ovr ?? 70) - 66) ** 2 * 0.13 * m * ((c.contract?.left ?? 2) <= 1 ? 0.6 : 1)))
}
const FB_FIRST = ['Lucas', 'Mateo', 'Luca', 'Noah', 'Rafael', 'João', 'Kai', 'Leon', 'Théo', 'Marco', 'Diego', 'Youssef', 'Ibrahim', 'Bruno', 'Emil', 'Nico', 'Hugo', 'Adam', 'Tomás', 'Rayan', 'Jonas', 'Samuel', 'Elias', 'Enzo']
const FB_LAST = ['Moreau', 'Brandt', 'Ferreira', 'Okoro', 'Lindqvist', 'Varga', 'Mensah', 'Herrera', 'Dubois', 'Jansen', 'Romano', 'Novak', 'Haddad', 'Petersen', 'Costa', 'Lopes', 'Keller', 'Diallo', 'Sorensen', 'Navas', 'Marchetti', 'Achterberg', 'Ibarra', 'Kourouma']
const soccerName = r => `${FB_FIRST[Math.floor(r() * FB_FIRST.length)]} ${FB_LAST[Math.floor(r() * FB_LAST.length)]}`
// his country: the one picked on the New Career screen (the last one picked, else England)
const NATION_KEY = 'bap_soccer_nation'
export const lastNation = () => { try { const n = localStorage.getItem(NATION_KEY); return NATION_BY.has(n) ? n : null } catch { return null } }
export const rememberNation = n => { try { if (NATION_BY.has(n)) localStorage.setItem(NATION_KEY, n) } catch {} }
const soccerNationOf = n => (NATION_BY.has(n) ? n : lastNation() ?? 'ENG')
export const SOCCER_NATIONS = [...WC_NATIONS].sort((a, b) => a.name.localeCompare(b.name)).map(n => ({ short: n.short, name: n.name }))
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
const academyTier = c => { const x = academyScore(c); return ACADEMY.find(([min]) => x >= min) }
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
    contract: { kind: 'rookie', years: o.years, left: o.years, perYear: o.perYear },
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
  const span = comp === 'ucl' ? { 'Knockout play-off': [8, 30], 'Round of 16': [3, 20], 'Quarter-final': [0, 12], 'Semi-final': [0, 8], Final: [0, 6] } : { 'Knockout play-off': [24, 62], 'Round of 16': [16, 50], 'Quarter-final': [12, 42], 'Semi-final': [8, 32], Final: [6, 26] }
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
const pickOf = (r, a) => a[Math.floor(r() * a.length)]
// a tie nobody needed a moment for: the better side usually went through, by two goals or more
function autoLegs(r, two, won) {
  let legs
  if (two) { const l1 = pickOf(r, [[1, 0], [2, 0], [2, 1], [1, 1], [3, 1], [0, 0]]), extra = Math.max(0, 2 - (l1[0] - l1[1])), l2 = pickOf(r, [[0, 0], [1, 0], [1, 1], [2, 1]]); legs = [l1, [l2[0] + extra, l2[1]]] }
  else legs = [pickOf(r, [[2, 0], [3, 1], [3, 0], [2, 0], [4, 1]])]
  return won ? legs : legs.map(([a, b]) => [b, a])
}
// The round's moment is in. The deciding match is the one played (a final, or the second leg with the first one level)
export function soccerRound(c, score, game = null, hit = score >= 0.5, pts = null) {
  const a = c.active, po = a.po, f = a.final
  const rd = po.rounds[po.idx]
  const r = seeded(`${c.seed}-por-${c.year}-${po.idx}`)
  const auto = rd.close === false
  const depth = KO_DEPTH[rd.stage] ?? 3
  let won = r() < (auto ? blowoutOdds(rd.p, depth) : momentOdds(rd.p, hit, score, depth))
  const LAST = LAST_PLAY[game]
  if (!auto && LAST) { if (hit) won = true; else if (LAST === 'both') won = false }
  if (auto) score = won ? 0.8 : 0.25
  let legs, note = null
  if (auto) legs = autoLegs(r, rd.legs === 2, won)
  else {
    const seed = `${c.seed}-${c.year}-${po.idx}`
    const end = finalScore(momentSituation(game, seed, { us: c.team, them: rd.opp }), game, won, hit, seed, pts)
    note = end.note
    legs = rd.legs === 2 ? [pickOf(r, [[1, 1], [0, 0], [2, 2], [1, 1]]), [end.mine, end.opp]] : [[end.mine, end.opp]]
  }
  const mySc = legs.reduce((s, l) => s + l[0], 0), oppSc = legs.reduce((s, l) => s + l[1], 0)
  const pens = mySc === oppSc ? (won ? 'won' : 'lost') : null
  // his line: the moment's goal when he scored it, and his usual share of the rest
  const lg = soccerStats(f)
  const rate = lg.apps ? lg.goals / lg.apps : 0.3, arate = lg.apps ? lg.assists / lg.apps : 0.1
  let goals = 0, assists = 0
  legs.forEach((l, i) => {
    const moment = !auto && i === legs.length - 1
    let g = Math.min(l[0], Math.floor(rate * (0.8 + score * 0.4) + r()))
    if (moment) g = Math.min(l[0], Math.max(hit ? 1 : 0, hit ? g : Math.min(g, Math.max(0, l[0] - 1))))
    goals += g
    assists += Math.min(l[0] - g, Math.floor(arate + r() * 0.8))
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
    const legs = autoLegs(r, rd.legs === 2, won)
    const entry = { ...rd, played: true, won, legs, mySc: legs.reduce((s, l) => s + l[0], 0), oppSc: legs.reduce((s, l) => s + l[1], 0), sat: true, goals: 0, assists: 0, apps: 0 }
    rounds[i] = entry; line.push(entry)
    if (won && rd.final) trophies.push(rd.compName)
    if (!won) rounds = rounds.map((x, k) => (k > i && x.track === rd.track ? { ...x, skip: true } : x))
  }
  return { ...po, rounds, line, idx: Math.max(0, rounds.length - 1), stage: 'done', won: trophies.length > 0, out: !trophies.length, trophies }
}

// ── International duty: the call-up, the caps, a World Cup every four years ──
// the World Cup is the summer a season ends in: 2030, 2034 (the 2029-30 season, the 2033-34...)
export const wcSummer = c => (c.season + 1) % 4 === 2
// Called up: his level against his country's forwards, years on (the real ones fade past 31)
export function soccerCallUp(c) {
  const nat = NATION_BY.get(c.nation)
  if (!nat) return { called: false, role: null }
  const yrs = Math.max(0, (c.season ?? FIRST_SEASON) - FIRST_SEASON)
  const rivals = WC_STRIKERS.filter(p => p.team === nat.short && isNine(p)).map(p => { const age = (p.age ?? 27) + yrs; return age >= 36 ? 0 : SPORT.soccer.realOvr('st', p) - Math.max(0, age - 31) * 2.5 }).sort((a, b) => b - a)
  // (years on, his country has new forwards too: never a weaker bar than its level says)
  const floor = 66 + (nat.ovr - 67) * 0.7
  const best = Math.max(rivals[0] ?? 0, floor + 4)
  const called = (c.age >= 19 || c.ovr >= 88) && (c.ovr >= best - 8 || c.ovr >= 90)
  const role = !called ? null : c.ovr >= best - 1 ? 'Starter' : c.ovr >= best - 5 ? 'Rotation' : 'Bench'
  return { called, role }
}
// The World Cup: his nation's tournament, played through the engine's World Cup
function soccerWorldCup(c) {
  const call = soccerCallUp(c)
  const year = c.season + 1
  if (!call.called) return { year, nation: c.nation, called: false }
  const r = runSoccerSimulation(c.build, ST_TYPES, { short: c.nation, usage: call.role === 'Starter' ? 1 : 0.8, bench: call.role === 'Bench', age: c.age }, 'alltime', `${c.seed}-wc-${c.year}`)
  return {
    year, nation: c.nation, called: true, role: call.role, finish: r.finish, champion: !!r.champion, goals: r.goals ?? 0, assists: r.assists ?? 0, apps: r.apps ?? 0,
    games: (r.games ?? []).map(g => ({ stage: g.stage, round: g.round, opp: g.opponent, oppName: g.oppName, mySc: g.mySc, oppSc: g.oppSc, goals: g.goals, app: g.app, won: g.won, drawn: g.drawn, pens: g.shootout ? [g.shootout.my, g.shootout.opp] : null })),
    boot: { won: !!r.goldenBoot?.won, rank: r.goldenBoot?.rank ?? null, winner: r.goldenBoot?.winner?.isPlayer ? null : r.goldenBoot?.winner?.name ?? null, goals: r.goldenBoot?.winner?.goals ?? null },
    ball: r.goldenBall?.medal ?? null, young: !!r.bestYoungPlayer?.won,
  }
}
// a season's caps and international goals: the windows (about nine matches a year for a regular), and the World Cup
function intlSeason(c, lg, wc) {
  const call = soccerCallUp(c)
  if (!call.called) return { caps: 0, intlGoals: 0, role: null }
  const r = seeded(`${c.seed}-intl-${c.year}`)
  const caps = (call.role === 'Starter' ? 8 : call.role === 'Rotation' ? 6 : 3) + Math.floor(r() * 3) - 1
  const rate = clamp((lg.apps ? lg.goals / lg.apps : 0.25) * 0.85 * (call.role === 'Starter' ? 1 : 0.5), 0, 1.1)
  let goals = 0
  for (let i = 0; i < caps; i++) goals += Math.floor(rate + r())
  return { caps: caps + (wc?.apps ?? 0), intlGoals: Math.max(0, goals) + (wc?.goals ?? 0), role: call.role }
}

// ── Booking a soccer season ──
// Ballon d'Or: the engine's field (the season's best players, their goals and trophies), against his whole year:
// goals and half the assists in every competition and for his country, the trophies he won (a big part of them
// the more he scored) and the World Cup in a World Cup year. (bdoCase in utils/soccerSimulation.js, the same weights)
const BDO_EURO = { ucl: { Winners: 14, 'Runners-up': 6, 'Semi-finals': 3, 'Quarter-finals': 1 }, uel: { Winners: 5, 'Runners-up': 2, 'Semi-finals': 1 } }
const BDO_WC = { Winners: 12, 'Runners-up': 5, 'Third place': 2, 'Fourth place': 2, 'Quarter-finals': 1 }
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
  const avail = g => { const wk = Math.max(1, Math.round((g.wk ?? 0) * 38 / 39)); return wk < out && !sat.has(wk) }
  const cupLegs = (f.cup?.rounds ?? []).filter(t => !(cupPo && t.final)).flatMap(t => t.legs ?? []).filter(avail)
  const euroLegs = (f.europe?.games ?? []).filter(avail)
  const sum = (list, k) => list.reduce((s, g) => s + (g[k] ?? 0), 0)
  const poCup = played.filter(x => x.track === 'cup'), poEuro = played.filter(x => x.track === 'europe')
  const cupGoals = sum(cupLegs, 'goals') + sum(poCup, 'goals'), euroGoals = sum(euroLegs, 'goals') + sum(poEuro, 'goals')
  const apps = lg.apps + sum(cupLegs, 'app') + sum(euroLegs, 'app') + sum(played, 'apps')
  const goals = lg.goals + cupGoals + euroGoals
  const assists = lg.assists + sum(cupLegs, 'assists') + sum(euroLegs, 'assists') + sum(played, 'assists')
  const stats = { ...lg, apps, goals, assists, cupGoals, euroGoals, lgAssists: lg.assists, lgApps: lg.apps }
  // the trophies: the league from the table, the cup final and the European final from the big nights
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
  const champion = !!f.champion
  const trophies = [...(champion ? [f.league?.name ?? 'League'] : []), ...(cupWon ? [f.cup?.name ?? 'Cup'] : []), ...(euroWon ? [f.europe.name] : [])]
  // next season in Europe: the league place, the cup (the Europa League), a European title (the Champions League)
  const info = soccerLeagueInfo(f.league?.id) ?? { ucl: 4, uel: 2 }
  let qualified = pos <= info.ucl ? 'ucl' : pos <= info.ucl + info.uel ? 'uel' : null
  if (cupWon && !qualified) qualified = 'uel'
  if (euroWon) qualified = 'ucl'
  // international duty, and the World Cup in a World Cup summer
  const wc = wcSummer(c) ? soccerWorldCup(c) : null
  const intl = intlSeason(c, lg, wc?.called ? wc : null)
  // the league's awards (the engine's, on his real league totals: lib/seasonDirector.js soccerFinal)
  // the Golden Boot and the Golden Shoe: the engine's field, and the year's best rival in his league (a top scorer
  // most years near the league's usual winning total, now and then a 30-plus season), so a great striker wins it
  // in his best years, not every year (Messi's 8 Pichichis are the most in a top league)
  const rr = seeded(`${c.seed}-boot-${c.year}`), lu = () => { const u = clamp(rr(), 0.001, 0.999); return Math.log(u / (1 - u)) }
  const bootRival = (BOOT_TOP[f.league?.id] ?? 26) + 3.2 * lu(), shoeRival = 31 + 3 * lu()
  const boot = !!f.goldenBoot?.won && lg.goals >= bootRival, poty = !!f.playerOfSeason?.won, tots = !!f.teamOfSeason || poty, shoe = !!f.goldenShoe?.won && boot && lg.goals >= shoeRival
  // the Ballon d'Or
  const tp = (champion ? 8 : 0) + (comp ? BDO_EURO[comp]?.[euroResult] ?? 0 : 0) + (cupWon ? 3 : 0) + (wc?.called ? (BDO_WC[wc.finish] ?? 0) + (wc.ball === 'Golden Ball' ? 3 : 0) : 0)
  const mine = r10(bdoCase(goals + (wc?.goals ?? 0), assists + (wc?.assists ?? 0), tp) + (boot ? 2 : 0))
  // (and the year's best rival: most years a ~66 case, a 50-goal treble now and then, so it isn't his every year
  // he scores 40; the best man in the engine's field has that season)
  const field = (f.book?.bdo ?? f.ballonDor?.top ?? []).filter(x => !x.isPlayer).map(x => ({ ...x })).sort((a, b) => b.score - a.score)
  const ru = clamp(seeded(`${c.seed}-bdo-${c.year}`)(), 0.001, 0.999), rival = 66 + 7 * Math.log(ru / (1 - ru))
  if (field[0] && field[0].score < rival) field[0].score = r10(rival)
  const rank = 1 + field.filter(x => x.score > mine).length
  const winner = rank === 1 ? null : field[0] ?? null
  const bdo = { rank, finish: rank === 1 ? 'winner' : rank <= 3 ? 'top3' : rank <= 10 ? 'top10' : rank <= 30 ? 'nominated' : null, score: mine, winner: winner ? { name: winner.name, team: winner.team } : null }
  const award = rank === 1
  const s = {
    year: c.year + 1, season: c.season, age: c.age, team: c.team, teamName: c.fit.name, ovr: c.ovr, role: c.role,
    league: f.league?.name ?? null, leagueId: f.league?.id ?? null, pos, size,
    wins: f.wins, draws: f.draws ?? 0, losses: f.losses, points: f.points ?? (f.wins * 3 + (f.draws ?? 0)),
    // (soccer's "playoffs" for the legacy: a Champions League season)
    playoffs: comp === 'ucl', champion, trophies, cupName: f.cup?.name ?? null, cupResult, cupWon,
    europe: comp ? { comp, name: f.europe.name, result: euroResult } : null, uclWon: euroWon && comp === 'ucl', uelWon: euroWon && comp === 'uel',
    rounds: line.map(x => ({ round: x.name, opponent: x.oppName, won: x.won, mySc: x.mySc, oppSc: x.oppSc, legs: x.legs, pens: x.pens, track: x.track, sat: !!x.sat })),
    sb: null, stats, adv: seasonRaw('st', f, (f.games ?? []).filter(g => !g.sat && g.app)),
    award, awardName: S.awardName.st, bdo,
    proBowl: tots, allPro: boot, poty, shoe, potyName: f.playerOfSeason?.name ?? null, bootName: f.goldenBoot?.name ?? 'Golden Boot',
    relegated: !!f.relegated, qualified,
    wc, caps: intl.caps, intlGoals: intl.intlGoals, intlRole: intl.role, nation: c.nation,
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
// after the season: next year's Europe, the caps, a loan that's over
function soccerAfterSeason(n, s) {
  let next = { ...n, europe: s.qualified === 'uecl' ? null : s.qualified, europeFor: s.team, caps: (n.caps ?? 0) + (s.caps ?? 0), intlGoals: (n.intlGoals ?? 0) + (s.intlGoals ?? 0) }
  next = { ...next, relegated: !!s.relegated }
  if (s.relegated && !next.loan) next = { ...next, contract: { ...next.contract, left: 0 }, events: [...next.events, { year: s.year, text: `${s.teamName} go down. The relegation clause in ${next.name}'s contract makes him a free agent.` }] }
  if (next.loan && s.year >= next.loan.until) {
    const from = next.loan.from, back = soccerClub(from)
    const pc = next.loan.contract
    next = { ...next, team: from, roster: rosterOf({ ...next, team: from }, from), europe: null, europeFor: null, lastRole: null, loan: null, contract: { ...pc, left: Math.max(0, (pc.left ?? 1) - 1) }, events: [...next.events, { year: s.year, text: `Back at ${back.name} after a season on loan at ${s.teamName}.` }] }
  }
  return next
}
// the summer's biggest movers around Europe
function soccerNews(league, was, now) {
  return SOCCER_CLUBS.map(t => ({ t, d: now(t.short) - was(t.short) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3)
    .map(({ t, d }) => `${t.name} ${d > 0 ? (d > 2 ? 'spend big all summer: the winners of the window' : 'strengthen in the window') : (d < -2 ? 'sell their best players. A long season ahead' : 'take a step back')}.`)
}

// ── The transfer window (mid-contract): bids from other clubs, a new deal, a loan for a young sub ──
function soccerWindow(c) {
  const r = seeded(`${c.seed}-tw-${c.year}`)
  const last = c.seasons[c.seasons.length - 1]
  const perf = last ? seasonScore('st', last) : 0.3
  const value = marketValue(c)
  const fitAt = short => teamFit(short, c.pos, { roster: short === c.team ? c.roster : null, league: c.league, name: c.name, sport: 'soccer', yrs: rosterYrs(c), gone: outOf(c, short) })
  const myStr = strength(soccerClub(c.team))
  const money = v => r10(clamp(v, 0.4, 30))
  const offers = []
  const fee = soccerFee(c)
  // a young player who barely played: a loan where he'd start, and back after a season
  if (c.lastRole === 'Backup' && c.age <= 23 && !c.loan && r() < 0.8) {
    const list = CLUB_RANK.filter(t => t !== c.team && strength(soccerClub(t)) < myStr - 0.5).map(t => ({ t, k: r() })).sort((a, b) => a.k - b.k).slice(0, 8).map(x => x.t).find(t => standAt(c, t).starter)
    if (list) offers.push({ kind: 'loan', team: list, fit: fitAt(list), stand: standAt(c, list), years: 1, perYear: c.contract.perYear, pitch: 'A season on loan: a starter every week, then back.' })
  }
  // bids: a big season brings the bigger clubs, a quiet one a club that would play him
  const want = perf >= 0.62 ? 3 : perf >= 0.48 ? 2 : perf >= 0.34 || c.lastRole === 'Backup' ? 1 : 0
  const n = [...Array(want)].filter(() => r() < 0.65).length
  if (n) {
    const up = CLUB_RANK.filter(t => t !== c.team && (perf >= 0.48 ? strength(soccerClub(t)) >= myStr - 0.2 : true))
    const picks = up.map(t => ({ t, k: r() * (perf >= 0.48 ? 1 : 0.6 + (CLUB_RANK.indexOf(t) / CLUB_RANK.length)) })).sort((a, b) => b.k - a.k).map(x => x.t).filter(t => perf >= 0.48 || standAt(c, t).role !== 'Bench').slice(0, n)
    for (const t of picks) {
      const yrs = c.age <= 26 ? 5 : c.age <= 29 ? 4 : c.age <= 31 ? 3 : 2
      const stand = standAt(c, t), bigger = strength(soccerClub(t)) > myStr + 0.4
      const pitch = stand.starter ? (bigger ? 'A bigger club, and the No. 9 shirt is his.' : 'They want him to lead the line. Starts every week.') : bigger ? 'A bigger stage and the trophies that come with it, but a fight for the shirt.' : 'More money, and a fight for a place in the team.'
      offers.push({ kind: 'bid', team: t, fit: fitAt(t), stand, years: yrs, perYear: money(value * (1.08 + r() * 0.25)), fee: Math.round(fee * (0.9 + r() * 0.35)), pitch })
    }
  }
  // his own club: a new deal with two years left or less, after a good season
  if (c.contract.left <= 2 && perf >= 0.35 && !c.loan) offers.unshift({ kind: 'renew', team: c.team, fit: fitAt(c.team), stand: standAt(c, c.team), years: clamp(c.contract.left + 2 + (c.age <= 27 ? 1 : 0), 2, 5), perYear: money(Math.max(c.contract.perYear, value * (0.95 + r() * 0.1))), pitch: 'A new deal. They want him for the long run.' })
  return offers.length ? offers : null
}
// turn them all down: he stays on the deal he has
export function stayPut(c) {
  const bids = (c.offers ?? []).filter(o => o.team !== c.team)
  const text = bids.length ? `Turned down ${bids.map(o => (o.kind === 'loan' ? `a loan to ${o.fit.name}` : o.fit.name)).join(', ')}. Staying at ${c.fit.name}.` : `Staying at ${c.fit.name}.`
  return { ...c, offers: null, talks: null, decisions: [...c.decisions, { year: c.year + 1, text }] }
}
function soccerSign(c, o) {
  const change = o.team !== c.team
  const club = soccerClub(o.team)
  if (o.kind === 'loan') {
    const roster = rosterOf(c, o.team)
    return { ...c, team: o.team, roster, kept: keepRoster(c), fit: teamFit(o.team, c.pos, { roster, league: c.league, name: c.name, sport: 'soccer' }), offers: null, talks: null, tradeAsked: false, lastRole: null, loan: { from: c.team, until: c.year + 2, contract: c.contract }, contract: { kind: 'loan', years: 1, left: 1, perYear: c.contract.perYear }, off: c.off ? { ...c.off, moves: [] } : c.off,
      decisions: [...c.decisions, { year: c.year + 1, text: `Joined ${club.name} on a season-long loan from ${soccerClub(c.team).name}` }] }
  }
  const roster = change ? rosterOf(c, o.team) : c.roster
  const extras = [o.noTrade ? 'a release clause' : null, o.starter ? 'a first-team promise' : null].filter(Boolean)
  const how = !change ? `Signed a new deal at ${club.name}` : o.kind === 'bid' ? `Joined ${club.name} for ${feeText(o.fee ?? soccerFee(c), c.team)}` : `Signed for ${club.name} on a free transfer`
  return {
    ...c, team: o.team, roster, ...(change ? { kept: keepRoster(c), europe: null, europeFor: null } : {}), fit: teamFit(o.team, c.pos, { roster, league: c.league, name: c.name, sport: 'soccer' }), offers: null, talks: null, tradeAsked: false, lastRole: change ? null : c.lastRole, loan: null, ...(change && c.off ? { off: { ...c.off, moves: [] } } : {}),
    contract: { kind: change ? (o.kind === 'bid' ? 'transfer' : 'fa') : 'ext', years: o.years, left: o.years, perYear: o.perYear, noTrade: !!o.noTrade, starter: !!o.starter },
    decisions: [...c.decisions, { year: c.year + 1, text: `${how}: ${o.years} yrs, ${wageText(o.perYear, o.team)}${extras.length ? ` (${extras.join(', ')})` : ''}` }],
  }
}
// A transfer request: the club can say no (a release clause in his deal means it can't); granted, he's sold
// to a club in the better half of Europe where he'd start
function soccerTransferRequest(c) {
  const r = seeded(`${c.seed}-trade-${c.year}`)
  const granted = !!c.contract.noTrade || r() < 0.7
  const rep = Math.max(1, c.rep - 2)
  const from = soccerClub(c.team)
  if (!granted) return { ...c, rep, tradeAsked: true, nextMods: { ...(c.nextMods ?? {}), off: ((c.nextMods?.off) ?? 0) - 0.5 }, events: [...c.events, { year: c.year + 1, text: `${c.name} handed in a transfer request. ${from.name} turned it down, and the dressing room heard about it.` }] }
  const pool = CLUB_RANK.filter(t => t !== c.team).slice(0, Math.ceil(CLUB_RANK.length / 2))
  const starts = pool.filter(t => standAt(c, t).starter)
  const dest = (starts.length ? starts : pool)[Math.floor(r() * (starts.length || pool.length))]
  const roster = rosterOf(c, dest)
  const fit = teamFit(dest, c.pos, { roster, league: c.league, name: c.name, sport: 'soccer' })
  const fee = soccerFee(c)
  return { ...c, rep, tradeAsked: true, team: dest, roster, kept: keepRoster(c), fit, lastRole: null, europe: null, europeFor: null, contract: { ...c.contract, starter: false, kind: 'transfer', left: Math.max(c.contract.left, 3), years: Math.max(c.contract.left, 3) }, off: { ...(c.off ?? {}), moves: [] },
    events: [...c.events, { year: c.year + 1, text: `Transfer request granted: ${from.name} sell ${c.name} to ${fit.name} for ${feeText(fee, from.short)}.` }],
    decisions: [...c.decisions, { year: c.year + 1, text: `Handed in a transfer request, sold to ${fit.name} for ${feeText(fee, from.short)}` }] }
}

// ── Legacy, in football's terms ──
// The resume: seasons, Team of the Season (soccer's Pro Bowl: past 8 they count half), Golden Boots, Player of the
// Season awards, Ballon d'Ors (and top-three finishes), the European Golden Shoe, league titles, cups, the Champions
// League, the Europa League, the World Cup, a continental title with his country, the records, and the goals and
// assists (club and country). The Ballon d'Or, the Champions League and the World Cup weigh the most, the way MVPs and
// rings do in the other sports. The greats (data/legacy-resumes.js RESUMES.st) are scored the same way.
export const SOCCER_LW = { seasons: 2, tots: 4, boots: 6, poty: 7, bdo: 25, bdoPod: 6, shoe: 4, leagues: 7, cups: 2, ucl: 15, uel: 4, wc: 30, cont: 8, records: 6 }
export const SOCCER_BDO_REPEAT = 6
function soccerLegacy(r) {
  const k = { ...r, tots: countedHonors(r.tots ?? 0) }
  return Math.round(Object.entries(SOCCER_LW).reduce((s, [key, w]) => s + (k[key] ?? 0) * w, 0) + Math.max(0, (r.bdo ?? 0) - 1) * SOCCER_BDO_REPEAT + (r.stats?.goals ?? 0) / 15 + (r.stats?.assists ?? 0) / 50 + (r.bonus ?? 0))
}
function soccerTotals(c) {
  const Ss = c.seasons, n = k => Ss.filter(s => s[k]).length
  return {
    draws: Ss.reduce((a, s) => a + (s.draws ?? 0), 0), leagueTitles: n('champion'), cups: n('cupWon'), ucl: n('uclWon'), uel: n('uelWon'), wc: Ss.filter(s => s.wc?.champion).length,
    bdo: n('award'), bdoPod: Ss.filter(s => !s.award && (s.bdo?.rank ?? 99) <= 3).length, boots: n('allPro'), tots: n('proBowl'), poty: n('poty'), shoes: n('shoe'), kopa: n('roy'),
    trophies: Ss.reduce((a, s) => a + (s.trophies?.length ?? 0) + (s.wc?.champion ? 1 : 0), 0),
    caps: Ss.reduce((a, s) => a + (s.caps ?? 0), 0), intlGoals: Ss.reduce((a, s) => a + (s.intlGoals ?? 0), 0),
    wcGoals: Ss.reduce((a, s) => a + (s.wc?.goals ?? 0), 0), worldCups: Ss.filter(s => s.wc?.called).length,
  }
}
function soccerResume(c, t) {
  return { seasons: t.seasons, tots: t.tots, boots: t.boots, poty: t.poty, bdo: t.bdo, bdoPod: t.bdoPod, shoe: t.shoes, leagues: t.leagueTitles, cups: t.cups, ucl: t.ucl, uel: t.uel, wc: t.wc, cont: 0, records: t.records, stats: { goals: (t.stats.goals ?? 0) + (t.intlGoals ?? 0), assists: t.stats.assists ?? 0 }, bonus: (c.legacyBonus ?? 0) + earnLegacy(c) }
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
  news: soccerNews, window: soccerWindow, sign: soccerSign, transferRequest: soccerTransferRequest,
  totals: soccerTotals, legacy: soccerLegacy, resume: soccerResume, icon: soccerIcon,
  born: name => SOCCER_BORN.get(name), castIndex: SOCCER_BY_NAME, castMates: short => SOCCER_STRIKERS.filter(p => p.team === short && !isNine(p)).slice(0, 4),
  compPool: SOCCER_STRIKERS,
  // (for the screens: money, the country, the window)
  wageText, feeText, soccerCur, nationName, nationFlag, SOCCER_NATIONS, rememberNation, lastNation, signAcademy, stayPut,
}
registerStats('st', SOCCER_DEFS)
registerSport('soccer', SOCCER, { resumes: { st: SOCCER_RESUMES }, events: EVENTS_SOCCER, interviews: INTERVIEWS_SOCCER, comps: { st: WC_STRIKERS }, namers: { st: soccerName } })
