import { useEffect, useRef, useState } from 'react'
import { NameTag } from './NameTag'
import QBAvatar from '../QBAvatar'
import { sfx } from '../../lib/juice'
import { useProgress, equip } from '../../lib/progress'
import { itemsFor, itemById, DEFAULTS } from '../../lib/cosmetics'

// The Blacktop court: six players and a ball, choreographed from the play the
// engine wrote — who checked it up, each pass, the drive or the pull-up, the
// defender on the shooter, the swat, the board. Same approach as the
// head-to-head court (players are positioned elements that glide between
// court spots on CSS transitions, the ball rides its carrier or flies on an
// override), with help defense, cuts and closeouts now that there are three
// a side. Zones are % of the court image — rim (50, 12); the 3-point line runs
// straight up the sides at x ≈ 12.5 to y ≈ 37, then curves to its top at (50, 73).

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// The court Blacktop is played on: the one equipped from the shop's Courts
// (lib/cosmetics.js; every design shares the same lines, so the spots line up)
export const COURTS = itemsFor('court')
export const setCourtId = id => equip('court', id)
export function useCourt() {
  const p = useProgress()
  const it = itemById(p.equip?.court) ?? itemById(DEFAULTS.court)
  return { id: it.id, label: it.name.toUpperCase(), src: it.img, tint: false }
}
const cl = x => clamp(x, 7, 93)
const RIM = { x: 50, y: 12 }
const TOP = { x: 50, y: 78 }
const WING = [{ x: 18, y: 69 }, { x: 82, y: 69 }]
const CORNER = [{ x: 8, y: 30 }, { x: 92, y: 30 }]
const POST = [{ x: 37, y: 25 }, { x: 63, y: 25 }]
// every 3 is a step behind the line (corners, wings, slots, the top)
const ARC3 = [{ x: 8, y: 28 }, { x: 92, y: 28 }, { x: 16, y: 67 }, { x: 84, y: 67 }, { x: 30, y: 77 }, { x: 70, y: 77 }, { x: 50, y: 80 }]
const MID = [{ x: 30, y: 42 }, { x: 70, y: 42 }, { x: 36, y: 50 }, { x: 64, y: 50 }, { x: 50, y: 54 }]
const PAINT = [{ x: 38, y: 14 }, { x: 62, y: 14 }, { x: 44, y: 15 }, { x: 56, y: 15 }]
const sdur = s => 0.65 - (clamp(s ?? 6, 1, 11) - 1) * 0.035                  // move time from the speed rating
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const near = (p, spots) => spots.reduce((best, s) => (Math.hypot(s.x - p.x, s.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? s : best), spots[0])

// meLabel: what your own player is called on court ('YOU'; null = your username, like everyone else)
// onReveal(playId): called when that play's result happens on the court (the ball reaches the
// rim, the swat, the steal, the board), so the play-by-play and the score can wait for it
export default function BlacktopCourt({ game, play, meId, photoFor, colorFor, avatarFor, speed = 1, meLabel = null, meName = null, ovrFor = null, bubbles = null, onReveal = null }) {
  const court = useCourt()
  const players = game.sides.flat()
  const byId = Object.fromEntries(players.map(p => [p.id, p]))
  const guards = game.guards || {}
  const [pos, setPos] = useState(() => formation(game, play?.poss ?? 0, play?.handler ?? null))
  const [ball, setBall] = useState(null)                 // { x, y, dur } override, else rides `holder`
  const [holder, setHolder] = useState(play?.handler ?? null)
  const [hand, setHand] = useState(null)                 // which side of him the ball is on (-1 left, 1 right); null: his team's side
  const [pop, setPop] = useState(null)
  const [tag, setTag] = useState(null)                   // 'CHECK BALL' etc.
  const timers = useRef([])
  const popKey = useRef(0)
  const r = useRef({ rnd: (lo, hi) => lo + Math.random() * (hi - lo), pick: a => a[Math.floor(Math.random() * a.length)] }).current

  const after = (ms, fn) => { const t = setTimeout(fn, ms / speed); timers.current.push(t) }
  // the ball's sounds, tied to what the ball is doing: a catch only when a pass
  // lands, a steady dribble only while the handler is moving with it (never with
  // the ball in the air), the rim on a make or a miss
  const caught = () => sfx('catchball')
  const holderRef = useRef(null), movingUntil = useRef(0), flyingUntil = useRef(0)
  const bounce = () => {}            // (dribbles come from the dribble clock below)
  const moving = (id, dur) => { if (id === holderRef.current) movingUntil.current = Math.max(movingUntil.current, performance.now() + dur * 1000) }
  const move = (id, x, y, dur) => { const d = (dur ?? sdur(byId[id]?.R.speed)) / speed; moving(id, d); const s = { x: cl(x), y: clamp(y, 6, 92), dur: d }; live.current = { ...live.current, [id]: s }; setPos(p => ({ ...p, [id]: s })) }
  const moveMany = updates => {
    const n = { ...live.current }
    for (const [id, x, y, dur] of updates) { const d = (dur ?? sdur(byId[id]?.R.speed)) / speed; moving(id, d); n[id] = { x: cl(x), y: clamp(y, 6, 92), dur: d } }
    live.current = n; setPos(p => ({ ...p, ...Object.fromEntries(updates.map(([id]) => [id, n[id]])) }))
  }
  const flyBall = (x, y, dur = .42) => { flyingUntil.current = performance.now() + (dur / speed) * 1000 + 60; setBall({ x, y, dur: dur / speed }) }
  useEffect(() => { holderRef.current = holder; movingUntil.current = 0 }, [holder])
  useEffect(() => {
    const id = setInterval(() => { const now = performance.now(); if (holderRef.current && now < movingUntil.current && now > flyingUntil.current) sfx('dribble') }, 340 / speed)
    return () => clearInterval(id)
  }, [speed])
  const checkPass = useRef(null)     // the pass a check-up already showed (not played twice)
  const revealTo = useRef(onReveal); revealTo.current = onReveal
  const playId = useRef(null)
  const reveal = () => revealTo.current?.(playId.current)
  const popRim = label => { reveal(); popKey.current++; setPop({ label, key: popKey.current }); after(900, () => setPop(null)) }
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  // where each player is headed now (kept as moves happen, so a pass or a shot later
  // in the play goes from where he actually is, not where he stood when it began)
  const live = useRef(pos); live.current = pos
  const at = id => live.current[id] ?? TOP
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
    playId.current = play.id
    setHand(null)
    const off = game.sides[play.poss], def = game.sides[1 - play.poss]
    const offIds = off.map(p => p.id)
    const sp = id => sdur(byId[id]?.R.speed)

    if (play.type === 'milestone' || play.type === 'check') reveal()
    if (play.type === 'milestone') return
    // a board is its own animation (below): the ball goes from the rim to whoever got it
    if (play.type === 'oreb' || play.type === 'dreb') return
    if (play.type === 'check') {
      setBall(null)
      setTag('CHECK BALL'); after(900, () => setTag(null))
      const f = formation(game, play.poss, play.handler)
      // whoever ended up with it (a board, a steal) brings it to the top
      checkPass.current = play.carrier && play.carrier !== play.handler ? { from: play.carrier, to: play.handler } : null
      if (play.carrier && play.carrier !== play.handler && byId[play.carrier]) {
        setHolder(play.carrier)
        move(play.carrier, 50, 72); bounce(2)
        const hf = f[play.handler] ?? TOP
        after(420, () => { flyBall(hf.x, hf.y, .32); after(300, () => { setHolder(play.handler); setBall(null); caught() }) })
      } else setHolder(play.handler)
      const set = Object.fromEntries(Object.entries(f).map(([id, s]) => [id, { ...s, dur: .8 / speed }]))
      live.current = { ...live.current, ...set }; setPos(p => ({ ...p, ...set }))
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
      after(520, () => { reveal(); setHolder(s); move(s, spot.x + side * 10, spot.y + 10, sp(s) * .5); move(h, spot.x - side * 6, spot.y + 6, sp(h) * .7) })
      after(900, () => { move(s, 50, 80, sp(s)); moveMany(shadowAll(offIds, TOP, s)); bounce(3, 230) })
      return
    }

    // a possession: entry pass → passes → the shot
    let t = 0
    // the inbound pass, unless the check-up just showed it (a second catch with the ball already there)
    const shown = checkPass.current && checkPass.current.from === play.entry && checkPass.current.to === play.handler
    checkPass.current = null
    // who has it as the play starts: the passer when the inbound pass is still to come; the
    // handler when the check-up already gave it to him (it went back to the passer and stayed
    // there: the handler drove and shot while the ball sat with his teammate)
    let carrier = play.entry && byId[play.entry] && !shown ? play.entry : play.handler
    setHolder(carrier); setBall(null)
    if (play.entry && play.entry !== play.handler && byId[play.entry] && !shown) {
      const hp = at(play.handler)
      after(0, () => { flyBall(hp.x, hp.y, .36); after(320, () => { setHolder(play.handler); setBall(null); caught() }) })
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
    const shot = play.shot || (play.arc ? 'arc' : 'layup')
    const jumper = play.type !== 'block' && (shot === 'arc' || shot === 'mid')
    // a catch-and-shoot's spot, picked when the last pass is thrown (from where he is then)
    let csSpot = null
    passes.forEach((to, k) => {
      t += 520
      const last = k === passes.length - 1 && to === play.pid && play.cs && jumper
      after(t - 300, () => {
        const cur = at(to)
        // the shooter gets to his spot as the ball comes (behind the line for a 3,
        // inside it for a jumper); anyone else relocates a touch
        if (last) { csSpot = near(cur, shot === 'arc' ? ARC3 : MID); move(to, csSpot.x, csSpot.y, sp(to) * .55) }
        else move(to, cur.x + r.rnd(-4, 4), cur.y + r.rnd(-4, 2), sp(to) * .6)
      })
      after(t - 240, () => { const tp = at(to); flyBall(tp.x, tp.y, .3) })
      after(t, () => { setHolder(to); setBall(null); caught()
        // closeout by the receiver's defender, help sags
        const dId = Object.keys(guards).find(k => guards[k] === to && byId[k]?.team !== byId[to]?.team)
        const tp = at(to)
        const ups = dId ? [[dId, tp.x + r.rnd(-4, 4), tp.y - r.rnd(5, 9), sp(dId) * .55]] : []
        moveMany([...ups, ...shadowAll(offIds.filter(id => id !== to), tp, dId)])
      })
    })
    // (a block is written from the shot-blocker's side: he's pid, the shooter pid2)
    const shooter = play.type === 'block' ? (play.pid2 ?? play.pid) : play.pid, d = play.defId
    const od = sp(shooter), dd = sp(d)
    const start = t + 120
    const made = play.type === 'score'
    const label = play.type === 'block' ? 'BLOCK' : !made ? 'MISS' : play.pts === 2 ? '+2' : '+1'
    // the ball leaves his hands once he's set (when a move of `dur` seconds lands)
    const setThen = (dur, fn) => after(dur * 1000 + 40, fn)
    // a swat: the ball knocked away to one side, the shot-blocker following it
    const swat = (from, dx = 24) => { const side = from.x < 50 ? -1 : 1; flyBall(cl(from.x + side * dx * r.rnd(.7, 1.1)), from.y + r.rnd(4, 12), .45); popRim('BLOCK') }

    // a blocked jumper: he rises from the spot, his man closes out from the rim side and gets a hand on it
    if (play.type === 'block' && shot === 'mid') {
      const spot = near(at(shooter), MID)
      after(start, () => { move(shooter, cl(spot.x + r.rnd(-8, 8)), spot.y + r.rnd(8, 13), od * .75); move(d, spot.x + r.rnd(-5, 5), spot.y - r.rnd(8, 12), dd * .85); bounce(2) })
      after(start + 460, () => { move(shooter, spot.x, spot.y, od * .36); move(d, spot.x + r.rnd(-2, 2), spot.y - 3, dd * .36) })
      after(start + 460 + od * 360 + 120, () => { swat(spot); move(d, spot.x + (spot.x < 50 ? -6 : 6), spot.y + 2, dd * .5) })
      return
    }
    // a blocked post shot: backed down to the block, his man behind him (rim side) swats the hook
    if (play.type === 'block' && shot === 'post') {
      const block = POST[at(shooter).x < 50 ? 0 : 1]
      after(start, () => { move(shooter, block.x, block.y + 10, od * 1.1); move(d, block.x + r.rnd(-3, 3), block.y + 2, dd); bounce(3, 240) })
      after(start + 560, () => { move(shooter, block.x + r.rnd(-3, 3), block.y, od * .9); move(d, block.x + r.rnd(-2, 2), block.y - 6, dd * .8) })
      after(start + 1000, () => { const hook = { x: block.x + (block.x < 50 ? 5 : -5), y: 18 }; move(shooter, hook.x, hook.y, od * .5); move(d, hook.x + (block.x < 50 ? 2 : -2), hook.y - 4, dd * .5) })
      after(start + 1250, () => swat(block, 20))
      return
    }
    if (play.type === 'block') {
      after(start, () => {
        const cur = at(shooter); const lane = { x: cl(50 + (cur.x < 50 ? -1 : 1) * r.rnd(4, 10)), y: r.rnd(28, 36) }
        move(shooter, lane.x, lane.y, od * .7); move(d, lane.x + (cur.x < 50 ? 8 : -8), lane.y - 10, dd * .8)
      })
      after(start + 500, () => { move(shooter, 50 + r.rnd(-6, 6), 17, od * .45); move(d, 50 + r.rnd(-4, 4), 20, dd * .4) })
      after(start + 880, () => { const side = Math.random() < .5 ? -1 : 1; flyBall(50 + side * 28, 40, .5); popRim('BLOCK'); move(d, 50 + side * 14, 26, dd * .5) })
      return
    }

    const finish = () => { flyBall(RIM.x, RIM.y, .42); after(120, () => popRim(label)); after(400, () => sfx(made ? 'make' : 'rimmiss')) }
    if (shot === 'arc') {
      const spot = csSpot ?? near(at(shooter), ARC3)
      // off a pass it's a catch-and-shoot (the engine's cs); never without one
      const variant = play.cs ? 'catch' : Math.random() < .5 ? 'stepback' : 'pullup'
      if (variant === 'catch') {
        // caught on the spot (the last pass took him there): straight up, the closeout late
        after(start, () => { move(shooter, spot.x, spot.y, od * .2); move(d, spot.x + r.rnd(-6, 6), spot.y - r.rnd(2, 7), dd * .4) })
        after(start + 200, finish)
      } else if (variant === 'stepback') {
        // in a step, then back behind the line and up
        const dir = Math.random() < .5 ? -1 : 1
        after(start, () => { move(shooter, cl(spot.x + dir * r.rnd(6, 10)), spot.y - r.rnd(5, 8), od * .5); move(d, cl(spot.x + dir * r.rnd(6, 10)), spot.y - 12, dd * .6); bounce(2) })
        after(start + 480, () => { move(shooter, spot.x, spot.y, od * .55); move(d, cl(spot.x - dir * r.rnd(2, 6)), spot.y - r.rnd(4, 7), dd); setThen(od * .55, finish) })
      } else {
        // a pull-up: comes into it from deeper, rises behind the line
        after(start, () => { move(shooter, cl(spot.x + r.rnd(-8, 8)), spot.y + r.rnd(6, 10), od * .8); move(d, spot.x, spot.y - 6, dd * .8); bounce(2) })
        after(start + 460, () => { move(shooter, spot.x, spot.y, od * .45); move(d, cl(spot.x + r.rnd(-5, 5)), spot.y - r.rnd(2, 6), dd * .5); setThen(od * .45, finish) })
      }
      return
    }
    if (shot === 'mid') {
      const spot = csSpot ?? near(at(shooter), MID)
      // catch-and-shoot at the elbow: caught on the spot, feet set, let it go, the closeout late
      if (play.cs) {
        after(start, () => { move(shooter, spot.x, spot.y, od * .25); move(d, spot.x + r.rnd(-5, 5), spot.y - r.rnd(2, 6), dd * .45) })
        after(start + 220, finish)
        return
      }
      // a pull-up: a dribble in from inside the arc, then up from the spot
      after(start, () => { move(shooter, cl(spot.x + r.rnd(-8, 8)), spot.y + r.rnd(8, 13), od * .75); move(d, spot.x + r.rnd(-6, 6), spot.y - r.rnd(4, 10), dd * .85); bounce(2) })
      after(start + 460, () => { move(shooter, spot.x, spot.y, od * .36); move(d, spot.x + r.rnd(-5, 5), spot.y - r.rnd(2, 6), dd * .46); setThen(od * .36, finish) })
      return
    }
    if (shot === 'post') {
      const cur = at(shooter); const block = POST[cur.x < 50 ? 0 : 1]
      after(start, () => { move(shooter, block.x, block.y + 10, od * 1.1); move(d, block.x + r.rnd(-3, 3), block.y - 6, dd); bounce(3, 240) })
      after(start + 560, () => { move(shooter, block.x + r.rnd(-3, 3), block.y, od * .9); move(d, block.x + r.rnd(-3, 3), block.y - 8, dd * .8) })
      after(start + 1000, () => { move(shooter, block.x + (block.x < 50 ? 6 : -6), 15, od * .6); finish() })
      return
    }
    // drive / layup / dunk: attack the rim from where he stands; help defense steps in.
    // From the middle he goes either way; from a wing, at the rim on his side. The ball is in
    // the hand he's driving with, and a good ball handler often crosses over first: a jab the
    // other way with the ball in that hand, his man bites, then it comes across and he goes
    const cur = at(shooter)
    const middle = Math.abs(cur.x - 50) < 10
    const dir = middle ? (Math.random() < .5 ? -1 : 1) : cur.x < 50 ? 1 : -1
    const finishSide = middle ? dir : Math.sign(cur.x - 50)
    const rimSpot = r.pick(PAINT.filter(s => Math.sign(s.x - 50) === finishSide))
    // his first step, then the lane halfway from there to the rim spot: one steady line in
    const firstX = cl(cur.x + dir * r.rnd(6, 12))
    const lane = { x: (firstX + rimSpot.x) / 2, y: rimSpot.y + r.rnd(14, 24) }
    const helper = def.find(p => p.id !== d) ?? null
    const handles = byId[shooter]?.R?.handles ?? 5
    const cross = Math.random() < clamp(.3 + (handles - 5) * .06, .15, .75)
    const go = cross ? 260 : 0
    if (cross) {
      after(start, () => { setHand(-dir); move(shooter, cl(cur.x - dir * r.rnd(3, 5)), cur.y - r.rnd(1, 3), .16); move(d, cl(cur.x - dir * r.rnd(4, 7)), at(d).y, .22); bounce(1) })
      after(start + 190, () => setHand(dir))
    } else after(start, () => setHand(dir))
    after(start + go, () => {
      const ups = [[shooter, firstX, cur.y - r.rnd(8, 14), od * .62], [d, cl(cur.x + dir * r.rnd(2, 8)), cur.y - r.rnd(14, 20), dd * (cross ? 1.05 : .8)]]
      if (helper) ups.push([helper.id, 50 + (cur.x < 50 ? -6 : 6), 30, sp(helper.id) * .9])
      moveMany(ups); bounce(3, 200)
    })
    after(start + go + 420, () => { move(shooter, lane.x, lane.y, od * .32); move(d, cl(rimSpot.x + dir * r.rnd(2, 8)), rimSpot.y + r.rnd(2, 8), dd * .55) })
    after(start + go + 700, () => {
      // a dunk is finished at the rim itself (he goes up under it and the ball goes through
      // the hoop); a layup goes up from his spot in the paint
      if (shot === 'dunk') {
        move(shooter, RIM.x + (cur.x < 50 ? -1 : 1) * r.rnd(2, 5), RIM.y + r.rnd(3, 6), od * .26)
        // the rim takes the hit, then the net (a miss is just the rim)
        flyBall(RIM.x, RIM.y, .25); after(220, () => { popRim(label); sfx('rimmiss'); if (made) after(110, () => sfx('make')) })
      } else { move(shooter, rimSpot.x, rimSpot.y, od * .3); finish() }
    })
    return () => clearAll()
  }, [play?.id]) // eslint-disable-line

  // rebounds: everyone crashes, the rebounder comes down with it
  useEffect(() => {
    if (!play || (play.type !== 'oreb' && play.type !== 'dreb')) return
    clearAll()
    playId.current = play.id
    setHand(null)
    const rb = play.pid
    const everyone = players.map(p => p.id)
    moveMany(everyone.map(id => [id, 50 + r.rnd(-16, 16), 18 + r.rnd(0, 14), sdur(byId[id]?.R.speed) * .8]))
    // off the rim straight into his hands (where the ball sits when he holds it)
    after(380, () => { const p = at(rb), side = byId[rb]?.team === 0 ? 1 : -1; flyBall(p.x + side * 6, p.y - 6, .3) })
    after(620, () => { reveal(); setHolder(rb); setBall(null); move(rb, at(rb).x, 30, sdur(byId[rb]?.R.speed) * .5) })
    if (play.type === 'dreb') after(1000, () => { move(rb, 50, 76); bounce(2, 230); setTag('OUTLET'); after(700, () => setTag(null)) })
    return () => clearAll()
  }, [play?.id]) // eslint-disable-line

  const EASE = 'cubic-bezier(0.25,0.82,0.42,1)'
  // overlaps: the ball handler on top, then the team with the ball, then the defense
  const hp = holder ? at(holder) : TOP
  const holderSide = holder && byId[holder] ? (byId[holder].team === 0 ? 1 : -1) : 1
  const ballPos = ball ?? { x: hp.x + (hand ?? holderSide) * 6, y: hp.y - 6 }
  const ballTr = ball ? `left ${ball.dur}s cubic-bezier(0.4,0,0.6,1), top ${ball.dur}s cubic-bezier(0.55,0,0.45,1)` : `left ${hp.dur ?? .5}s ${EASE}, top ${hp.dur ?? .5}s ${EASE}`

  return (
    <div className="btc-wrap">
      <div className="btc-court">
        <img src={court.src} alt="" draggable={false} className="btc-img" />
        {court.tint && <div className="btc-tint" />}<div className="btc-light" />
        <div className="btc-overlay">
          <div className="btc-ball" style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%`, transition: ballTr }}>🏀</div>
          {players.map(p => {
            const s = pos[p.id] ?? TOP
            const has = holder === p.id
            const col = colorFor(p.team)
            return (
              <div key={p.id} className={`btc-p${has ? ' has-ball' : ''}${p.id === meId ? ' is-me' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, transition: `left ${s.dur}s ${EASE}, top ${s.dur}s ${EASE}`, zIndex: has ? 5 : p.team === play?.poss ? 4 : 3, '--pc': col }}>
                {/* the overall over the head, and a reaction when they send one */}
                {ovrFor && <span className="btc-ovr" style={{ background: col }}>{ovrFor(p)}</span>}
                {bubbles?.[p.id] && <span key={bubbles[p.id]} className="btc-bubble">{bubbles[p.id]}</span>}
                <div className="btc-ring">
                  {avatarFor?.(p) ?? <QBAvatar photo={photoFor?.(p) ?? null} team={p.build?.basketballIQ?.team ?? null} color={null} size={34} logoDir="/logos/nba/" faceCenter={p.build?.basketballIQ?.faceCenter} />}
                </div>
                {/* the name in its owner's look (color, effect, plate), same as everywhere else; bots plain */}
                <span className="btc-name" style={{ color: col }}>{p.id === meId && meLabel ? meLabel : p.bot && !p.mimic && p.id !== meId ? (p.name || '').split(' ')[0].slice(0, 9) : <NameTag name={((p.id === meId && meName) || p.name || '').split(' ')[0].slice(0, 12)} self={p.id === meId} cos={p.id === meId ? null : p.cos || null} />}</span>
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
