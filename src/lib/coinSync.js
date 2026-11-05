// The coin wallet's sync rule. Coins move by what changed on this device since the last sync, so
// the one thing that has to be right is the base: the account's coins that this device's count
// already includes. Get it wrong and a purchase is charged again (or a win paid again) on the next sync.

// Before a save goes out, what it's writing and what it was built on is kept on the device, so
// a save whose answer never came back (the app closed, the network dropped) can still be settled.
export const pendingOf = (rev, prev, coins) => ({ rev, prev: prev ?? null, coins })

// The base to use against the account's wallet w, given the save (if any) still unsettled.
export function baseFor(synced, pending, w) {
  if (!pending) return synced
  // still the wallet the save was built on: it never landed
  if ((w.rev ?? null) === pending.prev) return synced
  // it landed, and this is it. Its coins may be lower than we sent (the server caps a save's gain):
  // what was cut stays in this device's count and goes out with the next save
  if (w.rev === pending.rev) return w.coins
  // another device has saved since. Its save was built on ours if ours landed, which is by far
  // the likelier: count ours as in. (At worst one change is dropped; it's never applied twice.)
  return pending.coins
}

// This device's coins after merging the account's wallet
export const mergedCoins = (mine, base, w) => Math.max(0, w.coins + (mine - base))
