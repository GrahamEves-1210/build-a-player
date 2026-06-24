import { TEAMS, QBS, TYPES } from '../data/qbs'
import HEADSHOTS from '../data/headshots.json'

const QB_IDX   = Object.fromEntries(QBS.map((q, i) => [q.name, i]))
const TEAM_IDX = Object.fromEntries(TEAMS.map((t, i) => [t.short, i]))

// Bit layout per slot: 4(typeIdx) + 4(val) + 5(teamIdx) + 8(qbIdx) = 21 bits
// Header: 4 bits for slot count. Total for 9 slots: 4 + 189 = 193 bits → 25 bytes → ~34 base64 chars

function encode(slots) {
  const totalBits = 4 + slots.length * 21
  const bytes = new Uint8Array(Math.ceil(totalBits / 8))
  let pos = 0

  function write(val, bits) {
    for (let i = bits - 1; i >= 0; i--) {
      const b = (val >> i) & 1
      if (b) bytes[Math.floor(pos / 8)] |= 1 << (7 - (pos % 8))
      pos++
    }
  }

  write(slots.length, 4)
  for (const [ti, val, mi, qi] of slots) {
    write(ti, 4); write(val, 4); write(mi, 5); write(qi, 8)
  }

  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
    '==='.slice(0, (4 - (str.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

  let pos = 0
  function read(bits) {
    let val = 0
    for (let i = bits - 1; i >= 0; i--) {
      if ((bytes[Math.floor(pos / 8)] >> (7 - (pos % 8))) & 1) val |= 1 << i
      pos++
    }
    return val
  }

  const count = read(4)
  const slots = []
  for (let i = 0; i < count; i++) {
    slots.push([read(4), read(4), read(5), read(8)])
  }
  return slots
}

export function encodeBuild(build, types) {
  try {
    const slots = types.filter(t => build[t]).map(t => {
      const d = build[t]
      const ti = TYPES.indexOf(t)
      const qi = QB_IDX[d.qbFull]
      const mi = TEAM_IDX[d.team]
      if (ti === -1 || qi == null || mi == null) return null
      return [ti, d.val, mi, qi]
    })
    if (!slots.length || slots.includes(null)) return null
    return encode(slots)
  } catch { return null }
}

export function decodeBuild(encoded) {
  try {
    const slots = decode(encoded)
    if (!slots.length) return null
    const build = {}
    const decodedTypes = []
    for (const [ti, val, mi, qi] of slots) {
      const t    = TYPES[ti]
      const qb   = QBS[qi]
      const team = TEAMS[mi]
      if (!t || !qb || !team) return null
      build[t] = {
        val,
        team:      team.short,
        qbFull:    qb.name,
        teamColor: team.color,
        photo:     HEADSHOTS[qb.name] ? `/headshots/${HEADSHOTS[qb.name]}.jpg` : null,
      }
      decodedTypes.push(t)
    }
    return { build, types: decodedTypes }
  } catch { return null }
}

export function buildShareUrl(build, types) {
  const encoded = encodeBuild(build, types)
  if (!encoded) return window.location.origin
  return `${window.location.origin}/?b=${encoded}`
}
