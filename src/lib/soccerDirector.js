// The season director's soccer, the parts Career (lib/careerSoccer.js) and the one-off season page's moments
// (SoccerSimPage, loaded only when the moments are on) share: the league table again from the season as played, the
// records and milestones, the story cards. (The director's own soccer branch is in lib/seasonDirector.js.)
import { createDirector } from './seasonDirector'
import './soccerFacts'       // the records and milestones (lib/seasonFacts.js RECORDS.soccer)
import './soccerSeason'      // the season's story cards and the in-match moments (scenarios.js, gameMoments.js)
import { runSoccerSimulation, soccerAwards, soccerLeagueInfo } from '../utils/soccerSimulation'

const r10 = v => Math.round(v * 10) / 10

// The league table again from the season as played (the moments moved scores), and the awards from his real totals
export function soccerFinal(f, t, games) {
  const gf = games.reduce((s, g) => s + (g.mySc ?? 0), 0), ga = games.reduce((s, g) => s + (g.oppSc ?? 0), 0)
  const rows = (f.standings ?? []).map(r => (r.isUs ? { ...r, wins: t.wins, draws: t.draws, losses: t.losses, points: t.points, gf, ga, gd: gf - ga } : { ...r }))
  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || (a.isUs ? -1 : 1))
  rows.forEach((r, i) => { r.pos = i + 1 })
  const info = soccerLeagueInfo(f.league?.id) ?? { ucl: 4, uel: 2, size: 20, down: 3 }
  const pos = rows.find(r => r.isUs)?.pos ?? f.seed
  const out = {
    ...f, standings: rows, seed: pos, champion: pos === 1, gf, ga, gd: gf - ga, relegated: pos > info.size - info.down,
    playoffs: pos <= info.ucl, madePlayoffs: pos <= info.ucl,
    goals: t.seasonGoals, assists: t.seasonAssists, shots: t.seasonShots, sot: t.seasonSOT, xg: r10(t.seasonXG ?? 0), mins: t.seasonMins, apps: t.seasonApps, starts: t.seasonStarts,
  }
  const aw = soccerAwards(out, { goals: t.seasonGoals, assists: t.seasonAssists, mins: t.seasonMins })
  return aw ? { ...out, ...aw } : out
}

// ── The one-off season's moments (SoccerSimPage) ─────────────────────────────
// soccerFinal, and what the season page shows off the table: the league title among the trophies, where the club
// plays in Europe next season, his goals in all competitions (the cups and Europe stay the run's)
function oneOffFinal(f, t, games) {
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
export function oneOffDirector({ result, build, types, name = 'Guest', attrMap = {} }) {
  const simFn = (b, t, seed) => runSoccerSimulation(b, types, t, 'current', seed)
  return createDirector({ sport: 'soccer', pos: 'st', build, team: result.team, simFn, base: result, name, attrMap, types, onFinal: oneOffFinal })
}
