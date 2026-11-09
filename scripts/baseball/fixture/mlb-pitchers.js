// TEST FIXTURE ONLY. velocity movement breaking changeup control command stamina groundball composure pitchIQ
import { fill } from './gen.js'
const K = ['velocity', 'movement', 'breaking', 'changeup', 'control', 'command', 'stamina', 'groundball', 'composure', 'pitchIQ']
const P = (name, team, role, age, a, starter = false) => ({ name, team, role, age, starter, attrs: Object.fromEntries(K.map((k, i) => [k, a[i]])) })
const NAMED = [
  P('Tarik Skubal', 'DET', 'SP', 29, [9, 9, 9, 11, 10, 10, 9, 6, 9, 10], true),
  P('Paul Skenes', 'PIT', 'SP', 24, [11, 9, 10, 8, 9, 9, 9, 7, 9, 9], true),
  P('Garrett Crochet', 'BOS', 'SP', 27, [10, 9, 9, 7, 8, 8, 9, 6, 8, 8], true),
  P('Zack Wheeler', 'PHI', 'SP', 36, [9, 9, 9, 7, 9, 9, 9, 6, 9, 9], true),
  P('Chris Sale', 'ATL', 'SP', 37, [8, 9, 10, 7, 9, 9, 7, 5, 9, 9], true),
  P('Logan Webb', 'SF', 'SP', 29, [5, 10, 8, 9, 9, 9, 10, 11, 8, 9], true),
  P('Yoshinobu Yamamoto', 'LAD', 'SP', 28, [9, 9, 9, 10, 9, 9, 8, 7, 9, 9], true),
  P('Hunter Greene', 'CIN', 'SP', 27, [11, 7, 8, 5, 7, 7, 7, 4, 7, 7], true),
  P('Emmanuel Clase', 'CLE', 'CL', 28, [10, 11, 8, 3, 9, 9, 2, 10, 9, 8]),
  P('Edwin Diaz', 'NYM', 'CL', 32, [10, 8, 11, 2, 7, 7, 1, 4, 8, 8]),
  P('Josh Hader', 'HOU', 'CL', 32, [9, 9, 10, 3, 7, 7, 1, 5, 8, 8]),
  P('Mason Miller', 'SD', 'CL', 28, [11, 8, 10, 3, 7, 7, 2, 5, 8, 7]),
  P('Andres Munoz', 'SEA', 'CL', 27, [11, 8, 10, 2, 7, 7, 1, 6, 8, 7]),
]
export const MLB_PITCHERS = fill(NAMED, 'pit', ['SP', 'SP', 'SP', 'SP', 'CL', 'RP'], K)
