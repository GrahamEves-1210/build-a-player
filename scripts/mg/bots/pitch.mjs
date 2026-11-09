// A human on the mound (Strike Him Out, Escape the Jam, the pitcher's showcase). Between pitches he picks one (he goes
// with the catcher's sign most of the time) and a spot for it the way a pitcher thinks: with two strikes off the plate
// (the slider down and away, the changeup in the dirt, the fastball up), ahead on the edges, behind in the zone; the
// smarter ones stay out of the hitter's hot zone and work his cold one. He steers the glove there with the stick (off by
// his aim), holds PITCH for the effort he wants (just under the red line; flat out on the gun) off by his timing, and
// taps the release as the ring closes, off by his timing again.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
const KEYS = ['FB', 'SL', 'CH']
export default function makeBot(g, human, r) {
  const skill = Math.max(0, Math.min(1, (440 - human.react) / 225))
  const out = []
  let pid = -1, plan = null
  const key = (k, d) => out.push({ kind: d ? 'key' : 'keyup', zone: k })
  return () => {
    out.length = 0
    if (g.done || g.res) { out.push({ kind: 'stick', x: 0, y: 0 }); return out.length ? out.slice() : undefined }
    const id = `${g.n}|${g.bi}`
    if (g.phase === 'set' && pid !== id) {
      pid = id
      const B = g.batters[g.bi]?.prof, { b, s } = g.count
      let type = g.drill ? g.type : r() < 0.7 ? g.sign : KEYS[Math.floor(r() * 3)]
      const away = B ? (B.hand > 0 ? 1 : -1) : 1
      let to
      if (g.game === 'bullpen') to = { ...g.target }
      else if (g.game === 'pitch-velo') to = { x: 0, y: 0.78 }
      else if (g.game === 'spin') to = { x: away * 0.15, y: 0.6 }
      else if (s === 2 && r() < 0.65) to = type === 'SL' ? { x: away * 0.33, y: 0.38 } : type === 'CH' ? { x: away * 0.12, y: 0.32 } : { x: away * 0.08, y: 1.2 }
      // (behind in the count with them loaded, nobody nibbles: in the zone)
      else if (b >= 2 && b > s && g.bases.on.every(Boolean)) to = { x: (r() - 0.5) * 0.2, y: 0.66 + r() * 0.22 }
      else if (s > b || r() < 0.55) to = { x: (r() < 0.5 ? -1 : 1) * 0.19, y: r() < 0.5 ? 0.58 : 0.98 }
      else to = { x: (r() - 0.5) * 0.24, y: 0.62 + r() * 0.3 }
      // the scouting report: the better ones keep it out of his hot zone
      if (B && !g.drill && r() < skill * 0.6) {
        const hotUp = B.hot.startsWith('up'), hotIn = B.hot.endsWith('in')
        if (hotUp && to.y > 0.85) to.y = 0.6
        if (!hotUp && to.y < 0.7 && B.hot.startsWith('down')) to.y = 0.98
        if (hotIn && Math.sign(to.x) === -away) to.x = away * Math.abs(to.x)
      }
      const ae = g.game === 'bullpen' ? 0.02 - 0.008 * skill : (0.05 - 0.025 * skill)
      to = { x: Math.max(-0.53, Math.min(0.53, to.x + gauss(r) * ae)), y: Math.max(0.22, Math.min(1.38, to.y + gauss(r) * ae)) }
      const want = g.game === 'pitch-velo' ? 0.96 : g.game === 'spin' ? 0.84 : 0.8
      plan = { type, to, want, readyAt: Math.max(g.at + 320, g.t + Math.max(250, human.react * 1.4 + gauss(r) * human.reactSd)), held: false, relAt: null, tapAt: null, tapped: false }
    }
    if (!plan) return
    if (g.phase === 'set') {
      // pick the pitch (E cycles), then steer the glove to the spot
      if (!g.drill && g.type !== plan.type && g.t % 120 < 9) key('P', true), key('P', false)
      const dx = plan.to.x - g.aim.x, dy = plan.to.y - g.aim.y, k = 0.08
      out.push({ kind: 'stick', x: Math.abs(dx) < 0.01 ? 0 : Math.max(-1, Math.min(1, dx / k)), y: Math.abs(dy) < 0.01 ? 0 : Math.max(-1, Math.min(1, dy / k)) })
      if (g.t >= plan.readyAt && Math.hypot(dx, dy) < 0.03 && (g.drill || g.type === plan.type) && !plan.held) {
        key('S', true); plan.held = true
        plan.relAt = g.t + g.k.fill * plan.want + gauss(r) * human.timing * 1.3
      }
      return out.length ? out.slice() : undefined
    }
    out.push({ kind: 'stick', x: 0, y: 0 })
    if (g.k.phase === 'power' && plan.relAt != null && g.t >= plan.relAt) { key('S', false); plan.relAt = null }
    if (g.k.phase === 'deliver' && plan.tapAt == null) plan.tapAt = g.k.strikeAt + gauss(r) * human.timing * 1.2 + (r() < human.slip ? 90 : 0)
    if (g.k.phase === 'deliver' && !plan.tapped && g.t >= plan.tapAt) { key('S', true); key('S', false); plan.tapped = true }
    return out.length ? out.slice() : undefined
  }
}
