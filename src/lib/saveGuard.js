// Keeps leaderboards honest: decides whether a finished build's season may be
// saved. Three ways a build used to slip through:
//   1. the same build simulated again (a refresh restores a finished build, and
//      basketball's Back to Build re-sims it) — every run saved a new season
//   2. Sandbox "Add to build" hand-picks (real ratings, no spin): the sandbox
//      flag only lived in memory, so turning Sandbox off and refreshing cleared it
//   3. edited (custom) ratings, the same way
// Chips added from Sandbox carry `sandbox: true`, so the mark survives a refresh
// with the build; ratings are checked against the stock player data; and the
// builds this device has already saved are remembered.

const PLAYED_KEY = 'bap_played_builds'
const MAX_PLAYED = 100

// Who and what fills every slot, plus the mode: one season per fingerprint
export const buildSig = (mode, build, types) =>
  `${mode}|` + types.map(t => { const c = build?.[t]; return c ? `${t}:${c.qbFull || c.qb}/${c.team}/${c.val}` : `${t}:-` }).join('|')

const played = () => { try { const l = JSON.parse(localStorage.getItem(PLAYED_KEY) || '[]'); return Array.isArray(l) ? l : [] } catch { return [] } }
export const alreadyPlayed = sig => played().includes(sig)
export function markPlayed(sig) {
  try { localStorage.setItem(PLAYED_KEY, JSON.stringify([sig, ...played().filter(s => s !== sig)].slice(0, MAX_PLAYED))) } catch {}
}

// Any chip hand-picked from Sandbox
export const hasSandboxChip = (build, types) => types.some(t => build?.[t]?.sandbox)

// Any rating that isn't the player's stock rating (a custom rating). A player
// the pool doesn't know is let through: this only judges what it can check.
export function ratingsEdited(build, types, pool) {
  return types.some(t => {
    const c = build?.[t]
    if (!c) return false
    const name = c.qbFull || c.qb
    const p = pool.find(q => q.name === name && q.team === c.team) ?? pool.find(q => q.name === name)
    return !!p && p.attrs?.[t] != null && p.attrs[t] !== c.val
  })
}

// Why this season can't be saved (null = it can)
export function blockReason({ mode, build, types, pool, sandboxOn, tainted }) {
  if (sandboxOn || tainted || hasSandboxChip(build, types) || ratingsEdited(build, types, pool)) return 'sandbox'
  if (alreadyPlayed(buildSig(mode, build, types))) return 'played'
  return null
}
