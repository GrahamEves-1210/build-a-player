// A human on first base. He walks his lead out to what he's comfortable with (the better ones farther), then watches
// the pitcher. On the first move he reacts: a right-hander's knee up toward home is a go, his spin is a dive back; a
// lefty's leg comes up either way, so he waits to see the foot come down (a beat longer) unless he guesses. Now and
// then he guesses early (a slip) and goes before the move; once in a while he freezes and never goes.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const skill = Math.max(0, Math.min(1, (440 - human.react) / 225))
  const want = 3.0 + skill * 1.1 + gauss(r) * 0.25
  const out = []
  let seen = null, plan = null, guessAt = null, setSeen = null
  return () => {
    out.length = 0
    if (g.done || g.res) { out.push({ kind: 'stick', x: 0, y: 0 }); return out.slice() }
    // the lead
    if ((g.phase === 'lead' || g.phase === 'set') && g.goAt == null && !g.dive) {
      const d = want - g.lead
      out.push({ kind: 'stick', x: Math.abs(d) < 0.08 ? 0 : Math.max(-1, Math.min(1, d / 0.4)), y: 0 })
    } else out.push({ kind: 'stick', x: 0, y: 0 })
    if (g.phase === 'set' && setSeen !== g.setAt) { setSeen = g.setAt; guessAt = r() < human.slip * 1.6 ? g.setAt + g.hold - 60 - r() * 500 : null }
    if (guessAt != null && g.phase === 'set' && g.t >= guessAt) { guessAt = null; out.push({ kind: 'key', zone: 'S' }, { kind: 'keyup', zone: 'S' }); return out.slice() }
    if (g.moveAt != null && seen !== g.moveAt) {
      seen = g.moveAt
      const lefty = g.lefty, read = Math.max(140, human.react + gauss(r) * human.reactSd) + (lefty ? 230 - skill * 60 : 0)
      // a lefty's move fools some of them: they go on it
      const fooled = lefty && g.move !== 'home' && r() < 0.22 - skill * 0.12
      const goes = g.move === 'home' ? r() > 0.04 : fooled
      plan = { at: g.moveAt + read, key: goes ? 'S' : 'P' }
      if (g.move === 'home' && !goes) plan = null
    }
    if (plan && g.t >= plan.at) { out.push({ kind: 'key', zone: plan.key }, { kind: 'keyup', zone: plan.key }); plan = null }
    return out.slice()
  }
}
