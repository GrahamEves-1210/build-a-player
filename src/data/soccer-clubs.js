// Top Divisions: the 96 clubs of the 2026-27 Premier League, La Liga, Serie A, Bundesliga and Ligue 1, and the 15
// Champions League clubs from outside those five leagues (UCL_ONLY below).
// Two lists come out of it (the owner, 2026-11-16):
//   UCL_CLUBS     the wheel and the card binder: the 36 clubs of the 2026-27 Champions League league phase.
//   SOCCER_CLUBS  Career (and Squad Builder): the domestic leagues it plays in, SOCCER_LIVE_LEAGUES below. Unchanged.
//   SOCCER_SIM_CLUBS  every club the season engine plays a league season for (all five leagues).
// Club list, ESPN team ids (espn) and logos: ESPN soccer API (site.api.espn.com .../soccer/{league}/teams), 2026-27.
// short: a 3-character code unique across all 96 clubs (and not a World Cup nation code). Bundesliga's own codes keep
//   their digits for Leverkusen (B04), Mainz (M05) and Schalke (S04); Espanyol is RCD, Parma PRM, Monza MNZ, Brest BST,
//   Paris FC PFC, so nothing collides.
// color / color2: home kit colour and second kit colour.
// Strength (0-100), as of 2026-11-07:
//   ovr = Opta Power Rankings club rating (theanalyst.com Opta Power Rankings data, world No. 1 = 100), which blends
//         results and expected goals over time. The five leagues run from about 80 (bottom of Ligue 1 / Serie A) to 100.
//   att / def = ovr split by how the club gets there: per-match attack and defence rates (70% FotMob xG for/against,
//         30% ESPN goals for/against), 2026-27 so far weighted with 2025-26 (0.6 x its matches; promoted clubs have
//         this season only and are pulled toward their league average), turned into league z-scores, and
//         att = ovr + 3 x (zAttack - zDefence) / 2, def = ovr - the same. A balanced club has att = def = ovr.
//   2025-26 finishes and the 2026-27 table so far (ESPN standings) are inside both Opta and the xG rates.

// (the five leagues; the Champions League clubs from elsewhere carry their own league id, OTHER_LEAGUES)
const ALL_LEAGUES = [
  { id: 'eng.1', name: 'Premier League', short: 'EPL', country: 'England' },
  { id: 'esp.1', name: 'La Liga', short: 'LIGA', country: 'Spain' },
  { id: 'ita.1', name: 'Serie A', short: 'SA', country: 'Italy' },
  { id: 'ger.1', name: 'Bundesliga', short: 'BUN', country: 'Germany' },
  { id: 'fra.1', name: 'Ligue 1', short: 'L1', country: 'France' },
]
export const OTHER_LEAGUES = [
  { id: 'por.1', name: 'Liga Portugal', country: 'Portugal' }, { id: 'ned.1', name: 'Eredivisie', country: 'Netherlands' },
  { id: 'bel.1', name: 'Belgian Pro League', country: 'Belgium' }, { id: 'tur.1', name: 'Süper Lig', country: 'Turkey' },
  { id: 'nor.1', name: 'Eliteserien', country: 'Norway' }, { id: 'ukr.1', name: 'Ukrainian Premier League', country: 'Ukraine' },
  { id: 'cze.1', name: 'Czech First League', country: 'Czechia' }, { id: 'svk.1', name: 'Slovak First League', country: 'Slovakia' },
  { id: 'gre.1', name: 'Super League Greece', country: 'Greece' }, { id: 'aut.1', name: 'Austrian Bundesliga', country: 'Austria' },
  { id: 'aze.1', name: 'Azerbaijan Premier League', country: 'Azerbaijan' },
]

const ALL_CLUBS = [
  // Premier League
  { short: 'BOU', name: "Bournemouth", league: 'eng.1', color: '#DA291C', color2: '#000000', espn: 349, att: 95, def: 92, ovr: 94 },
  { short: 'ARS', name: "Arsenal", league: 'eng.1', color: '#EF0107', color2: '#FFFFFF', espn: 359, att: 98, def: 100, ovr: 100 },
  { short: 'AVL', name: "Aston Villa", league: 'eng.1', color: '#670E36', color2: '#95BFE5', espn: 362, att: 93, def: 94, ovr: 93 },
  { short: 'BRE', name: "Brentford", league: 'eng.1', color: '#E30613', color2: '#FFFFFF', espn: 337, att: 93, def: 91, ovr: 92 },
  { short: 'BHA', name: "Brighton", league: 'eng.1', color: '#0057B8', color2: '#FFFFFF', espn: 331, att: 96, def: 95, ovr: 95 },
  { short: 'CHE', name: "Chelsea", league: 'eng.1', color: '#034694', color2: '#FFFFFF', espn: 363, att: 95, def: 92, ovr: 94 },
  { short: 'COV', name: "Coventry City", league: 'eng.1', color: '#6CACE4', color2: '#FFFFFF', espn: 388, att: 88, def: 89, ovr: 89 },
  { short: 'CRY', name: "Crystal Palace", league: 'eng.1', color: '#1B458F', color2: '#C4122E', espn: 384, att: 90, def: 88, ovr: 89 },
  { short: 'EVE', name: "Everton", league: 'eng.1', color: '#003399', color2: '#FFFFFF', espn: 368, att: 91, def: 93, ovr: 92 },
  { short: 'FUL', name: "Fulham", league: 'eng.1', color: '#FFFFFF', color2: '#000000', espn: 370, att: 90, def: 91, ovr: 90 },
  { short: 'HUL', name: "Hull City", league: 'eng.1', color: '#F5A12D', color2: '#000000', espn: 306, att: 87, def: 90, ovr: 89 },
  { short: 'IPS', name: "Ipswich Town", league: 'eng.1', color: '#0044A9', color2: '#FFFFFF', espn: 373, att: 91, def: 87, ovr: 89 },
  { short: 'LEE', name: "Leeds United", league: 'eng.1', color: '#FFFFFF', color2: '#1D428A', espn: 357, att: 91, def: 91, ovr: 91 },
  { short: 'LIV', name: "Liverpool", league: 'eng.1', color: '#C8102E', color2: '#FFFFFF', espn: 364, att: 95, def: 95, ovr: 95 },
  { short: 'MCI', name: "Manchester City", league: 'eng.1', color: '#6CABDD', color2: '#1C2C5B', espn: 382, att: 99, def: 96, ovr: 98 },
  { short: 'MUN', name: "Manchester United", league: 'eng.1', color: '#DA291C', color2: '#000000', espn: 360, att: 92, def: 90, ovr: 91 },
  { short: 'NEW', name: "Newcastle United", league: 'eng.1', color: '#241F20', color2: '#FFFFFF', espn: 361, att: 91, def: 91, ovr: 91 },
  { short: 'NFO', name: "Nottingham Forest", league: 'eng.1', color: '#DD0000', color2: '#FFFFFF', espn: 393, att: 89, def: 91, ovr: 90 },
  { short: 'SUN', name: "Sunderland", league: 'eng.1', color: '#EB172B', color2: '#FFFFFF', espn: 366, att: 88, def: 90, ovr: 89 },
  { short: 'TOT', name: "Tottenham Hotspur", league: 'eng.1', color: '#FFFFFF', color2: '#132257', espn: 367, att: 91, def: 94, ovr: 92 },
  // La Liga
  { short: 'ALA', name: "Alavés", league: 'esp.1', color: '#0761AF', color2: '#FFFFFF', espn: 96, att: 84, def: 86, ovr: 85 },
  { short: 'ATH', name: "Athletic Club", league: 'esp.1', color: '#EE2523', color2: '#FFFFFF', espn: 93, att: 85, def: 88, ovr: 86 },
  { short: 'ATM', name: "Atlético Madrid", league: 'esp.1', color: '#CB3524', color2: '#FFFFFF', espn: 1068, att: 92, def: 92, ovr: 92 },
  { short: 'BAR', name: "Barcelona", league: 'esp.1', color: '#A50044', color2: '#004D98', espn: 83, att: 100, def: 95, ovr: 97 },
  { short: 'CEL', name: "Celta Vigo", league: 'esp.1', color: '#8AC3EE', color2: '#FFFFFF', espn: 85, att: 84, def: 87, ovr: 86 },
  { short: 'DEP', name: "Deportivo La Coruña", league: 'esp.1', color: '#1B5EA7', color2: '#FFFFFF', espn: 90, att: 83, def: 85, ovr: 84 },
  { short: 'ELC', name: "Elche", league: 'esp.1', color: '#FFFFFF', color2: '#05642C', espn: 3751, att: 85, def: 84, ovr: 84 },
  { short: 'RCD', name: "Espanyol", league: 'esp.1', color: '#007FC8', color2: '#FFFFFF', espn: 88, att: 83, def: 84, ovr: 84 },
  { short: 'GET', name: "Getafe", league: 'esp.1', color: '#005999', color2: '#FFFFFF', espn: 2922, att: 80, def: 86, ovr: 83 },
  { short: 'LEV', name: "Levante", league: 'esp.1', color: '#B4053F', color2: '#014593', espn: 1538, att: 85, def: 83, ovr: 84 },
  { short: 'MAL', name: "Málaga", league: 'esp.1', color: '#0F72B5', color2: '#FFFFFF', espn: 99, att: 82, def: 82, ovr: 82 },
  { short: 'OSA', name: "Osasuna", league: 'esp.1', color: '#D91A21', color2: '#0A346F', espn: 97, att: 83, def: 84, ovr: 84 },
  { short: 'RAC', name: "Racing Santander", league: 'esp.1', color: '#FFFFFF', color2: '#00843D', espn: 87, att: 86, def: 80, ovr: 83 },
  { short: 'RAY', name: "Rayo Vallecano", league: 'esp.1', color: '#FFFFFF', color2: '#E53027', espn: 101, att: 86, def: 86, ovr: 86 },
  { short: 'BET', name: "Real Betis", league: 'esp.1', color: '#0BB363', color2: '#FFFFFF', espn: 244, att: 89, def: 89, ovr: 89 },
  { short: 'RMA', name: "Real Madrid", league: 'esp.1', color: '#FFFFFF', color2: '#FEBE10', espn: 86, att: 97, def: 95, ovr: 96 },
  { short: 'RSO', name: "Real Sociedad", league: 'esp.1', color: '#0067B1', color2: '#FFFFFF', espn: 89, att: 88, def: 86, ovr: 87 },
  { short: 'SEV', name: "Sevilla", league: 'esp.1', color: '#FFFFFF', color2: '#D71920', espn: 243, att: 84, def: 85, ovr: 85 },
  { short: 'VAL', name: "Valencia", league: 'esp.1', color: '#FFFFFF', color2: '#000000', espn: 94, att: 84, def: 86, ovr: 85 },
  { short: 'VIL', name: "Villarreal", league: 'esp.1', color: '#FFE114', color2: '#005187', espn: 102, att: 88, def: 88, ovr: 88 },
  // Serie A
  { short: 'MIL', name: "AC Milan", league: 'ita.1', color: '#FB090B', color2: '#000000', espn: 103, att: 89, def: 89, ovr: 89 },
  { short: 'ROM', name: "Roma", league: 'ita.1', color: '#8E1F2F', color2: '#F0BC42', espn: 104, att: 91, def: 91, ovr: 91 },
  { short: 'ATA', name: "Atalanta", league: 'ita.1', color: '#1E71B8', color2: '#000000', espn: 105, att: 86, def: 86, ovr: 86 },
  { short: 'BOL', name: "Bologna", league: 'ita.1', color: '#1A2F48', color2: '#A21C26', espn: 107, att: 86, def: 88, ovr: 87 },
  { short: 'CAG', name: "Cagliari", league: 'ita.1', color: '#B41F37', color2: '#002350', espn: 2925, att: 82, def: 84, ovr: 83 },
  { short: 'COM', name: "Como", league: 'ita.1', color: '#004494', color2: '#FFFFFF', espn: 2572, att: 92, def: 93, ovr: 93 },
  { short: 'FIO', name: "Fiorentina", league: 'ita.1', color: '#482E92', color2: '#FFFFFF', espn: 109, att: 85, def: 85, ovr: 85 },
  { short: 'FRO', name: "Frosinone", league: 'ita.1', color: '#FDE100', color2: '#00519E', espn: 4057, att: 87, def: 81, ovr: 84 },
  { short: 'GEN', name: "Genoa", league: 'ita.1', color: '#BE1E2D', color2: '#002D62', espn: 3263, att: 82, def: 85, ovr: 83 },
  { short: 'INT', name: "Inter", league: 'ita.1', color: '#010E80', color2: '#000000', espn: 110, att: 95, def: 92, ovr: 94 },
  { short: 'JUV', name: "Juventus", league: 'ita.1', color: '#000000', color2: '#FFFFFF', espn: 111, att: 88, def: 91, ovr: 89 },
  { short: 'LAZ', name: "Lazio", league: 'ita.1', color: '#87D8F7', color2: '#FFFFFF', espn: 112, att: 88, def: 90, ovr: 89 },
  { short: 'LEC', name: "Lecce", league: 'ita.1', color: '#FFD400', color2: '#D20F1E', espn: 113, att: 80, def: 82, ovr: 81 },
  { short: 'MNZ', name: "Monza", league: 'ita.1', color: '#E30613', color2: '#FFFFFF', espn: 4007, att: 83, def: 80, ovr: 81 },
  { short: 'NAP', name: "Napoli", league: 'ita.1', color: '#12A0D7', color2: '#FFFFFF', espn: 114, att: 88, def: 89, ovr: 88 },
  { short: 'PRM', name: "Parma", league: 'ita.1', color: '#FFFFFF', color2: '#FFD200', espn: 115, att: 80, def: 83, ovr: 81 },
  { short: 'SAS', name: "Sassuolo", league: 'ita.1', color: '#00A752', color2: '#000000', espn: 3997, att: 83, def: 82, ovr: 82 },
  { short: 'TOR', name: "Torino", league: 'ita.1', color: '#8A1E03', color2: '#FFFFFF', espn: 239, att: 84, def: 84, ovr: 84 },
  { short: 'UDI', name: "Udinese", league: 'ita.1', color: '#000000', color2: '#FFFFFF', espn: 118, att: 82, def: 82, ovr: 82 },
  { short: 'VEN', name: "Venezia", league: 'ita.1', color: '#000000', color2: '#F58025', espn: 17530, att: 81, def: 79, ovr: 80 },
  // Bundesliga
  { short: 'FCU', name: "Union Berlin", league: 'ger.1', color: '#EB1923', color2: '#FFFFFF', espn: 598, att: 83, def: 84, ovr: 83 },
  { short: 'B04', name: "Bayer Leverkusen", league: 'ger.1', color: '#E32221', color2: '#000000', espn: 131, att: 90, def: 90, ovr: 90 },
  { short: 'FCB', name: "Bayern Munich", league: 'ger.1', color: '#DC052D', color2: '#FFFFFF', espn: 132, att: 100, def: 98, ovr: 99 },
  { short: 'BVB', name: "Borussia Dortmund", league: 'ger.1', color: '#FDE100', color2: '#000000', espn: 124, att: 91, def: 94, ovr: 93 },
  { short: 'BMG', name: "Borussia M'gladbach", league: 'ger.1', color: '#FFFFFF', color2: '#00A651', espn: 268, att: 83, def: 83, ovr: 83 },
  { short: 'SGE', name: "Eintracht Frankfurt", league: 'ger.1', color: '#000000', color2: '#E1000F', espn: 125, att: 86, def: 85, ovr: 85 },
  { short: 'FCA', name: "FC Augsburg", league: 'ger.1', color: '#BA3733', color2: '#FFFFFF', espn: 3841, att: 86, def: 83, ovr: 85 },
  { short: 'KOE', name: "FC Köln", league: 'ger.1', color: '#FFFFFF', color2: '#ED1C24', espn: 122, att: 83, def: 83, ovr: 83 },
  { short: 'HSV', name: "Hamburger SV", league: 'ger.1', color: '#FFFFFF', color2: '#005CA9', espn: 127, att: 82, def: 83, ovr: 82 },
  { short: 'M05', name: "Mainz 05", league: 'ger.1', color: '#C3141E', color2: '#FFFFFF', espn: 2950, att: 86, def: 85, ovr: 85 },
  { short: 'RBL', name: "RB Leipzig", league: 'ger.1', color: '#FFFFFF', color2: '#DD0741', espn: 11420, att: 90, def: 89, ovr: 89 },
  { short: 'SCF', name: "SC Freiburg", league: 'ger.1', color: '#E2001A', color2: '#000000', espn: 126, att: 87, def: 89, ovr: 88 },
  { short: 'SCP', name: "SC Paderborn", league: 'ger.1', color: '#0A4A99', color2: '#000000', espn: 3307, att: 81, def: 84, ovr: 83 },
  { short: 'SVE', name: "SV Elversberg", league: 'ger.1', color: '#000000', color2: '#FFFFFF', espn: 10388, att: 85, def: 82, ovr: 84 },
  { short: 'S04', name: "Schalke 04", league: 'ger.1', color: '#004D9D', color2: '#FFFFFF', espn: 133, att: 81, def: 83, ovr: 82 },
  { short: 'TSG', name: "Hoffenheim", league: 'ger.1', color: '#1961B5', color2: '#FFFFFF', espn: 7911, att: 86, def: 87, ovr: 86 },
  { short: 'VFB', name: "VfB Stuttgart", league: 'ger.1', color: '#FFFFFF', color2: '#E32219', espn: 134, att: 90, def: 88, ovr: 89 },
  { short: 'SVW', name: "Werder Bremen", league: 'ger.1', color: '#1D9053', color2: '#FFFFFF', espn: 137, att: 85, def: 86, ovr: 85 },
  // Ligue 1
  { short: 'AUX', name: "Auxerre", league: 'fra.1', color: '#FFFFFF', color2: '#004B98', espn: 172, att: 81, def: 83, ovr: 82 },
  { short: 'MON', name: "Monaco", league: 'fra.1', color: '#E7212C', color2: '#FFFFFF', espn: 174, att: 88, def: 88, ovr: 88 },
  { short: 'ANG', name: "Angers", league: 'fra.1', color: '#000000', color2: '#FFFFFF', espn: 7868, att: 79, def: 81, ovr: 80 },
  { short: 'BST', name: "Brest", league: 'fra.1', color: '#E30613', color2: '#FFFFFF', espn: 6997, att: 84, def: 84, ovr: 84 },
  { short: 'HAC', name: "Le Havre", league: 'fra.1', color: '#80B4E3', color2: '#00205B', espn: 3236, att: 80, def: 81, ovr: 80 },
  { short: 'LMS', name: "Le Mans", league: 'fra.1', color: '#D2232A', color2: '#FFCC00', espn: 2697, att: 82, def: 79, ovr: 80 },
  { short: 'RCL', name: "Lens", league: 'fra.1', color: '#FFED00', color2: '#E2001A', espn: 175, att: 88, def: 86, ovr: 87 },
  { short: 'LIL', name: "Lille", league: 'fra.1', color: '#E01E13', color2: '#20325F', espn: 166, att: 86, def: 89, ovr: 87 },
  { short: 'LOR', name: "Lorient", league: 'fra.1', color: '#F58220', color2: '#000000', espn: 273, att: 82, def: 85, ovr: 83 },
  { short: 'LYO', name: "Lyon", league: 'fra.1', color: '#FFFFFF', color2: '#14387F', espn: 167, att: 87, def: 89, ovr: 88 },
  { short: 'OLM', name: "Marseille", league: 'fra.1', color: '#FFFFFF', color2: '#2FAEE0', espn: 176, att: 87, def: 84, ovr: 85 },
  { short: 'NIC', name: "Nice", league: 'fra.1', color: '#C4161C', color2: '#000000', espn: 2502, att: 83, def: 83, ovr: 83 },
  { short: 'PFC', name: "Paris FC", league: 'fra.1', color: '#1E3A6E', color2: '#6EC1E4', espn: 6851, att: 85, def: 86, ovr: 86 },
  { short: 'PSG', name: "Paris Saint-Germain", league: 'fra.1', color: '#004170', color2: '#DA291C', espn: 160, att: 98, def: 96, ovr: 97 },
  { short: 'REN', name: "Rennes", league: 'fra.1', color: '#E13327', color2: '#000000', espn: 169, att: 89, def: 84, ovr: 86 },
  { short: 'STR', name: "Strasbourg", league: 'fra.1', color: '#009FE3', color2: '#FFFFFF', espn: 180, att: 85, def: 84, ovr: 85 },
  { short: 'TOU', name: "Toulouse", league: 'fra.1', color: '#5B2B8C', color2: '#FFFFFF', espn: 179, att: 84, def: 86, ovr: 85 },
  { short: 'TRO', name: "Troyes", league: 'fra.1', color: '#1B3F8E', color2: '#FFFFFF', espn: 170, att: 80, def: 81, ovr: 80 },
  // Champions League clubs outside the five leagues (2026-27 league phase). ovr: Opta Power Rankings 2026-11-16, as
  // above; att / def split the same way from FotMob's 2026-27 and 2025-26 league xG for and against (70/30 with
  // goals; Shakhtar and Sabah, whose leagues FotMob gives no xG for, from goals only). Codes as the season
  // engine already used them for Europe's other sides (utils/soccerSimulation.js EURO_EXTRA): FCP, CLB, SPO...
  { short: 'FCP', name: "Porto", league: 'por.1', color: '#003C8F', color2: '#FFFFFF', espn: 437, att: 91, def: 91, ovr: 91 },
  { short: 'CLB', name: "Club Brugge", league: 'bel.1', color: '#0080C6', color2: '#000000', espn: 570, att: 94, def: 91, ovr: 92 },
  { short: 'SPO', name: "Sporting CP", league: 'por.1', color: '#00805A', color2: '#FFFFFF', espn: 2250, att: 93, def: 90, ovr: 92 },
  { short: 'PSV', name: "PSV Eindhoven", league: 'ned.1', color: '#ED1C24', color2: '#FFFFFF', espn: 148, att: 91, def: 88, ovr: 90 },
  { short: 'BOD', name: "Bodø/Glimt", league: 'nor.1', color: '#FFD700', color2: '#000000', espn: 2980, att: 91, def: 89, ovr: 90 },
  { short: 'GAL', name: "Galatasaray", league: 'tur.1', color: '#A90432', color2: '#FDB912', espn: 432, att: 89, def: 88, ovr: 89 },
  { short: 'FEN', name: "Fenerbahçe", league: 'tur.1', color: '#163962', color2: '#FFED00', espn: 436, att: 88, def: 88, ovr: 88 },
  { short: 'SHA', name: "Shakhtar Donetsk", league: 'ukr.1', color: '#F26522', color2: '#000000', espn: 493, att: 85, def: 83, ovr: 84 },
  { short: 'FEY', name: "Feyenoord", league: 'ned.1', color: '#E30613', color2: '#FFFFFF', espn: 142, att: 87, def: 87, ovr: 87 },
  { short: 'SLA', name: "Slavia Prague", league: 'cze.1', color: '#D7141A', color2: '#FFFFFF', espn: 494, att: 89, def: 88, ovr: 89 },
  { short: 'SBR', name: "Slovan Bratislava", league: 'svk.1', color: '#7FC1E8', color2: '#FFFFFF', espn: 521, att: 81, def: 81, ovr: 81 },
  { short: 'AEK', name: "AEK Athens", league: 'gre.1', color: '#FFD100', color2: '#000000', espn: 887, att: 87, def: 86, ovr: 87 },
  { short: 'LSK', name: "LASK", league: 'aut.1', color: '#000000', color2: '#FFFFFF', espn: 4411, att: 86, def: 83, ovr: 85 },
  { short: 'VIK', name: "Viking", league: 'nor.1', color: '#00205B', color2: '#FFFFFF', espn: 510, att: 88, def: 87, ovr: 88 },
  { short: 'SAB', name: "Sabah", league: 'aze.1', color: '#000000', color2: '#E4007C', espn: 21922, att: 84, def: 82, ovr: 83 },
]

// What Career deals from (the owner, 2026-11-11): the Premier League, La Liga and the Bundesliga. Serie A and Ligue 1
// stay in the lists above, switched off: add their ids here to bring them back (their players come back with them,
// data/soccer-strikers.js). Since 11-16 the wheel and the cards deal from UCL_CLUBS below instead.
export const SOCCER_LIVE_LEAGUES = ['eng.1', 'esp.1', 'ger.1']
// Spin weight (w): the wheel favours the Premier League and La Liga's good sides (87 and up: Barcelona, Real Madrid,
// Atletico, Betis, Villarreal, Real Sociedad). Three times a Bundesliga club's or a lesser La Liga club's chance:
// about 55% Premier League, 16% La Liga's best, 13% the rest of La Liga, 16% Bundesliga (lib/rng.js seededTeamOrder).
export const SOCCER_GOOD_LIGA = 87
const spinWeight = c => (c.league === 'eng.1' || (c.league === 'esp.1' && c.ovr >= SOCCER_GOOD_LIGA) ? 3 : 1)
export const SOCCER_LEAGUES = ALL_LEAGUES.filter(l => SOCCER_LIVE_LEAGUES.includes(l.id))
export const SOCCER_CLUBS = ALL_CLUBS.filter(c => SOCCER_LIVE_LEAGUES.includes(c.league)).map(c => ({ ...c, w: spinWeight(c) }))

// The season engine plays every league season in the five leagues (so a Champions League club from Serie A or Ligue 1
// plays its real league), whatever Career deals from.
export const SOCCER_SIM_LEAGUES = ALL_LEAGUES
export const SOCCER_SIM_CLUBS = ALL_CLUBS.filter(c => ALL_LEAGUES.some(l => l.id === c.league))
// every club in the data, for lookups (logos, names, colours) by code
export const SOCCER_ALL_CLUBS = ALL_CLUBS

// ── Career (2026-11-24): all five leagues, and what each club earns ─────────────────────────────────────────────
// Career signs for and plays in every one of the five leagues (SOCCER_CLUBS above stays Squad Builder's and the
// practice lab's three). Its clubs are SOCCER_CAREER_CLUBS: the 96, each with `rev`.
// rev: the club's revenue, € millions a year: the wage and fee tier Career's transfer market runs on
//   (lib/careerSoccer.js clubPurse: a club's top wage and its record fee come from it, not from how good its team is
//   this season: before this Brighton paid £400k a week and Elversberg £108k, by Opta rating).
//   The top 21: Deloitte Football Money League 2025 (2023-24 revenue: Real Madrid 1,046, Manchester City 838,
//   Paris Saint-Germain 806, Manchester United 771, Bayern Munich 765, Barcelona 760, Arsenal 717, Liverpool 715,
//   Tottenham 615, Chelsea 546, Borussia Dortmund 514, Atlético Madrid 410, AC Milan 398, Inter 391, Newcastle 372,
//   Juventus 356, Aston Villa 310, Marseille 287, Lyon 264, Brighton 257). The rest: club accounts where published,
//   else an estimate by league and size (a Premier League club's TV money alone is about €130M; a promoted
//   Bundesliga or Ligue 1 club runs on €25-50M). A tier, not an audit.
const CLUB_REV = {
  // Premier League
  MCI: 838, MUN: 771, ARS: 717, LIV: 715, TOT: 615, CHE: 546, NEW: 372, AVL: 310, BHA: 257, EVE: 220, CRY: 220, NFO: 220,
  FUL: 210, BRE: 195, LEE: 190, BOU: 185, SUN: 165, IPS: 160, COV: 150, HUL: 150,
  // La Liga
  RMA: 1046, BAR: 760, ATM: 410, SEV: 180, ATH: 170, BET: 165, RSO: 150, VIL: 150, VAL: 140, CEL: 90, RCD: 80, OSA: 80,
  GET: 70, RAY: 60, ALA: 60, LEV: 55, ELC: 50, DEP: 45, MAL: 45, RAC: 40,
  // Serie A
  MIL: 398, INT: 391, JUV: 356, NAP: 255, ROM: 250, ATA: 200, LAZ: 150, FIO: 140, BOL: 120, COM: 100, TOR: 90, GEN: 80,
  UDI: 75, SAS: 70, CAG: 65, PRM: 65, LEC: 60, MNZ: 55, VEN: 50, FRO: 45,
  // Bundesliga
  FCB: 765, BVB: 514, RBL: 395, B04: 360, SGE: 310, VFB: 290, BMG: 220, SCF: 200, TSG: 180, FCU: 170, SVW: 170, S04: 170,
  KOE: 160, HSV: 140, M05: 130, FCA: 110, SCP: 45, SVE: 30,
  // Ligue 1
  PSG: 806, OLM: 287, LYO: 264, MON: 200, LIL: 150, REN: 130, NIC: 130, RCL: 120, STR: 90, PFC: 80, BST: 70, TOU: 60,
  LOR: 50, AUX: 45, ANG: 35, HAC: 35, TRO: 30, LMS: 20,
}
export const SOCCER_CAREER_LEAGUES = ALL_LEAGUES
export const SOCCER_CAREER_CLUBS = SOCCER_SIM_CLUBS.map(c => ({ ...c, w: spinWeight(c), rev: CLUB_REV[c.short] ?? 60 }))

// ── The Champions League: the wheel and the cards (the owner, 2026-11-16) ──────────────────────────────────────
// The 36 clubs of the 2026-27 league phase, as UEFA lists them (uefa.com; SI's ranking of the 36 and ESPN's
// uefa.champions team list name the same 36). Order: SI's ranking, best first.
export const UCL_SHORTS = ['PSG', 'ARS', 'FCB', 'BAR', 'MCI', 'RMA', 'INT', 'ATM', 'MUN', 'LIV', 'NAP', 'BVB', 'AVL', 'ROM', 'FCP', 'CLB', 'SPO', 'PSV',
  'LIL', 'RBL', 'VIL', 'BOD', 'GAL', 'COM', 'BET', 'RCL', 'FEN', 'SHA', 'VFB', 'FEY', 'SLA', 'SBR', 'AEK', 'LSK', 'VIK', 'SAB']
// Spin weight: the giants a kid knows come up most. The 12 biggest names 7, the well-known sides 2.5, the rest 1, and
// the four smallest (Slovan, LASK, Viking, Sabah) 0.5. A club's chance is its weight over the total (124; lib/rng.js
// seededTeamOrder): 68% of spins land on the top 12 (1 in 18 on each), 24% on the next 12, 1 in 250 on Sabah.
export const UCL_GIANTS = ['RMA', 'BAR', 'MCI', 'LIV', 'ARS', 'FCB', 'PSG', 'MUN', 'INT', 'ATM', 'BVB', 'NAP']
const UCL_KNOWN = ['AVL', 'ROM', 'FCP', 'SPO', 'PSV', 'RBL', 'GAL', 'FEN', 'BET', 'VIL', 'LIL', 'COM']
const UCL_SMALL = ['SBR', 'LSK', 'VIK', 'SAB']
const uclWeight = s => (UCL_GIANTS.includes(s) ? 7 : UCL_KNOWN.includes(s) ? 2.5 : UCL_SMALL.includes(s) ? 0.5 : 1)
const CLUB_OF = new Map(ALL_CLUBS.map(c => [c.short, c]))
export const UCL_CLUBS = UCL_SHORTS.map(s => ({ ...CLUB_OF.get(s), w: uclWeight(s), ucl: true }))
