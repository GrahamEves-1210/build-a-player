// Economy audit (read-only): every shop price as players see it, the Builder Pass
// tracks, achievements, coin packs. Run: node scripts/economy-audit.mjs
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const cos = await vite.ssrLoadModule('/src/lib/cosmetics.js')
  const pass = await vite.ssrLoadModule('/src/lib/pass.js')
  const coins = await vite.ssrLoadModule('/src/lib/coins.js')
  const ach = await vite.ssrLoadModule('/src/lib/achievements.js').catch(() => null)
  const { ITEMS, RARITY, forSale, UNLOCK_PRICE } = cos
  const R = r => RARITY[r].name
  const stats = list => { const p = list.map(i => i.price).sort((a, b) => a - b); return p.length ? `${p.length} items · ${p[0].toLocaleString()}–${p[p.length - 1].toLocaleString()} (median ${p[Math.floor(p.length / 2)].toLocaleString()})` : '—' }

  console.log('\n== Shop, for sale (coins), by rarity ==')
  for (let r = 0; r < 4; r++) console.log(`${R(r).padEnd(10)} ${stats(ITEMS.filter(i => forSale(i) && !i.pro && i.rarity === r))}`)
  console.log('\n== Pro Vault (needs BAP Pro AND coins) ==')
  for (const i of ITEMS.filter(i => i.pro)) console.log(`${i.id.padEnd(20)} ${i.name.padEnd(14)} ${R(i.rarity).padEnd(10)} ${i.price.toLocaleString()} coins`)
  console.log('\n== Unlocks ==', UNLOCK_PRICE)
  const sale = ITEMS.filter(i => forSale(i) && !i.pro)
  console.log('\n== Whole shop (everything for sale, not Pro) ==', sale.reduce((a, i) => a + i.price, 0).toLocaleString(), 'coins over', sale.length, 'items')

  console.log('\n== Builder Pass ==', pass.PASS_PRICE, `· ${pass.TIERS} tiers × ${pass.TIER_XP} XP = ${(pass.TIERS - 1) * pass.TIER_XP} XP to the last tier`)
  for (const s of pass.SEASONS) {
    for (const track of ['free', 'premium']) {
      const rs = Object.values(s[track])
      const c = rs.reduce((a, r) => a + (r.coins || 0), 0)
      const items = rs.filter(r => r.item).map(r => cos.itemById(r.item)).filter(Boolean)
      const itemValue = items.reduce((a, i) => a + (i.price || 0), 0)
      console.log(`${s.id} ${track.padEnd(8)} ${rs.length} rewards · ${c.toLocaleString()} coins · ${items.length} items (worth ${itemValue.toLocaleString()} coins at shop prices) · packs ${rs.filter(r => r.pack).map(r => r.pack).join('+') || 0} cards · boosts ${rs.filter(r => r.boost || r.rush || r.hot || r.heal || r.freeze).length}`)
    }
  }

  console.log('\n== Coin packs ==')
  for (const p of coins.COIN_PACKS) console.log(`${p.id.padEnd(16)} ${String(p.coins).padStart(6)} coins  $${p.usd}  → ${(p.coins / p.usd).toFixed(0)} coins per $1`)

  if (ach) {
    const list = ach.ACHIEVEMENTS ?? ach.default ?? []
    const total = list.reduce((a, x) => a + (x.coins || 0), 0), xp = list.reduce((a, x) => a + (x.xp || 0), 0)
    console.log(`\n== Achievements == ${list.length} · ${total.toLocaleString()} coins · ${xp.toLocaleString()} XP in all`)
  }
} finally { await vite.close() }
