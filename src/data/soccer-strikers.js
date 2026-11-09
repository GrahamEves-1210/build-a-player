// Strikers for soccer, Build-A-Player's third sport. Same shape as data/nba-guards.js (one row per player, attrs on
// the 0-11 grade scale: F=0, D=1, C-=2, C=3, C+=4, B-=5, B=6, B+=7, A-=8, A=9, A+=10, S=11).
//
//   SOCCER_STRIKERS  TOP DIVISIONS (pool key 'current'), team = club short in soccer-clubs.js. Up to 5 per club.
//   WC_STRIKERS      WORLD CUP (pool key 'alltime'), team = FIFA code in soccer-nations.js. 5 per nation.
//   SOCCER_PLAYERS / WC_PLAYERS are the same arrays. A player in both pools has the same bio, espn id and attrs.
//
// WHO IS IN
//   The build is a striker, but the wheel holds every kind of outfield player who isn't a defender or keeper:
//   strikers, wingers, attacking, central and defensive midfielders. role = the player's real position
//   ('ST' | 'SS' | 'LW' | 'RW' | 'AM' | 'CM' | 'DM'), from FotMob's position history: ST = half or more of his
//   recent games up front, SS = a wide or No. 10 player who plays up front a quarter of the time or more (Messi,
//   Raphinha, Saibari). position stays 'ST' (the build position). Only ST/SS are real forwards (Golden Boot).
//   Each club / nation: first the main striker, the one a striker build replaces (starter: true, one per team):
//   most league starts as the striker this season in ESPN's line-ups ('F', or 'CF-L'/'CF-R' in a two-up-front
//   formation; in a 3-4-2-1 ESPN labels the two No. 10s CF-L/CF-R and those do not count); ties on the share of
//   recent games at striker, then starts, then minutes. At the World Cup: most World Cup starts as the striker.
//   Then the most important other non-defenders, in order: 2026-27 league minutes (35%), 2025-26 minutes (20%)
//   and FotMob market value (45%) for clubs; World Cup 2026 minutes (65%) and market value (35%) for nations.
//   Headline players short on minutes through injury were kept in by hand (Dembélé, Kvaratskhelia, De Bruyne,
//   Foden, Musiala; Messi, Ronaldo, Modrić, Salah, Son, Vinícius, Bellingham, Saka, Yamal, Pedri, Ødegaard,
//   Wirtz at the World Cup where needed). Everton (Barry) is the one club with a single centre-forward.
//
// BIO   name, number, height (inches), weight (lb), age: ESPN rosters (club number in SOCCER_STRIKERS, World Cup
//       number in WC_STRIKERS). foot: FotMob. nation: FIFA code of the national team the player plays for (FotMob).
//       weight is null where ESPN lists none. skin: the sampler from scripts/extract-nba-skin-colors.mjs run on the
//       ESPN headshot (or, with no ESPN photo, on the FotMob player cut-out, sampled only and never stored), snapped
//       to the nearest skin swatch used in data/nba-*.js.
//
// SOURCES (2025-26 full season plus 2026-27 to 2026-11-07)
//   FotMob (Opta event data): league leaderboards for 2025-26 and 2026-27 in the top five leagues and 30+ other
//     leagues (goals, xG, xGOT, shots, big chances missed, chances created, xA, accurate passes, successful dribbles,
//     ratings, minutes; Premier League tracking top speed) and every player page (aerial and ground duels,
//     dispossessions, touches, touches in the box, shot maps with headers, penalties and shots from outside the box,
//     career and international records). World Cup 2026 tournament leaderboards.
//   ESPN: rosters, line-ups, 2025-26 league stats (headed goals, penalties, free kicks, fouls won).
//   Published top speeds: bundesliga.com 2025-26 top speed table, CIES Football Observatory (Gradient) UCL
//     2025-26 league stage, Kognia/BeSoccer LaLiga 2025-26 (via Mundo Deportivo), Squawka LaLiga speed list.
//
// RUBRIC (each trait = weighted z-score of the inputs over both seasons; small samples are pulled toward the pool)
//   finishing   goals minus xG per shot, xGOT minus xG per shot, goals per 90, shot conversion, big chances missed
//               per xG (lower is better), three seasons of league goals per game.
//   shotPower   share of shots from outside the box, outside-the-box goals, xGOT of those shots, free-kick goals,
//               body mass. Long-range and free-kick record for the names in the notes below.
//   heading     aerial duel win %, aerials won per 90, headed goals per 90 (ESPN + shot maps), headed shots, height.
//   dribbling   successful take-ons per 90 and take-on success %.
//   firstTouch  dispossessions per touch (lower is better; ball control and miscontrols), pass completion, take-on
//               success %, touches per 90.
//   linkUp      xA per 90, chances created per 90, assists per 90, pass completion, accurate passes per 90.
//   pace        Premier League tracking top speed (FotMob, 2025-26 and 2026-27). Outside the Premier League there is
//               no public tracking feed: a model fitted on the Premier League strikers (height, weight, age, take-ons,
//               share of games out wide) plus the published speeds above and long tracking records in the notes.
//   strength    weight, height, ground and aerial duel win %, fouls won per 90.
//   offBall     non-penalty xG per 90, touches in the opposition box per 90, shots per 90, three-season goal rate.
//   composure   penalty record, big chances missed per xG, Champions League and Europa League goals over three
//               seasons, World Cup 2026 goals, international goals per cap, experience, match ratings.
//   League level: output traits are lowered for weaker leagues (Premier League 0, La Liga -0.05, Bundesliga and
//   Serie A -0.1, Ligue 1 -0.25 z; Eredivisie, Portugal, Championship around -0.5; MLS, Saudi, Liga MX around -0.7;
//   smaller leagues -1 and below), fully for offBall, partly for the skill traits, lightly for strength and heading.
//   The traits are a striker's, so midfielders are graded on them as they are (Modrić: high link-up, touch and
//   composure, low heading and strength). Grades are cut on the Top Divisions regulars (900+ league minutes, all
//   roles): S top 1.5%, A+ next 3%, A next 5%, A- next 8%,
//   B+ 11%, B 14%, B- 15%, C+ 14%, C 12%, C- 9%, D 5%, F the rest. Mid-table strikers land around C to B; everyone else
//   is graded on the same lines. S is a handful per trait.
//
// EVIDENCE NOTES (hand corrections over the data, each with a longer record behind it)
//   Mbappé pace S (35.7 km/h, UCL 2025-26 top-20), shot A, link A+. Burke pace S (37.0 km/h, 2nd fastest in Bundesliga
//   history). Haaland strength S, shot A+, touch B-. Kane link-up S, pace C. Messi dribbling, touch, composure S (MLS
//   MVP, 8 goals at the 2026 World Cup). Ronaldo heading and shot S (60+ free-kick goals), composure A+, pace D at 41.
//   Lukaku strength S, injury-hit 2025-26 replaced by his 2024-25 title season. Raphinha, Lepaul finishing A+ (one hot
//   season). Pace from tracking records or published speeds: Núñez, Openda, Dembélé, Plata A; Iñaki Williams, Thuram,
//   Højlund A-; Malen, Balogun, Kean B+. Long-range record: Schick shot A+, Depay, Dybala, Lukaku A-, Salah B+.
//   Small-sample spikes pulled back: Evanilson, Boyé, Mariano, Matanović, Álvaro Rodríguez (shot), Enciso, Okafor,
//   Ivanović (dribbling), Pépé, Pulisic, Gerard Moreno (touch), Saibari (link), Bulter, Chorý (strength), Ueda
//   (off-ball). Calvert-Lewin heading A+. Gyökeres strength A. Kolo Muani finishing D.

export const ST_TYPES = ["finishing","shotPower","heading","dribbling","firstTouch","linkUp","pace","strength","offBall","composure"]
export const ST_CATEGORIES = [{"id":"skills","label":"Skills","types":["finishing","shotPower","heading","dribbling","firstTouch","linkUp"]},{"id":"physical","label":"Physical","types":["pace","strength"]},{"id":"mental","label":"Mental","types":["offBall","composure"]}]

// ─── TOP DIVISIONS (team = club short from soccer-clubs.js) ─────────────────
export const SOCCER_STRIKERS = [

  // ─── ARS ────────────────────────────────────────────────────────────
  { name: "Kai Havertz", short: "Havertz", team: 'ARS', nation: 'GER', number: 29, height: 76, weight: 183, age: 27, foot: 'left', skin: '#a67f6b', espn: 231182, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 7, heading: 10, dribbling: 3, firstTouch: 4, linkUp: 5, pace: 6, strength: 9, offBall: 8, composure: 9 } },
  { name: "Declan Rice", short: "Rice", team: 'ARS', nation: 'ENG', number: 41, height: 74, weight: 168, age: 27, foot: 'right', skin: '#dfac9c', espn: 238262, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 7, heading: 7, dribbling: 6, firstTouch: 10, linkUp: 10, pace: 6, strength: 6, offBall: 4, composure: 8 } },
  { name: "Bukayo Saka", short: "Saka", team: 'ARS', nation: 'ENG', number: 7, height: 70, weight: 141, age: 25, foot: 'left', skin: '#7b6051', espn: 280555, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 7, heading: 4, dribbling: 9, firstTouch: 7, linkUp: 9, pace: 3, strength: 4, offBall: 9, composure: 10 } },
  { name: "Martin Ødegaard", short: "Ødegaard", team: 'ARS', nation: 'NOR', number: 8, height: 70, weight: 150, age: 27, foot: 'left', skin: '#b88a7a', espn: 203669, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 6, heading: 4, dribbling: 3, firstTouch: 9, linkUp: 10, pace: 1, strength: 4, offBall: 5, composure: 7 } },
  { name: "Bruno Guimarães", short: "Guimarães", team: 'ARS', nation: 'BRA', number: 39, height: 72, weight: 172, age: 28, foot: 'right', skin: '#c38f80', espn: 218522, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 10, shotPower: 9, heading: 9, dribbling: 5, firstTouch: 6, linkUp: 8, pace: 0, strength: 10, offBall: 5, composure: 8 } },

  // ─── AVL ────────────────────────────────────────────────────────────
  { name: "Nicolas Jackson", short: "Jackson", team: 'AVL', nation: 'SEN', number: 11, height: 74, weight: 181, age: 25, foot: 'right', skin: '#6c4943', espn: 308524, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 6, heading: 7, dribbling: 7, firstTouch: 4, linkUp: 5, pace: 7, strength: 8, offBall: 9, composure: 6 } },
  { name: "Johan Manzambi", short: "Manzambi", team: 'AVL', nation: 'SUI', number: 44, height: 72, weight: 163, age: 21, foot: 'right', skin: '#765144', espn: 386992, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 4, heading: 7, dribbling: 8, firstTouch: 7, linkUp: 7, pace: 3, strength: 7, offBall: 6, composure: 8 } },
  { name: "Boubacar Kamara", short: "Kamara", team: 'AVL', nation: 'FRA', number: 8, height: 72, weight: 150, age: 26, foot: 'right', skin: '#ae7254', espn: 250936, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 3, heading: 6, dribbling: 6, firstTouch: 7, linkUp: 5, pace: 0, strength: 6, offBall: 2, composure: 3 } },
  { name: "João Gomes", short: "Gomes", team: 'AVL', nation: 'BRA', number: 35, height: 69, weight: 161, age: 25, foot: 'right', skin: '#ae7359', espn: 301524, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 5, heading: 3, dribbling: 9, firstTouch: 9, linkUp: 5, pace: 1, strength: 5, offBall: 3, composure: 6 } },
  { name: "Ibrahim Mbaye", short: "Mbaye", team: 'AVL', nation: 'SEN', number: 19, height: 73, weight: 141, age: 18, foot: 'right', skin: '#97644d', espn: 388522, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 2, heading: 6, dribbling: 6, firstTouch: 5, linkUp: 7, pace: 8, strength: 2, offBall: 5, composure: 3 } },

  // ─── BOU ────────────────────────────────────────────────────────────
  { name: "Evanilson", short: "Evanilson", team: 'BOU', nation: 'BRA', number: 9, height: 72, weight: 174, age: 27, foot: 'both', skin: '#a17662', espn: 102368, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 7, heading: 8, dribbling: 5, firstTouch: 5, linkUp: 3, pace: 7, strength: 9, offBall: 9, composure: 7 } },
  { name: "Rayan", short: "Rayan", team: 'BOU', nation: 'BRA', number: 37, height: 74, weight: 192, age: 20, foot: 'left', skin: '#8b5b48', espn: 357719, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 8, heading: 10, dribbling: 3, firstTouch: 3, linkUp: 4, pace: 10, strength: 9, offBall: 7, composure: 6 } },
  { name: "Alex Scott", short: "Scott", team: 'BOU', nation: 'ENG', number: 8, height: 70, weight: 150, age: 23, foot: 'right', skin: '#a67f6b', espn: 314790, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 4, heading: 4, dribbling: 7, firstTouch: 8, linkUp: 5, pace: 1, strength: 6, offBall: 4, composure: 5 } },
  { name: "Marcus Tavernier", short: "Tavernier", team: 'BOU', nation: 'ENG', number: 16, height: 70, weight: 152, age: 27, foot: 'left', skin: '#a2735e', espn: 243364, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 6, heading: 3, dribbling: 6, firstTouch: 5, linkUp: 7, pace: 6, strength: 2, offBall: 7, composure: 9 } },
  { name: "Tyler Adams", short: "Adams", team: 'BOU', nation: 'USA', number: 12, height: 69, weight: 159, age: 27, foot: 'right', skin: '#a16d5a', espn: 222776, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 7, shotPower: 4, heading: 5, dribbling: 4, firstTouch: 7, linkUp: 4, pace: 2, strength: 3, offBall: 2, composure: 6 } },

  // ─── BRE ────────────────────────────────────────────────────────────
  { name: "Igor Thiago", short: "Igor Thiago", team: 'BRE', nation: 'BRA', number: 9, height: 75, weight: 207, age: 25, foot: 'right', skin: '#aa715a', espn: 301894, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 9, heading: 9, dribbling: 6, firstTouch: 4, linkUp: 2, pace: 10, strength: 10, offBall: 9, composure: 8 } },
  { name: "Mamadou Sangare", short: "Sangare", team: 'BRE', nation: 'MLI', number: 18, height: 71, weight: 159, age: 24, foot: 'left', skin: '#754b3a', espn: 228547, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 4, heading: 5, dribbling: 8, firstTouch: 7, linkUp: 6, pace: 1, strength: 6, offBall: 3, composure: 5 } },
  { name: "Kevin Schade", short: "Schade", team: 'BRE', nation: 'GER', number: 7, height: 72, weight: 161, age: 24, foot: 'right', skin: '#9f674d', espn: 310958, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 6, heading: 9, dribbling: 2, firstTouch: 1, linkUp: 2, pace: 10, strength: 6, offBall: 8, composure: 0 } },
  { name: "Yehor Yarmoliuk", short: "Yarmoliuk", team: 'BRE', nation: 'UKR', number: 6, height: 71, weight: 159, age: 22, foot: 'right', skin: '#99736a', espn: 342029, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 5, heading: 5, dribbling: 3, firstTouch: 5, linkUp: 4, pace: 1, strength: 4, offBall: 3, composure: 5 } },
  { name: "Dango Ouattara", short: "Ouattara", team: 'BRE', nation: 'BFA', number: 11, height: 70, weight: 157, age: 24, foot: 'left', skin: '#6b493d', espn: 315530, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 5, heading: 6, dribbling: 4, firstTouch: 3, linkUp: 4, pace: 9, strength: 5, offBall: 7, composure: 7 } },

  // ─── BHA ────────────────────────────────────────────────────────────
  { name: "Charalambos Kostoulas", short: "Kostoulas", team: 'BHA', nation: 'GRE', number: 19, height: 73, weight: null, age: 19, foot: 'right', skin: '#a8775a', espn: 387655, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 6, heading: 7, dribbling: 7, firstTouch: 4, linkUp: 5, pace: 5, strength: 5, offBall: 7, composure: 3 } },
  { name: "Diego Gómez", short: "Gómez", team: 'BHA', nation: 'PAR', number: 25, height: 73, weight: 170, age: 23, foot: 'right', skin: '#a56f53', espn: 192278, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 7, heading: 8, dribbling: 5, firstTouch: 5, linkUp: 4, pace: 5, strength: 6, offBall: 6, composure: 4 } },
  { name: "Yasin Ayari", short: "Ayari", team: 'BHA', nation: 'SWE', number: 26, height: 68, weight: 150, age: 23, foot: 'right', skin: '#ac8067', espn: 304242, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 8, heading: 1, dribbling: 4, firstTouch: 5, linkUp: 5, pace: 1, strength: 2, offBall: 5, composure: 8 } },
  { name: "Yankuba Minteh", short: "Minteh", team: 'BHA', nation: 'GAM', number: 11, height: 71, weight: 141, age: 22, foot: 'left', skin: '#644536', espn: 348787, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 2, heading: 5, dribbling: 11, firstTouch: 8, linkUp: 6, pace: 11, strength: 2, offBall: 5, composure: 7 } },
  { name: "Jack Hinshelwood", short: "Hinshelwood", team: 'BHA', nation: 'ENG', number: 8, height: 71, weight: 168, age: 21, foot: 'right', skin: '#ac8673', espn: 328011, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 6, heading: 7, dribbling: 2, firstTouch: 4, linkUp: 5, pace: 1, strength: 7, offBall: 7, composure: 4 } },

  // ─── CHE ────────────────────────────────────────────────────────────
  { name: "João Pedro", short: "João Pedro", team: 'CHE', nation: 'BRA', number: 9, height: 72, weight: 152, age: 25, foot: 'right', skin: '#b77a60', espn: 284960, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 4, heading: 9, dribbling: 8, firstTouch: 5, linkUp: 4, pace: 3, strength: 6, offBall: 10, composure: 8 } },
  { name: "Morgan Rogers", short: "Rogers", team: 'CHE', nation: 'ENG', number: 17, height: 74, weight: 174, age: 24, foot: 'right', skin: '#a67f6b', espn: 265653, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 9, shotPower: 9, heading: 6, dribbling: 6, firstTouch: 5, linkUp: 6, pace: 7, strength: 8, offBall: 7, composure: 7 } },
  { name: "Cole Palmer", short: "Palmer", team: 'CHE', nation: 'ENG', number: 10, height: 74, weight: 168, age: 24, foot: 'left', skin: '#b0887e', espn: 296395, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 9, shotPower: 7, heading: 6, dribbling: 5, firstTouch: 5, linkUp: 7, pace: 5, strength: 7, offBall: 9, composure: 8 } },
  { name: "Moisés Caicedo", short: "Caicedo", team: 'CHE', nation: 'ECU', number: 25, height: 70, weight: 161, age: 25, foot: 'right', skin: '#7d4d39', espn: 289877, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 5, heading: 4, dribbling: 5, firstTouch: 8, linkUp: 6, pace: 4, strength: 7, offBall: 3, composure: 5 } },
  { name: "Pedro Neto", short: "Neto", team: 'CHE', nation: 'POR', number: 7, height: 69, weight: 172, age: 26, foot: 'left', skin: '#b0856f', espn: 256115, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 7, heading: 3, dribbling: 8, firstTouch: 8, linkUp: 8, pace: 10, strength: 5, offBall: 6, composure: 5 } },

  // ─── COV ────────────────────────────────────────────────────────────
  { name: "Taiwo Awoniyi", short: "Awoniyi", team: 'COV', nation: 'NGA', number: 14, height: 72, weight: 183, age: 29, foot: 'right', skin: '#94604e', espn: 194686, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 6, heading: 7, dribbling: 8, firstTouch: 6, linkUp: 4, pace: 1, strength: 6, offBall: 7, composure: 4 } },
  { name: "Jack Rudoni", short: "Rudoni", team: 'COV', nation: 'ENG', number: 5, height: 73, weight: 170, age: 25, foot: 'left', skin: '#ac8673', espn: 286967, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 7, heading: 5, dribbling: 4, firstTouch: 3, linkUp: 6, pace: 1, strength: 5, offBall: 4, composure: 6 } },
  { name: "Caleb Yirenkyi", short: "Yirenkyi", team: 'COV', nation: 'GHA', number: 8, height: 72, weight: 170, age: 20, foot: 'right', skin: '#825b4f', espn: 387659, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 4, heading: 4, dribbling: 3, firstTouch: 4, linkUp: 5, pace: 2, strength: 5, offBall: 0, composure: 2 } },
  { name: "Loum Tchaouna", short: "Tchaouna", team: 'COV', nation: 'FRA', number: 17, height: 71, weight: 150, age: 23, foot: 'left', skin: '#6d4639', espn: 324541, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 4, heading: 5, dribbling: 3, firstTouch: 4, linkUp: 4, pace: 10, strength: 4, offBall: 5, composure: 4 } },
  { name: "Sidiki Cherif", short: "Cherif", team: 'COV', nation: 'FRA', number: 49, height: 73, weight: 163, age: 19, foot: 'right', skin: '#644536', espn: 366817, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 8, heading: 4, dribbling: 4, firstTouch: 2, linkUp: 2, pace: 8, strength: 5, offBall: 5, composure: 2 } },

  // ─── CRY ────────────────────────────────────────────────────────────
  { name: "Jørgen Strand Larsen", short: "Strand Larsen", team: 'CRY', nation: 'NOR', number: 22, height: 76, weight: 172, age: 26, foot: 'right', skin: '#bd8c75', espn: 252747, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 6, heading: 9, dribbling: 3, firstTouch: 1, linkUp: 1, pace: 2, strength: 7, offBall: 6, composure: 2 } },
  { name: "Adam Wharton", short: "Wharton", team: 'CRY', nation: 'ENG', number: 20, height: 72, weight: 170, age: 22, foot: 'left', skin: '#c89f90', espn: 333419, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 6, heading: 6, dribbling: 5, firstTouch: 6, linkUp: 8, pace: 0, strength: 8, offBall: 2, composure: 5 } },
  { name: "Yéremy Pino", short: "Pino", team: 'CRY', nation: 'ESP', number: 10, height: 68, weight: 141, age: 24, foot: 'right', skin: '#b28376', espn: 297370, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 7, heading: 2, dribbling: 4, firstTouch: 5, linkUp: 8, pace: 4, strength: 2, offBall: 5, composure: 4 } },
  { name: "Daichi Kamada", short: "Kamada", team: 'CRY', nation: 'JPN', number: 18, height: 71, weight: 159, age: 30, foot: 'right', skin: '#a07465', espn: 219362, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 4, heading: 4, dribbling: 5, firstTouch: 6, linkUp: 6, pace: 1, strength: 6, offBall: 3, composure: 8 } },
  { name: "Ismaïla Sarr", short: "Sarr", team: 'CRY', nation: 'SEN', number: 7, height: 73, weight: 168, age: 28, foot: 'right', skin: '#785c4a', espn: 241012, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 6, heading: 7, dribbling: 3, firstTouch: 3, linkUp: 2, pace: 9, strength: 7, offBall: 7, composure: 10 } },

  // ─── EVE ────────────────────────────────────────────────────────────
  { name: "Thierno Barry", short: "Barry", team: 'EVE', nation: 'FRA', number: 11, height: 77, weight: 181, age: 24, foot: 'right', skin: '#724635', espn: 301166, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 6, heading: 11, dribbling: 4, firstTouch: 2, linkUp: 1, pace: 10, strength: 9, offBall: 9, composure: 4 } },
  { name: "James Garner", short: "Garner", team: 'EVE', nation: 'ENG', number: 37, height: 73, weight: 172, age: 25, foot: 'right', skin: '#a67f6b', espn: 276220, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 7, heading: 6, dribbling: 4, firstTouch: 8, linkUp: 8, pace: 9, strength: 7, offBall: 2, composure: 7 } },
  { name: "Kiernan Dewsbury-Hall", short: "Dewsbury-Hall", team: 'EVE', nation: 'ENG', number: 8, height: 70, weight: 174, age: 28, foot: 'left', skin: '#a07465', espn: 252389, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 8, shotPower: 6, heading: 4, dribbling: 7, firstTouch: 6, linkUp: 8, pace: 2, strength: 7, offBall: 5, composure: 8 } },
  { name: "Harrison Armstrong", short: "Armstrong", team: 'EVE', nation: 'ENG', number: 45, height: 73, weight: 152, age: 19, foot: 'right', skin: '#9b6e57', espn: 378458, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 2, heading: 5, dribbling: 7, firstTouch: 7, linkUp: 5, pace: 3, strength: 4, offBall: 4, composure: 3 } },
  { name: "Tyrique George", short: "George", team: 'EVE', nation: 'ENG', number: 19, height: 71, weight: 163, age: 20, foot: 'right', skin: '#765144', espn: 368864, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 4, heading: 5, dribbling: 9, firstTouch: 7, linkUp: 6, pace: 7, strength: 5, offBall: 5, composure: 3 } },

  // ─── FUL ────────────────────────────────────────────────────────────
  { name: "Gonzalo García", short: "García", team: 'FUL', nation: 'ESP', number: 7, height: 72, weight: 161, age: 22, foot: 'both', skin: '#876054', espn: 87297, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 3, shotPower: 4, heading: 9, dribbling: 2, firstTouch: 3, linkUp: 4, pace: 10, strength: 3, offBall: 8, composure: 2 } },
  { name: "Josh King", short: "King", team: 'FUL', nation: 'ENG', number: 24, height: 74, weight: 161, age: 19, foot: 'right', skin: '#b57852', espn: 409541, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 4, heading: 6, dribbling: 5, firstTouch: 5, linkUp: 5, pace: 6, strength: 6, offBall: 6, composure: 3 } },
  { name: "Sander Berge", short: "Berge", team: 'FUL', nation: 'NOR', number: 16, height: 77, weight: 212, age: 28, foot: 'right', skin: '#af7d67', espn: 218998, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 8, heading: 8, dribbling: 3, firstTouch: 7, linkUp: 6, pace: 1, strength: 10, offBall: 3, composure: 4 } },
  { name: "Oscar Bobb", short: "Bobb", team: 'FUL', nation: 'NOR', number: 14, height: 69, weight: 159, age: 23, foot: 'left', skin: '#93685d', espn: 307111, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 3, shotPower: 3, heading: 3, dribbling: 9, firstTouch: 8, linkUp: 7, pace: 10, strength: 5, offBall: 6, composure: 4 } },
  { name: "Alex Iwobi", short: "Iwobi", team: 'FUL', nation: 'NGA', number: 17, height: 71, weight: 163, age: 30, foot: 'right', skin: '#9a5c42', espn: 175063, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 5, heading: 4, dribbling: 5, firstTouch: 8, linkUp: 9, pace: 1, strength: 5, offBall: 5, composure: 8 } },

  // ─── HUL ────────────────────────────────────────────────────────────
  { name: "Oliver McBurnie", short: "McBurnie", team: 'HUL', nation: 'SCO', number: 9, height: 74, weight: 172, age: 30, foot: 'right', skin: '#c4856a', espn: 193010, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 9, heading: 7, dribbling: 2, firstTouch: 1, linkUp: 1, pace: 0, strength: 7, offBall: 5, composure: 6 } },
  { name: "Mohamed Belloumi", short: "Belloumi", team: 'HUL', nation: 'ALG', number: 10, height: 69, weight: 146, age: 24, foot: 'left', skin: '#a7725e', espn: 320417, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 4, heading: 2, dribbling: 10, firstTouch: 7, linkUp: 4, pace: 9, strength: 3, offBall: 5, composure: 5 } },
  { name: "Tim Iroegbunam", short: "Iroegbunam", team: 'HUL', nation: 'ENG', number: 42, height: 72, weight: 152, age: 23, foot: 'right', skin: '#7e5b54', espn: 310599, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 4, heading: 5, dribbling: 5, firstTouch: 4, linkUp: 4, pace: 10, strength: 4, offBall: 4, composure: 6 } },
  { name: "Mohamed-Ali Cho", short: "Cho", team: 'HUL', nation: 'FRA', number: 50, height: 71, weight: 146, age: 22, foot: 'left', skin: '#876054', espn: 306557, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 4, shotPower: 2, heading: 6, dribbling: 4, firstTouch: 3, linkUp: 5, pace: 7, strength: 3, offBall: 5, composure: 1 } },
  { name: "Regan Slater", short: "Slater", team: 'HUL', nation: 'ENG', number: 27, height: 68, weight: 141, age: 27, foot: 'right', skin: '#a87761', espn: 249851, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 0, heading: 2, dribbling: 5, firstTouch: 5, linkUp: 1, pace: 0, strength: 2, offBall: 1, composure: 4 } },

  // ─── IPS ────────────────────────────────────────────────────────────
  { name: "Emersonn", short: "Emersonn", team: 'IPS', nation: 'BRA', number: 19, height: 73, weight: 159, age: 22, foot: 'right', skin: '#a7654a', espn: 322654, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 3, shotPower: 3, heading: 9, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 7, strength: 5, offBall: 7, composure: 3 } },
  { name: "Julio Enciso", short: "Enciso", team: 'IPS', nation: 'PAR', number: 10, height: 68, weight: 139, age: 22, foot: 'right', skin: '#b0887e', espn: 20975, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 2, shotPower: 8, heading: 1, dribbling: 10, firstTouch: 6, linkUp: 8, pace: 8, strength: 1, offBall: 6, composure: 5 } },
  { name: "Exequiel Palacios", short: "Palacios", team: 'IPS', nation: 'ARG', number: 25, height: 69, weight: 159, age: 28, foot: 'right', skin: '#95705f', espn: 228393, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 4, heading: 4, dribbling: 3, firstTouch: 6, linkUp: 7, pace: 1, strength: 5, offBall: 3, composure: 5 } },
  { name: "Florentino", short: "Florentino", team: 'IPS', nation: 'POR', number: 12, height: 72, weight: 161, age: 27, foot: 'right', skin: '#875247', espn: 256607, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 5, heading: 5, dribbling: 2, firstTouch: 5, linkUp: 4, pace: 0, strength: 4, offBall: 3, composure: 4 } },
  { name: "Fatawu Issahaku", short: "Issahaku", team: 'IPS', nation: 'GHA', number: 7, height: 70, weight: 161, age: 22, foot: 'left', skin: '#7f5749', espn: 318680, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 4, heading: 2, dribbling: 9, firstTouch: 3, linkUp: 3, pace: 5, strength: 4, offBall: 2, composure: 2 } },

  // ─── LEE ────────────────────────────────────────────────────────────
  { name: "Dominic Calvert-Lewin", short: "Calvert-Lewin", team: 'LEE', nation: 'ENG', number: 9, height: 74, weight: 157, age: 29, foot: 'right', skin: '#bc7e69', espn: 197717, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 4, heading: 10, dribbling: 1, firstTouch: 1, linkUp: 1, pace: 9, strength: 5, offBall: 8, composure: 8 } },
  { name: "Ethan Ampadu", short: "Ampadu", team: 'LEE', nation: 'WAL', number: 4, height: 72, weight: 172, age: 26, foot: 'right', skin: '#b38473', espn: 241317, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 10, heading: 5, dribbling: 7, firstTouch: 10, linkUp: 4, pace: 2, strength: 6, offBall: 2, composure: 6 } },
  { name: "Anton Stach", short: "Stach", team: 'LEE', nation: 'GER', number: 18, height: 76, weight: 190, age: 27, foot: 'right', skin: '#b0887e', espn: 304802, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 10, heading: 9, dribbling: 5, firstTouch: 6, linkUp: 7, pace: 5, strength: 10, offBall: 5, composure: 6 } },
  { name: "Noah Okafor", short: "Okafor", team: 'LEE', nation: 'SUI', number: 19, height: 73, weight: 185, age: 26, foot: 'right', skin: '#b5765c', espn: 270641, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 9, shotPower: 7, heading: 6, dribbling: 10, firstTouch: 7, linkUp: 4, pace: 8, strength: 9, offBall: 6, composure: 4 } },
  { name: "Harry Wilson", short: "Wilson", team: 'LEE', nation: 'WAL', number: 10, height: 68, weight: 139, age: 29, foot: 'left', skin: '#c58e72', espn: 194801, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 9, shotPower: 5, heading: 3, dribbling: 6, firstTouch: 6, linkUp: 7, pace: 6, strength: 1, offBall: 6, composure: 9 } },

  // ─── LIV ────────────────────────────────────────────────────────────
  { name: "Alexander Isak", short: "Isak", team: 'LIV', nation: 'SWE', number: 9, height: 75, weight: 161, age: 27, foot: 'right', skin: '#94604e', espn: 235662, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 4, heading: 8, dribbling: 6, firstTouch: 4, linkUp: 3, pace: 9, strength: 6, offBall: 9, composure: 7 } },
  { name: "Dominik Szoboszlai", short: "Szoboszlai", team: 'LIV', nation: 'HUN', number: 8, height: 73, weight: 161, age: 26, foot: 'right', skin: '#af7d67', espn: 257206, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 9, heading: 5, dribbling: 6, firstTouch: 8, linkUp: 9, pace: 10, strength: 3, offBall: 4, composure: 8 } },
  { name: "Florian Wirtz", short: "Wirtz", team: 'LIV', nation: 'GER', number: 7, height: 69, weight: 161, age: 23, foot: 'right', skin: '#b0887e', espn: 303748, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 6, heading: 2, dribbling: 9, firstTouch: 10, linkUp: 10, pace: 5, strength: 3, offBall: 7, composure: 8 } },
  { name: "Bradley Barcola", short: "Barcola", team: 'LIV', nation: 'FRA', number: 29, height: 72, weight: 161, age: 24, foot: 'right', skin: '#97644d', espn: 328238, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 4, heading: 6, dribbling: 8, firstTouch: 6, linkUp: 7, pace: 9, strength: 4, offBall: 9, composure: 7 } },
  { name: "Alexis Mac Allister", short: "Mac Allister", team: 'LIV', nation: 'ARG', number: 10, height: 69, weight: 163, age: 27, foot: 'right', skin: '#a67f6b', espn: 249299, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 6, heading: 3, dribbling: 4, firstTouch: 7, linkUp: 6, pace: 0, strength: 5, offBall: 5, composure: 7 } },

  // ─── MCI ────────────────────────────────────────────────────────────
  { name: "Erling Haaland", short: "Haaland", team: 'MCI', nation: 'NOR', number: 9, height: 77, weight: 205, age: 26, foot: 'left', skin: '#c7927c', espn: 253989, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 11, shotPower: 10, heading: 11, dribbling: 5, firstTouch: 5, linkUp: 2, pace: 11, strength: 11, offBall: 11, composure: 11 } },
  { name: "Phil Foden", short: "Foden", team: 'MCI', nation: 'ENG', number: 47, height: 67, weight: 139, age: 26, foot: 'left', skin: '#ae8071', espn: 250787, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 2, heading: 4, dribbling: 6, firstTouch: 7, linkUp: 10, pace: 5, strength: 2, offBall: 8, composure: 8 } },
  { name: "Elliot Anderson", short: "Anderson", team: 'MCI', nation: 'ENG', number: 5, height: 70, weight: 150, age: 24, foot: 'right', skin: '#c38f80', espn: 238472, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 5, heading: 4, dribbling: 9, firstTouch: 8, linkUp: 8, pace: 1, strength: 7, offBall: 3, composure: 7 } },
  { name: "Enzo Fernández", short: "Fernández", team: 'MCI', nation: 'ARG', number: 17, height: 70, weight: 161, age: 25, foot: 'right', skin: '#bb866f', espn: 285450, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 9, heading: 5, dribbling: 1, firstTouch: 5, linkUp: 9, pace: 1, strength: 5, offBall: 6, composure: 10 } },
  { name: "Iliman Ndiaye", short: "Ndiaye", team: 'MCI', nation: 'SEN', number: 7, height: 71, weight: 172, age: 26, foot: 'right', skin: '#a67058', espn: 268641, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 5, heading: 4, dribbling: 11, firstTouch: 8, linkUp: 6, pace: 7, strength: 7, offBall: 6, composure: 9 } },

  // ─── MUN ────────────────────────────────────────────────────────────
  { name: "Matheus Cunha", short: "Cunha", team: 'MUN', nation: 'BRA', number: 10, height: 72, weight: 168, age: 27, foot: 'right', skin: '#a46f5c', espn: 259902, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 8, shotPower: 8, heading: 4, dribbling: 8, firstTouch: 6, linkUp: 6, pace: 9, strength: 6, offBall: 8, composure: 9 } },
  { name: "Bryan Mbeumo", short: "Mbeumo", team: 'MUN', nation: 'CMR', number: 19, height: 68, weight: 139, age: 27, foot: 'left', skin: '#b07a65', espn: 271170, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 8, heading: 1, dribbling: 3, firstTouch: 3, linkUp: 7, pace: 11, strength: 0, offBall: 9, composure: 8 } },
  { name: "Kobbie Mainoo", short: "Mainoo", team: 'MUN', nation: 'ENG', number: 37, height: 72, weight: 159, age: 21, foot: 'right', skin: '#6b493d', espn: 328466, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 5, heading: 5, dribbling: 8, firstTouch: 9, linkUp: 7, pace: 1, strength: 5, offBall: 3, composure: 5 } },
  { name: "Bruno Fernandes", short: "Fernandes", team: 'MUN', nation: 'POR', number: 8, height: 72, weight: 139, age: 32, foot: 'right', skin: '#a67f6b', espn: 124091, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 8, heading: 4, dribbling: 2, firstTouch: 6, linkUp: 11, pace: 1, strength: 1, offBall: 7, composure: 10 } },
  { name: "Youri Tielemans", short: "Tielemans", team: 'MUN', nation: 'BEL', number: 18, height: 69, weight: 159, age: 29, foot: 'right', skin: '#a26e57', espn: 193297, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 6, heading: 3, dribbling: 4, firstTouch: 7, linkUp: 8, pace: 1, strength: 6, offBall: 4, composure: 8 } },

  // ─── NEW ────────────────────────────────────────────────────────────
  { name: "Yoane Wissa", short: "Wissa", team: 'NEW', nation: 'COD', number: 9, height: 69, weight: 163, age: 30, foot: 'right', skin: '#6c4943', espn: 224077, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 4, heading: 6, dribbling: 3, firstTouch: 2, linkUp: 4, pace: 3, strength: 5, offBall: 8, composure: 3 } },
  { name: "Nico González", short: "González", team: 'NEW', nation: 'ESP', number: 6, height: 74, weight: 192, age: 24, foot: 'right', skin: '#a07465', espn: 323986, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 8, heading: 7, dribbling: 8, firstTouch: 10, linkUp: 6, pace: 5, strength: 9, offBall: 3, composure: 7 } },
  { name: "Matias Fernandez-Pardo", short: "Fernandez-Pardo", team: 'NEW', nation: 'BEL', number: 20, height: 72, weight: 190, age: 21, foot: 'right', skin: '#b08073', espn: 359651, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 8, heading: 4, dribbling: 7, firstTouch: 4, linkUp: 5, pace: 9, strength: 8, offBall: 6, composure: 3 } },
  { name: "Bazoumana Touré", short: "Touré", team: 'NEW', nation: 'CIV', number: 17, height: 70, weight: 152, age: 20, foot: 'left', skin: '#785c4a', espn: 359108, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 3, heading: 4, dribbling: 8, firstTouch: 6, linkUp: 8, pace: 8, strength: 3, offBall: 5, composure: 5 } },
  { name: "Harvey Barnes", short: "Barnes", team: 'NEW', nation: 'ENG', number: 11, height: 69, weight: 146, age: 28, foot: 'right', skin: '#b68976', espn: 243386, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 7, shotPower: 2, heading: 3, dribbling: 2, firstTouch: 3, linkUp: 5, pace: 11, strength: 2, offBall: 8, composure: 7 } },

  // ─── NFO ────────────────────────────────────────────────────────────
  { name: "Liam Delap", short: "Delap", team: 'NFO', nation: 'ENG', number: 19, height: 73, weight: 159, age: 23, foot: 'right', skin: '#ad8271', espn: 307114, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 6, heading: 6, dribbling: 8, firstTouch: 4, linkUp: 2, pace: 2, strength: 4, offBall: 8, composure: 3 } },
  { name: "Morgan Gibbs-White", short: "Gibbs-White", team: 'NFO', nation: 'ENG', number: 10, height: 67, weight: 146, age: 26, foot: 'right', skin: '#b57c66', espn: 243396, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 8, shotPower: 5, heading: 3, dribbling: 6, firstTouch: 6, linkUp: 7, pace: 2, strength: 2, offBall: 7, composure: 9 } },
  { name: "Dan Ndoye", short: "Ndoye", team: 'NFO', nation: 'SUI', number: 14, height: 72, weight: 159, age: 26, foot: 'right', skin: '#b57c66', espn: 275842, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 4, heading: 7, dribbling: 5, firstTouch: 3, linkUp: 5, pace: 10, strength: 4, offBall: 6, composure: 5 } },
  { name: "James McAtee", short: "McAtee", team: 'NFO', nation: 'ENG', number: 24, height: 71, weight: 159, age: 24, foot: 'left', skin: '#a67f6b', espn: 298518, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 4, heading: 5, dribbling: 6, firstTouch: 6, linkUp: 7, pace: 0, strength: 6, offBall: 4, composure: 6 } },
  { name: "Xaver Schlager", short: "Schlager", team: 'NFO', nation: 'AUT', number: 21, height: 69, weight: 172, age: 29, foot: 'left', skin: '#c89f90', espn: 238886, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 7, heading: 3, dribbling: 9, firstTouch: 9, linkUp: 5, pace: 1, strength: 6, offBall: 3, composure: 6 } },

  // ─── SUN ────────────────────────────────────────────────────────────
  { name: "Brian Brobbey", short: "Brobbey", team: 'SUN', nation: 'NED', number: 9, height: 71, weight: 174, age: 24, foot: 'right', skin: '#5d4638', espn: 282229, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 6, heading: 9, dribbling: 0, firstTouch: 1, linkUp: 2, pace: 9, strength: 9, offBall: 8, composure: 7 } },
  { name: "Noah Sadiki", short: "Sadiki", team: 'SUN', nation: 'COD', number: 27, height: 68, weight: 161, age: 21, foot: 'right', skin: '#996651', espn: 340240, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 5, heading: 2, dribbling: 8, firstTouch: 9, linkUp: 4, pace: 1, strength: 5, offBall: 3, composure: 1 } },
  { name: "Enzo Le Fée", short: "Le Fée", team: 'SUN', nation: 'FRA', number: 28, height: 67, weight: 139, age: 26, foot: 'right', skin: '#c6967e', espn: 288340, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 2, heading: 1, dribbling: 2, firstTouch: 4, linkUp: 8, pace: 3, strength: 2, offBall: 4, composure: 7 } },
  { name: "Granit Xhaka", short: "Xhaka", team: 'SUN', nation: 'SUI', number: 34, height: 73, weight: 174, age: 34, foot: 'left', skin: '#c89477', espn: 149981, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 9, heading: 6, dribbling: 4, firstTouch: 8, linkUp: 7, pace: 0, strength: 9, offBall: 2, composure: 8 } },
  { name: "Habib Diarra", short: "Diarra", team: 'SUN', nation: 'SEN', number: 19, height: 70, weight: 161, age: 22, foot: 'right', skin: '#825b4f', espn: 324991, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 5, heading: 4, dribbling: 2, firstTouch: 3, linkUp: 4, pace: 5, strength: 5, offBall: 5, composure: 7 } },

  // ─── TOT ────────────────────────────────────────────────────────────
  { name: "Dominic Solanke", short: "Solanke", team: 'TOT', nation: 'ENG', number: 19, height: 74, weight: 174, age: 29, foot: 'right', skin: '#b67d5e', espn: 194115, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 6, heading: 8, dribbling: 4, firstTouch: 3, linkUp: 4, pace: 1, strength: 6, offBall: 8, composure: 6 } },
  { name: "Sandro Tonali", short: "Tonali", team: 'TOT', nation: 'ITA', number: 16, height: 71, weight: 172, age: 26, foot: 'right', skin: '#ba7f76', espn: 261047, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 7, heading: 5, dribbling: 7, firstTouch: 9, linkUp: 7, pace: 11, strength: 7, offBall: 3, composure: 6 } },
  { name: "Mateus Fernandes", short: "Fernandes", team: 'TOT', nation: 'POR', number: 18, height: 70, weight: 159, age: 22, foot: 'right', skin: '#95705f', espn: 346820, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 4, heading: 6, dribbling: 7, firstTouch: 9, linkUp: 7, pace: 1, strength: 4, offBall: 3, composure: 5 } },
  { name: "Archie Gray", short: "Gray", team: 'TOT', nation: 'ENG', number: 14, height: 74, weight: 152, age: 20, foot: 'right', skin: '#a67f6b', espn: 328050, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 4, heading: 8, dribbling: 5, firstTouch: 7, linkUp: 4, pace: 1, strength: 6, offBall: 4, composure: 3 } },
  { name: "Omar Marmoush", short: "Marmoush", team: 'TOT', nation: 'EGY', number: 22, height: 71, weight: 174, age: 27, foot: 'right', skin: '#ae8071', espn: 303745, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 8, heading: 3, dribbling: 8, firstTouch: 5, linkUp: 6, pace: 10, strength: 5, offBall: 7, composure: 6 } },

  // ─── ALA ────────────────────────────────────────────────────────────
  { name: "Lucas Boyé", short: "Boyé", team: 'ALA', nation: 'ARG', number: 15, height: 70, weight: 179, age: 30, foot: 'right', skin: '#a46f5c', espn: 207236, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 6, heading: 8, dribbling: 6, firstTouch: 3, linkUp: 3, pace: 7, strength: 6, offBall: 7, composure: 9 } },
  { name: "Antonio Blanco", short: "Blanco", team: 'ALA', nation: 'ESP', number: 8, height: 69, weight: 152, age: 26, foot: 'right', skin: '#a87a61', espn: 265997, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 5, heading: 3, dribbling: 8, firstTouch: 10, linkUp: 5, pace: 4, strength: 3, offBall: 2, composure: 6 } },
  { name: "Toni Martínez", short: "Toni Martínez", team: 'ALA', nation: 'ESP', number: 11, height: 74, weight: 183, age: 29, foot: 'right', skin: '#b07962', espn: 181757, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 7, heading: 10, dribbling: 3, firstTouch: 1, linkUp: 1, pace: 6, strength: 10, offBall: 8, composure: 8 } },
  { name: "Pablo Ibáñez", short: "Ibáñez", team: 'ALA', nation: 'ESP', number: 19, height: 70, weight: 161, age: 28, foot: 'right', skin: '#d19781', espn: 106326, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 4, heading: 5, dribbling: 7, firstTouch: 6, linkUp: 3, pace: 4, strength: 6, offBall: 4, composure: 7 } },
  { name: "Abde Rebbach", short: "Rebbach", team: 'ALA', nation: 'ALG', number: 21, height: 69, weight: 150, age: 28, foot: 'right', skin: '#a87a61', espn: 345991, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 3, heading: 4, dribbling: 5, firstTouch: 6, linkUp: 6, pace: 4, strength: 4, offBall: 4, composure: 5 } },

  // ─── ATH ────────────────────────────────────────────────────────────
  { name: "Iñaki Williams", short: "Iñaki Williams", team: 'ATH', nation: 'GHA', number: 9, height: 73, weight: 179, age: 32, foot: 'right', skin: '#885c4d', espn: 214412, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 2, shotPower: 6, heading: 6, dribbling: 1, firstTouch: 1, linkUp: 4, pace: 8, strength: 8, offBall: 7, composure: 7 } },
  { name: "Nico Williams", short: "Williams", team: 'ATH', nation: 'ESP', number: 10, height: 71, weight: 148, age: 24, foot: 'right', skin: '#764f3f', espn: 312146, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 1, heading: 6, dribbling: 10, firstTouch: 9, linkUp: 8, pace: 9, strength: 2, offBall: 7, composure: 4 } },
  { name: "Oihan Sancet", short: "Sancet", team: 'ATH', nation: 'ESP', number: 8, height: 74, weight: 161, age: 26, foot: 'right', skin: '#b69384', espn: 291616, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 3, heading: 7, dribbling: 7, firstTouch: 4, linkUp: 5, pace: 5, strength: 6, offBall: 7, composure: 4 } },
  { name: "Mikel Jauregizar", short: "Jauregizar", team: 'ATH', nation: 'ESP', number: 18, height: 70, weight: 161, age: 22, foot: 'right', skin: '#a67f6b', espn: 377792, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 4, heading: 5, dribbling: 2, firstTouch: 4, linkUp: 4, pace: 4, strength: 5, offBall: 3, composure: 5 } },
  { name: "Álex Berenguer", short: "Berenguer", team: 'ATH', nation: 'ESP', number: 7, height: 69, weight: 161, age: 31, foot: 'right', skin: '#bc8f79', espn: 209579, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 8, heading: 3, dribbling: 5, firstTouch: 5, linkUp: 8, pace: 3, strength: 5, offBall: 6, composure: 8 } },

  // ─── ATM ────────────────────────────────────────────────────────────
  { name: "Jonathan David", short: "David", team: 'ATM', nation: 'CAN', number: 15, height: 70, weight: 179, age: 26, foot: 'both', skin: '#785c4a', espn: 273499, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 7, heading: 4, dribbling: 1, firstTouch: 2, linkUp: 6, pace: 6, strength: 7, offBall: 9, composure: 7 } },
  { name: "Julián Álvarez", short: "Julián", team: 'ATM', nation: 'ARG', number: 19, height: 67, weight: 157, age: 26, foot: 'right', skin: '#876054', espn: 277206, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 8, heading: 2, dribbling: 8, firstTouch: 7, linkUp: 9, pace: 6, strength: 4, offBall: 8, composure: 9 } },
  { name: "Giuliano Simeone", short: "Simeone", team: 'ATM', nation: 'ARG', number: 20, height: 68, weight: 163, age: 23, foot: 'right', skin: '#a96d5a', espn: 323838, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 5, heading: 5, dribbling: 5, firstTouch: 6, linkUp: 8, pace: 5, strength: 6, offBall: 5, composure: 4 } },
  { name: "Pablo Barrios", short: "Barrios", team: 'ATM', nation: 'ESP', number: 8, height: 72, weight: 163, age: 23, foot: 'right', skin: '#a16d5a', espn: 336634, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 7, heading: 6, dribbling: 9, firstTouch: 10, linkUp: 7, pace: 6, strength: 7, offBall: 4, composure: 4 } },
  { name: "Álex Baena", short: "Baena", team: 'ATM', nation: 'ESP', number: 10, height: 69, weight: 152, age: 25, foot: 'right', skin: '#c58a7a', espn: 297373, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 8, shotPower: 10, heading: 2, dribbling: 3, firstTouch: 5, linkUp: 10, pace: 4, strength: 1, offBall: 5, composure: 6 } },

  // ─── BAR ────────────────────────────────────────────────────────────
  { name: "Raphinha", short: "Raphinha", team: 'BAR', nation: 'BRA', number: 11, height: 69, weight: 139, age: 29, foot: 'left', skin: '#a16d5a', espn: 231050, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 10, shotPower: 3, heading: 5, dribbling: 8, firstTouch: 8, linkUp: 9, pace: 9, strength: 2, offBall: 10, composure: 10 } },
  { name: "Lamine Yamal", short: "Yamal", team: 'BAR', nation: 'ESP', number: 10, height: 70, weight: 168, age: 19, foot: 'left', skin: '#876054', espn: 362150, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 10, shotPower: 10, heading: 4, dribbling: 11, firstTouch: 11, linkUp: 11, pace: 10, strength: 7, offBall: 10, composure: 9 } },
  { name: "Pedri", short: "Pedri", team: 'BAR', nation: 'ESP', number: 8, height: 69, weight: 150, age: 23, foot: 'right', skin: '#bc8f79', espn: 250465, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 4, heading: 3, dribbling: 9, firstTouch: 11, linkUp: 11, pace: 6, strength: 3, offBall: 4, composure: 7 } },
  { name: "Fermín López", short: "López", team: 'BAR', nation: 'ESP', number: 7, height: 69, weight: 161, age: 23, foot: 'right', skin: '#95705f', espn: 354334, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 8, shotPower: 7, heading: 4, dribbling: 10, firstTouch: 9, linkUp: 10, pace: 7, strength: 4, offBall: 8, composure: 6 } },
  { name: "Anthony Gordon", short: "Gordon", team: 'BAR', nation: 'ENG', number: 17, height: 72, weight: 159, age: 25, foot: 'right', skin: '#b88a7a', espn: 268782, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 6, heading: 5, dribbling: 9, firstTouch: 7, linkUp: 7, pace: 11, strength: 5, offBall: 9, composure: 10 } },

  // ─── CEL ────────────────────────────────────────────────────────────
  { name: "Ferran Jutglà", short: "Jutglà", team: 'CEL', nation: 'ESP', number: 9, height: 69, weight: 163, age: 27, foot: 'right', skin: '#ad8271', espn: 279904, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 9, heading: 3, dribbling: 5, firstTouch: 4, linkUp: 3, pace: 6, strength: 5, offBall: 7, composure: 5 } },
  { name: "Ilaix Moriba", short: "Moriba", team: 'CEL', nation: 'GUI', number: 6, height: 65, weight: 161, age: 23, foot: 'right', skin: '#6c4943', espn: 297829, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 10, heading: 0, dribbling: 4, firstTouch: 6, linkUp: 5, pace: 4, strength: 3, offBall: 2, composure: 3 } },
  { name: "Williot Swedberg", short: "Swedberg", team: 'CEL', nation: 'SWE', number: 19, height: 74, weight: 172, age: 22, foot: 'right', skin: '#a67f6b', espn: 322652, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 6, heading: 8, dribbling: 4, firstTouch: 3, linkUp: 5, pace: 4, strength: 9, offBall: 6, composure: 4 } },
  { name: "Miguel Román", short: "Román", team: 'CEL', nation: 'ESP', number: 8, height: 70, weight: 152, age: 23, foot: 'right', skin: '#b08073', espn: 353736, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 7, heading: 4, dribbling: 3, firstTouch: 6, linkUp: 6, pace: 4, strength: 4, offBall: 3, composure: 4 } },
  { name: "Hugo Álvarez", short: "Álvarez", team: 'CEL', nation: 'ESP', number: 23, height: 69, weight: 159, age: 23, foot: 'right', skin: '#95705f', espn: 188391, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 4, heading: 2, dribbling: 4, firstTouch: 4, linkUp: 7, pace: 5, strength: 2, offBall: 4, composure: 3 } },

  // ─── DEP ────────────────────────────────────────────────────────────
  { name: "Bil Nsongo", short: "Nsongo", team: 'DEP', nation: 'CMR', number: 32, height: 72, weight: null, age: 22, foot: 'right', skin: '#906a59', espn: 414299, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 3, heading: 8, dribbling: 7, firstTouch: 2, linkUp: 1, pace: 9, strength: 4, offBall: 6, composure: 2 } },
  { name: "Yeremay Hernández", short: "Hernández", team: 'DEP', nation: 'ESP', number: 10, height: 67, weight: 139, age: 23, foot: 'right', skin: '#ac8067', espn: 312392, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 3, shotPower: 0, heading: 1, dribbling: 10, firstTouch: 5, linkUp: 6, pace: 9, strength: 2, offBall: 5, composure: 8 } },
  { name: "Lorenzo Amatucci", short: "Amatucci", team: 'DEP', nation: 'ITA', number: 16, height: 68, weight: 157, age: 22, foot: 'right', skin: '#a87e66', espn: 356639, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 0, shotPower: 2, heading: 2, dribbling: 0, firstTouch: 3, linkUp: 2, pace: 4, strength: 3, offBall: 0, composure: 2 } },
  { name: "Pierre-Emerick Aubameyang", short: "Aubameyang", team: 'DEP', nation: 'GAB', number: 7, height: 74, weight: 174, age: 37, foot: 'right', skin: '#a4765c', espn: 122260, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 5, heading: 7, dribbling: 5, firstTouch: 5, linkUp: 5, pace: 5, strength: 7, offBall: 9, composure: 10 } },
  { name: "Mario Soriano Carreno", short: "Soriano Carreno", team: 'DEP', nation: 'ESP', number: 21, height: 64, weight: 130, age: 24, foot: 'right', skin: '#946c58', espn: 297353, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 7, heading: 0, dribbling: 3, firstTouch: 5, linkUp: 6, pace: 5, strength: 0, offBall: 0, composure: 3 } },

  // ─── ELC ────────────────────────────────────────────────────────────
  { name: "Fer Niño", short: "Fer Niño", team: 'ELC', nation: 'ESP', number: 14, height: 75, weight: 172, age: 26, foot: 'right', skin: '#a17662', espn: 301684, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 3, heading: 8, dribbling: 2, firstTouch: 0, linkUp: 0, pace: 8, strength: 7, offBall: 4, composure: 4 } },
  { name: "Germán Valera", short: "Valera", team: 'ELC', nation: 'ESP', number: 11, height: 67, weight: 150, age: 24, foot: 'left', skin: '#ad8271', espn: 297358, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 4, heading: 2, dribbling: 6, firstTouch: 6, linkUp: 7, pace: 5, strength: 4, offBall: 3, composure: 6 } },
  { name: "Facundo Buonanotte", short: "Buonanotte", team: 'ELC', nation: 'ARG', number: 10, height: 69, weight: 146, age: 21, foot: 'left', skin: '#b98f7b', espn: 318284, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 3, heading: 3, dribbling: 5, firstTouch: 4, linkUp: 5, pace: 5, strength: 1, offBall: 5, composure: 3 } },
  { name: "Gonzalo Villar", short: "Villar", team: 'ELC', nation: 'ESP', number: 12, height: 71, weight: 161, age: 28, foot: 'right', skin: '#8b5f47', espn: 273424, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 6, shotPower: 4, heading: 5, dribbling: 4, firstTouch: 6, linkUp: 6, pace: 3, strength: 7, offBall: 3, composure: 5 } },
  { name: "Marc Aguado", short: "Aguado", team: 'ELC', nation: 'ESP', number: 8, height: 70, weight: 150, age: 26, foot: 'left', skin: '#ac8673', espn: 301406, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 7, shotPower: 3, heading: 4, dribbling: 6, firstTouch: 8, linkUp: 4, pace: 4, strength: 3, offBall: 2, composure: 7 } },

  // ─── RCD ────────────────────────────────────────────────────────────
  { name: "Roberto Fernández", short: "Fernández", team: 'RCD', nation: 'ESP', number: 9, height: 73, weight: 172, age: 24, foot: 'right', skin: '#b88a7a', espn: 318773, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 5, heading: 9, dribbling: 2, firstTouch: 2, linkUp: 2, pace: 7, strength: 5, offBall: 7, composure: 5 } },
  { name: "Urko Gonzalez", short: "Gonzalez", team: 'RCD', nation: 'ESP', number: 4, height: 74, weight: 183, age: 25, foot: 'right', skin: '#a16d5a', espn: 307915, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 8, heading: 6, dribbling: 6, firstTouch: 7, linkUp: 2, pace: 3, strength: 7, offBall: 2, composure: 6 } },
  { name: "Tyrhys Dolan", short: "Dolan", team: 'RCD', nation: 'ENG', number: 24, height: 65, weight: 139, age: 24, foot: 'right', skin: '#9b613e', espn: 306520, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 2, heading: 0, dribbling: 6, firstTouch: 5, linkUp: 6, pace: 5, strength: 0, offBall: 4, composure: 5 } },
  { name: "Edu Expósito", short: "Expósito", team: 'RCD', nation: 'ESP', number: 8, height: 70, weight: 150, age: 30, foot: 'right', skin: '#d09070', espn: 255272, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 3, heading: 3, dribbling: 9, firstTouch: 10, linkUp: 9, pace: 4, strength: 3, offBall: 3, composure: 7 } },
  { name: "Javi Hernandez", short: "Hernandez", team: 'RCD', nation: 'ESP', number: 28, height: 72, weight: 159, age: 22, foot: 'left', skin: '#9a6455', espn: 367946, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 4, heading: 2, dribbling: 8, firstTouch: 1, linkUp: 6, pace: 8, strength: 2, offBall: 4, composure: 0 } },

  // ─── GET ────────────────────────────────────────────────────────────
  { name: "Enes Ünal", short: "Ünal", team: 'GET', nation: 'TUR', number: 19, height: 74, weight: 172, age: 29, foot: 'right', skin: '#bf8671', espn: 218122, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 5, heading: 9, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 3, strength: 7, offBall: 6, composure: 5 } },
  { name: "Martín Satriano", short: "Satriano", team: 'GET', nation: 'URU', number: 10, height: 74, weight: 163, age: 25, foot: 'right', skin: '#cc907a', espn: 284854, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 4, heading: 8, dribbling: 7, firstTouch: 3, linkUp: 3, pace: 8, strength: 6, offBall: 6, composure: 5 } },
  { name: "Mario Martín", short: "Martín", team: 'GET', nation: 'ESP', number: 6, height: 70, weight: 161, age: 22, foot: 'right', skin: '#99736a', espn: 357147, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 5, heading: 5, dribbling: 2, firstTouch: 3, linkUp: 2, pace: 5, strength: 3, offBall: 3, composure: 3 } },
  { name: "Ramón Terrats", short: "Terrats", team: 'GET', nation: 'ESP', number: 11, height: 71, weight: 157, age: 26, foot: 'left', skin: '#9d6448', espn: 309838, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 5, heading: 6, dribbling: 6, firstTouch: 5, linkUp: 5, pace: 5, strength: 8, offBall: 4, composure: 5 } },
  { name: "Orel Mangala", short: "Mangala", team: 'GET', nation: 'BEL', number: 23, height: 70, weight: 174, age: 28, foot: 'right', skin: '#785c4a', espn: 228424, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 5, heading: 4, dribbling: 6, firstTouch: 6, linkUp: 4, pace: 2, strength: 6, offBall: 4, composure: 4 } },

  // ─── LEV ────────────────────────────────────────────────────────────
  { name: "Iván Romero", short: "Romero", team: 'LEV', nation: 'ESP', number: 9, height: 68, weight: 159, age: 25, foot: 'right', skin: '#a17662', espn: 311054, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 5, heading: 3, dribbling: 7, firstTouch: 4, linkUp: 3, pace: 7, strength: 4, offBall: 7, composure: 1 } },
  { name: "Etta Eyong", short: "Eyong", team: 'LEV', nation: 'CMR', number: 21, height: 71, weight: 163, age: 23, foot: 'right', skin: '#784f3e', espn: 346676, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 6, heading: 9, dribbling: 3, firstTouch: 3, linkUp: 4, pace: 7, strength: 6, offBall: 8, composure: 1 } },
  { name: "Jon Ander Olasagasti", short: "Olasagasti", team: 'LEV', nation: 'ESP', number: 8, height: 69, weight: 161, age: 26, foot: 'left', skin: '#c1866b', espn: 317784, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 5, heading: 3, dribbling: 5, firstTouch: 6, linkUp: 7, pace: 3, strength: 4, offBall: 4, composure: 4 } },
  { name: "Roger Brugué", short: "Brugué", team: 'LEV', nation: 'ESP', number: 7, height: 68, weight: 150, age: 30, foot: 'left', skin: '#b37963', espn: 267591, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 2, heading: 6, dribbling: 3, firstTouch: 4, linkUp: 4, pace: 3, strength: 2, offBall: 7, composure: 6 } },
  { name: "Petar Ratkov", short: "Ratkov", team: 'LEV', nation: 'SRB', number: 10, height: 76, weight: 168, age: 23, foot: 'right', skin: '#b38473', espn: 342136, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 4, heading: 8, dribbling: 6, firstTouch: 4, linkUp: 4, pace: 8, strength: 7, offBall: 5, composure: 2 } },

  // ─── MAL ────────────────────────────────────────────────────────────
  { name: "Chupete", short: "Chupete", team: 'MAL', nation: 'ESP', number: 9, height: 73, weight: 159, age: 22, foot: 'right', skin: '#b0887e', espn: 388602, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 1, heading: 7, dribbling: 0, firstTouch: 1, linkUp: 0, pace: 8, strength: 3, offBall: 7, composure: 1 } },
  { name: "David Larrubia", short: "Larrubia", team: 'MAL', nation: 'ESP', number: 10, height: 68, weight: 128, age: 24, foot: 'left', skin: '#99736a', espn: 297828, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 0, heading: 1, dribbling: 9, firstTouch: 4, linkUp: 3, pace: 9, strength: 0, offBall: 4, composure: 4 } },
  { name: "Pablo Martínez", short: "Martínez", team: 'MAL', nation: 'ESP', number: 18, height: 72, weight: 161, age: 28, foot: 'right', skin: '#ab7b63', espn: 271151, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 4, heading: 5, dribbling: 5, firstTouch: 6, linkUp: 8, pace: 3, strength: 4, offBall: 4, composure: 6 } },
  { name: "Izan Merino", short: "Merino", team: 'MAL', nation: 'ESP', number: 23, height: 72, weight: 161, age: 20, foot: 'right', skin: '#94685a', espn: 371564, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 0, shotPower: 3, heading: 3, dribbling: 2, firstTouch: 5, linkUp: 1, pace: 4, strength: 2, offBall: 0, composure: 1 } },
  { name: "Daniel Lorenzo", short: "Lorenzo", team: 'MAL', nation: 'ESP', number: 22, height: 69, weight: 150, age: 23, foot: 'right', skin: '#ad8271', espn: 331533, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 1, heading: 1, dribbling: 9, firstTouch: 8, linkUp: 3, pace: 7, strength: 2, offBall: 1, composure: 2 } },

  // ─── OSA ────────────────────────────────────────────────────────────
  { name: "Ante Budimir", short: "Budimir", team: 'OSA', nation: 'CRO', number: 17, height: 75, weight: 163, age: 35, foot: 'left', skin: '#a17662', espn: 207288, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 4, heading: 11, dribbling: 1, firstTouch: 0, linkUp: 0, pace: 5, strength: 8, offBall: 10, composure: 9 } },
  { name: "Jon Moncayola", short: "Moncayola", team: 'OSA', nation: 'ESP', number: 7, height: 74, weight: 190, age: 28, foot: 'right', skin: '#ca8d75', espn: 286176, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 8, heading: 6, dribbling: 7, firstTouch: 9, linkUp: 5, pace: 2, strength: 8, offBall: 2, composure: 6 } },
  { name: "Aimar Oroz", short: "Oroz", team: 'OSA', nation: 'ESP', number: 10, height: 70, weight: 159, age: 24, foot: 'right', skin: '#a96d5a', espn: 288760, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 5, heading: 4, dribbling: 7, firstTouch: 6, linkUp: 6, pace: 5, strength: 7, offBall: 4, composure: 6 } },
  { name: "Rubén García", short: "García", team: 'OSA', nation: 'ESP', number: 14, height: 67, weight: 159, age: 33, foot: 'left', skin: '#d09070', espn: 178328, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 3, shotPower: 6, heading: 2, dribbling: 4, firstTouch: 6, linkUp: 8, pace: 2, strength: 4, offBall: 4, composure: 7 } },
  { name: "Raúl García", short: "Raúl García", team: 'OSA', nation: 'ESP', number: 9, height: 76, weight: 152, age: 26, foot: 'right', skin: '#b38473', espn: 296163, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 5, heading: 9, dribbling: 6, firstTouch: 3, linkUp: 4, pace: 8, strength: 5, offBall: 7, composure: 5 } },

  // ─── RAC ────────────────────────────────────────────────────────────
  { name: "Yassir Zabiri", short: "Zabiri", team: 'RAC', nation: 'MAR', number: 21, height: 70, weight: 150, age: 21, foot: 'left', skin: '#b68976', espn: 390389, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 4, heading: 4, dribbling: 7, firstTouch: 5, linkUp: 4, pace: 9, strength: 1, offBall: 7, composure: 4 } },
  { name: "Iván Martín", short: "Martín", team: 'RAC', nation: 'ESP', number: 23, height: 70, weight: 152, age: 27, foot: 'left', skin: '#b17767', espn: 330545, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 9, heading: 4, dribbling: 8, firstTouch: 10, linkUp: 5, pace: 4, strength: 4, offBall: 2, composure: 4 } },
  { name: "Matteo Prati", short: "Prati", team: 'RAC', nation: 'ITA', number: 18, height: 72, weight: 161, age: 22, foot: 'right', skin: '#a1775f', espn: 107960, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 5, heading: 5, dribbling: 4, firstTouch: 7, linkUp: 3, pace: 4, strength: 6, offBall: 3, composure: 5 } },
  { name: "Iñigo Vicente", short: "Vicente", team: 'RAC', nation: 'ESP', number: 10, height: 70, weight: 150, age: 28, foot: 'right', skin: '#b68065', espn: 284699, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 0, heading: 2, dribbling: 6, firstTouch: 6, linkUp: 10, pace: 5, strength: 3, offBall: 2, composure: 6 } },
  { name: "Sergio Canales", short: "Canales", team: 'RAC', nation: 'ESP', number: 20, height: 69, weight: 141, age: 35, foot: 'left', skin: '#9b6e57', espn: 125383, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 6, heading: 2, dribbling: 6, firstTouch: 5, linkUp: 6, pace: 4, strength: 2, offBall: 3, composure: 4 } },

  // ─── RAY ────────────────────────────────────────────────────────────
  { name: "Sergio Camello", short: "Camello", team: 'RAY', nation: 'ESP', number: 10, height: 70, weight: 150, age: 25, foot: 'right', skin: '#c29289', espn: 276652, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 3, heading: 3, dribbling: 6, firstTouch: 5, linkUp: 6, pace: 8, strength: 3, offBall: 7, composure: 6 } },
  { name: "Jorge de Frutos", short: "de Frutos", team: 'RAY', nation: 'ESP', number: 19, height: 68, weight: 159, age: 29, foot: 'right', skin: '#af7d67', espn: 260740, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 7, shotPower: 9, heading: 2, dribbling: 6, firstTouch: 5, linkUp: 4, pace: 5, strength: 4, offBall: 6, composure: 7 } },
  { name: "Pathé Ciss", short: "Ciss", team: 'RAY', nation: 'SEN', number: 6, height: 73, weight: 157, age: 32, foot: 'right', skin: '#59463b', espn: 294228, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 4, heading: 8, dribbling: 7, firstTouch: 10, linkUp: 4, pace: 2, strength: 6, offBall: 3, composure: 1 } },
  { name: "Unai López", short: "López", team: 'RAY', nation: 'ESP', number: 8, height: 67, weight: 150, age: 31, foot: 'right', skin: '#ae8071', espn: 203711, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 6, heading: 2, dribbling: 6, firstTouch: 9, linkUp: 8, pace: 2, strength: 3, offBall: 3, composure: 7 } },
  { name: "Álvaro García", short: "García", team: 'RAY', nation: 'ESP', number: 18, height: 66, weight: 132, age: 34, foot: 'both', skin: '#b68470', espn: 125200, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 1, heading: 1, dribbling: 1, firstTouch: 2, linkUp: 6, pace: 2, strength: 0, offBall: 6, composure: 7 } },

  // ─── BET ────────────────────────────────────────────────────────────
  { name: "Cucho Hernández", short: "Cucho", team: 'BET', nation: 'COL', number: 9, height: 69, weight: 172, age: 27, foot: 'right', skin: '#95705f', espn: 336809, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 9, heading: 4, dribbling: 7, firstTouch: 4, linkUp: 4, pace: 8, strength: 4, offBall: 10, composure: 8 } },
  { name: "Antony", short: "Antony", team: 'BET', nation: 'BRA', number: 7, height: 69, weight: 139, age: 26, foot: 'left', skin: '#b87d5f', espn: 281558, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 2, heading: 3, dribbling: 6, firstTouch: 8, linkUp: 8, pace: 5, strength: 3, offBall: 8, composure: 7 } },
  { name: "Abde Ezzalzouli", short: "Ezzalzouli", team: 'BET', nation: 'MAR', number: 10, height: 70, weight: 161, age: 24, foot: 'right', skin: '#93685d', espn: 300912, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 7, shotPower: 9, heading: 4, dribbling: 8, firstTouch: 7, linkUp: 7, pace: 6, strength: 6, offBall: 8, composure: 7 } },
  { name: "Pablo Fornals", short: "Fornals", team: 'BET', nation: 'ESP', number: 8, height: 70, weight: 148, age: 30, foot: 'right', skin: '#c08b74', espn: 227714, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 8, shotPower: 8, heading: 4, dribbling: 6, firstTouch: 9, linkUp: 10, pace: 3, strength: 3, offBall: 5, composure: 7 } },
  { name: "Troy Parrott", short: "Parrott", team: 'BET', nation: 'IRL', number: 19, height: 73, weight: 172, age: 24, foot: 'right', skin: '#a67f6b', espn: 279790, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 5, heading: 6, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 8, strength: 6, offBall: 9, composure: 2 } },

  // ─── RMA ────────────────────────────────────────────────────────────
  { name: "Kylian Mbappé", short: "Mbappé", team: 'RMA', nation: 'FRA', number: 10, height: 70, weight: 163, age: 27, foot: 'right', skin: '#9a6142', espn: 231388, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 11, shotPower: 9, heading: 2, dribbling: 11, firstTouch: 10, linkUp: 10, pace: 11, strength: 6, offBall: 11, composure: 11 } },
  { name: "Jude Bellingham", short: "Bellingham", team: 'RMA', nation: 'ENG', number: 5, height: 73, weight: 163, age: 23, foot: 'right', skin: '#885c4d', espn: 291281, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 9, shotPower: 4, heading: 7, dribbling: 10, firstTouch: 10, linkUp: 8, pace: 7, strength: 9, offBall: 9, composure: 10 } },
  { name: "Federico Valverde", short: "Valverde", team: 'RMA', nation: 'URU', number: 8, height: 72, weight: 172, age: 28, foot: 'right', skin: '#a67f6b', espn: 235818, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 7, heading: 6, dribbling: 7, firstTouch: 10, linkUp: 8, pace: 3, strength: 8, offBall: 4, composure: 8 } },
  { name: "Vinícius Júnior", short: "Vinícius Júnior", team: 'RMA', nation: 'BRA', number: 7, height: 69, weight: 170, age: 26, foot: 'right', skin: '#7d5243', espn: 252107, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 9, shotPower: 5, heading: 3, dribbling: 10, firstTouch: 9, linkUp: 9, pace: 11, strength: 9, offBall: 10, composure: 10 } },
  { name: "Yan Diomande", short: "Diomande", team: 'RMA', nation: 'CIV', number: 25, height: 71, weight: 168, age: 19, foot: 'right', skin: '#644536', espn: 402479, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 10, shotPower: 10, heading: 5, dribbling: 11, firstTouch: 11, linkUp: 10, pace: 10, strength: 8, offBall: 7, composure: 5 } },

  // ─── RSO ────────────────────────────────────────────────────────────
  { name: "Mikel Oyarzabal", short: "Oyarzabal", team: 'RSO', nation: 'ESP', number: 10, height: 71, weight: 172, age: 29, foot: 'left', skin: '#b4856b', espn: 229018, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 8, heading: 5, dribbling: 7, firstTouch: 5, linkUp: 6, pace: 7, strength: 6, offBall: 8, composure: 11 } },
  { name: "Jon Gorrotxategi", short: "Gorrotxategi", team: 'RSO', nation: 'ESP', number: 4, height: 70, weight: 161, age: 24, foot: 'right', skin: '#b5765c', espn: 388601, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 5, heading: 5, dribbling: 5, firstTouch: 8, linkUp: 5, pace: 3, strength: 6, offBall: 2, composure: 6 } },
  { name: "Luka Sucic", short: "Sucic", team: 'RSO', nation: 'CRO', number: 24, height: 73, weight: 172, age: 24, foot: 'left', skin: '#a7725e', espn: 306263, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 8, heading: 5, dribbling: 6, firstTouch: 6, linkUp: 5, pace: 6, strength: 5, offBall: 5, composure: 4 } },
  { name: "Ander Barrenetxea", short: "Barrenetxea", team: 'RSO', nation: 'ESP', number: 7, height: 69, weight: 161, age: 24, foot: 'right', skin: '#c68c74', espn: 283941, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 7, heading: 3, dribbling: 10, firstTouch: 7, linkUp: 8, pace: 7, strength: 3, offBall: 5, composure: 3 } },
  { name: "Orri Óskarsson", short: "Óskarsson", team: 'RSO', nation: 'ISL', number: 9, height: 73, weight: 168, age: 22, foot: 'right', skin: '#ae8362', espn: 341367, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 4, heading: 9, dribbling: 5, firstTouch: 3, linkUp: 2, pace: 7, strength: 4, offBall: 9, composure: 6 } },

  // ─── SEV ────────────────────────────────────────────────────────────
  { name: "Robbie Ure", short: "Ure", team: 'SEV', nation: 'SCO', number: 9, height: 74, weight: null, age: 22, foot: 'right', skin: '#b68976', espn: 322993, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 1, heading: 2, dribbling: 0, firstTouch: 0, linkUp: 1, pace: 7, strength: 4, offBall: 5, composure: 1 } },
  { name: "Lucien Agoumé", short: "Agoumé", team: 'SEV', nation: 'FRA', number: 6, height: 73, weight: 159, age: 24, foot: 'right', skin: '#785c4a', espn: 282289, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 5, heading: 5, dribbling: 4, firstTouch: 7, linkUp: 4, pace: 3, strength: 5, offBall: 1, composure: 7 } },
  { name: "Youssouf Fofana", short: "Fofana", team: 'SEV', nation: 'FRA', number: 24, height: 73, weight: 163, age: 27, foot: 'right', skin: '#785c4a', espn: 277307, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 5, heading: 6, dribbling: 3, firstTouch: 4, linkUp: 6, pace: 3, strength: 5, offBall: 4, composure: 4 } },
  { name: "Felix Correia", short: "Correia", team: 'SEV', nation: 'POR', number: 20, height: 70, weight: 139, age: 25, foot: 'right', skin: '#5d4638', espn: 288900, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 3, shotPower: 1, heading: 3, dribbling: 4, firstTouch: 4, linkUp: 7, pace: 5, strength: 2, offBall: 5, composure: 4 } },
  { name: "Rubén Vargas", short: "Vargas", team: 'SEV', nation: 'SUI', number: 11, height: 70, weight: 170, age: 28, foot: 'right', skin: '#b38473', espn: 259513, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 6, heading: 5, dribbling: 6, firstTouch: 5, linkUp: 6, pace: 4, strength: 7, offBall: 5, composure: 6 } },

  // ─── VAL ────────────────────────────────────────────────────────────
  { name: "Hugo Duro", short: "Duro", team: 'VAL', nation: 'ESP', number: 9, height: 70, weight: 152, age: 26, foot: 'left', skin: '#a87e66', espn: 267477, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 3, heading: 8, dribbling: 1, firstTouch: 2, linkUp: 2, pace: 6, strength: 4, offBall: 7, composure: 2 } },
  { name: "Javi Guerra", short: "Guerra", team: 'VAL', nation: 'ESP', number: 8, height: 74, weight: 170, age: 23, foot: 'right', skin: '#8e624e', espn: 16340, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 5, heading: 6, dribbling: 7, firstTouch: 4, linkUp: 6, pace: 7, strength: 6, offBall: 4, composure: 3 } },
  { name: "Pepelu", short: "Pepelu", team: 'VAL', nation: 'ESP', number: 18, height: 73, weight: 161, age: 28, foot: 'right', skin: '#ba816a', espn: 231603, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 5, heading: 5, dribbling: 8, firstTouch: 8, linkUp: 5, pace: 2, strength: 5, offBall: 3, composure: 3 } },
  { name: "Arnaut Danjuma", short: "Danjuma", team: 'VAL', nation: 'NED', number: 7, height: 70, weight: 161, age: 29, foot: 'right', skin: '#c48067', espn: 231618, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 3, shotPower: 7, heading: 4, dribbling: 7, firstTouch: 5, linkUp: 5, pace: 6, strength: 5, offBall: 5, composure: 1 } },
  { name: "Filip Ugrinic", short: "Ugrinic", team: 'VAL', nation: 'SUI', number: 23, height: 72, weight: 192, age: 27, foot: 'right', skin: '#ae7a5d', espn: 248681, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 8, heading: 4, dribbling: 7, firstTouch: 8, linkUp: 6, pace: 3, strength: 10, offBall: 3, composure: 6 } },

  // ─── VIL ────────────────────────────────────────────────────────────
  { name: "Ayoze Pérez", short: "Pérez", team: 'VIL', nation: 'ESP', number: 22, height: 70, weight: 146, age: 33, foot: 'right', skin: '#ae7a5d', espn: 192133, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 1, heading: 3, dribbling: 4, firstTouch: 4, linkUp: 6, pace: 7, strength: 3, offBall: 8, composure: 7 } },
  { name: "Alberto Moleiro", short: "Moleiro", team: 'VIL', nation: 'ESP', number: 10, height: 68, weight: 148, age: 23, foot: 'right', skin: '#d99874', espn: 307390, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 8, shotPower: 6, heading: 3, dribbling: 7, firstTouch: 7, linkUp: 8, pace: 6, strength: 1, offBall: 6, composure: 4 } },
  { name: "Pape Gueye", short: "Gueye", team: 'VIL', nation: 'SEN', number: 18, height: 74, weight: 172, age: 27, foot: 'left', skin: '#6c4943', espn: 255889, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 7, shotPower: 8, heading: 5, dribbling: 4, firstTouch: 7, linkUp: 6, pace: 3, strength: 8, offBall: 5, composure: 9 } },
  { name: "Georges Mikautadze", short: "Mikautadze", team: 'VIL', nation: 'GEO', number: 9, height: 69, weight: 157, age: 26, foot: 'right', skin: '#b98f7b', espn: 300002, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 3, heading: 5, dribbling: 8, firstTouch: 5, linkUp: 6, pace: 9, strength: 3, offBall: 10, composure: 9 } },
  { name: "Santi Comesaña", short: "Comesaña", team: 'VIL', nation: 'ESP', number: 14, height: 74, weight: 163, age: 30, foot: 'both', skin: '#ab7b63', espn: 240623, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 5, heading: 5, dribbling: 4, firstTouch: 7, linkUp: 7, pace: 2, strength: 4, offBall: 4, composure: 7 } },

  // ─── MIL ────────────────────────────────────────────────────────────
  { name: "Gonçalo Ramos", short: "Gonçalo Ramos", team: 'MIL', nation: 'POR', number: 9, height: 73, weight: 183, age: 25, foot: 'right', skin: '#bc8364', espn: 288896, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 6, heading: 8, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 7, strength: 8, offBall: 8, composure: 3 } },
  { name: "Diego Moreira", short: "Moreira", team: 'MIL', nation: 'BEL', number: 22, height: 70, weight: 161, age: 22, foot: 'left', skin: '#a46f5c', espn: 340678, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 8, shotPower: 8, heading: 3, dribbling: 7, firstTouch: 6, linkUp: 7, pace: 6, strength: 5, offBall: 4, composure: 4 } },
  { name: "Adrien Rabiot", short: "Rabiot", team: 'MIL', nation: 'FRA', number: 12, height: 75, weight: 190, age: 31, foot: 'left', skin: '#bb8a6c', espn: 176203, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 8, shotPower: 8, heading: 7, dribbling: 4, firstTouch: 6, linkUp: 7, pace: 2, strength: 10, offBall: 5, composure: 8 } },
  { name: "Christian Pulisic", short: "Pulisic", team: 'MIL', nation: 'USA', number: 11, height: 70, weight: 161, age: 28, foot: 'right', skin: '#93685d', espn: 225607, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 4, heading: 5, dribbling: 9, firstTouch: 10, linkUp: 9, pace: 7, strength: 4, offBall: 8, composure: 4 } },
  { name: "Luka Modric", short: "Modric", team: 'MIL', nation: 'CRO', number: 14, height: 68, weight: 146, age: 41, foot: 'right', skin: '#a07465', espn: 76762, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 6, shotPower: 3, heading: 3, dribbling: 4, firstTouch: 10, linkUp: 10, pace: 2, strength: 2, offBall: 3, composure: 10 } },

  // ─── ROM ────────────────────────────────────────────────────────────
  { name: "Donyell Malen", short: "Malen", team: 'ROM', nation: 'NED', number: 14, height: 70, weight: 150, age: 27, foot: 'right', skin: '#a16d5a', espn: 259481, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 1, heading: 3, dribbling: 10, firstTouch: 8, linkUp: 5, pace: 7, strength: 4, offBall: 11, composure: 8 } },
  { name: "Manu Koné", short: "Koné", team: 'ROM', nation: 'FRA', number: 17, height: 73, weight: 174, age: 25, foot: 'right', skin: '#7c4b33', espn: 285226, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 7, heading: 6, dribbling: 8, firstTouch: 9, linkUp: 6, pace: 4, strength: 7, offBall: 3, composure: 4 } },
  { name: "Matìas Soulè", short: "Soulè", team: 'ROM', nation: 'ARG', number: 18, height: 72, weight: 161, age: 23, foot: 'left', skin: '#a07465', espn: 323974, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 8, shotPower: 7, heading: 4, dribbling: 8, firstTouch: 8, linkUp: 9, pace: 6, strength: 5, offBall: 6, composure: 4 } },
  { name: "Santiago Castro", short: "Castro", team: 'ROM', nation: 'ARG', number: 9, height: 70, weight: 190, age: 22, foot: 'right', skin: '#93685d', espn: 250284, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 8, heading: 4, dribbling: 4, firstTouch: 4, linkUp: 3, pace: 8, strength: 8, offBall: 7, composure: 2 } },
  { name: "Bryan Cristante", short: "Cristante", team: 'ROM', nation: 'ITA', number: 4, height: 73, weight: 174, age: 31, foot: 'right', skin: '#b17767', espn: 169213, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 6, heading: 9, dribbling: 6, firstTouch: 9, linkUp: 5, pace: 2, strength: 8, offBall: 3, composure: 7 } },

  // ─── ATA ────────────────────────────────────────────────────────────
  { name: "Nikola Krstovic", short: "Krstovic", team: 'ATA', nation: 'MNE', number: 90, height: 73, weight: 183, age: 26, foot: 'right', skin: '#b0887e', espn: 258158, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 6, heading: 8, dribbling: 5, firstTouch: 4, linkUp: 5, pace: 7, strength: 8, offBall: 10, composure: 6 } },
  { name: "Éderson", short: "Éderson", team: 'ATA', nation: 'BRA', number: 13, height: 72, weight: 183, age: 27, foot: 'right', skin: '#a96d5a', espn: 278210, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 7, heading: 4, dribbling: 4, firstTouch: 6, linkUp: 5, pace: 3, strength: 8, offBall: 4, composure: 6 } },
  { name: "Charles De Ketelaere", short: "De Ketelaere", team: 'ATA', nation: 'BEL', number: 17, height: 76, weight: 183, age: 25, foot: 'left', skin: '#95705f', espn: 296319, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 5, shotPower: 7, heading: 9, dribbling: 9, firstTouch: 7, linkUp: 10, pace: 6, strength: 9, offBall: 6, composure: 9 } },
  { name: "Jon Rowe", short: "Rowe", team: 'ATA', nation: 'ENG', number: 11, height: 70, weight: 161, age: 23, foot: 'right', skin: '#784f3e', espn: 118279, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 4, heading: 5, dribbling: 10, firstTouch: 7, linkUp: 5, pace: 8, strength: 7, offBall: 6, composure: 4 } },
  { name: "Nicola Zalewski", short: "Zalewski", team: 'ATA', nation: 'POL', number: 59, height: 69, weight: 150, age: 24, foot: 'right', skin: '#ad8271', espn: 288488, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 3, heading: 3, dribbling: 6, firstTouch: 5, linkUp: 7, pace: 5, strength: 4, offBall: 4, composure: 4 } },

  // ─── BOL ────────────────────────────────────────────────────────────
  { name: "Roberto Piccoli", short: "Piccoli", team: 'BOL', nation: 'ITA', number: 91, height: 74, weight: 172, age: 25, foot: 'right', skin: '#c58a7a', espn: 285438, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 3, shotPower: 6, heading: 7, dribbling: 4, firstTouch: 2, linkUp: 2, pace: 7, strength: 7, offBall: 6, composure: 2 } },
  { name: "Lewis Ferguson", short: "Ferguson", team: 'BOL', nation: 'SCO', number: 19, height: 71, weight: 161, age: 27, foot: 'right', skin: '#ba8c7a', espn: 202429, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 5, heading: 6, dribbling: 3, firstTouch: 7, linkUp: 5, pace: 3, strength: 6, offBall: 3, composure: 2 } },
  { name: "Nicolò Cambiaghi", short: "Cambiaghi", team: 'BOL', nation: 'ITA', number: 28, height: 68, weight: 146, age: 25, foot: 'right', skin: '#ba7f76', espn: 287790, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 3, heading: 1, dribbling: 6, firstTouch: 5, linkUp: 6, pace: 5, strength: 6, offBall: 4, composure: 4 } },
  { name: "Riccardo Orsolini", short: "Orsolini", team: 'BOL', nation: 'ITA', number: 7, height: 72, weight: 161, age: 29, foot: 'left', skin: '#c8907a', espn: 234426, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 8, shotPower: 5, heading: 5, dribbling: 7, firstTouch: 5, linkUp: 3, pace: 4, strength: 6, offBall: 7, composure: 5 } },
  { name: "Jens Odgaard", short: "Odgaard", team: 'BOL', nation: 'DEN', number: 21, height: 74, weight: 183, age: 27, foot: 'left', skin: '#b0856f', espn: 238407, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 7, heading: 7, dribbling: 2, firstTouch: 2, linkUp: 3, pace: 4, strength: 8, offBall: 5, composure: 4 } },

  // ─── CAG ────────────────────────────────────────────────────────────
  { name: "Paul Mendy", short: "Mendy", team: 'CAG', nation: 'SEN', number: 31, height: null, weight: null, age: 19, foot: 'left', skin: '#59463b', espn: 418819, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 3, heading: 9, dribbling: 5, firstTouch: 2, linkUp: 4, pace: 9, strength: 5, offBall: 6, composure: 3 } },
  { name: "Michel Adopo", short: "Adopo", team: 'CAG', nation: 'FRA', number: 8, height: 74, weight: 168, age: 26, foot: 'right', skin: '#644536', espn: 272745, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 5, heading: 6, dribbling: 2, firstTouch: 4, linkUp: 3, pace: 3, strength: 5, offBall: 2, composure: 5 } },
  { name: "Alessandro Romano", short: "Romano", team: 'CAG', nation: 'ITA', number: 4, height: 71, weight: 161, age: 20, foot: 'left', skin: '#b0887e', espn: 6729, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 6, heading: 4, dribbling: 3, firstTouch: 4, linkUp: 5, pace: 5, strength: 4, offBall: 4, composure: 4 } },
  { name: "Daniel Maldini", short: "Maldini", team: 'CAG', nation: 'ITA', number: 70, height: 74, weight: 183, age: 25, foot: 'right', skin: '#9a5c42', espn: 290545, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 6, heading: 7, dribbling: 6, firstTouch: 5, linkUp: 5, pace: 6, strength: 8, offBall: 6, composure: 7 } },
  { name: "Jacopo Fazzini", short: "Fazzini", team: 'CAG', nation: 'ITA', number: 10, height: 70, weight: 137, age: 23, foot: 'right', skin: '#a87e66', espn: 333938, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 3, shotPower: 2, heading: 4, dribbling: 6, firstTouch: 4, linkUp: 5, pace: 6, strength: 1, offBall: 4, composure: 4 } },

  // ─── COM ────────────────────────────────────────────────────────────
  { name: "Tasos Douvikas", short: "Douvikas", team: 'COM', nation: 'GRE', number: 9, height: 73, weight: 168, age: 27, foot: 'right', skin: '#b08371', espn: 262071, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 4, heading: 8, dribbling: 2, firstTouch: 1, linkUp: 2, pace: 6, strength: 7, offBall: 9, composure: 7 } },
  { name: "Nico Paz", short: "Paz", team: 'COM', nation: 'ARG', number: 10, height: 73, weight: 172, age: 22, foot: 'left', skin: '#95705f', espn: 337970, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 9, shotPower: 8, heading: 8, dribbling: 10, firstTouch: 10, linkUp: 8, pace: 7, strength: 8, offBall: 8, composure: 2 } },
  { name: "Lucas Da Cunha", short: "Da Cunha", team: 'COM', nation: 'FRA', number: 7, height: 69, weight: 146, age: 25, foot: 'left', skin: '#b08371', espn: 291285, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 3, heading: 2, dribbling: 8, firstTouch: 10, linkUp: 8, pace: 4, strength: 2, offBall: 4, composure: 9 } },
  { name: "Máximo Perrone", short: "Perrone", team: 'COM', nation: 'ARG', number: 5, height: 70, weight: 159, age: 23, foot: 'left', skin: '#a07465', espn: 309241, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 5, heading: 2, dribbling: 4, firstTouch: 8, linkUp: 8, pace: 3, strength: 4, offBall: 3, composure: 3 } },
  { name: "Martin Baturina", short: "Baturina", team: 'COM', nation: 'CRO', number: 20, height: 68, weight: 150, age: 23, foot: 'right', skin: '#8e635b', espn: 311475, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 9, shotPower: 6, heading: 2, dribbling: 6, firstTouch: 7, linkUp: 10, pace: 5, strength: 3, offBall: 6, composure: 6 } },

  // ─── FIO ────────────────────────────────────────────────────────────
  { name: "Mateo Pellegrino", short: "Pellegrino", team: 'FIO', nation: 'ARG', number: 32, height: 76, weight: 174, age: 25, foot: 'left', skin: '#ac8067', espn: 312757, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 7, heading: 10, dribbling: 6, firstTouch: 1, linkUp: 1, pace: 8, strength: 9, offBall: 7, composure: 6 } },
  { name: "Franco Mastantuono", short: "Mastantuono", team: 'FIO', nation: 'ARG', number: 30, height: 70, weight: 161, age: 19, foot: 'left', skin: '#ae8071', espn: 376473, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 8, heading: 3, dribbling: 9, firstTouch: 6, linkUp: 6, pace: 8, strength: 5, offBall: 7, composure: 3 } },
  { name: "Cher Ndour", short: "Ndour", team: 'FIO', nation: 'ITA', number: 27, height: 75, weight: 181, age: 22, foot: 'right', skin: '#9e6245', espn: 360061, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 7, heading: 7, dribbling: 3, firstTouch: 5, linkUp: 4, pace: 3, strength: 8, offBall: 4, composure: 2 } },
  { name: "Nicolò Fagioli", short: "Fagioli", team: 'FIO', nation: 'ITA', number: 44, height: 70, weight: 157, age: 25, foot: 'right', skin: '#b68976', espn: 276254, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 5, heading: 4, dribbling: 7, firstTouch: 9, linkUp: 8, pace: 4, strength: 5, offBall: 3, composure: 5 } },
  { name: "Arthur Atta", short: "Atta", team: 'FIO', nation: 'FRA', number: 14, height: 74, weight: 170, age: 23, foot: 'right', skin: '#b07a65', espn: 356213, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 5, heading: 7, dribbling: 9, firstTouch: 6, linkUp: 5, pace: 7, strength: 5, offBall: 5, composure: 5 } },

  // ─── FRO ────────────────────────────────────────────────────────────
  { name: "Antonio Raimondo", short: "Raimondo", team: 'FRO', nation: 'ITA', number: 9, height: 73, weight: 161, age: 22, foot: 'left', skin: '#b07a65', espn: 319265, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 8, heading: 8, dribbling: 1, firstTouch: 0, linkUp: 0, pace: 8, strength: 2, offBall: 7, composure: 2 } },
  { name: "Romano Schmid", short: "Schmid", team: 'FRO', nation: 'AUT', number: 10, height: 66, weight: 150, age: 26, foot: 'right', skin: '#ac8673', espn: 238296, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 6, heading: 1, dribbling: 5, firstTouch: 5, linkUp: 10, pace: 4, strength: 2, offBall: 5, composure: 7 } },
  { name: "Farès Ghedjemis", short: "Ghedjemis", team: 'FRO', nation: 'ALG', number: 7, height: 72, weight: 181, age: 24, foot: 'left', skin: '#c28871', espn: 356536, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 3, heading: 2, dribbling: 6, firstTouch: 3, linkUp: 4, pace: 6, strength: 5, offBall: 6, composure: 2 } },
  { name: "Giorgi Kvernadze", short: "Kvernadze", team: 'FRO', nation: 'GEO', number: 17, height: 72, weight: 148, age: 23, foot: 'right', skin: '#ad8271', espn: 360714, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 0, heading: 2, dribbling: 7, firstTouch: 2, linkUp: 3, pace: 7, strength: 3, offBall: 4, composure: 2 } },
  { name: "Patrizio Masini", short: "Masini", team: 'FRO', nation: 'ITA', number: 73, height: 72, weight: 159, age: 25, foot: 'right', skin: '#bc7e69', espn: 346840, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 5, heading: 5, dribbling: 2, firstTouch: 3, linkUp: 3, pace: 3, strength: 4, offBall: 3, composure: 4 } },

  // ─── GEN ────────────────────────────────────────────────────────────
  { name: "Milutin Osmajic", short: "Osmajic", team: 'GEN', nation: 'MNE', number: 18, height: 73, weight: 163, age: 27, foot: 'right', skin: '#b98c7c', espn: 275444, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 3, heading: 5, dribbling: 1, firstTouch: 0, linkUp: 0, pace: 6, strength: 4, offBall: 4, composure: 4 } },
  { name: "Morten Frendrup", short: "Frendrup", team: 'GEN', nation: 'DEN', number: 32, height: 70, weight: 139, age: 25, foot: 'right', skin: '#a67f6b', espn: 270884, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 2, heading: 3, dribbling: 3, firstTouch: 6, linkUp: 3, pace: 3, strength: 2, offBall: 1, composure: 6 } },
  { name: "Mikael Ellertsson", short: "Ellertsson", team: 'GEN', nation: 'ISL', number: 77, height: 72, weight: 161, age: 24, foot: 'left', skin: '#ae7a5d', espn: 324256, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 1, shotPower: 6, heading: 4, dribbling: 2, firstTouch: 3, linkUp: 2, pace: 4, strength: 5, offBall: 2, composure: 3 } },
  { name: "Lorenzo Colombo", short: "Colombo", team: 'GEN', nation: 'ITA', number: 29, height: 73, weight: 161, age: 24, foot: 'left', skin: '#c08b74', espn: 297220, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 5, heading: 3, dribbling: 3, firstTouch: 2, linkUp: 2, pace: 8, strength: 3, offBall: 6, composure: 0 } },
  { name: "Vitinha", short: "Vitinha", team: 'GEN', nation: 'POR', number: 9, height: 70, weight: 161, age: 26, foot: 'right', skin: '#b68976', espn: 403234, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 5, heading: 4, dribbling: 5, firstTouch: 10, linkUp: 2, pace: 7, strength: 4, offBall: 6, composure: 4 } },

  // ─── INT ────────────────────────────────────────────────────────────
  { name: "Marcus Thuram", short: "Thuram", team: 'INT', nation: 'FRA', number: 9, height: 76, weight: 196, age: 29, foot: 'right', skin: '#7e5b54', espn: 217331, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 7, heading: 10, dribbling: 7, firstTouch: 6, linkUp: 6, pace: 8, strength: 10, offBall: 10, composure: 6 } },
  { name: "Nicolò Barella", short: "Barella", team: 'INT', nation: 'ITA', number: 23, height: 69, weight: 150, age: 29, foot: 'right', skin: '#a67f6b', espn: 204441, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 3, heading: 3, dribbling: 7, firstTouch: 9, linkUp: 10, pace: 4, strength: 3, offBall: 4, composure: 7 } },
  { name: "Lautaro Martínez", short: "Lautaro", team: 'INT', nation: 'ARG', number: 10, height: 69, weight: 152, age: 29, foot: 'right', skin: '#b0856f', espn: 219713, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 3, heading: 7, dribbling: 5, firstTouch: 4, linkUp: 6, pace: 5, strength: 2, offBall: 11, composure: 10 } },
  { name: "Pio Esposito", short: "Pio Esposito", team: 'INT', nation: 'ITA', number: 94, height: 75, weight: 174, age: 21, foot: 'right', skin: '#b88565', espn: 362674, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 5, heading: 10, dribbling: 2, firstTouch: 2, linkUp: 4, pace: 7, strength: 9, offBall: 9, composure: 5 } },
  { name: "Petar Sucic", short: "Sucic", team: 'INT', nation: 'CRO', number: 8, height: 72, weight: 150, age: 23, foot: 'right', skin: '#b28376', espn: 341494, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 3, heading: 5, dribbling: 5, firstTouch: 7, linkUp: 7, pace: 5, strength: 6, offBall: 4, composure: 5 } },

  // ─── JUV ────────────────────────────────────────────────────────────
  { name: "Randal Kolo Muani", short: "Kolo Muani", team: 'JUV', nation: 'FRA', number: 9, height: 74, weight: 161, age: 27, foot: 'right', skin: '#8b5b48', espn: 252971, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 1, shotPower: 3, heading: 7, dribbling: 6, firstTouch: 4, linkUp: 4, pace: 9, strength: 4, offBall: 7, composure: 5 } },
  { name: "Kenan Yildiz", short: "Yildiz", team: 'JUV', nation: 'TUR', number: 10, height: 74, weight: 170, age: 21, foot: 'both', skin: '#a07465', espn: 366509, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 7, shotPower: 6, heading: 6, dribbling: 10, firstTouch: 9, linkUp: 10, pace: 8, strength: 9, offBall: 6, composure: 3 } },
  { name: "Nick Woltemade", short: "Woltemade", team: 'JUV', nation: 'GER', number: 27, height: 78, weight: 196, age: 24, foot: 'right', skin: '#ad8271', espn: 298349, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 9, heading: 10, dribbling: 3, firstTouch: 4, linkUp: 4, pace: 6, strength: 10, offBall: 6, composure: 5 } },
  { name: "Weston McKennie", short: "McKennie", team: 'JUV', nation: 'USA', number: 22, height: 73, weight: 185, age: 28, foot: 'right', skin: '#a7725e', espn: 256715, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 1, shotPower: 8, heading: 6, dribbling: 4, firstTouch: 6, linkUp: 7, pace: 2, strength: 7, offBall: 5, composure: 8 } },
  { name: "Francisco Conceição", short: "Conceição", team: 'JUV', nation: 'POR', number: 7, height: 65, weight: 148, age: 23, foot: 'left', skin: '#b0887e', espn: 312659, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 2, shotPower: 5, heading: 1, dribbling: 9, firstTouch: 9, linkUp: 8, pace: 7, strength: 1, offBall: 8, composure: 4 } },

  // ─── LAZ ────────────────────────────────────────────────────────────
  { name: "Tijjani Noslin", short: "Noslin", team: 'LAZ', nation: 'NED', number: 14, height: 71, weight: 163, age: 27, foot: 'right', skin: '#7c4b33', espn: 323113, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 10, heading: 7, dribbling: 5, firstTouch: 5, linkUp: 5, pace: 7, strength: 2, offBall: 6, composure: 5 } },
  { name: "Kenneth Taylor", short: "Taylor", team: 'LAZ', nation: 'NED', number: 24, height: 72, weight: 163, age: 24, foot: 'left', skin: '#ae8071', espn: 282228, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 9, shotPower: 7, heading: 4, dribbling: 2, firstTouch: 5, linkUp: 6, pace: 3, strength: 5, offBall: 4, composure: 7 } },
  { name: "Davide Frattesi", short: "Frattesi", team: 'LAZ', nation: 'ITA', number: 16, height: 70, weight: 161, age: 27, foot: 'right', skin: '#af7d67', espn: 250850, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 3, heading: 2, dribbling: 3, firstTouch: 3, linkUp: 4, pace: 3, strength: 4, offBall: 6, composure: 1 } },
  { name: "Mattia Zaccagni", short: "Zaccagni", team: 'LAZ', nation: 'ITA', number: 10, height: 70, weight: 139, age: 31, foot: 'right', skin: '#af7d67', espn: 204669, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 2, heading: 3, dribbling: 6, firstTouch: 6, linkUp: 7, pace: 4, strength: 2, offBall: 5, composure: 2 } },
  { name: "Gustav Isaksen", short: "Isaksen", team: 'LAZ', nation: 'DEN', number: 11, height: 71, weight: 150, age: 25, foot: 'left', skin: '#b07a65', espn: 291550, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 3, heading: 4, dribbling: 5, firstTouch: 5, linkUp: 4, pace: 5, strength: 5, offBall: 7, composure: 5 } },

  // ─── LEC ────────────────────────────────────────────────────────────
  { name: "Nikola Stulic", short: "Stulic", team: 'LEC', nation: 'SRB', number: 9, height: 74, weight: 174, age: 25, foot: 'right', skin: '#cda28f', espn: 304512, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 6, heading: 7, dribbling: 3, firstTouch: 2, linkUp: 2, pace: 6, strength: 6, offBall: 6, composure: 4 } },
  { name: "Oumar Ngom", short: "Ngom", team: 'LEC', nation: 'MTN', number: 79, height: 72, weight: 163, age: 22, foot: 'right', skin: '#b27a4d', espn: 334793, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 5, heading: 6, dribbling: 3, firstTouch: 4, linkUp: 3, pace: 4, strength: 4, offBall: 3, composure: 4 } },
  { name: "Willem Geubbels", short: "Geubbels", team: 'LEC', nation: 'FRA', number: 69, height: 73, weight: 179, age: 25, foot: 'right', skin: '#9b6649', espn: 259744, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 6, heading: 6, dribbling: 1, firstTouch: 1, linkUp: 2, pace: 6, strength: 4, offBall: 7, composure: 4 } },
  { name: "Ivan Ilic", short: "Ilic", team: 'LEC', nation: 'SRB', number: 20, height: 73, weight: 170, age: 25, foot: 'left', skin: '#b68470', espn: 260004, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 5, heading: 6, dribbling: 3, firstTouch: 4, linkUp: 6, pace: 3, strength: 5, offBall: 4, composure: 4 } },
  { name: "Lassana Coulibaly", short: "Coulibaly", team: 'LEC', nation: 'MLI', number: 29, height: 72, weight: 170, age: 30, foot: 'right', skin: '#94685a', espn: 223947, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 5, heading: 9, dribbling: 6, firstTouch: 6, linkUp: 3, pace: 3, strength: 8, offBall: 4, composure: 6 } },

  // ─── MNZ ────────────────────────────────────────────────────────────
  { name: "Gustavo Varela", short: "Varela", team: 'MNZ', nation: 'POR', number: 9, height: 72, weight: 161, age: 21, foot: 'right', skin: '#ab6d51', espn: 384482, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 5, heading: 8, dribbling: 2, firstTouch: 1, linkUp: 1, pace: 8, strength: 2, offBall: 7, composure: 2 } },
  { name: "Ebenezer Akinsanmiro", short: "Akinsanmiro", team: 'MNZ', nation: 'NGA', number: 14, height: 72, weight: 152, age: 21, foot: 'right', skin: '#644536', espn: 362776, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 4, heading: 6, dribbling: 8, firstTouch: 8, linkUp: 5, pace: 6, strength: 6, offBall: 3, composure: 2 } },
  { name: "Jay Robinson", short: "Robinson", team: 'MNZ', nation: 'ENG', number: 46, height: 69, weight: 141, age: 19, foot: 'right', skin: '#a67f6b', espn: 355359, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 6, heading: 2, dribbling: 7, firstTouch: 3, linkUp: 3, pace: 8, strength: 1, offBall: 4, composure: 2 } },
  { name: "Michael Folorunsho", short: "Folorunsho", team: 'MNZ', nation: 'ITA', number: 90, height: 75, weight: 203, age: 28, foot: 'right', skin: '#986448', espn: 252385, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 9, heading: 7, dribbling: 5, firstTouch: 5, linkUp: 2, pace: 3, strength: 11, offBall: 4, composure: 3 } },
  { name: "Exequiel Zeballos", short: "Zeballos", team: 'MNZ', nation: 'ARG', number: 22, height: 69, weight: 150, age: 24, foot: 'right', skin: '#a87861', espn: 297051, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 5, heading: 3, dribbling: 8, firstTouch: 4, linkUp: 3, pace: 9, strength: 3, offBall: 4, composure: 2 } },

  // ─── NAP ────────────────────────────────────────────────────────────
  { name: "Rasmus Højlund", short: "Højlund", team: 'NAP', nation: 'DEN', number: 19, height: 75, weight: 190, age: 23, foot: 'left', skin: '#b0856f', espn: 309273, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 8, heading: 8, dribbling: 2, firstTouch: 1, linkUp: 3, pace: 8, strength: 9, offBall: 7, composure: 10 } },
  { name: "Kevin De Bruyne", short: "De Bruyne", team: 'NAP', nation: 'BEL', number: 11, height: 71, weight: 172, age: 35, foot: 'right', skin: '#b0887e', espn: 134947, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 9, shotPower: 9, heading: 5, dribbling: 4, firstTouch: 8, linkUp: 11, pace: 2, strength: 5, offBall: 5, composure: 9 } },
  { name: "Scott McTominay", short: "McTominay", team: 'NAP', nation: 'SCO', number: 8, height: 76, weight: 192, age: 29, foot: 'right', skin: '#b68470', espn: 255850, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 9, heading: 10, dribbling: 5, firstTouch: 6, linkUp: 5, pace: 3, strength: 10, offBall: 8, composure: 3 } },
  { name: "Stanislav Lobotka", short: "Lobotka", team: 'NAP', nation: 'SVK', number: 68, height: 66, weight: 150, age: 31, foot: 'right', skin: '#c28871', espn: 188412, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 3, heading: 1, dribbling: 4, firstTouch: 7, linkUp: 6, pace: 2, strength: 4, offBall: 2, composure: 7 } },
  { name: "Noa Lang", short: "Lang", team: 'NAP', nation: 'NED', number: 70, height: 69, weight: 152, age: 27, foot: 'right', skin: '#b0856f', espn: 255344, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 2, heading: 5, dribbling: 5, firstTouch: 5, linkUp: 7, pace: 4, strength: 3, offBall: 5, composure: 5 } },

  // ─── PRM ────────────────────────────────────────────────────────────
  { name: "José Romero", short: "Romero", team: 'PRM', nation: 'ARG', number: 9, height: 70, weight: 170, age: 23, foot: 'right', skin: '#ac8067', espn: 301980, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 6, heading: 2, dribbling: 2, firstTouch: 1, linkUp: 2, pace: 7, strength: 4, offBall: 6, composure: 3 } },
  { name: "Mandela Keita", short: "Keita", team: 'PRM', nation: 'BEL', number: 16, height: 71, weight: 172, age: 24, foot: 'right', skin: '#5d4638', espn: 316609, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 6, heading: 4, dribbling: 8, firstTouch: 8, linkUp: 3, pace: 4, strength: 9, offBall: 1, composure: 4 } },
  { name: "Adrián Bernabé", short: "Bernabé", team: 'PRM', nation: 'ESP', number: 10, height: 67, weight: 146, age: 25, foot: 'left', skin: '#876054', espn: 276653, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 2, heading: 2, dribbling: 3, firstTouch: 5, linkUp: 7, pace: 4, strength: 5, offBall: 4, composure: 1 } },
  { name: "El Bilal Toure", short: "El Bilal Touré", team: 'PRM', nation: 'MLI', number: 19, height: 73, weight: 170, age: 25, foot: 'right', skin: '#6d4639', espn: 287430, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 2, shotPower: 3, heading: 8, dribbling: 4, firstTouch: 1, linkUp: 2, pace: 6, strength: 5, offBall: 5, composure: 4 } },
  { name: "Giovanni Fabbian", short: "Fabbian", team: 'PRM', nation: 'ITA', number: 80, height: 73, weight: 163, age: 23, foot: 'right', skin: '#966b5e', espn: 323118, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 4, heading: 8, dribbling: 3, firstTouch: 4, linkUp: 4, pace: 4, strength: 5, offBall: 5, composure: 3 } },

  // ─── SAS ────────────────────────────────────────────────────────────
  { name: "Sebastiano Esposito", short: "S. Esposito", team: 'SAS', nation: 'ITA', number: 94, height: 73, weight: 168, age: 24, foot: 'right', skin: '#906a59', espn: 286929, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 6, heading: 6, dribbling: 3, firstTouch: 4, linkUp: 8, pace: 7, strength: 6, offBall: 5, composure: 7 } },
  { name: "Armand Laurienté", short: "Laurienté", team: 'SAS', nation: 'FRA', number: 45, height: 67, weight: 128, age: 27, foot: 'right', skin: '#ac6e50', espn: 272719, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 7, shotPower: 1, heading: 2, dribbling: 5, firstTouch: 5, linkUp: 8, pace: 5, strength: 1, offBall: 6, composure: 7 } },
  { name: "Ismaël Koné", short: "Koné", team: 'SAS', nation: 'CAN', number: 90, height: 74, weight: 168, age: 24, foot: 'right', skin: '#765144', espn: 325001, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 6, heading: 5, dribbling: 5, firstTouch: 3, linkUp: 2, pace: 3, strength: 4, offBall: 2, composure: 5 } },
  { name: "Darryl Bakola", short: "Bakola", team: 'SAS', nation: 'FRA', number: 50, height: 70, weight: 152, age: 18, foot: 'right', skin: '#6b493d', espn: 384170, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 4, heading: 4, dribbling: 6, firstTouch: 6, linkUp: 6, pace: 6, strength: 5, offBall: 4, composure: 3 } },
  { name: "Nemanja Matic", short: "Matic", team: 'SAS', nation: 'SRB', number: 18, height: 76, weight: 185, age: 38, foot: 'left', skin: '#b68976', espn: 135743, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 8, heading: 7, dribbling: 6, firstTouch: 9, linkUp: 5, pace: 2, strength: 10, offBall: 1, composure: 7 } },

  // ─── TOR ────────────────────────────────────────────────────────────
  { name: "Giovanni Simeone", short: "Simeone", team: 'TOR', nation: 'ARG', number: 18, height: 71, weight: 179, age: 31, foot: 'right', skin: '#b07962', espn: 189974, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 9, heading: 7, dribbling: 5, firstTouch: 2, linkUp: 2, pace: 6, strength: 7, offBall: 7, composure: 5 } },
  { name: "Alessio Cacciamani", short: "Cacciamani", team: 'TOR', nation: 'ITA', number: 77, height: 67, weight: null, age: 19, foot: 'left', skin: '#765144', espn: 403148, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 0, shotPower: 3, heading: 0, dribbling: 4, firstTouch: 2, linkUp: 0, pace: 6, strength: 4, offBall: 1, composure: 1 } },
  { name: "Nikola Vlasic", short: "Vlasic", team: 'TOR', nation: 'CRO', number: 10, height: 70, weight: 172, age: 29, foot: 'right', skin: '#b4856b', espn: 206378, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 7, shotPower: 7, heading: 4, dribbling: 6, firstTouch: 5, linkUp: 6, pace: 3, strength: 4, offBall: 4, composure: 10 } },
  { name: "Cesare Casadei", short: "Casadei", team: 'TOR', nation: 'ITA', number: 22, height: 76, weight: 170, age: 23, foot: 'right', skin: '#a07465', espn: 336394, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 7, shotPower: 6, heading: 10, dribbling: 5, firstTouch: 5, linkUp: 3, pace: 4, strength: 7, offBall: 5, composure: 4 } },
  { name: "Rolando Mandragora", short: "Mandragora", team: 'TOR', nation: 'ITA', number: 8, height: 72, weight: 168, age: 29, foot: 'left', skin: '#a77f64', espn: 210392, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 7, shotPower: 9, heading: 7, dribbling: 1, firstTouch: 5, linkUp: 6, pace: 2, strength: 7, offBall: 4, composure: 8 } },

  // ─── UDI ────────────────────────────────────────────────────────────
  { name: "Keinan Davis", short: "Davis", team: 'UDI', nation: 'JAM', number: 9, height: 75, weight: 150, age: 28, foot: 'left', skin: '#765144', espn: 233654, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 2, heading: 9, dribbling: 7, firstTouch: 6, linkUp: 5, pace: 8, strength: 4, offBall: 7, composure: 9 } },
  { name: "Jurgen Ekkelenkamp", short: "Ekkelenkamp", team: 'UDI', nation: 'NED', number: 32, height: 74, weight: 183, age: 26, foot: 'right', skin: '#bd8c72', espn: 270817, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 8, heading: 7, dribbling: 7, firstTouch: 6, linkUp: 4, pace: 3, strength: 8, offBall: 5, composure: 6 } },
  { name: "Nicolò Zaniolo", short: "Zaniolo", team: 'UDI', nation: 'ITA', number: 10, height: 75, weight: 172, age: 27, foot: 'left', skin: '#b77153', espn: 251388, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 6, heading: 8, dribbling: 5, firstTouch: 4, linkUp: 7, pace: 8, strength: 7, offBall: 6, composure: 5 } },
  { name: "Jesper Karlström", short: "Karlström", team: 'UDI', nation: 'SWE', number: 8, height: 72, weight: 179, age: 31, foot: 'right', skin: '#b68470', espn: 237055, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 7, heading: 4, dribbling: 2, firstTouch: 6, linkUp: 2, pace: 2, strength: 7, offBall: 1, composure: 6 } },
  { name: "Lennon Miller", short: "Miller", team: 'UDI', nation: 'SCO', number: 38, height: 72, weight: 159, age: 20, foot: 'right', skin: '#b07a65', espn: 347009, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 4, heading: 6, dribbling: 8, firstTouch: 8, linkUp: 5, pace: 5, strength: 3, offBall: 3, composure: 2 } },

  // ─── VEN ────────────────────────────────────────────────────────────
  { name: "Akor Adams", short: "Adams", team: 'VEN', nation: 'NGA', number: 45, height: 75, weight: 203, age: 26, foot: 'right', skin: '#785c4a', espn: 288472, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 8, heading: 8, dribbling: 6, firstTouch: 3, linkUp: 1, pace: 7, strength: 9, offBall: 8, composure: 9 } },
  { name: "Simon Sohm", short: "Sohm", team: 'VEN', nation: 'SUI', number: 19, height: 74, weight: 185, age: 25, foot: 'right', skin: '#9f6f56', espn: 275015, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 6, heading: 6, dribbling: 6, firstTouch: 7, linkUp: 5, pace: 3, strength: 8, offBall: 2, composure: 3 } },
  { name: "John Yeboah", short: "Yeboah", team: 'VEN', nation: 'ECU', number: 10, height: 67, weight: 146, age: 26, foot: 'left', skin: '#7a4830', espn: 265926, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 0, shotPower: 1, heading: 0, dribbling: 9, firstTouch: 5, linkUp: 6, pace: 9, strength: 1, offBall: 6, composure: 0 } },
  { name: "Toma Basic", short: "Basic", team: 'VEN', nation: 'CRO', number: 26, height: 74, weight: 174, age: 29, foot: 'left', skin: '#b07a65', espn: 221057, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 6, shotPower: 7, heading: 6, dribbling: 2, firstTouch: 5, linkUp: 6, pace: 2, strength: 8, offBall: 3, composure: 6 } },
  { name: "Gianluca Busio", short: "Busio", team: 'VEN', nation: 'USA', number: 6, height: 68, weight: 141, age: 24, foot: 'right', skin: '#814c3d', espn: 263705, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 2, heading: 2, dribbling: 2, firstTouch: 4, linkUp: 6, pace: 4, strength: 2, offBall: 1, composure: 5 } },

  // ─── FCU ────────────────────────────────────────────────────────────
  { name: "Emmanuel Latte Lath", short: "Latte Lath", team: 'FCU', nation: 'CIV', number: 29, height: 70, weight: 163, age: 27, foot: 'right', skin: '#765144', espn: 242439, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 1, shotPower: 3, heading: 7, dribbling: 2, firstTouch: 1, linkUp: 0, pace: 7, strength: 4, offBall: 4, composure: 2 } },
  { name: "Aljoscha Kemlein", short: "Kemlein", team: 'FCU', nation: 'GER', number: 6, height: 73, weight: 172, age: 22, foot: 'right', skin: '#876054', espn: 349922, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 6, heading: 7, dribbling: 8, firstTouch: 8, linkUp: 4, pace: 4, strength: 6, offBall: 3, composure: 4 } },
  { name: "Rani Khedira", short: "Khedira", team: 'FCU', nation: 'TUN', number: 8, height: 74, weight: 183, age: 32, foot: 'right', skin: '#b0856f', espn: 159152, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 8, shotPower: 8, heading: 7, dribbling: 1, firstTouch: 2, linkUp: 1, pace: 2, strength: 9, offBall: 2, composure: 5 } },
  { name: "Michel Aebischer", short: "Aebischer", team: 'FCU', nation: 'SUI', number: 20, height: 72, weight: 172, age: 29, foot: 'right', skin: '#b08073', espn: 245623, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 6, heading: 4, dribbling: 4, firstTouch: 6, linkUp: 5, pace: 2, strength: 5, offBall: 2, composure: 5 } },
  { name: "András Schäfer", short: "Schäfer", team: 'FCU', nation: 'HUN', number: 13, height: 70, weight: 152, age: 27, foot: 'right', skin: '#a2735e', espn: 284702, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 7, heading: 4, dribbling: 5, firstTouch: 5, linkUp: 3, pace: 3, strength: 5, offBall: 4, composure: 5 } },

  // ─── B04 ────────────────────────────────────────────────────────────
  { name: "Patrik Schick", short: "Schick", team: 'B04', nation: 'CZE', number: 14, height: 75, weight: 190, age: 30, foot: 'left', skin: '#ba816a', espn: 212330, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 10, heading: 10, dribbling: 2, firstTouch: 3, linkUp: 4, pace: 6, strength: 9, offBall: 10, composure: 10 } },
  { name: "Ibrahim Maza", short: "Maza", team: 'B04', nation: 'ALG', number: 30, height: 71, weight: 172, age: 20, foot: 'right', skin: '#c49276', espn: 361212, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 10, heading: 5, dribbling: 9, firstTouch: 7, linkUp: 8, pace: 7, strength: 6, offBall: 7, composure: 3 } },
  { name: "Aleix García", short: "García", team: 'B04', nation: 'ESP', number: 24, height: 68, weight: 150, age: 29, foot: 'right', skin: '#a17662', espn: 219294, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 3, heading: 2, dribbling: 1, firstTouch: 7, linkUp: 10, pace: 2, strength: 2, offBall: 3, composure: 7 } },
  { name: "Afonso Moreira", short: "Moreira", team: 'B04', nation: 'POR', number: 9, height: 69, weight: 150, age: 21, foot: 'right', skin: '#95705f', espn: 361258, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 2, heading: 3, dribbling: 5, firstTouch: 4, linkUp: 8, pace: 6, strength: 2, offBall: 5, composure: 5 } },
  { name: "Christian Kofane", short: "Kofane", team: 'B04', nation: 'CMR', number: 35, height: 74, weight: 174, age: 20, foot: 'right', skin: '#764738', espn: 398709, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 6, heading: 8, dribbling: 5, firstTouch: 5, linkUp: 5, pace: 8, strength: 6, offBall: 8, composure: 3 } },

  // ─── FCB ────────────────────────────────────────────────────────────
  { name: "Harry Kane", short: "Kane", team: 'FCB', nation: 'ENG', number: 9, height: 74, weight: 190, age: 33, foot: 'right', skin: '#ae8071', espn: 142200, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 11, shotPower: 9, heading: 9, dribbling: 8, firstTouch: 8, linkUp: 11, pace: 3, strength: 9, offBall: 11, composure: 11 } },
  { name: "Jamal Musiala", short: "Musiala", team: 'FCB', nation: 'GER', number: 10, height: 73, weight: 163, age: 23, foot: 'right', skin: '#a06a54', espn: 303821, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 6, heading: 7, dribbling: 10, firstTouch: 9, linkUp: 8, pace: 8, strength: 5, offBall: 7, composure: 6 } },
  { name: "Michael Olise", short: "Olise", team: 'FCB', nation: 'FRA', number: 17, height: 71, weight: 172, age: 24, foot: 'left', skin: '#9b6e57', espn: 286831, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 10, shotPower: 11, heading: 5, dribbling: 9, firstTouch: 10, linkUp: 11, pace: 7, strength: 7, offBall: 10, composure: 9 } },
  { name: "Aleksandar Pavlovic", short: "Pavlovic", team: 'FCB', nation: 'GER', number: 45, height: 74, weight: 172, age: 22, foot: 'both', skin: '#b0856f', espn: 359370, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 7, shotPower: 9, heading: 6, dribbling: 5, firstTouch: 9, linkUp: 9, pace: 4, strength: 6, offBall: 4, composure: 5 } },
  { name: "Luis Díaz", short: "Díaz", team: 'FCB', nation: 'COL', number: 14, height: 71, weight: 152, age: 29, foot: 'right', skin: '#99736a', espn: 257390, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 8, shotPower: 5, heading: 7, dribbling: 9, firstTouch: 7, linkUp: 10, pace: 6, strength: 3, offBall: 10, composure: 10 } },

  // ─── BVB ────────────────────────────────────────────────────────────
  { name: "Serhou Guirassy", short: "Guirassy", team: 'BVB', nation: 'GUI', number: 9, height: 74, weight: 181, age: 30, foot: 'right', skin: '#8e635b', espn: 186381, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 6, heading: 10, dribbling: 4, firstTouch: 4, linkUp: 4, pace: 6, strength: 8, offBall: 11, composure: 8 } },
  { name: "Felix Nmecha", short: "Nmecha", team: 'BVB', nation: 'GER', number: 8, height: 75, weight: 161, age: 26, foot: 'right', skin: '#a87761', espn: 281122, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 5, heading: 7, dribbling: 9, firstTouch: 9, linkUp: 6, pace: 5, strength: 8, offBall: 5, composure: 2 } },
  { name: "Jobe Bellingham", short: "Bellingham", team: 'BVB', nation: 'ENG', number: 7, height: 74, weight: 161, age: 21, foot: 'right', skin: '#b07a65', espn: 324820, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 6, heading: 7, dribbling: 5, firstTouch: 6, linkUp: 5, pace: 5, strength: 6, offBall: 3, composure: 5 } },
  { name: "Maximilian Beier", short: "Beier", team: 'BVB', nation: 'GER', number: 14, height: 72, weight: 159, age: 24, foot: 'right', skin: '#bc8f79', espn: 290639, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 8, shotPower: 6, heading: 6, dribbling: 4, firstTouch: 4, linkUp: 6, pace: 5, strength: 5, offBall: 8, composure: 3 } },
  { name: "Ethan Nwaneri", short: "Nwaneri", team: 'BVB', nation: 'ENG', number: 18, height: 69, weight: 152, age: 19, foot: 'left', skin: '#936750', espn: 349733, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 2, heading: 3, dribbling: 7, firstTouch: 6, linkUp: 6, pace: 8, strength: 2, offBall: 5, composure: 3 } },

  // ─── BMG ────────────────────────────────────────────────────────────
  { name: "Isac Lidberg", short: "Lidberg", team: 'BMG', nation: 'SWE', number: 3, height: 73, weight: 183, age: 28, foot: 'right', skin: '#d19781', espn: 221690, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 7, heading: 6, dribbling: 1, firstTouch: 0, linkUp: 1, pace: 6, strength: 7, offBall: 6, composure: 0 } },
  { name: "Wael Mohya", short: "Mohya", team: 'BMG', nation: 'GER', number: 36, height: 69, weight: 141, age: 17, foot: 'both', skin: '#ae8071', espn: 408539, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 2, heading: 4, dribbling: 9, firstTouch: 5, linkUp: 5, pace: 9, strength: 1, offBall: 6, composure: 4 } },
  { name: "Hugo Bolin", short: "Bolin", team: 'BMG', nation: 'SWE', number: 38, height: 70, weight: 139, age: 23, foot: 'right', skin: '#94685a', espn: 330239, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 4, heading: 6, dribbling: 5, firstTouch: 5, linkUp: 5, pace: 5, strength: 3, offBall: 6, composure: 4 } },
  { name: "Franck Honorat", short: "Honorat", team: 'BMG', nation: 'FRA', number: 9, height: 71, weight: 152, age: 30, foot: 'right', skin: '#a87e66', espn: 196029, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 5, shotPower: 4, heading: 5, dribbling: 3, firstTouch: 4, linkUp: 9, pace: 4, strength: 3, offBall: 4, composure: 6 } },
  { name: "Shuto Machino", short: "Machino", team: 'BMG', nation: 'JPN', number: 18, height: 73, weight: 179, age: 27, foot: 'right', skin: '#b0887e', espn: 271352, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 6, heading: 7, dribbling: 2, firstTouch: 3, linkUp: 4, pace: 5, strength: 6, offBall: 6, composure: 6 } },

  // ─── SGE ────────────────────────────────────────────────────────────
  { name: "Jonathan Burkardt", short: "Burkardt", team: 'SGE', nation: 'GER', number: 9, height: 71, weight: 168, age: 26, foot: 'right', skin: '#c58e72', espn: 274887, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 5, heading: 7, dribbling: 5, firstTouch: 4, linkUp: 3, pace: 7, strength: 5, offBall: 9, composure: 8 } },
  { name: "Can Uzun", short: "Uzun", team: 'SGE', nation: 'TUR', number: 42, height: 73, weight: 183, age: 20, foot: 'right', skin: '#99736a', espn: 355369, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 10, shotPower: 7, heading: 6, dribbling: 5, firstTouch: 5, linkUp: 8, pace: 6, strength: 8, offBall: 7, composure: 6 } },
  { name: "Ritsu Doan", short: "Doan", team: 'SGE', nation: 'JPN', number: 20, height: 68, weight: 152, age: 28, foot: 'left', skin: '#a87861', espn: 219627, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 4, heading: 1, dribbling: 5, firstTouch: 4, linkUp: 7, pace: 4, strength: 3, offBall: 5, composure: 5 } },
  { name: "Raphael Onyedika", short: "Onyedika", team: 'SGE', nation: 'NGA', number: 25, height: 72, weight: 172, age: 25, foot: 'right', skin: '#8e624e', espn: 320882, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 4, heading: 6, dribbling: 6, firstTouch: 7, linkUp: 2, pace: 3, strength: 6, offBall: 1, composure: 3 } },
  { name: "Farès Chaïbi", short: "Chaïbi", team: 'SGE', nation: 'ALG', number: 8, height: 72, weight: 150, age: 23, foot: 'right', skin: '#c78a68', espn: 337306, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 3, heading: 5, dribbling: 4, firstTouch: 5, linkUp: 9, pace: 4, strength: 2, offBall: 5, composure: 3 } },

  // ─── FCA ────────────────────────────────────────────────────────────
  { name: "Michael Gregoritsch", short: "Gregoritsch", team: 'FCA', nation: 'AUT', number: 11, height: 76, weight: 201, age: 32, foot: 'left', skin: '#c28871', espn: 146804, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 8, heading: 10, dribbling: 1, firstTouch: 2, linkUp: 3, pace: 4, strength: 10, offBall: 8, composure: 10 } },
  { name: "Fabian Rieder", short: "Rieder", team: 'FCA', nation: 'SUI', number: 32, height: 70, weight: 161, age: 24, foot: 'left', skin: '#b68470', espn: 308908, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 7, shotPower: 9, heading: 5, dribbling: 5, firstTouch: 6, linkUp: 7, pace: 4, strength: 5, offBall: 4, composure: 9 } },
  { name: "Han-Noah Massengo", short: "Massengo", team: 'FCA', nation: 'FRA', number: 4, height: 70, weight: 152, age: 25, foot: 'right', skin: '#8d6249', espn: 282885, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 3, heading: 4, dribbling: 7, firstTouch: 8, linkUp: 4, pace: 4, strength: 3, offBall: 2, composure: 6 } },
  { name: "Anton Kade", short: "Kade", team: 'FCA', nation: 'GER', number: 30, height: 73, weight: 159, age: 22, foot: 'right', skin: '#8e624e', espn: 333837, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 8, heading: 8, dribbling: 6, firstTouch: 3, linkUp: 5, pace: 6, strength: 3, offBall: 7, composure: 4 } },
  { name: "Arijon Ibrahimovic", short: "Ibrahimovic", team: 'FCA', nation: 'GER', number: 21, height: 69, weight: 150, age: 20, foot: 'right', skin: '#c38f80', espn: 333400, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 1, shotPower: 2, heading: 5, dribbling: 5, firstTouch: 5, linkUp: 8, pace: 6, strength: 4, offBall: 6, composure: 5 } },

  // ─── KOE ────────────────────────────────────────────────────────────
  { name: "Marius Bulter", short: "Bulter", team: 'KOE', nation: 'GER', number: 30, height: 74, weight: 185, age: 33, foot: 'right', skin: '#ad8271', espn: 275797, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 7, heading: 9, dribbling: 3, firstTouch: 3, linkUp: 6, pace: 4, strength: 9, offBall: 6, composure: 5 } },
  { name: "Said El Mala", short: "El Mala", team: 'KOE', nation: 'GER', number: 10, height: 72, weight: 159, age: 20, foot: 'both', skin: '#c18c71', espn: 380795, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 8, shotPower: 7, heading: 4, dribbling: 6, firstTouch: 4, linkUp: 4, pace: 9, strength: 2, offBall: 10, composure: 4 } },
  { name: "Tom Krauss", short: "Krauss", team: 'KOE', nation: 'GER', number: 5, height: 72, weight: 159, age: 25, foot: 'right', skin: '#b0856f', espn: 283683, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 4, heading: 6, dribbling: 3, firstTouch: 6, linkUp: 5, pace: 3, strength: 6, offBall: 2, composure: 5 } },
  { name: "Ísak Jóhannesson", short: "Jóhannesson", team: 'KOE', nation: 'ISL', number: 8, height: 71, weight: 159, age: 23, foot: 'left', skin: '#a67f6b', espn: 286815, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 6, heading: 3, dribbling: 8, firstTouch: 10, linkUp: 7, pace: 3, strength: 3, offBall: 4, composure: 5 } },
  { name: "Linton Maina", short: "Maina", team: 'KOE', nation: 'GER', number: 37, height: 68, weight: 152, age: 27, foot: 'right', skin: '#9b6e57', espn: 231173, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 3, heading: 1, dribbling: 4, firstTouch: 4, linkUp: 6, pace: 4, strength: 2, offBall: 4, composure: 5 } },

  // ─── HSV ────────────────────────────────────────────────────────────
  { name: "Yussuf Poulsen", short: "Poulsen", team: 'HSV', nation: 'DEN', number: 15, height: 76, weight: 183, age: 32, foot: 'right', skin: '#95705f', espn: 182245, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 5, heading: 9, dribbling: 6, firstTouch: 5, linkUp: 4, pace: 7, strength: 10, offBall: 5, composure: 5 } },
  { name: "Fabio Vieira", short: "Vieira", team: 'HSV', nation: 'POR', number: 20, height: 67, weight: 128, age: 26, foot: 'left', skin: '#b28376', espn: 88865, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 2, heading: 2, dribbling: 7, firstTouch: 6, linkUp: 7, pace: 6, strength: 1, offBall: 6, composure: 8 } },
  { name: "Albert Sambi Lokonga", short: "Lokonga", team: 'HSV', nation: 'BEL', number: 6, height: 72, weight: 148, age: 27, foot: 'right', skin: '#6b493d', espn: 268239, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 8, shotPower: 3, heading: 5, dribbling: 4, firstTouch: 6, linkUp: 5, pace: 3, strength: 4, offBall: 3, composure: 6 } },
  { name: "Nicolai Remberg", short: "Remberg", team: 'HSV', nation: 'GER', number: 21, height: 74, weight: 192, age: 26, foot: 'right', skin: '#95705f', espn: 321226, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 8, heading: 7, dribbling: 5, firstTouch: 7, linkUp: 3, pace: 2, strength: 10, offBall: 2, composure: 6 } },
  { name: "Martin Adeline", short: "Adeline", team: 'HSV', nation: 'FRA', number: 5, height: 71, weight: 139, age: 22, foot: 'right', skin: '#946c58', espn: 332878, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 0, heading: 6, dribbling: 2, firstTouch: 2, linkUp: 6, pace: 5, strength: 1, offBall: 2, composure: 2 } },

  // ─── M05 ────────────────────────────────────────────────────────────
  { name: "Phillip Tietz", short: "Tietz", team: 'M05', nation: 'GER', number: 9, height: 75, weight: 190, age: 29, foot: 'right', skin: '#a87e66', espn: 234376, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 10, heading: 11, dribbling: 4, firstTouch: 2, linkUp: 2, pace: 6, strength: 10, offBall: 9, composure: 1 } },
  { name: "Kaishu Sano", short: "Sano", team: 'M05', nation: 'JPN', number: 6, height: 69, weight: 148, age: 25, foot: 'both', skin: '#765144', espn: 357030, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 4, heading: 3, dribbling: 7, firstTouch: 7, linkUp: 5, pace: 4, strength: 3, offBall: 2, composure: 6 } },
  { name: "Nadiem Amiri", short: "Amiri", team: 'M05', nation: 'GER', number: 10, height: 71, weight: 163, age: 30, foot: 'right', skin: '#a1775f', espn: 210818, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 8, shotPower: 5, heading: 5, dribbling: 6, firstTouch: 7, linkUp: 10, pace: 3, strength: 5, offBall: 6, composure: 9 } },
  { name: "Sheraldo Becker", short: "Becker", team: 'M05', nation: 'SUR', number: 23, height: 71, weight: 170, age: 31, foot: 'right', skin: '#764738', espn: 195027, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 6, heading: 6, dribbling: 4, firstTouch: 2, linkUp: 9, pace: 6, strength: 4, offBall: 7, composure: 8 } },
  { name: "Lee Jae-Sung", short: "Jae-Sung", team: 'M05', nation: 'KOR', number: 7, height: 71, weight: 152, age: 34, foot: 'left', skin: '#95705f', espn: 134103, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 6, shotPower: 3, heading: 8, dribbling: 3, firstTouch: 4, linkUp: 5, pace: 2, strength: 5, offBall: 5, composure: 5 } },

  // ─── RBL ────────────────────────────────────────────────────────────
  { name: "Rômulo", short: "Rômulo", team: 'RBL', nation: 'BRA', number: 40, height: 76, weight: 172, age: 24, foot: 'right', skin: '#ae8071', espn: 324766, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 5, heading: 8, dribbling: 3, firstTouch: 3, linkUp: 5, pace: 7, strength: 8, offBall: 9, composure: 1 } },
  { name: "Antonio Nusa", short: "Nusa", team: 'RBL', nation: 'NOR', number: 7, height: 72, weight: 170, age: 21, foot: 'right', skin: '#9f6f56', espn: 319368, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 7, heading: 5, dribbling: 11, firstTouch: 8, linkUp: 8, pace: 9, strength: 8, offBall: 6, composure: 8 } },
  { name: "Neil El Aynaoui", short: "El Aynaoui", team: 'RBL', nation: 'MAR', number: 21, height: 73, weight: 174, age: 25, foot: 'right', skin: '#936654', espn: 323807, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 5, heading: 6, dribbling: 6, firstTouch: 8, linkUp: 6, pace: 4, strength: 9, offBall: 4, composure: 5 } },
  { name: "Ezechiel Banzuzi", short: "Banzuzi", team: 'RBL', nation: 'COD', number: 6, height: 75, weight: 174, age: 21, foot: 'right', skin: '#6d4639', espn: 330233, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 7, heading: 8, dribbling: 6, firstTouch: 5, linkUp: 5, pace: 4, strength: 9, offBall: 5, composure: 3 } },
  { name: "Brajan Gruda", short: "Gruda", team: 'RBL', nation: 'GER', number: 10, height: 70, weight: 152, age: 22, foot: 'left', skin: '#ac8673', espn: 357683, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 3, heading: 4, dribbling: 11, firstTouch: 9, linkUp: 9, pace: 10, strength: 6, offBall: 6, composure: 6 } },

  // ─── SCF ────────────────────────────────────────────────────────────
  { name: "Igor Matanovic", short: "Matanovic", team: 'SCF', nation: 'CRO', number: 31, height: 76, weight: 196, age: 23, foot: 'right', skin: '#c89070', espn: 310883, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 7, heading: 11, dribbling: 6, firstTouch: 2, linkUp: 3, pace: 8, strength: 9, offBall: 9, composure: 2 } },
  { name: "Yuito Suzuki", short: "Suzuki", team: 'SCF', nation: 'JPN', number: 14, height: 69, weight: 157, age: 25, foot: 'right', skin: '#95705f', espn: 303031, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 4, heading: 4, dribbling: 7, firstTouch: 5, linkUp: 5, pace: 5, strength: 3, offBall: 6, composure: 4 } },
  { name: "Derry Scherhant", short: "Scherhant", team: 'SCF', nation: 'GER', number: 7, height: 73, weight: 172, age: 23, foot: 'right', skin: '#a67f6b', espn: 346619, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 8, shotPower: 5, heading: 5, dribbling: 6, firstTouch: 4, linkUp: 6, pace: 6, strength: 5, offBall: 6, composure: 3 } },
  { name: "Maximilian Eggestein", short: "Eggestein", team: 'SCF', nation: 'GER', number: 8, height: 71, weight: 163, age: 29, foot: 'right', skin: '#c98f78', espn: 214203, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 5, heading: 5, dribbling: 6, firstTouch: 8, linkUp: 3, pace: 2, strength: 4, offBall: 4, composure: 7 } },
  { name: "Yannick Engelhardt", short: "Engelhardt", team: 'SCF', nation: 'GER', number: 16, height: 72, weight: 161, age: 25, foot: 'right', skin: '#ae8071', espn: 337079, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 9, heading: 7, dribbling: 3, firstTouch: 6, linkUp: 4, pace: 3, strength: 6, offBall: 3, composure: 5 } },

  // ─── SCP ────────────────────────────────────────────────────────────
  { name: "Stefano Marino", short: "Marino", team: 'SCP', nation: 'GER', number: 30, height: 73, weight: 172, age: 22, foot: 'right', skin: '#a67f6b', espn: 332543, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 3, heading: 5, dribbling: 2, firstTouch: 0, linkUp: 1, pace: 8, strength: 4, offBall: 6, composure: 2 } },
  { name: "Santiago Castaneda", short: "Castaneda", team: 'SCP', nation: 'USA', number: 5, height: 74, weight: 161, age: 21, foot: 'right', skin: '#b4856b', espn: 338837, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 2, heading: 7, dribbling: 0, firstTouch: 2, linkUp: 2, pace: 4, strength: 7, offBall: 1, composure: 1 } },
  { name: "Laurin Ulrich", short: "Ulrich", team: 'SCP', nation: 'GER', number: 28, height: 71, weight: 168, age: 21, foot: 'right', skin: '#906a59', espn: 345394, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 4, heading: 2, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 5, strength: 5, offBall: 1, composure: 2 } },
  { name: "Marvin Pieringer", short: "Pieringer", team: 'SCP', nation: 'GER', number: 18, height: 75, weight: 179, age: 27, foot: 'right', skin: '#c29a86', espn: 312389, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 7, heading: 9, dribbling: 5, firstTouch: 2, linkUp: 2, pace: 6, strength: 6, offBall: 6, composure: 6 } },
  { name: "Rayan Philippe", short: "Philippe", team: 'SCP', nation: 'FRA', number: 9, height: 72, weight: 172, age: 26, foot: 'left', skin: '#ac8673', espn: 291849, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 7, shotPower: 8, heading: 5, dribbling: 4, firstTouch: 3, linkUp: 4, pace: 5, strength: 5, offBall: 7, composure: 1 } },

  // ─── SVE ────────────────────────────────────────────────────────────
  { name: "David Mokwa", short: "Mokwa", team: 'SVE', nation: 'FRA', number: 42, height: 71, weight: 179, age: 22, foot: 'right', skin: '#5d4638', espn: 398004, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 4, heading: 1, dribbling: 3, firstTouch: 2, linkUp: 1, pace: 8, strength: 5, offBall: 5, composure: 3 } },
  { name: "Francis-Ikechukwu Onyeka", short: "Onyeka", team: 'SVE', nation: 'GER', number: 40, height: 74, weight: 161, age: 19, foot: 'left', skin: '#99736a', espn: 379180, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 2, heading: 6, dribbling: 4, firstTouch: 1, linkUp: 1, pace: 6, strength: 4, offBall: 4, composure: 1 } },
  { name: "Cole Campbell", short: "Campbell", team: 'SVE', nation: 'USA', number: 39, height: 67, weight: 150, age: 20, foot: 'left', skin: '#a2735e', espn: 379024, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 2, heading: 2, dribbling: 6, firstTouch: 4, linkUp: 5, pace: 9, strength: 3, offBall: 5, composure: 3 } },
  { name: "Lukasz Poreba", short: "Poreba", team: 'SVE', nation: 'POL', number: 8, height: 70, weight: 168, age: 26, foot: 'right', skin: '#ba7f76', espn: 326499, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 3, heading: 1, dribbling: 1, firstTouch: 4, linkUp: 2, pace: 2, strength: 2, offBall: 0, composure: 4 } },
  { name: "Lukas Petkov", short: "Petkov", team: 'SVE', nation: 'BUL', number: 25, height: 72, weight: 168, age: 26, foot: 'right', skin: '#b0856f', espn: 310692, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 8, heading: 6, dribbling: 8, firstTouch: 3, linkUp: 3, pace: 6, strength: 5, offBall: 3, composure: 0 } },

  // ─── S04 ────────────────────────────────────────────────────────────
  { name: "Junior Adamu", short: "Adamu", team: 'S04', nation: 'AUT', number: 20, height: 72, weight: 172, age: 25, foot: 'right', skin: '#977872', espn: 305957, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 5, heading: 6, dribbling: 2, firstTouch: 1, linkUp: 3, pace: 6, strength: 5, offBall: 5, composure: 2 } },
  { name: "Soufian El-Faouzi", short: "El-Faouzi", team: 'S04', nation: 'MAR', number: 23, height: 70, weight: 150, age: 24, foot: 'right', skin: '#bd8a78', espn: 318343, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 1, heading: 1, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 5, strength: 1, offBall: 0, composure: 2 } },
  { name: "Adil Aouchiche", short: "Aouchiche", team: 'S04', nation: 'ALG', number: 24, height: 71, weight: 159, age: 24, foot: 'right', skin: '#b68976', espn: 290166, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 3, heading: 3, dribbling: 4, firstTouch: 3, linkUp: 3, pace: 5, strength: 3, offBall: 4, composure: 1 } },
  { name: "Satoshi Tanaka", short: "Tanaka", team: 'S04', nation: 'JPN', number: 13, height: 69, weight: 161, age: 24, foot: 'left', skin: '#7b6051', espn: 297565, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 2, heading: 1, dribbling: 5, firstTouch: 4, linkUp: 2, pace: 4, strength: 5, offBall: 0, composure: 2 } },
  { name: "Junior Dina Ebimbe", short: "Dina Ebimbe", team: 'S04', nation: 'CMR', number: 29, height: 72, weight: 168, age: 25, foot: 'right', skin: '#6b493d', espn: 287645, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 5, heading: 7, dribbling: 1, firstTouch: 3, linkUp: 2, pace: 3, strength: 6, offBall: 5, composure: 3 } },

  // ─── TSG ────────────────────────────────────────────────────────────
  { name: "Adam Hlozek", short: "Hlozek", team: 'TSG', nation: 'CZE', number: 10, height: 74, weight: 183, age: 24, foot: 'right', skin: '#a1775f', espn: 292169, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 5, heading: 8, dribbling: 6, firstTouch: 4, linkUp: 4, pace: 7, strength: 8, offBall: 6, composure: 4 } },
  { name: "Leon Avdullahu", short: "Avdullahu", team: 'TSG', nation: 'KVX', number: 7, height: 73, weight: 172, age: 22, foot: 'right', skin: '#a1775f', espn: 362590, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 9, heading: 7, dribbling: 3, firstTouch: 7, linkUp: 6, pace: 3, strength: 7, offBall: 1, composure: 5 } },
  { name: "Fisnik Asllani", short: "Asllani", team: 'TSG', nation: 'KVX', number: 11, height: 75, weight: 179, age: 24, foot: 'both', skin: '#a67f6b', espn: 331057, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 6, heading: 8, dribbling: 4, firstTouch: 3, linkUp: 6, pace: 6, strength: 8, offBall: 9, composure: 6 } },
  { name: "Wouter Burger", short: "Burger", team: 'TSG', nation: 'NED', number: 18, height: 75, weight: 183, age: 25, foot: 'left', skin: '#a57059', espn: 274860, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 10, heading: 9, dribbling: 2, firstTouch: 5, linkUp: 7, pace: 2, strength: 10, offBall: 4, composure: 6 } },
  { name: "Adam Daghim", short: "Daghim", team: 'TSG', nation: 'DEN', number: 14, height: 74, weight: 174, age: 21, foot: 'left', skin: '#a67f6b', espn: 338854, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 8, heading: 7, dribbling: 5, firstTouch: 4, linkUp: 6, pace: 6, strength: 6, offBall: 5, composure: 2 } },

  // ─── VFB ────────────────────────────────────────────────────────────
  { name: "Ermedin Demirovic", short: "Demirovic", team: 'VFB', nation: 'BIH', number: 9, height: 73, weight: 183, age: 28, foot: 'right', skin: '#b0887e', espn: 269136, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 7, heading: 7, dribbling: 4, firstTouch: 3, linkUp: 3, pace: 6, strength: 6, offBall: 9, composure: 6 } },
  { name: "Angelo Stiller", short: "Stiller", team: 'VFB', nation: 'GER', number: 6, height: 72, weight: 170, age: 25, foot: 'left', skin: '#a67f6b', espn: 290232, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 9, heading: 6, dribbling: 4, firstTouch: 8, linkUp: 9, pace: 3, strength: 7, offBall: 2, composure: 0 } },
  { name: "Jamie Leweling", short: "Leweling", team: 'VFB', nation: 'GER', number: 18, height: 73, weight: 190, age: 25, foot: 'both', skin: '#9b664b', espn: 290811, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 8, heading: 6, dribbling: 7, firstTouch: 5, linkUp: 7, pace: 5, strength: 8, offBall: 5, composure: 6 } },
  { name: "Bilal El Khannouss", short: "El Khannouss", team: 'VFB', nation: 'MAR', number: 11, height: 71, weight: 152, age: 22, foot: 'right', skin: '#b57c66', espn: 336595, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 6, heading: 6, dribbling: 7, firstTouch: 7, linkUp: 9, pace: 6, strength: 5, offBall: 5, composure: 5 } },
  { name: "Deniz Undav", short: "Undav", team: 'VFB', nation: 'GER', number: 26, height: 70, weight: 190, age: 30, foot: 'both', skin: '#b47f62', espn: 273300, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 7, heading: 3, dribbling: 4, firstTouch: 5, linkUp: 6, pace: 4, strength: 4, offBall: 10, composure: 8 } },

  // ─── SVW ────────────────────────────────────────────────────────────
  { name: "Niclas Füllkrug", short: "Füllkrug", team: 'SVW', nation: 'GER', number: 10, height: 74, weight: 183, age: 33, foot: 'right', skin: '#b4856b', espn: 170257, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 6, heading: 10, dribbling: 2, firstTouch: 3, linkUp: 4, pace: 5, strength: 8, offBall: 8, composure: 8 } },
  { name: "Chuki", short: "Chuki", team: 'SVW', nation: 'ESP', number: 20, height: 68, weight: 139, age: 22, foot: 'left', skin: '#a07465', espn: 371689, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 2, shotPower: 1, heading: 0, dribbling: 2, firstTouch: 2, linkUp: 5, pace: 5, strength: 1, offBall: 4, composure: 3 } },
  { name: "Marco Grüll", short: "Grüll", team: 'SVW', nation: 'AUT', number: 17, height: 72, weight: 161, age: 28, foot: 'both', skin: '#b68065', espn: 305853, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 5, heading: 6, dribbling: 7, firstTouch: 5, linkUp: 7, pace: 4, strength: 7, offBall: 5, composure: 6 } },
  { name: "Senne Lynen", short: "Lynen", team: 'SVW', nation: 'BEL', number: 14, height: 73, weight: 174, age: 27, foot: 'right', skin: '#c59681', espn: 270389, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 7, heading: 6, dribbling: 1, firstTouch: 4, linkUp: 4, pace: 2, strength: 8, offBall: 3, composure: 5 } },
  { name: "Youri Regeer", short: "Regeer", team: 'SVW', nation: 'NED', number: 44, height: 70, weight: 150, age: 23, foot: 'right', skin: '#a67f6b', espn: 297292, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 0, shotPower: 1, heading: 3, dribbling: 3, firstTouch: 6, linkUp: 4, pace: 3, strength: 4, offBall: 1, composure: 2 } },

  // ─── AUX ────────────────────────────────────────────────────────────
  { name: "Cameron Archer", short: "Archer", team: 'AUX', nation: 'JAM', number: 9, height: 71, weight: 159, age: 24, foot: 'right', skin: '#ae7254', espn: 293347, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 1, heading: 6, dribbling: 2, firstTouch: 1, linkUp: 3, pace: 7, strength: 1, offBall: 6, composure: 3 } },
  { name: "Kévin Danois", short: "Danois", team: 'AUX', nation: 'FRA', number: 5, height: 72, weight: 159, age: 22, foot: 'right', skin: '#a97459', espn: 323722, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 3, heading: 5, dribbling: 8, firstTouch: 8, linkUp: 6, pace: 5, strength: 6, offBall: 2, composure: 5 } },
  { name: "Danny Namaso", short: "Namaso", team: 'AUX', nation: 'CMR', number: 10, height: 72, weight: 170, age: 26, foot: 'right', skin: '#9f674d', espn: 243748, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 5, heading: 6, dribbling: 5, firstTouch: 2, linkUp: 4, pace: 5, strength: 5, offBall: 5, composure: 5 } },
  { name: "Naouirou Ahamada", short: "Ahamada", team: 'AUX', nation: 'FRA', number: 8, height: 72, weight: 161, age: 24, foot: 'right', skin: '#99736a', espn: 297775, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 5, heading: 5, dribbling: 4, firstTouch: 4, linkUp: 4, pace: 4, strength: 4, offBall: 3, composure: 4 } },
  { name: "Romain Faivre", short: "Faivre", team: 'AUX', nation: 'FRA', number: 21, height: 71, weight: 163, age: 28, foot: 'left', skin: '#c29a86', espn: 268591, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 7, heading: 4, dribbling: 7, firstTouch: 6, linkUp: 7, pace: 6, strength: 6, offBall: 5, composure: 6 } },

  // ─── MON ────────────────────────────────────────────────────────────
  { name: "Paris Brunner", short: "Brunner", team: 'MON', nation: 'GER', number: 29, height: 73, weight: 174, age: 20, foot: 'right', skin: '#9b6e57', espn: 365789, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 6, heading: 8, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 7, strength: 5, offBall: 6, composure: 3 } },
  { name: "Lamine Camara", short: "Camara", team: 'MON', nation: 'SEN', number: 15, height: 68, weight: 141, age: 22, foot: 'right', skin: '#765144', espn: 38721, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 1, heading: 1, dribbling: 5, firstTouch: 8, linkUp: 7, pace: 5, strength: 6, offBall: 2, composure: 5 } },
  { name: "Folarin Balogun", short: "Balogun", team: 'MON', nation: 'USA', number: 9, height: 70, weight: 146, age: 25, foot: 'right', skin: '#815341', espn: 282643, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 2, heading: 4, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 7, strength: 3, offBall: 8, composure: 10 } },
  { name: "Aleksandr Golovin", short: "Golovin", team: 'MON', nation: 'RUS', number: 10, height: 70, weight: 150, age: 30, foot: 'right', skin: '#ce9c87', espn: 195501, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 3, heading: 2, dribbling: 8, firstTouch: 7, linkUp: 7, pace: 4, strength: 3, offBall: 4, composure: 6 } },
  { name: "Denis Zakaria", short: "Zakaria", team: 'MON', nation: 'SUI', number: 6, height: 75, weight: 168, age: 29, foot: 'right', skin: '#764738', espn: 222628, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 5, heading: 7, dribbling: 4, firstTouch: 7, linkUp: 3, pace: 2, strength: 6, offBall: 2, composure: 3 } },

  // ─── ANG ────────────────────────────────────────────────────────────
  { name: "Amine El Ouazzani", short: "El Ouazzani", team: 'ANG', nation: 'MAR', number: 19, height: 74, weight: 139, age: 25, foot: 'left', skin: '#b77a60', espn: 301262, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 2, heading: 8, dribbling: 6, firstTouch: 3, linkUp: 2, pace: 8, strength: 3, offBall: 5, composure: 6 } },
  { name: "Prosper Peter", short: "Peter", team: 'ANG', nation: 'FRA', number: 9, height: 70, weight: null, age: 19, foot: 'right', skin: '#784f39', espn: 403232, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 4, heading: 8, dribbling: 1, firstTouch: 1, linkUp: 2, pace: 8, strength: 6, offBall: 7, composure: 2 } },
  { name: "Yassin Belkhdim", short: "Belkhdim", team: 'ANG', nation: 'FRA', number: 14, height: 69, weight: 152, age: 24, foot: 'right', skin: '#b67d5e', espn: 338006, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 3, shotPower: 3, heading: 3, dribbling: 0, firstTouch: 3, linkUp: 2, pace: 3, strength: 2, offBall: 2, composure: 4 } },
  { name: "Amine Sbaï", short: "Sbaï", team: 'ANG', nation: 'MAR', number: 10, height: 69, weight: 159, age: 26, foot: 'right', skin: '#c48a6f', espn: 314388, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 6, heading: 2, dribbling: 7, firstTouch: 3, linkUp: 5, pace: 6, strength: 4, offBall: 5, composure: 0 } },
  { name: "Branco van den Boomen", short: "van den Boomen", team: 'ANG', nation: 'NED', number: 8, height: 74, weight: 163, age: 31, foot: 'right', skin: '#ba7f76', espn: 196234, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 6, heading: 6, dribbling: 5, firstTouch: 7, linkUp: 7, pace: 3, strength: 5, offBall: 1, composure: 2 } },

  // ─── BST ────────────────────────────────────────────────────────────
  { name: "Ludovic Ajorque", short: "Ajorque", team: 'BST', nation: 'FRA', number: 19, height: 78, weight: 203, age: 32, foot: 'left', skin: '#d8a68a', espn: 192015, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 10, heading: 11, dribbling: 6, firstTouch: 4, linkUp: 3, pace: 5, strength: 11, offBall: 7, composure: 6 } },
  { name: "Kamory Doumbia", short: "Doumbia", team: 'BST', nation: 'MLI', number: 23, height: 67, weight: 117, age: 23, foot: 'right', skin: '#59463b', espn: 330412, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 0, heading: 2, dribbling: 3, firstTouch: 2, linkUp: 5, pace: 5, strength: 0, offBall: 5, composure: 7 } },
  { name: "Joris Chotard", short: "Chotard", team: 'BST', nation: 'FRA', number: 13, height: 70, weight: 152, age: 25, foot: 'right', skin: '#bd7e71', espn: 291850, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 2, heading: 3, dribbling: 0, firstTouch: 4, linkUp: 3, pace: 3, strength: 3, offBall: 1, composure: 3 } },
  { name: "Hugo Magnetti", short: "Magnetti", team: 'BST', nation: 'FRA', number: 8, height: 71, weight: 163, age: 28, foot: 'right', skin: '#b88a7a', espn: 250377, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 4, heading: 4, dribbling: 6, firstTouch: 7, linkUp: 3, pace: 3, strength: 6, offBall: 1, composure: 6 } },
  { name: "Pathé Mboup", short: "Mboup", team: 'BST', nation: 'SEN', number: 9, height: 69, weight: null, age: 23, foot: 'right', skin: '#644536', espn: 365783, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 3, shotPower: 6, heading: 2, dribbling: 7, firstTouch: 3, linkUp: 4, pace: 6, strength: 3, offBall: 6, composure: 3 } },

  // ─── HAC ────────────────────────────────────────────────────────────
  { name: "Josh Maja", short: "Maja", team: 'HAC', nation: 'NGA', number: 9, height: 71, weight: 172, age: 27, foot: 'right', skin: '#78553e', espn: 243514, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 3, shotPower: 4, heading: 8, dribbling: 4, firstTouch: 3, linkUp: 2, pace: 7, strength: 5, offBall: 6, composure: 3 } },
  { name: "Rassoul Ndiaye", short: "Ndiaye", team: 'HAC', nation: 'SEN', number: 14, height: 70, weight: 152, age: 24, foot: 'right', skin: '#6c4943', espn: 291982, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 2, heading: 4, dribbling: 5, firstTouch: 6, linkUp: 5, pace: 5, strength: 4, offBall: 3, composure: 3 } },
  { name: "Simon Ebonog", short: "Ebonog", team: 'HAC', nation: 'FRA', number: 26, height: 71, weight: null, age: 22, foot: 'right', skin: '#7d5243', espn: 346519, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 4, heading: 3, dribbling: 6, firstTouch: 5, linkUp: 2, pace: 5, strength: 7, offBall: 2, composure: 4 } },
  { name: "Junior Mwanga", short: "Mwanga", team: 'HAC', nation: 'FRA', number: 6, height: 72, weight: 174, age: 23, foot: 'both', skin: '#876054', espn: 340583, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 6, heading: 4, dribbling: 7, firstTouch: 7, linkUp: 3, pace: 5, strength: 7, offBall: 3, composure: 3 } },
  { name: "Rayan Fofana", short: "Fofana", team: 'HAC', nation: 'CIV', number: 38, height: 72, weight: 161, age: 20, foot: 'right', skin: '#6d4d39', espn: 401045, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 3, heading: 4, dribbling: 6, firstTouch: 3, linkUp: 3, pace: 8, strength: 7, offBall: 7, composure: 3 } },

  // ─── LMS ────────────────────────────────────────────────────────────
  { name: "Louis Mafouta", short: "Mafouta", team: 'LMS', nation: 'CTA', number: 14, height: 71, weight: 168, age: 32, foot: 'right', skin: '#855746', espn: 268720, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 3, shotPower: 1, heading: 4, dribbling: 0, firstTouch: 0, linkUp: 0, pace: 5, strength: 3, offBall: 7, composure: 5 } },
  { name: "Habib Diallo", short: "Diallo", team: 'LMS', nation: 'SEN', number: 13, height: 73, weight: 172, age: 31, foot: 'right', skin: '#724635', espn: 223376, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 3, shotPower: 5, heading: 6, dribbling: 5, firstTouch: 4, linkUp: 1, pace: 6, strength: 6, offBall: 5, composure: 1 } },
  { name: "Lucas Bretelle", short: "Bretelle", team: 'LMS', nation: 'FRA', number: 29, height: 65, weight: 119, age: 24, foot: 'right', skin: '#977872', espn: 330722, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 0, heading: 0, dribbling: 5, firstTouch: 6, linkUp: 3, pace: 5, strength: 0, offBall: 1, composure: 3 } },
  { name: "Jean Vercruysse", short: "Vercruysse", team: 'LMS', nation: 'FRA', number: 10, height: 72, weight: null, age: 26, foot: 'right', skin: '#ce9b86', espn: 315460, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 2, shotPower: 3, heading: 3, dribbling: 1, firstTouch: 2, linkUp: 3, pace: 2, strength: 3, offBall: 3, composure: 2 } },
  { name: "Dame Guèye", short: "Guèye", team: 'LMS', nation: 'SEN', number: 25, height: null, weight: null, age: 31, foot: 'right', skin: '#6c4943', espn: 233702, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 2, heading: 7, dribbling: 0, firstTouch: 0, linkUp: 1, pace: 5, strength: 3, offBall: 4, composure: 5 } },

  // ─── RCL ────────────────────────────────────────────────────────────
  { name: "Abdallah Sima", short: "Sima", team: 'RCL', nation: 'SEN', number: 19, height: 74, weight: 172, age: 25, foot: 'right', skin: '#6c4943', espn: 308246, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 4, shotPower: 4, heading: 9, dribbling: 4, firstTouch: 3, linkUp: 5, pace: 5, strength: 7, offBall: 6, composure: 4 } },
  { name: "Florian Thauvin", short: "Thauvin", team: 'RCL', nation: 'FRA', number: 10, height: 70, weight: 152, age: 33, foot: 'left', skin: '#c48a6f', espn: 156898, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 5, heading: 5, dribbling: 7, firstTouch: 5, linkUp: 10, pace: 4, strength: 4, offBall: 7, composure: 9 } },
  { name: "Franjo Ivanovic", short: "Ivanovic", team: 'RCL', nation: 'CRO', number: 29, height: 73, weight: 192, age: 23, foot: 'right', skin: '#c08c76', espn: 364180, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 6, heading: 6, dribbling: 9, firstTouch: 4, linkUp: 2, pace: 9, strength: 9, offBall: 6, composure: 4 } },
  { name: "Odsonne Édouard", short: "Édouard", team: 'RCL', nation: 'FRA', number: 11, height: 74, weight: 183, age: 28, foot: 'right', skin: '#785c4a', espn: 222180, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 7, heading: 9, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 7, strength: 7, offBall: 8, composure: 6 } },
  { name: "Yassine Titraoui", short: "Titraoui", team: 'RCL', nation: 'ALG', number: 8, height: 67, weight: 152, age: 23, foot: 'right', skin: '#a67f6b', espn: 341720, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 2, heading: 0, dribbling: 4, firstTouch: 6, linkUp: 3, pace: 5, strength: 3, offBall: 1, composure: 3 } },

  // ─── LIL ────────────────────────────────────────────────────────────
  { name: "Olivier Giroud", short: "Giroud", team: 'LIL', nation: 'FRA', number: 9, height: 76, weight: 201, age: 40, foot: 'left', skin: '#b87d69', espn: 88965, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 9, heading: 9, dribbling: 5, firstTouch: 4, linkUp: 2, pace: 3, strength: 11, offBall: 6, composure: 9 } },
  { name: "Hákon Haraldsson", short: "Haraldsson", team: 'LIL', nation: 'ISL', number: 10, height: 70, weight: 161, age: 23, foot: 'right', skin: '#cb9581', espn: 318779, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 4, heading: 3, dribbling: 4, firstTouch: 5, linkUp: 7, pace: 5, strength: 5, offBall: 5, composure: 4 } },
  { name: "Dilane Bakwa", short: "Bakwa", team: 'LIL', nation: 'FRA', number: 7, height: 71, weight: 163, age: 24, foot: 'left', skin: '#765144', espn: 297157, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 4, heading: 4, dribbling: 6, firstTouch: 5, linkUp: 7, pace: 1, strength: 5, offBall: 5, composure: 4 } },
  { name: "Ngal'ayel Mukau", short: "Mukau", team: 'LIL', nation: 'COD', number: 17, height: 73, weight: 172, age: 22, foot: 'left', skin: '#6d4639', espn: 345988, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 1, shotPower: 5, heading: 5, dribbling: 4, firstTouch: 5, linkUp: 3, pace: 4, strength: 7, offBall: 2, composure: 1 } },
  { name: "Ethan Mbappé", short: "Mbappé", team: 'LIL', nation: 'FRA', number: 8, height: 71, weight: 152, age: 19, foot: 'left', skin: '#ba816a', espn: 355971, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 4, heading: 4, dribbling: 4, firstTouch: 4, linkUp: 6, pace: 6, strength: 4, offBall: 5, composure: 3 } },

  // ─── LOR ────────────────────────────────────────────────────────────
  { name: "Ibrahima Baldé", short: "Baldé", team: 'LOR', nation: 'FRA', number: 18, height: 73, weight: 170, age: 23, foot: 'right', skin: '#8b5b48', espn: 324565, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 3, heading: 6, dribbling: 2, firstTouch: 1, linkUp: 0, pace: 8, strength: 5, offBall: 5, composure: 3 } },
  { name: "Arthur Avom", short: "Avom", team: 'LOR', nation: 'CMR', number: 62, height: 68, weight: 139, age: 21, foot: 'right', skin: '#6c4943', espn: 355870, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 2, heading: 1, dribbling: 6, firstTouch: 8, linkUp: 6, pace: 5, strength: 3, offBall: 2, composure: 4 } },
  { name: "Noah Cadiou", short: "Cadiou", team: 'LOR', nation: 'GLP', number: 8, height: 75, weight: 183, age: 28, foot: 'right', skin: '#ae8362', espn: 315215, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 7, heading: 6, dribbling: 4, firstTouch: 6, linkUp: 4, pace: 3, strength: 9, offBall: 2, composure: 5 } },
  { name: "Jean-Victor Makengo", short: "Makengo", team: 'LOR', nation: 'FRA', number: 17, height: 70, weight: 163, age: 28, foot: 'left', skin: '#644536', espn: 225557, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 9, heading: 4, dribbling: 6, firstTouch: 6, linkUp: 4, pace: 4, strength: 8, offBall: 4, composure: 6 } },
  { name: "Gabin Bernardeau", short: "Bernardeau", team: 'LOR', nation: 'FRA', number: 33, height: 71, weight: 163, age: 20, foot: 'left', skin: '#a07465', espn: 397392, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 3, heading: 4, dribbling: 4, firstTouch: 3, linkUp: 4, pace: 5, strength: 5, offBall: 5, composure: 3 } },

  // ─── LYO ────────────────────────────────────────────────────────────
  { name: "Loïs Openda", short: "Openda", team: 'LYO', nation: 'BEL', number: 17, height: 70, weight: 163, age: 26, foot: 'right', skin: '#8a5232', espn: 276265, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 3, heading: 4, dribbling: 4, firstTouch: 3, linkUp: 4, pace: 9, strength: 7, offBall: 8, composure: 5 } },
  { name: "Tyler Morton", short: "Morton", team: 'LYO', nation: 'ENG', number: 23, height: 72, weight: 163, age: 24, foot: 'right', skin: '#a87761', espn: 298522, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 5, heading: 5, dribbling: 6, firstTouch: 7, linkUp: 6, pace: 4, strength: 4, offBall: 2, composure: 4 } },
  { name: "Corentin Tolisso", short: "Tolisso", team: 'LYO', nation: 'FRA', number: 8, height: 71, weight: 179, age: 32, foot: 'right', skin: '#b77b5a', espn: 192060, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 8, shotPower: 9, heading: 8, dribbling: 2, firstTouch: 4, linkUp: 7, pace: 2, strength: 8, offBall: 6, composure: 7 } },
  { name: "Pavel Sulc", short: "Sulc", team: 'LYO', nation: 'CZE', number: 10, height: 70, weight: 163, age: 25, foot: 'right', skin: '#b7927f', espn: 305545, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 9, shotPower: 4, heading: 6, dribbling: 5, firstTouch: 4, linkUp: 5, pace: 6, strength: 3, offBall: 8, composure: 5 } },
  { name: "Mads Bidstrup", short: "Bidstrup", team: 'LYO', nation: 'DEN', number: 2, height: 69, weight: 163, age: 25, foot: 'right', skin: '#a87761', espn: 290401, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 3, heading: 0, dribbling: 3, firstTouch: 4, linkUp: 1, pace: 4, strength: 3, offBall: 1, composure: 3 } },

  // ─── OLM ────────────────────────────────────────────────────────────
  { name: "Amine Gouiri", short: "Gouiri", team: 'OLM', nation: 'ALG', number: 9, height: 71, weight: 174, age: 26, foot: 'right', skin: '#bf8660', espn: 259743, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 4, heading: 3, dribbling: 4, firstTouch: 3, linkUp: 7, pace: 7, strength: 4, offBall: 8, composure: 5 } },
  { name: "Igor Paixão", short: "Igor Paixão", team: 'OLM', nation: 'BRA', number: 14, height: 66, weight: 141, age: 26, foot: 'right', skin: '#965f3c', espn: 289114, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 1, heading: 2, dribbling: 4, firstTouch: 4, linkUp: 5, pace: 5, strength: 1, offBall: 6, composure: 6 } },
  { name: "Pierre-Emile Højbjerg", short: "Højbjerg", team: 'OLM', nation: 'DEN', number: 23, height: 73, weight: 183, age: 31, foot: 'right', skin: '#bd836d', espn: 159543, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 8, heading: 8, dribbling: 5, firstTouch: 8, linkUp: 7, pace: 2, strength: 8, offBall: 3, composure: 6 } },
  { name: "Angel Gomes", short: "Gomes", team: 'OLM', nation: 'ENG', number: 7, height: 66, weight: 121, age: 26, foot: 'right', skin: '#9b6e57', espn: 256773, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 1, heading: 1, dribbling: 3, firstTouch: 4, linkUp: 5, pace: 4, strength: 0, offBall: 4, composure: 2 } },
  { name: "Himad Abdelli", short: "Abdelli", team: 'OLM', nation: 'ALG', number: 8, height: 73, weight: 179, age: 26, foot: 'right', skin: '#d59472', espn: 277525, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 6, heading: 5, dribbling: 4, firstTouch: 6, linkUp: 4, pace: 4, strength: 6, offBall: 4, composure: 8 } },

  // ─── NIC ────────────────────────────────────────────────────────────
  { name: "Elye Wahi", short: "Wahi", team: 'NIC', nation: 'CIV', number: 11, height: 72, weight: 161, age: 23, foot: 'right', skin: '#b26f47', espn: 311118, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 3, heading: 5, dribbling: 1, firstTouch: 2, linkUp: 3, pace: 7, strength: 5, offBall: 7, composure: 6 } },
  { name: "Mohamed Amoura", short: "Amoura", team: 'NIC', nation: 'ALG', number: 9, height: 67, weight: 132, age: 26, foot: 'right', skin: '#bd8c75', espn: 315384, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 1, heading: 3, dribbling: 3, firstTouch: 4, linkUp: 4, pace: 6, strength: 0, offBall: 8, composure: 9 } },
  { name: "Sofiane Diop", short: "Diop", team: 'NIC', nation: 'MAR', number: 10, height: 69, weight: 141, age: 26, foot: 'right', skin: '#c28871', espn: 276995, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 1, heading: 2, dribbling: 7, firstTouch: 5, linkUp: 6, pace: 6, strength: 1, offBall: 5, composure: 6 } },
  { name: "Gauthier Hein", short: "Hein", team: 'NIC', nation: 'FRA', number: 7, height: 67, weight: 141, age: 30, foot: 'left', skin: '#c48067', espn: 239905, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 2, heading: 2, dribbling: 2, firstTouch: 5, linkUp: 9, pace: 3, strength: 1, offBall: 5, composure: 10 } },
  { name: "Axel Witsel", short: "Witsel", team: 'NIC', nation: 'BEL', number: 28, height: 73, weight: 181, age: 37, foot: 'right', skin: '#a06a54', espn: 164895, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 7, heading: 6, dribbling: 6, firstTouch: 9, linkUp: 5, pace: 2, strength: 9, offBall: 3, composure: 4 } },

  // ─── PFC ────────────────────────────────────────────────────────────
  { name: "Lassine Sinayoko", short: "Sinayoko", team: 'PFC', nation: 'MLI', number: 9, height: 73, weight: 179, age: 26, foot: 'right', skin: '#966b5e', espn: 271137, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 4, heading: 7, dribbling: 6, firstTouch: 3, linkUp: 5, pace: 6, strength: 7, offBall: 8, composure: 9 } },
  { name: "Pablo Pagis", short: "Pagis", team: 'PFC', nation: 'FRA', number: 7, height: 71, weight: 152, age: 23, foot: 'both', skin: '#cc9272', espn: 334359, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 6, heading: 2, dribbling: 6, firstTouch: 5, linkUp: 7, pace: 5, strength: 3, offBall: 6, composure: 8 } },
  { name: "Ilan Kebbal", short: "Kebbal", team: 'PFC', nation: 'ALG', number: 10, height: 67, weight: 130, age: 28, foot: 'left', skin: '#b68976', espn: 304918, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 1, heading: 1, dribbling: 6, firstTouch: 7, linkUp: 9, pace: 5, strength: 1, offBall: 5, composure: 6 } },
  { name: "Rudy Matondo", short: "Matondo", team: 'PFC', nation: 'FRA', number: 23, height: 71, weight: null, age: 18, foot: 'right', skin: '#6c4943', espn: 402888, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 3, heading: 4, dribbling: 7, firstTouch: 6, linkUp: 3, pace: 6, strength: 3, offBall: 3, composure: 2 } },
  { name: "Pierre Lees-Melou", short: "Lees-Melou", team: 'PFC', nation: 'FRA', number: 33, height: 73, weight: 150, age: 33, foot: 'right', skin: '#b87d69', espn: 221527, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 4, heading: 5, dribbling: 3, firstTouch: 6, linkUp: 4, pace: 2, strength: 5, offBall: 2, composure: 7 } },

  // ─── PSG ────────────────────────────────────────────────────────────
  { name: "Ferran Torres", short: "Torres", team: 'PSG', nation: 'ESP', number: 9, height: 72, weight: 174, age: 26, foot: 'right', skin: '#a07465', espn: 265869, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 8, heading: 8, dribbling: 2, firstTouch: 3, linkUp: 4, pace: 6, strength: 7, offBall: 10, composure: 9 } },
  { name: "Khvicha Kvaratskhelia", short: "Kvaratskhelia", team: 'PSG', nation: 'GEO', number: 7, height: 72, weight: 168, age: 25, foot: 'both', skin: '#b38473', espn: 274745, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 7, shotPower: 5, heading: 5, dribbling: 10, firstTouch: 8, linkUp: 9, pace: 8, strength: 5, offBall: 8, composure: 9 } },
  { name: "Ousmane Dembélé", short: "Dembélé", team: 'PSG', nation: 'FRA', number: 10, height: 70, weight: 148, age: 29, foot: 'both', skin: '#7d5243', espn: 229744, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 5, heading: 5, dribbling: 8, firstTouch: 7, linkUp: 10, pace: 9, strength: 1, offBall: 9, composure: 7 } },
  { name: "Vitinha", short: "Vitinha", team: 'PSG', nation: 'POR', number: 17, height: 68, weight: 139, age: 26, foot: 'right', skin: '#a67f6b', espn: 288897, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 6, heading: 2, dribbling: 8, firstTouch: 11, linkUp: 9, pace: 4, strength: 1, offBall: 3, composure: 7 } },
  { name: "Warren Zaïre-Emery", short: "Zaïre-Emery", team: 'PSG', nation: 'FRA', number: 33, height: 70, weight: 150, age: 20, foot: 'right', skin: '#a87761', espn: 345581, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 2, heading: 3, dribbling: 7, firstTouch: 9, linkUp: 8, pace: 6, strength: 2, offBall: 2, composure: 2 } },

  // ─── REN ────────────────────────────────────────────────────────────
  { name: "Esteban Lepaul", short: "Lepaul", team: 'REN', nation: 'FRA', number: 9, height: 70, weight: 157, age: 26, foot: 'right', skin: '#9f6f56', espn: 323850, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 6, heading: 6, dribbling: 1, firstTouch: 1, linkUp: 2, pace: 7, strength: 2, offBall: 9, composure: 8 } },
  { name: "Valentin Rongier", short: "Rongier", team: 'REN', nation: 'FRA', number: 21, height: 68, weight: 148, age: 31, foot: 'right', skin: '#bb866f', espn: 207136, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 7, heading: 3, dribbling: 5, firstTouch: 7, linkUp: 7, pace: 2, strength: 2, offBall: 1, composure: 7 } },
  { name: "Mahdi Camara", short: "Camara", team: 'REN', nation: 'FRA', number: 45, height: 70, weight: 161, age: 28, foot: 'right', skin: '#a26646', espn: 268966, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 2, heading: 4, dribbling: 5, firstTouch: 6, linkUp: 4, pace: 4, strength: 6, offBall: 4, composure: 5 } },
  { name: "Mousa Al-Tamari", short: "Al-Tamari", team: 'REN', nation: 'JOR', number: 11, height: 70, weight: 152, age: 29, foot: 'left', skin: '#b27355', espn: 257489, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 2, heading: 3, dribbling: 5, firstTouch: 4, linkUp: 6, pace: 5, strength: 3, offBall: 6, composure: 7 } },
  { name: "Issa Soumaré", short: "Soumaré", team: 'REN', nation: 'SEN', number: 90, height: 72, weight: 172, age: 26, foot: 'right', skin: '#875247', espn: 297743, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 0, shotPower: 5, heading: 7, dribbling: 4, firstTouch: 3, linkUp: 2, pace: 5, strength: 7, offBall: 6, composure: 0 } },

  // ─── STR ────────────────────────────────────────────────────────────
  { name: "Conrad Harder", short: "Harder", team: 'STR', nation: 'DEN', number: 40, height: 73, weight: 157, age: 21, foot: 'left', skin: '#b98f7b', espn: 362794, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 3, shotPower: 3, heading: 8, dribbling: 2, firstTouch: 2, linkUp: 5, pace: 8, strength: 5, offBall: 7, composure: 1 } },
  { name: "Gessime Yassine", short: "Yassine", team: 'STR', nation: 'MAR', number: 80, height: 68, weight: 121, age: 20, foot: 'left', skin: '#b67856', espn: 379012, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 0, heading: 3, dribbling: 9, firstTouch: 6, linkUp: 6, pace: 9, strength: 1, offBall: 5, composure: 5 } },
  { name: "Joaquín Panichelli", short: "Panichelli", team: 'STR', nation: 'ARG', number: 9, height: 73, weight: 181, age: 24, foot: 'right', skin: '#bf8c78', espn: 350961, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 8, heading: 10, dribbling: 2, firstTouch: 1, linkUp: 1, pace: 7, strength: 8, offBall: 9, composure: 7 } },
  { name: "Samir El Mourabet", short: "El Mourabet", team: 'STR', nation: 'MAR', number: 29, height: 74, weight: 159, age: 21, foot: 'left', skin: '#bc8f79', espn: 378491, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 4, heading: 7, dribbling: 7, firstTouch: 8, linkUp: 6, pace: 5, strength: 6, offBall: 1, composure: 3 } },
  { name: "Pape Diop", short: "Diop", team: 'STR', nation: 'SEN', number: 21, height: 72, weight: null, age: 23, foot: 'right', skin: '#8e635b', espn: 353378, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 4, heading: 3, dribbling: 7, firstTouch: 9, linkUp: 6, pace: 4, strength: 7, offBall: 3, composure: 3 } },

  // ─── TOU ────────────────────────────────────────────────────────────
  { name: "Jacen Russell-Rowe", short: "Russell-Rowe", team: 'TOU', nation: 'CAN', number: 13, height: 72, weight: 161, age: 24, foot: 'right', skin: '#765144', espn: 297121, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 3, heading: 5, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 7, strength: 2, offBall: 5, composure: 2 } },
  { name: "Cristian Cásseres Jr.", short: "Cásseres Jr.", team: 'TOU', nation: 'VEN', number: 23, height: 69, weight: 150, age: 26, foot: 'right', skin: '#a2735e', espn: 271244, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 2, heading: 4, dribbling: 5, firstTouch: 9, linkUp: 8, pace: 4, strength: 6, offBall: 1, composure: 1 } },
  { name: "Alexis Vossah", short: "Vossah", team: 'TOU', nation: 'FRA', number: 6, height: 71, weight: 150, age: 18, foot: 'both', skin: '#6c4943', espn: 408251, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 3, heading: 4, dribbling: 5, firstTouch: 5, linkUp: 3, pace: 5, strength: 4, offBall: 3, composure: 3 } },
  { name: "Thomas Jørgensen", short: "Jørgensen", team: 'TOU', nation: 'DEN', number: 8, height: 70, weight: 152, age: 21, foot: 'left', skin: '#b28263', espn: 362777, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 1, heading: 3, dribbling: 8, firstTouch: 4, linkUp: 5, pace: 6, strength: 3, offBall: 2, composure: 2 } },
  { name: "Santiago Hidalgo", short: "Hidalgo", team: 'TOU', nation: 'ARG', number: 9, height: 69, weight: 157, age: 21, foot: 'left', skin: '#bf8c78', espn: 338873, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 2, heading: 3, dribbling: 3, firstTouch: 2, linkUp: 4, pace: 6, strength: 4, offBall: 5, composure: 3 } },

  // ─── TRO ────────────────────────────────────────────────────────────
  { name: "Renaud Ripart", short: "Ripart", team: 'TRO', nation: 'FRA', number: 20, height: 71, weight: 161, age: 33, foot: 'right', skin: '#c59681', espn: 176406, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 2, heading: 5, dribbling: 3, firstTouch: 1, linkUp: 1, pace: 6, strength: 4, offBall: 6, composure: 4 } },
  { name: "Dermane Karim", short: "Karim", team: 'TRO', nation: 'TOG', number: 29, height: 76, weight: null, age: 22, foot: 'right', skin: '#8e624e', espn: 323058, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 5, heading: 7, dribbling: 6, firstTouch: 6, linkUp: 4, pace: 5, strength: 7, offBall: 3, composure: 4 } },
  { name: "Mouhamed Diop", short: "Diop", team: 'TRO', nation: 'SEN', number: 8, height: 72, weight: null, age: 26, foot: 'right', skin: '#7f5749', espn: 346359, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 2, heading: 2, dribbling: 1, firstTouch: 2, linkUp: 1, pace: 3, strength: 4, offBall: 0, composure: 3 } },
  { name: "Hugo Picard", short: "Picard", team: 'TRO', nation: 'FRA', number: 22, height: 66, weight: 150, age: 23, foot: 'right', skin: '#a87e66', espn: 351379, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 1, shotPower: 2, heading: 1, dribbling: 4, firstTouch: 4, linkUp: 5, pace: 5, strength: 1, offBall: 2, composure: 1 } },
  { name: "Antoine Mille", short: "Mille", team: 'TRO', nation: 'FRA', number: 17, height: 71, weight: 157, age: 29, foot: 'left', skin: '#b0856f', espn: 270173, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 1, shotPower: 1, heading: 4, dribbling: 3, firstTouch: 3, linkUp: 4, pace: 4, strength: 3, offBall: 0, composure: 4 } },
]

// ─── WORLD CUP 2026 (team = nation FIFA code from soccer-nations.js) ─────────
export const WC_STRIKERS = [

  // ─── ALG ────────────────────────────────────────────────────────────
  { name: "Amine Gouiri", short: "Gouiri", team: 'ALG', nation: 'ALG', number: 9, height: 71, weight: 174, age: 26, foot: 'right', skin: '#bf8660', espn: 259743, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 4, heading: 3, dribbling: 4, firstTouch: 3, linkUp: 7, pace: 7, strength: 4, offBall: 8, composure: 5 } },
  { name: "Ibrahim Maza", short: "Maza", team: 'ALG', nation: 'ALG', number: 22, height: 71, weight: 172, age: 20, foot: 'right', skin: '#c49276', espn: 361212, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 10, heading: 5, dribbling: 9, firstTouch: 7, linkUp: 8, pace: 7, strength: 6, offBall: 7, composure: 3 } },
  { name: "Farès Chaïbi", short: "Chaïbi", team: 'ALG', nation: 'ALG', number: 10, height: 72, weight: 150, age: 23, foot: 'right', skin: '#c78a68', espn: 337306, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 3, heading: 5, dribbling: 4, firstTouch: 5, linkUp: 9, pace: 4, strength: 2, offBall: 5, composure: 3 } },
  { name: "Nabil Bentaleb", short: "Bentaleb", team: 'ALG', nation: 'ALG', number: 19, height: 74, weight: 168, age: 31, foot: 'left', skin: '#bd836d', espn: 179187, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 6, heading: 7, dribbling: 4, firstTouch: 6, linkUp: 6, pace: 2, strength: 6, offBall: 2, composure: 7 } },
  { name: "Riyad Mahrez", short: "Mahrez", team: 'ALG', nation: 'ALG', number: 7, height: 70, weight: 161, age: 35, foot: 'left', skin: '#a87a61', espn: 163940, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 2, heading: 2, dribbling: 4, firstTouch: 5, linkUp: 9, pace: 2, strength: 6, offBall: 3, composure: 8 } },

  // ─── ARG ────────────────────────────────────────────────────────────
  { name: "Lionel Messi", short: "Messi", team: 'ARG', nation: 'ARG', number: 10, height: 67, weight: 148, age: 39, foot: 'left', skin: '#bb866f', espn: 45843, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 10, shotPower: 10, heading: 0, dribbling: 11, firstTouch: 11, linkUp: 11, pace: 2, strength: 1, offBall: 10, composure: 11 } },
  { name: "Enzo Fernández", short: "Fernández", team: 'ARG', nation: 'ARG', number: 24, height: 70, weight: 161, age: 25, foot: 'right', skin: '#bb866f', espn: 285450, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 9, heading: 5, dribbling: 1, firstTouch: 5, linkUp: 9, pace: 1, strength: 5, offBall: 6, composure: 10 } },
  { name: "Alexis Mac Allister", short: "Mac Allister", team: 'ARG', nation: 'ARG', number: 20, height: 69, weight: 163, age: 27, foot: 'right', skin: '#a67f6b', espn: 249299, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 6, heading: 3, dribbling: 4, firstTouch: 7, linkUp: 6, pace: 0, strength: 5, offBall: 5, composure: 7 } },
  { name: "Julián Álvarez", short: "Julián", team: 'ARG', nation: 'ARG', number: 9, height: 67, weight: 157, age: 26, foot: 'right', skin: '#876054', espn: 277206, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 8, heading: 2, dribbling: 8, firstTouch: 7, linkUp: 9, pace: 6, strength: 4, offBall: 8, composure: 9 } },
  { name: "Lautaro Martínez", short: "Lautaro", team: 'ARG', nation: 'ARG', number: 22, height: 69, weight: 152, age: 29, foot: 'right', skin: '#b0856f', espn: 219713, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 3, heading: 7, dribbling: 5, firstTouch: 4, linkUp: 6, pace: 5, strength: 2, offBall: 11, composure: 10 } },

  // ─── AUS ────────────────────────────────────────────────────────────
  { name: "Mohamed Toure", short: "Toure", team: 'AUS', nation: 'AUS', number: 9, height: 73, weight: 172, age: 22, foot: 'right', skin: '#906a59', espn: 302688, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 5, heading: 3, dribbling: 2, firstTouch: 0, linkUp: 2, pace: 8, strength: 4, offBall: 5, composure: 2 } },
  { name: "Aiden O'Neill", short: "O'Neill", team: 'AUS', nation: 'AUS', number: 13, height: 72, weight: 152, age: 28, foot: 'right', skin: '#b7927f', espn: 241031, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 1, heading: 4, dribbling: 4, firstTouch: 6, linkUp: 1, pace: 3, strength: 5, offBall: 0, composure: 2 } },
  { name: "Cristian Volpato", short: "Volpato", team: 'AUS', nation: 'AUS', number: 20, height: 74, weight: 168, age: 22, foot: 'left', skin: '#c29a86', espn: 330259, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 7, heading: 7, dribbling: 7, firstTouch: 6, linkUp: 7, pace: 6, strength: 7, offBall: 5, composure: 3 } },
  { name: "Connor Metcalfe", short: "Metcalfe", team: 'AUS', nation: 'AUS', number: 8, height: 72, weight: 163, age: 27, foot: 'left', skin: '#ac8673', espn: 260643, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 1, shotPower: 4, heading: 4, dribbling: 3, firstTouch: 3, linkUp: 5, pace: 4, strength: 4, offBall: 4, composure: 4 } },
  { name: "Nestory Irankunda", short: "Irankunda", team: 'AUS', nation: 'AUS', number: 17, height: 65, weight: 163, age: 20, foot: 'right', skin: '#876054', espn: 328535, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 2, shotPower: 2, heading: 0, dribbling: 9, firstTouch: 5, linkUp: 4, pace: 8, strength: 4, offBall: 5, composure: 2 } },

  // ─── AUT ────────────────────────────────────────────────────────────
  { name: "Michael Gregoritsch", short: "Gregoritsch", team: 'AUT', nation: 'AUT', number: 11, height: 76, weight: 201, age: 32, foot: 'left', skin: '#c28871', espn: 146804, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 8, heading: 10, dribbling: 1, firstTouch: 2, linkUp: 3, pace: 4, strength: 10, offBall: 8, composure: 10 } },
  { name: "Konrad Laimer", short: "Laimer", team: 'AUT', nation: 'AUT', number: 20, height: 71, weight: 159, age: 29, foot: 'right', skin: '#d59d84', espn: 169189, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 4, heading: 4, dribbling: 3, firstTouch: 6, linkUp: 9, pace: 3, strength: 2, offBall: 4, composure: 5 } },
  { name: "Nicolas Seiwald", short: "Seiwald", team: 'AUT', nation: 'AUT', number: 6, height: 71, weight: 174, age: 25, foot: 'right', skin: '#c4876d', espn: 305956, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 7, heading: 5, dribbling: 7, firstTouch: 9, linkUp: 4, pace: 3, strength: 6, offBall: 2, composure: 3 } },
  { name: "Marcel Sabitzer", short: "Sabitzer", team: 'AUT', nation: 'AUT', number: 9, height: 70, weight: 170, age: 32, foot: 'right', skin: '#b88a7a', espn: 173907, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 6, heading: 4, dribbling: 4, firstTouch: 6, linkUp: 5, pace: 2, strength: 6, offBall: 4, composure: 7 } },
  { name: "Romano Schmid", short: "Schmid", team: 'AUT', nation: 'AUT', number: 18, height: 66, weight: 150, age: 26, foot: 'right', skin: '#ac8673', espn: 238296, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 6, heading: 1, dribbling: 5, firstTouch: 5, linkUp: 10, pace: 4, strength: 2, offBall: 5, composure: 7 } },

  // ─── BEL ────────────────────────────────────────────────────────────
  { name: "Charles De Ketelaere", short: "De Ketelaere", team: 'BEL', nation: 'BEL', number: 17, height: 76, weight: 183, age: 25, foot: 'left', skin: '#95705f', espn: 296319, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 5, shotPower: 7, heading: 9, dribbling: 9, firstTouch: 7, linkUp: 10, pace: 6, strength: 9, offBall: 6, composure: 9 } },
  { name: "Youri Tielemans", short: "Tielemans", team: 'BEL', nation: 'BEL', number: 8, height: 69, weight: 159, age: 29, foot: 'right', skin: '#a26e57', espn: 193297, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 6, heading: 3, dribbling: 4, firstTouch: 7, linkUp: 8, pace: 1, strength: 6, offBall: 4, composure: 8 } },
  { name: "Jérémy Doku", short: "Doku", team: 'BEL', nation: 'BEL', number: 11, height: 68, weight: 181, age: 24, foot: 'right', skin: '#6b493d', espn: 283672, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 8, shotPower: 7, heading: 3, dribbling: 11, firstTouch: 11, linkUp: 10, pace: 10, strength: 10, offBall: 7, composure: 5 } },
  { name: "Leandro Trossard", short: "Trossard", team: 'BEL', nation: 'BEL', number: 10, height: 68, weight: 141, age: 31, foot: 'right', skin: '#ad8271', espn: 174980, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 1, heading: 2, dribbling: 6, firstTouch: 5, linkUp: 7, pace: 2, strength: 2, offBall: 7, composure: 9 } },
  { name: "Kevin De Bruyne", short: "De Bruyne", team: 'BEL', nation: 'BEL', number: 7, height: 71, weight: 172, age: 35, foot: 'right', skin: '#b0887e', espn: 134947, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 9, shotPower: 9, heading: 5, dribbling: 4, firstTouch: 8, linkUp: 11, pace: 2, strength: 5, offBall: 5, composure: 9 } },

  // ─── BIH ────────────────────────────────────────────────────────────
  { name: "Ermedin Demirovic", short: "Demirovic", team: 'BIH', nation: 'BIH', number: 10, height: 73, weight: 183, age: 28, foot: 'right', skin: '#b0887e', espn: 269136, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 7, heading: 7, dribbling: 4, firstTouch: 3, linkUp: 3, pace: 6, strength: 6, offBall: 9, composure: 6 } },
  { name: "Kerim Alajbegovic", short: "Alajbegovic", team: 'BIH', nation: 'BIH', number: 19, height: 73, weight: 168, age: 19, foot: 'both', skin: '#977872', espn: 391034, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 7, heading: 4, dribbling: 8, firstTouch: 6, linkUp: 6, pace: 8, strength: 4, offBall: 5, composure: 3 } },
  { name: "Benjamin Tahirovic", short: "Tahirovic", team: 'BIH', nation: 'BIH', number: 6, height: 76, weight: 183, age: 23, foot: 'right', skin: '#a67f6b', espn: 352660, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 5, heading: 5, dribbling: 4, firstTouch: 5, linkUp: 4, pace: 3, strength: 6, offBall: 2, composure: 1 } },
  { name: "Esmir Bajraktarevic", short: "Bajraktarevic", team: 'BIH', nation: 'BIH', number: 20, height: 69, weight: 139, age: 21, foot: 'left', skin: '#ad8271', espn: 325410, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 1, heading: 2, dribbling: 5, firstTouch: 4, linkUp: 8, pace: 7, strength: 0, offBall: 4, composure: 1 } },
  { name: "Amar Memic", short: "Memic", team: 'BIH', nation: 'BIH', number: 15, height: 69, weight: 159, age: 25, foot: 'right', skin: '#b67856', espn: 338199, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 2, shotPower: 2, heading: 1, dribbling: 1, firstTouch: 1, linkUp: 1, pace: 3, strength: 3, offBall: 0, composure: 0 } },

  // ─── BRA ────────────────────────────────────────────────────────────
  { name: "Matheus Cunha", short: "Cunha", team: 'BRA', nation: 'BRA', number: 9, height: 72, weight: 168, age: 27, foot: 'right', skin: '#a46f5c', espn: 259902, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 8, shotPower: 8, heading: 4, dribbling: 8, firstTouch: 6, linkUp: 6, pace: 9, strength: 6, offBall: 8, composure: 9 } },
  { name: "Vinícius Júnior", short: "Vinícius Júnior", team: 'BRA', nation: 'BRA', number: 7, height: 69, weight: 170, age: 26, foot: 'right', skin: '#7d5243', espn: 252107, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 9, shotPower: 5, heading: 3, dribbling: 10, firstTouch: 9, linkUp: 9, pace: 11, strength: 9, offBall: 10, composure: 10 } },
  { name: "Bruno Guimarães", short: "Guimarães", team: 'BRA', nation: 'BRA', number: 8, height: 72, weight: 172, age: 28, foot: 'right', skin: '#c38f80', espn: 218522, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 10, shotPower: 9, heading: 9, dribbling: 5, firstTouch: 6, linkUp: 8, pace: 0, strength: 10, offBall: 5, composure: 8 } },
  { name: "Rayan", short: "Rayan", team: 'BRA', nation: 'BRA', number: 26, height: 74, weight: 192, age: 20, foot: 'left', skin: '#8b5b48', espn: 357719, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 8, heading: 10, dribbling: 3, firstTouch: 3, linkUp: 4, pace: 10, strength: 9, offBall: 7, composure: 6 } },
  { name: "Danilo Santos", short: "Santos", team: 'BRA', nation: 'BRA', number: 18, height: 70, weight: 152, age: 25, foot: 'right', skin: '#a26e57', espn: 306764, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 1, heading: 1, dribbling: 3, firstTouch: 6, linkUp: 4, pace: 3, strength: 2, offBall: 0, composure: 2 } },

  // ─── CAN ────────────────────────────────────────────────────────────
  { name: "Jonathan David", short: "David", team: 'CAN', nation: 'CAN', number: 10, height: 70, weight: 179, age: 26, foot: 'both', skin: '#785c4a', espn: 273499, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 7, heading: 4, dribbling: 1, firstTouch: 2, linkUp: 6, pace: 6, strength: 7, offBall: 9, composure: 7 } },
  { name: "Tajon Buchanan", short: "Buchanan", team: 'CAN', nation: 'CAN', number: 17, height: 72, weight: 150, age: 27, foot: 'right', skin: '#a07465', espn: 284769, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 3, heading: 5, dribbling: 3, firstTouch: 4, linkUp: 5, pace: 4, strength: 5, offBall: 6, composure: 4 } },
  { name: "Stephen Eustáquio", short: "Eustáquio", team: 'CAN', nation: 'CAN', number: 7, height: 70, weight: 152, age: 29, foot: 'right', skin: '#cda28f', espn: 270505, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 3, heading: 1, dribbling: 2, firstTouch: 4, linkUp: 4, pace: 2, strength: 1, offBall: 3, composure: 4 } },
  { name: "Ismaël Koné", short: "Koné", team: 'CAN', nation: 'CAN', number: 8, height: 74, weight: 168, age: 24, foot: 'right', skin: '#765144', espn: 325001, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 6, heading: 5, dribbling: 5, firstTouch: 3, linkUp: 2, pace: 3, strength: 4, offBall: 2, composure: 5 } },
  { name: "Tani Oluwaseyi", short: "Oluwaseyi", team: 'CAN', nation: 'CAN', number: 12, height: 74, weight: 174, age: 26, foot: 'left', skin: '#6c4943', espn: 294039, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 6, heading: 7, dribbling: 4, firstTouch: 3, linkUp: 3, pace: 7, strength: 6, offBall: 6, composure: 3 } },

  // ─── CPV ────────────────────────────────────────────────────────────
  { name: "Dailon Livramento", short: "Livramento", team: 'CPV', nation: 'CPV', number: 19, height: 73, weight: 161, age: 25, foot: 'right', skin: '#ad8271', espn: 330211, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 0, shotPower: 1, heading: 6, dribbling: 4, firstTouch: 3, linkUp: 3, pace: 6, strength: 3, offBall: 4, composure: 2 } },
  { name: "Kevin Pina", short: "Pina", team: 'CPV', nation: 'CPV', number: 6, height: 71, weight: 174, age: 29, foot: 'both', skin: '#a06543', espn: 327173, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 3, heading: 2, dribbling: 3, firstTouch: 3, linkUp: 2, pace: 3, strength: 5, offBall: 2, composure: 3 } },
  { name: "Ryan Mendes", short: "Mendes", team: 'CPV', nation: 'CPV', number: 20, height: 70, weight: 152, age: 36, foot: 'right', skin: '#9b664b', espn: 135216, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 2, shotPower: 1, heading: 1, dribbling: 3, firstTouch: 2, linkUp: 1, pace: 3, strength: 2, offBall: 0, composure: 1 } },
  { name: "Jamiro Monteiro", short: "Monteiro", team: 'CPV', nation: 'CPV', number: 10, height: 69, weight: 150, age: 32, foot: 'right', skin: '#6c4943', espn: 227441, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 4, heading: 2, dribbling: 0, firstTouch: 2, linkUp: 4, pace: 2, strength: 2, offBall: 2, composure: 4 } },
  { name: "Deroy Duarte", short: "Duarte", team: 'CPV', nation: 'CPV', number: 14, height: 70, weight: 152, age: 27, foot: 'right', skin: '#a76b4f', espn: 246442, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 1, heading: 2, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 4, strength: 2, offBall: 3, composure: 2 } },

  // ─── COL ────────────────────────────────────────────────────────────
  { name: "Luis Suárez", short: "Luis Suárez", team: 'COL', nation: 'COL', number: 25, height: 71, weight: 183, age: 28, foot: 'right', skin: '#946c58', espn: 272722, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 9, heading: 6, dribbling: 5, firstTouch: 3, linkUp: 4, pace: 7, strength: 6, offBall: 10, composure: 8 } },
  { name: "Luis Díaz", short: "Díaz", team: 'COL', nation: 'COL', number: 7, height: 71, weight: 152, age: 29, foot: 'right', skin: '#99736a', espn: 257390, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 8, shotPower: 5, heading: 7, dribbling: 9, firstTouch: 7, linkUp: 10, pace: 6, strength: 3, offBall: 10, composure: 10 } },
  { name: "Gustavo Puerta", short: "Puerta", team: 'COL', nation: 'COL', number: 14, height: 69, weight: 152, age: 23, foot: 'right', skin: '#bd8c72', espn: 341736, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 1, heading: 2, dribbling: 1, firstTouch: 2, linkUp: 2, pace: 4, strength: 2, offBall: 0, composure: 1 } },
  { name: "Jefferson Lerma", short: "Lerma", team: 'COL', nation: 'COL', number: 16, height: 70, weight: 183, age: 32, foot: 'right', skin: '#875340', espn: 197399, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 7, heading: 8, dribbling: 4, firstTouch: 5, linkUp: 4, pace: 6, strength: 7, offBall: 5, composure: 5 } },
  { name: "Jhon Arias", short: "Arias", team: 'COL', nation: 'COL', number: 11, height: 66, weight: 181, age: 29, foot: 'right', skin: '#94604e', espn: 239566, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 3, shotPower: 7, heading: 0, dribbling: 4, firstTouch: 4, linkUp: 6, pace: 2, strength: 6, offBall: 5, composure: 6 } },

  // ─── COD ────────────────────────────────────────────────────────────
  { name: "Yoane Wissa", short: "Wissa", team: 'COD', nation: 'COD', number: 20, height: 69, weight: 163, age: 30, foot: 'right', skin: '#6c4943', espn: 224077, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 4, heading: 6, dribbling: 3, firstTouch: 2, linkUp: 4, pace: 3, strength: 5, offBall: 8, composure: 3 } },
  { name: "Noah Sadiki", short: "Sadiki", team: 'COD', nation: 'COD', number: 14, height: 68, weight: 161, age: 21, foot: 'right', skin: '#996651', espn: 340240, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 5, heading: 2, dribbling: 8, firstTouch: 9, linkUp: 4, pace: 1, strength: 5, offBall: 3, composure: 1 } },
  { name: "Samuel Moutoussamy", short: "Moutoussamy", team: 'COD', nation: 'COD', number: 8, height: 69, weight: 159, age: 30, foot: 'left', skin: '#7d4d39', espn: 260932, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 4, heading: 2, dribbling: 3, firstTouch: 4, linkUp: 1, pace: 2, strength: 3, offBall: 0, composure: 2 } },
  { name: "Ngal'ayel Mukau", short: "Mukau", team: 'COD', nation: 'COD', number: 6, height: 73, weight: 172, age: 22, foot: 'left', skin: '#6d4639', espn: 345988, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 1, shotPower: 5, heading: 5, dribbling: 4, firstTouch: 5, linkUp: 3, pace: 4, strength: 7, offBall: 2, composure: 1 } },
  { name: "Cédric Bakambu", short: "Bakambu", team: 'COD', nation: 'COD', number: 17, height: 72, weight: 161, age: 35, foot: 'right', skin: '#90523b', espn: 147193, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 3, heading: 7, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 5, strength: 5, offBall: 6, composure: 8 } },

  // ─── CRO ────────────────────────────────────────────────────────────
  { name: "Ante Budimir", short: "Budimir", team: 'CRO', nation: 'CRO', number: 11, height: 75, weight: 163, age: 35, foot: 'left', skin: '#a17662', espn: 207288, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 4, heading: 11, dribbling: 1, firstTouch: 0, linkUp: 0, pace: 5, strength: 8, offBall: 10, composure: 9 } },
  { name: "Martin Baturina", short: "Baturina", team: 'CRO', nation: 'CRO', number: 16, height: 68, weight: 150, age: 23, foot: 'right', skin: '#8e635b', espn: 311475, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 9, shotPower: 6, heading: 2, dribbling: 6, firstTouch: 7, linkUp: 10, pace: 5, strength: 3, offBall: 6, composure: 6 } },
  { name: "Petar Sucic", short: "Sucic", team: 'CRO', nation: 'CRO', number: 17, height: 72, weight: 150, age: 23, foot: 'right', skin: '#b28376', espn: 341494, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 3, heading: 5, dribbling: 5, firstTouch: 7, linkUp: 7, pace: 5, strength: 6, offBall: 4, composure: 5 } },
  { name: "Ivan Perisic", short: "Perisic", team: 'CRO', nation: 'CRO', number: 14, height: 73, weight: 174, age: 37, foot: 'both', skin: '#bb866f', espn: 103485, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 4, heading: 9, dribbling: 4, firstTouch: 5, linkUp: 8, pace: 2, strength: 7, offBall: 5, composure: 9 } },
  { name: "Luka Modric", short: "Modric", team: 'CRO', nation: 'CRO', number: 10, height: 68, weight: 146, age: 41, foot: 'right', skin: '#a07465', espn: 76762, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 6, shotPower: 3, heading: 3, dribbling: 4, firstTouch: 10, linkUp: 10, pace: 2, strength: 2, offBall: 3, composure: 10 } },

  // ─── CUW ────────────────────────────────────────────────────────────
  { name: "Jürgen Locadia", short: "Locadia", team: 'CUW', nation: 'CUW', number: 9, height: 76, weight: 201, age: 32, foot: 'right', skin: '#9d6448', espn: 167213, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 1, shotPower: 5, heading: 5, dribbling: 1, firstTouch: 1, linkUp: 1, pace: 5, strength: 9, offBall: 2, composure: 1 } },
  { name: "Leandro Bacuna", short: "Bacuna", team: 'CUW', nation: 'CUW', number: 10, height: 71, weight: 170, age: 35, foot: 'right', skin: '#a2694d', espn: 138664, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 3, heading: 2, dribbling: 0, firstTouch: 1, linkUp: 0, pace: 2, strength: 5, offBall: 0, composure: 1 } },
  { name: "Juninho Bacuna", short: "Bacuna", team: 'CUW', nation: 'CUW', number: 7, height: 71, weight: 161, age: 29, foot: 'right', skin: '#a7725e', espn: 216287, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 3, heading: 4, dribbling: 4, firstTouch: 5, linkUp: 5, pace: 3, strength: 5, offBall: 3, composure: 5 } },
  { name: "Tahith Chong", short: "Chong", team: 'CUW', nation: 'CUW', number: 21, height: 73, weight: 163, age: 26, foot: 'left', skin: '#99736a', espn: 276218, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 2, shotPower: 3, heading: 5, dribbling: 2, firstTouch: 2, linkUp: 4, pace: 4, strength: 6, offBall: 2, composure: 3 } },
  { name: "Livano Comenencia", short: "Comenencia", team: 'CUW', nation: 'CUW', number: 8, height: 74, weight: 172, age: 22, foot: 'right', skin: '#a87a61', espn: 317285, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 9, heading: 5, dribbling: 4, firstTouch: 2, linkUp: 1, pace: 5, strength: 6, offBall: 0, composure: 2 } },

  // ─── CZE ────────────────────────────────────────────────────────────
  { name: "Patrik Schick", short: "Schick", team: 'CZE', nation: 'CZE', number: 10, height: 75, weight: 190, age: 30, foot: 'left', skin: '#ba816a', espn: 212330, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 10, heading: 10, dribbling: 2, firstTouch: 3, linkUp: 4, pace: 6, strength: 9, offBall: 10, composure: 10 } },
  { name: "Pavel Sulc", short: "Sulc", team: 'CZE', nation: 'CZE', number: 15, height: 70, weight: 163, age: 25, foot: 'right', skin: '#b7927f', espn: 305545, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 9, shotPower: 4, heading: 6, dribbling: 5, firstTouch: 4, linkUp: 5, pace: 6, strength: 3, offBall: 8, composure: 5 } },
  { name: "Adam Hlozek", short: "Hlozek", team: 'CZE', nation: 'CZE', number: 9, height: 74, weight: 183, age: 24, foot: 'right', skin: '#a1775f', espn: 292169, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 5, heading: 8, dribbling: 6, firstTouch: 4, linkUp: 4, pace: 7, strength: 8, offBall: 6, composure: 4 } },
  { name: "Michal Sadílek", short: "Sadílek", team: 'CZE', nation: 'CZE', number: 18, height: 67, weight: 141, age: 27, foot: 'left', skin: '#c68c74', espn: 249525, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 0, heading: 0, dribbling: 1, firstTouch: 4, linkUp: 4, pace: 3, strength: 2, offBall: 0, composure: 1 } },
  { name: "Lukás Cerv", short: "Cerv", team: 'CZE', nation: 'CZE', number: 12, height: 72, weight: 159, age: 25, foot: 'right', skin: '#b38473', espn: 303726, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 2, heading: 4, dribbling: 1, firstTouch: 3, linkUp: 1, pace: 3, strength: 8, offBall: 0, composure: 1 } },

  // ─── ECU ────────────────────────────────────────────────────────────
  { name: "Enner Valencia", short: "Valencia", team: 'ECU', nation: 'ECU', number: 13, height: 70, weight: 161, age: 37, foot: 'right', skin: '#785c4a', espn: 171771, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 2, heading: 3, dribbling: 4, firstTouch: 3, linkUp: 2, pace: 6, strength: 4, offBall: 5, composure: 7 } },
  { name: "Moisés Caicedo", short: "Caicedo", team: 'ECU', nation: 'ECU', number: 23, height: 70, weight: 161, age: 25, foot: 'right', skin: '#7d4d39', espn: 289877, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 5, heading: 4, dribbling: 5, firstTouch: 8, linkUp: 6, pace: 4, strength: 7, offBall: 3, composure: 5 } },
  { name: "Pedro Vite", short: "Vite", team: 'ECU', nation: 'ECU', number: 15, height: 68, weight: 150, age: 24, foot: 'left', skin: '#bb866f', espn: 297150, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 3, heading: 1, dribbling: 5, firstTouch: 5, linkUp: 5, pace: 5, strength: 2, offBall: 0, composure: 2 } },
  { name: "Gonzalo Plata", short: "Plata", team: 'ECU', nation: 'ECU', number: 19, height: 70, weight: 168, age: 26, foot: 'left', skin: '#8e624e', espn: 277352, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 6, shotPower: 7, heading: 3, dribbling: 7, firstTouch: 6, linkUp: 6, pace: 9, strength: 5, offBall: 5, composure: 4 } },
  { name: "John Yeboah", short: "Yeboah", team: 'ECU', nation: 'ECU', number: 9, height: 67, weight: 146, age: 26, foot: 'left', skin: '#7a4830', espn: 265926, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 0, shotPower: 1, heading: 0, dribbling: 9, firstTouch: 5, linkUp: 6, pace: 9, strength: 1, offBall: 6, composure: 0 } },

  // ─── EGY ────────────────────────────────────────────────────────────
  { name: "Mostafa Zico", short: "Zico", team: 'EGY', nation: 'EGY', number: 11, height: 70, weight: 161, age: 29, foot: 'right', skin: '#b5765c', espn: 378495, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 6, shotPower: 1, heading: 2, dribbling: 0, firstTouch: 0, linkUp: 1, pace: 3, strength: 2, offBall: 4, composure: 5 } },
  { name: "Omar Marmoush", short: "Marmoush", team: 'EGY', nation: 'EGY', number: 22, height: 71, weight: 174, age: 27, foot: 'right', skin: '#ae8071', espn: 303745, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 8, heading: 3, dribbling: 8, firstTouch: 5, linkUp: 6, pace: 10, strength: 5, offBall: 7, composure: 6 } },
  { name: "Marawan Attia", short: "Attia", team: 'EGY', nation: 'EGY', number: 19, height: 69, weight: 174, age: 28, foot: 'right', skin: '#bb856a', espn: 357112, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 5, heading: 0, dribbling: 1, firstTouch: 2, linkUp: 1, pace: 2, strength: 5, offBall: 0, composure: 2 } },
  { name: "Mohamed Salah", short: "Salah", team: 'EGY', nation: 'EGY', number: 10, height: 69, weight: 172, age: 34, foot: 'left', skin: '#b08371', espn: 173896, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 9, shotPower: 4, heading: 2, dribbling: 6, firstTouch: 7, linkUp: 9, pace: 9, strength: 6, offBall: 9, composure: 11 } },
  { name: "Emam Ashour", short: "Ashour", team: 'EGY', nation: 'EGY', number: 8, height: 71, weight: 170, age: 28, foot: 'right', skin: '#94685a', espn: 299365, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 3, shotPower: 3, heading: 2, dribbling: 0, firstTouch: 1, linkUp: 3, pace: 3, strength: 7, offBall: 3, composure: 3 } },

  // ─── ENG ────────────────────────────────────────────────────────────
  { name: "Harry Kane", short: "Kane", team: 'ENG', nation: 'ENG', number: 9, height: 74, weight: 190, age: 33, foot: 'right', skin: '#ae8071', espn: 142200, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 11, shotPower: 9, heading: 9, dribbling: 8, firstTouch: 8, linkUp: 11, pace: 3, strength: 9, offBall: 11, composure: 11 } },
  { name: "Jude Bellingham", short: "Bellingham", team: 'ENG', nation: 'ENG', number: 10, height: 73, weight: 163, age: 23, foot: 'right', skin: '#885c4d', espn: 291281, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 9, shotPower: 4, heading: 7, dribbling: 10, firstTouch: 10, linkUp: 8, pace: 7, strength: 9, offBall: 9, composure: 10 } },
  { name: "Elliot Anderson", short: "Anderson", team: 'ENG', nation: 'ENG', number: 8, height: 70, weight: 150, age: 24, foot: 'right', skin: '#c38f80', espn: 238472, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 5, heading: 4, dribbling: 9, firstTouch: 8, linkUp: 8, pace: 1, strength: 7, offBall: 3, composure: 7 } },
  { name: "Declan Rice", short: "Rice", team: 'ENG', nation: 'ENG', number: 4, height: 74, weight: 168, age: 27, foot: 'right', skin: '#dfac9c', espn: 238262, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 7, heading: 7, dribbling: 6, firstTouch: 10, linkUp: 10, pace: 6, strength: 6, offBall: 4, composure: 8 } },
  { name: "Bukayo Saka", short: "Saka", team: 'ENG', nation: 'ENG', number: 7, height: 70, weight: 141, age: 25, foot: 'left', skin: '#7b6051', espn: 280555, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 7, heading: 4, dribbling: 9, firstTouch: 7, linkUp: 9, pace: 3, strength: 4, offBall: 9, composure: 10 } },

  // ─── FRA ────────────────────────────────────────────────────────────
  { name: "Kylian Mbappé", short: "Mbappé", team: 'FRA', nation: 'FRA', number: 10, height: 70, weight: 163, age: 27, foot: 'right', skin: '#9a6142', espn: 231388, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 11, shotPower: 9, heading: 2, dribbling: 11, firstTouch: 10, linkUp: 10, pace: 11, strength: 6, offBall: 11, composure: 11 } },
  { name: "Michael Olise", short: "Olise", team: 'FRA', nation: 'FRA', number: 11, height: 71, weight: 172, age: 24, foot: 'left', skin: '#9b6e57', espn: 286831, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 10, shotPower: 11, heading: 5, dribbling: 9, firstTouch: 10, linkUp: 11, pace: 7, strength: 7, offBall: 10, composure: 9 } },
  { name: "Ousmane Dembélé", short: "Dembélé", team: 'FRA', nation: 'FRA', number: 7, height: 70, weight: 148, age: 29, foot: 'both', skin: '#7d5243', espn: 229744, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 5, heading: 5, dribbling: 8, firstTouch: 7, linkUp: 10, pace: 9, strength: 1, offBall: 9, composure: 7 } },
  { name: "Désiré Doué", short: "Doué", team: 'FRA', nation: 'FRA', number: 20, height: 71, weight: 172, age: 21, foot: 'right', skin: '#905e4a', espn: 336388, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 4, heading: 4, dribbling: 9, firstTouch: 7, linkUp: 8, pace: 8, strength: 8, offBall: 8, composure: 2 } },
  { name: "Adrien Rabiot", short: "Rabiot", team: 'FRA', nation: 'FRA', number: 14, height: 75, weight: 190, age: 31, foot: 'left', skin: '#bb8a6c', espn: 176203, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 8, shotPower: 8, heading: 7, dribbling: 4, firstTouch: 6, linkUp: 7, pace: 2, strength: 10, offBall: 5, composure: 8 } },

  // ─── GER ────────────────────────────────────────────────────────────
  { name: "Kai Havertz", short: "Havertz", team: 'GER', nation: 'GER', number: 7, height: 76, weight: 183, age: 27, foot: 'left', skin: '#a67f6b', espn: 231182, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 7, heading: 10, dribbling: 3, firstTouch: 4, linkUp: 5, pace: 6, strength: 9, offBall: 8, composure: 9 } },
  { name: "Florian Wirtz", short: "Wirtz", team: 'GER', nation: 'GER', number: 17, height: 69, weight: 161, age: 23, foot: 'right', skin: '#b0887e', espn: 303748, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 4, shotPower: 6, heading: 2, dribbling: 9, firstTouch: 10, linkUp: 10, pace: 5, strength: 3, offBall: 7, composure: 8 } },
  { name: "Aleksandar Pavlovic", short: "Pavlovic", team: 'GER', nation: 'GER', number: 5, height: 74, weight: 172, age: 22, foot: 'both', skin: '#b0856f', espn: 359370, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 7, shotPower: 9, heading: 6, dribbling: 5, firstTouch: 9, linkUp: 9, pace: 4, strength: 6, offBall: 4, composure: 5 } },
  { name: "Jamal Musiala", short: "Musiala", team: 'GER', nation: 'GER', number: 10, height: 73, weight: 163, age: 23, foot: 'right', skin: '#a06a54', espn: 303821, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 6, heading: 7, dribbling: 10, firstTouch: 9, linkUp: 8, pace: 8, strength: 5, offBall: 7, composure: 6 } },
  { name: "Joshua Kimmich", short: "Kimmich", team: 'GER', nation: 'GER', number: 6, height: 70, weight: 163, age: 31, foot: 'right', skin: '#a07465', espn: 190161, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 8, heading: 3, dribbling: 6, firstTouch: 9, linkUp: 10, pace: 2, strength: 7, offBall: 3, composure: 8 } },

  // ─── GHA ────────────────────────────────────────────────────────────
  { name: "Jordan Ayew", short: "Ayew", team: 'GHA', nation: 'GHA', number: 9, height: 72, weight: 192, age: 35, foot: 'right', skin: '#996651', espn: 123518, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 7, heading: 3, dribbling: 4, firstTouch: 2, linkUp: 2, pace: 5, strength: 6, offBall: 4, composure: 6 } },
  { name: "Antoine Semenyo", short: "Semenyo", team: 'GHA', nation: 'GHA', number: 11, height: 73, weight: 161, age: 26, foot: 'right', skin: '#9e5e45', espn: 273292, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 10, shotPower: 7, heading: 5, dribbling: 7, firstTouch: 5, linkUp: 6, pace: 10, strength: 3, offBall: 8, composure: 3 } },
  { name: "Caleb Yirenkyi", short: "Yirenkyi", team: 'GHA', nation: 'GHA', number: 3, height: 72, weight: 170, age: 20, foot: 'right', skin: '#825b4f', espn: 387659, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 4, heading: 4, dribbling: 3, firstTouch: 4, linkUp: 5, pace: 2, strength: 5, offBall: 0, composure: 2 } },
  { name: "Thomas Partey", short: "Partey", team: 'GHA', nation: 'GHA', number: 5, height: 73, weight: 170, age: 33, foot: 'right', skin: '#6e4c3c', espn: 189972, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 5, heading: 6, dribbling: 7, firstTouch: 7, linkUp: 5, pace: 2, strength: 7, offBall: 4, composure: 5 } },
  { name: "Kwasi Sibo", short: "Sibo", team: 'GHA', nation: 'GHA', number: 8, height: 72, weight: 159, age: 28, foot: 'right', skin: '#b68976', espn: 274697, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 4, heading: 5, dribbling: 8, firstTouch: 5, linkUp: 2, pace: 2, strength: 3, offBall: 2, composure: 5 } },

  // ─── HAI ────────────────────────────────────────────────────────────
  { name: "Frantz Pierrot", short: "Pierrot", team: 'HAI', nation: 'HAI', number: 20, height: 76, weight: 172, age: 27, foot: 'right', skin: '#714934', espn: 250241, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 3, heading: 6, dribbling: 3, firstTouch: 3, linkUp: 2, pace: 7, strength: 6, offBall: 5, composure: 5 } },
  { name: "Wilson Isidor", short: "Isidor", team: 'HAI', nation: 'HAI', number: 18, height: 72, weight: 159, age: 26, foot: 'right', skin: '#94685a', espn: 265915, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 3, heading: 6, dribbling: 2, firstTouch: 2, linkUp: 1, pace: 11, strength: 5, offBall: 7, composure: 7 } },
  { name: "Jean-Ricner Bellegarde", short: "Bellegarde", team: 'HAI', nation: 'HAI', number: 10, height: 67, weight: 146, age: 28, foot: 'right', skin: '#765144', espn: 240369, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 3, heading: 2, dribbling: 6, firstTouch: 5, linkUp: 4, pace: 9, strength: 4, offBall: 4, composure: 4 } },
  { name: "Danley Jean Jacques", short: "Jean Jacques", team: 'HAI', nation: 'HAI', number: 17, height: 72, weight: 159, age: 26, foot: 'right', skin: '#8e635b', espn: 333939, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 0, shotPower: 1, heading: 2, dribbling: 3, firstTouch: 5, linkUp: 1, pace: 3, strength: 4, offBall: 0, composure: 3 } },
  { name: "Ruben Providence", short: "Providence", team: 'HAI', nation: 'HAI', number: 15, height: 70, weight: 161, age: 25, foot: 'right', skin: '#94604e', espn: 307861, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 3, shotPower: 2, heading: 1, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 5, strength: 4, offBall: 3, composure: 2 } },

  // ─── IRN ────────────────────────────────────────────────────────────
  { name: "Mehdi Taremi", short: "Taremi", team: 'IRN', nation: 'IRN', number: 9, height: 74, weight: 181, age: 34, foot: 'right', skin: '#ba8c7a', espn: 219611, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 5, heading: 7, dribbling: 2, firstTouch: 1, linkUp: 3, pace: 4, strength: 7, offBall: 6, composure: 7 } },
  { name: "Saeid Ezatolahi", short: "Ezatolahi", team: 'IRN', nation: 'IRN', number: 6, height: 74, weight: 194, age: 30, foot: 'right', skin: '#b98c7c', espn: 194863, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 6, heading: 6, dribbling: 2, firstTouch: 3, linkUp: 1, pace: 2, strength: 11, offBall: 0, composure: 2 } },
  { name: "Saman Ghoddos", short: "Ghoddos", team: 'IRN', nation: 'IRN', number: 14, height: 69, weight: 170, age: 33, foot: 'right', skin: '#ad8271', espn: 235519, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 3, heading: 0, dribbling: 2, firstTouch: 2, linkUp: 1, pace: 2, strength: 6, offBall: 0, composure: 2 } },
  { name: "Mohammad Ghorbani", short: "Ghorbani", team: 'IRN', nation: 'IRN', number: 21, height: 75, weight: 183, age: 25, foot: 'right', skin: '#ad8271', espn: 355158, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 4, heading: 6, dribbling: 6, firstTouch: 5, linkUp: 1, pace: 3, strength: 8, offBall: 0, composure: 1 } },
  { name: "Alireza Jahanbakhsh", short: "Jahanbakhsh", team: 'IRN', nation: 'IRN', number: 7, height: 72, weight: 172, age: 33, foot: 'right', skin: '#b2795f', espn: 188055, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 4, heading: 4, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 2, strength: 5, offBall: 4, composure: 3 } },

  // ─── IRQ ────────────────────────────────────────────────────────────
  { name: "Ali Al-Hamadi", short: "Al-Hamadi", team: 'IRQ', nation: 'IRQ', number: 9, height: 74, weight: 179, age: 24, foot: 'right', skin: '#b98169', espn: 330579, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 0, shotPower: 3, heading: 4, dribbling: 2, firstTouch: 2, linkUp: 2, pace: 7, strength: 5, offBall: 3, composure: 1 } },
  { name: "Amir Al-Ammari", short: "Al-Ammari", team: 'IRQ', nation: 'IRQ', number: 16, height: 72, weight: 157, age: 29, foot: 'left', skin: '#b07962', espn: 311149, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 1, heading: 2, dribbling: 3, firstTouch: 4, linkUp: 1, pace: 3, strength: 2, offBall: 0, composure: 2 } },
  { name: "Ibrahim Bayesh", short: "Bayesh", team: 'IRQ', nation: 'IRQ', number: 8, height: 72, weight: 172, age: 26, foot: 'right', skin: '#b27c5f', espn: 266496, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 3, heading: 2, dribbling: 1, firstTouch: 1, linkUp: 0, pace: 3, strength: 4, offBall: 0, composure: 3 } },
  { name: "Zidane Iqbal", short: "Iqbal", team: 'IRQ', nation: 'IRQ', number: 14, height: 71, weight: 157, age: 23, foot: 'right', skin: '#ae7a5d', espn: 325549, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 5, heading: 3, dribbling: 4, firstTouch: 5, linkUp: 3, pace: 5, strength: 6, offBall: 2, composure: 3 } },
  { name: "Ali Jasim", short: "Jasim", team: 'IRQ', nation: 'IRQ', number: 17, height: 70, weight: 161, age: 22, foot: 'right', skin: '#7e5b54', espn: 307750, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 3, shotPower: 1, heading: 2, dribbling: 5, firstTouch: 2, linkUp: 0, pace: 6, strength: 3, offBall: 1, composure: 1 } },

  // ─── CIV ────────────────────────────────────────────────────────────
  { name: "Ange-Yoan Bonny", short: "Bonny", team: 'CIV', nation: 'CIV', number: 9, height: 74, weight: 183, age: 23, foot: 'right', skin: '#7d5243', espn: 309185, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 6, heading: 8, dribbling: 7, firstTouch: 5, linkUp: 6, pace: 9, strength: 9, offBall: 8, composure: 2 } },
  { name: "Yan Diomande", short: "Diomande", team: 'CIV', nation: 'CIV', number: 11, height: 71, weight: 168, age: 19, foot: 'right', skin: '#644536', espn: 402479, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 10, shotPower: 10, heading: 5, dribbling: 11, firstTouch: 11, linkUp: 10, pace: 10, strength: 8, offBall: 7, composure: 5 } },
  { name: "Franck Kessié", short: "Kessié", team: 'CIV', nation: 'CIV', number: 8, height: 72, weight: 196, age: 29, foot: 'right', skin: '#7f5749', espn: 194711, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 7, heading: 4, dribbling: 6, firstTouch: 6, linkUp: 2, pace: 2, strength: 9, offBall: 3, composure: 5 } },
  { name: "Ibrahim Sangaré", short: "Sangaré", team: 'CIV', nation: 'CIV', number: 18, height: 75, weight: 170, age: 28, foot: 'right', skin: '#6b493d', espn: 213718, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 7, heading: 8, dribbling: 5, firstTouch: 7, linkUp: 5, pace: 0, strength: 8, offBall: 4, composure: 6 } },
  { name: "Amad Diallo", short: "Diallo", team: 'CIV', nation: 'CIV', number: 15, height: 68, weight: 159, age: 24, foot: 'left', skin: '#765144', espn: 291630, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 2, shotPower: 6, heading: 4, dribbling: 8, firstTouch: 8, linkUp: 7, pace: 9, strength: 5, offBall: 6, composure: 8 } },

  // ─── JPN ────────────────────────────────────────────────────────────
  { name: "Ayase Ueda", short: "Ueda", team: 'JPN', nation: 'JPN', number: 18, height: 72, weight: 168, age: 28, foot: 'right', skin: '#a7725e', espn: 274277, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 4, heading: 10, dribbling: 0, firstTouch: 0, linkUp: 1, pace: 6, strength: 7, offBall: 10, composure: 10 } },
  { name: "Kaishu Sano", short: "Sano", team: 'JPN', nation: 'JPN', number: 24, height: 69, weight: 148, age: 25, foot: 'both', skin: '#765144', espn: 357030, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 4, heading: 3, dribbling: 7, firstTouch: 7, linkUp: 5, pace: 4, strength: 3, offBall: 2, composure: 6 } },
  { name: "Keito Nakamura", short: "Nakamura", team: 'JPN', nation: 'JPN', number: 13, height: 71, weight: 161, age: 26, foot: 'right', skin: '#a2735e', espn: 265953, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 2, heading: 3, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 5, strength: 3, offBall: 5, composure: 6 } },
  { name: "Daichi Kamada", short: "Kamada", team: 'JPN', nation: 'JPN', number: 15, height: 71, weight: 159, age: 30, foot: 'right', skin: '#a07465', espn: 219362, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 4, heading: 4, dribbling: 5, firstTouch: 6, linkUp: 6, pace: 1, strength: 6, offBall: 3, composure: 8 } },
  { name: "Ritsu Doan", short: "Doan", team: 'JPN', nation: 'JPN', number: 10, height: 68, weight: 152, age: 28, foot: 'left', skin: '#a87861', espn: 219627, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 4, heading: 1, dribbling: 5, firstTouch: 4, linkUp: 7, pace: 4, strength: 3, offBall: 5, composure: 5 } },

  // ─── JOR ────────────────────────────────────────────────────────────
  { name: "Mousa Al-Tamari", short: "Al-Tamari", team: 'JOR', nation: 'JOR', number: 10, height: 70, weight: 152, age: 29, foot: 'left', skin: '#b27355', espn: 257489, starter: true, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 2, heading: 3, dribbling: 5, firstTouch: 4, linkUp: 6, pace: 5, strength: 3, offBall: 6, composure: 7 } },
  { name: "Noor Al-Rawabdeh", short: "Al-Rawabdeh", team: 'JOR', nation: 'JOR', number: 8, height: 72, weight: 163, age: 29, foot: 'right', skin: '#bf8c78', espn: 295462, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 3, heading: 2, dribbling: 4, firstTouch: 4, linkUp: 4, pace: 3, strength: 3, offBall: 5, composure: 3 } },
  { name: "Ali Olwan", short: "Olwan", team: 'JOR', nation: 'JOR', number: 9, height: 72, weight: 179, age: 26, foot: 'right', skin: '#bb866f', espn: 320908, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 3, shotPower: 3, heading: 3, dribbling: 4, firstTouch: 2, linkUp: 2, pace: 7, strength: 6, offBall: 3, composure: 3 } },
  { name: "Nizar Al-Rashdan", short: "Al-Rashdan", team: 'JOR', nation: 'JOR', number: 21, height: 72, weight: 161, age: 27, foot: 'right', skin: '#bd8a78', espn: 321515, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 2, heading: 3, dribbling: 4, firstTouch: 3, linkUp: 3, pace: 4, strength: 4, offBall: 4, composure: 3 } },
  { name: "Mahmoud Al-Mardi", short: "Al-Mardi", team: 'JOR', nation: 'JOR', number: 13, height: 68, weight: 159, age: 33, foot: 'right', skin: '#b57c66', espn: 229023, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 3, shotPower: 2, heading: 1, dribbling: 6, firstTouch: 3, linkUp: 1, pace: 4, strength: 3, offBall: 2, composure: 3 } },

  // ─── MEX ────────────────────────────────────────────────────────────
  { name: "Raúl Jiménez", short: "Raúl Jiménez", team: 'MEX', nation: 'MEX', number: 9, height: 74, weight: 168, age: 35, foot: 'right', skin: '#c28b73', espn: 167060, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 5, heading: 10, dribbling: 2, firstTouch: 2, linkUp: 2, pace: 5, strength: 9, offBall: 8, composure: 10 } },
  { name: "Roberto Alvarado", short: "Alvarado", team: 'MEX', nation: 'MEX', number: 25, height: 69, weight: 152, age: 28, foot: 'left', skin: '#c59681', espn: 194308, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 1, heading: 1, dribbling: 5, firstTouch: 5, linkUp: 5, pace: 5, strength: 4, offBall: 3, composure: 4 } },
  { name: "Julián Quiñones", short: "Quiñones", team: 'MEX', nation: 'MEX', number: 16, height: 71, weight: 172, age: 29, foot: 'right', skin: '#765144', espn: 233075, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 3, heading: 7, dribbling: 2, firstTouch: 1, linkUp: 3, pace: 6, strength: 4, offBall: 11, composure: 10 } },
  { name: "Érik Lira", short: "Lira", team: 'MEX', nation: 'MEX', number: 6, height: 68, weight: 152, age: 26, foot: 'right', skin: '#ad8271', espn: 276942, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 1, heading: 0, dribbling: 4, firstTouch: 6, linkUp: 2, pace: 3, strength: 1, offBall: 0, composure: 2 } },
  { name: "Obed Vargas", short: "Vargas", team: 'MEX', nation: 'MEX', number: 18, height: 69, weight: 150, age: 21, foot: 'right', skin: '#cda28f', espn: 318554, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 3, heading: 4, dribbling: 6, firstTouch: 5, linkUp: 4, pace: 5, strength: 6, offBall: 4, composure: 4 } },

  // ─── MAR ────────────────────────────────────────────────────────────
  { name: "Ismael Saibari", short: "Saibari", team: 'MAR', nation: 'MAR', number: 11, height: 73, weight: 179, age: 25, foot: 'right', skin: '#bc8f79', espn: 304572, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 7, shotPower: 6, heading: 7, dribbling: 9, firstTouch: 6, linkUp: 10, pace: 7, strength: 6, offBall: 9, composure: 9 } },
  { name: "Ayyoub Bouaddi", short: "Bouaddi", team: 'MAR', nation: 'MAR', number: 6, height: 73, weight: 163, age: 19, foot: 'right', skin: '#bd836d', espn: 373927, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 5, heading: 5, dribbling: 8, firstTouch: 7, linkUp: 4, pace: 3, strength: 6, offBall: 2, composure: 1 } },
  { name: "Neil El Aynaoui", short: "El Aynaoui", team: 'MAR', nation: 'MAR', number: 24, height: 73, weight: 174, age: 25, foot: 'right', skin: '#936654', espn: 323807, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 5, heading: 6, dribbling: 6, firstTouch: 8, linkUp: 6, pace: 4, strength: 9, offBall: 4, composure: 5 } },
  { name: "Bilal El Khannouss", short: "El Khannouss", team: 'MAR', nation: 'MAR', number: 23, height: 71, weight: 152, age: 22, foot: 'right', skin: '#b57c66', espn: 336595, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 6, heading: 6, dribbling: 7, firstTouch: 7, linkUp: 9, pace: 6, strength: 5, offBall: 5, composure: 5 } },
  { name: "Brahim Díaz", short: "Díaz", team: 'MAR', nation: 'MAR', number: 10, height: 67, weight: 150, age: 27, foot: 'both', skin: '#a07465', espn: 246532, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 4, heading: 2, dribbling: 8, firstTouch: 7, linkUp: 8, pace: 6, strength: 2, offBall: 5, composure: 7 } },

  // ─── NED ────────────────────────────────────────────────────────────
  { name: "Brian Brobbey", short: "Brobbey", team: 'NED', nation: 'NED', number: 19, height: 71, weight: 174, age: 24, foot: 'right', skin: '#5d4638', espn: 282229, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 6, heading: 9, dribbling: 0, firstTouch: 1, linkUp: 2, pace: 9, strength: 9, offBall: 8, composure: 7 } },
  { name: "Cody Gakpo", short: "Gakpo", team: 'NED', nation: 'NED', number: 11, height: 76, weight: 172, age: 27, foot: 'right', skin: '#a2735e', espn: 249524, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 5, shotPower: 10, heading: 8, dribbling: 7, firstTouch: 5, linkUp: 8, pace: 2, strength: 8, offBall: 8, composure: 10 } },
  { name: "Ryan Gravenberch", short: "Gravenberch", team: 'NED', nation: 'NED', number: 8, height: 75, weight: 183, age: 24, foot: 'right', skin: '#8a5232', espn: 274632, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 7, shotPower: 8, heading: 9, dribbling: 8, firstTouch: 8, linkUp: 6, pace: 6, strength: 10, offBall: 3, composure: 6 } },
  { name: "Frenkie de Jong", short: "de Jong", team: 'NED', nation: 'NED', number: 21, height: 71, weight: 161, age: 29, foot: 'right', skin: '#a07465', espn: 219022, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 5, heading: 6, dribbling: 6, firstTouch: 8, linkUp: 9, pace: 2, strength: 5, offBall: 4, composure: 6 } },
  { name: "Donyell Malen", short: "Malen", team: 'NED', nation: 'NED', number: 18, height: 70, weight: 150, age: 27, foot: 'right', skin: '#a16d5a', espn: 259481, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 1, heading: 3, dribbling: 10, firstTouch: 8, linkUp: 5, pace: 7, strength: 4, offBall: 11, composure: 8 } },

  // ─── NZL ────────────────────────────────────────────────────────────
  { name: "Chris Wood", short: "Wood", team: 'NZL', nation: 'NZL', number: 9, height: 75, weight: 205, age: 34, foot: 'right', skin: '#b98f7b', espn: 134190, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 8, heading: 7, dribbling: 6, firstTouch: 5, linkUp: 4, pace: 0, strength: 10, offBall: 7, composure: 7 } },
  { name: "Marko Stamenic", short: "Stamenic", team: 'NZL', nation: 'NZL', number: 8, height: 74, weight: 172, age: 24, foot: 'right', skin: '#a07465', espn: 297798, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 3, heading: 5, dribbling: 2, firstTouch: 5, linkUp: 1, pace: 3, strength: 6, offBall: 1, composure: 1 } },
  { name: "Elijah Just", short: "Just", team: 'NZL', nation: 'NZL', number: 11, height: 69, weight: 152, age: 26, foot: 'left', skin: '#b6938a', espn: 266555, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 2, shotPower: 1, heading: 1, dribbling: 4, firstTouch: 3, linkUp: 5, pace: 5, strength: 2, offBall: 2, composure: 5 } },
  { name: "Joe Bell", short: "Bell", team: 'NZL', nation: 'NZL', number: 6, height: 72, weight: 181, age: 27, foot: 'right', skin: '#ac8673', espn: 228294, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 5, heading: 3, dribbling: 0, firstTouch: 2, linkUp: 2, pace: 2, strength: 7, offBall: 1, composure: 1 } },
  { name: "Sarpreet Singh", short: "Singh", team: 'NZL', nation: 'NZL', number: 10, height: 71, weight: 157, age: 27, foot: 'left', skin: '#a67f6b', espn: 228283, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 2, shotPower: 2, heading: 3, dribbling: 3, firstTouch: 3, linkUp: 2, pace: 4, strength: 3, offBall: 2, composure: 1 } },

  // ─── NOR ────────────────────────────────────────────────────────────
  { name: "Erling Haaland", short: "Haaland", team: 'NOR', nation: 'NOR', number: 9, height: 77, weight: 205, age: 26, foot: 'left', skin: '#c7927c', espn: 253989, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 11, shotPower: 10, heading: 11, dribbling: 5, firstTouch: 5, linkUp: 2, pace: 11, strength: 11, offBall: 11, composure: 11 } },
  { name: "Martin Ødegaard", short: "Ødegaard", team: 'NOR', nation: 'NOR', number: 10, height: 70, weight: 150, age: 27, foot: 'left', skin: '#b88a7a', espn: 203669, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 6, heading: 4, dribbling: 3, firstTouch: 9, linkUp: 10, pace: 1, strength: 4, offBall: 5, composure: 7 } },
  { name: "Sander Berge", short: "Berge", team: 'NOR', nation: 'NOR', number: 8, height: 77, weight: 212, age: 28, foot: 'right', skin: '#af7d67', espn: 218998, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 1, shotPower: 8, heading: 8, dribbling: 3, firstTouch: 7, linkUp: 6, pace: 1, strength: 10, offBall: 3, composure: 4 } },
  { name: "Patrick Berg", short: "Berg", team: 'NOR', nation: 'NOR', number: 6, height: 70, weight: 161, age: 28, foot: 'right', skin: '#b68470', espn: 205924, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 0, shotPower: 3, heading: 1, dribbling: 2, firstTouch: 5, linkUp: 7, pace: 3, strength: 5, offBall: 2, composure: 2 } },
  { name: "Antonio Nusa", short: "Nusa", team: 'NOR', nation: 'NOR', number: 20, height: 72, weight: 170, age: 21, foot: 'right', skin: '#9f6f56', espn: 319368, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 7, heading: 5, dribbling: 11, firstTouch: 8, linkUp: 8, pace: 9, strength: 8, offBall: 6, composure: 8 } },

  // ─── PAN ────────────────────────────────────────────────────────────
  { name: "José Fajardo", short: "Fajardo", team: 'PAN', nation: 'PAN', number: 17, height: 71, weight: 174, age: 33, foot: 'right', skin: '#885c4d', espn: 267996, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 2, heading: 3, dribbling: 0, firstTouch: 0, linkUp: 0, pace: 6, strength: 5, offBall: 3, composure: 1 } },
  { name: "Andrés Andrade", short: "Andrade", team: 'PAN', nation: 'PAN', number: 16, height: 72, weight: 161, age: 37, foot: 'left', skin: '#b0856f', espn: 189775, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 0, shotPower: 1, heading: 8, dribbling: 2, firstTouch: 5, linkUp: 3, pace: 2, strength: 5, offBall: 0, composure: 3 } },
  { name: "Carlos Harvey", short: "Harvey", team: 'PAN', nation: 'PAN', number: 14, height: 73, weight: 194, age: 26, foot: 'right', skin: '#9d6448', espn: 285452, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 2, shotPower: 6, heading: 6, dribbling: 2, firstTouch: 3, linkUp: 1, pace: 3, strength: 8, offBall: 1, composure: 2 } },
  { name: "Édgar Yoel Bárcenas", short: "Bárcenas", team: 'PAN', nation: 'PAN', number: 11, height: 69, weight: 163, age: 33, foot: 'right', skin: '#805f48', espn: 201919, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 3, shotPower: 3, heading: 2, dribbling: 3, firstTouch: 3, linkUp: 2, pace: 2, strength: 5, offBall: 3, composure: 3 } },
  { name: "Cristian Martínez", short: "Martínez", team: 'PAN', nation: 'PAN', number: 6, height: 67, weight: 159, age: 29, foot: 'right', skin: '#bd8c75', espn: 176145, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 2, heading: 0, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 3, strength: 3, offBall: 3, composure: 2 } },

  // ─── PAR ────────────────────────────────────────────────────────────
  { name: "Julio Enciso", short: "Enciso", team: 'PAR', nation: 'PAR', number: 19, height: 68, weight: 139, age: 22, foot: 'right', skin: '#b0887e', espn: 20975, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 2, shotPower: 8, heading: 1, dribbling: 10, firstTouch: 6, linkUp: 8, pace: 8, strength: 1, offBall: 6, composure: 5 } },
  { name: "Diego Gómez", short: "Gómez", team: 'PAR', nation: 'PAR', number: 8, height: 73, weight: 170, age: 23, foot: 'right', skin: '#a56f53', espn: 192278, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 7, heading: 8, dribbling: 5, firstTouch: 5, linkUp: 4, pace: 5, strength: 6, offBall: 6, composure: 4 } },
  { name: "Andrés Cubas", short: "Cubas", team: 'PAR', nation: 'PAR', number: 14, height: 66, weight: 146, age: 30, foot: 'right', skin: '#bc8f79', espn: 202501, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 0, heading: 0, dribbling: 3, firstTouch: 6, linkUp: 1, pace: 2, strength: 2, offBall: 0, composure: 4 } },
  { name: "Matías Galarza", short: "Galarza", team: 'PAR', nation: 'PAR', number: 23, height: 69, weight: 148, age: 24, foot: 'left', skin: '#b98169', espn: 297328, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 1, heading: 2, dribbling: 0, firstTouch: 2, linkUp: 2, pace: 3, strength: 2, offBall: 1, composure: 2 } },
  { name: "Miguel Almirón", short: "Almirón", team: 'PAR', nation: 'PAR', number: 10, height: 69, weight: 152, age: 32, foot: 'left', skin: '#c89f90', espn: 48128, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 1, shotPower: 1, heading: 0, dribbling: 8, firstTouch: 5, linkUp: 6, pace: 4, strength: 3, offBall: 4, composure: 5 } },

  // ─── POR ────────────────────────────────────────────────────────────
  { name: "Cristiano Ronaldo", short: "Ronaldo", team: 'POR', nation: 'POR', number: 7, height: 74, weight: 174, age: 41, foot: 'right', skin: '#b07a65', espn: 22774, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 11, heading: 11, dribbling: 3, firstTouch: 8, linkUp: 1, pace: 1, strength: 8, offBall: 10, composure: 10 } },
  { name: "Vitinha", short: "Vitinha", team: 'POR', nation: 'POR', number: 23, height: 68, weight: 139, age: 26, foot: 'right', skin: '#a67f6b', espn: 288897, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 6, heading: 2, dribbling: 8, firstTouch: 11, linkUp: 9, pace: 4, strength: 1, offBall: 3, composure: 7 } },
  { name: "João Neves", short: "Neves", team: 'POR', nation: 'POR', number: 15, height: 69, weight: 146, age: 22, foot: 'right', skin: '#946c58', espn: 355061, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 5, shotPower: 2, heading: 6, dribbling: 4, firstTouch: 6, linkUp: 6, pace: 4, strength: 3, offBall: 5, composure: 3 } },
  { name: "Pedro Neto", short: "Neto", team: 'POR', nation: 'POR', number: 18, height: 69, weight: 172, age: 26, foot: 'left', skin: '#b0856f', espn: 256115, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 7, heading: 3, dribbling: 8, firstTouch: 8, linkUp: 8, pace: 10, strength: 5, offBall: 6, composure: 5 } },
  { name: "Bruno Fernandes", short: "Fernandes", team: 'POR', nation: 'POR', number: 8, height: 72, weight: 139, age: 32, foot: 'right', skin: '#a67f6b', espn: 124091, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 8, heading: 4, dribbling: 2, firstTouch: 6, linkUp: 11, pace: 1, strength: 1, offBall: 7, composure: 10 } },

  // ─── QAT ────────────────────────────────────────────────────────────
  { name: "Yusuf Abdurisag", short: "Abdurisag", team: 'QAT', nation: 'QAT', number: 15, height: 69, weight: 139, age: 27, foot: 'right', skin: '#8b5b48', espn: 274164, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 3, shotPower: 1, heading: 1, dribbling: 3, firstTouch: 2, linkUp: 3, pace: 6, strength: 1, offBall: 4, composure: 2 } },
  { name: "Akram Afif", short: "Afif", team: 'QAT', nation: 'QAT', number: 11, height: 70, weight: 152, age: 29, foot: 'right', skin: '#b27355', espn: 219258, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 6, shotPower: 1, heading: 2, dribbling: 3, firstTouch: 3, linkUp: 6, pace: 4, strength: 3, offBall: 5, composure: 5 } },
  { name: "Edmílson Junior", short: "Edmílson Junior", team: 'QAT', nation: 'QAT', number: 8, height: 71, weight: 157, age: 32, foot: 'right', skin: '#ae7359', espn: 109204, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 2, heading: 2, dribbling: 4, firstTouch: 3, linkUp: 4, pace: 4, strength: 3, offBall: 4, composure: 3 } },
  { name: "Assim Madibo", short: "Madibo", team: 'QAT', nation: 'QAT', number: 23, height: 66, weight: 159, age: 30, foot: 'right', skin: '#a06244', espn: 219254, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 2, heading: 0, dribbling: 2, firstTouch: 3, linkUp: 3, pace: 2, strength: 2, offBall: 2, composure: 2 } },
  { name: "Karim Boudiaf", short: "Boudiaf", team: 'QAT', nation: 'QAT', number: 12, height: 75, weight: 185, age: 36, foot: 'right', skin: '#c18c71', espn: 172245, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 3, heading: 7, dribbling: 4, firstTouch: 3, linkUp: 4, pace: 2, strength: 8, offBall: 4, composure: 3 } },

  // ─── KSA ────────────────────────────────────────────────────────────
  { name: "Feras Al-Brikan", short: "Al-Brikan", team: 'KSA', nation: 'KSA', number: 9, height: 73, weight: 172, age: 26, foot: 'left', skin: '#945e44', espn: 283331, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 4, heading: 3, dribbling: 0, firstTouch: 1, linkUp: 1, pace: 5, strength: 8, offBall: 2, composure: 4 } },
  { name: "Salem Al-Dawsari", short: "Al-Dawsari", team: 'KSA', nation: 'KSA', number: 10, height: 68, weight: 157, age: 35, foot: 'right', skin: '#b07962', espn: 163850, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 2, heading: 1, dribbling: 3, firstTouch: 3, linkUp: 7, pace: 3, strength: 3, offBall: 5, composure: 3 } },
  { name: "Mohamed Kanno", short: "Kanno", team: 'KSA', nation: 'KSA', number: 23, height: 75, weight: 148, age: 32, foot: 'right', skin: '#8b5b48', espn: 262468, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 0, heading: 7, dribbling: 0, firstTouch: 3, linkUp: 4, pace: 2, strength: 1, offBall: 2, composure: 4 } },
  { name: "Nasser Al-Dawsari", short: "Al-Dawsari", team: 'KSA', nation: 'KSA', number: 6, height: 70, weight: 170, age: 27, foot: 'left', skin: '#a86e52', espn: 270417, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 3, heading: 1, dribbling: 1, firstTouch: 4, linkUp: 3, pace: 3, strength: 4, offBall: 0, composure: 2 } },
  { name: "Abdullah Al-Khaibari", short: "Al-Khaibari", team: 'KSA', nation: 'KSA', number: 15, height: 69, weight: 146, age: 30, foot: 'right', skin: '#815341', espn: 271461, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 1, heading: 0, dribbling: 1, firstTouch: 2, linkUp: 2, pace: 2, strength: 1, offBall: 0, composure: 2 } },

  // ─── SCO ────────────────────────────────────────────────────────────
  { name: "Lawrence Shankland", short: "Shankland", team: 'SCO', nation: 'SCO', number: 20, height: 73, weight: 163, age: 31, foot: 'right', skin: '#b07962', espn: 173306, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 1, heading: 6, dribbling: 1, firstTouch: 1, linkUp: 1, pace: 6, strength: 2, offBall: 6, composure: 6 } },
  { name: "Scott McTominay", short: "McTominay", team: 'SCO', nation: 'SCO', number: 4, height: 76, weight: 192, age: 29, foot: 'right', skin: '#b68470', espn: 255850, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 9, heading: 10, dribbling: 5, firstTouch: 6, linkUp: 5, pace: 3, strength: 10, offBall: 8, composure: 3 } },
  { name: "Lewis Ferguson", short: "Ferguson", team: 'SCO', nation: 'SCO', number: 19, height: 71, weight: 161, age: 27, foot: 'right', skin: '#ba8c7a', espn: 202429, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 5, heading: 6, dribbling: 3, firstTouch: 7, linkUp: 5, pace: 3, strength: 6, offBall: 3, composure: 2 } },
  { name: "John McGinn", short: "McGinn", team: 'SCO', nation: 'SCO', number: 7, height: 70, weight: 150, age: 32, foot: 'left', skin: '#c58f83', espn: 162843, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 6, shotPower: 4, heading: 3, dribbling: 5, firstTouch: 3, linkUp: 7, pace: 8, strength: 5, offBall: 4, composure: 5 } },
  { name: "Ben Gannon-Doak", short: "Gannon-Doak", team: 'SCO', nation: 'SCO', number: 17, height: 68, weight: 141, age: 20, foot: 'right', skin: '#95705f', espn: 332948, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 3, heading: 4, dribbling: 5, firstTouch: 4, linkUp: 5, pace: 5, strength: 2, offBall: 5, composure: 3 } },

  // ─── SEN ────────────────────────────────────────────────────────────
  { name: "Nicolas Jackson", short: "Jackson", team: 'SEN', nation: 'SEN', number: 11, height: 74, weight: 181, age: 25, foot: 'right', skin: '#6c4943', espn: 308524, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 6, heading: 7, dribbling: 7, firstTouch: 4, linkUp: 5, pace: 7, strength: 8, offBall: 9, composure: 6 } },
  { name: "Ismaïla Sarr", short: "Sarr", team: 'SEN', nation: 'SEN', number: 18, height: 73, weight: 168, age: 28, foot: 'right', skin: '#785c4a', espn: 241012, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 6, heading: 7, dribbling: 3, firstTouch: 3, linkUp: 2, pace: 9, strength: 7, offBall: 7, composure: 10 } },
  { name: "Lamine Camara", short: "Camara", team: 'SEN', nation: 'SEN', number: 8, height: 68, weight: 141, age: 22, foot: 'right', skin: '#765144', espn: 38721, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 1, heading: 1, dribbling: 5, firstTouch: 8, linkUp: 7, pace: 5, strength: 6, offBall: 2, composure: 5 } },
  { name: "Krépin Diatta", short: "Diatta", team: 'SEN', nation: 'SEN', number: 15, height: 69, weight: 150, age: 27, foot: 'right', skin: '#6c4943', espn: 253992, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 2, shotPower: 4, heading: 3, dribbling: 5, firstTouch: 5, linkUp: 4, pace: 3, strength: 5, offBall: 3, composure: 2 } },
  { name: "Ibrahim Mbaye", short: "Mbaye", team: 'SEN', nation: 'SEN', number: 20, height: 73, weight: 141, age: 18, foot: 'right', skin: '#97644d', espn: 388522, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 2, heading: 6, dribbling: 6, firstTouch: 5, linkUp: 7, pace: 8, strength: 2, offBall: 5, composure: 3 } },

  // ─── RSA ────────────────────────────────────────────────────────────
  { name: "Evidence Makgopa", short: "Makgopa", team: 'RSA', nation: 'RSA', number: 17, height: 74, weight: 161, age: 26, foot: 'right', skin: '#876054', espn: 303312, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 2, shotPower: 1, heading: 4, dribbling: 3, firstTouch: 2, linkUp: 2, pace: 8, strength: 4, offBall: 4, composure: 2 } },
  { name: "Teboho Mokoena", short: "Mokoena", team: 'RSA', nation: 'RSA', number: 4, height: 69, weight: 168, age: 29, foot: 'right', skin: '#7f5749', espn: 256691, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 8, heading: 1, dribbling: 1, firstTouch: 3, linkUp: 3, pace: 2, strength: 4, offBall: 1, composure: 4 } },
  { name: "Thalente Mbatha", short: "Mbatha", team: 'RSA', nation: 'RSA', number: 5, height: 71, weight: 157, age: 26, foot: 'right', skin: '#9e5e45', espn: 301321, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 1, heading: 2, dribbling: 2, firstTouch: 2, linkUp: 2, pace: 3, strength: 3, offBall: 0, composure: 2 } },
  { name: "Oswin Appollis", short: "Appollis", team: 'RSA', nation: 'RSA', number: 7, height: 67, weight: 152, age: 25, foot: 'right', skin: '#b88a7a', espn: 288771, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 2, shotPower: 5, heading: 0, dribbling: 4, firstTouch: 2, linkUp: 6, pace: 6, strength: 3, offBall: 4, composure: 3 } },
  { name: "Thapelo Maseko", short: "Maseko", team: 'RSA', nation: 'RSA', number: 12, height: 70, weight: 161, age: 22, foot: 'left', skin: '#754b3a', espn: 335450, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 5, shotPower: 4, heading: 2, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 5, strength: 4, offBall: 4, composure: 3 } },

  // ─── KOR ────────────────────────────────────────────────────────────
  { name: "Son Heung-Min", short: "Son", team: 'KOR', nation: 'KOR', number: 7, height: 72, weight: 168, age: 34, foot: 'both', skin: '#ac8673', espn: 149945, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 7, shotPower: 8, heading: 1, dribbling: 4, firstTouch: 6, linkUp: 8, pace: 6, strength: 5, offBall: 8, composure: 8 } },
  { name: "Lee Kang-In", short: "Kang-In", team: 'KOR', nation: 'KOR', number: 19, height: 68, weight: 146, age: 25, foot: 'left', skin: '#99736a', espn: 274197, starter: false, position: 'ST', role: 'SS',
    attrs: { finishing: 6, shotPower: 7, heading: 2, dribbling: 9, firstTouch: 8, linkUp: 10, pace: 7, strength: 2, offBall: 5, composure: 5 } },
  { name: "Hwang In-Beom", short: "In-Beom", team: 'KOR', nation: 'KOR', number: 6, height: 70, weight: 152, age: 30, foot: 'both', skin: '#a87e66', espn: 280061, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 2, heading: 3, dribbling: 5, firstTouch: 5, linkUp: 8, pace: 3, strength: 2, offBall: 3, composure: 2 } },
  { name: "Paik Seung-Ho", short: "Seung-Ho", team: 'KOR', nation: 'KOR', number: 8, height: 72, weight: 159, age: 29, foot: 'right', skin: '#b0856f', espn: 256598, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 3, heading: 9, dribbling: 4, firstTouch: 4, linkUp: 2, pace: 3, strength: 2, offBall: 0, composure: 3 } },
  { name: "Oh Hyeon-Gyu", short: "Oh", team: 'KOR', nation: 'KOR', number: 18, height: 74, weight: 159, age: 25, foot: 'right', skin: '#95705f', espn: 302434, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 2, heading: 5, dribbling: 4, firstTouch: 4, linkUp: 4, pace: 8, strength: 5, offBall: 8, composure: 3 } },

  // ─── ESP ────────────────────────────────────────────────────────────
  { name: "Mikel Oyarzabal", short: "Oyarzabal", team: 'ESP', nation: 'ESP', number: 21, height: 71, weight: 172, age: 29, foot: 'left', skin: '#b4856b', espn: 229018, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 8, heading: 5, dribbling: 7, firstTouch: 5, linkUp: 6, pace: 7, strength: 6, offBall: 8, composure: 11 } },
  { name: "Lamine Yamal", short: "Yamal", team: 'ESP', nation: 'ESP', number: 19, height: 70, weight: 168, age: 19, foot: 'left', skin: '#876054', espn: 362150, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 10, shotPower: 10, heading: 4, dribbling: 11, firstTouch: 11, linkUp: 11, pace: 10, strength: 7, offBall: 10, composure: 9 } },
  { name: "Rodri", short: "Rodri", team: 'ESP', nation: 'ESP', number: 16, height: 75, weight: 196, age: 30, foot: 'right', skin: '#ae8071', espn: 231828, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 8, heading: 9, dribbling: 3, firstTouch: 9, linkUp: 9, pace: 1, strength: 11, offBall: 4, composure: 7 } },
  { name: "Pedri", short: "Pedri", team: 'ESP', nation: 'ESP', number: 20, height: 69, weight: 150, age: 23, foot: 'right', skin: '#bc8f79', espn: 250465, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 4, heading: 3, dribbling: 9, firstTouch: 11, linkUp: 11, pace: 6, strength: 3, offBall: 4, composure: 7 } },
  { name: "Dani Olmo", short: "Olmo", team: 'ESP', nation: 'ESP', number: 10, height: 72, weight: 161, age: 28, foot: 'right', skin: '#ba8c7a', espn: 227765, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 6, shotPower: 8, heading: 5, dribbling: 4, firstTouch: 6, linkUp: 10, pace: 3, strength: 7, offBall: 8, composure: 7 } },

  // ─── SWE ────────────────────────────────────────────────────────────
  { name: "Viktor Gyökeres", short: "Gyökeres", team: 'SWE', nation: 'SWE', number: 17, height: 74, weight: 196, age: 28, foot: 'right', skin: '#bd8a78', espn: 258906, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 9, shotPower: 9, heading: 8, dribbling: 4, firstTouch: 3, linkUp: 3, pace: 10, strength: 9, offBall: 9, composure: 10 } },
  { name: "Alexander Isak", short: "Isak", team: 'SWE', nation: 'SWE', number: 9, height: 75, weight: 161, age: 27, foot: 'right', skin: '#94604e', espn: 235662, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 10, shotPower: 4, heading: 8, dribbling: 6, firstTouch: 4, linkUp: 3, pace: 9, strength: 6, offBall: 9, composure: 7 } },
  { name: "Yasin Ayari", short: "Ayari", team: 'SWE', nation: 'SWE', number: 18, height: 68, weight: 150, age: 23, foot: 'right', skin: '#ac8067', espn: 304242, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 8, heading: 1, dribbling: 4, firstTouch: 5, linkUp: 5, pace: 1, strength: 2, offBall: 5, composure: 8 } },
  { name: "Anthony Elanga", short: "Elanga", team: 'SWE', nation: 'SWE', number: 11, height: 70, weight: 163, age: 24, foot: 'right', skin: '#764f3f', espn: 296622, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 4, shotPower: 4, heading: 4, dribbling: 4, firstTouch: 4, linkUp: 5, pace: 11, strength: 5, offBall: 5, composure: 6 } },
  { name: "Lucas Bergvall", short: "Bergvall", team: 'SWE', nation: 'SWE', number: 7, height: 74, weight: 163, age: 20, foot: 'right', skin: '#b0887e', espn: 356379, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 4, shotPower: 6, heading: 9, dribbling: 7, firstTouch: 7, linkUp: 5, pace: 8, strength: 6, offBall: 5, composure: 1 } },

  // ─── SUI ────────────────────────────────────────────────────────────
  { name: "Breel Embolo", short: "Embolo", team: 'SUI', nation: 'SUI', number: 7, height: 74, weight: 183, age: 29, foot: 'right', skin: '#7e5b54', espn: 202099, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 5, shotPower: 5, heading: 9, dribbling: 3, firstTouch: 1, linkUp: 1, pace: 6, strength: 10, offBall: 7, composure: 8 } },
  { name: "Granit Xhaka", short: "Xhaka", team: 'SUI', nation: 'SUI', number: 10, height: 73, weight: 174, age: 34, foot: 'left', skin: '#c89477', espn: 149981, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 5, shotPower: 9, heading: 6, dribbling: 4, firstTouch: 8, linkUp: 7, pace: 0, strength: 9, offBall: 2, composure: 8 } },
  { name: "Remo Freuler", short: "Freuler", team: 'SUI', nation: 'SUI', number: 8, height: 71, weight: 170, age: 34, foot: 'right', skin: '#a87e66', espn: 152600, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 3, shotPower: 5, heading: 6, dribbling: 2, firstTouch: 5, linkUp: 5, pace: 2, strength: 5, offBall: 2, composure: 5 } },
  { name: "Dan Ndoye", short: "Ndoye", team: 'SUI', nation: 'SUI', number: 11, height: 72, weight: 159, age: 26, foot: 'right', skin: '#b57c66', espn: 275842, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 4, heading: 7, dribbling: 5, firstTouch: 3, linkUp: 5, pace: 10, strength: 4, offBall: 6, composure: 5 } },
  { name: "Johan Manzambi", short: "Manzambi", team: 'SUI', nation: 'SUI', number: 9, height: 72, weight: 163, age: 21, foot: 'right', skin: '#765144', espn: 386992, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 6, shotPower: 4, heading: 7, dribbling: 8, firstTouch: 7, linkUp: 7, pace: 3, strength: 7, offBall: 6, composure: 8 } },

  // ─── TUN ────────────────────────────────────────────────────────────
  { name: "Hazem Mastouri", short: "Mastouri", team: 'TUN', nation: 'TUN', number: 9, height: 75, weight: 174, age: 29, foot: 'right', skin: '#b69384', espn: 396085, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 4, shotPower: 4, heading: 5, dribbling: 5, firstTouch: 3, linkUp: 1, pace: 6, strength: 6, offBall: 5, composure: 3 } },
  { name: "Ellyes Skhiri", short: "Skhiri", team: 'TUN', nation: 'TUN', number: 17, height: 73, weight: 161, age: 31, foot: 'right', skin: '#b37d5e', espn: 209595, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 4, heading: 7, dribbling: 5, firstTouch: 6, linkUp: 5, pace: 2, strength: 5, offBall: 3, composure: 3 } },
  { name: "Hannibal Mejbri", short: "Mejbri", team: 'TUN', nation: 'TUN', number: 10, height: 70, weight: 161, age: 23, foot: 'right', skin: '#a7725e', espn: 300007, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 5, heading: 4, dribbling: 7, firstTouch: 6, linkUp: 6, pace: 2, strength: 6, offBall: 4, composure: 3 } },
  { name: "Rani Khedira", short: "Khedira", team: 'TUN', nation: 'TUN', number: 13, height: 74, weight: 183, age: 32, foot: 'right', skin: '#b0856f', espn: 159152, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 8, shotPower: 8, heading: 7, dribbling: 1, firstTouch: 2, linkUp: 1, pace: 2, strength: 9, offBall: 2, composure: 5 } },
  { name: "Anis Slimane", short: "Slimane", team: 'TUN', nation: 'TUN', number: 25, height: 74, weight: 190, age: 25, foot: 'both', skin: '#b4856b', espn: 302944, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 6, heading: 5, dribbling: 0, firstTouch: 0, linkUp: 4, pace: 2, strength: 8, offBall: 2, composure: 2 } },

  // ─── TUR ────────────────────────────────────────────────────────────
  { name: "Kerem Aktürkoglu", short: "Aktürkoglu", team: 'TUR', nation: 'TUR', number: 7, height: 68, weight: 150, age: 28, foot: 'right', skin: '#b87d69', espn: 306789, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 6, shotPower: 3, heading: 0, dribbling: 2, firstTouch: 2, linkUp: 7, pace: 5, strength: 2, offBall: 5, composure: 9 } },
  { name: "Arda Güler", short: "Güler", team: 'TUR', nation: 'TUR', number: 8, height: 69, weight: 148, age: 21, foot: 'left', skin: '#95705f', espn: 310452, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 5, shotPower: 3, heading: 4, dribbling: 9, firstTouch: 9, linkUp: 11, pace: 6, strength: 5, offBall: 6, composure: 7 } },
  { name: "Kenan Yildiz", short: "Yildiz", team: 'TUR', nation: 'TUR', number: 11, height: 74, weight: 170, age: 21, foot: 'both', skin: '#a07465', espn: 366509, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 7, shotPower: 6, heading: 6, dribbling: 10, firstTouch: 9, linkUp: 10, pace: 8, strength: 9, offBall: 6, composure: 3 } },
  { name: "Hakan Çalhanoglu", short: "Çalhanoglu", team: 'TUR', nation: 'TUR', number: 10, height: 70, weight: 168, age: 32, foot: 'right', skin: '#a67f6b', espn: 170785, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 10, shotPower: 9, heading: 4, dribbling: 2, firstTouch: 5, linkUp: 9, pace: 2, strength: 4, offBall: 5, composure: 10 } },
  { name: "Baris Alper Yilmaz", short: "Barış Alper", team: 'TUR', nation: 'TUR', number: 21, height: 73, weight: 190, age: 26, foot: 'right', skin: '#c29a86', espn: 322538, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 4, shotPower: 6, heading: 7, dribbling: 6, firstTouch: 3, linkUp: 7, pace: 6, strength: 10, offBall: 5, composure: 8 } },

  // ─── USA ────────────────────────────────────────────────────────────
  { name: "Folarin Balogun", short: "Balogun", team: 'USA', nation: 'USA', number: 20, height: 70, weight: 146, age: 25, foot: 'right', skin: '#815341', espn: 282643, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 6, shotPower: 2, heading: 4, dribbling: 3, firstTouch: 3, linkUp: 3, pace: 7, strength: 3, offBall: 8, composure: 10 } },
  { name: "Weston McKennie", short: "McKennie", team: 'USA', nation: 'USA', number: 8, height: 73, weight: 185, age: 28, foot: 'right', skin: '#a7725e', espn: 256715, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 1, shotPower: 8, heading: 6, dribbling: 4, firstTouch: 6, linkUp: 7, pace: 2, strength: 7, offBall: 5, composure: 8 } },
  { name: "Malik Tillman", short: "Tillman", team: 'USA', nation: 'USA', number: 17, height: 74, weight: 190, age: 24, foot: 'right', skin: '#aa715a', espn: 301416, starter: false, position: 'ST', role: 'AM',
    attrs: { finishing: 7, shotPower: 8, heading: 6, dribbling: 3, firstTouch: 4, linkUp: 6, pace: 3, strength: 9, offBall: 6, composure: 6 } },
  { name: "Tyler Adams", short: "Adams", team: 'USA', nation: 'USA', number: 4, height: 69, weight: 159, age: 27, foot: 'right', skin: '#a16d5a', espn: 222776, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 7, shotPower: 4, heading: 5, dribbling: 4, firstTouch: 7, linkUp: 4, pace: 2, strength: 3, offBall: 2, composure: 6 } },
  { name: "Christian Pulisic", short: "Pulisic", team: 'USA', nation: 'USA', number: 10, height: 70, weight: 161, age: 28, foot: 'right', skin: '#93685d', espn: 225607, starter: false, position: 'ST', role: 'ST',
    attrs: { finishing: 8, shotPower: 4, heading: 5, dribbling: 9, firstTouch: 10, linkUp: 9, pace: 7, strength: 4, offBall: 8, composure: 4 } },

  // ─── URU ────────────────────────────────────────────────────────────
  { name: "Darwin Núñez", short: "Núñez", team: 'URU', nation: 'URU', number: 9, height: 74, weight: 179, age: 27, foot: 'right', skin: '#bc866e', espn: 271788, starter: true, position: 'ST', role: 'ST',
    attrs: { finishing: 0, shotPower: 5, heading: 4, dribbling: 3, firstTouch: 2, linkUp: 2, pace: 9, strength: 6, offBall: 7, composure: 2 } },
  { name: "Federico Valverde", short: "Valverde", team: 'URU', nation: 'URU', number: 8, height: 72, weight: 172, age: 28, foot: 'right', skin: '#a67f6b', espn: 235818, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 7, shotPower: 7, heading: 6, dribbling: 7, firstTouch: 10, linkUp: 8, pace: 3, strength: 8, offBall: 4, composure: 8 } },
  { name: "Rodrigo Bentancur", short: "Bentancur", team: 'URU', nation: 'URU', number: 6, height: 74, weight: 159, age: 29, foot: 'right', skin: '#be8b6f', espn: 215772, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 4, shotPower: 5, heading: 7, dribbling: 7, firstTouch: 8, linkUp: 4, pace: 1, strength: 4, offBall: 3, composure: 5 } },
  { name: "Maxi Araújo", short: "Araújo", team: 'URU', nation: 'URU', number: 20, height: 70, weight: 168, age: 26, foot: 'left', skin: '#95705f', espn: 287025, starter: false, position: 'ST', role: 'LW',
    attrs: { finishing: 3, shotPower: 7, heading: 3, dribbling: 4, firstTouch: 6, linkUp: 5, pace: 4, strength: 6, offBall: 4, composure: 7 } },
  { name: "Agustín Canobbio", short: "Canobbio", team: 'URU', nation: 'URU', number: 14, height: 69, weight: 179, age: 28, foot: 'right', skin: '#b0856f', espn: 241466, starter: false, position: 'ST', role: 'RW',
    attrs: { finishing: 3, shotPower: 3, heading: 1, dribbling: 5, firstTouch: 4, linkUp: 3, pace: 4, strength: 7, offBall: 4, composure: 6 } },

  // ─── UZB ────────────────────────────────────────────────────────────
  { name: "Eldor Shomurodov", short: "Shomurodov", team: 'UZB', nation: 'UZB', number: 14, height: 75, weight: 172, age: 31, foot: 'right', skin: '#bf8671', espn: 216937, starter: true, position: 'ST', role: 'SS',
    attrs: { finishing: 10, shotPower: 7, heading: 9, dribbling: 2, firstTouch: 1, linkUp: 2, pace: 4, strength: 4, offBall: 7, composure: 10 } },
  { name: "Otabek Shukurov", short: "Shukurov", team: 'UZB', nation: 'UZB', number: 7, height: 72, weight: 163, age: 30, foot: 'right', skin: '#be8968', espn: 195281, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 0, shotPower: 2, heading: 3, dribbling: 2, firstTouch: 3, linkUp: 2, pace: 2, strength: 5, offBall: 0, composure: 2 } },
  { name: "Akmal Mozgovoy", short: "Mozgovoy", team: 'UZB', nation: 'UZB', number: 6, height: 71, weight: 152, age: 27, foot: 'right', skin: '#b28376', espn: 270461, starter: false, position: 'ST', role: 'DM',
    attrs: { finishing: 2, shotPower: 1, heading: 1, dribbling: 1, firstTouch: 1, linkUp: 1, pace: 2, strength: 2, offBall: 0, composure: 1 } },
  { name: "Abdulla Abdullaev", short: "Abdullaev", team: 'UZB', nation: 'UZB', number: 18, height: 71, weight: 159, age: 29, foot: 'right', skin: '#bb866f', espn: 326928, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 1, shotPower: 1, heading: 2, dribbling: 2, firstTouch: 2, linkUp: 0, pace: 3, strength: 2, offBall: 0, composure: 1 } },
  { name: "Azizjon Ganiev", short: "Ganiev", team: 'UZB', nation: 'UZB', number: 19, height: 71, weight: 139, age: 28, foot: 'right', skin: '#ab7b63', espn: 268558, starter: false, position: 'ST', role: 'CM',
    attrs: { finishing: 0, shotPower: 0, heading: 2, dribbling: 0, firstTouch: 1, linkUp: 1, pace: 3, strength: 2, offBall: 0, composure: 0 } },
]

// The pool is wider than strikers (wingers and midfielders too); same arrays under player names
export const SOCCER_PLAYERS = SOCCER_STRIKERS
export const WC_PLAYERS = WC_STRIKERS
