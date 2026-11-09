// TEST FIXTURE ONLY.
import { fill } from './gen.js'
const K = ['contact', 'power', 'eye', 'avoidK', 'gap', 'speed', 'baserunning', 'fielding', 'arm', 'clutch']
const P = (name, team, role, a, starter = false) => ({ name, team, role, age: 28, starter, attrs: Object.fromEntries(K.map((k, i) => [k, a[i]])) })
const NAMED = [
  P('Babe Ruth', 'NYY', 'RF', [11, 11, 11, 8, 10, 5, 6, 5, 8, 10], true), P('Lou Gehrig', 'NYY', '1B', [11, 10, 11, 9, 11, 5, 6, 6, 5, 10]),
  P('Mickey Mantle', 'NYY', 'CF', [10, 11, 11, 6, 9, 10, 8, 7, 8, 9]), P('Joe DiMaggio', 'NYY', 'CF', [11, 9, 9, 11, 10, 7, 8, 9, 9, 9]),
  P('Ted Williams', 'BOS', 'LF', [11, 11, 11, 10, 10, 4, 5, 5, 6, 9], true), P('David Ortiz', 'BOS', 'DH', [9, 10, 10, 6, 10, 2, 3, 1, 2, 11]),
  P('Willie Mays', 'SF', 'CF', [10, 10, 9, 8, 10, 10, 11, 11, 11, 9], true), P('Barry Bonds', 'SF', 'LF', [10, 11, 11, 9, 10, 8, 9, 8, 7, 9]),
  P('Hank Aaron', 'ATL', 'RF', [11, 10, 9, 9, 10, 7, 8, 8, 9, 9], true), P('Mike Trout', 'LAA', 'CF', [10, 10, 11, 7, 9, 9, 9, 8, 7, 8], true),
  P('Ken Griffey Jr.', 'SEA', 'CF', [9, 10, 8, 7, 9, 8, 7, 10, 9, 8], true), P('Tony Gwynn', 'SD', 'RF', [11, 4, 8, 11, 9, 6, 7, 7, 7, 9], true),
  P('Rickey Henderson', 'ATH', 'LF', [9, 6, 11, 8, 8, 11, 11, 7, 5, 8], true), P('Stan Musial', 'STL', 'LF', [11, 9, 10, 10, 11, 6, 7, 6, 6, 9], true),
]
export const MLB_LEGEND_BATTERS = fill(NAMED, 'bat', ['RF', 'SS', 'CF', 'C', '1B'], K, true)
