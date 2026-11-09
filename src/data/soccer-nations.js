// World Cup: the 48 nations of the 2026 FIFA World Cup (USA, Canada, Mexico, June 11 - July 19, 2026; Spain won the
// final 1-0 after extra time against Argentina).
// Nations, groups and ESPN team ids (espn): ESPN soccer API, fifa.world 2026 (teams + standings).
// short: FIFA code. color / color2: home kit colour and second colour.
// Strength (0-100):
//   ovr = World Football Elo rating (eloratings.net, as of 2026-11-07) on the same feel as the club scale:
//         ovr = 100 - (Spain's Elo - Elo) x 0.04, so Elo No. 1 Spain = 100 and the 48th side here is about 67.
//   att / def = ovr split by how each side played at the 2026 World Cup: FotMob tournament xG for and against per
//         match, as z-scores across the 48 (pulled toward average for sides with 3 games), att = ovr + 3 x (zAttack -
//         zDefence) / 2, def = ovr - the same.

export const WC_NATIONS = [
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
