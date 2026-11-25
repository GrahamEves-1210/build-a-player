// The season director's soccer, the parts Career (lib/careerSoccer.js) and the one-off season page's moments
// (SoccerSimPage, loaded only when the moments are on) share: the league table again from the season as played, the
// records and milestones, the story cards. (The director's own soccer branch is in lib/seasonDirector.js.)
import { createDirector } from './seasonDirector'
import './soccerFacts'       // the records and milestones (lib/seasonFacts.js RECORDS.soccer)
import './soccerSeason'      // the season's story cards and the in-match moments (scenarios.js, gameMoments.js)
import { runSoccerSimulation, soccerAwards, soccerLeagueInfo, soccerUclRebook, isUclResult, soccerTableAt } from '../utils/soccerSimulation'

const r10 = v => Math.round(v * 10) / 10

// The league table again from the season as played (the moments moved scores), and the awards from his real totals.
// base (Career): the season's first run. Its `form` (every club's score each matchweek) is the league the season was
// played in from the first matchweek, so the table shown through the season and the final one are the same league:
// the other clubs' results from it, his club's from the matches as played (both sides of them). Without it (a one-off
// season, a season from before the form was kept): the booked run's table with his row replaced, as before.
// base.moved (a January move): the matches before it were another club's; his new club's come from the form.
export function soccerFinal(f, t, games, base = null) {
  const gf = games.reduce((s, g) => s + (g.mySc ?? 0), 0), ga = games.reduce((s, g) => s + (g.oppSc ?? 0), 0)
  const form = base?.form && base.league?.id === f.league?.id ? base.form : null
  const us = (f.standings ?? []).find(r => r.isUs)?.short ?? f.team?.short
  const from = base?.moved?.k ?? 0
  let rows
  if (form && us && form.by?.[us]) rows = soccerTableAt(form, form.rounds, { short: us, games: games.map((g, i) => (i < from ? null : g)) })
  else {
    rows = (f.standings ?? []).map(r => (r.isUs ? { ...r, wins: t.wins, draws: t.draws, losses: t.losses, points: t.points, gf, ga, gd: gf - ga } : { ...r }))
    rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || (a.isUs ? -1 : 1))
    rows.forEach((r, i) => { r.pos = i + 1 })
  }
  const tier2 = f.league?.tier === 2
  const info = tier2 ? { ucl: 0, uel: 0, size: rows.length, down: 0 } : soccerLeagueInfo(f.league?.id) ?? { ucl: 4, uel: 2, size: 20, down: 3 }
  const row = rows.find(r => r.isUs)
  const pos = row?.pos ?? f.seed
  // (the club's record is the table's: after a January move his own matches aren't all its matches)
  const rec = form && row ? { wins: row.wins, draws: row.draws, losses: row.losses, points: row.points, gf: row.gf, ga: row.ga, gd: row.gd } : { gf, ga, gd: gf - ga }
  const out = {
    ...f, standings: rows, seed: pos, champion: pos === 1, ...rec, relegated: !tier2 && pos > info.size - info.down,
    playoffs: !tier2 && pos <= info.ucl, madePlayoffs: !tier2 && pos <= info.ucl,
    goals: t.seasonGoals, assists: t.seasonAssists, shots: t.seasonShots, sot: t.seasonSOT, xg: r10(t.seasonXG ?? 0), mins: t.seasonMins, apps: t.seasonApps, starts: t.seasonStarts,
  }
  // (the second tier: promoted from the table as played: the top two, or the play-offs the run played for third to sixth)
  if (tier2) { out.promoted = pos <= (f.league.up ?? 2) || (pos <= (f.league.playoffTo ?? 6) && !!f.playoffWon); out.promotedHow = pos <= (f.league.up ?? 2) ? 'auto' : out.promoted ? 'playoff' : null }
  // (a move from another league in January: the league's awards go by his goals in this league)
  const mine = base?.moved?.cross ? games.slice(from).filter(g => !g.sat) : null
  const sum = k => mine.reduce((a, g) => a + (g[k] ?? 0), 0)
  const aw = soccerAwards(out, mine ? { goals: sum('goals'), assists: sum('assists'), mins: sum('mins') } : { goals: t.seasonGoals, assists: t.seasonAssists, mins: t.seasonMins })
  return aw ? { ...out, ...aw } : out
}

// ── The one-off season's moments (SoccerSimPage) ─────────────────────────────
// soccerFinal, and what the season page shows off the table: the league title among the trophies, where the club
// plays in Europe next season, his goals in all competitions (the cups and Europe stay the run's)
function oneOffFinal(f, t, games) {
  // a build's Champions League season: the league phase from the games as played, the knockouts the run's
  if (isUclResult(f)) return soccerUclRebook(f, games)
  const out = soccerFinal(f, t, games)
  const lg = f.league?.name
  const was = (f.standings ?? []).find(r => r.isUs)?.pos ?? f.seed
  if (lg) out.trophies = [...(out.champion ? [lg] : []), ...(f.trophies ?? []).filter(x => x !== lg)]
  if (out.seed !== was) {
    const info = soccerLeagueInfo(f.league?.id) ?? { ucl: 4, uel: 2, size: 20, down: 3 }
    const cupEurope = f.cup?.champion && (f.qualified === 'uel' || f.qualified === 'uecl') && was > info.ucl + (info.uel ?? 1)
    out.qualified = out.seed <= info.ucl ? 'ucl' : out.seed <= info.ucl + (info.uel ?? 1) ? 'uel' : cupEurope ? f.qualified : out.seed <= info.ucl + (info.uel ?? 1) + 1 ? 'uecl' : null
  }
  if (f.allComps) out.allComps = { ...f.allComps, goals: (f.allComps.goals ?? 0) - (f.goals ?? 0) + (t.seasonGoals ?? 0), assists: (f.allComps.assists ?? 0) - (f.assists ?? 0) + (t.seasonAssists ?? 0) }
  out.gameLog = games.map(g => g.result ?? (g.won ? 'W' : g.drawn ? 'D' : 'L'))
  return out
}
// The director for a one-off club season: the rest of the league re-simulated after each decision
// (a build's season is the Champions League; one kept on the device from before 2026-11-16 is a domestic season, and
// goes on as one: team.domestic)
export function oneOffDirector({ result, build, types, name = 'Guest', attrMap = {}, seed = null }) {
  const legacy = !isUclResult(result)
  // (the Champions League's re-runs keep the season's draw: the same eight opponents, result.drawSeed)
  const simFn = (b, t, seed) => runSoccerSimulation(b, types, legacy ? { ...t, domestic: true } : result.drawSeed ? { ...t, drawSeed: result.drawSeed } : t, 'current', seed)
  return createDirector({ sport: 'soccer', pos: 'st', build, team: result.team, simFn, base: result, name, attrMap, types, onFinal: oneOffFinal, ...(seed ? { seed } : {}) })
}
