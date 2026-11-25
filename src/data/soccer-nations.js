// World Cup nations (2026-11-16):
//   WC_NATIONS      WORLD CUP mode (pool 'alltime'): the 48 greatest World Cup nations across history, their legends
//                   and their all-time tournament strength (data/soccer-legends.js, its header has the method).
//   WC2026_NATIONS  the real 2026 World Cup (below): Career's national teams and its World Cups every four years.
//   WC_ALL_NATIONS  both, for looking up a code (an old save or result from the 2026 pool still finds its name and colours).
import { WC_LEGEND_NATIONS } from './soccer-legends.js'

// WC2026_NATIONS: the 48 nations of the 2026 FIFA World Cup (USA, Canada, Mexico, June 11 - July 19, 2026; Spain won the
// final 1-0 after extra time against Argentina).
// Nations, groups and ESPN team ids (espn): ESPN soccer API, fifa.world 2026 (teams + standings).
// short: FIFA code. color / color2: home kit colour and second colour.
// Strength (0-100):
//   ovr = World Football Elo rating (eloratings.net, as of 2026-11-07) on the same feel as the club scale:
//         ovr = 100 - (Spain's Elo - Elo) x 0.04, so Elo No. 1 Spain = 100 and the 48th side here is about 67.
//   att / def = ovr split by how each side played at the 2026 World Cup: FotMob tournament xG for and against per
//         match, as z-scores across the 48 (pulled toward average for sides with 3 games), att = ovr + 3 x (zAttack -
//         zDefence) / 2, def = ovr - the same.

export const WC2026_NATIONS = [
  { short: 'MEX', name: "Mexico", color: '#006847', color2: '#FFFFFF', espn: 203, att: 82, def: 84, ovr: 83, group: 'A' },
  { short: 'KOR', name: "South Korea", color: '#CD2E3A', color2: '#000000', espn: 451, att: 78, def: 78, ovr: 78, group: 'A' },
  { short: 'CZE', name: "Czechia", color: '#D7141A', color2: '#11457E', espn: 450, att: 75, def: 75, ovr: 75, group: 'A' },
  { short: 'RSA', name: "South Africa", color: '#FFB81C', color2: '#007749', espn: 467, att: 71, def: 73, ovr: 72, group: 'A' },
  { short: 'SUI', name: "Switzerland", color: '#DA291C', color2: '#FFFFFF', espn: 475, att: 88, def: 88, ovr: 88, group: 'B' },
  { short: 'CAN', name: "Canada", color: '#D80621', color2: '#FFFFFF', espn: 206, att: 78, def: 78, ovr: 78, group: 'B' },
  { short: 'BIH', name: "Bosnia and Herzegovina", color: '#002395', color2: '#FECB00', espn: 452, att: 74, def: 76, ovr: 75, group: 'B' },
  { short: 'QAT', name: "Qatar", color: '#8A1538', color2: '#FFFFFF', espn: 4398, att: 68, def: 66, ovr: 67, group: 'B' },
  { short: 'BRA', name: "Brazil", color: '#FEDD00', color2: '#009C3B', espn: 205, att: 90, def: 88, ovr: 89, group: 'C' },
  { short: 'MAR', name: "Morocco", color: '#C1272D', color2: '#006233', espn: 2869, att: 84, def: 84, ovr: 84, group: 'C' },
  { short: 'SCO', name: "Scotland", color: '#1A2D69', color2: '#FFFFFF', espn: 580, att: 77, def: 77, ovr: 77, group: 'C' },
  { short: 'HAI', name: "Haiti", color: '#00209F', color2: '#D21034', espn: 2654, att: 71, def: 71, ovr: 71, group: 'C' },
  { short: 'PAR', name: "Paraguay", color: '#D52B1E', color2: '#FFFFFF', espn: 210, att: 81, def: 83, ovr: 82, group: 'D' },
  { short: 'USA', name: "United States", color: '#0A3161', color2: '#B31942', espn: 660, att: 80, def: 80, ovr: 80, group: 'D' },
  { short: 'AUS', name: "Australia", color: '#FFCD00', color2: '#00843D', espn: 628, att: 79, def: 81, ovr: 80, group: 'D' },
  { short: 'TUR', name: "Türkiye", color: '#E30A17', color2: '#FFFFFF', espn: 465, att: 80, def: 78, ovr: 79, group: 'D' },
  { short: 'GER', name: "Germany", color: '#FFFFFF', color2: '#000000', espn: 481, att: 84, def: 84, ovr: 84, group: 'E' },
  { short: 'ECU', name: "Ecuador", color: '#FFDD00', color2: '#034EA2', espn: 209, att: 82, def: 82, ovr: 82, group: 'E' },
  { short: 'CIV', name: "Ivory Coast", color: '#FF8200', color2: '#009E60', espn: 4789, att: 77, def: 77, ovr: 77, group: 'E' },
  { short: 'CUW', name: "Curaçao", color: '#002B7F', color2: '#F9E814', espn: 11678, att: 69, def: 67, ovr: 68, group: 'E' },
  { short: 'NED', name: "Netherlands", color: '#FF6200', color2: '#1E2846', espn: 449, att: 87, def: 87, ovr: 87, group: 'F' },
  { short: 'JPN', name: "Japan", color: '#0B1F5C', color2: '#FFFFFF', espn: 627, att: 83, def: 85, ovr: 84, group: 'F' },
  { short: 'SWE', name: "Sweden", color: '#FECC02', color2: '#006AA7', espn: 466, att: 79, def: 79, ovr: 79, group: 'F' },
  { short: 'TUN', name: "Tunisia", color: '#E70013', color2: '#FFFFFF', espn: 659, att: 69, def: 71, ovr: 70, group: 'F' },
  { short: 'BEL', name: "Belgium", color: '#C8102E', color2: '#FDDA24', espn: 459, att: 88, def: 86, ovr: 87, group: 'G' },
  { short: 'IRN', name: "Iran", color: '#FFFFFF', color2: '#DA0000', espn: 469, att: 78, def: 78, ovr: 78, group: 'G' },
  { short: 'EGY', name: "Egypt", color: '#CE1126', color2: '#FFFFFF', espn: 2620, att: 77, def: 77, ovr: 77, group: 'G' },
  { short: 'NZL', name: "New Zealand", color: '#FFFFFF', color2: '#000000', espn: 2666, att: 72, def: 70, ovr: 71, group: 'G' },
  { short: 'ESP', name: "Spain", color: '#C60B1E', color2: '#FFC400', espn: 164, att: 99, def: 100, ovr: 100, group: 'H' },
  { short: 'URU', name: "Uruguay", color: '#55B5E5', color2: '#FFFFFF', espn: 212, att: 83, def: 83, ovr: 83, group: 'H' },
  { short: 'KSA', name: "Saudi Arabia", color: '#006C35', color2: '#FFFFFF', espn: 655, att: 74, def: 74, ovr: 74, group: 'H' },
  { short: 'CPV', name: "Cape Verde", color: '#003893', color2: '#CF2027', espn: 2597, att: 71, def: 71, ovr: 71, group: 'H' },
  { short: 'FRA', name: "France", color: '#002654', color2: '#ED2939', espn: 478, att: 94, def: 92, ovr: 93, group: 'I' },
  { short: 'NOR', name: "Norway", color: '#C8102E', color2: '#00205B', espn: 464, att: 86, def: 84, ovr: 85, group: 'I' },
  { short: 'SEN', name: "Senegal", color: '#FFFFFF', color2: '#00853F', espn: 654, att: 82, def: 80, ovr: 81, group: 'I' },
  { short: 'IRQ', name: "Iraq", color: '#007A3D', color2: '#FFFFFF', espn: 4375, att: 71, def: 69, ovr: 70, group: 'I' },
  { short: 'ARG', name: "Argentina", color: '#75AADB', color2: '#FFFFFF', espn: 202, att: 96, def: 96, ovr: 96, group: 'J' },
  { short: 'AUT', name: "Austria", color: '#ED2939', color2: '#FFFFFF', espn: 474, att: 82, def: 82, ovr: 82, group: 'J' },
  { short: 'ALG', name: "Algeria", color: '#007A3D', color2: '#FFFFFF', espn: 624, att: 78, def: 78, ovr: 78, group: 'J' },
  { short: 'JOR', name: "Jordan", color: '#CE1126', color2: '#FFFFFF', espn: 2917, att: 73, def: 73, ovr: 73, group: 'J' },
  { short: 'POR', name: "Portugal", color: '#DA291C', color2: '#046A38', espn: 482, att: 91, def: 91, ovr: 91, group: 'K' },
  { short: 'COL', name: "Colombia", color: '#FCD116', color2: '#003893', espn: 208, att: 87, def: 89, ovr: 88, group: 'K' },
  { short: 'COD', name: "DR Congo", color: '#007FFF', color2: '#CE1021', espn: 2850, att: 75, def: 77, ovr: 76, group: 'K' },
  { short: 'UZB', name: "Uzbekistan", color: '#0072CE', color2: '#FFFFFF', espn: 2570, att: 74, def: 74, ovr: 74, group: 'K' },
  { short: 'ENG', name: "England", color: '#FFFFFF', color2: '#CE1124', espn: 448, att: 95, def: 93, ovr: 94, group: 'L' },
  { short: 'CRO', name: "Croatia", color: '#FF0000', color2: '#FFFFFF', espn: 477, att: 83, def: 83, ovr: 83, group: 'L' },
  { short: 'PAN', name: "Panama", color: '#D21034', color2: '#005293', espn: 2659, att: 75, def: 75, ovr: 75, group: 'L' },
  { short: 'GHA', name: "Ghana", color: '#FFFFFF', color2: '#000000', espn: 4469, att: 68, def: 70, ovr: 69, group: 'L' },
]

// ── Career's wider world (2026-11-24) ────────────────────────────────────────────────────────────────────────
// Career plays the continental tournaments between World Cups and a World Cup's qualifying, so it needs the nations
// the 2026 World Cup left at home (Italy, Denmark, Poland, Nigeria, Wales, Ireland, Serbia...) and each
// confederation's field. CAREER_EXTRA_NATIONS: 68 more, none of them in WC2026_NATIONS.
// ovr: World Football Elo (eloratings.net World.tsv, read 2026-11-24, Spain 2258) on the scale above, a point and a
//   half lower so today's read sits where the 48 (read 11-07) do: ovr = 100 - (2258 - Elo) x 0.04 - 1.5.
//   att = def = ovr (no World Cup to split them by).
// pick: a country a Career can be started with (its squad is its players in the club data, data/soccer-strikers.js;
//   lib/soccerIntl.js fills the rest). The others were opponents only until 2026-11-25; now every nation is
//   (CAREER_NATIONS below).
// Flags: ESPN (a.espncdn.com/i/teamlogos/countries/500), public/logos/nations, as the 48's.
export const CAREER_EXTRA_NATIONS = [
  { short: 'ITA', name: "Italy", color: '#0066B2', color2: '#FFFFFF', att: 85, def: 85, ovr: 85, conf: 'UEFA', pick: true },
  { short: 'DEN', name: "Denmark", color: '#C60C30', color2: '#FFFFFF', att: 84, def: 84, ovr: 84, conf: 'UEFA', pick: true },
  { short: 'GRE', name: "Greece", color: '#0D5EAF', color2: '#FFFFFF', att: 80, def: 80, ovr: 80, conf: 'UEFA', pick: true },
  { short: 'SVN', name: "Slovenia", color: '#FFFFFF', color2: '#0057B8', att: 78, def: 78, ovr: 78, conf: 'UEFA', pick: true },
  { short: 'HUN', name: "Hungary", color: '#CE2939', color2: '#FFFFFF', att: 78, def: 78, ovr: 78, conf: 'UEFA', pick: true },
  { short: 'IRL', name: "Republic of Ireland", color: '#169B62', color2: '#FFFFFF', att: 77, def: 77, ovr: 77, conf: 'UEFA', pick: true },
  { short: 'UKR', name: "Ukraine", color: '#FFD700', color2: '#0057B7', att: 77, def: 77, ovr: 77, conf: 'UEFA', pick: true },
  { short: 'NIR', name: "Northern Ireland", color: '#00A651', color2: '#FFFFFF', att: 76, def: 76, ovr: 76, conf: 'UEFA', pick: true },
  { short: 'KOS', name: "Kosovo", color: '#244AA5', color2: '#D0A650', att: 75, def: 75, ovr: 75, conf: 'UEFA' },
  { short: 'POL', name: "Poland", color: '#FFFFFF', color2: '#DC143C', att: 75, def: 75, ovr: 75, conf: 'UEFA', pick: true },
  { short: 'WAL', name: "Wales", color: '#C8102E', color2: '#FFFFFF', att: 75, def: 75, ovr: 75, conf: 'UEFA', pick: true },
  { short: 'SRB', name: "Serbia", color: '#C6363C', color2: '#FFFFFF', att: 74, def: 74, ovr: 74, conf: 'UEFA', pick: true },
  { short: 'SVK', name: "Slovakia", color: '#0B4EA2', color2: '#FFFFFF', att: 74, def: 74, ovr: 74, conf: 'UEFA', pick: true },
  { short: 'ALB', name: "Albania", color: '#E41E20', color2: '#000000', att: 74, def: 74, ovr: 74, conf: 'UEFA' },
  { short: 'ISR', name: "Israel", color: '#0038B8', color2: '#FFFFFF', att: 74, def: 74, ovr: 74, conf: 'UEFA' },
  { short: 'ISL', name: "Iceland", color: '#02529C', color2: '#FFFFFF', att: 74, def: 74, ovr: 74, conf: 'UEFA', pick: true },
  { short: 'GEO', name: "Georgia", color: '#FFFFFF', color2: '#DA291C', att: 72, def: 72, ovr: 72, conf: 'UEFA' },
  { short: 'ROU', name: "Romania", color: '#FCD116', color2: '#002B7F', att: 71, def: 71, ovr: 71, conf: 'UEFA', pick: true },
  { short: 'MNE', name: "Montenegro", color: '#C40308', color2: '#D3AE3B', att: 69, def: 69, ovr: 69, conf: 'UEFA' },
  { short: 'FIN', name: "Finland", color: '#FFFFFF', color2: '#003580', att: 69, def: 69, ovr: 69, conf: 'UEFA' },
  { short: 'MKD', name: "North Macedonia", color: '#D20000', color2: '#FFE600', att: 68, def: 68, ovr: 68, conf: 'UEFA' },
  { short: 'BUL', name: "Bulgaria", color: '#FFFFFF', color2: '#00966E', att: 64, def: 64, ovr: 64, conf: 'UEFA' },
  { short: 'CHI', name: "Chile", color: '#D52B1E', color2: '#0039A6', att: 77, def: 77, ovr: 77, conf: 'CONMEBOL', pick: true },
  { short: 'VEN', name: "Venezuela", color: '#7B1E3A', color2: '#FFFFFF', att: 77, def: 77, ovr: 77, conf: 'CONMEBOL', pick: true },
  { short: 'PER', name: "Peru", color: '#FFFFFF', color2: '#D91023', att: 76, def: 76, ovr: 76, conf: 'CONMEBOL', pick: true },
  { short: 'BOL', name: "Bolivia", color: '#007934', color2: '#FFFFFF', att: 72, def: 72, ovr: 72, conf: 'CONMEBOL' },
  { short: 'NGA', name: "Nigeria", color: '#008751', color2: '#FFFFFF', att: 76, def: 76, ovr: 76, conf: 'CAF', pick: true },
  { short: 'MLI', name: "Mali", color: '#FCD116', color2: '#14B53A', att: 74, def: 74, ovr: 74, conf: 'CAF', pick: true },
  { short: 'CMR', name: "Cameroon", color: '#007A5E', color2: '#CE1126', att: 74, def: 74, ovr: 74, conf: 'CAF', pick: true },
  { short: 'ANG', name: "Angola", color: '#CC092F', color2: '#000000', att: 71, def: 71, ovr: 71, conf: 'CAF' },
  { short: 'BFA', name: "Burkina Faso", color: '#009E49', color2: '#EF2B2D', att: 70, def: 70, ovr: 70, conf: 'CAF' },
  { short: 'GUI', name: "Guinea", color: '#CE1126', color2: '#FCD116', att: 67, def: 67, ovr: 67, conf: 'CAF' },
  { short: 'GAM', name: "Gambia", color: '#CE1126', color2: '#FFFFFF', att: 67, def: 67, ovr: 67, conf: 'CAF' },
  { short: 'BEN', name: "Benin", color: '#FCD116', color2: '#008751', att: 66, def: 66, ovr: 66, conf: 'CAF' },
  { short: 'UGA', name: "Uganda", color: '#FCDC04', color2: '#000000', att: 66, def: 66, ovr: 66, conf: 'CAF' },
  { short: 'TOG', name: "Togo", color: '#FFCE00', color2: '#006A4E', att: 65, def: 65, ovr: 65, conf: 'CAF' },
  { short: 'ZIM', name: "Zimbabwe", color: '#FFD200', color2: '#006400', att: 64, def: 64, ovr: 64, conf: 'CAF' },
  { short: 'GAB', name: "Gabon", color: '#FCD116', color2: '#3A75C4', att: 64, def: 64, ovr: 64, conf: 'CAF' },
  { short: 'ZAM', name: "Zambia", color: '#198A00', color2: '#EF7D00', att: 63, def: 63, ovr: 63, conf: 'CAF' },
  { short: 'COM', name: "Comoros", color: '#3A9D23', color2: '#FFFFFF', att: 63, def: 63, ovr: 63, conf: 'CAF' },
  { short: 'MOZ', name: "Mozambique", color: '#D21034', color2: '#000000', att: 63, def: 63, ovr: 63, conf: 'CAF' },
  { short: 'EQG', name: "Equatorial Guinea", color: '#E32118', color2: '#FFFFFF', att: 63, def: 63, ovr: 63, conf: 'CAF' },
  { short: 'UAE', name: "United Arab Emirates", color: '#FFFFFF', color2: '#00732F', att: 71, def: 71, ovr: 71, conf: 'AFC' },
  { short: 'OMA', name: "Oman", color: '#DB161B', color2: '#FFFFFF', att: 66, def: 66, ovr: 66, conf: 'AFC' },
  { short: 'SYR', name: "Syria", color: '#CE1126', color2: '#FFFFFF', att: 66, def: 66, ovr: 66, conf: 'AFC' },
  { short: 'PLE', name: "Palestine", color: '#CE1126', color2: '#FFFFFF', att: 68, def: 68, ovr: 68, conf: 'AFC' },
  { short: 'THA', name: "Thailand", color: '#0B1F8F', color2: '#FFFFFF', att: 64, def: 64, ovr: 64, conf: 'AFC' },
  { short: 'VIE', name: "Vietnam", color: '#DA251D', color2: '#FFFF00', att: 63, def: 63, ovr: 63, conf: 'AFC' },
  { short: 'PRK', name: "North Korea", color: '#ED1C27', color2: '#FFFFFF', att: 63, def: 63, ovr: 63, conf: 'AFC' },
  { short: 'CHN', name: "China", color: '#DE2910', color2: '#FFDE00', att: 62, def: 62, ovr: 62, conf: 'AFC' },
  { short: 'BHR', name: "Bahrain", color: '#CE1126', color2: '#FFFFFF', att: 62, def: 62, ovr: 62, conf: 'AFC' },
  { short: 'KGZ', name: "Kyrgyzstan", color: '#E8112D', color2: '#FFEF00', att: 62, def: 62, ovr: 62, conf: 'AFC' },
  { short: 'IDN', name: "Indonesia", color: '#CE1126', color2: '#FFFFFF', att: 61, def: 61, ovr: 61, conf: 'AFC' },
  { short: 'MAS', name: "Malaysia", color: '#FFCC00', color2: '#000000', att: 61, def: 61, ovr: 61, conf: 'AFC' },
  { short: 'KUW', name: "Kuwait", color: '#0061A8', color2: '#FFFFFF', att: 60, def: 60, ovr: 60, conf: 'AFC' },
  { short: 'LBN', name: "Lebanon", color: '#ED1C24', color2: '#FFFFFF', att: 60, def: 60, ovr: 60, conf: 'AFC' },
  { short: 'TJK', name: "Tajikistan", color: '#CC0000', color2: '#FFFFFF', att: 60, def: 60, ovr: 60, conf: 'AFC' },
  { short: 'IND', name: "India", color: '#1C8AD6', color2: '#FF9933', att: 54, def: 54, ovr: 54, conf: 'AFC' },
  { short: 'CRC', name: "Costa Rica", color: '#CE1126', color2: '#002B7F', att: 72, def: 72, ovr: 72, conf: 'CONCACAF', pick: true },
  { short: 'JAM', name: "Jamaica", color: '#FED100', color2: '#009B3A', att: 71, def: 71, ovr: 71, conf: 'CONCACAF', pick: true },
  { short: 'HON', name: "Honduras", color: '#FFFFFF', color2: '#0073CF', att: 69, def: 69, ovr: 69, conf: 'CONCACAF' },
  { short: 'GUA', name: "Guatemala", color: '#FFFFFF', color2: '#4997D0', att: 68, def: 68, ovr: 68, conf: 'CONCACAF' },
  { short: 'SUR', name: "Suriname", color: '#FFFFFF', color2: '#377E3F', att: 67, def: 67, ovr: 67, conf: 'CONCACAF' },
  { short: 'SLV', name: "El Salvador", color: '#0F47AF', color2: '#FFFFFF', att: 62, def: 62, ovr: 62, conf: 'CONCACAF' },
  { short: 'TRI', name: "Trinidad and Tobago", color: '#DA1A35', color2: '#000000', att: 61, def: 61, ovr: 61, conf: 'CONCACAF' },
  { short: 'GUY', name: "Guyana", color: '#FCD116', color2: '#009E49', att: 62, def: 62, ovr: 62, conf: 'CONCACAF' },
  { short: 'DOM', name: "Dominican Republic", color: '#002D62', color2: '#CE1126', att: 61, def: 61, ovr: 61, conf: 'CONCACAF' },
  { short: 'NCA', name: "Nicaragua", color: '#0067C6', color2: '#FFFFFF', att: 59, def: 59, ovr: 59, conf: 'CONCACAF' },
]
// ── The rest of FIFA (2026-11-25) ──────────────────────────────────────────────────────────────────────────────
// FIFA has 211 members; the 48 and the 68 above are 116 of them. FIFA_REST_NATIONS: the other 95, so every FIFA
// nation (England, Scotland, Wales and Northern Ireland each their own) can be a Career player's country.
// UEFA 55, CONMEBOL 10, CAF 54, AFC 46 (the Northern Mariana Islands are AFC but not FIFA), CONCACAF 35 (FIFA's
// members only: no Guadeloupe, Martinique, French Guiana, Sint Maarten, Saint Martin, Bonaire), OFC 11.
// ovr: World Football Elo on the extras' line (eloratings.net World.tsv, read 2026-11-25, Spain still 2258):
//   ovr = 100 - (2258 - Elo) x 0.04 - 1.5, so Russia 80, Estonia 66, Luxembourg 62, Kenya 62, Fiji 54, Andorra 51,
//   San Marino 41, Anguilla 33, Tonga 29, American Samoa 23 (lib/soccerIntl.js's level floor is 40 in a match).
//   att = def = ovr. color / color2: the home kit's colours.
// suspended: banned from FIFA and UEFA competitions (Russia, since 2022): never in a qualifying draw or a finals,
//   still called up for the friendlies.
// Flags: flagcdn.com (Flagpedia), public/logos/nations/README.md.
export const FIFA_REST_NATIONS = [
  { short: 'RUS', name: "Russia", color: '#C8102E', color2: '#FFFFFF', att: 80, def: 80, ovr: 80, conf: 'UEFA', suspended: true },
  { short: 'BLR', name: "Belarus", color: '#D22730', color2: '#FFFFFF', att: 69, def: 69, ovr: 69, conf: 'UEFA' },
  { short: 'EST', name: "Estonia", color: '#0072CE', color2: '#000000', att: 66, def: 66, ovr: 66, conf: 'UEFA' },
  { short: 'FRO', name: "Faroe Islands", color: '#FFFFFF', color2: '#005EB8', att: 65, def: 65, ovr: 65, conf: 'UEFA' },
  { short: 'KAZ', name: "Kazakhstan", color: '#FFEC2D', color2: '#00AFCA', att: 63, def: 63, ovr: 63, conf: 'UEFA' },
  { short: 'LUX', name: "Luxembourg", color: '#EF3340', color2: '#FFFFFF', att: 62, def: 62, ovr: 62, conf: 'UEFA' },
  { short: 'ARM', name: "Armenia", color: '#D90012', color2: '#0033A0', att: 62, def: 62, ovr: 62, conf: 'UEFA' },
  { short: 'AZE', name: "Azerbaijan", color: '#0092BC', color2: '#FFFFFF', att: 62, def: 62, ovr: 62, conf: 'UEFA' },
  { short: 'CYP', name: "Cyprus", color: '#0047AB', color2: '#FFFFFF', att: 61, def: 61, ovr: 61, conf: 'UEFA' },
  { short: 'MDA', name: "Moldova", color: '#0046AE', color2: '#FFD200', att: 60, def: 60, ovr: 60, conf: 'UEFA' },
  { short: 'LTU', name: "Lithuania", color: '#FDB913', color2: '#006A44', att: 59, def: 59, ovr: 59, conf: 'UEFA' },
  { short: 'MLT', name: "Malta", color: '#CF142B', color2: '#FFFFFF', att: 58, def: 58, ovr: 58, conf: 'UEFA' },
  { short: 'LVA', name: "Latvia", color: '#9E3039', color2: '#FFFFFF', att: 58, def: 58, ovr: 58, conf: 'UEFA' },
  { short: 'AND', name: "Andorra", color: '#0032A0', color2: '#FEDD00', att: 51, def: 51, ovr: 51, conf: 'UEFA' },
  { short: 'GIB', name: "Gibraltar", color: '#DA000C', color2: '#FFFFFF', att: 49, def: 49, ovr: 49, conf: 'UEFA' },
  { short: 'LIE', name: "Liechtenstein", color: '#002B7F', color2: '#CE1126', att: 43, def: 43, ovr: 43, conf: 'UEFA' },
  { short: 'SMR', name: "San Marino", color: '#5EB6E4', color2: '#FFFFFF', att: 41, def: 41, ovr: 41, conf: 'UEFA' },
  { short: 'LBY', name: "Libya", color: '#E70013', color2: '#000000', att: 66, def: 66, ovr: 66, conf: 'CAF' },
  { short: 'GNB', name: "Guinea-Bissau", color: '#CE1126', color2: '#009E49', att: 63, def: 63, ovr: 63, conf: 'CAF' },
  { short: 'NIG', name: "Niger", color: '#E05206', color2: '#0DB02B', att: 63, def: 63, ovr: 63, conf: 'CAF' },
  { short: 'RWA', name: "Rwanda", color: '#FAD201', color2: '#20603D', att: 63, def: 63, ovr: 63, conf: 'CAF' },
  { short: 'MAD', name: "Madagascar", color: '#FC3D32', color2: '#007E3A', att: 62, def: 62, ovr: 62, conf: 'CAF' },
  { short: 'KEN', name: "Kenya", color: '#BB0000', color2: '#006600', att: 62, def: 62, ovr: 62, conf: 'CAF' },
  { short: 'SDN', name: "Sudan", color: '#D21034', color2: '#FFFFFF', att: 62, def: 62, ovr: 62, conf: 'CAF' },
  { short: 'SLE', name: "Sierra Leone", color: '#1EB53A', color2: '#0072C6', att: 61, def: 61, ovr: 61, conf: 'CAF' },
  { short: 'LBR', name: "Liberia", color: '#BF0A30', color2: '#002868', att: 61, def: 61, ovr: 61, conf: 'CAF' },
  { short: 'BOT', name: "Botswana", color: '#75AADB', color2: '#000000', att: 61, def: 61, ovr: 61, conf: 'CAF' },
  { short: 'MTN', name: "Mauritania", color: '#006233', color2: '#FFC400', att: 60, def: 60, ovr: 60, conf: 'CAF' },
  { short: 'BDI', name: "Burundi", color: '#CE1126', color2: '#1EB53A', att: 60, def: 60, ovr: 60, conf: 'CAF' },
  { short: 'NAM', name: "Namibia", color: '#003580', color2: '#D21034', att: 60, def: 60, ovr: 60, conf: 'CAF' },
  { short: 'TAN', name: "Tanzania", color: '#1EB53A', color2: '#00A3DD', att: 60, def: 60, ovr: 60, conf: 'CAF' },
  { short: 'ETH', name: "Ethiopia", color: '#078930', color2: '#FCDD09', att: 59, def: 59, ovr: 59, conf: 'CAF' },
  { short: 'MWI', name: "Malawi", color: '#CE1126', color2: '#000000', att: 58, def: 58, ovr: 58, conf: 'CAF' },
  { short: 'LES', name: "Lesotho", color: '#00209F', color2: '#FFFFFF', att: 57, def: 57, ovr: 57, conf: 'CAF' },
  { short: 'CGO', name: "Congo", color: '#009543', color2: '#DC241F', att: 56, def: 56, ovr: 56, conf: 'CAF' },
  { short: 'ERI', name: "Eritrea", color: '#4189DD', color2: '#EA0437', att: 56, def: 56, ovr: 56, conf: 'CAF' },
  { short: 'CTA', name: "Central African Republic", color: '#003082', color2: '#FFCE00', att: 56, def: 56, ovr: 56, conf: 'CAF' },
  { short: 'SWZ', name: "Eswatini", color: '#3E5EB9', color2: '#FFD900', att: 54, def: 54, ovr: 54, conf: 'CAF' },
  { short: 'SSD', name: "South Sudan", color: '#FFFFFF', color2: '#DA121A', att: 52, def: 52, ovr: 52, conf: 'CAF' },
  { short: 'CHA', name: "Chad", color: '#002664', color2: '#FECB00', att: 51, def: 51, ovr: 51, conf: 'CAF' },
  { short: 'MRI', name: "Mauritius", color: '#EA2839', color2: '#1A206D', att: 51, def: 51, ovr: 51, conf: 'CAF' },
  { short: 'STP', name: "São Tomé and Príncipe", color: '#12AD2B', color2: '#D21034', att: 50, def: 50, ovr: 50, conf: 'CAF' },
  { short: 'SOM', name: "Somalia", color: '#4189DD', color2: '#FFFFFF', att: 47, def: 47, ovr: 47, conf: 'CAF' },
  { short: 'DJI', name: "Djibouti", color: '#6AB2E7', color2: '#12AD2B', att: 46, def: 46, ovr: 46, conf: 'CAF' },
  { short: 'SEY', name: "Seychelles", color: '#D92223', color2: '#003F87', att: 41, def: 41, ovr: 41, conf: 'CAF' },
  { short: 'YEM', name: "Yemen", color: '#CE1126', color2: '#FFFFFF', att: 57, def: 57, ovr: 57, conf: 'AFC' },
  { short: 'TKM', name: "Turkmenistan", color: '#00843D', color2: '#FFFFFF', att: 57, def: 57, ovr: 57, conf: 'AFC' },
  { short: 'SGP', name: "Singapore", color: '#EF3340', color2: '#FFFFFF', att: 54, def: 54, ovr: 54, conf: 'AFC' },
  { short: 'PHI', name: "Philippines", color: '#0038A8', color2: '#CE1126', att: 53, def: 53, ovr: 53, conf: 'AFC' },
  { short: 'HKG', name: "Hong Kong", color: '#DE2408', color2: '#FFFFFF', att: 53, def: 53, ovr: 53, conf: 'AFC' },
  { short: 'MYA', name: "Myanmar", color: '#EA2839', color2: '#FFFFFF', att: 49, def: 49, ovr: 49, conf: 'AFC' },
  { short: 'AFG', name: "Afghanistan", color: '#D32011', color2: '#FFFFFF', att: 47, def: 47, ovr: 47, conf: 'AFC' },
  { short: 'PAK', name: "Pakistan", color: '#01411C', color2: '#FFFFFF', att: 46, def: 46, ovr: 46, conf: 'AFC' },
  { short: 'BAN', name: "Bangladesh", color: '#006A4E', color2: '#F42A41', att: 45, def: 45, ovr: 45, conf: 'AFC' },
  { short: 'NEP', name: "Nepal", color: '#DC143C', color2: '#003893', att: 44, def: 44, ovr: 44, conf: 'AFC' },
  { short: 'CAM', name: "Cambodia", color: '#032EA1', color2: '#E00025', att: 43, def: 43, ovr: 43, conf: 'AFC' },
  { short: 'SRI', name: "Sri Lanka", color: '#8D153A', color2: '#FFB700', att: 42, def: 42, ovr: 42, conf: 'AFC' },
  { short: 'TPE', name: "Chinese Taipei", color: '#0033A0', color2: '#FFFFFF', att: 41, def: 41, ovr: 41, conf: 'AFC' },
  { short: 'MDV', name: "Maldives", color: '#D21034', color2: '#007E3A', att: 39, def: 39, ovr: 39, conf: 'AFC' },
  { short: 'MNG', name: "Mongolia", color: '#C4272F', color2: '#015197', att: 37, def: 37, ovr: 37, conf: 'AFC' },
  { short: 'LAO', name: "Laos", color: '#CE1126', color2: '#002868', att: 37, def: 37, ovr: 37, conf: 'AFC' },
  { short: 'TLS', name: "Timor-Leste", color: '#DC241F', color2: '#000000', att: 37, def: 37, ovr: 37, conf: 'AFC' },
  { short: 'GUM', name: "Guam", color: '#00297B', color2: '#C62139', att: 36, def: 36, ovr: 36, conf: 'AFC' },
  { short: 'BHU', name: "Bhutan", color: '#FFD520', color2: '#FF4E12', att: 33, def: 33, ovr: 33, conf: 'AFC' },
  { short: 'MAC', name: "Macau", color: '#00785E', color2: '#FFFFFF', att: 32, def: 32, ovr: 32, conf: 'AFC' },
  { short: 'BRU', name: "Brunei", color: '#F7E017', color2: '#000000', att: 30, def: 30, ovr: 30, conf: 'AFC' },
  { short: 'CUB', name: "Cuba", color: '#CF142B', color2: '#002A8F', att: 59, def: 59, ovr: 59, conf: 'CONCACAF' },
  { short: 'VIN', name: "Saint Vincent and the Grenadines", color: '#FCD116', color2: '#009E60', att: 56, def: 56, ovr: 56, conf: 'CONCACAF' },
  { short: 'PUR', name: "Puerto Rico", color: '#ED0000', color2: '#0050F0', att: 54, def: 54, ovr: 54, conf: 'CONCACAF' },
  { short: 'LCA', name: "Saint Lucia", color: '#66CCFF', color2: '#FCD116', att: 53, def: 53, ovr: 53, conf: 'CONCACAF' },
  { short: 'SKN', name: "Saint Kitts and Nevis", color: '#009E49', color2: '#CE1126', att: 51, def: 51, ovr: 51, conf: 'CONCACAF' },
  { short: 'ARU', name: "Aruba", color: '#418FDE', color2: '#FBE122', att: 49, def: 49, ovr: 49, conf: 'CONCACAF' },
  { short: 'GRN', name: "Grenada", color: '#CE1126', color2: '#FCD116', att: 49, def: 49, ovr: 49, conf: 'CONCACAF' },
  { short: 'MSR', name: "Montserrat", color: '#00843D', color2: '#FFFFFF', att: 49, def: 49, ovr: 49, conf: 'CONCACAF' },
  { short: 'BER', name: "Bermuda", color: '#003F87', color2: '#FFFFFF', att: 48, def: 48, ovr: 48, conf: 'CONCACAF' },
  { short: 'BLZ', name: "Belize", color: '#003F87', color2: '#CE1126', att: 48, def: 48, ovr: 48, conf: 'CONCACAF' },
  { short: 'BRB', name: "Barbados", color: '#00267F', color2: '#FFC726', att: 47, def: 47, ovr: 47, conf: 'CONCACAF' },
  { short: 'ATG', name: "Antigua and Barbuda", color: '#CE1126', color2: '#FCD116', att: 45, def: 45, ovr: 45, conf: 'CONCACAF' },
  { short: 'DMA', name: "Dominica", color: '#006B3F', color2: '#FCD116', att: 44, def: 44, ovr: 44, conf: 'CONCACAF' },
  { short: 'CAY', name: "Cayman Islands", color: '#CF142B', color2: '#00247D', att: 39, def: 39, ovr: 39, conf: 'CONCACAF' },
  { short: 'VIR', name: "US Virgin Islands", color: '#FFFFFF', color2: '#002868', att: 36, def: 36, ovr: 36, conf: 'CONCACAF' },
  { short: 'TCA', name: "Turks and Caicos Islands", color: '#FFFFFF', color2: '#012169', att: 36, def: 36, ovr: 36, conf: 'CONCACAF' },
  { short: 'VGB', name: "British Virgin Islands", color: '#00843D', color2: '#FFD100', att: 35, def: 35, ovr: 35, conf: 'CONCACAF' },
  { short: 'BAH', name: "Bahamas", color: '#00ABC9', color2: '#FFC72C', att: 33, def: 33, ovr: 33, conf: 'CONCACAF' },
  { short: 'AIA', name: "Anguilla", color: '#00247D', color2: '#F39200', att: 33, def: 33, ovr: 33, conf: 'CONCACAF' },
  { short: 'NCL', name: "New Caledonia", color: '#8C8C8C', color2: '#D52B1E', att: 56, def: 56, ovr: 56, conf: 'OFC' },
  { short: 'VAN', name: "Vanuatu", color: '#FDCE12', color2: '#000000', att: 54, def: 54, ovr: 54, conf: 'OFC' },
  { short: 'TAH', name: "Tahiti", color: '#E03C31', color2: '#FFFFFF', att: 54, def: 54, ovr: 54, conf: 'OFC' },
  { short: 'FIJ', name: "Fiji", color: '#FFFFFF', color2: '#68BFE5', att: 54, def: 54, ovr: 54, conf: 'OFC' },
  { short: 'PNG', name: "Papua New Guinea", color: '#CE1126', color2: '#000000', att: 53, def: 53, ovr: 53, conf: 'OFC' },
  { short: 'SOL', name: "Solomon Islands", color: '#FCD116', color2: '#215B33', att: 53, def: 53, ovr: 53, conf: 'OFC' },
  { short: 'SAM', name: "Samoa", color: '#002B7F', color2: '#CE1126', att: 37, def: 37, ovr: 37, conf: 'OFC' },
  { short: 'COK', name: "Cook Islands", color: '#00843D', color2: '#FFFFFF', att: 34, def: 34, ovr: 34, conf: 'OFC' },
  { short: 'TGA', name: "Tonga", color: '#C10000', color2: '#FFFFFF', att: 29, def: 29, ovr: 29, conf: 'OFC' },
  { short: 'ASA', name: "American Samoa", color: '#002B7F', color2: '#BF0A30', att: 23, def: 23, ovr: 23, conf: 'OFC' },
]
// the confederation of each of the 48 (the extras carry their own)
const CONF_2026 = {
  UEFA: ['CZE', 'SUI', 'BIH', 'SCO', 'TUR', 'GER', 'NED', 'SWE', 'BEL', 'ESP', 'FRA', 'NOR', 'AUT', 'POR', 'ENG', 'CRO'],
  CONMEBOL: ['BRA', 'PAR', 'ECU', 'URU', 'ARG', 'COL'],
  CAF: ['RSA', 'MAR', 'CIV', 'TUN', 'EGY', 'SEN', 'ALG', 'COD', 'CPV', 'GHA'],
  AFC: ['KOR', 'QAT', 'AUS', 'JPN', 'IRN', 'KSA', 'IRQ', 'JOR', 'UZB'],
  CONCACAF: ['MEX', 'CAN', 'HAI', 'USA', 'CUW', 'PAN'],
  OFC: ['NZL'],
}
const confOf = short => Object.keys(CONF_2026).find(k => CONF_2026[k].includes(short)) ?? null
// every nation Career knows: all 211 of FIFA's, each one a country a Career can be started with (2026-11-25: before,
// the 48 and the extras marked pick, 70)
export const CAREER_NATIONS = [...WC2026_NATIONS.map(n => ({ ...n, conf: confOf(n.short) })), ...CAREER_EXTRA_NATIONS, ...FIFA_REST_NATIONS].map(n => ({ ...n, pick: true }))
// The tournaments between World Cups, on their real cycles (the summer a season ends in; AFCON and the Asian Cup are
// booked with the season they fall in). size: the finals' field; slots: who else comes (the Copa América's guests).
//   Euros 2028, 2032... (24) · Copa América 2028, 2032... (the ten of CONMEBOL and six CONCACAF guests, as 2024)
//   AFCON 2027 (Kenya, Uganda, Tanzania: hosts since 2026-11-25, when Tanzania came in), 2028, then every four
//   years (CAF's calendar from 2028) (24) · Asian Cup 2027, 2031... (24)
//   Gold Cup 2027, 2029... every two years (16). The OFC Nations Cup isn't played (eight teams: the engine's
//   continental format needs four groups), so an Oceania side's summers are the World Cup's qualifying alone.
// The World Cup: 2030 (Spain, Portugal, Morocco), 2034 (Saudi Arabia), then no host named; 48 nations by
// confederation (FIFA's 2026 allocation with the play-off places shared out).
export const CONTINENTALS = [
  { id: 'euro', name: 'European Championship', short: 'Euros', conf: 'UEFA', size: 24, every: 4, from: 2028, hosts: { 2028: ['ENG', 'SCO', 'WAL', 'IRL'], 2032: ['ITA', 'TUR'] } },
  { id: 'copa', name: 'Copa América', short: 'Copa América', conf: 'CONMEBOL', size: 16, every: 4, from: 2028, guests: ['CONCACAF', 6] },
  { id: 'afcon', name: 'Africa Cup of Nations', short: 'AFCON', conf: 'CAF', size: 24, every: 4, from: 2028, also: [2027], hosts: { 2027: ['KEN', 'UGA', 'TAN'] } },
  { id: 'asian', name: 'Asian Cup', short: 'Asian Cup', conf: 'AFC', size: 24, every: 4, from: 2027, hosts: { 2027: ['KSA'] } },
  { id: 'gold', name: 'Gold Cup', short: 'Gold Cup', conf: 'CONCACAF', size: 16, every: 2, from: 2027 },
]
export const WC_SLOTS = { UEFA: 16, CAF: 10, AFC: 9, CONMEBOL: 6, CONCACAF: 6, OFC: 1 }
export const WC_HOSTS = { 2030: ['ESP', 'POR', 'MAR'], 2034: ['KSA'] }

export const WC_NATIONS = WC_LEGEND_NATIONS
export const WC_ALL_NATIONS = [...WC_LEGEND_NATIONS, ...WC2026_NATIONS.filter(n => !WC_LEGEND_NATIONS.some(l => l.short === n.short))]
