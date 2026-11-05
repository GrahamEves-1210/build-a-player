// Read-only check of the coin sync rule against a fake account, no database. node scripts/coin-sync-check.mjs
import { baseFor, mergedCoins, pendingOf } from '../src/lib/coinSync.js'

// a device and an account, with the sync as lib/progress.js runs it. fixed=false is the old rule.
function world(start, fixed, cap = Infinity) {
  const acct = { coins: start, rev: 'r0' }
  const dev = () => ({ coins: start, synced: start, pending: null })
  let n = 0
  const merge = d => {
    const base = fixed ? baseFor(d.synced, d.pending, acct) : d.synced
    d.pending = null
    d.coins = fixed ? mergedCoins(d.coins, base, acct) : Math.max(0, acct.coins + (d.coins - base))
    d.synced = acct.coins
  }
  // landed: does the write reach the account. answered: does the device hear back and live to record it.
  const push = (d, { landed = true, answered = true } = {}) => {
    merge(d)
    const rev = `r${++n}`, sent = d.coins, prev = acct.rev
    if (fixed) d.pending = pendingOf(rev, prev, sent)
    if (landed) { acct.coins = Math.min(sent, acct.coins + cap); acct.rev = rev }
    if (answered && landed) { d.synced = fixed ? acct.coins : sent; d.pending = null }
  }
  return { acct, dev, merge, push }
}

const cases = {
  'buy 600, close the app before the save answers': (w, a) => { a.coins -= 600; w.push(a, { answered: false }); w.merge(a); return [a.coins, 400] },
  'buy 600, network drops, save never landed': (w, a) => { a.coins -= 600; w.push(a, { landed: false, answered: false }); w.merge(a); w.push(a); return [w.acct.coins, 400] },
  'buy 600 normally': (w, a) => { a.coins -= 600; w.push(a); w.merge(a); return [a.coins, 400] },
  'win 100, close the app before the save answers': (w, a) => { a.coins += 100; w.push(a, { answered: false }); w.merge(a); return [a.coins, 1100] },
  'buy 600 and close, a second device saves first': (w, a) => { const b = w.dev(); a.coins -= 600; w.push(a, { answered: false }); b.coins += 50; w.push(b); w.merge(a); return [a.coins, 450] },
  'two devices, each spends and earns': (w, a) => { const b = w.dev(); a.coins -= 300; b.coins += 50; w.push(a); w.push(b); w.merge(a); return [a.coins, 750] },
  'server caps a 7000 gain at 6000': (w, a) => { a.coins += 7000; w.push(a); w.merge(a); return [a.coins, 8000] },
}
let bad = 0
for (const [name, run] of Object.entries(cases)) {
  const cap = name.includes('caps') ? 6000 : Infinity
  const o = world(1000, false, cap), f = world(1000, true, cap)
  const [was, want] = run(o, o.dev()), [now] = run(f, f.dev())
  if (now !== want) bad++
  console.log(`${now === want ? 'ok  ' : 'FAIL'} ${name}: should be ${want}, old rule ${was}, new rule ${now}`)
}
process.exit(bad ? 1 : 0)
