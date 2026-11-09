// A human on the spot, on a keyboard (the arrows aim, SPACE runs up and strikes, E stutters). He picks a corner (now
// and then the middle), most go up to the ball and hit it; some stutter to make the keeper go and, if he does, switch
// to the other side. The power: he aims for about two thirds of the bar, off by his timing. The better players hold
// their aim back till the run-up (a keeper reads a taker staring at a corner) and try the timed finish.
const gauss = r => Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const after = () => Math.max(110, human.react + gauss(r) * human.reactSd)
  const sharp = human.react < 300
  let side = r() < 0.1 ? 0 : r() < 0.5 ? -1 : 1
  const high = r() < 0.3, stut = r() < 0.32, tryTimed = r() < (human.react < 250 ? 0.85 : human.react < 300 ? 0.6 : 0.25)
  const held = { L: 0, R: 0, U: 0, D: 0, S: 0, P: 0 }
  const out = []
  let goAt = null, relAt = null, stage = 'wait', aimAt = null, stutAt = null, sawDive = false, switchAt = null, tapAt = null
  const key = (k, d) => { if (d && !held[k]) { held[k] = 1; out.push({ kind: 'key', zone: k }) } else if (!d && held[k]) { held[k] = 0; out.push({ kind: 'keyup', zone: k }) } }
  const aim = s => { key('L', s < 0); key('R', s > 0); key('U', high) }
  return () => {
    out.length = 0
    if (g.done || g.res) { for (const k of Object.keys(held)) key(k, false); return out.length ? out.slice() : undefined }
    if (g.phase === 'set') return
    if (goAt == null) { goAt = g.t + after(); aimAt = sharp ? goAt + 350 : g.t + after() * 0.5 }
    if (aimAt != null && g.t >= aimAt) { aim(side); aimAt = null }
    if (stage === 'wait' && g.t >= goAt) {
      key('S', true); stage = 'run'
      relAt = g.t + (0.62 + gauss(r) * 0.05) * g.k.fill + gauss(r) * human.timing * 1.4
      if (stut) stutAt = g.t + 420 + r() * 300
    }
    if (stage === 'run') {
      if (relAt != null && g.t >= relAt) { key('S', false); relAt = null }
      if (stutAt != null && g.t >= stutAt) { key('P', true); stutAt = null; setTimeout0(() => key('P', false)) }
      if (held.P && g.t - (g.stutAt ?? g.t) > 60) key('P', false)
      // he's gone early: the other way
      if (!sawDive && g.kdive != null && g.struckAt == null) { sawDive = true; switchAt = g.t + after() * 0.9 }
      if (switchAt != null && g.t >= switchAt && g.struckAt == null) { side = g.kdive ? -g.kdive : side; aim(side); switchAt = null }
      if (g.k.phase === 'strike' && tapAt == null) tapAt = g.k.strikeAt + gauss(r) * human.timing * 1.2 + (r() < human.slip ? 120 : 0)
      if (tryTimed && tapAt != null && g.t >= tapAt && !held.S && g.k.phase === 'strike') { key('S', true); tapAt = Infinity }
      if (tapAt === Infinity && held.S && g.k.phase !== 'strike') key('S', false)
    }
    return out.length ? out.slice() : undefined
  }
}
const setTimeout0 = () => {}
