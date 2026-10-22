// The Builder Pass: a two-month season of rewards on the XP everyone already earns.
// Pure data (lib/progress.js keeps each player's place in it and pays the claims).
//
//   free     every other tier, for every signed-in player
//   premium  every tier, for players who bought this season's pass ($8.99, Stripe;
//            the webhook writes supabase pass_owners, see supabase/builder_pass.sql)
//
// A tier opens every TIER_XP of XP earned since the season started (missions, seasons,
// live games, the login: the same XP as levels). Rewards: coins, streak freezes, boosts
// (2x XP and Coin Rush for the next N seasons; Hot Hand and Quick Heal for Career;
// lib/progress.js BOOSTS), card packs and cosmetics. The
// cosmetics in a pass are pass-only (cosmetics.js marks them; never sold for coins).
// Keep the season ids and prices in step with server/server.js and functions/api.

export const TIER_XP = 500
export const TIERS = 30
export const PASS_PRICE = '$8.99'

const c = n => ({ coins: n })
const fz = () => ({ freeze: 1 })
const bx = n => ({ boost: n })
const pk = (n, min = 0) => ({ pack: n, min })
const i = id => ({ item: id })
const cr = n => ({ rush: n })      // Coin Rush: n × 3 hours of double coins from games, started when used
const hh = n => ({ hot: n })       // Hot Hand (Career)
const qh = n => ({ heal: n })      // Quick Heal (Career)

// tier → reward (tiers missing from the free track have nothing there)
const S1_FREE = {
  2: c(150), 4: i('av-whistle'), 6: fz(), 8: cr(1), 10: i('pl-chalk'), 12: pk(3), 14: c(250), 16: i('rs-chrome'),
  18: bx(3), 20: i('nc-turf'), 22: hh(1), 24: c(350), 26: i('ent-frost'), 28: pk(3, 1), 30: i('av-rivalry'),
}
const S1_PREMIUM = {
  1: i('av-storm'), 2: c(300), 3: i('nc-aurora'), 4: cr(1), 5: i('snd-nope'), 6: pk(3, 1), 7: i('nfx-frost'), 8: c(400),
  9: i('pl-neongrid'), 10: bx(3), 11: i('fx-shockwave'), 12: hh(2), 13: i('nc-pro-blackgold'), 14: c(500), 15: i('ent-glitch'),
  16: i('av-pro-blackgold'), 17: qh(2), 18: i('snd-train'), 19: pk(5, 2), 20: i('nfx-glitch'), 21: c(600), 22: i('pl-pro-blackgold'),
  23: cr(2), 24: i('fx-lightning'), 25: i('rs-vegas'), 26: c(700), 27: i('ent-fire'), 28: i('nc-pro-platinum'), 29: i('pl-galaxy'),
  30: i('ct-space'),
}

// start / end: days in New York time; the season runs from start up to (not including) end.
// Rewards already reached can still be claimed for CLAIM_DAYS after it ends.
export const SEASONS = [
  { id: 's1', name: 'Season 1', title: 'Opening Drive', start: '2026-10-21', end: '2026-12-21', free: S1_FREE, premium: S1_PREMIUM },
]
export const CLAIM_DAYS = 7

const addDays = (key, n) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export const seasonById = id => SEASONS.find(s => s.id === id) ?? null
// The season on now, or the one just ended while its claims are still open
export function passSeason(day) {
  return SEASONS.find(s => day >= s.start && day < addDays(s.end, CLAIM_DAYS)) ?? null
}
export const seasonOver = (s, day) => !!s && day >= s.end
// whole days until the season ends (it ends the morning of `end`)
export const daysLeft = (s, day) => Math.max(0, Math.round((Date.parse(`${s.end}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86400000))
export const daysLeftText = n => `${n} ${n === 1 ? 'DAY' : 'DAYS'} LEFT`
export const nextSeason = day => SEASONS.find(s => s.start > day) ?? null
export const tierAt = xp => Math.min(TIERS, 1 + Math.floor(Math.max(0, xp) / TIER_XP))
export const xpForTier = t => (t - 1) * TIER_XP
// Every pass cosmetic, with the season and tier it's on
export const PASS_ITEMS = Object.fromEntries(SEASONS.flatMap(s => ['free', 'premium'].flatMap(track =>
  Object.entries(s[track]).filter(([, r]) => r.item).map(([t, r]) => [r.item, { season: s.id, track, tier: +t }]))))
// What a season's premium track adds up to (the pitch on the buy button)
export function passValue(s) {
  const all = Object.values(s.premium)
  return { coins: all.reduce((a, r) => a + (r.coins || 0), 0), items: all.filter(r => r.item).length }
}
