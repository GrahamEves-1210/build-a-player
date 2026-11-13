import * as FR from '../../../lib/franchise'
import { GAMES } from '../../../lib/minigames'
import { romanOf } from '../../../lib/mg/kit'

// GAME DAY ⇄ ENGINE. The only file in this folder that knows the engine (lib/franchise, API.md §2 pregame/lastWeek
// and §4 the game). It turns the engine's selectors into the small view model the screens draw, and the screens'
// taps into the engine's actions. The live game is the engine's (F.game, saved with the franchise): every function
// here takes the franchise F and the actions hand back the next F.
//
//   pregame(F)             → the matchup, or null (a bye, eliminated)
//   setMoments(F, on)      → F
//   live(F)                → a game has been started and not yet booked
//   start(F, mode)         → F        mode: 'moments' | 'watch' | 'sim'
//   view(F)                → the game as it stands (see `view` below), or null
//   step(F)                → F        one play on (or to a stop)
//   resolveMoment(F, res)  → F        res: { hit, score, raw } from the mini game, or null = SIM THIS ONE
//   resolveCall(F, id)     → F
//   skip(F)                → F        straight to the final
//   finish(F)              → { F, result }   books the game and the league's week; result is the postgame's
//
// A moment's result, there and back: Live.jsx gets MgStage's { hit, score, raw } → resolveMoment → FR.resolveStop
// (F, { win, score, raw }) → the engine writes the play for that result into the log and carries the sim on from
// it → view(F).plays has the new play → the Result panel and the log show it.

const short = t => (typeof t === 'string' ? t : t?.short)
const man = p => p && ({
  id: p.id, name: p.name, pos: p.slot ?? (p.pos ? String(p.pos).toUpperCase() : null), num: p.num ?? null, team: short(p.team),
  img: p.photo ? FR.photoUrl(p.photo) : null, built: !!p.built,
})

export function pregame(F) {
  const p = FR.pregame(F)
  if (!p) return null
  const home = short(p.home), away = short(p.away), user = p.userHome ? home : away, opp = p.userHome ? away : home
  const U = p.userHome ? p.units?.home : p.units?.away, O = p.userHome ? p.units?.away : p.units?.home
  const cell = (team, u) => ({ team, rank: u?.rank ?? null, val: u?.val != null ? (Math.round(u.val * 10) / 10).toFixed(1) : null })
  const side = (off, def, A, B) => ({ when: off, rows: [
    { label: 'PASS', unit: 'YPG', off: cell(off, A?.passOff), def: cell(def, B?.passDef) },
    { label: 'RUSH', unit: 'YPG', off: cell(off, A?.rushOff), def: cell(def, B?.rushDef) },
    { label: 'POINTS', unit: 'PPG', off: cell(off, A?.ptsFor), def: cell(def, B?.ptsAgainst) },
  ].filter(r => r.off.rank != null && r.def.rank != null) })
  const hurt = (team, list) => (list ?? []).map(x => ({ team, name: x.name, pos: x.slot ?? '', status: x.status ?? 'OUT', note: x.wk ? `${x.wk} ${x.wk === 1 ? 'WEEK' : 'WEEKS'}` : null }))
  const wx = p.weather?.tag && p.weather.tag !== 'clear' && p.weather.tag !== 'dome' ? p.weather : null
  return {
    week: p.week, year: F.year ?? null, label: String(p.label ?? '').toUpperCase(), kind: p.kind, title: p.superBowl ? String(p.label ?? 'SUPER BOWL').toUpperCase() : null, neutral: !!p.superBowl,
    venue: p.venue ?? null, weather: p.weather?.word ? { kind: wx?.tag ?? null, text: String(p.weather.word).toUpperCase() } : null,
    line: p.line ?? null,
    home, away, user, records: { [home]: p.records?.home ?? '', [away]: p.records?.away ?? '' },
    units: [side(user, opp, U, O), side(opp, user, O, U)].filter(u => u.rows.length),
    injuries: [...hurt(home, p.injuries?.home), ...hurt(away, p.injuries?.away)],
    plan: p.gameplan ? { off: p.gameplan.off?.label ?? '', def: p.gameplan.def?.label ?? '' } : null,
    keys: p.keys ?? [],
    momentsOn: !!p.moments,
  }
}
export const setMoments = (F, on) => FR.setSetting(F, 'moments', !!on)
export const live = F => { const v = FR.gameView(F); return !!v && !v.booked }
export const start = (F, mode) => FR.startGame(F, { mode })
export const step = F => FR.stepGame(F)
export const skip = F => FR.skipGame(F)
export const resolveMoment = (F, res) => FR.resolveStop(F, res ? { win: !!res.hit, hit: !!res.hit, score: res.score, raw: res.raw ?? null } : 'sim')
export const resolveCall = (F, id) => FR.resolveStop(F, id)
export const flash = F => F?.flash ?? null

// the plays already turned into rows, kept by game so a row that hasn't changed is the same object (the log
// re-draws only the new one)
let kept = { id: null, rows: [] }
const BIG = new Set(['td', 'int', 'fumble', 'safety', 'downs', 'fgmiss', 'two'])
function plays(v, home, away) {
  if (kept.id !== v.id) kept = { id: v.id, rows: [] }
  const log = v.log ?? [], rows = kept.rows
  rows.length = Math.min(rows.length, log.length)
  for (let i = 0; i < log.length; i++) {
    const p = log[i], was = rows[i]
    if (was && was.text === p.text && was.pts === (p.pts ?? 0)) continue
    rows[i] = {
      id: p.i ?? i, q: p.q, clock: p.clock, team: p.team ?? null, down: p.kind === 'end' || p.kind === 'kickoff' ? 0 : p.down ?? 0, dist: p.dist, spot: p.spot,
      kind: p.kind === 'end' ? 'break' : p.kind, text: p.text, yards: p.yds ?? 0, pts: p.pts ?? 0, scorer: p.by ?? null, drive: p.drive ?? null,
      score: { [home]: p.score?.[0] ?? 0, [away]: p.score?.[1] ?? 0 },
      big: !!p.pts || !!p.moment || BIG.has(p.kind) || (p.yds ?? 0) >= 20,
      mark: p.moment ? { moment: true, played: true } : null,
    }
  }
  return rows.slice()
}
function stopOf(s) {
  if (!s || s.kind === 'final') return null
  if (s.kind === 'call') return {
    type: 'call', id: s.id, n: s.n, kind: s.type, setup: s.setup ?? s.situation?.text ?? '',
    options: (s.options ?? []).map(o => ({ id: o.id, label: o.label, odds: o.odds ?? null, note: o.note ?? null, staff: !!o.staff })),
  }
  const p = s.player ?? {}
  return {
    type: 'moment', id: s.id, n: s.n, game: s.game, title: s.title ?? GAMES[s.game]?.title, side: s.side,
    player: man(p), ratings: (p.traits ?? []).map(t => ({ key: t.key, label: String(t.label ?? t.key).toUpperCase(), val: t.val })),
    setup: s.situation?.text ?? '', stakes: s.stakes ?? '', odds: s.odds ?? null,
    // (the Super Bowl's number for the mini game's field: the engine gives the season, the stage wants LXI)
    mg: s.mg ? { cast: null, ...s.mg, superBowl: typeof s.mg.superBowl === 'number' ? romanOf(s.mg.superBowl - 1965) : s.mg.superBowl ?? null } : null,
  }
}
// the game as the screens draw it:
//   { id, home, away, user (shorts), title, weather, score: { [short]: n }, q, clock, poss, down, dist, spot,
//     to: { [short]: 0-3 } | null, ot, plays: [row], pending: moment | call | null, done, mode }
//   row: { id, q, clock, team, down, dist, spot, kind, text, yards, pts, scorer, drive, score: { [short]: n }, big, mark }
export function view(F) {
  const v = FR.gameView(F)
  if (!v) return null
  const home = short(v.home), away = short(v.away)
  return {
    id: v.id, home, away, user: v.us ?? (v.userHome ? home : away), mode: v.mode,
    title: v.superBowl ? String(v.label ?? 'SUPER BOWL').toUpperCase() : null, weather: v.weather?.tag ? { kind: v.weather.tag } : null,
    score: { [home]: v.score?.home ?? 0, [away]: v.score?.away ?? 0 },
    q: v.q, clock: v.clock, poss: v.poss ?? null, down: v.down ?? 0, dist: v.dist ?? 0, spot: v.spot ?? null,
    to: v.timeouts ? { [home]: v.timeouts.home, [away]: v.timeouts.away } : null, ot: v.q >= 5,
    plays: plays(v, home, away), pending: v.status === 'final' ? null : stopOf(v.stop), done: v.status === 'final' || v.stop?.kind === 'final',
  }
}

const TOTALS = [['yds', 'TOTAL YARDS'], ['passYds', 'PASSING'], ['rushYds', 'RUSHING'], ['firstDowns', 'FIRST DOWNS'], ['third', 'THIRD DOWN'], ['to', 'TURNOVERS'], ['sacks', 'SACKS'], ['top', 'POSSESSION']]
const boxOf = b => b && ({
  passing: (b.passing ?? []).map(r => ({ man: man(r), cells: [`${r.cmp}/${r.att}`, r.yds, r.td, r.int] })),
  rushing: (b.rushing ?? []).slice(0, 4).map(r => ({ man: man(r), cells: [r.att, r.yds, r.td] })),
  receiving: (b.receiving ?? []).filter(r => r.rec > 0).slice(0, 6).map(r => ({ man: man(r), cells: [r.rec, r.yds, r.td] })),
  defense: (b.defense ?? []).slice(0, 8).map(r => ({ man: man(r), cells: [r.tkl, r.sack, r.int, r.ff] })),
  kicking: (b.kicking ?? []).map(r => ({ man: man(r), cells: [`${r.fgm}/${r.fga}`, r.long || '-', `${r.xpm}/${r.xpa}`] })),
})
// Books the game (and the rest of the league's week) and reads the recap back as the postgame's result:
//   { home, away, user, score, ot, won, tied, title, quarters: { [short]: [n] }, box: { [short]: tables }, totals: [{ label, [short]: v }],
//     potg: { man, line }, xp: [{ man, xp, pts }], xpTeam, injuries: [{ man, what, weeks }], league: [{ away, home, a, h, ot }], headlines: [text] }
export function finish(F) {
  const g = view(F), raw = FR.gameView(F)
  const F2 = FR.finishGame(F)
  const w = FR.lastWeek(F2), u = w?.user ?? null
  const box = u?.box ?? raw?.box ?? null
  const home = g.home, away = g.away
  const fin = raw?.stop?.kind === 'final' ? raw.stop : null
  const score = box ? { [home]: box.home?.score ?? g.score[home], [away]: box.away?.score ?? g.score[away] } : g.score
  const opp = g.user === home ? away : home
  const potg = u?.potg ?? fin?.potg ?? null
  const result = {
    home, away, user: g.user, score, ot: !!(box?.ot ?? fin?.result?.ot ?? g.ot), title: g.title,
    won: fin?.result?.won ?? score[g.user] > score[opp], tied: fin?.result?.tied ?? score[g.user] === score[opp],
    quarters: box?.home?.quarters ? { [home]: box.home.quarters, [away]: box.away.quarters } : null,
    box: box ? { [home]: boxOf(box.home), [away]: boxOf(box.away) } : {},
    totals: box?.home?.totals ? TOTALS.filter(([k]) => box.home.totals[k] != null).map(([k, label]) => ({ label, [home]: box.home.totals[k], [away]: box.away.totals[k] })) : [],
    potg: potg?.player ? { man: man(potg.player), line: potg.line } : null,
    xp: (u?.xp ?? []).slice(0, 8).map(x => ({ man: { id: x.id, name: x.name, built: !!x.built }, xp: x.xp, pts: x.pts ?? 0 })),
    xpTeam: u?.xp?.length ? u.xp.reduce((s, x) => s + (x.xp ?? 0), 0) : null,
    injuries: (w?.injuries ?? []).filter(x => x.user).map(x => ({ man: { id: x.id, name: x.name, pos: x.slot }, what: x.what ? x.what[0].toUpperCase() + x.what.slice(1) : '', weeks: x.wk })),
    league: (w?.scores ?? []).filter(x => !x.user && x.played !== false).map(x => ({ away: short(x.away), home: short(x.home), a: x.as, h: x.hs, ot: !!x.ot })),
    headlines: (w?.headlines ?? []).map(n => n.head).filter(Boolean).slice(0, 4),
  }
  return { F: F2, result }
}
// the men on the field in the mini game (real names and numbers): the engine's, when it has it
export const cast = F => FR.gameCast?.(F) ?? null
