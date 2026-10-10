import { useEffect, useMemo, useRef, useState } from 'react'
import { GAMES, traitValue, zoneWidth, powerZone, reactMs, lanesMs, callMs, routes, DRILL_CALLS, LOOKS } from '../../lib/minigames'
import { seeded } from '../../lib/rng'
import { sfx, haptic } from '../../lib/juice'

// The quick skill games (lib/minigames.js). <MiniGame game build seed onDone />
// shows the card, counts in, runs the game and reports { score, hit }. A test
// can finish any game through window.__bapMini.finish(score).

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const useRng = seed => useMemo(() => seeded(`mg-${seed}`), [seed])

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
  return (
    <div className={`mg mg--${def.kind}${result ? (result.hit ? ' is-hit' : ' is-miss') : ''}`}>
      <div className="mg-head"><span className="ag-eyebrow">{def.title}</span><span className="mg-trait">{def.traits.slice(0, 2).map(t => t.replace(/([A-Z])/g, ' $1')).join(' · ').toUpperCase()} · {v.toFixed(1)}</span></div>
      {stage === 'intro' && (
        <div className="mg-intro">
          <p>{def.how}</p>
          <button className="ag-btn ag-btn--gold" onClick={() => { setStage('play'); sfx('whistle') }}>READY</button>
        </div>
      )}
      {stage === 'play' && <Game def={def} v={v} seed={seed} build={build} onDone={done} />}
      {stage === 'done' && result && (
        <div className="mg-result">
          <b>{result.hit ? (result.score >= 0.85 ? 'PERFECT' : 'CONVERTED') : 'NO GOOD'}</b>
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
    default: return null
  }
}

// ── Timing: a marker sweeps, tap inside the zone ─────────────────────────────
function useSweep(speed = 1.15) {
  const [pos, setPos] = useState(0)
  const t0 = useRef(performance.now())
  useEffect(() => {
    let raf
    const tick = now => { const t = ((now - t0.current) / 1000) * speed; const p = t % 2; setPos(p <= 1 ? p : 2 - p); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed])
  return pos
}
function Bar({ pos, zone, width, label }) {
  return (
    <div className="mg-bar" aria-hidden="true">
      <span className="mg-zone" style={{ left: `${zone - width / 2}%`, width: `${width}%` }} />
      <span className="mg-marker" style={{ left: `${pos * 100}%` }} />
      {label && <i className="mg-bar-label">{label}</i>}
    </div>
  )
}
function Timing({ v, seed, onDone, mult = 1, value = 1, label = null }) {
  const r = useRng(seed)
  const zone = useMemo(() => 30 + r() * 40, [r])
  const width = zoneWidth(v) * mult
  const pos = useSweep()
  const tap = () => {
    const d = Math.abs(pos * 100 - zone)
    const hit = d <= width / 2
    onDone({ score: hit ? value * clamp(1 - d / width, 0.5, 1) : 0, hit, note: hit ? null : d < width ? 'Just late.' : 'Way off.' })
  }
  return (
    <div className="mg-play" onPointerDown={tap}>
      <Bar pos={pos} zone={zone} width={width} label={label} />
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
  const pos = useSweep(1.25)
  const tap = () => {
    const d = Math.abs(pos * 100 - zones[i])
    const s = d <= width / 2 ? clamp(1 - d / width, 0.5, 1) : 0
    sfx(s ? 'tap' : 'pop')
    const next = [...scores, s]
    if (i + 1 >= n) { const avg = next.reduce((a, b) => a + b, 0) / n; onDone({ score: avg, hit: next.filter(Boolean).length >= Math.ceil(n * 0.67), note: `${next.filter(Boolean).length} of ${n}` }) }
    else { setScores(next); setI(i + 1) }
  }
  return (
    <div className="mg-play" onPointerDown={tap}>
      <Bar pos={pos} zone={zones[i]} width={width} />
      <span className="mg-hint">{i + 1} OF {n} · TAP IN THE ZONE</span>
      <span className="mg-dots">{Array.from({ length: n }, (_, k) => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── Power: hold to build, release near the top ──────────────────────────────
function Power({ v, onDone }) {
  const [held, setHeld] = useState(false)
  const [level, setLevel] = useState(0)
  const start = useRef(0)
  const zone = powerZone(v)
  useEffect(() => {
    if (!held) return
    let raf
    const tick = now => { const t = ((now - start.current) / 1000) * 0.9; const p = t % 2; setLevel((p <= 1 ? p : 2 - p) * 100); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [held])
  const down = () => { start.current = performance.now(); setHeld(true) }
  const up = () => {
    if (!held) return
    const hit = level >= 100 - zone
    onDone({ score: hit ? 0.5 + (level - (100 - zone)) / zone * 0.5 : level / 100 * 0.4, hit, note: hit ? `${Math.round(level)}% power` : level < 50 ? 'Let go too early.' : 'Short of the top.' })
  }
  return (
    <div className="mg-play mg-play--power" onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={held ? up : undefined}>
      <div className="mg-meter"><span className="mg-meter-zone" style={{ height: `${zone}%` }} /><span className="mg-meter-fill" style={{ height: `${level}%` }} /></div>
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
    const t1 = setTimeout(() => { setOpen(plan[i].open); openedAt.current = performance.now(); sfx('tick') }, plan[i].delay)
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
    const dt = performance.now() - openedAt.current
    settle(clamp(1 - dt / T, 0.35, 1) , null)
  }
  return (
    <div className="mg-play mg-play--targets">
      <div className="mg-targets">{[0, 1, 2].map(k => <button key={k} className={`mg-target${open === k ? ' is-open' : ''}`} onPointerDown={() => tap(k)} aria-label={`Target ${k + 1}`}><span /></button>)}</div>
      <span className="mg-hint">{open == null ? 'WAIT FOR IT…' : 'NOW'}</span>
      <span className="mg-dots">{Array.from({ length: rounds }, (_, k) => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── Audible: read the look, pick the counter on a clock ─────────────────────
function Clock({ ms, onOut }) {
  const [left, setLeft] = useState(1)
  const t0 = useRef(performance.now())
  useEffect(() => {
    let raf
    const tick = now => { const f = 1 - (now - t0.current) / ms; if (f <= 0) { setLeft(0); onOut(); return } setLeft(f); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ms]) // eslint-disable-line
  return <div className="mg-clock"><span style={{ width: `${left * 100}%` }} /></div>
}
function Audible({ v, seed, onDone }) {
  const r = useRng(seed)
  const look = useMemo(() => LOOKS[Math.floor(r() * LOOKS.length)], [r])
  const T = callMs(v) + 600
  const t0 = useRef(performance.now())
  const pick = k => { const ok = k === look.c; onDone({ score: ok ? clamp(1 - (performance.now() - t0.current) / T * 0.5, 0.5, 1) : 0, hit: ok, note: look.why }) }
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
    const t1 = setTimeout(() => { setFrom(plan[i].from); at.current = performance.now(); sfx('tick') }, plan[i].delay)
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
    settle(clamp(1 - (performance.now() - at.current) / T, 0.4, 1))
  }
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
