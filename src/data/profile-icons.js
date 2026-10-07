// Profile icons (a PLUS perk). The profile pages show their own game's list;
// the id is saved in localStorage as `bap_profile_icon` and read wherever the
// avatar is drawn (profile pages, the navbar menu).
export const PROFILE_ICONS_NFL = [
  { id: 'trophy',   e: '🏆' }, { id: 'star',   e: '⭐' }, { id: 'football', e: '🏈' },
  { id: 'bolt',     e: '⚡' }, { id: 'crown',  e: '👑' }, { id: 'fire',     e: '🔥' },
  { id: 'gem',      e: '💎' }, { id: 'rocket', e: '🚀' }, { id: 'muscle',   e: '💪' },
  { id: 'skull',    e: '💀' }, { id: 'goat',   e: '🐐' },
]
export const PROFILE_ICONS_NBA = [
  { id: 'trophy',     e: '🏆' }, { id: 'star',   e: '⭐' }, { id: 'basketball', e: '🏀' },
  { id: 'bolt',       e: '⚡' }, { id: 'crown',  e: '👑' }, { id: 'fire',       e: '🔥' },
  { id: 'gem',        e: '💎' }, { id: 'rocket', e: '🚀' }, { id: 'muscle',     e: '💪' },
  { id: 'skull',      e: '💀' }, { id: 'goat',   e: '🐐' },
]
export const PROFILE_ICON_EMOJI = Object.fromEntries([...PROFILE_ICONS_NFL, ...PROFILE_ICONS_NBA].map(i => [i.id, i.e]))

/** Two letters from the username, the same way the profile page draws them */
export function initialsOf(name) {
  const n = name || ''
  const parts = n.split(/[\s@_.-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return n.slice(0, 2).toUpperCase()
}
