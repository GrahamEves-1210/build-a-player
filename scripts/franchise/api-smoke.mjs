// Calls every export of the engine's front door once on a new league, with and without builds, and round-trips
// a save. bash scripts/franchise/run.sh scripts/franchise/api-smoke.mjs
import * as FR from '../../src/lib/franchise/index'
import { QBS, TYPES } from '../../src/data/qbs'
import { WRS, WR_TYPES } from '../../src/data/wrs'
import { DLS, DL_TYPES } from '../../src/data/dls'

const chip = (p, t) => ({ type: t, val: p.attrs[t], qbFull: p.name, team: p.team, photo: null })
const buildOf = (p, types, extra = {}) => { const b = Object.fromEntries(types.map(t => [t, chip(p, t)])); Object.assign(b.size ?? {}, extra); return b }
const builds = [
  { pos: 'qb', build: buildOf(QBS.find(p => p.name === 'Josh Allen'), TYPES), name: 'Test Quarterback' },
  { pos: 'wr', build: buildOf(WRS[5], WR_TYPES) },
  { pos: 'dl', build: buildOf(DLS[3], DL_TYPES, { subpos: 'dt' }) },
]
const coach = { name: 'Built Coach', build: Object.fromEntries(FR.COACH_TYPES.map((t, i) => [t, { type: t, val: 6 + (i % 3), qbFull: 'Somebody', team: 'KC' }])) }
let F = FR.createFranchise({ team: 'DEN', builds, gmName: 'Graham', coach, seed: 'api-smoke' })
console.log('league', Object.keys(F.players).length, 'players;', F.gm.name, F.team, F.year, 'week', F.week)
const r = FR.roster(F)
console.log('roster', r.length, 'builds', r.filter(p => p.built).map(p => `${p.name} ${p.slot} ${p.ovr} d${p.depth}${p.starter ? '*' : ''}`).join(' | '))
console.log('staff', JSON.stringify(FR.staff(F).hc).slice(0, 260))
console.log('depth QB', FR.depthChart(F).slots[0].players.map(p => `${p.name} ${p.ovr}`).join(', '))
console.log('cap', JSON.stringify({ ...FR.capSheet(F), rows: undefined }))
console.log('schedule', FR.schedule(F).map(g => (g.bye ? 'BYE' : `${g.home ? '' : '@'}${g.opp.short}`)).join(' '))
let bad = 0
const ACTIONS = new Set(['createFranchise', 'saveFranchise', 'loadFranchise', 'listSlots', 'deleteSlot', 'unpackFranchise', 'useCoachData', 'teamRef', 'photoUrl', 'moneyText', 'gradeOf', 'ovrGrade', 'packFranchise', 'coachDataIsReal', 'autopilot', 'simTo', 'advanceWeek', 'advanceStage', 'takeJob'])
for (const [name, fn] of Object.entries(FR)) {
  if (typeof fn !== 'function' || ACTIONS.has(name)) continue
  try { const out = fn(F); if (out === undefined) { bad++; console.log('  undefined from', name) } else if (out && out.teams && out.players) F = out } catch (e) { bad++; console.log('  THROWS', name, e.message, String(e.stack ?? '').split(String.fromCharCode(10))[1]) }
}
console.log('exports called, problems:', bad)
const t0 = performance.now()
const text = FR.packFranchise(F)
const t1 = performance.now()
const back = FR.unpackFranchise(text)
const t2 = performance.now()
const a = JSON.stringify({ ...F, flash: null }), b = JSON.stringify({ ...back, flash: null })
console.log('save', (text.length * 2 / 1024).toFixed(0), 'KB (UTF-16) from', (a.length / 1024).toFixed(0), 'KB JSON; pack', (t1 - t0).toFixed(0), 'ms, unpack', (t2 - t1).toFixed(0), 'ms; round trip', a === b ? 'IDENTICAL' : 'DIFFERENT')
if (a !== b) { for (const id of Object.keys(F.players)) { const x = JSON.stringify(F.players[id]), y = JSON.stringify(back.players[id]); if (x !== y) { console.log(x); console.log(y); break } } }
