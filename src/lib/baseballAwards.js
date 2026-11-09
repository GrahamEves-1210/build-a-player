// Baseball's saved season: what a baseball row in `simulations` holds, and its awards. No rosters here, so
// the boards, the Trophy Case, the profile and progress can all read it (like lib/soccerAwards.js).
//
// Read by the Ranks boards (lib/boards.js), the Trophy Case (lib/trophies.js), the profile (app/BaseballCareer.jsx)
// and progress (lib/progress.js). Seasons save once BASEBALL_MODES.boards is on (lib/baseballUi.js) and the database
// takes them (supabase/baseball_mode.sql). A baseball season saves into the columns every season already has:
//   game_mode        'baseball-classic' (CURRENT) | 'baseball-all-time' (ALL-TIME); position 'bat' | 'pit'
//   wins / losses    the club's record (162 games)
//   champion         won the World Series; playoffs: made the postseason
//   season_tds       home runs (a pitcher: strikeouts)
//   season_ints      RBI (a pitcher: wins)
//   ppg              OPS (a pitcher: ERA)
//   season_rating    WAR
//   season_pass_yds  hits (a pitcher: outs recorded, IP x 3)
//   finals_opp / finals_series  the World Series opponent and the series score
//   season_award     the season's awards as tags, comma-joined (BASEBALL_AWARD below). mvp / dpoy stay null and
//                    no tag is 'mvp' / 'dpoy' / 'allpro', so nothing baseball counts as a football or basketball
//                    award. Every football / basketball / soccer query must leave 'baseball-%' rows out.
export const BASEBALL_MODES_DB = { current: 'baseball-classic', alltime: 'baseball-all-time' }
export const isBaseballMode = gm => String(gm || '').startsWith('baseball-')
export const baseballModeOf = pool => (pool === 'alltime' || pool === 'all-time' ? BASEBALL_MODES_DB.alltime : BASEBALL_MODES_DB.current)

// tag → its name on screen
export const BASEBALL_AWARD = {
  bmvp: 'MVP', cy: 'CY YOUNG', roy: 'ROOKIE OF THE YEAR', ss: 'SILVER SLUGGER', gg: 'GOLD GLOVE', asg: 'ALL-STAR',
  aaron: 'HANK AARON AWARD', rel: 'RELIEVER OF THE YEAR', bat: 'BATTING TITLE', hr: 'HOME RUN LEADER', so: 'STRIKEOUT LEADER',
  tc: 'TRIPLE CROWN', mlb: 'ALL-MLB', era: 'ERA TITLE', lcs: 'LCS MVP', wsmvp: 'WORLD SERIES MVP',
}
// a tag's short name, for a season's marks (the Trophy Case, the profile)
export const BASEBALL_AWARD_SHORT = {
  bmvp: 'MVP', cy: 'CY YOUNG', roy: 'ROY', ss: 'SLUGGER', gg: 'GOLD GLOVE', asg: 'ALL-STAR', aaron: 'AARON', rel: 'RELIEVER',
  bat: 'BATTING TITLE', hr: 'HR TITLE', so: 'K TITLE', tc: 'TRIPLE CROWN', mlb: 'ALL-MLB', era: 'ERA TITLE', lcs: 'LCS MVP', wsmvp: 'WS MVP',
}
// the result's award for each tag (utils/baseballSimulation.js result.awards: { won } each, the All-Star's { selected })
const FIELD = {
  bmvp: 'mvp', cy: 'cyYoung', roy: 'roy', ss: 'silverSlugger', gg: 'goldGlove', asg: 'allStar', aaron: 'hankAaron',
  rel: 'reliever', bat: 'battingTitle', hr: 'hrLeader', so: 'kLeader', tc: 'tripleCrown', mlb: 'allMLB', era: 'eraTitle',
  lcs: 'lcsMvp', wsmvp: 'wsMvp',
}
const won = v => v === true || v?.won === true || v?.selected === true

// The awards a finished season won, as tags (a sim result; reads result.awards when the sim nests them)
export function baseballAwardTags(result) {
  if (!result) return []
  const a = result.awards && typeof result.awards === 'object' && !Array.isArray(result.awards) ? result.awards : {}
  return Object.keys(FIELD).filter(tag => won(result[FIELD[tag]]) || won(a[FIELD[tag]]))
}
// tags from a saved row ('bmvp,ss' → ['bmvp', 'ss'])
export const rowBaseballTags = row => String(row?.season_award || '').split(',').map(s => s.trim()).filter(t => BASEBALL_AWARD[t])

// The headline award of a season (the season's XP line): the MVP or the Cy Young first
const ORDER = ['bmvp', 'cy', 'wsmvp', 'tc', 'roy', 'rel', 'aaron', 'lcs', 'bat', 'hr', 'so', 'era', 'ss', 'gg', 'mlb', 'asg']
const NAME = { bmvp: 'MVP', cy: 'Cy Young', wsmvp: 'World Series MVP', tc: 'Triple Crown', roy: 'Rookie of the Year', rel: 'Reliever of the Year', aaron: 'Hank Aaron Award', lcs: 'LCS MVP', bat: 'Batting Title', hr: 'Home Run Title', so: 'Strikeout Title', era: 'ERA Title', ss: 'Silver Slugger', gg: 'Gold Glove', mlb: 'All-MLB', asg: 'All-Star' }
export function baseballAwardName(tags) {
  const t = ORDER.find(k => tags.includes(k))
  return t ? NAME[t] : null
}
// the awards that pay a season's award XP (an All-Star nod alone doesn't)
export const baseballMajorAward = tags => tags.some(t => t !== 'asg')
// a saved season's awards in the order they matter, most first (its marks show the first few)
export const rowBaseballAwards = row => { const t = rowBaseballTags(row); return ORDER.filter(k => t.includes(k)) }

// The stat columns of a baseball row (see above)
export function baseballRowStats(result, pos) {
  const r2 = v => (Number.isFinite(+v) ? Math.round(+v * 1000) / 1000 : null)
  const tags = baseballAwardTags(result)
  const pit = pos === 'pit'
  // (the sim puts his line on the result itself: hr, rbi, h, ops, war; a pitcher's w, k, era, ipOuts. Its `line` is
  // the display copy, in strings)
  const L = result
  const ip = Number(L.ip ?? 0)
  const outs = Number.isFinite(L.ipOuts) ? L.ipOuts : Number.isFinite(L.outs) ? L.outs : Math.floor(ip) * 3 + Math.round((ip % 1) * 10)
  return {
    wins: result.wins ?? 0,
    losses: result.losses ?? 0,
    champion: !!result.champion,
    playoffs: !!(result.playoffs === true || result.madePlayoffs),
    season_tds: pit ? (L.so ?? L.k ?? 0) : (L.hr ?? 0),
    season_ints: pit ? (L.w ?? 0) : (L.rbi ?? 0),
    ppg: pit ? r2(L.era) : r2(L.ops),
    season_rating: r2(L.war),
    season_pass_yds: pit ? outs : (L.h ?? 0),
    finals_opp: result.finalsOpp ?? null,
    finals_series: result.finalsSeries ?? null,
    season_award: tags.length ? tags.join(',') : null,
  }
}

// A winning season, the test progress.js uses for the season's XP: 82 wins of 162
export const BASEBALL_WINNING = 82
