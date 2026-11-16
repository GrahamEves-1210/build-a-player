// FotMob league leaderboards -> one compact file per player (step 1 of the soccer ratings, 2026-11-16).
// node scripts/soccer/fotmob-compact.mjs [rawDir]          (rawDir default F:/bap-agents/socattr/raw)
//
// Raw input: rawDir/fotmob/leagues.json (league id -> its 2025-26 and 2026-27 season ids, read off fotmob.com's
// league stats pages) and rawDir/fotmob/{league}_{season}/{stat}.json, FotMob's public leaderboard files
// (data.fotmob.com/stats/{league}/season/{season}/{stat}.json, no sign-in), for the five leagues and 40 more.
// Output: rawDir/fotmob-players.json { leagues, players: { fotmobId: { n, c, pos, s: { 'league_season': line } } } }
// A line has totals (min, g, pg, xg, xgot, bcm, a, xa, cc, bcc, pw) and per-90 rates (sh90, sot90, ap90, acc,
// lb90, dr90, drp, pw3), plus rating and top speed (ts, km/h; Premier League tracking only). A per-90 board only
// lists players over FotMob's minutes floor, so a rate missing there is unknown, not zero.
import fs from 'node:fs'
import path from 'node:path'

const RAW = process.argv[2] ?? 'F:/bap-agents/socattr/raw'
const FM = path.join(RAW, 'fotmob')
// stat file -> [field for StatValue, field for SubStatValue or null]
const MAP = {
  mins_played: ['min', null], goals: ['g', 'pg'], expected_goals: ['xg', null], expected_goalsontarget: ['xgot', null],
  big_chance_missed: ['bcm', null], goal_assist: ['a', null], expected_assists: ['xa', null], total_att_assist: ['cc', null],
  big_chance_created: ['bcc', null], penalty_won: ['pw', null], total_scoring_att: ['sh90', null], ontarget_scoring_att: ['sot90', null],
  accurate_pass: ['ap90', 'acc'], accurate_long_balls: ['lb90', 'lbp'], won_contest: ['dr90', 'drp'], poss_won_att_3rd: ['pw3', null],
  rating: ['rating', null], phys_ts: ['ts', null],
}
const leagues = JSON.parse(fs.readFileSync(path.join(FM, 'leagues.json'), 'utf8'))
const players = {}
const out = { made: new Date().toISOString().slice(0, 10), leagues: {}, players }
for (const [lid, v] of Object.entries(leagues)) {
  const seen = new Set()
  for (const s of v.seasons) {
    if (seen.has(s.tid)) continue
    seen.add(s.tid)
    const key = `${lid}_${s.tid}`, dir = path.join(FM, key)
    if (!fs.existsSync(dir)) continue
    const now = s.name === '2026/2027' || s.name === '2026'
    out.leagues[key] = { lid, name: s.league, cc: s.cc, season: s.name, now }
    for (const [stat, [f1, f2]] of Object.entries(MAP)) {
      const f = path.join(dir, `${stat}.json`)
      if (!fs.existsSync(f)) continue
      const d = JSON.parse(fs.readFileSync(f, 'utf8'))
      if (!d) continue
      for (const e of d.TopLists[0].StatList) {
        const id = e.ParticiantId
        if (!id) continue
        const p = (players[id] ??= { n: e.ParticipantName, c: e.ParticipantCountryCode ?? null, pos: e.Positions ?? [], s: {} })
        if ((e.Positions ?? []).length > p.pos.length) p.pos = e.Positions
        const line = (p.s[key] ??= { team: e.TeamName ?? null, tid: e.TeamId, min: 0 })
        if (e.TeamName) line.team = e.TeamName
        line[f1] = e.StatValue
        if (f2) line[f2] = e.SubStatValue
        if (e.MinutesPlayed > line.min) line.min = e.MinutesPlayed
      }
    }
  }
}
fs.writeFileSync(path.join(RAW, 'fotmob-players.json'), JSON.stringify(out))
console.log(Object.keys(players).length, 'players,', Object.keys(out.leagues).length, 'league seasons')
