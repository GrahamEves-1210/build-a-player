import { useEffect, useMemo, useRef, useState } from 'react'
import { GAMES, traitValue, zoneWidth, powerZone, reactMs, lanesMs, callMs, routes, DRILL_CALLS, LOOKS } from '../../lib/minigames'
import { valToGrade } from '../../utils/simulation'
import { seeded } from '../../lib/rng'
import { sfx, haptic } from '../../lib/juice'

// The quick skill games (lib/minigames.js). <MiniGame game build seed onDone />
// shows the card, runs the game and reports { score, hit }. A test can finish
// any game through window.__bapMini.finish(score).
//
// Everything that moves is drawn straight to the DOM from a requestAnimationFrame
// loop (refs, transforms): React only re-renders on taps, so the games stay
// smooth on the website as well as the phone.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const useRng = seed => useMemo(() => seeded(`mg-${seed}`), [seed])
const now = () => performance.now()
// a requestAnimationFrame loop for as long as `on`; fn(t in seconds since start)
function useLoop(fn, on = true, deps = []) {
  const f = useRef(fn); f.current = fn
  useEffect(() => {
    if (!on) return
    let raf, t0 = now()
    const tick = t => { if (f.current((t - t0) / 1000) !== false) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, ...deps]) // eslint-disable-line
}
// keys for the desktop: map of key → action
function useKeys(map, on = true) {
  const m = useRef(map); m.current = map
  useEffect(() => {
    if (!on) return
    const h = e => { const fn = m.current[e.key] ?? m.current[e.key.toLowerCase()]; if (fn && !e.repeat) { e.preventDefault(); fn() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [on])
}
const tri = t => { const p = t % 2; return p <= 1 ? p : 2 - p }     // 0→1→0 sweep

export default function MiniGame({ game, build, seed = 'x', onDone, autoStart = false }) {
  const def = GAMES[game]
  const [stage, setStage] = useState(autoStart ? 'play' : 'intro')
  const [result, setResult] = useState(null)
  const v = traitValue(game, build)
  const done = r => {
    if (result) return
    const out = { score: clamp(r.score, 0, 1), hit: r.hit ?? r.score >= 0.5, note: r.note ?? null }
    setResult(out); setStage('done')
    sfx(out.hit ? 'claim' : 'deny'); haptic(out.hit ? 'success' : 'heavy')
    setTimeout(() => onDone?.(out), 900)
  }
  useEffect(() => { window.__bapMini = { finish: s => done({ score: s, hit: s >= 0.5 }) }; return () => { if (window.__bapMini) delete window.__bapMini } }, [result]) // eslint-disable-line
  if (!def) return null
  const traitNames = def.traits.slice(0, 2).map(t => t.replace(/([A-Z])/g, ' $1').replace('-', ' ')).join(' · ').toUpperCase()
  return (
    <div className={`mg mg--${def.kind}${result ? (result.hit ? ' is-hit' : ' is-miss') : ''}`}>
      <div className="mg-head"><span className="ag-eyebrow">{def.title}</span><span className="mg-trait">{traitNames} · {valToGrade(v)}</span></div>
      {stage === 'intro' && (
        <div className="mg-intro">
          <p>{def.how}</p>
          <button className="ag-btn ag-btn--gold" onClick={() => { setStage('play'); sfx('whistle') }}>READY</button>
        </div>
      )}
      {stage === 'play' && <Game def={def} v={v} seed={seed} build={build} onDone={done} />}
      {stage === 'done' && result && (
        <div className="mg-result">
          <b>{result.hit ? (result.score >= 0.85 ? 'ELITE' : 'GOOD') : 'NO GOOD'}</b>
          {result.note && <small>{result.note}</small>}
        </div>
      )}
    </div>
  )
}

function Game({ def, v, seed, build, onDone }) {
  switch (def.kind) {
    case 'timing': return <Timing v={v} seed={seed} onDone={onDone} />
    case 'taps': return <Taps v={v} seed={seed} n={def.n ?? 3} onDone={onDone} />
    case 'power': return <Power v={v} onDone={onDone} />
    case 'reaction': return <Reaction v={v} seed={seed} rounds={def.rounds ?? 2} onDone={onDone} />
    case 'audible': return <Audible v={v} seed={seed} onDone={onDone} />
    case 'lanes': return <Lanes v={v} seed={seed} onDone={onDone} />
    case 'sequence': return <Sequence v={v} seed={seed} onDone={onDone} />
    case 'route': return <Route v={v} seed={seed} onDone={onDone} />
    case 'choice': return <Choice def={def} build={build} seed={seed} onDone={onDone} />
    // the combine
    case 'dash': return <Dash v={v} seed={seed} onDone={onDone} />
    case 'velo': return <Velo v={v} seed={seed} onDone={onDone} />
    case 'aim': return <Aim v={v} seed={seed} onDone={onDone} />
    case 'cone': return <Cone v={v} seed={seed} onDone={onDone} />
    case 'gauntlet': return <Gauntlet v={v} seed={seed} onDone={onDone} />
    case 'bench': return <Bench v={v} onDone={onDone} />
    default: return null
  }
}

// ── Timing: a marker sweeps, tap inside the zone ─────────────────────────────
function Bar({ markRef, zone, width, label }) {
  return (
    <div className="mg-bar" aria-hidden="true">
      <span className="mg-zone" style={{ left: `${zone - width / 2}%`, width: `${width}%` }} />
      <span className="mg-track" ref={markRef}><span className="mg-marker" /></span>
      {label && <i className="mg-bar-label">{label}</i>}
    </div>
  )
}
// sweeps the marker; returns a ref with the current position (0–1)
function useSweep(markRef, speed = 1.15, on = true) {
  const pos = useRef(0)
  useLoop(t => { pos.current = tri(t * speed); if (markRef.current) markRef.current.style.transform = `translate3d(${pos.current * 100}%,0,0)` }, on)
  return pos
}
function Timing({ v, seed, onDone, mult = 1, value = 1, label = null }) {
  const r = useRng(seed)
  const zone = useMemo(() => 30 + r() * 40, [r])
  const width = zoneWidth(v) * mult
  const mark = useRef(null)
  const pos = useSweep(mark)
  const tap = () => {
    const d = Math.abs(pos.current * 100 - zone)
    const hit = d <= width / 2
    onDone({ score: hit ? value * clamp(1 - d / width, 0.5, 1) : 0, hit, note: hit ? null : d < width ? 'Just late.' : 'Way off.' })
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-play" onPointerDown={tap}>
      <Bar markRef={mark} zone={zone} width={width} label={label} />
      <span className="mg-hint">TAP IN THE ZONE</span>
    </div>
  )
}
// ── Taps: timing, n in a row ────────────────────────────────────────────────
function Taps({ v, seed, n, onDone }) {
  const [i, setI] = useState(0)
  const [scores, setScores] = useState([])
  const r = useRng(seed)
  const zones = useMemo(() => Array.from({ length: n }, () => 25 + r() * 50), [r, n])
  const width = zoneWidth(v)
  const mark = useRef(null)
  const pos = useSweep(mark, 1.25 + i * 0.12)
  const tap = () => {
    const d = Math.abs(pos.current * 100 - zones[i])
    const s = d <= width / 2 ? clamp(1 - d / width, 0.5, 1) : 0
    sfx(s ? 'tap' : 'pop')
    const next = [...scores, s]
    if (i + 1 >= n) { const avg = next.reduce((a, b) => a + b, 0) / n; onDone({ score: avg, hit: next.filter(Boolean).length >= Math.ceil(n * 0.67), note: `${next.filter(Boolean).length} of ${n}` }) }
    else { setScores(next); setI(i + 1) }
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-play" onPointerDown={tap}>
      <Bar markRef={mark} zone={zones[i]} width={width} />
      <span className="mg-hint">{i + 1} OF {n} · TAP IN THE ZONE</span>
      <span className="mg-dots">{Array.from({ length: n }, (_, k) => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── Power: hold to build, release near the top ──────────────────────────────
function Power({ v, onDone }) {
  const [held, setHeld] = useState(false)
  const level = useRef(0), fill = useRef(null)
  const zone = powerZone(v)
  useLoop(t => { level.current = tri(t * 0.9) * 100; if (fill.current) fill.current.style.transform = `scaleY(${level.current / 100})` }, held)
  const down = () => { if (!held) setHeld(true) }
  const up = () => {
    if (!held) return
    const L = level.current
    const hit = L >= 100 - zone
    onDone({ score: hit ? 0.5 + (L - (100 - zone)) / zone * 0.5 : L / 100 * 0.4, hit, note: hit ? `${Math.round(L)}% power` : L < 50 ? 'Let go too early.' : 'Short of the top.' })
  }
  return (
    <div className="mg-play mg-play--power" onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={held ? up : undefined}>
      <div className="mg-meter"><span className="mg-meter-zone" style={{ height: `${zone}%` }} /><span className="mg-meter-fill" ref={fill} /></div>
      <span className="mg-hint">{held ? 'RELEASE NEAR THE TOP' : 'HOLD TO LOAD'}</span>
    </div>
  )
}
// ── Reaction: three targets, one opens ──────────────────────────────────────
function Reaction({ v, seed, rounds, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => Array.from({ length: rounds }, () => ({ delay: 500 + r() * 900, open: Math.floor(r() * 3) })), [r, rounds])
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(null)
  const [scores, setScores] = useState([])
  const openedAt = useRef(0)
  const T = reactMs(v)
  useEffect(() => {
    setOpen(null)
    const t1 = setTimeout(() => { setOpen(plan[i].open); openedAt.current = now(); sfx('tick') }, plan[i].delay)
    const t2 = setTimeout(() => settle(0, 'Window closed.'), plan[i].delay + T + 60)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = (s, note) => {
    const next = [...scores, s]
    if (i + 1 >= rounds) { const avg = next.reduce((a, b) => a + b, 0) / rounds; onDone({ score: avg, hit: avg >= 0.5, note: avg >= 0.5 ? null : note }) }
    else { setScores(next); setI(i + 1) }
  }
  const tap = k => {
    if (open == null) { settle(0, 'Jumped early.'); return }
    if (k !== open) { settle(0, 'Wrong read.'); return }
    settle(clamp(1 - (now() - openedAt.current) / T, 0.35, 1), null)
  }
  useKeys({ 1: () => tap(0), 2: () => tap(1), 3: () => tap(2), ArrowLeft: () => tap(0), ArrowUp: () => tap(1), ArrowRight: () => tap(2) })
  return (
    <div className="mg-play mg-play--targets">
      <div className="mg-targets">{[0, 1, 2].map(k => <button key={k} className={`mg-target${open === k ? ' is-open' : ''}`} onPointerDown={() => tap(k)} aria-label={`Target ${k + 1}`}><span /></button>)}</div>
      <span className="mg-hint">{open == null ? 'WAIT FOR IT…' : 'NOW'}</span>
      <span className="mg-dots">{Array.from({ length: rounds }, (_, k) => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── A shrinking clock bar ───────────────────────────────────────────────────
// (a CSS animation drains it on the compositor; a timer calls time)
function Clock({ ms, onOut }) {
  const out = useRef(onOut); out.current = onOut
  useEffect(() => { const t = setTimeout(() => out.current(), ms); return () => clearTimeout(t) }, [ms])
  return <div className="mg-clock"><span style={{ animation: `mg-drain ${ms}ms linear forwards`, '--mg-ms': `${ms}ms` }} /></div>
}
function Audible({ v, seed, onDone }) {
  const r = useRng(seed)
  const look = useMemo(() => LOOKS[Math.floor(r() * LOOKS.length)], [r])
  const T = callMs(v) + 600
  const t0 = useRef(now())
  const pick = k => { const ok = k === look.c; onDone({ score: ok ? clamp(1 - (now() - t0.current) / T * 0.5, 0.5, 1) : 0, hit: ok, note: look.why }) }
  useKeys({ 1: () => pick(0), 2: () => pick(1), 3: () => pick(2) })
  return (
    <div className="mg-play mg-play--calls">
      <Clock ms={T} onOut={() => onDone({ score: 0, hit: false, note: 'Delay of game.' })} />
      <span className="mg-look">{look.s}</span>
      <div className="mg-calls">{look.a.map((a, k) => <button key={k} className="mg-call" onPointerDown={() => pick(k)}>{a}</button>)}</div>
    </div>
  )
}
// ── Lanes: the rush comes from a side; go the other way ─────────────────────
function Lanes({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => Array.from({ length: 3 }, () => ({ delay: 450 + r() * 700, from: r() < 0.5 ? 'L' : 'R' })), [r])
  const [i, setI] = useState(0)
  const [from, setFrom] = useState(null)
  const [scores, setScores] = useState([])
  const at = useRef(0)
  const T = lanesMs(v)
  useEffect(() => {
    setFrom(null)
    const t1 = setTimeout(() => { setFrom(plan[i].from); at.current = now(); sfx('tick') }, plan[i].delay)
    const t2 = setTimeout(() => settle(0), plan[i].delay + T + 60)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = s => {
    const next = [...scores, s]
    if (i + 1 >= 3) { const avg = next.reduce((a, b) => a + b, 0) / 3; onDone({ score: avg, hit: next.filter(Boolean).length >= 2, note: `${next.filter(Boolean).length} of 3` }) }
    else { setScores(next); setI(i + 1) }
  }
  const go = side => {
    if (from == null) { settle(0); return }
    if ((from === 'L' && side !== 'R') || (from === 'R' && side !== 'L')) { settle(0); return }
    settle(clamp(1 - (now() - at.current) / T, 0.4, 1))
  }
  useKeys({ ArrowLeft: () => go('L'), ArrowRight: () => go('R'), a: () => go('L'), d: () => go('R') })
  return (
    <div className="mg-play mg-play--lanes">
      <div className={`mg-rush${from ? ` is-${from}` : ''}`}><i>{from === 'L' ? '◀ RUSH' : from === 'R' ? 'RUSH ▶' : '…'}</i></div>
      <div className="mg-sides"><button className="mg-side" onPointerDown={() => go('L')}>◀ LEFT</button><button className="mg-side" onPointerDown={() => go('R')}>RIGHT ▶</button></div>
      <span className="mg-dots">{[0, 1, 2].map(k => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── Sequence: the two-minute drill ──────────────────────────────────────────
function Sequence({ v, seed, onDone }) {
  const r = useRng(seed)
  const calls = useMemo(() => [...DRILL_CALLS].sort(() => r() - .5).slice(0, 4), [r])
  const [i, setI] = useState(0)
  const [right, setRight] = useState(0)
  const T = callMs(v)
  const step = ok => {
    const n = right + (ok ? 1 : 0)
    if (i + 1 >= calls.length) onDone({ score: n / calls.length, hit: n >= 3, note: `${n} of ${calls.length} right` })
    else { setRight(n); setI(i + 1); sfx(ok ? 'tap' : 'pop') }
  }
  const c = calls[i]
  useKeys({ 1: () => step(c.c === 0), 2: () => step(c.c === 1), 3: () => step(c.c === 2) })
  return (
    <div className="mg-play mg-play--calls" key={i}>
      <Clock ms={T} onOut={() => step(false)} />
      <span className="mg-look">{c.s}</span>
      <div className="mg-calls">{c.a.map((a, k) => <button key={k} className="mg-call" onPointerDown={() => step(k === c.c)}>{a}</button>)}</div>
      <span className="mg-hint">CALL {i + 1} OF {calls.length}</span>
    </div>
  )
}
// ── Route: pick it, then hit its window ─────────────────────────────────────
function Route({ v, seed, onDone }) {
  const [route, setRoute] = useState(null)
  if (!route) return (
    <div className="mg-play mg-play--calls">
      <span className="mg-look">3RD & 9 · PICK THE ROUTE</span>
      <div className="mg-calls">{routes(v).map(([id, label, mult, val]) => <button key={id} className="mg-call" onPointerDown={() => setRoute({ id, label, mult, val })}>{label}<small>{id === 'slant' ? 'easy · a first down' : id === 'dig' ? 'medium · chunk play' : 'hard · touchdown'}</small></button>)}</div>
    </div>
  )
  return <Timing v={v} seed={`${seed}-${route.id}`} mult={route.mult} value={route.val} label={route.label} onDone={onDone} />
}
// ── Choice: two ways to play it ─────────────────────────────────────────────
function Choice({ def, build, seed, onDone }) {
  const [pick, setPick] = useState(null)
  if (!pick) return (
    <div className="mg-play mg-play--calls">
      <span className="mg-look">{def.title}</span>
      <div className="mg-calls">{def.options.map(([id, label, kind, traits]) => <button key={id} className="mg-call" onPointerDown={() => setPick({ id, kind, v: traitValue(null, build, traits) })}>{label}<small>{traits.join(' · ')}</small></button>)}</div>
    </div>
  )
  return pick.kind === 'timing' ? <Timing v={pick.v} seed={`${seed}-${pick.id}`} onDone={onDone} /> : <Lanes v={pick.v} seed={`${seed}-${pick.id}`} onDone={onDone} />
}

// ═══ The combine ═══════════════════════════════════════════════════════════
// ── 40-yard dash: hold for the gun, then alternate feet as fast as you can ──
function Dash({ v, seed, onDone }) {
  const r = useRng(seed)
  const [phase, setPhase] = useState('set')          // set → go
  const [flag, setFlag] = useState(null)              // 'false start' message
  const S = useRef({ goAt: 0, yards: 0, last: null, taps: 0, stumbles: 0, falses: 0, first: 0, done: false })
  const runner = useRef(null), yd = useRef(null), gun = useRef(null)
  const stride = 1.0 + v * 0.055                      // a faster player covers more ground a step
  // the gun: a random wait, so it can't be timed (a false start resets it)
  const arm = () => { clearTimeout(gun.current); gun.current = setTimeout(() => { S.current.goAt = now(); setPhase('go'); sfx('whistle'); haptic('medium') }, 900 + r() * 1500) }
  useEffect(() => { arm(); return () => clearTimeout(gun.current) }, []) // eslint-disable-line
  // give up after 10 seconds of running
  useEffect(() => { if (phase !== 'go') return; const t = setTimeout(() => finish(), 10000); return () => clearTimeout(t) }, [phase]) // eslint-disable-line
  const finish = () => {
    const s = S.current; if (s.done) return; s.done = true
    const secs = (now() - s.goAt) / 1000
    const react = s.first ? (s.first - s.goAt) / 1000 : 1
    const score = clamp((6.0 - secs) / 2.8, 0, 1) - s.falses * 0.12 - Math.min(0.2, s.stumbles * 0.03)
    onDone({ score, hit: score >= 0.5, note: `${s.yards >= 40 ? 'Through the line' : 'Ran out of time'} · ${react < 0.25 ? 'great jump' : react < 0.45 ? 'clean start' : 'slow start'}${s.falses ? ' · false start' : ''}${s.stumbles ? ` · ${s.stumbles} stumble${s.stumbles > 1 ? 's' : ''}` : ''}` })
  }
  const foot = side => {
    const s = S.current
    if (s.done) return
    if (phase === 'set') { if (s.falses < 2) { s.falses++; setFlag(`FALSE START${s.falses > 1 ? ' · LAST WARNING' : ''}`); sfx('deny'); haptic('heavy'); arm() } return }
    if (!s.first) s.first = now()
    s.taps++
    if (side === s.last) { s.stumbles++; s.yards += stride * 0.25; haptic('light') } else s.yards += stride
    s.last = side
    const y = Math.min(40, s.yards)
    if (runner.current) runner.current.style.transform = `translate3d(${(y / 40) * 100}%,0,0)`
    if (yd.current) yd.current.textContent = `${Math.round(y)} YDS`
    if (s.yards >= 40) finish()
  }
  useKeys({ ArrowLeft: () => foot('L'), ArrowRight: () => foot('R'), f: () => foot('L'), j: () => foot('R') })
  return (
    <div className="mg-play mg-play--dash">
      <div className="mg-lane"><span className="mg-runner-track" ref={runner}><span className="mg-runner" /></span><span className="mg-goal" /></div>
      <span className={`mg-call-out${phase === 'go' ? ' is-go' : ''}`}>{phase === 'set' ? (flag ?? 'SET…') : 'GO!'}</span>
      <span className="mg-hint" ref={yd}>0 YDS</span>
      <div className="mg-feet">
        <button className="mg-foot" onPointerDown={() => foot('L')} aria-label="Left foot">LEFT</button>
        <button className="mg-foot" onPointerDown={() => foot('R')} aria-label="Right foot">RIGHT</button>
      </div>
      <span className="mg-sub">Wait for GO, then alternate LEFT and RIGHT. Same foot twice is a stumble.</span>
    </div>
  )
}
// ── Throwing velocity: three throws, release on a small moving sweet spot ────
function Velo({ v, seed, onDone }) {
  const r = useRng(seed)
  const spots = useMemo(() => [0, 1, 2].map(() => 66 + r() * 26), [r])
  const half = 2.8 + v * 0.42                                  // a stronger arm is a bigger sweet spot
  const [i, setI] = useState(0)
  const [held, setHeld] = useState(false)
  const [scores, setScores] = useState([])
  const level = useRef(0), fill = useRef(null)
  useLoop(t => { level.current = tri(t * (1.05 + i * 0.3)) * 100; if (fill.current) fill.current.style.transform = `scaleY(${level.current / 100})` }, held, [i])
  const release = () => {
    if (!held) return
    setHeld(false)
    const d = Math.abs(level.current - spots[i])
    const s = d <= half ? clamp(1 - d / (half * 2), 0.5, 1) : clamp(0.35 - (d - half) / 40, 0, 0.35)
    sfx(d <= half ? 'tap' : 'pop'); haptic(d <= half ? 'medium' : 'light')
    const next = [...scores, s]
    if (i + 1 >= 3) { const avg = next.reduce((a, b) => a + b, 0) / 3; onDone({ score: avg, hit: avg >= 0.5, note: `${next.filter(x => x >= 0.5).length} of 3 on the money` }) }
    else { setScores(next); setI(i + 1); if (fill.current) fill.current.style.transform = 'scaleY(0)' }
  }
  useKeys({ ' ': () => (held ? release() : setHeld(true)) })
  return (
    <div className="mg-play mg-play--power" onPointerDown={() => setHeld(true)} onPointerUp={release} onPointerCancel={release} onPointerLeave={held ? release : undefined}>
      <div className="mg-meter mg-meter--wide">
        <span className="mg-meter-spot" style={{ bottom: `${spots[i] - half}%`, height: `${half * 2}%` }} />
        <span className="mg-meter-fill" ref={fill} />
      </div>
      <span className="mg-hint">THROW {i + 1} OF 3 · {held ? 'LET GO IN THE GREEN' : 'HOLD TO WIND UP'}</span>
      <span className="mg-dots">{[0, 1, 2].map(k => <i key={k} className={k < scores.length ? (scores[k] >= 0.5 ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── Accuracy: lock the aim across, then up and down, on four nets ───────────
function Aim({ v, seed, onDone }) {
  const r = useRng(seed)
  const nets = useMemo(() => [0, 1, 2, 3].map(() => ({ x: 15 + r() * 70, y: 18 + r() * 64 })), [r])
  const rad = 6 + v * 0.75                                      // the net's size in % of the field
  const [i, setI] = useState(0)
  const [axis, setAxis] = useState('x')
  const [scores, setScores] = useState([])
  const [shot, setShot] = useState(null)
  const X = useRef(50), Y = useRef(50), lx = useRef(null), ly = useRef(null)
  const speed = 0.75 + i * 0.18
  useLoop(t => {
    if (axis === 'x') { X.current = tri(t * speed) * 100; if (lx.current) lx.current.style.transform = `translate3d(${X.current}%,0,0)` }
    else { Y.current = tri(t * speed * 1.15) * 100; if (ly.current) ly.current.style.transform = `translate3d(0,${Y.current}%,0)` }
  }, !shot, [axis, i])
  const tap = () => {
    if (shot) return
    if (axis === 'x') { setAxis('y'); sfx('tick'); return }
    const n = nets[i]
    const d = Math.hypot(X.current - n.x, (Y.current - n.y) * 0.6)
    const s = d <= rad ? clamp(1 - (d / rad) * 0.5, 0.5, 1) : 0
    sfx(s ? 'claim' : 'pop'); haptic(s ? 'medium' : 'light')
    setShot({ x: X.current, y: Y.current, hit: !!s })
    const next = [...scores, s]
    setTimeout(() => {
      if (i + 1 >= nets.length) { const avg = next.reduce((a, b) => a + b, 0) / nets.length; onDone({ score: avg, hit: avg >= 0.5, note: `${next.filter(Boolean).length} of ${nets.length} in the net` }) }
      else { setScores(next); setI(i + 1); setAxis('x'); setShot(null) }
    }, 450)
  }
  useKeys({ ' ': tap, Enter: tap })
  const n = nets[i]
  return (
    <div className="mg-play mg-play--aim" onPointerDown={tap}>
      <div className="mg-field">
        <span className="mg-net" style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${rad * 2}%` }} />
        <span className={`mg-line-x${axis === 'x' && !shot ? ' is-live' : ''}`} ref={lx} />
        {axis === 'y' && <span className={`mg-line-y${!shot ? ' is-live' : ''}`} ref={ly} />}
        {shot && <span className={`mg-ball${shot.hit ? ' is-hit' : ''}`} style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />}
      </div>
      <span className="mg-hint">NET {i + 1} OF {nets.length} · {axis === 'x' ? 'TAP TO LOCK LEFT–RIGHT' : 'TAP TO LOCK UP–DOWN'}</span>
      <span className="mg-dots">{nets.map((_, k) => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── 3-cone: six calls, each a direction; react before the window shuts ──────
const DIRS = [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']]
function Cone({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => Array.from({ length: 6 }, () => ({ gap: 250 + r() * 400, dir: Math.floor(r() * 4) })), [r])
  const [i, setI] = useState(0)
  const [cue, setCue] = useState(null)
  const [scores, setScores] = useState([])
  const at = useRef(0), settled = useRef(false)
  const T = (480 + v * 42) * Math.pow(0.93, i)
  useEffect(() => {
    setCue(null); settled.current = false
    const t1 = setTimeout(() => { setCue(plan[i].dir); at.current = now(); sfx('tick') }, plan[i].gap)
    const t2 = setTimeout(() => settle(0), plan[i].gap + T)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = s => {
    if (settled.current) return; settled.current = true
    const next = [...scores, s]
    if (s) haptic('light')
    if (i + 1 >= plan.length) { const avg = next.reduce((a, b) => a + b, 0) / plan.length; onDone({ score: avg, hit: avg >= 0.5, note: `${next.filter(Boolean).length} of ${plan.length} clean cuts` }) }
    else { setScores(next); setI(i + 1) }
  }
  const go = d => {
    if (cue == null) { settle(0); return }
    settle(d === cue ? clamp(1 - (now() - at.current) / T * 0.6, 0.4, 1) : 0)
  }
  useKeys({ ArrowUp: () => go(0), ArrowLeft: () => go(1), ArrowRight: () => go(2), ArrowDown: () => go(3), w: () => go(0), a: () => go(1), d: () => go(2), s: () => go(3) })
  return (
    <div className="mg-play mg-play--cone">
      <span className={`mg-cue${cue != null ? ' is-on' : ''}`}>{cue != null ? DIRS[cue][1] : '•'}</span>
      <div className="mg-pad">{DIRS.map(([id, glyph], k) => <button key={id} className={`mg-dir mg-dir--${id}`} onPointerDown={() => go(k)} aria-label={id}>{glyph}</button>)}</div>
      <span className="mg-dots">{plan.map((_, k) => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── Gauntlet: balls down two lanes, faster and overlapping; catch in the zone ─
function Gauntlet({ v, seed, onDone }) {
  const r = useRng(seed)
  const N = 7
  const balls = useMemo(() => { let t = 0.5; return Array.from({ length: N }, (_, k) => { const b = { lane: r() < 0.5 ? 0 : 1, at: t, dur: 1.15 - k * 0.07 }; t += 0.75 - k * 0.05; return b }) }, [r])
  const zone = 9 + v * 1.1                                      // the catch zone's height, % of the lane (from the bottom)
  const st = useRef(balls.map(() => null))                      // null = in the air, number = score
  const els = useRef([]), laneH = useRef(190), shown = useRef([])
  const [, force] = useState(0)
  const T0 = useRef(now())
  const posOf = (b, t) => (t - b.at) / b.dur * 100            // 0 = top, 100 = bottom
  useLoop(() => {
    const t = (now() - T0.current) / 1000
    let changed = false
    balls.forEach((b, k) => {
      const el = els.current[k]; if (!el) return
      const p = posOf(b, t)
      if (st.current[k] == null && p > 100 + zone * 0.3) { st.current[k] = 0; changed = true }
      const vis = st.current[k] == null && p >= 0
      if (shown.current[k] !== vis) { shown.current[k] = vis; el.style.visibility = vis ? 'visible' : 'hidden' }
      if (vis) el.style.transform = `translate3d(-50%,${(clamp(p, 0, 110) / 100) * laneH.current}px,0)`
    })
    if (changed) force(x => x + 1)
    if (st.current.every(x => x != null)) {
      const caught = st.current.filter(Boolean)
      onDone({ score: st.current.reduce((a, b) => a + b, 0) / N, hit: caught.length >= 5, note: `${caught.length} of ${N} caught` })
      return false
    }
  })
  const grab = lane => {
    const t = (now() - T0.current) / 1000
    // the lowest ball in the air in this lane
    let best = -1, bp = -1
    balls.forEach((b, k) => { const p = posOf(b, t); if (b.lane === lane && st.current[k] == null && p >= 0 && p > bp) { best = k; bp = p } })
    if (best < 0) { sfx('pop'); return }
    const d = Math.abs(bp - (100 - zone / 2))
    st.current[best] = d <= zone / 2 + 2 ? clamp(1 - d / zone, 0.5, 1) : 0
    sfx(st.current[best] ? 'tap' : 'pop'); haptic(st.current[best] ? 'light' : 'heavy')
    force(x => x + 1)
  }
  useKeys({ ArrowLeft: () => grab(0), ArrowRight: () => grab(1), f: () => grab(0), j: () => grab(1) })
  return (
    <div className="mg-play mg-play--gauntlet">
      <div className="mg-lanes">
        {[0, 1].map(l => (
          <div key={l} className="mg-glane" ref={el => { if (el) laneH.current = el.clientHeight }}>
            <span className="mg-gzone" style={{ height: `${zone}%` }} />
            {balls.map((b, k) => b.lane === l && <span key={k} className={`mg-gball${st.current[k] != null ? (st.current[k] ? ' is-hit' : ' is-miss') : ''}`} ref={el => { els.current[k] = el }} />)}
          </div>
        ))}
      </div>
      <div className="mg-sides"><button className="mg-side" onPointerDown={() => grab(0)}>◀ CATCH</button><button className="mg-side" onPointerDown={() => grab(1)}>CATCH ▶</button></div>
      <span className="mg-dots">{balls.map((_, k) => <i key={k} className={st.current[k] != null ? (st.current[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── Bench press: drive the bar up against gravity, as many reps as you can ──
function Bench({ v, onDone }) {
  const S = useRef({ h: 0, vel: 0, reps: 0, fatigue: 1, end: 0, done: false })
  const bar = useRef(null), count = useRef(null), secs = useRef(null)
  const push = 9 + v * 0.7                                      // what one tap lifts (stronger = more)
  const SECS = 12
  useEffect(() => { S.current.end = now() + SECS * 1000 }, [])
  useLoop(() => {
    const s = S.current; if (s.done) return false
    const t = now(), dt = Math.min(0.05, (t - (s.last ?? t)) / 1000); s.last = t
    const left = (s.end - t) / 1000
    // gravity grows as the arms tire
    s.h = Math.max(0, s.h - (34 + (1 - s.fatigue) * 60) * dt)
    if (bar.current) bar.current.style.transform = `translate3d(0,${-s.h}%,0)`
    const shown = Math.max(0, left).toFixed(1); if (secs.current && secs.current.textContent !== shown) secs.current.textContent = shown
    if (left <= 0) {
      s.done = true
      const reps = s.reps
      onDone({ score: clamp((reps - 3) / 9, 0, 1), hit: reps >= 8, note: `${reps} clean reps` })
      return false
    }
  })
  const tap = () => {
    const s = S.current; if (s.done) return
    s.h += push * s.fatigue
    if (s.h >= 100) { s.h = 0; s.reps++; s.fatigue *= 0.94; sfx('tap'); haptic('medium'); if (count.current) count.current.textContent = `${s.reps} REPS` }
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-play mg-play--bench" onPointerDown={tap}>
      <span className="mg-secs" ref={secs}>{SECS.toFixed(1)}</span>
      <div className="mg-rack"><span className="mg-lockout" /><span className="mg-barbell-track" ref={bar}><span className="mg-barbell" /></span></div>
      <span className="mg-hint" ref={count}>0 REPS</span>
      <span className="mg-sub">Tap fast to drive the bar to lockout. It gets heavier every rep. {SECS} seconds.</span>
    </div>
  )
}
