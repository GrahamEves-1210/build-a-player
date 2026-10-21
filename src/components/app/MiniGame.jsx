import { useEffect, useMemo, useRef, useState } from 'react'
import { GAMES, traitValue, zoneWidth, powerZone, reactMs, lanesMs, callMs, routes, DRILL_CALLS, LOOKS } from '../../lib/minigames'
import { valToGrade } from '../../utils/simulation'
import { seeded } from '../../lib/rng'
import { sfx, haptic } from '../../lib/juice'
import { IS_APP } from '../../lib/platform'
import WatchVideo from './WatchVideo'
import { REWARDED_ON } from '../../lib/rewardedAd'

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

// retry (Career, app): a miss can be played again for a video, once
export default function MiniGame({ game, build, seed = 'x', onDone, autoStart = false, hard = false, retry = false, lock = null }) {
  const def = GAMES[game]
  const [stage, setStage] = useState(autoStart ? 'play' : 'intro')
  const [result, setResult] = useState(null)
  const [tries, setTries] = useState(0)          // replays bought with a video (one at most)
  const offerRetry = REWARDED_ON && retry && IS_APP && tries === 0
  // hard (training camp): played as if the trait were a notch or two lower (70%), so a
  // maxed build still has to earn it. The header shows the real grade, never the handicap.
  const real = traitValue(game, build)
  const v = hard ? Math.max(1, real * 0.7) : real
  const done = r => {
    if (result) return
    const perfect = !!r.raw && r.raw.of > 0 && r.raw.made === r.raw.of
    const out = { score: clamp(r.score, 0, 1), hit: perfect || (hard ? r.score >= 0.75 : r.hit ?? r.score >= 0.5), note: r.note ?? null, raw: r.raw ?? null, out: !!r.out }
    setResult(out); setStage('done')
    sfx(out.hit ? 'claim' : 'deny'); haptic(out.hit ? 'success' : 'heavy')
    // a miss that can still be replayed waits for the player's call
    if (!out.hit && offerRetry) return
    setTimeout(() => { unlock(); onDone?.(out) }, 900)
  }
  // Career (lock): a drill that was started and never finished (a reload, a closed app) is a
  // miss. The game is seeded, so replaying it after a reload was a free practice run
  const lockKey = lock ? `bap_mg_${lock}` : null
  const unlock = () => { if (lockKey) try { localStorage.removeItem(lockKey) } catch {} }
  useEffect(() => {
    if (!lockKey) return
    let left = false
    try { left = !!localStorage.getItem(lockKey) } catch {}
    if (left) { unlock(); onDone?.({ score: 0, hit: false, note: 'Left before it finished: counted as a miss', raw: null, out: false }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (lockKey && stage === 'play') try { localStorage.setItem(lockKey, '1') } catch {} }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  // a test hook for the dev server only (a live build has no way to force a score)
  useEffect(() => { if (!import.meta.env.DEV) return; window.__bapMini = { finish: s => done({ score: s, hit: s >= 0.5 }) }; return () => { if (window.__bapMini) delete window.__bapMini } }, [result]) // eslint-disable-line
  if (!def) return null
  const traitNames = def.traits.slice(0, 2).map(t => t.replace(/([A-Z])/g, ' $1').replace('-', ' ')).join(' · ').toUpperCase()
  return (
    <div className={`mg mg--${def.kind}${result ? (result.hit ? ' is-hit' : ' is-miss') : ''}`}>
      <div className="mg-head"><span className="ag-eyebrow">{def.title}</span><span className="mg-trait">{traitNames} · {valToGrade(real)}{hard && <i className="mg-hard">CAMP · TOUGHER</i>}</span></div>
      {stage === 'intro' && (
        <div className="mg-intro">
          <p>{def.how}</p>
          <button className="ag-btn ag-btn--gold" onClick={() => { setStage('play'); sfx('whistle') }}>READY</button>
        </div>
      )}
      {stage === 'play' && <Game key={tries} def={def} v={v} seed={tries ? `${seed}-again` : seed} build={build} onDone={done} />}
      {stage === 'done' && result && (
        <div className="mg-result">
          <b>{result.hit ? (result.score >= 0.85 ? 'ELITE' : 'GOOD') : result.out ? 'OUT OF TIME' : 'NO GOOD'}</b>
          {result.note && <small>{result.note}</small>}
          {!result.hit && offerRetry && (
            <div className="mg-retry">
              <WatchVideo label="WATCH VIDEO · TRY AGAIN" sub="A short video ad, then one more shot at it. Once." onReward={() => { setTries(1); setResult(null); setStage('play') }} />
              <button className="ag-btn ag-btn--ghost" onClick={() => onDone?.(result)}>TAKE THE RESULT</button>
            </div>
          )}
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
    case 'reaction': return <Reaction v={v} seed={seed} rounds={def.rounds ?? 2} quick={def.quick ?? 1} onDone={onDone} />
    case 'audible': return <Audible v={v} seed={seed} onDone={onDone} />
    case 'lanes': return <Lanes v={v} seed={seed} onDone={onDone} need={def.need ?? 2} cue={def.cue} />
    case 'sequence': return <Sequence v={v} seed={seed} onDone={onDone} />
    case 'route': return <Route v={v} seed={seed} onDone={onDone} />
    case 'choice': return <Choice def={def} build={build} seed={seed} onDone={onDone} />
    // the combine
    case 'dash': return <Dash v={v} seed={seed} onDone={onDone} unit={def.unit} dist={def.dist} />
    case 'velo': return <Velo v={v} seed={seed} onDone={onDone} noun={def.noun} />
    case 'aim': return <Aim v={v} seed={seed} onDone={onDone} noun={def.noun} />
    case 'routes': return <Routes v={v} seed={seed} onDone={onDone} />
    case 'cone': return <Cone v={v} seed={seed} onDone={onDone} />
    case 'gauntlet': return <Gauntlet v={v} seed={seed} onDone={onDone} />
    case 'bench': return <Bench v={v} load={def.load ?? 1} onDone={onDone} />
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
// sweeps the marker; returns a ref with the current position (0–1).
// wobble (0–1): the marker surges and stalls instead of a steady sweep, so it
// can't be timed off the rhythm alone (it never stops or runs backwards)
function useSweep(markRef, speed = 1.15, on = true, wobble = 0) {
  const pos = useRef(0)
  useLoop(t => { pos.current = tri(t * speed + wobble * 0.11 * Math.sin(t * 5.3)); if (markRef.current) markRef.current.style.transform = `translate3d(${pos.current * 100}%,0,0)` }, on, [speed, wobble])
  return pos
}
function Timing({ v, seed, onDone, mult = 1, value = 1, label = null }) {
  const r = useRng(seed)
  const zone = useMemo(() => 30 + r() * 40, [r])
  const width = zoneWidth(v) * mult
  const mark = useRef(null)
  const pos = useSweep(mark, 1.4, true, 0.45)
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
  // each one quicker, and from the second on it wobbles (nerves)
  const pos = useSweep(mark, 1.45 + i * 0.22, true, i ? 0.55 + i * 0.2 : 0)
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
// A red decoy (covered, the help is there) baits the tap: it flashes during the
// wait, or opens beside the green one. Tapping red is a miss. Every attempt has
// at least one, never on the first rep; it wears an X so it isn't colour alone.
const FLASH = { 'Took the bait: red is covered.': 'RED · TOOK THE BAIT', 'Jumped early.': 'TOO EARLY', 'Wrong read.': 'WRONG READ', 'Window closed.': 'TOO SLOW' }
function Reaction({ v, seed, rounds, quick = 1, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => {
    const p = Array.from({ length: rounds }, (_, k) => {
      const delay = 650 + r() * 900, open = Math.floor(r() * 3)
      const other = (open + 1 + Math.floor(r() * 2)) % 3
      const early = r() < 0.5
      return { delay, open, decoy: k > 0 && r() < 0.6 ? { k: other, early, at: early ? delay * (0.3 + r() * 0.25) : delay } : null }
    })
    if (rounds > 1 && !p.some(x => x.decoy)) { const x = p[rounds - 1]; x.decoy = { k: (x.open + 1) % 3, early: false, at: x.delay } }
    return p
  }, [r, rounds])
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(null)
  const [decoy, setDecoy] = useState(null)
  const [flash, setFlash] = useState(null)       // what went wrong on the last rep, for a beat
  const [scores, setScores] = useState([])
  const openedAt = useRef(0), outs = useRef(0), baited = useRef(false)
  const T = reactMs(v) * quick   // (some drills give less time)
  useEffect(() => {
    setOpen(null); setDecoy(null)
    const { delay, open: o, decoy: d } = plan[i]
    const ts = [
      setTimeout(() => { setOpen(o); openedAt.current = now(); sfx('tick') }, delay),
      setTimeout(() => { outs.current++; settle(0, 'Window closed.') }, delay + T + 60),
    ]
    // (the early flash makes the same tick as the real one: watch, don't listen)
    if (d) ts.push(setTimeout(() => { setDecoy(d.k); if (d.early) sfx('tick') }, d.at))
    if (d?.early) ts.push(setTimeout(() => setDecoy(null), d.at + 420))
    return () => ts.forEach(clearTimeout)
  }, [i]) // eslint-disable-line
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 900); return () => clearTimeout(t) }, [flash])
  const settle = (s, note) => {
    const next = [...scores, s]
    if (!s) { setFlash(FLASH[note] ?? 'MISSED'); haptic('heavy') }
    // one slip allowed; two and the read is lost (every miss the clock: it says so)
    if (i + 1 >= rounds) {
      const avg = next.reduce((a, b) => a + b, 0) / rounds, made = next.filter(Boolean).length
      const hit = made >= rounds - 1
      onDone({ score: hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, note: hit ? `${made} of ${rounds} reads` : baited.current ? `${made} of ${rounds} · bit on the red` : note, out: outs.current > 0 && outs.current >= next.filter(x => !x).length, raw: { made, of: rounds } })
    }
    else { setScores(next); setI(i + 1) }
  }
  const tap = k => {
    if (k === decoy) { baited.current = true; settle(0, 'Took the bait: red is covered.'); return }
    if (open == null) { settle(0, 'Jumped early.'); return }
    if (k !== open) { settle(0, 'Wrong read.'); return }
    settle(clamp(1 - (now() - openedAt.current) / T, 0.35, 1), null)
  }
  useKeys({ 1: () => tap(0), 2: () => tap(1), 3: () => tap(2), ArrowLeft: () => tap(0), ArrowUp: () => tap(1), ArrowRight: () => tap(2) })
  return (
    <div className="mg-play mg-play--targets">
      <div className="mg-targets">{[0, 1, 2].map(k => <button key={k} className={`mg-target${open === k ? ' is-open' : decoy === k ? ' is-decoy' : ''}`} onPointerDown={() => tap(k)} aria-label={`Target ${k + 1}`}><span /></button>)}</div>
      <span className={`mg-hint${flash ? ' is-bad' : ''}`}>{flash ?? (open == null ? 'WAIT FOR GREEN…' : 'NOW')}</span>
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
      <Clock ms={T} onOut={() => onDone({ score: 0, hit: false, note: 'Delay of game.', out: true })} />
      <span className="mg-look">{look.s}</span>
      <div className="mg-calls">{look.a.map((a, k) => <button key={k} className="mg-call" onPointerDown={() => pick(k)}>{a}</button>)}</div>
    </div>
  )
}
// ── Lanes: the rush comes from a side; go the other way ─────────────────────
// (cue names the pressure: football's RUSH, basketball's DEFENDER)
function Lanes({ v, seed, onDone, need = 2, cue = 'RUSH' }) {
  const r = useRng(seed)
  const plan = useMemo(() => Array.from({ length: 3 }, () => ({ delay: 450 + r() * 700, from: r() < 0.5 ? 'L' : 'R' })), [r])
  const [i, setI] = useState(0)
  const [from, setFrom] = useState(null)
  const [scores, setScores] = useState([])
  const at = useRef(0), outs = useRef(0)
  const T = lanesMs(v)
  useEffect(() => {
    setFrom(null)
    const t1 = setTimeout(() => { setFrom(plan[i].from); at.current = now(); sfx('tick') }, plan[i].delay)
    const t2 = setTimeout(() => { outs.current++; settle(0) }, plan[i].delay + T + 60)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = s => {
    const next = [...scores, s]
    if (i + 1 >= 3) { const avg = next.reduce((a, b) => a + b, 0) / 3; const made = next.filter(Boolean).length; onDone({ score: made >= need ? avg : Math.min(avg, 0.45), hit: made >= need, note: `${made} of 3`, out: outs.current > 0 && outs.current >= 3 - made, raw: { made, of: 3 } }) }
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
      <div className={`mg-rush${from ? ` is-${from}` : ''}`}><i>{from === 'L' ? `◀ ${cue}` : from === 'R' ? `${cue} ▶` : '…'}</i></div>
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
  const outs = useRef(0)
  const step = (ok, late = false) => {
    const n = right + (ok ? 1 : 0)
    if (late) outs.current++
    if (i + 1 >= calls.length) onDone({ score: n / calls.length, hit: n >= 3, note: `${n} of ${calls.length} right`, out: outs.current > 0 && outs.current >= calls.length - n, raw: { made: n, of: calls.length } })
    else { setRight(n); setI(i + 1); sfx(ok ? 'tap' : 'pop') }
  }
  const c = calls[i]
  useKeys({ 1: () => step(c.c === 0), 2: () => step(c.c === 1), 3: () => step(c.c === 2) })
  return (
    <div className="mg-play mg-play--calls" key={i}>
      <Clock ms={T} onOut={() => step(false, true)} />
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
function Dash({ v, seed, onDone, unit = 'YDS', dist = 40 }) {
  const r = useRng(seed)
  const [phase, setPhase] = useState('set')          // set → go
  const [flag, setFlag] = useState(null)              // 'false start' message
  const S = useRef({ goAt: 0, yards: 0, last: null, taps: 0, stumbles: 0, falses: 0, first: 0, done: false })
  const runner = useRef(null), yd = useRef(null), gun = useRef(null)
  const stride = (1.0 + v * 0.055) * dist / 40        // a faster player covers more ground a step
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
    onDone({ score, hit: score >= 0.5, note: `${s.yards >= dist ? 'Through the line' : 'Ran out of time'} · ${react < 0.25 ? 'great jump' : react < 0.45 ? 'clean start' : 'slow start'}${s.falses ? ' · false start' : ''}${s.stumbles ? ` · ${s.stumbles} stumble${s.stumbles > 1 ? 's' : ''}` : ''}` })
  }
  const foot = side => {
    const s = S.current
    if (s.done) return
    if (phase === 'set') { if (s.falses < 2) { s.falses++; setFlag(`FALSE START${s.falses > 1 ? ' · LAST WARNING' : ''}`); sfx('deny'); haptic('heavy'); arm() } return }
    if (!s.first) s.first = now()
    s.taps++
    if (side === s.last) { s.stumbles++; s.yards += stride * 0.25; haptic('light') } else s.yards += stride
    s.last = side
    const y = Math.min(dist, s.yards)
    if (runner.current) runner.current.style.transform = `translate3d(${(y / dist) * 100}%,0,0)`
    if (yd.current) yd.current.textContent = `${Math.round(y)} ${unit}`
    if (s.yards >= dist) finish()
  }
  useKeys({ ArrowLeft: () => foot('L'), ArrowRight: () => foot('R'), f: () => foot('L'), j: () => foot('R') })
  return (
    <div className="mg-play mg-play--dash">
      <div className="mg-lane"><span className="mg-runner-track" ref={runner}><span className="mg-runner" /></span><span className="mg-goal" /></div>
      <span className={`mg-call-out${phase === 'go' ? ' is-go' : ''}`}>{phase === 'set' ? (flag ?? 'SET…') : 'GO!'}</span>
      <span className="mg-hint" ref={yd}>0 {unit}</span>
      <div className="mg-feet">
        <button className="mg-foot" onPointerDown={() => foot('L')} aria-label="Left foot">LEFT</button>
        <button className="mg-foot" onPointerDown={() => foot('R')} aria-label="Right foot">RIGHT</button>
      </div>
      <span className="mg-sub">Wait for GO, then alternate LEFT and RIGHT. Same foot twice is a stumble.</span>
    </div>
  )
}
// ── Throwing velocity: three throws, release on a small moving sweet spot ────
function Velo({ v, seed, onDone, noun = 'THROW' }) {
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
      <span className="mg-hint">{noun} {i + 1} OF 3 · {held ? 'LET GO IN THE GREEN' : noun === 'THROW' ? 'HOLD TO WIND UP' : 'HOLD TO LOAD'}</span>
      <span className="mg-dots">{[0, 1, 2].map(k => <i key={k} className={k < scores.length ? (scores[k] >= 0.5 ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// What you aim at, drawn: a hoop for a shot (backboard, rim, net), a receiver's
// two hands for a throw. The box is the hit zone's width; the drawing is laid out
// on a -60..60 grid with the zone (rx 50) centred at 0,0.
const HOOP = (
  <svg viewBox="-60 -60 120 120" aria-hidden="true">
    <rect x="-56" y="-58" width="112" height="44" rx="3" fill="rgba(255,255,255,.1)" stroke="#e8edf2" strokeWidth="3" />
    <rect x="-20" y="-40" width="40" height="26" fill="none" stroke="#e8edf2" strokeWidth="2.5" />
    <rect x="-4" y="-14" width="8" height="10" fill="#9aa4ae" />
    <ellipse cx="0" cy="0" rx="50" ry="30" className="mg-zone" />
    <g fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.6">
      <path d="M-48 2 L-30 48 M-28 4 L-16 50 M-8 5 L-4 51 M8 5 L4 51 M28 4 L16 50 M48 2 L30 48" />
      <path d="M-42 18 Q0 30 42 18 M-36 34 Q0 44 36 34 M-30 48 Q0 56 30 48" />
    </g>
    <ellipse cx="0" cy="0" rx="50" ry="10" fill="none" stroke="#f97316" strokeWidth="5" />
  </svg>
)
const HAND = (
  <g fill="#f4efe6" stroke="#1d232a" strokeWidth="2" strokeLinejoin="round">
    <rect x="14" y="-30" width="8" height="34" rx="4" />
    <rect x="23" y="-36" width="8" height="40" rx="4" />
    <rect x="32" y="-33" width="8" height="37" rx="4" />
    <rect x="41" y="-25" width="7" height="29" rx="3.5" />
    <rect x="12" y="-6" width="37" height="36" rx="10" />
    <rect x="-2" y="2" width="22" height="9" rx="4.5" transform="rotate(28 18 6)" />
  </g>
)
const HANDS = (
  <svg viewBox="-60 -60 120 120" aria-hidden="true">
    <circle cx="0" cy="0" r="50" className="mg-zone" />
    <g transform="translate(0 2)">{HAND}<g transform="scale(-1 1)">{HAND}</g></g>
  </svg>
)

// ── Accuracy: lock the aim across, then up and down, on four targets ────────
// A shot is aimed at a hoop: the rim is wide but shallow, so the arc (up–down)
// is the tight part. A throw goes to a receiver's hands.
function Aim({ v, seed, onDone, noun = 'NET' }) {
  const r = useRng(seed)
  const hoop = noun === 'SHOT'
  const nets = useMemo(() => [0, 1, 2, 3].map(() => ({ x: 15 + r() * 70, y: 22 + r() * 58 })), [r])
  const rad = 4 + v * 0.5                                       // the zone's half-width in % of the field (4.5–9.5)
  const tall = hoop ? 0.6 : 1                                   // its height against its width (the rim is flat)
  const [i, setI] = useState(0)
  const [axis, setAxis] = useState('x')
  const [scores, setScores] = useState([])
  const [shot, setShot] = useState(null)
  const X = useRef(50), Y = useRef(50), lx = useRef(null), ly = useRef(null)
  const speed = 0.95 + i * 0.2
  useLoop(t => {
    if (axis === 'x') { X.current = tri(t * speed) * 100; if (lx.current) lx.current.style.transform = `translate3d(${X.current}%,0,0)` }
    else { Y.current = tri(t * speed * 1.15) * 100; if (ly.current) ly.current.style.transform = `translate3d(0,${Y.current}%,0)` }
  }, !shot, [axis, i])
  const tap = () => {
    if (shot) return
    if (axis === 'x') { setAxis('y'); sfx('tick'); return }
    const n = nets[i]
    // how far off, in zone radii (the field is 5:3, so a % down is 0.6 of a % across)
    const d = Math.hypot((X.current - n.x) / rad, ((Y.current - n.y) * 0.6) / (rad * tall))
    const s = d <= 1 ? clamp(1 - d * 0.5, 0.5, 1) : 0
    sfx(s ? 'claim' : 'pop'); haptic(s ? 'medium' : 'light')
    setShot({ x: X.current, y: Y.current, hit: !!s })
    const next = [...scores, s]
    setTimeout(() => {
      if (i + 1 >= nets.length) { const avg = next.reduce((a, b) => a + b, 0) / nets.length; onDone({ score: avg, hit: avg >= 0.5, note: `${next.filter(Boolean).length} of ${nets.length} in the net`, raw: { made: next.filter(Boolean).length, of: nets.length } }) }
      else { setScores(next); setI(i + 1); setAxis('x'); setShot(null) }
    }, 450)
  }
  useKeys({ ' ': tap, Enter: tap })
  const n = nets[i]
  return (
    <div className="mg-play mg-play--aim" onPointerDown={tap}>
      <div className="mg-field">
        <span className={`mg-aimat mg-aimat--${hoop ? 'hoop' : 'hands'}`} style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${rad * 2}%` }}>{hoop ? HOOP : HANDS}</span>
        <span className={`mg-line-x${axis === 'x' && !shot ? ' is-live' : ''}`} ref={lx} />
        {axis === 'y' && <span className={`mg-line-y${!shot ? ' is-live' : ''}`} ref={ly} />}
        {shot && <span className={`mg-ball${shot.hit ? ' is-hit' : ''}`} style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />}
      </div>
      <span className="mg-hint">{noun} {i + 1} OF {nets.length} · {axis === 'x' ? 'TAP TO LOCK LEFT–RIGHT' : noun === 'SHOT' ? 'TAP TO LOCK THE ARC' : 'TAP TO LOCK UP–DOWN'}</span>
      <span className="mg-dots">{nets.map((_, k) => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── QB accuracy: throw to receivers on routes, the way the combine does ─────
// A receiver runs a route; tap to throw. The ball is in the air a moment, so it
// has to be thrown early (leading him) to land while he's open: the bright part
// of the route. Accuracy keeps the window open longer. Four routes, each quicker.
const QB_SPOT = { x: 50, y: 90 }
const ROUTES = [
  { name: 'SLANT', pts: [[28, 72], [28, 62], [56, 36]], open: 0.72, secs: 1.5, air: 0.42 },
  { name: 'OUT',   pts: [[74, 72], [74, 40], [93, 40]], open: 0.82, secs: 1.7, air: 0.5 },
  { name: 'POST',  pts: [[24, 72], [24, 46], [50, 16]], open: 0.8, secs: 1.75, air: 0.58 },
  { name: 'GO',    pts: [[80, 72], [80, 8]],             open: 0.84, secs: 1.8, air: 0.7 },
]
// where he is u of the way through the route (by distance)
function routeAt(pts, u) {
  const seg = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]))
  const total = seg.reduce((a, b) => a + b, 0)
  let d = Math.max(0, Math.min(1, u)) * total
  for (let k = 0; k < seg.length; k++) {
    if (d <= seg[k] || k === seg.length - 1) { const f = seg[k] ? Math.min(1, d / seg[k]) : 0; return { x: pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, y: pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f } }
    d -= seg[k]
  }
  return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] }
}
function Routes({ v, onDone }) {
  const [i, setI] = useState(0)
  const [scores, setScores] = useState([])
  const [thrown, setThrown] = useState(null)        // { at: arrival point, hit, note }
  const rcv = useRef(null), ball = useRef(null)
  const st = useRef({ t0: 0, threw: false })
  const rt = ROUTES[i]
  const quick = 1 - i * 0.07                        // each route a little quicker
  const secs = rt.secs * quick
  const half = 0.07 + (v / 11) * 0.09               // how long he's open (in route fractions), from Accuracy
  // a beat before the snap so the route can be read; he lines up, then goes
  useEffect(() => { st.current = { t0: now() + 900, threw: false } }, [i])
  const finish = (s, note) => {
    const next = [...scores, s]
    setTimeout(() => {
      if (i + 1 >= ROUTES.length) {
        const made = next.filter(Boolean).length
        onDone({ score: next.reduce((a, b) => a + b, 0) / ROUTES.length, hit: made >= 3, note: `${made} of ${ROUTES.length} completed`, raw: { made, of: ROUTES.length } })
      } else { setScores(next); setI(i + 1); setThrown(null) }
    }, 900)
  }
  useLoop(t => {
    const u = ((now() - st.current.t0) / 1000) / secs
    const p = routeAt(rt.pts, u)
    if (rcv.current) rcv.current.style.transform = `translate3d(${p.x}cqw, ${p.y * 0.6}cqw, 0)`
    // never thrown: the route runs out
    if (!st.current.threw && u > 1.08) { st.current.threw = true; sfx('pop'); setThrown({ at: p, hit: false, note: 'NO THROW' }); finish(0, 'late') }
    return u < 1.6
  }, true, [i])
  const tap = () => {
    if (st.current.threw || now() < st.current.t0) return
    st.current.threw = true
    const u0 = ((now() - st.current.t0) / 1000) / secs
    const uArr = u0 + (rt.air * quick) / secs          // where he'll be when it gets there
    const at = routeAt(rt.pts, uArr)
    const d = Math.abs(uArr - rt.open) / half
    const s = d <= 1 ? clamp(1 - d * 0.5, 0.5, 1) : 0
    const note = s ? (d < 0.35 ? 'ON THE MONEY' : 'COMPLETE') : uArr < rt.open ? 'TOO EARLY: HE WASN\'T OPEN' : 'TOO LATE: COVERED'
    if (ball.current) {
      ball.current.style.transition = 'none'
      ball.current.style.transform = `translate3d(${QB_SPOT.x}cqw, ${QB_SPOT.y * 0.6}cqw, 0)`
      ball.current.getBoundingClientRect()
      ball.current.style.transition = `transform ${rt.air * quick}s cubic-bezier(.3,.1,.5,1)`
      ball.current.style.transform = `translate3d(${at.x}cqw, ${at.y * 0.6}cqw, 0)`
    }
    sfx('swoosh')
    setTimeout(() => { sfx(s ? 'claim' : 'pop'); haptic(s ? 'medium' : 'light'); setThrown({ at, hit: !!s, note }) }, rt.air * quick * 1000)
    finish(s)
  }
  useKeys({ ' ': tap, Enter: tap })
  // the route drawn, its open stretch brighter
  const path = rt.pts.map(p => `${p[0]},${p[1] * 0.6}`).join(' ')
  const openPts = [rt.open - half, rt.open - half / 2, rt.open, rt.open + half / 2, rt.open + half].map(u => routeAt(rt.pts, u)).map(p => `${p.x},${p.y * 0.6}`).join(' ')
  return (
    <div className="mg-play mg-play--routes" onPointerDown={tap}>
      <div className="mg-field mg-field--routes">
        <svg className="mg-routes-svg" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="43.2" x2="100" y2="43.2" className="mg-los" />
          <polyline points={path} className="mg-route" />
          <polyline points={openPts} className="mg-route-open" />
        </svg>
        <span className="mg-qb" style={{ transform: `translate3d(${QB_SPOT.x}cqw, ${QB_SPOT.y * 0.6}cqw, 0)` }}>QB</span>
        <span className="mg-wr" ref={rcv} />
        <span className={`mg-fb${thrown ? (thrown.hit ? ' is-hit' : ' is-miss') : ''}`} ref={ball} style={{ transform: `translate3d(${QB_SPOT.x}cqw, ${QB_SPOT.y * 0.6}cqw, 0)` }} />
        {thrown?.note && <span className={`mg-rcall${thrown.hit ? ' is-hit' : ''}`}>{thrown.note}</span>}
      </div>
      <span className="mg-hint">{rt.name} · ROUTE {i + 1} OF {ROUTES.length} · TAP TO THROW</span>
      <span className="mg-dots">{ROUTES.map((_, k) => <i key={k} className={k < scores.length ? (scores[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
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
  const at = useRef(0), settled = useRef(false), outs = useRef(0)
  const T = (480 + v * 42) * Math.pow(0.93, i)
  useEffect(() => {
    setCue(null); settled.current = false
    const t1 = setTimeout(() => { setCue(plan[i].dir); at.current = now(); sfx('tick') }, plan[i].gap)
    const t2 = setTimeout(() => { if (!settled.current) outs.current++; settle(0) }, plan[i].gap + T)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = s => {
    if (settled.current) return; settled.current = true
    const next = [...scores, s]
    if (s) haptic('light')
    // clean cuts are the drill (70%); how quick they were adds the rest. All six clean is never a fail.
    if (i + 1 >= plan.length) {
      const made = next.filter(Boolean).length
      const quick = made ? next.filter(Boolean).reduce((a, b) => a + b, 0) / made : 0
      const score = (made / plan.length) * 0.7 + quick * 0.3 * (made / plan.length)
      onDone({ score, hit: made >= plan.length - 1, note: `${made} of ${plan.length} clean cuts`, out: outs.current > 0 && outs.current >= plan.length - made, raw: { made, of: plan.length } })
    }
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
      onDone({ score: st.current.reduce((a, b) => a + b, 0) / N, hit: caught.length >= 5, note: `${caught.length} of ${N} caught`, raw: { made: caught.length, of: N } })
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
function Bench({ v, load = 1, onDone }) {
  const S = useRef({ h: 0, reps: 0, end: 0, done: false })
  const bar = useRef(null), count = useRef(null), secs = useRef(null)
  // Realistic numbers: strength sets how many reps the set can hold (football: the 225 lb
  // combine bar, about 18 for the weakest to 35 for the strongest; basketball (load < 1): the
  // 185 lb bar, about 3 to 22), and the bar fails the way a real set does: every rep near that
  // ceiling lifts less and sinks faster, so fast tapping gets you close to it, never past it
  const ceil = load < 1 ? 1 + v * 1.9 : 16 + v * 1.7   // basketball: the weakest can put up 1-3 (Kevin Durant did 0), the best about 22
  const fail = () => Math.min(0.97, (S.current.reps / ceil) ** 2.2)
  const push = 34 * (1 + v * 0.06) * load
  const SECS = 12
  useEffect(() => { S.current.end = now() + SECS * 1000 }, [])
  useLoop(() => {
    const s = S.current; if (s.done) return false
    const t = now(), dt = Math.min(0.05, (t - (s.last ?? t)) / 1000); s.last = t
    const left = (s.end - t) / 1000
    // the bar sinks between taps, faster as the arms give out
    s.h = Math.max(0, s.h - (30 + fail() * 70) * dt)
    if (bar.current) bar.current.style.transform = `translate3d(0,${-s.h}%,0)`
    const shown = Math.max(0, left).toFixed(1); if (secs.current && secs.current.textContent !== shown) secs.current.textContent = shown
    if (left <= 0) {
      s.done = true
      const reps = s.reps, lo = ceil * 0.35
      // judged against what this player can lift: most of his ceiling is a great set
      onDone({ score: clamp((reps - lo) / (ceil - lo), 0, 1), hit: reps >= ceil * 0.6, note: `${reps} reps`, raw: { reps } })
      return false
    }
  })
  const tap = () => {
    const s = S.current; if (s.done) return
    s.h += push * (1 - fail())
    if (s.h >= 100) { s.h = 0; s.reps++; sfx('tap'); haptic('medium'); if (count.current) count.current.textContent = `${s.reps} REPS` }
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
