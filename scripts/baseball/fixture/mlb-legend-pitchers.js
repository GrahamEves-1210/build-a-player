// TEST FIXTURE ONLY.
import { fill } from './gen.js'
const K = ['velocity', 'movement', 'breaking', 'changeup', 'control', 'command', 'stamina', 'groundball', 'composure', 'pitchIQ']
const P = (name, team, role, a, starter = false) => ({ name, team, role, age: 29, starter, attrs: Object.fromEntries(K.map((k, i) => [k, a[i]])) })
const NAMED = [
  P('Sandy Koufax', 'LAD', 'SP', [11, 9, 11, 7, 9, 9, 10, 6, 10, 10], true), P('Clayton Kershaw', 'LAD', 'SP', [8, 9, 11, 7, 10, 10, 9, 7, 9, 11]),
  P('Pedro Martinez', 'BOS', 'SP', [10, 10, 10, 11, 10, 10, 8, 6, 10, 11], true), P('Randy Johnson', 'ARI', 'SP', [11, 9, 11, 4, 8, 9, 10, 6, 9, 9], true),
  P('Greg Maddux', 'ATL', 'SP', [5, 11, 9, 10, 11, 11, 10, 10, 10, 11], true), P('Bob Gibson', 'STL', 'SP', [10, 9, 10, 6, 9, 9, 11, 7, 11, 9], true),
  P('Mariano Rivera', 'NYY', 'CL', [9, 11, 6, 4, 11, 11, 2, 9, 11, 10]), P('Whitey Ford', 'NYY', 'SP', [7, 9, 9, 9, 9, 10, 9, 8, 10, 10], true),
  P('Justin Verlander', 'DET', 'SP', [10, 8, 10, 7, 9, 9, 11, 5, 9, 10], true),
]
export const MLB_LEGEND_PITCHERS = fill(NAMED, 'pit', ['SP', 'SP', 'SP', 'CL', 'SP'], K, true)
