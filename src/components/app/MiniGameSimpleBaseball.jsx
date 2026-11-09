import { useEffect, useMemo, useRef, useState } from 'react'
import { seeded } from '../../lib/rng'
import { sfx, haptic } from '../../lib/juice'
import { arsenalOf, PITCH_INFO, PITCH_KEYS, hitterOf, inPlay, runsOn, batterProfile, batterAI, inZone, locate, zoneOf, gauss } from '../../lib/mg/baseballModel'
import { momentSituation } from '../../lib/situations'
import { bbTarget } from '../../lib/mg/combineNorms'
import './mg-simple-baseball.css'

// Baseball's SIMPLE mini games (lib/minigamesSimple.js: the kinds b*): the same calls as the Advanced ones (lib/mg/atbat.js,
// pitch.js, steal.js, ofarm.js), played on a bar and a strike zone, judged by the same models (lib/mg/baseballModel.js).
// Loaded only when one opens (MiniGameSimple.jsx), so nothing here costs the other sports a byte. A press counts on
// pointerdown / keydown at the event's own timestamp; every move is a Web Animation started at an exact moment.
//   bbat     The At-Bat and the Walk-Off: read the pitch, swing in the zone or take it; the count, the result
//   bev      batting practice: five swings, the gun on the best one
//   bsteal   Steal Second: his first move, GO or BACK, then the race to the bag
//   bpitch   Strike Him Out and Escape the Jam: the pitch, the spot, the release
//   bgun     the showcase's gun: fastball velocity, slider spin, the outfield arm
//   bcmd     the bullpen command test: lock the spot on the catcher's glove
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, f) => a + (b - a) * f
const now = () => performance.now()
const pressAt = e => (e && e.timeStamp > 0 ? Math.min(e.timeStamp, now()) : now())
const primary = fn => e => { if (e.button > 0) return; fn(e) }
const useRng = seed => useMemo(() => seeded(`mg-${seed}`), [seed])
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function useOnce(onDone) { const ended = useRef(false); return [r => { if (ended.current) return; ended.current = true; onDone(r) }, ended] }
function useTimers() {
  const ts = useRef([])
  useEffect(() => () => ts.current.forEach(clearTimeout), [])
  return (fn, ms) => { const t = setTimeout(fn, ms); ts.current.push(t); return t }
}
function useKeys(map) {
  const m = useRef(map); m.current = map
  useEffect(() => {
    const dn = e => { const fn = m.current[e.key] ?? m.current[e.key.toLowerCase?.()]; if (!fn) return; e.preventDefault(); if (!e.repeat) fn(e) }
    window.addEventListener('keydown', dn)
    return () => window.removeEventListener('keydown', dn)
  }, [])
}
function glide(el, frames, ms, t0, o = {}) {
  if (!el?.animate) return null
  el.getAnimations?.().forEach(a => a.cancel())
  const a = el.animate(frames, { duration: ms, iterations: 1, fill: o.fill ?? 'forwards', easing: o.easing ?? 'linear' })
  try { a.startTime = t0 } catch {}
  return a
}
const halt = el => el?.getAnimations?.().forEach(a => a.cancel())
function say(el, text, tone) {
  if (!el) return
  el.textContent = text; el.dataset.tone = tone
  el.getAnimations?.().forEach(a => a.cancel())
  const still = 'translate(-50%,0)'
  el.animate?.(reduced() ? [{ opacity: 1, transform: still }, { opacity: 1, transform: still, offset: 0.75 }, { opacity: 0, transform: still }]
    : [{ opacity: 0, transform: 'translate(-50%,5px) scale(.9)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: 0.1 }, { opacity: 1, transform: still, offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,-3px)' }], { duration: 850, easing: 'ease-out', fill: 'forwards' })
}
const Fx = ({ r }) => <span className="mg-fx" ref={r} aria-live="polite" />
const Kbd = ({ k }) => <kbd className="mg-kbd" aria-hidden="true">{k}</kbd>
const Hint = ({ children }) => <span className="mg-hint">{children}</span>
const good = q => { sfx('tap'); haptic(q >= 0.85 ? 'medium' : 'light') }
const bad = () => { sfx('pop'); haptic('heavy') }
// one pass of the marker across the bar, 0 to 100% in ms from t0; where it was at a press, and freeze it there
const PASS = [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(100%,0,0)' }]
const passAt = (t0, ms, ts) => clamp((ts - t0) / ms, 0, 1) * 100
const freezeAt = (el, p) => { halt(el); if (el) el.style.transform = `translate3d(${p.toFixed(2)}%,0,0)` }
function PassBar({ markRef, zoneRef, fx, z0, z1, label }) {
  return (
    <div className="mg-box">
      <Fx r={fx} />
      <div className="mg-bar" aria-hidden="true">
        <span className="mg-zone" ref={zoneRef} style={{ left: `${z0}%`, width: `${z1 - z0}%` }}><i className="mg-zone-mid" /></span>
        <span className="mg-track" ref={markRef}><span className="mg-marker" /></span>
        {label && <i className="mg-bar-label">{label}</i>}
      </div>
    </div>
  )
}
// the plate's spots to the zone box (132 by 150, the strike zone inset 22): x across (-0.5..0.5), y up (0.25..1.35)
const ZX = x => 66 + (x / 0.25) * 44, ZY = y => 75 - ((y - 0.78) / 0.3) * 53
const CELLS = [
  ...[0.98, 0.78, 0.58].flatMap((y, i) => [-0.17, 0, 0.17].map((x, j) => ({ id: `z${i}${j}`, x, y, w: 29, h: 35 }))),
  { id: 'up', x: 0, y: 1.25, w: 86, h: 18 }, { id: 'down', x: 0, y: 0.31, w: 86, h: 18 },
  { id: 'left', x: -0.37, y: 0.62, w: 18, h: 70 }, { id: 'right', x: 0.37, y: 0.62, w: 18, h: 70 },
]
function ZoneBox({ heat = null, ball = null, faint = false, onCell = null, sel = null, target = null }) {
  return (
    <div className="mg-bb-zone" aria-hidden={!onCell}>
      <div className="mg-bb-grid">
        {[0, 1, 2].flatMap(i => [0, 1, 2].map(j => {
          const x = [-0.17, 0, 0.17][j], y = [0.98, 0.78, 0.58][i], z = heat ? zoneOf(x, y, heat.hand) : ''
          const hot = heat && z.startsWith(heat.hot.split('-')[0]) && z.endsWith(heat.hot.split('-')[1]), cold = heat && z.startsWith(heat.cold.split('-')[0]) && z.endsWith(heat.cold.split('-')[1])
          return <span key={`${i}${j}`} className={hot ? 'is-hot' : cold ? 'is-cold' : ''} />
        }))}
      </div>
      {onCell && CELLS.map(c => (
        <button key={c.id} className={`mg-bb-cell${sel === c.id ? ' is-on' : ''}`} style={{ left: ZX(c.x) - c.w / 2, top: ZY(c.y) - c.h / 2, width: c.w, height: c.h }} onPointerDown={primary(() => onCell(c))} aria-label={c.id} />
      ))}
      {target && <span className="mg-bb-cell is-target" style={{ left: ZX(target.x) - 15, top: ZY(target.y) - 17, width: 30, height: 34, pointerEvents: 'none' }} />}
      {ball && <i className={`mg-bb-ball${faint ? ' is-faint' : ''}`} style={{ left: ZX(clamp(ball.x, -0.55, 0.55)), top: ZY(clamp(ball.y, 0.22, 1.38)) }} />}
    </div>
  )
}
const Bases = ({ on }) => <span className="mg-bb-bases" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} className={on?.[i] ? 'is-on' : ''} />)}</span>
const Outs = ({ n }) => <span className="mg-bb-outs" aria-hidden="true">{[0, 1].map(i => <i key={i} className={i < n ? 'is-on' : ''} />)}</span>
function Top({ sit, count, outs, on }) {
  return (
    <div className="mg-bb-top">
      <span>{sit ? `${sit.half === 'B' ? 'BOT' : 'TOP'} ${sit.inning}` : 'SHOWCASE'}</span>
      {sit && <span>{sit.us} {sit.mine} · {sit.them} {sit.opp}</span>}
      <span className="mg-bb-count">{count && <b>{count.b}-{count.s}</b>}{outs != null && <Outs n={outs} />}{on && <Bases on={on} />}</span>
    </div>
  )
}
const where = (to, hand) => {
  const inz = inZone(to.x, to.y)
  if (!inz) return to.y > 1.1 ? 'UP AND OUT' : to.y < 0.46 ? 'IN THE DIRT' : (hand > 0 ? to.x > 0 : to.x < 0) ? 'OFF THE PLATE AWAY' : 'INSIDE'
  return to.y > 0.9 ? 'UP IN THE ZONE' : to.y < 0.66 ? 'AT THE KNEES' : Math.abs(to.x) < 0.09 ? 'RIGHT DOWN THE MIDDLE' : 'ON THE CORNER'
}

export default function BaseballSimple({ def, v, seed, onDone, pos = null }) {
  switch (def.kind) {
    case 'bbat': return <AtBatS v={v} seed={seed} onDone={onDone} walk={!!def.walk} game={def.game} />
    case 'bev': return <TeeS v={v} seed={seed} onDone={onDone} pos={pos} />
    case 'bsteal': return <StealS v={v} seed={seed} onDone={onDone} />
    case 'bpitch': return <PitchS v={v} seed={seed} onDone={onDone} jam={!!def.jam} game={def.game} />
    case 'bgun': return <GunS v={v} seed={seed} onDone={onDone} drill={def.drill} pos={pos} />
    case 'bcmd': return <CommandS v={v} seed={seed} onDone={onDone} pos={pos} />
    default: return null
  }
}

// ── The At-Bat / Walk-Off: pitch by pitch ───────────────────────────────────
function AtBatS({ v, seed, onDone, walk, game }) {
  const r = useRng(seed)
  const H = useMemo(() => hitterOf(v), [v])
  const sit = useMemo(() => momentSituation(game, seed), [game, seed])
  const A = useMemo(() => arsenalOf(null, 7, r() < 0.28 ? 'L' : 'R'), [r])
  const hand = useMemo(() => (r() < 0.25 ? -1 : 1), [r])
  const need = Math.max(1, sit.opp - sit.mine + 1)
  const bases = useMemo(() => ({ on: [...sit.on], outs: sit.outs, send: walk }), [sit, walk])
  const [count, setCount] = useState({ b: sit.balls, s: sit.strikes })
  const [pitch, setPitch] = useState(null), [shown, setShown] = useState(false), [word, setWord] = useState(null), [score, setScore] = useState(null)
  const S = useRef({ count: { b: sit.balls, s: sit.strikes }, n: 0, t0: 0, ms: 0, busy: true, swung: false, last: null, done: false })
  const mark = useRef(null), zoneEl = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const W = (6 + H.t * 8) * 1.1, PLATE = 86, z0 = PLATE - W / 2, z1 = PLATE + W / 2
  const throwOne = () => {
    const s = S.current, { b, s: k } = s.count
    const ahead = k > b, behind = b > k
    const w = behind ? [0.72, 0.16, 0.12] : ahead ? [0.36, 0.38, 0.26] : [0.52, 0.27, 0.21]
    let u = r(); const type = PITCH_KEYS.find((_, i) => (u -= w[i]) <= 0) ?? 'FB'
    const chase = r() < (k === 2 ? 0.48 : ahead ? 0.3 : behind ? 0.06 : 0.16)
    const awayX = hand > 0 ? 1 : -1
    const aim = chase ? (type === 'SL' ? { x: awayX * 0.36, y: 0.38 } : type === 'CH' ? { x: awayX * 0.18, y: 0.32 } : { x: 0, y: 1.24 }) : { x: (r() - 0.5) * 0.36, y: 0.6 + r() * 0.36 }
    const to = locate(aim, lerp(0.15, 0.055, A.command), r), mph = A[type].mph + gauss(r) * 0.8
    const ms = Math.round(((16.6 - 0.2) / (mph * 0.44704)) * 1000 * 2.1)
    const p = { type, mph, to, inz: inZone(to.x, to.y, -0.01) || (inZone(to.x, to.y, 0.025) && r() < 0.5) }
    s.t0 = now() + 30; s.ms = ms / (PLATE / 100); s.busy = false; s.swung = false; s.p = p
    setPitch(p); setShown(false); setWord(null)
    if (mark.current) { mark.current.style.transform = ''; glide(mark.current, PASS, s.ms, s.t0) }
    later(() => setShown(true), Math.max(0, ms * H.read))
    later(() => { if (!S.current.swung && !S.current.done && S.current.p === p) take() }, ms + 140)
  }
  useEffect(() => { later(throwOne, 900) }, []) // eslint-disable-line
  const call = (kind, text) => {
    const s = S.current, c = { ...s.count }
    s.n++
    if (kind === 'B') c.b++
    else if (kind === 'S') c.s++
    else if (kind === 'F' && c.s < 2) c.s++
    s.count = c; setCount(c); setWord(text)
    if (c.b >= 4) return finish({ kind: 'BB', runs: runsOn('BB', bases), out: false, word: 'WALK', call: runsOn('BB', bases) ? 'Ball four, the run forced in' : 'Ball four' })
    if (c.s >= 3) return finish({ kind: 'K', runs: 0, out: true, word: 'STRUCK OUT', call: kind === 'S' && text.startsWith('CALLED') ? 'Caught looking' : 'Swung through it' })
    later(throwOne, 950)
  }
  const take = () => { const s = S.current; if (s.busy || s.done) return; s.busy = true; const p = s.p; say(fx.current, p.inz ? 'STRIKE' : 'BALL', p.inz ? 'miss' : 'hit'); call(p.inz ? 'S' : 'B', p.inz ? 'CALLED STRIKE' : 'BALL') }
  const swing = (e, power) => {
    const s = S.current
    if (s.busy || s.done || !s.p) return
    const ts = pressAt(e), p = passAt(s.t0, s.ms, ts)
    if (p < 20) return
    s.swung = true; s.busy = true
    freezeAt(mark.current, p)
    const P0 = s.p, w = power ? W * 0.82 : W * 1.12, d = Math.abs(p - PLATE), q = clamp(1 - d / (w / 2 + 2), 0, 1)
    // off the plate: he chased it
    if (!P0.inz) { const tip = r() < 0.28; say(fx.current, tip ? 'FOUL' : 'CHASED IT', 'miss'); bad(); return call(tip ? 'F' : 'S', tip ? 'FOUL' : 'SWINGING STRIKE') }
    if (q <= 0.05) { say(fx.current, p < PLATE ? 'EARLY' : 'LATE', 'miss'); bad(); return call('S', 'SWINGING STRIKE') }
    if (q < 0.32) { say(fx.current, 'FOUL', 'miss'); sfx('lock'); return call('F', 'FOUL') }
    sfx('lock'); good(q)
    const ev = lerp(66, H.evMax + (power ? 5 : -6), Math.pow(q, 0.75)) + gauss(r) * 2
    const la = (power ? 20 : 12) + (p < PLATE ? -1 : 1) * d * 0.4 + gauss(r) * 12
    const phi = hand * ((p - PLATE) / (w / 2)) * 22 + gauss(r) * 10
    const res = inPlay({ ev, la, phi: clamp(phi, -44, 44), q }, r, bases)
    say(fx.current, res.word, res.out ? 'miss' : 'hit')
    finish({ ...res, ev: Math.round(ev), dist: Math.round(res.dist / 0.3048) })
  }
  const finish = R0 => {
    let R = R0
    const s = S.current
    if (s.done) return
    s.done = true; setWord(R.word)
    // (a walk-off ends when the winning run scores: only a home run brings them all in)
    if (sit.half === 'B' && sit.inning >= 9 && R.kind !== 'HR' && sit.mine <= sit.opp && sit.mine + R.runs > sit.opp) R = { ...R, runs: sit.opp + 1 - sit.mine }
    if (R.runs) setScore({ mine: sit.mine + R.runs })
    const wo = walk ? R.runs >= need || R.kind === 'HR' : false
    const hit = walk ? wo : !R.out || R.runs > 0
    const score = hit ? ({ HR: 1, '3B': 0.9, '2B': 0.85, '1B': 0.72, BB: 0.6, SF: 0.58 }[R.kind] ?? 0.6) : R.kind === 'K' ? 0.05 : R.kind === 'BB' ? 0.42 : 0.2
    if (hit) sfx('stamp'); else bad()
    later(() => end({ score, hit, note: `${R.call ?? R.word}${R.ev ? ` · ${R.ev} mph off the bat` : ''}${R.runs ? ` · ${R.runs === 1 ? 'a run' : `${R.runs} runs`} in` : ''}`, raw: { result: R.kind, runs: R.runs, pts: R.runs, ev: R.ev ?? null, walkoff: wo } }), 700)
  }
  useKeys({ ' ': e => swing(e, false), Enter: e => swing(e, false), e: e => swing(e, true), E: e => swing(e, true) })
  const info = pitch ? PITCH_INFO[pitch.type] : null
  return (
    <div className="mg-play mg-play--bb">
      <Top sit={score ? { ...sit, ...score } : sit} count={count} outs={sit.outs} on={sit.on} />
      <div className="mg-bb-word">{word ?? (pitch && shown ? info.name : pitch ? '…' : 'HE’S SET')}<small>{pitch && shown ? `${Math.round(pitch.mph)} MPH · ${where(pitch.to, hand)}` : walk ? 'TWO STRIKES: PROTECT THE PLATE' : 'READ IT OUT OF HIS HAND'}</small></div>
      <ZoneBox ball={pitch && shown ? pitch.to : null} faint={!pitch?.inz} />
      <PassBar markRef={mark} zoneRef={zoneEl} fx={fx} z0={z0} z1={z1} label="THE PLATE" />
      <div className="mg-sides">
        <button className="mg-side" onPointerDown={primary(e => swing(e, false))}>CONTACT <Kbd k="SPACE" /></button>
        <button className="mg-side" onPointerDown={primary(e => swing(e, true))}>POWER <Kbd k="E" /></button>
      </div>
      <Hint>SWING AS IT GETS TO THE PLATE · TAKE THE ONES OFF IT</Hint>
    </div>
  )
}

// ── Batting practice: five swings, the gun ──────────────────────────────────
function TeeS({ v, seed, onDone, pos }) {
  const r = useRng(seed)
  const H = useMemo(() => hitterOf(v), [v])
  const target = Math.round(bbTarget('exitVelo', pos === 'pit' ? 'pit' : 'bat', v))
  const [reads, setReads] = useState([])
  const S = useRef({ t0: 0, ms: 0, busy: true, k: 0, reads: [] })
  const mark = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const W = (6 + H.t * 8) * 1.05, PLATE = 84
  const toss = () => { const s = S.current; s.t0 = now() + 40; s.ms = (860 + r() * 160) / (PLATE / 100); s.busy = false; if (mark.current) { mark.current.style.transform = ''; glide(mark.current, PASS, s.ms, s.t0) }; later(() => { if (!s.busy && s.k === S.current.k) hit(null, true) }, s.ms + 200) }
  useEffect(() => { later(toss, 800) }, []) // eslint-disable-line
  const hit = (e, missed = false) => {
    const s = S.current
    if (s.busy) return
    s.busy = true
    const p = missed ? 100 : passAt(s.t0, s.ms, pressAt(e)), d = Math.abs(p - PLATE), q = missed ? 0 : clamp(1 - d / (W / 2 + 2), 0, 1)
    freezeAt(mark.current, p)
    const ev = q > 0.05 ? Math.round(lerp(70, H.evMax + 5, Math.pow(q, 0.7)) - 5 + gauss(r) * 1.5) : 0
    say(fx.current, ev ? `${ev} MPH` : missed ? 'TOOK IT' : p < PLATE ? 'EARLY' : 'LATE', ev >= 95 ? 'hit' : 'miss')
    if (ev) { sfx('lock'); good(q) } else bad()
    s.reads = [...s.reads, ev]; setReads(s.reads); s.k++
    if (s.k >= 5) {
      const best = Math.max(...s.reads), hit = best >= target, hard = s.reads.filter(x => x >= 95).length
      later(() => end({ score: clamp(0.5 + (best - target) / 16, 0, 1), hit, note: `${best} mph best · ${hard} of 5 hit 95+`, raw: { mph: best, made: hard, of: 5 }, stat: { label: 'EXIT VELOCITY', value: String(best), unit: 'MPH', verdict: hit ? 'BARRELED UP' : 'MORE BAT SPEED', sub: `${hard} of 5 hit 95+` } }), 500)
    } else later(toss, 900)
  }
  useKeys({ ' ': e => hit(e), Enter: e => hit(e), e: e => hit(e), E: e => hit(e) })
  return (
    <div className="mg-play mg-play--bb" onPointerDown={primary(e => hit(e))}>
      <div className="mg-bb-top"><span>FRONT TOSS · SWING {Math.min(reads.length + 1, 5)} OF 5</span><span className="mg-bb-count"><b>{reads.length ? `${Math.max(...reads)} MPH` : `MARK ${target}`}</b></span></div>
      <PassBar markRef={mark} fx={fx} z0={PLATE - W / 2} z1={PLATE + W / 2} label="THE TOSS" />
      <Hint>TAP AS IT GETS TO YOU · THE HARDEST ONE COUNTS</Hint>
    </div>
  )
}

// ── Steal Second: his first move, then the race ─────────────────────────────
function StealS({ v, seed, onDone }) {
  const r = useRng(seed)
  const tv = clamp((v - 1) / 10, 0, 1)
  const sit = useMemo(() => momentSituation('steal-second', seed), [seed])
  const plan = useMemo(() => ({ lefty: r() < 0.32, pop: lerp(2.12, 1.86, r()), quick: r() }), [r])
  const [cue, setCue] = useState({ word: 'TAKING HIS LEAD', tone: '' })
  const [pitchN, setPitchN] = useState(0)
  const S = useRef({ phase: 'lead', moveAt: 0, cueAt: 0, move: null, done: false, n: 0, picks: 0 })
  const me = useRef(null), ballEl = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const vmax = lerp(7.6, 9.35, tv)
  const setUp = () => {
    const s = S.current
    s.phase = 'set'; setCue({ word: 'HE’S SET', tone: '' })
    later(() => {
      if (S.current.done) return
      const pk = s.picks ? 0.14 : 0.26
      s.move = r() < pk ? 'pickoff' : 'home'; s.slide = s.move === 'home' && r() < 0.42
      s.moveAt = now(); s.phase = 'move'
      // the read: a right-hander's knee (home) or his spin (over); a lefty's leg comes up either way, then the foot shows
      if (!plan.lefty) { s.cueAt = s.moveAt; setCue(s.move === 'home' ? { word: s.slide ? 'SLIDE STEP' : 'LEG KICK', tone: 'is-go' } : { word: 'HE SPINS', tone: 'is-back' }) }
      else { setCue({ word: 'LEG UP…', tone: '' }); s.cueAt = s.moveAt + 260; later(() => { if (!S.current.done && S.current.moveAt === s.moveAt) setCue(s.move === 'home' ? { word: 'FOOT TO THE PLATE', tone: 'is-go' } : { word: 'FOOT TO FIRST', tone: 'is-back' }) }, 260) }
      s.toPlate = (s.slide ? lerp(1.18, 1.32, plan.quick) : lerp(1.36, 1.6, plan.quick)) * 1000
      s.toFirst = (plan.lefty ? 780 : 720)
      later(() => { const t = S.current; if (t.done || t.moveAt !== s.moveAt || t.acted) return; if (s.move === 'pickoff') out('PICKED OFF', 'Caught off the bag'); else nextPitch() }, s.move === 'home' ? s.toPlate + 200 : s.toFirst)
    }, 900 + r() * 1700)
  }
  useEffect(() => { later(setUp, 900) }, []) // eslint-disable-line
  const nextPitch = () => {
    const s = S.current
    s.n++; setPitchN(s.n); s.acted = false
    if (s.n >= 3) return out('STAYED PUT', 'Never got the jump he wanted', 0.3)
    setCue({ word: ['BALL ONE', 'STRIKE ONE', 'FOUL BALL'][s.n % 3], tone: '' }); later(setUp, 1100)
  }
  const out = (word, note, score = 0.1) => { const s = S.current; if (s.done) return; s.done = true; setCue({ word, tone: 'is-back' }); say(fx.current, word, 'miss'); bad(); later(() => end({ score, hit: false, note, raw: { result: word === 'STAYED PUT' ? 'STAY' : word === 'PICKED OFF' ? 'PO' : 'CS', safe: false } }), 700) }
  const go = e => {
    const s = S.current
    if (s.done || s.acted || s.phase === 'lead') return
    const ts = pressAt(e)
    s.acted = true
    if (s.phase === 'set') return later(() => out('CAUGHT LEANING', 'Went before he moved: the pitcher stepped off'), 500)
    if (s.move === 'pickoff') return later(() => out('PICKED OFF', 'Went on the move to first'), 300)
    // the race: his jump off the first move, his speed, against the time to the plate and the catcher's pop
    const jump = (ts - s.moveAt) / 1000 - tv * 0.07
    const runT = jump + 23.0 / vmax + lerp(0.42, 0.33, tv), defT = s.toPlate / 1000 + plan.pop + 0.12 + gauss(r) * 0.03
    const safe = runT <= defT
    glide(me.current, [{ transform: 'translate3d(8%,0,0)' }, { transform: 'translate3d(92%,0,0)' }], runT * 1000 * 0.6, now(), { easing: 'ease-in' })
    glide(ballEl.current, [{ transform: 'translate3d(0%,0,0)', opacity: 0 }, { transform: 'translate3d(0%,0,0)', opacity: 1, offset: (s.toPlate / 1000 - jump) / defT }, { transform: 'translate3d(92%,0,0)', opacity: 1 }], defT * 1000 * 0.6, now())
    s.done = true
    later(() => {
      setCue({ word: safe ? 'SAFE' : 'OUT', tone: safe ? 'is-go' : 'is-back' }); say(fx.current, safe ? 'STOLEN BASE' : 'GUNNED DOWN', safe ? 'hit' : 'miss'); safe ? sfx('stamp') : bad()
      later(() => end({ score: safe ? clamp(0.7 + clamp(0.35 - jump, 0, 0.3), 0, 1) : 0.1, hit: safe, note: `${safe ? (jump < 0.25 ? 'Great jump, in ahead of the tag' : 'Beat the throw') : jump > 0.42 ? 'Late jump: the throw beat him' : 'Gunned down at second'} · jump ${jump.toFixed(2)} · pop ${plan.pop.toFixed(2)}`, raw: { result: safe ? 'SB' : 'CS', safe, jump: Math.round(jump * 100) / 100, pop: Math.round(plan.pop * 100) / 100 } }), 700)
    }, Math.max(runT, defT) * 1000 * 0.6 + 80)
  }
  const back = e => {
    const s = S.current
    if (s.done || s.acted || s.phase === 'lead') return
    const ts = pressAt(e)
    s.acted = true
    if (s.phase === 'set' || s.move === 'home') { say(fx.current, 'BACK TO THE BAG', 'miss'); return later(nextPitch, 600) }
    const safe = ts - s.moveAt + 300 <= s.toFirst + 40
    if (!safe) return out('PICKED OFF', 'Dove back, but the tag beat him')
    say(fx.current, 'BACK IN TIME', 'hit'); good(1); s.picks++
    later(setUp, 1000)
  }
  useKeys({ ' ': go, Enter: go, e: back, E: back })
  return (
    <div className="mg-play mg-play--bb">
      <Top sit={sit} count={null} outs={sit.outs} on={[true, false, false]} />
      <div className="mg-box"><Fx r={fx} /><div className={`mg-bb-pitcher ${cue.tone}`}>{cue.word}</div></div>
      <div className="mg-bb-race" aria-hidden="true"><i className="is-me" ref={me} style={{ transform: 'translate3d(8%,0,0)' }} /><i className="is-ball" ref={ballEl} style={{ opacity: 0 }} /><b>{plan.lefty ? 'LEFTY' : 'RIGHTY'} · PITCH {Math.min(pitchN + 1, 3)} OF 3</b></div>
      <div className="mg-sides">
        <button className="mg-side" onPointerDown={primary(go)}>GO <Kbd k="SPACE" /></button>
        <button className="mg-side" onPointerDown={primary(back)}>BACK <Kbd k="E" /></button>
      </div>
      <Hint>{plan.lefty ? 'A LEFTY: WATCH WHERE HIS FOOT COMES DOWN' : 'GO ON HIS LEG KICK · BACK WHEN HE SPINS'}</Hint>
    </div>
  )
}

// ── Strike Him Out / Escape the Jam: the pitch, the spot, the release ───────
function PitchS({ v, seed, onDone, jam, game }) {
  const r = useRng(seed)
  const sit = useMemo(() => momentSituation(game, seed), [game, seed])
  const A = useMemo(() => arsenalOf(null, v, r() < 0.25 ? 'L' : 'R'), [v, r])
  const batters = useMemo(() => [0, 1].map(i => batterProfile(null, 7 + (r() - 0.5) * 2, r() < 0.35 ? 'L' : 'R', `${seed}-${i}`)), [r, seed])
  const [bi, setBi] = useState(0), [count, setCount] = useState({ b: 0, s: 0 }), [outs, setOuts] = useState(sit.outs), [score, setScore] = useState(null)
  const [type, setType] = useState('FB'), [cell, setCell] = useState(null), [stage, setStage] = useState('pick'), [last, setLast] = useState(null), [word, setWord] = useState(null)
  const S = useRef({ t0: 0, ms: 900, count: { b: 0, s: 0 }, outs: sit.outs, bi: 0, last: null, done: false, busy: false, ks: 0 })
  const mark = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const tv = clamp((v - 1) / 10, 0, 1), W = 7 + tv * 9, Z = 78
  const B = batters[bi]
  const deliver = () => {
    if (!cell || S.current.busy || S.current.done) return
    const s = S.current
    s.busy = true; setStage('deliver')
    s.t0 = now() + 40; s.ms = 1000
    if (mark.current) { mark.current.style.transform = ''; glide(mark.current, PASS, s.ms, s.t0) }
    later(() => { if (S.current.stage !== 'thrown') release(null) }, s.ms + 40)
    s.stage = 'live'
  }
  const release = e => {
    const s = S.current
    if (s.stage !== 'live') return
    s.stage = 'thrown'
    const p = e ? passAt(s.t0, s.ms, pressAt(e)) : 100, d = Math.abs(p - Z), q = clamp(1 - d / (W / 2 + 2), 0, 1)
    freezeAt(mark.current, p)
    say(fx.current, q > 0.7 ? 'PERFECT RELEASE' : q > 0.3 ? 'GOOD' : p < Z ? 'EARLY' : 'LATE', q > 0.3 ? 'hit' : 'miss')
    const sd = lerp(0.14, 0.046, A.command) * lerp(1.6, 0.55, q)
    const P0 = A[type], to = locate({ x: cell.x * (B.hand > 0 ? 1 : 1), y: cell.y }, sd, r)
    const pitch = { type, mph: P0.mph - (1 - q) * 2, to, q: clamp(P0.q * (0.85 + 0.2 * q), 0, 1), perfect: q > 0.7, gb: A.gb }
    const ai = batterAI(B, pitch, s.count, s.last, r)
    s.last = pitch; setLast(pitch)
    later(() => resolve(ai, pitch), 380)
  }
  const resolve = (ai, pitch) => {
    const s = S.current, c = { ...s.count }
    const nextPitch = () => { s.busy = false; s.stage = null; setStage('pick'); setCell(null) }
    const newBatter = () => { s.bi = Math.min(1, s.bi + 1); setBi(s.bi); s.count = { b: 0, s: 0 }; setCount(s.count); s.last = null; nextPitch() }
    if (ai.kind === 'play') {
      const res = inPlay(ai.bb, r, { on: sit.on, outs: s.outs, dp: jam ? 0.8 : 0.62 }), runs = res.runs
      setWord(res.word)
      if (runs > 0 || !res.out) return finish({ ...res, runs })
      s.outs += res.outs; setOuts(Math.min(2, s.outs))
      if (s.outs >= 3 || !jam) return finish({ ...res, runs: 0 })
      return later(newBatter, 900)
    }
    if (ai.kind === 'ball') { c.b++; setWord('BALL'); if (c.b >= 4) { s.count = c; setCount(c); return finish({ kind: 'BB', runs: runsOn('BB', { on: sit.on, outs: s.outs }), out: false, word: 'WALK', call: 'Ball four' }) } }
    else if (ai.kind === 'foul') { if (c.s < 2) c.s++; setWord('FOUL') }
    else { c.s++; setWord(ai.kind === 'strike' ? 'CALLED STRIKE' : 'SWING AND A MISS'); sfx('tap') }
    s.count = c; setCount(c)
    if (c.s >= 3) {
      s.ks++; s.outs++; setOuts(Math.min(2, s.outs)); say(fx.current, 'STRIKEOUT', 'hit'); sfx('stamp')
      if (s.outs >= 3 || !jam) return finish({ kind: 'K', runs: 0, out: true, word: 'STRIKEOUT', call: ai.kind === 'strike' ? 'Froze him with strike three' : 'Got him swinging' })
      return later(newBatter, 900)
    }
    later(nextPitch, 650)
  }
  const finish = R => {
    const s = S.current
    if (s.done) return
    s.done = true
    if (R.runs) setScore({ opp: sit.opp + R.runs })
    const hit = R.out && !R.runs && (!jam || s.outs >= 3)
    const score = hit ? (R.kind === 'K' ? 0.9 : R.kind === 'DP' ? 0.85 : 0.6) : R.kind === 'BB' ? 0.25 : 0.1
    say(fx.current, jam && hit ? (R.kind === 'DP' ? 'DOUBLE PLAY' : 'ESCAPED') : R.word, hit ? 'hit' : 'miss'); hit ? sfx('stamp') : bad()
    later(() => end({ score, hit, note: `${R.call ?? R.word}${R.runs ? ` · ${R.runs === 1 ? 'the run scores' : `${R.runs} runs score`}` : ''}`, raw: { result: R.kind, runs: R.runs ?? 0, pts: R.runs ?? 0, ks: s.ks } }), 800)
  }
  const keyType = i => { if (stage === 'pick') { setType(PITCH_KEYS[i]); sfx('tap') } }
  useKeys({ ' ': e => (stage === 'deliver' ? release(e) : deliver()), Enter: e => (stage === 'deliver' ? release(e) : deliver()), 1: () => keyType(0), 2: () => keyType(1), 3: () => keyType(2) })
  return (
    <div className="mg-play mg-play--bb">
      <Top sit={score ? { ...sit, ...score } : sit} count={count} outs={outs} on={sit.on} />
      <div className="mg-bb-word">{word ?? (stage === 'pick' ? (cell ? 'THROW IT' : 'PICK A SPOT') : 'RELEASE')}<small>{B.hot.toUpperCase().replace('-', ' ')} IS HIS ZONE{B.chases ? ` · CHASES THE ${B.chases === 'SL' ? 'SLIDER' : 'CHANGEUP'}` : ''}</small></div>
      <ZoneBox heat={B} onCell={stage === 'pick' ? c => { setCell(c); sfx('tap') } : null} sel={cell?.id} ball={last?.to ?? null} />
      <div className="mg-bb-chips">{PITCH_KEYS.map((k, i) => <button key={k} className={`mg-bb-chip${type === k ? ' is-on' : ''}`} style={{ borderLeftColor: PITCH_INFO[k].col }} onPointerDown={primary(() => keyType(i))}>{PITCH_INFO[k].short} {Math.round(A[k].mph)}<small>{PITCH_INFO[k].name}</small></button>)}</div>
      <PassBar markRef={mark} fx={fx} z0={Z - W / 2} z1={Z + W / 2} label="RELEASE" />
      <div className="mg-sides mg-sides--one"><button className="mg-side" onPointerDown={primary(e => (stage === 'deliver' ? release(e) : deliver()))}>{stage === 'deliver' ? 'RELEASE' : 'PITCH'} <Kbd k="SPACE" /></button></div>
      <Hint>PICK THE PITCH AND THE SPOT · RELEASE IN THE ZONE</Hint>
    </div>
  )
}

// ── The showcase's gun: the fastball, the slider's spin, the outfield arm ───
const GUNS = {
  'pitch-velo': { label: 'FASTBALL VELOCITY', unit: 'MPH', n: 5, bar: 'RELEASE', norm: 'penVelo', avg: false },
  spin: { label: 'SPIN RATE', unit: 'RPM', n: 5, bar: 'THE SNAP', norm: 'spin', avg: true },
  'arm-strength': { label: 'ARM STRENGTH', unit: 'MPH', n: 3, bar: 'CROW HOP', norm: 'ofArm', avg: false },
}
function GunS({ v, seed, onDone, drill, pos }) {
  const G = GUNS[drill] ?? GUNS['pitch-velo']
  const r = useRng(seed)
  const tv = clamp((v - 1) / 10, 0, 1), W = 6 + tv * 8, Z = 80
  const side = drill === 'arm-strength' ? 'bat' : 'pit'
  const target = bbTarget(G.norm, pos === 'bat' || pos === 'pit' ? pos : side, v)
  const [reads, setReads] = useState([])
  const S = useRef({ t0: 0, ms: 0, busy: true, reads: [] })
  const mark = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const fmt = x => (G.unit === 'RPM' ? x.toLocaleString('en-US') : String(Math.round(x)))
  const go = () => { const s = S.current; s.t0 = now() + 40; s.ms = 900 + r() * 160; s.busy = false; if (mark.current) { mark.current.style.transform = ''; glide(mark.current, PASS, s.ms, s.t0) }; later(() => { if (!S.current.busy && S.current.t0 === s.t0) tap(null) }, s.ms + 60) }
  useEffect(() => { later(go, 700) }, []) // eslint-disable-line
  const tap = e => {
    const s = S.current
    if (s.busy) return
    s.busy = true
    const p = e ? passAt(s.t0, s.ms, pressAt(e)) : 100, d = Math.abs(p - Z), q = clamp(1 - d / (W / 2 + 2), 0, 1)
    freezeAt(mark.current, p)
    // the reading: all of it on a perfect one, less the further off
    const val = G.unit === 'RPM' ? Math.round((target * 1.01 * (0.9 + 0.105 * q) + gauss(r) * 20) / 10) * 10 : Math.round((target + 0.9 - (1 - q) * 4.5 + gauss(r) * 0.5) * 10) / 10
    say(fx.current, `${fmt(val)} ${G.unit}`, val >= target ? 'hit' : 'miss')
    q > 0.3 ? good(q) : bad()
    s.reads = [...s.reads, val]; setReads(s.reads)
    if (s.reads.length >= G.n) {
      const best = G.avg ? Math.round(s.reads.reduce((a, b) => a + b, 0) / s.reads.length / 10) * 10 : Math.max(...s.reads)
      const hit = best >= target - (G.unit === 'RPM' ? 0 : 0.2)
      const raw = G.unit === 'RPM' ? { rpm: best, max: Math.max(...s.reads), of: G.n } : { mph: Math.round(best), best, of: G.n }
      later(() => end({ score: clamp(0.5 + (best - target) / (G.unit === 'RPM' ? 400 : 6), 0, 1), hit, note: `${fmt(best)} ${G.unit.toLowerCase()} ${G.avg ? 'average' : 'best'}`, raw, stat: { label: G.label, value: fmt(best), unit: G.unit, verdict: hit ? 'ABOVE THE MARK' : 'BELOW THE MARK', sub: `${G.avg ? 'Average' : 'Best'} of ${G.n} · the mark ${fmt(Math.round(target * (G.unit === 'RPM' ? 0.1 : 1)) * (G.unit === 'RPM' ? 10 : 1))}` } }), 450)
    } else later(go, 800)
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-play mg-play--bb" onPointerDown={primary(tap)}>
      <div className="mg-bb-top"><span>{G.label} · {Math.min(reads.length + 1, G.n)} OF {G.n}</span><span className="mg-bb-count"><b>{reads.length ? `${fmt(G.avg ? Math.round(reads.reduce((a, b) => a + b, 0) / reads.length / 10) * 10 : Math.max(...reads))} ${G.unit}` : `MARK ${fmt(G.unit === 'RPM' ? Math.round(target / 10) * 10 : Math.round(target))}`}</b></span></div>
      <PassBar markRef={mark} fx={fx} z0={Z - W / 2} z1={Z + W / 2} label={G.bar} />
      <Hint>TAP IN THE ZONE{G.avg ? ' · THE AVERAGE COUNTS' : ' · THE BEST ONE COUNTS'}</Hint>
    </div>
  )
}

// ── The bullpen command test: lock it across, then up and down, on his glove ─
function CommandS({ v, seed, onDone, pos }) {
  const r = useRng(seed)
  const A = useMemo(() => arsenalOf(null, v, 'R'), [v])
  const need = Math.max(2, Math.round(bbTarget('command', pos === 'bat' ? 'bat' : 'pit', v) - 0.8))
  const spots = useMemo(() => Array.from({ length: 8 }, () => CELLS[Math.floor(r() * 9)]), [r])
  const [k, setK] = useState(0), [stage, setStage] = useState('x'), [made, setMade] = useState(0), [aim, setAim] = useState(null)
  const S = useRef({ t0: 0, stage: 'x', x: 0, busy: false, made: 0, k: 0 })
  const lineX = useRef(null), lineY = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const SPAN = 1.0 + (1 - clamp((v - 1) / 10, 0, 1)) * 0.5   // (a looser arm: the line moves quicker)
  const sweep = (el, y = false) => { const s = S.current; s.t0 = now() + 30; if (el) glide(el, y ? [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,100%,0)' }, { transform: 'translate3d(0,0,0)' }] : [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(100%,0,0)' }, { transform: 'translate3d(0,0,0)' }], 1500 / SPAN, s.t0, { fill: 'none' }) }
  useEffect(() => { sweep(lineX.current) }, []) // eslint-disable-line
  const at = ts => { const u = ((ts - S.current.t0) / (1500 / SPAN)) % 1; return u < 0.5 ? u * 2 : 2 - u * 2 }
  const tap = e => {
    const s = S.current
    if (s.busy) return
    const u = at(pressAt(e))
    if (s.stage === 'x') { s.x = lerp(-0.42, 0.42, u); s.stage = 'y'; setStage('y'); halt(lineX.current); if (lineX.current) lineX.current.style.transform = `translate3d(${u * 100}%,0,0)`; sweep(lineY.current, true); sfx('tap'); return }
    s.busy = true
    halt(lineY.current); if (lineY.current) lineY.current.style.transform = `translate3d(0,${u * 100}%,0)`
    const y = lerp(1.25, 0.3, u), T = spots[s.k]
    const miss = Math.hypot(s.x - T.x, (y - T.y) * 0.9) + Math.abs(gauss(r)) * lerp(0.06, 0.02, A.command)
    const hit = miss <= 0.085
    if (hit) { s.made++; setMade(s.made) }
    setAim({ x: s.x, y })
    say(fx.current, hit ? 'ON THE GLOVE' : `${Math.round(miss / 0.0254)} IN OFF`, hit ? 'hit' : 'miss'); hit ? good(1) : bad()
    s.k++
    if (s.k >= spots.length) return later(() => end({ score: clamp(0.5 + (s.made - need) / 6, 0, 1), hit: s.made >= need, note: `${s.made} of ${spots.length} on the glove`, raw: { made: s.made, of: spots.length }, stat: { label: 'BULLPEN COMMAND', value: `${s.made}/${spots.length}`, unit: 'ON THE GLOVE', verdict: s.made >= need ? 'PINPOINT' : 'BELOW THE MARK', sub: `The mark ${need} of ${spots.length}` } }), 600)
    later(() => { s.busy = false; s.stage = 'x'; setStage('x'); setK(s.k); setAim(null); if (lineY.current) lineY.current.style.transform = ''; sweep(lineX.current) }, 750)
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-play mg-play--bb" onPointerDown={primary(tap)}>
      <div className="mg-bb-top"><span>PITCH {Math.min(k + 1, 8)} OF 8</span><span className="mg-bb-count"><b>{made} ON</b><span>NEED {need}</span></span></div>
      <div className="mg-box"><Fx r={fx} />
        <div style={{ position: 'relative' }}>
          <ZoneBox target={spots[Math.min(k, 7)]} ball={aim} />
          <span ref={lineX} aria-hidden="true" style={{ position: 'absolute', left: ZX(-0.42), top: 0, height: 150, width: ZX(0.42) - ZX(-0.42), pointerEvents: 'none' }}><i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: stage === 'x' ? '#f2f2ee' : 'rgba(242,242,238,.45)' }} /></span>
          <span ref={lineY} aria-hidden="true" style={{ position: 'absolute', left: 0, width: 132, top: ZY(1.25), height: ZY(0.3) - ZY(1.25), pointerEvents: 'none', opacity: stage === 'y' ? 1 : 0 }}><i style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: '#f2f2ee' }} /></span>
        </div>
      </div>
      <Hint>TAP TO LOCK IT ACROSS, THEN UP AND DOWN, ON HIS GLOVE</Hint>
    </div>
  )
}
