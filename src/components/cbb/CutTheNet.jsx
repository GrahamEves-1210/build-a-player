import { useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../lib/juice'

// Cutting down the net, after the national championship: the owner's 32-0 game's moment (32-0-game TournamentPhase:
// BasketballNet, handleCutNet, Confetti), taken whole and drawn for College Basketball. The net hangs on the rim
// under the backboard; the scissors start at the rim's left, each cut sways the net (32-0's net-sway), the scissors
// work across the rim loop by loop, and when the last loop goes the net drops (32-0's fall: down 60px, squashed to a
// fifth, faded, .6s ease-in), the confetti comes down once (36 pieces, 32-0's fall) in the school's colours and gold,
// and what he keeps comes up where 32-0's trophy did, with its bounce (trophy-bounce). Here the loops are cut one tap
// at a time, as a team does it, his the last one. Reduced motion, or the page opened from a save: the net already cut
// and his. Never in the way: the page's button to go on is under it the whole time.
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const W = 220, H = 196
const CX = 110, RIM_Y = 58, RX = 62, RY = 11
const LOOPS = 8                     // 32-0's net: eight strands
const ROWS = 5                      // knot rows under the hooks
const ROW_H = 19
// a knot: row 0 is the hooks on the rim; even rows sit on the hooks' angles, odd rows between them (the net's diamonds).
// side: 1 the front of the net, -1 the back (seen through the front, faint)
const ang = (r, i) => Math.PI - ((r % 2 ? i + 1 : i + 0.5) * Math.PI) / LOOPS
const count = r => (r % 2 ? LOOPS - 1 : LOOPS)
const knot = (r, i, side, sag) => {
  const k = 1 - 0.085 * r, a = ang(r, i)
  const x = CX + RX * k * Math.cos(a)
  const y = RIM_Y + r * ROW_H + side * RY * (1 - 0.13 * r) * Math.sin(a)
  return [x, y + (r ? sag(x, r) : 0)]
}
// the strands from row r to row r + 1: [from i, to j]
const links = r => {
  const out = []
  for (let i = 0; i < count(r); i++) {
    for (const j of r % 2 ? [i, i + 1] : [i - 1, i]) if (j >= 0 && j < count(r + 1)) out.push([i, j])
  }
  return out
}
const LINKS = Array.from({ length: ROWS }, (_, r) => links(r))

// the net on the rim, the loops in `cut` cut through; what's left of it sags where it lost its loops
function NetLines({ cut, side }) {
  const hookX = i => CX + RX * Math.cos(ang(0, i))
  const sag = (x, r) => Math.min(16, cut.reduce((s, h) => s + 7 * Math.exp(-((x - hookX(h)) ** 2) / (2 * 26 * 26)), 0)) * (0.55 + 0.45 * r / ROWS)
  const segs = []
  LINKS.forEach((ls, r) => ls.forEach(([i, j]) => {
    const a = knot(r, i, side, sag), b = knot(r + 1, j, side, sag)
    if (r === 0 && cut.includes(i)) {
      // a cut loop: a stub left on the hook, the strand's end hanging off the knot below
      segs.push(`M${a[0]} ${a[1]}l0 4`)
      segs.push(`M${b[0]} ${b[1]}l${(a[0] - b[0]) * 0.18} 7`)
    } else segs.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`)
  }))
  return <path d={segs.join('')} />
}

// what he keeps: the net off the rim, its loops gathered in his hand and tied off in the school's colours
function KeptNet({ color }) {
  const segs = []
  const pt = (r, i) => {
    const k = r === 0 ? 0.16 : 0.38 + 0.12 * Math.sin((r / ROWS) * Math.PI) + 0.1 * (r / ROWS)
    const a = ang(r, i)
    return [CX + RX * k * Math.cos(a), 46 + r * 20 + 4 * Math.sin(a)]
  }
  LINKS.forEach((ls, r) => ls.forEach(([i, j]) => { const a = pt(r, i), b = pt(r + 1, j); segs.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`) }))
  // the cut loop ends, fanned above the hand
  for (let i = 0; i < LOOPS; i++) { const a = pt(0, i); const dx = (i - (LOOPS - 1) / 2) * 3.2; segs.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}l${dx.toFixed(1)} -14`) }
  return (
    <svg className="cbbn-kept-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <g className="cbbn-strands" fill="none"><path d={segs.join('')} /></g>
      <rect x={CX - 15} y={39} width={30} height={9} rx={2} fill={color} />
      <rect x={CX - 15} y={39} width={30} height={9} rx={2} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
    </svg>
  )
}

// the scissors: two blades turning on their pivot, the rings in the school's colour; the tip sits on the loop being cut
function Scissors({ x, y, snip, gone, color }) {
  return (
    <g className={`cbbn-scissors${gone ? ' is-gone' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
      <g transform="translate(-17 0)">
        <g key={snip} className={`cbbn-blades${snip ? ' cbbn-snip' : ''}`}>
          <g className="cbbn-blade-a"><path className="cbbn-steel" d="M17 -0.4L0 -3.2L-1 0.6Z" /><path className="cbbn-ring" d="M0 0L-10 -6" stroke={color} /><circle className="cbbn-ring" cx="-13.5" cy="-7.5" r="4" stroke={color} /></g>
          <g className="cbbn-blade-b"><path className="cbbn-steel" d="M17 0.4L0 3.2L-1 -0.6Z" /><path className="cbbn-ring" d="M0 0L-10 6" stroke={color} /><circle className="cbbn-ring" cx="-13.5" cy="7.5" r="4" stroke={color} /></g>
          <circle className="cbbn-pivot" r="1.5" />
        </g>
      </g>
    </g>
  )
}

function Confetti({ colors }) {
  // 32-0's confetti: 36 pieces, each its own spot, delay, speed, size and turn, falling once
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 1.2, dur: 1.8 + Math.random() * 1.4,
    color: colors[i % colors.length], size: 6 + Math.random() * 7, rot: Math.random() * 360,
  })), [colors])
  return (
    <div className="cbbn-confetti" aria-hidden="true">
      {pieces.map(p => <i key={p.id} style={{ left: `${p.x}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: p.color, width: p.size, height: p.size * 0.6, '--rot': `${p.rot}deg` }} />)}
    </div>
  )
}

export default function CutTheNet({ team, color, who, live }) {
  const still = !live || reduced()
  const [cut, setCut] = useState(() => (still ? Array.from({ length: LOOPS }, (_, i) => i) : []))
  const [down, setDown] = useState(still)        // the net off the rim
  const [kept, setKept] = useState(still)        // his, in hand
  const [confetti, setConfetti] = useState(false)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const left = LOOPS - cut.length
  const snip = () => {
    if (!left) return
    const next = [...cut, cut.length]   // left to right along the rim, as 32-0's scissors go
    setCut(next)
    if (next.length < LOOPS) { sfx('tick'); return }
    sfx('tick')
    // the last loop: the net goes, the confetti comes down, the net comes up in his hand
    later(() => { setDown(true); sfx('champion') }, 700)
    later(() => { setKept(true); setConfetti(true) }, 1300)
    later(() => setConfetti(false), 5200)
  }
  const at = cut.length ? cut[cut.length - 1] : -1
  const hook = i => [CX + RX * Math.cos(ang(0, i)), RIM_Y + RY * Math.sin(ang(0, i))]
  const [sx, sy] = at < 0 ? [CX - RX - 6, RIM_Y + 2] : hook(at)
  const colors = useMemo(() => [team?.color ?? '#0a3d91', team?.color2 ?? '#ffffff', '#e8c766', '#ffffff'], [team?.color, team?.color2])
  return (
    <div className="cbbn">
      {confetti && <Confetti colors={colors} />}
      <div className="cbbn-stage">
        {kept ? (
          <div className="cbbn-kept"><KeptNet color={color} /></div>
        ) : (
          <svg className="cbbn-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" onClick={snip}>
            {/* the foot of the backboard, its square, the bracket to the rim */}
            <g className="cbbn-board"><path d="M38 0V46H182V0" /><rect x="84" y="8" width="52" height="30" /></g>
            <rect className="cbbn-bracket" x={CX - 9} y="44" width="18" height="6" />
            <ellipse className="cbbn-rim-back" cx={CX} cy={RIM_Y} rx={RX} ry={RY} />
            <g className={`cbbn-net${down ? ' is-down' : ''}`}>
              <g key={cut.length} className={cut.length ? 'cbbn-sway' : ''}>
                <g className="cbbn-strands cbbn-strands--back" fill="none"><NetLines cut={cut} side={-1} /></g>
                <g className="cbbn-strands" fill="none"><NetLines cut={cut} side={1} /></g>
              </g>
            </g>
            <path className="cbbn-rim-front" d={`M${CX - RX} ${RIM_Y}A${RX} ${RY} 0 0 0 ${CX + RX} ${RIM_Y}`} />
            <Scissors x={sx} y={sy} snip={cut.length} gone={down} color={color} />
          </svg>
        )}
      </div>
      {kept ? (
        <div className="cbbn-caption">{who ? `${who} took the final snip` : 'The net is his'}</div>
      ) : (
        <button type="button" className="cbbn-btn" onClick={snip} disabled={!left}>
          <svg width="18" height="14" viewBox="-34 -12 36 24" aria-hidden="true"><path d="M0 0L-26 -5L-24 -1ZM0 0L-26 5L-24 1Z" fill="currentColor" /><circle cx="-29" cy="-7" r="4" fill="none" stroke="currentColor" strokeWidth="2.4" /><circle cx="-29" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>
          <span>{cut.length ? (left ? `Snip · ${left} left` : 'Net’s down') : 'Cut down the net'}</span>
        </button>
      )}
    </div>
  )
}
