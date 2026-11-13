// Finds what a save loses. bash scripts/franchise/run.sh scripts/franchise/save-diff.mjs
import * as FR from '../../src/lib/franchise/index'
let F = FR.createFranchise({ team: 'KC', gmName: 'Check GM', seed: 'check-a' })
F = FR.autopilot(F, { until: 1 })
for (let i = 0; i < 9; i++) F = FR.autopilot(F, { until: 'week' })
const plain = JSON.parse(JSON.stringify({ ...F, flash: null, rev: 0 }))
const back = { ...FR.unpackFranchise(FR.packFranchise(F)), flash: null, rev: 0 }
let n = 0
function diff(a, b, path) {
  if (n > 25) return
  if (a === b) return
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { n++; console.log(path, JSON.stringify(a)?.slice(0, 80), '≠', JSON.stringify(b)?.slice(0, 80)); return }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) diff(a[k], b[k], `${path}.${k}`)
}
diff(plain, back, 'F')
console.log('differences', n)
const a = FR.autopilot(back, { until: 'week' }), b = FR.autopilot(plain, { until: 'week' })
n = 0
diff(JSON.parse(JSON.stringify({ ...a, flash: null, rev: 0 })), JSON.parse(JSON.stringify({ ...b, flash: null, rev: 0 })), 'F')
console.log('after a week', n)
