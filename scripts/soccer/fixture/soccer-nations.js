// TEST FIXTURE ONLY (scripts/soccer/sim-test.mjs uses it when src/data/soccer-nations.js isn't there yet).
// The 48 nations of the 2026 World Cup in their draw groups (the playoff winners guessed). Ratings are rough.
const N = (group, rows) => rows.map(([short, name, att, def]) => ({ short, name, color: '#ffffff', color2: '#000000', espn: null, att, def, ovr: Math.round((att + def) / 2), group }))
export const WC_NATIONS = [
  ...N('A', [['MEX', 'Mexico', 76, 75], ['RSA', 'South Africa', 68, 69], ['KOR', 'South Korea', 76, 73], ['DEN', 'Denmark', 78, 80]]),
  ...N('B', [['CAN', 'Canada', 74, 72], ['ITA', 'Italy', 81, 83], ['QAT', 'Qatar', 64, 63], ['SUI', 'Switzerland', 77, 79]]),
  ...N('C', [['BRA', 'Brazil', 87, 82], ['MAR', 'Morocco', 80, 84], ['HAI', 'Haiti', 60, 58], ['SCO', 'Scotland', 72, 74]]),
  ...N('D', [['USA', 'United States', 77, 74], ['PAR', 'Paraguay', 71, 77], ['AUS', 'Australia', 70, 73], ['TUR', 'Türkiye', 79, 74]]),
  ...N('E', [['GER', 'Germany', 86, 82], ['CUW', 'Curaçao', 59, 58], ['CIV', "Côte d'Ivoire", 75, 74], ['ECU', 'Ecuador', 73, 81]]),
  ...N('F', [['NED', 'Netherlands', 84, 83], ['JPN', 'Japan', 79, 77], ['UKR', 'Ukraine', 74, 74], ['TUN', 'Tunisia', 66, 72]]),
  ...N('G', [['BEL', 'Belgium', 81, 76], ['EGY', 'Egypt', 72, 73], ['IRN', 'Iran', 70, 72], ['NZL', 'New Zealand', 61, 63]]),
  ...N('H', [['ESP', 'Spain', 90, 86], ['CPV', 'Cape Verde', 63, 65], ['KSA', 'Saudi Arabia', 64, 66], ['URU', 'Uruguay', 78, 80]]),
  ...N('I', [['FRA', 'France', 90, 86], ['SEN', 'Senegal', 76, 78], ['IRQ', 'Iraq', 64, 66], ['NOR', 'Norway', 81, 74]]),
  ...N('J', [['ARG', 'Argentina', 88, 87], ['ALG', 'Algeria', 72, 71], ['AUT', 'Austria', 77, 76], ['JOR', 'Jordan', 63, 66]]),
  ...N('K', [['POR', 'Portugal', 87, 82], ['COD', 'DR Congo', 67, 70], ['UZB', 'Uzbekistan', 66, 69], ['COL', 'Colombia', 80, 79]]),
  ...N('L', [['ENG', 'England', 87, 86], ['CRO', 'Croatia', 79, 78], ['GHA', 'Ghana', 70, 69], ['PAN', 'Panama', 66, 68]]),
]
