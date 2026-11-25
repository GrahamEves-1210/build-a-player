// Simulate Season's team spin counts the moment it starts. The team is dealt when SPIN is pressed and kept
// with the build, so switching to Pick mid-spin, closing the sheet or reloading can't throw it away:
// the wheel comes back to the same team. (Players were tapping Pick just before the wheel stopped,
// then Spin again, for as many spins as they liked: the spin offers every team, Pick only the build's.)
// Only kept where it matters: a build whose spin offers teams Pick doesn't (Sandbox, Squad Builder
// and the like can pick any team anyway).
const KEY = 'bap_team_spin'

// The build (who fills each slot) and the picker it's spun in
export function teamSpinSig(scope, build, teams) {
  const cards = Object.entries(build ?? {}).filter(([, c]) => c)
  if (!cards.length) return null
  return `${scope}#${teams.length}#` + cards.map(([k, c]) => `${k}:${c.qbFull || c.qb || c.name || ''}/${c.team ?? ''}/${c.school ?? ''}/${c.val ?? ''}`).sort().join('|')
}

// The team this build's spin already dealt (null: none yet)
export function readTeamSpin(sig, teams) {
  if (!sig) return null
  try {
    const r = JSON.parse(localStorage.getItem(KEY))
    return r?.sig === sig ? teams.find(t => t.short === r.short) ?? null : null
  } catch { return null }
}

export function saveTeamSpin(sig, team) {
  if (!sig || !team) return
  try { localStorage.setItem(KEY, JSON.stringify({ sig, short: team.short })) } catch {}
}

// The spin's team: the one already dealt, or a new deal (saved before the wheel turns)
export function dealTeamSpin(sig, teams) {
  const kept = readTeamSpin(sig, teams)
  if (kept) return kept
  const team = teams[Math.floor(Math.random() * teams.length)]
  saveTeamSpin(sig, team)
  return team
}
