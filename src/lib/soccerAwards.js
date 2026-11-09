// Soccer's saved season: what a soccer row in `simulations` holds, and its awards.
// No rosters here, so the boards, the Trophy Case, the profile and progress can all read it.
//
// A soccer season saves into the columns every season already has (the way OL's and DL's do), so the
// hourly leaderboard_user_stats job totals it like any other mode and no new column is needed:
//   game_mode        'soccer-classic' (TOP DIVISIONS) | 'soccer-all-time' (WORLD CUP), position 'st'
//   wins / losses    the league record (a World Cup: the group's); draws in season_comp_pct
//   champion         won the league (a World Cup: won it)
//   playoffs         a Champions League place (a World Cup: out of the group)
//   season_tds       goals (league; a World Cup: the tournament)      → total_tds
//   season_ints      assists                                           → total_ints
//   ppg              average match rating (6.0–10.0)                  → total_ppg
//   season_rating    average match rating again (a single-season best reads this one)
//   season_pass_yds  minutes
//   finals_opp / finals_series  the European (or World Cup) final: opponent and score
//   season_award     the season's awards, comma-joined: 'boot', 'poty', 'bdor' (a club season),
//                    'boot', 'gball' (a World Cup). Never 'mvp' / 'dpoy' / 'allpro', and mvp / dpoy stay
//                    null, so nothing soccer counts as a football or basketball award.
export const SOCCER_MODES_DB = { current: 'soccer-classic', alltime: 'soccer-all-time' }
export const isSoccerMode = gm => String(gm || '').startsWith('soccer-')
export const soccerModeOf = pool => (pool === 'alltime' || pool === 'all-time' ? SOCCER_MODES_DB.alltime : SOCCER_MODES_DB.current)

// tag → its name on screen
export const SOCCER_AWARD = {
  boot: 'GOLDEN BOOT',
  poty: 'PLAYER OF THE SEASON',
  bdor: 'BALLON D\'OR',
  gball: 'GOLDEN BALL',
}
export const SOCCER_AWARD_SHORT = { boot: 'BOOT', poty: 'POTS', bdor: 'BALLON D\'OR', gball: 'GOLDEN BALL' }

// The awards a finished season won, as tags (a sim result: utils/soccerSimulation.js)
export function soccerAwardTags(result) {
  if (!result) return []
  const wc = result.mode === 'alltime'
  const tags = []
  if (result.goldenBoot?.won) tags.push('boot')
  if (wc) { if (result.goldenBall?.won) tags.push('gball') }
  else {
    if (result.playerOfSeason?.won) tags.push('poty')
    if (result.ballonDor?.finish === 'winner') tags.push('bdor')
  }
  return tags
}
// tags from a saved row ('boot,bdor' → ['boot', 'bdor'])
export const rowSoccerTags = row => String(row?.season_award || '').split(',').map(s => s.trim()).filter(t => SOCCER_AWARD[t])

// The headline award of a season (for the season's XP line): the Ballon d'Or or Golden Ball first
const AWARD_NAME = { bdor: 'Ballon d\'Or', gball: 'Golden Ball', boot: 'Golden Boot', poty: 'Player of the Season' }
export function soccerAwardName(tags) {
  const t = ['bdor', 'gball', 'boot', 'poty'].find(k => tags.includes(k))
  return t ? AWARD_NAME[t] : null
}

// The stat columns of a soccer row (see above)
export function soccerRowStats(result) {
  const r1 = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null)
  const tags = soccerAwardTags(result)
  return {
    wins: result.wins ?? 0,
    losses: result.losses ?? 0,
    season_comp_pct: result.draws ?? 0,
    champion: !!result.champion,
    playoffs: !!(result.playoffs ?? result.madePlayoffs),
    season_tds: result.goals ?? 0,
    season_ints: result.assists ?? 0,
    ppg: r1(result.avgRating),
    season_rating: r1(result.avgRating),
    season_pass_yds: result.mins ?? 0,
    finals_opp: result.finalsOpp ?? null,
    finals_series: result.finalsSeries ?? null,
    season_award: tags.length ? tags.join(',') : null,
  }
}

// A winning season, the same test progress.js uses for the season's XP: a club season wins half its
// league games (19 of 38), a World Cup all three of its group games
export const SOCCER_WINNING = { 'soccer-classic': 19, 'soccer-all-time': 3 }
