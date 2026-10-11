// SALARY CAP (QB): the five columns and the player pool, shared by the
// Salary Cap screen and the Trait Auction (lib/auction.js)
import { QBS } from './qbs'
import { LEGENDS } from './qb-legends'

// ─── All-time legends (retired greats not on a current roster) ───────────────
// Deterministic: strongest ~18 by average attribute, ties broken by name.
const LEGEND_COUNT = 18
const _avgAttr = p => {
  const vals = Object.values(p.attrs ?? {})
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}
const _currentNames = new Set(QBS.map(p => p.name))
const GOAT_SALARY_PLAYERS = LEGENDS
  .filter(p => p.attrs && !_currentNames.has(p.name))
  .sort((a, b) => (_avgAttr(b) - _avgAttr(a)) || a.name.localeCompare(b.name))
  // multi-team legends appear once per franchise — keep their strongest entry
  .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)
  .slice(0, LEGEND_COUNT)
  .map(p => ({ ...p, legend: true }))

// ─── Player pool (daily + infinite) ──────────────────────────────────────────
export const QB_SAL_POOL = [...QBS, ...GOAT_SALARY_PLAYERS]
  .filter(p => {
    if (!p.attrs) return false
    const vals = Object.values(p.attrs)
    return vals.reduce((s, v) => s + v, 0) / vals.length >= 3.0
  })
  .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)

// One pick per column; together the 5 columns cover all 9 QB attributes.
export const QB_SAL_COLS = [
  { key: 'arm',      label: 'ARM',                 types: ['arm'] },
  { key: 'accuracy', label: 'ACCURACY',            types: ['accuracy'] },
  { key: 'mind',     label: 'PRE & POST-SNAP',     types: ['processing', 'vision'] },
  { key: 'pocket',   label: 'POCKET & LEADERSHIP', types: ['pocket-presence', 'leadership'] },
  { key: 'athlete',  label: 'LEGS & SIZE',         types: ['legs', 'size', 'playmaking'] },
]

