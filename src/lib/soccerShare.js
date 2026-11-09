// A soccer build in a link: /soccer?b=… (the share sheet's link; SoccerApp opens it on the
// shared build page). Football's links are utils/shareUrl.js; soccer's need room for two pools
// and a bigger roster, so they're their own: 1 bit for the pool (Top Divisions / World Cup),
// 4 bits for the slot count, then per slot 4 (trait) + 4 (grade 0–11) + 10 (the player's
// place in his pool's roster, so his club or nation comes with him).
import { SOCCER_TYPES } from '../data/soccer-attrs'

function pack(fields) {
  const total = fields.reduce((n, [, bits]) => n + bits, 0)
  const bytes = new Uint8Array(Math.ceil(total / 8))
  let pos = 0
  for (const [val, bits] of fields) {
    for (let i = bits - 1; i >= 0; i--) {
      if ((val >> i) & 1) bytes[pos >> 3] |= 1 << (7 - (pos & 7))
      pos++
    }
  }
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function reader(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - (str.length % 4)) % 4)
  const bin = atob(padded)
  let pos = 0
  return bits => {
    let v = 0
    for (let i = bits - 1; i >= 0; i--) {
      const byte = bin.charCodeAt(pos >> 3) || 0
      if ((byte >> (7 - (pos & 7))) & 1) v |= 1 << i
      pos++
    }
    return v
  }
}

// pools: { current: [...players], alltime: [...players] } (SoccerApp's enriched rosters)
export function encodeSoccerBuild(build, types, pool, pools) {
  try {
    const list = pools[pool] ?? []
    const slots = types.filter(t => build[t]).map(t => {
      const c = build[t]
      const ti = SOCCER_TYPES.indexOf(t)
      const pi = list.findIndex(p => p.name === c.qbFull && p.team === c.team)
      if (ti < 0 || pi < 0 || pi > 1023) return null
      return [ti, Math.max(0, Math.min(11, Math.round(c.val ?? 0))), pi]
    })
    if (!slots.length || slots.includes(null)) return null
    return pack([[pool === 'alltime' ? 1 : 0, 1], [slots.length, 4], ...slots.flatMap(([ti, v, pi]) => [[ti, 4], [v, 4], [pi, 10]])])
  } catch { return null }
}

export function decodeSoccerBuild(code, pools, photoOf) {
  try {
    const read = reader(code)
    const pool = read(1) ? 'alltime' : 'current'
    const n = read(4)
    const list = pools[pool] ?? []
    const build = {}, types = []
    for (let i = 0; i < n; i++) {
      const t = SOCCER_TYPES[read(4)], val = read(4), p = list[read(10)]
      if (!t || !p) return null
      build[t] = { type: t, val, qb: p.short ?? p.name, qbFull: p.name, team: p.team, teamColor: p.color, teamColor2: p.color2, skinColor: p.skin, number: p.number, photo: photoOf(p), height: p.height ?? null, weight: p.weight ?? null }
      types.push(t)
    }
    return types.length ? { build, types, pool } : null
  } catch { return null }
}
