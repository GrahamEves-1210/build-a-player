// The development ladder by age: what offseason work can still raise. The body closes first
// (the sport's trainUntil, career.js), then the technique, and the mental side never closes: a
// 36-year-old quarterback can still sharpen his accuracy, his reads before and after the snap
// and his leadership, and nothing else. Each window is a ramp, not a cliff: past its full years
// a trait still goes up at double the cost (the physical traits for a year, the technique for
// two), then it shuts.
//   phys : physical traits on top of SPORT[sport].physical[pos] (those fade with age; these don't)
//   tech : the technique, trained at full cost through techAt[0] and at double through techAt[1]
//   fixed: never trained at all (a lineman's frame, his arm length: career.js canUpgrade says so)
//   (every other trait is the mental side: always open)
// A position missing here keeps the old rule: the physical traits until trainUntil, the rest any time.
export const LADDER = {
  nfl: {
    qb: { phys: ['size'], tech: ['playmaking', 'pocket-presence'], techAt: [32, 34] },
    rb: { phys: ['size', 'strength'], tech: ['balance', 'hands', 'carrying'], techAt: [28, 30] },
    wr: { phys: ['size'], tech: ['bodyControl', 'routeRunning', 'release', 'hands'], techAt: [30, 32] },
    te: { phys: ['size', 'afterCatch'], tech: ['blocking', 'routeRunning', 'hands'], techAt: [30, 32] },
    db: { phys: ['size'], tech: ['press', 'hands', 'manCoverage', 'runSupport'], techAt: [29, 31] },
    dl: { fixed: ['size'], phys: ['strength'], tech: ['powerMoves', 'finesseMoves', 'blockShed'], techAt: [31, 33] },
    lb: { fixed: ['size'], phys: [], tech: ['tackling', 'blockShed', 'passRush'], techAt: [30, 32] },
    ol: { fixed: ['size', 'length'], phys: [], tech: ['passPro', 'runBlock', 'pancake'], techAt: [31, 33] },
  },
  bucket: {
    guard: { phys: ['size'], tech: ['finishing', 'handles', 'perimeterDefense'], techAt: [31, 33] },
    big: { phys: ['size'], tech: ['finishing', 'rebounding', 'interiorDefense'], techAt: [31, 33] },
  },
  soccer: {
    st: { phys: [], tech: ['shotPower', 'heading', 'dribbling', 'firstTouch'], techAt: [30, 32] },
  },
  baseball: {
    bat: { phys: [], tech: ['contact', 'power', 'gap', 'fielding'], techAt: [33, 35] },
    pit: { phys: [], tech: ['movement', 'breaking', 'changeup', 'groundball'], techAt: [33, 35] },
  },
}
// a physical trait's last year, past trainUntil, at double the cost
export const PHYS_RAMP = 1

// 'phys' | 'tech' | 'mind' | 'fixed' (null: no ladder for this position, and not a physical trait)
export function ladderTier(sport, pos, type, physical = []) {
  const L = LADDER[sport]?.[pos]
  if (L?.fixed?.includes(type)) return 'fixed'
  if (physical.includes(type) || L?.phys.includes(type)) return 'phys'
  if (!L) return null
  return L.tech.includes(type) ? 'tech' : 'mind'
}
// The window a trait trains in: { tier, open, late (double cost), left (offseasons incl. this one), until (the last age), full }
// or null (the mental side: no window)
export function ladderWindow(sport, pos, age, type, physical, trainUntil) {
  const tier = ladderTier(sport, pos, type, physical)
  if (!tier || tier === 'mind' || tier === 'fixed') return null
  const L = LADDER[sport]?.[pos]
  const [full, until] = tier === 'tech' ? L.techAt : [trainUntil, trainUntil + (L ? PHYS_RAMP : 0)]
  return { tier, full, until, open: age <= until, late: age > full && age <= until, left: Math.max(0, until - age + 1) }
}
// "Long Speed" → "long speed", "Basketball IQ" → "basketball IQ", "Awareness/Grit" → "awareness"
export const lowLabel = s => String(s ?? '').split('/')[0].split(' ').map(w => (w.length <= 2 && w === w.toUpperCase() ? w : w.toLowerCase())).join(' ')
export const andList = a => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0] ?? '')
// the traits still open for good (the mental side), lower-case, as a list
export const mindTraits = (sport, pos, types, physical) => types.filter(t => ladderTier(sport, pos, t, physical) === 'mind')

// Why a closed trait won't go up, in a line
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
export function closedLine(sport, age, tier, label, mindList, until) {
  return `${cap(lowLabel(label))} can't be trained after age ${until}. He's ${age}.${tier === 'tech' && mindList ? ` ${cap(mindList)} still can.` : ''}`
}
export const lateLine = (age, label, cost, pts) => `${cap(lowLabel(label))}: ${cost} points at his age (double cost). ${pts} left.`
