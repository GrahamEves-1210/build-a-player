// TEST FIXTURE ONLY (scripts/soccer/sim-test.mjs uses it when src/data/soccer-clubs.js isn't there yet).
// Same shape as the data agent's file: SOCCER_LEAGUES and SOCCER_CLUBS. Ratings are rough, for testing the engine.
export const SOCCER_LEAGUES = [
  { id: 'epl', name: 'Premier League', short: 'EPL', country: 'England' },
  { id: 'laliga', name: 'La Liga', short: 'LIGA', country: 'Spain' },
  { id: 'seriea', name: 'Serie A', short: 'SA', country: 'Italy' },
  { id: 'bundesliga', name: 'Bundesliga', short: 'BL', country: 'Germany' },
  { id: 'ligue1', name: 'Ligue 1', short: 'L1', country: 'France' },
]
const C = (league, rows) => rows.map(([short, name, att, def]) => ({ short, name, league, color: '#ffffff', color2: '#000000', espn: null, att, def, ovr: Math.round((att + def) / 2) }))
export const SOCCER_CLUBS = [
  ...C('epl', [
    ['ARS', 'Arsenal', 88, 92], ['MCI', 'Manchester City', 90, 85], ['LIV', 'Liverpool', 89, 83], ['CHE', 'Chelsea', 85, 82],
    ['NEW', 'Newcastle United', 82, 80], ['AVL', 'Aston Villa', 81, 79], ['MUN', 'Manchester United', 80, 76], ['TOT', 'Tottenham Hotspur', 79, 74],
    ['BHA', 'Brighton & Hove Albion', 79, 76], ['CRY', 'Crystal Palace', 76, 79], ['BOU', 'Bournemouth', 78, 75], ['BRE', 'Brentford', 79, 72],
    ['NFO', 'Nottingham Forest', 74, 77], ['FUL', 'Fulham', 75, 74], ['EVE', 'Everton', 72, 77], ['WHU', 'West Ham United', 73, 70],
    ['LEE', 'Leeds United', 71, 72], ['SUN', 'Sunderland', 70, 73], ['BUR', 'Burnley', 66, 70], ['WOL', 'Wolverhampton Wanderers', 67, 68],
  ]),
  ...C('laliga', [
    ['RMA', 'Real Madrid', 91, 84], ['BAR', 'Barcelona', 93, 81], ['ATM', 'Atlético Madrid', 84, 85], ['VIL', 'Villarreal', 81, 77],
    ['ATH', 'Athletic Club', 78, 80], ['BET', 'Real Betis', 79, 75], ['RSO', 'Real Sociedad', 75, 76], ['CEL', 'Celta Vigo', 77, 72],
    ['VAL', 'Valencia', 72, 74], ['SEV', 'Sevilla', 73, 71], ['GIR', 'Girona', 73, 69], ['OSA', 'Osasuna', 70, 75],
    ['GET', 'Getafe', 66, 78], ['RAY', 'Rayo Vallecano', 71, 73], ['ESY', 'Espanyol', 70, 73], ['MLL', 'Mallorca', 69, 74],
    ['ALA', 'Alavés', 68, 74], ['ELC', 'Elche', 69, 70], ['LEV', 'Levante', 68, 68], ['OVI', 'Real Oviedo', 64, 69],
  ]),
  ...C('seriea', [
    ['INT', 'Inter', 88, 85], ['NAP', 'Napoli', 84, 84], ['MIL', 'AC Milan', 82, 82], ['JUV', 'Juventus', 81, 84],
    ['ATA', 'Atalanta', 84, 78], ['ROM', 'Roma', 78, 83], ['COM', 'Como', 80, 77], ['LAZ', 'Lazio', 77, 78],
    ['BOL', 'Bologna', 78, 77], ['FIO', 'Fiorentina', 76, 75], ['TOR', 'Torino', 72, 73], ['UDI', 'Udinese', 71, 73],
    ['GEN', 'Genoa', 70, 73], ['SAS', 'Sassuolo', 72, 70], ['CAG', 'Cagliari', 69, 71], ['LEC', 'Lecce', 66, 71],
    ['PAR', 'Parma', 67, 71], ['VER', 'Hellas Verona', 66, 69], ['CRE', 'Cremonese', 67, 68], ['PIS', 'Pisa', 64, 69],
  ]),
  ...C('bundesliga', [
    ['BAY', 'Bayern Munich', 94, 85], ['BVB', 'Borussia Dortmund', 84, 81], ['B04', 'Bayer Leverkusen', 84, 78], ['RBL', 'RB Leipzig', 82, 78],
    ['VFB', 'VfB Stuttgart', 82, 77], ['SGE', 'Eintracht Frankfurt', 82, 74], ['SCF', 'SC Freiburg', 77, 77], ['HOF', 'Hoffenheim', 80, 72],
    ['M05', 'Mainz 05', 73, 77], ['WOB', 'Wolfsburg', 74, 72], ['BMG', 'Borussia Mönchengladbach', 74, 72], ['SVW', 'Werder Bremen', 74, 70],
    ['FCU', 'Union Berlin', 70, 76], ['FCA', 'Augsburg', 70, 73], ['KOE', 'FC Köln', 72, 70], ['HSV', 'Hamburger SV', 70, 70],
    ['HDH', 'Heidenheim', 67, 69], ['STP', 'St. Pauli', 65, 72],
  ]),
  ...C('ligue1', [
    ['PSG', 'Paris Saint-Germain', 92, 86], ['OM', 'Marseille', 84, 78], ['ASM', 'Monaco', 83, 75], ['LIL', 'Lille', 79, 79],
    ['LYO', 'Lyon', 79, 77], ['NIC', 'Nice', 76, 76], ['RCL', 'Lens', 76, 79], ['REN', 'Rennes', 77, 74],
    ['RCS', 'Strasbourg', 76, 73], ['TFC', 'Toulouse', 72, 74], ['BST', 'Brest', 72, 71], ['FCN', 'Nantes', 67, 71],
    ['AJA', 'Auxerre', 66, 71], ['SCO', 'Angers', 64, 72], ['HAC', 'Le Havre', 65, 70], ['FCL', 'Lorient', 67, 67],
    ['PFC', 'Paris FC', 68, 69], ['FCM', 'Metz', 63, 66],
  ]),
]
