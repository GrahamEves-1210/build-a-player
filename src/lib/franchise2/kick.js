// FRANCHISE: the kicker. One on every roster (the NFL's way: no backup kicker on the 53), rated the way K mode
// rates him (src/data/ks.js): POWER, ACCURACY and CLUTCH on the 0-11 scale.
//
//   kickTraits(F, p)   [power, accuracy, clutch] for any man at K: a build's own, a real man's (moved by how far his
//                      OVR has come since the data), a drafted or made-up man's fitted to his OVR
//   kickerOf(F, short) the man kicking for a team this week (the depth chart's K, the next healthy one)
//   addKickStats(F, S) a finished game's kicks into the season's lines (F.kst; regular season only)
//
// What the ratings do in a game (game.js fgChance, xpChance, kickRange): ACCURACY moves every make chance, POWER
// moves the long ones and how far out his coach sends him, CLUTCH moves the kicks late in a close game. Centred
// on the league's kicker in 2026 (K_MID: the 32 starters' average), so the league kicks what the NFL kicks.
import { realOf } from './league'
import { startersOf } from './roster'
import { ratingsOf } from './draft'
import { clamp } from './rng'

// a K's rating on the 0-11 scale from his OVR (ks.js kOVR turned around: 60 + 2.1a + 0.21a², the top half above 88)
export function kValOfOvr(o) {
  const base = o > 88 ? 88 + (o - 88) / 0.54 : o
  return clamp(0, 11, (-2.1 + Math.sqrt(Math.max(0, 4.41 + 0.84 * (base - 60)))) / 0.42)
}
const K3 = ['power', 'accuracy', 'clutch']
export function kickTraits(F, p) {
  if (!p) return null
  if (p.b != null) { const b = F.builds?.[p.b]?.build ?? {}; return K3.map(t => (typeof b[t]?.val === 'number' ? b[t].val : 5)) }
  const real = !p.a ? realOf('k', p.n) : null
  if (real?.attrs) {
    const shift = kValOfOvr(p.o) - kValOfOvr(real.o)
    return K3.map(t => Math.round(clamp(0, 11, (real.attrs[t] ?? 5) + shift) * 10) / 10)
  }
  const r = ratingsOf(p)
  return K3.map(t => r?.[t]?.val ?? kValOfOvr(p.o))
}
// the man who kicks for a team (his chart's K; a hurt one sits)
export const kickerOf = (F, short) => startersOf(F, short).k1 ?? null

// The game's kicking lines into the season: F.kst { [id]: { gp, fga, fgm, xpa, xpm, lg, a50, m50 } }
// (S.kk: the game's own tally by side, game.js; S.G.kid: who kicked for each side)
export function addKickStats(F, S) {
  if (F.phase === 'playoffs' || !S?.G?.kid) return
  const all = F.kst ?? (F.kst = {})
  for (const side of ['h', 'a']) {
    const id = S.G.kid[side]
    if (id == null) continue
    const k = S.kk?.[side] ?? [0, 0, 0, 0, 0, 0, 0]
    const t = all[id] ?? (all[id] = { gp: 0, fga: 0, fgm: 0, xpa: 0, xpm: 0, lg: 0, a50: 0, m50: 0 })
    t.gp++; t.fga += k[0]; t.fgm += k[1]; t.xpa += k[2]; t.xpm += k[3]; t.lg = Math.max(t.lg, k[4]); t.a50 += k[5]; t.m50 += k[6]
  }
}
// a game's kicking line the way a box score writes it: "2/3 FG · 4/4 XP · LONG 51"
export function kickLine(k) {
  if (!k) return ''
  const [fga, fgm, xpa, xpm, lg] = k
  return [fga ? `${fgm}/${fga} FG` : null, xpa ? `${xpm}/${xpa} XP` : null, fgm && lg ? `LONG ${lg}` : null].filter(Boolean).join(' · ')
}
