// The season director's baseball (lib/seasonDirector.js registerDirector): the stat lines a season adds up, how a
// game reads in a headline, the big and the bad days, where the moments fall in 162 games, the playoff line, the game
// the club plays without him. Career (lib/careerBaseball.js) and the one-off season page's moments (BaseballSimPage,
// loaded only when the moments are on) both use it. The records, milestones and story cards come with it.
import { registerDirector, createDirector } from './seasonDirector'
import './baseballFacts'       // the records and milestones (lib/seasonFacts.js RECORDS.baseball)
import './baseballSeason'      // the season's story cards and the in-game moments
import { MLB_TEAMS } from '../data/mlb-teams'
import { runBaseballSimulation, rebookBaseball } from '../utils/baseballSimulation'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const r3 = v => Math.round(v * 1000) / 1000
const r2 = v => Math.round(v * 100) / 100
const ipText = outs => `${Math.floor((outs ?? 0) / 3)}.${(outs ?? 0) % 3}`
const TEAM_BY = new Map(MLB_TEAMS.map(t => [t.short, t]))
const TWO_WORD = /\s(Red Sox|White Sox|Blue Jays)$/
const nickOfTeam = t => t?.nick ?? TWO_WORD.exec(t?.name ?? '')?.[1] ?? String(t?.name ?? '').split(' ').slice(-1)[0]
const KEEP = new Set(['g', 'wk', 'opponent', 'home', 'mySc', 'oppSc', 'won'])

// the season director: the stat lines it adds up, the game the club plays without him, the playoff line
registerDirector('baseball', {
  counts: {
    bat: { seasonHR: 'hr', seasonH: 'h', seasonRBI: 'rbi', seasonSB: 'sb', seasonBB: 'bb', seasonPA: 'pa', seasonAB: 'ab', seasonR: 'r' },
    pit: { seasonK: 'k', seasonW: 'w', seasonSV: 'sv', seasonOuts: 'outs', seasonER: 'er', seasonL: 'l' },
  },
  best: {
    bat: g => (g.hr ?? 0) * 8 + (g.h ?? 0) * 3 + (g.rbi ?? 0) * 2 + (g.d ?? 0) * 2 + (g.t ?? 0) * 3 + (g.sb ?? 0) + (g.won ? 1 : 0),
    pit: g => (g.gs ? (g.outs ?? 0) * 0.5 + (g.k ?? 0) * 1.5 - (g.er ?? 0) * 3 - (g.ha ?? 0) * 0.5 - (g.bb ?? 0) * 0.5 + (g.w ? 3 : 0) : (g.sv ?? 0) * 4 + (g.k ?? 0) - (g.er ?? 0) * 3),
  },
  line: {
    bat: g => (g.app ? `${g.h ?? 0}-for-${g.ab ?? 0}${g.hr ? `, ${g.hr > 1 ? `${g.hr} HR` : 'a home run'}` : g.d ? `, ${g.d > 1 ? `${g.d} doubles` : 'a double'}` : ''}${g.rbi ? `, ${g.rbi} RBI` : ''}${g.sb ? `, ${g.sb} SB` : ''}` : 'did not play'),
    pit: g => (g.app ? `${ipText(g.outs ?? 0)} IP, ${g.er ?? 0} ER, ${g.k ?? 0} K${g.w ? ' (W)' : g.l ? ' (L)' : g.sv ? ' (SV)' : g.hld ? ' (HLD)' : ''}` : 'did not pitch'),
  },
  big: { bat: g => (g.hr ?? 0) >= 2 || (g.h ?? 0) >= 4 || (g.rbi ?? 0) >= 6, pit: g => (!!g.gs && ((g.k ?? 0) >= 12 || ((g.outs ?? 0) >= 27 && (g.er ?? 0) === 0))) || (!!g.gs && (g.outs ?? 0) >= 24 && (g.ha ?? 0) === 0) },
  bust: { bat: g => (g.ab ?? 0) >= 4 && !g.h && (g.k ?? 0) >= 3, pit: g => !!g.gs && (g.er ?? 0) >= 6 },
  stops: { want: rs => 3 + (rs() < 0.45 ? 1 : 0), lo: 14, end: 8, gap: 26 },
  lines: { clinch: 92, out: 84 }, tol: 2,
  nick: team => (team?.short ? nickOfTeam(TEAM_BY.get(team.short) ?? MLB_TEAMS[0]) : nickOfTeam(team)),
  // the club plays without him: a ballgame's score (the losers about 2.6 runs, the winners about 5.4), no line
  sit: (g, team, r) => {
    const st = ((team.off ?? 5.5) + (team.def ?? 5.5)) / 20
    const won = r() < clamp(st - 0.03, 0.3, 0.66)
    // (2-9 runs for the winners, the way the sim's own scores run)
    const lose = Math.floor(r() * 6), margin = Math.max(1, 2 - lose) + Math.floor(r() * 4)
    const keep = Object.fromEntries(Object.entries(g).filter(([k]) => KEEP.has(k) || k === 'il'))
    return { ...keep, won, mySc: won ? lose + margin : lose, oppSc: won ? lose : lose + margin }
  },
  // the totals the record book reads (a rate needs the qualifier: 3.1 plate appearances or an inning a team game)
  totals: (out, games, pos) => {
    out.gameLog = games.map(g => (g.won ? 'W' : 'L'))
    const P = games.filter(g => !g.sat && g.app)
    if (pos === 'bat') { let run = 0, best = 0; for (const g of games) { if (g.sat || !g.app) continue; if ((g.h ?? 0) > 0) { run++; best = Math.max(best, run) } else if ((g.ab ?? 0) > 0) run = 0 } out.hitStreak = best; out.seasonAVG = out.seasonAB ? r3(out.seasonH / out.seasonAB) : 0 }
    else out.seasonERA = out.seasonOuts ? r2(out.seasonER * 27 / out.seasonOuts) : 0
    out.gp = P.length
  },
})

// ── The one-off season's moments (BaseballSimPage) ───────────────────────────
// The engine's game, the way the director and the story cards read it (Career's games carry these names): an
// appearance, doubles and triples, a pitcher's hits allowed. The engine's own names stay on it for the page.
const dirGame = (g, pos) => (pos === 'pit' ? { ...g, ha: g.ha ?? g.h ?? 0 } : { ...g, app: g.app ?? g.gp ?? 0, d: g.d ?? g.doubles ?? 0, t: g.t ?? g.triples ?? 0 })
const regular = (res, pos) => ({ ...res, games: (res.games ?? []).filter(g => g && !g.ps).map(g => dirGame(g, pos)) })
// a table row set to the record the games show; a neighbour that would now sit out of order is brought level with
// it (the order, the seeds and the bracket stay the run's), and the games behind follow
function fixRows(rows, short, wins, losses) {
  if (!Array.isArray(rows)) return rows
  const out = rows.map(r => ({ ...r }))
  const i = out.findIndex(r => r.isUs || r.short === short)
  if (i < 0) return rows
  const n = wins + losses
  const set = (r, w) => { r.wins = w; r.losses = n - w; if (r.pct != null) r.pct = r3(w / Math.max(1, n)) }
  set(out[i], wins)
  for (let j = i - 1; j >= 0 && out[j].wins < out[j + 1].wins; j--) set(out[j], out[j + 1].wins)
  for (let j = i + 1; j < out.length && out[j].wins > out[j - 1].wins; j++) set(out[j], out[j - 1].wins)
  if (out.some(r => r.gb != null)) { const top = out[0]; out.forEach((r, k) => { r.gb = k === 0 ? 0 : ((top.wins - r.wins) + (r.losses - top.losses)) / 2 }) }
  return out
}
// The season as played: rebooked from the games (his line, the awards), and every table he's in at that record
function oneOffFinal(f, games) {
  const out = rebookBaseball(f, games)
  const short = out.team?.short, lg = out.league ?? out.team?.lg, div = out.division ?? out.team?.div
  out.standings = fixRows(out.standings, short, out.wins, out.losses)
  if (out.divisions?.[lg]?.[div]) out.divisions = { ...out.divisions, [lg]: { ...out.divisions[lg], [div]: fixRows(out.divisions[lg][div], short, out.wins, out.losses) } }
  if (out.wildCardRace?.[lg]) out.wildCardRace = { ...out.wildCardRace, [lg]: fixRows(out.wildCardRace[lg], short, out.wins, out.losses) }
  return out
}
// The director for a one-off season: the rest of the year re-simulated after each decision (team.fast: no award
// field on the re-runs; the booked season's awards come from the rebook)
export function oneOffDirector({ result, build, types, pos = 'bat', mode = 'current', name = 'Guest', attrMap = {} }) {
  const simFn = (b, t, seed) => regular(runBaseballSimulation(b, types, { ...t, fast: true }, pos, mode, seed), pos)
  return createDirector({ sport: 'baseball', pos, build, team: result.team, simFn, base: regular(result, pos), name, attrMap, types, onFinal: (f, t, games) => oneOffFinal(f, games), oppName: g => `the ${nickOfTeam(TEAM_BY.get(g.opponent) ?? { name: String(g.opponent ?? '') })}` })
}
