// Migrate NBA_PLAYERS to separate guard/big arrays with 10 slot-type attrs each
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const positions    = require('../src/data/nba-positions.json')
const measurements = require('../src/data/nba-measurements.json')

// ── Read current nba-players.js and extract the NBA_PLAYERS array ──────────────
const src = readFileSync('./src/data/nba-players.js', 'utf8')
// eval trick: grab just the NBA_PLAYERS array via regex + Function
const match = src.match(/export const NBA_PLAYERS\s*=\s*(\[[\s\S]*?\n\])/m)
if (!match) { console.error('Could not find NBA_PLAYERS'); process.exit(1) }
const players = eval(match[1])

// ── Slot types ─────────────────────────────────────────────────────────────────
const GUARD_TYPES = ['jumpShot','finishing','passing','handles','perimeterDefense','speed','bounce','size','basketballIQ','clutch']
const BIG_TYPES   = ['jumpShot','finishing','rebounding','playmaking','interiorDefense','speed','bounce','size','basketballIQ','clutch']

const GUARD_POS = new Set(['PG','SG','SF'])
const BIG_POS   = new Set(['PF','C'])

// ── Normalizers (same as BucketApp.jsx) ───────────────────────────────────────
const normH  = h  => (h  - 69) / 19 * 10 + 1
const normW  = w  => (w  - 160) / 150 * 9 + 1
const normWS = ws => (ws - 70) / 26 * 9 + 1

function derive(raw, pos, phys = {}) {
  const { speed=5, athleticism=5, size=5, shooting=5, handles=5, playmaking=5, defense=5, iq=5, leadership=5 } = raw
  const c = v => Math.min(11, Math.max(1, Math.round(v)))

  const hasPhys = phys.height && phys.weight && phys.wingspan
  const hScore  = hasPhys ? normH(phys.height)   : size * 0.90 + athleticism * 0.10
  const wsScore = hasPhys ? normWS(phys.wingspan) : size
  const wScore  = hasPhys ? normW(phys.weight)    : size * 0.50 + athleticism * 0.30 + (10 - speed) * 0.20
  const oldStr  = size * 0.50 + athleticism * 0.30 + (10 - speed) * 0.20

  const all = {
    jumpShot:         c(shooting * 0.70 + iq * 0.20 + playmaking * 0.10),
    finishing:        c(athleticism * 0.40 + speed * 0.30 + size * 0.15 + iq * 0.15),
    passing:          c(playmaking * 0.50 + iq * 0.30 + handles * 0.20),
    handles:          c(handles * 0.70 + speed * 0.20 + playmaking * 0.10),
    playmaking:       c(playmaking * 0.60 + iq * 0.25 + handles * 0.15),
    speed:            pos === 'big' ? c(speed * 0.85 + athleticism * 0.15 - 1.5) : c(speed * 0.85 + athleticism * 0.15),
    bounce:           pos === 'big' ? c(athleticism * 0.85 + speed * 0.05 - 1.5) : c(athleticism * 0.60 + speed * 0.40),
    size:             c(hScore * 0.60 + wsScore * 0.20 + wScore * 0.20),
    basketballIQ:     c(iq * 0.60 + leadership * 0.25 + playmaking * 0.15),
    perimeterDefense: c(defense * 0.60 + speed * 0.25 + athleticism * 0.15),
    interiorDefense:  c(defense * 0.55 + size * 0.30 + athleticism * 0.15),
    rebounding:       c(size * 0.50 + athleticism * 0.30 + defense * 0.20),
    clutch:           c(leadership * 0.60 + iq * 0.25 + playmaking * 0.15),
  }
  const types = pos === 'big' ? BIG_TYPES : GUARD_TYPES
  return Object.fromEntries(types.map(t => [t, all[t]]))
}

// ── Split and derive ───────────────────────────────────────────────────────────
const guards = []
const bigs   = []

for (const p of players) {
  const posData = positions[p.name]
  const pos     = posData?.pos ?? ''
  const phys    = measurements[p.name] ?? {}

  if (GUARD_POS.has(pos)) {
    guards.push({ ...p, attrs: derive(p.attrs, 'guard', phys) })
  } else if (BIG_POS.has(pos)) {
    bigs.push({ ...p, attrs: derive(p.attrs, 'big', phys) })
  } else {
    // Unknown position — default to guard
    guards.push({ ...p, attrs: derive(p.attrs, 'guard', phys) })
  }
}

// ── Format a player entry ──────────────────────────────────────────────────────
function fmt(p, types) {
  const attrsStr = types.map(t => `${t}:${p.attrs[t]}`).join(', ')
  return `  { name: "${p.name}", short: "${p.short}", team: '${p.team}', starter: ${p.starter}, captain: ${p.captain},\n    attrs: { ${attrsStr} } }`
}

// ── Read the full file and replace just the NBA_PLAYERS section ───────────────
const guardLines = guards.map(p => fmt(p, GUARD_TYPES)).join(',\n')
const bigLines   = bigs.map(p => fmt(p, BIG_TYPES)).join(',\n')

const newBlock = `export const NBA_GUARD_PLAYERS = [\n${guardLines}\n]

export const NBA_BIG_PLAYERS = [\n${bigLines}\n]

// Legacy combined array
export const NBA_PLAYERS = [...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS]`

// Replace the NBA_PLAYERS export block
const updated = src.replace(
  /export const NBA_PLAYERS\s*=\s*\[[\s\S]*?\n\]/m,
  newBlock
)

writeFileSync('./src/data/nba-players.js', updated, 'utf8')
console.log(`Done. Guards: ${guards.length}, Bigs: ${bigs.length}`)
