// A baseball build in a link: /baseball?b=… (the share sheet's link; BaseballApp opens it on the shared
// build page). Like soccer's (lib/soccerShare.js), with room for the two positions and the two pools:
// 1 bit for the position (batter / pitcher), 1 for the pool (current / all-time), 4 for the slot count,
// then per slot 4 (trait) + 4 (grade 0–11) + 10 (the player's place in his pool's roster, so his team
// comes with him).
import { BASEBALL_KEYS } from './baseballUi'

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

// pools: { bat: { current: [...], alltime: [...] }, pit: { … } } (BaseballApp's enriched rosters)
export function encodeBaseballBuild(build, types, pos, pool, pools) {
  try {
    const keys = BASEBALL_KEYS[pos]
    const list = pools[pos]?.[pool] ?? []
    const slots = types.filter(t => build[t]).map(t => {
      const c = build[t]
      const ti = keys.indexOf(t)
      const pi = list.findIndex(p => p.name === c.qbFull && p.team === c.team)
      if (ti < 0 || pi < 0 || pi > 1023) return null
      return [ti, Math.max(0, Math.min(11, Math.round(c.val ?? 0))), pi]
    })
    if (!slots.length || slots.includes(null)) return null
    return pack([[pos === 'pit' ? 1 : 0, 1], [pool === 'alltime' ? 1 : 0, 1], [slots.length, 4], ...slots.flatMap(([ti, v, pi]) => [[ti, 4], [v, 4], [pi, 10]])])
  } catch { return null }
}

// chipOf(player, trait, grade): the build's chip for a player (BaseballApp's, so the photo and hands come with it)
export function decodeBaseballBuild(code, pools, chipOf) {
  try {
    const read = reader(code)
    const pos = read(1) ? 'pit' : 'bat'
    const pool = read(1) ? 'alltime' : 'current'
    const n = read(4)
    const keys = BASEBALL_KEYS[pos]
    const list = pools[pos]?.[pool] ?? []
    const build = {}, types = []
    for (let i = 0; i < n; i++) {
      const t = keys[read(4)], val = read(4), p = list[read(10)]
      if (!t || !p) return null
      build[t] = chipOf(p, t, val)
      types.push(t)
    }
    return types.length ? { build, types, pos, pool } : null
  } catch { return null }
}
