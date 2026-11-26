// The leagues' marks and the plain words the clean build (and the app) uses for them (the owner, 2026-11-17).
// No imports: lib/appTerms.js runs these on every piece of text on the page, and scripts/clean-dist.mjs on the
// built HTML (titles, descriptions, the prerendered pages) when the clean build is on (scripts/clean-flag.mjs).
const LEAGUE_SPORT = { NFL: 'football', NBA: 'basketball', MLB: 'baseball' }
const FLIGHT = { 'Premier League': 'English', Bundesliga: 'German', 'Serie A': 'Italian', 'Ligue 1': 'French', 'La Liga': 'Spanish' }

// (a disclaimer names the leagues to say who we're not: it keeps every name)
export const DISCLAIMER = /affiliated|endorsed|trademark|licensed/i

// The rules marked CLEAN_ONLY came with the clean build (soccer's and college's marks, lists of leagues): the app
// (lib/appTerms.js) uses them only when it's the clean build, so the app's own copy stays as it was.
export const CLEAN_ONLY = 'clean'

// ── league marks ─────────────────────────────────────────────────────────────────────────────────────────────
// order matters: the longer phrase first
export const TERM_MAP = [
  // soccer's competitions and awards (the longer phrase first)
  [/\b(?:FIFA |the FIFA )?World Cups\b/g, 'World Championships', CLEAN_ONLY],
  [/\b(?:FIFA )?World Cup\b/g, 'World Championship', CLEAN_ONLY],
  [/\b(?:FIFA )?WORLD CUPS?\b/g, m => (m.endsWith('S') ? 'WORLD CHAMPIONSHIPS' : 'WORLD CHAMPIONSHIP'), CLEAN_ONLY],
  [/\b(?:UEFA )?Champions League\b/g, 'Continental Cup', CLEAN_ONLY],
  [/\b(?:UEFA )?CHAMPIONS LEAGUE\b/g, 'CONTINENTAL CUP', CLEAN_ONLY],
  [/\b(?:UEFA )?Europa League\b/g, 'Continental Trophy', CLEAN_ONLY],
  [/\b(?:UEFA )?EUROPA LEAGUE\b/g, 'CONTINENTAL TROPHY', CLEAN_ONLY],
  [/\bBallon d['’]Ors?\b/g, m => (m.endsWith('s') ? 'Player of the Year awards' : 'Player of the Year'), CLEAN_ONLY],
  [/\bBALLON D['’]ORS?\b/g, m => (m.endsWith('S') ? 'POY AWARDS' : 'PLAYER OF THE YEAR'), CLEAN_ONLY],
  // (a noun after it makes it an adjective: "a Premier League club" → "an English top-flight club")
  [/\b(?:(an?|An?) )?(?:the )?(Premier League|Bundesliga|Serie A|Ligue 1|La Liga)\b( (?=(?:clubs?|titles?|sides?|teams?|seasons?|records?|champions?|history|debut|careers?|football|goals|games?|match(?:es)?|winners?|play|defenders?|strikers?|players?|form|table|race|minutes|starts?)\b)[a-z])?/g, (m, a, l, next) =>
    (a ? (/[AEIOU]/.test(FLIGHT[l][0]) ? a[0] + 'n ' : a[0] + ' ') : /^[Tt]he|^La/.test(m) || !next ? 'the ' : '') + FLIGHT[l] + (next ? ' top-flight' + next : ' top flight'), CLEAN_ONLY],
  [/\b(PREMIER LEAGUE|BUNDESLIGA|SERIE A|LIGUE 1|LA LIGA)\b/g, (m, l) => `${FLIGHT[l.replace(/\w+/g, w => w[0] + w.slice(1).toLowerCase())]?.toUpperCase() ?? 'TOP'} TOP FLIGHT`, CLEAN_ONLY],
  [/\bUEFA\b/g, 'European', CLEAN_ONLY],
  [/\bFIFA\b/g, (m, i, s) => (/[a-z]/.test(s) ? 'world' : 'WORLD'), CLEAN_ONLY],
  // college football and basketball's marks
  [/\b(?:the )?College Football Playoff\b/g, m => (m.startsWith('the') ? 'the Playoff' : 'Playoff'), CLEAN_ONLY],
  [/\bCOLLEGE FOOTBALL PLAYOFF\b/g, 'PLAYOFF', CLEAN_ONLY],
  [/\bCFP\b/g, (m, i, s) => (/[a-z]/.test(s) ? 'Playoff' : 'PLAYOFF'), CLEAN_ONLY],
  [/\bSweet (?:16|Sixteen)\b/g, 'regional semifinals', CLEAN_ONLY],
  [/\bSWEET (?:16|SIXTEEN)\b/g, 'REGIONAL SEMIS', CLEAN_ONLY],
  [/\bElite (?:Eight|8)\b/g, 'regional final', CLEAN_ONLY],
  [/\bELITE (?:EIGHT|8)\b/g, 'REGIONAL FINAL', CLEAN_ONLY],
  [/\b(?:Naismith|Wooden)(?: Award| Trophy)?(?: winners?)?\b/g, m => (/winners$/.test(m) ? 'Players of the Year' : 'Player of the Year'), CLEAN_ONLY],
  [/\b(?:NAISMITH|WOODEN)(?: AWARD| TROPHY)?\b/g, 'PLAYER OF THE YEAR', CLEAN_ONLY],
  [/\bRose Bowl\b/g, "New Year's Day bowl", CLEAN_ONLY],
  // the conferences by their abbreviations only (owner 11-25), the full name first
  [/\b(?:the )?Southeastern Conference\b/gi, 'SEC', CLEAN_ONLY],
  [/\b(?:the )?Atlantic Coast Conference\b/gi, 'ACC', CLEAN_ONLY],
  [/\bBig Ten(?: Conference)?\b|\bBIG TEN(?: CONFERENCE)?\b/g, 'B10', CLEAN_ONLY],
  [/\bBig 12(?: Conference)?\b|\bBIG 12(?: CONFERENCE)?\b/g, 'B12', CLEAN_ONLY],
  [/\bBig East(?: Conference)?\b|\bBIG EAST(?: CONFERENCE)?\b/g, 'BEC', CLEAN_ONLY],
  [/\bBig West(?: Conference)?\b|\bBIG WEST(?: CONFERENCE)?\b/g, 'BWC', CLEAN_ONLY],
  [/\bBig Sky(?: Conference)?\b|\bBIG SKY(?: CONFERENCE)?\b/g, 'BSC', CLEAN_ONLY],
  [/\bBig South(?: Conference)?\b|\bBIG SOUTH(?: CONFERENCE)?\b/g, 'BSO', CLEAN_ONLY],
  [/\bMountain West(?: Conference)?\b|\bMOUNTAIN WEST(?: CONFERENCE)?\b/g, 'MWC', CLEAN_ONLY],
  [/\bSun Belt(?: Conference)?\b|\bSUN BELT(?: CONFERENCE)?\b/g, 'SBC', CLEAN_ONLY],
  [/\bPac-12(?: Conference)?\b|\bPAC-12(?: CONFERENCE)?\b/g, 'P12', CLEAN_ONLY],
  [/\bAmerican Athletic Conference\b|\bAMERICAN ATHLETIC CONFERENCE\b/g, 'AAC', CLEAN_ONLY],
  [/\bMid-American Conference\b|\bMID-AMERICAN CONFERENCE\b/g, 'MAC', CLEAN_ONLY],
  [/\bConference USA\b|\bCONFERENCE USA\b/g, 'C-USA', CLEAN_ONLY],
  [/\bWest Coast Conference\b|\bWEST COAST CONFERENCE\b/g, 'WCC', CLEAN_ONLY],
  [/\bAtlantic 10(?: Conference)?\b|\bATLANTIC 10(?: CONFERENCE)?\b/g, 'A-10', CLEAN_ONLY],
  [/\bMissouri Valley Conference\b|\bMISSOURI VALLEY CONFERENCE\b/g, 'MVC', CLEAN_ONLY],
  // no FBS (owner 11-25): "All FBS schools" → "All top-division schools"
  [/\bFBS\b/g, (m, i, s) => (/[a-z]/.test(s) ? 'top-division' : 'TOP-DIVISION'), CLEAN_ONLY],
  [/\bAll-(NBA|NFL)\b/g, 'All-League', CLEAN_ONLY],
  [/\bALL-(NBA|NFL)\b/g, 'ALL-LEAGUE', CLEAN_ONLY],
  [/\bSuper Bowl (champions?|winners?|titles?|rings?|MVPs?)\b/g, (m, w) => (/^MVP/.test(w) ? `Championship ${w}` : w === 'titles' ? 'championships' : w === 'title' ? 'championship' : w === 'rings' ? 'championship rings' : w === 'ring' ? 'championship ring' : w)],
  [/\bSUPER BOWL (CHAMPIONS?|WINNERS?|MVPS?)\b/g, (m, w) => (/^MVP/.test(w) ? `CHAMPIONSHIP ${w}` : w)],
  [/\bSuper Bowls\b/g, 'Championships'],
  [/\bSuper Bowl\b/g, 'Championship'],
  [/\bSUPER BOWLS?\b/g, m => (m.endsWith('S') ? 'CHAMPIONSHIPS' : 'CHAMPIONSHIP')],
  [/\bPro Bowlers?\b/g, m => (m.endsWith('s') ? 'All-Stars' : 'All-Star')],
  [/\bPro Bowls\b/g, 'All-Star selections'],
  [/\bPro Bowl\b/g, 'All-Star'],
  [/\bPRO BOWLS?\b/g, 'ALL-STAR'],
  [/\b(?:the )?NBA Finals\b/g, m => (m.startsWith('the') ? 'the Finals' : 'Finals')],
  [/\bNBA FINALS\b/g, 'FINALS'],
  [/\bMarch Madness\b/g, 'the tournament'],
  [/\bMARCH MADNESS\b/g, 'THE TOURNAMENT'],
  [/\b(?:the )?Final Four\b/g, m => (m.startsWith('the') ? 'the semifinals' : 'semifinals')],
  [/\bFINAL FOUR\b/g, 'SEMIFINALS'],
  [/\bHeisman(?: Trophy)?(?: winners?)?\b/g, m => (/winners$/.test(m) ? 'Players of the Year' : 'Player of the Year')],
  [/\bHEISMAN(?: TROPHY)?\b/g, 'PLAYER OF THE YEAR'],
  [/\b(?:Vince )?Lombardi(?: Trophy)?\b/g, 'championship trophy'],
  [/\bLarry O'Brien(?: Trophy)?\b/g, 'championship trophy'],
  [/\bWorld Series\b/g, 'Championship Series'],
  [/\b(?:the )?(NFL|NBA|MLB) Draft\b/g, m => (m.startsWith('the') ? 'the Draft' : 'Draft')],
  [/\b(NFL|NBA|MLB) DRAFT\b/g, 'DRAFT'],
  // the leagues' own names
  // a list of them names the sports instead: "an NFL, NBA or soccer season" → "a pro football, pro basketball or soccer season"
  [/\b(?:(an?|An?) )?((?:NFL|NBA|MLB)(?:,? (?:or |and )?(?:NFL|NBA|MLB)\b)+)/g, (m, a, list) => (a ? a[0] + ' ' : '') + list.replace(/NFL|NBA|MLB/g, l => `pro ${LEAGUE_SPORT[l]}`), CLEAN_ONLY],
  [/\b(?:the|The) (NFL|NBA|MLB|NCAA)\b/g, m => (m[0] === 'T' ? 'The league' : 'the league')],
  [/\bTHE (NFL|NBA|MLB|NCAA)\b/g, 'THE LEAGUE'],
  [/\b(?:an|An) (NFL|NBA|MLB)\b/g, m => (m[0] === 'A' ? 'A pro' : 'a pro')],
  [/\b(NFL|NBA|MLB)(?=['’]s\b)/g, 'the league'],
  [/\bNCAA\b/g, 'college'],
  [/ \((NFL|NBA|MLB)\)/g, '', CLEAN_ONLY],
  [/\b(NFL|NBA|MLB)\b(?= [A-Z][a-z])/g, 'Pro', CLEAN_ONLY],
  [/\b(NFL|NBA|MLB)\b/g, (m, x, i, s) => (/[a-z]/.test(s) ? 'pro' : 'PRO')],
]

// the marks out of one piece of text (no team nicknames: those need the jersey index, lib/appTerms.js)
export function cleanTerms(text) {
  if (typeof text !== 'string' || text.length < 2 || DISCLAIMER.test(text)) return text
  let s = text
  for (const [re, to] of TERM_MAP) s = s.replace(re, to)
  return s
}
