// Roster probe: how many real players each team has at each position, and the OVR spread.
import { QBS, TYPES } from '../../src/data/qbs'
import { RBS, RB_TYPES } from '../../src/data/rbs'
import { WRS, WR_TYPES } from '../../src/data/wrs'
import { TES, TE_TYPES } from '../../src/data/tes'
import { OLS, OL_TYPES } from '../../src/data/ols'
import { DLS, DL_TYPES } from '../../src/data/dls'
import { LBS, LB_TYPES } from '../../src/data/lbs'
import { DBS, DB_TYPES } from '../../src/data/dbs'
import { KS, K_TYPES } from '../../src/data/ks'
import { NFL_TEAMS } from '../../src/data/nfl-teams'
import { BIRTH_NFL } from '../../src/data/player-ages'
import HEADSHOTS from '../../src/data/headshots.json'
import { calcOVR, calcOVRRB, calcOVRWR, calcOVRTE, calcOVRDB, calcOVRDL, calcOVRLB, calcOVROL, calcOVRK } from '../../src/utils/simulation'

const POOL = { qb: [QBS, TYPES, calcOVR], rb: [RBS, RB_TYPES, calcOVRRB], wr: [WRS, WR_TYPES, calcOVRWR], te: [TES, TE_TYPES, calcOVRTE], ol: [OLS, OL_TYPES, calcOVROL], dl: [DLS, DL_TYPES, calcOVRDL], lb: [LBS, LB_TYPES, calcOVRLB], db: [DBS, DB_TYPES, calcOVRDB], k: [KS, K_TYPES, calcOVRK] }
const out = {}
for (const [pos, [list, types, ovr]] of Object.entries(POOL)) {
  const rated = list.filter(p => p.attrs && types.every(t => typeof p.attrs[t] === 'number'))
  const per = {}
  for (const p of rated) per[p.team] = (per[p.team] ?? 0) + 1
  const counts = NFL_TEAMS.map(t => per[t.short] ?? 0)
  const ovrs = rated.map(p => ovr(Object.fromEntries(types.map(t => [t, { val: p.attrs[t] }])), types)).sort((a, b) => a - b)
  const q = f => ovrs[Math.floor((ovrs.length - 1) * f)]
  const noAge = rated.filter(p => !BIRTH_NFL[p.name]).length
  const noHead = rated.filter(p => !(p.headshot ?? HEADSHOTS[p.name])).length
  const teams = new Set(rated.map(p => p.team))
  const odd = [...teams].filter(t => !NFL_TEAMS.some(x => x.short === t))
  const subs = {}
  for (const p of rated) { const s = p.subpos ?? p.pos ?? '-'; subs[s] = (subs[s] ?? 0) + 1 }
  console.log(pos.toUpperCase(), 'all', list.length, 'rated', rated.length, 'per team min/avg/max', Math.min(...counts), (rated.length / 32).toFixed(1), Math.max(...counts),
    'OVR min/q10/q50/q90/max', q(0), q(0.1), q(0.5), q(0.9), q(1), 'noAge', noAge, 'noHead', noHead, 'oddTeams', odd.join(','), 'subs', JSON.stringify(subs))
  out[pos] = rated.length
}
const names = {}
for (const [pos, [list]] of Object.entries(POOL)) for (const p of list) (names[p.name] ??= []).push(`${pos}:${p.team}`)
const dup = Object.entries(names).filter(([, v]) => v.length > 1)
console.log('dup names', dup.length, dup.slice(0, 12).map(([n, v]) => `${n} ${v.join('/')}`).join(' | '))
console.log('sample keys', Object.keys(QBS[0]).join(','), '|', Object.keys(DBS[0]).join(','), '|', Object.keys(OLS[0]).join(','), '|', Object.keys(LBS[0]).join(','), '|', Object.keys(KS[0]).join(','))
console.log('headshot sample', HEADSHOTS[QBS[0].name], QBS[0].headshot, Object.keys(HEADSHOTS).length)
const ages = Object.values(BIRTH_NFL)
console.log('birth years', Math.min(...ages), Math.max(...ages))
