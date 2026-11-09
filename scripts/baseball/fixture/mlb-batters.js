// TEST FIXTURE ONLY. contact power eye avoidK gap speed baserunning fielding arm clutch
import { fill } from './gen.js'
const K = ['contact', 'power', 'eye', 'avoidK', 'gap', 'speed', 'baserunning', 'fielding', 'arm', 'clutch']
const P = (name, team, role, age, a, starter = false, rookie = undefined) => ({ name, team, role, age, starter, rookie, attrs: Object.fromEntries(K.map((k, i) => [k, a[i]])) })
const NAMED = [
  P('Aaron Judge', 'NYY', 'RF', 34, [9, 11, 11, 4, 9, 5, 6, 6, 8, 8], true),
  P('Shohei Ohtani', 'LAD', 'DH', 32, [9, 11, 9, 5, 9, 9, 9, 2, 6, 8], true),
  P('Bobby Witt Jr.', 'KC', 'SS', 26, [10, 8, 6, 8, 9, 11, 10, 10, 9, 7], true),
  P('Juan Soto', 'NYM', 'RF', 28, [9, 9, 11, 8, 8, 4, 5, 4, 5, 8], true),
  P('Cal Raleigh', 'SEA', 'C', 30, [5, 10, 8, 3, 7, 2, 4, 9, 7, 8], true),
  P('Jose Ramirez', 'CLE', '3B', 34, [8, 8, 8, 9, 9, 8, 10, 7, 6, 8], true),
  P('Elly De La Cruz', 'CIN', 'SS', 24, [6, 8, 5, 3, 7, 11, 9, 7, 11, 6], true),
  P('Luis Arraez', 'SD', '1B', 29, [11, 1, 6, 11, 5, 3, 4, 3, 2, 6]),
  P('Kyle Schwarber', 'PHI', 'DH', 33, [5, 10, 10, 2, 6, 3, 4, 1, 2, 7], true),
  P('Freddie Freeman', 'LAD', '1B', 37, [9, 7, 9, 8, 9, 4, 6, 7, 5, 9]),
  P('Mookie Betts', 'LAD', 'SS', 34, [8, 7, 8, 9, 8, 6, 8, 8, 7, 8]),
  P('Gunnar Henderson', 'BAL', 'SS', 25, [8, 9, 7, 5, 8, 8, 8, 7, 8, 7], true),
  P('Vladimir Guerrero Jr.', 'TOR', '1B', 27, [9, 8, 8, 8, 8, 2, 4, 5, 5, 8], true),
  P('Julio Rodriguez', 'SEA', 'CF', 26, [7, 8, 5, 4, 8, 9, 8, 8, 9, 6]),
  P('Yordan Alvarez', 'HOU', 'DH', 29, [9, 10, 9, 6, 8, 2, 3, 1, 3, 8], true),
  P('Fernando Tatis Jr.', 'SD', 'RF', 27, [7, 9, 7, 5, 8, 8, 8, 8, 10, 7], true),
  P('Corbin Carroll', 'ARI', 'CF', 26, [7, 7, 7, 6, 8, 11, 10, 8, 6, 7], true),
  P('Kyle Tucker', 'CHC', 'RF', 29, [8, 8, 9, 8, 8, 6, 7, 7, 7, 7], true),
  P('Jackson Holliday', 'BAL', '2B', 22, [6, 5, 7, 5, 6, 6, 6, 6, 6, 5], false, true),
  P('Ronald Acuna Jr.', 'ATL', 'RF', 28, [8, 9, 8, 6, 8, 10, 9, 6, 8, 7], true),
  P('Pete Alonso', 'NYM', '1B', 31, [6, 10, 6, 4, 7, 2, 3, 4, 4, 7]),
  P('Jackson Chourio', 'MIL', 'LF', 22, [7, 7, 5, 6, 7, 9, 8, 7, 7, 6], true),
]
export const MLB_BATTERS = fill(NAMED, 'bat', ['DH', 'SS', 'CF', 'C', '2B', '3B'], K)
