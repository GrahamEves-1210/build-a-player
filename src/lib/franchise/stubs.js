// FRANCHISE: placeholders. Every function here is marked STUB in API.md: it returns the documented shape with
// empty or neutral values so screens can be wired before the logic lands. Each one is deleted from this file
// when the real one is exported from index.js.
import { touch } from './core'
import { teamRef, playerRow } from './rows'
import { recordOf, weekGames } from './select'
import { weekLabel, STAGES } from './consts'

const same = F => touch(F, { ok: false, code: 'stub', msg: 'Not built yet.' })
const me = F => teamRef(F.team)

export const stubTasks = () => [
  { id: 'gameplan', kind: 'gameplan', title: 'GAMEPLAN', detail: 'Set the plan for this opponent', done: false },
  { id: 'practice', kind: 'practice', title: 'PRACTICE', detail: 'Half pads, no focus players', done: false },
]
export const stubOwner = () => ({ goals: [{ id: 'g1', text: 'Make the playoffs', done: null, progress: '0-0', weight: 2 }], security: 62, word: 'STEADY', verdict: null, floor: 20 })
export function stubHub(F) {
  const games = weekGames(F), mine = games.find(g => g.user)
  const opp = mine ? (mine.home.short === F.team ? mine.away : mine.home) : null
  return {
    phase: F.phase, year: F.year, week: F.week, weekLabel: F.phase === 'offseason' ? 'OFFSEASON' : weekLabel(F.week),
    team: me(F), gm: { name: F.gm.name, security: F.gm.security, securityWord: 'STEADY', record: `${F.gm.w}-${F.gm.l}`, rings: F.gm.rings },
    record: recordOf(F, F.team), standing: '', seed: null,
    next: opp ? { week: F.week, label: weekLabel(F.week), opp, home: mine.home.short === F.team, oppRecord: recordOf(F, opp.short).text, bye: false, kind: 'regular', eliminated: false } : null,
    bye: !mine, tasks: stubTasks(F), primary: { action: 'play', label: `PLAY ${weekLabel(F.week)}` }, lastGame: null, headlines: [],
    cap: { space: 0, payroll: 0, cap: F.cap }, owner: stubOwner(F), stage: null,
  }
}
const units = () => { const u = { rank: 16, val: 0 }; return { passOff: u, rushOff: u, passDef: u, rushDef: u, ptsFor: u, ptsAgainst: u } }
export function stubPregame(F) {
  const h = stubHub(F)
  if (!h.next) return null
  const home = h.next.home ? h.team : h.next.opp, away = h.next.home ? h.next.opp : h.team
  return { week: F.week, label: h.weekLabel, kind: 'regular', home, away, userHome: h.next.home, records: { home: recordOf(F, home.short).text, away: recordOf(F, away.short).text }, venue: `${home.city}`, weather: { tag: 'clear', word: 'a clear day' },
    units: { home: units(), away: units() }, injuries: { home: [], away: [] }, gameplan: { off: { id: 'balanced', label: 'BALANCED' }, def: { id: 'balanced', label: 'BALANCED' } }, moments: !!F.settings.moments, calls: !!F.settings.calls, keys: [], line: 'EVEN', superBowl: false }
}
export const stubScouting = F => { const h = stubHub(F); return h.next ? { opp: h.next.opp, record: h.next.oppRecord, units: units(), strengths: [], weaknesses: [], stars: [], staff: { hc: null, oc: null, dc: null } } : null }
export const stubLastWeek = F => F.last ?? null
export const stubCard = (F, pid) => {
  const p = F.players[pid]
  if (!p) return null
  return { ...playerRow(F, p), ht: p.ht, wt: p.wt, bodyText: p.ht ? `${Math.floor(p.ht / 12)}'${p.ht % 12}" · ${p.wt}` : '', college: p.college ?? null, draft: null, traits: [], devText: '', contract: { salary: p.con?.sal ?? 0, yrs: p.con?.yrs ?? 0, guar: p.con?.guar ?? 0, rookie: !!p.con?.rookie, option: null, tag: false, capHit: p.con?.sal ?? 0, cut: { dead: 0, saves: 0 }, ask: null },
    moodFactors: [], stats: { season: {}, career: {}, byYear: [] }, awards: [], value: 0, canUpgrade: false, mine: p.team === F.team, onBlock: false }
}
export const stubList = () => []
export const stubNull = () => null
export const stubStandings = () => ({ divisions: [], conferences: { AFC: [], NFC: [] } })
export const stubPicture = () => ({ AFC: { seeds: [], hunt: [] }, NFC: { seeds: [], hunt: [] }, bracket: null })
export const stubLeaders = () => ({ passYds: [], passTD: [], rating: [], rushYds: [], rushTD: [], rec: [], recYds: [], recTD: [], scrimmage: [], sacks: [], tackles: [], ints: [], tfl: [], ff: [], fgm: [], points: [] })
export const stubRaces = () => ({ MVP: [], OPOY: [], DPOY: [], OROY: [], DROY: [], COY: [], PROTECTOR: [] })
export const stubHistory = F => ({ seasons: [], records: { season: [], game: [], team: [] }, gm: { name: F.gm.name, seasons: 0, record: '0-0', playoffs: '0-0', rings: 0, titles: [], security: F.gm.security, legacy: 0, legacyWord: 'Newcomer', résumé: [] }, hall: [] })
export const stubBlock = () => ({ mine: [], league: [], offers: [], open: true, deadlineWeek: 9 })
export const stubAssets = () => ({ players: [], picks: [] })
export const stubVerdict = () => ({ ok: false, give: 0, get: 0, gap: 0, answer: '', capOk: true, rosterOk: true, counter: null })
export const stubOffseason = F => ({ year: F.year, stage: { id: 'review', name: 'Season Review', n: 1, of: STAGES.length }, stages: STAGES.map((s, i) => ({ ...s, done: false, current: i === 0 })), view: null })
export const stubReview = F => ({ year: F.year, champion: null, user: { record: '0-0', finish: '', seed: null }, awards: {}, allPro: [], proBowl: { AFC: [], NFC: [] }, mine: { allPro: [], proBowl: [] }, retirements: [], hall: [], owner: { verdict: '', goals: [], security: F.gm.security, delta: 0, fired: false }, gm: { pts: 0 } })
export const stubMarket = () => ({ coaches: [], openings: [], poached: [] })
export const stubTree = () => ({ pts: 0, branches: [] })
export const stubFA = () => ({ round: 1, roundName: 'Day 1', players: [], capSpace: 0, signed: [] })
export const stubBoard = F => ({ year: F.year + 1, pts: 0, prospects: [], needs: [] })
export const stubDraft = F => ({ round: 1, pick: 1, overall: 1, onClock: me(F), mine: false, myPicks: [], order: [], ticker: [], offers: [], board: stubBoard(F), done: false })
export const stubCamp = () => ({ drills: [], holdouts: [], camp: { count: 0, limit: 62 } })
export const stubCuts = () => ({ count: 0, limit: 46, over: 0, roster: [], suggested: [], problems: [] })
export const stubNewSeason = F => ({ year: F.year, goals: [], changes: [], schedule: [], rookies: [] })
export const stubAction = same
