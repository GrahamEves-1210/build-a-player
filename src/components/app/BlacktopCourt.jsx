import { useEffect, useRef, useState } from 'react'
import QBAvatar from '../QBAvatar'

// The Blacktop court: six players and a ball, choreographed from the play the
// engine wrote — who checked it up, each pass, the drive or the pull-up, the
// defender on the shooter, the swat, the board. Same approach as the
// head-to-head court (players are positioned elements that glide between
// court spots on CSS transitions, the ball rides its carrier or flies on an
// override), with help defense, cuts and closeouts now that there are three
// a side. Zones are % of the court image — rim (50, 12), arc ~62–68, top ~78.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const cl = x => clamp(x, 7, 93)
const RIM = { x: 50, y: 12 }
const TOP = { x: 50, y: 78 }
const WING = [{ x: 24, y: 64 }, { x: 76, y: 64 }]
const CORNER = [{ x: 11, y: 58 }, { x: 89, y: 58 }]
const POST = [{ x: 37, y: 25 }, { x: 63, y: 25 }]
const ARC3 = [{ x: 12, y: 62 }, { x: 88, y: 62 }, { x: 24, y: 66 }, { x: 76, y: 66 }, { x: 50, y: 68 }]
const MID = [{ x: 30, y: 42 }, { x: 70, y: 42 }, { x: 36, y: 50 }, { x: 64, y: 50 }, { x: 50, y: 54 }]
const PAINT = [{ x: 38, y: 14 }, { x: 62, y: 14 }, { x: 44, y: 15 }, { x: 56, y: 15 }]
const sdur = s => 0.65 - (clamp(s ?? 6, 1, 11) - 1) * 0.035                  // move time from the speed rating
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const near = (p, spots) => spots.reduce((best, s) => (Math.hypot(s.x - p.x, s.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? s : best), spots[0])

// meLabel: what your own player is called on court ('YOU'; null = your username, like everyone else)
export default function BlacktopCourt({ game, play, meId, photoFor, colorFor, avatarFor, speed = 1, meLabel = 'YOU' }) {
  const players = game.sides.flat()
  const byId = Object.fromEntries(players.map(p => [p.id, p]))
  const guards = game.guards || {}
  const [pos, setPos] = useState(() => formation(game, play?.poss ?? 0, play?.handler ?? null))
  const [ball, setBall] = useState(null)                 // { x, y, dur } override, else rides `holder`
  const [holder, setHolder] = useState(play?.handler ?? null)
  const [pop, setPop] = useState(null)
  const [tag, setTag] = useState(null)                   // 'CHECK BALL' etc.
  const timers = useRef([])
  const popKey = useRef(0)
  const r = useRef({ rnd: (lo, hi) => lo + Math.random() * (hi - lo), pick: a => a[Math.floor(Math.random() * a.length)] }).current

  const after = (ms, fn) => { const t = setTimeout(fn, ms / speed); timers.current.push(t) }
  const move = (id, x, y, dur) => setPos(p => ({ ...p, [id]: { x: cl(x), y: clamp(y, 6, 92), dur: (dur ?? sdur(byId[id]?.R.speed)) / speed } }))
  const moveMany = updates => setPos(p => { const n = { ...p }; for (const [id, x, y, dur] of updates) n[id] = { x: cl(x), y: clamp(y, 6, 92), dur: (dur ?? sdur(byId[id]?.R.speed)) / speed }; return n })
  const flyBall = (x, y, dur = .42) => setBall({ x, y, dur: dur / speed })
  const popRim = label => { popKey.current++; setPop({ label, key: popKey.current }); after(900, () => setPop(null)) }
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const at = id => pos[id] ?? TOP
  // a defender sits between his man and the rim, a step toward the ball
  const shadow = (manPos, ballPos, tight = .32) => { const base = lerp(manPos, RIM, tight); const toBall = lerp(base, ballPos, .12); return { x: toBall.x + r.rnd(-2, 2), y: toBall.y + r.rnd(-1, 1) } }
  const shadowAll = (offIds, ballPos, except = null) => offIds.flatMap(id => {
    const d = Object.keys(guards).find(k => guards[k] === id && byId[k]?.team !== byId[id]?.team)
    if (!d || d === except) return []
    const s = shadow(at(id), ballPos)
    return [[d, s.x, s.y]]
  })

  useEffect(() => {
    if (!play) return
    clearAll()
    const off = game.sides[play.poss], def = game.sides[1 - play.poss]
    const offIds = off.map(p => p.id)
    const sp = id => sdur(byId[id]?.R.speed)

    if (play.type === 'milestone') return
    if (play.type === 'check') {
      setBall(null)
      setTag('CHECK BALL'); after(900, () => setTag(null))
      const f = formation(game, play.poss, play.handler)
      // whoever ended up with it (a board, a steal) brings it to the top
      if (play.carrier && play.carrier !== play.handler && byId[play.carrier]) {
        setHolder(play.carrier)
        move(play.carrier, 50, 72)
        const hf = f[play.handler] ?? TOP
        after(420, () => { flyBall(hf.x, hf.y, .32); after(300, () => { setHolder(play.handler); setBall(null) }) })
      } else setHolder(play.handler)
      setPos(p => ({ ...p, ...Object.fromEntries(Object.entries(f).map(([id, s]) => [id, { ...s, dur: .8 / speed }])) }))
      return
    }

    if (play.type === 'steal') {
      const h = play.handler, s = play.pid
      setHolder(h)
      const hp = at(h)
      const side = hp.x < 50 ? 1 : -1
      const spot = { x: cl(hp.x + side * r.rnd(8, 14)), y: hp.y - r.rnd(6, 12) }
      move(h, spot.x, spot.y, sp(h) * .9)
      move(s, spot.x + side * 6, spot.y + 4, sp(s) * .8)
      after(520, () => { setHolder(s); move(s, spot.x + side * 10, spot.y + 10, sp(s) * .5); move(h, spot.x - side * 6, spot.y + 6, sp(h) * .7) })
      after(900, () => { move(s, 50, 80, sp(s)); moveMany(shadowAll(offIds, TOP, s)) })
      return
    }

    // a possession: entry pass → passes → the shot
    let t = 0
    let carrier = play.entry && byId[play.entry] ? play.entry : play.handler
    setHolder(carrier)
    if (play.entry && play.entry !== play.handler && byId[play.entry]) {
      const hp = at(play.handler)
      after(0, () => { flyBall(hp.x, hp.y, .36); after(320, () => { setHolder(play.handler); setBall(null) }) })
      t += 420; carrier = play.handler
    }
    // off-ball movement for the possession: one spaces to a corner, a big ducks in
    after(t + 60, () => {
      const others = offIds.filter(id => id !== play.handler)
      const ups = []
      others.forEach((id, i) => {
        const p = byId[id]
        const cur = at(id)
        if (p.R.big) { const post = POST[cur.x < 50 ? 0 : 1]; ups.push([id, post.x + r.rnd(-3, 3), post.y + r.rnd(-2, 6)]) }
        else { const c = cur.x < 50 ? CORNER[0] : CORNER[1]; const w = cur.x < 50 ? WING[0] : WING[1]; const to = i % 2 ? c : w; ups.push([id, to.x + r.rnd(-3, 3), to.y + r.rnd(-3, 3)]) }
      })
      moveMany([...ups, ...shadowAll(offIds, at(play.handler), null)])
    })
    const passes = play.passes || []
    passes.forEach(to => {
      t += 520
      after(t - 300, () => { const tp = at(to); const d = guards[Object.keys(guards).find(k => guards[k] === to && byId[k]?.team !== byId[to]?.team)] ? null : null; void d
        // receiver relocates a touch as the ball comes
        const cur = at(to); move(to, cur.x + r.rnd(-4, 4), cur.y + r.rnd(-4, 2), sp(to) * .6) })
      after(t - 240, () => { const tp = at(to); flyBall(tp.x, tp.y, .3) })
      after(t, () => { setHolder(to); setBall(null)
        // closeout by the receiver's defender, help sags
        const dId = Object.keys(guards).find(k => guards[k] === to && byId[k]?.team !== byId[to]?.team)
        const tp = at(to)
        const ups = dId ? [[dId, tp.x + r.rnd(-4, 4), tp.y - r.rnd(5, 9), sp(dId) * .55]] : []
        moveMany([...ups, ...shadowAll(offIds.filter(id => id !== to), tp, dId)])
      })
    })
    const shooter = play.pid, d = play.defId
    const od = sp(shooter), dd = sp(d)
    const start = t + 120
    const made = play.type === 'score'
    const label = play.type === 'block' ? 'BLOCK' : !made ? 'MISS' : play.pts === 2 ? '+2' : '+1'

    if (play.type === 'block') {
      after(start, () => {
        const cur = at(shooter); const lane = { x: cl(50 + (cur.x < 50 ? -1 : 1) * r.rnd(4, 10)), y: r.rnd(28, 36) }
        move(shooter, lane.x, lane.y, od * .7); move(d, lane.x + (cur.x < 50 ? 8 : -8), lane.y - 10, dd * .8)
      })
      after(start + 500, () => { move(shooter, 50 + r.rnd(-6, 6), 17, od * .45); move(d, 50 + r.rnd(-4, 4), 20, dd * .4) })
      after(start + 880, () => { const side = Math.random() < .5 ? -1 : 1; flyBall(50 + side * 28, 40, .5); popRim('BLOCK'); move(d, 50 + side * 14, 26, dd * .5) })
      return
    }

    const finish = () => { flyBall(RIM.x, RIM.y, .42); after(120, () => popRim(label)) }
    const shot = play.shot || (play.arc ? 'arc' : 'layup')
    if (shot === 'arc') {
      const cur = at(shooter); const spot = near(cur, ARC3)
      const variant = passes.length ? 'catch' : Math.random() < .5 ? 'stepback' : 'pullup'
      if (variant === 'catch') {
        after(start, () => { move(shooter, spot.x, spot.y, od * .3); move(d, spot.x + r.rnd(-6, 6), spot.y - r.rnd(2, 7), dd * .4); finish() })
      } else if (variant === 'stepback') {
        const dir = Math.random() < .5 ? -1 : 1
        after(start, () => { move(shooter, cl(spot.x + dir * r.rnd(10, 16)), spot.y + 2, od * .5); move(d, cl(spot.x + dir * r.rnd(6, 12)), spot.y - 6, dd * .6) })
        after(start + 480, () => { move(shooter, spot.x, spot.y, od * .55); move(d, cl(spot.x - dir * r.rnd(4, 10)), spot.y + r.rnd(4, 8), dd); finish() })
      } else {
        after(start, () => { move(shooter, cl(spot.x + r.rnd(-8, 8)), spot.y + r.rnd(10, 16), od * .8); move(d, spot.x, spot.y - 6, dd * .8) })
        after(start + 460, () => { move(shooter, spot.x, spot.y, od * .45); move(d, cl(spot.x + r.rnd(-5, 5)), spot.y - r.rnd(2, 6), dd * .5); finish() })
      }
      return
    }
    if (shot === 'mid') {
      const spot = near(at(shooter), MID)
      after(start, () => { move(shooter, cl(spot.x + r.rnd(-10, 10)), spot.y + r.rnd(12, 18), od * .75); move(d, spot.x + r.rnd(-6, 6), spot.y - r.rnd(4, 10), dd * .85) })
      after(start + 460, () => { move(shooter, spot.x, spot.y, od * .36); move(d, spot.x + r.rnd(-5, 5), spot.y - r.rnd(2, 6), dd * .46); finish() })
      return
    }
    if (shot === 'post') {
      const cur = at(shooter); const block = POST[cur.x < 50 ? 0 : 1]
      after(start, () => { move(shooter, block.x, block.y + 10, od * 1.1); move(d, block.x + r.rnd(-3, 3), block.y - 6, dd) })
      after(start + 560, () => { move(shooter, block.x + r.rnd(-3, 3), block.y, od * .9); move(d, block.x + r.rnd(-3, 3), block.y - 8, dd * .8) })
      after(start + 1000, () => { move(shooter, block.x + (block.x < 50 ? 6 : -6), 15, od * .6); finish() })
      return
    }
    // drive / layup / dunk: attack the rim from where he stands; help defense steps in
    const cur = at(shooter)
    const dir = cur.x < 50 ? 1 : -1
    const rimSpot = r.pick(PAINT)
    const lane = { x: cl(rimSpot.x + -dir * r.rnd(4, 10)), y: rimSpot.y + r.rnd(14, 24) }
    const helper = def.find(p => p.id !== d) ?? null
    after(start, () => {
      const ups = [[shooter, cl(cur.x + dir * r.rnd(6, 12)), cur.y - r.rnd(8, 14), od * .62], [d, cl(cur.x + dir * r.rnd(2, 8)), cur.y - r.rnd(14, 20), dd * .8]]
      if (helper) ups.push([helper.id, 50 + (cur.x < 50 ? -6 : 6), 30, sp(helper.id) * .9])
      moveMany(ups)
    })
    after(start + 420, () => { move(shooter, lane.x, lane.y, od * .32); move(d, cl(rimSpot.x + dir * r.rnd(2, 8)), rimSpot.y + r.rnd(2, 8), dd * .55) })
    after(start + 700, () => {
      move(shooter, rimSpot.x, rimSpot.y, od * (shot === 'dunk' ? .26 : .3))
      if (shot === 'dunk') { flyBall(rimSpot.x, rimSpot.y, .25); after(220, () => popRim(label)) } else finish()
    })
    return () => clearAll()
  }, [play?.id]) // eslint-disable-line

  // rebounds: everyone crashes, the rebounder comes down with it
  useEffect(() => {
    if (!play || (play.type !== 'oreb' && play.type !== 'dreb')) return
    clearAll()
    const rb = play.pid
    const everyone = players.map(p => p.id)
    moveMany(everyone.map(id => [id, 50 + r.rnd(-16, 16), 18 + r.rnd(0, 14), sdur(byId[id]?.R.speed) * .8]))
    after(380, () => { flyBall(at(rb).x, 22, .3) })
    after(620, () => { setHolder(rb); setBall(null); move(rb, at(rb).x, 30, sdur(byId[rb]?.R.speed) * .5) })
    if (play.type === 'dreb') after(1000, () => { move(rb, 50, 76); setTag('OUTLET'); after(700, () => setTag(null)) })
    return () => clearAll()
  }, [play?.id]) // eslint-disable-line

  const EASE = 'cubic-bezier(0.25,0.82,0.42,1)'
  const hp = holder ? at(holder) : TOP
  const holderSide = holder && byId[holder] ? (byId[holder].team === 0 ? 1 : -1) : 1
  const ballPos = ball ?? { x: hp.x + holderSide * 6, y: hp.y - 6 }
  const ballTr = ball ? `left ${ball.dur}s cubic-bezier(0.4,0,0.6,1), top ${ball.dur}s cubic-bezier(0.55,0,0.45,1)` : `left ${hp.dur ?? .5}s ${EASE}, top ${hp.dur ?? .5}s ${EASE}`

  return (
    <div className="btc-wrap">
      <div className="btc-court">
        <img src="/court.png" alt="" draggable={false} className="btc-img" />
        <div className="btc-tint" /><div className="btc-light" />
        <div className="btc-overlay">
          <div className="btc-ball" style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%`, transition: ballTr }}>🏀</div>
          {players.map(p => {
            const s = pos[p.id] ?? TOP
            const has = holder === p.id
            const col = colorFor(p.team)
            return (
              <div key={p.id} className={`btc-p${has ? ' has-ball' : ''}${p.id === meId ? ' is-me' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, transition: `left ${s.dur}s ${EASE}, top ${s.dur}s ${EASE}`, zIndex: has ? 5 : 3, '--pc': col }}>
                <div className="btc-ring" style={{ boxShadow: has ? `0 0 0 3px ${col}, 0 0 18px ${col}aa` : `0 0 0 1.5px ${col}99` }}>
                  {avatarFor?.(p) ?? <QBAvatar photo={photoFor?.(p) ?? null} team={p.build?.basketballIQ?.team ?? null} color={null} size={40} logoDir="/logos/nba/" faceCenter={p.build?.basketballIQ?.faceCenter} />}
                </div>
                <span className="btc-name" style={{ color: col }}>{p.id === meId && meLabel ? meLabel : (p.name || '').split(' ')[0].slice(0, 9)}</span>
              </div>
            )
          })}
          {pop && <div key={pop.key} className={`btc-pop${pop.label === 'MISS' ? ' is-miss' : pop.label === 'BLOCK' ? ' is-block' : ''}`}>{pop.label}</div>}
          {tag && <div className="btc-tag">{tag}</div>}
        </div>
      </div>
    </div>
  )
}

// Where everyone stands when the ball is checked: handler at the top, guards
// on the wings, a big on the weak-side block; defenders between their man and
// the rim.
export function formation(game, poss, handlerId) {
  const off = game.sides[poss], def = game.sides[1 - poss]
  const f = {}
  let wing = 0
  for (const p of off) {
    if (p.id === handlerId) { f[p.id] = { ...TOP }; continue }
    if (p.R.big) { f[p.id] = { ...POST[wing % 2 === 0 ? 1 : 0] }; continue }
    f[p.id] = { ...WING[wing % 2] }; wing++
  }
  // leftover (no handler among them, e.g. the first check): fill the top
  if (handlerId && !f[handlerId] && off.some(p => p.id === handlerId)) f[handlerId] = { ...TOP }
  for (const p of def) {
    const manId = game.guards?.[p.id] ?? off[def.indexOf(p) % off.length]?.id
    const man = f[manId] ?? TOP
    const s = lerp(man, RIM, .3)
    f[p.id] = { x: s.x, y: s.y }
  }
  return f
}
