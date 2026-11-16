// Striker traits for soccer (the third sport). Same shape as data/nba-attrs.js.
// The nine, in the order the game shows them (the owner, 2026-11-16): Pace, Finishing, Shot Power, Dribbling
// (ball control and first touch included), Passing, Positioning, Heading, Size (from his height and weight, like
// football's DB and DL Size) and Composure. Until 11-16 there were ten (First Touch, Link-Up Play, Strength and
// Off-Ball Movement went): migrateSoccerKeys below turns anything saved with those keys into the nine.
export const SOCCER_ATTR = {
  pace: { label: 'Pace', shortLabel: 'PAC', category: 'physical', hex: '#fb923c' },
  finishing: { label: 'Finishing', shortLabel: 'FIN', category: 'skills', hex: '#f87171' },
  shotPower: { label: 'Shot Power', shortLabel: 'PWR', category: 'skills', hex: '#fb7185' },
  dribbling: { label: 'Dribbling', shortLabel: 'DRI', category: 'skills', hex: '#a78bfa' },
  passing: { label: 'Passing', shortLabel: 'PAS', category: 'skills', hex: '#60a5fa' },
  positioning: { label: 'Positioning', shortLabel: 'POS', category: 'mental', hex: '#38bdf8' },
  heading: { label: 'Heading', shortLabel: 'HDR', category: 'skills', hex: '#fcd34d' },
  size: { label: 'Size', shortLabel: 'SIZ', category: 'physical', hex: '#fdba74' },
  composure: { label: 'Composure', shortLabel: 'CMP', category: 'mental', hex: '#818cf8' },
}

export const SOCCER_TYPES = ['pace', 'finishing', 'shotPower', 'dribbling', 'passing', 'positioning', 'heading', 'size', 'composure']
export const SOCCER_CATEGORIES = [
  { id: 'skills', label: 'Skills', types: ['finishing', 'shotPower', 'dribbling', 'passing', 'heading'] },
  { id: 'physical', label: 'Physical', types: ['pace', 'size'] },
  { id: 'mental', label: 'Mental', types: ['positioning', 'composure'] },
]
// Career: physical traits a player can train, and the trait durability comes from. Size is his frame
// (height and weight), so it isn't trained; durability still comes from it, as it did from Strength.
export const SOCCER_TRAINABLE = ['pace']
export const SOCCER_DURABILITY_TRAIT = 'size'

// ── Size: worked out from the bio, like football's DB and DL Size (data/dbs.js dbSizeGrade) ──
// Weight counts for 65%, height for 35%: 136 lb = F and 192 lb = S, 5'6" = F and 6'4" = S. Across the pool that
// puts a 5'11", 161 lb player (the median) at B- and the 6'4", 196 lb target men at S. No weight on ESPN: his
// height at his role's typical build (the pool's mean body-mass index for the role, 2026-11-16).
export const SOCCER_SIZE_SCALE = { lb: [136, 192], in: [66, 76], w: 0.65 }
const ROLE_BMI = { ST: 22.9, SS: 22.9, LW: 22.6, RW: 22.7, AM: 22.2, CM: 22.5, DM: 22.7 }
export const soccerWeightOf = (height, weight, role = 'ST') => (weight > 0 ? weight : height > 0 ? Math.round((ROLE_BMI[role] ?? 22.7) * height * height / 703) : 161)
export const soccerSizeGrade = (height, weight, role = 'ST') => {
  const g = (v, [lo, hi]) => Math.max(0, Math.min(11, (v - lo) / (hi - lo) * 11))
  const s = SOCCER_SIZE_SCALE
  return Math.round(g(soccerWeightOf(height, weight, role), s.lb) * s.w + g(height > 0 ? height : 71, s.in) * (1 - s.w))
}

// ── Saves from before the nine (2026-11-16) ─────────────────────────────────
// The ten old keys map onto the nine the same way the roster did: Off-Ball Movement is Positioning, Strength's
// place is Size, Link-Up Play's is Passing, and First Touch folds into Dribbling (half and half).
// Works on a build ({ trait: chip }), a ratings map ({ trait: grade }), a list of trait names, or anything that
// holds them (a career, a live season): every object with an old key is put right, all the way down.
export const SOCCER_OLD_KEYS = { offBall: 'positioning', linkUp: 'passing', strength: 'size', firstTouch: 'dribbling' }
const OLD_ONLY = ['offBall', 'linkUp', 'firstTouch']
const TRAIT_SET = new Set(SOCCER_TYPES)
const isTraitMap = o => OLD_ONLY.some(k => k in o) || ('strength' in o && Object.keys(o).some(k => TRAIT_SET.has(k) && k !== 'size'))
const blendVal = (d, t) => Math.round(0.5 * d + 0.5 * t)
function remapMap(o) {
  const out = {}
  for (const [k, v] of Object.entries(o)) { if (k === 'firstTouch') continue; out[SOCCER_OLD_KEYS[k] ?? k] = v }
  if ('firstTouch' in o) {
    const d = o.dribbling, t = o.firstTouch
    if (d == null) out.dribbling = t
    else if (typeof d === 'number' && typeof t === 'number') out.dribbling = blendVal(d, t)
    else if (d && typeof d === 'object' && typeof d.val === 'number' && typeof t?.val === 'number') out.dribbling = { ...d, val: blendVal(d.val, t.val) }
  }
  return out
}
const renameList = a => {
  if (!a.some(v => typeof v === 'string' && v in SOCCER_OLD_KEYS)) return a
  const out = []
  for (const v of a) { const n = typeof v === 'string' ? (SOCCER_OLD_KEYS[v] ?? v) : v; if (typeof n !== 'string' || !out.includes(n)) out.push(n) }
  return out
}
const TRAIT_FIELDS = new Set(['trait', 'slot', 'attr', 'type', 'durTrait'])
export function migrateSoccerKeys(x, depth = 0) {
  if (depth > 12 || x == null || typeof x !== 'object') return x
  if (Array.isArray(x)) { const a = renameList(x); const m = a.map(v => migrateSoccerKeys(v, depth + 1)); return m.every((v, i) => v === x[i]) && a.length === x.length ? x : m }
  let o = isTraitMap(x) ? remapMap(x) : x
  let changed = o !== x
  const next = {}
  for (const [k, v] of Object.entries(o)) {
    let n = v
    if (TRAIT_FIELDS.has(k) && typeof v === 'string' && v in SOCCER_OLD_KEYS) n = SOCCER_OLD_KEYS[v]
    else if (v && typeof v === 'object') n = migrateSoccerKeys(v, depth + 1)
    if (n !== v) changed = true
    next[k] = n
  }
  return changed ? next : x
}
export const hasOldSoccerKeys = x => { try { return /"(offBall|linkUp|firstTouch)"/.test(JSON.stringify(x)) } catch { return false } }
