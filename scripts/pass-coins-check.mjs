// The Builder Pass bought with coins (lib/progress.js buyPassCoins, supabase/pass_coins.sql), checked
// without a database: the price is the same number in the game and in the SQL, and the wallet sync
// charges the coins exactly once whatever was in flight. node scripts/pass-coins-check.mjs
import { readFileSync } from 'node:fs'
import { afterServerSpend, baseFor, mergedCoins, pendingOf } from '../src/lib/coinSync.js'
import { PASS_COINS, SEASONS } from '../src/lib/pass.js'

let bad = 0
const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: should be ${JSON.stringify(want)}, is ${JSON.stringify(got)}`) }

// ── the price and the seasons, game against SQL ──
const sql = readFileSync(new URL('../supabase/pass_coins.sql', import.meta.url), 'utf8')
check('the SQL price is PASS_COINS', +(sql.match(/price constant int := (\d+);/)?.[1] ?? NaN), PASS_COINS)
const rows = [...sql.matchAll(/\('(\w+)', date '([\d-]+)', date '([\d-]+)'\)/g)].map(m => [m[1], m[2], m[3]])
check('the SQL seasons are the game\'s', rows, SEASONS.map(s => [s.id, s.start, s.end]))

// ── the sync: a device and an account, as lib/progress.js runs them ──
const P = PASS_COINS
function world(start) {
  const acct = { coins: start, rev: 'r0' }
  const dev = () => ({ coins: start, synced: start, pending: null })
  let n = 0
  const merge = d => {
    const base = baseFor(d.synced, d.pending, acct)
    d.pending = null
    d.coins = mergedCoins(d.coins, base, acct)
    d.synced = acct.coins
  }
  const push = (d, { landed = true, answered = true, cap = Infinity } = {}) => {
    merge(d)
    const rev = `r${++n}`, sent = d.coins, prev = acct.rev
    d.pending = pendingOf(rev, prev, sent)
    if (landed) { acct.coins = Math.min(sent, acct.coins + cap); acct.rev = rev }
    if (answered && landed) { d.synced = acct.coins; d.pending = null }
  }
  // the server's purchase (pass_coins.sql): coins off, a new rev; the device hears back or doesn't
  const buy = (d, { answered = true } = {}) => {
    if (acct.coins < P) return false
    const was = { rev: acct.rev, coins: acct.coins }
    acct.coins -= P; acct.rev = `pass-${++n}`
    if (answered) { d.coins = afterServerSpend(d.coins, d.synced, d.pending, was, acct.coins); d.pending = null; d.synced = acct.coins }
    return true
  }
  return { acct, dev, merge, push, buy }
}
const end = (w, a) => { w.push(a); w.merge(a); return [a.coins, w.acct.coins] }   // the next save and sync: device, account

const cases = {
  'buy with 20,000': [20000, (w, a) => { w.buy(a); return end(w, a) }, [4000, 4000]],
  'a 300 win the account never got (its save failed), then buy': [20000, (w, a) => { a.coins += 300; w.push(a, { landed: false, answered: false }); w.buy(a); return end(w, a) }, [4300, 4300]],
  'a 500 win saved but never answered, then buy': [20000, (w, a) => { a.coins += 500; w.push(a, { answered: false }); w.buy(a); return end(w, a) }, [4500, 4500]],
  'a 600 item bought while the purchase is out': [20000, (w, a) => { w.buy(a); a.coins -= 600; return end(w, a) }, [3400, 3400]],
  'the purchase lands but its answer is lost': [20000, (w, a) => { w.buy(a, { answered: false }); return end(w, a) }, [4000, 4000]],
  'answer lost, with a 200 win waiting on the device': [20000, (w, a) => { a.coins += 200; w.buy(a, { answered: false }); return end(w, a) }, [4200, 4200]],
  'answer lost, after a 500 win saved but never answered': [20000, (w, a) => { a.coins += 500; w.push(a, { answered: false }); w.buy(a, { answered: false }); return end(w, a) }, [4500, 4500]],
  'a second device spends 600 on the old wallet, then syncs': [20000, (w, a) => { const b = w.dev(); b.coins -= 600; w.buy(a); w.push(b); return end(w, a) }, [3400, 3400]],
  'a second device that never heard of it does not put the coins back': [20000, (w, a) => { const b = w.dev(); w.buy(a); w.push(b); w.merge(b); return [b.coins, w.acct.coins] }, [4000, 4000]],
  'the server trims a 7,000 gain to 6,000, then buy': [10000, (w, a) => { a.coins += 7000; w.push(a, { cap: 6000 }); w.buy(a); return end(w, a) }, [1000, 1000]],
  'the account is short (15,000 saved, 1,500 only on the device): refused, nothing moves': [15000, (w, a) => { a.coins += 1500; const went = w.buy(a); return [went, a.coins, w.acct.coins] }, [false, 16500, 15000]],
  'a device that has never synced takes the account\'s coins': [20000, (w, a) => { a.synced = null; w.buy(a); return [a.coins, a.synced] }, [4000, 4000]],
}
for (const [name, [start, run, want]] of Object.entries(cases)) { const w = world(start); check(name, run(w, w.dev()), want) }
process.exit(bad ? 1 : 0)
