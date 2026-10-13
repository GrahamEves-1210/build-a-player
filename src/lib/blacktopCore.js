// Blacktop's shared rules: the spots, the names, the auto-builds. Used by both
// versions of the 3v3 (the live server's and the phones-only one).
import { seeded, seededShuffle } from './rng'
import { buildFromPlayer } from './hoops'

export const ROOM_SIZE = 6
export const BUILD_SECS = 180
export const FILL_AFTER_SECS = 20
// Teams are named for their captains: the first human dealt to a side, else its first bot
export const captainOf = (match, t) => match?.players.find(p => p.team === t && !p.bot) ?? match?.players.find(p => p.team === t) ?? null
const firstName = p => (p ? p.name.trim().split(/\s+/)[0].toUpperCase().slice(0, 10) : null)
export function teamNames(match) {
  const caps = [captainOf(match, 0), captainOf(match, 1)]
  const names = caps.map((c, t) => firstName(c) ?? (t === 0 ? 'A' : 'B'))
  if (names[0] === names[1]) {
    // the same first name on both sides: the second squad goes by its next player
    const alt = match?.players.find(p => p.team === 1 && p !== caps[1])
    names[1] = firstName(alt) ?? `${names[1]} II`
    if (names[0] === names[1]) names[1] = `${names[1]} II`
  }
  return names.map(n => `TEAM ${n}`)
}
export const teamName = (match, t) => teamNames(match)[t]
export const ROLES = [
  { id: 'balanced', name: 'BALANCED', sub: 'Play your game' },
  { id: 'score', name: 'SCORER', sub: 'Shoot more, pass less' },
  { id: 'play', name: 'PLAYMAKER', sub: 'Find teammates' },
  { id: 'lock', name: 'LOCKDOWN', sub: 'Guard their best' },
]
export const BOT_NAMES = ['Smoke', 'Shifty', 'Glass', 'Sauce', 'Twitch', 'Hammer', 'Ghost', 'Blitz', 'Cash', 'Lefty', 'Rook', 'Stretch']

// Quick reactions on the court
export const EMOTES = ['🔥', '🧊', '💰', '😤', '👏', '😂']

// The lobby's six spots: every squad is two guards and a big
export const SLOTS = [
  { id: '0g0', team: 0, pos: 'guard' }, { id: '0g1', team: 0, pos: 'guard' }, { id: '0b', team: 0, pos: 'big' },
  { id: '1g0', team: 1, pos: 'guard' }, { id: '1g1', team: 1, pos: 'guard' }, { id: '1b', team: 1, pos: 'big' },
]
// 2v2: a guard and a big a side
export const SLOTS_2 = SLOTS.filter(sl => sl.id !== '0g1' && sl.id !== '1g1')
export const slotsFor = size => (size === 2 ? SLOTS_2 : SLOTS)
export const slotById = id => SLOTS.find(x => x.id === id) ?? null
// Who holds each spot: the earliest claim wins a tie (both see the same answer)
export function holders(list) {
  const out = {}
  for (const p of list) {
    if (!p.slot || !slotById(p.slot)) continue
    const cur = out[p.slot]
    if (!cur || (p.claim ?? 0) < (cur.claim ?? 0) || ((p.claim ?? 0) === (cur.claim ?? 0) && p.vid < cur.vid)) out[p.slot] = p
  }
  return out
}

// Deal six players into two teams: bigs spread first, then guards, snake order
export function dealTeams(players, seed) {
  const bigs = seededShuffle(players.filter(p => p.pos === 'big'), seed + 'b')
  const guards = seededShuffle(players.filter(p => p.pos !== 'big'), seed + 'g')
  const order = [...bigs, ...guards]
  const snake = [0, 1, 1, 0, 0, 1]
  return order.map((p, i) => ({ ...p, team: snake[i % 6] }))
}

export function makeBots(n, seed, startPos = 'guard') {
  const r = seeded(seed + 'bots')
  const names = seededShuffle(BOT_NAMES, seed)
  return Array.from({ length: n }, (_, i) => ({
    vid: `bot-${seed}-${i}`, name: names[i % names.length], uid: null, bot: true,
    pos: i % 3 === 0 ? (startPos === 'big' ? 'guard' : 'big') : r() < .35 ? 'big' : 'guard',
  }))
}

// Ratings off: fill what's missing with random players' real values — no optimising
export function autoBuild(partial, types, pool, seed) {
  const r = seeded(seed)
  const out = { ...(partial || {}) }
  for (const t of types) {
    if (out[t]) continue
    const pl = pool[Math.floor(r() * pool.length)]
    if (!pl) continue
    out[t] = buildFromPlayer(pl, [t], pl.photo ?? null)[t]
  }
  return out
}

export const leaderOf = list => [...list].filter(p => !p.bot).map(p => p.vid).sort()[0] ?? null

// A build from the room: every rating is 0-11, and a chip naming a real player
// carries that player's real number (nobody plays with made-up 11s)
export function buildOk(b, pool) {
  if (!b || typeof b !== 'object') return false
  for (const [t, chip] of Object.entries(b)) {
    if (!chip) continue
    const v = Number(chip.val)
    if (!(v >= 0 && v <= 11)) return false
    const pl = chip.qbFull ? pool.find(x => x.name === chip.qbFull) : null
    if (pl && pl.attrs?.[t] != null && pl.attrs[t] !== v) return false
  }
  return true
}
// the same picks (who, at what): the dealer can't swap anyone's build
export const samePicks = (a, b) => Object.keys({ ...a, ...b }).every(t => (a?.[t]?.qbFull ?? null) === (b?.[t]?.qbFull ?? null) && Number(a?.[t]?.val) === Number(b?.[t]?.val))

